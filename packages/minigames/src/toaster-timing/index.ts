/**
 * Toaster-Timing (MG-033) – Ansicht: vier Arbeitsplatten in der Küche (Eigenbereiche), feste
 * Kamera von vorn. Je Slot ein Toaster (Requisit `toaster`, Zierstreifen in Slot-Farbe), dahinter
 * die Figur. Der Toast (Requisit `toast`) färbt sich mit der Bräunung, springt beim Drücken hoch;
 * Verkohltes qualmt. Logik in `logic.ts`.
 */
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { arenaLayout, type Zone } from '@chaos-party/minigame-kit';
import {
  KitMinigame,
  SLOT_COLOR,
  SlotFigure,
  buildArena,
  createCamera,
  fallbackParts,
  mix,
  type MinigameStage,
  type PropPart,
  type StageProp,
} from '@chaos-party/minigame-kit/babylon';
import type { MinigameInput, Slot } from '@chaos-party/minigame-sdk';
import type * as Sdk from '@chaos-party/minigame-sdk/babylon';
import { ToasterBot } from './bot.ts';
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
/** Requisiten in Spielgröße: Toaster ≈ 1,5 m breit (Modell 0,86 m). */
const SCALE = 1.75;
/** Unterkante des Toasts im Schlitz (Welt); der Toaster ist ≈ 1,1 m hoch. */
const TOAST_Y = 0.5;
/** Grundkörper in Modell-Maßen (Rückfall ohne Requisiten-Modell). */
const TOASTER: readonly PropPart[] = [
  ['box', [0.86, 0.57, 0.46], SLOT_COLOR, [0, 0.285, 0]],
  ['box', [0.8, 0.05, 0.4], '#c9ced6', [0, 0.6, 0], { finish: 'metall' }],
  ['box', [0.07, 0.17, 0.11], '#3b3b44', [0.47, 0.34, 0]],
];
const TOAST: readonly PropPart[] = [
  ['box', [0.38, 0.44, 0.1], BREAD.raw, [0, 0.22, 0], { finish: 'matt', tint: 'zustand' }],
];

interface Station {
  readonly zone: Zone;
  readonly toaster: TransformNode;
  readonly toast: StageProp;
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

class ToasterTiming extends KitMinigame<ToasterLogic, ToasterEvent> {
  private readonly stations = new Map<Slot, Station>();

  constructor() {
    super(INFO, 'toaster', ToasterLogic, ToasterBot);
  }

  protected async build(stage: MinigameStage, _logic: ToasterLogic, ctx: Sdk.MinigameContext) {
    createCamera(stage, 'fest', ARENA, {
      position: { x: 0, y: 10.5, z: -7.6 },
      target: { x: 0, y: 0.6, z: 0.5 },
    });
    await buildArena(stage, ARENA, { ort: 'kueche', players: ctx.players, kulisse: true });
    for (const [index, player] of ctx.players.entries()) {
      const zone = ARENA.zones[index];
      if (zone) this.stations.set(player.slot, await this.createStation(stage, player, zone));
    }
  }

  protected input(slot: Slot, input: MinigameInput, logic: ToasterLogic) {
    return input.type === 'press' && input.button === 'a' ? logic.pop(slot) : null;
  }

  protected scores(logic: ToasterLogic) {
    return logic.board.entries();
  }

  protected override status(slot: Slot, logic: ToasterLogic) {
    const last = logic.toaster(slot)?.last;
    return last ? STATUS[last.result] : undefined;
  }

  protected override banner(logic: ToasterLogic) {
    return logic.clock.finale ? 'Turbo-Toaster!' : undefined;
  }

  protected onEvent(event: ToasterEvent, fx: Sdk.MinigameFx, logic: ToasterLogic): void {
    const now = logic.clock.time;
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

  protected sync(dt: number, logic: ToasterLogic): void {
    const now = logic.clock.time;
    for (const toaster of logic.toasters) {
      const station = this.stations.get(toaster.slot);
      if (!station) continue;
      const toast = station.toast.root;
      const popped = station.poppedAt === null ? null : now - station.poppedAt;
      toast.setEnabled(toaster.loaded || (popped !== null && popped < POP_S));
      const browning = toaster.loaded ? toaster.browning : (toaster.last?.browning ?? 0);
      station.toast.tint('zustand', breadColor(browning), { finish: 'matt' });
      const arc = popped === null ? 0 : Math.sin(Math.min(1, popped / POP_S) * Math.PI) * 1.6;
      toast.position.y = TOAST_Y + (toaster.loaded ? 0 : 0.4) + arc;
      const nervous = toaster.loaded && toaster.browning > TOASTER_RULES.golden + 0.1;
      station.toaster.rotation.z = nervous ? Math.sin(now * 40) * 0.04 : 0;
      const stunned = now - station.burntAt < TOASTER_RULES.burntReloadS;
      const dashing = popped !== null && popped < POP_S;
      station.figure.show({ stunned, dashing, moving: false }, dt, this.over);
    }
  }

  private async createStation(
    stage: MinigameStage,
    player: Sdk.MinigamePlayer,
    zone: Zone,
  ): Promise<Station> {
    const key = player.slot;
    const toaster = stage.prop('toaster', {
      role: 'toaster',
      key,
      akzent: player.color,
      fallback: fallbackParts(stage, 'toaster', TOASTER, key, player.color),
    });
    toaster.root.position.set(zone.x, 0, zone.z - 0.3);
    // Vorderseite (+Z im Modell) zur Kamera.
    toaster.root.rotation.y = Math.PI;
    toaster.root.scaling.setAll(SCALE);
    await stage.pace();
    const toast = stage.prop('toast', {
      role: 'toast',
      key,
      fallback: fallbackParts(stage, 'toast', TOAST, key),
    });
    toast.tint('zustand', BREAD.raw, { finish: 'matt' });
    toast.root.position.set(zone.x, TOAST_Y, zone.z - 0.3);
    toast.root.rotation.y = Math.PI;
    toast.root.scaling.setAll(SCALE);
    toast.root.setEnabled(false);
    const figure = await SlotFigure.create(stage, player, { badgeHeight: 2.2 });
    figure.place(zone.x, zone.z + 0.8, Math.PI);
    this.figures.set(key, figure);
    return { zone, toaster: toaster.root, toast, figure, poppedAt: null, burntAt: -10 };
  }
}

export const toasterTiming: Sdk.MinigameModule = {
  info: INFO,
  create: () => new ToasterTiming(),
};
