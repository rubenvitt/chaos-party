/**
 * Headless-Testharness für Minispiele (Node, Vitest): NullEngine-Szene, Havok aus der
 * WASM-Datei, aufzeichnende Effekte, einfache Testfiguren und eine Restprüfung der Szene
 * nach `dispose()`. Deterministisch: feste Schritte, Seed, Eingaben per Skript.
 */
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { CreateCapsule } from '@babylonjs/core/Meshes/Builders/capsuleBuilder.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { Logger } from '@babylonjs/core/Misc/logger.js';
import type { PhysicsEngine } from '@babylonjs/core/Physics/v2/physicsEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import HavokPhysics from '@babylonjs/havok';
import { CHARACTER_IDS, defaultCharacterFor, type MinigameInput, type Slot } from '../info.ts';
import type {
  CharacterAnimation,
  CharacterFactory,
  CharacterHandle,
  MinigameFx,
  MinigameModule,
  MinigamePlayer,
  SoundId,
  VfxId,
} from '../babylon/contract.ts';
import type { MinigameTeams } from '../teams.ts';
import { FIXED_STEP_SECONDS } from '../babylon/contract.ts';
import {
  createMinigameRunner,
  type HavokInstance,
  type MinigameRunner,
  type RunnerResult,
} from '../babylon/runner.ts';

// Gleich wie `PLAYER_SLOTS` in `@chaos-party/protocol` (Okabe-Ito); hier dupliziert, damit das
// SDK ohne Protokoll-Paket auskommt.
const SLOT_COLORS: Record<Slot, string> = {
  1: '#0072B2',
  2: '#E69F00',
  3: '#009E73',
  4: '#CC79A7',
};
const SLOT_NAMES: Record<Slot, string> = { 1: 'Blau', 2: 'Orange', 3: 'Grün', 4: 'Rosa' };
const SLOT_SYMBOLS: Record<Slot, string> = { 1: '●', 2: '▲', 3: '■', 4: '★' };

/** Testspieler für die ersten `count` Slots. */
export function testPlayers(count: number): MinigamePlayer[] {
  return ([1, 2, 3, 4] as const).slice(0, count).map((slot) => ({
    slot,
    name: SLOT_NAMES[slot],
    color: SLOT_COLORS[slot],
    symbol: SLOT_SYMBOLS[slot],
    character: defaultCharacterFor(slot),
  }));
}

let havokPromise: Promise<HavokInstance> | undefined;

/** Havok in Node laden (WASM aus dem Paket, ohne `fetch`). Einmal je Prozess. */
export function loadHavokForNode(): Promise<HavokInstance> {
  havokPromise ??= (async () => {
    const require = createRequire(import.meta.url);
    const umdEntry = require.resolve('@babylonjs/havok');
    const wasmPath = join(dirname(umdEntry), '..', 'esm', 'HavokPhysics.wasm');
    const wasmBinary = await readFile(wasmPath);
    const buffer = wasmBinary.buffer.slice(
      wasmBinary.byteOffset,
      wasmBinary.byteOffset + wasmBinary.byteLength,
    );
    return HavokPhysics({ wasmBinary: buffer });
  })();
  return havokPromise;
}

export interface HeadlessScene {
  readonly engine: NullEngine;
  readonly scene: Scene;
  dispose(): void;
}

export function createHeadlessScene(): HeadlessScene {
  Logger.LogLevels = Logger.WarningLogLevel | Logger.ErrorLogLevel;
  const engine = new NullEngine();
  const scene = new Scene(engine);
  return {
    engine,
    scene,
    dispose: () => {
      scene.dispose();
      engine.dispose();
    },
  };
}

export interface FxRecord {
  readonly sounds: SoundId[];
  readonly bursts: { id: VfxId; at: { x: number; y: number; z: number }; color?: string }[];
  readonly shakes: number[];
}

/** Effekte ohne Wirkung, die mitschreiben, was ein Minispiel abspielen wollte. */
export function createRecordingFx(): MinigameFx & { readonly record: FxRecord } {
  const record: FxRecord = { sounds: [], bursts: [], shakes: [] };
  return {
    record,
    sound: (id) => {
      record.sounds.push(id);
    },
    burst: (id, at, color) => {
      record.bursts.push({ id, at: { x: at.x, y: at.y, z: at.z }, ...(color ? { color } : {}) });
    },
    shake: (strength) => {
      record.shakes.push(strength);
    },
  };
}

/**
 * Einfache Testfiguren (Kapsel in Slot-Farbe, 1,6 hoch, Füße bei y = 0). Hält den
 * Figuren-Vertrag ein und schreibt gespielte Animationen mit.
 */
export function createTestCharacters(): CharacterFactory & {
  readonly animations: Map<Slot, CharacterAnimation[]>;
} {
  const animations = new Map<Slot, CharacterAnimation[]>();
  return {
    animations,
    create(scene: Scene, player: MinigamePlayer): CharacterHandle {
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
      const played: CharacterAnimation[] = [];
      animations.set(player.slot, played);
      let disposed = false;
      return {
        root,
        id: CHARACTER_IDS.includes(player.character) ? player.character : 'robot',
        play: (animation) => {
          played.push(animation);
        },
        dispose: () => {
          if (disposed) return;
          disposed = true;
          material.dispose();
          body.dispose();
          root.dispose();
        },
      };
    },
  };
}

/** Was nach `dispose()` eines Minispiels noch in der Szene hängt (alles sollte 0 sein). */
export interface SceneResidue {
  readonly meshes: number;
  readonly transformNodes: number;
  readonly materials: number;
  readonly textures: number;
  readonly lights: number;
  readonly cameras: number;
  readonly particleSystems: number;
  readonly animationGroups: number;
  readonly skeletons: number;
  readonly beforeRenderObservers: number;
  readonly afterRenderObservers: number;
  readonly physicsBodies: number;
}

export function sceneResidue(scene: Scene): SceneResidue {
  const physicsEngine = scene.getPhysicsEngine();
  // v2-Physik (Havok); die v1-Schnittstelle kennt keine Körperliste.
  const bodies = (physicsEngine as PhysicsEngine | null)?.getBodies().length ?? 0;
  return {
    meshes: scene.meshes.length,
    transformNodes: scene.transformNodes.length,
    // Die Szene legt selbst ein Standardmaterial an, sobald jemand eines braucht.
    materials: scene.materials.filter((material) => material !== scene.defaultMaterial).length,
    textures: scene.textures.length,
    lights: scene.lights.length,
    cameras: scene.cameras.length,
    particleSystems: scene.particleSystems.length,
    animationGroups: scene.animationGroups.length,
    skeletons: scene.skeletons.length,
    beforeRenderObservers: scene.onBeforeRenderObservable.observers.length,
    afterRenderObservers: scene.onAfterRenderObservable.observers.length,
    physicsBodies: bodies,
  };
}

export const EMPTY_RESIDUE: SceneResidue = {
  meshes: 0,
  transformNodes: 0,
  materials: 0,
  textures: 0,
  lights: 0,
  cameras: 0,
  particleSystems: 0,
  animationGroups: 0,
  skeletons: 0,
  beforeRenderObservers: 0,
  afterRenderObservers: 0,
  physicsBodies: 0,
};

/** Eingaben eines Testlaufs: wird vor jedem festen Schritt mit der Spielzeit aufgerufen. */
export type InputScript = (
  elapsedMs: number,
  send: (slot: Slot, input: MinigameInput) => void,
  runner: MinigameRunner,
) => void;

export interface HeadlessRunOptions {
  readonly players?: number | readonly MinigamePlayer[];
  readonly seed?: number;
  readonly timeLimitMs?: number;
  /** Aufstellung bei Teams bzw. Koop (CHAOS-89). */
  readonly teams?: MinigameTeams;
  readonly script?: InputScript;
  /** Abbruch, falls kein Ergebnis kommt (Standard: Zeitlimit + 5 s). */
  readonly maxMs?: number;
  /** Szene nach dem Lauf **nicht** entsorgen (für eigene Prüfungen); dann selbst `dispose`. */
  readonly keepScene?: boolean;
}

export interface HeadlessRun {
  readonly outcome: RunnerResult | null;
  readonly runner: MinigameRunner;
  readonly fx: FxRecord;
  readonly animations: Map<Slot, CharacterAnimation[]>;
  /** Szenen-Rest direkt nach `runner.dispose()` (vor dem Entsorgen der Szene). */
  readonly residue: SceneResidue;
  readonly headless: HeadlessScene;
}

/**
 * Ein Minispiel komplett headless durchspielen: prepare → start → feste Schritte mit
 * Skript-Eingaben bis zum Ergebnis → dispose → Restprüfung.
 */
export async function runMinigameHeadless(
  module: MinigameModule,
  options: HeadlessRunOptions = {},
): Promise<HeadlessRun> {
  const players =
    typeof options.players === 'object' ? options.players : testPlayers(options.players ?? 4);
  const headless = createHeadlessScene();
  const fx = createRecordingFx();
  const characters = createTestCharacters();
  const havok = module.info.physics ? await loadHavokForNode() : null;
  const runner = createMinigameRunner(module, {
    scene: headless.scene,
    players,
    seed: options.seed ?? 1,
    ...(options.timeLimitMs === undefined ? {} : { timeLimitMs: options.timeLimitMs }),
    fx,
    characters,
    havok,
    testMode: true,
    ...(options.teams ? { teams: options.teams } : {}),
  });
  await runner.prepare();
  runner.start();
  const limit = options.maxMs ?? (options.timeLimitMs ?? module.info.durationMs) + 5_000;
  const send = (slot: Slot, input: MinigameInput) => {
    runner.input(slot, input);
  };
  while (runner.state === 'running' && runner.elapsedMs <= limit) {
    options.script?.(runner.elapsedMs, send, runner);
    runner.step(1);
  }
  const outcome = runner.result;
  runner.dispose();
  const residue = sceneResidue(headless.scene);
  if (!options.keepScene) headless.dispose();
  await flushBabylonTimers();
  return { outcome, runner, fx: fx.record, animations: characters.animations, residue, headless };
}

/**
 * Babylon verschiebt Arbeit per `setTimeout`: `Scene.addMesh`/`addMaterial`/`addCamera` …
 * melden sich über `TimingTools.SetImmediate` (eine modulweite Warteschlange, geleert von einem
 * 1-ms-Zeitgeber), `Observable.remove` trägt Beobachter per `setTimeout(0)` aus. Bis der
 * Zeitgeber feuert, hält die Warteschlange jedes Mesh, jedes Material und damit die ganze
 * entsorgte Szene fest. Eine Schleife, die nur Promises abwartet (Mikrotasks), lässt den
 * Zeitgeber nie laufen; dann wächst der Heap je Lauf um MB (CHAOS-126). Im Host leert der
 * Render-Takt die Warteschlange von selbst, im Apple-Host `tick(nowMs)` über die virtuelle Uhr.
 *
 * Zwei Makrotask-Runden: Node führt Zeitgeber gleicher Dauer in Anlegereihenfolge aus (0 ms
 * zählt als 1 ms), und die verschobenen Rückrufe dürfen selbst noch einmal verschieben.
 */
export async function flushBabylonTimers(rounds = 2): Promise<void> {
  for (let i = 0; i < rounds; i++) await sleep(1);
}

/** Sekunden in feste Schritte (für Skripte, die „nach 2 s“ handeln). */
export function stepsFor(seconds: number): number {
  return Math.round(seconds / FIXED_STEP_SECONDS);
}
