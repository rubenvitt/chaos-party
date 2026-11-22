/**
 * Bot für Matschmaler (Muster `hallo-baukasten/bot.ts`): sucht auf einem groben Raster die Stelle
 * mit den meisten fremden oder freien Feldern in der Nähe (näher ist besser) und läuft hin.
 * Angekündigten Regen meidet er, wenn er ihn bemerkt (`awareness`). Platschen tut er, wenn am
 * Landepunkt viel Fremdes liegt. Schlechtes Urteil nimmt eine zufällige statt der besten Stelle.
 */
import {
  BotSenses,
  aheadOf,
  kitBotDriver,
  noisyStick,
  profileForStrength,
  shapeContains,
  type BotAction,
  type BotMatchAdapter,
  type BotProfile,
  type MinigameBot,
  type Point,
} from '@chaos-party/minigame-kit';
import type {
  MinigameBotDriver,
  MinigameBotOptions,
  MinigameRng,
  Slot,
} from '@chaos-party/minigame-sdk';
import { MATSCH_RULES, MatschLogic, cellsWithin, type Mudder } from './logic.ts';

const THINK_STEPS = 9;
/** Wie weit ein Bauchplatscher rutscht. */
const SLIDE = MATSCH_RULES.speed * MATSCH_RULES.dashFactor * MATSCH_RULES.dashS;
/** Kandidaten: jede zweite Feldmitte. */
const SPOTS: Point[] = [];
const { cols, rows } = MATSCH_RULES;
for (let x = 1 - cols / 2; x < cols / 2; x += 2) {
  for (let z = 1 - rows / 2; z < rows / 2; z += 2) SPOTS.push({ x, z });
}

export class MatschBot implements MinigameBot<MatschLogic> {
  private readonly senses: BotSenses;
  private target: Point | null = null;
  private keepUntil = 0;
  decisions = 0;

  constructor(
    readonly slot: Slot,
    readonly profile: BotProfile,
    private readonly rng: MinigameRng,
  ) {
    this.senses = new BotSenses(profile, rng);
  }

  act(game: MatschLogic): BotAction | null {
    const me = game.mudder(this.slot);
    const now = game.clock.time;
    if (!me || Math.round(now * 60) % THINK_STEPS !== 0) return null;
    if (now < me.stunUntil) return { stick: { x: 0, y: 0 } };
    for (const rain of game.rain.hazards) this.senses.see(rain.id, rain.warnAt);
    const wet = (point: Point) =>
      game.rain.hazards.some(
        (rain) => this.senses.noticed(rain.id, now, true) && shapeContains(rain.shape, point, 0.6),
      );
    /** Fremde oder freie Felder um `point`, ohne die im Regen. */
    const gain = (point: Point, radius: number) =>
      cellsWithin(point.x, point.z, radius).filter((index) => game.cells[index] !== this.slot)
        .length;
    const dist = (spot: Point) => Math.hypot(spot.x - me.x, spot.z - me.z);
    /** Wo andere stehen, wird gleich übermalt: Stellen nahe fremder Figuren zählen weniger. */
    const crowd = (spot: Point) =>
      game.mudders.reduce(
        (factor, other) =>
          other !== me && Math.hypot(other.x - spot.x, other.z - spot.z) < 2.5
            ? factor * 0.5
            : factor,
        1,
      );
    if (wet(me)) {
      // Raus aus dem angekündigten Regen: zur nächsten trockenen Stelle.
      this.target = SPOTS.filter((spot) => !wet(spot)).sort((a, b) => dist(a) - dist(b))[0] ?? null;
    } else if (
      !this.target ||
      dist(this.target) < 0.6 ||
      now >= this.keepUntil ||
      wet(this.target)
    ) {
      const scored = SPOTS.filter((spot) => !wet(spot))
        .map((spot) => ({
          spot,
          value: (gain(spot, 1.6) * crowd(spot)) / (1 + dist(spot) * 0.3),
        }))
        .sort((a, b) => b.value - a.value);
      const pick =
        this.rng.next() < this.profile.judgement ? 0 : Math.floor(this.rng.next() * scored.length);
      this.target = scored[pick]?.spot ?? null;
      this.keepUntil = now + 1.2;
      this.decisions++;
    }
    if (!this.target) return { stick: { x: 0, y: 0 } };
    const angle = Math.atan2(this.target.z - me.z, this.target.x - me.x);
    const action: BotAction = { stick: noisyStick(angle, this.profile, this.rng) };
    const landing = this.landing(me, angle);
    const worth = gain(landing, MATSCH_RULES.splatRadius) >= 6 && !wet(landing);
    // Fehlstart: platscht einfach so (vergeudet die Abklingzeit, steht benommen herum).
    const rash = this.rng.next() < this.profile.falseStart * 0.3;
    if (
      now >= me.dashReadyAt &&
      ((worth && this.rng.next() < 0.4 + this.profile.judgement * 0.5) || rash)
    ) {
      this.decisions++;
      return { ...action, press: ['a'] };
    }
    return action;
  }

  private landing(me: Mudder, angle: number): Point {
    const heading = Math.atan2(Math.cos(angle), Math.sin(angle));
    return aheadOf({ ...me, heading }, SLIDE);
  }
}

/** Matschmaler für `runBotMatch` und die Fairness-Prüfung (`kitHarness`). */
export const MATSCH_BOT_ADAPTER: BotMatchAdapter<MatschLogic> = {
  create: (slots, rng, durationMs) => new MatschLogic(slots, rng, durationMs),
  bot: (slot, profile, rng) => new MatschBot(slot, profile, rng),
  apply: (game, slot, action) => {
    if (action.stick) game.setStick(slot, action.stick.x, action.stick.y);
    if (action.press?.includes('a')) game.splat(slot);
  },
  step: (game, dt) => void game.step(dt),
  finished: (game) => game.finished,
  scores: (game) => game.board.entries().map((entry) => entry.score),
  elapsedMs: (game) => game.clock.time * 1000,
};

/** Laufzeit-Bot für einen KI-Platz (`Minigame.createBot`). */
export function createMatschBot(
  options: MinigameBotOptions,
  observe: () => MatschLogic | null,
): MinigameBotDriver {
  const bot = new MatschBot(options.slot, profileForStrength(options.strength), options.rng);
  return kitBotDriver(bot, observe);
}
