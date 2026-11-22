/**
 * Darstellungs-Kennung für native Hosts (CHAOS-149, ADR-019 §3).
 *
 * Der Apple-Host lässt die Minispiele headless in JavaScriptCore laufen und zeichnet sie in
 * RealityKit selbst. Damit er statt Grundkörpern echte Modelle zeigen kann, kennzeichnen die
 * Minispiele ihre **logischen Objekte** (eine Socke, ein Turm, ein Kuckuck) mit einer Rolle und
 * optional einem Schlüssel (Slot, laufende Nummer). Gekennzeichnet wird der Wurzelknoten des
 * Objekts; seine Kinder erben die Rolle (`visualOf`).
 *
 * Regeln:
 * - Rollen sind kurze deutsche Wörter in Kleinbuchstaben, eindeutig je Minispiel.
 * - Ungekennzeichnete Meshes gelten als Kulisse: statisch oder rein dekorativ; ein nativer Host
 *   darf sie als Ganzes durch eine eigene Kulisse ersetzen.
 * - Figuren kennzeichnet die Laufzeit selbst (`figur`, Schlüssel = Slot).
 * - Am PC ändert die Kennung nichts: Sie liegt nur in `node.metadata`.
 */
import type { Node } from '@babylonjs/core/node.js';

export interface VisualTag {
  readonly role: string;
  readonly key?: string;
}

const FIELD = 'chaosVisual';

/** Kennzeichnet `node` (Wurzel eines logischen Objekts) und gibt ihn zurück. */
export function markVisual<T extends Node>(node: T, role: string, key?: string | number): T {
  const tag: VisualTag = key === undefined ? { role } : { role, key: String(key) };
  node.metadata = { ...(node.metadata as object | null), [FIELD]: tag };
  return node;
}

/** Kennung des nächsten gekennzeichneten Vorfahren (einschließlich `node`), sonst `undefined`. */
export function visualOf(node: Node): VisualTag | undefined {
  for (let current: Node | null = node; current; current = current.parent) {
    const tag = (current.metadata as Record<string, unknown> | null)?.[FIELD];
    if (tag) return tag as VisualTag;
  }
  return undefined;
}

/**
 * Requisit-Kennung (CHAOS-237): Wurzel eines Requisits aus dem Katalog (`@chaos-party/assets`,
 * `PROP_SETS`), samt der zuletzt gesetzten Farben der Laufzeit-Materialien. Der Apple-Host setzt
 * an diese Stelle `requisiten/<id>.usdz` und färbt `akzent`/`zustand` wie der Browser-Host;
 * die Meshes darunter (Grundkörper-Rückfall) zeichnet er nur, solange das Modell fehlt.
 */
export interface PropTag {
  readonly id: string;
  /** Farben der Laufzeit-Materialien (`#rrggbb`), nur gesetzte. */
  readonly tints: Readonly<Partial<Record<PropTint, string>>>;
}

/** Laufzeit-Materialien eines Requisits (`PROP_RUNTIME_MATERIALS` in `@chaos-party/assets`). */
export const PROP_TINTS = ['akzent', 'zustand'] as const;
export type PropTint = (typeof PROP_TINTS)[number];

const PROP_FIELD = 'chaosProp';

/** Kennzeichnet `node` als Wurzel des Requisits `id` und gibt ihn zurück. */
export function markProp<T extends Node>(node: T, id: string): T {
  const tag: PropTag = { id, tints: {} };
  node.metadata = { ...(node.metadata as object | null), [PROP_FIELD]: tag };
  return node;
}

/** Farbe eines Laufzeit-Materials in der Kennung festhalten (nur an einer `markProp`-Wurzel). */
export function setPropTint(node: Node, tint: PropTint, hex: string): void {
  const meta = node.metadata as Record<string, unknown> | null;
  const tag = meta?.[PROP_FIELD] as PropTag | undefined;
  if (!tag) return;
  node.metadata = { ...meta, [PROP_FIELD]: { id: tag.id, tints: { ...tag.tints, [tint]: hex } } };
}

/** Nächste Requisit-Wurzel (einschließlich `node`) samt Kennung, sonst `undefined`. */
export function propOf(node: Node): { readonly node: Node; readonly tag: PropTag } | undefined {
  for (let current: Node | null = node; current; current = current.parent) {
    const tag = (current.metadata as Record<string, unknown> | null)?.[PROP_FIELD];
    if (tag) return { node: current, tag: tag as PropTag };
  }
  return undefined;
}
