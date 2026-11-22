/**
 * Welche Client-Nachrichten in welcher Phase erlaubt sind. Der Server prüft
 * das nach dem Schema; Verstöße beantwortet er mit `out-of-phase`.
 */
import type { ClientMessageType, InputIntentType, Phase } from './types.ts';

const ALLOWED: Readonly<Record<Phase, ReadonlySet<ClientMessageType>>> = {
  lobby: new Set<ClientMessageType>([
    'join',
    'reconnect',
    'ready',
    'heartbeat',
    'host-hello',
    'host-ready',
    'start',
    // v4 (CHAOS-36): Figurenwahl (Controller) und Rundenzahl (Host).
    'pick-character',
    'configure',
    // v4-Nachtrag (CHAOS-179): KI-Plätze verwalten (nur Spielleitung, prüft die Session).
    'ai-seat',
  ]),
  play: new Set<ClientMessageType>([
    'reconnect',
    'move',
    'press',
    'release',
    'gesture',
    'reaction',
    'heartbeat',
    'host-hello',
    'host-ready',
  ]),
  // Eingaben nur, wenn der Kontext sie anbietet (Minispiel läuft); prüft die Session.
  board: new Set<ClientMessageType>([
    'reconnect',
    'choose',
    'move',
    'press',
    'release',
    'heartbeat',
    'host-hello',
    'host-ready',
    'minigame-result',
    // v4-Nachtrag (CHAOS-231): Hinweis des laufenden Abschnitts (prüft die Session).
    'minigame-cue',
    // v4-Nachtrag (CHAOS-87): Daumen nach dem Minispiel (nur in der Ergebnisanzeige, prüft die Session).
    'rate',
    // v4-Nachtrag (CHAOS-214): „Bereit“ in der Minispiel-Anleitung (prüft die Session).
    'ready',
    // v4 (CHAOS-36/37): Pause, vorzeitiges Ende, Revanche (nur in `game-results`, prüft die Session).
    'pause',
    'resume',
    'end-game',
    'rematch',
  ]),
};

/** `true`, wenn eine Nachricht dieses Typs in der Phase angenommen werden darf. */
export function isIntentAllowed(phase: Phase, type: ClientMessageType): boolean {
  return ALLOWED[phase].has(type);
}

/** Spieleingaben, die der Server an den Host weiterleitet (`input`). */
export const INPUT_INTENT_TYPES: readonly InputIntentType[] = [
  'move',
  'press',
  'release',
  'gesture',
  'reaction',
];

const INPUT_INTENTS: ReadonlySet<string> = new Set(INPUT_INTENT_TYPES);

export function isInputIntentType(type: string): type is InputIntentType {
  return INPUT_INTENTS.has(type);
}
