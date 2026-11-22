import {
  createMessage,
  encode,
  parseHostMessage,
  parseServerToHostMessage,
} from '@chaos-party/protocol';
import { createDemoMessages } from '../board/demo.ts';
import { describe, expect, it, vi } from 'vitest';
import {
  CLOSE_HOST_TAKEN,
  connectHost,
  createHostCommandMessage,
  createStartMessage,
  type HostCommand,
  type ConnectionStatus,
  type HostConnectionHandlers,
  type SocketLike,
} from './hostConnection.ts';

class FakeSocket implements SocketLike {
  readyState = 0;
  readonly sent: string[] = [];
  closedWith: number | undefined;
  onopen: ((event: unknown) => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;

  constructor(readonly url: string) {}

  send(data: string) {
    this.sent.push(data);
  }
  close(code?: number) {
    this.closedWith = code;
    this.readyState = 3;
  }
  // Steuerung durch den Test
  open() {
    this.readyState = 1;
    this.onopen?.({});
  }
  receive(data: unknown) {
    this.onmessage?.({ data });
  }
  drop(code = 1006) {
    this.readyState = 3;
    this.onclose?.({ code });
  }
}

const LOBBY = createMessage('lobby', {
  joinCode: 'AB12',
  joinUrl: 'http://192.168.0.2:8787/?code=AB12',
  phase: 'lobby',
  players: [
    { slot: 1, color: '#0072B2', label: 'Blau', connected: true, ready: false, character: null },
  ],
  settings: { rounds: 5, roundPresets: [3, 5, 8] },
});

function setup(handlers: HostConnectionHandlers = {}) {
  const sockets: FakeSocket[] = [];
  const timers: { cb: () => void; ms: number; cleared: boolean }[] = [];
  const statuses: ConnectionStatus[] = [];
  const warnings: string[] = [];
  let wakeListener: (() => void) | null = null;
  const connection = connectHost(
    'ws://pc:8787/ws',
    {
      onStatus: (s) => statuses.push(s),
      ...handlers,
    },
    {
      createSocket: (url) => {
        const socket = new FakeSocket(url);
        sockets.push(socket);
        return socket;
      },
      setTimer: (cb, ms) => {
        const timer = { cb, ms, cleared: false };
        timers.push(timer);
        return timer;
      },
      // Gelöschte Timer fallen aus der Liste: `timers` enthält nur noch geplante.
      clearTimer: (handle) => {
        const timer = handle as { cleared: boolean };
        timer.cleared = true;
        const index = timers.indexOf(timer as (typeof timers)[number]);
        if (index >= 0) timers.splice(index, 1);
      },
      now: () => 42,
      wake: (listener) => {
        wakeListener = listener;
        return () => {
          wakeListener = null;
        };
      },
      warn: (message) => warnings.push(message),
    },
  );
  const last = () => {
    const socket = sockets.at(-1);
    if (!socket) throw new Error('kein Socket');
    return socket;
  };
  const fireTimers = () => {
    for (const timer of timers.splice(0)) if (!timer.cleared) timer.cb();
  };
  /** Nur die Timer mit dieser Dauer auslösen (Herzschlag 5000, Wachhund 15000/2000, Retry 2000). */
  const fire = (ms: number) => {
    for (const timer of timers.filter((t) => t.ms === ms)) {
      timers.splice(timers.indexOf(timer), 1);
      timer.cb();
    }
  };
  const wake = () => {
    wakeListener?.();
  };
  const hasWakeListener = () => wakeListener !== null;
  return {
    connection,
    sockets,
    timers,
    statuses,
    warnings,
    last,
    fireTimers,
    fire,
    wake,
    hasWakeListener,
  };
}

describe('connectHost', () => {
  it('meldet sich mit host-hello an und gilt mit der ersten Lobby als verbunden', () => {
    const onLobby = vi.fn();
    const t = setup({ onLobby });
    expect(t.connection.status).toBe('connecting');
    t.last().open();
    expect(t.last().sent).toEqual([encode(createMessage('host-hello', {}))]);
    expect(t.connection.status).toBe('connecting');
    t.last().receive(encode(LOBBY));
    expect(t.connection.status).toBe('connected');
    expect(onLobby).toHaveBeenCalledWith(LOBBY);
    expect(t.statuses).toEqual(['connected']);
  });

  it('reicht geprüfte Eingaben und Fehler weiter', () => {
    const onInput = vi.fn();
    const onServerError = vi.fn();
    const t = setup({ onInput, onServerError });
    t.last().open();
    const intent = { type: 'move', slot: 2, seq: 4, x: 0.5, y: 0 } as const;
    t.last().receive(encode(createMessage('input', { intent, at: 1234 })));
    expect(onInput).toHaveBeenCalledWith(intent, 1234);
    t.last().receive(encode(createMessage('error', { code: 'out-of-phase', message: 'nein' })));
    expect(onServerError).toHaveBeenCalledOnce();
  });

  it('ignoriert ungültige und binäre Nachrichten mit Warnung', () => {
    const onInput = vi.fn();
    const t = setup({ onInput });
    t.last().open();
    t.last().receive('{"v":4,"type":"input","intent":{"type":"move","slot":9}}');
    t.last().receive(new ArrayBuffer(4));
    t.last().receive(encode(createMessage('feedback', { slot: 1, kind: 'hit' })));
    expect(onInput).not.toHaveBeenCalled();
    expect(t.warnings).toHaveLength(2);
  });

  it('versucht es nach einer Trennung alle 2 s erneut', () => {
    const t = setup();
    t.last().open();
    t.last().receive(encode(LOBBY));
    t.last().drop();
    expect(t.connection.status).toBe('disconnected');
    expect(t.timers).toHaveLength(1);
    expect(t.timers[0]?.ms).toBe(2000);
    t.fireTimers();
    expect(t.sockets).toHaveLength(2);
    // Server weiterhin weg: nächster Versuch wird geplant, Status bleibt getrennt.
    t.last().drop();
    expect(t.timers).toHaveLength(1);
    t.fireTimers();
    t.last().open();
    t.last().receive(encode(LOBBY));
    expect(t.connection.status).toBe('connected');
    expect(t.statuses).toEqual(['connected', 'disconnected', 'connected']);
  });

  it('erkennt einen bereits verbundenen anderen Host (4002) und wartet', () => {
    const t = setup();
    t.last().open();
    t.last().drop(CLOSE_HOST_TAKEN);
    expect(t.connection.status).toBe('host-taken');
    expect(t.timers).toHaveLength(1);
  });

  it('sendet start nur, wenn verbunden', () => {
    const t = setup();
    expect(t.connection.sendStart()).toBe(false);
    t.last().open();
    expect(t.connection.sendStart()).toBe(false);
    t.last().receive(encode(LOBBY));
    expect(t.connection.sendStart()).toBe(true);
    expect(t.last().sent.at(-1)).toBe(encode(createMessage('start', {})));
  });

  it('sendet minigame-result nur, wenn verbunden, protokollgültig (M3)', () => {
    const t = setup();
    const result = {
      minigameId: 'pump-parade',
      round: 2,
      placements: [
        { slot: 1 as const, place: 1, score: 7 },
        { slot: 2 as const, place: 2, score: 3 },
      ],
      highlights: ['Blau pumpt wie wild'],
    };
    expect(t.connection.sendMinigameResult(result)).toBe(false);
    t.last().open();
    expect(t.connection.sendMinigameResult(result)).toBe(false);
    t.last().receive(encode(LOBBY));
    expect(t.connection.sendMinigameResult(result)).toBe(true);
    const sent: unknown = JSON.parse(t.last().sent.at(-1) ?? '');
    expect(sent).toEqual({ v: 4, type: 'minigame-result', ...result });
    t.last().drop();
    expect(t.connection.sendMinigameResult(result)).toBe(false);
  });

  it('meldet den Hinweis eines Abschnitts und wiederholt den letzten nach Neuverbinden (CHAOS-231)', () => {
    const t = setup();
    const cue = {
      minigameId: 'schnellfeuer',
      round: 3,
      cue: {
        step: 0,
        steps: 5,
        icon: '⏰',
        word: 'HAUEN!',
        controls: { joystick: null, a: 'Hauen', b: null },
        double: false,
      },
    };
    const cues = () => t.last().sent.filter((m) => m.includes('"minigame-cue"'));
    // Ohne Verbindung gemerkt, mit dem ersten Stand gesendet.
    expect(t.connection.sendMinigameCue(cue)).toBe(false);
    t.last().open();
    t.last().receive(encode(LOBBY));
    expect(cues()).toHaveLength(1);
    const sent = parseHostMessage(cues()[0] ?? '');
    expect(sent).toEqual({ ok: true, message: { v: 4, type: 'minigame-cue', ...cue } });
    // Weitere Stände: nicht doppelt; neuer Hinweis sofort.
    t.last().receive(encode(LOBBY));
    expect(cues()).toHaveLength(1);
    expect(t.connection.sendMinigameCue({ ...cue, cue: null })).toBe(true);
    expect(cues()).toHaveLength(2);
    // Neue Verbindung: der letzte Hinweis (hier `null`) kommt noch einmal.
    t.last().drop();
    t.fire(2000);
    t.last().open();
    t.last().receive(encode(LOBBY));
    expect(cues()).toEqual([encode(createMessage('minigame-cue', { ...cue, cue: null }))]);
  });

  it('sendet start mit Modus und Rundenzahl (M2)', () => {
    const t = setup();
    t.last().open();
    t.last().receive(encode(LOBBY));
    expect(t.connection.sendStart({ mode: 'arena' })).toBe(true);
    expect(JSON.parse(t.last().sent.at(-1) ?? '')).toEqual({ v: 4, type: 'start', mode: 'arena' });
    expect(t.connection.sendStart({ mode: 'board', rounds: 3 })).toBe(true);
    expect(JSON.parse(t.last().sent.at(-1) ?? '')).toEqual({
      v: 4,
      type: 'start',
      mode: 'board',
      rounds: 3,
    });
  });

  it('sendet Steuerbefehle (v4) nur, wenn verbunden, protokollgültig', () => {
    const t = setup();
    expect(t.connection.sendCommand({ type: 'pause' })).toBe(false);
    t.last().open();
    t.last().receive(encode(LOBBY));
    const commands: HostCommand[] = [
      { type: 'configure', rounds: 8 },
      { type: 'configure', moreReactionTime: true },
      { type: 'configure', rounds: 10, moreReactionTime: false },
      { type: 'configure', board: 'zufall' },
      { type: 'pause' },
      { type: 'resume' },
      { type: 'end-game' },
      { type: 'rematch' },
    ];
    for (const command of commands) {
      expect(t.connection.sendCommand(command)).toBe(true);
      const raw = t.last().sent.at(-1) ?? '';
      expect(JSON.parse(raw)).toEqual({ v: 4, ...command });
      expect(parseHostMessage(raw).ok).toBe(true);
    }
    expect(createHostCommandMessage({ type: 'configure', rounds: 3 })).toEqual(
      createMessage('configure', { rounds: 3 }),
    );
    // Fehlende Felder fehlen auch in der Nachricht (strikte Schemas, CHAOS-124).
    expect(
      createHostCommandMessage({ type: 'configure', moreReactionTime: true, rounds: undefined }),
    ).toEqual(createMessage('configure', { moreReactionTime: true }));
    expect(createHostCommandMessage({ type: 'configure', board: 'wackelwald' })).toEqual(
      createMessage('configure', { board: 'wackelwald' }),
    );
    // Sperrliste und Favoriten (CHAOS-85).
    expect(
      createHostCommandMessage({
        type: 'configure',
        minigameBlocklist: ['sockenregen'],
        minigameFavorites: [],
      }),
    ).toEqual(
      createMessage('configure', { minigameBlocklist: ['sockenregen'], minigameFavorites: [] }),
    );
    t.last().drop();
    expect(t.connection.sendCommand({ type: 'resume' })).toBe(false);
  });

  it('reicht minigame-result-ack weiter (CHAOS-55)', () => {
    const onResultAck = vi.fn();
    const t = setup({ onResultAck });
    t.last().open();
    const ack = createMessage('minigame-result-ack', {
      minigameId: 'pump-parade',
      round: 2,
      accepted: false,
      code: 'invalid-result',
    });
    t.last().receive(encode(ack));
    expect(onResultAck).toHaveBeenCalledWith(ack);
  });

  it('createStartMessage lässt fehlende Optionen weg und bleibt protokollgültig', () => {
    expect(createStartMessage()).toEqual(createMessage('start', {}));
    expect(createStartMessage({ rounds: 5 })).toEqual(createMessage('start', { rounds: 5 }));
    expect(Object.keys(createStartMessage({ mode: 'board' }))).toEqual(['v', 'type', 'mode']);
  });

  it('meldet host-ready, sobald die Bühne steht – einmal je Verbindung (CHAOS-68)', () => {
    const t = setup();
    const ready = encode(createMessage('host-ready', {}));
    const readyCount = () => t.last().sent.filter((m) => m === ready).length;
    // Bühne fertig, bevor die Verbindung steht: nichts senden.
    t.connection.setSceneReady(true);
    t.last().open();
    expect(readyCount()).toBe(0);
    // Erster Stand vom Server → verbunden → host-ready (protokollgültig, Host-Nachricht).
    t.last().receive(encode(LOBBY));
    expect(readyCount()).toBe(1);
    expect(parseHostMessage(ready)).toEqual({ ok: true, message: createMessage('host-ready', {}) });
    // Weitere Stände und erneutes true: nicht noch einmal.
    t.last().receive(encode(LOBBY));
    t.connection.setSceneReady(true);
    expect(readyCount()).toBe(1);
    // Bühne wird neu gebaut (Minispiel ↔ Brett): nach dem Laden wieder melden.
    t.connection.setSceneReady(false);
    expect(readyCount()).toBe(1);
    t.connection.setSceneReady(true);
    expect(readyCount()).toBe(2);
    // Wiederverbinden mit stehender Bühne: sofort nach dem ersten Stand melden.
    t.last().drop();
    t.fire(2000);
    t.last().open();
    expect(t.last().sent).toEqual([encode(createMessage('host-hello', {}))]);
    t.last().receive(encode(LOBBY));
    expect(readyCount()).toBe(1);
  });

  it('meldet host-ready erst, wenn die Bühne nach dem Verbinden fertig wird (Neuladen)', () => {
    const t = setup();
    const ready = encode(createMessage('host-ready', {}));
    t.last().open();
    t.last().receive(encode(LOBBY));
    expect(t.last().sent).not.toContain(ready);
    t.connection.setSceneReady(true);
    expect(t.last().sent.at(-1)).toBe(ready);
  });

  it('reicht board-Nachrichten weiter und gilt damit als verbunden', () => {
    const boards: unknown[] = [];
    const t = setup({ onBoard: (board) => boards.push(board) });
    t.last().open();
    const [first] = createDemoMessages();
    if (!first) throw new Error('Demo fehlt');
    t.last().receive(encode(first));
    expect(boards).toEqual([first]);
    expect(t.connection.status).toBe('connected');
    // Ungültige board-Nachricht (unbekanntes Feld) wird ignoriert.
    t.last().receive(JSON.stringify({ ...first, extra: 1 }));
    expect(boards).toHaveLength(1);
    expect(parseServerToHostMessage(encode(first)).ok).toBe(true);
  });

  it('close() trennt endgültig ohne neuen Versuch', () => {
    const t = setup();
    t.last().open();
    t.last().drop();
    const retry = t.timers[0];
    t.connection.close();
    expect(retry?.cleared).toBe(true);
    expect(t.hasWakeListener()).toBe(false);
    t.fireTimers();
    expect(t.sockets).toHaveLength(1);

    const u = setup();
    u.last().open();
    u.connection.close();
    expect(u.last().closedWith).toBe(1000);
    u.last().drop();
    expect(u.timers).toHaveLength(0);
  });

  it('schließt einen Socket im Aufbau erst nach dem Öffnen (keine Browser-Fehlermeldung)', () => {
    const t = setup();
    const socket = t.last();
    t.connection.close();
    expect(socket.closedWith).toBeUndefined();
    socket.open();
    expect(socket.closedWith).toBe(1000);
    expect(socket.sent).toEqual([]);
  });

  it('sendet alle 5 s einen Herzschlag, solange die Verbindung offen ist', () => {
    const t = setup();
    t.last().open();
    t.last().receive(encode(LOBBY));
    t.fire(5000);
    t.fire(5000);
    const heartbeat = encode(createMessage('heartbeat', { t: 42 }));
    expect(t.last().sent.filter((m) => m === heartbeat)).toHaveLength(2);
    t.last().drop();
    expect(t.timers.map((timer) => timer.ms)).toEqual([2000]);
  });

  it('gilt nach 15 s ohne Server-Nachricht und unbeantworteter Probe als getrennt und verbindet neu (CHAOS-12, CHAOS-41)', () => {
    const t = setup();
    t.last().open();
    t.last().receive(encode(LOBBY));
    // Jede Nachricht stellt den Wachhund neu.
    t.last().receive(encode(createMessage('heartbeat-ack', { t: 42 })));
    expect(t.timers.filter((timer) => timer.ms === 15_000)).toHaveLength(1);
    const dead = t.last();
    t.fire(15_000);
    // Erst eine Probe (2 s), noch verbunden.
    expect(dead.closedWith).toBeUndefined();
    expect(t.connection.status).toBe('connected');
    t.fire(2000);
    expect(dead.closedWith).toBe(1000);
    expect(t.connection.status).toBe('disconnected');
    expect(t.warnings.at(-1)).toContain('antwortet nicht');
    // Ein spätes `onclose` des alten Sockets plant keinen zweiten Versuch.
    dead.drop();
    expect(t.timers.map((timer) => timer.ms)).toEqual([2000]);
    t.fire(2000);
    expect(t.sockets).toHaveLength(2);
    t.last().open();
    t.last().receive(encode(LOBBY));
    expect(t.statuses).toEqual(['connected', 'disconnected', 'connected']);
  });

  it('eigener Stillstand: nach 15 s Stille erst Probe; wartende Antwort hält die Verbindung', () => {
    const t = setup();
    t.last().open();
    t.last().receive(encode(LOBBY));
    const live = t.last();
    // Hauptthread stand still: Der Wachhund feuert, die Antworten des Servers liegen noch
    // ungelesen in der Warteschlange.
    t.fire(15_000);
    expect(live.closedWith).toBeUndefined();
    expect(t.connection.status).toBe('connected');
    expect(live.sent.at(-1)).toBe(encode(createMessage('heartbeat', { t: 42 })));
    expect(t.timers.filter((timer) => timer.ms === 2000)).toHaveLength(1);
    // Die wartende Nachricht kommt an: Verbindung lebt, normaler Wachhund wieder scharf.
    live.receive(encode(createMessage('heartbeat-ack', { t: 42 })));
    expect(t.timers.filter((timer) => timer.ms === 2000)).toHaveLength(0);
    expect(t.timers.filter((timer) => timer.ms === 15_000)).toHaveLength(1);
    expect(t.sockets).toHaveLength(1);
    expect(t.warnings).toEqual([]);
  });

  it('Seite wieder sichtbar: Probe-Herzschlag; ohne Antwort nach 2 s neu verbinden', () => {
    const t = setup();
    t.last().open();
    t.last().receive(encode(LOBBY));
    t.wake();
    expect(t.last().sent.at(-1)).toBe(encode(createMessage('heartbeat', { t: 42 })));
    t.fire(2000);
    expect(t.connection.status).toBe('disconnected');
    // Während der Wartezeit sichtbar geworden: sofort neu versuchen.
    t.wake();
    expect(t.sockets).toHaveLength(2);
    expect(t.timers.filter((timer) => timer.ms === 2000)).toHaveLength(0);
  });

  it('plant einen neuen Versuch, wenn schon das Anlegen des Sockets scheitert', () => {
    const timers: (() => void)[] = [];
    let attempts = 0;
    const connection = connectHost(
      'ws://pc/ws',
      {},
      {
        createSocket: () => {
          attempts++;
          throw new Error('kaputt');
        },
        setTimer: (cb) => timers.push(cb),
        wake: null,
        warn: () => undefined,
      },
    );
    expect(attempts).toBe(1);
    expect(timers).toHaveLength(1);
    connection.close();
  });
});
