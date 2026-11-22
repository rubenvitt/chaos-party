import { lineup, matchMetrics, runBotMatch, type PlayerCount } from '@chaos-party/minigame-kit';
import {
  checkCue,
  checkInfo,
  checkResult,
  createMinigameRng,
  type MinigameCue,
  type Slot,
} from '@chaos-party/minigame-sdk';
import { EMPTY_RESIDUE, runMinigameHeadless } from '@chaos-party/minigame-sdk/testing';
import { describe, expect, it } from 'vitest';
import { getMinigameInfo, getSteckbrief, RAPID_FIRE_ID, ROTATION } from '../catalog.ts';
import { getMinigameModule } from '../index.ts';
import { checkFairness, measureFairness } from '../checks/fairness.ts';
import { SCHNELLFEUER_BOT_ADAPTER, SCHNELLFEUER_FAIRNESS } from './bot.ts';
import { SCHNELLFEUER_INFO } from './info.ts';
import { ANNOUNCE_S, CHAIN_LENGTH, CHAIN_MAX_MS, drawChain, SchnellfeuerChain } from './chain.ts';
import { checkMicroInfo, type MicroGame } from './micro.ts';
import { KUCHEN, MICRO_POOL, SPAGHETTI, WECKER, WeckerGame } from './micros.ts';
import { MICRO_VIEWS } from './views.ts';

const STEP = 1 / 60;

function run(game: MicroGame, act?: (game: MicroGame) => void): void {
  for (let i = 0; i < 60 * 10 && !game.finished; i++) {
    act?.(game);
    game.step(STEP);
  }
}

describe('Mikro-Vorrat – Vertrag', () => {
  it.each(MICRO_POOL.map((micro) => [micro.info.id, micro] as const))(
    '%s hält den Mikro-Vertrag (5–8 s, Bildwort) und hat eine Ansicht',
    (_id, micro) => {
      expect(checkMicroInfo(micro.info)).toEqual({ ok: true });
      expect(MICRO_VIEWS[micro.info.id]).toBeDefined();
    },
  );

  it('je Mikro-Spiel ein anderes Bildwort und eine andere Skizze', () => {
    expect(new Set(MICRO_POOL.map((m) => m.info.word)).size).toBe(MICRO_POOL.length);
    expect(new Set(MICRO_POOL.map((m) => m.info.sketch)).size).toBe(MICRO_POOL.length);
  });

  it('lehnt zu lange Mikro-Spiele und Anleitungen statt Bildwort ab', () => {
    expect(checkMicroInfo({ ...WECKER.info, durationMs: 9_000 }).ok).toBe(false);
    expect(checkMicroInfo({ ...WECKER.info, word: 'Drück A, wenn es klingelt' }).ok).toBe(false);
  });

  it('jedes Mikro-Spiel endet ohne Eingaben nach seiner Zeit, ohne Punkte', () => {
    for (const micro of MICRO_POOL) {
      const game = micro.create([1, 2, 3], createMinigameRng(4));
      run(game);
      expect(game.finished).toBe(true);
      expect(game.time).toBeLessThanOrEqual(micro.info.durationMs / 1000 + STEP);
      expect(game.scores().every((entry) => entry.score === 0)).toBe(true);
    }
  });
});

describe('Mikro-Spiele – Regeln', () => {
  it('Wecker: zu früh drücken verliert, nach dem Klingeln zählt die Reaktion', () => {
    const game = new WeckerGame([1, 2, 3], createMinigameRng(2));
    game.press(1, 'a');
    run(game, (g) => {
      const wecker = g as WeckerGame;
      if (wecker.ringing && wecker.time > wecker.ringAt + 0.2) g.press(2, 'a');
      if (wecker.ringing && wecker.time > wecker.ringAt + 0.5) g.press(3, 'a');
    });
    const scores = new Map(game.scores().map((entry) => [entry.slot, entry.score]));
    expect(scores.get(1)).toBe(0);
    expect(game.status(1)).toBe('zu früh!');
    expect(scores.get(2)).toBeGreaterThan(scores.get(3) ?? 0);
    expect(game.finished).toBe(true);
  });

  it('Spaghetti: Hämmern spritzt Soße, gleichmäßiger Takt leert den Teller', () => {
    const game = SPAGHETTI.create([1, 2], createMinigameRng(1));
    run(game, (g) => {
      const frame = Math.round(g.time * 60);
      if (frame % 8 === 0) g.press(1, 'a');
      if (frame % 2 === 0) g.press(2, 'a');
    });
    const [one, two] = game.scores();
    expect(game.status(1)).toBe('leer!');
    expect(one?.score).toBeGreaterThan(two?.score ?? 0);
  });

  it('Kuchen: ein Schnitt, Punkte nach Gleichheit der Hälften', () => {
    const game = KUCHEN.create([1, 2], createMinigameRng(3));
    game.press(2, 'a');
    game.press(2, 'a');
    run(game, (g) => {
      const kuchen = g as typeof game;
      const knife = kuchen.cutters.get(1)?.knife ?? 0;
      kuchen.stick(1, (kuchen.cakeAt(kuchen.time) - knife) * 8, 0);
      if (kuchen.time > 2 && Math.abs(kuchen.cakeAt(kuchen.time) - knife) < 0.03) {
        kuchen.press(1, 'a');
      }
    });
    expect(game.accuracy(1)).toBeGreaterThan(85);
    expect(game.accuracy(2)).not.toBeNull();
    expect(game.finished).toBe(true);
  });
});

describe('Schnellfeuer-Kette', () => {
  it('zieht fünf verschiedene Mikro-Spiele per Seed', () => {
    const order = drawChain(createMinigameRng(7));
    expect(order).toHaveLength(CHAIN_LENGTH);
    expect(new Set(order.map((m) => m.info.id)).size).toBe(CHAIN_LENGTH);
    expect(drawChain(createMinigameRng(7))).toEqual(order);
  });

  it('Bildwort vor jedem Spiel sperrt Knöpfe; Punkte je Platz über alle fünf', () => {
    const slots: Slot[] = [1, 2, 3, 4];
    const chain = new SchnellfeuerChain(slots, createMinigameRng(11), CHAIN_MAX_MS);
    const names = new Map(slots.map((slot) => [slot, `Spieler ${String(slot)}`]));
    expect(chain.banner(names)).toMatch(/^1\/5 .+ [A-ZÄÖÜ]+!$/);
    let starts = 0;
    let ends = 0;
    while (!chain.finished && chain.time < 60) {
      if (chain.phase === 'announce') chain.press(1, 'a');
      for (const event of chain.step(STEP)) {
        if (event.type === 'start') {
          starts++;
          expect(chain.time).toBeGreaterThanOrEqual(ANNOUNCE_S - 1e-6);
        }
        if (event.type === 'end') ends++;
      }
      expect(chain.banner(names)?.length ?? 0).toBeLessThanOrEqual(32);
    }
    expect(chain.finished).toBe(true);
    expect([starts, ends]).toEqual([5, 5]);
    // Ohne Eingaben hat niemand etwas: alle gleichauf mit 0 Punkten, niemand gewinnt.
    expect(chain.totals.placements().every((entry) => entry.place === 1)).toBe(true);
    expect(chain.time * 1000).toBeLessThanOrEqual(CHAIN_MAX_MS);
  });

  it('Controller-Hinweis wechselt mit dem Bildwort und bleibt bis zum nächsten (CHAOS-231)', () => {
    const chain = new SchnellfeuerChain([1, 2], createMinigameRng(11), CHAIN_MAX_MS);
    const seen: { step: number; phase: string }[] = [];
    let last = -1;
    while (!chain.finished) {
      const cue = chain.cue();
      expect(cue).not.toBeNull();
      if (!cue) break;
      expect(checkCue(cue, SCHNELLFEUER_INFO)).toEqual({ ok: true });
      const micro = chain.order[cue.step];
      expect(cue).toMatchObject({ word: micro?.info.word, controls: micro?.info.controls });
      expect(cue.double).toBe(cue.step === CHAIN_LENGTH - 1);
      if (cue.step !== last) seen.push({ step: cue.step, phase: chain.phase });
      last = cue.step;
      chain.step(STEP);
    }
    // Jeder Wechsel fällt auf das Bildwort, nie mitten ins Spiel.
    expect(seen).toEqual([0, 1, 2, 3, 4].map((step) => ({ step, phase: 'announce' })));
    expect(chain.cue()).toBeNull();
  });

  it('endet mit der Restzeit des Minispiels und wertet das laufende Mikro-Spiel', () => {
    const chain = new SchnellfeuerChain([1, 2], createMinigameRng(1), 5_000);
    while (!chain.finished) chain.step(STEP);
    expect(chain.time).toBeCloseTo(5, 1);
  });

  it('Bots: deterministisch, der Profi gewinnt öfter als der Neuling (2/3/4)', () => {
    const first = runBotMatch(SCHNELLFEUER_BOT_ADAPTER, 5, lineup(4), CHAIN_MAX_MS);
    expect(runBotMatch(SCHNELLFEUER_BOT_ADAPTER, 5, lineup(4), CHAIN_MAX_MS)).toEqual(first);
    for (const players of [2, 3, 4] as PlayerCount[]) {
      const records = Array.from({ length: 40 }, (_, seed) =>
        runBotMatch(SCHNELLFEUER_BOT_ADAPTER, seed + 1, lineup(players), CHAIN_MAX_MS),
      );
      const metrics = matchMetrics(records);
      expect(metrics.strongestWins).toBeGreaterThan(metrics.weakestWins);
    }
  });

  it(
    'hält die festen Fairness-Schwellen aller Minispiele ein (CHAOS-84)',
    { timeout: 60_000 },
    async () => {
      const report = await measureFairness(SCHNELLFEUER_FAIRNESS);
      expect(checkFairness(report).map((v) => `${v.text}: ${v.value.toFixed(2)}`)).toEqual([]);
      const seats = [{ skill: 'normal' as const }, { skill: 'neuling' as const }];
      expect(SCHNELLFEUER_FAIRNESS.play(seats, 3)).toEqual(SCHNELLFEUER_FAIRNESS.play(seats, 3));
    },
  );
});

describe('Schnellfeuer – Modul', () => {
  it('ist ein eigenes Minispiel im Katalog, aber nicht in der Rotation', () => {
    const info = getMinigameInfo(RAPID_FIRE_ID);
    expect(info).toBeDefined();
    if (!info) return;
    expect(checkInfo(info)).toEqual({ ok: true });
    expect(info.family).toBe('mikro');
    expect(getSteckbrief(RAPID_FIRE_ID)?.spielform).toBe('Mikro');
    expect(ROTATION).not.toContain(RAPID_FIRE_ID);
    expect(getMinigameModule(RAPID_FIRE_ID)?.info).toBe(info);
  });

  it.each([2, 3, 4])(
    'läuft headless mit %i Personen durch, liefert ein gültiges Ergebnis und räumt auf',
    async (players) => {
      const module = getMinigameModule(RAPID_FIRE_ID);
      if (!module) throw new Error('Schnellfeuer fehlt');
      const cues: (MinigameCue | null)[] = [];
      const run = await runMinigameHeadless(module, {
        players,
        seed: 21 + players,
        onCue: (cue) => cues.push(cue),
        script: (elapsedMs, send) => {
          const frame = Math.round(elapsedMs / (1000 / 60));
          if (frame % 9 !== 0) return;
          for (const slot of [1, 2, 3, 4].slice(0, players) as Slot[]) {
            send(slot, { type: 'move', x: Math.sin(frame / 18 + slot), y: Math.cos(frame / 30) });
            if ((frame / 9 + slot) % 2 === 0) {
              send(slot, { type: 'press', button: 'a' });
              send(slot, { type: 'release', button: 'a' });
            }
          }
        },
      });
      const outcome = run.outcome;
      expect(outcome?.forced).toBe(false);
      if (!outcome) return;
      const slots = ([1, 2, 3, 4] as Slot[]).slice(0, players);
      expect(
        checkResult(outcome.result, { minigameId: RAPID_FIRE_ID, slots, scoring: 'higher' }),
      ).toEqual({ ok: true });
      expect(outcome.result.placements.some((entry) => entry.score > 0)).toBe(true);
      // Ein Hinweis je Mikro-Spiel, zum Schluss keiner mehr (CHAOS-231).
      expect(cues.map((cue) => cue?.step ?? null)).toEqual([0, 1, 2, 3, 4, null]);
      expect(run.residue).toEqual(EMPTY_RESIDUE);
    },
  );
});
