import {
  defaultCharacterFor,
  PLAYER_SLOTS as SLOT_STYLES,
  type AiStrength,
  type CharacterId,
  type LobbyPlayer,
} from '@chaos-party/protocol';
import { PLAYER_SLOTS, type PlayerSlot, type ScenePlayer } from './scene/types.ts';

/** Spieler, wie HUD und Lobby ihn anzeigen: Szenendaten plus Symbol und Bereitschaft. */
export interface HostPlayer extends ScenePlayer {
  /** Farbunabhängige Kennung aus dem Protokoll (●, ▲, ■, ★). */
  readonly symbol: string;
  readonly ready: boolean;
  /** Gewählte Figur (v4, CHAOS-36) oder `null` = wählt noch. */
  readonly character: CharacterId | null;
  /** KI-Platz (CHAOS-182, ADR-020): fehlt bei Menschen. */
  readonly kind?: 'ai' | undefined;
  /** Stärke, nur bei KI. */
  readonly strength?: AiStrength | undefined;
}

/** Symbol eines Slots (Farben und Bezeichnungen kommen aus `@chaos-party/protocol`). */
export function slotSymbol(slot: PlayerSlot): string {
  return SLOT_STYLES[slot].symbol;
}

/** Lokale Demo-Spieler für die ersten `count` Slots (`?local=1`, Tastatur). */
export function createLocalPlayers(count: number): HostPlayer[] {
  return PLAYER_SLOTS.slice(0, Math.min(4, Math.max(0, count))).map((slot) => ({
    slot,
    color: SLOT_STYLES[slot].color,
    label: SLOT_STYLES[slot].label,
    symbol: SLOT_STYLES[slot].symbol,
    connected: true,
    ready: true,
    character: defaultCharacterFor(slot),
  }));
}

/**
 * Spieler aus dem `lobby`-Schnappschuss des Servers: nur beigetretene Slots,
 * Farbe und Bezeichnung so, wie der Server sie vergeben hat. Getrennte Spieler
 * bleiben sichtbar (halbtransparent mit „!“, ohne Eingaben), bis sie zurückkommen oder
 * der Server ihren Platz in der Lobby nach der Schonfrist freigibt (CHAOS-12).
 */
export function playersFromLobby(players: readonly LobbyPlayer[]): HostPlayer[] {
  return [...players]
    .sort((a, b) => a.slot - b.slot)
    .map((p) => ({
      slot: p.slot,
      color: p.color,
      label: p.label,
      symbol: slotSymbol(p.slot),
      connected: p.connected,
      ready: p.ready,
      character: p.character,
      ...(p.kind === 'ai' ? { kind: 'ai' as const, strength: p.strength ?? 'mittel' } : {}),
    }));
}
