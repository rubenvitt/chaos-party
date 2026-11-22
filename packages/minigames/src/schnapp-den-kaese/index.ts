/**
 * Schnapp den Käse (MG-045) – Ansicht: je Slot Mausefalle mit Käsestapel und Figur mit Pfote.
 * Requisiten-GLBs (mausefalle, kaese) haben keinen Ladeweg: Grundkörper.
 */
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder.js';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder.js';
import type { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { arenaLayout, type Zone } from '@chaos-party/minigame-kit';
import {
  MinigameStage,
  SlotFigure,
  buildArena,
  celebrateFigures,
  createCamera,
} from '@chaos-party/minigame-kit/babylon';
import type { MinigameInput, MinigameResult, Slot } from '@chaos-party/minigame-sdk';
import type * as Sdk from '@chaos-party/minigame-sdk/babylon';
import { createKaeseBot } from './bot.ts';
import { SCHNAPP_DEN_KAESE_INFO as INFO } from './info.ts';
import { KAESE_RULES, KaeseLogic, type KaeseEvent, type Trap } from './logic.ts';

const ARENA = arenaLayout({ form: 'eigenbereiche', zoneHalf: 1.5, gap: 0.6 });
const SNAP_S = 0.08;
const WIRE = '#5b6470';
const STATUS = { schnapp: '', gezwickt: 'gezwickt!', leer: 'zu spät' } as const;
const FX: Record<KaeseEvent['type'], readonly [Sdk.SoundId, number, Sdk.VfxId | null]> = {
  land: ['tick', 0.3, null],
  twitch: ['bump', 0.5, null],
  reach: ['whoosh', 0.4, null],
  schnapp: ['coin', 1, 'sparkle'],
  gezwickt: ['hit', 0.8, 'stars'],
  leer: ['bump', 0.8, 'impact'],
};

type Station = Record<'trap' | 'bar' | 'cheese' | 'paw', TransformNode> & {
  readonly zone: Zone;
  readonly figure: SlotFigure;
};

class SchnappDenKaese implements Sdk.Minigame {
  private ctx: Sdk.MinigameContext | null = null;
  private stage: MinigameStage | null = null;
  private logic: KaeseLogic | null = null;
  private result: MinigameResult | null = null;
  private running = false;
  private readonly stations = new Map<Slot, Station>();

  async prepare(ctx: Sdk.MinigameContext): Promise<void> {
    this.ctx = ctx;
    const slots = ctx.players.map((player) => player.slot);
    this.logic = new KaeseLogic(slots, ctx.rng, ctx.timeLimitMs);
    const stage = (this.stage = new MinigameStage(ctx, 'kaese'));
    createCamera(stage, 'schraeg', ARENA);
    await buildArena(stage, ARENA, { ort: 'kueche', players: ctx.players });
    for (const [index, player] of ctx.players.entries()) {
      const zone = ARENA.zones[index];
      if (zone) this.stations.set(player.slot, await this.createStation(stage, player, zone));
    }
    this.sync(0);
  }

  start(): void {
    this.running = true;
    this.ctx?.fx.sound('go');
  }

  createBot: NonNullable<Sdk.Minigame['createBot']> = (options) =>
    createKaeseBot(options, () => (this.running ? this.logic : null));

  handleInput(slot: Slot, input: MinigameInput): void {
    if (!this.running || input.type !== 'press' || input.button !== 'a') return;
    const event = this.logic?.grab(slot);
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
      const trap = logic.trap(slot);
      const last = trap?.last;
      if (last && logic.clock.time - last.at < 1.2) return STATUS[last.result] || `+${last.points}`;
      return trap?.phase === 'cheese' ? `${logic.slices(trap)} Scheiben` : undefined;
    };
    return { remainingMs: logic.clock.remainingMs, scores: logic.board.hud(status) };
  }

  dispose(): void {
    this.running = false;
    for (const station of this.stations.values()) station.figure.dispose();
    this.stations.clear();
    this.stage?.dispose();
    this.stage = null;
  }

  private onEvent(event: KaeseEvent): void {
    const fx = this.ctx?.fx;
    const station = this.stations.get(event.trap.slot);
    if (!fx || !station) return;
    const at = { x: station.zone.x - 0.4, y: 0.6, z: station.zone.z };
    const [sound, volume, burst] = FX[event.type];
    const pitch = event.type === 'schnapp' ? 0.8 + event.trap.grabbed / 20 : 1;
    fx.sound(sound, { volume, pitch });
    if (burst) fx.burst(burst, at);
    if (event.type === 'gezwickt') fx.shake(0.2);
  }

  private finish(): void {
    const { ctx, logic } = this;
    if (!ctx || !logic || this.result) return;
    this.running = false;
    const placements = logic.board.placements();
    const figures = [...this.stations.values()].map((station) => station.figure);
    celebrateFigures(placements, figures);
    ctx.fx.sound('win');
    const highlights = logic.highlights(new Map(ctx.players.map((p) => [p.slot, p.name])));
    this.result = { minigameId: INFO.id, placements, ...(highlights.length ? { highlights } : {}) };
  }

  private sync(dt: number): void {
    const logic = this.logic;
    if (!logic) return;
    const now = logic.clock.time;
    for (const trap of logic.traps) {
      const station = this.stations.get(trap.slot);
      if (!station) continue;
      const cheese = trap.phase === 'cheese';
      const twitching = cheese && now - trap.twitchAt < 0.25;
      const hop = Math.abs(Math.sin((now - trap.twitchAt) * 25)) * 0.12;
      station.trap.position.y = twitching ? hop : 0;
      station.bar.rotation.x = twitching ? -0.35 : barAngle(trap, now);
      station.cheese.setEnabled(cheese);
      if (cheese) station.cheese.scaling.y = logic.slices(trap);
      const reach = cheese && trap.grabEnd !== null;
      const stunned = trap.phase === 'pinched';
      const started = (trap.grabEnd ?? 0) - KAESE_RULES.grabS;
      const p = stunned ? 1 : reach ? Math.min(1, (now - started) / KAESE_RULES.grabS) : 0;
      const { x, z } = station.zone;
      station.paw.position.set(x + 0.55 - p * 0.95, 0.85 - p * 0.45, z - p * 0.15);
      station.figure.show({ stunned, dashing: reach, moving: false }, dt, this.result !== null);
    }
  }

  private async createStation(
    stage: MinigameStage,
    player: Sdk.MinigamePlayer,
    zone: Zone,
  ): Promise<Station> {
    const slot = player.slot;
    const trap = stage.node('falle', 'mausefalle', slot);
    trap.position.set(zone.x - 0.4, 0, zone.z);
    trap.scaling.setAll(1.2);
    box(stage, trap, 'brett', [1.4, 0.1, 0.9], '#dcae78', 'matt').position.y = 0.08;
    box(stage, trap, 'wippe', [0.7, 0.03, 0.5], '#c9ced6', 'metall').position.set(0, 0.14, -0.15);
    await stage.pace();
    const bar = stage.node('buegel', 'buegel', slot);
    bar.parent = trap;
    bar.position.y = 0.16;
    box(stage, bar, 'draht', [1.2, 0.09, 0.09], WIRE, 'metall').position.z = 0.42;
    box(stage, bar, 'draht', [0.09, 0.09, 0.42], WIRE, 'metall').position.set(-0.57, 0, 0.21);
    box(stage, bar, 'draht', [0.09, 0.09, 0.42], WIRE, 'metall').position.set(0.57, 0, 0.21);
    const cheese = stage.node('kaese', 'kaese', slot);
    cheese.parent = trap;
    cheese.position.set(0, 0.16, -0.15);
    box(stage, cheese, 'scheibe', [0.6, 0.09, 0.4], '#ffcf33', 'matt').position.y = 0.045;
    await stage.pace();
    const paw = stage.node('pfote', 'pfote', slot);
    const ball = CreateSphere(stage.name('ballen', slot), { diameter: 0.34 }, stage.scene);
    stage.add(ball, player.color, { finish: 'stoff', parent: paw }).scaling.set(1, 0.7, 1.2);
    const figure = await SlotFigure.create(stage, player, { badgeHeight: 2.2 });
    figure.place(zone.x + 0.95, zone.z + 0.1, -Math.PI / 2);
    return { zone, trap, bar, cheese, paw, figure };
  }
}

/** Kasten in `hex` an `parent` (Teile von Falle und Käse). */
function box(
  stage: MinigameStage,
  parent: TransformNode,
  name: string,
  [width, height, depth]: readonly [number, number, number],
  hex: string,
  finish: Sdk.LookFinish,
): Mesh {
  const mesh = CreateBox(stage.name(name, stage.count), { width, height, depth }, stage.scene);
  return stage.add(mesh, hex, { finish, parent });
}

/** Bügel offen (0) oder zugeklappt (−π, über die Oberseite nach vorn). */
function barAngle(trap: Trap, now: number): number {
  const snapped =
    trap.phase === 'pinched' || (trap.phase === 'wait' && trap.last?.result === 'leer');
  return snapped && trap.last ? -Math.PI * Math.min(1, (now - trap.last.at) / SNAP_S) : 0;
}

export const schnappDenKaese: Sdk.MinigameModule = {
  info: INFO,
  create: () => new SchnappDenKaese(),
};
