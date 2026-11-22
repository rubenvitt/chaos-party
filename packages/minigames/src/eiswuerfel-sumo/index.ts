/**
 * Eiswürfel-Sumo (MG-023) – Physik und Ansicht: ein schmelzender Eiswürfel (Requisit `eiswuerfel`)
 * im Glas Limo (Requisiten `limoglas`, `strohhalm`, `zitronenscheibe`), feste Kamera schräg von
 * oben. Figuren sind Havok-Figuren aus dem Baukasten (`havokPawn`), der Würfel ein statischer
 * Körper, dessen Box je Schmelzstufe getauscht wird. Regeln in `logic.ts`.
 */
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder.js';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder.js';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { HavokBlock, MinigameStage, bonkFx, bonkPawns } from '@chaos-party/minigame-kit/babylon';
import { celebrateFigures, createCamera, havokPawn } from '@chaos-party/minigame-kit/babylon';
import type { HavokPawn, StageMaterialOptions } from '@chaos-party/minigame-kit/babylon';
import type { MinigameInput, MinigameResult, Slot } from '@chaos-party/minigame-sdk';
import type * as Sdk from '@chaos-party/minigame-sdk/babylon';
import { createSumoBot, type SumoBotView } from './bot.ts';
import { EISWUERFEL_SUMO_INFO as INFO } from './info.ts';
import { LIMO, PAWN, SumoRules, bannerFor, iceIsland, statusFor } from './logic.ts';
import { cubeHalf, meltLevel, meltWarning, offIce, respawnPoint } from './logic.ts';

const DEPTH = 2.4;
const GLASS_R = 5.6;
/** Modellhöhe des Eiswürfels (Requisit `eiswuerfel`, 1 × 0,5 × 1 m). */
const ICE_MODEL_H = 0.5;
/** Limoglas in Spielgröße (Modell 3,6 m breit) und Höhe seines Limo-Spiegels im Modell. */
const GLASS_SCALE = 2.93;
const GLASS_SPIEGEL = 0.82;

export class EiswuerfelSumo implements Sdk.Minigame {
  private ctx: Sdk.MinigameContext | null = null;
  private stage: MinigameStage | null = null;
  private rules: SumoRules | null = null;
  private result: MinigameResult | null = null;
  private running = false;
  private readonly pawns: HavokPawn[] = [];
  /** Wo eine gefallene Figur in der Limo treibt (Körper geparkt). */
  private readonly floating = new Map<Slot, { x: number; z: number }>();
  private iceBody: HavokBlock | null = null;
  private iceLevel = -1;
  private ice: TransformNode | null = null;
  private rim: TransformNode | null = null;

  async prepare(ctx: Sdk.MinigameContext): Promise<void> {
    this.ctx = ctx;
    const slots = ctx.players.map((player) => player.slot);
    this.rules = new SumoRules(slots, ctx.timeLimitMs);
    const stage = (this.stage = new MinigameStage(ctx, 'eis'));
    createCamera(stage, 'fest', iceIsland(GLASS_R), {
      position: { x: 0, y: 10.5, z: -8.2 },
      target: { x: 0, y: -0.9, z: 0.4 },
    });
    stage.backdrop({ halfX: GLASS_R + 1, halfZ: GLASS_R + 1, groundY: -3, surface: 'decke' });
    await this.buildScene(stage);
    this.iceBody = new HavokBlock(stage, 'eiskoerper', { friction: 0.02, restitution: 0.1 });
    this.melt(0);
    for (const [index, player] of ctx.players.entries()) {
      const angle = Math.PI / 4 + (index * Math.PI) / 2;
      const [x, z] = [Math.cos(angle), Math.sin(angle)];
      const start = { x: x * 1.9, z: z * 1.9 };
      this.pawns.push(await havokPawn(stage, player, { ...PAWN, start, facing: { x: -x, z: -z } }));
    }
    this.sync(0);
  }

  start(): void {
    this.running = true;
    this.ctx?.fx.sound('go');
  }

  createBot: NonNullable<Sdk.Minigame['createBot']> = (options) =>
    createSumoBot(options, () => (this.running ? this.view() : null));

  /** Was am Bildschirm zu sehen ist (Bot, Fairness-Prüfung). */
  view(): SumoBotView | null {
    if (!this.rules) return null;
    const now = this.rules.clock.time;
    const level = meltLevel(now);
    const pawns = this.pawns.map((pawn) => pawn.view(now));
    return { pawns, half: cubeHalf(level), nextHalf: cubeHalf(level + +meltWarning(now)) };
  }

  handleInput(slot: Slot, input: MinigameInput): void {
    if (this.running) this.pawns.find((entry) => entry.slot === slot)?.input(input);
  }

  update(dt: number): void {
    for (const pawn of this.pawns) pawn.settle();
    const { rules, ctx } = this;
    if (!rules || !ctx) return;
    if (this.running) {
      if (rules.clock.tick(dt).finaleStarted) ctx.fx.sound('buzz');
      if (meltLevel(rules.clock.time) !== this.iceLevel) this.melt(meltLevel(rules.clock.time));
      for (const sumo of rules.respawnDue()) this.respawn(sumo.slot, rules, ctx);
      for (const pawn of this.pawns) this.steer(pawn, rules, ctx, dt);
      for (const bonk of bonkPawns(this.pawns, rules.clock.time)) {
        rules.bonk(bonk.victim.slot, bonk.attacker.slot);
        bonkFx(ctx, bonk);
      }
    }
    for (const pawn of this.pawns) {
      if (!pawn.parked && pawn.position.y < LIMO.outY) this.splash(pawn, rules, ctx);
    }
    rules.refresh();
    if (this.running && rules.clock.expired) this.finish();
    this.sync(dt);
  }

  getResult(): MinigameResult | null {
    return this.result;
  }

  getHud(): Sdk.MinigameHud {
    const rules = this.rules;
    if (!rules) return { remainingMs: INFO.durationMs, scores: [] };
    const banner = this.result ? undefined : bannerFor(rules.clock.time, rules.clock.finale);
    return {
      remainingMs: rules.clock.remainingMs,
      scores: rules.board.hud((slot) => statusFor(rules.sumo(slot))),
      ...(banner ? { banner } : {}),
    };
  }

  dispose(): void {
    this.running = false;
    for (const pawn of this.pawns.splice(0)) pawn.dispose();
    this.stage?.dispose();
    this.stage = null;
  }

  /** Neue Schmelzstufe: Box des Würfels tauschen (alte Formen räumt die Bühne ab). */
  private melt(level: number): void {
    const { iceBody, ctx } = this;
    if (!iceBody || !ctx) return;
    iceBody.resize(cubeHalf(level), DEPTH, cubeHalf(level));
    if (this.iceLevel >= 0) ctx.fx.sound('splash', { volume: 0.5, pitch: 1.4 });
    this.iceLevel = level;
  }

  private steer(pawn: HavokPawn, rules: SumoRules, ctx: Sdk.MinigameContext, dt: number): void {
    const { x, y, z } = pawn.position;
    if (pawn.parked || y < -0.4 || offIce(rules.half + 0.05, x, z)) return;
    rules.onIce(pawn.slot, dt);
    if (pawn.steer(rules.clock.time, dt)) ctx.fx.sound('whoosh', { volume: 0.4, pitch: 1.3 });
  }

  /** In die Limo: Körper parken, die Figur treibt außen am Würfel. */
  private splash(pawn: HavokPawn, rules: SumoRules, ctx: Sdk.MinigameContext): void {
    const { x, z } = pawn.position;
    if (this.running) {
      const { credit, final } = rules.fall(pawn.slot);
      ctx.fx.sound(final ? 'lose' : 'splash');
      if (credit !== null) ctx.fx.sound('score', { volume: 0.6 });
      ctx.fx.burst('splash', { x, y: LIMO.y, z }, '#fff2a8');
    }
    const r = Math.max(Math.hypot(x, z), 0.1);
    const float = Math.min(GLASS_R - 1.2, Math.max(r, rules.half * 1.45 + 0.5)) / r;
    this.floating.set(pawn.slot, { x: x * float, z: z * float });
    pawn.park();
  }

  private respawn(slot: Slot, rules: SumoRules, ctx: Sdk.MinigameContext): void {
    const spot = respawnPoint(ctx.rng, rules.half);
    this.floating.delete(slot);
    this.pawns.find((entry) => entry.slot === slot)?.recall(spot.x, 2.2, spot.z);
    ctx.fx.sound('pop');
  }

  private finish(): void {
    const { ctx, rules } = this;
    if (!ctx || !rules || this.result) return;
    this.running = false;
    const [placements, figures] = [rules.board.placements(), this.pawns.map((p) => p.figure)];
    celebrateFigures(placements, figures);
    ctx.fx.sound('win');
    const highlights = rules.highlights(new Map(ctx.players.map((p) => [p.slot, p.name])));
    this.result = { minigameId: INFO.id, placements, ...(highlights.length ? { highlights } : {}) };
  }

  private sync(dt: number): void {
    const { rules, ice, rim } = this;
    if (!rules || !ice || !rim) return;
    const now = rules.clock.time;
    const level = meltLevel(now);
    const warn = this.running && meltWarning(now);
    const core = cubeHalf(level + +warn) * 2;
    ice.scaling.set(core, DEPTH / ICE_MODEL_H, core);
    rim.setEnabled(warn);
    rim.scaling.set(cubeHalf(level) * 2, DEPTH - 0.06, cubeHalf(level) * 2);
    for (const pawn of this.pawns) {
      const float = pawn.parked ? this.floating.get(pawn.slot) : undefined;
      const bob = LIMO.y - 0.85 + Math.sin(now * 3 + pawn.slot) * 0.06;
      pawn.show(now, dt, this.result !== null, float && { ...float, y: bob });
    }
  }

  /** Glas mit Limo, Strohhalm, Zitronenscheibe und der Eiswürfel samt nassem Rand. */
  private async buildScene(stage: MinigameStage): Promise<void> {
    const part = (name: string, hex: string, d: number, h: number, o: PartOptions = {}) => {
      const mesh = CreateCylinder(stage.name(name), { diameter: d, height: h }, stage.scene);
      return stage.add(mesh, hex, o);
    };
    // Requisiten-Grundkörper in Modell-Maßen (Rückfall ohne Modell), Spielgröße über `root`.
    // Das Glas-Modell (3,6 × 1,12 m) trägt seinen Limo-Spiegel auf 0,82 m: so skaliert, dass er
    // auf `LIMO.y` liegt (Glas ≈ 10,5 m breit, Rand knapp über dem Eis).
    const glass = stage.prop('limoglas', {
      fallback: (root) => {
        const wall = CreateCylinder(
          stage.name('glas'),
          { diameter: 3.6, height: 1.12, cap: 0 },
          stage.scene,
        );
        stage.add(wall, '#e8f6ff', { alpha: 0.18, finish: 'glanz', parent: root }).position.y =
          0.56;
      },
    }).root;
    glass.position.y = LIMO.y - GLASS_SPIEGEL * GLASS_SCALE;
    glass.scaling.setAll(GLASS_SCALE);
    // Limo knapp über dem Spiegel des Modells, innen am Glas (Wand ≈ 0,1 m im Modell).
    const limo = part('limo', '#ffd23a', 3.38 * GLASS_SCALE, 2.4, { alpha: 0.72, emissive: 0.2 });
    limo.position.y = LIMO.y + 0.03 - 1.2;
    const straw = stage.prop('strohhalm', {
      fallback: (root) => {
        part('halm', '#e8574d', 0.1, 1.99, { finish: 'lack', parent: root }).position.y = 0.995;
      },
    }).root;
    // ≈ 8 m lang, steckt schräg links hinten in der Limo; der Knick zeigt nach außen.
    straw.scaling.setAll(4);
    straw.position.set(-2, -2.1, 1.9);
    straw.rotation.set(0.3, 0, 0.42);
    await stage.pace();
    const lemon = stage.prop('zitronenscheibe', {
      fallback: (root) => {
        part('zitrone', '#f2b600', 0.64, 0.04, { parent: root }).position.y = 0.02;
        part('fruchtfleisch', '#ffe066', 0.52, 0.05, { emissive: 0.2, parent: root }).position.y =
          0.025;
      },
    }).root;
    // ≈ 1,6 m breit, schwimmt rechts neben dem Eis auf der Limo (innen am Glas).
    lemon.scaling.setAll(2.5);
    lemon.position.set(4, LIMO.y - 0.06, 1.2);
    const ice = stage.prop('eiswuerfel', {
      role: 'eiswuerfel',
      fallback: (root) => {
        const cube = CreateBox(
          stage.name('wuerfel'),
          { width: 1, height: ICE_MODEL_H, depth: 1 },
          stage.scene,
        );
        stage.add(cube, '#bdeaff', {
          parent: root,
          alpha: 0.8,
          emissive: 0.35,
          finish: 'glanz',
        }).position.y = ICE_MODEL_H / 2;
      },
    });
    // Boden des Würfels unten, Oberseite bündig bei y = 0 (Höhe über `scaling.y`).
    this.ice = ice.root;
    this.ice.position.y = -DEPTH;
    this.rim = stage.node('rand', 'schmelzrand');
    this.rim.position.y = -DEPTH / 2 - 0.03;
    const wet = CreateBox(stage.name('nass'), { size: 1 }, stage.scene);
    stage.add(wet, '#5fb8e8', { parent: this.rim, alpha: 0.75, emissive: 0.2 });
  }
}

type PartOptions = StageMaterialOptions & { readonly parent?: TransformNode };

export const eiswuerfelSumo: Sdk.MinigameModule = {
  info: INFO,
  create: () => new EiswuerfelSumo(),
};
