import { createMinigameRng, type MinigameInput, type Slot } from '@chaos-party/minigame-sdk';
import { runMinigameHeadless } from '@chaos-party/minigame-sdk/testing';
import { describe, expect, it } from 'vitest';
import type { SumoBotPawn } from './bot.ts';
import { EiswuerfelSumo, eiswuerfelSumo } from './index.ts';
import { LIMO, MELT, POINTS, SumoRules, bannerFor, cubeHalf, meltLevel } from './logic.ts';
import { meltWarning, respawnPoint, statusFor } from './logic.ts';

const STEP = 1 / 60;

function advance(rules: SumoRules, seconds: number, onIce: readonly Slot[] = []): void {
  for (let t = 0; t < seconds - 1e-9; t += STEP) {
    rules.clock.tick(STEP);
    for (const slot of onIce) rules.onIce(slot, STEP);
  }
  rules.refresh();
}

describe('Eiswürfel-Sumo – Schmelzen', () => {
  it('schmilzt in Stufen bis auf die Endgröße und warnt vorher', () => {
    expect(meltLevel(0)).toBe(0);
    expect(meltLevel(MELT.startS - 0.01)).toBe(0);
    expect(meltLevel(MELT.startS)).toBe(1);
    expect(meltLevel(29.9)).toBe(MELT.steps);
    expect(cubeHalf(0)).toBe(MELT.startHalf);
    expect(cubeHalf(MELT.steps)).toBeCloseTo(MELT.endHalf, 9);
    expect(cubeHalf(MELT.steps + 3)).toBeCloseTo(MELT.endHalf, 9);
    for (let level = 1; level <= MELT.steps; level++) {
      expect(cubeHalf(level)).toBeLessThan(cubeHalf(level - 1));
    }
    expect(meltWarning(MELT.startS - MELT.warnS / 2)).toBe(true);
    expect(meltWarning(MELT.startS + 0.1)).toBe(false);
    expect(meltWarning(29.5)).toBe(false);
  });

  it('Rückkehr landet im Inneren, nie genau in der Mitte, deterministisch je Seed', () => {
    const rng = createMinigameRng(4);
    for (let i = 0; i < 50; i++) {
      const { x, z } = respawnPoint(rng, 2);
      const r = Math.hypot(x, z);
      expect(r).toBeGreaterThanOrEqual(0.6 - 1e-9);
      expect(r).toBeLessThanOrEqual(1.1 + 1e-9);
    }
    expect(respawnPoint(createMinigameRng(9), 3)).toEqual(respawnPoint(createMinigameRng(9), 3));
  });
});

describe('Eiswürfel-Sumo – Wertung', () => {
  it('zählt Zehntelsekunden auf dem Eis', () => {
    const rules = new SumoRules([1, 2], 30_000);
    advance(rules, 2.55, [1]);
    expect(rules.board.get(1)).toBe(25);
    expect(rules.board.get(2)).toBe(0);
  });

  it('Rauswurf: der letzte Rempler bekommt den Bonus, der Gestürzte verliert Punkte', () => {
    const rules = new SumoRules([1, 2, 3], 30_000);
    advance(rules, 5, [1, 2, 3]);
    rules.bonk(2, 1);
    advance(rules, 1, [1, 2, 3]);
    expect(rules.fall(2)).toEqual({ credit: 1, final: false });
    rules.refresh();
    expect(rules.board.get(1)).toBe(60 + POINTS.ko);
    expect(rules.board.get(2)).toBe(60 - POINTS.fall);
    expect(rules.sumo(2)?.out).toBe(true);
    expect(statusFor(rules.sumo(2))).toBe('Plumps!');
    // Wer schon in der Limo ist, fällt nicht noch einmal.
    expect(rules.fall(2)).toEqual({ credit: null, final: false });
  });

  it('ein alter Rempler zählt nicht: Sturz ohne Gutschrift', () => {
    const rules = new SumoRules([1, 2], 30_000);
    rules.bonk(2, 1);
    advance(rules, LIMO.creditS + 0.2);
    expect(rules.fall(2).credit).toBeNull();
    expect(rules.sumo(1)?.kos).toBe(0);
  });

  it('nach der Pause kehrt man zurück, in der Schlussphase bleibt man drin', () => {
    const rules = new SumoRules([1, 2], 30_000);
    advance(rules, 3);
    rules.fall(1);
    advance(rules, LIMO.respawnS - 0.1);
    expect(rules.respawnDue()).toEqual([]);
    advance(rules, 0.2);
    expect(rules.respawnDue().map((sumo) => sumo.slot)).toEqual([1]);
    expect(rules.sumo(1)?.out).toBe(false);
    advance(rules, 30 - LIMO.finaleS - rules.clock.time + 0.1);
    expect(rules.clock.finale).toBe(true);
    expect(rules.fall(2).final).toBe(true);
    advance(rules, 3);
    expect(rules.respawnDue()).toEqual([]);
    expect(statusFor(rules.sumo(2))).toBe('in der Limo');
  });

  it('Punkte fallen nie unter 0, Texte halten die Grenzen', () => {
    const rules = new SumoRules([1, 2], 30_000);
    rules.fall(1);
    rules.refresh();
    expect(rules.board.get(1)).toBe(0);
    expect(bannerFor(MELT.startS - 0.5, false)).toBe('Der Würfel schmilzt!');
    expect(bannerFor(25, true)?.length).toBeLessThanOrEqual(32);
    expect(bannerFor(1, false)).toBeUndefined();
    rules.bonk(2, 1);
    rules.fall(2);
    const lines = rules.highlights(new Map([[1, 'Blau']]));
    expect(lines[0]).toBe('Blau schubst 1× jemanden in die Limo.');
  });
});

describe('Eiswürfel-Sumo – Havok', () => {
  /** Blau rennt Orange an und rempelt, sobald es nah ist; liefert beide Figuren danach. */
  async function bonkRun(): Promise<{ before: SumoBotPawn[]; after: SumoBotPawn[] }> {
    let game: EiswuerfelSumo | null = null;
    let pressedAt: number | null = null;
    const snaps: SumoBotPawn[][] = [];
    await runMinigameHeadless(
      { ...eiswuerfelSumo, create: () => (game = new EiswuerfelSumo()) },
      {
        players: 2,
        seed: 5,
        timeLimitMs: 3_000,
        script: (ms, send) => {
          const view = game?.view();
          const [blue, orange] = view?.pawns ?? [];
          if (!blue || !orange) return;
          const dx = orange.x - blue.x;
          const dz = orange.z - blue.z;
          const d = Math.hypot(dx, dz);
          const move: MinigameInput = { type: 'move', x: dx / d, y: dz / d };
          if (pressedAt === null) send(1, move);
          if (pressedAt === null && d < 1.6) {
            pressedAt = ms;
            send(1, { type: 'press', button: 'a' });
            send(1, { type: 'release', button: 'a' });
            snaps.push([blue, orange]);
          }
          if (pressedAt !== null && ms - pressedAt > 400 && snaps.length === 1) {
            send(1, { type: 'move', x: 0, y: 0 });
            snaps.push([blue, orange]);
          }
        },
      },
    );
    const [before, after] = snaps;
    if (!before || !after) throw new Error('kein Rempler');
    return { before, after };
  }

  it('Rempler stößt den Gegner weg und rutscht selbst zurück (Rückstoß)', async () => {
    const { before, after } = await bonkRun();
    const [blue0, orange0] = before as [SumoBotPawn, SumoBotPawn];
    const [blue1, orange1] = after as [SumoBotPawn, SumoBotPawn];
    const dir = { x: orange0.x - blue0.x, z: orange0.z - blue0.z };
    const along = (p: { vx: number; vz: number }) => p.vx * dir.x + p.vz * dir.z;
    expect(along(orange1)).toBeGreaterThan(0.5);
    expect(along(blue1)).toBeLessThan(0);
    expect(Math.hypot(orange1.x - blue1.x, orange1.z - blue1.z)).toBeGreaterThan(1.5);
  });

  it('wer nichts tut, steht still auf dem großen Würfel; Partien sind deterministisch', async () => {
    const play = async () =>
      (await runMinigameHeadless(eiswuerfelSumo, { players: 3, seed: 8, timeLimitMs: 6_000 }))
        .outcome?.result.placements;
    const first = await play();
    expect(first?.map((entry) => entry.score)).toEqual([60, 60, 60]);
    expect(await play()).toEqual(first);
  });
});
