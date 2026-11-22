/**
 * Der erste Mikro-Vorrat für Schnellfeuer (CHAOS-90): fünf Skizzen aus Familie 20 mit je
 * anderem Kernverb (reagieren, pumpen, timen, fangen, schätzen). Jede Person hat ihre eigene
 * Bahn mit eigenem Gegenstand; alle bekommen dieselben Zufallswerte (fair). Die übrigen
 * Skizzen MG-191, -195, -198 … -200 baut die Familien-Welle CHAOS-113.
 *
 * Rein: Logik und Bot je Mikro-Spiel. Die Ansicht liegt in `views.ts`.
 */
import {
  gaussian,
  noisyStick,
  reactionSample,
  type BotAction,
  type BotProfile,
} from '@chaos-party/minigame-kit';
import { createMinigameRng, type MinigameRng, type Slot } from '@chaos-party/minigame-sdk';
import { EPS, perSlot, type MicroDefinition, type MicroGame, type MicroInfo } from './micro.ts';

/** Gemeinsamer Rahmen: Uhr, Teilnehmer, Ende. */
abstract class BaseMicro implements MicroGame {
  time = 0;
  protected readonly limitS: number;

  constructor(
    readonly info: MicroInfo,
    readonly slots: readonly Slot[],
  ) {
    this.limitS = info.durationMs / 1000;
  }

  get finished(): boolean {
    return this.time >= this.limitS - EPS || this.slots.every((slot) => this.done(slot));
  }

  get remainingS(): number {
    return Math.max(0, this.limitS - this.time);
  }

  /** Letzter Stick je Slot (Mikro-Spiele ohne Stick lesen ihn nicht). */
  protected readonly sticks = new Map<Slot, { x: number; y: number }>();

  step(dt: number): void {
    if (this.finished) return;
    this.time += dt;
    this.advance?.(dt);
  }

  stick(slot: Slot, x: number, y: number): void {
    this.sticks.set(slot, { x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) });
  }

  /** Punkte für „fertig nach t s“: früher ist mehr (über allen Teilpunkten). */
  protected finishScore(at: number): number {
    return 1000 + Math.round((this.limitS - at) * 100);
  }

  /** Zeit lassen (Fliege, Messer); Mikro-Spiele ohne Bewegung brauchen es nicht. */
  protected advance?(dt: number): void;
  abstract press(slot: Slot, button: 'a' | 'b'): void;
  abstract done(slot: Slot): boolean;
  abstract scores(): { slot: Slot; score: number }[];
  abstract status(slot: Slot): string | undefined;
}

/** Bot-Hilfe: einmal drücken. */
const PRESS_A: BotAction = { press: ['a'] };

// ---------------------------------------------------------------------------------------------
// MG-196 Wecker aus: beim Klingeln draufhauen. Vorher zuckt der Wecker einmal (Finte).

export const WECKER_INFO: MicroInfo = {
  id: 'wecker',
  sketch: 'MG-196',
  title: 'Wecker aus',
  word: 'HAUEN!',
  icon: '⏰',
  durationMs: 6_000,
  controls: { joystick: null, a: 'Hauen', b: null },
};

type WeckerState =
  | { readonly kind: 'wait' }
  | { readonly kind: 'early' }
  | { readonly kind: 'hit'; readonly reactionS: number };

export class WeckerGame extends BaseMicro {
  readonly ringAt: number;
  readonly twitchAt: number;
  readonly state: Map<Slot, WeckerState>;

  constructor(slots: readonly Slot[], rng: MinigameRng) {
    super(WECKER_INFO, slots);
    this.ringAt = 1.8 + rng.next() * 2;
    this.twitchAt = 0.7 + rng.next() * (this.ringAt - 1.3);
    this.state = perSlot<WeckerState>(slots, () => ({ kind: 'wait' }));
  }

  get ringing(): boolean {
    return this.time >= this.ringAt;
  }

  /** Zuckt der Wecker gerade (Finte, 0,35 s)? */
  get twitching(): boolean {
    return this.time >= this.twitchAt && this.time < this.twitchAt + 0.35;
  }

  press(slot: Slot, button: 'a' | 'b'): void {
    if (button !== 'a' || this.finished || this.state.get(slot)?.kind !== 'wait') return;
    this.state.set(
      slot,
      this.ringing ? { kind: 'hit', reactionS: this.time - this.ringAt } : { kind: 'early' },
    );
  }

  done(slot: Slot): boolean {
    return this.state.get(slot)?.kind !== 'wait';
  }

  scores() {
    return this.slots.map((slot) => {
      const state = this.state.get(slot);
      const score =
        state?.kind === 'hit' ? Math.max(1, 3000 - Math.round(state.reactionS * 1000)) : 0;
      return { slot, score };
    });
  }

  status(slot: Slot): string | undefined {
    const state = this.state.get(slot);
    if (state?.kind === 'early') return 'zu früh!';
    if (state?.kind === 'hit') return `${String(Math.round(state.reactionS * 1000))} ms`;
    return undefined;
  }
}

class WeckerBot {
  private pressAt: number | null = null;
  private baited = false;

  constructor(
    private readonly slot: Slot,
    private readonly profile: BotProfile,
    private readonly rng: MinigameRng,
  ) {}

  act(game: MicroGame): BotAction | null {
    const wecker = game as WeckerGame;
    if (wecker.done(this.slot)) return null;
    if (!this.baited && wecker.twitching) {
      this.baited = true;
      if (this.rng.next() < this.profile.falseStart) return PRESS_A;
    }
    if (!wecker.ringing) return null;
    if (this.pressAt === null) {
      const lapse = this.rng.next() < this.profile.lapse ? 0.8 : 0;
      this.pressAt = wecker.time + reactionSample(this.rng, this.profile.reactionMs) / 1000 + lapse;
    }
    return wecker.time >= this.pressAt ? PRESS_A : null;
  }
}

export const WECKER: MicroDefinition<WeckerGame> = {
  info: WECKER_INFO,
  create: (slots, rng) => new WeckerGame(slots, rng),
  bot: (slot, profile, rng) => new WeckerBot(slot, profile, rng),
};

// ---------------------------------------------------------------------------------------------
// MG-197 Spaghetti schlürfen: im Takt drücken; wer hämmert, bekommt Soße ab und stockt.

export const SPAGHETTI_INFO: MicroInfo = {
  id: 'spaghetti',
  sketch: 'MG-197',
  title: 'Spaghetti schlürfen',
  word: 'SCHLÜRFEN!',
  icon: '🍝',
  durationMs: 5_000,
  controls: { joystick: null, a: 'Schlürfen', b: null },
};

export const SPAGHETTI_RULES = {
  /** So viele Schlürfer, bis die Nudel weg ist. */
  need: 14,
  /** Schneller als das hintereinander gedrückt spritzt die Soße. */
  tooFastS: 0.085,
  /** So lange klebt die Soße (Drücken wirkt nicht). */
  splashS: 0.45,
  /** Auch im Takt spritzt die Soße manchmal (Glück gehört zum Mikro-Chaos). */
  splashChance: 0.1,
} as const;

interface Slurper {
  count: number;
  lastPress: number;
  splashedUntil: number;
  doneAt: number | null;
  splashes: number;
}

export class SpaghettiGame extends BaseMicro {
  readonly eaters: Map<Slot, Slurper>;

  constructor(
    slots: readonly Slot[],
    private readonly rng: MinigameRng,
  ) {
    super(SPAGHETTI_INFO, slots);
    this.eaters = perSlot(slots, () => ({
      count: 0,
      lastPress: -1,
      splashedUntil: 0,
      doneAt: null,
      splashes: 0,
    }));
  }

  press(slot: Slot, button: 'a' | 'b'): void {
    const eater = this.eaters.get(slot);
    if (button !== 'a' || !eater || this.finished || eater.doneAt !== null) return;
    const gap = this.time - eater.lastPress;
    eater.lastPress = this.time;
    if (this.time < eater.splashedUntil) return;
    if (gap < SPAGHETTI_RULES.tooFastS || this.rng.next() < SPAGHETTI_RULES.splashChance) {
      eater.splashedUntil = this.time + SPAGHETTI_RULES.splashS;
      eater.splashes++;
      return;
    }
    eater.count++;
    if (eater.count >= SPAGHETTI_RULES.need) eater.doneAt = this.time;
  }

  splashed(slot: Slot): boolean {
    return this.time < (this.eaters.get(slot)?.splashedUntil ?? 0);
  }

  done(slot: Slot): boolean {
    return this.eaters.get(slot)?.doneAt != null;
  }

  scores() {
    return this.slots.map((slot) => {
      const eater = this.eaters.get(slot);
      const score =
        eater?.doneAt != null ? this.finishScore(eater.doneAt) : (eater?.count ?? 0) * 10;
      return { slot, score };
    });
  }

  status(slot: Slot): string | undefined {
    if (this.done(slot)) return 'leer!';
    if (this.splashed(slot)) return 'Soße!';
    return `${String(this.eaters.get(slot)?.count ?? 0)}/${String(SPAGHETTI_RULES.need)}`;
  }
}

class SpaghettiBot {
  private nextAt: number;

  constructor(
    private readonly slot: Slot,
    private readonly profile: BotProfile,
    private readonly rng: MinigameRng,
  ) {
    this.nextAt = reactionSample(rng, profile.reactionMs) / 1000;
  }

  act(game: MicroGame): BotAction | null {
    if (game.time < this.nextAt || (game as SpaghettiGame).done(this.slot)) return null;
    // Takt: Profi ≈ 0,12 s, Neuling ≈ 0,27 s; Streuung nach Takt-Genauigkeit, dazu Aussetzer.
    const base = 0.12 + (this.profile.reactionMs - 230) / 2200;
    const jitter = gaussian(this.rng) * (this.profile.timingSdMs / 1000) * 0.6;
    const lapse = this.rng.next() < this.profile.lapse ? 0.35 : 0;
    this.nextAt = game.time + Math.max(0.06, base + jitter) + lapse;
    return PRESS_A;
  }
}

export const SPAGHETTI: MicroDefinition<SpaghettiGame> = {
  info: SPAGHETTI_INFO,
  create: (slots, rng) => new SpaghettiGame(slots, rng),
  bot: (slot, profile, rng) => new SpaghettiBot(slot, profile, rng),
};

// ---------------------------------------------------------------------------------------------
// MG-192 Kerze auspusten: dreimal pusten, wenn die Flamme klein ist; sonst flackert sie zurück.

export const KERZE_INFO: MicroInfo = {
  id: 'kerze',
  sketch: 'MG-192',
  title: 'Kerze auspusten',
  word: 'PUSTEN!',
  icon: '🕯️',
  durationMs: 7_000,
  controls: { joystick: null, a: 'Pusten', b: null },
};

export const KERZE_RULES = {
  need: 3,
  /** Ein Puster trifft, wenn die Flamme kleiner als das ist (0–1). */
  smallBelow: 0.32,
  periodS: 1.15,
  cooldownS: 0.3,
} as const;

interface Candle {
  good: number;
  readyAt: number;
  doneAt: number | null;
  misses: number;
}

export class KerzeGame extends BaseMicro {
  readonly candles: Map<Slot, Candle>;
  /** Phase der Flamme je Kerze (jede flackert anders). */
  readonly phases: Map<Slot, number>;

  constructor(slots: readonly Slot[], rng: MinigameRng) {
    super(KERZE_INFO, slots);
    this.phases = perSlot(slots, () => rng.next() * Math.PI * 2);
    this.candles = perSlot(slots, () => ({ good: 0, readyAt: 0, doneAt: null, misses: 0 }));
  }

  phase(slot: Slot): number {
    return this.phases.get(slot) ?? 0;
  }

  /** Flammengröße 0–1 der Kerze von `slot` zur Zeit `t` (ohne Pusten). */
  flameAt(slot: Slot, t: number): number {
    return 0.5 + 0.5 * Math.sin((t / KERZE_RULES.periodS) * Math.PI * 2 + this.phase(slot));
  }

  flame(slot: Slot): number {
    return this.done(slot) ? 0 : this.flameAt(slot, this.time);
  }

  press(slot: Slot, button: 'a' | 'b'): void {
    const candle = this.candles.get(slot);
    if (button !== 'a' || !candle || this.finished || candle.doneAt !== null) return;
    if (this.time < candle.readyAt) return;
    candle.readyAt = this.time + KERZE_RULES.cooldownS;
    if (this.flameAt(slot, this.time) < KERZE_RULES.smallBelow) {
      candle.good++;
      if (candle.good >= KERZE_RULES.need) candle.doneAt = this.time;
    } else {
      candle.good = Math.max(0, candle.good - 1);
      candle.misses++;
    }
  }

  done(slot: Slot): boolean {
    return this.candles.get(slot)?.doneAt != null;
  }

  scores() {
    return this.slots.map((slot) => {
      const candle = this.candles.get(slot);
      const score =
        candle?.doneAt != null ? this.finishScore(candle.doneAt) : (candle?.good ?? 0) * 100;
      return { slot, score };
    });
  }

  status(slot: Slot): string | undefined {
    if (this.done(slot)) return 'aus!';
    return `${String(this.candles.get(slot)?.good ?? 0)}/${String(KERZE_RULES.need)}`;
  }
}

class KerzeBot {
  private pressAt: number | null = null;
  private readonly startAt: number;

  constructor(
    private readonly slot: Slot,
    private readonly profile: BotProfile,
    private readonly rng: MinigameRng,
  ) {
    this.startAt = reactionSample(rng, profile.reactionMs) / 1000;
  }

  act(game: MicroGame): BotAction | null {
    const kerze = game as KerzeGame;
    if (kerze.time < this.startAt || kerze.done(this.slot)) return null;
    if (this.pressAt === null) {
      // Nächstes Flammen-Tief nach kurzer Pause anpeilen, mit Takt-Fehler.
      const period = KERZE_RULES.periodS;
      const lowAt = (k: number) => (k + 0.75 - kerze.phase(this.slot) / (Math.PI * 2)) * period;
      let k = Math.floor(kerze.time / period) - 1;
      while (lowAt(k) < kerze.time + 0.2) k++;
      const lapse = this.rng.next() < this.profile.lapse ? period : 0;
      this.pressAt = lowAt(k) + (gaussian(this.rng) * this.profile.timingSdMs) / 1000 + lapse;
    }
    if (kerze.time < this.pressAt) return null;
    this.pressAt = null;
    return PRESS_A;
  }
}

export const KERZE: MicroDefinition<KerzeGame> = {
  info: KERZE_INFO,
  create: (slots, rng) => new KerzeGame(slots, rng),
  bot: (slot, profile, rng) => new KerzeBot(slot, profile, rng),
};

// ---------------------------------------------------------------------------------------------
// MG-194 Fliege fangen: Hand mit dem Stick führen, mit A zuschnappen. Die Fliege schlägt Haken.

export const FLIEGE_INFO: MicroInfo = {
  id: 'fliege',
  sketch: 'MG-194',
  title: 'Fliege fangen',
  word: 'FANGEN!',
  icon: '🪰',
  durationMs: 7_000,
  controls: { joystick: 'Hand', a: 'Schnappen', b: null },
};

export const FLIEGE_RULES = {
  /** Feld je Bahn: u, v in [-1, 1]. */
  handSpeed: 2.4,
  flySpeed: 1.25,
  catchRadius: 0.3,
  cooldownS: 0.45,
} as const;

export interface FlyLane {
  hx: number;
  hy: number;
  sx: number;
  sy: number;
  fx: number;
  fy: number;
  vx: number;
  vy: number;
  turnAt: number;
  readyAt: number;
  caught: number;
  missed: number;
  readonly rng: MinigameRng;
}

export class FliegeGame extends BaseMicro {
  readonly lanes: Map<Slot, FlyLane>;

  constructor(slots: readonly Slot[], rng: MinigameRng) {
    super(FLIEGE_INFO, slots);
    // Jede Bahn hat ihre eigene Fliege (eigener Zufall): manche schlagen fiesere Haken.
    this.lanes = perSlot(slots, () => {
      const laneRng = createMinigameRng(rng.int(1, 0x7fff_ffff));
      const lane: FlyLane = {
        hx: 0,
        hy: -0.7,
        sx: 0,
        sy: 0,
        fx: 0,
        fy: 0,
        vx: 0,
        vy: 0,
        turnAt: 0,
        readyAt: 0,
        caught: 0,
        missed: 0,
        rng: laneRng,
      };
      respawnFly(lane, 0);
      return lane;
    });
  }

  override stick(slot: Slot, x: number, y: number): void {
    super.stick(slot, x, y);
    const lane = this.lanes.get(slot);
    if (!lane) return;
    lane.sx = Math.max(-1, Math.min(1, x));
    lane.sy = Math.max(-1, Math.min(1, y));
  }

  press(slot: Slot, button: 'a' | 'b'): void {
    const lane = this.lanes.get(slot);
    if (button !== 'a' || !lane || this.finished || this.time < lane.readyAt) return;
    lane.readyAt = this.time + FLIEGE_RULES.cooldownS;
    if (Math.hypot(lane.fx - lane.hx, lane.fy - lane.hy) <= FLIEGE_RULES.catchRadius) {
      lane.caught++;
      respawnFly(lane, this.time);
    } else {
      lane.missed++;
    }
  }

  protected override advance(dt: number): void {
    for (const lane of this.lanes.values()) {
      const length = Math.hypot(lane.sx, lane.sy);
      const scale = length > 1 ? 1 / length : 1;
      lane.hx = clamp1(lane.hx + lane.sx * scale * FLIEGE_RULES.handSpeed * dt);
      lane.hy = clamp1(lane.hy + lane.sy * scale * FLIEGE_RULES.handSpeed * dt);
      if (this.time >= lane.turnAt) turnFly(lane, this.time);
      lane.fx += lane.vx * dt;
      lane.fy += lane.vy * dt;
      if (Math.abs(lane.fx) > 0.9) lane.vx = -Math.sign(lane.fx) * Math.abs(lane.vx);
      if (Math.abs(lane.fy) > 0.9) lane.vy = -Math.sign(lane.fy) * Math.abs(lane.vy);
      lane.fx = Math.max(-0.95, Math.min(0.95, lane.fx));
      lane.fy = Math.max(-0.95, Math.min(0.95, lane.fy));
    }
  }

  done(): boolean {
    return false;
  }

  scores() {
    return this.slots.map((slot) => ({ slot, score: this.lanes.get(slot)?.caught ?? 0 }));
  }

  status(slot: Slot): string | undefined {
    const caught = this.lanes.get(slot)?.caught ?? 0;
    return caught > 0 ? `${String(caught)}× gefangen` : undefined;
  }
}

function clamp1(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

function respawnFly(lane: FlyLane, now: number): void {
  lane.fx = lane.rng.next() * 1.6 - 0.8;
  lane.fy = lane.rng.next() * 1.2 - 0.2;
  turnFly(lane, now);
}

/** Haken schlagen: neue Richtung, nächste Wende nach 0,35–0,8 s. */
function turnFly(lane: FlyLane, now: number): void {
  const angle = lane.rng.next() * Math.PI * 2;
  lane.vx = Math.cos(angle) * FLIEGE_RULES.flySpeed;
  lane.vy = Math.sin(angle) * FLIEGE_RULES.flySpeed;
  lane.turnAt = now + 0.35 + lane.rng.next() * 0.45;
}

class FliegeBot {
  private seenAt = 0;
  private aimX = 0;
  private aimY = 0;

  constructor(
    private readonly slot: Slot,
    private readonly profile: BotProfile,
    private readonly rng: MinigameRng,
  ) {}

  act(game: MicroGame): BotAction | null {
    const lane = (game as FliegeGame).lanes.get(this.slot);
    if (!lane) return null;
    // Sieht die Fliege mit Verzögerung (eigene Reaktionszeit) und lenkt dorthin.
    if (game.time >= this.seenAt) {
      this.aimX = lane.fx;
      this.aimY = lane.fy;
      this.seenAt = game.time + reactionSample(this.rng, this.profile.reactionMs) / 2500;
    }
    const dx = this.aimX - lane.hx;
    const dy = this.aimY - lane.hy;
    const distance = Math.hypot(dx, dy);
    const stick =
      distance < 0.05 ? { x: 0, y: 0 } : noisyStick(Math.atan2(dy, dx), this.profile, this.rng);
    const real = Math.hypot(lane.fx - lane.hx, lane.fy - lane.hy);
    const eager = this.rng.next() < this.profile.falseStart * 0.2;
    const snap = game.time >= lane.readyAt && (real < 0.22 || (eager && real < 0.5));
    if (snap && this.rng.next() < this.profile.lapse) return { stick };
    return snap ? { stick, press: ['a'] } : { stick };
  }
}

export const FLIEGE: MicroDefinition<FliegeGame> = {
  info: FLIEGE_INFO,
  create: (slots, rng) => new FliegeGame(slots, rng),
  bot: (slot, profile, rng) => new FliegeBot(slot, profile, rng),
};

// ---------------------------------------------------------------------------------------------
// MG-193 Kuchen teilen: Der Kuchen gleitet hin und her; mit einem Schnitt genau halbieren.

export const KUCHEN_INFO: MicroInfo = {
  id: 'kuchen',
  sketch: 'MG-193',
  title: 'Kuchen teilen',
  word: 'HALBIEREN!',
  icon: '🍰',
  durationMs: 6_000,
  controls: { joystick: 'Messer', a: 'Schneiden', b: null },
};

export const KUCHEN_RULES = {
  knifeSpeed: 1.8,
  /** Ausschlag der Kuchenmitte (u). */
  swing: 0.55,
  /** So weit daneben gibt es keine Punkte mehr. */
  zeroAt: 0.5,
} as const;

interface Cutter {
  knife: number;
  stick: number;
  cut: { readonly at: number; readonly offset: number } | null;
}

export class KuchenGame extends BaseMicro {
  readonly cutters: Map<Slot, Cutter>;
  readonly phase: number;

  constructor(slots: readonly Slot[], rng: MinigameRng) {
    super(KUCHEN_INFO, slots);
    this.phase = rng.next() * Math.PI * 2;
    this.cutters = perSlot(slots, () => ({ knife: 0, stick: 0, cut: null }));
  }

  /** Mitte des Kuchens (u) zur Zeit `t`: gleitet immer schneller. */
  cakeAt(t: number): number {
    return KUCHEN_RULES.swing * Math.sin(this.phase + t * (1.4 + t * 0.18));
  }

  override stick(slot: Slot, x: number, y = 0): void {
    super.stick(slot, x, y);
    const cutter = this.cutters.get(slot);
    if (cutter) cutter.stick = Math.max(-1, Math.min(1, x));
  }

  press(slot: Slot, button: 'a' | 'b'): void {
    const cutter = this.cutters.get(slot);
    if (button !== 'a' || !cutter || cutter.cut || this.finished) return;
    cutter.cut = { at: this.time, offset: cutter.knife - this.cakeAt(this.time) };
  }

  /** Gleichheit der Hälften 0–100 (100 = genau halbiert). */
  accuracy(slot: Slot): number | null {
    const cut = this.cutters.get(slot)?.cut;
    if (!cut) return null;
    return Math.max(0, Math.round(100 * (1 - Math.abs(cut.offset) / KUCHEN_RULES.zeroAt)));
  }

  protected override advance(dt: number): void {
    for (const cutter of this.cutters.values()) {
      if (cutter.cut) continue;
      cutter.knife = Math.max(
        -0.95,
        Math.min(0.95, cutter.knife + cutter.stick * KUCHEN_RULES.knifeSpeed * dt),
      );
    }
  }

  done(slot: Slot): boolean {
    return this.cutters.get(slot)?.cut != null;
  }

  scores() {
    return this.slots.map((slot) => ({ slot, score: this.accuracy(slot) ?? 0 }));
  }

  status(slot: Slot): string | undefined {
    const accuracy = this.accuracy(slot);
    return accuracy === null ? undefined : `${String(accuracy)} %`;
  }
}

class KuchenBot {
  private readonly startAt: number;
  private readonly tolerance: number;

  constructor(
    private readonly slot: Slot,
    private readonly profile: BotProfile,
    private readonly rng: MinigameRng,
  ) {
    this.startAt = reactionSample(rng, profile.reactionMs) / 1000;
    this.tolerance = 0.03 + profile.aimNoise * 0.5;
  }

  act(game: MicroGame): BotAction | null {
    const kuchen = game as KuchenGame;
    const cutter = kuchen.cutters.get(this.slot);
    if (!cutter || cutter.cut || kuchen.time < this.startAt) return null;
    // Das Messer folgt dem Kuchen (mit Verzögerung), geschnitten wird nah genug dran.
    const seen = kuchen.cakeAt(kuchen.time - this.profile.reactionMs / 1000);
    const diff = seen - cutter.knife;
    const stick = {
      x: Math.max(-1, Math.min(1, diff * 6 + gaussian(this.rng) * this.profile.aimNoise)),
      y: 0,
    };
    const late = kuchen.remainingS < 0.8;
    const real = Math.abs(kuchen.cakeAt(kuchen.time) - cutter.knife);
    const cut = real < this.tolerance || late || this.rng.next() < this.profile.falseStart * 0.01;
    return cut && this.rng.next() >= this.profile.lapse * 0.2 ? { stick, press: ['a'] } : { stick };
  }
}

export const KUCHEN: MicroDefinition<KuchenGame> = {
  info: KUCHEN_INFO,
  create: (slots, rng) => new KuchenGame(slots, rng),
  bot: (slot, profile, rng) => new KuchenBot(slot, profile, rng),
};

/** Der Mikro-Vorrat (Reihenfolge egal; die Kette mischt per Seed). */
export const MICRO_POOL: readonly MicroDefinition[] = [WECKER, SPAGHETTI, KERZE, FLIEGE, KUCHEN];

export function getMicro(id: string): MicroDefinition | undefined {
  return MICRO_POOL.find((micro) => micro.info.id === id);
}
