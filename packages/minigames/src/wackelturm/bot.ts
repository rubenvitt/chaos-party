/**
 * KI-Bot für den Wackelturm (CHAOS-180), aus EXP-007 übernommen: plant im Takt seiner
 * Reaktionszeit, lenkt mit begrenzter Drehrate, stapelt bis zu einer Wunschhöhe, weicht
 * sichtbaren Remplern aus und rempelt selbst. Er liest nur, was am Bildschirm sichtbar ist
 * (Figuren, Türme, Wackeln, Goldtörtchen) und gibt Eingaben über `WackelturmControls`.
 *
 * Genutzt von der echten Partie (`Wackelturm.createBot`), der Fairness-Prüfung (CHAOS-84) und
 * EXP-007 (`prototypes/hybrid/wackelturm-sim.ts`).
 */
import {
  lerpStrength,
  tap,
  type MinigameBotDriver,
  type MinigameBotOptions,
  type MinigameInput,
  type MinigameRng,
} from '@chaos-party/minigame-sdk';
import {
  canBump,
  inOwnNest,
  inPile,
  nestPosition,
  steadyPace,
  type Runner,
  type WackelturmState,
} from './logic.ts';

const STEP = 1 / 60;

/** Taktische Grundhaltung (EXP-007). */
export type WackelturmStrategy = 'vorsichtig' | 'gierig' | 'zufaellig' | 'raufbold';

export interface WackelturmBotProfile {
  readonly strategy: WackelturmStrategy;
  /** Geschicklichkeit 0–1: Reaktionszeit, Lenkgenauigkeit, Timing, Gefühl für die Kippgrenze. */
  readonly skill: number;
  /**
   * Tempo als Anteil der Kippgrenze (`steadyPace`). Fehlt = wie EXP-007 aus `skill`
   * (√(0,55 + 0,5·(1 − skill)): Geschickte bleiben weit darunter).
   */
  readonly pace?: number;
  /** Ab diesem Wackeln (0–1) bremsen. Fehlt = wie EXP-007 aus `skill` (0,8 − 0,4·skill). */
  readonly caution?: number;
  /** Wunschhöhe je Gang [min, max]. Fehlt = aus der Strategie. */
  readonly heights?: readonly [number, number];
}

/** Wunschhöhe je Gang nach Strategie (EXP-007). */
const STRATEGY_HEIGHTS: Readonly<Record<WackelturmStrategy, readonly [number, number]>> = {
  vorsichtig: [2, 4],
  gierig: [7, 10],
  zufaellig: [1, 10],
  raufbold: [3, 5],
};

/**
 * Eckwerte der KI-Stärke (CHAOS-180). Leicht spielt wie der Neuling aus EXP-007 (Geschick 0,2,
 * Wunschhöhe zufällig 1–10, Tempo und Bremsen aus dem Geschick). Schwer ist geschickt (0,9),
 * zielt auf den Turmbonus (5–8 Törtchen), läuft näher an der Kippgrenze und bremst erst bei
 * deutlichem Wackeln. Der Profi aus EXP-007 (Geschick 0,9 mit Wunschhöhe 1–10, Tempo 0,74,
 * Bremsen ab 0,44) verlor gegen den Neuling; das spricht für ein Bot-Problem, nicht für das
 * Spiel (CHAOS-215). Messung und Raster: EXP-039.
 */
export const WACKELTURM_STRENGTH_CORNERS = {
  leicht: { skill: 0.2, pace: Math.sqrt(0.55 + 0.5 * 0.8), caution: 0.72, heights: [1, 10] },
  schwer: { skill: 0.9, pace: 0.85, caution: 0.75, heights: [5, 8] },
} as const;

/** Was der Bot tun kann (Bot-Partie: direkt auf die Logik, Laufzeit: Eingaben). */
export interface WackelturmControls {
  /** Stick (x, z = +y am Joystick). */
  stick(x: number, z: number): void;
  /** A: Törtchen greifen. */
  grab(): void;
  /** B: rempeln. */
  bump(): void;
}

/** Normalverteilt (Box-Muller) mit Mittel 0. */
function gauss(rng: MinigameRng, sigma: number): number {
  const u = Math.max(1e-9, rng.next());
  const v = rng.next();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * sigma;
}

/** Bot für den Wackelturm: plant im Takt seiner Reaktionszeit, lenkt mit begrenzter Drehrate. */
export class WackelturmBot {
  private readonly reaction: number;
  private readonly turnRate: number;
  private readonly caution: number;
  private readonly noise: number;
  private nextThink = 0;
  private nextPress = 0;
  private wantX = 0;
  private wantZ = 0;
  private magnitude = 0;
  private stickX = 0;
  private stickZ = 0;
  private targetHeight = 3;
  private pileOffset = { x: 0, z: 0 };
  private hunting = 0;
  private wantBump = false;
  constructor(
    private readonly profile: WackelturmBotProfile,
    private readonly rng: MinigameRng,
    private readonly seatIndex: number,
  ) {
    const { skill } = profile;
    this.reaction = 0.45 - 0.3 * skill;
    this.turnRate = 2 + 10 * skill;
    this.caution = profile.caution ?? 0.8 - 0.4 * skill;
    this.noise = (1 - skill) * 0.35;
    this.newTrip();
  }

  get seat(): number {
    return this.seatIndex;
  }

  private newTrip(): void {
    const { rng } = this;
    const [min, max] = this.profile.heights ?? STRATEGY_HEIGHTS[this.profile.strategy];
    this.targetHeight = rng.int(min, max);
    const angle = rng.next() * Math.PI * 2;
    const radius = rng.next() * 0.7;
    this.pileOffset = { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius };
  }

  private bumpChance(): number {
    switch (this.profile.strategy) {
      case 'vorsichtig':
        return 0.15;
      case 'gierig':
        return 0.15;
      case 'zufaellig':
        return 0.4;
      case 'raufbold':
        return 1;
    }
  }

  /** Eingaben für den nächsten Schritt über `controls` geben (Zustand nur lesen). */
  act(state: Readonly<WackelturmState>, me: Readonly<Runner>, controls: WackelturmControls): void {
    const { params } = state;
    if (state.time >= this.nextThink) {
      this.nextThink = state.time + this.reaction * (0.8 + this.rng.next() * 0.4);
      this.think(state, me);
    }
    // Lenken mit begrenzter Drehrate (ungeschickt = ruckartig spät, geschickt = sanft früh).
    const targetX = this.wantX * this.magnitude;
    const targetZ = this.wantZ * this.magnitude;
    const maxChange = this.turnRate * STEP;
    const dx = targetX - this.stickX;
    const dz = targetZ - this.stickZ;
    const change = Math.hypot(dx, dz);
    const scale = change > maxChange ? maxChange / change : 1;
    this.stickX += dx * scale;
    this.stickZ += dz * scale;
    controls.stick(this.stickX, this.stickZ);

    if (this.wantBump && canBump(me, params)) {
      this.wantBump = false;
      controls.bump();
      return;
    }
    if (
      inPile(me, params) &&
      me.stack.length < this.targetHeight &&
      state.time >= this.nextPress &&
      me.grabCooldown <= 0
    ) {
      controls.grab();
      this.nextPress = state.time + 0.05 + (1 - this.profile.skill) * 0.25 + this.rng.next() * 0.08;
    }
  }

  private think(state: Readonly<WackelturmState>, me: Readonly<Runner>): void {
    const { params } = state;
    const { skill } = this.profile;
    if (me.stack.length === 0 && inOwnNest(me, params)) this.newTrip();

    // Ausweichen: Ein Rempler mit leeren Händen kommt auf mich zu (Menschen sehen das).
    if (me.stack.length >= 2 && params.bump.enabled) {
      const threat = state.runners.find((other) => {
        if (other === me || other.stun > 0) return false;
        if (params.bump.emptyHandsOnly && other.stack.length > 0) return false;
        if (other.dash <= 0 && other.bumpCooldown > 0) return false;
        const dx = me.x - other.x;
        const dz = me.z - other.z;
        const distance = Math.hypot(dx, dz);
        const closing = ((other.vx - me.vx) * dx + (other.vz - me.vz) * dz) / (distance || 1);
        return distance < 2.6 && closing > 1;
      });
      if (threat && this.rng.next() < skill * (threat.dash > 0 ? 0.9 : 0.6)) {
        const dx = me.x - threat.x;
        const dz = me.z - threat.z;
        const side = dx * me.vz - dz * me.vx >= 0 ? 1 : -1;
        this.steer(-dz * side, dx * side, 1);
        return;
      }
    }

    // Gegner zum Rempeln?
    const prey = state.runners
      .filter((other) => other !== me && other.stack.length >= 2 && other.stun <= 0)
      .filter((other) => !inOwnNest(other, params))
      .map((other) => ({ other, distance: Math.hypot(other.x - me.x, other.z - me.z) }))
      .sort((a, b) => b.other.stack.length - a.other.stack.length || a.distance - b.distance)[0];
    const emptyHanded = me.stack.length === 0 || !params.bump.emptyHandsOnly;
    if (params.bump.enabled && emptyHanded && prey) {
      const huntRange = this.profile.strategy === 'raufbold' ? 6 : 2.2;
      if (prey.distance < huntRange && this.rng.next() < this.bumpChance()) {
        this.hunting = state.time + 2.5;
      }
      if (this.hunting > state.time) {
        const lead = 0.15;
        const aimX = prey.other.x + prey.other.vx * lead - me.x;
        const aimZ = prey.other.z + prey.other.vz * lead - me.z;
        this.steer(aimX, aimZ, 1);
        if (prey.distance < 1.9 && canBump(me, params)) {
          // B drücken (Richtung = aktueller Stick, der schon zum Ziel zeigt).
          this.wantBump = this.rng.next() < 0.4 + 0.6 * skill;
        }
        return;
      }
    }

    // Goldtörtchen in der Nähe, solange der Turm niedrig ist?
    const goldLimit = this.profile.strategy === 'gierig' ? 6 : 3;
    const gold = state.gold
      .map((piece) => ({ piece, distance: Math.hypot(piece.x - me.x, piece.z - me.z) }))
      .sort((a, b) => a.distance - b.distance)[0];
    if (gold && me.stack.length <= goldLimit && gold.distance < 4.5) {
      this.steer(gold.piece.x - me.x, gold.piece.z - me.z, 1);
      return;
    }

    const delivering =
      me.stack.length >= this.targetHeight || (me.stack.length > 0 && !this.canGrabMore(state, me));
    const target = delivering
      ? nestPosition(me.slot, params)
      : { x: this.pileOffset.x, z: this.pileOffset.z };
    const dx = target.x - me.x;
    const dz = target.z - me.z;
    const distance = Math.hypot(dx, dz);
    if (!delivering && inPile(me, params) && distance < 0.5) {
      this.magnitude = 0;
      return;
    }
    // Gefühl fürs Tempo: Geschickte bleiben mit Abstand unter der Kippgrenze, Ungeschickte
    // schätzen sie zu hoch ein. Wackelt es sichtbar, wird gebremst.
    const height = me.stack.length;
    const feel = this.profile.pace ?? Math.sqrt(0.55 + 0.5 * (1 - skill));
    let magnitude = Math.min(1, distance / 0.8, steadyPace(height, params) * feel);
    if (me.wobble > this.caution) magnitude *= 0.25;
    this.steer(dx, dz, magnitude);
  }

  private canGrabMore(state: Readonly<WackelturmState>, me: Readonly<Runner>): boolean {
    // Kurz vor Schluss: lieber abliefern, als mit vollen Händen zu enden.
    const nest = nestPosition(me.slot, state.params);
    const distance = Math.hypot(nest.x - me.x, nest.z - me.z);
    const speed = state.params.baseSpeed / (1 + state.params.loadSlowdown * me.stack.length);
    const timeLeft = state.limitSeconds - state.time;
    const margin = 1.5 + (1 - this.profile.skill) * 1.5;
    return timeLeft > distance / (speed * 0.75) + margin;
  }

  private steer(dx: number, dz: number, magnitude: number): void {
    const length = Math.hypot(dx, dz);
    if (length < 1e-6) {
      this.magnitude = 0;
      return;
    }
    const angle = Math.atan2(dz, dx) + gauss(this.rng, this.noise);
    this.wantX = Math.cos(angle);
    this.wantZ = Math.sin(angle);
    this.magnitude = magnitude;
  }
}

/** Bot-Profil eines KI-Platzes zur Stärke `s` (jeder Wert linear zwischen den Eckwerten). */
export function wackelturmProfileForStrength(strength: number): WackelturmBotProfile {
  const { leicht, schwer } = WACKELTURM_STRENGTH_CORNERS;
  const mix = (a: number, b: number) => lerpStrength(a, b, strength);
  return {
    strategy: 'zufaellig',
    skill: mix(leicht.skill, schwer.skill),
    pace: mix(leicht.pace, schwer.pace),
    caution: mix(leicht.caution, schwer.caution),
    heights: [
      Math.round(mix(leicht.heights[0], schwer.heights[0])),
      Math.round(mix(leicht.heights[1], schwer.heights[1])),
    ],
  };
}

/** Laufzeit-Bot für einen KI-Platz (`Minigame.createBot`). */
export function createWackelturmBot(
  options: MinigameBotOptions,
  observe: () => Readonly<WackelturmState> | null,
): MinigameBotDriver {
  const bot = new WackelturmBot(
    wackelturmProfileForStrength(options.strength),
    options.rng,
    options.slot - 1,
  );
  return {
    slot: options.slot,
    tick: () => {
      const state = observe();
      const me = state?.runners.find((runner) => runner.slot === options.slot);
      if (!state || !me || state.finished) return [];
      const inputs: MinigameInput[] = [];
      bot.act(state, me, {
        stick: (x, z) => inputs.push({ type: 'move', x, y: z }),
        grab: () => inputs.push(...tap('a')),
        bump: () => inputs.push(...tap('b')),
      });
      return inputs;
    },
  };
}
