/**
 * CHAOS-38: Controller-Trennung und Wiederkehr in jeder Phase, ohne dass die Partie abbricht
 * (ADR-009, ADR-015). Deterministisch mit festen Seeds und künstlicher Uhr.
 *
 * Je Phase wird geprüft: richtiger Kontext direkt nach `reconnect`, die Standardoption greift
 * nach `disconnectGraceMs` (bzw. nach der Reaktionsfrist), die Partie läuft bis zum Endstand
 * weiter und die Ereignisse am Host sind lückenlos und ohne Doppelte (`assertContiguousEvents`).
 */
import { DEFAULT_RULES } from '@chaos-party/game-core';
import { createMessage, type ContextMessage, type SlotNumber } from '@chaos-party/protocol';
import { rotationInfos } from '@chaos-party/minigames/catalog';
import { describe, expect, it } from 'vitest';
import {
  assertContiguousEvents,
  Harness,
  INTEGRATION_SEEDS,
  playMinigameAsHost,
  pressInMinigame,
  setupGame,
  setupMinigameGame,
  TICK_MS,
} from './testHarness.ts';

type PromptKind = NonNullable<ContextMessage['prompt']>['kind'];

const GRACE_MS = DEFAULT_RULES.pacing.disconnectGraceMs;
const ROTATION = rotationInfos().map((info) => info.id);
/** Neue Verbindungs-IDs für Reconnects (je Test fortlaufend). */
let nextId = 500;

/** Standardoption je Prompt-Art (ADR-011); `path` = erster Nachfolger, hier offen. */
const DEFAULT_OPTION: Record<Exclude<PromptKind, 'path'>, string> = {
  roll: 'roll',
  target: 'cancel',
  trophy: 'skip',
  reaction: 'none',
};

function idle(h: Harness, ms: number): void {
  for (let t = 0; t < ms; t += TICK_MS) h.tick();
}

function context(h: Harness, slot: SlotNumber): ContextMessage {
  const entry = h.contexts.get(slot);
  if (!entry) throw new Error(`kein Kontext für Slot ${String(slot)}`);
  return entry.context;
}

function lastView(h: Harness) {
  const view = h.boards.at(-1)?.view;
  if (!view) throw new Error('kein Brett-Stand');
  return view;
}

/** Trennt den Controller eines Slots und verbindet ihn mit neuer ID wieder. */
function reconnectSlot(h: Harness, slot: SlotNumber): void {
  const controller = h.controllerOf(slot);
  if (controller.connected) h.disconnect(controller.id);
  h.reconnect(controller.id, nextId++);
}

/** Der Kontext nach dem Reconnect passt zum Stand am Host (Phase, Münzen, Trophäen, Pause). */
function expectContextMatchesHost(h: Harness, slot: SlotNumber): void {
  const view = lastView(h);
  const player = view.players.find((p) => p.slot === slot);
  expect(context(h, slot)).toMatchObject({
    phase: 'board',
    board: {
      gamePhase: view.gamePhase,
      round: view.round,
      coins: player?.coins,
      trophies: player?.trophies,
      paused: view.paused,
      activeSlot: view.activeSlot,
    },
  });
}

function finish(h: Harness): void {
  h.runToEnd();
  expect(h.gamePhase).toBe('game-results');
  assertContiguousEvents(h);
  expect(h.boards.at(-1)?.view.players.every((p) => p.connected)).toBe(true);
}

/**
 * Szenario je Prompt-Art: Partie bis zum ersten Prompt der Art, Besitzer trennt sich.
 * `within`: Rückkehr vor Ablauf der Frist → derselbe Prompt ist wieder da und die eigene Wahl
 * zählt. `after`: Rückkehr nach der Auto-Wahl → Kontext zeigt den neuen Stand.
 */
function promptScenario(
  kind: PromptKind,
  mode: 'within' | 'after',
  setup: { players: number; seed: number; rounds: number },
): void {
  const h = setupGame(setup.players, setup.seed, {
    rounds: setup.rounds,
    policy: { useItems: true, reaction: 'brace' },
  });
  h.runUntil((x) => x.openPrompt(kind) !== null || x.gamePhase === 'game-results');
  const open = h.openPrompt(kind);
  if (!open) throw new Error(`Prompt ${kind} kam mit Seed ${String(setup.seed)} nicht vor`);
  const { slot, prompt } = open;
  const controller = h.controllerOf(slot);
  h.disconnect(controller.id);
  const lostAt = h.clock;
  expect(lastView(h).players.find((p) => p.slot === slot)?.connected).toBe(false);

  if (mode === 'within') {
    // Kurz weg (Neuladen): derselbe Prompt mit derselben ID, wählbar; Frist wieder regulär.
    idle(h, kind === 'reaction' ? 1_000 : 5_000);
    expect(h.events.some((e) => e.type === 'player-auto')).toBe(false);
    reconnectSlot(h, slot);
    expect(context(h, slot)).toMatchObject({
      layout: 'board',
      actions: ['choose'],
      prompt: { id: prompt.id, kind },
    });
    if (kind === 'reaction') {
      expect(context(h, slot).prompt?.remainingMs).toBeLessThanOrEqual(
        DEFAULT_RULES.pacing.reactionWindowMs - 1_000,
      );
    } else {
      expect(context(h, slot).prompt?.remainingMs).toBeNull();
    }
    expectContextMatchesHost(h, slot);
    finish(h);
    // Die Wahl kam vom Spieler selbst, nicht vom Server.
    expect(h.events.some((e) => e.type === 'player-auto' && e.slot === slot)).toBe(false);
    expect(h.errors).toEqual([]);
    return;
  }

  // Weg bis über die Frist: Standardoption, Grund `disconnected`.
  h.runUntil((x) => x.events.some((e) => e.type === 'player-auto' && e.slot === slot));
  const auto = h.events.find((e) => e.type === 'player-auto' && e.slot === slot);
  const expected = kind === 'path' ? prompt.options[0]?.id : DEFAULT_OPTION[kind];
  expect(auto).toEqual({ type: 'player-auto', slot, option: expected, reason: 'disconnected' });
  const waited = h.clock - lostAt;
  if (kind === 'reaction') {
    expect(waited).toBeLessThanOrEqual(DEFAULT_RULES.pacing.reactionWindowMs + TICK_MS);
  } else {
    expect(waited).toBeGreaterThanOrEqual(GRACE_MS);
    expect(waited).toBeLessThanOrEqual(GRACE_MS + TICK_MS);
  }
  reconnectSlot(h, slot);
  // Der alte Prompt ist weg; Kontext zeigt den aktuellen Stand.
  expect(context(h, slot).prompt?.id).not.toBe(prompt.id);
  expectContextMatchesHost(h, slot);
  finish(h);
  expect(h.errors).toEqual([]);
}

/**
 * Seed, bei dem in 3 Runden mit 3 Spielern jede Prompt-Art vorkommt (Klau, Reaktion, Trophäe).
 * Seit dem Trostpreis nach dem Minispiel (EXP-019, CHAOS-51) Seed 2 statt 1, seit dem großen
 * Wackelwald (CHAOS-196) Seed 6.
 */
const ALL_PROMPTS_SEED = 6;

const PROMPT_CASES: [PromptKind, { players: number; seed: number; rounds: number }][] = [
  ['roll', { players: 2, seed: INTEGRATION_SEEDS.two, rounds: 2 }],
  ['path', { players: 3, seed: INTEGRATION_SEEDS.three, rounds: 3 }],
  ['target', { players: 3, seed: ALL_PROMPTS_SEED, rounds: 3 }],
  ['reaction', { players: 3, seed: ALL_PROMPTS_SEED, rounds: 3 }],
  ['trophy', { players: 3, seed: ALL_PROMPTS_SEED, rounds: 3 }],
];

describe('Reconnect in jeder Phase (CHAOS-38)', () => {
  describe.each(PROMPT_CASES)('Prompt %s', (kind, setup) => {
    it('Rückkehr innerhalb der Frist: derselbe Prompt, eigene Wahl zählt', () => {
      promptScenario(kind, 'within', setup);
    });
    it('Rückkehr nach der Frist: Standardoption, Kontext zeigt den neuen Stand', () => {
      promptScenario(kind, 'after', setup);
    });
  });

  it('Lobby: Figur und Bereitschaft überleben einen Reconnect in der Schonfrist, danach ist beides frei', () => {
    const h = new Harness({ game: { seed: 3, rounds: 1, minigames: [] } });
    h.host();
    h.join(1);
    h.join(2);
    h.pickCharacter(1, 1, 'sock');
    h.ready(1);
    h.disconnect(1);
    expect(h.lobby?.players.find((p) => p.slot === 1)).toMatchObject({
      connected: false,
      character: 'sock',
      ready: true,
    });
    // Anderer Spieler kann die Figur des getrennten (reservierten) Platzes nicht nehmen.
    h.pickCharacter(2, 2, 'sock');
    expect(h.errors).toEqual([{ to: 2, code: 'character-taken' }]);
    h.errors.length = 0;

    idle(h, 59_000);
    h.reconnect(1, 11);
    expect(context(h, 1)).toMatchObject({
      phase: 'lobby',
      layout: 'wait',
      actions: ['pick-character'],
      lobby: { character: 'sock', takenCharacters: [] },
    });
    expect(h.lobby?.players.find((p) => p.slot === 1)).toMatchObject({
      connected: true,
      character: 'sock',
      ready: true,
    });

    // Die Schonfrist beginnt nach dem Reconnect neu; nach 60 s ist der Platz frei.
    h.disconnect(11);
    idle(h, 60_000);
    expect(h.lobby?.players.map((p) => p.slot)).toEqual([2]);
    h.reconnect(11, 12);
    expect(h.errors.at(-1)).toEqual({ to: 12, code: 'bad-token' });
    h.errors.length = 0;
    h.pickCharacter(2, 2, 'sock');
    expect(h.errors).toEqual([]);
    expect(context(h, 2).lobby?.character).toBe('sock');
    // Neuer Beitritt bekommt den freien Slot 1 ohne Figur.
    h.join(13);
    expect(context(h, 1).lobby).toMatchObject({ character: null, takenCharacters: ['sock'] });
  });

  it('Lobby → Start: getrennt-reservierter Spieler spielt nicht mit, sieht nach Rückkehr „warten“', () => {
    const h = new Harness({ game: { seed: 3, rounds: 1, minigames: [] } });
    h.host();
    h.join(1);
    h.join(2);
    h.pickCharacter(2, 2, 'raccoon');
    h.disconnect(2);
    h.ready(1);
    h.start();
    expect(lastView(h).players.map((p) => p.slot)).toEqual([1]);
    h.reconnect(2, 22);
    expect(context(h, 2)).toMatchObject({ phase: 'board', layout: 'wait', actions: [] });
    h.runToEnd();
    expect(h.gamePhase).toBe('game-results');
    // Nach der Revanche spielt er wieder mit, Figur behalten.
    h.rematch();
    expect(context(h, 2).lobby?.character).toBe('raccoon');
    h.ready(1);
    h.ready(22);
    h.start();
    expect(lastView(h).players.map((p) => [p.slot, p.character])).toEqual([
      [1, 'robot'],
      [2, 'raccoon'],
    ]);
  });

  it('Minispiel Intro, Spiel und Ergebnis: Kontext stimmt, Eingaben fließen nach der Rückkehr', () => {
    const id = ROTATION[0] ?? 'pump-parade';
    const h = setupMinigameGame(id, 3, INTEGRATION_SEEDS.three, 1);
    const sent = new Set<number>();
    const startedAt = new Map<number, number>();
    const pressed = new Map<SlotNumber, number>();

    // Intro.
    h.runUntil((x) => x.gamePhase === 'minigame-intro');
    reconnectSlot(h, 2);
    // CHAOS-214: Nach der Rückkehr wird „Bereit“ weiter angeboten.
    expect(context(h, 2)).toMatchObject({
      layout: 'board',
      actions: ['ready'],
      minigame: { id, stage: 'intro', aborted: false, ready: false },
    });

    // Spiel: getrennt während des Spiels, zurück mit Joystick/Knöpfen; Eingabe kommt an.
    h.runUntil((x) => x.gamePhase === 'minigame-play');
    h.disconnect(h.controllerOf(2).id);
    idle(h, 2_000);
    reconnectSlot(h, 2);
    const play = context(h, 2);
    expect(play).toMatchObject({ layout: 'joystick-buttons', minigame: { stage: 'play' } });
    expect(play.actions.length).toBeGreaterThan(0);
    const inputsBefore = h.hostInputs.length;
    pressInMinigame(h, pressed);
    expect(h.hostInputs.slice(inputsBefore).some((input) => input.intent.slot === 2)).toBe(true);

    h.runUntil(
      (x) => x.gamePhase === 'minigame-results',
      10_000,
      (x) => {
        pressInMinigame(x, pressed);
        playMinigameAsHost(x, { sent, startedAt });
      },
    );
    // Ergebnis: Platz, Münzen und Gleichstand im Kontext nach Rückkehr.
    reconnectSlot(h, 2);
    const own = lastView(h).minigame?.placements?.find((p) => p.slot === 2);
    expect(context(h, 2)).toMatchObject({
      layout: 'board',
      // Daumen nach dem Minispiel (CHAOS-87) bleiben nach der Rückkehr möglich.
      actions: ['rate'],
      minigame: { stage: 'results', place: own?.place, aborted: false },
    });
    expect(context(h, 2).minigame?.reward).toBeTypeOf('number');
    expect(h.acks.every((ack) => ack.accepted)).toBe(true);
    finish(h);
    expect(h.errors).toEqual([]);
  });

  it('Minispiel: Spieler bleibt bis zum Ende getrennt – Ergebnis zählt ihn mit, kein Abbruch', () => {
    const id = ROTATION[1] ?? ROTATION[0] ?? 'pump-parade';
    const h = setupMinigameGame(id, 2, INTEGRATION_SEEDS.two, 1);
    const sent = new Set<number>();
    const startedAt = new Map<number, number>();
    const pressed = new Map<SlotNumber, number>();
    h.runUntil((x) => x.gamePhase === 'minigame-play');
    h.disconnect(h.controllerOf(1).id);
    h.runUntil(
      (x) => x.gamePhase === 'minigame-results',
      10_000,
      (x) => {
        pressInMinigame(x, pressed);
        playMinigameAsHost(x, { sent, startedAt });
      },
    );
    expect(lastView(h).minigame?.aborted).toBe(false);
    expect(
      lastView(h)
        .minigame?.placements?.map((p) => p.slot)
        .sort(),
    ).toEqual([1, 2]);
    reconnectSlot(h, 1);
    expect(context(h, 1).minigame?.stage).toBe('results');
    finish(h);
  });

  it('Pause: Trennung in der Pause löst keine Auto-Wahl aus; Schonfrist zählt erst nach resume', () => {
    const h = setupGame(2, INTEGRATION_SEEDS.two, { rounds: 1 });
    h.runUntil((x) => x.openPrompt('roll') !== null);
    const open = h.openPrompt('roll');
    if (!open) throw new Error('kein Prompt');
    h.pause();
    h.disconnect(h.controllerOf(open.slot).id);
    idle(h, 3 * GRACE_MS);
    expect(h.events.some((e) => e.type === 'player-auto')).toBe(false);

    // Rückkehr in der Pause: Kontext pausiert, Prompt nicht angeboten.
    reconnectSlot(h, open.slot);
    expect(context(h, open.slot)).toMatchObject({ layout: 'board', actions: [] });
    expect(context(h, open.slot).board?.paused).toBe(true);
    // Wieder weg; Fortsetzen → Auto-Wahl erst eine volle Schonfrist nach resume.
    h.disconnect(h.controllerOf(open.slot).id);
    idle(h, 10_000);
    h.resume();
    const resumedAt = h.clock;
    h.runUntil((x) => x.events.some((e) => e.type === 'player-auto'));
    expect(h.clock - resumedAt).toBeGreaterThanOrEqual(GRACE_MS);
    expect(h.clock - resumedAt).toBeLessThanOrEqual(GRACE_MS + TICK_MS);
    expect(h.events.find((e) => e.type === 'player-auto')).toMatchObject({
      slot: open.slot,
      option: 'roll',
      reason: 'disconnected',
    });
    reconnectSlot(h, open.slot);
    expectContextMatchesHost(h, open.slot);
    finish(h);
    expect(h.errors).toEqual([]);
  });

  it('Endstand und Revanche: Platz nach Reconnect, nach der Revanche Lobby mit Figur, neue Partie', () => {
    const h = setupGame(3, INTEGRATION_SEEDS.three, { rounds: 1 });
    h.runToEnd();
    reconnectSlot(h, 3);
    const entry = lastView(h).ranking?.find((r) => r.slot === 3);
    expect(context(h, 3).board).toMatchObject({
      gamePhase: 'game-results',
      place: entry?.place,
      tied: entry?.decidedBy === 'shared',
      endedEarly: false,
    });
    const character = lastView(h).players.find((p) => p.slot === 3)?.character;
    h.rematch();
    reconnectSlot(h, 3);
    expect(context(h, 3)).toMatchObject({
      phase: 'lobby',
      layout: 'lobby',
      actions: ['ready', 'pick-character'],
      lobby: { character },
    });
    for (const controller of h.controllers.values()) h.ready(controller.id);
    h.start();
    expect(lastView(h).players.map((p) => p.slot)).toEqual([1, 2, 3]);
    finish(h);
    expect(h.errors).toEqual([]);
  });

  it('geteiltes iPad: beide Zonen kommen mit einem Reconnect zurück, mitten in einer Wahl', () => {
    const h = setupGame(3, INTEGRATION_SEEDS.three, { seats: [1, 2], rounds: 2 });
    h.runUntil((x) => {
      const open = x.openPrompt();
      return open !== null && open.slot !== 1;
    });
    const open = h.openPrompt();
    if (!open) throw new Error('kein Prompt');
    const ipad = h.controllerOf(open.slot);
    expect(ipad.slots).toEqual([2, 3]);
    h.disconnect(ipad.id);
    expect(
      lastView(h)
        .players.filter((p) => !p.connected)
        .map((p) => p.slot),
    ).toEqual([2, 3]);
    idle(h, 3_000);
    h.reconnect(ipad.id, 77);
    expect(h.controller(77).slots).toEqual([2, 3]);
    expect(context(h, open.slot).prompt?.id).toBe(open.prompt.id);
    expectContextMatchesHost(h, 2);
    expectContextMatchesHost(h, 3);
    finish(h);
    expect(h.errors).toEqual([]);
  });

  it('Reconnect, während die alte Verbindung noch offen ist (zweiter Tab): alte wird ersetzt', () => {
    const h = setupGame(2, INTEGRATION_SEEDS.two, { rounds: 1 });
    h.runUntil((x) => x.openPrompt('roll') !== null);
    const open = h.openPrompt('roll');
    if (!open) throw new Error('kein Prompt');
    const old = h.controllerOf(open.slot);
    const token = old.token;
    if (!token) throw new Error('kein Token');
    // Neue Verbindung ohne vorherigen Abriss.
    h.send(old.id, createMessage('heartbeat', { t: 1 }));
    h.reconnect(old.id, 90);
    expect(h.session.snapshot().players.find((p) => p.slot === open.slot)?.connectionId).toBe(90);
    expect(context(h, open.slot).prompt?.id).toBe(open.prompt.id);
    // Kein Abriss sichtbar und keine Auto-Wahl: der Prompt behält seine reguläre Frist.
    finish(h);
    expect(h.events.some((e) => e.type === 'player-auto')).toBe(false);
  });
});
