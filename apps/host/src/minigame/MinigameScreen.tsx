/**
 * Minispiel-Bühne im Spielablauf (M3, CHAOS-26/33): ersetzt in den Minispiel-Phasen das Brett.
 *
 * - **Intro** (`minigame-intro`): Szene ist vorbereitet, darüber die Anleitungskarte mit Titel,
 *   Untertitel, Anleitung, Bedienung (Joystick/A/B mit Symbol) und Countdown. Lief das
 *   Minispiel in der Partie schon (`minigame.repeat`, CHAOS-66), nur Titel, Bedienung, Spieler
 *   und Countdown (kurze Anleitung, `minigameRepeatIntroMs`). Wartet die Anleitung auf
 *   Bereitschaft (`minigame.ready`, CHAOS-214), stehen statt des Countdowns die Spieler mit
 *   „Bereit“/„Drückt Bereit …“/„getrennt“ und kein Countdown.
 * - **Spiel** (`minigame-play`): Runner läuft; Eingaben vom Server (`input`) und der Tastatur;
 *   HUD mit Restzeit, Punkten je Spieler (Farbe + Symbol + Figur), Status und Banner. Das
 *   Ergebnis geht über `onResult` (genau einmal) an den Versand.
 * - **Ergebnis** (`minigame-results`): Anzeige aus dem autoritativen Server-Stand, Figuren
 *   jubeln/schmollen.
 *
 * - **Pause** (v4, `view.paused`): Runner hält an (`stage.pause()`), Countdowns stehen; das
 *   Pause-Overlay zeigt die App darüber.
 * - **Ergebnis-Bestätigung** (v4, CHAOS-55): Lehnt der Server das Ergebnis ab
 *   (`minigame-result-ack` mit `accepted: false`), erscheint dezent ein Hinweis mit Code.
 *
 * Die Komponente wird je Minispiel (ID + Runde + Seed) neu eingehängt (`key`); beim Aushängen
 * entsorgt sie die ganze Bühne (Engine, Szene, Figuren, Effekte, Listener).
 */
import type { MinigameHud, MinigameModule } from '@chaos-party/minigame-sdk/babylon';
import {
  PLAYER_SLOTS,
  type BoardView,
  type MinigameResultAckMessage,
  type SlotNumber,
} from '@chaos-party/protocol';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { CoinIcon, ItemIcon } from '../board/icons.tsx';
import { ITEM_NAMES, playerName } from '../board/texts.ts';
import { attachPerf } from '../debug/perf.ts';
import { markFirstFrame, markScene } from '../debug/sceneMarks.ts';
import { soundEngine } from '../fx/audio.ts';
import type { IntentHub } from '../input/webSocketInputSource.ts';
import type { ConnectionStatus, MinigameResultPayload } from '../net/hostConnection.ts';
import { ButtonIcon, JoystickIcon } from './icons.tsx';
import { MinigameKeyboard } from './keyboard.ts';
import {
  characterName,
  intentToMinigameInput,
  minigameStageOf,
  phaseSecondsLeft,
  planPlay,
  playDeadline,
  playersFromView,
  shownRemainingMs,
  type MinigameStageName,
} from './plan.ts';
import { introReadiness, readyProgress, waitsForReady, type Readiness } from './readiness.ts';
import { PRACTICE_NOTE, resultPayload, resultsDisplay } from './results.ts';
import { createMinigameStage, type MinigameStage, type StageStatus } from './stage.ts';
import { teamLineup, type TeamLineup } from './teams.ts';
import type { ChaosMinigameTestHook } from './testHook.ts';

export interface MinigameScreenProps {
  /** Neuester Server-Stand (Phase `minigame-*` dieses Minispiels). */
  readonly view: BoardView;
  /** Empfangszeit des Stands (`performance.now()`). */
  readonly receivedAt: number;
  /** Münzgewinne laut Server-Ereignissen (`null` = unbekannt). */
  readonly rewards: Readonly<Partial<Record<SlotNumber, number>>> | null;
  readonly module: MinigameModule;
  /** Verbindungsstatus; `null` im lokalen Ablauf. */
  readonly connection: ConnectionStatus | null;
  readonly test: boolean;
  /** Geprüfte Controller-Eingaben vom Server (`null` lokal). */
  readonly hub: Pick<IntentHub, 'subscribe'> | null;
  readonly onResult: (result: MinigameResultPayload) => void;
  readonly onReady?: (ready: boolean) => void;
  /** Zustand des Ergebnis-Versands für den Testhaken. */
  readonly getResultState?: () => string;
  /** Nur lokaler Ablauf: nächster Abschnitt (Testhaken `next`). */
  readonly onNext?: () => void;
  /** Letzte Ergebnis-Bestätigung des Servers (v4); Ablehnung wird dezent angezeigt. */
  readonly resultAck?: MinigameResultAckMessage | null;
  /**
   * Licht nach Runde (CHAOS-63, Standard `true`): Das Minispiel erbt die Stimmung der Runde.
   * Der lokale Ablauf (keine echte Partie) nutzt die feste Brett-Stimmung.
   */
  readonly lightByRound?: boolean;
  /**
   * Spielende an der Frist des Servers ausrichten (CHAOS-206, Standard `true`): Ein spät
   * gestartetes Spiel wird vor der Frist gewertet, die Anzeige zählt bis dorthin. Der lokale
   * Ablauf hat keinen Server und keine Frist.
   */
  readonly serverDeadline?: boolean;
}

const CONNECTION_TEXT: Record<ConnectionStatus, string> = {
  connecting: 'Server: verbinde …',
  connected: 'Server: verbunden',
  disconnected: 'Server: getrennt – verbinde neu …',
  'host-taken': 'Anderes Spielfenster ist schon verbunden – warte …',
};

function colorStyle(slot: SlotNumber): CSSProperties {
  return { '--player-color': PLAYER_SLOTS[slot].color } as CSSProperties;
}

function PlayerBadge({ slot }: { readonly slot: SlotNumber }) {
  return (
    <span className="minigame-badge" aria-hidden="true" style={colorStyle(slot)}>
      {PLAYER_SLOTS[slot].symbol}
    </span>
  );
}

export function MinigameScreen(props: MinigameScreenProps) {
  const { view, receivedAt, module, test, hub, connection } = props;
  const { info } = module;
  const stageName: MinigameStageName = minigameStageOf(view) ?? 'intro';
  const minigame = view.minigame;
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<MinigameStage | null>(null);
  const [status, setStatus] = useState<StageStatus>('loading');
  const [hud, setHud] = useState<MinigameHud | null>(null);
  const [now, setNow] = useState(() => performance.now());
  // Beim Einhängen festgelegt: Spieler, Seed, Runde, Spielzeit (bzw. Restzeit nach Neuladen).
  const [setup] = useState(() => ({
    players: playersFromView(view),
    seed: minigame?.seed ?? 0,
    // CHAOS-89: Aufstellung bei Teams bzw. Koop, fest ab der Anleitung.
    teams: minigame?.teams ?? null,
    round: minigame?.round ?? view.round,
    lightRound:
      (props.lightByRound ?? true) && view.rounds > 0
        ? { round: minigame?.round ?? view.round, rounds: view.rounds, boardId: view.boardId }
        : null,
    plan: planPlay(view, receivedAt, performance.now()),
  }));
  const { plan } = setup;

  // Aktuelle Props für Rückrufe aus Effekten, die nur einmal laufen.
  const latest = useRef({ props, stageName });
  useEffect(() => {
    latest.current = { props, stageName };
  });
  const networkInputs = useRef<Partial<Record<SlotNumber, number>>>({});
  const lastNetworkInputs = useRef<
    Partial<
      Record<
        SlotNumber,
        { move: { x: number; y: number } | null; presses: number; releases: number }
      >
    >
  >({});

  // --- Bühne aufbauen und entsorgen -----------------------------------------------------------
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    // Standbild-Kennzahl je Szenenwechsel (nur Debug, CHAOS-153): ab hier bis zum ersten Bild.
    markScene('minispiel', 'aufbau');
    const canvas = document.createElement('canvas');
    canvas.className = 'game-canvas';
    canvas.setAttribute('aria-label', `Minispiel ${module.info.title}`);
    container.appendChild(canvas);
    const stage = createMinigameStage({
      canvas,
      module,
      players: setup.players,
      seed: setup.seed,
      teams: setup.teams,
      timeLimitMs: plan.kind === 'play' ? plan.timeLimitMs : module.info.durationMs,
      lightRound: setup.lightRound,
      testMode: test,
      sound: soundEngine(),
      onResult: (result) => {
        latest.current.props.onResult(resultPayload(result.result, setup.round));
      },
    });
    stageRef.current = stage;
    let active = true;
    // Messung (nur Debug, CHAOS-39): Spielphase als „minispiel:<id>“, Anleitung/Ergebnis getrennt.
    const stopPerf = attachPerf(() => {
      const name = latest.current.stageName;
      return name === 'play'
        ? `minispiel:${module.info.id}`
        : `minispiel:${module.info.id}:${name}`;
    }, stage);
    const stopFirstFrame = markFirstFrame('minispiel', stage);

    const hook: ChaosMinigameTestHook | undefined = test
      ? {
          ready: false,
          id: module.info.id,
          get state() {
            return stage.runnerState ?? 'created';
          },
          get elapsedMs() {
            return stage.elapsedMs;
          },
          get result() {
            return stage.result?.result ?? null;
          },
          step: (frames: number) => {
            stage.step(frames);
            setHud(stage.hud());
          },
          input: (slot, input) => {
            stage.input(slot, input);
          },
          hud: () => stage.hud(),
          get stage() {
            return latest.current.stageName;
          },
          get networkInputs() {
            return { ...networkInputs.current };
          },
          get lastNetworkInputs() {
            return structuredClone(lastNetworkInputs.current);
          },
          get resultState() {
            return latest.current.props.getResultState?.() ?? null;
          },
          get fx() {
            return stage.fxStats;
          },
          get paused() {
            return stage.paused;
          },
          next: () => {
            latest.current.props.onNext?.();
          },
        }
      : undefined;
    if (hook) window.__chaosMinigame = hook;

    stage.ready.then(
      () => {
        if (!active) return;
        setStatus('ready');
        setHud(stage.hud());
        if (hook) hook.ready = true;
        latest.current.props.onReady?.(true);
      },
      () => {
        if (active) setStatus('error');
      },
    );

    return () => {
      active = false;
      stopPerf();
      stopFirstFrame();
      stage.dispose();
      canvas.remove();
      stageRef.current = null;
      latest.current.props.onReady?.(false);
      if (hook && window.__chaosMinigame === hook) delete window.__chaosMinigame;
    };
  }, [module, test, setup, plan]);

  // --- Pause (v4): Runner anhalten bzw. fortsetzen -------------------------------------------
  const paused = view.paused;
  useEffect(() => {
    if (paused) stageRef.current?.pause();
    else stageRef.current?.resume();
  }, [paused]);

  // --- Phasen: Spielzeit starten, Ergebnis feiern -------------------------------------------
  useEffect(() => {
    if (stageName === 'play' && plan.kind === 'play') stageRef.current?.start();
  }, [stageName, plan]);

  const placements = minigame?.placements ?? null;
  const aborted = minigame?.aborted ?? false;
  useEffect(() => {
    if (stageName !== 'results' || status !== 'ready' || aborted || !placements) return;
    stageRef.current?.celebrate(placements);
  }, [stageName, status, aborted, placements]);

  // --- Verbindungsstatus der Spieler → neutrale Eingaben bei Trennung -------------------------
  useEffect(() => {
    if (status !== 'ready') return;
    for (const player of view.players)
      stageRef.current?.setConnected(player.slot, player.connected);
  }, [view.players, status]);

  // --- Eingaben: Server und Tastatur ----------------------------------------------------------
  useEffect(() => {
    if (!hub) return;
    return hub.subscribe((intent) => {
      const mapped = intentToMinigameInput(intent);
      if (!mapped) return;
      networkInputs.current[mapped.slot] = (networkInputs.current[mapped.slot] ?? 0) + 1;
      if (test) {
        const last = (lastNetworkInputs.current[mapped.slot] ??= {
          move: null,
          presses: 0,
          releases: 0,
        });
        const { input } = mapped;
        if (input.type === 'move') last.move = { x: input.x, y: input.y };
        else if (input.type === 'press') last.presses += 1;
        else last.releases += 1;
      }
      stageRef.current?.input(mapped.slot, mapped.input);
    });
  }, [hub, test]);

  useEffect(() => {
    const keyboard = new MinigameKeyboard();
    const apply = (code: string, pressed: boolean) => {
      for (const { slot, input } of keyboard.key(code, pressed))
        stageRef.current?.input(slot, input);
    };
    const down = (event: KeyboardEvent) => {
      if (!event.repeat) apply(event.code, true);
    };
    const up = (event: KeyboardEvent) => {
      apply(event.code, false);
    };
    const blur = () => {
      for (const { slot, input } of keyboard.releaseAll()) stageRef.current?.input(slot, input);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, []);

  // --- HUD und Uhr (nicht im Testmodus: dort treibt `step` die Anzeige) -----------------------
  useEffect(() => {
    if (test) return;
    const timer = setInterval(() => {
      const clockNow = performance.now();
      setNow(clockNow);
      const stage = stageRef.current;
      if (stage?.status === 'ready') setHud(stage.hud());
      // Ablauf an der Frist des Servers (CHAOS-206): spät gestartetes oder langsam gerechnetes
      // Spiel vorher werten, damit das Ergebnis noch angenommen wird.
      const current = latest.current.props;
      if (
        stage &&
        current.serverDeadline !== false &&
        playDeadline(
          current.view,
          current.receivedAt,
          clockNow,
          stage.runnerState === 'running',
        ) === 'end'
      ) {
        stage.endPlay();
      }
    }, 100);
    return () => {
      clearInterval(timer);
    };
  }, [test]);

  // Im Testmodus steht die Uhr: Countdown zeigt die Restzeit beim Empfang (stabile Bilder).
  // In der Pause steht sie ebenfalls (Restzeit des Servers gilt ab `pausedAt`).
  const clock = test || paused ? receivedAt : Math.max(now, receivedAt);
  // CHAOS-214: Wartet die Anleitung auf „Bereit“, ist `remainingMs` nur Mindestzeit bzw.
  // Sicherheitsfrist – kein Countdown, also auch keine Ticks.
  const introSeconds =
    stageName === 'intro' && !waitsForReady(view)
      ? phaseSecondsLeft(view.remainingMs, receivedAt, clock)
      : null;

  // --- Klänge: Minispiel-Start, Countdown-Ticks ----------------------------------------------
  useEffect(() => {
    if (latest.current.stageName === 'intro') soundEngine().play('minigame-start');
  }, []);
  useEffect(() => {
    if (introSeconds !== null && introSeconds >= 1 && introSeconds <= 3) {
      soundEngine().play('tick', { pitch: introSeconds === 1 ? 1.25 : 1 });
    }
  }, [introSeconds]);
  // CHAOS-214: Statt Countdown tickt jedes neue „Bereit“, das letzte etwas höher.
  const progress = stageName === 'intro' ? readyProgress(view) : null;
  const readyDone = progress?.done ?? 0;
  const readyTotal = progress?.total ?? 0;
  const lastReady = useRef(readyDone);
  useEffect(() => {
    if (readyDone > lastReady.current) {
      soundEngine().play('tick', { pitch: readyDone >= readyTotal ? 1.25 : 1 });
    }
    lastReady.current = readyDone;
  }, [readyDone, readyTotal]);

  const ack = props.resultAck;
  const rejected =
    ack && !ack.accepted && ack.minigameId === info.id && ack.round === setup.round
      ? (ack.code ?? 'abgelehnt')
      : null;

  const results = useMemo(
    () => (stageName === 'results' ? resultsDisplay(view, info, props.rewards) : null),
    [stageName, view, info, props.rewards],
  );

  return (
    <div
      className="minigame-screen"
      data-testid="minigame-screen"
      data-stage={stageName}
      data-minigame={info.id}
      data-status={status}
    >
      <div className="stage" ref={containerRef} />
      {stageName === 'intro' && (
        <IntroCard module={module} view={view} seconds={introSeconds} players={setup.players} />
      )}
      {stageName === 'play' && (
        <PlayHud
          module={module}
          view={view}
          hud={hud}
          waiting={plan.kind === 'wait'}
          remainingMs={
            plan.kind === 'wait'
              ? plan.remainingMs
              : test || props.serverDeadline === false
                ? (hud?.remainingMs ?? plan.timeLimitMs)
                : // Höchstens bis zur Frist des Servers (CHAOS-206); im Testmodus treibt `step`.
                  shownRemainingMs(hud?.remainingMs ?? plan.timeLimitMs, view, receivedAt, clock)
          }
        />
      )}
      {stageName === 'results' && results && <ResultsCard title={info.title} display={results} />}
      {rejected && (
        <p
          className="minigame-ack"
          role="status"
          data-testid="result-rejected"
          data-code={rejected}
        >
          Server hat das Ergebnis abgelehnt ({rejected})
        </p>
      )}
      {status === 'error' && (
        <p className="minigame-error" role="alert">
          Minispiel konnte nicht geladen werden.
        </p>
      )}
      {connection !== null && connection !== 'connected' && (
        <div className="minigame-connection" data-testid="connection" data-status={connection}>
          {CONNECTION_TEXT[connection]}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Anleitung
// ---------------------------------------------------------------------------------------------

function IntroCard({
  module,
  view,
  seconds,
  players,
}: {
  readonly module: MinigameModule;
  readonly view: BoardView;
  readonly seconds: number | null;
  readonly players: readonly { readonly slot: SlotNumber; readonly name: string }[];
}) {
  const { info } = module;
  const { controls } = info;
  // CHAOS-66: Minispiel lief in der Partie schon → kurze Anleitung, nur Titel und Bedienlegende.
  const repeat = view.minigame?.repeat === true;
  // CHAOS-214: Wartet die Anleitung auf „Bereit“, ersetzt die Bereitschaft den Countdown.
  const readiness = introReadiness(view);
  // CHAOS-89: Team-Ansage vor der Anleitung.
  const lineup = teamLineup(view);
  return (
    <div
      className="minigame-overlay"
      data-testid="minigame-intro"
      data-repeat={repeat}
      data-waits-ready={readiness !== null}
    >
      <section
        className={`minigame-card minigame-card--intro${repeat ? ' minigame-card--repeat' : ''}`}
        aria-label="Anleitung"
      >
        <header className="minigame-card-head">
          <p className="minigame-kicker" data-testid="minigame-kicker">
            Minispiel · Runde {view.minigame?.round ?? view.round}
            {repeat && ' · Nochmal!'}
          </p>
          {seconds !== null && (
            <p
              className="minigame-countdown"
              data-testid="minigame-countdown"
              data-seconds={seconds}
            >
              <span className="minigame-countdown-label">Los in</span>
              <span className="minigame-countdown-value">{seconds}</span>
            </p>
          )}
        </header>
        <h2 className="minigame-title" data-testid="minigame-title">
          {info.title}
        </h2>
        {lineup && <TeamLineupRow lineup={lineup} view={view} />}
        {!repeat && (
          <>
            <p className="minigame-tagline">{info.tagline}</p>
            <ol className="minigame-instructions" data-testid="minigame-instructions">
              {info.instructions.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ol>
          </>
        )}
        <ul className="minigame-controls" aria-label="Bedienung" data-testid="minigame-controls">
          {controls.joystick !== null && (
            <li className="minigame-control" data-control="joystick">
              <JoystickIcon />
              <span>
                <b>Joystick</b>
                {controls.joystick}
              </span>
            </li>
          )}
          {controls.a !== null && (
            <li className="minigame-control" data-control="a">
              <ButtonIcon letter="A" />
              <span>
                <b>Knopf A</b>
                {controls.a}
              </span>
            </li>
          )}
          {controls.b !== null && (
            <li className="minigame-control" data-control="b">
              <ButtonIcon letter="B" />
              <span>
                <b>Knopf B</b>
                {controls.b}
              </span>
            </li>
          )}
        </ul>
        {readiness ? (
          <ReadinessRow readiness={readiness} />
        ) : (
          <ul className="minigame-roster" aria-label="Mitspieler">
            {players.map((player) => (
              <li
                key={player.slot}
                className="minigame-roster-entry"
                style={colorStyle(player.slot)}
              >
                <PlayerBadge slot={player.slot} />
                <span className="minigame-roster-name">{player.name}</span>
                <span className="minigame-roster-character">
                  {characterName(view, player.slot)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** Team-Ansage (CHAOS-89): je Gruppe Symbol, Name und Mitglieder, nie nur Farbe. */
function TeamLineupRow({
  lineup,
  view,
}: {
  readonly lineup: TeamLineup;
  readonly view: BoardView;
}) {
  return (
    <div className="minigame-teams" data-testid="minigame-teams" data-layout={lineup.layout}>
      <p className="minigame-teams-head">{lineup.headline}</p>
      <ul className="minigame-teams-groups">
        {lineup.groups.map((group, index) => (
          <li
            key={group.label}
            className="minigame-team"
            data-testid={`minigame-team-${String(index)}`}
            style={{ '--team-color': group.color } as CSSProperties}
          >
            <span className="minigame-team-mark" aria-hidden="true">
              {group.symbol}
            </span>
            <span className="minigame-team-label">{group.label}</span>
            <span className="minigame-team-members">
              {group.slots.map((slot) => (
                <span key={slot} className="minigame-team-member" style={colorStyle(slot)}>
                  <PlayerBadge slot={slot} />
                  {playerName(view, slot)}
                </span>
              ))}
            </span>
          </li>
        ))}
      </ul>
      {lineup.note && <p className="minigame-teams-note">{lineup.note}</p>}
    </div>
  );
}

/** Bereitschaft je Spieler (CHAOS-214): Häkchen + „Bereit“, „Drückt Bereit …“ oder „getrennt“. */
function ReadinessRow({ readiness }: { readonly readiness: Readiness }) {
  const done = readiness.players.filter((player) => player.state !== 'waiting').length;
  return (
    <div className="minigame-ready" data-testid="minigame-ready">
      <p className="minigame-ready-head">
        <span className="minigame-ready-headline">{readiness.headline}</span>
        <span className="minigame-ready-count" data-testid="minigame-ready-count">
          {done}/{readiness.players.length}
        </span>
      </p>
      <ul className="minigame-ready-list" aria-label="Bereitschaft">
        {readiness.players.map((player) => (
          <li
            key={player.slot}
            className="minigame-ready-chip"
            data-testid={`minigame-ready-${player.slot}`}
            data-state={player.state}
            style={colorStyle(player.slot)}
          >
            <PlayerBadge slot={player.slot} />
            <span className="minigame-ready-who">
              <span className="minigame-ready-line">
                <span className="minigame-ready-name">{player.name}</span>
                <span className="minigame-ready-character">{player.character}</span>
              </span>
              <span className="minigame-ready-state">
                {player.state !== 'waiting' && (
                  <span className="minigame-ready-check" aria-hidden="true">
                    {player.state === 'ready' ? '✓' : '⚠'}
                  </span>
                )}
                {player.text}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Spiel-HUD
// ---------------------------------------------------------------------------------------------

function PlayHud({
  module,
  view,
  hud,
  waiting,
  remainingMs,
}: {
  readonly module: MinigameModule;
  readonly view: BoardView;
  readonly hud: MinigameHud | null;
  readonly waiting: boolean;
  readonly remainingMs: number;
}) {
  const { info } = module;
  const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const scores = new Map((hud?.scores ?? []).map((entry) => [entry.slot, entry]));
  const players = [...view.players].sort((a, b) => a.slot - b.slot);
  return (
    <div className="minigame-hud" data-testid="minigame-hud">
      <header className="minigame-hud-top">
        <p className="minigame-hud-title">{info.title}</p>
        <p
          className="minigame-timer"
          data-testid="minigame-timer"
          data-seconds={seconds}
          data-urgent={seconds <= 3}
        >
          {seconds}
          <span className="minigame-timer-unit">s</span>
        </p>
      </header>
      {hud?.banner && (
        <p className="minigame-banner" data-testid="minigame-banner">
          {hud.banner}
        </p>
      )}
      {waiting && (
        <p className="minigame-banner minigame-banner--wait" data-testid="minigame-wait">
          Gleich vorbei – der Server wertet aus …
        </p>
      )}
      <ul className="minigame-scores" aria-label="Punkte">
        {players.map((player) => {
          const entry = scores.get(player.slot);
          const statusText = player.connected ? entry?.status : '⚠ getrennt';
          return (
            <li
              key={player.slot}
              className="minigame-score"
              data-testid={`minigame-score-${player.slot}`}
              data-connected={player.connected}
              style={colorStyle(player.slot)}
            >
              <PlayerBadge slot={player.slot} />
              <span className="minigame-score-who">
                <span className="minigame-score-name">{player.name}</span>
                <span className="minigame-score-character">{characterName(view, player.slot)}</span>
              </span>
              <span className="minigame-score-value">
                {entry?.score ?? 0}
                <span className="minigame-score-unit">{info.scoreUnit}</span>
              </span>
              {statusText && <span className="minigame-score-status">{statusText}</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Ergebnis
// ---------------------------------------------------------------------------------------------

function ResultsCard({
  title,
  display,
}: {
  readonly title: string;
  readonly display: ReturnType<typeof resultsDisplay>;
}) {
  return (
    <div
      className="minigame-overlay"
      data-testid="minigame-results"
      data-aborted={display.aborted}
      data-practice={display.practice}
    >
      <section className="minigame-card minigame-card--results" aria-label="Ergebnis">
        <p className="minigame-kicker">Ergebnis · {title}</p>
        <h2 className="minigame-title minigame-headline" data-testid="minigame-headline">
          {display.headline}
        </h2>
        {display.aborted ? (
          <p className="minigame-tagline">Das Ergebnis kam nicht rechtzeitig an.</p>
        ) : (
          <ol className="minigame-ranking">
            {display.rows.map((row) => (
              <li
                key={row.slot}
                className="minigame-rank"
                data-testid={`minigame-rank-${row.slot}`}
                data-place={row.place}
                data-tied={row.tied}
                style={colorStyle(row.slot)}
              >
                <span className="minigame-rank-place">
                  {row.place}.{row.tied && <span className="minigame-rank-tie">geteilt</span>}
                </span>
                <PlayerBadge slot={row.slot} />
                <span className="minigame-rank-who">
                  <span className="minigame-rank-name">{row.name}</span>
                  <span className="minigame-rank-character">{row.character}</span>
                </span>
                <span className="minigame-rank-score">{row.scoreText}</span>
                <span
                  className="minigame-rank-coins"
                  data-testid={`minigame-coins-${row.slot}`}
                  data-coins={row.coins ?? ''}
                >
                  {row.coins !== null && (
                    <>
                      <CoinIcon size={30} />+{row.coins}
                    </>
                  )}
                </span>
                {row.items.length > 0 && (
                  <span
                    className="minigame-rank-prize"
                    data-testid={`minigame-prize-${row.slot}`}
                    data-items={row.items.join(' ')}
                  >
                    <span className="minigame-rank-prize-label">Trostpreis</span>
                    {row.items.map((item, i) => (
                      <span key={`${item}-${String(i)}`} className="minigame-rank-prize-item">
                        <ItemIcon item={item} size={26} />
                        {ITEM_NAMES[item]}
                      </span>
                    ))}
                  </span>
                )}
              </li>
            ))}
          </ol>
        )}
        {display.highlights.length > 0 && (
          <ul className="minigame-highlights" aria-label="Höhepunkte">
            {display.highlights.map((line) => (
              <li key={line}>★ {line}</li>
            ))}
          </ul>
        )}
        {display.practice && (
          <p className="minigame-tagline" data-testid="minigame-practice-note">
            {PRACTICE_NOTE}
          </p>
        )}
      </section>
    </div>
  );
}
