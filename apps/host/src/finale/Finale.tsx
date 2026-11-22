/**
 * Finale am PC (CHAOS-37): Trophäenzählung mit Spannungsaufbau, danach Siegerbildschirm mit
 * 3D-Podest (`podiumStage.ts`), Endstand, Bonus-Titeln und „Nochmal spielen“ (`rematch`).
 *
 * Der Ablauf ist eine reine Zeitfunktion (`finalePlan.ts`); diese Komponente lässt nur die Uhr
 * laufen, spielt Klänge und zeichnet.
 *
 * Das Podest entsteht schon zu Beginn der Trophäenzählung auf einer unsichtbaren Leinwand
 * (CHAOS-71): Aufbau und Shader brauchen ohne schnelle Grafikkarte Sekunden. Der
 * Siegerbildschirm hängt die fertige Leinwand nur noch ein und startet die Render-Schleife. Tempo per URL (`?finale=normal|fast|skip|manual`), im
 * Testmodus standardmäßig `skip`. Testhaken: `window.__chaosFinale` (nur `?test=1`).
 */
import {
  aiTagline,
  CHARACTER_NAMES,
  PLAYER_SLOTS,
  type BoardView,
  type CharacterId,
  type RankingEntryInfo,
  type SlotNumber,
} from '@chaos-party/protocol';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type RefObject,
} from 'react';
import { CoinIcon, TrophyIcon } from '../board/icons.tsx';
import type { FinaleSpeed } from '../config.ts';
import { attachPerf } from '../debug/perf.ts';
import { markFirstFrame, markScene } from '../debug/sceneMarks.ts';
import { playerName, winnerText } from '../board/texts.ts';
import { soundEngine } from '../fx/audio.ts';
import { CharacterPortrait } from '../lobby/CharacterPortrait.tsx';
import { bonusAwards } from './awards.ts';
import {
  buildFinalePlan,
  finaleCues,
  finaleStateAt,
  winningCriterion,
  type FinaleCard,
  type FinaleState,
} from './finalePlan.ts';
import { createPodiumStage, type PodiumEntry, type PodiumStage } from './podiumStage.ts';
import { CRITERION_BADGE, tiebreakText, winnerReason } from './texts.ts';
import type { ChaosFinaleTestHook } from './testHook.ts';
import './finale.css';

/** Faktor für `fast` (E2E und ungeduldige Spielrunden). */
export const FAST_FACTOR = 4;

interface FinaleProps {
  /** Stand in `game-results` mit `ranking`. */
  readonly view: BoardView;
  readonly ranking: readonly RankingEntryInfo[];
  readonly speed: FinaleSpeed;
  readonly test: boolean;
  /** „Nochmal spielen“ (sendet `rematch`); `null` = Knopf aus. */
  readonly onRematch: (() => void) | null;
}

function colorStyle(slot: SlotNumber): CSSProperties {
  return { '--player-color': PLAYER_SLOTS[slot].color } as CSSProperties;
}

function characterOf(view: BoardView, slot: SlotNumber) {
  return view.players.find((p) => p.slot === slot)?.character ?? 'robot';
}

/** Podest samt Leinwand: das Finale baut es, der Siegerbildschirm zeigt es. */
interface PreparedPodium {
  readonly stage: PodiumStage;
  readonly canvas: HTMLCanvasElement;
}

/** Ablage für das vorbereitete Podest (externer Speicher für `useSyncExternalStore`). */
interface PodiumBox {
  readonly get: () => PreparedPodium | null;
  readonly set: (podium: PreparedPodium | null) => void;
  readonly subscribe: (listener: () => void) => () => void;
}

function createPodiumBox(): PodiumBox {
  let current: PreparedPodium | null = null;
  const listeners = new Set<() => void>();
  return {
    get: () => current,
    set: (podium) => {
      current = podium;
      for (const listener of listeners) listener();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** Podest nur neu bauen, wenn sich Plätze, Namen oder Figuren ändern (nicht bei jedem Stand). */
function usePodiumEntries(
  view: BoardView,
  ranking: readonly RankingEntryInfo[],
): readonly PodiumEntry[] {
  const entriesKey = JSON.stringify(
    ranking.map((entry) => [
      entry.slot,
      entry.place,
      playerName(view, entry.slot),
      characterOf(view, entry.slot),
    ]),
  );
  return useMemo(
    () =>
      (JSON.parse(entriesKey) as [SlotNumber, number, string, CharacterId][]).map(
        ([slot, place, name, character]) => ({ slot, place, name, character }),
      ),
    [entriesKey],
  );
}

export function Finale({ view, ranking, speed, test, onRematch }: FinaleProps) {
  const plan = useMemo(() => buildFinalePlan(ranking, view.endedEarly), [ranking, view.endedEarly]);
  const [elapsed, setElapsed] = useState(speed === 'skip' ? Number.POSITIVE_INFINITY : 0);
  const state = finaleStateAt(plan, ranking, elapsed);
  const previous = useRef<FinaleState | null>(null);
  const [podiumReady, setPodiumReady] = useState(false);
  const podiumRef = useRef<{ step: (frames: number) => void } | null>(null);
  const entries = usePodiumEntries(view, ranking);
  const parkingRef = useRef<HTMLDivElement>(null);
  const [podiumBox] = useState(createPodiumBox);

  // Podest vorbereiten, sobald das Finale beginnt (unsichtbar, ohne Render-Schleife).
  useEffect(() => {
    const parking = parkingRef.current;
    if (!parking) return;
    // Standbild-Kennzahl je Szenenwechsel (nur Debug, CHAOS-153): Vorbereitung während der
    // Zählung bis zum vorab gezeichneten Bild; das Zeigen misst der Siegerbildschirm.
    markScene('podest', 'aufbau');
    const canvas = document.createElement('canvas');
    canvas.className = 'game-canvas';
    canvas.setAttribute('aria-label', 'Siegerpodest');
    parking.appendChild(canvas);
    const stage = createPodiumStage({ canvas, entries, testMode: test });
    const stopFirstFrame = markFirstFrame('podest', stage);
    podiumRef.current = stage;
    podiumBox.set({ stage, canvas });
    return () => {
      stopFirstFrame();
      podiumBox.set(null);
      podiumRef.current = null;
      stage.dispose();
      canvas.remove();
    };
  }, [entries, test, podiumBox]);

  // Uhr: läuft selbst (normal/fast), steht bei `manual` (nur Testhaken) und `skip`.
  useEffect(() => {
    if (speed === 'manual' || speed === 'skip' || state.done) return;
    const factor = speed === 'fast' ? FAST_FACTOR : 1;
    let last = performance.now();
    const timer = setInterval(() => {
      const now = performance.now();
      const delta = (now - last) * factor;
      last = now;
      setElapsed((value) => value + delta);
    }, 50);
    return () => {
      clearInterval(timer);
    };
  }, [speed, state.done]);

  // Klänge bei jedem sichtbaren Schritt (im Testmodus ist der Ton ohnehin stumm).
  useEffect(() => {
    const cues = finaleCues(previous.current, state);
    previous.current = state;
    for (const cue of cues) soundEngine().play(cue);
  });

  // Testhaken.
  const latest = useRef({ state, podiumReady });
  useEffect(() => {
    latest.current = { state, podiumReady };
  });
  useEffect(() => {
    if (!test) return;
    const hook: ChaosFinaleTestHook = {
      get beat() {
        return latest.current.state.beat.kind;
      },
      get beatIndex() {
        return latest.current.state.beatIndex;
      },
      get done() {
        return latest.current.state.done;
      },
      get podiumReady() {
        return latest.current.podiumReady;
      },
      winnerAtMs: plan.winnerAtMs,
      advance: (ms: number) => {
        setElapsed((value) => value + ms);
      },
      seek: (ms: number) => {
        setElapsed(ms);
      },
      skip: () => {
        setElapsed(Number.POSITIVE_INFINITY);
      },
      stepPodium: (frames: number) => {
        podiumRef.current?.step(frames);
      },
    };
    window.__chaosFinale = hook;
    return () => {
      if (window.__chaosFinale === hook) delete window.__chaosFinale;
    };
  }, [test, plan]);

  return (
    <>
      {/* Parkplatz der Podest-Leinwand während der Zählung: gleiche Größe, unsichtbar. */}
      <div className="finale-parking" aria-hidden="true">
        <div className="finale-podium" ref={parkingRef} />
      </div>
      {state.done ? (
        <WinnerScreen
          view={view}
          ranking={ranking}
          podiumBox={podiumBox}
          parkingRef={parkingRef}
          onRematch={onRematch}
          onPodiumReady={setPodiumReady}
        />
      ) : (
        <Tally
          view={view}
          state={state}
          onSkip={() => {
            setElapsed(Number.POSITIVE_INFINITY);
          }}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Trophäenzählung
// ---------------------------------------------------------------------------------------------

function Tally({
  view,
  state,
  onSkip,
}: {
  readonly view: BoardView;
  readonly state: FinaleState;
  readonly onSkip: () => void;
}) {
  const { beat } = state;
  let title = 'Die Trophäenzählung!';
  let lead = 'Wer hat die meisten Trophäen? Bei Gleichstand zählen die Münzen.';
  if (beat.kind === 'reveal') {
    lead =
      beat.place === 1
        ? 'Und auf Platz 1 …'
        : `Platz ${String(beat.place)}: ${playerName(view, beat.slot)}`;
  } else if (beat.kind === 'tiebreak') {
    ({ title, lead } = tiebreakText(beat.criterion));
  }
  return (
    <div
      className="finale finale--tally"
      data-testid="board-results"
      data-done="false"
      data-beat={beat.kind}
    >
      <header className="finale-head">
        <p className="finale-kicker">
          {view.endedEarly ? 'Partie vorzeitig beendet' : 'Spielende'}
        </p>
        <h2 className="finale-title" data-testid="finale-title">
          {title}
        </h2>
        <p className="finale-lead" data-testid="finale-lead">
          {lead}
        </p>
      </header>
      <ol className="finale-cards" aria-label="Trophäenzählung">
        {state.cards.map((card) => (
          <TallyCard key={card.slot} view={view} card={card} />
        ))}
      </ol>
      <button type="button" className="finale-skip" data-testid="finale-skip" onClick={onSkip}>
        Überspringen ›
      </button>
    </div>
  );
}

/** KI-Abzeichen eines Slots („KI · Saboteur“) oder `null` bei Menschen (CHAOS-182). */
function aiTaglineOf(view: BoardView, slot: SlotNumber): string | null {
  return aiTagline(view.players.find((player) => player.slot === slot));
}

function TallyCard({ view, card }: { readonly view: BoardView; readonly card: FinaleCard }) {
  const character = characterOf(view, card.slot);
  const badge = CRITERION_BADGE[card.decidedBy];
  return (
    <li
      className="finale-card"
      data-testid={`finale-card-${String(card.slot)}`}
      data-revealed={card.revealed}
      data-active={card.active}
      data-place={card.placeShown ? card.place : ''}
      style={colorStyle(card.slot)}
    >
      <span className="finale-card-figure">
        <CharacterPortrait character={character} />
        <span className="player-dot" aria-hidden="true">
          <span className="player-symbol">{PLAYER_SLOTS[card.slot].symbol}</span>
        </span>
      </span>
      <span className="finale-card-name">{playerName(view, card.slot)}</span>
      {aiTaglineOf(view, card.slot) === null ? (
        <span className="finale-card-character">{CHARACTER_NAMES[character].name}</span>
      ) : (
        // Eine KI heißt nach ihrer Figur; statt der Figur steht ihr Abzeichen da (CHAOS-182).
        <span
          className="finale-card-character ai-badge"
          data-testid={`finale-ai-${String(card.slot)}`}
        >
          {aiTaglineOf(view, card.slot)}
        </span>
      )}
      <span className="finale-card-stat finale-card-stat--trophies">
        <TrophyIcon size={40} />
        <span data-testid={`finale-trophies-${String(card.slot)}`}>
          {card.revealed ? card.trophies : '?'}
        </span>
      </span>
      <span className="finale-card-stat finale-card-stat--coins">
        <CoinIcon size={32} />
        <span data-testid={`finale-coins-${String(card.slot)}`}>
          {card.revealed ? card.coins : '?'}
        </span>
      </span>
      {card.placeShown && (
        <span className="finale-card-place" data-testid={`finale-place-${String(card.slot)}`}>
          {card.place}.{badge && <span className="finale-card-badge">{badge}</span>}
        </span>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------------------------
// Siegerbildschirm
// ---------------------------------------------------------------------------------------------

function WinnerScreen({
  view,
  ranking,
  podiumBox,
  parkingRef,
  onRematch,
  onPodiumReady,
}: {
  readonly view: BoardView;
  readonly ranking: readonly RankingEntryInfo[];
  readonly podiumBox: PodiumBox;
  readonly parkingRef: RefObject<HTMLDivElement | null>;
  readonly onRematch: (() => void) | null;
  readonly onPodiumReady: (ready: boolean) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const criterion = winningCriterion(ranking);
  const awards = bonusAwards(view.players).slice(0, 3);
  const rows = [...ranking].sort((a, b) => a.place - b.place || a.slot - b.slot);
  const podium = useSyncExternalStore(podiumBox.subscribe, podiumBox.get);
  const [readyStage, setReadyStage] = useState<PodiumStage | null>(null);
  const [failedStage, setFailedStage] = useState<PodiumStage | null>(null);
  const shownStage = podium?.stage ?? null;
  const podiumState =
    shownStage !== null && readyStage === shownStage
      ? 'ready'
      : shownStage !== null && failedStage === shownStage
        ? 'error'
        : 'loading';

  // Vorbereitete Leinwand einhängen und zeigen; beim Verlassen zurück auf den Parkplatz.
  useEffect(() => {
    const container = containerRef.current;
    const parking = parkingRef.current;
    if (!container || !podium) return;
    const { stage, canvas } = podium;
    container.appendChild(canvas);
    markScene('podest', 'sichtbar');
    stage.show();
    const stopPerf = attachPerf('podest', stage);
    const stopFirstFrame = markFirstFrame('podest', stage);
    let active = true;
    stage.ready.then(
      () => {
        if (!active) return;
        setReadyStage(stage);
        onPodiumReady(true);
      },
      () => {
        if (active) setFailedStage(stage);
      },
    );
    return () => {
      active = false;
      stopPerf();
      stopFirstFrame();
      stage.hide();
      // Nur ein noch lebendes Podest parken (das Finale entsorgt es sonst selbst).
      if (podiumBox.get() === podium) parking?.appendChild(canvas);
      onPodiumReady(false);
    };
  }, [podium, podiumBox, parkingRef, onPodiumReady]);

  // Fokus auf „Nochmal spielen“, sobald der Knopf benutzbar ist (auch nach einer Trennung).
  const canRematch = onRematch !== null;
  useEffect(() => {
    if (canRematch) buttonRef.current?.focus();
  }, [canRematch]);

  return (
    <div
      className="finale finale--winner"
      data-testid="board-results"
      data-done="true"
      data-beat="winner"
      data-podium={podiumState}
    >
      <div className="finale-podium" ref={containerRef} />
      {view.endedEarly && (
        <p className="finale-early" data-testid="finale-ended-early">
          Vorzeitig beendet – es zählt der Stand von Runde {Math.max(1, view.round)}/{view.rounds}
        </p>
      )}
      <aside className="finale-panel" aria-label="Endstand">
        <p className="finale-kicker">Endstand</p>
        <h2 className="finale-winner" data-testid="board-winner">
          {winnerText(view) ?? 'Spielende'}
        </h2>
        {criterion && (
          <p className="finale-reason" data-testid="finale-reason">
            {winnerReason(criterion)}
          </p>
        )}
        <ol className="finale-ranking">
          {rows.map((entry) => {
            const badge = CRITERION_BADGE[entry.decidedBy];
            return (
              <li
                key={entry.slot}
                className="finale-rank"
                data-testid={`board-rank-${String(entry.slot)}`}
                data-place={entry.place}
                style={colorStyle(entry.slot)}
              >
                <span className="finale-rank-place">{entry.place}.</span>
                <span className="finale-rank-figure">
                  <CharacterPortrait character={characterOf(view, entry.slot)} />
                </span>
                <span className="finale-rank-who">
                  <span className="finale-rank-name">
                    <span className="finale-rank-symbol" aria-hidden="true">
                      {PLAYER_SLOTS[entry.slot].symbol}
                    </span>
                    {playerName(view, entry.slot)}
                  </span>
                  {aiTaglineOf(view, entry.slot) !== null && (
                    <span
                      className="ai-badge finale-rank-ai"
                      data-testid={`board-rank-ai-${String(entry.slot)}`}
                    >
                      {aiTaglineOf(view, entry.slot)}
                    </span>
                  )}
                  {badge && <span className="finale-rank-badge">{badge}</span>}
                </span>
                <span className="finale-rank-values">
                  <TrophyIcon size={24} />
                  {entry.trophies}
                  <CoinIcon size={22} />
                  {entry.coins}
                </span>
              </li>
            );
          })}
        </ol>
        {awards.length > 0 && (
          <ul className="finale-awards" aria-label="Bonus-Titel" data-testid="finale-awards">
            {awards.map((award) => (
              <li key={award.id} className="finale-award" data-award={award.id}>
                <b>{award.title}</b>
                <span>
                  {award.slots.map((slot) => playerName(view, slot)).join(' & ')} · {award.detail}
                </span>
              </li>
            ))}
          </ul>
        )}
        <button
          ref={buttonRef}
          type="button"
          className="start-button finale-rematch"
          data-testid="rematch-button"
          disabled={onRematch === null}
          onClick={() => {
            onRematch?.();
          }}
        >
          Nochmal spielen
        </button>
        <p className="finale-rematch-hint">Zurück in die Lobby – Figuren und Runden bleiben.</p>
      </aside>
    </div>
  );
}
