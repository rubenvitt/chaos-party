/**
 * Minispiel-Klänge für Swift (CHAOS-190): Anleitung (Start, Countdown), Zeitfenster, IDs, und je
 * Minispiel der Rotation die Klänge der Bühne (`ctx.fx.sound`, Jubel im Ergebnis) wie im
 * Browser-Host.
 */
import { getMinigameModule, ROTATION } from '@chaos-party/minigames';
import { loadHavokForNode } from '@chaos-party/minigame-sdk/testing';
import type { MinigamePlayer, SoundId } from '@chaos-party/minigame-sdk/babylon';
import { describe, expect, it } from 'vitest';
import { SOUNDS, shapeRecipe } from '../../host/src/fx/sounds.ts';
import { SOUND_WINDOW_MS } from '../src/boardDirection.ts';
import { RenderStateSchema } from '../src/contract.ts';
import { RENDER_STATE_EXAMPLES } from '../src/examples.ts';
import { createMinigameSounds, MAX_MINIGAME_SOUNDS } from '../src/minigameSounds.ts';
import { createHeadlessStage } from '../src/stage.ts';

function setup() {
  const clock = { t: 0 };
  const sounds = createMinigameSounds(() => clock.t);
  return { clock, sounds };
}

describe('Minispiel-Klänge: Anleitung (CHAOS-190)', () => {
  it('spielt „minigame-start“, wenn ein Minispiel in der Anleitung erscheint', () => {
    const { sounds } = setup();
    sounds.observe(null, null, null);
    expect(sounds.cues(null)).toEqual([]);
    sounds.observe('sockenregen:1:7', 'intro', 8);
    const cues = sounds.cues('sockenregen:1:7');
    expect(cues.map((cue) => cue.name)).toEqual(['minigame-start']);
    // Fertiges Rezept wie im Browser-Host (`shapeRecipe`), passend zum Vertrag.
    expect(cues[0]?.voices).toEqual(shapeRecipe(SOUNDS['minigame-start'].recipe));
    // Gleiches Minispiel im nächsten Bild: kein zweiter Start.
    sounds.observe('sockenregen:1:7', 'intro', 8);
    expect(sounds.cues('sockenregen:1:7')).toHaveLength(1);
  });

  it('kein Start, wenn das Minispiel erst im Spiel oder Ergebnis auftaucht', () => {
    const { sounds } = setup();
    sounds.observe('wackelturm:2:1', 'play', null);
    sounds.observe('wackelturm:2:1', 'results', null);
    expect(sounds.cues('wackelturm:2:1')).toEqual([]);
  });

  it('tickt bei 3, 2 und 1 s, bei 1 s höher, jede Sekunde nur einmal', () => {
    const { clock, sounds } = setup();
    const key = 'pudding-gerangel:3:5';
    const names: string[] = [];
    const freqs: number[] = [];
    let seen = 0;
    for (const countdown of [6, 5, 5, 4, 3, 3, 3, 2, 2, 1, 1, 0]) {
      sounds.observe(key, 'intro', countdown);
      for (const cue of sounds.cues(key)) {
        if (cue.id <= seen) continue;
        seen = cue.id;
        names.push(cue.name);
        freqs.push(cue.voices[0]?.freq ?? 0);
      }
      clock.t += 400;
    }
    expect(names).toEqual(['minigame-start', 'tick', 'tick', 'tick']);
    expect(freqs.slice(1)).toEqual([740, 740, 740 * 1.25]);
  });

  it('zählt schon den ersten Countdown-Wert (wie der Effekt beim Erscheinen)', () => {
    const { sounds } = setup();
    sounds.observe('kuckucks-klatsche:4:2', 'intro', 3);
    expect(sounds.cues('kuckucks-klatsche:4:2').map((cue) => cue.name)).toEqual([
      'minigame-start',
      'tick',
    ]);
  });

  it('steht der Countdown (Pause), tickt nichts nach', () => {
    const { clock, sounds } = setup();
    const key = 'kruemel-kehraus:5:9';
    sounds.observe(key, 'intro', 2);
    for (let index = 0; index < 10; index++) {
      clock.t += 500;
      sounds.observe(key, 'intro', 2);
    }
    expect(sounds.cues(key)).toEqual([]);
  });
});

describe('Minispiel-Klänge: Fenster und IDs (CHAOS-190)', () => {
  it('hält Klänge `SOUND_WINDOW_MS` lang und nur beim eigenen Minispiel', () => {
    const { clock, sounds } = setup();
    sounds.observe('a:1:1', 'play', null);
    sounds.play('coin', { pitch: 1.1 });
    sounds.play('hit', undefined, 'b:1:1');
    expect(sounds.cues('a:1:1').map((cue) => cue.name)).toEqual(['coin']);
    expect(sounds.cues('a:1:1')[0]?.voices[0]?.freq).toBeCloseTo(988 * 1.1);
    expect(sounds.cues('b:1:1').map((cue) => cue.name)).toEqual(['hit']);
    clock.t += SOUND_WINDOW_MS - 1;
    expect(sounds.cues('a:1:1')).toHaveLength(1);
    clock.t += 1;
    expect(sounds.cues('a:1:1')).toEqual([]);
  });

  it('ohne beobachtetes Minispiel und ohne Schlüssel bleibt es still', () => {
    const { sounds } = setup();
    sounds.play('go');
    expect(sounds.cues(null)).toEqual([]);
  });

  it('IDs steigen über Minispiele hinweg, auch bei einer Revanche mit gleichem Schlüssel', () => {
    const { clock, sounds } = setup();
    sounds.observe('sockenregen:1:7', 'intro', 8);
    const first = sounds.cues('sockenregen:1:7')[0]?.id ?? 0;
    sounds.observe(null, null, null);
    clock.t += 10_000;
    sounds.observe('sockenregen:1:7', 'intro', 8);
    const again = sounds.cues('sockenregen:1:7');
    expect(again.map((cue) => cue.name)).toEqual(['minigame-start']);
    expect(again[0]?.id).toBeGreaterThan(first);
  });

  it(`hält höchstens ${String(MAX_MINIGAME_SOUNDS)} Klänge`, () => {
    const { sounds } = setup();
    sounds.observe('a:1:1', 'play', null);
    for (let index = 0; index < MAX_MINIGAME_SOUNDS + 10; index++) sounds.play('pop');
    const cues = sounds.cues('a:1:1');
    expect(cues).toHaveLength(MAX_MINIGAME_SOUNDS);
    expect(cues.at(-1)?.id).toBe(MAX_MINIGAME_SOUNDS + 10);
  });

  it('die Beispiele für Swift tragen Klänge und halten den Vertrag ein', () => {
    for (const name of [
      'minigame-intro',
      'minigame-countdown',
      'minigame-play',
      'minigame-results',
    ]) {
      const example = RENDER_STATE_EXAMPLES[name];
      expect(RenderStateSchema.safeParse(example).success, name).toBe(true);
      expect(example?.minigame?.sounds.length, name).toBeGreaterThan(0);
    }
  });
});

describe('Minispiel-Klänge der Bühne je Minispiel (CHAOS-190)', () => {
  const PLAYERS: MinigamePlayer[] = [
    { slot: 1, name: 'Anna', color: '#0072B2', symbol: '●', character: 'raccoon' },
    { slot: 2, name: 'Ben', color: '#E69F00', symbol: '▲', character: 'sock' },
  ];

  it.each(ROTATION)(
    '%s: „go“ zum Start, „win“ zum Ende, „cheer“ einmal im Ergebnis',
    async (id) => {
      const module = getMinigameModule(id);
      if (!module) throw new Error(id);
      const heard: { id: SoundId; options?: { volume?: number; pitch?: number } }[] = [];
      const run = { finished: false };
      const stage = createHeadlessStage({
        module,
        players: PLAYERS,
        seed: 11,
        timeLimitMs: 4_000,
        havok: module.info.physics ? await loadHavokForNode() : null,
        onResult: () => {
          run.finished = true;
        },
        log: () => undefined,
        onSound: (sound, options) => {
          heard.push({ id: sound, ...(options ? { options } : {}) });
        },
      });
      for (let index = 0; index < 50 && !stage.ready; index++) {
        await new Promise((resolve) => setImmediate(resolve));
      }
      expect(stage.ready).toBe(true);
      stage.start();
      for (let index = 0; index < 60 * 8 && !run.finished; index++) stage.advance(1 / 60);
      expect(run.finished).toBe(true);
      const names = heard.map((entry) => entry.id);
      expect(names[0]).toBe('go');
      expect(names).toContain('win');
      // Nur Klänge, die es gibt (sonst fände Swift kein Rezept).
      for (const name of names) expect(SOUNDS[name]).toBeDefined();

      const before = heard.length;
      stage.celebrate([
        { slot: 1, place: 1, score: 3 },
        { slot: 2, place: 2, score: 1 },
      ]);
      stage.celebrate([{ slot: 1, place: 1, score: 3 }]);
      expect(heard.slice(before).map((entry) => entry.id)).toEqual(['cheer']);

      stage.dispose();
      stage.celebrate([{ slot: 1, place: 1, score: 3 }]);
      expect(heard.length).toBe(before + 1);
    },
  );

  it('wartende Anleitung (CHAOS-214): je neuem „Bereit“ ein Tick, der letzte höher', () => {
    const { sounds } = setup();
    const key = 'sockenregen:1:2';
    const steps = [
      { done: 0, total: 3 },
      { done: 1, total: 3 },
      { done: 1, total: 3 },
      { done: 2, total: 3 },
      { done: 3, total: 3 },
    ];
    for (const ready of steps) sounds.observe(key, 'intro', null, ready);
    const cues = sounds.cues(key);
    expect(cues.map((cue) => cue.name)).toEqual(['minigame-start', 'tick', 'tick', 'tick']);
    const freqs = cues.slice(1).map((cue) => cue.voices[0]?.freq ?? 0);
    expect(freqs).toEqual([740, 740, 740 * 1.25]);
  });

  it('wartende Anleitung: zwei „Bereit“ im selben Tick ticken zweimal', () => {
    const { sounds } = setup();
    const key = 'kruemel-kehraus:4:2';
    sounds.observe(key, 'intro', null, { done: 0, total: 2 });
    sounds.observe(key, 'intro', null, { done: 2, total: 2 });
    const cues = sounds.cues(key);
    expect(cues.map((cue) => cue.name)).toEqual(['minigame-start', 'tick', 'tick']);
    const freqs = cues.slice(1).map((cue) => cue.voices[0]?.freq ?? 0);
    expect(freqs).toEqual([740, 740 * 1.25]);
  });
});
