/**
 * Stärke der Brett-KI (CHAOS-181, ADR-020 §4): eine Zahl `s` von 0 (leicht) bis 1 (schwer).
 * Alle Parameter liegen als benannte Eckwerte für leicht, mittel und schwer vor und werden
 * dazwischen stückweise linear interpoliert. So braucht die dynamische Stärke (CHAOS-187) keine
 * eigene Logik: Sie setzt nur `s`.
 *
 * Die Eckwerte sind ein begründeter erster Stand (Reaktionszeiten aus EXP-004: schwer ≈
 * fokussiert, mittel ≈ typisch, leicht ≈ abgelenkt). Die endgültigen Werte stellt das
 * Stärke-Experiment CHAOS-183 ein.
 */
import { BOT_LEVEL_STRENGTH, clampStrength } from '@chaos-party/minigame-sdk';
import type { ItemKind } from '../types.ts';
import type { SmartItemTuning } from './board.ts';
import type { LogNormalMs, MsRange } from './timing.ts';

/** Stärke-Wahl der Lobby (wie `AiStrength` im Protokoll). */
export type BoardAiStrength = 'leicht' | 'mittel' | 'schwer' | 'dynamisch';

/** Wahrscheinlichkeiten der Brett-KI (je Entscheidung gezogen). */
export interface BoardAiChances {
  /** Ein Item zufällig einsetzen, wenn nicht gezielt entschieden wird. */
  readonly itemUseChance: number;
  /** Item-Einsatz nach Lage (`smartItemOption`): Klau bei reichem Ziel, sonst aufheben … */
  readonly smartItemChance: number;
  /** Beim Münzklau den reichsten Mitspieler wählen (sonst zufällig). */
  readonly richestTargetChance: number;
  /** Eine bezahlbare Trophäe auch kaufen. */
  readonly trophyBuyChance: number;
  /** An Gabeln den Weg zur nächsten Trophäe nehmen. */
  readonly trophyPathChance: number;
  /** An Gabeln sichtbare fremde Fallen meiden. */
  readonly avoidTrapChance: number;
  /** Im Reaktionsfenster überhaupt reagieren (sonst verpasst). */
  readonly reactionChance: number;
}

export type BoardAiChance = keyof BoardAiChances;

/** Alle Parameter der Brett-KI bei einer Stärke. */
export interface BoardAiParams extends BoardAiChances {
  /** Reaktionszeit im Reaktionsfenster (Klau, Schild); zu spät = `stale-prompt` wie bei Menschen. */
  readonly reactionDelayMs: LogNormalMs;
  /** Denkpause für Würfeln, Weg, Item, Trophäe und Ziel (ADR-020 §6: etwa 0,8–2,5 s). */
  readonly decisionMs: MsRange;
  /** Pause bis „Bereit“ in der Minispiel-Anleitung (Lesen der Anleitung). */
  readonly readyMs: MsRange;
  /** Vorliebe beim zufälligen Item-Einsatz (Spielstil, CHAOS-186); fehlt = gleichverteilt. */
  readonly itemWeights?: Readonly<Partial<Record<ItemKind, number>>>;
  /** Schwellen des gezielten Item-Einsatzes (Spielstil, CHAOS-186); fehlt = Standard. */
  readonly smartItem?: SmartItemTuning;
}

/**
 * Gewichte über der Stärke (Haken für Persönlichkeiten, CHAOS-186): Zuschlag je
 * Wahrscheinlichkeit, nach der Interpolation addiert und auf [0, 1] begrenzt.
 */
export type BoardAiWeights = Readonly<Partial<Record<BoardAiChance, number>>>;

/** Eckwert „leicht“ (`s = 0`): zufälliger, verpasst Reaktionen öfter, langsamer. */
export const BOARD_AI_LEICHT: BoardAiParams = {
  itemUseChance: 0.4,
  smartItemChance: 0,
  richestTargetChance: 0.3,
  trophyBuyChance: 0.85,
  trophyPathChance: 0.3,
  avoidTrapChance: 0.1,
  reactionChance: 0.6,
  // EXP-004 „abgelenkt“
  reactionDelayMs: { medianMs: 2300, sigma: 0.45, minMs: 800 },
  decisionMs: [1000, 2500],
  readyMs: [1500, 3500],
};

/** Eckwert „mittel“ (`s = 0,5`, Standard der Lobby). */
export const BOARD_AI_MITTEL: BoardAiParams = {
  itemUseChance: 0.5,
  smartItemChance: 0.45,
  richestTargetChance: 0.7,
  trophyBuyChance: 1,
  trophyPathChance: 0.6,
  avoidTrapChance: 0.5,
  reactionChance: 0.75,
  // EXP-004 „typisch“
  reactionDelayMs: { medianMs: 1500, sigma: 0.4, minMs: 600 },
  decisionMs: [900, 2200],
  readyMs: [1200, 3000],
};

/** Eckwert „schwer“ (`s = 1`): nutzt Items gezielt, weicht Fallen aus, reagiert meist – nie immer. */
export const BOARD_AI_SCHWER: BoardAiParams = {
  itemUseChance: 0.6,
  smartItemChance: 0.85,
  richestTargetChance: 1,
  trophyBuyChance: 1,
  trophyPathChance: 0.9,
  avoidTrapChance: 0.9,
  reactionChance: 0.9,
  // EXP-004 „fokussiert“; Untergrenze 500 ms (ADR-020 §4)
  reactionDelayMs: { medianMs: 1100, sigma: 0.3, minMs: 500 },
  decisionMs: [800, 1800],
  readyMs: [1000, 2500],
};

const CHANCES: readonly BoardAiChance[] = [
  'itemUseChance',
  'smartItemChance',
  'richestTargetChance',
  'trophyBuyChance',
  'trophyPathChance',
  'avoidTrapChance',
  'reactionChance',
];

/** `s` einer Lobby-Wahl. „Dynamisch“ startet bei mittel (ADR-020 §4); CHAOS-187 bewegt es. */
export function boardAiStrengthValue(strength: BoardAiStrength): number {
  return strength === 'dynamisch' ? BOT_LEVEL_STRENGTH.mittel : BOT_LEVEL_STRENGTH[strength];
}

/** Stückweise linear: leicht → mittel für `s` ≤ 0,5, mittel → schwer darüber. */
function lerp3(leicht: number, mittel: number, schwer: number, s: number): number {
  return s <= 0.5 ? leicht + (mittel - leicht) * (s * 2) : mittel + (schwer - mittel) * (s * 2 - 1);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/** Parameter der Brett-KI bei Stärke `s` (begrenzt auf [0, 1]), optional mit Gewichten. */
export function boardAiParams(strength: number, weights: BoardAiWeights = {}): BoardAiParams {
  const s = clampStrength(strength);
  const [l, m, h] = [BOARD_AI_LEICHT, BOARD_AI_MITTEL, BOARD_AI_SCHWER];
  const at = (pick: (p: BoardAiParams) => number): number => lerp3(pick(l), pick(m), pick(h), s);
  const ms = (pick: (p: BoardAiParams) => number): number => Math.round(at(pick));
  const chances = Object.fromEntries(
    CHANCES.map((key) => [key, clamp01(at((p) => p[key]) + (weights[key] ?? 0))]),
  ) as unknown as BoardAiChances;
  return {
    ...chances,
    reactionDelayMs: {
      medianMs: ms((p) => p.reactionDelayMs.medianMs),
      sigma: at((p) => p.reactionDelayMs.sigma),
      minMs: ms((p) => p.reactionDelayMs.minMs),
    },
    decisionMs: [ms((p) => p.decisionMs[0]), ms((p) => p.decisionMs[1])],
    readyMs: [ms((p) => p.readyMs[0]), ms((p) => p.readyMs[1])],
  };
}
