/**
 * Eiswürfel-Sumo (MG-023) – Physik und Ansicht: ein schmelzender Eiswürfel im Glas Limo, feste
 * Kamera schräg von oben. Figuren sind Havok-Kapseln ohne Drehung, der Würfel ein statischer
 * Körper, dessen Box je Schmelzstufe getauscht wird. Regeln in `logic.ts`.
 */
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder.js';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder.js';
import { CreateTorus } from '@babylonjs/core/Meshes/Builders/torusBuilder.js';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { PhysicsMotionType } from '@babylonjs/core/Physics/v2/IPhysicsEnginePlugin.js';
import { PhysicsBody } from '@babylonjs/core/Physics/v2/physicsBody.js';
import { PhysicsShapeBox, PhysicsShapeCapsule } from '@babylonjs/core/Physics/v2/physicsShape.js';
import * as Kit from '@chaos-party/minigame-kit';
import { MinigameStage, SlotFigure, celebrateFigures } from '@chaos-party/minigame-kit/babylon';
import { createCamera, type StageMaterialOptions } from '@chaos-party/minigame-kit/babylon';
import type { MinigameInput, MinigameResult, Slot } from '@chaos-party/minigame-sdk';
import type * as Sdk from '@chaos-party/minigame-sdk/babylon';
import { createSumoBot, type SumoBotView } from './bot.ts';
import { EISWUERFEL_SUMO_INFO as INFO } from './info.ts';
import { BUMP, LIMO, PAWN, PUSH, SumoRules, bannerFor, statusFor } from './logic.ts';
import { cubeHalf, meltLevel, meltWarning, respawnPoint } from './logic.ts';

const DEPTH = 2.4;
const GLASS_R = 5.6;
const v3 = (x = 0, y = 0, z = 0) => new Vector3(x, y, z);
const velocity = v3();

interface Pawn {
  readonly slot: Slot;
  readonly node: TransformNode;
  readonly body: PhysicsBody;
  readonly figure: SlotFigure;
  stick: { x: number; y: number };
  facing: { x: number; z: number };
  dashQueued: boolean;
  lastDash: number;
  hitUntil: number;
  /** Rempler trifft nur einmal; `floating`: treibt in der Limo (Körper geparkt). */
  armed: boolean;
  floating: { x: number; z: number } | null;
}

export class EiswuerfelSumo implements Sdk.Minigame {
  private ctx: Sdk.MinigameContext | null = null;
  private stage: MinigameStage | null = null;
  private rules: SumoRules | null = null;
  private result: MinigameResult | null = null;
  private running = false;
  private readonly pawns: Pawn[] = [];
  private readonly teleported: PhysicsBody[] = [];
  private iceBody: PhysicsBody | null = null;
  private iceLevel = -1;
  private ice: TransformNode | null = null;
  private rim: TransformNode | null = null;

  async prepare(ctx: Sdk.MinigameContext): Promise<void> {
    this.ctx = ctx;
    const slots = ctx.players.map((player) => player.slot);
    this.rules = new SumoRules(slots, ctx.timeLimitMs);
    const stage = (this.stage = new MinigameStage(ctx, 'eis'));
    createCamera(stage, 'fest', Kit.arenaLayout({ form: 'insel', radius: GLASS_R }), {
      position: { x: 0, y: 10.5, z: -8.2 },
      target: { x: 0, y: -0.9, z: 0.4 },
    });
    stage.backdrop({ halfX: GLASS_R + 1, halfZ: GLASS_R + 1, groundY: -3, surface: 'decke' });
    await this.buildScene(stage);
    this.iceBody = physicsBody(stage, stage.node('eiskoerper'), PhysicsMotionType.STATIC);
    this.melt(0);
    for (const [index, player] of ctx.players.entries()) {
      this.pawns.push(await createPawn(stage, player, Math.PI / 4 + (index * Math.PI) / 2));
    }
    this.sync(0);
  }

  start(): void {
    this.running = true;
    this.ctx?.fx.sound('go');
  }

  createBot: NonNullable<Sdk.Minigame['createBot']> = (options) =>
    createSumoBot(options, () => (this.running ? this.view() : null));

  /** Was am Bildschirm zu sehen ist (Bot, Fairness-Prüfung). */
  view(): SumoBotView | null {
    if (!this.rules) return null;
    const now = this.rules.clock.time;
    const level = meltLevel(now);
    const pawns = this.pawns.map((pawn) => {
      pawn.body.getLinearVelocityToRef(velocity);
      const { x, z } = pawn.node.position;
      const [out, canDash] = [!!pawn.floating, now - pawn.lastDash >= BUMP.cooldownS];
      return { slot: pawn.slot, x, z, vx: velocity.x, vz: velocity.z, out, canDash };
    });
    return { pawns, half: cubeHalf(level), nextHalf: cubeHalf(level + +meltWarning(now)) };
  }

  handleInput(slot: Slot, input: MinigameInput): void {
    const pawn = this.pawns.find((entry) => entry.slot === slot);
    if (!this.running || !pawn) return;
    if (input.type === 'press' && input.button === 'a') pawn.dashQueued = true;
    if (input.type !== 'move') return;
    const stick = (pawn.stick = Kit.clampStick(input.x, input.y));
    const length = Math.hypot(stick.x, stick.y);
    if (length > 0.2) pawn.facing = { x: stick.x / length, z: stick.y / length };
  }

  update(dt: number): void {
    for (const body of this.teleported.splice(0)) body.disablePreStep = true;
    const { rules, ctx } = this;
    if (!rules || !ctx) return;
    if (this.running) {
      if (rules.clock.tick(dt).finaleStarted) ctx.fx.sound('buzz');
      if (meltLevel(rules.clock.time) !== this.iceLevel) this.melt(meltLevel(rules.clock.time));
      for (const sumo of rules.respawnDue()) this.respawn(sumo.slot, rules, ctx);
      for (const pawn of this.pawns) this.steer(pawn, rules, ctx, dt);
      this.checkBonks(rules, ctx);
    }
    for (const pawn of this.pawns) {
      if (!pawn.floating && pawn.node.position.y < LIMO.outY) this.splash(pawn, rules, ctx);
    }
    rules.refresh();
    if (this.running && rules.clock.expired) this.finish();
    this.sync(dt);
  }

  getResult(): MinigameResult | null {
    return this.result;
  }

  getHud(): Sdk.MinigameHud {
    const rules = this.rules;
    if (!rules) return { remainingMs: INFO.durationMs, scores: [] };
    const banner = this.result ? undefined : bannerFor(rules.clock.time, rules.clock.finale);
    return {
      remainingMs: rules.clock.remainingMs,
      scores: rules.board.hud((slot) => statusFor(rules.sumo(slot))),
      ...(banner ? { banner } : {}),
    };
  }

  dispose(): void {
    this.running = false;
    for (const pawn of this.pawns.splice(0)) pawn.figure.dispose();
    this.stage?.dispose();
    this.stage = null;
  }

  /** Neue Schmelzstufe: Box des Würfels tauschen (alte Formen räumt die Bühne ab). */
  private melt(level: number): void {
    const { stage, iceBody, ctx } = this;
    if (!stage || !iceBody || !ctx) return;
    const half = cubeHalf(level);
    const size = v3(half * 2, DEPTH, half * 2);
    const shape = new PhysicsShapeBox(v3(0, -DEPTH / 2), Quaternion.Identity(), size, ctx.scene);
    shape.material = { friction: 0.02, restitution: 0.1 };
    iceBody.shape = stage.track(shape);
    if (this.iceLevel >= 0) ctx.fx.sound('splash', { volume: 0.5, pitch: 1.4 });
    this.iceLevel = level;
  }

  private steer(pawn: Pawn, rules: SumoRules, ctx: Sdk.MinigameContext, dt: number): void {
    const { x, y, z } = pawn.node.position;
    if (pawn.floating || y < -0.4) return;
    if (Math.max(Math.abs(x), Math.abs(z)) > rules.half + 0.05) return;
    rules.onIce(pawn.slot, dt);
    const now = rules.clock.time;
    pawn.body.getLinearVelocityToRef(velocity);
    if (pawn.dashQueued && now - pawn.lastDash >= BUMP.cooldownS) {
      // Rempeln setzt das Tempo (nicht obendrauf): Anlauf macht den Stoß nicht stärker.
      Object.assign(pawn, { lastDash: now, armed: true });
      const { x: fx, z: fz } = pawn.facing;
      pawn.body.setLinearVelocity(v3(fx * BUMP.dash, velocity.y, fz * BUMP.dash));
      ctx.fx.sound('whoosh', { volume: 0.4, pitch: 1.3 });
    }
    pawn.dashQueued = false;
    if (now < pawn.hitUntil || now - pawn.lastDash < BUMP.pauseS) return;
    const dv = Kit.steeringDeltaV(velocity, pawn.stick, dt, PAWN);
    pawn.body.applyImpulse(v3(dv.x, 0, dv.z), pawn.node.position);
  }

  /** Treffer: Opfer fliegt nach außen, der Rempler rutscht zurück (Rückstoß). */
  private checkBonks(rules: SumoRules, ctx: Sdk.MinigameContext): void {
    const now = rules.clock.time;
    for (const attacker of this.pawns) {
      if (!attacker.armed || now - attacker.lastDash > BUMP.hitS) continue;
      const a = attacker.node.position;
      const victim = this.pawns.find((other) => {
        const v = other.node.position;
        const [dx, dz] = [v.x - a.x, v.z - a.z];
        const d = Math.hypot(dx, dz);
        // Nur was vorn liegt, wird getroffen: Zielen zählt.
        const ahead = dx * attacker.facing.x + dz * attacker.facing.z > d * 0.6;
        const near = d < PAWN.radius * 2 + 0.15 && ahead && Math.abs(v.y - a.y) < 1;
        return other !== attacker && !other.floating && near;
      });
      if (!victim) continue;
      const v = victim.node.position;
      const d = Math.max(Math.hypot(v.x - a.x, v.z - a.z), 1e-4);
      const nx = (v.x - a.x) / d;
      const nz = (v.z - a.z) / d;
      victim.body.applyImpulse(v3(nx * PUSH.speed, 1, nz * PUSH.speed), v);
      const back = -PUSH.speed * PUSH.recoil;
      attacker.body.setLinearVelocity(v3(nx * back, 0.5, nz * back));
      victim.hitUntil = now + BUMP.hitPauseS;
      Object.assign(attacker, { armed: false, hitUntil: now + BUMP.hitPauseS * 0.6 });
      rules.bonk(victim.slot, attacker.slot);
      ctx.fx.sound('bump', { pitch: 0.9 + ctx.rng.next() * 0.3 });
      ctx.fx.burst('impact', { x: (a.x + v.x) / 2, y: a.y + 0.9, z: (a.z + v.z) / 2 });
      ctx.fx.shake(0.2);
    }
  }

  /** In die Limo: Körper parken, die Figur treibt außen am Würfel. */
  private splash(pawn: Pawn, rules: SumoRules, ctx: Sdk.MinigameContext): void {
    const { x, z } = pawn.node.position;
    if (this.running) {
      const { credit, final } = rules.fall(pawn.slot);
      ctx.fx.sound(final ? 'lose' : 'splash');
      if (credit !== null) ctx.fx.sound('score', { volume: 0.6 });
      ctx.fx.burst('splash', { x, y: LIMO.y, z }, '#fff2a8');
    }
    const r = Math.max(Math.hypot(x, z), 0.1);
    const float = Math.min(GLASS_R - 1.2, Math.max(r, rules.half * 1.45 + 0.5)) / r;
    pawn.floating = { x: x * float, z: z * float };
    pawn.body.setGravityFactor(0);
    this.teleport(pawn, 100 + pawn.slot * 5, 0, 0);
  }

  private respawn(slot: Slot, rules: SumoRules, ctx: Sdk.MinigameContext): void {
    const pawn = this.pawns.find((entry) => entry.slot === slot);
    if (!pawn) return;
    const spot = respawnPoint(ctx.rng, rules.half);
    pawn.floating = null;
    pawn.body.setGravityFactor(1);
    this.teleport(pawn, spot.x, 2.2, spot.z);
    ctx.fx.sound('pop');
  }

  private teleport(pawn: Pawn, x: number, y: number, z: number): void {
    pawn.node.position.set(x, y, z);
    pawn.body.disablePreStep = false;
    pawn.body.setLinearVelocity(v3());
    this.teleported.push(pawn.body);
  }

  private finish(): void {
    const { ctx, rules } = this;
    if (!ctx || !rules || this.result) return;
    this.running = false;
    const [placements, figures] = [rules.board.placements(), this.pawns.map((p) => p.figure)];
    celebrateFigures(placements, figures);
    ctx.fx.sound('win');
    const highlights = rules.highlights(new Map(ctx.players.map((p) => [p.slot, p.name])));
    this.result = { minigameId: INFO.id, placements, ...(highlights.length ? { highlights } : {}) };
  }

  private sync(dt: number): void {
    const { rules, ice, rim } = this;
    if (!rules || !ice || !rim) return;
    const now = rules.clock.time;
    const level = meltLevel(now);
    const warn = this.running && meltWarning(now);
    const core = cubeHalf(level + +warn) * 2;
    ice.scaling.set(core, DEPTH, core);
    rim.setEnabled(warn);
    rim.scaling.set(cubeHalf(level) * 2, DEPTH - 0.06, cubeHalf(level) * 2);
    for (const pawn of this.pawns) {
      const heading = Math.atan2(pawn.facing.x, pawn.facing.z);
      const float = pawn.floating;
      const bob = LIMO.y - 0.85 + Math.sin(now * 3 + pawn.slot) * 0.06;
      const { x, y, z } = float ? { ...float, y: bob } : pawn.node.position;
      pawn.figure.place(x, z, heading, y);
      const stunned = float !== null || now < pawn.hitUntil;
      const moving = !float && Math.hypot(pawn.stick.x, pawn.stick.y) > 0.15;
      const dashing = !float && now - pawn.lastDash < BUMP.hitS;
      pawn.figure.show({ stunned, dashing, moving }, dt, this.result !== null);
    }
  }

  /** Glas mit Limo, Strohhalm, Zitronenscheibe und der Eiswürfel samt nassem Rand. */
  private async buildScene(stage: MinigameStage): Promise<void> {
    const part = (name: string, hex: string, d: number, h: number, o: PartOptions = {}) => {
      const mesh = CreateCylinder(stage.name(name), { diameter: d, height: h }, stage.scene);
      return stage.add(mesh, hex, o);
    };
    const [d, scene] = [GLASS_R * 2 + 0.3, stage.scene];
    part('limo', '#ffd23a', d - 0.3, 2.4, { alpha: 0.72, emissive: 0.2 }).position.y = -1.8;
    const glass = CreateCylinder(stage.name('glas'), { diameter: d, height: 3.9, cap: 0 }, scene);
    stage.add(glass, '#e8f6ff', { alpha: 0.18, finish: 'glanz' }).position.y = -1.05;
    const rim = CreateTorus(stage.name('glasrand'), { diameter: d, thickness: 0.14 }, scene);
    stage.add(rim, '#ffffff', { alpha: 0.8, finish: 'glanz' }).position.y = 0.9;
    const straw = part('strohhalm', '#e8574d', 0.35, 8, { finish: 'lack' });
    straw.position.set(-3.6, 1.4, 3);
    straw.rotation.set(0.3, 0, 0.42);
    await stage.pace();
    const lemon = part('zitrone', '#f2b600', 2.2, 0.14);
    lemon.position.set(3.9, LIMO.y + 0.02, 2.4);
    part('fruchtfleisch', '#ffe066', 1.8, 0.16, { emissive: 0.2, parent: lemon });
    this.ice = stage.node('eis', 'eiswuerfel');
    this.ice.position.y = -DEPTH / 2;
    const cube = CreateBox(stage.name('wuerfel'), { size: 1 }, stage.scene);
    stage.add(cube, '#bdeaff', { parent: this.ice, alpha: 0.8, emissive: 0.35, finish: 'glanz' });
    this.rim = stage.node('rand', 'schmelzrand');
    this.rim.position.y = -DEPTH / 2 - 0.03;
    const wet = CreateBox(stage.name('nass'), { size: 1 }, stage.scene);
    stage.add(wet, '#5fb8e8', { parent: this.rim, alpha: 0.75, emissive: 0.2 });
  }
}

type PartOptions = StageMaterialOptions & { readonly parent?: TransformNode };

function physicsBody(stage: MinigameStage, node: TransformNode, type: PhysicsMotionType) {
  return stage.track(new PhysicsBody(node, type, false, stage.scene));
}

/** Figur: Kapsel mit Füßen am Knotenursprung, Blick zur Mitte. */
async function createPawn(stage: MinigameStage, player: Sdk.MinigamePlayer, angle: number) {
  const [dirX, dirZ] = [Math.cos(angle), Math.sin(angle)];
  const node = stage.node('koerper');
  node.position.set(dirX * 1.9, 0.02, dirZ * 1.9);
  const body = physicsBody(stage, node, PhysicsMotionType.DYNAMIC);
  const { radius: r, height: h } = PAWN;
  const shape = new PhysicsShapeCapsule(v3(0, r), v3(0, h - r), r, stage.scene);
  shape.material = { friction: 0.05, restitution: 0.35 };
  body.shape = stage.track(shape);
  // Trägheit 0: Figuren bleiben aufrecht, auch beim Rempeln.
  body.setMassProperties({ mass: 1, inertia: v3(), centerOfMass: v3(0, h / 2) });
  body.setLinearDamping(0.3);
  const figure = await SlotFigure.create(stage, player, { badgeHeight: 2.2 });
  const pawn: Pawn = {
    ...{ slot: player.slot, node, body, figure, facing: { x: -dirX, z: -dirZ } },
    ...{ stick: { x: 0, y: 0 }, dashQueued: false, lastDash: -10, hitUntil: 0, armed: false },
    floating: null,
  };
  return pawn;
}

export const eiswuerfelSumo: Sdk.MinigameModule = {
  info: INFO,
  create: () => new EiswuerfelSumo(),
};
