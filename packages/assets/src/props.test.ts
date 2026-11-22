/**
 * Requisiten-Katalog (CHAOS-88): deckt die Pilotwelle ab und passt zum Blender-Generator.
 */
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  MINIGAME_PROP_SETS,
  PROP_IDS,
  PROP_PLACES,
  PROP_RUNTIME,
  PROP_SET_IDS,
  PROP_SETS,
  minigameProps,
  placePropSet,
  propAssetId,
  propModelPath,
} from './props.ts';

const blenderDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'blender');

/** Pilotwelle aus `docs/minigames/katalog.md` (★, CHAOS-91): MG-001, -011, -023, -033, -045, -101, -111, -121. */
const PILOT = [
  'nussregen-netz',
  'rasensprenger-rodeo',
  'eiswuerfel-sumo',
  'toaster-timing',
  'schnapp-den-kaese',
  'bienenstock-honig',
  'drei-tueren',
  'matschmaler',
];

describe('Requisiten-Katalog', () => {
  it('jedes Pilot-Spiel hat Requisiten aus seinem Familien-Set', () => {
    for (const game of PILOT) {
      const sets = MINIGAME_PROP_SETS[game];
      expect(sets, game).toBeDefined();
      expect(
        sets?.some((set) => PROP_SETS[set].family !== null),
        game,
      ).toBe(true);
      expect(minigameProps(game).length, game).toBeGreaterThan(0);
    }
  });

  it('je Familie höchstens ein Set, jedes Requisit in genau einem Set', () => {
    const families = PROP_SET_IDS.map((set) => PROP_SETS[set].family).filter((f) => f !== null);
    expect(new Set(families).size).toBe(families.length);
    expect(new Set(PROP_IDS).size).toBe(PROP_IDS.length);
  });

  it('Laufzeit-Materialien nur an Requisiten aus dem Katalog', () => {
    for (const id of Object.keys(PROP_RUNTIME)) expect(PROP_IDS).toContain(id);
  });

  it('Katalog = Liste PROPS im Blender-Generator', async () => {
    const source = await readFile(join(blenderDir, 'requisiten.py'), 'utf8');
    const block = /^PROPS:[^\n]*\{([\s\S]*?)\n\}/m.exec(source)?.[1] ?? '';
    const generated = [...block.matchAll(/"([a-z-]+)":/g)].map((m) => m[1]);
    expect([...generated].sort()).toEqual([...PROP_IDS].sort());
  });

  it('je Ort der Arena-Vorlagen ein Kulissen-Set (CHAOS-222)', async () => {
    // PROP_PLACES spiegelt ORTE aus dem Baukasten (assets hängt nicht von minigame-kit ab).
    const steckbrief = await readFile(
      join(blenderDir, '..', '..', 'minigame-kit', 'src', 'steckbrief.ts'),
      'utf8',
    );
    const block = /export const ORTE = \[([\s\S]*?)\]/.exec(steckbrief)?.[1] ?? '';
    const orte = [...block.matchAll(/'([a-z]+)'/g)].map((m) => m[1]);
    expect(orte.length).toBeGreaterThan(0);
    expect([...PROP_PLACES]).toEqual(orte);
    for (const place of PROP_PLACES) {
      const set = PROP_SETS[placePropSet(place)];
      expect(set.family, place).toBeNull();
      expect(set.props.length, place).toBeGreaterThanOrEqual(3);
      expect(set.props.length, place).toBeLessThanOrEqual(5);
    }
    // Jedes Set „kulisse-…“ gehört zu einem Ort.
    const kulissen = PROP_SET_IDS.filter((set) => set.startsWith('kulisse-'));
    expect(kulissen.sort()).toEqual(PROP_PLACES.map(placePropSet).sort());
  });

  it('Kulissen-Liste im Blender-Generator = Kulissen-Sets', async () => {
    const source = await readFile(join(blenderDir, 'requisiten.py'), 'utf8');
    const block = /^KULISSEN:[^\n]*\{([\s\S]*?)\n\}/m.exec(source)?.[1] ?? '';
    const generated: Record<string, string[]> = {};
    for (const m of block.matchAll(/"([a-z]+)": \[([^\]]*)\]/g)) {
      generated[m[1] ?? ''] = [...(m[2] ?? '').matchAll(/"([a-z-]+)"/g)].map((p) => p[1] ?? '');
    }
    const expected = Object.fromEntries(
      PROP_PLACES.map((place) => [place, [...PROP_SETS[placePropSet(place)].props]]),
    );
    expect(generated).toEqual(expected);
  });

  it('ids und Pfade', () => {
    expect(propAssetId('toaster')).toBe('requisit-toaster');
    expect(propModelPath('toaster')).toBe('models/props/toaster.glb');
    expect(minigameProps('gibt-es-nicht')).toEqual([]);
    // Ein Requisit, das in zwei Sets eines Spiels stünde, zählt einmal.
    expect(new Set(minigameProps('nussregen-netz')).size).toBe(
      minigameProps('nussregen-netz').length,
    );
  });
});
