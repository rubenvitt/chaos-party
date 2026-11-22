/**
 * Ablauf-Rahmen eines Logik-Spiels (CHAOS-240, ADR-021 Nachtrag): erledigt, was alle
 * Pilot-Spiele gleich geschrieben haben – Logik und Bühne anlegen, Start-Ton, Bot an die
 * laufende Logik hängen, Eingaben nur im Lauf weitergeben, feste Schritte mit Ereignissen, HUD
 * aus Punkten und Status, Ende mit Feiern, Höhepunkten und Ergebnis, Aufräumen.
 *
 * **Keine Spielvorlage** (README §5.5): Der Rahmen kennt keine Spiel-Ereignisse wie „Spawn“ oder
 * „Treffer“, nur den Ablauf des SDK (`Minigame`, ADR-012). Regeln, Kernverb, Kniff, Requisiten
 * und Ansicht schreibt das Spiel in `build`, `input`, `onEvent` und `sync`. Spiele mit eigenem
 * Ablauf (Abschnitte, Physik, Teams) implementieren `Minigame` weiter selbst.
 */
import {
  rankByScore,
  type MinigameBotDriver,
  type MinigameBotOptions,
  type MinigameInfo,
  type MinigameInput,
  type MinigamePlacement,
  type MinigameResult,
  type Slot,
} from '@chaos-party/minigame-sdk';
import type {
  Minigame,
  MinigameContext,
  MinigameFx,
  MinigameHud,
} from '@chaos-party/minigame-sdk/babylon';
import { kitRuntimeBot, type KitBotClass, type KitLogicClass } from '../bots.ts';
import { celebrateFigures, type SlotFigure } from './figures.ts';
import { MinigameStage } from './stage.ts';

/** Was der Rahmen von der reinen Logik braucht (Uhr, Ende, Schritt, Höhepunkte). */
export interface KitLogic<E> {
  readonly clock: { readonly time: number; readonly remainingMs: number };
  readonly finished: boolean;
  step(dt: number): Iterable<E>;
  highlights(names: ReadonlyMap<Slot, string>): readonly string[];
}

export interface KitScore {
  readonly slot: Slot;
  readonly score: number;
}

export abstract class KitMinigame<L extends KitLogic<E>, E> implements Minigame {
  protected ctx: MinigameContext | null = null;
  protected stage: MinigameStage | null = null;
  protected logic: L | null = null;
  protected result: MinigameResult | null = null;
  protected running = false;
  /** Figuren je Slot: der Rahmen feiert sie am Ende und entsorgt sie. */
  protected readonly figures = new Map<Slot, SlotFigure>();

  /**
   * `prefix` beginnt die Namen der Bühne (z. B. „toaster“); `Logic` und `Bot` sind die reine
   * Logik und der Bot des Spiels (dieselben Klassen wie in `kitBotAdapter`).
   */
  constructor(
    readonly info: MinigameInfo,
    private readonly prefix: string,
    private readonly Logic: KitLogicClass<L>,
    private readonly Bot: KitBotClass<L>,
  ) {}

  /** Kamera, Arena, Requisiten, Figuren (in `figures` eintragen). */
  protected abstract build(stage: MinigameStage, logic: L, ctx: MinigameContext): Promise<void>;
  /** Eingabe im Lauf; ein zurückgegebenes Ereignis geht an `onEvent`. */
  protected abstract input(slot: Slot, input: MinigameInput, logic: L): E | null | undefined;
  /** Ereignis aus `step` oder `input`: Ton, Effekte, Ansicht. */
  protected abstract onEvent(event: E, fx: MinigameFx, logic: L): void;
  /** Ansicht an die Logik angleichen (jeder Schritt, auch vor dem Start und nach dem Ende). */
  protected abstract sync(dt: number, logic: L, stage: MinigameStage): void;
  /** Punkte je Slot für HUD und Wertung. */
  protected abstract scores(logic: L): readonly KitScore[];

  /** Reine Logik für diese Partie (Standard: `new Logic(slots, rng, timeLimitMs)`). */
  protected createLogic(ctx: MinigameContext): L {
    return new this.Logic(
      ctx.players.map((player) => player.slot),
      ctx.rng,
      ctx.timeLimitMs,
    );
  }

  /** Laufzeit-Bot (Standard: `kitRuntimeBot`); `observe` liefert die Logik nur im Lauf. */
  protected bot(options: MinigameBotOptions, observe: () => L | null): MinigameBotDriver {
    return kitRuntimeBot(this.Bot, options, observe);
  }

  /** Kurzer Zustand je Slot im HUD (≤ 16 Zeichen), optional. */
  protected status?(slot: Slot, logic: L): string | undefined;

  /** Meldung mitten im Spiel (≤ 32 Zeichen), optional; nach dem Ende nicht mehr gezeigt. */
  protected banner?(logic: L): string | undefined;

  /** Plätze am Ende (Standard: nach `scores` und `info.scoring`). */
  protected placements(logic: L): MinigamePlacement[] {
    return rankByScore(this.scores(logic), this.info.scoring);
  }

  /** Spiel ist vorbei (Figuren zeigen keine Lauf-Animation mehr). */
  protected get over(): boolean {
    return this.result !== null;
  }

  async prepare(ctx: MinigameContext): Promise<void> {
    this.ctx = ctx;
    const logic = (this.logic = this.createLogic(ctx));
    const stage = (this.stage = new MinigameStage(ctx, this.prefix));
    await this.build(stage, logic, ctx);
    this.sync(0, logic, stage);
  }

  start(): void {
    this.running = true;
    this.ctx?.fx.sound('go');
  }

  createBot = (options: MinigameBotOptions): MinigameBotDriver =>
    this.bot(options, () => (this.running ? this.logic : null));

  handleInput(slot: Slot, input: MinigameInput): void {
    const { ctx, logic } = this;
    if (!this.running || !ctx || !logic) return;
    const event = this.input(slot, input, logic);
    if (event !== null && event !== undefined) this.onEvent(event, ctx.fx, logic);
  }

  update(dt: number): void {
    const { ctx, logic, stage } = this;
    if (!ctx || !logic || !stage) return;
    if (this.running) for (const event of logic.step(dt)) this.onEvent(event, ctx.fx, logic);
    if (this.running && logic.finished) this.finish(ctx, logic);
    this.sync(dt, logic, stage);
  }

  getResult(): MinigameResult | null {
    return this.result;
  }

  getHud(): MinigameHud {
    const logic = this.logic;
    if (!logic) return { remainingMs: this.info.durationMs, scores: [] };
    const scores = this.scores(logic).map((entry) => {
      const text = this.status?.(entry.slot, logic);
      return text ? { ...entry, status: text } : entry;
    });
    const banner = this.result ? undefined : this.banner?.(logic);
    return { remainingMs: logic.clock.remainingMs, scores, ...(banner ? { banner } : {}) };
  }

  dispose(): void {
    this.running = false;
    for (const figure of this.figures.values()) figure.dispose();
    this.figures.clear();
    this.stage?.dispose();
    this.stage = null;
  }

  private finish(ctx: MinigameContext, logic: L): void {
    if (this.result) return;
    this.running = false;
    const placements = this.placements(logic);
    celebrateFigures(placements, this.figures.values());
    ctx.fx.sound('win');
    const highlights = logic.highlights(new Map(ctx.players.map((p) => [p.slot, p.name])));
    this.result = {
      minigameId: this.info.id,
      placements,
      ...(highlights.length ? { highlights: [...highlights] } : {}),
    };
  }
}
