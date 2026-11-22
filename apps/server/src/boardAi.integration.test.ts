/**
 * Brett-KI im Live-Spiel (CHAOS-181, ADR-020 §3/§6/§8): ganze Brettpartien mit KI-Sitzen über
 * die Session, künstliche Uhr, feste Seeds. Die KI antwortet mit der echten Brett-KI
 * (`createBoardAiPolicy`): Stärke, Denkpause, verpasste Reaktionen, eigene Ströme je Platz.
 */
import { boardAiParams } from '@chaos-party/game-core';
import type { AiStrength, BoardEvent, SlotNumber } from '@chaos-party/protocol';
import { describe, expect, it } from 'vitest';
import {
  assertContiguousEvents,
  INTEGRATION_SEEDS,
  setupGame,
  type Harness,
} from './testHarness.ts';

const AI_SLOTS: readonly SlotNumber[] = [2, 3, 4];

/** 1 Mensch (Harness-Bot) + KI leicht, mittel, schwer; ganze Partie bis zum Endstand. */
function playMixed(
  seed: number,
  strengths: AiStrength[] = ['leicht', 'mittel', 'schwer'],
): Harness {
  const h = setupGame(1, seed, { ai: strengths, rounds: 4 });
  h.runToEnd();
  return h;
}

/** Was eine Partie ausmacht: alle Ereignisse, Endstand und Dauer (Denkpausen eingeschlossen). */
function fingerprint(h: Harness) {
  return { events: h.events, ranking: h.boards.at(-1)?.view.ranking, endedAt: h.clock };
}

function eventsOf<T extends BoardEvent['type']>(
  h: Harness,
  type: T,
): Extract<BoardEvent, { type: T }>[] {
  return h.events.filter((event): event is Extract<BoardEvent, { type: T }> => event.type === type);
}

describe('Brett-KI im Live-Spiel (CHAOS-181)', () => {
  it('ganze Brettpartie mit KI-Sitzen: fester Seed → gleiche Partie bei Wiederholung', () => {
    const a = playMixed(INTEGRATION_SEEDS.four);
    const b = playMixed(INTEGRATION_SEEDS.four);
    expect(a.gamePhase).toBe('game-results');
    expect(fingerprint(b)).toEqual(fingerprint(a));
    // Ein anderer Seed ergibt eine andere Partie.
    expect(fingerprint(playMixed(INTEGRATION_SEEDS.three))).not.toEqual(fingerprint(a));
    assertContiguousEvents(a);
    expect(a.errors).toEqual([]);
  });

  it('KI-Plätze entscheiden selbst: würfeln, wählen Wege, keine Antwort wird abgewiesen', () => {
    for (const seed of [INTEGRATION_SEEDS.two, INTEGRATION_SEEDS.three, INTEGRATION_SEEDS.four]) {
      const h = playMixed(seed);
      expect(h.gamePhase).toBe('game-results');
      expect(h.session.snapshot().aiRejected).toBe(0);
      for (const slot of AI_SLOTS) {
        expect(eventsOf(h, 'dice-rolled').some((event) => event.slot === slot)).toBe(true);
        // Prompts ohne Frist (Würfeln) beantwortet die KI selbst, nie per Zeitablauf.
        const auto = eventsOf(h, 'player-auto').filter(
          (event) => event.slot === slot && event.option === 'roll',
        );
        expect(auto).toEqual([]);
      }
    }
  });

  it('Denkpause: KI antwortet frühestens nach der Mindestpause ihrer Stärke, nie sofort', () => {
    const h = setupGame(1, INTEGRATION_SEEDS.three, { ai: ['schwer', 'leicht'], rounds: 3 });
    const opened = new Map<number, { slot: SlotNumber; at: number; kind: string }>();
    const waits: { slot: SlotNumber; kind: string; ms: number }[] = [];
    let open: number | null = null;
    h.runToEnd(200_000, (x) => {
      const prompt = x.session.snapshot().game?.state.prompt ?? null;
      const id = prompt?.id ?? null;
      if (id !== open) {
        const closed = open === null ? undefined : opened.get(open);
        if (closed) waits.push({ slot: closed.slot, kind: closed.kind, ms: x.clock - closed.at });
        if (prompt && prompt.slot !== 1) {
          opened.set(prompt.id, {
            slot: prompt.slot,
            at: x.clock,
            kind: prompt.kind,
          });
        }
        open = id;
      }
    });
    const decisions = waits.filter((wait) => wait.kind !== 'reaction');
    expect(decisions.length).toBeGreaterThan(5);
    const strengthOf = (slot: SlotNumber) => (slot === 2 ? 1 : 0);
    for (const wait of decisions) {
      const params = boardAiParams(strengthOf(wait.slot));
      expect(wait.ms).toBeGreaterThanOrEqual(params.decisionMs[0]);
    }
  });

  it('Reaktionsfenster: KI reagiert nach ihrer Reaktionszeit oder verpasst – Frist gilt wie für Menschen', () => {
    const results: string[] = [];
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      // Der Mensch setzt Items sofort ein (Klau auf die KI), die KI reagiert selbst.
      const h = setupGame(1, seed, { ai: ['leicht', 'mittel', 'schwer'], rounds: 4 });
      h.runToEnd();
      expect(h.gamePhase).toBe('game-results');
      expect(h.session.snapshot().aiRejected).toBe(0);
      for (const event of eventsOf(h, 'reaction-resolved')) {
        if (AI_SLOTS.includes(event.slot)) results.push(event.result);
      }
    }
    expect(results.length).toBeGreaterThan(3);
    expect(results.some((result) => result !== 'timeout')).toBe(true);
  });

  it('Controller-Kontext nennt Name und Platzart des Platzes am Zug (CHAOS-239)', () => {
    const h = setupGame(1, INTEGRATION_SEEDS.three, { ai: ['mittel'], rounds: 3 });
    const seen = new Map<SlotNumber, { name: string; kind: string }>();
    h.runToEnd(200_000, (x) => {
      const board = x.contexts.get(1)?.context.board;
      if (!board) return;
      if (board.activeSlot === null) {
        expect(board.activeSeat).toBeUndefined();
        return;
      }
      const seat = board.activeSeat;
      expect(seat).toBeDefined();
      if (seat) seen.set(board.activeSlot, seat);
    });
    const names = new Map(h.boards.at(-1)?.view.players.map((p) => [p.slot, p.name]));
    expect(seen.get(2)).toEqual({ name: names.get(2), kind: 'ai' });
    expect(seen.get(1)).toEqual({ name: names.get(1), kind: 'human' });
  });

  it('„Nochmal spielen“: neue Partie mit KI-Sitzen läuft wieder durch', () => {
    const h = playMixed(INTEGRATION_SEEDS.two, ['dynamisch', 'schwer', 'leicht']);
    const first = h.events.length;
    h.rematch();
    expect(h.session.phase).toBe('lobby');
    for (const id of h.controllers.keys()) h.ready(id);
    h.start();
    h.runToEnd();
    expect(h.events.length).toBeGreaterThan(first);
    expect(h.gamePhase).toBe('game-results');
    expect(h.session.snapshot().aiRejected).toBe(0);
    assertContiguousEvents(h);
  });
});
