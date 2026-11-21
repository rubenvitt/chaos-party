/**
 * Klang-Dateien statt Rezepte (CHAOS-223): Zu jedem Klang-Namen wählt der Picker eine Datei aus
 * `packages/assets/sounds/` (CC0, Auswahl in `packages/assets/sounds.json`), dazu Abspiel-Rate
 * (Tonhöhe) und Lautstärke. Rein und ohne `import.meta` – der Apple-Host bündelt das für
 * JavaScriptCore und schickt die Wahl im `SoundCue` an Swift (`apps/apple-host/src/soundCue.ts`);
 * der Browser-Host spielt die Datei per WebAudio (`audio.ts`). Die Rezepte aus `sounds.ts` bleiben
 * als Rückfall, solange die Dateien noch laden oder fehlen.
 *
 * Varianten reihum (nie zweimal hintereinander dieselbe Datei, wenn es mehrere gibt), die
 * Tonhöhen-Streuung aus einem kleinen Zufallsgenerator mit festem Startwert: Bot-Partien und Tests
 * bleiben reproduzierbar.
 */
import { SOUND_FILES, type SoundFileSet } from '@chaos-party/assets/sound-files';
import type { PlayOptions, SoundName } from './sounds.ts';

export interface SampleChoice {
  /** Dateiname unter `packages/assets/sounds/` (z. B. `coin-2.mp3`). */
  readonly file: string;
  /** Abspiel-Rate (1 = Original; wie `playbackRate` bzw. `AVAudioUnitVarispeed.rate`). */
  readonly rate: number;
  /** Lautstärke 0…2 vor der Gesamtlautstärke. */
  readonly gain: number;
}

export type SamplePicker = (name: SoundName, options?: PlayOptions) => SampleChoice | null;

/** Alle Dateinamen (zum Vorladen). */
export const SAMPLE_FILE_NAMES: readonly string[] = Object.values(SOUND_FILES).flatMap((set) =>
  set.files.map((f) => f.file),
);

export function sampleSet(name: SoundName): SoundFileSet | undefined {
  return SOUND_FILES[name];
}

export function createSamplePicker(seed = 0x2545_f491): SamplePicker {
  const turns = new Map<string, number>();
  let state = seed >>> 0 || 1;
  /** xorshift32 → [0, 1). */
  const random = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0x1_0000_0000;
  };
  return (name, options = {}) => {
    const set = SOUND_FILES[name];
    if (!set || set.files.length === 0) return null;
    const turn = turns.get(name) ?? 0;
    turns.set(name, turn + 1);
    const file = set.files[turn % set.files.length];
    if (!file) return null;
    const spread = set.jitter > 0 ? 1 + set.jitter * (random() * 2 - 1) : 1;
    return {
      file: file.file,
      rate: clamp(options.pitch ?? 1, 0.25, 4) * spread,
      gain: set.gain * clamp(options.volume ?? 1, 0, 2),
    };
  };
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(min, Math.min(max, value));
}
