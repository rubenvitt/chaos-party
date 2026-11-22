/**
 * Prüfung der Minispiel-Requisiten (CHAOS-88): Vertrag je GLB, Katalog gegen Manifest und
 * Budget je Minispiel. Teil von `pnpm check:assets` (`checkAssets.ts`).
 */
import type { AssetEntry, AssetManifest } from '../manifest.ts';
import {
  MINIGAME_PROP_SETS,
  PROP_IDS,
  PROP_MATERIALS,
  PROP_RUNTIME,
  PROP_SETS,
  minigameProps,
  propAssetId,
  propModelPath,
  type PropId,
} from '../props.ts';
import { GlbError, glbStats, parseGlb } from './glb.ts';

/** Toleranz für „Boden bei y = 0“, „mittig“ und die Höhe im Manifest (Meter). */
export const PROP_TOLERANCE = 0.01;

export interface PropMeasure {
  readonly bytes: number;
  readonly triangles: number;
}

function kib(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

const ALLOWED_MATERIALS = new Set<string>(PROP_MATERIALS);

/** Ein Requisit: statisch, am Boden, mittig, Budget, erlaubte Materialien, Laufzeit-Materialien. */
export function checkProp(
  entry: AssetEntry,
  bytes: Uint8Array,
  budget: AssetManifest['budgets']['prop'],
  label: string,
): { errors: string[]; note: string; measure: PropMeasure | null } {
  const errors: string[] = [];
  let stats;
  try {
    stats = glbStats(bytes);
  } catch (error) {
    const reason = error instanceof GlbError ? error.message : String(error);
    return { errors: [`${label}: GLB nicht lesbar – ${reason}`], note: '', measure: null };
  }
  if (!entry.path.endsWith('.glb')) errors.push(`${label}: Requisiten bitte als .glb`);
  if (entry.animations) errors.push(`${label}: Requisiten haben keine Animationen im Manifest`);
  if (stats.animations.length > 0) {
    errors.push(
      `${label}: statisch erwartet, GLB hat ${String(stats.animations.length)} Animationen`,
    );
  }
  if (stats.images.length > 0 || stats.textureSlots.length > 0) {
    errors.push(`${label}: Requisiten haben keine Texturen (Farben als Vertexfarben)`);
  }
  const t = PROP_TOLERANCE;
  if (Math.abs(stats.min[1]) > t) {
    errors.push(`${label}: Boden nicht bei y = 0 (unterster Punkt ${stats.min[1].toFixed(3)})`);
  }
  const cx = (stats.min[0] + stats.max[0]) / 2;
  const cz = (stats.min[2] + stats.max[2]) / 2;
  if (Math.abs(cx) > t || Math.abs(cz) > t) {
    errors.push(
      `${label}: Grundfläche nicht mittig (Mitte x ${cx.toFixed(3)}, z ${cz.toFixed(3)})`,
    );
  }
  const height = stats.max[1] - stats.min[1];
  if (entry.height === undefined) {
    errors.push(`${label}: Feld „height“ fehlt im Manifest (gemessen ${height.toFixed(3)})`);
  } else if (Math.abs(entry.height - height) > t) {
    errors.push(
      `${label}: Höhe im Manifest ${String(entry.height)}, gemessen ${height.toFixed(3)}`,
    );
  }
  if (stats.meshes > budget.maxMeshes) {
    errors.push(`${label}: ${String(stats.meshes)} Meshes, Budget ${String(budget.maxMeshes)}`);
  }
  if (stats.materials.length > budget.maxMaterials) {
    errors.push(
      `${label}: ${String(stats.materials.length)} Materialien, Budget ${String(budget.maxMaterials)}`,
    );
  }
  if (stats.triangles > budget.maxTriangles) {
    errors.push(
      `${label}: ${String(stats.triangles)} Dreiecke, Budget ${String(budget.maxTriangles)}`,
    );
  }
  for (const name of stats.materials) {
    if (!ALLOWED_MATERIALS.has(name)) {
      errors.push(`${label}: Material „${name}“ unbekannt (erlaubt: ${PROP_MATERIALS.join(', ')})`);
    }
  }
  // Farben kommen aus Vertexfarben (keine Texturen): jedes Primitive braucht COLOR_0.
  const { json } = parseGlb(bytes);
  for (const mesh of json.meshes ?? []) {
    for (const primitive of mesh.primitives) {
      if (!('COLOR_0' in primitive.attributes)) {
        const material =
          primitive.material === undefined
            ? '?'
            : (json.materials?.[primitive.material]?.name ?? '?');
        errors.push(
          `${label}: Mesh „${mesh.name ?? '?'}“ (Material „${material}“) ohne Vertexfarben (COLOR_0)`,
        );
      }
    }
  }
  const propId = entry.id.replace(/^requisit-/, '') as PropId;
  for (const name of PROP_RUNTIME[propId] ?? []) {
    if (!stats.usedMaterials.includes(name)) {
      errors.push(`${label}: Laufzeit-Material „${name}“ fehlt oder ist an keinem Mesh`);
    }
  }
  for (const name of ['akzent', 'zustand'] as const) {
    if (stats.materials.includes(name) && !(PROP_RUNTIME[propId] ?? []).includes(name)) {
      errors.push(`${label}: Material „${name}“ im GLB, aber nicht in PROP_RUNTIME (props.ts)`);
    }
  }
  const size = [0, 1, 2].map((i) => (stats.max[i] ?? 0) - (stats.min[i] ?? 0));
  const note =
    `${label}: ${kib(bytes.byteLength)}, ${size.map((v) => v.toFixed(2)).join(' × ')} m, ` +
    `${String(stats.meshes)} Meshes, ${String(stats.materials.length)} Materialien, ${String(stats.triangles)} Dreiecke`;
  return { errors, note, measure: { bytes: bytes.byteLength, triangles: stats.triangles } };
}

/** Katalog (`props.ts`) und Manifest decken sich: jedes Requisit genau ein `prop`-Eintrag. */
export function checkPropCatalog(manifest: AssetManifest, assetsDir: string): string[] {
  const errors: string[] = [];
  const entries = new Map(manifest.assets.filter((a) => a.kind === 'prop').map((a) => [a.id, a]));
  const seen = new Set<string>();
  for (const set of Object.keys(PROP_SETS) as (keyof typeof PROP_SETS)[]) {
    for (const id of PROP_SETS[set].props) {
      if (seen.has(id)) errors.push(`Requisit „${id}“ steht in mehreren Sets`);
      seen.add(id);
    }
  }
  for (const id of PROP_IDS) {
    const entry = entries.get(propAssetId(id));
    const path = `${assetsDir}/${propModelPath(id)}`;
    if (!entry) {
      errors.push(`Requisit „${id}“: Manifest-Eintrag „${propAssetId(id)}“ (Art prop) fehlt`);
    } else if (entry.path !== path) {
      errors.push(`Requisit „${id}“: Pfad ${entry.path}, erwartet ${path}`);
    }
    entries.delete(propAssetId(id));
  }
  for (const id of entries.keys()) {
    errors.push(`Asset „${id}“: Art prop, aber nicht im Requisiten-Katalog (props.ts)`);
  }
  for (const [game, sets] of Object.entries(MINIGAME_PROP_SETS)) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(game)) {
      errors.push(`Minispiel „${game}“: Schlüssel ist die Minispiel-ID (klein, mit Bindestrich)`);
    }
    if (sets.length === 0) errors.push(`Minispiel „${game}“: keine Requisiten-Sets`);
  }
  return errors;
}

/** Budget je Minispiel: Summe über seine Requisiten (jedes einmal). */
export function checkMinigameBudgets(
  manifest: AssetManifest,
  measures: ReadonlyMap<string, PropMeasure>,
): { errors: string[]; notes: string[] } {
  const errors: string[] = [];
  const notes: string[] = [];
  const budget = manifest.budgets.minigame;
  for (const game of Object.keys(MINIGAME_PROP_SETS)) {
    const props = minigameProps(game);
    let bytes = 0;
    let triangles = 0;
    let missing = false;
    for (const id of props) {
      const m = measures.get(propAssetId(id));
      if (!m) {
        missing = true;
        continue;
      }
      bytes += m.bytes;
      triangles += m.triangles;
    }
    const label = `Minispiel ${game}`;
    if (missing) {
      errors.push(`${label}: nicht alle Requisiten lesbar, Budget nicht prüfbar`);
      continue;
    }
    if (bytes > budget.maxBytes) {
      errors.push(`${label}: Requisiten ${kib(bytes)} > Budget ${kib(budget.maxBytes)}`);
    }
    if (triangles > budget.maxTriangles) {
      errors.push(
        `${label}: Requisiten ${String(triangles)} Dreiecke > Budget ${String(budget.maxTriangles)}`,
      );
    }
    if (props.length > budget.maxProps) {
      errors.push(
        `${label}: ${String(props.length)} Requisiten > Budget ${String(budget.maxProps)}`,
      );
    }
    notes.push(
      `${label}: ${String(props.length)} Requisiten, ${kib(bytes)}, ${String(triangles)} Dreiecke`,
    );
  }
  return { errors, notes };
}
