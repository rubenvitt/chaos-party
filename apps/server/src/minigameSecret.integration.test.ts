/**
 * CHAOS-242: private Rückmeldung bei geheimer Wahl über die Session – der Host meldet sie je
 * Slot, nur genau dieser Controller bekommt sie im Minispiel-Kontext; der Host-Bildschirm und
 * die anderen Controller nie.
 */
import { DEFAULT_RULES } from '@chaos-party/game-core';
import { createMessage, type MinigameSecretInfo } from '@chaos-party/protocol';
import { getMinigameInfo } from '@chaos-party/minigames/catalog';
import { describe, expect, it } from 'vitest';
import { Harness, HOST, INTEGRATION_SEEDS } from './testHarness.ts';

const ID = 'drei-tueren';

const SECRET: MinigameSecretInfo = {
  prompt: 'Runde 1/8: deine Tür',
  options: [
    { id: 'links', icon: '←', label: '5 Münzen' },
    { id: 'mitte', icon: '↑', label: '9 Münzen' },
    { id: 'rechts', icon: '→', label: '2 Münzen' },
  ],
  aim: 'mitte',
  pick: null,
  locked: false,
};

/** Eine Runde Drei Türen zu zweit; bis in die Spielphase. */
function playing(): Harness {
  const info = getMinigameInfo(ID);
  if (!info) throw new Error('Drei Türen fehlt');
  const seed = INTEGRATION_SEEDS.two;
  const h = new Harness(
    {
      game: {
        seed,
        rounds: 1,
        rules: DEFAULT_RULES,
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
  expect(h.session.snapshot().game?.state.minigame?.id).toBe(ID);
  return h;
}

function sendSecret(
  h: Harness,
  slot: number,
  secret: MinigameSecretInfo | null,
  patch: { round?: number; minigameId?: string } = {},
): void {
  const minigame = h.session.snapshot().game?.state.minigame;
  h.send(
    HOST,
    createMessage('minigame-secret', {
      minigameId: patch.minigameId ?? minigame?.id ?? ID,
      round: patch.round ?? minigame?.round ?? 1,
      slot: slot as 1 | 2 | 3 | 4,
      secret,
    }),
  );
}

function minigameOf(h: Harness, slot: 1 | 2) {
  return h.contexts.get(slot)?.context.minigame;
}

/** Alles, was der Host-Bildschirm vom Server bekommen hat (Brett, Lobby), als Text. */
function hostTraffic(h: Harness): string {
  return JSON.stringify([h.boards, h.lobbies]);
}

describe('Private Rückmeldung bei geheimer Wahl (CHAOS-242)', () => {
  it('geht nur an den eigenen Controller, nie an den anderen oder den Host', () => {
    const h = playing();
    expect(minigameOf(h, 1)).toMatchObject({ id: ID, stage: 'play' });
    expect(minigameOf(h, 1)).not.toHaveProperty('secret');
    sendSecret(h, 1, SECRET);
    expect(minigameOf(h, 1)?.secret).toEqual(SECRET);
    expect(minigameOf(h, 2)).not.toHaveProperty('secret');
    const picked = { ...SECRET, aim: null, pick: 'rechts' };
    sendSecret(h, 2, picked);
    expect(minigameOf(h, 2)?.secret).toEqual(picked);
    expect(minigameOf(h, 1)?.secret).toEqual(SECRET);
    // Der Host-Bildschirm sieht weder Frage noch Wahl.
    expect(hostTraffic(h)).not.toContain('deine Tür');
    expect(hostTraffic(h)).not.toContain('"pick"');
    sendSecret(h, 1, null);
    expect(minigameOf(h, 1)).not.toHaveProperty('secret');
    expect(minigameOf(h, 2)?.secret).toEqual(picked);
    expect(h.errors).toEqual([]);
  });

  it('verwirft still: fremder Slot, fremder Lauf, ungültig, falsche Phase', () => {
    const h = playing();
    // Slot 3 spielt nicht mit.
    sendSecret(h, 3, SECRET);
    sendSecret(h, 1, SECRET, { round: 9 });
    sendSecret(h, 1, SECRET, { minigameId: 'sockenregen' });
    for (const slot of [1, 2] as const) expect(minigameOf(h, slot)).not.toHaveProperty('secret');
    sendSecret(h, 1, SECRET);
    expect(minigameOf(h, 1)?.secret).toEqual(SECRET);
    h.runUntil((x) => x.gamePhase !== 'minigame-play');
    // Nach dem Spiel keine Rückmeldung mehr, verspätete Meldungen bleiben folgenlos.
    expect(minigameOf(h, 1)?.secret).toBeUndefined();
    sendSecret(h, 1, SECRET);
    expect(minigameOf(h, 1)?.secret).toBeUndefined();
    expect(h.errors).toEqual([]);
    expect(h.closes).toEqual([]);
  });
});
