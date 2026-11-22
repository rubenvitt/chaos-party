/**
 * Regeln von Eiswürfel-Sumo (rein, MG-023): Schmelzplan des Würfels, Wertung, Rauswurf-
 * Gutschrift und Rückkehr nach dem Sturz. Die Physik (Havok) steckt in `index.ts`.
 */
import {
  arenaLayout,
  offEdge,
  EventTally,
  MatchClock,
  Scoreboard,
  buildHighlights,
  tallyFacts,
  type HighlightRule,
} from '@chaos-party/minigame-kit';
import type { MinigameRng, Slot } from '@chaos-party/minigame-sdk';

/**
 * Schmelzplan: halbe Kante der Oberseite (m) von `startHalf` bis `endHalf` in `steps` Stufen ab
 * `startS`, alle `everyS` s; der nasse Rand warnt `warnS` vorher.
 */
export const MELT = { startHalf: 3.2, endHalf: 0.7, startS: 4, everyS: 3, steps: 8, warnS: 1 };
/**
 * Limo-Spiegel und Grenze „hineingefallen“ (y); Rückkehr nach `respawnS`; ein Sturz bis `creditS`
 * nach dem letzten Rempler ist ein Rauswurf; in der Schlussphase (`finaleS`) gibt es keine Rückkehr.
 */
export const LIMO = { y: -0.6, outY: -1.1, respawnS: 1.5, creditS: 3, finaleS: 8 };
/** Punkte je Sekunde auf dem Eis, je Rauswurf und (abgezogen) je Sturz. */
export const POINTS = { perS: 10, ko: 40, fall: 25 };

/**
 * Figuren auf dem Eis (`havokPawn`): wenig Beschleunigung, Schwung trägt weit (glatt). Rempeln
 * setzt das Tempo; Stoß für das Opfer, Rückstoß des Remplers als Anteil davon (s bzw. m/s).
 */
export const PAWN = {
  radius: 0.42,
  height: 1.4,
  steering: { maxSpeed: 4.2, responsiveness: 3, maxAcceleration: 11 },
  dash: { speed: 5.5, cooldownS: 1, hitS: 0.35, pauseS: 0.3 },
  push: { speed: 3.8, recoil: 0.7, victimPauseS: 0.25, attackerPauseS: 0.25 * 0.6 },
};

/** Der Würfel als eckige Insel (Oberkante y = 0); `offIce`: über die Kante geraten. */
export const iceIsland = (half: number) =>
  arenaLayout({ form: 'insel', halfX: half, halfZ: half, height: 0 });
export const offIce = (half: number, x: number, z: number) => offEdge(iceIsland(half), x, z);

/** Vorbei gegangene Schmelzstufen zur Zeit `t` (0 … `meltSteps`). */
export function meltLevel(t: number): number {
  if (t < MELT.startS) return 0;
  return Math.min(MELT.steps, Math.floor((t - MELT.startS) / MELT.everyS) + 1);
}

export function cubeHalf(level: number): number {
  const p = Math.min(1, level / MELT.steps);
  return MELT.startHalf - (MELT.startHalf - MELT.endHalf) * p;
}

/** Schmilzt gleich die nächste Stufe (nasser Rand sichtbar)? */
export function meltWarning(t: number): boolean {
  const level = meltLevel(t);
  const next = MELT.startS + level * MELT.everyS;
  return level < MELT.steps && next - t <= MELT.warnS;
}

/** Rückkehr-Punkt im inneren Drittel, nie genau in der Mitte. */
export function respawnPoint(rng: MinigameRng, half: number): { x: number; z: number } {
  const angle = rng.next() * Math.PI * 2;
  const r = half * (0.3 + rng.next() * 0.25);
  return { x: Math.cos(angle) * r, z: Math.sin(angle) * r };
}

export interface Sumo {
  readonly slot: Slot;
  iceMs: number;
  kos: number;
  falls: number;
  out: boolean;
  /** `null` bei `out`: in der Schlussphase gefallen, bleibt in der Limo. */
  respawnAt: number | null;
  lastBonk: { readonly by: Slot; readonly at: number } | null;
}

const HIGHLIGHTS: readonly HighlightRule[] = [
  { kind: 'top', stat: 'ko', text: (name, n) => `${name} schubst ${n}× jemanden in die Limo.` },
  { kind: 'top', stat: 'fall', min: 2, text: (name, n) => `${name} plumpst ${n}× in die Limo.` },
  { kind: 'last', stat: 'ko', text: (name) => `${name} gelingt der letzte Rauswurf.` },
];

export class SumoRules {
  readonly clock: MatchClock;
  readonly board: Scoreboard;
  readonly tally = new EventTally<'ko' | 'fall'>();
  readonly sumos: Sumo[];

  constructor(slots: readonly Slot[], timeLimitMs: number) {
    this.clock = new MatchClock(timeLimitMs, LIMO.finaleS);
    this.board = new Scoreboard(slots);
    this.sumos = slots.map((slot) => {
      return { slot, iceMs: 0, kos: 0, falls: 0, out: false, respawnAt: null, lastBonk: null };
    });
  }

  sumo(slot: Slot): Sumo | undefined {
    return this.sumos.find((sumo) => sumo.slot === slot);
  }

  get half(): number {
    return cubeHalf(meltLevel(this.clock.time));
  }

  /** Zeit auf dem Eis gutschreiben. */
  onIce(slot: Slot, dt: number): void {
    const sumo = this.sumo(slot);
    if (sumo && !sumo.out) sumo.iceMs += dt * 1000;
  }

  bonk(victim: Slot, by: Slot): void {
    const sumo = this.sumo(victim);
    if (sumo) sumo.lastBonk = { by, at: this.clock.time };
  }

  /** Sturz in die Limo; liefert, wem der Rauswurf gutgeschrieben wird. */
  fall(slot: Slot): { credit: Slot | null; final: boolean } {
    const sumo = this.sumo(slot);
    if (!sumo || sumo.out) return { credit: null, final: false };
    const now = this.clock.time;
    const by = sumo.lastBonk && now - sumo.lastBonk.at <= LIMO.creditS ? sumo.lastBonk.by : null;
    const final = this.clock.finale || !this.clock.fitsBeforeEnd(LIMO.respawnS);
    Object.assign(sumo, { out: true, falls: sumo.falls + 1, lastBonk: null });
    sumo.respawnAt = final ? null : now + LIMO.respawnS;
    this.tally.count(slot, 'fall');
    const pusher = by === null ? undefined : this.sumo(by);
    if (pusher) {
      pusher.kos++;
      this.tally.count(pusher.slot, 'ko');
    }
    return { credit: by, final };
  }

  /** Wer jetzt zurück aufs Eis darf. */
  respawnDue(): Sumo[] {
    const now = this.clock.time;
    const due = this.sumos.filter((s) => s.out && s.respawnAt !== null && now >= s.respawnAt);
    for (const sumo of due) Object.assign(sumo, { out: false, respawnAt: null });
    return due;
  }

  /** Punkte = Zehntelsekunden auf dem Eis + Rauswürfe − Stürze (feinkörnig, selten gleich). */
  refresh(): void {
    for (const s of this.sumos) {
      const time = Math.floor((s.iceMs / 1000) * POINTS.perS);
      this.board.set(s.slot, Math.max(0, time + s.kos * POINTS.ko - s.falls * POINTS.fall));
    }
  }

  highlights(names: ReadonlyMap<Slot, string>): string[] {
    return buildHighlights(HIGHLIGHTS, tallyFacts(this.board.slots, names, this.tally));
  }
}

/** HUD-Zustand je Platz (≤ 16 Zeichen). */
export function statusFor(sumo: Sumo | undefined): string | undefined {
  if (!sumo?.out) return undefined;
  return sumo.respawnAt === null ? 'in der Limo' : 'Plumps!';
}

/** Banner (≤ 32 Zeichen): Schlussphase vor Schmelz-Warnung. */
export function bannerFor(t: number, finale: boolean): string | undefined {
  if (finale) return 'Wer jetzt fällt, bleibt drin!';
  return meltWarning(t) ? 'Der Würfel schmilzt!' : undefined;
}
