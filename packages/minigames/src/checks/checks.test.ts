/**
 * Gemeinsame Prüfungen der Rotation (CHAOS-84, README §5.2/§5.5):
 *
 * - **Vielfalt:** Jedes Spiel unterscheidet sich von jedem anderen in ≥ 3 von 7 Merkmalen
 *   (Steckbriefe aus `../steckbriefe.ts`, Baukasten ADR-021).
 * - **Bot-Fairness:** feste Tische und Schwellen aus `fairness.ts`, CI-Stichprobe je Spiel.
 *
 * Ein neues Spiel in `ROTATION` ohne Steckbrief oder Fairness-Harness lässt diesen Test
 * scheitern (Definition of Done, README §5.3).
 *
 * Prüfbericht mit vielen Seeds (schreibt `docs/minigames/pruefbericht.md`, dauert Minuten):
 *
 * ```sh
 * PRUEFBERICHT=1 pnpm exec vitest run packages/minigames/src/checks --silent=false
 * ```
 *
 * `FAIRNESS_SEEDS` (Standard 200) setzt die Seeds je Tisch, `PRUEFBERICHT_NUR=<id>` misst ein
 * Spiel und gibt die Zeile nur aus.
 */
import { writeFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { getMinigameInfo, ROTATION } from '../catalog.ts';
import {
  checkFairness,
  fairnessTable,
  FAIRNESS_THRESHOLDS,
  intruderTable,
  LeadCounter,
  measureFairness,
  relativeGap,
  wilsonInterval,
  winShare,
  type FairnessReport,
} from './fairness.ts';
import { FAIRNESS_HARNESSES } from './harnesses.ts';
import { dauerDruecker, kitHarness } from './kitHarness.ts';
import { HALLO_BOT_ADAPTER } from '../hallo-baukasten/bot.ts';
import { HALLO_BAUKASTEN_INFO } from '../hallo-baukasten/info.ts';
import type { Steckbrief } from '@chaos-party/minigame-kit';
import { getSteckbrief } from '../steckbriefe.ts';
import { checkVariety, nearestGame, varietyTable, VARIETY_EXCEPTIONS } from './variety.ts';

/** Steckbriefe der Rotation aus `steckbriefe.ts` (Baukasten, ADR-021). */
function rotationProfiles(): Map<string, Steckbrief> {
  const profiles = new Map<string, Steckbrief>();
  for (const id of ROTATION) {
    const steckbrief = getSteckbrief(id);
    if (steckbrief) profiles.set(id, steckbrief);
  }
  return profiles;
}

describe('Vielfalt der Rotation (README §5.5)', () => {
  it('jedes Spiel der Rotation hat einen Steckbrief', () => {
    expect(ROTATION.filter((id) => !getSteckbrief(id))).toEqual([]);
  });

  it('jedes Spiel unterscheidet sich von jedem anderen in mindestens 3 Merkmalen', () => {
    const violations = checkVariety(rotationProfiles());
    const text = violations.map(
      ({ id, nearest }) =>
        `${id} ≈ ${nearest.id}: nur ${nearest.distance} Unterschiede, gleich: ${nearest.shared.join(', ')}`,
    );
    expect(text).toEqual([]);
  });

  it('Ausnahmen nennen Spiele der Rotation und haben eine Begründung', () => {
    for (const exception of VARIETY_EXCEPTIONS) {
      expect(ROTATION).toContain(exception.id);
      expect(ROTATION).toContain(exception.with);
      expect(exception.reason.length).toBeGreaterThan(20);
    }
  });

  it('nennt das ähnlichste Spiel und erkennt jedes zu ähnliche Paar', () => {
    const base: Steckbrief = {
      kernverb: 'fangen',
      ziel: 'meiste',
      arena: 'rund',
      kamera: 'schraeg',
      bedienung: 'SA',
      spielform: 'FFA',
      tempo: 'hektisch',
    };
    const profiles = new Map<string, Steckbrief>([
      ['alt', base],
      ['nah', { ...base, ziel: 'ueberleben', tempo: 'ruhig', ort: 'teich' }],
      ['fern', { ...base, kernverb: 'zielen', ziel: 'genau', arena: 'buehne', kamera: 'fest' }],
    ]);
    // Der Ort zählt nicht zum Abstand.
    expect(nearestGame('nah', profiles)).toEqual({
      id: 'alt',
      distance: 2,
      shared: ['kernverb', 'arena', 'kamera', 'bedienung', 'spielform'],
    });
    expect(checkVariety(profiles).map((v) => [v.id, v.nearest.id])).toEqual([
      ['alt', 'nah'],
      ['nah', 'alt'],
    ]);
    expect(checkVariety(profiles, [{ id: 'nah', with: 'alt', reason: 'x' }])).toEqual([]);
    // Ein drittes, ebenso nahes Spiel bleibt trotz Ausnahme für das erste Paar sichtbar.
    profiles.set('zwilling', { ...base, kernverb: 'ausweichen', tempo: 'ruhig' });
    expect(
      checkVariety(profiles, [{ id: 'nah', with: 'alt', reason: 'x' }]).some(
        (v) => v.id === 'zwilling',
      ),
    ).toBe(true);
    expect(varietyTable(profiles)).toContain('| nah |');
  });
});

describe('Bot-Fairness: Bausteine', () => {
  it('Siegquote, Abstand und Führungswechsel rechnen Gleichstand richtig', () => {
    expect(winShare({ scores: [5, 5, 1], leadChanges: 0 }, 0, 'higher')).toBe(0.5);
    expect(winShare({ scores: [5, 5, 1], leadChanges: 0 }, 2, 'lower')).toBe(1);
    expect(relativeGap([10, 6, 1], 'higher')).toBeCloseTo(0.4);
    expect(relativeGap([3, 3], 'higher')).toBe(0);
    expect(relativeGap([0, 0], 'higher')).toBe(0);
    const lead = new LeadCounter();
    for (const scores of [
      [0, 0],
      [1, 0],
      [1, 1],
      [1, 2],
      [3, 2],
    ]) {
      lead.update(scores);
    }
    expect(lead.changes).toBe(2);
  });

  it('Baukasten-Anbindung (kitHarness) misst ein Spiel mit Adapter und Dauerdrücker', async () => {
    const harness = kitHarness({
      info: HALLO_BAUKASTEN_INFO,
      adapter: HALLO_BOT_ADAPTER,
      intruders: [dauerDruecker()],
      ciSeeds: 4,
    });
    expect(harness.intruders.map((intruder) => intruder.id)).toEqual(['dauer']);
    const match = await harness.play(
      [{ skill: 'profi' }, { skill: 'normal', strategy: 'dauer' }],
      5,
    );
    expect(match.scores).toHaveLength(2);
    expect(await harness.play([{ skill: 'profi' }, { skill: 'neuling' }], 5)).toEqual(
      await harness.play([{ skill: 'profi' }, { skill: 'neuling' }], 5),
    );
    const report = await measureFairness(harness);
    expect(report.intruders).toHaveLength(1);
  });

  it('Wilson-Bereich wird mit mehr Seeds enger', () => {
    const small = wilsonInterval(0.1, 12);
    const large = wilsonInterval(0.1, 200);
    expect(small.low).toBeLessThan(large.low);
    expect(small.high).toBeGreaterThan(large.high);
    expect(large.low).toBeGreaterThan(0.05);
    expect(wilsonInterval(0, 0)).toEqual({ low: 0, high: 1 });
  });

  it('meldet eindeutige Verstöße und achtet begründete Ausnahmen', () => {
    const report: FairnessReport = {
      id: 'test',
      seeds: 200,
      tieForFirst: 0.4,
      gap12: 0.6,
      leadChanges: 0.2,
      noviceWins: 0,
      proWins: 0.9,
      intruders: [{ id: 'dauer', label: 'Dauerdrücken', factor: 2.4 }],
      ms: 0,
    };
    expect(checkFairness(report).map((v) => v.metric)).toEqual([
      'maxTieForFirst',
      'maxGap12',
      'minLeadChanges',
      'minNoviceWins',
      'maxIntruderFactor',
    ]);
    expect(
      checkFairness(report, [{ metric: 'maxGap12', value: 0.6, reason: 'Test' }]).map(
        (v) => v.metric,
      ),
    ).not.toContain('maxGap12');
    // Gleiche Quote, kleine Stichprobe: noch kein eindeutiger Verstoß.
    expect(checkFairness({ ...report, seeds: 3 }).map((v) => v.metric)).not.toContain(
      'maxTieForFirst',
    );
    expect(fairnessTable([report])).toContain('2,40 (Dauerdrücken)');
    expect(intruderTable([report])).toContain('| test | Dauerdrücken | 2,40 |');
  });

  it('Schwellen sind in sich stimmig', () => {
    const t = FAIRNESS_THRESHOLDS;
    expect(t.minNoviceWins).toBeLessThan(t.maxNoviceWins);
    expect(t.maxNoviceWins).toBeLessThanOrEqual(t.minProWins);
    expect(t.maxIntruderFactor).toBeGreaterThan(1);
  });
});

describe('Bot-Fairness der Rotation (README §5.2)', () => {
  it('jedes Spiel der Rotation hat einen Fairness-Harness und umgekehrt', () => {
    expect(Object.keys(FAIRNESS_HARNESSES).sort()).toEqual([...ROTATION].sort());
    for (const [id, harness] of Object.entries(FAIRNESS_HARNESSES)) {
      expect(harness.id).toBe(id);
      expect(harness.scoring).toBe(getMinigameInfo(id)?.scoring);
      expect(harness.intruders.length).toBeGreaterThan(0);
      for (const exception of harness.exceptions ?? []) {
        expect(exception.reason.length).toBeGreaterThan(40);
      }
    }
  });

  it.each([...ROTATION])(
    '%s hält die Schwellen in der CI-Stichprobe ein',
    { timeout: 120_000 },
    async (id) => {
      const harness = FAIRNESS_HARNESSES[id];
      if (!harness) throw new Error(`Fairness-Harness fehlt für ${id}`);
      const report = await measureFairness(harness);
      const violations = checkFairness(report, harness.exceptions);
      expect(violations.map((v) => `${v.text}: ${v.value.toFixed(2)} (Grenze ${v.limit})`)).toEqual(
        [],
      );
      // Gleiche Seeds, gleiche Zahlen.
      const seats = [{ skill: 'normal' as const }, { skill: 'neuling' as const }];
      expect(await harness.play(seats, 3)).toEqual(await harness.play(seats, 3));
    },
  );
});

describe.runIf(process.env.PRUEFBERICHT === '1')('Prüfbericht (PRUEFBERICHT=1)', () => {
  it(
    'misst alle Spiele mit vielen Seeds und schreibt den Bericht',
    { timeout: 3_600_000 },
    async () => {
      const seeds = Number(process.env.FAIRNESS_SEEDS ?? 200);
      const only = process.env.PRUEFBERICHT_NUR;
      const reports: FairnessReport[] = [];
      for (const id of ROTATION) {
        if (only && id !== only) continue;
        const harness = FAIRNESS_HARNESSES[id];
        if (harness) reports.push(await measureFairness(harness, seeds));
      }
      const verdicts = reports.map((report) => {
        const harness = FAIRNESS_HARNESSES[report.id];
        const open = checkFairness(report, harness?.exceptions);
        const excused = (harness?.exceptions ?? []).map((e) => `Ausnahme ${e.metric}: ${e.reason}`);
        const status = open.length === 0 ? 'besteht' : open.map((v) => v.text).join('; ');
        return `- **${report.id}:** ${status}${excused.length ? `\n  - ${excused.join('\n  - ')}` : ''}`;
      });
      const markdown = [
        '# Prüfbericht Minispiele',
        '',
        `Erzeugt von \`packages/minigames/src/checks/checks.test.ts\` (CHAOS-84) mit ${seeds} Seeds je Tisch. Regeln, Tische und Begründung der Schwellen: [\`pruefungen.md\`](pruefungen.md). Neu erzeugen:`,
        '',
        '```sh',
        'PRUEFBERICHT=1 pnpm exec vitest run packages/minigames/src/checks --silent=false',
        '```',
        '',
        '## Bot-Fairness',
        '',
        fairnessTable(reports),
        '',
        '## Ergebnis je Spiel',
        '',
        ...verdicts,
        '',
        '## Eindringling-Test je Strategie',
        '',
        '3 Spieler, Strategie gegen zwei normale Bots, Platz reihum. Siegfaktor = Siegquote × 3 (1,00 = fair).',
        '',
        intruderTable(reports),
        '',
        '## Vielfalts-Steckbriefe',
        '',
        varietyTable(rotationProfiles()),
        '',
      ].join('\n');
      if (only) console.log(markdown);
      else
        await writeFile(
          new URL('../../../../docs/minigames/pruefbericht.md', import.meta.url),
          markdown,
        );
      expect(reports.length).toBeGreaterThan(0);
    },
  );
});
