/**
 * Rasensprenger-Rodeo (MG-011) – Ansicht: Garten von oben. Je Sprenger ein Requisit
 * `rasensprenger` (dreht als Ganzes mit dem Strahl) mit Schlauch zur `schlauchtrommel` am Rand.
 * Vorwarnung = Reichweiten-Ring und wippende Düse (roter Zeiger in Strahlrichtung, Grundkörper),
 * der Strahl ist ein gedrehter, gestreckter Kasten, Nasse stehen in einer Pfütze.
 */
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder.js';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder.js';
import { CreateTorus } from '@babylonjs/core/Meshes/Builders/torusBuilder.js';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { arenaLayout } from '@chaos-party/minigame-kit';
import {
  MinigameStage,
  SlotFigure,
  buildArena,
  celebrateFigures,
  createCamera,
} from '@chaos-party/minigame-kit/babylon';
import type { MinigameInput, MinigameResult, Slot } from '@chaos-party/minigame-sdk';
import type * as Sdk from '@chaos-party/minigame-sdk/babylon';
import { createRodeoBot } from './bot.ts';
import { RASENSPRENGER_RODEO_INFO as INFO } from './info.ts';
import { RODEO_RULES, RodeoLogic, type RodeoEvent, type Sprinkler } from './logic.ts';

const ARENA = arenaLayout({ form: 'rund', radius: RODEO_RULES.radius });
const WATER = '#2a9df4';
const JET_Y = 0.55;
/** Sprenger in Spielgröße: Fuß ≈ 1 m wie vorher, Arm ≈ 1,7 m (Modell 0,84 × 0,45 × 0,52 m). */
const SPRINKLER_SCALE = 2;
/** Schlauchtrommel ≈ 0,9 m breit (Modell 0,58 m), knapp außerhalb des Rasens. */
const REEL_SCALE = 1.6;
const REEL_RADIUS = RODEO_RULES.radius + 1.1;

interface SprinklerView {
  readonly body: TransformNode;
  readonly head: TransformNode;
  readonly jet: TransformNode;
  readonly range: TransformNode;
}

class RasensprengerRodeo implements Sdk.Minigame {
  private ctx: Sdk.MinigameContext | null = null;
  private stage: MinigameStage | null = null;
  private logic: RodeoLogic | null = null;
  private result: MinigameResult | null = null;
  private running = false;
  private readonly sprinklers: SprinklerView[] = [];
  private readonly figures = new Map<Slot, { figure: SlotFigure; puddle: TransformNode }>();

  async prepare(ctx: Sdk.MinigameContext): Promise<void> {
    this.ctx = ctx;
    const slots = ctx.players.map((player) => player.slot);
    const logic = (this.logic = new RodeoLogic(slots, ctx.rng, ctx.timeLimitMs));
    const stage = (this.stage = new MinigameStage(ctx, 'rodeo'));
    createCamera(stage, 'draufsicht', ARENA);
    await buildArena(stage, ARENA, { ort: 'garten' });
    for (const sprinkler of logic.sprinklers) {
      this.sprinklers.push(await this.createSprinkler(stage, sprinkler));
    }
    for (const player of ctx.players) {
      const figure = await SlotFigure.create(stage, player, { ringRadius: 0.5 });
      const puddle = stage.node('pfuetze', 'pfuetze', player.slot);
      const size = { diameter: 1.5, height: 0.03 };
      const disc = CreateCylinder(stage.name('pfuetze', player.slot), size, stage.scene);
      stage.add(disc, WATER, { emissive: 0.3, alpha: 0.7, parent: puddle });
      puddle.setEnabled(false);
      this.figures.set(player.slot, { figure, puddle });
    }
    this.sync(0);
  }

  start(): void {
    this.running = true;
    this.ctx?.fx.sound('go');
  }

  createBot: NonNullable<Sdk.Minigame['createBot']> = (options) =>
    createRodeoBot(options, () => (this.running ? this.logic : null));

  handleInput(slot: Slot, input: MinigameInput): void {
    if (this.running && input.type === 'move') this.logic?.setStick(slot, input.x, input.y);
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
      const runner = logic.runner(slot);
      if (!runner || runner.hearts <= 0) return 'raus';
      return (logic.isWet(runner) ? 'nass ' : '') + '♥'.repeat(runner.hearts);
    };
    return {
      remainingMs: logic.clock.remainingMs,
      scores: logic.board.hud(status),
      ...(logic.clock.finale && !this.result ? { banner: 'Alle Sprenger an!' } : {}),
    };
  }

  dispose(): void {
    this.running = false;
    for (const { figure } of this.figures.values()) figure.dispose();
    this.figures.clear();
    this.sprinklers.length = 0;
    this.stage?.dispose();
    this.stage = null;
  }

  private onEvent(event: RodeoEvent): void {
    const fx = this.ctx?.fx;
    if (event.type === 'hit') {
      const { runner } = event;
      fx?.sound(runner.hearts > 0 ? 'splash' : 'lose');
      fx?.burst('splash', { x: runner.x, y: 1, z: runner.z }, WATER);
      fx?.shake(0.15);
    } else {
      const sounds = { finale: 'buzz', warn: 'tick', spray: 'whoosh', reverse: 'pop' } as const;
      fx?.sound(sounds[event.type], { volume: 0.6 });
    }
  }

  private finish(): void {
    const { ctx, logic } = this;
    if (!ctx || !logic || this.result) return;
    this.running = false;
    const placements = logic.board.placements();
    const figures = [...this.figures.values()].map(({ figure }) => figure);
    celebrateFigures(placements, figures);
    ctx.fx.sound('win');
    const highlights = logic.highlights(new Map(ctx.players.map((p) => [p.slot, p.name])));
    this.result = { minigameId: INFO.id, placements, ...(highlights.length ? { highlights } : {}) };
  }

  private sync(dt: number): void {
    const logic = this.logic;
    if (!logic) return;
    const now = logic.clock.time;
    for (const sprinkler of logic.sprinklers) {
      const view = this.sprinklers[sprinkler.index];
      if (!view) continue;
      // Babylon dreht um y im Uhrzeigersinn: Winkel in x/z negativ übernehmen.
      view.head.rotation.y = view.jet.rotation.y = -sprinkler.angle;
      // Die Düse des Modells sitzt bei −X: um eine halbe Drehung versetzt, zeigt sie mit dem Strahl.
      view.body.rotation.y = Math.PI - sprinkler.angle;
      view.head.position.y = sprinkler.phase === 'warn' ? Math.abs(Math.sin(now * 18)) * 0.12 : 0;
      view.range.setEnabled(sprinkler.phase !== 'idle');
      view.range.scaling.set(sprinkler.reach, 1, sprinkler.reach);
      view.jet.setEnabled(sprinkler.phase === 'spray');
      view.jet.scaling.x = sprinkler.reach;
    }
    for (const runner of logic.runners) {
      const view = this.figures.get(runner.slot);
      if (!view) continue;
      const out = runner.hearts <= 0;
      view.figure.place(runner.x, runner.z, runner.heading);
      view.puddle.position.set(runner.x, 0.02, runner.z);
      view.puddle.setEnabled(logic.isWet(runner) || out);
      if (out && this.result === null) view.figure.anim.play('sad');
      else {
        // Erste Hälfte der Schonzeit: hingefallen, danach rutscht die Figur weiter.
        const stunned = now < runner.safeUntil - RODEO_RULES.invulnerableS / 2;
        const moving = Math.hypot(runner.vx, runner.vz) > 0.5;
        view.figure.show({ stunned, moving }, dt, this.result !== null);
      }
    }
  }

  private async createSprinkler(stage: MinigameStage, at: Sprinkler): Promise<SprinklerView> {
    const { scene } = stage;
    const key = at.index;
    // Grundkörper in Modell-Maßen (Rückfall ohne Requisiten-Modell): Fuß, Rohr, Sprühbalken, Düse bei −X.
    const sprinkler = stage.prop('rasensprenger', {
      role: 'rasensprenger',
      key,
      fallback: (root) => {
        const size = { diameter: 0.6, height: 0.1 };
        const foot = CreateCylinder(stage.name('fuss', key), size, scene);
        stage.add(foot, '#2f8f4e', { finish: 'lack', parent: root }).position.y = 0.05;
        const pipe = { diameter: 0.14, height: 0.3 };
        const post = CreateCylinder(stage.name('rohr', key), pipe, scene);
        stage.add(post, '#ffd43b', { finish: 'lack', parent: root }).position.y = 0.25;
        const bar = { width: 0.84, height: 0.06, depth: 0.08 };
        const beam = CreateBox(stage.name('balken', key), bar, scene);
        stage.add(beam, '#c9ced6', { finish: 'metall', parent: root }).position.y = 0.41;
        const tip = CreateBox(
          stage.name('spitze', key),
          { width: 0.06, height: 0.1, depth: 0.1 },
          scene,
        );
        stage.add(tip, '#3b3b44', { parent: root }).position.set(-0.39, 0.4, 0);
      },
    });
    const body = sprinkler.root;
    body.position.set(at.x, 0, at.z);
    body.scaling.setAll(SPRINKLER_SCALE);
    await this.createReel(stage, at);
    await stage.pace();
    // Düse: eigener Knoten (nicht unter dem Requisit), roter Zeiger zeigt die Strahlrichtung.
    const head = stage.node('duese', 'duese', key);
    head.position.set(at.x, 0, at.z);
    const arm = CreateBox(stage.name('arm', key), { width: 0.6, height: 0.1, depth: 0.16 }, scene);
    stage.add(arm, '#e8574d', { finish: 'lack', parent: head }).position.set(0.3, 0.95, 0);
    const jet = stage.node('strahl', 'wasserstrahl', key);
    jet.position.set(at.x, 0, at.z);
    const size = { width: 1, height: 0.2, depth: RODEO_RULES.jetHalfWidth * 2 };
    const water = CreateBox(stage.name('wasser', key), size, scene);
    stage
      .add(water, WATER, { emissive: 0.45, alpha: 0.9, parent: jet })
      .position.set(0.5, JET_Y, 0);
    await stage.pace();
    const range = stage.node('reichweite', 'reichweite', key);
    range.position.set(at.x, 0.04, at.z);
    const ring = CreateTorus(
      stage.name('kreis', key),
      { diameter: 2, thickness: 0.035, tessellation: 64 },
      scene,
    );
    stage.add(ring, '#e8f7ff', { emissive: 0.5, alpha: 0.5, parent: range });
    return { body, head, jet, range };
  }

  /** Schlauchtrommel am Rasenrand hinter dem Sprenger, Schlauch am Boden bis zum Sprenger. */
  private async createReel(stage: MinigameStage, at: Sprinkler): Promise<void> {
    const { scene } = stage;
    const key = at.index;
    const out = Math.atan2(at.z, at.x);
    const reelX = Math.cos(out) * REEL_RADIUS;
    const reelZ = Math.sin(out) * REEL_RADIUS;
    await stage.pace();
    const reel = stage.prop('schlauchtrommel', {
      role: 'schlauchtrommel',
      key,
      fallback: (root) => {
        const frame = CreateBox(
          stage.name('gestell', key),
          { width: 0.58, height: 0.06, depth: 0.3 },
          scene,
        );
        stage.add(frame, '#c9ced6', { finish: 'metall', parent: root }).position.y = 0.03;
        const size = { diameter: 0.5, height: 0.42 };
        const drum = CreateCylinder(stage.name('trommel', key), size, scene);
        const mesh = stage.add(drum, '#2f8f4e', { finish: 'lack', parent: root });
        mesh.position.y = 0.34;
        mesh.rotation.z = Math.PI / 2;
      },
    });
    reel.root.position.set(reelX, 0, reelZ);
    // Vorderseite (+Z im Modell) zum Sprenger.
    reel.root.rotation.y = -out - Math.PI / 2;
    reel.root.scaling.setAll(REEL_SCALE);
    const length = Math.hypot(reelX - at.x, reelZ - at.z);
    const size = { diameter: 0.08, height: length, tessellation: 8 };
    const hose = CreateCylinder(stage.name('schlauch', key), size, scene);
    const mesh = stage.add(hose, '#3f8a32', { finish: 'matt' });
    mesh.position.set((reelX + at.x) / 2, 0.04, (reelZ + at.z) / 2);
    mesh.rotation.set(Math.PI / 2, -out + Math.PI / 2, 0);
  }
}

export const rasensprengerRodeo: Sdk.MinigameModule = {
  info: INFO,
  create: () => new RasensprengerRodeo(),
};
