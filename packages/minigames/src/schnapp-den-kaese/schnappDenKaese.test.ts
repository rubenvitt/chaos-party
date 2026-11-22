import { lineup, matchMetrics, runBotMatch } from '@chaos-party/minigame-kit';
import { createMinigameRng } from '@chaos-party/minigame-sdk';
import { describe, expect, it } from 'vitest';
import { KAESE_BOT_ADAPTER } from './bot.ts';
import { KAESE_RULES, KaeseLogic, type Trap } from './logic.ts';

const STEP = 1 / 60;

function fresh(
  seed = 1,
  slots: readonly (1 | 2 | 3 | 4)[] = [1],
): { logic: KaeseLogic; trap: Trap } {
  const logic = new KaeseLogic(slots, createMinigameRng(seed), 25_000);
  const trap = logic.trap(1);
  if (!trap) throw new Error('keine Falle');
  while (trap.phase !== 'cheese') logic.step(STEP);
  return { logic, trap };
}

function stepFor(logic: KaeseLogic, seconds: number): string[] {
  const types: string[] = [];
  for (let t = 0; t < seconds - 1e-9; t += STEP) types.push(...logic.step(STEP).map((e) => e.type));
  return types;
}

describe('Schnapp den Käse – Falle', () => {
  it('Scheiben stapeln sich mit der Zeit, höchstens bis zum vollen Stapel', () => {
    const { logic, trap } = fresh();
    expect(logic.slices(trap)).toBe(1);
    trap.snapAt = 99;
    stepFor(logic, KAESE_RULES.sliceS * 2);
    expect(logic.slices(trap)).toBe(3);
    stepFor(logic, 10);
    expect(logic.slices(trap)).toBe(KAESE_RULES.maxSlices);
  });

  it('rechtzeitig zugegriffen zählt der Stapel beim Zugreifen', () => {
    const { logic, trap } = fresh(2);
    trap.snapAt = logic.clock.time + 5;
    stepFor(logic, 1);
    const slices = logic.slices(trap);
    expect(logic.grab(1)?.type).toBe('reach');
    expect(logic.grab(1)).toBeNull();
    expect(stepFor(logic, KAESE_RULES.grabS + STEP)).toContain('schnapp');
    expect(logic.board.get(1)).toBe(slices);
    expect(trap.phase).toBe('wait');
  });

  it('schnappt die Falle, während die Pfote greift: gezwickt, nichts, 1 s Pause', () => {
    const { logic, trap } = fresh(3);
    trap.snapAt = logic.clock.time + 0.3;
    logic.grab(1);
    expect(stepFor(logic, 0.4)).toContain('gezwickt');
    expect(logic.board.get(1)).toBe(0);
    expect(trap.phase).toBe('pinched');
    expect(logic.grab(1)).toBeNull();
    stepFor(logic, KAESE_RULES.pinchS - 0.2);
    expect(trap.phase).toBe('pinched');
    stepFor(logic, 0.2);
    expect(trap.phase).toBe('cheese');
  });

  it('nach dem echten Zucken ist es zu spät: die Pfote ist langsamer als die Falle', () => {
    expect(KAESE_RULES.grabS).toBeGreaterThan(KAESE_RULES.twitchLeadS);
    const { logic, trap } = fresh(4);
    trap.twitches = [];
    trap.snapAt = logic.clock.time + 2;
    const real = trap.snapAt - KAESE_RULES.twitchLeadS;
    trap.twitches.push(real);
    while (logic.clock.time < real) logic.step(STEP);
    expect(trap.twitchAt).toBeGreaterThan(0);
    logic.grab(1);
    expect(stepFor(logic, 0.6)).toContain('gezwickt');
  });

  it('wer zögert, verliert den Käse; Finten zucken ohne Zuschnappen', () => {
    const { logic } = fresh(5);
    const types = stepFor(logic, 25);
    const twitches = types.filter((t) => t === 'twitch').length;
    const snaps = types.filter((t) => t === 'leer').length;
    expect(snaps).toBeGreaterThan(4);
    expect(twitches).toBeGreaterThan(snaps);
    expect(logic.board.get(1)).toBe(0);
    expect(logic.highlights(new Map([[1, 'Blau']]))).toContain(`Blau zögert ${snaps}× zu lange.`);
  });

  it('Zuschnappen und Finten sind je Seed gleich, über die Seeds verschieden', () => {
    const snapTimes = (seed: number) => {
      const { logic, trap } = fresh(seed, [1, 2]);
      return [trap.snapAt - logic.clock.time, trap.twitches.length];
    };
    expect(snapTimes(9)).toEqual(snapTimes(9));
    const all = new Set([1, 2, 3, 4, 5, 6].map((seed) => snapTimes(seed)[0]));
    expect(all.size).toBeGreaterThan(3);
  });
});

describe('Schnapp den Käse – Bots', () => {
  it('Partien sind deterministisch, der Profi gewinnt öfter als der Neuling', () => {
    const first = runBotMatch(KAESE_BOT_ADAPTER, 3, lineup(4), 25_000);
    expect(runBotMatch(KAESE_BOT_ADAPTER, 3, lineup(4), 25_000)).toEqual(first);
    const records = Array.from({ length: 40 }, (_, seed) =>
      runBotMatch(KAESE_BOT_ADAPTER, seed + 1, lineup(4), 25_000),
    );
    const metrics = matchMetrics(records);
    expect(metrics.strongestWins).toBeGreaterThan(metrics.weakestWins);
    expect(metrics.leadChanges).toBeGreaterThan(1);
  });
});
