/**
 * Messläufe (CHAOS-39, `pnpm perf`): feste Szenarien gegen Production-Build und echten Server,
 * Host-Seite **ohne** Testmodus (echte Render-Schleife) mit `?debug=1`; vier synthetische
 * Controller (`PerfBot`) im Testprozess.
 *
 * 1. **Partie:** 4 Spieler, 3 Runden (jedes Minispiel der Rotation einmal, Spielzeit gekürzt),
 *    Finale mit Trophäenzählung und Podest. Kennzahlen je Szene aus `window.__chaosPerf`
 *    (Bildabstand, Render-Zeit, Draw Calls, aktive Meshes, Kontexte, Render-Schleifen, Heap,
 *    Eingang→Frame), dazu Server-Nachrichten an den Host (Anzahl/Größe je Typ),
 *    Bot-Rundlaufzeit über den Server und Verzögerung der Node-Ereignisschleife. Je
 *    Szenenwechsel (Brett → Minispiel, Minispiel → Brett, Zählung → Podest) der längste Block
 *    (Long Task) zwischen Aufbau und erstem Bild (CHAOS-153, `__chaosPerf.transitions()`).
 * 2. **Revanche ×3:** drei kurze Partien hintereinander; nach jeder in der Lobby Heap (nach
 *    Garbage Collection), DOM-Knoten, Canvas-Elemente und WebGL-Kontexte. Speicher und
 *    Kontexte dürfen nicht wachsen.
 *
 * **SwiftShader** (CPU-Rendering): Werte nur relativ auf demselben Rechner vergleichbar,
 * keine Aussage über echte Hardware (`docs/performance.md`). Ergebnisse in `perf-results/`.
 * `PERF_UPDATE_BASELINE=1` schreibt `tests/perf/baseline.json` neu; `PERF_STRICT=1` prüft
 * zusätzlich die zeitlichen Schwellen; `PERF_LABEL=…` benennt die Ergebnisdatei.
 *
 * Echte GPU (CHAOS-73): `PERF_GPU=1` (siehe `playwright.perf.config.ts`), dazu
 * `PERF_VIEWPORT=1920x1080`, `PERF_DPR=2` und `PERF_QUERY=&qualitaet=hoch`. Ohne Vergleich
 * mit der Baseline (die gilt nur für SwiftShader).
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { cpus, loadavg, totalmem } from 'node:os';
import { fileURLToPath } from 'node:url';
import { expect, test, type Browser, type CDPSession, type Page } from '@playwright/test';
import { format, resolveConfig } from 'prettier';
import type {} from '../../apps/host/src/debug/perf.ts';
import type { ScenePerf } from '../../apps/host/src/debug/perfMonitor.ts';
import { summarizeTransitions } from '../../apps/host/src/debug/transitions.ts';
import type {} from '../../apps/host/src/finale/testHook.ts';
import { withRules } from '../../packages/game-core/src/index.ts';
import { rotationInfos } from '../../packages/minigames/src/catalog.ts';
import type { CharacterId } from '../../packages/protocol/src/index.ts';
import { collectProblems, expectNoProblems } from '../e2e/fixtures/pages.ts';
import { startChaosServer, type RunningServer } from '../e2e/fixtures/server.ts';
import { PerfBot, startEventLoopMonitor } from './perfBot.ts';
import {
  createRetainedHeapTracker,
  compareScenes,
  compareTransitions,
  comparisonTable,
  flatten,
  flattenTransitions,
  sceneTable,
  transitionTable,
  type FlatMetrics,
} from './report.ts';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const RESULTS = `${ROOT}perf-results`;
const BASELINE = `${ROOT}tests/perf/baseline.json`;
/** Baseline-Szenario der Szenenwechsel im Szenario „Partie“ (CHAOS-153). */
const TRANSITIONS_SCENARIO = 'partie-uebergaenge';
/** Diese Übergänge muss die Partie zeigen (mindestens einmal mit erstem Bild). */
const REQUIRED_TRANSITIONS = ['brett → minispiel', 'minispiel → brett', 'zählung → podest'];
const CHARACTERS: readonly CharacterId[] = ['robot', 'sock', 'raccoon', 'cactus'];
/** Spielzeit je Minispiel im Messlauf (gekürzt; Bühne, Figuren und Eingaben wie im Spiel). */
const PLAY_MS = 15_000;
/** So lange misst der Lauf die Lobby mit vier beigetretenen Spielern. */
const LOBBY_MS = 10_000;
/** So lange bleibt der Messlauf auf dem Siegerpodest. */
const PODIUM_MS = 10_000;
/** Takt der Heap-Proben je Szene (CDP). */
const HEAP_SAMPLE_MS = 2000;
/**
 * Heap nach GC erst, wenn eine Szene so viele Takte in Folge aktiv ist (≥ 6 s): Dann ist sie
 * aufgebaut und hat ihr erstes Bild, die erzwungene GC fällt nicht in den gemessenen Wechsel.
 * Anleitung und Ergebnis der Minispiele (je 5 s) erreichen das nie und bleiben ohne Wert, statt
 * je nach Takt mal gemessen zu werden und mal nicht.
 */
const RETAINED_HEAP_AFTER_TICKS = 4;
const GPU = process.env.PERF_GPU === '1';
const [VIEW_W, VIEW_H] = (process.env.PERF_VIEWPORT ?? '1280x720').split('x').map(Number) as [
  number,
  number,
];
const DPR = Number(process.env.PERF_DPR ?? '1');
const QUERY = process.env.PERF_QUERY ?? '';

interface WsStats {
  readonly byType: Record<string, { count: number; bytes: number; maxBytes: number }>;
  firstAt: number | null;
  lastAt: number | null;
}

/** Zählt alle Server-Nachrichten an die Host-Seite (Typ, Anzahl, Bytes). */
function watchHostSocket(page: Page): WsStats {
  const stats: WsStats = { byType: {}, firstAt: null, lastAt: null };
  page.on('websocket', (socket) => {
    socket.on('framereceived', ({ payload }) => {
      const text = typeof payload === 'string' ? payload : payload.toString('utf8');
      let type = '?';
      try {
        const parsed = (JSON.parse(text) as { type?: unknown }).type;
        if (typeof parsed === 'string') type = parsed;
      } catch {
        // Kein JSON: unter „?“ zählen.
      }
      const now = Date.now();
      stats.firstAt ??= now;
      stats.lastAt = now;
      const entry = (stats.byType[type] ??= { count: 0, bytes: 0, maxBytes: 0 });
      entry.count += 1;
      entry.bytes += text.length;
      entry.maxBytes = Math.max(entry.maxBytes, text.length);
    });
  });
  return stats;
}

async function openPerfHost(browser: Browser, server: RunningServer, query: string) {
  const context = await browser.newContext({
    viewport: { width: VIEW_W, height: VIEW_H },
    deviceScaleFactor: DPR,
  });
  const page = await context.newPage();
  const problems = collectProblems(page);
  const ws = watchHostSocket(page);
  const cdp = await context.newCDPSession(page);
  await page.goto(`${server.base}/host/?debug=1${query}${QUERY}`);
  await expect(page.locator('main.host')).toHaveAttribute('data-scene', 'ready');
  await expect(page.getByTestId('connection')).toHaveAttribute('data-status', 'connected');
  return { context, page, problems, ws, cdp };
}

async function joinBots(server: RunningServer, page: Page): Promise<PerfBot[]> {
  const bots: PerfBot[] = [];
  for (const [index, character] of CHARACTERS.entries()) {
    bots.push(await PerfBot.join(server, character, 100 + index));
    await expect(page.getByTestId(`lobby-player-${String(index + 1)}`)).toBeVisible();
  }
  return bots;
}

async function startGame(page: Page) {
  for (const slot of [1, 2, 3, 4]) {
    await expect(page.getByTestId(`lobby-player-${String(slot)}`)).toHaveAttribute(
      'data-ready',
      'true',
    );
  }
  const start = page.getByTestId('start-button');
  await expect(start).toBeEnabled();
  await start.click();
  await expect(page.locator('main.host')).toHaveAttribute('data-phase', 'board');
}

/** Wartet auf den Siegerbildschirm mit fertigem Podest. */
async function waitForPodium(page: Page, timeout: number) {
  const results = page.getByTestId('board-results');
  await expect(results).toHaveAttribute('data-done', 'true', { timeout });
  await expect(results).toHaveAttribute('data-podium', 'ready', { timeout: 60_000 });
}

/** JS-Heap nach Garbage Collection (CDP), in Bytes. */
async function heapAfterGc(cdp: CDPSession): Promise<number> {
  await cdp.send('HeapProfiler.collectGarbage');
  const usage = await cdp.send('Runtime.getHeapUsage');
  return usage.usedSize;
}

function summarizeRtts(bots: readonly PerfBot[]) {
  const all = bots.flatMap((bot) => bot.rtts).sort((a, b) => a - b);
  const at = (p: number) =>
    all[Math.min(all.length - 1, Math.max(0, Math.ceil((p / 100) * all.length) - 1))] ?? null;
  return { n: all.length, p50: at(50), p95: at(95), max: all[all.length - 1] ?? null };
}

function environmentInfo(browserVersion: string) {
  const cpu = cpus();
  return {
    date: new Date().toISOString(),
    node: process.version,
    platform: `${process.platform} ${process.arch}`,
    cpu: `${cpu[0]?.model ?? '?'} ×${String(cpu.length)}`,
    memoryGB: Math.round(totalmem() / 1024 ** 3),
    // Systemlast am Ende (1/5/15 min): Andere Prozesse auf dem Rechner verfälschen Zeiten.
    loadAverage: loadavg().map((value) => Math.round(value * 100) / 100),
    browser: `Chromium ${browserVersion} ${GPU ? 'GPU, ohne VSync' : 'headless, SwiftShader (ANGLE)'}, ${String(VIEW_W)}×${String(VIEW_H)}, DPR ${String(DPR)}${QUERY ? `, ${QUERY}` : ''}`,
  };
}

function writeResult(name: string, data: unknown) {
  mkdirSync(RESULTS, { recursive: true });
  const label = process.env.PERF_LABEL ? `-${process.env.PERF_LABEL}` : '';
  writeFileSync(`${RESULTS}/${name}${label}.json`, `${JSON.stringify(data, null, 2)}\n`);
}

function readBaseline(): Record<string, Record<string, FlatMetrics>> {
  if (!existsSync(BASELINE)) return {};
  return (
    (
      JSON.parse(readFileSync(BASELINE, 'utf8')) as {
        scenarios?: Record<string, Record<string, FlatMetrics>>;
      }
    ).scenarios ?? {}
  );
}

async function updateBaseline(
  scenarios: Record<string, Record<string, FlatMetrics>>,
  environment: unknown,
) {
  const existing = existsSync(BASELINE)
    ? (JSON.parse(readFileSync(BASELINE, 'utf8')) as { scenarios?: Record<string, unknown> })
    : {};
  const next = {
    note: 'Baseline der Messläufe (CHAOS-39): SwiftShader, nur relativ auf demselben Rechner vergleichbar. Neu schreiben mit PERF_UPDATE_BASELINE=1 pnpm perf.',
    environment,
    scenarios: { ...(existing.scenarios ?? {}), ...scenarios },
  };
  // Wie `pnpm format` es ablegen würde, sonst scheitert `pnpm format:check` an der Datei (CHAOS-133).
  const options = (await resolveConfig(BASELINE)) ?? {};
  writeFileSync(BASELINE, await format(JSON.stringify(next), { ...options, filepath: BASELINE }));
}

test.describe('Messläufe (SwiftShader, nur relative Vergleiche)', () => {
  test('Partie: 4 Spieler, 3 Runden mit allen Minispielen, Finale und Podest', async ({
    browser,
  }) => {
    const minigames = rotationInfos().map((info) => ({
      id: info.id,
      playMs: PLAY_MS,
      scoring: info.scoring,
    }));
    // Eine Runde je Minispiel der Rotation; unter SwiftShader ≈ 1 min je Runde (seit der
    // Pilotwelle CHAOS-91 zwölf Runden), dazu Lobby, Finale und Podest.
    const matchMinutes = 4 + minigames.length * 1.2;
    test.setTimeout((matchMinutes + 3) * 60_000);
    const server = await startChaosServer({
      game: {
        rounds: minigames.length,
        minigames,
        rules: withRules({ pacing: { minigameIntroMs: 5000, minigameResultsMs: 5000 } }),
      },
    });
    const loop = startEventLoopMonitor();
    const host = await openPerfHost(browser, server, '');
    const bots = await joinBots(server, host.page);
    try {
      // Lobby mit vier Figuren eine Weile messen (Arena läuft hinter dem Lobby-Panel).
      await host.page.waitForTimeout(LOBBY_MS);
      await startGame(host.page);
      // Heap je Szene (CDP): Höchstwert ohne GC (wie im Spiel, nur informativ) und Heap nach
      // erzwungener GC einmal je Vorkommen einer Szene (verglichen, CHAOS-158).
      const heapByScene: Record<string, number> = {};
      const retained = createRetainedHeapTracker(RETAINED_HEAP_AFTER_TICKS);
      let sampling = false;
      const sampler = setInterval(() => {
        if (sampling) return;
        sampling = true;
        void (async () => {
          try {
            const [scenes, usage] = await Promise.all([
              host.page.evaluate(() => window.__chaosPerf?.activeScenes() ?? []),
              host.cdp.send('Runtime.getHeapUsage'),
            ]);
            for (const scene of scenes)
              heapByScene[scene] = Math.max(heapByScene[scene] ?? 0, usage.usedSize);
            const due = retained.tick(scenes);
            if (due.length > 0) retained.record(due, await heapAfterGc(host.cdp));
          } catch {
            // Seite navigiert/schließt: Probe auslassen.
          } finally {
            sampling = false;
          }
        })();
      }, HEAP_SAMPLE_MS);
      await waitForPodium(host.page, matchMinutes * 60_000);
      await host.page.waitForTimeout(PODIUM_MS);
      clearInterval(sampler);

      const report = await host.page.evaluate(() => window.__chaosPerf?.report() ?? []);
      const summary = await host.page.evaluate(() => window.__chaosPerf?.summary() ?? '');
      const transitionList = await host.page.evaluate(
        () => window.__chaosPerf?.transitions() ?? [],
      );
      const scenes: Record<string, FlatMetrics> = Object.fromEntries(
        report.map((scene: ScenePerf) => [
          scene.scene,
          { ...flatten(scene), heapRetainedMB: retained.megabytes(scene.scene) },
        ]),
      );
      const seenMinigames = Object.keys(scenes).filter((scene) => /^minispiel:[^:]+$/.test(scene));
      expect(seenMinigames.sort(), 'jedes Minispiel der Rotation gemessen').toEqual(
        minigames.map((m) => `minispiel:${m.id}`).sort(),
      );
      for (const scene of ['lobby', 'brett', 'finale', 'podest']) {
        expect(Object.keys(scenes), `Szene ${scene} gemessen`).toContain(scene);
      }
      const transitions = flattenTransitions(summarizeTransitions(transitionList));

      const durationS = ((host.ws.lastAt ?? 0) - (host.ws.firstAt ?? 0)) / 1000;
      const environment = environmentInfo(browser.version());
      const result = {
        scenario: 'partie',
        environment,
        playMs: PLAY_MS,
        scenes,
        transitions,
        transitionList,
        heapByScene,
        hostMessages: { durationS, byType: host.ws.byType },
        botRtt: summarizeRtts(bots),
        botInputsSent: bots.reduce((sum, bot) => sum + bot.inputsSent, 0),
        eventLoop: loop.stop(),
        summary,
      };
      writeResult('partie', result);

      const baseline = readBaseline();
      const comparisons = [
        ...compareScenes(baseline.partie ?? {}, scenes),
        ...compareTransitions(baseline[TRANSITIONS_SCENARIO] ?? {}, transitions),
      ];
      console.log(`\n## Partie (${environment.browser})\n\n${sceneTable(scenes)}\n`);
      console.log(
        `### Standbild je Szenenwechsel (Long Tasks ≥ 50 ms, Aufbau bis erstes Bild)\n\n${transitionTable(transitions)}\n`,
      );
      console.log(`Server → Host: ${JSON.stringify(host.ws.byType)} in ${durationS.toFixed(0)} s`);
      console.log(
        `Bot-RTT über den Server: ${JSON.stringify(result.botRtt)}; Event-Loop: ${JSON.stringify(result.eventLoop)}`,
      );
      console.log(`\n${comparisonTable(comparisons)}\n`);
      // Nach dem Schreiben prüfen, damit die Rohdaten (`transitionList`) auch bei Fehlern vorliegen.
      for (const label of REQUIRED_TRANSITIONS) {
        expect(
          transitionList.filter((t) => t.label === label && t.complete).length,
          `Szenenwechsel ${label} mit erstem Bild gemessen`,
        ).toBeGreaterThan(0);
      }
      if (process.env.PERF_UPDATE_BASELINE === '1' && !GPU)
        await updateBaseline({ partie: scenes, [TRANSITIONS_SCENARIO]: transitions }, environment);

      const failed = comparisons.flatMap((c) =>
        c.results
          .filter(
            (r) =>
              r.status === 'regression' &&
              (r.kind === 'strukturell' || process.env.PERF_STRICT === '1'),
          )
          .map((r) => `${c.scene}.${r.metric}: ${String(r.current)} > ${String(r.limit)}`),
      );
      if (process.env.PERF_UPDATE_BASELINE !== '1' && !GPU)
        expect(failed, 'Regressionen gegen die Baseline').toEqual([]);
      expectNoProblems(host.problems, 'Host');
    } finally {
      for (const bot of bots) bot.close();
      await host.context.close();
      await server.close();
    }
  });

  test('Revanche ×3: Heap, Kontexte und DOM wachsen nicht', async ({ browser }) => {
    const minigames = rotationInfos().map((info) => ({
      id: info.id,
      playMs: 6000,
      scoring: info.scoring,
    }));
    const server = await startChaosServer({
      game: {
        rounds: 1,
        minigames,
        rules: withRules({ pacing: { minigameIntroMs: 2000, minigameResultsMs: 2000 } }),
      },
    });
    const host = await openPerfHost(browser, server, '&finale=fast');
    const warnings: string[] = [];
    host.page.on('console', (message) => {
      if (message.type() === 'warning') warnings.push(message.text());
    });
    const bots = await joinBots(server, host.page);
    const lobbySamples: {
      game: number;
      heapMB: number;
      domNodes: number;
      canvases: number;
      contexts: number | null;
    }[] = [];
    const sampleLobby = async (game: number) => {
      // Lobby eingeschwungen: Arena läuft, Brett/Minispiel/Podest entsorgt.
      await expect(host.page.locator('main.host')).toHaveAttribute('data-phase', 'lobby');
      await expect(host.page.locator('main.host')).toHaveAttribute('data-scene', 'ready');
      await host.page.waitForTimeout(1500);
      const heap = await heapAfterGc(host.cdp);
      const dom = await host.page.evaluate(() => ({
        domNodes: document.getElementsByTagName('*').length,
        canvases: document.getElementsByTagName('canvas').length,
      }));
      await host.page.waitForTimeout(600);
      const report = await host.page.evaluate(() => window.__chaosPerf?.report() ?? []);
      const lobby = report.find((scene: ScenePerf) => scene.scene === 'lobby');
      lobbySamples.push({
        game,
        heapMB: heap / 1024 ** 2,
        ...dom,
        contexts: lobby?.contextsMax ?? null,
      });
      await host.page.evaluate(() => {
        window.__chaosPerf?.reset();
      });
    };
    try {
      await sampleLobby(0);
      for (const game of [1, 2, 3]) {
        await startGame(host.page);
        // Neue Partie zeigt das Brett, nicht den alten Endstand (Regie springt bei eventSeq 0).
        await expect(host.page.getByTestId('board-results')).toHaveCount(0, { timeout: 10_000 });
        await waitForPodium(host.page, 5 * 60_000);
        await host.page.waitForTimeout(2000);
        await host.page.getByTestId('rematch-button').click();
        await expect
          .poll(() => server.server.session.snapshot().phase, { timeout: 20_000 })
          .toBe('lobby');
        await sampleLobby(game);
      }
      const environment = environmentInfo(browser.version());
      writeResult('revanche', { scenario: 'revanche', environment, lobbySamples });
      console.log(`\n## Revanche ×3 (Lobby nach jeder Partie, Heap nach GC)\n`);
      console.table(lobbySamples);

      const first = lobbySamples[1];
      const last = lobbySamples[3];
      if (!first || !last) throw new Error('Lobby-Proben fehlen');
      // Nach Partie 1 sind Figuren, Schriften und Shader einmal geladen; danach darf der Heap
      // nicht weiter wachsen (Toleranz: +10 % oder +5 MB, GC ist nicht vollständig deterministisch).
      expect(last.heapMB, 'Heap nach 3 Partien').toBeLessThanOrEqual(
        Math.max(first.heapMB * 1.1, first.heapMB + 5),
      );
      expect(last.domNodes, 'DOM-Knoten nach 3 Partien').toBeLessThanOrEqual(first.domNodes + 20);
      for (const sample of lobbySamples) {
        expect(
          sample.canvases,
          `Canvas-Elemente in der Lobby (Partie ${String(sample.game)})`,
        ).toBe(1);
        expect(sample.contexts, `WebGL-Kontexte in der Lobby (Partie ${String(sample.game)})`).toBe(
          1,
        );
      }
      expectNoProblems(host.problems, 'Host');
    } finally {
      if (warnings.length > 0) console.log(`Host-Warnungen: ${warnings.slice(-10).join(' | ')}`);
      for (const bot of bots) bot.close();
      await host.context.close();
      await server.close();
    }
  });
});
