import { createReadStream } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { stat } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { PROTOCOL_VERSION } from '@chaos-party/protocol';
import { generateJoinCode } from './ids.ts';
import { ratingsExport, type RatingsExport, type RatingStore } from './ratings.ts';
import type { RateLimitOptions } from './rate-limit.ts';
import { Session, type SessionOptions, type SessionTimeouts } from './session.ts';
import { attachWebSocket } from './socket.ts';

export interface ChaosServerOptions {
  /** Verzeichnis mit der gebauten Controller-App (`apps/controller/dist`), ausgeliefert unter `/`. */
  staticDir: string;
  /**
   * Verzeichnis mit der gebauten Host-App (`apps/host/dist`), ausgeliefert unter `/host/`
   * (CHAOS-11, ADR-007). Ohne Angabe antwortet `/host/` mit 404.
   */
  hostDir?: string | undefined;
  /** Fester Join-Code (4–8 Zeichen `A–Z0–9`), sonst zufällig mit 4 Zeichen. */
  joinCode?: string | undefined;
  /** LAN-URL für QR-Code/Lobby (CHAOS-11); ohne sie sendet `lobby` kein `joinUrl`. */
  joinUrl?: string | undefined;
  /** Weitere Join-Links für andere LAN-Adressen des PCs (CHAOS-11), beste zuerst. */
  joinUrlAlternatives?: readonly string[] | undefined;
  /** Monotone Uhr in ms für Session und Rate-Limit (Tests). */
  now?: (() => number) | undefined;
  /** Token-Erzeugung (Tests). */
  createToken?: (() => string) | undefined;
  rateLimit?: Partial<RateLimitOptions> | undefined;
  maxInvalidMessages?: number | undefined;
  /** Zeitgrenzen für Handshake, Herzschlag und Lobby-Schonfrist (CHAOS-12, ADR-009). */
  timeouts?: Partial<SessionTimeouts> | undefined;
  /** Brettspiel-Einstellungen (M2): Runden, fester Seed, Regeln, Brett. */
  game?: SessionOptions['game'];
  /** Wird bei jedem Partiestart aufgerufen (Seed ausgeben). */
  onGameStart?: SessionOptions['onGameStart'];
  /**
   * Speicher der Daumen-Stimmen (CHAOS-87); `main.ts` übergibt eine Datei. Standard: im Speicher.
   * Export unter `/ratings.json`.
   */
  ratings?: RatingStore | undefined;
  /** Takt der Timeout-Prüfung und des Brettspiels in ms (Standard 100). */
  tickMs?: number | undefined;
  /**
   * Kennung dieses Prozesses in `/health` (CHAOS-48). Damit erkennt der Start, ob unter
   * `localhost:<Port>` wirklich dieser Server antwortet. Standard: zufällig.
   */
  instanceId?: string | undefined;
}

export interface ChaosServer {
  listen(port: number, host: string): Promise<AddressInfo>;
  close(): Promise<void>;
  /** Join-Code der (einzigen) Session dieses Prozesses. */
  readonly joinCode: string;
  /** Die autoritative Session (lesend für Diagnose und Tests). */
  readonly session: Session;
  /** Kennung dieses Prozesses, wie sie `/health` meldet (CHAOS-48). */
  readonly instanceId: string;
}

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  // Himmel als Radiance-HDR (CHAOS-62); Babylon liest die Bytes selbst.
  '.hdr': 'image/vnd.radiance',
  '.ico': 'image/x-icon',
  // Klang-Dateien des Hosts (CHAOS-223).
  '.mp3': 'audio/mpeg',
  '.webmanifest': 'application/manifest+json',
  '.wasm': 'application/wasm',
  '.woff2': 'font/woff2',
};

/** Pfad, unter dem die Host-App (PC-Spiel) ausgeliefert wird. */
export const HOST_PATH = '/host';

interface StaticRoots {
  /** Controller-App unter `/`. */
  readonly controller: string;
  /** Host-App unter `/host/`, falls gebaut/angegeben. */
  readonly host: string | undefined;
  /** Kennung für `/health`. */
  readonly instanceId: string;
  /** Export der Daumen-Stimmen für `/ratings.json` (CHAOS-87). */
  readonly ratings: () => RatingsExport;
}

/** Export der Daumen-Stimmen (CHAOS-87): JSON für den Katalog, am Host als Download verlinkt. */
export const RATINGS_PATH = '/ratings.json';

/**
 * Ein Prozess, ein Port: Controller-App unter `/`, Host-App unter `/host/`,
 * Health-Check und die WebSocket-Verbindung unter `/ws` (Annahme B9, ADR-005, ADR-007).
 */
export function createChaosServer(options: ChaosServerOptions): ChaosServer {
  const roots: StaticRoots = {
    controller: resolve(options.staticDir),
    host: options.hostDir === undefined ? undefined : resolve(options.hostDir),
    instanceId: options.instanceId ?? randomBytes(9).toString('base64url'),
    ratings: () => ratingsExport(session.ratingVotes(), new Date()),
  };
  const session = new Session({
    joinCode: options.joinCode ?? generateJoinCode(),
    joinUrl: options.joinUrl,
    joinUrlAlternatives: options.joinUrlAlternatives,
    now: options.now,
    createToken: options.createToken,
    rateLimit: options.rateLimit,
    maxInvalidMessages: options.maxInvalidMessages,
    timeouts: options.timeouts,
    game: options.game,
    onGameStart: options.onGameStart,
    ratings: options.ratings,
  });

  const server = createServer((req, res) => {
    handleRequest(roots, req, res).catch((error: unknown) => {
      console.error(error);
      if (!res.headersSent) {
        send(res, 500, 'text/plain; charset=utf-8', 'Interner Fehler');
      } else {
        res.destroy();
      }
    });
  });

  const sockets = attachWebSocket(server, session, { tickMs: options.tickMs });
  let closing: Promise<void> | undefined;

  return {
    joinCode: session.joinCode,
    session,
    instanceId: roots.instanceId,
    listen(port, host) {
      return new Promise((resolveListen, reject) => {
        server.once('error', reject);
        server.listen(port, host, () => {
          server.off('error', reject);
          resolveListen(server.address() as AddressInfo);
        });
      });
    },
    /** Beendet alle WebSockets und HTTP-Verbindungen; mehrfacher Aufruf ist harmlos. */
    close() {
      closing ??= (async () => {
        await sockets.close();
        if (!server.listening) return;
        await new Promise<void>((resolveClose, reject) => {
          server.close((error) => {
            if (error) reject(error);
            else resolveClose();
          });
          server.closeAllConnections();
        });
      })();
      return closing;
    },
  };
}

async function handleRequest(roots: StaticRoots, req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    send(res, 405, 'text/plain; charset=utf-8', 'Methode nicht erlaubt', { Allow: 'GET, HEAD' });
    return;
  }

  const url = new URL(req.url ?? '/', 'http://localhost');

  if (url.pathname === '/health') {
    send(
      res,
      200,
      'application/json; charset=utf-8',
      JSON.stringify({
        status: 'ok',
        protocolVersion: PROTOCOL_VERSION,
        instance: roots.instanceId,
      }),
    );
    return;
  }

  if (url.pathname === RATINGS_PATH) {
    const body = `${JSON.stringify(roots.ratings(), null, 2)}\n`;
    const day = new Date().toISOString().slice(0, 10);
    send(res, 200, 'application/json; charset=utf-8', body, {
      'Cache-Control': 'no-store',
      'Content-Disposition': `attachment; filename="minispiel-stimmen-${day}.json"`,
    });
    return;
  }

  // `/host` ohne Schrägstrich → `/host/`, damit relative Pfade und die SPA stimmen.
  if (url.pathname === HOST_PATH) {
    send(res, 301, 'text/plain; charset=utf-8', 'Weiter zu /host/', {
      Location: `${HOST_PATH}/${url.search}`,
    });
    return;
  }

  let root = roots.controller;
  let pathname = url.pathname;
  if (pathname.startsWith(`${HOST_PATH}/`)) {
    if (roots.host === undefined) {
      send(res, 404, 'text/plain; charset=utf-8', 'Host-App nicht konfiguriert');
      return;
    }
    root = roots.host;
    pathname = pathname.slice(HOST_PATH.length);
  }

  const lookup = await resolveStaticFile(root, pathname);
  if (lookup.kind === 'forbidden') {
    send(res, 403, 'text/plain; charset=utf-8', 'Verboten');
    return;
  }
  if (lookup.kind === 'missing') {
    const hint = root === roots.host ? ' (Host-App gebaut? `pnpm build`)' : '';
    send(res, 404, 'text/plain; charset=utf-8', `Nicht gefunden${hint}`);
    return;
  }
  const { file } = lookup;

  res.writeHead(200, {
    'Content-Type': MIME_TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
    'Cache-Control': file.endsWith('index.html') ? 'no-cache' : 'public, max-age=3600',
  });
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  createReadStream(file).pipe(res);
}

type StaticLookup = { kind: 'file'; file: string } | { kind: 'missing' } | { kind: 'forbidden' };

/**
 * Liefert den Pfad zur auszuliefernden Datei. Pfade ohne Dateiendung fallen auf
 * `index.html` zurück (Single-Page-App); fehlende Assets ergeben 404.
 */
async function resolveStaticFile(root: string, pathname: string): Promise<StaticLookup> {
  const missing: StaticLookup = { kind: 'missing' };
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return missing;
  }
  if (decoded.includes('\0')) {
    return missing;
  }

  const candidate = resolve(root, '.' + normalize(decoded));
  if (candidate !== root && !candidate.startsWith(root + sep)) {
    return { kind: 'forbidden' };
  }

  for (const file of [candidate, join(candidate, 'index.html')]) {
    if (await isFile(file)) {
      return { kind: 'file', file };
    }
  }
  if (extname(decoded) === '') {
    const appIndex = join(root, 'index.html');
    if (await isFile(appIndex)) {
      return { kind: 'file', file: appIndex };
    }
  }
  return missing;
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

function send(
  res: ServerResponse,
  status: number,
  contentType: string,
  body: string,
  headers: Record<string, string> = {},
) {
  res.writeHead(status, { 'Content-Type': contentType, ...headers });
  res.end(body);
}
