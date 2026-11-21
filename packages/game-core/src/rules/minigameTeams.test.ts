/**
 * Spielformen mit Teams und Koop in den Regeln (CHAOS-89): Zuteilung beim Start, Ersatz zu
 * zweit und zu dritt, Prüfung des Ergebnisses und Münz-Regel – deterministisch per Seed.
 */
import { teamPlacements } from '@chaos-party/minigame-sdk';
import { describe, expect, it } from 'vitest';
import type {
  GameState,
  MinigameOutcome,
  MinigamePlacement,
  MinigameSpec,
  Slot,
  StepResult,
} from '../types.ts';
import { DEFAULT_TEAM_REWARDS, withRules, ZERO_PACING } from './defaults.ts';
import { createGame, step } from './machine.ts';
import { loopBoard } from './testBoards.ts';
import { choose, NAMES, playerAt, start, TEST_RULES, tick } from './testUtils.ts';

const TWO_V_TWO: MinigameSpec = {
  id: 'test-2v2',
  playMs: 10_000,
  scoring: 'higher',
  form: '2v2',
  minPlayers: 2,
  teamPlay: { form: '2v2', assignment: 'board', withThree: true, withTwo: true },
};
const ONE_V_THREE: MinigameSpec = {
  id: 'test-1v3',
  playMs: 10_000,
  scoring: 'higher',
  form: '1v3',
  minPlayers: 2,
  teamPlay: { form: '1v3', assignment: 'random', withThree: true, withTwo: true },
};
const KOOP: MinigameSpec = {
  id: 'test-koop',
  playMs: 10_000,
  scoring: 'higher',
  form: 'koop',
  minPlayers: 2,
  teamPlay: { form: 'koop', withThree: true, withTwo: true },
};

function game(spec: MinigameSpec, players: number, seed = 5): GameState {
  const rules = withRules(
    {
      diceFaces: [1],
      economy: { minigameRewards: [10, 5, 3, 0] },
      items: { minigameLastItems: 0, minigameWinItems: 0 },
      pacing: { ...ZERO_PACING, minigameIntroMs: 1_000, minigameResultsMs: 1_000 },
    },
    TEST_RULES,
  );
  return createGame({
    board: loopBoard(['start', 'start', 'start', 'start']),
    rules,
    rounds: 1,
    seed,
    players: ([1, 2, 3, 4] as const)
      .slice(0, players)
      .map((slot) => ({ slot, name: NAMES[slot - 1] ?? 'X' })),
    minigames: [spec],
  });
}

function driveTo(state: GameState, phase: GameState['phase']): GameState {
  let current = state;
  for (let i = 0; i < 500 && current.phase !== phase; i++) {
    current = current.prompt
      ? choose(current, 'roll').state
      : tick(current, current.resumeAt ?? current.now).state;
  }
  if (current.phase !== phase) throw new Error(`Phase ${phase} nicht erreicht (${current.phase})`);
  return current;
}

function play(spec: MinigameSpec, players: number, seed = 5): GameState {
  return driveTo(start(game(spec, players, seed), 0).state, 'minigame-play');
}

function send(
  state: GameState,
  placements: readonly MinigamePlacement[],
  outcome?: MinigameOutcome,
): StepResult {
  const minigame = state.minigame;
  if (!minigame) throw new Error('kein Minispiel');
  return step(state, {
    type: 'minigame-result',
    minigameId: minigame.id,
    round: minigame.round,
    placements,
    ...(outcome ? { outcome } : {}),
    at: state.now + 1_000,
  });
}

function soloOf(teams: readonly (readonly Slot[])[]): Slot {
  const solo = teams[0]?.[0];
  if (solo === undefined) throw new Error('keine Einzelperson');
  return solo;
}

const scoresOf = (state: GameState) =>
  state.players.map((p) => ({ slot: p.slot, score: p.slot * 2 }));

function coinsAfter(state: GameState, result: StepResult): Record<number, number> {
  if (!result.ok) throw new Error(result.error.message);
  return Object.fromEntries(
    state.players.map((p) => [p.slot, playerAt(result.state, p.slot).coins - p.coins]),
  );
}

describe('Teams beim Start (CHAOS-89)', () => {
  it.each([
    [2, '1v1'],
    [3, '1v2'],
    [4, '2v2'],
  ] as const)('2 gegen 2 mit %i Personen: Aufstellung %s', (players, layout) => {
    const state = play(TWO_V_TWO, players);
    const teams = state.minigame?.teams;
    expect(teams?.layout).toBe(layout);
    expect(teams?.soloAdvantage).toBe(players === 3);
    expect(teams?.teams.flat().sort()).toEqual(state.players.map((p) => p.slot));
  });

  it.each([
    [2, '1v1'],
    [3, '1v2'],
    [4, '1v3'],
  ] as const)(
    '1 gegen 3 mit %i Personen: Aufstellung %s, gleich bei gleichem Seed',
    (players, layout) => {
      const a = play(ONE_V_THREE, players, 11);
      const b = play(ONE_V_THREE, players, 11);
      expect(a.minigame?.teams?.layout).toBe(layout);
      expect(a.minigame?.teams).toEqual(b.minigame?.teams);
      expect(a.minigame?.teams?.teams[0]).toHaveLength(1);
    },
  );

  it.each([2, 3, 4])('Koop mit %i Personen: ein Team mit allen', (players) => {
    const state = play(KOOP, players);
    expect(state.minigame?.teams).toEqual({
      form: 'koop',
      layout: 'koop',
      teams: [state.players.map((p) => p.slot)],
      soloAdvantage: false,
    });
  });

  it('jeder gegen jeden bekommt keine Teams', () => {
    const state = play({ id: 'test-ffa', playMs: 10_000, scoring: 'higher' }, 4);
    expect(state.minigame?.teams).toBeUndefined();
  });
});

describe('Ergebnis und Münzen (CHAOS-89)', () => {
  it('2 gegen 2: jede Person im Siegerteam bekommt den Sieg-Betrag, Siege zählen', () => {
    const state = play(TWO_V_TWO, 4);
    const teams = state.minigame?.teams;
    if (!teams) throw new Error('keine Teams');
    const result = send(state, teamPlacements(teams, 1, scoresOf(state)), {
      kind: 'teams',
      winner: 1,
    });
    const coins = coinsAfter(state, result);
    for (const slot of teams.teams[1] ?? []) expect(coins[slot]).toBe(DEFAULT_TEAM_REWARDS.win);
    for (const slot of teams.teams[0] ?? []) expect(coins[slot]).toBe(DEFAULT_TEAM_REWARDS.lose);
    if (!result.ok) return;
    for (const slot of teams.teams[1] ?? [])
      expect(playerAt(result.state, slot).minigameWins).toBe(1);
    expect(result.state.minigame?.outcome).toEqual({ kind: 'teams', winner: 1 });
  });

  it('1 gegen 3: Einzelsieg zählt doppelt, Unentschieden gibt allen den Remis-Betrag', () => {
    const state = play(ONE_V_THREE, 4);
    const teams = state.minigame?.teams;
    if (!teams) throw new Error('keine Teams');
    const solo = soloOf(teams.teams);
    const win = coinsAfter(
      state,
      send(state, teamPlacements(teams, 0, scoresOf(state)), { kind: 'teams', winner: 0 }),
    );
    expect(win[solo]).toBe(DEFAULT_TEAM_REWARDS.win * DEFAULT_TEAM_REWARDS.soloWinFactor);
    const draw = coinsAfter(
      state,
      send(state, teamPlacements(teams, null, scoresOf(state)), { kind: 'teams', winner: null }),
    );
    expect(Object.values(draw)).toEqual(state.players.map(() => DEFAULT_TEAM_REWARDS.draw));
  });

  it('1 gegen 1 (Ersatz zu zweit) zahlt wie jeder gegen jeden (EXP-038)', () => {
    const state = play(ONE_V_THREE, 2);
    const teams = state.minigame?.teams;
    if (!teams) throw new Error('keine Teams');
    const solo = soloOf(teams.teams);
    const coins = coinsAfter(
      state,
      send(state, teamPlacements(teams, 0, scoresOf(state)), { kind: 'teams', winner: 0 }),
    );
    const other = state.players.find((p) => p.slot !== solo)?.slot ?? 1;
    expect(coins[solo]).toBe(10);
    expect(coins[other]).toBe(5);
  });

  it('Koop: Einzelwertung anteilig zur Stufe, keine Minispiel-Siege', () => {
    const state = play(KOOP, 4);
    const placements: MinigamePlacement[] = [
      { slot: 2, place: 1, score: 9 },
      { slot: 1, place: 2, score: 5 },
      { slot: 4, place: 3, score: 3 },
      { slot: 3, place: 4, score: 1 },
    ];
    const full = send(state, placements, { kind: 'koop', tier: 3 });
    expect(coinsAfter(state, full)).toEqual({ 1: 9, 2: 12, 3: 3, 4: 6 });
    const partial = send(state, placements, { kind: 'koop', tier: 1 });
    expect(coinsAfter(state, partial)).toEqual({ 1: 3, 2: 4, 3: 1, 4: 2 });
    if (full.ok) expect(full.state.players.every((p) => p.minigameWins === 0)).toBe(true);
  });

  it('lehnt Ergebnisse ohne passenden Ausgang ab (Host ist Eingabe von außen)', () => {
    const state = play(TWO_V_TWO, 4);
    const teams = state.minigame?.teams;
    if (!teams) throw new Error('keine Teams');
    const placements = teamPlacements(teams, 0, scoresOf(state));
    const missing = send(state, placements);
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error.code).toBe('invalid-result');
    expect(send(state, placements, { kind: 'teams', winner: 1 }).ok).toBe(false);
    expect(send(state, placements, { kind: 'koop', tier: 2 }).ok).toBe(false);
  });
});
