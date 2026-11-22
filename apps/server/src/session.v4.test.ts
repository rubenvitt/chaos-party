/**
 * Session-Tests für Protokoll v4 (M4, ADR-015): Figurenwahl, Rundenzahl, Pause/Fortsetzen/
 * Beenden, Revanche, Minispiel-Bestätigung und Reconnect in allen neuen Zuständen.
 * Läuft über den synthetischen Host/Controller aus `testHarness.ts` (künstliche Uhr).
 */
import { createMessage, type ContextMessage, type SlotNumber } from '@chaos-party/protocol';
import { rankByScore } from '@chaos-party/minigame-sdk';
import { getMinigameInfo, rotationInfos } from '@chaos-party/minigames/catalog';
import { DEFAULT_RULES, withRules, withTailwind } from '@chaos-party/game-core';
import { describe, expect, it } from 'vitest';
import { lobbyBoards } from './boardChoice.ts';
import { Harness, HOST, INTEGRATION_SEEDS, setupMinigameGame, TICK_MS } from './testHarness.ts';

function lobbyHarness(players: number, options: ConstructorParameters<typeof Harness>[0] = {}) {
  const h = new Harness({ game: { seed: 11, rounds: 2, minigames: [] }, ...options });
  h.host();
  for (let id = 1; id <= players; id++) h.join(id);
  return h;
}

function context(h: Harness, slot: SlotNumber): ContextMessage {
  const entry = h.contexts.get(slot);
  if (!entry) throw new Error(`kein Kontext für Slot ${String(slot)}`);
  return entry.context;
}

function lobbyCharacters(h: Harness): [number, string | null][] {
  return (h.lobby?.players ?? []).map((p) => [p.slot, p.character]);
}

describe('Figurenwahl (CHAOS-36)', () => {
  it('Lobby-Kontext bietet die Wahl an; Wahl erscheint am PC und als vergeben bei den anderen', () => {
    const h = lobbyHarness(2);
    expect(context(h, 1)).toMatchObject({
      layout: 'lobby',
      actions: ['ready', 'pick-character'],
      lobby: { character: null, takenCharacters: [], rounds: 2 },
    });
    h.pickCharacter(1, 1, 'sock');
    expect(lobbyCharacters(h)).toEqual([
      [1, 'sock'],
      [2, null],
    ]);
    expect(context(h, 1).lobby).toEqual({
      character: 'sock',
      takenCharacters: [],
      takenBy: [],
      rounds: 2,
      board: { id: 'wackelwald', name: 'Wackelwald' },
      lead: true,
      seats: [
        { slot: 1, kind: 'human' },
        { slot: 2, kind: 'human' },
      ],
    });
    expect(context(h, 2).lobby).toEqual({
      character: null,
      takenCharacters: ['sock'],
      takenBy: [{ character: 'sock', slot: 1 }],
      rounds: 2,
      board: { id: 'wackelwald', name: 'Wackelwald' },
      lead: false,
      seats: [
        { slot: 1, kind: 'human' },
        { slot: 2, kind: 'human' },
      ],
    });
    expect(h.errors).toEqual([]);
  });

  it('weist eine vergebene Figur mit character-taken ab, ohne etwas zu ändern', () => {
    const h = lobbyHarness(2);
    h.pickCharacter(1, 1, 'raccoon');
    h.pickCharacter(2, 2, 'raccoon');
    expect(h.errors).toEqual([{ to: 2, code: 'character-taken' }]);
    expect(lobbyCharacters(h)).toEqual([
      [1, 'raccoon'],
      [2, null],
    ]);
    // Kein Missbrauch: die Verbindung bleibt, eine freie Figur geht danach.
    h.pickCharacter(2, 2, 'robot');
    expect(lobbyCharacters(h)).toEqual([
      [1, 'raccoon'],
      [2, 'robot'],
    ]);
    expect(h.controller(2).connected).toBe(true);
  });

  it('Umwählen gibt die alte Figur frei und setzt ready zurück; gleiche Figur ist kein Fehler', () => {
    const h = lobbyHarness(2);
    h.pickCharacter(1, 1, 'cactus');
    h.ready(1);
    expect(context(h, 1)).toMatchObject({ layout: 'wait', actions: ['pick-character'] });
    expect(h.lobby?.players[0]?.ready).toBe(true);
    h.pickCharacter(1, 1, 'cactus');
    expect(h.lobby?.players[0]?.ready).toBe(true);
    h.pickCharacter(1, 1, 'sock');
    expect(h.lobby?.players[0]).toMatchObject({ character: 'sock', ready: false });
    expect(context(h, 1)).toMatchObject({ layout: 'lobby', lobby: { character: 'sock' } });
    expect(context(h, 2).lobby?.takenCharacters).toEqual(['sock']);
    h.pickCharacter(2, 2, 'cactus');
    expect(h.errors).toEqual([]);
  });

  it('prüft Slot-Besitz, Phase und Schema', () => {
    const h = lobbyHarness(2);
    const c1 = h.controller(1);
    h.send(1, createMessage('pick-character', { slot: 2, seq: ++c1.seq, character: 'sock' }));
    expect(h.errors.at(-1)).toEqual({ to: 1, code: 'not-your-slot' });
    h.send(1, {
      v: 4,
      type: 'pick-character',
      slot: 1,
      seq: ++c1.seq,
      character: 'drache',
    } as never);
    expect(h.errors.at(-1)).toEqual({ to: 1, code: 'bad-message' });
    h.pickCharacter(1, 1, 'robot');
    h.send(1, createMessage('pick-character', { slot: 1, seq: 0, character: 'sock' }));
    expect(h.errors.at(-1)).toEqual({ to: 1, code: 'stale-seq' });
    expect(h.lobby?.players[0]?.character).toBe('robot');
    for (const id of [1, 2]) h.ready(id);
    h.start();
    h.pickCharacter(1, 1, 'sock');
    expect(h.errors.at(-1)).toEqual({ to: 1, code: 'out-of-phase' });
  });

  it('weist beim Start freie Figuren zu (Standard je Slot bevorzugt) und reicht sie ins Brett', () => {
    const h = lobbyHarness(3);
    h.pickCharacter(1, 1, 'cactus'); // Standard von Slot 2
    h.start();
    // Slot 2: Standard „cactus“ vergeben → erste freie (robot); Slot 3: Standard raccoon.
    expect(lobbyCharacters(h)).toEqual([
      [1, 'cactus'],
      [2, 'robot'],
      [3, 'raccoon'],
    ]);
    const view = h.boards.at(-1)?.view;
    expect(view?.players.map((p) => [p.slot, p.character])).toEqual([
      [1, 'cactus'],
      [2, 'robot'],
      [3, 'raccoon'],
    ]);
    expect(context(h, 2).board?.character).toBe('robot');
  });

  it('getrennter, reservierter Spieler behält seine Figur; Auto-Zuweisung nimmt sie nicht', () => {
    const h = lobbyHarness(2);
    h.pickCharacter(2, 2, 'robot'); // Standard von Slot 1
    h.disconnect(2);
    h.start();
    expect(h.boards.at(-1)?.view.players.map((p) => [p.slot, p.character])).toEqual([
      [1, 'cactus'],
    ]);
    expect(lobbyCharacters(h)).toEqual([
      [1, 'cactus'],
      [2, 'robot'],
    ]);
  });

  it('Figur überlebt Reconnect in der Lobby; nach Ablauf der Schonfrist ist sie frei', () => {
    const h = lobbyHarness(2, { timeouts: { lobbyGraceMs: 1_000 } });
    h.pickCharacter(1, 1, 'sock');
    h.disconnect(1);
    h.reconnect(1, 11);
    expect(context(h, 1).lobby?.character).toBe('sock');
    expect(lobbyCharacters(h)).toEqual([
      [1, 'sock'],
      [2, null],
    ]);
    h.disconnect(11);
    for (let i = 0; i < 1_000 / TICK_MS + 1; i++) h.tick();
    expect(lobbyCharacters(h)).toEqual([[2, null]]);
    expect(context(h, 2).lobby?.takenCharacters).toEqual([]);
    h.pickCharacter(2, 2, 'sock');
    expect(lobbyCharacters(h)).toEqual([[2, 'sock']]);
    expect(h.errors).toEqual([]);
  });
});

describe('Rundenzahl (CHAOS-36)', () => {
  it('lobby trägt Einstellungen; configure ändert sie für PC und Controller; Start nutzt sie', () => {
    const h = lobbyHarness(2);
    expect(h.lobby?.settings).toEqual({
      rounds: 2,
      roundPresets: [10, 16, 20],
      moreReactionTime: false,
      board: 'wackelwald',
      boards: lobbyBoards(),
    });
    h.configure(8);
    expect(h.lobby?.settings.rounds).toBe(8);
    expect(context(h, 1).lobby?.rounds).toBe(8);
    h.start();
    expect(h.boards.at(-1)?.view.rounds).toBe(8);
    expect(h.session.snapshot().rounds).toBe(8);
  });

  it('start.rounds überschreibt und wird zur neuen Einstellung; configure nur in der Lobby', () => {
    const h = lobbyHarness(1);
    h.start(3);
    expect(h.boards.at(-1)?.view.rounds).toBe(3);
    expect(h.lobby?.settings.rounds).toBe(3);
    h.configure(5);
    expect(h.errors.at(-1)).toEqual({ to: HOST, code: 'out-of-phase' });
    h.send(HOST, { v: 4, type: 'configure', rounds: 0 } as never);
    expect(h.errors.at(-1)).toEqual({ to: HOST, code: 'bad-message' });
  });

  it('weist ungültige Einstellungen beim Erzeugen der Session zurück', () => {
    expect(() => new Harness({ game: { rounds: 0 } })).toThrow(/Einstellungen/);
    expect(() => new Harness({ game: { roundPresets: [5, 3] } })).toThrow(/Einstellungen/);
  });
});

describe('Pause, Fortsetzen, Beenden (CHAOS-36)', () => {
  function running(players = 2) {
    const h = lobbyHarness(players);
    h.start();
    h.runUntil((x) => [...x.contexts.values()].some((c) => c.context.prompt !== undefined));
    return h;
  }

  it('pause friert Brett und Controller ein; choose wird mit paused abgewiesen', () => {
    const h = running();
    const [slot, { context: active }] = [...h.contexts.entries()].find(
      ([, c]) => c.context.prompt,
    ) ?? [1, { context: undefined }];
    const prompt = active?.prompt;
    if (!prompt) throw new Error('kein Prompt');
    h.pause();
    const view = h.boards.at(-1)?.view;
    expect(view?.paused).toBe(true);
    for (const s of [1, 2] as const) {
      expect(context(h, s)).toMatchObject({ layout: 'board', actions: [] });
      expect(context(h, s).board?.paused).toBe(true);
    }
    h.choose(h.controllerOf(slot).id, slot, prompt.id, 'roll');
    expect(h.errors.at(-1)).toEqual({ to: h.controllerOf(slot).id, code: 'paused' });
    // Lange Pause: nichts läuft ab, Restzeiten stehen.
    const eventsBefore = h.events.length;
    for (let i = 0; i < 600; i++) h.tick();
    expect(h.events.length).toBe(eventsBefore);
    h.pause();
    expect(h.errors.at(-1)).toEqual({ to: HOST, code: 'paused' });
    h.resume();
    expect(h.boards.at(-1)?.view.paused).toBe(false);
    expect(context(h, slot).actions).toEqual(['choose']);
    h.choose(h.controllerOf(slot).id, slot, prompt.id, 'roll');
    expect(h.events.some((e) => e.type === 'dice-rolled')).toBe(true);
    h.resume();
    expect(h.errors.at(-1)).toEqual({ to: HOST, code: 'out-of-phase' });
  });

  it('Pause/Ende in der Lobby und Ende nach dem Endstand sind out-of-phase', () => {
    const h = lobbyHarness(1);
    h.pause();
    expect(h.errors.at(-1)).toEqual({ to: HOST, code: 'out-of-phase' });
    h.endGame();
    expect(h.errors.at(-1)).toEqual({ to: HOST, code: 'out-of-phase' });
    h.start();
    h.endGame();
    h.endGame();
    expect(h.errors.at(-1)).toEqual({ to: HOST, code: 'out-of-phase' });
    h.pause();
    expect(h.errors.at(-1)).toEqual({ to: HOST, code: 'out-of-phase' });
  });

  it('end-game springt zum Endstand mit endedEarly; Controller sehen Platz und Gleichstand', () => {
    const h = running(3);
    h.pause();
    h.endGame();
    const last = h.boards.at(-1);
    expect(last?.view).toMatchObject({
      gamePhase: 'game-results',
      endedEarly: true,
      paused: false,
    });
    expect(last?.events.at(-1)).toMatchObject({ type: 'game-ended', endedEarly: true });
    for (const slot of [1, 2, 3] as const) {
      const board = context(h, slot).board;
      const entry = last?.view.ranking?.find((r) => r.slot === slot);
      expect(board).toMatchObject({
        gamePhase: 'game-results',
        place: entry?.place,
        tied: entry?.decidedBy === 'shared',
        endedEarly: true,
        paused: false,
      });
    }
  });

  it('Minispiel-Eingaben während der Pause gehen nicht an den Host', () => {
    const id = rotationInfos()[0]?.id ?? 'pump-parade';
    const h = setupMinigameGame(id, 2, INTEGRATION_SEEDS.two, 1);
    h.runUntil((x) => x.gamePhase === 'minigame-play');
    expect(context(h, 1).layout).toBe('joystick-buttons');
    h.pause();
    expect(context(h, 1)).toMatchObject({ layout: 'board', actions: [] });
    expect(context(h, 1).minigame?.stage).toBe('play');
    const c = h.controllerOf(1);
    h.send(c.id, createMessage('press', { slot: 1, seq: ++c.seq, button: 'a' }));
    h.send(c.id, createMessage('move', { slot: 1, seq: ++c.seq, x: 1, y: 0 }));
    expect(h.errors.slice(-2)).toEqual([
      { to: c.id, code: 'paused' },
      { to: c.id, code: 'paused' },
    ]);
    expect(h.hostInputs).toEqual([]);
    // Spielzeit steht: auch weit nach Spielzeit + Schonfrist kein Abbruch.
    const elapsed = h.boards.at(-1)?.view.minigame?.elapsedMs;
    for (let i = 0; i < 1_000; i++) h.tick();
    expect(h.gamePhase).toBe('minigame-play');
    h.reloadHost();
    expect(h.boards.at(-1)?.view.minigame?.elapsedMs).toBe(elapsed);
    h.resume();
    expect(context(h, 1).layout).toBe('joystick-buttons');
  });
});

describe('Revanche (CHAOS-37)', () => {
  it('nur nach dem Endstand; zurück in die Lobby mit Figuren, ready zurückgesetzt, neuer Seed', () => {
    const seeds = [101, 202];
    const h = new Harness({
      game: { rounds: 1, minigames: [] },
      randomSeed: () => seeds.shift() ?? 0,
    });
    h.host();
    h.join(1);
    h.join(2);
    h.pickCharacter(1, 1, 'sock');
    for (const id of [1, 2]) h.ready(id);
    h.start();
    h.rematch();
    expect(h.errors.at(-1)).toEqual({ to: HOST, code: 'out-of-phase' });
    expect(h.session.snapshot().game?.seed).toBe(101);
    h.runToEnd();
    h.rematch();
    expect(h.session.phase).toBe('lobby');
    expect(h.lobby).toMatchObject({ phase: 'lobby' });
    expect(h.lobby?.players.map((p) => [p.slot, p.character, p.ready])).toEqual([
      [1, 'sock', false],
      [2, 'cactus', false],
    ]);
    expect(context(h, 1)).toMatchObject({
      phase: 'lobby',
      layout: 'lobby',
      lobby: { character: 'sock', takenCharacters: ['cactus'] },
    });
    expect(context(h, 1).board).toBeUndefined();
    // Neue Partie mit neuem Seed; Figurenwahl ist wieder möglich.
    h.pickCharacter(2, 2, 'raccoon');
    h.start();
    expect(h.session.snapshot().game?.seed).toBe(202);
    expect(h.boards.at(-1)?.view.players.map((p) => p.character)).toEqual(['sock', 'raccoon']);
    expect(h.boards.at(-1)?.view.round).toBe(1);
    expect(h.errors.filter((e) => e.to !== HOST)).toEqual([]);
  });

  it('getrennte Spieler bekommen nach der Revanche eine frische Lobby-Schonfrist', () => {
    const h = new Harness({
      game: { seed: 5, rounds: 1, minigames: [] },
      timeouts: { lobbyGraceMs: 2_000 },
    });
    h.host();
    h.join(1);
    h.join(2);
    h.start();
    h.disconnect(2);
    h.runToEnd();
    // Weit länger getrennt als die Schonfrist – erst ab der Revanche zählt sie.
    h.rematch();
    h.tick();
    expect(h.lobby?.players.map((p) => [p.slot, p.connected])).toEqual([
      [1, true],
      [2, false],
    ]);
    h.reconnect(2, 22);
    expect(context(h, 2)).toMatchObject({ phase: 'lobby', lobby: { character: 'cactus' } });
  });
});

describe('Reconnect in den neuen Zuständen (ADR-009/014)', () => {
  it('Pause, Endstand und nach der Revanche: Kontext stimmt sofort nach reconnect', () => {
    const h = lobbyHarness(2);
    h.pickCharacter(2, 2, 'sock');
    h.start();
    h.runUntil((x) => x.gamePhase === 'roll');
    h.pause();
    h.disconnect(2);
    h.reconnect(2, 22);
    expect(context(h, 2).board).toMatchObject({ paused: true, character: 'sock' });
    expect(context(h, 2).actions).toEqual([]);
    h.endGame();
    h.disconnect(22);
    h.reconnect(22, 23);
    expect(context(h, 2).board).toMatchObject({ gamePhase: 'game-results', endedEarly: true });
    expect(context(h, 2).board?.place).toBeGreaterThanOrEqual(1);
    h.rematch();
    h.disconnect(23);
    h.reconnect(23, 24);
    expect(context(h, 2)).toMatchObject({
      phase: 'lobby',
      lobby: { character: 'sock', takenCharacters: ['robot'] },
    });
  });
});

describe('Trostpreis nach dem Minispiel (CHAOS-51, EXP-019)', () => {
  it('Letzte(r) bekommt ein Item: im Stand (rewards.items) und im eigenen Kontext (prizes)', () => {
    const id = rotationInfos()[0]?.id ?? 'pump-parade';
    const h = setupMinigameGame(id, 2, INTEGRATION_SEEDS.two, 1);
    h.runUntil((x) => x.gamePhase === 'minigame-play');
    const minigame = h.boards.at(-1)?.view.minigame;
    if (!minigame) throw new Error('kein Minispiel');
    const info = getMinigameInfo(minigame.id);
    h.send(
      HOST,
      createMessage('minigame-result', {
        minigameId: minigame.id,
        round: minigame.round,
        placements: rankByScore(
          [
            { slot: 1, score: 9 },
            { slot: 2, score: 1 },
          ],
          info?.scoring,
        ),
      }),
    );
    const view = h.boards.at(-1)?.view;
    const rewards = view?.minigame?.rewards ?? [];
    const loser = rewards.find((r) => r.slot !== rewards[0]?.slot);
    const winner = rewards[0];
    expect(winner?.items).toBeUndefined();
    expect(loser?.items).toHaveLength(1);
    const prize = loser?.items?.[0];
    if (!loser || !prize) throw new Error('kein Trostpreis');
    expect(view?.players.find((p) => p.slot === loser.slot)?.items).toContain(prize);
    expect(context(h, loser.slot).minigame).toMatchObject({ stage: 'results', prizes: [prize] });
    expect(context(h, winner?.slot ?? 1).minigame?.prizes).toBeUndefined();
    expect(h.errors).toEqual([]);
  });
});

describe('Rückenwind-Ansage (CHAOS-125)', () => {
  it('Rundenende mit Rückenwind: im Stand (minigame.tailwind) und im eigenen Kontext (board.tailwind)', () => {
    // Billige Trophäen, damit früh jemand vorne liegt; Minispiele verfallen ohne Host-Ergebnis.
    const rules = withTailwind(
      withRules({ economy: { startCoins: 40 }, trophy: { price: 5 } }, DEFAULT_RULES),
    );
    const h = new Harness(
      { game: { seed: 5, rounds: 10, rules, minigames: [] } },
      { useItems: false, reaction: 'brace' },
      5,
    );
    h.host();
    for (const id of [1, 2, 3]) h.join(id);
    for (const id of h.controllers.keys()) h.ready(id);
    h.start();
    h.runUntil(
      (x) => x.gamePhase === 'round-end' && Boolean(x.boards.at(-1)?.view.minigame?.tailwind),
    );
    const view = h.boards.at(-1)?.view;
    const tailwind = view?.minigame?.tailwind ?? [];
    expect(tailwind.length).toBeGreaterThan(0);
    const top = Math.max(...(view?.players.map((p) => p.trophies) ?? [0]));
    for (const player of view?.players ?? []) {
      const coins = tailwind.find((bonus) => bonus.slot === player.slot)?.coins;
      const expected = Math.min(6, 2 * (top - player.trophies));
      expect(coins ?? 0).toBe(expected);
      expect(context(h, player.slot).board?.tailwind).toBe(coins);
    }
    const events = h.boards.flatMap((board) => board.events);
    expect(events.some((e) => e.type === 'coins-changed' && e.reason === 'tailwind')).toBe(true);
    // Nach dem Rundenende verschwindet die Ansage wieder.
    h.runUntil((x) => x.gamePhase !== 'round-end');
    for (const player of view?.players ?? []) {
      expect(context(h, player.slot).board?.tailwind).toBeUndefined();
    }
    expect(h.errors).toEqual([]);
  });
});

describe('Minispiel-Bestätigung und Kontext (CHAOS-55)', () => {
  it('bestätigt angenommene und abgelehnte Ergebnisse; im Kontext tied/aborted/reward', () => {
    const id = rotationInfos()[0]?.id ?? 'pump-parade';
    const h = setupMinigameGame(id, 2, INTEGRATION_SEEDS.two, 1);
    h.send(
      HOST,
      createMessage('minigame-result', {
        minigameId: id,
        round: 1,
        placements: [
          { slot: 1, place: 1, score: 1 },
          { slot: 2, place: 2, score: 0 },
        ],
      }),
    );
    expect(h.acks.at(-1)).toMatchObject({ accepted: false, code: 'invalid-result' });
    h.runUntil((x) => x.gamePhase === 'minigame-play');
    expect(context(h, 1).minigame).toMatchObject({ stage: 'play', tied: false, aborted: false });
    const minigame = h.boards.at(-1)?.view.minigame;
    if (!minigame) throw new Error('kein Minispiel');
    const info = getMinigameInfo(minigame.id);
    h.send(
      HOST,
      createMessage('minigame-result', {
        minigameId: minigame.id,
        round: minigame.round,
        placements: rankByScore(
          [
            { slot: 1, score: 4 },
            { slot: 2, score: 4 },
          ],
          info?.scoring,
        ),
      }),
    );
    expect(h.acks.at(-1)).toEqual({
      v: 4,
      type: 'minigame-result-ack',
      minigameId: minigame.id,
      round: minigame.round,
      accepted: true,
    });
    const view = h.boards.at(-1)?.view;
    expect(view?.minigame?.rewards).toEqual([
      { slot: 1, coins: 10 },
      { slot: 2, coins: 10 },
    ]);
    expect(view?.players.map((p) => p.minigameWins)).toEqual([1, 1]);
    expect(context(h, 1).minigame).toMatchObject({
      stage: 'results',
      place: 1,
      tied: true,
      aborted: false,
      reward: 10,
    });
    expect(context(h, 1).board?.minigameWins).toBe(1);
    // Doppelt gemeldet: abgelehnt, mit Bestätigung.
    h.send(
      HOST,
      createMessage('minigame-result', {
        minigameId: minigame.id,
        round: minigame.round,
        placements: [
          { slot: 1, place: 1, score: 4 },
          { slot: 2, place: 1, score: 4 },
        ],
      }),
    );
    expect(h.acks.at(-1)).toMatchObject({ accepted: false, code: 'invalid-result' });
  });

  it('Ergebnis in der Lobby: out-of-phase mit Bestätigung; Abbruch im Kontext sichtbar', () => {
    const h = lobbyHarness(1);
    h.send(
      HOST,
      createMessage('minigame-result', {
        minigameId: 'pump-parade',
        round: 1,
        placements: [{ slot: 1, place: 1, score: 1 }],
      }),
    );
    expect(h.acks.at(-1)).toMatchObject({ accepted: false, code: 'out-of-phase' });
    expect(h.errors.at(-1)).toEqual({ to: HOST, code: 'out-of-phase' });

    const id = rotationInfos()[0]?.id ?? 'pump-parade';
    const g = setupMinigameGame(id, 2, INTEGRATION_SEEDS.three, 1);
    g.runUntil((x) => x.gamePhase === 'minigame-results');
    expect(context(g, 1).minigame).toMatchObject({ stage: 'results', aborted: true, tied: false });
    expect(context(g, 1).minigame?.reward).toBeUndefined();
    expect(g.boards.at(-1)?.view.minigame?.rewards).toEqual([]);
  });
});
