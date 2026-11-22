import type { MinigameInfo } from '@chaos-party/minigame-sdk';

/**
 * Rasensprenger-Rodeo (MG-011, Pilotwelle CHAOS-91): Im Garten drehen Rasensprenger ihre
 * Wasserstrahlen über den Rasen. Wer nass wird, verliert ein Herz und rutscht eine Weile nach;
 * ohne Herzen ist man raus. Punkte je trockene Zehntelsekunde, dicht am Strahl mehr (Rodeo).
 */
export const RASENSPRENGER_RODEO_INFO: MinigameInfo = {
  id: 'rasensprenger-rodeo',
  category: 'arcade',
  title: 'Rasensprenger-Rodeo',
  tagline: 'Die Sprenger drehen sich – bleib trocken!',
  instructions: [
    'Bleib trocken und punkte – dicht am Strahl gibt es mehr!',
    'Nass? Ein Herz weg, und du rutschst eine Weile nach.',
    'Ohne Herzen bist du raus. Zum Schluss drehen alle Sprenger!',
  ],
  controls: { joystick: 'Laufen', a: null, b: null },
  durationMs: 30_000,
  physics: false,
  scoring: 'higher',
  scoreUnit: 'Punkte',
  family: 'ausweichen-ueberleben',
};
