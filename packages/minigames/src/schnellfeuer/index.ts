/**
 * Schnellfeuer (CHAOS-90): eigene Rundenart aus fünf Mikro-Spielen, nach außen ein ganz
 * normales Minispiel-Modul. So laufen Anleitung, Ergebnis, Münzen, Controller und der native
 * Apple-Host ohne neuen Ablauf: Die Kette (`chain.ts`) spielt die Mikro-Spiele nacheinander und
 * liefert am Ende ein Gesamtergebnis. Alle Gegenstände entstehen in `prepare` (das Minispiel darf
 * später nichts mehr asynchron bauen) und sind nur zu sehen, solange ihr Mikro-Spiel dran ist.
 */
import { arenaLayout } from '@chaos-party/minigame-kit';
import {
  MinigameStage,
  SlotFigure,
  buildArena,
  celebrateFigures,
  createCamera,
} from '@chaos-party/minigame-kit/babylon';
import type { MinigameCue, MinigameInput, MinigameResult, Slot } from '@chaos-party/minigame-sdk';
import type * as Sdk from '@chaos-party/minigame-sdk/babylon';
import { SchnellfeuerChain, type ChainEvent } from './chain.ts';
import { SCHNELLFEUER_INFO as INFO } from './info.ts';
import { MICRO_VIEWS, type LaneSpot, type MicroView } from './views.ts';

const LANE_WIDTH = 2.6;
/**
 * Figuren stehen weit hinter ihren Gegenständen und schauen zur Kamera. Die feste Kamera legt
 * die Figuren über und die Gegenstände unter das Banner in der Bildmitte (Bildwort, Host-HUD).
 */
const FIGURE_Z = 4;
const CAMERA = {
  position: { x: 0, y: 7.5, z: -9 },
  target: { x: 0, y: 1, z: 1 },
} as const;

class Schnellfeuer implements Sdk.Minigame {
  private ctx: Sdk.MinigameContext | null = null;
  private stage: MinigameStage | null = null;
  private chain: SchnellfeuerChain | null = null;
  private result: MinigameResult | null = null;
  private running = false;
  private names = new Map<Slot, string>();
  private readonly figures = new Map<Slot, SlotFigure>();
  private readonly views = new Map<string, MicroView>();
  private shown: MicroView | null = null;

  async prepare(ctx: Sdk.MinigameContext): Promise<void> {
    this.ctx = ctx;
    this.names = new Map(ctx.players.map((player) => [player.slot, player.name]));
    const chain = (this.chain = new SchnellfeuerChain(
      ctx.players.map((player) => player.slot),
      ctx.rng,
      ctx.timeLimitMs,
    ));
    const stage = (this.stage = new MinigameStage(ctx, 'schnellfeuer'));
    const layout = arenaLayout({
      form: 'bahnen',
      lanes: ctx.players.length,
      laneWidth: LANE_WIDTH,
      length: 10,
    });
    createCamera(stage, 'fest', layout, CAMERA);
    await buildArena(stage, layout, { ort: 'kueche', players: ctx.players });
    const lanes: LaneSpot[] = ctx.players.map((player, index) => ({
      player,
      x: layout.lanes[index]?.x ?? 0,
    }));
    for (const lane of lanes) {
      const figure = await SlotFigure.create(stage, lane.player);
      figure.place(lane.x, FIGURE_Z, Math.PI);
      this.figures.set(lane.player.slot, figure);
    }
    for (const micro of chain.order) {
      if (this.views.has(micro.info.id)) continue;
      const build = MICRO_VIEWS[micro.info.id];
      if (!build) throw new Error(`Keine Ansicht für Mikro-Spiel ${micro.info.id}`);
      const view = await build(stage, lanes);
      view.root.setEnabled(false);
      this.views.set(micro.info.id, view);
      await stage.pace();
    }
    this.show(chain.current?.info.id);
  }

  start(): void {
    this.running = true;
  }

  handleInput(slot: Slot, input: MinigameInput): void {
    const chain = this.chain;
    if (!this.running || !chain) return;
    if (input.type === 'move') chain.stick(slot, input.x, input.y);
    else if (input.type === 'press') {
      chain.press(slot, input.button);
      if (chain.phase === 'play') this.figures.get(slot)?.anim.replay('jump');
    }
  }

  update(dt: number): void {
    const chain = this.chain;
    if (!chain) return;
    if (this.running) for (const event of chain.step(dt)) this.onEvent(event);
    if (this.running && chain.finished) this.finish();
    this.shown?.sync(chain.phase === 'announce' ? null : chain.game, dt);
  }

  getResult(): MinigameResult | null {
    return this.result;
  }

  getHud(): Sdk.MinigameHud {
    const chain = this.chain;
    if (!chain) return { remainingMs: INFO.durationMs, scores: [] };
    const game = chain.phase === 'play' ? chain.game : null;
    const banner = this.result ? undefined : chain.banner(this.names);
    return {
      remainingMs: chain.remainingMs,
      scores: chain.totals.hud((slot) => game?.status(slot)?.slice(0, 16)),
      ...(banner ? { banner } : {}),
    };
  }

  getCue(): MinigameCue | null {
    return this.result ? null : (this.chain?.cue() ?? null);
  }

  dispose(): void {
    this.running = false;
    for (const figure of this.figures.values()) figure.dispose();
    this.figures.clear();
    this.views.clear();
    this.shown = null;
    this.stage?.dispose();
    this.stage = null;
  }

  private show(id: string | undefined): void {
    const next = id === undefined ? null : (this.views.get(id) ?? null);
    if (next === this.shown) return;
    this.shown?.root.setEnabled(false);
    next?.root.setEnabled(true);
    next?.sync(null, 0);
    this.shown = next;
  }

  private onEvent(event: ChainEvent): void {
    const fx = this.ctx?.fx;
    if (event.type === 'announce') {
      this.show(event.micro);
      for (const figure of this.figures.values()) figure.anim.play('idle');
      fx?.sound('tick');
    } else if (event.type === 'start') {
      fx?.sound('go');
    } else {
      const winners = event.winners ?? [];
      for (const [slot, figure] of this.figures) {
        figure.anim.replay(winners.includes(slot) ? 'cheer' : 'idle');
      }
      fx?.sound(winners.length > 0 ? 'score' : 'buzz');
    }
  }

  private finish(): void {
    const { ctx, chain } = this;
    if (!ctx || !chain || this.result) return;
    this.running = false;
    const placements = chain.totals.placements();
    celebrateFigures(placements, this.figures.values());
    ctx.fx.sound('win');
    const highlights = chain.highlights(this.names);
    this.result = { minigameId: INFO.id, placements, ...(highlights.length ? { highlights } : {}) };
  }
}

export const schnellfeuer: Sdk.MinigameModule = {
  info: INFO,
  create: () => new Schnellfeuer(),
};
