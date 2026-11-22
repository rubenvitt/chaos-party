/**
 * Bot für Bienenstock-Honig: liest nur Sichtbares (Topf, Bienen um den eigenen Topf = Wut,
 * anfliegende Biene, Restzeit). Er zapft, bis die Wut seine Grenze erreicht, und sichert dann;
 * eine anfliegende Biene bemerkt er nach seiner Reaktionszeit (mit `awareness`) und sichert
 * sofort. Gutes Urteil wählt die passende Grenze, schlechtes eine zufällige; Aussetzer =
 * Grenze vergessen. Stile für die Fairness-Eindringlinge: gierig und ängstlich.
 */
import {
  BotSenses,
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
import { HONEY_RULES, HoneyLogic } from './logic.ts';

export type HoneyStyle = 'normal' | 'gierig' | 'aengstlich';

/** Wut-Grenze bei gutem Urteil; schlechtes Urteil zieht eine aus `BOT_SLOPPY`. */
export const BOT_LIMIT = 0.5;
const BOT_SLOPPY = [0.2, 0.95] as const;

export class HoneyBot implements MinigameBot<HoneyLogic> {
  private readonly senses: BotSenses;
  private plan: { cycle: number; limit: number } | null = null;
  decisions = 0;

  constructor(
    readonly slot: Slot,
    readonly profile: BotProfile,
    private readonly rng: MinigameRng,
    private readonly style: HoneyStyle = 'normal',
  ) {
    this.senses = new BotSenses(profile, rng);
  }

  act(game: HoneyLogic): BotAction | null {
    const keeper = game.keeper(this.slot);
    if (!keeper || keeper.state === 'stunned' || keeper.state === 'secure') return null;
    const now = game.clock.time;
    const pot = game.bank.pot(this.slot);
    const account = game.bank.account(this.slot);
    const cycle = (account?.banks ?? 0) + (account?.busts ?? 0);
    if (this.plan?.cycle !== cycle) this.plan = { cycle, limit: this.limit() };
    const bee = game.beeFor(this.slot);
    if (bee) this.senses.see(bee.id, now);
    const warned = bee !== undefined && this.senses.noticed(bee.id, now, true);
    const late = game.clock.remainingS < HONEY_RULES.secureS + this.profile.reactionMs / 1000;
    const done = this.style === 'aengstlich' ? keeper.streak > 0 : keeper.anger >= this.plan.limit;
    if (pot > 0 && ((warned && this.style !== 'gierig') || late || done)) {
      this.decisions++;
      return { press: ['b'] };
    }
    if (keeper.state !== 'idle' || late) return null;
    this.decisions++;
    return { press: ['a'] };
  }

  private limit(): number {
    const { profile, rng, style } = this;
    if (style === 'gierig') return 0.95;
    if (rng.next() < profile.lapse) return 1.1;
    if (rng.next() < profile.judgement) return BOT_LIMIT;
    return BOT_SLOPPY[0] + rng.next() * (BOT_SLOPPY[1] - BOT_SLOPPY[0]);
  }
}

/** Bienenstock-Honig für `runBotMatch` und die Fairness-Prüfung (`kitHarness`). */
export const HONEY_BOT_ADAPTER: BotMatchAdapter<HoneyLogic> = {
  create: (slots, rng, durationMs) => new HoneyLogic(slots, rng, durationMs),
  bot: (slot, profile, rng) => new HoneyBot(slot, profile, rng),
  // B vor A: Wer im selben Moment sichert, zapft nicht mehr.
  apply: (game, slot, action) => {
    if (action.press?.includes('b')) game.secure(slot);
    if (action.press?.includes('a')) game.tap(slot);
  },
  step: (game, dt) => void game.step(dt),
  finished: (game) => game.finished,
  scores: (game) => game.bank.scores().map((entry) => entry.score),
  elapsedMs: (game) => game.clock.time * 1000,
};

/** Laufzeit-Bot für einen KI-Platz (`Minigame.createBot`). */
export function createHoneyBot(
  options: MinigameBotOptions,
  observe: () => HoneyLogic | null,
): MinigameBotDriver {
  const bot = new HoneyBot(options.slot, profileForStrength(options.strength), options.rng);
  return kitBotDriver(bot, observe);
}
