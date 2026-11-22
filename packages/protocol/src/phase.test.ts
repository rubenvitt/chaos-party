import { describe, expect, it } from 'vitest';
import { INPUT_INTENT_TYPES, isInputIntentType, isIntentAllowed } from './phase.ts';
import type { ClientMessageType, Phase } from './types.ts';

/** Erwartete Matrix: Nachrichtentyp → erlaubt in [lobby, play, board]. */
const MATRIX: Record<ClientMessageType, [lobby: boolean, play: boolean, board: boolean]> = {
  join: [true, false, false],
  reconnect: [true, true, true],
  ready: [true, false, true],
  // Brettphase: nur während eines Minispiels angeboten (prüft die Session über den Kontext).
  move: [false, true, true],
  press: [false, true, true],
  release: [false, true, true],
  gesture: [false, true, false],
  reaction: [false, true, false],
  heartbeat: [true, true, true],
  'host-hello': [true, true, true],
  // v4-Nachtrag (CHAOS-68): Szene geladen; der Server wertet sie nur nach einer Auto-Pause aus.
  'host-ready': [true, true, true],
  start: [true, false, false],
  choose: [false, false, true],
  rate: [false, false, true],
  'minigame-result': [false, false, true],
  'minigame-cue': [false, false, true],
  // v4 (ADR-015)
  'pick-character': [true, false, false],
  configure: [true, false, false],
  // v4-Nachtrag (CHAOS-179): KI-Plätze verwalten.
  'ai-seat': [true, false, false],
  pause: [false, false, true],
  resume: [false, false, true],
  'end-game': [false, false, true],
  rematch: [false, false, true],
};

const PHASE_INDEX: Record<Phase, 0 | 1 | 2> = { lobby: 0, play: 1, board: 2 };

describe('isIntentAllowed', () => {
  const cases = Object.entries(MATRIX).flatMap(([type, allowed]) =>
    (Object.keys(PHASE_INDEX) as Phase[]).map(
      (phase) => [phase, type as ClientMessageType, allowed[PHASE_INDEX[phase]]] as const,
    ),
  );

  it.each(cases)('%s / %s → %s', (phase, type, expected) => {
    expect(isIntentAllowed(phase, type)).toBe(expected);
  });
});

describe('isInputIntentType', () => {
  it('erkennt genau die weitergeleiteten Spieleingaben', () => {
    expect(INPUT_INTENT_TYPES).toEqual(['move', 'press', 'release', 'gesture', 'reaction']);
    for (const type of INPUT_INTENT_TYPES) {
      expect(isInputIntentType(type)).toBe(true);
      expect(isIntentAllowed('play', type)).toBe(true);
      expect(isIntentAllowed('lobby', type)).toBe(false);
    }
    for (const type of ['join', 'ready', 'heartbeat', 'start', 'toString', '__proto__']) {
      expect(isInputIntentType(type)).toBe(false);
    }
  });
});
