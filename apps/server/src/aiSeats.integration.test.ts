/**
 * KI-Plätze in der Session (CHAOS-179, ADR-020): Lobby-Verwaltung durch Host und Spielleitung,
 * Verdrängen beim Beitritt, Start mit 1–2 Menschen und KI, KI-Sitz als virtueller Controller
 * (gleiche Prüfungen wie Menschen), Reconnect, Host-Verlust, „kein Mensch mehr da“ und Revanche.
 * Künstliche Uhr, feste Seeds; die KI antwortet mit der Brett-KI (CHAOS-181), wo Zeiten genau
 * stimmen müssen mit der festen Test-Politik, oder einer eigenen Test-Politik.
 */
import { rotationInfos } from '@chaos-party/minigames/catalog';
import { type AiStrength } from '@chaos-party/protocol';
import { describe, expect, it } from 'vitest';
import {
  PLACEHOLDER_AI_POLICY,
  PLACEHOLDER_DECISION_MS,
  PLACEHOLDER_READY_MS,
  type AiPromptRequest,
  type AiSeatPolicy,
} from './aiSeat.ts';
import {
  assertContiguousEvents,
  Harness,
  HOST,
  INTEGRATION_SEEDS,
  setupGame,
  TICK_MS,
} from './testHarness.ts';
import { minigameSpecOf } from './game.ts';

const MINIGAME = rotationInfos()[0];
/** Feste Denkpausen für Tests, die genaue Zeiten prüfen (die Brett-KI streut sie). */
const FIXED_POLICY = () => PLACEHOLDER_AI_POLICY;

/** Partie mit einem echten Minispiel (synthetischer Host), 1 Mensch + KI auf Platz 2. */
function minigameHarness(): Harness {
  if (!MINIGAME) throw new Error('Rotation leer');
  const h = new Harness({
    game: { seed: INTEGRATION_SEEDS.two, rounds: 1, minigames: [minigameSpecOf(MINIGAME)] },
    aiPolicy: FIXED_POLICY,
  });
  h.host();
  h.join(1);
  h.aiSeat(2, 'mittel');
  h.ready(1);
  return h;
}

/** Zeit laufen lassen, ohne dass Menschen-Bots antworten. */
function idle(h: Harness, ms: number): void {
  for (let t = 0; t < ms; t += TICK_MS) h.tick();
}

function lobbyHarness(humans: number): Harness {
  const h = new Harness({ game: { seed: INTEGRATION_SEEDS.two, rounds: 2, minigames: [] } });
  h.host();
  for (let id = 1; id <= humans; id++) h.join(id);
  return h;
}

function lobbySeats(h: Harness): [number, string, AiStrength | undefined][] {
  return (h.lobby?.players ?? []).map((p) => [p.slot, p.kind ?? 'human', p.strength]);
}

function errorsOf(h: Harness, to: number): string[] {
  return h.errors.filter((error) => error.to === to).map((error) => error.code);
}

/** Ereignisse, die ein KI-Platz durch eigene Wahl ausgelöst hat (kein `player-auto`). */
function autoEventsOf(h: Harness, slot: number): number {
  return h.events.filter((event) => event.type === 'player-auto' && event.slot === slot).length;
}

describe('Lobby: KI-Plätze verwalten (CHAOS-179)', () => {
  it('Host setzt, ändert und entfernt KI-Plätze; Lobby zeigt Art, Stärke, immer verbunden und bereit', () => {
    const h = lobbyHarness(1);
    h.aiSeat(3, 'schwer');
    h.aiSeat(2, 'mittel');
    expect(lobbySeats(h)).toEqual([
      [1, 'human', undefined],
      [2, 'ai', 'mittel'],
      [3, 'ai', 'schwer'],
    ]);
    const ai = h.lobby?.players.find((p) => p.slot === 3);
    expect(ai).toMatchObject({
      label: 'KI Grün',
      connected: true,
      ready: true,
      character: null,
      kind: 'ai',
    });
    h.aiSeat(3, 'dynamisch');
    h.aiSeat(2, null);
    // Freien Platz entfernen ist kein Fehler.
    h.aiSeat(4, null);
    expect(lobbySeats(h)).toEqual([
      [1, 'human', undefined],
      [3, 'ai', 'dynamisch'],
    ]);
    // Ein Platz mit Mensch bleibt unberührt.
    h.aiSeat(1, 'leicht');
    expect(errorsOf(h, HOST)).toEqual(['bad-message']);
    expect(lobbySeats(h)[0]).toEqual([1, 'human', undefined]);
    // Controller-Kontext zeigt alle belegten Plätze.
    expect(h.contexts.get(1)?.context.lobby?.seats).toEqual([
      { slot: 1, kind: 'human' },
      { slot: 3, kind: 'ai', strength: 'dynamisch' },
    ]);
  });

  it('nur die Spielleitung (niedrigster verbundener Mensch) verwaltet KI-Plätze per ai-seat', () => {
    const h = lobbyHarness(2);
    expect(h.contexts.get(1)?.context.lobby?.lead).toBe(true);
    expect(h.contexts.get(2)?.context.lobby?.lead).toBe(false);

    h.aiSeatFrom(2, 2, 3, 'leicht');
    expect(errorsOf(h, 2)).toEqual(['not-lead']);
    expect(lobbySeats(h)).toHaveLength(2);

    h.aiSeatFrom(1, 1, 3, 'leicht');
    h.aiSeatFrom(1, 1, 3, 'schwer');
    expect(lobbySeats(h)[2]).toEqual([3, 'ai', 'schwer']);
    // Platz eines Menschen → invalid-choice, nichts ändert sich.
    h.aiSeatFrom(1, 1, 2, 'mittel');
    expect(errorsOf(h, 1)).toEqual(['invalid-choice']);

    // Spielleitung trennt sich: Rolle geht an den nächsten Menschen.
    h.disconnect(1);
    expect(h.contexts.get(2)?.context.lobby?.lead).toBe(true);
    h.aiSeatFrom(2, 2, 3, null);
    expect(lobbySeats(h).map(([slot]) => slot)).toEqual([1, 2]);
  });

  it('ai-seat außerhalb der Lobby → out-of-phase', () => {
    const h = setupGame(1, INTEGRATION_SEEDS.two, { ai: ['mittel'] });
    h.aiSeatFrom(1, 1, 3, 'mittel');
    expect(errorsOf(h, 1)).toEqual(['out-of-phase']);
  });

  it('Beitritt bei vollem Haus verdrängt KI-Plätze von der höchsten Nummer an', () => {
    const h = lobbyHarness(1);
    h.aiSeat(2, 'leicht');
    h.aiSeat(3, 'mittel');
    h.aiSeat(4, 'schwer');
    h.join(2);
    expect(h.controller(2).slots).toEqual([4]);
    expect(lobbySeats(h)).toEqual([
      [1, 'human', undefined],
      [2, 'ai', 'leicht'],
      [3, 'ai', 'mittel'],
      [4, 'human', undefined],
    ]);
    // Geteiltes iPad mit zwei Zonen: verdrängt die beiden verbleibenden KI-Plätze.
    h.join(3, 2);
    expect(h.controller(3).slots).toEqual([2, 3]);
    expect(lobbySeats(h).every(([, kind]) => kind === 'human')).toBe(true);
    // Jetzt ist wirklich voll.
    h.join(4);
    expect(errorsOf(h, 4)).toEqual(['session-full']);
  });

  it('Beitritt nimmt freie Plätze vor KI-Plätzen', () => {
    const h = lobbyHarness(1);
    h.aiSeat(2, 'mittel');
    h.join(2);
    expect(h.controller(2).slots).toEqual([3]);
    expect(lobbySeats(h)[1]).toEqual([2, 'ai', 'mittel']);
  });

  it('KI-Plätze bleiben über die Lobby-Schonfrist hinaus (keine Verbindung, kein Token)', () => {
    const h = lobbyHarness(1);
    h.aiSeat(2, 'mittel');
    idle(h, 5 * 60_000);
    expect(lobbySeats(h)).toEqual([
      [1, 'human', undefined],
      [2, 'ai', 'mittel'],
    ]);
  });
});

describe('Start mit Menschen und KI (CHAOS-179)', () => {
  it('Solo: 1 Mensch + 3 KI spielt eine ganze Partie bis zum Endstand', () => {
    const h = setupGame(1, INTEGRATION_SEEDS.four, {
      ai: ['leicht', 'mittel', 'schwer'],
      rounds: 2,
    });
    expect(h.gamePhase).toBeDefined();
    const players = h.boards.at(-1)?.view.players ?? [];
    expect(players.map((p) => [p.slot, p.kind ?? 'human', p.strength])).toEqual([
      [1, 'human', undefined],
      [2, 'ai', 'leicht'],
      [3, 'ai', 'mittel'],
      [4, 'ai', 'schwer'],
    ]);
    // Figuren: Menschen zuerst, KI bekommt freie und heißt nach ihr.
    expect(players.map((p) => [p.character, p.name])).toEqual([
      ['robot', 'Blau'],
      ['cactus', 'Kalle Kaktus'],
      ['raccoon', 'Wusel'],
      ['sock', 'Socke Sigi'],
    ]);
    expect(players.every((p) => p.connected)).toBe(true);
    h.runToEnd();
    expect(h.gamePhase).toBe('game-results');
    // KI-Sitze haben selbst geantwortet (Würfeln hat keine Frist), nie abgewiesen.
    expect(h.session.snapshot().aiRejected).toBe(0);
    for (const slot of [2, 3, 4]) expect(autoEventsOf(h, slot)).toBe(0);
    expect(h.events.filter((e) => e.type === 'turn-started' && e.slot === 4).length).toBe(2);
    expect(h.errors).toEqual([]);
    assertContiguousEvents(h);
  });

  it('2 Menschen + 2 KI starten; Mensch übernimmt die gewählte Figur, KI die freien', () => {
    const h = new Harness({ game: { seed: INTEGRATION_SEEDS.two, rounds: 1, minigames: [] } });
    h.host();
    h.join(1);
    h.join(2);
    h.aiSeat(3, 'mittel');
    h.aiSeat(4, 'mittel');
    h.pickCharacter(2, 2, 'raccoon');
    h.start();
    const players = h.boards.at(-1)?.view.players ?? [];
    expect(players.map((p) => p.character)).toEqual(['robot', 'raccoon', 'cactus', 'sock']);
    h.runToEnd();
    expect(h.gamePhase).toBe('game-results');
    expect(h.session.snapshot().aiRejected).toBe(0);
  });

  it('nur KI ohne Menschen startet nicht', () => {
    const h = new Harness({ game: { seed: 1, minigames: [] } });
    h.host();
    h.aiSeat(1, 'mittel');
    h.aiSeat(2, 'mittel');
    h.start();
    expect(errorsOf(h, HOST)).toEqual(['out-of-phase']);
    expect(h.session.phase).toBe('lobby');
  });

  it('ein getrennter Mensch mit reserviertem Platz zählt nicht als Mitspieler', () => {
    const h = lobbyHarness(1);
    h.aiSeat(2, 'mittel');
    h.disconnect(1);
    h.start();
    expect(errorsOf(h, HOST)).toEqual(['out-of-phase']);
  });

  it('KI antwortet erst nach der Denkpause und drückt in der Minispiel-Anleitung „Bereit“', () => {
    const h = setupGame(1, INTEGRATION_SEEDS.two, {
      ai: ['mittel'],
      session: { aiPolicy: FIXED_POLICY },
    });
    // Warten, bis die KI am Zug ist und würfeln soll.
    h.runUntil((x) => x.boards.at(-1)?.view.prompt?.slot === 2);
    const promptId = h.boards.at(-1)?.view.prompt?.id;
    const openedAt = h.clock;
    idle(h, PLACEHOLDER_DECISION_MS - 2 * TICK_MS);
    expect(h.session.snapshot().game?.state.prompt?.id).toBe(promptId);
    idle(h, 3 * TICK_MS);
    expect(h.session.snapshot().game?.state.prompt?.id).not.toBe(promptId);
    expect(h.clock - openedAt).toBeGreaterThanOrEqual(PLACEHOLDER_DECISION_MS);
  });

  it('KI drückt „Bereit“ in der Minispiel-Anleitung nach ihrer Pause', () => {
    const h = minigameHarness();
    h.start();
    h.runUntil((x) => x.gamePhase === 'minigame-intro');
    const start = h.clock;
    h.runUntil((x) => (x.boards.at(-1)?.view.minigame?.ready ?? []).includes(2));
    expect(h.clock - start).toBeGreaterThanOrEqual(PLACEHOLDER_READY_MS - TICK_MS);
    expect(h.session.snapshot().aiRejected).toBe(0);
  });
});

describe('KI-Sitz als virtueller Controller: gleiche Prüfungen wie Menschen', () => {
  /** Test-Politik: wählt etwas Ungültiges, danach greift der Rückfall auf die Standardoption. */
  function policy(option: (request: AiPromptRequest) => string): AiSeatPolicy {
    return {
      decide: (request) => ({ option: option(request), delayMs: 500 }),
      readyDelayMs: () => 500,
    };
  }

  it.each([
    ['unbekannte Option', () => 'gibts-nicht'],
    ['Item, das die KI nicht hat', () => 'item:trap'],
    ['sich selbst als Klau-Ziel', (r: AiPromptRequest) => `slot:${String(r.slot)}`],
  ])('ungültige KI-Wahl (%s) wird abgewiesen, Partie läuft weiter', (_name, pick) => {
    const h = setupGame(1, INTEGRATION_SEEDS.two, {
      ai: ['mittel'],
      rounds: 1,
      session: { aiPolicy: () => policy(pick) },
    });
    h.runToEnd();
    expect(h.gamePhase).toBe('game-results');
    const rejected = h.session.snapshot().aiRejected;
    expect(rejected).toBeGreaterThan(0);
    // Dieselbe Wahl vom Menschen: game-core weist sie mit invalid-choice ab.
    const human = setupGame(2, INTEGRATION_SEEDS.two, { rounds: 1 });
    human.runUntil((x) => x.openPrompt('roll')?.slot === 2);
    const open = human.openPrompt('roll');
    if (!open) throw new Error('kein Würfel-Prompt');
    human.choose(2, 2, open.prompt.id, 'gibts-nicht');
    expect(human.errors).toEqual([{ to: 2, code: 'invalid-choice' }]);
  });

  it('zu langsame KI verpasst die Reaktionsfrist: Frist entscheidet, nichts hängt', () => {
    // Denkpause länger als die Reaktionsfrist: Antwort kommt nach Ablauf.
    const slow: AiSeatPolicy = {
      decide: (request) => ({
        option: request.defaultOption,
        delayMs: request.prompt.kind === 'reaction' ? 60_000 : 300,
      }),
      readyDelayMs: () => 300,
    };
    const h = setupGame(1, INTEGRATION_SEEDS.two, {
      ai: ['mittel'],
      rounds: 2,
      policy: { useItems: true },
      session: { aiPolicy: () => slow },
    });
    h.runToEnd();
    expect(h.gamePhase).toBe('game-results');
    // Kein Hängen, keine Ausnahme; wenn es eine KI-Reaktion gab, lief sie per Frist aus.
    expect(h.errors).toEqual([]);
  });
});

describe('Lebenszyklus mit KI-Plätzen (CHAOS-179)', () => {
  it('einziger Mensch trennt sich → Partie pausiert (no-humans), KI spielt nicht allein; Reconnect setzt fort', () => {
    const h = setupGame(1, INTEGRATION_SEEDS.three, { ai: ['mittel', 'mittel'], rounds: 2 });
    h.runUntil((x) => x.boards.at(-1)?.view.prompt?.slot === 2);
    const eventsBefore = h.events.length;
    h.disconnect(1);
    expect(h.session.snapshot()).toMatchObject({ pausedBy: 'no-humans' });
    expect(h.session.snapshot().game?.state.paused).toBe(true);
    idle(h, 5 * 60_000);
    expect(h.events.length).toBe(eventsBefore);
    // Host kann nicht ohne Menschen fortsetzen.
    h.resume();
    expect(errorsOf(h, HOST)).toEqual(['paused']);
    h.reconnect(1, 11);
    expect(h.session.snapshot().pausedBy).toBeNull();
    expect(h.session.snapshot().game?.state.paused).toBe(false);
    h.runToEnd();
    expect(h.gamePhase).toBe('game-results');
    assertContiguousEvents(h);
  });

  it('ein von zwei Menschen trennt sich → keine Pause, KI und der andere spielen weiter', () => {
    const h = setupGame(2, INTEGRATION_SEEDS.three, { ai: ['mittel'], rounds: 2 });
    h.runUntil((x) => x.openPrompt('roll') !== null);
    h.disconnect(2);
    expect(h.session.snapshot().pausedBy).toBeNull();
    // KI gilt nie als getrennt.
    expect(h.session.snapshot().players.find((p) => p.slot === 3)?.connected).toBe(true);
    h.runToEnd();
    expect(h.gamePhase).toBe('game-results');
    const view = h.boards.at(-1)?.view;
    expect(view?.players.find((p) => p.slot === 3)?.connected).toBe(true);
    expect(view?.players.find((p) => p.slot === 2)?.connected).toBe(false);
  });

  it('Host-Verlust: Auto-Pause verwirft die KI-Denkpause; nach host-ready beginnt sie neu', () => {
    const h = setupGame(1, INTEGRATION_SEEDS.two, {
      ai: ['mittel'],
      rounds: 2,
      session: { aiPolicy: FIXED_POLICY },
    });
    h.runUntil((x) => x.boards.at(-1)?.view.prompt?.slot === 2);
    const promptId = h.boards.at(-1)?.view.prompt?.id;
    idle(h, PLACEHOLDER_DECISION_MS - 3 * TICK_MS);
    h.dropHost();
    expect(h.session.snapshot().pausedBy).toBe('host-lost');
    idle(h, 60_000);
    expect(h.session.snapshot().game?.state.prompt?.id).toBe(promptId);
    h.host();
    expect(h.session.snapshot().pausedBy).toBeNull();
    // Die Denkpause beginnt neu: kurz nach dem Fortsetzen ist der Prompt noch offen.
    idle(h, 5 * TICK_MS);
    expect(h.session.snapshot().game?.state.prompt?.id).toBe(promptId);
    idle(h, PLACEHOLDER_DECISION_MS);
    expect(h.session.snapshot().game?.state.prompt?.id).not.toBe(promptId);
  });

  it('Host weg, dann auch der Mensch: Host kehrt zurück → wartet weiter auf den Menschen', () => {
    const h = setupGame(1, INTEGRATION_SEEDS.two, { ai: ['schwer'], rounds: 2 });
    h.runUntil((x) => x.openPrompt('roll') !== null);
    h.dropHost();
    h.disconnect(1);
    expect(h.session.snapshot().pausedBy).toBe('host-lost');
    h.host();
    expect(h.session.snapshot().pausedBy).toBe('no-humans');
    h.reconnect(1, 12);
    expect(h.session.snapshot().pausedBy).toBeNull();
    h.runToEnd();
    expect(h.gamePhase).toBe('game-results');
  });

  it('Mensch kommt zurück, solange der Host fehlt → Auto-Pause wartet auf den Host', () => {
    const h = setupGame(1, INTEGRATION_SEEDS.two, { ai: ['leicht'], rounds: 2 });
    h.runUntil((x) => x.openPrompt('roll') !== null);
    h.disconnect(1);
    expect(h.session.snapshot().pausedBy).toBe('no-humans');
    h.dropHost();
    h.reconnect(1, 13);
    expect(h.session.snapshot().pausedBy).toBe('host-lost');
    h.host();
    expect(h.session.snapshot().pausedBy).toBeNull();
  });

  it('Host pausiert während no-humans → eigene Pause; Fortsetzen erst mit Mensch', () => {
    const h = setupGame(1, INTEGRATION_SEEDS.two, { ai: ['mittel'], rounds: 2 });
    h.runUntil((x) => x.openPrompt('roll') !== null);
    h.disconnect(1);
    h.pause();
    expect(h.session.snapshot().pausedBy).toBe('host');
    h.reconnect(1, 14);
    // Die Host-Pause bleibt bis resume.
    expect(h.session.snapshot().pausedBy).toBe('host');
    h.resume();
    expect(h.session.snapshot().pausedBy).toBeNull();
  });

  it('ohne KI bleibt alles wie bisher: Host setzt fort, auch wenn kein Mensch verbunden ist', () => {
    const h = setupGame(1, INTEGRATION_SEEDS.two, { rounds: 2 });
    h.runUntil((x) => x.openPrompt('roll') !== null);
    h.disconnect(1);
    expect(h.session.snapshot().pausedBy).toBeNull();
    h.pause();
    h.resume();
    expect(errorsOf(h, HOST)).toEqual([]);
    expect(h.session.snapshot().pausedBy).toBeNull();
  });

  it('„Nochmal spielen“ behält KI-Plätze mit Stärke, gibt ihre Figur frei; nächste Partie läuft', () => {
    const h = setupGame(1, INTEGRATION_SEEDS.two, { ai: ['schwer', 'dynamisch'], rounds: 1 });
    h.runToEnd();
    h.rematch();
    expect(h.session.phase).toBe('lobby');
    expect(h.lobby?.players.map((p) => [p.slot, p.kind, p.strength, p.character, p.label])).toEqual(
      [
        [1, undefined, undefined, 'robot', 'Blau'],
        [2, 'ai', 'schwer', null, 'KI Orange'],
        [3, 'ai', 'dynamisch', null, 'KI Grün'],
      ],
    );
    expect(h.lobby?.players.filter((p) => p.kind === 'ai').every((p) => p.ready)).toBe(true);
    // Ein Mensch kann jetzt eine Figur wählen, die die KI vorher hatte.
    h.pickCharacter(1, 1, 'cactus');
    expect(h.errors).toEqual([]);
    h.ready(1);
    h.start();
    h.runToEnd();
    expect(h.gamePhase).toBe('game-results');
    expect(h.boards.at(-1)?.view.players.map((p) => p.character)).toEqual([
      'cactus',
      'robot',
      'raccoon',
    ]);
  });

  it('gleicher Seed → gleiche Partie mit KI-Sitzen (deterministisch)', () => {
    const run = (): string[] => {
      const h = setupGame(1, INTEGRATION_SEEDS.four, { ai: ['mittel', 'mittel'], rounds: 2 });
      h.runToEnd();
      return h.events.map((event) => JSON.stringify(event));
    };
    expect(run()).toEqual(run());
  });

  it('Übungsrunde (Galerie) mit KI-Platz läuft und kehrt in die Lobby zurück', () => {
    const h = minigameHarness();
    h.startPractice(MINIGAME?.id ?? '');
    expect(h.session.snapshot().game?.state.players.map((p) => p.slot)).toEqual([1, 2]);
    expect(h.boards.at(-1)?.view.practice).toBe(true);
    h.runUntil((x) => (x.boards.at(-1)?.view.minigame?.ready ?? []).includes(2));
    h.endGame();
    expect(h.session.phase).toBe('lobby');
    expect(h.lobby?.players.map((p) => p.kind ?? 'human')).toEqual(['human', 'ai']);
  });
});
