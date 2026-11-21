/**
 * KI-Bot für Pudding-Gerangel (CHAOS-180), aus EXP-006 übernommen: zur Mitte, wenn der Rand
 * nah ist, der Teller zu mir kippt oder der Löffel kommt; im Leuchtfleck Gegner wegrempeln und
 * stehen bleiben; sonst die nächste Figur jagen und rempeln.
 *
 * Er liest nur, was am Bildschirm sichtbar ist (Figuren, Neigung, Löffel, Fleck, Führung) und
 * gibt Stick und A über die Laufzeit. Genutzt von der echten Partie (`PuddingGerangel.createBot`),
 * der Fairness-Prüfung (CHAOS-84) und EXP-006 (`prototypes/physics/wackel.ts`).
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
import { TUNING } from './logic.ts';

/** Eine Figur, wie man sie am Bildschirm sieht. */
export interface PuddingBotPawn {
  readonly slot: Slot;
  readonly x: number;
  readonly z: number;
  /** Gerade nicht im Spiel (runtergefallen, wartet auf Rückkehr). */
  readonly out: boolean;
  /** Rempler wieder bereit (sichtbar an der Figur). */
  readonly canDash: boolean;
}

/** Was der Bot sieht. */
export interface PuddingBotView {
  readonly pawns: readonly PuddingBotPawn[];
  readonly tilt: { readonly pitch: number; readonly roll: number };
  /** Winkel des Löffels als `atan2(−z, x)`; `null` = kein Löffel. */
  readonly whiskAngle: number | null;
  readonly zone: { readonly x: number; readonly z: number; readonly r: number } | null;
  readonly leader: Slot | null;
}

/** Ein Entscheid des Bots (gleiche Rechnung und Zufallsfolge wie in EXP-006). */
export function puddingDecision(
  me: PuddingBotPawn,
  view: PuddingBotView,
  skill: PawnBotSkill,
  rng: MinigameRng,
): PawnDecision {
  const r = Math.hypot(me.x, me.z);
  // Kippt der Teller zu mir? Gefälle-Richtung = (roll, −pitch) in (x, z) ist „bergauf“.
  const downhill = { x: -view.tilt.roll, z: view.tilt.pitch };
  const slope = Math.hypot(downhill.x, downhill.z);
  const towardEdge = r > 0.1 ? (me.x * downhill.x + me.z * downhill.z) / r : 0;
  let danger = r > TUNING.radius - 1.8 || (slope > 0.12 && towardEdge > 0.08 && r > 3);
  if (skill.aware && view.whiskAngle !== null && r > TUNING.spoonInner - 0.3) {
    const myAngle = Math.atan2(-me.z, me.x); // Gierwinkel-Sinn wie der Löffel
    const ahead = (((myAngle - view.whiskAngle) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    if (ahead < 0.8) danger = true;
  }
  if (danger) return aim(-me.x, -me.z, skill.noise, rng);
  if (view.zone) {
    const zone = view.zone;
    const inZone = Math.hypot(zone.x - me.x, zone.z - me.z) < zone.r * 0.8;
    // Im Fleck: Gegner im Fleck wegrempeln, sonst still stehen bleiben.
    let rival: PuddingBotPawn | null = null;
    for (const other of view.pawns) {
      if (other.slot === me.slot || other.out) continue;
      const d = Math.hypot(other.x - me.x, other.z - me.z);
      if (d > 2 || Math.hypot(other.x - zone.x, other.z - zone.z) > zone.r + 0.5) continue;
      // Menschen jagen gern die Führung: die zuerst.
      if (!rival || other.slot === view.leader) rival = other;
    }
    if (rival && me.canDash && rng.next() < skill.dashChance) {
      return { ...aim(rival.x - me.x, rival.z - me.z, skill.noise, rng), dash: true };
    }
    if (inZone) return aim(zone.x - me.x, zone.z - me.z, skill.noise, rng, 0.3);
    return aim(zone.x - me.x, zone.z - me.z, skill.noise, rng);
  }
  let target: PuddingBotPawn | null = null;
  let best = Infinity;
  for (const other of view.pawns) {
    if (other.slot === me.slot || other.out) continue;
    const d = Math.hypot(other.x - me.x, other.z - me.z);
    if (d < best) {
      best = d;
      target = other;
    }
  }
  if (!target) return aim(-me.x, -me.z, skill.noise, rng, 0.3);
  const decision = aim(target.x - me.x, target.z - me.z, skill.noise, rng);
  const dash = best < 2.2 && me.canDash && rng.next() < skill.dashChance;
  return { ...decision, dash };
}

/** Laufzeit-Bot für einen KI-Platz (`Minigame.createBot`). */
export function createPuddingBot(
  options: MinigameBotOptions,
  observe: () => PuddingBotView | null,
): MinigameBotDriver {
  const skill = pawnSkillForStrength(options.strength);
  return pawnBotDriver(options.slot, skill, () => {
    const view = observe();
    const me = view?.pawns.find((pawn) => pawn.slot === options.slot);
    if (!view || !me || me.out) return null;
    return puddingDecision(me, view, skill, options.rng);
  });
}
