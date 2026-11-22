/**
 * Toaster-Timing (MG-033) – Ansicht: vier Arbeitsplatten in der Küche (Eigenbereiche), feste
 * Kamera von vorn. Je Slot ein Toaster in Slot-Farbe, dahinter die Figur. Der Toast färbt sich
 * mit der Bräunung, springt beim Drücken hoch; Verkohltes qualmt. Logik in `logic.ts`.
 */
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder.js';
import type { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { arenaLayout, type Zone } from '@chaos-party/minigame-kit';
import {
  MinigameStage,
  SlotFigure,
  buildArena,
  celebrateFigures,
  createCamera,
  mix,
} from '@chaos-party/minigame-kit/babylon';
import type { MinigameInput, MinigameResult, Slot } from '@chaos-party/minigame-sdk';
import type * as Sdk from '@chaos-party/minigame-sdk/babylon';
import { createToasterBot } from './bot.ts';
import { TOASTER_TIMING_INFO as INFO } from './info.ts';
import { TOASTER_RULES, ToasterLogic, type ToastResult, type ToasterEvent } from './logic.ts';

const ARENA = arenaLayout({ form: 'eigenbereiche', zoneHalf: 1.5, gap: 0.6 });
const STATUS: Record<ToastResult, string> = {
  golden: 'goldbraun!',
  good: 'lecker',
  pale: 'blass',
  burnt: 'verkohlt',
};
/** Brotfarbe von roh über goldbraun bis Kohle, in Stufen (geteilte Materialien). */
const BREAD = { raw: '#f3e2b8', golden: '#d08a2e', coal: '#2e1e14' } as const;
const SHADES = 10;
const POP_S = 0.55;
const TOAST_Y = 0.95;

interface Station {
  readonly zone: Zone;
  readonly toaster: TransformNode;
  readonly toast: TransformNode;
  readonly bread: Mesh;
  figure: SlotFigure;
  /** Seit wann der Toast in der Luft ist (`null` = steckt oder weg). */
  poppedAt: number | null;
  burntAt: number;
}

function breadColor(browning: number): string {
  const level = Math.round(Math.min(1, browning / TOASTER_RULES.burnt) * SHADES) / SHADES;
  const golden = TOASTER_RULES.golden / TOASTER_RULES.burnt;
  return level <= golden
    ? mix(BREAD.raw, BREAD.golden, level / golden)
    : mix(BREAD.golden, BREAD.coal, (level - golden) / (1 - golden));
}

class ToasterTiming implements Sdk.Minigame {
  private ctx: Sdk.MinigameContext | null = null;
  private stage: MinigameStage | null = null;
  private logic: ToasterLogic | null = null;
  private result: MinigameResult | null = null;
  private running = false;
  private readonly stations = new Map<Slot, Station>();

  async prepare(ctx: Sdk.MinigameContext): Promise<void> {
    this.ctx = ctx;
    this.logic = new ToasterLogic(
      ctx.players.map((player) => player.slot),
      ctx.rng,
      ctx.timeLimitMs,
    );
    const stage = (this.stage = new MinigameStage(ctx, 'toaster'));
    createCamera(stage, 'fest', ARENA, {
      position: { x: 0, y: 10.5, z: -7.6 },
      target: { x: 0, y: 0.6, z: 0.5 },
    });
    await buildArena(stage, ARENA, { ort: 'kueche', players: ctx.players });
    for (const [index, player] of ctx.players.entries()) {
      const zone = ARENA.zones[index];
      if (!zone) continue;
      this.stations.set(player.slot, await this.createStation(stage, player, zone));
    }
    this.sync(0);
  }

  start(): void {
    this.running = true;
    this.ctx?.fx.sound('go');
  }

  createBot: NonNullable<Sdk.Minigame['createBot']> = (options) =>
    createToasterBot(options, () => (this.running ? this.logic : null));

  handleInput(slot: Slot, input: MinigameInput): void {
    if (!this.running || !this.logic) return;
    if (input.type !== 'press' || input.button !== 'a') return;
    const event = this.logic.pop(slot);
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
      const last = logic.toaster(slot)?.last;
      return last ? STATUS[last.result] : undefined;
    };
    return {
      remainingMs: logic.clock.remainingMs,
      scores: logic.board.hud(status),
      ...(logic.clock.finale && !this.result ? { banner: 'Turbo-Toaster!' } : {}),
    };
  }

  dispose(): void {
    this.running = false;
    for (const station of this.stations.values()) station.figure.dispose();
    this.stations.clear();
    this.stage?.dispose();
    this.stage = null;
  }

  private onEvent(event: ToasterEvent): void {
    const fx = this.ctx?.fx;
    const now = this.logic?.clock.time ?? 0;
    if (!fx) return;
    if (event.type === 'finale') {
      fx.sound('buzz');
      return;
    }
    const station = this.stations.get(event.slot);
    if (!station) return;
    const at = { x: station.zone.x, y: TOAST_Y + 0.8, z: station.zone.z };
    if (event.type === 'load') {
      station.poppedAt = null;
      fx.sound('tick', { volume: 0.4 });
    } else if (event.type === 'pop') {
      station.poppedAt = now;
      fx.sound(event.result === 'golden' ? 'coin' : 'pop', { pitch: 0.8 + event.points / 25 });
      if (event.result === 'golden') fx.burst('sparkle', at);
    } else {
      station.burntAt = now;
      fx.sound('buzz', { volume: 0.7 });
      fx.burst('smoke', at);
    }
  }

  private finish(): void {
    const { ctx, logic } = this;
    if (!ctx || !logic || this.result) return;
    this.running = false;
    const placements = logic.board.placements();
    celebrateFigures(
      placements,
      [...this.stations.values()].map((station) => station.figure),
    );
    ctx.fx.sound('win');
    const highlights = logic.highlights(new Map(ctx.players.map((p) => [p.slot, p.name])));
    this.result = { minigameId: INFO.id, placements, ...(highlights.length ? { highlights } : {}) };
  }

  private sync(dt: number): void {
    const { logic, stage } = this;
    if (!logic || !stage) return;
    const now = logic.clock.time;
    for (const toaster of logic.toasters) {
      const station = this.stations.get(toaster.slot);
      if (!station) continue;
      const { toast, bread } = station;
      const popped = station.poppedAt === null ? null : now - station.poppedAt;
      toast.setEnabled(toaster.loaded || (popped !== null && popped < POP_S));
      const browning = toaster.loaded ? toaster.browning : (toaster.last?.browning ?? 0);
      bread.material = stage.material(breadColor(browning), { finish: 'matt' });
      const arc = popped === null ? 0 : Math.sin(Math.min(1, popped / POP_S) * Math.PI) * 1.6;
      toast.position.y = TOAST_Y + (toaster.loaded ? 0 : 0.4) + arc;
      const nervous = toaster.loaded && toaster.browning > TOASTER_RULES.golden + 0.1;
      station.toaster.rotation.z = nervous ? Math.sin(now * 40) * 0.04 : 0;
      const stunned = now - station.burntAt < TOASTER_RULES.burntReloadS;
      station.figure.show(
        { stunned, dashing: popped !== null && popped < POP_S, moving: false },
        dt,
        this.result !== null,
      );
    }
  }

  private async createStation(
    stage: MinigameStage,
    player: Sdk.MinigamePlayer,
    zone: Zone,
  ): Promise<Station> {
    const { scene } = stage;
    const toaster = stage.node('toaster', 'toaster', player.slot);
    toaster.position.set(zone.x, 0, zone.z - 0.3);
    const body = CreateBox(
      stage.name('gehaeuse', player.slot),
      { width: 1.5, height: 1, depth: 0.8 },
      scene,
    );
    stage.add(body, player.color, { finish: 'lack', parent: toaster }).position.y = 0.5;
    const top = CreateBox(
      stage.name('deckel', player.slot),
      { width: 1.4, height: 0.08, depth: 0.7 },
      scene,
    );
    stage.add(top, '#c9ced6', { finish: 'metall', parent: toaster }).position.y = 1.02;
    const lever = CreateBox(
      stage.name('hebel', player.slot),
      { width: 0.12, height: 0.3, depth: 0.2 },
      scene,
    );
    const leverMesh = stage.add(lever, '#3b3b44', { parent: toaster });
    leverMesh.position.set(0.82, 0.6, 0);
    await stage.pace();
    const holder = stage.node('toast', 'toast', player.slot);
    holder.position.set(zone.x, 0, zone.z - 0.3);
    const bread = CreateBox(
      stage.name('brot', player.slot),
      { width: 1.05, height: 0.9, depth: 0.24 },
      scene,
    );
    stage.add(bread, BREAD.raw, { finish: 'matt', parent: holder });
    holder.setEnabled(false);
    const figure = await SlotFigure.create(stage, player, { badgeHeight: 2.2 });
    figure.place(zone.x, zone.z + 0.8, Math.PI);
    return { zone, toaster, toast: holder, bread, figure, poppedAt: null, burntAt: -10 };
  }
}

export const toasterTiming: Sdk.MinigameModule = {
  info: INFO,
  create: () => new ToasterTiming(),
};
