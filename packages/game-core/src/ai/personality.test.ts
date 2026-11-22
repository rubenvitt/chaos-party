/** Spielstile der KI (CHAOS-186, ADR-020 §5): Vergabe, Gewichte, Stärke bleibt Stärke. */
import { describe, expect, it } from 'vitest';
import { createRng } from '../rng.ts';
import { itemOption, ROLL_OPTION } from '../rules/prompts.ts';
import type { Slot } from '../types.ts';
import { pickItem } from './board.ts';
import {
  assignBoardAiPersonalities,
  BOARD_AI_PERSONALITIES,
  BOARD_AI_STYLES,
  boardAiStyleParams,
  minigameBotStyleOf,
} from './personality.ts';
import { boardAiParams } from './strength.ts';

describe('assignBoardAiPersonalities', () => {
  it('gleicher Seed → gleiche Vergabe', () => {
    for (const seed of [1, 42, 0xdead_beef]) {
      const a = assignBoardAiPersonalities(seed, [2, 3, 4]);
      const b = assignBoardAiPersonalities(seed, [4, 2, 3]);
      expect([...b.entries()].sort()).toEqual([...a.entries()].sort());
    }
  });

  it('ohne Doppelung bis vier KI-Plätze, nur bekannte Stile', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const styles = [...assignBoardAiPersonalities(seed, [1, 2, 3, 4]).values()];
      expect(new Set(styles).size).toBe(4);
      for (const style of styles) expect(BOARD_AI_PERSONALITIES).toContain(style);
    }
  });

  it('verteilt über viele Seeds alle Stile auf jeden Platz', () => {
    const seen = new Map<Slot, Set<string>>();
    for (let seed = 1; seed <= 100; seed++) {
      for (const [slot, style] of assignBoardAiPersonalities(seed, [2, 3])) {
        const set = seen.get(slot) ?? new Set();
        set.add(style);
        seen.set(slot, set);
      }
    }
    expect(seen.get(2)?.size).toBe(4);
    expect(seen.get(3)?.size).toBe(4);
  });

  it('keine KI-Plätze → leere Vergabe', () => {
    expect(assignBoardAiPersonalities(7, []).size).toBe(0);
  });
});

describe('boardAiStyleParams', () => {
  it('ohne Stil genau die Stärke-Parameter', () => {
    for (const s of [0, 0.25, 0.5, 1]) expect(boardAiStyleParams(s)).toEqual(boardAiParams(s));
  });

  it('Stil ändert nicht, wie gut die KI reagiert und wie lange sie überlegt', () => {
    for (const s of [0, 0.5, 1]) {
      const plain = boardAiParams(s);
      for (const style of BOARD_AI_PERSONALITIES) {
        const params = boardAiStyleParams(s, style);
        expect(params.reactionChance).toBe(plain.reactionChance);
        expect(params.reactionDelayMs).toEqual(plain.reactionDelayMs);
        expect(params.decisionMs).toEqual(plain.decisionMs);
        expect(params.readyMs).toEqual(plain.readyMs);
        expect(params.trophyBuyChance).toBe(plain.trophyBuyChance);
        expect(params.itemWeights).toBe(BOARD_AI_STYLES[style].itemWeights);
      }
    }
  });

  it('Wahrscheinlichkeiten bleiben in [0, 1]', () => {
    for (const s of [0, 1]) {
      for (const style of BOARD_AI_PERSONALITIES) {
        const params = boardAiStyleParams(s, style);
        for (const key of ['itemUseChance', 'smartItemChance', 'avoidTrapChance'] as const) {
          expect(params[key]).toBeGreaterThanOrEqual(0);
          expect(params[key]).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('Saboteur setzt öfter Items ein als Fuchs, Draufgänger meidet Fallen seltener als Sammler', () => {
    expect(boardAiStyleParams(0.5, 'saboteur').itemUseChance).toBeGreaterThan(
      boardAiStyleParams(0.5, 'fuchs').itemUseChance,
    );
    expect(boardAiStyleParams(0.5, 'draufgaenger').avoidTrapChance).toBeLessThan(
      boardAiStyleParams(0.5, 'sammler').avoidTrapChance,
    );
  });
});

describe('pickItem', () => {
  const items = [itemOption('double-dice'), itemOption('coin-steal'), itemOption('trap')];

  it('ohne Gewichte wie pickOne (gleicher Zufallsverbrauch und Wahl)', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const a = createRng(seed);
      const b = createRng(seed);
      expect(pickItem(a, items, undefined)).toBe(items[b.int(0, items.length - 1)]);
      expect(a.state()).toBe(b.state());
    }
  });

  it('gewichtet nach Vorliebe, Gewicht 0 nie', () => {
    const rng = createRng(9);
    const counts = new Map<string, number>();
    for (let i = 0; i < 3000; i++) {
      const id = pickItem(rng, items, { 'coin-steal': 4, trap: 4, 'double-dice': 0 });
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    expect(counts.get(itemOption('double-dice'))).toBeUndefined();
    expect(counts.get(itemOption('coin-steal'))).toBeGreaterThan(1200);
    expect(counts.get(itemOption('trap'))).toBeGreaterThan(1200);
  });

  it('alle Gewichte 0 → erstes Item ohne Fehler', () => {
    expect(pickItem(createRng(1), items, { 'double-dice': 0, 'coin-steal': 0, trap: 0 })).toBe(
      items[0],
    );
    expect(pickItem(createRng(1), [], {})).toBe(ROLL_OPTION);
  });
});

describe('minigameBotStyleOf', () => {
  it('neutral ohne Stil, sonst die Neigung des Stils in gültigen Grenzen', () => {
    expect(minigameBotStyleOf(undefined)).toEqual({ risk: 0, mischief: 0 });
    expect(minigameBotStyleOf('saboteur').mischief).toBeGreaterThan(
      minigameBotStyleOf('sammler').mischief,
    );
    expect(minigameBotStyleOf('draufgaenger').risk).toBeGreaterThan(0);
    expect(minigameBotStyleOf('sammler').risk).toBeLessThan(0);
    for (const style of BOARD_AI_PERSONALITIES) {
      const { risk, mischief } = minigameBotStyleOf(style);
      expect(Math.abs(risk)).toBeLessThanOrEqual(1);
      expect(mischief).toBeGreaterThanOrEqual(0);
      expect(mischief).toBeLessThanOrEqual(1);
    }
  });
});
