/**
 * WebSocket-Verbindung des Hosts zum Session-Server (CHAOS-11, ADR-005/ADR-007).
 *
 * Meldet sich mit `host-hello` an, liefert `lobby`-Schnappschüsse, Brett-Schnappschüsse
 * (`board`, M2) und geprüfte Eingaben (`input`) an die App und versucht es nach einer Trennung alle 2 s
 * erneut. Nach dem Wiederverbinden schickt der Server sofort die aktuelle `lobby`
 * (Phase und Spieler), damit ist der Stand wiederhergestellt.
 *
 * Bereitschaft (CHAOS-68): Sobald die App meldet, dass ihre Bühne (Brett bzw. Minispiel samt
 * Figuren) steht (`setSceneReady(true)`), schickt die Verbindung `host-ready` – einmal je
 * Verbindung, nach jedem Wiederverbinden erneut. Erst damit setzt der Server eine Auto-Pause
 * nach Host-Verlust fort; so geht beim Neuladen keine Zeit verloren.
 *
 * Herzschlag (CHAOS-12, ADR-009): alle 5 s `heartbeat`; der Server trennt einen Host
 * nach 30 s Stille. Kommt umgekehrt 15 s lang keine Server-Nachricht (Antworten auf
 * den Herzschlag), gilt die Verbindung als tot und wird neu aufgebaut. Wird die Seite
 * wieder sichtbar, prüft ein sofortiger Herzschlag die Verbindung.
 *
 * Ohne DOM-Abhängigkeit (Socket-Fabrik, Timer und Aufwach-Signale injizierbar), damit
 * Unit-Tests in Node laufen.
 */
import {
  createMessage,
  encode,
  parseServerToHostMessage,
  type AiStrength,
  type BoardMessage,
  type ErrorMessage,
  type GameMode,
  type InputIntent,
  type LobbyMessage,
  type MinigameResultAckMessage,
  type MinigameResultMessage,
  type RatingsMessage,
  type SlotNumber,
  type StartMessage,
} from '@chaos-party/protocol';

/** Inhalt einer `minigame-result`-Nachricht (ohne Umschlag). */
export type MinigameResultPayload = Omit<MinigameResultMessage, 'v' | 'type'>;

/**
 * Steuerbefehle des Hosts (Protokoll v4, ADR-015): Rundenzahl, „Mehr Zeit zum Reagieren“
 * (CHAOS-124), Brett (CHAOS-197) sowie Sperrliste/Favoriten der Minispiele (CHAOS-85) in der Lobby (`configure`, je Befehl mindestens eines davon),
 * Pause/Fortsetzen/vorzeitiges Ende in der Brettphase, Revanche nach dem Endstand.
 */
export type HostCommand =
  | {
      readonly type: 'configure';
      readonly rounds?: number | undefined;
      readonly moreReactionTime?: boolean | undefined;
      /** Brett-Wahl (CHAOS-197): Brett-ID oder `RANDOM_BOARD`. */
      readonly board?: string | undefined;
      /** Sperrliste und Favoriten der Minispiel-Rotation (CHAOS-85), je ganze Liste. */
      readonly minigameBlocklist?: readonly string[] | undefined;
      readonly minigameFavorites?: readonly string[] | undefined;
      /** KI-Platz setzen, ändern oder entfernen (`strength: null`, CHAOS-179). */
      readonly aiSeat?:
        { readonly seat: SlotNumber; readonly strength: AiStrength | null } | undefined;
    }
  | { readonly type: 'pause' }
  | { readonly type: 'resume' }
  | { readonly type: 'end-game' }
  | { readonly type: 'rematch' };

/** Baut die Protokoll-Nachricht zu einem Steuerbefehl. */
export function createHostCommandMessage(command: HostCommand) {
  switch (command.type) {
    case 'configure':
      // Optionale Felder nur setzen, wenn vorhanden (strikte Schemas, exactOptionalPropertyTypes).
      return createMessage('configure', {
        ...(command.rounds === undefined ? {} : { rounds: command.rounds }),
        ...(command.moreReactionTime === undefined
          ? {}
          : { moreReactionTime: command.moreReactionTime }),
        ...(command.board === undefined ? {} : { board: command.board }),
        ...(command.minigameBlocklist === undefined
          ? {}
          : { minigameBlocklist: [...command.minigameBlocklist] }),
        ...(command.aiSeat === undefined ? {} : { aiSeat: { ...command.aiSeat } }),
        ...(command.minigameFavorites === undefined
          ? {}
          : { minigameFavorites: [...command.minigameFavorites] }),
      });
    case 'pause':
      return createMessage('pause', {});
    case 'resume':
      return createMessage('resume', {});
    case 'end-game':
      return createMessage('end-game', {});
    case 'rematch':
      return createMessage('rematch', {});
  }
}

/**
 * - `connecting`: erster Verbindungsversuch läuft
 * - `connected`: als Host angemeldet (erste `lobby` empfangen)
 * - `disconnected`: Server nicht erreichbar oder Verbindung verloren; neuer Versuch alle 2 s
 * - `host-taken`: Ein anderer Host (zweiter Tab/PC) ist bereits verbunden (Close 4002)
 */
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'host-taken';

/** WebSocket-Close-Code des Servers „Host bereits vergeben“ (ADR-005). */
export const CLOSE_HOST_TAKEN = 4002;
export const DEFAULT_RETRY_MS = 2000;
/** Herzschlag des Hosts (CHAOS-12). */
export const HOST_HEARTBEAT_MS = 5000;
/** Ohne Server-Nachricht so lange → Probe-Herzschlag; bleibt auch der unbeantwortet, gilt die Verbindung als tot. */
export const HOST_DEAD_AFTER_MS = 15_000;
/**
 * Nach dem Aufwachen und nach 15 s Stille muss die Antwort auf den Probe-Herzschlag so schnell
 * kommen.
 */
export const HOST_PROBE_TIMEOUT_MS = 2000;

/** Abonniert „Seite wieder sichtbar/Netz zurück“; liefert die Abmeldung. */
export type HostWakeSource = (onWake: () => void) => () => void;

/** Aufwach-Signale des Browsers; `null` außerhalb des Browsers. */
export function browserHostWakeSource(): HostWakeSource | null {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;
  return (onWake) => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') onWake();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', onWake);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', onWake);
    };
  };
}

/** Teilmenge der Browser-WebSocket-API, die wir nutzen. */
export interface SocketLike {
  readonly readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  onopen: ((event: unknown) => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: ((event: { code: number }) => void) | null;
  onerror: ((event: unknown) => void) | null;
}

export interface HostConnectionHandlers {
  onStatus?(status: ConnectionStatus): void;
  onLobby?(lobby: LobbyMessage): void;
  /** Brett-Schnappschuss mit Ereignissen (Phase `board`, M2). */
  onBoard?(board: BoardMessage): void;
  onInput?(intent: InputIntent, at: number): void;
  onServerError?(error: ErrorMessage): void;
  /** Antwort auf ein gesendetes Minispiel-Ergebnis (v4, CHAOS-55). */
  onResultAck?(ack: MinigameResultAckMessage): void;
  /** Daumen-Übersicht für die Minispiel-Galerie (CHAOS-87). */
  onRatings?(ratings: RatingsMessage): void;
}

export interface HostConnectionOptions {
  readonly createSocket?: (url: string) => SocketLike;
  readonly retryMs?: number;
  readonly setTimer?: (callback: () => void, ms: number) => unknown;
  readonly clearTimer?: (handle: unknown) => void;
  readonly heartbeatMs?: number;
  readonly deadAfterMs?: number;
  readonly probeTimeoutMs?: number;
  /** Uhr für `heartbeat.t` (Standard: `performance.now()`). */
  readonly now?: () => number;
  /** Aufwach-Signale; Standard: die des Browsers, `null` schaltet sie ab. */
  readonly wake?: HostWakeSource | null;
  /** Für ungültige Server-Nachrichten (Standard: `console.warn`). */
  readonly warn?: (message: string) => void;
}

/** Was der Start-Knopf schickt: Brettspiel (Standard) oder M1-Arena, optional Rundenzahl. */
export interface StartOptions {
  readonly mode?: GameMode;
  readonly rounds?: number;
  /** Übungsrunde der Minispiel-Galerie (CHAOS-87): Kennung des Minispiels. */
  readonly practice?: string;
}

/** Baut die `start`-Nachricht; fehlende Optionen bleiben weg (Server-Standard). */
export function createStartMessage(options: StartOptions = {}): StartMessage {
  return createMessage('start', {
    ...(options.mode === undefined ? {} : { mode: options.mode }),
    ...(options.rounds === undefined ? {} : { rounds: options.rounds }),
    ...(options.practice === undefined ? {} : { practice: options.practice }),
  });
}

export interface HostConnection {
  readonly status: ConnectionStatus;
  /** Sendet `start`; `false`, wenn gerade keine Verbindung besteht. */
  sendStart(options?: StartOptions): boolean;
  /**
   * Sendet das Ergebnis des laufenden Minispiels (M3); `false`, wenn gerade keine Verbindung
   * besteht. Wiederholung und Einmaligkeit regelt `createResultSender`.
   */
  sendMinigameResult(result: MinigameResultPayload): boolean;
  /** Sendet einen Steuerbefehl (v4); `false`, wenn gerade keine Verbindung besteht. */
  sendCommand(command: HostCommand): boolean;
  /**
   * Bühne geladen ja/nein (CHAOS-68). `true` schickt `host-ready`, sobald verbunden – einmal
   * je Verbindung bzw. erneut nach einem `false` dazwischen.
   */
  setSceneReady(ready: boolean): void;
  /** Trennt endgültig (kein neuer Versuch). */
  close(): void;
}

const CONNECTING = 0;
const OPEN = 1;

export function connectHost(
  url: string,
  handlers: HostConnectionHandlers,
  options: HostConnectionOptions = {},
): HostConnection {
  const createSocket =
    options.createSocket ?? ((target: string) => new WebSocket(target) as unknown as SocketLike);
  const retryMs = options.retryMs ?? DEFAULT_RETRY_MS;
  const setTimer = options.setTimer ?? ((cb: () => void, ms: number) => setTimeout(cb, ms));
  const clearTimer =
    options.clearTimer ??
    ((handle: unknown) => {
      clearTimeout(handle as ReturnType<typeof setTimeout>);
    });
  const warn =
    options.warn ??
    ((message: string) => {
      console.warn(message);
    });
  const heartbeatMs = options.heartbeatMs ?? HOST_HEARTBEAT_MS;
  const deadAfterMs = options.deadAfterMs ?? HOST_DEAD_AFTER_MS;
  const probeTimeoutMs = options.probeTimeoutMs ?? HOST_PROBE_TIMEOUT_MS;
  const now = options.now ?? (() => performance.now());

  let status: ConnectionStatus = 'connecting';
  let socket: SocketLike | undefined;
  let retryTimer: unknown;
  let heartbeatTimer: unknown;
  let watchdogTimer: unknown;
  let closed = false;
  let sceneReady = false;
  /** Verbindung, auf der `host-ready` für den aktuellen Bühnenstand schon ging. */
  let readySentOn: SocketLike | undefined;

  /** `host-ready` senden, wenn die Bühne steht und diese Verbindung es noch nicht hat. */
  const sendReadyIfDue = () => {
    const current = socket;
    if (!sceneReady || status !== 'connected' || current?.readyState !== OPEN) return;
    if (readySentOn === current) return;
    readySentOn = current;
    current.send(encode(createMessage('host-ready', {})));
  };

  const stopLiveness = () => {
    if (heartbeatTimer !== undefined) clearTimer(heartbeatTimer);
    if (watchdogTimer !== undefined) clearTimer(watchdogTimer);
    heartbeatTimer = undefined;
    watchdogTimer = undefined;
  };

  const sendHeartbeat = (current: SocketLike) => {
    if (current.readyState === OPEN) current.send(encode(createMessage('heartbeat', { t: now() })));
  };

  const scheduleHeartbeat = (current: SocketLike) => {
    heartbeatTimer = setTimer(() => {
      heartbeatTimer = undefined;
      if (socket !== current) return;
      sendHeartbeat(current);
      scheduleHeartbeat(current);
    }, heartbeatMs);
  };

  /**
   * Ohne Server-Nachricht innerhalb von `ms` wird geprüft: erst ein Probe-Herzschlag, und erst
   * wenn auch darauf binnen `probeTimeoutMs` nichts kommt, gilt die Verbindung als tot
   * (`probe`). Grund (CHAOS-41): Stand der Hauptthread der Seite selbst still (Shader-Übersetzung
   * bei Software-Rendering, gemessen bis 14 s am Stück), liegen die Antworten des Servers schon
   * ungelesen in der Warteschlange, wenn der Wachhund feuert. Ohne Probe riss der Host eine
   * lebende Verbindung ab, und ein gerade geklickter Befehl („Nochmal spielen“) ging verloren.
   */
  const armWatchdog = (current: SocketLike, ms: number, probe = false) => {
    if (watchdogTimer !== undefined) clearTimer(watchdogTimer);
    watchdogTimer = setTimer(() => {
      watchdogTimer = undefined;
      if (socket !== current) return;
      if (!probe) {
        sendHeartbeat(current);
        armWatchdog(current, probeTimeoutMs, true);
        return;
      }
      warn('Server antwortet nicht mehr – verbinde neu');
      // Wie ein Close behandeln; den alten Socket abkoppeln, damit sein spätes `onclose` nichts tut.
      socket = undefined;
      current.onclose = null;
      current.onmessage = null;
      current.close(1000, 'Host: keine Antwort');
      lost(1006);
    }, ms);
  };

  /** Verbindung weg: Status setzen, Herzschlag stoppen, neuen Versuch planen. */
  const lost = (code: number) => {
    stopLiveness();
    if (closed) return;
    setStatus(code === CLOSE_HOST_TAKEN ? 'host-taken' : 'disconnected');
    scheduleRetry();
  };

  const setStatus = (next: ConnectionStatus) => {
    if (next === status) return;
    status = next;
    handlers.onStatus?.(next);
  };

  const scheduleRetry = () => {
    if (closed || retryTimer !== undefined) return;
    retryTimer = setTimer(() => {
      retryTimer = undefined;
      open();
    }, retryMs);
  };

  function open() {
    if (closed) return;
    let current: SocketLike;
    try {
      current = createSocket(url);
    } catch (error) {
      warn(`Server-Verbindung fehlgeschlagen: ${String(error)}`);
      if (status === 'connected') setStatus('disconnected');
      scheduleRetry();
      return;
    }
    socket = current;

    current.onopen = () => {
      if (socket !== current) return;
      // Als verbunden gilt der Host erst mit dem ersten `lobby`: Ist schon ein anderer
      // Host da, schließt der Server sofort mit 4002, ohne Lobby.
      current.send(encode(createMessage('host-hello', {})));
      scheduleHeartbeat(current);
      armWatchdog(current, deadAfterMs);
    };
    current.onmessage = (event) => {
      if (socket !== current) return;
      // Jede Server-Nachricht (auch eine ungültige) beweist, dass die Verbindung lebt.
      armWatchdog(current, deadAfterMs);
      if (typeof event.data !== 'string') return;
      const parsed = parseServerToHostMessage(event.data);
      if (!parsed.ok) {
        warn(`Ungültige Server-Nachricht ignoriert: ${parsed.error.message}`);
        return;
      }
      const message = parsed.message;
      switch (message.type) {
        case 'lobby':
          setStatus('connected');
          handlers.onLobby?.(message);
          sendReadyIfDue();
          break;
        case 'board':
          // Kommt nur nach angenommenem `host-hello`; zählt wie `lobby` als verbunden.
          setStatus('connected');
          handlers.onBoard?.(message);
          sendReadyIfDue();
          break;
        case 'input':
          handlers.onInput?.(message.intent, message.at);
          break;
        case 'error':
          handlers.onServerError?.(message);
          break;
        case 'minigame-result-ack':
          handlers.onResultAck?.(message);
          break;
        case 'ratings':
          handlers.onRatings?.(message);
          break;
        case 'heartbeat-ack':
          break;
      }
    };
    current.onerror = () => {
      // Der Browser meldet Details selbst; `onclose` folgt immer und plant den neuen Versuch.
    };
    current.onclose = (event) => {
      if (socket !== current) return;
      socket = undefined;
      lost(event.code);
    };
  }

  /** Seite wieder sichtbar: Verbindung prüfen bzw. sofort neu versuchen statt zu warten. */
  const wake = () => {
    if (closed) return;
    if (socket?.readyState === OPEN) {
      sendHeartbeat(socket);
      armWatchdog(socket, probeTimeoutMs, true);
      return;
    }
    if (socket === undefined && retryTimer !== undefined) {
      clearTimer(retryTimer);
      retryTimer = undefined;
      open();
    }
  };
  const wakeSource = options.wake === undefined ? browserHostWakeSource() : options.wake;
  const stopWake = wakeSource?.(wake);

  open();

  return {
    get status() {
      return status;
    },
    sendStart(options) {
      if (socket?.readyState !== OPEN || status !== 'connected') return false;
      socket.send(encode(createStartMessage(options)));
      return true;
    },
    sendMinigameResult(result) {
      if (socket?.readyState !== OPEN || status !== 'connected') return false;
      socket.send(encode(createMessage('minigame-result', result)));
      return true;
    },
    sendCommand(command) {
      if (socket?.readyState !== OPEN || status !== 'connected') return false;
      socket.send(encode(createHostCommandMessage(command)));
      return true;
    },
    setSceneReady(ready) {
      sceneReady = ready;
      if (!ready) {
        readySentOn = undefined;
        return;
      }
      sendReadyIfDue();
    },
    close() {
      closed = true;
      stopLiveness();
      stopWake?.();
      if (retryTimer !== undefined) {
        clearTimer(retryTimer);
        retryTimer = undefined;
      }
      const current = socket;
      socket = undefined;
      if (!current) return;
      if (current.readyState === CONNECTING) {
        // Ein Schließen während des Aufbaus meldet Chrome als Konsolenfehler („closed before
        // the connection is established“) – passiert z. B. im React-StrictMode bei jedem
        // Mount. Deshalb erst nach dem Öffnen schließen, ohne `host-hello` zu senden.
        current.onopen = () => {
          current.close(1000, 'Host beendet');
        };
        current.onmessage = null;
        return;
      }
      current.close(1000, 'Host beendet');
    },
  };
}
