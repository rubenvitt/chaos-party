import { describe, expect, it } from 'vitest';
import { createMessage, parseHostMessage } from './parse.ts';
import { ControllerMinigameTeamSchema, MinigameTeamsSchema } from './schemas.ts';

const placements = [
  { slot: 2, place: 1, score: 12 },
  { slot: 1, place: 2, score: 4 },
] as const;

describe('v4-Nachtrag CHAOS-89: Spielformen mit Teams und Koop', () => {
  it('nimmt Team-Ausgang und Koop-Stufe im Ergebnis an, lehnt Unsinn ab', () => {
    for (const outcome of [
      { kind: 'teams', winner: 0 },
      { kind: 'teams', winner: null },
      { kind: 'koop', tier: 3 },
    ] as const) {
      const message = createMessage('minigame-result', {
        minigameId: 'pump-duell',
        round: 1,
        placements: [...placements],
        outcome,
      });
      expect(parseHostMessage(message).ok).toBe(true);
    }
    for (const outcome of [
      { kind: 'teams', winner: 2 },
      { kind: 'koop', tier: 4 },
      { kind: 'koop', tier: 1, winner: 0 },
    ]) {
      const message = {
        ...createMessage('minigame-result', {
          minigameId: 'pump-duell',
          round: 1,
          placements: [...placements],
        }),
        outcome,
      };
      expect(parseHostMessage(message).ok).toBe(false);
    }
  });

  it('Aufstellung: höchstens zwei Teams, kein Slot doppelt', () => {
    const base = { form: '2v2', layout: '2v2', soloAdvantage: false } as const;
    expect(
      MinigameTeamsSchema.safeParse({
        ...base,
        teams: [
          [1, 4],
          [2, 3],
        ],
      }).success,
    ).toBe(true);
    expect(
      MinigameTeamsSchema.safeParse({
        ...base,
        teams: [
          [1, 2],
          [2, 3],
        ],
      }).success,
    ).toBe(false);
    expect(MinigameTeamsSchema.safeParse({ ...base, teams: [[1], [2], [3]] }).success).toBe(false);
  });

  it('Rolle am Controller', () => {
    const role = {
      layout: '1v3',
      role: 'solo',
      index: 0,
      mates: [],
      opponents: [2, 3, 4],
      advantage: false,
    };
    expect(ControllerMinigameTeamSchema.safeParse(role).success).toBe(true);
    expect(ControllerMinigameTeamSchema.safeParse({ ...role, result: 'won' }).success).toBe(true);
    expect(ControllerMinigameTeamSchema.safeParse({ ...role, role: 'chef' }).success).toBe(false);
  });
});
