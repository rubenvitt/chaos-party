import { getMinigameInfo } from '@chaos-party/minigames/catalog';
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
// Finale-Stile im Start-CSS (CHAOS-53), obwohl das Finale im Brett-Chunk liegt: So bleibt die
// Kaskade wie vor dem Aufteilen – `styles.css` (main.tsx) kommt danach und gewinnt bei gleicher
// Spezifität (z. B. `.start-button` vor `.finale-rematch`). Die Porträts stehen wie bisher davor.
import './lobby/portrait.css';
import './finale/finale.css';
import { DEFAULT_BOARD, getBoard } from '@chaos-party/game-core';
import { createDemoMessages, DEMO_DELAYS_MS, demoStartMessage } from './board/demo.ts';
import type { BoardScene } from './board/types.ts';
import { finaleSpeedOf, serverWebSocketUrl, type HostConfig } from './config.ts';
import { DebugOverlay } from './debug/DebugOverlay.tsx';
import { attachPerf, installPerfMonitor } from './debug/perf.ts';
import {
  markScene,
  resetSceneLog,
  sceneLogTransitions,
  startSceneLog,
} from './debug/sceneMarks.ts';
import { createPerfMonitor, type PerfMonitor } from './debug/perfMonitor.ts';
import { environmentSample } from './debug/renderProbe.ts';
import { scenePerfReport } from './debug/summary.ts';
import { soundEngine } from './fx/audio.ts';
import { Hud, type PhysicsStatus } from './Hud.tsx';
import { createKeyboardInputSource } from './input/keyboardInputSource.ts';
import { createWebSocketInputSource } from './input/webSocketInputSource.ts';
import { loadArenaScene, loadBoardStage, prefetchGameScenes } from './lazyScenes.ts';
import type { MinigamePrefs } from './lobby/lobbyState.ts';
import { LobbyPanel } from './lobby/LobbyPanel.tsx';
import { loadMinigamePrefs, saveMinigamePrefs } from './lobby/minigamePrefs.ts';
import { PlayerToasts } from './lobby/PlayerToasts.tsx';
import { stageKeyOf } from './minigame/plan.ts';
import { useMinigameModuleStatus } from './minigame/useMinigameModule.ts';
import { useMinigameStage } from './minigame/useMinigameStage.ts';
import { useHostSession } from './net/useHostSession.ts';
import { PauseControls } from './pause/PauseControls.tsx';
import { createLocalPlayers, playersFromLobby, type HostPlayer } from './players.ts';
import type { GameScene } from './scene/types.ts';
import type { ChaosTestHook } from './testHook.ts';
import './testHook.ts';

interface AppProps {
  readonly config: HostConfig;
}

const NO_PLAYERS: readonly HostPlayer[] = [];

/**
 * Host-Oberfläche: Babylon-Canvas unten, React-HUD und Lobby darüber.
 * Zustand fließt nur in eine Richtung: React → Szene (`setPlayers`, Eingaben),
 * Szene → React nur `ready` (C5).
 *
 * Zwei Betriebsarten (ADR-007):
 * - **Server** (Standard): Verbindung zu `/ws`, Spieler aus der Lobby, Eingaben von den
 *   Controllern; Tastatur steuert zusätzlich beigetretene Slots (Fehlersuche).
 * - **Lokal** (`?local=1`): keine Verbindung, `?players=` Demo-Spieler per Tastatur;
 *   mit `&board=1` stattdessen das Spielbrett mit Beispiel-Spielstand (`&demo=1` animiert,
 *   `&brett=<id>` ein anderes Brett aus dem Register mit passendem Startstand, dazu
 *   `&ueberblick=1` das ganze Brett, CHAOS-199).
 *
 * Szenen nach Phase: `lobby` und `play` zeigen die Arena (M1), `board` die Brett-Szene (M2).
 * In den Minispiel-Phasen eines bekannten Minispiels ersetzt die Minispiel-Bühne (M3,
 * `MinigameScreen`) das Brett; das Brett bleibt dabei unsichtbar und angehalten eingehängt
 * (CHAOS-152). Maßgeblich ist der
 * neueste Server-Stand (`feed`), nicht der animierte Stand der Regie.
 */
const isKnownMinigame = (id: string) => getMinigameInfo(id) !== undefined;

// Brett und Minispiel-Bühne als eigene Chunks (CHAOS-53, `lazyScenes.ts`).
const BoardStage = lazy(() => loadBoardStage().then((m) => ({ default: m.BoardStage })));

export function App({ config }: AppProps) {
  const { seed, test, local, debug } = config;
  const localBoard = local && config.board;
  // Nur mit `?debug=1` (CHAOS-45, CHAOS-39): Bildrate, Eingang→Frame und Kennzahlen je Szene.
  const [monitor] = useState<PerfMonitor | null>(() => (debug ? createPerfMonitor() : null));
  const session = useHostSession(local ? null : serverWebSocketUrl(window.location));
  const [localPlayers] = useState(() => createLocalPlayers(config.players));
  const lobbyPlayers = session.lobby?.players;
  const players = useMemo(
    () => (local ? localPlayers : lobbyPlayers ? playersFromLobby(lobbyPlayers) : NO_PLAYERS),
    [local, localPlayers, lobbyPlayers],
  );
  const phase = local ? (localBoard ? 'board' : 'play') : (session.lobby?.phase ?? 'lobby');
  const boardMode = phase === 'board';
  const { director, feed } = session;
  const subscribeFeed = useCallback((listener: () => void) => feed.subscribe(listener), [feed]);
  const getFeed = useCallback(() => feed.getSnapshot(), [feed]);
  const latest = useSyncExternalStore(subscribeFeed, getFeed);
  const minigameKey = !local && boardMode ? stageKeyOf(latest.view, isKnownMinigame) : null;
  const minigameInfo =
    minigameKey !== null && latest.view?.minigame
      ? getMinigameInfo(latest.view.minigame.id)
      : undefined;
  const [minigameReady, setMinigameReady] = useState(false);
  // Modul des Minispiels der Runde (eigener Chunk, CHAOS-86) laden, sobald der Stand es nennt;
  // die Bühne hängt erst ein, wenn es da ist (kein Suspense, keine 300-ms-Drossel).
  const minigameModule = useMinigameModuleStatus(minigameInfo?.id);
  // Bühnen-Chunk ohne `React.lazy` (keine Suspense-Drossel beim ersten Minispiel, CHAOS-86).
  const MinigameScreenById = useMinigameStage(!local && boardMode);
  // Messung (nur `?debug=1`): Brett → Minispiel zählt ab Empfang des Stands, der das Minispiel
  // nennt – so steckt auch das Laden des Spiel-Chunks in der Wartezeit (CHAOS-86).
  const requestedKey = useRef<string | null>(null);
  const receivedAt = latest.receivedAt;
  useEffect(() => {
    if (minigameKey === null || requestedKey.current === minigameKey) return;
    requestedKey.current = minigameKey;
    markScene('minispiel', 'angefragt', receivedAt);
  }, [minigameKey, receivedAt]);
  const minigameShown = boardMode && minigameInfo !== undefined && latest.view !== null;

  const [physics, setPhysics] = useState<PhysicsStatus>('loading');
  const [sceneReady, setSceneReady] = useState(false);
  const [boardReady, setBoardReady] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<GameScene | null>(null);
  const boardSceneRef = useRef<BoardScene | null>(null);
  const playersRef = useRef(players);
  const phaseRef = useRef(phase);
  const { hub } = session;

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    // In der Brettphase läuft die Brett-Szene (BoardStage); die Arena wird entsorgt.
    if (boardMode) return;
    const stage = stageRef.current;
    if (!stage) return;
    // Die Arena (Babylon + Havok) ist ein eigener Chunk (CHAOS-53): Lobby und QR-Code stehen
    // schon, während sie lädt. Wird der Effekt vorher aufgeräumt, entsteht gar keine Szene.
    let active = true;
    let unmount: (() => void) | undefined;
    loadArenaScene().then(
      ({ createGameScene }) => {
        if (active) unmount = mountArena(stage, createGameScene);
      },
      (error: unknown) => {
        if (active) console.error('Arena konnte nicht geladen werden', error);
      },
    );
    return () => {
      active = false;
      unmount?.();
    };

    function mountArena(
      stage: HTMLDivElement,
      createGameScene: Awaited<ReturnType<typeof loadArenaScene>>['createGameScene'],
    ): () => void {
      // Canvas imperativ anlegen: jede Szene bekommt einen frischen WebGL-Kontext,
      // auch wenn React (StrictMode) den Effekt doppelt ausführt.
      const canvas = document.createElement('canvas');
      canvas.className = 'game-canvas';
      canvas.setAttribute('aria-label', 'Spielszene');
      stage.appendChild(canvas);

      const scene = createGameScene(canvas, { seed, testMode: test });
      sceneRef.current = scene;
      scene.setPlayers(playersRef.current);

      const hook: ChaosTestHook | undefined = test
        ? {
            ready: false,
            physicsReady: false,
            stepFrames: (n: number) => {
              scene.stepFrames(n);
            },
            getPlayerPositions: () => scene.getPlayerPositions(),
            networkInputs: 0,
            lastMoves: {},
            scene: 'arena',
          }
        : undefined;
      if (hook) window.__chaos = hook;

      // Messung (nur Debug, CHAOS-39): Arena heißt in der Lobby „lobby“, im Spiel „arena“.
      const stopPerf = attachPerf(() => (phaseRef.current === 'lobby' ? 'lobby' : 'arena'), scene);

      // Tastatur immer (lokal: Demo-Spieler; mit Server: beigetretene Slots), dazu Netzwerk.
      const stopKeyboard = createKeyboardInputSource(window).start(scene);
      const stopNetwork = local
        ? undefined
        : createWebSocketInputSource(hub, ({ slot, input }) => {
            if (!hook) return;
            hook.networkInputs++;
            if (input.type === 'move') hook.lastMoves[slot] = { x: input.x, y: input.y };
          }).start(scene);

      scene.physicsReady.then(
        () => {
          if (!active) return;
          if (hook) hook.physicsReady = true;
          setPhysics('ready');
        },
        (error: unknown) => {
          if (!active) return;
          console.error('Havok-Physik konnte nicht geladen werden', error);
          setPhysics('error');
        },
      );
      scene.ready.then(
        () => {
          if (!active) return;
          if (hook) hook.ready = true;
          setSceneReady(true);
        },
        (error: unknown) => {
          if (!active) return;
          console.error('Szene konnte nicht aufgebaut werden', error);
        },
      );

      return () => {
        stopKeyboard();
        stopNetwork?.();
        stopPerf();
        scene.dispose();
        canvas.remove();
        sceneRef.current = null;
        if (hook && window.__chaos === hook) delete window.__chaos;
      };
    }
  }, [seed, test, local, hub, boardMode]);

  // Sobald die Arena steht, Brett und Minispiel-Bühne im Hintergrund laden (CHAOS-53), damit
  // der Start der Partie nicht auf den Chunk wartet. Nicht im rein lokalen Arena-Modus.
  useEffect(() => {
    if (sceneReady && !local) prefetchGameScenes();
  }, [sceneReady, local]);

  // Messung je Szene (nur Debug, CHAOS-39): seitenweit anmelden, Eingänge zählen (Controller-
  // Eingaben synchron im `message`-Ereignis, neue Brett-Stände beim Empfang), alle 500 ms
  // Kontexte/Schleifen/Heap/Bestand lesen; Bericht unter `window.__chaosPerf`.
  useEffect(() => {
    if (!monitor) return;
    const uninstall = installPerfMonitor(monitor);
    // Long Tasks für die Standbild-Kennzahl je Szenenwechsel (CHAOS-153).
    startSceneLog();
    const stopInputs = hub.subscribe(() => {
      monitor.inputReceived(performance.now(), 'input');
    });
    const stopBoard = feed.subscribe(() => {
      monitor.inputReceived(performance.now(), 'board');
    });
    const timer = setInterval(() => {
      monitor.sampleEnvironment(environmentSample());
    }, 500);
    window.__chaosPerf = {
      report: () => monitor.report(),
      summary: () =>
        scenePerfReport(monitor.report(), {
          device: navigator.userAgent,
          renderer: (boardSceneRef.current ?? sceneRef.current)?.getRendererInfo() ?? null,
          testMode: test,
        }),
      activeScenes: () => monitor.activeScenes(),
      transitions: () => sceneLogTransitions(),
      reset: () => {
        monitor.reset();
        resetSceneLog();
      },
    };
    return () => {
      uninstall();
      stopInputs();
      stopBoard();
      clearInterval(timer);
      delete window.__chaosPerf;
    };
  }, [monitor, hub, feed, test]);

  // Lokaler Brett-Modus: Beispiel-Spielstand, mit `demo` die Ereignisfolge in Schleife
  // (nicht im Testmodus – dort speisen Tests Nachrichten über den Testhaken ein).
  useEffect(() => {
    if (!localBoard) return;
    const params = new URLSearchParams(window.location.search);
    const other = getBoard(params.get('brett') ?? '');
    if (other && other.id !== DEFAULT_BOARD.id) {
      const start = demoStartMessage(other);
      // `&ueberblick=1`: ganzes Brett (Kamera wie vor der Partie), für Screenshots.
      const overview = params.get('ueberblick') === '1';
      director.receive(
        overview ? { ...start, view: { ...start.view, gamePhase: 'setup', prompt: null } } : start,
      );
      return;
    }
    const messages = createDemoMessages();
    const first = messages[0];
    if (first) director.receive(first);
    if (!config.demo || test) return;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    // Jede Runde der Schleife beginnt mit einer Lücke in `eventSeq` → Sprung zurück zum Start.
    let offset = 0;
    const play = (index: number) => {
      const message = messages[index];
      if (!message) {
        offset += 1000;
        schedule(0, 2500);
        return;
      }
      director.receive({ ...message, eventSeq: message.eventSeq + offset });
      schedule(index + 1, DEMO_DELAYS_MS[index + 1] ?? 2000);
    };
    const schedule = (index: number, delay: number) => {
      const timer = setTimeout(() => {
        timers.delete(timer);
        play(index);
      }, delay);
      timers.add(timer);
    };
    schedule(1, DEMO_DELAYS_MS[1] ?? 1500);
    return () => {
      for (const timer of timers) clearTimeout(timer);
    };
  }, [localBoard, config.demo, test, director]);

  const getRenderer = useCallback(
    () =>
      // Während eines Minispiels ist das Brett nur ausgeblendet (CHAOS-152); es zählt nicht.
      (boardMode
        ? minigameShown
          ? null
          : boardSceneRef.current
        : sceneRef.current
      )?.getRendererInfo() ?? null,
    [boardMode, minigameShown],
  );
  const onBoardScene = useCallback((scene: BoardScene | null) => {
    boardSceneRef.current = scene;
  }, []);
  const { arena } = config;
  const { start, results, submitMinigameResult, command } = session;
  // Rundenzahl (CHAOS-36): Die Lobby zeigt die Server-Einstellung (`lobby.settings.rounds`).
  // `?rounds=` stellt sie beim ersten Lobby-Stand per `configure` ein; eine Wahl in der Lobby
  // gilt danach. `start` schickt die zuletzt gewählte Zahl mit (Wettlauf mit `configure`).
  const [roundsChoice, setRoundsChoice] = useState<number | null>(config.rounds);
  const configuredFromUrl = useRef(false);
  const lobbyPhase = session.lobby?.phase;
  useEffect(() => {
    if (configuredFromUrl.current || config.rounds === null || lobbyPhase !== 'lobby') return;
    if (command({ type: 'configure', rounds: config.rounds })) configuredFromUrl.current = true;
  }, [command, config.rounds, lobbyPhase]);
  const onRounds = useCallback(
    (value: number) => {
      setRoundsChoice(value);
      command({ type: 'configure', rounds: value });
    },
    [command],
  );
  // „Mehr Zeit zum Reagieren“ (CHAOS-124): Der Schalter zeigt die Server-Einstellung.
  const onMoreReactionTime = useCallback(
    (on: boolean) => {
      command({ type: 'configure', moreReactionTime: on });
    },
    [command],
  );
  // Brett (CHAOS-197): Die Auswahl zeigt die Server-Einstellung (`lobby.settings.board`).
  const onBoard = useCallback(
    (board: string) => {
      command({ type: 'configure', board });
    },
    [command],
  );
  // Sperrliste und Favoriten der Minispiele (CHAOS-85): lokal gemerkt, beim ersten Lobby-Stand
  // jeder Session (Join-Code) an den Server geschickt; danach zeigt die Lobby den Server-Stand.
  const lobbyJoinCode = session.lobby?.joinCode;
  const hasRotation = session.lobby?.settings.minigames !== undefined;
  const rotationSentFor = useRef<string | null>(null);
  useEffect(() => {
    if (lobbyPhase !== 'lobby' || !hasRotation || lobbyJoinCode === undefined) return;
    if (rotationSentFor.current === lobbyJoinCode) return;
    const stored = loadMinigamePrefs();
    if (stored === null || (stored.blocklist.length === 0 && stored.favorites.length === 0)) {
      rotationSentFor.current = lobbyJoinCode;
      return;
    }
    if (
      command({
        type: 'configure',
        minigameBlocklist: stored.blocklist,
        minigameFavorites: stored.favorites,
      })
    ) {
      rotationSentFor.current = lobbyJoinCode;
    }
  }, [command, lobbyPhase, hasRotation, lobbyJoinCode]);
  const onMinigames = useCallback(
    (prefs: MinigamePrefs) => {
      saveMinigamePrefs(prefs);
      command({
        type: 'configure',
        minigameBlocklist: prefs.blocklist,
        minigameFavorites: prefs.favorites,
      });
    },
    [command],
  );
  const onStart = useCallback(() => {
    // Der Klick auf „Los geht’s!“ ist die Nutzer-Geste, die den Ton freischaltet (CHAOS-33).
    soundEngine().unlock();
    return start({
      mode: arena ? 'arena' : 'board',
      ...(roundsChoice === null ? {} : { rounds: roundsChoice }),
    });
  }, [start, arena, roundsChoice]);
  // Minispiel-Galerie (CHAOS-87): Übungsrunde mit einem Minispiel, ohne Münzen.
  const onPractice = useCallback(
    (minigameId: string) => {
      soundEngine().unlock();
      return start({ mode: 'board', practice: minigameId });
    },
    [start],
  );
  const onRematch = useCallback(() => {
    if (local) {
      // Lokaler Brett-Modus (ohne Server): Beispiel-Stand neu laden.
      window.location.reload();
      return;
    }
    soundEngine().unlock();
    command({ type: 'rematch' });
  }, [command, local]);
  const getResultState = useCallback(() => results.state, [results]);

  // Bühne der aktuellen Phase fertig (Szene, Figuren; im Brett auch der erste Stand)?
  const stageReady = minigameInfo ? minigameReady : boardMode ? boardReady : sceneReady;
  // Erst dann setzt der Server eine Auto-Pause nach dem Neuladen fort (CHAOS-68).
  const hostReady =
    !local && session.lobby !== null && stageReady && (!boardMode || latest.view !== null);
  const reportStageReady = session.setSceneReady;
  useEffect(() => {
    reportStageReady(hostReady);
  }, [reportStageReady, hostReady]);

  useEffect(() => {
    playersRef.current = players;
    sceneRef.current?.setPlayers(players);
  }, [players]);

  return (
    <main
      className="host"
      data-physics={boardMode ? 'off' : physics}
      data-scene={stageReady ? 'ready' : 'loading'}
      data-mode={local ? 'local' : 'server'}
      data-phase={phase}
      data-minigame={minigameInfo?.id}
      data-paused={!local && boardMode ? (latest.view?.paused ?? false) : undefined}
    >
      <Suspense fallback={null}>
        {boardMode ? (
          // Das Brett bleibt die ganze Partie eingehängt (CHAOS-152): Während eines Minispiels ist
          // es unsichtbar und angehalten, statt entsorgt und danach neu gebaut zu werden.
          <BoardStage
            director={director}
            connection={session.status}
            test={test}
            local={local}
            onReady={setBoardReady}
            onScene={onBoardScene}
            finaleSpeed={finaleSpeedOf(config)}
            onRematch={onRematch}
            gpu={config.gpu}
            hidden={minigameShown}
          />
        ) : (
          <>
            <div className="stage" ref={stageRef} />
            <Hud
              players={players}
              // Lobby vor dem Brettspiel: nicht „Schubs-Arena“ (die läuft nur dahinter, CHAOS-40).
              subtitle={phase === 'play' || arena ? 'Schubs-Arena' : 'Party-Brettspiel'}
              physics={physics}
              showKeyHints={local}
              showPlayers={local || phase === 'play'}
              connection={session.status}
            />
          </>
        )}
      </Suspense>
      {/* Eigene Grenze: Wartet die Bühne doch einmal (z. B. nach einem fehlgeschlagenen Import des
          Spiel-Chunks), bleibt das Brett unberührt. */}
      <Suspense fallback={null}>
        {minigameShown && minigameModule !== 'loading' && MinigameScreenById && (
          // Stabile Identität: Export des geladenen Chunks, einmal im State (`useMinigameStage`).
          // eslint-disable-next-line react-hooks/static-components
          <MinigameScreenById
            key={minigameKey}
            minigameId={minigameInfo.id}
            view={latest.view}
            receivedAt={latest.receivedAt}
            rewards={
              latest.rewards && latest.rewards.round === latest.view.minigame?.round
                ? latest.rewards.bySlot
                : null
            }
            connection={session.status}
            test={test}
            hub={hub}
            onResult={submitMinigameResult}
            onReady={setMinigameReady}
            getResultState={getResultState}
            resultAck={session.resultAck}
          />
        )}
      </Suspense>
      {!local && boardMode && (
        <PauseControls view={latest.view} loading={!stageReady} onCommand={command} />
      )}
      <PlayerToasts players={players} enabled={!local} />
      {monitor && <DebugOverlay monitor={monitor} getRenderer={getRenderer} testMode={test} />}
      {!local && phase === 'lobby' && session.status !== null && (
        <LobbyPanel
          lobby={session.lobby}
          players={players}
          status={session.status}
          joinHintSeconds={config.joinHintSeconds}
          onStart={onStart}
          onRounds={onRounds}
          onMoreReactionTime={onMoreReactionTime}
          onBoard={onBoard}
          ratings={session.ratings}
          onPractice={onPractice}
          onMinigames={onMinigames}
        />
      )}
    </main>
  );
}
