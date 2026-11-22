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
import { KRUEMEL_KEHRAUS_INFO } from '../kruemel-kehraus/info.ts';
import { TOASTER_BOT_ADAPTER } from '../toaster-timing/bot.ts';
import { TOASTER_TIMING_INFO } from '../toaster-timing/info.ts';
import { NUSS_BOT_ADAPTER } from '../nussregen-netz/bot.ts';
import { NUSSREGEN_NETZ_INFO } from '../nussregen-netz/info.ts';
import { MATSCH_BOT_ADAPTER } from '../matschmaler/bot.ts';
import { MATSCHMALER_INFO } from '../matschmaler/info.ts';
import { RODEO_BOT_ADAPTER, RODEO_INTRUDERS } from '../rasensprenger-rodeo/bot.ts';
import { RASENSPRENGER_RODEO_INFO } from '../rasensprenger-rodeo/info.ts';
import { KAESE_BOT_ADAPTER, KAESE_INTRUDERS } from '../schnapp-den-kaese/bot.ts';
import { SCHNAPP_DEN_KAESE_INFO } from '../schnapp-den-kaese/info.ts';
import { sumoDecision, type SumoStrategy } from '../eiswuerfel-sumo/bot.ts';
import { EiswuerfelSumo } from '../eiswuerfel-sumo/index.ts';
import { EISWUERFEL_SUMO_INFO } from '../eiswuerfel-sumo/info.ts';
import { HoneyBot, HONEY_BOT_ADAPTER } from '../bienenstock-honig/bot.ts';
import { BIENENSTOCK_HONIG_INFO } from '../bienenstock-honig/info.ts';
import { DoorBot, DOOR_BOT_ADAPTER } from '../drei-tueren/bot.ts';
import { DREI_TUEREN_INFO } from '../drei-tueren/info.ts';
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
import { PuddingGerangel } from '../pudding-gerangel/index.ts';
import { puddingView } from '../prototypes/physics/puddingGerangelView.ts';
import { SKILLS, type BotSkill } from '../prototypes/physics/shared.ts';
import { wackelBot } from '../prototypes/physics/wackel.ts';
import {
  LeadCounter,
  type FairnessHarness,
  type FairnessMatch,
  type FairnessSeat,
  type FairnessSkill,
} from './fairness.ts';
import { havokHarness } from './havokHarness.ts';
import { dauerDruecker, kitHarness } from './kitHarness.ts';

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

// --- Havok-Spiele über `havokHarness` (CHAOS-241): echtes Modul, Bots über die sichtbare Lage --

const PUDDING_HARNESS = havokHarness({
  info: PUDDING_GERANGEL_INFO,
  create: () => new PuddingGerangel(),
  view: puddingView,
  pawns: (view) => view.pawns,
  // Dauerdrücken: rempelt, sobald es geht, in die gewählte Richtung.
  decide: (me, view, skill, rng, strategy) => {
    const decision = wackelBot(me, view, skill, rng);
    return { ...decision, dash: decision.dash || (strategy === DAUER.id && me.canDash) };
  },
  intruders: [{ ...DAUER, label: 'Dauerrempler' }],
  ciSeeds: 12,
});

const EISWUERFEL_HARNESS = havokHarness({
  info: EISWUERFEL_SUMO_INFO,
  create: () => new EiswuerfelSumo(),
  view: (game) => game.view(),
  pawns: (view) => view.pawns,
  decide: (me, view, skill, rng, strategy) =>
    sumoDecision(me, view, skill, rng, strategy as SumoStrategy),
  intruders: [
    { id: 'dauer', label: 'Dauerrempler' },
    { id: 'mitte', label: 'Mittelsteher (rempelt nie)' },
  ] satisfies { id: SumoStrategy; label: string }[],
});

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
  [PUDDING_GERANGEL_INFO.id]: PUDDING_HARNESS,
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
  // Pilotwelle (CHAOS-91): Baukasten-Spiele über `kitHarness`.
  [TOASTER_TIMING_INFO.id]: kitHarness({
    info: TOASTER_TIMING_INFO,
    adapter: TOASTER_BOT_ADAPTER,
    intruders: [dauerDruecker(['a'], 'Dauerdrücken (Toast sofort raus)')],
  }),
  [NUSSREGEN_NETZ_INFO.id]: kitHarness({
    info: NUSSREGEN_NETZ_INFO,
    adapter: NUSS_BOT_ADAPTER,
    intruders: [dauerDruecker(['a'], 'Dauerdrücken (immer weit schwingen)')],
  }),
  [MATSCHMALER_INFO.id]: kitHarness({
    info: MATSCHMALER_INFO,
    adapter: MATSCH_BOT_ADAPTER,
    intruders: [dauerDruecker(['a'], 'Dauerdrücken (Bauchplatscher, sobald bereit)')],
  }),
  [RASENSPRENGER_RODEO_INFO.id]: kitHarness({
    info: RASENSPRENGER_RODEO_INFO,
    adapter: RODEO_BOT_ADAPTER,
    intruders: [dauerDruecker(['a'], 'Dauerdrücken (A ist ohne Wirkung)'), ...RODEO_INTRUDERS],
  }),
  [SCHNAPP_DEN_KAESE_INFO.id]: kitHarness({
    info: SCHNAPP_DEN_KAESE_INFO,
    adapter: KAESE_BOT_ADAPTER,
    intruders: [dauerDruecker(['a'], 'Dauerdrücken (greift sofort)'), ...KAESE_INTRUDERS],
  }),
  [EISWUERFEL_SUMO_INFO.id]: EISWUERFEL_HARNESS,
  [BIENENSTOCK_HONIG_INFO.id]: kitHarness({
    info: BIENENSTOCK_HONIG_INFO,
    adapter: HONEY_BOT_ADAPTER,
    intruders: [
      dauerDruecker(['a'], 'Dauerdrücken (nur zapfen)'),
      {
        id: 'gierhals',
        label: 'Gierhals (sichert spät)',
        bot: (slot, rng, normal) => new HoneyBot(slot, normal.profile, rng, 'gierig'),
      },
      {
        id: 'angsthase',
        label: 'Angsthase (sichert jeden Zapfer)',
        bot: (slot, rng, normal) => new HoneyBot(slot, normal.profile, rng, 'aengstlich'),
      },
    ],
  }),
  [DREI_TUEREN_INFO.id]: kitHarness({
    info: DREI_TUEREN_INFO,
    adapter: DOOR_BOT_ADAPTER,
    intruders: [
      dauerDruecker(['a'], 'Dauerdrücken (A sofort)'),
      {
        id: 'zufall',
        label: 'Zufall (würfelt die Tür)',
        bot: (slot, rng, normal) => DoorBot.habitual(slot, normal.profile, rng, 'bunt'),
      },
      {
        id: 'gierhals',
        label: 'Gierhals (immer höchste Tür)',
        bot: (slot, rng, normal) => DoorBot.habitual(slot, normal.profile, rng, 'gierig'),
      },
      {
        id: 'stur',
        label: 'Stur (immer dieselbe Tür)',
        bot: (slot, rng, normal) => DoorBot.habitual(slot, normal.profile, rng, 'treu'),
      },
    ],
  }),
};
