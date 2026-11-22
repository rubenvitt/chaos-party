/**
 * v4-Nachtrag KI-Plätze (CHAOS-179, ADR-020 §10): Platzart und Stärke an `LobbyPlayer` und
 * `BoardPlayer`, Persönlichkeit an `BoardPlayer`, Controller-Nachricht `ai-seat`, `configure.aiSeat`
 * und Spielleitung/Plätze im Lobby-Kontext. Alles additiv und optional.
 */
import { describe, expect, it } from 'vitest';
import {
  createMessage,
  encode,
  parseClientMessage,
  parseControllerMessage,
  parseHostMessage,
  parseServerToControllerMessage,
  parseServerToHostMessage,
} from './parse.ts';
import { isIntentAllowed } from './phase.ts';
import { AI_PERSONALITIES, AI_STRENGTHS, DEFAULT_AI_STRENGTH, ERROR_CODES } from './schemas.ts';
import type { BoardPlayer, BoardView, LobbyPlayer } from './types.ts';

const SETTINGS = { rounds: 5, roundPresets: [3, 5, 8] };

const HUMAN: LobbyPlayer = {
  slot: 1,
  color: '#0072B2',
  label: 'Anna',
  connected: true,
  ready: false,
  character: null,
};

const AI: LobbyPlayer = {
  slot: 3,
  color: '#009E73',
  label: 'KI Grün',
  connected: true,
  ready: true,
  character: null,
  kind: 'ai',
  strength: 'schwer',
};

function lobbyWith(players: unknown[]): string {
  return encode({
    ...createMessage('lobby', {
      joinCode: 'AB12',
      phase: 'lobby',
      players: [],
      settings: SETTINGS,
    }),
    players,
  } as never);
}

function boardPlayer(patch: Partial<BoardPlayer> = {}): BoardPlayer {
  return {
    slot: 2,
    name: 'Schraubi',
    spaceId: 's01',
    coins: 5,
    trophies: 0,
    items: [],
    connected: true,
    character: 'robot',
    minigameWins: 0,
    stats: { coinsEarned: 0, coinsLost: 0, spacesMoved: 0, itemsUsed: 0 },
    ...patch,
  };
}

function boardWith(players: unknown[]): string {
  const view: BoardView = {
    boardId: 'wackelwald',
    gamePhase: 'roll',
    round: 1,
    rounds: 5,
    turnOrder: [1, 2],
    activeSlot: 1,
    players: [],
    trophySpaces: [],
    trophyPrice: 15,
    traps: [],
    prompt: null,
    remainingMs: null,
    stepMs: 350,
    ranking: null,
    minigame: null,
    paused: false,
    endedEarly: false,
  };
  return encode({
    ...createMessage('board', { view, events: [], eventSeq: 0 }),
    view: { ...view, players },
  } as never);
}

describe('Aufzählungen', () => {
  it('Stärken mit Standard mittel, vier Persönlichkeiten, Fehler not-lead', () => {
    expect(AI_STRENGTHS).toEqual(['leicht', 'mittel', 'schwer', 'dynamisch']);
    expect(DEFAULT_AI_STRENGTH).toBe('mittel');
    expect(AI_PERSONALITIES).toHaveLength(4);
    expect(ERROR_CODES).toContain('not-lead');
  });
});

describe('LobbyPlayer mit Platzart', () => {
  it('Mensch ohne kind (wie bisher) und KI mit Stärke sind gültig', () => {
    expect(parseServerToHostMessage(lobbyWith([HUMAN, AI])).ok).toBe(true);
  });

  it.each([
    ['KI ohne Stärke', { ...AI, strength: undefined }],
    ['Stärke ohne kind', { ...HUMAN, strength: 'leicht' }],
    ['Stärke beim Menschen', { ...HUMAN, kind: 'human', strength: 'leicht' }],
    ['unbekannte Stärke', { ...AI, strength: 'unfehlbar' }],
    ['unbekannte Art', { ...AI, kind: 'bot' }],
  ])('lehnt ab: %s', (_name, player) => {
    expect(parseServerToHostMessage(lobbyWith([HUMAN, player])).ok).toBe(false);
  });
});

describe('BoardPlayer mit Platzart', () => {
  it('KI mit Stärke und Persönlichkeit, KI ohne Persönlichkeit, Mensch ohne Felder', () => {
    expect(
      parseServerToHostMessage(
        boardWith([
          boardPlayer({ slot: 1, character: 'sock' }),
          {
            ...boardPlayer({ kind: 'ai', strength: 'dynamisch', personality: 'fuchs' }),
            strengthLevel: 0.375,
          },
          boardPlayer({ slot: 3, character: 'cactus', kind: 'ai', strength: 'leicht' }),
        ]),
      ).ok,
    ).toBe(true);
  });

  it.each([
    ['Persönlichkeit beim Menschen', boardPlayer({ personality: 'saboteur' })],
    ['KI ohne Stärke', boardPlayer({ kind: 'ai' })],
    [
      'dynamisch ohne strengthLevel (CHAOS-187)',
      boardPlayer({ kind: 'ai', strength: 'dynamisch' }),
    ],
    [
      'strengthLevel bei fester Stufe',
      { ...boardPlayer({ kind: 'ai', strength: 'schwer' }), strengthLevel: 1 },
    ],
    ['strengthLevel beim Menschen', { ...boardPlayer({}), strengthLevel: 0.5 }],
    [
      'strengthLevel über 1',
      { ...boardPlayer({ kind: 'ai', strength: 'dynamisch' }), strengthLevel: 1.25 },
    ],
    [
      'unbekannte Persönlichkeit',
      { ...boardPlayer({ kind: 'ai', strength: 'mittel' }), personality: 'troll' },
    ],
  ])('lehnt ab: %s', (_name, player) => {
    expect(parseServerToHostMessage(boardWith([player])).ok).toBe(false);
  });
});

describe('ai-seat (Controller → Server)', () => {
  it('setzt, ändert und entfernt (strength null) – nur in der Lobby', () => {
    for (const strength of [...AI_STRENGTHS, null]) {
      const message = createMessage('ai-seat', { slot: 1, seq: 4, seat: 3, strength });
      expect(parseControllerMessage(encode(message)).ok).toBe(true);
      expect(parseClientMessage(encode(message)).ok).toBe(true);
    }
    expect(isIntentAllowed('lobby', 'ai-seat')).toBe(true);
    expect(isIntentAllowed('board', 'ai-seat')).toBe(false);
    expect(isIntentAllowed('play', 'ai-seat')).toBe(false);
  });

  it.each([
    ['ohne strength', { slot: 1, seq: 1, seat: 2 }],
    ['ohne seat', { slot: 1, seq: 1, strength: 'mittel' }],
    ['Platz 5', { slot: 1, seq: 1, seat: 5, strength: 'mittel' }],
    ['unbekannte Stärke', { slot: 1, seq: 1, seat: 2, strength: 'brutal' }],
    ['ohne seq', { slot: 1, seat: 2, strength: 'mittel' }],
    ['Zusatzfeld', { slot: 1, seq: 1, seat: 2, strength: 'mittel', personality: 'fuchs' }],
  ])('lehnt ab: %s', (_name, body) => {
    expect(parseControllerMessage(JSON.stringify({ v: 4, type: 'ai-seat', ...body })).ok).toBe(
      false,
    );
  });

  it('ist keine Host-Nachricht', () => {
    const message = createMessage('ai-seat', { slot: 1, seq: 1, seat: 2, strength: 'mittel' });
    expect(parseHostMessage(encode(message)).ok).toBe(false);
  });
});

describe('configure.aiSeat (Host → Server)', () => {
  it('allein reicht für configure, strength null entfernt', () => {
    for (const strength of ['leicht', null] as const) {
      const message = createMessage('configure', { aiSeat: { seat: 4, strength } });
      expect(parseHostMessage(encode(message)).ok).toBe(true);
    }
  });

  it.each([
    ['Platz 0', { seat: 0, strength: 'mittel' }],
    ['ohne strength', { seat: 2 }],
    ['Zusatzfeld', { seat: 2, strength: 'mittel', name: 'Bot' }],
  ])('lehnt ab: %s', (_name, aiSeat) => {
    expect(parseHostMessage(JSON.stringify({ v: 4, type: 'configure', aiSeat })).ok).toBe(false);
  });
});

describe('Lobby-Kontext mit Spielleitung und Plätzen', () => {
  const base = {
    character: null,
    takenCharacters: [],
    rounds: 5,
  };

  it('lead und seats sind optional und gültig', () => {
    const message = createMessage('context', {
      slot: 1,
      phase: 'lobby',
      layout: 'lobby',
      actions: ['ready', 'pick-character'],
      lobby: {
        ...base,
        lead: true,
        seats: [
          { slot: 1, kind: 'human' },
          { slot: 3, kind: 'ai', strength: 'mittel' },
        ],
      },
    });
    expect(parseServerToControllerMessage(encode(message)).ok).toBe(true);
    const old = createMessage('context', {
      slot: 1,
      phase: 'lobby',
      layout: 'lobby',
      actions: ['ready'],
      lobby: base,
    });
    expect(parseServerToControllerMessage(encode(old)).ok).toBe(true);
  });

  it.each([
    ['Mensch mit Stärke', [{ slot: 1, kind: 'human', strength: 'leicht' }]],
    ['KI ohne Stärke', [{ slot: 2, kind: 'ai' }]],
    [
      'Platz doppelt',
      [
        { slot: 2, kind: 'human' },
        { slot: 2, kind: 'ai', strength: 'mittel' },
      ],
    ],
  ])('lehnt ab: %s', (_name, seats) => {
    const message = {
      ...createMessage('context', {
        slot: 1,
        phase: 'lobby',
        layout: 'lobby',
        actions: [],
        lobby: base,
      }),
      lobby: { ...base, seats },
    };
    expect(parseServerToControllerMessage(encode(message as never)).ok).toBe(false);
  });
});

describe('Brett-Kontext mit Platz am Zug (CHAOS-239)', () => {
  const board = {
    gamePhase: 'turn-start' as const,
    round: 2,
    rounds: 5,
    coins: 0,
    trophies: 0,
    items: [],
    activeSlot: 3 as const,
    paused: false,
    character: 'robot' as const,
    minigameWins: 0,
  };
  const context = (info: object) => ({
    ...createMessage('context', { slot: 1, phase: 'board', layout: 'board', actions: [] }),
    board: info,
  });

  it('activeSeat ist optional; KI und Mensch sind gültig', () => {
    for (const info of [
      board,
      { ...board, activeSeat: { name: 'Schraubi', kind: 'ai' } },
      { ...board, activeSeat: { name: 'Ben', kind: 'human' } },
    ]) {
      expect(parseServerToControllerMessage(encode(context(info) as never)).ok).toBe(true);
    }
  });

  it.each([
    ['unbekannte Art', { name: 'Schraubi', kind: 'bot' }],
    ['leerer Name', { name: '', kind: 'ai' }],
    ['fremdes Feld', { name: 'Schraubi', kind: 'ai', strength: 'mittel' }],
  ])('lehnt ab: %s', (_name, activeSeat) => {
    const message = context({ ...board, activeSeat });
    expect(parseServerToControllerMessage(encode(message as never)).ok).toBe(false);
  });
});
