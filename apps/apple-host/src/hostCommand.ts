/**
 * Host-Befehle als Zeichenkette (`ChaosHostInstance.hostCommand`, CHAOS-139/166). Swift kennt
 * nur Text; hier wird daraus ein Befehl der Host-Rolle (`HostCommand` aus `apps/host`).
 *
 * - `start`, `pause`, `resume`, `end-game`, `rematch` (`HOST_COMMANDS`)
 * - `skip-finale` (`LOCAL_HOST_COMMANDS`, CHAOS-145): wirkt nur im Kern, geht nie an den Server
 * - `configure:rounds=12`, `configure:moreReactionTime=1` (`0`/`1`/`true`/`false`),
 *   `configure:board=wackelwald` (Brett-ID oder `zufall`, CHAOS-197),
 *   `configure:minigameBlocklist=a+b,minigameFavorites=` (ganze Listen der Minispiel-Rotation,
 *   `+` trennt, leer = keine, CHAOS-216), mehreres mit Komma verbunden:
 *   `configure:rounds=12,moreReactionTime=1` (Lobby-Einstellungen, CHAOS-166)
 * - `practice:sockenregen` (Übungsrunde aus der Galerie, CHAOS-220): `start` mit `practice`
 * - `minigame:favorite=<id>`, `minigame:blocked=<id>` (CHAOS-216): Minispiel umschalten; wirkt
 *   im Kern (Stand ausrechnen, speichern) und geht als `configure` an den Server
 * - `configure:aiSeat=3:mittel` setzt eine KI auf Platz 3 bzw. ändert ihre Stärke
 *   (`leicht`/`mittel`/`schwer`/`dynamisch`), `configure:aiSeat=3:aus` entfernt sie (CHAOS-179)
 *
 * Alles andere ist ungültig (`null`): unbekannte oder doppelte Schlüssel, Runden außerhalb
 * 1–`MAX_ROUNDS`, Brett-IDs außerhalb von `BoardChoiceSchema`, Minispiel-Kennungen außerhalb
 * von `MinigameIdSchema` oder doppelt in einer Liste, mehr als `MAX_ROTATION_MINIGAMES`, leeres
 * `configure:`. Ob es Brett oder Minispiel gibt, prüft der Server (`bad-message` bzw. er lässt
 * Unbekanntes weg); `practice:` prüft der Kern vorher gegen die Galerie.
 */
import {
  AI_STRENGTHS,
  BoardChoiceSchema,
  MAX_ROTATION_MINIGAMES,
  MAX_ROUNDS,
  MinigameIdSchema,
  type AiStrength,
  type SlotNumber,
} from '@chaos-party/protocol';
import type { HostCommand } from '../../host/src/net/hostConnection.ts';
import {
  CONFIGURE_PREFIX,
  HOST_COMMANDS,
  LOCAL_HOST_COMMANDS,
  PRACTICE_PREFIX,
  MINIGAME_TOGGLE_KINDS,
  MINIGAME_TOGGLE_PREFIX,
  type HostCommandName,
  type LocalHostCommandName,
  type MinigameToggleKind,
} from './contract.ts';

/** Minispiel umschalten (`minigame:<kind>=<id>`, CHAOS-216). */
export interface MinigameToggleCommand {
  readonly type: 'toggle-minigame';
  readonly kind: MinigameToggleKind;
  readonly id: string;
}

export type ParsedHostCommand =
  | { readonly type: 'start' }
  | { readonly type: 'practice'; readonly minigameId: string }
  | { readonly type: LocalHostCommandName }
  | MinigameToggleCommand
  | HostCommand;

type ConfigureCommand = Extract<HostCommand, { type: 'configure' }>;

const BOOLEANS: Readonly<Record<string, boolean>> = {
  '1': true,
  true: true,
  '0': false,
  false: false,
};

/** `a+b+c` → Kennungen; leer → `[]`; `null` bei ungültiger Kennung, Doppelten oder zu vielen. */
function parseMinigameIds(value: string): string[] | null {
  if (value === '') return [];
  const ids = value.split('+');
  if (ids.length > MAX_ROTATION_MINIGAMES || new Set(ids).size !== ids.length) return null;
  return ids.every((id) => MinigameIdSchema.safeParse(id).success) ? ids : null;
}

/** Wert von `aiSeat`: `<platz>:<stärke>` oder `<platz>:aus` (CHAOS-179). */
const AI_SEAT_OFF = 'aus';

function parseAiSeat(value: string): ConfigureCommand['aiSeat'] | null {
  const match = /^([1-4]):([a-z]+)$/.exec(value);
  if (!match) return null;
  const seat = Number(match[1]) as SlotNumber;
  const strength = match[2] ?? '';
  if (strength === AI_SEAT_OFF) return { seat, strength: null };
  if (!(AI_STRENGTHS as readonly string[]).includes(strength)) return null;
  return { seat, strength: strength as AiStrength };
}

function parseConfigure(spec: string): ConfigureCommand | null {
  let rounds: number | undefined;
  let moreReactionTime: boolean | undefined;
  let board: string | undefined;
  let aiSeat: ConfigureCommand['aiSeat'];
  let minigameBlocklist: string[] | undefined;
  let minigameFavorites: string[] | undefined;
  for (const pair of spec.split(',')) {
    const [key, value, ...rest] = pair.split('=');
    if (value === undefined || rest.length > 0) return null;
    if (key === 'rounds' && rounds === undefined) {
      if (!/^[1-9]\d?$/.test(value)) return null;
      rounds = Number(value);
      if (rounds < 1 || rounds > MAX_ROUNDS) return null;
    } else if (key === 'moreReactionTime' && moreReactionTime === undefined) {
      if (!Object.hasOwn(BOOLEANS, value)) return null;
      moreReactionTime = BOOLEANS[value];
    } else if (key === 'board' && board === undefined) {
      if (!BoardChoiceSchema.safeParse(value).success) return null;
      board = value;
    } else if (key === 'aiSeat' && aiSeat === undefined) {
      const parsed = parseAiSeat(value);
      if (!parsed) return null;
      aiSeat = parsed;
    } else if (key === 'minigameBlocklist' && minigameBlocklist === undefined) {
      const ids = parseMinigameIds(value);
      if (ids === null) return null;
      minigameBlocklist = ids;
    } else if (key === 'minigameFavorites' && minigameFavorites === undefined) {
      const ids = parseMinigameIds(value);
      if (ids === null) return null;
      minigameFavorites = ids;
    } else {
      return null;
    }
  }
  return {
    type: 'configure',
    ...(rounds === undefined ? {} : { rounds }),
    ...(moreReactionTime === undefined ? {} : { moreReactionTime }),
    ...(board === undefined ? {} : { board }),
    ...(aiSeat === undefined ? {} : { aiSeat }),
    ...(minigameBlocklist === undefined ? {} : { minigameBlocklist }),
    ...(minigameFavorites === undefined ? {} : { minigameFavorites }),
  };
}

function parseMinigameToggle(spec: string): MinigameToggleCommand | null {
  const [kind, id, ...rest] = spec.split('=');
  if (id === undefined || rest.length > 0) return null;
  if (!(MINIGAME_TOGGLE_KINDS as readonly string[]).includes(kind ?? '')) return null;
  if (!MinigameIdSchema.safeParse(id).success) return null;
  return { type: 'toggle-minigame', kind: kind as MinigameToggleKind, id };
}

/** Zeichenkette → Befehl; `null` bei Unbekanntem oder Ungültigem. */
export function parseHostCommand(cmd: string): ParsedHostCommand | null {
  if (cmd.startsWith(CONFIGURE_PREFIX)) return parseConfigure(cmd.slice(CONFIGURE_PREFIX.length));
  if (cmd.startsWith(PRACTICE_PREFIX)) {
    const id = MinigameIdSchema.safeParse(cmd.slice(PRACTICE_PREFIX.length));
    return id.success ? { type: 'practice', minigameId: id.data } : null;
  }
  if (cmd.startsWith(MINIGAME_TOGGLE_PREFIX)) {
    return parseMinigameToggle(cmd.slice(MINIGAME_TOGGLE_PREFIX.length));
  }
  if ((LOCAL_HOST_COMMANDS as readonly string[]).includes(cmd)) {
    return { type: cmd as LocalHostCommandName };
  }
  return (HOST_COMMANDS as readonly string[]).includes(cmd)
    ? { type: cmd as HostCommandName }
    : null;
}
