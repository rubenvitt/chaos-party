/**
 * Kuckucks-Klatsche – Arcade-Minispiel nur mit Knopf A (CHAOS-54, EXP-016). Babylon-Ansicht
 * über der reinen Logik aus `logic.ts`: ein Kuckuckshaus mit einer runden Tür je Person in
 * der Slot-Farbe (Symbol am Türsturz), Zifferblatt und Giebeldach darüber. Die Figuren stehen
 * neben ihrer Tür und halten eine Fliegenklatsche; beim Klauen fliegt die Klatsche wie ein
 * Bumerang zur fremden Tür.
 *
 * Alles wird in `prepare` in `ctx.scene` angelegt und in `dispose` entfernt; Zeit nur über
 * `update`, Zufall nur über `ctx.rng` (in der Logik).
 */
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera.js';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight.js';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight.js';
import type { Material } from '@babylonjs/core/Materials/material.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder.js';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder.js';
import { CreateDisc } from '@babylonjs/core/Meshes/Builders/discBuilder.js';
import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder.js';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder.js';
import { CreateTorus } from '@babylonjs/core/Meshes/Builders/torusBuilder.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import type { Scene } from '@babylonjs/core/scene.js';
import { symbolMesh } from '@chaos-party/minigame-kit/babylon';
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
  LookFinish,
  Minigame,
  MinigameContext,
  MinigameHud,
  MinigameModule,
  MinigamePlayer,
} from '@chaos-party/minigame-sdk/babylon';
import { markVisual } from '@chaos-party/minigame-sdk/babylon';
import { createKuckuckBot } from './bot.ts';
import { kuckucksKlatscheHighlights } from './highlights.ts';
import { KUCKUCKS_KLATSCHE_INFO } from './info.ts';
import { FINTE_KINDS, KuckucksKlatscheLogic, type FinteKind, type KuckuckEvent } from './logic.ts';

const PALETTE = {
  wood: '#b0703c',
  woodLight: '#d39a5e',
  woodDark: '#6e3f22',
  roof: '#9a3540',
  roofEdge: '#f4e1c1',
  face: '#fff4dc',
  ink: '#2b2d42',
  hole: '#2a1a12',
  stage: '#d9a066',
  stageEdge: '#a8693a',
  grass: '#8fcf6b',
  bird: '#8f5530',
  birdDark: '#5e3720',
  belly: '#f3dcb5',
  beak: '#ff9f1c',
  white: '#ffffff',
  gold: '#ffc61a',
  duck: '#ffd43b',
  duckBill: '#ff8c1a',
  sock: '#ff5c5c',
  stem: '#3f9b4b',
  petal: '#ff7eb6',
  bloom: '#ffe066',
  star: '#ffe14d',
  handle: '#7a5230',
} as const;

/** Abstand der Türen und Maße des Hauses (Einheiten ≈ Meter). */
const DOOR_SPACING = 2.6;
const DOOR_RADIUS = 0.58;
const DOOR_Y = 2.0;
const HOUSE_Z = 2.4;
const HOUSE_DEPTH = 1.8;
const FRONT_Z = HOUSE_Z - HOUSE_DEPTH / 2;
/** So weit springt der Bewohner aus der Tür (vor die Front). */
const OUT_DISTANCE = 0.95;
/** Figur steht rechts neben ihrer Tür, etwas vor dem Haus. */
const CHARACTER_DX = 1.02;
const CHARACTER_Z = 0.35;

type OccupantKind = 'kuckuck' | FinteKind;

interface DoorView {
  readonly slot: Slot;
  readonly x: number;
  readonly hinge: TransformNode;
  readonly glow: Mesh;
  readonly perch: TransformNode;
  readonly occupants: ReadonlyMap<OccupantKind, TransformNode>;
  active: OccupantKind | null;
  /** 0 = zu, 1 = offen (geglättet). */
  open: number;
  /** 0 = drinnen, 1 = draußen (geglättet). */
  out: number;
  /** Plattgeklatscht (1 → 0). */
  squash: number;
  /** Getroffene Finte wackelt (1 → 0). */
  wobble: number;
}

interface ClapperView {
  readonly slot: Slot;
  readonly player: MinigamePlayer;
  readonly character: CharacterHandle;
  readonly home: Vector3;
  readonly swatter: TransformNode;
  readonly stars: TransformNode;
  anim: CharacterAnimation | null;
  /** Ausholen und Zuschlagen (1 → 0). */
  swing: number;
  /** Bumerang-Wurf zur fremden Tür: Startzeit und Ziel. */
  throwAt: number | null;
  throwTo: Vector3 | null;
  /** Kurzes Hüpfen nach Punkten (1 → 0). */
  hop: number;
}

/** Bewohner etwas größer als die Tür, damit man sie am Fernseher erkennt. */
const OCCUPANT_SCALE = 1.2;
/** Dauer des Bumerang-Wurfs (Anzeige). */
const THROW_S = 0.5;

export class KuckucksKlatsche implements Minigame {
  private ctx: MinigameContext | null = null;
  private logic: KuckucksKlatscheLogic | null = null;
  private running = false;
  private result: MinigameResult | null = null;
  private visualTime = 0;
  private readonly disposables: { dispose(): void }[] = [];
  private readonly materials = new Map<string, Material>();
  private readonly doors = new Map<Slot, DoorView>();
  private readonly clappers = new Map<Slot, ClapperView>();
  private house: TransformNode | null = null;
  private minuteHand: TransformNode | null = null;
  private hourHand: TransformNode | null = null;
  private clapCount = 0;
  private readonly winners = new Set<Slot>();

  /** Regelzustand zum Lesen (Tests, Vorschau-Bots). Nicht ändern. */
  get rules(): Readonly<KuckucksKlatscheLogic> | null {
    return this.logic;
  }

  async prepare(ctx: MinigameContext): Promise<void> {
    this.ctx = ctx;
    const slots = ctx.players.map((player) => player.slot);
    this.logic = new KuckucksKlatscheLogic(slots, ctx.rng, ctx.timeLimitMs);
    const { scene } = ctx;
    const count = Math.max(2, ctx.players.length);
    const width = count * DOOR_SPACING + 1.4;
    const camera = new ArcRotateCamera(
      'kuckuck-kamera',
      -Math.PI / 2,
      1.2,
      9.4 + width * 0.62,
      new Vector3(0, 2.75, 1.2),
      scene,
    );
    camera.fov = 0.72;
    scene.activeCamera = camera;
    this.track(camera);
    if (ctx.look) {
      // Natur-Look (CHAOS-62): Wiese, Licht und Himmel vom Host; frei bleiben Haus und Bühne.
      ctx.look.backdrop({ halfX: width / 2 + 1.8, halfZ: 4.2, groundY: -0.02 });
    } else {
      const hemi = new HemisphericLight('kuckuck-licht', new Vector3(0.2, 1, -0.4), scene);
      hemi.intensity = 0.65;
      hemi.groundColor = new Color3(0.45, 0.42, 0.5);
      const sun = new DirectionalLight('kuckuck-sonne', new Vector3(-0.3, -1, 0.5), scene);
      sun.intensity = 0.5;
      this.track(hemi);
      this.track(sun);
      const ground = this.track(CreateGround('kuckuck-wiese', { width: 60, height: 40 }, scene));
      ground.position.set(0, -0.02, 6);
      ground.material = this.material(PALETTE.grass);
    }
    // Aufbau in Schritten, `pace` verteilt ihn auf mehrere Bilder (CHAOS-141).
    await ctx.pace();
    await this.buildHouse(scene, width);
    await ctx.pace();
    this.buildStage(scene, width);
    for (const [index, player] of ctx.players.entries()) {
      const x = (index - (ctx.players.length - 1) / 2) * DOOR_SPACING;
      await this.buildDoor(scene, player, x);
      await this.buildClapper(scene, player, x);
    }
    this.animate(0);
  }

  start(): void {
    this.running = true;
    this.ctx?.fx.sound('go');
  }

  /** KI-Platz (CHAOS-180): Bot sieht nur die Türen, wie am Bildschirm. */
  createBot(options: MinigameBotOptions): MinigameBotDriver {
    return createKuckuckBot(options, () => this.logic);
  }

  handleInput(slot: Slot, input: MinigameInput): void {
    const logic = this.logic;
    if (!this.running || !logic) return;
    if (input.type !== 'press' || input.button !== 'a') return;
    const view = this.clappers.get(slot);
    if (view && !logic.isDizzy(slot)) view.swing = 1;
    logic.press(slot);
    for (const event of logic.drainEvents()) this.onEvent(event);
  }

  update(dtSeconds: number): void {
    const { ctx, logic } = this;
    if (!ctx || !logic) return;
    this.visualTime += dtSeconds;
    if (this.running) {
      logic.step(dtSeconds);
      for (const event of logic.drainEvents()) this.onEvent(event);
      if (logic.ended) this.finish();
    }
    this.animate(dtSeconds);
  }

  getResult(): MinigameResult | null {
    return this.result;
  }

  getHud(): MinigameHud {
    const logic = this.logic;
    if (!logic) return { remainingMs: KUCKUCKS_KLATSCHE_INFO.durationMs, scores: [] };
    const banner = this.result
      ? undefined
      : logic.finale
        ? 'Mitternacht!'
        : logic.t < 1.5
          ? 'Klatsch deinen Kuckuck!'
          : undefined;
    return {
      remainingMs: Math.max(0, Math.round(logic.remainingS * 1000)),
      scores: logic.clappers.map((clapper) => ({
        slot: clapper.slot,
        score: clapper.score,
        ...(logic.isDizzy(clapper.slot) && !this.result ? { status: 'benommen' } : {}),
      })),
      ...(banner ? { banner } : {}),
    };
  }

  dispose(): void {
    for (const view of this.clappers.values()) view.character.dispose();
    this.clappers.clear();
    this.doors.clear();
    this.house = null;
    this.minuteHand = null;
    this.hourHand = null;
    // Rückwärts: Kinder vor ihren Eltern entsorgen.
    for (const item of this.disposables.splice(0).reverse()) item.dispose();
    for (const material of this.materials.values()) material.dispose();
    this.materials.clear();
    this.winners.clear();
    this.running = false;
  }

  // ---------------------------------------------------------------------------
  // Spielablauf
  // ---------------------------------------------------------------------------

  private onEvent(event: KuckuckEvent): void {
    const ctx = this.ctx;
    if (!ctx) return;
    switch (event.type) {
      case 'rattle':
        ctx.fx.sound('tick', { volume: 0.25, pitch: 1.3 });
        return;
      case 'open': {
        const door = this.doors.get(event.door);
        if (door) {
          const kind: OccupantKind = event.occupant === 'kuckuck' ? 'kuckuck' : event.finteKind;
          this.showOccupant(door, kind);
        }
        ctx.fx.sound('pop', { pitch: event.occupant === 'kuckuck' ? 1 : 1.35 });
        return;
      }
      case 'gong':
        ctx.fx.sound('buzz', { volume: 0.45, pitch: 1.5 });
        return;
      case 'clap': {
        const door = this.doors.get(event.by);
        const view = this.clappers.get(event.by);
        if (door) door.squash = 1;
        if (view) view.hop = 1;
        ctx.fx.sound('hit', { volume: 0.7 });
        ctx.fx.sound('coin', { pitch: 0.95 + (this.clapCount++ % 5) * 0.05 });
        if (door) ctx.fx.burst('stars', this.outPoint(door), view?.player.color);
        return;
      }
      case 'steal': {
        const door = this.doors.get(event.door);
        const view = this.clappers.get(event.by);
        if (door) door.squash = 1;
        if (view && door) {
          view.throwAt = this.visualTime;
          view.throwTo = this.outPoint(door);
          view.hop = 1;
        }
        ctx.fx.sound('whoosh', { volume: 0.7 });
        ctx.fx.sound('score', { volume: 0.8 });
        if (door) ctx.fx.burst('sparkle', this.outPoint(door), view?.player.color);
        return;
      }
      case 'finte': {
        const door = this.doors.get(event.by);
        if (door) door.wobble = 1;
        ctx.fx.sound('lose', { volume: 0.6 });
        ctx.fx.shake(0.15);
        if (door) ctx.fx.burst('smoke', this.outPoint(door));
        return;
      }
      case 'empty': {
        ctx.fx.sound('bump', { volume: 0.4, pitch: 0.8 });
        return;
      }
      case 'escape': {
        const door = this.doors.get(event.door);
        ctx.fx.sound('whoosh', { volume: 0.3, pitch: 0.7 });
        if (door) ctx.fx.burst('dust', this.outPoint(door));
        return;
      }
      case 'finte-gone':
        return;
      case 'finale':
        ctx.fx.sound('buzz');
        ctx.fx.shake(0.25);
        return;
    }
  }

  private finish(): void {
    const { ctx, logic } = this;
    if (!ctx || !logic || this.result) return;
    this.running = false;
    const placements = rankByScore(
      logic.clappers.map((clapper) => ({ slot: clapper.slot, score: clapper.score })),
      KUCKUCKS_KLATSCHE_INFO.scoring,
    );
    for (const placement of placements) {
      const view = this.clappers.get(placement.slot);
      if (!view) continue;
      const animation: CharacterAnimation = placement.place === 1 ? 'cheer' : 'sad';
      view.character.play(animation);
      view.anim = animation;
      if (placement.place === 1) {
        this.winners.add(placement.slot);
        ctx.fx.burst('confetti', { x: view.home.x, y: 2.2, z: view.home.z }, view.player.color);
      }
    }
    ctx.fx.sound('win');
    const names = new Map(ctx.players.map((player) => [player.slot, player.name]));
    const highlights = kuckucksKlatscheHighlights(logic, names);
    this.result = {
      minigameId: KUCKUCKS_KLATSCHE_INFO.id,
      placements,
      ...(highlights.length > 0 ? { highlights } : {}),
    };
  }

  // ---------------------------------------------------------------------------
  // Anzeige je Schritt
  // ---------------------------------------------------------------------------

  private animate(dt: number): void {
    const logic = this.logic;
    if (!logic) return;
    const t = this.visualTime;
    const ease = (current: number, target: number, rate: number) =>
      current + (target - current) * Math.min(1, dt * rate);

    for (const door of this.doors.values()) {
      const state = logic.door(door.slot);
      const phase = this.result ? 'closed' : (state?.phase ?? 'closed');
      const isOpen = phase === 'own' || phase === 'free' || phase === 'finte';
      door.open = ease(door.open, isOpen ? 1 : 0, isOpen ? 22 : 9);
      door.out = ease(door.out, isOpen ? 1 : 0, isOpen ? 18 : 10);
      door.squash = Math.max(0, door.squash - dt * 2.2);
      door.wobble = Math.max(0, door.wobble - dt * 2.5);
      const rattle = phase === 'rattle' ? Math.sin(t * 55) * 0.16 : 0;
      door.hinge.rotation.y = -door.open * 1.85 + rattle;
      door.perch.position.z = FRONT_Z + 0.25 - door.out * OUT_DISTANCE;
      const bob = isOpen ? Math.sin(t * 9) * 0.04 : 0;
      door.perch.position.y = DOOR_Y - 0.1 + bob;
      const flat = door.squash;
      door.perch.scaling.set(
        OCCUPANT_SCALE * (1 + flat * 0.45),
        OCCUPANT_SCALE * (1 - flat * 0.65),
        OCCUPANT_SCALE * (1 + flat * 0.3),
      );
      door.perch.rotation.z = Math.sin(t * 30) * 0.35 * door.wobble;
      door.perch.setEnabled(door.out > 0.04 && door.active !== null);
      // Leuchtring: Slot-Farbe im eigenen Fenster, Weiß nach dem Gong (Gold war an der
      // orangen Tür kaum vom eigenen Fenster zu unterscheiden).
      const glowing = phase === 'own' || phase === 'free';
      door.glow.setEnabled(glowing);
      if (glowing) {
        const fast = phase === 'free';
        door.glow.material = this.material(fast ? PALETTE.white : this.slotColor(door.slot), {
          emissive: 0.9,
        });
        const pulse = 1 + Math.sin(t * (fast ? 26 : 12)) * (fast ? 0.09 : 0.05);
        door.glow.scaling.set(pulse, pulse, 1);
      }
    }

    for (const view of this.clappers.values()) this.animateClapper(view, dt);

    // Uhr: Zeiger drehen, zu Mitternacht rasend; das Haus zittert.
    const speed = logic.finale && !this.result ? 9 : 1.2;
    if (this.minuteHand) this.minuteHand.rotation.z -= dt * speed;
    if (this.hourHand) this.hourHand.rotation.z -= (dt * speed) / 12;
    if (this.house) {
      this.house.rotation.z = logic.finale && this.running ? Math.sin(t * 38) * 0.008 : 0;
    }
  }

  private animateClapper(view: ClapperView, dt: number): void {
    const logic = this.logic;
    if (!logic) return;
    const t = this.visualTime;
    view.swing = Math.max(0, view.swing - dt * 4.5);
    view.hop = Math.max(0, view.hop - dt * 3.2);
    const winnerHop = this.winners.has(view.slot) ? Math.abs(Math.sin(t * 6)) * 0.7 : 0;
    const hop = Math.sin(view.hop * Math.PI) * 0.35 + winnerHop;
    const root = view.character.root;
    root.position.set(view.home.x, hop, view.home.z);
    const dizzy = logic.isDizzy(view.slot) && !this.result;
    view.stars.setEnabled(dizzy);
    if (dizzy) {
      view.stars.position.set(view.home.x, 1.85 + hop, view.home.z);
      view.stars.rotation.y += dt * 7;
    }
    // Klatsche: in Ruhe neben dem Kopf, beim Schlag nach vorn zur Tür; beim Klau fliegt sie.
    const rest = new Vector3(view.home.x + 0.4, 1.25 + hop, view.home.z - 0.05);
    const swatter = view.swatter;
    if (view.throwAt !== null && view.throwTo) {
      const progress = (t - view.throwAt) / THROW_S;
      if (progress >= 1) {
        view.throwAt = null;
        view.throwTo = null;
      } else {
        const there = progress < 0.5 ? progress * 2 : (1 - progress) * 2;
        const pos = Vector3.Lerp(rest, view.throwTo, there);
        pos.y += Math.sin(there * Math.PI) * 1.3;
        swatter.position.copyFrom(pos);
        swatter.rotation.set(0, 0, t * 24);
      }
    }
    if (view.throwAt === null) {
      // Ausholen und zur eigenen Tür schlagen.
      const strike = Math.sin(view.swing * Math.PI);
      const door = new Vector3(view.home.x - CHARACTER_DX, DOOR_Y, FRONT_Z - 0.4);
      swatter.position.copyFrom(Vector3.Lerp(rest, door, strike * 0.55));
      swatter.rotation.set(-strike * 0.6, 0, -0.35 + strike * 1.5);
    }
    if (this.result) return;
    const desired: CharacterAnimation = dizzy ? 'hit' : view.swing > 0.4 ? 'jump' : 'idle';
    if (desired !== view.anim) {
      view.character.play(desired);
      view.anim = desired;
    }
  }

  private showOccupant(door: DoorView, kind: OccupantKind): void {
    for (const [key, node] of door.occupants) node.setEnabled(key === kind);
    door.active = kind;
    door.squash = 0;
    door.wobble = 0;
  }

  private outPoint(door: DoorView): Vector3 {
    return new Vector3(door.x, DOOR_Y, FRONT_Z + 0.25 - OUT_DISTANCE);
  }

  private slotColor(slot: Slot): string {
    return this.ctx?.players.find((player) => player.slot === slot)?.color ?? PALETTE.white;
  }

  // ---------------------------------------------------------------------------
  // Aufbau
  // ---------------------------------------------------------------------------

  private material(
    hex: string,
    options: {
      readonly emissive?: number;
      readonly alpha?: number;
      readonly finish?: LookFinish;
    } = {},
  ): Material {
    const key = `${hex}|${String(options.emissive ?? 0)}|${String(options.alpha ?? 1)}|${options.finish ?? ''}`;
    const cached = this.materials.get(key);
    if (cached) return cached;
    const scene = this.ctx?.scene;
    if (!scene) throw new Error('Kuckucks-Klatsche: keine Szene');
    const look = this.ctx?.look;
    if (look) {
      const lookMaterial = look.material(hex, {
        ...(options.emissive !== undefined ? { emissive: options.emissive } : {}),
        ...(options.alpha !== undefined ? { alpha: options.alpha } : {}),
        ...(options.finish !== undefined ? { finish: options.finish } : {}),
      });
      this.materials.set(key, lookMaterial);
      return lookMaterial;
    }
    const material = new StandardMaterial(`kuckuck-material-${String(this.materials.size)}`, scene);
    const color = Color3.FromHexString(hex);
    material.diffuseColor = color;
    material.specularColor = new Color3(0.12, 0.12, 0.12);
    if (options.emissive) material.emissiveColor = color.scale(options.emissive);
    if (options.alpha !== undefined && options.alpha < 1) material.alpha = options.alpha;
    this.materials.set(key, material);
    return material;
  }

  private track<T extends { dispose(): void }>(item: T): T {
    this.disposables.push(item);
    return item;
  }

  private mesh(
    mesh: Mesh,
    hex: string,
    parent: TransformNode | null,
    options: { readonly emissive?: number; readonly finish?: LookFinish } = {},
  ): Mesh {
    this.track(mesh);
    mesh.material = this.material(hex, options);
    if (parent) mesh.parent = parent;
    return mesh;
  }

  /** In Schritten: ohne JIT kostete das Haus am Stück gut 10 ms (CHAOS-209). */
  private async buildHouse(scene: Scene, width: number): Promise<void> {
    const house = this.track(markVisual(new TransformNode('kuckuck-haus', scene), 'kuckucksuhr'));
    house.position.set(0, 0, HOUSE_Z);
    this.house = house;
    const bodyH = 3.75;
    const body = this.mesh(
      CreateBox('kuckuck-haus-koerper', { width, height: bodyH, depth: HOUSE_DEPTH }, scene),
      PALETTE.wood,
      house,
      { finish: 'matt' },
    );
    body.position.y = bodyH / 2;
    // Sockel und Gesims als dunklere Leisten.
    const plinth = this.mesh(
      CreateBox(
        'kuckuck-sockel',
        { width: width + 0.3, height: 0.35, depth: HOUSE_DEPTH + 0.3 },
        scene,
      ),
      PALETTE.woodDark,
      house,
      { finish: 'matt' },
    );
    plinth.position.y = 0.17;
    const ledge = this.mesh(
      CreateBox(
        'kuckuck-gesims',
        { width: width + 0.7, height: 0.22, depth: HOUSE_DEPTH + 0.7 },
        scene,
      ),
      PALETTE.roof,
      house,
    );
    ledge.position.y = bodyH + 0.08;
    // Giebel mit Zifferblatt.
    const gableW = Math.min(width * 0.62, 5.2);
    const gableH = 2.3;
    const gable = this.mesh(
      CreateBox(
        'kuckuck-giebel',
        { width: gableW, height: gableH, depth: HOUSE_DEPTH * 0.8 },
        scene,
      ),
      PALETTE.woodLight,
      house,
      { finish: 'matt' },
    );
    gable.position.y = bodyH + 0.2 + gableH / 2;
    const roofY = bodyH + 0.2 + gableH;
    const slope = 0.55;
    const half = gableW / 2 + 0.55;
    const roofLen = half / Math.cos(slope);
    [-1, 1].forEach((side) => {
      const plank = this.mesh(
        CreateBox(
          `kuckuck-dach-${String(side)}`,
          { width: roofLen, height: 0.18, depth: HOUSE_DEPTH + 0.5 },
          scene,
        ),
        PALETTE.roof,
        house,
      );
      plank.position.set((side * half) / 2, roofY + (Math.tan(slope) * half) / 2 - 0.05, 0);
      plank.rotation.z = -side * slope;
      // Helle Zierkante unter dem Dach.
      const trim = this.mesh(
        CreateBox(
          `kuckuck-dach-kante-${String(side)}`,
          { width: roofLen, height: 0.08, depth: 0.12 },
          scene,
        ),
        PALETTE.roofEdge,
        house,
      );
      trim.position.set(plank.position.x, plank.position.y - 0.13, -HOUSE_DEPTH / 2 - 0.22);
      trim.rotation.z = plank.rotation.z;
    });
    // Giebeldreieck zwischen den Dachbrettern.
    await this.pace();
    const triangle = this.mesh(
      prismMesh(
        scene,
        'kuckuck-giebel-dreieck',
        half * 2,
        Math.tan(slope) * half - 0.1,
        HOUSE_DEPTH * 0.8,
      ),
      PALETTE.woodLight,
      house,
      { finish: 'matt' },
    );
    triangle.position.y = roofY - 0.05;
    // Eigene Geometrie: beide Seiten zeichnen, egal wie die Dreiecke umlaufen.
    if (triangle.material) triangle.material.backFaceCulling = false;
    // Zifferblatt.
    await this.pace();
    const faceY = bodyH + 0.2 + gableH / 2;
    const frontZ = -HOUSE_DEPTH * 0.4;
    const face = this.mesh(
      CreateCylinder(
        'kuckuck-zifferblatt',
        { diameter: 1.7, height: 0.08, tessellation: 40 },
        scene,
      ),
      PALETTE.face,
      house,
      { emissive: 0.15 },
    );
    face.rotation.x = Math.PI / 2;
    face.position.set(0, faceY, frontZ - 0.04);
    await this.pace();
    const rim = this.mesh(
      CreateTorus(
        'kuckuck-zifferblatt-rand',
        { diameter: 1.75, thickness: 0.12, tessellation: 40 },
        scene,
      ),
      PALETTE.woodDark,
      house,
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.set(0, faceY, frontZ - 0.08);
    await this.pace();
    for (let hour = 0; hour < 12; hour++) {
      const a = (hour / 12) * Math.PI * 2;
      const mark = this.mesh(
        CreateBox(
          `kuckuck-strich-${String(hour)}`,
          { width: 0.07, height: hour % 3 === 0 ? 0.22 : 0.12, depth: 0.04 },
          scene,
        ),
        PALETTE.ink,
        house,
      );
      mark.position.set(Math.sin(a) * 0.66, faceY + Math.cos(a) * 0.66, frontZ - 0.1);
      mark.rotation.z = -a;
    }
    await this.pace();
    const hand = (name: string, length: number, thickness: number, z: number) => {
      const pivot = this.track(markVisual(new TransformNode(name, scene), 'zeiger', name));
      pivot.parent = house;
      pivot.position.set(0, faceY, frontZ - z);
      const bar = this.mesh(
        CreateBox(`${name}-stab`, { width: thickness, height: length, depth: 0.03 }, scene),
        PALETTE.ink,
        pivot,
      );
      bar.position.y = length / 2 - 0.08;
      return pivot;
    };
    this.hourHand = hand('kuckuck-stundenzeiger', 0.45, 0.09, 0.13);
    this.minuteHand = hand('kuckuck-minutenzeiger', 0.65, 0.06, 0.16);
    this.hourHand.rotation.z = -2.1;
    const hub = this.mesh(
      CreateSphere('kuckuck-zeiger-nabe', { diameter: 0.14, segments: 8 }, scene),
      PALETTE.gold,
      house,
      { finish: 'metall' },
    );
    hub.position.set(0, faceY, frontZ - 0.18);
    // Tannenzapfen-Gewichte an Ketten links und rechts (Deko).
    await this.pace();
    [-1, 1].forEach((side) => {
      const x = side * (width / 2 + 0.55);
      const chain = this.mesh(
        CreateCylinder(`kuckuck-kette-${String(side)}`, { diameter: 0.05, height: 1.7 }, scene),
        PALETTE.gold,
        house,
        { finish: 'metall' },
      );
      chain.position.set(x, 2.15, -0.2);
      const cone = this.mesh(
        CreateCylinder(
          `kuckuck-zapfen-${String(side)}`,
          { diameterTop: 0.22, diameterBottom: 0.38, height: 0.75, tessellation: 10 },
          scene,
        ),
        PALETTE.woodDark,
        house,
      );
      cone.position.set(x, 0.95, -0.2);
      cone.rotation.x = Math.PI;
    });
  }

  private buildStage(scene: Scene, width: number): void {
    const stage = this.mesh(
      CreateBox('kuckuck-buehne', { width: width + 1.2, height: 0.16, depth: 2.6 }, scene),
      PALETTE.stage,
      null,
      { finish: 'matt' },
    );
    stage.position.set(0, -0.06, CHARACTER_Z - 0.2);
    const edge = this.mesh(
      CreateBox('kuckuck-buehne-kante', { width: width + 1.3, height: 0.2, depth: 0.16 }, scene),
      PALETTE.stageEdge,
      null,
      { finish: 'matt' },
    );
    edge.position.set(0, -0.03, CHARACTER_Z - 1.5);
  }

  /** Bild abgeben, wenn das Aufbau-Budget verbraucht ist (CHAOS-141). */
  private async pace(): Promise<void> {
    await this.ctx?.pace();
  }

  private async buildDoor(scene: Scene, player: MinigamePlayer, x: number): Promise<void> {
    const slot = player.slot;
    await this.pace();
    const name = (part: string) => `kuckuck-tuer-${String(slot)}-${part}`;
    const z = FRONT_Z;
    // Dunkles Loch, Rahmen in Slot-Farbe, Leuchtring.
    const hole = this.mesh(
      CreateCylinder(
        name('loch'),
        { diameter: DOOR_RADIUS * 2, height: 0.3, tessellation: 32 },
        scene,
      ),
      PALETTE.hole,
      null,
      { finish: 'matt' },
    );
    hole.rotation.x = Math.PI / 2;
    hole.position.set(x, DOOR_Y, z + 0.1);
    await this.pace();
    const frame = this.mesh(
      CreateTorus(
        name('rahmen'),
        { diameter: DOOR_RADIUS * 2 + 0.12, thickness: 0.2, tessellation: 32 },
        scene,
      ),
      player.color,
      null,
      { emissive: 0.25 },
    );
    frame.rotation.x = Math.PI / 2;
    frame.position.set(x, DOOR_Y, z - 0.04);
    await this.pace();
    const glow = this.mesh(
      CreateTorus(
        name('leuchten'),
        { diameter: DOOR_RADIUS * 2 + 0.55, thickness: 0.13, tessellation: 32 },
        scene,
      ),
      player.color,
      null,
      { emissive: 0.9 },
    );
    glow.rotation.x = Math.PI / 2;
    glow.position.set(x, DOOR_Y, z - 0.08);
    markVisual(glow, 'tuer-leuchten', slot);
    glow.setEnabled(false);
    // Türflügel am linken Scharnier.
    await this.pace();
    const hinge = this.track(markVisual(new TransformNode(name('scharnier'), scene), 'tuer', slot));
    hinge.position.set(x - DOOR_RADIUS, DOOR_Y, z - 0.08);
    const leaf = this.mesh(
      CreateCylinder(
        name('fluegel'),
        { diameter: DOOR_RADIUS * 2 - 0.06, height: 0.08, tessellation: 32 },
        scene,
      ),
      PALETTE.woodLight,
      hinge,
      { finish: 'matt' },
    );
    leaf.rotation.x = Math.PI / 2;
    leaf.position.x = DOOR_RADIUS;
    await this.pace();
    const knob = this.mesh(
      CreateSphere(name('knauf'), { diameter: 0.12, segments: 8 }, scene),
      PALETTE.gold,
      hinge,
      { finish: 'metall' },
    );
    knob.position.set(DOOR_RADIUS * 1.6, 0, -0.07);
    // Schild mit Slot-Symbol über der Tür (Farbe + Form).
    await this.pace();
    const plate = this.mesh(
      CreateDisc(name('schild'), { radius: 0.3, tessellation: 32 }, scene),
      PALETTE.white,
      null,
      { emissive: 0.5 },
    );
    plate.position.set(x, DOOR_Y + DOOR_RADIUS + 0.48, z - 0.03);
    const symbol = this.mesh(
      symbolMesh(scene, name('symbol'), player.symbol, 0.22),
      player.color,
      null,
      {
        emissive: 0.5,
      },
    );
    symbol.position.set(x, plate.position.y, z - 0.05);
    for (const flat of [plate, symbol]) {
      if (flat.material) flat.material.backFaceCulling = false;
    }
    // Bewohner auf einer Feder: Kuckuck und drei Finten, je einer sichtbar.
    await this.pace();
    const perch = this.track(markVisual(new TransformNode(name('feder'), scene), 'feder', slot));
    perch.position.set(x, DOOR_Y - 0.1, z + 0.25);

    const spring = this.mesh(
      CreateCylinder(name('federstab'), { diameter: 0.07, height: 1.0 }, scene),
      PALETTE.gold,
      perch,
      { finish: 'metall' },
    );
    spring.rotation.x = Math.PI / 2;
    spring.position.set(0, -0.12, 0.55);
    const occupants = new Map<OccupantKind, TransformNode>();
    await this.pace();
    occupants.set(
      'kuckuck',
      markVisual(await this.buildCuckoo(scene, perch, name('kuckuck')), 'kuckuck', slot),
    );
    for (const kind of FINTE_KINDS) {
      await this.pace();
      occupants.set(
        kind,
        markVisual(await this.buildFinte(scene, perch, name(kind), kind), `finte-${kind}`, slot),
      );
    }
    for (const node of occupants.values()) node.setEnabled(false);
    perch.setEnabled(false);
    this.doors.set(slot, {
      slot,
      x,
      hinge,
      glow,
      perch,
      occupants,
      active: null,
      open: 0,
      out: 0,
      squash: 0,
      wobble: 0,
    });
  }

  private async buildCuckoo(
    scene: Scene,
    parent: TransformNode,
    name: string,
  ): Promise<TransformNode> {
    const root = this.track(new TransformNode(name, scene));
    root.parent = parent;
    const body = this.mesh(
      CreateSphere(`${name}-koerper`, { diameter: 0.56, segments: 12 }, scene),
      PALETTE.bird,
      root,
      { finish: 'stoff' },
    );
    body.scaling.set(1, 0.92, 1.15);
    await this.pace();
    const belly = this.mesh(
      CreateSphere(`${name}-bauch`, { diameter: 0.4, segments: 10 }, scene),
      PALETTE.belly,
      root,
      { finish: 'stoff' },
    );
    belly.position.set(0, -0.05, -0.17);
    await this.pace();
    const head = this.mesh(
      CreateSphere(`${name}-kopf`, { diameter: 0.4, segments: 12 }, scene),
      PALETTE.bird,
      root,
      { finish: 'stoff' },
    );
    head.position.set(0, 0.34, -0.12);
    const beak = this.mesh(
      CreateCylinder(
        `${name}-schnabel`,
        { diameterTop: 0, diameterBottom: 0.14, height: 0.26, tessellation: 8 },
        scene,
      ),
      PALETTE.beak,
      root,
    );
    beak.rotation.x = -Math.PI / 2;
    beak.position.set(0, 0.3, -0.38);
    for (const side of [-1, 1]) {
      await this.pace();
      const eye = this.mesh(
        CreateSphere(`${name}-auge-${String(side)}`, { diameter: 0.13, segments: 8 }, scene),
        PALETTE.white,
        root,
        { emissive: 0.3 },
      );
      eye.position.set(side * 0.1, 0.4, -0.27);
      const pupil = this.mesh(
        CreateSphere(`${name}-pupille-${String(side)}`, { diameter: 0.07, segments: 6 }, scene),
        PALETTE.ink,
        root,
      );
      pupil.position.set(side * 0.1, 0.4, -0.33);
      const wing = this.mesh(
        CreateSphere(`${name}-fluegel-${String(side)}`, { diameter: 0.34, segments: 8 }, scene),
        PALETTE.birdDark,
        root,
        { finish: 'stoff' },
      );
      wing.scaling.set(0.35, 0.8, 1.1);
      wing.position.set(side * 0.27, 0.02, 0.02);
    }
    const tail = this.mesh(
      CreateBox(`${name}-schwanz`, { width: 0.2, height: 0.06, depth: 0.32 }, scene),
      PALETTE.birdDark,
      root,
    );
    tail.position.set(0, 0.08, 0.36);
    tail.rotation.x = -0.5;
    return root;
  }

  private async buildFinte(
    scene: Scene,
    parent: TransformNode,
    name: string,
    kind: FinteKind,
  ): Promise<TransformNode> {
    const root = this.track(new TransformNode(name, scene));
    root.parent = parent;
    if (kind === 'ente') {
      const body = this.mesh(
        CreateSphere(`${name}-koerper`, { diameter: 0.6, segments: 12 }, scene),
        PALETTE.duck,
        root,
        { finish: 'glanz' },
      );
      body.scaling.set(1, 0.78, 1.2);
      await this.pace();
      const head = this.mesh(
        CreateSphere(`${name}-kopf`, { diameter: 0.38, segments: 12 }, scene),
        PALETTE.duck,
        root,
        { finish: 'glanz' },
      );
      head.position.set(0, 0.32, -0.14);
      const bill = this.mesh(
        CreateBox(`${name}-schnabel`, { width: 0.24, height: 0.07, depth: 0.22 }, scene),
        PALETTE.duckBill,
        root,
        { finish: 'glanz' },
      );
      bill.position.set(0, 0.27, -0.38);
      [-1, 1].forEach((side) => {
        const eye = this.mesh(
          CreateSphere(`${name}-auge-${String(side)}`, { diameter: 0.07, segments: 6 }, scene),
          PALETTE.ink,
          root,
        );
        eye.position.set(side * 0.1, 0.38, -0.3);
      });
    } else if (kind === 'socke') {
      const leg = this.mesh(
        CreateCylinder(`${name}-schaft`, { diameter: 0.32, height: 0.45, tessellation: 14 }, scene),
        PALETTE.sock,
        root,
        { finish: 'stoff' },
      );
      leg.position.y = 0.18;
      const band = this.mesh(
        CreateTorus(`${name}-bund`, { diameter: 0.3, thickness: 0.08, tessellation: 18 }, scene),
        PALETTE.white,
        root,
        { finish: 'stoff' },
      );
      band.position.y = 0.42;
      const foot = this.mesh(
        CreateSphere(`${name}-fuss`, { diameter: 0.34, segments: 10 }, scene),
        PALETTE.sock,
        root,
        { finish: 'stoff' },
      );
      // Fuß zur Seite, damit man die Socke von vorn als Socke erkennt.
      foot.scaling.set(1.6, 0.85, 0.95);
      foot.position.set(0.17, -0.08, 0);
      root.rotation.z = 0.12;
    } else {
      const stem = this.mesh(
        CreateCylinder(`${name}-stiel`, { diameter: 0.07, height: 0.55 }, scene),
        PALETTE.stem,
        root,
      );
      stem.position.y = -0.05;
      const center = this.mesh(
        CreateSphere(`${name}-mitte`, { diameter: 0.2, segments: 8 }, scene),
        PALETTE.bloom,
        root,
        { emissive: 0.2 },
      );
      center.position.set(0, 0.3, -0.05);
      for (let index = 0; index < 6; index++) {
        if (index % 3 === 0) await this.pace();
        const a = (index / 6) * Math.PI * 2;
        const petal = this.mesh(
          CreateSphere(`${name}-blatt-${String(index)}`, { diameter: 0.2, segments: 8 }, scene),
          PALETTE.petal,
          root,
          { finish: 'stoff' },
        );
        petal.scaling.set(1, 1, 0.45);
        petal.position.set(Math.cos(a) * 0.17, 0.3 + Math.sin(a) * 0.17, -0.02);
      }
    }
    return root;
  }

  private async buildClapper(scene: Scene, player: MinigamePlayer, doorX: number): Promise<void> {
    const ctx = this.ctx;
    if (!ctx) return;
    const slot = player.slot;
    await ctx.pace();
    const character = ctx.characters.create(scene, player);
    const home = new Vector3(doorX + CHARACTER_DX, 0, CHARACTER_Z);
    character.root.position.copyFrom(home);
    // Halb zur Tür, halb zum Fernseher gedreht (Gesicht bleibt sichtbar).
    character.root.rotation.y = -2.15;
    await ctx.pace();
    const ring = this.mesh(
      CreateTorus(
        `kuckuck-ring-${String(slot)}`,
        { diameter: 1.0, thickness: 0.12, tessellation: 32 },
        scene,
      ),
      player.color,
      null,
      { emissive: 0.3 },
    );
    markVisual(ring, 'spielerring', slot);
    ring.position.set(home.x, 0.06, home.z);
    await ctx.pace();
    // Fliegenklatsche: Stiel und gitterartiges Blatt in Slot-Farbe.
    const swatter = this.track(
      markVisual(new TransformNode(`kuckuck-klatsche-${String(slot)}`, scene), 'klatsche', slot),
    );
    const handle = this.mesh(
      CreateCylinder(
        `kuckuck-klatsche-stiel-${String(slot)}`,
        { diameter: 0.06, height: 0.8 },
        scene,
      ),
      PALETTE.handle,
      swatter,
    );
    handle.position.y = 0.1;
    const blade = this.mesh(
      CreateBox(
        `kuckuck-klatsche-blatt-${String(slot)}`,
        { width: 0.46, height: 0.42, depth: 0.05 },
        scene,
      ),
      player.color,
      swatter,
      { emissive: 0.2 },
    );
    blade.position.y = 0.66;
    const stars = this.track(new TransformNode(`kuckuck-sterne-${String(slot)}`, scene));
    for (let index = 0; index < 3; index++) {
      await ctx.pace();
      const star = this.mesh(
        CreateSphere(
          `kuckuck-stern-${String(slot)}-${String(index)}`,
          { diameter: 0.24, segments: 6 },
          scene,
        ),
        PALETTE.star,
        stars,
        { emissive: 0.6 },
      );
      const a = (index / 3) * Math.PI * 2;
      star.position.set(Math.cos(a) * 0.45, 0.12 * index, Math.sin(a) * 0.45);
    }
    stars.setEnabled(false);
    character.play('idle');
    this.clappers.set(slot, {
      slot,
      player,
      character,
      home,
      swatter,
      stars,
      anim: 'idle',
      swing: 0,
      throwAt: null,
      throwTo: null,
      hop: 0,
    });
  }
}

/** Dreiecksprisma (Giebel): Grundseite `width` auf y = 0, Spitze bei `height`, Tiefe `depth`. */
function prismMesh(scene: Scene, name: string, width: number, height: number, depth: number): Mesh {
  const w = width / 2;
  const d = depth / 2;
  // Front (z = −d) und Rückseite (z = +d) je ein Dreieck, dazu zwei schräge Dachflächen und Boden.
  const corners = [
    [-w, 0, -d],
    [w, 0, -d],
    [0, height, -d],
    [-w, 0, d],
    [w, 0, d],
    [0, height, d],
  ] as const;
  const faces: (readonly number[])[] = [
    [0, 2, 1],
    [3, 4, 5],
    [0, 3, 5, 2],
    [1, 2, 5, 4],
    [0, 1, 4, 3],
  ];
  const positions: number[] = [];
  const indices: number[] = [];
  for (const face of faces) {
    const base = positions.length / 3;
    for (const corner of face) positions.push(...(corners[corner] ?? [0, 0, 0]));
    indices.push(base, base + 1, base + 2);
    if (face.length === 4) indices.push(base, base + 2, base + 3);
  }
  const normals: number[] = [];
  VertexData.ComputeNormals(positions, indices, normals);
  const data = new VertexData();
  data.positions = positions;
  data.indices = indices;
  data.normals = normals;
  const mesh = new Mesh(name, scene);
  data.applyToMesh(mesh);
  return mesh;
}

export const kuckucksKlatsche: MinigameModule = {
  info: KUCKUCKS_KLATSCHE_INFO,
  create: () => new KuckucksKlatsche(),
};
