/**
 * Bienenstock-Honig (MG-101) – Ansicht: runde Gartenwiese, schräge Kamera. In der Mitte der
 * Bienenstock (Requisit; bebt mit der Stockwut, der Hof darunter färbt sich), ringsum je Slot
 * Figur, Honigtopf (Requisit, Band in Slot-Farbe, Füllung wächst im Glas) und Vorratsglas
 * (gesichert). Bienen (Requisit) kreisen um Töpfe, auf die sie wütend sind; eine Angriffsbiene
 * fliegt sichtbar vom Stock zum Ziel. Logik in `logic.ts`.
 */
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder.js';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder.js';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder.js';
import type { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { arenaLayout } from '@chaos-party/minigame-kit';
import {
  MinigameStage,
  SlotFigure,
  buildArena,
  celebrateFigures,
  createCamera,
  mix,
  type StageMaterialOptions,
} from '@chaos-party/minigame-kit/babylon';
import {
  rankByScore,
  type MinigameInput,
  type MinigameResult,
  type Slot,
} from '@chaos-party/minigame-sdk';
import type * as Sdk from '@chaos-party/minigame-sdk/babylon';
import { createHoneyBot } from './bot.ts';
import { BIENENSTOCK_HONIG_INFO as INFO } from './info.ts';
import { HoneyLogic, type HoneyEvent } from './logic.ts';

const ARENA = arenaLayout({ form: 'rund', radius: 4.2 });
const HONEY = '#f5a623';
const HIVE = { calm: '#e8b04a', angry: '#e0603a', band: '#b9772a' } as const;
/** Topf und Glas zeigen ihre Füllung in Stufen bis zu diesen Mengen (Gramm). */
const POT_FULL = 70;
const JAR_FULL = 220;
const SWARM = 3;

/** Requisiten in Spielgröße (Modelle in Metern, siehe Katalog). */
const SCALE = { hive: 2, pot: 1.9, bee: 0.75, attacker: 1.5 } as const;
/** Oberkante des Topfdeckels im Modell (Meter). */
const POT_TOP = 0.44;

/** Grundkörper: Form, Maße, Farbe (`slot` = Slot-Farbe), Lage, Material. */
type Part = readonly [
  shape: 'box' | 'cyl' | 'ball',
  size: readonly number[],
  color: string,
  at: readonly number[],
  options?: StageMaterialOptions,
];
const glow = { emissive: 0.15 };
/**
 * Grundkörper je Teil. Katalog-Requisiten (`bienenstock`, `honigtopf`, `biene`) nur als Rückfall
 * ohne Modell, in Modell-Maßen (Boden y = 0, vorn = +Z); der Rest ist immer Grundkörper.
 */
const PARTS = {
  bienenstock: [
    ['cyl', [1.04, 1.04, 0.3], HIVE.calm, [0, 0.15, 0], { finish: 'matt' }],
    ['cyl', [0.9, 0.9, 0.25], HIVE.band, [0, 0.425, 0], { finish: 'matt' }],
    ['cyl', [0.66, 0.66, 0.25], HIVE.calm, [0, 0.675, 0], { finish: 'matt' }],
    ['cyl', [0.3, 0.3, 0.2], HIVE.band, [0, 0.9, 0], { finish: 'matt' }],
    ['box', [0.25, 0.15, 0.05], '#2b2118', [0, 0.15, 0.52]],
  ],
  honigtopf: [
    ['cyl', [0.42, 0.42, 0.32], '#dff4ff', [0, 0.16, 0], { alpha: 0.35, finish: 'glanz' }],
    ['cyl', [0.38, 0.38, 0.04], 'slot', [0, 0.35, 0], { finish: 'lack' }],
    ['cyl', [0.42, 0.42, 0.07], '#c4673a', [0, 0.405, 0], { finish: 'matt' }],
    ['box', [0.06, 0.08, 0.06], '#6b3415', [0, 0.44, 0.17]],
  ],
  /** Honighaube auf dem Topfdeckel (Topf-Maße, wächst nach oben). */
  honig: [['ball', [0.32, 0.6, 0.32], HONEY, [0, 0, 0], glow]],
  /** Untersetzer in Slot-Farbe (das Band des Modells sitzt fast verdeckt unterm Deckel). */
  untersetzer: [['cyl', [0.58, 0.58, 0.03], 'slot', [0, 0.015, 0], { finish: 'lack' }]],
  vorratsglas: [
    ['cyl', [0.75, 0.75, 1.2], '#dff4ff', [0, 0.6, 0], { alpha: 0.35, finish: 'glanz' }],
    ['cyl', [0.8, 0.8, 0.12], 'slot', [0, 1.25, 0], { finish: 'lack' }],
  ],
  vorrat: [['cyl', [0.66, 0.66, 1.15], HONEY, [0, 0.575, 0], glow]],
  /** Stockwut am Boden um den Stock (färbt sich, auch wenn das Modell es nicht kann). */
  hof: [['cyl', [2.6, 2.6, 0.04], HIVE.calm, [0, 0.02, 0], { finish: 'matt' }]],
  biene: [
    ['ball', [0.28, 0.3, 0.48], '#ffd43b', [0, 0.19, 0]],
    ['box', [0.29, 0.31, 0.08], '#2b2118', [0, 0.19, 0]],
    ['box', [0.2, 0.02, 0.12], '#ffffff', [-0.14, 0.33, -0.03], { alpha: 0.7 }],
    ['box', [0.2, 0.02, 0.12], '#ffffff', [0.14, 0.33, -0.03], { alpha: 0.7 }],
  ],
} as const satisfies Record<string, readonly Part[]>;

/** Grundkörper aus `PARTS` unter `parent`; liefert alle und die in Slot-Farbe. */
function build(
  stage: MinigameStage,
  parent: TransformNode,
  kind: keyof typeof PARTS,
  key: number,
  slot = '',
) {
  const meshes: Mesh[] = [];
  const slotted: Mesh[] = [];
  for (const [index, [shape, size, hex, at, options]] of (
    PARTS[kind] as readonly Part[]
  ).entries()) {
    const name = stage.name(kind, key, index);
    const [a = 1, b = a, c = a] = size;
    const mesh =
      shape === 'box'
        ? CreateBox(name, { width: a, height: b, depth: c }, stage.scene)
        : shape === 'cyl'
          ? CreateCylinder(name, { diameterTop: a, diameterBottom: b, height: c }, stage.scene)
          : CreateSphere(name, { diameterX: a, diameterY: b, diameterZ: c }, stage.scene);
    const part = stage.add(mesh, hex === 'slot' ? slot : hex, { ...options, parent });
    part.position.set(at[0] ?? 0, at[1] ?? 0, at[2] ?? 0);
    meshes.push(part);
    if (hex === 'slot') slotted.push(part);
  }
  return { meshes, slotted };
}

/** Grundkörper-Teil als Rollen-Knoten (Rolle = Name) an (x, z). */
function part(
  stage: MinigameStage,
  role: keyof typeof PARTS,
  key: number,
  x = 0,
  z = 0,
  slot = '',
) {
  const node = stage.node(role, role, key);
  node.position.set(x, 0, z);
  build(stage, node, role, key, slot);
  return node;
}

/** Biene (Requisit `biene`), Ursprung am Bauch, vorn = +Z. */
function bee(stage: MinigameStage, key: number, size: number): TransformNode {
  const { root } = stage.prop('biene', {
    role: 'biene',
    key,
    fallback: (parent) => void build(stage, parent, 'biene', key),
  });
  root.scaling.setAll(size);
  root.setEnabled(false);
  return root;
}

/** Biene auf einer Kreisbahn um (x, z), Blick in Flugrichtung (`dir` = Drehsinn ±1). */
function circle(
  node: TransformNode,
  x: number,
  z: number,
  radius: number,
  a: number,
  y: number,
  dir = 1,
) {
  node.position.set(x + Math.cos(a) * radius, y, z + Math.sin(a) * radius);
  // Vorn (+Z) zeigt bei Drehung −a entlang der Tangente für wachsendes a.
  node.rotation.y = -a + (dir < 0 ? Math.PI : 0);
}

interface Station {
  readonly pot: { readonly x: number; readonly z: number };
  readonly honey: TransformNode;
  readonly stock: TransformNode;
  readonly swarm: readonly TransformNode[];
  readonly attacker: TransformNode;
  readonly figure: SlotFigure;
}

const level = (value: number, steps: number) =>
  Math.max(0.01, Math.round(Math.min(1, value) * steps) / steps);

class BienenstockHonig implements Sdk.Minigame {
  private ctx: Sdk.MinigameContext | null = null;
  private stage: MinigameStage | null = null;
  private logic: HoneyLogic | null = null;
  private result: MinigameResult | null = null;
  private running = false;
  private hive: TransformNode | null = null;
  private yard: Mesh | null = null;
  private readonly ambient: TransformNode[] = [];
  private readonly stations = new Map<Slot, Station>();

  async prepare(ctx: Sdk.MinigameContext): Promise<void> {
    this.ctx = ctx;
    const slots = ctx.players.map((player) => player.slot);
    this.logic = new HoneyLogic(slots, ctx.rng, ctx.timeLimitMs);
    const stage = (this.stage = new MinigameStage(ctx, 'honig'));
    createCamera(stage, 'schraeg', ARENA);
    await buildArena(stage, ARENA, { ort: 'garten' });
    const hive = stage.prop('bienenstock', {
      role: 'bienenstock',
      key: 0,
      fallback: (root) => void build(stage, root, 'bienenstock', 0),
    });
    // Flugloch (vorn = +Z im Modell) zur Kamera.
    hive.root.rotation.y = Math.PI;
    hive.root.scaling.setAll(SCALE.hive);
    this.hive = hive.root;
    this.yard = build(stage, stage.node('hof'), 'hof', 0).meshes[0] ?? null;
    for (let n = 0; n < 3; n++) this.ambient.push(bee(stage, 90 + n, SCALE.bee));
    for (const [index, player] of ctx.players.entries()) {
      this.stations.set(player.slot, await this.createStation(stage, player, index));
    }
    this.sync(0);
  }

  start(): void {
    this.running = true;
    this.ctx?.fx.sound('go');
  }

  createBot: NonNullable<Sdk.Minigame['createBot']> = (options) =>
    createHoneyBot(options, () => (this.running ? this.logic : null));

  handleInput(slot: Slot, input: MinigameInput): void {
    if (!this.running || !this.logic || input.type !== 'press') return;
    if (input.button === 'b') return void this.logic.secure(slot);
    const event = this.logic.tap(slot);
    if (event) this.onEvent(event);
  }

  update(dt: number): void {
    if (!this.logic) return;
    if (this.running) for (const event of this.logic.step(dt)) this.onEvent(event);
    if (this.running && this.logic.finished) this.finish();
    this.sync(dt);
  }

  getResult(): MinigameResult | null {
    return this.result;
  }

  getHud(): Sdk.MinigameHud {
    const logic = this.logic;
    if (!logic) return { remainingMs: INFO.durationMs, scores: [] };
    const status = (slot: Slot) => {
      const state = logic.keeper(slot)?.state;
      if (state === 'stunned') return 'gestochen!';
      if (state === 'secure') return 'sichert …';
      const pot = logic.bank.pot(slot);
      return pot > 0 ? `Topf ${pot} g` : undefined;
    };
    const scores = logic.bank.scores();
    return {
      remainingMs: logic.clock.remainingMs,
      scores: scores.map((entry) => {
        const text = status(entry.slot);
        return text ? { ...entry, status: text } : entry;
      }),
      ...(logic.clock.finale && !this.result ? { banner: 'Die Bienen toben!' } : {}),
    };
  }

  dispose(): void {
    this.running = false;
    for (const station of this.stations.values()) station.figure.dispose();
    this.stations.clear();
    this.stage?.dispose();
    this.stage = null;
  }

  private onEvent(event: HoneyEvent): void {
    const fx = this.ctx?.fx;
    if (!fx) return;
    if (event.type === 'finale' || event.type === 'launch') {
      fx.sound(event.type === 'finale' ? 'buzz' : 'whoosh', { volume: 0.7, pitch: 1.3 });
      return;
    }
    const pot = this.stations.get(event.slot)?.pot;
    if (!pot) return;
    const at = { x: pot.x, y: 0.9, z: pot.z };
    if (event.type === 'tap') fx.sound('pop', { volume: 0.5, pitch: 0.8 + event.amount / 30 });
    else if (event.type === 'banked') {
      fx.sound('coin', { pitch: 0.9 + Math.min(0.6, event.amount / 120) });
      fx.burst('sparkle', at, HONEY);
    } else {
      fx.sound('hit');
      fx.burst('splash', at, HONEY);
      if (event.lost > 30) fx.shake(0.3);
    }
  }

  private finish(): void {
    const { ctx, logic } = this;
    if (!ctx || !logic || this.result) return;
    this.running = false;
    const placements = rankByScore(logic.bank.scores(), INFO.scoring);
    celebrateFigures(
      placements,
      [...this.stations.values()].map((s) => s.figure),
    );
    ctx.fx.sound('win');
    const highlights = logic.highlights(new Map(ctx.players.map((p) => [p.slot, p.name])));
    this.result = { minigameId: INFO.id, placements, ...(highlights.length ? { highlights } : {}) };
  }

  private sync(dt: number): void {
    const { logic, stage } = this;
    if (!logic || !stage) return;
    const now = logic.clock.time;
    const anger = level(logic.hive ** 2, 4);
    if (this.yard)
      this.yard.material = stage.material(mix(HIVE.calm, HIVE.angry, anger), { finish: 'matt' });
    // Der wütende Stock bebt (das Modell hat keine Laufzeit-Farbe).
    if (this.hive) this.hive.scaling.y = SCALE.hive * (1 + 0.06 * anger * Math.sin(now * 24));
    for (const [index, node] of this.ambient.entries()) {
      node.setEnabled(index < Math.ceil(logic.hive * 3));
      const a = -now * (1.5 + index * 0.4) + index * 2.1;
      circle(node, 0, 0, 1.5, a, 1.2 + index * 0.35, -1);
    }
    for (const keeper of logic.keepers) {
      const station = this.stations.get(keeper.slot);
      if (!station) continue;
      const { pot } = station;
      station.honey.scaling.y = level(logic.bank.pot(keeper.slot) / POT_FULL, 8) * SCALE.pot;
      station.stock.scaling.y = level(logic.bank.banked(keeper.slot) / JAR_FULL, 10);
      const angry = Math.ceil(keeper.anger * SWARM - 0.15);
      for (const [index, node] of station.swarm.entries()) {
        node.setEnabled(index < angry);
        const a = now * (3 + index) + (index * Math.PI * 2) / SWARM;
        circle(node, pot.x, pot.z, 0.7, a, 1.1 + 0.2 * Math.sin(a * 2));
      }
      const bee = logic.beeFor(keeper.slot);
      station.attacker.setEnabled(bee !== undefined);
      if (bee) {
        const t = Math.min(1, (now - bee.launchedAt) / (bee.arriveAt - bee.launchedAt));
        const y = 1.7 - 0.8 * t + Math.sin(t * Math.PI) * 1.2;
        station.attacker.position.set(pot.x * t, y, pot.z * t);
        // Vorn (+Z) in Flugrichtung vom Stock zum Topf.
        station.attacker.rotation.y = Math.atan2(pot.x, pot.z);
      }
      const state = keeper.state;
      const figure = { stunned: state === 'stunned', dashing: state === 'secure', moving: false };
      station.figure.show(figure, dt, this.result !== null);
    }
  }

  private async createStation(
    stage: MinigameStage,
    player: Sdk.MinigamePlayer,
    index: number,
  ): Promise<Station> {
    const slot = player.slot;
    const angle = ([-0.75, -0.25, 0.75, 0.25][index] ?? 0) * Math.PI;
    const [dx, dz] = [Math.cos(angle), Math.sin(angle)];
    const pot = { x: dx * 2.1, z: dz * 2.1 };
    const jar = { x: dx * 3.3 + Math.sign(dx) * 1.0, z: dz * 3.3 };
    const honeyPot = stage.prop('honigtopf', {
      role: 'honigtopf',
      key: slot,
      akzent: player.color,
      fallback: (root) => ({ akzent: build(stage, root, 'honigtopf', slot, player.color).slotted }),
    });
    honeyPot.root.position.set(pot.x, 0, pot.z);
    honeyPot.root.rotation.y = Math.PI;
    honeyPot.root.scaling.setAll(SCALE.pot);
    const coaster = stage.node('untersetzer');
    coaster.position.set(pot.x, 0, pot.z);
    coaster.scaling.setAll(SCALE.pot);
    build(stage, coaster, 'untersetzer', slot, player.color);
    // Honighaube auf dem Deckel (Grundkörper, wächst mit dem Topf-Honig; das Glas des Modells
    // ist selbst honigfarben, eine Füllung darin wäre nicht zu lesen).
    const honey = part(stage, 'honig', slot, pot.x, pot.z);
    honey.position.y = POT_TOP * SCALE.pot;
    honey.scaling.setAll(SCALE.pot);
    part(stage, 'vorratsglas', slot, jar.x, jar.z, player.color);
    const stock = part(stage, 'vorrat', slot, jar.x, jar.z);
    await stage.pace();
    const swarm = Array.from({ length: SWARM }, (_, n) => bee(stage, slot * 10 + n, SCALE.bee));
    const attacker = bee(stage, slot * 10 + SWARM, SCALE.attacker);
    const figure = await SlotFigure.create(stage, player, { badgeHeight: 2.3 });
    figure.place(dx * 3.3, dz * 3.3, Math.atan2(-dx, -dz));
    return { pot, honey, stock, swarm, attacker, figure };
  }
}

export const bienenstockHonig: Sdk.MinigameModule = {
  info: INFO,
  create: () => new BienenstockHonig(),
};
