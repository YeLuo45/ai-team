// Interview agent — orchestrates multi-turn AI interview + evaluation

import { LLMClient, buildInterviewMessages, buildEvaluationMessages } from '@ai-team/ai';
import type {
  Interview,
  InterviewTurn,
  Evaluation,
  Candidate,
  InterviewType,
} from '@ai-team/core';
import { generateId, nowIso } from '@ai-team/core';

export interface InterviewSession {
  interview: Interview;
  /** Get the next interviewer question */
  nextQuestion: () => Promise<string>;
  /** Submit candidate's answer and get next question (or null if done) */
  submitAnswer: (answer: string) => Promise<string | null>;
  /** Force end and produce evaluation */
  finalize: () => Promise<Evaluation>;
  /** Whether the interview has reached max turns */
  isComplete: () => boolean;
}

const MAX_TURNS = 8;     // 4-5 Q&A pairs typical
const EVAL_AFTER = 6;    // request evaluation when >= 6 turns reached

export class InterviewAgent {
  constructor(
    private llm: LLMClient,
    private opts: {
      maxTurns?: number;
      evalAfter?: number;
      model?: string;
    } = {}
  ) {}

  /**
   * Start a new interview session for a candidate.
   * Returns a session object that can be driven by a CLI or web UI.
   */
  start(candidate: Candidate, options: { type?: InterviewType; interviewerName?: string } = {}): InterviewSession {
    const turns: InterviewTurn[] = [];
    const id = generateId('iv');
    const startedAt = nowIso();

    const interview: Interview = {
      id,
      candidateId: candidate.id,
      position: candidate.position,
      type: options.type ?? 'technical',
      startedAt,
      status: 'in_progress',
      turns,
      aiConducted: true,
      ...(options.interviewerName ? { interviewerName: options.interviewerName } : { interviewerName: 'AI' }),
    };

    const session: InterviewSession = {
      interview,
      isComplete: () => turns.length >= (this.opts.maxTurns ?? MAX_TURNS) * 2,
      nextQuestion: async () => {
        const messages = buildInterviewMessages(
          candidate.position,
          candidate.name,
          candidate.resume,
          turns.map((t) => ({ role: t.role, content: t.content }))
        );
        const resp = await this.llm.chat({
          messages,
          ...(this.opts.model && { model: this.opts.model }),
          temperature: 0.6,
        });
        const question = resp.content.trim();
        turns.push({
          role: 'interviewer',
          content: question,
          timestamp: nowIso(),
        });
        return question;
      },
      submitAnswer: async (answer: string) => {
        turns.push({
          role: 'candidate',
          content: answer,
          timestamp: nowIso(),
        });
        if (turns.length >= (this.opts.evalAfter ?? EVAL_AFTER) * 2) {
          // We've collected enough; produce eval and return null
          return null;
        }
        // Get next question; if LLM returns evaluation JSON, treat as done
        const next = await session.nextQuestion();
        if (next.trim().startsWith('{')) {
          // LLM returned evaluation JSON — force finalize
          return null;
        }
        return next;
      },
      finalize: async () => {
        const messages = buildEvaluationMessages(
          candidate.position,
          turns.map((t) => ({ role: t.role, content: t.content }))
        );
        const resp = await this.llm.chat({
          messages,
          ...(this.opts.model && { model: this.opts.model }),
          temperature: 0.3,
        });
        return this.parseEvaluation(resp.content, resp.model);
      },
    };

    return session;
  }

  private parseEvaluation(content: string, model: string): Evaluation {
    // Try to extract JSON from the content (LLM might wrap it in markdown)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error(`Could not parse evaluation JSON: ${content.slice(0, 200)}`);
    }
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      overall: clampScore(parsed.overall ?? 50),
      breakdown: {
        technical: clampScore(parsed.breakdown?.technical ?? 50),
        communication: clampScore(parsed.breakdown?.communication ?? 50),
        problemSolving: clampScore(parsed.breakdown?.problemSolving ?? 50),
        culture: clampScore(parsed.breakdown?.culture ?? 50),
      },
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths.slice(0, 5) : [],
      concerns: Array.isArray(parsed.concerns) ? parsed.concerns.slice(0, 5) : [],
      recommendation: normalizeRecommendation(parsed.recommendation),
      summary: parsed.summary ?? '（无总结）',
      evaluatedAt: nowIso(),
      modelUsed: model,
    };
  }
}

function clampScore(n: unknown): number {
  const v = typeof n === 'number' ? n : 50;
  return Math.max(0, Math.min(100, Math.round(v)));
}

function normalizeRecommendation(r: unknown): Evaluation['recommendation'] {
  const valid = ['strong_hire', 'hire', 'no_hire', 'strong_no_hire'] as const;
  if (typeof r === 'string' && (valid as readonly string[]).includes(r)) {
    return r as Evaluation['recommendation'];
  }
  return 'no_hire';
}
