/**
 * Wackelturm – Hybrid-Minispiel (CHAOS-29, CHAOS-32, EXP-007). Babylon-Schicht über den
 * reinen Regeln aus `logic.ts`: baut die Picknickdecke mit Törtchenberg und Nestern, zeigt
 * Figuren mit schwankenden Törtchentürmen und übersetzt Regel-Ereignisse in Effekte.
 *
 * Vertrag (ADR-012): alles in `prepare` in `ctx.scene`, Zeit nur über `update`, Zufall nur
 * `ctx.rng`, Ergebnis per `rankByScore` beim Zeitlimit, `dispose` räumt alles weg.
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
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder.js';
import { CreateTorus } from '@babylonjs/core/Meshes/Builders/torusBuilder.js';
import '@babylonjs/core/Meshes/instancedMesh.js';
import type { InstancedMesh } from '@babylonjs/core/Meshes/instancedMesh.js';
import type { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import type { Scene } from '@babylonjs/core/scene.js';
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
import { createWackelturmBot } from './bot.ts';
import { WACKELTURM_INFO } from './info.ts';
import {
  createWackelturm,
  findRunner,
  nestPosition,
  pressBump,
  pressGrab,
  setStick,
  stepWackelturm,
  WACKELTURM_PARAMS,
  type Runner,
  type WackelturmEvent,
  type WackelturmState,
} from './logic.ts';
import { buildHighlights, hudStatus, type BannerState, bannerFor } from './texts.ts';

/** Höhe einer Törtchen-Schicht im Turm. */
const PIECE_HEIGHT = 0.32;
/** Unterkante des Turms über den Füßen der Figur. */
const TOWER_BASE = 1.72;
/** Törtchen-Sorten im Turm (Zuckerguss), wiederholt von unten nach oben. */
const FROSTINGS = ['#ff7eb6', '#7be0c3', '#8a5a3c'] as const;
const GOLD = '#ffc928';
/** Höchstens so viele Törtchen liegen sichtbar im Nest (Punkte-Haufen). */
const NEST_HEAP = 24;

interface PieceView {
  readonly base: InstancedMesh;
  readonly frosting: readonly InstancedMesh[];
  readonly gold: InstancedMesh;
}

interface Debris {
  readonly root: TransformNode;
  readonly view: PieceView;
  vx: number;
  vy: number;
  vz: number;
  spin: number;
  life: number;
}

interface PlayerView {
  readonly player: MinigamePlayer;
  readonly character: CharacterHandle;
  readonly tower: TransformNode;
  readonly pieces: readonly PieceView[];
  readonly ring: Mesh;
  /** Goldkrone oben auf dem Turm, sobald der Turmbonus greift. */
  readonly crown: TransformNode;
  readonly heap: readonly InstancedMesh[];
  animation: CharacterAnimation;
  busyUntil: number;
  phase: number;
  heapShown: number;
}

export class Wackelturm implements Minigame {
  private ctx: MinigameContext | null = null;
  private state: WackelturmState | null = null;
  private readonly views = new Map<Slot, PlayerView>();
  private readonly debris: Debris[] = [];
  private readonly goldViews = new Map<number, TransformNode>();
  private readonly owned: { dispose(): void; isDisposed?: () => boolean }[] = [];
  private readonly materials = new Map<string, Material>();
  private masters: {
    base: Mesh;
    frosting: Mesh[];
    gold: Mesh;
    cherry: Mesh;
  } | null = null;
  private running = false;
  private result: MinigameResult | null = null;
  private visualTime = 0;
  private debrisCounter = 0;
  private banner: BannerState | null = null;

  /** Regelzustand nur zum Lesen (Tests, Fehlersuche); `null` vor `prepare`. */
  get rules(): Readonly<WackelturmState> | null {
    return this.state;
  }

  async prepare(ctx: MinigameContext): Promise<void> {
    this.ctx = ctx;
    const { scene } = ctx;
    const params = WACKELTURM_PARAMS;
    this.state = createWackelturm(
      ctx.players.map((player) => player.slot),
      ctx.timeLimitMs / 1000,
      params,
    );

    const camera = new ArcRotateCamera(
      'wackel-kamera',
      -Math.PI / 2,
      0.8,
      16.2,
      new Vector3(0, 0.9, -0.35),
      scene,
    );
    camera.fov = 0.78;
    scene.activeCamera = camera;
    this.own(camera);
    if (ctx.look) {
      // Natur-Look (CHAOS-62): Die Decke ist die Spielfläche, drumherum Wiese vom Host.
      const { halfX, halfZ } = WACKELTURM_PARAMS;
      ctx.look.backdrop({ halfX: halfX + 0.8, halfZ: halfZ + 0.8, groundY: -0.3 });
    } else {
      const hemi = new HemisphericLight('wackel-himmel', new Vector3(0.2, 1, -0.3), scene);
      hemi.intensity = 0.75;
      hemi.groundColor = Color3.FromHexString('#b48a6a');
      const sun = new DirectionalLight('wackel-sonne', new Vector3(-0.4, -1, 0.5), scene);
      sun.intensity = 0.55;
      this.own(hemi, sun);
    }

    // Aufbau in Schritten, `pace` verteilt ihn auf mehrere Bilder (CHAOS-141).
    await ctx.pace();
    this.buildBlanket(scene);
    await ctx.pace();
    this.buildMasters(scene);
    await ctx.pace();
    await this.buildPile(scene);
    for (const player of ctx.players) {
      await ctx.pace();
      await this.buildPlayer(scene, player);
    }
    this.syncViews(0);
  }

  start(): void {
    this.running = true;
    this.ctx?.fx.sound('go');
  }

  /** KI-Platz (CHAOS-180): Bot liest den Regelzustand nur. */
  createBot(options: MinigameBotOptions): MinigameBotDriver {
    return createWackelturmBot(options, () => this.state);
  }

  handleInput(slot: Slot, input: MinigameInput): void {
    const state = this.state;
    if (!this.running || !state) return;
    if (input.type === 'move') {
      setStick(state, slot, input.x, input.y);
      return;
    }
    if (input.type !== 'press') return;
    const events = input.button === 'a' ? pressGrab(state, slot) : pressBump(state, slot);
    this.react(events);
  }

  update(dtSeconds: number): void {
    const state = this.state;
    const ctx = this.ctx;
    if (!state || !ctx) return;
    this.visualTime += dtSeconds;
    if (this.running) {
      const events = stepWackelturm(state, dtSeconds, () => ctx.rng.next());
      this.react(events);
      if (state.finished) this.finish();
    }
    this.syncViews(dtSeconds);
  }

  getResult(): MinigameResult | null {
    return this.result;
  }

  getHud(): MinigameHud {
    const state = this.state;
    const limitMs = this.ctx?.timeLimitMs ?? WACKELTURM_INFO.durationMs;
    if (!state) return { remainingMs: limitMs, scores: [] };
    const remainingMs = Math.max(0, Math.round(limitMs - state.time * 1000));
    const banner = bannerFor(this.banner, state.time, remainingMs, this.result !== null);
    return {
      remainingMs,
      scores: state.runners.map((runner) => {
        const status = hudStatus(runner, state.params);
        return { slot: runner.slot, score: runner.score, ...(status ? { status } : {}) };
      }),
      ...(banner ? { banner } : {}),
    };
  }

  dispose(): void {
    for (const view of this.views.values()) view.character.dispose();
    this.views.clear();
    for (const piece of this.debris.splice(0)) piece.root.dispose();
    for (const root of this.goldViews.values()) root.dispose();
    this.goldViews.clear();
    for (const item of this.owned.splice(0).reverse()) {
      if (item.isDisposed?.() !== true) item.dispose();
    }
    for (const material of this.materials.values()) material.dispose();
    this.materials.clear();
    this.masters = null;
    this.running = false;
  }

  // -------------------------------------------------------------------------
  // Regeln → Effekte
  // -------------------------------------------------------------------------

  private react(events: readonly WackelturmEvent[]): void {
    const ctx = this.ctx;
    const state = this.state;
    if (!ctx || !state) return;
    for (const event of events) {
      switch (event.type) {
        case 'grab':
          ctx.fx.sound('pop', { pitch: 0.9 + event.height * 0.06 });
          break;
        case 'gold': {
          const runner = findRunner(state, event.slot);
          ctx.fx.sound('coin');
          if (runner) ctx.fx.burst('sparkle', { x: runner.x, y: 1, z: runner.z }, GOLD);
          this.removeGold(event.id);
          break;
        }
        case 'gold-spawn':
          this.addGold(event.id, event.x, event.z);
          this.banner = { text: 'Goldtörtchen!', until: state.time + 2 };
          ctx.fx.sound('whoosh');
          break;
        case 'gold-expire':
          this.removeGold(event.id);
          break;
        case 'deliver': {
          const runner = findRunner(state, event.slot);
          const view = this.views.get(event.slot);
          ctx.fx.sound(event.bonus ? 'cheer' : 'score');
          if (runner) {
            ctx.fx.burst(
              event.bonus ? 'confetti' : 'sparkle',
              { x: runner.x, y: 2, z: runner.z },
              view?.player.color,
            );
          }
          if (view) this.playOnce(view, event.bonus ? 'cheer' : 'jump', 0.8);
          if (event.bonus) {
            this.banner = {
              text: `${shortName(view?.player.name)}: ${String(event.count)}er-Turm ×2!`,
              until: state.time + 2,
            };
          }
          break;
        }
        case 'topple': {
          const runner = findRunner(state, event.slot);
          const view = this.views.get(event.slot);
          if (runner && view) this.spill(view, runner, event.count);
          ctx.fx.sound(event.cause === 'bump' ? 'hit' : 'fall');
          ctx.fx.shake(Math.min(0.6, 0.15 + event.count * 0.05));
          if (view) this.playOnce(view, event.cause === 'bump' ? 'hit' : 'fall', 0.8);
          if (event.cause === 'bump' && event.by !== undefined) {
            const thief = this.views.get(event.by);
            this.banner = {
              text: `${shortName(thief?.player.name)} klaut den Turm!`,
              until: state.time + 2,
            };
          } else if (event.count >= 5) {
            this.banner = { text: 'Turm eingestürzt!', until: state.time + 1.5 };
          }
          break;
        }
        case 'bump': {
          const target = findRunner(state, event.target);
          ctx.fx.sound('bump');
          if (target) ctx.fx.burst('impact', { x: target.x, y: 1, z: target.z });
          break;
        }
        case 'dash': {
          const runner = findRunner(state, event.slot);
          ctx.fx.sound('whoosh', { pitch: 1.2 });
          if (runner) ctx.fx.burst('dust', { x: runner.x, y: 0.2, z: runner.z });
          break;
        }
        case 'miss': {
          const view = this.views.get(event.slot);
          if (view) this.playOnce(view, 'fall', 0.6);
          ctx.fx.sound('buzz', { volume: 0.5 });
          break;
        }
        case 'end':
          break;
      }
    }
  }

  private finish(): void {
    const ctx = this.ctx;
    const state = this.state;
    if (!ctx || !state || this.result) return;
    this.running = false;
    const placements = rankByScore(
      state.runners.map((runner) => ({ slot: runner.slot, score: runner.score })),
      WACKELTURM_INFO.scoring,
    );
    for (const placement of placements) {
      const view = this.views.get(placement.slot);
      if (view) this.playOnce(view, placement.place === 1 ? 'cheer' : 'sad', 99);
    }
    ctx.fx.sound('win');
    this.result = {
      minigameId: WACKELTURM_INFO.id,
      placements,
      highlights: buildHighlights(state, ctx.players, placements),
    };
  }

  // -------------------------------------------------------------------------
  // Aufbau
  // -------------------------------------------------------------------------

  private own<T extends { dispose(): void }>(item: T, ...more: { dispose(): void }[]): T {
    this.owned.push(item, ...more);
    return item;
  }

  private material(
    scene: Scene,
    hex: string,
    options: { emissive?: number; alpha?: number } = {},
  ): Material {
    const key = `${hex}|${String(options.emissive ?? 0)}|${String(options.alpha ?? 1)}`;
    const existing = this.materials.get(key);
    if (existing) return existing;
    const look = this.ctx?.look;
    if (look) {
      const lookMaterial = look.material(hex, {
        ...(options.emissive !== undefined ? { emissive: options.emissive } : {}),
        ...(options.alpha !== undefined ? { alpha: options.alpha } : {}),
      });
      this.materials.set(key, lookMaterial);
      return lookMaterial;
    }
    const material = new StandardMaterial(`wackel-mat-${String(this.materials.size)}`, scene);
    const color = Color3.FromHexString(hex);
    material.diffuseColor = color;
    material.specularColor = new Color3(0.12, 0.12, 0.12);
    if (options.emissive) material.emissiveColor = color.scale(options.emissive);
    if (options.alpha !== undefined && options.alpha < 1) material.alpha = options.alpha;
    this.materials.set(key, material);
    return material;
  }

  /** Picknickdecke mit Karomuster und Holzrand. */
  private buildBlanket(scene: Scene): void {
    const { halfX, halfZ } = WACKELTURM_PARAMS;
    if (!this.ctx?.look) {
      const floor = this.own(
        CreateBox('wackel-tisch', { width: 90, height: 0.2, depth: 70 }, scene),
      );
      floor.position.set(0, -0.32, 6);
      floor.material = this.material(scene, '#9bd36a');
    }
    const blanket = this.own(
      CreateBox('wackel-decke', { width: halfX * 2, height: 0.2, depth: halfZ * 2 }, scene),
    );
    blanket.position.y = -0.1;
    blanket.material = this.material(scene, '#fff3dc');
    const tile = this.own(CreateBox('wackel-karo', { width: 1, height: 0.02, depth: 1 }, scene));
    tile.material = this.material(scene, '#f26b5b');
    tile.isVisible = false;
    for (let ix = 0; ix < halfX * 2; ix++) {
      for (let iz = 0; iz < halfZ * 2; iz++) {
        if ((ix + iz) % 2 !== 0) continue;
        const instance = this.own(tile.createInstance(`wackel-karo-${String(ix)}-${String(iz)}`));
        instance.position.set(-halfX + ix + 0.5, 0.005, -halfZ + iz + 0.5);
      }
    }
    const rim = this.material(scene, '#c98b52');
    const sides: [number, number, number, number][] = [
      [0, halfZ + 0.2, halfX * 2 + 0.8, 0.4],
      [0, -halfZ - 0.2, halfX * 2 + 0.8, 0.4],
      [halfX + 0.2, 0, 0.4, halfZ * 2],
      [-halfX - 0.2, 0, 0.4, halfZ * 2],
    ];
    sides.forEach(([x, z, width, depth], index) => {
      const side = this.own(
        CreateBox(`wackel-rand-${String(index)}`, { width, height: 0.35, depth }, scene),
      );
      side.position.set(x, 0.08, z);
      side.material = rim;
    });
  }

  /** Vorlagen für Törtchen-Instanzen (unsichtbar). */
  private buildMasters(scene: Scene): void {
    const base = this.own(
      CreateCylinder(
        'wackel-toertchen-boden',
        { height: PIECE_HEIGHT * 0.6, diameterTop: 0.8, diameterBottom: 0.66, tessellation: 16 },
        scene,
      ),
    );
    base.material = this.material(scene, '#f2c27b');
    base.isVisible = false;
    const frosting = FROSTINGS.map((hex, index) => {
      const mesh = this.own(
        CreateCylinder(
          `wackel-guss-${String(index)}`,
          { height: PIECE_HEIGHT * 0.4, diameterTop: 0.6, diameterBottom: 0.84, tessellation: 16 },
          scene,
        ),
      );
      mesh.material = this.material(scene, hex);
      mesh.isVisible = false;
      return mesh;
    });
    const gold = this.own(
      CreateCylinder(
        'wackel-guss-gold',
        { height: PIECE_HEIGHT * 0.4, diameterTop: 0.6, diameterBottom: 0.84, tessellation: 16 },
        scene,
      ),
    );
    gold.material = this.material(scene, GOLD, { emissive: 0.35 });
    gold.isVisible = false;
    const cherry = this.own(CreateSphere('wackel-kirsche', { diameter: 0.24, segments: 8 }, scene));
    cherry.material = this.material(scene, '#e0263a');
    cherry.isVisible = false;
    this.masters = { base, frosting, gold, cherry };
  }

  /**
   * Ein Törtchen aus Instanzen. `track = false`: Es hängt an `parent` und wird mit ihm
   * entsorgt (Goldstücke, Krümel), statt bis zum Spielende in `owned` zu liegen.
   */
  private createPiece(name: string, parent: TransformNode | null, track = true): PieceView {
    const masters = this.masters;
    if (!masters) throw new Error('Vorlagen fehlen');
    const keep = <T extends { dispose(): void }>(item: T): T => (track ? this.own(item) : item);
    const base = keep(markVisual(masters.base.createInstance(`${name}-boden`), 'toertchen'));
    base.parent = parent;
    const frosting = masters.frosting.map((mesh, index) => {
      const instance = keep(
        markVisual(mesh.createInstance(`${name}-guss-${String(index)}`), 'toertchen-guss', index),
      );
      instance.parent = base;
      instance.position.y = PIECE_HEIGHT * 0.5;
      return instance;
    });
    const gold = keep(markVisual(masters.gold.createInstance(`${name}-gold`), 'toertchen-gold'));
    gold.parent = base;
    gold.position.y = PIECE_HEIGHT * 0.5;
    return { base, frosting, gold };
  }

  private showPiece(view: PieceView, kind: 'normal' | 'gold' | null, flavor: number): void {
    view.base.setEnabled(kind !== null);
    view.frosting.forEach((mesh, index) => {
      mesh.setEnabled(kind === 'normal' && index === flavor % FROSTINGS.length);
    });
    view.gold.setEnabled(kind === 'gold');
  }

  /** Törtchenberg in der Mitte: Teigberg mit Törtchen obendrauf. */
  private async buildPile(scene: Scene): Promise<void> {
    const { pileRadius } = WACKELTURM_PARAMS;
    const mound = this.own(
      CreateSphere('wackel-berg', { diameter: pileRadius * 2, segments: 20 }, scene),
    );
    mound.scaling.y = 0.42;
    mound.position.y = -0.05;
    mound.material = this.material(scene, '#ffe2a8');
    await this.ctx?.pace();
    const plate = this.own(
      CreateCylinder(
        'wackel-teller',
        { height: 0.12, diameter: pileRadius * 2 + 0.5, tessellation: 32 },
        scene,
      ),
    );
    plate.position.y = 0.02;
    plate.material = this.material(scene, '#ffffff');
    const masters = this.masters;
    if (!masters) return;
    // Pyramide aus Ringen: unten 8, dann 5, dann 3, oben 1.
    const rings: [count: number, radius: number, y: number][] = [
      [8, 1.05, 0.08],
      [5, 0.62, 0.36],
      [3, 0.28, 0.62],
      [1, 0, 0.9],
    ];
    const spots: [number, number, number][] = rings.flatMap(([count, radius, y], ring) =>
      Array.from({ length: count }, (_, index): [number, number, number] => {
        const angle = (index / count) * Math.PI * 2 + ring * 0.7;
        return [Math.cos(angle) * radius, y, Math.sin(angle) * radius];
      }),
    );
    for (const [index, [x, y, z]] of spots.entries()) {
      if (index % 6 === 0) await this.ctx?.pace();
      const piece = this.createPiece(`wackel-berg-${String(index)}`, null);
      piece.base.position.set(x, y + PIECE_HEIGHT * 0.3, z);
      piece.base.rotation.set(0.15 * Math.sin(index * 2.1), index, 0.15 * Math.cos(index * 1.3));
      this.showPiece(piece, 'normal', index);
      const cherry = this.own(
        masters.cherry.createInstance(`wackel-berg-kirsche-${String(index)}`),
      );
      cherry.parent = piece.base;
      cherry.position.y = PIECE_HEIGHT * 0.78;
    }
  }

  /** In mehreren Schritten, ohne JIT kostete ein Spieler am Stück über 10 ms (CHAOS-209). */
  private async buildPlayer(scene: Scene, player: MinigamePlayer): Promise<void> {
    const ctx = this.ctx;
    const state = this.state;
    if (!ctx || !state) return;
    const params = state.params;
    const nest = nestPosition(player.slot, params);
    const color = player.color;

    // Nest: Kissen in Slot-Farbe, Rand, Fahne mit Symbol.
    const cushion = this.own(
      CreateCylinder(
        `wackel-nest-${String(player.slot)}`,
        { height: 0.12, diameter: params.nestRadius * 2, tessellation: 32 },
        scene,
      ),
    );
    cushion.position.set(nest.x, 0.04, nest.z);
    cushion.material = this.material(scene, lighten(color, 0.45));
    const rim = this.own(
      CreateTorus(
        `wackel-nest-rand-${String(player.slot)}`,
        { diameter: params.nestRadius * 2, thickness: 0.22, tessellation: 32 },
        scene,
      ),
    );
    rim.position.set(nest.x, 0.12, nest.z);
    rim.material = this.material(scene, color);
    const outward = { x: Math.sign(nest.x), z: Math.sign(nest.z) };
    const pole = this.own(
      CreateCylinder(
        `wackel-fahne-stange-${String(player.slot)}`,
        { height: 2.6, diameter: 0.08 },
        scene,
      ),
    );
    pole.position.set(nest.x + outward.x * 0.95, 1.3, nest.z + outward.z * 0.75);
    pole.material = this.material(scene, '#6b4a2f');
    const flag = this.own(
      CreateBox(
        `wackel-fahne-${String(player.slot)}`,
        { width: 0.9, height: 0.6, depth: 0.05 },
        scene,
      ),
    );
    flag.position.set(pole.position.x - outward.x * 0.47, 2.25, pole.position.z);
    flag.material = this.material(scene, color);
    const symbol = this.buildSymbol(scene, player);
    symbol.position.set(flag.position.x, flag.position.y, flag.position.z - 0.06);
    await ctx.pace();

    // Punkte-Haufen im Nest (wächst mit den Punkten).
    const heap: InstancedMesh[] = [];
    const masters = this.masters;
    if (masters) {
      for (let index = 0; index < NEST_HEAP; index++) {
        const ring = index < 8 ? 0 : index < 14 ? 1 : index < 19 ? 2 : 3;
        const inRing =
          ring === 0 ? index : ring === 1 ? index - 8 : ring === 2 ? index - 14 : index - 19;
        const perRing = [8, 6, 5, 5][ring] ?? 5;
        const radius = [0.62, 0.42, 0.22, 0.05][ring] ?? 0;
        const angle = (inRing / perRing) * Math.PI * 2 + ring * 0.4;
        const instance = this.own(
          masters.frosting[index % FROSTINGS.length]?.createInstance(
            `wackel-haufen-${String(player.slot)}-${String(index)}`,
          ) ?? masters.gold.createInstance(`wackel-haufen-${String(player.slot)}-${String(index)}`),
        );
        instance.position.set(
          nest.x + Math.cos(angle) * radius,
          0.16 + ring * 0.13,
          nest.z + Math.sin(angle) * radius,
        );
        markVisual(instance, 'haufen', `${String(player.slot)}-${String(index)}`);
        instance.scaling.setAll(0.7);
        instance.setEnabled(false);
        heap.push(instance);
      }
    }

    // Figur, Ring in Slot-Farbe unter den Füßen, Turm über dem Kopf.
    await ctx.pace();
    const character = ctx.characters.create(scene, player);
    character.play('idle');
    const ring = this.own(
      CreateTorus(
        `wackel-ring-${String(player.slot)}`,
        { diameter: 1.05, thickness: 0.1, tessellation: 24 },
        scene,
      ),
    );
    markVisual(ring, 'spielerring', player.slot);
    ring.material = this.material(scene, color, { emissive: 0.4 });
    const tower = this.own(
      markVisual(
        new TransformNode(`wackel-turm-${String(player.slot)}`, scene),
        'turm',
        player.slot,
      ),
    );
    await ctx.pace();
    const pieces = Array.from({ length: params.maxStack }, (_, index) => {
      const piece = this.createPiece(`wackel-turm-${String(player.slot)}-${String(index)}`, tower);
      piece.base.position.y = index * PIECE_HEIGHT;
      this.showPiece(piece, null, 0);
      return piece;
    });
    await ctx.pace();
    const crown = this.own(new TransformNode(`wackel-krone-${String(player.slot)}`, scene));
    markVisual(crown, 'krone', player.slot);
    crown.parent = tower;
    const crownMaterial = this.material(scene, GOLD, { emissive: 0.5 });
    const band = this.own(
      CreateCylinder(
        `wackel-krone-${String(player.slot)}-reif`,
        { height: 0.22, diameterTop: 0.62, diameterBottom: 0.5, tessellation: 5 },
        scene,
      ),
    );
    band.parent = crown;
    band.position.y = 0.11;
    band.material = crownMaterial;
    for (let index = 0; index < 5; index++) {
      const angle = (index / 5) * Math.PI * 2;
      const jewel = this.own(
        CreateSphere(
          `wackel-krone-${String(player.slot)}-zacke-${String(index)}`,
          { diameter: 0.12, segments: 6 },
          scene,
        ),
      );
      jewel.parent = crown;
      jewel.position.set(Math.cos(angle) * 0.29, 0.27, Math.sin(angle) * 0.29);
      jewel.material = crownMaterial;
    }
    crown.setEnabled(false);
    this.views.set(player.slot, {
      player,
      character,
      tower,
      pieces,
      ring,
      crown,
      heap,
      animation: 'idle',
      busyUntil: 0,
      phase: player.slot * 1.7,
      heapShown: 0,
    });
  }

  /**
   * Farbunabhängiges Slot-Symbol auf der Fahne (● ▲ ■ ★). Die Teile liegen flach in der
   * lokalen xz-Ebene; die Wurzel kippt sie zur Kamera (lokal +y → Welt −z, lokal +z → oben).
   */
  private buildSymbol(scene: Scene, player: MinigamePlayer): TransformNode {
    const root = this.own(new TransformNode(`wackel-symbol-${String(player.slot)}`, scene));
    root.rotation.x = -Math.PI / 2;
    const white = this.material(scene, '#ffffff', { emissive: 0.3 });
    const name = `wackel-symbol-${String(player.slot)}-teil`;
    const triangle = (spin: number, suffix: string) => {
      const mesh = CreateCylinder(
        `${name}${suffix}`,
        { height: 0.04, diameter: 0.46, tessellation: 3 },
        scene,
      );
      // Spitze nach oben (lokal +z), Ecke 0 des Builders liegt auf +x.
      mesh.rotation.y = -Math.PI / 2 + spin;
      return mesh;
    };
    const parts: Mesh[] =
      player.symbol === '▲'
        ? [triangle(0, '')]
        : player.symbol === '■'
          ? [CreateBox(name, { width: 0.32, height: 0.04, depth: 0.32 }, scene)]
          : player.symbol === '★'
            ? [triangle(0, '-a'), triangle(Math.PI, '-b')]
            : [CreateCylinder(name, { height: 0.04, diameter: 0.36, tessellation: 24 }, scene)];
    for (const part of parts) {
      part.material = white;
      part.parent = root;
      this.own(part);
    }
    return root;
  }

  private addGold(id: number, x: number, z: number): void {
    const ctx = this.ctx;
    const masters = this.masters;
    if (!ctx || !masters) return;
    const root = new TransformNode(`wackel-goldstueck-${String(id)}`, ctx.scene);
    markVisual(root, 'goldstueck', id);
    root.position.set(x, 0.35, z);
    const piece = this.createPiece(`wackel-goldstueck-${String(id)}-t`, root, false);
    this.showPiece(piece, 'gold', 0);
    piece.base.scaling.setAll(1.5);
    const halo = CreateTorus(
      `wackel-goldring-${String(id)}`,
      { diameter: 1.1, thickness: 0.07, tessellation: 24 },
      ctx.scene,
    );
    halo.material = this.material(ctx.scene, GOLD, { emissive: 0.8 });
    halo.parent = root;
    halo.position.y = -0.3;
    this.goldViews.set(id, root);
  }

  private removeGold(id: number): void {
    const root = this.goldViews.get(id);
    if (!root) return;
    this.goldViews.delete(id);
    root.dispose();
  }

  /** Umgekippter Turm: Törtchen fliegen in alle Richtungen (nur Anzeige). */
  private spill(view: PlayerView, runner: Runner, count: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const shown = Math.min(count, 8);
    for (let index = 0; index < shown; index++) {
      const name = `wackel-kruemel-${String(this.debrisCounter++)}`;
      const root = new TransformNode(name, ctx.scene);
      markVisual(root, 'kruemel', name);
      root.position.set(runner.x, TOWER_BASE + index * PIECE_HEIGHT, runner.z);
      const piece = this.createPiece(`${name}-t`, root, false);
      this.showPiece(piece, 'normal', index);
      // Feste Streuung nach Index (kein Zufall nötig, rein optisch).
      const angle = index * 2.399 + view.player.slot;
      const speed = 2 + (index % 3) * 0.8;
      this.debris.push({
        root,
        view: piece,
        vx: Math.cos(angle) * speed,
        vy: 2.5 + (index % 4) * 0.6,
        vz: Math.sin(angle) * speed,
        spin: 4 + index,
        life: 1.4,
      });
    }
  }

  private playOnce(view: PlayerView, animation: CharacterAnimation, seconds: number): void {
    view.character.play(animation);
    view.animation = animation;
    view.busyUntil = this.visualTime + seconds;
  }

  // -------------------------------------------------------------------------
  // Anzeige je Schritt (beeinflusst die Regeln nie)
  // -------------------------------------------------------------------------

  private syncViews(dt: number): void {
    const state = this.state;
    if (!state) return;
    for (const runner of state.runners) {
      const view = this.views.get(runner.slot);
      if (!view) continue;
      const root = view.character.root;
      root.position.set(runner.x, 0, runner.z);
      root.rotation.y = Math.atan2(runner.fx, runner.fz);
      view.ring.position.set(runner.x, 0.06, runner.z);

      // Turm: schwankt mit dem Wackelwert, biegt sich nach oben stärker.
      const height = runner.stack.length;
      view.phase += dt * (5 + height * 0.35 + runner.wobble * 6);
      const sway = runner.wobble * 0.05;
      view.tower.position.set(runner.x, TOWER_BASE, runner.z);
      view.tower.rotation.y = root.rotation.y;
      view.pieces.forEach((piece, index) => {
        const kind = index < height ? (runner.stack[index] ?? 'normal') : null;
        this.showPiece(piece, kind, index);
        const bend = sway * index * index * 0.5;
        piece.base.position.x = Math.sin(view.phase) * bend;
        piece.base.position.z = Math.cos(view.phase * 0.7) * bend * 0.6;
        piece.base.rotation.z = -Math.sin(view.phase) * sway * index * 1.2;
      });
      const bonusFrom = state.params.bonusFrom;
      view.crown.setEnabled(bonusFrom !== null && height >= bonusFrom);
      const topBend = sway * height * height * 0.5;
      view.crown.position.set(
        Math.sin(view.phase) * topBend,
        height * PIECE_HEIGHT,
        Math.cos(view.phase * 0.7) * topBend * 0.6,
      );

      // Punkte-Haufen im Nest.
      const heapCount = Math.min(NEST_HEAP, Math.round(runner.score / 2));
      if (heapCount !== view.heapShown) {
        view.heap.forEach((instance, index) => {
          instance.setEnabled(index < heapCount);
        });
        view.heapShown = heapCount;
      }

      // Figuren-Animation.
      if (this.visualTime >= view.busyUntil) {
        const moving = Math.hypot(runner.vx, runner.vz) > 0.4;
        const wanted: CharacterAnimation = moving ? 'run' : 'idle';
        if (wanted !== view.animation) {
          view.character.play(wanted);
          view.animation = wanted;
        }
      }
    }

    // Goldtörtchen hüpfen und drehen sich.
    for (const [id, root] of this.goldViews) {
      root.position.y = 0.4 + Math.abs(Math.sin(this.visualTime * 3 + id)) * 0.25;
      root.rotation.y = this.visualTime * 2 + id;
    }

    // Fliegende Krümel.
    for (let index = this.debris.length - 1; index >= 0; index--) {
      const piece = this.debris[index];
      if (!piece) continue;
      piece.life -= dt;
      piece.vy -= 12 * dt;
      piece.root.position.x += piece.vx * dt;
      piece.root.position.y = Math.max(0.1, piece.root.position.y + piece.vy * dt);
      piece.root.position.z += piece.vz * dt;
      piece.root.rotation.x += piece.spin * dt;
      piece.root.rotation.z += piece.spin * 0.6 * dt;
      if (piece.root.position.y <= 0.1) {
        piece.vx *= 0.8;
        piece.vz *= 0.8;
        piece.vy = Math.abs(piece.vy) * 0.3;
      }
      if (piece.life <= 0) {
        piece.root.dispose();
        this.debris.splice(index, 1);
      }
    }
  }
}

function shortName(name: string | undefined): string {
  const value = name ?? '?';
  return value.length > 12 ? `${value.slice(0, 11)}…` : value;
}

/** Hellt eine Hex-Farbe zum Weiß hin auf (0 = gleich, 1 = weiß). */
function lighten(hex: string, amount: number): string {
  const color = Color3.FromHexString(hex);
  const mix = (value: number) => value + (1 - value) * amount;
  return new Color3(mix(color.r), mix(color.g), mix(color.b)).toHexString();
}

export const wackelturm: MinigameModule = {
  info: WACKELTURM_INFO,
  create: () => new Wackelturm(),
};
