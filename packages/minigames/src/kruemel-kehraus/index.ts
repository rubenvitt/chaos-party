/**
 * Krümel-Kehraus – Physik-Minispiel (CHAOS-79, EXP-023; Konzept aus EXP-006 überarbeitet).
 *
 * Ein Holzblech mit hohem Rand, in jeder genutzten Ecke ein Mauseloch unter einem Torbogen in
 * Slot-Farbe. Wer Krümel durch das eigene Loch schiebt, bekommt Punkte (Gold zählt 3). Krümel
 * passen unter dem Sturz hindurch, Figuren nicht: Anders als in EXP-006 fällt niemand mehr
 * herunter. Getroffene Krümel fallen kurz darauf an einer zufälligen Stelle wieder herein
 * (sichtbares Glück). In den letzten 8 s zerbröselt ein Riesenkeks in der Mitte.
 *
 * Physik: Blech, Rand und Stürze sind statische Körper, Figuren dynamische Kapseln mit
 * gesperrter Drehung (wie Pudding-Gerangel), Krümel dynamische Kugeln. Hitboxen der Figuren
 * und Krümel sind unsichtbar, Optik hängt als Kind daran. Zeit nur über `update`, Zufall nur
 * über `ctx.rng`.
 */
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera.js';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { CreateCapsule } from '@babylonjs/core/Meshes/Builders/capsuleBuilder.js';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder.js';
import type { Mesh } from '@babylonjs/core/Meshes/mesh.js';
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
import { createKruemelBot } from './bot.ts';
import { KRUEMEL_KEHRAUS_INFO } from './info.ts';
import {
  allCorners,
  approachAngle,
  bannerFor,
  buildHighlights,
  clampStick,
  cornersFor,
  dropAreaFor,
  dropPoint,
  hasBackHole,
  MOUTH_WIDTH,
  holeOf,
  KRUEMEL_RULES,
  leaderOf,
  PAWN,
  rainPoints,
  spawnFor,
  statusFor,
  steeringDeltaV,
  touches,
  TUNING,
  yawFor,
  type Corner,
  type DropArea,
  type KruemelRules,
  type Vec2,
} from './logic.ts';
import {
  boardMaterials,
  buildCrumbVisual,
  buildLegs,
  buildMouseHole,
  buildPawnDecor,
  buildPlainStage,
  buildWoolStripes,
  plank,
  toyParts,
  type ToyParts,
} from './visuals.ts';

const TURN_SPEED = 12;
const HALF_HEIGHT = PAWN.height / 2;
/** So lange zeigt der HUD „+1“ bzw. „Gold +3“ nach einem Treffer (ms). */
const STATUS_MS = 1200;

interface Pawn {
  readonly player: MinigamePlayer;
  readonly corner: Corner;
  readonly hitbox: Mesh;
  readonly aggregate: PhysicsAggregate;
  readonly character: CharacterHandle;
  readonly decor: { ring: Mesh; pin: Mesh };
  stick: { x: number; y: number };
  dashQueued: boolean;
  lastDashMs: number;
  readonly bonked: Set<Slot>;
  facing: Vec2;
  yaw: number;
  score: number;
  own: number;
  gifts: number;
  golds: number;
  bonks: number;
  lastScoreMs: number;
  lastValue: number;
  hitUntilMs: number;
  animation: CharacterAnimation | null;
}

interface Crumb {
  readonly index: number;
  readonly kind: 'crumb' | 'gold' | 'rain';
  readonly radius: number;
  readonly hitbox: Mesh;
  readonly aggregate: PhysicsAggregate;
  active: boolean;
  /** Wann der geparkte Krümel wieder hereinfällt (`null` = bleibt geparkt). */
  dropAtMs: number | null;
  lastToucher: Slot | null;
}

/** Zustand für Tests und Bots (keine Spielregeln, nur Beobachtung). */
export interface KruemelSnapshot {
  readonly elapsedMs: number;
  readonly limitMs: number;
  readonly pawns: readonly {
    readonly slot: Slot;
    readonly x: number;
    readonly y: number;
    readonly z: number;
    readonly vx: number;
    readonly vy: number;
    readonly vz: number;
    readonly canDash: boolean;
  }[];
  readonly crumbs: readonly {
    readonly index: number;
    readonly x: number;
    readonly y: number;
    readonly z: number;
    readonly vx: number;
    readonly vy: number;
    readonly vz: number;
    readonly active: boolean;
    readonly value: number;
    readonly radius: number;
  }[];
  readonly goals: readonly { readonly slot: Slot; readonly corner: Corner }[];
  readonly ball: { readonly x: number; readonly y: number; readonly z: number } | null;
  readonly scores: readonly { readonly slot: Slot; readonly score: number }[];
  readonly leader: Slot | null;
  readonly rain: boolean;
  readonly counters: {
    readonly scored: number;
    readonly gifts: number;
    readonly golds: number;
    readonly bonks: number;
    readonly rainScored: number;
    /** Körper, die das Blech verlassen haben (sollte 0 sein). */
    readonly lost: number;
  };
}

const tmpVelocity = new Vector3();
const tmpImpulse = new Vector3();

export class KruemelKehraus implements Minigame {
  private ctx: MinigameContext | null = null;
  private readonly pawns: Pawn[] = [];
  private readonly crumbs: Crumb[] = [];
  private ball: { hitbox: Mesh; aggregate: PhysicsAggregate } | null = null;
  private disposables: ToyParts = toyParts(undefined);
  private readonly teleported: PhysicsAggregate[] = [];
  private corners: Corner[] = [];
  private area: DropArea = dropAreaFor(4);
  private elapsedMs = 0;
  private running = false;
  private finished = false;
  private result: MinigameResult | null = null;
  private nextGoldAtMs: number | null = null;
  private goldSinceMs: number | null = null;
  private rainStartMs: number | null = null;
  private nextKickMs: number = TUNING.ballKickEveryMs;
  private scored = 0;
  private rainScored = 0;
  private lost = 0;

  constructor(private readonly rules: KruemelRules = KRUEMEL_RULES) {}

  async prepare(ctx: MinigameContext): Promise<void> {
    this.ctx = ctx;
    const { scene } = ctx;
    this.disposables = toyParts(ctx.look);
    const camera = new FreeCamera('kruemel-kamera', new Vector3(0, 13.5, -11.2), scene);
    camera.setTarget(new Vector3(0, -0.6, 0.9));
    camera.fov = 0.82;
    scene.activeCamera = camera;
    this.disposables.push(camera);
    if (ctx.look) {
      ctx.look.backdrop({
        halfX: TUNING.halfX + 1.6,
        halfZ: TUNING.halfZ + 1.6,
        groundY: -TUNING.floorThickness - 0.2,
        surface: 'decke',
      });
    } else {
      buildPlainStage(scene, this.disposables);
    }
    // Aufbau in Schritten, `pace` verteilt ihn auf mehrere Bilder (CHAOS-141).
    await ctx.pace();
    buildLegs(scene, this.disposables);
    await ctx.pace();

    const count = ctx.players.length;
    this.corners = cornersFor(count);
    this.area = dropAreaFor(count);
    const materials = boardMaterials(scene, this.disposables);
    await ctx.pace();
    await this.buildBoard(count, materials);

    // Startkrümel liegen schon auf dem Blech (nicht direkt vor einer Figur), alle anderen
    // warten geparkt. Körper entstehen gleich am richtigen Ort: In `prepare` versetzte Körper
    // übernähme Havok nicht, weil vor dem ersten `update` kein Physikschritt läuft.
    const spawns = this.corners.map(spawnFor);
    let index = 0;
    const add = (kind: Crumb['kind']) => {
      const start =
        kind === 'crumb'
          ? dropPoint(
              ctx.rng,
              [
                ...spawns,
                ...this.crumbs
                  .filter((c) => c.active)
                  .map((c) => ({ x: c.hitbox.position.x, z: c.hitbox.position.z })),
              ],
              this.area,
            )
          : null;
      this.crumbs.push(this.createCrumb(index, kind, materials, start));
      index++;
    };
    const kinds: Crumb['kind'][] = [
      ...Array<Crumb['kind']>(this.rules.crumbs).fill('crumb'),
      ...(this.rules.goldEveryMs !== null ? (['gold'] as const) : []),
      ...Array<Crumb['kind']>(this.rules.rainMs !== null ? this.rules.rainCrumbs : 0).fill('rain'),
    ];
    for (const kind of kinds) {
      await ctx.pace();
      add(kind);
    }

    if (this.rules.ball) {
      await ctx.pace();
      const hitbox = CreateSphere(
        'kruemel-wolle',
        { diameter: TUNING.ballRadius * 2, segments: 14 },
        scene,
      );
      hitbox.position.set(0, TUNING.ballRadius + 0.02, 0);
      markVisual(hitbox, 'wollknaeuel');
      hitbox.material = materials.wool;
      buildWoolStripes(scene, hitbox, this.disposables, materials.dark);
      const aggregate = new PhysicsAggregate(
        hitbox,
        PhysicsShapeType.SPHERE,
        { mass: TUNING.ballMass, friction: 0.4, restitution: 0.5 },
        scene,
      );
      aggregate.body.setLinearDamping(0.3);
      this.ball = { hitbox, aggregate };
    }

    for (const [playerIndex, player] of ctx.players.entries()) {
      const corner = this.corners[playerIndex];
      if (!corner) continue;
      await ctx.pace();
      this.pawns.push(this.createPawn(player, corner));
    }

    if (this.rules.goldEveryMs !== null) this.nextGoldAtMs = this.rules.goldEveryMs;
    this.syncVisuals(0);
  }

  /** Boden, Rand, Schrägen und Stürze (sichtbar und zugleich statische Körper). */
  /** In Schritten (je Ecke ein Mausloch): ohne JIT kostete das Blech am Stück über 6 ms (CHAOS-209). */
  private async buildBoard(
    players: number,
    materials: ReturnType<typeof boardMaterials>,
  ): Promise<void> {
    const ctx = this.requireCtx();
    const scene = ctx.scene;
    const { halfX, halfZ, cut, wallHeight, wallThickness: wt } = TUNING;
    const floor = plank(
      scene,
      'kruemel-blech',
      { width: halfX * 2 + wt * 2, height: TUNING.floorThickness, depth: halfZ * 2 + wt * 2 },
      this.disposables,
    );
    floor.position.y = -TUNING.floorThickness / 2;
    floor.material = materials.tray;
    // Reihenfolge wichtig: `dispose()` räumt rückwärts ab (erst Körper, dann Mesh).
    this.disposables.push(
      new PhysicsAggregate(
        floor,
        PhysicsShapeType.BOX,
        { mass: 0, friction: 0.5, restitution: 0.35 },
        scene,
      ),
    );

    // Rand: sichtbares Brett bis `wallHeight` (bzw. Sturz bis `lintelTop`), dahinter eine
    // unsichtbare Kollisionswand bis `colliderTop`. Sonst klettert eine Figur, die auf einem
    // Krümel steht und gerempelt wird, über den Rand.
    const wall = (
      name: string,
      center: Vec2,
      yaw: number,
      length: number,
      bottom: number,
      top: number,
      material: Mesh['material'] = materials.rim,
    ) => {
      const visible = plank(
        scene,
        name,
        { width: length, height: top - bottom, depth: wt },
        this.disposables,
      );
      visible.position.set(center.x, (top + bottom) / 2, center.z);
      visible.rotation.y = yaw;
      visible.material = material;
      const collider = plank(
        scene,
        `${name}-hitbox`,
        { width: length, height: TUNING.colliderTop - bottom, depth: wt },
        this.disposables,
      );
      collider.isVisible = false;
      collider.position.set(center.x, (TUNING.colliderTop + bottom) / 2, center.z);
      collider.rotation.y = yaw;
      this.disposables.push(
        new PhysicsAggregate(
          collider,
          PhysicsShapeType.BOX,
          { mass: 0, friction: 0.2, restitution: 0.35 },
          scene,
        ),
      );
    };
    const longLength = (halfX - cut) * 2 + 0.2;
    const shortLength = (halfZ - cut) * 2 + 0.2;
    wall(`kruemel-rand-z-1`, { x: 0, z: -(halfZ + wt / 2) }, 0, longLength, 0, wallHeight);
    const back = this.corners.findIndex((hole) => hole.sx === 0);
    const backPlayer = back >= 0 ? this.requireCtx().players[back] : undefined;
    const backHoleCorner = this.corners[back];
    if (hasBackHole(players) && backPlayer && backHoleCorner) {
      // Drei Personen: Kerbe in der hinteren Wand (gespiegelte Ecke), Öffnung an der Spitze.
      const depth = TUNING.cut;
      const notchHalf = MOUTH_WIDTH / 2 + depth;
      const z = halfZ + wt / 2;
      const piece = longLength / 2 - notchHalf + 0.15;
      for (const side of [-1, 1] as const)
        wall(
          `kruemel-rand-z1-${side}`,
          { x: side * (notchHalf + piece / 2 - 0.15), z },
          0,
          piece,
          0,
          wallHeight,
        );
      // Boden der Kerbe.
      const notchFloor = plank(
        scene,
        'kruemel-kerbe-boden',
        { width: notchHalf * 2 + wt * 2, height: TUNING.floorThickness, depth: depth + wt * 2 },
        this.disposables,
      );
      notchFloor.position.set(0, -TUNING.floorThickness / 2, halfZ + depth / 2 + wt);
      notchFloor.material = materials.tray;
      this.disposables.push(
        new PhysicsAggregate(
          notchFloor,
          PhysicsShapeType.BOX,
          { mass: 0, friction: 0.5, restitution: 0.35 },
          scene,
        ),
      );
      // Schräge Kerbenwände von der Rückwand zur Öffnung (je 45°).
      const slant = depth * Math.SQRT2 + 0.3;
      for (const side of [-1, 1] as const) {
        const t = { x: -side * Math.SQRT1_2, z: Math.SQRT1_2 };
        const outward = { x: side * Math.SQRT1_2, z: Math.SQRT1_2 };
        const mid = { x: side * (MOUTH_WIDTH / 2 + depth / 2), z: halfZ + depth / 2 };
        wall(
          `kruemel-kerbe-${side}`,
          { x: mid.x + (outward.x * wt) / 2, z: mid.z + (outward.z * wt) / 2 },
          Math.atan2(-t.z, t.x),
          slant,
          0,
          wallHeight,
        );
      }
      await ctx.pace();
      const material = buildMouseHole(
        scene,
        backHoleCorner,
        backPlayer.color,
        backPlayer.symbol,
        `kruemel-loch-${backPlayer.slot}`,
        this.disposables,
      );
      wall(
        'kruemel-sturz-hinten',
        { x: 0, z: backHoleCorner.mouth.z + wt / 2 },
        0,
        MOUTH_WIDTH + 0.35,
        TUNING.lintelBottom,
        TUNING.lintelTop,
        material,
      );
    } else {
      wall(`kruemel-rand-z1`, { x: 0, z: halfZ + wt / 2 }, 0, longLength, 0, wallHeight);
    }
    await ctx.pace();
    for (const sx of [-1, 1] as const)
      wall(
        `kruemel-rand-x${sx}`,
        { x: sx * (halfX + wt / 2), z: 0 },
        Math.PI / 2,
        shortLength,
        0,
        wallHeight,
      );
    const length = cut * Math.SQRT2 + 0.35;
    for (const [cornerIndex, { corner, open }] of allCorners(players).entries()) {
      await ctx.pace();
      const tangent = { x: -corner.normal.z, z: corner.normal.x };
      const holeIndex = this.corners.findIndex(
        (hole) => hole.sx === corner.sx && hole.sz === corner.sz,
      );
      const player = open ? this.requireCtx().players[holeIndex] : undefined;
      // Offenes Loch: Torbogen und Sturz in Slot-Farbe, damit jede Person ihr Ziel sofort sieht.
      const material = player
        ? buildMouseHole(
            scene,
            corner,
            player.color,
            player.symbol,
            `kruemel-loch-${player.slot}`,
            this.disposables,
          )
        : materials.rim;
      wall(
        `kruemel-${open ? 'sturz' : 'schraege'}-${cornerIndex}`,
        {
          x: corner.mouth.x + (corner.normal.x * wt) / 2,
          z: corner.mouth.z + (corner.normal.z * wt) / 2,
        },
        Math.atan2(-tangent.z, tangent.x),
        length,
        open ? TUNING.lintelBottom : 0,
        open ? TUNING.lintelTop : wallHeight,
        material,
      );
    }
  }

  private createCrumb(
    index: number,
    kind: Crumb['kind'],
    materials: ReturnType<typeof boardMaterials>,
    start: Vec2 | null,
  ): Crumb {
    const scene = this.requireCtx().scene;
    const gold = kind === 'gold';
    const radius = gold ? TUNING.goldRadius : TUNING.crumbRadius;
    const hitbox = CreateSphere(
      `kruemel-${index}-hitbox`,
      { diameter: radius * 2, segments: 6 },
      scene,
    );
    hitbox.isVisible = false;
    markVisual(hitbox, gold ? 'goldkruemel' : 'kruemel', index);
    if (start) hitbox.position.set(start.x, radius + 0.02, start.z);
    else hitbox.position.set(300 + index * 3, -50, 0);
    hitbox.rotationQuaternion = Quaternion.Identity();
    buildCrumbVisual(scene, hitbox, index, gold, this.disposables, materials);
    const aggregate = new PhysicsAggregate(
      hitbox,
      PhysicsShapeType.SPHERE,
      { mass: gold ? TUNING.goldMass : TUNING.crumbMass, friction: 0.6, restitution: 0.3 },
      scene,
    );
    aggregate.body.setLinearDamping(0.8);
    aggregate.body.setAngularDamping(1.5);
    if (!start) aggregate.body.setGravityFactor(0);
    return {
      index,
      kind,
      radius,
      hitbox,
      aggregate,
      active: start !== null,
      dropAtMs: null,
      lastToucher: null,
    };
  }

  private createPawn(player: MinigamePlayer, corner: Corner): Pawn {
    const ctx = this.requireCtx();
    const scene = ctx.scene;
    const start = spawnFor(corner);
    const hitbox = CreateCapsule(
      `kruemel-figur-${player.slot}-hitbox`,
      { height: PAWN.height, radius: PAWN.radius },
      scene,
    );
    hitbox.isVisible = false;
    hitbox.position.set(start.x, HALF_HEIGHT + 0.02, start.z);
    hitbox.rotationQuaternion = Quaternion.Identity();
    const aggregate = new PhysicsAggregate(
      hitbox,
      PhysicsShapeType.CAPSULE,
      { mass: PAWN.mass, friction: PAWN.friction, restitution: PAWN.restitution },
      scene,
    );
    aggregate.body.setMotionType(PhysicsMotionType.DYNAMIC);
    aggregate.body.setMassProperties({ mass: PAWN.mass, inertia: Vector3.Zero() });
    aggregate.body.setLinearDamping(0.1);
    const character = ctx.characters.create(scene, player);
    character.root.parent = hitbox;
    character.root.position.set(0, -HALF_HEIGHT, 0);
    character.play('idle');
    const decor = buildPawnDecor(scene, player.slot, player.color, this.disposables);
    decor.ring.parent = hitbox;
    decor.ring.position.y = -HALF_HEIGHT + 0.05;
    decor.pin.parent = hitbox;
    decor.pin.position.y = HALF_HEIGHT + 0.75;
    const yaw = yawFor(-start.x, -start.z);
    return {
      player,
      corner,
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
      score: 0,
      own: 0,
      gifts: 0,
      golds: 0,
      bonks: 0,
      lastScoreMs: Number.NEGATIVE_INFINITY,
      lastValue: 1,
      hitUntilMs: 0,
      animation: 'idle',
    };
  }

  private requireCtx(): MinigameContext {
    if (!this.ctx) throw new Error('Krümel-Kehraus: prepare fehlt');
    return this.ctx;
  }

  start(): void {
    this.running = true;
    this.ctx?.fx.sound('go');
  }

  /** KI-Platz (CHAOS-180): Bot sieht Figuren, Krümel, Löcher und Punkte (`snapshot`). */
  createBot(options: MinigameBotOptions): MinigameBotDriver {
    return createKruemelBot(options, () => (this.running && !this.result ? this.snapshot() : null));
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
      if (this.finished) this.syncVisuals(dt);
      return;
    }
    this.elapsedMs += dt * 1000;
    const now = this.elapsedMs;

    this.spawnSpecials(now);
    this.kickBall(now);
    for (const pawn of this.pawns) {
      const y = pawn.hitbox.position.y;
      if (y < TUNING.killY) {
        // Notfall (sollte nie passieren): zurück an den Start.
        this.lost++;
        const start = spawnFor(pawn.corner);
        this.teleport(pawn.aggregate, new Vector3(start.x, HALF_HEIGHT + 0.5, start.z));
        continue;
      }
      this.steer(pawn, y < HALF_HEIGHT + 0.4);
    }
    this.checkBonks();
    this.updateCrumbs(now);
    for (const pawn of this.pawns) clampSpeed(pawn.aggregate, PAWN.speedLimit);
    this.syncVisuals(dt);
    if (now >= ctx.timeLimitMs) this.finish();
  }

  private spawnSpecials(now: number): void {
    const ctx = this.requireCtx();
    const gold = this.crumbs.find((crumb) => crumb.kind === 'gold');
    if (gold && !gold.active && this.nextGoldAtMs !== null && now >= this.nextGoldAtMs) {
      this.nextGoldAtMs = null;
      this.goldSinceMs = now;
      this.drop(gold, TUNING.dropHeight, true);
      ctx.fx.sound('pop', { pitch: 1.4 });
    }
    if (
      this.rainStartMs === null &&
      this.rules.rainMs !== null &&
      now >= ctx.timeLimitMs - this.rules.rainMs
    ) {
      this.rainStartMs = now;
      const rain = this.crumbs.filter((crumb) => crumb.kind === 'rain');
      const points = rainPoints(ctx.rng, rain.length, { x: this.area.cx, z: this.area.cz });
      rain.forEach((crumb, index) => {
        const p = points[index] ?? { x: 0, z: 0 };
        this.place(crumb, new Vector3(p.x, TUNING.dropHeight + index * 0.25, p.z));
      });
      ctx.fx.sound('whoosh', { volume: 0.8, pitch: 0.8 });
      ctx.fx.burst('dust', { x: 0, y: 2.5, z: 0 }, '#c98a3f');
      ctx.fx.shake(0.35);
    }
  }

  private kickBall(now: number): void {
    if (!this.ball || now < this.nextKickMs) return;
    const ctx = this.requireCtx();
    this.nextKickMs += TUNING.ballKickEveryMs;
    const angle = ctx.rng.next() * Math.PI * 2;
    const speed = TUNING.ballKickSpeed * TUNING.ballMass;
    tmpImpulse.set(Math.cos(angle) * speed, 1, Math.sin(angle) * speed);
    this.ball.aggregate.body.applyImpulse(tmpImpulse, this.ball.hitbox.position);
    ctx.fx.sound('bump', { volume: 0.5, pitch: 0.7 });
  }

  private updateCrumbs(now: number): void {
    for (const crumb of this.crumbs) {
      if (!crumb.active) {
        if (crumb.dropAtMs !== null && now >= crumb.dropAtMs)
          this.drop(crumb, TUNING.dropHeight, true);
        continue;
      }
      clampSpeed(crumb.aggregate, TUNING.crumbSpeedLimit);
      crumb.aggregate.body.getLinearVelocityToRef(tmpVelocity);
      if (tmpVelocity.y > TUNING.crumbMaxRise) {
        tmpVelocity.y = TUNING.crumbMaxRise;
        crumb.aggregate.body.setLinearVelocity(tmpVelocity);
      }
      const p = crumb.hitbox.position;
      for (const pawn of this.pawns) {
        const h = pawn.hitbox.position;
        if (
          Math.abs(h.y - p.y) < HALF_HEIGHT + crumb.radius &&
          touches(h, p, crumb.radius, PAWN.radius)
        )
          crumb.lastToucher = pawn.player.slot;
      }
      const hole = holeOf(this.corners, p, crumb.radius);
      if (hole !== null) {
        this.score(crumb, hole, now);
        continue;
      }
      const off =
        p.y < TUNING.killY ||
        Math.abs(p.x) > TUNING.halfX + TUNING.cut + 1.5 ||
        Math.abs(p.z) > TUNING.halfZ + TUNING.cut + 1.5;
      if (off) {
        this.lost++;
        this.retire(crumb, now);
      }
    }
  }

  private score(crumb: Crumb, hole: number, now: number): void {
    const ctx = this.requireCtx();
    const owner = this.pawns[hole];
    const value = crumb.kind === 'gold' ? this.rules.goldValue : 1;
    if (owner) {
      owner.score += value;
      owner.lastScoreMs = now;
      owner.lastValue = value;
      if (crumb.kind === 'gold') owner.golds++;
      if (crumb.lastToucher === owner.player.slot) owner.own++;
      else if (crumb.lastToucher !== null) {
        const giver = this.pawns.find((pawn) => pawn.player.slot === crumb.lastToucher);
        if (giver) giver.gifts++;
      }
      const at = owner.corner.mouth;
      ctx.fx.sound(crumb.kind === 'gold' ? 'coin' : 'score', {
        volume: 0.6,
        pitch: 0.9 + owner.player.slot * 0.07,
      });
      ctx.fx.burst(
        crumb.kind === 'gold' ? 'sparkle' : 'dust',
        { x: at.x, y: 0.5, z: at.z },
        owner.player.color,
      );
    }
    this.scored++;
    if (crumb.kind === 'rain') this.rainScored++;
    this.retire(crumb, now);
  }

  /** Krümel vom Blech nehmen; normale fallen nach kurzer Pause neu herein, Gold später. */
  private retire(crumb: Crumb, now: number): void {
    this.park(crumb);
    if (crumb.kind === 'crumb') crumb.dropAtMs = now + TUNING.respawnMs;
    else if (crumb.kind === 'gold' && this.rules.goldEveryMs !== null)
      this.nextGoldAtMs = now + this.rules.goldEveryMs;
  }

  private park(crumb: Crumb): void {
    crumb.active = false;
    crumb.dropAtMs = null;
    crumb.lastToucher = null;
    crumb.aggregate.body.setGravityFactor(0);
    this.teleport(crumb.aggregate, new Vector3(300 + crumb.index * 3, -50, 0));
  }

  private drop(crumb: Crumb, height: number, announce: boolean): void {
    const ctx = this.requireCtx();
    const avoid = this.pawns.map((pawn) => ({
      x: pawn.hitbox.position.x,
      z: pawn.hitbox.position.z,
    }));
    const p = dropPoint(ctx.rng, avoid, this.area);
    this.place(crumb, new Vector3(p.x, height, p.z));
    if (announce) ctx.fx.sound('pop', { volume: 0.35, pitch: 1.1 });
  }

  private place(crumb: Crumb, position: Vector3): void {
    crumb.active = true;
    crumb.dropAtMs = null;
    crumb.lastToucher = null;
    crumb.aggregate.body.setGravityFactor(1);
    this.teleport(crumb.aggregate, position);
  }

  private steer(pawn: Pawn, grounded: boolean): void {
    const body = pawn.aggregate.body;
    const ctx = this.requireCtx();
    body.getLinearVelocityToRef(tmpVelocity);
    const center = pawn.hitbox.position;
    const length = Math.hypot(pawn.stick.x, pawn.stick.y);
    if (length > 0.1) pawn.facing = { x: pawn.stick.x / length, z: pawn.stick.y / length };
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
    for (const attacker of this.pawns) {
      if (this.elapsedMs - attacker.lastDashMs > PAWN.dashHitMs) continue;
      for (const victim of this.pawns) {
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
        const push = PAWN.bonkSpeed * PAWN.mass;
        tmpImpulse.set(nx * push, PAWN.bonkLift * PAWN.mass, nz * push);
        victim.aggregate.body.applyImpulse(tmpImpulse, v);
        victim.hitUntilMs = this.elapsedMs + 500;
        attacker.bonks++;
        ctx.fx.sound('bump', { pitch: 0.9 + ctx.rng.next() * 0.3 });
        ctx.fx.burst('impact', {
          x: (a.x + v.x) / 2,
          y: (a.y + v.y) / 2 + 0.3,
          z: (a.z + v.z) / 2,
        });
        ctx.fx.shake(0.2);
      }
    }
  }

  private teleport(aggregate: PhysicsAggregate, position: Vector3): void {
    aggregate.transformNode.position.copyFrom(position);
    aggregate.body.disablePreStep = false;
    aggregate.body.setLinearVelocity(Vector3.Zero());
    aggregate.body.setAngularVelocity(Vector3.Zero());
    this.teleported.push(aggregate);
  }

  private scores(): { slot: Slot; score: number }[] {
    return this.pawns.map((pawn) => ({ slot: pawn.player.slot, score: pawn.score }));
  }

  private play(pawn: Pawn, animation: CharacterAnimation): void {
    if (pawn.animation === animation) return;
    pawn.animation = animation;
    pawn.character.play(animation);
  }

  private syncVisuals(dt: number): void {
    const time = this.elapsedMs / 1000;
    const leader = leaderOf(this.scores());
    for (const pawn of this.pawns) {
      if (!this.finished && Math.hypot(pawn.stick.x, pawn.stick.y) > 0.1) {
        pawn.yaw = approachAngle(pawn.yaw, yawFor(pawn.stick.x, pawn.stick.y), TURN_SPEED * dt);
      }
      pawn.character.root.rotation.y = pawn.yaw;
      pawn.decor.pin.position.y = HALF_HEIGHT + (pawn.player.slot === leader ? 1.15 : 0.75);
      pawn.decor.pin.rotation.y = time * 2;
      if (this.finished) continue;
      if (this.elapsedMs < pawn.hitUntilMs) this.play(pawn, 'hit');
      else if (this.elapsedMs - pawn.lastScoreMs < 600) this.play(pawn, 'cheer');
      else {
        pawn.aggregate.body.getLinearVelocityToRef(tmpVelocity);
        this.play(pawn, Math.hypot(tmpVelocity.x, tmpVelocity.z) > 1.2 ? 'run' : 'idle');
      }
    }
  }

  private finish(): void {
    const ctx = this.requireCtx();
    this.running = false;
    this.finished = true;
    for (const pawn of this.pawns) {
      pawn.stick = { x: 0, y: 0 };
      pawn.dashQueued = false;
    }
    const placements = rankByScore(this.scores(), KRUEMEL_KEHRAUS_INFO.scoring);
    for (const placement of placements) {
      const pawn = this.pawns.find((entry) => entry.player.slot === placement.slot);
      if (!pawn) continue;
      pawn.animation = placement.place === 1 ? 'cheer' : 'sad';
      pawn.character.play(pawn.animation);
    }
    ctx.fx.sound('win');
    ctx.fx.burst('confetti', { x: 0, y: 3, z: 0 });
    const highlights = buildHighlights(
      this.pawns.map((pawn) => ({
        slot: pawn.player.slot,
        name: pawn.player.name,
        score: pawn.score,
        own: pawn.own,
        gifts: pawn.gifts,
        golds: pawn.golds,
        bonks: pawn.bonks,
      })),
      this.rainScored,
    );
    this.result = {
      minigameId: KRUEMEL_KEHRAUS_INFO.id,
      placements,
      ...(highlights.length > 0 ? { highlights } : {}),
    };
  }

  getResult(): MinigameResult | null {
    return this.result;
  }

  getHud(): MinigameHud {
    const limit = this.ctx?.timeLimitMs ?? KRUEMEL_KEHRAUS_INFO.durationMs;
    const banner = this.finished
      ? undefined
      : bannerFor({
          elapsedMs: this.elapsedMs,
          limitMs: limit,
          rainStartMs: this.rainStartMs,
          goldSinceMs: this.goldSinceMs,
        });
    return {
      remainingMs: Math.max(0, Math.round(limit - this.elapsedMs)),
      scores: this.pawns.map((pawn) => {
        const status = statusFor({
          lastValue: pawn.lastValue,
          recent: !this.finished && this.elapsedMs - pawn.lastScoreMs < STATUS_MS,
        });
        const entry = { slot: pawn.player.slot, score: pawn.score };
        return status ? { ...entry, status } : entry;
      }),
      ...(banner ? { banner } : {}),
    };
  }

  /** Beobachtung für Tests und Bots. */
  snapshot(): KruemelSnapshot {
    const velocity = (aggregate: PhysicsAggregate) => {
      aggregate.body.getLinearVelocityToRef(tmpVelocity);
      return { vx: tmpVelocity.x, vy: tmpVelocity.y, vz: tmpVelocity.z };
    };
    const ballPosition = this.ball?.hitbox.position;
    return {
      elapsedMs: this.elapsedMs,
      limitMs: this.ctx?.timeLimitMs ?? KRUEMEL_KEHRAUS_INFO.durationMs,
      pawns: this.pawns.map((pawn) => {
        const p = pawn.hitbox.position;
        return {
          slot: pawn.player.slot,
          x: p.x,
          y: p.y,
          z: p.z,
          ...velocity(pawn.aggregate),
          canDash: this.elapsedMs - pawn.lastDashMs >= PAWN.dashCooldownMs,
        };
      }),
      crumbs: this.crumbs.map((crumb) => {
        const p = crumb.hitbox.position;
        return {
          index: crumb.index,
          x: p.x,
          y: p.y,
          z: p.z,
          ...velocity(crumb.aggregate),
          active: crumb.active,
          value: crumb.kind === 'gold' ? this.rules.goldValue : 1,
          radius: crumb.radius,
        };
      }),
      goals: this.pawns.map((pawn) => ({ slot: pawn.player.slot, corner: pawn.corner })),
      ball: ballPosition ? { x: ballPosition.x, y: ballPosition.y, z: ballPosition.z } : null,
      scores: this.scores(),
      leader: leaderOf(this.scores()),
      rain: this.rainStartMs !== null,
      counters: {
        scored: this.scored,
        gifts: this.pawns.reduce((sum, pawn) => sum + pawn.gifts, 0),
        golds: this.pawns.reduce((sum, pawn) => sum + pawn.golds, 0),
        bonks: this.pawns.reduce((sum, pawn) => sum + pawn.bonks, 0),
        rainScored: this.rainScored,
        lost: this.lost,
      },
    };
  }

  dispose(): void {
    for (const pawn of this.pawns) {
      pawn.character.dispose();
      pawn.aggregate.dispose();
      pawn.hitbox.dispose(true);
    }
    this.pawns.length = 0;
    for (const crumb of this.crumbs) {
      crumb.aggregate.dispose();
      crumb.hitbox.dispose(true);
    }
    this.crumbs.length = 0;
    if (this.ball) {
      this.ball.aggregate.dispose();
      this.ball.hitbox.dispose(true);
      this.ball = null;
    }
    for (const item of this.disposables.splice(0).reverse()) item.dispose();
    this.teleported.length = 0;
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

export const kruemelKehraus: MinigameModule = {
  info: KRUEMEL_KEHRAUS_INFO,
  create: () => new KruemelKehraus(),
};
