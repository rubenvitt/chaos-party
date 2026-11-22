import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { createMinigameRng, type Slot } from '@chaos-party/minigame-sdk';
import type {
  CharacterHandle,
  LookArea,
  MinigameContext,
  MinigameLook,
} from '@chaos-party/minigame-sdk/babylon';
import { visualOf } from '@chaos-party/minigame-sdk/babylon';
import {
  EMPTY_RESIDUE,
  createHeadlessScene,
  createRecordingFx,
  createTestCharacters,
  sceneResidue,
  testPlayers,
} from '@chaos-party/minigame-sdk/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { arenaLayout, type ArenaSpec } from '../arena.ts';
import { KAMERAS, ORTE } from '../steckbrief.ts';
import { PLACES, buildArena, mix } from './arena.ts';
import { createSlotBadge, createSlotRing, createStunStars, symbolMesh } from './badges.ts';
import { createCamera } from './camera.ts';
import {
  AnimationSync,
  SlotFigure,
  celebrate,
  celebrateFigures,
  pickAnimation,
} from './figures.ts';
import { NodePool } from './pool.ts';
import { MinigameStage } from './stage.ts';

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

function context(look?: MinigameLook, testMode = true): MinigameContext {
  const headless = createHeadlessScene();
  cleanups.push(() => {
    headless.dispose();
  });
  return {
    scene: headless.scene,
    players: testPlayers(4),
    seed: 1,
    rng: createMinigameRng(1),
    timeLimitMs: 10_000,
    fx: createRecordingFx(),
    characters: createTestCharacters(),
    testMode,
    ...(look ? { look } : {}),
    pace: () => Promise.resolve(),
  };
}

/** Look-Attrappe: Materialien wie ohne Look, merkt sich die Kulisse. */
function fakeLook(ctx: () => MinigameContext): MinigameLook & { areas: LookArea[] } {
  const areas: LookArea[] = [];
  return {
    areas,
    material: (hex) => {
      const material = new StandardMaterial(`look-${hex}`, ctx().scene);
      return material;
    },
    backdrop: (area) => {
      areas.push(area);
    },
  };
}

const SPECS: readonly ArenaSpec[] = [
  { form: 'rund', radius: 5 },
  { form: 'eckig', halfX: 6, halfZ: 4 },
  { form: 'bahnen', lanes: 4, laneWidth: 2, length: 14 },
  { form: 'insel', radius: 4.5 },
  { form: 'insel', halfX: 3, halfZ: 2.5 },
  { form: 'eigenbereiche', zoneHalf: 2.2, gap: 0.8 },
];

describe('Bühne', () => {
  it('teilt gleiche Materialien und räumt alles weg', () => {
    const ctx = context();
    const stage = new MinigameStage(ctx, 'test');
    const a = stage.material('#ff0000', { emissive: 0.2 });
    expect(stage.material('#ff0000', { emissive: 0.2 })).toBe(a);
    expect(stage.material('#ff0000', { emissive: 0.3 })).not.toBe(a);
    expect(stage.material('#00ff00', { alpha: 0.5 }).alpha).toBe(0.5);
    expect(stage.name('ring', 2)).toBe('test-ring-2');
    expect(stage.backdrop({ halfX: 3, halfZ: 3 })).toBe(false);
    expect(ctx.scene.lights).toHaveLength(2);
    stage.dispose();
    stage.dispose();
    expect(sceneResidue(ctx.scene)).toEqual(EMPTY_RESIDUE);
  });

  it('nutzt mit Look dessen Materialien und Kulisse', () => {
    let ctx: MinigameContext | null = null;
    const look = fakeLook(() => {
      if (!ctx) throw new Error('kein ctx');
      return ctx;
    });
    ctx = context(look);
    const stage = new MinigameStage(ctx, 'test');
    expect(stage.material('#123456').name).toBe('look-#123456');
    expect(stage.backdrop({ halfX: 2, halfZ: 3 })).toBe(true);
    expect(look.areas).toEqual([{ halfX: 2, halfZ: 3 }]);
    expect(ctx.scene.lights).toHaveLength(0);
    stage.dispose();
    expect(sceneResidue(ctx.scene)).toEqual(EMPTY_RESIDUE);
  });
});

describe('Arena-Vorlagen', () => {
  it.each(SPECS.map((spec) => [spec.form, spec] as const))(
    '%s baut sich an jedem Ort und hinterlässt nichts',
    async (_form, spec) => {
      for (const ort of ORTE) {
        const ctx = context();
        const stage = new MinigameStage(ctx, 'arena');
        const layout = arenaLayout(spec);
        const view = await buildArena(stage, layout, { ort, players: ctx.players });
        expect(view.palette).toBe(PLACES[ort]);
        expect(ctx.scene.meshes.length).toBeGreaterThan(1);
        if (spec.form === 'bahnen') expect(view.tiles).toHaveLength(4);
        if (spec.form === 'eigenbereiche') expect(view.tiles).toHaveLength(4);
        // Kulisse ist nicht gekennzeichnet (ein nativer Host darf sie ersetzen).
        expect(ctx.scene.meshes.every((mesh) => visualOf(mesh) === undefined)).toBe(true);
        stage.dispose();
        expect(sceneResidue(ctx.scene)).toEqual(EMPTY_RESIDUE);
      }
    },
  );

  it('gibt dem Look die freie Fläche und die Unterlage des Orts', async () => {
    let ctx: MinigameContext | null = null;
    const look = fakeLook(() => {
      if (!ctx) throw new Error('kein ctx');
      return ctx;
    });
    ctx = context(look);
    const stage = new MinigameStage(ctx, 'arena');
    await buildArena(stage, arenaLayout({ form: 'insel', radius: 4 }), { ort: 'teich' });
    expect(look.areas).toEqual([{ halfX: 5.5, halfZ: 5.5, groundY: 0, surface: 'wiese' }]);
    stage.dispose();
  });

  it('mischt Farben', () => {
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mix('#ff0000', '#0000ff', 0)).toBe('#ff0000');
  });
});

describe('Kamera-Vorlagen', () => {
  it.each(KAMERAS)('%s wird aktiv und mit der Bühne entsorgt', (kind) => {
    const ctx = context(undefined, false);
    const stage = new MinigameStage(ctx, 'kamera');
    const layout = arenaLayout({ form: 'eckig', halfX: 6, halfZ: 4 });
    const camera = createCamera(stage, kind, layout);
    expect(ctx.scene.activeCamera).toBe(camera.camera);
    const before = camera.camera.target.clone();
    camera.follow([{ x: 4, z: 2 }], 1 / 60);
    if (kind === 'verfolger') {
      expect(camera.camera.target.x).toBeGreaterThan(before.x);
    } else {
      expect(camera.camera.target.equals(before)).toBe(true);
    }
    stage.dispose();
    expect(sceneResidue(ctx.scene)).toEqual(EMPTY_RESIDUE);
  });

  it('Draufsicht steiler als Schräg, Schräg steiler als Seite; Verfolger springt im Testmodus', () => {
    const ctx = context();
    const stage = new MinigameStage(ctx, 'kamera');
    const layout = arenaLayout({ form: 'rund', radius: 5 });
    const top = createCamera(stage, 'draufsicht', layout).camera.beta;
    const tilt = createCamera(stage, 'schraeg', layout).camera.beta;
    const side = createCamera(stage, 'seite', layout, { fromSide: true });
    expect(top).toBeLessThan(tilt);
    expect(tilt).toBeLessThan(side.camera.beta);
    expect(side.camera.alpha).toBeCloseTo(Math.PI);
    const follow = createCamera(stage, 'verfolger', layout);
    follow.follow(
      [
        { x: 2, z: -1 },
        { x: 4, z: 1 },
      ],
      1 / 60,
    );
    expect(follow.camera.target.x).toBeCloseTo(3);
    expect(follow.camera.target.z).toBeCloseTo(0);
    const fixed = createCamera(stage, 'fest', layout, {
      position: { x: 0, y: 5, z: -10 },
      target: { x: 0, y: 0, z: 0 },
    });
    expect(fixed.camera.position.y).toBeCloseTo(5);
    stage.dispose();
    expect(sceneResidue(ctx.scene)).toEqual(EMPTY_RESIDUE);
  });
});

describe('Slot-Abzeichen und Figuren', () => {
  it('Abzeichen, Ring und Sterne tragen Rolle und Slot', async () => {
    const ctx = context();
    const stage = new MinigameStage(ctx, 'figur');
    const player = ctx.players[2];
    if (!player) throw new Error('kein Spieler');
    const badge = createSlotBadge(stage, player);
    const ring = await createSlotRing(stage, player, 0.8, 'fangring');
    const stars = createStunStars(stage, player);
    expect(visualOf(badge)).toEqual({ role: 'abzeichen', key: '3' });
    expect(visualOf(ring)).toEqual({ role: 'fangring', key: '3' });
    expect(visualOf(stars)).toEqual({ role: 'sterne', key: '3' });
    expect(stars.isEnabled()).toBe(false);
    for (const symbol of ['●', '▲', '■', '★']) {
      const mesh = stage.track(symbolMesh(ctx.scene, `s-${symbol}`, symbol));
      expect(mesh.getTotalVertices()).toBeGreaterThan(3);
    }
    stage.dispose();
    expect(sceneResidue(ctx.scene)).toEqual(EMPTY_RESIDUE);
  });

  it('wählt Animationen nach Zustand und spielt nur Wechsel; Sieger jubeln', () => {
    expect(pickAnimation({ stunned: true, dashing: true, moving: true })).toBe('fall');
    expect(pickAnimation({ stunned: false, dashing: true, moving: true })).toBe('jump');
    expect(pickAnimation({ stunned: false, moving: true })).toBe('run');
    expect(pickAnimation({ stunned: false, moving: false })).toBe('idle');
    const played: string[] = [];
    const handle = (slot: number): CharacterHandle => ({
      root: null as never,
      id: 'sock',
      play: (animation) => {
        played.push(`${String(slot)}:${animation}`);
      },
      dispose: () => undefined,
    });
    const one = new AnimationSync(handle(1));
    const two = new AnimationSync(handle(2));
    one.play('run');
    one.play('run');
    expect(played).toEqual(['1:run']);
    const winners = celebrate(
      [
        { slot: 1, place: 1, score: 3 },
        { slot: 2, place: 2, score: 1 },
        { slot: 3, place: 3, score: 0 },
      ],
      new Map<Slot, AnimationSync>([
        [1, one],
        [2, two],
      ]),
    );
    expect(winners).toEqual([1]);
    expect(played).toEqual(['1:run', '1:cheer', '2:sad']);
  });
});

describe('Bau-Helfer, Pool und Spielerfigur', () => {
  it('node/add kennzeichnen, hängen an und räumen auf', async () => {
    const ctx = context();
    const stage = new MinigameStage(ctx, 'bau');
    const root = stage.node('ding', 'kiste');
    expect(visualOf(root)).toEqual({ role: 'kiste', key: '0' });
    expect(visualOf(stage.node('leer'))).toBeUndefined();
    const box = stage.add(symbolMesh(ctx.scene, 'bau-symbol', '■'), '#336699', {
      emissive: 0.2,
      parent: root,
    });
    expect(box.parent).toBe(root);
    expect(box.material).toBe(stage.material('#336699', { emissive: 0.2 }));
    const pool = new NodePool(() => stage.node('pool', 'blatt'));
    await pool.warm(stage, 2);
    const first = pool.acquire(7);
    expect(first.isEnabled()).toBe(true);
    expect(pool.acquire(7)).toBe(first);
    expect(pool.get(7)).toBe(first);
    expect(pool.active).toBe(1);
    pool.release(7);
    pool.release(7);
    expect(first.isEnabled()).toBe(false);
    pool.acquire(1);
    pool.acquire(2);
    pool.acquire(3);
    expect(pool.active).toBe(3);
    pool.releaseAll();
    expect(pool.active).toBe(0);
    pool.clear();
    stage.dispose();
    expect(sceneResidue(ctx.scene)).toEqual(EMPTY_RESIDUE);
  });

  it('SlotFigure setzt Figur und Kennzeichen, zeigt Benommenheit und jubelt', async () => {
    const ctx = context();
    const stage = new MinigameStage(ctx, 'figur');
    const [one, two] = ctx.players;
    if (!one || !two) throw new Error('keine Spieler');
    const a = await SlotFigure.create(stage, one, { ringRadius: 0.8 });
    const b = await SlotFigure.create(stage, two, { badgeHeight: 3 });
    expect(b.ring).toBeNull();
    a.place(1, 2, 0.5, 0.25);
    expect(a.root.position.asArray()).toEqual([1, 0.25, 2]);
    expect(a.ring?.position.y).toBeCloseTo(0.3);
    expect(a.badge.position.y).toBeCloseTo(2.5);
    a.show({ stunned: true, moving: false }, 0.1);
    expect(a.stars.isEnabled()).toBe(true);
    expect(a.anim.current).toBe('fall');
    a.show({ stunned: true, moving: false }, 0.1, true);
    expect(a.stars.isEnabled()).toBe(false);
    b.place(0, 0, 0);
    expect(b.badge.position.y).toBe(3);
    expect(
      celebrateFigures(
        [
          { slot: 2, place: 1, score: 2 },
          { slot: 1, place: 2, score: 1 },
        ],
        [a, b],
      ),
    ).toEqual([2]);
    expect(b.anim.current).toBe('cheer');
    a.dispose();
    b.dispose();
    stage.dispose();
    expect(sceneResidue(ctx.scene)).toEqual(EMPTY_RESIDUE);
  });
});
