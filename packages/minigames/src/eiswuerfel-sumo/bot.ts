/**
 * Bot für Eiswürfel-Sumo (Muster `pudding-gerangel/bot.ts`): sieht Figuren, ihr Rutschen, den
 * Würfel und den nassen Rand. Rettet sich zur Mitte, wenn er samt Schwung der Kante zu nah
 * kommt, stellt sich zwischen Gegner und Mitte und rempelt nach außen. Wer aufpasst (`aware`),
 * achtet auf den nassen Rand und rempelt nur mit Eis im Rücken (Rückstoß).
 * Eindringlinge: Dauerrempler, Mittelsteher.
 */
import {
  aim,
  pawnBotDriver,
  pawnSkillForStrength,
  type PawnBotSkill,
  type PawnDecision,
} from '@chaos-party/minigame-kit';
import type {
  MinigameBotDriver,
  MinigameBotOptions,
  MinigameRng,
  Slot,
} from '@chaos-party/minigame-sdk';

export interface SumoBotPawn {
  readonly slot: Slot;
  readonly x: number;
  readonly z: number;
  readonly vx: number;
  readonly vz: number;
  readonly out: boolean;
  readonly canDash: boolean;
}

/** Halbe Kante jetzt und nach dem angekündigten Schmelzen (nasser Rand). */
export interface SumoBotView {
  readonly pawns: readonly SumoBotPawn[];
  readonly half: number;
  readonly nextHalf: number;
}

export type SumoStrategy = 'normal' | 'dauer' | 'mitte';

export function sumoDecision(
  me: SumoBotPawn,
  view: SumoBotView,
  skill: PawnBotSkill,
  rng: MinigameRng,
  strategy: SumoStrategy = 'normal',
): PawnDecision {
  const half = skill.aware ? view.nextHalf : view.half;
  const look = skill.aware ? 0.5 : 0.15;
  const px = me.x + me.vx * look;
  const pz = me.z + me.vz * look;
  const center = Math.hypot(px, pz);
  if (strategy === 'mitte') {
    return center < 0.2 ? { x: 0, y: 0, dash: false } : aim(-px, -pz, skill.noise, rng, center);
  }
  if (half - Math.max(Math.abs(px), Math.abs(pz)) < 0.9) return aim(-px, -pz, skill.noise, rng);
  const dist = (p: SumoBotPawn) => Math.hypot(p.x - me.x, p.z - me.z);
  const others = view.pawns.filter((other) => other.slot !== me.slot && !other.out);
  const target = others.sort((a, b) => dist(a) - dist(b))[0];
  if (!target) return aim(-px, -pz, skill.noise, rng, Math.min(1, center));
  const dx = target.x - me.x;
  const dz = target.z - me.z;
  const best = dist(target);
  if (me.canDash && (strategy === 'dauer' || best < 2.2)) {
    // Rückstoß: Hinter mir muss Eis sein, sonst rutsche ich selbst hinein.
    const back = 1 / Math.max(best, 1e-3);
    const behind = Math.max(Math.abs(me.x - dx * back), Math.abs(me.z - dz * back));
    const safe = !skill.aware || behind < half;
    if (strategy === 'dauer' || (safe && rng.next() < skill.dashChance)) {
      return { ...aim(dx, dz, skill.noise, rng), dash: true };
    }
  }
  // Zwischen Gegner und Mitte stellen: dann geht jeder Stoß nach außen.
  const r = Math.hypot(target.x, target.z);
  const inward = r > 0.1 ? 0.7 / r : 0;
  return aim(target.x * (1 - inward) - me.x, target.z * (1 - inward) - me.z, skill.noise, rng);
}

/** Laufzeit-Bot für einen KI-Platz (`Minigame.createBot`). */
export function createSumoBot(
  options: MinigameBotOptions,
  observe: () => SumoBotView | null,
): MinigameBotDriver {
  const skill = pawnSkillForStrength(options.strength);
  return pawnBotDriver(options.slot, skill, () => {
    const view = observe();
    const me = view?.pawns.find((pawn) => pawn.slot === options.slot);
    return view && me && !me.out ? sumoDecision(me, view, skill, options.rng) : null;
  });
}
