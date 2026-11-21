/**
 * CHAOS-37: Determinismus und Wertung über die Session (ADR-015 §4).
 *
 * 1. Feste Seeds für 2, 3 und 4 Spieler (`INTEGRATION_SEEDS`, M2-Ablauf mit Platzhalter-
 *    Minispiel, 3 Runden): Endstand-Schnappschuss inkl. `decidedBy`, Figuren und Statistik.
 *    Ändern sich Regeln oder Zufallsfolge, schlägt der Test bewusst fehl → Werte prüfen und
 *    neu eintragen (und `docs/testing.md` anpassen).
 * 2. Konstruierte Gleichstände über echte Host-Ergebnisse: Trophäen und Münzen gleich, die
 *    Minispiel-Siege entscheiden (`minigame-wins`), der Rest teilt sich den Platz (`shared`).
 * 3. Vollständiger Gleichstand: Ende direkt nach dem Start → alle auf Platz 1 (`shared`).
 */
import { DEFAULT_RULES, withRules } from '@chaos-party/game-core';
import { rankByScore } from '@chaos-party/minigame-sdk';
import { getMinigameInfo, rotationInfos } from '@chaos-party/minigames/catalog';
import { createMessage, type SlotNumber } from '@chaos-party/protocol';
import { describe, expect, it } from 'vitest';
import {
  assertContiguousEvents,
  Harness,
  HOST,
  INTEGRATION_SEEDS,
  setupGame,
} from './testHarness.ts';

const SNAPSHOTS = [
  {
    players: 2,
    seed: INTEGRATION_SEEDS.two,
    events: 57,
    ranking: [
      { slot: 2, place: 1, trophies: 0, coins: 41, minigameWins: 2, decidedBy: 'coins' },
      { slot: 1, place: 2, trophies: 0, coins: 30, minigameWins: 1, decidedBy: 'coins' },
    ],
    stats: [
      [1, 'robot', { coinsEarned: 23, coinsLost: 3, spacesMoved: 9, itemsUsed: 1 }],
      [2, 'cactus', { coinsEarned: 31, coinsLost: 0, spacesMoved: 11, itemsUsed: 1 }],
    ],
  },
  {
    players: 3,
    seed: INTEGRATION_SEEDS.three,
    events: 93,
    ranking: [
      { slot: 2, place: 1, trophies: 0, coins: 36, minigameWins: 1, decidedBy: 'coins' },
      { slot: 3, place: 2, trophies: 0, coins: 35, minigameWins: 1, decidedBy: 'coins' },
      { slot: 1, place: 3, trophies: 0, coins: 33, minigameWins: 1, decidedBy: 'coins' },
    ],
    stats: [
      [1, 'robot', { coinsEarned: 27, coinsLost: 4, spacesMoved: 16, itemsUsed: 2 }],
      [2, 'cactus', { coinsEarned: 26, coinsLost: 0, spacesMoved: 17, itemsUsed: 1 }],
      [3, 'raccoon', { coinsEarned: 25, coinsLost: 0, spacesMoved: 4, itemsUsed: 1 }],
    ],
  },
  {
    players: 4,
    seed: INTEGRATION_SEEDS.four,
    events: 123,
    ranking: [
      { slot: 4, place: 1, trophies: 0, coins: 43, minigameWins: 2, decidedBy: 'coins' },
      { slot: 3, place: 2, trophies: 0, coins: 32, minigameWins: 1, decidedBy: 'coins' },
      { slot: 1, place: 3, trophies: 0, coins: 30, minigameWins: 0, decidedBy: 'coins' },
      { slot: 2, place: 4, trophies: 0, coins: 18, minigameWins: 0, decidedBy: 'coins' },
    ],
    stats: [
      [1, 'robot', { coinsEarned: 20, coinsLost: 0, spacesMoved: 10, itemsUsed: 3 }],
      [2, 'cactus', { coinsEarned: 14, coinsLost: 6, spacesMoved: 18, itemsUsed: 1 }],
      [3, 'raccoon', { coinsEarned: 25, coinsLost: 3, spacesMoved: 5, itemsUsed: 1 }],
      [4, 'sock', { coinsEarned: 33, coinsLost: 0, spacesMoved: 17, itemsUsed: 1 }],
    ],
  },
] as const;

function lastView(h: Harness) {
  const view = h.boards.at(-1)?.view;
  if (!view) throw new Error('kein Brett-Stand');
  return view;
}

describe('Endstand mit festem Seed (CHAOS-37)', () => {
  it.each(SNAPSHOTS)('$players Spieler, Seed $seed: Endstand-Schnappschuss', (expected) => {
    const run = () => {
      const h = setupGame(expected.players, expected.seed, { rounds: 3 });
      h.runToEnd();
      return h;
    };
    const h = run();
    const view = lastView(h);
    expect(view.gamePhase).toBe('game-results');
    expect(view.endedEarly).toBe(false);
    expect(view.ranking).toEqual(expected.ranking);
    expect(view.players.map((p) => [p.slot, p.character, p.stats])).toEqual(expected.stats);
    expect(h.events).toHaveLength(expected.events);
    expect(h.events.at(-1)).toEqual({
      type: 'game-ended',
      ranking: expected.ranking,
      endedEarly: false,
    });
    assertContiguousEvents(h);
    // Rangfolge passt zu den Spielerständen; Controller sehen ihren Platz.
    for (const entry of view.ranking ?? []) {
      const player = view.players.find((p) => p.slot === entry.slot);
      expect([player?.trophies, player?.coins, player?.minigameWins]).toEqual([
        entry.trophies,
        entry.coins,
        entry.minigameWins,
      ]);
      expect(h.contexts.get(entry.slot)?.context.board).toMatchObject({
        place: entry.place,
        tied: false,
        minigameWins: entry.minigameWins,
      });
    }
    // Zweiter Lauf: identische Ereignisse.
    expect(run().events).toEqual(h.events);
  });
});

/**
 * Regeln, unter denen nur Minispiel-Siege einen Unterschied machen: Würfel zeigt immer 0 (alle
 * bleiben auf dem Start), keine Start-Items, keine Minispiel-Münzen.
 */
const FLAT_RULES = withRules({
  diceFaces: [0],
  items: { startItems: 0 },
  economy: { minigameRewards: [0, 0, 0, 0] },
});

/** Partie mit 4 Spielern und einem echten Minispiel; der Host meldet vorgegebene Punkte. */
function tieGame(scoresPerRound: Record<number, Record<SlotNumber, number>>): Harness {
  const info = rotationInfos()[0];
  if (!info) throw new Error('kein Minispiel');
  const rounds = Object.keys(scoresPerRound).length;
  const h = new Harness({
    game: {
      seed: 99,
      rounds,
      rules: FLAT_RULES,
      minigames: [{ id: info.id, playMs: info.durationMs, scoring: info.scoring }],
    },
  });
  h.host();
  for (let id = 1; id <= 4; id++) h.join(id);
  for (const id of h.controllers.keys()) h.ready(id);
  h.start();
  const reported = new Set<number>();
  h.runToEnd(200_000, (x) => {
    const view = x.boards.at(-1)?.view;
    const minigame = view?.minigame;
    if (view?.gamePhase !== 'minigame-play' || !minigame || reported.has(minigame.round)) return;
    reported.add(minigame.round);
    const scores = scoresPerRound[minigame.round];
    if (!scores) throw new Error(`keine Punkte für Runde ${String(minigame.round)}`);
    const scoring = getMinigameInfo(minigame.id)?.scoring ?? 'higher';
    x.send(
      HOST,
      createMessage('minigame-result', {
        minigameId: minigame.id,
        round: minigame.round,
        placements: rankByScore(
          Object.entries(scores).map(([slot, score]) => ({
            slot: Number(slot) as SlotNumber,
            // Bei „weniger ist besser“ umdrehen, damit die vorgegebene Reihenfolge gilt.
            score: scoring === 'higher' ? score : 10 - score,
          })),
          scoring,
        ),
      }),
    );
  });
  expect(h.acks).toHaveLength(rounds);
  expect(h.acks.every((ack) => ack.accepted)).toBe(true);
  return h;
}

describe('Konstruierte Gleichstände (CHAOS-37)', () => {
  it('Trophäen und Münzen gleich: Minispiel-Siege entscheiden, der Rest teilt sich Platz 3', () => {
    const start = DEFAULT_RULES.economy.startCoins;
    // Runde 1: Slot 1 gewinnt. Runde 2: Slot 1 und 2 gleichauf vorn (beide zählen als Sieg).
    const h = tieGame({
      1: { 1: 4, 2: 3, 3: 2, 4: 1 },
      2: { 1: 5, 2: 5, 3: 2, 4: 1 },
    });
    const view = lastView(h);
    expect(view.gamePhase).toBe('game-results');
    expect(view.players.map((p) => [p.slot, p.coins, p.trophies])).toEqual([
      [1, start, 0],
      [2, start, 0],
      [3, start, 0],
      [4, start, 0],
    ]);
    expect(view.ranking).toEqual([
      { slot: 1, place: 1, trophies: 0, coins: start, minigameWins: 2, decidedBy: 'minigame-wins' },
      { slot: 2, place: 2, trophies: 0, coins: start, minigameWins: 1, decidedBy: 'minigame-wins' },
      { slot: 3, place: 3, trophies: 0, coins: start, minigameWins: 0, decidedBy: 'shared' },
      { slot: 4, place: 3, trophies: 0, coins: start, minigameWins: 0, decidedBy: 'shared' },
    ]);
    // Controller: Platz und „geteilt“ je Slot.
    expect(
      ([1, 2, 3, 4] as SlotNumber[]).map((slot) => {
        const board = h.contexts.get(slot)?.context.board;
        return [board?.place, board?.tied, board?.minigameWins];
      }),
    ).toEqual([
      [1, false, 2],
      [2, false, 1],
      [3, true, 0],
      [3, true, 0],
    ]);
    assertContiguousEvents(h);
    expect(h.errors).toEqual([]);
  });

  it('alles gleich (Ende direkt nach dem Start): alle teilen sich Platz 1', () => {
    const h = setupGame(3, INTEGRATION_SEEDS.three, { rounds: 3 });
    h.endGame();
    const view = lastView(h);
    expect(view).toMatchObject({ gamePhase: 'game-results', endedEarly: true });
    const start = DEFAULT_RULES.economy.startCoins;
    expect(view.ranking).toEqual(
      [1, 2, 3].map((slot) => ({
        slot,
        place: 1,
        trophies: 0,
        coins: start,
        minigameWins: 0,
        decidedBy: 'shared',
      })),
    );
    for (const slot of [1, 2, 3] as SlotNumber[]) {
      expect(h.contexts.get(slot)?.context.board).toMatchObject({
        place: 1,
        tied: true,
        endedEarly: true,
      });
    }
    expect(h.events.at(-1)).toMatchObject({ type: 'game-ended', endedEarly: true });
  });
});
