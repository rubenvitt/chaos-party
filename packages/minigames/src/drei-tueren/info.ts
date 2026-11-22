import type { MinigameInfo } from '@chaos-party/minigame-sdk';

/**
 * Drei Türen (MG-111, Pilotwelle CHAOS-91): Mehrere Runden lang wählen alle geheim eine von drei
 * Türen mit sichtbarem Münzwert. Kniff: Nur eine Tür mit genau einer Person zahlt aus, volle
 * Türen gehen leer aus. Wer liest, wohin die anderen gern gehen, weicht geschickt aus.
 */
export const DREI_TUEREN_INFO: MinigameInfo = {
  id: 'drei-tueren',
  category: 'hybrid',
  title: 'Drei Türen',
  tagline: 'Wähl geheim eine Tür – aber stehst du dort allein?',
  instructions: [
    'Die meisten Münzen gewinnen. Stick zeigt auf eine Tür, A wählt.',
    'Nur wer allein vor einer Tür steht, bekommt ihre Münzen.',
    'Merk dir, wohin die anderen gehen. Letzte Runde zählt doppelt!',
  ],
  controls: { joystick: 'Tür zeigen', a: 'Wählen', b: null },
  durationMs: 27_000,
  physics: false,
  scoring: 'higher',
  scoreUnit: 'Münzen',
  family: 'bluff-geheime-wahl',
  secretChoice: true,
  ipadZone: true,
};
