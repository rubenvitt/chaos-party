/**
 * Bienenstock-Honig (MG-101) – Ansicht: runde Gartenwiese, schräge Kamera. In der Mitte der
 * Bienenstock (Requisit; bebt mit der Stockwut, der Hof darunter färbt sich), ringsum je Slot
 * Figur, Honigtopf (Requisit, Band in Slot-Farbe, Füllung wächst im Glas) und Vorratsglas
 * (gesichert). Bienen (Requisit) kreisen um Töpfe, auf die sie wütend sind; eine Angriffsbiene
 * fliegt sichtbar vom Stock zum Ziel. Logik in `logic.ts`.
 */
import type { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { arenaLayout } from '@chaos-party/minigame-kit';
import {
  KitMinigame,
  SlotFigure,
  buildArena,
  buildParts,
  buildProp,
  createCamera,
  fallbackParts,
  mix,
  type MinigameStage,
  type PropOptions,
  type PropPart,
} from '@chaos-party/minigame-kit/babylon';
import type { MinigameInput, Slot } from '@chaos-party/minigame-sdk';
import type * as Sdk from '@chaos-party/minigame-sdk/babylon';
import { HoneyBot } from './bot.ts';
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
} as const satisfies Record<string, readonly PropPart[]>;

/** Eigener Grundkörper-Teil aus `PARTS` als Rollen-Knoten (Rolle = Name). */
const part = (stage: MinigameStage, role: keyof typeof PARTS, key: number, at: PropOptions = {}) =>
  buildProp(stage, role, PARTS[role], key, at);

/** Requisit aus dem Katalog mit Rückfall aus `PARTS` (Rolle = Requisit). */
const prop = (stage: MinigameStage, id: keyof typeof PARTS, key: number, slotColor?: string) =>
  stage.prop(id, {
    role: id,
    key,
    ...(slotColor ? { akzent: slotColor } : {}),
    fallback: fallbackParts(stage, id, PARTS[id], key, slotColor),
  }).root;

/** Biene (Requisit `biene`), Ursprung am Bauch, vorn = +Z. */
function bee(stage: MinigameStage, key: number, size: number): TransformNode {
  const root = prop(stage, 'biene', key);
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

class BienenstockHonig extends KitMinigame<HoneyLogic, HoneyEvent> {
  private hive: TransformNode | null = null;
  private yard: Mesh | null = null;
  private readonly ambient: TransformNode[] = [];
  private readonly stations = new Map<Slot, Station>();

  constructor() {
    super(INFO, 'honig', HoneyLogic, HoneyBot);
  }

  protected async build(stage: MinigameStage, _logic: HoneyLogic, ctx: Sdk.MinigameContext) {
    createCamera(stage, 'schraeg', ARENA);
    await buildArena(stage, ARENA, { ort: 'garten' });
    const hive = (this.hive = prop(stage, 'bienenstock', 0));
    // Flugloch (vorn = +Z im Modell) zur Kamera.
    hive.rotation.y = Math.PI;
    hive.scaling.setAll(SCALE.hive);
    const yard = stage.node('hof');
    buildParts(stage, yard, PARTS.hof, 'hof', 0);
    this.yard = yard.getChildMeshes<Mesh>()[0] ?? null;
    for (let n = 0; n < 3; n++) this.ambient.push(bee(stage, 90 + n, SCALE.bee));
    for (const [index, player] of ctx.players.entries()) {
      this.stations.set(player.slot, await this.createStation(stage, player, index));
    }
  }

  protected input(slot: Slot, input: MinigameInput, logic: HoneyLogic) {
    if (input.type !== 'press') return;
    if (input.button === 'b') return void logic.secure(slot);
    return logic.tap(slot);
  }

  protected scores(logic: HoneyLogic) {
    return logic.bank.scores();
  }

  protected override status(slot: Slot, logic: HoneyLogic) {
    const state = logic.keeper(slot)?.state;
    if (state === 'stunned') return 'gestochen!';
    if (state === 'secure') return 'sichert …';
    const pot = logic.bank.pot(slot);
    return pot > 0 ? `Topf ${pot} g` : undefined;
  }

  protected override banner(logic: HoneyLogic) {
    return logic.clock.finale ? 'Die Bienen toben!' : undefined;
  }

  protected onEvent(event: HoneyEvent, fx: Sdk.MinigameFx): void {
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

  protected sync(dt: number, logic: HoneyLogic, stage: MinigameStage): void {
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
      station.figure.show(figure, dt, this.over);
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
    const honeyPot = prop(stage, 'honigtopf', slot, player.color);
    honeyPot.position.set(pot.x, 0, pot.z);
    honeyPot.rotation.y = Math.PI;
    honeyPot.scaling.setAll(SCALE.pot);
    const coaster = stage.node('untersetzer');
    coaster.position.set(pot.x, 0, pot.z);
    coaster.scaling.setAll(SCALE.pot);
    buildParts(stage, coaster, PARTS.untersetzer, 'untersetzer', slot, player.color);
    // Honighaube auf dem Deckel (Grundkörper, wächst mit dem Topf-Honig; das Glas des Modells
    // ist selbst honigfarben, eine Füllung darin wäre nicht zu lesen).
    const honey = part(stage, 'honig', slot, { ...pot, y: POT_TOP * SCALE.pot, scale: SCALE.pot });
    part(stage, 'vorratsglas', slot, { ...jar, slotColor: player.color });
    const stock = part(stage, 'vorrat', slot, jar);
    await stage.pace();
    const swarm = Array.from({ length: SWARM }, (_, n) => bee(stage, slot * 10 + n, SCALE.bee));
    const attacker = bee(stage, slot * 10 + SWARM, SCALE.attacker);
    const figure = await SlotFigure.create(stage, player, { badgeHeight: 2.3 });
    figure.place(dx * 3.3, dz * 3.3, Math.atan2(-dx, -dz));
    this.figures.set(slot, figure);
    return { pot, honey, stock, swarm, attacker, figure };
  }
}

export const bienenstockHonig: Sdk.MinigameModule = {
  info: INFO,
  create: () => new BienenstockHonig(),
};
