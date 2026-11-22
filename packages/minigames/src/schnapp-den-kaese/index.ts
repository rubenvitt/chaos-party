/**
 * Schnapp den Käse (MG-045) – Ansicht: je Slot Mausefalle (Requisit `mausefalle`, längs zur Figur)
 * mit Käsestapel (Requisit `kaese`) und Figur mit Pfote. Der Bügel klappt und bleibt deshalb ein
 * eigener Knoten aus Grundkörpern.
 */
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { arenaLayout, type Zone } from '@chaos-party/minigame-kit';
import {
  KitMinigame,
  SLOT_COLOR,
  SlotFigure,
  buildArena,
  buildProp,
  createCamera,
  fallbackParts,
  type MinigameStage,
  type PropPart,
  type StageProp,
} from '@chaos-party/minigame-kit/babylon';
import type { MinigameInput, Slot } from '@chaos-party/minigame-sdk';
import type * as Sdk from '@chaos-party/minigame-sdk/babylon';
import { KaeseBot } from './bot.ts';
import { SCHNAPP_DEN_KAESE_INFO as INFO } from './info.ts';
import { KAESE_RULES, KaeseLogic, type KaeseEvent, type Trap } from './logic.ts';

const ARENA = arenaLayout({ form: 'eigenbereiche', zoneHalf: 1.5, gap: 0.6 });
const SNAP_S = 0.08;
const WIRE = '#5b6470';
/** Bügel im Silber des Modells: offen deckt er sich mit dem gespannten Bügel des Modells. */
const STEEL = '#c9ced6';
/** Falle in Spielgröße: ≈ 1,6 m lang (Modell 0,8 m). */
const TRAP_SCALE = 2;
/** Käse: Höhe je Scheibe als Anteil der Modellhöhe (0,2 m), voller Stapel ≈ 0,9 m hoch. */
const SLICE_Y = 0.22;
const STATUS = { schnapp: '', gezwickt: 'gezwickt!', leer: 'zu spät' } as const;
const FX: Record<KaeseEvent['type'], readonly [Sdk.SoundId, number, Sdk.VfxId | null]> = {
  land: ['tick', 0.3, null],
  twitch: ['bump', 0.5, null],
  reach: ['whoosh', 0.4, null],
  schnapp: ['coin', 1, 'sparkle'],
  gezwickt: ['hit', 0.8, 'stars'],
  leer: ['bump', 0.8, 'impact'],
};

const metal = { finish: 'metall' } as const;
/**
 * Grundkörper in Modell-Maßen (Rückfall ohne Requisiten-Modell): vorn (+Z) liegt der gespannte
 * Bügel, hinten (−Z) die Wippe mit dem Köder. Der Bügel klappt und ist immer Grundkörper.
 */
const PARTS = {
  mausefalle: [
    ['box', [0.42, 0.06, 0.8], '#dcae78', [0, 0.03, 0], { finish: 'matt' }],
    ['box', [0.2, 0.015, 0.2], STEEL, [0, 0.068, -0.2], metal],
    ['box', [0.3, 0.07, 0.07], WIRE, [0, 0.095, 0.02], metal],
  ],
  buegel: [
    ['box', [0.4, 0.025, 0.025], STEEL, [0, 0, 0.355], metal],
    ['box', [0.025, 0.025, 0.35], STEEL, [-0.19, 0, 0.18], metal],
    ['box', [0.025, 0.025, 0.35], STEEL, [0.19, 0, 0.18], metal],
  ],
  kaese: [['box', [0.32, 0.2, 0.22], '#ffcf33', [0, 0.1, 0], { finish: 'matt' }]],
  pfote: [['ball', [0.34], SLOT_COLOR, [], { finish: 'stoff', scale: [1, 0.7, 1.2] }]],
} as const satisfies Record<string, readonly PropPart[]>;

type Station = Record<'trap' | 'bar' | 'paw', TransformNode> & {
  readonly cheese: StageProp;
  readonly zone: Zone;
  readonly figure: SlotFigure;
};

class SchnappDenKaese extends KitMinigame<KaeseLogic, KaeseEvent> {
  private readonly stations = new Map<Slot, Station>();

  constructor() {
    super(INFO, 'kaese', KaeseLogic, KaeseBot);
  }

  protected async build(stage: MinigameStage, _logic: KaeseLogic, ctx: Sdk.MinigameContext) {
    createCamera(stage, 'schraeg', ARENA);
    await buildArena(stage, ARENA, { ort: 'kueche', players: ctx.players });
    for (const [index, player] of ctx.players.entries()) {
      const zone = ARENA.zones[index];
      if (zone) this.stations.set(player.slot, await this.createStation(stage, player, zone));
    }
  }

  protected input(slot: Slot, input: MinigameInput, logic: KaeseLogic) {
    return input.type === 'press' && input.button === 'a' ? logic.grab(slot) : null;
  }

  protected scores(logic: KaeseLogic) {
    return logic.board.entries();
  }

  protected override status(slot: Slot, logic: KaeseLogic) {
    const trap = logic.trap(slot);
    const last = trap?.last;
    if (last && logic.clock.time - last.at < 1.2) return STATUS[last.result] || `+${last.points}`;
    return trap?.phase === 'cheese' ? `${logic.slices(trap)} Scheiben` : undefined;
  }

  protected onEvent(event: KaeseEvent, fx: Sdk.MinigameFx): void {
    const station = this.stations.get(event.trap.slot);
    if (!station) return;
    const at = { x: station.zone.x - 0.4, y: 0.6, z: station.zone.z };
    const [sound, volume, burst] = FX[event.type];
    const pitch = event.type === 'schnapp' ? 0.8 + event.trap.grabbed / 20 : 1;
    fx.sound(sound, { volume, pitch });
    if (burst) fx.burst(burst, at);
    if (event.type === 'gezwickt') fx.shake(0.2);
  }

  protected sync(dt: number, logic: KaeseLogic): void {
    const now = logic.clock.time;
    for (const trap of logic.traps) {
      const station = this.stations.get(trap.slot);
      if (!station) continue;
      const cheese = trap.phase === 'cheese';
      const twitching = cheese && now - trap.twitchAt < 0.25;
      const hop = Math.abs(Math.sin((now - trap.twitchAt) * 25)) * 0.12;
      station.trap.position.y = twitching ? hop : 0;
      station.bar.rotation.x = twitching ? -0.35 : barAngle(trap, now);
      station.cheese.root.setEnabled(cheese);
      if (cheese) station.cheese.root.scaling.y = SLICE_Y * logic.slices(trap);
      const reach = cheese && trap.grabEnd !== null;
      const stunned = trap.phase === 'pinched';
      const started = (trap.grabEnd ?? 0) - KAESE_RULES.grabS;
      const p = stunned ? 1 : reach ? Math.min(1, (now - started) / KAESE_RULES.grabS) : 0;
      const { x, z } = station.zone;
      station.paw.position.set(x + 0.55 - p * 0.95, 0.85 - p * 0.45, z - p * 0.15);
      station.figure.show({ stunned, dashing: reach, moving: false }, dt, this.over);
    }
  }

  private async createStation(
    stage: MinigameStage,
    player: Sdk.MinigamePlayer,
    zone: Zone,
  ): Promise<Station> {
    const slot = player.slot;
    const trap = stage.prop('mausefalle', {
      role: 'mausefalle',
      key: slot,
      fallback: fallbackParts(stage, 'mausefalle', PARTS.mausefalle, slot),
    }).root;
    // Längs zur Figur: der Köder-Teil (−Z im Modell) zeigt zur Pfote (+X).
    trap.position.set(zone.x - 0.6, 0, zone.z);
    trap.rotation.y = -Math.PI / 2;
    trap.scaling.setAll(TRAP_SCALE);
    await stage.pace();
    // Bügel: klappt am Gelenk (Federn in der Mitte) über die Oberseite auf die Wippe.
    const bar = buildProp(stage, 'buegel', PARTS.buegel, slot, { y: 0.08, z: 0.02, parent: trap });
    const cheese = stage.prop('kaese', {
      role: 'kaese',
      key: slot,
      parent: trap,
      fallback: fallbackParts(stage, 'kaese', PARTS.kaese, slot),
    });
    cheese.root.position.set(0, 0.075, -0.2);
    await stage.pace();
    const paw = buildProp(stage, 'pfote', PARTS.pfote, slot, { slotColor: player.color });
    const figure = await SlotFigure.create(stage, player, { badgeHeight: 2.2 });
    figure.place(zone.x + 0.95, zone.z + 0.1, -Math.PI / 2);
    this.figures.set(slot, figure);
    return { zone, trap, bar, cheese, paw, figure };
  }
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
