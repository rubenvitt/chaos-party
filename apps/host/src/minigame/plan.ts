/**
 * Reine Entscheidungen der Minispiel-Bühne (M3, CHAOS-26): Wann zeigt der Host die Bühne
 * statt des Bretts, wie viel Spielzeit bleibt, was passiert nach einem Host-Neuladen.
 */
import {
  BOT_LEVEL_STRENGTH,
  CHARACTER_NAMES,
  defaultCharacterFor,
  type MinigameBotSeat,
  type MinigameInput,
} from '@chaos-party/minigame-sdk';
import type { MinigamePlayer } from '@chaos-party/minigame-sdk/babylon';
import {
  aiTagline,
  PLAYER_SLOTS,
  type AiStrength,
  type BoardView,
  type InputIntent,
  type SlotNumber,
} from '@chaos-party/protocol';

export type MinigameStageName = 'intro' | 'play' | 'results';

/** Minispiel-Abschnitt des Stands oder `null` außerhalb der Minispiel-Phasen. */
export function minigameStageOf(view: BoardView | null): MinigameStageName | null {
  if (!view?.minigame) return null;
  switch (view.gamePhase) {
    case 'minigame-intro':
      return 'intro';
    case 'minigame-play':
      return 'play';
    case 'minigame-results':
      return 'results';
    default:
      return null;
  }
}

/**
 * Schlüssel der Bühne: gleiches Minispiel derselben Runde mit demselben Seed = dieselbe
 * Bühne (bleibt über Phasenwechsel und Wiederverbinden bestehen). `null` = keine Bühne:
 * außerhalb der Minispiel-Phasen, beim Platzhalter oder bei einem unbekannten Minispiel
 * (dann zeigt das Brett sein Platzhalter-Overlay).
 */
export function stageKeyOf(
  view: BoardView | null,
  isKnown: (id: string) => boolean,
): string | null {
  const stage = minigameStageOf(view);
  const minigame = view?.minigame;
  if (!stage || !minigame || !isKnown(minigame.id)) return null;
  return `${minigame.id}:${String(minigame.round)}:${String(minigame.seed)}`;
}

/** Unter dieser Restzeit startet ein Host nach Neuladen das Minispiel nicht mehr neu. */
export const MIN_RESTART_MS = 3_000;

/**
 * Restliche Spielzeit (ms) laut Server: `playMs − elapsedMs`, abzüglich der Zeit seit dem
 * Empfang des Stands. Vor dem Spiel (`elapsedMs = null`) die volle Spielzeit.
 */
export function remainingPlayMs(view: BoardView, receivedAt: number, now: number): number {
  return Math.max(0, Math.round(serverPlayLeftMs(view, receivedAt, now)));
}

/** Wie `remainingPlayMs`, aber ungekappt: negativ = die Spielzeit des Servers ist um so viel vorbei. */
function serverPlayLeftMs(view: BoardView, receivedAt: number, now: number): number {
  const minigame = view.minigame;
  if (!minigame) return 0;
  const elapsed = minigame.elapsedMs ?? 0;
  // In der Pause (auch der Auto-Pause beim Neuladen, CHAOS-68) läuft keine Spielzeit.
  const sinceReceive =
    minigame.elapsedMs === null || view.paused ? 0 : Math.max(0, now - receivedAt);
  return minigame.playMs - elapsed - sinceReceive;
}

/**
 * So lange vor der Frist des Servers (Spielzeit + `minigameResultGraceMs`) wertet der Host ein
 * noch laufendes Minispiel selbst (CHAOS-206). 3 s decken den 100-ms-Takt des PC-Hosts, lange
 * JS-Ticks (nach CHAOS-203 am Mac höchstens 31 ms, auf langsamen Geräten mehr) und den Weg zum
 * Server mit viel Luft ab.
 */
export const RESULT_MARGIN_MS = 3_000;

/**
 * Zeit (ms) bis zur Frist des Servers für das Ergebnis, ab `now`; `null` außerhalb von
 * `minigame-play` oder ohne Frist im Stand. `view.remainingMs` ist in `minigame-play` die Zeit
 * bis zum Abbruch (Spielstart + Spielzeit + Kulanz); in der Pause steht sie.
 */
function resultDeadlineLeftMs(view: BoardView, receivedAt: number, now: number): number | null {
  if (minigameStageOf(view) !== 'play' || view.remainingMs === null) return null;
  return view.remainingMs - (view.paused ? 0 : Math.max(0, now - receivedAt));
}

/**
 * Ablauf des Hosts an der Frist des Servers ausrichten (CHAOS-206). Die Spielzeit eines
 * Minispiels steht schon im Aufbau fest (`ctx.timeLimitMs`); ist die Bühne erst nach dem
 * Countdown fertig oder rechnet der Host langsamer als die Uhr, läuft das Spiel über das Ende
 * beim Server hinaus. Das ist in Ordnung, solange das Ergebnis vor der Frist ankommt.
 * - `'end'` bei laufendem Spiel (`running`): Bis zur Frist bleiben höchstens
 *   `RESULT_MARGIN_MS`; der Host wertet jetzt (`runner.finishNow`).
 * - `'end'` bei noch nicht gestartetem Spiel: Vor diesem Punkt blieben weniger als
 *   `MIN_RESTART_MS` Spielzeit; es startet nicht mehr (Begründung bei `planPlay`), der Server
 *   bricht nach seiner Frist ohne Münzen ab.
 * - sonst `'keep'`; außerhalb von `minigame-play` immer.
 */
export function playDeadline(
  view: BoardView,
  receivedAt: number,
  now: number,
  running: boolean,
): 'keep' | 'end' {
  const left = resultDeadlineLeftMs(view, receivedAt, now);
  if (left === null) return 'keep';
  const end = running ? left <= RESULT_MARGIN_MS : left - RESULT_MARGIN_MS < MIN_RESTART_MS;
  return end ? 'end' : 'keep';
}

/**
 * Restzeit für die Anzeige im Spiel: die des Minispiels, höchstens bis zum Punkt, an dem der
 * Host wegen der Frist des Servers wertet (`playDeadline`). Sonst zeigte die Uhr beim Abbruch
 * noch Sekunden an.
 */
export function shownRemainingMs(
  hudRemainingMs: number,
  view: BoardView,
  receivedAt: number,
  now: number,
): number {
  const left = resultDeadlineLeftMs(view, receivedAt, now);
  if (left === null) return hudRemainingMs;
  return Math.max(0, Math.min(hudRemainingMs, Math.round(left - RESULT_MARGIN_MS)));
}

export type PlayPlan =
  | { readonly kind: 'play'; readonly timeLimitMs: number }
  | { readonly kind: 'wait'; readonly remainingMs: number };

/**
 * Spielzeit für eine neu aufgebaute Bühne:
 * - im Intro (oder Ergebnis): volle Spielzeit;
 * - mitten im Spiel (Host neu geladen): das Minispiel startet neu mit der Restzeit;
 * - ist die Restzeit kleiner als `MIN_RESTART_MS`, wird **nicht** neu gestartet: Ein Spiel
 *   von 1–2 s hätte ein Zufallsergebnis, und „alle 0 Punkte“ hieße Gleichstand auf Platz 1
 *   (alle bekämen die Siegermünzen). Der Host wartet; der Server bricht nach der Schonfrist
 *   ohne Münzen ab – die faire, in game-core festgelegte Rückfallregel.
 */
export function planPlay(view: BoardView, receivedAt: number, now: number): PlayPlan {
  const minigame = view.minigame;
  if (!minigame) return { kind: 'wait', remainingMs: 0 };
  if (view.gamePhase !== 'minigame-play') return { kind: 'play', timeLimitMs: minigame.playMs };
  const remaining = remainingPlayMs(view, receivedAt, now);
  return remaining >= MIN_RESTART_MS
    ? { kind: 'play', timeLimitMs: remaining }
    : { kind: 'wait', remainingMs: remaining };
}

/** Ganze Restsekunden einer Phase (Countdown wie am Brett: Restzeit ab Empfang). */
export function phaseSecondsLeft(
  remainingMs: number | null,
  receivedAt: number,
  now: number,
): number | null {
  if (remainingMs === null) return null;
  return Math.max(0, Math.ceil((remainingMs - Math.max(0, now - receivedAt)) / 1000));
}

/** Vom Server geprüfte Controller-Eingabe → Minispiel-Eingabe (Gesten/Reaktion: keine). */
export function intentToMinigameInput(
  intent: InputIntent,
): { readonly slot: SlotNumber; readonly input: MinigameInput } | null {
  switch (intent.type) {
    case 'move':
      return { slot: intent.slot, input: { type: 'move', x: intent.x, y: intent.y } };
    case 'press':
    case 'release':
      return { slot: intent.slot, input: { type: intent.type, button: intent.button } };
    case 'gesture':
    case 'reaction':
      return null;
  }
}

/**
 * Figurenname eines Slots aus dem Brett-Stand (gewählte Figur, v4/CHAOS-36). Fehlt der Slot im
 * Stand, die Standardfigur als Rückfall.
 */
export function characterName(view: Pick<BoardView, 'players'>, slot: SlotNumber): string {
  const character =
    view.players.find((player) => player.slot === slot)?.character ?? defaultCharacterFor(slot);
  return CHARACTER_NAMES[character].name;
}

/**
 * KI-Kennzeichnung eines Slots aus dem Brett-Stand (CHAOS-182, ADR-020 §7): „KI“ bzw. „KI ·
 * Saboteur“, bei Menschen `null`. Eine KI heißt nach ihrer Figur, deshalb zeigen Ergebnis und
 * Anleitung statt der Figur dieses Abzeichen.
 */
export function aiTaglineOf(view: Pick<BoardView, 'players'>, slot: SlotNumber): string | null {
  return aiTagline(view.players.find((player) => player.slot === slot));
}

/**
 * Stärke `s` eines KI-Platzes für die Minispiel-Bots (ADR-020 §4). „Dynamisch“ nimmt die
 * aktuelle Stärke aus dem Brett-Stand (`strengthLevel`, CHAOS-187; ändert sich nur am
 * Rundenende), ohne sie „mittel“.
 */
export function botStrength(strength: AiStrength | undefined, strengthLevel?: number): number {
  if (strength === 'dynamisch' && strengthLevel !== undefined) return strengthLevel;
  if (strength === undefined || strength === 'dynamisch') return BOT_LEVEL_STRENGTH.mittel;
  return BOT_LEVEL_STRENGTH[strength];
}

/**
 * KI-Plätze des laufenden Minispiels für `createMinigameRunner({ bots })` (CHAOS-182, ADR-020
 * Nachtrag 1): alle KI-Plätze aus dem Brett-Stand nach Slot (alle Plätze spielen mit). PC- und Apple-Host
 * nutzen dieselbe Funktion.
 */
export function botSeatsFromView(view: Pick<BoardView, 'players'>): MinigameBotSeat[] {
  return [...view.players]
    .filter((player) => player.kind === 'ai')
    .sort((a, b) => a.slot - b.slot)
    .map((player) => ({
      slot: player.slot,
      strength: botStrength(player.strength, player.strengthLevel),
    }));
}

/** Teilnehmer eines Minispiels aus dem Brett-Stand (nach Slot sortiert). */
export function playersFromView(view: BoardView): MinigamePlayer[] {
  return [...view.players]
    .sort((a, b) => a.slot - b.slot)
    .map((player) => ({
      slot: player.slot,
      name: player.name,
      color: PLAYER_SLOTS[player.slot].color,
      symbol: PLAYER_SLOTS[player.slot].symbol,
      character: player.character,
    }));
}
