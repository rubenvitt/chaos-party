#!/usr/bin/env node
/**
 * USDZ-Assets für den nativen Apple-Host (CHAOS-140, ADR-019 §5). Ein Befehl:
 *
 *   pnpm build:apple-assets                    # alles nach build/apple-assets/
 *   pnpm build:apple-assets --nur=figuren      # nur Figuren (≈ 30 s)
 *   pnpm build:apple-assets --nur=requisiten   # nur Requisiten der Minispiele (≈ 5 s)
 *   pnpm build:apple-assets --nur=brett        # nur die Kulissen (je Brett ≈ 3–10 min, Software-Rendering)
 *   pnpm build:apple-assets --nur=brett --brett=wackelwald   # nur eine Kulisse
 *   pnpm build:apple-assets --out=<ordner>     # anderer Ausgabeordner
 *
 * Ausgabe (nicht eingecheckt):
 * - `figuren/<id>.usdz` direkt aus den bpy-Skripten (`packages/assets/blender/build.py`):
 *   Vertexfarben als Farbtextur gebacken, Materialien als UsdPreviewSurface mit Rauheit,
 *   Clearcoat, Metall und Leuchten, alle Clips auf einer Zeitleiste;
 * - `figuren/<id>.clips.json`: Lage der Clips auf der Zeitleiste (Sekunden, für `trimmed`);
 * - je Brett aus `BOARD_REGISTRY` (CHAOS-212) ein Ordner `bretter/<brett-id>/` mit
 *   - `brett.usdz`: Kulisse aus dem Web-Host (`scripts/lib/board-export.mjs`) über Blender nach
 *     USDZ (`packages/assets/usd/glb_to_usdz.py`), mit Feld-Ankern `feld_<id>` aus game-core;
 *   - `brett.szene.json` (Kamera, Licht, Figurenorte, Felder), `brett.instanzen.json` (Gras);
 *   jedes Brett braucht im Manifest ein Artefakt `bretter/<brett-id>/brett.usdz`;
 * - `requisiten/<id>.usdz` je Requisit aus `PROP_IDS` (CHAOS-221) direkt aus
 *   `packages/assets/blender/props.py --usdz`: Vertexfarben als Farbtextur gebacken,
 *   Laufzeit-Materialien `akzent`/`zustand` weiß; jedes braucht ein Manifest-Artefakt;
 * - `herkunft.json`: Lizenzen und Herkunft je Artefakt aus `packages/assets/manifest.json`.
 *
 * Danach prüft `packages/assets/usd/check_usdz.py` (usd-core, ohne Mac) alles, auf einem Mac
 * zusätzlich `packages/assets/usd/check_realitykit.swift` (RealityKit lädt; `RK_CHECK=0` lässt
 * das weg). `--ohne-pruefung` überspringt beide.
 *
 * Python: Blender als Modul (`bpy==5.3.0`) braucht Python 3.13. Ohne `BLENDER_PYTHON` legt das
 * Skript `.venv-blender` mit `uv` an (wie `packages/assets/blender/build-all.sh`).
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { provenance } from '../packages/assets/src/builds.ts';
import { BOARD_REGISTRY } from '../packages/game-core/src/board/registry.ts';
import { CHARACTER_IDS } from '../packages/assets/src/contract.ts';
import { ManifestSchema } from '../packages/assets/src/manifest.ts';
import { PROP_IDS } from '../packages/assets/src/props.ts';
import { exportBoards } from './lib/board-export.mjs';
import { boardImageProblems, glbImageNames } from './lib/board-images.mjs';

const BUILD = 'apple-host';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = join(root, 'packages/assets/manifest.json');
const manifest = ManifestSchema.parse(JSON.parse(readFileSync(manifestPath, 'utf8')));
const build = manifest.builds?.[BUILD];
if (!build) throw new Error(`Build „${BUILD}“ fehlt im Manifest`);

const args = process.argv.slice(2);
/** @param {string} name */
const option = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const PARTS = ['figuren', 'brett', 'requisiten'];
const only = option('nur');
if (only && !PARTS.includes(only)) {
  throw new Error(`--nur=${only}: erlaubt sind ${PARTS.join(', ')}`);
}
/** Teil bauen? Ohne `--nur` alle. */
const wants = (/** @type {string} */ part) => only === undefined || only === part;
const out = resolve(root, option('out') ?? build.out);
const onlyBoard = option('brett');
const boardIds = BOARD_REGISTRY.map((info) => info.id).filter(
  (id) => onlyBoard === undefined || id === onlyBoard,
);
if (boardIds.length === 0) throw new Error(`--brett=${String(onlyBoard)}: Brett nicht im Register`);
/** Artefakt-Pfad der Kulisse eines Bretts (CHAOS-212). */
const boardPath = (/** @type {string} */ id) => `bretter/${id}/brett.usdz`;
/** Artefakt-Pfad eines Requisits (CHAOS-221). */
const propPath = (/** @type {string} */ id) => `requisiten/${id}.usdz`;
// Vor dem langen Export: Fehlt einem Brett oder Requisit die Herkunft im Manifest, gleich abbrechen.
for (const path of [...boardIds.map(boardPath), ...PROP_IDS.map(propPath)]) {
  if (!build.artifacts.some((a) => a.path === path)) {
    throw new Error(`Artefakt ${path} fehlt im Manifest (builds.${BUILD}.artifacts)`);
  }
}
const check = !args.includes('--ohne-pruefung');

/**
 * @param {string} command
 * @param {string[]} commandArgs
 * @param {{ quiet?: RegExp }} [options] quiet: nur Zeilen ausgeben, die darauf passen
 */
function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    cwd: root,
    encoding: 'utf8',
    stdio: options.quiet ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (options.quiet) {
    const lines = `${result.stdout ?? ''}`.split('\n').filter((l) => options.quiet?.test(l));
    for (const line of lines) console.log(line);
  }
  if (result.status !== 0) {
    if (options.quiet) process.stderr.write(`${result.stdout ?? ''}${result.stderr ?? ''}`);
    throw new Error(`${command} ${commandArgs.join(' ')} → Exit-Code ${String(result.status)}`);
  }
}

function python() {
  const fromEnv = process.env.BLENDER_PYTHON;
  if (fromEnv) return fromEnv;
  const venv = join(root, '.venv-blender');
  const bin = join(venv, 'bin/python');
  if (!existsSync(bin)) {
    console.log('Lege .venv-blender an (Python 3.13, bpy, usd-core) …');
    run('uv', ['venv', '--python', '3.13', venv]);
  }
  // Idempotent und schnell, wenn schon alles da ist; holt usd-core in ältere Umgebungen nach.
  const reqs = join(root, 'packages/assets/blender/requirements.txt');
  const pip = spawnSync('uv', ['pip', 'install', '--quiet', '-r', reqs], {
    cwd: root,
    env: { ...process.env, VIRTUAL_ENV: venv },
    stdio: 'inherit',
  });
  if (pip.status !== 0) throw new Error('uv pip install fehlgeschlagen (uv installiert?)');
  return bin;
}

/** @param {string} file */
function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

const py = python();
mkdirSync(join(out, 'figuren'), { recursive: true });
const started = Date.now();

if (wants('figuren')) {
  for (const id of CHARACTER_IDS) {
    run(py, ['packages/assets/blender/build.py', id, join(out, 'figuren', `${id}.usdz`)], {
      quiet: /^Figur /,
    });
  }
}

if (wants('requisiten')) {
  const dir = join(out, 'requisiten');
  rmSync(dir, { recursive: true, force: true });
  run(py, ['packages/assets/blender/props.py', '--usdz', 'all', dir], {
    quiet: /^(Requisit|Deckkraft) /,
  });
  for (const id of PROP_IDS) {
    if (!existsSync(join(dir, `${id}.usdz`))) throw new Error(`${propPath(id)} nicht erzeugt`);
  }
}

if (wants('brett')) {
  // Kulisse vor CHAOS-212 lag direkt im Ausgabeordner; alte Reste nicht mitprüfen oder einpacken.
  for (const file of ['brett.usdz', 'brett.szene.json', 'brett.instanzen.json']) {
    rmSync(join(out, file), { force: true });
  }
  const work = mkdtempSync(join(tmpdir(), 'chaos-brett-'));
  try {
    console.log(`Bretter: Export aus dem Web-Host (Vite + Chromium): ${boardIds.join(', ')} …`);
    const results = await exportBoards({
      root,
      boards: boardIds,
      outFor: (id) => join(work, id ?? 'standard'),
      timeoutMs: Number(process.env.BOARD_EXPORT_TIMEOUT ?? 900_000),
      verbose: Boolean(process.env.BOARD_EXPORT_VERBOSE),
    });
    for (const { boardId, meta } of results) {
      if (boardId === undefined) continue;
      const from = join(work, boardId);
      const to = join(out, 'bretter', boardId);
      const artifact = build.artifacts.find((a) => a.path === boardPath(boardId));
      if (!artifact) throw new Error(`Artefakt ${boardPath(boardId)} fehlt im Manifest`);
      const problems = boardImageProblems(
        glbImageNames(readFileSync(join(from, 'brett.glb'))),
        manifest,
        artifact.from,
      );
      if (problems.length > 0) {
        throw new Error(
          `${boardId}: Brett-Texturen ohne passende Herkunft:\n  ${problems.join('\n  ')}`,
        );
      }
      rmSync(to, { recursive: true, force: true });
      mkdirSync(to, { recursive: true });
      run(
        py,
        ['packages/assets/usd/glb_to_usdz.py', join(from, 'brett.glb'), join(to, 'brett.usdz')],
        {
          quiet: /^(USDZ|WARNUNG)/,
        },
      );
      for (const file of ['brett.szene.json', 'brett.instanzen.json']) {
        copyFileSync(join(from, file), join(to, file));
      }
      console.log(`Brett ${boardId}: ${String(meta.fields?.length ?? 0)} Feld-Anker`);
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

const doc = provenance(manifest, BUILD);
writeFileSync(
  join(out, 'herkunft.json'),
  `${JSON.stringify(
    {
      ...doc,
      artifacts: doc.artifacts.map((a) => {
        const file = join(out, a.path);
        return existsSync(file)
          ? { ...a, bytes: readFileSync(file).byteLength, sha256: sha256(file) }
          : a;
      }),
    },
    null,
    2,
  )}\n`,
);

if (check) {
  const complete = only === undefined && onlyBoard === undefined ? ['--vollstaendig'] : [];
  run(py, [
    '-I',
    'packages/assets/usd/check_usdz.py',
    out,
    `--manifest=${manifestPath}`,
    ...complete,
  ]);
  const onMac = process.platform === 'darwin';
  if (onMac && process.env.RK_CHECK !== '0' && only === undefined) {
    run('swift', ['packages/assets/usd/check_realitykit.swift', out]);
  } else if (!onMac) {
    console.log('RealityKit-Prüfung übersprungen (nur auf einem Mac).');
  }
}

console.log(
  `Apple-Assets in ${relative(root, out) || '.'} (${String(Math.round((Date.now() - started) / 1000))} s)`,
);
