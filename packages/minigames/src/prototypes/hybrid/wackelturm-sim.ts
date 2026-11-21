/**
 * Konzept A „Wackelturm“ (EXP-007): Bots auf den echten Regeln aus `wackelturm/logic.ts`.
 * Varianten sind Parameter-Sätze; die gewählte Fassung ist `WACKELTURM_PARAMS`.
 */
import type { MinigameRng } from '@chaos-party/minigame-sdk';
import { createMinigameRng } from '@chaos-party/minigame-sdk';
import { WACKELTURM_INFO } from '../../wackelturm/info.ts';
import {
  canBump,
  createWackelturm,
  inOwnNest,
  inPile,
  nestPosition,
  pressBump,
  pressGrab,
  setStick,
  steadyPace,
  stepWackelturm,
  WACKELTURM_PARAMS,
  type Runner,
  type WackelturmParams,
  type WackelturmState,
} from '../../wackelturm/logic.ts';
import {
  botRng,
  gauss,
  InputCounter,
  LeadTracker,
  slotsFor,
  STEP,
  type BotProfile,
  type Concept,
  type GameRecord,
} from './common.ts';

/**
 * Wie ein Bot die Kippgrenze einschätzt (CHAOS-215). Austauschbar, damit das Experiment
 * Bot-Annahmen vergleichen kann, ohne die Spielregeln anzufassen.
 */
export interface WackelturmBotModel {
  readonly key: string;
  readonly label: string;
  /**
   * Tempo einer Fahrt relativ zur Dauer-Kippgrenze `steadyPace` (1 = genau an der Grenze).
   * Wird je Fahrt einmal gezogen: So verschätzt sich ein Mensch auch mal für einen Turm.
   */
  readonly pace: (skill: number, rng: MinigameRng) => number;
  /** Ab diesem Wackeln wird scharf gebremst (0 = ruhig, 1 = kippt). */
  readonly caution: (skill: number) => number;
}

/**
 * EXP-007: Geschickte halten viel Abstand zur Kippgrenze (Tempo 0,77 der Grenze bei Geschick
 * 0,9) und bremsen früh; Ungeschickte laufen fast an der Grenze (0,97) und bremsen spät.
 * Folge (CHAOS-215): Geschick macht langsamer statt sicherer, weil Kippen selten ist.
 */
export const EXP007_BOT_MODEL: WackelturmBotModel = {
  key: 'K0',
  label: 'K0: EXP-007 (Geschick = mehr Abstand zur Grenze)',
  pace: (skill) => Math.sqrt(0.55 + 0.5 * (1 - skill)),
  caution: (skill) => 0.8 - 0.4 * skill,
};

/**
 * CHAOS-215 (EXP-039): Geschick heißt, die Kippgrenze gut zu kennen. Alle laufen im Mittel
 * knapp darunter (0,89–0,93 der Grenze); Ungeschickte verschätzen sich je Turm stärker
 * (Streuung 0,4 · (1 − Geschick)), mal zu zaghaft, mal zu forsch. Gebremst wird, wenn es
 * sichtbar wackelt: Geschickte lesen das Wackeln und bremsen erst spät (0,78 bei Geschick 0,9),
 * Ungeschickte erschrecken früh (0,60 bei 0,2).
 */
export const KIPPGEFUEHL_BOT_MODEL: WackelturmBotModel = {
  key: 'K3',
  label: 'K3: Kippgefühl wächst mit Geschick (gewählt)',
  pace: (skill, rng) => Math.max(0.5, 0.88 + 0.06 * skill + gauss(rng, 0.4 * (1 - skill))),
  caution: (skill) => 0.55 + 0.25 * skill,
};

/** Bot für den Wackelturm: plant im Takt seiner Reaktionszeit, lenkt mit begrenzter Drehrate. */
export class WackelturmBot {
  private readonly reaction: number;
  private readonly turnRate: number;
  private readonly caution: number;
  private readonly noise: number;
  private pace = 1;
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
  readonly counter = new InputCounter();

  constructor(
    private readonly profile: BotProfile,
    private readonly rng: MinigameRng,
    private readonly seatIndex: number,
    private readonly model: WackelturmBotModel = KIPPGEFUEHL_BOT_MODEL,
  ) {
    const { skill } = profile;
    this.reaction = 0.45 - 0.3 * skill;
    this.turnRate = 2 + 10 * skill;
    this.caution = model.caution(skill);
    this.noise = (1 - skill) * 0.35;
    this.newTrip();
  }

  get seat(): number {
    return this.seatIndex;
  }

  private newTrip(): void {
    const { rng } = this;
    switch (this.profile.strategy) {
      case 'vorsichtig':
        this.targetHeight = rng.int(2, 4);
        break;
      case 'gierig':
        this.targetHeight = rng.int(7, 10);
        break;
      case 'zufaellig':
        this.targetHeight = rng.int(1, 10);
        break;
      case 'raufbold':
        this.targetHeight = rng.int(3, 5);
        break;
    }
    const angle = rng.next() * Math.PI * 2;
    const radius = rng.next() * 0.7;
    this.pileOffset = { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius };
    this.pace = this.model.pace(this.profile.skill, rng);
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

  /** Eingaben für den nächsten Schritt setzen. */
  act(state: WackelturmState, me: Runner): void {
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
    setStick(state, me.slot, this.stickX, this.stickZ);
    this.counter.stick(this.stickX, this.stickZ);

    if (this.wantBump && canBump(me, params)) {
      this.wantBump = false;
      pressBump(state, me.slot);
      this.counter.press('b');
      return;
    }
    if (
      inPile(me, params) &&
      me.stack.length < this.targetHeight &&
      state.time >= this.nextPress &&
      me.grabCooldown <= 0
    ) {
      pressGrab(state, me.slot);
      this.counter.press('a');
      this.nextPress = state.time + 0.05 + (1 - this.profile.skill) * 0.25 + this.rng.next() * 0.08;
    }
  }

  private think(state: WackelturmState, me: Runner): void {
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
    // Gefühl fürs Tempo (Modell, CHAOS-215): wie nah an der Kippgrenze diese Fahrt läuft.
    // Wackelt es sichtbar, wird gebremst.
    const height = me.stack.length;
    let magnitude = Math.min(1, distance / 0.8, steadyPace(height, params) * this.pace);
    if (me.wobble > this.caution) magnitude *= 0.25;
    this.steer(dx, dz, magnitude);
  }

  private canGrabMore(state: WackelturmState, me: Runner): boolean {
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

export interface WackelturmVariant {
  readonly key: string;
  readonly label: string;
  readonly params: WackelturmParams;
}

/** Erste Fassung: nur Lenkwackeln, keine Trägheit, Stapeln immer gleich schnell. */
const FIRST: WackelturmParams = {
  ...WACKELTURM_PARAMS,
  walkWobble: 0,
  loadInertia: 0,
  grabSlowdown: 0,
  bump: { ...WACKELTURM_PARAMS.bump, steal: 0.5, missStun: 0 },
};

/** Varianten von Konzept A. Die letzte ist die gewählte Fassung (`WACKELTURM_PARAMS`). */
export const WACKELTURM_VARIANTS: readonly WackelturmVariant[] = [
  {
    key: 'A1',
    label: 'A1: linear, ohne Rempeln, ohne Gold',
    params: { ...FIRST, bonusFrom: null, goldEvery: 0, bump: { ...FIRST.bump, enabled: false } },
  },
  {
    key: 'A2',
    label: 'A2: + Turmbonus ×2 ab 6',
    params: { ...FIRST, goldEvery: 0, bump: { ...FIRST.bump, enabled: false } },
  },
  {
    key: 'A3',
    label: 'A3: + Rempeln immer, ohne Klau',
    params: { ...FIRST, goldEvery: 0, bump: { ...FIRST.bump, emptyHandsOnly: false, steal: 0 } },
  },
  {
    key: 'A4',
    label: 'A4: Rempeln nur mit leeren Händen, Klau ½, Gold',
    params: FIRST,
  },
  {
    key: 'A5',
    label: 'A5: + Laufwackeln, Trägheit, Klau ganz, Bauchklatscher',
    params: { ...WACKELTURM_PARAMS, grabSlowdown: 0 },
  },
  {
    key: 'A6',
    label: 'A6: + hoch stapeln dauert länger (gewählt)',
    params: WACKELTURM_PARAMS,
  },
];

/**
 * Konzept für die EXP-007-Tabellen. Spielt bewusst mit dem damaligen Bot-Modell, damit die
 * Zahlen in `docs/experiments.md` reproduzierbar bleiben; die Fairness-Prüfung (CHAOS-84)
 * nutzt das Modell aus CHAOS-215.
 */
export const WACKELTURM_CONCEPT: Concept<WackelturmParams> = {
  id: 'A',
  title: 'Wackelturm',
  instructions: WACKELTURM_INFO.instructions,
  controls: { joystick: 'Laufen', a: 'Greifen', b: 'Rempeln' },
  durationSeconds: WACKELTURM_INFO.durationMs / 1000,
  play: (bots, seed, params) =>
    playWackelturm(bots, seed, params, WACKELTURM_INFO.durationMs / 1000, EXP007_BOT_MODEL),
};

export function playWackelturm(
  profiles: readonly BotProfile[],
  seed: number,
  params: WackelturmParams = WACKELTURM_PARAMS,
  seconds = WACKELTURM_INFO.durationMs / 1000,
  model: WackelturmBotModel = KIPPGEFUEHL_BOT_MODEL,
): GameRecord {
  const slots = slotsFor(profiles.length);
  const state = createWackelturm(slots, seconds, params);
  const gameRng = createMinigameRng(seed);
  const bots = profiles.map(
    (profile, seat) => new WackelturmBot(profile, botRng(seed, seat), seat, model),
  );
  const lead = new LeadTracker();
  let drama = 0;
  while (!state.finished) {
    bots.forEach((bot, seat) => {
      const runner = state.runners[seat];
      if (runner) bot.act(state, runner);
    });
    const events = stepWackelturm(state, STEP, () => gameRng.next());
    for (const event of events) {
      if (event.type === 'topple') drama++;
      if (event.type === 'deliver') lead.update(state.runners.map((runner) => runner.score));
    }
  }
  const inputs = bots.reduce((sum, bot) => sum + bot.counter.count, 0);
  const presses = bots.reduce((sum, bot) => sum + bot.counter.presses, 0);
  const bPresses = bots.reduce((sum, bot) => sum + bot.counter.bPresses, 0);
  return {
    scores: state.runners.map((runner) => runner.score),
    seconds: state.time,
    dramaticMoments: drama,
    inputsPerSecond: inputs / profiles.length / state.time,
    bShare: presses > 0 ? bPresses / presses : 0,
    leadChanges: lead.changes,
  };
}
