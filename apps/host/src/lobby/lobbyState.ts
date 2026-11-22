/**
 * Reine Entscheidungen der PC-Lobby (CHAOS-36): Start-Bedingung mit Hinweistext,
 * Rundenauswahl, Brett-Auswahl (CHAOS-197), Figur je Spielerkarte und KI-Plätze (CHAOS-182).
 * Ohne React, unit-getestet.
 */
import {
  CHARACTER_NAMES,
  pickFreeCharacter,
  RANDOM_BOARD,
  RANDOM_BOARD_NAME,
  type CharacterId,
  type LobbySettings,
} from '@chaos-party/protocol';
import type { ConnectionStatus } from '../net/hostConnection.ts';
import type { HostPlayer } from '../players.ts';

/** Ab so vielen Plätzen ist es eine echte Partie (ADR-020 §1: Menschen und KI zusammen). */
export const MIN_PARTY_PLAYERS = 2;

export type StartReadiness =
  /** Keine Verbindung oder kein Mensch verbunden: Knopf aus. */
  | 'blocked'
  /** Nur ein Platz: Start erlaubt, aber nur als Probelauf (Demo, Tests, wie in M1–M3). */
  | 'solo'
  /** Mindestens zwei Plätze, aber nicht alle Menschen bereit: Start erlaubt (wie bisher). */
  | 'waiting'
  /** Mindestens zwei Plätze und alle verbundenen Menschen bereit: der empfohlene Start. */
  | 'ready';

export interface StartState {
  readonly readiness: StartReadiness;
  /** Knopf klickbar? (Verhalten der bisherigen Lobby: ab einem verbundenen Spieler.) */
  readonly enabled: boolean;
  /** Knopf hervorheben (leuchtet), sobald die empfohlene Bedingung erfüllt ist. */
  readonly highlighted: boolean;
  readonly hint: string;
}

/**
 * Start-Bedingung (ADR-015/CHAOS-36, KI-Plätze ADR-020 §1/CHAOS-182): Empfohlen ist der Start ab
 * **zwei Plätzen** (Menschen und KI zusammen), wenn alle verbundenen Menschen bereit sind – dann
 * leuchtet der Knopf. Eine KI ist immer bereit. Wie bisher (M1–M3, E2E-Tests, Demo) bleibt der
 * Start ab einem verbundenen Menschen möglich (Probelauf); der Hinweis sagt, was fehlt. Ohne
 * verbundenen Menschen startet nichts, auch nicht mit KI (der Server lehnt das ab).
 */
export function startState(
  players: readonly (Pick<HostPlayer, 'connected' | 'ready' | 'label'> & {
    readonly kind?: 'ai' | undefined;
  })[],
  status: ConnectionStatus,
): StartState {
  const humans = players.filter((p) => p.kind !== 'ai' && p.connected);
  const ais = players.filter((p) => p.kind === 'ai');
  if (status !== 'connected' || humans.length === 0) {
    return {
      readiness: 'blocked',
      enabled: false,
      highlighted: false,
      hint:
        ais.length > 0 && status === 'connected'
          ? 'Start, sobald mindestens ein Mensch mit Controller dabei ist.'
          : 'Start, sobald mindestens ein Controller verbunden ist.',
    };
  }
  if (humans.length + ais.length < MIN_PARTY_PLAYERS) {
    return {
      readiness: 'solo',
      enabled: true,
      highlighted: false,
      hint: 'Partie ab 2 Spielern – holt euch eine KI dazu, sonst nur ein Probelauf.',
    };
  }
  const waiting = humans.filter((p) => !p.ready);
  if (waiting.length === 0) {
    return { readiness: 'ready', enabled: true, highlighted: true, hint: 'Alle bereit – los!' };
  }
  const names = waiting.map((p) => p.label);
  const who =
    names.length === 1
      ? `${names[0] ?? ''} ist`
      : `${names.slice(0, -1).join(', ')} und ${names[names.length - 1] ?? ''} sind`;
  return {
    readiness: 'waiting',
    enabled: true,
    highlighted: false,
    hint: `${who} noch nicht bereit – starten geht trotzdem.`,
  };
}

export interface RoundOption {
  readonly rounds: number;
  readonly selected: boolean;
  /** Nicht aus den Vorschlägen (z. B. per `?rounds=` eingestellt). */
  readonly custom: boolean;
}

/**
 * Knöpfe der Rundenauswahl: die Vorschläge des Servers (`roundPresets`), dazu die aktuelle
 * Einstellung, falls sie kein Vorschlag ist (aufsteigend einsortiert).
 */
export function roundOptions(settings: LobbySettings): RoundOption[] {
  const values = new Set(settings.roundPresets);
  values.add(settings.rounds);
  return [...values]
    .sort((a, b) => a - b)
    .map((rounds) => ({
      rounds,
      selected: rounds === settings.rounds,
      custom: !settings.roundPresets.includes(rounds),
    }));
}

export interface BoardOption {
  /** Brett-ID oder `RANDOM_BOARD`. */
  readonly id: string;
  readonly name: string;
  /** Zweite Zeile: Größe bzw. „Überraschung!“. */
  readonly detail: string;
  /** Kurzbeschreibung (Tooltip, Vorlesen). */
  readonly tagline: string;
  readonly selected: boolean;
  readonly random: boolean;
}

/**
 * Knöpfe der Brett-Auswahl (CHAOS-197): die Bretter des Servers in seiner Reihenfolge, dahinter
 * „Zufall“. Leer, wenn der Server keine Bretter nennt (älterer Server, dann keine Auswahl).
 * Ohne `board` gilt das erste Brett als gewählt.
 */
export function boardOptions(settings: LobbySettings): BoardOption[] {
  const boards = settings.boards ?? [];
  if (boards.length === 0) return [];
  const chosen = settings.board ?? boards[0]?.id;
  return [
    ...boards.map((board) => ({
      id: board.id,
      name: board.name,
      detail: `${String(board.spaces)} Felder`,
      tagline: board.tagline,
      selected: board.id === chosen,
      random: false,
    })),
    {
      id: RANDOM_BOARD,
      name: 'Zufall',
      detail: 'Überraschung!',
      tagline: 'Der Server lost beim Start ein Brett aus.',
      selected: chosen === RANDOM_BOARD,
      random: true,
    },
  ];
}

/**
 * Nächste Wahl des Wechselknopfs (CHAOS-197): das Brett nach dem gewählten, nach „Zufall“ wieder
 * das erste. Gleiche Reihenfolge wie `BoardChoiceView.next` im Apple-Host.
 */
export function nextBoardId(options: readonly BoardOption[]): string {
  const index = options.findIndex((option) => option.selected);
  const next = options[(index + 1) % options.length];
  if (next === undefined) throw new Error('Keine Bretter zur Auswahl');
  return next.id;
}

/** Name des gewählten Bretts für den Startknopf („Wackelwald“, „Zufallsbrett“) oder `null`. */
export function chosenBoardName(settings: LobbySettings): string | null {
  const choice = settings.board ?? settings.boards?.[0]?.id;
  if (choice === undefined) return null;
  if (choice === RANDOM_BOARD) return RANDOM_BOARD_NAME;
  return settings.boards?.find((board) => board.id === choice)?.name ?? null;
}

/**
 * Minuten je Runde nach Spielerzahl (Brettzüge + Minispiel mit Anleitung und Ergebnis), aus der
 * Bot-Simulation mit gemütlichem Entscheidungstempo (EXP-011, CHAOS-40; seit CHAOS-66 mit kurzer
 * Anleitung bei Wiederholung und vier Minispielen in der Rotation). Dazu kommt das Finale.
 */
const MINUTES_PER_ROUND: Readonly<Record<2 | 3 | 4, number>> = { 2: 1.1, 3: 1.3, 4: 1.45 };
const FINALE_MINUTES = 0.35;

/**
 * Grobe Spieldauer für die Rundenauswahl („≈ 15 Min.“), auf 5 Minuten gerundet. Mit weniger als
 * zwei Spielern rechnet sie mit vier (die Runde füllt sich meist noch).
 */
export function roundsDuration(rounds: number, players = 4): string {
  const count = players >= 2 && players <= 4 ? (players as 2 | 3 | 4) : 4;
  const minutes = rounds * MINUTES_PER_ROUND[count] + FINALE_MINUTES;
  return `≈ ${String(Math.max(5, Math.round(minutes / 5) * 5))} Min.`;
}

export interface CardCharacter {
  /** Gezeigte Figur: die Wahl oder der Vorschlag (freie Standardfigur). */
  readonly character: CharacterId;
  /** `false` = Spieler wählt noch; das Porträt ist nur ein Vorschlag. */
  readonly chosen: boolean;
  /** Text unter dem Namen: Figurenname bzw. „wählt noch …“. */
  readonly text: string;
}

/**
 * Figur einer Spielerkarte: die echte Wahl aus `lobby.players[].character`; bei `null` als
 * Vorschlag die Figur, die der Server beim Start zuweisen würde: erst die Menschen, dann die
 * KI-Plätze (ADR-020 §7), je in Slot-Reihenfolge die Standardfigur des Slots, falls frei, sonst
 * die erste freie (`pickFreeCharacter`, ADR-015). Eine KI „wählt“ nicht, ihr Text ist „Figur beim
 * Start“.
 */
export function cardCharacter(
  player: Pick<HostPlayer, 'slot' | 'character' | 'kind'>,
  all: readonly Pick<HostPlayer, 'slot' | 'character' | 'kind'>[],
): CardCharacter {
  if (player.character !== null) {
    return {
      character: player.character,
      chosen: true,
      text: CHARACTER_NAMES[player.character].name,
    };
  }
  const taken = all.flatMap((p) => (p.character === null ? [] : [p.character]));
  const order = [...all].sort(
    (a, b) => Number(a.kind === 'ai') - Number(b.kind === 'ai') || a.slot - b.slot,
  );
  let suggestion: CharacterId = 'robot';
  for (const other of order) {
    if (other.character !== null) continue;
    const free = pickFreeCharacter(other.slot, taken) ?? 'robot';
    taken.push(free);
    if (other.slot === player.slot) suggestion = free;
  }
  return {
    character: suggestion,
    chosen: false,
    text: player.kind === 'ai' ? 'Figur beim Start' : 'wählt noch …',
  };
}

/** Sperrliste und Favoriten der Minispiel-Rotation (CHAOS-85). */
export interface MinigamePrefs {
  readonly blocklist: readonly string[];
  readonly favorites: readonly string[];
}

/** Stand aus `lobby.settings.minigames` (Server ist die Quelle). Ohne Liste: leer. */
export function minigamePrefs(settings: LobbySettings): MinigamePrefs {
  const games = settings.minigames ?? [];
  return {
    blocklist: games.filter((game) => game.blocked).map((game) => game.id),
    favorites: games.filter((game) => game.favorite).map((game) => game.id),
  };
}

/**
 * Favorit bzw. Sperre eines Minispiels umschalten. Beides schließt sich aus: Wer ein Spiel
 * sperrt, nimmt es aus den Favoriten und umgekehrt. Reihenfolge wie in `order` (Katalog).
 */
export function toggleMinigame(
  prefs: MinigamePrefs,
  id: string,
  kind: 'blocked' | 'favorite',
  order: readonly string[],
): MinigamePrefs {
  const blocked = new Set(prefs.blocklist);
  const favorites = new Set(prefs.favorites);
  const [own, other] = kind === 'blocked' ? [blocked, favorites] : [favorites, blocked];
  if (own.has(id)) {
    own.delete(id);
  } else {
    own.add(id);
    other.delete(id);
  }
  const sorted = (ids: ReadonlySet<string>) => order.filter((entry) => ids.has(entry));
  return { blocklist: sorted(blocked), favorites: sorted(favorites) };
}

/** Stand für den Knopf „Minispiele“: kurz mit Symbolen und ausgeschrieben fürs Vorlesen. */
export interface MinigameSummary {
  /** „4 im Topf · 2 ★ · 1 ⦸“ (Symbole wie im Dialog). */
  readonly short: string;
  /** „4 im Topf, 1 gesperrt, 2 Favoriten“. */
  readonly long: string;
}

export function minigameSummary(settings: LobbySettings): MinigameSummary | null {
  const games = settings.minigames;
  if (games === undefined || games.length === 0) return null;
  const blocked = games.filter((game) => game.blocked).length;
  const favorites = games.filter((game) => game.favorite).length;
  const pool = `${String(games.length - blocked)} im Topf`;
  const short = [pool];
  const long = [pool];
  if (favorites > 0) {
    short.push(`${String(favorites)} ★`);
    long.push(favorites === 1 ? '1 Favorit' : `${String(favorites)} Favoriten`);
  }
  if (blocked > 0) {
    short.push(`${String(blocked)} ⦸`);
    long.push(`${String(blocked)} gesperrt`);
  }
  return { short: short.join(' · '), long: long.join(', ') };
}
