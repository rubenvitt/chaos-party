/**
 * Schnellfeuer-Kette (rein, CHAOS-90): fünf Mikro-Spiele am Stück. Vor jedem steht kurz das
 * Bildwort (Eingaben gesperrt), danach ein Moment Auswertung. Je Mikro-Spiel gibt es Punkte nach
 * Platz (so viele, wie Mitspielende schlechter waren: bei vier 3/2/1/0, Gleichstand teilt den
 * besseren Wert); die Summe über alle fünf ist das Ergebnis des Minispiels „Schnellfeuer“.
 * Münzen vergibt game-core daraus wie nach jedem Minispiel.
 */
import {
  rankByScore,
  type MinigameCue,
  type MinigameRng,
  type Slot,
} from '@chaos-party/minigame-sdk';
import { Scoreboard } from '@chaos-party/minigame-kit';
import { EPS, type MicroDefinition, type MicroGame } from './micro.ts';
import { MICRO_POOL } from './micros.ts';

export const CHAIN_LENGTH = 5;
/** Bildwort vor jedem Mikro-Spiel. */
export const ANNOUNCE_S = 1.3;
/** Auswertung nach jedem Mikro-Spiel. */
export const RECAP_S = 1;

/** Das letzte Mikro-Spiel zählt doppelt (Aufholchance, Banner „×2“). */
export const FINALE_FACTOR = 2;

/**
 * Länge der Kette, wenn niemand vorzeitig fertig wird: die fünf längsten Mikro-Spiele des
 * Vorrats samt Bildwort und Auswertung. Mit genau fünf im Vorrat ist das jede Kette (Leerlauf
 * endet am Zeitlimit wie bei jedem Minispiel); wächst der Vorrat (CHAOS-113), ist es die
 * Obergrenze.
 */
export const CHAIN_MAX_MS =
  CHAIN_LENGTH * (ANNOUNCE_S + RECAP_S) * 1000 +
  MICRO_POOL.map((micro) => micro.info.durationMs)
    .sort((a, b) => b - a)
    .slice(0, CHAIN_LENGTH)
    .reduce((sum, ms) => sum + ms, 0);

export type ChainPhase = 'announce' | 'play' | 'recap';

export interface ChainEvent {
  readonly type: 'announce' | 'start' | 'end';
  readonly index: number;
  readonly micro: string;
  /** Bei `end`: Gewinner des Mikro-Spiels (Gleichstand: mehrere, niemand: leer). */
  readonly winners?: readonly Slot[];
}

/** Ziehung der fünf Mikro-Spiele: gemischt, ohne Wiederholung, solange der Vorrat reicht. */
export function drawChain(
  rng: MinigameRng,
  pool: readonly MicroDefinition[] = MICRO_POOL,
): MicroDefinition[] {
  const order: MicroDefinition[] = [];
  let bag: MicroDefinition[] = [];
  while (order.length < CHAIN_LENGTH && pool.length > 0) {
    if (bag.length === 0) bag = [...pool];
    const [pick] = bag.splice(rng.int(0, bag.length - 1), 1);
    if (pick) order.push(pick);
  }
  return order;
}

/** Punkte je Slot für ein Mikro-Ergebnis: Anzahl der strikt Schlechteren. */
export function microPoints(game: MicroGame): Map<Slot, number> {
  const scores = game.scores();
  return new Map(
    scores.map((entry) => [entry.slot, scores.filter((other) => other.score < entry.score).length]),
  );
}

export class SchnellfeuerChain {
  readonly order: readonly MicroDefinition[];
  readonly totals: Scoreboard;
  /** Gewinne je Slot (Höhepunkte). */
  readonly wins = new Map<Slot, number>();
  time = 0;
  index = 0;
  phase: ChainPhase = 'announce';
  game: MicroGame | null = null;
  /** Gewinner des zuletzt beendeten Mikro-Spiels (für die Auswertung). */
  lastWinners: readonly Slot[] = [];
  private phaseAt = 0;
  /** Letzter Stick je Slot: gilt schon im Bildwort, das neue Mikro-Spiel übernimmt ihn. */
  private readonly pendingStick = new Map<Slot, { x: number; y: number }>();
  private done = false;
  private readonly limitS: number;

  constructor(
    readonly slots: readonly Slot[],
    private readonly rng: MinigameRng,
    timeLimitMs: number,
    pool: readonly MicroDefinition[] = MICRO_POOL,
  ) {
    this.order = drawChain(rng, pool);
    this.totals = new Scoreboard(slots);
    this.limitS = timeLimitMs / 1000;
    for (const slot of slots) this.wins.set(slot, 0);
  }

  get finished(): boolean {
    return this.done;
  }

  /** Läuft das letzte Mikro-Spiel (doppelte Punkte)? */
  get isFinale(): boolean {
    return this.index === this.order.length - 1 && this.order.length > 1;
  }

  get current(): MicroDefinition | undefined {
    return this.order[this.index];
  }

  /** Geplante Restzeit der Kette (höchstens die Restzeit des Minispiels). */
  get remainingMs(): number {
    if (this.done) return 0;
    let rest = 0;
    this.order.forEach((micro, i) => {
      if (i < this.index) return;
      const play = micro.info.durationMs / 1000;
      if (i > this.index) {
        rest += ANNOUNCE_S + play + RECAP_S;
        return;
      }
      const inPhase = this.time - this.phaseAt;
      if (this.phase === 'announce') rest += ANNOUNCE_S - inPhase + play + RECAP_S;
      else if (this.phase === 'play') rest += Math.max(0, play - (this.game?.time ?? 0)) + RECAP_S;
      else rest += RECAP_S - inPhase;
    });
    return Math.max(0, Math.round(Math.min(rest, this.limitS - this.time) * 1000));
  }

  stick(slot: Slot, x: number, y: number): void {
    // Der Stick wirkt schon im Bildwort (Hand/Messer stehen bereit), Knöpfe erst im Spiel.
    if (!this.done) this.pendingStick.set(slot, { x, y });
    if (this.phase === 'play') this.game?.stick(slot, x, y);
  }

  press(slot: Slot, button: 'a' | 'b'): void {
    if (this.phase === 'play' && !this.done) this.game?.press(slot, button);
  }

  /** Ein fester Schritt; liefert Wechsel (für Klänge und Ansicht). */
  step(dt: number): ChainEvent[] {
    if (this.done) return [];
    const events: ChainEvent[] = [];
    if (this.time === 0 && this.phase === 'announce' && this.current) {
      events.push({ type: 'announce', index: 0, micro: this.current.info.id });
    }
    this.time += dt;
    const inPhase = this.time - this.phaseAt;
    const micro = this.current;
    if (!micro) {
      this.done = true;
      return events;
    }
    if (this.phase === 'announce' && inPhase >= ANNOUNCE_S - EPS) {
      this.game = micro.create(this.slots, this.rng);
      for (const [slot, stick] of this.pendingStick) this.game.stick(slot, stick.x, stick.y);
      this.enter('play');
      events.push({ type: 'start', index: this.index, micro: micro.info.id });
    } else if (this.phase === 'play' && this.game) {
      this.game.step(dt);
      if (this.game.finished) events.push(this.award(micro));
    } else if (this.phase === 'recap' && inPhase >= RECAP_S - EPS) {
      this.index++;
      this.game = null;
      if (this.index < this.order.length) {
        this.enter('announce');
        events.push({
          type: 'announce',
          index: this.index,
          micro: this.order[this.index]?.info.id ?? '',
        });
      } else {
        this.done = true;
      }
    }
    if (!this.done && this.time >= this.limitS - EPS) {
      // Restzeit des Minispiels um (Host neu geladen): laufendes Mikro-Spiel noch werten.
      if (this.phase === 'play' && this.game) events.push(this.award(micro));
      this.done = true;
    }
    return events;
  }

  private award(micro: MicroDefinition): ChainEvent {
    const game = this.game;
    const points = game ? microPoints(game) : new Map<Slot, number>();
    const factor = this.isFinale ? FINALE_FACTOR : 1;
    for (const [slot, value] of points) this.totals.add(slot, value * factor);
    const ranked = game ? rankByScore(game.scores()) : [];
    const anyScore = ranked.some((entry) => entry.score > 0);
    this.lastWinners = anyScore
      ? ranked.filter((entry) => entry.place === 1).map((entry) => entry.slot)
      : [];
    for (const slot of this.lastWinners) this.wins.set(slot, (this.wins.get(slot) ?? 0) + 1);
    this.enter('recap');
    return { type: 'end', index: this.index, micro: micro.info.id, winners: this.lastWinners };
  }

  private enter(phase: ChainPhase): void {
    this.phase = phase;
    this.phaseAt = this.time;
  }

  /**
   * Hinweis für den Controller (CHAOS-231): Bildwort und Bedienung des laufenden Mikro-Spiels.
   * Wechselt mit dem Bildwort (Phase `announce`) und bleibt über Spiel und Auswertung stehen;
   * so hat der Controller die 1,3 s des Bildworts, um die Knöpfe umzustellen.
   */
  cue(): MinigameCue | null {
    const micro = this.current;
    if (this.done || !micro) return null;
    const { icon, word, controls } = micro.info;
    return {
      step: this.index,
      steps: this.order.length,
      icon,
      word,
      controls,
      double: this.isFinale,
    };
  }

  /** Bildwort bzw. Auswertung als Banner (≤ 32 Zeichen). */
  banner(names: ReadonlyMap<Slot, string>): string | undefined {
    const micro = this.current;
    if (this.done || !micro) return undefined;
    const { icon, word } = micro.info;
    const double = this.isFinale ? ' ×2' : '';
    if (this.phase === 'announce') {
      return `${String(this.index + 1)}/${String(this.order.length)} ${icon} ${word}${double}`;
    }
    if (this.phase === 'play') return `${icon} ${word}${double}`;
    const winners = this.lastWinners;
    if (winners.length === 0) return `${icon} Keiner!`;
    if (winners.length > 1) return `${icon} Gleichstand!`;
    const [winner] = winners;
    const name = (winner === undefined ? undefined : names.get(winner)) ?? 'Sieg';
    return `${icon} ${name.slice(0, 20)} holt’s!`;
  }

  /** Höhepunkte (≤ 4, je ≤ 64 Zeichen). */
  highlights(names: ReadonlyMap<Slot, string>): string[] {
    const lines: string[] = [];
    const best = [...this.wins].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
    if (best && best[1] >= 2) {
      const name = (names.get(best[0]) ?? '').slice(0, 20);
      lines.push(`${name} holt ${String(best[1])} von ${String(this.order.length)} Mikro-Spielen.`);
    }
    const played = this.order.slice(0, Math.min(this.index + 1, this.order.length));
    lines.push(`Gespielt: ${played.map((micro) => micro.info.icon).join(' ')}`);
    return lines.filter((line) => line.length <= 64);
  }
}
