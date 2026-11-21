import { DEFAULT_RULES, withTailwind, type RuleSet } from '@chaos-party/game-core';
import { existsSync } from 'node:fs';
import { homedir, networkInterfaces } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardChoices, isBoardChoice } from './boardChoice.ts';
import { generateJoinCode } from './ids.ts';
import { RAPID_FIRE_CHOICES, parseRapidFire } from './rapidFire.ts';
import { createFileRatingStore } from './ratingsFile.ts';
import { resolveJoinTarget } from './network.ts';
import { checkLocalhost } from './selfCheck.ts';
import { createChaosServer } from './server.ts';
import { formatStartupLines, renderTerminalQr } from './startup.ts';

/**
 * Startpunkt `pnpm start` (CHAOS-9, CHAOS-11). Umgebungsvariablen:
 * - `PORT` (Standard 8787), `HOST` (Bind-Adresse, Standard `0.0.0.0`)
 * - `JOIN_CODE`: fester Join-Code für Demos/Tests (sonst zufällig)
 * - `PUBLIC_HOST`, `PUBLIC_PORT`: Adresse/Port im QR-Link erzwingen (ADR-007)
 * - `TERMINAL_QR=0`: keinen QR-Code im Terminal zeichnen
 * - `ROUNDS`: Runden des Brettspiels (Standard 10, EXP-011), `SEED`: fester Seed (reproduzierbar)
 * - `RUECKENWIND=1`: Rückenwind-Münzen für Zurückliegende einschalten (CHAOS-125, EXP-022;
 *   Standard aus bis zum Playtest)
 * - `SCHNELLFEUER`: Schnellfeuer-Runde (CHAOS-90, EXP-041): `an` (Standard: Ereignis
 *   „Schnellfeuer!“, sonst im Finale), `aus`, oder nur `ereignis` | `halbzeit` | `finale`
 * - `BRETT`: Brett-Wahl zu Beginn, eine Brett-ID (`wackelwald`) oder `zufall` (CHAOS-197);
 *   in der Lobby umstellbar
 * - `STIMMEN_DATEI`: Datei der Daumen-Stimmen nach Minispielen (CHAOS-87), Standard
 *   `~/.chaos-party/minispiel-stimmen.json`; Export unter `/ratings.json`
 */
const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? '0.0.0.0';
// Gleiche relative Tiefe aus src/ (Dev) und dist/ (Build).
const staticDir = fileURLToPath(new URL('../../controller/dist', import.meta.url));
const hostDir = fileURLToPath(new URL('../../host/dist', import.meta.url));

// JOIN_CODE erlaubt einen festen Code für Demos und Tests; leer oder fehlend → zufällig.
const fixedJoinCode = process.env.JOIN_CODE?.trim();
const joinCode =
  fixedJoinCode === undefined || fixedJoinCode === '' ? generateJoinCode() : fixedJoinCode;

// Den QR-Link vor dem Start bestimmen: Er steht in jeder `lobby`-Nachricht an den Host.
// Ist PORT=0 (freier Port), wird der Link erst nach `listen` korrekt – dann PUBLIC_PORT setzen.
const target = resolveJoinTarget({
  interfaces: networkInterfaces(),
  env: process.env,
  listenPort: port,
  bindHost: host,
  joinCode,
});

const rounds = parseIntegerEnv('ROUNDS', 1, 20);
const seed = parseIntegerEnv('SEED', 0, 2 ** 31 - 1);
const tailwind = process.env.RUECKENWIND?.trim() === '1';
const rapidFire = parseRapidFireEnv();
const rules = withRapidFireRule(tailwind ? withTailwind() : DEFAULT_RULES);
const boardId = parseBoardEnv();
const ratingsFileEnv = process.env.STIMMEN_DATEI?.trim();
const ratingsFile =
  ratingsFileEnv === undefined || ratingsFileEnv === ''
    ? join(homedir(), '.chaos-party', 'minispiel-stimmen.json')
    : ratingsFileEnv;

const server = createChaosServer({
  staticDir,
  hostDir,
  joinCode,
  joinUrl: target.joinUrl,
  joinUrlAlternatives: target.alternatives,
  game: {
    ...(rounds === undefined ? {} : { rounds }),
    ...(seed === undefined ? {} : { seed }),
    rules,
    ...(boardId === undefined ? {} : { boardId }),
  },
  ratings: createFileRatingStore(ratingsFile),
  onGameStart: (info) => {
    if (info.practice !== undefined) {
      console.log(`Übungsrunde gestartet: ${info.practice}, ${String(info.slots.length)} Spieler`);
      return;
    }
    // Seed ausgeben: Mit SEED=<Wert> lässt sich dieselbe Partie nachstellen (M2).
    console.log(
      `Brettspiel gestartet: ${String(info.slots.length)} Spieler, ${String(info.rounds)} Runden, Brett ${info.boardId}, Seed ${String(info.seed)}${tailwind ? ', Rückenwind an' : ''}${rapidFire ? `, Schnellfeuer ${rapidFire.trigger}` : ', Schnellfeuer aus'}`,
    );
  },
});
const address = await server.listen(port, host);
// CHAOS-48: Prüfen, ob unter localhost wirklich dieser Server antwortet.
const localhost = await checkLocalhost({ port: address.port, instanceId: server.instanceId });

for (const line of formatStartupLines({ listenPort: address.port, joinCode, target, localhost })) {
  console.log(line);
}
console.log(`Minispiel-Stimmen: ${ratingsFile} (Export unter /ratings.json)`);
for (const [name, dir] of [
  ['Controller-App', staticDir],
  ['Host-App', hostDir],
] as const) {
  if (!existsSync(join(dir, 'index.html'))) {
    console.warn(`  ⚠ ${name} nicht gebaut (${dir}) – vorher \`pnpm build\` ausführen.`);
  }
}
if (process.stdout.isTTY && process.env.TERMINAL_QR !== '0') {
  console.log('');
  console.log(renderTerminalQr(target.joinUrl));
}

function parseIntegerEnv(name: string, min: number, max: number): number | undefined {
  const raw = process.env[name]?.trim();
  if (raw === undefined || raw === '') return undefined;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    console.warn(
      `  ⚠ ${name}=${raw} ignoriert (erlaubt: ganze Zahl ${String(min)}–${String(max)}).`,
    );
    return undefined;
  }
  return value;
}

function parseRapidFireEnv() {
  const raw = process.env.SCHNELLFEUER;
  const parsed = parseRapidFire(raw);
  if (parsed !== undefined) return parsed;
  console.warn(
    `  ⚠ SCHNELLFEUER=${raw ?? ''} ignoriert (erlaubt: ${RAPID_FIRE_CHOICES.join(', ')}).`,
  );
  return parseRapidFire('an') ?? null;
}

function withRapidFireRule(base: RuleSet): RuleSet {
  return rapidFire ? { ...base, rapidFire } : base;
}

function parseBoardEnv(): string | undefined {
  const raw = process.env.BRETT?.trim().toLowerCase();
  if (raw === undefined || raw === '') return undefined;
  if (!isBoardChoice(raw)) {
    console.warn(`  ⚠ BRETT=${raw} ignoriert (erlaubt: ${boardChoices().join(', ')}).`);
    return undefined;
  }
  return raw;
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void server.close().then(() => process.exit(0));
  });
}
