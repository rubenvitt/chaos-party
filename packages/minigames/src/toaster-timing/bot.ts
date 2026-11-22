/**
 * Bot für Toaster-Timing (Baukasten-Schnittstelle, Muster `hallo-baukasten/bot.ts`): liest die
 * Bräunung an der Farbe und das Tempo an ihrer Veränderung (beides sichtbar), merkt einen neuen
 * Toast erst nach seiner Reaktionszeit und drückt bei seiner Ziel-Bräunung. Zeitfehler
 * (`timingSdMs`) wird über das Tempo zu einem Bräunungsfehler; Fehlstart = deutlich zu früh,
 * Aussetzer = vergessen (Toast verkohlt). Schlechtes Urteil zielt vorsichtig etwas früher.
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
import { TOASTER_RULES, ToasterLogic } from './logic.ts';

/** Was der Bot für den aktuellen Toast vorhat: bei dieser Bräunung drücken, `null` = gar nicht. */
interface Plan {
  readonly serial: number;
  readonly target: number | null;
}

export class ToasterBot implements MinigameBot<ToasterLogic> {
  private readonly senses: BotSenses;
  private plan: Plan | null = null;
  decisions = 0;

  constructor(
    readonly slot: Slot,
    readonly profile: BotProfile,
    private readonly rng: MinigameRng,
  ) {
    this.senses = new BotSenses(profile, rng);
  }

  act(game: ToasterLogic): BotAction | null {
    const toaster = game.toaster(this.slot);
    const now = game.clock.time;
    if (!toaster?.loaded) return null;
    this.senses.see(toaster.serial, now);
    if (!this.senses.noticed(toaster.serial, now)) return null;
    if (this.plan?.serial !== toaster.serial) this.plan = this.makePlan(game, toaster.serial);
    const { target } = this.plan;
    if (target === null || toaster.browning < target) return null;
    this.decisions++;
    return { press: ['a'] };
  }

  private makePlan(game: ToasterLogic, serial: number): Plan {
    const { profile, rng } = this;
    if (rng.next() < profile.lapse) return { serial, target: null };
    const toaster = game.toaster(this.slot);
    const speed = (toaster?.rate ?? 0.4) * (game.clock.finale ? TOASTER_RULES.finaleFactor : 1);
    if (rng.next() < profile.falseStart) return { serial, target: 0.45 + rng.next() * 0.3 };
    const aim = rng.next() < profile.judgement ? TOASTER_RULES.golden : 0.8;
    const error = (gaussian(rng) * profile.timingSdMs * speed) / 1000;
    return { serial, target: aim + error };
  }
}

/** Toaster-Timing für `runBotMatch` und die Fairness-Prüfung (`kitHarness`). */
export const TOASTER_BOT_ADAPTER: BotMatchAdapter<ToasterLogic> = {
  create: (slots, rng, durationMs) => new ToasterLogic(slots, rng, durationMs),
  bot: (slot, profile, rng) => new ToasterBot(slot, profile, rng),
  apply: (game, slot, action) => {
    if (action.press?.includes('a')) game.pop(slot);
  },
  step: (game, dt) => void game.step(dt),
  finished: (game) => game.finished,
  scores: (game) => game.board.entries().map((entry) => entry.score),
  elapsedMs: (game) => game.clock.time * 1000,
};

/** Laufzeit-Bot für einen KI-Platz (`Minigame.createBot`). */
export function createToasterBot(
  options: MinigameBotOptions,
  observe: () => ToasterLogic | null,
): MinigameBotDriver {
  const bot = new ToasterBot(options.slot, profileForStrength(options.strength), options.rng);
  return kitBotDriver(bot, observe);
}
