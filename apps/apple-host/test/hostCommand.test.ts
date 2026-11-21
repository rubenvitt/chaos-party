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

  it('liest configure mit KI-Platz (CHAOS-179)', () => {
    expect(parseHostCommand('configure:aiSeat=3:mittel')).toEqual({
      type: 'configure',
      aiSeat: { seat: 3, strength: 'mittel' },
    });
    expect(parseHostCommand('configure:aiSeat=4:aus')).toEqual({
      type: 'configure',
      aiSeat: { seat: 4, strength: null },
    });
    for (const cmd of [
      'configure:aiSeat=5:mittel',
      'configure:aiSeat=0:mittel',
      'configure:aiSeat=3:unfehlbar',
      'configure:aiSeat=3',
      'configure:aiSeat=3:mittel,aiSeat=4:leicht',
    ]) {
      expect(parseHostCommand(cmd)).toBeNull();
    }
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
    ]) {
      expect(parseHostCommand(cmd), cmd).toBeNull();
    }
  });
});
