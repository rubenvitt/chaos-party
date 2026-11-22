import type { MinigameInfo } from '@chaos-party/minigame-sdk';

/**
 * Nussregen-Netz (MG-001, Pilotwelle CHAOS-91): Eichhörnchen werfen Nüsse aus der Baumkrone,
 * alle fangen sie mit dem Kescher. Kniff: A schwingt den Kescher weit, danach ist man 1 s lahm;
 * faule Nüsse stinken (kurz langsamer, Abzug).
 */
export const NUSSREGEN_NETZ_INFO: MinigameInfo = {
  id: 'nussregen-netz',
  category: 'hybrid',
  title: 'Nussregen-Netz',
  tagline: 'Die Eichhörnchen werfen Nüsse. Fang sie mit dem Kescher!',
  instructions: [
    'Halt den Kescher unter fallende Nüsse. Mitte zählt am meisten.',
    'Faule Nüsse (grün, ohne Hut) stinken: Abzug, du wirst langsam.',
    'A schwingt den Kescher weit – danach bist du 1 s lahm.',
  ],
  controls: { joystick: 'Laufen', a: 'Weit schwingen', b: null },
  durationMs: 25_000,
  physics: false,
  scoring: 'higher',
  scoreUnit: 'Punkte',
  family: 'fangen-sammeln',
  ipadZone: true,
};
