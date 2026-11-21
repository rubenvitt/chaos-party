/** Aus den Schemas abgeleitete TypeScript-Typen (eine Quelle der Wahrheit). */
import type { z } from 'zod';
import type {
  ACTIONS,
  BOARD_EVENT_KINDS,
  BoardEventSchema,
  BoardMessageSchema,
  BoardPlayerSchema,
  BoardViewSchema,
  BUTTONS,
  ChooseMessageSchema,
  ConfigureMessageSchema,
  ControllerLobbyInfoSchema,
  EndGameMessageSchema,
  LobbySettingsSchema,
  LobbyBoardSchema,
  LobbyMinigameSchema,
  ControllerMinigameTeamSchema,
  MinigameOutcomeSchema,
  MinigameResultAckMessageSchema,
  MinigameTeamsSchema,
  MinigameRewardSchema,
  PauseMessageSchema,
  PickCharacterMessageSchema,
  RANKING_CRITERIA,
  RematchMessageSchema,
  ResumeMessageSchema,
  ClientMessageSchema,
  COIN_REASONS,
  ControllerBoardInfoSchema,
  ControllerMinigameInfoSchema,
  ContextMessageSchema,
  ControllerMessageSchema,
  ERROR_CODES,
  ErrorMessageSchema,
  FEEDBACK_KINDS,
  FeedbackMessageSchema,
  GAME_MODES,
  GAME_PHASES,
  GESTURE_KINDS,
  GestureMessageSchema,
  HeartbeatAckMessageSchema,
  HeartbeatMessageSchema,
  HostHelloMessageSchema,
  HostReadyMessageSchema,
  HostMessageSchema,
  InputIntentSchema,
  InputMessageSchema,
  ITEM_KINDS,
  JoinMessageSchema,
  LAYOUTS,
  LobbyMessageSchema,
  LobbyPlayerSchema,
  MinigameControlsSchema,
  MinigamePlacementSchema,
  MinigameResultMessageSchema,
  MoveMessageSchema,
  PHASES,
  PlayerInfoSchema,
  PressMessageSchema,
  PROMPT_KINDS,
  PromptOptionSchema,
  PromptSchema,
  RankingEntrySchema,
  ReactionMessageSchema,
  RateMessageSchema,
  RatingsMessageSchema,
  MinigameRatingSchema,
  ReadyMessageSchema,
  ReconnectMessageSchema,
  ReleaseMessageSchema,
  ServerMessageSchema,
  ServerToControllerMessageSchema,
  ServerToHostMessageSchema,
  StartMessageSchema,
  VOTES,
  WelcomeMessageSchema,
} from './schemas.ts';

export type Phase = (typeof PHASES)[number];
export type Button = (typeof BUTTONS)[number];
export type GestureKind = (typeof GESTURE_KINDS)[number];
export type Action = (typeof ACTIONS)[number];
export type Layout = (typeof LAYOUTS)[number];
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];
export type ErrorCode = (typeof ERROR_CODES)[number];
export type GameMode = (typeof GAME_MODES)[number];
export type GamePhaseName = (typeof GAME_PHASES)[number];
export type ItemKindName = (typeof ITEM_KINDS)[number];
export type PromptKindName = (typeof PROMPT_KINDS)[number];
export type BoardEventKindName = (typeof BOARD_EVENT_KINDS)[number];
export type CoinReasonName = (typeof COIN_REASONS)[number];
export type RankingCriterion = (typeof RANKING_CRITERIA)[number];
export type Vote = (typeof VOTES)[number];

// Controller → Server
export type JoinMessage = z.infer<typeof JoinMessageSchema>;
export type ReconnectMessage = z.infer<typeof ReconnectMessageSchema>;
export type ReadyMessage = z.infer<typeof ReadyMessageSchema>;
export type MoveMessage = z.infer<typeof MoveMessageSchema>;
export type PressMessage = z.infer<typeof PressMessageSchema>;
export type ReleaseMessage = z.infer<typeof ReleaseMessageSchema>;
export type GestureMessage = z.infer<typeof GestureMessageSchema>;
export type ReactionMessage = z.infer<typeof ReactionMessageSchema>;
export type ChooseMessage = z.infer<typeof ChooseMessageSchema>;
export type PickCharacterMessage = z.infer<typeof PickCharacterMessageSchema>;
export type RateMessage = z.infer<typeof RateMessageSchema>;
export type HeartbeatMessage = z.infer<typeof HeartbeatMessageSchema>;
export type ControllerMessage = z.infer<typeof ControllerMessageSchema>;

// Host → Server
export type HostHelloMessage = z.infer<typeof HostHelloMessageSchema>;
export type HostReadyMessage = z.infer<typeof HostReadyMessageSchema>;
export type StartMessage = z.infer<typeof StartMessageSchema>;
export type MinigameResultMessage = z.infer<typeof MinigameResultMessageSchema>;
export type ConfigureMessage = z.infer<typeof ConfigureMessageSchema>;
export type PauseMessage = z.infer<typeof PauseMessageSchema>;
export type ResumeMessage = z.infer<typeof ResumeMessageSchema>;
export type EndGameMessage = z.infer<typeof EndGameMessageSchema>;
export type RematchMessage = z.infer<typeof RematchMessageSchema>;
export type HostMessage = z.infer<typeof HostMessageSchema>;

export type ClientMessage = z.infer<typeof ClientMessageSchema>;
export type ClientMessageType = ClientMessage['type'];

// Server → Controller
export type PlayerInfo = z.infer<typeof PlayerInfoSchema>;
export type WelcomeMessage = z.infer<typeof WelcomeMessageSchema>;
export type ContextMessage = z.infer<typeof ContextMessageSchema>;
export type PromptOptionInfo = z.infer<typeof PromptOptionSchema>;
export type PromptInfo = z.infer<typeof PromptSchema>;
export type ControllerBoardInfo = z.infer<typeof ControllerBoardInfoSchema>;
export type ControllerMinigameInfo = z.infer<typeof ControllerMinigameInfoSchema>;
export type ControllerMinigameTeam = z.infer<typeof ControllerMinigameTeamSchema>;
export type MinigameTeamsInfo = z.infer<typeof MinigameTeamsSchema>;
export type MinigameOutcomeInfo = z.infer<typeof MinigameOutcomeSchema>;
export type ControllerLobbyInfo = z.infer<typeof ControllerLobbyInfoSchema>;
export type MinigamePlacementInfo = z.infer<typeof MinigamePlacementSchema>;
export type MinigameControlsInfo = z.infer<typeof MinigameControlsSchema>;
export type FeedbackMessage = z.infer<typeof FeedbackMessageSchema>;
export type ErrorMessage = z.infer<typeof ErrorMessageSchema>;
export type HeartbeatAckMessage = z.infer<typeof HeartbeatAckMessageSchema>;
export type ServerToControllerMessage = z.infer<typeof ServerToControllerMessageSchema>;

// Server → Host
export type LobbyPlayer = z.infer<typeof LobbyPlayerSchema>;
export type LobbyMessage = z.infer<typeof LobbyMessageSchema>;
export type LobbySettings = z.infer<typeof LobbySettingsSchema>;
/** Wählbares Brett in `lobby.settings.boards` (CHAOS-197). */
export type LobbyBoard = z.infer<typeof LobbyBoardSchema>;
/** Minispiel der Rotation in `lobby.settings.minigames` (CHAOS-85). */
export type LobbyMinigame = z.infer<typeof LobbyMinigameSchema>;
export type InputIntent = z.infer<typeof InputIntentSchema>;
export type InputIntentType = InputIntent['type'];
export type InputMessage = z.infer<typeof InputMessageSchema>;
export type BoardPlayer = z.infer<typeof BoardPlayerSchema>;
export type RankingEntryInfo = z.infer<typeof RankingEntrySchema>;
export type BoardView = z.infer<typeof BoardViewSchema>;
export type BoardEvent = z.infer<typeof BoardEventSchema>;
export type BoardMessage = z.infer<typeof BoardMessageSchema>;
export type MinigameRewardInfo = z.infer<typeof MinigameRewardSchema>;
export type MinigameResultAckMessage = z.infer<typeof MinigameResultAckMessageSchema>;
export type MinigameRating = z.infer<typeof MinigameRatingSchema>;
export type RatingsMessage = z.infer<typeof RatingsMessageSchema>;
export type ServerToHostMessage = z.infer<typeof ServerToHostMessageSchema>;

export type ServerMessage = z.infer<typeof ServerMessageSchema>;
export type ServerMessageType = ServerMessage['type'];

/** Jede Nachricht des Protokolls, egal in welche Richtung. */
export type ProtocolMessage = ClientMessage | ServerMessage;
export type ProtocolMessageType = ProtocolMessage['type'];

/** Nachrichten mit `slot` und `seq`, die einem Spielerplatz zugeordnet sind. */
export type SlotIntentMessage = Extract<ControllerMessage, { slot: number; seq: number }>;

/** Rolle einer Verbindung, festgelegt durch die erste Nachricht. */
export type Role = 'controller' | 'host';

export interface ProtocolError {
  code: ErrorCode;
  message: string;
}

export type ParseResult<T> = { ok: true; message: T } | { ok: false; error: ProtocolError };
