/**
 * Requisiten der Minispiele (CHAOS-88): Katalog der Sets je Familie, Kulissen je Ort der
 * Arena-Vorlagen (CHAOS-222) und Zuordnung zu den Minispielen. Die GLBs erzeugt `packages/assets/blender/props.py` (Liste `PROPS` in
 * `requisiten.py`); jede Datei steht im Manifest als Art `prop` mit der id `requisit-<id>`.
 * `pnpm check:assets` hält Katalog, Manifest und Dateien gleich und prüft die Budgets je
 * Requisit (`budgets.prop`) und je Minispiel (`budgets.minigame`).
 *
 * Vertrag eines Requisits (wie die Figuren: Meter, Y oben, vorn +Z):
 * - Boden bei y = 0, Grundfläche mittig über dem Ursprung, Wurzelknoten mit dem Namen des
 *   Requisits; statisch (keine Animation, kein Skelett). Bewegliche Teile bewegt das Spiel.
 * - Farben als Vertexfarben, keine Texturen. Materialnamen aus `PROP_MATERIALS`.
 * - Laufzeit-Materialien (`PROP_RUNTIME_MATERIALS`) sind im GLB weiß: `akzent` färbt das Spiel
 *   in die Slot-Farbe (immer zusammen mit dem Slot-Symbol), `zustand` nach Spielzustand
 *   (Bräunung, Türfarbe). Farbe allein trägt nie Information (`docs/art-direction.md`).
 */

export const PROP_MATERIALS = ['lack', 'matt', 'glas', 'metall', 'akzent', 'zustand'] as const;
export type PropMaterial = (typeof PROP_MATERIALS)[number];

export const PROP_RUNTIME_MATERIALS = ['akzent', 'zustand'] as const;
export type PropRuntimeMaterial = (typeof PROP_RUNTIME_MATERIALS)[number];

export interface PropSetInfo {
  /** Familie aus `docs/minigames/katalog.md` (1–20) oder `null` für Kulissen nach Ort. */
  readonly family: number | null;
  readonly title: string;
  readonly props: readonly string[];
}

/** Requisiten-Sets: je Familie eins (wächst mit den Familien-Wellen), dazu Kulissen nach Ort. */
export const PROP_SETS = {
  fangen: {
    family: 1,
    title: 'Fangen & Sammeln',
    props: ['eichel', 'eichel-faul', 'kescher', 'sammelkorb'],
  },
  ausweichen: {
    family: 2,
    title: 'Ausweichen & Überleben',
    props: ['rasensprenger', 'schlauchtrommel'],
  },
  rempeln: {
    family: 3,
    title: 'Rempeln & Runterschubsen',
    props: ['eiswuerfel', 'limoglas', 'zitronenscheibe', 'strohhalm'],
  },
  timing: { family: 4, title: 'Timing & Rhythmus', props: ['toaster', 'toast'] },
  reflex: { family: 5, title: 'Reflex & Reaktion', props: ['mausefalle', 'kaese'] },
  zocken: {
    family: 11,
    title: 'Zocken & Push-your-luck',
    props: ['bienenstock', 'honigtopf', 'biene'],
  },
  bluff: { family: 12, title: 'Bluff & geheime Wahl', props: ['tuer', 'tuerschild'] },
  revier: { family: 13, title: 'Revier & Malen', props: ['matscheimer', 'regenwolke'] },
  'kulisse-garten': {
    family: null,
    title: 'Kulisse Garten',
    props: ['zaunfeld', 'blumentopf', 'giesskanne'],
  },
  'kulisse-kueche': {
    family: null,
    title: 'Kulisse Küche',
    props: ['kochtopf', 'milchkanne', 'holzloeffel'],
  },
  'kulisse-bad': {
    family: null,
    title: 'Kulisse Bad',
    props: ['badewanne', 'quietscheente', 'seifenstueck'],
  },
  'kulisse-teich': {
    family: null,
    title: 'Kulisse Teich',
    props: ['seerose', 'schilf', 'steg'],
  },
  'kulisse-spielzimmer': {
    family: null,
    title: 'Kulisse Spielzimmer',
    props: ['bauklotz', 'spielball', 'spielkiste'],
  },
  'kulisse-wald': {
    family: null,
    title: 'Kulisse Wald',
    props: ['baumstumpf', 'fliegenpilz', 'ast'],
  },
  'kulisse-dachboden': {
    family: null,
    title: 'Kulisse Dachboden',
    props: ['truhe', 'koffer', 'lampe'],
  },
} as const satisfies Record<string, PropSetInfo>;
export type PropSetId = keyof typeof PROP_SETS;
export type PropId = (typeof PROP_SETS)[PropSetId]['props'][number];

export const PROP_SET_IDS = Object.keys(PROP_SETS) as PropSetId[];
export const PROP_IDS: readonly PropId[] = PROP_SET_IDS.flatMap(
  (set) => PROP_SETS[set].props as readonly PropId[],
);

/** Laufzeit-Materialien je Requisit (müssen im GLB vorhanden und benutzt sein). */
export const PROP_RUNTIME: Partial<Readonly<Record<PropId, readonly PropRuntimeMaterial[]>>> = {
  sammelkorb: ['akzent'],
  toaster: ['akzent'],
  toast: ['zustand'],
  honigtopf: ['akzent'],
  tuer: ['zustand'],
  matscheimer: ['akzent'],
};

/**
 * Requisiten-Sets je Minispiel (Katalog-Nummer). Daraus rechnet `check:assets` das Budget je
 * Spiel: alle Requisiten der Sets zusammen (jedes einmal, Instanzen kosten keinen Download).
 * Neue Spiele tragen sich hier ein, bevor sie Requisiten laden.
 */
export const MINIGAME_PROP_SETS: Readonly<Record<string, readonly PropSetId[]>> = {
  'MG-001': ['fangen', 'kulisse-garten'],
  'MG-011': ['ausweichen', 'kulisse-garten'],
  'MG-023': ['rempeln'],
  'MG-033': ['timing', 'kulisse-kueche'],
  'MG-045': ['reflex', 'kulisse-kueche'],
  'MG-101': ['zocken', 'kulisse-garten'],
  'MG-111': ['bluff', 'kulisse-garten'],
  'MG-121': ['revier', 'kulisse-garten'],
};

/**
 * Orte der Arena-Vorlagen (`ORTE` in `@chaos-party/minigame-kit`, CHAOS-83) – je Ort ein
 * Kulissen-Set `kulisse-<ort>` (CHAOS-222). Die Liste hier spiegelt `ORTE`, weil `assets` nicht
 * vom Baukasten abhängt; `props.test.ts` hält beide gleich.
 */
export const PROP_PLACES = [
  'garten',
  'kueche',
  'bad',
  'teich',
  'spielzimmer',
  'wald',
  'dachboden',
] as const;
export type PropPlace = (typeof PROP_PLACES)[number];

/** Kulissen-Set eines Orts (Set-Dressing für die Arena-Vorlage dieses Orts). */
export function placePropSet(place: PropPlace): PropSetId {
  return `kulisse-${place}`;
}

/** Manifest-id eines Requisits. */
export function propAssetId(id: PropId): string {
  return `requisit-${id}`;
}

/** Pfad der GLB-Datei relativ zu `packages/assets` (Paket-Export `@chaos-party/assets/models/*`). */
export function propModelPath(id: PropId): string {
  return `models/props/${id}.glb`;
}

/** Alle Requisiten eines Minispiels (jedes einmal, in Set-Reihenfolge). */
export function minigameProps(minigameId: string): readonly PropId[] {
  const sets = MINIGAME_PROP_SETS[minigameId] ?? [];
  return [...new Set(sets.flatMap((set) => PROP_SETS[set].props as readonly PropId[]))];
}
