/**
 * Balance-Experimente (CHAOS-24). Der Smoke-Test läuft immer (wenige Seeds); die vollen
 * Tabellen für `docs/experiments.md` nur mit Umgebungsvariable:
 *
 * ```sh
 * EXPERIMENTS=1 pnpm exec vitest run packages/game-core/src/rules/experiments.test.ts
 * ```
 */
import { describe, expect, it } from 'vitest';
import { WACKELWALD_M2 } from '../board/wackelwaldM2.ts';
import type { BoardDefinition } from '../types.ts';
import { DEFAULT_RULES } from './defaults.ts';
import {
  CHOICE_BOARD,
  CHOICE_RULES,
  DEFAULT_SETUP,
  economyExperiment,
  economyMetrics,
  itemExperiment,
  itemMetrics,
  paceExperiment,
  paceMetrics,
  quantile,
  reactionExperiment,
  robustnessExperiment,
  roundsExperiment,
  runAllExperiments,
  runVariant,
  seedRange,
  START_BOARD,
  START_RULES,
  toMarkdown,
  variant,
  withSpaceKinds,
  type ExperimentSetup,
} from './experiments.ts';

/** Laufzeit-Globals ohne Node-/DOM-Typen (game-core kennt `process` und `console` nicht). */
const runtime = globalThis as {
  process?: { env?: Record<string, string | undefined> };
  console?: { log: (...values: unknown[]) => void };
};

function env(name: string): string | undefined {
  return runtime.process?.env?.[name];
}

const kinds = (board: BoardDefinition): string[] => board.spaces.map((s) => `${s.id}:${s.kind}`);

describe('Experimente: Grundlagen', () => {
  it('die gewählten Werte sind genau die Standardregeln und das Standardbrett', () => {
    // M3 verlängert nur Anleitung und Ergebnisanzeige der Minispiele (Lesezeit, kein Balance-Wert);
    // EXP-019 (CHAOS-51) ergänzt den Trostpreis nach dem Minispiel (gibt es in M2 nicht);
    // CHAOS-66 die kurze Anleitung bei Wiederholung; CHAOS-125 die Rückenwind-Ansage;
    // CHAOS-214 das Warten auf „Bereit“ in der Anleitung.
    expect({
      ...CHOICE_RULES,
      items: { ...CHOICE_RULES.items, minigameLastItems: 1 },
      pacing: {
        ...CHOICE_RULES.pacing,
        minigameIntroMs: 7000,
        minigameRepeatIntroMs: 3000,
        minigameReadyTimeoutMs: 60_000,
        minigameReadyMinMs: 3000,
        minigameResultsMs: 6000,
        tailwindMs: 3500,
      },
      // CHAOS-65 (EXP-022): Aufholhilfe, kein Teil der Experimente EXP-001 … EXP-004.
      trophy: { ...CHOICE_RULES.trophy, placement: 'nearest-to-last' },
    }).toEqual(DEFAULT_RULES);
    expect(kinds(CHOICE_BOARD)).toEqual(kinds(WACKELWALD_M2));
  });

  it('Startbrett hat die Verteilung vor CHAOS-24 (4 Trophäen, 4 Item-Felder)', () => {
    const count = (kind: string) => START_BOARD.spaces.filter((s) => s.kind === kind).length;
    expect(count('trophy')).toBe(4);
    expect(count('item')).toBe(4);
    expect(START_RULES.trophy).toEqual({ price: 20, mode: 'wandering', activeCount: 1 });
  });

  it('withSpaceKinds ändert nur Feldtypen und meldet unbekannte Felder', () => {
    const board = withSpaceKinds(WACKELWALD_M2, { s02: 'item' }, 'x');
    expect(board.id).toBe('x');
    expect(board.spaces.find((s) => s.id === 's02')?.kind).toBe('item');
    expect(board.spaces.map((s) => s.next)).toEqual(WACKELWALD_M2.spaces.map((s) => s.next));
    expect(() => withSpaceKinds(WACKELWALD_M2, { zz: 'item' })).toThrow(RangeError);
  });

  it('quantile und seedRange', () => {
    expect(quantile([], 0.5)).toBe(0);
    expect(quantile([3, 1, 2], 0.5)).toBe(2);
    expect(quantile([0, 10], 0.9)).toBeCloseTo(9);
    expect(seedRange(3, 5)).toEqual([5, 6, 7]);
    expect(DEFAULT_SETUP.seeds).toHaveLength(200);
  });

  it('Kennzahlen sind plausibel und deterministisch', () => {
    const v = variant('T', 'Test');
    const setup = { seeds: seedRange(3), rounds: 3 };
    const a = runVariant(v, 3, setup);
    expect(runVariant(v, 3, setup)).toEqual(a);
    const pace = paceMetrics(a, v.rules);
    expect(pace.boardMinutes).toBeGreaterThan(0);
    expect(pace.turnSecondsP90).toBeGreaterThanOrEqual(pace.turnSeconds * 0.5);
    expect(pace.waitSeconds).toBeCloseTo(2 * pace.turnSeconds, 6);
    const eco = economyMetrics(a);
    expect(eco.noTrophyShare).toBeGreaterThanOrEqual(0);
    expect(eco.noTrophyShare).toBeLessThanOrEqual(1);
    const items = itemMetrics(a);
    expect(items.lossShare).toBeGreaterThanOrEqual(0);
    expect(items.lossShare).toBeLessThanOrEqual(1);
  });
});

describe('Experimente: Smoke-Test mit wenigen Seeds', () => {
  const small: ExperimentSetup = { seeds: seedRange(2), players: [2, 4], rounds: 2 };

  it.each([
    ['Tempo', paceExperiment],
    ['Rundenzahl', roundsExperiment],
    ['Ökonomie', economyExperiment],
    ['Items', itemExperiment],
    ['Reaktion', reactionExperiment],
    ['Robustheit', robustnessExperiment],
  ] as const)('%s liefert eine vollständige Tabelle', (_, experiment) => {
    const table = experiment(small);
    expect(table.rows.length).toBeGreaterThan(0);
    for (const row of table.rows) expect(row).toHaveLength(table.headers.length);
    const md = toMarkdown(table);
    expect(md.split('\n')[2]?.startsWith('| ')).toBe(true);
    expect(md).not.toContain('NaN');
  });
});

describe.runIf(env('EXPERIMENTS') === '1')('Experimente: volle Tabellen (EXPERIMENTS=1)', () => {
  it('druckt alle Tabellen als Markdown', { timeout: 600_000 }, () => {
    const md = runAllExperiments();
    expect(md).not.toContain('NaN');
    runtime.console?.log(`\n${md}\n`);
  });
});
