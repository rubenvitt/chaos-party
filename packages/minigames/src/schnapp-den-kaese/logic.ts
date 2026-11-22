/**
 * Logik von Schnapp den Käse (rein, MG-045): Je Slot eine Mausefalle, auf dem Käse stapeln sich
 * Scheiben. Die Falle schnappt zu einem versteckten Zeitpunkt zu und zuckt kurz vorher, dazu
 * Finten. A schickt die Pfote (`grabS`); schnappt die Falle währenddessen, ist sie gezwickt.
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

export const KAESE_RULES = {
  /** Alle `sliceS` kommt eine Scheibe dazu, höchstens `maxSlices`. */
  sliceS: 0.3,
  maxSlices: 10,
  /** Die Pfote braucht länger, als die Falle nach dem echten Zucken wartet. */
  grabS: 0.5,
  twitchLeadS: 0.45,
  snapS: [1.0, 4.0],
  maxFeints: 2,
  reloadS: 0.6,
  pinchS: 1,
} as const;

export type TrapResult = 'schnapp' | 'gezwickt' | 'leer';

export interface Trap {
  readonly slot: Slot;
  phase: 'wait' | 'cheese' | 'pinched';
  /** Laufende Nummer des Käses (der Bot erkennt einen neuen). */
  serial: number;
  landedAt: number;
  readyAt: number;
  /** Letztes Zucken (sichtbar); echtes und Finte sehen gleich aus. */
  twitchAt: number;
  /** Pfote unterwegs bis (`null` = in Ruhe), Stapel beim Zugreifen. */
  grabEnd: number | null;
  grabbed: number;
  /** Versteckt: Zuschnappen und noch ausstehendes Zucken. */
  snapAt: number;
  twitches: number[];
  last: { readonly result: TrapResult; readonly points: number; readonly at: number } | null;
}

export interface KaeseEvent {
  readonly type: 'land' | 'twitch' | 'reach' | TrapResult;
  readonly trap: Trap;
}

const HIGHLIGHTS: readonly HighlightRule[] = [
  { kind: 'top', stat: 'turm', min: 6, text: (name, n) => `${name} holt ${n} Scheiben am Stück.` },
  { kind: 'top', stat: 'gezwickt', min: 2, text: (name, n) => `${name} wird ${n}× gezwickt.` },
  { kind: 'top', stat: 'leer', min: 3, text: (name, n) => `${name} zögert ${n}× zu lange.` },
];

export class KaeseLogic {
  readonly clock: MatchClock;
  readonly board: Scoreboard;
  readonly tally = new EventTally<TrapResult | 'turm'>();
  readonly traps: Trap[];

  constructor(
    slots: readonly Slot[],
    private readonly rng: MinigameRng,
    timeLimitMs: number,
  ) {
    this.clock = new MatchClock(timeLimitMs);
    this.board = new Scoreboard(slots);
    this.traps = slots.map((slot) => ({
      ...{ slot, phase: 'wait', serial: 0, landedAt: 0, readyAt: 0.5, twitchAt: -9 },
      ...{ grabEnd: null, grabbed: 0, snapAt: 0, twitches: [], last: null },
    }));
  }

  get finished(): boolean {
    return this.clock.expired;
  }

  trap(slot: Slot): Trap | undefined {
    return this.traps.find((trap) => trap.slot === slot);
  }

  slices(trap: Trap): number {
    const age = this.clock.time - trap.landedAt;
    return Math.min(KAESE_RULES.maxSlices, 1 + Math.floor(age / KAESE_RULES.sliceS + 1e-6));
  }

  /** A: Pfote losschicken (nur auf Käse und wenn sie nicht schon unterwegs ist). */
  grab(slot: Slot): KaeseEvent | null {
    const trap = this.trap(slot);
    if (trap?.phase !== 'cheese' || trap.grabEnd !== null || this.finished) return null;
    trap.grabEnd = this.clock.time + KAESE_RULES.grabS;
    trap.grabbed = this.slices(trap);
    return { type: 'reach', trap };
  }

  step(dt: number): KaeseEvent[] {
    if (this.finished) return [];
    this.clock.tick(dt);
    const now = this.clock.time;
    const events: KaeseEvent[] = [];
    for (const trap of this.traps) {
      if (trap.phase !== 'cheese') {
        if (now >= trap.readyAt) events.push(this.land(trap, now));
        continue;
      }
      const twitch = trap.twitches[0];
      if (twitch !== undefined && now >= twitch) {
        trap.twitches.shift();
        trap.twitchAt = now;
        events.push({ type: 'twitch', trap });
      }
      if (now >= trap.snapAt) {
        const pinched = trap.grabEnd !== null;
        events.push(this.end(trap, pinched ? 'gezwickt' : 'leer', 0, now));
      } else if (trap.grabEnd !== null && now >= trap.grabEnd) {
        this.board.add(trap.slot, trap.grabbed);
        const higher = trap.grabbed - this.tally.get(trap.slot, 'turm');
        if (higher > 0) this.tally.count(trap.slot, 'turm', higher);
        events.push(this.end(trap, 'schnapp', trap.grabbed, now));
      }
    }
    return events;
  }

  highlights(names: ReadonlyMap<Slot, string>): string[] {
    return buildHighlights(HIGHLIGHTS, tallyFacts(this.board.slots, names, this.tally));
  }

  private land(trap: Trap, now: number): KaeseEvent {
    const { rng } = this;
    const [min, max] = KAESE_RULES.snapS;
    const { twitchLeadS, maxFeints } = KAESE_RULES;
    trap.phase = 'cheese';
    trap.serial++;
    trap.landedAt = now;
    trap.grabEnd = null;
    trap.snapAt = now + min + rng.next() * (max - min);
    // Finten liegen mit Abstand vor dem echten Zucken, damit beide einzeln lesbar bleiben.
    const room = trap.snapAt - twitchLeadS - 0.5 - (now + 0.4);
    const feints = Math.floor(rng.next() * (maxFeints + 1));
    const feintAt = () => now + 0.4 + rng.next() * room;
    trap.twitches = Array.from({ length: room > 0 ? feints : 0 }, feintAt);
    trap.twitches.push(trap.snapAt - twitchLeadS);
    trap.twitches.sort((a, b) => a - b);
    return { type: 'land', trap };
  }

  private end(trap: Trap, result: TrapResult, points: number, now: number): KaeseEvent {
    this.tally.count(trap.slot, result);
    trap.last = { result, points, at: now };
    trap.phase = result === 'gezwickt' ? 'pinched' : 'wait';
    trap.readyAt = now + (result === 'gezwickt' ? KAESE_RULES.pinchS : KAESE_RULES.reloadS);
    trap.twitches = [];
    return { type: result, trap };
  }
}
