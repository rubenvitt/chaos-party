/**
 * Echter Chaos-Party-Server im Playwright-Testprozess (CHAOS-14).
 *
 * Startet `createChaosServer` wie `pnpm start` – Controller-Build unter `/`, Host-Build
 * unter `/host/`, WebSocket unter `/ws`, ein Port – aber auf einem freien Port nur auf
 * Loopback und mit festem Join-Code. Der Join-Link zeigt auf 127.0.0.1 (im Test gibt
 * es keine Handys im WLAN). Jeder Aufruf bekommt eine **frische Session**; Tests
 * teilen sich keinen Zustand und dürfen parallel laufen.
 *
 * Die Builds (`apps/*\/dist`) erzeugt `global-setup.ts` einmal vor dem Lauf.
 */
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import {
  createChaosServer,
  type ChaosServer,
  type ChaosServerOptions,
} from '../../../apps/server/src/server.ts';

/** Fester Join-Code der E2E-Sessions (jede Session hat ihren eigenen Server). */
export const E2E_JOIN_CODE = 'E2ETEST';
/** Fester Seed des Brettspiels in E2E-Tests (M2): gleiche Würfe, gleiche Wege. */
export const E2E_GAME_SEED = 2026;

const CONTROLLER_DIST = fileURLToPath(new URL('../../../apps/controller/dist', import.meta.url));
const HOST_DIST = fileURLToPath(new URL('../../../apps/host/dist', import.meta.url));

export interface RunningServer {
  readonly server: ChaosServer;
  /** `http://127.0.0.1:<port>` – Basis für Seiten und `page.request`. */
  readonly base: string;
  readonly port: number;
  readonly joinCode: string;
  /** Join-Link, wie ihn die Lobby als QR-Code zeigt (iPhone-Modus). */
  readonly joinUrl: string;
  /** WebSocket-Endpunkt für synthetische Controller aus dem Testprozess. */
  readonly wsUrl: string;
  close(): Promise<void>;
}

/** Freien Loopback-Port erfragen (kurz belegen und wieder freigeben). */
async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      const port = typeof address === 'object' && address !== null ? address.port : 0;
      probe.close(() => {
        resolve(port);
      });
    });
  });
}

function isAddressInUse(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && 'code' in error && error.code === 'EADDRINUSE'
  );
}

/**
 * Startet einen Server mit frischer Session. Der Port wird vorab bestimmt, weil der
 * Join-Link (`lobby.joinUrl`) beim Erzeugen der Session feststeht; belegt ein anderer
 * Prozess den Port in der Zwischenzeit, wird mit einem neuen Port wiederholt.
 */
export async function startChaosServer(
  options: {
    joinCode?: string;
    withJoinUrl?: boolean;
    game?: ChaosServerOptions['game'];
    /** Vorbelegte Daumen-Stimmen (CHAOS-87), z. B. für den Rauswurf-Vorschlag. */
    ratings?: ChaosServerOptions['ratings'];
  } = {},
): Promise<RunningServer> {
  const joinCode = options.joinCode ?? E2E_JOIN_CODE;
  for (let attempt = 1; ; attempt++) {
    const port = await freePort();
    const base = `http://127.0.0.1:${String(port)}`;
    const joinUrl = `${base}/?code=${joinCode}`;
    const server = createChaosServer({
      staticDir: CONTROLLER_DIST,
      hostDir: HOST_DIST,
      joinCode,
      joinUrl: options.withJoinUrl === false ? undefined : joinUrl,
      game: { seed: E2E_GAME_SEED, ...options.game },
      ratings: options.ratings,
    });
    try {
      await server.listen(port, '127.0.0.1');
    } catch (error) {
      await server.close();
      if (attempt < 5 && isAddressInUse(error)) continue;
      throw error;
    }
    return {
      server,
      base,
      port,
      joinCode,
      joinUrl,
      wsUrl: `ws://127.0.0.1:${String(port)}/ws`,
      close: () => server.close(),
    };
  }
}
