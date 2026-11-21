// Budget für das Host-Bundle (CHAOS-53, CHAOS-86). Läuft nach `pnpm build`.
//
// 1. Start: Was `apps/host/dist/index.html` sofort lädt (Einstiegs-Skript plus alle
//    `modulepreload`-Dateien), muss klein bleiben und darf keine Babylon-Engine enthalten.
//    Babylon, Arena, Brett und Minispiele kommen per dynamischem Import
//    (`apps/host/src/lazyScenes.ts`).
// 2. Minispiele (CHAOS-86): Jedes Minispiel (`packages/minigames/src/<ordner>/index.ts`) ist ein
//    eigener Chunk, der weder im Start noch in der statischen Kette der Minispiel-Bühne liegt.
//    Sonst wüchsen Start bzw. Bühne mit jedem neuen Spiel. Grundlage ist das Vite-Manifest
//    (`dist/.vite/manifest.json`, `build.manifest` in `apps/host/vite.config.ts`).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

/** Obergrenze Start roh in Bytes (Stand CHAOS-53: ≈ 404 kB, davon React-DOM ≈ 200 kB). */
const BUDGET_BYTES = 520 * 1024;
/**
 * Höchstzahl Dateien im Start (Stand CHAOS-86: 6). Fängt ab, wenn Rolldown je Minispiel eine
 * eigene Datei in den Start legt (z. B. je Steckbrief `info.ts`, siehe `codeSplitting` in
 * `apps/host/vite.config.ts`): Dann wüchse die Zahl der Anfragen mit dem Katalog.
 */
const MAX_START_FILES = 10;
/** Kennung der Babylon-Engine im gebauten Code (`AbstractEngine.Version`-Text). */
const ENGINE_MARKER = 'Babylon.js v';
/** Einstieg der Minispiel-Bühne im Manifest (`loadMinigameScreen` in `lazyScenes.ts`). */
const STAGE_ENTRY = 'src/minigame/MinigameScreenById.tsx';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(repo, 'apps', 'host', 'dist');
let html;
try {
  html = readFileSync(join(dist, 'index.html'), 'utf8');
} catch {
  console.error('apps/host/dist/index.html fehlt – vorher `pnpm build` ausführen.');
  process.exit(1);
}

/** @param {number} bytes */
const kb = (bytes) => `${(bytes / 1024).toFixed(0)} kB`;
/** @type {Map<string, { raw: number, gzip: number, engine: boolean }>} */
const sizes = new Map();
/** @param {string} file */
function sizeOf(file) {
  let size = sizes.get(file);
  if (!size) {
    const content = readFileSync(join(dist, file));
    size = {
      raw: content.length,
      gzip: gzipSync(content).length,
      engine: content.includes(ENGINE_MARKER),
    };
    sizes.set(file, size);
  }
  return size;
}
/** @param {Iterable<string>} files */
function total(files) {
  let raw = 0;
  let gzip = 0;
  for (const file of files) {
    raw += sizeOf(file).raw;
    gzip += sizeOf(file).gzip;
  }
  return { raw, gzip };
}

let failed = false;
/** @param {string} message */
function fail(message) {
  console.error(message);
  failed = true;
}

// 1. Start
const startFiles = [
  ...html.matchAll(/<(?:script[^>]*\ssrc|link[^>]*rel="modulepreload"[^>]*\shref)="([^"]+\.js)"/g),
].map((match) => String(match[1]).replace(/^\/host\//, ''));
if (startFiles.length === 0) {
  console.error('Kein Skript in apps/host/dist/index.html gefunden.');
  process.exit(1);
}
const start = total(startFiles);
console.log(
  `Host-Start-Bundle: ${String(startFiles.length)} Dateien, ${kb(start.raw)} (gzip ${kb(start.gzip)}), Budget ${kb(BUDGET_BYTES)}`,
);
if (start.raw > BUDGET_BYTES)
  fail(`Start-Bundle über Budget: ${kb(start.raw)} > ${kb(BUDGET_BYTES)}.`);
if (startFiles.length > MAX_START_FILES) {
  fail(
    `Start-Bundle hat ${String(startFiles.length)} Dateien (> ${String(MAX_START_FILES)}): ` +
      'wächst die Zahl mit den Minispielen? `codeSplitting` in apps/host/vite.config.ts prüfen.',
  );
}
const withEngine = startFiles.filter((file) => sizeOf(file).engine);
if (withEngine.length > 0) {
  fail(
    `Babylon-Engine im Start-Bundle (${withEngine.join(', ')}): ein statischer Import zieht die ` +
      'Szene vor. Szenen nur über apps/host/src/lazyScenes.ts laden.',
  );
}

// 2. Minispiele
const manifestPath = join(dist, '.vite', 'manifest.json');
if (!existsSync(manifestPath)) {
  console.error('apps/host/dist/.vite/manifest.json fehlt – `build.manifest` in vite.config.ts?');
  process.exit(1);
}
/** @type {Record<string, { file: string, imports?: string[], isDynamicEntry?: boolean }>} */
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
/** Datei eines Manifest-Eintrags plus alle statisch importierten Chunks. @param {string} key */
function closure(key) {
  /** @type {Set<string>} */
  const files = new Set();
  /** @param {string} entry */
  const visit = (entry) => {
    const chunk = manifest[entry];
    if (!chunk || files.has(chunk.file)) return;
    files.add(chunk.file);
    for (const next of chunk.imports ?? []) visit(next);
  };
  visit(key);
  return files;
}
if (!manifest[STAGE_ENTRY]) {
  console.error(`Minispiel-Bühne ${STAGE_ENTRY} fehlt im Manifest.`);
  process.exit(1);
}
const stageFiles = closure(STAGE_ENTRY);
const stage = total(stageFiles);
console.log(
  `Minispiel-Bühne (statische Kette): ${String(stageFiles.size)} Dateien, ${kb(stage.raw)} (gzip ${kb(stage.gzip)})`,
);

const gamesDir = join(repo, 'packages', 'minigames', 'src');
const games = readdirSync(gamesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(join(gamesDir, entry.name, 'info.ts')))
  .map((entry) => entry.name)
  .sort();
const startSet = new Set(startFiles);
const gameSizes = [];
for (const game of games) {
  const key = Object.keys(manifest).find((name) =>
    name.endsWith(`packages/minigames/src/${game}/index.ts`),
  );
  const chunk = key ? manifest[key] : undefined;
  if (!key || !chunk?.isDynamicEntry) {
    fail(
      `Minispiel ${game} hat keinen eigenen Chunk: Der Host darf Minispiel-Module nur über ` +
        '`@chaos-party/minigames/lazy` laden (CHAOS-86).',
    );
    continue;
  }
  if (startSet.has(chunk.file)) fail(`Minispiel ${game} liegt im Start-Bundle (${chunk.file}).`);
  if (stageFiles.has(chunk.file)) {
    fail(`Minispiel ${game} liegt in der statischen Kette der Bühne (${chunk.file}).`);
  }
  // Was das Spiel zusätzlich zur Bühne lädt (eigener Chunk plus nur von ihm genutzte Teile).
  const extra = [...closure(key)].filter((file) => !stageFiles.has(file) && !startSet.has(file));
  gameSizes.push({ game, ...total(extra) });
}
for (const { game, raw, gzip } of gameSizes) {
  console.log(`  Minispiel ${game}: ${kb(raw)} (gzip ${kb(gzip)}) zusätzlich zur Bühne`);
}
if (failed) process.exit(1);
