/**
 * Ansicht der Mikro-Spiele (Babylon, CHAOS-90): je Mikro-Spiel ein Satz Gegenstände auf jeder
 * Bahn, gebaut in `prepare` und nur sichtbar, solange das Mikro-Spiel dran ist (`setEnabled`;
 * native Hosts lassen abgeschaltete Meshes weg). Bewegt wird nur nach dem reinen Zustand.
 */
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder.js';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder.js';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder.js';
import type { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import type { MinigameStage } from '@chaos-party/minigame-kit/babylon';
import type { Slot } from '@chaos-party/minigame-sdk';
import type { MinigamePlayer } from '@chaos-party/minigame-sdk/babylon';
import type { MicroGame } from './micro.ts';
import {
  FliegeGame,
  KerzeGame,
  KuchenGame,
  SPAGHETTI_RULES,
  SpaghettiGame,
  WeckerGame,
} from './micros.ts';

/** Bahn einer Person: Mitte in x, die Gegenstände stehen um `z = PROP_Z`. */
export interface LaneSpot {
  readonly player: MinigamePlayer;
  readonly x: number;
}

/** Abstand der Gegenstände vor den Figuren (näher an der Kamera). */
export const PROP_Z = -1;
/** Halbe Breite/Tiefe des Feldes, in dem Hand, Fliege und Messer sich bewegen. */
const FIELD_X = 0.95;
const FIELD_Z = 0.9;

export interface MicroView {
  readonly root: TransformNode;
  /** Zustand des laufenden Mikro-Spiels zeigen (`null` = Bildwort, Ausgangslage). */
  sync(game: MicroGame | null, dt: number): void;
}

type ViewBuilder = (stage: MinigameStage, lanes: readonly LaneSpot[]) => Promise<MicroView>;

function mesh<T extends Mesh>(
  stage: MinigameStage,
  made: T,
  hex: string,
  parent: TransformNode,
  emissive = 0,
): T {
  return stage.add(made, hex, { parent, ...(emissive > 0 ? { emissive } : {}) });
}

const wecker: ViewBuilder = async (stage, lanes) => {
  const root = stage.node('wecker');
  const clocks = new Map<Slot, { body: TransformNode; bells: Mesh[] }>();
  for (const lane of lanes) {
    const body = stage.node('wecker-uhr');
    body.parent = root;
    body.position.set(lane.x, 0.55, PROP_Z);
    const face = CreateCylinder(
      stage.name('ziffernblatt', stage.count),
      { diameter: 0.8, height: 0.3, tessellation: 20 },
      stage.scene,
    );
    mesh(stage, face, '#f4efe2', body).rotation.x = Math.PI / 2;
    const ring = CreateCylinder(
      stage.name('gehaeuse', stage.count),
      { diameter: 0.9, height: 0.24, tessellation: 20 },
      stage.scene,
    );
    mesh(stage, ring, lane.player.color, body).rotation.x = Math.PI / 2;
    ring.position.z = 0.05;
    const bells: Mesh[] = [];
    for (const side of [-1, 1]) {
      const bell = CreateSphere(
        stage.name('glocke', stage.count),
        { diameter: 0.3, segments: 6 },
        stage.scene,
      );
      mesh(stage, bell, '#d9b44a', body).position.set(side * 0.3, 0.45, 0);
      bells.push(bell);
    }
    clocks.set(lane.player.slot, { body, bells });
    await stage.pace();
  }
  return {
    root,
    sync(game) {
      const state = game instanceof WeckerGame ? game : null;
      for (const [slot, clock] of clocks) {
        const kind = state?.state.get(slot)?.kind ?? 'wait';
        const ringing = state?.ringing === true && kind === 'wait';
        const twitch = state?.twitching === true && kind === 'wait';
        const t = state?.time ?? 0;
        clock.body.rotation.z = ringing
          ? Math.sin(t * 60) * 0.18
          : twitch
            ? Math.sin(t * 40) * 0.06
            : 0;
        clock.body.scaling.y = kind === 'hit' ? 0.45 : 1;
        clock.body.rotation.x = kind === 'early' ? 1.2 : 0;
        for (const bell of clock.bells)
          bell.position.y = ringing ? 0.45 + Math.abs(Math.sin(t * 50)) * 0.06 : 0.45;
      }
    },
  };
};

const spaghetti: ViewBuilder = async (stage, lanes) => {
  const root = stage.node('spaghetti');
  const plates = new Map<Slot, { noodle: Mesh; sauce: Mesh }>();
  for (const lane of lanes) {
    const plate = CreateCylinder(
      stage.name('teller', stage.count),
      { diameter: 1.3, height: 0.08, tessellation: 24 },
      stage.scene,
    );
    mesh(stage, plate, '#f6f3ee', root).position.set(lane.x, 0.3, PROP_Z);
    const heap = CreateSphere(
      stage.name('nudelberg', stage.count),
      { diameter: 0.7, segments: 6 },
      stage.scene,
    );
    mesh(stage, heap, '#f1cf6b', root).position.set(lane.x, 0.38, PROP_Z);
    heap.scaling.y = 0.4;
    const noodle = CreateCylinder(
      stage.name('nudel', stage.count),
      { diameter: 0.1, height: 1, tessellation: 6 },
      stage.scene,
    );
    mesh(stage, noodle, '#f1cf6b', root);
    const sauce = CreateSphere(
      stage.name('sosse', stage.count),
      { diameter: 0.5, segments: 6 },
      stage.scene,
    );
    mesh(stage, sauce, '#c8321e', root, 0.2).position.set(lane.x, 1.5, PROP_Z + 1.2);
    plates.set(lane.player.slot, { noodle, sauce });
    noodle.metadata = { x: lane.x };
    await stage.pace();
  }
  return {
    root,
    sync(game) {
      const state = game instanceof SpaghettiGame ? game : null;
      for (const [slot, plate] of plates) {
        const x = (plate.noodle.metadata as { x: number }).x;
        const left = 1 - (state?.eaters.get(slot)?.count ?? 0) / SPAGHETTI_RULES.need;
        // Die Nudel spannt sich vom Teller zum Mund; je weiter geschlürft, desto kürzer.
        const length = Math.max(0.02, 1.5 * left);
        plate.noodle.scaling.y = length;
        plate.noodle.position.set(x, 0.45 + length / 2, PROP_Z + 0.9 * (1 - left));
        plate.noodle.setEnabled(left > 0);
        plate.sauce.setEnabled(state?.splashed(slot) === true);
      }
    },
  };
};

const kerze: ViewBuilder = async (stage, lanes) => {
  const root = stage.node('kerze');
  const flames = new Map<Slot, Mesh>();
  for (const lane of lanes) {
    const stand = CreateCylinder(
      stage.name('halter', stage.count),
      { diameter: 0.7, height: 0.08, tessellation: 18 },
      stage.scene,
    );
    mesh(stage, stand, '#c9a24b', root).position.set(lane.x, 0.25, PROP_Z);
    const candle = CreateCylinder(
      stage.name('kerze', stage.count),
      { diameter: 0.32, height: 0.9, tessellation: 14 },
      stage.scene,
    );
    mesh(stage, candle, '#fbf5e6', root).position.set(lane.x, 0.72, PROP_Z);
    const flame = CreateSphere(
      stage.name('flamme', stage.count),
      { diameter: 0.5, segments: 6 },
      stage.scene,
    );
    mesh(stage, flame, '#ff9a2e', root, 0.9).position.set(lane.x, 1.35, PROP_Z);
    flames.set(lane.player.slot, flame);
    await stage.pace();
  }
  return {
    root,
    sync(game) {
      const state = game instanceof KerzeGame ? game : null;
      for (const [slot, flame] of flames) {
        const size = state ? state.flame(slot) : 0.6;
        flame.setEnabled(!state?.done(slot));
        flame.scaling.set(0.5 + size * 0.7, 0.6 + size * 1.6, 0.5 + size * 0.7);
        flame.position.y = 1.25 + size * 0.25;
      }
    },
  };
};

const fliege: ViewBuilder = async (stage, lanes) => {
  const root = stage.node('fliege');
  const parts = new Map<Slot, { fly: TransformNode; hand: Mesh; x: number }>();
  for (const lane of lanes) {
    const board = CreateBox(
      stage.name('tisch', stage.count),
      { width: FIELD_X * 2 + 0.3, height: 0.1, depth: FIELD_Z * 2 + 0.3 },
      stage.scene,
    );
    mesh(stage, board, '#b58251', root).position.set(lane.x, 0.2, PROP_Z);
    const fly = stage.node('fliege-koerper');
    fly.parent = root;
    const body = CreateSphere(
      stage.name('fliegenkoerper', stage.count),
      { diameter: 0.32, segments: 6 },
      stage.scene,
    );
    mesh(stage, body, '#2b2b33', fly);
    for (const side of [-1, 1]) {
      const wing = CreateBox(
        stage.name('fluegel', stage.count),
        { width: 0.3, height: 0.02, depth: 0.16 },
        stage.scene,
      );
      mesh(stage, wing, '#d8ecff', fly, 0.3).position.set(side * 0.15, 0.08, 0);
    }
    const hand = CreateSphere(
      stage.name('hand', stage.count),
      { diameter: 0.42, segments: 8 },
      stage.scene,
    );
    mesh(stage, hand, lane.player.color, root, 0.25);
    hand.scaling.y = 0.45;
    parts.set(lane.player.slot, { fly, hand, x: lane.x });
    await stage.pace();
  }
  return {
    root,
    sync(game) {
      const state = game instanceof FliegeGame ? game : null;
      for (const [slot, part] of parts) {
        const lane = state?.lanes.get(slot);
        const t = state?.time ?? 0;
        part.fly.position.set(
          part.x + (lane?.fx ?? 0.3) * FIELD_X,
          0.75 + Math.sin(t * 9) * 0.06,
          PROP_Z + (lane?.fy ?? 0.3) * FIELD_Z,
        );
        part.hand.position.set(
          part.x + (lane?.hx ?? 0) * FIELD_X,
          0.45,
          PROP_Z + (lane?.hy ?? -0.7) * FIELD_Z,
        );
        const snapping = lane !== undefined && t < lane.readyAt && t > lane.readyAt - 0.15;
        part.hand.position.y = snapping ? 0.3 : 0.45;
      }
    },
  };
};

const kuchen: ViewBuilder = async (stage, lanes) => {
  const root = stage.node('kuchen');
  const parts = new Map<Slot, { left: Mesh; right: Mesh; knife: Mesh; x: number }>();
  for (const lane of lanes) {
    const board = CreateBox(
      stage.name('brett', stage.count),
      { width: FIELD_X * 2 + 0.3, height: 0.08, depth: 0.9 },
      stage.scene,
    );
    mesh(stage, board, '#d9b98a', root).position.set(lane.x, 0.2, PROP_Z);
    const halves: Mesh[] = [];
    for (const side of ['links', 'rechts']) {
      const half = CreateBox(
        stage.name('kuchen', side, stage.count),
        { width: 0.5, height: 0.5, depth: 0.8 },
        stage.scene,
      );
      mesh(stage, half, side === 'links' ? '#f2c4d0' : '#eab3c2', root);
      halves.push(half);
    }
    const knife = CreateBox(
      stage.name('messer', stage.count),
      { width: 0.05, height: 0.6, depth: 0.95 },
      stage.scene,
    );
    mesh(stage, knife, '#cfd6de', root, 0.15);
    const [left, right] = halves as [Mesh, Mesh];
    parts.set(lane.player.slot, { left, right, knife, x: lane.x });
    await stage.pace();
  }
  return {
    root,
    sync(game) {
      const state = game instanceof KuchenGame ? game : null;
      for (const [slot, part] of parts) {
        const cutter = state?.cutters.get(slot);
        const cut = cutter?.cut ?? null;
        const center = state ? state.cakeAt(cut ? cut.at : state.time) : 0;
        const spread = cut ? 0.12 : 0;
        part.left.position.set(part.x + center * FIELD_X - 0.25 - spread, 0.49, PROP_Z);
        part.right.position.set(part.x + center * FIELD_X + 0.25 + spread, 0.49, PROP_Z);
        part.knife.position.set(part.x + (cutter?.knife ?? 0) * FIELD_X, cut ? 0.5 : 1.05, PROP_Z);
      }
    },
  };
};

export const MICRO_VIEWS: Readonly<Record<string, ViewBuilder>> = {
  wecker,
  spaghetti,
  kerze,
  fliege,
  kuchen,
};
