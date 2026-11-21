/**
 * Standbild beim Szenenwechsel (CHAOS-153): Aus Szenen-Marken und Long Tasks wird je Übergang
 * (Brett → Minispiel, Minispiel → Brett, Zählung → Podest) der längste Block berechnet, in dem
 * der Browser kein Bild zeichnen konnte. Rein (ohne DOM, ohne Babylon), damit Fenster und
 * Zuordnung getestet sind; die Marken setzt `sceneMarks.ts` (nur mit `?debug=1`).
 *
 * **Fenster:** Ab `aufbau` (Beginn des Aufbaus der neuen Szene) bis zum `erstes-bild` dieser
 * Szene. Das Podest wird schon während der Trophäenzählung vorbereitet und erst danach gezeigt;
 * dafür öffnet `sichtbar` ein zweites Fenster bis zum ersten Bild nach dem Zeigen. Ein Fenster
 * ohne erstes Bild endet beim nächsten `aufbau` bzw. beim Auswerten.
 *
 * **Zuordnung:** Eine Long Task zählt zu einem Übergang, wenn sie eines seiner Fenster
 * **überlappt** (nicht nur darin beginnt): Das Entsorgen der alten Szene und `new Engine(…)`
 * der neuen laufen oft in derselben Aufgabe, die schon vor der Marke `aufbau` beginnt.
 * Gezählt wird die volle Dauer der Aufgabe (sie war am Stück).
 */
import { median } from '@chaos-party/metrics';

/** Szenen mit Marken: Brett, Minispiel-Bühne, Siegerpodest. */
export type MarkedScene = 'brett' | 'minispiel' | 'podest';
/**
 * `angefragt`: Der Stand nennt die neue Szene, ihr Code lädt eventuell noch (Minispiel-Chunk,
 * CHAOS-86); `aufbau`: Aufbau beginnt; `sichtbar`: vorbereitete Szene wird gezeigt;
 * `erstes-bild`.
 */
export type ScenePoint = 'angefragt' | 'aufbau' | 'sichtbar' | 'erstes-bild';

export interface SceneMark {
  readonly scene: MarkedScene;
  readonly point: ScenePoint;
  /** `performance.now()` der Marke. */
  readonly at: number;
}

/** Eine Long Task (`PerformanceObserver`, Typ `longtask`, ≥ 50 ms). */
export interface LongTask {
  readonly start: number;
  readonly duration: number;
}

export interface SceneTransition {
  /** Z. B. „brett → minispiel“, „minispiel → brett“, „zählung → podest“, „lobby → brett“. */
  readonly label: string;
  readonly to: MarkedScene;
  /** Beginn des ersten Fensters: Marke `angefragt`, sonst `aufbau`. */
  readonly startAt: number;
  /**
   * Summe der Fensterlängen (Anfrage bzw. Aufbau bis erstes Bild, beim Podest plus Zeigen bis
   * Bild).
   */
  readonly waitMs: number;
  /** Von `angefragt` bis `aufbau` (Warten auf Code, CHAOS-86); 0 ohne Anfrage-Marke. */
  readonly requestMs: number;
  /** Alle Fenster mit erstem Bild abgeschlossen. */
  readonly complete: boolean;
  readonly longTasks: number;
  /** Längste überlappende Long Task in ms; 0 ohne Long Task. */
  readonly longestMs: number;
  /** Summe der überlappenden Long Tasks in ms. */
  readonly blockedMs: number;
}

/** Kennzahlen je Übergangsart über alle Vorkommen einer Partie. */
export interface TransitionSummary {
  readonly label: string;
  readonly count: number;
  /** Vorkommen ohne erstes Bild (Fenster endete beim nächsten Aufbau bzw. beim Auswerten). */
  readonly incomplete: number;
  /** Längster Block über alle Vorkommen. */
  readonly longestMaxMs: number;
  /** Median der längsten Blöcke je Vorkommen (robuster gegen einen Ausreißer). */
  readonly longestMedianMs: number | null;
  /** Median der blockierten Zeit je Vorkommen. */
  readonly blockedMedianMs: number | null;
  /** Median der Wartezeit bis zum ersten Bild je Vorkommen. */
  readonly waitMedianMs: number | null;
  /** Median und Höchstwert der Zeit von `angefragt` bis `aufbau` (CHAOS-86). */
  readonly requestMedianMs: number | null;
  readonly requestMaxMs: number;
}

interface Window {
  readonly start: number;
  end: number | null;
  /** Mit erstem Bild beendet (nicht durch den nächsten Aufbau). */
  framed: boolean;
}

interface Building {
  readonly label: string;
  readonly to: MarkedScene;
  readonly startAt: number;
  readonly requestMs: number;
  readonly windows: Window[];
}

function labelOf(from: MarkedScene | null, to: MarkedScene): string {
  // Das Podest wird hinter der Trophäenzählung (Brett im Finale) vorbereitet.
  if (to === 'podest') return 'zählung → podest';
  return `${from ?? 'lobby'} → ${to}`;
}

/**
 * Übergänge in zeitlicher Reihenfolge. `now` beendet Fenster, deren erstes Bild noch fehlt.
 */
export function sceneTransitions(
  marks: readonly SceneMark[],
  longTasks: readonly LongTask[],
  now: number,
): SceneTransition[] {
  const sorted = [...marks].sort((a, b) => a.at - b.at);
  const built: Building[] = [];
  let previous: MarkedScene | null = null;
  // Offene Anfrage je Szene; gilt nur bis zum nächsten Aufbau (gleich welcher Szene).
  const requested = new Map<MarkedScene, number>();
  const closeOpen = (at: number) => {
    for (const building of built) {
      for (const window of building.windows) window.end ??= at;
    }
  };
  for (const mark of sorted) {
    const current = [...built].reverse().find((b) => b.to === mark.scene);
    if (mark.point === 'angefragt') {
      if (!requested.has(mark.scene)) requested.set(mark.scene, mark.at);
    } else if (mark.point === 'aufbau') {
      // Ein neuer Aufbau beendet alle offenen Fenster (die alte Szene zeigt kein erstes Bild mehr).
      closeOpen(mark.at);
      const start = requested.get(mark.scene) ?? mark.at;
      requested.clear();
      built.push({
        label: labelOf(previous, mark.scene),
        to: mark.scene,
        startAt: start,
        requestMs: mark.at - start,
        windows: [{ start, end: null, framed: false }],
      });
      previous = mark.scene;
    } else if (mark.point === 'sichtbar') {
      if (current) current.windows.push({ start: mark.at, end: null, framed: false });
    } else {
      const open = current?.windows.find((window) => window.end === null);
      if (open) {
        open.end = mark.at;
        open.framed = true;
      }
    }
  }
  return built.map((building) => {
    const complete = building.windows.every((window) => window.framed);
    const windows = building.windows.map((window) => ({
      start: window.start,
      end: window.end ?? Math.max(window.start, now),
    }));
    const overlapping = longTasks.filter((task) =>
      windows.some(
        (window) => task.start < window.end && task.start + task.duration > window.start,
      ),
    );
    return {
      label: building.label,
      to: building.to,
      startAt: building.startAt,
      requestMs: building.requestMs,
      waitMs: windows.reduce((sum, window) => sum + (window.end - window.start), 0),
      complete,
      longTasks: overlapping.length,
      longestMs: overlapping.reduce((max, task) => Math.max(max, task.duration), 0),
      blockedMs: overlapping.reduce((sum, task) => sum + task.duration, 0),
    };
  });
}

/** Fasst die Vorkommen je Übergangsart zusammen (Reihenfolge des ersten Auftretens). */
export function summarizeTransitions(transitions: readonly SceneTransition[]): TransitionSummary[] {
  const byLabel = new Map<string, SceneTransition[]>();
  for (const transition of transitions) {
    const list = byLabel.get(transition.label) ?? [];
    list.push(transition);
    byLabel.set(transition.label, list);
  }
  return [...byLabel.entries()].map(([label, list]) => ({
    label,
    count: list.length,
    incomplete: list.filter((t) => !t.complete).length,
    longestMaxMs: list.reduce((max, t) => Math.max(max, t.longestMs), 0),
    longestMedianMs: median(list.map((t) => t.longestMs)),
    blockedMedianMs: median(list.map((t) => t.blockedMs)),
    waitMedianMs: median(list.map((t) => t.waitMs)),
    requestMedianMs: median(list.map((t) => t.requestMs)),
    requestMaxMs: list.reduce((max, t) => Math.max(max, t.requestMs), 0),
  }));
}
