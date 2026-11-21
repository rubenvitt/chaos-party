/**
 * „Hallo Baukasten“ – Muster-Minispiel (CHAOS-83, ADR-021). Zeigt den Weg: Steckbrief in
 * `info.ts`, reine Logik in `logic.ts`, Bot in `bot.ts` (auch KI-Platz), hier die Ansicht. Arena,
 * Kamera, Bühne, Figuren mit Abzeichen und Pool kommen aus `@chaos-party/minigame-kit/babylon`.
 */
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder.js';
import { CreateTorus } from '@babylonjs/core/Meshes/Builders/torusBuilder.js';
import type { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { walkerFigureState, warningProgress } from '@chaos-party/minigame-kit';
import {
  MinigameStage,
  NodePool,
  SlotFigure,
  buildArena,
  celebrateFigures,
  createCamera,
} from '@chaos-party/minigame-kit/babylon';
import type { MinigameInput, MinigameResult, Slot } from '@chaos-party/minigame-sdk';
import type * as Sdk from '@chaos-party/minigame-sdk/babylon';
import { createHalloBot } from './bot.ts';
import { HALLO_BAUKASTEN_INFO as INFO } from './info.ts';
import { HALLO_ARENA, HALLO_RULES, HalloLogic, type HalloEvent } from './logic.ts';

/** Glühwürmchen: Wurzel am Landepunkt mit Lichtkreis, der Körper sinkt herab. */
interface Light {
  readonly root: TransformNode;
  readonly body: Mesh;
  setEnabled(on: boolean): void;
}

class HalloBaukasten implements Sdk.Minigame {
  private ctx: Sdk.MinigameContext | null = null;
  private stage: MinigameStage | null = null;
  private logic: HalloLogic | null = null;
  private result: MinigameResult | null = null;
  private running = false;
  private readonly figures = new Map<Slot, SlotFigure>();
  private lights: NodePool<Light> | null = null;

  async prepare(ctx: Sdk.MinigameContext): Promise<void> {
    this.ctx = ctx;
    const slots = ctx.players.map((player) => player.slot);
    this.logic = new HalloLogic(slots, ctx.rng, ctx.timeLimitMs);
    const stage = (this.stage = new MinigameStage(ctx, 'hallo'));
    createCamera(stage, 'schraeg', HALLO_ARENA);
    await buildArena(stage, HALLO_ARENA, { ort: 'teich' });
    const ring = { ringRadius: HALLO_RULES.catchRadius };
    for (const player of ctx.players) {
      this.figures.set(player.slot, await SlotFigure.create(stage, player, ring));
    }
    this.lights = new NodePool(() => this.createLight(stage));
    await this.lights.warm(stage, 4);
    this.sync(0);
  }

  start(): void {
    this.running = true;
    this.ctx?.fx.sound('go');
  }

  /** KI-Platz (CHAOS-180): Pflicht für die Rotation, hier als Muster. */
  createBot: NonNullable<Sdk.Minigame['createBot']> = (options) =>
    createHalloBot(options, () => (this.running ? this.logic : null));

  handleInput(slot: Slot, input: MinigameInput): void {
    if (!this.running || !this.logic) return;
    if (input.type === 'move') this.logic.setStick(slot, input.x, input.y);
    else if (input.type === 'press' && input.button === 'a' && this.logic.dash(slot)) {
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
    return {
      remainingMs: logic.clock.remainingMs,
      scores: logic.board.hud(),
      ...(logic.clock.finale && !this.result ? { banner: 'Abenddämmerung!' } : {}),
    };
  }

  dispose(): void {
    this.running = false;
    for (const figure of this.figures.values()) figure.dispose();
    this.figures.clear();
    this.lights?.clear();
    this.stage?.dispose();
    this.stage = null;
  }

  private onEvent(event: HalloEvent): void {
    const fx = this.ctx?.fx;
    if (!fx) return;
    if (event.type === 'finale') {
      fx.sound('buzz');
      return;
    }
    const { fly } = event;
    if (event.type === 'spawn') {
      this.lights?.acquire(fly.id).root.position.set(fly.x, 0, fly.z);
      return;
    }
    this.lights?.release(fly.id);
    const caught = event.type === 'catch';
    fx.sound(caught ? 'coin' : 'pop');
    fx.burst(caught ? 'sparkle' : 'smoke', { x: fly.x, y: 0.6, z: fly.z });
  }

  private finish(): void {
    const { ctx, logic } = this;
    if (!ctx || !logic || this.result) return;
    this.running = false;
    const placements = logic.board.placements();
    celebrateFigures(placements, this.figures.values());
    this.lights?.releaseAll();
    ctx.fx.sound('win');
    const highlights = logic.highlights(new Map(ctx.players.map((p) => [p.slot, p.name])));
    this.result = { minigameId: INFO.id, placements, ...(highlights.length ? { highlights } : {}) };
  }

  private sync(dt: number): void {
    const logic = this.logic;
    if (!logic) return;
    const now = logic.clock.time;
    for (const hopper of logic.hoppers) {
      const figure = this.figures.get(hopper.slot);
      figure?.place(hopper.x, hopper.z, hopper.heading);
      figure?.show(walkerFigureState(hopper, now), dt, this.result !== null);
    }
    for (const fly of logic.flies) {
      const light = this.lights?.get(fly.id);
      if (light) light.body.position.y = 0.5 + (1 - warningProgress(fly, now)) * 4;
    }
  }

  private createLight(stage: MinigameStage): Light {
    const root = stage.node('licht', 'gluehwuermchen');
    const ball = CreateSphere(stage.name('koerper', stage.count), { segments: 8 }, stage.scene);
    const body = stage.add(ball, '#ffe14d', { emissive: 0.9, parent: root });
    body.scaling.setAll(0.45);
    const size = { diameter: HALLO_RULES.catchRadius * 2, thickness: 0.08, tessellation: 24 };
    const ring = CreateTorus(stage.name('lichtkreis', stage.count), size, stage.scene);
    stage.add(ring, '#fff3a8', { emissive: 0.7, alpha: 0.7, parent: root }).position.y = 0.06;
    return { root, body, setEnabled: root.setEnabled.bind(root) };
  }
}

export const halloBaukasten: Sdk.MinigameModule = {
  info: INFO,
  create: () => new HalloBaukasten(),
};
