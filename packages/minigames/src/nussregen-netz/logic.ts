/**
 * Logik von Nussregen-Netz (rein, MG-001): Drei Eichhörnchen werfen Nüsse aus der Krone auf eine
 * Lauffläche, breit in x, schmal in z (Seitenansicht). Gefangen wird, wo die Nuss auf
 * Kescherhöhe ankommt; nur x zählt, z ist die feste Reihe der Figur.
 */
import {
  EventTally,
  MatchClock,
  Scoreboard,
  Spawner,
  arcPosition,
  buildHighlights,
  tallyFacts,
  warningProgress,
  type HighlightRule,
  type SpawnTiming,
} from '@chaos-party/minigame-kit';
import type { MinigameRng, Slot } from '@chaos-party/minigame-sdk';

export const NUSS_RULES = {
  halfX: 7,
  speed: 5.5,
  /** Kescher-Mitte vor der Figur und halbe Breite des Fangbereichs. */
  netOffset: 0.75,
  reach: 0.6,
  /** Weit-Schwung: Dauer, Reichweite voraus, bis zu dieser Höhe über dem Kescher. */
  swingS: 0.3,
  swingReach: 2.8,
  swingHeight: 1.8,
  swingPoints: 7,
  /** Nach dem Schwung lahm: weder laufen noch fangen (A-Hämmern lohnt nicht). */
  lameS: 1,
  rottenChance: 0.22,
  rottenPenalty: 4,
  stinkS: 1.6,
  stinkFactor: 0.45,
  finaleS: 6,
  crownY: 5.2,
  netY: 0.9,
} as const;

/** Takt der Würfe, im „Nusssturm“ dichter; `warnS` = Flugzeit (die Vorwarnung). */
const SPAWNS = { firstS: 0.8, everyS: 0.42, finaleEveryS: 0.3, warnS: 1.35 } as const;
/** Äste der Eichhörnchen in x; jedes wirft in seine Nachbarschaft. */
export const SQUIRRELS = [-4.6, 0, 4.6] as const;
/** Reihen der Figuren in z, gestaffelt, damit sich in der Seitenansicht niemand verdeckt. */
const ROWS = [-0.75, -0.25, 0.25, 0.75];

/** `x` = Landepunkt auf Kescherhöhe, `from` = werfendes Eichhörnchen. */
export type Nut = SpawnTiming & { id: number; x: number; from: number; rotten: boolean };

export interface Catcher {
  readonly slot: Slot;
  readonly z: number;
  x: number;
  facing: 1 | -1;
  stickX: number;
  swingUntil: number;
  /** Bis dahin weder laufen noch normal fangen (umfasst den Schwung). */
  lameUntil: number;
  stinkUntil: number;
}

export type NussEvent =
  | { type: 'spawn' | 'miss'; nut: Nut }
  | { type: 'catch'; nut: Nut; slot: Slot; points: number }
  | { type: 'finale' };

const HIGHLIGHTS: readonly HighlightRule[] = [
  { kind: 'top', stat: 'fang', min: 3, text: (name, n) => `${name} fängt ${n} Nüsse.` },
  { kind: 'top', stat: 'weit', min: 3, text: (name, n) => `${name} schwingt ${n}× erfolgreich.` },
  { kind: 'top', stat: 'faul', min: 2, text: (name, n) => `${name} fängt ${n} faule Nüsse.` },
  { kind: 'last', stat: 'fang', text: (name) => `${name} fängt die letzte Nuss.` },
];

export function netX(catcher: Catcher): number {
  return catcher.x + catcher.facing * NUSS_RULES.netOffset;
}

/** Ort einer Nuss im Flug: Bogen vom Ast bis auf Kescherhöhe. */
export function nutPosition(nut: Nut, now: number): { x: number; y: number; z: number } {
  const { crownY, netY } = NUSS_RULES;
  const from = { x: SQUIRRELS[nut.from] ?? 0, y: crownY - netY, z: 0.5 };
  const at = arcPosition(from, { x: nut.x, z: 0 }, warningProgress(nut, now), 0.8);
  return { ...at, y: at.y + netY };
}

/** Punkte für einen Fang `offset` neben der Kescher-Mitte: Mitte 10, Rand 6 (selten Gleichstand). */
export function catchPoints(offset: number): number {
  return Math.round(6 + 4 * Math.max(0, 1 - Math.abs(offset) / NUSS_RULES.reach));
}

export function inSwingZone(catcher: Catcher, nut: Nut, now: number): boolean {
  const at = nutPosition(nut, now);
  const ahead = (at.x - catcher.x) * catcher.facing;
  const low = at.y - NUSS_RULES.netY <= NUSS_RULES.swingHeight;
  return low && ahead >= -0.3 && ahead <= NUSS_RULES.swingReach;
}

export class NussLogic {
  readonly clock: MatchClock;
  readonly board: Scoreboard;
  readonly tally = new EventTally<'fang' | 'faul' | 'weit'>();
  readonly catchers: Catcher[];
  readonly nuts: Nut[] = [];
  private readonly spawner = new Spawner(SPAWNS);
  private nextId = 1;

  constructor(
    slots: readonly Slot[],
    private readonly rng: MinigameRng,
    timeLimitMs: number,
  ) {
    this.clock = new MatchClock(timeLimitMs, NUSS_RULES.finaleS);
    this.board = new Scoreboard(slots);
    const idle = { stickX: 0, swingUntil: 0, lameUntil: 0, stinkUntil: 0 };
    this.catchers = slots.map((slot, index): Catcher => {
      const x = ((index + 0.5) / slots.length - 0.5) * 9;
      return { slot, x, z: ROWS[index] ?? 0, facing: x < 0 ? 1 : -1, ...idle };
    });
  }

  get finished(): boolean {
    return this.clock.expired;
  }

  catcher(slot: Slot): Catcher | undefined {
    return this.catchers.find((catcher) => catcher.slot === slot);
  }

  speed(catcher: Catcher): number {
    const stink = this.clock.time < catcher.stinkUntil ? NUSS_RULES.stinkFactor : 1;
    return NUSS_RULES.speed * stink;
  }

  setStick(slot: Slot, x: number): void {
    const catcher = this.catcher(slot);
    if (catcher) catcher.stickX = Number.isFinite(x) ? Math.max(-1, Math.min(1, x)) : 0;
  }

  /** A: Weit-Schwung, nur wenn nicht lahm. */
  swing(slot: Slot): boolean {
    const catcher = this.catcher(slot);
    const now = this.clock.time;
    if (!catcher || this.finished || now < catcher.lameUntil) return false;
    catcher.swingUntil = now + NUSS_RULES.swingS;
    catcher.lameUntil = catcher.swingUntil + NUSS_RULES.lameS;
    return true;
  }

  step(dt: number): NussEvent[] {
    if (this.finished) return [];
    const { clock, rng } = this;
    const events: NussEvent[] = [];
    if (clock.tick(dt).finaleStarted) events.push({ type: 'finale' });
    const now = clock.time;
    const limit = NUSS_RULES.halfX - 0.4;
    for (let n = this.spawner.poll(now, clock.finale, clock.limitS); n > 0; n--) {
      const from = Math.floor(rng.next() * SQUIRRELS.length);
      const x = (SQUIRRELS[from] ?? 0) + (rng.next() * 2 - 1) * 2.6;
      const rotten = rng.next() < NUSS_RULES.rottenChance;
      const nut: Nut = {
        id: this.nextId++,
        x: Math.max(-limit, Math.min(limit, x)),
        from,
        rotten,
        ...this.spawner.timing(now),
      };
      this.nuts.push(nut);
      events.push({ type: 'spawn', nut });
    }
    for (const catcher of this.catchers) {
      if (now < catcher.lameUntil) continue;
      const x = catcher.x + catcher.stickX * this.speed(catcher) * dt;
      catcher.x = Math.max(-NUSS_RULES.halfX, Math.min(NUSS_RULES.halfX, x));
      if (Math.abs(catcher.stickX) > 0.15) catcher.facing = catcher.stickX > 0 ? 1 : -1;
    }
    for (const catcher of this.catchers.filter((candidate) => now < candidate.swingUntil)) {
      for (const nut of this.nuts.filter((candidate) => inSwingZone(catcher, candidate, now))) {
        events.push(this.take(nut, catcher, NUSS_RULES.swingPoints, 'weit'));
      }
    }
    for (const nut of this.nuts.filter((candidate) => now >= candidate.arriveAt)) {
      // Der Kescher, dessen Mitte der Nuss am nächsten ist (lahme Kescher liegen am Boden).
      const offset = (catcher: Catcher) => Math.abs(nut.x - netX(catcher));
      const best = this.catchers
        .filter((catcher) => now >= catcher.lameUntil && offset(catcher) <= NUSS_RULES.reach)
        .sort((a, b) => offset(a) - offset(b))[0];
      if (best) events.push(this.take(nut, best, catchPoints(offset(best)), 'fang'));
      else {
        this.nuts.splice(this.nuts.indexOf(nut), 1);
        events.push({ type: 'miss', nut });
      }
    }
    return events;
  }

  private take(nut: Nut, catcher: Catcher, points: number, how: 'fang' | 'weit'): NussEvent {
    this.nuts.splice(this.nuts.indexOf(nut), 1);
    const { slot } = catcher;
    if (nut.rotten) {
      catcher.stinkUntil = this.clock.time + NUSS_RULES.stinkS;
      this.tally.count(slot, 'faul');
      points = -NUSS_RULES.rottenPenalty;
    } else {
      this.tally.count(slot, 'fang');
      if (how === 'weit') this.tally.count(slot, 'weit');
    }
    this.board.add(slot, points);
    return { type: 'catch', nut, slot, points };
  }

  highlights(names: ReadonlyMap<Slot, string>): string[] {
    return buildHighlights(HIGHLIGHTS, tallyFacts(this.board.slots, names, this.tally));
  }
}
