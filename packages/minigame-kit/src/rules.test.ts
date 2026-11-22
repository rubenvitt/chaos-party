import { describe, expect, it } from 'vitest';
import { arenaLayout, clampToZone, laneAt, offEdge, startPoints, zoneAt } from './arena.ts';
import { RiskBank } from './bank.ts';
import {
  arcPosition,
  clampToBounds,
  clampToRadius,
  headingOf,
  insideBounds,
  nearestWithin,
  randomInBounds,
  randomInCircle,
} from './geometry.ts';
import { HazardField, shapeContains } from './hazards.ts';
import { LeadTracker, Scoreboard, uniqueLeaderIndex, uniqueMax } from './scoreboard.ts';
import { StatusTimers, StunTracker } from './status.ts';

describe('Geometrie', () => {
  it('hält Punkte im Kreis und im Rechteck', () => {
    expect(clampToRadius(3, 4, 10)).toEqual({ x: 3, z: 4 });
    const clamped = clampToRadius(6, 8, 5);
    expect(clamped.x).toBeCloseTo(3);
    expect(clamped.z).toBeCloseTo(4);
    expect(clampToBounds(9, -9, { kind: 'rect', halfX: 2, halfZ: 3 })).toEqual({ x: 2, z: -3 });
    expect(insideBounds(1, 1, { kind: 'circle', radius: 2 })).toBe(true);
    expect(insideBounds(1.9, 0, { kind: 'circle', radius: 2 }, 0.5)).toBe(false);
  });

  it('Wurfparabel beginnt am Start, endet am Ziel und steigt dazwischen', () => {
    const from = { x: 0, y: 2, z: 8 };
    const to = { x: 4, z: 0 };
    expect(arcPosition(from, to, 0, 5)).toEqual({ x: 0, y: 2, z: 8 });
    expect(arcPosition(from, to, 1, 5)).toEqual({ x: 4, y: 0, z: 0 });
    expect(arcPosition(from, to, 0.5, 5).y).toBeCloseTo(6);
    expect(headingOf(0, 1)).toBe(0);
    expect(headingOf(1, 0)).toBeCloseTo(Math.PI / 2);
  });

  it('nächstes Element in Reichweite, Zufallspunkt im Rechteck', () => {
    const items = [
      { x: 1, z: 0, ok: true },
      { x: 0.5, z: 0, ok: false },
      { x: 3, z: 0, ok: true },
    ];
    expect(nearestWithin(items, { x: 0, z: 0 }, 2)).toBe(items[1]);
    expect(nearestWithin(items, { x: 0, z: 0 }, 2, (item) => item.ok)).toBe(items[0]);
    expect(nearestWithin(items, { x: 0, z: 0 }, 0.2)).toBeNull();
    let state = 0.37;
    const next = () => (state = (state * 7.13 + 0.211) % 1);
    for (let i = 0; i < 50; i++) {
      const rect = randomInBounds(next, { kind: 'rect', halfX: 3, halfZ: 2 }, 0.5);
      expect(Math.abs(rect.x)).toBeLessThanOrEqual(2.5);
      expect(Math.abs(rect.z)).toBeLessThanOrEqual(1.5);
      const round = randomInBounds(next, { kind: 'circle', radius: 2 }, 0.5);
      expect(Math.hypot(round.x, round.z)).toBeLessThanOrEqual(1.5 + 1e-9);
    }
  });

  it('Zufallspunkte liegen im Kreis', () => {
    let state = 0.13;
    const next = () => (state = (state * 9301 + 0.4927) % 1);
    for (let i = 0; i < 100; i++) {
      const point = randomInCircle(next, 3);
      expect(Math.hypot(point.x, point.z)).toBeLessThanOrEqual(3 + 1e-9);
    }
  });
});

describe('Punktestand', () => {
  it('uniqueMax: kein Spitzenreiter bei Gleichstand', () => {
    expect(uniqueMax([1, 5, 3], (v) => v)).toBe(5);
    expect(uniqueMax([5, 5, 3], (v) => v)).toBeNull();
    expect(uniqueMax([3, 3, 5], (v) => v)).toBe(5);
    expect(uniqueMax([], (v: number) => v)).toBeNull();
    expect(uniqueLeaderIndex([0, 0, 0])).toBeNull();
    expect(uniqueLeaderIndex([0, 2, 1])).toBe(1);
  });

  it('zählt, kennt die Führung und wertet mit Gleichstand', () => {
    const board = new Scoreboard([1, 2, 3]);
    expect(board.leader()).toBeNull();
    board.add(1, 3);
    board.add(2, 3);
    board.add(3, -5);
    expect(board.get(3)).toBe(0);
    expect(board.leader()).toBeNull();
    board.add(2, 1);
    expect(board.leader()).toBe(2);
    expect(board.placements()).toEqual([
      { slot: 2, place: 1, score: 4 },
      { slot: 1, place: 2, score: 3 },
      { slot: 3, place: 3, score: 0 },
    ]);
    expect(board.hud((slot) => (slot === 3 ? 'raus' : undefined))).toEqual([
      { slot: 1, score: 3 },
      { slot: 2, score: 4 },
      { slot: 3, score: 0, status: 'raus' },
    ]);
  });

  it('bei „weniger ist besser“ führt der mit den wenigsten Punkten', () => {
    const board = new Scoreboard([1, 2], 'lower');
    board.set(1, 12);
    board.set(2, 9);
    expect(board.leader()).toBe(2);
    expect(board.placements()[0]?.slot).toBe(2);
  });

  it('LeadTracker zählt Führungswechsel und merkt die Führung nach 2/3', () => {
    const lead = new LeadTracker(2000);
    lead.update([1, 0], 0);
    lead.update([1, 2], 1000);
    lead.update([3, 2], 2500);
    lead.update([3, 3], 2600);
    expect(lead.changes).toBe(2);
    expect(lead.leaderAtTwoThirds).toBe(0);
  });
});

describe('Gefahrenzonen', () => {
  it('Formen erkennen Treffer', () => {
    expect(shapeContains({ kind: 'circle', x: 1, z: 1, radius: 1 }, { x: 1.5, z: 1 })).toBe(true);
    expect(shapeContains({ kind: 'rect', x: 0, z: 0, halfX: 1, halfZ: 2 }, { x: 1.2, z: 0 })).toBe(
      false,
    );
    const ring = { kind: 'ring', x: 0, z: 0, inner: 2, outer: 3 } as const;
    expect(shapeContains(ring, { x: 0, z: 1 })).toBe(false);
    expect(shapeContains(ring, { x: 0, z: 2.5 })).toBe(true);
  });

  it('warnen, werden scharf und verschwinden', () => {
    const field = new HazardField<'pfuetze'>();
    const hazard = field.add('pfuetze', { kind: 'circle', x: 0, z: 0, radius: 1 }, 0, 1, 2);
    expect(field.warnedAt({ x: 0, z: 0 })).toEqual([hazard]);
    expect(field.activeAt({ x: 0, z: 0 })).toEqual([]);
    expect(field.update(0.5)).toEqual([]);
    expect(field.update(1).map((e) => e.type)).toEqual(['active']);
    expect(field.activeAt({ x: 0.5, z: 0 })).toEqual([hazard]);
    expect(field.update(3).map((e) => e.type)).toEqual(['over']);
    expect(field.hazards).toHaveLength(0);
    field.add('pfuetze', { kind: 'circle', x: 0, z: 0, radius: 1 }, 0, 0, 0);
    expect(field.update(0).map((e) => e.type)).toEqual(['active', 'over']);
    field.clear();
    expect(field.hazards).toHaveLength(0);
  });
});

describe('Benommenheit und Zustände', () => {
  it('Zustände laufen ab und werden nur verlängert', () => {
    const timers = new StatusTimers<'schub'>();
    timers.set(1, 'schub', 0, 2);
    timers.set(1, 'schub', 0.5, 0.5);
    expect(timers.remaining(1, 'schub', 1)).toBe(1);
    expect(timers.has(1, 'schub', 2)).toBe(false);
    timers.set(2, 'schub', 0, 1);
    timers.clear(2, 'schub');
    expect(timers.has(2, 'schub', 0)).toBe(false);
  });

  it('Benommen nur einmal gleichzeitig, danach Schonfrist', () => {
    const stun = new StunTracker({ stunS: 1, immuneS: 0.5 });
    expect(stun.stun(1, 0)).toBe(true);
    expect(stun.stun(1, 0.5)).toBe(false);
    expect(stun.isStunned(1, 0.9)).toBe(true);
    expect(stun.remaining(1, 0.25)).toBe(0.75);
    expect(stun.stun(1, 1.2)).toBe(false);
    expect(stun.stun(1, 1.6)).toBe(true);
    expect(stun.hits(1)).toBe(2);
    expect(stun.hits(2)).toBe(0);
  });
});

describe('Sichern/Riskieren-Konto', () => {
  it('sichert, platzt und wertet', () => {
    const bank = new RiskBank([1, 2]);
    bank.add(1, 5);
    expect(bank.bank(1)).toBe(5);
    expect(bank.bank(1)).toBe(0);
    bank.add(1, 7);
    expect(bank.bust(1, 0.5)).toBe(3);
    expect(bank.pot(1)).toBe(4);
    expect(bank.total(1)).toBe(9);
    bank.add(2, 4);
    expect(bank.bust(2)).toBe(4);
    expect(bank.account(2)).toMatchObject({ busts: 1, biggestLoss: 4, banked: 0 });
    expect(bank.scores()).toEqual([
      { slot: 1, score: 5 },
      { slot: 2, score: 0 },
    ]);
    expect(bank.scores(true)[0]?.score).toBe(9);
    expect(bank.add(3, 1)).toBe(0);
  });
});

describe('Arena-Grundrisse', () => {
  it('Bahnen liegen nebeneinander und decken die Breite ab', () => {
    const arena = arenaLayout({ form: 'bahnen', lanes: 4, laneWidth: 2, length: 12 });
    expect(arena.lanes.map((lane) => lane.x)).toEqual([-3, -1, 1, 3]);
    expect(arena.bounds).toEqual({ kind: 'rect', halfX: 4, halfZ: 6 });
    expect(laneAt(arena, -2.5)?.index).toBe(0);
    expect(laneAt(arena, 9)).toBeNull();
    const lane = arena.lanes[1];
    if (!lane) throw new Error('keine Bahn');
    const clamped = clampToZone(lane, 5, 9, 0.2);
    expect(clamped.x).toBeCloseTo(-0.2);
    expect(clamped.z).toBeCloseTo(5.8);
  });

  it('vier Eigenbereiche mit Spalt, Punkt bleibt im eigenen Feld', () => {
    const arena = arenaLayout({ form: 'eigenbereiche', zoneHalf: 2, gap: 1 });
    expect(arena.zones).toHaveLength(4);
    expect(zoneAt(arena, -2.5, 2.5)?.index).toBe(0);
    expect(zoneAt(arena, 0, 0)).toBeNull();
    const zone = arena.zones[3];
    if (!zone) throw new Error('kein Bereich');
    expect(clampToZone(zone, 0, 0)).toEqual({ x: 0.5, z: -0.5 });
    expect(startPoints(arena, 2)).toEqual([
      { x: -2.5, z: 2.5 },
      { x: 2.5, z: 2.5 },
    ]);
  });

  it('Insel hat eine Kante, rund und eckig nicht', () => {
    const island = arenaLayout({ form: 'insel', radius: 4 });
    expect(island.edge).toBe(true);
    expect(island.surfaceY).toBeGreaterThan(0);
    expect(offEdge(island, 0, 4.1)).toBe(true);
    expect(offEdge(island, 0, 3.9)).toBe(false);
    expect(offEdge(arenaLayout({ form: 'rund', radius: 4 }), 9, 9)).toBe(false);
    const rect = arenaLayout({ form: 'eckig', halfX: 5, halfZ: 3 });
    expect(rect.area).toEqual({ halfX: 6.5, halfZ: 4.5 });
    for (const point of startPoints(rect, 4)) {
      expect(Math.abs(point.x)).toBeLessThanOrEqual(5);
      expect(Math.abs(point.z)).toBeLessThanOrEqual(3);
    }
    expect(
      startPoints(arenaLayout({ form: 'bahnen', lanes: 2, laneWidth: 2, length: 10 }), 2),
    ).toEqual([
      { x: -1, z: -4 },
      { x: 1, z: -4 },
    ]);
  });

  it('eckige Insel: Kante an den Seiten, auch über die Ecke (CHAOS-241)', () => {
    const block = arenaLayout({ form: 'insel', halfX: 3, halfZ: 2, height: 0 });
    expect(block.edge).toBe(true);
    expect(block.surfaceY).toBe(0);
    expect(block.bounds).toEqual({ kind: 'rect', halfX: 3, halfZ: 2 });
    expect(block.area).toEqual({ halfX: 4.5, halfZ: 3.5 });
    expect(offEdge(block, 2.9, 1.9)).toBe(false);
    expect(offEdge(block, 3.1, 0)).toBe(true);
    expect(offEdge(block, 0, -2.1)).toBe(true);
    // Rund wäre (2.9, 1.9) bei Radius 3 schon draußen; eckig zählt die Ecke mit.
    expect(offEdge(arenaLayout({ form: 'insel', radius: 3 }), 2.9, 1.9)).toBe(true);
    expect(arenaLayout({ form: 'insel', halfX: 1, halfZ: 1 }).surfaceY).toBe(0.6);
  });
});
