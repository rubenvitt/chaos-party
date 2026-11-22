/**
 * Minispiele am Controller (M3, CHAOS-33): was iPhone und iPad-Zone in Intro, Spiel und
 * Ergebnis zeigen. Rein, ohne DOM – dieselben Funktionen nutzen `SlotController`,
 * `ZoneBoard` und die Zonen-Geometrie.
 *
 * Grundsatz wie in der Brettphase: Der Server entscheidet, was angeboten wird
 * (`actions`); der Steckbrief (`minigame.controls`) liefert nur die Beschriftung und kann
 * ein Element zusätzlich ausblenden (`null`). Fehlt `minigame` (Platzhalter-Minispiel,
 * M1-Arena), bleibt alles wie bisher.
 */
import type {
  Action,
  Button,
  ControllerMinigameInfo,
  ItemKindName,
  MinigameControlsInfo,
  MinigameCueInfo,
  MinigameSecretInfo,
  Vote,
} from '@chaos-party/protocol';
import type { SlotContext } from '../state/reducer.ts';

export type MinigameStage = ControllerMinigameInfo['stage'];

/** Schlusszeile im Intro (feste Anleitungszeit, ältere Server). */
export const INTRO_READY = 'Gleich geht’s los!';
/** Knopf in der Anleitung, wenn sie auf Bereitschaft wartet (CHAOS-214). */
export const INTRO_READY_BUTTON = 'Bereit!';
/** Bestätigung nach „Bereit!“ in der Anleitung (CHAOS-214), zweizeilig: Kopf und Hinweis. */
export const INTRO_READY_DONE_HEAD = 'Bereit!';
export const INTRO_READY_DONE_HINT = 'Warte auf die anderen …';
export const INTRO_READY_DONE = `${INTRO_READY_DONE_HEAD} ${INTRO_READY_DONE_HINT}`;
/**
 * Schonfrist nach dem Erscheinen der Anleitung (CHAOS-214): So lange ist „Bereit!“ sichtbar
 * gesperrt, damit ein Tipper vom vorigen Bildschirm (Würfeln, Wahl) nicht durchrutscht.
 */
export const INTRO_READY_GUARD_MS = 600;
/** Kurzes Intro (CHAOS-66): Minispiel lief in der Partie schon, nur Titel und Bedienlegende. */
export const REPEAT_KICKER = 'Nochmal!';
/** Hinweis unter dem Ergebnis: Danach geht es am PC weiter. */
export const RESULTS_LEAD = 'Gleich geht’s auf dem Brett weiter.';
/** Hinweis unter dem Ergebnis einer Übungsrunde aus der Galerie (CHAOS-87). */
export const PRACTICE_LEAD = 'Übungsrunde ohne Münzen – gleich geht’s zurück in die Lobby.';
/** Frage über den Daumen-Knöpfen (CHAOS-87). */
export const VOTE_QUESTION = 'Hat’s Spaß gemacht?';

/** Vorlesetext der Daumen-Knöpfe (iPhone und iPad-Zone). */
export const VOTE_LABELS: Readonly<Record<Vote, string>> = {
  up: 'Daumen hoch',
  down: 'Daumen runter',
};
export const ABORTED_HEADLINE = 'Minispiel abgebrochen';
export const ABORTED_LEAD = 'Keine Wertung – gleich geht’s auf dem Brett weiter.';
/** Joystick-Hinweis ohne Minispiel (M1-Arena). */
export const DEFAULT_STICK_HINT = 'Ziehen zum Laufen';

/** Minispiel des Kontexts in einer Stage, sonst `undefined`. */
export function minigameIn(
  context: SlotContext | undefined,
  stage?: MinigameStage,
): ControllerMinigameInfo | undefined {
  const minigame = context?.minigame;
  if (!minigame) return undefined;
  return stage === undefined || minigame.stage === stage ? minigame : undefined;
}

/**
 * „Bereit“ in der Anleitung (CHAOS-214):
 * - `timer`: Anleitung wartet nicht (feste Zeit, älterer Server) – Schlusszeile {@link INTRO_READY}.
 * - `guard`: Knopf angeboten, aber noch in der Schonfrist ({@link INTRO_READY_GUARD_MS}) gesperrt.
 * - `button`: Knopf angeboten und antippbar.
 * - `done`: gedrückt (lokal gesendet oder vom Server bestätigt) – „Warte auf die anderen“.
 */
export type IntroReadyState = 'timer' | 'guard' | 'button' | 'done';

export interface IntroReadyLocal {
  /** `ready` in genau dieser Anleitung schon gesendet (Antwort des Servers steht noch aus). */
  readonly sent: boolean;
  /** Schonfrist vorbei. */
  readonly armed: boolean;
}

/**
 * Zustand des Bereit-Knopfs in der Anleitung allein aus Kontext und lokalem Stand. Der Server
 * bietet `ready` an (`actions`), bis der Slot gedrückt hat; `minigame.ready` ist dann `true`.
 * Fehlt beides, wartet die Anleitung nicht (ältere Server).
 */
export function introReadyState(
  context: Pick<SlotContext, 'actions' | 'minigame'> | undefined,
  local: IntroReadyLocal,
): IntroReadyState {
  const minigame = context?.minigame;
  if (minigame?.stage !== 'intro') return 'timer';
  if (minigame.ready === true) return 'done';
  if (!context?.actions.includes('ready')) return 'timer';
  if (local.sent) return 'done';
  return local.armed ? 'button' : 'guard';
}

/**
 * Kennung einer Anleitung, die gerade „Bereit“ anbietet (Runde + Minispiel), sonst `null`.
 * Die iPad-Zonen messen die Schonfrist je Kennung: Eine neue Anleitung beginnt von vorn.
 */
export function readyIntroToken(
  context: Pick<SlotContext, 'actions' | 'minigame' | 'board'> | undefined,
): string | null {
  if (introReadyState(context, { sent: false, armed: true }) !== 'button') return null;
  return `${String(context?.board?.round ?? 0)}:${context?.minigame?.id ?? ''}`;
}

/**
 * Gleiche Anleitung, die auf „Bereit“ wartet: Meldet sich ein anderer Platz bereit, kommt ein
 * neuer Kontext mit gleichem Angebot – ein schon gesendetes „Bereit“ gilt dann weiter.
 */
export function sameReadyIntro(a: SlotContext, b: SlotContext): boolean {
  return (
    a.minigame?.stage === 'intro' &&
    b.minigame?.stage === 'intro' &&
    a.minigame.id === b.minigame.id &&
    a.actions.includes('ready') &&
    b.actions.includes('ready')
  );
}

/** Eintrag der Bedienlegende im Intro (nur angebotene Elemente, feste Reihenfolge). */
export interface ControlLegendItem {
  readonly kind: 'stick' | Button;
  readonly label: string;
}

export function controlLegend(controls: MinigameControlsInfo): ControlLegendItem[] {
  const items: ControlLegendItem[] = [];
  if (controls.joystick !== null) items.push({ kind: 'stick', label: controls.joystick });
  if (controls.a !== null) items.push({ kind: 'a', label: controls.a });
  if (controls.b !== null) items.push({ kind: 'b', label: controls.b });
  return items;
}

const BUTTON_ACTION: Readonly<Record<Button, Action>> = { a: 'button-a', b: 'button-b' };

/** Ein Spielknopf mit Beschriftung (`null` = nur Buchstabe, wie in der M1-Arena). */
export interface PlayButton {
  readonly button: Button;
  readonly label: string | null;
}

/** Bildwort des laufenden Abschnitts im Kopf (CHAOS-231, Schnellfeuer). */
export interface CueView {
  /** Abschnitt 0-basiert; ein neuer Wert spielt die Einblendung neu ab. */
  readonly step: number;
  readonly icon: string;
  readonly word: string;
  /** „2/5“ */
  readonly progress: string;
  /** Abschnitt zählt doppelt („×2“). */
  readonly double: boolean;
}

/** Eine Option der geheimen Wahl am eigenen Controller (CHAOS-242). */
export interface SecretOptionView {
  readonly id: string;
  readonly icon: string;
  readonly label: string;
  /** `picked` = festgelegt, `aimed` = Stick zeigt darauf, sonst `idle`. */
  readonly state: 'picked' | 'aimed' | 'idle';
}

/** Private Rückmeldung (CHAOS-242): nur dieser Controller sieht sie. */
export interface SecretView {
  readonly prompt: string;
  readonly options: readonly SecretOptionView[];
  readonly locked: boolean;
  /** Kurzfassung für Vorlesen („Deine Wahl: → 2 Münzen“). */
  readonly spoken: string;
}

export function describeSecret(secret: MinigameSecretInfo): SecretView {
  const options = secret.options.map((option): SecretOptionView => ({
    id: option.id,
    icon: option.icon,
    label: option.label,
    state: option.id === secret.pick ? 'picked' : option.id === secret.aim ? 'aimed' : 'idle',
  }));
  const picked = options.find((option) => option.state === 'picked');
  const aimed = options.find((option) => option.state === 'aimed');
  const spoken = picked
    ? `Deine Wahl: ${picked.icon} ${picked.label}`
    : aimed
      ? `Zeigt auf: ${aimed.icon} ${aimed.label}`
      : secret.locked
        ? 'Keine Wahl'
        : 'Noch keine Wahl';
  return { prompt: secret.prompt, options, locked: secret.locked, spoken };
}

/** Was das Spiel-Layout (`joystick-buttons`) anzeigt. */
export interface PlayView {
  /** Joystick angeboten; `stickHint` ist dann der Text darunter. */
  readonly stick: boolean;
  readonly stickHint: string;
  readonly buttons: readonly PlayButton[];
  /** Titel für den kleinen Kopf (nur im Minispiel). */
  readonly title: string | null;
  /** Bildwort des laufenden Abschnitts (CHAOS-231), sonst `null`. */
  readonly cue: CueView | null;
  /** Private Rückmeldung bei geheimer Wahl (CHAOS-242), sonst `null`. */
  readonly secret: SecretView | null;
}

export function describeCue(cue: MinigameCueInfo): CueView {
  return {
    step: cue.step,
    icon: cue.icon,
    word: cue.word,
    progress: `${String(cue.step + 1)}/${String(cue.steps)}`,
    double: cue.double,
  };
}

/**
 * Spiel-Layout aus Kontext: Ein Element erscheint nur, wenn der Server es anbietet
 * (`actions`) **und** der Steckbrief es nicht ausblendet (`controls.* === null`). Meldet das
 * Minispiel einen Abschnitt (`minigame.cue`, CHAOS-231), gilt dessen Bedienung statt des
 * Steckbriefs: Schnellfeuer zeigt je Mikro-Spiel nur, was es braucht.
 */
export function describePlay(context: Pick<SlotContext, 'actions' | 'minigame'>): PlayView {
  const minigame = context.minigame?.stage === 'play' ? context.minigame : undefined;
  const controls = minigame?.cue?.controls ?? minigame?.controls;
  const stick = context.actions.includes('move') && controls?.joystick !== null;
  const buttons = (['a', 'b'] as const).flatMap((button): PlayButton[] => {
    if (!context.actions.includes(BUTTON_ACTION[button])) return [];
    if (controls === undefined) return [{ button, label: null }];
    const label = controls[button];
    return label === null ? [] : [{ button, label }];
  });
  return {
    stick,
    stickHint:
      controls?.joystick === undefined || controls.joystick === null
        ? DEFAULT_STICK_HINT
        : `Ziehen: ${controls.joystick}`,
    buttons,
    title: minigame?.title ?? null,
    cue: minigame?.cue ? describeCue(minigame.cue) : null,
    secret: minigame?.secret ? describeSecret(minigame.secret) : null,
  };
}

/** Aktionen, die das Spiel-Layout tatsächlich zeigt (für die iPad-Geometrie). */
export function offeredActions(context: Pick<SlotContext, 'actions' | 'minigame'>): Action[] {
  const view = describePlay(context);
  const shown = new Set<Action>(view.buttons.map((b) => BUTTON_ACTION[b.button]));
  if (view.stick) shown.add('move');
  return context.actions.filter(
    (action) =>
      !(action === 'move' || action === 'button-a' || action === 'button-b') || shown.has(action),
  );
}

/** Eigenes Ergebnis nach dem Minispiel. */
export type ResultView =
  | {
      readonly kind: 'placed';
      readonly place: number;
      /** Platz mit jemandem geteilt (CHAOS-55). */
      readonly tied: boolean;
      /** „Platz 1!“ bzw. „Geteilter Platz 1!“ */
      readonly headline: string;
      /** Kurzer Zuruf je Platz. */
      readonly cheer: string;
      /** „42 Pumpstöße“ oder `null`, wenn der Server keine Punkte schickt. */
      readonly score: string | null;
      /** „+5 Münzen“, „Keine Münzen“ oder `null`, wenn der Server keine Belohnung schickt. */
      readonly reward: string | null;
      /** Trostpreis-Items aus dem Ergebnis (CHAOS-51, EXP-019); leer, wenn keine. */
      readonly prizes: readonly ItemKindName[];
      /** Zeile unter dem Ergebnis (Brett bzw. zurück in die Lobby nach einer Übungsrunde). */
      readonly lead: string;
    }
  | { readonly kind: 'aborted'; readonly headline: string; readonly lead: string };

const CHEERS: Readonly<Record<number, string>> = {
  1: 'Gewonnen!',
  2: 'Stark gespielt!',
  3: 'Gut gemacht!',
  4: 'Nächstes Mal!',
};

const NUMBER_FORMAT = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });

/** Münzbelohnung aus dem Ergebnis (`reward`) als Text. */
export function rewardText(reward: number | undefined): string | null {
  if (reward === undefined) return null;
  if (reward === 0) return 'Keine Münzen';
  return reward === 1 ? '+1 Münze' : `+${NUMBER_FORMAT.format(reward)} Münzen`;
}

/**
 * Ergebnis aus dem Kontext. Abgebrochen (`aborted`, CHAOS-55) oder ohne Platz: keine Wertung.
 * Gleichstand (`tied`): Der Server vergibt denselben Platz (1, 1, 3); beide sehen ausdrücklich
 * „Geteilter Platz 1!“.
 */
export function describeResult(minigame: ControllerMinigameInfo): ResultView {
  if (minigame.aborted || minigame.place === undefined) {
    return { kind: 'aborted', headline: ABORTED_HEADLINE, lead: ABORTED_LEAD };
  }
  const { place, tied } = minigame;
  return {
    kind: 'placed',
    place,
    tied,
    headline: tied ? `Geteilter Platz ${String(place)}!` : `Platz ${String(place)}!`,
    cheer: tied && place === 1 ? 'Gemeinsam gewonnen!' : (CHEERS[place] ?? 'Gut gespielt!'),
    score: minigame.score === undefined ? null : formatScore(minigame.score, minigame.scoreUnit),
    // Übungsrunde (CHAOS-87): keine Münzen, also auch kein „Keine Münzen“.
    reward: minigame.practice === true ? null : rewardText(minigame.reward),
    prizes: [...(minigame.prizes ?? [])],
    lead: minigame.practice === true ? PRACTICE_LEAD : RESULTS_LEAD,
  };
}

/** Daumen-Knöpfe nach dem Minispiel (CHAOS-87). */
export interface VoteView {
  /** Der Server bietet `rate` gerade an (Ergebnisanzeige, nicht pausiert). */
  readonly open: boolean;
  /** Eigene Stimme: gesendet und noch unbestätigt, sonst die vom Server, sonst `null`. */
  readonly selected: Vote | null;
}

export function describeVote(
  context: Pick<SlotContext, 'actions' | 'minigame'>,
  pending: Vote | null = null,
): VoteView {
  const minigame = context.minigame?.stage === 'results' ? context.minigame : undefined;
  return {
    open: minigame !== undefined && context.actions.includes('rate'),
    selected: pending ?? minigame?.vote ?? null,
  };
}

/** „1.234 Pumpstöße“, „-3 Punkte“ (deutsche Tausenderpunkte). */
export function formatScore(score: number, unit: string): string {
  return `${NUMBER_FORMAT.format(score)} ${unit}`;
}
