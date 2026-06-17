# @ai-team/agent

Agent runtime for ai-team — orchestrates multi-turn interview dialogue and AI-driven training plan generation. Inspired by pi-mono's `pi-agent-core` package.

## InterviewAgent

Drives a multi-turn AI interview:
- 5-8 turns (configurable)
- Tracks full transcript
- Auto-finalizes with structured Evaluation JSON (overall, breakdown, strengths, concerns, recommendation)

```ts
import { InterviewAgent } from '@ai-team/agent';
import { createFromEnv } from '@ai-team/ai';

const llm = createFromEnv();
const agent = new InterviewAgent(llm);
const session = agent.start(candidate);

const q1 = await session.nextQuestion();
const a1 = '候选人回答 1';
const q2 = await session.submitAnswer(a1);
// ... or
const finalEval = await session.finalize();
```

## TrainingAgent

Generates 3-6 month training plans based on member's current skills + target role + weakness areas.

```ts
import { TrainingAgent } from '@ai-team/agent';

const agent = new TrainingAgent(llm);
const trainings = await agent.generateTrainingRecords({
  member,
  targetRole: '高级工程师',
  skills: [{ name: 'TypeScript', score: 70 }],
  weaknessAreas: ['系统设计'],
});
```
