/**
 * Schnellfeuer-Auslöser (CHAOS-90, EXP-041). Smoke-Test immer; volle Tabelle nur mit
 *
 * ```sh
 * EXPERIMENTS=rapidfire pnpm exec vitest run packages/game-core/src/rules/experimentsRapidFire.test.ts --silent=false
 * ```
 */
import { getMinigameInfo, RAPID_FIRE_ID } from '@chaos-party/minigames/catalog';
import { describe, expect, it } from 'vitest';
import { seedRange, toMarkdown } from './experiments.ts';
import {
  RAPID_FIRE_SPEC,
  RAPID_FIRE_VARIANTS,
  rapidFireExperiment,
  rapidFireMetrics,
  runRapidFireExperiment,
  simulateRapidFire,
} from './experimentsRapidFire.ts';

const runtime = globalThis as {
  process?: { env?: Record<string, string | undefined> };
  console?: { log: (...values: unknown[]) => void };
};

describe('Schnellfeuer-Auslöser: Smoke-Test', () => {
  it('RAPID_FIRE_SPEC entspricht dem Katalog (ID, Spielzeit, Wertung)', () => {
    const info = getMinigameInfo(RAPID_FIRE_ID);
    expect(info && { id: info.id, playMs: info.durationMs, scoring: info.scoring }).toEqual(
      RAPID_FIRE_SPEC,
    );
  });

  it('liefert eine vollständige Tabelle', () => {
    const table = rapidFireExperiment({ seeds: seedRange(2), players: [2, 4], rounds: 4 });
    expect(table.rows).toHaveLength(RAPID_FIRE_VARIANTS.length * 2);
    for (const row of table.rows) expect(row).toHaveLength(table.headers.length);
    expect(toMarkdown(table)).not.toContain('NaN');
  });

  it('Halbzeit und Finale bringen genau ein Schnellfeuer, ohne Regel keins', () => {
    const none = RAPID_FIRE_VARIANTS.find((v) => v.id === 'R0');
    const half = RAPID_FIRE_VARIANTS.find((v) => v.id === 'Rb');
    const finale = RAPID_FIRE_VARIANTS.find((v) => v.id === 'Rc');
    if (!none || !half || !finale) throw new Error('Varianten fehlen');
    const results = (variant: typeof none) =>
      seedRange(5).map((seed) => simulateRapidFire(variant, seed, 3, 10));
    expect(rapidFireMetrics(results(none)).perGame).toBe(0);
    for (const result of results(half)) {
      expect(result.minigameLog.filter((m) => m.id === 'schnellfeuer').map((m) => m.round)).toEqual(
        [5],
      );
    }
    for (const result of results(finale)) {
      expect(result.minigameLog.filter((m) => m.id === 'schnellfeuer').map((m) => m.round)).toEqual(
        [10],
      );
    }
  });
});

describe.runIf(runtime.process?.env?.EXPERIMENTS === 'rapidfire')(
  'Schnellfeuer-Auslöser: volle Tabelle (EXPERIMENTS=rapidfire)',
  () => {
    it('druckt die Tabelle als Markdown', { timeout: 3_600_000 }, () => {
      runtime.console?.log(runRapidFireExperiment());
    });
  },
);
