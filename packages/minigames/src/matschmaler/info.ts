import type { MinigameInfo } from '@chaos-party/minigame-sdk';

/**
 * Matschmaler (MG-121, Pilotwelle CHAOS-91): Alle laufen über die Wiese und färben sie mit
 * Matsch in ihrer Farbe. Kniff: A macht einen Bauchplatscher (großer Fleck, danach benommen),
 * ein angekündigter Regenschauer wäscht einen Streifen wieder weg.
 */
export const MATSCHMALER_INFO: MinigameInfo = {
  id: 'matschmaler',
  category: 'arcade',
  title: 'Matschmaler',
  tagline: 'Färb die Wiese mit Matsch in deiner Farbe!',
  instructions: [
    'Lauf über die Wiese: Jedes Feld unter dir wird deins.',
    'A = Bauchplatscher: großer Fleck, danach kurz benommen.',
    'Blauer Streifen = Regen: wäscht Felder weg, du rutschst aus.',
  ],
  controls: { joystick: 'Laufen', a: 'Bauchplatscher', b: null },
  durationMs: 25_000,
  physics: false,
  scoring: 'higher',
  scoreUnit: 'Felder',
  family: 'revier-malen',
  ipadZone: true,
};
