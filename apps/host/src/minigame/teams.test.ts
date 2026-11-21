import type { BoardView, MinigameTeamsInfo } from '@chaos-party/protocol';
import { describe, expect, it } from 'vitest';
import { teamHeadline, teamLineup } from './teams.ts';

function view(minigame: Partial<NonNullable<BoardView['minigame']>>): BoardView {
  return {
    players: [1, 2, 3, 4].map((slot) => ({ slot, name: ['Ada', 'Ben', 'Cem', 'Dua'][slot - 1] })),
    minigame,
  } as unknown as BoardView;
}

describe('Team-Ansage und Team-Ergebnis am PC (CHAOS-89)', () => {
  it('2 gegen 2: Teams mit Name, Symbol und Mitgliedern', () => {
    const lineup = teamLineup(
      view({
        teams: {
          form: '2v2',
          layout: '2v2',
          teams: [
            [1, 4],
            [2, 3],
          ],
          soloAdvantage: false,
        },
      }),
    );
    expect(lineup?.headline).toBe('2 gegen 2');
    expect(lineup?.groups.map((g) => [g.label, g.symbol, g.slots])).toEqual([
      ['Team Sonne', '☀', [1, 4]],
      ['Team Mond', '☾', [2, 3]],
    ]);
  });

  it('zu dritt: Einzelperson mit Vorteil angesagt', () => {
    const lineup = teamLineup(
      view({ teams: { form: '1v3', layout: '1v2', teams: [[2], [1, 3]], soloAdvantage: true } }),
    );
    expect(lineup?.groups.map((g) => g.label)).toEqual(['Allein', 'Die anderen']);
    expect(lineup?.note).toBe('Ben spielt allein und hat einen Vorteil.');
    expect(teamLineup(view({}))).toBeNull();
  });

  it('Überschriften je Ausgang', () => {
    const solo: MinigameTeamsInfo = {
      form: '1v3',
      layout: '1v3',
      teams: [[2], [1, 3, 4]],
      soloAdvantage: false,
    };
    expect(teamHeadline(view({ teams: solo, outcome: { kind: 'teams', winner: 0 } }))).toBe(
      'Ben gewinnt allein!',
    );
    expect(teamHeadline(view({ teams: solo, outcome: { kind: 'teams', winner: 1 } }))).toBe(
      'Ada, Cem und Dua gewinnen gemeinsam!',
    );
    expect(teamHeadline(view({ teams: solo, outcome: { kind: 'teams', winner: null } }))).toBe(
      'Unentschieden!',
    );
    const koop: MinigameTeamsInfo = {
      form: 'koop',
      layout: 'koop',
      teams: [[1, 2, 3, 4]],
      soloAdvantage: false,
    };
    expect(teamHeadline(view({ teams: koop, outcome: { kind: 'koop', tier: 2 } }))).toBe(
      'Gut geschafft – Stufe 2 von 3',
    );
  });
});
