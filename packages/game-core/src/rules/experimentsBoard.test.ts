/**
 * Brett-Experiment EXP-037 (CHAOS-196). Der Smoke-Test läuft immer (wenige Seeds); die vollen
 * Tabellen für `docs/experiments.md` nur mit Umgebungsvariable:
 *
 * ```sh
 * EXPERIMENTS=brett pnpm exec vitest run packages/game-core/src/rules/experimentsBoard.test.ts --silent=false
 * ```
 */
import { describe, expect, it } from 'vitest';
import { WACKELWALD } from '../board/wackelwald.ts';
import { WACKELWALD_M2 } from '../board/wackelwaldM2.ts';
import { seedRange, toMarkdown } from './experiments.ts';
import {
  boardSizeExperiment,
  lapLengths,
  routeFairness,
  routeSplit,
  routeUsageExperiment,
  runBoardExperiments,
} from './experimentsBoard.ts';
import { simulateGame } from './simulate.ts';

const runtime = globalThis as {
  process?: { env?: Record<string, string | undefined> };
  console?: { log: (...values: unknown[]) => void };
};

describe('EXP-037: Grundlagen', () => {
  it('Rundenlängen: altes Brett 32–36, neues 37–47 Felder', () => {
    const old = lapLengths(WACKELWALD_M2);
    expect([old[0], old[old.length - 1], old.length]).toEqual([32, 36, 4]);
    const big = lapLengths(WACKELWALD);
    expect([big[0], big[big.length - 1]]).toEqual([37, 47]);
    // Vier Gabeln, davon zwei hintereinander (D, dann B nur oben herum): 2 · 3 · 2 Wege.
    expect(big).toHaveLength(12);
  });

  it('routeSplit verteilt kurz/lang abwechselnd und tauscht die Rollen', () => {
    expect(routeSplit(2, false)).toEqual({ 1: 'short', 2: 'long' });
    expect(routeSplit(4, true)).toEqual({ 1: 'long', 2: 'short', 3: 'long', 4: 'short' });
  });

  it('feste Wegwahl: kurz nimmt an jeder Gabel den kürzeren Weg, lang den längeren', () => {
    const result = simulateGame({
      board: WACKELWALD,
      rounds: 12,
      seed: 3,
      players: 2,
      policy: { routes: { 1: 'short', 2: 'short' } },
    });
    const chosen = Object.keys(result.pathsChosen).sort();
    // Nur kurze Zweige: Sumpf (s14), Lichtung (s44), Wackelbrücke (s35).
    expect(chosen.every((id) => ['s14', 's35', 's44'].includes(id))).toBe(true);
    const long = simulateGame({
      board: WACKELWALD,
      rounds: 12,
      seed: 3,
      players: 2,
      policy: { routes: { 1: 'long', 2: 'long' } },
    });
    const longChosen = Object.keys(long.pathsChosen).sort();
    expect(longChosen.every((id) => ['s08', 's21', 's26', 's30'].includes(id))).toBe(true);
  });

  it('ohne feste Wegwahl zieht die Simulation gleich viele Zufallszahlen (Seeds bleiben gleich)', () => {
    const a = simulateGame({ board: WACKELWALD_M2, rounds: 6, seed: 9, players: 3 });
    const b = simulateGame({
      board: WACKELWALD_M2,
      rounds: 6,
      seed: 9,
      players: 3,
      policy: { routes: {} },
    });
    expect(b).toEqual(a);
  });
});

describe('EXP-037: Smoke-Test mit wenigen Seeds', () => {
  const setup = { seeds: seedRange(4), players: [2, 4] as const, rounds: 5 };

  it('Tabellen entstehen und Trophäen fallen auf dem neuen Brett', () => {
    const size = boardSizeExperiment({ ...setup, players: [...setup.players] }, [5]);
    expect(size.rows).toHaveLength(4);
    const fair = routeFairness(WACKELWALD, 2, { seeds: seedRange(4), rounds: 5 });
    expect(fair.shortWinShare).toBeGreaterThanOrEqual(0);
    expect(fair.shortWinShare).toBeLessThanOrEqual(1);
    const usage = routeUsageExperiment({ ...setup, players: [...setup.players] });
    // Vier Gabeln plus Zeile der Trophäenfelder.
    expect(usage.rows).toHaveLength(5);
    expect(toMarkdown(usage)).toContain('Lichtung');
  });
});

describe.runIf(runtime.process?.env?.EXPERIMENTS === 'brett')(
  'EXP-037: volle Tabellen (EXPERIMENTS=brett)',
  () => {
    it('druckt die Tabellen', () => {
      runtime.console?.log(runBoardExperiments());
    }, 3_600_000);
  },
);
