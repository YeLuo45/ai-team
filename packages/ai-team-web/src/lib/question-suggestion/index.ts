// V163: barrel export for the question-suggestion subsystem.

export type {
  PreviousQuestion,
  EvaluationSummary,
  TranscriptChunkInput,
  QuestionSuggestionInput,
  QuestionSuggestion,
  SuggestionTrigger,
  QuestionSuggestionAgent,
} from './types';

export {
  listQuestionSuggestionAgents,
  listQuestionSuggestionAgentOptions,
  getQuestionSuggestionAgent,
  getDefaultQuestionSuggestionAgentId,
} from './registry';

export type { QuestionSuggestionAgentOption } from './registry';

export { MockQuestionSuggestionAgent, listMockTemplates } from './mock-question-suggestion-agent';
export {
  LlmQuestionSuggestionAgent,
  type LlmClient,
  type LlmQuestionSuggestionAgentOptions,
} from './llm-question-suggestion-agent';

export {
  type AdoptedSuggestion,
  type HistoryFile,
  STORAGE_KEY,
  MAX_ENTRIES,
  readHistory,
  writeHistory,
  appendAdopted,
  clearHistory,
  removeAdopted,
  buildAdoption,
  exportHistoryJson,
} from './history';

export {
  type SuggestionCache,
  CACHE_KEY,
  PER_KEY_CAP,
  POSITION_KEY_CAP,
  EMPTY_CACHE,
  emptyCache,
  readCache,
  writeCache,
  remember,
  rememberCandidate,
  rememberPosition,
  recallCandidate,
  recallPosition,
  forgetCandidate,
  countCached,
  exportCacheJson,
} from './cache';
