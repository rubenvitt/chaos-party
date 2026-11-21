/**
 * Gemeinsame Bausteine der Physik-Prototypen (EXP-006, CHAOS-29/31): Spielfigur als
 * Havok-Kapsel mit Lenkung und Rempler, Bots mit Können-Stufen, Mess-Schleife über
 * `runMinigameHeadless` und Tabellen für den Experiment-Eintrag.
 *
 * Wegwerf-Code für den Konzeptvergleich: schlichte Optik, keine Figuren. Das gewählte
 * Minispiel hat eigenen, sauberen Code in `src/<id>/`.
 */
import { CreateCapsule } from '@babylonjs/core/Meshes/Builders/capsuleBuilder.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import type { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import {
  PhysicsMotionType,
  PhysicsShapeType,
} from '@babylonjs/core/Physics/v2/IPhysicsEnginePlugin.js';
import { PhysicsAggregate } from '@babylonjs/core/Physics/v2/physicsAggregate.js';
import type { Scene } from '@babylonjs/core/scene.js';
import {
  createMinigameRng,
  type MinigameInput,
  type MinigameRng,
  type Slot,
} from '@chaos-party/minigame-sdk';
import type { MinigameModule } from '@chaos-party/minigame-sdk/babylon';
import { runMinigameHeadless } from '@chaos-party/minigame-sdk/testing';
import { aim, type PawnBotSkill, type PawnDecision } from '@chaos-party/minigame-kit';

export const STEP = 1 / 60;

/** Bewegungswerte der Prototyp-Figur (wie die M1-Arena, etwas rutschiger). */
export const PAWN = {
  radius: 0.45,
  height: 1.5,
  mass: 1,
  maxSpeed: 5.5,
  responsiveness: 8,
  maxAcceleration: 28,
  dashSpeed: 9,
  dashCooldown: 1,
  dashSteerPause: 0.3,
  bonkSpeed: 6,
  bonkLift: 2.5,
  /** Harte Obergrenze gegen Ausreißer (m/s). */
  speedLimit: 22,
} as const;

export interface Pawn {
  readonly slot: Slot;
  readonly mesh: Mesh;
  readonly aggregate: PhysicsAggregate;
  stick: { x: number; y: number };
  dashQueued: boolean;
  lastDashAt: number;
  /** Schläge dieses Remplers schon verteilt (je Opfer einmal). */
  bonked: Set<Slot>;
  facing: { x: number; z: number };
}

export function createPawn(scene: Scene, slot: Slot, position: Vector3): Pawn {
  const mesh = CreateCapsule(
    `proto-figur-${slot}`,
    { height: PAWN.height, radius: PAWN.radius },
    scene,
  );
  mesh.position.copyFrom(position);
  const aggregate = new PhysicsAggregate(
    mesh,
    PhysicsShapeType.CAPSULE,
    { mass: PAWN.mass, friction: 0.35, restitution: 0.4 },
    scene,
  );
  aggregate.body.setMotionType(PhysicsMotionType.DYNAMIC);
  aggregate.body.setMassProperties({ mass: PAWN.mass, inertia: new Vector3(0, 0, 0) });
  aggregate.body.setLinearDamping(0.1);
  return {
    slot,
    mesh,
    aggregate,
    stick: { x: 0, y: 0 },
    dashQueued: false,
    lastDashAt: Number.NEGATIVE_INFINITY,
    bonked: new Set(),
    facing: { x: 0, z: 1 },
  };
}

export function applyPawnInput(pawn: Pawn, input: MinigameInput): void {
  if (input.type === 'move') {
    const len = Math.hypot(input.x, input.y);
    pawn.stick = len > 1 ? { x: input.x / len, y: input.y / len } : { x: input.x, y: input.y };
  } else if (input.type === 'press' && input.button === 'a') {
    pawn.dashQueued = true;
  }
}

const tmpVelocity = new Vector3();
const tmpImpulse = new Vector3();

/**
 * Ein Lenkschritt: Rempler (Stoß in Stick- oder Blickrichtung), sonst Ist- zur
 * Sollgeschwindigkeit ziehen. `grounded = false` → keine Lenkung (in der Luft).
 */
export function steerPawn(pawn: Pawn, time: number, grounded: boolean): void {
  const body = pawn.aggregate.body;
  body.getLinearVelocityToRef(tmpVelocity);
  const center = pawn.mesh.position;
  const moving = Math.hypot(pawn.stick.x, pawn.stick.y) > 0.1;
  if (moving) {
    const len = Math.hypot(pawn.stick.x, pawn.stick.y);
    pawn.facing = { x: pawn.stick.x / len, z: pawn.stick.y / len };
  }
  if (pawn.dashQueued) {
    pawn.dashQueued = false;
    if (grounded && time - pawn.lastDashAt >= PAWN.dashCooldown) {
      pawn.lastDashAt = time;
      pawn.bonked.clear();
      tmpImpulse.set(
        pawn.facing.x * PAWN.dashSpeed * PAWN.mass,
        0,
        pawn.facing.z * PAWN.dashSpeed * PAWN.mass,
      );
      body.applyImpulse(tmpImpulse, center);
    }
  }
  if (grounded && time - pawn.lastDashAt >= PAWN.dashSteerPause) {
    const blend = Math.min(1, PAWN.responsiveness * STEP);
    let dx = (pawn.stick.x * PAWN.maxSpeed - tmpVelocity.x) * blend;
    let dz = (pawn.stick.y * PAWN.maxSpeed - tmpVelocity.z) * blend;
    const max = PAWN.maxAcceleration * STEP;
    const len = Math.hypot(dx, dz);
    if (len > max) {
      dx = (dx / len) * max;
      dz = (dz / len) * max;
    }
    tmpImpulse.set(dx * PAWN.mass, 0, dz * PAWN.mass);
    body.applyImpulse(tmpImpulse, center);
  }
  clampSpeed(pawn.aggregate, PAWN.speedLimit);
}

/** Rempler trifft: Opfer bekommt einen Extra-Schubs (einmal je Rempler). */
export function bonkCheck(
  pawns: readonly Pawn[],
  time: number,
  onBonk: (by: Pawn, victim: Pawn) => void,
  boost: (victim: Pawn) => number = () => 1,
): void {
  for (const attacker of pawns) {
    if (time - attacker.lastDashAt > 0.35) continue;
    for (const victim of pawns) {
      if (victim === attacker || attacker.bonked.has(victim.slot)) continue;
      const dx = victim.mesh.position.x - attacker.mesh.position.x;
      const dz = victim.mesh.position.z - attacker.mesh.position.z;
      const dist = Math.hypot(dx, dz);
      if (
        dist > PAWN.radius * 2 + 0.25 ||
        Math.abs(victim.mesh.position.y - attacker.mesh.position.y) > 1
      ) {
        continue;
      }
      attacker.bonked.add(victim.slot);
      const nx = dist > 1e-4 ? dx / dist : attacker.facing.x;
      const nz = dist > 1e-4 ? dz / dist : attacker.facing.z;
      const push = PAWN.bonkSpeed * boost(victim) * PAWN.mass;
      tmpImpulse.set(nx * push, PAWN.bonkLift * PAWN.mass, nz * push);
      victim.aggregate.body.applyImpulse(tmpImpulse, victim.mesh.position);
      onBonk(attacker, victim);
    }
  }
}

export function clampSpeed(aggregate: PhysicsAggregate, limit: number): void {
  aggregate.body.getLinearVelocityToRef(tmpVelocity);
  const speed = tmpVelocity.length();
  if (speed > limit) {
    tmpVelocity.scaleInPlace(limit / speed);
    aggregate.body.setLinearVelocity(tmpVelocity);
  }
}

/**
 * Versetzt Körper (gilt im nächsten Physikschritt, Geschwindigkeit 0). `settle()` am Anfang
 * jedes `update` schaltet den Vorab-Abgleich wieder ab, damit Havok die Körper führt.
 */
export class Teleporter {
  private readonly pending: PhysicsAggregate[] = [];

  move(aggregate: PhysicsAggregate, position: Vector3): void {
    aggregate.transformNode.position.copyFrom(position);
    aggregate.body.disablePreStep = false;
    aggregate.body.setLinearVelocity(Vector3.Zero());
    aggregate.body.setAngularVelocity(Vector3.Zero());
    this.pending.push(aggregate);
  }

  settle(): void {
    for (const aggregate of this.pending.splice(0)) aggregate.body.disablePreStep = true;
  }
}

// --- Beobachtung für Bots und Messung -------------------------------------------------

export interface BodyView {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly vx: number;
  readonly vy: number;
  readonly vz: number;
}

export interface PawnView extends BodyView {
  readonly slot: Slot;
  /** Gerade nicht im Spiel (raus oder im Respawn). */
  readonly out: boolean;
  readonly canDash: boolean;
}

export function bodyView(aggregate: PhysicsAggregate): BodyView {
  const p = aggregate.transformNode.position;
  aggregate.body.getLinearVelocityToRef(tmpVelocity);
  return { x: p.x, y: p.y, z: p.z, vx: tmpVelocity.x, vy: tmpVelocity.y, vz: tmpVelocity.z };
}

/** Was jeder Prototyp für Bots und Messung offenlegt. */
export interface ProtoView {
  readonly pawns: readonly PawnView[];
  /** Weitere bewegliche Körper (Krümel, Kugeln); `active = false` → gerade geparkt. */
  readonly props: readonly (BodyView & { readonly active: boolean })[];
  /** Untergrenze: darunter muss ein Körper als „raus“/„geparkt“ gelten. */
  readonly killY: number;
  /** Körper, die horizontal über der Spielfläche, aber deutlich unter ihr stecken. */
  tunneled(): number;
  /** Zähler fürs Experiment (Stürze, Schubser, Krümel …). */
  readonly counters: Readonly<Record<string, number>>;
}

export interface Prototype<View extends ProtoView> {
  readonly module: MinigameModule;
  peek(): View | null;
}

// --- Bots -------------------------------------------------------------------------------

/** Seit CHAOS-180 im Baukasten (`PawnBotSkill`), damit die Produkt-Bots ihn ohne Prototyp nutzen. */
export type BotSkill = PawnBotSkill;

export const SKILLS = {
  normal: { name: 'normal', replanSteps: 10, noise: 0.25, dashChance: 0.6, aware: true },
  weak: { name: 'schwach', replanSteps: 24, noise: 0.6, dashChance: 0.3, aware: false },
  slightlyWeak: {
    name: 'etwas schwächer',
    replanSteps: 14,
    noise: 0.35,
    dashChance: 0.45,
    aware: false,
  },
} as const satisfies Record<string, BotSkill>;

export type BotDecision = PawnDecision;

export type BotPolicy<View extends ProtoView> = (
  me: PawnView,
  view: View,
  skill: BotSkill,
  rng: MinigameRng,
) => BotDecision;

/** Seit CHAOS-180 im Baukasten (gleiche Rechnung, gleiche Zufallsfolge). */
export { aim };

// --- Messung ----------------------------------------------------------------------------

export interface RunMetrics {
  readonly players: number;
  readonly seed: number;
  readonly durationMs: number;
  readonly forced: boolean;
  readonly scores: readonly { slot: Slot; score: number; place: number }[];
  readonly weakSlot: Slot;
  readonly weakFirst: boolean;
  /** Punkte der schwachen Person relativ zum Schnitt der anderen (1 = gleich gut). */
  readonly weakShare: number;
  readonly tieFirst: boolean;
  readonly spread: number;
  readonly counters: Readonly<Record<string, number>>;
  readonly nan: number;
  readonly lost: number;
  readonly tunneled: number;
  readonly maxSpeed: number;
  readonly stepMsMean: number;
  readonly stepMsP99: number;
  readonly residueOk: boolean;
}

export async function simulate<View extends ProtoView>(
  makePrototype: () => Prototype<View>,
  policy: BotPolicy<View>,
  players: number,
  seed: number,
  timeLimitMs?: number,
  weakSkill: BotSkill = SKILLS.weak,
): Promise<RunMetrics> {
  const proto = makePrototype();
  const weakSlot = (((seed - 1) % players) + 1) as Slot;
  const rng = createMinigameRng(seed * 7919 + 13);
  const plans = new Map<Slot, BotDecision>();
  const stepTimes: number[] = [];
  let lastCall: number | null = null;
  let nan = 0;
  let lost = 0;
  let tunneled = 0;
  let maxSpeed = 0;
  let step = 0;
  let counters: Readonly<Record<string, number>> = {};
  const run = await runMinigameHeadless(proto.module, {
    players,
    seed,
    ...(timeLimitMs === undefined ? {} : { timeLimitMs }),
    script: (_elapsed, send) => {
      const now = performance.now();
      if (lastCall !== null) stepTimes.push(now - lastCall);
      const view = proto.peek();
      if (view) {
        for (const body of [...view.pawns, ...view.props.filter((prop) => prop.active)]) {
          const values = [body.x, body.y, body.z, body.vx, body.vy, body.vz];
          if (values.some((value) => !Number.isFinite(value))) nan++;
          maxSpeed = Math.max(maxSpeed, Math.hypot(body.vx, body.vy, body.vz));
        }
        for (const pawn of view.pawns) if (!pawn.out && pawn.y < view.killY - 1) lost++;
        for (const prop of view.props) if (prop.active && prop.y < view.killY - 1) lost++;
        tunneled += view.tunneled();
        counters = view.counters;
        for (const me of view.pawns) {
          if (me.out) continue;
          const skill = me.slot === weakSlot ? weakSkill : SKILLS.normal;
          // Versetzt neu planen, damit nicht alle Bots im selben Schritt reagieren.
          if ((step + me.slot * 3) % skill.replanSteps === 0 || !plans.has(me.slot)) {
            const decision = policy(me, view, skill, rng);
            plans.set(me.slot, decision);
            send(me.slot, { type: 'move', x: decision.x, y: decision.y });
            if (decision.dash) {
              send(me.slot, { type: 'press', button: 'a' });
              send(me.slot, { type: 'release', button: 'a' });
            }
          }
        }
      }
      step++;
      lastCall = performance.now();
    },
  });
  const outcome = run.outcome;
  if (!outcome) throw new Error('Prototyp lieferte kein Ergebnis');
  const placements = outcome.result.placements;
  const scores = placements.map((p) => ({ slot: p.slot, score: p.score, place: p.place }));
  const values = scores.map((s) => s.score);
  stepTimes.sort((a, b) => a - b);
  return {
    players,
    seed,
    durationMs: outcome.elapsedMs,
    forced: outcome.forced,
    scores,
    weakSlot,
    weakFirst: placements.some((p) => p.slot === weakSlot && p.place === 1),
    weakShare: weakShareOf(scores, weakSlot),
    tieFirst: placements.filter((p) => p.place === 1).length > 1,
    spread: Math.max(...values) - Math.min(...values),
    counters: { ...counters },
    nan,
    lost,
    tunneled,
    maxSpeed,
    stepMsMean: stepTimes.reduce((sum, t) => sum + t, 0) / Math.max(1, stepTimes.length),
    stepMsP99: stepTimes[Math.floor(stepTimes.length * 0.99)] ?? 0,
    residueOk: Object.values(run.residue).every((count) => count === 0),
  };
}

function weakShareOf(scores: readonly { slot: Slot; score: number }[], weakSlot: Slot): number {
  const weak = scores.find((s) => s.slot === weakSlot)?.score ?? 0;
  const others = scores.filter((s) => s.slot !== weakSlot);
  const mean = others.reduce((sum, s) => sum + s.score, 0) / Math.max(1, others.length);
  return mean === 0 ? 1 : weak / mean;
}

export interface VariantSummary {
  readonly variant: string;
  readonly players: number;
  readonly runs: number;
  readonly durationS: number;
  readonly spread: number;
  readonly tieFirst: number;
  readonly weakFirst: number;
  readonly weakPlace: number;
  readonly fair: number;
  readonly counters: Readonly<Record<string, number>>;
  readonly unstable: number;
  readonly maxSpeed: number;
  readonly stepMsMean: number;
  readonly stepMsP99: number;
}

export function summarize(variant: string, runs: readonly RunMetrics[]): VariantSummary {
  const n = runs.length;
  const mean = (pick: (run: RunMetrics) => number) => runs.reduce((s, r) => s + pick(r), 0) / n;
  const counterKeys = new Set(runs.flatMap((r) => Object.keys(r.counters)));
  const counters: Record<string, number> = {};
  for (const key of counterKeys) counters[key] = mean((r) => r.counters[key] ?? 0);
  const players = runs[0]?.players ?? 0;
  return {
    variant,
    players,
    runs: n,
    durationS: mean((r) => r.durationMs) / 1000,
    spread: mean((r) => r.spread),
    tieFirst: mean((r) => (r.tieFirst ? 1 : 0)),
    weakFirst: mean((r) => (r.weakFirst ? 1 : 0)),
    weakPlace: mean((r) => r.scores.find((s) => s.slot === r.weakSlot)?.place ?? 0),
    fair: 1 / Math.max(1, players),
    counters,
    unstable: runs.reduce((s, r) => s + r.nan + r.lost + r.tunneled + (r.residueOk ? 0 : 1), 0),
    maxSpeed: Math.max(...runs.map((r) => r.maxSpeed)),
    stepMsMean: mean((r) => r.stepMsMean),
    stepMsP99: Math.max(...runs.map((r) => r.stepMsP99)),
  };
}

const de = (value: number, digits = 1) =>
  value.toLocaleString('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const pct = (value: number) => `${Math.round(value * 100)} %`;

export function toMarkdown(
  title: string,
  rows: readonly VariantSummary[],
  counterColumns: readonly { key: string; label: string }[],
): string {
  const head = [
    'Variante',
    'Sp.',
    'Dauer s',
    'Abstand',
    'Gleichst. Pl. 1',
    'Schwach Pl. 1',
    'Schwach Ø Platz',
    'fair',
    ...counterColumns.map((c) => c.label),
    'instabil',
    'max m/s',
    'ms/Schritt',
    'ms p99',
  ];
  const lines = [
    `**${title}**`,
    '',
    `| ${head.join(' | ')} |`,
    `| ${head.map(() => '---').join(' | ')} |`,
  ];
  for (const row of rows) {
    lines.push(
      `| ${[
        row.variant,
        String(row.players),
        de(row.durationS),
        de(row.spread),
        pct(row.tieFirst),
        pct(row.weakFirst),
        de(row.weakPlace),
        pct(row.fair),
        ...counterColumns.map((c) => de(row.counters[c.key] ?? 0)),
        String(row.unstable),
        de(row.maxSpeed),
        de(row.stepMsMean, 3),
        de(row.stepMsP99, 2),
      ].join(' | ')} |`,
    );
  }
  return lines.join('\n');
}
