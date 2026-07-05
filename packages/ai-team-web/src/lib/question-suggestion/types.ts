// V163: QuestionSuggestion agent interface + supporting types.
//
// This file is the "agent definition". Two implementations (Mock, LLM) live
// alongside it (mock-question-suggestion-agent.ts, llm-question-suggestion-
// agent.ts) and are selected at runtime via the registry.

export interface PreviousQuestion {
  readonly question: string;
  readonly askedAt: number;
  readonly focusTag?: 'technical' | 'communication' | 'problemSolving' | 'culture';
}

export interface EvaluationSummary {
  readonly round: number;
  readonly overall: number | null;
  readonly focusTag?: 'technical' | 'communication' | 'problemSolving' | 'culture';
}

/** The most recent transcript chunks (STT or chat). */
export interface TranscriptChunkInput {
  readonly text: string;
  readonly speaker: 'candidate' | 'interviewer' | 'unknown';
  readonly timestamp: number;
}

export interface QuestionSuggestionInput {
  readonly sessionId: string;
  readonly position: string;
  readonly candidateName: string;
  readonly previousQuestions: ReadonlyArray<PreviousQuestion>;
  readonly recentTranscript: ReadonlyArray<TranscriptChunkInput>;
  readonly evaluationHistory: ReadonlyArray<EvaluationSummary>;
  /** Trigger reason (manual button, content shift, time-based) — purely informational. */
  readonly trigger: SuggestionTrigger;
}

/** What the agent produces — passed to the UI panel. */
export interface QuestionSuggestion {
  readonly id: string;
  readonly question: string;
  readonly rationale: string;
  readonly focusTag?: 'technical' | 'communication' | 'problemSolving' | 'culture';
  readonly difficulty: 'easy' | 'medium' | 'hard';
  readonly followUpHints?: ReadonlyArray<string>;
  readonly generatedAt: number;
}

export type SuggestionTrigger =
  | { readonly kind: 'manual' }
  | { readonly kind: 'content-shift' }
  | { readonly kind: 'time-based'; readonly elapsedMs: number };

/**
 * The agent abstraction. All implementations accept the same input and
 * produce a `QuestionSuggestion`. The agent decides what to surface — the UI
 * only renders.
 */
export interface QuestionSuggestionAgent {
  readonly id: string;
  readonly label: string;
  /** Whether the agent requires LLM connectivity. */
  readonly remote: boolean;
  /** Generate a question suggestion. May throw if the input is invalid or remote fails. */
  suggest(input: QuestionSuggestionInput): Promise<QuestionSuggestion>;
}
