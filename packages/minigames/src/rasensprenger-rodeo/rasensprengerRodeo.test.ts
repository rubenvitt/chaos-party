import { lineup, matchMetrics, runBotMatch } from '@chaos-party/minigame-kit';
import { createMinigameRng } from '@chaos-party/minigame-sdk';
import { describe, expect, it } from 'vitest';
import { RODEO_BOT_ADAPTER } from './bot.ts';
import { RODEO_RULES, RodeoLogic, jetHits, type Sprinkler } from './logic.ts';

const STEP = 1 / 60;

/** Lässt die Logik laufen, bis `done` gilt (höchstens die ganze Partie). */
function runUntil(logic: RodeoLogic, done: () => boolean): void {
  while (!done()) {
    if (logic.finished) throw new Error('Bedingung nie erreicht');
    logic.step(STEP);
  }
}

/** Richtet einen Sprenger von Hand ein (spritzt, steht still auf `angle`). */
function spray(sprinkler: Sprinkler, angle: number, reach = 5): void {
  Object.assign(sprinkler, { phase: 'spray', angle, spin: 0, reach, sprayAt: 0, stopAt: 99 });
  sprinkler.reverseAt = null;
}

describe('Rasensprenger-Rodeo – Strahl und Treffer', () => {
  it('der Strahl trifft entlang seiner Richtung bis zur Reichweite, mit Körperbreite', () => {
    const logic = new RodeoLogic([1], createMinigameRng(1), 30_000);
    const sprinkler = logic.sprinklers[0];
    if (!sprinkler) throw new Error('kein Sprenger');
    spray(sprinkler, 0, 4);
    const at = (dx: number, dz: number) => ({ x: sprinkler.x + dx, z: sprinkler.z + dz });
    expect(jetHits(sprinkler, at(2, 0))).toBe(true);
    expect(jetHits(sprinkler, at(2, 0.6))).toBe(true);
    expect(jetHits(sprinkler, at(2, 1.0))).toBe(false);
    expect(jetHits(sprinkler, at(4.6, 0))).toBe(false);
    expect(jetHits(sprinkler, at(-2, 0))).toBe(false);
    // Rodeo-Bonus: dicht daneben zählt, weiter weg nicht.
    expect(logic.riding(at(2, 1.5))).toBe(true);
    expect(logic.riding(at(2, 3))).toBe(false);
    sprinkler.phase = 'warn';
    expect(jetHits(sprinkler, at(2, 0))).toBe(false);
  });

  it('Treffer: Herz weg, kurz unverwundbar, nass rutscht nach; ohne Herzen raus', () => {
    const logic = new RodeoLogic([1], createMinigameRng(2), 30_000);
    const runner = logic.runner(1);
    const sprinkler = logic.sprinklers[0];
    if (!runner || !sprinkler) throw new Error('fehlt');
    logic.sprinklers.forEach((s) => (s.phase = 'idle'));
    Object.assign(runner, { x: sprinkler.x + 2, z: sprinkler.z });
    spray(sprinkler, 0);
    const events = logic.step(STEP);
    expect(events).toContainEqual({ type: 'hit', runner });
    expect(runner.hearts).toBe(2);
    logic.step(STEP);
    expect(runner.hearts).toBe(2);
    expect(logic.isWet(runner)).toBe(true);
    // Nass: Der Stick zieht nur langsam, die Figur rutscht noch in die alte Richtung.
    Object.assign(runner, { vx: 4, vz: 0 });
    logic.setStick(1, -1, 0);
    logic.step(STEP);
    expect(runner.vx).toBeGreaterThan(3);
    runUntil(logic, () => runner.hearts === 0);
    expect(logic.tally.get(1, 'nass')).toBe(3);
    const at = { x: runner.x, z: runner.z };
    logic.setStick(1, 1, 1);
    logic.step(0.5);
    expect({ x: runner.x, z: runner.z }).toEqual(at);
  });

  it('Punkte je Zehntelsekunde: trocken 2, dicht am Strahl 3, nass 1, raus 0', () => {
    const logic = new RodeoLogic([1, 2], createMinigameRng(3), 30_000);
    const [a, b] = logic.runners;
    const sprinkler = logic.sprinklers[0];
    if (!a || !b || !sprinkler) throw new Error('fehlt');
    logic.sprinklers.forEach((s) => (s.phase = 'idle'));
    spray(sprinkler, 0);
    Object.assign(a, { x: sprinkler.x + 2, z: sprinkler.z + 1.5 });
    Object.assign(b, { x: -sprinkler.x, z: -sprinkler.z });
    for (let i = 0; i < 6; i++) logic.step(STEP);
    expect(logic.board.get(1)).toBe(3);
    expect(logic.board.get(2)).toBe(2);
    b.wetUntil = 99;
    for (let i = 0; i < 6; i++) logic.step(STEP);
    expect(logic.board.get(2)).toBe(3);
  });

  it('Sprenger springen angekündigt an, höchstens zwei zugleich; zum Schluss alle', () => {
    const logic = new RodeoLogic([1, 2, 3, 4], createMinigameRng(4), 30_000);
    let most = 0;
    let warned = 0;
    let finale = false;
    while (!logic.finished) {
      for (const event of logic.step(STEP)) {
        if (event.type === 'warn') warned++;
        if (event.type === 'finale') finale = true;
      }
      const on = logic.sprinklers.filter((s) => s.phase !== 'idle').length;
      if (!logic.clock.finale) most = Math.max(most, on);
      if (logic.clock.remainingS < RODEO_RULES.finale.seconds - 1) expect(on).toBe(3);
    }
    expect(finale).toBe(true);
    expect(most).toBe(2);
    expect(warned).toBeGreaterThan(5);
  });

  it('Höhepunkte nennen den Nässesten', () => {
    const logic = new RodeoLogic([1, 2], createMinigameRng(5), 30_000);
    logic.tally.count(1, 'nass', 2);
    const lines = logic.highlights(new Map([[1, 'Blau']]));
    expect(lines).toContain('Blau wird 2× klatschnass.');
  });
});

describe('Rasensprenger-Rodeo – Bots', () => {
  it('Partien sind deterministisch, der Profi gewinnt öfter als der Neuling', () => {
    const first = runBotMatch(RODEO_BOT_ADAPTER, 3, lineup(4), 30_000);
    expect(runBotMatch(RODEO_BOT_ADAPTER, 3, lineup(4), 30_000)).toEqual(first);
    const records = Array.from({ length: 30 }, (_, seed) =>
      runBotMatch(RODEO_BOT_ADAPTER, seed + 1, lineup(4), 30_000),
    );
    const metrics = matchMetrics(records);
    expect(metrics.strongestWins).toBeGreaterThan(metrics.weakestWins);
    expect(metrics.leadChanges).toBeGreaterThan(1);
  });
});
