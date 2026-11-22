/** Brett-KI (CHAOS-181, ADR-020): Entscheidungen, Stärke, Zeitmodelle, KI-Plätze. */
export {
  decideBoardPrompt,
  distanceTo,
  SMART_DOUBLE_MIN_DISTANCE,
  SMART_STEAL_MIN_COINS,
  SMART_TRAP_MAX_BEHIND,
  smartItemOption,
  TRAP_LOOKAHEAD,
  type BoardDecisionPolicy,
  type RouteChoice,
} from './board.ts';
export {
  AI_DEADLINE_MARGIN_MS,
  AI_STREAM_PURPOSES,
  aiStreamSeed,
  answerBoardPrompt,
  boardAiReadyDelay,
  createBoardAiSeat,
  type AiStreamPurpose,
  type BoardAiAnswer,
  type BoardAiPromptInput,
  type BoardAiSeat,
} from './seat.ts';
export {
  BOARD_AI_LEICHT,
  BOARD_AI_MITTEL,
  BOARD_AI_SCHWER,
  boardAiParams,
  boardAiStrengthValue,
  type BoardAiChance,
  type BoardAiChances,
  type BoardAiParams,
  type BoardAiStrength,
  type BoardAiWeights,
} from './strength.ts';
export {
  sampleDelay,
  sampleRange,
  type DelayModel,
  type LogNormalMs,
  type MsRange,
} from './timing.ts';
