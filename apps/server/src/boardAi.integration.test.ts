/**
 * Brett-KI im Live-Spiel (CHAOS-181, ADR-020 §3/§6/§8): ganze Brettpartien mit KI-Sitzen über
 * die Session, künstliche Uhr, feste Seeds. Die KI antwortet mit der echten Brett-KI
 * (`createBoardAiPolicy`): Stärke, Denkpause, verpasste Reaktionen, eigene Ströme je Platz.
 */
import { boardAiParams, DYNAMIC_MAX_STEP } from '@chaos-party/game-core';
import type { AiStrength, BoardEvent, SlotNumber } from '@chaos-party/protocol';
import { describe, expect, it } from 'vitest';
import { createBoardAiPolicy, type AiSeatPolicy } from './aiSeat.ts';
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

describe('Dynamische Stärke im Live-Spiel (CHAOS-187)', () => {
  /** `strengthLevel` der KI auf Platz 2 je `board`-Nachricht, mit Runde und Rundenende-Ereignis. */
  function levelsOf(h: Harness) {
    return h.boards.flatMap((message) => {
      const ai = message.view.players.find((player) => player.slot === 2);
      return ai?.strengthLevel === undefined
        ? []
        : [
            {
              level: ai.strengthLevel,
              roundEnded: message.events.some((event) => event.type === 'round-ended'),
            },
          ];
    });
  }

  it('startet bei mittel, ändert sich nur am Rundenende und höchstens um eine halbe Stufe', () => {
    let moved = false;
    for (const seed of [INTEGRATION_SEEDS.two, INTEGRATION_SEEDS.three, INTEGRATION_SEEDS.four]) {
      const h = setupGame(1, seed, { ai: ['dynamisch', 'schwer'], rounds: 6 });
      h.runToEnd();
      expect(h.gamePhase).toBe('game-results');
      expect(h.session.snapshot().aiRejected).toBe(0);
      const levels = levelsOf(h);
      expect(levels[0]?.level).toBe(0.5);
      for (let index = 1; index < levels.length; index++) {
        const [before, after] = [levels[index - 1], levels[index]];
        if (!before || !after || before.level === after.level) continue;
        moved = true;
        expect(after.roundEnded).toBe(true);
        expect(Math.abs(after.level - before.level)).toBeLessThanOrEqual(DYNAMIC_MAX_STEP);
      }
      // Feste Stufen tragen kein strengthLevel.
      const fixed = h.boards.at(-1)?.view.players.find((player) => player.slot === 3);
      expect(fixed?.strength).toBe('schwer');
      expect(fixed?.strengthLevel).toBeUndefined();
    }
    expect(moved).toBe(true);
  });

  it('die Brett-KI entscheidet mit der aktuellen Stärke; gleicher Seed → gleicher Verlauf', () => {
    const seen: (number | undefined)[] = [];
    const spy = (seed: number): AiSeatPolicy => {
      const inner = createBoardAiPolicy(seed);
      return {
        decide: (request) => {
          if (request.slot === 2) seen.push(request.strengthLevel);
          return inner.decide(request);
        },
        readyDelayMs: (slot, strength, level) => inner.readyDelayMs(slot, strength, level),
      };
    };
    const run = () => {
      const h = setupGame(1, INTEGRATION_SEEDS.four, {
        ai: ['dynamisch'],
        rounds: 6,
        session: { aiPolicy: spy },
      });
      h.runToEnd();
      return h;
    };
    const a = run();
    const levels = levelsOf(a).map((entry) => entry.level);
    expect(seen.length).toBeGreaterThan(5);
    for (const level of seen) {
      expect(typeof level).toBe('number');
      expect(levels).toContain(level);
    }
    expect(levelsOf(run())).toEqual(levelsOf(a));
  });
});
