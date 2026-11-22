import { describe, expect, it } from 'vitest';
import type { Action, SlotNumber } from '@chaos-party/protocol';
import {
  buildZones,
  rectCenter,
  toScreen,
  ZONE_GUTTER,
  type ControlKind,
  type Point,
  type Size,
  type ZoneControlsInput,
  type ZoneGeometry,
} from './geometry.ts';
import { createZoneTracker } from './zoneTracker.ts';

const LANDSCAPE: Size = { width: 1194, height: 834 };
const PORTRAIT: Size = { width: 834, height: 1194 };
const PLAY: Action[] = ['move', 'button-a', 'button-b'];
const play: ZoneControlsInput = { layout: 'joystick-buttons', actions: PLAY };

function zonesFor(
  viewport: Size,
  slots: SlotNumber[] = [1, 2],
  input: (slot: SlotNumber) => ZoneControlsInput = () => play,
): ZoneGeometry[] {
  return buildZones(slots, viewport, input);
}

function zone(zones: readonly ZoneGeometry[], slot: SlotNumber): ZoneGeometry {
  const found = zones.find((z) => z.slot === slot);
  if (!found) throw new Error(`Zone ${String(slot)} fehlt`);
  return found;
}

/** Bildschirmpunkt in der Mitte eines Bedienelements (lokal versetzbar). */
function at(
  zones: readonly ZoneGeometry[],
  slot: SlotNumber,
  kind: ControlKind,
  offset: Point = { x: 0, y: 0 },
): Point {
  const z = zone(zones, slot);
  const control = z.controls.find((c) => c.kind === kind);
  if (!control) throw new Error(`${kind} fehlt in Zone ${String(slot)}`);
  const c = rectCenter(control.rect);
  return toScreen(z, { x: c.x + offset.x, y: c.y + offset.y });
}

function shift(p: Point, dx: number, dy: number): Point {
  return { x: p.x + dx, y: p.y + dy };
}

describe('createZoneTracker', () => {
  it('zwei Finger in zwei Zonen gleichzeitig: Joystick Zone 1, A in Zone 2', () => {
    const zones = zonesFor(LANDSCAPE);
    const t = createZoneTracker(zones);
    const stick = at(zones, 1, 'stick');

    expect(t.start(1, stick)).toEqual([]);
    expect(t.start(2, at(zones, 2, 'button-a'))).toEqual([{ type: 'press', slot: 2, button: 'a' }]);
    expect(t.owner(1)).toEqual({ slot: 1, control: 'stick' });
    expect(t.owner(2)).toEqual({ slot: 2, control: 'button-a' });

    const moved = t.move(1, shift(stick, 60, 0));
    expect(moved).toHaveLength(1);
    expect(moved[0]).toMatchObject({ type: 'stick', slot: 1 });
    const first = moved[0];
    if (first?.type !== 'stick') throw new Error('kein stick');
    expect(first.stick.x).toBeGreaterThan(0.5);
    expect(first.stick.y).toBe(0);

    expect(t.view(1).stick).not.toBeNull();
    expect(t.view(2).pressed).toEqual(['a']);

    expect(t.end(2)).toEqual([{ type: 'release', slot: 2, button: 'a' }]);
    // Der andere Finger bewegt weiter.
    expect(t.move(1, shift(stick, 0, -60))[0]).toMatchObject({ slot: 1, stick: { x: 0 } });
    expect(t.end(1)).toEqual([{ type: 'stick', slot: 1, stick: { x: 0, y: 0 } }]);
    expect(t.size).toBe(0);
  });

  it('Finger rutscht über die Zonengrenze: Besitz bleibt bei der Startzone', () => {
    const zones = zonesFor(LANDSCAPE);
    const t = createZoneTracker(zones);
    const stick = at(zones, 1, 'stick');
    t.start(7, stick);
    // Weit nach rechts, mitten in Zone 2 (auch über deren A-Knopf).
    const effects = t.move(7, at(zones, 2, 'button-a'));
    expect(effects).toHaveLength(1);
    expect(effects[0]).toMatchObject({ type: 'stick', slot: 1 });
    if (effects[0]?.type !== 'stick') throw new Error('kein stick');
    expect(effects[0].stick.x).toBeGreaterThan(0.8);
    expect(t.owner(7)).toEqual({ slot: 1, control: 'stick' });
    expect(t.view(2).pressed).toEqual([]);
    // Ein neuer Finger auf dem A-Knopf von Zone 2 drückt ihn ganz normal.
    expect(t.start(8, at(zones, 2, 'button-a'))).toEqual([{ type: 'press', slot: 2, button: 'a' }]);
  });

  it('Knopf bleibt gedrückt, wenn der Finger vom Knopf rutscht, bis er abhebt', () => {
    const zones = zonesFor(LANDSCAPE);
    const t = createZoneTracker(zones);
    const a = at(zones, 2, 'button-a');
    t.start(1, a);
    expect(t.move(1, shift(a, -400, 0))).toEqual([]);
    expect(t.view(2).pressed).toEqual(['a']);
    expect(t.end(1, shift(a, -400, 0))).toEqual([{ type: 'release', slot: 2, button: 'a' }]);
  });

  it('touchcancel lässt alles los: Joystick {0,0}, Knöpfe release', () => {
    const zones = zonesFor(LANDSCAPE);
    const t = createZoneTracker(zones);
    const stick = at(zones, 1, 'stick');
    t.start(1, stick);
    t.move(1, shift(stick, 0, -80));
    t.start(2, at(zones, 1, 'button-b'));
    expect(t.cancel(1)).toEqual([{ type: 'stick', slot: 1, stick: { x: 0, y: 0 } }]);
    expect(t.cancel(2)).toEqual([{ type: 'release', slot: 1, button: 'b' }]);
    expect(t.cancel(2)).toEqual([]);
    expect(t.view(1)).toEqual({
      stick: null,
      pressed: [],
      readyHeld: false,
      choicesHeld: [],
      picksHeld: [],
      votesHeld: [],
      seatsHeld: [],
    });
  });

  it('cancelAll (Fokusverlust) lässt alle Zonen los', () => {
    const zones = zonesFor(LANDSCAPE, [1, 2, 3, 4]);
    const t = createZoneTracker(zones);
    t.start(1, at(zones, 1, 'stick'));
    t.start(2, at(zones, 2, 'button-a'));
    t.start(3, at(zones, 3, 'button-b'));
    t.start(4, at(zones, 4, 'stick'));
    expect(t.cancelAll()).toEqual(
      expect.arrayContaining([
        { type: 'stick', slot: 1, stick: { x: 0, y: 0 } },
        { type: 'release', slot: 2, button: 'a' },
        { type: 'release', slot: 3, button: 'b' },
        { type: 'stick', slot: 4, stick: { x: 0, y: 0 } },
      ]),
    );
    expect(t.size).toBe(0);
  });

  it('zweiter Finger auf dem Joystick derselben Zone wird ignoriert, Knöpfe gehen trotzdem', () => {
    const zones = zonesFor(LANDSCAPE);
    const t = createZoneTracker(zones);
    const stick = at(zones, 1, 'stick');
    t.start(1, stick);
    expect(t.start(2, shift(stick, 30, 30))).toEqual([]);
    expect(t.owner(2)).toEqual({ slot: 1, control: null });
    expect(t.move(2, shift(stick, 200, 30))).toEqual([]);
    expect(t.start(3, at(zones, 1, 'button-a'))).toEqual([{ type: 'press', slot: 1, button: 'a' }]);
    expect(t.start(4, at(zones, 1, 'button-b'))).toEqual([{ type: 'press', slot: 1, button: 'b' }]);
    // Zweiter Finger auf schon gedrücktem A: wirkungslos.
    expect(t.start(5, at(zones, 1, 'button-a'))).toEqual([]);
    expect(t.view(1).pressed).toEqual(['a', 'b']);

    // Erster Finger hebt ab: der zweite wird **nicht** zum Joystick befördert.
    expect(t.end(1)).toEqual([{ type: 'stick', slot: 1, stick: { x: 0, y: 0 } }]);
    expect(t.move(2, shift(stick, -200, 30))).toEqual([]);
    expect(t.end(2)).toEqual([]);
    expect(t.end(5)).toEqual([]);
    // Neuer Finger auf dem Joystick übernimmt.
    t.start(6, stick);
    expect(t.owner(6)).toEqual({ slot: 1, control: 'stick' });
  });

  it('Berührungen im Randstreifen oder außerhalb werden ignoriert', () => {
    const zones = zonesFor(LANDSCAPE);
    const t = createZoneTracker(zones);
    const left = zone(zones, 1);
    const gutter = { x: left.rect.width + ZONE_GUTTER / 2, y: 400 };
    expect(t.start(1, gutter)).toEqual([]);
    expect(t.owner(1)).toBeNull();
    expect(t.move(1, at(zones, 2, 'stick'))).toEqual([]);
    expect(t.end(1)).toEqual([]);
    expect(t.start(2, { x: -5, y: 10 })).toEqual([]);
    expect(t.start(3, { x: 2000, y: 10 })).toEqual([]);
    expect(t.size).toBe(0);
  });

  it('Berührung in der Zone neben allen Bedienelementen gehört der Zone ohne Wirkung', () => {
    const zones = zonesFor(LANDSCAPE);
    const t = createZoneTracker(zones);
    const z = zone(zones, 2);
    // Plakettenstreifen oben.
    const badge = toScreen(z, { x: z.local.width / 2, y: 10 });
    expect(t.start(1, badge)).toEqual([]);
    expect(t.owner(1)).toEqual({ slot: 2, control: null });
    expect(t.move(1, at(zones, 2, 'stick'))).toEqual([]);
    expect(t.end(1)).toEqual([]);
  });

  it('Kennungen werden nach dem Abheben neu vergeben; doppelter Start bricht die alte Berührung ab', () => {
    const zones = zonesFor(LANDSCAPE);
    const t = createZoneTracker(zones);
    t.start(1, at(zones, 1, 'button-a'));
    t.end(1);
    expect(t.start(1, at(zones, 2, 'button-b'))).toEqual([{ type: 'press', slot: 2, button: 'b' }]);
    expect(t.owner(1)).toEqual({ slot: 2, control: 'button-b' });
    // Ende ging verloren, dieselbe Kennung setzt woanders auf.
    expect(t.start(1, at(zones, 1, 'stick'))).toEqual([{ type: 'release', slot: 2, button: 'b' }]);
    expect(t.owner(1)).toEqual({ slot: 1, control: 'stick' });
  });

  it('reconcile bricht Berührungen ab, die der Browser nicht mehr meldet', () => {
    const zones = zonesFor(LANDSCAPE);
    const t = createZoneTracker(zones);
    t.start(1, at(zones, 1, 'stick'));
    t.start(2, at(zones, 2, 'button-a'));
    expect(t.reconcile([1])).toEqual([{ type: 'release', slot: 2, button: 'a' }]);
    expect(t.reconcile(new Set([1]))).toEqual([]);
    expect(t.reconcile([])).toEqual([{ type: 'stick', slot: 1, stick: { x: 0, y: 0 } }]);
  });

  it('Drehen des iPads: neue Zonenlage lässt laufende Berührungen los und legt sie still', () => {
    const before = zonesFor(LANDSCAPE);
    const t = createZoneTracker(before);
    const stick = at(before, 1, 'stick');
    t.start(1, stick);
    t.move(1, shift(stick, 50, 0));
    t.start(2, at(before, 2, 'button-a'));

    const after = zonesFor(PORTRAIT);
    expect(t.setZones(after)).toEqual([
      { type: 'stick', slot: 1, stick: { x: 0, y: 0 } },
      { type: 'release', slot: 2, button: 'a' },
    ]);
    // Stillgelegt: Bewegen und Abheben bewirken nichts mehr.
    expect(t.owner(1)).toEqual({ slot: 1, control: null });
    expect(t.move(1, shift(stick, 90, 0))).toEqual([]);
    expect(t.end(1)).toEqual([]);
    expect(t.end(2)).toEqual([]);
    // Neue Berührungen nutzen die neue Lage.
    expect(t.start(3, at(after, 2, 'button-b'))).toEqual([{ type: 'press', slot: 2, button: 'b' }]);
  });

  it('gleiche Lage, neuer Kontext: Besitz bleibt, nur verschwundene Elemente werden losgelassen', () => {
    const zones = zonesFor(LANDSCAPE);
    const t = createZoneTracker(zones);
    t.start(1, at(zones, 1, 'stick'));
    t.start(2, at(zones, 2, 'button-a'));
    // Unverändert neu berechnet (z. B. Kontext von Slot 2 neu gesendet): nichts passiert.
    expect(t.setZones(zonesFor(LANDSCAPE))).toEqual([]);
    expect(t.owner(1)).toEqual({ slot: 1, control: 'stick' });

    // Slot 2 wechselt auf „wait“: sein Knopf verschwindet, Slot 1 spielt weiter.
    const next = zonesFor(LANDSCAPE, [1, 2], (slot) =>
      slot === 2 ? { layout: 'wait', actions: [] } : play,
    );
    expect(t.setZones(next)).toEqual([{ type: 'release', slot: 2, button: 'a' }]);
    expect(t.owner(1)).toEqual({ slot: 1, control: 'stick' });
    expect(t.owner(2)).toEqual({ slot: 2, control: null });
  });

  it('um 180° gedrehte Zone: Richtungen aus Sicht der gegenübersitzenden Person', () => {
    const zones = zonesFor(PORTRAIT);
    expect(zone(zones, 2).rotation).toBe(180);
    const t = createZoneTracker(zones);
    const stick = at(zones, 2, 'stick');
    t.start(1, stick);
    // Auf dem Bildschirm nach unten = von der Person oben weg = vorn (+y).
    const down = t.move(1, shift(stick, 0, 200))[0];
    expect(down).toMatchObject({ type: 'stick', slot: 2, stick: { x: 0, y: 1 } });
    // Auf dem Bildschirm nach rechts = für die Person links (−x).
    const right = t.move(1, shift(stick, 200, 0))[0];
    expect(right).toMatchObject({ type: 'stick', slot: 2, stick: { x: -1, y: 0 } });
    // Anzeige: Knopfversatz in lokalen Koordinaten, Ursprung lokal.
    const view = t.view(2).stick;
    expect(view?.knob.dx).toBeLessThan(0);
  });

  it('Bereit-Knopf: ready beim Abheben auf dem Knopf, nicht nach Wegrutschen oder Abbruch', () => {
    const zones = zonesFor(LANDSCAPE, [1, 2], () => ({ layout: 'lobby', actions: ['ready'] }));
    const t = createZoneTracker(zones);
    const ready1 = at(zones, 1, 'ready');
    const ready2 = at(zones, 2, 'ready');

    expect(t.start(1, ready1)).toEqual([]);
    expect(t.view(1).readyHeld).toBe(true);
    expect(t.end(1, shift(ready1, 5, 5))).toEqual([{ type: 'ready', slot: 1 }]);

    t.start(2, ready2);
    t.move(2, shift(ready2, 0, 300));
    expect(t.end(2)).toEqual([]);

    t.start(3, ready2);
    expect(t.cancel(3)).toEqual([]);

    // Beide gleichzeitig bereit.
    t.start(4, ready1);
    t.start(5, ready2);
    expect([...t.end(5), ...t.end(4)]).toEqual([
      { type: 'ready', slot: 2 },
      { type: 'ready', slot: 1 },
    ]);
  });

  it('vier Zonen mit je zwei Fingern (8 gleichzeitige Berührungen) bleiben getrennt', () => {
    const zones = zonesFor(LANDSCAPE, [1, 2, 3, 4]);
    const t = createZoneTracker(zones);
    const slots = [1, 2, 3, 4] as const;
    for (const slot of slots) {
      t.start(slot * 10, at(zones, slot, 'stick'));
      expect(t.start(slot * 10 + 1, at(zones, slot, 'button-a'))).toEqual([
        { type: 'press', slot, button: 'a' },
      ]);
    }
    expect(t.size).toBe(8);
    for (const slot of slots) {
      const effects = t.move(slot * 10, shift(at(zones, slot, 'stick'), 0, -200));
      expect(effects).toHaveLength(1);
      // Obere Reihe ist gedreht: Bildschirm-oben ist dort „hinten“.
      const expectedY = zone(zones, slot).rotation === 180 ? -1 : 1;
      expect(effects[0]).toMatchObject({ slot, stick: { x: 0, y: expectedY } });
    }
    for (const slot of slots) {
      expect(t.end(slot * 10 + 1)).toEqual([{ type: 'release', slot, button: 'a' }]);
    }
  });
});
