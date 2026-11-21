/**
 * Team-Ansage und Team-Ergebnis am PC (CHAOS-89), rein und testbar. Die Aufstellung kommt fertig
 * vom Server (`BoardView.minigame.teams`); hier wird sie nur in Text, Symbol und Farbe übersetzt.
 * Teams sind nie nur an der Farbe erkennbar: Jede Gruppe hat Name und Symbol.
 */
import { KOOP_MAX_TIER, TEAM_MARKS } from '@chaos-party/minigame-sdk';
import type { BoardView, MinigameTeamsInfo, SlotNumber } from '@chaos-party/protocol';
import { playerName } from '../board/texts.ts';
import { joinNames } from './results.ts';

export interface TeamGroup {
  readonly label: string;
  readonly symbol: string;
  readonly color: string;
  readonly slots: readonly SlotNumber[];
}

export interface TeamLineup {
  readonly layout: MinigameTeamsInfo['layout'];
  /** „2 gegen 2“, „Einer gegen alle“, „Alle zusammen“ … */
  readonly headline: string;
  /** Zusatz, etwa der Vorteil der Einzelperson zu dritt. */
  readonly note: string | null;
  readonly groups: readonly TeamGroup[];
}

const KOOP_MARK = { symbol: '♥', color: '#e85d75' } as const;

const HEADLINES: Record<MinigameTeamsInfo['layout'], string> = {
  '2v2': '2 gegen 2',
  '1v3': 'Einer gegen alle',
  '1v2': 'Einer gegen zwei',
  '1v1': 'Eins gegen eins',
  koop: 'Alle zusammen',
};

/** Ansage vor der Anleitung oder `null` bei jeder gegen jeden. */
export function teamLineup(view: BoardView): TeamLineup | null {
  const teams = view.minigame?.teams;
  if (!teams) return null;
  const solo = teams.layout === '1v3' || teams.layout === '1v2';
  const groups = teams.teams.map((slots, index): TeamGroup => {
    if (teams.layout === 'koop') {
      return { label: 'Alle zusammen', ...KOOP_MARK, slots: [...slots] };
    }
    const mark = TEAM_MARKS[index] ?? TEAM_MARKS[0];
    const label =
      teams.layout === '2v2'
        ? `Team ${mark.name}`
        : solo && index === 0
          ? 'Allein'
          : solo
            ? 'Die anderen'
            : slots[0] === undefined
              ? ''
              : playerName(view, slots[0]);
    return { label, symbol: mark.symbol, color: mark.color, slots: [...slots] };
  });
  const soloSlot = solo ? teams.teams[0]?.[0] : undefined;
  const note =
    teams.soloAdvantage && soloSlot !== undefined
      ? `${playerName(view, soloSlot)} spielt allein und hat einen Vorteil.`
      : null;
  return { layout: teams.layout, headline: HEADLINES[teams.layout], note, groups };
}

const KOOP_HEADLINES = [
  'Nicht geschafft – Stufe 0 von 3',
  'Knapp geschafft – Stufe 1 von 3',
  'Gut geschafft – Stufe 2 von 3',
  'Glänzend – Stufe 3 von 3',
] as const;

/** Überschrift der Ergebniskarte bei Teams bzw. Koop oder `null` (jeder gegen jeden). */
export function teamHeadline(view: BoardView): string | null {
  const minigame = view.minigame;
  const teams = minigame?.teams;
  const outcome = minigame?.outcome;
  if (!teams || !outcome) return null;
  if (outcome.kind === 'koop') {
    return KOOP_HEADLINES[Math.min(KOOP_MAX_TIER, outcome.tier)] ?? KOOP_HEADLINES[0];
  }
  if (outcome.winner === null) return 'Unentschieden!';
  const winners = teams.teams[outcome.winner] ?? [];
  const names = winners.map((slot) => playerName(view, slot));
  if (teams.layout === '2v2') {
    const mark = TEAM_MARKS[outcome.winner] ?? TEAM_MARKS[0];
    return `${mark.symbol} Team ${mark.name} gewinnt: ${joinNames(names)}!`;
  }
  if (winners.length === 1) {
    return teams.layout === '1v1'
      ? `${names[0] ?? ''} gewinnt!`
      : `${names[0] ?? ''} gewinnt allein!`;
  }
  return `${joinNames(names)} gewinnen gemeinsam!`;
}
