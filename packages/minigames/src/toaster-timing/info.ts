import type { MinigameInfo } from '@chaos-party/minigame-sdk';

/**
 * Toaster-Timing (MG-033, Pilotwelle CHAOS-91): Jede Person hat einen Toaster und lässt den
 * Toast im richtigen Moment hochspringen. Goldbraun gibt die meisten Punkte, blass wenig,
 * verkohlt nichts. Kniff: Jeder Toast röstet anders schnell, man muss das Tempo ablesen.
 */
export const TOASTER_TIMING_INFO: MinigameInfo = {
  id: 'toaster-timing',
  category: 'arcade',
  title: 'Toaster-Timing',
  tagline: 'Goldbraun oder Kohle? Lass den Toast im richtigen Moment raus!',
  instructions: [
    'A lässt deinen Toast hochspringen: goldbraun gibt 10 Punkte.',
    'Zu früh ist er blass, zu spät verkohlt er (0 Punkte).',
    'Jeder Toast röstet anders schnell. Schau genau hin!',
  ],
  controls: { joystick: null, a: 'Toast raus', b: null },
  durationMs: 25_000,
  physics: false,
  scoring: 'higher',
  scoreUnit: 'Punkte',
  family: 'timing-rhythmus',
  ipadZone: true,
};
