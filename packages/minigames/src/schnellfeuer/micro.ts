/**
 * Vertrag der Mikro-Spiele (rein, CHAOS-90, README §7 Nr. 3): 5–8 s, ein Bildwort statt
 * Anleitung, eigener Vorrat. Ein Mikro-Spiel ist **kein** Minispiel-Modul: Es läuft nur als
 * Glied der Schnellfeuer-Kette (`chain.ts`), die ihre Ergebnisse zu einem Minispiel-Ergebnis
 * zusammenzählt. Darum zählt es nicht zu den ~200 vollen Minispielen.
 */
import type { BotAction, BotProfile } from '@chaos-party/minigame-kit';
import type {
  MinigameControls,
  MinigameRng,
  ResultCheck,
  Slot,
  SlotScore,
} from '@chaos-party/minigame-sdk';

/** Grenzen eines Mikro-Spiels (Bildwort statt Anleitung). */
export const MICRO_LIMITS = {
  minDurationMs: 5_000,
  maxDurationMs: 8_000,
  /** Das Bildwort: ein Wort in Großbuchstaben, mit Ausrufezeichen. */
  word: 12,
  /** Piktogramm: ein Emoji (höchstens ein paar UTF-16-Einheiten). */
  icon: 4,
  title: 24,
} as const;

export interface MicroInfo {
  /** Kennung in der Kette (Kleinbuchstaben, 3–16 Zeichen). */
  readonly id: string;
  /** Skizze aus `docs/minigames/katalog.md` (MG-191 … MG-200). */
  readonly sketch: string;
  /** Name für Höhepunkte und Galerie (≤ 24 Zeichen). */
  readonly title: string;
  /** Bildwort, groß am Host (≤ 12 Zeichen), z. B. „PUSTEN!“. */
  readonly word: string;
  /** Piktogramm vor dem Bildwort. */
  readonly icon: string;
  readonly durationMs: number;
  /** Was das Mikro-Spiel braucht; die Kette bietet die Vereinigung an. */
  readonly controls: MinigameControls;
}

/** Laufendes Mikro-Spiel (rein, feste Schritte wie jedes Minispiel). */
export interface MicroGame {
  readonly info: MicroInfo;
  readonly slots: readonly Slot[];
  /** Vergangene Spielzeit in s. */
  readonly time: number;
  /** Alle fertig oder Zeit um. */
  readonly finished: boolean;
  stick(slot: Slot, x: number, y: number): void;
  press(slot: Slot, button: 'a' | 'b'): void;
  step(dt: number): void;
  /** Punkte je Slot, mehr ist besser (daraus wird der Platz im Mikro-Spiel). */
  scores(): SlotScore[];
  /** Kurzer Zustand für den HUD (≤ 16 Zeichen), z. B. „zu früh!“. */
  status(slot: Slot): string | undefined;
}

export interface MicroBot {
  act(game: MicroGame): BotAction | null;
}

/** Ein Eintrag im Mikro-Vorrat: Steckbrief, Logik und Bot. */
export interface MicroDefinition<G extends MicroGame = MicroGame> {
  readonly info: MicroInfo;
  create(slots: readonly Slot[], rng: MinigameRng): G;
  bot(slot: Slot, profile: BotProfile, rng: MinigameRng): MicroBot;
}

const MICRO_ID = /^[a-z0-9-]{3,16}$/;

/** Prüft den Mikro-Vertrag (Vertragstest des Vorrats). */
export function checkMicroInfo(info: MicroInfo): ResultCheck {
  const fail = (reason: string): ResultCheck => ({ ok: false, reason });
  if (!MICRO_ID.test(info.id)) return fail('ID ungültig');
  if (!/^MG-(19[1-9]|200)$/.test(info.sketch)) return fail('Skizze muss MG-191 … MG-200 sein');
  if (info.title.length === 0 || info.title.length > MICRO_LIMITS.title) return fail('Titel');
  if (!/^[A-ZÄÖÜ]+!$/.test(info.word) || info.word.length > MICRO_LIMITS.word) {
    return fail('Bildwort: ein Wort in Großbuchstaben mit „!“');
  }
  if (info.icon.length === 0 || info.icon.length > MICRO_LIMITS.icon) return fail('Piktogramm');
  if (
    !Number.isInteger(info.durationMs) ||
    info.durationMs < MICRO_LIMITS.minDurationMs ||
    info.durationMs > MICRO_LIMITS.maxDurationMs
  ) {
    return fail('Spielzeit 5–8 s');
  }
  const { joystick, a, b } = info.controls;
  if (joystick === null && a === null && b === null) return fail('Keine Bedienung');
  return { ok: true };
}

/** Ein Slot-Feld je Teilnehmer mit Startwert (kleine Hilfe für die Mikro-Logiken). */
export function perSlot<T>(slots: readonly Slot[], init: (slot: Slot) => T): Map<Slot, T> {
  return new Map(slots.map((slot) => [slot, init(slot)]));
}

/** Zeit-Toleranz für aufsummierte 1/60-s-Schritte. */
export const EPS = 1e-6;
