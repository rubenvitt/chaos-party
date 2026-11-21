import { checkInfo, planTeams, type MinigameTeams, type Slot } from '@chaos-party/minigame-sdk';
import { EMPTY_RESIDUE, runMinigameHeadless } from '@chaos-party/minigame-sdk/testing';
import { describe, expect, it } from 'vitest';
import { MINIGAME_INFOS } from '../catalog.ts';
import { pumpDuell } from '../pump-duell/index.ts';
import { pumpRiese } from '../pump-riese/index.ts';
import { pumpSolo } from '../pump-solo/index.ts';
import { getSteckbrief } from '../steckbriefe.ts';
import { koopTier, teamWeights } from './teamPump.ts';

/** Teams ohne Zufall (Brett-Stand = Slot-Reihenfolge). */
function teamsFor(module: typeof pumpDuell, players: number): MinigameTeams {
  const slots = ([1, 2, 3, 4] as const).slice(0, players) as Slot[];
  const teamPlay = module.info.teamPlay;
  if (!teamPlay) throw new Error('kein teamPlay');
  const teams = planTeams({ ...teamPlay, assignment: 'board' }, slots, slots, () => 0);
  if (!teams) throw new Error('keine Teams');
  return teams;
}

/** Slot pumpt `rate`-mal je Sekunde (Druck + Loslassen). */
function pumping(rates: Partial<Record<Slot, number>>) {
  return (
    _elapsed: number,
    send: (slot: Slot, input: { type: 'press' | 'release'; button: 'a' }) => void,
    runner: { elapsedMs: number },
  ) => {
    const step = Math.round(runner.elapsedMs / (1000 / 60));
    for (const [slot, rate] of Object.entries<number>(rates)) {
      const every = Math.max(2, Math.round(60 / rate));
      if (step % every === 0) send(Number(slot) as Slot, { type: 'press', button: 'a' });
      if (step % every === 1) send(Number(slot) as Slot, { type: 'release', button: 'a' });
    }
  };
}

describe('Testspiele der Spielformen (CHAOS-89)', () => {
  it.each([pumpDuell, pumpSolo, pumpRiese])('$info.id: Steckbrief gültig und passend', (module) => {
    expect(checkInfo(module.info)).toEqual({ ok: true });
    const form = module.info.teamPlay?.form;
    expect(getSteckbrief(module.info.id)?.spielform.toLowerCase()).toBe(form);
  });

  it('Spielform im Steckbrief und im Vielfalts-Steckbrief stimmen überein (alle Spiele)', () => {
    for (const info of MINIGAME_INFOS) {
      const spielform = getSteckbrief(info.id)?.spielform.toLowerCase();
      const team = spielform === '1v3' || spielform === '2v2' || spielform === 'koop';
      expect(info.teamPlay?.form, info.id).toBe(team ? spielform : undefined);
    }
  });

  it('Gewichte: allein zählt wie die Gegner zusammen, zu dritt mit Vorteil', () => {
    expect(teamWeights(teamsFor(pumpSolo, 4))).toEqual([3, 1]);
    expect(teamWeights(teamsFor(pumpSolo, 3))).toEqual([2.5, 1]);
    expect(teamWeights(teamsFor(pumpDuell, 4))).toEqual([1, 1]);
    expect(koopTier(0, 4)).toBe(0);
    expect(koopTier(4 * 30, 4)).toBe(3);
  });

  it.each([2, 3, 4])('Pump-Duell mit %i Personen: fleißigeres Team gewinnt', async (players) => {
    const teams = teamsFor(pumpDuell, players);
    const busy = teams.teams[1] ?? [];
    const run = await runMinigameHeadless(pumpDuell, {
      players,
      teams,
      script: pumping(Object.fromEntries(busy.map((slot) => [slot, 6]))),
    });
    expect(run.outcome?.forced).toBe(false);
    expect(run.outcome?.result.outcome).toEqual({ kind: 'teams', winner: 1 });
    for (const slot of busy) {
      expect(run.outcome?.result.placements.find((p) => p.slot === slot)?.place).toBe(1);
    }
    expect(run.residue).toEqual(EMPTY_RESIDUE);
  });

  it('Pump-Solo: die Einzelperson gewinnt mit gleichem Tempo wie alle anderen', async () => {
    const teams = teamsFor(pumpSolo, 4);
    const run = await runMinigameHeadless(pumpSolo, {
      players: 4,
      teams,
      script: pumping({ 1: 6, 2: 5, 3: 5, 4: 5 }),
    });
    expect(teams.teams[0]).toEqual([1]);
    expect(run.outcome?.result.outcome).toEqual({ kind: 'teams', winner: 0 });
    expect(run.outcome?.forced).toBe(false);
  });

  it('Pump-Solo ohne Eingaben: Unentschieden, alle auf Platz 1', async () => {
    const run = await runMinigameHeadless(pumpSolo, { players: 3, teams: teamsFor(pumpSolo, 3) });
    expect(run.outcome?.result.outcome).toEqual({ kind: 'teams', winner: null });
    expect(run.outcome?.result.placements.every((p) => p.place === 1)).toBe(true);
  });

  it.each([2, 3, 4])(
    'Riesenballon mit %i Personen: Stufe aus allen, Plätze aus den eigenen',
    async (players) => {
      const rates = { 1: 6, 2: 4, 3: 4, 4: 4 } as const;
      const run = await runMinigameHeadless(pumpRiese, {
        players,
        teams: teamsFor(pumpRiese, players),
        script: pumping(Object.fromEntries(Object.entries(rates).slice(0, players))),
      });
      const outcome = run.outcome?.result.outcome;
      expect(outcome?.kind).toBe('koop');
      expect(outcome?.kind === 'koop' ? outcome.tier : -1).toBeGreaterThanOrEqual(2);
      expect(run.outcome?.result.placements[0]?.slot).toBe(1);
      expect(run.residue).toEqual(EMPTY_RESIDUE);
    },
  );

  it('ohne Teams (Vorschau) wie jeder gegen jeden, ohne Ausgang', async () => {
    const run = await runMinigameHeadless(pumpDuell, { players: 4, script: pumping({ 2: 6 }) });
    expect(run.outcome?.result.outcome).toBeUndefined();
    expect(run.outcome?.result.placements[0]?.slot).toBe(2);
  });
});
