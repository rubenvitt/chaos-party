/**
 * Bot für Schnapp den Käse: sieht Stapel und Zucken, nicht das Zuschnappen und keine Finte. Je
 * Käse eine Wartezeit; bemerkt er ein Zucken, hält er still oder greift in Panik zu (`falseStart`).
 */
import {
  BotSenses,
  gaussian,
  kitBotAdapter,
  type BotAction,
  type BotProfile,
  type MinigameBot,
} from '@chaos-party/minigame-kit';
import type { MinigameRng, Slot } from '@chaos-party/minigame-sdk';
import { KAESE_RULES, KaeseLogic } from './logic.ts';

/** Wartezeiten nach dem Hinlegen (s): gutes Urteil, gierig, ängstlich. */
const AIM_S = { good: 1.4, greedy: 3, timid: 0.4 } as const;
const SETTLE_S = KAESE_RULES.twitchLeadS + 0.1;
const PRESS: BotAction = { press: ['a'] };

export class KaeseBot implements MinigameBot<KaeseLogic> {
  private readonly cheese: BotSenses;
  private readonly twitches: BotSenses;
  private plan: { readonly serial: number; readonly aim: number | null } | null = null;
  private judgedTwitch = -1;

  constructor(
    readonly slot: Slot,
    readonly profile: BotProfile,
    private readonly rng: MinigameRng,
  ) {
    this.cheese = new BotSenses(profile, rng);
    this.twitches = new BotSenses(profile, rng);
  }

  act(game: KaeseLogic): BotAction | null {
    const trap = game.trap(this.slot);
    const now = game.clock.time;
    if (trap?.phase !== 'cheese' || trap.grabEnd !== null) return null;
    this.cheese.see(trap.serial, trap.landedAt);
    if (!this.cheese.noticed(trap.serial, now)) return null;
    if (this.plan?.serial !== trap.serial) this.plan = this.makePlan(trap.serial);
    const twitch = Math.round(trap.twitchAt * 1000);
    if (trap.twitchAt > trap.landedAt && now - trap.twitchAt < SETTLE_S) {
      this.twitches.see(twitch, trap.twitchAt);
      if (this.twitches.noticed(twitch, now)) {
        // Einmal je Zucken entscheiden: stillhalten oder in Panik zugreifen.
        if (this.judgedTwitch === twitch) return null;
        this.judgedTwitch = twitch;
        return this.rng.next() < this.profile.falseStart ? PRESS : null;
      }
    }
    const { aim } = this.plan;
    return aim !== null && now - trap.landedAt >= aim ? PRESS : null;
  }

  private makePlan(serial: number): { serial: number; aim: number | null } {
    const { profile, rng } = this;
    if (rng.next() < profile.lapse) return { serial, aim: null };
    const roll = rng.next();
    const half = (1 + profile.judgement) / 2;
    const aim = AIM_S[roll < profile.judgement ? 'good' : roll < half ? 'greedy' : 'timid'];
    return { serial, aim: Math.max(0, aim + (gaussian(rng) * profile.timingSdMs * 3) / 1000) };
  }
}

/** Schnapp den Käse für `runBotMatch` und die Fairness-Prüfung (`kitHarness`). */
export const KAESE_BOT_ADAPTER = kitBotAdapter(KaeseLogic, KaeseBot, {
  apply: (game, slot, action) => {
    if (action.press?.includes('a')) game.grab(slot);
  },
  scores: (game) => game.board.entries().map((entry) => entry.score),
});

/** Störer (`kitHarness`): „Signal → drücken“ wie im Reaktionsspiel (wartet nie von selbst). */
export const KAESE_INTRUDERS = [
  { id: 'zucken', label: 'Greift beim Zucken', change: { lapse: 1, falseStart: 1 } },
].map(({ id, label, change }) => ({
  id,
  label,
  bot: (slot: Slot, rng: MinigameRng, normal: MinigameBot<KaeseLogic>) =>
    new KaeseBot(slot, { ...normal.profile, ...change }, rng),
}));
