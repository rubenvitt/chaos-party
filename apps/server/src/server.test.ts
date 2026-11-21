import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PROTOCOL_VERSION } from '@chaos-party/protocol';
import { createChaosServer, type ChaosServer } from './server.ts';

let server: ChaosServer;
let baseUrl: string;
let workDir: string;

beforeAll(async () => {
  workDir = await mkdtemp(join(tmpdir(), 'chaos-server-'));
  const staticDir = join(workDir, 'dist');
  await mkdir(join(staticDir, 'assets'), { recursive: true });
  await writeFile(join(staticDir, 'index.html'), '<!doctype html><title>Controller</title>');
  await writeFile(join(staticDir, 'assets', 'app.js'), 'console.log(1);');
  await writeFile(join(staticDir, 'assets', 'robot-abc.webp'), new Uint8Array([82, 73, 70, 70]));
  await writeFile(join(staticDir, 'assets', 'coin-1-abc.mp3'), new Uint8Array([73, 68, 51]));
  await writeFile(join(workDir, 'secret.txt'), 'geheim');
  const hostDir = join(workDir, 'host-dist');
  await mkdir(join(hostDir, 'assets'), { recursive: true });
  await writeFile(join(hostDir, 'index.html'), '<!doctype html><title>Host</title>');
  await writeFile(join(hostDir, 'assets', 'HavokPhysics-abc.wasm'), new Uint8Array([0, 97, 115]));

  server = createChaosServer({ staticDir, hostDir });
  const address = await server.listen(0, '127.0.0.1');
  baseUrl = `http://127.0.0.1:${String(address.port)}`;
});

afterAll(async () => {
  await server.close();
  await rm(workDir, { recursive: true, force: true });
});

/** Roher Request, damit `..` im Pfad nicht vom Client normalisiert wird. */
function rawGet(path: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = request(`${baseUrl}/`, { path, method: 'GET' }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk: string) => {
        body += chunk;
      });
      res.on('end', () => {
        resolve({ status: res.statusCode ?? 0, body });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

describe('Chaos-Party-Server', () => {
  it('meldet Gesundheit und Protokollversion', async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      status: 'ok',
      protocolVersion: PROTOCOL_VERSION,
      instance: server.instanceId,
    });
  });

  it('liefert die Daumen-Stimmen als JSON-Export (CHAOS-87)', async () => {
    const res = await fetch(`${baseUrl}/ratings.json`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(res.headers.get('content-disposition')).toMatch(
      /attachment; filename="minispiel-stimmen-/,
    );
    const body = (await res.json()) as {
      format: string;
      games: { id: string }[];
      votes: unknown[];
    };
    expect(body.format).toBe('chaos-party-minigame-ratings');
    expect(body.games.map((game) => game.id)).toContain('sockenregen');
    expect(body.votes).toEqual([]);
  });

  it('liefert die Controller-App unter /', async () => {
    const res = await fetch(`${baseUrl}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(await res.text()).toContain('<title>Controller</title>');
  });

  it('liefert Assets mit passendem MIME-Typ', async () => {
    const res = await fetch(`${baseUrl}/assets/app.js`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/javascript');
  });

  it('liefert Porträts als image/webp (CHAOS-61)', async () => {
    const res = await fetch(`${baseUrl}/assets/robot-abc.webp`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/webp');
  });

  it('liefert Klang-Dateien als audio/mpeg (CHAOS-223)', async () => {
    const res = await fetch(`${baseUrl}/assets/coin-1-abc.mp3`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('audio/mpeg');
  });

  it('fällt bei App-Routen auf index.html zurück', async () => {
    const res = await fetch(`${baseUrl}/join/ABCD`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('<title>Controller</title>');
  });

  it('antwortet 404 für fehlende Assets', async () => {
    const res = await fetch(`${baseUrl}/assets/fehlt.js`);
    expect(res.status).toBe(404);
  });

  it.each(['/../secret.txt', '/%2e%2e/secret.txt', '/assets/../../secret.txt'])(
    'liefert keine Dateien außerhalb des Verzeichnisses (%s)',
    async (path) => {
      const res = await rawGet(path);
      expect(res.body).not.toContain('geheim');
    },
  );

  it('liefert die Host-App unter /host/ (CHAOS-11)', async () => {
    const res = await fetch(`${baseUrl}/host/?test=1`);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-cache');
    expect(await res.text()).toContain('<title>Host</title>');
  });

  it('leitet /host auf /host/ um und behält die Query', async () => {
    const res = await fetch(`${baseUrl}/host?local=1`, { redirect: 'manual' });
    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe('/host/?local=1');
  });

  it('fällt bei Host-Routen auf die Host-index.html zurück, nicht auf den Controller', async () => {
    const res = await fetch(`${baseUrl}/host/lobby/irgendwas`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('<title>Host</title>');
  });

  it('liefert Havok-WASM der Host-App mit application/wasm (C1)', async () => {
    const res = await fetch(`${baseUrl}/host/assets/HavokPhysics-abc.wasm`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/wasm');
  });

  it('antwortet 404 für fehlende Host-Assets', async () => {
    const res = await fetch(`${baseUrl}/host/assets/fehlt.js`);
    expect(res.status).toBe(404);
    expect(await res.text()).toContain('pnpm build');
  });

  it('verwechselt /hostile nicht mit /host/', async () => {
    const res = await fetch(`${baseUrl}/hostile`);
    expect(await res.text()).toContain('<title>Controller</title>');
  });

  it.each([
    '/host/../../secret.txt',
    '/host/%2e%2e/%2e%2e/secret.txt',
    '/host/..%2f..%2fsecret.txt',
    '/host/assets/..%2f..%2f..%2fsecret.txt',
    '/host/%2e%2e%2f%2e%2e%2fsecret.txt',
    '/host/..%5c..%5csecret.txt',
  ])('liefert unter /host/ keine Dateien außerhalb des Host-Verzeichnisses (%s)', async (path) => {
    const res = await rawGet(path);
    expect(res.body).not.toContain('geheim');
  });

  it('lehnt andere Methoden als GET/HEAD ab', async () => {
    const res = await fetch(`${baseUrl}/`, { method: 'POST' });
    expect(res.status).toBe(405);
  });
});

describe('Chaos-Party-Server ohne Host-App', () => {
  it('antwortet unter /host/ mit 404 statt mit dem Controller', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'chaos-server-ohne-host-'));
    await writeFile(join(dir, 'index.html'), '<!doctype html><title>Controller</title>');
    const bare = createChaosServer({ staticDir: dir });
    try {
      const address = await bare.listen(0, '127.0.0.1');
      const res = await fetch(`http://127.0.0.1:${String(address.port)}/host/`);
      expect(res.status).toBe(404);
    } finally {
      await bare.close();
      await rm(dir, { recursive: true, force: true });
    }
  });
});
