/**
 * KI-Spieler in Minispielen (CHAOS-180, ADR-020 §3/§4/§8) – reiner Teil des Vertrags.
 *
 * Ein Minispiel, das in die Rotation darf, liefert über `Minigame.createBot` einen Bot je
 * KI-Platz. Die Laufzeit (`createMinigameRunner`, Option `bots`) ruft ihn in jedem festen
 * Schritt vor `update` auf und schickt seine Eingaben durch **denselben Eingang** wie
 * Controller-Eingaben (`input`: nur laufend, nur Teilnehmer, Achsen begrenzt, kein doppeltes
 * `press`). Stick-Eingaben drosselt sie auf die Rate eines Controllers (`BOT_MOVE_STEPS`).
 *
 * Regeln für Bots:
 * - **Nur Beobachtbares:** Der Bot liest, was ein Mensch am Bildschirm sieht (Positionen,
 *   sichtbare Warnungen, Punkte). Keine künftigen Zufallswerte, keine versteckten Zeitpunkte.
 * - **Stärke** ist eine Zahl `s` von 0 (leicht) bis 1 (schwer); jedes Spiel interpoliert seine
 *   Parameter (Reaktionszeit, Zielfehler, Fehlerrate, Vorausschau) zwischen benannten
 *   Eckwerten. So braucht die dynamische Stärke (CHAOS-187) keine eigene Bot-Logik.
 * - **Nie unfehlbar:** Auch `s = 1` hat Reaktionszeit, Zielrauschen und Aussetzer.
 * - **Zufall** nur aus `options.rng` (eigener Strom je Platz, `botSeed`); `ctx.rng` des
 *   Minispiels bleibt unberührt, damit KI-Entscheidungen den Spielablauf nicht verschieben.
 */
import type { MinigameInput, Slot } from './info.ts';
import type { MinigameRng } from './rng.ts';

/** Feste Stufen in der Lobby (ADR-020 §4); „dynamisch“ gleitet zwischen ihnen (CHAOS-187). */
export const BOT_LEVELS = ['leicht', 'mittel', 'schwer'] as const;
export type BotLevel = (typeof BOT_LEVELS)[number];

/** Stärke `s` je Stufe. */
export const BOT_LEVEL_STRENGTH: Readonly<Record<BotLevel, number>> = {
  leicht: 0,
  mittel: 0.5,
  schwer: 1,
};

/** Stick-Eingaben eines Bots höchstens alle so viele feste Schritte (60 Hz / 2 = 30 Hz wie `moveSender`). */
export const BOT_MOVE_STEPS = 2;

/** Stärke auf [0, 1] begrenzen; Ungültiges zählt als „mittel“. */
export function clampStrength(strength: number): number {
  if (!Number.isFinite(strength)) return BOT_LEVEL_STRENGTH.mittel;
  return Math.max(0, Math.min(1, strength));
}

/** Wert zwischen den Eckwerten für leicht (`s = 0`) und schwer (`s = 1`). */
export function lerpStrength(leicht: number, schwer: number, strength: number): number {
  const s = clampStrength(strength);
  return leicht + (schwer - leicht) * s;
}

/**
 * Seed des Bot-Zufalls für einen Platz: aus Minispiel-Seed und Platz, getrennt vom Spielzufall
 * (ADR-020 §8). Gleicher Seed und Platz → gleicher Bot.
 */
export function botSeed(minigameSeed: number, slot: Slot): number {
  let h = (minigameSeed ^ 0x6b1d_a7c3) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  h = (h + Math.imul(slot, 0x9e37_79b9)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0x27d4eb2d) >>> 0;
  return (h ^ (h >>> 15)) >>> 0;
}

/** Was ein Minispiel zum Erzeugen eines Bots bekommt. */
export interface MinigameBotOptions {
  readonly slot: Slot;
  /** 0 = leicht … 1 = schwer (schon begrenzt). */
  readonly strength: number;
  /** Eigener Zufallsstrom des Bots (`botSeed`). */
  readonly rng: MinigameRng;
}

/** Ein laufender Bot. */
export interface MinigameBotDriver {
  readonly slot: Slot;
  /**
   * Ein fester Schritt: Eingaben, die der Bot jetzt geben will (leer = nichts tun). Die Laufzeit
   * ruft das nur, solange das Spiel läuft, und prüft jede Eingabe wie eine vom Controller.
   * Ein Knopfdruck ist `press` und danach `release` (gern im selben Schritt).
   */
  tick(): readonly MinigameInput[];
}

/** Ein KI-Platz für die Laufzeit. */
export interface MinigameBotSeat {
  readonly slot: Slot;
  /** 0 = leicht … 1 = schwer; siehe `BOT_LEVEL_STRENGTH`. */
  readonly strength: number;
}

/** Knopfdruck als Eingabefolge (drücken und loslassen). */
export function tap(button: 'a' | 'b'): MinigameInput[] {
  return [
    { type: 'press', button },
    { type: 'release', button },
  ];
}
