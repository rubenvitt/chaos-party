import type { MinigameInfo } from '@chaos-party/minigame-sdk';

/**
 * Eiswürfel-Sumo (MG-023, Pilotwelle CHAOS-91): Alle rempeln auf einem Eiswürfel in der Limo.
 * Der Würfel schmilzt in Stufen, das Eis ist glatt. Kniff: Wer rempelt, rutscht selbst – beim
 * Treffer zurück (Rückstoß), beim Fehlstoß weiter nach vorn. In der Schlussphase bleibt drin,
 * wer fällt.
 */
export const EISWUERFEL_SUMO_INFO: MinigameInfo = {
  id: 'eiswuerfel-sumo',
  category: 'physics',
  title: 'Eiswürfel-Sumo',
  tagline: 'Der Würfel schmilzt – wer steht zuletzt noch auf dem Eis?',
  instructions: [
    'Bleib auf dem schmelzenden Eiswürfel: Jede Sekunde zählt.',
    'A rempelt. Rauswurf gibt Punkte, doch du rutschst selbst mit!',
    'Schlussphase: Wer jetzt in die Limo fällt, bleibt drin.',
  ],
  controls: { joystick: 'Rutschen', a: 'Rempeln', b: null },
  durationMs: 30_000,
  physics: true,
  scoring: 'higher',
  scoreUnit: 'Punkte',
  family: 'rempeln-schubsen',
  ipadZone: true,
};
