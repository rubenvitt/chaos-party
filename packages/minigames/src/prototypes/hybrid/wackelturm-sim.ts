/**
 * Konzept A „Wackelturm“ (EXP-007): Bots auf den echten Regeln aus `wackelturm/logic.ts`.
 * Varianten sind Parameter-Sätze; die gewählte Fassung ist `WACKELTURM_PARAMS`.
 */
import { createMinigameRng } from '@chaos-party/minigame-sdk';
import { WACKELTURM_INFO } from '../../wackelturm/info.ts';
import { WackelturmBot, type WackelturmControls } from '../../wackelturm/bot.ts';
import {
  createWackelturm,
  pressBump,
  pressGrab,
  setStick,
  stepWackelturm,
  WACKELTURM_PARAMS,
  type Runner,
  type WackelturmParams,
  type WackelturmState,
} from '../../wackelturm/logic.ts';
import {
  botRng,
  InputCounter,
  LeadTracker,
  slotsFor,
  STEP,
  type BotProfile,
  type Concept,
  type GameRecord,
} from './common.ts';

export { WackelturmBot } from '../../wackelturm/bot.ts';

/** Steuerung direkt auf die Logik, mit Eingabezähler (wie vor CHAOS-180). */
function directControls(
  state: WackelturmState,
  slot: Runner['slot'],
  counter: InputCounter,
): WackelturmControls {
  return {
    stick: (x, z) => {
      setStick(state, slot, x, z);
      counter.stick(x, z);
    },
    grab: () => {
      pressGrab(state, slot);
      counter.press('a');
    },
    bump: () => {
      pressBump(state, slot);
      counter.press('b');
    },
  };
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

export const WACKELTURM_CONCEPT: Concept<WackelturmParams> = {
  id: 'A',
  title: 'Wackelturm',
  instructions: WACKELTURM_INFO.instructions,
  controls: { joystick: 'Laufen', a: 'Greifen', b: 'Rempeln' },
  durationSeconds: WACKELTURM_INFO.durationMs / 1000,
  play: (bots, seed, params) => playWackelturm(bots, seed, params),
};

export function playWackelturm(
  profiles: readonly BotProfile[],
  seed: number,
  params: WackelturmParams = WACKELTURM_PARAMS,
  seconds = WACKELTURM_INFO.durationMs / 1000,
): GameRecord {
  const slots = slotsFor(profiles.length);
  const state = createWackelturm(slots, seconds, params);
  const gameRng = createMinigameRng(seed);
  const bots = profiles.map(
    (profile, seat) => new WackelturmBot(profile, botRng(seed, seat), seat),
  );
  const counters = profiles.map(() => new InputCounter());
  const lead = new LeadTracker();
  let drama = 0;
  while (!state.finished) {
    bots.forEach((bot, seat) => {
      const runner = state.runners[seat];
      const counter = counters[seat];
      if (runner && counter) bot.act(state, runner, directControls(state, runner.slot, counter));
    });
    const events = stepWackelturm(state, STEP, () => gameRng.next());
    for (const event of events) {
      if (event.type === 'topple') drama++;
      if (event.type === 'deliver') lead.update(state.runners.map((runner) => runner.score));
    }
  }
  const inputs = counters.reduce((sum, counter) => sum + counter.count, 0);
  const presses = counters.reduce((sum, counter) => sum + counter.presses, 0);
  const bPresses = counters.reduce((sum, counter) => sum + counter.bPresses, 0);
  return {
    scores: state.runners.map((runner) => runner.score),
    seconds: state.time,
    dramaticMoments: drama,
    inputsPerSecond: inputs / profiles.length / state.time,
    bShare: presses > 0 ? bPresses / presses : 0,
    leadChanges: lead.changes,
  };
}
