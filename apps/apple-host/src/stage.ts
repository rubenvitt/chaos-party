/**
 * Headless-Minispiel-Bühne für den Apple-Host (ADR-019 §3): wie `apps/host/src/minigame/stage.ts`,
 * aber mit NullEngine statt Canvas, ohne Rendern und Tonausgabe. Swift zeichnet und spielt selbst (RealityKit, AVAudioEngine).
 *
 * Darstellung (CHAOS-144):
 * - `bodies()`: jedes sichtbare Mesh mit Lage, Farbe, Rolle (`markVisual`, CHAOS-149) und Verweis
 *   auf seine Geometrie; Figuren fehlen dort, sie kommen als `figures()` (Swift zeigt USDZ).
 * - `takeGeometry()`: die echte Geometrie der Meshes, dedupliziert, einmal je Minispiel
 *   (`./geometry.ts`), im Aufbau vorbereitet.
 * - Look: Die Bühne gibt dem Minispiel einen `look` wie der Browser-Host (gleicher Code-Pfad):
 *   `material` merkt sich die Oberfläche, `backdrop` nur die Spielfläche; die Kulisse drumherum
 *   baut Swift.
 * - Effekte (`ctx.fx`): Ausbrüche und Kamerawackeln als nummerierte Ereignisse (`effects()`),
 *   Klänge über `onSound` (CHAOS-190, `./minigameSounds.ts`).
 */
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh.js';
import { CreateCapsule } from '@babylonjs/core/Meshes/Builders/capsuleBuilder.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { Logger } from '@babylonjs/core/Misc/logger.js';
import { Scene } from '@babylonjs/core/scene.js';
import type {
  MinigameBotSeat,
  MinigameCue,
  MinigamePlacement,
  MinigameSecret,
  MinigameTeams,
  Slot,
} from '@chaos-party/minigame-sdk';
import {
  createMinigameRunner,
  PrepareAborted,
  visualOf,
  type CharacterFactory,
  type HavokInstance,
  type LookArea,
  type LookMaterialOptions,
  type MinigameFx,
  type MinigameLook,
  type MinigameModule,
  type MinigamePlayer,
  type MinigameRunner,
  type PrepareThrottle,
  type RunnerResult,
  type SoundId,
  type VisualTag,
} from '@chaos-party/minigame-sdk/babylon';
import type { BoardView } from '@chaos-party/protocol';
import type { PlayOptions } from '../../host/src/fx/sounds.ts';
import { minigameStageOf } from '../../host/src/minigame/plan.ts';
import { waitsForReady } from '../../host/src/minigame/readiness.ts';
import type {
  Body,
  BodyShape,
  MaterialFinish,
  MinigameBackdrop,
  MinigameCamera,
  MinigameEffect,
  MinigameFigure,
  MinigameGeometry,
} from './contract.ts';
import {
  encodeStep,
  finishGeometry,
  geometryKey,
  pendingGeometry as preparePending,
  readMeshData,
  type PendingGeometry,
} from './geometry.ts';

export interface HeadlessStageOptions {
  readonly module: MinigameModule;
  readonly players: readonly MinigamePlayer[];
  /** KI-Plätze, deren Eingaben die Laufzeit erzeugt (CHAOS-182, `botSeatsFromView`). */
  readonly bots?: readonly MinigameBotSeat[];
  readonly seed: number;
  /** Aufstellung bei Teams bzw. Koop vom Server (CHAOS-89/230); fehlt/`null` = jeder gegen jeden. */
  readonly teams?: MinigameTeams | null;
  readonly timeLimitMs: number;
  /** Geladenes Havok (Pflicht für `info.physics`). */
  readonly havok: HavokInstance | null;
  readonly onResult: (result: RunnerResult) => void;
  /** Controller-Hinweis hat gewechselt (CHAOS-231, nur Minispiele mit Abschnitten). */
  readonly onCue?: (cue: MinigameCue | null) => void;
  /** Private Rückmeldung eines Slots hat gewechselt (CHAOS-242, geheime Wahl). */
  readonly onSecret?: (slot: Slot, secret: MinigameSecret | null) => void;
  readonly log: (line: string) => void;
  /**
   * Verteilt den Aufbau auf mehrere `tick` (CHAOS-141). Fehlt er, baut die Bühne am Stück
   * (Tests).
   */
  readonly pacing?: PrepareThrottle;
  /** Uhr für Effekte (ms, Kern-Uhr); fehlt = 0 (Tests). */
  readonly now?: () => number;
  /** Klang aus `ctx.fx.sound` und dem Jubel im Ergebnis (CHAOS-190); fehlt = stumm. */
  readonly onSound?: (id: SoundId, options?: PlayOptions) => void;
  /**
   * Bühne frühestens zu dieser Zeit (Uhr aus `now`) fertig melden: künstlich später Aufbau für
   * Tests (`HostEnv.debugStageDelayMs`, CHAOS-206). Braucht `pacing`.
   */
  readonly readyNotBefore?: number;
}

/**
 * So viele ms rechnet der Aufbau einer Bühne bei 60 Hz höchstens je `tick`, dann geht es im
 * nächsten weiter (CHAOS-141). Klein gegen das Bildbudget von 16,7 ms: Dazu kommen Session,
 * `renderState` und ein Bauschritt, der das Budget überschreitet, bevor `pace` wieder fragt.
 */
export const PREPARE_BUDGET_MS = 2;

/** Höchstes Aufbau-Budget je `tick` bei langsamem Takt (CHAOS-205). */
export const PREPARE_BUDGET_MAX_MS = 20;

/**
 * Höchstes Aufbau-Budget je `tick` bei knapper Bühne (CHAOS-227). Seit CHAOS-214 endet die
 * Anleitung schon nach 3 s, wenn alle bereit sind; bei 10 Hz reichten 20 ms je Takt (600 ms in
 * 3 s) nicht immer. 50 ms sind bei 10 Hz die halbe Tick-Dauer; ein einzelner Hänger bleibt
 * gedeckelt.
 */
export const PREPARE_URGENT_MAX_MS = 50;

/** Abstand zweier `tick` bei 60 Hz (ms). */
const FRAME_MS = 1000 / 60;

/** Anteil der Tick-Dauer für den Aufbau: 2 von 16,7 ms bei 60 Hz (CHAOS-141). */
const PREPARE_SHARE = PREPARE_BUDGET_MS / FRAME_MS;

/** Anteil der Tick-Dauer, wenn die Bühne knapp wird (`urgent`, CHAOS-205). */
const URGENT_SHARE = 0.5;

/**
 * So viel jedes Tick-Abstands bleibt auch bei knapper Bühne frei (CHAOS-209): ein Bauschritt,
 * der das Budget überschreitet (ohne JIT bis gut 5 ms), dazu Session und `renderState`. Bei
 * 60 Hz bleiben so 6,7 ms Aufbau, und das Bild passt in 16,7 ms.
 */
export const FRAME_RESERVE_MS = 10;

/**
 * Bleibt bis zum Ende der Anleitung höchstens so viel Zeit (ms) und ist die Bühne noch nicht
 * fertig, rechnet der Aufbau mit `URGENT_SHARE` (CHAOS-205).
 */
export const PREPARE_URGENT_MS = 2_000;

/**
 * Ist die Zeit für eine noch nicht fertige Bühne knapp (CHAOS-205)? Ja, wenn das Spiel schon
 * läuft oder die Anleitung in höchstens `PREPARE_URGENT_MS` endet. Wartet die Anleitung auf
 * „Bereit“ (CHAOS-214), kann sie schon nach der Mindestzeit (3 s, `minigameReadyMinMs`) enden,
 * sobald alle bereit sind; `remainingMs` sagt dann nichts über das Ende. Wie bei der kurzen
 * Anleitung (3 s) gilt die Bühne deshalb von Anfang an als knapp.
 */
export function stageUrgentFor(view: BoardView, receivedAt: number, nowMs: number): boolean {
  const stageName = minigameStageOf(view);
  if (stageName === 'play') return true;
  if (stageName !== 'intro') return false;
  if (waitsForReady(view)) return true;
  if (view.remainingMs === null) return false;
  const left = view.remainingMs - (view.paused ? 0 : nowMs - receivedAt);
  return left <= PREPARE_URGENT_MS;
}

/**
 * Aufbau-Budget (ms) für einen `tick`, der `tickIntervalMs` nach dem vorigen kommt (CHAOS-205).
 * - Normal derselbe Anteil der Tick-Dauer wie `PREPARE_BUDGET_MS` bei 60 Hz (12 %): So kommt der
 *   Aufbau je Sekunde gleich weit, ob die App mit 60 Hz tickt oder gedrosselt mit 10 Hz (vorher
 *   bei 8 Hz oft erst nach dem Countdown fertig, CHAOS-203). Bei 60 Hz bleibt es bei 2 ms wie in
 *   CHAOS-141.
 * - `urgent` (Anleitung fast vorbei oder Spiel schon gestartet, Bühne nicht fertig): die halbe
 *   Tick-Dauer, aber höchstens so viel, dass `FRAME_RESERVE_MS` frei bleiben (CHAOS-209). Bei
 *   60 Hz sind das 6,7 ms statt 8,3 ms, ab 40 Hz wieder die halbe Tick-Dauer.
 * - Immer mindestens `PREPARE_BUDGET_MS`, höchstens `PREPARE_BUDGET_MAX_MS` (knapp:
 *   `PREPARE_URGENT_MAX_MS`, CHAOS-227, bei 10 Hz die halbe Tick-Dauer). Ein einzelner langer
 *   Tick (Hänger) gibt dem nächsten mehr Budget, gedeckelt.
 */
export function prepareBudgetMs(tickIntervalMs: number, urgent = false): number {
  const interval = tickIntervalMs > FRAME_MS ? tickIntervalMs : FRAME_MS;
  const budget = urgent
    ? Math.min(interval * URGENT_SHARE, interval - FRAME_RESERVE_MS)
    : interval * PREPARE_SHARE;
  const max = urgent ? PREPARE_URGENT_MAX_MS : PREPARE_BUDGET_MAX_MS;
  return Math.min(max, Math.max(PREPARE_BUDGET_MS, budget));
}

export interface HeadlessStage {
  readonly runner: MinigameRunner;
  /**
   * Die Babylon-Szene des Minispiels: nur für Prüfungen, etwa den Darstellungs-Vertrag
   * (CHAOS-154, `test/darstellung.ts`). Der Kern liest sie nie an `bodies()` vorbei.
   */
  readonly scene: Scene;
  /** Aufbau fertig (Szene steht, Körper klassifiziert); vorher liefert `bodies()` nichts. */
  readonly ready: boolean;
  /** Spielzeit starten (idempotent; vor Ende von `prepare`: direkt danach). */
  start(): void;
  /**
   * Frist des Servers naht (CHAOS-206, `playDeadline`): Läuft das Spiel, wertet die
   * Laufzeit jetzt den Stand (`runner.finishNow`); sonst startet es nicht mehr. Idempotent;
   * `true`, wenn der Aufruf etwas geändert hat.
   */
  endPlay(): boolean;
  /** Partie-Pause wie `stage.pause()/resume()` im Browser-Host; idempotent. */
  setPaused(paused: boolean): void;
  /** Echte Zeit vergeht: feste 1/60-Schritte über `runner.advance`. */
  advance(seconds: number): void;
  bodies(): Body[];
  /** Figuren je Slot (Wurzelknoten = Füße), ohne Kapsel-Körper. */
  figures(): MinigameFigure[];
  camera(): MinigameCamera | null;
  /** Spielfläche aus `look.backdrop`, sonst `null`. */
  readonly backdrop: MinigameBackdrop | null;
  /** Effekte ab `sinceMs` (Uhr aus `options.now`). */
  effects(sinceMs: number): MinigameEffect[];
  /**
   * Fertig kodierte, noch nicht ausgelieferte Geometrie: höchstens etwa `maxChars` Zeichen. Kodiert
   * wird hier in Schritten, höchstens `budgetMs` (echte Uhr aus `pacing`) je Aufruf; ohne
   * Budget alles am Stück.
   */
  takeGeometry(maxChars: number, budgetMs?: number): MinigameGeometry[];
  /** So viele Geometrien kennt die Bühne (ausgeliefert oder wartend). */
  readonly geometryTotal: number;
  /** Figuren jubeln (Platz 1, mit Konfetti) bzw. schmollen; einmal je Bühne (wie im Browser-Host). */
  celebrate(placements: readonly MinigamePlacement[]): void;
  dispose(): void;
}

/** Höchstens so viele Effekte hält die Bühne vor. */
const MAX_EFFECTS = 48;

interface FigureEntry {
  readonly player: MinigamePlayer;
  readonly root: TransformNode;
  readonly body: AbstractMesh;
  anim: string;
  seq: number;
  disposed: boolean;
}

/**
 * Figuren als Kapsel in Spielerfarbe (1,6 hoch, Füße bei y = 0) wie im Headless-Testharness des
 * SDK; dessen Modul ist hier nicht nutzbar (importiert `node:fs`). Merkt sich je Slot Wurzel und
 * zuletzt gespielte Animation (Swift spielt sie am USDZ).
 */
function capsuleCharacters(figures: Map<Slot, FigureEntry>): CharacterFactory {
  return {
    create(scene, player) {
      const root = new TransformNode(`figur-${player.slot}`, scene);
      const body = CreateCapsule(
        `figur-${player.slot}-koerper`,
        { height: 1.6, radius: 0.4 },
        scene,
      );
      body.position.y = 0.8;
      body.parent = root;
      const material = new StandardMaterial(`figur-${player.slot}-material`, scene);
      material.diffuseColor = Color3.FromHexString(player.color);
      body.material = material;
      const entry: FigureEntry = { player, root, body, anim: 'idle', seq: 0, disposed: false };
      figures.set(player.slot, entry);
      return {
        root,
        id: player.character,
        play: (animation) => {
          entry.anim = animation;
          entry.seq++;
        },
        dispose: () => {
          entry.disposed = true;
          material.dispose();
          body.dispose();
          root.dispose();
        },
      };
    },
  };
}

/**
 * Look für native Hosts (CHAOS-144): derselbe Code-Pfad wie im Browser-Host (das Minispiel baut
 * kein eigenes Licht und keinen Boden bis zum Horizont), aber ohne Kulisse. `material` liefert ein
 * StandardMaterial mit Farbe, Leuchten und Deckkraft und merkt sich die Oberfläche;
 * `backdrop` merkt sich nur die Spielfläche.
 */
function nativeLook(scene: Scene, onBackdrop: (area: LookArea) => void): MinigameLook {
  return {
    material(hex: string, options: LookMaterialOptions = {}) {
      const material = new StandardMaterial(`look-${hex}`, scene);
      material.diffuseColor = Color3.FromHexString(hex);
      // Wie `plainOptions` im Browser-Look: Leuchten zur Hälfte.
      if (options.emissive)
        material.emissiveColor = material.diffuseColor.scale(options.emissive * 0.5);
      if (options.alpha !== undefined) material.alpha = options.alpha;
      material.metadata = { finish: options.finish ?? 'lack' };
      return material;
    },
    backdrop: onBackdrop,
  };
}

export function createHeadlessStage(options: HeadlessStageOptions): HeadlessStage {
  Logger.LogLevels = Logger.WarningLogLevel | Logger.ErrorLogLevel;
  const engine = new NullEngine();
  const scene = new Scene(engine);
  const now = options.now ?? (() => 0);
  const flags = {
    startRequested: false,
    paused: false,
    disposed: false,
    ready: false,
    celebrated: false,
    /** `endPlay` vor dem Start: Das Spiel startet nicht mehr. */
    ended: false,
  };
  const figures = new Map<Slot, FigureEntry>();
  let backdrop: MinigameBackdrop | null = null;
  const effects: MinigameEffect[] = [];
  let effectSeq = 0;
  /** Effekt-Zeitpunkte (Kern-Uhr), parallel zu `effects`. */
  const effectTimes: number[] = [];
  const pushEffect = (effect: Omit<MinigameEffect, 'seq'>) => {
    effects.push({ ...effect, seq: ++effectSeq });
    effectTimes.push(now());
    if (effects.length > MAX_EFFECTS) {
      effects.shift();
      effectTimes.shift();
    }
  };
  /** Effekte als Ereignisse für Swift, Klänge über `onSound` (CHAOS-190). */
  const fx: MinigameFx = {
    sound(id, playOptions) {
      if (!flags.disposed) options.onSound?.(id, playOptions);
    },
    burst(id, at, color) {
      pushEffect({
        kind: id,
        pos: [r(at.x), r(at.y), r(at.z)],
        color: color && /^#[0-9a-fA-F]{6}$/.test(color) ? color : null,
        strength: 1,
      });
    },
    shake(strength) {
      pushEffect({ kind: 'shake', pos: [0, 0, 0], color: null, strength: r(strength) });
    },
  };
  const startNow = () => {
    if (flags.ready && !flags.ended && runner.state === 'ready') runner.start();
  };
  const runner = createMinigameRunner(options.module, {
    scene,
    players: options.players,
    ...(options.bots && options.bots.length > 0 ? { bots: options.bots } : {}),
    seed: options.seed,
    ...(options.teams ? { teams: options.teams } : {}),
    timeLimitMs: options.timeLimitMs,
    fx,
    characters: capsuleCharacters(figures),
    havok: options.havok,
    look: nativeLook(scene, (area) => {
      backdrop = {
        halfX: area.halfX,
        halfZ: area.halfZ,
        groundY: area.groundY ?? 0,
        surface: area.surface ?? 'wiese',
      };
    }),
    onResult: options.onResult,
    ...(options.onCue ? { onCue: options.onCue } : {}),
    ...(options.onSecret ? { onSecret: options.onSecret } : {}),
    ...(options.pacing ? { pacing: options.pacing } : {}),
  });
  /** Lage je Mesh, gültig solange sich die Weltmatrix nicht ändert (`updateFlag`). */
  const placed = new Map<number, { flag: number; body: Body }>();
  /** Grundform je Mesh; die Eckpunkte zu prüfen kostet, darum einmal und im Aufbau. */
  const shapes = new Map<number, BodyShape>();
  const shapeOf = (mesh: AbstractMesh): BodyShape => {
    let shape = shapes.get(mesh.uniqueId);
    if (shape === undefined) {
      shape = classify(mesh);
      shapes.set(mesh.uniqueId, shape);
    }
    return shape;
  };
  /** Rolle je Mesh (`markVisual` am Wurzelknoten, CHAOS-149); `null` = Kulisse. */
  const tags = new Map<number, VisualTag | null>();
  const tagOf = (mesh: AbstractMesh): VisualTag | null => {
    let tag = tags.get(mesh.uniqueId);
    if (tag === undefined) {
      tag = visualOf(mesh) ?? null;
      tags.set(mesh.uniqueId, tag);
    }
    return tag;
  };

  // --- Geometrie-Katalog (CHAOS-144) ----------------------------------------------------------
  /** Mesh → Geometrie-ID (`null`: ohne Dreiecke). */
  const meshGeometry = new Map<number, string | null>();
  /** Babylon-Geometrie → ID: Instanzen und geteilte Geometrie ohne erneutes Lesen. */
  const sharedGeometry = new Map<number, string>();
  /** Inhalt → ID: gleich gebaute Meshes teilen sich eine Geometrie. */
  const contentGeometry = new Map<string, string>();
  const pendingGeometry: PendingGeometry[] = [];
  /** Meshes, die erst im Spiel auftauchen; `takeGeometry` liest sie im Zeitbudget. */
  const lateMeshes = new Set<AbstractMesh>();
  let geometryTotal = 0;
  const geometryOf = (mesh: AbstractMesh): string | null => {
    const known = meshGeometry.get(mesh.uniqueId);
    if (known !== undefined) return known;
    const source = (mesh as { sourceMesh?: AbstractMesh }).sourceMesh ?? mesh;
    const shared = (source as { geometry?: { uniqueId: number } | null }).geometry?.uniqueId;
    let id = shared === undefined ? undefined : sharedGeometry.get(shared);
    if (id === undefined) {
      const data = readMeshData(mesh);
      if (data) {
        const key = geometryKey(data);
        id = contentGeometry.get(key);
        if (id === undefined) {
          ++geometryTotal;
          id = `g${String(++geometrySerial)}`;
          contentGeometry.set(key, id);
          pendingGeometry.push(preparePending(id, data));
        }
        if (shared !== undefined) sharedGeometry.set(shared, id);
      }
    }
    meshGeometry.set(mesh.uniqueId, id ?? null);
    return id ?? null;
  };

  /** Nach `prepare` Formen und Geometrie aller Meshes vorab bestimmen, ebenfalls verteilt. */
  const classifyAll = async () => {
    const pacing = options.pacing;
    let sliceStartedAt = pacing?.now() ?? 0;
    const disposed = () => flags.disposed;
    for (const mesh of [...scene.meshes]) {
      if (pacing && pacing.now() - sliceStartedAt >= pacing.budgetMs) {
        await pacing.nextFrame();
        sliceStartedAt = pacing.now();
      }
      if (disposed()) return;
      if (mesh.isDisposed() || mesh.getTotalVertices() === 0) continue;
      shapeOf(mesh);
      if (tagOf(mesh)?.role !== 'figur') geometryOf(mesh);
    }
  };

  /** Künstlich später Aufbau (`readyNotBefore`): Bilder abwarten. */
  const holdBack = async () => {
    const until = options.readyNotBefore;
    const pacing = options.pacing;
    if (until === undefined || !pacing) return;
    while (now() < until && !flags.disposed) await pacing.nextFrame();
  };

  // JSContext verschluckt abgelehnte Promises: Fehler ausdrücklich melden.
  runner
    .prepare()
    .then(classifyAll)
    .then(holdBack)
    .then(
      () => {
        if (flags.disposed) return;
        // Neue Render-ID, bevor `bodies()` zum ersten Mal liefert (CHAOS-154): Meshes, deren
        // Weltmatrix beim Anlegen in derselben Render-ID gerechnet wurde, stünden sonst im
        // ersten Bild im Ursprung und ohne Skalierung (Babylon rechnet je ID nur einmal).
        scene.incrementRenderId();
        flags.ready = true;
        if (flags.startRequested) startNow();
      },
      (error: unknown) => {
        // Bühne während des Aufbaus entsorgt (Phasenwechsel, Lobby): gewollt, kein Fehler.
        if (error instanceof PrepareAborted) return;
        options.log(
          `Minispiel ${options.module.info.id}: prepare fehlgeschlagen: ${describe(error)}`,
        );
      },
    );

  return {
    runner,
    scene,
    get ready() {
      return flags.ready;
    },
    get backdrop() {
      return backdrop;
    },
    get geometryTotal() {
      return geometryTotal;
    },
    start() {
      flags.startRequested = true;
      startNow();
    },
    endPlay() {
      if (runner.state === 'running') {
        runner.finishNow();
        return true;
      }
      if (flags.ended || runner.state === 'finished' || runner.state === 'disposed') return false;
      flags.ended = true;
      return true;
    },
    setPaused(paused) {
      if (paused === flags.paused) return;
      flags.paused = paused;
      if (paused) runner.pause();
      else runner.resume();
    },
    advance(seconds) {
      runner.advance(seconds);
      // Wie ein gerendertes Bild im Browser-Host: neue Render-ID nach den Schritten, sonst liefert
      // `computeWorldMatrix()` die Matrix aus dem ersten Aufruf (je Render-ID höchstens einmal).
      scene.incrementRenderId();
    },
    bodies() {
      // Halb gebaute Szene nicht zeigen: Swift sähe sonst Körper nach und nach auftauchen.
      if (!flags.ready || flags.disposed) return [];
      const out: Body[] = [];
      for (const mesh of scene.meshes) {
        if (!mesh.isEnabled() || !mesh.isVisible || mesh.visibility === 0) continue;
        if (mesh.getTotalVertices() === 0) continue;
        const tag = tagOf(mesh);
        // Figuren zeichnet Swift als USDZ (`figures()`).
        if (tag?.role === 'figur') continue;
        // Ohne `force`: neu gerechnet wird nur, was sich bewegt hat (force kostet ~60 µs je Mesh).
        const flag = mesh.computeWorldMatrix().updateFlag;
        let entry = placed.get(mesh.uniqueId);
        if (entry?.flag !== flag) {
          entry = { flag, body: place(mesh, entry?.body.shape ?? shapeOf(mesh)) };
          if (tag) {
            entry.body.role = tag.role;
            if (tag.key !== undefined) entry.body.key = tag.key;
          }
          placed.set(mesh.uniqueId, entry);
        }
        // Geometrie: im Aufbau bestimmt; Meshes aus dem Spiel (neue Socken) liest `takeGeometry`
        // mit Zeitbudget nach, bis dahin zeichnet Swift die Grundform.
        const geometry = meshGeometry.get(mesh.uniqueId);
        if (geometry === undefined) lateMeshes.add(mesh);
        // Farbe und Material immer frisch: Minispiele färben Meshes um, ohne sie zu bewegen.
        out.push({
          ...entry.body,
          ...(geometry ? { mesh: geometry } : {}),
          color: colorOf(mesh),
          ...surfaceOf(mesh),
        });
      }
      return out;
    },
    figures() {
      if (!flags.ready || flags.disposed) return [];
      const out: MinigameFigure[] = [];
      for (const [slot, entry] of [...figures].sort((a, b) => a[0] - b[0])) {
        if (entry.disposed) continue;
        entry.root.computeWorldMatrix().decompose(scratchScale, scratchRotation, scratchPosition);
        const body = entry.body;
        out.push({
          slot,
          character: entry.player.character,
          pos: [r(scratchPosition.x), r(scratchPosition.y), r(scratchPosition.z)],
          rot: [
            r(scratchRotation.x),
            r(scratchRotation.y),
            r(scratchRotation.z),
            r(scratchRotation.w),
          ],
          scale: [r(scratchScale.x), r(scratchScale.y), r(scratchScale.z)],
          visible:
            entry.root.isEnabled() && body.isEnabled() && body.isVisible && body.visibility > 0,
          anim: entry.anim,
          animSeq: entry.seq,
        });
      }
      return out;
    },
    camera() {
      const camera = scene.activeCamera;
      if (!camera || flags.disposed) return null;
      // Arc-Rotate-Kameras rechnen ihre Lage erst beim Bild; ohne Rendern hier von Hand.
      camera.getViewMatrix(true);
      const position = camera.globalPosition;
      const aim = (camera as unknown as Partial<{ getTarget(): Vector3 }>).getTarget;
      const target =
        typeof aim === 'function'
          ? aim.call(camera)
          : position.add(camera.getDirection(Vector3.Forward()));
      return {
        pos: [r(position.x), r(position.y), r(position.z)],
        target: [r(target.x), r(target.y), r(target.z)],
        fov: r(camera.fov),
        // Babylon: FOVMODE_VERTICAL_FIXED = 0, FOVMODE_HORIZONTAL_FIXED = 1.
        fovAxis: camera.fovMode === 1 ? 'horizontal' : 'vertical',
      };
    },
    effects(sinceMs) {
      const out: MinigameEffect[] = [];
      effects.forEach((effect, index) => {
        if ((effectTimes[index] ?? 0) >= sinceMs) out.push(effect);
      });
      return out;
    },
    takeGeometry(maxChars, budgetMs) {
      const out: MinigameGeometry[] = [];
      const clock = options.pacing?.now;
      const started = clock?.() ?? 0;
      const spent = () => (clock ? clock() - started : 0);
      let chars = 0;
      let steps = 0;
      for (const mesh of lateMeshes) {
        if (steps > 0 && budgetMs !== undefined && spent() >= budgetMs) break;
        lateMeshes.delete(mesh);
        if (!mesh.isDisposed()) geometryOf(mesh);
        steps++;
      }
      steps = 0;
      while (pendingGeometry.length > 0) {
        const next = pendingGeometry[0];
        if (!next) break;
        if (out.length > 0 && chars + next.chars > maxChars) break;
        // Base64 in Schritten: mindestens einer je Aufruf, sonst bis das Zeitbudget verbraucht ist.
        let done = false;
        while (!done && (steps === 0 || budgetMs === undefined || spent() < budgetMs)) {
          done = encodeStep(next);
          steps++;
        }
        if (!done) break;
        out.push(finishGeometry(next));
        pendingGeometry.shift();
        chars += next.chars;
      }
      return out;
    },
    celebrate(placements) {
      if (flags.celebrated || flags.disposed || !flags.ready) return;
      flags.celebrated = true;
      // Wie `stage.celebrate` im Browser-Host: Jubel-Klang, dann Figuren und Konfetti.
      fx.sound('cheer');
      for (const entry of placements) {
        const figure = figures.get(entry.slot);
        if (!figure || figure.disposed) continue;
        figure.anim = entry.place === 1 ? 'cheer' : 'sad';
        figure.seq++;
        if (entry.place === 1) {
          const at = figure.root.getAbsolutePosition();
          fx.burst('confetti', { x: at.x, y: at.y + 1.6, z: at.z });
        }
      }
    },
    dispose() {
      if (flags.disposed) return;
      flags.disposed = true;
      try {
        runner.dispose();
      } finally {
        scene.dispose();
        engine.dispose();
      }
    },
  };
}

const scratchScale = new Vector3();
const scratchRotation = new Quaternion();
const scratchPosition = new Vector3();
/** Geometrie-IDs über alle Bühnen fortlaufend: Eine neue Bühne (Revanche) verwechselt nie alte Meshes. */
let geometrySerial = 0;

/** Material-Angaben für Swift; nur was vom Standard abweicht. */
function surfaceOf(mesh: AbstractMesh): Pick<Body, 'alpha' | 'glow' | 'finish' | 'twoSided'> {
  const material = mesh.material as {
    alpha?: number;
    emissiveColor?: Color3;
    backFaceCulling?: boolean;
    metadata?: { finish?: MaterialFinish } | null;
  } | null;
  const out: Pick<Body, 'alpha' | 'glow' | 'finish' | 'twoSided'> = {};
  const alpha = (material?.alpha ?? 1) * mesh.visibility;
  if (alpha < 0.999) out.alpha = Math.max(0, r(alpha));
  const glow = material?.emissiveColor;
  if (glow && glow.r + glow.g + glow.b > 0.004) out.glow = glow.toHexString();
  const finish = material?.metadata?.finish;
  if (finish && finish !== 'lack') out.finish = finish;
  if (material?.backFaceCulling === false) out.twoSided = true;
  return out;
}

function place(mesh: AbstractMesh, shape: BodyShape): Body {
  const box = mesh.getBoundingInfo().boundingBox;
  mesh.getWorldMatrix().decompose(scratchScale, scratchRotation);
  const extent = box.extendSize;
  return {
    id: `${mesh.name}#${mesh.uniqueId}`,
    shape,
    pos: [r(box.centerWorld.x), r(box.centerWorld.y), r(box.centerWorld.z)],
    rot: [r(scratchRotation.x), r(scratchRotation.y), r(scratchRotation.z), r(scratchRotation.w)],
    size: [
      r(2 * extent.x * Math.abs(scratchScale.x)),
      r(2 * extent.y * Math.abs(scratchScale.y)),
      r(2 * extent.z * Math.abs(scratchScale.z)),
    ],
    color: colorOf(mesh),
  };
}

function r(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function colorOf(mesh: AbstractMesh): string {
  const material = mesh.material as { diffuseColor?: Color3; albedoColor?: Color3 } | null;
  const color = material?.diffuseColor ?? material?.albedoColor;
  return color ? color.toHexString() : '#CCCCCC';
}

/**
 * Form aus den Eckpunkten (lokal, auf die Bounding-Box normiert): alle auf der Einheitskugel →
 * Kugel; alle innerhalb des Einheitskreises in x/z und viele auf dem Rand → Zylinder (auch
 * Scheibe, Kapsel, Torus); sonst Quader. Babylon-Meshes tragen ihre Grundform nicht mit.
 */
function classify(mesh: AbstractMesh): BodyShape {
  const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
  if (!positions || positions.length < 3) return 'box';
  const { minimum, maximum } = mesh.getBoundingInfo().boundingBox;
  const half = (min: number, max: number) => (max - min) / 2 || 1;
  const hx = half(minimum.x, maximum.x);
  const hy = half(minimum.y, maximum.y);
  const hz = half(minimum.z, maximum.z);
  const eps = 0.08;
  const count = positions.length / 3;
  const stride = Math.max(1, Math.floor(count / 256));
  let sphere = true;
  let insideCircle = true;
  let onRim = 0;
  let sampled = 0;
  for (let i = 0; i < count; i += stride) {
    const x = ((positions[i * 3] ?? 0) - (minimum.x + maximum.x) / 2) / hx;
    const y = ((positions[i * 3 + 1] ?? 0) - (minimum.y + maximum.y) / 2) / hy;
    const z = ((positions[i * 3 + 2] ?? 0) - (minimum.z + maximum.z) / 2) / hz;
    const r2 = Math.hypot(x, z);
    if (Math.abs(Math.hypot(x, y, z) - 1) > eps) sphere = false;
    if (r2 > 1 + eps) insideCircle = false;
    if (Math.abs(r2 - 1) <= eps) onRim++;
    sampled++;
  }
  if (sphere) return 'sphere';
  return insideCircle && onRim >= sampled / 4 ? 'cylinder' : 'box';
}

export function describe(error: unknown): string {
  return error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error);
}
