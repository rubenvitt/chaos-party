/**
 * Schnellfeuer als eigene Rundenart (CHAOS-90): Auslöser Ereignis, Halbzeit, Finale und
 * Rückfall aufs Finale. Schnellfeuer ersetzt das Minispiel der Runde, die Rotation bleibt.
 */
import { describe, expect, it } from 'vitest';
import type { GameEvent, GameState, MinigameSpec, RapidFireRules, SpaceKind } from '../types.ts';
import { withRules, ZERO_PACING } from './defaults.ts';
import { createGame } from './machine.ts';
import { loopBoard } from './testBoards.ts';
import { choose, NAMES, run, start, TEST_RULES, tick } from './testUtils.ts';

const SPECS: readonly MinigameSpec[] = [
  { id: 'flink-flitzer', playMs: 20_000, scoring: 'higher' },
  { id: 'wackel-floss', playMs: 30_000, scoring: 'higher' },
  { id: 'zeit-zocker', playMs: 25_000, scoring: 'lower' },
];
const RAPID: MinigameSpec = { id: 'schnellfeuer', playMs: 42_500, scoring: 'higher' };

function game(
  options: {
    rule?: RapidFireRules;
    rounds?: number;
    players?: number;
    kinds?: readonly SpaceKind[];
    practice?: boolean;
    rapid?: boolean;
  } = {},
): GameState {
  const base = withRules(
    { diceFaces: [1], pacing: { ...ZERO_PACING, minigameIntroMs: 100, minigameResultsMs: 100 } },
    TEST_RULES,
  );
  return createGame({
    board: loopBoard(options.kinds ?? ['coins-plus', 'coins-plus', 'coins-plus', 'coins-plus']),
    rules: options.rule ? { ...base, rapidFire: options.rule } : base,
    rounds: options.rounds ?? 4,
    seed: 7,
    players: ([1, 2, 3, 4] as const)
      .slice(0, options.players ?? 3)
      .map((slot) => ({ slot, name: NAMES[slot - 1] ?? 'X' })),
    minigames: options.practice ? SPECS.slice(0, 1) : SPECS,
    ...(options.practice ? { practice: true } : {}),
    ...(options.rapid === false ? {} : { rapidFire: RAPID }),
  });
}

interface Played {
  readonly minigames: string[];
  readonly events: GameEvent[];
  readonly state: GameState;
}

/** Ganze Partie: würfeln, Zeit laufen lassen, Minispiele mit Slot-Reihenfolge werten. */
function play(initial: GameState): Played {
  const started = start(initial, 0);
  let state = started.state;
  const minigames: string[] = [];
  const events: GameEvent[] = [...started.events];
  for (let i = 0; i < 5_000 && state.phase !== 'game-results'; i++) {
    const minigame = state.minigame;
    let next;
    if (state.phase === 'minigame-play' && minigame?.placements === null) {
      minigames.push(minigame.id);
      const lower = SPECS.find((spec) => spec.id === minigame.id)?.scoring === 'lower';
      next = run(state, {
        type: 'minigame-result',
        minigameId: minigame.id,
        round: minigame.round,
        placements: state.players.map((p, index) => ({
          slot: p.slot,
          place: index + 1,
          score: lower ? index : 100 - index,
        })),
        at: state.now + 10,
      });
    } else if (state.prompt) {
      next = choose(state, state.prompt.options[0]?.id ?? 'roll');
    } else {
      next = tick(state, state.resumeAt ?? state.now);
    }
    events.push(...next.events);
    state = next.state;
  }
  return { minigames, events, state };
}

const rapidEvents = (events: readonly GameEvent[]) =>
  events.filter((e) => e.type === 'board-event' && e.event === 'rapid-fire');

describe('Schnellfeuer-Auslöser (CHAOS-90)', () => {
  it('ohne Regel kein Schnellfeuer und kein Ereignis, auch mit Steckbrief', () => {
    const { minigames, events } = play(game({ kinds: ['event', 'event', 'event', 'event'] }));
    expect(minigames).not.toContain('schnellfeuer');
    expect(rapidEvents(events)).toEqual([]);
    expect(events.some((e) => e.type === 'board-event')).toBe(true);
  });

  it('Halbzeit: Runde ⌈Runden/2⌉ wird Schnellfeuer, die Rotation läuft ungestört weiter', () => {
    const { minigames } = play(game({ rule: { trigger: 'halftime' }, rounds: 5 }));
    expect(minigames).toHaveLength(5);
    expect(minigames[2]).toBe('schnellfeuer');
    // Die Mischung zählt das ersetzte Minispiel nicht: erst alle drei, dann neu gemischt.
    const others = minigames.filter((id) => id !== 'schnellfeuer');
    expect(new Set(others.slice(0, 3)).size).toBe(3);
    expect(others[3]).not.toBe(others[2]);
  });

  it('Finale: nur die letzte Runde', () => {
    const { minigames } = play(game({ rule: { trigger: 'finale' }, rounds: 3 }));
    expect(minigames.map((id) => id === 'schnellfeuer')).toEqual([false, false, true]);
  });

  it('Ereignis: „Schnellfeuer!“ macht das Minispiel derselben Runde zu Schnellfeuer, höchstens einmal', () => {
    const { minigames, events } = play(
      game({
        rule: { trigger: 'event', maxPerGame: 1, eventWeight: 50 },
        kinds: ['event', 'event', 'event', 'event'],
      }),
    );
    const triggered = rapidEvents(events);
    expect(triggered).toHaveLength(1);
    const at = events.findIndex((e) => e.type === 'board-event' && e.event === 'rapid-fire');
    const round = events.findLast((e, i) => e.type === 'round-started' && i < at);
    const roundNo = round?.type === 'round-started' ? round.round : 0;
    expect(minigames[roundNo - 1]).toBe('schnellfeuer');
    expect(minigames.filter((id) => id === 'schnellfeuer')).toHaveLength(1);
  });

  it('Ereignis ohne Grenze: höchstens ein Auslöser je Runde', () => {
    const { events } = play(
      game({ rule: { trigger: 'event', eventWeight: 50 }, kinds: ['event', 'event', 'event'] }),
    );
    let round = 0;
    const perRound = new Map<number, number>();
    for (const e of events) {
      if (e.type === 'round-started') round = e.round;
      if (e.type === 'board-event' && e.event === 'rapid-fire') {
        perRound.set(round, (perRound.get(round) ?? 0) + 1);
      }
    }
    expect([...perRound.values()].every((n) => n === 1)).toBe(true);
    expect(perRound.size).toBeGreaterThan(1);
  });

  it('Rückfall: Kam kein Ereignis, wird das letzte Minispiel Schnellfeuer', () => {
    const { minigames } = play(game({ rule: { trigger: 'event', finaleFallback: true } }));
    expect(minigames.map((id) => id === 'schnellfeuer')).toEqual([false, false, false, true]);
  });

  it('nie im Übungsmodus, nie allein, nie ohne Steckbrief', () => {
    const rule: RapidFireRules = { trigger: 'finale' };
    expect(play(game({ rule, rounds: 1, practice: true })).minigames).toEqual(['flink-flitzer']);
    expect(play(game({ rule, players: 1 })).minigames).not.toContain('schnellfeuer');
    expect(play(game({ rule, rapid: false })).minigames).not.toContain('schnellfeuer');
  });

  it('prüft das Schnellfeuer-Ergebnis mit seiner Wertung (mehr ist besser)', () => {
    let state = start(game({ rule: { trigger: 'finale' }, rounds: 1, players: 2 }), 0).state;
    for (let i = 0; i < 500 && state.phase !== 'minigame-play'; i++) {
      state = state.prompt ? choose(state, 'roll').state : tick(state, state.resumeAt ?? 0).state;
    }
    expect(state.minigame?.id).toBe('schnellfeuer');
    expect(state.minigame?.playMs).toBe(RAPID.playMs);
  });
});
