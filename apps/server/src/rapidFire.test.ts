import { RAPID_FIRE_RULE } from '@chaos-party/game-core';
import { describe, expect, it } from 'vitest';
import { parseRapidFire } from './rapidFire.ts';

describe('SCHNELLFEUER (CHAOS-90)', () => {
  it('Standard und „an“ sind die Regel aus EXP-039, „aus“ schaltet ab', () => {
    expect(parseRapidFire(undefined)).toEqual(RAPID_FIRE_RULE);
    expect(parseRapidFire(' AN ')).toEqual(RAPID_FIRE_RULE);
    expect(parseRapidFire('aus')).toBeNull();
  });

  it('einzelne Auslöser für den Playtest-Vergleich, Unbekanntes wird abgelehnt', () => {
    expect(parseRapidFire('halbzeit')).toEqual({ trigger: 'halftime' });
    expect(parseRapidFire('finale')).toEqual({ trigger: 'finale' });
    expect(parseRapidFire('ereignis')?.trigger).toBe('event');
    expect(parseRapidFire('ereignis')?.finaleFallback).toBeUndefined();
    expect(parseRapidFire('immer')).toBeUndefined();
  });
});
