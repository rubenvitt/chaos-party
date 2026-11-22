import { describe, expect, it } from 'vitest';
import {
  BOARD_AI_LEICHT,
  BOARD_AI_MITTEL,
  BOARD_AI_SCHWER,
  boardAiParams,
  boardAiStrengthValue,
  type BoardAiChance,
} from './strength.ts';

const CHANCES: readonly BoardAiChance[] = [
  'itemUseChance',
  'smartItemChance',
  'richestTargetChance',
  'trophyBuyChance',
  'trophyPathChance',
  'avoidTrapChance',
  'reactionChance',
];

describe('Stärke der Brett-KI (CHAOS-181, ADR-020 §4)', () => {
  it('trifft die Eckwerte bei leicht, mittel und schwer', () => {
    expect(boardAiParams(0)).toEqual(BOARD_AI_LEICHT);
    expect(boardAiParams(0.5)).toEqual(BOARD_AI_MITTEL);
    expect(boardAiParams(1)).toEqual(BOARD_AI_SCHWER);
  });

  it('Lobby-Wahl → s; „dynamisch“ startet bei mittel', () => {
    expect(boardAiStrengthValue('leicht')).toBe(0);
    expect(boardAiStrengthValue('mittel')).toBe(0.5);
    expect(boardAiStrengthValue('schwer')).toBe(1);
    expect(boardAiStrengthValue('dynamisch')).toBe(0.5);
  });

  it('stärker heißt nie schlechter: Chancen steigen, Zeiten sinken mit s', () => {
    let previous = boardAiParams(0);
    for (let i = 1; i <= 20; i++) {
      const next = boardAiParams(i / 20);
      for (const key of CHANCES) expect(next[key]).toBeGreaterThanOrEqual(previous[key]);
      expect(next.reactionDelayMs.medianMs).toBeLessThanOrEqual(previous.reactionDelayMs.medianMs);
      expect(next.decisionMs[1]).toBeLessThanOrEqual(previous.decisionMs[1]);
      previous = next;
    }
  });

  it('nie unfehlbar: auch schwer verpasst Reaktionen und reagiert nicht unter 500 ms', () => {
    for (const s of [0, 0.25, 0.5, 0.75, 1]) {
      const params = boardAiParams(s);
      expect(params.reactionChance).toBeLessThan(1);
      expect(params.reactionDelayMs.minMs).toBeGreaterThanOrEqual(500);
      // Denkpausen im Bereich von ADR-020 §6 (etwa 0,8–2,5 s).
      expect(params.decisionMs[0]).toBeGreaterThanOrEqual(800);
      expect(params.decisionMs[1]).toBeLessThanOrEqual(2500);
    }
  });

  it('begrenzt s auf [0, 1]; Ungültiges zählt als mittel', () => {
    expect(boardAiParams(-3)).toEqual(BOARD_AI_LEICHT);
    expect(boardAiParams(7)).toEqual(BOARD_AI_SCHWER);
    expect(boardAiParams(Number.NaN)).toEqual(BOARD_AI_MITTEL);
  });

  it('Gewichte (Haken für CHAOS-186) verschieben Chancen, begrenzt auf [0, 1]', () => {
    const params = boardAiParams(0.5, { avoidTrapChance: -0.2, reactionChance: 0.9 });
    expect(params.avoidTrapChance).toBeCloseTo(BOARD_AI_MITTEL.avoidTrapChance - 0.2);
    expect(params.reactionChance).toBe(1);
    expect(params.reactionDelayMs).toEqual(BOARD_AI_MITTEL.reactionDelayMs);
  });
});
