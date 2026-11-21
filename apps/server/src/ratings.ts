/**
 * Daumen-Stimmen nach Minispielen (CHAOS-87, README §5.4). Rein und ohne Dateisystem, damit die
 * Session auch im Apple-Host (JavaScriptCore) läuft; `ratingsFile.ts` speichert unter Node in
 * eine Datei, der Apple-Host über eine Brücke aus Swift (CHAOS-220). Das Dateiformat
 * (`parseRatingsFile`, `serializeRatingsFile`) ist für beide dasselbe.
 *
 * Eine Stimme gehört zu einem Lauf (`play`: Partie + Runde) und einem Slot. Erneutes Abstimmen
 * im selben Lauf ersetzt die Stimme, statt eine zweite zu zählen.
 */
import { getMinigameInfo } from '@chaos-party/minigames/catalog';
import { galleryEntries, suggestsRemoval } from '@chaos-party/minigames/gallery';
import {
  MinigameIdSchema,
  SlotSchema,
  VoteSchema,
  type MinigameRating,
  type SlotNumber,
  type Vote,
} from '@chaos-party/protocol';

export interface RatingVote {
  /** Kennung des Laufs (Partie und Runde); gleich für alle Stimmen desselben Minispiel-Laufs. */
  readonly play: string;
  readonly slot: SlotNumber;
  readonly minigameId: string;
  readonly vote: Vote;
  /** Aus einer Übungsrunde der Galerie statt aus einer Partie. */
  readonly practice: boolean;
}

export interface StoredRatingVote extends RatingVote {
  /** Zeitpunkt der (letzten) Abgabe, ISO 8601. */
  readonly at: string;
}

export interface RatingStore {
  /** Speichert eine Stimme; dieselbe Kombination aus `play` und `slot` wird ersetzt. */
  record(vote: RatingVote): void;
  /** Alle gespeicherten Stimmen in Abgabe-Reihenfolge. */
  votes(): readonly StoredRatingVote[];
}

/** Stimmen im Speicher (Standard der Session; Apple-Host, Tests). */
export function createMemoryRatingStore(
  initial: readonly StoredRatingVote[] = [],
  options: {
    readonly clock?: () => Date;
    readonly onChange?: (votes: readonly StoredRatingVote[]) => void;
  } = {},
): RatingStore {
  const votes: StoredRatingVote[] = [...initial];
  const clock = options.clock ?? (() => new Date());
  return {
    record(vote) {
      const index = votes.findIndex(
        (entry) => entry.play === vote.play && entry.slot === vote.slot,
      );
      if (index !== -1) votes.splice(index, 1);
      votes.push({ ...vote, at: clock().toISOString() });
      options.onChange?.(votes);
    },
    votes() {
      return votes;
    },
  };
}

/** Zählt Stimmen je Minispiel (nur Minispiele mit Stimmen, nach Kennung sortiert). */
export function summarizeRatings(votes: readonly RatingVote[]): MinigameRating[] {
  const counts = new Map<string, { up: number; down: number }>();
  for (const vote of votes) {
    const count = counts.get(vote.minigameId) ?? { up: 0, down: 0 };
    count[vote.vote] += 1;
    counts.set(vote.minigameId, count);
  }
  return [...counts.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([id, count]) => ({ id, up: count.up, down: count.down }));
}

/** Format der Export-Datei (`/ratings.json`) für den Katalog. */
export const RATINGS_EXPORT_FORMAT = 'chaos-party-minigame-ratings';
export const RATINGS_EXPORT_VERSION = 1;

export interface RatingsExport {
  readonly format: typeof RATINGS_EXPORT_FORMAT;
  readonly version: typeof RATINGS_EXPORT_VERSION;
  readonly exportedAt: string;
  /** Je Minispiel des Katalogs (auch ohne Stimmen) plus Kennungen, die nur Stimmen haben. */
  readonly games: readonly {
    readonly id: string;
    readonly title: string | null;
    readonly status: string | null;
    readonly up: number;
    readonly down: number;
    /** Galerie schlägt vor, das Spiel aus der Rotation zu nehmen (Entscheidung bei Ruben). */
    readonly suggestRemoval: boolean;
  }[];
  readonly votes: readonly StoredRatingVote[];
}

export function ratingsExport(votes: readonly StoredRatingVote[], now: Date): RatingsExport {
  const counts = new Map(summarizeRatings(votes).map((rating) => [rating.id, rating]));
  const entries = galleryEntries();
  const known = new Set(entries.map((entry) => entry.info.id));
  const games = [
    ...entries.map((entry) => {
      const count = counts.get(entry.info.id) ?? { up: 0, down: 0 };
      return {
        id: entry.info.id,
        title: entry.info.title,
        status: entry.status,
        up: count.up,
        down: count.down,
        suggestRemoval: entry.status === 'rotation' && suggestsRemoval(count),
      };
    }),
    // Stimmen zu Spielen, die es im Katalog nicht mehr gibt, gehen nicht verloren.
    ...[...counts.values()]
      .filter((rating) => !known.has(rating.id))
      .map((rating) => ({
        id: rating.id,
        title: getMinigameInfo(rating.id)?.title ?? null,
        status: null,
        up: rating.up,
        down: rating.down,
        suggestRemoval: false,
      })),
  ];
  return {
    format: RATINGS_EXPORT_FORMAT,
    version: RATINGS_EXPORT_VERSION,
    exportedAt: now.toISOString(),
    games,
    votes: [...votes],
  };
}

/** Version der Stimmen-Datei (`minispiel-stimmen.json`, Node-Server und Apple-Host). */
export const RATINGS_FILE_VERSION = 1;

function isText(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max;
}

/** Prüft eine Stimme aus der Datei (gleiche Grenzen wie im Protokoll). */
function parseStoredVote(value: unknown): StoredRatingVote | null {
  if (typeof value !== 'object' || value === null) return null;
  const entry = value as Record<string, unknown>;
  const slot = SlotSchema.safeParse(entry.slot);
  const minigameId = MinigameIdSchema.safeParse(entry.minigameId);
  const vote = VoteSchema.safeParse(entry.vote);
  if (!slot.success || !minigameId.success || !vote.success) return null;
  if (!isText(entry.play, 128) || !isText(entry.at, 64) || typeof entry.practice !== 'boolean') {
    return null;
  }
  return {
    play: entry.play,
    slot: slot.data,
    minigameId: minigameId.data,
    vote: vote.data,
    practice: entry.practice,
    at: entry.at,
  };
}

/** Inhalt der Stimmen-Datei → Stimmen; wirft bei kaputtem oder unbekanntem Inhalt. */
export function parseRatingsFile(raw: string): StoredRatingVote[] {
  const data: unknown = JSON.parse(raw);
  if (typeof data !== 'object' || data === null) throw new Error('kein Objekt');
  const file = data as Record<string, unknown>;
  if (file.version !== RATINGS_FILE_VERSION) {
    throw new Error(`unbekannte Version ${String(file.version)}`);
  }
  if (!Array.isArray(file.votes)) throw new Error('votes fehlt');
  return file.votes.map((entry: unknown, index) => {
    const vote = parseStoredVote(entry);
    if (!vote) throw new Error(`Stimme ${String(index)} ungültig`);
    return vote;
  });
}

/** Stimmen → Inhalt der Stimmen-Datei (eingerückt, mit Zeilenende). */
export function serializeRatingsFile(votes: readonly StoredRatingVote[]): string {
  return `${JSON.stringify({ version: RATINGS_FILE_VERSION, votes }, null, 2)}\n`;
}
