import { describe, expect, it } from 'vitest';
import type { Action, ControllerMinigameInfo, SlotNumber } from '@chaos-party/protocol';
import {
  buildZones,
  HIT_SLOP,
  inflate,
  MAX_BIG_BUTTON,
  MAX_INTRO_READY_WIDTH,
  MINIGAME_FOOT_GAP,
  minigameFootHeight,
  minigameVoteFrames,
  minigameZoneFrames,
  MIN_VOTE_WIDTH,
  parseVoteControl,
  voteControl,
  rectCenter,
  ZONE_PADDING,
  toScreen,
  type ControlKind,
  type Point,
  type Rect,
  type Size,
  type ZoneGeometry,
} from './geometry.ts';
import { contextKey, zoneControlsInput } from './zoneInput.ts';
import { createZoneTracker } from './zoneTracker.ts';
import type { SlotContext } from '../state/reducer.ts';

/** Minispiel in iPad-Zonen (CHAOS-33): Bedienelemente laut Steckbrief, Loslassen beim Wechsel. */

const LANDSCAPE: Size = { width: 1194, height: 834 };
const PORTRAIT: Size = { width: 834, height: 1194 };
const MINI_LANDSCAPE: Size = { width: 1133, height: 744 };

function minigame(
  stage: ControllerMinigameInfo['stage'],
  controls: ControllerMinigameInfo['controls'],
): ControllerMinigameInfo {
  return {
    id: 'test-spiel',
    title: 'Testspiel',
    tagline: 'Nur ein Test.',
    instructions: ['Drück A.'],
    controls,
    stage,
    scoreUnit: 'Punkte',
    tied: false,
    aborted: false,
  };
}

const ALL = { joystick: 'Lenken', a: 'Schubsen', b: 'Bremsen' };
const ONLY_A = { joystick: null, a: 'Pumpen', b: null };
const A_AND_B = { joystick: null, a: 'Links', b: 'Rechts' };

function playContext(controls: ControllerMinigameInfo['controls'], actions: Action[]): SlotContext {
  return {
    phase: 'board',
    layout: 'joystick-buttons',
    actions,
    minigame: minigame('play', controls),
  };
}

function resultsContext(controls: ControllerMinigameInfo['controls']): SlotContext {
  return {
    phase: 'board',
    layout: 'board',
    actions: [],
    minigame: { ...minigame('results', controls), place: 1, score: 3 },
  };
}

function zones(
  viewport: Size,
  contextFor: (slot: SlotNumber) => SlotContext,
  slots: SlotNumber[] = [1, 2, 3, 4],
): ZoneGeometry[] {
  return buildZones(slots, viewport, (slot) =>
    zoneControlsInput(contextFor(slot), undefined, slot),
  );
}

function kinds(zone: ZoneGeometry | undefined): ControlKind[] {
  return zone?.controls.map((c) => c.kind) ?? [];
}

function at(list: readonly ZoneGeometry[], slot: SlotNumber, kind: ControlKind): Point {
  const zone = list.find((z) => z.slot === slot);
  const control = zone?.controls.find((c) => c.kind === kind);
  if (!zone || !control) throw new Error(`${kind} fehlt in Zone ${String(slot)}`);
  return toScreen(zone, rectCenter(control.rect));
}

function inside(inner: Rect, outer: Size): boolean {
  return (
    inner.x >= 0 &&
    inner.y >= 0 &&
    inner.x + inner.width <= outer.width &&
    inner.y + inner.height <= outer.height
  );
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

describe('Minispiel-Bedienelemente in Zonen', () => {
  it('nur Elemente, die Server und Steckbrief anbieten', () => {
    const all = zones(LANDSCAPE, () => playContext(ALL, ['move', 'button-a', 'button-b']));
    expect(kinds(all[0]).sort()).toEqual(['button-a', 'button-b', 'stick']);
    // Steckbrief blendet den Joystick aus, auch wenn `move` (fälschlich) angeboten wird.
    const pump = zones(LANDSCAPE, () => playContext(ONLY_A, ['move', 'button-a']));
    expect(kinds(pump[0])).toEqual(['button-a']);
    // Intro/Ergebnis: keine Bedienelemente.
    const results = zones(LANDSCAPE, () => resultsContext(ALL));
    for (const zone of results) expect(zone.controls).toEqual([]);
  });

  it('ohne Joystick: Knöpfe größer und mittig, ganz in der Zone, ohne Überlappung', () => {
    for (const viewport of [LANDSCAPE, PORTRAIT, MINI_LANDSCAPE]) {
      for (const seats of [2, 4] as const) {
        const slots = ([1, 2, 3, 4] as const).slice(0, seats);
        const single = zones(viewport, () => playContext(ONLY_A, ['button-a']), slots);
        for (const zone of single) {
          const [a] = zone.controls;
          if (!a) throw new Error('A fehlt');
          expect(a.rect.width).toBeGreaterThanOrEqual(140);
          expect(a.rect.width).toBeLessThanOrEqual(MAX_BIG_BUTTON);
          expect(inside(a.rect, zone.local)).toBe(true);
          const center = rectCenter(a.rect);
          expect(Math.abs(center.x - zone.local.width / 2)).toBeLessThan(1);
        }
        const pair = zones(viewport, () => playContext(A_AND_B, ['button-a', 'button-b']), slots);
        for (const zone of pair) {
          const a = zone.controls.find((c) => c.kind === 'button-a');
          const b = zone.controls.find((c) => c.kind === 'button-b');
          if (!a || !b) throw new Error('Knopf fehlt');
          expect(a.rect.width).toBe(b.rect.width);
          expect(a.rect.width).toBeGreaterThanOrEqual(100);
          expect(inside(a.rect, zone.local)).toBe(true);
          expect(inside(b.rect, zone.local)).toBe(true);
          expect(overlaps(a.hit, b.hit)).toBe(false);
          expect(inflate(a.rect, HIT_SLOP)).toEqual(a.hit);
        }
      }
    }
  });
});

describe('Wechsel Spiel → Ergebnis im Zonen-Tracker', () => {
  it('gehaltene Knöpfe und Joysticks mehrerer Zonen werden losgelassen', () => {
    const playing = zones(LANDSCAPE, () => playContext(ALL, ['move', 'button-a', 'button-b']));
    const tracker = createZoneTracker(playing);

    expect(tracker.start(1, at(playing, 1, 'button-a'))).toEqual([
      { type: 'press', slot: 1, button: 'a' },
    ]);
    expect(tracker.start(2, at(playing, 2, 'button-b'))).toEqual([
      { type: 'press', slot: 2, button: 'b' },
    ]);
    const stick = at(playing, 3, 'stick');
    tracker.start(3, stick);
    const moved = tracker.move(3, { x: stick.x + 60, y: stick.y });
    expect(moved).toEqual([expect.objectContaining({ type: 'stick', slot: 3 })]);

    const effects = tracker.setZones(zones(LANDSCAPE, () => resultsContext(ALL)));
    expect(effects).toEqual(
      expect.arrayContaining([
        { type: 'release', slot: 1, button: 'a' },
        { type: 'release', slot: 2, button: 'b' },
        { type: 'stick', slot: 3, stick: { x: 0, y: 0 } },
      ]),
    );
    expect(effects).toHaveLength(3);
    // Die Finger bleiben stillgelegt: Bewegen und Abheben lösen nichts mehr aus.
    expect(tracker.move(3, { x: stick.x - 40, y: stick.y })).toEqual([]);
    expect(tracker.end(1)).toEqual([]);
    expect(tracker.view(1).pressed).toEqual([]);
    expect(tracker.view(3).stick).toBeNull();
  });
});

/* ---------------------------------------------------------------------------
 * „Bereit“ in der Anleitung (CHAOS-214)
 * ------------------------------------------------------------------------- */

function introContext(ready: boolean | undefined, actions: Action[]): SlotContext {
  return {
    phase: 'board',
    layout: 'board',
    actions,
    minigame: { ...minigame('intro', ALL), ...(ready !== undefined && { ready }) },
  };
}

function introZones(
  viewport: Size,
  context: SlotContext,
  options: { armed?: boolean; sentIn?: string } = {},
  slots: SlotNumber[] = [1, 2, 3, 4],
): ZoneGeometry[] {
  return buildZones(slots, viewport, (slot) =>
    zoneControlsInput(context, options.sentIn, slot, undefined, {
      introArmed: options.armed ?? true,
    }),
  );
}

describe('Bereit-Knopf der Anleitung in Zonen (CHAOS-214)', () => {
  const waiting = introContext(false, ['ready']);

  it('Fußzeile unter der Karte: Knopf ganz in der Zone, mittig, ohne Überlappung der Karte', () => {
    for (const viewport of [LANDSCAPE, PORTRAIT, MINI_LANDSCAPE]) {
      for (const seats of [1, 2, 3, 4] as const) {
        const slots = ([1, 2, 3, 4] as const).slice(0, seats);
        for (const zone of introZones(viewport, waiting, {}, slots)) {
          expect(kinds(zone)).toEqual(['ready']);
          const [ready] = zone.controls;
          if (!ready) throw new Error('Bereit fehlt');
          const frames = minigameZoneFrames(zone.local, true);
          expect(ready.inert).toBeUndefined();
          expect(inside(ready.rect, zone.local)).toBe(true);
          expect(ready.rect.height).toBeGreaterThanOrEqual(64);
          expect(ready.rect.width).toBeLessThanOrEqual(MAX_INTRO_READY_WIDTH);
          expect(Math.abs(rectCenter(ready.rect).x - zone.local.width / 2)).toBeLessThan(1);
          expect(ready.rect.y).toBe(frames.foot.y);
          expect(overlaps(ready.rect, frames.card)).toBe(false);
          expect(frames.card.y + frames.card.height + MINIGAME_FOOT_GAP).toBe(frames.foot.y);
          // Die Karte behält genug Platz für Titel und Anleitung.
          expect(frames.card.height).toBeGreaterThan(180);
        }
      }
    }
  });

  it('ohne Fußzeile füllt die Karte die ganze Fläche unter der Plakette', () => {
    const local = { width: 560, height: 400 };
    const { card, foot } = minigameZoneFrames(local, false);
    expect(foot.height).toBe(0);
    expect(card.y + card.height).toBe(local.height - ZONE_PADDING);
    expect(minigameFootHeight({ width: 400, height: 300 })).toBe(64);
    expect(minigameFootHeight({ width: 400, height: 1200 })).toBe(96);
  });

  it('Schonfrist: Knopf sichtbar, aber inert – Tippen löst nichts aus', () => {
    const guarded = introZones(LANDSCAPE, waiting, { armed: false });
    const [ready] = guarded[0]?.controls ?? [];
    expect(ready?.kind).toBe('ready');
    expect(ready?.inert).toBe(true);
    const tracker = createZoneTracker(guarded);
    const point = at(guarded, 1, 'ready');
    expect(tracker.start(1, point)).toEqual([]);
    expect(tracker.end(1)).toEqual([]);
    // Nach der Schonfrist löst dasselbe Antippen `ready` beim Abheben aus.
    tracker.setZones(introZones(LANDSCAPE, waiting, { armed: true }));
    expect(tracker.start(2, point)).toEqual([]);
    expect(tracker.end(2)).toEqual([{ type: 'ready', slot: 1 }]);
  });

  it('Finger aus der Schonfrist bleibt wirkungslos, auch wenn der Knopf danach scharf wird', () => {
    const tracker = createZoneTracker(introZones(LANDSCAPE, waiting, { armed: false }));
    const point = at(introZones(LANDSCAPE, waiting), 1, 'ready');
    tracker.start(1, point);
    tracker.setZones(introZones(LANDSCAPE, waiting, { armed: true }));
    expect(tracker.end(1)).toEqual([]);
  });

  it('gesendet oder vom Server bestätigt: kein Bedienelement, Zustand `done`', () => {
    const sent = zoneControlsInput(waiting, contextKey(waiting), 1, undefined, {
      introArmed: true,
    });
    expect(sent.introReady).toBe('done');
    expect(introZones(LANDSCAPE, waiting, { sentIn: contextKey(waiting) })[0]?.controls).toEqual(
      [],
    );
    const confirmed = introContext(true, []);
    expect(zoneControlsInput(confirmed, undefined, 1).introReady).toBe('done');
    expect(introZones(LANDSCAPE, confirmed)[0]?.controls).toEqual([]);
  });

  it('feste Anleitungszeit (älterer Server): keine Fußzeile, kein Knopf', () => {
    const legacy = introContext(undefined, []);
    expect(zoneControlsInput(legacy, undefined, 1).introReady).toBeUndefined();
    expect(introZones(LANDSCAPE, legacy)[0]?.controls).toEqual([]);
    // Ergebnis bietet nie „Bereit“ an.
    expect(zoneControlsInput(resultsContext(ALL), undefined, 1).introReady).toBeUndefined();
  });
});

describe('Daumen nach dem Minispiel in Zonen (CHAOS-218)', () => {
  function voteContext(actions: Action[], vote?: 'up' | 'down'): SlotContext {
    const base = resultsContext(ONLY_A);
    return {
      ...base,
      actions,
      ...(base.minigame && { minigame: { ...base.minigame, ...(vote && { vote }) } }),
    };
  }
  const offered = voteContext(['rate']);

  it('nur solange der Server `rate` anbietet, sonst keine Bedienelemente', () => {
    expect(parseVoteControl(voteControl('down'))).toBe('down');
    expect(parseVoteControl('ready')).toBeNull();
    expect(parseVoteControl(null)).toBeNull();
    expect(zoneControlsInput(offered, undefined, 1).vote).toBe(true);
    expect(kinds(zones(LANDSCAPE, () => offered, [1, 2])[0])).toEqual(['vote:up', 'vote:down']);
    // Abstimmen vorbei (Pause, nächste Phase) bzw. älterer Server ohne `rate`.
    expect(zoneControlsInput(voteContext([]), undefined, 1).vote).toBeUndefined();
    expect(kinds(zones(LANDSCAPE, () => voteContext([]), [1, 2])[0])).toEqual([]);
    // Spiel läuft: `rate` würde hier nichts bedeuten (nur die Ergebnisanzeige).
    const play = playContext(ALL, ['move', 'button-a', 'button-b', 'rate']);
    expect(zoneControlsInput(play, undefined, 1).vote).toBeUndefined();
    // Eine schon abgegebene Stimme lässt beide Daumen aktiv (Umentscheiden).
    const voted = zones(LANDSCAPE, () => voteContext(['rate'], 'up'), [1, 2])[0];
    expect(voted?.controls.every((c) => c.inert === undefined)).toBe(true);
  });

  it('Knöpfe in der Fußzeile: ganz in der Zone, ohne Überlappung mit Ergebnis und Frage', () => {
    for (const viewport of [LANDSCAPE, PORTRAIT, MINI_LANDSCAPE]) {
      for (const seats of [1, 2, 3, 4] as const) {
        const slots = ([1, 2, 3, 4] as const).slice(0, seats);
        for (const zone of zones(viewport, () => offered, slots)) {
          const frames = minigameVoteFrames(zone.local);
          const [up, down] = zone.controls;
          if (!up || !down) throw new Error('Daumen fehlen');
          for (const thumb of [up, down]) {
            expect(inside(thumb.hit, zone.local)).toBe(true);
            expect(thumb.rect.width).toBeGreaterThanOrEqual(MIN_VOTE_WIDTH);
            expect(thumb.rect.height).toBeGreaterThanOrEqual(64);
            expect(overlaps(thumb.rect, frames.card)).toBe(false);
            expect(overlaps(thumb.rect, frames.question)).toBe(false);
          }
          // Trefferflächen (mit Zugabe) berühren sich nicht: kein Daumen löst den anderen aus.
          expect(overlaps(up.hit, down.hit)).toBe(false);
          expect(up.rect.x).toBeLessThan(down.rect.x);
          // Zwei Zonen (Standard am iPad) haben Platz für die Frage daneben.
          if (seats <= 2) expect(frames.question.width).toBeGreaterThanOrEqual(120);
          // Die Ergebniskarte behält genug Höhe für Platz, Punkte und Münzen.
          expect(frames.card.height).toBeGreaterThan(seats <= 2 ? 300 : 180);
        }
      }
    }
  });

  it('schmale Zone: Knöpfe mittig, die Frage entfällt', () => {
    const frames = minigameVoteFrames({ width: 300, height: 500 });
    expect(frames.question.width).toBe(0);
    const middle = (frames.up.x + frames.down.x + frames.down.width) / 2;
    expect(Math.abs(middle - 150)).toBeLessThan(1);
    expect(frames.up.x).toBeGreaterThanOrEqual(ZONE_PADDING);
  });

  it('Treffer je Zone: zwei Zonen stimmen gleichzeitig unterschiedlich ab', () => {
    for (const viewport of [LANDSCAPE, PORTRAIT]) {
      const list = zones(viewport, () => offered, [1, 2]);
      const tracker = createZoneTracker(list);
      expect(tracker.start(1, at(list, 1, 'vote:up'))).toEqual([]);
      expect(tracker.start(2, at(list, 2, 'vote:down'))).toEqual([]);
      expect(tracker.view(1).votesHeld).toEqual(['vote:up']);
      expect(tracker.view(2).votesHeld).toEqual(['vote:down']);
      expect([...tracker.end(1), ...tracker.end(2)]).toEqual([
        { type: 'vote', slot: 1, vote: 'up' },
        { type: 'vote', slot: 2, vote: 'down' },
      ]);
      // Umentscheiden: derselbe Finger tippt den anderen Daumen.
      tracker.start(3, at(list, 1, 'vote:down'));
      expect(tracker.end(3)).toEqual([{ type: 'vote', slot: 1, vote: 'down' }]);
    }
  });

  it('Wegrutschen oder Ende der Ergebnisanzeige: keine Stimme', () => {
    const list = zones(LANDSCAPE, () => offered, [1, 2]);
    const tracker = createZoneTracker(list);
    tracker.start(1, at(list, 1, 'vote:up'));
    tracker.move(1, at(list, 2, 'vote:up'));
    expect(tracker.end(1, at(list, 2, 'vote:up'))).toEqual([]);
    tracker.start(2, at(list, 1, 'vote:down'));
    tracker.setZones(zones(LANDSCAPE, () => voteContext([]), [1, 2]));
    expect(tracker.end(2)).toEqual([]);
  });
});
