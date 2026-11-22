/**
 * Drei Türen (MG-111) – Ansicht: Gartenbühne mit drei Türen, feste Kamera von vorn. Über jeder
 * Tür ein Schild mit Münzen (Wert der Runde, gold in der letzten Runde). Während der Wahl zeigt
 * nur ein Haken über der Figur, **dass** jemand gewählt hat – nie wohin. Beim Aufdecken springen
 * alle zu ihrer Tür; nur wer allein steht, öffnet sie. Die Figuren bleiben bis zum nächsten
 * Aufdecken dort stehen (sichtbarer Verlauf zum Lesen der Gewohnheiten). Logik in `logic.ts`.
 */
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder.js';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder.js';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder.js';
import type { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { arenaLayout } from '@chaos-party/minigame-kit';
import {
  MinigameStage,
  SlotFigure,
  buildArena,
  celebrateFigures,
  createCamera,
  type StageMaterialOptions,
} from '@chaos-party/minigame-kit/babylon';
import type {
  MinigameInput,
  MinigameResult,
  MinigameSecret,
  Slot,
} from '@chaos-party/minigame-sdk';
import type * as Sdk from '@chaos-party/minigame-sdk/babylon';
import { createDoorBot } from './bot.ts';
import { DREI_TUEREN_INFO as INFO } from './info.ts';
import { DOOR_RULES, DoorLogic, type DoorEvent } from './logic.ts';

const ARENA = arenaLayout({ form: 'eckig', halfX: 5.2, halfZ: 3.2 });
const DOOR_X = [-3.3, 0, 3.3] as const;
const DOOR_Z = 1.8;
const LEAF = ['#c2410c', '#7048e8', '#2b8a3e'] as const;
const SIGN = { plain: '#f8f0dc', final: '#5f3dc4' } as const;
const COINS = 9;
const HOP_S = 0.6;

type Part = readonly [
  shape: 'box' | 'cyl' | 'ball',
  size: readonly number[],
  color: string,
  at: readonly number[],
  options?: StageMaterialOptions & { readonly rot?: readonly number[] },
];
const wood = '#8a5a3c';
const PROPS = {
  tuer: [
    ['box', [0.25, 2.7, 0.3], wood, [-1, 1.35, 0]],
    ['box', [0.25, 2.7, 0.3], wood, [1, 1.35, 0]],
    ['box', [2.25, 0.3, 0.3], wood, [0, 2.8, 0]],
    ['box', [1.75, 2.55, 0.05], '#2b2118', [0, 1.28, 0.1]],
    ['box', [0.12, 0.6, 0.12], wood, [0, 3.05, 0.05]],
  ],
  tuerblatt: [
    ['box', [1.75, 2.55, 0.12], 'slot', [0.875, 1.28, 0], { finish: 'lack' }],
    ['ball', [0.16], '#ffd43b', [1.5, 1.25, -0.1], { finish: 'metall' }],
  ],
  tuerschild: [['box', [2.1, 1.2, 0.1], SIGN.plain, [0, 0, 0], { finish: 'matt' }]],
  muenze: [['cyl', [0.3, 0.3, 0.06], '#f2c94c', [0, 0, 0], { emissive: 0.25, rot: [1.571] }]],
  haken: [
    ['box', [0.1, 0.22, 0.06], '#2f9e44', [-0.08, -0.05, 0], { emissive: 0.3, rot: [0, 0, 0.7] }],
    ['box', [0.1, 0.42, 0.06], '#2f9e44', [0.08, 0.04, 0], { emissive: 0.3, rot: [0, 0, -0.5] }],
  ],
} as const satisfies Record<string, readonly Part[]>;

/** Requisit aus `PROPS` als Rollen-Knoten (Rolle = Name) an (x, y, z). */
function prop(
  stage: MinigameStage,
  role: keyof typeof PROPS,
  key: number,
  at: number[],
  slot = '',
) {
  const node = stage.node(role, role, key);
  node.position.set(at[0] ?? 0, at[1] ?? 0, at[2] ?? 0);
  for (const [index, [shape, size, hex, pos, options]] of (
    PROPS[role] as readonly Part[]
  ).entries()) {
    const name = stage.name(role, key, index);
    const [a = 1, b = a, c = a] = size;
    const mesh =
      shape === 'box'
        ? CreateBox(name, { width: a, height: b, depth: c }, stage.scene)
        : shape === 'cyl'
          ? CreateCylinder(name, { diameter: a, height: c }, stage.scene)
          : CreateSphere(name, { diameter: a }, stage.scene);
    const part = stage.add(mesh, hex === 'slot' ? slot : hex, { ...options, parent: node });
    part.position.set(pos[0] ?? 0, pos[1] ?? 0, pos[2] ?? 0);
    const [rx = 0, ry = 0, rz = 0] = options?.rot ?? [];
    part.rotation.set(rx, ry, rz);
  }
  return node;
}

interface Seat {
  readonly figure: SlotFigure;
  readonly check: TransformNode;
  readonly home: { readonly x: number; readonly z: number };
  from: { x: number; z: number };
  to: { x: number; z: number };
}

class DreiTueren implements Sdk.Minigame {
  private ctx: Sdk.MinigameContext | null = null;
  private stage: MinigameStage | null = null;
  private logic: DoorLogic | null = null;
  private result: MinigameResult | null = null;
  private running = false;
  private revealedAt = -10;
  private readonly leaves: TransformNode[] = [];
  private readonly signs: Mesh[] = [];
  private readonly coins: TransformNode[][] = [];
  private readonly seats = new Map<Slot, Seat>();

  async prepare(ctx: Sdk.MinigameContext): Promise<void> {
    this.ctx = ctx;
    const slots = ctx.players.map((player) => player.slot);
    this.logic = new DoorLogic(slots, ctx.rng, ctx.timeLimitMs);
    const stage = (this.stage = new MinigameStage(ctx, 'tueren'));
    createCamera(stage, 'fest', ARENA, {
      position: { x: 0, y: 7, z: -11.5 },
      target: { x: 0, y: 2.5, z: 0.6 },
    });
    await buildArena(stage, ARENA, { ort: 'garten' });
    for (const [door, x] of DOOR_X.entries()) {
      prop(stage, 'tuer', door, [x, 0, DOOR_Z]);
      this.leaves.push(prop(stage, 'tuerblatt', door, [x - 0.875, 0, DOOR_Z - 0.1], LEAF[door]));
      const sign = prop(stage, 'tuerschild', door, [x, 3.85, DOOR_Z]);
      this.signs.push(sign.getChildMeshes()[0] as Mesh);
      await stage.pace();
      this.coins.push(
        Array.from({ length: COINS }, (_, n) =>
          prop(stage, 'muenze', door * 10 + n, [
            x + ((n % 3) - 1) * 0.5,
            4.2 - Math.floor(n / 3) * 0.34,
            DOOR_Z - 0.1,
          ]),
        ),
      );
    }
    for (const [index, player] of ctx.players.entries()) {
      const home = { x: -3.6 + index * 2.4, z: -1.6 };
      const figure = await SlotFigure.create(stage, player, { badgeHeight: 2.3 });
      const check = prop(stage, 'haken', player.slot, [home.x + 0.5, 2.6, home.z]);
      this.seats.set(player.slot, { figure, check, home, from: home, to: home });
    }
    this.sync(0);
  }

  start(): void {
    this.running = true;
    this.ctx?.fx.sound('go');
  }

  createBot: NonNullable<Sdk.Minigame['createBot']> = (options) =>
    createDoorBot(options, () => (this.running ? this.logic : null));

  handleInput(slot: Slot, input: MinigameInput): void {
    if (!this.running || !this.logic) return;
    if (input.type === 'move') this.logic.aim(slot, input.x, input.y);
    else if (input.type === 'press' && input.button === 'a') {
      const event = this.logic.choose(slot);
      if (event) this.onEvent(event);
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
    const last = logic.history.at(-1);
    const status = (slot: Slot) => {
      if (logic.open) return logic.hasChosen(slot) ? 'gewählt ✓' : undefined;
      if (!last) return undefined;
      if (last.choices.get(slot) === null) return 'zu spät';
      const coins = last.payouts.get(slot) ?? 0;
      return coins > 0 ? `+${coins} allein!` : 'Gedränge';
    };
    const round = `Runde ${logic.round + 1}/${DOOR_RULES.rounds}: wählt!`;
    const banner = logic.open ? (logic.final ? 'Letzte Runde: doppelt!' : round) : undefined;
    return {
      remainingMs: logic.clock.remainingMs,
      scores: logic.board.hud(status),
      ...(banner && !this.result ? { banner } : {}),
    };
  }

  /** CHAOS-242: eigene Tür nur am eigenen Controller (Host zeigt nur den Haken). */
  getSecret(slot: Slot): MinigameSecret | null {
    return this.running && !this.result ? (this.logic?.secretOf(slot) ?? null) : null;
  }

  dispose(): void {
    this.running = false;
    for (const seat of this.seats.values()) seat.figure.dispose();
    this.seats.clear();
    this.stage?.dispose();
    this.stage = null;
  }

  private onEvent(event: DoorEvent): void {
    const fx = this.ctx?.fx;
    const logic = this.logic;
    if (!fx || !logic) return;
    if (event.type === 'round') fx.sound(logic.final ? 'buzz' : 'tick');
    else if (event.type === 'chosen') fx.sound('pop', { volume: 0.4 });
    else {
      this.revealedAt = logic.clock.time;
      fx.sound('whoosh');
      const { crowd } = event.record;
      for (const [slot, door] of event.record.choices) {
        const seat = this.seats.get(slot);
        if (!seat) continue;
        const k = [...event.record.choices.entries()].filter(
          ([s, d]) => d === door && s < slot,
        ).length;
        const x =
          door === null ? seat.home.x : DOOR_X[door] + (k - ((crowd[door] ?? 1) - 1) / 2) * 0.9;
        seat.from = { x: seat.figure.root.position.x, z: seat.figure.root.position.z };
        seat.to = door === null ? seat.home : { x, z: DOOR_Z - 1.2 };
      }
      for (const [door, count] of crowd.entries()) {
        const at = { x: DOOR_X[door] ?? 0, y: 1.5, z: DOOR_Z - 0.5 };
        if (count === 1) {
          fx.sound('coin', { pitch: 0.9 + (event.record.values[door] ?? 0) / 30 });
          fx.burst('confetti', at);
        } else if (count > 1) {
          fx.sound('bump');
          fx.burst('dust', at);
        }
      }
    }
  }

  private finish(): void {
    const { ctx, logic } = this;
    if (!ctx || !logic || this.result) return;
    this.running = false;
    const placements = logic.board.placements();
    celebrateFigures(
      placements,
      [...this.seats.values()].map((seat) => seat.figure),
    );
    ctx.fx.sound('win');
    const highlights = logic.highlights(new Map(ctx.players.map((p) => [p.slot, p.name])));
    this.result = { minigameId: INFO.id, placements, ...(highlights.length ? { highlights } : {}) };
  }

  private sync(dt: number): void {
    const { logic, stage } = this;
    if (!logic || !stage) return;
    const since = logic.clock.time - this.revealedAt;
    const last = logic.history.at(-1);
    const crowd = last?.crowd ?? [0, 0, 0];
    const factor = logic.final ? DOOR_RULES.finalFactor : 1;
    for (const [door, leaf] of this.leaves.entries()) {
      const open = !logic.open && crowd[door] === 1 ? Math.min(1, since / 0.3) : 0;
      leaf.rotation.y = -open * 1.6;
      const sign = this.signs[door];
      if (sign)
        sign.material = stage.material(logic.final ? SIGN.final : SIGN.plain, { finish: 'matt' });
      const coins = (logic.values[door] ?? 0) / factor;
      for (const [n, coin] of (this.coins[door] ?? []).entries()) coin.setEnabled(n < coins);
    }
    for (const [slot, seat] of this.seats) {
      const t = Math.min(1, since / HOP_S);
      const x = seat.from.x + (seat.to.x - seat.from.x) * t;
      const z = seat.from.z + (seat.to.z - seat.from.z) * t;
      const hop = t < 1 ? Math.sin(t * Math.PI) * 0.8 : 0;
      seat.figure.place(x, z, Math.PI, hop);
      seat.check.position.set(x + 0.5, 2.6 + hop, z);
      seat.check.setEnabled(logic.open && logic.hasChosen(slot));
      const door = last?.choices.get(slot);
      const crowded = !logic.open && door !== undefined && door !== null && (crowd[door] ?? 0) > 1;
      seat.figure.show(
        { stunned: crowded && t >= 1, dashing: t < 1, moving: false },
        dt,
        this.result !== null,
      );
    }
  }
}

export const dreiTueren: Sdk.MinigameModule = {
  info: INFO,
  create: () => new DreiTueren(),
};
