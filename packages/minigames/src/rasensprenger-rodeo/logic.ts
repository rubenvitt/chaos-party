/**
 * Logik von Rasensprenger-Rodeo (rein, MG-011): Drei Sprenger stehen im Dreieck auf dem runden
 * Rasen. Abwechselnd springt einer an (Vorwarnung: Düse dreht langsam), dann fegt sein Strahl
 * mit eigener Länge und eigenem Tempo herum; stottert er, dreht er gleich um. Treffer = Herz
 * weg, kurz unverwundbar und nass (Lenkung träge, man rutscht nach). In der Endphase drehen
 * alle gleichzeitig. Je Zehntelsekunde: trocken 2 Punkte, dicht am Strahl 3, nass 1, raus 0.
 */
import {
  EventTally,
  MatchClock,
  Scoreboard,
  buildHighlights,
  clampToRadius,
  createWalker,
  setWalkerStick,
  steeringDeltaV,
  tallyFacts,
  type HighlightRule,
  type WalkerState,
} from '@chaos-party/minigame-kit';
import type { MinigameRng, Slot } from '@chaos-party/minigame-sdk';

export const RODEO_RULES = {
  radius: 6,
  speed: 4.2,
  bodyRadius: 0.4,
  hearts: 3,
  /** Länger als ein Strahl braucht, um über eine Figur zu fegen. */
  invulnerableS: 1.4,
  wetS: 2.6,
  jetHalfWidth: 0.3,
  /** So nah am Strahl (über die Trefferbreite hinaus) gibt es den Rodeo-Bonus. */
  thrill: 1.3,
  /** Takt: alle `everyS` springt ein ruhender Sprenger an, höchstens zwei zugleich. */
  everyS: 2.4,
  warnS: 1.1,
  sprayS: [3.2, 4.4],
  spins: [1.0, 1.25, 1.5],
  reaches: [3.6, 4.4, 5.2],
  reverseChance: 0.4,
  stutterS: 0.35,
  finale: { seconds: 7, warnS: 0.8, spin: 1.4, reach: 4.6 },
} as const;

/** Nasse Figuren folgen dem Stick nur träge (Kniff: Nasse rutschen nach). */
const WET_STEERING = { maxSpeed: RODEO_RULES.speed, responsiveness: 1.4, maxAcceleration: 6 };
const polar = (deg: number, r: number) => ({
  x: Math.cos((deg * Math.PI) / 180) * r,
  z: Math.sin((deg * Math.PI) / 180) * r,
});

export interface Sprinkler {
  readonly index: number;
  readonly x: number;
  readonly z: number;
  phase: 'idle' | 'warn' | 'spray';
  /** Laufende Nummer des Einsatzes (Bot erkennt einen neuen). */
  serial: number;
  /** Strahlrichtung (Radiant, Richtung (cos, sin) in x/z) und Drehtempo (rad/s mit Drehsinn). */
  angle: number;
  spin: number;
  reach: number;
  sprayAt: number;
  stopAt: number;
  stutterUntil: number;
  /** Versteckt: wann er stottert und umdreht (`null` = gar nicht). */
  reverseAt: number | null;
}

export interface Runner extends WalkerState {
  readonly slot: Slot;
  hearts: number;
  vx: number;
  vz: number;
  safeUntil: number;
  wetUntil: number;
}

export type RodeoEvent =
  | { readonly type: 'warn' | 'spray' | 'reverse' | 'finale' }
  | { readonly type: 'hit'; readonly runner: Runner };

const HIGHLIGHTS: readonly HighlightRule[] = [
  { kind: 'top', stat: 'nass', min: 2, text: (name, n) => `${name} wird ${n}× klatschnass.` },
  { kind: 'top', stat: 'trocken', text: (name) => `${name} bleibt als Einzige(r) trocken.` },
  { kind: 'last', stat: 'nass', text: (name) => `${name} kriegt den letzten Spritzer ab.` },
];

export class RodeoLogic {
  readonly clock: MatchClock;
  readonly board: Scoreboard;
  readonly tally = new EventTally<'nass'>();
  readonly runners: Runner[];
  readonly sprinklers: Sprinkler[];
  private nextAt = 0.8;
  private tenths = 0;

  constructor(
    slots: readonly Slot[],
    private readonly rng: MinigameRng,
    timeLimitMs: number,
  ) {
    this.clock = new MatchClock(timeLimitMs, RODEO_RULES.finale.seconds);
    this.board = new Scoreboard(slots);
    this.runners = slots.map((slot, index) => {
      const { x, z } = polar(45 + index * 90, 1.3);
      const hearts = RODEO_RULES.hearts;
      return { slot, ...createWalker(x, z), hearts, vx: 0, vz: 0, safeUntil: 0, wetUntil: 0 };
    });
    this.sprinklers = [90, 210, 330].map((deg, index) => ({
      index,
      ...polar(deg, 3),
      ...{ phase: 'idle', serial: 0, angle: 0, spin: 0, reach: 0, sprayAt: 0, stopAt: 0 },
      ...{ stutterUntil: 0, reverseAt: null },
    }));
  }

  get finished(): boolean {
    return this.clock.expired;
  }

  runner(slot: Slot): Runner | undefined {
    return this.runners.find((runner) => runner.slot === slot);
  }

  setStick(slot: Slot, x: number, y: number): void {
    const runner = this.runner(slot);
    if (runner && runner.hearts > 0) setWalkerStick(runner, x, y);
  }

  isWet(runner: Runner): boolean {
    return this.clock.time < runner.wetUntil;
  }

  /** Tanzt dicht am Strahl eines spritzenden Sprengers (Rodeo-Bonus)? */
  riding(point: { x: number; z: number }): boolean {
    return this.sprinklers.some((sprinkler) => jetHits(sprinkler, point, RODEO_RULES.thrill));
  }

  step(dt: number): RodeoEvent[] {
    if (this.finished) return [];
    const { clock, rng } = this;
    const events: RodeoEvent[] = [];
    const finale = clock.tick(dt).finaleStarted;
    const now = clock.time;
    if (finale) events.push({ type: 'finale' });
    const idle = this.sprinklers.filter((sprinkler) => sprinkler.phase === 'idle');
    if (finale) for (const sprinkler of this.sprinklers) this.startFinale(sprinkler, now);
    else if (!clock.finale && now >= this.nextAt) {
      this.nextAt += RODEO_RULES.everyS;
      const pick = idle[Math.floor(rng.next() * idle.length)];
      if (pick && idle.length > 1) events.push(this.activate(pick, now));
    }
    for (const sprinkler of this.sprinklers) events.push(...this.turn(sprinkler, now, dt));
    for (const runner of this.runners) {
      if (runner.hearts <= 0) continue;
      this.move(runner, dt);
      if (now >= runner.safeUntil && this.sprinklers.some((s) => jetHits(s, runner))) {
        runner.hearts--;
        runner.safeUntil = now + RODEO_RULES.invulnerableS;
        runner.wetUntil = now + RODEO_RULES.wetS;
        this.tally.count(runner.slot, 'nass');
        events.push({ type: 'hit', runner });
      }
    }
    for (const tenths = Math.floor(now * 10 + 1e-6); this.tenths < tenths; this.tenths++) {
      for (const runner of this.runners) {
        const points = this.isWet(runner) ? 1 : this.riding(runner) ? 3 : 2;
        if (runner.hearts > 0) this.board.add(runner.slot, points);
      }
    }
    return events;
  }

  highlights(names: ReadonlyMap<Slot, string>): string[] {
    const trocken = (slot: Slot) => (this.tally.get(slot, 'nass') === 0 ? 1 : 0);
    return buildHighlights(
      HIGHLIGHTS,
      tallyFacts(this.board.slots, names, this.tally, { trocken }),
    );
  }

  private activate(sprinkler: Sprinkler, now: number): RodeoEvent {
    const { rng } = this;
    const pick = <T>(list: readonly T[]): T => list[Math.floor(rng.next() * list.length)] as T;
    const [minS, maxS] = RODEO_RULES.sprayS;
    const spray = minS + rng.next() * (maxS - minS);
    sprinkler.phase = 'warn';
    sprinkler.serial++;
    sprinkler.angle = rng.next() * Math.PI * 2;
    sprinkler.spin = pick(RODEO_RULES.spins) * (rng.next() < 0.5 ? -1 : 1);
    sprinkler.reach = pick(RODEO_RULES.reaches);
    sprinkler.sprayAt = now + RODEO_RULES.warnS;
    sprinkler.stopAt = sprinkler.sprayAt + spray;
    const reverse = rng.next() < RODEO_RULES.reverseChance;
    sprinkler.reverseAt = reverse ? sprinkler.sprayAt + spray * (0.3 + rng.next() * 0.4) : null;
    return { type: 'warn' };
  }

  /** Endphase: Alle drehen bis zum Schluss, kürzer und schneller, ohne Umdrehen. */
  private startFinale(sprinkler: Sprinkler, now: number): void {
    const { finale } = RODEO_RULES;
    if (sprinkler.phase === 'idle') {
      this.activate(sprinkler, now);
      sprinkler.sprayAt = now + finale.warnS;
    }
    sprinkler.stopAt = this.clock.limitS + 1;
    sprinkler.reverseAt = null;
    sprinkler.reach = Math.min(sprinkler.reach, finale.reach);
    sprinkler.spin = Math.sign(sprinkler.spin) * finale.spin;
  }

  private turn(sprinkler: Sprinkler, now: number, dt: number): RodeoEvent[] {
    if (sprinkler.phase === 'idle') return [];
    const events: RodeoEvent[] = [];
    if (sprinkler.phase === 'warn' && now >= sprinkler.sprayAt) {
      sprinkler.phase = 'spray';
      events.push({ type: 'spray' });
    }
    if (now >= sprinkler.stopAt) sprinkler.phase = 'idle';
    if (sprinkler.reverseAt !== null && now >= sprinkler.reverseAt) {
      sprinkler.reverseAt = null;
      sprinkler.spin = -sprinkler.spin;
      sprinkler.stutterUntil = now + RODEO_RULES.stutterS;
      events.push({ type: 'reverse' });
    }
    // Vorwarnung: Die Düse dreht schon langsam in ihre Richtung.
    const speed = sprinkler.phase === 'warn' ? 0.25 : now < sprinkler.stutterUntil ? 0 : 1;
    sprinkler.angle += sprinkler.spin * speed * dt;
    return events;
  }

  private move(runner: Runner, dt: number): void {
    const { speed, radius, bodyRadius } = RODEO_RULES;
    const stick = { x: runner.stickX, y: runner.stickY };
    if (this.isWet(runner)) {
      const delta = steeringDeltaV({ x: runner.vx, z: runner.vz }, stick, dt, WET_STEERING);
      runner.vx += delta.x;
      runner.vz += delta.z;
    } else {
      runner.vx = stick.x * speed;
      runner.vz = stick.y * speed;
    }
    if (Math.hypot(runner.vx, runner.vz) > 0.3) runner.heading = Math.atan2(runner.vx, runner.vz);
    const next = { x: runner.x + runner.vx * dt, z: runner.z + runner.vz * dt };
    ({ x: runner.x, z: runner.z } = clampToRadius(next.x, next.z, radius - bodyRadius));
    for (const sprinkler of this.sprinklers) {
      const dx = runner.x - sprinkler.x;
      const dz = runner.z - sprinkler.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.95 && d > 1e-6) {
        runner.x = sprinkler.x + (dx / d) * 0.95;
        runner.z = sprinkler.z + (dz / d) * 0.95;
      }
    }
  }
}

/** Trifft der Strahl eines spritzenden Sprengers diesen Punkt (mit Körperbreite + `margin`)? */
export function jetHits(sprinkler: Sprinkler, point: { x: number; z: number }, margin = 0) {
  const dx = point.x - sprinkler.x;
  const dz = point.z - sprinkler.z;
  const cos = Math.cos(sprinkler.angle);
  const sin = Math.sin(sprinkler.angle);
  const along = dx * cos + dz * sin;
  const near = RODEO_RULES.bodyRadius + margin;
  return (
    sprinkler.phase === 'spray' &&
    along > 0 &&
    along <= sprinkler.reach + near &&
    Math.abs(dz * cos - dx * sin) <= RODEO_RULES.jetHalfWidth + near
  );
}
