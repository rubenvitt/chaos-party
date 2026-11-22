/**
 * Requisiten aus Grundkörpern als Teile-Tabelle (aus Bienenstock-Honig herausgelöst, CHAOS-240):
 * eine Zeile je Kasten, Zylinder oder Kugel statt fünf (Prettier) je Mesh. `buildProp` baut ein
 * eigenes Requisit als Rollen-Knoten, `fallbackParts` die Grundkörper, die ein Katalog-Requisit
 * (`stage.prop`, CHAOS-237) ohne Modell des Hosts zeigt. Was ein Requisit tut, steuert das Spiel.
 */
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder.js';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder.js';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder.js';
import type { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import type { PropTint } from '@chaos-party/minigame-sdk/babylon';
import type { MinigameStage, PropFallbackParts, StageMaterialOptions } from './stage.ts';

/** Farbe eines Teils, die durch `slotColor` ersetzt wird; solche Teile sind der `akzent`. */
export const SLOT_COLOR = 'slot';

export interface PropPartOptions extends StageMaterialOptions {
  /** Skalierung des Teils (x, y, z; fehlende wie x). */
  readonly scale?: readonly number[];
  /** Teil vertritt dieses Laufzeit-Material (`StageProp.tint`); `SLOT_COLOR` heißt `akzent`. */
  readonly tint?: PropTint;
}

/**
 * Ein Teil: Form, Maße, Farbe (`SLOT_COLOR` = Slot-Farbe), Lage im Requisit, Material.
 * Maße: `box` Breite/Höhe/Tiefe, `cyl` Durchmesser oben/unten/Höhe, `ball` Durchmesser x/y/z;
 * fehlende Werte wie der erste.
 */
export type PropPart = readonly [
  shape: 'box' | 'cyl' | 'ball',
  size: readonly number[],
  color: string,
  at?: readonly number[],
  options?: PropPartOptions,
];

export interface PropOptions {
  readonly x?: number;
  readonly y?: number;
  readonly z?: number;
  /** Ersetzt `SLOT_COLOR` in den Teilen. */
  readonly slotColor?: string;
  readonly parent?: TransformNode;
  /** Gleichmäßige Skalierung des ganzen Requisits. */
  readonly scale?: number;
  /** Anfangs ausgeblendet (`setEnabled(false)`), das Spiel blendet es ein. */
  readonly hidden?: boolean;
}

/** Maße und Skalierung: fehlende Werte wie der erste (`[0.4]` = Würfel bzw. Kugel). */
const triple = (values: readonly number[]) => {
  const [a = 1, b = a, c = a] = values;
  return [a, b, c] as const;
};

/**
 * Teile als Kinder von `parent` (Namen `<präfix>-<name>-<key>-<n>`, Reihenfolge der Tabelle).
 * Liefert die Teile je Laufzeit-Material (für `stage.prop`-Rückfälle).
 */
export function buildParts(
  stage: MinigameStage,
  parent: TransformNode,
  parts: readonly PropPart[],
  name: string,
  key: string | number,
  slotColor?: string,
): PropFallbackParts {
  const tints: Partial<Record<PropTint, Mesh[]>> = {};
  for (const [index, [shape, size, hex, at, partOptions = {}]] of parts.entries()) {
    const meshName = stage.name(name, key, index);
    const [a, b, c] = triple(size);
    const mesh: Mesh =
      shape === 'box'
        ? CreateBox(meshName, { width: a, height: b, depth: c }, stage.scene)
        : shape === 'cyl'
          ? CreateCylinder(meshName, { diameterTop: a, diameterBottom: b, height: c }, stage.scene)
          : CreateSphere(meshName, { diameterX: a, diameterY: b, diameterZ: c }, stage.scene);
    const { scale, tint, ...material } = partOptions;
    const color = hex === SLOT_COLOR ? (slotColor ?? hex) : hex;
    const part = stage.add(mesh, color, { ...material, parent });
    const [x = 0, y = 0, z = 0] = at ?? [];
    part.position.set(x, y, z);
    if (scale) part.scaling.set(...triple(scale));
    const group = tint ?? (hex === SLOT_COLOR ? 'akzent' : undefined);
    if (group) (tints[group] ??= []).push(part);
  }
  return tints;
}

/** Rückfall für `stage.prop(id, { fallback })`: die Teile unter der Wurzel des Requisits. */
export function fallbackParts(
  stage: MinigameStage,
  name: string,
  parts: readonly PropPart[],
  key: string | number,
  slotColor?: string,
): (root: TransformNode) => PropFallbackParts {
  return (root) => buildParts(stage, root, parts, name, key, slotColor);
}

/**
 * Eigenes Requisit (nicht im Katalog) als Rollen-Knoten `role` mit Schlüssel `key` bei
 * (x, y, z), Teile als Kinder. Liefert den Knoten; die Teile sind `getChildMeshes()` in
 * Tabellenreihenfolge.
 */
export function buildProp(
  stage: MinigameStage,
  role: string,
  parts: readonly PropPart[],
  key: string | number,
  options: PropOptions = {},
): TransformNode {
  const node = stage.node(role, role, key);
  node.position.set(options.x ?? 0, options.y ?? 0, options.z ?? 0);
  if (options.parent) node.parent = options.parent;
  if (options.scale !== undefined) node.scaling.setAll(options.scale);
  buildParts(stage, node, parts, role, key, options.slotColor);
  if (options.hidden) node.setEnabled(false);
  return node;
}
