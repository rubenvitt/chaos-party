import { lineup, matchMetrics, runBotMatch } from '@chaos-party/minigame-kit';
import { createMinigameRng } from '@chaos-party/minigame-sdk';
import { describe, expect, it } from 'vitest';
import { NUSS_BOT_ADAPTER } from './bot.ts';
import { NUSS_RULES, NussLogic, catchPoints, inSwingZone, netX, type Nut } from './logic.ts';

const STEP = 1 / 60;

/** Logik mit einer selbst gesetzten Nuss (statt gewürfelter Würfe). */
function withNut(x: number, rotten = false, slots: (1 | 2)[] = [1]) {
  const logic = new NussLogic(slots, createMinigameRng(1), 25_000);
  const nut: Nut = { id: 999, x, from: 1, rotten, warnAt: 0, arriveAt: 0.5 };
  logic.nuts.push(nut);
  return { logic, nut };
}

function runUntil(logic: NussLogic, seconds: number) {
  const events = [];
  while (logic.clock.time < seconds - 1e-9) events.push(...logic.step(STEP));
  return events;
}

describe('Nussregen-Netz – Fangen', () => {
  it('die Kescher-Mitte gibt 10 Punkte, der Rand 6, daneben nichts', () => {
    expect(catchPoints(0)).toBe(10);
    expect(catchPoints(NUSS_RULES.reach)).toBe(6);
    const catcher = withNut(0).logic.catcher(1);
    if (!catcher) throw new Error('Fänger fehlt');
    const { logic } = withNut(netX(catcher));
    const caught = runUntil(logic, 0.55).find((event) => event.type === 'catch');
    expect(caught).toMatchObject({ type: 'catch', slot: 1, points: 10 });
    const miss = withNut(netX(catcher) + NUSS_RULES.reach + 0.3);
    expect(runUntil(miss.logic, 0.55).some((event) => event.type === 'miss')).toBe(true);
    expect(miss.logic.board.get(1)).toBe(0);
  });

  it('eine faule Nuss kostet Punkte und macht langsam', () => {
    const catcher = withNut(0).logic.catcher(1);
    if (!catcher) throw new Error('Fänger fehlt');
    const { logic } = withNut(netX(catcher), true);
    logic.board.add(1, 10);
    runUntil(logic, 0.55);
    const me = logic.catcher(1);
    expect(logic.board.get(1)).toBe(10 - NUSS_RULES.rottenPenalty);
    expect(me && logic.speed(me)).toBeCloseTo(NUSS_RULES.speed * NUSS_RULES.stinkFactor);
    runUntil(logic, 0.55 + NUSS_RULES.stinkS + 0.1);
    expect(me && logic.speed(me)).toBe(NUSS_RULES.speed);
  });

  it('Weit-Schwung fängt tief Hängendes voraus, danach 1 s lahm (Hämmern verlängert nichts)', () => {
    const catcher = withNut(0).logic.catcher(1);
    if (!catcher) throw new Error('Fänger fehlt');
    const far = catcher.x + catcher.facing * 2.2;
    const { logic, nut } = withNut(far);
    runUntil(logic, 0.45);
    const me = logic.catcher(1);
    if (!me) throw new Error('Fänger fehlt');
    expect(inSwingZone(me, nut, logic.clock.time)).toBe(true);
    expect(logic.swing(1)).toBe(true);
    const caught = runUntil(logic, 0.5).find((event) => event.type === 'catch');
    expect(caught).toMatchObject({ points: NUSS_RULES.swingPoints });
    const lameUntil = me.lameUntil;
    expect(logic.swing(1)).toBe(false);
    expect(me.lameUntil).toBe(lameUntil);
    logic.setStick(1, 1);
    const x = me.x;
    runUntil(logic, lameUntil - 0.05);
    expect(me.x).toBe(x);
    runUntil(logic, lameUntil + 0.2);
    expect(me.x).toBeGreaterThan(x);
  });

  it('lahme Kescher fangen nicht, der nächste Kescher bekommt die Nuss', () => {
    const { logic } = withNut(0, false, [1, 2]);
    const [a, b] = logic.catchers;
    if (!a || !b) throw new Error('Fänger fehlen');
    a.x = -NUSS_RULES.netOffset - 0.1;
    a.facing = 1;
    b.x = NUSS_RULES.netOffset;
    b.facing = -1;
    expect(logic.swing(2)).toBe(true);
    runUntil(logic, 0.55);
    expect(logic.board.get(1)).toBeGreaterThan(0);
    expect(logic.board.get(2)).toBe(0);
  });

  it('Würfe sind deterministisch je Seed, in der Endphase dichter', () => {
    const spawns = (seed: number) => {
      const logic = new NussLogic([1, 2], createMinigameRng(seed), 25_000);
      return runUntil(logic, 25).filter((event) => event.type === 'spawn');
    };
    expect(spawns(4)).toEqual(spawns(4));
    const all = spawns(4).map((event) => (event.type === 'spawn' ? event.nut : null));
    const late = all.filter((nut) => nut && nut.warnAt > 25 - NUSS_RULES.finaleS).length;
    const early = all.filter((nut) => nut && nut.warnAt < NUSS_RULES.finaleS).length;
    expect(late).toBeGreaterThan(early);
    expect(all.some((nut) => nut?.rotten)).toBe(true);
  });
});

describe('Nussregen-Netz – Bots', () => {
  it('Partien sind deterministisch, der Profi gewinnt öfter als der Neuling', () => {
    const first = runBotMatch(NUSS_BOT_ADAPTER, 3, lineup(4), 25_000);
    expect(runBotMatch(NUSS_BOT_ADAPTER, 3, lineup(4), 25_000)).toEqual(first);
    const records = Array.from({ length: 40 }, (_, seed) =>
      runBotMatch(NUSS_BOT_ADAPTER, seed + 1, lineup(4), 25_000),
    );
    const metrics = matchMetrics(records);
    expect(metrics.strongestWins).toBeGreaterThan(metrics.weakestWins);
    expect(metrics.winnerScore).toBeGreaterThan(40);
  });
});
