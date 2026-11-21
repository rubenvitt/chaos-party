import type { MinigameInfo } from '@chaos-party/minigame-sdk';

/**
 * Testspiel der Spielform 2 gegen 2 (CHAOS-89), Pump-Parade-Niveau. Nicht in der Rotation;
 * spielbar in der Galerie. Zu dritt 1 gegen 2 (Einzelperson mit Vorteil), zu zweit 1 gegen 1.
 */
export const PUMP_DUELL_INFO: MinigameInfo = {
  id: 'pump-duell',
  category: 'arcade',
  title: 'Pump-Duell',
  tagline: 'Pumpt im Team den größeren Ballon auf!',
  instructions: ['Tippe A so oft du kannst.', 'Der größere Team-Ballon gewinnt.'],
  controls: { joystick: null, a: 'Pumpen', b: null },
  durationMs: 8_000,
  physics: false,
  scoring: 'higher',
  scoreUnit: 'Pumpstöße',
  family: 'zwei-gegen-zwei',
  minPlayers: 2,
  ipadZone: true,
  teamPlay: { form: '2v2', assignment: 'random', withThree: true, withTwo: true },
};
