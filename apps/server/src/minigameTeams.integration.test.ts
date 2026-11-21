/**
 * CHAOS-89: Spielformen mit Teams und Koop über die Session – Aufstellung im Brett-Stand und in
 * der Rolle jedes Controllers, Team-Ausgang vom Host, Münzen nach der Team-Regel. Für jede
 * Spielform mit 2, 3 und 4 Personen, deterministisch per Seed.
 */
import { DEFAULT_RULES, DEFAULT_TEAM_REWARDS } from '@chaos-party/game-core';
import { createMessage, type BoardView, type SlotNumber } from '@chaos-party/protocol';
import { describe, expect, it } from 'vitest';
import {
  HOST,
  INTEGRATION_SEEDS,
  playMinigameAsHost,
  pressInMinigame,
  setupMinigameGame,
  type Harness,
} from './testHarness.ts';

const CASES = (['pump-duell', 'pump-solo', 'pump-riese'] as const).flatMap((id) =>
  ([2, 3, 4] as const).map((players) => [id, players] as const),
);

const LAYOUTS: Record<string, Record<number, string>> = {
  'pump-duell': { 2: '1v1', 3: '1v2', 4: '2v2' },
  'pump-solo': { 2: '1v1', 3: '1v2', 4: '1v3' },
  'pump-riese': { 2: 'koop', 3: 'koop', 4: 'koop' },
};

function play(minigameId: string, players: number, seed: number) {
  const h = setupMinigameGame(minigameId, players, seed, 1);
  const host = { sent: new Set<number>(), startedAt: new Map<number, number>() };
  const pressed = new Map<SlotNumber, number>();
  let intro: BoardView['minigame'] = null;
  const roles = new Map<SlotNumber, unknown>();
  const results = new Map<SlotNumber, unknown>();
  h.runToEnd(400_000, (harness) => {
    pressInMinigame(harness, pressed);
    playMinigameAsHost(harness, host);
    const view = harness.boards.at(-1)?.view;
    if (view?.gamePhase === 'minigame-intro' && intro === null) intro = view.minigame;
    for (const [slot, { context }] of harness.contexts) {
      const minigame = context.minigame;
      if (minigame?.stage === 'intro' && !roles.has(slot)) roles.set(slot, minigame.team);
      if (minigame?.stage === 'results') results.set(slot, minigame.team);
    }
  });
  return { h, intro: intro as BoardView['minigame'], roles, results };
}

function minigameCoins(h: Harness): Map<number, number> {
  const coins = new Map<number, number>();
  for (const event of h.events) {
    if (event.type === 'coins-changed' && event.reason === 'minigame') {
      coins.set(event.slot, (coins.get(event.slot) ?? 0) + event.delta);
    }
  }
  return coins;
}

describe('Spielformen über die Session (CHAOS-89)', () => {
  it.each(CASES)('%s mit %i Personen', (minigameId, players) => {
    const seed = INTEGRATION_SEEDS.four + players;
    const { h, intro, roles, results } = play(minigameId, players, seed);
    expect(h.gamePhase).toBe('game-results');
    expect(h.errors.filter((e) => e.to === HOST)).toEqual([]);

    // Aufstellung steht ab der Anleitung im Brett-Stand.
    const teams = intro?.teams;
    expect(teams?.layout).toBe(LAYOUTS[minigameId]?.[players]);
    expect(teams?.soloAdvantage).toBe(minigameId !== 'pump-riese' && players === 3);
    const slots = ([1, 2, 3, 4] as const).slice(0, players);
    expect(teams?.teams.flat().sort()).toEqual([...slots]);

    // Jeder Controller kennt seine Rolle schon in der Anleitung.
    for (const slot of slots) {
      const role = roles.get(slot) as { role: string; mates: number[]; opponents: number[] };
      const index = teams?.teams.findIndex((team) => team.includes(slot)) ?? -1;
      const own = teams?.teams[index] ?? [];
      expect(role.role).toBe(
        teams?.layout === 'koop' ? 'koop' : own.length === 1 ? 'solo' : 'team',
      );
      expect([...role.mates, slot].sort()).toEqual([...own]);
      expect(role.mates.length + role.opponents.length).toBe(players - 1);
    }

    // Ergebnis mit Ausgang, Münzen nach der Team-Regel.
    const view = h.boards.findLast((board) => board.view.minigame?.outcome)?.view.minigame;
    const outcome = view?.outcome;
    const coins = minigameCoins(h);
    if (outcome?.kind === 'koop') {
      expect(teams?.layout).toBe('koop');
      for (const placement of view?.placements ?? []) {
        const expected = Math.round(
          ((DEFAULT_TEAM_REWARDS.koop[placement.place - 1] ?? 0) * outcome.tier) / 3,
        );
        expect(coins.get(placement.slot) ?? 0).toBe(expected);
      }
      for (const slot of slots) expect(results.get(slot)).toMatchObject({ tier: outcome.tier });
    } else {
      expect(outcome?.kind).toBe('teams');
      const winner = outcome?.kind === 'teams' ? outcome.winner : null;
      for (const slot of slots) {
        const index = teams?.teams.findIndex((team) => team.includes(slot)) ?? -1;
        const own = results.get(slot) as { result: string };
        expect(own.result).toBe(winner === null ? 'draw' : winner === index ? 'won' : 'lost');
      }
      if (winner !== null) {
        const winners = teams?.teams[winner] ?? [];
        const solo = winners.length === 1 && players > 2;
        // 1 gegen 1 zahlt wie jeder gegen jeden (EXP-038).
        const expected =
          teams?.layout === '1v1'
            ? (DEFAULT_RULES.economy.minigameRewards[0] ?? 0)
            : solo
              ? DEFAULT_TEAM_REWARDS.win * DEFAULT_TEAM_REWARDS.soloWinFactor
              : DEFAULT_TEAM_REWARDS.win;
        for (const slot of winners) expect(coins.get(slot) ?? 0).toBe(expected);
      }
    }
  });

  it('gleicher Seed, gleiche Aufstellung und gleiches Ergebnis', () => {
    const a = play('pump-duell', 4, 99);
    const b = play('pump-duell', 4, 99);
    expect(a.intro?.teams).toEqual(b.intro?.teams);
    expect(minigameCoins(a.h)).toEqual(minigameCoins(b.h));
  });

  it('ein Ergebnis ohne Team-Ausgang lehnt der Server ab', () => {
    const h = setupMinigameGame('pump-duell', 4, 5, 1);
    h.runUntil((x) => x.gamePhase === 'minigame-play');
    const view = h.boards.at(-1)?.view;
    const minigame = view?.minigame;
    if (!minigame) throw new Error('kein Minispiel');
    h.send(
      HOST,
      createMessage('minigame-result', {
        minigameId: minigame.id,
        round: minigame.round,
        placements: ([1, 2, 3, 4] as const).map((slot) => ({ slot, place: 1, score: 0 })),
      }),
    );
    expect(h.gamePhase).toBe('minigame-play');
    expect(h.acks.at(-1)).toMatchObject({ accepted: false, code: 'invalid-result' });
  });
});
