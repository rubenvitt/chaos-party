import type { MinigameInfo } from '@chaos-party/minigame-sdk';

/**
 * Schnapp den Käse (MG-045, Pilotwelle CHAOS-91): Käse stapelt sich auf der Mausefalle, die
 * irgendwann zuschnappt (vorher zuckt sie, manchmal nur als Finte). Kern ist Zurückhaltung.
 */
export const SCHNAPP_DEN_KAESE_INFO: MinigameInfo = {
  id: 'schnapp-den-kaese',
  category: 'arcade',
  title: 'Schnapp den Käse',
  tagline: 'Warte, so lang du dich traust – dann schnapp dir den Käse!',
  instructions: [
    'A schnappt den Käse: Jede Scheibe auf dem Stapel zählt 1 Punkt.',
    'Zuckt die Falle, schnappt sie gleich zu – außer bei einer Finte.',
    'Erwischt? Die Pfote ist gezwickt: eine Sekunde Pause.',
  ],
  controls: { joystick: null, a: 'Zugreifen', b: null },
  durationMs: 25_000,
  physics: false,
  scoring: 'higher',
  scoreUnit: 'Scheiben',
  family: 'reflex-reaktion',
  ipadZone: true,
};
