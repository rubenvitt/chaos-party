/**
 * Pudding-Gerangel – Physik-Minispiel (M3, CHAOS-29/31, EXP-006).
 *
 * Alle stehen auf einem riesigen Wackelpudding. Wer auf dem Kirschfleck steht, sammelt
 * Punkte; der Fleck hüpft alle 4 s weiter (1 s Vorwarnung). Der Pudding kippt mit Havok-
 * Kinematik dorthin, wo die Figuren stehen, und schwabbelt immer stärker; ein Rührlöffel
 * fegt im Kreis. Rempler (A) schubsen, gegen die führende Person (Wackelkrone) kräftiger.
 * Wer in die Sahne fällt, plumpst nach 1,5 s von oben zurück.
 *
 * Physik: Pudding und Löffel sind ANIMATED-Körper (`setTargetTransform` je Schritt), Figuren
 * dynamische Kapseln mit gesperrter Drehung. Hitboxen sind unsichtbar; Figuren-Meshes und
 * Deko hängen als Kinder daran. Zeit nur über `update`, Zufall nur über `ctx.rng`.
 */
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera.js';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight.js';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight.js';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color.js';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder.js';
import { CreateCapsule } from '@babylonjs/core/Meshes/Builders/capsuleBuilder.js';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder.js';
import type { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import {
  PhysicsMotionType,
  PhysicsShapeType,
} from '@babylonjs/core/Physics/v2/IPhysicsEnginePlugin.js';
import { PhysicsAggregate } from '@babylonjs/core/Physics/v2/physicsAggregate.js';
import {
  rankByScore,
  type MinigameBotDriver,
  type MinigameBotOptions,
  type MinigameInput,
  type MinigameResult,
  type Slot,
} from '@chaos-party/minigame-sdk';
import type {
  CharacterAnimation,
  CharacterHandle,
  Minigame,
  MinigameContext,
  MinigameHud,
  MinigameModule,
  MinigamePlayer,
} from '@chaos-party/minigame-sdk/babylon';
import { markVisual } from '@chaos-party/minigame-sdk/babylon';
import { createPuddingBot } from './bot.ts';
import { PUDDING_GERANGEL_INFO } from './info.ts';
import {
  approachAngle,
  bannerFor,
  buildHighlights,
  clampStick,
  followTilt,
  inZone,
  leaderOf,
  nextZone,
  PAWN,
  spoonSpeedAt,
  statusFor,
  steeringDeltaV,
  targetTilt,
  TUNING,
  wobbleAt,
  yawFor,
  type Tilt,
  type Vec2,
} from './logic.ts';
import {
  buildCreamLake,
  buildCrown,
  buildPawnDecor,
  buildPudding,
  buildSpoon,
  buildStump,
  buildZone,
  toyParts,
  type PawnDecor,
  type ToyParts,
  type ZoneVisual,
} from './visuals.ts';

const TURN_SPEED = 12;
/** Hitbox-Mitte über den Füßen. */
const HALF_HEIGHT = PAWN.height / 2;
const SPOON_TOUCH_MS = 3000;

interface Pawn {
  readonly player: MinigamePlayer;
  readonly hitbox: Mesh;
  readonly aggregate: PhysicsAggregate;
  readonly character: CharacterHandle;
  readonly decor: PawnDecor;
  stick: { x: number; y: number };
  dashQueued: boolean;
  lastDashMs: number;
  readonly bonked: Set<Slot>;
  facing: Vec2;
  yaw: number;
  out: boolean;
  respawnAtMs: number | null;
  falls: number;
  knockoffs: number;
  zoneMs: number;
  inZone: boolean;
  lastBonk: { by: Slot; atMs: number } | null;
  lastSpoonMs: number;
  hitUntilMs: number;
  animation: CharacterAnimation | null;
}

/** Zustand für Tests und Bots (keine Spielregeln, nur Beobachtung). */
export interface PuddingSnapshot {
  readonly pawns: readonly {
    readonly slot: Slot;
    readonly x: number;
    readonly y: number;
    readonly z: number;
    readonly vx: number;
    readonly vy: number;
    readonly vz: number;
    /** Höhe über der Puddingoberfläche (Kapselmitte; stehend ≈ 0,75). */
    readonly localY: number;
    readonly localR: number;
    readonly out: boolean;
    readonly canDash: boolean;
  }[];
  readonly tilt: Tilt;
  /** Winkel des Löffels als `atan2(−z, x)` seiner Richtung (Pudding-Ebene). */
  readonly spoonAngle: number;
  readonly zone: { readonly x: number; readonly z: number; readonly r: number } | null;
  readonly leader: Slot | null;
  readonly scores: readonly { readonly slot: Slot; readonly score: number }[];
  readonly counters: {
    readonly falls: number;
    readonly knockoffs: number;
    readonly spoonFalls: number;
    readonly bonks: number;
  };
}

const tmpVelocity = new Vector3();
const tmpImpulse = new Vector3();
const tmpVector = new Vector3();
const UNIT_X = new Vector3(1, 0, 0);

export class PuddingGerangel implements Minigame {
  private ctx: MinigameContext | null = null;
  private readonly pawns: Pawn[] = [];
  private disposables: ToyParts = toyParts(undefined);
  private readonly teleported: PhysicsAggregate[] = [];
  private platter: PhysicsAggregate | null = null;
  private pudding: Mesh | null = null;
  private spoon: PhysicsAggregate | null = null;
  private zoneVisual: ZoneVisual | null = null;
  private crown: TransformNode | null = null;
  private elapsedMs = 0;
  private running = false;
  private finished = false;
  private result: MinigameResult | null = null;
  private tilt: Tilt = { pitch: 0, roll: 0 };
  private tiltSpeed = 0;
  private spoonAngle = 0;
  private wobblePhase = 0;
  private zone: Vec2 | null = null;
  private upcoming: Vec2 | null = null;
  private nextZoneAtMs: number = TUNING.zoneMoveMs;
  private lastZoneMoveMs = 0;
  private spoonFalls = 0;
  private bonks = 0;
  private readonly platterRotation = Quaternion.Identity();
  private readonly inverseRotation = Quaternion.Identity();
  private readonly spoonRotation = Quaternion.Identity();

  async prepare(ctx: MinigameContext): Promise<void> {
    this.ctx = ctx;
    const { scene } = ctx;
    this.disposables = toyParts(ctx.look);
    const camera = new FreeCamera('pudding-kamera', new Vector3(0, 11.5, -13.5), scene);
    camera.setTarget(new Vector3(0, -1.3, 0.8));
    camera.fov = 0.8;
    scene.activeCamera = camera;
    this.disposables.push(camera);
    if (ctx.look) {
      // Natur-Look (CHAOS-62): Pudding auf einem Baumstumpf, darunter Picknickdecke und Wiese.
      const free = TUNING.radius + 1.2;
      ctx.look.backdrop({
        halfX: free,
        halfZ: free,
        groundY: TUNING.killY - 0.3,
        surface: 'decke',
      });
      buildStump(scene, this.disposables);
    } else {
      scene.clearColor = new Color4(1, 0.86, 0.91, 1);
      const sky = new HemisphericLight('pudding-licht', new Vector3(0.2, 1, -0.3), scene);
      sky.intensity = 0.7;
      sky.groundColor = new Color3(0.75, 0.6, 0.7);
      const sun = new DirectionalLight('pudding-sonne', new Vector3(-0.4, -1, 0.5), scene);
      sun.intensity = 0.45;
      this.disposables.push(sky, sun);
      buildCreamLake(scene, this.disposables);
    }

    // Aufbau in Schritten, `pace` verteilt ihn auf mehrere Bilder (CHAOS-141).
    await ctx.pace();
    // Pudding: unsichtbare Zylinder-Hitbox, Oberseite bei y = 0, Drehpunkt oben in der Mitte.
    const platterBox = CreateCylinder(
      'pudding-hitbox',
      { diameter: TUNING.radius * 2, height: TUNING.thickness, tessellation: 48 },
      scene,
    );
    platterBox.isVisible = false;
    markVisual(platterBox, 'pudding');
    platterBox.position.y = -TUNING.thickness / 2;
    platterBox.rotationQuaternion = Quaternion.Identity();
    this.platter = this.kinematic(platterBox, PhysicsShapeType.CYLINDER, TUNING.friction);
    await ctx.pace();
    this.pudding = await buildPudding(scene, platterBox, this.disposables, ctx.pace);
    await ctx.pace();
    this.zoneVisual = await buildZone(scene, platterBox, this.disposables, ctx.pace);
    await ctx.pace();

    // Rührlöffel: unsichtbare Box-Hitbox, Startlage gesetzt (sonst springt er im 1. Schritt).
    this.spoonAngle = ctx.rng.next() * Math.PI * 2;
    const spoonBox = CreateBox(
      'pudding-loeffel-hitbox',
      {
        width: TUNING.spoonOuter - TUNING.spoonInner,
        height: TUNING.spoonHeight,
        depth: TUNING.spoonDepth,
      },
      scene,
    );
    spoonBox.isVisible = false;
    markVisual(spoonBox, 'loeffel');
    const spoonStart = this.spoonTransform();
    spoonBox.position.copyFrom(spoonStart.position);
    spoonBox.rotationQuaternion = spoonStart.rotation.clone();
    this.spoon = this.kinematic(spoonBox, PhysicsShapeType.BOX, 0.2);
    await ctx.pace();
    buildSpoon(scene, spoonBox, this.disposables);

    await ctx.pace();
    this.crown = buildCrown(scene, this.disposables);
    this.wobblePhase = ctx.rng.next() * Math.PI * 2;
    this.zone = nextZone(ctx.rng, null);
    this.upcoming = nextZone(ctx.rng, this.zone);
    this.placeZoneVisual();

    const count = ctx.players.length;
    for (const [index, player] of ctx.players.entries()) {
      const angle = Math.PI + (index * Math.PI * 2) / count;
      await ctx.pace();
      this.pawns.push(
        this.createPawn(
          player,
          new Vector3(Math.cos(angle) * 3.4, HALF_HEIGHT + 0.02, Math.sin(angle) * 3.4),
        ),
      );
    }
    this.syncVisuals(0);
  }

  private kinematic(mesh: Mesh, shape: PhysicsShapeType, friction: number): PhysicsAggregate {
    const aggregate = new PhysicsAggregate(
      mesh,
      shape,
      { mass: 0, friction, restitution: 0.15 },
      mesh.getScene(),
    );
    aggregate.body.setMotionType(PhysicsMotionType.ANIMATED);
    aggregate.body.disablePreStep = true;
    // Reihenfolge wichtig: `dispose()` räumt rückwärts ab (erst Deko-Kinder, dann Körper, dann Mesh).
    this.disposables.push(mesh, aggregate);
    return aggregate;
  }

  private createPawn(player: MinigamePlayer, position: Vector3): Pawn {
    const scene = this.requireCtx().scene;
    const hitbox = CreateCapsule(
      `pudding-figur-${player.slot}-hitbox`,
      { height: PAWN.height, radius: PAWN.radius },
      scene,
    );
    hitbox.isVisible = false;
    hitbox.position.copyFrom(position);
    hitbox.rotationQuaternion = Quaternion.Identity();
    const aggregate = new PhysicsAggregate(
      hitbox,
      PhysicsShapeType.CAPSULE,
      { mass: PAWN.mass, friction: PAWN.friction, restitution: PAWN.restitution },
      scene,
    );
    aggregate.body.setMotionType(PhysicsMotionType.DYNAMIC);
    // Trägheit 0 sperrt die Drehung: Figuren bleiben aufrecht, auch beim Schubsen.
    aggregate.body.setMassProperties({ mass: PAWN.mass, inertia: Vector3.Zero() });
    aggregate.body.setLinearDamping(0.1);

    const character = this.requireCtx().characters.create(scene, player);
    character.root.parent = hitbox;
    character.root.position.set(0, -HALF_HEIGHT, 0);
    character.play('idle');
    const decor = buildPawnDecor(scene, player.slot, player.color, this.disposables);
    decor.ring.parent = hitbox;
    decor.ring.position.y = -HALF_HEIGHT + 0.05;
    decor.pin.parent = hitbox;
    decor.pin.position.y = HALF_HEIGHT + 0.75;
    // Blick zur Mitte.
    const yaw = yawFor(-position.x, -position.z);
    return {
      player,
      hitbox,
      aggregate,
      character,
      decor,
      stick: { x: 0, y: 0 },
      dashQueued: false,
      lastDashMs: Number.NEGATIVE_INFINITY,
      bonked: new Set(),
      facing: { x: Math.sin(yaw), z: Math.cos(yaw) },
      yaw,
      out: false,
      respawnAtMs: null,
      falls: 0,
      knockoffs: 0,
      zoneMs: 0,
      inZone: false,
      lastBonk: null,
      lastSpoonMs: Number.NEGATIVE_INFINITY,
      hitUntilMs: 0,
      animation: 'idle',
    };
  }

  private requireCtx(): MinigameContext {
    if (!this.ctx) throw new Error('Pudding-Gerangel: prepare fehlt');
    return this.ctx;
  }

  start(): void {
    this.running = true;
    this.ctx?.fx.sound('go');
  }

  /** KI-Platz (CHAOS-180): Bot sieht Figuren, Neigung, Löffel und Fleck (`snapshot`). */
  createBot(options: MinigameBotOptions): MinigameBotDriver {
    return createPuddingBot(options, () => {
      if (!this.running || this.result) return null;
      const snap = this.snapshot();
      return { ...snap, whiskAngle: snap.spoonAngle };
    });
  }

  handleInput(slot: Slot, input: MinigameInput): void {
    if (!this.running) return;
    const pawn = this.pawns.find((entry) => entry.player.slot === slot);
    if (!pawn) return;
    if (input.type === 'move') pawn.stick = clampStick(input.x, input.y);
    else if (input.type === 'press' && input.button === 'a') pawn.dashQueued = true;
  }

  update(dt: number): void {
    for (const aggregate of this.teleported.splice(0)) aggregate.body.disablePreStep = true;
    const ctx = this.ctx;
    if (!ctx) return;
    if (!this.running) {
      if (this.finished) this.afterglow(dt);
      return;
    }
    this.elapsedMs += dt * 1000;
    const now = this.elapsedMs;
    const time = now / 1000;
    const progress = Math.min(1, now / ctx.timeLimitMs);

    if (now >= this.nextZoneAtMs) this.moveZone();
    this.movePlatter(dt, time, progress);
    this.spoonAngle = (this.spoonAngle + spoonSpeedAt(progress) * dt) % (Math.PI * 2);
    this.driveSpoon();

    for (const pawn of this.pawns) {
      if (pawn.out) {
        if (pawn.respawnAtMs !== null && now >= pawn.respawnAtMs) this.respawn(pawn);
        continue;
      }
      const local = this.toLocal(pawn.hitbox.position);
      const localR = Math.hypot(local.x, local.z);
      const grounded = localR < TUNING.radius + 0.1 && local.y > -0.6 && local.y < 2.4;
      this.steer(pawn, grounded);
      const wasInZone = pawn.inZone;
      pawn.inZone = grounded && inZone(local, this.zone);
      if (pawn.inZone) {
        const before = Math.floor(pawn.zoneMs / 1000);
        pawn.zoneMs += dt * 1000;
        if (!wasInZone || Math.floor(pawn.zoneMs / 1000) > before) {
          ctx.fx.sound('coin', { volume: 0.35, pitch: 0.9 + pawn.player.slot * 0.08 });
        }
      }
      if (this.touchesSpoon(local)) {
        if (now - pawn.lastSpoonMs > 600) ctx.fx.sound('hit', { volume: 0.5 });
        pawn.lastSpoonMs = now;
      }
      if (pawn.hitbox.position.y < TUNING.killY) this.fall(pawn);
    }
    this.checkBonks();
    for (const pawn of this.pawns) if (!pawn.out) clampSpeed(pawn.aggregate, PAWN.speedLimit);
    this.syncVisuals(dt);

    if (now >= ctx.timeLimitMs) this.finish();
  }

  /** Lokale Puddingkoordinaten (Oberseite = Ebene y = 0). */
  private toLocal(world: Vector3): Vector3 {
    return world.rotateByQuaternionToRef(this.inverseRotation, new Vector3());
  }

  private moveZone(): void {
    const ctx = this.requireCtx();
    this.zone = this.upcoming ?? nextZone(ctx.rng, this.zone);
    this.upcoming = nextZone(ctx.rng, this.zone);
    this.nextZoneAtMs += TUNING.zoneMoveMs;
    this.lastZoneMoveMs = this.elapsedMs;
    this.placeZoneVisual();
    ctx.fx.sound('whoosh', { volume: 0.6 });
    const world = new Vector3(this.zone.x, 0.3, this.zone.z).rotateByQuaternionToRef(
      this.platterRotation,
      new Vector3(),
    );
    ctx.fx.burst('sparkle', world, '#e0233d');
  }

  private placeZoneVisual(): void {
    if (!this.zoneVisual || !this.zone) return;
    const top = TUNING.thickness / 2;
    this.zoneVisual.root.position.set(this.zone.x, top + 0.03, this.zone.z);
    if (this.upcoming)
      this.zoneVisual.ghost.position.set(this.upcoming.x, top + 0.06, this.upcoming.z);
  }

  private movePlatter(dt: number, time: number, progress: number): void {
    const positions: Vec2[] = [];
    for (const pawn of this.pawns) {
      if (pawn.out) continue;
      const local = this.toLocal(pawn.hitbox.position);
      if (Math.hypot(local.x, local.z) < TUNING.radius && local.y > -0.6) positions.push(local);
    }
    const before = this.tilt;
    this.tilt = followTilt(
      this.tilt,
      targetTilt(positions, time, wobbleAt(progress), this.wobblePhase),
      dt,
    );
    this.tiltSpeed =
      Math.hypot(this.tilt.pitch - before.pitch, this.tilt.roll - before.roll) / Math.max(dt, 1e-6);
    this.applyPlatterRotation();
  }

  private applyPlatterRotation(): void {
    Quaternion.RotationYawPitchRollToRef(0, this.tilt.pitch, this.tilt.roll, this.platterRotation);
    Quaternion.InverseToRef(this.platterRotation, this.inverseRotation);
    const center = new Vector3(0, -TUNING.thickness / 2, 0).rotateByQuaternionToRef(
      this.platterRotation,
      new Vector3(),
    );
    this.platter?.body.setTargetTransform(center, this.platterRotation);
  }

  private spoonTransform(): { position: Vector3; rotation: Quaternion } {
    const yaw = Quaternion.RotationYawPitchRoll(this.spoonAngle, 0, 0);
    this.platterRotation.multiplyToRef(yaw, this.spoonRotation);
    const mid = (TUNING.spoonInner + TUNING.spoonOuter) / 2;
    const position = new Vector3(mid, TUNING.spoonHeight / 2 + 0.03, 0).rotateByQuaternionToRef(
      this.spoonRotation,
      new Vector3(),
    );
    return { position, rotation: this.spoonRotation };
  }

  private driveSpoon(): void {
    const { position, rotation } = this.spoonTransform();
    this.spoon?.body.setTargetTransform(position, rotation);
  }

  /** Richtung des Löffels in Puddingkoordinaten (Einheitsvektor in der Ebene). */
  private spoonDirection(): Vec2 {
    const yaw = Quaternion.RotationYawPitchRoll(this.spoonAngle, 0, 0);
    const dir = UNIT_X.rotateByQuaternionToRef(yaw, tmpVector);
    return { x: dir.x, z: dir.z };
  }

  private touchesSpoon(local: Vector3): boolean {
    if (local.y > TUNING.spoonHeight + HALF_HEIGHT + 0.2) return false;
    const dir = this.spoonDirection();
    const along = local.x * dir.x + local.z * dir.z;
    if (along < TUNING.spoonInner - PAWN.radius || along > TUNING.spoonOuter + PAWN.radius)
      return false;
    const across = Math.abs(local.x * dir.z - local.z * dir.x);
    return across < PAWN.radius + TUNING.spoonDepth / 2 + 0.15;
  }

  private steer(pawn: Pawn, grounded: boolean): void {
    const body = pawn.aggregate.body;
    const ctx = this.requireCtx();
    body.getLinearVelocityToRef(tmpVelocity);
    const center = pawn.hitbox.position;
    const moving = Math.hypot(pawn.stick.x, pawn.stick.y) > 0.1;
    if (moving) {
      const length = Math.hypot(pawn.stick.x, pawn.stick.y);
      pawn.facing = { x: pawn.stick.x / length, z: pawn.stick.y / length };
    }
    if (pawn.dashQueued) {
      pawn.dashQueued = false;
      if (grounded && this.elapsedMs - pawn.lastDashMs >= PAWN.dashCooldownMs) {
        pawn.lastDashMs = this.elapsedMs;
        pawn.bonked.clear();
        tmpImpulse.set(
          pawn.facing.x * PAWN.dashSpeed * PAWN.mass,
          0,
          pawn.facing.z * PAWN.dashSpeed * PAWN.mass,
        );
        body.applyImpulse(tmpImpulse, center);
        ctx.fx.sound('whoosh', { volume: 0.4, pitch: 1.3 });
      }
    }
    if (grounded && this.elapsedMs - pawn.lastDashMs >= PAWN.dashSteerPauseMs) {
      const dv = steeringDeltaV({ x: tmpVelocity.x, z: tmpVelocity.z }, pawn.stick, 1 / 60);
      tmpImpulse.set(dv.x * PAWN.mass, 0, dv.z * PAWN.mass);
      body.applyImpulse(tmpImpulse, center);
    }
  }

  private checkBonks(): void {
    const ctx = this.requireCtx();
    const active = this.pawns.filter((pawn) => !pawn.out);
    const leader = this.leader();
    for (const attacker of active) {
      if (this.elapsedMs - attacker.lastDashMs > PAWN.dashHitMs) continue;
      for (const victim of active) {
        if (victim === attacker || attacker.bonked.has(victim.player.slot)) continue;
        const a = attacker.hitbox.position;
        const v = victim.hitbox.position;
        const dx = v.x - a.x;
        const dz = v.z - a.z;
        const distance = Math.hypot(dx, dz);
        if (distance > PAWN.radius * 2 + 0.25 || Math.abs(v.y - a.y) > 1) continue;
        attacker.bonked.add(victim.player.slot);
        const nx = distance > 1e-4 ? dx / distance : attacker.facing.x;
        const nz = distance > 1e-4 ? dz / distance : attacker.facing.z;
        const push =
          PAWN.bonkSpeed * PAWN.mass * (victim.player.slot === leader ? TUNING.leaderBonk : 1);
        tmpImpulse.set(nx * push, PAWN.bonkLift * PAWN.mass, nz * push);
        victim.aggregate.body.applyImpulse(tmpImpulse, v);
        victim.lastBonk = { by: attacker.player.slot, atMs: this.elapsedMs };
        victim.hitUntilMs = this.elapsedMs + 500;
        this.bonks++;
        ctx.fx.sound('bump', { pitch: 0.9 + ctx.rng.next() * 0.3 });
        ctx.fx.burst('impact', {
          x: (a.x + v.x) / 2,
          y: (a.y + v.y) / 2 + 0.3,
          z: (a.z + v.z) / 2,
        });
        ctx.fx.shake(victim.player.slot === leader ? 0.35 : 0.2);
      }
    }
  }

  private fall(pawn: Pawn): void {
    const ctx = this.requireCtx();
    const now = this.elapsedMs;
    pawn.falls++;
    pawn.out = true;
    pawn.inZone = false;
    pawn.stick = { x: 0, y: 0 };
    pawn.dashQueued = false;
    const credit =
      pawn.lastBonk && now - pawn.lastBonk.atMs <= TUNING.creditMs ? pawn.lastBonk : null;
    if (credit) {
      const by = this.pawns.find((entry) => entry.player.slot === credit.by);
      if (by) by.knockoffs++;
    } else if (now - pawn.lastSpoonMs <= SPOON_TOUCH_MS) {
      this.spoonFalls++;
    }
    pawn.lastBonk = null;
    pawn.respawnAtMs = now + TUNING.respawnMs;
    const at = pawn.hitbox.position;
    ctx.fx.sound('splash');
    ctx.fx.burst('splash', { x: at.x, y: TUNING.killY - 0.2, z: at.z }, '#fff3d6');
    ctx.fx.shake(0.3);
    this.play(pawn, 'fall');
    // Parken: weit weg, schwerelos, bis zum Comeback.
    pawn.aggregate.body.setGravityFactor(0);
    this.teleport(pawn.aggregate, new Vector3(200 + pawn.player.slot * 6, -40, 0));
  }

  private respawn(pawn: Pawn, announce = true): void {
    const ctx = this.requireCtx();
    const angle = ctx.rng.next() * Math.PI * 2;
    const r = 0.5 + ctx.rng.next() * 2;
    pawn.out = false;
    pawn.respawnAtMs = null;
    pawn.lastSpoonMs = Number.NEGATIVE_INFINITY;
    pawn.aggregate.body.setGravityFactor(1);
    // Comeback fällt von oben herein; zur Siegerehrung nur ein kleiner Hopser auf den Pudding.
    const height = announce ? 4 : HALF_HEIGHT + 0.9;
    this.teleport(pawn.aggregate, new Vector3(Math.cos(angle) * r, height, Math.sin(angle) * r));
    if (!announce) return;
    ctx.fx.sound('pop');
    this.play(pawn, 'jump');
  }

  private teleport(aggregate: PhysicsAggregate, position: Vector3): void {
    aggregate.transformNode.position.copyFrom(position);
    aggregate.body.disablePreStep = false;
    aggregate.body.setLinearVelocity(Vector3.Zero());
    aggregate.body.setAngularVelocity(Vector3.Zero());
    this.teleported.push(aggregate);
  }

  private scores(): { slot: Slot; score: number }[] {
    return this.pawns.map((pawn) => ({
      slot: pawn.player.slot,
      score: Math.floor((pawn.zoneMs / 1000) * TUNING.zoneRate),
    }));
  }

  private leader(): Slot | null {
    return leaderOf(this.scores());
  }

  private play(pawn: Pawn, animation: CharacterAnimation): void {
    if (pawn.animation === animation) return;
    pawn.animation = animation;
    pawn.character.play(animation);
  }

  /** Optik nachführen: Blickrichtung, Ringe, Krone, Kirsche, Puddingschwabbeln, Animationen. */
  private syncVisuals(dt: number): void {
    const time = this.elapsedMs / 1000;
    const leader = this.leader();
    for (const pawn of this.pawns) {
      if (Math.hypot(pawn.stick.x, pawn.stick.y) > 0.1) {
        pawn.yaw = approachAngle(pawn.yaw, yawFor(pawn.stick.x, pawn.stick.y), TURN_SPEED * dt);
      }
      pawn.character.root.rotation.y = pawn.yaw;
      // Bodenring liegt schräg wie der Pudding (Hitbox selbst dreht sich nie).
      pawn.decor.ring.rotationQuaternion = this.platterRotation;
      pawn.decor.pin.position.y = HALF_HEIGHT + (pawn.player.slot === leader ? 1.25 : 0.75);
      pawn.decor.pin.rotation.y = time * 2;
      if (this.finished || pawn.out) continue;
      if (this.elapsedMs < pawn.hitUntilMs) this.play(pawn, 'hit');
      else {
        pawn.aggregate.body.getLinearVelocityToRef(tmpVelocity);
        const speed = Math.hypot(tmpVelocity.x, tmpVelocity.z);
        this.play(pawn, speed > 1.2 ? 'run' : 'idle');
      }
    }
    const crowned = this.pawns.find((pawn) => pawn.player.slot === leader && !pawn.out);
    if (this.crown) {
      this.crown.setEnabled(Boolean(crowned));
      if (crowned) {
        const head = crowned.hitbox.position;
        this.crown.position.set(head.x, head.y + HALF_HEIGHT + 0.25, head.z);
        // Die Krone wackelt sichtbar.
        this.crown.rotation.z = Math.sin(time * 9) * 0.18;
        this.crown.rotation.y = time * 1.5;
      }
    }
    if (this.zoneVisual) {
      this.zoneVisual.cherry.position.y = 2.6 + Math.sin(time * 4) * 0.12;
      this.zoneVisual.cherry.rotation.y = time * 1.8;
      const warn = !this.finished && this.nextZoneAtMs - this.elapsedMs <= TUNING.zoneWarnMs;
      this.zoneVisual.ghost.setEnabled(warn);
      if (warn) this.zoneVisual.ghost.scaling.setAll(1 + 0.08 * Math.sin(time * 18));
    }
    if (this.pudding) {
      const amplitude = Math.min(0.08, 0.02 + this.tiltSpeed * 0.25);
      const squash = 1 + Math.sin(time * 9) * amplitude;
      this.pudding.scaling.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));
    }
  }

  /** Nach dem Ende: Pudding beruhigt sich, Löffel steht, Figuren feiern bzw. schmollen. */
  private afterglow(dt: number): void {
    this.tilt = followTilt(this.tilt, { pitch: 0, roll: 0 }, dt);
    this.tiltSpeed = 0;
    this.applyPlatterRotation();
    this.driveSpoon();
    // Zur Siegerehrung stehen alle auf dem Pudding: wer fällt oder noch draußen ist, plumpst
    // sofort wieder herein (ohne Wertung, das Ergebnis steht fest).
    for (const pawn of this.pawns) {
      if (pawn.out || pawn.hitbox.position.y < TUNING.killY) this.respawn(pawn, false);
      clampSpeed(pawn.aggregate, PAWN.speedLimit);
    }
    this.syncVisuals(dt);
  }

  private finish(): void {
    const ctx = this.requireCtx();
    this.running = false;
    this.finished = true;
    for (const pawn of this.pawns) {
      pawn.stick = { x: 0, y: 0 };
      pawn.dashQueued = false;
      if (pawn.out) this.respawn(pawn, false);
    }
    const placements = rankByScore(this.scores(), PUDDING_GERANGEL_INFO.scoring);
    for (const placement of placements) {
      const pawn = this.pawns.find((entry) => entry.player.slot === placement.slot);
      if (!pawn) continue;
      pawn.animation = null;
      pawn.character.play(placement.place === 1 ? 'cheer' : 'sad');
      pawn.animation = placement.place === 1 ? 'cheer' : 'sad';
    }
    this.syncVisuals(0);
    ctx.fx.sound('win');
    ctx.fx.burst('confetti', { x: 0, y: 3, z: 0 });
    const highlights = buildHighlights(
      this.pawns.map((pawn) => ({
        slot: pawn.player.slot,
        name: pawn.player.name,
        score: Math.floor((pawn.zoneMs / 1000) * TUNING.zoneRate),
        falls: pawn.falls,
        knockoffs: pawn.knockoffs,
        zoneMs: pawn.zoneMs,
      })),
      this.spoonFalls,
    );
    this.result = {
      minigameId: PUDDING_GERANGEL_INFO.id,
      placements,
      ...(highlights.length > 0 ? { highlights } : {}),
    };
  }

  getResult(): MinigameResult | null {
    return this.result;
  }

  getHud(): MinigameHud {
    const limit = this.ctx?.timeLimitMs ?? PUDDING_GERANGEL_INFO.durationMs;
    const leader = this.leader();
    const banner = this.finished
      ? undefined
      : bannerFor(this.elapsedMs, limit, this.lastZoneMoveMs);
    return {
      remainingMs: Math.max(0, Math.round(limit - this.elapsedMs)),
      scores: this.scores().map((entry) => {
        const pawn = this.pawns.find((p) => p.player.slot === entry.slot);
        const status = statusFor({
          out: pawn?.out ?? false,
          inZone: pawn?.inZone ?? false,
          leader: entry.slot === leader,
        });
        return status ? { ...entry, status } : entry;
      }),
      ...(banner ? { banner } : {}),
    };
  }

  /** Beobachtung für Tests und Bots. */
  snapshot(): PuddingSnapshot {
    const dir = this.spoonDirection();
    return {
      pawns: this.pawns.map((pawn) => {
        const p = pawn.hitbox.position;
        const local = this.toLocal(p);
        pawn.aggregate.body.getLinearVelocityToRef(tmpVelocity);
        return {
          slot: pawn.player.slot,
          x: p.x,
          y: p.y,
          z: p.z,
          vx: tmpVelocity.x,
          vy: tmpVelocity.y,
          vz: tmpVelocity.z,
          localY: local.y,
          localR: Math.hypot(local.x, local.z),
          out: pawn.out,
          canDash: this.elapsedMs - pawn.lastDashMs >= PAWN.dashCooldownMs,
        };
      }),
      tilt: this.tilt,
      spoonAngle: Math.atan2(-dir.z, dir.x),
      zone: this.zone ? { ...this.zone, r: TUNING.zoneRadius } : null,
      leader: this.leader(),
      scores: this.scores(),
      counters: {
        falls: this.pawns.reduce((sum, pawn) => sum + pawn.falls, 0),
        knockoffs: this.pawns.reduce((sum, pawn) => sum + pawn.knockoffs, 0),
        spoonFalls: this.spoonFalls,
        bonks: this.bonks,
      },
    };
  }

  dispose(): void {
    for (const pawn of this.pawns) {
      pawn.character.dispose();
      pawn.aggregate.dispose();
      // Kinder (Ring, Wimpel) räumt `disposables` ab; hier nur die Hitbox selbst.
      pawn.hitbox.dispose(true);
    }
    this.pawns.length = 0;
    for (const item of this.disposables.splice(0).reverse()) item.dispose();
    this.teleported.length = 0;
    this.platter = null;
    this.spoon = null;
    this.pudding = null;
    this.zoneVisual = null;
    this.crown = null;
    this.running = false;
  }
}

function clampSpeed(aggregate: PhysicsAggregate, limit: number): void {
  aggregate.body.getLinearVelocityToRef(tmpVelocity);
  const speed = tmpVelocity.length();
  if (speed > limit) {
    tmpVelocity.scaleInPlace(limit / speed);
    aggregate.body.setLinearVelocity(tmpVelocity);
  }
}

export const puddingGerangel: MinigameModule = {
  info: PUDDING_GERANGEL_INFO,
  create: () => new PuddingGerangel(),
};
