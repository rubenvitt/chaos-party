/**
 * Vertragstest für **jedes** registrierte Minispiel (CHAOS-34, erweitert in CHAOS-84):
 * Katalog stimmig, Textgrenzen, Lebenszyklus mit 2–4 Spielern und Zufalls-Bots, gültiges
 * Ergebnis (alle Slots, Plätze passen zu den Punkten, Höhepunkte in den Grenzen) ohne
 * Rückfallwertung, Ende spätestens am Zeitlimit, Szene nach `dispose` leer (keine Meshes,
 * Materialien, Texturen, Beobachter, Physik-Körper), getrennter Spieler bricht nichts,
 * Leerlauf (niemand drückt) und Dauerdrücken (alle hämmern alle Knöpfe) enden sauber.
 *
 * Neue Minispiele werden hier automatisch mitgeprüft (Schleife über `MINIGAME_MODULES`).
 * Fairness und Vielfalt prüft `checks/checks.test.ts` für die Rotation.
 *
 * KI (CHAOS-180, ADR-020): Jedes Minispiel der Rotation hat einen KI-Bot (`createBot`), der in
 * allen Stufen fehlerfrei spielt, Punkte macht und deterministisch ist. Die Stärke-Kennzahl
 * (schwer schlägt leicht) prüft `checks/botStrength.test.ts`.
 */
import {
  BOT_LEVEL_STRENGTH,
  BOT_LEVELS,
  checkInfo,
  checkResult,
  CHARACTER_IDS,
  type MinigameInfo,
  type Slot,
} from '@chaos-party/minigame-sdk';
import { FIXED_STEP_SECONDS } from '@chaos-party/minigame-sdk/babylon';
import {
  EMPTY_RESIDUE,
  runMinigameHeadless,
  type HeadlessRun,
  type InputScript,
} from '@chaos-party/minigame-sdk/testing';
import { createMinigameRng } from '@chaos-party/minigame-sdk';
import { describe, expect, it, vi } from 'vitest';
import { getMinigameInfo, MINIGAME_INFOS, ROTATION, rotationInfos } from './catalog.ts';
import { getMinigameModule, MINIGAME_MODULES } from './index.ts';

/** Zufalls-Bots: wechseln alle ~0,4 s Stick und Knöpfe (seeded). */
function randomBots(seed: number, slots: readonly Slot[]): InputScript {
  const rng = createMinigameRng(seed);
  const held = new Map<Slot, Set<'a' | 'b'>>();
  return (elapsedMs, send) => {
    const step = Math.round(elapsedMs / (FIXED_STEP_SECONDS * 1000));
    if (step % 24 !== 0) return;
    for (const slot of slots) {
      const angle = rng.next() * Math.PI * 2;
      const length = rng.next() < 0.2 ? 0 : 1;
      send(slot, { type: 'move', x: Math.cos(angle) * length, y: Math.sin(angle) * length });
      const buttons = held.get(slot) ?? new Set();
      for (const button of ['a', 'b'] as const) {
        if (buttons.has(button)) {
          send(slot, { type: 'release', button });
          buttons.delete(button);
        } else if (rng.next() < 0.5) {
          send(slot, { type: 'press', button });
          buttons.add(button);
        }
      }
      held.set(slot, buttons);
    }
  };
}

/**
 * Dauerdrücken: Stick voll in eine Richtung (alle 5 s gedreht), A und B im Wechsel jeden
 * zweiten Schritt drücken und loslassen – die Eingabe eines Kindes, das alles hämmert.
 */
function mashAll(slots: readonly Slot[]): InputScript {
  let step = 0;
  return (elapsedMs, send) => {
    const quarter = Math.floor(elapsedMs / 5_000) % 4;
    const angle = (quarter * Math.PI) / 2;
    for (const slot of slots) {
      if (step % 30 === 0) send(slot, { type: 'move', x: Math.cos(angle), y: Math.sin(angle) });
      const button = step % 4 < 2 ? 'a' : 'b';
      send(slot, { type: step % 2 === 0 ? 'press' : 'release', button });
    }
    step++;
  };
}

/** Gemeinsame Ergebnisprüfung: Ende am Zeitlimit, gültiges Ergebnis, Szene aufgeräumt. */
function expectCleanRun(run: HeadlessRun, info: MinigameInfo, slots: readonly Slot[]): void {
  const outcome = run.outcome;
  expect(outcome).not.toBeNull();
  expect(outcome?.forced).toBe(false);
  expect(outcome?.elapsedMs).toBeLessThanOrEqual(info.durationMs + 50);
  if (outcome) {
    expect(
      checkResult(outcome.result, { minigameId: info.id, slots, scoring: info.scoring }),
    ).toEqual({ ok: true });
  }
  expect(run.residue).toEqual(EMPTY_RESIDUE);
}

describe('Minispiel-Katalog', () => {
  it('Katalog und Module passen zusammen, Steckbriefe sind gültig', () => {
    expect(MINIGAME_MODULES.map((m) => m.info.id)).toEqual(MINIGAME_INFOS.map((i) => i.id));
    for (const module of MINIGAME_MODULES) {
      expect(getMinigameInfo(module.info.id)).toBe(module.info);
      expect(checkInfo(module.info)).toEqual({ ok: true });
    }
    expect(new Set(MINIGAME_INFOS.map((info) => info.id)).size).toBe(MINIGAME_INFOS.length);
    for (const id of ROTATION) expect(getMinigameModule(id)).toBeDefined();
    expect(rotationInfos().length).toBeGreaterThan(0);
    expect(CHARACTER_IDS).toHaveLength(4);
  });
});

describe.each(MINIGAME_MODULES.map((module) => [module.info.id, module] as const))(
  'Minispiel %s (Vertrag, CHAOS-34)',
  (_id, module) => {
    it.each([2, 3, 4])(
      'läuft mit %i Spielern und Zufalls-Bots bis zum gültigen Ergebnis und räumt auf',
      async (players) => {
        const slots = ([1, 2, 3, 4] as const).slice(0, players);
        const run = await runMinigameHeadless(module, {
          players,
          seed: 1000 + players,
          script: randomBots(players, slots),
        });
        expectCleanRun(run, module.info, slots);
        expect(run.outcome?.result.placements.map((p) => p.slot).sort()).toEqual([...slots]);
      },
    );

    it('endet ohne jede Eingabe (Leerlauf) am Zeitlimit mit gültigem Ergebnis', async () => {
      const run = await runMinigameHeadless(module, { players: 4, seed: 3 });
      expectCleanRun(run, module.info, [1, 2, 3, 4]);
      expect(run.outcome?.elapsedMs).toBeGreaterThanOrEqual(module.info.durationMs - 50);
    });

    it('übersteht Dauerdrücken aller Knöpfe mit gültigem Ergebnis', async () => {
      const slots = [1, 2, 3, 4] as const;
      const run = await runMinigameHeadless(module, {
        players: 4,
        seed: 11,
        script: mashAll(slots),
      });
      expectCleanRun(run, module.info, slots);
    });

    it('bleibt stabil, wenn ein Spieler mitten im Spiel die Verbindung verliert', async () => {
      const run = await runMinigameHeadless(module, {
        players: 3,
        seed: 77,
        script: (elapsedMs, send, runner) => {
          randomBots(5, [1, 2, 3])(elapsedMs, send, runner);
          if (Math.abs(elapsedMs - 3000) < 10) runner.setConnected(2, false);
          if (Math.abs(elapsedMs - 6000) < 10) runner.setConnected(2, true);
        },
      });
      expectCleanRun(run, module.info, [1, 2, 3]);
    });
  },
);

describe.each(ROTATION.map((id) => [id, getMinigameModule(id)] as const))(
  'Minispiel %s: KI-Bot (CHAOS-180)',
  (_id, module) => {
    if (!module) throw new Error('Minispiel der Rotation ohne Modul');
    const slots = [1, 2, 3, 4] as const;

    it('hat einen KI-Bot (Pflicht für die Rotation)', () => {
      const game = module.create();
      expect(typeof game.createBot).toBe('function');
      game.dispose();
    });

    it.each(BOT_LEVELS)(
      'spielt mit vier KI-Plätzen der Stufe „%s“ fehlerfrei und macht Punkte',
      async (level) => {
        const errors = vi.spyOn(console, 'error');
        const run = await runMinigameHeadless(module, {
          players: 4,
          seed: 4242,
          bots: slots.map((slot) => ({ slot, strength: BOT_LEVEL_STRENGTH[level] })),
        });
        expect(run.runner.botSlots).toEqual([...slots]);
        expectCleanRun(run, module.info, slots);
        const total = run.outcome?.result.placements.reduce((sum, p) => sum + p.score, 0) ?? 0;
        expect(total).toBeGreaterThan(0);
        expect(errors).not.toHaveBeenCalled();
        errors.mockRestore();
      },
    );

    it('Solo: ein Mensch (tut nichts) gegen drei KI – jede KI punktet besser', async () => {
      const run = await runMinigameHeadless(module, {
        players: 4,
        seed: 31,
        bots: ([2, 3, 4] as const).map((slot) => ({ slot, strength: BOT_LEVEL_STRENGTH.mittel })),
      });
      expectCleanRun(run, module.info, slots);
      const score = (slot: Slot) =>
        run.outcome?.result.placements.find((p) => p.slot === slot)?.score ?? 0;
      for (const slot of [2, 3, 4] as const) expect(score(slot)).toBeGreaterThan(score(1));
    });

    it('gleicher Seed → gleiche KI-Partie', async () => {
      const play = async () =>
        (
          await runMinigameHeadless(module, {
            players: 3,
            seed: 99,
            bots: ([1, 2, 3] as const).map((slot, index) => ({ slot, strength: index / 2 })),
          })
        ).outcome?.result.placements;
      const first = await play();
      expect(first).toBeDefined();
      expect(await play()).toEqual(first);
    });
  },
);
