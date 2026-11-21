/**
 * Spielformen mit Teams und Koop (CHAOS-89, README §3 und §7 Nr. 2): rein, ohne Babylon.
 *
 * Ein Minispiel erklärt seine Spielform im Steckbrief (`MinigameInfo.teamPlay`). game-core teilt
 * beim Start die Teams ein (`planTeams`) und legt sie in den Minispiel-Zustand; Host, Controller
 * und das Minispiel bekommen genau diese Aufstellung und rechnen sie nicht neu aus. Das Ergebnis
 * nennt zusätzlich zu den Plätzen den Ausgang (`MinigameOutcome`): Siegerteam bzw. Koop-Stufe.
 */
import type { Slot } from './info.ts';

/** Spielformen mit Teams bzw. Koop (`ffa` ist der Normalfall ohne `teamPlay`). */
export const TEAM_FORMS = ['1v3', '2v2', 'koop'] as const;
export type TeamForm = (typeof TEAM_FORMS)[number];

/**
 * Wer kommt in welches Team (nur `1v3`/`2v2`):
 * - `random`: per Seed.
 * - `last-vs-all`: bei 1 gegen alle ist die Person auf dem letzten Brett-Platz allein (Chance
 *   aufzuholen); bei 2 gegen 2 wie `board`.
 * - `board`: nach Brett-Stand; bei 1 gegen alle ist die Spitze allein (alle jagen die Spitze),
 *   bei 2 gegen 2 spielen Platz 1 + 4 gegen Platz 2 + 3.
 */
export const TEAM_ASSIGNMENTS = ['random', 'last-vs-all', 'board'] as const;
export type TeamAssignment = (typeof TEAM_ASSIGNMENTS)[number];

/** Spielform im Steckbrief eines Minispiels. */
export interface MinigameTeamPlay {
  readonly form: TeamForm;
  /** Nur `1v3`/`2v2`; fehlt = `random`. Bei `koop` ohne Bedeutung. */
  readonly assignment?: TeamAssignment;
  /**
   * Ersatz zu dritt: Teams werden 1 gegen 2, der Einzelne bekommt einen Vorteil
   * (`MinigameTeams.soloAdvantage`; welchen, entscheidet das Minispiel). Bei `koop` heißt
   * `true` einfach „spielbar zu dritt“. `false` = das Spiel braucht mehr Leute.
   */
  readonly withThree: boolean;
  /** Ersatz zu zweit: 1 gegen 1 (bei `koop`: zu zweit spielbar). `false` = nicht zu zweit. */
  readonly withTwo: boolean;
}

/**
 * Tatsächliche Aufstellung einer Runde. `1v2`/`1v1` sind die Ersatzformen für 3 bzw. 2 Personen.
 */
export type TeamLayout = '1v3' | '2v2' | '1v2' | '1v1' | 'koop';

export interface MinigameTeams {
  readonly form: TeamForm;
  readonly layout: TeamLayout;
  /**
   * Teams mit Slots (je Team aufsteigend). Bei `1v3`/`1v2`/`1v1` ist Team 0 der oder die
   * Einzelne. Bei `koop` genau ein Team mit allen.
   */
  readonly teams: readonly (readonly Slot[])[];
  /** Zu dritt (1 gegen 2): Die Einzelperson bekommt einen Vorteil im Spiel. */
  readonly soloAdvantage: boolean;
}

/** Höchste Koop-Stufe: 0 = gescheitert, 1 = knapp, 2 = gut, 3 = glänzend. */
export const KOOP_MAX_TIER = 3;

/**
 * Ausgang eines Minispiels mit Teams bzw. Koop (fehlt bei `ffa`):
 * - `teams`: Index des Siegerteams in `MinigameTeams.teams` oder `null` bei Unentschieden.
 * - `koop`: erreichte Stufe 0 … `KOOP_MAX_TIER`.
 */
export type MinigameOutcome =
  | { readonly kind: 'teams'; readonly winner: number | null }
  | { readonly kind: 'koop'; readonly tier: number };

/** Kleinste Spielerzahl, mit der die Spielform läuft (für Steckbrief und Rotation). */
export function teamPlayMinPlayers(teamPlay: MinigameTeamPlay): number {
  if (teamPlay.withTwo) return 2;
  return teamPlay.withThree ? 3 : 4;
}

/**
 * Teams einteilen. `players` in Spieler-Reihenfolge, `standing` = dieselben Slots nach
 * Brett-Stand (beste zuerst; Gleichstand beliebig, aber deterministisch). `pick(n)` liefert eine
 * Zufallszahl in [0, n) und wird nur bei Zufallszuteilung aufgerufen – so bleibt der Seed bei
 * Brett-Zuteilung unberührt. Liefert `null`, wenn die Spielform die Spielerzahl nicht kann.
 */
export function planTeams(
  teamPlay: MinigameTeamPlay,
  players: readonly Slot[],
  standing: readonly Slot[],
  pick: (n: number) => number,
): MinigameTeams | null {
  const count = players.length;
  if (count < teamPlayMinPlayers(teamPlay) || count > 4) return null;
  const sorted = (slots: readonly Slot[]): Slot[] => [...slots].sort((a, b) => a - b);
  if (teamPlay.form === 'koop') {
    return { form: 'koop', layout: 'koop', teams: [sorted(players)], soloAdvantage: false };
  }
  const assignment = teamPlay.assignment ?? 'random';
  const order = assignment === 'random' ? shuffle(players, pick) : [...standing];
  if (count === 2) {
    // 1 gegen 1: Team 0 ist bei Brett-Zuteilung die Spitze bzw. (letzter gegen alle) der Letzte.
    const solo = assignment === 'last-vs-all' ? order[1] : order[0];
    const other = players.find((slot) => slot !== solo);
    if (solo === undefined || other === undefined) return null;
    return { form: teamPlay.form, layout: '1v1', teams: [[solo], [other]], soloAdvantage: false };
  }
  if (teamPlay.form === '2v2' && count === 4) {
    const [first, second, third, fourth] = order as [Slot, Slot, Slot, Slot];
    const teams =
      assignment === 'random'
        ? [sorted([first, second]), sorted([third, fourth])]
        : [sorted([first, fourth]), sorted([second, third])];
    return { form: '2v2', layout: '2v2', teams, soloAdvantage: false };
  }
  // Einer gegen alle (1v3) bzw. Ersatz zu dritt (1v2, auch für 2v2).
  // Zufall und Brett-Stand: der Erste der Reihenfolge; „Letzter gegen alle“: der Letzte.
  const solo = assignment === 'last-vs-all' ? order[order.length - 1] : order[0];
  if (solo === undefined) return null;
  const rest = sorted(players.filter((slot) => slot !== solo));
  const layout: TeamLayout = count === 4 ? '1v3' : '1v2';
  return { form: teamPlay.form, layout, teams: [[solo], rest], soloAdvantage: count === 3 };
}

function shuffle(slots: readonly Slot[], pick: (n: number) => number): Slot[] {
  const result = [...slots];
  for (let i = result.length - 1; i > 0; i--) {
    const j = pick(i + 1);
    const a = result[i];
    const b = result[j];
    if (a === undefined || b === undefined) continue;
    result[i] = b;
    result[j] = a;
  }
  return result;
}

/** Team-Index eines Slots oder `-1`. */
export function teamOf(teams: MinigameTeams, slot: Slot): number {
  return teams.teams.findIndex((team) => team.includes(slot));
}

/**
 * Plätze aus einem Team-Ausgang: Siegerteam Platz 1, das andere Team dahinter (Platz =
 * Größe des Siegerteams + 1); Unentschieden = alle Platz 1. Punkte bleiben die eigenen
 * (Anzeige), die Reihenfolge innerhalb eines Platzes ist nach Punkten, dann Slot.
 */
export function teamPlacements(
  teams: MinigameTeams,
  winner: number | null,
  scores: readonly { readonly slot: Slot; readonly score: number }[],
  scoring: 'higher' | 'lower' = 'higher',
): { slot: Slot; place: number; score: number }[] {
  const winners = winner === null ? null : (teams.teams[winner] ?? []);
  const behind = (winners?.length ?? 0) + 1;
  const sign = scoring === 'higher' ? -1 : 1;
  return scores
    .map((entry) => ({
      slot: entry.slot,
      score: Math.round(entry.score),
      place: winners === null || winners.includes(entry.slot) ? 1 : behind,
    }))
    .sort((a, b) => a.place - b.place || sign * (a.score - b.score) || a.slot - b.slot);
}

export type TeamCheck = { readonly ok: true } | { readonly ok: false; readonly reason: string };

/** Prüft eine Aufstellung gegen die Teilnehmer (für Server-Zustand und Tests). */
export function checkTeams(teams: MinigameTeams, slots: readonly Slot[]): TeamCheck {
  const all = teams.teams.flat();
  if (all.length !== slots.length || new Set(all).size !== all.length) {
    return { ok: false, reason: 'Teams decken die Teilnehmer nicht genau ab' };
  }
  if (all.some((slot) => !slots.includes(slot)))
    return { ok: false, reason: 'Fremder Slot im Team' };
  if (teams.teams.some((team) => team.length === 0)) return { ok: false, reason: 'Leeres Team' };
  const expectedTeams = teams.layout === 'koop' ? 1 : 2;
  if (teams.teams.length !== expectedTeams) return { ok: false, reason: 'Falsche Zahl an Teams' };
  return { ok: true };
}

/**
 * Erkennungszeichen der Teams für Host und Controller (CHAOS-89): Name, Symbol und Farbe, damit
 * Teams nie nur an der Farbe unterscheidbar sind (M1-Regel „Farbe + Symbol“). Index wie
 * `MinigameTeams.teams`; bei Einzelperson gegen den Rest steht Team 0 für die Einzelperson.
 */
export const TEAM_MARKS = [
  { name: 'Sonne', symbol: '☀', color: '#f2a33a' },
  { name: 'Mond', symbol: '☾', color: '#5b7bd5' },
] as const;

/** Kurzer Name eines Teams in seiner Aufstellung („Allein“, „Team Sonne“, „Alle zusammen“). */
export function teamLabel(teams: MinigameTeams, index: number): string {
  if (teams.layout === 'koop') return 'Alle zusammen';
  if (teams.layout !== '2v2' && index === 0) return 'Allein';
  if (teams.layout !== '2v2') return 'Die anderen';
  return `Team ${TEAM_MARKS[index]?.name ?? String(index + 1)}`;
}
