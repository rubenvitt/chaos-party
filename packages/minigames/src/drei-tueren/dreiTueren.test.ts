import { lineup, matchMetrics, runBotMatch, BOT_PROFILES } from '@chaos-party/minigame-kit';
import { createMinigameRng } from '@chaos-party/minigame-sdk';
import { describe, expect, it } from 'vitest';
import { DOOR_BOT_ADAPTER, DoorBot, predict } from './bot.ts';
import { DOOR_RULES, DoorLogic, doorOf, type RoundRecord } from './logic.ts';

const STEP = 1 / 60;
const DURATION = 27_000;

function untilOpen(logic: DoorLogic, round: number) {
  while (logic.round < round || !logic.open) logic.step(STEP);
}

function untilReveal(logic: DoorLogic) {
  for (;;) {
    for (const event of logic.step(STEP)) if (event.type === 'reveal') return event.record;
  }
}

describe('Drei Türen – Wahl und Auszahlung', () => {
  it('Stick links/oben/rechts wählt Tür 1/2/3, in Ruhe keine', () => {
    expect(doorOf(-1, 0)).toBe(0);
    expect(doorOf(0, 1)).toBe(1);
    expect(doorOf(1, 0.2)).toBe(2);
    expect(doorOf(0.1, 0.1)).toBeNull();
    expect(doorOf(0, -1)).toBeNull();
  });

  it('nur wer allein vor einer Tür steht, bekommt ihre Münzen', () => {
    const logic = new DoorLogic([1, 2, 3, 4], createMinigameRng(1), DURATION);
    untilOpen(logic, 0);
    const values = [...logic.values];
    expect(new Set(values).size).toBe(3);
    for (const [slot, x] of [
      [1, -1],
      [2, -1],
      [3, 1],
    ] as const) {
      logic.aim(slot, x, 0);
      expect(logic.choose(slot)).toEqual({ type: 'chosen', slot });
      expect(logic.hasChosen(slot)).toBe(true);
    }
    expect(logic.choose(1)).toBeNull();
    expect(logic.hasChosen(4)).toBe(false);
    const record = untilReveal(logic);
    expect(record.crowd).toEqual([2, 0, 1]);
    expect(logic.board.entries().map((entry) => entry.score)).toEqual([0, 0, values[2], 0]);
    expect(record.choices.get(4)).toBeNull();
    expect(logic.hasChosen(1)).toBe(false);
  });

  it('A ohne Stick-Richtung wählt nichts, nach der Wahlzeit geht nichts mehr', () => {
    const logic = new DoorLogic([1, 2], createMinigameRng(2), DURATION);
    untilOpen(logic, 0);
    expect(logic.choose(1)).toBeNull();
    logic.aim(1, 0, 1);
    logic.aim(1, 0, 0);
    expect(logic.choose(1)).toBeNull();
    untilReveal(logic);
    logic.aim(1, 0, 1);
    expect(logic.choose(1)).toBeNull();
  });

  it('alle Runden enden vor dem Zeitlimit, die letzte zählt doppelt', () => {
    const logic = new DoorLogic([1], createMinigameRng(3), DURATION);
    let reveals = 0;
    let finalValues: number[] = [];
    while (!logic.finished) {
      if (logic.open && !logic.hasChosen(1)) {
        logic.aim(1, 0, 1);
        logic.choose(1);
        finalValues = [...logic.values];
      }
      for (const event of logic.step(STEP)) if (event.type === 'reveal') reveals++;
    }
    expect(reveals).toBe(DOOR_RULES.rounds);
    expect(finalValues.every((value) => value % DOOR_RULES.finalFactor === 0)).toBe(true);
    expect(logic.board.get(1)).toBeGreaterThan(DOOR_RULES.rounds * DOOR_RULES.values[0]);
    expect(logic.highlights(new Map([[1, 'Blau']]))).toContain(
      'Blau öffnet die letzte Tür allein.',
    );
  });
});

describe('Drei Türen – Bots', () => {
  it('die Vorhersage liest Gewohnheiten aus den Aufdeckungen', () => {
    const record = (door: 0 | 1 | 2): RoundRecord => ({
      values: [3, 9, 5],
      choices: new Map([[2, door]]),
      crowd: [0, 0, 0],
      payouts: new Map(),
    });
    const greedy = predict([record(1), record(1), record(1)], 2, [8, 2, 4]);
    expect(greedy[0]).toBeCloseTo(0.5);
    expect(greedy[0]).toBeGreaterThan((greedy[1] ?? 0) + (greedy[2] ?? 0) - 0.1);
    const none = predict([], 2, [8, 2, 4]);
    expect(none.map((p) => p.toFixed(3))).toEqual(['0.333', '0.333', '0.333']);
  });

  it('der Bot sieht die Wahl der laufenden Runde nicht und lässt den Stick los', () => {
    const logic = new DoorLogic([1, 2], createMinigameRng(4), DURATION);
    const bot = new DoorBot(1, BOT_PROFILES.profi, createMinigameRng(5));
    untilOpen(logic, 0);
    let action = bot.act(logic);
    while (!action) {
      logic.step(STEP);
      action = bot.act(logic);
    }
    expect(action.press).toEqual(['a']);
    expect(bot.act(logic)).toEqual({ stick: { x: 0, y: 0 } });
    expect(Object.keys(logic)).not.toContain('choices');
  });

  it('Partien sind deterministisch, der Profi gewinnt öfter als der Neuling', () => {
    const first = runBotMatch(DOOR_BOT_ADAPTER, 3, lineup(4), DURATION);
    expect(runBotMatch(DOOR_BOT_ADAPTER, 3, lineup(4), DURATION)).toEqual(first);
    const records = Array.from({ length: 60 }, (_, seed) =>
      runBotMatch(DOOR_BOT_ADAPTER, seed + 1, lineup(4), DURATION),
    );
    const metrics = matchMetrics(records);
    expect(metrics.strongestWins).toBeGreaterThan(metrics.weakestWins);
    expect(metrics.winnerScore).toBeGreaterThan(15);
  });
});
