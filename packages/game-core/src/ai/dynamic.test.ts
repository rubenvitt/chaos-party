import { describe, expect, it } from 'vitest';
import { newGame } from '../rules/testUtils.ts';
import type { GameState, MinigamePlacement, Slot } from '../types.ts';
import {
  DYNAMIC_MAX_STEP,
  DYNAMIC_STRENGTH_START,
  dynamicLead,
  dynamicStanding,
  nextDynamicStrength,
  type DynamicStanding,
} from './dynamic.ts';

type Stand = Readonly<Partial<Record<Slot, { trophies?: number; coins?: number }>>>;

const BASE = newGame({ players: 4, seed: 7 });

/** Stand mit Trophäen/Münzen je Slot und optional Plätzen im Minispiel der Runde. */
function stateWith(
  stand: Stand,
  placements: readonly MinigamePlacement[] | null = null,
  aborted = false,
): Pick<GameState, 'players' | 'minigame'> {
  return {
    players: BASE.players.map((player) => ({
      ...player,
      trophies: stand[player.slot]?.trophies ?? 0,
      coins: stand[player.slot]?.coins ?? 10,
    })),
    minigame:
      placements === null
        ? null
        : {
            id: 'test',
            round: 1,
            seed: 1,
            playMs: 1000,
            repeat: false,
            playStartedAt: 0,
            placements,
            highlights: [],
            aborted,
            rewards: null,
          },
  };
}

const EVEN: DynamicStanding = { trophyGap: 0, coinGap: 0, placeGap: 0 };

describe('Dynamische KI-Stärke (CHAOS-187, ADR-020 §4)', () => {
  it('startet bei mittel', () => {
    expect(DYNAMIC_STRENGTH_START).toBe(0.5);
  });

  it('KI vorn → s sinkt, KI hinten → s steigt, gleichauf → s bleibt', () => {
    expect(nextDynamicStrength(0.5, { ...EVEN, trophyGap: 1 })).toBe(0.25);
    expect(nextDynamicStrength(0.5, { ...EVEN, trophyGap: -1 })).toBe(0.75);
    expect(nextDynamicStrength(0.5, EVEN)).toBe(0.5);
    expect(nextDynamicStrength(0.5, null)).toBe(0.5);
  });

  it('Schritt höchstens eine halbe Stufe, egal wie groß der Abstand ist', () => {
    for (const trophyGap of [-9, -3, -1, 1, 3, 9]) {
      const next = nextDynamicStrength(0.5, { ...EVEN, trophyGap });
      expect(Math.abs(next - 0.5)).toBeLessThanOrEqual(DYNAMIC_MAX_STEP);
    }
    for (let coinGap = -40; coinGap <= 40; coinGap++) {
      for (const placeGap of [-3, -1.5, 0, 1, 3, null]) {
        const next = nextDynamicStrength(0.5, { trophyGap: 0, coinGap, placeGap });
        expect(Math.abs(next - 0.5)).toBeLessThanOrEqual(DYNAMIC_MAX_STEP);
      }
    }
  });

  it('bleibt zwischen 0 und 1', () => {
    expect(nextDynamicStrength(0.1, { ...EVEN, trophyGap: 2 })).toBe(0);
    expect(nextDynamicStrength(0.9, { ...EVEN, trophyGap: -2 })).toBe(1);
    expect(nextDynamicStrength(0, { ...EVEN, trophyGap: 1 })).toBe(0);
    expect(nextDynamicStrength(1, { ...EVEN, trophyGap: -1 })).toBe(1);
    expect(nextDynamicStrength(Number.NaN, EVEN)).toBe(0.5);
  });

  it('von leicht nach schwer dauert es mindestens vier Runden', () => {
    let s = 0;
    const behind: DynamicStanding = { ...EVEN, trophyGap: -5 };
    const path = [0, 1, 2, 3].map(() => (s = nextDynamicStrength(s, behind)));
    expect(path).toEqual([0.25, 0.5, 0.75, 1]);
  });

  it('Reihenfolge: Trophäen vor Münzen vor letztem Minispiel', () => {
    // Trophäe vorn schlägt Münzen und Platz hinten.
    expect(dynamicLead({ trophyGap: 1, coinGap: -30, placeGap: -3 })).toBe(1);
    // Gleiche Trophäen: Münzen entscheiden, Platz zählt nicht.
    expect(dynamicLead({ trophyGap: 0, coinGap: -10, placeGap: 3 })).toBe(-1);
    expect(dynamicLead({ trophyGap: 0, coinGap: 5, placeGap: -3 })).toBe(0.5);
    // Münzen fast gleich: das letzte Minispiel, höchstens ein halber Schritt.
    expect(dynamicLead({ trophyGap: 0, coinGap: 2, placeGap: 1 })).toBe(0.25);
    expect(dynamicLead({ trophyGap: 0, coinGap: -2, placeGap: -3 })).toBe(-0.5);
    expect(dynamicLead({ trophyGap: 0.25, coinGap: 0, placeGap: null })).toBe(0);
  });

  it('Maß: Median der Menschen (bei gerader Zahl Mittel der beiden mittleren)', () => {
    // KI Slot 4 gegen Menschen 1–3: Median Trophäen 1, Münzen 12.
    const three = stateWith({
      1: { trophies: 0, coins: 4 },
      2: { trophies: 1, coins: 12 },
      3: { trophies: 3, coins: 30 },
      4: { trophies: 1, coins: 20 },
    });
    expect(dynamicStanding(three, 4, [1, 2, 3])).toEqual({
      trophyGap: 0,
      coinGap: 8,
      placeGap: null,
    });
    // Zwei Menschen: Median = Mittel.
    const two = stateWith({ 1: { trophies: 0 }, 2: { trophies: 1 }, 3: { trophies: 1 } });
    expect(dynamicStanding(two, 3, [1, 2])?.trophyGap).toBe(0.5);
    expect(nextDynamicStrength(0.5, dynamicStanding(two, 3, [1, 2]))).toBe(0.375);
  });

  it('Solo: der eine Mensch zählt; Plätze aus dem Minispiel der Runde', () => {
    const placements: MinigamePlacement[] = [
      { slot: 2, place: 1, score: 9 },
      { slot: 1, place: 2, score: 5 },
      { slot: 3, place: 3, score: 4 },
      { slot: 4, place: 4, score: 1 },
    ];
    const state = stateWith({}, placements);
    expect(dynamicStanding(state, 2, [1])).toEqual({ trophyGap: 0, coinGap: 0, placeGap: 1 });
    expect(nextDynamicStrength(0.5, dynamicStanding(state, 2, [1]))).toBe(0.437);
    expect(dynamicStanding(state, 4, [1])?.placeGap).toBe(-2);
    expect(nextDynamicStrength(0.5, dynamicStanding(state, 4, [1]))).toBe(0.625);
  });

  it('abgebrochenes Minispiel und fehlende Menschen zählen nicht', () => {
    const placements: MinigamePlacement[] = [{ slot: 2, place: 1, score: 9 }];
    expect(dynamicStanding(stateWith({}, placements, true), 2, [1])?.placeGap).toBeNull();
    expect(dynamicStanding(stateWith({}, placements), 2, [1])?.placeGap).toBeNull();
    expect(dynamicStanding(stateWith({}), 2, [])).toBeNull();
  });

  it('deterministisch: gleicher Stand → gleiche Stärke, unabhängig von der Reihenfolge der Menschen', () => {
    const state = stateWith({ 1: { coins: 3 }, 2: { coins: 25 }, 3: { coins: 15 } });
    const a = nextDynamicStrength(0.5, dynamicStanding(state, 3, [1, 2]));
    const b = nextDynamicStrength(0.5, dynamicStanding(state, 3, [2, 1]));
    expect(a).toBe(b);
    expect(a).toBe(
      nextDynamicStrength(
        0.5,
        dynamicStanding(JSON.parse(JSON.stringify(state)) as typeof state, 3, [1, 2]),
      ),
    );
  });
});
