/**
 * Asset-Prüfung (CHAOS-28): Das echte Manifest ist grün; kaputte Test-Manifeste (fehlende
 * Datei, fehlende/unerlaubte Lizenz, falsche Animation, Budget überschritten …) schlagen mit
 * verständlicher Meldung fehl – so bricht CI bei fehlender Lizenz oder fehlendem Asset ab.
 */
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import type { AssetManifest } from '../manifest.ts';
import { checkAssets } from './checkAssets.ts';
import { parseGlb } from './glb.ts';

const packageDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const repoRoot = join(packageDir, '..', '..');

async function realManifest(): Promise<AssetManifest> {
  return JSON.parse(await readFile(join(packageDir, 'manifest.json'), 'utf8')) as AssetManifest;
}

/** Baut ein Mini-Repository mit Asset-Ordner, Generator und den echten Dateien. */
async function sandbox(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'chaos-assets-'));
  await cp(join(packageDir, 'models'), join(dir, 'packages/assets/models'), { recursive: true });
  await cp(join(packageDir, 'textures'), join(dir, 'packages/assets/textures'), {
    recursive: true,
  });
  // Klang-Dateien (CHAOS-223), CC0 aus `import:sounds`.
  await cp(join(packageDir, 'sounds'), join(dir, 'packages/assets/sounds'), { recursive: true });
  // Figuren (CHAOS-58) und Porträts (CHAOS-61) entstehen in Blender.
  await mkdir(join(dir, 'packages/assets/blender'), { recursive: true });
  await writeFile(join(dir, 'packages/assets/blender/build-all.sh'), '# Generator\n');
  await writeFile(join(dir, 'packages/assets/blender/portraits-all.sh'), '# Generator\n');
  // Requisiten (CHAOS-88).
  await writeFile(join(dir, 'packages/assets/blender/props-all.sh'), '# Generator\n');
  return dir;
}

/** Manifest nur mit Datei-Assets (prozedurale Einträge zeigen auf Host-Code außerhalb), ohne
 *  Build-Artefakte (die nennen auch prozedurale Assets; geprüft in `builds.test.ts`). */
async function fileManifest(): Promise<AssetManifest> {
  const real = await realManifest();
  return {
    version: real.version,
    budgets: real.budgets,
    assets: real.assets.filter(
      (a) => a.source === 'generated' || (a.source === 'imported' && !a.package),
    ),
  };
}

const dirs: string[] = [];
afterEach(async () => {
  for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true });
});

async function run(manifest: unknown, prepare?: (dir: string) => Promise<void>) {
  const dir = await sandbox();
  dirs.push(dir);
  await writeFile(join(dir, 'packages/assets/manifest.json'), JSON.stringify(manifest));
  if (prepare) await prepare(dir);
  return checkAssets({ repoRoot: dir });
}

/** Minimaler VP8L-Kopf (RIFF/WEBP) mit Maßen und Alpha-Bit – reicht für die Prüfung. */
function vp8l(width: number, height: number): Uint8Array {
  const out = new Uint8Array(32);
  const view = new DataView(out.buffer);
  out.set(new TextEncoder().encode('RIFF'), 0);
  view.setUint32(4, out.byteLength - 8, true);
  out.set(new TextEncoder().encode('WEBPVP8L'), 8);
  view.setUint32(16, 12, true);
  out[20] = 0x2f;
  view.setUint32(21, ((width - 1) | ((height - 1) << 14) | (1 << 28)) >>> 0, true);
  return out;
}

/** GLB mit geändertem JSON-Chunk neu schreiben (BIN-Chunk bleibt). */
function patchGlb(bytes: Uint8Array, change: (json: Record<string, unknown>) => void): Uint8Array {
  const { json, bin } = parseGlb(bytes);
  const copy = JSON.parse(JSON.stringify(json)) as Record<string, unknown>;
  change(copy);
  let text = JSON.stringify(copy);
  while (text.length % 4 !== 0) text += ' ';
  const jsonBytes = new TextEncoder().encode(text);
  const binLength = bin ? bin.byteLength : 0;
  const total = 12 + 8 + jsonBytes.byteLength + (bin ? 8 + binLength : 0);
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, total, true);
  view.setUint32(12, jsonBytes.byteLength, true);
  view.setUint32(16, 0x4e4f534a, true);
  out.set(jsonBytes, 20);
  if (bin) {
    const at = 20 + jsonBytes.byteLength;
    view.setUint32(at, binLength, true);
    view.setUint32(at + 4, 0x004e4942, true);
    out.set(bin, at + 8);
  }
  return out;
}

describe('Asset-Prüfung', () => {
  it('echtes Manifest im Repository ist grün', async () => {
    const result = await checkAssets({ repoRoot });
    expect(result.errors).toEqual([]);
    expect(result.checked).toBeGreaterThanOrEqual(8);
  });

  it('Sandbox mit unveränderten Dateien ist grün', async () => {
    const result = await run(await fileManifest());
    expect(result.errors).toEqual([]);
  });

  it('fehlende Datei', async () => {
    const result = await run(await fileManifest(), async (dir) => {
      await rm(join(dir, 'packages/assets/models/characters/sock.glb'));
    });
    expect(result.errors).toContain(
      'Asset „figur-sock“: Datei fehlt: packages/assets/models/characters/sock.glb',
    );
  });

  it('Datei ohne Manifest-Eintrag', async () => {
    const manifest = await fileManifest();
    const result = await run(
      { ...manifest, assets: manifest.assets.filter((a) => a.id !== 'portraet-sock-akzent') },
      async (dir) => {
        await mkdir(join(dir, 'packages/assets/sounds'), { recursive: true });
        await writeFile(join(dir, 'packages/assets/sounds/geheim.ogg'), 'x');
      },
    );
    expect(result.errors).toContain(
      'Datei ohne Manifest-Eintrag: packages/assets/textures/portraits/sock-akzent.webp',
    );
    expect(result.errors).toContain(
      'Datei ohne Manifest-Eintrag: packages/assets/sounds/geheim.ogg',
    );
  });

  it('fehlende Lizenz', async () => {
    const manifest = await fileManifest();
    const [first, ...others] = manifest.assets;
    const withoutLicense: Record<string, unknown> = { ...first };
    delete withoutLicense.license;
    const result = await run({
      ...manifest,
      assets: [withoutLicense, ...others],
    });
    expect(result.errors.join('\n')).toMatch(/Manifest ungültig bei assets\.0\.license/);
  });

  it('Lizenz nicht auf der Positivliste und fehlende Attribution', async () => {
    const manifest = await fileManifest();
    const assets = manifest.assets.map((a, i) => {
      if (i === 0) return { ...a, license: 'CC-BY-NC-4.0' };
      if (i === 1) {
        const rest: Record<string, unknown> = { ...a, license: 'CC-BY-4.0' };
        delete rest.attribution;
        return rest;
      }
      return a;
    });
    const result = await run({ ...manifest, assets });
    const text = result.errors.join('\n');
    expect(text).toMatch(/„figur-robot“: Lizenz „CC-BY-NC-4\.0“ nicht auf der Positivliste/);
    expect(text).toMatch(/„figur-cactus“: Lizenz CC-BY-4\.0 verlangt eine Attribution/);
  });

  it('falsche Animation in der GLB-Datei', async () => {
    const result = await run(await fileManifest(), async (dir) => {
      const path = join(dir, 'packages/assets/models/characters/robot.glb');
      const patched = patchGlb(new Uint8Array(await readFile(path)), (json) => {
        const animations = json.animations as { name: string }[];
        const idle = animations.find((a) => a.name === 'idle');
        if (idle) idle.name = 'idel';
      });
      await writeFile(path, patched);
    });
    const text = result.errors.join('\n');
    expect(text).toMatch(/„figur-robot“: Animation fehlt: idle/);
    expect(text).toMatch(/„figur-robot“: unbekannte Animation: idel/);
  });

  it('Akzent-Material fehlt', async () => {
    const result = await run(await fileManifest(), async (dir) => {
      const path = join(dir, 'packages/assets/models/characters/sock.glb');
      const patched = patchGlb(new Uint8Array(await readFile(path)), (json) => {
        for (const m of json.materials as { name: string }[])
          if (m.name === 'akzent') m.name = 'rot';
      });
      await writeFile(path, patched);
    });
    expect(result.errors.join('\n')).toMatch(/„figur-sock“: Material „akzent“ fehlt/);
  });

  it('Figuren-Textur nur als normalTexture (CHAOS-172)', async () => {
    const result = await run(await fileManifest(), async (dir) => {
      const path = join(dir, 'packages/assets/models/characters/sock.glb');
      const patched = patchGlb(new Uint8Array(await readFile(path)), (json) => {
        const mats = json.materials as Record<string, unknown>[];
        const strick = mats.find((m) => m.name === 'strick');
        if (!strick) throw new Error('Material strick fehlt');
        strick.pbrMetallicRoughness = { baseColorTexture: { index: 0 } };
      });
      await writeFile(path, patched);
    });
    expect(result.errors.join('\n')).toMatch(
      /„figur-sock“: Material „strick“ nutzt eine Textur in „pbrMetallicRoughness\.baseColorTexture“/,
    );
  });

  it('Normal-Textur über Budget (CHAOS-172)', async () => {
    const manifest = await fileManifest();
    const result = await run({
      ...manifest,
      budgets: {
        ...manifest.budgets,
        model: { ...manifest.budgets.model, maxImageBytes: 1024, maxImageSize: 128 },
      },
    });
    const text = result.errors.join('\n');
    expect(text).toMatch(/„figur-sock“: Bild 0 zu groß: .* > Budget 1\.0 KiB/);
    expect(text).toMatch(/„figur-sock“: Bild 0: 256×256 muss quadratisch mit Zweierpotenz bis 128/);
  });

  it('zu viele Bilder in einer Figur (CHAOS-172)', async () => {
    const manifest = await fileManifest();
    const result = await run({
      ...manifest,
      budgets: { ...manifest.budgets, model: { ...manifest.budgets.model, maxImages: 0 } },
    });
    expect(result.errors.join('\n')).toMatch(/„figur-robot“: 1 eingebettete Bilder, Budget 0/);
  });

  it('Budget überschritten', async () => {
    const manifest = await fileManifest();
    const assets = manifest.assets.map((a) =>
      a.id === 'figur-cactus' ? { ...a, budgetBytes: 1000 } : a,
    );
    const result = await run({
      ...manifest,
      budgets: { ...manifest.budgets, model: { ...manifest.budgets.model, maxTriangles: 100 } },
      assets,
    });
    const text = result.errors.join('\n');
    expect(text).toMatch(/„figur-cactus“: Datei zu groß: .* > Budget 1\.0 KiB/);
    expect(text).toMatch(/„figur-robot“: \d+ Dreiecke, Budget 100/);
  });

  it('Höhe im Manifest passt nicht zur Datei', async () => {
    const manifest = await fileManifest();
    const assets = manifest.assets.map((a) => (a.id === 'figur-sock' ? { ...a, height: 1.75 } : a));
    const result = await run({ ...manifest, assets });
    expect(result.errors.join('\n')).toMatch(/„figur-sock“: Höhe im Manifest 1\.75, gemessen 1\.5/);
  });

  it('importierte Natur-Assets: Herkunft, HDR und Kachelmaß (CHAOS-62)', async () => {
    const manifest = await fileManifest();
    const assets = manifest.assets.map((a) =>
      a.id === 'natur-mossy-rock-diff' ? { ...a, origin: undefined } : a,
    );
    const result = await run({ ...manifest, assets }, async (dir) => {
      const sky = join(dir, 'packages/assets/textures/sky/qwantani_noon_puresky.hdr');
      const bytes = await readFile(sky);
      await writeFile(sky, bytes.subarray(0, bytes.length - 100));
      await writeFile(
        join(dir, 'packages/assets/textures/nature/oak_veneer_01_nor.webp'),
        vp8l(300, 300),
      );
    });
    const text = result.errors.join('\n');
    expect(text).toMatch(/„natur-mossy-rock-diff“: importierte Datei ohne Herkunft/);
    expect(text).toMatch(/„himmel-qwantani-noon-puresky“: HDR nicht lesbar – Datei endet/);
    expect(text).toMatch(/„natur-oak-veneer-01-nor“: Natur-Textur 300×300 muss quadratisch/);
  });

  it('Lizenzprüfung: alle importierten Natur-Assets sind CC0', async () => {
    const manifest = await realManifest();
    const imported = manifest.assets.filter((a) => /^(natur|himmel)-/.test(a.id));
    expect(imported.length).toBe(24);
    for (const asset of imported) {
      expect(asset.license).toBe('CC0-1.0');
      expect(asset.origin).toMatch(/^https:\/\/polyhaven\.com\/a\//);
    }
  });

  it('SVG mit Skript', async () => {
    const manifest = await fileManifest();
    const svg = {
      id: 'test-svg',
      kind: 'texture' as const,
      source: 'generated' as const,
      path: 'packages/assets/textures/test.svg',
      description: 'Test-SVG',
      generator: 'packages/assets/blender/portraits-all.sh',
      license: 'GPL-3.0-only',
      budgetBytes: 1024,
    };
    const result = await run({ ...manifest, assets: [...manifest.assets, svg] }, async (dir) => {
      await writeFile(
        join(dir, svg.path),
        '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
      );
    });
    expect(result.errors).toContain('Asset „test-svg“: SVG enthält <script>');
  });

  it('kaputtes Porträt-WebP', async () => {
    const result = await run(await fileManifest(), async (dir) => {
      await writeFile(join(dir, 'packages/assets/textures/portraits/robot.webp'), 'kein Bild');
    });
    expect(result.errors).toContain('Asset „portraet-robot“: WebP nicht lesbar – Datei zu kurz');
    expect(result.errors).toContain(
      'Porträt „robot“: packages/assets/textures/portraits/robot.webp fehlt im Manifest oder ist nicht lesbar',
    );
  });

  it('Porträt ohne Akzent-Maske', async () => {
    const manifest = await fileManifest();
    const result = await run(
      { ...manifest, assets: manifest.assets.filter((a) => a.id !== 'portraet-cactus-akzent') },
      async (dir) => {
        await rm(join(dir, 'packages/assets/textures/portraits/cactus-akzent.webp'));
      },
    );
    expect(result.errors).toEqual([
      'Porträt „cactus“: packages/assets/textures/portraits/cactus-akzent.webp fehlt im Manifest oder ist nicht lesbar',
    ]);
  });

  it('Maske mit anderer Größe als das Porträt', async () => {
    const result = await run(await fileManifest(), async (dir) => {
      // Gültiges verlustfreies WebP 300×300 mit Alpha (nur der Kopf zählt für die Prüfung).
      await writeFile(
        join(dir, 'packages/assets/textures/portraits/sock-akzent.webp'),
        vp8l(300, 300),
      );
    });
    expect(result.errors).toEqual(['Porträt „sock“: Maske 300×300 passt nicht zum Bild 384×384']);
  });

  it('generiert ohne Generator-Skript', async () => {
    const manifest = await fileManifest();
    const assets = manifest.assets.map((a) =>
      a.id === 'figur-robot' ? { ...a, generator: 'packages/assets/src/generator/fehlt.ts' } : a,
    );
    const result = await run({ ...manifest, assets });
    expect(result.errors).toContain(
      'Asset „figur-robot“: Generator fehlt: packages/assets/src/generator/fehlt.ts',
    );
  });

  it('Paket-Lizenz muss zur package.json passen', async () => {
    const manifest = await realManifest();
    const font = manifest.assets.find((a) => a.id === 'schrift-nunito');
    expect(font).toBeDefined();
    const result = await run(
      { ...manifest, assets: [{ ...font, license: 'MIT' }] },
      async (dir) => {
        // Einbindungs-Datei und Paket wie im echten Host.
        await mkdir(join(dir, 'apps/host/src'), { recursive: true });
        await writeFile(join(dir, 'apps/host/src/main.tsx'), '');
        await mkdir(join(dir, 'apps/host/node_modules/@fontsource-variable/nunito'), {
          recursive: true,
        });
        await writeFile(
          join(dir, 'apps/host/node_modules/@fontsource-variable/nunito/package.json'),
          JSON.stringify({ name: '@fontsource-variable/nunito', license: 'OFL-1.1' }),
        );
      },
    );
    expect(result.errors.join('\n')).toMatch(
      /„schrift-nunito“: Paket „@fontsource-variable\/nunito“ hat Lizenz OFL-1\.1, Manifest sagt MIT/,
    );
  });

  it('kein gültiges JSON', async () => {
    const dir = await sandbox();
    dirs.push(dir);
    await writeFile(join(dir, 'packages/assets/manifest.json'), '{ kaputt');
    const result = await checkAssets({ repoRoot: dir });
    expect(result.errors[0]).toMatch(/^Manifest ist kein gültiges JSON/);
  });
});

describe('Requisiten (CHAOS-88)', () => {
  const toaster = 'packages/assets/models/props/toaster.glb';

  it('Requisit aus dem Katalog ohne Manifest-Eintrag', async () => {
    const manifest = await fileManifest();
    const result = await run({
      ...manifest,
      assets: manifest.assets.filter((a) => a.id !== 'requisit-kaese'),
    });
    expect(result.errors).toContain(
      'Requisit „kaese“: Manifest-Eintrag „requisit-kaese“ (Art prop) fehlt',
    );
    expect(result.errors).toContain(
      'Datei ohne Manifest-Eintrag: packages/assets/models/props/kaese.glb',
    );
  });

  it('Art prop außerhalb des Katalogs', async () => {
    const manifest = await fileManifest();
    const kaese = manifest.assets.find((a) => a.id === 'requisit-kaese');
    if (!kaese) throw new Error('requisit-kaese fehlt im Manifest');
    const result = await run({
      ...manifest,
      assets: [...manifest.assets, { ...kaese, id: 'requisit-extra' }],
    });
    expect(result.errors).toContain(
      'Asset „requisit-extra“: Art prop, aber nicht im Requisiten-Katalog (props.ts)',
    );
  });

  it('Budget je Requisit: Dreiecke, Materialien', async () => {
    const manifest = await fileManifest();
    const result = await run({
      ...manifest,
      budgets: {
        ...manifest.budgets,
        prop: { ...manifest.budgets.prop, maxTriangles: 2000, maxMaterials: 3 },
      },
    });
    const errors = result.errors.join('\n');
    expect(errors).toMatch(/Asset „requisit-toaster“: \d+ Dreiecke, Budget 2000/);
    expect(errors).toMatch(/Asset „requisit-toaster“: 4 Materialien, Budget 3/);
  });

  it('Budget je Minispiel: Summe der Requisiten (Bytes, Dreiecke, Anzahl)', async () => {
    const manifest = await fileManifest();
    const result = await run({
      ...manifest,
      budgets: {
        ...manifest.budgets,
        minigame: { maxBytes: 100 * 1024, maxTriangles: 3000, maxProps: 6 },
      },
    });
    const errors = result.errors.join('\n');
    // MG-001 hat 7 Requisiten (Fangen + Garten), MG-023 ist klein (nur Rempeln, < 100 KiB).
    expect(errors).toMatch(/Minispiel MG-101: Requisiten [\d.]+ KiB > Budget 100\.0 KiB/);
    expect(errors).toMatch(/Minispiel MG-011: Requisiten \d+ Dreiecke > Budget 3000/);
    expect(errors).toMatch(/Minispiel MG-001: 7 Requisiten > Budget 6/);
    expect(errors).not.toMatch(/MG-023: Requisiten [\d.]+ KiB/);
  });

  it('Höhe im Manifest muss zur Datei passen', async () => {
    const manifest = await fileManifest();
    const result = await run({
      ...manifest,
      assets: manifest.assets.map((a) => (a.id === 'requisit-toaster' ? { ...a, height: 1 } : a)),
    });
    expect(result.errors.join('\n')).toMatch(
      /„requisit-toaster“: Höhe im Manifest 1, gemessen 0\.6\d\d/,
    );
  });

  it('Requisit mit Animation, unbekanntem Material oder ohne Laufzeit-Material', async () => {
    const result = await run(await fileManifest(), async (dir) => {
      const file = join(dir, toaster);
      const bytes = new Uint8Array(await readFile(file));
      await writeFile(
        file,
        patchGlb(bytes, (json) => {
          const materials = json.materials as { name: string }[];
          const accent = materials.find((m) => m.name === 'akzent');
          if (accent) accent.name = 'gold';
          json.animations = [{ name: 'wackeln', channels: [], samplers: [] }];
        }),
      );
    });
    const errors = result.errors.join('\n');
    expect(errors).toMatch(/„requisit-toaster“: statisch erwartet, GLB hat 1 Animationen/);
    expect(errors).toMatch(/„requisit-toaster“: Material „gold“ unbekannt/);
    expect(errors).toMatch(
      /„requisit-toaster“: Laufzeit-Material „akzent“ fehlt oder ist an keinem Mesh/,
    );
  });

  it('Requisit ohne Vertexfarben', async () => {
    const result = await run(await fileManifest(), async (dir) => {
      const file = join(dir, toaster);
      const bytes = new Uint8Array(await readFile(file));
      await writeFile(
        file,
        patchGlb(bytes, (json) => {
          const meshes = json.meshes as { primitives: { attributes: Record<string, number> }[] }[];
          for (const mesh of meshes) {
            for (const primitive of mesh.primitives) delete primitive.attributes.COLOR_0;
          }
        }),
      );
    });
    expect(result.errors.join('\n')).toMatch(
      /„requisit-toaster“: Mesh „[^“]+“ \(Material „lack“\) ohne Vertexfarben \(COLOR_0\)/,
    );
  });

  it('Requisit nicht am Boden', async () => {
    const result = await run(await fileManifest(), async (dir) => {
      const file = join(dir, toaster);
      const bytes = new Uint8Array(await readFile(file));
      await writeFile(
        file,
        patchGlb(bytes, (json) => {
          const nodes = json.nodes as { name: string; translation?: number[] }[];
          const root = nodes.find((n) => n.name === 'toaster');
          if (root) root.translation = [0, 0.2, 0];
        }),
      );
    });
    expect(result.errors.join('\n')).toMatch(/„requisit-toaster“: Boden nicht bei y = 0/);
  });
});
