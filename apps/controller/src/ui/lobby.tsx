/**
 * Lobby mit Charakterwahl (v4, CHAOS-36): Figurenkarten, Rundenzahl, Brett (CHAOS-197), „Bereit!“.
 * `CharacterFace` und `LobbyHead` teilen sich iPhone (`CharacterLobby`) und iPad-Zone
 * (`ZoneBoard`, dort absolut an den Rechtecken der Zonen-Geometrie).
 */
import { useState, type CSSProperties } from 'react';
import { PLAYER_SLOTS, type CharacterId, type SlotNumber } from '@chaos-party/protocol';
import { LOBBY_TITLE, type CharacterCard, type LobbyView, type SeatsView } from '../lobby/view.ts';
import type { SlotIntent } from '../net/client.ts';
import { CharacterPortrait } from './CharacterPortrait.tsx';
import { cardData, cardTag, ownerStyle } from './lobbyCard.ts';

/** Inhalt einer Figurenkarte: Porträt im Lichtfenster, Name, ggf. Hinweis. */
export function CharacterFace({ card }: { card: CharacterCard }) {
  const tag = cardTag(card);
  return (
    <>
      <span className="character-window">
        <CharacterPortrait character={card.id} className="window-portrait" decorative />
        {card.ownerSlot !== null && (
          <span className="character-owner player-symbol" aria-hidden="true">
            {PLAYER_SLOTS[card.ownerSlot].symbol}
          </span>
        )}
        {card.state === 'mine' && (
          <span className="character-check" aria-hidden="true">
            ✓
          </span>
        )}
      </span>
      <span className="character-name ui-text">{card.name}</span>
      {tag !== null && <span className="character-tag ui-text">{tag}</span>}
    </>
  );
}

/** Titel, Rundenzahl und Brett (CHAOS-197) über der Auswahl. */
export function LobbyHead({ view }: { view: LobbyView }) {
  return (
    <div className="lobby-head">
      <h2 className="lobby-title ui-text">{LOBBY_TITLE}</h2>
      <span className="lobby-rounds ui-text" data-testid="lobby-rounds" data-rounds={view.rounds}>
        {view.roundsLabel}
      </span>
      {view.boardName !== null && (
        <span className="lobby-rounds lobby-board ui-text" data-testid="lobby-board">
          {view.boardName}
        </span>
      )}
    </div>
  );
}

/** Bestätigung „bereit“ (Server-Layout `wait`). */
export function ReadyBadge({ compact = false }: { compact?: boolean }) {
  return (
    <div className="lobby-ready-done" data-testid="ready-done" data-compact={compact}>
      <span className="ready-check" aria-hidden="true">
        ✓
      </span>
      <span className="ui-text">Bereit!</span>
    </div>
  );
}

/**
 * Reihe „Mitspieler“ (CHAOS-182, ADR-020 §2): wer Mensch ist, wer KI (mit Stärke), welche Plätze
 * frei sind. Die Spielleitung tippt „+ KI“ auf einem freien Platz, auf eine KI für die nächste
 * Stärke und „✕“ zum Entfernen; der Server prüft Spielleitung und Phase.
 */
export function LobbySeats({
  slot,
  seats,
  send,
}: {
  slot: SlotNumber;
  seats: SeatsView;
  send: (intent: SlotIntent) => void;
}) {
  return (
    <div className="lobby-seats" data-testid="lobby-seats" data-lead={seats.lead}>
      <ul className="lobby-seat-list" aria-label="Mitspieler">
        {seats.chips.map((chip) => {
          const label = (
            <>
              <span className="player-symbol" aria-hidden="true">
                {PLAYER_SLOTS[chip.slot].symbol}
              </span>
              <span className="ui-text">{chip.text}</span>
            </>
          );
          const tap = chip.tap;
          return (
            <li
              key={chip.slot}
              className="lobby-seat"
              data-testid={`lobby-seat-${String(chip.slot)}`}
              data-kind={chip.kind}
              data-strength={chip.strength ?? ''}
              style={{ '--seat-color': PLAYER_SLOTS[chip.slot].color } as CSSProperties}
            >
              {tap === null ? (
                <span className="lobby-seat-body">{label}</span>
              ) : (
                <button
                  type="button"
                  className="lobby-seat-body lobby-seat-button"
                  data-testid={`lobby-seat-tap-${String(chip.slot)}`}
                  aria-label={
                    chip.kind === 'free'
                      ? `KI auf Platz ${PLAYER_SLOTS[chip.slot].label} setzen`
                      : `${chip.text}, tippen für nächste Stärke`
                  }
                  onClick={() => {
                    send({ type: 'ai-seat', slot, seat: chip.slot, strength: tap });
                  }}
                >
                  {label}
                </button>
              )}
              {chip.removable && (
                <button
                  type="button"
                  className="lobby-seat-remove"
                  data-testid={`lobby-seat-remove-${String(chip.slot)}`}
                  aria-label={`KI auf Platz ${PLAYER_SLOTS[chip.slot].label} entfernen`}
                  onClick={() => {
                    send({ type: 'ai-seat', slot, seat: chip.slot, strength: null });
                  }}
                >
                  ✕
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

interface CharacterLobbyProps {
  slot: SlotNumber;
  view: LobbyView;
  /** Reihe „Mitspieler“ mit KI-Plätzen (CHAOS-182) oder `null`. */
  seats?: SeatsView | null;
  /** Kennung des Kontexts: Ein neuer Kontext setzt „Bereit gesendet“ zurück. */
  contextKey: string;
  send: (intent: SlotIntent) => void;
}

/**
 * iPhone: Auswahl als 2×2-Raster großer Karten (hoch) bzw. links neben „Bereit!“ (quer).
 * Antippen einer freien Figur sendet `pick-character`; die Wahl leuchtet sofort (vorgemerkt)
 * und wird mit dem nächsten Kontext bestätigt oder – bei `character-taken` – zurückgenommen.
 */
export function CharacterLobby({
  slot,
  view,
  seats = null,
  contextKey,
  send,
}: CharacterLobbyProps) {
  const pick = (character: CharacterId) => {
    send({ type: 'pick-character', slot, character });
  };
  return (
    <div
      className="panel lobby-panel character-lobby"
      data-testid="lobby-panel"
      data-ready={view.ready ? 'true' : 'false'}
      data-character={view.character ?? ''}
    >
      <LobbyHead view={view} />
      {seats !== null && <LobbySeats slot={slot} seats={seats} send={send} />}
      <div className="character-grid" role="group" aria-label={LOBBY_TITLE}>
        {view.cards.map((card) => (
          <button
            key={card.id}
            type="button"
            className="character-card"
            {...cardData(card)}
            aria-pressed={card.state === 'mine'}
            aria-disabled={!card.selectable}
            style={ownerStyle(card)}
            onClick={() => {
              if (card.selectable) pick(card.id);
            }}
          >
            <CharacterFace card={card} />
          </button>
        ))}
      </div>
      <div className="lobby-foot">
        <p className="lobby-hint ui-text" data-testid="lobby-hint">
          {view.hint}
        </p>
        {view.ready ? (
          <ReadyBadge />
        ) : (
          view.canReady && (
            <ReadyAction
              key={contextKey}
              onReady={() => {
                send({ type: 'ready', slot });
              }}
            />
          )
        )}
      </div>
    </div>
  );
}

/** „Bereit!“-Knopf; nach dem Tippen bis zum nächsten Kontext ausgeblendet. */
function ReadyAction({ onReady }: { onReady: () => void }) {
  const [sent, setSent] = useState(false);
  if (sent) {
    return (
      <p className="lobby-sending ui-text" data-testid="ready-sending" role="status">
        Gesendet …
      </p>
    );
  }
  return (
    <button
      type="button"
      className="ready-button lobby-ready"
      data-testid="ready-button"
      onClick={() => {
        setSent(true);
        onReady();
      }}
    >
      <span className="ui-text">Bereit!</span>
    </button>
  );
}
