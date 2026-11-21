/**
 * EXP-007 (CHAOS-29/CHAOS-32): Hybrid-Prototypen. Der Smoke-Test läuft immer (wenige Seeds);
 * die vollen Tabellen für `docs/experiments.md` nur mit Umgebungsvariable:
 *
 * ```sh
 * EXPERIMENTS=1 pnpm exec vitest run packages/minigames/src/prototypes/hybrid
 * ```
 */
import { MINIGAME_TEXT_LIMITS } from '@chaos-party/minigame-sdk';
import { describe, expect, it } from 'vitest';
import { InputCounter, LeadTracker, seedRange, toMarkdown, winners, winShare } from './common.ts';
import {
  clarityTable,
  flowTable,
  invasionTable,
  runAllExperiments,
  strategyTable,
  type ExperimentSetup,
} from './experiment.ts';
import { WACKELTURM_PARAMS } from '../../wackelturm/logic.ts';
import { GEYSIR_CONCEPT, GEYSIR_PARAMS, multiplier, playGeysir } from './geysir.ts';
import {
  KIPPGEFUEHL_SEEDS,
  kippgefuehlDetailTable,
  kippgefuehlFairnessTable,
  oddSeatStats,
} from './kippgefuehl.ts';
import {
  EXP007_BOT_MODEL,
  KIPPGEFUEHL_BOT_MODEL,
  playWackelturm,
  WACKELTURM_CONCEPT,
} from './wackelturm-sim.ts';

const runtime = globalThis as {
  process?: { env?: Record<string, string | undefined> };
  console?: { log: (...values: unknown[]) => void };
};

const bots = [
  { strategy: 'vorsichtig', skill: 0.7 },
  { strategy: 'gierig', skill: 0.7 },
  { strategy: 'zufaellig', skill: 0.5 },
  { strategy: 'raufbold', skill: 0.9 },
] as const;

describe('Hybrid-Prototypen: Grundlagen', () => {
  it('winners, winShare, LeadTracker und InputCounter', () => {
    expect(winners([3, 5, 5])).toEqual([1, 2]);
    const record = {
      scores: [1, 2],
      seconds: 1,
      dramaticMoments: 0,
      inputsPerSecond: 0,
      bShare: 0,
      leadChanges: 0,
    };
    expect(winShare([record, { ...record, scores: [2, 2] }], 1)).toBeCloseTo(0.75);
    const lead = new LeadTracker();
    lead.update([1, 0]);
    lead.update([1, 1]);
    lead.update([1, 2]);
    lead.update([3, 2]);
    expect(lead.changes).toBe(2);
    const counter = new InputCounter();
    counter.stick(0.1, 0);
    counter.stick(1, 0);
    counter.press('b');
    expect(counter.count).toBe(2);
    expect(counter.bPresses).toBe(1);
  });

  it('Geysir-Multiplikator steigt alle 3 s bis ×3', () => {
    expect(multiplier(0, GEYSIR_PARAMS)).toBe(1);
    expect(multiplier(3.1, GEYSIR_PARAMS)).toBe(2);
    expect(multiplier(60, GEYSIR_PARAMS)).toBe(3);
  });

  it.each([2, 3, 4])('beide Konzepte spielen deterministisch mit %i Bots', (count) => {
    const table = bots.slice(0, count);
    const a = playWackelturm(table, 5);
    expect(playWackelturm(table, 5)).toEqual(a);
    expect(a.scores).toHaveLength(count);
    expect(a.seconds).toBeCloseTo(35, 1);
    expect(Math.max(...a.scores)).toBeGreaterThan(0);
    const b = playGeysir(table, 5);
    expect(playGeysir(table, 5)).toEqual(b);
    expect(Math.max(...b.scores)).toBeGreaterThan(0);
  });

  it('Anleitungen beider Konzepte passen in 3 Zeilen à 64 Zeichen', () => {
    for (const concept of [WACKELTURM_CONCEPT, GEYSIR_CONCEPT]) {
      expect(concept.instructions.length).toBeLessThanOrEqual(MINIGAME_TEXT_LIMITS.instructions);
      for (const line of concept.instructions) {
        expect(line.length).toBeLessThanOrEqual(MINIGAME_TEXT_LIMITS.instruction);
      }
    }
  });
});

describe('Hybrid-Prototypen: Smoke-Test mit wenigen Seeds', () => {
  const small: ExperimentSetup = { seeds: seedRange(3), players: [2, 4] };

  it.each([
    ['Verlauf', flowTable],
    ['Strategien', strategyTable],
    ['Eindringling', invasionTable],
  ] as const)('%s liefert eine vollständige Tabelle', (_, experiment) => {
    const table = experiment(small);
    expect(table.rows.length).toBeGreaterThan(0);
    for (const row of table.rows) expect(row).toHaveLength(table.headers.length);
    const md = toMarkdown(table);
    expect(md).not.toContain('NaN');
  });

  it('Bedienungstabelle nennt beide Konzepte', () => {
    expect(clarityTable().rows).toHaveLength(2);
  });
});

describe('EXP-039: Kippgefühl der Wackelturm-Bots (CHAOS-215)', () => {
  it('EXP-007-Konzept spielt weiter mit dem alten Modell (Tabellen bleiben reproduzierbar)', () => {
    const table = bots.slice(0, 4);
    expect(WACKELTURM_CONCEPT.play(table, 7, WACKELTURM_PARAMS)).toEqual(
      playWackelturm(table, 7, undefined, undefined, EXP007_BOT_MODEL),
    );
    expect(playWackelturm(table, 7)).toEqual(
      playWackelturm(table, 7, undefined, undefined, KIPPGEFUEHL_BOT_MODEL),
    );
  });

  it('Geschick zählt: Profi gewinnt öfter als Neuling (40 Seeds)', () => {
    const seeds = seedRange(40);
    const novice = oddSeatStats(KIPPGEFUEHL_BOT_MODEL, 'neuling', seeds);
    const pro = oddSeatStats(KIPPGEFUEHL_BOT_MODEL, 'profi', seeds);
    expect(pro.wins).toBeGreaterThan(novice.wins);
    // Das alte Modell zeigt das Artefakt: Profi gewinnt seltener als Neuling.
    const oldNovice = oddSeatStats(EXP007_BOT_MODEL, 'neuling', seeds);
    const oldPro = oddSeatStats(EXP007_BOT_MODEL, 'profi', seeds);
    expect(oldPro.wins).toBeLessThan(oldNovice.wins);
  });

  it('Tabellen sind vollständig (3 Seeds)', async () => {
    const fair = await kippgefuehlFairnessTable(3);
    const detail = kippgefuehlDetailTable(seedRange(3));
    for (const table of [fair, detail]) {
      for (const row of table.rows) expect(row).toHaveLength(table.headers.length);
      expect(toMarkdown(table)).not.toContain('NaN');
    }
  });
});

describe.runIf(runtime.process?.env?.EXPERIMENTS === '1')(
  'EXP-039: volle Tabellen (EXPERIMENTS=1)',
  () => {
    it('druckt beide Tabellen als Markdown', { timeout: 900_000 }, async () => {
      const md = [
        toMarkdown(await kippgefuehlFairnessTable(KIPPGEFUEHL_SEEDS.length)),
        toMarkdown(kippgefuehlDetailTable(KIPPGEFUEHL_SEEDS)),
      ].join('\n\n');
      runtime.console?.log(`\n${md}\n`);
    });
  },
);

describe.runIf(runtime.process?.env?.EXPERIMENTS === '1')(
  'Hybrid-Prototypen: volle Tabellen (EXPERIMENTS=1)',
  () => {
    it('druckt alle Tabellen als Markdown', { timeout: 900_000 }, () => {
      const md = runAllExperiments();
      expect(md).not.toContain('NaN');
      runtime.console?.log(`\n${md}\n`);
    });
  },
);
