/**
 * Vom Server-Kontext einer Zone zu dem, was sie anzeigen soll (rein, ohne DOM).
 */
import type { CharacterId, SlotNumber } from '@chaos-party/protocol';
import { describePrompt, isLocked, ownPrompt } from '../board/prompt.ts';
import { describeLobby, type SiblingCharacter } from '../lobby/view.ts';
import { describeVote, introReadyState, offeredActions } from '../minigame/view.ts';
import type { PendingChoice, SlotContext } from '../state/reducer.ts';
import type { ZoneChoicesInput, ZoneControlsInput, ZoneLobbyInput } from './geometry.ts';

/** Kennung eines Kontexts; ein neuer Kontext setzt „Bereit gesendet“ zurück (wie `LobbyPanel`). */
export function contextKey(context: SlotContext): string {
  return `${context.phase}:${context.layout}:${context.actions.join(',')}`;
}

/** Wahlknöpfe einer Zone in der Brettphase (CHAOS-22) oder `undefined` ohne eigenen Prompt. */
export function zoneChoicesInput(
  slot: SlotNumber,
  context: SlotContext | undefined,
  pending: PendingChoice | undefined,
): ZoneChoicesInput | undefined {
  const prompt = ownPrompt(context, slot);
  if (!prompt) return undefined;
  const view = describePrompt(prompt.info);
  return {
    promptId: prompt.info.id,
    main: view.main.map((choice) => choice.id),
    extra: view.extra.map((choice) => choice.id),
    instant: view.kind === 'reaction',
    locked: isLocked(prompt, pending),
  };
}

/** Figurenkarten und „Bereit!“ einer Zone in der Lobby (CHAOS-36) oder `undefined`. */
export function zoneLobbyInput(
  context: SlotContext | undefined,
  readySent: boolean,
  pick?: CharacterId,
  siblings: readonly SiblingCharacter[] = [],
): ZoneLobbyInput | undefined {
  const view = describeLobby(context, pick, siblings);
  if (!view) return undefined;
  return {
    characters: view.cards.map((card) => ({ id: card.id, selectable: card.selectable })),
    showReady: view.canReady && !view.ready && !readySent,
  };
}

/** Zusatzangaben je Zone: gesendete Wahl (Brett), vorgemerkte Figur und Nachbarplätze (Lobby). */
export interface ZoneExtras {
  readonly pending?: PendingChoice | undefined;
  readonly pick?: CharacterId | undefined;
  readonly siblings?: readonly SiblingCharacter[];
  /** Schonfrist der Anleitung vorbei: „Bereit!“ antippbar (CHAOS-214). */
  readonly introArmed?: boolean;
}

/**
 * Eingabe für {@link layoutZoneControls}. Ohne Kontext wartet die Zone.
 * `readySentFor` ist der Kontext, in dem diese Zone `ready` gesendet hat;
 * `pending` die gesendete, noch unbeantwortete Wahl dieses Slots (Brettphase).
 */
export function zoneControlsInput(
  context: SlotContext | undefined,
  readySentFor: string | undefined,
  slot?: SlotNumber,
  pending?: PendingChoice,
  extras: Omit<ZoneExtras, 'pending'> = {},
): ZoneControlsInput {
  if (!context) return { layout: 'wait', actions: [] };
  const choices = slot === undefined ? undefined : zoneChoicesInput(slot, context, pending);
  const readySent = readySentFor !== undefined && readySentFor === contextKey(context);
  const lobby = zoneLobbyInput(context, readySent, extras.pick, extras.siblings);
  const introReady =
    context.layout === 'board'
      ? introReadyState(context, { sent: readySent, armed: extras.introArmed === true })
      : 'timer';
  // Daumen nach dem Minispiel (CHAOS-218), nur solange der Server `rate` anbietet.
  const vote = context.layout === 'board' && describeVote(context).open;
  return {
    layout: context.layout,
    // Minispiel (CHAOS-33): nur Elemente, die der Steckbrief auch beschriftet.
    actions: context.layout === 'joystick-buttons' ? offeredActions(context) : context.actions,
    readySent,
    ...(choices !== undefined && { choices }),
    ...(lobby !== undefined && { lobby }),
    ...(introReady !== 'timer' && { introReady }),
    ...(vote && { vote: true as const }),
  };
}
