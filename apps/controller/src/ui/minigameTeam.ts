/**
 * Eigene Rolle bei Teams bzw. Koop am Controller (CHAOS-89), rein und testbar. Erkennungszeichen
 * wie am PC (`TEAM_MARKS`): Name und Symbol, nie nur Farbe.
 */
import { TEAM_MARKS } from '@chaos-party/minigame-sdk';
import { PLAYER_SLOTS, type ControllerMinigameTeam, type SlotNumber } from '@chaos-party/protocol';

export interface TeamRoleText {
  /** Kurz und groß: „Team ☀ Sonne“, „Allein gegen alle“, „Alle zusammen“. */
  readonly title: string;
  /** Mit wem und gegen wen. */
  readonly detail: string;
  readonly symbol: string;
  readonly color: string;
}

const KOOP = { symbol: '♥', color: '#e85d75' } as const;

function names(slots: readonly SlotNumber[]): string {
  const list = slots.map((slot) => PLAYER_SLOTS[slot].label);
  if (list.length <= 1) return list[0] ?? '';
  return `${list.slice(0, -1).join(', ')} und ${list[list.length - 1] ?? ''}`;
}

/** Rolle in der Anleitung. */
export function describeTeamRole(team: ControllerMinigameTeam): TeamRoleText {
  const mark = TEAM_MARKS[team.index] ?? TEAM_MARKS[0];
  if (team.role === 'koop') {
    return { title: 'Alle zusammen', detail: 'Spielt gemeinsam – jede Hilfe zählt.', ...KOOP };
  }
  if (team.role === 'solo') {
    const title = team.layout === '1v1' ? 'Eins gegen eins' : 'Allein gegen alle';
    const against = `Du gegen ${names(team.opponents)}.`;
    return {
      title,
      detail: team.advantage ? `${against} Du hast einen Vorteil.` : against,
      symbol: mark.symbol,
      color: mark.color,
    };
  }
  const title = team.layout === '2v2' ? `Team ${mark.name}` : 'Gemeinsam gegen eine Person';
  return {
    title,
    detail: `Du und ${names(team.mates)} gegen ${names(team.opponents)}.`,
    symbol: mark.symbol,
    color: mark.color,
  };
}

/** Ausgang aus eigener Sicht im Ergebnis oder `null`, solange er fehlt. */
export function describeTeamResult(team: ControllerMinigameTeam): string | null {
  if (team.tier !== undefined) {
    return team.tier === 0
      ? 'Leider nicht geschafft (Stufe 0 von 3)'
      : `Gemeinsam geschafft: Stufe ${String(team.tier)} von 3`;
  }
  if (team.result === 'draw') return 'Unentschieden!';
  if (team.result === 'won')
    return team.role === 'solo' ? 'Du hast allein gewonnen!' : 'Dein Team hat gewonnen!';
  if (team.result === 'lost')
    return team.role === 'solo' ? 'Die anderen waren stärker.' : 'Dein Team hat verloren.';
  return null;
}
