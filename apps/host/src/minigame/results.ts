/**
 * Anzeigedaten der Minispiel-Ergebnisse (M3, CHAOS-26). Quelle ist immer der autoritative
 * Stand des Servers (`view.minigame.placements`), nie der lokale Runner. Rein, unit-getestet.
 */
import type { MinigameInfo, MinigameResult } from '@chaos-party/minigame-sdk';
import {
  PLAYER_SLOTS,
  type BoardView,
  type ItemKindName,
  type SlotNumber,
} from '@chaos-party/protocol';
import { playerName } from '../board/texts.ts';
import type { MinigameResultPayload } from '../net/hostConnection.ts';
import { characterName } from './plan.ts';
import { teamHeadline } from './teams.ts';

export interface ResultRow {
  readonly slot: SlotNumber;
  readonly place: number;
  readonly score: number;
  /** „7 Pumpstöße“ */
  readonly scoreText: string;
  readonly name: string;
  readonly character: string;
  readonly color: string;
  readonly symbol: string;
  /**
   * Gewonnene Münzen: aus `view.minigame.rewards` (v4, CHAOS-55 – vollständig auch nach dem
   * Neuladen), sonst aus den Server-Ereignissen; `null`, wenn unbekannt.
   */
  readonly coins: number | null;
  /**
   * Items aus dem Ergebnis (Trostpreis für den letzten Platz, CHAOS-51/EXP-019), aus
   * `view.minigame.rewards`; leer, wenn keine.
   */
  readonly items: readonly ItemKindName[];
  /** Teilt sich den Platz mit mindestens einem anderen Spieler. */
  readonly tied: boolean;
}

export interface ResultsDisplay {
  readonly aborted: boolean;
  /** Überschrift: „Blau gewinnt!“, „Gleichstand: Blau und Orange!“, Abbruch-Hinweis. */
  readonly headline: string;
  readonly rows: readonly ResultRow[];
  readonly highlights: readonly string[];
  /** Übungsrunde aus der Galerie (CHAOS-87): keine Münzen, danach zurück in die Lobby. */
  readonly practice: boolean;
}

/** Zeile unter dem Ergebnis einer Übungsrunde (CHAOS-87). */
export const PRACTICE_NOTE = 'Übungsrunde – keine Münzen. Daumen am Handy, dann zurück zur Lobby.';

export const ABORTED_TEXT = 'Minispiel abgebrochen – keine Münzen';

/** Punkte mit Einheit aus dem Steckbrief („7 Pumpstöße“). */
export function scoreText(score: number, unit: string): string {
  return `${String(score)} ${unit}`;
}

/** Namen als Aufzählung: „A“, „A und B“, „A, B und C“. */
export function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} und ${names[names.length - 1] ?? ''}`;
}

export function resultsDisplay(
  view: BoardView,
  info: Pick<MinigameInfo, 'scoreUnit'>,
  rewards: Readonly<Partial<Record<SlotNumber, number>>> | null,
): ResultsDisplay {
  const minigame = view.minigame;
  const placements = minigame?.placements ?? [];
  const aborted = minigame?.aborted === true || placements.length === 0;
  const viewRewards = minigame?.rewards ?? null;
  const practice = view.practice === true;
  const coinsOf = (slot: SlotNumber): number | null =>
    practice
      ? null
      : viewRewards !== null
        ? (viewRewards.find((entry) => entry.slot === slot)?.coins ?? 0)
        : (rewards?.[slot] ?? null);
  const rows: ResultRow[] = [...placements]
    .sort((a, b) => a.place - b.place || a.slot - b.slot)
    .map((entry) => ({
      slot: entry.slot,
      place: entry.place,
      score: entry.score,
      scoreText: scoreText(entry.score, info.scoreUnit),
      name: playerName(view, entry.slot),
      character: characterName(view, entry.slot),
      color: PLAYER_SLOTS[entry.slot].color,
      symbol: PLAYER_SLOTS[entry.slot].symbol,
      coins: coinsOf(entry.slot),
      items: [...(viewRewards?.find((reward) => reward.slot === entry.slot)?.items ?? [])],
      tied: placements.some((other) => other.slot !== entry.slot && other.place === entry.place),
    }));
  const winners = rows.filter((row) => row.place === 1).map((row) => row.name);
  let headline: string;
  if (aborted) headline = practice ? 'Minispiel abgebrochen' : ABORTED_TEXT;
  else if (winners.length === 1) headline = `${winners[0] ?? ''} gewinnt!`;
  else if (winners.length === rows.length) headline = `Gleichstand: alle auf Platz 1!`;
  else headline = `Gleichstand: ${joinNames(winners)}!`;
  // CHAOS-89: bei Teams bzw. Koop zählt der Ausgang, nicht der beste Einzelplatz.
  const team = aborted ? null : teamHeadline(view);
  if (team !== null) headline = team;
  return {
    aborted,
    headline,
    rows: aborted ? [] : rows,
    highlights: aborted ? [] : [...(minigame?.highlights ?? [])],
    practice,
  };
}

/** `minigame-result` für den Server aus dem Ergebnis des Runners (Höhepunkte bereinigt). */
export function resultPayload(result: MinigameResult, round: number): MinigameResultPayload {
  const highlights = sanitizeHighlights(result.highlights);
  return {
    minigameId: result.minigameId,
    round,
    placements: result.placements.map((entry) => ({
      slot: entry.slot,
      place: entry.place,
      score: entry.score,
    })),
    ...(highlights.length > 0 ? { highlights } : {}),
    // CHAOS-89: Siegerteam bzw. Koop-Stufe; ohne sie lehnt der Server ein Team-Ergebnis ab.
    ...(result.outcome ? { outcome: { ...result.outcome } } : {}),
  };
}

/**
 * Höhepunkte protokollfest machen: getrimmt, ohne Steuerzeichen, 1–64 Zeichen, höchstens 4.
 * Der Server würde sonst die ganze `minigame-result`-Nachricht als ungültig verwerfen.
 */
export function sanitizeHighlights(lines: readonly string[] | undefined): string[] {
  const cleaned: string[] = [];
  for (const line of lines ?? []) {
    let visible = '';
    for (const char of line) if (!isControl(char.codePointAt(0) ?? 0)) visible += char;
    const text = visible.trim().slice(0, 64).trim();
    if (text.length > 0) cleaned.push(text);
    if (cleaned.length === 4) break;
  }
  return cleaned;
}

function isControl(code: number): boolean {
  return (
    code <= 0x1f ||
    (code >= 0x7f && code <= 0x9f) ||
    (code >= 0x202a && code <= 0x202e) ||
    (code >= 0x2066 && code <= 0x2069)
  );
}
