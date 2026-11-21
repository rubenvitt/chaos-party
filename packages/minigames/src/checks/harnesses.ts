/**
 * Fairness-Harnesses der Minispiele in der Rotation (CHAOS-84): verbinden die Bots aus den
 * Experimenten (EXP-005/006/007/016/023) mit der gemeinsamen Vorlage in `fairness.ts`.
 *
 * Jedes Spiel der Rotation braucht hier einen Eintrag, sonst schlägt `checks.test.ts` fehl
 * (Definition of Done, README §5.3). Neue Spiele auf dem Baukasten (CHAOS-83) sollen ihre Bots
 * über dessen Bot-Profile anbinden; diese Adapter bleiben für die Bestandsspiele.
 *
 * Können-Stufen je Spiel: Arcade-Spiele nutzen die Profile aus EXP-005 (Profi/Normal/Neuling),
 * Wackelturm die Geschicklichkeit aus EXP-007 (0,9/0,6/0,2) mit dem Kippgefühl aus EXP-039
 * (CHAOS-215), Havok-Spiele die `SKILLS` aus EXP-006 plus eine Profi-Stufe (schneller planen,
 * genauer zielen).
 */
import { PAWN_BOT_SKILLS } from '@chaos-party/minigame-kit';
import { createMinigameRng, type Slot } from '@chaos-party/minigame-sdk';
import { runMinigameHeadless } from '@chaos-party/minigame-sdk/testing';
import { KRUEMEL_KEHRAUS_INFO } from '../kruemel-kehraus/info.ts';
import { KUCKUCKS_KLATSCHE_INFO } from '../kuckucks-klatsche/info.ts';
import { PUDDING_GERANGEL_INFO } from '../pudding-gerangel/info.ts';
import { SOCKENREGEN_INFO } from '../sockenregen/info.ts';
import { SockenregenLogic } from '../sockenregen/logic.ts';
import { WACKELTURM_INFO } from '../wackelturm/info.ts';
import { BOT_PROFILES, type BotProfile, type PlayerCount } from '../prototypes/arcade/common.ts';
import {
  simulateKuckucksKlatsche,
  type KuckuckStrategy,
} from '../prototypes/arcade/kuckucksKlatscheBot.ts';
import { SockenregenBot } from '../prototypes/arcade/sockenregenBot.ts';
import type { Strategy as WackelturmStrategy } from '../prototypes/hybrid/common.ts';
import {
  KIPPGEFUEHL_BOT_MODEL,
  playWackelturm,
  type WackelturmBotModel,
} from '../prototypes/hybrid/wackelturm-sim.ts';
import { KRUEMEL_VARIANTS, simulateKruemel } from '../prototypes/physics/experimentKruemel.ts';
import type { KruemelStrategy } from '../kruemel-kehraus/bot.ts';
import { createPuddingGerangelPrototype } from '../prototypes/physics/puddingGerangelView.ts';
import { SKILLS, type BotDecision, type BotSkill } from '../prototypes/physics/shared.ts';
import { wackelBot } from '../prototypes/physics/wackel.ts';
import {
  LeadCounter,
  type FairnessHarness,
  type FairnessMatch,
  type FairnessSeat,
  type FairnessSkill,
} from './fairness.ts';

const ARCADE_PROFILES: Record<FairnessSkill, BotProfile> = {
  profi: BOT_PROFILES.profi,
  normal: BOT_PROFILES.normal,
  neuling: BOT_PROFILES.neuling,
};

/** Havok-Spiele: Profi plant alle 6 Schritte neu, zielt genauer und rempelt gezielter. */
const PHYSICS_SKILLS: Record<FairnessSkill, BotSkill> = {
  profi: PAWN_BOT_SKILLS.profi,
  normal: SKILLS.normal,
  neuling: SKILLS.weak,
};

const DAUER = { id: 'dauer', label: 'Dauerdrücken' } as const;

function slotsFor(count: number): Slot[] {
  return ([1, 2, 3, 4] as const).slice(0, count);
}

// --- Sockenregen (EXP-005, echte Logik) -------------------------------------------------

/**
 * Wie `simulateSockenregenLogic`, aber mit Dauerdrücker: lenkt wie ein normaler Bot und
 * hechtet, sobald der Hechtsprung wieder bereit ist.
 */
function playSockenregen(seats: readonly FairnessSeat[], seed: number): FairnessMatch {
  const slots = slotsFor(seats.length);
  const durationMs = SOCKENREGEN_INFO.durationMs;
  const game = new SockenregenLogic(slots, createMinigameRng(seed), durationMs);
  const bots = slots.map(
    (slot, index) =>
      new SockenregenBot(
        slot,
        ARCADE_PROFILES[seats[index]?.skill ?? 'normal'],
        createMinigameRng(seed * 31 + slot),
      ),
  );
  const lead = new LeadCounter();
  while (!game.finished) {
    bots.forEach((bot, index) => {
      const action = bot.decide(game);
      if (action) {
        game.setStick(bot.slot, action.x, action.y);
        if (action.dash) game.dash(bot.slot);
      }
      if (seats[index]?.strategy === DAUER.id) game.dash(bot.slot);
    });
    game.step(1 / 60);
    lead.update(game.runners.map((runner) => runner.score));
  }
  return { scores: game.runners.map((runner) => runner.score), leadChanges: lead.changes };
}

// --- Kuckucks-Klatsche (EXP-016, echte Logik) --------------------------------------------

function playKuckuck(seats: readonly FairnessSeat[], seed: number): FairnessMatch {
  const record = simulateKuckucksKlatsche(seats.length as PlayerCount, seed, {
    profiles: seats.map((seat) => ARCADE_PROFILES[seat.skill]),
    strategies: seats.map((seat) => (seat.strategy ?? 'normal') as KuckuckStrategy),
  });
  return { scores: record.scores, leadChanges: record.leadChanges };
}

// --- Wackelturm (EXP-007, echte Logik; Bot-Modell CHAOS-215/EXP-039) -------------------

const WACKELTURM_SKILL: Record<FairnessSkill, number> = { profi: 0.9, normal: 0.6, neuling: 0.2 };

/**
 * Wackelturm-Harness mit wählbarem Bot-Modell (Kippgefühl), damit EXP-039 Modelle vergleichen
 * kann. Normale Spielweise: „zufällig“ (mal flach, mal hoch stapeln, gelegentlich rempeln).
 */
export function createWackelturmHarness(
  model: WackelturmBotModel = KIPPGEFUEHL_BOT_MODEL,
): FairnessHarness {
  return {
    id: WACKELTURM_INFO.id,
    scoring: WACKELTURM_INFO.scoring,
    intruders: [
      { id: 'raufbold', label: 'Raufbold (rempelt immer)' },
      { id: 'gierig', label: 'gierig (7–10 Törtchen)' },
      { id: 'vorsichtig', label: 'vorsichtig (2–4 Törtchen)' },
    ] satisfies { id: WackelturmStrategy; label: string }[],
    ciSeeds: 60,
    play: (seats, seed) => {
      const record = playWackelturm(
        seats.map((seat) => ({
          strategy: (seat.strategy ?? 'zufaellig') as WackelturmStrategy,
          skill: WACKELTURM_SKILL[seat.skill],
        })),
        seed,
        undefined,
        undefined,
        model,
      );
      return { scores: record.scores, leadChanges: record.leadChanges };
    },
  };
}

// --- Pudding-Gerangel (EXP-006, echte Umsetzung mit Havok) ---------------------------------

async function playPudding(seats: readonly FairnessSeat[], seed: number): Promise<FairnessMatch> {
  const proto = createPuddingGerangelPrototype();
  const rng = createMinigameRng(seed * 7919 + 13);
  const plans = new Map<Slot, BotDecision>();
  const lead = new LeadCounter();
  let step = 0;
  const run = await runMinigameHeadless(proto.module, {
    players: seats.length,
    seed,
    script: (_elapsed, send, runner) => {
      const view = proto.peek();
      if (view) {
        lead.update(runner.hud().scores.map((entry) => entry.score));
        for (const me of view.pawns) {
          if (me.out) continue;
          const seat = seats[me.slot - 1];
          const skill = PHYSICS_SKILLS[seat?.skill ?? 'normal'];
          if ((step + me.slot * 3) % skill.replanSteps === 0 || !plans.has(me.slot)) {
            const decision = wackelBot(me, view, skill, rng);
            // Dauerdrücken: rempelt, sobald es geht, in die gewählte Richtung.
            const dash = decision.dash || (seat?.strategy === DAUER.id && me.canDash);
            plans.set(me.slot, decision);
            send(me.slot, { type: 'move', x: decision.x, y: decision.y });
            if (dash) {
              send(me.slot, { type: 'press', button: 'a' });
              send(me.slot, { type: 'release', button: 'a' });
            }
          }
        }
      }
      step++;
    },
  });
  const placements = run.outcome?.result.placements;
  if (!placements) throw new Error('Pudding-Gerangel lieferte kein Ergebnis');
  const bySlot = new Map(placements.map((p) => [p.slot, p.score]));
  return {
    scores: slotsFor(seats.length).map((slot) => bySlot.get(slot) ?? 0),
    leadChanges: lead.changes,
  };
}

// --- Krümel-Kehraus (EXP-023, echte Umsetzung mit Havok) -----------------------------------

const KRUEMEL_R3 = (() => {
  const variant = KRUEMEL_VARIANTS.find((entry) => entry.id === 'R3');
  if (!variant) throw new Error('Krümel-Kehraus: gewählte Fassung R3 fehlt');
  return variant;
})();

async function playKruemel(seats: readonly FairnessSeat[], seed: number): Promise<FairnessMatch> {
  const record = await simulateKruemel(
    KRUEMEL_R3,
    seed,
    seats.map((seat) => ({
      skill: PHYSICS_SKILLS[seat.skill],
      strategy: (seat.strategy ?? 'normal') as KruemelStrategy,
    })),
  );
  return { scores: record.seats.map((seat) => seat.score), leadChanges: record.leadChanges };
}

export const FAIRNESS_HARNESSES: Readonly<Record<string, FairnessHarness>> = {
  [SOCKENREGEN_INFO.id]: {
    id: SOCKENREGEN_INFO.id,
    scoring: SOCKENREGEN_INFO.scoring,
    intruders: [{ ...DAUER, label: 'Dauerdrücken (Hechtsprung)' }],
    ciSeeds: 60,
    play: playSockenregen,
  },
  [KUCKUCKS_KLATSCHE_INFO.id]: {
    id: KUCKUCKS_KLATSCHE_INFO.id,
    scoring: KUCKUCKS_KLATSCHE_INFO.scoring,
    intruders: [
      { ...DAUER, label: 'Dauerklatscher' },
      { id: 'raffzahn', label: 'Raffzahn (klaut alles)' },
      { id: 'brav', label: 'brav (klaut nie)' },
    ] satisfies { id: KuckuckStrategy; label: string }[],
    ciSeeds: 60,
    play: playKuckuck,
  },
  // Keine Ausnahme mehr: Die alte Neuling-/Profi-Abweichung war ein Bot-Artefakt (CHAOS-215, EXP-039).
  [WACKELTURM_INFO.id]: createWackelturmHarness(),
  [PUDDING_GERANGEL_INFO.id]: {
    id: PUDDING_GERANGEL_INFO.id,
    scoring: PUDDING_GERANGEL_INFO.scoring,
    intruders: [{ ...DAUER, label: 'Dauerrempler' }],
    ciSeeds: 12,
    play: playPudding,
  },
  [KRUEMEL_KEHRAUS_INFO.id]: {
    id: KRUEMEL_KEHRAUS_INFO.id,
    scoring: KRUEMEL_KEHRAUS_INFO.scoring,
    intruders: [
      { id: 'dauerrempler', label: 'Dauerrempler' },
      { id: 'torsteher', label: 'Torsteher' },
      { id: 'raufbold', label: 'Raufbold (jagt die Führung)' },
    ] satisfies { id: KruemelStrategy; label: string }[],
    ciSeeds: 8,
    play: playKruemel,
  },
};
