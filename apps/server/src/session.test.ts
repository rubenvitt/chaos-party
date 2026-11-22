import {
  createMessage,
  MAX_MESSAGE_LENGTH,
  parseServerMessage,
  type ClientMessage,
  type ServerMessage,
} from '@chaos-party/protocol';
import { rotationInfos } from '@chaos-party/minigames/catalog';
import { describe, expect, it } from 'vitest';
import { lobbyBoards } from './boardChoice.ts';
import {
  CLOSE_CODES,
  DEFAULT_TIMEOUTS,
  Session,
  type ConnectionId,
  type Outgoing,
  type SessionOptions,
} from './session.ts';

const CODE = 'ABCD';
const HOST = 100;

function setup(options: Partial<SessionOptions> = {}) {
  let clock = 1000;
  let tokens = 0;
  const session = new Session({
    joinCode: CODE,
    now: () => clock,
    createToken: () => `token-${String(++tokens).padStart(16, '0')}`,
    logError: () => undefined,
    ...options,
  });

  /** Führt ein Ereignis aus und prüft, dass alle ausgehenden Nachrichten schemakonform sind. */
  const check = (out: Outgoing[]): Outgoing[] => {
    for (const action of out) {
      if (action.kind === 'send') {
        const parsed = parseServerMessage(JSON.stringify(action.message));
        expect(parsed.ok, JSON.stringify(action.message)).toBe(true);
      }
    }
    return out;
  };

  const api = {
    session,
    advance(ms: number) {
      clock += ms;
    },
    get clock() {
      return clock;
    },
    connect(id: ConnectionId) {
      return check(session.connect(id));
    },
    raw(id: ConnectionId, text: string) {
      return check(session.message(id, text));
    },
    send(id: ConnectionId, message: ClientMessage | Record<string, unknown>) {
      return check(session.message(id, JSON.stringify(message)));
    },
    disconnect(id: ConnectionId) {
      return check(session.disconnect(id));
    },
    /** Verbindet und tritt bei; liefert die Antworten. */
    join(id: ConnectionId, seats = 1, names?: string[]) {
      api.connect(id);
      return api.send(
        id,
        names
          ? createMessage('join', { joinCode: CODE, seats, names })
          : createMessage('join', { joinCode: CODE, seats }),
      );
    },
    host(id: ConnectionId = HOST) {
      api.connect(id);
      return api.send(id, createMessage('host-hello', {}));
    },
  };
  return api;
}

function to(out: Outgoing[], id: ConnectionId): ServerMessage[] {
  return out.flatMap((action) =>
    action.kind === 'send' && action.to === id ? [action.message] : [],
  );
}

function ofType<T extends ServerMessage['type']>(
  out: Outgoing[],
  id: ConnectionId,
  type: T,
): Extract<ServerMessage, { type: T }>[] {
  return to(out, id).filter(
    (message): message is Extract<ServerMessage, { type: T }> => message.type === type,
  );
}

function errorCodes(out: Outgoing[], id: ConnectionId): string[] {
  return ofType(out, id, 'error').map((error) => error.code);
}

function closes(out: Outgoing[]) {
  return out.filter((action) => action.kind === 'close');
}

function lastLobby(out: Outgoing[]) {
  const lobbies = ofType(out, HOST, 'lobby');
  const lobby = lobbies.at(-1);
  if (!lobby) throw new Error('keine Lobby-Nachricht');
  return lobby;
}

const move = (slot: 1 | 2 | 3 | 4, seq: number, x = 0.5, y = 0) =>
  createMessage('move', { slot, seq, x, y });
const ready = (slot: 1 | 2 | 3 | 4, seq: number) => createMessage('ready', { slot, seq });
const start = () => createMessage('start', { mode: 'arena' });

/** Lobby mit Host und `controllers` iPhones (Slots 1…n), danach Start. */
function playing(controllers = 2) {
  const t = setup();
  t.host();
  for (let id = 1; id <= controllers; id++) t.join(id);
  t.send(HOST, start());
  return t;
}

describe('Session: Beitreten', () => {
  it('vergibt Slot 1, Token und Lobby-Kontext', () => {
    const t = setup();
    const out = t.join(1);
    const [welcome] = ofType(out, 1, 'welcome');
    expect(welcome).toEqual({
      v: 4,
      type: 'welcome',
      sessionToken: 'token-0000000000000001',
      players: [{ slot: 1, color: '#0072B2', label: 'Blau' }],
    });
    expect(ofType(out, 1, 'context')).toEqual([
      {
        v: 4,
        type: 'context',
        slot: 1,
        phase: 'lobby',
        layout: 'lobby',
        actions: ['ready', 'pick-character'],
        lobby: {
          character: null,
          takenCharacters: [],
          takenBy: [],
          rounds: 10,
          board: { id: 'wackelwald', name: 'Wackelwald' },
          lead: true,
          seats: [{ slot: 1, kind: 'human' }],
        },
      },
    ]);
  });

  it('vergibt mehreren Controllern verschiedene Slots', () => {
    const t = setup();
    t.join(1);
    const out = t.join(2);
    expect(ofType(out, 2, 'welcome')[0]?.players.map((p) => p.slot)).toEqual([2]);
    expect(t.session.snapshot().players.map((p) => [p.slot, p.connectionId])).toEqual([
      [1, 1],
      [2, 2],
    ]);
  });

  it('gibt einem geteilten iPad mehrere Slots mit Namen', () => {
    const t = setup();
    t.join(1);
    const out = t.join(2, 2, ['Ana', 'Ben']);
    const welcome = ofType(out, 2, 'welcome')[0];
    expect(welcome?.players).toEqual([
      { slot: 2, color: '#E69F00', label: 'Ana' },
      { slot: 3, color: '#009E73', label: 'Ben' },
    ]);
    expect(ofType(out, 2, 'context').map((c) => c.slot)).toEqual([2, 3]);
  });

  it('füllt nach einem Abbruch die niedrigste freie Lücke nicht doppelt', () => {
    const t = setup();
    t.join(1);
    t.join(2);
    t.disconnect(1);
    // Slot 1 bleibt reserviert (Reconnect), der nächste Join bekommt Slot 3.
    expect(ofType(t.join(3), 3, 'welcome')[0]?.players[0]?.slot).toBe(3);
  });

  it('lehnt falschen Join-Code ab, Verbindung darf es erneut versuchen', () => {
    const t = setup();
    t.connect(1);
    const out = t.send(1, createMessage('join', { joinCode: 'ZZZZ', seats: 1 }));
    expect(errorCodes(out, 1)).toEqual(['bad-join-code']);
    expect(closes(out)).toEqual([]);
    const retry = t.send(1, createMessage('join', { joinCode: CODE, seats: 1 }));
    expect(ofType(retry, 1, 'welcome')).toHaveLength(1);
  });

  it('meldet session-full, wenn nicht genug Plätze frei sind', () => {
    const t = setup();
    t.join(1, 3);
    expect(errorCodes(t.join(2, 2), 2)).toEqual(['session-full']);
    expect(
      ofType(t.send(2, createMessage('join', { joinCode: CODE, seats: 1 })), 2, 'welcome'),
    ).toHaveLength(1);
    expect(errorCodes(t.join(3), 3)).toEqual(['session-full']);
    expect(t.session.snapshot().players).toHaveLength(4);
  });

  it('weist doppelten Join derselben Verbindung ab', () => {
    const t = setup();
    t.join(1);
    const out = t.send(1, createMessage('join', { joinCode: CODE, seats: 1 }));
    expect(errorCodes(out, 1)).toEqual(['bad-message']);
    expect(t.session.snapshot().players).toHaveLength(1);
  });

  it('schließt Verbindungen, deren erste Nachricht kein Handshake ist', () => {
    const t = setup();
    t.connect(1);
    const out = t.send(1, ready(1, 1));
    expect(errorCodes(out, 1)).toEqual(['not-joined']);
    expect(closes(out)).toEqual([
      { kind: 'close', to: 1, code: CLOSE_CODES.notJoined, reason: 'not-joined' },
    ]);
    expect(t.disconnect(1)).toEqual([]);
    expect(t.session.snapshot().connections).toBe(0);
  });

  it('erlaubt keinen Join während des Spiels', () => {
    const t = playing(1);
    expect(errorCodes(t.join(5), 5)).toEqual(['out-of-phase']);
  });

  it('übernimmt joinUrl in die Lobby und prüft Optionen', () => {
    const t = setup({ joinUrl: 'http://192.168.0.2:8787/' });
    expect(lastLobby(t.host()).joinUrl).toBe('http://192.168.0.2:8787/');
    expect(() => new Session({ joinCode: 'ab' })).toThrow(/Join-Code/);
    expect(() => new Session({ joinCode: CODE, joinUrl: 'ftp://x' })).toThrow(/Join-URL/);
  });

  it('übernimmt alternative Join-Links in die Lobby (CHAOS-11) und prüft sie', () => {
    const t = setup({
      joinUrl: 'http://192.168.0.2:8787/?code=ABCD',
      joinUrlAlternatives: ['http://10.0.0.2:8787/?code=ABCD'],
    });
    const lobby = lastLobby(t.host());
    expect(lobby.joinUrlAlternatives).toEqual(['http://10.0.0.2:8787/?code=ABCD']);
    expect('joinUrlAlternatives' in lastLobby(setup().host())).toBe(false);
    expect(
      () => new Session({ joinCode: CODE, joinUrlAlternatives: ['javascript:alert(1)'] }),
    ).toThrow(/alternative/);
  });
});

describe('Session: Host', () => {
  it('sendet nach host-hello sofort die Lobby und bei Änderungen erneut', () => {
    const t = setup();
    expect(lastLobby(t.host())).toEqual({
      v: 4,
      type: 'lobby',
      joinCode: CODE,
      phase: 'lobby',
      players: [],
      settings: {
        rounds: 10,
        roundPresets: [10, 16, 20],
        moreReactionTime: false,
        board: 'wackelwald',
        boards: lobbyBoards(),
        minigames: rotationInfos().map((info) => ({
          id: info.id,
          title: info.title,
          blocked: false,
          favorite: false,
        })),
      },
    });
    expect(lastLobby(t.join(1)).players).toEqual([
      { slot: 1, color: '#0072B2', label: 'Blau', connected: true, ready: false, character: null },
    ]);
  });

  it('weist einen zweiten Host ab; nach Trennung darf ein neuer übernehmen', () => {
    const t = setup();
    t.host(HOST);
    const out = t.host(101);
    expect(errorCodes(out, 101)).toEqual(['host-taken']);
    expect(closes(out)).toEqual([
      { kind: 'close', to: 101, code: CLOSE_CODES.hostTaken, reason: 'host-taken' },
    ]);
    t.disconnect(HOST);
    expect(t.session.snapshot().hostConnected).toBe(false);
    expect(ofType(t.host(102), 102, 'lobby')).toHaveLength(1);
  });

  it('beantwortet wiederholtes host-hello und heartbeat', () => {
    const t = setup();
    t.host();
    expect(ofType(t.send(HOST, createMessage('host-hello', {})), HOST, 'lobby')).toHaveLength(1);
    expect(to(t.send(HOST, createMessage('heartbeat', { t: 42 })), HOST)).toEqual([
      { v: 4, type: 'heartbeat-ack', t: 42 },
    ]);
  });

  it('lässt den Host keine Eingaben senden und Controller nicht starten', () => {
    const t = setup();
    t.host();
    t.join(1);
    expect(errorCodes(t.send(HOST, move(1, 1)), HOST)).toEqual(['bad-message']);
    expect(errorCodes(t.send(1, start()), 1)).toEqual(['bad-message']);
    expect(t.session.phase).toBe('lobby');
  });

  it('startet nur aus der Lobby und nur mit verbundenem Spieler', () => {
    const t = setup();
    t.host();
    expect(errorCodes(t.send(HOST, start()), HOST)).toEqual(['out-of-phase']);
    t.join(1);
    t.join(2, 2);
    const out = t.send(HOST, start());
    expect(t.session.phase).toBe('play');
    expect(lastLobby(out).phase).toBe('play');
    const play = {
      phase: 'play',
      layout: 'joystick-buttons',
      actions: ['move', 'button-a', 'button-b'],
    };
    expect(ofType(out, 1, 'context')).toEqual([{ v: 4, type: 'context', slot: 1, ...play }]);
    expect(ofType(out, 2, 'context').map((c) => [c.slot, c.layout])).toEqual([
      [2, 'joystick-buttons'],
      [3, 'joystick-buttons'],
    ]);
    expect(errorCodes(t.send(HOST, start()), HOST)).toEqual(['out-of-phase']);
  });
});

describe('Session: Eingaben', () => {
  it('markiert ready, schaltet auf wait und meldet es dem Host', () => {
    const t = setup();
    t.host();
    t.join(1);
    const out = t.send(1, ready(1, 1));
    expect(ofType(out, 1, 'context')).toEqual([
      {
        v: 4,
        type: 'context',
        slot: 1,
        phase: 'lobby',
        layout: 'wait',
        actions: ['pick-character'],
        lobby: {
          character: null,
          takenCharacters: [],
          takenBy: [],
          rounds: 10,
          board: { id: 'wackelwald', name: 'Wackelwald' },
          lead: true,
          seats: [{ slot: 1, kind: 'human' }],
        },
      },
    ]);
    expect(lastLobby(out).players[0]?.ready).toBe(true);
    // Wiederholtes ready ist harmlos und erzeugt keinen neuen Kontext.
    expect(to(t.send(1, ready(1, 2)), 1)).toEqual([]);
  });

  it('weist move in der Lobby als out-of-phase ab', () => {
    const t = setup();
    t.host();
    t.join(1);
    const out = t.send(1, move(1, 1));
    expect(ofType(out, 1, 'error')).toEqual([
      { v: 4, type: 'error', code: 'out-of-phase', message: expect.any(String) as string, seq: 1 },
    ]);
    expect(ofType(out, HOST, 'input')).toEqual([]);
  });

  it('leitet move mit Slot und Server-Empfangszeit an den Host weiter', () => {
    const t = playing(2);
    t.advance(16);
    const out = t.send(2, move(2, 1, 0.6, -0.8));
    expect(ofType(out, HOST, 'input')).toEqual([
      {
        v: 4,
        type: 'input',
        intent: { type: 'move', slot: 2, seq: 1, x: 0.6, y: -0.8 },
        at: t.clock,
      },
    ]);
  });

  it('leitet Knöpfe weiter, aber keine nicht angebotenen Aktionen', () => {
    const t = playing(1);
    const press = t.send(1, createMessage('press', { slot: 1, seq: 1, button: 'b' }));
    expect(ofType(press, HOST, 'input')[0]?.intent).toEqual({
      type: 'press',
      slot: 1,
      seq: 1,
      button: 'b',
    });
    const gesture = t.send(1, createMessage('gesture', { slot: 1, seq: 2, kind: 'swipe-up' }));
    expect(errorCodes(gesture, 1)).toEqual(['out-of-phase']);
    expect(ofType(gesture, HOST, 'input')).toEqual([]);
  });

  it('weist fremde Slots ab (Spoofing)', () => {
    const t = playing(2);
    const out = t.send(1, move(2, 1));
    expect(errorCodes(out, 1)).toEqual(['not-your-slot']);
    expect(ofType(out, HOST, 'input')).toEqual([]);
  });

  it('weist veraltete und doppelte Sequenznummern ab, auch slotübergreifend', () => {
    const t = setup();
    t.host();
    t.join(1, 2);
    t.send(HOST, start());
    expect(ofType(t.send(1, move(1, 5)), HOST, 'input')).toHaveLength(1);
    expect(errorCodes(t.send(1, move(1, 5)), 1)).toEqual(['stale-seq']);
    expect(errorCodes(t.send(1, move(2, 3)), 1)).toEqual(['stale-seq']);
    expect(ofType(t.send(1, move(2, 9)), HOST, 'input')[0]?.intent.slot).toBe(2);
  });

  it('verwirft geprüfte Eingaben still, solange kein Host verbunden ist', () => {
    const t = playing(1);
    t.disconnect(HOST);
    expect(t.send(1, move(1, 1))).toEqual([]);
    expect(t.session.snapshot().droppedInputs).toBe(1);
  });

  it('beantwortet heartbeat mit dem Echo der Client-Zeit', () => {
    const t = setup();
    t.join(1);
    t.advance(500);
    expect(to(t.send(1, createMessage('heartbeat', { t: 12.5 })), 1)).toEqual([
      { v: 4, type: 'heartbeat-ack', t: 12.5 },
    ]);
    expect(t.session.snapshot().players[0]?.lastSeenAt).toBe(t.clock);
  });
});

describe('Session: Verbindungsabbruch und Reconnect', () => {
  it('hält den Slot nach Abbruch reserviert und meldet connected:false', () => {
    const t = setup();
    t.host();
    t.join(1);
    const out = t.disconnect(1);
    expect(lastLobby(out).players).toEqual([
      { slot: 1, color: '#0072B2', label: 'Blau', connected: false, ready: false, character: null },
    ]);
  });

  it('stellt mit gültigem Token alle Slots wieder her', () => {
    const t = setup();
    t.host();
    const token = ofType(t.join(1, 2, ['Ana', 'Ben']), 1, 'welcome')[0]?.sessionToken ?? '';
    t.send(1, ready(1, 1));
    t.disconnect(1);

    t.connect(2);
    const out = t.send(2, createMessage('reconnect', { sessionToken: token }));
    expect(ofType(out, 2, 'welcome')[0]).toEqual({
      v: 4,
      type: 'welcome',
      sessionToken: token,
      players: [
        { slot: 1, color: '#0072B2', label: 'Ana' },
        { slot: 2, color: '#E69F00', label: 'Ben' },
      ],
    });
    expect(ofType(out, 2, 'context').map((c) => [c.slot, c.layout])).toEqual([
      [1, 'wait'],
      [2, 'lobby'],
    ]);
    expect(lastLobby(out).players.map((p) => p.connected)).toEqual([true, true]);
    // Neue Verbindung beginnt mit neuem Sequenzwächter.
    expect(errorCodes(t.send(2, ready(2, 0)), 2)).toEqual([]);
  });

  it('schließt eine noch offene alte Verbindung beim Reconnect', () => {
    const t = playing(1);
    const token = 'token-0000000000000001';
    t.connect(7);
    const out = t.send(7, createMessage('reconnect', { sessionToken: token }));
    expect(closes(out)).toEqual([
      { kind: 'close', to: 1, code: CLOSE_CODES.replaced, reason: 'replaced' },
    ]);
    expect(ofType(out, 7, 'context')[0]?.layout).toBe('joystick-buttons');
    expect(ofType(out, HOST, 'lobby')).toHaveLength(1);
    expect(t.send(1, move(1, 1))).toEqual([]);
    expect(ofType(t.send(7, move(1, 1)), HOST, 'input')).toHaveLength(1);
  });

  it('weist unbekannte Tokens ab', () => {
    const t = setup();
    t.connect(1);
    const out = t.send(1, createMessage('reconnect', { sessionToken: 'unbekannt-0123456789abc' }));
    expect(errorCodes(out, 1)).toEqual(['bad-token']);
  });

  it('weist reconnect auf einer bereits beigetretenen Verbindung ab', () => {
    const t = setup();
    t.join(1);
    t.join(2);
    const out = t.send(1, createMessage('reconnect', { sessionToken: 'token-0000000000000002' }));
    expect(errorCodes(out, 1)).toEqual(['bad-message']);
    expect(t.session.snapshot().players[1]?.connectionId).toBe(2);
  });
});

describe('Session: Missbrauchsschutz', () => {
  it('meldet kaputte Nachrichten mit eigenem Code', () => {
    const t = setup();
    t.join(1);
    expect(errorCodes(t.raw(1, '{kaputt'), 1)).toEqual(['bad-message']);
    expect(errorCodes(t.raw(1, ''), 1)).toEqual(['bad-message']);
    expect(errorCodes(t.raw(1, 'x'.repeat(MAX_MESSAGE_LENGTH + 1)), 1)).toEqual(['too-large']);
    expect(errorCodes(t.send(1, { v: 5, type: 'heartbeat', t: 1 }), 1)).toEqual([
      'version-mismatch',
    ]);
    expect(errorCodes(t.send(1, { v: 4, type: 'teleport', slot: 1 }), 1)).toEqual(['bad-message']);
    expect(errorCodes(t.send(1, { ...move(1, 1), playerId: 2 }), 1)).toEqual(['bad-message']);
  });

  it('schließt nach zu vielen ungültigen Nachrichten', () => {
    const t = setup({ maxInvalidMessages: 5 });
    t.join(1);
    let out: Outgoing[] = [];
    for (let i = 0; i < 5; i++) out = t.raw(1, 'nope');
    expect(closes(out)).toEqual([
      { kind: 'close', to: 1, code: CLOSE_CODES.abuse, reason: 'too-many-invalid' },
    ]);
    expect(t.session.snapshot().players[0]?.connected).toBe(false);
  });

  it('lässt 60-Hz-Joystick dauerhaft durch', () => {
    const t = playing(1);
    let inputs = 0;
    for (let seq = 1; seq <= 600; seq++) {
      t.advance(1000 / 60);
      const out = t.send(1, move(1, seq));
      expect(errorCodes(out, 1)).toEqual([]);
      inputs += ofType(out, HOST, 'input').length;
    }
    expect(inputs).toBe(600);
  });

  it('skaliert das Budget mit der Zahl der Slots (iPad mit 4 Spielern)', () => {
    const t = setup();
    t.host();
    t.join(1, 4);
    t.send(HOST, start());
    let seq = 0;
    for (let tick = 0; tick < 300; tick++) {
      t.advance(1000 / 60);
      for (const slot of [1, 2, 3, 4] as const) {
        expect(errorCodes(t.send(1, move(slot, ++seq)), 1)).toEqual([]);
      }
    }
  });

  it('drosselt Fluten, meldet höchstens einen Fehler pro Sekunde und schließt bei Dauerfluten', () => {
    const t = setup();
    t.join(1);
    const heartbeat = createMessage('heartbeat', { t: 0 });
    let acks = 0;
    let limited = 0;
    for (let i = 0; i < 200; i++) {
      const out = t.send(1, heartbeat);
      acks += ofType(out, 1, 'heartbeat-ack').length;
      limited += errorCodes(out, 1).filter((code) => code === 'rate-limited').length;
    }
    // Kapazität 120, ein Token hat der Join verbraucht.
    expect(acks).toBe(119);
    expect(limited).toBe(1);

    // Weiter mit 100/s bei 60/s Budget: einzelne Nachrichten kommen durch, die Flut
    // hält aber an → höchstens ein Fehler pro Sekunde, Trennung nach 5 s.
    const floodStart = t.clock;
    let closed: Outgoing[] = [];
    while (closed.length === 0 && t.clock - floodStart < 10_000) {
      t.advance(10);
      const out = t.send(1, heartbeat);
      limited += errorCodes(out, 1).filter((code) => code === 'rate-limited').length;
      closed = closes(out);
    }
    expect(closed).toEqual([
      { kind: 'close', to: 1, code: CLOSE_CODES.abuse, reason: 'rate-limited' },
    ]);
    expect(t.clock - floodStart).toBeGreaterThanOrEqual(4900);
    expect(t.clock - floodStart).toBeLessThanOrEqual(5100);
    expect(limited).toBeLessThanOrEqual(7);
  });

  it('beendet die Flut-Phase nach einer ruhigen Sekunde', () => {
    const t = setup();
    t.join(1);
    const heartbeat = createMessage('heartbeat', { t: 0 });
    // Alle 2 s ein kurzer Burst über Budget: nie dauerhaft → keine Trennung.
    for (let round = 0; round < 10; round++) {
      for (let i = 0; i < 130; i++) {
        expect(closes(t.send(1, heartbeat))).toEqual([]);
      }
      t.advance(2000);
    }
    expect(t.session.snapshot().connections).toBe(1);
  });

  it('schließt nach zu vielen abgewiesenen Nachrichten insgesamt', () => {
    const t = setup({ rateLimit: { maxRejected: 10 } });
    t.join(1);
    let out: Outgoing[] = [];
    for (let i = 0; i < 130 && closes(out).length === 0; i++) {
      out = t.send(1, createMessage('heartbeat', { t: i }));
    }
    expect(closes(out)[0]?.code).toBe(CLOSE_CODES.abuse);
  });

  it('meldet unerwartete Fehler als internal, ohne abzustürzen', () => {
    const errors: unknown[] = [];
    const t = setup({
      createToken: () => {
        throw new Error('kaputt');
      },
      logError: (error) => errors.push(error),
    });
    t.connect(1);
    const out = t.send(1, createMessage('join', { joinCode: CODE, seats: 1 }));
    expect(errorCodes(out, 1)).toEqual(['internal']);
    expect(errors).toHaveLength(1);
    expect(t.session.snapshot().players).toEqual([]);
  });

  it('ignoriert Nachrichten unbekannter Verbindungen', () => {
    const t = setup();
    expect(t.send(99, createMessage('heartbeat', { t: 0 }))).toEqual([]);
    expect(t.disconnect(99)).toEqual([]);
  });
});

describe('Session: Herzschlag, Timeouts und Token-Politik (CHAOS-12)', () => {
  const tokenOf = (out: Outgoing[], id: ConnectionId) =>
    ofType(out, id, 'welcome')[0]?.sessionToken ?? '';
  const heartbeat = (t = 1) => createMessage('heartbeat', { t });
  const reconnect = (sessionToken: string) => createMessage('reconnect', { sessionToken });
  const joinMessage = () => createMessage('join', { joinCode: CODE, seats: 1 });

  it('nutzt die dokumentierten Standardwerte', () => {
    expect(DEFAULT_TIMEOUTS).toEqual({
      handshakeMs: 5000,
      controllerSilenceMs: 15000,
      hostSilenceMs: 30000,
      lobbyGraceMs: 60000,
      hostReadyMs: 30000,
    });
  });

  it('schließt Verbindungen ohne Handshake nach 5 s', () => {
    const t = setup();
    t.connect(1);
    t.advance(4999);
    expect(t.session.tick()).toEqual([]);
    t.advance(1);
    expect(closes(t.session.tick())).toEqual([
      { kind: 'close', to: 1, code: CLOSE_CODES.handshakeTimeout, reason: 'handshake-timeout' },
    ]);
    expect(t.session.snapshot().connections).toBe(0);
    // Ein späterer Handshake auf der geschlossenen Verbindung wirkt nicht mehr.
    expect(t.send(1, joinMessage())).toEqual([]);
  });

  it('erkennt stille Controller nach 15 s, bricht den Socket ab und meldet connected:false', () => {
    const t = setup();
    t.host();
    t.join(1);
    t.advance(10_000);
    t.send(HOST, heartbeat());
    t.send(1, heartbeat());
    t.advance(14_999);
    t.send(HOST, heartbeat());
    expect(closes(t.session.tick())).toEqual([]);
    t.advance(1);
    const out = t.session.tick();
    expect(closes(out)).toEqual([
      {
        kind: 'close',
        to: 1,
        code: CLOSE_CODES.heartbeatTimeout,
        reason: 'heartbeat-timeout',
        terminate: true,
      },
    ]);
    expect(lastLobby(out).players.map((p) => p.connected)).toEqual([false]);
    expect(t.session.snapshot().players[0]).toMatchObject({
      connected: false,
      disconnectedAt: t.clock,
    });
  });

  it('wertet jede Nachricht als Lebenszeichen, auch ungültige', () => {
    const t = setup();
    t.join(1);
    for (let i = 0; i < 3; i++) {
      t.advance(10_000);
      t.raw(1, 'kaputt');
      expect(closes(t.session.tick())).toEqual([]);
    }
    expect(t.session.snapshot().players[0]?.connected).toBe(true);
  });

  it('gibt einem stillen Host 30 s; danach darf ein neuer Host übernehmen', () => {
    const t = setup();
    t.host();
    t.advance(29_999);
    expect(t.session.tick()).toEqual([]);
    t.connect(101);
    expect(errorCodes(t.send(101, createMessage('host-hello', {})), 101)).toEqual(['host-taken']);
    t.advance(1);
    expect(closes(t.session.tick())).toEqual([
      {
        kind: 'close',
        to: HOST,
        code: CLOSE_CODES.heartbeatTimeout,
        reason: 'heartbeat-timeout',
        terminate: true,
      },
    ]);
    expect(t.session.snapshot().hostConnected).toBe(false);
    t.connect(102);
    expect(ofType(t.send(102, createMessage('host-hello', {})), 102, 'lobby')).toHaveLength(1);
  });

  it('gibt in der Lobby den Slot nach 60 s Trennung frei; das Token wird ungültig', () => {
    const t = setup();
    t.host();
    const token = tokenOf(t.join(1), 1);
    t.join(2);
    t.disconnect(1);
    t.advance(59_999);
    t.send(HOST, heartbeat());
    t.send(2, heartbeat());
    expect(ofType(t.session.tick(), HOST, 'lobby')).toEqual([]);
    t.advance(1);
    const out = t.session.tick();
    expect(lastLobby(out).players.map((p) => p.slot)).toEqual([2]);

    t.connect(3);
    expect(errorCodes(t.send(3, reconnect(token)), 3)).toEqual(['bad-token']);
    // Der Platz ist wieder frei: Ein neuer Spieler bekommt Slot 1 mit neuem Token.
    const [welcome] = ofType(t.send(3, joinMessage()), 3, 'welcome');
    expect(welcome?.players.map((p) => p.slot)).toEqual([1]);
    expect(welcome?.sessionToken).not.toBe(token);
  });

  it('beginnt die Schonfrist nach jedem Reconnect neu', () => {
    const t = setup();
    const token = tokenOf(t.join(1), 1);
    t.disconnect(1);
    t.advance(50_000);
    t.connect(2);
    expect(ofType(t.send(2, reconnect(token)), 2, 'welcome')).toHaveLength(1);
    t.disconnect(2);
    t.advance(50_000);
    t.session.tick();
    t.connect(3);
    expect(ofType(t.send(3, reconnect(token)), 3, 'welcome')).toHaveLength(1);
  });

  it('gibt alle Slots eines iPad-Tokens gemeinsam frei', () => {
    const t = setup();
    t.host();
    t.join(1, 3);
    t.disconnect(1);
    t.advance(60_000);
    t.send(HOST, heartbeat());
    expect(lastLobby(t.session.tick()).players).toEqual([]);
    expect(t.session.snapshot().players).toEqual([]);
  });

  it('hält Slots im Spiel für die ganze Partie reserviert, auch aus der Lobby Getrennte', () => {
    const t = setup();
    t.host();
    const lobbyToken = tokenOf(t.join(1), 1);
    const playToken = tokenOf(t.join(2), 2);
    t.disconnect(1);
    t.send(HOST, start());
    t.disconnect(2);
    for (let i = 0; i < 600; i++) {
      t.advance(1000);
      t.send(HOST, heartbeat());
      t.session.tick();
    }
    expect(t.session.snapshot().players.map((p) => [p.slot, p.connected])).toEqual([
      [1, false],
      [2, false],
    ]);
    t.connect(3);
    const back = t.send(3, reconnect(playToken));
    expect(ofType(back, 3, 'context')[0]).toMatchObject({ slot: 2, layout: 'joystick-buttons' });
    t.connect(4);
    expect(ofType(t.send(4, reconnect(lobbyToken)), 4, 'welcome')).toHaveLength(1);
    // Neue Spieler können im Spiel nicht beitreten (M1).
    t.connect(5);
    expect(errorCodes(t.send(5, joinMessage()), 5)).toEqual(['out-of-phase']);
  });

  it('weist fremde (andere Server-Instanz) und kaputte Tokens ab', () => {
    const other = setup({ createToken: () => 'anderer-server-token-0001' });
    const foreign = tokenOf(other.join(1), 1);
    const t = setup();
    t.join(1);
    t.connect(2);
    expect(errorCodes(t.send(2, reconnect(foreign)), 2)).toEqual(['bad-token']);
    // Kein gültiges Token-Format → Schemafehler.
    expect(errorCodes(t.send(2, { v: 4, type: 'reconnect', sessionToken: 'kurz' }), 2)).toEqual([
      'bad-message',
    ]);
    const script = { v: 4, type: 'reconnect', sessionToken: '<script>alert(1)</script>' };
    expect(errorCodes(t.send(2, script), 2)).toEqual(['bad-message']);
    // Die Verbindung darf es danach noch richtig versuchen.
    expect(ofType(t.send(2, reconnect('token-0000000000000001')), 2, 'welcome')).toHaveLength(1);
  });

  it('beginnt nach einem Reconnect im Spiel mit frischem Sequenzwächter', () => {
    const t = playing(1);
    expect(ofType(t.send(1, move(1, 500)), HOST, 'input')).toHaveLength(1);
    t.disconnect(1);
    t.connect(2);
    t.send(2, reconnect('token-0000000000000001'));
    const out = t.send(2, move(1, 1));
    expect(errorCodes(out, 2)).toEqual([]);
    expect(ofType(out, HOST, 'input')[0]?.intent).toMatchObject({ slot: 1, seq: 1 });
  });

  it('lässt die übernommene alte Verbindung nicht mehr in den Timeout laufen', () => {
    const t = playing(1);
    t.connect(2);
    t.send(2, reconnect('token-0000000000000001'));
    t.advance(10_000);
    t.send(2, heartbeat());
    t.send(HOST, heartbeat());
    t.advance(10_000);
    // Verbindung 1 ist längst ersetzt; nur die neue zählt und ist lebendig.
    expect(closes(t.session.tick())).toEqual([]);
    expect(t.session.snapshot().players[0]).toMatchObject({ connected: true, connectionId: 2 });
  });
});
