/**
 * Minispiel-Bühne (M3, CHAOS-26/33): eine eigene Babylon-Engine und Szene je Minispiel auf
 * einem eigenen Canvas, darin der Runner aus dem minigame-sdk mit Figuren, Havok (falls
 * `info.physics`) und Effekten. Framework-frei; React (`MinigameScreen`) steuert sie.
 *
 * Lebenszyklus: `createMinigameStage` lädt sofort (Figuren, Havok, `runner.prepare`) und
 * rendert das vorbereitete Bild – das ist der Hintergrund der Anleitung. `start()` lässt die
 * Spielzeit laufen (auch wenn es vor Ende des Ladens kommt: dann direkt danach).
 * `celebrate()` lässt die Figuren zum Ergebnis jubeln/schmollen. `dispose()` entsorgt alles:
 * Render-Schleife, Runner (räumt das Minispiel weg), Effekte, Figuren, Szene, Engine.
 *
 * Pause (v4, ADR-015): `pause()`/`resume()` halten den Runner an (`runner.pause()`): fester Takt
 * steht, Eingaben werden ignoriert, gehaltene Eingaben losgelassen, keine Nachholzeit. Das Bild
 * wird weiter gerendert (Figuren-Leerlauf, Wind im Natur-Look), die Spielzeit steht. Kommt die
 * Pause vor dem Laden, wird der Runner direkt nach dem Vorbereiten angehalten.
 *
 * Testmodus: keine Render-Schleife; `step(n)` rechnet n feste Schritte und rendert einmal
 * (in der Pause nur das Bild, ohne Schritte).
 *
 * Verteilter Aufbau (CHAOS-168): `runner.prepare` gibt nach wenigen ms je Bild ab
 * (`./preparePacing.ts`), `prepareSceneGradually` danach ebenso für die Shader. Gezeichnet wird
 * erst, wenn beides fertig ist.
 *
 * Natur-Look (CHAOS-62): Die Bühne gibt dem Minispiel `ctx.look` mit (`./natureLook.ts`).
 * Bestellt es eine Kulisse, setzt die Bühne nach `prepare` Licht, Himmel und Nachbearbeitung
 * der Stimmung (`?stimmung=`, Grafikstufe `?qualitaet=` bzw. automatisch).
 */
import { Engine } from '@babylonjs/core/Engines/engine.js';
import { Color4 } from '@babylonjs/core/Maths/math.color.js';
import { Scene } from '@babylonjs/core/scene.js';
import type {
  MinigameInput,
  MinigamePlacement,
  MinigameTeams,
  Slot,
} from '@chaos-party/minigame-sdk';
import {
  createMinigameRunner,
  type CharacterFactory,
  type CharacterHandle,
  type MinigameHud,
  type MinigameModule,
  type MinigamePlayer,
  type MinigameRunner,
  type RunnerResult,
  type RunnerState,
} from '@chaos-party/minigame-sdk/babylon';
import { loadCharacters, type CharacterLibrary } from '../characters/index.ts';
import type { PerfSource } from '../debug/perfTypes.ts';
import { observeFrames, resourceStats } from '../debug/renderProbe.ts';
import { createAdaptiveQuality } from '../nature/quality.ts';
import { applyRenderScale, currentLookSettings } from '../nature/settings.ts';
import type { NatureLook } from '../nature/lighting.ts';
import { createMinigameLook, SOFTWARE_MAX_STEPS, type HostMinigameLook } from './natureLook.ts';
import { createPreparePacing } from './preparePacing.ts';
import type { SoundEngine } from '../fx/audio.ts';
import { createMinigameFx, type FxStats, type HostMinigameFx } from '../fx/minigameFx.ts';
import { loadHavok } from '../scene/havok.ts';
import { prepareSceneGradually } from '../scene/prepareGradually.ts';

export type StageStatus = 'loading' | 'ready' | 'error' | 'disposed';

export interface MinigameStageOptions {
  readonly canvas: HTMLCanvasElement;
  readonly module: MinigameModule;
  readonly players: readonly MinigamePlayer[];
  readonly seed: number;
  /** Aufstellung bei Teams bzw. Koop vom Server (CHAOS-89); fehlt/`null` = jeder gegen jeden. */
  readonly teams?: MinigameTeams | null;
  /** Spielzeit (ms); nach Host-Neuladen die Restzeit. */
  readonly timeLimitMs: number;
  /**
   * Runde und Rundenzahl der Partie (Lichtverlauf, CHAOS-63): Das Minispiel erbt die Stimmung
   * der Runde. `null`/fehlend: feste Brett-Stimmung (lokaler Ablauf, Vorschau).
   */
  readonly lightRound?: {
    readonly round: number;
    readonly rounds: number;
    /** Brett der Partie (CHAOS-199: eigener Stimmungsverlauf je Brett). */
    readonly boardId?: string;
  } | null;
  readonly testMode: boolean;
  readonly sound: SoundEngine;
  /** Genau einmal, sobald das Minispiel ein (geprüftes) Ergebnis hat. */
  readonly onResult: (result: RunnerResult) => void;
  /** Ladefehler (Havok, Figuren, `prepare`). */
  readonly onError?: (error: unknown) => void;
}

export interface MinigameStage extends PerfSource {
  readonly status: StageStatus;
  /** Erfüllt, sobald vorbereitet und das erste Bild gerendert ist. */
  readonly ready: Promise<void>;
  readonly runnerState: RunnerState | null;
  readonly elapsedMs: number;
  readonly result: RunnerResult | null;
  readonly fxStats: FxStats;
  /** Partie pausiert (Runner angehalten bzw. beim Laden anzuhalten). */
  readonly paused: boolean;
  /** Minispiel anhalten (Partie-Pause); idempotent. */
  pause(): void;
  /** Weiterspielen ohne Nachholzeit; idempotent. */
  resume(): void;
  /** Spielzeit starten (idempotent; vor dem Laden: direkt danach). */
  start(): void;
  /**
   * Frist des Servers naht (CHAOS-206, `playDeadline`): Läuft das Spiel, wertet die
   * Laufzeit jetzt den Stand (`runner.finishNow`); sonst startet es nicht mehr. Idempotent.
   */
  endPlay(): void;
  input(slot: Slot, input: MinigameInput): void;
  setConnected(slot: Slot, connected: boolean): void;
  /** Figuren jubeln (Platz 1) bzw. schmollen; Jubel-Klang und Konfetti. Einmal je Bühne. */
  celebrate(placements: readonly MinigamePlacement[]): void;
  /** Nur Testmodus: `frames` feste Schritte, dann ein Bild. */
  step(frames: number): void;
  hud(): MinigameHud | null;
  dispose(): void;
}

/** Figuren-Fabrik, die sich die erzeugten Figuren je Slot merkt (für Jubel/Schmollen). */
function trackingFactory(
  library: CharacterLibrary,
  look: HostMinigameLook,
): {
  readonly factory: CharacterFactory;
  readonly handles: Map<Slot, CharacterHandle>;
} {
  const handles = new Map<Slot, CharacterHandle>();
  return {
    handles,
    factory: {
      create(scene, player) {
        const handle = library.create(scene, player);
        handles.set(player.slot, handle);
        look.addCaster(handle.shadowCaster);
        return handle;
      },
    },
  };
}

export function createMinigameStage(options: MinigameStageOptions): MinigameStage {
  const { canvas, module, testMode } = options;
  const engine = new Engine(
    canvas,
    true,
    { preserveDrawingBuffer: testMode, stencil: true },
    // Testmodus: Gerätepixelverhältnis 1 wie Arena und Brett (stabile Screenshots).
    !testMode,
  );
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0, 0, 0, 0);
  // Testmodus: Figuren-Animationen laufen je Bild um feste 16 ms (stabile Screenshots).
  scene.useConstantAnimationDeltaTime = testMode;
  const fx: HostMinigameFx = createMinigameFx(scene, { sound: options.sound, testMode });
  // Stimmung der Runde (Lichtverlauf, CHAOS-63); ohne Runde wie das Brett.
  const settings = currentLookSettings(
    testMode,
    options.lightRound?.boardId ?? 'wackelwald',
    engine.getGlInfo().renderer,
    options.lightRound ?? null,
  );
  applyRenderScale(engine, settings);
  const look = createMinigameLook(scene, settings);
  const adaptive = createAdaptiveQuality(settings.quality, settings.automatic);
  let lighting: NatureLook | null = null;

  let status: StageStatus = 'loading';
  let runner: MinigameRunner | null = null;
  let library: CharacterLibrary | null = null;
  let handles = new Map<Slot, CharacterHandle>();
  // Als Objekt, damit TypeScript die Werte nach `await` nicht fälschlich festnagelt.
  const flags = { startRequested: false, celebrated: false, paused: false, ended: false };
  const isDisposed = () => status === 'disposed';

  const resize = () => {
    // Erst resize(): Babylon rechnet einen DPR-Wechsel in die Skalierung ein, danach die Grenze.
    engine.resize();
    applyRenderScale(engine, settings, adaptive.level);
  };
  window.addEventListener('resize', resize);

  const renderOnce = () => {
    if (!isDisposed() && scene.activeCamera) scene.render();
  };

  const startNow = () => {
    if (runner?.state !== 'ready' || flags.ended) return;
    runner.start();
  };

  const ready = (async () => {
    const loaded = await loadCharacters(scene, { keepPbr: true });
    if (isDisposed()) {
      loaded.dispose();
      return;
    }
    library = loaded;
    const havok = module.info.physics ? await loadHavok() : null;
    if (isDisposed()) return;
    const tracked = trackingFactory(loaded, look);
    handles = tracked.handles;
    runner = createMinigameRunner(module, {
      scene,
      players: options.players,
      seed: options.seed,
      ...(options.teams ? { teams: options.teams } : {}),
      timeLimitMs: options.timeLimitMs,
      fx,
      characters: tracked.factory,
      havok,
      testMode,
      look,
      // Software-Rendering: bis 4 s Spielzeit je Bild, damit das Ergebnis rechtzeitig kommt.
      ...(settings.software ? { maxStepsPerAdvance: SOFTWARE_MAX_STEPS } : {}),
      // Aufbau über mehrere Bilder verteilen (`ctx.pace()`, CHAOS-168): Die Anleitung läuft
      // weiter, statt während `prepare` am Stück zu stehen. Auch im Testmodus – das Ergebnis
      // des Aufbaus ist dasselbe, nur die Zeit verteilt sich.
      pacing: createPreparePacing(),
      onResult: (result) => {
        options.onResult(result);
      },
    });
    if (flags.paused) runner.pause();
    await runner.prepare();
    if (isDisposed()) return;
    if (scene.activeCamera) lighting = await look.finish(scene.activeCamera);
    if (isDisposed()) return;
    // Erst wenn alle Shader/Texturen bereit sind, zeigt das erste Bild die ganze Szene
    // (Hintergrund der Anleitung, stabile Screenshots). Schrittweise statt am Stück
    // (CHAOS-132, KI-25): Ohne parallele Shader-Übersetzung stand sonst die Anleitung.
    if (!(await prepareSceneGradually(scene, { isCancelled: isDisposed }))) return;
    status = 'ready';
    if (flags.startRequested) startNow();
    renderOnce();
    if (testMode) return;
    let last = performance.now();
    let seconds = 0;
    engine.runRenderLoop(() => {
      const now = performance.now();
      const next = adaptive.frame(now - last);
      if (next) {
        lighting?.setQuality(next);
        applyRenderScale(engine, settings, next);
      }
      runner?.advance((now - last) / 1000);
      seconds += (now - last) / 1000;
      look.update(seconds);
      last = now;
      renderOnce();
    });
  })();
  ready.catch((error: unknown) => {
    if (isDisposed()) return;
    status = 'error';
    console.error(`Minispiel ${module.info.id} konnte nicht geladen werden`, error);
    options.onError?.(error);
  });

  return {
    get status() {
      return status;
    },
    ready,
    get runnerState() {
      return runner?.state ?? null;
    },
    get elapsedMs() {
      return runner?.elapsedMs ?? 0;
    },
    get result() {
      return runner?.result ?? null;
    },
    get fxStats() {
      return fx.stats;
    },
    get paused() {
      return flags.paused;
    },
    pause() {
      if (flags.paused || isDisposed()) return;
      flags.paused = true;
      runner?.pause();
    },
    resume() {
      if (!flags.paused || isDisposed()) return;
      flags.paused = false;
      runner?.resume();
    },
    start() {
      flags.startRequested = true;
      if (status === 'ready') startNow();
    },
    endPlay() {
      if (runner?.state === 'running') runner.finishNow();
      else flags.ended = true;
    },
    input(slot, input) {
      runner?.input(slot, input);
    },
    setConnected(slot, connected) {
      runner?.setConnected(slot, connected);
    },
    celebrate(placements) {
      if (flags.celebrated || isDisposed()) return;
      flags.celebrated = true;
      fx.sound('cheer');
      for (const entry of placements) {
        const handle = handles.get(entry.slot);
        if (!handle) continue;
        try {
          handle.play(entry.place === 1 ? 'cheer' : 'sad');
          if (entry.place === 1) {
            const at = handle.root.getAbsolutePosition();
            fx.burst('confetti', { x: at.x, y: at.y + 1.6, z: at.z });
          }
        } catch (error) {
          // Das Minispiel hat die Figur womöglich schon selbst entsorgt – reine Optik.
          console.warn('Figur kann nicht jubeln', error);
        }
      }
    },
    step(frames) {
      if (!runner) return;
      for (let index = 0; index < frames && !flags.paused; index++) {
        if (runner.state === 'running' || runner.state === 'finished') runner.step(1);
      }
      renderOnce();
    },
    onFrameRendered(listener) {
      return observeFrames(scene, listener);
    },
    getResourceStats() {
      return resourceStats(scene);
    },
    hud() {
      if (!runner || runner.state === 'created' || runner.state === 'preparing') return null;
      try {
        return runner.hud();
      } catch (error) {
        console.warn('Minispiel-HUD nicht lesbar', error);
        return null;
      }
    },
    dispose() {
      if (isDisposed()) return;
      status = 'disposed';
      window.removeEventListener('resize', resize);
      engine.stopRenderLoop();
      try {
        runner?.dispose();
      } finally {
        fx.dispose();
        library?.dispose();
        scene.dispose();
        engine.dispose();
      }
    },
  };
}
