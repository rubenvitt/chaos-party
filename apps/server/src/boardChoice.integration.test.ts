/**
 * Brett-Auswahl in der Lobby (CHAOS-197) über die echte Session (Host, Controller, künstliche
 * Uhr): Die Lobby nennt Wahl und wählbare Bretter, `configure.board` stellt um, unbekannte
 * Bretter lehnt der Server ab, und die Partie läuft auf dem gewählten bzw. ausgelosten Brett.
 */
import { BOARD_REGISTRY, DEFAULT_BOARD } from '@chaos-party/game-core';
import { RANDOM_BOARD, RANDOM_BOARD_NAME } from '@chaos-party/protocol';
import { describe, expect, it } from 'vitest';
import {
  boardChoiceName,
  boardChoices,
  isBoardChoice,
  lobbyBoards,
  resolveBoardChoice,
} from './boardChoice.ts';
import { Session } from './session.ts';
import { Harness, HOST } from './testHarness.ts';

const SEED = 7;

function lobby(game: { boardId?: string } = {}): Harness {
  const h = new Harness({ game: { seed: SEED, rounds: 2, minigames: [], ...game } });
  h.host();
  for (const id of [1, 2]) h.join(id);
  return h;
}

function startAndPlayedBoard(h: Harness): string | undefined {
  for (const id of [1, 2]) h.ready(id);
  h.start();
  return h.boards.at(-1)?.view.boardId;
}

describe('Brett-Auswahl in der Lobby (CHAOS-197)', () => {
  it('Standard: Wackelwald gewählt, Lobby listet alle Bretter aus dem Register', () => {
    const h = lobby();
    const settings = h.lobby?.settings;
    expect(settings?.board).toBe(DEFAULT_BOARD.id);
    expect(settings?.boards?.map((b) => b.id)).toEqual(BOARD_REGISTRY.map((info) => info.id));
    expect(settings?.boards?.[0]).toEqual({
      id: 'wackelwald',
      name: 'Wackelwald',
      tagline: BOARD_REGISTRY[0]?.tagline,
      spaces: DEFAULT_BOARD.spaces.length,
      recommendedRounds: BOARD_REGISTRY[0]?.recommendedRounds,
    });
    expect(h.session.snapshot().board).toBe('wackelwald');
  });

  it('Controller sehen das gewählte Brett im Lobby-Kontext', () => {
    const h = lobby();
    expect(h.contexts.get(1)?.context.lobby?.board).toEqual({
      id: 'wackelwald',
      name: 'Wackelwald',
    });
    h.configureBoard(RANDOM_BOARD);
    for (const slot of [1, 2] as const) {
      expect(h.contexts.get(slot)?.context.lobby?.board).toEqual({
        id: RANDOM_BOARD,
        name: RANDOM_BOARD_NAME,
      });
    }
  });

  it('Mit nur Wackelwald läuft alles wie bisher: Partie auf dem Standardbrett', () => {
    const h = lobby();
    expect(startAndPlayedBoard(h)).toBe(DEFAULT_BOARD.id);
    h.runToEnd();
    expect(h.gamePhase).toBe('game-results');
  });

  it('Gewähltes Brett kommt in der Partie an (BoardView.boardId)', () => {
    const h = lobby();
    h.configureBoard('wackelwald');
    expect(h.errors).toEqual([]);
    expect(startAndPlayedBoard(h)).toBe('wackelwald');
  });

  it('Zufall: Lobby meldet „zufall“, die Partie spielt ein Brett aus dem Register', () => {
    const h = lobby();
    h.configureBoard(RANDOM_BOARD);
    expect(h.lobby?.settings.board).toBe(RANDOM_BOARD);
    const played = startAndPlayedBoard(h);
    expect(played).toBe(resolveBoardChoice(RANDOM_BOARD, SEED).id);
    expect(BOARD_REGISTRY.map((info) => info.id)).toContain(played);
    // Die Wahl bleibt „zufall“ (die Revanche lost neu), nur die Partie hat ein festes Brett.
    expect(h.session.snapshot().board).toBe(RANDOM_BOARD);
  });

  it('weist unbekannte und kaputte Brett-IDs ab und behält die Wahl', () => {
    const h = lobby();
    h.configureBoard('gibt-es-nicht');
    expect(h.errors.at(-1)).toEqual({ to: HOST, code: 'bad-message' });
    for (const board of ['Wackelwald', '', 'a'.repeat(33), 7]) {
      h.send(HOST, { v: 4, type: 'configure', board } as never);
      expect(h.errors.at(-1)).toEqual({ to: HOST, code: 'bad-message' });
    }
    expect(h.lobby?.settings.board).toBe('wackelwald');
    expect(h.session.snapshot().board).toBe('wackelwald');
  });

  it('configure mit Runden und Brett in einer Nachricht; unbekanntes Brett ändert auch Runden nicht', () => {
    const h = lobby();
    h.send(HOST, { v: 4, type: 'configure', rounds: 6, board: RANDOM_BOARD });
    expect(h.lobby?.settings).toMatchObject({ rounds: 6, board: RANDOM_BOARD });
    // Runden kommen vor dem Brett; ein unbekanntes Brett lehnt nur das Brett ab.
    h.send(HOST, { v: 4, type: 'configure', rounds: 8, board: 'gibt-es-nicht' });
    expect(h.errors.at(-1)).toEqual({ to: HOST, code: 'bad-message' });
    expect(h.lobby?.settings).toMatchObject({ rounds: 8, board: RANDOM_BOARD });
  });

  it('gleiche Wahl schickt keine neue Lobby; im Spiel ist configure nicht erlaubt', () => {
    const h = lobby();
    const lobbies = h.lobbies.length;
    h.configureBoard('wackelwald');
    expect(h.lobbies.length).toBe(lobbies);
    startAndPlayedBoard(h);
    h.configureBoard(RANDOM_BOARD);
    expect(h.errors.at(-1)).toEqual({ to: HOST, code: 'out-of-phase' });
    expect(h.session.snapshot().board).toBe('wackelwald');
  });

  it('Revanche übernimmt die Wahl', () => {
    const h = lobby();
    h.configureBoard(RANDOM_BOARD);
    startAndPlayedBoard(h);
    h.runToEnd();
    h.rematch();
    expect(h.session.phase).toBe('lobby');
    expect(h.lobby?.settings.board).toBe(RANDOM_BOARD);
  });

  it('Brett-Wahl zu Beginn aus den Einstellungen (BRETT); unbekanntes Brett wirft', () => {
    expect(lobby({ boardId: RANDOM_BOARD }).lobby?.settings.board).toBe(RANDOM_BOARD);
    expect(() => new Session({ joinCode: 'ABCD', game: { boardId: 'gibt-es-nicht' } })).toThrow(
      /Unbekanntes Brett/,
    );
  });
});

describe('boardChoice (CHAOS-197)', () => {
  it('kennt Register und Zufall', () => {
    expect(isBoardChoice('wackelwald')).toBe(true);
    expect(isBoardChoice(RANDOM_BOARD)).toBe(true);
    expect(isBoardChoice('gibt-es-nicht')).toBe(false);
    expect(isBoardChoice('toString')).toBe(false);
    expect(boardChoices()).toEqual([...BOARD_REGISTRY.map((info) => info.id), RANDOM_BOARD]);
    expect(boardChoiceName('wackelwald')).toBe('Wackelwald');
    expect(boardChoiceName(RANDOM_BOARD)).toBe(RANDOM_BOARD_NAME);
    expect(() => resolveBoardChoice('gibt-es-nicht', 1)).toThrow(/Unbekanntes Brett/);
  });

  it('kein Brett heißt wie die Zufallswahl', () => {
    expect(lobbyBoards().map((b) => b.id)).not.toContain(RANDOM_BOARD);
  });
});
