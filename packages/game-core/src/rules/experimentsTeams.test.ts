/**
 * EXP-038 (CHAOS-89): Münz-Regel für Teams und Koop. Smoke-Test immer; volle Tabelle nur mit
 *
 * ```sh
 * EXPERIMENTS=teams pnpm exec vitest run packages/game-core/src/rules/experimentsTeams.test.ts --silent=false
 * ```
 */
import { describe, expect, it } from 'vitest';
import { runVariant, seedRange, toMarkdown, type ExperimentSetup } from './experiments.ts';
import { TEAM_VARIANTS, teamMetrics, teamRewardsExperiment } from './experimentsTeams.ts';

const runtime = globalThis as {
  process?: { env?: Record<string, string | undefined> };
  console?: { log: (...values: unknown[]) => void };
};

describe('EXP-038 Münz-Regel Teams/Koop: Smoke-Test', () => {
  const small: ExperimentSetup = { seeds: seedRange(3), players: [2, 4], rounds: 8 };

  it('liefert eine vollständige Tabelle', () => {
    const table = teamRewardsExperiment(small);
    expect(table.rows).toHaveLength(small.players.length * TEAM_VARIANTS.length);
    for (const row of table.rows) expect(row).toHaveLength(table.headers.length);
    expect(toMarkdown(table)).not.toContain('NaN');
  });

  it('die Mischung spielt wirklich Team-Spiele, der Bezug nicht', () => {
    const [ffa, mixed] = TEAM_VARIANTS;
    if (!ffa || !mixed) throw new Error('Varianten fehlen');
    expect(teamMetrics(runVariant(ffa, 4, small)).teamShare).toBe(0);
    expect(teamMetrics(runVariant(mixed, 4, small)).teamShare).toBeGreaterThan(0);
  });
});

describe.runIf(runtime.process?.env?.EXPERIMENTS === 'teams')(
  'EXP-038: volle Tabelle (EXPERIMENTS=teams)',
  () => {
    it('druckt die Tabelle als Markdown', { timeout: 3_600_000 }, () => {
      runtime.console?.log(`\n${toMarkdown(teamRewardsExperiment())}\n`);
    });
  },
);
