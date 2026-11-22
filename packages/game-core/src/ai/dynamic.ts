/**
 * Dynamische KI-Stärke (CHAOS-187, ADR-020 §4): Die Lobby-Wahl „dynamisch“ startet bei
 * `s = 0,5` (mittel) und gleitet danach **nur am Rundenende** stufenlos zwischen leicht (0) und
 * schwer (1), je nach Abstand der KI zum Median der Menschen.
 *
 * Maß in fester Reihenfolge (wie die Wertung, ADR-015):
 * 1. **Trophäen:** Ab einer halben Trophäe Abstand (Median zweier Menschen) entscheidet allein sie;
 *    eine ganze Trophäe ist ein voller Schritt.
 * 2. **Münzen:** Bei gleichen Trophäen zählt der Münzabstand ab {@link DYNAMIC_COIN_DEAD_ZONE},
 *    voller Schritt ab {@link DYNAMIC_COIN_FULL_GAP}.
 * 3. **Letztes Minispiel:** Sonst der Platz der KI gegen den Median-Platz der Menschen, höchstens ein
 *    halber Schritt.
 *
 * Liegt die KI vorn, sinkt `s`; liegt sie hinten, steigt `s`. Ein Schritt ist höchstens
 * {@link DYNAMIC_MAX_STEP} (eine halbe Stufe), damit kein Gummiband-Gefühl entsteht. Die Regel liest
 * nur den öffentlichen Spielstand und ist damit deterministisch; sie zieht keinen Zufall.
 *
 * Ob das zusammen mit Aufholhilfe (EXP-022) und Rückenwind (CHAOS-125) zu viel wird, misst das
 * Stärke-Experiment CHAOS-183; die Werte hier sind ein begründeter erster Stand.
 */
import { BOT_LEVEL_STRENGTH, clampStrength } from '@chaos-party/minigame-sdk';
import type { GameState, Slot } from '../types.ts';

/** Start der dynamischen Stärke: mittel (ADR-020 §4). */
export const DYNAMIC_STRENGTH_START = BOT_LEVEL_STRENGTH.mittel;
/** Größter Schritt je Rundenende: eine halbe Stufe (ADR-020 §4). */
export const DYNAMIC_MAX_STEP = 0.25;
/** Ab so viel Trophäen-Abstand zählen nur noch Trophäen (Median zweier Menschen: halbe Trophäe). */
export const DYNAMIC_TROPHY_MIN_GAP = 0.5;
/** Kleinere Münzabstände gelten als gleichauf (dann entscheidet das letzte Minispiel). */
export const DYNAMIC_COIN_DEAD_ZONE = 3;
/** Ab diesem Münzabstand ein voller Schritt (etwa die Hälfte eines Trophäenpreises). */
export const DYNAMIC_COIN_FULL_GAP = 10;
/** Anteil eines vollen Schritts je Platz Abstand im letzten Minispiel. */
export const DYNAMIC_PLACE_WEIGHT = 0.25;
/** Höchstens so viel eines vollen Schritts aus dem letzten Minispiel allein. */
export const DYNAMIC_PLACE_MAX_LEAD = 0.5;

/**
 * Abstand einer KI zum Median der Menschen nach einer Runde. Positiv = KI liegt vorn.
 * `placeGap` ist `null`, wenn das Minispiel kein Ergebnis hatte (Abbruch, Platzhalter ohne
 * Platz für die KI oder die Menschen).
 */
export interface DynamicStanding {
  readonly trophyGap: number;
  readonly coinGap: number;
  /** Median-Platz der Menschen minus Platz der KI (positiv = KI besser platziert). */
  readonly placeGap: number | null;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[mid] ?? 0)
    : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

function roundMilli(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function clamp(value: number, limit: number): number {
  return Math.max(-limit, Math.min(limit, value));
}

/**
 * Abstand der KI `aiSlot` zum Median der Menschen `humanSlots` im Stand `state` (Trophäen und
 * Münzen jetzt, Plätze aus dem Minispiel der Runde). `null`, wenn KI oder Menschen fehlen.
 */
export function dynamicStanding(
  state: Pick<GameState, 'players' | 'minigame'>,
  aiSlot: Slot,
  humanSlots: readonly Slot[],
): DynamicStanding | null {
  const ai = state.players.find((player) => player.slot === aiSlot);
  const humans = state.players.filter((player) => humanSlots.includes(player.slot));
  if (!ai || humans.length === 0) return null;
  const placements = state.minigame?.aborted === true ? null : state.minigame?.placements;
  const placeOf = (slot: Slot): number | undefined =>
    placements?.find((entry) => entry.slot === slot)?.place;
  const aiPlace = placeOf(ai.slot);
  const humanPlaces = humans.flatMap((human) => {
    const place = placeOf(human.slot);
    return place === undefined ? [] : [place];
  });
  return {
    trophyGap: ai.trophies - median(humans.map((human) => human.trophies)),
    coinGap: ai.coins - median(humans.map((human) => human.coins)),
    placeGap:
      aiPlace === undefined || humanPlaces.length === 0 ? null : median(humanPlaces) - aiPlace,
  };
}

/**
 * Vorsprung der KI als Zahl von −1 (weit hinten) bis 1 (weit vorn) nach der Reihenfolge
 * Trophäen → Münzen → letztes Minispiel.
 */
export function dynamicLead(standing: DynamicStanding): number {
  if (Math.abs(standing.trophyGap) >= DYNAMIC_TROPHY_MIN_GAP) return clamp(standing.trophyGap, 1);
  if (Math.abs(standing.coinGap) >= DYNAMIC_COIN_DEAD_ZONE) {
    return clamp(standing.coinGap / DYNAMIC_COIN_FULL_GAP, 1);
  }
  if (standing.placeGap === null || standing.placeGap === 0) return 0;
  return clamp(standing.placeGap * DYNAMIC_PLACE_WEIGHT, DYNAMIC_PLACE_MAX_LEAD);
}

/**
 * Nächste Stärke nach einem Rundenende: `s − Vorsprung · 0,25`, begrenzt auf [0, 1] und auf
 * Tausendstel gerundet (keine Rundungsdrift über viele Runden). Ohne Maß bleibt `s`.
 */
export function nextDynamicStrength(current: number, standing: DynamicStanding | null): number {
  const s = clampStrength(current);
  if (standing === null) return s;
  const step = roundMilli(dynamicLead(standing) * DYNAMIC_MAX_STEP);
  return roundMilli(clampStrength(s - step));
}
