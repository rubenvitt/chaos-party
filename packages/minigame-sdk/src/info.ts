/**
 * Reiner Teil des Minispiel-Vertrags (CHAOS-26, ADR-012): Beschreibung eines Minispiels,
 * Eingaben und Ergebnis. Ohne Babylon, ohne DOM – Server, game-core-Integration,
 * Controller und Host dürfen das importieren.
 *
 * Änderungen nur additiv und abgestimmt (Koordinator).
 */

/** Spielerplatz 1–4 (gleich `Slot` aus game-core und `SlotNumber` aus protocol). */
export type Slot = 1 | 2 | 3 | 4;

/** Kategorie laut ROADMAP M3. */
export type MinigameCategory = 'arcade' | 'physics' | 'hybrid';

/** Kennung eines Minispiels: Kleinbuchstaben, Ziffern, Bindestrich, 3–32 Zeichen. */
export const MINIGAME_ID_PATTERN = /^[a-z0-9-]{3,32}$/;

/** Grenzen für Texte, die über das Protokoll gehen (gleich in den zod-Schemas). */
export const MINIGAME_TEXT_LIMITS = {
  title: 24,
  tagline: 64,
  instruction: 64,
  instructions: 3,
  controlLabel: 16,
  highlight: 64,
  highlights: 4,
} as const;

/**
 * Bedienung am Controller (iPhone und iPad-Zone nutzen dasselbe Layout `joystick-buttons`).
 * `null` = Element wird nicht angezeigt und die Eingabe nicht angeboten. Die Texte sind
 * kurze deutsche Verben („Laufen“, „Springen“) und stehen auf dem Controller und in der
 * Anleitung am PC.
 */
export interface MinigameControls {
  readonly joystick: string | null;
  readonly a: string | null;
  readonly b: string | null;
}

/** Grenzen eines Controller-Hinweises ({@link MinigameCue}, gleich im zod-Schema). */
export const MINIGAME_CUE_LIMITS = {
  /** Höchstzahl Abschnitte (Schnellfeuer: fünf Mikro-Spiele). */
  steps: 16,
  /** Piktogramm: ein Emoji (einige UTF-16-Einheiten). */
  icon: 8,
  /** Bildwort („HAUEN!“). */
  word: 16,
} as const;

/**
 * Hinweis für den Controller mitten im Spiel (CHAOS-231, optional): Ein Minispiel aus
 * Abschnitten (Schnellfeuer: ein Mikro-Spiel je Abschnitt) zeigt am Controller das Bildwort und
 * nur die Bedienung des laufenden Abschnitts. Die Bedienung ist eine Teilmenge von
 * `info.controls` (der Server bietet nur an, was der Steckbrief nennt). Ein neuer Abschnitt
 * (`step`) heißt neuer Hinweis; die Laufzeit meldet nur Wechsel.
 */
export interface MinigameCue {
  /** Abschnitt, 0-basiert. */
  readonly step: number;
  /** Abschnitte insgesamt (1 … `MINIGAME_CUE_LIMITS.steps`). */
  readonly steps: number;
  readonly icon: string;
  readonly word: string;
  readonly controls: MinigameControls;
  /** Abschnitt zählt doppelt (Schnellfeuer-Finale „×2“). */
  readonly double: boolean;
}

/**
 * Steckbrief eines Minispiels. Wird vom Server für Auswahl, Fristen und Controller-Kontext
 * genutzt und vom Host für Anleitung und Ergebnis – darum rein und serialisierbar.
 */
export interface MinigameInfo {
  readonly id: string;
  readonly category: MinigameCategory;
  /** Name am PC und am Controller (≤ 24 Zeichen). */
  readonly title: string;
  /** Ein Satz, worum es geht (≤ 64 Zeichen). */
  readonly tagline: string;
  /** 1–3 kurze Zeilen Anleitung (je ≤ 64 Zeichen), Ziel zuerst. */
  readonly instructions: readonly string[];
  readonly controls: MinigameControls;
  /** Reine Spielzeit in ms (ohne Intro/Ergebnis). Das Minispiel endet spätestens dann. */
  readonly durationMs: number;
  /** Braucht Havok? Dann aktiviert die Laufzeit die Physik in der Szene vor `prepare`. */
  readonly physics: boolean;
  /** Bei gleicher Punktzahl gleicher Platz; `higher` = mehr Punkte sind besser. */
  readonly scoring: 'higher' | 'lower';
  /** Einheit der Punkte für die Anzeige („Punkte“, „Sekunden“, „Meter“). */
  readonly scoreUnit: string;

  // --- Tauglichkeit und Familie für die Rotation (CHAOS-85, docs/minigames/README.md §3–§6) ---
  // Alle optional (additiv). Kernverb, Spielform und Bedienung stehen im Vielfalts-Steckbrief
  // (`packages/minigames/src/steckbriefe.ts`, ADR-021); die Rotation liest beides.

  /** Mechanik-Familie (README §4); nie zwei Spiele derselben Familie hintereinander. */
  readonly family?: MinigameFamily;
  /** Kleinste/größte Spielerzahl, für die das Spiel taugt; fehlt = 1 bzw. 4. */
  readonly minPlayers?: number;
  readonly maxPlayers?: number;
  /**
   * Am geteilten iPad (Zone) bedienbar? `false` = „nur iPhone“: Die Rotation lässt das Spiel
   * weg, sobald jemand an einer iPad-Zone spielt (README §5.3 Punkt 4). Fehlt = tauglich.
   */
  readonly ipadZone?: boolean;
  /**
   * Geheime Wahl am Controller (Familie Bluff, README §7 Nr. 4): Bei iPad-Zonen in der
   * Aufstellung zieht die Rotation das Spiel deutlich seltener (Gewicht, kein Ausschluss).
   */
  readonly secretChoice?: boolean;
}

/** Die 20 Mechanik-Familien aus README §4 (Kennung für Steckbrief und Rotation). */
export const MINIGAME_FAMILIES = [
  'fangen-sammeln',
  'ausweichen-ueberleben',
  'rempeln-schubsen',
  'timing-rhythmus',
  'reflex-reaktion',
  'pumpen-dosieren',
  'zielen-werfen',
  'balance-stapeln',
  'rennen-parcours',
  'gedaechtnis-muster',
  'zocken',
  'bluff-geheime-wahl',
  'revier-malen',
  'fahrzeuge-schwung',
  'schaetzen-wahrnehmung',
  'hektik-kueche',
  'einer-gegen-alle',
  'zwei-gegen-zwei',
  'koop-chaos',
  'mikro',
] as const;

export type MinigameFamily = (typeof MINIGAME_FAMILIES)[number];

/** Eingabe eines Slots, wie die Laufzeit sie an das Minispiel gibt (ohne `seq`/Umschlag). */
export type MinigameInput =
  | { readonly type: 'move'; readonly x: number; readonly y: number }
  | { readonly type: 'press'; readonly button: 'a' | 'b' }
  | { readonly type: 'release'; readonly button: 'a' | 'b' };

/** Platz eines Spielers im Minispiel. Gleichstand = gleicher Platz (1, 1, 3, 4). */
export interface MinigamePlacement {
  readonly slot: Slot;
  readonly place: number;
  /** Ganzzahlige Punktzahl in `info.scoreUnit` (für Anzeige und Prüfung). */
  readonly score: number;
}

export interface MinigameResult {
  readonly minigameId: string;
  /** Alle teilnehmenden Slots, nach Platz sortiert. */
  readonly placements: readonly MinigamePlacement[];
  /** 0–4 kurze Höhepunkte für die Ergebnisanzeige („Rot flog dreimal vom Floß“). */
  readonly highlights?: readonly string[];
}

/**
 * Die vier kosmetischen Figuren (CHAOS-27). Keine Spielvorteile, nur Optik. Einzige Quelle ist
 * seit Protokoll v4 `@chaos-party/protocol/characters` (Charakterwahl CHAOS-36, ADR-015);
 * hier nur re-exportiert, damit Minispiele und Host weiter aus dem SDK importieren können.
 * `defaultCharacterFor` ist nur noch der Vorschlag je Slot – die echte Wahl steht in
 * `BoardPlayer.character` bzw. `LobbyPlayer.character`.
 */
export {
  CHARACTER_IDS,
  CHARACTER_NAMES,
  defaultCharacterFor,
  type CharacterId,
} from '@chaos-party/protocol/characters';
