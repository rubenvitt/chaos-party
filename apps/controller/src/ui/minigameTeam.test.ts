import type { ControllerMinigameTeam } from '@chaos-party/protocol';
import { describe, expect, it } from 'vitest';
import { describeTeamResult, describeTeamRole } from './minigameTeam.ts';

describe('Rolle bei Teams und Koop (CHAOS-89)', () => {
  it('nennt Team, Mitspieler und Gegner mit Symbol', () => {
    expect(
      describeTeamRole({
        layout: '2v2',
        role: 'team',
        index: 1,
        mates: [3],
        opponents: [1, 2],
        advantage: false,
      }),
    ).toMatchObject({
      title: 'Team Mond',
      symbol: '☾',
      detail: 'Du und Grün gegen Blau und Orange.',
    });
    expect(
      describeTeamRole({
        layout: '1v2',
        role: 'solo',
        index: 0,
        mates: [],
        opponents: [2, 3],
        advantage: true,
      }),
    ).toMatchObject({
      title: 'Allein gegen alle',
      detail: 'Du gegen Orange und Grün. Du hast einen Vorteil.',
    });
    expect(
      describeTeamRole({
        layout: 'koop',
        role: 'koop',
        index: 0,
        mates: [2],
        opponents: [],
        advantage: false,
      }).title,
    ).toBe('Alle zusammen');
  });

  it('Ausgang aus eigener Sicht', () => {
    const base: ControllerMinigameTeam = {
      layout: '1v3',
      role: 'solo',
      index: 0,
      mates: [],
      opponents: [2, 3, 4],
      advantage: false,
    };
    expect(describeTeamResult(base)).toBeNull();
    expect(describeTeamResult({ ...base, result: 'won' })).toBe('Du hast allein gewonnen!');
    expect(describeTeamResult({ ...base, role: 'team', result: 'lost' })).toBe(
      'Dein Team hat verloren.',
    );
    expect(describeTeamResult({ ...base, layout: 'koop', role: 'koop', tier: 0 })).toContain(
      'nicht geschafft',
    );
  });
});
