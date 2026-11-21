/**
 * Auswertung der Messläufe (CHAOS-39): Kennzahlen je Szene flach machen, gegen die Baseline
 * vergleichen und als Markdown-Tabelle ausgeben.
 *
 * Zwei Arten von Schwellen (Begründung in `docs/performance.md`):
 * - **strukturell** (immer geprüft, rechnerunabhängig): WebGL-Kontexte und Render-Schleifen je
 *   Szene dürfen nicht steigen; Draw Calls höchstens +10 % (+5).
 * - **zeitlich** (nur mit `PERF_STRICT=1`, gleicher Rechner nötig): Bildabstand p95 und
 *   Render-Zeit (Median und p95) höchstens +25 % (+4 ms bzw. +2 ms), Heap nach GC +20 % (+10 MB);
 *   längster Block je Szenenwechsel (CHAOS-153) höchstens +50 % (+250 ms bzw. +150 ms).
 *   Mediane erst ab {@link MIN_FRAMES_FOR_MEDIAN}, p95 erst ab {@link MIN_FRAMES_FOR_P95} Bildern
 *   je Szene (CHAOS-165).
 *
 * Der Heap-**Höchstwert** ohne GC (`heapMaxMB`) wird nur noch berichtet: Er hängt davon ab, ob
 * kurz vor der Probe eine Garbage Collection lief, und schwankte im selben Stand um bis zu
 * +90 % (CHAOS-158). Verglichen wird der Heap nach erzwungener GC (`heapRetainedMB`).
 */
import {
  compareToBaseline,
  type RegressionResult,
  type Tolerance,
} from '../../packages/metrics/src/index.ts';
import type { ScenePerf } from '../../apps/host/src/debug/perfMonitor.ts';
import type { TransitionSummary } from '../../apps/host/src/debug/transitions.ts';

export const STRUCTURAL: Readonly<Record<string, Tolerance>> = {
  contextsMax: { relative: 0, absolute: 0 },
  renderLoopsMax: { relative: 0, absolute: 0 },
  drawCallsMedian: { relative: 0.1, absolute: 5 },
};

export const TIMING: Readonly<Record<string, Tolerance>> = {
  frameMedian: { relative: 0.25, absolute: 4 },
  frameP95: { relative: 0.25, absolute: 4 },
  renderMedian: { relative: 0.25, absolute: 2 },
  renderP95: { relative: 0.25, absolute: 2 },
  heapRetainedMB: { relative: 0.2, absolute: 10 },
};

/**
 * Standbild je Szenenwechsel (CHAOS-153), zeitlich: Long Tasks unter SwiftShader schwanken
 * stärker als Bildabstände (EXP-025: Brett → Minispiel 0,74–1,87 s im selben Stand), daher
 * weitere Toleranz. Der Median über die Vorkommen ist das robustere Signal, der Höchstwert
 * fängt einen einzelnen Rückfall (z. B. Shader wieder am Stück).
 */
export const TRANSITION_TIMING: Readonly<Record<string, Tolerance>> = {
  longestMedianMs: { relative: 0.5, absolute: 150 },
  longestMaxMs: { relative: 0.5, absolute: 250 },
};

export type FlatMetrics = Record<string, number | null>;

const MB = 1024 * 1024;

/** Kennzahlen einer Szene als flache Werte (Schlüssel wie in `STRUCTURAL`/`TIMING`). */
export function flatten(scene: ScenePerf): FlatMetrics {
  return {
    frames: scene.frames,
    durationS: scene.durationMs / 1000,
    fps: scene.fps,
    frameMedian: scene.frameTime?.median ?? null,
    frameP95: scene.frameTime?.p95 ?? null,
    renderMedian: scene.renderMs?.median ?? null,
    renderP95: scene.renderMs?.p95 ?? null,
    drawCallsMedian: scene.drawCalls?.median ?? null,
    drawCallsMax: scene.drawCalls?.max ?? null,
    activeMeshesMedian: scene.activeMeshes?.median ?? null,
    inputToFrameMedian: scene.inputToFrame?.median ?? null,
    inputToFrameP95: scene.inputToFrame?.p95 ?? null,
    inputCount: scene.inputToFrame?.count ?? 0,
    boardToFrameMedian: scene.boardToFrame?.median ?? null,
    boardToFrameP95: scene.boardToFrame?.p95 ?? null,
    contextsMax: scene.contextsMax,
    renderLoopsMax: scene.renderLoopsMax,
    heapMaxMB: scene.heapMaxBytes === null ? null : scene.heapMaxBytes / MB,
    meshes: scene.resources?.meshes ?? null,
    materials: scene.resources?.materials ?? null,
    textures: scene.resources?.textures ?? null,
    textureMB: scene.resources ? scene.resources.textureBytes / MB : null,
  };
}

export interface RetainedHeapTracker {
  /**
   * Ein Proben-Takt mit den gerade aktiven Szenen. Liefert die Szenen, deren aktuelles
   * Vorkommen jetzt `afterTicks` Takte in Folge aktiv ist und noch keinen Heap nach GC hat.
   */
  tick(activeScenes: readonly string[]): string[];
  /** Heap nach GC (Bytes) für diese Szenen; je Szene zählt der Höchstwert über die Vorkommen. */
  record(scenes: readonly string[], bytes: number): void;
  /** Höchster Heap nach GC der Szene in MB, `null` ohne Messung (Vorkommen zu kurz). */
  megabytes(scene: string): number | null;
}

/**
 * Heap nach GC je Szene (CHAOS-158): einmal je Vorkommen, sobald die Szene `afterTicks` Takte
 * in Folge aktiv ist. Verschwindet eine Szene, beginnt ihr nächstes Vorkommen von vorn.
 */
export function createRetainedHeapTracker(afterTicks: number): RetainedHeapTracker {
  const streak = new Map<string, number>();
  const maxBytes = new Map<string, number>();
  return {
    tick(activeScenes) {
      const active = new Set(activeScenes);
      for (const scene of [...streak.keys()]) if (!active.has(scene)) streak.delete(scene);
      const due: string[] = [];
      for (const scene of active) {
        const count = (streak.get(scene) ?? 0) + 1;
        streak.set(scene, count);
        if (count === afterTicks) due.push(scene);
      }
      return due;
    },
    record(scenes, bytes) {
      for (const scene of scenes) maxBytes.set(scene, Math.max(maxBytes.get(scene) ?? 0, bytes));
    },
    megabytes(scene) {
      const bytes = maxBytes.get(scene);
      return bytes === undefined ? null : bytes / MB;
    },
  };
}

/** Kennzahlen je Szenenwechsel als flache Werte (Schlüssel = Übergang, z. B. „brett → minispiel“). */
export function flattenTransitions(
  summaries: readonly TransitionSummary[],
): Record<string, FlatMetrics> {
  return Object.fromEntries(
    summaries.map((s) => [
      s.label,
      {
        count: s.count,
        incomplete: s.incomplete,
        longestMedianMs: s.longestMedianMs,
        longestMaxMs: s.longestMaxMs,
        blockedMedianMs: s.blockedMedianMs,
        waitMedianMs: s.waitMedianMs,
        requestMedianMs: s.requestMedianMs,
        requestMaxMs: s.requestMaxMs,
      },
    ]),
  );
}

/**
 * Ab so vielen Bildern je Szene werden Bildabstand und Render-Zeit (Median) verglichen
 * (CHAOS-158). Anleitung und Ergebnis der Minispiele zeichnen unter SwiftShader 3–20 Bilder;
 * selbst ihr Median hängt dann an wenigen Einzelbildern.
 */
export const MIN_FRAMES_FOR_MEDIAN = 25;

/**
 * Ab so vielen Bildern je Szene werden auch die p95-Werte verglichen (CHAOS-165). Darunter ist
 * p95 praktisch einer der höchsten Einzelwerte: Die Render-Zeit p95 von Sockenregen (≈ 30 Bilder)
 * lag in fünf Läufen desselben Stands zwischen 14 und 47 ms, der Median bei 6,5–8,6 ms. Betrifft
 * unter SwiftShader alle Minispiele (29–62 Bilder), Lobby und Podest; das Brett hat ≈ 200.
 */
export const MIN_FRAMES_FOR_P95 = 100;

const MIN_FRAMES: Readonly<Record<string, number>> = {
  frameMedian: MIN_FRAMES_FOR_MEDIAN,
  renderMedian: MIN_FRAMES_FOR_MEDIAN,
  frameP95: MIN_FRAMES_FOR_P95,
  renderP95: MIN_FRAMES_FOR_P95,
};

export type SceneResult = Omit<RegressionResult, 'status'> & {
  readonly status: RegressionResult['status'] | 'zu wenige Bilder';
  readonly kind: 'strukturell' | 'zeitlich';
};

export interface SceneComparison {
  readonly scene: string;
  readonly results: readonly SceneResult[];
}

/** Vergleicht jede Szene der Messung mit derselben Szene der Baseline. */
export function compareScenes(
  baseline: Readonly<Record<string, FlatMetrics>>,
  current: Readonly<Record<string, FlatMetrics>>,
): SceneComparison[] {
  return Object.keys(current).map((scene) => {
    const base = baseline[scene] ?? {};
    const now = current[scene] ?? {};
    return {
      scene,
      results: [
        ...compareToBaseline(base, now, STRUCTURAL).map((r) => ({
          ...r,
          kind: 'strukturell' as const,
        })),
        ...compareToBaseline(base, now, TIMING).map((r): SceneResult => ({
          ...r,
          kind: 'zeitlich',
          status: (now.frames ?? 0) < (MIN_FRAMES[r.metric] ?? 0) ? 'zu wenige Bilder' : r.status,
        })),
      ],
    };
  });
}

/** Vergleicht jeden Szenenwechsel der Messung mit demselben Übergang der Baseline (zeitlich). */
export function compareTransitions(
  baseline: Readonly<Record<string, FlatMetrics>>,
  current: Readonly<Record<string, FlatMetrics>>,
): SceneComparison[] {
  return Object.keys(current).map((label) => ({
    scene: label,
    results: compareToBaseline(baseline[label] ?? {}, current[label] ?? {}, TRANSITION_TIMING).map(
      (r) => ({ ...r, kind: 'zeitlich' as const }),
    ),
  }));
}

function fmt(value: number | null | undefined, digits = 1): string {
  return value === null || value === undefined || !Number.isFinite(value)
    ? '–'
    : value.toFixed(digits);
}

/** Markdown-Tabelle der Kennzahlen je Szene. */
export function sceneTable(scenes: Readonly<Record<string, FlatMetrics>>): string {
  const head =
    '| Szene | s | Frames | fps | Bildabstand p50/p95 ms | Render p50/p95 ms | Draw Calls p50/max | aktive Meshes | Eingabe→Frame p50/p95 ms (n) | Brett→Frame p50/p95 ms | Kontexte | Schleifen | Heap max / nach GC MB | Texturen ~MB |';
  const sep = '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|';
  const rows = Object.entries(scenes).map(([scene, m]) =>
    [
      scene,
      fmt(m.durationS, 0),
      fmt(m.frames, 0),
      fmt(m.fps),
      `${fmt(m.frameMedian)} / ${fmt(m.frameP95)}`,
      `${fmt(m.renderMedian)} / ${fmt(m.renderP95)}`,
      `${fmt(m.drawCallsMedian, 0)} / ${fmt(m.drawCallsMax, 0)}`,
      fmt(m.activeMeshesMedian, 0),
      `${fmt(m.inputToFrameMedian)} / ${fmt(m.inputToFrameP95)} (${fmt(m.inputCount, 0)})`,
      `${fmt(m.boardToFrameMedian)} / ${fmt(m.boardToFrameP95)}`,
      fmt(m.contextsMax, 0),
      fmt(m.renderLoopsMax, 0),
      `${fmt(m.heapMaxMB)} / ${fmt(m.heapRetainedMB)}`,
      fmt(m.textureMB),
    ].join(' | '),
  );
  return [head, sep, ...rows.map((row) => `| ${row} |`)].join('\n');
}

/** Markdown-Tabelle: längster Block (Long Task) je Szenenwechsel. */
export function transitionTable(transitions: Readonly<Record<string, FlatMetrics>>): string {
  const head =
    '| Übergang | n (ohne erstes Bild) | längster Block Median / max ms | blockiert Median ms | Aufbau→erstes Bild Median ms |';
  const sep = '|---|---|---|---|---|';
  const rows = Object.entries(transitions).map(([label, m]) =>
    [
      label,
      `${fmt(m.count, 0)} (${fmt(m.incomplete, 0)})`,
      `${fmt(m.longestMedianMs, 0)} / ${fmt(m.longestMaxMs, 0)}`,
      fmt(m.blockedMedianMs, 0),
      fmt(m.waitMedianMs, 0),
    ].join(' | '),
  );
  return [head, sep, ...rows.map((row) => `| ${row} |`)].join('\n');
}

/** Tabelle der Vergleiche; nur Abweichungen und fehlende Werte, damit sie lesbar bleibt. */
export function comparisonTable(comparisons: readonly SceneComparison[]): string {
  const rows = comparisons.flatMap((comparison) =>
    comparison.results.map(
      (r) =>
        `| ${comparison.scene} | ${r.metric} | ${r.kind} | ${fmt(r.baseline)} | ${fmt(r.current)} | ${fmt(r.limit)} | ${r.status} |`,
    ),
  );
  return [
    '| Szene | Kennzahl | Art | Baseline | jetzt | Grenze | Status |',
    '|---|---|---|---|---|---|---|',
    ...rows,
  ].join('\n');
}
