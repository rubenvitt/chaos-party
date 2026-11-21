import { WACKELWALD } from '@chaos-party/game-core';
import { describe, expect, it } from 'vitest';
import { seeded } from '../nature/noise.ts';
import { boardEdges, boardTerrain } from './natureBoard.ts';
import {
  nearStream,
  segmentDistance,
  STREAM_CLEARANCE,
  wackelwaldScenery,
  wackelwaldTreeSpots,
} from './wackelwaldScenery.ts';

describe('Kulisse des großen Wackelwalds (CHAOS-196)', () => {
  const scenery = wackelwaldScenery(WACKELWALD);
  if (!scenery) throw new Error('Wackelwald ohne Kulisse');
  const edges = boardEdges(WACKELWALD);
  const { terrain } = boardTerrain(WACKELWALD);

  it('Bach läuft zwischen Uferweg und Baumkronenweg, ohne Feld oder Weg zu berühren', () => {
    expect(scenery.stream.length).toBeGreaterThanOrEqual(5);
    for (const p of scenery.stream) {
      for (const s of WACKELWALD.spaces) {
        expect(Math.hypot(s.position.x - p.x, s.position.z - p.z), s.id).toBeGreaterThanOrEqual(
          STREAM_CLEARANCE,
        );
      }
      for (const [a, b] of edges) expect(segmentDistance(p, a, b)).toBeGreaterThanOrEqual(1);
      // Oben, zwischen den beiden oberen Reihen.
      expect(p.z).toBeGreaterThan(9);
      expect(p.z).toBeLessThan(13);
    }
    // Wasser liegt im Bachbett unter der Wiese, die Ufer daneben nicht.
    const mid = scenery.stream[2];
    if (!mid) throw new Error('Bach zu kurz');
    expect(terrain.height(mid.x, mid.z)).toBeLessThan(-0.07);
  });

  it('Teich liegt im Wald, frei von Feldern und Wegen', () => {
    const { pond } = scenery;
    for (const s of WACKELWALD.spaces) {
      const d = Math.hypot((s.position.x - pond.x) / pond.rx, (s.position.z - pond.z) / pond.rz);
      expect(d, s.id).toBeGreaterThan(1.6);
    }
    expect(terrain.height(pond.x, pond.z)).toBeLessThan(-0.2);
  });

  it('Lichtung liegt vor ihrem Trophäen-Kandidaten in der Brettmitte', () => {
    const trophy = WACKELWALD.spaces.find((s) => s.id === 's49');
    expect(trophy?.kind).toBe('trophy');
    expect(scenery.clearing.x).toBeCloseTo(trophy?.position.x ?? NaN, 5);
    expect(scenery.clearing.z).toBeLessThan(trophy?.position.z ?? NaN);
  });

  it('Bäume: genug für einen Wald, keiner auf Feld, Weg, Teich, Bach oder knapp vor einem Feld', () => {
    const spots = wackelwaldTreeSpots(WACKELWALD, scenery, terrain, seeded(62));
    expect(spots.length).toBeGreaterThanOrEqual(25);
    expect(spots.length).toBeLessThanOrEqual(60);
    for (const t of spots) {
      for (const s of WACKELWALD.spaces) {
        expect(Math.hypot(s.position.x - t.x, s.position.z - t.z)).toBeGreaterThanOrEqual(2.3);
        const ahead = s.position.z - t.z;
        if (ahead > 0 && ahead < 3.8)
          expect(Math.abs(s.position.x - t.x)).toBeGreaterThanOrEqual(1.9);
      }
      for (const [a, b] of edges) expect(segmentDistance(t, a, b)).toBeGreaterThanOrEqual(1.6);
      expect(nearStream(scenery.stream, t, 1.2)).toBe(false);
      expect(Math.hypot(t.x - scenery.clearing.x, t.z - scenery.clearing.z)).toBeGreaterThanOrEqual(
        scenery.clearing.radius,
      );
    }
    // Deterministisch je Seed.
    expect(wackelwaldTreeSpots(WACKELWALD, scenery, terrain, seeded(62))).toEqual(spots);
  });

  it('ohne die Wegweiser (anderes Brett) gibt es keine Wackelwald-Kulisse', () => {
    const other = {
      ...WACKELWALD,
      spaces: WACKELWALD.spaces.map((s) => ({
        id: s.id,
        kind: s.kind,
        position: s.position,
        next: s.next,
      })),
    };
    expect(wackelwaldScenery(other)).toBeNull();
  });
});
