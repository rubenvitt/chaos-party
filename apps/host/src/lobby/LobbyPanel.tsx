import {
  MAX_PLAYERS,
  PLAYER_SLOTS,
  type LobbyMessage,
  type MinigameRating,
  type SlotNumber,
} from '@chaos-party/protocol';
import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import type { ConnectionStatus } from '../net/hostConnection.ts';
import type { HostPlayer } from '../players.ts';
import { CharacterPortrait } from './CharacterPortrait.tsx';
import { joinUrlForDevice, type JoinDevice } from './joinLink.ts';
import {
  boardOptions,
  cardCharacter,
  chosenBoardName,
  minigamePrefs,
  minigameSummary,
  nextBoardId,
  roundOptions,
  roundsDuration,
  startState,
  toggleMinigame,
  type MinigamePrefs,
} from './lobbyState.ts';
import { galleryCountSummary } from './gallery.ts';
import { MinigameGallery } from './MinigameGallery.tsx';
import { QrCode } from './QrCode.tsx';

/** Export der Daumen-Stimmen am Server (CHAOS-87, `RATINGS_PATH` in `apps/server`). */
const RATINGS_EXPORT_HREF = '/ratings.json';

interface LobbyPanelProps {
  readonly lobby: LobbyMessage | null;
  readonly players: readonly HostPlayer[];
  readonly status: ConnectionStatus;
  readonly joinHintSeconds: number;
  readonly onStart: () => boolean;
  /** Rundenzahl gewählt (sendet `configure`). */
  readonly onRounds: (rounds: number) => void;
  /** „Mehr Zeit zum Reagieren“ umgeschaltet (sendet `configure`, CHAOS-124). */
  readonly onMoreReactionTime: (on: boolean) => void;
  /** Brett gewählt: Brett-ID oder `zufall` (sendet `configure`, CHAOS-197). */
  readonly onBoard: (board: string) => void;
  /** Daumen je Minispiel vom Server (CHAOS-87). */
  readonly ratings: readonly MinigameRating[];
  /** Übungsrunde aus der Galerie starten (sendet `start.practice`, CHAOS-87). */
  readonly onPractice: (minigameId: string) => boolean;
  /** Sperrliste/Favoriten der Minispiele geändert (sendet `configure`, CHAOS-85). */
  readonly onMinigames?: ((prefs: MinigamePrefs) => void) | undefined;
}

const ALL_SLOTS: readonly SlotNumber[] = [1, 2, 3, 4];

const DEVICE_OPTIONS: readonly { device: JoinDevice; label: string; seats: string }[] = [
  { device: 'phone', label: 'iPhone', seats: '1 Spieler' },
  { device: 'ipad', label: 'iPad', seats: '2 Spieler' },
];

/** Hostname eines Join-Links für die Adressauswahl (`[fd00::1]` bleibt geklammert). */
function hostLabel(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/**
 * Lobby am PC (CHAOS-11): QR-Code + Join-Code + Link, Spielerliste, Start-Knopf,
 * Hinweis bei ausbleibenden Controllern (Annahmen B1/B2) und Umschalten auf eine
 * andere LAN-Adresse, falls der Server mehrere kennt (ADR-007). Ein Umschalter
 * „iPhone / iPad“ zeigt für das geteilte iPad denselben Link mit `seats=2` (CHAOS-14).
 * Je Spieler eine Karte (CHAOS-36): Porträt und Name der gewählten Figur (`character`, bei
 * `null` „wählt noch …“ mit blassem Vorschlag), Slot-Farbe und -Symbol, Bereit-Status.
 * Dazu das Brett aus `lobby.settings.boards` plus „Zufall“ als Wechselknopf neben der Rundenwahl
 * (CHAOS-197, jeder Klick wählt das nächste und sendet `configure`, wie am Apple-Host; ohne
 * Bretter vom Server keine Auswahl), die Rundenzahl aus `lobby.settings.roundPresets` (sendet
 * `configure`), der Schalter
 * „Mehr Zeit zum Reagieren“ (Barrierefreiheit, CHAOS-124; zeigt den Server-Stand
 * `lobby.settings.moreReactionTime`), daneben der Knopf „Minispiele“ (CHAOS-228): öffnet die eine
 * Minispiel-Ansicht mit Üben, Daumen (CHAOS-87) sowie Favoriten und Sperrliste der Rotation
 * (CHAOS-85; Umschalter nur, wenn der Server `settings.minigames` schickt), und der Start.
 * Alles per Maus und Tastatur bedienbar (echte Knöpfe, sichtbarer Fokus).
 */
export function LobbyPanel({
  lobby,
  players,
  status,
  joinHintSeconds,
  onStart,
  onRounds,
  onMoreReactionTime,
  onBoard,
  ratings,
  onPractice,
  onMinigames,
}: LobbyPanelProps) {
  const [galleryOpen, setGalleryOpen] = useState(false);
  const closeGallery = useCallback(() => {
    setGalleryOpen(false);
  }, []);
  const urls = lobby?.joinUrl ? [lobby.joinUrl, ...(lobby.joinUrlAlternatives ?? [])] : [];
  const [chosenUrl, setChosenUrl] = useState<string | null>(null);
  const baseUrl = chosenUrl !== null && urls.includes(chosenUrl) ? chosenUrl : urls[0];
  const [device, setDevice] = useState<JoinDevice>('phone');
  const joinUrl = baseUrl === undefined ? undefined : joinUrlForDevice(baseUrl, device);

  const start = startState(players, status);
  const taken = new Set(players.map((p) => p.slot));
  const freeSlots = ALL_SLOTS.filter((slot) => !taken.has(slot));

  const [waitedLong, setWaitedLong] = useState(false);
  const waiting = status === 'connected' && players.length === 0;
  useEffect(() => {
    if (!waiting) return;
    const timer = setTimeout(() => {
      setWaitedLong(true);
    }, joinHintSeconds * 1000);
    return () => {
      clearTimeout(timer);
    };
  }, [waiting, joinHintSeconds]);
  const showJoinHelp = waiting && waitedLong;

  if (lobby === null) {
    return (
      <section className="lobby" aria-label="Lobby">
        <div className="lobby-card lobby-card--waiting">
          <h2>Verbinde mit dem Spiel-Server …</h2>
          <p>
            Läuft der Server? Im Projektordner <code>pnpm build &amp;&amp; pnpm start</code>{' '}
            ausführen und diese Seite unter <code>http://localhost:8787/host/</code> öffnen.
          </p>
        </div>
      </section>
    );
  }

  const options = roundOptions(lobby.settings);
  const boards = boardOptions(lobby.settings);
  const currentBoard = boards.find((option) => option.selected) ?? boards[0];
  const boardName = chosenBoardName(lobby.settings);
  const moreReactionTime = lobby.settings.moreReactionTime ?? false;
  const rotation = lobby.settings.minigames ?? [];
  const rotationSummary = onMinigames === undefined ? null : minigameSummary(lobby.settings);
  // Ohne Rotation vom Server (alter Server) zeigt der Knopf nur die Zahl der Spiele.
  const minigamesDetail = rotationSummary ?? galleryCountSummary();
  const toggleRotation = (id: string, kind: 'blocked' | 'favorite') => {
    onMinigames?.(
      toggleMinigame(
        minigamePrefs(lobby.settings),
        id,
        kind,
        rotation.map((game) => game.id),
      ),
    );
  };
  return (
    <section className="lobby" aria-label="Lobby">
      <div className="lobby-card">
        <div className="lobby-join">
          <h2>Mitspielen!</h2>
          {baseUrl !== undefined && (
            <div className="join-device" role="group" aria-label="Womit spielt ihr?">
              {DEVICE_OPTIONS.map((option) => (
                <button
                  key={option.device}
                  type="button"
                  className="join-device-option"
                  data-testid={`join-device-${option.device}`}
                  aria-pressed={device === option.device}
                  onClick={() => {
                    setDevice(option.device);
                  }}
                >
                  <span className="join-device-label">{option.label}</span>
                  <span className="join-device-seats">{option.seats}</span>
                </button>
              ))}
            </div>
          )}
          <p className="lobby-lead" data-testid="join-lead">
            {device === 'ipad'
              ? 'iPad-Kamera auf den Code – zwei Spieler teilen sich ein iPad.'
              : 'Handy-Kamera auf den Code – gleiches WLAN wie dieser PC.'}
          </p>
          {joinUrl ? (
            <QrCode value={joinUrl} size={260} />
          ) : (
            <p className="lobby-warning">
              Der Server kennt keinen Join-Link – nur den Code nutzen.
            </p>
          )}
          <div className="join-code">
            <span>Join-Code</span>
            <strong data-testid="join-code">{lobby.joinCode}</strong>
          </div>
          {joinUrl && (
            <p className="join-url" data-testid="join-url">
              {joinUrl}
            </p>
          )}
          {urls.length > 1 && (
            <label className="join-address">
              Andere Adresse:{' '}
              <select
                data-testid="join-address"
                value={baseUrl}
                onChange={(event) => {
                  setChosenUrl(event.target.value);
                }}
              >
                {urls.map((url) => (
                  <option key={url} value={url}>
                    {hostLabel(url)}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <div className="lobby-side">
          <h2>
            Spieler{' '}
            <span className="lobby-count">
              {players.length}/{MAX_PLAYERS}
            </span>
          </h2>
          {players.length === 0 ? (
            <p className="lobby-empty">Noch niemand da – scannt den QR-Code!</p>
          ) : (
            <ul className="lobby-players" aria-label="Beigetretene Spieler">
              {players.map((p) => (
                <LobbyPlayerCard key={p.slot} player={p} all={players} />
              ))}
              {freeSlots.map((slot) => (
                <li key={`frei-${String(slot)}`} className="lobby-player lobby-player--free">
                  <span className="lobby-free-symbol" aria-hidden="true">
                    {PLAYER_SLOTS[slot].symbol}
                  </span>
                  <span className="lobby-free-text">Platz frei</span>
                </li>
              ))}
            </ul>
          )}

          <div className="lobby-settings-row">
            {currentBoard !== undefined && (
              <fieldset className="lobby-rounds lobby-boards" data-testid="lobby-boards">
                <legend>Brett</legend>
                <button
                  type="button"
                  className="lobby-rounds-option lobby-board-option"
                  data-testid="board-choice"
                  data-board={currentBoard.id}
                  data-random={currentBoard.random}
                  aria-label={`Brett: ${currentBoard.name}. ${currentBoard.tagline}${
                    boards.length > 1 ? ' Klicken wählt das nächste Brett.' : ''
                  }`}
                  title={currentBoard.tagline}
                  onClick={() => {
                    onBoard(nextBoardId(boards));
                  }}
                >
                  <span className="lobby-board-name">
                    {currentBoard.random && <span aria-hidden="true">🎲 </span>}
                    {currentBoard.name}
                    {boards.length > 1 && (
                      <span className="lobby-board-next" aria-hidden="true">
                        {' '}
                        ›
                      </span>
                    )}
                  </span>
                  <span className="lobby-rounds-time">{currentBoard.detail}</span>
                </button>
              </fieldset>
            )}

            <fieldset className="lobby-rounds" data-testid="lobby-rounds">
              <legend>Runden</legend>
              <div className="lobby-rounds-options">
                {options.map((option) => (
                  <button
                    key={option.rounds}
                    type="button"
                    className="lobby-rounds-option"
                    data-testid={`rounds-${String(option.rounds)}`}
                    data-custom={option.custom}
                    aria-pressed={option.selected}
                    aria-label={`${String(option.rounds)} Runden`}
                    onClick={() => {
                      onRounds(option.rounds);
                    }}
                  >
                    <span className="lobby-rounds-value">{option.rounds}</span>
                    <span className="lobby-rounds-time">
                      {roundsDuration(option.rounds, players.length)}
                    </span>
                  </button>
                ))}
              </div>
            </fieldset>
          </div>

          <div className="lobby-extras-row">
            <button
              type="button"
              role="switch"
              className="lobby-toggle"
              data-testid="more-reaction-time"
              aria-checked={moreReactionTime}
              onClick={() => {
                onMoreReactionTime(!moreReactionTime);
              }}
            >
              <span className="lobby-toggle-track" aria-hidden="true">
                <span className="lobby-toggle-thumb" />
              </span>
              <span className="lobby-toggle-text">
                <span className="lobby-toggle-label">Mehr Zeit zum Reagieren</span>
                <span className="lobby-toggle-detail">
                  {moreReactionTime ? 'An: 5 s zum Festhalten' : 'Aus: 3 s zum Festhalten'}
                </span>
              </span>
            </button>
            <button
              type="button"
              className="lobby-toggle lobby-minigames"
              data-testid="minigames-open"
              aria-haspopup="dialog"
              aria-label={`Minispiele: ${minigamesDetail.long}`}
              onClick={() => {
                setGalleryOpen(true);
              }}
            >
              <span className="lobby-toggle-text">
                <span className="lobby-toggle-label">
                  Minispiele{' '}
                  <span className="lobby-board-next" aria-hidden="true">
                    ›
                  </span>
                </span>
                <span className="lobby-toggle-detail" data-testid="minigames-summary">
                  {minigamesDetail.short}
                </span>
              </span>
            </button>
          </div>

          <button
            type="button"
            className="start-button"
            data-testid="start-button"
            data-readiness={start.readiness}
            data-highlight={start.highlighted}
            disabled={!start.enabled}
            onClick={() => {
              onStart();
            }}
          >
            Los geht’s!
            <span className="start-button-rounds" data-testid="start-button-detail">
              {lobby.settings.rounds === 1 ? '1 Runde' : `${String(lobby.settings.rounds)} Runden`}
              {boardName === null ? '' : ` · ${boardName}`}
            </span>
          </button>
          <p className="start-hint" data-testid="start-hint">
            {start.hint}
          </p>

          {showJoinHelp && (
            <div className="join-help" role="note" data-testid="join-help">
              <strong>Noch kein Handy verbunden? Firewall/WLAN prüfen:</strong>
              <ul>
                <li>
                  Handy im selben WLAN wie der PC – kein Gäste-WLAN (Geräte sind dort oft
                  abgeschirmt).
                </li>
                <li>
                  PC-Firewall: Zugriff für Node.js im <em>privaten</em> Netzwerk erlauben (Port{' '}
                  {joinUrl ? new URL(joinUrl).port || '80' : '8787'}).
                </li>
                <li>
                  Seite lädt nicht? {urls.length > 1 ? '„Andere Adresse“ wählen oder ' : ''}
                  Server mit <code>PUBLIC_HOST=&lt;IP des PCs&gt;</code> starten.
                </li>
              </ul>
              <p>
                Ausführlich: <code>docs/network-setup.md</code>
              </p>
            </div>
          )}
        </div>
      </div>
      {galleryOpen && (
        <MinigameGallery
          ratings={ratings}
          rotation={rotation}
          onToggle={onMinigames === undefined || rotation.length === 0 ? undefined : toggleRotation}
          // Wie der Start: ab einem verbundenen Controller (bereit muss niemand sein).
          canPractice={start.enabled}
          onPractice={(id) => {
            if (onPractice(id)) setGalleryOpen(false);
          }}
          onClose={closeGallery}
          exportHref={RATINGS_EXPORT_HREF}
        />
      )}
    </section>
  );
}

function LobbyPlayerCard({
  player,
  all,
}: {
  readonly player: HostPlayer;
  readonly all: readonly HostPlayer[];
}) {
  const figure = cardCharacter(player, all);
  const state = !player.connected ? '⚠ getrennt' : player.ready ? 'bereit ✓' : 'nicht bereit';
  return (
    <li
      className="lobby-player"
      data-testid={`lobby-player-${String(player.slot)}`}
      data-connected={player.connected}
      data-ready={player.ready}
      data-character={player.character ?? ''}
      data-choosing={!figure.chosen}
      style={{ '--player-color': player.color } as CSSProperties}
    >
      <span className="lobby-player-figure">
        <CharacterPortrait character={figure.character} />
        {!figure.chosen && (
          <span className="lobby-player-question" aria-hidden="true">
            ?
          </span>
        )}
        <span className="player-dot" aria-hidden="true">
          <span className="player-symbol">{PLAYER_SLOTS[player.slot].symbol}</span>
        </span>
      </span>
      <span className="lobby-player-label">
        {player.label}
        <span
          className="lobby-player-character"
          data-testid={`lobby-character-${String(player.slot)}`}
        >
          {figure.text}
        </span>
      </span>
      <span className="lobby-player-state" data-testid={`lobby-state-${String(player.slot)}`}>
        {state}
      </span>
    </li>
  );
}
