import type { MinigameInfo } from '@chaos-party/minigame-sdk';

/**
 * Bienenstock-Honig (MG-101, Pilotwelle CHAOS-91): Alle sitzen um einen Bienenstock und zapfen
 * Honig in ihren Topf. Nur Honig im Vorratsglas zählt. Kniff: Wer viel zapft, macht die Bienen
 * wütend; wer gestochen wird, verliert den ungesicherten Honig.
 */
export const BIENENSTOCK_HONIG_INFO: MinigameInfo = {
  id: 'bienenstock-honig',
  category: 'hybrid',
  title: 'Bienenstock-Honig',
  tagline: 'Zapf Honig, bevor die Bienen dich stechen!',
  instructions: [
    'Am meisten Honig im Glas gewinnt: A zapft, B sichert ins Glas.',
    'Zapf länger für mehr Honig, aber die Bienen werden wütend.',
    'Fliegt eine Biene zu dir: schnell sichern, sonst ist alles weg!',
  ],
  controls: { joystick: null, a: 'Zapfen', b: 'Sichern' },
  durationMs: 25_000,
  physics: false,
  scoring: 'higher',
  scoreUnit: 'Gramm',
  family: 'zocken',
  ipadZone: true,
};
