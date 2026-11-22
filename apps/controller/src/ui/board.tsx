/**
 * Bausteine der Brettphase (CHAOS-22), gemeinsam für iPhone (`BoardPanel`) und
 * geteiltes iPad (`ZoneBoard`): Statuszeile, Knopf-Inhalt, Countdown, Warte-Anzeige.
 */
import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { PLAYER_SLOTS, type ControllerBoardInfo, type SlotNumber } from '@chaos-party/protocol';
import {
  countdownFraction,
  remainingAt,
  secondsLeft,
  type ActivePrompt,
} from '../board/countdown.ts';
import { ITEM_INFO } from '../board/items.ts';
import type { ChoiceView } from '../board/prompt.ts';
import {
  LOOK_AT_SCREEN,
  otherTurnHeadline,
  placeHeadline,
  roundLabel,
  TAILWIND_LEAD,
  tailwindHeadline,
  type WaitingView,
} from '../board/status.ts';
import { useAlertTone } from './alertToneContext.ts';
import { readableTextColor } from './color.ts';
import { Icon } from './icons.tsx';

/** Eigener Stand: Münzen, Trophäen, Runde, Items (Symbol + Kurztext; kompakt nur Symbol). */
export function StatusBar({
  board,
  compact = false,
}: {
  board: ControllerBoardInfo;
  compact?: boolean;
}) {
  const iconSize = compact ? 24 : 28;
  return (
    <div className="board-status" data-testid="board-status" data-compact={compact}>
      <span className="stat" data-testid="stat-coins" aria-label={`${board.coins} Münzen`}>
        <Icon name="coin" size={iconSize} />
        <b className="stat-value ui-text">{board.coins}</b>
      </span>
      <span className="stat" data-testid="stat-trophies" aria-label={`${board.trophies} Trophäen`}>
        <Icon name="trophy" size={iconSize} />
        <b className="stat-value ui-text">{board.trophies}</b>
      </span>
      <span className="stat stat-round ui-text" data-testid="stat-round">
        {roundLabel(board)}
      </span>
      <span className="stat-items" data-testid="stat-items" data-count={board.items.length}>
        {board.items.length === 0 ? (
          <span className="item-none ui-text">Keine Items</span>
        ) : (
          board.items.map((item, i) => (
            <span
              key={`${item}-${String(i)}`}
              className="item-chip"
              data-item={item}
              aria-label={ITEM_INFO[item].name}
            >
              <Icon name={ITEM_INFO[item].icon} size={compact ? 22 : 24} />
              {!compact && <span className="item-name ui-text">{ITEM_INFO[item].name}</span>}
            </span>
          ))
        )}
      </span>
    </div>
  );
}

/** Inhalt eines Wahlknopfs: Symbol (bzw. Spielersymbol), Text, Zusatz. */
export function ChoiceFace({ choice }: { choice: ChoiceView }) {
  return (
    <>
      {choice.slot !== null ? (
        <span className="choice-symbol player-symbol" aria-hidden="true">
          {PLAYER_SLOTS[choice.slot].symbol}
        </span>
      ) : (
        choice.icon !== null && <Icon name={choice.icon} className="choice-icon" />
      )}
      <span className="choice-text">
        <span className="choice-label ui-text">{choice.label}</span>
        {choice.detail !== null && <span className="choice-detail ui-text">{choice.detail}</span>}
      </span>
    </>
  );
}

/**
 * Countdown-Balken (nur Anzeige; die Frist entscheidet der Server). Läuft per
 * `requestAnimationFrame` direkt im DOM, ohne React-Rendern pro Bild. Ohne Frist: nichts.
 * `data-remaining-ms` hilft Tests, die Zeit abzulesen.
 */
export function CountdownBar({ prompt, big = false }: { prompt: ActivePrompt; big?: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const now = performance.now();
      const left = remainingAt(prompt, now) ?? 0;
      const fraction = countdownFraction(prompt, now) ?? 0;
      if (fillRef.current) fillRef.current.style.transform = `scaleX(${String(fraction)})`;
      if (textRef.current) textRef.current.textContent = String(secondsLeft(left));
      if (rootRef.current) {
        rootRef.current.dataset.remainingMs = String(Math.round(left));
        rootRef.current.dataset.urgent = fraction < 0.34 ? 'true' : 'false';
      }
      if (left > 0) frame = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [prompt]);

  if (prompt.deadlineAt === null) return null;
  return (
    <div
      ref={rootRef}
      className={big ? 'countdown countdown-big' : 'countdown'}
      data-testid="countdown"
      role="timer"
    >
      <div className="countdown-track">
        <div ref={fillRef} className="countdown-fill" />
      </div>
      <span ref={textRef} className="countdown-seconds ui-text" />
    </div>
  );
}

/**
 * Beim Erscheinen einer Reaktion: kurzer Hinweiston (CHAOS-122, erst nach einer Nutzergeste)
 * und Vibration, falls verfügbar. Beides nie Pflicht.
 */
export function ReactionBuzz({ promptId }: { promptId: number }) {
  const tone = useAlertTone();
  useEffect(() => {
    // Hinweiston (CHAOS-122): nur nach einer früheren Nutzergeste, einmal je Prompt.
    tone?.play(promptId);
    try {
      const vibrate = (navigator as Partial<Pick<Navigator, 'vibrate'>>).vibrate;
      vibrate?.call(navigator, [90, 50, 90]);
    } catch {
      // Kein Vibrationsmotor oder vom Browser verboten (iOS-Safari kennt die API nicht).
    }
  }, [promptId, tone]);
  return null;
}

/** Anzeige ohne eigene Entscheidung: wer dran ist, Minispiel, Endplatz. */
export function WaitingCard({ view, compact = false }: { view: WaitingView; compact?: boolean }) {
  const symbolStyle = (slot: SlotNumber) =>
    ({
      '--who': PLAYER_SLOTS[slot].color,
      '--on-who': readableTextColor(PLAYER_SLOTS[slot].color),
    }) as CSSProperties;

  let mark: ReactNode;
  let headline: string;
  let lead: string | null = LOOK_AT_SCREEN;
  switch (view.kind) {
    case 'other-turn':
      mark = (
        <span className="waiting-who player-symbol" style={symbolStyle(view.slot)}>
          {PLAYER_SLOTS[view.slot].symbol}
        </span>
      );
      headline = otherTurnHeadline(view);
      break;
    case 'own-turn':
      mark = (
        <span className="waiting-who player-symbol" style={symbolStyle(view.slot)}>
          {PLAYER_SLOTS[view.slot].symbol}
        </span>
      );
      headline = 'Du bist dran!';
      break;
    case 'minigame':
      mark = <Icon name="star" size={compact ? 56 : 84} className="waiting-icon" />;
      headline = 'Minispiel läuft …';
      break;
    case 'results':
      mark = (
        <span className="waiting-place" data-testid="final-place" data-place={view.place ?? ''}>
          <Icon name="trophy" size={compact ? 40 : 56} />
          {view.place !== null && <b className="ui-text">Platz {view.place}</b>}
        </span>
      );
      headline = placeHeadline(view.place);
      lead = null;
      break;
    case 'tailwind':
      mark = <Icon name="coin" size={compact ? 56 : 84} className="waiting-icon" />;
      headline = tailwindHeadline(view.coins);
      lead = TAILWIND_LEAD;
      break;
    case 'setup':
      mark = (
        <span className="wait-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      );
      headline = 'Gleich geht’s los …';
      break;
    case 'watch':
      mark = (
        <span className="wait-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      );
      headline = LOOK_AT_SCREEN;
      lead = null;
      break;
  }

  return (
    <div
      className="waiting-card"
      data-testid="board-waiting"
      data-kind={view.kind}
      data-compact={compact}
    >
      {mark}
      <p className="waiting-headline ui-text">{headline}</p>
      {lead !== null && <p className="waiting-lead ui-text">{lead}</p>}
    </div>
  );
}
