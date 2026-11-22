import type { MinigameInfo } from '@chaos-party/minigame-sdk';
import { CHAIN_MAX_MS } from './chain.ts';

/**
 * Schnellfeuer (CHAOS-90, README §7 Nr. 3): eigene Rundenart, keine Nummer im Katalog der
 * ~200 vollen Minispiele. Fünf Mikro-Spiele à 5–8 s am Stück, je mit Bildwort statt Anleitung.
 * Kommt nicht über die Rotation, sondern über den Auslöser in game-core (`rules.rapidFire`).
 */
export const SCHNELLFEUER_INFO: MinigameInfo = {
  id: 'schnellfeuer',
  category: 'arcade',
  title: 'Schnellfeuer!',
  tagline: 'Fünf Mikro-Spiele am Stück – das Bildwort sagt, was zu tun ist.',
  instructions: [
    'Fünf Mikro-Spiele, je ein paar Sekunden.',
    'Vor jedem steht groß ein Bildwort: genau das tun!',
    'Jeder Platz bringt Punkte, alle fünf zählen.',
  ],
  controls: { joystick: 'Zielen', a: 'Los!', b: null },
  durationMs: CHAIN_MAX_MS,
  physics: false,
  scoring: 'higher',
  scoreUnit: 'Punkte',
  family: 'mikro',
  minPlayers: 2,
};
