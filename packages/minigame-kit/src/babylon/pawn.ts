/**
 * Havok-Figur für Physik-Minispiele (CHAOS-241, aus Eiswürfel-Sumo, Pudding-Gerangel und
 * Krümel-Kehraus herausgelöst): aufrechte Kapsel (Trägheit 0) mit Füßen am Knotenursprung,
 * Lenken per Impuls (`steeringDeltaV`), Antritt mit Abklingzeit und Lenkpause, Rempler im
 * Vorwärtskegel mit Stoß für das Opfer und Rückstoß für den Rempler, Parken und Zurückholen
 * samt `disablePreStep`, Sicht für Bots und Figur mit Abzeichen und Animation. Dazu `HavokBlock`:
 * ein statischer Block, dessen Box sich tauschen lässt (schmelzende Scholle, schrumpfende Insel).
 *
 * Was ein Rempler bewirkt (Punkte, Gutschrift, Geräusch), entscheidet das Spiel: `bonkPawns`
 * stößt nur und meldet die Treffer. Wann gelenkt wird (auf dem Boden, auf dem Eis), ebenso:
 * Das Spiel ruft `steer` nur, wenn die Figur lenken darf.
 */
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { PhysicsMotionType } from '@babylonjs/core/Physics/v2/IPhysicsEnginePlugin.js';
import { PhysicsBody } from '@babylonjs/core/Physics/v2/physicsBody.js';
import type { PhysicsMaterial } from '@babylonjs/core/Physics/v2/physicsMaterial.js';
import { PhysicsShapeBox, PhysicsShapeCapsule } from '@babylonjs/core/Physics/v2/physicsShape.js';
import type { MinigameInput, Slot } from '@chaos-party/minigame-sdk';
import type { MinigameContext, MinigamePlayer } from '@chaos-party/minigame-sdk/babylon';
import type { PawnBotView } from '../bots.ts';
import { DASH_AIM_DEADZONE, clampStick, steeringDeltaV, type SteeringRules } from '../movement.ts';
import { SlotFigure, type SlotFigureOptions } from './figures.ts';
import type { MinigameStage } from './stage.ts';

/** Antritt (A): setzt das Tempo in Blickrichtung (nicht obendrauf, Anlauf zählt nicht). */
export interface HavokDashRules {
  /** Tempo des Antritts (m/s). */
  readonly speed: number;
  readonly cooldownS: number;
  /** So lange nach dem Antritt trifft ein Rempler. */
  readonly hitS: number;
  /** Lenkpause nach dem Antritt. */
  readonly pauseS: number;
}

/** Treffer: Stoß nach außen für das Opfer, Rückstoß für den Rempler. */
export interface HavokPushRules {
  /** Tempo, mit dem das Opfer weggestoßen wird (m/s). */
  readonly speed: number;
  /** Stoß nach oben für das Opfer (m/s, Standard 1). */
  readonly lift?: number;
  /** Rückstoß des Remplers als Anteil von `speed` (0 = keiner). */
  readonly recoil: number;
  /** Hopser des Remplers beim Rückstoß (m/s, Standard 0,5). */
  readonly recoilLift?: number;
  /** Lenkpause des Opfers nach dem Treffer. */
  readonly victimPauseS: number;
  /** Lenkpause des Remplers nach dem Treffer. */
  readonly attackerPauseS: number;
  /** Vorwärtskegel als Kosinus des halben Winkels (Standard 0,6 ≈ ±53°): Zielen zählt. */
  readonly cone?: number;
  /** Reichweite über die Berührung hinaus (m, Standard 0,15). */
  readonly reach?: number;
}

export interface HavokPawnOptions {
  readonly radius: number;
  readonly height: number;
  readonly mass?: number;
  readonly friction?: number;
  readonly restitution?: number;
  readonly damping?: number;
  readonly steering: SteeringRules;
  readonly dash: HavokDashRules;
  readonly push: HavokPushRules;
  /** Startpunkt der Füße. */
  readonly start: { readonly x: number; readonly z: number; readonly y?: number };
  /** Blickrichtung am Start (Standard: zur Mitte). */
  readonly facing?: { readonly x: number; readonly z: number };
  readonly figure?: SlotFigureOptions;
}

const velocity = new Vector3();
const v3 = (x = 0, y = 0, z = 0) => new Vector3(x, y, z);

export class HavokPawn {
  stick = { x: 0, y: 0 };
  facing: { x: number; z: number };
  dashQueued = false;
  lastDash = -10;
  /** Bis dahin lenkt die Figur nicht (getroffen oder nach einem Treffer). */
  hitUntil = 0;
  /** Der laufende Antritt kann noch treffen (trifft nur einmal). */
  armed = false;
  /** Geparkt: Körper weit weg und schwerelos (gefallen, wartet auf Rückkehr). */
  parked = false;
  private settling = false;

  private constructor(
    readonly slot: Slot,
    readonly node: TransformNode,
    readonly body: PhysicsBody,
    readonly figure: SlotFigure,
    readonly options: HavokPawnOptions,
  ) {
    const { x, z } = options.start;
    const length = Math.hypot(x, z);
    this.facing =
      options.facing ?? (length > 1e-6 ? { x: -x / length, z: -z / length } : { x: 0, z: 1 });
  }

  static async create(
    stage: MinigameStage,
    player: MinigamePlayer,
    options: HavokPawnOptions,
  ): Promise<HavokPawn> {
    const { radius: r, height: h, start } = options;
    const node = stage.node('koerper');
    node.position.set(start.x, start.y ?? 0.02, start.z);
    const body = stage.track(new PhysicsBody(node, PhysicsMotionType.DYNAMIC, false, stage.scene));
    const shape = new PhysicsShapeCapsule(v3(0, r), v3(0, h - r), r, stage.scene);
    shape.material = {
      friction: options.friction ?? 0.05,
      restitution: options.restitution ?? 0.35,
    };
    body.shape = stage.track(shape);
    // Trägheit 0: Figuren bleiben aufrecht, auch beim Rempeln.
    body.setMassProperties({ mass: options.mass ?? 1, inertia: v3(), centerOfMass: v3(0, h / 2) });
    body.setLinearDamping(options.damping ?? 0.3);
    const figure = await SlotFigure.create(stage, player, options.figure);
    return new HavokPawn(player.slot, node, body, figure, options);
  }

  get position(): Vector3 {
    return this.node.position;
  }

  get mass(): number {
    return this.options.mass ?? 1;
  }

  /** Stick lenkt und dreht den Blick, A merkt einen Antritt vor. */
  input(input: MinigameInput): void {
    if (input.type === 'press' && input.button === 'a') this.dashQueued = true;
    if (input.type !== 'move') return;
    const stick = (this.stick = clampStick(input.x, input.y));
    const length = Math.hypot(stick.x, stick.y);
    if (length > DASH_AIM_DEADZONE) this.facing = { x: stick.x / length, z: stick.y / length };
  }

  canDash(now: number): boolean {
    return now - this.lastDash >= this.options.dash.cooldownS;
  }

  dashing(now: number): boolean {
    return now - this.lastDash < this.options.dash.hitS;
  }

  /** Waagrechte Geschwindigkeit (frisch aus Havok). */
  velocity(): { x: number; y: number; z: number } {
    this.body.getLinearVelocityToRef(velocity);
    return { x: velocity.x, y: velocity.y, z: velocity.z };
  }

  /**
   * Ein Schritt Lenken: vorgemerkter Antritt (wenn bereit), dann Lenk-Impuls, außer in der
   * Lenkpause. Liefert, ob die Figur gerade angetreten ist (Geräusch macht das Spiel).
   */
  steer(now: number, dt: number): boolean {
    const { dash, steering } = this.options;
    this.body.getLinearVelocityToRef(velocity);
    let dashed = false;
    if (this.dashQueued && this.canDash(now)) {
      Object.assign(this, { lastDash: now, armed: true });
      const { x: fx, z: fz } = this.facing;
      this.body.setLinearVelocity(v3(fx * dash.speed, velocity.y, fz * dash.speed));
      dashed = true;
    }
    this.dashQueued = false;
    if (now < this.hitUntil || now - this.lastDash < dash.pauseS) return dashed;
    const dv = steeringDeltaV(velocity, this.stick, dt, steering);
    this.body.applyImpulse(v3(dv.x * this.mass, 0, dv.z * this.mass), this.node.position);
    return dashed;
  }

  /** Zu Beginn jedes `update`: nach `teleport` wieder der Physik folgen. */
  settle(): void {
    if (!this.settling) return;
    this.body.disablePreStep = true;
    this.settling = false;
  }

  /** Körper versetzen, ohne Tempo (wirkt im nächsten Physik-Schritt, `settle` danach). */
  teleport(x: number, y: number, z: number): void {
    this.node.position.set(x, y, z);
    this.body.disablePreStep = false;
    this.body.setLinearVelocity(v3());
    this.settling = true;
  }

  /** Parken: weit weg und schwerelos, bis `recall`. */
  park(x = 100 + this.slot * 5, y = 0, z = 0): void {
    this.parked = true;
    this.body.setGravityFactor(0);
    this.teleport(x, y, z);
  }

  /** Zurückholen an `(x, y, z)` mit Schwerkraft. */
  recall(x: number, y: number, z: number): void {
    this.parked = false;
    this.body.setGravityFactor(1);
    this.teleport(x, y, z);
  }

  /** Was ein Bot sieht (Lage, Rutschen, raus, Antritt bereit). */
  view(now: number): PawnBotView {
    const { x, z } = this.node.position;
    const { x: vx, z: vz } = this.velocity();
    return { slot: this.slot, x, z, vx, vz, out: this.parked, canDash: this.canDash(now) };
  }

  /**
   * Figur an den Körper (oder an `at`, z. B. treibend in der Limo) setzen und animieren:
   * benommen, solange geparkt oder getroffen.
   */
  show(now: number, dt: number, over: boolean, at?: { x: number; y: number; z: number }): void {
    const { x, y, z } = at ?? this.node.position;
    this.figure.place(x, z, Math.atan2(this.facing.x, this.facing.z), y);
    const stunned = this.parked || now < this.hitUntil;
    const moving = !this.parked && Math.hypot(this.stick.x, this.stick.y) > 0.15;
    const dashing = !this.parked && this.dashing(now);
    this.figure.show({ stunned, dashing, moving }, dt, over);
  }

  /** Nur die Figur der Laufzeit; Körper und Form räumt die Bühne ab. */
  dispose(): void {
    this.figure.dispose();
  }
}

/** Legt eine Havok-Figur an (Körper und Form räumt `stage.dispose()` ab). */
export function havokPawn(
  stage: MinigameStage,
  player: MinigamePlayer,
  options: HavokPawnOptions,
): Promise<HavokPawn> {
  return HavokPawn.create(stage, player, options);
}

export interface HavokBonk {
  readonly attacker: HavokPawn;
  readonly victim: HavokPawn;
  /** Mitte zwischen beiden in Brusthöhe (für Funken). */
  readonly at: { readonly x: number; readonly y: number; readonly z: number };
}

/**
 * Rempler auflösen: Wer gerade angetreten ist, trifft die erste nicht geparkte Figur im
 * Vorwärtskegel in Reichweite. Das Opfer fliegt nach außen, der Rempler rutscht zurück; beide
 * pausieren das Lenken. Liefert die Treffer in Reihenfolge der Figuren.
 */
export function bonkPawns(pawns: readonly HavokPawn[], now: number): HavokBonk[] {
  const bonks: HavokBonk[] = [];
  for (const attacker of pawns) {
    const { dash, push, radius } = attacker.options;
    if (!attacker.armed || now - attacker.lastDash > dash.hitS) continue;
    const a = attacker.position;
    const cone = push.cone ?? 0.6;
    const reach = radius * 2 + (push.reach ?? 0.15);
    const victim = pawns.find((other) => {
      const v = other.position;
      const [dx, dz] = [v.x - a.x, v.z - a.z];
      const d = Math.hypot(dx, dz);
      const ahead = dx * attacker.facing.x + dz * attacker.facing.z > d * cone;
      const near = d < reach && ahead && Math.abs(v.y - a.y) < 1;
      return other !== attacker && !other.parked && near;
    });
    if (!victim) continue;
    const v = victim.position;
    const d = Math.max(Math.hypot(v.x - a.x, v.z - a.z), 1e-4);
    const [nx, nz] = [(v.x - a.x) / d, (v.z - a.z) / d];
    const m = victim.mass;
    victim.body.applyImpulse(v3(nx * push.speed * m, (push.lift ?? 1) * m, nz * push.speed * m), v);
    const back = -push.speed * push.recoil;
    attacker.body.setLinearVelocity(v3(nx * back, push.recoilLift ?? 0.5, nz * back));
    victim.hitUntil = now + push.victimPauseS;
    Object.assign(attacker, { armed: false, hitUntil: now + push.attackerPauseS });
    bonks.push({ attacker, victim, at: { x: (a.x + v.x) / 2, y: a.y + 0.9, z: (a.z + v.z) / 2 } });
  }
  return bonks;
}

/** Übliche Treffer-Wirkung: Rums mit leicht zufälliger Tonhöhe, Funken, Wackeln. */
export function bonkFx(ctx: MinigameContext, bonk: HavokBonk, shake = 0.2): void {
  ctx.fx.sound('bump', { pitch: 0.9 + ctx.rng.next() * 0.3 });
  ctx.fx.burst('impact', bonk.at);
  ctx.fx.shake(shake);
}

/** Statischer Block (Scholle, Plattform), dessen Box sich tauschen lässt (schmelzen, schrumpfen). */
export class HavokBlock {
  readonly body: PhysicsBody;

  constructor(
    private readonly stage: MinigameStage,
    name: string,
    readonly material: PhysicsMaterial = { friction: 0.5, restitution: 0.1 },
  ) {
    const node = stage.node(name);
    this.body = stage.track(new PhysicsBody(node, PhysicsMotionType.STATIC, false, stage.scene));
  }

  /** Neue Box mit halben Kanten und Oberkante bei `top` (die alte Form räumt die Bühne ab). */
  resize(halfX: number, depth: number, halfZ: number, top = 0): void {
    const size = v3(halfX * 2, depth, halfZ * 2);
    const center = v3(0, top - depth / 2);
    const shape = new PhysicsShapeBox(center, Quaternion.Identity(), size, this.stage.scene);
    shape.material = this.material;
    this.body.shape = this.stage.track(shape);
  }
}
