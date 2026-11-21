/**
 * CHAOS-231: Hinweis des laufenden Abschnitts (Schnellfeuer-Bildwort) über die Session – der
 * Host meldet ihn, die Controller bekommen ihn im Minispiel-Kontext, nur für den laufenden Lauf.
 */
import { DEFAULT_RULES } from '@chaos-party/game-core';
import { createMessage, type MinigameCueInfo } from '@chaos-party/protocol';
import { RAPID_FIRE_ID, rotationInfos } from '@chaos-party/minigames/catalog';
import { describe, expect, it } from 'vitest';
import { Harness, HOST, INTEGRATION_SEEDS } from './testHarness.ts';

const CUE: MinigameCueInfo = {
  step: 0,
  steps: 5,
  icon: '⏰',
  word: 'HAUEN!',
  controls: { joystick: null, a: 'Hauen', b: null },
  double: false,
};

/** Eine Runde, die als Finale Schnellfeuer spielt; bis in die Spielphase. */
function playing(): Harness {
  const info = rotationInfos()[0];
  if (!info) throw new Error('Rotation leer');
  const seed = INTEGRATION_SEEDS.two;
  const h = new Harness(
    {
      game: {
        seed,
        rounds: 1,
        rules: { ...DEFAULT_RULES, rapidFire: { trigger: 'finale' } },
        minigames: [{ id: info.id, playMs: info.durationMs, scoring: info.scoring }],
      },
    },
    { useItems: false, reaction: 'brace' },
    seed,
  );
  h.host();
  for (const id of [1, 2]) h.join(id);
  for (const id of h.controllers.keys()) h.ready(id);
  h.start();
  h.runUntil((x) => x.gamePhase === 'minigame-play');
  expect(h.session.snapshot().game?.state.minigame?.id).toBe(RAPID_FIRE_ID);
  return h;
}

function sendCue(h: Harness, cue: MinigameCueInfo | null, patch: { round?: number } = {}): void {
  const minigame = h.session.snapshot().game?.state.minigame;
  h.send(
    HOST,
    createMessage('minigame-cue', {
      minigameId: minigame?.id ?? RAPID_FIRE_ID,
      round: patch.round ?? minigame?.round ?? 1,
      cue,
    }),
  );
}

function minigameOf(h: Harness, slot: 1 | 2) {
  return h.contexts.get(slot)?.context.minigame;
}

describe('Controller-Hinweis im Minispiel (CHAOS-231)', () => {
  it('reicht den Hinweis an alle Controller weiter und nimmt ihn mit `null` zurück', () => {
    const h = playing();
    expect(minigameOf(h, 1)).toMatchObject({ id: RAPID_FIRE_ID, stage: 'play' });
    expect(minigameOf(h, 1)).not.toHaveProperty('cue');
    sendCue(h, CUE);
    for (const slot of [1, 2] as const) expect(minigameOf(h, slot)?.cue).toEqual(CUE);
    // Bedienung des Steckbriefs bleibt daneben stehen (ältere Controller zeigen sie).
    expect(minigameOf(h, 1)?.controls).toEqual({ joystick: 'Zielen', a: 'Los!', b: null });
    const next = { ...CUE, step: 4, word: 'FANGEN!', double: true, icon: '🪰' };
    sendCue(h, { ...next, controls: { joystick: 'Hand', a: 'Schnappen', b: null } });
    expect(minigameOf(h, 2)?.cue).toMatchObject({ step: 4, word: 'FANGEN!', double: true });
    sendCue(h, null);
    expect(minigameOf(h, 1)).not.toHaveProperty('cue');
    expect(h.errors).toEqual([]);
  });

  it('verwirft still: fremder Lauf, Bedienung außerhalb des Steckbriefs, falsche Phase', () => {
    const h = playing();
    sendCue(h, CUE, { round: 9 });
    expect(minigameOf(h, 1)).not.toHaveProperty('cue');
    // Schnellfeuer bietet keinen B-Knopf an: der Hinweis darf ihn nicht einführen.
    sendCue(h, { ...CUE, controls: { joystick: null, a: 'Hauen', b: 'Bremsen' } });
    expect(minigameOf(h, 1)).not.toHaveProperty('cue');
    sendCue(h, CUE);
    expect(minigameOf(h, 1)?.cue).toEqual(CUE);
    h.runUntil((x) => x.gamePhase !== 'minigame-play');
    // Nach dem Spiel kein Hinweis mehr, verspätete Meldungen bleiben folgenlos.
    expect(minigameOf(h, 1)?.cue).toBeUndefined();
    sendCue(h, CUE);
    expect(minigameOf(h, 1)?.cue).toBeUndefined();
    expect(h.errors).toEqual([]);
    expect(h.closes).toEqual([]);
  });
});
