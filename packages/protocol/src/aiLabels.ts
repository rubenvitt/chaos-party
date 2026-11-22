/**
 * Anzeige der KI-Plätze (CHAOS-182, ADR-020 §7): ein Satz Texte für PC-Host, Apple-Host und
 * Controller, damit „KI“, Stärke und Spielstil überall gleich heißen.
 *
 * Das KI-Zeichen ist ein Abzeichen mit dem Text `KI` (Creme `#f6efe2` auf Tinte `#3b3f58`,
 * `docs/art-direction.md`), kein Emoji. Es steht immer neben dem Slot-Symbol, nie statt seiner.
 */
import { AI_STRENGTHS } from './schemas.ts';
import type { AiPersonality, AiStrength } from './types.ts';

/** Text des KI-Abzeichens. */
export const AI_BADGE = 'KI';

/** Anzeigenamen der Stärken in Lobby-Reihenfolge. */
export const AI_STRENGTH_NAMES: Readonly<Record<AiStrength, string>> = {
  leicht: 'Leicht',
  mittel: 'Mittel',
  schwer: 'Schwer',
  dynamisch: 'Dynamisch',
};

/** Ein Satz je Stärke für Tooltip und Vorlesen. */
export const AI_STRENGTH_HINTS: Readonly<Record<AiStrength, string>> = {
  leicht: 'macht öfter Fehler und reagiert langsam',
  mittel: 'spielt etwa wie ein durchschnittlicher Mensch',
  schwer: 'nutzt Items gezielt und reagiert schnell',
  dynamisch: 'passt sich nach jeder Runde an euren Spielstand an',
};

/** Anzeigenamen der Spielstile (CHAOS-186). */
export const AI_PERSONALITY_NAMES: Readonly<Record<AiPersonality, string>> = {
  saboteur: 'Saboteur',
  sammler: 'Sammler',
  draufgaenger: 'Draufgänger',
  fuchs: 'Fuchs',
};

/** Nächste Stärke im Wechselknopf: leicht → mittel → schwer → dynamisch → leicht. */
export function nextAiStrength(strength: AiStrength): AiStrength {
  const index = AI_STRENGTHS.indexOf(strength);
  return AI_STRENGTHS[(index + 1) % AI_STRENGTHS.length] ?? 'mittel';
}

/** Platz mit den optionalen KI-Feldern aus `LobbyPlayer` bzw. `BoardPlayer`. */
export interface AiSeatLike {
  readonly kind?: 'human' | 'ai' | undefined;
  readonly personality?: AiPersonality | undefined;
}

/** `true` bei einem KI-Platz. */
export function isAiSeat(seat: AiSeatLike | undefined): boolean {
  return seat?.kind === 'ai';
}

/**
 * Untertitel eines KI-Platzes: „KI“ bzw. ab dem Start mit Stil „KI · Saboteur“. `null` bei Menschen.
 */
export function aiTagline(seat: AiSeatLike | undefined): string | null {
  if (!isAiSeat(seat)) return null;
  const style = seat?.personality;
  return style === undefined ? AI_BADGE : `${AI_BADGE} · ${AI_PERSONALITY_NAMES[style]}`;
}

/**
 * Name mit KI-Kennzeichnung für Fließtext und Vorlesen: „Schraubi · KI · Saboteur“, bei Menschen
 * nur der Name.
 */
export function seatDisplayName(seat: AiSeatLike & { readonly name: string }): string {
  const tagline = aiTagline(seat);
  return tagline === null ? seat.name : `${seat.name} · ${tagline}`;
}
