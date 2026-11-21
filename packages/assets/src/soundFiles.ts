/**
 * Klang-Dateien (CHAOS-223), erzeugt von `src/import/sounds.ts` aus `sounds.json` – nicht von Hand
 * ändern. Je Klang: Lautstärke im Mix, Tonhöhen-Streuung und die Dateien unter `sounds/` mit Dauer
 * (s) und Spitzenpegel (dBFS). Browser-Host und Apple-Host wählen daraus (`apps/host/src/fx/samples.ts`).
 */
export interface SoundFile {
  readonly file: string;
  readonly duration: number;
  readonly peakDb: number;
}

export interface SoundFileSet {
  readonly gain: number;
  readonly jitter: number;
  readonly files: readonly SoundFile[];
}

export const SOUND_FILES: Readonly<Record<string, SoundFileSet>> = {
  tick: {
    gain: 0.8,
    jitter: 0,
    files: [
      {
        file: 'tick-1.mp3',
        duration: 0.263,
        peakDb: -1,
      },
    ],
  },
  go: {
    gain: 0.7,
    jitter: 0.02,
    files: [
      {
        file: 'go-1.mp3',
        duration: 0.484,
        peakDb: -10.9,
      },
    ],
  },
  hit: {
    gain: 0.9,
    jitter: 0.06,
    files: [
      {
        file: 'hit-1.mp3',
        duration: 0.289,
        peakDb: -3.7,
      },
      {
        file: 'hit-2.mp3',
        duration: 0.292,
        peakDb: -3.7,
      },
      {
        file: 'hit-3.mp3',
        duration: 0.305,
        peakDb: -2.5,
      },
    ],
  },
  bump: {
    gain: 0.75,
    jitter: 0.08,
    files: [
      {
        file: 'bump-1.mp3',
        duration: 0.203,
        peakDb: -1,
      },
      {
        file: 'bump-2.mp3',
        duration: 0.156,
        peakDb: -1,
      },
      {
        file: 'bump-3.mp3',
        duration: 0.211,
        peakDb: -7.4,
      },
    ],
  },
  coin: {
    gain: 0.7,
    jitter: 0.05,
    files: [
      {
        file: 'coin-1.mp3',
        duration: 0.191,
        peakDb: -0.2,
      },
      {
        file: 'coin-2.mp3',
        duration: 0.144,
        peakDb: -8,
      },
    ],
  },
  score: {
    gain: 0.8,
    jitter: 0.03,
    files: [
      {
        file: 'score-1.mp3',
        duration: 0.29,
        peakDb: -7.7,
      },
      {
        file: 'score-2.mp3',
        duration: 0.322,
        peakDb: -3.9,
      },
    ],
  },
  fall: {
    gain: 0.75,
    jitter: 0.04,
    files: [
      {
        file: 'fall-1.mp3',
        duration: 1.174,
        peakDb: -9.3,
      },
    ],
  },
  splash: {
    gain: 0.85,
    jitter: 0.05,
    files: [
      {
        file: 'splash-1.mp3',
        duration: 0.865,
        peakDb: -1.1,
      },
      {
        file: 'splash-2.mp3',
        duration: 0.66,
        peakDb: -1.1,
      },
    ],
  },
  whoosh: {
    gain: 0.6,
    jitter: 0.08,
    files: [
      {
        file: 'whoosh-1.mp3',
        duration: 0.426,
        peakDb: -1.7,
      },
      {
        file: 'whoosh-2.mp3',
        duration: 0.277,
        peakDb: -1,
      },
      {
        file: 'whoosh-3.mp3',
        duration: 0.169,
        peakDb: -1.8,
      },
    ],
  },
  pop: {
    gain: 0.7,
    jitter: 0.1,
    files: [
      {
        file: 'pop-1.mp3',
        duration: 0.243,
        peakDb: -0.9,
      },
      {
        file: 'pop-2.mp3',
        duration: 0.133,
        peakDb: -6,
      },
    ],
  },
  buzz: {
    gain: 0.6,
    jitter: 0,
    files: [
      {
        file: 'buzz-1.mp3',
        duration: 0.244,
        peakDb: -3.9,
      },
    ],
  },
  cheer: {
    gain: 0.7,
    jitter: 0,
    files: [
      {
        file: 'cheer-1.mp3',
        duration: 1.91,
        peakDb: -6.9,
      },
    ],
  },
  win: {
    gain: 0.75,
    jitter: 0,
    files: [
      {
        file: 'win-1.mp3',
        duration: 1.703,
        peakDb: -1,
      },
      {
        file: 'win-2.mp3',
        duration: 1.691,
        peakDb: -1.9,
      },
      {
        file: 'win-3.mp3',
        duration: 1.739,
        peakDb: -1.7,
      },
    ],
  },
  lose: {
    gain: 0.65,
    jitter: 0.03,
    files: [
      {
        file: 'lose-1.mp3',
        duration: 0.837,
        peakDb: -8.2,
      },
    ],
  },
  dice: {
    gain: 0.9,
    jitter: 0.04,
    files: [
      {
        file: 'dice-1.mp3',
        duration: 0.602,
        peakDb: -1,
      },
      {
        file: 'dice-2.mp3',
        duration: 0.388,
        peakDb: -1.1,
      },
      {
        file: 'dice-3.mp3',
        duration: 0.576,
        peakDb: -1,
      },
    ],
  },
  'coin-gain': {
    gain: 0.8,
    jitter: 0.04,
    files: [
      {
        file: 'coin-gain-1.mp3',
        duration: 0.717,
        peakDb: -1.2,
      },
      {
        file: 'coin-gain-2.mp3',
        duration: 0.304,
        peakDb: -0.8,
      },
    ],
  },
  'coin-loss': {
    gain: 0.7,
    jitter: 0,
    files: [
      {
        file: 'coin-loss-1.mp3',
        duration: 0.53,
        peakDb: -7.6,
      },
    ],
  },
  steal: {
    gain: 0.8,
    jitter: 0.03,
    files: [
      {
        file: 'steal-1.mp3',
        duration: 0.421,
        peakDb: -0.9,
      },
    ],
  },
  trap: {
    gain: 0.85,
    jitter: 0.03,
    files: [
      {
        file: 'trap-1.mp3',
        duration: 0.397,
        peakDb: -1,
      },
    ],
  },
  shield: {
    gain: 0.7,
    jitter: 0.02,
    files: [
      {
        file: 'shield-1.mp3',
        duration: 0.692,
        peakDb: -1.3,
      },
    ],
  },
  trophy: {
    gain: 0.8,
    jitter: 0,
    files: [
      {
        file: 'trophy-1.mp3',
        duration: 1.789,
        peakDb: -1.5,
      },
    ],
  },
  turn: {
    gain: 0.55,
    jitter: 0,
    files: [
      {
        file: 'turn-1.mp3',
        duration: 0.557,
        peakDb: -4.6,
      },
    ],
  },
  'minigame-start': {
    gain: 0.7,
    jitter: 0,
    files: [
      {
        file: 'minigame-start-1.mp3',
        duration: 0.949,
        peakDb: -7.1,
      },
    ],
  },
  pause: {
    gain: 0.6,
    jitter: 0,
    files: [
      {
        file: 'pause-1.mp3',
        duration: 0.404,
        peakDb: -3.9,
      },
    ],
  },
  resume: {
    gain: 0.6,
    jitter: 0,
    files: [
      {
        file: 'resume-1.mp3',
        duration: 0.403,
        peakDb: -3.8,
      },
    ],
  },
};
