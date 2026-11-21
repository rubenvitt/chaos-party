/**
 * Daumen-Stimmen in einer JSON-Datei (CHAOS-87): Unter Node bleiben die Stimmen über Neustarts
 * erhalten. Geschrieben wird nach jeder Stimme (wenige je Minispiel) über eine Zwischendatei und
 * `rename`, damit ein Absturz keine halbe Datei hinterlässt. Eine kaputte Datei wird nicht
 * überschrieben, sondern beiseitegelegt (`.kaputt-<Zeit>`).
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  createMemoryRatingStore,
  parseRatingsFile,
  serializeRatingsFile,
  type RatingStore,
  type StoredRatingVote,
} from './ratings.ts';

export interface FileRatingStoreOptions {
  readonly warn?: (message: string) => void;
  readonly clock?: () => Date;
}

export function readRatingsFile(
  path: string,
  warn: (message: string) => void = console.warn,
): StoredRatingVote[] {
  if (!existsSync(path)) return [];
  try {
    return parseRatingsFile(readFileSync(path, 'utf8'));
  } catch (error) {
    const aside = `${path}.kaputt-${String(Date.now())}`;
    renameSync(path, aside);
    warn(`Stimmen-Datei ${path} unlesbar, beiseitegelegt als ${aside}: ${String(error)}`);
    return [];
  }
}

export function createFileRatingStore(
  path: string,
  options: FileRatingStoreOptions = {},
): RatingStore {
  const warn = options.warn ?? console.warn;
  const initial = readRatingsFile(path, warn);
  return createMemoryRatingStore(initial, {
    ...(options.clock ? { clock: options.clock } : {}),
    onChange(votes) {
      try {
        mkdirSync(dirname(path), { recursive: true });
        const temp = `${path}.tmp`;
        writeFileSync(temp, serializeRatingsFile(votes));
        renameSync(temp, path);
      } catch (error) {
        // Eine volle Platte darf die Partie nicht stoppen; die Stimme bleibt im Speicher.
        warn(`Stimmen konnten nicht gespeichert werden: ${String(error)}`);
      }
    },
  });
}
