import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { PhysicsAggregate } from '@babylonjs/core/Physics/v2/physicsAggregate.js';
import { PhysicsShapeType } from '@babylonjs/core/Physics/v2/IPhysicsEnginePlugin.js';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder.js';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder.js';
import type { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { describe, expect, it, vi } from 'vitest';
import type {
  MinigameCue,
  MinigameInfo,
  MinigameInput,
  MinigameResult,
  MinigameSecret,
  Slot,
} from '../info.ts';
import { rankByScore } from '../result.ts';
import {
  createHeadlessScene,
  createRecordingFx,
  createTestCharacters,
  EMPTY_RESIDUE,
  loadHavokForNode,
  runMinigameHeadless,
  sceneResidue,
  testPlayers,
} from '../testing/headless.ts';
import type { Minigame, MinigameContext, MinigameModule } from './contract.ts';
import {
  createMinigameRunner,
  MAX_STEPS_PER_ADVANCE,
  PrepareAborted,
  type PrepareThrottle,
  type RunnerOptions,
} from './runner.ts';

const BASE_INFO: MinigameInfo = {
  id: 'test-spiel',
  category: 'arcade',
  title: 'Test',
  tagline: 'Nur für Tests',
  instructions: ['Testen.'],
  controls: { joystick: 'Laufen', a: 'Springen', b: null },
  durationMs: 5_000,
  physics: false,
  scoring: 'higher',
  scoreUnit: 'Punkte',
};

/** Protokolliert alle Aufrufe; Ergebnis nach `finishAfterMs` oder nie. */
function probe(options: {
  info?: Partial<MinigameInfo>;
  finishAfterMs?: number;
  badResult?: boolean;
  physicsBall?: boolean;
}) {
  const info = { ...BASE_INFO, ...options.info };
  const calls: string[] = [];
  const inputs: [Slot, MinigameInput][] = [];
  let ball: Mesh | null = null;
  const created: { dispose(): void }[] = [];
  const module: MinigameModule = {
    info,
    create(): Minigame {
      let ctx: MinigameContext | null = null;
      let elapsed = 0;
      let result: MinigameResult | null = null;
      return {
        prepare(context) {
          ctx = context;
          calls.push('prepare');
          if (options.physicsBall) {
            const ground = CreateBox('boden', { width: 10, depth: 10, height: 1 }, context.scene);
            ground.position.y = -0.5;
            const groundBody = new PhysicsAggregate(
              ground,
              PhysicsShapeType.BOX,
              { mass: 0 },
              context.scene,
            );
            ball = CreateSphere('ball', { diameter: 1 }, context.scene);
            ball.position.y = 5;
            const ballBody = new PhysicsAggregate(
              ball,
              PhysicsShapeType.SPHERE,
              { mass: 1 },
              context.scene,
            );
            created.push(ballBody, ball, groundBody, ground);
          }
          return Promise.resolve();
        },
        start: () => calls.push('start'),
        handleInput: (slot, input) => inputs.push([slot, input]),
        update(dt) {
          elapsed += dt * 1000;
          if (
            options.finishAfterMs !== undefined &&
            elapsed >= options.finishAfterMs &&
            !result &&
            ctx
          ) {
            result = options.badResult
              ? { minigameId: info.id, placements: [] }
              : {
                  minigameId: info.id,
                  placements: rankByScore(
                    ctx.players.map((p) => ({ slot: p.slot, score: p.slot })),
                  ),
                };
          }
        },
        getResult: () => result,
        getHud: () => ({
          remainingMs: Math.max(0, 5000 - elapsed),
          scores: (ctx?.players ?? []).map((p) => ({ slot: p.slot, score: 10 - p.slot })),
        }),
        dispose() {
          calls.push('dispose');
          for (const item of created.splice(0)) item.dispose();
        },
      };
    },
  };
  return { module, calls, inputs, ball: () => ball };
}

async function setup(
  module: MinigameModule,
  players = 2,
  extra: Partial<
    Pick<
      RunnerOptions,
      'maxStepsPerAdvance' | 'look' | 'pacing' | 'onResult' | 'onCue' | 'onSecret'
    >
  > = {},
) {
  const headless = createHeadlessScene();
  const runner = createMinigameRunner(module, {
    scene: headless.scene,
    players: testPlayers(players),
    seed: 1,
    fx: createRecordingFx(),
    characters: createTestCharacters(),
    havok: module.info.physics ? await loadHavokForNode() : null,
    testMode: true,
    ...extra,
  });
  return { headless, runner };
}

describe('Minispiel-Laufzeit', () => {
  it('erzwingt die Reihenfolge prepare → start → step → dispose', async () => {
    const { module, calls } = probe({ finishAfterMs: 100 });
    const { runner, headless } = await setup(module);
    expect(() => {
      runner.start();
    }).toThrow();
    await runner.prepare();
    await expect(runner.prepare()).rejects.toThrow();
    runner.start();
    runner.step(10);
    expect(runner.state).toBe('finished');
    runner.dispose();
    runner.dispose();
    expect(calls).toEqual(['prepare', 'start', 'dispose']);
    headless.dispose();
  });

  it('gibt Eingaben nur laufend, nur an Teilnehmer und begrenzt die Achsen', async () => {
    const { module, inputs } = probe({});
    const { runner, headless } = await setup(module, 2);
    await runner.prepare();
    runner.input(1, { type: 'press', button: 'a' }); // vor dem Start
    runner.start();
    runner.input(3, { type: 'press', button: 'a' }); // spielt nicht mit
    runner.input(1, { type: 'move', x: 4, y: -Infinity });
    runner.input(2, { type: 'press', button: 'a' });
    runner.input(2, { type: 'press', button: 'a' }); // doppelt
    runner.input(2, { type: 'release', button: 'b' }); // nie gedrückt
    expect(inputs).toEqual([
      [1, { type: 'move', x: 1, y: 0 }],
      [2, { type: 'press', button: 'a' }],
    ]);
    runner.dispose();
    headless.dispose();
  });

  it('neutralisiert getrennte Spieler und ignoriert ihre Eingaben bis zur Rückkehr', async () => {
    const { module, inputs } = probe({});
    const { runner, headless } = await setup(module, 2);
    await runner.prepare();
    runner.start();
    runner.input(1, { type: 'move', x: 0.5, y: 0.5 });
    runner.input(1, { type: 'press', button: 'a' });
    runner.setConnected(1, false);
    runner.input(1, { type: 'press', button: 'b' });
    runner.setConnected(1, true);
    runner.input(1, { type: 'press', button: 'b' });
    expect(inputs.slice(2)).toEqual([
      [1, { type: 'move', x: 0, y: 0 }],
      [1, { type: 'release', button: 'a' }],
      [1, { type: 'press', button: 'b' }],
    ]);
    runner.dispose();
    headless.dispose();
  });

  it('wertet selbst aus dem HUD, wenn das Minispiel das Zeitlimit überzieht', async () => {
    const run = await runMinigameHeadless(probe({}).module, { players: 3 });
    expect(run.outcome?.forced).toBe(true);
    // HUD-Punkte 10 - Slot → Slot 1 vorn.
    expect(run.outcome?.result.placements.map((p) => p.slot)).toEqual([1, 2, 3]);
    expect(run.outcome?.elapsedMs).toBeGreaterThan(5_000);
    expect(run.outcome?.elapsedMs).toBeLessThan(6_100);
  });

  it('finishNow wertet den Stand sofort und nur im laufenden Spiel (CHAOS-206)', async () => {
    const { module } = probe({});
    const results: unknown[] = [];
    const { runner, headless } = await setup(module, 3, {
      onResult: (value) => results.push(value),
    });
    runner.finishNow();
    await runner.prepare();
    runner.finishNow();
    expect(runner.state).toBe('ready');
    runner.start();
    runner.step(60);
    runner.finishNow();
    expect(runner.state).toBe('finished');
    expect(runner.result).toMatchObject({ forced: true, cut: true, elapsedMs: 1000 });
    // HUD-Punkte 10 - Slot → Slot 1 vorn.
    expect(runner.result?.result.placements.map((p) => p.slot)).toEqual([1, 2, 3]);
    runner.finishNow();
    expect(results).toHaveLength(1);
    runner.dispose();
    headless.dispose();
  });

  it('meldet Hinweis-Wechsel nur laufend, geprüft und einmal je Änderung (CHAOS-231)', async () => {
    const { module: base } = probe({});
    let elapsed = 0;
    const cueAt = (ms: number): MinigameCue | null => {
      if (ms >= 3_000) return null;
      const step = ms >= 1_000 ? 1 : 0;
      return {
        step,
        steps: 2,
        icon: '⏰',
        word: step === 0 ? 'HAUEN!' : 'ZIELEN!',
        // Abschnitt 1 nennt eine Bedienung, die der Steckbrief nicht hat (b): ungültig.
        controls: { joystick: null, a: 'Hauen', b: ms >= 2_000 ? 'Bremsen' : null },
        double: step === 1,
      };
    };
    const module: MinigameModule = {
      info: base.info,
      create() {
        const game = base.create();
        return {
          ...game,
          update(dt) {
            elapsed += dt * 1000;
            game.update(dt);
          },
          // Jedes Mal ein neues Objekt: verglichen wird der Inhalt.
          getCue: () => cueAt(elapsed),
        };
      },
    };
    const cues: (MinigameCue | null)[] = [];
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { runner, headless } = await setup(module, 2, { onCue: (cue) => cues.push(cue) });
    await runner.prepare();
    expect(cues).toEqual([]);
    runner.start();
    expect(cues.map((cue) => cue?.word)).toEqual(['HAUEN!']);
    runner.step(30);
    expect(cues).toHaveLength(1);
    runner.step(60);
    expect(cues.map((cue) => cue?.step)).toEqual([0, 1]);
    expect(runner.cue?.word).toBe('ZIELEN!');
    runner.step(60);
    // Ab 2 s ungültig (b fehlt im Steckbrief): nicht gemeldet, der alte Hinweis bleibt.
    expect(cues).toHaveLength(2);
    expect(errors).toHaveBeenCalled();
    runner.step(60);
    expect(cues.at(-1)).toBeNull();
    expect(runner.cue).toBeNull();
    errors.mockRestore();
    runner.dispose();
    headless.dispose();
  });

  it('meldet private Rückmeldungen je Slot, geprüft und nur bei Änderung (CHAOS-242)', async () => {
    const { module: base } = probe({});
    let elapsed = 0;
    const options = [
      { id: 'links', icon: '←', label: '5 Münzen' },
      { id: 'rechts', icon: '→', label: '3 Münzen' },
    ];
    const secretAt = (slot: Slot, ms: number): MinigameSecret | null => {
      if (ms >= 3_000) return null;
      // Slot 2 wählt ab 1 s; ab 2 s meldet Slot 1 eine unbekannte Wahl (ungültig).
      const pick =
        slot === 2 && ms >= 1_000 ? 'rechts' : slot === 1 && ms >= 2_000 ? 'mitte' : null;
      return { prompt: 'Deine Tür', options, aim: null, pick, locked: false };
    };
    const module: MinigameModule = {
      info: base.info,
      create() {
        const game = base.create();
        return {
          ...game,
          update(dt) {
            elapsed += dt * 1000;
            game.update(dt);
          },
          getSecret: (slot) => secretAt(slot, elapsed),
        };
      },
    };
    const seen: [Slot, string | null][] = [];
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { runner, headless } = await setup(module, 2, {
      onSecret: (slot, secret) => seen.push([slot, secret ? (secret.pick ?? '-') : null]),
    });
    await runner.prepare();
    expect(seen).toEqual([]);
    runner.start();
    expect(seen).toEqual([
      [1, '-'],
      [2, '-'],
    ]);
    runner.step(30);
    expect(seen).toHaveLength(2);
    runner.step(60);
    expect(seen.at(-1)).toEqual([2, 'rechts']);
    expect(seen).toHaveLength(3);
    runner.step(60);
    // Slot 1 ungültig: nicht gemeldet, Fehler protokolliert.
    expect(seen).toHaveLength(3);
    expect(errors).toHaveBeenCalled();
    runner.step(60);
    expect(seen.slice(3)).toEqual([
      [1, null],
      [2, null],
    ]);
    errors.mockRestore();
    runner.dispose();
    headless.dispose();
  });

  it('ersetzt ein ungültiges Ergebnis durch die HUD-Wertung', async () => {
    const run = await runMinigameHeadless(probe({ finishAfterMs: 500, badResult: true }).module);
    expect(run.outcome?.forced).toBe(true);
    expect(run.outcome?.elapsedMs).toBeLessThan(600);
  });

  it('rechnet in advance feste Schritte, begrenzt Rückstand und steht bei Pause', async () => {
    const { module } = probe({});
    const { runner, headless } = await setup(module);
    await runner.prepare();
    runner.start();
    expect(runner.advance(0.05)).toBe(3);
    expect(runner.advance(5)).toBe(MAX_STEPS_PER_ADVANCE); // Hänger: kein Nachholen
    runner.pause();
    expect(runner.advance(1)).toBe(0);
    runner.resume();
    expect(runner.advance(1 / 60 + 1e-6)).toBe(1);
    runner.dispose();
    headless.dispose();
  });

  it('Pause hält Spielzeit an, ignoriert Eingaben und lässt Gehaltenes los (ADR-015)', async () => {
    const probeGame = probe({});
    const { runner, headless } = await setup(probeGame.module);
    await runner.prepare();
    runner.start();
    runner.input(1, { type: 'move', x: 1, y: 0 });
    runner.input(1, { type: 'press', button: 'a' });
    runner.step(30);
    const before = runner.elapsedMs;
    const inputsBefore = probeGame.inputs.length;
    runner.pause();
    runner.pause(); // doppelt ist harmlos
    expect(runner.paused).toBe(true);
    // Neutralisiert: Stick auf 0, Knopf los.
    expect(probeGame.inputs.slice(inputsBefore)).toEqual([
      [1, { type: 'move', x: 0, y: 0 }],
      [1, { type: 'release', button: 'a' }],
    ]);
    const neutralized = probeGame.inputs.length;
    expect(runner.advance(10)).toBe(0);
    runner.input(2, { type: 'press', button: 'a' });
    expect(probeGame.inputs).toHaveLength(neutralized);
    expect(runner.elapsedMs).toBe(before);
    runner.resume();
    expect(runner.paused).toBe(false);
    // Kein Nachholen der Pausenzeit.
    expect(runner.advance(1 / 60 + 1e-6)).toBe(1);
    expect(runner.elapsedMs).toBe(before + 17);
    runner.input(2, { type: 'press', button: 'a' });
    expect(probeGame.inputs.at(-1)).toEqual([2, { type: 'press', button: 'a' }]);
    runner.dispose();
    headless.dispose();
  });

  it('holt bei Software-Rendering mehr Schritte je advance nach (maxStepsPerAdvance)', async () => {
    const { module } = probe({});
    const { runner, headless } = await setup(module, 2, { maxStepsPerAdvance: 60 });
    await runner.prepare();
    runner.start();
    // Ein Bild nach 0,5 s: 30 Schritte, die Spielzeit bleibt bei der echten Zeit.
    expect(runner.advance(0.5)).toBe(30);
    expect(runner.advance(5)).toBe(60);
    runner.dispose();
    headless.dispose();
  });

  it('rechnet Havok-Physik im festen Takt (nicht beim Rendern) und räumt Körper weg', async () => {
    const probeGame = probe({ info: { physics: true }, finishAfterMs: 2_000, physicsBall: true });
    const { runner, headless } = await setup(probeGame.module);
    await runner.prepare();
    runner.start();
    const ball = probeGame.ball();
    if (!ball) throw new Error('Ball fehlt');
    const camera = new FreeCamera('testkamera', new Vector3(0, 2, -10), headless.scene);
    for (let frame = 0; frame < 30; frame++) headless.scene.render(); // darf die Physik nicht bewegen
    expect(ball.position.y).toBeCloseTo(5, 5);
    camera.dispose();
    runner.step(120);
    // Invariante statt Bitgenauigkeit: liegt auf dem Boden, fällt nicht durch.
    expect(ball.position.y).toBeGreaterThan(0.4);
    expect(ball.position.y).toBeLessThan(0.6);
    runner.dispose();
    expect(sceneResidue(headless.scene)).toEqual(EMPTY_RESIDUE);
    headless.dispose();
  });

  describe('verteilter Aufbau (ctx.pace, CHAOS-141)', () => {
    /** Minispiel, das in `prepare` zehn Kisten baut und vor jeder `pace` ruft. */
    function pacedModule(built: string[]): MinigameModule {
      const { module } = probe({});
      return {
        info: module.info,
        create() {
          const game = module.create();
          return {
            ...game,
            async prepare(context) {
              for (let index = 0; index < 10; index++) {
                await context.pace();
                built.push(`kiste-${String(index)}`);
              }
              await game.prepare(context);
            },
          };
        },
      };
    }

    /** Bilder von Hand: `nextFrame` wartet, bis der Test `frame()` ruft; je Schritt 1 ms. */
    function manualFrames(budgetMs: number) {
      let clock = 0;
      const waiting: (() => void)[] = [];
      const pacing: PrepareThrottle = {
        budgetMs,
        now: () => (clock += 1),
        nextFrame: () =>
          new Promise((resolve) => {
            waiting.push(resolve);
          }),
      };
      const frame = async () => {
        for (const resolve of waiting.splice(0)) resolve();
        await Promise.resolve();
        await Promise.resolve();
      };
      return { pacing, frame, pending: () => waiting.length };
    }

    it('ohne Taktgeber baut prepare am Stück', async () => {
      const built: string[] = [];
      const { runner, headless } = await setup(pacedModule(built));
      await runner.prepare();
      expect(built).toHaveLength(10);
      expect(runner.state).toBe('ready');
      runner.dispose();
      headless.dispose();
    });

    it('gibt nach dem Budget ab und baut im nächsten Bild weiter', async () => {
      const built: string[] = [];
      const frames = manualFrames(3);
      const { runner, headless } = await setup(pacedModule(built), 2, { pacing: frames.pacing });
      const prepared = runner.prepare();
      await Promise.resolve();
      // Jede Abfrage der Uhr kostet 1 ms: Nach wenigen Kisten ist das Budget weg.
      expect(built.length).toBeGreaterThan(0);
      expect(built.length).toBeLessThan(10);
      expect(runner.state).toBe('preparing');
      let frameCount = 0;
      while (runner.state === 'preparing' && frameCount < 50) {
        await frames.frame();
        frameCount++;
      }
      await prepared;
      expect(built).toHaveLength(10);
      expect(frameCount).toBeGreaterThan(1);
      expect(runner.state).toBe('ready');
      runner.dispose();
      headless.dispose();
    });

    it('bricht ab, wenn die Laufzeit während des Aufbaus entsorgt wird', async () => {
      const built: string[] = [];
      const frames = manualFrames(0);
      const { runner, headless } = await setup(pacedModule(built), 2, { pacing: frames.pacing });
      const prepared = runner.prepare();
      await frames.frame();
      const before = built.length;
      runner.dispose();
      await frames.frame();
      await expect(prepared).rejects.toBeInstanceOf(PrepareAborted);
      expect(built).toHaveLength(before);
      expect(runner.state).toBe('disposed');
      headless.dispose();
    });
  });
});
