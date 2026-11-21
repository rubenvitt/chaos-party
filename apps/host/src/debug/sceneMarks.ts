/**
 * Szenen-Marken und Long Tasks für die Standbild-Kennzahl je Szenenwechsel (CHAOS-153), nur mit
 * `?debug=1`. Ohne Debug tun die Funktionen nichts (kein Beobachter, keine Marke).
 *
 * - {@link markScene}: `performance.mark("chaos:<szene>:<punkt>")` (sichtbar im Performance-
 *   Profil der DevTools) und Eintrag im eigenen Protokoll.
 * - {@link markFirstFrame}: setzt `erstes-bild`, sobald die Szene ihr nächstes Bild fertig hat.
 * - {@link startSceneLog}: beobachtet Long Tasks (`PerformanceObserver`, Typ `longtask`). Die App
 *   startet das Protokoll mit dem Debug-Monitor; `markScene` startet es zur Sicherheit auch.
 *
 * Auswertung rein in `transitions.ts`; abrufbar über `window.__chaosPerf.transitions()`.
 */
import { parseHostConfig } from '../config.ts';
import type { PerfSource } from './perfTypes.ts';
import {
  sceneTransitions,
  type LongTask,
  type MarkedScene,
  type SceneMark,
  type ScenePoint,
  type SceneTransition,
} from './transitions.ts';

/** Obergrenzen des Protokolls (eine Partie hat wenige Dutzend Marken). */
const MAX_MARKS = 1000;
const MAX_LONG_TASKS = 5000;

const marks: SceneMark[] = [];
const longTasks: LongTask[] = [];
let observer: PerformanceObserver | null = null;
let enabled: boolean | null = null;

function isEnabled(): boolean {
  enabled ??= typeof location !== 'undefined' && parseHostConfig(location.search).debug;
  return enabled;
}

function push<T>(list: T[], entry: T, max: number) {
  list.push(entry);
  if (list.length > max) list.splice(0, list.length - max);
}

/** Long Tasks beobachten (nur mit `?debug=1`, nur in Browsern mit `longtask`, z. B. Chromium). */
export function startSceneLog(): void {
  if (observer || !isEnabled() || typeof PerformanceObserver === 'undefined') return;
  if (!PerformanceObserver.supportedEntryTypes.includes('longtask')) return;
  observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      push(longTasks, { start: entry.startTime, duration: entry.duration }, MAX_LONG_TASKS);
    }
  });
  observer.observe({ type: 'longtask' });
}

/**
 * Marke setzen (nur mit `?debug=1`). `at` (Zeitbasis `performance.now()`) setzt sie
 * nachträglich, z. B. `angefragt` auf den Empfang des Stands.
 */
export function markScene(
  scene: MarkedScene,
  point: ScenePoint,
  at: number = performance.now(),
): void {
  if (!isEnabled()) return;
  startSceneLog();
  performance.mark(`chaos:${scene}:${point}`, { startTime: at });
  push(marks, { scene, point, at }, MAX_MARKS);
}

/**
 * `erstes-bild` setzen, sobald `source` ihr nächstes Bild fertig hat (nur mit `?debug=1`).
 * Nach `attachPerf` anmelden: Der Zähler der Draw Calls wird je Beobachter abgeholt, der
 * frühere Beobachter liest ihn zuerst. Liefert die Abmeldung.
 */
export function markFirstFrame(scene: MarkedScene, source: PerfSource): () => void {
  if (!isEnabled()) return () => undefined;
  let done = false;
  const stop = source.onFrameRendered(() => {
    if (done) return;
    done = true;
    markScene(scene, 'erstes-bild');
    // Abmelden außerhalb des Render-Rückrufs (Babylon iteriert gerade die Beobachter).
    queueMicrotask(stop);
  });
  return () => {
    done = true;
    stop();
  };
}

/** Übergänge seit dem Laden bzw. dem letzten {@link resetSceneLog}. */
export function sceneLogTransitions(): SceneTransition[] {
  return sceneTransitions(marks, longTasks, performance.now());
}

export function resetSceneLog(): void {
  marks.length = 0;
  longTasks.length = 0;
}
