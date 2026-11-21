import { describe, expect, it } from 'vitest';
import type { MinigameInfo, MinigameResult, Slot } from './info.ts';
import { checkInfo, checkResult } from './result.ts';
import { checkTeams, planTeams, teamPlacements, type MinigameTeamPlay } from './teams.ts';

const ALL: Slot[] = [1, 2, 3, 4];
/** Brett-Stand: 3 führt, dann 1, 4, 2. */
const STANDING: Slot[] = [3, 1, 4, 2];
const noRandom = (): number => {
  throw new Error('Zufall nicht erwartet');
};

const play = (form: MinigameTeamPlay['form'], assignment?: MinigameTeamPlay['assignment']) =>
  ({ form, withThree: true, withTwo: true, ...(assignment ? { assignment } : {}) }) as const;

describe('planTeams (CHAOS-89)', () => {
  it('2 gegen 2 nach Brett-Stand: Platz 1 + 4 gegen 2 + 3, ohne Zufall', () => {
    expect(planTeams(play('2v2', 'board'), ALL, STANDING, noRandom)).toEqual({
      form: '2v2',
      layout: '2v2',
      teams: [
        [2, 3],
        [1, 4],
      ],
      soloAdvantage: false,
    });
  });

  it('1 gegen 3: Letzter gegen alle bzw. Spitze allein', () => {
    expect(planTeams(play('1v3', 'last-vs-all'), ALL, STANDING, noRandom)?.teams).toEqual([
      [2],
      [1, 3, 4],
    ]);
    expect(planTeams(play('1v3', 'board'), ALL, STANDING, noRandom)?.teams).toEqual([
      [3],
      [1, 2, 4],
    ]);
  });

  it('zufällige Zuteilung nutzt nur `pick` und ist deterministisch', () => {
    const picks: number[] = [];
    const pick = (n: number) => {
      picks.push(n);
      return n - 1;
    };
    const first = planTeams(play('2v2'), ALL, STANDING, pick);
    expect(picks).toEqual([4, 3, 2]);
    expect(planTeams(play('2v2'), ALL, STANDING, (n) => n - 1)).toEqual(first);
    expect(first && checkTeams(first, ALL)).toEqual({ ok: true });
  });

  it('Ersatz zu dritt: 1 gegen 2 mit Vorteil, für 1v3 und 2v2', () => {
    for (const form of ['1v3', '2v2'] as const) {
      const teams = planTeams(play(form, 'board'), [1, 2, 3], [2, 3, 1], noRandom);
      expect(teams).toEqual({ form, layout: '1v2', teams: [[2], [1, 3]], soloAdvantage: true });
    }
  });

  it('Ersatz zu zweit: 1 gegen 1; Koop: ein Team mit allen', () => {
    expect(planTeams(play('2v2', 'board'), [1, 2], [2, 1], noRandom)).toEqual({
      form: '2v2',
      layout: '1v1',
      teams: [[2], [1]],
      soloAdvantage: false,
    });
    expect(planTeams(play('koop'), [4, 2, 1], [1, 2, 4], noRandom)).toEqual({
      form: 'koop',
      layout: 'koop',
      teams: [[1, 2, 4]],
      soloAdvantage: false,
    });
  });

  it('nicht erklärte Ersatzformen ergeben keine Aufstellung', () => {
    const strict: MinigameTeamPlay = { form: '2v2', withThree: false, withTwo: false };
    expect(planTeams(strict, [1, 2, 3], [1, 2, 3], noRandom)).toBeNull();
    expect(planTeams(strict, ALL, STANDING, () => 0)).not.toBeNull();
  });
});

describe('Team-Ergebnisse prüfen (CHAOS-89)', () => {
  const teams = planTeams(play('2v2', 'board'), ALL, STANDING, noRandom);
  if (!teams) throw new Error('keine Teams');
  const scores = [
    { slot: 1 as Slot, score: 4 },
    { slot: 2 as Slot, score: 9 },
    { slot: 3 as Slot, score: 1 },
    { slot: 4 as Slot, score: 7 },
  ];
  const result = (winner: number | null): MinigameResult => ({
    minigameId: 'test-teams',
    placements: teamPlacements(teams, winner, scores),
    outcome: { kind: 'teams', winner },
  });
  const expected = { minigameId: 'test-teams', slots: ALL, scoring: 'higher' as const, teams };

  it('Siegerteam auf Platz 1, das andere dahinter; Einzelpunkte dürfen abweichen', () => {
    expect(result(0).placements.map((p) => [p.slot, p.place])).toEqual([
      [2, 1],
      [3, 1],
      [4, 3],
      [1, 3],
    ]);
    expect(checkResult(result(0), expected)).toEqual({ ok: true });
    expect(checkResult(result(null), expected)).toEqual({ ok: true });
  });

  it('lehnt falsche Plätze, fehlenden oder fremden Ausgang ab', () => {
    const wrong = { ...result(0), outcome: { kind: 'teams', winner: 1 } } as const;
    expect(checkResult(wrong, expected).ok).toBe(false);
    expect(checkResult({ ...result(0), outcome: { kind: 'teams', winner: 2 } }, expected).ok).toBe(
      false,
    );
    const withoutOutcome: MinigameResult = {
      minigameId: 'test-teams',
      placements: result(0).placements,
    };
    expect(checkResult(withoutOutcome, expected).ok).toBe(false);
    expect(checkResult(result(0), { ...expected, teams: null }).ok).toBe(false);
  });

  it('Koop: Stufe 0–3 Pflicht, Plätze sind die Einzelwertung', () => {
    const koop = planTeams(play('koop'), ALL, STANDING, noRandom);
    const koopResult = (tier: number): MinigameResult => ({
      minigameId: 'test-koop',
      placements: [
        { slot: 2, place: 1, score: 9 },
        { slot: 4, place: 2, score: 7 },
        { slot: 1, place: 3, score: 4 },
        { slot: 3, place: 4, score: 1 },
      ],
      outcome: { kind: 'koop', tier },
    });
    const koopExpected = {
      minigameId: 'test-koop',
      slots: ALL,
      scoring: 'higher' as const,
      teams: koop,
    };
    expect(checkResult(koopResult(2), koopExpected)).toEqual({ ok: true });
    expect(checkResult(koopResult(4), koopExpected).ok).toBe(false);
    expect(checkResult(koopResult(1.5), koopExpected).ok).toBe(false);
  });
});

describe('Steckbrief mit Spielform (CHAOS-89)', () => {
  const base: MinigameInfo = {
    id: 'test-teams',
    category: 'arcade',
    title: 'Test',
    tagline: 'Test',
    instructions: ['Test'],
    controls: { joystick: null, a: 'Pumpen', b: null },
    durationMs: 8000,
    physics: false,
    scoring: 'higher',
    scoreUnit: 'Punkte',
  };

  it('verlangt passende Mindestzahl und bekannte Werte', () => {
    expect(checkInfo({ ...base, teamPlay: play('2v2'), minPlayers: 2 })).toEqual({ ok: true });
    expect(checkInfo({ ...base, teamPlay: play('2v2') }).ok).toBe(false);
    const fourOnly: MinigameTeamPlay = { form: '2v2', withThree: false, withTwo: false };
    expect(checkInfo({ ...base, teamPlay: fourOnly, minPlayers: 4 })).toEqual({ ok: true });
    expect(
      checkInfo({
        ...base,
        teamPlay: { form: '2v2', withThree: false, withTwo: true },
        minPlayers: 2,
      }).ok,
    ).toBe(false);
  });
});
