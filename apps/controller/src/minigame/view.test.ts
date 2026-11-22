import { describe, expect, it } from 'vitest';
import type { Action, ControllerMinigameInfo } from '@chaos-party/protocol';
import {
  ABORTED_HEADLINE,
  controlLegend,
  DEFAULT_STICK_HINT,
  describePlay,
  describeSecret,
  describeResult,
  describeVote,
  formatScore,
  PRACTICE_LEAD,
  RESULTS_LEAD,
  INTRO_READY_BUTTON,
  INTRO_READY_DONE,
  INTRO_READY_GUARD_MS,
  introReadyState,
  minigameIn,
  offeredActions,
  readyIntroToken,
  rewardText,
  sameReadyIntro,
} from './view.ts';
import type { SlotContext } from '../state/reducer.ts';

/** Minispiele am Controller (CHAOS-33): reine Ableitungen für Intro, Spiel, Ergebnis. */

function info(extra: Partial<ControllerMinigameInfo> = {}): ControllerMinigameInfo {
  return {
    id: 'kartoffel-hupf',
    title: 'Kartoffel-Hüpfen',
    tagline: 'Hüpf über die rollenden Kartoffeln!',
    instructions: ['Lauf hin und her.', 'Spring mit A.'],
    controls: { joystick: 'Laufen', a: 'Springen', b: null },
    stage: 'play',
    scoreUnit: 'Sekunden',
    tied: false,
    aborted: false,
    ...extra,
  };
}

function play(actions: Action[], minigame?: ControllerMinigameInfo): SlotContext {
  return {
    phase: 'board',
    layout: 'joystick-buttons',
    actions,
    ...(minigame && { minigame }),
  };
}

describe('minigameIn', () => {
  it('liefert das Minispiel (optional nur in einer Stage)', () => {
    const ctx = play(['move'], info({ stage: 'intro' }));
    expect(minigameIn(ctx)?.id).toBe('kartoffel-hupf');
    expect(minigameIn(ctx, 'intro')?.stage).toBe('intro');
    expect(minigameIn(ctx, 'play')).toBeUndefined();
    expect(minigameIn(undefined)).toBeUndefined();
    expect(minigameIn(play(['move']))).toBeUndefined();
  });
});

describe('controlLegend', () => {
  it('nur angebotene Elemente, Reihenfolge Joystick, A, B', () => {
    expect(controlLegend({ joystick: 'Laufen', a: 'Springen', b: null })).toEqual([
      { kind: 'stick', label: 'Laufen' },
      { kind: 'a', label: 'Springen' },
    ]);
    expect(controlLegend({ joystick: null, a: 'Pumpen', b: null })).toEqual([
      { kind: 'a', label: 'Pumpen' },
    ]);
    expect(controlLegend({ joystick: 'Lenken', a: 'Schubsen', b: 'Bremsen' })).toHaveLength(3);
    expect(controlLegend({ joystick: null, a: null, b: null })).toEqual([]);
  });
});

describe('describePlay', () => {
  it('M1-Arena ohne Minispiel: wie bisher, nur Buchstaben', () => {
    expect(describePlay(play(['move', 'button-a', 'button-b']))).toEqual({
      stick: true,
      stickHint: DEFAULT_STICK_HINT,
      buttons: [
        { button: 'a', label: null },
        { button: 'b', label: null },
      ],
      title: null,
      cue: null,
      secret: null,
    });
  });

  it('Minispiel: Beschriftung aus dem Steckbrief, Kopf mit Titel', () => {
    const view = describePlay(play(['move', 'button-a'], info()));
    expect(view).toEqual({
      stick: true,
      stickHint: 'Ziehen: Laufen',
      buttons: [{ button: 'a', label: 'Springen' }],
      title: 'Kartoffel-Hüpfen',
      cue: null,
      secret: null,
    });
  });

  it('Abschnitt mit Hinweis (CHAOS-231): Bildwort im Kopf, nur dessen Bedienung', () => {
    const schnellfeuer = info({
      id: 'schnellfeuer',
      title: 'Schnellfeuer!',
      controls: { joystick: 'Zielen', a: 'Los!', b: null },
    });
    const actions: Action[] = ['move', 'button-a'];
    const hauen = {
      step: 0,
      steps: 5,
      icon: '⏰',
      word: 'HAUEN!',
      controls: { joystick: null, a: 'Hauen', b: null },
      double: false,
    };
    const view = describePlay(play(actions, { ...schnellfeuer, cue: hauen }));
    expect(view).toMatchObject({
      stick: false,
      buttons: [{ button: 'a', label: 'Hauen' }],
      title: 'Schnellfeuer!',
      cue: { step: 0, icon: '⏰', word: 'HAUEN!', progress: '1/5', double: false },
    });
    expect(offeredActions(play(actions, { ...schnellfeuer, cue: hauen }))).toEqual(['button-a']);
    const finale = {
      ...hauen,
      step: 4,
      icon: '🍰',
      word: 'HALBIEREN!',
      controls: { joystick: 'Messer', a: 'Schneiden', b: null },
      double: true,
    };
    expect(describePlay(play(actions, { ...schnellfeuer, cue: finale }))).toMatchObject({
      stick: true,
      stickHint: 'Ziehen: Messer',
      buttons: [{ button: 'a', label: 'Schneiden' }],
      cue: { progress: '5/5', double: true },
    });
    // Ohne Hinweis (älterer Host): Vereinigung aus dem Steckbrief wie bisher.
    expect(describePlay(play(actions, schnellfeuer))).toMatchObject({
      stick: true,
      buttons: [{ button: 'a', label: 'Los!' }],
      cue: null,
    });
  });

  it('geheime Wahl (CHAOS-242): Optionen mit Ziel und Wahl, Bedienung unverändert', () => {
    const tueren = info({
      id: 'drei-tueren',
      title: 'Drei Türen',
      controls: { joystick: 'Tür zeigen', a: 'Wählen', b: null },
    });
    const secret = {
      prompt: 'Runde 1/8: deine Tür?',
      options: [
        { id: 'links', icon: '←', label: '5 Münzen' },
        { id: 'mitte', icon: '↑', label: '9 Münzen' },
        { id: 'rechts', icon: '→', label: '2 Münzen' },
      ],
      aim: 'mitte',
      pick: null,
      locked: false,
    };
    const actions: Action[] = ['move', 'button-a'];
    const aimed = describePlay(play(actions, { ...tueren, secret }));
    expect(aimed).toMatchObject({ stick: true, buttons: [{ button: 'a', label: 'Wählen' }] });
    expect(aimed.secret?.options.map((option) => option.state)).toEqual(['idle', 'aimed', 'idle']);
    expect(aimed.secret?.spoken).toBe('Zeigt auf: ↑ 9 Münzen');
    const picked = describeSecret({ ...secret, aim: null, pick: 'rechts', locked: true });
    expect(picked.options.map((option) => option.state)).toEqual(['idle', 'idle', 'picked']);
    expect(picked).toMatchObject({ locked: true, spoken: 'Deine Wahl: → 2 Münzen' });
    expect(describeSecret({ ...secret, aim: null }).spoken).toBe('Noch keine Wahl');
    // Außerhalb von `play` keine Rückmeldung.
    const intro = { ...tueren, stage: 'intro' as const, secret };
    expect(describePlay(play(actions, intro)).secret).toBeNull();
  });

  it('Joystick null: kein Joystick, auch wenn der Server move anbietet', () => {
    const minigame = info({ controls: { joystick: null, a: 'Pumpen', b: null } });
    const view = describePlay(play(['move', 'button-a'], minigame));
    expect(view.stick).toBe(false);
    expect(view.buttons).toEqual([{ button: 'a', label: 'Pumpen' }]);
    expect(offeredActions(play(['move', 'button-a'], minigame))).toEqual(['button-a']);
  });

  it('B null: kein B; ohne Aktion des Servers auch kein beschriftetes Element', () => {
    const minigame = info({ controls: { joystick: 'Laufen', a: 'Springen', b: 'Ducken' } });
    expect(describePlay(play(['move', 'button-a'], minigame)).buttons).toEqual([
      { button: 'a', label: 'Springen' },
    ]);
    expect(describePlay(play(['button-a', 'button-b'], minigame)).stick).toBe(false);
    expect(offeredActions(play(['move', 'button-a', 'button-b'], info()))).toEqual([
      'move',
      'button-a',
    ]);
  });

  it('Kontext außerhalb von play (Intro/Ergebnis) liefert keine Beschriftung', () => {
    const view = describePlay(play(['move', 'button-a'], info({ stage: 'results' })));
    expect(view.title).toBeNull();
    expect(view.buttons).toEqual([{ button: 'a', label: null }]);
  });
});

describe('describeResult', () => {
  it('Platz und Punkte mit Einheit', () => {
    expect(describeResult(info({ stage: 'results', place: 1, score: 42 }))).toEqual({
      kind: 'placed',
      place: 1,
      tied: false,
      headline: 'Platz 1!',
      cheer: 'Gewonnen!',
      score: '42 Sekunden',
      reward: null,
      prizes: [],
      lead: RESULTS_LEAD,
    });
    const fourth = describeResult(info({ stage: 'results', place: 4, score: 0 }));
    expect(fourth).toMatchObject({ headline: 'Platz 4!', score: '0 Sekunden' });
  });

  it('Gleichstand (CHAOS-55): ausdrücklich „Geteilter Platz“, auf Platz 1 gemeinsam gewonnen', () => {
    expect(describeResult(info({ stage: 'results', place: 1, tied: true }))).toMatchObject({
      kind: 'placed',
      tied: true,
      headline: 'Geteilter Platz 1!',
      cheer: 'Gemeinsam gewonnen!',
    });
    expect(describeResult(info({ stage: 'results', place: 3, tied: true }))).toMatchObject({
      headline: 'Geteilter Platz 3!',
      cheer: 'Gut gemacht!',
    });
  });

  it('Trostpreis aus `prizes` (CHAOS-51)', () => {
    expect(
      describeResult(info({ stage: 'results', place: 2, reward: 5, prizes: ['trap'] })),
    ).toMatchObject({ reward: '+5 Münzen', prizes: ['trap'] });
  });

  it('Münzen aus `reward`: „+5 Münzen“, Einzahl, „Keine Münzen“', () => {
    expect(describeResult(info({ stage: 'results', place: 1, reward: 5 }))).toMatchObject({
      reward: '+5 Münzen',
    });
    expect(rewardText(1)).toBe('+1 Münze');
    expect(rewardText(0)).toBe('Keine Münzen');
    expect(rewardText(undefined)).toBeNull();
  });

  it('Platz ohne Punkte: keine Punktzeile', () => {
    expect(describeResult(info({ stage: 'results', place: 2 }))).toMatchObject({
      kind: 'placed',
      score: null,
    });
  });

  it('Abbruch (kein Platz): Hinweis statt Wertung', () => {
    expect(describeResult(info({ stage: 'results' }))).toMatchObject({
      kind: 'aborted',
      headline: ABORTED_HEADLINE,
    });
  });

  it('Abbruch (`aborted`, CHAOS-55) schlägt einen mitgeschickten Platz', () => {
    expect(
      describeResult(info({ stage: 'results', place: 1, aborted: true, reward: 3 })),
    ).toMatchObject({ kind: 'aborted', headline: 'Minispiel abgebrochen' });
  });
});

describe('formatScore', () => {
  it('deutsche Tausenderpunkte, negative Werte', () => {
    expect(formatScore(1234, 'Pumpstöße')).toBe('1.234 Pumpstöße');
    expect(formatScore(-3, 'Punkte')).toBe('-3 Punkte');
    expect(formatScore(1_000_000, 'Meter')).toBe('1.000.000 Meter');
  });
});

describe('Übungsrunde und Daumen (CHAOS-87)', () => {
  it('zeigt in der Übungsrunde keine Münzzeile und den Weg zurück in die Lobby', () => {
    const view = describeResult(info({ stage: 'results', place: 2, reward: 0, practice: true }));
    expect(view).toMatchObject({ kind: 'placed', reward: null, lead: PRACTICE_LEAD });
    const game = describeResult(info({ stage: 'results', place: 2, reward: 0 }));
    expect(game).toMatchObject({ reward: 'Keine Münzen', lead: RESULTS_LEAD });
  });

  it('bietet Daumen nur an, wenn der Server rate in der Ergebnisanzeige anbietet', () => {
    const results = info({ stage: 'results', place: 1 });
    expect(describeVote({ actions: ['rate'], minigame: results })).toEqual({
      open: true,
      selected: null,
    });
    expect(describeVote({ actions: [], minigame: results }).open).toBe(false);
    expect(describeVote({ actions: ['rate'], minigame: info({ stage: 'intro' }) }).open).toBe(
      false,
    );
    expect(describeVote({ actions: ['rate'], minigame: { ...results, vote: 'down' } })).toEqual({
      open: true,
      selected: 'down',
    });
    // Gerade gesendet: die eigene Wahl leuchtet schon vor der Bestätigung.
    expect(
      describeVote({ actions: ['rate'], minigame: { ...results, vote: 'down' } }, 'up').selected,
    ).toBe('up');
  });
});

describe('introReadyState (CHAOS-214)', () => {
  function intro(actions: Action[], ready?: boolean): SlotContext {
    return {
      phase: 'board',
      layout: 'board',
      actions,
      minigame: info({ stage: 'intro', ...(ready !== undefined && { ready }) }),
    };
  }
  const fresh = { sent: false, armed: false };
  const armed = { sent: false, armed: true };

  it('Anleitung wartet: erst Schonfrist, dann Knopf', () => {
    expect(introReadyState(intro(['ready'], false), fresh)).toBe('guard');
    expect(introReadyState(intro(['ready'], false), armed)).toBe('button');
    // Angebot ohne `ready`-Feld (Server bietet die Aktion an): ebenfalls Knopf.
    expect(introReadyState(intro(['ready']), armed)).toBe('button');
  });

  it('nach dem Tippen bzw. bestätigt: „Warte auf die anderen“', () => {
    expect(introReadyState(intro(['ready'], false), { sent: true, armed: true })).toBe('done');
    expect(introReadyState(intro([], true), fresh)).toBe('done');
    expect(introReadyState(intro([], true), armed)).toBe('done');
  });

  it('feste Anleitungszeit, Ergebnis, Spiel oder kein Minispiel: Schlusszeile wie bisher', () => {
    expect(introReadyState(intro([]), armed)).toBe('timer');
    expect(introReadyState(intro([], false), armed)).toBe('timer');
    expect(introReadyState(undefined, armed)).toBe('timer');
    expect(introReadyState(play(['move']), armed)).toBe('timer');
    const results = { ...intro(['ready']), minigame: info({ stage: 'results' }) };
    expect(introReadyState(results, armed)).toBe('timer');
  });

  it('readyIntroToken: Runde und Minispiel, nur solange „Bereit“ angeboten wird', () => {
    const board = { round: 3 } as NonNullable<SlotContext['board']>;
    expect(readyIntroToken({ ...intro(['ready'], false), board })).toBe('3:kartoffel-hupf');
    expect(readyIntroToken(intro(['ready'], false))).toBe('0:kartoffel-hupf');
    expect(readyIntroToken({ ...intro([], true), board })).toBeNull();
    expect(readyIntroToken(intro([]))).toBeNull();
    expect(readyIntroToken(undefined)).toBeNull();
  });

  it('Texte und Schonfrist', () => {
    expect(INTRO_READY_BUTTON).toBe('Bereit!');
    expect(INTRO_READY_DONE).toBe('Bereit! Warte auf die anderen …');
    expect(INTRO_READY_GUARD_MS).toBeGreaterThanOrEqual(400);
    expect(INTRO_READY_GUARD_MS).toBeLessThanOrEqual(1000);
  });

  it('sameReadyIntro: gleiche wartende Anleitung, auch als neues Objekt', () => {
    const a = intro(['ready'], false);
    expect(sameReadyIntro(a, intro(['ready'], false))).toBe(true);
    expect(sameReadyIntro(a, intro([], true))).toBe(false);
    expect(
      sameReadyIntro(a, {
        ...a,
        minigame: info({ stage: 'intro', id: 'pump-parade', ready: false }),
      }),
    ).toBe(false);
    expect(sameReadyIntro(a, { ...a, minigame: info({ stage: 'play' }) })).toBe(false);
  });
});
