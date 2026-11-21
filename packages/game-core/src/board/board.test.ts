import { describe, expect, it } from 'vitest';
import type { BoardDefinition, BoardSpace, SpaceKind } from '../types.ts';
import {
  BOARDS,
  DEFAULT_BOARD,
  getBoard,
  activeNext,
  CAROUSEL_SPACE,
  FROSTGIPFEL,
  isCableEdge,
  isIce,
  isChoiceFork,
  MIN_SPACE_DISTANCE,
  rotationExit,
  RUMMELPLATZ,
  validateBoard,
  WACKELWALD,
} from './index.ts';

/** Kleines gültiges Brett: Start → a → Gabel b → (c | d) → e → Start. */
function tinyBoard(): BoardDefinition {
  const spaces: BoardSpace[] = [
    { id: 'st', kind: 'start', position: { x: 0, z: 0 }, next: ['a'] },
    { id: 'a', kind: 'coins-plus', position: { x: 2, z: 0 }, next: ['b'] },
    { id: 'b', kind: 'coins-minus', position: { x: 4, z: 0 }, next: ['c', 'd'] },
    { id: 'c', kind: 'trophy', position: { x: 6, z: 2 }, next: ['e'], label: 'Oben' },
    { id: 'd', kind: 'item', position: { x: 6, z: -2 }, next: ['e'], label: 'Unten' },
    { id: 'e', kind: 'event', position: { x: 8, z: 0 }, next: ['st'] },
  ];
  return { id: 'mini', name: 'Mini', start: 'st', spaces };
}

function withSpaces(
  board: BoardDefinition,
  change: (spaces: BoardSpace[]) => BoardSpace[],
): BoardDefinition {
  return { ...board, spaces: change([...board.spaces]) };
}

function replace(spaces: BoardSpace[], id: string, patch: Partial<BoardSpace>): BoardSpace[] {
  return spaces.map((s) => (s.id === id ? { ...s, ...patch } : s));
}

function errorsOf(board: BoardDefinition): string[] {
  const result = validateBoard(board);
  return result.ok ? [] : result.errors;
}

function countKinds(board: BoardDefinition): Record<SpaceKind, number> {
  const counts: Record<SpaceKind, number> = {
    start: 0,
    'coins-plus': 0,
    'coins-minus': 0,
    event: 0,
    item: 0,
    trophy: 0,
  };
  for (const space of board.spaces) counts[space.kind]++;
  return counts;
}

/** Länge (Felder) des Wegs ab `from`, bis ein Feld mit mehreren Vorgängern erreicht ist. */
function branchLength(board: BoardDefinition, from: string): number {
  const byId = new Map(board.spaces.map((s) => [s.id, s]));
  const incoming = new Map<string, number>();
  for (const s of board.spaces) for (const n of s.next) incoming.set(n, (incoming.get(n) ?? 0) + 1);
  let length = 0;
  let id: string | undefined = from;
  while (id !== undefined && (incoming.get(id) ?? 0) < 2) {
    length++;
    id = byId.get(id)?.next[0];
  }
  return length;
}

describe('Brett „Wackelwald“', () => {
  it('ist gültig', () => {
    expect(validateBoard(WACKELWALD)).toEqual({ ok: true });
  });

  it('ist Standardbrett und über getBoard/BOARDS auffindbar', () => {
    expect(DEFAULT_BOARD).toBe(WACKELWALD);
    expect(BOARDS.wackelwald).toBe(WACKELWALD);
    expect(getBoard('wackelwald')).toBe(WACKELWALD);
    expect(getBoard('gibt-es-nicht')).toBeUndefined();
    expect(getBoard('toString')).toBeUndefined();
  });

  it('jedes Brett in BOARDS ist gültig und unter seiner ID abgelegt', () => {
    for (const [id, board] of Object.entries(BOARDS)) {
      expect(board.id).toBe(id);
      expect(validateBoard(board)).toEqual({ ok: true });
    }
  });

  it('hat 70–90 Felder in der vorgesehenen Verteilung (CHAOS-196)', () => {
    const counts = countKinds(WACKELWALD);
    expect(WACKELWALD.spaces.length).toBeGreaterThanOrEqual(70);
    expect(WACKELWALD.spaces.length).toBeLessThanOrEqual(90);
    expect(counts.start).toBe(1);
    // 13 Trophäen-Kandidaten und zehn Item-Felder (EXP-037).
    expect(counts.trophy).toBe(13);
    expect(counts.item).toBe(10);
    expect(counts.event).toBeGreaterThanOrEqual(6);
    expect(counts['coins-minus']).toBeGreaterThan(0);
    // Plus-Felder deutlich häufiger als Minus-Felder; gute Felder (Plus, Item, Trophäe) überwiegen.
    expect(counts['coins-plus']).toBeGreaterThanOrEqual(2.5 * counts['coins-minus']);
    expect(counts['coins-plus'] + counts.item + counts.trophy).toBeGreaterThan(
      WACKELWALD.spaces.length / 2,
    );
  });

  it('hat vier Gabeln, jeder Zweig mit Trophäen-Kandidat', () => {
    const forks = WACKELWALD.spaces.filter((s) => s.next.length >= 2);
    expect(forks.map((s) => s.id)).toEqual(['s07', 's20', 's25', 's29']);
    const byId = new Map(WACKELWALD.spaces.map((s) => [s.id, s]));
    for (const fork of forks) {
      for (const head of fork.next) {
        const branch: string[] = [];
        for (let id: string | undefined = head; id !== undefined && branch.length < 20;) {
          const space = byId.get(id);
          if (!space || space.next.length > 1 || (branch.length > 0 && space.label)) break;
          const merged = WACKELWALD.spaces.filter((s) => s.next.includes(id ?? '')).length > 1;
          if (merged) break;
          branch.push(id);
          id = space.next[0];
        }
        const trophies = branch.filter((id) => byId.get(id)?.kind === 'trophy');
        expect(trophies.length, `Zweig ab ${head}`).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('hat mindestens zwei Verzweigungen mit unterschiedlich langen, beschrifteten Wegen', () => {
    const forks = WACKELWALD.spaces.filter((s) => s.next.length >= 2);
    expect(forks.length).toBeGreaterThanOrEqual(2);
    const byId = new Map(WACKELWALD.spaces.map((s) => [s.id, s]));
    for (const fork of forks) {
      const lengths = fork.next.map((id) => branchLength(WACKELWALD, id));
      expect(new Set(lengths).size, `Wege ab ${fork.id}`).toBe(lengths.length);
      for (const id of fork.next) {
        const label = byId.get(id)?.label;
        expect(label, `Wegweiser an ${id}`).toBeTruthy();
        expect(label?.length ?? 0).toBeLessThanOrEqual(32);
      }
    }
  });

  it('liegt auf etwa 42 × 26 Einheiten mit IDs wie s01, Wege höchstens 3,4 lang', () => {
    for (const space of WACKELWALD.spaces) {
      expect(space.id).toMatch(/^s\d{2}$/);
      expect(Math.abs(space.position.x)).toBeLessThanOrEqual(21);
      expect(Math.abs(space.position.z)).toBeLessThanOrEqual(14);
    }
    const byId = new Map(WACKELWALD.spaces.map((s) => [s.id, s.position]));
    for (const space of WACKELWALD.spaces) {
      for (const next of space.next) {
        const to = byId.get(next) ?? space.position;
        const length = Math.hypot(to.x - space.position.x, to.z - space.position.z);
        expect(length, `${space.id} → ${next}`).toBeLessThanOrEqual(3.4);
      }
    }
  });
});

describe('validateBoard', () => {
  it('akzeptiert ein kleines gültiges Brett', () => {
    expect(validateBoard(tinyBoard())).toEqual({ ok: true });
  });

  it('meldet doppelte IDs', () => {
    const board = withSpaces(tinyBoard(), (spaces) => replace(spaces, 'e', { id: 'a' }));
    expect(errorsOf(board)).toContainEqual(expect.stringContaining('„a“ ist doppelt'));
  });

  it('meldet ungültige IDs', () => {
    const board = { ...withSpaces(tinyBoard(), (s) => replace(s, 'a', { id: 'A 1' })), id: 'X' };
    const errors = errorsOf(board);
    expect(errors).toContainEqual(expect.stringContaining('Brett-ID „X“'));
    expect(errors).toContainEqual(expect.stringContaining('Feld-ID „A 1“'));
  });

  it('meldet fehlendes Startfeld und falschen Starttyp', () => {
    expect(errorsOf({ ...tinyBoard(), start: 'zz' })).toContainEqual(
      expect.stringContaining('Startfeld „zz“ existiert nicht'),
    );
    const wrongKind = { ...tinyBoard(), start: 'a' };
    expect(errorsOf(wrongKind)).toContainEqual(expect.stringContaining('nicht den Typ „start“'));
    const twoStarts = withSpaces(tinyBoard(), (s) => replace(s, 'a', { kind: 'start' }));
    expect(errorsOf(twoStarts)).toContainEqual(expect.stringContaining('genau ein Feld'));
  });

  it('meldet unbekannte Nachfolger', () => {
    const board = withSpaces(tinyBoard(), (s) => replace(s, 'a', { next: ['nix'] }));
    expect(errorsOf(board)).toContainEqual(expect.stringContaining('unbekanntes Feld „nix“'));
  });

  it('meldet Selbstschleifen', () => {
    const board = withSpaces(tinyBoard(), (s) => replace(s, 'b', { next: ['b', 'c'] }));
    expect(errorsOf(board)).toContainEqual(expect.stringContaining('b zeigt auf sich selbst'));
  });

  it('meldet Sackgassen', () => {
    const board = withSpaces(tinyBoard(), (s) => replace(s, 'e', { next: [] }));
    const errors = errorsOf(board);
    expect(errors).toContainEqual(expect.stringContaining('e ist eine Sackgasse'));
    // Ohne Rückweg kommt man auch nicht mehr zum Start.
    expect(errors).toContainEqual(expect.stringContaining('kein Weg zurück'));
  });

  it('meldet Felder, die vom Start aus nicht erreichbar sind', () => {
    const board = withSpaces(tinyBoard(), (s) => [
      ...s,
      { id: 'insel', kind: 'coins-plus', position: { x: 20, z: 20 }, next: ['st'] },
    ]);
    expect(errorsOf(board)).toEqual(['Feld insel ist vom Start aus nicht erreichbar']);
  });

  it('meldet Felder ohne Rückweg zum Start (nicht stark zusammenhängend)', () => {
    // c → f ↔ g: von c aus gibt es keinen Weg mehr zurück.
    const board = withSpaces(tinyBoard(), (s) => [
      ...replace(s, 'c', { next: ['f'] }),
      { id: 'f', kind: 'coins-plus', position: { x: 6, z: 6 }, next: ['g'] },
      { id: 'g', kind: 'coins-plus', position: { x: 8, z: 6 }, next: ['f'] },
    ]);
    const errors = errorsOf(board);
    expect(errors).toContainEqual('Von Feld c führt kein Weg zurück zum Start');
    expect(errors).toContainEqual('Von Feld f führt kein Weg zurück zum Start');
    expect(errors).not.toContainEqual(expect.stringContaining('Von Feld d'));
  });

  it('meldet doppelte Nachfolger an einer Verzweigung', () => {
    const board = withSpaces(tinyBoard(), (s) => replace(s, 'b', { next: ['c', 'c'] }));
    expect(errorsOf(board)).toContainEqual(
      expect.stringContaining('b nennt einen Nachfolger doppelt'),
    );
  });

  it('meldet zu dicht liegende Felder', () => {
    const board = withSpaces(tinyBoard(), (s) => replace(s, 'a', { position: { x: 0.5, z: 1 } }));
    expect(errorsOf(board)).toContainEqual(expect.stringContaining('st und a liegen zu dicht'));
    const exact = withSpaces(tinyBoard(), (s) =>
      replace(s, 'a', { position: { x: MIN_SPACE_DISTANCE, z: 0 } }),
    );
    expect(validateBoard(exact)).toEqual({ ok: true });
  });

  it('meldet ungültige Positionen und zu lange Wegweiser', () => {
    const board = withSpaces(tinyBoard(), (s) =>
      replace(replace(s, 'e', { position: { x: Number.NaN, z: 0 } }), 'c', {
        label: 'x'.repeat(33),
      }),
    );
    const errors = errorsOf(board);
    expect(errors).toContainEqual('Feld e hat keine gültige Position');
    expect(errors).toContainEqual(expect.stringContaining('Wegweiser von c'));
  });

  it('verlangt mindestens ein Trophäenfeld', () => {
    const board = withSpaces(tinyBoard(), (s) => replace(s, 'c', { kind: 'coins-plus' }));
    expect(errorsOf(board)).toEqual(['Brett hat kein Trophäenfeld']);
  });

  it('verlangt mindestens eine Verzweigung', () => {
    const board = withSpaces(tinyBoard(), (s) =>
      replace(
        s.filter((x) => x.id !== 'd'),
        'b',
        { next: ['c'] },
      ),
    );
    expect(errorsOf(board)).toEqual(['Brett hat keine Verzweigung']);
  });

  it('meldet ein leeres Brett', () => {
    const errors = errorsOf({ id: 'leer', name: 'Leer', start: 'st', spaces: [] });
    expect(errors).toContain('Brett hat keine Felder');
  });

  it('sammelt mehrere Fehler auf einmal', () => {
    const board = withSpaces(tinyBoard(), (s) =>
      replace(replace(s, 'a', { next: ['a'] }), 'e', { next: ['nix'] }),
    );
    expect(errorsOf(board).length).toBeGreaterThanOrEqual(3);
  });
});

describe('Brett „Rummelplatz“ (CHAOS-199)', () => {
  it('ist gültig, im Register und hat 70–90 Felder mit IDs wie s01', () => {
    expect(validateBoard(RUMMELPLATZ)).toEqual({ ok: true });
    expect(getBoard('rummelplatz')).toBe(RUMMELPLATZ);
    expect(RUMMELPLATZ.spaces.length).toBeGreaterThanOrEqual(70);
    expect(RUMMELPLATZ.spaces.length).toBeLessThanOrEqual(90);
    for (const space of RUMMELPLATZ.spaces) expect(space.id).toMatch(/^s\d{2}$/);
  });

  it('hat drei Gabeln mit Wegwahl, beschriftete Wege und neun Trophäen-Kandidaten', () => {
    const forks = RUMMELPLATZ.spaces.filter((s) => isChoiceFork(RUMMELPLATZ, s.id));
    expect(forks.map((s) => s.id)).toEqual(['s07', 's31', 's39']);
    const byId = new Map(RUMMELPLATZ.spaces.map((s) => [s.id, s]));
    for (const fork of forks) {
      for (const next of fork.next) expect(byId.get(next)?.label).toBeTruthy();
    }
    expect(countKinds(RUMMELPLATZ).trophy).toBe(9);
  });

  it('das Karussell ist kein Wegwahl-Feld und dreht reihum West → Süd → Ost', () => {
    expect(isChoiceFork(RUMMELPLATZ, CAROUSEL_SPACE)).toBe(false);
    const rotation = RUMMELPLATZ.rotations?.[0];
    expect(rotation?.space).toBe(CAROUSEL_SPACE);
    if (!rotation) return;
    expect([1, 2, 3, 4, 5, 6].map((round) => rotationExit(rotation, round))).toEqual([
      's68',
      's73',
      's77',
      's68',
      's73',
      's77',
    ]);
    expect(activeNext(RUMMELPLATZ, CAROUSEL_SPACE, 2)).toEqual(['s73']);
    expect(activeNext(RUMMELPLATZ, 's07', 2)).toEqual(['s08', 's18']);
  });
});

describe('validateBoard: drehende Felder (CHAOS-199)', () => {
  /** Mini-Brett mit Drehfeld b: Ausgang c oder d, beide zurück zum Start. */
  function rotating(exits: string[] = ['c', 'd']): BoardDefinition {
    return { ...tinyBoard(), rotations: [{ space: 'b', exits }] };
  }

  it('akzeptiert eine Drehung, deren Ausgänge zu next passen', () => {
    // tinyBoard hat sonst keine Wegwahl: eine zweite Gabel dazu.
    const board = withSpaces(rotating(), (spaces) => replace(spaces, 'a', { next: ['b', 'e'] }));
    expect(errorsOf(board)).toEqual([]);
  });

  it('zählt ein drehendes Feld nicht als Verzweigung', () => {
    expect(errorsOf(rotating())).toContain('Brett hat keine Verzweigung');
  });

  it('meldet unbekanntes Feld, zu wenige, doppelte und unpassende Ausgänge', () => {
    const unknown = { ...tinyBoard(), rotations: [{ space: 'zz', exits: ['c', 'd'] }] };
    expect(errorsOf(unknown)).toContain('Drehung an unbekanntem Feld „zz“');
    expect(errorsOf(rotating(['c']))).toContain('Drehung an b braucht mindestens zwei Ausgänge');
    expect(errorsOf(rotating(['c', 'c']))).toContain('Drehung an b nennt einen Ausgang doppelt');
    expect(errorsOf(rotating(['c', 'e']))).toContain(
      'Ausgänge der Drehung an b passen nicht zu „next“',
    );
  });

  it('meldet eine Stellung, in der Felder nicht mehr zum Start zurückkommen', () => {
    // d führt nur zurück auf b: In der Runde, in der b nach d dreht, kreist man b → d → b.
    const board = withSpaces(rotating(), (spaces) => replace(spaces, 'd', { next: ['b'] }));
    expect(errorsOf(board)).toContainEqual(
      expect.stringMatching(/^In Runde 2 führt von .*b.* kein Weg zurück zum Start$/),
    );
  });
});

describe('Brett „Frostgipfel“ (CHAOS-198)', () => {
  it('ist gültig, im Register und hat 70–90 Felder', () => {
    expect(validateBoard(FROSTGIPFEL)).toEqual({ ok: true });
    expect(getBoard('frostgipfel')).toBe(FROSTGIPFEL);
    expect(FROSTGIPFEL.spaces.length).toBeGreaterThanOrEqual(70);
    expect(FROSTGIPFEL.spaces.length).toBeLessThanOrEqual(90);
  });

  it('hat vier Gabeln (eine davon die Seilbahn), beschriftete Wege und neun Kandidaten', () => {
    const forks = FROSTGIPFEL.spaces.filter((s) => isChoiceFork(FROSTGIPFEL, s.id));
    expect(forks.map((s) => s.id)).toEqual(['f04', 'f07', 'f31', 'f39']);
    const byId = new Map(FROSTGIPFEL.spaces.map((s) => [s.id, s]));
    for (const fork of forks) {
      for (const next of fork.next) expect(byId.get(next)?.label).toBeTruthy();
    }
    expect(countKinds(FROSTGIPFEL).trophy).toBe(9);
    expect(isCableEdge(FROSTGIPFEL, 'f04', 'g06')).toBe(true);
    expect(isCableEdge(FROSTGIPFEL, 'f04', 'f05')).toBe(false);
  });

  it('hat Eis am Gletscherpfad, am Gipfelweg und auf der Rodelbahn', () => {
    expect(FROSTGIPFEL.ice).toEqual(['f18', 'f21', 'g08', 'r1', 'r2', 'r3', 'r7']);
    expect(isIce(FROSTGIPFEL, 'r2')).toBe(true);
    expect(isIce(FROSTGIPFEL, 'r4')).toBe(false);
  });
});

describe('validateBoard: Eis, Seilbahn, Lawine (CHAOS-198)', () => {
  it('akzeptiert gültige Mechaniken auf dem Mini-Brett', () => {
    const board: BoardDefinition = {
      ...tinyBoard(),
      ice: ['a'],
      cableCars: [{ from: 'b', to: 'd', price: 3 }],
      avalanche: { every: 2, coins: 4, zones: [{ name: 'Hang', spaces: ['c', 'd'] }] },
    };
    expect(errorsOf(board)).toEqual([]);
  });

  it('meldet ungültige Eisfelder', () => {
    const errors = (ice: string[], board = tinyBoard()) => errorsOf({ ...board, ice });
    expect(errors(['zz'])).toContain('Eisfeld „zz“ existiert nicht');
    expect(errors(['a', 'a'])).toContain('Eisfeld a ist doppelt');
    expect(errors(['st'])).toContain('Eisfeld st darf kein Start- oder Trophäenfeld sein');
    expect(errors(['b'])).toContain('Eisfeld b braucht genau einen Nachfolger');
    // d → e → st: e auf Eis endet auf dem Start (erlaubt), c ist ein Trophäenfeld.
    const toTrophy = withSpaces(tinyBoard(), (spaces) => replace(spaces, 'e', { next: ['c'] }));
    expect(errors(['e'], toTrophy)).toContain('Rutschpartie ab e endet auf dem Trophäenfeld c');
    const loop = withSpaces(tinyBoard(), (spaces) => replace(spaces, 'e', { next: ['d'] }));
    expect(errors(['d', 'e'], loop)).toContain('Eis ab d läuft im Kreis');
  });

  it('meldet ungültige Seilbahnen', () => {
    const errors = (from: string, to: string, price = 3) =>
      errorsOf({ ...tinyBoard(), cableCars: [{ from, to, price }] });
    expect(errors('a', 'zz')).toContain('Seilbahn a → zz verbindet unbekannte Felder');
    expect(errors('a', 'b')).toContain('Seilbahn a → b ist keine Kante einer Gabel mit Wegwahl');
    expect(errors('b', 'c')).toContain('Seilbahn b → c darf nicht der erste Weg der Gabel sein');
    expect(errors('b', 'd', 0)).toContain('Seilbahn b → d braucht einen Preis ≥ 1');
  });

  it('meldet ungültige Lawinen', () => {
    const errors = (avalanche: NonNullable<BoardDefinition['avalanche']>) =>
      errorsOf({ ...tinyBoard(), avalanche });
    expect(errors({ every: 0, coins: 0, zones: [] })).toEqual(
      expect.arrayContaining([
        'Lawine braucht einen Abstand von mindestens einer Runde',
        'Lawine braucht einen Münzverlust ≥ 1',
        'Lawine braucht mindestens eine Zone',
      ]),
    );
    expect(errors({ every: 2, coins: 3, zones: [{ name: 'Hang', spaces: ['zz', 'st'] }] })).toEqual(
      expect.arrayContaining([
        'Lawinenzone „Hang“: Feld „zz“ existiert nicht',
        'Lawinenzone „Hang“ enthält den Start',
      ]),
    );
  });
});
