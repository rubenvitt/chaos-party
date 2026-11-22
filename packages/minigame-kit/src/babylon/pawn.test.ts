import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { HavokPlugin } from '@babylonjs/core/Physics/v2/Plugins/havokPlugin.js';
import { createMinigameRng } from '@chaos-party/minigame-sdk';
import type { MinigameContext } from '@chaos-party/minigame-sdk/babylon';
import {
  EMPTY_RESIDUE,
  createHeadlessScene,
  createRecordingFx,
  createTestCharacters,
  loadHavokForNode,
  sceneResidue,
  testPlayers,
} from '@chaos-party/minigame-sdk/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { HavokBlock, bonkFx, bonkPawns, havokPawn, type HavokPawnOptions } from './pawn.ts';
import { MinigameStage } from './stage.ts';

const STEP = 1 / 60;
const RULES = {
  radius: 0.4,
  height: 1.4,
  steering: { maxSpeed: 4, responsiveness: 6, maxAcceleration: 20 },
  dash: { speed: 6, cooldownS: 1, hitS: 0.35, pauseS: 0.3 },
  push: { speed: 4, recoil: 0.5, victimPauseS: 0.25, attackerPauseS: 0.15 },
} satisfies Omit<HavokPawnOptions, 'start'>;

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

/** Bühne mit Havok im festen Takt wie die Laufzeit, Boden als `HavokBlock`. */
async function physicsStage() {
  const headless = createHeadlessScene();
  cleanups.push(() => {
    headless.dispose();
  });
  const scene = headless.scene;
  scene.enablePhysics(new Vector3(0, -9.81, 0), new HavokPlugin(false, await loadHavokForNode()));
  scene.physicsEnabled = false;
  const engine = scene.getPhysicsEngine();
  if (!engine) throw new Error('keine Physik');
  engine.setTimeStep(STEP);
  const fx = createRecordingFx();
  const ctx: MinigameContext = {
    scene,
    players: testPlayers(4),
    seed: 1,
    rng: createMinigameRng(1),
    timeLimitMs: 10_000,
    fx,
    characters: createTestCharacters(),
    testMode: true,
    pace: () => Promise.resolve(),
  };
  const stage = new MinigameStage(ctx, 'test');
  const floor = new HavokBlock(stage, 'boden');
  floor.resize(6, 1, 6);
  let time = 0;
  const step = (seconds: number, each?: (now: number) => void) => {
    for (let i = 0; i < Math.round(seconds / STEP); i++) {
      time += STEP;
      each?.(time);
      engine._step(STEP);
    }
  };
  return { ctx, stage, fx, floor, step, now: () => time };
}

function player(ctx: MinigameContext, index: number) {
  const entry = ctx.players[index];
  if (!entry) throw new Error('kein Spieler');
  return entry;
}

describe('Havok-Figur (CHAOS-241)', () => {
  it('steht aufrecht auf dem Block, lenkt zum Stick und blickt in Stickrichtung', async () => {
    const { ctx, stage, step, now } = await physicsStage();
    const pawn = await havokPawn(stage, player(ctx, 0), { ...RULES, start: { x: 2, z: 0 } });
    expect(pawn.facing.x).toBe(-1);
    expect(pawn.facing.z).toBeCloseTo(0, 9);
    step(0.5);
    expect(pawn.position.y).toBeCloseTo(0, 1);
    pawn.input({ type: 'move', x: 0.1, y: 0.1 });
    expect(pawn.facing.x).toBe(-1);
    pawn.input({ type: 'move', x: 0, y: 2 });
    expect(pawn.stick).toEqual({ x: 0, y: 1 });
    expect(pawn.facing).toEqual({ x: 0, z: 1 });
    step(1, (t) => pawn.steer(t, STEP));
    expect(pawn.velocity().z).toBeGreaterThan(3);
    expect(Math.abs(pawn.velocity().x)).toBeLessThan(0.2);
    expect(pawn.view(now())).toMatchObject({ slot: 1, out: false, canDash: true });
    pawn.dispose();
    stage.dispose();
    expect(sceneResidue(ctx.scene)).toEqual(EMPTY_RESIDUE);
  });

  it('Antritt setzt das Tempo, hat Abklingzeit und pausiert das Lenken', async () => {
    const { ctx, stage, step, now } = await physicsStage();
    const pawn = await havokPawn(stage, player(ctx, 0), { ...RULES, start: { x: 0, z: 0 } });
    step(0.3);
    pawn.input({ type: 'move', x: 1, y: 0 });
    pawn.input({ type: 'press', button: 'a' });
    expect(pawn.steer(now(), STEP)).toBe(true);
    expect(pawn.armed).toBe(true);
    expect(pawn.velocity().x).toBeCloseTo(RULES.dash.speed, 5);
    expect(pawn.dashing(now())).toBe(true);
    expect(pawn.canDash(now())).toBe(false);
    pawn.input({ type: 'press', button: 'a' });
    expect(pawn.steer(now(), STEP)).toBe(false);
    // Ohne Lenken bremst nur die Reibung: Stick zurück, in der Pause bleibt das Tempo hoch.
    pawn.input({ type: 'move', x: 0, y: 0 });
    step(0.2, (t) => pawn.steer(t, STEP));
    expect(pawn.velocity().x).toBeGreaterThan(4);
    step(1, (t) => pawn.steer(t, STEP));
    expect(pawn.velocity().x).toBeLessThan(0.5);
    expect(pawn.canDash(now())).toBe(true);
    stage.dispose();
  });

  it('Rempler trifft nur vorn, stößt das Opfer weg und den Rempler zurück', async () => {
    const { ctx, stage, fx, step, now } = await physicsStage();
    const a = await havokPawn(stage, player(ctx, 0), { ...RULES, start: { x: -0.5, z: 0 } });
    const b = await havokPawn(stage, player(ctx, 1), { ...RULES, start: { x: 0.45, z: 0 } });
    const c = await havokPawn(stage, player(ctx, 2), { ...RULES, start: { x: -0.5, z: 2.5 } });
    step(0.3);
    a.input({ type: 'move', x: 0, y: -1 });
    a.input({ type: 'press', button: 'a' });
    a.steer(now(), STEP);
    // Blick nach −z: b liegt seitlich, kein Treffer.
    expect(bonkPawns([a, b, c], now())).toEqual([]);
    a.facing = { x: 1, z: 0 };
    const [bonk, ...rest] = bonkPawns([a, b, c], now());
    expect(rest).toEqual([]);
    expect(bonk?.attacker).toBe(a);
    expect(bonk?.victim).toBe(b);
    expect(a.armed).toBe(false);
    expect(b.hitUntil).toBeCloseTo(now() + RULES.push.victimPauseS, 6);
    expect(a.velocity().x).toBeCloseTo(-RULES.push.speed * RULES.push.recoil, 5);
    if (bonk) bonkFx(ctx, bonk);
    expect(fx.record.sounds).toContain('bump');
    expect(fx.record.shakes).toEqual([0.2]);
    step(STEP);
    expect(b.velocity().x).toBeGreaterThan(2);
    // Trifft nur einmal je Antritt.
    expect(bonkPawns([a, b, c], now())).toEqual([]);
    stage.dispose();
  });

  it('parkt schwerelos, holt zurück und folgt erst danach wieder der Physik', async () => {
    const { ctx, stage, step, now } = await physicsStage();
    const a = await havokPawn(stage, player(ctx, 0), { ...RULES, start: { x: 0, z: 0 } });
    const b = await havokPawn(stage, player(ctx, 1), { ...RULES, start: { x: 0.45, z: 0 } });
    b.park();
    expect(b.parked).toBe(true);
    expect(b.body.disablePreStep).toBe(false);
    step(STEP);
    b.settle();
    expect(b.body.disablePreStep).toBe(true);
    step(0.5);
    // Parkplatz je Slot: 100 + 5 × Slot.
    expect(b.position.x).toBeCloseTo(110, 3);
    expect(b.position.y).toBeCloseTo(0, 3);
    expect(b.view(now()).out).toBe(true);
    // Geparkte Figuren trifft niemand.
    a.input({ type: 'move', x: 1, y: 0 });
    a.input({ type: 'press', button: 'a' });
    a.steer(now(), STEP);
    expect(bonkPawns([a, b], now())).toEqual([]);
    b.recall(2, 1, 2);
    step(STEP);
    b.settle();
    step(1);
    expect(b.parked).toBe(false);
    expect(b.position.x).toBeCloseTo(2, 1);
    expect(b.position.y).toBeCloseTo(0, 1);
    b.show(now(), STEP, false, { x: 9, y: -1, z: 9 });
    expect(b.figure.root.position.x).toBe(9);
    stage.dispose();
  });

  it('HavokBlock tauscht seine Box: Figuren fallen, wenn der Block schrumpft', async () => {
    const { ctx, stage, floor, step } = await physicsStage();
    const pawn = await havokPawn(stage, player(ctx, 0), { ...RULES, start: { x: 2, z: 2 } });
    step(0.5);
    expect(pawn.position.y).toBeCloseTo(0, 1);
    floor.resize(1, 1, 1);
    step(0.5);
    expect(pawn.position.y).toBeLessThan(-0.5);
    stage.dispose();
    expect(sceneResidue(ctx.scene).physicsBodies).toBe(0);
  });
});
