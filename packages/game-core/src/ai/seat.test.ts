import { describe, expect, it } from 'vitest';
import { DEFAULT_BOARD } from '../board/index.ts';
import { DEFAULT_RULES } from '../rules/defaults.ts';
import { step } from '../rules/machine.ts';
import { BRACE_OPTION, ROLL_OPTION, SHIELD_OPTION } from '../rules/prompts.ts';
import { newGame, settle, start } from '../rules/testUtils.ts';
import type { GameState, Prompt } from '../types.ts';
import { distanceTo, TRAP_LOOKAHEAD } from './board.ts';
import {
  AI_DEADLINE_MARGIN_MS,
  AI_STREAM_PURPOSES,
  aiStreamSeed,
  answerBoardPrompt,
  boardAiReadyDelay,
  createBoardAiSeat,
} from './seat.ts';
import { boardAiParams } from './strength.ts';

const STATE = newGame({ board: DEFAULT_BOARD, ruleSet: DEFAULT_RULES, players: 2, seed: 3 });

function reactionPrompt(withShield: boolean): Prompt {
  return {
    id: 1,
    slot: 2,
    kind: 'reaction',
    title: 'Festhalten!',
    options: [
      { id: BRACE_OPTION, label: 'Festhalten' },
      ...(withShield ? [{ id: SHIELD_OPTION, label: 'Schild' }] : []),
    ],
    defaultOption: 'none',
    deadline: 3000,
  };
}

const ROLL_PROMPT: Prompt = {
  id: 2,
  slot: 1,
  kind: 'roll',
  title: 'Würfeln',
  options: [{ id: ROLL_OPTION, label: 'Würfeln' }],
  defaultOption: ROLL_OPTION,
  deadline: null,
};

/** Erste Gabel einer Partie (Spieler würfeln, bis jemand den Weg wählen muss). */
function firstPathPrompt(): GameState {
  const game = newGame({
    board: DEFAULT_BOARD,
    ruleSet: DEFAULT_RULES,
    players: 2,
    rounds: 8,
    seed: 3,
  });
  let state = settle(start(game).state).state;
  for (let i = 0; i < 2000 && state.phase !== 'game-results'; i++) {
    const prompt = state.prompt;
    if (prompt?.kind === 'path') return state;
    const waiting =
      state.phase === 'minigame-intro'
        ? state.players.find((p) => !(state.minigame?.ready ?? []).includes(p.slot))
        : undefined;
    if (!prompt && waiting) {
      const result = step(state, { type: 'minigame-ready', slot: waiting.slot, at: state.now });
      if (!result.ok) throw new Error('minigame-ready abgewiesen');
      state = result.state;
    } else if (prompt) {
      const result = step(state, {
        type: 'choose',
        slot: prompt.slot,
        promptId: prompt.id,
        option: prompt.options[0]?.id ?? prompt.defaultOption,
        at: state.now,
      });
      if (!result.ok) throw new Error('abgewiesen');
      state = result.state;
    } else {
      state = settle(state).state;
    }
  }
  throw new Error('keine Gabel erreicht');
}

describe('KI-Platz am Brett (CHAOS-181)', () => {
  it('eigene Ströme je Platz und Zweck, deterministisch je Seed', () => {
    const seeds = new Set<number>();
    for (const slot of [1, 2, 3, 4] as const) {
      for (const purpose of AI_STREAM_PURPOSES) seeds.add(aiStreamSeed(77, slot, purpose));
    }
    expect(seeds.size).toBe(4 * AI_STREAM_PURPOSES.length);
    expect(aiStreamSeed(77, 2, 'delay')).toBe(aiStreamSeed(77, 2, 'delay'));
    expect(aiStreamSeed(78, 2, 'delay')).not.toBe(aiStreamSeed(77, 2, 'delay'));
    // Nicht der Strom der Simulation (`seed ^ 0x5bd1e995`).
    expect(aiStreamSeed(77, 1, 'decision')).not.toBe((77 ^ 0x5bd1e995) >>> 0);
  });

  it('gleicher Seed und Platz → gleiche Antworten und Pausen', () => {
    const answers = (seed: number) => {
      const seat = createBoardAiSeat(seed, 2);
      const params = boardAiParams(0.5);
      return Array.from({ length: 30 }, (_, i) =>
        answerBoardPrompt(seat, {
          prompt: i % 2 === 0 ? reactionPrompt(true) : ROLL_PROMPT,
          state: STATE,
          board: DEFAULT_BOARD,
          params,
          remainingMs: null,
        }),
      );
    };
    expect(answers(9)).toEqual(answers(9));
    expect(answers(10)).not.toEqual(answers(9));
  });

  it('Entscheidungen verschieben die Denkpausen nicht (getrennte Ströme)', () => {
    const params = boardAiParams(0.5);
    const path = firstPathPrompt();
    const pathPrompt = path.prompt;
    if (!pathPrompt) throw new Error('kein Prompt');
    const delays = (prompt: Prompt, state: GameState) => {
      const seat = createBoardAiSeat(5, pathPrompt.slot);
      return Array.from(
        { length: 20 },
        () =>
          answerBoardPrompt(seat, {
            prompt,
            state,
            board: DEFAULT_BOARD,
            params,
            remainingMs: null,
          }).delayMs,
      );
    };
    // Weg zieht bis zu zwei Entscheidungs-Zahlen, Würfeln ohne Item keine.
    expect(delays(pathPrompt, path)).toEqual(
      delays({ ...ROLL_PROMPT, slot: pathPrompt.slot }, STATE),
    );
  });

  it('Denkpause im Bereich der Stärke, bei einer Frist höchstens bis kurz davor', () => {
    for (const s of [0, 0.5, 1]) {
      const params = boardAiParams(s);
      const seat = createBoardAiSeat(1, 1);
      for (let i = 0; i < 200; i++) {
        const input = {
          prompt: ROLL_PROMPT,
          state: STATE,
          board: DEFAULT_BOARD,
          params,
          remainingMs: null,
        };
        const { option, delayMs } = answerBoardPrompt(seat, input);
        expect(option).toBe(ROLL_OPTION);
        expect(delayMs).toBeGreaterThanOrEqual(params.decisionMs[0]);
        expect(delayMs).toBeLessThanOrEqual(params.decisionMs[1]);
        const ready = boardAiReadyDelay(seat, params);
        expect(ready).toBeGreaterThanOrEqual(params.readyMs[0]);
        expect(ready).toBeLessThanOrEqual(params.readyMs[1]);
      }
      const short = answerBoardPrompt(seat, {
        prompt: ROLL_PROMPT,
        state: STATE,
        board: DEFAULT_BOARD,
        params,
        remainingMs: 1000,
      });
      expect(short.delayMs).toBeLessThanOrEqual(1000 - AI_DEADLINE_MARGIN_MS);
    }
  });

  it('Reaktion: leicht verpasst öfter und ist langsamer als schwer; Schild, wenn vorhanden', () => {
    const stats = (s: number) => {
      const seat = createBoardAiSeat(21, 2);
      const params = boardAiParams(s);
      let missed = 0;
      let inTime = 0;
      const n = 2000;
      for (let i = 0; i < n; i++) {
        const answer = answerBoardPrompt(seat, {
          prompt: reactionPrompt(i % 2 === 0),
          state: STATE,
          board: DEFAULT_BOARD,
          params,
          remainingMs: 3000,
        });
        expect(answer.delayMs).toBeGreaterThanOrEqual(params.reactionDelayMs.minMs);
        if (answer.option === null) {
          missed += 1;
          continue;
        }
        expect(answer.option).toBe(i % 2 === 0 ? SHIELD_OPTION : BRACE_OPTION);
        if (answer.delayMs <= 3000) inTime += 1;
      }
      return { missed: missed / n, success: inTime / n };
    };
    const leicht = stats(0);
    const mittel = stats(0.5);
    const schwer = stats(1);
    expect(leicht.missed).toBeGreaterThan(schwer.missed + 0.15);
    expect(schwer.missed).toBeGreaterThan(0.03);
    // Gelungene Reaktion im 3-s-Fenster (rechtzeitig und überhaupt): schwer > mittel > leicht.
    expect(schwer.success).toBeGreaterThan(mittel.success);
    expect(mittel.success).toBeGreaterThan(leicht.success);
    expect(schwer.success).toBeLessThan(1);
  });

  it('schwer meidet eine sichtbare fremde Falle an der Gabel deutlich öfter als leicht', () => {
    const state = firstPathPrompt();
    const prompt = state.prompt;
    if (!prompt) throw new Error('kein Prompt');
    const ids = prompt.options.map((option) => option.id);
    // Falle auf einen Weg legen, sodass ein anderer frei bleibt.
    const trapped = ids.find((id) =>
      ids.some(
        (other) =>
          other !== id && distanceTo(DEFAULT_BOARD, other, [id], state.round) >= TRAP_LOOKAHEAD,
      ),
    );
    if (!trapped) throw new Error('Gabel ohne getrennte Wege');
    const owner = prompt.slot === 1 ? 2 : 1;
    const withTrap: GameState = { ...state, traps: [{ spaceId: trapped, owner }] };
    const avoidRate = (s: number) => {
      const seat = createBoardAiSeat(8, prompt.slot);
      const params = boardAiParams(s);
      let avoided = 0;
      for (let i = 0; i < 1000; i++) {
        const { option } = answerBoardPrompt(seat, {
          prompt,
          state: withTrap,
          board: DEFAULT_BOARD,
          params,
          remainingMs: null,
        });
        if (option !== trapped) avoided += 1;
      }
      return avoided / 1000;
    };
    expect(avoidRate(1)).toBeGreaterThan(avoidRate(0) + 0.2);
  });
});
