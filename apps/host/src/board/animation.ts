/**
 * Ereignis → Animationsschritt (CHAOS-19): wie lange ein Ereignis die Warteschlange des Hosts
 * belegt und welches kurze Popup es über einer Figur oder einem Feld zeigt. Rein, ohne Babylon.
 *
 * Die Dauern sind bewusst kurz; der Server taktet die Brettphase selbst (`Pacing`). Gerät der
 * Host trotzdem in Rückstand, spielt die Regie schneller ab oder springt (siehe `director.ts`).
 */
import type { BoardEvent, SlotNumber } from '@chaos-party/protocol';
import { ITEM_NAMES, signedAmount, type MessageTone } from './texts.ts';

export type PopupKind =
  'coins' | 'dice' | 'item' | 'trap' | 'trophy' | 'event' | 'shield' | 'steal';

export interface PopupSpec {
  readonly kind: PopupKind;
  /** Über dieser Figur … */
  readonly slot: SlotNumber | null;
  /** … oder über diesem Feld (wenn `slot` `null` ist). */
  readonly spaceId: string | null;
  /** Kurzer Text auf dem Popup (≤ 12 Zeichen), z. B. „+3“, „5“, „Falle!“. */
  readonly text: string;
  readonly tone: MessageTone;
}

export interface EventPlan {
  /** So lange wartet die Warteschlange, bevor das nächste Ereignis startet. */
  readonly durationMs: number;
  readonly popup: PopupSpec | null;
}

/**
 * Wie eine Figur zum Ziel kommt (CHAOS-52): `walk` hüpft Feld für Feld im Takt, `gust` wird
 * vom Windstoß in einem Flug weggeweht, `swap` fliegt beim Platztausch gleichzeitig mit der
 * anderen Figur über Kreuz.
 */
export type MoveStyle = 'walk' | 'gust' | 'swap';

/** Dauer, wenn `stepMs` fehlt oder 0 ist. */
export const FALLBACK_STEP_MS = 300;
/** Flug beim Windstoß (unabhängig von der Zahl der Felder). */
export const GUST_FLIGHT_MS = 900;
/** Flug beider Figuren beim Platztausch. */
export const SWAP_FLIGHT_MS = 1000;
/**
 * Ansage eines Windstoßes oder Platztauschs vor dem Flug. Kürzer als die übrigen Ereignisse:
 * Ansage plus Flug (≤ 1,4 s) bleiben unter der Server-Pause `spaceEventMs` (1,5 s, ADR-011/7).
 */
export const FLIGHT_EVENT_MS = 400;
/** So lange wartet die Regie nach der Ansage „Sabotage wird stärker!“ (CHAOS-120). */
export const SABOTAGE_NOTICE_PAUSE_MS = 1200;

/** So lange bleibt ein Popup sichtbar (auch wenn die Warteschlange schon weiterläuft). */
export const POPUP_MS = 1400;
/**
 * Abstand (Welteinheiten) zwischen gestapelten Popups (CHAOS-189): Gleichzeitig sichtbare
 * Popups über derselben Stelle bekommen in der Regie eine Ebene (`stack`), die Szene versetzt
 * sie um `stack × POPUP_STACK_HEIGHT` entlang der Bildschirm-Senkrechten (Kamera-oben). Höher
 * als das größte Popup (Würfel, 1,1), damit das Steigen des älteren Popups (Welt-Y, in der
 * Schrägsicht verkürzt) den Abstand nicht aufzehrt.
 */
export const POPUP_STACK_HEIGHT = 1.4;

const BOARD_EVENT_POPUP: Readonly<Record<string, string>> = {
  'coin-rain': 'Münzregen!',
  gust: 'Windböe!',
  swap: 'Tausch!',
  'trophy-shuffle': 'Wirbel!',
  'lucky-find': 'Glück!',
  'rapid-fire': 'Schnellfeuer!',
};

function popup(
  kind: PopupKind,
  slot: SlotNumber | null,
  text: string,
  tone: MessageTone,
  spaceId: string | null = null,
): PopupSpec {
  return { kind, slot, spaceId, text, tone };
}

/**
 * Dauer eines Bewegungsabschnitts: beim Gehen ein Takt je betretenem Feld, Windstoß und
 * Platztausch fliegen in fester Zeit.
 */
export function moveDuration(
  pathLength: number,
  stepMs: number,
  style: MoveStyle = 'walk',
): number {
  if (pathLength <= 0) return 0;
  switch (style) {
    case 'gust':
      return GUST_FLIGHT_MS;
    case 'swap':
      return SWAP_FLIGHT_MS;
    case 'walk':
      return pathLength * (stepMs > 0 ? stepMs : FALLBACK_STEP_MS);
  }
}

/** `style` gilt nur für `moved` (die Regie erkennt Windstoß und Platztausch am Ereignis davor). */
export function planEvent(event: BoardEvent, stepMs: number, style: MoveStyle = 'walk'): EventPlan {
  switch (event.type) {
    case 'moved':
      return { durationMs: moveDuration(event.path.length, stepMs, style), popup: null };
    case 'dice-rolled':
      return { durationMs: 900, popup: popup('dice', event.slot, String(event.total), 'neutral') };
    case 'coins-changed':
      if (event.delta === 0) return { durationMs: 0, popup: null };
      return {
        durationMs: 700,
        popup: popup(
          'coins',
          event.slot,
          signedAmount(event.delta),
          event.reason === 'trophy' ? 'gold' : event.delta > 0 ? 'good' : 'bad',
        ),
      };
    case 'coins-stolen':
      return { durationMs: 900, popup: popup('steal', event.from, 'Geklaut!', 'bad') };
    case 'item-gained':
      return { durationMs: 900, popup: popup('item', event.slot, ITEM_NAMES[event.item], 'good') };
    case 'item-used':
      return {
        durationMs: 800,
        popup: popup('item', event.slot, ITEM_NAMES[event.item], 'neutral'),
      };
    case 'trap-placed':
      return { durationMs: 700, popup: popup('trap', null, 'Falle', 'neutral', event.spaceId) };
    case 'trap-triggered':
      return { durationMs: 1000, popup: popup('trap', event.slot, 'Falle!', 'bad') };
    case 'trophy-bought':
      return { durationMs: 1300, popup: popup('trophy', event.slot, 'Trophäe!', 'gold') };
    case 'trophy-moved':
      return { durationMs: 900, popup: popup('trophy', null, 'Hier!', 'gold', event.to) };
    case 'board-event':
      return {
        durationMs: event.event === 'gust' || event.event === 'swap' ? FLIGHT_EVENT_MS : 1000,
        popup: popup('event', event.slot, BOARD_EVENT_POPUP[event.event] ?? 'Ereignis!', 'neutral'),
      };
    case 'reaction-resolved': {
      const text =
        event.result === 'shield'
          ? 'Schild!'
          : event.result === 'brace'
            ? 'Festhalten!'
            : 'Zu spät!';
      return {
        durationMs: 700,
        popup: popup('shield', event.slot, text, event.result === 'timeout' ? 'bad' : 'good'),
      };
    }
    case 'round-started':
      // Wachsende Sabotage (CHAOS-120): kurz innehalten, damit die Ansage vor „… ist dran!“ steht.
      return { durationMs: event.sabotage ? SABOTAGE_NOTICE_PAUSE_MS : 0, popup: null };
    case 'game-started':
    case 'turn-started':
    case 'path-chosen':
    case 'reaction-opened':
    case 'player-auto':
    case 'turn-ended':
    case 'minigame-started':
    case 'minigame-results':
    case 'round-ended':
    case 'game-ended':
      return { durationMs: 0, popup: null };
  }
}

/**
 * Lage einer Figur während eines `moved`-Abschnitts nach `elapsedMs`: von welchem Feld zu
 * welchem sie gerade hüpft und wie weit (0…1). Jeder Sprung dauert 85 % des Takts, danach
 * steht die Figur kurz auf dem Feld – das liest sich als „Feld für Feld“.
 */
export function hopAt(
  start: string,
  path: readonly string[],
  stepMs: number,
  elapsedMs: number,
): { from: string; to: string; t: number } | null {
  if (path.length === 0) return null;
  const step = stepMs > 0 ? stepMs : FALLBACK_STEP_MS;
  const index = Math.min(path.length - 1, Math.max(0, Math.floor(elapsedMs / step)));
  const local = elapsedMs - index * step;
  const to = path[index] ?? start;
  const from = index === 0 ? start : (path[index - 1] ?? start);
  return { from, to, t: Math.min(1, Math.max(0, local / (step * 0.85))) };
}
