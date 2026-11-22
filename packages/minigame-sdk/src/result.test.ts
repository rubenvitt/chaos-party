import { describe, expect, it } from 'vitest';
import type { MinigameSecret } from './info.ts';
import { checkResult, checkSecret, rankByScore } from './result.ts';

describe('rankByScore', () => {
  it('vergibt Plätze mit Gleichstand (1224) und sortiert stabil nach Slot', () => {
    const placements = rankByScore([
      { slot: 3, score: 5 },
      { slot: 1, score: 9 },
      { slot: 4, score: 5 },
      { slot: 2, score: 1 },
    ]);
    expect(placements).toEqual([
      { slot: 1, place: 1, score: 9 },
      { slot: 3, place: 2, score: 5 },
      { slot: 4, place: 2, score: 5 },
      { slot: 2, place: 4, score: 1 },
    ]);
  });

  it('kann „weniger ist besser“ und rundet Gleitkomma-Rauschen weg', () => {
    const placements = rankByScore(
      [
        { slot: 1, score: 12.0000001 },
        { slot: 2, score: 11.9999999 },
        { slot: 3, score: 3 },
      ],
      'lower',
    );
    expect(placements.map((p) => [p.slot, p.place])).toEqual([
      [3, 1],
      [1, 2],
      [2, 2],
    ]);
  });
});

describe('checkResult', () => {
  const expected = { minigameId: 'abc-1', slots: [1, 2, 3] as const, scoring: 'higher' as const };
  const valid = {
    minigameId: 'abc-1',
    placements: [
      { slot: 2 as const, place: 1, score: 10 },
      { slot: 1 as const, place: 2, score: 4 },
      { slot: 3 as const, place: 2, score: 4 },
    ],
  };

  it('akzeptiert eine gültige Wertung', () => {
    expect(checkResult(valid, expected)).toEqual({ ok: true });
  });

  it.each([
    ['falsche ID', { ...valid, minigameId: 'xyz-9' }],
    ['fehlender Slot', { ...valid, placements: valid.placements.slice(0, 2) }],
    [
      'fremder Slot',
      {
        ...valid,
        placements: [...valid.placements.slice(0, 2), { slot: 4 as const, place: 2, score: 4 }],
      },
    ],
    [
      'doppelter Slot',
      {
        ...valid,
        placements: [...valid.placements.slice(0, 2), { slot: 1 as const, place: 2, score: 4 }],
      },
    ],
    [
      'Platzlücke (1, 3, 3)',
      {
        ...valid,
        placements: [
          { slot: 2 as const, place: 1, score: 10 },
          { slot: 1 as const, place: 3, score: 4 },
          { slot: 3 as const, place: 3, score: 4 },
        ],
      },
    ],
    [
      'Punkte widersprechen Plätzen',
      {
        ...valid,
        placements: [
          { slot: 2 as const, place: 1, score: 1 },
          { slot: 1 as const, place: 2, score: 4 },
          { slot: 3 as const, place: 2, score: 4 },
        ],
      },
    ],
    [
      'Kommazahl',
      {
        ...valid,
        placements: [
          { slot: 2 as const, place: 1, score: 10.5 },
          { slot: 1 as const, place: 2, score: 4 },
          { slot: 3 as const, place: 2, score: 4 },
        ],
      },
    ],
    ['zu langer Höhepunkt', { ...valid, highlights: ['x'.repeat(65)] }],
  ])('lehnt ab: %s', (_name, result) => {
    expect(checkResult(result, expected).ok).toBe(false);
  });
});

describe('checkSecret (CHAOS-242)', () => {
  const links = { id: 'links', icon: '←', label: '5 Münzen' };
  const mitte = { id: 'mitte', icon: '↑', label: '9 Münzen' };
  const secret: MinigameSecret = {
    prompt: 'Runde 1/8: deine Tür',
    options: [links, mitte, { id: 'rechts', icon: '→', label: '2 Münzen' }],
    aim: 'mitte',
    pick: null,
    locked: false,
  };

  it('nimmt eine gültige Rückmeldung an', () => {
    expect(checkSecret(secret)).toEqual({ ok: true });
    expect(checkSecret({ ...secret, aim: null, pick: 'links', locked: true })).toEqual({
      ok: true,
    });
  });

  it.each<[string, Partial<MinigameSecret>]>([
    ['leere Frage', { prompt: '' }],
    ['Frage zu lang', { prompt: 'x'.repeat(25) }],
    ['nur eine Option', { options: secret.options.slice(0, 1) }],
    ['fünf Optionen', { options: [...secret.options, ...secret.options.slice(0, 2)] }],
    ['doppelte Kennung', { options: [links, links] }],
    ['Kennung mit Großbuchstaben', { options: [{ ...links, id: 'Links' }, mitte] }],
    ['Text mit Rand-Leerraum', { options: [{ ...links, label: ' x' }, mitte] }],
    ['Ziel außerhalb', { aim: 'oben' }],
    ['Wahl außerhalb', { pick: 'oben' }],
  ])('lehnt ab: %s', (_name, patch) => {
    expect(checkSecret({ ...secret, ...patch }).ok).toBe(false);
  });
});
