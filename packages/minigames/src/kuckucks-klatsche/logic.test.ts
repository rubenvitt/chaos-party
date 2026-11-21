import { createMinigameRng, type Slot } from '@chaos-party/minigame-sdk';
import { describe, expect, it } from 'vitest';
import { KuckuckDoorWatcher } from './bot.ts';
import { kuckucksKlatscheHighlights } from './highlights.ts';
import { KUCKUCK_RULES, KuckucksKlatscheLogic, type Clapper, type KuckuckRules } from './logic.ts';

const STEP = 1 / 60;

function game(
  slots: readonly Slot[] = [1, 2],
  rules: Partial<KuckuckRules> = {},
  seed = 3,
  durationMs = 30_000,
): KuckucksKlatscheLogic {
  return new KuckucksKlatscheLogic(slots, createMinigameRng(seed), durationMs, {
    ...KUCKUCK_RULES,
    ...rules,
  });
}

/** Schritte, bis `slot`s Tür in `phase` ist (oder das Spiel endet). */
function until(logic: KuckucksKlatscheLogic, slot: Slot, phase: string, guard = 3000): void {
  for (let index = 0; index < guard && !logic.ended; index++) {
    if (logic.door(slot)?.phase === phase) return;
    logic.step(STEP);
  }
  throw new Error(`Tür ${String(slot)} erreichte ${phase} nicht`);
}

/** Teilnehmer `slot` (muss existieren). */
function clapperOf(logic: KuckucksKlatscheLogic, slot: Slot): Clapper {
  const clapper = logic.clapper(slot);
  if (!clapper) throw new Error(`Slot ${String(slot)} fehlt`);
  return clapper;
}

/** Tür von `slot` bleibt zu (Testaufbau: eigene Tür stört nicht). */
function keepClosed(logic: KuckucksKlatscheLogic, slot: Slot): void {
  const door = logic.door(slot);
  if (door) door.nextT = 1e9;
}

/** Nur Kuckucke (keine Finten), damit Tests gezielt sind. */
const NO_FINTE = { finteChance: 0 } as const;
const ONLY_FINTE = { finteChance: 1 } as const;

describe('Kuckucks-Klatsche: Logik', () => {
  it('Türen laufen zu → rappeln → offen → Gong → entwischt → zu', () => {
    const logic = game([1], NO_FINTE);
    const seen: string[] = [];
    while (!logic.ended && seen.length < 5) {
      logic.step(STEP);
      for (const event of logic.drainEvents()) {
        if (event.type !== 'finale') seen.push(event.type);
      }
    }
    expect(seen).toEqual(['rattle', 'open', 'gong', 'escape', 'rattle']);
    expect(logic.clapper(1)?.escaped).toBe(1);
  });

  it('eigener Kuckuck im Fenster: 2 Punkte, nach dem Gong nur 1', () => {
    const logic = game([1], NO_FINTE);
    until(logic, 1, 'own');
    logic.press(1);
    expect(logic.clapper(1)?.score).toBe(KUCKUCK_RULES.ownPoints);
    expect(logic.door(1)?.phase).toBe('closed');
    until(logic, 1, 'free');
    logic.press(1);
    expect(logic.clapper(1)?.score).toBe(KUCKUCK_RULES.ownPoints + KUCKUCK_RULES.latePoints);
    expect(logic.clapper(1)).toMatchObject({ own: 1, late: 1 });
  });

  it('fremder Kuckuck: vor dem Gong Leerklatscher, danach klauen', () => {
    const logic = game([1, 2], NO_FINTE);
    keepClosed(logic, 1);
    until(logic, 2, 'own');
    logic.press(1);
    expect(logic.clapper(1)).toMatchObject({ score: 0, empty: 1 });
    expect(logic.isDizzy(1)).toBe(true);
    // Benommenheit (1,0 s) ist länger als das eigene Fenster von 2 (0,8 s): erst abwarten.
    until(logic, 2, 'free');
    logic.press(1);
    expect(logic.clapper(1)?.steals).toBe(0);
    while (logic.isDizzy(1)) logic.step(STEP);
    expect(logic.door(2)?.phase).toBe('free');
    logic.press(1);
    expect(logic.clapper(1)?.steals).toBe(1);
    expect(logic.clapper(1)?.score).toBe(KUCKUCK_RULES.stealPoints);
    expect(logic.clapper(2)?.stolen).toBe(1);
    expect(logic.thefts.get(1)?.get(2)).toBe(1);
    expect(logic.door(2)?.phase).toBe('closed');
  });

  it('Klau zuerst bei der ältesten freigegebenen Tür; ohne Klau-Regel gar nicht', () => {
    const steal = game([1, 2, 3], NO_FINTE, 9);
    keepClosed(steal, 1);
    until(steal, 2, 'free');
    until(steal, 3, 'free');
    expect(steal.door(2)?.phase).toBe('free');
    const older = (steal.door(2)?.phaseT ?? 0) <= (steal.door(3)?.phaseT ?? 0) ? 2 : 3;
    steal.press(1);
    expect(steal.thefts.get(1)?.get(older)).toBe(1);
    const honest = game([1, 2], { ...NO_FINTE, steal: 0 });
    keepClosed(honest, 1);
    until(honest, 2, 'free');
    honest.press(1);
    expect(honest.clapper(1)).toMatchObject({ steals: 0, empty: 1 });
    // Die Besitzerin selbst darf nach dem Gong noch (für 1 Punkt).
    honest.press(2);
    expect(honest.clapper(2)).toMatchObject({ late: 1, score: KUCKUCK_RULES.latePoints });
  });

  it('Finte: Minuspunkt (nie unter 0), Benommenheit, Tür geht zu', () => {
    const logic = game([1], ONLY_FINTE);
    until(logic, 1, 'finte');
    logic.press(1);
    expect(logic.clapper(1)).toMatchObject({ score: 0, fintes: 1 });
    expect(logic.isDizzy(1)).toBe(true);
    expect(logic.door(1)?.phase).toBe('closed');
    const events = logic.drainEvents();
    expect(events.find((event) => event.type === 'finte')).toMatchObject({ lost: 0 });
    // Mit Punkten auf dem Konto kostet die Finte einen Punkt.
    const mixed = game([1], NO_FINTE);
    until(mixed, 1, 'own');
    mixed.press(1);
    const withFinte = new KuckucksKlatscheLogic([1], createMinigameRng(1), 30_000, {
      ...KUCKUCK_RULES,
      finteChance: 1,
    });
    clapperOf(withFinte, 1).score = 3;
    until(withFinte, 1, 'finte');
    withFinte.press(1);
    expect(withFinte.clapper(1)?.score).toBe(3 - KUCKUCK_RULES.fintePenalty);
  });

  it('benommen zählt kein Druck, danach wieder', () => {
    const logic = game([1], NO_FINTE);
    logic.press(1); // Tür zu → Leerklatscher
    expect(logic.isDizzy(1)).toBe(true);
    until(logic, 1, 'own');
    const dizzy = logic.isDizzy(1);
    logic.press(1);
    expect(logic.clapper(1)?.own).toBe(dizzy ? 0 : 1);
    expect(logic.clapper(1)?.presses).toBe(2);
  });

  it('Mitternacht in den letzten 8 s, Ende genau am Zeitlimit, danach keine Wirkung', () => {
    const logic = game([1, 2, 3, 4], {}, 4, 12_000);
    let finaleAt = -1;
    while (!logic.ended) {
      logic.step(STEP);
      if (finaleAt < 0 && logic.drainEvents().some((event) => event.type === 'finale')) {
        finaleAt = logic.t;
      }
    }
    expect(finaleAt).toBeCloseTo(12 - KUCKUCK_RULES.finaleS, 1);
    expect(logic.t).toBe(12);
    expect(logic.remainingS).toBe(0);
    const before = logic.clappers.map((clapper) => clapper.presses);
    logic.press(1);
    expect(logic.clappers.map((clapper) => clapper.presses)).toEqual(before);
  });

  it('Mitternacht öffnet die Türen öfter', () => {
    const openings = (factor: number) => {
      let total = 0;
      for (let seed = 1; seed <= 20; seed++) {
        const logic = game([1, 2, 3, 4], { finaleWaitFactor: factor }, seed);
        while (!logic.ended) logic.step(STEP);
        total += logic.doors.reduce((sum, door) => sum + door.openings, 0);
      }
      return total;
    };
    expect(openings(0.5)).toBeGreaterThan(openings(1) * 1.08);
  });

  it('ist deterministisch je Seed und unterschiedlich zwischen Seeds', () => {
    const run = (seed: number) => {
      const logic = game([1, 2, 3], {}, seed);
      const trace: string[] = [];
      let frame = 0;
      while (!logic.ended) {
        logic.step(STEP);
        if (frame++ % 23 === 0) logic.press(((frame % 3) + 1) as Slot);
        for (const event of logic.drainEvents()) trace.push(event.type);
      }
      return { trace, scores: logic.clappers.map((clapper) => clapper.score) };
    };
    expect(run(11)).toEqual(run(11));
    expect(run(11).trace).not.toEqual(run(12).trace);
  });

  it('jede Tür öffnet in 30 s ohne Drücke etwa 8–16-mal (genug zu tun, egal wie viele spielen)', () => {
    for (const slots of [
      [1, 2],
      [1, 2, 3, 4],
    ] as const) {
      const logic = game(slots, {}, 21);
      while (!logic.ended) logic.step(STEP);
      for (const door of logic.doors) {
        expect(door.openings).toBeGreaterThanOrEqual(8);
        expect(door.openings).toBeLessThanOrEqual(16);
      }
    }
  });
});

describe('Kuckucks-Klatsche: Höhepunkte', () => {
  const names = new Map<Slot, string>([
    [1, 'Blau'],
    [2, 'Orange'],
    [3, 'Grün'],
  ]);

  it('nennt Spitzenklatscher, Klau-Duell, Finten und den letzten Kuckuck (≤ 4 Zeilen ≤ 64)', () => {
    const logic = game([1, 2, 3]);
    Object.assign(clapperOf(logic, 1), { own: 7, fintes: 3 });
    Object.assign(clapperOf(logic, 2), { own: 4, steals: 3 });
    Object.assign(clapperOf(logic, 3), { own: 2, escaped: 4 });
    logic.thefts.set(2, new Map<Slot, number>([[1, 3]]));
    logic.lastScorer = 3;
    const lines = kuckucksKlatscheHighlights(logic, names);
    expect(lines[0]).toBe('Blau klatscht 7 eigene Kuckucke rechtzeitig.');
    expect(lines[1]).toBe('Orange klaut Blau 3 Kuckucke.');
    expect(lines[2]).toBe('Blau fällt 3× auf eine Finte rein.');
    expect(lines[3]).toBe('Bei Grün entwischen 4 Kuckucke.');
    expect(lines).toHaveLength(4);
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(64);
  });

  it('bei Gleichstand keine Spitzenzeile; einzelner Klau mit eigener Formulierung', () => {
    const logic = game([1, 2]);
    Object.assign(clapperOf(logic, 1), { own: 5, steals: 1 });
    Object.assign(clapperOf(logic, 2), { own: 5 });
    logic.thefts.set(1, new Map<Slot, number>([[2, 1]]));
    expect(kuckucksKlatscheHighlights(logic, names)).toEqual([
      'Blau klaut einen Kuckuck nach dem Gong.',
    ]);
  });
});

describe('KI-Bot sieht nur die Türen (CHAOS-180)', () => {
  it('leitet Rappeln, Öffnen und Gong aus den Türen ab, genau wie die Logik sie meldet', () => {
    const logic = new KuckucksKlatscheLogic([1, 2, 3, 4], createMinigameRng(12), 30_000);
    const watcher = new KuckuckDoorWatcher();
    const visible = new Set(['rattle', 'open', 'gong']);
    let compared = 0;
    while (!logic.ended) {
      logic.step(1 / 60);
      const fromLogic = logic.drainEvents().filter((event) => visible.has(event.type));
      const seen = watcher.look(logic);
      const key = (event: { type: string; door?: number }) => `${event.type}:${event.door}`;
      expect(seen.map(key).sort()).toEqual(fromLogic.map(key).sort());
      compared += seen.length;
    }
    expect(compared).toBeGreaterThan(50);
  });
});
