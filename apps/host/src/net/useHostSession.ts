import type { LobbyMessage, MinigameRating, MinigameResultAckMessage } from '@chaos-party/protocol';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createBoardDirector, type BoardDirector } from '../board/director.ts';
import { createIntentHub, type IntentHub } from '../input/webSocketInputSource.ts';
import { createBoardFeed, type BoardFeed } from './boardFeed.ts';
import {
  connectHost,
  type ConnectionStatus,
  type HostCommand,
  type HostConnection,
  type MinigameCuePayload,
  type MinigameResultPayload,
  type StartOptions,
} from './hostConnection.ts';
import { createResultSender, type ResultSender } from './resultSender.ts';

export interface HostSession {
  /** `null` im lokalen Tastatur-Modus (keine Verbindung). */
  readonly status: ConnectionStatus | null;
  /** Letzter `lobby`-Schnappschuss des Servers. */
  readonly lobby: LobbyMessage | null;
  /** Verteiler für geprüfte Eingaben; stabil über die Lebensdauer der Komponente. */
  readonly hub: IntentHub;
  /**
   * Regie der Brettphase (M2): bekommt jede `board`-Nachricht des Servers. Stabil über die
   * Lebensdauer der Komponente; im lokalen Modus füttert die App sie mit Demo-Nachrichten.
   */
  readonly director: BoardDirector;
  /**
   * Neuester Brett-Stand mit Empfangszeit und Minispiel-Münzen (M3): steuert die
   * Minispiel-Bühne. Stabil über die Lebensdauer der Komponente.
   */
  readonly feed: BoardFeed;
  /** Versand des Minispiel-Ergebnisses (genau einmal, Wiederholung nach Neuverbindung). */
  readonly results: ResultSender;
  /** Schickt `start` (Modus, Runden); `false`, wenn nicht verbunden. Stabile Referenz. */
  readonly start: (options?: StartOptions) => boolean;
  /** Ergebnis des laufenden Minispiels an den Server (über `results`). Stabile Referenz. */
  readonly submitMinigameResult: (result: MinigameResultPayload) => void;
  /** Hinweis des laufenden Abschnitts an den Server (CHAOS-231); lokal ohne Wirkung. */
  readonly sendMinigameCue: (cue: MinigameCuePayload) => void;
  /**
   * Steuerbefehl an den Server (v4: `configure`, `pause`, `resume`, `end-game`, `rematch`);
   * `false`, wenn nicht verbunden. Stabile Referenz.
   */
  readonly command: (command: HostCommand) => boolean;
  /** Letzte Bestätigung eines Minispiel-Ergebnisses (v4, CHAOS-55) oder `null`. */
  readonly resultAck: MinigameResultAckMessage | null;
  /**
   * Bühne (Brett bzw. Minispiel samt Figuren) geladen ja/nein (CHAOS-68): `true` meldet dem
   * Server `host-ready`, der dann eine Auto-Pause nach Host-Verlust fortsetzt. Stabile Referenz.
   */
  readonly setSceneReady: (ready: boolean) => void;
  /** Daumen je Minispiel laut Server (CHAOS-87); leer, solange keine Stimmen da sind. */
  readonly ratings: readonly MinigameRating[];
}

const NO_RATINGS: readonly MinigameRating[] = [];

/**
 * Hält die Server-Verbindung des Hosts (React-Seite von `connectHost`).
 * `url === null` → lokaler Modus ohne Verbindung.
 */
export function useHostSession(url: string | null): HostSession {
  const [hub] = useState(createIntentHub);
  const [director] = useState(() => createBoardDirector());
  const [feed] = useState(() => createBoardFeed());
  const [results] = useState(() => createResultSender());
  const connectionRef = useRef<HostConnection | null>(null);
  const sceneReadyRef = useRef(false);
  const [status, setStatus] = useState<ConnectionStatus | null>(url === null ? null : 'connecting');
  const [lobby, setLobby] = useState<LobbyMessage | null>(null);
  const [resultAck, setResultAck] = useState<MinigameResultAckMessage | null>(null);
  const [ratings, setRatings] = useState<readonly MinigameRating[]>(NO_RATINGS);

  useEffect(() => {
    if (url === null) return;
    const connection = connectHost(url, {
      onStatus: (next) => {
        if (next !== 'connected') results.onDisconnected();
        setStatus(next);
      },
      onLobby: setLobby,
      onBoard: (board) => {
        director.receive(board);
        feed.receive(board);
        results.onView(board.view);
      },
      onInput: (intent) => {
        hub.emit(intent);
      },
      onServerError: (error) => {
        console.warn(`Server meldet ${error.code}: ${error.message}`);
        results.onError(error);
      },
      onResultAck: (ack) => {
        if (ack.accepted)
          console.info(`Minispiel-Ergebnis ${ack.minigameId}:${String(ack.round)} angenommen`);
        else
          console.warn(
            `Minispiel-Ergebnis ${ack.minigameId}:${String(ack.round)} abgelehnt (${ack.code ?? 'ohne Code'})`,
          );
        results.onAck(ack);
        setResultAck(ack);
      },
      onRatings: (message) => {
        setRatings(message.games);
      },
    });
    connectionRef.current = connection;
    connection.setSceneReady(sceneReadyRef.current);
    results.setTransport((result) => connection.sendMinigameResult(result));
    return () => {
      connection.close();
      results.setTransport(null);
      if (connectionRef.current === connection) connectionRef.current = null;
    };
  }, [url, hub, director, feed, results]);

  const start = useCallback(
    (options?: StartOptions) => connectionRef.current?.sendStart(options) ?? false,
    [],
  );
  const submitMinigameResult = useCallback(
    (result: MinigameResultPayload) => {
      results.submit(result);
    },
    [results],
  );

  const sendMinigameCue = useCallback((cue: MinigameCuePayload) => {
    connectionRef.current?.sendMinigameCue(cue);
  }, []);

  const command = useCallback(
    (next: HostCommand) => connectionRef.current?.sendCommand(next) ?? false,
    [],
  );

  const setSceneReady = useCallback((ready: boolean) => {
    sceneReadyRef.current = ready;
    connectionRef.current?.setSceneReady(ready);
  }, []);

  return {
    status,
    lobby,
    hub,
    director,
    feed,
    results,
    start,
    submitMinigameResult,
    sendMinigameCue,
    command,
    resultAck,
    setSceneReady,
    ratings,
  };
}
