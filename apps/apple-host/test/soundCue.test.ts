/** Klang-Dateien im SoundCue für Swift (CHAOS-223): Wahl wie im Browser-Host, Vertrag, Rückfall. */
import { describe, expect, it } from 'vitest';
import { SAMPLE_FILE_NAMES } from '../../host/src/fx/samples.ts';
import { ALL_SOUND_NAMES, SOUNDS, shapeRecipe } from '../../host/src/fx/sounds.ts';
import { SoundCueSchema } from '../src/contract.ts';
import { soundCue } from '../src/soundCue.ts';

describe('soundCue (CHAOS-223)', () => {
  it('jeder Klang trägt eine vorhandene Datei und das Rezept als Rückfall, passend zum Vertrag', () => {
    for (const [i, name] of ALL_SOUND_NAMES.entries()) {
      const cue = soundCue(i + 1, name, { volume: 0.5, pitch: 1.25 });
      expect(SoundCueSchema.parse(cue)).toEqual(cue);
      expect(cue.voices).toEqual(shapeRecipe(SOUNDS[name].recipe, { volume: 0.5, pitch: 1.25 }));
      expect(SAMPLE_FILE_NAMES, name).toContain(cue.sample?.file);
      expect(cue.sample?.rate, name).toBeGreaterThan(1.25 * 0.85);
      expect(cue.sample?.rate, name).toBeLessThan(1.25 * 1.15);
      expect(cue.sample?.gain, name).toBeLessThanOrEqual(0.5);
    }
  });

  it('Varianten wechseln reihum über alle Quellen des Kerns', () => {
    const files = [1, 2, 3].map((id) => soundCue(id, 'dice').sample?.file);
    expect(new Set(files).size).toBe(3);
  });

  it('ein Cue ohne Datei bleibt gültig (ältere Kerne, Rückfall)', () => {
    const full = soundCue(1, 'tick');
    const plain = { id: full.id, name: full.name, voices: full.voices };
    expect(SoundCueSchema.parse(plain)).toEqual(plain);
  });
});
