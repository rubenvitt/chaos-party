import { useMemo, useState, type CSSProperties } from 'react';
import { CHARACTER_NAMES } from '@chaos-party/minigame-sdk';
import { PLAYER_SLOTS, type CharacterId, type PlayerInfo } from '@chaos-party/protocol';
import { createMoveSender } from '../input/moveSender.ts';
import { describeLobby, describeSeats } from '../lobby/view.ts';
import { describePlay } from '../minigame/view.ts';
import type { SlotIntent } from '../net/client.ts';
import { ownCharacter } from '../state/character.ts';
import type { FeedbackPulse, PendingChoice, SlotContext } from '../state/reducer.ts';
import { describeSlotScreen } from '../state/screen.ts';
import { ActionButton } from './ActionButton.tsx';
import { BoardPanel } from './BoardPanel.tsx';
import { StatusBar } from './board.tsx';
import { CharacterPortrait } from './CharacterPortrait.tsx';
import { readableTextColor } from './color.ts';
import { FinalCard, PauseCard } from './final.tsx';
import { Joystick } from './Joystick.tsx';
import { CharacterLobby } from './lobby.tsx';
import { IntroReadyControl, MinigameCard, MinigameHeader } from './minigame.tsx';

export interface SlotControllerProps {
  player: PlayerInfo;
  /** `undefined`, solange der Server noch keinen Kontext geschickt hat. */
  context: SlotContext | undefined;
  feedback: FeedbackPulse | undefined;
  /** Gesendete, noch unbeantwortete Wahl dieses Slots (Brettphase, CHAOS-22). */
  pending?: PendingChoice | undefined;
  /** Gesendete, noch unbestätigte Figurenwahl (Lobby, CHAOS-36). */
  pick?: CharacterId | undefined;
  /** Alle eigenen Spieler aus `welcome` (Namen in der Brettphase); Standard: nur `player`. */
  players?: readonly PlayerInfo[];
  /** Sendet eine Eingabe für **diesen** Slot (Slot setzt die Komponente selbst). */
  send: (intent: SlotIntent) => void;
}

/**
 * Bedienfläche eines Spielerplatzes am iPhone. Welcher Bildschirm erscheint, entscheidet
 * `describeSlotScreen` allein aus dem Server-Kontext (Lobby mit Charakterwahl, Spiel,
 * Minispiel, Brett, Pause, Endstand) – auch direkt nach Neuladen oder Wiederverbinden.
 */
export function SlotController({
  player,
  context,
  feedback,
  pending,
  pick,
  players,
  send,
}: SlotControllerProps) {
  const style = PLAYER_SLOTS[player.slot];
  const cssVars = {
    '--player': player.color,
    '--on-player': readableTextColor(player.color),
  } as CSSProperties;
  const layout = context?.layout ?? 'wait';
  const minigame = context?.minigame;
  const screen = describeSlotScreen(context);
  const lobby = screen === 'lobby' ? describeLobby(context, pick) : null;

  return (
    <section
      className={`slot layout-${layout} screen-${screen}${minigame ? ` minigame-${minigame.stage}` : ''}`}
      style={cssVars}
      data-testid={`slot-${player.slot}`}
      data-layout={layout}
      data-screen={screen}
      data-phase={context?.phase ?? 'none'}
      data-minigame-stage={minigame?.stage ?? 'none'}
    >
      <header className="player-badge" data-testid="player-badge">
        <span className="badge-avatar">
          <CharacterPortrait
            character={ownCharacter(player.slot, context)}
            className="badge-portrait"
            decorative
          />
          <span className="player-symbol" aria-hidden="true">
            {style.symbol}
          </span>
        </span>
        <span className="player-label ui-text">{player.label}</span>
      </header>

      {lobby && context && (
        <CharacterLobby
          slot={player.slot}
          view={lobby}
          seats={describeSeats(context.lobby, player.slot)}
          contextKey={contextKey(context)}
          send={send}
        />
      )}
      {screen === 'lobby-basic' && context && (
        <LobbyPanel key={contextKey(context)} context={context} send={send} slot={player.slot} />
      )}
      {screen === 'wait' && <WaitPanel />}
      {screen === 'play' && context && (
        <PlayPanel context={context} send={send} slot={player.slot} />
      )}
      {screen === 'minigame' && minigame && (
        <div className="panel minigame-panel" data-testid="minigame-panel">
          <MinigameCard
            // Neuer Lauf (andere Runde/anderes Spiel): Daumen-Auswahl beginnt leer.
            key={`${minigame.id}:${String(context.board?.round ?? 0)}`}
            minigame={minigame}
            readyLine={
              minigame.stage === 'intro' ? (
                // Neuer Kontext (z. B. Angebot weg) setzt „gesendet“ zurück; neue Anleitung
                // (anderes Minispiel) startet auch die Schonfrist neu (CHAOS-214).
                <IntroReadyControl
                  key={`${minigame.id}:${contextKey(context)}`}
                  context={context}
                  onReady={() => {
                    send({ type: 'ready', slot: player.slot });
                  }}
                />
              ) : undefined
            }
            voting={{
              context,
              onVote: (vote) => {
                send({
                  type: 'rate',
                  slot: player.slot,
                  minigameId: minigame.id,
                  round: context.board?.round ?? 0,
                  vote,
                });
              },
            }}
          />
        </div>
      )}
      {screen === 'pause' && (
        <div className="panel pause-panel-wrap">
          {context?.board && <StatusBar board={context.board} />}
          <PauseCard />
        </div>
      )}
      {screen === 'final' && context?.board && (
        <div className="panel final-panel">
          <FinalCard board={context.board} />
        </div>
      )}
      {screen === 'board' && context && (
        <BoardPanel
          slot={player.slot}
          players={players ?? [player]}
          context={context}
          pending={pending}
          send={send}
        />
      )}

      {feedback && (
        <span
          key={feedback.id}
          className={`feedback feedback-${feedback.kind}`}
          data-testid="feedback"
        />
      )}
    </section>
  );
}

function contextKey(context: SlotContext): string {
  return `${context.phase}:${context.layout}:${context.actions.join(',')}`;
}

interface PanelProps {
  context: SlotContext;
  slot: PlayerInfo['slot'];
  send: (intent: SlotIntent) => void;
}

function LobbyPanel({ context, slot, send }: PanelProps) {
  const [sent, setSent] = useState(false);
  const canReady = context.actions.includes('ready') && !sent;
  const character = ownCharacter(slot, context);

  return (
    <div className="panel lobby-panel">
      <figure className="lobby-figure" data-testid="lobby-figure">
        <CharacterPortrait character={character} className="lobby-portrait" decorative />
        <figcaption className="lobby-figure-name ui-text">
          {CHARACTER_NAMES[character].name}
        </figcaption>
      </figure>
      {canReady ? (
        <>
          <p className="panel-lead ui-text">Bist du startklar?</p>
          <button
            type="button"
            className="ready-button"
            data-testid="ready-button"
            onClick={() => {
              setSent(true);
              send({ type: 'ready', slot });
            }}
          >
            <span className="ui-text">Bereit!</span>
          </button>
        </>
      ) : (
        <div className="ready-done" data-testid="ready-done">
          <span className="ready-check" aria-hidden="true">
            ✓
          </span>
          <p className="panel-lead ui-text">Du bist dabei! Gleich geht&apos;s los …</p>
        </div>
      )}
    </div>
  );
}

function WaitPanel() {
  return (
    <div className="panel wait-panel" data-testid="wait-panel">
      <span className="wait-dots" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <p className="panel-lead ui-text">Schau auf den großen Bildschirm!</p>
    </div>
  );
}

function PlayPanel({ context, slot, send }: PanelProps) {
  const mover = useMemo(
    () =>
      createMoveSender((stick) => {
        send({ type: 'move', slot, x: stick.x, y: stick.y });
      }),
    [send, slot],
  );
  const view = describePlay(context);
  const labelled = view.title !== null;

  return (
    <div
      className={`panel play-panel${labelled ? ' play-minigame' : ''}`}
      data-testid="play-panel"
      data-stick={view.stick ? 'true' : 'false'}
      data-buttons={view.buttons.length}
    >
      {view.title !== null && (
        <MinigameHeader title={view.title} cue={view.cue} className="play-header" />
      )}
      {(view.stick || !labelled) && (
        <div className="stick-area">
          {view.stick && (
            <Joystick onChange={mover.update} hint={labelled ? view.stickHint : undefined} />
          )}
        </div>
      )}
      {(view.buttons.length > 0 || !labelled) && (
        <div className="button-area" data-count={view.buttons.length}>
          {view.buttons.map(({ button, label }) => (
            <ActionButton
              key={button}
              button={button}
              label={label}
              onPress={() => {
                send({ type: 'press', slot, button });
              }}
              onRelease={() => {
                send({ type: 'release', slot, button });
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
