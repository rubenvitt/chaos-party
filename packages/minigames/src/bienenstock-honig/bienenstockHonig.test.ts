import { lineup, matchMetrics, runBotMatch } from '@chaos-party/minigame-kit';
import { createMinigameRng } from '@chaos-party/minigame-sdk';
import { describe, expect, it } from 'vitest';
import { HONEY_BOT_ADAPTER } from './bot.ts';
import { HONEY_RULES, HoneyLogic } from './logic.ts';

const STEP = 1 / 60;

function run(logic: HoneyLogic, seconds: number) {
  const events = [];
  for (let n = 0; n < Math.round(seconds / STEP); n++) events.push(...logic.step(STEP));
  return events;
}

describe('Bienenstock-Honig – Zapfen und Sichern', () => {
  it('jeder Zapfer in Folge gibt mehr Honig, Hämmern bringt nicht mehr', () => {
    const logic = new HoneyLogic([1], createMinigameRng(1), 25_000);
    expect(logic.tap(1)).toMatchObject({ amount: HONEY_RULES.yieldBase });
    expect(logic.tap(1)).toBeNull();
    run(logic, HONEY_RULES.tapS);
    expect(logic.tap(1)).toMatchObject({ amount: HONEY_RULES.yieldBase + 1 });
    expect(logic.bank.pot(1)).toBe(2 * HONEY_RULES.yieldBase + 1);
    expect(logic.bank.banked(1)).toBe(0);
  });

  it('B sichert den Topf nach kurzer Zeit, solange wird nicht gezapft', () => {
    const logic = new HoneyLogic([1], createMinigameRng(2), 25_000);
    expect(logic.secure(1)).toBe(false);
    logic.tap(1);
    expect(logic.secure(1)).toBe(true);
    run(logic, HONEY_RULES.tapS + 0.05);
    expect(logic.tap(1)).toBeNull();
    const events = run(logic, HONEY_RULES.secureS);
    expect(events).toContainEqual({ type: 'banked', slot: 1, amount: HONEY_RULES.yieldBase });
    expect(logic.bank.banked(1)).toBe(HONEY_RULES.yieldBase);
    expect(logic.keeper(1)?.streak).toBe(0);
    expect(logic.tap(1)).toMatchObject({ amount: HONEY_RULES.yieldBase });
  });

  it('ohne Zapfen sind die Bienen ruhig und es gibt keinen Stich', () => {
    const logic = new HoneyLogic([1, 2], createMinigameRng(3), 25_000);
    const events = run(logic, 25);
    expect(events.filter((event) => event.type === 'launch')).toHaveLength(0);
    expect(logic.finished).toBe(true);
    expect(events.filter((event) => event.type === 'finale')).toHaveLength(1);
  });

  it('wer gierig zapft, wird angekündigt gestochen und verliert den Topf', () => {
    const logic = new HoneyLogic([1], createMinigameRng(4), 25_000);
    let launched = false;
    for (let n = 0; n < 2000 && !launched; n++) {
      logic.tap(1);
      launched = logic.step(STEP).some((event) => event.type === 'launch');
    }
    const bee = logic.beeFor(1);
    expect(bee?.arriveAt).toBeGreaterThan(logic.clock.time + 0.5);
    const pot = logic.bank.pot(1);
    const events = run(logic, (bee?.arriveAt ?? 0) - logic.clock.time + STEP);
    expect(events).toContainEqual({ type: 'sting', slot: 1, lost: pot });
    expect(logic.bank.pot(1)).toBe(0);
    expect(logic.keeper(1)?.state).toBe('stunned');
    expect(logic.tap(1)).toBeNull();
    expect(logic.highlights(new Map([[1, 'Blau']]))).toContain('Blau kassiert den letzten Stich.');
  });

  it('wer rechtzeitig sichert, behält den Honig trotz Stich', () => {
    const logic = new HoneyLogic([1], createMinigameRng(5), 25_000);
    for (let n = 0; n < 2000 && !logic.beeFor(1); n++) {
      logic.tap(1);
      logic.step(STEP);
    }
    const pot = logic.bank.pot(1);
    run(logic, HONEY_RULES.tapS);
    logic.secure(1);
    run(logic, HONEY_RULES.secureS + 0.05);
    expect(logic.bank.banked(1)).toBe(pot);
    run(logic, 1.5);
    expect(logic.bank.banked(1)).toBe(pot);
    expect(logic.bank.account(1)?.busts).toBe(1);
  });
});

describe('Bienenstock-Honig – Bots', () => {
  it('Partien sind deterministisch, der Profi gewinnt öfter als der Neuling', () => {
    const first = runBotMatch(HONEY_BOT_ADAPTER, 3, lineup(4), 25_000);
    expect(runBotMatch(HONEY_BOT_ADAPTER, 3, lineup(4), 25_000)).toEqual(first);
    const records = Array.from({ length: 40 }, (_, seed) =>
      runBotMatch(HONEY_BOT_ADAPTER, seed + 1, lineup(4), 25_000),
    );
    const metrics = matchMetrics(records);
    expect(metrics.strongestWins).toBeGreaterThan(metrics.weakestWins);
    expect(metrics.winnerScore).toBeGreaterThan(100);
  });
});
