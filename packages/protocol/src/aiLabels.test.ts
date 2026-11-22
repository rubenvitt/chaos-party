import { describe, expect, it } from 'vitest';
import {
  AI_PERSONALITIES,
  AI_PERSONALITY_NAMES,
  AI_STRENGTHS,
  aiTagline,
  isAiSeat,
  nextAiStrength,
  seatDisplayName,
  type AiStrength,
} from './index.ts';

describe('KI-Anzeige (CHAOS-182)', () => {
  it('wechselt die Stärke im Kreis', () => {
    expect(nextAiStrength('leicht')).toBe('mittel');
    expect(nextAiStrength('mittel')).toBe('schwer');
    expect(nextAiStrength('schwer')).toBe('dynamisch');
    expect(nextAiStrength('dynamisch')).toBe('leicht');
    const seen = new Set<string>();
    let strength: AiStrength = 'leicht';
    while (!seen.has(strength)) {
      seen.add(strength);
      strength = nextAiStrength(strength);
    }
    expect(seen.size).toBe(AI_STRENGTHS.length);
  });

  it('kennzeichnet nur KI-Plätze', () => {
    expect(isAiSeat({})).toBe(false);
    expect(isAiSeat(undefined)).toBe(false);
    expect(isAiSeat({ kind: 'human' })).toBe(false);
    expect(isAiSeat({ kind: 'ai' })).toBe(true);
    expect(aiTagline({ kind: 'human' })).toBeNull();
    expect(aiTagline({ kind: 'ai' })).toBe('KI');
    expect(aiTagline({ kind: 'ai', personality: 'saboteur' })).toBe('KI · Saboteur');
  });

  it('hängt KI und Stil an den Namen', () => {
    expect(seatDisplayName({ name: 'Blau' })).toBe('Blau');
    expect(seatDisplayName({ name: 'Schraubi', kind: 'ai' })).toBe('Schraubi · KI');
    expect(seatDisplayName({ name: 'Schraubi', kind: 'ai', personality: 'draufgaenger' })).toBe(
      'Schraubi · KI · Draufgänger',
    );
  });

  it('hat für jeden Stil einen Namen', () => {
    for (const style of AI_PERSONALITIES) expect(AI_PERSONALITY_NAMES[style]).toMatch(/\S/);
  });
});
