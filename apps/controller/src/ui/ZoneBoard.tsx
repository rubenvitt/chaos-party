import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from 'react';
import {
  isCharacterId,
  PLAYER_SLOTS,
  type Button,
  type CharacterId,
  type PlayerInfo,
  type SlotNumber,
  type Vote,
} from '@chaos-party/protocol';
import { alertPromptId } from '../board/alertTone.ts';
import { chooseIntent, choiceById, describePrompt, isLocked, ownPrompt } from '../board/prompt.ts';
import { describeWaiting } from '../board/status.ts';
import { createMoveSender, type MoveSender } from '../input/moveSender.ts';
import { describeLobby, HINT_READY, type SiblingCharacter } from '../lobby/view.ts';
import {
  describePlay,
  describeVote,
  INTRO_READY_BUTTON,
  readyIntroToken,
  sameReadyIntro,
  VOTE_LABELS,
  VOTE_QUESTION,
} from '../minigame/view.ts';
import type { SlotIntent } from '../net/client.ts';
import { ownCharacter } from '../state/character.ts';
import type { FeedbackPulse, Notice, PendingChoice, SlotContext } from '../state/reducer.ts';
import { describeSlotScreen } from '../state/screen.ts';
import {
  BADGE_STRIP,
  boardZoneFrames,
  buildZones,
  lobbyZoneFrames,
  MAX_ZONES,
  minigameVoteFrames,
  minigameZoneFrames,
  parseChoiceControl,
  parsePickControl,
  parseVoteControl,
  rectCenter,
  ZONE_PADDING,
  type ControlGeometry,
  type Rect,
  type Size,
  type ZoneControlsInput,
  type ZoneGeometry,
} from '../zones/geometry.ts';
import { routeTouchEvent, TOUCH_EVENT_TYPES } from '../zones/touchRouter.ts';
import { contextKey, zoneControlsInput } from '../zones/zoneInput.ts';
import { createZoneTracker, type ZoneEffect, type ZoneTracker } from '../zones/zoneTracker.ts';
import { ChoiceFace, CountdownBar, ReactionBuzz, StatusBar, WaitingCard } from './board.tsx';
import { CharacterPortrait } from './CharacterPortrait.tsx';
import { readableTextColor, slotColorVars } from './color.ts';
import { FinalCard, PauseCard } from './final.tsx';
import { CharacterFace, LobbyHead, ReadyBadge } from './lobby.tsx';
import { cardData, ownerStyle } from './lobbyCard.ts';
import { IntroReadyDone, MinigameCard, MinigameHeader } from './minigame.tsx';
import { Toast } from './screens.tsx';
import { useInterruption } from './useInterruption.ts';
import { useArmedSlots, type WaitingIntro } from './useReadyGuard.ts';

export interface ZoneBoardProps {
  players: readonly PlayerInfo[];
  contexts: Readonly<Partial<Record<SlotNumber, SlotContext>>>;
  feedback: Readonly<Partial<Record<SlotNumber, FeedbackPulse>>>;
  /** Gesendete, noch unbeantwortete Wahlen je Slot (Brettphase, CHAOS-22). */
  choices?: Readonly<Partial<Record<SlotNumber, PendingChoice>>>;
  /** Gesendete, noch unbestätigte Figurenwahl je Slot (Lobby, CHAOS-36). */
  picks?: Readonly<Partial<Record<SlotNumber, CharacterId>>>;
  /** Hinweis für genau eine Zone (`notice.slot`), gedreht in dieser Zone (CHAOS-40). */
  notice?: Notice | null;
  onDismissNotice?: (id: number) => void;
  send: (intent: SlotIntent) => void;
}

const NO_CHOICES: Readonly<Partial<Record<SlotNumber, PendingChoice>>> = {};
const NO_PICKS: Readonly<Partial<Record<SlotNumber, CharacterId>>> = {};
const NO_DISMISS = () => undefined;

/* ---------------------------------------------------------------------------
 * Größe der Spielfläche (= Layout-Viewport; die Fläche ist `position: fixed`).
 * ------------------------------------------------------------------------- */

function subscribeViewport(onChange: () => void): () => void {
  window.addEventListener('resize', onChange);
  window.addEventListener('orientationchange', onChange);
  return () => {
    window.removeEventListener('resize', onChange);
    window.removeEventListener('orientationchange', onChange);
  };
}

function viewportSnapshot(): string {
  const root = document.documentElement;
  return `${String(root.clientWidth)}x${String(root.clientHeight)}`;
}

/** Daumen, den eine Zone gesendet hat (CHAOS-218); gilt nur für genau diesen Minispiel-Lauf. */
interface PendingVote {
  readonly run: string;
  readonly vote: Vote;
}

/** Ein Minispiel-Lauf: Spiel und Runde (wie der `key` der Ergebniskarte am iPhone). */
function minigameRun(context: SlotContext | undefined): string | null {
  const minigame = context?.minigame;
  return minigame ? `${minigame.id}:${String(context.board?.round ?? 0)}` : null;
}

/**
 * Gewählter Daumen einer Zone: gesendet (sofort sichtbar), sonst die Stimme vom Server.
 * Eine Vormerkung aus einem früheren Lauf zählt nicht.
 */
function selectedVote(context: SlotContext, pending: PendingVote | undefined): Vote | null {
  const own = pending?.run === minigameRun(context) ? pending.vote : null;
  return describeVote(context, own).selected;
}

function parseSize(key: string): Size {
  const [width = 0, height = 0] = key.split('x').map(Number);
  return { width, height };
}

/**
 * „Bereit gesendet“ gilt nur für genau den Kontext, in dem gesendet wurde – in der
 * Minispiel-Anleitung (CHAOS-214) auch für Folgekontexte derselben Anleitung (andere Plätze
 * melden sich bereit), damit der Knopf bis zur Antwort des Servers gesperrt bleibt.
 */
function sentKey(sentIn: SlotContext | undefined, current: SlotContext | undefined) {
  if (sentIn === undefined || current === undefined) return undefined;
  return sentIn === current || sameReadyIntro(sentIn, current) ? contextKey(current) : undefined;
}

/** Gegenstück zu `siblingKey` in {@link ZoneBoard}: „1=robot,2=“ → Figuren je Platz. */
function parseSiblings(key: string): SiblingCharacter[] {
  if (key === '') return [];
  return key.split(',').map((entry) => {
    const [slot = '0', character = ''] = entry.split('=');
    return {
      slot: Number(slot) as SlotNumber,
      character: isCharacterId(character) ? character : null,
    };
  });
}

/* ---------------------------------------------------------------------------
 * Anzeige direkt im DOM nachführen (kein React-Rendern pro Fingerbewegung, A7).
 * ------------------------------------------------------------------------- */

function syncView(board: HTMLElement | null, tracker: ZoneTracker) {
  if (!board) return;
  for (const zoneEl of board.querySelectorAll<HTMLElement>('[data-zone-slot]')) {
    const slot = Number(zoneEl.dataset.zoneSlot) as SlotNumber;
    const view = tracker.view(slot);

    const stickEl = zoneEl.querySelector<HTMLElement>('[data-role="stick"]');
    const base = stickEl?.querySelector<HTMLElement>('[data-role="stick-base"]');
    const knob = stickEl?.querySelector<HTMLElement>('[data-role="stick-knob"]');
    if (stickEl && base && knob) {
      if (view.stick) {
        const dx = view.stick.origin.x - Number(stickEl.dataset.cx);
        const dy = view.stick.origin.y - Number(stickEl.dataset.cy);
        base.style.transform = `translate(-50%, -50%) translate(${String(dx)}px, ${String(dy)}px)`;
        knob.style.transform = `translate(${String(view.stick.knob.dx)}px, ${String(view.stick.knob.dy)}px)`;
      } else {
        base.style.transform = '';
        knob.style.transform = '';
      }
      const active = view.stick ? 'true' : 'false';
      stickEl.dataset.active = active;
      base.dataset.active = active;
    }

    for (const buttonEl of zoneEl.querySelectorAll<HTMLElement>('[data-role="button"]')) {
      const pressed = view.pressed.includes(buttonEl.dataset.button as Button);
      buttonEl.dataset.pressed = pressed ? 'true' : 'false';
    }
    const readyEl = zoneEl.querySelector<HTMLElement>('[data-role="ready"]');
    if (readyEl) readyEl.dataset.pressed = view.readyHeld ? 'true' : 'false';

    for (const choiceEl of zoneEl.querySelectorAll<HTMLElement>('[data-role="choice"]')) {
      const held = view.choicesHeld.some((kind) => kind === choiceEl.dataset.control);
      choiceEl.dataset.pressed = held ? 'true' : 'false';
    }
    for (const pickEl of zoneEl.querySelectorAll<HTMLElement>('[data-role="pick"]')) {
      const held = view.picksHeld.some((kind) => kind === pickEl.dataset.control);
      pickEl.dataset.pressed = held ? 'true' : 'false';
    }
    for (const voteEl of zoneEl.querySelectorAll<HTMLElement>('[data-role="vote"]')) {
      const held = view.votesHeld.some((kind) => kind === voteEl.dataset.control);
      voteEl.dataset.pressed = held ? 'true' : 'false';
    }
  }
}

/**
 * Geteiltes iPad (CHAOS-13, ADR-008): eine Spielerzone pro Platz dieser Verbindung.
 *
 * Eingabe über **Touch Events** auf der ganzen Fläche: Der Zonen-Tracker ordnet
 * jede Berührung beim Aufsetzen einer Zone und einem Bedienelement zu (reine
 * Geometrie, dieselben Rechtecke wie die Darstellung). Alle Kinder haben
 * `pointer-events: none`, damit das Ziel jeder Berührung die stabile Fläche ist –
 * verschwindende Knöpfe (Kontextwechsel) können so keine Touch-Folgen verschlucken.
 */
export function ZoneBoard({
  players,
  contexts,
  feedback,
  choices = NO_CHOICES,
  picks = NO_PICKS,
  notice = null,
  onDismissNotice = NO_DISMISS,
  send,
}: ZoneBoardProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const sizeKey = useSyncExternalStore(subscribeViewport, viewportSnapshot);
  const viewport = useMemo(() => parseSize(sizeKey), [sizeKey]);
  const [tracker] = useState(createZoneTracker);
  /**
   * Kontext, in dem die Zone `ready` gesendet hat (blendet den Knopf aus). Gilt nur, solange
   * genau dieser Kontext angezeigt wird: Nach Umwählen (setzt bereit zurück, CHAOS-36) oder
   * einer Revanche kommt ein neuer Kontext und der Knopf erscheint wieder.
   */
  const [readySent, setReadySent] = useState<Partial<Record<SlotNumber, SlotContext>>>({});
  /** Gesendete Daumen je Zone (CHAOS-218): leuchten sofort, bis der Server bestätigt. */
  const [votes, setVotes] = useState<Partial<Record<SlotNumber, PendingVote>>>({});

  const seated = useMemo(() => players.slice(0, MAX_ZONES), [players]);
  /** Figuren aller Plätze dieses Geräts: Vergebene zeigen die Farbe des Nachbarn (CHAOS-38). */
  const siblingKey = seated
    .map(({ slot }) => `${String(slot)}=${contexts[slot]?.lobby?.character ?? ''}`)
    .join(',');
  // Nur bei geänderten Figuren neu (stabile Referenz für die memoisierten Zonen).
  const siblings = useMemo(() => parseSiblings(siblingKey), [siblingKey]);
  // Schonfrist je Zone (CHAOS-214): ab dem Moment, in dem die Anleitung „Bereit“ anbietet.
  const waitingIntros = seated.flatMap(({ slot }): WaitingIntro[] => {
    const token = readyIntroToken(contexts[slot]);
    return token === null ? [] : [[slot, token]];
  });
  const armedSet = useArmedSlots(waitingIntros);
  // Stabile Referenz für die memoisierten Zonen: nur bei geänderter Menge neu.
  const armedKey = [...armedSet].join(',');
  const introArmed = useMemo(
    () => new Set(armedKey === '' ? [] : armedKey.split(',').map(Number)),
    [armedKey],
  );
  const inputs = useMemo(() => {
    const map = new Map<SlotNumber, ZoneControlsInput>();
    for (const { slot } of seated) {
      map.set(
        slot,
        zoneControlsInput(
          contexts[slot],
          sentKey(readySent[slot], contexts[slot]),
          slot,
          choices[slot],
          {
            pick: picks[slot],
            siblings: siblings.filter((s) => s.slot !== slot),
            introArmed: introArmed.has(slot),
          },
        ),
      );
    }
    return map;
  }, [seated, contexts, readySent, choices, picks, siblings, introArmed]);
  const zones = useMemo(
    () =>
      buildZones(
        seated.map((p) => p.slot),
        viewport,
        (slot) => inputs.get(slot) ?? { layout: 'wait', actions: [] },
      ),
    [seated, viewport, inputs],
  );

  const movers = useMemo(() => {
    const map = new Map<SlotNumber, MoveSender>();
    for (const { slot } of seated) {
      map.set(
        slot,
        createMoveSender((stick) => {
          send({ type: 'move', slot, x: stick.x, y: stick.y });
        }),
      );
    }
    return map;
  }, [seated, send]);

  // Neueste Werte für Ereignis-Handler (vor dem setZones-Effekt aktualisiert).
  const latest = useRef({ contexts, choices, movers, send });
  useLayoutEffect(() => {
    latest.current = { contexts, choices, movers, send };
  });

  const apply = useCallback(
    (effects: readonly ZoneEffect[]) => {
      const {
        contexts: ctxs,
        choices: pending,
        movers: senders,
        send: sendIntent,
      } = latest.current;
      for (const effect of effects) {
        switch (effect.type) {
          case 'stick':
            senders.get(effect.slot)?.update(effect.stick);
            break;
          case 'press':
          case 'release':
            sendIntent({ type: effect.type, slot: effect.slot, button: effect.button });
            break;
          case 'ready': {
            const context = ctxs[effect.slot];
            if (!context?.actions.includes('ready')) break;
            sendIntent({ type: 'ready', slot: effect.slot });
            setReadySent((prev) => ({ ...prev, [effect.slot]: context }));
            break;
          }
          case 'pick': {
            // Nur in der Lobby mit Charakterwahl; vergebene Karten sind ohnehin `inert`.
            if (!ctxs[effect.slot]?.actions.includes('pick-character')) break;
            sendIntent({ type: 'pick-character', slot: effect.slot, character: effect.character });
            break;
          }
          case 'vote': {
            // Nur in der Ergebnisanzeige, solange der Server `rate` anbietet (CHAOS-87/218).
            const context = ctxs[effect.slot];
            const run = minigameRun(context);
            if (!context?.minigame || run === null || !describeVote(context).open) break;
            sendIntent({
              type: 'rate',
              slot: effect.slot,
              minigameId: context.minigame.id,
              round: context.board?.round ?? 0,
              vote: effect.vote,
            });
            setVotes((prev) => ({ ...prev, [effect.slot]: { run, vote: effect.vote } }));
            break;
          }
          case 'choose': {
            // Nur für den angezeigten Prompt dieser Zone; die Sitzung sperrt danach (CHAOS-22).
            const intent = chooseIntent(
              effect.slot,
              ctxs[effect.slot],
              pending[effect.slot],
              effect.option,
              effect.promptId,
            );
            if (intent) sendIntent(intent);
            break;
          }
        }
      }
      syncView(boardRef.current, tracker);
    },
    [tracker],
  );

  // Neue Zonen (Kontext, Drehen, Größe): Tracker nachführen, ggf. loslassen.
  useLayoutEffect(() => {
    apply(tracker.setZones(zones));
  }, [apply, tracker, zones]);

  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    const onTouch = (event: TouchEvent) => {
      // Kein Scrollen/Zoomen, keine nachgeahmten Maus-Klicks.
      if (event.cancelable) event.preventDefault();
      const rect = board.getBoundingClientRect();
      apply(routeTouchEvent(tracker, event, { x: rect.left, y: rect.top }));
    };
    for (const type of TOUCH_EVENT_TYPES) {
      board.addEventListener(type, onTouch, { passive: false });
    }
    return () => {
      for (const type of TOUCH_EVENT_TYPES) board.removeEventListener(type, onTouch);
    };
  }, [apply, tracker]);

  // App-Wechsel, Sperrbildschirm, Verschwinden: alle Zonen lassen los.
  useInterruption(() => {
    apply(tracker.cancelAll());
  });

  const orientation = viewport.width >= viewport.height ? 'landscape' : 'portrait';

  return (
    <div
      ref={boardRef}
      className="zone-board"
      data-testid="zone-board"
      data-seats={seated.length}
      data-orientation={orientation}
    >
      {zones.map((zone) => {
        const player = seated.find((p) => p.slot === zone.slot);
        if (!player) return null;
        return (
          <Zone
            key={zone.slot}
            zone={zone}
            player={player}
            players={seated}
            context={contexts[zone.slot]}
            feedback={feedback[zone.slot]}
            pending={choices[zone.slot]}
            pick={picks[zone.slot]}
            siblings={siblings}
            introReady={inputs.get(zone.slot)?.introReady}
            vote={votes[zone.slot]}
            notice={notice?.slot === zone.slot ? notice : null}
            onDismissNotice={onDismissNotice}
          />
        );
      })}
    </div>
  );
}

interface ZoneProps {
  zone: ZoneGeometry;
  player: PlayerInfo;
  players: readonly PlayerInfo[];
  context: SlotContext | undefined;
  feedback: FeedbackPulse | undefined;
  pending: PendingChoice | undefined;
  pick: CharacterId | undefined;
  /** Figuren aller Plätze dieses Geräts (auch der eigene; wird hier herausgefiltert). */
  siblings: readonly SiblingCharacter[];
  /** „Bereit“ in der Minispiel-Anleitung (CHAOS-214); fehlt = feste Anleitungszeit. */
  introReady: ZoneControlsInput['introReady'];
  /** Gesendeter Daumen dieser Zone (CHAOS-218). */
  vote: PendingVote | undefined;
  /** Hinweis nur für diese Zone (gedreht mit der Zone). */
  notice: Notice | null;
  onDismissNotice: (id: number) => void;
}

function rectStyle(rect: { x: number; y: number; width: number; height: number }): CSSProperties {
  return { left: rect.x, top: rect.y, width: rect.width, height: rect.height };
}

const Zone = memo(function Zone({
  zone,
  player,
  players,
  context,
  feedback,
  pending,
  pick,
  siblings,
  introReady,
  vote,
  notice,
  onDismissNotice,
}: ZoneProps) {
  const layout = context?.layout ?? 'wait';
  const screen = describeSlotScreen(context);
  const style = {
    ...rectStyle(zone.rect),
    '--player': player.color,
    '--on-player': readableTextColor(player.color),
  } as CSSProperties;
  const contentStyle: CSSProperties = {
    width: zone.local.width,
    height: zone.local.height,
    transform: `translate(-50%, -50%) rotate(${String(zone.rotation)}deg)`,
  };
  const control = (kind: ControlGeometry['kind']) => zone.controls.find((c) => c.kind === kind);
  const ready = control('ready');
  const stick = control('stick');
  const minigame = context?.minigame;
  const play = context && layout === 'joystick-buttons' ? describePlay(context) : null;
  const buttons = (['a', 'b'] as const).flatMap((button) => {
    const geometry = control(button === 'a' ? 'button-a' : 'button-b');
    const label = play?.buttons.find((entry) => entry.button === button)?.label ?? null;
    return geometry ? [{ button, geometry, label }] : [];
  });
  const lobby =
    screen === 'lobby'
      ? describeLobby(
          context,
          pick,
          siblings.filter((s) => s.slot !== player.slot),
        )
      : null;
  const badge = (
    <header className="player-badge zone-badge" data-testid="player-badge">
      <span className="badge-avatar">
        <CharacterPortrait
          character={ownCharacter(player.slot, context)}
          className="badge-portrait"
          decorative
        />
        <span className="player-symbol" aria-hidden="true">
          {PLAYER_SLOTS[player.slot].symbol}
        </span>
      </span>
      <span className="player-label ui-text">{player.label}</span>
    </header>
  );

  return (
    <section
      className={`zone layout-${layout} screen-${screen}${minigame ? ` minigame-${minigame.stage}` : ''}`}
      style={style}
      data-testid={`zone-${String(zone.slot)}`}
      data-zone-slot={zone.slot}
      data-layout={layout}
      data-screen={screen}
      data-phase={context?.phase ?? 'none'}
      data-minigame-stage={minigame?.stage ?? 'none'}
      data-rotation={zone.rotation}
      // Angriff auf diese Zone (CHAOS-122): Rahmen pulsiert, damit der Ton einen Adressaten hat.
      data-alert={alertPromptId(context, player.slot) === null ? 'none' : 'reaction'}
    >
      <div className="zone-content" style={contentStyle}>
        {play && play.title !== null ? (
          // Minispiel läuft (CHAOS-33): Plakette und Titel nebeneinander im Kopfstreifen.
          <div className="zone-head">
            {badge}
            <MinigameHeader title={play.title} cue={play.cue} className="zone-minigame-header" />
          </div>
        ) : (
          badge
        )}

        {lobby && <ZoneLobby zone={zone} view={lobby} />}

        {screen === 'lobby-basic' &&
          (ready ? (
            <div
              className="ready-button zone-ready"
              data-testid="ready-button"
              data-role="ready"
              style={rectStyle(ready.rect)}
            >
              <span className="ui-text">Bereit!</span>
            </div>
          ) : (
            <div className="zone-message ready-done" data-testid="ready-done">
              <span className="ready-check" aria-hidden="true">
                ✓
              </span>
              <p className="panel-lead ui-text">Du bist dabei! Gleich geht&apos;s los …</p>
            </div>
          ))}

        {screen === 'wait' && (
          <div className="zone-message" data-testid="wait-panel">
            <span className="wait-dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <p className="panel-lead ui-text">Schau auf den großen Bildschirm!</p>
          </div>
        )}

        {layout === 'joystick-buttons' && stick && (
          <div
            className="joystick-zone"
            data-testid="joystick"
            data-role="stick"
            data-active="false"
            data-cx={rectCenter(stick.rect).x - stick.rect.x}
            data-cy={rectCenter(stick.rect).y - stick.rect.y}
            style={rectStyle(stick.rect)}
          >
            <div
              className="joystick-base"
              data-role="stick-base"
              data-active="false"
              style={{ width: zone.stickRadius * 2, height: zone.stickRadius * 2 }}
            >
              <div className="joystick-knob" data-role="stick-knob" />
            </div>
            <span className="joystick-hint ui-text" data-testid="joystick-hint">
              {play?.stickHint}
            </span>
          </div>
        )}

        {layout === 'joystick-buttons' &&
          buttons.map(({ button, geometry, label }) => (
            <div
              key={button}
              className={`action-button action-${button} zone-button${label === null ? '' : ' has-label'}`}
              data-testid={`button-${button}`}
              data-role="button"
              data-button={button}
              aria-label={`Knopf ${button.toUpperCase()}${label === null ? '' : `: ${label}`}`}
              style={rectStyle(geometry.rect)}
            >
              <span className="action-letter ui-text">{button.toUpperCase()}</span>
              {label !== null && (
                <span className="action-label ui-text" data-testid={`button-${button}-label`}>
                  {label}
                </span>
              )}
            </div>
          ))}

        {screen === 'pause' && (
          <div className="zone-board-phase" data-testid="board-panel" data-game-phase="paused">
            {context?.board && (
              <div className="zone-status" style={rectStyle(boardZoneFrames(zone.local).status)}>
                <StatusBar board={context.board} compact />
              </div>
            )}
            <div className="zone-waiting" style={rectStyle(boardZoneFrames(zone.local).body)}>
              <PauseCard compact />
            </div>
          </div>
        )}

        {screen === 'final' && context?.board && (
          <div className="zone-final" style={rectStyle(belowBadge(zone))}>
            <FinalCard board={context.board} compact />
          </div>
        )}

        {(screen === 'board' || screen === 'minigame') && context && (
          <ZoneBoardContent
            zone={zone}
            players={players}
            context={context}
            pending={pending}
            introReady={introReady}
            vote={vote}
          />
        )}

        {feedback && (
          <span
            key={feedback.id}
            className={`feedback feedback-${feedback.kind}`}
            data-testid="feedback"
          />
        )}

        {notice && <Toast key={notice.id} notice={notice} onDismiss={onDismissNotice} zone />}
      </div>
    </section>
  );
});

/** Fläche unter der Plakette (Minispiel-Karten, Endstand). */
function belowBadge(zone: ZoneGeometry) {
  return {
    x: ZONE_PADDING,
    y: BADGE_STRIP,
    width: Math.max(0, zone.local.width - 2 * ZONE_PADDING),
    height: Math.max(0, zone.local.height - BADGE_STRIP - ZONE_PADDING),
  };
}

/**
 * Lobby mit Charakterwahl in einer Zone (CHAOS-36/38): Kopf mit Rundenzahl, Figurenkarten
 * und „Bereit!“ an genau den Rechtecken, die der Zonen-Tracker prüft (`zone.controls`).
 * Gewählt wird beim Abheben auf einer freien Karte.
 */
function ZoneLobby({
  zone,
  view,
}: {
  zone: ZoneGeometry;
  view: NonNullable<ReturnType<typeof describeLobby>>;
}) {
  const frames = lobbyZoneFrames(zone.local);
  const ready = zone.controls.find((c) => c.kind === 'ready');
  const cards = zone.controls.flatMap((control) => {
    const id = parsePickControl(control.kind);
    const card = view.cards.find((c) => c.id === id);
    return card ? [{ control, card }] : [];
  });
  return (
    <div
      className="zone-lobby"
      data-testid="lobby-panel"
      data-ready={view.ready ? 'true' : 'false'}
      data-character={view.character ?? ''}
    >
      <div className="zone-lobby-head" style={rectStyle(frames.head)}>
        <LobbyHead view={view} />
      </div>
      {cards.map(({ control, card }) => (
        <div
          key={control.kind}
          className="character-card zone-character"
          {...cardData(card)}
          data-role="pick"
          data-control={control.kind}
          data-pressed="false"
          style={{ ...rectStyle(control.rect), ...ownerStyle(card) }}
        >
          <CharacterFace card={card} />
        </div>
      ))}
      {ready ? (
        <div
          className="ready-button zone-ready lobby-ready"
          data-testid="ready-button"
          data-role="ready"
          style={rectStyle(ready.rect)}
        >
          <span className="ui-text">Bereit!</span>
        </div>
      ) : (
        <div className="zone-lobby-foot" style={rectStyle(frames.foot)}>
          {view.ready ? (
            <>
              <ReadyBadge compact />
              <p className="zone-lobby-hint ui-text" data-testid="lobby-hint">
                {HINT_READY}
              </p>
            </>
          ) : (
            view.canReady && (
              <p className="lobby-sending ui-text" data-testid="ready-sending" role="status">
                Gesendet …
              </p>
            )
          )}
        </div>
      )}
    </div>
  );
}

interface ZoneBoardContentProps {
  zone: ZoneGeometry;
  players: readonly PlayerInfo[];
  context: SlotContext;
  pending: PendingChoice | undefined;
  introReady: ZoneControlsInput['introReady'];
  vote: PendingVote | undefined;
}

/**
 * Brettphase in einer Zone (CHAOS-22): kompakte Statuszeile, Titel, Countdown und die
 * Wahlknöpfe an genau den Rechtecken, die der Zonen-Tracker prüft (`zone.controls`).
 */
function ZoneBoardContent({
  zone,
  players,
  context,
  pending,
  introReady,
  vote,
}: ZoneBoardContentProps) {
  if (context.minigame?.stage === 'results' && zone.controls.some(isVoteControl)) {
    return <ZoneMinigameVote zone={zone} context={context} vote={vote} />;
  }
  if (context.minigame) {
    // Minispiel-Intro/-Ergebnis (CHAOS-33): ganze Fläche unter der Plakette, ohne Stand.
    // Wartet die Anleitung auf „Bereit“ (CHAOS-214), liegt der Knopf in einer Fußzeile darunter –
    // genau am Rechteck, das der Zonen-Tracker prüft.
    const withFoot = context.minigame.stage === 'intro' && introReady !== undefined;
    const frames = minigameZoneFrames(zone.local, withFoot);
    const ready = withFoot ? zone.controls.find((c) => c.kind === 'ready') : undefined;
    return (
      <div
        className="zone-board-phase"
        data-testid="minigame-panel"
        data-game-phase={context.board?.gamePhase ?? 'none'}
      >
        <div className="zone-minigame" style={rectStyle(frames.card)}>
          <MinigameCard
            minigame={context.minigame}
            compact
            readyLine={withFoot ? null : undefined}
          />
        </div>
        {withFoot &&
          (ready ? (
            <div
              className="ready-button zone-ready minigame-ready-button"
              data-testid="minigame-ready-button"
              data-role="ready"
              data-armed={ready.inert === true ? 'false' : 'true'}
              aria-disabled={ready.inert === true}
              style={rectStyle(ready.rect)}
            >
              <span className="ui-text">{INTRO_READY_BUTTON}</span>
            </div>
          ) : (
            introReady === 'done' && (
              <div className="zone-minigame-foot" style={rectStyle(frames.foot)}>
                <IntroReadyDone compact />
              </div>
            )
          ))}
      </div>
    );
  }
  const frames = boardZoneFrames(zone.local);
  const prompt = ownPrompt(context, zone.slot);
  const view = prompt ? describePrompt(prompt.info) : null;
  const locked = prompt ? isLocked(prompt, pending) : false;
  const choices = zone.controls.flatMap((control) => {
    const parsed = parseChoiceControl(control.kind);
    const choice = parsed && view ? choiceById(view, parsed.option) : undefined;
    return choice ? [{ control, choice }] : [];
  });
  const extraIds = new Set(view?.extra.map((c) => c.id));

  return (
    <div
      className="zone-board-phase"
      data-testid="board-panel"
      data-prompt-kind={view?.kind ?? 'none'}
      data-game-phase={context.board?.gamePhase ?? 'none'}
    >
      {context.board && (
        <div className="zone-status" style={rectStyle(frames.status)}>
          <StatusBar board={context.board} compact />
        </div>
      )}
      {prompt && view ? (
        <div
          className="zone-prompt"
          data-testid="prompt"
          data-kind={view.kind}
          data-prompt-id={prompt.info.id}
          data-locked={locked ? 'true' : 'false'}
        >
          {view.kind === 'reaction' && <ReactionBuzz promptId={prompt.info.id} />}
          <h2 className="prompt-title zone-prompt-title ui-text" style={rectStyle(frames.title)}>
            {locked ? 'Gesendet … warte kurz' : prompt.info.title}
          </h2>
          {locked && <span hidden data-testid="choice-sent" />}
          <div className="zone-timer" style={rectStyle(frames.timer)}>
            <CountdownBar key={prompt.info.id} prompt={prompt} big={view.kind === 'reaction'} />
          </div>
          {choices.map(({ control, choice }) => (
            <div
              key={control.kind}
              className={`choice-button ${extraIds.has(choice.id) ? 'choice-extra' : 'choice-main'} tone-${choice.tone} zone-choice`}
              data-testid={`choice-${choice.id}`}
              data-role="choice"
              data-control={control.kind}
              data-option={choice.id}
              data-pressed="false"
              data-disabled={locked ? 'true' : 'false'}
              data-chosen={locked && pending?.option === choice.id ? 'true' : 'false'}
              style={{
                ...rectStyle(control.rect),
                ...(slotColorVars(choice.slot === null ? null : PLAYER_SLOTS[choice.slot].color) as
                  CSSProperties | undefined),
              }}
            >
              <ChoiceFace choice={choice} />
            </div>
          ))}
        </div>
      ) : (
        <div className="zone-waiting" style={rectStyle(frames.body)}>
          <WaitingCard view={describeWaiting(context.board, zone.slot, players)} compact />
        </div>
      )}
    </div>
  );
}

function isVoteControl(control: ControlGeometry): boolean {
  return parseVoteControl(control.kind) !== null;
}

/** Rechteck relativ zu einem anderen (Kinder einer absolut liegenden Fußzeile). */
function within(rect: Rect, outer: Rect): Rect {
  return { ...rect, x: rect.x - outer.x, y: rect.y - outer.y };
}

/**
 * Minispiel-Ergebnis mit Daumen in einer Zone (CHAOS-218): Ergebniskarte oben, darunter Frage
 * und 👍/👎 an genau den Rechtecken, die der Zonen-Tracker prüft. Die Wahl leuchtet sofort,
 * erneutes Tippen ändert sie; die Bestätigung kommt mit dem nächsten Kontext (`minigame.vote`).
 */
function ZoneMinigameVote({
  zone,
  context,
  vote,
}: {
  zone: ZoneGeometry;
  context: SlotContext;
  vote: PendingVote | undefined;
}) {
  const frames = minigameVoteFrames(zone.local);
  const selected = selectedVote(context, vote);
  const buttons = zone.controls.flatMap((control) => {
    const kind = parseVoteControl(control.kind);
    return kind === null ? [] : [{ control, kind }];
  });
  return (
    <div
      className="zone-board-phase"
      data-testid="minigame-panel"
      data-game-phase={context.board?.gamePhase ?? 'none'}
    >
      {context.minigame && (
        <div className="zone-minigame" style={rectStyle(frames.card)}>
          <MinigameCard minigame={context.minigame} compact />
        </div>
      )}
      <div
        className="zone-vote"
        data-testid="minigame-vote"
        data-minigame={context.minigame?.id ?? ''}
        data-selected={selected ?? ''}
        style={rectStyle(frames.foot)}
      >
        {frames.question.width > 0 && (
          <p
            className="zone-vote-question ui-text"
            style={rectStyle(within(frames.question, frames.foot))}
          >
            {VOTE_QUESTION}
          </p>
        )}
        {buttons.map(({ control, kind }) => (
          <div
            key={control.kind}
            className={`vote-button vote-${kind} zone-vote-button`}
            data-testid={`vote-${kind}`}
            data-role="vote"
            data-control={control.kind}
            data-pressed="false"
            aria-label={VOTE_LABELS[kind]}
            aria-pressed={selected === kind}
            style={rectStyle(within(control.rect, frames.foot))}
          >
            <span aria-hidden="true">{kind === 'up' ? '👍' : '👎'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
