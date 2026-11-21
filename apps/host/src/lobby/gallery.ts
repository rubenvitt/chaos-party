/**
 * Minispiel-Galerie in der PC-Lobby (CHAOS-87, seit CHAOS-228 auch Favoriten und Sperrliste der
 * Rotation aus CHAOS-85): reine Ableitung der Zeilen aus Katalog, Daumen-Übersicht und
 * Rotations-Stand des Servers. Ohne React, unit-getestet.
 */
import {
  GALLERY_STATUS_LABELS,
  galleryEntries,
  suggestsRemoval,
  type GalleryEntry,
  type GalleryStatus,
} from '@chaos-party/minigames/gallery';
import type { MinigameCategory } from '@chaos-party/minigame-sdk';
import type { LobbyMinigame, MinigameRating } from '@chaos-party/protocol';

export const CATEGORY_LABELS: Readonly<Record<MinigameCategory, string>> = {
  arcade: 'Arcade',
  physics: 'Physik',
  hybrid: 'Hybrid',
};

export interface GalleryRow {
  readonly id: string;
  readonly title: string;
  readonly tagline: string;
  readonly status: GalleryStatus;
  readonly statusLabel: string;
  readonly category: string;
  /** Familie (sobald der Steckbrief sie trägt) oder `null`. */
  readonly family: string | null;
  readonly controls: string;
  /** Spielzeit in ganzen Sekunden. */
  readonly seconds: number;
  readonly up: number;
  readonly down: number;
  /**
   * Favorit/Sperre, wenn der Server das Spiel in seiner Rotation führt (`lobby.settings.minigames`);
   * sonst `null` (nur „spielbar“ oder alter Server): dann gibt es nichts umzuschalten.
   */
  readonly pick: { readonly blocked: boolean; readonly favorite: boolean } | null;
  /**
   * Rotation, genug Stimmen, überwiegend Daumen runter und noch nicht gesperrt: Rauswurf
   * vorschlagen. Sperren geht mit einem Klick, aber nur durch Ruben (nichts automatisch).
   */
  readonly suggestRemoval: boolean;
}

export function galleryRows(
  ratings: readonly MinigameRating[],
  rotation: readonly LobbyMinigame[] = [],
  entries: readonly GalleryEntry[] = galleryEntries(),
): GalleryRow[] {
  const byId = new Map(ratings.map((rating) => [rating.id, rating]));
  const picks = new Map(rotation.map((game) => [game.id, game]));
  return entries.map((entry) => {
    const rating = byId.get(entry.info.id) ?? { up: 0, down: 0 };
    const game = picks.get(entry.info.id);
    const pick = game === undefined ? null : { blocked: game.blocked, favorite: game.favorite };
    return {
      id: entry.info.id,
      title: entry.info.title,
      tagline: entry.info.tagline,
      status: entry.status,
      statusLabel: GALLERY_STATUS_LABELS[entry.status],
      category: CATEGORY_LABELS[entry.info.category],
      family: entry.family,
      controls: entry.controls,
      seconds: Math.round(entry.info.durationMs / 1000),
      up: rating.up,
      down: rating.down,
      pick,
      suggestRemoval:
        entry.status === 'rotation' && pick?.blocked !== true && suggestsRemoval(rating),
    };
  });
}

/** Kurzer Text zu den Stimmen eines Spiels. */
export function votesText(row: Pick<GalleryRow, 'up' | 'down'>): string {
  const total = row.up + row.down;
  if (total === 0) return 'Noch keine Stimmen';
  return total === 1 ? '1 Stimme' : `${String(total)} Stimmen`;
}

/** Knopf „Minispiele“ ohne Rotation vom Server: nur die Zahl der startbaren Spiele. */
export function galleryCountSummary(entries: readonly GalleryEntry[] = galleryEntries()): {
  readonly short: string;
  readonly long: string;
} {
  const text = entries.length === 1 ? '1 Spiel' : `${String(entries.length)} Spiele`;
  return { short: text, long: text };
}
