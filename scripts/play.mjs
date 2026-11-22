#!/usr/bin/env node
/**
 * `pnpm play` – ein Befehl zum Bauen und Starten auf einem frischen PC (CHAOS-42).
 *
 * 1. prüft Node.js und pnpm (verständliche Meldung statt Stacktrace),
 * 2. installiert Abhängigkeiten bei Bedarf (`pnpm install --frozen-lockfile`),
 * 3. baut nur, wenn der Build fehlt oder Quellen neuer sind (`pnpm build`),
 * 4. startet den Production-Server (wie `pnpm start`) und
 * 5. öffnet das Spiel im Standardbrowser (abschaltbar: `OPEN=0` oder `--no-open`).
 *
 * Alle Umgebungsvariablen des Servers (`PORT`, `HOST`, `JOIN_CODE`, `PUBLIC_HOST`, `PUBLIC_PORT`,
 * `TERMINAL_QR`, `ROUNDS`, `SEED`, `RUECKENWIND`, `SCHNELLFEUER`, `BRETT`, `STIMMEN_DATEI`) werden unverändert durchgereicht. Strg+C beendet den Server
 * sauber. Keine globalen Installationen; Netz braucht nur der erste `pnpm install`.
 *
 * Bewusst plattformübergreifend in reinem Node (Windows, macOS, Linux) und ohne
 * Abhängigkeiten, damit es vor dem ersten `pnpm install` läuft. Muss deshalb auch auf zu alten
 * Node-Versionen bis zur Versionsprüfung kommen: keine neuen Sprachmittel vor `checkNode()`.
 */
import { spawn, spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { connect } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  atLeast,
  buildDecision,
  installDecision,
  localTarget,
  mtimeOrNull,
  newestMtime,
  parseOptions,
  parseVersion,
} from './play-lib.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const isWindows = process.platform === 'win32';
const MIN_PNPM = [10, 0, 0];

const options = parseOptions(process.argv.slice(2), process.env);
if (options.help) {
  printHelp();
  process.exit(0);
}
if (options.unknown.length > 0) {
  fail(`Unbekannte Option: ${options.unknown.join(' ')} (Hilfe: pnpm play --help)`);
}

/** Der Kindprozess, der gerade läuft (Installation, Build oder Server). */
/** @type {import('node:child_process').ChildProcess | null} */
let current = null;
let stopping = false;

// Strg+C: Im Terminal bekommt der Kindprozess das Signal ohnehin mit (gleiche Prozessgruppe).
// Wir leiten es zusätzlich weiter (z. B. bei `kill <pid>`) und warten, bis er sich beendet hat.
for (const signal of /** @type {const} */ (['SIGINT', 'SIGTERM'])) {
  process.on(signal, () => {
    if (stopping) return;
    stopping = true;
    if (current && current.exitCode === null && current.signalCode === null) {
      current.kill(signal);
    } else {
      process.exit(130);
    }
  });
}

checkNode();
const pnpm = resolvePnpm();
log(`Chaos Party · Node ${process.versions.node} · pnpm ${pnpm.version}`);

// --- Abhängigkeiten ------------------------------------------------------------------------
const manifests = [
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'package.json',
  ...['apps', 'packages'].flatMap((dir) =>
    listDirs(join(root, dir)).map((name) => join(dir, name, 'package.json')),
  ),
];
const install = installDecision({
  installedAt: mtimeOrNull(join(root, 'node_modules', '.modules.yaml')),
  newestManifest: Math.max(...manifests.map((file) => mtimeOrNull(join(root, file)) ?? 0)),
});
if (install.install) {
  log(`Installiere Abhängigkeiten (${install.reason}) …`);
  await run(pnpm, ['install', '--frozen-lockfile'], 'pnpm install --frozen-lockfile');
} else {
  log(install.reason + '.');
}

// --- Build -----------------------------------------------------------------------------------
const outputs = [
  'apps/host/dist/index.html',
  'apps/controller/dist/index.html',
  'apps/server/dist/main.js',
].map((file) => mtimeOrNull(join(root, file)));
const sourceRoots = ['apps', 'packages'].flatMap((dir) =>
  listDirs(join(root, dir)).map((name) => join(root, dir, name)),
);
const newestSource = Math.max(
  ...sourceRoots.map((dir) => newestMtime(dir)),
  ...['package.json', 'pnpm-lock.yaml', 'tsconfig.base.json'].map(
    (file) => mtimeOrNull(join(root, file)) ?? 0,
  ),
);
const decision = options.rebuild
  ? { build: true, reason: 'Neubau angefordert' }
  : install.install
    ? { build: true, reason: 'Abhängigkeiten wurden gerade installiert' }
    : buildDecision({ outputs, newestSource });
if (decision.build) {
  log(`Baue das Spiel (${decision.reason}) – das kann bis zu einer Minute dauern …`);
  await run(pnpm, ['build'], 'pnpm build');
} else {
  log(`${decision.reason} – überspringe pnpm build (Neubau erzwingen: pnpm play --rebuild).`);
}

// --- Server ----------------------------------------------------------------------------------
const target = localTarget(process.env);
let openBrowser = options.open;
if (openBrowser && target === null) {
  log('PORT ist 0 oder ungültig – öffne keinen Browser, Adresse steht unten.');
  openBrowser = false;
}
// Belegter Port: Entweder scheitert der Start (Meldung unten) oder ein fremdes Programm
// antwortet unter localhost (CHAOS-48, meldet der Server). In beiden Fällen keinen Browser öffnen.
const portBusy = target !== null && (await portTaken(target.probeHost, target.port));
if (portBusy) {
  log(`Port ${String(target.port)} ist schon belegt – öffne keinen Browser.`);
  openBrowser = false;
}

// Direkt `node dist/main.js` statt `pnpm start`: gleicher Start, aber ohne weitere pnpm- und
// Shell-Zwischenprozesse, damit Strg+C und SIGTERM sicher beim Server ankommen.
log('Starte den Server …');
log('');
const server = spawn(process.execPath, ['dist/main.js'], {
  cwd: join(root, 'apps', 'server'),
  stdio: 'inherit',
  env: process.env,
});
current = server;
server.on('error', (error) => {
  fail(`Server konnte nicht starten: ${error.message}`);
});

if (openBrowser && target !== null) {
  void waitForHealth(target).then((ok) => {
    if (!ok || stopping) return;
    const url = `http://${target.browserHost}:${String(target.port)}/host/`;
    openUrl(url);
  });
}

/** @type {number} */
const code = await new Promise((resolve) => {
  server.on('exit', (exitCode, signal) => {
    resolve(exitCode ?? (signal === 'SIGINT' || signal === 'SIGTERM' ? 0 : 1));
  });
});
if (stopping) {
  log('Chaos Party beendet.');
} else if (code !== 0) {
  fail(
    portBusy && target !== null
      ? [
          `Port ${String(target.port)} ist belegt – läuft Chaos Party schon in einem anderen Fenster?`,
          'Dort mit Strg+C beenden oder einen anderen Port wählen:',
          '  PORT=8790 pnpm play   (Windows PowerShell: $env:PORT="8790"; pnpm play)',
        ].join('\n')
      : `Der Server hat sich mit Exit-Code ${String(code)} beendet. Ausgabe oben prüfen.`,
  );
}
process.exit(code);

// --- Hilfsfunktionen -------------------------------------------------------------------------

function checkNode() {
  const required = readRequiredNode();
  const actual = parseVersion(process.versions.node);
  if (actual === null || required === null || atLeast(actual, required)) return;
  fail(
    [
      `Node.js ${process.versions.node} ist zu alt – Chaos Party braucht mindestens ${required.join('.')}.`,
      'Bitte Node.js 24 LTS installieren: https://nodejs.org (oder per nvm/fnm: siehe .nvmrc).',
    ].join('\n'),
  );
}

/** @returns {number[] | null} */
function readRequiredNode() {
  try {
    /** @type {{ engines?: { node?: string } }} */
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    return parseVersion(pkg.engines?.node ?? '');
  } catch {
    return null;
  }
}

/**
 * Wie wird pnpm aufgerufen? Unter `pnpm play` steht der Pfad in `npm_execpath`; dann ohne
 * Shell über dieselbe Node-Binärdatei. Sonst (`node scripts/play.mjs`) über `pnpm` im PATH.
 * @returns {{ command: string; prefix: string[]; shell: boolean; version: string }}
 */
function resolvePnpm() {
  const execPath = process.env.npm_execpath ?? '';
  const agent = process.env.npm_config_user_agent ?? '';
  /** @type {{ command: string; prefix: string[]; shell: boolean }} */
  const call =
    agent.startsWith('pnpm/') && /\.(c?js|mjs)$/.test(execPath)
      ? { command: process.execPath, prefix: [execPath], shell: false }
      : { command: 'pnpm', prefix: [], shell: isWindows };
  const result = spawnSync(call.command, [...call.prefix, '--version'], {
    encoding: 'utf8',
    shell: call.shell,
  });
  const version = result.status === 0 ? parseVersion(result.stdout) : null;
  if (version === null) {
    fail(
      [
        'pnpm wurde nicht gefunden.',
        'Einmalig einrichten: `corepack enable` (in Node.js 24 enthalten; die passende',
        'pnpm-Version steht in package.json → packageManager). Danach erneut: pnpm play',
      ].join('\n'),
    );
  }
  if (!atLeast(version, MIN_PNPM)) {
    fail(
      `pnpm ${version.join('.')} ist zu alt – benötigt wird pnpm 10. Abhilfe: \`corepack enable\`.`,
    );
  }
  return { ...call, version: version.join('.') };
}

/**
 * Startet einen Schritt und bricht bei Fehler mit verständlicher Meldung ab.
 * @param {{ command: string; prefix: string[]; shell: boolean }} tool
 * @param {string[]} args
 * @param {string} label
 * @returns {Promise<void>}
 */
function run(tool, args, label) {
  return new Promise((resolve) => {
    const child = spawn(tool.command, [...tool.prefix, ...args], {
      cwd: root,
      stdio: 'inherit',
      shell: tool.shell,
      env: process.env,
    });
    current = child;
    child.on('error', (error) => {
      fail(`${label} konnte nicht starten: ${error.message}`);
    });
    child.on('exit', (exitCode, signal) => {
      current = null;
      if (stopping || signal !== null) process.exit(130);
      if (exitCode !== 0) {
        fail(`${label} ist fehlgeschlagen (Exit-Code ${String(exitCode)}). Ausgabe oben prüfen.`);
      }
      resolve();
    });
  });
}

/**
 * Lauscht schon etwas auf dem Port? Dann würde der Browser nicht unseren Server erreichen.
 * @param {string} host
 * @param {number} port
 * @returns {Promise<boolean>}
 */
function portTaken(host, port) {
  return new Promise((resolve) => {
    const socket = connect({ host: host.replace(/^\[|\]$/g, ''), port });
    const done = (/** @type {boolean} */ taken) => {
      socket.destroy();
      resolve(taken);
    };
    socket.setTimeout(500, () => {
      done(false);
    });
    socket.once('connect', () => {
      done(true);
    });
    socket.once('error', () => {
      done(false);
    });
  });
}

/**
 * Wartet, bis `/health` antwortet (höchstens 20 s) oder der Server endet.
 * @param {{ probeHost: string; port: number }} where
 * @returns {Promise<boolean>}
 */
async function waitForHealth(where) {
  const url = `http://${where.probeHost}:${String(where.port)}/health`;
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline && server.exitCode === null && !stopping) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (res.ok) return true;
    } catch {
      // Server noch nicht bereit.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return false;
}

/**
 * Öffnet eine Adresse im Standardbrowser; scheitert das, bleibt der Link im Terminal.
 * @param {string} url
 */
function openUrl(url) {
  // Windows: `rundll32` statt `cmd /c start`, damit nichts an Anführungszeichen hängt.
  const [command, args] =
    process.platform === 'darwin'
      ? ['open', [url]]
      : isWindows
        ? ['rundll32', ['url.dll,FileProtocolHandler', url]]
        : ['xdg-open', [url]];
  try {
    const child = spawn(command, args, { stdio: 'ignore', detached: true, windowsHide: true });
    child.on('error', () => {
      log(`Browser ließ sich nicht öffnen – bitte selbst aufrufen: ${url}`);
    });
    child.unref();
    log(`Öffne ${url} im Browser (abschalten: OPEN=0 pnpm play).`);
  } catch {
    log(`Browser ließ sich nicht öffnen – bitte selbst aufrufen: ${url}`);
  }
}

/**
 * Unterordner (für apps/* und packages/*); fehlt `dir`, eine leere Liste.
 * @param {string} dir
 * @returns {string[]}
 */
function listDirs(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}

/** @param {string} message */
function log(message) {
  console.log(message === '' ? '' : `▶ ${message}`);
}

/**
 * @param {string} message
 * @returns {never}
 */
function fail(message) {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

function printHelp() {
  console.log(`pnpm play – Chaos Party bauen (falls nötig) und starten

Optionen:
  --no-open    keinen Browser öffnen (auch OPEN=0; in CI automatisch)
  --open       Browser auch in CI öffnen
  --rebuild    immer neu bauen (auch REBUILD=1)

Umgebungsvariablen des Servers (werden durchgereicht):
  PORT (8787), HOST (0.0.0.0), JOIN_CODE, PUBLIC_HOST, PUBLIC_PORT, TERMINAL_QR=0, ROUNDS, SEED, RUECKENWIND=1, SCHNELLFEUER (an|aus|ereignis|halbzeit|finale), BRETT (wackelwald|zufall), STIMMEN_DATEI

Beispiele:
  pnpm play
  OPEN=0 PORT=8790 pnpm play                 (macOS/Linux)
  $env:OPEN="0"; pnpm play                     (Windows PowerShell)`);
}
