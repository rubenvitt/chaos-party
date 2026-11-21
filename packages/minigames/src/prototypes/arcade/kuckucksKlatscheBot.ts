/**
 * EXP-016 (CHAOS-54): Bot-Partien auf der **echten** Logik von Kuckucks-Klatsche
 * (`packages/minigames/src/kuckucks-klatsche/logic.ts`), fester Schritt 1/60 s. Der Bot selbst
 * liegt seit CHAOS-180 im Produktcode (`../../kuckucks-klatsche/bot.ts`).
 *
 * Bots sehen nur, was ein Mensch am Fernseher sieht: welche Tür rappelt, was herausspringt,
 * wann der Gong kommt, ob ein Kuckuck schon weg ist. Reaktionszeiten und Fehler stammen aus
 * den Profilen von EXP-005 (`common.ts`, Annahmen, nicht gemessen).
 *
 * Strategien:
 * - `normal`: reagiert auf die eigene Tür, klaut mit Wahrscheinlichkeit `judgement`.
 * - `brav`: klaut nie.
 * - `raffzahn`: klaut jeden freigegebenen Kuckuck.
 * - `dauer`: drückt stur alle `spamS` Sekunden, egal was passiert („Dauerklatscher“).
 */
import { createMinigameRng, type Slot } from '@chaos-party/minigame-sdk';
import { KUCKUCK_SPAM_S, KuckuckBot, type KuckuckStrategy } from '../../kuckucks-klatsche/bot.ts';
import {
  KUCKUCK_RULES,
  KuckucksKlatscheLogic,
  type KuckuckRules,
} from '../../kuckucks-klatsche/logic.ts';
import {
  BOT_PROFILES,
  LeadTracker,
  lineup,
  type BotProfile,
  type GameRecord,
  type PlayerCount,
} from './common.ts';

export type { KuckuckStrategy } from '../../kuckucks-klatsche/bot.ts';

const STEP_S = 1 / 60;
const SLOTS: readonly Slot[] = [1, 2, 3, 4];

export interface KuckuckSimOptions {
  readonly rules?: KuckuckRules;
  readonly profiles?: readonly BotProfile[];
  readonly strategies?: readonly KuckuckStrategy[];
  readonly durationMs?: number;
  readonly spamS?: number;
}

export interface KuckuckSimRecord extends GameRecord {
  readonly steals: number;
  readonly fintes: number;
  readonly empty: number;
  readonly escaped: number;
}

/** Eine Runde Kuckucks-Klatsche mit Bots. Index 0 der Profile/Strategien = Slot 1. */
export function simulateKuckucksKlatsche(
  players: PlayerCount,
  seed: number,
  options: KuckuckSimOptions = {},
): KuckuckSimRecord {
  const profiles = options.profiles ?? lineup(players);
  const durationMs = options.durationMs ?? 30_000;
  const slots = SLOTS.slice(0, players);
  const logic = new KuckucksKlatscheLogic(
    slots,
    createMinigameRng(seed),
    durationMs,
    options.rules ?? KUCKUCK_RULES,
  );
  const bots = slots.map(
    (slot, index) =>
      new KuckuckBot(
        slot,
        profiles[index] ?? BOT_PROFILES.normal,
        options.strategies?.[index] ?? 'normal',
        createMinigameRng((seed * 31 + slot * 977) ^ 0x6b75),
        options.spamS ?? KUCKUCK_SPAM_S,
      ),
  );
  const lead = new LeadTracker((durationMs * 2) / 3);
  const actions = slots.map(() => 0);
  while (!logic.ended) {
    logic.step(STEP_S);
    const events = logic.drainEvents();
    bots.forEach((bot, index) => {
      bot.observe(logic.t, events);
      actions[index] =
        (actions[index] ?? 0) +
        bot.act(logic, () => {
          logic.press(bot.slot);
        });
    });
    lead.update(
      logic.clappers.map((clapper) => clapper.score),
      logic.t * 1000,
    );
  }
  const sum = (key: 'steals' | 'fintes' | 'empty' | 'escaped') =>
    logic.clappers.reduce((total, clapper) => total + clapper[key], 0);
  return {
    durationMs,
    scores: logic.clappers.map((clapper) => clapper.score),
    leadChanges: lead.changes,
    leaderAtTwoThirds: lead.leaderAtTwoThirds,
    actions,
    steals: sum('steals'),
    fintes: sum('fintes'),
    empty: sum('empty'),
    escaped: sum('escaped'),
  };
}
