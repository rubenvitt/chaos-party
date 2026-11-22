/**
 * Bots für Schnellfeuer (CHAOS-90): je Mikro-Spiel ein eigener Bot aus dem Vorrat, über die
 * gemeinsame Schnittstelle des Baukastens (`runBotMatch`, ADR-021). Der Kettenbot legt bei
 * jedem neuen Mikro-Spiel den passenden Bot an; im Bildwort tut er nichts.
 */
import {
  BOT_PROFILES,
  type BotAction,
  type BotMatchAdapter,
  type BotProfile,
  type MinigameBot,
} from '@chaos-party/minigame-kit';
import { createMinigameRng, type MinigameRng, type Slot } from '@chaos-party/minigame-sdk';
import { LeadCounter, type FairnessHarness, type FairnessSkill } from '../checks/fairness.ts';
import { CHAIN_MAX_MS, SchnellfeuerChain } from './chain.ts';
import type { MicroBot } from './micro.ts';

export class SchnellfeuerBot implements MinigameBot<SchnellfeuerChain> {
  decisions = 0;
  private bot: MicroBot | null = null;
  private botFor = -1;

  constructor(
    readonly slot: Slot,
    readonly profile: BotProfile,
    private readonly rng: MinigameRng,
  ) {}

  act(chain: SchnellfeuerChain): BotAction | null {
    const game = chain.game;
    const micro = chain.current;
    if (chain.phase !== 'play' || !game || !micro) return null;
    if (this.botFor !== chain.index) {
      this.botFor = chain.index;
      this.bot = micro.bot(this.slot, this.profile, createMinigameRng(this.rng.int(1, 1e9)));
    }
    const action = this.bot?.act(game) ?? null;
    if (action?.press?.length) this.decisions++;
    return action;
  }
}

export const SCHNELLFEUER_BOT_ADAPTER: BotMatchAdapter<SchnellfeuerChain> = {
  create: (slots, rng, durationMs) => new SchnellfeuerChain(slots, rng, durationMs),
  bot: (slot, profile, rng) => new SchnellfeuerBot(slot, profile, rng),
  apply: (chain, slot, action) => {
    if (action.stick) chain.stick(slot, action.stick.x, action.stick.y);
    for (const button of action.press ?? []) chain.press(slot, button);
  },
  step: (chain, dt) => void chain.step(dt),
  finished: (chain) => chain.finished,
  scores: (chain) => chain.totals.entries().map((entry) => entry.score),
  elapsedMs: (chain) => chain.time * 1000,
};

/** Dauerdrücken (Eindringling-Test): Stick fest nach rechts oben, A in jedem Schritt. */
class MasherBot implements MinigameBot<SchnellfeuerChain> {
  constructor(
    readonly slot: Slot,
    readonly profile: BotProfile,
  ) {}

  act(): BotAction {
    return { stick: { x: 0.7, y: 0.7 }, press: ['a'] };
  }
}

const SKILL_PROFILES: Record<FairnessSkill, BotProfile> = {
  profi: BOT_PROFILES.profi,
  normal: BOT_PROFILES.normal,
  neuling: BOT_PROFILES.neuling,
};

/**
 * Fairness-Harness (CHAOS-84-Vorlage) für Schnellfeuer: gleiche Tische und Schwellen wie jedes
 * Minispiel der Rotation, obwohl Schnellfeuer nur über den Auslöser kommt.
 */
export const SCHNELLFEUER_FAIRNESS: FairnessHarness = {
  id: 'schnellfeuer',
  scoring: 'higher',
  intruders: [{ id: 'dauerdruecken', label: 'Dauerdrücken' }],
  ciSeeds: 60,
  play(seats, seed) {
    const slots = ([1, 2, 3, 4] as const).slice(0, seats.length);
    const chain = new SchnellfeuerChain(slots, createMinigameRng(seed), CHAIN_MAX_MS);
    const bots = slots.map((slot, index): MinigameBot<SchnellfeuerChain> => {
      const seat = seats[index] ?? { skill: 'normal' as const };
      const profile = SKILL_PROFILES[seat.skill];
      return seat.strategy === 'dauerdruecken'
        ? new MasherBot(slot, profile)
        : new SchnellfeuerBot(slot, profile, createMinigameRng(seed * 31 + slot));
    });
    const lead = new LeadCounter('higher');
    while (!chain.finished) {
      for (const bot of bots) {
        const action = bot.act(chain);
        if (action) SCHNELLFEUER_BOT_ADAPTER.apply(chain, bot.slot, action);
      }
      chain.step(1 / 60);
      lead.update(SCHNELLFEUER_BOT_ADAPTER.scores(chain));
    }
    return { scores: SCHNELLFEUER_BOT_ADAPTER.scores(chain), leadChanges: lead.changes };
  },
};
