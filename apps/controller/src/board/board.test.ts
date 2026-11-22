import { describe, expect, it } from 'vitest';
import type { ControllerBoardInfo, PromptInfo } from '@chaos-party/protocol';
import type { SlotContext } from '../state/reducer.ts';
import {
  activatePrompt,
  countdownFraction,
  remainingAt,
  secondsLeft,
  type ActivePrompt,
} from './countdown.ts';
import { itemOfOption } from './items.ts';
import { chooseIntent, choiceById, describePrompt, isLocked, ownPrompt } from './prompt.ts';
import {
  describeWaiting,
  otherTurnHeadline,
  placeHeadline,
  roundLabel,
  slotName,
  tailwindHeadline,
} from './status.ts';

const reaction: PromptInfo = {
  id: 5,
  slot: 1,
  kind: 'reaction',
  title: 'Schnell!',
  options: [
    { id: 'shield', label: 'Schild!' },
    { id: 'brace', label: 'Festhalten!' },
  ],
  remainingMs: 3000,
};

const roll: PromptInfo = {
  id: 7,
  slot: 1,
  kind: 'roll',
  title: 'Du bist dran!',
  options: [
    { id: 'roll', label: 'Würfeln!' },
    { id: 'item:trap', label: 'Falle' },
    { id: 'item:unbekannt', label: 'Neu' },
  ],
  remainingMs: null,
};

const board: ControllerBoardInfo = {
  gamePhase: 'roll',
  round: 2,
  rounds: 5,
  coins: 10,
  trophies: 0,
  items: [],
  activeSlot: 2,
  paused: false,
  character: 'robot',
  minigameWins: 0,
};

function boardContext(prompt?: PromptInfo, receivedAt = 0): SlotContext {
  return {
    phase: 'board',
    layout: 'board',
    actions: prompt ? ['choose'] : [],
    board,
    ...(prompt && { prompt: activatePrompt(prompt, undefined, receivedAt) }),
  };
}

describe('Countdown', () => {
  it('rechnet die Frist von der Empfangszeit aus und zählt lokal herunter', () => {
    const p = activatePrompt(reaction, undefined, 1000);
    expect(p).toMatchObject({ deadlineAt: 4000, totalMs: 3000 });
    expect(remainingAt(p, 1000)).toBe(3000);
    expect(remainingAt(p, 2500)).toBe(1500);
    expect(countdownFraction(p, 2500)).toBeCloseTo(0.5);
    expect(remainingAt(p, 9000)).toBe(0);
    expect(countdownFraction(p, 9000)).toBe(0);
    // Uhr vor der Empfangszeit (sollte nicht vorkommen): nie über 1.
    expect(countdownFraction(p, 0)).toBe(1);
  });

  it('ohne Frist: kein Countdown', () => {
    const p = activatePrompt(roll, undefined, 1000);
    expect(p).toMatchObject({ deadlineAt: null, totalMs: null });
    expect(remainingAt(p, 5000)).toBeNull();
    expect(countdownFraction(p, 5000)).toBeNull();
  });

  it('derselbe Prompt erneut: Frist aus dem frischen Wert, Balkenlänge bleibt', () => {
    const first = activatePrompt(reaction, undefined, 0);
    const again = activatePrompt({ ...reaction, remainingMs: 1000 }, first, 2100);
    expect(again).toMatchObject({ deadlineAt: 3100, totalMs: 3000 });
    expect(countdownFraction(again, 2100)).toBeCloseTo(1 / 3);
    // Neuer Prompt: neue volle Länge.
    const next = activatePrompt({ ...reaction, id: 6, remainingMs: 1000 }, first, 2100);
    expect(next.totalMs).toBe(1000);
  });

  it('Sekunden werden aufgerundet; 0 erst am Ende', () => {
    expect(secondsLeft(3000)).toBe(3);
    expect(secondsLeft(2001)).toBe(3);
    expect(secondsLeft(1)).toBe(1);
    expect(secondsLeft(0)).toBe(0);
    expect(secondsLeft(-5)).toBe(0);
  });

  it('Frist ohne Restzeit (0 ms): Balken leer', () => {
    const p: ActivePrompt = activatePrompt({ ...reaction, remainingMs: 0 }, undefined, 10);
    expect(countdownFraction(p, 10)).toBe(0);
  });
});

describe('describePrompt', () => {
  it('roll: Würfeln groß, Items (auch unbekannte) als Zusatzknöpfe', () => {
    const view = describePrompt(roll);
    expect(view.kind).toBe('roll');
    expect(view.main).toEqual([
      { id: 'roll', label: 'Würfeln!', detail: null, tone: 'roll', icon: 'dice', slot: null },
    ]);
    expect(view.extra.map((c) => [c.id, c.tone, c.icon])).toEqual([
      ['item:trap', 'item', 'trap'],
      ['item:unbekannt', 'plain', null],
    ]);
  });

  it('roll ohne roll-Option: alle Optionen als große Knöpfe', () => {
    const view = describePrompt({ kind: 'roll', options: [{ id: 'x', label: 'X' }] });
    expect(view.main.map((c) => c.id)).toEqual(['x']);
    expect(view.extra).toEqual([]);
  });

  it('path: Wegknöpfe mit Label und Detail', () => {
    const view = describePrompt({
      kind: 'path',
      options: [
        { id: 's12', label: 'Pilzpfad', detail: 'links' },
        { id: 's20', label: 'Brücke' },
      ],
    });
    expect(view.main).toEqual([
      { id: 's12', label: 'Pilzpfad', detail: 'links', tone: 'path', icon: 'arrow', slot: null },
      { id: 's20', label: 'Brücke', detail: null, tone: 'path', icon: 'arrow', slot: null },
    ]);
  });

  it('trophy: Kaufen (Trophäe) und Weiter', () => {
    const view = describePrompt({
      kind: 'trophy',
      options: [
        { id: 'buy', label: 'Kaufen', detail: '10 Münzen' },
        { id: 'skip', label: 'Weiter' },
        { id: 'later', label: 'Später' },
      ],
    });
    expect(view.main.map((c) => [c.id, c.tone, c.icon, c.detail])).toEqual([
      ['buy', 'buy', 'trophy', '10 Münzen'],
      ['skip', 'skip', 'skip', null],
      ['later', 'plain', null, null],
    ]);
  });

  it('target: Spielerknöpfe mit Slot, Abbrechen als Zusatzknopf', () => {
    const view = describePrompt({
      kind: 'target',
      options: [
        { id: 'slot:2', label: 'Orange', slot: 2 },
        { id: 'cancel', label: 'Abbrechen' },
      ],
    });
    expect(view.main).toEqual([
      { id: 'slot:2', label: 'Orange', detail: null, tone: 'target', icon: null, slot: 2 },
    ]);
    expect(view.extra.map((c) => [c.id, c.tone, c.icon])).toEqual([['cancel', 'cancel', 'cancel']]);
  });

  it('reaction: alle Optionen groß und auffällig', () => {
    const view = describePrompt(reaction);
    expect(view.kind).toBe('reaction');
    expect(view.main.map((c) => [c.id, c.tone, c.icon])).toEqual([
      ['shield', 'reaction', 'shield'],
      ['brace', 'reaction', 'brace'],
    ]);
  });

  it('unbekannte Art: einfache Knopfliste (zukunftssicher)', () => {
    const view = describePrompt({
      kind: 'vote',
      options: [
        { id: 'a', label: 'A' },
        { id: 'slot:3', label: 'Grün', slot: 3 },
      ],
    });
    expect(view.kind).toBe('other');
    expect(view.main.map((c) => [c.id, c.tone, c.slot])).toEqual([
      ['a', 'plain', null],
      ['slot:3', 'target', 3],
    ]);
    expect(choiceById(view, 'slot:3')?.label).toBe('Grün');
    expect(choiceById(view, 'nope')).toBeUndefined();
  });

  it('Item aus Options-ID', () => {
    expect(itemOfOption('item:shield')).toBe('shield');
    expect(itemOfOption('item:foo')).toBeNull();
    expect(itemOfOption('roll')).toBeNull();
  });
});

describe('Wahl und Sperre', () => {
  it('ownPrompt nur in Layout board und nur für den eigenen Slot', () => {
    expect(ownPrompt(boardContext(roll), 1)?.info.id).toBe(7);
    expect(ownPrompt(boardContext(roll), 2)).toBeUndefined();
    expect(ownPrompt(boardContext(), 1)).toBeUndefined();
    expect(ownPrompt(undefined, 1)).toBeUndefined();
    expect(ownPrompt({ ...boardContext(roll), layout: 'wait' }, 1)).toBeUndefined();
  });

  it('chooseIntent: Intent für gültige Option, sonst null', () => {
    const ctx = boardContext(roll);
    expect(chooseIntent(1, ctx, undefined, 'roll')).toEqual({
      type: 'choose',
      slot: 1,
      promptId: 7,
      option: 'roll',
    });
    expect(chooseIntent(1, ctx, undefined, 'item:shield')).toBeNull();
    expect(chooseIntent(2, ctx, undefined, 'roll')).toBeNull();
    expect(chooseIntent(1, boardContext(), undefined, 'roll')).toBeNull();
    // Gesperrt (schon gewählt) oder anderer Prompt (veraltete Berührung).
    expect(chooseIntent(1, ctx, { promptId: 7, option: 'roll' }, 'item:trap')).toBeNull();
    expect(chooseIntent(1, ctx, { promptId: 6, option: 'roll' }, 'roll')).not.toBeNull();
    expect(chooseIntent(1, ctx, undefined, 'roll', 6)).toBeNull();
    expect(chooseIntent(1, ctx, undefined, 'roll', 7)).not.toBeNull();
  });

  it('isLocked nur für die gesendete Prompt-ID', () => {
    const p = activatePrompt(roll, undefined, 0);
    expect(isLocked(p, undefined)).toBe(false);
    expect(isLocked(p, { promptId: 7, option: 'roll' })).toBe(true);
    expect(isLocked(p, { promptId: 3, option: 'roll' })).toBe(false);
  });
});

describe('Warte-Anzeige', () => {
  const players = [{ slot: 1 as const, color: '#0072B2', label: 'Anna' }];

  it('wer dran ist: eigener Name, sonst Farbname', () => {
    expect(describeWaiting(board, 1, players)).toEqual({
      kind: 'other-turn',
      slot: 2,
      name: 'Orange',
      ai: false,
    });
    expect(describeWaiting({ ...board, activeSlot: 1 }, 1, players)).toEqual({
      kind: 'own-turn',
      slot: 1,
    });
    expect(slotName(1, players)).toBe('Anna');
    expect(slotName(4, players)).toBe('Rosa');
  });

  it('KI am Zug (CHAOS-239): Name und „(KI)“ aus `activeSeat`', () => {
    const aiTurn = { ...board, activeSeat: { name: 'Schraubi', kind: 'ai' as const } };
    const view = describeWaiting(aiTurn, 1, players);
    expect(view).toEqual({ kind: 'other-turn', slot: 2, name: 'Schraubi', ai: true });
    expect(view.kind === 'other-turn' && otherTurnHeadline(view)).toBe('Schraubi (KI) ist dran');
    // Mensch am Zug: Name vom Server, ohne Kennzeichnung.
    const humanTurn = { ...board, activeSeat: { name: 'Ben', kind: 'human' as const } };
    const human = describeWaiting(humanTurn, 1, players);
    expect(human.kind === 'other-turn' && otherTurnHeadline(human)).toBe('Ben ist dran');
    // Eigener Zug bleibt „Du bist dran!“, auch wenn der Server `activeSeat` mitschickt.
    expect(
      describeWaiting(
        { ...aiTurn, activeSlot: 1, activeSeat: { name: 'Anna', kind: 'human' } },
        1,
        players,
      ),
    ).toEqual({ kind: 'own-turn', slot: 1 });
  });

  it('Minispiel, Endstand, Start, niemand dran, kein Stand', () => {
    for (const gamePhase of ['minigame-intro', 'minigame-play', 'minigame-results'] as const) {
      expect(describeWaiting({ ...board, gamePhase }, 1, players).kind).toBe('minigame');
    }
    expect(describeWaiting({ ...board, gamePhase: 'game-results', place: 3 }, 1, players)).toEqual({
      kind: 'results',
      place: 3,
    });
    expect(describeWaiting({ ...board, gamePhase: 'game-results' }, 1, players)).toEqual({
      kind: 'results',
      place: null,
    });
    expect(describeWaiting({ ...board, gamePhase: 'setup' }, 1, players).kind).toBe('setup');
    expect(
      describeWaiting({ ...board, gamePhase: 'round-end', activeSlot: null }, 1, players),
    ).toEqual({ kind: 'watch' });
    expect(describeWaiting(undefined, 1, players)).toEqual({ kind: 'watch' });
  });

  it('Rückenwind im Rundenende (CHAOS-125): eigene Münzen groß, sonst wie immer', () => {
    const roundEnd = { ...board, gamePhase: 'round-end' as const, activeSlot: null };
    expect(describeWaiting({ ...roundEnd, tailwind: 4 }, 1, players)).toEqual({
      kind: 'tailwind',
      coins: 4,
    });
    expect(describeWaiting(roundEnd, 1, players)).toEqual({ kind: 'watch' });
    // Außerhalb des Rundenendes zählt das Feld nicht.
    expect(describeWaiting({ ...board, tailwind: 4 }, 1, players).kind).toBe('other-turn');
    expect(tailwindHeadline(4)).toBe('Rückenwind: +4 Münzen!');
    expect(tailwindHeadline(1)).toBe('Rückenwind: +1 Münze!');
  });

  it('Runde und Endplatz-Text', () => {
    expect(roundLabel(board)).toBe('Runde 2/5');
    expect(roundLabel({ ...board, round: 0 })).toBe('Runde 1/5');
    expect(placeHeadline(1)).toBe('Du hast gewonnen!');
    expect(placeHeadline(3)).toBe('Gut gespielt!');
    expect(placeHeadline(null)).toBe('Spiel vorbei!');
  });
});
