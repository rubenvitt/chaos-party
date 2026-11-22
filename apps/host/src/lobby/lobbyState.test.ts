import { describe, expect, it } from 'vitest';
import {
  boardOptions,
  cardCharacter,
  chosenBoardName,
  minigamePrefs,
  minigameSummary,
  nextBoardId,
  roundOptions,
  roundsDuration,
  startState,
  toggleMinigame,
} from './lobbyState.ts';

function at<T>(list: readonly T[], index: number): T {
  const item = list[index];
  if (item === undefined) throw new Error(`Index ${String(index)} fehlt`);
  return item;
}

const p = (label: string, connected: boolean, ready: boolean) => ({ label, connected, ready });

describe('startState', () => {
  it('ohne Verbindung oder ohne verbundenen Spieler: Knopf aus', () => {
    expect(startState([], 'connected')).toMatchObject({ readiness: 'blocked', enabled: false });
    expect(startState([p('Blau', false, true)], 'connected').enabled).toBe(false);
    expect(startState([p('Blau', true, true)], 'disconnected').enabled).toBe(false);
  });

  it('ein Spieler: Start bleibt möglich (Probelauf), Knopf leuchtet nicht', () => {
    const state = startState([p('Blau', true, true), p('Rosa', false, false)], 'connected');
    expect(state).toMatchObject({ readiness: 'solo', enabled: true, highlighted: false });
    expect(state.hint).toContain('ab 2 Spielern');
  });

  it('zwei verbunden, nicht alle bereit: erlaubt, nennt die Wartenden', () => {
    const state = startState(
      [p('Blau', true, true), p('Mia', true, false), p('Grün', true, false)],
      'connected',
    );
    expect(state).toMatchObject({ readiness: 'waiting', enabled: true, highlighted: false });
    expect(state.hint).toBe('Mia und Grün sind noch nicht bereit – starten geht trotzdem.');
    expect(startState([p('Blau', true, true), p('Mia', true, false)], 'connected').hint).toBe(
      'Mia ist noch nicht bereit – starten geht trotzdem.',
    );
  });

  it('ab zwei verbundenen, bereiten Spielern leuchtet der Knopf; Getrennte zählen nicht', () => {
    const state = startState(
      [p('Blau', true, true), p('Orange', true, true), p('Grün', false, false)],
      'connected',
    );
    expect(state).toMatchObject({ readiness: 'ready', enabled: true, highlighted: true });
  });
});

describe('startState mit KI-Plätzen (CHAOS-182)', () => {
  const ai = (label: string) => ({ label, connected: true, ready: true, kind: 'ai' as const });

  it('1 Mensch + KI ist eine echte Partie und leuchtet, wenn der Mensch bereit ist', () => {
    expect(startState([p('Blau', true, true), ai('KI Orange')], 'connected')).toMatchObject({
      readiness: 'ready',
      enabled: true,
      highlighted: true,
    });
    const waiting = startState([p('Blau', true, false), ai('KI Orange')], 'connected');
    expect(waiting.readiness).toBe('waiting');
    expect(waiting.hint).toBe('Blau ist noch nicht bereit – starten geht trotzdem.');
  });

  it('nur KI ohne verbundenen Menschen startet nicht', () => {
    const state = startState([p('Blau', false, true), ai('KI Orange'), ai('KI Grün')], 'connected');
    expect(state).toMatchObject({ readiness: 'blocked', enabled: false });
    expect(state.hint).toContain('Mensch');
  });

  it('allein schlägt der Hinweis eine KI vor', () => {
    expect(startState([p('Blau', true, true)], 'connected').hint).toContain('KI');
  });
});

describe('roundOptions', () => {
  it('zeigt die Vorschläge und markiert die Einstellung', () => {
    expect(roundOptions({ rounds: 16, roundPresets: [10, 16, 20] })).toEqual([
      { rounds: 10, selected: false, custom: false },
      { rounds: 16, selected: true, custom: false },
      { rounds: 20, selected: false, custom: false },
    ]);
  });

  it('nimmt eine abweichende Einstellung (z. B. ?rounds=2) sortiert dazu', () => {
    expect(roundOptions({ rounds: 2, roundPresets: [10, 16, 20] }).map((o) => o.rounds)).toEqual([
      2, 10, 16, 20,
    ]);
    expect(roundOptions({ rounds: 2, roundPresets: [10, 16, 20] })[0]).toEqual({
      rounds: 2,
      selected: true,
      custom: true,
    });
  });

  it('Spieldauer als grober Richtwert (EXP-011), je nach Spielerzahl', () => {
    // Vorschläge 10/16/20 mit vier Spielern (Standard, auch für 0–1 Spieler).
    expect(roundsDuration(10)).toBe('≈ 15 Min.');
    expect(roundsDuration(16)).toBe('≈ 25 Min.');
    expect(roundsDuration(20)).toBe('≈ 30 Min.');
    expect(roundsDuration(10, 1)).toBe('≈ 15 Min.');
    // Weniger Spieler, kürzere Runden.
    expect(roundsDuration(16, 3)).toBe('≈ 20 Min.');
    // 20 Runden zu zweit: ≈ 22 min (EXP-011, Nachtrag CHAOS-66).
    expect(roundsDuration(20, 2)).toBe('≈ 20 Min.');
    expect(roundsDuration(1)).toBe('≈ 5 Min.');
  });
});

describe('cardCharacter', () => {
  it('zeigt die gewählte Figur mit Namen', () => {
    const players = [{ slot: 1 as const, character: 'sock' as const }];
    expect(cardCharacter(at(players, 0), players)).toEqual({
      character: 'sock',
      chosen: true,
      text: 'Socke Sigi',
    });
  });

  it('ohne Wahl: „wählt noch …“ mit der Figur, die der Server zuweisen würde', () => {
    const players = [
      { slot: 1 as const, character: 'cactus' as const },
      { slot: 2 as const, character: null },
      { slot: 3 as const, character: null },
    ];
    // Slot 2 hätte Kaktus (vergeben) → erste freie: Roboter; Slot 3 behält Waschbär.
    expect(cardCharacter(at(players, 1), players)).toEqual({
      character: 'robot',
      chosen: false,
      text: 'wählt noch …',
    });
    expect(cardCharacter(at(players, 2), players).character).toBe('raccoon');
  });

  it('Vorschläge kollidieren nicht untereinander', () => {
    const players = [
      { slot: 1 as const, character: null },
      { slot: 2 as const, character: 'robot' as const },
      { slot: 4 as const, character: null },
    ];
    const one = cardCharacter(at(players, 0), players).character;
    const four = cardCharacter(at(players, 2), players).character;
    expect(one).toBe('cactus');
    expect(four).toBe('sock');
  });

  it('KI bekommt ihre Figur nach den Menschen (CHAOS-182, wie der Server)', () => {
    const players = [
      { slot: 1 as const, character: 'raccoon' as const },
      { slot: 2 as const, character: null, kind: 'ai' as const },
      { slot: 3 as const, character: null },
      { slot: 4 as const, character: 'robot' as const },
    ];
    // Slot 3 (Mensch) zuerst: Waschbär vergeben → Kaktus. Danach die KI auf Slot 2 → Socke.
    expect(cardCharacter(at(players, 2), players).character).toBe('cactus');
    expect(cardCharacter(at(players, 1), players)).toEqual({
      character: 'sock',
      chosen: false,
      text: 'Figur beim Start',
    });
  });
});

describe('boardOptions (CHAOS-197)', () => {
  const wald = {
    id: 'wackelwald',
    name: 'Wackelwald',
    tagline: 'Rundkurs',
    spaces: 43,
    recommendedRounds: 10,
  };
  const gipfel = { ...wald, id: 'frostgipfel', name: 'Frostgipfel', spaces: 80 };
  const base = { rounds: 10, roundPresets: [10] };

  it('ohne Bretter vom Server keine Auswahl (älterer Server)', () => {
    expect(boardOptions(base)).toEqual([]);
    expect(chosenBoardName(base)).toBeNull();
  });

  it('listet die Bretter in Server-Reihenfolge, dahinter Zufall, und markiert die Wahl', () => {
    const options = boardOptions({ ...base, board: 'frostgipfel', boards: [wald, gipfel] });
    expect(options.map((o) => [o.id, o.selected, o.random])).toEqual([
      ['wackelwald', false, false],
      ['frostgipfel', true, false],
      ['zufall', false, true],
    ]);
    expect(at(options, 0).detail).toBe('43 Felder');
    expect(chosenBoardName({ ...base, board: 'frostgipfel', boards: [wald, gipfel] })).toBe(
      'Frostgipfel',
    );
  });

  it('Zufall gewählt; ohne board gilt das erste Brett', () => {
    const random = boardOptions({ ...base, board: 'zufall', boards: [wald] });
    expect(random.filter((o) => o.selected).map((o) => o.id)).toEqual(['zufall']);
    expect(chosenBoardName({ ...base, board: 'zufall', boards: [wald] })).toBe('Zufallsbrett');
    expect(boardOptions({ ...base, boards: [wald] }).find((o) => o.selected)?.id).toBe(
      'wackelwald',
    );
    expect(chosenBoardName({ ...base, boards: [wald] })).toBe('Wackelwald');
  });

  it('Wechselknopf: nächstes Brett, nach Zufall wieder das erste', () => {
    const settings = (board: string) => ({ ...base, board, boards: [wald, gipfel] });
    expect(nextBoardId(boardOptions(settings('wackelwald')))).toBe('frostgipfel');
    expect(nextBoardId(boardOptions(settings('frostgipfel')))).toBe('zufall');
    expect(nextBoardId(boardOptions(settings('zufall')))).toBe('wackelwald');
    expect(() => nextBoardId([])).toThrow();
  });
});

describe('Minispiel-Rotation in der Lobby (CHAOS-85)', () => {
  const settings = {
    rounds: 10,
    roundPresets: [10],
    minigames: [
      { id: 'sockenregen', title: 'Sockenregen', blocked: true, favorite: false },
      { id: 'wackelturm', title: 'Wackelturm', blocked: false, favorite: true },
      { id: 'pudding-gerangel', title: 'Pudding-Gerangel', blocked: false, favorite: false },
    ],
  };
  const order = settings.minigames.map((game) => game.id);

  it('liest Sperrliste und Favoriten aus dem Server-Stand', () => {
    expect(minigamePrefs(settings)).toEqual({
      blocklist: ['sockenregen'],
      favorites: ['wackelturm'],
    });
    expect(minigamePrefs({ rounds: 10, roundPresets: [10] })).toEqual({
      blocklist: [],
      favorites: [],
    });
  });

  it('Favorit und Sperre schließen sich aus; Reihenfolge wie im Katalog', () => {
    const prefs = minigamePrefs(settings);
    expect(toggleMinigame(prefs, 'sockenregen', 'favorite', order)).toEqual({
      blocklist: [],
      favorites: ['sockenregen', 'wackelturm'],
    });
    expect(toggleMinigame(prefs, 'wackelturm', 'blocked', order)).toEqual({
      blocklist: ['sockenregen', 'wackelturm'],
      favorites: [],
    });
    expect(toggleMinigame(prefs, 'sockenregen', 'blocked', order)).toEqual({
      blocklist: [],
      favorites: ['wackelturm'],
    });
  });

  it('fasst den Stand für den Knopf zusammen', () => {
    expect(minigameSummary(settings)).toEqual({
      short: '2 im Topf · 1 ★ · 1 ⦸',
      long: '2 im Topf, 1 Favorit, 1 gesperrt',
    });
    expect(
      minigameSummary({
        ...settings,
        minigames: settings.minigames.map((game) => ({ ...game, blocked: false, favorite: true })),
      }),
    ).toEqual({ short: '3 im Topf · 3 ★', long: '3 im Topf, 3 Favoriten' });
    expect(minigameSummary({ rounds: 10, roundPresets: [10] })).toBeNull();
    expect(minigameSummary({ ...settings, minigames: [] })).toBeNull();
  });
});
