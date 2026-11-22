/**
 * Logik von Drei Türen (rein, MG-111): mehrere Runden; je Runde zeigen drei Türen ihren Wert
 * (Münzen), alle wählen geheim eine Tür (Stick links/oben/rechts, A legt fest). Beim Aufdecken
 * zahlt eine Tür nur aus, wenn genau eine Person davorsteht; volle Türen gehen leer aus, wer
 * nicht gewählt hat, auch. Öffentlich sind nur „hat gewählt“ und die aufgedeckten Runden.
 */
import {
  EventTally,
  MatchClock,
  Scoreboard,
  buildHighlights,
  tallyFacts,
  type HighlightRule,
} from '@chaos-party/minigame-kit';
import type { MinigameRng, Slot } from '@chaos-party/minigame-sdk';

export const DOOR_RULES = {
  rounds: 8,
  /** Vorlauf vor der ersten Runde, Wahlzeit und Aufdecken je Runde (s). */
  leadS: 0.4,
  chooseS: 2.3,
  revealS: 1.0,
  /** Münzen je Tür: drei verschiedene Werte aus diesem Bereich. */
  values: [2, 9],
  /** Die letzte Runde zählt doppelt. */
  finalFactor: 2,
} as const;

export const DOORS = 3;
export type Door = 0 | 1 | 2;

/** Eine aufgedeckte Runde (sichtbar für alle, Grundlage der Bots). */
export interface RoundRecord {
  readonly values: readonly number[];
  readonly choices: ReadonlyMap<Slot, Door | null>;
  /** Personen je Tür. */
  readonly crowd: readonly number[];
  readonly payouts: ReadonlyMap<Slot, number>;
}

export type DoorEvent =
  | { readonly type: 'round'; readonly index: number }
  | { readonly type: 'chosen'; readonly slot: Slot }
  | { readonly type: 'reveal'; readonly record: RoundRecord };

/** Stick → Tür: links 0, oben 1, rechts 2; Stick in Ruhe (oder nach unten) = keine. */
export function doorOf(x: number, y: number): Door | null {
  if (Math.hypot(x, y) < 0.5) return null;
  if (Math.abs(x) >= Math.abs(y) * 0.8) return x < 0 ? 0 : 2;
  return y > 0 ? 1 : null;
}

const HIGHLIGHTS: readonly HighlightRule[] = [
  {
    kind: 'top',
    stat: 'alone',
    min: 2,
    text: (name, n) => `${name} steht ${n}× allein vor der Tür.`,
  },
  {
    kind: 'top',
    stat: 'crowd',
    min: 3,
    text: (name, n) => `${name} drängelt sich ${n}× ins Gewühl.`,
  },
  { kind: 'top', stat: 'late', min: 2, text: (name, n) => `${name} vergisst ${n}× zu wählen.` },
  { kind: 'last', stat: 'alone', text: (name) => `${name} öffnet die letzte Tür allein.` },
];

export class DoorLogic {
  readonly clock: MatchClock;
  readonly board: Scoreboard;
  readonly tally = new EventTally<'alone' | 'crowd' | 'late'>();
  readonly history: RoundRecord[] = [];
  /** Laufende Runde (−1 = Vorlauf), ihre Türwerte und ob gewählt werden darf. */
  round = -1;
  values: number[] = [0, 0, 0];
  open = false;
  /** Geheim: Wahl der laufenden Runde. Ansicht und Bots lesen nur `hasChosen`. */
  readonly #choices = new Map<Slot, Door>();
  readonly #aim = new Map<Slot, Door | null>();

  constructor(
    readonly slots: readonly Slot[],
    private readonly rng: MinigameRng,
    timeLimitMs: number,
  ) {
    this.clock = new MatchClock(timeLimitMs);
    this.board = new Scoreboard(slots);
  }

  get finished(): boolean {
    return this.clock.expired;
  }

  get final(): boolean {
    return this.round === DOOR_RULES.rounds - 1;
  }

  /** Beginn der Runde `index` in s. */
  static startOf(index: number): number {
    return DOOR_RULES.leadS + index * (DOOR_RULES.chooseS + DOOR_RULES.revealS);
  }

  /** Restliche Wahlzeit der laufenden Runde in s (0 = geschlossen). */
  get chooseLeft(): number {
    if (!this.open) return 0;
    return Math.max(0, DoorLogic.startOf(this.round) + DOOR_RULES.chooseS - this.clock.time);
  }

  hasChosen(slot: Slot): boolean {
    return this.#choices.has(slot);
  }

  /** Stick: merkt die Richtung (nicht sichtbar). */
  aim(slot: Slot, x: number, y: number): void {
    this.#aim.set(slot, doorOf(x, y));
  }

  /** A: Tür der aktuellen Stick-Richtung festlegen (einmal je Runde; ohne Richtung nichts). */
  choose(slot: Slot): DoorEvent | null {
    const door = this.#aim.get(slot) ?? null;
    if (!this.open || this.finished || door === null || this.#choices.has(slot)) return null;
    if (!this.slots.includes(slot)) return null;
    this.#choices.set(slot, door);
    return { type: 'chosen', slot };
  }

  step(dt: number): DoorEvent[] {
    if (this.finished) return [];
    this.clock.tick(dt);
    const now = this.clock.time;
    const events: DoorEvent[] = [];
    const next = this.round + 1;
    if (next < DOOR_RULES.rounds && now >= DoorLogic.startOf(next)) {
      this.round = next;
      this.values = this.drawValues();
      this.open = true;
      this.#choices.clear();
      events.push({ type: 'round', index: next });
    }
    if (this.open && now >= DoorLogic.startOf(this.round) + DOOR_RULES.chooseS) {
      this.open = false;
      events.push({ type: 'reveal', record: this.reveal() });
    }
    return events;
  }

  private drawValues(): number[] {
    const [low, high] = DOOR_RULES.values;
    const pool = Array.from({ length: high - low + 1 }, (_, index) => low + index);
    const factor = this.final ? DOOR_RULES.finalFactor : 1;
    return [0, 1, 2].map(() => {
      const pick = pool.splice(Math.floor(this.rng.next() * pool.length), 1)[0] ?? low;
      return pick * factor;
    });
  }

  private reveal(): RoundRecord {
    const choices = new Map<Slot, Door | null>();
    const crowd = [0, 0, 0];
    for (const slot of this.slots) {
      const door = this.#choices.get(slot) ?? null;
      choices.set(slot, door);
      if (door === null) this.tally.count(slot, 'late');
      else crowd[door] = (crowd[door] ?? 0) + 1;
    }
    const payouts = new Map<Slot, number>();
    for (const [slot, door] of choices) {
      if (door === null) continue;
      const alone = crowd[door] === 1;
      this.tally.count(slot, alone ? 'alone' : 'crowd');
      const coins = alone ? (this.values[door] ?? 0) : 0;
      payouts.set(slot, coins);
      this.board.add(slot, coins);
    }
    const record = { values: [...this.values], choices, crowd, payouts };
    this.history.push(record);
    this.#choices.clear();
    return record;
  }

  highlights(names: ReadonlyMap<Slot, string>): string[] {
    return buildHighlights(HIGHLIGHTS, tallyFacts(this.slots, names, this.tally));
  }
}
