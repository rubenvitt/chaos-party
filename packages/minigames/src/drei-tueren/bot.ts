/**
 * Bot für Drei Türen: sieht nur die Türwerte, wer schon gewählt hat (Haken) und die
 * aufgedeckten Runden – nie die Wahl der laufenden Runde. Jeder Bot hat eine Gewohnheit
 * (gierig zur höchsten Tür, treu zur letzten Tür oder bunt gemischt). Mit Wahrscheinlichkeit
 * `judgement` denkt er nach: Er schätzt aus den Aufdeckungen die Gewohnheiten der anderen,
 * rechnet je Tür Wert × Chance, allein zu stehen, und zieht daraus gewichtet. Aussetzer =
 * vergisst zu wählen. Nach dem Drücken lässt er den Stick los wie ein Mensch.
 */
import {
  kitBotDriver,
  profileForStrength,
  reactionSample,
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
import { DOOR_RULES, DoorLogic, type Door, type RoundRecord } from './logic.ts';

export type DoorHabit = 'gierig' | 'treu' | 'bunt';
const HABITS: readonly DoorHabit[] = ['gierig', 'gierig', 'treu', 'bunt'];
/** Gezogen wird ∝ Erwartung^SHARPNESS (gleich gute Bots landen nicht alle an derselben Tür). */
const SHARPNESS = 2;
/**
 * Nachdenken mit Wahrscheinlichkeit judgement^THINK_POWER: Profi 73 %, Normal 22 %, Neuling 6 %.
 * Sonst folgen Bots ihrer Gewohnheit – die liest der Profi aus den Aufdeckungen.
 */
const THINK_POWER = 3;

const STICK: Record<Door, { x: number; y: number }> = {
  0: { x: -1, y: 0 },
  1: { x: 0, y: 1 },
  2: { x: 1, y: 0 },
};

const best = (values: readonly number[]): Door => values.indexOf(Math.max(...values)) as Door;

/** Rang einer Tür nach ihrem Wert (0 = höchste). */
const rankOf = (values: readonly number[], door: number): number =>
  values.filter((value) => value > (values[door] ?? 0)).length;

/**
 * Schätzt aus den Aufdeckungen, mit welcher Wahrscheinlichkeit `slot` welche Tür nimmt: wie
 * oft er die höchste, mittlere, niedrigste Tür nahm, dazu wie oft er bei seiner Tür blieb.
 */
export function predict(history: readonly RoundRecord[], slot: Slot, values: readonly number[]) {
  const ranks = [1, 1, 1];
  let loyal = 0;
  let late = 0;
  let last: Door | null = null;
  for (const record of history) {
    const door = record.choices.get(slot) ?? null;
    if (door === null) {
      late++;
      continue;
    }
    const rank = rankOf(record.values, door);
    ranks[rank] = (ranks[rank] ?? 0) + 1;
    if (door === last) loyal++;
    last = door;
  }
  const total = ranks.reduce((sum, n) => sum + n, 0) + loyal;
  const present = 1 - late / (history.length + 1);
  return [0, 1, 2].map((door) => {
    const p = (ranks[rankOf(values, door)] ?? 0) + (door === last ? loyal : 0);
    return (p / total) * present;
  });
}

/** Anteil der Aufdeckungen, die eine Gewohnheit erklärt (höchste oder wieder dieselbe Tür). */
function habitShare(history: readonly RoundRecord[], slot: Slot): number {
  let hits = 1;
  let rounds = 2;
  let last: Door | null = null;
  for (const record of history) {
    const door = record.choices.get(slot) ?? null;
    if (door === null) continue;
    if (door === best(record.values) || door === last) hits++;
    rounds++;
    last = door;
  }
  return hits / rounds;
}

/** Wahl-Verteilung: ∝ (Wert × Chance, allein zu stehen)^Schärfe. */
function spread(values: readonly number[], others: readonly (readonly number[])[]): number[] {
  const weights = values.map((value, door) => {
    const free = others.reduce((product, p) => product * (1 - (p[door] ?? 0)), 1);
    return (value * free) ** SHARPNESS;
  });
  const total = weights.reduce((sum, w) => sum + w, 0) || 1;
  return weights.map((w) => w / total);
}

export class DoorBot implements MinigameBot<DoorLogic> {
  private plan: { round: number; door: Door | null; at: number } | null = null;
  private release = false;
  readonly habit: DoorHabit;
  decisions = 0;

  constructor(
    readonly slot: Slot,
    readonly profile: BotProfile,
    private readonly rng: MinigameRng,
    habit?: DoorHabit,
  ) {
    this.habit = habit ?? HABITS[Math.floor(rng.next() * HABITS.length)] ?? 'gierig';
  }

  /** Eindringling ohne Nachdenken: folgt nur seiner Gewohnheit. */
  static habitual(slot: Slot, profile: BotProfile, rng: MinigameRng, habit: DoorHabit): DoorBot {
    return new DoorBot(slot, { ...profile, judgement: 0 }, rng, habit);
  }

  act(game: DoorLogic): BotAction | null {
    if (this.release) {
      this.release = false;
      return { stick: { x: 0, y: 0 } };
    }
    if (!game.open || game.hasChosen(this.slot)) return null;
    if (this.plan?.round !== game.round) this.plan = this.makePlan(game);
    const { door, at } = this.plan;
    if (door === null || game.clock.time < at) return null;
    this.decisions++;
    this.release = true;
    return { stick: STICK[door], press: ['a'] };
  }

  private makePlan(game: DoorLogic): { round: number; door: Door | null; at: number } {
    const { profile, rng } = this;
    const round = game.round;
    const think = reactionSample(rng, profile.reactionMs) / 1000 + rng.next();
    const at = DoorLogic.startOf(round) + Math.min(DOOR_RULES.chooseS - 0.3, think);
    if (rng.next() < profile.lapse) return { round, door: null, at };
    const door =
      rng.next() < profile.judgement ** THINK_POWER ? this.weigh(game) : this.habitual(game);
    return { round, door, at };
  }

  /** Wert × Chance, allein zu stehen (aus den Gewohnheiten der anderen), gewichtet gezogen. */
  private weigh(game: DoorLogic): Door {
    const others = game.slots.filter((slot) => slot !== this.slot);
    const habits = others.map((slot) => predict(game.history, slot, game.values));
    const first = spread(game.values, habits);
    // Zweiter Gedanke: Wer sich selten an Gewohnheiten hält, denkt wohl wie ich.
    const mixed = others.map((slot, index) => {
      const share = habitShare(game.history, slot);
      return (habits[index] ?? []).map((p, door) => share * p + (1 - share) * (first[door] ?? 0));
    });
    const mine = spread(game.values, mixed);
    let pick = this.rng.next();
    for (const [door, weight] of mine.entries()) {
      pick -= weight;
      if (pick <= 0) return door as Door;
    }
    return 2;
  }

  private habitual(game: DoorLogic): Door {
    const last = game.history.at(-1)?.choices.get(this.slot) ?? null;
    if (this.habit === 'gierig') return best(game.values);
    if (this.habit === 'treu' && last !== null) return last;
    return Math.floor(this.rng.next() * 3) as Door;
  }
}

/** Drei Türen für `runBotMatch` und die Fairness-Prüfung (`kitHarness`). */
export const DOOR_BOT_ADAPTER: BotMatchAdapter<DoorLogic> = {
  create: (slots, rng, durationMs) => new DoorLogic(slots, rng, durationMs),
  bot: (slot, profile, rng) => new DoorBot(slot, profile, rng),
  apply: (game, slot, action) => {
    if (action.stick) game.aim(slot, action.stick.x, action.stick.y);
    if (action.press?.includes('a')) game.choose(slot);
  },
  step: (game, dt) => void game.step(dt),
  finished: (game) => game.finished,
  scores: (game) => game.board.entries().map((entry) => entry.score),
  elapsedMs: (game) => game.clock.time * 1000,
};

/** Laufzeit-Bot für einen KI-Platz (`Minigame.createBot`). */
export function createDoorBot(
  options: MinigameBotOptions,
  observe: () => DoorLogic | null,
): MinigameBotDriver {
  const bot = new DoorBot(options.slot, profileForStrength(options.strength), options.rng);
  return kitBotDriver(bot, observe);
}
