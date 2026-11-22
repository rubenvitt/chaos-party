/**
 * Logik von Bienenstock-Honig (rein, MG-101): Je Slot ein Platz am Bienenstock mit Honigtopf
 * (ungesichert, `RiskBank.pot`) und Vorratsglas (gesichert, `banked`). A zapft: Jeder Zapfer
 * in Folge gibt mehr Honig, macht die Bienen aber wütender auf dich. B bringt den Topf ins
 * Glas (dauert kurz, so lange kein Zapfen). Wütende Bienen stechen angekündigt-zufällig: Die
 * Biene fliegt sichtbar los; wer bei ihrer Ankunft noch Honig im Topf hat, verliert ihn.
 */
import {
  EventTally,
  MatchClock,
  RiskBank,
  buildHighlights,
  tallyFacts,
  type HighlightRule,
} from '@chaos-party/minigame-kit';
import type { MinigameRng, Slot } from '@chaos-party/minigame-sdk';

export const HONEY_RULES = {
  /** Dauer eines Zapfers (Dauerdrücken bringt nicht mehr). */
  tapS: 0.28,
  /** Honig je Zapfer: Grundwert plus Serie (Zapfer seit dem letzten Sichern), gedeckelt. */
  yieldBase: 3,
  yieldCap: 16,
  /** Sichern dauert so lange; Zapfen geht dabei nicht. */
  secureS: 0.5,
  /** Wut der Bienen auf dich: steigt je Zapfer, klingt langsam ab. */
  angerPerTap: 0.1,
  angerDecay: 0.1,
  /** Stich-Rate je Sekunde bei voller Wut (mal Stockwut); Exponent macht leichte Wut harmlos. */
  stingRate: 8,
  stingPower: 1.5,
  /** Anflug einer Biene (angekündigt), am Anfang länger, am Ende kürzer. */
  warnS: [1.1, 0.8],
  stunS: 1.2,
  /** Stockwut: wächst mit der Spielzeit, in der Endphase voll. */
  hiveStart: 0.35,
  finaleS: 6,
} as const;

export interface Keeper {
  readonly slot: Slot;
  state: 'idle' | 'tap' | 'secure' | 'stunned';
  /** Ende des laufenden Zapfers, Sicherns oder der Benommenheit. */
  until: number;
  /** Zapfer seit dem letzten Sichern (sichtbar an der Topf-Größe). */
  streak: number;
  /** Wut der Bienen auf diesen Platz, 0–1 (sichtbar an den Bienen um den Topf). */
  anger: number;
}

/** Eine anfliegende Biene (sichtbar, Ankunft = Stich). */
export interface Bee {
  readonly id: number;
  readonly target: Slot;
  readonly launchedAt: number;
  readonly arriveAt: number;
}

export type HoneyEvent =
  | { readonly type: 'tap'; readonly slot: Slot; readonly amount: number }
  | { readonly type: 'banked'; readonly slot: Slot; readonly amount: number }
  | { readonly type: 'launch'; readonly bee: Bee }
  | { readonly type: 'sting'; readonly slot: Slot; readonly lost: number }
  | { readonly type: 'finale' };

const HIGHLIGHTS: readonly HighlightRule[] = [
  { kind: 'top', stat: 'stung', min: 2, text: (name, n) => `${name} wird ${n}× gestochen.` },
  {
    kind: 'top',
    stat: 'lostBig',
    min: 20,
    text: (n, g) => `${n} verliert ${g} g Honig auf einmal.`,
  },
  { kind: 'top', stat: 'banks', min: 4, text: (name, n) => `${name} bringt ${n}× Honig ins Glas.` },
  { kind: 'last', stat: 'stung', text: (name) => `${name} kassiert den letzten Stich.` },
];

export class HoneyLogic {
  readonly clock: MatchClock;
  readonly bank: RiskBank;
  readonly tally = new EventTally<'stung'>();
  readonly keepers: Keeper[];
  readonly bees: Bee[] = [];
  private nextBee = 1;

  constructor(
    slots: readonly Slot[],
    private readonly rng: MinigameRng,
    timeLimitMs: number,
  ) {
    this.clock = new MatchClock(timeLimitMs, HONEY_RULES.finaleS);
    this.bank = new RiskBank(slots);
    this.keepers = slots.map((slot) => ({ slot, state: 'idle', until: 0, streak: 0, anger: 0 }));
  }

  get finished(): boolean {
    return this.clock.expired;
  }

  /** Stockwut 0–1: steigt mit der Zeit, in der Endphase voll. */
  get hive(): number {
    if (this.clock.finale) return 1;
    const { hiveStart } = HONEY_RULES;
    return hiveStart + (1 - hiveStart) * this.clock.progress * 0.8;
  }

  keeper(slot: Slot): Keeper | undefined {
    return this.keepers.find((keeper) => keeper.slot === slot);
  }

  beeFor(slot: Slot): Bee | undefined {
    return this.bees.find((bee) => bee.target === slot);
  }

  /** A: einmal zapfen. Nur in Ruhe (nicht beim Sichern, nicht benommen). */
  tap(slot: Slot): HoneyEvent | null {
    const keeper = this.keeper(slot);
    if (keeper?.state !== 'idle' || this.finished) return null;
    const amount = Math.min(HONEY_RULES.yieldCap, HONEY_RULES.yieldBase + keeper.streak);
    this.bank.add(slot, amount);
    keeper.streak++;
    keeper.anger = Math.min(1, keeper.anger + HONEY_RULES.angerPerTap * (0.6 + this.hive * 0.6));
    keeper.state = 'tap';
    keeper.until = this.clock.time + HONEY_RULES.tapS;
    return { type: 'tap', slot, amount };
  }

  /** B: Topf ins Glas bringen (dauert `secureS`). Leerer Topf: nichts. */
  secure(slot: Slot): boolean {
    const keeper = this.keeper(slot);
    if (!keeper || this.finished || this.bank.pot(slot) <= 0) return false;
    if (keeper.state !== 'idle' && keeper.state !== 'tap') return false;
    keeper.state = 'secure';
    keeper.until = this.clock.time + HONEY_RULES.secureS;
    return true;
  }

  step(dt: number): HoneyEvent[] {
    if (this.finished) return [];
    const events: HoneyEvent[] = [];
    if (this.clock.tick(dt).finaleStarted) events.push({ type: 'finale' });
    const now = this.clock.time;
    const { angerDecay, stingRate, stingPower, warnS } = HONEY_RULES;
    for (const keeper of this.keepers) {
      const { slot } = keeper;
      if (keeper.state !== 'idle' && now >= keeper.until) {
        if (keeper.state === 'secure') {
          const amount = this.bank.bank(slot);
          keeper.streak = 0;
          events.push({ type: 'banked', slot, amount });
        }
        keeper.state = 'idle';
      }
      keeper.anger = Math.max(0, keeper.anger - angerDecay * dt);
      const chance = stingRate * this.hive * keeper.anger ** stingPower * dt;
      if (!this.beeFor(slot) && keeper.state !== 'stunned' && this.rng.next() < chance) {
        const warn = warnS[0] + (warnS[1] - warnS[0]) * this.clock.progress;
        const arriveAt = now + warn * (0.85 + this.rng.next() * 0.3);
        const bee = { id: this.nextBee++, target: slot, launchedAt: now, arriveAt };
        this.bees.push(bee);
        events.push({ type: 'launch', bee });
      }
    }
    for (const bee of this.bees.filter((entry) => now >= entry.arriveAt)) {
      // Stich: Topf weg (auch mitten im Sichern), kurz benommen, die Wut verraucht etwas.
      this.bees.splice(this.bees.indexOf(bee), 1);
      const keeper = this.keeper(bee.target);
      if (!keeper) continue;
      const lost = this.bank.bust(keeper.slot);
      Object.assign(keeper, { state: 'stunned', until: now + HONEY_RULES.stunS, streak: 0 });
      keeper.anger *= 0.4;
      this.tally.count(keeper.slot, 'stung');
      events.push({ type: 'sting', slot: keeper.slot, lost });
    }
    return events;
  }

  highlights(names: ReadonlyMap<Slot, string>): string[] {
    const account = (slot: Slot) => this.bank.account(slot);
    const extra = {
      lostBig: (slot: Slot) => account(slot)?.biggestLoss ?? 0,
      banks: (slot: Slot) => account(slot)?.banks ?? 0,
    };
    return buildHighlights(HIGHLIGHTS, tallyFacts(this.bank.slots, names, this.tally, extra));
  }
}
