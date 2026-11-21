/**
 * EXP-039 (CHAOS-215): Gewinnt beim Wackelturm der Neuling öfter als fair, weil das Spiel
 * Können nicht belohnt, oder weil das Bot-Modell Geschick falsch abbildet?
 *
 * Gleiche Spielregeln (`WACKELTURM_PARAMS`, Fassung A6), nur das Kippgefühl der Bots
 * (`WackelturmBotModel`) wechselt. Gemessen wird mit der gemeinsamen Fairness-Vorlage
 * (CHAOS-84) plus einer Aufschlüsselung, woran der Außenseiter Punkte gewinnt oder verliert.
 */
import { createMinigameRng } from '@chaos-party/minigame-sdk';
import { createWackelturmHarness } from '../../checks/harnesses.ts';
import { measureFairness } from '../../checks/fairness.ts';
import { WACKELTURM_INFO } from '../../wackelturm/info.ts';
import { createWackelturm, stepWackelturm, WACKELTURM_PARAMS } from '../../wackelturm/logic.ts';
import { botRng, gauss, num, pct, seedRange, slotsFor, STEP, type Table } from './common.ts';
import {
  EXP007_BOT_MODEL,
  directControls,
  KIPPGEFUEHL_BOT_MODEL,
  WackelturmBot,
  type WackelturmBotModel,
} from './wackelturm-sim.ts';

const SKILL = { profi: 0.9, normal: 0.6, neuling: 0.2 } as const;
type OddSkill = 'neuling' | 'profi';

/** Varianten: je ein Hebel einzeln (K1 Tempo, K2 Bremsen), dann beide (K3), dann ohne Streuung. */
export const KIPPGEFUEHL_VARIANTS: readonly WackelturmBotModel[] = [
  EXP007_BOT_MODEL,
  {
    key: 'K1',
    label: 'K1: nur Tempo wie K3, Bremsen wie K0',
    pace: KIPPGEFUEHL_BOT_MODEL.pace,
    caution: EXP007_BOT_MODEL.caution,
  },
  {
    key: 'K2',
    label: 'K2: nur Bremsen wie K3, Tempo wie K0',
    pace: EXP007_BOT_MODEL.pace,
    caution: KIPPGEFUEHL_BOT_MODEL.caution,
  },
  KIPPGEFUEHL_BOT_MODEL,
  {
    key: 'K4',
    label: 'K4: wie K3, doppelte Streuung beim Verschätzen',
    pace: (skill, rng) => Math.max(0.5, 0.88 + 0.06 * skill + gauss(rng, 0.8 * (1 - skill))),
    caution: KIPPGEFUEHL_BOT_MODEL.caution,
  },
];

export interface OddSeatStats {
  /** Siegquote des Außenseiters (geteilte Siege anteilig). */
  readonly wins: number;
  /** Punkte je Partie: Außenseiter und Mittel der drei Normalen. */
  readonly points: readonly [number, number];
  /** Selbst umgekippte Türme je Partie (Wackeln). */
  readonly topples: readonly [number, number];
  /** Umgerempelte Türme je Partie. */
  readonly bumped: readonly [number, number];
  /** Abgelieferte Törtchen je Partie. */
  readonly delivered: readonly [number, number];
}

/** Außenseiter (Neuling oder Profi) gegen drei Normale, Platz reihum, Strategie „zufällig“. */
export function oddSeatStats(
  model: WackelturmBotModel,
  odd: OddSkill,
  seeds: readonly number[],
): OddSeatStats {
  let wins = 0;
  const points = new Pair();
  const topples = new Pair();
  const bumped = new Pair();
  const delivered = new Pair();
  for (const seed of seeds) {
    const oddSeat = (seed - 1) % 4;
    const state = createWackelturm(
      slotsFor(4),
      WACKELTURM_INFO.durationMs / 1000,
      WACKELTURM_PARAMS,
    );
    const gameRng = createMinigameRng(seed);
    const bots = [0, 1, 2, 3].map(
      (seat) =>
        new WackelturmBot(
          { strategy: 'zufaellig', skill: seat === oddSeat ? SKILL[odd] : SKILL.normal },
          botRng(seed, seat),
          seat,
          model,
        ),
    );
    while (!state.finished) {
      bots.forEach((bot, seat) => {
        const runner = state.runners[seat];
        if (runner) bot.act(state, runner, directControls(state, runner.slot));
      });
      for (const event of stepWackelturm(state, STEP, () => gameRng.next())) {
        if (event.type !== 'topple' && event.type !== 'deliver') continue;
        const isOdd = event.slot - 1 === oddSeat;
        if (event.type === 'deliver') delivered.add(isOdd, event.count);
        else if (event.cause === 'wobble') topples.add(isOdd, 1);
        else bumped.add(isOdd, 1);
      }
    }
    const scores = state.runners.map((runner) => Math.round(runner.score));
    const best = Math.max(...scores);
    const oddScore = scores[oddSeat] ?? 0;
    if (oddScore === best) wins += 1 / scores.filter((score) => score === best).length;
    points.add(true, oddScore);
    points.add(false, scores.reduce((a, b) => a + b, 0) - oddScore);
  }
  const n = seeds.length || 1;
  return {
    wins: wins / n,
    points: points.perGame(n),
    topples: topples.perGame(n),
    bumped: bumped.perGame(n),
    delivered: delivered.perGame(n),
  };
}

/** Summe für den Außenseiter und für die drei Normalen (später gemittelt). */
class Pair {
  private odd = 0;
  private normals = 0;

  add(isOdd: boolean, value: number): void {
    if (isOdd) this.odd += value;
    else this.normals += value;
  }

  perGame(games: number): [number, number] {
    return [this.odd / games, this.normals / 3 / games];
  }
}

/** Tabelle 1: Fairness-Kennzahlen (Vorlage CHAOS-84) je Bot-Modell. */
export async function kippgefuehlFairnessTable(seeds: number): Promise<Table> {
  const rows: string[][] = [];
  for (const model of KIPPGEFUEHL_VARIANTS) {
    const report = await measureFairness(createWackelturmHarness(model), seeds);
    rows.push([
      model.label,
      pct(report.noviceWins),
      pct(report.proWins),
      pct(report.tieForFirst),
      pct(report.gap12),
      num(report.leadChanges),
      ...report.intruders.map((intruder) => num(intruder.factor, 2)),
    ]);
  }
  return {
    title: `EXP-039: Wackelturm-Fairness je Bot-Modell (${seeds} Seeds je Tisch, Fassung A6)`,
    headers: [
      'Modell',
      'Neuling vs 3× Normal',
      'Profi vs 3× Normal',
      'Gleichstand',
      'Abstand 1–2',
      'Führungswechsel',
      'Raufbold',
      'gierig',
      'vorsichtig',
    ],
    rows,
  };
}

/** Tabelle 2: Woran gewinnt oder verliert der Außenseiter? (Außenseiter / Mittel Normale) */
export function kippgefuehlDetailTable(seeds: readonly number[]): Table {
  const pairText = ([odd, normal]: readonly [number, number], digits = 1): string =>
    `${num(odd, digits)} / ${num(normal, digits)}`;
  const rows: string[][] = [];
  for (const model of KIPPGEFUEHL_VARIANTS) {
    for (const odd of ['neuling', 'profi'] as const) {
      const stats = oddSeatStats(model, odd, seeds);
      rows.push([
        model.key,
        odd === 'neuling' ? 'Neuling' : 'Profi',
        pct(stats.wins),
        pairText(stats.points),
        pairText(stats.delivered),
        pairText(stats.topples, 2),
        pairText(stats.bumped, 2),
      ]);
    }
  }
  return {
    title: `EXP-039: Außenseiter gegen 3× Normal, Aufschlüsselung (${seeds.length} Seeds, Außenseiter / Mittel Normale)`,
    headers: [
      'Modell',
      'Außenseiter',
      'Siege',
      'Punkte',
      'geliefert',
      'selbst gekippt',
      'umgerempelt',
    ],
    rows,
  };
}

export const KIPPGEFUEHL_SEEDS = seedRange(200);
