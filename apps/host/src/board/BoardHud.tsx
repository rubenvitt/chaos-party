/**
 * React-HUD der Brettphase (CHAOS-20): Spielerleiste, Runde, „Blau ist dran!“, Status zur
 * offenen Entscheidung mit Countdown, Ereignis-Ticker, Minispiel-Platzhalter. Den Endstand
 * zeigt seit M4 das Finale (`finale/Finale.tsx`, CHAOS-37).
 * Echte Minispiele (M3) zeigt nicht dieses Overlay, sondern die Minispiel-Bühne
 * (`minigame/MinigameScreen.tsx`); das Overlay bleibt für Platzhalter und unbekannte IDs.
 * Liest nur den `HudSnapshot` der Regie; steuert nichts. Große Schrift für den Sofa-Abstand.
 */
import {
  aiTagline,
  PLAYER_SLOTS,
  type BoardPlayer,
  type BoardView,
  type SlotNumber,
} from '@chaos-party/protocol';
import type { CSSProperties } from 'react';
import { waitsForReady } from '../minigame/readiness.ts';
import { lookMood } from '../nature/settings.ts';
import type { ConnectionStatus } from '../net/hostConnection.ts';
import type { HudMessage, HudSnapshot, MinigameSummary } from './director.ts';
import { CoinIcon, ItemIcon, TrophyIcon } from './icons.tsx';
import {
  bannerText,
  countdownText,
  ITEM_NAMES,
  minigameOverlayText,
  playerName,
  promptDetail,
  promptStatus,
  roundText,
  TAILWIND_LEAD,
  tailwindAmount,
  tailwindRows,
} from './texts.ts';

const CONNECTION_TEXT: Record<ConnectionStatus, string> = {
  connecting: 'Server: verbinde …',
  connected: 'Server: verbunden',
  disconnected: 'Server: getrennt – verbinde neu …',
  'host-taken': 'Anderes Spielfenster ist schon verbunden – warte …',
};

interface BoardHudProps {
  readonly hud: HudSnapshot;
  /** Name des Bretts („Wackelwald“). */
  readonly boardName: string;
  /** Verbindungsstatus zum Server; `null` im lokalen Modus. */
  readonly connection: ConnectionStatus | null;
}

function colorStyle(slot: SlotNumber): CSSProperties {
  return { '--player-color': PLAYER_SLOTS[slot].color } as CSSProperties;
}

function PlayerDot({ slot }: { readonly slot: SlotNumber }) {
  return (
    <span className="player-dot" aria-hidden="true" style={colorStyle(slot)}>
      <span className="player-symbol">{PLAYER_SLOTS[slot].symbol}</span>
    </span>
  );
}

function PlayerCard({
  player,
  active,
}: {
  readonly player: BoardPlayer;
  readonly active: boolean;
}) {
  return (
    <li
      className="board-player"
      data-testid={`board-player-${player.slot}`}
      data-active={active}
      data-connected={player.connected}
      style={colorStyle(player.slot)}
    >
      {active && <span className="board-player-turn">am Zug</span>}
      <div className="board-player-head">
        <PlayerDot slot={player.slot} />
        <span className="board-player-name">{player.name}</span>
      </div>
      {player.kind === 'ai' && (
        <span className="ai-badge board-player-ai" data-testid={`board-ai-${player.slot}`}>
          {aiTagline(player)}
        </span>
      )}
      <div className="board-player-stats">
        <span className="board-stat board-stat--trophies" title="Trophäen">
          <TrophyIcon size={26} />
          <span data-testid={`board-trophies-${player.slot}`}>{player.trophies}</span>
        </span>
        <span className="board-stat board-stat--coins" title="Münzen">
          <CoinIcon size={26} />
          <span data-testid={`board-coins-${player.slot}`}>{player.coins}</span>
        </span>
      </div>
      <ul className="board-items" aria-label="Items" data-testid={`board-items-${player.slot}`}>
        {player.items.map((item, i) => (
          <li key={`${item}-${i}`} className="board-item" data-item={item} title={ITEM_NAMES[item]}>
            <ItemIcon item={item} size={22} />
            <span className="board-item-name">{ITEM_NAMES[item]}</span>
          </li>
        ))}
        {player.items.length === 0 && <li className="board-item board-item--empty">keine Items</li>}
      </ul>
      {!player.connected && <span className="board-player-warn">⚠ getrennt</span>}
    </li>
  );
}

function Messages({ messages }: { readonly messages: readonly HudMessage[] }) {
  return (
    <ol className="board-messages" data-testid="board-messages" aria-live="polite">
      {messages.map((m) => (
        <li
          key={m.id}
          className="board-message"
          data-tone={m.tone}
          style={m.slot === null ? undefined : colorStyle(m.slot)}
        >
          {m.slot !== null && <PlayerDot slot={m.slot} />}
          <span>{m.text}</span>
        </li>
      ))}
    </ol>
  );
}

function StatusLine({
  view,
  seconds,
}: {
  readonly view: BoardView;
  readonly seconds: number | null;
}) {
  const status = promptStatus(view);
  if (!status || !view.prompt) return null;
  const detail = promptDetail(view);
  const showCountdown = view.prompt.kind === 'reaction' && seconds !== null;
  return (
    <div
      className="board-status"
      data-testid="board-status"
      data-kind={view.prompt.kind}
      style={colorStyle(view.prompt.slot)}
    >
      <PlayerDot slot={view.prompt.slot} />
      <span className="board-status-text">{status}</span>
      {detail && <span className="board-status-detail">{detail}</span>}
      {showCountdown && (
        <span className="board-countdown" data-testid="board-countdown" data-seconds={seconds}>
          {countdownText(seconds)}
        </span>
      )}
    </div>
  );
}

function MinigameOverlay({
  view,
  minigame,
  seconds,
}: {
  readonly view: BoardView;
  readonly minigame: MinigameSummary | null;
  readonly seconds: number | null;
}) {
  if (view.gamePhase === 'minigame-intro' || view.gamePhase === 'minigame-play') {
    const text = minigameOverlayText(view);
    return (
      <div className="board-overlay" data-testid="board-minigame" data-phase={view.gamePhase}>
        <div className="board-overlay-card">
          <p className="board-overlay-kicker">Minispiel</p>
          <h2>{text.title}</h2>
          <p className="board-overlay-lead">{text.lead}</p>
          {/* CHAOS-214: Wartet die Anleitung auf „Bereit“, ist die Restzeit kein Countdown. */}
          {seconds !== null && !waitsForReady(view) && (
            <p className="board-overlay-timer">noch {seconds} s</p>
          )}
        </div>
      </div>
    );
  }
  if (view.gamePhase !== 'minigame-results') return null;
  const ranking = minigame?.ranking ?? [];
  // v4 (CHAOS-55): ausgezahlte Münzen aus dem Stand, sonst aus den Ereignissen der Regie.
  const viewRewards = view.minigame?.rewards ?? null;
  const coinsOf = (slot: SlotNumber): number | undefined =>
    viewRewards !== null
      ? (viewRewards.find((entry) => entry.slot === slot)?.coins ?? 0)
      : minigame?.rewards[slot];
  return (
    <div className="board-overlay" data-testid="board-minigame" data-phase={view.gamePhase}>
      <div className="board-overlay-card">
        <p className="board-overlay-kicker">Minispiel</p>
        <h2>Ergebnis</h2>
        <ol className="board-ranking">
          {ranking.map((slot, i) => (
            <li key={slot} className="board-ranking-row" style={colorStyle(slot)}>
              <span className="board-ranking-place">{i + 1}.</span>
              <PlayerDot slot={slot} />
              <span className="board-ranking-name">{playerName(view, slot)}</span>
              {coinsOf(slot) !== undefined && (
                <span className="board-ranking-value">+{coinsOf(slot)} Münzen</span>
              )}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

/**
 * Rückenwind-Ansage im Rundenende (CHAOS-125): Wer bei den Trophäen hinten liegt, bekommt
 * nach dem Minispiel Münzen. Steht mittig über dem Brett, damit die Münz-Popups an den
 * Figuren sichtbar bleiben.
 */
function TailwindCard({ view }: { readonly view: BoardView }) {
  const rows = tailwindRows(view);
  if (!rows) return null;
  return (
    <section className="board-tailwind" data-testid="board-tailwind" aria-live="polite">
      <p className="board-overlay-kicker">Aufholhilfe</p>
      <h2 className="board-tailwind-title">Rückenwind!</h2>
      <p className="board-tailwind-lead">{TAILWIND_LEAD}</p>
      <ul className="board-tailwind-rows">
        {rows.map((row) => (
          <li
            key={row.slot}
            className="board-tailwind-row"
            data-testid={`board-tailwind-${row.slot}`}
            style={colorStyle(row.slot)}
          >
            <PlayerDot slot={row.slot} />
            <span className="board-tailwind-name">{row.name}</span>
            <span className="board-tailwind-value">
              <CoinIcon size={28} />
              {tailwindAmount(row.coins)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** DOM-Overlay über dem Brett. `pointer-events: none` wie der Arena-HUD (C5). */
export function BoardHud({ hud, boardName, connection }: BoardHudProps) {
  const { view } = hud;
  const banner = bannerText(view);
  const players = view ? [...view.players].sort((a, b) => a.slot - b.slot) : [];
  // Lichtverlauf (CHAOS-63): In Dämmerung und Nacht steht der Titel hell auf dunklem Himmel.
  const { mood } = lookMood(
    typeof location === 'undefined' ? '' : location.search,
    view?.boardId ?? '',
    view ? { round: view.round, rounds: view.rounds } : null,
  );
  return (
    <div
      className="hud board-hud"
      data-testid="board-hud"
      data-game-phase={view?.gamePhase ?? 'none'}
      data-sky={mood.night ? 'dunkel' : 'hell'}
    >
      <header className="hud-top">
        <div className="hud-title">
          <h1>Chaos Party</h1>
          <p>
            {boardName} · <span data-testid="board-round">{roundText(view)}</span>
          </p>
        </div>
        {connection !== null && (
          <div className="hud-connection" data-testid="connection" data-status={connection}>
            <span className="hud-connection-dot" aria-hidden="true" />
            {CONNECTION_TEXT[connection]}
          </div>
        )}
      </header>

      <div className="board-center">
        {hud.notice && (
          <div
            key={hud.notice.id}
            className="board-notice"
            data-testid="board-notice"
            role="status"
            aria-live="polite"
          >
            <strong className="board-notice-title">{hud.notice.title}</strong>
            <span className="board-notice-detail">{hud.notice.detail}</span>
          </div>
        )}
        {banner && view?.activeSlot != null && (
          <div
            className="board-banner"
            data-testid="board-banner"
            style={colorStyle(view.activeSlot)}
          >
            {banner}
          </div>
        )}
        {view && <StatusLine view={view} seconds={hud.promptSeconds} />}
        {view && <TailwindCard view={view} />}
        {!view && <div className="hud-status">Warte auf das Spielbrett …</div>}
      </div>

      <Messages messages={hud.messages} />

      <ul className="board-players" aria-label="Spieler">
        {players.map((p) => (
          <PlayerCard key={p.slot} player={p} active={view?.activeSlot === p.slot} />
        ))}
      </ul>

      {view && <MinigameOverlay view={view} minigame={hud.minigame} seconds={hud.phaseSeconds} />}
    </div>
  );
}
