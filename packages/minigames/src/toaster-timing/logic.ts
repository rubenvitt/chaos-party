/**
 * Logik von Toaster-Timing (rein, MG-033): Je Slot ein Toaster. Ein Toast bräunt mit eigenem
 * Tempo (je Toast neu gewürfelt) von 0 bis „verkohlt“; A lässt ihn hochspringen und wertet die
 * Bräunung. Nach kurzer Pause steckt der nächste Toast. Zeit, Punkte, Höhepunkte: Baukasten.
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

export const TOASTER_RULES = {
  /** Goldbraun: volle Punkte. */
  golden: 0.9,
  maxPoints: 10,
  /** Punkte weniger je Bräunungsstufe Abstand zu goldbraun. */
  slope: 25,
  /** Ab hier verkohlt der Toast von selbst (0 Punkte, Toaster raucht). */
  burnt: 1.3,
  /** Bräunung je Sekunde; jeder Toast zieht eines dieser Tempi. */
  rates: [0.3, 0.36, 0.44, 0.54],
  /** Endphase: alle Toaster rösten schneller. */
  finaleS: 6,
  finaleFactor: 1.3,
  /** Pause nach dem Hochspringen bzw. nach dem Verkohlen, bis der nächste Toast steckt. */
  reloadS: 0.6,
  burntReloadS: 1.2,
} as const;

export type ToastResult = 'golden' | 'good' | 'pale' | 'burnt';

export interface Toaster {
  readonly slot: Slot;
  /** Steckt gerade ein Toast? */
  loaded: boolean;
  /** Bräunung 0 … `burnt` (sichtbar an der Farbe). */
  browning: number;
  /** Bräunung je Sekunde dieses Toasts. */
  rate: number;
  /** Laufende Nummer des Toasts (Bot: neuer Toast erkannt). */
  serial: number;
  /** Ab wann der nächste Toast steckt. */
  reloadAt: number;
  /** Ergebnis des letzten Toasts (für Anzeige und Höhepunkte). */
  last: { readonly result: ToastResult; readonly points: number; readonly browning: number } | null;
}

export type ToasterEvent =
  | { readonly type: 'load'; readonly slot: Slot }
  | {
      readonly type: 'pop';
      readonly slot: Slot;
      readonly result: ToastResult;
      readonly points: number;
    }
  | { readonly type: 'burn'; readonly slot: Slot }
  | { readonly type: 'finale' };

const HIGHLIGHTS: readonly HighlightRule[] = [
  { kind: 'top', stat: 'golden', min: 2, text: (name, n) => `${name} toastet ${n}× goldbraun.` },
  { kind: 'top', stat: 'burnt', min: 2, text: (name, n) => `${name} lässt ${n} Toasts verkohlen.` },
  { kind: 'top', stat: 'pale', min: 3, text: (name, n) => `${name} isst ${n} blasse Toasts.` },
  { kind: 'last', stat: 'golden', text: (name) => `${name} röstet den letzten goldbraunen Toast.` },
];

/** Punkte für eine Bräunung (rein, für Tests und Anzeige). */
export function toastPoints(browning: number): number {
  const { golden, maxPoints, slope, burnt } = TOASTER_RULES;
  if (browning >= burnt) return 0;
  return Math.max(0, Math.round(maxPoints - Math.abs(browning - golden) * slope));
}

export function toastResult(browning: number): ToastResult {
  if (browning >= TOASTER_RULES.burnt) return 'burnt';
  const points = toastPoints(browning);
  if (points >= 9) return 'golden';
  return browning < TOASTER_RULES.golden ? (points >= 5 ? 'good' : 'pale') : 'good';
}

export class ToasterLogic {
  readonly clock: MatchClock;
  readonly board: Scoreboard;
  readonly tally = new EventTally<ToastResult>();
  readonly toasters: Toaster[];

  constructor(
    slots: readonly Slot[],
    private readonly rng: MinigameRng,
    timeLimitMs: number,
  ) {
    this.clock = new MatchClock(timeLimitMs, TOASTER_RULES.finaleS);
    this.board = new Scoreboard(slots);
    this.toasters = slots.map((slot) => ({
      slot,
      loaded: false,
      browning: 0,
      rate: 0,
      serial: 0,
      reloadAt: 0.4,
      last: null,
    }));
  }

  get finished(): boolean {
    return this.clock.expired;
  }

  toaster(slot: Slot): Toaster | undefined {
    return this.toasters.find((toaster) => toaster.slot === slot);
  }

  /** A: Toast hochspringen lassen. Ohne Toast im Schlitz passiert nichts. */
  pop(slot: Slot): ToasterEvent | null {
    const toaster = this.toaster(slot);
    if (!toaster || !toaster.loaded || this.finished) return null;
    const points = toastPoints(toaster.browning);
    const result = toastResult(toaster.browning);
    this.board.add(slot, points);
    this.tally.count(slot, result);
    toaster.last = { result, points, browning: toaster.browning };
    toaster.loaded = false;
    toaster.reloadAt = this.clock.time + TOASTER_RULES.reloadS;
    return { type: 'pop', slot, result, points };
  }

  step(dt: number): ToasterEvent[] {
    if (this.finished) return [];
    const events: ToasterEvent[] = [];
    if (this.clock.tick(dt).finaleStarted) events.push({ type: 'finale' });
    const now = this.clock.time;
    const speed = this.clock.finale ? TOASTER_RULES.finaleFactor : 1;
    for (const toaster of this.toasters) {
      if (!toaster.loaded) {
        if (now >= toaster.reloadAt) {
          const { rates } = TOASTER_RULES;
          toaster.loaded = true;
          toaster.browning = 0;
          toaster.rate = rates[Math.floor(this.rng.next() * rates.length)] ?? rates[0];
          toaster.serial++;
          events.push({ type: 'load', slot: toaster.slot });
        }
        continue;
      }
      toaster.browning += toaster.rate * speed * dt;
      if (toaster.browning >= TOASTER_RULES.burnt) {
        this.tally.count(toaster.slot, 'burnt');
        toaster.last = { result: 'burnt', points: 0, browning: toaster.browning };
        toaster.loaded = false;
        toaster.reloadAt = now + TOASTER_RULES.burntReloadS;
        events.push({ type: 'burn', slot: toaster.slot });
      }
    }
    return events;
  }

  highlights(names: ReadonlyMap<Slot, string>): string[] {
    return buildHighlights(HIGHLIGHTS, tallyFacts(this.board.slots, names, this.tally));
  }
}
