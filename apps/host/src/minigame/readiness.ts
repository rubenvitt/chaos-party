/**
 * Bereitschaft in der Minispiel-Anleitung (CHAOS-214): Der Server wartet, bis alle verbundenen
 * Spieler auf dem Handy „Bereit!“ gedrückt haben (`view.minigame.ready`), frühestens nach der
 * Mindestzeit, spätestens nach der Sicherheitsfrist. `view.remainingMs` ist dabei erst die Zeit
 * bis zur Mindestzeit, dann bis zur Frist – kein Countdown, die Karte zeigt ihn nicht. Reine
 * Anzeige-Entscheidungen für die Anleitungskarte im Browser-Host und das Apple-TV-/Mac-Overlay
 * (`apps/apple-host/src/minigameView.ts`).
 */
import { PLAYER_SLOTS, type BoardView, type SlotNumber } from '@chaos-party/protocol';
import { aiTaglineOf, characterName } from './plan.ts';

/** Wartet die Anleitung auf „Bereit“ (CHAOS-214)? Dann gibt es keinen Countdown. */
export function waitsForReady(view: BoardView | null): boolean {
  return view?.gamePhase === 'minigame-intro' && view.minigame?.ready !== undefined;
}

/** Überschrift über den Bereitschafts-Chips. */
export const READY_HEADLINE = 'Alle bereit? Drückt „Bereit!“ auf dem Handy';

export type ReadinessState = 'ready' | 'waiting' | 'disconnected';

export interface ReadinessEntry {
  readonly slot: SlotNumber;
  readonly name: string;
  /** Anzeigename der Figur („Wusel“). */
  readonly character: string;
  /** KI-Abzeichen („KI · Saboteur“, CHAOS-182) oder `null` bei Menschen. */
  readonly ai: string | null;
  readonly color: string;
  readonly symbol: string;
  /** Hat „Bereit!“ gedrückt. */
  readonly ready: boolean;
  readonly connected: boolean;
  /** Getrennt geht vor (zählt beim Server als bereit), dann bereit, sonst wartend. */
  readonly state: ReadinessState;
  /** „Bereit“, „Drückt Bereit …“ bzw. „getrennt“. */
  readonly text: string;
}

export interface Readiness {
  readonly headline: string;
  readonly players: readonly ReadinessEntry[];
}

const STATE_TEXT: Record<ReadinessState, string> = {
  ready: 'Bereit',
  waiting: 'Drückt Bereit …',
  disconnected: 'getrennt',
};

/**
 * Bereitschaft der Anleitung oder `null`, wenn sie nicht darauf wartet (kein `ready` im Stand:
 * feste Anleitungszeit, lokaler Ablauf, ältere Server) oder außerhalb von `minigame-intro`.
 */
export function introReadiness(view: BoardView): Readiness | null {
  const ready = view.minigame?.ready;
  if (view.gamePhase !== 'minigame-intro' || ready === undefined) return null;
  const players = [...view.players]
    .sort((a, b) => a.slot - b.slot)
    .map((player): ReadinessEntry => {
      const isReady = ready.includes(player.slot);
      const state: ReadinessState = !player.connected
        ? 'disconnected'
        : isReady
          ? 'ready'
          : 'waiting';
      return {
        slot: player.slot,
        name: player.name,
        character: characterName(view, player.slot),
        ai: aiTaglineOf(view, player.slot),
        color: PLAYER_SLOTS[player.slot].color,
        symbol: PLAYER_SLOTS[player.slot].symbol,
        ready: isReady,
        connected: player.connected,
        state,
        text: STATE_TEXT[state],
      };
    });
  return { headline: READY_HEADLINE, players };
}

/**
 * Fortschritt für den Klang (CHAOS-214): verbundene Spieler, die „Bereit!“ gedrückt haben, von
 * allen verbundenen. Jedes neue „Bereit“ tickt, das letzte etwas höher; ein Verbindungsverlust
 * tickt nicht. `null`, wenn die Anleitung nicht wartet.
 */
export function readyProgress(view: BoardView | null): { done: number; total: number } | null {
  const ready = view?.minigame?.ready;
  if (!view || !waitsForReady(view) || ready === undefined) return null;
  const connected = view.players.filter((player) => player.connected);
  return {
    done: connected.filter((player) => ready.includes(player.slot)).length,
    total: connected.length,
  };
}
