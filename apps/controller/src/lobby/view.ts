/**
 * Lobby mit Charakterwahl am Controller (v4, CHAOS-36, ADR-015). Rein, ohne DOM: dieselbe
 * Ableitung nutzen iPhone (`CharacterLobby`), iPad-Zone (`ZoneBoard`) und die Zonen-Geometrie.
 *
 * Der Server entscheidet, was geht (`actions`: `ready`, `pick-character`) und welche Figuren
 * vergeben sind (`lobby.takenCharacters`). Der Controller zeigt nur: eigene Wahl hervorgehoben
 * (auch eine gerade gesendete, noch unbestätigte), vergebene Figuren ausgegraut – mit Farbe und
 * Symbol des Besitzers laut `lobby.takenBy` (geräteübergreifend, CHAOS-40). Fehlt `takenBy`
 * (älterer Server), hilft das eigene Gerät: Nachbarzonen eines geteilten iPads; sonst neutral.
 */
import {
  AI_BADGE,
  AI_STRENGTH_NAMES,
  CHARACTER_IDS,
  CHARACTER_NAMES,
  DEFAULT_AI_STRENGTH,
  nextAiStrength,
  type AiStrength,
  type CharacterId,
  type ControllerLobbyInfo,
  type SlotNumber,
} from '@chaos-party/protocol';
import type { SlotContext } from '../state/reducer.ts';

export type CharacterCardState = 'mine' | 'free' | 'taken';

export interface CharacterCard {
  readonly id: CharacterId;
  readonly name: string;
  readonly blurb: string;
  readonly state: CharacterCardState;
  /** Eigene Wahl ist gesendet, aber noch nicht vom Server bestätigt. */
  readonly pending: boolean;
  /** Besitzer einer vergebenen Figur (Server `takenBy` bzw. Nachbarzone), sonst `null`. */
  readonly ownerSlot: SlotNumber | null;
  /** Antippen wählt diese Figur (frei und Wählen erlaubt). */
  readonly selectable: boolean;
}

export interface LobbyView {
  readonly cards: readonly CharacterCard[];
  /** Eigene Figur (inklusive gesendeter Wahl) oder `null`. */
  readonly character: CharacterId | null;
  /** Server hat „bereit“ bestätigt (Layout `wait`). */
  readonly ready: boolean;
  /** „Bereit!“ wird angeboten. */
  readonly canReady: boolean;
  readonly rounds: number;
  /** „5 Runden“ */
  readonly roundsLabel: string;
  /**
   * Gewähltes Brett der nächsten Partie („Wackelwald“, „Zufallsbrett“, CHAOS-197) oder `null`
   * (älterer Server ohne `lobby.board`).
   */
  readonly boardName: string | null;
  /** Kurzer Hinweis unter der Auswahl. */
  readonly hint: string;
}

/** Figur eines anderen Platzes auf demselben Gerät (geteiltes iPad). */
export interface SiblingCharacter {
  readonly slot: SlotNumber;
  readonly character: CharacterId | null;
}

export const LOBBY_TITLE = 'Wähle deine Figur';
export const HINT_PICK = 'Tippe auf eine Figur.';
export const HINT_PICKED = 'Gute Wahl! Jetzt „Bereit!“ tippen.';
export const HINT_READY = 'Du bist bereit! Umwählen geht noch – dann noch mal „Bereit!“.';
export const TAKEN_LABEL = 'vergeben';
export const MINE_LABEL = 'Deine Figur';

export function roundsLabel(rounds: number): string {
  return rounds === 1 ? '1 Runde' : `${String(rounds)} Runden`;
}

/**
 * Lobby-Ansicht eines Slots oder `null`, wenn der Kontext keine Charakterwahl trägt
 * (älterer Server; dann zeigt der Controller nur „Bereit!“).
 */
export function describeLobby(
  context: SlotContext | undefined,
  pending: CharacterId | undefined,
  siblings: readonly SiblingCharacter[] = [],
): LobbyView | null {
  const lobby = context?.lobby;
  if (context?.phase !== 'lobby' || lobby === undefined) return null;
  const canPick = context.actions.includes('pick-character');
  const taken = new Set(lobby.takenCharacters);
  // Eine vorgemerkte Wahl, die inzwischen jemand anderes hat, zählt nicht mehr.
  const mine = pending !== undefined && !taken.has(pending) ? pending : lobby.character;
  const ready = context.layout === 'wait';
  const cards = CHARACTER_IDS.map((id): CharacterCard => {
    const state: CharacterCardState = id === mine ? 'mine' : taken.has(id) ? 'taken' : 'free';
    const owner =
      state !== 'taken'
        ? undefined
        : (lobby.takenBy?.find((entry) => entry.character === id) ??
          siblings.find((s) => s.character === id));
    return {
      id,
      name: CHARACTER_NAMES[id].name,
      blurb: CHARACTER_NAMES[id].blurb,
      state,
      pending: state === 'mine' && pending === id && lobby.character !== id,
      ownerSlot: owner?.slot ?? null,
      selectable: canPick && state === 'free',
    };
  });
  return {
    cards,
    character: mine,
    ready,
    canReady: context.actions.includes('ready'),
    rounds: lobby.rounds,
    roundsLabel: roundsLabel(lobby.rounds),
    boardName: lobby.board?.name ?? null,
    hint: ready ? HINT_READY : mine === null ? HINT_PICK : HINT_PICKED,
  };
}

// ---------------------------------------------------------------------------------------------
// Plätze und KI (CHAOS-182, ADR-020 §2)
// ---------------------------------------------------------------------------------------------

export type SeatChipKind = 'self' | 'human' | 'ai' | 'free';

/** Ein Platz in der Reihe „Mitspieler“ der Lobby. */
export interface SeatChip {
  readonly slot: SlotNumber;
  readonly kind: SeatChipKind;
  /** Stärke, nur bei KI. */
  readonly strength: AiStrength | null;
  /** Text im Chip: „Du“, „Mitspieler“, „KI · Mittel“, „+ KI“ bzw. „frei“. */
  readonly text: string;
  /**
   * Was ein Tippen bewirkt (nur Spielleitung): KI setzen (freier Platz) bzw. nächste Stärke (KI);
   * `null` = nichts. Die Nachricht ist `ai-seat { seat, strength }`.
   */
  readonly tap: AiStrength | null;
  /** Spielleitung darf diese KI entfernen (`ai-seat { strength: null }`). */
  readonly removable: boolean;
}

export interface SeatsView {
  /** Dieser Platz verwaltet KI-Plätze (Spielleitung). */
  readonly lead: boolean;
  readonly chips: readonly SeatChip[];
}

const SEAT_SLOTS: readonly SlotNumber[] = [1, 2, 3, 4];

/**
 * Reihe „Mitspieler“ aus `lobby.seats` und `lobby.lead` (v4-Nachtrag CHAOS-179). `null` bei einem
 * älteren Server ohne `seats`. Nur die Spielleitung bekommt Knöpfe; alle anderen sehen nur, wer KI
 * ist. Ohne KI und ohne Spielleitung bleibt die Reihe weg (Platz sparen).
 */
export function describeSeats(
  lobby: Pick<ControllerLobbyInfo, 'seats' | 'lead'> | undefined,
  ownSlot: SlotNumber,
): SeatsView | null {
  const seats = lobby?.seats;
  if (seats === undefined) return null;
  const lead = lobby?.lead === true;
  if (!lead && !seats.some((seat) => seat.kind === 'ai')) return null;
  const chips = SEAT_SLOTS.map((slot): SeatChip => {
    const seat = seats.find((entry) => entry.slot === slot);
    if (seat === undefined) {
      return {
        slot,
        kind: 'free',
        strength: null,
        text: lead ? `+ ${AI_BADGE}` : 'frei',
        tap: lead ? DEFAULT_AI_STRENGTH : null,
        removable: false,
      };
    }
    if (seat.kind === 'ai') {
      const strength = seat.strength ?? DEFAULT_AI_STRENGTH;
      return {
        slot,
        kind: 'ai',
        strength,
        text: `${AI_BADGE} · ${AI_STRENGTH_NAMES[strength]}`,
        tap: lead ? nextAiStrength(strength) : null,
        removable: lead,
      };
    }
    const self = slot === ownSlot;
    return {
      slot,
      kind: self ? 'self' : 'human',
      strength: null,
      text: self ? 'Du' : 'Mitspieler',
      tap: null,
      removable: false,
    };
  });
  return { lead, chips };
}
