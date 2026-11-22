import { lineup, matchMetrics, runBotMatch } from '@chaos-party/minigame-kit';
import { createMinigameRng } from '@chaos-party/minigame-sdk';
import { describe, expect, it } from 'vitest';
import { MATSCH_BOT_ADAPTER } from './bot.ts';
import { MATSCH_RULES, MatschLogic, cellAt, cellCenter, cellsWithin } from './logic.ts';

const STEP = 1 / 60;

function runUntil(logic: MatschLogic, seconds: number) {
  const events = [];
  while (logic.clock.time < seconds - 1e-9) events.push(...logic.step(STEP));
  return events;
}

function owned(logic: MatschLogic, slot: 1 | 2): number {
  return logic.cells.filter((owner) => owner === slot).length;
}

describe('Matschmaler – Malen', () => {
  it('Raster: Feldmitte und Feld unter einem Punkt passen zusammen', () => {
    const total = MATSCH_RULES.cols * MATSCH_RULES.rows;
    for (const index of [0, 17, total - 1]) {
      const { x, z } = cellCenter(index);
      expect(cellAt(x, z)).toBe(index);
    }
    expect(cellAt(-99, -99)).toBe(0);
    expect(cellsWithin(0, 0, MATSCH_RULES.splatRadius).length).toBeGreaterThanOrEqual(8);
  });

  it('Laufen färbt das Feld unter der Figur und übermalt fremde Felder', () => {
    const logic = new MatschLogic([1, 2], createMinigameRng(1), 25_000);
    runUntil(logic, 0.1);
    expect(owned(logic, 1)).toBe(1);
    const other = logic.mudder(2);
    if (!other) throw new Error('Figur fehlt');
    const start = cellAt(other.x, other.z);
    logic.setStick(1, 0, 0);
    const me = logic.mudder(1);
    if (!me) throw new Error('Figur fehlt');
    me.x = other.x;
    me.z = other.z;
    other.x = 0;
    other.z = 0;
    runUntil(logic, 0.2);
    expect(logic.cells[start]).toBe(1);
    logic.setStick(1, 1, 0);
    runUntil(logic, 1.2);
    expect(owned(logic, 1)).toBeGreaterThan(3);
    expect(logic.board.get(1)).toBe(owned(logic, 1));
  });

  it('Bauchplatscher färbt einen großen Kreis, danach benommen und Abklingzeit', () => {
    const logic = new MatschLogic([1], createMinigameRng(2), 25_000);
    logic.setStick(1, 1, 0);
    runUntil(logic, 0.1);
    expect(logic.splat(1)).toBe(true);
    expect(logic.splat(1)).toBe(false);
    const events = runUntil(logic, 0.1 + MATSCH_RULES.dashS + 0.05);
    expect(events.some((event) => event.type === 'splat')).toBe(true);
    expect(owned(logic, 1)).toBeGreaterThanOrEqual(8);
    const me = logic.mudder(1);
    expect(me && logic.clock.time < me.stunUntil).toBe(true);
    const x = me?.x;
    runUntil(logic, 0.5);
    expect(me?.x).toBe(x);
    expect(logic.splat(1)).toBe(false);
    runUntil(logic, 0.1 + MATSCH_RULES.dashCooldownS + 0.05);
    expect(logic.splat(1)).toBe(true);
  });

  it('Regen wird angekündigt, wäscht seinen Streifen neutral und lässt Figuren ausrutschen', () => {
    const logic = new MatschLogic([1], createMinigameRng(3), 25_000);
    logic.cells.fill(1);
    const events = runUntil(logic, MATSCH_RULES.rainFirstS + 0.05);
    const warn = events.find((event) => event.type === 'rain' && event.phase === 'warn');
    if (warn?.type !== 'rain') throw new Error('kein Regen angekündigt');
    const me = logic.mudder(1);
    if (!me) throw new Error('Figur fehlt');
    ({ x: me.x, z: me.z } = { x: warn.rain.shape.x, z: warn.rain.shape.z });
    const before = owned(logic, 1);
    const later = runUntil(logic, warn.rain.activeAt + 0.05);
    expect(later.some((event) => event.type === 'slip' && event.slot === 1)).toBe(true);
    expect(owned(logic, 1)).toBeLessThanOrEqual(
      before - 2 * Math.min(MATSCH_RULES.cols, MATSCH_RULES.rows) + 1,
    );
    expect(logic.tally.get(1, 'nass')).toBeGreaterThan(0);
  });

  it('Regen kommt deterministisch je Seed', () => {
    const rains = (seed: number) =>
      runUntil(new MatschLogic([1, 2], createMinigameRng(seed), 25_000), 25).filter(
        (event) => event.type === 'rain' && event.phase === 'warn',
      );
    expect(rains(5)).toEqual(rains(5));
    expect(rains(5).length).toBe(3);
  });
});

describe('Matschmaler – Bots', () => {
  it('Partien sind deterministisch, der Profi gewinnt öfter als der Neuling', () => {
    const first = runBotMatch(MATSCH_BOT_ADAPTER, 3, lineup(4), 25_000);
    expect(runBotMatch(MATSCH_BOT_ADAPTER, 3, lineup(4), 25_000)).toEqual(first);
    const records = Array.from({ length: 40 }, (_, seed) =>
      runBotMatch(MATSCH_BOT_ADAPTER, seed + 1, lineup(4), 25_000),
    );
    const metrics = matchMetrics(records);
    expect(metrics.strongestWins).toBeGreaterThan(metrics.weakestWins);
    expect(metrics.winnerScore).toBeGreaterThan(25);
  });
});
