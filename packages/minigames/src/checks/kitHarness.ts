/**
 * Fairness-Anbindung für Minispiele auf dem Baukasten (CHAOS-91): Ein Spiel mit reiner Logik
 * und `BotMatchAdapter` (Muster `hallo-baukasten/bot.ts`) bekommt seinen `FairnessHarness`
 * ohne eigenen Spielschleifen-Code. Können-Stufen = gemeinsame Bot-Profile (EXP-005), die
 * Eindringlinge bringt das Spiel mit (mindestens `dauerDruecker`).
 *
 * Ablauf wie `runBotMatch` (1/60-s-Schritte, Bot-Zufall `seed × 31 + slot`), dazu die Führung
 * für `LeadCounter`.
 */
import {
  BOT_PROFILES,
  type BotAction,
  type BotMatchAdapter,
  type BotProfile,
  type MinigameBot,
} from '@chaos-party/minigame-kit';
import {
  createMinigameRng,
  type MinigameInfo,
  type MinigameRng,
  type Slot,
} from '@chaos-party/minigame-sdk';
import {
  LeadCounter,
  type FairnessHarness,
  type FairnessMatch,
  type FairnessSeat,
  type FairnessSkill,
} from './fairness.ts';

const STEP_S = 1 / 60;

export const KIT_SKILL_PROFILES: Readonly<Record<FairnessSkill, BotProfile>> = {
  profi: BOT_PROFILES.profi,
  normal: BOT_PROFILES.normal,
  neuling: BOT_PROFILES.neuling,
};

/** Abweichende Strategie: baut aus dem normalen Bot des Spiels einen Störer. */
export interface KitIntruder<G> {
  readonly id: string;
  readonly label: string;
  bot(slot: Slot, rng: MinigameRng, normal: MinigameBot<G>): MinigameBot<G>;
}

/**
 * Dauerdrücken (Pflicht-Eindringling, `FairnessHarness.intruders[0]`): spielt wie der normale
 * Bot und drückt zusätzlich in jedem Schritt die genannten Knöpfe.
 */
export function dauerDruecker<G>(
  buttons: readonly ('a' | 'b')[] = ['a'],
  label = 'Dauerdrücken',
): KitIntruder<G> {
  return {
    id: 'dauer',
    label,
    bot: (slot, _rng, normal) => ({
      slot,
      profile: normal.profile,
      act(game: G): BotAction {
        const action = normal.act(game);
        const press = [...new Set([...(action?.press ?? []), ...buttons])];
        return { ...(action ?? {}), press };
      },
    }),
  };
}

export interface KitHarnessOptions<G> {
  readonly info: MinigameInfo;
  readonly adapter: BotMatchAdapter<G>;
  /** Erster Eintrag: Dauerdrücken (`dauerDruecker`). */
  readonly intruders: readonly KitIntruder<G>[];
  /** Seeds je Tisch in der CI (reine Logik verträgt 60). */
  readonly ciSeeds?: number;
}

/** Eine Bot-Partie auf der reinen Logik mit Sitzen aus der Fairness-Vorlage. */
export function playKitMatch<G>(
  options: KitHarnessOptions<G>,
  seats: readonly FairnessSeat[],
  seed: number,
): FairnessMatch {
  const { adapter, info, intruders } = options;
  const slots = ([1, 2, 3, 4] as const).slice(0, seats.length);
  const game = adapter.create(slots, createMinigameRng(seed), info.durationMs);
  const bots = slots.map((slot, index) => {
    const seat = seats[index];
    const rng = createMinigameRng(seed * 31 + slot);
    const normal = adapter.bot(slot, KIT_SKILL_PROFILES[seat?.skill ?? 'normal'], rng);
    const intruder = intruders.find((entry) => entry.id === seat?.strategy);
    return intruder ? intruder.bot(slot, rng, normal) : normal;
  });
  const lead = new LeadCounter(info.scoring);
  const maxSteps = Math.ceil((info.durationMs / 1000 / STEP_S) * 2) + 60;
  for (let step = 0; step < maxSteps && !adapter.finished(game); step++) {
    for (const bot of bots) {
      const action = bot.act(game);
      if (action) adapter.apply(game, bot.slot, action);
    }
    adapter.step(game, STEP_S);
    lead.update(adapter.scores(game));
  }
  return { scores: adapter.scores(game), leadChanges: lead.changes };
}

/** `FairnessHarness` für ein Baukasten-Spiel (Eintrag in `FAIRNESS_HARNESSES`). */
export function kitHarness<G>(options: KitHarnessOptions<G>): FairnessHarness {
  return {
    id: options.info.id,
    scoring: options.info.scoring,
    intruders: options.intruders.map(({ id, label }) => ({ id, label })),
    ciSeeds: options.ciSeeds ?? 60,
    play: (seats, seed) => playKitMatch(options, seats, seed),
  };
}
