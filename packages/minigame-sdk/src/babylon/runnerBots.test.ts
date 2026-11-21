/**
 * KI-Plätze in der Minispiel-Laufzeit (CHAOS-180, ADR-020): Bot-Eingaben laufen durch
 * denselben Eingang wie Controller-Eingaben, der Stick ist auf Controller-Rate gedrosselt,
 * der Bot-Zufall ist vom Spielzufall getrennt, Fehler im Bot halten das Spiel nicht an.
 */
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { describe, expect, it, vi } from 'vitest';
import {
  BOT_LEVEL_STRENGTH,
  BOT_MOVE_STEPS,
  botSeed,
  clampStrength,
  lerpStrength,
  tap,
  type MinigameBotDriver,
  type MinigameBotOptions,
} from '../bot.ts';
import type { MinigameInfo, MinigameInput, MinigameResult, Slot } from '../info.ts';
import { rankByScore } from '../result.ts';
import { runMinigameHeadless } from '../testing/headless.ts';
import type { Minigame, MinigameModule } from './contract.ts';

const INFO: MinigameInfo = {
  id: 'bot-test',
  category: 'arcade',
  title: 'Bot-Test',
  tagline: 'Nur für Tests',
  instructions: ['Testen.'],
  controls: { joystick: 'Laufen', a: 'Springen', b: null },
  durationMs: 2_000,
  physics: false,
  scoring: 'higher',
  scoreUnit: 'Punkte',
};

type BotScript = (step: number, options: MinigameBotOptions) => readonly MinigameInput[];

/** Minispiel, das Eingaben und den Spielzufall mitschreibt; Bots folgen einem Skript. */
function probe(script: BotScript | null) {
  const inputs: { step: number; slot: Slot; input: MinigameInput }[] = [];
  const gameRolls: number[] = [];
  const botOptions: MinigameBotOptions[] = [];
  const module: MinigameModule = {
    info: INFO,
    create(): Minigame {
      let step = 0;
      let elapsed = 0;
      let result: MinigameResult | null = null;
      let slots: Slot[] = [];
      let roll = () => 0;
      let camera: FreeCamera | null = null;
      const game: Minigame = {
        prepare(ctx) {
          slots = ctx.players.map((player) => player.slot);
          roll = () => ctx.rng.next();
          camera = new FreeCamera('kamera', new Vector3(0, 2, -5), ctx.scene);
          ctx.scene.activeCamera = camera;
          return Promise.resolve();
        },
        start: () => undefined,
        handleInput(slot, input) {
          inputs.push({ step, slot, input });
        },
        update(dt) {
          gameRolls.push(roll());
          step++;
          elapsed += dt * 1000;
          if (elapsed >= INFO.durationMs) {
            result = {
              minigameId: INFO.id,
              placements: rankByScore(
                slots.map((slot) => ({ slot, score: slot })),
                'higher',
              ),
            };
          }
        },
        getResult: () => result,
        getHud: () => ({ remainingMs: 0, scores: [] }),
        dispose() {
          camera?.dispose();
          camera = null;
        },
      };
      if (script) {
        game.createBot = (options): MinigameBotDriver => {
          botOptions.push(options);
          let botStep = 0;
          return { slot: options.slot, tick: () => script(botStep++, options) };
        };
      }
      return game;
    },
  };
  return { module, inputs, gameRolls, botOptions };
}

describe('Bot-Stärke (rein)', () => {
  it('Stufen, Begrenzung und Interpolation', () => {
    expect(BOT_LEVEL_STRENGTH).toEqual({ leicht: 0, mittel: 0.5, schwer: 1 });
    expect(clampStrength(-1)).toBe(0);
    expect(clampStrength(2)).toBe(1);
    expect(clampStrength(Number.NaN)).toBe(0.5);
    expect(lerpStrength(560, 230, 0)).toBe(560);
    expect(lerpStrength(560, 230, 1)).toBe(230);
    expect(lerpStrength(560, 230, 0.5)).toBe(395);
  });

  it('Bot-Seed ist deterministisch und je Platz verschieden', () => {
    expect(botSeed(42, 1)).toBe(botSeed(42, 1));
    const seeds = new Set([1, 2, 3, 4].map((slot) => botSeed(42, slot as Slot)));
    expect(seeds.size).toBe(4);
    expect(botSeed(42, 1)).not.toBe(botSeed(43, 1));
    expect(botSeed(42, 1)).not.toBe(42);
  });
});

describe('KI-Plätze in der Laufzeit (CHAOS-180)', () => {
  it('erzeugt Bots nur für teilnehmende Plätze, mit begrenzter Stärke und eigenem Zufall', async () => {
    const { module, botOptions } = probe(() => []);
    const run = await runMinigameHeadless(module, {
      players: 2,
      seed: 9,
      bots: [
        { slot: 2, strength: 7 },
        { slot: 4, strength: 0.5 }, // spielt nicht mit
        { slot: 2, strength: 0 }, // doppelt
      ],
    });
    expect(run.runner.botSlots).toEqual([2]);
    expect(botOptions).toHaveLength(1);
    expect(botOptions[0]?.slot).toBe(2);
    expect(botOptions[0]?.strength).toBe(1);
  });

  it('Bot-Eingaben durchlaufen dieselbe Prüfung wie Controller-Eingaben', async () => {
    const { module, inputs } = probe((step) =>
      step === 0
        ? [
            { type: 'move', x: 5, y: Number.NaN },
            { type: 'press', button: 'a' },
            { type: 'press', button: 'a' }, // doppelt ohne release
            { type: 'release', button: 'b' }, // nie gedrückt
          ]
        : [],
    );
    await runMinigameHeadless(module, { players: 2, bots: [{ slot: 1, strength: 0.5 }] });
    expect(inputs.map((entry) => entry.input)).toEqual([
      { type: 'move', x: 1, y: 0 },
      { type: 'press', button: 'a' },
    ]);
    expect(inputs.every((entry) => entry.slot === 1)).toBe(true);
  });

  it('drosselt den Stick auf Controller-Rate und hält die Reihenfolge ein', async () => {
    // Jeder Schritt ein neuer Stick, in Schritt 3 zusätzlich ein Knopfdruck.
    const { module, inputs } = probe((step) => [
      { type: 'move', x: step / 100, y: 0 },
      ...(step === 3 ? tap('a') : []),
    ]);
    await runMinigameHeadless(module, { players: 2, bots: [{ slot: 1, strength: 0.5 }] });
    const moveSteps = inputs.filter((e) => e.input.type === 'move').map((e) => e.step);
    for (let i = 1; i < moveSteps.length; i++) {
      expect((moveSteps[i] ?? 0) - (moveSteps[i - 1] ?? 0)).toBeGreaterThanOrEqual(BOT_MOVE_STEPS);
    }
    // ≈ 30 Hz über 2 s.
    expect(moveSteps.length).toBeGreaterThan(55);
    expect(moveSteps.length).toBeLessThanOrEqual(61);
    // Der Knopf kommt nach dem Stick seines Schritts (gleiche Richtung wie gewollt).
    const pressIndex = inputs.findIndex((e) => e.input.type === 'press');
    const before = inputs[pressIndex - 1]?.input;
    expect(before).toEqual({ type: 'move', x: 0.03, y: 0 });
    expect(inputs[pressIndex + 1]?.input).toEqual({ type: 'release', button: 'a' });
  });

  it('verschiebt den Spielzufall nicht (eigener Strom je Bot)', async () => {
    const consumeRng: BotScript = (_step, options) => {
      options.rng.next();
      return options.rng.next() < 0.5 ? tap('a') : [];
    };
    const plain = probe(null);
    await runMinigameHeadless(plain.module, { players: 3, seed: 5 });
    const withBots = probe(consumeRng);
    await runMinigameHeadless(withBots.module, {
      players: 3,
      seed: 5,
      bots: [
        { slot: 1, strength: 0 },
        { slot: 3, strength: 1 },
      ],
    });
    expect(withBots.gameRolls).toEqual(plain.gameRolls);
  });

  it('gleicher Seed → gleiche Bot-Eingaben', async () => {
    const randomPresser: BotScript = (_step, options) =>
      options.rng.next() < 0.1 ? tap(options.rng.next() < 0.5 ? 'a' : 'b') : [];
    const runOnce = async () => {
      const p = probe(randomPresser);
      await runMinigameHeadless(p.module, {
        players: 4,
        seed: 17,
        bots: [1, 2, 3, 4].map((slot) => ({ slot: slot as Slot, strength: 0.5 })),
      });
      return p.inputs;
    };
    const first = await runOnce();
    expect(first.length).toBeGreaterThan(10);
    expect(await runOnce()).toEqual(first);
  });

  it('ein Fehler im Bot stoppt nur diesen Platz, das Spiel endet regulär', async () => {
    const error = vi.spyOn(console, 'error').mockReturnValue(undefined);
    const { module, inputs } = probe((step, options) => {
      if (options.slot === 1 && step === 5) throw new Error('kaputt');
      return step % 10 === 0 ? [{ type: 'move', x: 1, y: 0 }] : [];
    });
    const run = await runMinigameHeadless(module, {
      players: 2,
      bots: [
        { slot: 1, strength: 0.5 },
        { slot: 2, strength: 0.5 },
      ],
    });
    expect(run.outcome?.forced).toBe(false);
    const slot1 = inputs.filter((e) => e.slot === 1).map((e) => e.input);
    // Stick nach dem Fehler neutralisiert, danach nichts mehr von Platz 1.
    expect(slot1).toEqual([
      { type: 'move', x: 1, y: 0 },
      { type: 'move', x: 0, y: 0 },
    ]);
    expect(inputs.filter((e) => e.slot === 2).length).toBeGreaterThan(5);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it('Minispiel ohne Bot: Platz steht still, kein Absturz', async () => {
    const error = vi.spyOn(console, 'error').mockReturnValue(undefined);
    const { module, inputs } = probe(null);
    const run = await runMinigameHeadless(module, {
      players: 2,
      bots: [{ slot: 1, strength: 0.5 }],
    });
    expect(run.runner.botSlots).toEqual([]);
    expect(inputs).toEqual([]);
    expect(run.outcome?.forced).toBe(false);
    error.mockRestore();
  });

  it('in der Pause fragt die Laufzeit keinen Bot', async () => {
    const ticks: number[] = [];
    const { module } = probe((step) => {
      ticks.push(step);
      return [];
    });
    await runMinigameHeadless(module, {
      players: 2,
      bots: [{ slot: 1, strength: 0.5 }],
      script: (elapsedMs, _send, runner) => {
        if (elapsedMs === 500) {
          runner.pause();
          // Pausiert rechnet `advance` keine Schritte (also auch keine Bot-Takte).
          expect(runner.advance(1)).toBe(0);
          runner.resume();
        }
      },
    });
    // Je fester Schritt genau ein Takt (der letzte Schritt beendet das Spiel).
    expect(ticks.length).toBe(Math.round(INFO.durationMs / (1000 / 60)));
  });
});
