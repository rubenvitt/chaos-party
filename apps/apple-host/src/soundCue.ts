/**
 * Ein Klang für Swift (CHAOS-143/190/223): Rezept mit Lautstärke und Tonhöhe (`voices`, Rückfall)
 * und die gewählte Klang-Datei (`sample`, CC0 aus `packages/assets/sounds/`, Wahl wie im
 * Browser-Host über `samples.ts`). Swift spielt die Datei, wenn sie im Bündel liegt, sonst das Rezept.
 */
import { createSamplePicker } from '../../host/src/fx/samples.ts';
import { SOUNDS, shapeRecipe, type PlayOptions, type SoundName } from '../../host/src/fx/sounds.ts';
import type { SoundCue } from './contract.ts';

/** Ein Picker für den ganzen Kern: Varianten reihum über Brett, Minispiele, Pause und Finale. */
const pickSample = createSamplePicker();

export function soundCue(id: number, name: SoundName, options?: PlayOptions): SoundCue {
  // JSON-Kopie: `shapeRecipe` lässt fehlende Felder als `undefined` stehen, und keine geteilten
  // Objekte im Zustand.
  const voices = JSON.parse(
    JSON.stringify(shapeRecipe(SOUNDS[name].recipe, options)),
  ) as SoundCue['voices'];
  const sample = pickSample(name, options);
  return sample ? { id, name, voices, sample } : { id, name, voices };
}

/** Nur die Vertragsfelder (ohne Zeitpunkt und Besitzer des Zeitfensters). */
export function toCue(cue: SoundCue): SoundCue {
  return cue.sample
    ? { id: cue.id, name: cue.name, voices: cue.voices, sample: cue.sample }
    : { id: cue.id, name: cue.name, voices: cue.voices };
}
