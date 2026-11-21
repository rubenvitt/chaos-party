/**
 * Balance-Experimente für M4 (CHAOS-40, `docs/experiments.md` EXP-011 … EXP-013): Partiedauer
 * mit echter Minispiel-Rotation, Wertung mit Gleichstandsregel, Aufholeffekt, Sabotage.
 *
 * ```sh
 * EXPERIMENTS=m4 pnpm exec vitest run packages/game-core/src/rules/experiments.test.ts --silent=false
 * ```
 *
 * Anders als EXP-001 … EXP-004 bauen die Varianten auf dem M4-Stand auf (`M4_RULES`: die
 * `DEFAULT_RULES` ohne den Trostpreis aus EXP-019). Die Minispiele sind Bots mit gleichverteilten Punkten (plus
 * optionalem Können); ihre Dauer ist die echte Spielzeit aus dem Katalog. Näherungen, kein
 * Spaß-Beweis.
 */
import { WACKELWALD_M2 } from '../board/wackelwaldM2.ts';
import type { MinigameSpec, RuleSet } from '../types.ts';
import { DEFAULT_RULES, withRules, type RuleOverrides } from './defaults.ts';
import {
  economyMetrics,
  itemMetrics,
  mean,
  num,
  pct,
  quantile,
  runVariant,
  seedRange,
  seedText,
  toMarkdown,
  type ExperimentSetup,
  type Table,
  type Variant,
} from './experiments.ts';
import type { MsRange, SimulationResult } from './simulate.ts';

/**
 * Die Minispiel-Rotation aus M3 als Regel-Steckbriefe (Spiegel von `catalogMinigames()` in
 * `apps/server/src/game.ts`; `experiments.test.ts` prüft Gleichheit mit dem Katalog).
 */
export const ROTATION_SPECS: readonly MinigameSpec[] = [
  { id: 'sockenregen', playMs: 30_000, scoring: 'higher' },
  { id: 'pudding-gerangel', playMs: 30_000, scoring: 'higher' },
  { id: 'wackelturm', playMs: 35_000, scoring: 'higher' },
  { id: 'kuckucks-klatsche', playMs: 30_000, scoring: 'higher' },
  { id: 'kruemel-kehraus', playMs: 30_000, scoring: 'higher' },
];

/**
 * Entscheidungstempo am Controller. „flott“ = Bot-Standard (0,8–2,5 s je Prompt),
 * „gemütlich“ = Menschen, die nebenbei reden, lachen, das Handy erst suchen (1,5–4,5 s je
 * Prompt). Beides Annahmen; echte Zeiten liefert erst der Playtest.
 */
export const TEMPO_MODELS: readonly { readonly label: string; readonly decisionMs: MsRange }[] = [
  { label: 'flott', decisionMs: [800, 2500] },
  { label: 'gemütlich', decisionMs: [1500, 4500] },
];

/**
 * Feste Zeit außerhalb der Runden: Trophäenzählung und Siegerbildschirm am PC (Finale:
 * 2,2 s Intro + 2,8 s je Platz + 3,4 s Sieger, ggf. 2,6 s Gleichstand) plus Start. Gerundet.
 * Die Lobby (QR scannen, Figuren wählen) zählt nicht zur Partie.
 */
export const FINALE_MS = 20_000;

/** M4-Setup: Seeds 1–200, 2/3/4 Spieler; Rundenzahl je Tabelle. */
export const M4_SETUP: ExperimentSetup = { seeds: seedRange(200), players: [2, 3, 4], rounds: 10 };

/**
 * Standardregeln ohne den Trostpreis aus EXP-019 (CHAOS-51). So laufen EXP-011 … EXP-013 und
 * EXP-018 ohne ihn weiter, und EXP-019 vergleicht gegen denselben Stand.
 */
export const M4_RULES: RuleSet = withRules({ items: { minigameLastItems: 0 } }, DEFAULT_RULES);

/** M4-Standardregeln mit echter Minispiel-Rotation. */
export function m4Defaults(id = 'M4', label = 'Standard + Rotation'): Variant {
  return { id, label, rules: M4_RULES, board: WACKELWALD_M2, minigames: ROTATION_SPECS };
}

/** Variante aus Abweichungen von `M4_RULES` (nicht `START_RULES`). */
export function m4Variant(
  id: string,
  label: string,
  overrides: RuleOverrides = {},
  extra: Omit<Variant, 'id' | 'label' | 'rules'> = {},
): Variant {
  return { ...m4Defaults(id, label), rules: withRules(overrides, M4_RULES), ...extra };
}

// ---------------------------------------------------------------------------
// EXP-011 Partiedauer und Runden-Presets
// ---------------------------------------------------------------------------

export interface DurationMetrics {
  /** Partiedauer inkl. Minispiele und Finale (min). */
  readonly minutes: number;
  readonly minutesP90: number;
  /** Mittlere Dauer einer Runde (min). */
  readonly minutesPerRound: number;
  /** Anteil der Zeit außerhalb der Brettzüge (Minispiele, Rundenwechsel). */
  readonly minigameShare: number;
}

export function durationMetrics(results: readonly SimulationResult[]): DurationMetrics {
  const minutes = results.map((r) => (r.durationMs + FINALE_MS) / 60_000);
  return {
    minutes: mean(minutes),
    minutesP90: quantile(minutes, 0.9),
    minutesPerRound: mean(results.map((r) => r.durationMs / 60_000 / r.rounds)),
    minigameShare: mean(
      results.map((r) => 1 - r.turnDurationsMs.reduce((s, d) => s + d, 0) / (r.durationMs || 1)),
    ),
  };
}

export const PRESET_ROUND_COUNTS: readonly number[] = [5, 8, 10, 12, 15, 16, 18, 20];

export function durationExperiment(
  setup: ExperimentSetup = M4_SETUP,
  roundCounts: readonly number[] = PRESET_ROUND_COUNTS,
): Table {
  const rows: string[][] = [];
  const slowest = TEMPO_MODELS[TEMPO_MODELS.length - 1];
  for (const rounds of roundCounts) {
    for (const players of setup.players) {
      const cells: string[] = [];
      let last: DurationMetrics | null = null;
      for (const tempo of TEMPO_MODELS) {
        const v: Variant = { ...m4Defaults(), policy: { decisionMs: tempo.decisionMs } };
        const m = durationMetrics(runVariant(v, players, { seeds: setup.seeds, rounds }));
        cells.push(num(m.minutes));
        if (tempo === slowest) last = m;
      }
      rows.push([
        String(rounds),
        String(players),
        ...cells,
        num(last?.minutesP90 ?? 0),
        num(last?.minutesPerRound ?? 0, 2),
        pct(last?.minigameShare ?? 0),
      ]);
    }
  }
  return {
    title: `EXP-011 Partiedauer mit Minispiel-Rotation und Finale (${seedText(setup)})`,
    headers: [
      'Runden',
      'Sp.',
      'min flott',
      'min gemütlich',
      'p90 gemütlich',
      'min/Runde gemütlich',
      'Anteil ohne Brettzüge',
    ],
    rows,
  };
}

/** Runden-Vorschläge der Lobby (`DEFAULT_ROUND_PRESETS`), für den Vergleich der Anleitung. */
export const REPEAT_INTRO_ROUND_COUNTS: readonly number[] = [10, 16, 20];

/**
 * EXP-011, Nachtrag CHAOS-66: Partiedauer (gemütlich) mit voller Anleitung bei jedem Minispiel
 * gegen die kurze Anleitung bei Wiederholung (`minigameRepeatIntroMs`, Standard).
 */
export function repeatIntroExperiment(
  setup: ExperimentSetup = M4_SETUP,
  roundCounts: readonly number[] = REPEAT_INTRO_ROUND_COUNTS,
): Table {
  const slowest = TEMPO_MODELS[TEMPO_MODELS.length - 1];
  const policy = { decisionMs: slowest?.decisionMs ?? ([1500, 4500] as const) };
  const full: Variant = {
    ...m4Variant('FULL', 'volle Anleitung', {
      pacing: { minigameRepeatIntroMs: DEFAULT_RULES.pacing.minigameIntroMs },
    }),
    policy,
  };
  const short: Variant = { ...m4Defaults(), policy };
  const rows: string[][] = [];
  for (const rounds of roundCounts) {
    for (const players of setup.players) {
      const before = durationMetrics(runVariant(full, players, { seeds: setup.seeds, rounds }));
      const after = durationMetrics(runVariant(short, players, { seeds: setup.seeds, rounds }));
      rows.push([
        String(rounds),
        String(players),
        num(before.minutes),
        num(after.minutes),
        num(before.minutes - after.minutes),
        num(after.minutesPerRound, 2),
        pct(before.minigameShare),
        pct(after.minigameShare),
      ]);
    }
  }
  return {
    title: `EXP-011 Nachtrag (CHAOS-66): volle gegen kurze Anleitung bei Wiederholung, gemütlich (${seedText(setup)})`,
    headers: [
      'Runden',
      'Sp.',
      'min voll',
      'min kurz',
      'gespart (min)',
      'min/Runde kurz',
      'Anteil ohne Brettzüge voll',
      'Anteil ohne Brettzüge kurz',
    ],
    rows,
  };
}

// ---------------------------------------------------------------------------
// EXP-012 Wertung, Gleichstand, Aufholeffekt, Ökonomie
// ---------------------------------------------------------------------------

export interface ScoringMetrics {
  readonly trophiesPerGame: number;
  readonly trophiesOfWinner: number;
  /** Anteil Partien, deren Sieger keine Trophäe hat. */
  readonly winnerWithoutTrophy: number;
  readonly noTrophyShare: number;
  /** Wie Platz 1 entschieden wird (Anteile der Partien; Summe 1). */
  readonly decidedBy: Readonly<Record<'trophies' | 'coins' | 'minigame-wins' | 'shared', number>>;
  /** Anteil Partien mit irgendeinem geteilten Platz. */
  readonly anySharedPlace: number;
  /** Anteil Partien, in denen der alleinige Führende zur Hälfte auch allein gewinnt. */
  readonly midLeaderWins: number;
  /** Anteil Partien, in denen der alleinige Letzte zur Hälfte noch allein gewinnt. */
  readonly midLastWins: number;
  /** Anteil Minispiele mit geteiltem 1. Platz. */
  readonly minigameSharedWins: number;
  /** Anteil Siege von Slot 1 (geteilter Sieg anteilig). */
  readonly slot1WinShare: number;
}

export function scoringMetrics(results: readonly SimulationResult[]): ScoringMetrics {
  const players = results.flatMap((r) => r.standings);
  const decided = { trophies: 0, coins: 0, 'minigame-wins': 0, shared: 0 };
  let anyShared = 0;
  let leaderGames = 0;
  let leaderWins = 0;
  let lastGames = 0;
  let lastWins = 0;
  let slot1Wins = 0;
  for (const r of results) {
    const winners = r.ranking.filter((e) => e.place === 1);
    const winner = winners[0];
    if (winners.length > 1 || !winner) decided.shared += 1;
    else decided[winner.decidedBy] += 1;
    if (winners.some((e) => e.slot === 1)) slot1Wins += 1 / winners.length;
    const places = r.ranking.map((e) => e.place);
    if (new Set(places).size < places.length) anyShared += 1;
    const soleWinner = winners.length === 1 ? winner?.slot : undefined;
    const mid = r.midRanking;
    if (mid) {
      const leaders = mid.filter((e) => e.place === 1);
      const lastPlace = Math.max(...mid.map((e) => e.place));
      const lasts = mid.filter((e) => e.place === lastPlace);
      if (leaders.length === 1) {
        leaderGames += 1;
        if (leaders[0]?.slot === soleWinner) leaderWins += 1;
      }
      if (lasts.length === 1 && lastPlace > 1) {
        lastGames += 1;
        if (lasts[0]?.slot === soleWinner) lastWins += 1;
      }
    }
  }
  const n = results.length || 1;
  const played = results.reduce((s, r) => s + r.minigamesPlayed, 0);
  return {
    trophiesPerGame: mean(results.map((r) => r.trophiesBought)),
    trophiesOfWinner: mean(results.map((r) => r.ranking[0]?.trophies ?? 0)),
    winnerWithoutTrophy: mean(results.map((r) => ((r.ranking[0]?.trophies ?? 0) === 0 ? 1 : 0))),
    noTrophyShare: mean(players.map((p) => (p.trophies === 0 ? 1 : 0))),
    decidedBy: {
      trophies: decided.trophies / n,
      coins: decided.coins / n,
      'minigame-wins': decided['minigame-wins'] / n,
      shared: decided.shared / n,
    },
    anySharedPlace: anyShared / n,
    midLeaderWins: leaderGames === 0 ? 0 : leaderWins / leaderGames,
    midLastWins: lastGames === 0 ? 0 : lastWins / lastGames,
    minigameSharedWins:
      played === 0 ? 0 : results.reduce((s, r) => s + r.minigameSharedWins, 0) / played,
    slot1WinShare: slot1Wins / n,
  };
}

export const SCORING_ROUND_COUNTS: readonly number[] = [3, 5, 8, 10, 16, 20];

export function scoringExperiment(
  setup: ExperimentSetup = M4_SETUP,
  roundCounts: readonly number[] = SCORING_ROUND_COUNTS,
): Table {
  const rows: string[][] = [];
  for (const rounds of roundCounts) {
    for (const players of setup.players) {
      const m = scoringMetrics(runVariant(m4Defaults(), players, { seeds: setup.seeds, rounds }));
      rows.push([
        String(rounds),
        String(players),
        num(m.trophiesPerGame, 2),
        num(m.trophiesOfWinner, 2),
        pct(m.winnerWithoutTrophy),
        pct(m.noTrophyShare),
        pct(m.decidedBy.trophies),
        pct(m.decidedBy.coins),
        pct(m.decidedBy['minigame-wins']),
        pct(m.decidedBy.shared),
        pct(m.anySharedPlace),
        pct(m.minigameSharedWins),
        pct(m.midLeaderWins),
        pct(m.midLastWins),
        pct(1 / players),
      ]);
    }
  }
  return {
    title: `EXP-012 Wertung, Gleichstand, Aufholeffekt (Standardregeln + Rotation, ${seedText(setup)})`,
    headers: [
      'Runden',
      'Sp.',
      'Trophäen/Partie',
      'Sieger-Trophäen',
      'Sieger ohne Trophäe',
      'Spieler ohne Trophäe',
      'Sieg per Trophäen',
      'per Münzen',
      'per Minispiel-Siegen',
      'Sieg geteilt',
      'ein Platz geteilt',
      'Minispiel P1 geteilt',
      'Führender (Hälfte) gewinnt',
      'Letzter (Hälfte) gewinnt',
      'fair 1/n',
    ],
    rows,
  };
}

/** Ökonomie-Varianten (Trophäenpreis, Minispiel-Münzen) bei kurzen und mittleren Partien. */
export const M4_ECONOMY_VARIANTS: readonly Variant[] = [
  m4Defaults('A', 'Preis 15, Minispiel 10/5/3/0 (Stand)'),
  m4Variant('B', 'Preis 20', { trophy: { price: 20 } }),
  m4Variant('C', 'Minispiel 8/4/2/0', { economy: { minigameRewards: [8, 4, 2, 0] } }),
  m4Variant('D', 'Minispiel 10/6/3/1', { economy: { minigameRewards: [10, 6, 3, 1] } }),
  m4Variant('E', 'Preis 20, Minispiel 12/6/3/0', {
    trophy: { price: 20 },
    economy: { minigameRewards: [12, 6, 3, 0] },
  }),
  {
    ...m4Defaults('S', 'Stand, Slot 1 Minispiel-Profi (+10 Punkte)'),
    policy: { minigameSkill: { 1: 10 } },
  },
];

export const M4_ECONOMY_ROUND_COUNTS: readonly number[] = [10, 20];

export function m4EconomyExperiment(
  setup: ExperimentSetup = M4_SETUP,
  roundCounts: readonly number[] = M4_ECONOMY_ROUND_COUNTS,
  variants: readonly Variant[] = M4_ECONOMY_VARIANTS,
): Table {
  const rows: string[][] = [];
  for (const rounds of roundCounts) {
    for (const v of variants) {
      for (const players of setup.players) {
        const results = runVariant(v, players, { seeds: setup.seeds, rounds });
        const m = scoringMetrics(results);
        rows.push([
          String(rounds),
          `${v.id}: ${v.label}`,
          String(players),
          num(m.trophiesPerGame, 2),
          num(m.trophiesOfWinner, 2),
          pct(m.noTrophyShare),
          pct(m.decidedBy.trophies),
          pct(m.midLeaderWins),
          pct(m.slot1WinShare),
          num(economyMetrics(results).finalCoins),
        ]);
      }
    }
  }
  return {
    title: `EXP-012 Ökonomie-Varianten mit Rotation (${seedText(setup)})`,
    headers: [
      'Runden',
      'Variante',
      'Sp.',
      'Trophäen/Partie',
      'Sieger-Trophäen',
      'ohne Trophäe',
      'Sieg per Trophäen',
      'Führender (Hälfte) gewinnt',
      'Siege Slot 1',
      'Münzen Ende',
    ],
    rows,
  };
}

// ---------------------------------------------------------------------------
// EXP-013 Sabotage und Item-Stärke
// ---------------------------------------------------------------------------

export interface SabotageMetrics {
  readonly sabotagePerGame: number;
  readonly sabotagePerRound: number;
  /** Durch Sabotage verlorene Münzen / alle eingenommenen Münzen. */
  readonly lostShareOfEarned: number;
  readonly lossShare: number;
  readonly lossShareP90: number;
  readonly lossCoins: number;
  /** Höchster Sabotage-Verlust einer Person in der Partie (Münzen; Mittel und p90). */
  readonly worstVictimCoins: number;
  readonly worstVictimCoinsP90: number;
  /** Dieser Verlust relativ zu den Einnahmen der Person (Mittel). */
  readonly worstVictimShare: number;
  readonly maxHitsOnOne: number;
}

export function sabotageMetrics(results: readonly SimulationResult[]): SabotageMetrics {
  const items = itemMetrics(results);
  const lost = results.reduce((s, r) => s + r.sabotageLosses.reduce((t, l) => t + l.amount, 0), 0);
  const earned = results.reduce(
    (s, r) => s + r.standings.reduce((t, p) => t + p.coinsEarned, 0),
    0,
  );
  const worst = results.map((r) => {
    const bySlot = new Map<number, number>();
    for (const l of r.sabotageLosses) bySlot.set(l.slot, (bySlot.get(l.slot) ?? 0) + l.amount);
    let coins = 0;
    let share = 0;
    for (const [slot, amount] of bySlot) {
      coins = Math.max(coins, amount);
      const earnedBy = r.standings.find((p) => p.slot === slot)?.coinsEarned ?? 0;
      share = Math.max(share, earnedBy > 0 ? amount / earnedBy : 0);
    }
    return { coins, share };
  });
  const worstCoins = worst.map((w) => w.coins);
  return {
    sabotagePerGame: items.sabotagePerGame,
    sabotagePerRound: mean(results.map((r) => (r.coinSteals + r.trapsTriggered) / r.rounds)),
    lostShareOfEarned: earned === 0 ? 0 : lost / earned,
    lossShare: items.lossShare,
    lossShareP90: items.lossShareP90,
    lossCoins: items.lossCoins,
    worstVictimCoins: mean(worstCoins),
    worstVictimCoinsP90: quantile(worstCoins, 0.9),
    worstVictimShare: mean(worst.map((w) => w.share)),
    maxHitsOnOne: items.maxHitsOnOne,
  };
}

/** Feste Sabotage-Werte (Stand vor EXP-018), Basis der EXP-013-Varianten. */
const FIXED: NonNullable<RuleOverrides['items']> = { sabotageGrowthRounds: 0 };

export const M4_SABOTAGE_VARIANTS: readonly Variant[] = [
  m4Variant('A', 'Klau 5, Falle 4 (Stand)', { items: FIXED }),
  m4Variant('B', 'Klau 6, Falle 5', { items: { ...FIXED, stealAmount: 6, trapAmount: 5 } }),
  m4Variant('C', 'Klau 7, Falle 5', { items: { ...FIXED, stealAmount: 7, trapAmount: 5 } }),
  m4Variant('D', 'Münzklau-Gewicht 4', { items: { ...FIXED, weights: { 'coin-steal': 4 } } }),
  m4Variant('E', 'Klau 6, Falle 5, Münzklau-Gewicht 4', {
    items: { ...FIXED, stealAmount: 6, trapAmount: 5, weights: { 'coin-steal': 4 } },
  }),
];

export const M4_SABOTAGE_ROUND_COUNTS: readonly number[] = [10, 20];

export function sabotageExperiment(
  setup: ExperimentSetup = M4_SETUP,
  roundCounts: readonly number[] = M4_SABOTAGE_ROUND_COUNTS,
  variants: readonly Variant[] = M4_SABOTAGE_VARIANTS,
): Table {
  const rows: string[][] = [];
  for (const rounds of roundCounts) {
    for (const v of variants) {
      for (const players of setup.players) {
        const results = runVariant(v, players, { seeds: setup.seeds, rounds });
        const m = sabotageMetrics(results);
        rows.push([
          String(rounds),
          `${v.id}: ${v.label}`,
          String(players),
          num(m.sabotagePerGame, 2),
          num(m.sabotagePerRound, 2),
          pct(m.lostShareOfEarned),
          pct(m.lossShare),
          pct(m.lossShareP90),
          num(m.lossCoins),
          num(m.worstVictimCoins),
          num(m.worstVictimCoinsP90, 0),
          pct(m.worstVictimShare),
          num(m.maxHitsOnOne, 2),
          num(scoringMetrics(results).trophiesPerGame, 2),
        ]);
      }
    }
  }
  return {
    title: `EXP-013 Sabotage mit Rotation (${seedText(setup)})`,
    headers: [
      'Runden',
      'Variante',
      'Sp.',
      'Sabotagen/Partie',
      'je Runde',
      'Verlust/Einnahmen',
      'Verlust/Bestand',
      'p90',
      'Münzen/Treffer',
      'Spitzenopfer Münzen',
      'p90',
      'Spitzenopfer/Einnahmen',
      'max. Treffer auf einen',
      'Trophäen',
    ],
    rows,
  };
}

// ---------------------------------------------------------------------------
// EXP-018 Wachsende Sabotage (CHAOS-67)
// ---------------------------------------------------------------------------

/**
 * Relativer Verlust je Treffer (Verlust / Bestand davor) getrennt nach Partie-Drittel: zeigt,
 * ob Sabotage zum Ende hin zahmer wird, weil der Bestand mit den Minispiel-Münzen wächst.
 */
export interface SabotagePhaseMetrics {
  readonly early: number;
  readonly late: number;
  /** Münzen je Treffer im letzten Drittel. */
  readonly lateCoins: number;
}

export function sabotagePhaseMetrics(results: readonly SimulationResult[]): SabotagePhaseMetrics {
  const early: number[] = [];
  const late: number[] = [];
  const lateCoins: number[] = [];
  for (const r of results) {
    for (const l of r.sabotageLosses) {
      if (l.before <= 0) continue;
      const share = l.amount / l.before;
      if (l.round <= r.rounds / 3) early.push(share);
      else if (l.round > (2 * r.rounds) / 3) {
        late.push(share);
        lateCoins.push(l.amount);
      }
    }
  }
  return { early: mean(early), late: mean(late), lateCoins: mean(lateCoins) };
}

/** Alle Werte ausdrücklich gesetzt, damit die Tabelle unabhängig von `DEFAULT_RULES` bleibt. */
export const GROWTH_VARIANTS: readonly Variant[] = [
  m4Variant('A', 'Klau 5, Falle 4 (fest, vorher Stand)', { items: FIXED }),
  m4Variant('B', 'Klau 6, Falle 5', { items: { ...FIXED, stealAmount: 6, trapAmount: 5 } }),
  m4Variant('F', '5/4, +1 alle 5 Runden (neuer Stand)', { items: { sabotageGrowthRounds: 5 } }),
  m4Variant('G', '5/4, +1 alle 4 Runden', { items: { sabotageGrowthRounds: 4 } }),
  m4Variant('H', '5/4, +1 alle 3 Runden', { items: { sabotageGrowthRounds: 3 } }),
  m4Variant('I', '6/5, +1 alle 5 Runden', {
    items: { stealAmount: 6, trapAmount: 5, sabotageGrowthRounds: 5 },
  }),
];

export const GROWTH_ROUND_COUNTS: readonly number[] = [10, 16, 20];

export function sabotageGrowthExperiment(
  setup: ExperimentSetup = M4_SETUP,
  roundCounts: readonly number[] = GROWTH_ROUND_COUNTS,
  variants: readonly Variant[] = GROWTH_VARIANTS,
): Table {
  const rows: string[][] = [];
  for (const rounds of roundCounts) {
    for (const v of variants) {
      for (const players of setup.players) {
        const results = runVariant(v, players, { seeds: setup.seeds, rounds });
        const m = sabotageMetrics(results);
        const phase = sabotagePhaseMetrics(results);
        const scoring = scoringMetrics(results);
        rows.push([
          String(rounds),
          `${v.id}: ${v.label}`,
          String(players),
          num(m.sabotagePerGame, 2),
          pct(m.lostShareOfEarned),
          pct(m.lossShare),
          pct(m.lossShareP90),
          pct(phase.early),
          pct(phase.late),
          num(m.lossCoins),
          num(phase.lateCoins),
          num(m.worstVictimCoins),
          num(m.worstVictimCoinsP90, 0),
          pct(m.worstVictimShare),
          pct(scoring.decidedBy.trophies),
          pct(scoring.midLeaderWins),
          num(scoring.trophiesPerGame, 2),
        ]);
      }
    }
  }
  return {
    title: `EXP-018 Wachsende Sabotage mit Rotation (${seedText(setup)})`,
    headers: [
      'Runden',
      'Variante',
      'Sp.',
      'Sabotagen/Partie',
      'Verlust/Einnahmen',
      'Verlust/Bestand',
      'p90',
      '1. Drittel',
      '3. Drittel',
      'Münzen/Treffer',
      'Münzen/Treffer 3. Drittel',
      'Spitzenopfer Münzen',
      'p90',
      'Spitzenopfer/Einnahmen',
      'Sieg per Trophäen',
      'Führender (Hälfte) gewinnt',
      'Trophäen',
    ],
    rows,
  };
}

/** Alle M4-Tabellen als Markdown (für `docs/experiments.md`). */
export function runM4Experiments(setup: ExperimentSetup = M4_SETUP): string {
  return [
    durationExperiment(setup),
    repeatIntroExperiment(setup),
    scoringExperiment(setup),
    m4EconomyExperiment(setup),
    sabotageExperiment(setup),
  ]
    .map(toMarkdown)
    .join('\n\n');
}
