/**
 * Spielregeln (Zustandsautomat, Würfel, Bewegung, Ökonomie, Items, Reaktionsfenster;
 * CHAOS-17/19/20/21) und Bot-Simulation für Balance-Experimente (CHAOS-24).
 */
export { createGame, step } from './machine.ts';
export {
  DEFAULT_RULES,
  DEFAULT_TEAM_REWARDS,
  START_TEAM_REWARDS,
  TAILWIND_RULE,
  ZERO_PACING,
  withRules,
  withTailwind,
  type RuleOverrides,
} from './defaults.ts';
export { rankPlayers } from './economy.ts';
export { stealLoss, type ReactionResult } from './reaction.ts';
export {
  BOARD_EVENT_KINDS,
  COIN_RAIN_AMOUNT,
  GUST_MAX_STEPS,
  GUST_MIN_STEPS,
  LUCKY_FIND_AMOUNT,
} from './spaces.ts';
export { ITEM_KINDS } from './items.ts';
export {
  ACTIVE_ITEMS,
  BRACE_OPTION,
  BUY_OPTION,
  CANCEL_OPTION,
  NO_REACTION_OPTION,
  ROLL_OPTION,
  SHIELD_OPTION,
  SKIP_OPTION,
  itemOption,
  slotOption,
} from './prompts.ts';
export {
  copyTeams,
  toPublicView,
  viewClock,
  type PublicGameView,
  type PublicMinigame,
  type PublicPlayer,
  type PublicPrompt,
} from './view.ts';
export {
  DEFAULT_MINIGAME_RESULT_GRACE_MS,
  PLACEHOLDER_MINIGAME,
  playedMinigames,
} from './minigame.ts';
export {
  FAVORITE_WEIGHT,
  ROTATION_LOOKAHEAD,
  SECRET_CHOICE_IPAD_WEIGHT,
  eligibleMinigames,
  fillMinigameBag,
  minigameWeight,
  pickMinigameIndex,
  rememberMinigame,
  ROTATION_MEMORY,
} from './rotation.ts';
export {
  DEFAULT_BOT_POLICY,
  sampleDelay,
  simulateGame,
  summarizeSimulations,
  type BotPolicy,
  type DelayModel,
  type LogNormalMs,
  type MsRange,
  type SabotageLoss,
  type SimulationOptions,
  type SimulationPlayerResult,
  type SimulationResult,
  type SimulationSummary,
} from './simulate.ts';
