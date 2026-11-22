/**
 * Headless-Bühne mit verteiltem Aufbau (CHAOS-141): Der Aufbau läuft über mehrere Bilder,
 * `bodies()` zeigt erst die fertige Szene, und eine während des Aufbaus entsorgte Bühne baut
 * nicht weiter und meldet keinen Fehler.
 */
import { minigameProps } from '../../../packages/assets/src/props.ts';
import { getMinigameModule, ROTATION } from '@chaos-party/minigames';
import { loadHavokForNode } from '@chaos-party/minigame-sdk/testing';
import type { MinigamePlayer, PrepareThrottle } from '@chaos-party/minigame-sdk/babylon';
import { describe, expect, it } from 'vitest';
import {
  createHeadlessStage,
  FRAME_RESERVE_MS,
  PREPARE_BUDGET_MAX_MS,
  PREPARE_URGENT_MAX_MS,
  PREPARE_BUDGET_MS,
  PREPARE_URGENT_MS,
  prepareBudgetMs,
  stageUrgentFor,
} from '../src/stage.ts';
import { minigameView } from '../../host/src/minigame/testViews.ts';

const PLAYERS: MinigamePlayer[] = [
  { slot: 1, name: 'Anna', color: '#0072B2', symbol: '●', character: 'raccoon' },
  { slot: 2, name: 'Ben', color: '#E69F00', symbol: '▲', character: 'sock' },
];

/** Bilder von Hand; das Budget ist jedes Mal sofort verbraucht (ein Bauschritt je Bild). */
function manualFrames() {
  const waiting: (() => void)[] = [];
  let clock = 0;
  const pacing: PrepareThrottle = {
    budgetMs: 0,
    now: () => (clock += 1),
    nextFrame: () =>
      new Promise((resolve) => {
        waiting.push(resolve);
      }),
  };
  const frame = async () => {
    for (const resolve of waiting.splice(0)) resolve();
    await new Promise((resolve) => setImmediate(resolve));
  };
  return { pacing, frame };
}

function wackelturm() {
  const module = getMinigameModule('wackelturm');
  if (!module) throw new Error('wackelturm fehlt');
  return module;
}

describe('Headless-Bühne: verteilter Aufbau (CHAOS-141)', () => {
  it('baut über viele Bilder und zeigt Körper erst, wenn alles steht', async () => {
    const frames = manualFrames();
    const logs: string[] = [];
    const stage = createHeadlessStage({
      module: wackelturm(),
      players: PLAYERS,
      seed: 7,
      timeLimitMs: 5_000,
      havok: null,
      onResult: () => undefined,
      log: (line) => logs.push(line),
      pacing: frames.pacing,
    });
    stage.start();
    await frames.frame();
    expect(stage.ready).toBe(false);
    expect(stage.bodies()).toEqual([]);
    expect(stage.runner.state).toBe('preparing');

    let count = 1;
    while (!stage.ready && count < 2_000) {
      await frames.frame();
      count++;
    }
    expect(stage.ready).toBe(true);
    expect(count).toBeGreaterThan(20);
    // Start war angefordert: läuft, sobald der Aufbau fertig ist.
    expect(stage.runner.state).toBe('running');
    stage.advance(1 / 60);
    expect(stage.bodies().length).toBeGreaterThan(50);
    stage.dispose();
    expect(logs).toEqual([]);
  });

  it('entsorgt mitten im Aufbau ohne Fehler und baut nicht weiter', async () => {
    const frames = manualFrames();
    const logs: string[] = [];
    const stage = createHeadlessStage({
      module: wackelturm(),
      players: PLAYERS,
      seed: 7,
      timeLimitMs: 5_000,
      havok: null,
      onResult: () => undefined,
      log: (line) => logs.push(line),
      pacing: frames.pacing,
    });
    for (let index = 0; index < 5; index++) await frames.frame();
    stage.dispose();
    for (let index = 0; index < 5; index++) await frames.frame();
    expect(stage.ready).toBe(false);
    expect(stage.runner.state).toBe('disposed');
    expect(stage.bodies()).toEqual([]);
    expect(logs).toEqual([]);
  });
});

describe('Headless-Bühne: Darstellung für Swift (CHAOS-144)', () => {
  const FOUR: MinigamePlayer[] = [
    ...PLAYERS,
    { slot: 3, name: 'Cem', color: '#009E73', symbol: '■', character: 'robot' },
    { slot: 4, name: 'Dora', color: '#CC79A7', symbol: '★', character: 'cactus' },
  ];

  it.each(ROTATION)('%s liefert Kamera, Kulisse, Figuren, Rollen und Geometrie', async (id) => {
    const module = getMinigameModule(id);
    if (!module) throw new Error(id);
    const logs: string[] = [];
    const stage = createHeadlessStage({
      module,
      players: FOUR,
      seed: 7,
      timeLimitMs: 20_000,
      havok: module.info.physics ? await loadHavokForNode() : null,
      onResult: () => undefined,
      log: (line) => logs.push(line),
    });
    for (let index = 0; index < 50 && !stage.ready; index++) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    expect(stage.ready).toBe(true);
    stage.start();
    for (let index = 0; index < 120; index++) stage.advance(1 / 60);

    const camera = stage.camera();
    expect(camera?.fov).toBeGreaterThan(0);
    expect(stage.backdrop?.halfX).toBeGreaterThan(0);

    const figures = stage.figures();
    expect(figures.map((figure) => figure.slot)).toEqual([1, 2, 3, 4]);
    expect(figures.map((figure) => figure.character)).toEqual([
      'raccoon',
      'sock',
      'robot',
      'cactus',
    ]);

    const bodies = stage.bodies();
    expect(bodies.some((body) => body.role === 'figur')).toBe(false);
    expect(bodies.some((body) => body.role !== undefined)).toBe(true);
    const geometry = stage.takeGeometry(Number.POSITIVE_INFINITY);
    const ids = new Set(geometry.map((entry) => entry.id));
    expect(ids.size).toBe(stage.geometryTotal);
    // Jeder Körper mit Geometrie verweist auf einen ausgelieferten Eintrag.
    for (const body of bodies) if (body.mesh) expect(ids.has(body.mesh), body.id).toBe(true);
    expect(bodies.filter((body) => body.mesh).length).toBeGreaterThan(bodies.length * 0.9);
    // Ein zweiter Abruf liefert nichts doppelt.
    expect(stage.takeGeometry(Number.POSITIVE_INFINITY)).toEqual([]);

    // Requisiten (CHAOS-237): nur aus den Sets des Spiels; Grundkörper verweisen auf ihr Requisit.
    const props = stage.props();
    const allowed = new Set<string>(minigameProps(id));
    for (const prop of props) expect(allowed.has(prop.prop), `${id}: ${prop.prop}`).toBe(true);
    const propIds = new Set(props.map((prop) => prop.id));
    expect(propIds.size).toBe(props.length);
    for (const body of bodies) if (body.prop) expect(propIds.has(body.prop), body.id).toBe(true);
    if (allowed.size > 0) expect(props.length, id).toBeGreaterThan(0);

    stage.celebrate([
      { slot: 1, place: 1, score: 3 },
      { slot: 2, place: 2, score: 1 },
      { slot: 3, place: 3, score: 0 },
      { slot: 4, place: 3, score: 0 },
    ]);
    const after = stage.figures();
    expect(after.map((figure) => figure.anim)).toEqual(['cheer', 'sad', 'sad', 'sad']);
    expect(stage.effects(0).some((effect) => effect.kind === 'confetti')).toBe(true);
    stage.dispose();
    expect(logs).toEqual([]);
  });
});

describe('Headless-Bühne: Requisiten für Swift (CHAOS-237)', () => {
  it('Toaster-Timing: je Slot Toaster mit Akzent und Toast mit Zustand', async () => {
    const module = getMinigameModule('toaster-timing');
    if (!module) throw new Error('toaster-timing fehlt');
    const stage = createHeadlessStage({
      module,
      players: PLAYERS,
      seed: 7,
      timeLimitMs: 20_000,
      havok: null,
      onResult: () => undefined,
      log: () => undefined,
    });
    for (let index = 0; index < 50 && !stage.ready; index++) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    stage.start();
    for (let index = 0; index < 60; index++) stage.advance(1 / 60);
    const props = stage.props();
    const toasters = props.filter((prop) => prop.prop === 'toaster');
    expect(toasters.map((prop) => [prop.role, prop.key, prop.accent])).toEqual([
      ['toaster', '1', '#0072B2'],
      ['toaster', '2', '#E69F00'],
    ]);
    // Wurzel am Boden, Spielgröße, Vorderseite zur Kamera (Drehung um Y um π).
    expect(toasters[0]?.pos[1]).toBe(0);
    expect(toasters[0]?.scale.map((v) => Math.round(Math.abs(v) * 100) / 100)).toEqual([
      1.75, 1.75, 1.75,
    ]);
    expect(Math.abs(toasters[0]?.rot[1] ?? 0)).toBeCloseTo(1, 3);
    const toasts = props.filter((prop) => prop.prop === 'toast');
    expect(toasts).toHaveLength(2);
    for (const toast of toasts) expect(toast.state).toMatch(/^#[0-9a-f]{6}$/i);
    // Grundkörper des Toasters gehören zu seinem Requisit (Swift blendet sie mit USDZ aus).
    const own = stage.bodies().filter((body) => body.prop === toasters[0]?.id);
    expect(own.length).toBeGreaterThan(0);
    expect(own.every((body) => body.role === 'toaster' && body.key === '1')).toBe(true);
    stage.dispose();
  });
});

describe('Aufbau-Budget je Tick (CHAOS-205)', () => {
  it('bleibt bei 60 Hz und schneller bei PREPARE_BUDGET_MS', () => {
    expect(prepareBudgetMs(0)).toBe(PREPARE_BUDGET_MS);
    expect(prepareBudgetMs(1000 / 120)).toBe(PREPARE_BUDGET_MS);
    expect(prepareBudgetMs(1000 / 60)).toBe(PREPARE_BUDGET_MS);
    expect(prepareBudgetMs(Number.NaN)).toBe(PREPARE_BUDGET_MS);
  });

  it('wächst mit der Tick-Dauer (gleicher Anteil wie bei 60 Hz), gedeckelt', () => {
    expect(prepareBudgetMs(1000 / 30)).toBeCloseTo(2 * PREPARE_BUDGET_MS);
    expect(prepareBudgetMs(100)).toBeCloseTo(12);
    expect(prepareBudgetMs(1250)).toBe(PREPARE_BUDGET_MAX_MS);
  });

  it('gibt bei knapper Bühne die halbe Tick-Dauer, gedeckelt (CHAOS-227)', () => {
    expect(prepareBudgetMs(1000 / 30, true)).toBeCloseTo(1000 / 60);
    // 10 Hz: halbe Tick-Dauer, damit die Bühne in 3 s Anleitung fertig wird (CHAOS-214).
    expect(prepareBudgetMs(100, true)).toBe(50);
    expect(prepareBudgetMs(1250, true)).toBe(PREPARE_URGENT_MAX_MS);
    expect(PREPARE_URGENT_MAX_MS).toBeGreaterThan(PREPARE_BUDGET_MAX_MS);
  });

  it('lässt bei knapper Bühne FRAME_RESERVE_MS des Bildes frei (CHAOS-209)', () => {
    expect(prepareBudgetMs(1000 / 60, true)).toBeCloseTo(1000 / 60 - FRAME_RESERVE_MS);
    expect(prepareBudgetMs(0, true)).toBeCloseTo(1000 / 60 - FRAME_RESERVE_MS);
    expect(prepareBudgetMs(1000 / 60, true)).toBeGreaterThan(prepareBudgetMs(1000 / 60));
    expect(prepareBudgetMs(1000 / 40, true)).toBeCloseTo(1000 / 80);
  });
});

describe('Knappe Bühne (CHAOS-205, Bereitschaft CHAOS-214)', () => {
  it('feste Anleitung: knapp erst in den letzten PREPARE_URGENT_MS', () => {
    const intro = minigameView('minigame-intro', {}, { remainingMs: 6000 });
    expect(stageUrgentFor(intro, 0, 0)).toBe(false);
    expect(stageUrgentFor(intro, 0, 6000 - PREPARE_URGENT_MS - 1)).toBe(false);
    expect(stageUrgentFor(intro, 0, 6000 - PREPARE_URGENT_MS)).toBe(true);
    // In der Pause läuft die Anleitung nicht ab.
    expect(stageUrgentFor({ ...intro, paused: true }, 0, 6000)).toBe(false);
  });

  it('Anleitung wartet auf „Bereit“: von Anfang an knapp (Ende schon nach der Mindestzeit möglich)', () => {
    const waiting = minigameView('minigame-intro', { ready: [] }, { remainingMs: 60_000 });
    expect(stageUrgentFor(waiting, 0, 0)).toBe(true);
  });

  it('Spiel läuft: knapp; Ergebnis: nicht', () => {
    expect(stageUrgentFor(minigameView('minigame-play', {}, { remainingMs: 9000 }), 0, 0)).toBe(
      true,
    );
    expect(stageUrgentFor(minigameView('minigame-results'), 0, 0)).toBe(false);
  });
});
