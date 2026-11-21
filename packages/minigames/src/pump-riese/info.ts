import type { MinigameInfo } from '@chaos-party/minigame-sdk';

/**
 * Testspiel der Spielform Koop mit Einzelwertung (CHAOS-89), Pump-Parade-Niveau. Nicht in der
 * Rotation; spielbar in der Galerie. Alle pumpen einen Riesenballon; je voller, desto höher die
 * Stufe und damit die Münzen. Die eigenen Pumpstöße bestimmen den Anteil.
 */
export const PUMP_RIESE_INFO: MinigameInfo = {
  id: 'pump-riese',
  category: 'arcade',
  title: 'Riesenballon',
  tagline: 'Pumpt gemeinsam einen Riesenballon auf!',
  instructions: ['Tippe A so oft du kannst.', 'Je voller der Ballon, desto mehr Münzen.'],
  controls: { joystick: null, a: 'Pumpen', b: null },
  durationMs: 8_000,
  physics: false,
  scoring: 'higher',
  scoreUnit: 'Pumpstöße',
  family: 'koop-chaos',
  minPlayers: 2,
  ipadZone: true,
  teamPlay: { form: 'koop', withThree: true, withTwo: true },
};
