/**
 * EXP-044 (CHAOS-186): Verhalten sich die Spielstile messbar verschieden, ohne die Siegquote
 * deutlich zu verschieben?
 *
 * Aufbau: vier Live-KI-Plätze (`answerBoardPrompt` mit eigenen Strömen je Platz, wie im Server)
 * gleicher Stärke spielen ganze Partien auf dem Standardbrett mit der echten Minispiel-Rotation
 * (Bot-Punkte gleichverteilt, also ohne Können). Die Stile rotieren je Seed über die Plätze, so
 * sitzt jeder Stil gleich oft auf jedem Platz. Die Kontrolle spielt dieselben Seeds ohne Stil.
 *
 * ```sh
 * EXPERIMENTS=personality pnpm exec vitest run packages/game-core/src/ai/personalityExperiment.test.ts --silent=false
 * ```
 *
 * Näherung: Menschen fehlen, alle vier sind KI. Kein Spaß-Beweis.
 */
import { DEFAULT_BOARD } from '../board/index.ts';
import { DEFAULT_RULES } from '../rules/defaults.ts';
import { ROTATION_SPECS } from '../rules/experimentsM4.ts';
import { simulateGame } from '../rules/simulate.ts';
import type { BoardDefinition, GameEvent, ItemKind, Slot } from '../types.ts';
import {
  BOARD_AI_PERSONALITIES,
  boardAiStyleParams,
  type BoardAiPersonality,
} from './personality.ts';
import { answerBoardPrompt, createBoardAiSeat, type BoardAiSeat } from './seat.ts';

const SLOTS: readonly Slot[] = [1, 2, 3, 4];

/** Kennzahlen eines Stils (bzw. der Kontrolle ohne Stil) je Partie und Platz. */
export interface PersonalityMetrics {
  readonly label: BoardAiPersonality | 'ohne';
  /** Plätze × Partien, über die gemittelt wurde. */
  readonly samples: number;
  /** Siegquote (Platz 1, Gleichstand anteilig); fair bei vier Plätzen = 0,25. */
  readonly winRate: number;
  /** Klau und Falle je Partie (Sabotage-Quote). */
  readonly sabotage: number;
  /** Eingesetzte Items je Partie. */
  readonly itemsUsed: number;
  /** Doppelwürfel je Partie. */
  readonly doubleDice: number;
  /** Items im Beutel am Partieende (aufgehoben). */
  readonly itemsHeld: number;
  /** In fremde Fallen gelaufen je Partie. */
  readonly trapsHit: number;
  /** Trophäen am Ende. */
  readonly trophies: number;
  /** Münzen am Ende. */
  readonly coins: number;
}

export interface PersonalityExperimentOptions {
  readonly seeds: readonly number[];
  /** Stärke `s` aller Plätze (0 … 1). */
  readonly strength: number;
  readonly rounds?: number;
  readonly board?: BoardDefinition;
}

/** Stil eines Platzes in Partie `seed` (Rotation über die Plätze). */
export function experimentPersonality(seed: number, slot: Slot): BoardAiPersonality {
  const index = (slot - 1 + seed) % BOARD_AI_PERSONALITIES.length;
  return BOARD_AI_PERSONALITIES[index] ?? BOARD_AI_PERSONALITIES[0];
}

interface Tally {
  samples: number;
  wins: number;
  sabotage: number;
  itemsUsed: number;
  doubleDice: number;
  itemsHeld: number;
  trapsHit: number;
  trophies: number;
  coins: number;
}

function emptyTally(): Tally {
  return {
    samples: 0,
    wins: 0,
    sabotage: 0,
    itemsUsed: 0,
    doubleDice: 0,
    itemsHeld: 0,
    trapsHit: 0,
    trophies: 0,
    coins: 0,
  };
}

const SABOTAGE: readonly ItemKind[] = ['coin-steal', 'trap'];

/** Eine Partie mit vier Live-KI-Plätzen; `styled` = Stile nach {@link experimentPersonality}. */
function playGame(
  seed: number,
  options: PersonalityExperimentOptions,
  styled: boolean,
  tallyOf: (slot: Slot) => Tally,
): void {
  const board = options.board ?? DEFAULT_BOARD;
  const seats = new Map<Slot, BoardAiSeat>(
    SLOTS.map((slot) => [slot, createBoardAiSeat(seed, slot)]),
  );
  const params = new Map(
    SLOTS.map((slot) => [
      slot,
      boardAiStyleParams(options.strength, styled ? experimentPersonality(seed, slot) : undefined),
    ]),
  );
  const onEvent = (event: GameEvent): void => {
    if (event.type === 'item-used') {
      const tally = tallyOf(event.slot);
      tally.itemsUsed += 1;
      if (SABOTAGE.includes(event.item)) tally.sabotage += 1;
      if (event.item === 'double-dice') tally.doubleDice += 1;
    } else if (event.type === 'trap-triggered') {
      tallyOf(event.slot).trapsHit += 1;
    }
  };
  const result = simulateGame({
    board,
    rules: DEFAULT_RULES,
    rounds: options.rounds ?? 10,
    seed,
    players: 4,
    minigames: ROTATION_SPECS,
    onEvent,
    seatAnswer: (prompt, state) => {
      const seat = seats.get(prompt.slot);
      const seatParams = params.get(prompt.slot);
      if (!seat || !seatParams) return undefined;
      const remainingMs = prompt.deadline === null ? null : prompt.deadline - state.now;
      return answerBoardPrompt(seat, { prompt, state, board, params: seatParams, remainingMs });
    },
  });
  const winners = result.ranking.filter((entry) => entry.place === 1);
  for (const player of result.finalPlayers) {
    const tally = tallyOf(player.slot);
    tally.samples += 1;
    tally.itemsHeld += player.items.length;
    tally.trophies += player.trophies;
    tally.coins += player.coins;
    if (winners.some((entry) => entry.slot === player.slot)) tally.wins += 1 / winners.length;
  }
}

function toMetrics(label: PersonalityMetrics['label'], tally: Tally): PersonalityMetrics {
  const n = Math.max(1, tally.samples);
  return {
    label,
    samples: tally.samples,
    winRate: tally.wins / n,
    sabotage: tally.sabotage / n,
    itemsUsed: tally.itemsUsed / n,
    doubleDice: tally.doubleDice / n,
    itemsHeld: tally.itemsHeld / n,
    trapsHit: tally.trapsHit / n,
    trophies: tally.trophies / n,
    coins: tally.coins / n,
  };
}

/** Kennzahlen je Stil plus Kontrolle (`ohne`: dieselben Seeds ohne Stil). */
export function runPersonalityExperiment(
  options: PersonalityExperimentOptions,
): readonly PersonalityMetrics[] {
  const tallies = new Map<BoardAiPersonality, Tally>(
    BOARD_AI_PERSONALITIES.map((style) => [style, emptyTally()]),
  );
  const control = emptyTally();
  for (const seed of options.seeds) {
    playGame(seed, options, true, (slot) => {
      const tally = tallies.get(experimentPersonality(seed, slot));
      if (!tally) throw new Error('Stil fehlt');
      return tally;
    });
    playGame(seed, options, false, () => control);
  }
  return [
    ...BOARD_AI_PERSONALITIES.map((style) => toMetrics(style, tallies.get(style) ?? emptyTally())),
    toMetrics('ohne', control),
  ];
}

/** Tabelle für `docs/experiments.md`. */
export function personalityTable(rows: readonly PersonalityMetrics[]): string {
  const f = (value: number, digits = 2): string => value.toFixed(digits);
  const head =
    '| Stil | Siegquote | Klau+Falle | Items | Doppelwürfel | aufgehoben | Fallen getroffen | Trophäen | Münzen |\n' +
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|';
  const body = rows.map(
    (row) =>
      `| ${row.label} | ${f(row.winRate * 100, 1)} % | ${f(row.sabotage)} | ${f(row.itemsUsed)} | ${f(row.doubleDice)} | ${f(row.itemsHeld)} | ${f(row.trapsHit)} | ${f(row.trophies)} | ${f(row.coins, 1)} |`,
  );
  return [head, ...body].join('\n');
}
