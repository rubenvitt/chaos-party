/**
 * EXP-038 (CHAOS-89): Münz-Regel für Spielformen mit Teams und Koop. Bot-Simulation ganzer
 * Partien mit der echten Rotation plus drei Team-Spielen (2 gegen 2, 1 gegen 3, Koop).
 *
 * ```sh
 * EXPERIMENTS=teams pnpm exec vitest run packages/game-core/src/rules/experimentsTeams.test.ts --silent=false
 * ```
 *
 * Gemessen: Münzen aus Minispielen je Minispiel (Inflation gegenüber jeder gegen jeden, 18 bei
 * vier Personen), Münzen am Ende, Trophäen je Partie, Aufholeffekt (wie oft gewinnt, wer zur
 * Halbzeit führt bzw. hinten liegt) und Spieler ohne Trophäe. Bots mit gleichverteilten
 * Punkten; die Einzelperson gewinnt mit 45 %. Näherungen, kein Spaß-Beweis.
 */
import type { MinigameSpec, TeamRewards } from '../types.ts';
import { DEFAULT_TEAM_REWARDS, START_TEAM_REWARDS } from './defaults.ts';
import {
  economyMetrics,
  mean,
  num,
  pct,
  runVariant,
  seedRange,
  seedText,
  type ExperimentSetup,
  type Table,
  type Variant,
} from './experiments.ts';
import { m4Variant, ROTATION_SPECS } from './experimentsM4.ts';
import type { SimulationResult } from './simulate.ts';

/** Team-Spiele für die Simulation (Spiegel der Testspiele Pump-Duell, Pump-Solo, Riesenballon). */
export const TEAM_SPECS: readonly MinigameSpec[] = [
  {
    id: 'pump-duell',
    playMs: 8_000,
    scoring: 'higher',
    form: '2v2',
    minPlayers: 2,
    teamPlay: { form: '2v2', assignment: 'random', withThree: true, withTwo: true },
  },
  {
    id: 'pump-solo',
    playMs: 8_000,
    scoring: 'higher',
    form: '1v3',
    minPlayers: 2,
    teamPlay: { form: '1v3', assignment: 'last-vs-all', withThree: true, withTwo: true },
  },
  {
    id: 'pump-riese',
    playMs: 8_000,
    scoring: 'higher',
    form: 'koop',
    minPlayers: 2,
    teamPlay: { form: 'koop', withThree: true, withTwo: true },
  },
];

/** Rotation mit drei von acht Spielen als Team-Spiel (mehr als später im Katalog, ~15 %). */
export const MIXED_SPECS: readonly MinigameSpec[] = [...ROTATION_SPECS, ...TEAM_SPECS];

export const TEAMS_SETUP: ExperimentSetup = {
  seeds: seedRange(300),
  players: [2, 3, 4],
  rounds: 10,
};

/** Ausgeglichene Variante C: je Minispiel etwa so viele Münzen wie bei jeder gegen jeden. */
export const BALANCED_TEAM_REWARDS: TeamRewards = { ...DEFAULT_TEAM_REWARDS, koop: [8, 6, 4, 2] };

function teamVariant(id: string, label: string, teamRewards: TeamRewards): Variant {
  return m4Variant(id, label, { economy: { teamRewards } }, { minigames: MIXED_SPECS });
}

export const TEAM_VARIANTS: readonly Variant[] = [
  m4Variant('A', 'nur jeder gegen jeden (Bezug)'),
  teamVariant(
    'B',
    'Startwert: Sieg 10, Niederlage 0, allein ×2, Koop 10/5/3/0',
    START_TEAM_REWARDS,
  ),
  teamVariant(
    'C',
    'ausgeglichen: Sieg 7, Niederlage 2, allein ×2, Koop 8/6/4/2',
    BALANCED_TEAM_REWARDS,
  ),
  teamVariant('D', 'ausgeglichen, allein ×3', { ...BALANCED_TEAM_REWARDS, soloWinFactor: 3 }),
  // Gewählt (DEFAULT_TEAM_REWARDS).
  teamVariant('E', 'ausgeglichen, Koop 12/9/6/3', DEFAULT_TEAM_REWARDS),
];

export interface TeamMetrics {
  readonly coinsPerMinigame: number;
  readonly teamShare: number;
  readonly finalCoins: number;
  readonly trophies: number;
  /** Wer zur Halbzeit führt, gewinnt (Anteil Partien). */
  readonly leaderWins: number;
  /** Wer zur Halbzeit hinten liegt, gewinnt noch (Anteil Partien). */
  readonly lastWins: number;
  readonly noTrophyShare: number;
}

export function teamMetrics(results: readonly SimulationResult[]): TeamMetrics {
  const economy = economyMetrics(results);
  const atHalf = (r: SimulationResult, which: 'first' | 'last'): boolean => {
    const mid = r.midRanking;
    if (!mid || mid.length === 0) return false;
    const place = which === 'first' ? 1 : Math.max(...mid.map((e) => e.place));
    const slots = mid.filter((e) => e.place === place).map((e) => e.slot);
    // Geteilte Plätze zählen nur, wenn genau eine Person dort steht (eindeutig).
    if (slots.length !== 1) return false;
    return r.ranking.some((e) => e.place === 1 && e.slot === slots[0]);
  };
  return {
    coinsPerMinigame: mean(results.map((r) => r.minigameCoins / Math.max(1, r.minigamesPlayed))),
    teamShare: mean(results.map((r) => r.teamMinigames / Math.max(1, r.minigamesPlayed))),
    finalCoins: economy.finalCoins,
    trophies: economy.trophiesPerGame,
    leaderWins: mean(results.map((r) => (atHalf(r, 'first') ? 1 : 0))),
    lastWins: mean(results.map((r) => (atHalf(r, 'last') ? 1 : 0))),
    noTrophyShare: economy.noTrophyShare,
  };
}

export function teamRewardsExperiment(
  setup: ExperimentSetup = TEAMS_SETUP,
  variants: readonly Variant[] = TEAM_VARIANTS,
): Table {
  const rows: string[][] = [];
  for (const players of setup.players) {
    for (const v of variants) {
      const m = teamMetrics(runVariant(v, players, setup));
      rows.push([
        `${v.id} ${v.label}`,
        String(players),
        num(m.coinsPerMinigame),
        pct(m.teamShare),
        num(m.finalCoins),
        num(m.trophies, 2),
        pct(m.leaderWins),
        pct(m.lastWins),
        pct(m.noTrophyShare),
      ]);
    }
  }
  return {
    title: `EXP-038 Münz-Regel Teams/Koop (${seedText(setup)}, ${String(setup.rounds)} Runden)`,
    headers: [
      'Variante',
      'Spieler',
      'Münzen je Minispiel',
      'Team-Anteil',
      'Münzen am Ende',
      'Trophäen/Partie',
      'Halbzeit-Führende gewinnt',
      'Halbzeit-Letzte gewinnt',
      'ohne Trophäe',
    ],
    rows,
  };
}
