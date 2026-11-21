/**
 * Brett-Register (CHAOS-197): welche Bretter es gibt und was die Lobby über sie zeigt.
 *
 * Das Register ist die Liste für die Brett-Auswahl in der Lobby (PC-, Mac- und Apple-TV-Host,
 * Controller). Die Topologie selbst steht in der `BoardDefinition`; hier kommen Thema,
 * Kurzbeschreibung und die empfohlene Partielänge dazu. Neue Bretter (CHAOS-198, CHAOS-199)
 * tragen sich hier ein; Reihenfolge = Reihenfolge in der Lobby.
 *
 * „Zufall“ ist keine Brett-ID, sondern eine Wahl in der Lobby: Der Server löst sie erst beim
 * Start auf (`randomBoard` mit dem Seed der Partie), damit eine Revanche neu würfelt und
 * dieselbe Partie mit `SEED` nachstellbar bleibt.
 */
import { createRng } from '../rng.ts';
import type { BoardDefinition } from '../types.ts';
import { FROSTGIPFEL } from './frostgipfel.ts';
import { RUMMELPLATZ } from './rummelplatz.ts';
import { WACKELWALD } from './wackelwald.ts';

/**
 * Thema eines Bretts: bestimmt Kulisse und Lichtstimmung im Host. Neue Bretter bringen ihr
 * Thema mit (CHAOS-198 „Frostgipfel“, CHAOS-199 „Rummelplatz bei Nacht“).
 */
export type BoardTheme = 'wald' | 'rummel' | 'frost';

export interface BoardInfo {
  /** Gleich `board.id`. */
  readonly id: string;
  readonly board: BoardDefinition;
  readonly theme: BoardTheme;
  /** Ein Satz für die Lobby, höchstens `MAX_BOARD_TAGLINE_LENGTH` Zeichen. */
  readonly tagline: string;
  /**
   * Empfohlene Rundenzahl (EXP-011): ab hier entscheiden meist die Trophäen. Größere Bretter
   * brauchen mehr Runden, bis alle Wege und Trophäen-Kandidaten im Spiel waren.
   */
  readonly recommendedRounds: number;
}

/** Höchstlänge der Kurzbeschreibung (Lobby-Karte, Apple-TV-Kachel). */
export const MAX_BOARD_TAGLINE_LENGTH = 80;

/** Alle wählbaren Bretter in Lobby-Reihenfolge. */
export const BOARD_REGISTRY: readonly BoardInfo[] = [
  {
    id: WACKELWALD.id,
    board: WACKELWALD,
    theme: 'wald',
    tagline: 'Großer Rundkurs mit Lichtung, Bachlauf, Baumkronenweg und Sumpf',
    // EXP-037: Nach 12 Runden ist jeder einmal ums Brett, kaum jemand bleibt ohne Trophäe.
    recommendedRounds: 12,
  },
  {
    id: RUMMELPLATZ.id,
    board: RUMMELPLATZ,
    theme: 'rummel',
    tagline: 'Jahrmarkt bei Nacht: Karussell dreht den Weg, Geisterbahn, Losbuden',
    recommendedRounds: 12,
  },
  {
    id: FROSTGIPFEL.id,
    board: FROSTGIPFEL,
    theme: 'frost',
    tagline: 'Verschneiter Berg: Eisfelder, Lawinen und eine Seilbahn zum Gipfel',
    recommendedRounds: 12,
  },
];

/** Registereintrag zu einer Brett-ID oder `undefined`. */
export function getBoardInfo(id: string): BoardInfo | undefined {
  return BOARD_REGISTRY.find((info) => info.id === id);
}

/**
 * Zufälliges Brett aus dem Register, deterministisch je Seed. Eigener Generator (Seed gemischt),
 * damit die Wahl nicht mit dem ersten Würfelwurf der Partie zusammenhängt.
 */
export function randomBoard(seed: number): BoardDefinition {
  const rng = createRng((seed ^ 0x5eed_b0a7) >>> 0);
  const info = BOARD_REGISTRY[rng.int(0, BOARD_REGISTRY.length - 1)];
  if (!info) throw new Error('Brett-Register ist leer');
  return info.board;
}
