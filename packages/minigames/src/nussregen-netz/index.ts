/**
 * Nussregen-Netz (MG-001) – Ansicht: Garten von der Seite unter einer Baumkrone mit drei
 * Eichhörnchen. Nüsse fliegen sichtbar im Bogen (Schatten am Landepunkt), jede Figur trägt
 * einen Kescher in Slot-Farbe: im Weit-Schwung gestreckt, lahm am Boden. Logik in `logic.ts`.
 */
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder.js';
import { CreateDisc } from '@babylonjs/core/Meshes/Builders/discBuilder.js';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder.js';
import { CreateTorus } from '@babylonjs/core/Meshes/Builders/torusBuilder.js';
import type { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { arenaLayout, warningProgress } from '@chaos-party/minigame-kit';
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
import { createNussBot } from './bot.ts';
import { NUSSREGEN_NETZ_INFO as INFO } from './info.ts';
import {
  NUSS_RULES as R,
  NussLogic,
  SQUIRRELS,
  netX,
  nutPosition,
  type NussEvent,
} from './logic.ts';

const ARENA = arenaLayout({ form: 'eckig', halfX: R.halfX + 0.6, halfZ: 1.2 });
const BROWN = '#8a5a3c';

interface Player {
  readonly figure: SlotFigure;
  readonly net: TransformNode;
  readonly stink: TransformNode;
}

class NussregenNetz implements Sdk.Minigame {
  private ctx: Sdk.MinigameContext | null = null;
  private stage: MinigameStage | null = null;
  private logic: NussLogic | null = null;
  private result: MinigameResult | null = null;
  private running = false;
  private readonly players = new Map<Slot, Player>();
  private readonly squirrels: TransformNode[] = [];
  private readonly thrownAt = SQUIRRELS.map(() => -10);
  /** Gute bzw. faule Nüsse und die Schatten am Landepunkt (je eigener Rollen-Knoten). */
  private readonly pools = [false, true].map((rotten) => new NodePool(() => this.nut(rotten)));
  private readonly shadows = new NodePool(() => this.shadow());

  async prepare(ctx: Sdk.MinigameContext): Promise<void> {
    this.ctx = ctx;
    const slots = ctx.players.map((player) => player.slot);
    this.logic = new NussLogic(slots, ctx.rng, ctx.timeLimitMs);
    const stage = (this.stage = new MinigameStage(ctx, 'nuss'));
    // Näher und höher als die Vorlage: Figuren und Baumkrone sollen das Bild füllen.
    const { camera } = createCamera(stage, 'seite', ARENA);
    camera.radius = 14.5;
    camera.target.y = 3;
    await buildArena(stage, ARENA, { ort: 'garten' });
    await this.buildTree(stage);
    for (const player of ctx.players) this.players.set(player.slot, await this.addPlayer(player));
    for (const pool of [...this.pools, this.shadows]) await pool.warm(stage, 5);
    this.sync(0);
  }

  start(): void {
    this.running = true;
    this.ctx?.fx.sound('go');
  }

  createBot: NonNullable<Sdk.Minigame['createBot']> = (options) =>
    createNussBot(options, () => (this.running ? this.logic : null));

  handleInput(slot: Slot, input: MinigameInput): void {
    if (!this.running || !this.logic) return;
    if (input.type === 'move') this.logic.setStick(slot, input.x);
    else if (input.type === 'press' && input.button === 'a' && this.logic.swing(slot)) {
      this.ctx?.fx.sound('whoosh');
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
    const status = (slot: Slot) => {
      const catcher = logic.catcher(slot);
      if (catcher && now < catcher.lameUntil) return 'lahm';
      return catcher && now < catcher.stinkUntil ? 'stinkt!' : undefined;
    };
    return {
      remainingMs: logic.clock.remainingMs,
      scores: logic.board.hud(status),
      ...(logic.clock.finale && !this.result ? { banner: 'Nusssturm!' } : {}),
    };
  }

  dispose(): void {
    this.running = false;
    for (const player of this.players.values()) player.figure.dispose();
    this.players.clear();
    for (const pool of [...this.pools, this.shadows]) pool.clear();
    this.stage?.dispose();
    this.stage = null;
  }

  private onEvent(event: NussEvent): void {
    const fx = this.ctx?.fx;
    const now = this.logic?.clock.time ?? 0;
    if (!fx) return;
    if (event.type === 'finale') {
      fx.sound('buzz');
      return;
    }
    const { nut } = event;
    const pool = this.pools[nut.rotten ? 1 : 0];
    if (event.type === 'spawn') {
      this.thrownAt[nut.from] = now;
      pool?.acquire(nut.id);
      this.shadows.acquire(nut.id).position.set(nut.x, 0.03, 0);
      return;
    }
    pool?.release(nut.id);
    this.shadows.release(nut.id);
    const at = { ...nutPosition(nut, now), z: 0 };
    if (event.type !== 'catch') fx.sound('pop', { volume: 0.35, pitch: 0.7 });
    else if (nut.rotten) {
      fx.sound('buzz', { volume: 0.7 });
      fx.burst('smoke', at, '#9bbf3a');
    } else {
      fx.sound('coin', { pitch: 0.7 + event.points / 25 });
      if (event.points >= 9) fx.burst('sparkle', at);
    }
  }

  private finish(): void {
    const { ctx, logic } = this;
    if (!ctx || !logic || this.result) return;
    this.running = false;
    const placements = logic.board.placements();
    celebrateFigures(
      placements,
      [...this.players.values()].map((player) => player.figure),
    );
    for (const pool of [...this.pools, this.shadows]) pool.releaseAll();
    ctx.fx.sound('win');
    const highlights = logic.highlights(new Map(ctx.players.map((p) => [p.slot, p.name])));
    this.result = { minigameId: INFO.id, placements, ...(highlights.length ? { highlights } : {}) };
  }

  private sync(dt: number): void {
    const logic = this.logic;
    if (!logic) return;
    const now = logic.clock.time;
    const over = this.result !== null;
    for (const catcher of logic.catchers) {
      const player = this.players.get(catcher.slot);
      if (!player) continue;
      const swinging = now < catcher.swingUntil;
      const lame = !swinging && now < catcher.lameUntil;
      const moving = now >= catcher.lameUntil && Math.abs(catcher.stickX) > 0.15;
      player.figure.place(catcher.x, catcher.z, (catcher.facing * Math.PI) / 2);
      player.figure.show({ stunned: lame, dashing: swinging, moving }, dt, over);
      // Weit-Schwung: Kescher über den ganzen Schwungbereich gestreckt; lahm: am Boden.
      const swingX = catcher.x + (catcher.facing * R.swingReach) / 2;
      player.net.position.set(swinging ? swingX : netX(catcher), lame ? -0.6 : 0, catcher.z);
      player.net.scaling.x = swinging ? R.swingReach / 1.2 : 1;
      player.net.rotation.z = lame ? catcher.facing * 0.5 : 0;
      player.stink.setEnabled(now < catcher.stinkUntil && !over);
      player.stink.position.set(catcher.x, 2.1, catcher.z);
      player.stink.rotation.y += dt * 2;
    }
    for (const nut of logic.nuts) {
      const node = this.pools[nut.rotten ? 1 : 0]?.get(nut.id);
      const at = nutPosition(nut, now);
      node?.position.set(at.x, at.y, at.z);
      if (node) node.rotation.z = now * (nut.rotten ? 9 : 4);
      this.shadows.get(nut.id)?.scaling.setAll(0.4 + warningProgress(nut, now) * 0.8);
    }
    for (const [index, squirrel] of this.squirrels.entries()) {
      const since = now - (this.thrownAt[index] ?? -10);
      squirrel.rotation.z = since < 0.35 ? Math.sin((since / 0.35) * Math.PI) * 0.6 : 0;
      squirrel.position.y = R.crownY - 0.3 + Math.abs(Math.sin(now * 3 + index)) * 0.08;
    }
  }

  private need(): MinigameStage {
    if (!this.stage) throw new Error('Nussregen-Netz: Bühne fehlt');
    return this.stage;
  }

  /** Kugel (gestaucht über `scale`) an `parent`. */
  private ball(parent: TransformNode, hex: string, scale: number[], at = [0, 0, 0], alpha = 1) {
    const stage = this.need();
    const mesh = CreateSphere(stage.name('kugel', stage.count), { segments: 10 }, stage.scene);
    const ball: Mesh = stage.add(mesh, hex, { parent, alpha, finish: 'matt' });
    ball.scaling.set(scale[0] ?? 1, scale[1] ?? 1, scale[2] ?? 1);
    ball.position.set(at[0] ?? 0, at[1] ?? 0, at[2] ?? 0);
    return ball;
  }

  private async buildTree(stage: MinigameStage): Promise<void> {
    const tree = stage.node('baum');
    const trunk = CreateCylinder(stage.name('stamm'), { height: 7, diameter: 1.4 }, stage.scene);
    stage.add(trunk, BROWN, { parent: tree, finish: 'matt' }).position.set(-9.5, 3.5, 3);
    for (let index = 0; index < 9; index++) {
      const leaf = ['#4f9a3a', '#5fae45', '#3f8a32'][index % 3] ?? '#4f9a3a';
      this.ball(tree, leaf, [4.2, 2.6, 2.6], [-10 + index * 2.5, 6.6 + (index % 2) * 0.7, 2.8]);
    }
    for (const [index, x] of SQUIRRELS.entries()) {
      await stage.pace();
      const branch = CreateCylinder(stage.name('ast'), { height: 3, diameter: 0.35 }, stage.scene);
      const mesh = stage.add(branch, BROWN, { parent: tree, finish: 'matt' });
      mesh.position.set(x, R.crownY - 0.75, 1);
      mesh.rotation.set(Math.PI / 2, 0.4, 0);
      const squirrel = stage.node('eichhoernchen', 'eichhoernchen', index);
      squirrel.position.set(x, R.crownY - 0.3, 0.6);
      squirrel.scaling.setAll(1.5);
      this.ball(squirrel, '#c8662a', [0.55, 0.7, 0.5]);
      this.ball(squirrel, '#d9773a', [0.42, 0.42, 0.42], [0.18, 0.5, -0.05]);
      this.ball(squirrel, '#e08a48', [0.4, 0.95, 0.4], [-0.4, 0.45, 0.05]).rotation.z = 0.5;
      for (const side of [-1, 1])
        this.ball(squirrel, '#1d1410', [0.09, 0.09, 0.09], [0.18 + side * 0.1, 0.56, -0.24]);
      this.squirrels.push(squirrel);
    }
  }

  private async addPlayer(player: Sdk.MinigamePlayer): Promise<Player> {
    const stage = this.need();
    const { slot, color } = player;
    const figure = await SlotFigure.create(stage, player, { badgeHeight: 2.5 });
    const net = stage.node('kescher', 'kescher', slot);
    const size = { diameter: R.reach * 2, thickness: 0.1, tessellation: 24 };
    const hoop = CreateTorus(stage.name('reif', slot), size, stage.scene);
    stage.add(hoop, color, { parent: net, emissive: 0.25 }).position.y = R.netY;
    const shape = { height: 0.5, diameterTop: R.reach * 2, diameterBottom: 0.3, tessellation: 16 };
    const bag = CreateCylinder(stage.name('netz', slot), shape, stage.scene);
    stage.add(bag, '#ffffff', { parent: net, alpha: 0.55 }).position.y = R.netY - 0.25;
    const stink = stage.node('stinkwolke', 'stinkwolke', slot);
    for (let index = 0; index < 3; index++) {
      const at = [Math.cos(index * 2.1) * 0.35, index * 0.12, Math.sin(index * 2.1) * 0.35];
      this.ball(stink, '#9bbf3a', [0.35, 0.35, 0.35], at, 0.7);
    }
    stink.setEnabled(false);
    return { figure, net, stink };
  }

  /** Eichel mit Hut; die faule ist grün, ohne Hut, mit Flecken (Form, nicht nur Farbe). */
  private nut(rotten: boolean): TransformNode {
    const stage = this.need();
    const nut = stage.node('nuss', rotten ? 'eichel-faul' : 'eichel');
    nut.scaling.setAll(1.6);
    this.ball(nut, rotten ? '#7f8f3a' : '#b0703a', [0.42, 0.52, 0.42]);
    if (!rotten) this.ball(nut, '#5b3a22', [0.48, 0.24, 0.48], [0, 0.22, 0]);
    else
      for (const side of [-1, 1])
        this.ball(nut, '#3d4a1c', [0.14, 0.14, 0.14], [side * 0.16, 0.08, -0.14]);
    return nut;
  }

  private shadow(): TransformNode {
    const stage = this.need();
    const shadow = stage.node('schatten', 'nussschatten');
    const disc = CreateDisc(stage.name('scheibe', stage.count), { radius: 0.4 }, stage.scene);
    stage.add(disc, '#3a2a1c', { parent: shadow, alpha: 0.4 }).rotation.x = Math.PI / 2;
    return shadow;
  }
}

export const nussregenNetz: Sdk.MinigameModule = {
  info: INFO,
  create: () => new NussregenNetz(),
};
