/**
 * Bestand des Skizzen-Katalogs (`docs/minigames/katalog.md`, CHAOS-93).
 *
 * Der Katalog ist ein Vorrat, aus dem die Familien-Wellen schöpfen; im Trichter fallen
 * 25–40 % der Skizzen weg. Damit am Ende ~200 Minispiele stehen und die Bedienung am
 * geteilten iPad nicht zu kurz kommt, hält dieser Test die Untergrenzen fest. Gezählt
 * werden nur volle Minispiele: Mikro-Spiele der Schnellfeuer-Runde sind ein eigener
 * Vorrat (README §7). Verworfene Skizzen (✗) zählen nicht mit.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const CATALOG_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'docs',
  'minigames',
  'katalog.md',
);

/** Untergrenzen aus CHAOS-93 (Akzeptanzkriterien). */
const MIN_ACTIVE_FULL = 200;
const MIN_SHARE_WITHOUT_STICK = 0.3;
const MIN_SHARE_PHYSICS = 0.25;

const CATEGORIES = ['Ar', 'Ph', 'Hy'] as const;
const CONTROLS = ['A', 'AB', 'S', 'SA', 'SAB'] as const;

interface Sketch {
  number: number;
  name: string;
  category: string;
  controls: string;
  discarded: boolean;
  micro: boolean;
}

function parseCatalog(markdown: string): Sketch[] {
  const sketches: Sketch[] = [];
  let micro = false;
  for (const line of markdown.split('\n')) {
    if (line.startsWith('## ')) micro = line.includes('`Mikro`');
    const match = /^\| MG-(\d{3})([ ✗★]*)\| (.+?) \| (\w+) \| (\w+) \|/.exec(line);
    if (!match) continue;
    const [, number, marks, name, category, controls] = match;
    const discarded = marks?.includes('✗') ?? false;
    sketches.push({
      number: Number(number),
      name: (name ?? '').replace(/~~/g, ''),
      category: category ?? '',
      controls: controls ?? '',
      discarded,
      micro,
    });
  }
  return sketches;
}

const sketches = parseCatalog(readFileSync(CATALOG_PATH, 'utf8'));
const activeFull = sketches.filter((s) => !s.discarded && !s.micro);

describe('Skizzen-Katalog (docs/minigames/katalog.md)', () => {
  it('liest alle Einträge mit gültigen Kürzeln', () => {
    expect(sketches.length).toBeGreaterThanOrEqual(MIN_ACTIVE_FULL);
    for (const s of sketches) {
      expect(CATEGORIES, `MG-${s.number}`).toContain(s.category);
      expect(CONTROLS, `MG-${s.number}`).toContain(s.controls);
    }
  });

  it('vergibt jede Nummer nur einmal und Namen aktiver Skizzen nur einmal', () => {
    const duplicates = (values: readonly (string | number)[]) =>
      values.filter((value, index) => values.indexOf(value) !== index);
    expect(duplicates(sketches.map((s) => s.number))).toEqual([]);
    const names = sketches.filter((s) => !s.discarded).map((s) => s.name.toLowerCase());
    expect(duplicates(names)).toEqual([]);
  });

  it(`hält mindestens ${MIN_ACTIVE_FULL} aktive volle Minispiele`, () => {
    expect(activeFull.length).toBeGreaterThanOrEqual(MIN_ACTIVE_FULL);
  });

  it('hat genug Spiele ohne Stick fürs geteilte iPad', () => {
    const withoutStick = activeFull.filter((s) => !s.controls.includes('S')).length;
    expect(withoutStick / activeFull.length).toBeGreaterThanOrEqual(MIN_SHARE_WITHOUT_STICK);
  });

  it('hat genug Physik-Spiele', () => {
    const physics = activeFull.filter((s) => s.category === 'Ph').length;
    expect(physics / activeFull.length).toBeGreaterThanOrEqual(MIN_SHARE_PHYSICS);
  });
});
