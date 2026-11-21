import type { MinigameInfo } from '@chaos-party/minigame-sdk';

/**
 * Testspiel der Spielform 1 gegen 3 (CHAOS-89), Pump-Parade-Niveau. Nicht in der Rotation;
 * spielbar in der Galerie. Wer auf dem Brett hinten liegt, pumpt allein – jeder Stoß zählt so
 * viel wie die Gegner zusammen.
 */
export const PUMP_SOLO_INFO: MinigameInfo = {
  id: 'pump-solo',
  category: 'arcade',
  title: 'Pump-Solo',
  tagline: 'Eine Person pumpt allein gegen alle anderen!',
  instructions: ['Tippe A so oft du kannst.', 'Allein zählt jeder Stoß dreifach.'],
  controls: { joystick: null, a: 'Pumpen', b: null },
  durationMs: 8_000,
  physics: false,
  scoring: 'higher',
  scoreUnit: 'Pumpstöße',
  family: 'einer-gegen-alle',
  minPlayers: 2,
  ipadZone: true,
  teamPlay: { form: '1v3', assignment: 'last-vs-all', withThree: true, withTwo: true },
};
