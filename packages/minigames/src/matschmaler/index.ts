/**
 * Matschmaler (MG-121) – Ansicht: Wiese als Raster schräg von vorn. Jedes Feld ist ein
 * Matschfleck in Slot-Farbe **und** Slot-Muster (voll, Raute, Tupfen, Streifen), damit die
 * Wiese auch ohne Farbsehen lesbar bleibt. Regen: Wolke und blauer Streifen. Logik in `logic.ts`.
 */
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder.js';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder.js';
import type { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { walkerFigureState } from '@chaos-party/minigame-kit';
import {
  MinigameStage,
  SlotFigure,
  buildArena,
  celebrateFigures,
  createCamera,
  mix,
} from '@chaos-party/minigame-kit/babylon';
import type { MinigameInput, MinigameResult, Slot } from '@chaos-party/minigame-sdk';
import { markVisual } from '@chaos-party/minigame-sdk/babylon';
import type * as Sdk from '@chaos-party/minigame-sdk/babylon';
import { createMatschBot } from './bot.ts';
import { MATSCHMALER_INFO as INFO } from './info.ts';
import {
  MATSCH_ARENA,
  MATSCH_RULES as R,
  MatschLogic,
  cellCenter,
  type MatschEvent,
  type Owner,
} from './logic.ts';

const MUD = '#5a3d24';
/** Muster je Slot 1–4: Breite, Tiefe, Drehung des Flecks im Feld. */
const PATTERNS = [
  [0.94, 0.94, 0],
  [0.68, 0.68, Math.PI / 4],
  [0.5, 0.5, 0],
  [0.94, 0.36, 0],
] as const;

class Matschmaler implements Sdk.Minigame {
  private ctx: Sdk.MinigameContext | null = null;
  private stage: MinigameStage | null = null;
  private logic: MatschLogic | null = null;
  private result: MinigameResult | null = null;
  private running = false;
  private readonly figures = new Map<Slot, SlotFigure>();
  private readonly tiles: Mesh[] = [];
  /** Zuletzt gezeigter Besitzer je Feld (nur Änderungen anfassen). */
  private shown: Owner[] = [];
  private rain: { stripe: TransformNode; cloud: TransformNode; drops: Mesh } | null = null;

  async prepare(ctx: Sdk.MinigameContext): Promise<void> {
    this.ctx = ctx;
    const slots = ctx.players.map((player) => player.slot);
    this.logic = new MatschLogic(slots, ctx.rng, ctx.timeLimitMs);
    const stage = (this.stage = new MinigameStage(ctx, 'matsch'));
    // Etwas näher als die Vorlage: Muster und Figuren sollen gut zu erkennen sein.
    createCamera(stage, 'schraeg', MATSCH_ARENA).camera.radius *= 0.85;
    await buildArena(stage, MATSCH_ARENA, { ort: 'garten' });
    // Ein Fleck, 192 Klone mit geteilter Geometrie; je Feld eine Rolle, weil Muster = Lage.
    const base = CreateBox(stage.name('fleck'), { width: 1, height: 0.06, depth: 1 }, stage.scene);
    stage.add(base, MUD).setEnabled(false);
    for (let index = 0; index < R.cols * R.rows; index++) {
      if (index % 20 === 0) await stage.pace();
      const tile = stage.track(markVisual(base.clone(stage.name('feld', index)), 'matsch', index));
      const { x, z } = cellCenter(index);
      tile.position.set(x, 0.04, z);
      tile.setEnabled(false);
      this.tiles.push(tile);
    }
    this.shown = this.tiles.map(() => 0);
    for (const player of ctx.players) {
      this.figures.set(player.slot, await SlotFigure.create(stage, player, { badgeHeight: 2.4 }));
    }
    this.rain = this.buildRain(stage);
    this.sync(0);
  }

  start(): void {
    this.running = true;
    this.ctx?.fx.sound('go');
  }

  createBot: NonNullable<Sdk.Minigame['createBot']> = (options) =>
    createMatschBot(options, () => (this.running ? this.logic : null));

  handleInput(slot: Slot, input: MinigameInput): void {
    if (!this.running || !this.logic) return;
    if (input.type === 'move') this.logic.setStick(slot, input.x, input.y);
    else if (input.type === 'press' && input.button === 'a' && this.logic.splat(slot)) {
      this.ctx?.fx.sound('whoosh', { volume: 0.6 });
    }
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
    const now = logic.clock.time;
    const dazed = (slot: Slot) => now < (logic.mudder(slot)?.stunUntil ?? 0);
    const warned = logic.rain.hazards.some((rain) => rain.phase === 'warn');
    return {
      remainingMs: logic.clock.remainingMs,
      scores: logic.board.hud((slot) => (dazed(slot) ? 'benommen' : undefined)),
      ...(warned && !this.result ? { banner: 'Regen zieht auf!' } : {}),
    };
  }

  dispose(): void {
    this.running = false;
    for (const figure of this.figures.values()) figure.dispose();
    this.figures.clear();
    this.tiles.length = 0;
    this.stage?.dispose();
    this.stage = null;
  }

  private onEvent(event: MatschEvent): void {
    const fx = this.ctx?.fx;
    if (!fx) return;
    if (event.type === 'splat') {
      const color = this.figures.get(event.slot)?.player.color;
      fx.sound('splash');
      fx.burst('splash', { x: event.x, y: 0.3, z: event.z }, color);
      fx.shake(0.12);
    } else if (event.type === 'slip') fx.sound('fall', { volume: 0.7 });
    else if (event.type === 'bump') fx.sound('bump');
    else if (event.phase === 'active') {
      fx.sound('splash', { pitch: 0.6 });
      const { x, z } = event.rain.shape;
      fx.burst('splash', { x, y: 0.5, z }, '#7cc4f0');
    }
  }

  private finish(): void {
    const { ctx, logic } = this;
    if (!ctx || !logic || this.result) return;
    this.running = false;
    const placements = logic.board.placements();
    celebrateFigures(placements, this.figures.values());
    ctx.fx.sound('win');
    const highlights = logic.highlights(new Map(ctx.players.map((p) => [p.slot, p.name])));
    this.result = { minigameId: INFO.id, placements, ...(highlights.length ? { highlights } : {}) };
  }

  private sync(dt: number): void {
    const { logic, stage } = this;
    if (!logic || !stage) return;
    const now = logic.clock.time;
    for (const mudder of logic.mudders) {
      const figure = this.figures.get(mudder.slot);
      figure?.place(mudder.x, mudder.z, mudder.heading);
      figure?.show(walkerFigureState(mudder, now), dt, this.result !== null);
    }
    for (const [index, owner] of logic.cells.entries()) {
      const tile = this.tiles[index];
      if (!tile || this.shown[index] === owner) continue;
      this.shown[index] = owner;
      tile.setEnabled(owner !== 0);
      const color = owner === 0 ? null : this.figures.get(owner)?.player.color;
      if (!color) continue;
      const [width, depth, turn] = PATTERNS[owner - 1] ?? PATTERNS[0];
      tile.scaling.set(width, 1, depth);
      tile.rotation.y = turn;
      tile.material = stage.material(mix(color, MUD, 0.2), { finish: 'matt' });
    }
    const rain = logic.rain.hazards[0];
    if (!this.rain) return;
    const { stripe, cloud, drops } = this.rain;
    stripe.setEnabled(rain !== undefined);
    cloud.setEnabled(rain !== undefined);
    if (rain?.shape.kind !== 'rect') return;
    const { x, z, halfX, halfZ } = rain.shape;
    const active = rain.phase === 'active';
    stripe.position.set(x, 0.12, z);
    stripe.scaling.set(halfX * 2, 1, halfZ * 2);
    drops.material = stage.material('#3d8fd6', {
      alpha: active ? 0.6 : Math.sin(now * 12) > 0 ? 0.42 : 0.24,
    });
    // Die Wolke zieht während der Vorwarnung von außen an das Ende des Streifens heran
    // (neben der Wiese, damit sie nichts verdeckt).
    const away = 1.8 + (active ? 0 : Math.max(0, rain.activeAt - now) / R.rainWarnS) * 2;
    const across = halfX > halfZ;
    cloud.position.set(across ? -(R.cols / 2 + away) : x, 2.4, across ? z : R.rows / 2 + away);
    cloud.rotation.y = across ? Math.PI / 2 : 0;
  }

  private buildRain(stage: MinigameStage) {
    const stripe = stage.node('regen', 'regenstreifen');
    const box = CreateBox(stage.name('streifen'), { width: 1, height: 0.1, depth: 1 }, stage.scene);
    const drops = stage.add(box, '#3d8fd6', { parent: stripe, alpha: 0.3 });
    const cloud = stage.node('wolke', 'regenwolke');
    for (let index = 0; index < 4; index++) {
      const puff = CreateSphere(stage.name('wolke', index), { segments: 10 }, stage.scene);
      const mesh = stage.add(puff, '#8f9aa8', { parent: cloud, finish: 'matt' });
      mesh.position.set((index - 1.5) * 0.8, (index % 2) * 0.4, 0);
      mesh.scaling.set(1.3, 1, 1.1);
    }
    stripe.setEnabled(false);
    cloud.setEnabled(false);
    return { stripe, cloud, drops };
  }
}

export const matschmaler: Sdk.MinigameModule = {
  info: INFO,
  create: () => new Matschmaler(),
};
