/**
 * Persönlichkeiten der KI (CHAOS-186, ADR-020 §5): vier Spielstile als Gewichte **über** der
 * Stärke. Ein Stil ändert, was die KI tut, nicht wie gut sie spielt: Er verschiebt
 * Wahrscheinlichkeiten der Brett-KI (`BoardAiWeights`), bevorzugt bestimmte Items und gibt den
 * Minispiel-Bots eine Neigung (`MinigameBotStyle`: Risiko, Unfug). Reaktionschance, Reaktionszeit
 * und Denkpausen bleiben Sache der Stärke.
 *
 * Vergabe: zufällig beim Partiestart aus dem Strom `personality` (ADR-020 §8), ohne Doppelung,
 * solange es genug Stile gibt. Nicht wählbar, bei „Nochmal spielen“ mit neuem Seed neu gezogen.
 *
 * Die Namen stimmen mit `AI_PERSONALITIES` im Protokoll überein (Test in `apps/server`);
 * game-core hängt nicht vom Protokoll ab.
 */
import { NEUTRAL_BOT_STYLE, type MinigameBotStyle } from '@chaos-party/minigame-sdk';
import { createRng, shuffled } from '../rng.ts';
import type { ItemKind, Slot } from '../types.ts';
import type { SmartItemTuning } from './board.ts';
import { aiStreamSeed } from './seat.ts';
import { boardAiParams, type BoardAiParams, type BoardAiWeights } from './strength.ts';

/** Spielstile in fester Reihenfolge (wie `AI_PERSONALITIES` im Protokoll). */
export const BOARD_AI_PERSONALITIES = ['saboteur', 'sammler', 'draufgaenger', 'fuchs'] as const;
export type BoardAiPersonality = (typeof BOARD_AI_PERSONALITIES)[number];

/** Was ein Spielstil verändert. */
export interface BoardAiStyle {
  /** Zuschläge auf die Brett-Wahrscheinlichkeiten (nach der Stärke, auf [0, 1] begrenzt). */
  readonly weights: BoardAiWeights;
  /** Relative Vorliebe beim **zufälligen** Item-Einsatz (fehlt = 1). */
  readonly itemWeights: Readonly<Partial<Record<ItemKind, number>>>;
  /** Schwellen des gezielten Einsatzes (`smartItemOption`): wann sich ein Item für diesen Stil lohnt. */
  readonly smartItem: SmartItemTuning;
  /** Neigung der Minispiel-Bots (CHAOS-180), siehe `MinigameBotStyle`. */
  readonly minigame: MinigameBotStyle;
}

/**
 * Die vier Stile. Erster Stand, gemessen in EXP-044 (`personalityExperiment.ts`); die Grenze
 * für die Siegquote stellt CHAOS-183 ein.
 *
 * - **Saboteur:** setzt Items öfter ein und greift dabei zu Klau und Falle, klaut gezielt schon
 *   ab 3 Münzen, legt Fallen auch für weiter entfernte Verfolger; beklaut den Reichsten. In
 *   Minispielen öfter gegen die Führung.
 * - **Sammler:** meidet Fallen, nimmt lieber den Doppelwürfel als Klau oder Falle, klaut gezielt
 *   erst ab 10 Münzen und legt gezielt keine Fallen. In Minispielen vorsichtig (langsamer,
 *   weniger Fehlstarts).
 * - **Draufgänger:** Items sofort statt abwägen, Fallen sind ihm egal. In Minispielen schneller,
 *   aber mit mehr Fehlstarts.
 * - **Fuchs:** hebt Items für den passenden Moment auf: seltener zufällig, öfter gezielt, und
 *   gezielt erst bei lohnendem Ziel (Klau ab 9 Münzen, Doppelwürfel ab 6 Feldern). In
 *   Minispielen leicht vorsichtig, ein wenig hinterlistig.
 */
export const BOARD_AI_STYLES: Readonly<Record<BoardAiPersonality, BoardAiStyle>> = {
  saboteur: {
    weights: { itemUseChance: 0.25, richestTargetChance: 0.2 },
    itemWeights: { 'coin-steal': 4, trap: 4, 'double-dice': 1 },
    smartItem: { stealMinCoins: 3, trapMaxBehind: 18 },
    minigame: { risk: 0, mischief: 0.5 },
  },
  sammler: {
    weights: { itemUseChance: -0.05, avoidTrapChance: 0.35 },
    itemWeights: { 'double-dice': 4, 'coin-steal': 0.25, trap: 0.25 },
    smartItem: { stealMinCoins: 10, trapMaxBehind: 0 },
    minigame: { risk: -0.6, mischief: 0 },
  },
  draufgaenger: {
    weights: { itemUseChance: 0.3, smartItemChance: -0.3, avoidTrapChance: -0.4 },
    itemWeights: { 'double-dice': 2 },
    smartItem: {},
    minigame: { risk: 0.6, mischief: 0.1 },
  },
  fuchs: {
    weights: { itemUseChance: -0.2, smartItemChance: 0.2 },
    itemWeights: {},
    smartItem: { stealMinCoins: 9, doubleMinDistance: 6 },
    minigame: { risk: -0.2, mischief: 0.15 },
  },
};

/** Parameter der Brett-KI bei Stärke `s` mit Spielstil (ohne Stil wie `boardAiParams`). */
export function boardAiStyleParams(
  strength: number,
  personality?: BoardAiPersonality,
): BoardAiParams {
  if (personality === undefined) return boardAiParams(strength);
  const style = BOARD_AI_STYLES[personality];
  return {
    ...boardAiParams(strength, style.weights),
    itemWeights: style.itemWeights,
    smartItem: style.smartItem,
  };
}

/** Neigung der Minispiel-Bots eines Stils (ohne Stil neutral). */
export function minigameBotStyleOf(personality?: BoardAiPersonality): MinigameBotStyle {
  return personality === undefined ? NEUTRAL_BOT_STYLE : BOARD_AI_STYLES[personality].minigame;
}

/**
 * Stile für die KI-Plätze einer Partie: die Stile einmal aus dem Strom `personality` gemischt
 * (Seed aus Partie-Seed, ADR-020 §8), dann nach Platznummer verteilt. Ohne Doppelung bis vier
 * KI-Plätze; gleicher Seed und gleiche Plätze → gleiche Vergabe. Der Strom hängt nur am Seed
 * (Platz 1 als fester Anker), damit dieselbe Mischung unabhängig davon gilt, welche Plätze KI
 * sind.
 */
export function assignBoardAiPersonalities(
  gameSeed: number,
  aiSlots: readonly Slot[],
): ReadonlyMap<Slot, BoardAiPersonality> {
  const deck = shuffled(
    createRng(aiStreamSeed(gameSeed, 1, 'personality')),
    BOARD_AI_PERSONALITIES,
  );
  const slots = [...new Set(aiSlots)].sort((a, b) => a - b);
  return new Map(
    slots.map((slot, index) => [slot, deck[index % deck.length] ?? BOARD_AI_PERSONALITIES[0]]),
  );
}
