/**
 * Klang-Namen und prozedurale Rezepte (CHAOS-33): jedes Geräusch ist ein Rezept aus wenigen
 * „Stimmen“ (Oszillator oder Rauschen, Tonhöhen-Gleiten, Hüllkurve, optional Filter). Reine Daten,
 * ohne WebAudio – `audio.ts` spielt sie ab, Unit-Tests prüfen Länge, Lautstärke und Tonlage.
 *
 * Seit CHAOS-223 spielen beide Hosts echte Aufnahmen (CC0, `samples.ts`); die Rezepte sind nur noch
 * der Rückfall, solange die Dateien laden oder wenn eine fehlt.
 *
 * Richtlinie: kurz (≤ 1,2 s), cartoonig, nicht schrill (Grundtöne ≤ 2,1 kHz, Rechteck/Sägezahn
 * nur leise und gefiltert).
 */
import { SOUND_IDS, type SoundId } from '@chaos-party/minigame-sdk/babylon';

/** Zusätzliche Klänge des Spielbretts (M2-Ereignisse, CHAOS-33). */
export const BOARD_SOUND_IDS = [
  'dice',
  'coin-gain',
  'coin-loss',
  'steal',
  'trap',
  'shield',
  'trophy',
  'turn',
  'minigame-start',
  'pause',
  'resume',
] as const;
export type BoardSoundId = (typeof BOARD_SOUND_IDS)[number];

export type SoundName = SoundId | BoardSoundId;
export const ALL_SOUND_NAMES: readonly SoundName[] = [...SOUND_IDS, ...BOARD_SOUND_IDS];

export type Wave = 'sine' | 'triangle' | 'square' | 'sawtooth' | 'noise';

export interface VoiceFilter {
  readonly type: 'lowpass' | 'bandpass' | 'highpass';
  /** Eckfrequenz zu Beginn (Hz). */
  readonly freq: number;
  /** Eckfrequenz am Ende (gleitet exponentiell); fehlt = fest. */
  readonly freqEnd?: number;
  readonly q?: number;
}

/** Eine Stimme eines Klangs. Zeiten in Sekunden ab dem Abspielen. */
export interface Voice {
  readonly wave: Wave;
  /** Grundton (Hz); bei Rauschen ohne Bedeutung (Klangfarbe über `filter`). */
  readonly freq: number;
  /** Ton am Ende (gleitet exponentiell); fehlt = fest. */
  readonly freqEnd?: number;
  readonly delay?: number;
  readonly attack: number;
  /** Gesamtdauer inkl. Ausklingen. */
  readonly duration: number;
  /** Spitzenpegel 0…1 (vor Gesamtlautstärke). */
  readonly gain: number;
  readonly filter?: VoiceFilter;
}

export type SoundRecipe = readonly Voice[];

export interface SoundDescription {
  readonly recipe: SoundRecipe;
  /** Kurzbeschreibung für `fx/README.md` und das Asset-Manifest. */
  readonly description: string;
}

const note = (
  freq: number,
  delay: number,
  duration: number,
  gain = 0.22,
  wave: Wave = 'triangle',
): Voice => ({ wave, freq, delay, attack: 0.008, duration, gain });

export const SOUNDS: Readonly<Record<SoundName, SoundDescription>> = {
  // --- Minispiele (SOUND_IDS) ---------------------------------------------------------------
  tick: {
    description: 'Kurzes Holzklötzchen-Tick (Countdown)',
    recipe: [{ wave: 'sine', freq: 740, freqEnd: 620, attack: 0.003, duration: 0.07, gain: 0.25 }],
  },
  go: {
    description: 'Aufsteigender Dreiklang „Los!“',
    recipe: [note(523, 0, 0.14), note(659, 0.08, 0.14), note(784, 0.16, 0.38, 0.26)],
  },
  hit: {
    description: 'Dumpfer Treffer: Rauschstoß mit tiefem Plopp',
    recipe: [
      {
        wave: 'noise',
        freq: 0,
        attack: 0.002,
        duration: 0.09,
        gain: 0.3,
        filter: { type: 'lowpass', freq: 1400, freqEnd: 300 },
      },
      { wave: 'sine', freq: 190, freqEnd: 70, attack: 0.004, duration: 0.16, gain: 0.4 },
    ],
  },
  bump: {
    description: 'Gummi-„Boing“ beim Zusammenstoßen',
    recipe: [
      { wave: 'sine', freq: 300, freqEnd: 140, attack: 0.004, duration: 0.18, gain: 0.32 },
      { wave: 'triangle', freq: 150, freqEnd: 90, attack: 0.004, duration: 0.14, gain: 0.18 },
    ],
  },
  coin: {
    description: 'Münz-Pling in zwei Tönen',
    recipe: [note(988, 0, 0.07, 0.18), note(1319, 0.06, 0.24, 0.18)],
  },
  score: {
    description: 'Fröhliches Aufwärts-Glissando für Punkte',
    recipe: [
      { wave: 'sine', freq: 520, freqEnd: 880, attack: 0.006, duration: 0.16, gain: 0.26 },
      note(1046, 0.1, 0.22, 0.14),
    ],
  },
  fall: {
    description: 'Lotusflöte abwärts (jemand fällt runter)',
    recipe: [{ wave: 'sine', freq: 900, freqEnd: 180, attack: 0.02, duration: 0.65, gain: 0.24 }],
  },
  splash: {
    description: 'Platschen: gefiltertes Rauschen und Blubb',
    recipe: [
      {
        wave: 'noise',
        freq: 0,
        attack: 0.005,
        duration: 0.42,
        gain: 0.3,
        filter: { type: 'bandpass', freq: 1200, freqEnd: 350, q: 0.8 },
      },
      {
        wave: 'sine',
        freq: 420,
        freqEnd: 140,
        delay: 0.03,
        attack: 0.01,
        duration: 0.2,
        gain: 0.2,
      },
    ],
  },
  whoosh: {
    description: 'Luftzug: Rauschen mit wanderndem Bandpass',
    recipe: [
      {
        wave: 'noise',
        freq: 0,
        attack: 0.08,
        duration: 0.36,
        gain: 0.28,
        filter: { type: 'bandpass', freq: 350, freqEnd: 1800, q: 1.2 },
      },
    ],
  },
  pop: {
    description: 'Kurzes Blubb-Plopp (Pumpen, Einsammeln)',
    recipe: [{ wave: 'sine', freq: 520, freqEnd: 1040, attack: 0.002, duration: 0.07, gain: 0.26 }],
  },
  buzz: {
    description: 'Weicher Fehler-Summer',
    recipe: [
      {
        wave: 'sawtooth',
        freq: 140,
        attack: 0.01,
        duration: 0.32,
        gain: 0.12,
        filter: { type: 'lowpass', freq: 900 },
      },
      { wave: 'square', freq: 147, attack: 0.01, duration: 0.32, gain: 0.05 },
    ],
  },
  cheer: {
    description: 'Jubel: Rausch-Raunen mit zwei „Juhu“-Stimmen',
    recipe: [
      {
        wave: 'noise',
        freq: 0,
        attack: 0.12,
        duration: 1.0,
        gain: 0.16,
        filter: { type: 'bandpass', freq: 900, freqEnd: 1300, q: 0.7 },
      },
      { wave: 'triangle', freq: 440, freqEnd: 660, attack: 0.04, duration: 0.45, gain: 0.14 },
      {
        wave: 'triangle',
        freq: 554,
        freqEnd: 830,
        delay: 0.18,
        attack: 0.04,
        duration: 0.5,
        gain: 0.12,
      },
    ],
  },
  win: {
    description: 'Kleine Siegesfanfare (C-E-G-C)',
    recipe: [
      note(523, 0, 0.14, 0.2),
      note(659, 0.1, 0.14, 0.2),
      note(784, 0.2, 0.14, 0.2),
      note(1046, 0.3, 0.55, 0.24),
      {
        wave: 'square',
        freq: 523,
        delay: 0.3,
        attack: 0.01,
        duration: 0.55,
        gain: 0.05,
        filter: { type: 'lowpass', freq: 1500 },
      },
    ],
  },
  lose: {
    description: 'Trauriges „Wah-wah-wah“ abwärts',
    recipe: [
      note(392, 0, 0.24, 0.22),
      note(370, 0.26, 0.24, 0.22),
      {
        wave: 'triangle',
        freq: 349,
        freqEnd: 262,
        delay: 0.52,
        attack: 0.01,
        duration: 0.6,
        gain: 0.22,
      },
    ],
  },

  // --- Spielbrett ----------------------------------------------------------------------------
  dice: {
    description: 'Würfelklappern mit Aufschlag',
    recipe: [
      ...[0, 0.05, 0.11, 0.18, 0.26].map((delay, index): Voice => ({
        wave: 'noise',
        freq: 0,
        delay,
        attack: 0.002,
        duration: 0.04,
        gain: 0.26 - index * 0.03,
        filter: { type: 'bandpass', freq: 1900 - index * 150, q: 2 },
      })),
      {
        wave: 'sine',
        freq: 210,
        freqEnd: 110,
        delay: 0.32,
        attack: 0.003,
        duration: 0.14,
        gain: 0.3,
      },
    ],
  },
  'coin-gain': {
    description: 'Münzen bekommen: helles Doppel-Pling',
    recipe: [note(988, 0, 0.07, 0.17), note(1319, 0.06, 0.12, 0.17), note(1568, 0.12, 0.22, 0.12)],
  },
  'coin-loss': {
    description: 'Münzen verlieren: absackende Töne',
    recipe: [
      { wave: 'triangle', freq: 784, freqEnd: 392, attack: 0.006, duration: 0.26, gain: 0.2 },
      {
        wave: 'triangle',
        freq: 523,
        freqEnd: 262,
        delay: 0.14,
        attack: 0.006,
        duration: 0.3,
        gain: 0.18,
      },
    ],
  },
  steal: {
    description: 'Münzklau: Wusch und schleichendes Tiefton-Kichern',
    recipe: [
      {
        wave: 'noise',
        freq: 0,
        attack: 0.04,
        duration: 0.28,
        gain: 0.22,
        filter: { type: 'bandpass', freq: 1600, freqEnd: 400, q: 1.4 },
      },
      note(330, 0.16, 0.1, 0.16),
      note(277, 0.27, 0.1, 0.16),
      note(330, 0.38, 0.16, 0.16),
    ],
  },
  trap: {
    description: 'Falle schnappt zu: Klick und tiefes Zuschnappen',
    recipe: [
      {
        wave: 'noise',
        freq: 0,
        attack: 0.001,
        duration: 0.05,
        gain: 0.28,
        filter: { type: 'highpass', freq: 1500 },
      },
      {
        wave: 'square',
        freq: 130,
        freqEnd: 60,
        attack: 0.003,
        duration: 0.22,
        gain: 0.12,
        filter: { type: 'lowpass', freq: 600 },
      },
    ],
  },
  shield: {
    description: 'Schild: schimmernder Glockenklang',
    recipe: [
      { wave: 'sine', freq: 880, freqEnd: 940, attack: 0.01, duration: 0.5, gain: 0.16 },
      {
        wave: 'sine',
        freq: 1108,
        freqEnd: 1180,
        delay: 0.04,
        attack: 0.01,
        duration: 0.5,
        gain: 0.12,
      },
      note(1320, 0.08, 0.4, 0.08, 'sine'),
    ],
  },
  trophy: {
    description: 'Trophäe gekauft: Fanfare mit Glitzern',
    recipe: [
      note(523, 0, 0.12, 0.2),
      note(659, 0.09, 0.12, 0.2),
      note(784, 0.18, 0.12, 0.2),
      note(1046, 0.27, 0.6, 0.22),
      note(1568, 0.4, 0.4, 0.07, 'sine'),
      note(2093, 0.5, 0.3, 0.05, 'sine'),
    ],
  },
  turn: {
    description: 'Zugbeginn: sanfter Zweiklang-Gong',
    recipe: [note(660, 0, 0.3, 0.18, 'sine'), note(880, 0.14, 0.4, 0.16, 'sine')],
  },
  'minigame-start': {
    description: 'Minispiel-Zeit: Aufwärts-Swoosh mit Tusch',
    recipe: [
      { wave: 'sine', freq: 300, freqEnd: 900, attack: 0.02, duration: 0.35, gain: 0.22 },
      note(784, 0.3, 0.14, 0.18),
      note(1046, 0.4, 0.45, 0.2),
    ],
  },
  // M4 (CHAOS-40): hörbare Rückmeldung, dass die Partie anhält bzw. weiterläuft.
  pause: {
    description: 'Pause: zwei sanfte, absteigende Töne',
    recipe: [note(660, 0, 0.18, 0.18, 'sine'), note(440, 0.12, 0.35, 0.18, 'sine')],
  },
  resume: {
    description: 'Weiter: zwei sanfte, aufsteigende Töne',
    recipe: [note(440, 0, 0.16, 0.18, 'sine'), note(660, 0.1, 0.3, 0.2, 'sine')],
  },
};

/** Länge eines Rezepts in Sekunden (letztes Stimmen-Ende). */
export function recipeDuration(recipe: SoundRecipe): number {
  return recipe.reduce((max, voice) => Math.max(max, (voice.delay ?? 0) + voice.duration), 0);
}

export interface PlayOptions {
  /** Lautstärke-Faktor 0…2 (Standard 1). */
  readonly volume?: number;
  /** Tonhöhen-Faktor 0,25…4 (Standard 1). */
  readonly pitch?: number;
}

/** Wendet Lautstärke und Tonhöhe auf ein Rezept an (begrenzt, ohne NaN). */
export function shapeRecipe(recipe: SoundRecipe, options: PlayOptions = {}): SoundRecipe {
  const volume = clamp(options.volume ?? 1, 0, 2);
  const pitch = clamp(options.pitch ?? 1, 0.25, 4);
  return recipe.map((voice) => ({
    ...voice,
    freq: voice.freq * pitch,
    ...(voice.freqEnd === undefined ? {} : { freqEnd: voice.freqEnd * pitch }),
    gain: voice.gain * volume,
  }));
}

function clamp(value: number, min: number, max: number): number {
  // 1 liegt in beiden Bereichen (Lautstärke 0…2, Tonhöhe 0,25…4).
  if (!Number.isFinite(value)) return 1;
  return Math.max(min, Math.min(max, value));
}
