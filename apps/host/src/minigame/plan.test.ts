import { describe, expect, it } from 'vitest';
import {
  aiTaglineOf,
  botSeatsFromView,
  botStrength,
  characterName,
  intentToMinigameInput,
  MIN_RESTART_MS,
  minigameStageOf,
  phaseSecondsLeft,
  planPlay,
  RESULT_MARGIN_MS,
  playDeadline,
  playersFromView,
  remainingPlayMs,
  shownRemainingMs,
  stageKeyOf,
} from './plan.ts';
import { minigameView } from './testViews.ts';

const known = (id: string) => id === 'pump-parade';

describe('minigameStageOf / stageKeyOf', () => {
  it('ordnet die Minispiel-Phasen zu, sonst null', () => {
    expect(minigameStageOf(minigameView('minigame-intro'))).toBe('intro');
    expect(minigameStageOf(minigameView('minigame-play'))).toBe('play');
    expect(minigameStageOf(minigameView('minigame-results'))).toBe('results');
    expect(minigameStageOf(minigameView('round-end'))).toBeNull();
    expect(minigameStageOf(null)).toBeNull();
    expect(minigameStageOf({ ...minigameView('minigame-play'), minigame: null })).toBeNull();
  });

  it('gleicher Schlüssel über alle Phasen eines Minispiels, null für Platzhalter/Unbekanntes', () => {
    const keys = (['minigame-intro', 'minigame-play', 'minigame-results'] as const).map((phase) =>
      stageKeyOf(minigameView(phase), known),
    );
    expect(new Set(keys)).toEqual(new Set(['pump-parade:2:1234']));
    expect(stageKeyOf(minigameView('minigame-play', { id: 'placeholder' }), known)).toBeNull();
    expect(stageKeyOf(minigameView('minigame-play', { id: 'gibts-nicht' }), known)).toBeNull();
    expect(stageKeyOf(minigameView('round-end'), known)).toBeNull();
    // Neue Runde oder neuer Seed → neue Bühne.
    expect(stageKeyOf(minigameView('minigame-intro', { round: 3 }), known)).toBe(
      'pump-parade:3:1234',
    );
  });
});

describe('Spielzeit und Host-Neuladen', () => {
  it('Restzeit = playMs − elapsedMs − Zeit seit Empfang', () => {
    const view = minigameView('minigame-play', { playMs: 8000, elapsedMs: 2000 });
    expect(remainingPlayMs(view, 1000, 1000)).toBe(6000);
    expect(remainingPlayMs(view, 1000, 1500)).toBe(5500);
    expect(remainingPlayMs(view, 1000, 99_000)).toBe(0);
    // Vor dem Spiel: volle Zeit, unabhängig von der Uhr.
    expect(remainingPlayMs(minigameView('minigame-intro'), 0, 5000)).toBe(8000);
  });

  it('pausierter Stand (Auto-Pause beim Neuladen, CHAOS-68): Zeit seit Empfang zählt nicht', () => {
    const view = {
      ...minigameView('minigame-play', { playMs: 8000, elapsedMs: 2000 }),
      paused: true,
    };
    expect(remainingPlayMs(view, 1000, 9_000)).toBe(6000);
    expect(planPlay(view, 1000, 9_000)).toEqual({ kind: 'play', timeLimitMs: 6000 });
  });

  it('Intro und normaler Start: volle Spielzeit', () => {
    expect(planPlay(minigameView('minigame-intro'), 0, 3000)).toEqual({
      kind: 'play',
      timeLimitMs: 8000,
    });
    expect(planPlay(minigameView('minigame-play', { elapsedMs: 0 }), 0, 0)).toEqual({
      kind: 'play',
      timeLimitMs: 8000,
    });
  });

  it('Neuladen mitten im Spiel: Neustart mit Restzeit, unter der Schwelle warten', () => {
    expect(planPlay(minigameView('minigame-play', { elapsedMs: 3000 }), 100, 600)).toEqual({
      kind: 'play',
      timeLimitMs: 4500,
    });
    const late = minigameView('minigame-play', { elapsedMs: 8000 - MIN_RESTART_MS + 1 });
    expect(planPlay(late, 0, 0)).toEqual({ kind: 'wait', remainingMs: MIN_RESTART_MS - 1 });
    const exact = minigameView('minigame-play', { elapsedMs: 8000 - MIN_RESTART_MS });
    expect(planPlay(exact, 0, 0)).toEqual({ kind: 'play', timeLimitMs: MIN_RESTART_MS });
  });

  it('Countdown: ganze Restsekunden ab Empfang, nie negativ', () => {
    expect(phaseSecondsLeft(6000, 0, 0)).toBe(6);
    expect(phaseSecondsLeft(6000, 0, 999)).toBe(6);
    expect(phaseSecondsLeft(6000, 0, 1000)).toBe(5);
    expect(phaseSecondsLeft(6000, 500, 7000)).toBe(0);
    expect(phaseSecondsLeft(null, 0, 0)).toBeNull();
    // Uhr vor Empfang (z. B. eingefrorene Testuhr): volle Zeit.
    expect(phaseSecondsLeft(2500, 1000, 0)).toBe(3);
  });
});

describe('Ablauf an der Frist des Servers (CHAOS-206)', () => {
  // playMs 8000, Kulanz 15 s; Stand empfangen bei 1000 zu Spielbeginn → Frist bei 24 000.
  const play = minigameView(
    'minigame-play',
    { playMs: 8000, elapsedMs: 0 },
    { remainingMs: 23_000 },
  );
  const deadline = 24_000;

  it('beendet ein laufendes Spiel RESULT_MARGIN_MS vor der Frist, nicht am Ende der Spielzeit', () => {
    expect(playDeadline(play, 1000, 9000 + 5000, true)).toBe('keep');
    expect(playDeadline(play, 1000, deadline - RESULT_MARGIN_MS - 1, true)).toBe('keep');
    expect(playDeadline(play, 1000, deadline - RESULT_MARGIN_MS, true)).toBe('end');
  });

  it('startet ein spät aufgebautes Spiel nur, wenn bis dahin noch MIN_RESTART_MS bleiben', () => {
    // 5 s nach dem Spielbeginn fertig: startet (Ergebnis kommt in der Kulanz).
    expect(playDeadline(play, 1000, 6000, false)).toBe('keep');
    const lastStart = deadline - RESULT_MARGIN_MS - MIN_RESTART_MS;
    expect(playDeadline(play, 1000, lastStart, false)).toBe('keep');
    expect(playDeadline(play, 1000, lastStart + 1, false)).toBe('end');
  });

  it('außerhalb des Spiels und ohne Frist im Stand nie; in der Pause steht die Uhr', () => {
    expect(playDeadline(minigameView('minigame-intro'), 0, 99_000, true)).toBe('keep');
    expect(playDeadline(minigameView('minigame-results'), 0, 99_000, false)).toBe('keep');
    expect(playDeadline(minigameView('minigame-play'), 0, 99_000, true)).toBe('keep');
    expect(playDeadline({ ...play, paused: true }, 1000, 99_000, true)).toBe('keep');
  });

  it('Anzeige: Restzeit des Minispiels, höchstens bis zum Werten vor der Frist', () => {
    expect(shownRemainingMs(8000, play, 1000, 1000)).toBe(8000);
    // Spiel 16 s zu spät gestartet: 8 s Spielzeit übrig, gewertet wird aber in 5 s.
    expect(shownRemainingMs(8000, play, 1000, 17_000)).toBe(4000);
    expect(shownRemainingMs(4000, play, 1000, 99_000)).toBe(0);
    expect(shownRemainingMs(4000, minigameView('minigame-play'), 0, 99_000)).toBe(4000);
  });
});

describe('intentToMinigameInput', () => {
  it('reicht move/press/release 1:1 durch, Gesten und Reaktionen nicht', () => {
    expect(intentToMinigameInput({ type: 'move', slot: 2, seq: 1, x: 0.5, y: -1 })).toEqual({
      slot: 2,
      input: { type: 'move', x: 0.5, y: -1 },
    });
    expect(intentToMinigameInput({ type: 'press', slot: 3, seq: 2, button: 'b' })).toEqual({
      slot: 3,
      input: { type: 'press', button: 'b' },
    });
    expect(intentToMinigameInput({ type: 'release', slot: 1, seq: 3, button: 'a' })).toEqual({
      slot: 1,
      input: { type: 'release', button: 'a' },
    });
    expect(intentToMinigameInput({ type: 'gesture', slot: 1, seq: 4, kind: 'swipe-up' })).toBe(
      null,
    );
    expect(intentToMinigameInput({ type: 'reaction', slot: 1, seq: 5, windowId: 1 })).toBeNull();
  });
});

describe('playersFromView', () => {
  it('Teilnehmer nach Slot mit Name, Farbe, Symbol und Standardfigur', () => {
    const players = playersFromView(minigameView('minigame-intro'));
    expect(players.map((p) => p.slot)).toEqual([1, 2, 3, 4]);
    expect(players[0]).toEqual({
      slot: 1,
      name: 'Blau',
      color: '#0072B2',
      symbol: '●',
      character: 'robot',
    });
    expect(players.map((p) => p.character)).toEqual(['robot', 'cactus', 'raccoon', 'sock']);
    expect(characterName(minigameView('minigame-intro'), 2)).toBe('Kalle Kaktus');
  });

  it('nimmt die gewählte Figur aus dem Stand (v4, nicht die Standardfigur)', () => {
    const base = minigameView('minigame-intro');
    const view = {
      ...base,
      players: base.players.map((p) =>
        p.slot === 1
          ? { ...p, character: 'sock' as const }
          : p.slot === 4
            ? { ...p, character: 'robot' as const }
            : p,
      ),
    };
    expect(playersFromView(view).map((p) => p.character)).toEqual([
      'sock',
      'cactus',
      'raccoon',
      'robot',
    ]);
    expect(characterName(view, 1)).toBe('Socke Sigi');
  });
});

describe('KI-Plätze im Minispiel (CHAOS-182)', () => {
  const base = minigameView('minigame-play');
  const [first, second] = base.players;
  if (first === undefined || second === undefined) throw new Error('Testansicht braucht 2 Spieler');
  const view = {
    ...base,
    players: [
      {
        ...second,
        kind: 'ai' as const,
        strength: 'schwer' as const,
        personality: 'fuchs' as const,
      },
      first,
    ],
  };

  it('übergibt nur KI-Plätze mit ihrer Stärke an die Bots', () => {
    expect(botSeatsFromView(view)).toEqual([{ slot: second.slot, strength: 1 }]);
    expect(botSeatsFromView(base)).toEqual([]);
  });

  it('Stärke: leicht 0, mittel 0,5, schwer 1, dynamisch startet bei mittel', () => {
    expect(botStrength('leicht')).toBe(0);
    expect(botStrength('mittel')).toBe(0.5);
    expect(botStrength('schwer')).toBe(1);
    expect(botStrength('dynamisch')).toBe(0.5);
    expect(botStrength(undefined)).toBe(0.5);
  });

  it('dynamisch nimmt die aktuelle Stärke aus dem Brett-Stand (CHAOS-187)', () => {
    expect(botStrength('dynamisch', 0.75)).toBe(0.75);
    expect(botStrength('dynamisch', 0)).toBe(0);
    // Feste Stufen bleiben fest.
    expect(botStrength('leicht', 0.75)).toBe(0);
    const dynamic = {
      ...view,
      players: [
        { ...second, kind: 'ai' as const, strength: 'dynamisch' as const, strengthLevel: 0.25 },
      ],
    };
    expect(botSeatsFromView(dynamic)).toEqual([{ slot: second.slot, strength: 0.25 }]);
  });

  it('KI-Abzeichen mit Stil, Menschen ohne', () => {
    expect(aiTaglineOf(view, second.slot)).toBe('KI · Fuchs');
    expect(aiTaglineOf(view, first.slot)).toBeNull();
  });
});
