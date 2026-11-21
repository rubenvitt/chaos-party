import { readFileSync } from 'node:fs';
import {
  lineup,
  lineupWithTroublemaker,
  matchMetrics,
  runBotMatch,
} from '@chaos-party/minigame-kit';
import { createMinigameRng } from '@chaos-party/minigame-sdk';
import { EMPTY_RESIDUE, runMinigameHeadless } from '@chaos-party/minigame-sdk/testing';
import { describe, expect, it } from 'vitest';
import { HALLO_BOT_ADAPTER } from './bot.ts';
import { halloBaukasten } from './index.ts';
import { HalloLogic } from './logic.ts';

const STEP = 1 / 60;

describe('Hallo Baukasten – Logik', () => {
  it('wer im Lichtkreis steht, fängt; sonst entwischt das Glühwürmchen', () => {
    const logic = new HalloLogic([1, 2], createMinigameRng(5), 20_000);
    let caught = 0;
    let escaped = 0;
    while (!logic.finished) {
      // Slot 1 läuft immer zum ältesten Glühwürmchen, Slot 2 steht still.
      const fly = logic.flies[0];
      const me = logic.hopper(1);
      if (fly && me) logic.setStick(1, fly.x - me.x, fly.z - me.z);
      for (const event of logic.step(STEP)) {
        if (event.type === 'catch') caught++;
        if (event.type === 'escape') escaped++;
      }
    }
    expect(caught).toBeGreaterThan(5);
    expect(logic.board.get(1)).toBeGreaterThan(logic.board.get(2));
    expect(caught + escaped).toBeGreaterThan(15);
    expect(logic.step(STEP)).toEqual([]);
    const names = new Map([
      [1, 'Blau'],
      [2, 'Orange'],
    ] as const);
    expect(logic.highlights(names)[0]).toMatch(/^Blau fängt \d+ Glühwürmchen\.$/);
  });

  it('meldet die Abenddämmerung einmal und hechtet mit Abklingzeit', () => {
    const logic = new HalloLogic([1], createMinigameRng(1), 10_000);
    logic.setStick(1, 1, 0);
    expect(logic.dash(1)).toBe(true);
    expect(logic.dash(1)).toBe(false);
    let finale = 0;
    while (!logic.finished) {
      finale += logic.step(STEP).filter((event) => event.type === 'finale').length;
    }
    expect(finale).toBe(1);
    expect(logic.dash(1)).toBe(false);
  });
});

describe('Hallo Baukasten – Bots über die gemeinsame Schnittstelle', () => {
  it('Partien sind deterministisch, der Profi gewinnt öfter als der Neuling', () => {
    const first = runBotMatch(HALLO_BOT_ADAPTER, 3, lineup(4), 20_000);
    expect(runBotMatch(HALLO_BOT_ADAPTER, 3, lineup(4), 20_000)).toEqual(first);
    const records = Array.from({ length: 30 }, (_, seed) =>
      runBotMatch(HALLO_BOT_ADAPTER, seed + 1, lineup(2), 20_000),
    );
    const metrics = matchMetrics(records);
    expect(metrics.winnerScore).toBeGreaterThan(3);
    expect(metrics.strongestWins).toBeGreaterThan(metrics.weakestWins);
    const trouble = runBotMatch(HALLO_BOT_ADAPTER, 4, lineupWithTroublemaker(4), 20_000);
    expect(trouble.scores).toHaveLength(4);
  });
});

describe('Hallo Baukasten – Modul', () => {
  it('läuft headless mit Bots-Eingaben durch und räumt auf', async () => {
    const run = await runMinigameHeadless(halloBaukasten, {
      players: 4,
      seed: 9,
      script: (elapsedMs, send) => {
        if (elapsedMs % 500 !== 0) return;
        for (const slot of [1, 2, 3, 4] as const) {
          send(slot, { type: 'move', x: Math.cos(elapsedMs + slot), y: Math.sin(elapsedMs) });
          send(slot, { type: 'press', button: 'a' });
        }
      },
    });
    expect(run.outcome?.forced).toBe(false);
    expect(run.outcome?.result.placements).toHaveLength(4);
    expect(run.residue).toEqual(EMPTY_RESIDUE);
  });

  it('spielt als KI-Platz mit (CHAOS-180): schwer punktet besser als leicht', async () => {
    const run = await runMinigameHeadless(halloBaukasten, {
      players: 2,
      seed: 5,
      bots: [
        { slot: 1, strength: 1 },
        { slot: 2, strength: 0 },
      ],
    });
    const score = (slot: number) =>
      run.outcome?.result.placements.find((p) => p.slot === slot)?.score ?? 0;
    expect(run.outcome?.forced).toBe(false);
    expect(score(1)).toBeGreaterThan(0);
    expect(score(1)).toBeGreaterThanOrEqual(score(2));
    expect(run.residue).toEqual(EMPTY_RESIDUE);
  });

  // 300 Zeilen bis CHAOS-180; der KI-Platz (`createBot`, Pflicht für die Rotation) kostet 5.
  it('bleibt ein kurzes Muster: Steckbrief, Logik und Ansicht zusammen ≤ 305 Zeilen', () => {
    const lines = ['info.ts', 'logic.ts', 'index.ts']
      .map((file) =>
        readFileSync(new URL(file, import.meta.url), 'utf8')
          .trimEnd()
          .split('\n'),
      )
      .reduce((sum, file) => sum + file.length, 0);
    expect(lines).toBeLessThanOrEqual(305);
  });
});
