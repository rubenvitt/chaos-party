/**
 * Auslöser für Schnellfeuer (CHAOS-90, `docs/experiments.md` EXP-039). Basis ist der M4-Stand
 * mit echter Minispiel-Rotation (`m4Defaults`). Verglichen werden (a) Brett-Ereignis
 * „Schnellfeuer!“ (beliebig oft bzw. höchstens einmal je Partie), (b) feste Runde zur Halbzeit
 * und (c) Finale in der letzten Runde.
 *
 * ```sh
 * EXPERIMENTS=rapidfire pnpm exec vitest run packages/game-core/src/rules/experimentsRapidFire.test.ts --silent=false
 * ```
 *
 * Gemessen: Häufigkeit je Partie, Partiedauer, Einfluss auf den Sieg (gewinnt, wer Schnellfeuer
 * gewinnt, auch die Partie?). Die Minispiel-Ergebnisse sind Zufall wie in allen
 * Brett-Experimenten; wie sich Schnellfeuer anfühlt, beurteilt nur der Playtest (CHAOS-92).
 */
import { WACKELWALD } from '../board/wackelwald.ts';
import type { MinigameSpec, RapidFireRules, RuleSet } from '../types.ts';
import { mean, num, pct, seedRange, seedText, toMarkdown, type Table } from './experiments.ts';
import { M4_RULES, ROTATION_SPECS } from './experimentsM4.ts';
import { simulateGame, type SimulationResult } from './simulate.ts';

/**
 * Schnellfeuer als Regel-Steckbrief (Spiegel von `catalogRapidFire()` in `apps/server`;
 * `experimentsRapidFire.test.ts` prüft Gleichheit mit dem Katalog).
 */
export const RAPID_FIRE_SPEC: MinigameSpec = {
  id: 'schnellfeuer',
  playMs: 42_500,
  scoring: 'higher',
};

export interface RapidFireVariant {
  readonly id: string;
  readonly label: string;
  readonly rule: RapidFireRules | null;
}

export const RAPID_FIRE_VARIANTS: readonly RapidFireVariant[] = [
  { id: 'R0', label: 'ohne Schnellfeuer', rule: null },
  { id: 'Ra', label: '(a) Ereignis, beliebig oft', rule: { trigger: 'event' } },
  {
    id: 'Ra1',
    label: '(a) Ereignis, höchstens 1× je Partie',
    rule: { trigger: 'event', maxPerGame: 1 },
  },
  {
    id: 'Ra3',
    label: '(a) Ereignis, 3 Lose, höchstens 1×',
    rule: { trigger: 'event', maxPerGame: 1, eventWeight: 3 },
  },
  {
    id: 'Ra5',
    label: '(a) Ereignis, 5 Lose, höchstens 1×',
    rule: { trigger: 'event', maxPerGame: 1, eventWeight: 5 },
  },
  {
    id: 'Ra5f',
    label: '(a) Ereignis, 5 Lose, 1×, sonst Finale',
    rule: { trigger: 'event', maxPerGame: 1, eventWeight: 5, finaleFallback: true },
  },
  { id: 'Rb', label: '(b) Halbzeit', rule: { trigger: 'halftime' } },
  { id: 'Rc', label: '(c) Finale (letzte Runde)', rule: { trigger: 'finale' } },
];

export interface RapidFireSetup {
  readonly seeds: readonly number[];
  readonly players: readonly (2 | 3 | 4)[];
  readonly rounds: number;
}

export const RAPID_FIRE_SETUP: RapidFireSetup = {
  seeds: seedRange(200),
  players: [2, 3, 4],
  rounds: 10,
};

function rulesOf(variant: RapidFireVariant): RuleSet {
  return variant.rule ? { ...M4_RULES, rapidFire: variant.rule } : M4_RULES;
}

export function simulateRapidFire(
  variant: RapidFireVariant,
  seed: number,
  players: 2 | 3 | 4,
  rounds: number,
): SimulationResult {
  return simulateGame({
    board: WACKELWALD,
    rules: rulesOf(variant),
    rounds,
    seed,
    players,
    minigames: ROTATION_SPECS,
    rapidFire: RAPID_FIRE_SPEC,
  });
}

export interface RapidFireMetrics {
  /** Schnellfeuer-Runden je Partie (Mittel). */
  readonly perGame: number;
  /** Anteil Partien mit mindestens einer bzw. mindestens zwei Schnellfeuer-Runden. */
  readonly atLeastOne: number;
  readonly atLeastTwo: number;
  /** Mittlere Runde des ersten Schnellfeuers (nur Partien mit einem). */
  readonly firstRound: number;
  readonly durationMin: number;
  /** Partien, in denen der alleinige Schnellfeuer-Sieger auch die Partie gewinnt (von allen mit einem). */
  readonly rapidWinnerWins: number;
  /** Vergleich: dasselbe für ein normales Minispiel derselben Partien. */
  readonly normalWinnerWins: number;
}

export function rapidFireMetrics(results: readonly SimulationResult[]): RapidFireMetrics {
  const counts: number[] = [];
  const firstRounds: number[] = [];
  let rapidSamples = 0;
  let rapidWins = 0;
  let normalSamples = 0;
  let normalWins = 0;
  for (const result of results) {
    const champion = result.ranking.filter((entry) => entry.place === 1);
    const winner = champion.length === 1 ? champion[0]?.slot : undefined;
    const rapid = result.minigameLog.filter((entry) => entry.id === RAPID_FIRE_SPEC.id);
    counts.push(rapid.length);
    if (rapid[0]) firstRounds.push(rapid[0].round);
    for (const entry of result.minigameLog) {
      if (entry.winners.length !== 1) continue;
      const won = entry.winners[0] === winner ? 1 : 0;
      if (entry.id === RAPID_FIRE_SPEC.id) {
        rapidSamples++;
        rapidWins += won;
      } else {
        normalSamples++;
        normalWins += won;
      }
    }
  }
  return {
    perGame: mean(counts),
    atLeastOne: mean(counts.map((n) => (n >= 1 ? 1 : 0))),
    atLeastTwo: mean(counts.map((n) => (n >= 2 ? 1 : 0))),
    firstRound: mean(firstRounds),
    durationMin: mean(results.map((r) => r.durationMs)) / 60_000,
    rapidWinnerWins: rapidSamples === 0 ? 0 : rapidWins / rapidSamples,
    normalWinnerWins: normalSamples === 0 ? 0 : normalWins / normalSamples,
  };
}

export function rapidFireExperiment(
  setup: RapidFireSetup = RAPID_FIRE_SETUP,
  variants: readonly RapidFireVariant[] = RAPID_FIRE_VARIANTS,
): Table {
  const rows: string[][] = [];
  for (const variant of variants) {
    for (const players of setup.players) {
      const results = setup.seeds.map((seed) =>
        simulateRapidFire(variant, seed, players, setup.rounds),
      );
      const m = rapidFireMetrics(results);
      rows.push([
        `${variant.id} ${variant.label}`,
        String(players),
        num(m.perGame, 2),
        pct(m.atLeastOne),
        pct(m.atLeastTwo),
        m.atLeastOne > 0 ? num(m.firstRound) : '–',
        num(m.durationMin),
        m.atLeastOne > 0 ? pct(m.rapidWinnerWins) : '–',
        pct(m.normalWinnerWins),
      ]);
    }
  }
  return {
    title: `EXP-039: Auslöser für Schnellfeuer (${String(setup.rounds)} Runden, ${seedText(setup)})`,
    headers: [
      'Variante',
      'Sp.',
      'Schnellfeuer je Partie',
      '≥ 1',
      '≥ 2',
      'erste Runde',
      'Dauer (min)',
      'Sieger SF → Partie',
      'Sieger normal → Partie',
    ],
    rows,
  };
}

export function runRapidFireExperiment(): string {
  return toMarkdown(rapidFireExperiment());
}
