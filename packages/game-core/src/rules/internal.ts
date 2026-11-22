/**
 * Interner Arbeitszustand der Spielregeln.
 *
 * `step` kopiert den Eingangszustand in einen veränderbaren Entwurf (`Draft`), die
 * Regelmodule arbeiten darauf und sammeln Ereignisse; am Ende wird daraus wieder ein
 * `GameState`. Der Eingangszustand wird nie verändert.
 */
import { cableCarAt } from '../board/hazards.ts';
import { activeNext } from '../board/rotation.ts';
import { createRng, type Rng } from '../rng.ts';
import type {
  BoardDefinition,
  BoardSpace,
  GameEvent,
  GamePhase,
  GameState,
  ItemKind,
  MinigameState,
  PlayerState,
  PlayerStats,
  Prompt,
  RankingEntry,
  RuleSet,
  Slot,
  TrapState,
} from '../types.ts';

/** Ausgang des gerade animierten Bewegungsabschnitts. */
export type MovePending = 'path' | 'trophy' | 'trap' | 'land';

export interface MoveState {
  /** Noch zu laufende Felder. */
  stepsLeft: number;
  /** An einer Verzweigung gewählter nächster Schritt (gilt für genau einen Schritt). */
  chosenNext: string | null;
  /** `null` = nächster Abschnitt wird berechnet, sonst: was am Abschnittsende passiert. */
  pending: MovePending | null;
}

export interface ReactionState {
  attacker: Slot;
  target: Slot;
  item: ItemKind;
}

/** Form von `GameState.internal` (nur game-core liest sie). */
export interface Internal {
  /** Brett-Topologie (Daten, wird nie verändert). */
  board: BoardDefinition;
  /** Fortsetzungszustand des RNG (`createRng(rng)`). */
  rng: number;
  /** Zuletzt vergebene Prompt-ID (0 = noch keiner). */
  promptSeq: number;
  /** Index des aktiven Spielers in `turnOrder`. */
  turnIndex: number;
  /** In diesem Zug schon ein Item eingesetzt? (höchstens eins pro Zug) */
  itemUsed: boolean;
  /** Zahl der Würfel für den nächsten Wurf (Doppelwürfel = 2). */
  diceCount: number;
  move: MoveState | null;
  reaction: ReactionState | null;
  /** Ursprüngliche Frist des offenen Prompts (ohne Verkürzung durch Disconnect). */
  promptBaseDeadline: number | null;
  /** Noch nicht gespielte Minispiele der aktuellen Mischung (M3). */
  minigameBag: string[];
  /** Zuletzt gespieltes Minispiel (keine direkte Wiederholung beim Neumischen). */
  minigameLast: string | null;
  /** Zuletzt gezogene Minispiele, neuestes zuerst (Mischregeln der Rotation, CHAOS-85). */
  minigameHistory: string[];
  /** Schon gestartete Minispiele dieser Partie (CHAOS-66: kurze Anleitung bei Wiederholung). */
  minigamePlayed: string[];
  /**
   * CHAOS-214: Mindestdauer der wartenden Anleitung vorbei; ab jetzt startet das letzte
   * „Bereit“ das Minispiel sofort. Fehlt in Zuständen von vor CHAOS-214 (= `false`).
   */
  minigameReadyOpen?: boolean;
  /**
   * CHAOS-90: Runde, deren Minispiel per Brett-Ereignis „Schnellfeuer!“ Schnellfeuer wird.
   * Fehlt in älteren Zuständen (= keine).
   */
  rapidFireRound?: number;
  /** CHAOS-90: So viele Schnellfeuer-Runden liefen in dieser Partie (fehlt = 0). */
  rapidFireCount?: number;
}

export type MutablePlayer = {
  -readonly [K in Exclude<keyof PlayerState, 'items' | 'stats'>]: PlayerState[K];
} & {
  items: ItemKind[];
  stats: { -readonly [K in keyof PlayerStats]: PlayerStats[K] };
};

export interface Draft {
  boardId: string;
  phase: GamePhase;
  round: number;
  rounds: number;
  turnOrder: Slot[];
  activeSlot: Slot | null;
  players: MutablePlayer[];
  trophySpaces: string[];
  traps: TrapState[];
  prompt: Prompt | null;
  resumeAt: number | null;
  now: number;
  ranking: readonly RankingEntry[] | null;
  paused: boolean;
  pausedAt: number | null;
  endedEarly: boolean;
  minigame: MinigameState | null;
  config: GameState['config'];
  internal: Internal;
}

export interface Ctx {
  readonly d: Draft;
  readonly events: GameEvent[];
  readonly rng: Rng;
  readonly rules: RuleSet;
  readonly spaces: ReadonlyMap<string, BoardSpace>;
}

export function readInternal(state: GameState): Internal {
  return state.internal as unknown as Internal;
}

const spaceCache = new WeakMap<BoardDefinition, ReadonlyMap<string, BoardSpace>>();

export function spaceMap(board: BoardDefinition): ReadonlyMap<string, BoardSpace> {
  let map = spaceCache.get(board);
  if (!map) {
    map = new Map(board.spaces.map((space) => [space.id, space]));
    spaceCache.set(board, map);
  }
  return map;
}

/** Veränderbare Kopie des Zustands; das Brett wird geteilt (es ist unveränderlich). */
export function openDraft(state: GameState): Ctx {
  const internal = readInternal(state);
  const d: Draft = {
    boardId: state.boardId,
    phase: state.phase,
    round: state.round,
    rounds: state.rounds,
    turnOrder: [...state.turnOrder],
    activeSlot: state.activeSlot,
    players: state.players.map((p) => ({ ...p, items: [...p.items], stats: { ...p.stats } })),
    trophySpaces: [...state.trophySpaces],
    traps: state.traps.map((t) => ({ ...t })),
    prompt: state.prompt,
    resumeAt: state.resumeAt,
    now: state.now,
    ranking: state.ranking,
    paused: state.paused,
    pausedAt: state.pausedAt,
    endedEarly: state.endedEarly,
    minigame: state.minigame,
    config: state.config,
    internal: {
      ...internal,
      minigameBag: [...internal.minigameBag],
      minigameHistory: [...internal.minigameHistory],
      minigamePlayed: [...internal.minigamePlayed],
      move: internal.move ? { ...internal.move } : null,
      reaction: internal.reaction ? { ...internal.reaction } : null,
    },
  };
  return {
    d,
    events: [],
    rng: createRng(internal.rng),
    rules: state.config.rules,
    spaces: spaceMap(internal.board),
  };
}

export function closeDraft(ctx: Ctx): GameState {
  const { d } = ctx;
  const internal: Internal = { ...d.internal, rng: ctx.rng.state() };
  return {
    boardId: d.boardId,
    phase: d.phase,
    round: d.round,
    rounds: d.rounds,
    turnOrder: d.turnOrder,
    activeSlot: d.activeSlot,
    players: d.players,
    trophySpaces: d.trophySpaces,
    traps: d.traps,
    prompt: d.prompt,
    resumeAt: d.resumeAt,
    now: d.now,
    ranking: d.ranking,
    paused: d.paused,
    pausedAt: d.pausedAt,
    endedEarly: d.endedEarly,
    minigame: d.minigame,
    config: d.config,
    internal: internal as unknown as Readonly<Record<string, unknown>>,
  };
}

export function playerOf(ctx: Ctx, slot: Slot): MutablePlayer {
  const player = ctx.d.players.find((p) => p.slot === slot);
  if (!player) throw new Error(`Unbekannter Spieler ${String(slot)}`);
  return player;
}

export function activePlayer(ctx: Ctx): MutablePlayer {
  const slot = ctx.d.activeSlot;
  if (slot === null) throw new Error('Kein Spieler am Zug');
  return playerOf(ctx, slot);
}

export function spaceOf(ctx: Ctx, id: string): BoardSpace {
  const space = ctx.spaces.get(id);
  if (!space) throw new Error(`Unbekanntes Feld ${id}`);
  return space;
}

/** Automatische Phase setzen: läuft bis `t + ms`, kein Prompt offen. */
/**
 * Offene Nachfolger eines Felds in der laufenden Runde: bei einem drehenden Feld (Karussell,
 * CHAOS-199) nur der aktuelle Ausgang, sonst `next`.
 */
export function nextOf(ctx: Ctx, id: string): readonly string[] {
  return activeNext(ctx.d.internal.board, id, ctx.d.round);
}

/**
 * Wege, die `slot` ab `id` gehen kann: {@link nextOf} ohne Seilbahnen, die zu teuer sind
 * (CHAOS-198). Bleibt einer übrig, gibt es keine Wegwahl.
 */
export function pathOptions(ctx: Ctx, id: string, slot: Slot): readonly string[] {
  const next = nextOf(ctx, id);
  if (!ctx.d.internal.board.cableCars) return next;
  const coins = playerOf(ctx, slot).coins;
  return next.filter((to) => (cableCarAt(ctx.d.internal.board, id, to)?.price ?? 0) <= coins);
}

export function schedule(ctx: Ctx, phase: GamePhase, t: number, ms: number): void {
  ctx.d.phase = phase;
  ctx.d.prompt = null;
  ctx.d.internal.promptBaseDeadline = null;
  ctx.d.resumeAt = t + ms;
}
