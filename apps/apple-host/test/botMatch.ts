/**
 * Bot-Partie gegen das gebaute Bündel in einem nackten `node:vm`-Kontext (CHAOS-139): ohne
 * `setTimeout`, `performance`, `structuredClone`, `console`, `URL` – so nah an JavaScriptCore,
 * wie es ohne Mac geht. Gleicher Ablauf wie der Swift-Harness (`../harness/main.swift`):
 * Controller mit echten Protokoll-Nachrichten, virtuelle Uhr mit 60 Ticks je Spielsekunde,
 * `renderState` wird gegen den Vertrag geprüft.
 *
 * Für Vitest (`bundle.test.ts`) und die Kommandozeile (`pnpm --filter @chaos-party/apple-host bots`).
 */
import { setImmediate as nextMacrotask } from 'node:timers/promises';
import { createContext, runInContext } from 'node:vm';
import {
  RenderStateSchema,
  type ChaosHostApi,
  type ChaosHostInstance,
  type ChaosHostInternals,
  type HostEnv,
  type RenderState,
} from '../src/contract.ts';

export const JOIN_CODE = 'AB12';
const STEP_MS = 1000 / 60;
/** Großer Startwert wie `CACurrentMediaTime() * 1000`: Der Kern muss ab dem ersten Tick zählen. */
const CLOCK_OFFSET_MS = 123_456_789;
const PROTOCOL_VERSION = 4;

export interface LoadedBundle {
  readonly api: ChaosHostApi;
  readonly internals: ChaosHostInternals;
  /** Namen der Globals, die das nackte Kontext vor dem Laden hatte (ohne ECMAScript-Builtins). */
  readonly hostGlobals: readonly string[];
}

/** Bündel in ein frisches, nacktes Kontext laden. */
export function loadBundle(code: string): LoadedBundle {
  const context = createContext({});
  const before = runInContext('Object.getOwnPropertyNames(globalThis)', context) as string[];
  runInContext(code, context, { filename: 'chaos-host.js' });
  const global = context as { ChaosHost?: ChaosHostApi; ChaosHostInternals?: ChaosHostInternals };
  if (!global.ChaosHost || !global.ChaosHostInternals) {
    throw new Error('Bündel setzt ChaosHost/ChaosHostInternals nicht');
  }
  return { api: global.ChaosHost, internals: global.ChaosHostInternals, hostGlobals: before };
}

/**
 * Wie Swift ein JS-Objekt ruft: danach laufen alle Mikrotasks leer (JavaScriptCore macht das
 * nach jedem Aufruf aus Swift; ohne das löst z. B. Havok nie auf). Node leert sie, sobald der
 * Aufrufer abgibt; ein Makrotask-Schritt wartet, bis die Kette ganz durch ist.
 */
export async function settle(): Promise<void> {
  await nextMacrotask();
}

/** Deterministischer Zufall (xorshift32) statt SecRandom: gleiche Partie bei gleichem Seed. */
export function seededBytes(seed: number): (n: number) => number[] {
  let state = seed >>> 0 || 1;
  return (n) => {
    const out: number[] = [];
    for (let i = 0; i < n; i++) {
      state ^= state << 13;
      state >>>= 0;
      state ^= state >>> 17;
      state ^= state << 5;
      state >>>= 0;
      out.push(state & 0xff);
    }
    return out;
  };
}

interface Controller {
  /** Verbindungs-ID; nach einer Wiederverbindung eine neue (CHAOS-145). */
  id: number;
  readonly name: string;
  readonly character: string;
  seq: number;
  slot: number | null;
  actions: string[];
  readonly answered: Set<number>;
  lastHeartbeat: number;
  lastInput: number;
  pressed: boolean;
  picked: boolean;
  /** `welcome.sessionToken` für `reconnect` (CHAOS-145). */
  token: string | null;
  /** Getrennt bzw. ohne Netz: sendet nichts und hört nichts (CHAOS-145). */
  offline: boolean;
}

export interface BotMatchOptions {
  readonly code: string;
  readonly wasm: Uint8Array;
  /** Ganze Partie bis zum Endstand; sonst bis zur Ergebnisanzeige des ersten Minispiels. */
  readonly full: boolean;
  readonly seed?: number;
  /** Jedes n-te `renderState` gegen den Vertrag prüfen (Phasenwechsel immer). */
  readonly validateEvery?: number;
  /** Abbruch nach so viel virtueller Spielzeit. */
  readonly limitMs?: number;
  /**
   * So viele ganze Partien nacheinander, verbunden über „Revanche“ (nur mit `full`; Standard 1).
   * Speichermessung über mehrere Partien (CHAOS-141).
   */
  readonly matches?: number;
  /**
   * Nach jeder ganzen Partie (Endstand erreicht), vor der Revanche; Zählung ab 1, dazu die
   * wartenden Zeitgeber des Kerns.
   */
  readonly onMatchEnd?: (match: number, pendingTimers: number) => void | Promise<void>;
  /** JS-Zeit je Bild (`tick` mit den Mikrotasks danach + `renderState`, echte ms) und Phase des Vorbilds (CHAOS-141). */
  readonly onFrame?: (frame: FrameTiming) => void;
  /** Erstes `renderState` je Phase/Stufe (für Beispielnachrichten). */
  readonly onPhase?: (key: string, state: RenderState) => void;
  readonly log?: ((line: string) => void) | undefined;
  /** Wie die App: `host-ready` erst nach `sceneReady()`, das nach dem ersten `tick` kommt (CHAOS-142). */
  readonly deferSceneReady?: boolean;
  /** `hostCommand`s, sobald alle bereit sind, direkt vor `start` (z. B. `configure:…`, CHAOS-166). */
  readonly beforeStart?: readonly string[];
  /** `hostCommand`s direkt nach `start` (Brettphase; `configure` muss dort ins Leere gehen). */
  readonly afterStart?: readonly string[];
  /** Regel Rückenwind an (`HostEnv.tailwind`, CHAOS-188). */
  readonly tailwind?: boolean;
  /** Künstlich später Minispiel-Aufbau (`HostEnv.debugStageDelayMs`, CHAOS-206). */
  readonly stageDelayMs?: number;
  /**
   * Eigene Rotation (`HostEnv.debugMinigames`, CHAOS-230), etwa mit den Team-Testspielen. Mit
   * `full` muss jede davon gebaut werden (statt der Rotation des Katalogs).
   */
  readonly minigames?: readonly string[];
  /**
   * Rotation nur aus `TEAM_TEST_MINIGAMES` (CHAOS-230), wenn `minigames` fehlt: Jede Spielform
   * kommt in einer ganzen Partie sicher vor. Die Rotation des Katalogs prüft der Lauf ohne.
   */
  readonly teamGames?: boolean;
  /** So viele Bot-Controller (2–4, Standard 2): Team-Formen hängen an der Personenzahl. */
  readonly players?: 2 | 3 | 4;
  /**
   * CHAOS-145 (nur mit `full`): In der ersten Partie Pause im Brett und im Minispiel, Ben
   * trennt sich sauber und kommt zurück, dann verliert er das Netz (Funkstille, der Server wirft
   * ihn nach 15 s raus) und kommt wieder; das Finale läuft bis zum Siegerbildschirm. In jeder
   * weiteren Partie „Überspringen“; in der zweiten „Partie beenden“ aus der Pause im Brett, in der
   * dritten aus der Pause im Minispiel. Erfüllte Prüfungen stehen in `exercised`.
   */
  readonly exercise?: boolean;
}

/** Bot-Controller in Beitrittsreihenfolge; `BotMatchOptions.players` nimmt die ersten. */
const BOTS = [
  { id: 1, name: 'Anna', character: 'raccoon' },
  { id: 2, name: 'Ben', character: 'sock' },
  { id: 3, name: 'Cleo', character: 'robot' },
  { id: 4, name: 'Dana', character: 'cactus' },
] as const;

/** Team-Testspiele aus CHAOS-89: 2 gegen 2, Einer gegen alle, Koop (CHAOS-230). */
export const TEAM_TEST_MINIGAMES = ['pump-duell', 'pump-solo', 'pump-riese'] as const;

/** Prüfungen von `exercise` in einer ganzen Partie (CHAOS-145). */
export const EXERCISE_CHECKS = [
  'pause-board',
  'pause-minigame',
  'reconnect',
  'reconnect-silent',
  'finale-winner',
  'final-guards',
] as const;

export interface FrameTiming {
  readonly key: string;
  readonly ms: number;
  readonly tickMs: number;
  readonly virtualMs: number;
}

export interface BotMatchResult {
  readonly ok: boolean;
  readonly virtualMs: number;
  readonly finalReached: boolean;
  /** Ganze Partien bis zum Endstand (mit `matches` > 1 auch nach Revanche). */
  readonly matchesPlayed: number;
  readonly roundsPlayed: number;
  /** Runden, in denen `board.notice` zu sehen war (CHAOS-157). */
  readonly noticeRounds: readonly number[];
  /** Runden, in denen die Rückenwind-Karte (`board.hud.tailwind`) zu sehen war (CHAOS-188). */
  readonly tailwindRounds: readonly number[];
  readonly minigamesBuilt: readonly string[];
  readonly resultsAccepted: number;
  /**
   * Je angenommenem Ergebnis: virtuelle ms vom Spielstart (erstes `minigame-play`) bis zur
   * Annahme durch den Server (CHAOS-206).
   */
  readonly resultAfterPlayMs: readonly number[];
  /** Ausnahmen, die aus dem Bündel bis zum Aufrufer durchschlugen. */
  readonly exceptions: readonly string[];
  /** Log-Zeilen des Kerns, die auf einen Fehler deuten (wie der Swift-Harness). */
  readonly problems: readonly string[];
  readonly serverErrors: readonly string[];
  readonly contractErrors: readonly string[];
  readonly phases: readonly string[];
  readonly maxRenderStateBytes: number;
  readonly rotation: readonly string[];
  /** Erfüllte Prüfungen von `exercise` (`EXERCISE_CHECKS`, dazu `finale-skip` je Revanche). */
  readonly exercised: readonly string[];
  readonly exerciseErrors: readonly string[];
}

/**
 * „Sabotage wird stärker!“ in einer ganzen Partie (10 Runden, `sabotageGrowthRounds: 5`): nur in
 * Runde 6 (CHAOS-157).
 */
export const FULL_MATCH_NOTICE_ROUNDS = '6';

/** Log-Zeilen, die eine Partie zwar überlebt, die aber nie vorkommen dürfen. */
export const PROBLEM_MARKERS = [
  'Fehler',
  'ERROR',
  'fehlgeschlagen',
  'Laufzeit wertet',
  'nicht mehr gebraucht',
  'abgelehnt',
  'noch nicht geladen',
];

export async function runBotMatch(options: BotMatchOptions): Promise<BotMatchResult> {
  const { api, internals } = loadBundle(options.code);
  const minigames =
    options.minigames ?? (options.teamGames === true ? [...TEAM_TEST_MINIGAMES] : undefined);
  const outbox: [number, string][] = [];
  const logLines: string[] = [];
  const exceptions: string[] = [];
  const serverErrors: string[] = [];
  const contractErrors: string[] = [];
  const phases: string[] = [];
  const exercised: string[] = [];
  const exerciseErrors: string[] = [];
  /** Verbindungen, die der Server schließen darf (Funkstille, CHAOS-145). */
  const expectedCloses = new Set<number>();
  const closedByHost: number[] = [];
  const log = options.log ?? (() => undefined);
  const env: HostEnv = {
    send: (id, text) => {
      outbox.push([id, text]);
    },
    close: (id, code, reason) => {
      if (expectedCloses.delete(id)) closedByHost.push(id);
      else exceptions.push(`Host schließt Verbindung ${String(id)}: ${String(code)} ${reason}`);
    },
    log: (line) => {
      logLines.push(line);
      log(`  js: ${line}`);
    },
    randomBytes: seededBytes(options.seed ?? 1),
    havokWasm: options.wasm,
    joinUrl: `http://192.168.0.2:8787/?code=${JOIN_CODE}`,
    joinCode: JOIN_CODE,
    ...(options.deferSceneReady === true ? { deferSceneReady: true } : {}),
    ...(options.tailwind === true ? { tailwind: true } : {}),
    ...(options.stageDelayMs === undefined ? {} : { debugStageDelayMs: options.stageDelayMs }),
    ...(minigames === undefined ? {} : { debugMinigames: minigames }),
  };

  const guard = <T>(label: string, run: () => T): T | undefined => {
    try {
      return run();
    } catch (error) {
      exceptions.push(
        `${label}: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`,
      );
      return undefined;
    }
  };

  const host = guard('create', () => api.create(env));
  await settle();
  if (!host) return summary();
  const instance: ChaosHostInstance = host;
  if (options.deferSceneReady === true) {
    guard('tick', () => {
      instance.tick(CLOCK_OFFSET_MS);
    });
    await settle();
    if (logLines.some((line) => line.includes('host-ready'))) {
      exceptions.push('host-ready vor sceneReady()');
    }
    guard('sceneReady', () => {
      instance.sceneReady();
    });
    await settle();
  }

  const controllers: Controller[] = BOTS.slice(0, options.players ?? 2).map((c) => ({
    ...c,
    seq: 0,
    slot: null,
    actions: [],
    answered: new Set<number>(),
    lastHeartbeat: 0,
    lastInput: 0,
    pressed: false,
    picked: false,
    token: null,
    offline: false,
  }));

  let now = 0;
  const send = (c: Controller, type: string, fields: Record<string, unknown>) => {
    if (c.offline) return;
    const text = JSON.stringify({ v: PROTOCOL_VERSION, type, ...fields });
    guard(`message ${type}`, () => {
      instance.message(c.id, text);
    });
  };
  const nextSeq = (c: Controller) => ++c.seq;

  const handle = (c: Controller, text: string) => {
    const m = JSON.parse(text) as Record<string, unknown>;
    switch (m.type) {
      case 'welcome': {
        const players = m.players as { slot: number }[];
        const slot = players[0]?.slot ?? null;
        if (c.token !== null && slot !== c.slot) {
          exerciseErrors.push(
            `${c.name}: Wiederverbindung auf Slot ${String(slot)} statt ${String(c.slot)}`,
          );
        }
        c.slot = slot;
        c.token = typeof m.sessionToken === 'string' ? m.sessionToken : null;
        break;
      }
      case 'context': {
        c.actions = (m.actions as string[] | undefined) ?? [];
        const slot = c.slot;
        if (slot === null) return;
        if (c.actions.includes('pick-character') && !c.picked) {
          c.picked = true;
          send(c, 'pick-character', { slot, seq: nextSeq(c), character: c.character });
        } else if (c.actions.includes('ready') && c.picked) {
          send(c, 'ready', { slot, seq: nextSeq(c) });
        }
        const prompt = m.prompt as { id: number; options: { id: string }[] } | undefined;
        const option = prompt?.options[0]?.id;
        if (c.actions.includes('choose') && prompt && option && !c.answered.has(prompt.id)) {
          c.answered.add(prompt.id);
          send(c, 'choose', { slot, seq: nextSeq(c), promptId: prompt.id, option });
        }
        break;
      }
      case 'error':
        serverErrors.push(`${c.name}: ${String(m.code)} ${String(m.message)}`);
        break;
      default:
        break;
    }
  };

  const drain = () => {
    while (outbox.length > 0) {
      const batch = outbox.splice(0);
      for (const [id, text] of batch) {
        const c = controllers.find((entry) => entry.id === id);
        if (!c) exceptions.push(`send an unbekannte Verbindung ${String(id)}`);
        else if (!c.offline) handle(c, text);
      }
    }
  };

  /** Eingaben im Minispiel: Stick im Kreis (10/s), A abwechselnd drücken/loslassen. */
  const play = (c: Controller) => {
    const slot = c.slot;
    if (slot === null || c.offline) return;
    if (now - c.lastHeartbeat >= 5000) {
      c.lastHeartbeat = now;
      send(c, 'heartbeat', { t: now });
    }
    if (now - c.lastInput < 100) return;
    c.lastInput = now;
    if (c.actions.includes('move')) {
      const angle = now / 700 + slot;
      send(c, 'move', { slot, seq: nextSeq(c), x: Math.cos(angle), y: Math.sin(angle) });
    }
    if (c.actions.includes('button-a') && Math.floor(now / 100) % 4 === slot) {
      c.pressed = !c.pressed;
      send(c, c.pressed ? 'press' : 'release', { slot, seq: nextSeq(c), button: 'a' });
    }
  };

  for (const c of controllers) {
    guard('open', () => {
      instance.open(c.id);
    });
    send(c, 'join', { joinCode: JOIN_CODE, seats: 1, names: [c.name] });
  }
  await settle();
  drain();

  const matches = options.full ? Math.max(1, options.matches ?? 1) : 1;
  const limitMs = options.limitMs ?? (options.full ? 40 * 60_000 * matches : 5 * 60_000);
  const validateEvery = options.validateEvery ?? 1;
  let lastKey = '';
  let started = false;
  let frame = 0;
  let maxRenderStateBytes = 0;
  let finalReached = false;
  let matchesPlayed = 0;
  let roundsPlayed = 0;
  const noticeRounds: number[] = [];
  const tailwindRounds: number[] = [];
  let firstResults = false;
  const resultAfterPlayMs: number[] = [];
  let playSeenAt: number | null = null;
  let logScanned = 0;
  const exercise = options.full && options.exercise === true;
  /** Stand der `exercise`-Prüfungen (CHAOS-145). */
  const ex = {
    boardSince: 0,
    failed: new Set<string>(),
    pause: null as null | {
      kind: 'board' | 'minigame';
      sentAt: number;
      seenAt: number | null;
      elapsedMs: number | null;
      resumeSentAt: number | null;
    },
    pauseSounds: new Set<string>(),
    reconnect: null as null | {
      kind: 'clean' | 'silent';
      at: number;
      oldId: number;
      sawDisconnected: boolean;
      rejoinedAt: number | null;
    },
    nextConnId: 101,
    finaleBeats: [] as string[],
    finaleSounds: new Set<string>(),
    finaleHandled: false,
    skipSentAt: null as number | null,
    ending: null as null | { kind: 'board' | 'minigame'; at: number; ended: boolean },
  };
  const settled = (check: string) => exercised.includes(check) || ex.failed.has(check);
  const failCheck = (check: string, why: string) => {
    ex.failed.add(check);
    exerciseErrors.push(`${check}: ${why}`);
  };
  const command = async (cmd: string) => {
    guard('hostCommand', () => {
      instance.hostCommand(cmd);
    });
    await settle();
    drain();
  };
  const rematch = async () => {
    // Revanche: zurück in die Lobby, die Bots melden sich wieder bereit, `start` wie oben.
    // Prompt-IDs zählen in der neuen Partie von vorn.
    started = false;
    for (const c of controllers) c.answered.clear();
    await command('rematch');
  };

  while (now < limitMs) {
    now += STEP_MS;
    frame++;
    const tickStart = performance.now();
    guard('tick', () => {
      instance.tick(now + CLOCK_OFFSET_MS);
    });
    // Mit den Mikrotasks danach (JavaScriptCore leert sie im selben Aufruf aus Swift).
    await settle();
    const tickMs = performance.now() - tickStart;
    drain();
    for (const c of controllers) play(c);
    await settle();
    drain();
    const renderStart = performance.now();
    const text = guard('renderState', () => instance.renderState());
    const frameMs = tickMs + performance.now() - renderStart;
    options.onFrame?.({ key: lastKey, ms: frameMs, tickMs, virtualMs: now });
    if (text === undefined) break;
    maxRenderStateBytes = Math.max(maxRenderStateBytes, text.length);
    const raw = JSON.parse(text) as RenderState;
    const key = raw.phase === 'minigame' ? `minigame-${raw.minigame?.stage ?? '?'}` : raw.phase;
    const changed = key !== lastKey;
    if (changed || frame % validateEvery === 0) {
      const parsed = RenderStateSchema.safeParse(raw);
      if (!parsed.success && contractErrors.length < 10) {
        contractErrors.push(`${key}: ${parsed.error.message}`);
      }
    }
    if (changed && key === 'minigame-play') playSeenAt = now;
    for (; logScanned < logLines.length; logScanned++) {
      if (playSeenAt !== null && logLines[logScanned]?.includes('angenommen')) {
        resultAfterPlayMs.push(Math.round(now - playSeenAt));
      }
    }
    if (changed) {
      phases.push(key);
      log(`[${String(Math.round(now))} ms] Phase ${lastKey || '-'} → ${key}`);
      options.onPhase?.(key, raw);
      lastKey = key;
    }
    roundsPlayed = Math.max(roundsPlayed, raw.board?.round ?? 0);
    if (raw.board?.notice && !noticeRounds.includes(raw.board.round)) {
      noticeRounds.push(raw.board.round);
    }
    if (raw.board?.hud?.tailwind && !tailwindRounds.includes(raw.board.round)) {
      tailwindRounds.push(raw.board.round);
    }
    if (
      !started &&
      raw.lobby.players.length === controllers.length &&
      raw.lobby.players.every((p) => p.ready)
    ) {
      started = true;
      guard('hostCommand', () => {
        for (const cmd of options.beforeStart ?? []) instance.hostCommand(cmd);
        instance.hostCommand('start');
        for (const cmd of options.afterStart ?? []) instance.hostCommand(cmd);
      });
      await settle();
      drain();
    }
    if (key === 'minigame-results' && logLines.some((line) => line.includes('angenommen'))) {
      firstResults = true;
    }
    if (!options.full && firstResults) break;
    if (exercise && changed && key === 'board') ex.boardSince = now;
    if (exercise && matchesPlayed === 0) await exerciseMatch(raw, key);
    else if (exercise) await exerciseEndGame(raw, key);
    if (options.full && changed && raw.phase === 'final') {
      matchesPlayed++;
      await options.onMatchEnd?.(matchesPlayed, internals.pendingTimers());
      if (exercise) {
        ex.finaleBeats = [];
        ex.finaleSounds.clear();
        ex.finaleHandled = false;
        ex.skipSentAt = null;
        if (matchesPlayed > 1) {
          ex.skipSentAt = now;
          await command('skip-finale');
        }
      } else if (matchesPlayed >= matches) {
        finalReached = true;
        break;
      } else {
        await rematch();
      }
    }
    if (exercise && raw.phase === 'final' && !ex.finaleHandled) {
      const final = raw.final;
      if (final) {
        if (ex.finaleBeats.at(-1) !== final.beat) ex.finaleBeats.push(final.beat);
        for (const cue of final.sounds) ex.finaleSounds.add(cue.name);
      }
      if (final?.done) {
        ex.finaleHandled = true;
        if (matchesPlayed === 1) await checkFinale(raw);
        else if (ex.skipSentAt !== null && now - ex.skipSentAt < 100) exercised.push('finale-skip');
        else
          exerciseErrors.push(
            `finale-skip: Siegerbildschirm erst nach ${String(now - (ex.skipSentAt ?? now))} ms`,
          );
        if (matchesPlayed >= matches) {
          finalReached = true;
          break;
        }
        await rematch();
      } else if (now - (ex.skipSentAt ?? now) > 100 && ex.skipSentAt !== null) {
        ex.finaleHandled = true;
        exerciseErrors.push('finale-skip: Überspringen wirkt nicht');
      }
    }
  }

  return summary();

  /** Pause, Wiederverbindung (CHAOS-145) in der ersten Partie, je Bild. */
  async function exerciseMatch(raw: RenderState, key: string) {
    const ben = controllers[1];
    if (!ben) return;
    for (const cue of raw.pause.sounds) ex.pauseSounds.add(cue.name);
    const round = raw.board?.round ?? 0;
    const idle = ex.pause === null && ex.reconnect === null;

    // Pause im Brett, dann im laufenden Minispiel.
    if (idle && raw.pause.canPause) {
      const kind =
        !settled('pause-board') && key === 'board' && now - ex.boardSince >= 3000
          ? 'board'
          : settled('pause-board') &&
              !settled('pause-minigame') &&
              key === 'minigame-play' &&
              (raw.minigame?.elapsedMs ?? 0) > 2000
            ? 'minigame'
            : null;
      if (kind) {
        ex.pauseSounds.clear();
        ex.pause = { kind, sentAt: now, seenAt: null, elapsedMs: null, resumeSentAt: null };
        await command('pause');
        return;
      }
    }
    const pause = ex.pause;
    if (pause) {
      const check = `pause-${pause.kind}`;
      if (pause.seenAt === null) {
        if (raw.phase === 'paused' && raw.pause.paused) {
          pause.seenAt = now;
          pause.elapsedMs = raw.minigame?.elapsedMs ?? null;
          if (pause.kind === 'minigame' && raw.minigame?.stage !== 'play') {
            failCheck(check, 'Minispiel fehlt in der Pause');
          }
          if (raw.pause.canPause) failCheck(check, 'canPause in der Pause');
        } else if (now - pause.sentAt > 1000) {
          failCheck(check, 'Pause kam nicht an');
          ex.pause = null;
        }
      } else if (pause.resumeSentAt === null) {
        if (now - pause.seenAt >= 3000) {
          if (pause.kind === 'minigame' && raw.minigame?.elapsedMs !== pause.elapsedMs) {
            failCheck(
              check,
              `Spielzeit lief in der Pause weiter (${String(pause.elapsedMs)} → ${String(raw.minigame?.elapsedMs)})`,
            );
          }
          pause.resumeSentAt = now;
          await command('resume');
        }
      } else if (raw.phase !== 'paused') {
        if (!ex.pauseSounds.has('pause') || !ex.pauseSounds.has('resume')) {
          failCheck(check, `Klänge fehlen: ${[...ex.pauseSounds].join(', ')}`);
        }
        if (!ex.failed.has(check)) exercised.push(check);
        ex.pause = null;
      } else if (now - pause.resumeSentAt > 1000) {
        failCheck(check, 'Fortsetzen kam nicht an');
        ex.pause = null;
      }
      return;
    }

    // Ben trennt sich sauber (Runde 2), dann Funkstille (Runde 3): der Server wirft ihn raus.
    if (idle && key === 'board' && settled('pause-minigame')) {
      const kind =
        !settled('reconnect') && round >= 2
          ? 'clean'
          : settled('reconnect') && !settled('reconnect-silent') && round >= 3
            ? 'silent'
            : null;
      if (kind) {
        ex.reconnect = { kind, at: now, oldId: ben.id, sawDisconnected: false, rejoinedAt: null };
        ben.offline = true;
        if (kind === 'clean') {
          guard('closed', () => {
            instance.closed(ben.id);
          });
          await settle();
          drain();
        } else {
          expectedCloses.add(ben.id);
        }
        return;
      }
    }
    const reconnect = ex.reconnect;
    if (reconnect) {
      const check = reconnect.kind === 'clean' ? 'reconnect' : 'reconnect-silent';
      const player = raw.lobby.players.find((p) => p.slot === ben.slot);
      if (reconnect.rejoinedAt === null) {
        if (player?.connected === false) reconnect.sawDisconnected = true;
        const kicked = closedByHost.includes(reconnect.oldId);
        const due =
          reconnect.kind === 'clean'
            ? now - reconnect.at >= 3000
            : kicked && reconnect.sawDisconnected;
        if (reconnect.kind === 'silent' && now - reconnect.at > 25_000 && !due) {
          failCheck(check, 'Server hat die stille Verbindung nicht getrennt');
        }
        if (due || ex.failed.has(check)) {
          ben.id = ex.nextConnId++;
          ben.offline = false;
          ben.lastHeartbeat = now;
          reconnect.rejoinedAt = now;
          guard('open', () => {
            instance.open(ben.id);
          });
          send(ben, 'reconnect', { sessionToken: ben.token });
          await settle();
          drain();
        }
      } else if (player?.connected === true) {
        if (!reconnect.sawDisconnected) failCheck(check, 'Trennung war nicht zu sehen');
        if (!ex.failed.has(check)) exercised.push(check);
        ex.reconnect = null;
      } else if (now - reconnect.rejoinedAt > 3000) {
        failCheck(check, 'Wiederverbindung kam nicht an');
        ex.reconnect = null;
      }
    }
  }

  /**
   * „Partie beenden“ aus der Pause (CHAOS-145): in der zweiten Partie im Brett, in der dritten im
   * laufenden Minispiel. Danach muss das Finale „vorzeitig beendet“ zeigen.
   */
  async function exerciseEndGame(raw: RenderState, key: string) {
    const kind = matchesPlayed === 1 ? 'board' : matchesPlayed === 2 ? 'minigame' : null;
    if (!kind) return;
    const check = `end-game-${kind}`;
    if (settled(check)) return;
    const ending = ex.ending;
    if (!ending) {
      const due =
        kind === 'board'
          ? key === 'board' && now - ex.boardSince >= 3000
          : key === 'minigame-play' && (raw.minigame?.elapsedMs ?? 0) > 2000;
      if (due && raw.pause.canPause) {
        ex.ending = { kind, at: now, ended: false };
        await command('pause');
      }
      return;
    }
    if (!ending.ended && raw.phase === 'paused') {
      ending.ended = true;
      await command('end-game');
    } else if (raw.phase === 'final') {
      const final = raw.final;
      if (
        final?.endedEarly === true &&
        final.kicker === 'Partie vorzeitig beendet' &&
        final.winner.earlyNote !== null
      ) {
        exercised.push(check);
      } else {
        failCheck(check, 'Finale zeigt kein vorzeitiges Ende');
      }
      ex.ending = null;
    } else if (now - ending.at > 3000) {
      failCheck(check, `kein Finale nach „Partie beenden“ (Phase ${raw.phase})`);
      ex.ending = null;
    }
  }

  /** Erstes Finale bis zum Siegerbildschirm: Abschnitte, Klänge, Podest, Befehle (CHAOS-145). */
  async function checkFinale(raw: RenderState) {
    const final = raw.final;
    const beats = ex.finaleBeats.join(' → ');
    const ordered =
      ex.finaleBeats[0] === 'intro' &&
      ex.finaleBeats.includes('reveal') &&
      ex.finaleBeats.at(-1) === 'winner';
    if (!final || !ordered) exerciseErrors.push(`finale-winner: Abschnitte ${beats}`);
    else if (!ex.finaleSounds.has('win') || !ex.finaleSounds.has('trophy')) {
      exerciseErrors.push(`finale-winner: Klänge ${[...ex.finaleSounds].join(', ')}`);
    } else if (
      final.podium.length !== controllers.length ||
      final.winner.ranking.length !== controllers.length ||
      !final.canRematch ||
      final.winner.headline === ''
    ) {
      exerciseErrors.push('finale-winner: Podest, Endstand oder „Nochmal spielen“ fehlt');
    } else {
      exercised.push('finale-winner');
    }
    // Im Finale gehen Pause und Fortsetzen ins Leere, ohne Server-Fehler.
    const before = logLines.length;
    const errorsBefore = serverErrors.length;
    await command('pause');
    await command('resume');
    const ignored = logLines.slice(before).filter((line) => line.includes('ignoriert')).length;
    if (ignored === 2 && serverErrors.length === errorsBefore) exercised.push('final-guards');
    else exerciseErrors.push(`final-guards: ${String(ignored)} ignoriert`);
  }

  function summary(): BotMatchResult {
    const problems = logLines.filter((line) => PROBLEM_MARKERS.some((m) => line.includes(m)));
    const minigamesBuilt = logLines
      .map((line) => /^Minispiel (\S+) \(Runde/.exec(line)?.[1])
      .filter((id): id is string => id !== undefined);
    const resultsAccepted = logLines.filter((line) => line.includes('angenommen')).length;
    const rotation = [...(minigames ?? internals.rotation)];
    const allRotation = rotation.every((id) => minigamesBuilt.includes(id));
    const ok =
      exceptions.length === 0 &&
      problems.length === 0 &&
      serverErrors.length === 0 &&
      contractErrors.length === 0 &&
      resultsAccepted >= 1 &&
      // Ein Minispiel, das „Partie beenden“ abbricht, liefert kein Ergebnis (CHAOS-145).
      resultsAccepted ===
        minigamesBuilt.length - (exercised.includes('end-game-minigame') ? 1 : 0) &&
      (!options.full ||
        (finalReached && allRotation && noticeRounds.join() === FULL_MATCH_NOTICE_ROUNDS)) &&
      (options.full || firstResults) &&
      exerciseErrors.length === 0 &&
      (!exercise ||
        (EXERCISE_CHECKS.every((check) => exercised.includes(check)) &&
          (matches < 2 || exercised.includes('end-game-board')) &&
          (matches < 3 || exercised.includes('end-game-minigame')) &&
          exercised.filter((check) => check === 'finale-skip').length === matchesPlayed - 1)) &&
      // Rückenwind-Karte nur mit der Regel; mit ihr in einer ganzen Partie mindestens einmal.
      (options.tailwind === true
        ? !options.full || tailwindRounds.length > 0
        : tailwindRounds.length === 0);
    return {
      ok,
      virtualMs: Math.round(now),
      finalReached,
      matchesPlayed,
      roundsPlayed,
      noticeRounds,
      tailwindRounds,
      minigamesBuilt,
      resultsAccepted,
      resultAfterPlayMs,
      exceptions,
      problems,
      serverErrors,
      contractErrors,
      phases,
      maxRenderStateBytes,
      rotation,
      exercised,
      exerciseErrors,
    };
  }
}
