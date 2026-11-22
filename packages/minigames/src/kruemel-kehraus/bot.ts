/**
 * KI-Bot für „Krümel-Kehraus“ (CHAOS-180), aus EXP-023 (CHAOS-79) übernommen. Er sieht nur,
 * was ein Mensch am Fernseher sieht (Positionen, Krümel, Löcher, Punkte). Genutzt von der
 * echten Partie (`KruemelKehraus.createBot`, Strategie *normal*), der Fairness-Prüfung
 * (CHAOS-84) und EXP-023 (`prototypes/physics/experimentKruemel.ts`). Strategien für den Eindringling-Test (EXP-016):
 * *normal* (Krümel mit bestem Weg-und-Loch-Abstand schieben), *Torsteher* (stellt sich vor
 * das Loch der führenden Person), *Dauerrempler* (wie normal, rempelt aber, sobald es geht),
 * *Raufbold* (jagt die führende Person statt Krümel).
 */
import {
  aim,
  pawnBotDriver,
  pawnSkillForStrength,
  type PawnBotSkill as BotSkill,
  type PawnDecision as BotDecision,
} from '@chaos-party/minigame-kit';
import type {
  MinigameBotDriver,
  MinigameBotOptions,
  MinigameRng,
  Slot,
} from '@chaos-party/minigame-sdk';
import type { KruemelSnapshot } from './index.ts';
import {
  allCorners,
  beyondCut,
  cornersFor,
  PAWN,
  TUNING,
  type Corner,
  type Vec2,
} from './logic.ts';

export type KruemelStrategy = 'normal' | 'torsteher' | 'dauerrempler' | 'raufbold';

export const KRUEMEL_STRATEGY_LABELS: Record<KruemelStrategy, string> = {
  normal: 'normal',
  torsteher: 'Torsteher (blockt das Loch der Führung)',
  dauerrempler: 'Dauerrempler',
  raufbold: 'Raufbold (jagt die Führung)',
};

/** Beobachtung, die Bots brauchen; die echte Spiellogik und der alte Prototyp liefern sie. */
export interface BotView {
  readonly pawns: KruemelSnapshot['pawns'];
  readonly crumbs: KruemelSnapshot['crumbs'];
  readonly goals: readonly {
    readonly slot: Slot;
    readonly corner: Pick<Corner, 'mouth' | 'normal'>;
  }[];
  readonly scores: readonly { readonly slot: Slot; readonly score: number }[];
  /** Innenfläche, auf der Bots stehen können (Rechteck oder Kreis). */
  readonly clamp: (x: number, z: number) => { x: number; z: number };
  /** Schieberichtung eines Krümels an Wänden entlang umlenken (sonst: unverändert). */
  readonly slide: (crumb: { x: number; z: number; radius: number }, dir: Vec2) => Vec2;
}

/** Rechteck des Blechs, abzüglich Figurenradius. */
export function clampToTray(x: number, z: number): { x: number; z: number } {
  const mx = TUNING.halfX - PAWN.radius - 0.1;
  const mz = TUNING.halfZ - PAWN.radius - 0.1;
  return { x: Math.max(-mx, Math.min(mx, x)), z: Math.max(-mz, Math.min(mz, z)) };
}

/**
 * Liegt ein Krümel an einem Rand, drückt man ihn nicht in die Wand, sondern an ihr entlang
 * (Menschen machen das intuitiv). Gilt für Seitenränder und alle Schrägen außer offenen
 * Löchern (`open` = Ecken mit Mauseloch).
 */
export function slideOnTray(players: number) {
  const closed = allCorners(players)
    .filter((entry) => !entry.open)
    .map((entry) => entry.corner);
  const mouths = cornersFor(players).map((hole) => hole.mouth);
  return (crumb: { x: number; z: number; radius: number }, dir: Vec2): Vec2 => {
    // Nahe einem Loch nicht umlenken: dort soll der Krümel ja durch die Wand hindurch.
    if (mouths.some((m) => Math.hypot(m.x - crumb.x, m.z - crumb.z) < 1.8)) return dir;
    let { x, z } = dir;
    const near = crumb.radius + 0.25;
    if (Math.abs(crumb.x) > TUNING.halfX - near && Math.sign(x) === Math.sign(crumb.x)) x = 0;
    if (Math.abs(crumb.z) > TUNING.halfZ - near && Math.sign(z) === Math.sign(crumb.z)) z = 0;
    for (const corner of closed) {
      const into = x * corner.normal.x + z * corner.normal.z;
      if (beyondCut(corner, crumb) > -near && into > 0) {
        x -= corner.normal.x * into;
        z -= corner.normal.z * into;
      }
    }
    const length = Math.hypot(x, z);
    if (length < 0.2) {
      const back = Math.hypot(crumb.x, crumb.z) || 1;
      return { x: -crumb.x / back, z: -crumb.z / back };
    }
    return { x: x / length, z: z / length };
  };
}

function rivalLeader(view: BotView, me: Slot): Slot | null {
  let best: { slot: Slot; score: number } | null = null;
  for (const entry of view.scores) {
    if (entry.slot === me) continue;
    if (!best || entry.score > best.score) best = entry;
  }
  return best?.slot ?? null;
}

function nearestRival(view: BotView, me: KruemelSnapshot['pawns'][number]) {
  let best: KruemelSnapshot['pawns'][number] | null = null;
  let bestDistance = Infinity;
  for (const other of view.pawns) {
    if (other.slot === me.slot) continue;
    const distance = Math.hypot(other.x - me.x, other.z - me.z);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = other;
    }
  }
  return best;
}

/** Ein Entscheid (Stick-Richtung und ob gerempelt wird). */
export function kruemelDecision(
  me: KruemelSnapshot['pawns'][number],
  view: BotView,
  skill: BotSkill,
  strategy: KruemelStrategy,
  rng: MinigameRng,
): BotDecision {
  if (strategy === 'torsteher') {
    const target = rivalLeader(view, me.slot);
    const goal = view.goals.find((entry) => entry.slot === target);
    if (goal) {
      const spot = view.clamp(
        goal.corner.mouth.x - goal.corner.normal.x * 0.7,
        goal.corner.mouth.z - goal.corner.normal.z * 0.7,
      );
      const dx = spot.x - me.x;
      const dz = spot.z - me.z;
      if (Math.hypot(dx, dz) < 0.25) return { x: 0, y: 0, dash: false };
      return aim(dx, dz, skill.noise * 0.5, rng, Math.min(1, Math.hypot(dx, dz)));
    }
  }
  if (strategy === 'raufbold') {
    const target = rivalLeader(view, me.slot);
    const victim = view.pawns.find((pawn) => pawn.slot === target) ?? nearestRival(view, me);
    if (victim) {
      const dx = victim.x - me.x;
      const dz = victim.z - me.z;
      const decision = aim(dx, dz, skill.noise, rng);
      return { ...decision, dash: me.canDash && Math.hypot(dx, dz) < 1.6 };
    }
  }
  const decision = pushCrumb(me, view, skill, rng);
  if (strategy === 'dauerrempler') return { ...decision, dash: me.canDash };
  return decision;
}

/** Krümel mit bestem Verhältnis aus Weg und Lochabstand wählen, dahinter stellen, schieben. */
function pushCrumb(
  me: KruemelSnapshot['pawns'][number],
  view: BotView,
  skill: BotSkill,
  rng: MinigameRng,
): BotDecision {
  const goal = view.goals.find((entry) => entry.slot === me.slot);
  if (!goal) return { x: 0, y: 0, dash: false };
  const target = {
    x: goal.corner.mouth.x + goal.corner.normal.x * 0.4,
    z: goal.corner.mouth.z + goal.corner.normal.z * 0.4,
  };
  let best: KruemelSnapshot['crumbs'][number] | null = null;
  let bestCost = Infinity;
  for (const crumb of view.crumbs) {
    if (!crumb.active || crumb.y < -0.3 || crumb.y > 1.2) continue;
    const cost =
      Math.hypot(crumb.x - me.x, crumb.z - me.z) +
      0.7 * Math.hypot(target.x - crumb.x, target.z - crumb.z) -
      (crumb.value - 1) * 2.5;
    if (cost < bestCost) {
      bestCost = cost;
      best = crumb;
    }
  }
  if (!best) return aim(-me.x, -me.z, skill.noise, rng, 0.5);
  // Drückt jemand von der anderen Seite dagegen (Gerangel um denselben Krümel): rempeln,
  // wie es Menschen tun, statt ewig zu schieben.
  const rival = view.pawns.find(
    (other) =>
      other.slot !== me.slot &&
      Math.hypot(other.x - best.x, other.z - best.z) < best.radius + PAWN.radius + 0.5 &&
      Math.hypot(other.x - me.x, other.z - me.z) < 2,
  );
  if (rival && me.canDash && Math.hypot(best.x - me.x, best.z - me.z) < 1.6) {
    const decision = aim(rival.x - me.x, rival.z - me.z, skill.noise * 0.5, rng);
    if (rng.next() < skill.dashChance) return { ...decision, dash: true };
  }
  const gx = target.x - best.x;
  const gz = target.z - best.z;
  const gl = Math.hypot(gx, gz) || 1;
  const dir = view.slide(best, { x: gx / gl, z: gz / gl });
  const contact = best.radius + PAWN.radius + 0.1;
  const behind = view.clamp(best.x - dir.x * contact, best.z - dir.z * contact);
  const toCrumb = { x: best.x - me.x, z: best.z - me.z };
  const dist = Math.hypot(toCrumb.x, toCrumb.z) || 1;
  const alignment = (toCrumb.x * dir.x + toCrumb.z * dir.z) / dist;
  if (alignment > 0.85 && dist < contact + 0.9) {
    const decision = aim(
      dir.x + toCrumb.x / dist,
      dir.z + toCrumb.z / dist,
      skill.noise * 0.5,
      rng,
    );
    return { ...decision, dash: me.canDash && gl < 5 && rng.next() < skill.dashChance * 0.5 };
  }
  // Steht man zwischen Krümel und Loch: seitlich herum.
  if ((me.x - best.x) * dir.x + (me.z - best.z) * dir.z > 0 && dist < 2) {
    const side = { x: -dir.z, z: dir.x };
    const sign = (me.x - best.x) * side.x + (me.z - best.z) * side.z >= 0 ? 1 : -1;
    const around = view.clamp(best.x + side.x * sign * 1.3, best.z + side.z * sign * 1.3);
    return aim(around.x - me.x, around.z - me.z, skill.noise, rng);
  }
  return aim(behind.x - me.x, behind.z - me.z, skill.noise, rng);
}

/** Laufzeit-Bot für einen KI-Platz (`Minigame.createBot`): Strategie *normal*. */
export function createKruemelBot(
  options: MinigameBotOptions,
  observe: () => KruemelSnapshot | null,
): MinigameBotDriver {
  const skill = pawnSkillForStrength(options.strength, options.style);
  let slide: BotView['slide'] | null = null;
  return pawnBotDriver(options.slot, skill, () => {
    const snap = observe();
    const me = snap?.pawns.find((pawn) => pawn.slot === options.slot);
    if (!snap || !me) return null;
    slide ??= slideOnTray(snap.pawns.length);
    const view: BotView = {
      pawns: snap.pawns,
      crumbs: snap.crumbs,
      goals: snap.goals,
      scores: snap.scores,
      clamp: clampToTray,
      slide,
    };
    return kruemelDecision(me, view, skill, 'normal', options.rng);
  });
}
