/**
 * Ein KI-Platz am Brett im Live-Spiel (CHAOS-181, ADR-020 §3/§6/§8): Antwort **und** Denkpause
 * je Prompt, mit eigenen Zufallsströmen je Platz und Zweck. Rein und deterministisch: Der Server
 * (`apps/server/src/aiSeat.ts`) ruft das auf, plant die Antwort mit der Denkpause und schickt sie
 * durch dieselben Prüfungen wie ein `choose` eines Menschen.
 *
 * Ströme (ADR-020 §8): `decision` für Entscheidungen, `delay` für Denkpausen. Beide hängen nur
 * von Partie-Seed und Platz ab. Eine Entscheidung mehr verschiebt also weder die Würfel der
 * Partie (game-core-RNG) noch die anderen KI-Plätze, und eine Denkpause mehr nicht die
 * Entscheidungen.
 */
import { createRng, type Rng } from '../rng.ts';
import type { BoardDefinition, GameState, Prompt, Slot } from '../types.ts';
import { decideBoardPrompt, type BoardDecisionPolicy } from './board.ts';
import type { BoardAiParams } from './strength.ts';
import { sampleDelay, sampleRange } from './timing.ts';

/** Wofür ein KI-Strom zieht; `personality` für die Vergabe der Spielstile beim Start (CHAOS-186). */
export const AI_STREAM_PURPOSES = ['decision', 'delay', 'personality'] as const;
export type AiStreamPurpose = (typeof AI_STREAM_PURPOSES)[number];

/** Seed eines KI-Stroms aus Partie-Seed, Platz und Zweck (Hash, getrennt vom Spielzufall). */
export function aiStreamSeed(gameSeed: number, slot: Slot, purpose: AiStreamPurpose): number {
  let h = (gameSeed ^ 0x2f6b_1d35) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
  h = (h + Math.imul(slot, 0x9e37_79b9)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0;
  h = (h + Math.imul(AI_STREAM_PURPOSES.indexOf(purpose) + 1, 0x85eb_ca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/** Zufallsströme eines KI-Platzes für eine Partie. */
export interface BoardAiSeat {
  readonly slot: Slot;
  readonly decision: Rng;
  readonly delay: Rng;
}

export function createBoardAiSeat(gameSeed: number, slot: Slot): BoardAiSeat {
  return {
    slot,
    decision: createRng(aiStreamSeed(gameSeed, slot, 'decision')),
    delay: createRng(aiStreamSeed(gameSeed, slot, 'delay')),
  };
}

/** Antwort eines KI-Platzes auf einen Prompt. */
export interface BoardAiAnswer {
  /** Gewählte Option; `null` = bewusst nicht antworten (Reaktion verpasst, Frist entscheidet). */
  readonly option: string | null;
  /** Denkpause ab dem Öffnen des Prompts (ms). */
  readonly delayMs: number;
}

/** Abstand zur Frist, den die KI bei Prompts mit Frist (außer Reaktion) wahrt. */
export const AI_DEADLINE_MARGIN_MS = 300;

export interface BoardAiPromptInput {
  readonly prompt: Prompt;
  /** Sichtbarer Spielstand (nur Öffentliches wird gelesen, siehe `board.ts`). */
  readonly state: GameState;
  readonly board: BoardDefinition;
  readonly params: BoardAiParams;
  /** Restzeit bis zur Frist (ms) oder `null` ohne Frist. */
  readonly remainingMs: number | null;
}

/**
 * Antwort mit Denkpause für einen Brett-Prompt:
 * - **Reaktion:** mit `reactionChance` reagieren (Schild, sonst Festhalten), Reaktionszeit aus
 *   `reactionDelayMs`. Liegt sie hinter der Frist, kommt die Antwort zu spät – wie bei einem
 *   Menschen; die KI nutzt die Frist nicht gezielt aus (ADR-020 §6).
 * - **Sonst:** Denkpause aus `decisionMs`, bei einer Frist höchstens bis kurz davor.
 */
export function answerBoardPrompt(seat: BoardAiSeat, input: BoardAiPromptInput): BoardAiAnswer {
  const { prompt, params } = input;
  const rng = seat.decision;
  if (prompt.kind === 'reaction') {
    const reacts = rng.next() < params.reactionChance;
    const delayMs = sampleDelay(seat.delay, params.reactionDelayMs);
    if (!reacts) return { option: null, delayMs };
    return { option: decide(input, rng, {}), delayMs };
  }
  let overrides: Partial<BoardDecisionPolicy> = {};
  if (prompt.kind === 'target') {
    overrides = { target: rng.next() < params.richestTargetChance ? 'richest' : 'random' };
  } else if (prompt.kind === 'trophy') {
    overrides = { buyTrophies: rng.next() < params.trophyBuyChance };
  }
  const option = decide(input, rng, overrides);
  let delayMs = sampleRange(seat.delay, params.decisionMs);
  if (input.remainingMs !== null) {
    delayMs = Math.max(0, Math.min(delayMs, input.remainingMs - AI_DEADLINE_MARGIN_MS));
  }
  return { option, delayMs };
}

/** Pause bis „Bereit“ in der Minispiel-Anleitung (CHAOS-214). */
export function boardAiReadyDelay(seat: BoardAiSeat, params: BoardAiParams): number {
  return sampleRange(seat.delay, params.readyMs);
}

function decide(
  input: BoardAiPromptInput,
  rng: Rng,
  overrides: Partial<BoardDecisionPolicy>,
): string {
  const { params } = input;
  const policy: BoardDecisionPolicy = {
    itemUseChance: params.itemUseChance,
    smartItemChance: params.smartItemChance,
    ...(params.itemWeights === undefined ? {} : { itemWeights: params.itemWeights }),
    ...(params.smartItem === undefined ? {} : { smartItem: params.smartItem }),
    buyTrophies: true,
    target: 'richest',
    trophyPathChance: params.trophyPathChance,
    avoidTrapChance: params.avoidTrapChance,
    ...overrides,
  };
  return decideBoardPrompt(input.prompt, input.state, input.board, policy, rng);
}
