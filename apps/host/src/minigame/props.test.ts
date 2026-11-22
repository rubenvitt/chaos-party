/**
 * Requisiten-Lader des Browser-Hosts (CHAOS-237) headless mit NullEngine: lädt nur die Sets des
 * Spiels, legt Requisiten synchron an (Wurzel, Boden bei y = 0), färbt `akzent`/`zustand` je
 * Requisit getrennt, liefert für fremde Requisiten `null` und hinterlässt nach `dispose()` nichts.
 */
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial.js';
import type { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Logger } from '@babylonjs/core/Misc/logger.js';
import { Scene } from '@babylonjs/core/scene.js';
import { PROP_IDS, minigameProps, propModelPath, type PropId } from '@chaos-party/assets/props';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { PROP_MODEL_URLS, loadProps, type PropLibrary } from './props.ts';

let sources: Record<PropId, Uint8Array>;

beforeAll(async () => {
  const require = createRequire(import.meta.url);
  const assetsDir = dirname(require.resolve('@chaos-party/assets/manifest.json'));
  const entries = await Promise.all(
    PROP_IDS.map(
      async (id) =>
        [id, new Uint8Array(await readFile(join(assetsDir, propModelPath(id))))] as const,
    ),
  );
  sources = Object.fromEntries(entries) as Record<PropId, Uint8Array>;
});

let engine: NullEngine | null = null;
let scene: Scene | null = null;
let library: PropLibrary | null = null;

afterEach(() => {
  library?.dispose();
  scene?.dispose();
  engine?.dispose();
  library = null;
  scene = null;
  engine = null;
});

async function setup(game: string, warnings: string[] = []) {
  const level = Logger.LogLevels;
  Logger.LogLevels = Logger.ErrorLogLevel;
  engine = new NullEngine();
  Logger.LogLevels = level;
  scene = new Scene(engine);
  library = await loadProps(scene, game, {
    sources,
    warn: (message) => warnings.push(message),
  });
  return { scene, library };
}

function albedo(handleMeshes: readonly { material: unknown }[], name: string): Color3 | null {
  for (const mesh of handleMeshes) {
    const material = mesh.material;
    if (material instanceof PBRMaterial && material.name.startsWith(name)) {
      return material.albedoColor;
    }
  }
  return null;
}

describe('Requisiten im Browser-Host', () => {
  it('kennt für jedes Requisit eine GLB-URL', () => {
    expect(Object.keys(PROP_MODEL_URLS).sort()).toEqual([...PROP_IDS].sort());
  });

  it('lädt nur die Sets des Spiels', async () => {
    const { library: lib } = await setup('toaster-timing');
    expect(lib.loaded).toEqual(minigameProps('toaster-timing'));
    expect(lib.loaded).toContain('toaster');
    expect(lib.loaded).not.toContain('eichel');
  });

  it('legt Requisiten synchron an: Wurzel, Boden bei y = 0, Klon je Aufruf', async () => {
    const { scene: s, library: lib } = await setup('toaster-timing');
    const a = lib.create(s, 'toaster');
    const b = lib.create(s, 'toaster');
    expect(a?.id).toBe('toaster');
    expect(a?.root).not.toBe(b?.root);
    const meshes = a?.root.getChildMeshes(false) ?? [];
    expect(meshes.length).toBeGreaterThan(0);
    for (const mesh of meshes) mesh.computeWorldMatrix(true);
    const minY = Math.min(...meshes.map((m) => m.getBoundingInfo().boundingBox.minimumWorld.y));
    expect(Math.abs(minY)).toBeLessThan(0.01);
  });

  it('färbt akzent und zustand je Requisit getrennt', async () => {
    const { scene: s, library: lib } = await setup('toaster-timing');
    const blue = lib.create(s, 'toaster');
    const orange = lib.create(s, 'toaster');
    blue?.tint('akzent', '#0072B2');
    orange?.tint('akzent', '#E69F00');
    const blueMeshes = blue?.root.getChildMeshes(false) ?? [];
    const orangeMeshes = orange?.root.getChildMeshes(false) ?? [];
    expect(albedo(blueMeshes, 'akzent')?.toGammaSpace().toHexString()).toBe('#0072B2');
    expect(albedo(orangeMeshes, 'akzent')?.toGammaSpace().toHexString()).toBe('#E69F00');
    const toast = lib.create(s, 'toast');
    toast?.tint('zustand', '#D08A2E');
    const crumb = albedo(toast?.root.getChildMeshes(false) ?? [], 'zustand');
    expect(crumb?.toGammaSpace().toHexString()).toBe('#D08A2E');
    // Ohne das Material passiert nichts (der Toast hat kein `akzent`).
    expect(() => toast?.tint('akzent', '#000000')).not.toThrow();
  });

  it('liefert null für Requisiten außerhalb der Sets (mit einer Warnung)', async () => {
    const warnings: string[] = [];
    const { scene: s, library: lib } = await setup('toaster-timing', warnings);
    expect(lib.create(s, 'eichel')).toBeNull();
    expect(lib.create(s, 'eichel')).toBeNull();
    expect(lib.create(s, 'gibt-es-nicht')).toBeNull();
    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toMatch(/eichel steht nicht in den Sets von toaster-timing/);
  });

  it('Spiel ohne Sets: nichts geladen, kein Requisit', async () => {
    const { scene: s, library: lib } = await setup('sockenregen');
    expect(lib.loaded).toEqual([]);
    expect(lib.create(s, 'toaster')).toBeNull();
  });

  it('ein Requisit, das nicht lädt, fehlt nur', async () => {
    const warnings: string[] = [];
    const level = Logger.LogLevels;
    Logger.LogLevels = Logger.NoneLogLevel;
    engine = new NullEngine();
    scene = new Scene(engine);
    try {
      library = await loadProps(scene, 'toaster-timing', {
        sources: { ...sources, toaster: new Uint8Array([1, 2, 3]) },
        warn: (message) => warnings.push(message),
      });
    } finally {
      Logger.LogLevels = level;
    }
    expect(library.loaded).not.toContain('toaster');
    expect(library.loaded).toContain('toast');
    expect(library.create(scene, 'toaster')).toBeNull();
    expect(warnings.some((w) => w.startsWith('Requisit toaster lädt nicht'))).toBe(true);
  });

  it('dispose() räumt Requisiten und Vorlagen weg', async () => {
    const { scene: s, library: lib } = await setup('toaster-timing');
    const before = { meshes: s.meshes.length, materials: s.materials.length };
    const toaster = lib.create(s, 'toaster');
    toaster?.tint('akzent', '#0072B2');
    lib.create(s, 'toast')?.tint('zustand', '#ffffff');
    expect(s.meshes.length).toBeGreaterThan(before.meshes);
    toaster?.dispose();
    lib.dispose();
    expect(s.meshes).toHaveLength(0);
    expect(s.transformNodes).toHaveLength(0);
    expect(s.materials).toHaveLength(0);
  });
});
