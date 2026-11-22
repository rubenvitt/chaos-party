/**
 * Logik von Matschmaler (rein, MG-121): Die Wiese ist ein Raster; das Feld unter jeder Figur
 * gehört ihr (übermalt fremde). Bauchplatscher = Hechten, beim Aufkommen färbt ein großer
 * Kreis, danach benommen. Regen wird als Streifen angekündigt und wäscht ihn neutral.
 * Punkte = eigene Felder.
 */
import {
  EventTally,
  HazardField,
  MatchClock,
  Scoreboard,
  arenaLayout,
  buildHighlights,
  createWalker,
  resolveBumps,
  setWalkerStick,
  shapeContains,
  stepWalker,
  stunWalker,
  tallyFacts,
  tryDash,
  type Hazard,
  type HighlightRule,
  type WalkerState,
} from '@chaos-party/minigame-kit';
import type { MinigameRng, Slot } from '@chaos-party/minigame-sdk';

export const MATSCH_RULES = {
  /** Großes Raster, gemächliches Tempo: weniger Übermalen, Laufwege zählen (verworfen: 14×10
   * mit Tempo 5, da war der Ausgang fast Zufall, schwer schlug leicht nur in 44–63 %). */
  cols: 16,
  rows: 12,
  speed: 4,
  /** Bauchplatscher: Rutschen (Hechten) und Abklingzeit. */
  dashFactor: 2.2,
  dashS: 0.25,
  dashCooldownS: 2.8,
  splatRadius: 1.7,
  splatStunS: 0.8,
  /** Regen: ab `rainFirstS` alle `rainEveryS` ein Streifen, zwei Felder breit; wer im
   * Schauer steht, rutscht aus. Öfter Regen = mehr Glück (verworfen: alle 5 s). */
  rainFirstS: 4,
  rainEveryS: 7,
  rainWarnS: 1.6,
  rainS: 1.2,
  rainSlipS: 1.4,
} as const;

const BUMPS = { bodyRadius: 0.45, knockback: 0.9, stunS: 0.5 } as const;
export const MATSCH_ARENA = arenaLayout({
  form: 'eckig',
  halfX: MATSCH_RULES.cols / 2,
  halfZ: MATSCH_RULES.rows / 2,
});

export type Mudder = WalkerState & { readonly slot: Slot; splatAt: number | null };
/** Besitzer je Feld (`0` = Wiese); Index = Zeile × Spalten + Spalte. */
export type Owner = Slot | 0;
export type MatschEvent =
  | { type: 'splat'; slot: Slot; x: number; z: number }
  | { type: 'rain'; phase: 'warn' | 'active' | 'over'; rain: Hazard<'regen'> }
  | { type: 'bump'; victim: Slot }
  | { type: 'slip'; slot: Slot };

const HIGHLIGHTS: readonly HighlightRule[] = [
  { kind: 'top', stat: 'felder', text: (name, n) => `${name} färbt am Ende ${n} Felder.` },
  { kind: 'top', stat: 'platsch', min: 3, text: (name, n) => `${name} platscht ${n}× los.` },
  { kind: 'top', stat: 'nass', min: 6, text: (name, n) => `Regen spült ${n} Felder von ${name}.` },
];

export function cellCenter(index: number): { x: number; z: number } {
  const { cols, rows } = MATSCH_RULES;
  return { x: (index % cols) - cols / 2 + 0.5, z: Math.floor(index / cols) - rows / 2 + 0.5 };
}

export function cellAt(x: number, z: number): number {
  const { cols, rows } = MATSCH_RULES;
  const col = Math.max(0, Math.min(cols - 1, Math.floor(x + cols / 2)));
  const row = Math.max(0, Math.min(rows - 1, Math.floor(z + rows / 2)));
  return row * cols + col;
}

/** Felder, deren Mitte höchstens `radius` von (x, z) entfernt liegt. */
export function cellsWithin(x: number, z: number, radius: number): number[] {
  const out: number[] = [];
  for (let index = 0; index < MATSCH_RULES.cols * MATSCH_RULES.rows; index++) {
    const center = cellCenter(index);
    if (Math.hypot(center.x - x, center.z - z) <= radius) out.push(index);
  }
  return out;
}

export class MatschLogic {
  readonly clock: MatchClock;
  readonly board: Scoreboard;
  readonly tally = new EventTally<'platsch' | 'nass'>();
  readonly mudders: Mudder[];
  readonly cells: Owner[] = new Array<Owner>(MATSCH_RULES.cols * MATSCH_RULES.rows).fill(0);
  readonly rain = new HazardField<'regen'>();
  private nextRainAt: number = MATSCH_RULES.rainFirstS;

  constructor(
    slots: readonly Slot[],
    private readonly rng: MinigameRng,
    timeLimitMs: number,
  ) {
    this.clock = new MatchClock(timeLimitMs);
    this.board = new Scoreboard(slots);
    // Start in vier Ecken (überkreuz, damit auch zu zweit jeder eine Hälfte hat).
    this.mudders = slots.map((slot, index) => {
      const sx = index % 3 === 0 ? -1 : 1;
      const sz = index < 2 ? -sx : sx;
      return { slot, splatAt: null, ...createWalker(sx * 4.5, sz * 3) };
    });
  }

  get finished(): boolean {
    return this.clock.expired;
  }

  mudder(slot: Slot): Mudder | undefined {
    return this.mudders.find((mudder) => mudder.slot === slot);
  }

  setStick(slot: Slot, x: number, y: number): void {
    const mudder = this.mudder(slot);
    if (mudder) setWalkerStick(mudder, x, y);
  }

  /** A: Bauchplatscher (Rutschen in Blickrichtung, beim Aufkommen der Fleck). */
  splat(slot: Slot): boolean {
    const mudder = this.mudder(slot);
    const now = this.clock.time;
    if (!mudder || this.finished || !tryDash(mudder, now, MATSCH_RULES)) return false;
    mudder.splatAt = now + MATSCH_RULES.dashS;
    this.tally.count(slot, 'platsch');
    return true;
  }

  step(dt: number): MatschEvent[] {
    if (this.finished) return [];
    const { clock, cells } = this;
    const events: MatschEvent[] = [];
    clock.tick(dt);
    const now = clock.time;
    if (now >= this.nextRainAt) {
      const { rainWarnS, rainS, rainEveryS } = MATSCH_RULES;
      this.nextRainAt += rainEveryS;
      if (clock.fitsBeforeEnd(rainWarnS)) {
        const rain = this.rain.add('regen', this.stripe(), now, rainWarnS, rainS);
        events.push({ type: 'rain', phase: 'warn', rain });
      }
    }
    for (const change of this.rain.update(now)) {
      events.push({ type: 'rain', phase: change.type, rain: change.hazard });
    }
    for (const mudder of this.mudders) {
      stepWalker(mudder, dt, now, MATSCH_RULES, MATSCH_ARENA.bounds);
      // Wer im Regen steht, rutscht aus (liegt dann länger, als der Schauer dauert: einmal).
      if (now < mudder.stunUntil || this.rain.activeAt(mudder).length === 0) continue;
      stunWalker(mudder, now, MATSCH_RULES.rainSlipS);
      events.push({ type: 'slip', slot: mudder.slot });
    }
    for (const bump of resolveBumps(this.mudders, now, BUMPS, MATSCH_ARENA.bounds)) {
      events.push({ type: 'bump', victim: bump.victim });
    }
    for (const mudder of this.mudders) {
      if (mudder.splatAt === null || now < mudder.splatAt) continue;
      mudder.splatAt = null;
      for (const index of cellsWithin(mudder.x, mudder.z, MATSCH_RULES.splatRadius)) {
        cells[index] = mudder.slot;
      }
      stunWalker(mudder, now, MATSCH_RULES.splatStunS);
      events.push({ type: 'splat', slot: mudder.slot, x: mudder.x, z: mudder.z });
    }
    for (const mudder of this.mudders) {
      if (now >= mudder.stunUntil) cells[cellAt(mudder.x, mudder.z)] = mudder.slot;
    }
    for (const rain of this.rain.hazards.filter((hazard) => hazard.phase === 'active')) {
      for (const [index, owner] of cells.entries()) {
        if (owner === 0 || !shapeContains(rain.shape, cellCenter(index))) continue;
        this.tally.count(owner, 'nass');
        cells[index] = 0;
      }
    }
    for (const slot of this.board.slots) {
      this.board.set(slot, cells.filter((owner) => owner === slot).length);
    }
    return events;
  }

  /** Zufälliger Streifen, zwei Felder breit, quer oder längs über die ganze Wiese. */
  private stripe() {
    const { cols, rows } = MATSCH_RULES;
    const across = this.rng.next() < 0.5;
    const count = across ? rows : cols;
    const center = Math.floor(this.rng.next() * (count - 1)) + 1 - count / 2;
    return across
      ? { kind: 'rect' as const, x: 0, z: center, halfX: cols / 2, halfZ: 1 }
      : { kind: 'rect' as const, x: center, z: 0, halfX: 1, halfZ: rows / 2 };
  }

  highlights(names: ReadonlyMap<Slot, string>): string[] {
    const felder = (slot: Slot) => this.board.get(slot);
    return buildHighlights(HIGHLIGHTS, tallyFacts(this.board.slots, names, this.tally, { felder }));
  }
}
