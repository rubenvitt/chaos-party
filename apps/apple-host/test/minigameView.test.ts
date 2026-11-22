/**
 * Anleitung mit Bereitschaft für Swift (CHAOS-214): `readinessView` wie die Chips im
 * Browser-Host, kein Countdown, solange die Anleitung auf „Bereit“ wartet.
 */
import type { MinigameTeamsInfo } from '@chaos-party/protocol';
import { describe, expect, it } from 'vitest';
import { minigameView } from '../../host/src/minigame/testViews.ts';
import { MinigameReadinessSchema, MinigameTeamsSchema } from '../src/contract.ts';
import { introCountdown, readinessView, resultsView, teamsView } from '../src/minigameView.ts';

function waitingIntro() {
  const view = minigameView('minigame-intro', { ready: [1, 3] }, { remainingMs: 60_000 });
  return {
    ...view,
    players: view.players.map((p) => (p.slot === 4 ? { ...p, connected: false } : p)),
  };
}

describe('Anleitung mit Bereitschaft (CHAOS-214)', () => {
  it('liefert je Spieler Zustand und Text, gültig nach Vertrag', () => {
    const readiness = readinessView(waitingIntro());
    expect(MinigameReadinessSchema.safeParse(readiness).success).toBe(true);
    expect(readiness?.headline).toContain('Bereit!');
    expect(readiness?.players.map((p) => [p.slot, p.state, p.text])).toEqual([
      [1, 'ready', 'Bereit'],
      [2, 'waiting', 'Drückt Bereit …'],
      [3, 'ready', 'Bereit'],
      [4, 'disconnected', 'getrennt'],
    ]);
  });

  it('zeigt keinen Countdown, solange die Anleitung wartet', () => {
    expect(introCountdown(waitingIntro(), 0, 0)).toBeNull();
    expect(introCountdown(waitingIntro(), 0, 58_500)).toBeNull();
  });

  it('ohne `ready`: fester Countdown wie bisher, keine Bereitschaft', () => {
    const intro = minigameView('minigame-intro', {}, { remainingMs: 6000 });
    expect(readinessView(intro)).toBeNull();
    expect(introCountdown(intro, 0, 0)).toBe(6);
    expect(readinessView(minigameView('minigame-play', { ready: [1] }))).toBeNull();
  });
});

describe('Team-Ansage und Team-Ergebnis für Swift (CHAOS-230)', () => {
  const twoVsTwo: MinigameTeamsInfo = {
    form: '2v2',
    layout: '2v2',
    teams: [
      [1, 4],
      [2, 3],
    ],
    soloAdvantage: false,
  };

  it('2 gegen 2: Gruppen mit Name, Symbol, Farbe und Mitgliedern, gültig nach Vertrag', () => {
    const teams = teamsView(minigameView('minigame-intro', { teams: twoVsTwo }));
    expect(MinigameTeamsSchema.safeParse(teams).success).toBe(true);
    expect(teams?.headline).toBe('2 gegen 2');
    expect(teams?.note).toBeNull();
    expect(teams?.groups.map((g) => [g.label, g.symbol, g.members.map((m) => m.slot)])).toEqual([
      ['Team Sonne', '☀', [1, 4]],
      ['Team Mond', '☾', [2, 3]],
    ]);
    // Mitglieder tragen Slot-Farbe und -Symbol wie die übrigen Spieler-Chips.
    expect(teams?.groups[0]?.members[0]).toMatchObject({ slot: 1, symbol: '●' });
  });

  it('Koop: eine Gruppe ♥ mit allen; zu dritt 1 gegen 2 mit Vorteilshinweis', () => {
    const koop = teamsView(
      minigameView('minigame-play', {
        teams: { form: 'koop', layout: 'koop', teams: [[1, 2, 3, 4]], soloAdvantage: false },
      }),
    );
    expect(koop?.groups.map((g) => [g.label, g.symbol, g.members.length])).toEqual([
      ['Alle zusammen', '♥', 4],
    ]);
    const solo = teamsView(
      minigameView('minigame-intro', {
        teams: { form: '1v3', layout: '1v2', teams: [[2], [1, 3]], soloAdvantage: true },
      }),
    );
    expect(MinigameTeamsSchema.safeParse(solo).success).toBe(true);
    expect(solo?.groups.map((g) => g.label)).toEqual(['Allein', 'Die anderen']);
    expect(solo?.note).toContain('spielt allein und hat einen Vorteil');
  });

  it('jeder gegen jeden: keine Ansage', () => {
    expect(teamsView(minigameView('minigame-intro'))).toBeNull();
  });

  it('Ergebnis: Team-Überschrift statt bestem Einzelplatz', () => {
    const view = minigameView('minigame-results', {
      teams: twoVsTwo,
      outcome: { kind: 'teams', winner: 1 },
      placements: [
        { slot: 1, place: 3, score: 9 },
        { slot: 4, place: 3, score: 9 },
        { slot: 2, place: 1, score: 7 },
        { slot: 3, place: 1, score: 5 },
      ],
    });
    expect(resultsView(view, { scoreUnit: 'Pumpstöße' }).headline).toMatch(/^☾ Team Mond gewinnt/);
  });
});
