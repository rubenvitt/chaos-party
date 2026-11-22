/**
 * Brett-Entscheidungen der KI (CHAOS-181): Regressionsvergleich mit der Logik aus
 * `simulate.ts` vor dem Umzug, gezielter Item-Einsatz und Wegwahl.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_BOARD } from '../board/index.ts';
import { activeNext } from '../board/rotation.ts';
import { createRng, pickOne, type Rng } from '../rng.ts';
import { DEFAULT_RULES } from '../rules/defaults.ts';
import { step } from '../rules/machine.ts';
import {
  BRACE_OPTION,
  BUY_OPTION,
  CANCEL_OPTION,
  itemOption,
  ROLL_OPTION,
  SHIELD_OPTION,
  SKIP_OPTION,
} from '../rules/prompts.ts';
import { newGame, patchPlayer, patchState, settle, start } from '../rules/testUtils.ts';
import type { BoardDefinition, GameState, Prompt, Slot } from '../types.ts';
import {
  decideBoardPrompt,
  distanceTo,
  smartItemOption,
  SMART_STEAL_MIN_COINS,
  type BoardDecisionPolicy,
} from './board.ts';

// ---------------------------------------------------------------------------
// Referenz: Entscheidungslogik aus `rules/simulate.ts` vor CHAOS-181 (unverändert kopiert).
// ---------------------------------------------------------------------------

interface LegacyPolicy {
  readonly itemUseChance: number;
  readonly buyTrophies: boolean;
  readonly target: 'richest' | 'random';
  readonly trophyPathChance: number;
  readonly avoidTrapChance: number;
  readonly routes: Readonly<Partial<Record<Slot, 'short' | 'long'>>>;
}

function legacyDistanceTo(
  board: BoardDefinition,
  from: string,
  targets: readonly string[],
  round: number,
): number {
  const next = new Map(board.spaces.map((space) => [space.id, activeNext(board, space.id, round)]));
  const seen = new Set([from]);
  let frontier = [from];
  for (let distance = 0; frontier.length > 0; distance++) {
    if (frontier.some((id) => targets.includes(id))) return distance;
    const following: string[] = [];
    for (const id of frontier) {
      for (const to of next.get(id) ?? []) {
        if (!seen.has(to)) {
          seen.add(to);
          following.push(to);
        }
      }
    }
    frontier = following;
  }
  return Infinity;
}

function legacyChoosePath(
  candidates: readonly string[],
  state: GameState,
  board: BoardDefinition,
  policy: LegacyPolicy,
  rng: Rng,
): string {
  const route = state.prompt ? policy.routes[state.prompt.slot] : undefined;
  if (route) {
    const lengths = candidates.map((id) => legacyDistanceTo(board, id, [board.start], state.round));
    const pick = route === 'short' ? Math.min(...lengths) : Math.max(...lengths);
    return candidates[lengths.indexOf(pick)] ?? pickOne(rng, candidates);
  }
  let ids = candidates;
  if (policy.avoidTrapChance > 0 && rng.next() < policy.avoidTrapChance) {
    const slot = state.prompt?.slot;
    const traps = state.traps.filter((trap) => trap.owner !== slot).map((trap) => trap.spaceId);
    const safe = ids.filter((id) => legacyDistanceTo(board, id, traps, state.round) >= 6);
    if (traps.length > 0 && safe.length > 0) ids = safe;
  }
  if (policy.trophyPathChance > 0 && rng.next() < policy.trophyPathChance) {
    const distances = ids.map((id) => legacyDistanceTo(board, id, state.trophySpaces, state.round));
    const best = Math.min(...distances);
    const nearest = ids.filter((_, index) => distances[index] === best);
    if (best !== Infinity && nearest.length > 0) return pickOne(rng, nearest);
  }
  return pickOne(rng, ids);
}

function legacyDecide(
  prompt: Prompt,
  state: GameState,
  board: BoardDefinition,
  policy: LegacyPolicy,
  rng: Rng,
): string {
  const ids = prompt.options.map((o) => o.id);
  switch (prompt.kind) {
    case 'roll': {
      const items = ids.filter((id) => id !== ROLL_OPTION);
      if (items.length > 0 && rng.next() < policy.itemUseChance) return pickOne(rng, items);
      return ROLL_OPTION;
    }
    case 'target': {
      const targets = prompt.options.filter((o) => o.slot !== undefined);
      if (targets.length === 0) return CANCEL_OPTION;
      if (policy.target === 'random') return pickOne(rng, targets).id;
      const coinsOf = (slot: Slot | undefined): number =>
        state.players.find((p) => p.slot === slot)?.coins ?? 0;
      return targets.reduce((best, o) => (coinsOf(o.slot) > coinsOf(best.slot) ? o : best)).id;
    }
    case 'path':
      return legacyChoosePath(ids, state, board, policy, rng);
    case 'trophy':
      return policy.buyTrophies ? BUY_OPTION : SKIP_OPTION;
    case 'reaction':
      return ids.includes(SHIELD_OPTION) ? SHIELD_OPTION : BRACE_OPTION;
  }
}

// ---------------------------------------------------------------------------

/**
 * Ganze Partie auf dem Standardbrett; an jedem Prompt antwortet `answer`. Reaktionen kommen
 * sofort, Minispiel-Anleitungen werden durchgeklickt.
 */
function playAll(
  seed: number,
  answer: (prompt: Prompt, state: GameState) => string,
  players = 4,
): number {
  let state = newGame({
    board: DEFAULT_BOARD,
    ruleSet: DEFAULT_RULES,
    players,
    rounds: 6,
    seed,
  });
  state = start(state).state;
  let prompts = 0;
  for (let i = 0; i < 100_000 && state.phase !== 'game-results'; i++) {
    const prompt = state.prompt;
    if (prompt) {
      prompts += 1;
      const option = answer(prompt, state);
      const result = step(state, {
        type: 'choose',
        slot: prompt.slot,
        promptId: prompt.id,
        option,
        at: state.now,
      });
      if (!result.ok) throw new Error(`${prompt.kind}: ${option} abgewiesen`);
      state = result.state;
      continue;
    }
    const waiting =
      state.phase === 'minigame-intro' && state.minigame?.ready !== undefined
        ? state.players.find((p) => !state.minigame?.ready?.includes(p.slot))
        : undefined;
    if (waiting) {
      const result = step(state, { type: 'minigame-ready', slot: waiting.slot, at: state.now });
      if (!result.ok) throw new Error('minigame-ready abgewiesen');
      state = result.state;
      continue;
    }
    state = settle(state).state;
  }
  expect(state.phase).toBe('game-results');
  return prompts;
}

const POLICIES: readonly LegacyPolicy[] = [
  {
    itemUseChance: 0.5,
    buyTrophies: true,
    target: 'richest',
    trophyPathChance: 0,
    avoidTrapChance: 0,
    routes: {},
  },
  {
    itemUseChance: 0.9,
    buyTrophies: false,
    target: 'random',
    trophyPathChance: 0.75,
    avoidTrapChance: 0.6,
    routes: {},
  },
  {
    itemUseChance: 0.3,
    buyTrophies: true,
    target: 'richest',
    trophyPathChance: 0.5,
    avoidTrapChance: 0.5,
    routes: { 1: 'short', 3: 'long' },
  },
];

describe('decideBoardPrompt: Regressionsvergleich mit simulate.ts vor CHAOS-181', () => {
  for (const [index, policy] of POLICIES.entries()) {
    it(`gleiche Wahl und gleicher Zufallsverbrauch an jedem Prompt (Politik ${String(index)})`, () => {
      for (const seed of [1, 2, 3, 11, 42]) {
        const legacyRng = createRng(seed ^ 0x5bd1e995);
        const newRng = createRng(seed ^ 0x5bd1e995);
        const prompts = playAll(seed, (prompt, state) => {
          const expected = legacyDecide(prompt, state, DEFAULT_BOARD, policy, legacyRng);
          const actual = decideBoardPrompt(prompt, state, DEFAULT_BOARD, policy, newRng);
          expect(actual).toBe(expected);
          expect(newRng.state()).toBe(legacyRng.state());
          return actual;
        });
        expect(prompts).toBeGreaterThan(20);
      }
    });
  }

  it('distanceTo ist unverändert', () => {
    const ids = DEFAULT_BOARD.spaces.map((space) => space.id);
    for (const from of ids.slice(0, 12)) {
      for (const round of [1, 2, 3]) {
        expect(distanceTo(DEFAULT_BOARD, from, ids.slice(-3), round)).toBe(
          legacyDistanceTo(DEFAULT_BOARD, from, ids.slice(-3), round),
        );
      }
    }
  });
});

describe('smartItemOption: gezielter Item-Einsatz (CHAOS-181)', () => {
  /** Würfel-Prompt von Spieler 1 mit genau diesen Items. */
  function rollWith(
    items: GameState['players'][number]['items'],
    patch?: (s: GameState) => GameState,
  ) {
    let state = newGame({ board: DEFAULT_BOARD, ruleSet: DEFAULT_RULES, players: 2, seed: 5 });
    state = patchPlayer(state, 1, { items });
    state = patchPlayer(state, 2, { items: [] });
    state = settle(start(state).state).state;
    if (patch) state = patch(state);
    const prompt = state.prompt;
    if (prompt?.kind !== 'roll' || prompt.slot !== 1) throw new Error('kein Würfel-Prompt für 1');
    return { state, prompt };
  }

  it('klaut, wenn ein Mitspieler genug Münzen hat; sonst bleibt das Item', () => {
    const rich = rollWith(['coin-steal'], (s) =>
      patchPlayer(s, 2, { coins: SMART_STEAL_MIN_COINS }),
    );
    expect(smartItemOption(rich.prompt, rich.state, DEFAULT_BOARD)).toBe(itemOption('coin-steal'));
    const poor = rollWith(['coin-steal'], (s) =>
      patchPlayer(s, 2, { coins: SMART_STEAL_MIN_COINS - 1 }),
    );
    expect(smartItemOption(poor.prompt, poor.state, DEFAULT_BOARD)).toBe(ROLL_OPTION);
  });

  it('Doppelwürfel nur mit Geld für eine Trophäe und weitem Weg', () => {
    const price = DEFAULT_RULES.trophy.price;
    const far = rollWith(['double-dice'], (s) => {
      const me = s.players.find((p) => p.slot === 1)?.spaceId ?? DEFAULT_BOARD.start;
      const trophy = DEFAULT_BOARD.spaces.find(
        (space) => distanceTo(DEFAULT_BOARD, me, [space.id], s.round) >= 8,
      );
      if (!trophy) throw new Error('kein fernes Feld');
      return patchPlayer(patchState(s, { trophySpaces: [trophy.id] }), 1, { coins: price });
    });
    expect(smartItemOption(far.prompt, far.state, DEFAULT_BOARD)).toBe(itemOption('double-dice'));
    const broke = rollWith(['double-dice'], (s) => patchPlayer(s, 1, { coins: price - 1 }));
    expect(smartItemOption(broke.prompt, broke.state, DEFAULT_BOARD)).toBe(ROLL_OPTION);
  });

  it('Falle, wenn ein Mitspieler dahinter steht; nicht, wenn alle vorn sind', () => {
    const behind = rollWith(['trap'], (s) => {
      const ids = DEFAULT_BOARD.spaces.map((space) => space.id);
      const me = ids.find(
        (id) => distanceTo(DEFAULT_BOARD, DEFAULT_BOARD.start, [id], s.round) === 4,
      );
      if (!me) throw new Error('kein Feld 4 vor dem Start');
      return patchPlayer(patchPlayer(s, 1, { spaceId: me }), 2, { spaceId: DEFAULT_BOARD.start });
    });
    expect(smartItemOption(behind.prompt, behind.state, DEFAULT_BOARD)).toBe(itemOption('trap'));
  });

  it('gezielt (smartItemChance 1) nutzt nie ein Item ohne Nutzen, zufällig (0) schon', () => {
    const poor = rollWith(['coin-steal'], (s) => patchPlayer(s, 2, { coins: 0 }));
    const base: BoardDecisionPolicy = {
      itemUseChance: 1,
      buyTrophies: true,
      target: 'richest',
      trophyPathChance: 0,
      avoidTrapChance: 0,
    };
    const rng = createRng(1);
    const smart = decideBoardPrompt(
      poor.prompt,
      poor.state,
      DEFAULT_BOARD,
      { ...base, smartItemChance: 1 },
      rng,
    );
    expect(smart).toBe(ROLL_OPTION);
    const random = decideBoardPrompt(poor.prompt, poor.state, DEFAULT_BOARD, base, rng);
    expect(random).toBe(itemOption('coin-steal'));
  });
});
