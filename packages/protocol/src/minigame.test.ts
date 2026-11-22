import { describe, expect, it } from 'vitest';
import {
  createMessage,
  parseHostMessage,
  parseServerToControllerMessage,
  parseServerToHostMessage,
} from './parse.ts';
import { PROTOCOL_VERSION } from './version.ts';

const placements = [
  { slot: 2, place: 1, score: 12 },
  { slot: 1, place: 2, score: 4 },
] as const;

describe('Protokoll v3: Minispiele', () => {
  it('nimmt ein Minispiel-Ergebnis vom Host an', () => {
    const message = createMessage('minigame-result', {
      minigameId: 'wackel-floss',
      round: 2,
      placements: [...placements],
      highlights: ['Orange blieb am längsten oben'],
    });
    expect(parseHostMessage(message)).toEqual({ ok: true, message });
    expect(message.v).toBe(PROTOCOL_VERSION);
  });

  it.each([
    ['doppelter Slot', { placements: [placements[0], placements[0]] }],
    ['leere Wertung', { placements: [] }],
    ['Platz 0', { placements: [{ slot: 1, place: 0, score: 1 }] }],
    ['Kommazahl', { placements: [{ slot: 1, place: 1, score: 1.5 }] }],
    ['ID mit Großbuchstaben', { minigameId: 'Floss' }],
    ['Höhepunkt mit Steuerzeichen', { highlights: ['a‮b'] }],
    ['unbekanntes Feld', { cheat: true }],
  ])('lehnt ein kaputtes Ergebnis ab: %s', (_name, patch) => {
    const raw = {
      v: PROTOCOL_VERSION,
      type: 'minigame-result',
      minigameId: 'wackel-floss',
      round: 1,
      placements: [...placements],
      ...patch,
    };
    expect(parseHostMessage(raw).ok).toBe(false);
  });

  it('trägt Minispiel-Anleitung und Bedienung im Controller-Kontext', () => {
    const message = createMessage('context', {
      slot: 1,
      phase: 'board',
      layout: 'joystick-buttons',
      actions: ['move', 'button-a'],
      minigame: {
        id: 'flink-flitzer',
        title: 'Flink-Flitzer',
        tagline: 'Sammelt die meisten Sterne!',
        instructions: ['Lauf mit dem Joystick.', 'A = Sprung'],
        controls: { joystick: 'Laufen', a: 'Springen', b: null },
        stage: 'play',
        scoreUnit: 'Sterne',
        tied: false,
        aborted: false,
      },
    });
    expect(parseServerToControllerMessage(message).ok).toBe(true);
  });

  it('trägt das Minispiel im Brett-Stand und die neuen Ereignisse', () => {
    const message = createMessage('board', {
      view: {
        boardId: 'wackelwald',
        gamePhase: 'minigame-results',
        round: 1,
        rounds: 5,
        turnOrder: [1, 2],
        activeSlot: null,
        players: [],
        trophySpaces: [],
        trophyPrice: 15,
        traps: [],
        prompt: null,
        remainingMs: 1000,
        stepMs: 350,
        ranking: null,
        minigame: {
          id: 'wackel-floss',
          round: 1,
          seed: 4_294_967_295,
          playMs: 30_000,
          elapsedMs: 30_100,
          placements: [...placements],
          highlights: [],
          aborted: false,
          rewards: [
            { slot: 2, coins: 10 },
            { slot: 1, coins: 5 },
          ],
        },
        paused: false,
        endedEarly: false,
      },
      events: [
        { type: 'minigame-started', minigame: 'wackel-floss' },
        { type: 'minigame-results', ranking: [2, 1], placements: [...placements], aborted: false },
      ],
      eventSeq: 10,
    });
    expect(parseServerToHostMessage(message).ok).toBe(true);
  });

  it('v4-Nachtrag (CHAOS-66): `repeat` optional im Controller-Kontext und Brett-Stand', () => {
    const minigame = {
      id: 'flink-flitzer',
      title: 'Flink-Flitzer',
      tagline: 'Sammelt die meisten Sterne!',
      instructions: ['Lauf mit dem Joystick.'],
      controls: { joystick: 'Laufen', a: null, b: null },
      stage: 'intro' as const,
      scoreUnit: 'Sterne',
      tied: false,
      aborted: false,
    };
    const context = (extra: object) =>
      createMessage('context', {
        slot: 1,
        phase: 'board',
        layout: 'joystick-buttons',
        actions: [],
        minigame: { ...minigame, ...extra },
      });
    expect(parseServerToControllerMessage(context({ repeat: true })).ok).toBe(true);
    expect(parseServerToControllerMessage(context({ repeat: false })).ok).toBe(true);
    expect(parseServerToControllerMessage(context({})).ok).toBe(true);
    expect(parseServerToControllerMessage(context({ repeat: 'ja' })).ok).toBe(false);

    const board = (extra: object) => ({
      v: PROTOCOL_VERSION,
      type: 'board',
      view: {
        boardId: 'wackelwald',
        gamePhase: 'minigame-intro',
        round: 4,
        rounds: 10,
        turnOrder: [1, 2],
        activeSlot: null,
        players: [],
        trophySpaces: [],
        trophyPrice: 15,
        traps: [],
        prompt: null,
        remainingMs: 3000,
        stepMs: 350,
        ranking: null,
        minigame: {
          id: 'wackel-floss',
          round: 4,
          seed: 7,
          playMs: 30_000,
          elapsedMs: null,
          placements: null,
          highlights: [],
          aborted: false,
          rewards: null,
          ...extra,
        },
        paused: false,
        endedEarly: false,
      },
      events: [],
      eventSeq: 1,
    });
    expect(parseServerToHostMessage(board({ repeat: true })).ok).toBe(true);
    expect(parseServerToHostMessage(board({})).ok).toBe(true);
    expect(parseServerToHostMessage(board({ repeat: 1 })).ok).toBe(false);
  });
});

describe('v4-Nachtrag CHAOS-231: Hinweis des laufenden Abschnitts', () => {
  const cue = {
    step: 1,
    steps: 5,
    icon: '🍝',
    word: 'SCHLÜRFEN!',
    controls: { joystick: null, a: 'Schlürfen', b: null },
    double: false,
  };

  it('nimmt minigame-cue vom Host an, auch `null` (kein Hinweis mehr)', () => {
    const message = createMessage('minigame-cue', { minigameId: 'schnellfeuer', round: 3, cue });
    expect(parseHostMessage(message)).toEqual({ ok: true, message });
    const none = createMessage('minigame-cue', { minigameId: 'schnellfeuer', round: 3, cue: null });
    expect(parseHostMessage(none).ok).toBe(true);
  });

  it.each([
    ['Abschnitt hinter dem Ende', { step: 5 }],
    ['keine Abschnitte', { steps: 0 }],
    ['ohne Bedienung', { controls: { joystick: null, a: null, b: null } }],
    ['Bildwort zu lang', { word: 'SCHLÜRFENSCHLÜRFEN!' }],
    ['Leerraum am Rand', { word: ' HAUEN!' }],
    ['leeres Piktogramm', { icon: '' }],
    ['ohne double', { double: undefined }],
    ['unbekanntes Feld', { hint: 'x' }],
  ])('lehnt einen kaputten Hinweis ab: %s', (_name, patch) => {
    const raw = {
      v: PROTOCOL_VERSION,
      type: 'minigame-cue',
      minigameId: 'schnellfeuer',
      round: 1,
      cue: { ...cue, ...patch },
    };
    expect(parseHostMessage(raw).ok).toBe(false);
  });

  it('trägt den Hinweis optional im Minispiel-Kontext des Controllers', () => {
    const minigame = {
      id: 'schnellfeuer',
      title: 'Schnellfeuer!',
      tagline: 'Fünf Mikro-Spiele am Stück.',
      instructions: ['Das Bildwort sagt, was zu tun ist.'],
      controls: { joystick: 'Zielen', a: 'Los!', b: null },
      stage: 'play' as const,
      scoreUnit: 'Punkte',
      tied: false,
      aborted: false,
    };
    const context = (extra: object) =>
      createMessage('context', {
        slot: 1,
        phase: 'board',
        layout: 'joystick-buttons',
        actions: ['move', 'button-a'],
        minigame: { ...minigame, ...extra },
      });
    expect(parseServerToControllerMessage(context({ cue })).ok).toBe(true);
    expect(parseServerToControllerMessage(context({})).ok).toBe(true);
    expect(parseServerToControllerMessage(context({ cue: { ...cue, double: 'ja' } })).ok).toBe(
      false,
    );
  });
});
