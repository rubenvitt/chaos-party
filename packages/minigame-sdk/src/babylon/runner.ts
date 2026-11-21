/**
 * Laufzeit eines Minispiels (CHAOS-26, ADR-012): erzwingt den Lebenszyklus, den festen Takt,
 * die Eingaberegeln und die Ergebnisprüfung. Der Host benutzt sie mit echter Szene und
 * Render-Schleife, Tests mit NullEngine (`@chaos-party/minigame-sdk/testing`).
 *
 * Die Laufzeit rendert nicht; sie rechnet nur Logik und Physik. Wer rendert, ruft
 * `advance(seconds)` vor `scene.render()` auf. Die Physik läuft **nicht** im Render-Schritt
 * (`scene.physicsEnabled = false`), sondern hier im festen Takt nach jedem `update`.
 */
import { HavokPlugin } from '@babylonjs/core/Physics/v2/Plugins/havokPlugin.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import '@babylonjs/core/Physics/joinedPhysicsEngineComponent.js';
import type { Scene } from '@babylonjs/core/scene.js';
import type HavokPhysics from '@babylonjs/havok';
import type { MinigameInput, MinigameResult, Slot } from '../info.ts';
import { checkResult, rankByScore } from '../result.ts';
import { createMinigameRng } from '../rng.ts';
import { teamPlacements, type MinigameTeams } from '../teams.ts';
import { markVisual } from './visual.ts';
import {
  FIXED_STEP_SECONDS,
  type CharacterFactory,
  type Minigame,
  type MinigameFx,
  type MinigameHud,
  type MinigameLook,
  type MinigameModule,
  type MinigamePlayer,
} from './contract.ts';

export type HavokInstance = Awaited<ReturnType<typeof HavokPhysics>>;

/**
 * Höchstens so viele feste Schritte je `advance` (250 ms Aufholen): Bis etwa 4 Bilder/s bleibt
 * das Minispiel in Echtzeit (die Server-Frist hängt daran), längere Hänger werden verworfen.
 */
export const MAX_STEPS_PER_ADVANCE = 15;
/** So lange über das Zeitlimit hinaus wartet die Laufzeit, dann wertet sie selbst (HUD). */
export const OVERTIME_GRACE_MS = 1_000;
/** Schwerkraft für Physik-Minispiele. */
export const GRAVITY = new Vector3(0, -9.81, 0);

export type RunnerState = 'created' | 'preparing' | 'ready' | 'running' | 'finished' | 'disposed';

export interface RunnerOptions {
  readonly scene: Scene;
  readonly players: readonly MinigamePlayer[];
  readonly seed: number;
  /** Fehlt = `info.durationMs`. */
  readonly timeLimitMs?: number;
  readonly fx: MinigameFx;
  readonly characters: CharacterFactory;
  /** Pflicht, wenn `info.physics`. */
  readonly havok?: HavokInstance | null;
  readonly testMode?: boolean;
  /** Look des Hosts (CHAOS-62); fehlt in Tests. */
  readonly look?: MinigameLook;
  /**
   * Aufstellung vom Server bei Teams bzw. Koop (CHAOS-89); fehlt = jeder gegen jeden. Geht
   * unverändert an das Minispiel (`MinigameContext.teams`) und in die Prüfung des Ergebnisses.
   */
  readonly teams?: MinigameTeams | null;
  /**
   * Höchstzahl fester Schritte je `advance` (Standard `MAX_STEPS_PER_ADVANCE`). Der Host hebt
   * sie bei Software-Rendering an (Bilder dauern dort ≥ 0,25 s), damit die Spielzeit mit der
   * echten Zeit Schritt hält und das Ergebnis rechtzeitig beim Server ist.
   */
  readonly maxStepsPerAdvance?: number;
  /** Einmal, sobald ein gültiges Ergebnis feststeht. */
  readonly onResult?: (result: RunnerResult) => void;
  /**
   * Taktgeber für einen verteilten Aufbau (CHAOS-141). Fehlt er, rechnet `prepare` am Stück
   * (`ctx.pace()` löst sofort auf; Tests bleiben deterministisch und schnell).
   */
  readonly pacing?: PrepareThrottle;
}

/** Aufbau über mehrere Bilder verteilen (`MinigameContext.pace`, CHAOS-141). */
export interface PrepareThrottle {
  /** Löst im nächsten Bild auf (Host: nächster `tick` bzw. nächstes Render-Bild). */
  readonly nextFrame: () => Promise<void>;
  /** Echte Uhr in ms (nicht die Spieluhr): misst, wie lange ein Bild schon rechnet. */
  readonly now: () => number;
  /** So viele ms darf der Aufbau je Bild rechnen, dann gibt `pace()` ab. */
  readonly budgetMs: number;
}

/** `prepare` wurde abgebrochen, weil die Laufzeit inzwischen entsorgt ist (kein Fehler). */
export class PrepareAborted extends Error {
  constructor() {
    super('Minispiel-Aufbau abgebrochen: Laufzeit entsorgt');
    this.name = 'PrepareAborted';
  }
}

export interface RunnerResult {
  readonly result: MinigameResult;
  /** `true`, wenn das Minispiel kein (gültiges) Ergebnis lieferte und die Laufzeit aus dem HUD werten musste. */
  readonly forced: boolean;
  /**
   * `true`, wenn der Host das Spiel mit `finishNow` vorzeitig beendet hat (Frist des Servers für
   * das Ergebnis naht, CHAOS-206); dann ist auch `forced` gesetzt, sofern das Minispiel selbst
   * noch kein Ergebnis hatte.
   */
  readonly cut: boolean;
  /** Gerechnete Spielzeit bis zum Ergebnis (ms). */
  readonly elapsedMs: number;
}

export interface MinigameRunner {
  readonly state: RunnerState;
  readonly elapsedMs: number;
  readonly result: RunnerResult | null;
  readonly paused: boolean;
  prepare(): Promise<void>;
  start(): void;
  /**
   * Spiel sofort beenden (CHAOS-206): Hat das Minispiel schon ein gültiges Ergebnis, gilt es;
   * sonst wertet die Laufzeit den Stand aus dem HUD wie bei Zeitüberschreitung. Nur in
   * `running`, sonst wirkungslos.
   */
  finishNow(): void;
  /** Eingabe eines Slots; außerhalb von `running` oder für Fremde still ignoriert. */
  input(slot: Slot, input: MinigameInput): void;
  /** Verbindungsstatus; bei Trennung neutrale Eingaben (Stick 0/0, Knöpfe los). */
  setConnected(slot: Slot, connected: boolean): void;
  /** Echte Zeit vergeht (Sekunden); rechnet 0…`MAX_STEPS_PER_ADVANCE` feste Schritte. */
  advance(seconds: number): number;
  /** Genau `steps` feste Schritte (Tests, deterministisch). */
  step(steps?: number): void;
  /**
   * Hält das Minispiel an (Partie-Pause, ADR-015): `advance` rechnet keine Schritte, `input`
   * wird ignoriert, gehaltene Eingaben werden neutralisiert. `elapsedMs` bleibt stehen.
   */
  pause(): void;
  /** Setzt fort, ohne die Pausenzeit nachzuholen. */
  resume(): void;
  hud(): MinigameHud;
  dispose(): void;
}

export function createMinigameRunner(
  module: MinigameModule,
  options: RunnerOptions,
): MinigameRunner {
  const { info } = module;
  const { scene, players } = options;
  const slots = players.map((player) => player.slot);
  const timeLimitMs = Math.max(1_000, Math.round(options.timeLimitMs ?? info.durationMs));
  const game: Minigame = module.create();
  const held = new Map<Slot, Set<'a' | 'b'>>();
  const stickActive = new Set<Slot>();
  const disconnected = new Set<Slot>();

  let state: RunnerState = 'created';
  let paused = false;
  let accumulator = 0;
  const maxSteps = Math.max(1, Math.floor(options.maxStepsPerAdvance ?? MAX_STEPS_PER_ADVANCE));
  let steps = 0;
  let result: RunnerResult | null = null;
  let physicsStep: ((seconds: number) => void) | null = null;
  const pacing = options.pacing;
  let sliceStartedAt = pacing ? pacing.now() : 0;

  /** `MinigameContext.pace`: abgeben, wenn das Budget des Bildes verbraucht ist. */
  const abortIfDisposed = () => {
    if (state === 'disposed') throw new PrepareAborted();
  };
  const pace = async (): Promise<void> => {
    abortIfDisposed();
    if (!pacing || pacing.now() - sliceStartedAt < pacing.budgetMs) return;
    await pacing.nextFrame();
    sliceStartedAt = pacing.now();
    abortIfDisposed();
  };

  const elapsedMs = () => Math.round(steps * FIXED_STEP_SECONDS * 1000);

  /** `cut`: von außen beendet (`finishNow`), dann wertet die Laufzeit auch ohne Überzeit. */
  const settle = (candidate: MinigameResult | null, cut = false): void => {
    if (result) return;
    const overtime = elapsedMs() > timeLimitMs + OVERTIME_GRACE_MS;
    if (candidate) {
      const check = checkResult(candidate, {
        minigameId: info.id,
        slots,
        scoring: info.scoring,
        teams: options.teams ?? null,
      });
      if (check.ok) {
        finish({ result: candidate, forced: false, cut, elapsedMs: elapsedMs() });
        return;
      }
      console.error(`Minispiel ${info.id}: ungültiges Ergebnis (${check.reason}), werte selbst`);
    } else if (!overtime && !cut) {
      return;
    }
    finish({ result: fallbackResult(), forced: true, cut, elapsedMs: elapsedMs() });
  };

  const fallbackResult = (): MinigameResult => {
    let scores: readonly { slot: Slot; score: number }[] = [];
    try {
      scores = game.getHud().scores;
    } catch (error) {
      console.error(error);
    }
    const bySlot = new Map(scores.map((entry) => [entry.slot, entry.score]));
    const own = slots.map((slot) => ({ slot, score: bySlot.get(slot) ?? 0 }));
    const teams = options.teams ?? null;
    // CHAOS-89: Ohne gültiges Ergebnis gibt es bei Teams ein Unentschieden, bei Koop Stufe 0.
    if (teams && teams.layout !== 'koop') {
      return {
        minigameId: info.id,
        placements: teamPlacements(teams, null, own, info.scoring),
        outcome: { kind: 'teams', winner: null },
      };
    }
    return {
      minigameId: info.id,
      placements: rankByScore(own, info.scoring),
      ...(teams ? { outcome: { kind: 'koop', tier: 0 } as const } : {}),
    };
  };

  const finish = (value: RunnerResult) => {
    result = value;
    state = 'finished';
    options.onResult?.(value);
  };

  const fixedStep = () => {
    game.update(FIXED_STEP_SECONDS);
    physicsStep?.(FIXED_STEP_SECONDS);
    steps++;
    if (state === 'running') settle(game.getResult());
  };

  const neutralize = (slot: Slot) => {
    if (stickActive.has(slot)) {
      game.handleInput(slot, { type: 'move', x: 0, y: 0 });
      stickActive.delete(slot);
    }
    for (const button of held.get(slot) ?? []) game.handleInput(slot, { type: 'release', button });
    held.delete(slot);
  };

  return {
    get state() {
      return state;
    },
    get elapsedMs() {
      return elapsedMs();
    },
    get result() {
      return result;
    },
    get paused() {
      return paused;
    },
    async prepare() {
      if (state !== 'created') throw new Error(`prepare in Zustand ${state}`);
      state = 'preparing';
      if (pacing) sliceStartedAt = pacing.now();
      if (info.physics) {
        if (!options.havok) throw new Error(`Minispiel ${info.id} braucht Havok`);
        const plugin = new HavokPlugin(false, options.havok);
        scene.enablePhysics(GRAVITY, plugin);
        // Physik nur im festen Takt der Laufzeit, nicht im Render-Schritt.
        scene.physicsEnabled = false;
        const engine = scene.getPhysicsEngine();
        if (!engine) throw new Error('Physik konnte nicht aktiviert werden');
        engine.setTimeStep(FIXED_STEP_SECONDS);
        physicsStep = (seconds) => {
          engine._step(seconds);
        };
      }
      await game.prepare({
        scene,
        players,
        seed: options.seed,
        rng: createMinigameRng(options.seed),
        timeLimitMs,
        fx: options.fx,
        characters: {
          // Figuren für native Hosts kennzeichnen (visual.ts), egal welche Fabrik sie baut.
          create: (figureScene, player) => {
            const handle = options.characters.create(figureScene, player);
            markVisual(handle.root, 'figur', player.slot);
            return handle;
          },
        },
        testMode: options.testMode ?? false,
        ...(options.look ? { look: options.look } : {}),
        ...(options.teams ? { teams: options.teams } : {}),
        pace,
      });
      // Während `prepare` entsorgt? Dann nicht wiederbeleben.
      if ((state as RunnerState) === 'preparing') state = 'ready';
    },
    start() {
      if (state !== 'ready') throw new Error(`start in Zustand ${state}`);
      state = 'running';
      game.start();
      for (const slot of disconnected) neutralize(slot);
    },
    finishNow() {
      if (state !== 'running') return;
      settle(game.getResult(), true);
    },
    input(slot, input) {
      if (state !== 'running' || paused || !slots.includes(slot) || disconnected.has(slot)) return;
      if (input.type === 'move') {
        const x = clampAxis(input.x);
        const y = clampAxis(input.y);
        if (x === 0 && y === 0) stickActive.delete(slot);
        else stickActive.add(slot);
        game.handleInput(slot, { type: 'move', x, y });
        return;
      }
      const buttons = held.get(slot) ?? new Set();
      if (input.type === 'press') {
        if (buttons.has(input.button)) return; // doppeltes press ohne release
        buttons.add(input.button);
      } else {
        if (!buttons.has(input.button)) return;
        buttons.delete(input.button);
      }
      held.set(slot, buttons);
      game.handleInput(slot, input);
    },
    setConnected(slot, connected) {
      if (!slots.includes(slot)) return;
      if (connected) {
        disconnected.delete(slot);
        return;
      }
      disconnected.add(slot);
      if (state === 'running') neutralize(slot);
    },
    advance(seconds) {
      if ((state !== 'running' && state !== 'finished') || paused) return 0;
      accumulator += Math.max(0, seconds);
      let done = 0;
      while (accumulator >= FIXED_STEP_SECONDS && done < maxSteps) {
        accumulator -= FIXED_STEP_SECONDS;
        fixedStep();
        done++;
      }
      // Rückstand nach einem Hänger verwerfen statt nachzuholen.
      if (done === maxSteps) accumulator = Math.min(accumulator, FIXED_STEP_SECONDS);
      return done;
    },
    step(count = 1) {
      if (state !== 'running' && state !== 'finished') throw new Error(`step in Zustand ${state}`);
      for (let index = 0; index < count; index++) fixedStep();
    },
    pause() {
      // Server-Pause (ADR-015): Takt steht, Eingaben werden ignoriert. Gehaltene Sticks und
      // Knöpfe lassen los, damit nach `resume` nichts „klemmt“ (Loslassen kommt in der Pause
      // nicht mehr an, der Server leitet dann keine Eingaben weiter).
      if (paused) return;
      paused = true;
      if (state === 'running') for (const slot of slots) neutralize(slot);
    },
    resume() {
      // Rückstand aus der Pause wird nicht nachgeholt: Spielzeit läuft genau dort weiter.
      paused = false;
      accumulator = 0;
    },
    hud() {
      return game.getHud();
    },
    dispose() {
      if (state === 'disposed') return;
      state = 'disposed';
      try {
        game.dispose();
      } finally {
        physicsStep = null;
        if (scene.isPhysicsEnabled()) scene.disablePhysicsEngine();
      }
    },
  };
}

function clampAxis(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-1, Math.min(1, value));
}
