/**
 * Arena-Grundrisse (rein): Form und Maße einer Spielfläche, daraus Grenzen, Bahnen,
 * Eigenbereiche und Absturzkante für die Logik. Die Optik dazu baut `./babylon`
 * (`buildArena`) am gewählten Ort; die Logik braucht nur den Grundriss.
 */
import { clampToRect, type Bounds } from './geometry.ts';

export type ArenaSpec =
  /** Runde Fläche mit Rand. */
  | { readonly form: 'rund'; readonly radius: number }
  /** Rechteckige Fläche mit Bande. */
  | { readonly form: 'eckig'; readonly halfX: number; readonly halfZ: number }
  /** 2–4 Bahnen nebeneinander (entlang +z), z. B. für Rennen und Zielen. */
  | {
      readonly form: 'bahnen';
      readonly lanes: number;
      readonly laneWidth: number;
      readonly length: number;
    }
  /** Erhöhte runde Insel; wer über die Kante gerät, fällt hinunter. */
  | { readonly form: 'insel'; readonly radius: number; readonly height?: number }
  /** Erhöhte eckige Insel (Eisscholle, Tisch, Kiste) mit Kante ringsum (CHAOS-241). */
  | {
      readonly form: 'insel';
      readonly halfX: number;
      readonly halfZ: number;
      readonly height?: number;
    }
  /** Vier getrennte Felder, je eines pro Slot (iPad-tauglich: jeder spielt bei sich). */
  | { readonly form: 'eigenbereiche'; readonly zoneHalf: number; readonly gap: number };

export interface Lane {
  readonly index: number;
  /** Mitte der Bahn in x; die Bahn läuft von z = −length/2 bis +length/2. */
  readonly x: number;
  readonly halfWidth: number;
  readonly halfLength: number;
}

export interface Zone {
  readonly index: number;
  readonly x: number;
  readonly z: number;
  readonly halfX: number;
  readonly halfZ: number;
}

export interface ArenaLayout {
  readonly spec: ArenaSpec;
  /** Wo Figuren laufen dürfen (Bei Inseln: die Oberseite; hinaus heißt fallen). */
  readonly bounds: Bounds;
  readonly lanes: readonly Lane[];
  readonly zones: readonly Zone[];
  /** Hat eine Absturzkante (Insel). */
  readonly edge: boolean;
  /** Höhe der Lauffläche (Insel: erhöht). */
  readonly surfaceY: number;
  /** Halbe Breite/Tiefe der Fläche, die die Kulisse frei lassen muss (`LookArea`). */
  readonly area: { readonly halfX: number; readonly halfZ: number };
}

/** Rand um die Fläche, den die Kulisse zusätzlich frei lässt. */
const AREA_MARGIN = 1.5;

export function arenaLayout(spec: ArenaSpec): ArenaLayout {
  switch (spec.form) {
    case 'rund':
      return layout(spec, { kind: 'circle', radius: spec.radius }, spec.radius, spec.radius);
    case 'eckig':
      return layout(
        spec,
        { kind: 'rect', halfX: spec.halfX, halfZ: spec.halfZ },
        spec.halfX,
        spec.halfZ,
      );
    case 'bahnen': {
      const count = Math.max(1, Math.round(spec.lanes));
      const halfX = (count * spec.laneWidth) / 2;
      const halfZ = spec.length / 2;
      const lanes = Array.from({ length: count }, (_, index) => ({
        index,
        x: -halfX + spec.laneWidth * (index + 0.5),
        halfWidth: spec.laneWidth / 2,
        halfLength: halfZ,
      }));
      return { ...layout(spec, { kind: 'rect', halfX, halfZ }, halfX, halfZ), lanes };
    }
    case 'insel': {
      const height = spec.height ?? 0.6;
      const base =
        'radius' in spec
          ? layout(spec, { kind: 'circle', radius: spec.radius }, spec.radius, spec.radius)
          : layout(
              spec,
              { kind: 'rect', halfX: spec.halfX, halfZ: spec.halfZ },
              spec.halfX,
              spec.halfZ,
            );
      return { ...base, edge: true, surfaceY: height };
    }
    case 'eigenbereiche': {
      const offset = spec.zoneHalf + spec.gap / 2;
      const zones = [
        [-1, 1],
        [1, 1],
        [-1, -1],
        [1, -1],
      ].map(([sx, sz], index) => ({
        index,
        x: (sx ?? 0) * offset,
        z: (sz ?? 0) * offset,
        halfX: spec.zoneHalf,
        halfZ: spec.zoneHalf,
      }));
      const half = offset + spec.zoneHalf;
      return { ...layout(spec, { kind: 'rect', halfX: half, halfZ: half }, half, half), zones };
    }
  }
}

function layout(spec: ArenaSpec, bounds: Bounds, halfX: number, halfZ: number): ArenaLayout {
  return {
    spec,
    bounds,
    lanes: [],
    zones: [],
    edge: false,
    surfaceY: 0,
    area: { halfX: halfX + AREA_MARGIN, halfZ: halfZ + AREA_MARGIN },
  };
}

/** Bahn unter `x` oder `null` (zwischen/außerhalb der Bahnen gibt es keine Lücke). */
export function laneAt(arena: ArenaLayout, x: number): Lane | null {
  return arena.lanes.find((lane) => Math.abs(x - lane.x) <= lane.halfWidth) ?? null;
}

/** Eigenbereich, in dem `(x, z)` liegt, oder `null` (im Spalt). */
export function zoneAt(arena: ArenaLayout, x: number, z: number): Zone | null {
  return (
    arena.zones.find(
      (zone) => Math.abs(x - zone.x) <= zone.halfX && Math.abs(z - zone.z) <= zone.halfZ,
    ) ?? null
  );
}

/** Hält einen Punkt in einem Eigenbereich bzw. einer Bahn (mit Abstand `margin` zum Rand). */
export function clampToZone(
  zone: Zone | Lane,
  x: number,
  z: number,
  margin = 0,
): { x: number; z: number } {
  const cx = zone.x;
  const cz = 'z' in zone ? zone.z : 0;
  const halfX = 'halfX' in zone ? zone.halfX : zone.halfWidth;
  const halfZ = 'halfZ' in zone ? zone.halfZ : zone.halfLength;
  const clamped = clampToRect(
    x - cx,
    z - cz,
    Math.max(0, halfX - margin),
    Math.max(0, halfZ - margin),
  );
  return { x: clamped.x + cx, z: clamped.z + cz };
}

/** Ist `(x, z)` über die Absturzkante geraten? Nur bei Arenen mit Kante. */
export function offEdge(arena: ArenaLayout, x: number, z: number): boolean {
  if (!arena.edge) return false;
  return arena.bounds.kind === 'circle'
    ? Math.hypot(x, z) > arena.bounds.radius
    : Math.abs(x) > arena.bounds.halfX || Math.abs(z) > arena.bounds.halfZ;
}

/** Startpunkte für `count` Figuren: verteilt im Halbkreis, auf Bahnen oder in den Bereichen. */
export function startPoints(arena: ArenaLayout, count: number): { x: number; z: number }[] {
  if (arena.zones.length > 0) {
    return Array.from({ length: count }, (_, index) => {
      const zone = arena.zones[index % arena.zones.length];
      return { x: zone?.x ?? 0, z: zone?.z ?? 0 };
    });
  }
  if (arena.lanes.length > 0) {
    return Array.from({ length: count }, (_, index) => {
      const lane = arena.lanes[index % arena.lanes.length];
      return { x: lane?.x ?? 0, z: -(lane?.halfLength ?? 0) * 0.8 };
    });
  }
  const reach =
    arena.bounds.kind === 'circle'
      ? arena.bounds.radius * 0.5
      : Math.min(arena.bounds.halfX, arena.bounds.halfZ) * 0.5;
  return Array.from({ length: count }, (_, index) => {
    const angle = Math.PI + (Math.PI * (index + 1)) / (count + 1);
    return { x: Math.cos(angle) * reach, z: Math.sin(angle) * reach * 0.6 };
  });
}
