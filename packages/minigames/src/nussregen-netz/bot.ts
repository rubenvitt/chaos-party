/**
 * Bot für Nussregen-Netz (Muster `hallo-baukasten/bot.ts`): bemerkt eine Nuss nach seiner
 * Reaktionszeit ab dem Wurf, stellt den Kescher unter ihren Landepunkt und bleibt bei seiner Wahl.
 * Faule Nüsse erkennt er nur mit `awareness`; `aimNoise` verschiebt den Standort, schlechtes
 * Urteil nimmt die späteste statt der nächsten Nuss. Weit schwingt er, wenn eine gute Nuss tief
 * im Schwungbereich hängt, die der Kescher sonst verpasst.
 */
import {
  BotSenses,
  gaussian,
  kitBotDriver,
  profileForStrength,
  type BotAction,
  type BotMatchAdapter,
  type BotProfile,
  type MinigameBot,
} from '@chaos-party/minigame-kit';
import type {
  MinigameBotDriver,
  MinigameBotOptions,
  MinigameRng,
  Slot,
} from '@chaos-party/minigame-sdk';
import { NUSS_RULES, NussLogic, inSwingZone, netX, type Catcher, type Nut } from './logic.ts';

const THINK_STEPS = 5;

export class NussBot implements MinigameBot<NussLogic> {
  private readonly senses: BotSenses;
  /** Gewählte Nuss, Standort (mit Zielfehler) und Blickrichtung dort. */
  private plan: { id: number; stand: number; facing: 1 | -1 } | null = null;
  decisions = 0;

  constructor(
    readonly slot: Slot,
    readonly profile: BotProfile,
    private readonly rng: MinigameRng,
  ) {
    this.senses = new BotSenses(profile, rng);
  }

  act(game: NussLogic): BotAction | null {
    const me = game.catcher(this.slot);
    const now = game.clock.time;
    if (!me || Math.round(now * 60) % THINK_STEPS !== 0) return null;
    for (const nut of game.nuts) this.senses.see(nut.id, nut.warnAt);
    if (now < me.lameUntil) return { stick: { x: 0, y: 0 } };
    const known = game.nuts.filter((nut) => this.senses.noticed(nut.id, now));
    const bad = known.filter((nut) => nut.rotten && this.senses.noticed(nut.id, now, true));
    const good = known.filter((nut) => !bad.includes(nut));
    const swingable = good.some((nut) => inSwingZone(me, nut, now) && offNetBy(me, nut, 0));
    const risky = bad.some((nut) => inSwingZone(me, nut, now));
    if (swingable && !risky && this.rng.next() < this.profile.judgement) {
      this.decisions++;
      return { press: ['a'], stick: { x: 0, y: 0 } };
    }
    const feasible = (nut: Nut) => {
      const near = (other: Nut) =>
        Math.abs(other.x - nut.x) < NUSS_RULES.reach + 0.2 &&
        Math.abs(other.arriveAt - nut.arriveAt) < 0.35;
      const eta = Math.abs(standFor(me, nut).stand - me.x) / game.speed(me);
      return eta < nut.arriveAt - now - 0.05 && !bad.some(near);
    };
    const current = good.find((nut) => nut.id === this.plan?.id);
    if (!current || !feasible(current)) {
      const options = good.filter(feasible).sort((a, b) => a.arriveAt - b.arriveAt);
      const choice = this.rng.next() < this.profile.judgement ? options[0] : options.at(-1);
      this.plan = null;
      if (choice) {
        const { stand, facing } = standFor(me, choice);
        const error = gaussian(this.rng) * this.profile.aimNoise * 0.8;
        this.plan = { id: choice.id, stand: stand + error, facing };
        this.decisions++;
      }
    }
    return { stick: { x: this.steer(me, bad, now), y: 0 } };
  }

  /** Stick-x zum Standort; ohne Plan weicht er einer faulen Nuss über dem eigenen Kescher aus. */
  private steer(me: Catcher, bad: readonly Nut[], now: number): number {
    const plan = this.plan;
    if (!plan) {
      const threat = bad.find((nut) => nut.arriveAt - now < 0.7 && !offNetBy(me, nut, 0.2));
      return threat ? (threat.x > me.x ? -1 : 1) : 0;
    }
    const dx = plan.stand - me.x;
    if (Math.abs(dx) < 0.12) return me.facing === plan.facing ? 0 : plan.facing * 0.2;
    return Math.sign(dx) * Math.min(1, Math.max(0.3, Math.abs(dx) * 2));
  }
}

function offNetBy(me: Catcher, nut: Nut, margin: number): boolean {
  return Math.abs(nut.x - netX(me)) > NUSS_RULES.reach + margin;
}

/** Wo die Figur stehen muss, damit die Kescher-Mitte unter der Nuss ist (von ihrer Seite her). */
function standFor(me: Catcher, nut: Nut): { stand: number; facing: 1 | -1 } {
  const gap = nut.x - me.x;
  const facing = Math.abs(gap) < NUSS_RULES.netOffset ? me.facing : gap > 0 ? 1 : -1;
  return { stand: nut.x - facing * NUSS_RULES.netOffset, facing };
}

/** Nussregen-Netz für `runBotMatch` und die Fairness-Prüfung (`kitHarness`). */
export const NUSS_BOT_ADAPTER: BotMatchAdapter<NussLogic> = {
  create: (slots, rng, durationMs) => new NussLogic(slots, rng, durationMs),
  bot: (slot, profile, rng) => new NussBot(slot, profile, rng),
  apply: (game, slot, action) => {
    if (action.stick) game.setStick(slot, action.stick.x);
    if (action.press?.includes('a')) game.swing(slot);
  },
  step: (game, dt) => void game.step(dt),
  finished: (game) => game.finished,
  scores: (game) => game.board.entries().map((entry) => entry.score),
  elapsedMs: (game) => game.clock.time * 1000,
};

/** Laufzeit-Bot für einen KI-Platz (`Minigame.createBot`). */
export function createNussBot(
  options: MinigameBotOptions,
  observe: () => NussLogic | null,
): MinigameBotDriver {
  const bot = new NussBot(options.slot, profileForStrength(options.strength), options.rng);
  return kitBotDriver(bot, observe);
}
