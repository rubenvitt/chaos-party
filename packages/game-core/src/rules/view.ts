/**
 * Öffentliche Sicht auf den Spielstand (ohne `internal`, ohne Standardoption und absolute
 * Fristen). Form passt zu `BoardViewSchema` im Protokoll; Fristen werden zu Restzeiten.
 */
import type {
  GamePhase,
  ItemKind,
  MinigameOutcome,
  MinigamePlacement,
  MinigameReward,
  MinigameTeams,
  PlayerStats,
  PromptKind,
  PromptOption,
  RankingEntry,
  Slot,
  GameState,
} from '../types.ts';

export interface PublicPrompt {
  readonly id: number;
  readonly slot: Slot;
  readonly kind: PromptKind;
  readonly title: string;
  readonly options: readonly PromptOption[];
  /** Restzeit bis zur Frist (ms, aufgerundet) oder `null` = unbegrenzt. */
  readonly remainingMs: number | null;
}

export interface PublicPlayer {
  readonly slot: Slot;
  readonly name: string;
  readonly spaceId: string;
  readonly coins: number;
  readonly trophies: number;
  readonly items: readonly ItemKind[];
  readonly connected: boolean;
  readonly minigameWins: number;
  readonly stats: PlayerStats;
}

export interface PublicGameView {
  readonly boardId: string;
  readonly gamePhase: GamePhase;
  readonly round: number;
  readonly rounds: number;
  readonly turnOrder: readonly Slot[];
  readonly activeSlot: Slot | null;
  readonly players: readonly PublicPlayer[];
  readonly trophySpaces: readonly string[];
  readonly trophyPrice: number;
  readonly traps: readonly { readonly spaceId: string; readonly owner: Slot }[];
  readonly prompt: PublicPrompt | null;
  /** Restzeit der laufenden automatischen Phase (ms) oder `null`. */
  readonly remainingMs: number | null;
  readonly stepMs: number;
  readonly ranking: readonly RankingEntry[] | null;
  readonly minigame: PublicMinigame | null;
  readonly paused: boolean;
  readonly endedEarly: boolean;
}

/** Minispiel der Runde für den Host (M3): Kennung, Seed, gelaufene Spielzeit, Ergebnis. */
export interface PublicMinigame {
  readonly id: string;
  readonly round: number;
  readonly seed: number;
  readonly playMs: number;
  /** Lief schon einmal in dieser Partie: kurze Anleitung (CHAOS-66). */
  readonly repeat: boolean;
  /** CHAOS-214: in der Anleitung schon bereite Slots; fehlt = Anleitung wartet nicht darauf. */
  readonly ready?: readonly Slot[];
  /** CHAOS-89: Aufstellung bei Teams bzw. Koop; fehlt = jeder gegen jeden. */
  readonly teams?: MinigameTeams;
  /** CHAOS-89: Ausgang bei Teams bzw. Koop, sobald das Ergebnis feststeht. */
  readonly outcome?: MinigameOutcome;
  /** Seit Beginn von `minigame-play` vergangene Zeit (ms) oder `null` davor. */
  readonly elapsedMs: number | null;
  readonly placements: readonly MinigamePlacement[] | null;
  readonly highlights: readonly string[];
  readonly aborted: boolean;
  readonly rewards: readonly MinigameReward[] | null;
}

function remaining(until: number | null, at: number): number | null {
  return until === null ? null : Math.max(0, Math.ceil(until - at));
}

/**
 * Uhr für Restzeiten: In der Pause steht sie auf dem Pausenbeginn (M4), damit Countdowns
 * und Minispiel-Spielzeit stehen bleiben, statt scheinbar abzulaufen.
 */
export function viewClock(state: GameState, at: number): number {
  return state.paused && state.pausedAt !== null ? state.pausedAt : at;
}

/** Öffentliche Sicht zum Zeitpunkt `at` (Standard: `state.now`). */
export function toPublicView(state: GameState, now: number = state.now): PublicGameView {
  const at = viewClock(state, now);
  const prompt = state.prompt;
  return {
    boardId: state.boardId,
    gamePhase: state.phase,
    round: state.round,
    rounds: state.rounds,
    turnOrder: [...state.turnOrder],
    activeSlot: state.activeSlot,
    players: state.players.map((p) => ({
      slot: p.slot,
      name: p.name,
      spaceId: p.spaceId,
      coins: p.coins,
      trophies: p.trophies,
      items: [...p.items],
      connected: p.connected,
      minigameWins: p.minigameWins,
      stats: { ...p.stats },
    })),
    trophySpaces: [...state.trophySpaces],
    trophyPrice: state.config.rules.trophy.price,
    traps: state.traps.map((t) => ({ spaceId: t.spaceId, owner: t.owner })),
    prompt: prompt
      ? {
          id: prompt.id,
          slot: prompt.slot,
          kind: prompt.kind,
          title: prompt.title,
          options: prompt.options.map((o) => ({ ...o })),
          remainingMs: remaining(prompt.deadline, at),
        }
      : null,
    remainingMs: remaining(state.resumeAt, at),
    stepMs: state.config.rules.pacing.stepMs,
    ranking: state.ranking ? state.ranking.map((r) => ({ ...r })) : null,
    minigame: state.minigame
      ? {
          id: state.minigame.id,
          round: state.minigame.round,
          seed: state.minigame.seed,
          playMs: state.minigame.playMs,
          repeat: state.minigame.repeat,
          ...(state.minigame.ready ? { ready: [...state.minigame.ready] } : {}),
          ...(state.minigame.teams ? { teams: copyTeams(state.minigame.teams) } : {}),
          ...(state.minigame.outcome ? { outcome: { ...state.minigame.outcome } } : {}),
          elapsedMs:
            state.minigame.playStartedAt === null
              ? null
              : Math.max(0, Math.floor(at - state.minigame.playStartedAt)),
          placements: state.minigame.placements
            ? state.minigame.placements.map((p) => ({ ...p }))
            : null,
          highlights: [...state.minigame.highlights],
          aborted: state.minigame.aborted,
          rewards: state.minigame.rewards
            ? state.minigame.rewards.map((r) =>
                r.items ? { ...r, items: [...r.items] } : { ...r },
              )
            : null,
        }
      : null,
    paused: state.paused,
    endedEarly: state.endedEarly,
  };
}

/** Tiefe Kopie einer Aufstellung (CHAOS-89). */
export function copyTeams(teams: MinigameTeams): MinigameTeams {
  return { ...teams, teams: teams.teams.map((team) => [...team]) };
}
