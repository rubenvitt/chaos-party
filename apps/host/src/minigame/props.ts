/**
 * Requisiten der Minispiele im Browser-Host (CHAOS-237): lädt die GLBs aus `@chaos-party/assets`
 * (`packages/assets/models/props/<id>.glb`, CHAOS-88) für **eine** Minispiel-Szene vor, und zwar
 * nur die Requisiten-Sets dieses Spiels (`MINIGAME_PROP_SETS`, Laden bei Bedarf wie die Spiele
 * selbst, CHAOS-86). Danach legt `create()` Requisiten synchron an (Vertrag `PropFactory` aus dem
 * minigame-sdk), auch mitten im Spiel.
 *
 * Je Requisit: Klone der Meshes (Geometrie geteilt, wie die Figuren), Materialien geteilt; `akzent`
 * und `zustand` bekommen eine eigene Kopie, sobald das Spiel sie färbt. Die PBR-Materialien
 * bleiben (wie Figuren in Minispielen, `keepPbr`).
 *
 * Schlägt das Laden fehl, gibt es kein Modell (`create` → `null`) und das Spiel baut seine
 * Grundkörper (`stage.prop` im Baukasten); das Minispiel startet trotzdem.
 */
import type { AssetContainer } from '@babylonjs/core/assetContainer.js';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader.js';
import type { Material } from '@babylonjs/core/Materials/material.js';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import type { Scene } from '@babylonjs/core/scene.js';
import '@babylonjs/loaders/glTF/2.0/glTFLoader.js';
import '@babylonjs/loaders/glTF/2.0/Extensions/KHR_materials_clearcoat.js';
import '@babylonjs/loaders/glTF/2.0/Extensions/KHR_materials_emissive_strength.js';
import { PROP_IDS, minigameProps, type PropId } from '@chaos-party/assets/props';
import type { PropFactory, PropHandle, PropTint } from '@chaos-party/minigame-sdk/babylon';

const files = import.meta.glob<string>('../../../../packages/assets/models/props/*.glb', {
  query: '?url',
  import: 'default',
  eager: true,
});

/** URL je Requisit (Vite kopiert die GLBs in den Build, geladen wird erst im Minispiel). */
export const PROP_MODEL_URLS: Readonly<Partial<Record<PropId, string>>> = Object.fromEntries(
  Object.entries(files).map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1, -4), url]),
);

/** Quelle je Requisit: URL oder die Bytes der GLB-Datei (Tests in Node). */
export type PropSource = string | ArrayBufferView;

export interface LoadPropsOptions {
  readonly sources?: Partial<Readonly<Record<PropId, PropSource>>>;
  /** Meldung bei einem Requisit, das nicht lädt (Standard `console.warn`). */
  readonly warn?: (message: string) => void;
}

export interface PropLibrary extends PropFactory {
  /** Geladene Requisiten (Reihenfolge der Sets). */
  readonly loaded: readonly PropId[];
  /** Dauer des Ladens in ms (alle Requisiten parallel). */
  readonly loadMs: number;
  dispose(): void;
}

/** Name ohne Klon-Endung (`akzent#2` → `akzent`). */
function baseName(name: string): string {
  const hash = name.indexOf('#');
  return hash < 0 ? name : name.slice(0, hash);
}

function isPropId(id: string): id is PropId {
  return (PROP_IDS as readonly string[]).includes(id);
}

async function loadContainer(scene: Scene, id: PropId, source: PropSource) {
  return LoadAssetContainerAsync(
    typeof source === 'string'
      ? source
      : new Uint8Array(source.buffer, source.byteOffset, source.byteLength),
    scene,
    { pluginExtension: '.glb', name: `${id}.glb` },
  );
}

function tintMaterial(material: Material, hex: string): void {
  const color = Color3.FromHexString(hex);
  if (material instanceof PBRMaterial) material.albedoColor = color.toLinearSpace();
  else if (material instanceof StandardMaterial) material.diffuseColor = color;
}

let instanceCounter = 0;

function instantiate(scene: Scene, id: PropId, container: AssetContainer): PropHandle {
  const tag = String(++instanceCounter);
  const entries = container.instantiateModelsToScene((name) => `${name}#${tag}`, false, {
    doNotInstantiate: true,
  });
  const root = new TransformNode(`requisit-${id}-${tag}`, scene);
  for (const node of entries.rootNodes) node.parent = root;
  const meshes = root.getChildMeshes(false);
  for (const mesh of meshes) mesh.isPickable = false;
  /** Eigene Materialkopie je Laufzeit-Material (erst beim ersten Färben). */
  const own = new Map<PropTint, Material>();
  let disposed = false;
  return {
    id,
    root,
    tint(material, hex) {
      if (disposed) return;
      let copy = own.get(material);
      if (!copy) {
        const users = meshes.filter(
          (mesh) => mesh.material && baseName(mesh.material.name) === material,
        );
        const source = users[0]?.material;
        if (!source) return;
        copy = source.clone(`${material}#${tag}`) ?? source;
        for (const mesh of users) mesh.material = copy;
        own.set(material, copy);
      }
      tintMaterial(copy, hex);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      entries.dispose();
      for (const material of own.values()) material.dispose();
      root.dispose(false, false);
    },
  };
}

/**
 * Lädt die Requisiten von `minigameId` (alle Sets aus `MINIGAME_PROP_SETS`) für `scene`. Ein
 * Requisit, das nicht lädt, fehlt nur (Warnung); das Promise lehnt nie ab.
 */
export async function loadProps(
  scene: Scene,
  minigameId: string,
  options: LoadPropsOptions = {},
): Promise<PropLibrary> {
  const warn =
    options.warn ??
    ((message: string) => {
      console.warn(message);
    });
  const ids = minigameProps(minigameId);
  const containers = new Map<PropId, AssetContainer>();
  const started = performance.now();
  await Promise.all(
    ids.map(async (id) => {
      const source = options.sources?.[id] ?? PROP_MODEL_URLS[id];
      if (source === undefined) {
        warn(`Requisit ${id}: keine GLB-Datei`);
        return;
      }
      try {
        containers.set(id, await loadContainer(scene, id, source));
      } catch (error) {
        warn(
          `Requisit ${id} lädt nicht: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }),
  );
  const loadMs = performance.now() - started;
  const handles = new Set<PropHandle>();
  const warned = new Set<string>();
  let disposed = false;
  return {
    loaded: ids.filter((id) => containers.has(id)),
    loadMs,
    create(target, id) {
      if (disposed || target !== scene) return null;
      const container = isPropId(id) ? containers.get(id) : undefined;
      if (!container) {
        if (!warned.has(id) && !ids.includes(id as PropId)) {
          warned.add(id);
          warn(`Requisit ${id} steht nicht in den Sets von ${minigameId} (MINIGAME_PROP_SETS)`);
        }
        return null;
      }
      const handle = instantiate(scene, id as PropId, container);
      const dispose = handle.dispose.bind(handle);
      const tracked: PropHandle = {
        ...handle,
        tint: handle.tint.bind(handle),
        dispose() {
          handles.delete(tracked);
          dispose();
        },
      };
      handles.add(tracked);
      return tracked;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const handle of [...handles]) handle.dispose();
      for (const container of containers.values()) container.dispose();
      containers.clear();
    },
  };
}
