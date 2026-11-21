import { describe, expect, it } from 'vitest';
import { parseHostCommand } from '../src/hostCommand.ts';

describe('parseHostCommand', () => {
  it('kennt die einfachen Befehle', () => {
    for (const type of ['start', 'pause', 'resume', 'end-game', 'rematch'] as const) {
      expect(parseHostCommand(type)).toEqual({ type });
    }
  });

  it('kennt den lokalen Befehl skip-finale (CHAOS-145)', () => {
    expect(parseHostCommand('skip-finale')).toEqual({ type: 'skip-finale' });
  });

  it('liest configure mit Runden, Schalter oder beidem (CHAOS-166)', () => {
    expect(parseHostCommand('configure:rounds=12')).toEqual({ type: 'configure', rounds: 12 });
    expect(parseHostCommand('configure:rounds=1')).toEqual({ type: 'configure', rounds: 1 });
    expect(parseHostCommand('configure:rounds=20')).toEqual({ type: 'configure', rounds: 20 });
    expect(parseHostCommand('configure:moreReactionTime=1')).toEqual({
      type: 'configure',
      moreReactionTime: true,
    });
    expect(parseHostCommand('configure:moreReactionTime=false')).toEqual({
      type: 'configure',
      moreReactionTime: false,
    });
    expect(parseHostCommand('configure:rounds=16,moreReactionTime=0')).toEqual({
      type: 'configure',
      rounds: 16,
      moreReactionTime: false,
    });
  });

  it('liest configure mit Brett (CHAOS-197)', () => {
    expect(parseHostCommand('configure:board=wackelwald')).toEqual({
      type: 'configure',
      board: 'wackelwald',
    });
    expect(parseHostCommand('configure:board=zufall,rounds=16')).toEqual({
      type: 'configure',
      board: 'zufall',
      rounds: 16,
    });
    // Form stimmt, Brett unbekannt: geht an den Server, der lehnt es ab.
    expect(parseHostCommand('configure:board=gibt-es-nicht')).toEqual({
      type: 'configure',
      board: 'gibt-es-nicht',
    });
  });

  it('liest configure mit Sperrliste und Favoriten (CHAOS-216)', () => {
    expect(
      parseHostCommand('configure:minigameBlocklist=wackelturm+sockenregen,minigameFavorites='),
    ).toEqual({
      type: 'configure',
      minigameBlocklist: ['wackelturm', 'sockenregen'],
      minigameFavorites: [],
    });
    expect(parseHostCommand('configure:minigameFavorites=kruemel-kehraus')).toEqual({
      type: 'configure',
      minigameFavorites: ['kruemel-kehraus'],
    });
    // Form stimmt, Minispiel unbekannt: der Server lässt es weg.
    expect(parseHostCommand('configure:minigameBlocklist=gibt-es-nicht')).toEqual({
      type: 'configure',
      minigameBlocklist: ['gibt-es-nicht'],
    });
  });

  it('liest minigame:favorite und minigame:blocked (CHAOS-216)', () => {
    expect(parseHostCommand('minigame:favorite=sockenregen')).toEqual({
      type: 'toggle-minigame',
      kind: 'favorite',
      id: 'sockenregen',
    });
    expect(parseHostCommand('minigame:blocked=wackelturm')).toEqual({
      type: 'toggle-minigame',
      kind: 'blocked',
      id: 'wackelturm',
    });
  });

  it('lehnt Unbekanntes und Ungültiges ab', () => {
    for (const cmd of [
      '',
      'gibt-es-nicht',
      'START',
      'configure',
      'configure:',
      'configure:rounds',
      'configure:rounds=',
      'configure:rounds=0',
      'configure:rounds=21',
      'configure:rounds=abc',
      'configure:rounds=1.5',
      'configure:rounds=-3',
      'configure:rounds=012',
      'configure:rounds=12=3',
      'configure:rounds=12,rounds=10',
      'configure:moreReactionTime=ja',
      'configure:moreReactionTime=',
      'configure:moreReactionTime=1,moreReactionTime=0',
      'configure:farbe=rot',
      'configure:rounds=12,',
      'configure:__proto__=1',
      'configure:moreReactionTime=constructor',
      'configure:board=',
      'configure:board=Wackelwald',
      'configure:board=wackel wald',
      'configure:board=../brett',
      `configure:board=${'a'.repeat(33)}`,
      'configure:board=wackelwald,board=zufall',
      'configure:minigameBlocklist=Wackelturm',
      'configure:minigameBlocklist=wackelturm+wackelturm',
      'configure:minigameBlocklist=wackelturm+',
      'configure:minigameBlocklist=+',
      'configure:minigameBlocklist=ab',
      `configure:minigameBlocklist=${Array.from({ length: 257 }, (_, i) => `mg-${String(i)}`).join('+')}`,
      'configure:minigameFavorites=a,minigameFavorites=b',
      'configure:minigameBlocklist=a b c',
      'minigame:',
      'minigame:favorite',
      'minigame:favorite=',
      'minigame:favorit=sockenregen',
      'minigame:blocked=Sockenregen',
      'minigame:blocked=sockenregen=1',
      'minigame:__proto__=sockenregen',
    ]) {
      expect(parseHostCommand(cmd), cmd).toBeNull();
    }
  });
});
