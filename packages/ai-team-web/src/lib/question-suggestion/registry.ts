// V163: Question suggestion agent registry. Lists the default providers
// (mock + llm stub); the team can extend this list as more agents ship.

import type { QuestionSuggestionAgent } from './types';
import { MockQuestionSuggestionAgent } from './mock-question-suggestion-agent';

export interface QuestionSuggestionAgentOption {
  id: string;
  label: string;
  remote: boolean;
}

export function listQuestionSuggestionAgents(): QuestionSuggestionAgent[] {
  // Mock is always available. LLM is registered on-demand via `getOrCreateLlmAgent`.
  return [new MockQuestionSuggestionAgent()];
}

export function listQuestionSuggestionAgentOptions(): QuestionSuggestionAgentOption[] {
  return listQuestionSuggestionAgents().map((a) => ({
    id: a.id,
    label: a.label,
    remote: a.remote,
  }));
}

export function getQuestionSuggestionAgent(id: string): QuestionSuggestionAgent | undefined {
  return listQuestionSuggestionAgents().find((a) => a.id === id);
}

export function getDefaultQuestionSuggestionAgentId(): string {
  return 'mock';
}
