import { describe, expect, it } from 'vitest';
import { REMOVAL_MIN_VOTES } from '@chaos-party/minigames/gallery';
import { galleryCountSummary, galleryRows, votesText } from './gallery.ts';

describe('Minispiel-Galerie am PC (CHAOS-87)', () => {
  it('zeigt alle Minispiele mit Status, Kategorie, Bedienung und Stimmen', () => {
    const rows = galleryRows([{ id: 'sockenregen', up: 2, down: 1 }]);
    const socken = rows.find((row) => row.id === 'sockenregen');
    expect(socken).toMatchObject({
      status: 'rotation',
      statusLabel: 'Rotation',
      up: 2,
      down: 1,
      suggestRemoval: false,
    });
    expect(socken?.controls).toMatch(/Stick|A:|B:/);
    expect(rows.find((row) => row.id === 'pump-parade')).toMatchObject({
      status: 'spielbar',
      up: 0,
      down: 0,
    });
  });

  it('schlägt nur Spiele der Rotation zum Rauswurf vor', () => {
    const many = [
      { id: 'sockenregen', up: 0, down: REMOVAL_MIN_VOTES },
      { id: 'pump-parade', up: 0, down: REMOVAL_MIN_VOTES },
    ];
    const rows = galleryRows(many);
    expect(rows.find((row) => row.id === 'sockenregen')?.suggestRemoval).toBe(true);
    expect(rows.find((row) => row.id === 'pump-parade')?.suggestRemoval).toBe(false);
  });

  it('trägt Favorit und Sperre aus der Rotation des Servers ein (CHAOS-228)', () => {
    const rows = galleryRows(
      [],
      [
        { id: 'sockenregen', title: 'Sockenregen', blocked: true, favorite: false },
        { id: 'wackelturm', title: 'Wackelturm', blocked: false, favorite: true },
      ],
    );
    expect(rows.find((row) => row.id === 'sockenregen')?.pick).toEqual({
      blocked: true,
      favorite: false,
    });
    expect(rows.find((row) => row.id === 'wackelturm')?.pick).toEqual({
      blocked: false,
      favorite: true,
    });
    // Nicht in der Rotation des Servers (nur spielbar): nichts umzuschalten.
    expect(rows.find((row) => row.id === 'pump-parade')?.pick).toBeNull();
    // Ohne Rotation (alter Server) gar keine Umschalter.
    expect(galleryRows([]).every((row) => row.pick === null)).toBe(true);
  });

  it('schlägt ein schon gesperrtes Spiel nicht mehr zum Rauswurf vor', () => {
    const down = [{ id: 'sockenregen', up: 0, down: REMOVAL_MIN_VOTES }];
    const game = { id: 'sockenregen', title: 'Sockenregen', favorite: false };
    const open = galleryRows(down, [{ ...game, blocked: false }]);
    expect(open.find((row) => row.id === 'sockenregen')?.suggestRemoval).toBe(true);
    const blocked = galleryRows(down, [{ ...game, blocked: true }]);
    expect(blocked.find((row) => row.id === 'sockenregen')?.suggestRemoval).toBe(false);
  });

  it('zählt die Spiele für den Lobby-Knopf ohne Rotation vom Server', () => {
    expect(galleryCountSummary().short).toMatch(/^\d+ Spiele$/);
    expect(galleryCountSummary([]).short).toBe('0 Spiele');
  });

  it('beschreibt die Zahl der Stimmen', () => {
    expect(votesText({ up: 0, down: 0 })).toBe('Noch keine Stimmen');
    expect(votesText({ up: 1, down: 0 })).toBe('1 Stimme');
    expect(votesText({ up: 2, down: 1 })).toBe('3 Stimmen');
  });
});
