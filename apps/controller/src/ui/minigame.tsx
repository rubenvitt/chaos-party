/**
 * Minispiele am Controller (M3, CHAOS-33): Intro (Titel, Anleitung, Bedienlegende) und
 * eigenes Ergebnis, gemeinsam für iPhone (`SlotController`) und iPad-Zone (`ZoneBoard`,
 * `compact`). Das Spiel-Layout selbst bleibt Joystick + Knöpfe (`PlayPanel`, Zonen).
 */
import { useState, type CSSProperties, type ReactNode } from 'react';
import type { ControllerMinigameInfo, ControllerMinigameTeam, Vote } from '@chaos-party/protocol';
import {
  controlLegend,
  describeResult,
  describeVote,
  INTRO_READY,
  INTRO_READY_BUTTON,
  INTRO_READY_DONE_HEAD,
  INTRO_READY_DONE_HINT,
  introReadyState,
  REPEAT_KICKER,
  VOTE_QUESTION,
  type ControlLegendItem,
} from '../minigame/view.ts';
import { ITEM_INFO } from '../board/items.ts';
import { LOOK_AT_SCREEN } from '../board/status.ts';
import type { SlotContext } from '../state/reducer.ts';
import { Icon } from './icons.tsx';
import { describeTeamResult, describeTeamRole } from './minigameTeam.ts';
import { useArmed } from './useReadyGuard.ts';

/** Kleines Abbild eines Bedienelements (Joystick-Ring bzw. Knopf A/B) für die Legende. */
export function ControlKey({ kind }: { kind: ControlLegendItem['kind'] }) {
  if (kind === 'stick') {
    return (
      <span className="control-key key-stick" aria-hidden="true">
        <i />
      </span>
    );
  }
  return (
    <span className={`control-key key-${kind}`} aria-hidden="true">
      {kind.toUpperCase()}
    </span>
  );
}

const KEY_NAME: Readonly<Record<ControlLegendItem['kind'], string>> = {
  stick: 'Joystick',
  a: 'Knopf A',
  b: 'Knopf B',
};

/**
 * Anleitung vor dem Minispiel: kurz und groß, keine Scroll-Wüste. Lief das Minispiel in der
 * Partie schon (`repeat`, CHAOS-66), nur Titel und Bedienlegende.
 *
 * `readyLine` ersetzt die Schlusszeile (CHAOS-214): iPhone den Bereit-Knopf, iPad-Zone `null`
 * (der Knopf liegt dort an der Zonen-Geometrie unter der Karte). Fehlt = „Gleich geht’s los!“.
 */
export function MinigameIntro({
  minigame,
  compact = false,
  readyLine,
}: {
  minigame: ControllerMinigameInfo;
  compact?: boolean;
  readyLine?: ReactNode;
}) {
  const legend = controlLegend(minigame.controls);
  const repeat = minigame.repeat === true;
  return (
    <div
      className="minigame-card minigame-intro"
      data-testid="minigame-intro"
      data-minigame={minigame.id}
      data-compact={compact}
      data-repeat={repeat}
    >
      <div className="minigame-heading">
        <p className="minigame-kicker ui-text" data-testid="minigame-kicker">
          <Icon name="star" size={compact ? 20 : 24} />
          {repeat ? REPEAT_KICKER : 'Minispiel'}
        </p>
        <h2 className="minigame-title ui-text" data-testid="minigame-title">
          {minigame.title}
        </h2>
        {!repeat && (
          <p className="minigame-tagline ui-text" data-testid="minigame-tagline">
            {minigame.tagline}
          </p>
        )}
      </div>
      {minigame.team && <TeamRole team={minigame.team} />}
      <div className="minigame-howto">
        {!repeat && (
          <ol className="minigame-steps" data-testid="minigame-steps">
            {minigame.instructions.map((line, i) => (
              <li key={`${String(i)}-${line}`} className="ui-text">
                {line}
              </li>
            ))}
          </ol>
        )}
        {legend.length > 0 && (
          <ul className="control-legend" data-testid="control-legend" aria-label="Bedienung">
            {legend.map((item) => (
              <li
                key={item.kind}
                className="legend-item"
                data-testid={`legend-${item.kind}`}
                aria-label={`${KEY_NAME[item.kind]}: ${item.label}`}
              >
                <ControlKey kind={item.kind} />
                <span className="legend-label ui-text">{item.label}</span>
              </li>
            ))}
          </ul>
        )}
        {readyLine === undefined ? (
          <p className="minigame-ready ui-text" data-testid="minigame-ready">
            {INTRO_READY}
          </p>
        ) : (
          readyLine
        )}
      </div>
    </div>
  );
}

/** Eigene Rolle bei Teams bzw. Koop (CHAOS-89): Symbol, Name, mit wem und gegen wen. */
function TeamRole({ team }: { team: ControllerMinigameTeam }) {
  const text = describeTeamRole(team);
  return (
    <div
      className="minigame-team-role"
      data-testid="minigame-team-role"
      data-role={team.role}
      style={{ '--team-color': text.color } as CSSProperties}
    >
      <span className="minigame-team-role-mark" aria-hidden="true">
        {text.symbol}
      </span>
      <span className="minigame-team-role-text">
        <b className="ui-text">{text.title}</b>
        <span className="ui-text">{text.detail}</span>
      </span>
    </div>
  );
}

/**
 * Eigenes Ergebnis: Platz groß (bei Gleichstand ausdrücklich „Geteilter Platz“), Punkte mit
 * Einheit, Münzen aus `reward` (CHAOS-55); bei Abbruch ein klarer Hinweis statt Wertung.
 */
export function MinigameResult({
  minigame,
  compact = false,
  voting,
}: {
  minigame: ControllerMinigameInfo;
  compact?: boolean;
  /** Daumen-Knöpfe (CHAOS-87), nur am iPhone; fehlt = keine Knöpfe. */
  voting?: VotingProps | undefined;
}) {
  const view = describeResult(minigame);
  // Daumen nur, wenn der Server sie anbietet; sonst bleibt der Hinweis auf den Bildschirm.
  const openVoting = voting && describeVote(voting.context).open ? voting : undefined;
  return (
    <div
      className="minigame-card minigame-result"
      data-testid="minigame-result"
      data-kind={view.kind}
      data-place={view.kind === 'placed' ? view.place : ''}
      data-tied={view.kind === 'placed' && view.tied ? 'true' : 'false'}
      data-compact={compact}
    >
      <p className="minigame-kicker ui-text">
        <Icon name="star" size={compact ? 20 : 24} />
        {minigame.title}
      </p>
      {view.kind === 'placed' ? (
        <>
          <div
            className="result-place"
            data-testid="result-place"
            data-place={view.place}
            data-tied={view.tied ? 'true' : 'false'}
          >
            {view.place === 1 && <Icon name="trophy" size={compact ? 36 : 52} />}
            <b className="ui-text">{view.headline}</b>
          </div>
          {minigame.team && describeTeamResult(minigame.team) !== null && (
            <p className="result-team ui-text" data-testid="result-team">
              {describeTeamResult(minigame.team)}
            </p>
          )}
          <p className="result-cheer ui-text">{view.cheer}</p>
          {view.score !== null && (
            <p className="result-score ui-text" data-testid="result-score">
              {view.score}
            </p>
          )}
          {view.reward !== null && (
            <p className="result-reward" data-testid="result-reward">
              <Icon name="coin" size={compact ? 22 : 28} />
              <b className="ui-text">{view.reward}</b>
            </p>
          )}
          {view.prizes.length > 0 && (
            <p
              className="result-reward result-prize"
              data-testid="result-prize"
              data-items={view.prizes.join(' ')}
            >
              {view.prizes.map((item, i) => (
                <Icon
                  key={`${item}-${String(i)}`}
                  name={ITEM_INFO[item].icon}
                  size={compact ? 22 : 28}
                />
              ))}
              <b className="ui-text">
                Trostpreis: {view.prizes.map((item) => ITEM_INFO[item].name).join(', ')}
              </b>
            </p>
          )}
          <p className="minigame-lead ui-text" data-testid="minigame-lead">
            {view.lead}
          </p>
        </>
      ) : (
        <>
          <div className="result-aborted" data-testid="result-aborted">
            <b className="ui-text">{view.headline}</b>
          </div>
          <p className="minigame-lead ui-text">{view.lead}</p>
        </>
      )}
      {openVoting && <VoteButtons minigame={minigame} {...openVoting} />}
      {!compact && !openVoting && <p className="minigame-look ui-text">{LOOK_AT_SCREEN}</p>}
    </div>
  );
}

export interface VotingProps {
  readonly context: Pick<SlotContext, 'actions' | 'minigame'>;
  readonly onVote: (vote: Vote) => void;
}

const VOTE_LABELS: Readonly<Record<Vote, string>> = {
  up: 'Daumen hoch',
  down: 'Daumen runter',
};

/**
 * Daumen hoch/runter nach dem Minispiel (CHAOS-87): freiwillig, nichts wartet darauf. Die Wahl
 * leuchtet sofort (gesendet), die Bestätigung kommt mit dem nächsten Kontext (`minigame.vote`).
 * Umentscheiden geht, solange die Ergebnisanzeige läuft.
 */
function VoteButtons({
  minigame,
  context,
  onVote,
}: VotingProps & { readonly minigame: ControllerMinigameInfo }) {
  const [pending, setPending] = useState<Vote | null>(null);
  const view = describeVote(context, pending);
  if (!view.open) return null;
  return (
    <div
      className="minigame-vote"
      data-testid="minigame-vote"
      data-minigame={minigame.id}
      data-selected={view.selected ?? ''}
    >
      <p className="minigame-vote-question ui-text">{VOTE_QUESTION}</p>
      <div className="minigame-vote-buttons">
        {(['up', 'down'] as const).map((vote) => (
          <button
            key={vote}
            type="button"
            className={`vote-button vote-${vote}`}
            data-testid={`vote-${vote}`}
            aria-label={VOTE_LABELS[vote]}
            aria-pressed={view.selected === vote}
            onClick={() => {
              setPending(vote);
              onVote(vote);
            }}
          >
            <span aria-hidden="true">{vote === 'up' ? '👍' : '👎'}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Bestätigung nach „Bereit!“ in der Anleitung (CHAOS-214). */
export function IntroReadyDone({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className="minigame-ready-done"
      data-testid="minigame-ready-done"
      data-compact={compact}
      role="status"
    >
      <span className="ready-check" aria-hidden="true">
        ✓
      </span>
      <span className="minigame-ready-done-text">
        <b className="ui-text">{INTRO_READY_DONE_HEAD}</b>{' '}
        <span className="ui-text">{INTRO_READY_DONE_HINT}</span>
      </span>
    </div>
  );
}

/**
 * iPhone: „Bereit!“ in der Anleitung (CHAOS-214). Sperrt nach dem Tippen bis zum nächsten
 * Kontext (`key` setzt der Aufrufer, wie bei `LobbyPanel`); in der Schonfrist nach dem
 * Erscheinen ist der Knopf sichtbar gesperrt und ignoriert Tipper (`aria-disabled`, kein
 * `disabled`, damit Tipper wirklich ankommen und verpuffen).
 */
export function IntroReadyControl({
  context,
  onReady,
}: {
  context: Pick<SlotContext, 'actions' | 'minigame'>;
  onReady: () => void;
}) {
  const [sent, setSent] = useState(false);
  const armed = useArmed();
  const state = introReadyState(context, { sent, armed });
  if (state === 'done') return <IntroReadyDone />;
  if (state === 'timer') {
    return (
      <p className="minigame-ready ui-text" data-testid="minigame-ready">
        {INTRO_READY}
      </p>
    );
  }
  return (
    <button
      type="button"
      className="ready-button minigame-ready-button"
      data-testid="minigame-ready-button"
      data-armed={state === 'button'}
      aria-disabled={state === 'guard'}
      onClick={() => {
        if (state !== 'button') return;
        setSent(true);
        onReady();
      }}
    >
      <span className="ui-text">{INTRO_READY_BUTTON}</span>
    </button>
  );
}

/** Intro oder Ergebnis je nach Stage (`play` zeigt das Spiel-Layout, nicht diese Karte). */
export function MinigameCard({
  minigame,
  compact = false,
  readyLine,
  voting,
}: {
  minigame: ControllerMinigameInfo;
  compact?: boolean;
  /** Nur Intro: ersetzt die Schlusszeile (siehe {@link MinigameIntro}). */
  readyLine?: ReactNode;
  /** Nur Ergebnis: Daumen-Knöpfe (CHAOS-87). */
  voting?: VotingProps | undefined;
}) {
  if (minigame.stage === 'results') {
    return <MinigameResult minigame={minigame} compact={compact} voting={voting} />;
  }
  return <MinigameIntro minigame={minigame} compact={compact} readyLine={readyLine} />;
}

/** Kleiner Kopf im Spiel-Layout: Minispiel-Titel. */
export function MinigameHeader({ title, className }: { title: string; className?: string }) {
  return (
    <div className={`minigame-header ${className ?? ''}`} data-testid="minigame-header">
      <Icon name="star" size={18} />
      <span className="minigame-header-title ui-text">{title}</span>
    </div>
  );
}
