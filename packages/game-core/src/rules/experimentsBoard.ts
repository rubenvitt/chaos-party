/**
 * Brett-Experiment EXP-037 (CHAOS-196, `docs/experiments.md`): der vergrößerte Wackelwald
 * (74 Felder, vier Gabeln) gegen den alten (43 Felder, zwei Gabeln), mit den aktuellen
 * Standardregeln und echter Minispiel-Rotation.
 *
 * ```sh
 * EXPERIMENTS=brett pnpm exec vitest run packages/game-core/src/rules/experimentsBoard.test.ts --silent=false
 * ```
 *
 * Fragen: Bleiben Trophäen in kurzen und langen Partien erreichbar? Ist die Wegwahl fair (Bots,
 * die immer kurz gehen, gegen Bots, die immer lang gehen)? Werden alle Wege und Trophäen-
 * Kandidaten genutzt? Näherungen aus Bot-Partien, kein Spaß-Beweis.
 */
import { WACKELWALD } from '../board/wackelwald.ts';
import { WACKELWALD_M2 } from '../board/wackelwaldM2.ts';
import type { BoardDefinition, Slot } from '../types.ts';
import { DEFAULT_RULES } from './defaults.ts';
import {
  economyMetrics,
  mean,
  num,
  paceMetrics,
  pct,
  runVariant,
  seedRange,
  seedText,
  toMarkdown,
  type ExperimentSetup,
  type PlayerCount,
  type Table,
  type Variant,
} from './experiments.ts';
import { durationMetrics, ROTATION_SPECS } from './experimentsM4.ts';

/** Setup: Seeds 1–200, 2/3/4 Spieler; Rundenzahl je Tabelle. */
export const BOARD_SETUP: ExperimentSetup = {
  seeds: seedRange(200),
  players: [2, 3, 4],
  rounds: 10,
};

/** Rundenzahlen: kurze Partie (5), Server-Standard (10), Voreinstellungen bis 20. */
export const BOARD_ROUND_COUNTS: readonly number[] = [5, 10, 12, 15, 20];

/** Aktuelle Standardregeln mit echter Minispiel-Rotation auf einem Brett. */
export function boardVariant(id: string, label: string, board: BoardDefinition): Variant {
  return { id, label, rules: DEFAULT_RULES, board, minigames: ROTATION_SPECS };
}

export const BOARD_VARIANTS: readonly Variant[] = [
  boardVariant('A', 'Wackelwald alt (43 Felder)', WACKELWALD_M2),
  boardVariant('B', 'Wackelwald neu (74 Felder)', WACKELWALD),
];

/** Alle Rundenlängen (Felder vom Start zurück zum Start) über alle Wegkombinationen. */
export function lapLengths(board: BoardDefinition): number[] {
  const next = new Map(board.spaces.map((s) => [s.id, s.next]));
  const lengths: number[] = [];
  const walk = (id: string, steps: number, seen: ReadonlySet<string>): void => {
    for (const to of next.get(id) ?? []) {
      if (to === board.start) lengths.push(steps + 1);
      else if (!seen.has(to)) walk(to, steps + 1, new Set([...seen, to]));
    }
  };
  walk(board.start, 0, new Set([board.start]));
  return lengths.sort((a, b) => a - b);
}

/** Zeile je Brett, Rundenzahl und Spielerzahl: Dauer, Laufweg, Trophäen. */
export function boardSizeExperiment(
  setup: ExperimentSetup = BOARD_SETUP,
  roundCounts: readonly number[] = BOARD_ROUND_COUNTS,
): Table {
  const rows: string[][] = [];
  for (const v of BOARD_VARIANTS) {
    const laps = lapLengths(v.board ?? WACKELWALD);
    const lap = mean(laps);
    for (const rounds of roundCounts) {
      for (const players of setup.players) {
        const results = runVariant(v, players, { seeds: setup.seeds, rounds });
        const pace = paceMetrics(results, v.rules);
        const eco = economyMetrics(results);
        rows.push([
          v.label,
          String(rounds),
          String(players),
          num(durationMetrics(results).minutes),
          num(pace.spacesPerPlayer, 0),
          num(pace.spacesPerPlayer / lap, 2),
          num(eco.trophiesPerGame, 2),
          num(eco.trophiesOfWinner, 2),
          pct(eco.noTrophyShare),
          pct(eco.noTrophyGameShare),
          pct(eco.coinsDecideShare),
        ]);
      }
    }
  }
  return {
    title: `EXP-037 Brettgröße (Standardregeln + Rotation, ${seedText(setup)})`,
    headers: [
      'Brett',
      'Runden',
      'Sp.',
      'Partie min',
      'Felder/Sp.',
      'Runden ums Brett',
      'Trophäen',
      'Trophäen Sieger',
      'ohne Trophäe',
      'Partie ohne Trophäe',
      'Münzen entscheiden',
    ],
    rows,
  };
}

/**
 * Feste Wegwahl je Slot: Bei gerader Spielerzahl geht die eine Hälfte immer kurz, die andere
 * immer lang; `swap` tauscht die Rollen (gleicht den Vorteil der Zugreihenfolge aus).
 */
export function routeSplit(
  players: PlayerCount,
  swap: boolean,
): Partial<Record<Slot, 'short' | 'long'>> {
  const routes: Partial<Record<Slot, 'short' | 'long'>> = {};
  for (let slot = 1; slot <= players; slot++) {
    const short = (slot % 2 === 1) !== swap;
    routes[slot as Slot] = short ? 'short' : 'long';
  }
  return routes;
}

export interface RouteFairness {
  /** Siegquote der Kurz-Geher (geteilter Platz 1 zählt anteilig). */
  readonly shortWinShare: number;
  readonly shortTrophies: number;
  readonly longTrophies: number;
  readonly shortCoins: number;
  readonly longCoins: number;
}

export function routeFairness(
  board: BoardDefinition,
  players: 2 | 4,
  setup: Pick<ExperimentSetup, 'seeds' | 'rounds'>,
): RouteFairness {
  const short: { trophies: number; coins: number }[] = [];
  const long: typeof short = [];
  let games = 0;
  let shortWins = 0;
  for (const swap of [false, true]) {
    const routes = routeSplit(players, swap);
    const v: Variant = {
      ...boardVariant('F', 'Wegwahl', board),
      policy: { routes },
    };
    for (const r of runVariant(v, players, setup)) {
      games += 1;
      const winners = r.ranking.filter((e) => e.place === 1);
      for (const w of winners) if (routes[w.slot] === 'short') shortWins += 1 / winners.length;
      for (const p of r.standings) {
        const entry = { trophies: p.trophies, coins: p.coins };
        (routes[p.slot] === 'short' ? short : long).push(entry);
      }
    }
  }
  return {
    shortWinShare: games === 0 ? 0 : shortWins / games,
    shortTrophies: mean(short.map((e) => e.trophies)),
    longTrophies: mean(long.map((e) => e.trophies)),
    shortCoins: mean(short.map((e) => e.coins)),
    longCoins: mean(long.map((e) => e.coins)),
  };
}

/** Kurz gegen lang: Siegquote, Trophäen und Münzen je Wegwahl. */
export function routeFairnessExperiment(
  setup: ExperimentSetup = BOARD_SETUP,
  roundCounts: readonly number[] = [5, 10, 20],
): Table {
  const rows: string[][] = [];
  for (const v of BOARD_VARIANTS) {
    for (const rounds of roundCounts) {
      for (const players of [2, 4] as const) {
        const f = routeFairness(v.board ?? WACKELWALD, players, { seeds: setup.seeds, rounds });
        rows.push([
          v.label,
          String(rounds),
          String(players),
          pct(f.shortWinShare),
          `${num(f.shortTrophies, 2)} / ${num(f.longTrophies, 2)}`,
          `${num(f.shortCoins)} / ${num(f.longCoins)}`,
        ]);
      }
    }
  }
  return {
    title: `EXP-037 Wegwahl: immer kurz gegen immer lang (Rollen getauscht, ${seedText(setup)} × 2)`,
    headers: [
      'Brett',
      'Runden',
      'Sp.',
      'Sieg kurz (fair ≈ 50 %)',
      'Trophäen kurz / lang',
      'Münzen kurz / lang',
    ],
    rows,
  };
}

/** Wie oft Bots (Standard-Experiment-Verhalten) welchen Weg nehmen und wo Trophäen fallen. */
export function routeUsageExperiment(
  setup: ExperimentSetup = BOARD_SETUP,
  board: BoardDefinition = WACKELWALD,
): Table {
  const v = boardVariant('B', 'neu', board);
  const results = setup.players.flatMap((players) => runVariant(v, players, setup));
  const byId = new Map(board.spaces.map((s) => [s.id, s]));
  const rows: string[][] = [];
  for (const fork of board.spaces.filter((s) => s.next.length > 1)) {
    const counts = fork.next.map((id) => results.reduce((n, r) => n + (r.pathsChosen[id] ?? 0), 0));
    const total = counts.reduce((a, b) => a + b, 0) || 1;
    rows.push([
      `Gabel ${fork.id}`,
      fork.next
        .map((id, i) => `${byId.get(id)?.label ?? id} ${pct((counts[i] ?? 0) / total)}`)
        .join(' · '),
    ]);
  }
  const bought = board.spaces
    .filter((s) => s.kind === 'trophy')
    .map((s) => ({
      id: s.id,
      count: results.reduce((n, r) => n + (r.trophySpacesBought[s.id] ?? 0), 0),
    }));
  const totalBought = bought.reduce((n, b) => n + b.count, 0) || 1;
  rows.push([
    'Trophäen gekauft je Feld',
    bought.map((b) => `${b.id} ${pct(b.count / totalBought)}`).join(' · '),
  ]);
  return {
    title: `EXP-037 Wegwahl und Trophäenfelder (${String(setup.rounds)} Runden, 2–4 Sp., ${seedText(setup)})`,
    headers: ['Gabel / Feld', 'Anteil'],
    rows,
  };
}

export function runBoardExperiments(setup: ExperimentSetup = BOARD_SETUP): string {
  const laps = (board: BoardDefinition): string => {
    const l = lapLengths(board);
    return `${String(l[0] ?? 0)}–${String(l[l.length - 1] ?? 0)} Felder (${String(l.length)} Wegkombinationen)`;
  };
  return [
    `Rundenlänge alt: ${laps(WACKELWALD_M2)}; neu: ${laps(WACKELWALD)}`,
    toMarkdown(boardSizeExperiment(setup)),
    toMarkdown(routeFairnessExperiment(setup)),
    toMarkdown(routeUsageExperiment(setup)),
  ].join('\n\n');
}
