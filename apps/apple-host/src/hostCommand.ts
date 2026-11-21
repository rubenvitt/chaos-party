/**
 * Host-Befehle als Zeichenkette (`ChaosHostInstance.hostCommand`, CHAOS-139/166). Swift kennt
 * nur Text; hier wird daraus ein Befehl der Host-Rolle (`HostCommand` aus `apps/host`).
 *
 * - `start`, `pause`, `resume`, `end-game`, `rematch` (`HOST_COMMANDS`)
 * - `skip-finale` (`LOCAL_HOST_COMMANDS`, CHAOS-145): wirkt nur im Kern, geht nie an den Server
 * - `configure:rounds=12`, `configure:moreReactionTime=1` (`0`/`1`/`true`/`false`),
 *   `configure:board=wackelwald` (Brett-ID oder `zufall`, CHAOS-197), mehreres mit Komma
 *   verbunden: `configure:rounds=12,moreReactionTime=1` (Lobby-Einstellungen, CHAOS-166)
 * - `practice:sockenregen` (Übungsrunde aus der Galerie, CHAOS-220): `start` mit `practice`
 *
 * Alles andere ist ungültig (`null`): unbekannte oder doppelte Schlüssel, Runden außerhalb
 * 1–`MAX_ROUNDS`, Brett-IDs außerhalb von `BoardChoiceSchema`, leeres `configure:`, Kennungen
 * außerhalb von `MinigameIdSchema`. Ob es Brett bzw. Minispiel gibt, prüft der Server
 * (`bad-message`); der Kern prüft das Minispiel vorher gegen die Galerie.
 */
import { BoardChoiceSchema, MAX_ROUNDS, MinigameIdSchema } from '@chaos-party/protocol';
import type { HostCommand } from '../../host/src/net/hostConnection.ts';
import {
  CONFIGURE_PREFIX,
  HOST_COMMANDS,
  LOCAL_HOST_COMMANDS,
  PRACTICE_PREFIX,
  type HostCommandName,
  type LocalHostCommandName,
} from './contract.ts';

export type ParsedHostCommand =
  | { readonly type: 'start' }
  | { readonly type: 'practice'; readonly minigameId: string }
  | { readonly type: LocalHostCommandName }
  | HostCommand;

type ConfigureCommand = Extract<HostCommand, { type: 'configure' }>;

const BOOLEANS: Readonly<Record<string, boolean>> = {
  '1': true,
  true: true,
  '0': false,
  false: false,
};

function parseConfigure(spec: string): ConfigureCommand | null {
  let rounds: number | undefined;
  let moreReactionTime: boolean | undefined;
  let board: string | undefined;
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
    } else {
      return null;
    }
  }
  return {
    type: 'configure',
    ...(rounds === undefined ? {} : { rounds }),
    ...(moreReactionTime === undefined ? {} : { moreReactionTime }),
    ...(board === undefined ? {} : { board }),
  };
}

/** Zeichenkette → Befehl; `null` bei Unbekanntem oder Ungültigem. */
export function parseHostCommand(cmd: string): ParsedHostCommand | null {
  if (cmd.startsWith(CONFIGURE_PREFIX)) return parseConfigure(cmd.slice(CONFIGURE_PREFIX.length));
  if (cmd.startsWith(PRACTICE_PREFIX)) {
    const id = MinigameIdSchema.safeParse(cmd.slice(PRACTICE_PREFIX.length));
    return id.success ? { type: 'practice', minigameId: id.data } : null;
  }
  if ((LOCAL_HOST_COMMANDS as readonly string[]).includes(cmd)) {
    return { type: cmd as LocalHostCommandName };
  }
  return (HOST_COMMANDS as readonly string[]).includes(cmd)
    ? { type: cmd as HostCommandName }
    : null;
}
