import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SOUND_FILES } from '@chaos-party/assets/sound-files';
import { describe, expect, it } from 'vitest';
import { createSamplePicker, SAMPLE_FILE_NAMES } from './samples.ts';
import { ALL_SOUND_NAMES, type SoundName } from './sounds.ts';

const soundsDir = fileURLToPath(new URL('../../../../packages/assets/sounds/', import.meta.url));

/**
 * Häufige Klänge (viele je Sekunde in Minispielen) bleiben kurz, sonst belegen ihre Ausklänge die
 * Stimmen und „go“, „tick“ oder „win“ fielen weg. Lange Jingles nur für seltene Momente.
 */
const MAX_SECONDS: Partial<Record<SoundName, number>> = {
  tick: 0.3,
  hit: 0.5,
  bump: 0.4,
  coin: 0.4,
  pop: 0.35,
  whoosh: 0.5,
  buzz: 0.6,
  score: 0.6,
  go: 0.8,
  turn: 0.8,
  'coin-gain': 1,
  'coin-loss': 1,
  // Finte in Kuckucks-Klatsche: bis zu 8× je Spiel.
  lose: 1.2,
};
const LONGEST_SECONDS = 2.2;

describe('Klang-Dateien (CHAOS-223)', () => {
  it('jeder Klang-Name hat mindestens eine Datei, und es gibt keine fremden Namen', () => {
    for (const name of ALL_SOUND_NAMES) {
      expect(SOUND_FILES[name]?.files.length, name).toBeGreaterThan(0);
    }
    expect(Object.keys(SOUND_FILES).sort()).toEqual([...ALL_SOUND_NAMES].sort());
  });

  it('die Dateien liegen im Repository', () => {
    for (const file of SAMPLE_FILE_NAMES) {
      expect(existsSync(`${soundsDir}${file}`), file).toBe(true);
    }
  });

  it('kurz, nicht übersteuert, Lautstärke im Rahmen', () => {
    for (const name of ALL_SOUND_NAMES) {
      const set = SOUND_FILES[name];
      if (!set) continue;
      expect(set.gain, name).toBeGreaterThan(0);
      expect(set.gain, name).toBeLessThanOrEqual(1);
      expect(set.jitter, name).toBeGreaterThanOrEqual(0);
      expect(set.jitter, name).toBeLessThanOrEqual(0.15);
      for (const file of set.files) {
        expect(file.duration, file.file).toBeGreaterThan(0.05);
        expect(file.duration, file.file).toBeLessThanOrEqual(MAX_SECONDS[name] ?? LONGEST_SECONDS);
        expect(file.peakDb, file.file).toBeLessThanOrEqual(-0.1);
      }
    }
  });

  it('Varianten reihum, Streuung reproduzierbar, Tonhöhe und Lautstärke begrenzt', () => {
    const pick = createSamplePicker();
    const files = ['hit', 'hit', 'hit', 'hit'].map((n) => pick(n as SoundName)?.file);
    expect(new Set(files.slice(0, 3)).size).toBe(3);
    expect(files[3]).toBe(files[0]);

    const again = createSamplePicker();
    const a = [1, 2, 3].map(() => pick('whoosh')?.rate);
    const b = [1, 2, 3].map(() => again('whoosh')?.rate);
    expect(new Set(a).size).toBe(3);
    const fresh = createSamplePicker();
    expect([1, 2, 3].map(() => fresh('whoosh')?.rate)).toEqual(b);

    const jitter = SOUND_FILES.whoosh?.jitter ?? 0;
    for (const rate of a) {
      expect(rate).toBeGreaterThanOrEqual(1 - jitter);
      expect(rate).toBeLessThanOrEqual(1 + jitter);
    }
    const tick = createSamplePicker()('tick', { pitch: 100, volume: 10 });
    expect(tick?.rate).toBe(4);
    expect(tick?.gain).toBeCloseTo((SOUND_FILES.tick?.gain ?? 0) * 2);
    const nonsense = createSamplePicker()('tick', { pitch: Number.NaN, volume: Number.NaN });
    expect(nonsense?.rate).toBe(1);
    expect(nonsense?.gain).toBeCloseTo(SOUND_FILES.tick?.gain ?? 0);
  });
});
