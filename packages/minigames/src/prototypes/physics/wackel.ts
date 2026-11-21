/**
 * Prototyp A/A2 „Wackelpudding“ (EXP-006): Alle stehen auf einem runden Wackelpudding-Teller,
 * der sich zum Gewicht der Figuren neigt und von selbst immer stärker schwabbelt. Ein
 * Rührbesen-Arm kreist und fegt. Rempler (A) schubsen.
 *
 * - A „Letzter oben“: Runterfallen = raus, Punkte = überlebte Sekunden.
 * - A2 „Plumps-Comeback“: Wer fällt, plumpst nach 1,5 s zurück. Wertung umschaltbar:
 *   `saldo` = Schubser − Stürze, `stuerze` = wer am seltensten fällt.
 */
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight.js';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera.js';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder.js';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder.js';
import type { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import {
  PhysicsMotionType,
  PhysicsShapeType,
} from '@babylonjs/core/Physics/v2/IPhysicsEnginePlugin.js';
import { PhysicsAggregate } from '@babylonjs/core/Physics/v2/physicsAggregate.js';
import {
  rankByScore,
  type MinigameInfo,
  type MinigameInput,
  type MinigameResult,
  type Slot,
} from '@chaos-party/minigame-sdk';
import type { Minigame, MinigameContext, MinigameHud } from '@chaos-party/minigame-sdk/babylon';
import { puddingDecision } from '../../pudding-gerangel/bot.ts';
import {
  applyPawnInput,
  bodyView,
  bonkCheck,
  createPawn,
  PAWN,
  steerPawn,
  Teleporter,
  type BotPolicy,
  type Pawn,
  type PawnView,
  type ProtoView,
  type Prototype,
} from './shared.ts';

export interface WackelConfig {
  readonly respawn: boolean;
  readonly scoring: 'survival' | 'saldo' | 'stuerze' | 'kirsche';
  readonly whisk: boolean;
  readonly durationMs: number;
  readonly tuning?: Partial<WackelTuning>;
}

export type WackelTuning = { -readonly [K in keyof typeof WACKEL]: number };

export const WACKEL = {
  radius: 6,
  thickness: 0.6,
  platterFriction: 0.6,
  whiskHeight: 0.5,
  bonkBoost: 1,
  /** Neigung je Figur am Rand (rad). */
  tiltPerPawn: 0.07,
  maxTilt: 0.26,
  tiltFollow: 1.5,
  wobbleStart: 0.03,
  wobbleEnd: 0.1,
  whiskInner: 1.6,
  whiskOuter: 6.4,
  whiskSpeedStart: 0.5,
  whiskSpeedEnd: 1.3,
  killY: -3,
  respawnMs: 1500,
  creditMs: 4000,
  zoneRadius: 1.4,
  zoneMaxR: 3.8,
  zoneMoveMs: 6000,
  /** Kirschpunkte je Sekunde auf dem Fleck. */
  zoneRate: 4,
  /** 1 = Punkte im Fleck werden unter allen darin geteilt. */
  zoneShare: 0,
  /** Rempler gegen die führende Person wirken so viel stärker („Krone wackelt“). */
  leaderBonk: 1,
} as const;

export interface WackelView extends ProtoView {
  readonly tilt: { readonly pitch: number; readonly roll: number };
  readonly whiskAngle: number | null;
  readonly zone: { readonly x: number; readonly z: number; readonly r: number } | null;
  readonly leader: Slot | null;
}

interface WackelPawn extends Pawn {
  out: boolean;
  outAtMs: number | null;
  respawnAtMs: number | null;
  falls: number;
  knockoffs: number;
  lastBonk: { by: Slot; atMs: number } | null;
  zoneMs: number;
}

export function createWackelPrototype(config: WackelConfig): Prototype<WackelView> {
  let current: WackelProto | null = null;
  const info: MinigameInfo = {
    id: 'proto-wackel',
    category: 'physics',
    title: 'Wackelpudding',
    tagline: 'Prototyp',
    instructions: ['Bleib auf dem Teller.'],
    controls: { joystick: 'Laufen', a: 'Rempeln', b: null },
    durationMs: config.durationMs,
    physics: true,
    scoring: config.scoring === 'stuerze' ? 'lower' : 'higher',
    scoreUnit: 'Punkte',
  };
  return {
    module: {
      info,
      create: () => {
        current = new WackelProto(config, info);
        return current;
      },
    },
    peek: () => current?.view() ?? null,
  };
}

class WackelProto implements Minigame {
  private ctx: MinigameContext | null = null;
  private readonly pawns: WackelPawn[] = [];
  private readonly disposables: { dispose(): void }[] = [];
  private readonly teleporter = new Teleporter();
  private platter: PhysicsAggregate | null = null;
  private whisk: PhysicsAggregate | null = null;
  private elapsedMs = 0;
  private running = false;
  private result: MinigameResult | null = null;
  private pitch = 0;
  private roll = 0;
  private whiskAngle = 0;
  private wobblePhase = 0;
  private readonly platterRotation = new Quaternion();
  private readonly t: WackelTuning;
  private zone: { x: number; z: number } | null = null;
  private nextZoneMs = 0;

  constructor(
    private readonly config: WackelConfig,
    private readonly info: MinigameInfo,
  ) {
    this.t = { ...WACKEL, ...config.tuning };
  }

  prepare(ctx: MinigameContext): Promise<void> {
    this.ctx = ctx;
    const { scene } = ctx;
    const camera = new FreeCamera('proto-kamera', new Vector3(0, 14, -14), scene);
    camera.setTarget(Vector3.Zero());
    const light = new HemisphericLight('proto-licht', new Vector3(0, 1, 0), scene);
    this.disposables.push(camera, light);

    const plate = CreateCylinder(
      'proto-teller',
      { diameter: this.t.radius * 2, height: this.t.thickness, tessellation: 48 },
      scene,
    );
    plate.position.y = -this.t.thickness / 2;
    this.platter = this.kinematic(plate, PhysicsShapeType.CYLINDER, this.t.platterFriction);

    if (this.config.whisk) {
      const length = this.t.whiskOuter - this.t.whiskInner;
      const arm = CreateBox(
        'proto-besen',
        { width: length, height: this.t.whiskHeight, depth: 0.35 },
        scene,
      );
      this.whiskAngle = ctx.rng.next() * Math.PI * 2;
      // Startlage setzen, sonst springt der kinematische Arm im ersten Schritt dorthin.
      const { position, rotation } = this.whiskTransform();
      arm.position.copyFrom(position);
      arm.rotationQuaternion = rotation;
      this.whisk = this.kinematic(arm, PhysicsShapeType.BOX, 0.2);
    }
    this.wobblePhase = ctx.rng.next() * Math.PI * 2;

    ctx.players.forEach((player, index) => {
      const angle = Math.PI + (index * Math.PI * 2) / ctx.players.length;
      const position = new Vector3(
        Math.cos(angle) * 3,
        PAWN.height / 2 + 0.02,
        Math.sin(angle) * 3,
      );
      const pawn = createPawn(scene, player.slot, position);
      this.pawns.push({
        ...pawn,
        out: false,
        outAtMs: null,
        respawnAtMs: null,
        falls: 0,
        knockoffs: 0,
        lastBonk: null,
        zoneMs: 0,
      });
    });
    return Promise.resolve();
  }

  private kinematic(mesh: Mesh, shape: PhysicsShapeType, friction: number): PhysicsAggregate {
    const aggregate = new PhysicsAggregate(
      mesh,
      shape,
      { mass: 0, friction, restitution: 0.2 },
      mesh.getScene(),
    );
    aggregate.body.setMotionType(PhysicsMotionType.ANIMATED);
    aggregate.body.disablePreStep = true;
    this.disposables.push(aggregate, mesh);
    return aggregate;
  }

  start(): void {
    this.running = true;
  }

  handleInput(slot: Slot, input: MinigameInput): void {
    const pawn = this.pawns.find((p) => p.slot === slot);
    if (pawn && !pawn.out) applyPawnInput(pawn, input);
  }

  update(dt: number): void {
    this.teleporter.settle();
    if (!this.running || !this.ctx) return;
    this.elapsedMs += dt * 1000;
    const time = this.elapsedMs / 1000;
    const progress = Math.min(1, this.elapsedMs / this.ctx.timeLimitMs);

    // Neigung zum Gewicht + Eigen-Schwabbeln, das mit der Zeit zunimmt.
    let sx = 0;
    let sz = 0;
    for (const pawn of this.pawns) {
      if (pawn.out || !this.onPlatter(pawn)) continue;
      sx += pawn.mesh.position.x / this.t.radius;
      sz += pawn.mesh.position.z / this.t.radius;
    }
    const wobble = this.t.wobbleStart + (this.t.wobbleEnd - this.t.wobbleStart) * progress;
    let targetPitch = this.t.tiltPerPawn * sz + wobble * Math.sin(time * 1.7 + this.wobblePhase);
    let targetRoll = -this.t.tiltPerPawn * sx + wobble * Math.cos(time * 1.3 + this.wobblePhase);
    const mag = Math.hypot(targetPitch, targetRoll);
    if (mag > this.t.maxTilt) {
      targetPitch *= this.t.maxTilt / mag;
      targetRoll *= this.t.maxTilt / mag;
    }
    const follow = Math.min(1, this.t.tiltFollow * dt);
    this.pitch += (targetPitch - this.pitch) * follow;
    this.roll += (targetRoll - this.roll) * follow;
    Quaternion.RotationYawPitchRollToRef(0, this.pitch, this.roll, this.platterRotation);
    const platterCenter = new Vector3(0, 0, 0);
    const offset = new Vector3(0, -this.t.thickness / 2, 0);
    this.platter?.body.setTargetTransform(
      platterCenter.add(offset.rotateByQuaternionToRef(this.platterRotation, new Vector3())),
      this.platterRotation,
    );
    if (this.whisk) {
      const speed =
        this.t.whiskSpeedStart + (this.t.whiskSpeedEnd - this.t.whiskSpeedStart) * progress;
      this.whiskAngle = (this.whiskAngle + speed * dt) % (Math.PI * 2);
      const { position, rotation } = this.whiskTransform();
      this.whisk.body.setTargetTransform(position, rotation);
    }

    if (this.config.scoring === 'kirsche' && this.elapsedMs >= this.nextZoneMs) {
      this.nextZoneMs += this.t.zoneMoveMs;
      const angle = this.ctx.rng.next() * Math.PI * 2;
      const r = 1 + this.ctx.rng.next() * (this.t.zoneMaxR - 1);
      this.zone = { x: Math.cos(angle) * r, z: Math.sin(angle) * r };
    }
    const zone = this.zone;
    const inZone = zone
      ? this.pawns.filter(
          (pawn) =>
            !pawn.out &&
            this.onPlatter(pawn) &&
            Math.hypot(pawn.mesh.position.x - zone.x, pawn.mesh.position.z - zone.z) <
              this.t.zoneRadius,
        )
      : [];
    for (const pawn of inZone) {
      pawn.zoneMs += (dt * 1000) / (this.t.zoneShare > 0 ? inZone.length : 1);
    }
    for (const pawn of this.pawns) {
      if (pawn.out) {
        if (pawn.respawnAtMs !== null && this.elapsedMs >= pawn.respawnAtMs) this.respawn(pawn);
        continue;
      }
      steerPawn(pawn, time, this.onPlatter(pawn));
      if (pawn.mesh.position.y < this.t.killY) this.fall(pawn);
    }
    bonkCheck(
      this.pawns.filter((p) => !p.out),
      time,
      (by, victim) => {
        const target = this.pawns.find((p) => p.slot === victim.slot);
        if (target) target.lastBonk = { by: by.slot, atMs: this.elapsedMs };
      },
      (victim) => this.t.bonkBoost * (victim.slot === this.leader() ? this.t.leaderBonk : 1),
    );

    const alive = this.pawns.filter((p) => !p.out).length;
    const allOut = !this.config.respawn && alive <= 1 && this.pawns.length > 1;
    if (allOut || this.elapsedMs >= this.ctx.timeLimitMs) this.finish();
  }

  private whiskTransform(): { position: Vector3; rotation: Quaternion } {
    const yaw = Quaternion.RotationYawPitchRoll(this.whiskAngle, 0, 0);
    const rotation = this.platterRotation.multiply(yaw);
    const mid = (this.t.whiskInner + this.t.whiskOuter) / 2;
    const position = new Vector3(mid, this.t.whiskHeight / 2 + 0.05, 0).rotateByQuaternionToRef(
      rotation,
      new Vector3(),
    );
    return { position, rotation };
  }

  /** Alleinige Führung (sonst null). */
  private leader(): Slot | null {
    let best: WackelPawn | null = null;
    let tie = false;
    for (const pawn of this.pawns) {
      const score = this.scoreOf(pawn);
      if (!best || score > this.scoreOf(best)) {
        best = pawn;
        tie = false;
      } else if (score === this.scoreOf(best)) tie = true;
    }
    return best && !tie && this.scoreOf(best) > 0 ? best.slot : null;
  }

  private onPlatter(pawn: Pawn): boolean {
    const p = pawn.mesh.position;
    return Math.hypot(p.x, p.z) < this.t.radius + 0.1 && p.y > -0.8 && p.y < 2.2;
  }

  private fall(pawn: WackelPawn): void {
    pawn.falls++;
    pawn.out = true;
    pawn.outAtMs = this.elapsedMs;
    pawn.stick = { x: 0, y: 0 };
    if (pawn.lastBonk && this.elapsedMs - pawn.lastBonk.atMs <= this.t.creditMs) {
      const by = this.pawns.find((p) => p.slot === pawn.lastBonk?.by);
      if (by) by.knockoffs++;
    }
    pawn.lastBonk = null;
    pawn.respawnAtMs = this.config.respawn ? this.elapsedMs + this.t.respawnMs : null;
    // Parken: weit weg, schwerelos, bis zum Comeback (oder für immer).
    pawn.aggregate.body.setGravityFactor(0);
    this.teleporter.move(pawn.aggregate, new Vector3(100 + pawn.slot * 5, -20, 0));
  }

  private respawn(pawn: WackelPawn): void {
    const rng = this.ctx?.rng;
    const angle = (rng?.next() ?? 0) * Math.PI * 2;
    const r = 1 + (rng?.next() ?? 0) * 2;
    pawn.out = false;
    pawn.respawnAtMs = null;
    pawn.aggregate.body.setGravityFactor(1);
    this.teleporter.move(pawn.aggregate, new Vector3(Math.cos(angle) * r, 3, Math.sin(angle) * r));
  }

  private scoreOf(pawn: WackelPawn): number {
    if (this.config.scoring === 'saldo') return pawn.knockoffs - pawn.falls;
    if (this.config.scoring === 'kirsche')
      return Math.floor((pawn.zoneMs / 1000) * this.t.zoneRate);
    if (this.config.scoring === 'stuerze') return pawn.falls;
    const limitS = (this.ctx?.timeLimitMs ?? 0) / 1000;
    if (pawn.outAtMs !== null) return Math.floor(pawn.outAtMs / 1000);
    return Math.min(limitS, Math.floor(this.elapsedMs / 1000) + 1);
  }

  private finish(): void {
    if (this.result) return;
    this.running = false;
    this.result = {
      minigameId: this.info.id,
      placements: rankByScore(
        this.pawns.map((p) => ({ slot: p.slot, score: this.scoreOf(p) })),
        this.info.scoring,
      ),
    };
  }

  getResult(): MinigameResult | null {
    return this.result;
  }

  getHud(): MinigameHud {
    return {
      remainingMs: Math.max(0, Math.round((this.ctx?.timeLimitMs ?? 0) - this.elapsedMs)),
      scores: this.pawns.map((p) => ({ slot: p.slot, score: this.scoreOf(p) })),
    };
  }

  dispose(): void {
    for (const pawn of this.pawns) {
      pawn.aggregate.dispose();
      pawn.mesh.dispose();
    }
    this.pawns.length = 0;
    for (const item of this.disposables.splice(0)) item.dispose();
    this.platter = null;
    this.whisk = null;
  }

  view(): WackelView {
    const pawns: PawnView[] = this.pawns.map((p) => ({
      ...bodyView(p.aggregate),
      slot: p.slot,
      out: p.out,
      canDash: this.elapsedMs / 1000 - p.lastDashAt >= PAWN.dashCooldown,
    }));
    const falls = this.pawns.reduce((s, p) => s + p.falls, 0);
    const knockoffs = this.pawns.reduce((s, p) => s + p.knockoffs, 0);
    const idleMs = this.pawns.reduce(
      (s, p) =>
        s + (p.out && p.outAtMs !== null && !this.config.respawn ? this.elapsedMs - p.outAtMs : 0),
      0,
    );
    return {
      pawns,
      props: [],
      killY: this.t.killY,
      tilt: { pitch: this.pitch, roll: this.roll },
      whiskAngle: this.whisk ? this.whiskAngle : null,
      zone: this.zone ? { ...this.zone, r: this.t.zoneRadius } : null,
      leader: this.leader(),
      tunneled: () => {
        let count = 0;
        for (const p of this.pawns) {
          if (p.out) continue;
          const pos = p.mesh.position;
          const r = Math.hypot(pos.x, pos.z);
          // Oberfläche bei Neigung ≈ −pitch·z + roll·x; Kapselmitte muss darüber liegen.
          const surface = -this.pitch * pos.z + this.roll * pos.x;
          if (r < this.t.radius - 0.8 && pos.y < surface - 0.2) count++;
        }
        return count;
      },
      counters: {
        falls,
        knockoffs,
        idleShare:
          this.pawns.length > 0 ? idleMs / (this.pawns.length * Math.max(1, this.elapsedMs)) : 0,
      },
    };
  }
}

/**
 * Bot für den Wackelpudding. Seit CHAOS-180 im Produktcode (`pudding-gerangel/bot.ts`), gleiche
 * Rechnung und Zufallsfolge (Teller- und Löffelmaße wie `WACKEL`).
 */
export const wackelBot: BotPolicy<WackelView> = (me, view, skill, rng) =>
  puddingDecision(me, view, skill, rng);
