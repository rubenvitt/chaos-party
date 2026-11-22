import { lineup, matchMetrics, runBotMatch } from '@chaos-party/minigame-kit';
import { createMinigameRng } from '@chaos-party/minigame-sdk';
import { describe, expect, it } from 'vitest';
import { TOASTER_BOT_ADAPTER } from './bot.ts';
import { TOASTER_RULES, ToasterLogic, toastPoints, toastResult } from './logic.ts';

const STEP = 1 / 60;

/** Lässt die Logik laufen, bis der Toast von `slot` mindestens `browning` erreicht hat. */
function toastUntil(logic: ToasterLogic, slot: 1 | 2, browning: number): void {
  for (let guard = 0; guard < 2000; guard++) {
    const toaster = logic.toaster(slot);
    if (toaster?.loaded && toaster.browning >= browning) return;
    logic.step(STEP);
  }
  throw new Error('Toast wurde nie so braun');
}

describe('Toaster-Timing – Wertung', () => {
  it('goldbraun gibt volle Punkte, blass und verkohlt wenig bis nichts', () => {
    expect(toastPoints(TOASTER_RULES.golden)).toBe(10);
    expect(toastPoints(0.8)).toBe(8);
    expect(toastPoints(1.0)).toBe(8);
    expect(toastPoints(0.2)).toBe(0);
    expect(toastPoints(TOASTER_RULES.burnt)).toBe(0);
    expect(toastResult(0.9)).toBe('golden');
    expect(toastResult(0.75)).toBe('good');
    expect(toastResult(0.4)).toBe('pale');
    expect(toastResult(1.1)).toBe('good');
    expect(toastResult(1.4)).toBe('burnt');
  });

  it('A wertet die Bräunung, ohne Toast im Schlitz passiert nichts', () => {
    const logic = new ToasterLogic([1, 2], createMinigameRng(3), 25_000);
    expect(logic.pop(1)).toBeNull();
    toastUntil(logic, 1, 0.9);
    const event = logic.pop(1);
    expect(event).toMatchObject({ type: 'pop', slot: 1 });
    expect(logic.board.get(1)).toBeGreaterThanOrEqual(9);
    expect(logic.pop(1)).toBeNull();
    expect(logic.toaster(1)?.last?.result).toBe('golden');
  });

  it('wer nie drückt, lässt verkohlen; nach der Pause steckt ein neuer Toast', () => {
    const logic = new ToasterLogic([1], createMinigameRng(8), 25_000);
    const seen: string[] = [];
    let serials = 0;
    while (!logic.finished) {
      for (const event of logic.step(STEP)) seen.push(event.type);
      serials = logic.toaster(1)?.serial ?? 0;
    }
    expect(seen.filter((type) => type === 'burn').length).toBeGreaterThan(3);
    expect(seen.filter((type) => type === 'finale')).toHaveLength(1);
    expect(serials).toBeGreaterThan(4);
    expect(logic.board.get(1)).toBe(0);
    expect(logic.highlights(new Map([[1, 'Blau']]))[0]).toMatch(
      /^Blau lässt \d+ Toasts verkohlen\.$/,
    );
  });

  it('jeder Toast zieht sein Tempo, deterministisch je Seed', () => {
    const rates = (seed: number) => {
      const logic = new ToasterLogic([1, 2, 3, 4], createMinigameRng(seed), 25_000);
      logic.step(0.5);
      return logic.toasters.map((toaster) => toaster.rate);
    };
    expect(rates(5)).toEqual(rates(5));
    const all = new Set([1, 2, 3, 4, 5, 6].flatMap(rates));
    expect(all.size).toBeGreaterThan(1);
    for (const rate of all) expect(TOASTER_RULES.rates).toContain(rate);
  });

  it('in der Endphase rösten alle Toaster schneller', () => {
    const logic = new ToasterLogic([1], createMinigameRng(2), 25_000);
    const growth = () => {
      toastUntil(logic, 1, 0.01);
      const toaster = logic.toaster(1);
      const before = toaster?.browning ?? 0;
      logic.step(STEP);
      return ((toaster?.browning ?? 0) - before) / (toaster?.rate ?? 1) / STEP;
    };
    expect(growth()).toBeCloseTo(1, 5);
    while (!logic.clock.finale) {
      logic.pop(1);
      logic.step(STEP);
    }
    expect(growth()).toBeCloseTo(TOASTER_RULES.finaleFactor, 5);
  });
});

describe('Toaster-Timing – Bots', () => {
  it('Partien sind deterministisch, der Profi gewinnt öfter als der Neuling', () => {
    const first = runBotMatch(TOASTER_BOT_ADAPTER, 3, lineup(4), 25_000);
    expect(runBotMatch(TOASTER_BOT_ADAPTER, 3, lineup(4), 25_000)).toEqual(first);
    const records = Array.from({ length: 40 }, (_, seed) =>
      runBotMatch(TOASTER_BOT_ADAPTER, seed + 1, lineup(4), 25_000),
    );
    const metrics = matchMetrics(records);
    expect(metrics.strongestWins).toBeGreaterThan(metrics.weakestWins);
    expect(metrics.winnerScore).toBeGreaterThan(40);
  });
});
