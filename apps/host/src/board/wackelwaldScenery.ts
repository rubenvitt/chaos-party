/**
 * Kulisse des großen Wackelwalds (CHAOS-196): Teich im Wald unten, Bach zwischen Uferweg und
 * Baumkronenweg, Lichtung mit Hexenring in der Mitte, Bäume locker im Inneren verteilt.
 *
 * Die Lage hängt an den Feldern (Wegweiser „Uferweg“, „Baumkronenweg“, „Lichtung“), nicht an
 * festen Koordinaten, und die Reinfunktionen hier sind ohne Babylon testbar. `natureBoard.ts`
 * holt sich Mulden, Ebenen und Baumplätze und baut Bach und Hexenring über `buildStream` bzw.
 * `buildFairyRing`.
 */
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { CreateRibbon } from '@babylonjs/core/Meshes/Builders/ribbonBuilder.js';
import type { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import type { Scene } from '@babylonjs/core/scene.js';
import type { BoardDefinition, BoardSpace } from '@chaos-party/game-core';
import { mushroom, rock, type StaticBatch } from '../nature/geometry.ts';
import type { NatureMaterials } from '../nature/materials.ts';
import type { FlatSpot, Hollow, Terrain } from '../nature/terrain.ts';
import type { Point2 } from './layout.ts';

/** Wasserspiegel des Bachs (knapp unter der Wiese). */
export const STREAM_WATER_Y = -0.07;
/** Halbe Breite des Wassers. */
const STREAM_HALF_WIDTH = 0.52;
/** Freiraum zwischen Bachmitte und Feldmitte (Scheibe 0,75 + Ufer). */
export const STREAM_CLEARANCE = 1.45;

export interface WackelwaldScenery {
  readonly pond: Hollow;
  /** Mittellinie des Bachs, von der Quelle zur Mündung. */
  readonly stream: readonly Point2[];
  /** Mitte und Radius der Lichtung (dort stehen keine Bäume, dafür der Hexenring). */
  readonly clearing: { readonly x: number; readonly z: number; readonly radius: number };
}

function byLabel(board: BoardDefinition, pattern: RegExp): BoardSpace | undefined {
  return board.spaces.find((s) => s.label !== undefined && pattern.test(s.label));
}

/** Felder eines Zweigs ab `start` bis vor die nächste Gabel oder Zusammenführung. */
function walk(board: BoardDefinition, start: BoardSpace, max: number): BoardSpace[] {
  const byId = new Map(board.spaces.map((s) => [s.id, s]));
  const incoming = new Map<string, number>();
  for (const s of board.spaces) for (const n of s.next) incoming.set(n, (incoming.get(n) ?? 0) + 1);
  const out: BoardSpace[] = [start];
  for (let space = start; out.length < max;) {
    const next = space.next.length === 1 ? byId.get(space.next[0] ?? '') : undefined;
    if (!next || (incoming.get(next.id) ?? 0) > 1) break;
    out.push(next);
    space = next;
  }
  return out;
}

/** Strecken aller Wege (von Feld zu Nachfolger). */
function edgesOf(board: BoardDefinition): [Point2, Point2][] {
  const byId = new Map(board.spaces.map((s) => [s.id, s.position]));
  return board.spaces.flatMap((s) =>
    s.next.flatMap((n) => {
      const to = byId.get(n);
      return to ? [[s.position, to] as [Point2, Point2]] : [];
    }),
  );
}

/** Abstand eines Punkts zur Strecke a–b. */
export function segmentDistance(p: Point2, a: Point2, b: Point2): number {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len2 = dx * dx + dz * dz;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / len2));
  return Math.hypot(p.x - (a.x + dx * t), p.z - (a.z + dz * t));
}

/**
 * Kulisse aus den Feldern: Der Bach läuft mittig zwischen Uferweg und Baumkronenweg, so weit
 * beide nebeneinander liegen; der Teich liegt im Wald zwischen Start-Reihe, Sumpfabkürzung und
 * Lichtung; die Lichtung um ihren Trophäen-Kandidaten. `null`, wenn ein Weg fehlt.
 */
export function wackelwaldScenery(board: BoardDefinition): WackelwaldScenery | null {
  const shore = byLabel(board, /ufer/i);
  const canopy = byLabel(board, /baumkrone/i);
  const glade = byLabel(board, /lichtung/i);
  const swamp = byLabel(board, /sumpf/i);
  if (!shore || !canopy || !glade || !swamp) return null;
  const bank = walk(board, shore, 12).map((s) => s.position);
  const treetops = walk(board, canopy, 12).map((s) => s.position);
  const gladeWay = walk(board, glade, 14);

  // Bach: je Baumkronen-Feld der Punkt mittig zum nächsten Uferweg-Feld, nur wo beide
  // weit genug auseinander liegen (sonst wäre zwischen den Scheiben kein Platz).
  const edges = edgesOf(board);
  const stream: Point2[] = [];
  for (const t of treetops) {
    const nearest = bank.reduce((best, b) =>
      Math.hypot(b.x - t.x, b.z - t.z) < Math.hypot(best.x - t.x, best.z - t.z) ? b : best,
    );
    const p = { x: (t.x + nearest.x) / 2, z: (t.z + nearest.z) / 2 };
    const clear =
      board.spaces.every(
        (s) => Math.hypot(s.position.x - p.x, s.position.z - p.z) >= STREAM_CLEARANCE,
      ) && edges.every(([a, b]) => segmentDistance(p, a, b) >= 1);
    if (clear) stream.push(p);
  }

  const trophy =
    gladeWay.find((s) => s.kind === 'trophy') ?? gladeWay[Math.floor(gladeWay.length / 2)];
  const center = trophy?.position ?? glade.position;
  // Die Lichtung liegt vor dem Feld (zur Kamera, −z): Dort verdecken Bäume sonst den Weg.
  const clearing = { x: center.x, z: center.z - 3, radius: 3.6 };

  // Teich: zwischen Start-Reihe (unten), Sumpfabkürzung (rechts) und Lichtung (oben).
  const swampWay = walk(board, swamp, 6).map((s) => s.position);
  const bottom = Math.min(...board.spaces.map((s) => s.position.z));
  const minSwampX = Math.min(...swampWay.map((p) => p.x));
  const pond: Hollow = {
    x: minSwampX - 4.6,
    z: bottom + 6.4,
    rx: 2.4,
    rz: 2.9,
    depth: 0.42,
  };
  return { pond, stream, clearing };
}

/** Liegt `p` näher als `distance` an der Mittellinie des Bachs? */
export function nearStream(stream: readonly Point2[], p: Point2, distance: number): boolean {
  for (let i = 0; i + 1 < stream.length; i++) {
    const a = stream[i];
    const b = stream[i + 1];
    if (a && b && segmentDistance(p, a, b) < distance) return true;
  }
  return false;
}

/** Ebenen und Mulden des Bachs fürs Gelände: Ufer eben, Bachbett als Kette kleiner Mulden. */
export function streamGround(stream: readonly Point2[]): {
  flats: FlatSpot[];
  hollows: Hollow[];
} {
  const flats: FlatSpot[] = [];
  const hollows: Hollow[] = [];
  for (let i = 0; i + 1 < stream.length; i++) {
    const a = stream[i];
    const b = stream[i + 1];
    if (!a || !b) continue;
    const length = Math.hypot(b.x - a.x, b.z - a.z);
    const steps = Math.max(1, Math.ceil(length / 0.6));
    for (let k = 0; k <= steps; k++) {
      if (k === steps && i + 2 < stream.length) continue;
      const x = a.x + ((b.x - a.x) * k) / steps;
      const z = a.z + ((b.z - a.z) * k) / steps;
      flats.push({ x, z, radius: 0.75, blend: 0.6 });
      hollows.push({ x, z, rx: 0.62, rz: 0.62, depth: 0.09 });
    }
  }
  return { flats, hollows };
}

export interface TreeSpot {
  readonly x: number;
  readonly z: number;
  readonly scale: number;
  readonly pine: boolean;
}

/**
 * Bäume im Inneren des Bretts (jitterndes Raster, deterministisch über `rnd`): Abstand zu
 * Feldern und Wegen, nicht im Teich, im Bach oder auf der Lichtung, und nie knapp vor einem
 * Feld (die Kamera schaut schräg von vorn, −z: ein Baum dort verdeckt das Feld).
 */
export function wackelwaldTreeSpots(
  board: BoardDefinition,
  scenery: WackelwaldScenery,
  terrain: Pick<Terrain, 'inside'>,
  rnd: () => number,
): TreeSpot[] {
  const edges = edgesOf(board);
  const xs = board.spaces.map((s) => s.position.x);
  const zs = board.spaces.map((s) => s.position.z);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  const { pond, stream, clearing } = scenery;
  const spots: TreeSpot[] = [];
  const grid = 2.6;
  for (let z = minZ + 1.2; z <= maxZ; z += grid) {
    for (let x = minX; x <= maxX; x += grid) {
      const p = { x: x + (rnd() - 0.5) * 1.6, z: z + (rnd() - 0.5) * 1.6 };
      const scale = 0.62 + rnd() * 0.3;
      const pine = rnd() < 0.5;
      if (!terrain.inside(p.x, p.z, 2.4)) continue;
      if (board.spaces.some((s) => Math.hypot(s.position.x - p.x, s.position.z - p.z) < 2.3))
        continue;
      if (edges.some(([a, b]) => segmentDistance(p, a, b) < 1.6)) continue;
      // Vor einem Feld (Richtung Kamera) bis 3,8 Einheiten frei: Krone verdeckt sonst die Scheibe.
      const hides = board.spaces.some((s) => {
        const ahead = s.position.z - p.z;
        return ahead > 0 && ahead < 3.8 && Math.abs(s.position.x - p.x) < 1.9;
      });
      if (hides) continue;
      if (Math.hypot((p.x - pond.x) / (pond.rx + 1), (p.z - pond.z) / (pond.rz + 1)) < 1) continue;
      if (Math.hypot(p.x - clearing.x, p.z - clearing.z) < clearing.radius) continue;
      if (nearStream(stream, p, 1.2)) continue;
      if (spots.some((t) => Math.hypot(t.x - p.x, t.z - p.z) < 1.9)) continue;
      spots.push({ x: p.x, z: p.z, scale, pine });
    }
  }
  return spots;
}

/** Bach als Wasserband mit Steinen am Ufer; Material wie der Teich. */
export function buildStream(
  scene: Scene,
  mats: NatureMaterials,
  terrain: Terrain,
  stream: readonly Point2[],
  rnd: () => number,
  batch: StaticBatch,
): Mesh | null {
  if (stream.length < 2) return null;
  const left: Vector3[] = [];
  const right: Vector3[] = [];
  for (let i = 0; i < stream.length; i++) {
    const p = stream[i];
    const prev = stream[Math.max(0, i - 1)];
    const next = stream[Math.min(stream.length - 1, i + 1)];
    if (!p || !prev || !next) continue;
    const dx = next.x - prev.x;
    const dz = next.z - prev.z;
    const len = Math.hypot(dx, dz) || 1;
    // Quelle und Mündung laufen spitz zu.
    const width = i === 0 || i === stream.length - 1 ? STREAM_HALF_WIDTH * 0.45 : STREAM_HALF_WIDTH;
    const nx = (-dz / len) * width;
    const nz = (dx / len) * width;
    left.push(new Vector3(p.x + nx, STREAM_WATER_Y, p.z + nz));
    right.push(new Vector3(p.x - nx, STREAM_WATER_Y, p.z - nz));
  }
  const water = CreateRibbon('bach', { pathArray: [left, right], sideOrientation: 2 }, scene);
  water.material = mats.plain('#3b6e6a', { roughness: 0.05, alpha: 0.9, clearCoat: 1 });
  water.receiveShadows = true;
  water.isPickable = false;
  // Steine abwechselnd an beiden Ufern.
  for (let i = 0; i + 1 < stream.length; i++) {
    const a = stream[i];
    const b = stream[i + 1];
    if (!a || !b) continue;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz) || 1;
    for (const [f, side] of [
      [0.3, 1],
      [0.75, -1],
    ] as const) {
      const off = (STREAM_HALF_WIDTH + 0.2 + rnd() * 0.15) * side;
      const x = a.x + dx * f + (-dz / len) * off;
      const z = a.z + dz * f + (dx / len) * off;
      rock(
        scene,
        mats,
        new Vector3(x, terrain.height(x, z) - 0.04, z),
        0.14 + rnd() * 0.1,
        rnd,
        batch,
      );
    }
  }
  return water;
}

/** Hexenring: Pilze im Kreis auf der Lichtung. */
export function buildFairyRing(
  scene: Scene,
  mats: NatureMaterials,
  terrain: Terrain,
  center: Point2,
  rnd: () => number,
  batch: StaticBatch,
): void {
  const count = 11;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + rnd() * 0.2;
    const x = center.x + Math.cos(a) * 1.5;
    const z = center.z + Math.sin(a) * 1.15;
    mushroom(
      scene,
      mats,
      new Vector3(x, terrain.height(x, z) - 0.02, z),
      0.55 + rnd() * 0.3,
      rnd,
      batch,
    );
  }
}
