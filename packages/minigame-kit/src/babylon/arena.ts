/**
 * Arena-Vorlagen (Optik zum Grundriss aus `arenaLayout`): runde Fläche, Rechteck mit Bande,
 * Bahnen, Insel mit Kante und vier Eigenbereiche, jeweils an einem Ort (Garten, Küche, Bad,
 * Teich, Spielzimmer, Wald, Dachboden) mit eigener Farbwelt. Mit `ctx.look` steht die Fläche
 * in der Natur-Kulisse des Hosts (ADR-014), ohne Look auf einem einfarbigen Boden.
 *
 * Eine Vorlage ist nur die Spielfläche. Requisiten, Gegner und alles, was das Spiel ausmacht,
 * baut das Spiel selbst (README §5.5); Requisiten-Sets je Familie kommen mit CHAOS-88.
 */
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder.js';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder.js';
import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder.js';
import { CreateTorus } from '@babylonjs/core/Meshes/Builders/torusBuilder.js';
import type { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import type { MinigamePlayer } from '@chaos-party/minigame-sdk/babylon';
import type { ArenaLayout } from '../arena.ts';
import type { Ort } from '../steckbrief.ts';
import type { MinigameStage } from './stage.ts';

export interface PlacePalette {
  /** Lauffläche. */
  readonly floor: string;
  /** Rand, Bande, Kante. */
  readonly rim: string;
  /** Streifen, Markierungen. */
  readonly accent: string;
  /** Seitenwand einer Insel bzw. Boden darunter. */
  readonly side: string;
  /** Boden ohne Look (bis zum Horizont). */
  readonly ground: string;
  /** Unterlage der Natur-Kulisse. */
  readonly surface: 'wiese' | 'decke';
}

/** Farbwelten der Orte (kräftig, spielzeughaft, Art-Direction-Guide). */
export const PLACES: Readonly<Record<Ort, PlacePalette>> = {
  garten: {
    floor: '#8fd16a',
    rim: '#c98b4f',
    accent: '#ffd43b',
    side: '#8a5a3c',
    ground: '#6fbf4a',
    surface: 'wiese',
  },
  kueche: {
    floor: '#f6e7cf',
    rim: '#e8574d',
    accent: '#5fb8e8',
    side: '#c94a40',
    ground: '#e9d3b0',
    surface: 'decke',
  },
  bad: {
    floor: '#c6ecf5',
    rim: '#ffffff',
    accent: '#38b6e8',
    side: '#8fd3e8',
    ground: '#e6f6fb',
    surface: 'decke',
  },
  teich: {
    floor: '#7ccf8a',
    rim: '#4f9a3a',
    accent: '#ff9fc4',
    side: '#3b8fd1',
    ground: '#4aa3df',
    surface: 'wiese',
  },
  spielzimmer: {
    floor: '#ffd18a',
    rim: '#ff6b6b',
    accent: '#4dabf7',
    side: '#da77f2',
    ground: '#ffe2bd',
    surface: 'decke',
  },
  wald: {
    floor: '#a9c46c',
    rim: '#7a5230',
    accent: '#e0233d',
    side: '#5b3d22',
    ground: '#5e8f3a',
    surface: 'wiese',
  },
  dachboden: {
    floor: '#d4ab74',
    rim: '#8a5a3c',
    accent: '#ffe14d',
    side: '#6b4428',
    ground: '#b98c5a',
    surface: 'decke',
  },
};

export interface ArenaView {
  /** Wurzel der Spielfläche (Kulisse, nicht gekennzeichnet). */
  readonly root: TransformNode;
  /** Einzelne Felder der Eigenbereiche bzw. Bahnen (für Hervorhebungen), sonst leer. */
  readonly tiles: readonly Mesh[];
  readonly palette: PlacePalette;
}

export interface ArenaOptions {
  readonly ort: Ort;
  /** Für Eigenbereiche: Felder in Slot-Farbe tönen (Reihenfolge = Slot 1–4). */
  readonly players?: readonly MinigamePlayer[];
  /** Kulisse über `stage.backdrop` gleich mit bauen (Standard ja). */
  readonly backdrop?: boolean;
}

const SLAB = 0.3;

/** Baut die Spielfläche zum Grundriss; Oberkante liegt bei `layout.surfaceY`. */
export async function buildArena(
  stage: MinigameStage,
  layout: ArenaLayout,
  options: ArenaOptions,
): Promise<ArenaView> {
  const palette = PLACES[options.ort];
  const { scene } = stage;
  const root = stage.track(new TransformNode(stage.name('arena'), scene));
  const tiles: Mesh[] = [];
  const add = <T extends Mesh>(mesh: T, hex: string, emissive = 0.08): T => {
    stage.track(mesh);
    mesh.parent = root;
    mesh.material = stage.material(hex, { emissive });
    return mesh;
  };
  if (options.backdrop !== false) {
    const lowered = layout.edge ? 0 : -SLAB;
    const looked = stage.backdrop({
      halfX: layout.area.halfX,
      halfZ: layout.area.halfZ,
      groundY: lowered,
      surface: palette.surface,
    });
    if (!looked) {
      await stage.pace();
      const ground = add(
        CreateGround(stage.name('boden'), { width: 80, height: 60 }, scene),
        palette.ground,
        0.15,
      );
      ground.position.y = lowered - 0.01;
    }
  }
  await stage.pace();
  const top = layout.surfaceY;
  const spec = layout.spec;
  if (spec.form === 'insel' && !('radius' in spec)) {
    // Eckige Insel: Block in Seitenfarbe, Deckel als Lauffläche, keine Bande (Kante ringsum).
    const [width, depth] = [spec.halfX * 2, spec.halfZ * 2];
    const block = add(
      CreateBox(stage.name('flaeche'), { width, height: top + SLAB, depth }, scene),
      palette.side,
    );
    block.position.y = (top - SLAB) / 2;
    await stage.pace();
    const lid = add(
      CreateBox(
        stage.name('deckel'),
        { width: width - 0.1, height: 0.06, depth: depth - 0.1 },
        scene,
      ),
      palette.floor,
    );
    lid.position.y = top + 0.01;
    return { root, tiles, palette };
  }
  switch (spec.form) {
    case 'rund':
    case 'insel': {
      const r = spec.radius;
      const height = spec.form === 'insel' ? top + SLAB : SLAB;
      const floor = add(
        CreateCylinder(
          stage.name('flaeche'),
          { diameter: r * 2 + 0.6, height, tessellation: 48 },
          scene,
        ),
        spec.form === 'insel' ? palette.side : palette.floor,
      );
      floor.position.y = top - height / 2;
      if (spec.form === 'insel') {
        await stage.pace();
        const lid = add(
          CreateCylinder(
            stage.name('deckel'),
            { diameter: r * 2 + 0.4, height: 0.06, tessellation: 48 },
            scene,
          ),
          palette.floor,
        );
        lid.position.y = top + 0.01;
      }
      await stage.pace();
      const rim = add(
        CreateTorus(
          stage.name('rand'),
          { diameter: r * 2 + 0.6, thickness: 0.45, tessellation: 48 },
          scene,
        ),
        palette.rim,
        0.1,
      );
      rim.position.y = top + 0.02;
      break;
    }
    case 'eckig':
    case 'bahnen':
    case 'eigenbereiche': {
      const bounds = layout.bounds.kind === 'rect' ? layout.bounds : { halfX: 5, halfZ: 5 };
      const floor = add(
        CreateBox(
          stage.name('flaeche'),
          { width: bounds.halfX * 2 + 0.6, height: SLAB, depth: bounds.halfZ * 2 + 0.6 },
          scene,
        ),
        spec.form === 'eigenbereiche' ? palette.side : palette.floor,
      );
      floor.position.y = top - SLAB / 2;
      await buildBorder(stage, add, bounds.halfX, bounds.halfZ, palette.rim, top);
      for (const lane of layout.lanes) {
        await stage.pace();
        const strip = add(
          CreateBox(
            stage.name('bahn', lane.index),
            { width: lane.halfWidth * 2 - 0.15, height: 0.04, depth: lane.halfLength * 2 },
            scene,
          ),
          lane.index % 2 === 0 ? palette.floor : palette.accent,
          0.1,
        );
        strip.position.set(lane.x, top + 0.01, 0);
        tiles.push(strip);
      }
      for (const zone of layout.zones) {
        await stage.pace();
        const player = options.players?.[zone.index];
        const tile = add(
          CreateBox(
            stage.name('bereich', zone.index),
            { width: zone.halfX * 2, height: 0.06, depth: zone.halfZ * 2 },
            scene,
          ),
          player ? mix(palette.floor, player.color, 0.35) : palette.floor,
          0.12,
        );
        tile.position.set(zone.x, top + 0.02, zone.z);
        tiles.push(tile);
      }
      break;
    }
  }
  return { root, tiles, palette };
}

async function buildBorder(
  stage: MinigameStage,
  add: (mesh: Mesh, hex: string, emissive?: number) => Mesh,
  halfX: number,
  halfZ: number,
  hex: string,
  top: number,
): Promise<void> {
  const thick = 0.35;
  const sides: [string, number, number, number, number][] = [
    ['bande-n', halfX * 2 + 0.6 + thick * 2, thick, 0, halfZ + 0.3 + thick / 2],
    ['bande-s', halfX * 2 + 0.6 + thick * 2, thick, 0, -(halfZ + 0.3 + thick / 2)],
    ['bande-o', thick, halfZ * 2 + 0.6, halfX + 0.3 + thick / 2, 0],
    ['bande-w', thick, halfZ * 2 + 0.6, -(halfX + 0.3 + thick / 2), 0],
  ];
  for (const [name, width, depth, x, z] of sides) {
    await stage.pace();
    const side = add(
      CreateBox(stage.name(name), { width, height: 0.4, depth }, stage.scene),
      hex,
      0.1,
    );
    side.position.set(x, top + 0.1, z);
  }
}

/** Mischt zwei `#rrggbb`-Farben (`amount` 0 = a, 1 = b). */
export function mix(a: string, b: string, amount: number): string {
  const channel = (hex: string, index: number) =>
    parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16);
  const parts = [0, 1, 2].map((index) =>
    Math.round(channel(a, index) * (1 - amount) + channel(b, index) * amount)
      .toString(16)
      .padStart(2, '0'),
  );
  return `#${parts.join('')}`;
}
