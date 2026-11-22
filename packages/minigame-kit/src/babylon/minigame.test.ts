/**
 * Rahmen `KitMinigame` und Requisiten `buildProp` (CHAOS-240) an einem Mini-Spiel „Knopf“:
 * A gibt einen Punkt, die Endphase meldet ein Ereignis, nach 2 s ist Schluss.
 */
import type { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import type { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import {
  createMinigameRng,
  type MinigameInfo,
  type MinigameInput,
  type MinigameRng,
  type Slot,
} from '@chaos-party/minigame-sdk';
import type {
  MinigameContext,
  MinigameFx,
  MinigameModule,
} from '@chaos-party/minigame-sdk/babylon';
import { visualOf } from '@chaos-party/minigame-sdk/babylon';
import {
  EMPTY_RESIDUE,
  createHeadlessScene,
  createRecordingFx,
  createTestCharacters,
  runMinigameHeadless,
  sceneResidue,
  testPlayers,
} from '@chaos-party/minigame-sdk/testing';
import { afterEach, describe, expect, it } from 'vitest';
import {
  profileForStrength,
  kitBotAdapter,
  kitRuntimeBot,
  lineup,
  runBotMatch,
  type BotAction,
  type BotProfile,
  type MinigameBot,
} from '../bots.ts';
import { MatchClock } from '../clock.ts';
import { Scoreboard } from '../scoreboard.ts';
import { SlotFigure } from './figures.ts';
import { KitMinigame } from './minigame.ts';
import { SLOT_COLOR, buildProp, fallbackParts, type PropPart } from './props.ts';
import { MinigameStage } from './stage.ts';

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

function context(players = 2): MinigameContext & { fx: ReturnType<typeof createRecordingFx> } {
  const headless = createHeadlessScene();
  cleanups.push(() => {
    headless.dispose();
  });
  return {
    scene: headless.scene,
    players: testPlayers(players),
    seed: 1,
    rng: createMinigameRng(1),
    timeLimitMs: 2_000,
    fx: createRecordingFx(),
    characters: createTestCharacters(),
    testMode: true,
    pace: () => Promise.resolve(),
  };
}

const INFO: MinigameInfo = {
  id: 'knopf',
  category: 'arcade',
  title: 'Knopf',
  tagline: 'Drück A!',
  instructions: ['A gibt einen Punkt.'],
  controls: { joystick: null, a: 'Punkt', b: null },
  durationMs: 2_000,
  physics: false,
  scoring: 'higher',
  scoreUnit: 'Punkte',
};

type KnopfEvent = { readonly type: 'point'; readonly slot: Slot } | { readonly type: 'finale' };

class KnopfLogic {
  readonly clock: MatchClock;
  readonly board: Scoreboard;

  constructor(slots: readonly Slot[], _rng: MinigameRng, timeLimitMs: number) {
    this.clock = new MatchClock(timeLimitMs, 0.5);
    this.board = new Scoreboard(slots);
  }

  get finished(): boolean {
    return this.clock.expired;
  }

  press(slot: Slot): KnopfEvent {
    this.board.add(slot, 1);
    return { type: 'point', slot };
  }

  step(dt: number): KnopfEvent[] {
    return this.clock.tick(dt).finaleStarted ? [{ type: 'finale' }] : [];
  }

  highlights(): string[] {
    return ['Alle drücken fleißig.'];
  }
}

/** Drückt jeden Schritt A (Slot 1) oder nie (andere). */
class KnopfBot implements MinigameBot<KnopfLogic> {
  constructor(
    readonly slot: Slot,
    readonly profile: BotProfile,
  ) {}

  act(): BotAction | null {
    return this.slot === 1 ? { press: ['a'] } : null;
  }
}

const KNOPF: readonly PropPart[] = [
  ['box', [1, 0.5, 2], SLOT_COLOR, [0, 0.25, 0], { finish: 'lack' }],
  ['cyl', [0.4], '#ffffff', [0, 0.7, 0]],
  ['ball', [0.3, 0.2, 0.3], '#ff0000', [0.5], { alpha: 0.5, scale: [2] }],
];

class Knopf extends KitMinigame<KnopfLogic, KnopfEvent> {
  readonly events: KnopfEvent[] = [];
  readonly syncs: number[] = [];

  constructor() {
    super(INFO, 'knopf', KnopfLogic, KnopfBot);
  }

  protected async build(stage: MinigameStage, _logic: KnopfLogic, ctx: MinigameContext) {
    for (const [index, player] of ctx.players.entries()) {
      buildProp(stage, 'knopf', KNOPF, player.slot, { x: index * 2, slotColor: player.color });
      this.figures.set(player.slot, await SlotFigure.create(stage, player));
    }
  }

  protected input(slot: Slot, input: MinigameInput, logic: KnopfLogic) {
    if (input.type === 'press' && input.button === 'a') return logic.press(slot);
  }

  protected onEvent(event: KnopfEvent, fx: MinigameFx): void {
    this.events.push(event);
    fx.sound(event.type === 'point' ? 'coin' : 'buzz');
  }

  protected sync(dt: number): void {
    this.syncs.push(dt);
  }

  protected scores(logic: KnopfLogic) {
    return logic.board.entries();
  }

  protected override status(slot: Slot, logic: KnopfLogic) {
    return logic.board.get(slot) > 0 ? 'drückt' : undefined;
  }

  protected override banner(logic: KnopfLogic) {
    return logic.clock.time > 1 ? 'Gleich vorbei!' : undefined;
  }
}

const KNOPF_MODULE: MinigameModule = { info: INFO, create: () => new Knopf() };
const press = (button: 'a' | 'b'): MinigameInput => ({ type: 'press', button });

describe('KitMinigame', () => {
  it('gibt Eingaben erst nach dem Start weiter und meldet Ereignisse', async () => {
    const ctx = context();
    const game = new Knopf();
    expect(game.getHud()).toEqual({ remainingMs: 2_000, scores: [] });
    await game.prepare(ctx);
    expect(game.syncs).toEqual([0]);
    game.handleInput(1, press('a'));
    expect(game.events).toEqual([]);
    game.start();
    expect(ctx.fx.record.sounds).toEqual(['go']);
    game.handleInput(1, press('a'));
    game.handleInput(2, press('b'));
    expect(game.events).toEqual([{ type: 'point', slot: 1 }]);
    expect(game.getHud()).toEqual({
      remainingMs: 2_000,
      scores: [
        { slot: 1, score: 1, status: 'drückt' },
        { slot: 2, score: 0 },
      ],
    });
    game.dispose();
  });

  it('beendet mit Plätzen, Höhepunkten, Feiern und ohne Meldung danach', async () => {
    const ctx = context();
    const characters = ctx.characters as ReturnType<typeof createTestCharacters>;
    const game = new Knopf();
    await game.prepare(ctx);
    game.start();
    game.handleInput(2, press('a'));
    for (let step = 0; step < 90; step++) game.update(1 / 60);
    expect(game.getHud().banner).toBe('Gleich vorbei!');
    expect(game.events.at(-1)).toEqual({ type: 'finale' });
    for (let step = 0; step < 40 && !game.getResult(); step++) game.update(1 / 60);
    expect(game.getResult()).toEqual({
      minigameId: 'knopf',
      placements: [
        { slot: 2, place: 1, score: 1 },
        { slot: 1, place: 2, score: 0 },
      ],
      highlights: ['Alle drücken fleißig.'],
    });
    expect(game.getHud().banner).toBeUndefined();
    expect(ctx.fx.record.sounds.at(-1)).toBe('win');
    expect(characters.animations.get(2)).toContain('cheer');
    // Nach dem Ende wirken Eingaben nicht mehr, die Ansicht läuft weiter.
    const syncs = game.syncs.length;
    game.handleInput(1, press('a'));
    game.update(1 / 60);
    expect(game.getResult()?.placements[0]?.slot).toBe(2);
    expect(game.syncs).toHaveLength(syncs + 1);
    game.dispose();
    game.dispose();
    expect(sceneResidue(ctx.scene)).toEqual(EMPTY_RESIDUE);
  });

  it('läuft mit KI-Plätzen durch die Laufzeit und räumt auf', async () => {
    const run = await runMinigameHeadless(KNOPF_MODULE, {
      players: 3,
      bots: [
        { slot: 1, strength: 1 },
        { slot: 2, strength: 0 },
      ],
    });
    expect(run.outcome?.result.placements[0]).toMatchObject({ slot: 1, place: 1 });
    expect(run.outcome?.result.placements[0]?.score).toBeGreaterThan(50);
    expect(run.residue).toEqual(EMPTY_RESIDUE);
  });

  it('liefert dem Bot die Logik nur, solange das Spiel läuft', async () => {
    const game = new Knopf();
    await game.prepare(context());
    const bot = game.createBot({ slot: 1, strength: 0.5, rng: createMinigameRng(3) });
    expect(bot.tick()).toEqual([]);
    game.start();
    expect(bot.tick()).toEqual([press('a'), { type: 'release', button: 'a' }]);
    game.dispose();
  });
});

describe('Bot-Anschluss', () => {
  it('kitBotAdapter ergänzt Erzeugen, Schritt, Ende und Spielzeit', () => {
    const adapter = kitBotAdapter(KnopfLogic, KnopfBot, {
      apply: (game, slot, action) => {
        if (action.press?.includes('a')) game.press(slot);
      },
      scores: (game) => game.board.entries().map((entry) => entry.score),
    });
    const record = runBotMatch(adapter, 1, lineup(2), 1_000);
    expect(record.scores).toEqual([60, 0]);
    const game = adapter.create([1, 2], createMinigameRng(1), 1_000);
    adapter.step(game, 0.5);
    expect(adapter.elapsedMs(game)).toBe(500);
    expect(adapter.finished(game)).toBe(false);
    const custom = kitBotAdapter(KnopfLogic, KnopfBot, {
      apply: () => undefined,
      scores: () => [],
      finished: () => true,
    });
    expect(custom.finished(game)).toBe(true);
  });

  it('kitRuntimeBot nimmt das Profil zur Stärke', () => {
    let seen: BotProfile | null = null;
    class Spy extends KnopfBot {
      constructor(slot: Slot, profile: BotProfile) {
        super(slot, profile);
        seen = profile;
      }
    }
    const logic = new KnopfLogic([1], createMinigameRng(1), 1_000);
    const driver = kitRuntimeBot(
      Spy,
      { slot: 1, strength: 1, rng: createMinigameRng(2) },
      () => logic,
    );
    expect(driver.slot).toBe(1);
    expect(seen).toEqual(profileForStrength(1));
  });
});

describe('buildProp', () => {
  it('baut Teile mit Rolle, Slot-Farbe, Lage und Skalierung', () => {
    const ctx = context();
    const stage = new MinigameStage(ctx, 'test');
    const node = buildProp(stage, 'knopf', KNOPF, 3, { x: 1, z: -2, slotColor: '#00ff00' });
    const parts = node.getChildMeshes<Mesh>();
    expect(parts.map((part) => part.name)).toEqual([
      'test-knopf-3-0',
      'test-knopf-3-1',
      'test-knopf-3-2',
    ]);
    expect(parts.every((part) => visualOf(part)?.role === 'knopf')).toBe(true);
    expect(visualOf(node)).toMatchObject({ role: 'knopf', key: '3' });
    const [box, cyl, ball] = parts;
    expect((box?.material as StandardMaterial).diffuseColor.toHexString()).toBe('#00FF00');
    expect(box?.getBoundingInfo().boundingBox.extendSize.asArray()).toEqual([0.5, 0.25, 1]);
    expect(cyl?.getBoundingInfo().boundingBox.extendSize.y).toBeCloseTo(0.2);
    expect(ball?.position.asArray()).toEqual([0.5, 0, 0]);
    expect(ball?.scaling.asArray()).toEqual([2, 2, 2]);
    expect(ball?.material?.alpha).toBe(0.5);
    node.computeWorldMatrix(true);
    expect(box?.getAbsolutePosition().asArray()).toEqual([1, 0.25, -2]);
    stage.dispose();
    expect(sceneResidue(ctx.scene)).toEqual(EMPTY_RESIDUE);
  });

  it('hängt an Eltern, skaliert das Ganze und blendet aus', () => {
    const ctx = context();
    const stage = new MinigameStage(ctx, 'test');
    const parent = stage.node('halter');
    const node = buildProp(stage, 'deckel', [['box', [1], '#123456']], 'a', {
      y: 2,
      parent,
      scale: 0.5,
      hidden: true,
    });
    expect(node.parent).toBe(parent);
    expect(node.position.y).toBe(2);
    expect(node.scaling.asArray()).toEqual([0.5, 0.5, 0.5]);
    expect(node.isEnabled()).toBe(false);
    stage.dispose();
    expect(sceneResidue(ctx.scene)).toEqual(EMPTY_RESIDUE);
  });

  it('baut den Rückfall eines Katalog-Requisits mit Laufzeit-Materialien', () => {
    const ctx = context();
    const stage = new MinigameStage(ctx, 'test');
    const parts: readonly PropPart[] = [
      ['box', [1], SLOT_COLOR, [0, 0.5, 0]],
      ['box', [0.5], '#ffffff', [0, 1, 0], { tint: 'zustand' }],
      ['cyl', [0.2], '#000000'],
    ];
    const prop = stage.prop('toaster', {
      role: 'toaster',
      key: 2,
      akzent: '#ff0000',
      fallback: fallbackParts(stage, 'toaster', parts, 2, '#00ff00'),
    });
    const [body, toast, knob] = prop.root.getChildMeshes<Mesh>();
    const hex = (mesh: Mesh | undefined) =>
      (mesh?.material as StandardMaterial | undefined)?.diffuseColor.toHexString();
    expect(hex(body)).toBe('#FF0000');
    prop.tint('zustand', '#0000ff');
    expect(hex(toast)).toBe('#0000FF');
    prop.tint('akzent', '#00ffff');
    expect([hex(body), hex(knob)]).toEqual(['#00FFFF', '#000000']);
    expect(visualOf(prop.root)).toMatchObject({ role: 'toaster', key: '2' });
    stage.dispose();
    expect(sceneResidue(ctx.scene)).toEqual(EMPTY_RESIDUE);
  });
});
