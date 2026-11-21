/**
 * JS-Kern des Apple-Hosts (ADR-019 §2, CHAOS-138/139): Session-Server, game-core und Host-Rolle
 * samt headless Minispielen in einem Bündel für JavaScriptCore. Vertrag: `./contract.ts`.
 *
 * - Controller-Verbindungen kommen von Swift (`open/message/closed`) und gehen unverändert an
 *   die `Session` aus `apps/server` (gleiche Prüfungen, Fristen, Rate-Limits).
 * - Die Host-Rolle ist `connectHost` aus `apps/host` an einem Socket im Prozess: `host-hello`,
 *   Herzschlag, `host-ready`, Start und Befehle wie am PC. Minispiele laufen headless
 *   (`./stage.ts`), Ergebnisse gehen über den `ResultSender` des Browser-Hosts zurück.
 */
// Muss das erste Modul bleiben: setzt `setTimeout`, `performance` usw., bevor Babylon lädt.
import { clock } from './install.ts';
import HavokPhysics from '@babylonjs/havok';
import {
  DEFAULT_BOARD,
  DEFAULT_RULES,
  RAPID_FIRE_RULE,
  getBoard,
  withTailwind,
} from '@chaos-party/game-core';
import { getMinigameModule } from '@chaos-party/minigames';
import { ROTATION } from '@chaos-party/minigames/catalog';
import type { HavokInstance, MinigameHud } from '@chaos-party/minigame-sdk/babylon';
import {
  encode,
  type BoardMessage,
  type BoardView,
  type LobbyMessage,
} from '@chaos-party/protocol';
import {
  DEFAULT_TICK_MS,
  Session,
  type ConnectionId,
  type Outgoing,
} from '../../server/src/session.ts';
import { RAPID_FIRE_CHOICES, parseRapidFire } from '../../server/src/rapidFire.ts';
import { eventText, playerName } from '../../host/src/board/texts.ts';
import {
  connectHost,
  type HostConnection,
  type SocketLike,
} from '../../host/src/net/hostConnection.ts';
import { boardOptions } from '../../host/src/lobby/lobbyState.ts';
import { createResultSender } from '../../host/src/net/resultSender.ts';
import {
  intentToMinigameInput,
  minigameStageOf,
  planPlay,
  playDeadline,
  playersFromView,
  remainingPlayMs,
  shownRemainingMs,
  stageKeyOf,
} from '../../host/src/minigame/plan.ts';
import { resultPayload } from '../../host/src/minigame/results.ts';
import { canPause } from '../../host/src/pause/pauseState.ts';
import type {
  BoardState,
  ChaosHostApi,
  ChaosHostInstance,
  ChaosHostInternals,
  ContractPhase,
  HostEnv,
  MinigameState,
  RenderState,
} from './contract.ts';
import { CONFIGURE_PREFIX } from './contract.ts';
import { createBoardDirection } from './boardDirection.ts';
import { createFinaleView } from './finaleView.ts';
import { createSoundTrack } from './soundTrack.ts';
import { minigameLight } from './lightMood.ts';
import { base64url, randomBytes, randomInt, setRandomSource } from './nodeCrypto.ts';
import { parseHostCommand } from './hostCommand.ts';
import {
  infoView,
  introCountdown,
  readyProgress,
  readinessView,
  resultsView,
  scoreboardView,
} from './minigameView.ts';
import { createMinigameSounds } from './minigameSounds.ts';
import { createNoticeTracker } from './notice.ts';
import {
  createHeadlessStage,
  describe,
  PREPARE_BUDGET_MS,
  prepareBudgetMs,
  stageUrgentFor,
  type HeadlessStage,
} from './stage.ts';

const now = clock.now;

/**
 * Aufbau-Budget je `tick` (CHAOS-205, `prepareBudgetMs`): folgt der Dauer des letzten Ticks auf
 * der Kern-Uhr; vor dem ersten Abstand das Budget für 60 Hz.
 */
let prepareBudget = PREPARE_BUDGET_MS;

/**
 * Minispiel-Aufbau über mehrere `tick` verteilen (CHAOS-141): weiter geht es im nächsten `tick`
 * (Zeitgeber der virtuellen Uhr feuern nur dort). Gemessen wird mit der echten Uhr: `Date.now()`
 * hat JavaScriptCore von Haus aus, die virtuelle Uhr steht innerhalb eines `tick`.
 */
const PACING = {
  nextFrame: () =>
    new Promise<void>((resolve) => {
      clock.setTimeout(() => {
        resolve();
      }, 0);
    }),
  now: () => Date.now(),
  get budgetMs() {
    return prepareBudget;
  },
};

/**
 * So viele Zeichen Geometrie (Base64) gibt `renderState` höchstens je Aufruf mit (CHAOS-144):
 * Die Geometrie eines Minispiels kommt so über einige Bilder der Anleitung verteilt.
 */
const GEOMETRY_CHARS_PER_FRAME = 256 * 1024;
/**
 * So viele ms (echte Uhr) kodiert `renderState` bei 60 Hz höchstens Geometrie je Aufruf
 * (CHAOS-141); bei langsamem Takt im selben Verhältnis mehr wie der Aufbau (CHAOS-205).
 */
const GEOMETRY_BUDGET_MS = 2;
/** So lange (ms) bleiben Effekte in `renderState`, damit Swift keinen verpasst. */
const EFFECT_WINDOW_MS = 1_500;

/** So viele Ticker-Meldungen hält `renderState().board.messages`. */
const MAX_MESSAGES = 6;
const OPEN = 1;
const CLOSED = 3;

type HostSocket = SocketLike & { readyState: number };

function loadHavok(wasm: Uint8Array | number[], log: (line: string) => void) {
  const bytes = Uint8Array.from(wasm);
  // Nur synchron: der asynchrone Weg (`WebAssembly.instantiate`) löst in JSC nie auf (Probe).
  const options = {
    print: log,
    printErr: log,
    instantiateWasm(
      imports: WebAssembly.Imports,
      done: (instance: WebAssembly.Instance, module: WebAssembly.Module) => void,
    ) {
      const module = new WebAssembly.Module(bytes);
      const instance = new WebAssembly.Instance(module, imports);
      done(instance, module);
      return instance.exports;
    },
  };
  return (HavokPhysics as unknown as (o: typeof options) => Promise<HavokInstance>)(options);
}

function create(env: HostEnv): ChaosHostInstance {
  const log = (line: string) => {
    env.log(line);
  };
  const toLine = (args: unknown[]) =>
    args.map((a) => (typeof a === 'string' ? a : describe(a))).join(' ');
  // Babylon, Runner und Session loggen über `console`; in JSC landet das sonst nirgends.
  // Ganzes Objekt ersetzen: Ein nacktes Kontext (Tests mit `node:vm`) hat gar kein `console`.
  const write =
    (prefix: string) =>
    (...args: unknown[]) => {
      log(`${prefix}${toLine(args)}`);
    };
  (globalThis as { console: unknown }).console = {
    log: write(''),
    info: write(''),
    debug: write(''),
    warn: write('WARN '),
    error: write('ERROR '),
  };
  setRandomSource((n) => env.randomBytes(n));

  let havok: HavokInstance | null = null;
  loadHavok(env.havokWasm, log).then(
    (instance) => {
      havok = instance;
      log('Havok geladen');
    },
    (error: unknown) => {
      log(`Havok-Fehler: ${describe(error)}`);
    },
  );

  // Schnellfeuer wie `SCHNELLFEUER` am PC (CHAOS-232, CHAOS-90): unbekannt = Standard mit Hinweis.
  const rapidFireParsed = parseRapidFire(env.rapidFire);
  if (rapidFireParsed === undefined) {
    log(
      `Schnellfeuer=${env.rapidFire ?? ''} ignoriert (erlaubt: ${RAPID_FIRE_CHOICES.join(', ')}), Standard an`,
    );
  }
  const rapidFire = rapidFireParsed === undefined ? RAPID_FIRE_RULE : rapidFireParsed;
  const rapidFireValue = env.rapidFire?.trim().toLowerCase();
  const rapidFireChoice =
    rapidFireParsed === undefined || rapidFireValue === undefined || rapidFireValue === ''
      ? 'an'
      : rapidFireValue;
  const baseRules = env.tailwind === true ? withTailwind() : DEFAULT_RULES;

  // `joinUrl` bewusst nicht an die Session: zods URL-Prüfung braucht `URL`, das JSC fehlt. Der
  // QR-Code kommt ohnehin von Swift (`renderState().lobby.joinUrl`).
  const session = new Session({
    joinCode: env.joinCode,
    now,
    createToken: () => randomBytes(24).toString('base64url'),
    randomSeed: () => randomInt(0, 2 ** 31),
    // Rückenwind wie `RUECKENWIND=1` am PC (CHAOS-188); Schnellfeuer wie `SCHNELLFEUER` am PC
    // (CHAOS-90/232, Standard: Ereignis „Schnellfeuer!“, sonst im Finale; `aus` = ohne Regel).
    game: { rules: rapidFire ? { ...baseRules, rapidFire: { ...rapidFire } } : baseRules },
    logError: (error) => {
      log(`Session-Fehler: ${describe(error)}`);
    },
  });

  if (env.tailwind === true) log('Regel Rückenwind an');
  if (env.rapidFire !== undefined) log(`Schnellfeuer ${rapidFireChoice}`);

  // --- Verbindungen ---------------------------------------------------------------------------
  /** Host-Sockets im Prozess; negative IDs kollidieren nie mit denen von Swift. */
  const hostSockets = new Map<ConnectionId, HostSocket>();
  let nextHostId = -1;
  /** Zustellungen an Host bzw. Session; nacheinander abgearbeitet, nie verschachtelt. */
  const inbox: (() => void)[] = [];
  let flushing = false;

  const flush = () => {
    if (flushing) return;
    flushing = true;
    try {
      for (let job = inbox.shift(); job; job = inbox.shift()) {
        try {
          job();
        } catch (error) {
          log(`Fehler: ${describe(error)}`);
        }
      }
    } finally {
      flushing = false;
    }
  };

  const apply = (actions: Outgoing[]) => {
    for (const action of actions) {
      const host = hostSockets.get(action.to);
      if (host) {
        if (action.kind === 'send') {
          const data = encode(action.message);
          inbox.push(() => host.onmessage?.({ data }));
        } else {
          hostSockets.delete(action.to);
          host.readyState = CLOSED;
          inbox.push(() => host.onclose?.({ code: action.code }));
        }
        continue;
      }
      if (action.kind === 'send') env.send(action.to, encode(action.message));
      else env.close(action.to, action.code, action.reason);
    }
  };

  const createHostSocket = (): SocketLike => {
    const id = nextHostId--;
    const socket: HostSocket = {
      readyState: OPEN,
      onopen: null,
      onmessage: null,
      onclose: null,
      onerror: null,
      send(data) {
        inbox.push(() => {
          apply(session.message(id, data));
        });
      },
      close() {
        if (socket.readyState === CLOSED) return;
        socket.readyState = CLOSED;
        hostSockets.delete(id);
        inbox.push(() => {
          apply(session.disconnect(id));
        });
      },
    };
    hostSockets.set(id, socket);
    inbox.push(() => {
      apply(session.connect(id));
      socket.onopen?.({});
    });
    return socket;
  };

  // --- Host-Rolle -----------------------------------------------------------------------------
  let lobby: LobbyMessage | null = null;
  let view: BoardView | null = null;
  let receivedAt = 0;
  let nextEventSeq: number | null = null;
  const messages: string[] = [];
  /** Große Einblendung „Sabotage wird stärker!“ (CHAOS-157). */
  const notices = createNoticeTracker();
  /** Brett-Regie des Browser-Hosts (CHAOS-143): Figurenbahnen, Popups, HUD, Kamera, Klänge. */
  let direction = createBoardDirection();
  let lastDirectionAt: number | null = null;
  let stage: { key: string; headless: HeadlessStage } | null = null;
  /** Minispiel-Klänge (CHAOS-190); IDs laufen über die ganze Lebenszeit des Kerns. */
  const sounds = createMinigameSounds(now);
  const isKnownMinigame = (id: string) => getMinigameModule(id) !== undefined;
  let lastAdvanceAt: number | null = null;
  let lastSessionTickAt = -Infinity;
  /** Kern-Uhr beim letzten `tick` (Tick-Dauer für das Aufbau-Budget, CHAOS-205). */
  let lastTickAt: number | null = null;
  /** Erster `tick`-Wert: Die Uhr des Kerns zählt ab 0 (Session und Host starten bei 0). */
  let clockBase: number | null = null;
  const resultSender = createResultSender({ warn: log });
  /** Finale (CHAOS-145): Trophäenzählung und Siegerbildschirm aus `finalePlan.ts`. */
  const finale = createFinaleView();
  /** `pause`/`resume`-Klang beim Wechsel des Server-Stands (wie `PauseControls`). */
  const pauseSounds = createSoundTrack();
  let wasPaused: boolean | null = null;
  /** Host-Rolle mit der Session verbunden: „Nochmal spielen“ ist nur dann möglich. */
  let hostConnected = false;

  const labelOf = (spaceId: string) =>
    (getBoard(view?.boardId ?? '') ?? DEFAULT_BOARD).spaces.find((s) => s.id === spaceId)?.label;

  const disposeStage = () => {
    if (!stage) return;
    try {
      stage.headless.dispose();
    } catch (error) {
      log(`Minispiel-Entsorgen: ${describe(error)}`);
    }
    stage = null;
    lastAdvanceAt = null;
  };

  /**
   * Bühne knapp (CHAOS-205): noch nicht fertig, und die Anleitung endet in höchstens
   * `PREPARE_URGENT_MS`, wartet auf „Bereit“ (CHAOS-214) oder das Spiel läuft schon
   * (`stageUrgentFor`).
   */
  const stageUrgent = (): boolean => {
    if (!stage || stage.headless.ready || !view) return false;
    return stageUrgentFor(view, receivedAt, now());
  };

  /** Bühne an den neuesten Brett-Stand anpassen (wie `MinigameScreen` im Browser-Host). */
  const syncStage = () => {
    const key = stageKeyOf(view, isKnownMinigame);
    if (stage?.key !== key) {
      disposeStage();
      const module = key && view?.minigame ? getMinigameModule(view.minigame.id) : undefined;
      if (key && view?.minigame && module) {
        if (module.info.physics && !havok) {
          log(`Minispiel ${module.info.id}: Havok noch nicht geladen`);
          return;
        }
        const round = view.minigame.round;
        const plan = planPlay(view, receivedAt, now());
        const headless = createHeadlessStage({
          module,
          players: playersFromView(view),
          seed: view.minigame.seed,
          timeLimitMs: plan.kind === 'play' ? plan.timeLimitMs : module.info.durationMs,
          havok,
          log,
          pacing: PACING,
          now,
          ...(env.debugStageDelayMs === undefined
            ? {}
            : { readyNotBefore: now() + env.debugStageDelayMs }),
          onSound: (id, options) => {
            sounds.play(id, options, key);
          },
          onResult: (result) => {
            log(
              `Minispiel ${result.result.minigameId} fertig nach ${result.elapsedMs} ms` +
                (result.cut
                  ? ' (Frist des Servers, Stand gewertet)'
                  : result.forced
                    ? ' (Laufzeit wertet)'
                    : ''),
            );
            resultSender.submit(resultPayload(result.result, round));
          },
        });
        stage = { key, headless };
        log(`Minispiel ${module.info.id} (Runde ${round}, Seed ${view.minigame.seed}) aufgebaut`);
      }
    }
    if (!stage || !view) return;
    stage.headless.setPaused(view.paused);
    for (const player of view.players) {
      stage.headless.runner.setConnected(player.slot, player.connected);
    }
    if (minigameStageOf(view) === 'play' && planPlay(view, receivedAt, now()).kind === 'play') {
      stage.headless.start();
    }
  };

  const onBoard = (message: BoardMessage) => {
    view = message.view;
    receivedAt = now();
    const fresh =
      nextEventSeq === null
        ? message.events
        : message.events.slice(Math.max(0, nextEventSeq - message.eventSeq));
    nextEventSeq = Math.max(nextEventSeq ?? 0, message.eventSeq + message.events.length);
    for (const event of fresh) {
      const text = eventText(event, view, labelOf);
      if (text) messages.push(text.text);
      notices.push(event, receivedAt, view);
    }
    messages.splice(0, Math.max(0, messages.length - MAX_MESSAGES));
    direction.receive(message);
    resultSender.onView(view);
    syncStage();
  };

  const connection: HostConnection = connectHost(
    'inproc://host',
    {
      onStatus: (status) => {
        log(`Host-Verbindung: ${status}`);
        hostConnected = status === 'connected';
        if (status !== 'connected') resultSender.onDisconnected();
      },
      onLobby: (message) => {
        lobby = message;
        if (message.phase === 'lobby') {
          view = null;
          nextEventSeq = null;
          messages.length = 0;
          notices.clear();
          direction = createBoardDirection();
          disposeStage();
          finale.reset();
          wasPaused = null;
        }
      },
      onBoard,
      onInput: (intent) => {
        const mapped = intentToMinigameInput(intent);
        if (mapped && stage) stage.headless.runner.input(mapped.slot, mapped.input);
      },
      onServerError: (error) => {
        log(`Server-Fehler an Host: ${error.code} ${error.message}`);
        resultSender.onError(error);
      },
      onResultAck: (ack) => {
        log(
          `minigame-result-ack ${ack.minigameId} Runde ${ack.round}: ${ack.accepted ? 'angenommen' : `abgelehnt (${ack.code ?? '?'})`}`,
        );
        resultSender.onAck(ack);
      },
    },
    {
      createSocket: createHostSocket,
      setTimer: (callback, ms) => clock.setTimeout(callback, ms),
      clearTimer: (handle) => {
        clock.clearTimeout(handle as number);
      },
      now,
      wake: null,
      warn: log,
    },
  );
  resultSender.setTransport((result) => connection.sendMinigameResult(result));
  // `host-ready` erst, wenn die App Brett und Figuren geladen hat (CHAOS-142, CHAOS-68); ohne
  // `deferSceneReady` (Harness, Tests) ist der Host sofort bereit.
  if (env.deferSceneReady !== true) connection.setSceneReady(true);
  flush();

  // --- renderState ----------------------------------------------------------------------------
  const contractPhase = (): ContractPhase => {
    if (session.phase !== 'board' || !view) return 'lobby';
    if (view.paused) return 'paused';
    if (view.gamePhase === 'game-results') return 'final';
    return minigameStageOf(view) ? 'minigame' : 'board';
  };

  /** Partie läuft (Brettphase mit Stand); vorher und danach zeigt der Host die Lobby. */
  const inGame = () => session.phase === 'board' && view !== null;
  /** Ein Minispiel ist zu sehen, auch in seiner Pause (dann steht die Brett-Regie). */
  const minigameShown = () => inGame() && view !== null && minigameStageOf(view) !== null;
  const finaleShown = () =>
    inGame() && view?.gamePhase === 'game-results' && (view.ranking?.length ?? 0) > 0;

  const boardState = (current: BoardView): BoardState => {
    const board = getBoard(current.boardId) ?? DEFAULT_BOARD;
    const shown = direction.fields();
    return {
      boardId: board.id,
      round: current.round,
      rounds: current.rounds,
      activeSlot: current.activeSlot,
      spaces: board.spaces.map((space) => ({
        id: space.id,
        x: space.position.x,
        z: space.position.z,
        kind: space.kind,
      })),
      messages: [...messages],
      notice: notices.current(now()),
      ...shown,
    };
  };

  const minigameState = (current: BoardView): MinigameState | null => {
    const minigame = current.minigame;
    const stageName = minigameStageOf(current);
    if (!minigame || !stageName) return null;
    const module = getMinigameModule(minigame.id);
    const headless = stage?.headless;
    const runner = headless?.runner;
    let hud = '';
    let hudData: MinigameHud | null = null;
    if (runner && runner.state !== 'created' && runner.state !== 'preparing') {
      try {
        hudData = runner.hud();
        const scores = hudData.scores
          .map(
            (entry) =>
              `${playerName(current, entry.slot)} ${entry.score}${entry.status ? ` (${entry.status})` : ''}`,
          )
          .join(' · ');
        hud = `${Math.ceil(hudData.remainingMs / 1000)} s · ${scores}${hudData.banner ? ` · ${hudData.banner}` : ''}`;
      } catch (error) {
        hud = `HUD-Fehler: ${describe(error)}`;
      }
    }
    const info = module?.info;
    let scoreboard: MinigameState['scoreboard'] = null;
    if (stageName === 'play') {
      const plan = planPlay(current, receivedAt, now());
      const waiting = plan.kind === 'wait' || !headless?.ready;
      const remaining =
        hudData && !waiting
          ? shownRemainingMs(hudData.remainingMs, current, receivedAt, now())
          : remainingPlayMs(current, receivedAt, now());
      scoreboard = scoreboardView(current, hudData, remaining, plan.kind === 'wait');
    }
    let results: MinigameState['results'] = null;
    if (stageName === 'results') {
      results = resultsView(current, info ?? { scoreUnit: 'Punkte' });
      // Figuren jubeln bzw. schmollen wie im Browser-Host (`stage.celebrate`).
      if (!results.aborted && minigame.placements) headless?.celebrate(minigame.placements);
    }
    return {
      id: minigame.id,
      stage: stageName,
      elapsedMs: runner?.elapsedMs ?? 0,
      bodies: headless?.bodies() ?? [],
      hud,
      ready: headless?.ready ?? false,
      info: info
        ? infoView(info)
        : {
            title: minigame.id,
            tagline: '',
            instructions: [],
            controls: { joystick: null, a: null, b: null },
            scoreUnit: 'Punkte',
          },
      round: minigame.round,
      repeat: minigame.repeat === true,
      countdown: introCountdown(current, receivedAt, now()),
      readiness: readinessView(current),
      camera: headless?.ready ? headless.camera() : null,
      backdrop: headless?.backdrop ?? null,
      figures: headless?.figures() ?? [],
      scoreboard,
      results,
      effects: headless?.effects(now() - EFFECT_WINDOW_MS) ?? [],
      geometry:
        headless?.takeGeometry(
          GEOMETRY_CHARS_PER_FRAME,
          (GEOMETRY_BUDGET_MS * prepareBudget) / PREPARE_BUDGET_MS,
        ) ?? [],
      geometryTotal: headless?.geometryTotal ?? 0,
      sounds: sounds.cues(stageKeyOf(current, isKnownMinigame)),
      light: minigameLight(minigame.round, current.rounds, current.boardId),
    };
  };

  return {
    open(connId) {
      apply(session.connect(connId));
      flush();
    },
    message(connId, text) {
      apply(session.message(connId, text));
      flush();
    },
    closed(connId) {
      apply(session.disconnect(connId));
      flush();
    },
    tick(nowMs) {
      // Beliebige monotone ms-Uhr (z. B. CACurrentMediaTime) wird auf „ab erstem tick“ verschoben;
      // ein Sprung von 0 auf Epoch-ms hielte sonst den Host für 30 s still und würfe ihn raus.
      clockBase ??= nowMs;
      clock.advance(nowMs - clockBase);
      // Aufbau-Budget an die Tick-Dauer koppeln (CHAOS-205); der erste Tick zählt als 60 Hz.
      prepareBudget = prepareBudgetMs(lastTickAt === null ? 0 : now() - lastTickAt, stageUrgent());
      lastTickAt = now();
      if (now() - lastSessionTickAt >= DEFAULT_TICK_MS) {
        lastSessionTickAt = now();
        apply(session.tick());
      }
      flush();
      // Brett-Regie (CHAOS-143): steht, solange ein Minispiel zu sehen ist (wie `BoardStage`),
      // auch in dessen Pause (CHAOS-145).
      direction.advance(lastDirectionAt === null ? 0 : now() - lastDirectionAt, !minigameShown());
      lastDirectionAt = now();
      // Pause-Klang beim Wechsel des Server-Stands, nicht beim ersten Stand (CHAOS-145).
      if (inGame() && view) {
        if (wasPaused !== null && wasPaused !== view.paused) {
          pauseSounds.play(view.paused ? 'pause' : 'resume', now());
        }
        wasPaused = view.paused;
      }
      if (finaleShown() && view) finale.advance(view, now());
      if (stage) {
        const seconds = lastAdvanceAt === null ? 0 : (now() - lastAdvanceAt) / 1000;
        lastAdvanceAt = now();
        try {
          stage.headless.advance(seconds);
          // Ablauf an der Frist des Servers (CHAOS-206): spät gestartetes oder langsam
          // gerechnetes Spiel vorher werten, damit das Ergebnis noch angenommen wird.
          const running = stage.headless.runner.state === 'running';
          if (
            view &&
            playDeadline(view, receivedAt, now(), running) === 'end' &&
            stage.headless.endPlay() &&
            !running
          ) {
            log(`Minispiel ${stage.key}: zu spät fertig, startet nicht mehr`);
          }
        } catch (error) {
          log(`Minispiel-Schritt: ${describe(error)}`);
        }
      }
      // Anleitung: „minigame-start“ und Countdown-Ticks wie `MinigameScreen` (CHAOS-190), in der
      // wartenden Anleitung ein Tick je neuem „Bereit“ (CHAOS-214).
      sounds.observe(
        stageKeyOf(view, isKnownMinigame),
        minigameStageOf(view),
        view ? introCountdown(view, receivedAt, now()) : null,
        readyProgress(view),
      );
      flush();
    },
    renderState() {
      const players = (lobby?.players ?? []).map((player) => ({
        slot: player.slot,
        name: player.label,
        color: player.color,
        connected: player.connected,
        ready: player.ready,
        character: player.character,
      }));
      const state: RenderState = {
        phase: contractPhase(),
        lobby: {
          joinUrl: env.joinUrl,
          joinCode: env.joinCode,
          players,
          settings: lobby
            ? {
                rounds: lobby.settings.rounds,
                roundPresets: [...lobby.settings.roundPresets],
                moreReactionTime: lobby.settings.moreReactionTime ?? false,
                board: lobby.settings.board ?? DEFAULT_BOARD.id,
                boards: boardOptions(lobby.settings).map((option) => ({
                  id: option.id,
                  name: option.name,
                  detail: option.detail,
                  selected: option.selected,
                  random: option.random,
                })),
              }
            : null,
        },
        board: view ? boardState(view) : null,
        minigame: view ? minigameState(view) : null,
        final: finaleShown() ? finale.state(now(), hostConnected) : null,
        pause: {
          paused: inGame() && view?.paused === true,
          canPause: inGame() && canPause(view),
          roundText:
            inGame() && view
              ? `Runde ${String(Math.max(1, view.round))}/${String(view.rounds)}`
              : null,
          sounds: pauseSounds.list(now()),
        },
      };
      return JSON.stringify(state);
    },
    sceneReady() {
      log('Szene geladen: host-ready');
      connection.setSceneReady(true);
      flush();
    },
    hostCommand(cmd) {
      /** `pause`, `resume`, `end-game`, `rematch` nur im passenden Stand (`pauseState.ts`). */
      const commandFits = (type: string) => {
        switch (type) {
          case 'pause':
            return inGame() && canPause(view);
          case 'resume':
            return inGame() && view?.paused === true;
          case 'end-game':
            return inGame() && view?.gamePhase !== 'setup' && view?.gamePhase !== 'game-results';
          case 'rematch':
            return finaleShown();
          default:
            return true;
        }
      };
      const command = parseHostCommand(cmd);
      if (command === null) {
        log(
          `${cmd.startsWith(CONFIGURE_PREFIX) ? 'Ungültiger' : 'Unbekannter'} Host-Befehl: ${cmd}`,
        );
      } else if (command.type === 'configure' && session.phase !== 'lobby') {
        // Der Server lehnte es außerhalb der Lobby ab (`out-of-phase`); gar nicht erst senden.
        log(`Host-Befehl ${cmd} ignoriert: nur in der Lobby`);
      } else if (command.type === 'skip-finale') {
        if (!finaleShown() || !finale.skip()) log(`Host-Befehl ${cmd} ignoriert: kein Finale`);
      } else if (!commandFits(command.type)) {
        // Wie die Knöpfe am PC-Host nur, wenn es passt: Der Server lehnte es sonst ab
        // (`out-of-phase`), und die Fernbedienung drückt man auch in der Lobby (CHAOS-145).
        log(`Host-Befehl ${cmd} ignoriert: passt gerade nicht`);
      } else {
        const sent =
          command.type === 'start' ? connection.sendStart() : connection.sendCommand(command);
        if (!sent) log(`Host-Befehl ${cmd} nicht gesendet (nicht verbunden)`);
      }
      flush();
    },
  };
}

const api: ChaosHostApi = { create };
const internals: ChaosHostInternals = {
  base64url,
  rotation: ROTATION,
  pendingTimers: () => clock.pending(),
};
Object.assign(globalThis, { ChaosHost: api, ChaosHostInternals: internals });
