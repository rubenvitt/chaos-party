/**
 * Deutsche Anzeigetexte der Brettphase (CHAOS-20): Ereignis-Meldungen, Prompt-Status,
 * Banner, Countdown, Item-Namen. Rein, ohne React/Babylon – unit-getestet.
 * Der Host rechnet keine Regeln: Alle Zahlen kommen aus `BoardView`/`BoardEvent`.
 */
import { avalancheAt, avalancheWarning, getBoard } from '@chaos-party/game-core';
import {
  PLAYER_SLOTS,
  type BoardEvent,
  type BoardEventKindName,
  type BoardView,
  type ItemKindName,
  type SlotNumber,
} from '@chaos-party/protocol';

export type MessageTone = 'good' | 'bad' | 'neutral' | 'gold';

/** Eine Meldung für den HUD-Ticker. `slot` färbt die Meldung (Spielerfarbe). */
export interface EventText {
  readonly text: string;
  readonly slot: SlotNumber | null;
  readonly tone: MessageTone;
}

export const ITEM_NAMES: Readonly<Record<ItemKindName, string>> = {
  'double-dice': 'Doppelwürfel',
  'coin-steal': 'Münzklau',
  trap: 'Falle',
  shield: 'Schild',
};

const BOARD_EVENT_NAMES: Readonly<Record<BoardEventKindName, string>> = {
  'coin-rain': 'Münzregen',
  gust: 'Windböe',
  swap: 'Platztausch',
  'trophy-shuffle': 'Trophäen-Wirbel',
  'lucky-find': 'Glücksfund',
  'rapid-fire': 'Schnellfeuer',
};

/** Name eines Spielers: aus dem Spielstand, sonst Farbname des Slots. */
export function playerName(view: BoardView | null, slot: SlotNumber): string {
  return view?.players.find((p) => p.slot === slot)?.name ?? PLAYER_SLOTS[slot].label;
}

function coins(amount: number): string {
  return amount === 1 ? '1 Münze' : `${amount} Münzen`;
}

/**
 * Meldung zu einem Ereignis oder `null`, wenn es keine eigene Meldung braucht (z. B. `moved`,
 * oder weil Banner/Status es schon zeigen). `labelOf` liefert den Wegweiser eines Felds.
 */
export function eventText(
  event: BoardEvent,
  view: BoardView | null,
  labelOf: (spaceId: string) => string | undefined = () => undefined,
): EventText | null {
  const name = (slot: SlotNumber) => playerName(view, slot);
  switch (event.type) {
    case 'game-started':
      return { text: 'Die Party beginnt!', slot: null, tone: 'gold' };
    case 'round-started': {
      // Frostgipfel (CHAOS-198): Lawine jetzt bzw. Warnung für den Rundenwechsel danach.
      const avalanche = avalancheNotice(event.round, view);
      return {
        text: avalanche
          ? `Runde ${event.round} beginnt – ${avalanche.title}`
          : `Runde ${event.round} beginnt!`,
        slot: null,
        tone: avalanche ? 'bad' : 'neutral',
      };
    }
    case 'item-used':
      switch (event.item) {
        case 'double-dice':
          return {
            text: `${name(event.slot)} nimmt den Doppelwürfel!`,
            slot: event.slot,
            tone: 'neutral',
          };
        case 'coin-steal':
          return event.target === undefined
            ? { text: `${name(event.slot)} geht auf Münzklau!`, slot: event.slot, tone: 'neutral' }
            : {
                text: `${name(event.slot)} will ${name(event.target)} Münzen klauen!`,
                slot: event.slot,
                tone: 'neutral',
              };
        case 'shield':
          return { text: `${name(event.slot)} hebt den Schild!`, slot: event.slot, tone: 'good' };
        case 'trap':
          // Meldung kommt mit `trap-placed`.
          return null;
      }
      return null;
    case 'dice-rolled':
      return {
        text:
          event.faces.length > 1
            ? `${name(event.slot)} würfelt ${event.faces.join(' + ')} = ${event.total}!`
            : `${name(event.slot)} würfelt ${event.total}!`,
        slot: event.slot,
        tone: 'neutral',
      };
    case 'path-chosen': {
      const label = labelOf(event.spaceId);
      return {
        text: label ? `${name(event.slot)} nimmt: ${label}` : `${name(event.slot)} wählt einen Weg`,
        slot: event.slot,
        tone: 'neutral',
      };
    }
    case 'coins-changed':
      if (event.delta === 0) return null;
      switch (event.reason) {
        case 'space':
        case 'event':
          return event.delta > 0
            ? {
                text: `${name(event.slot)} bekommt ${coins(event.delta)}`,
                slot: event.slot,
                tone: 'good',
              }
            : {
                text: `${name(event.slot)} verliert ${coins(-event.delta)}`,
                slot: event.slot,
                tone: 'bad',
              };
        case 'minigame':
          return event.delta > 0
            ? {
                text: `${name(event.slot)} gewinnt ${coins(event.delta)} im Minispiel`,
                slot: event.slot,
                tone: 'good',
              }
            : null;
        case 'tailwind':
          // CHAOS-125: Aufholhilfe nach dem Minispiel; groß dazu die Karte im Rundenende.
          return event.delta > 0
            ? {
                text: `Rückenwind: ${name(event.slot)} +${coins(event.delta)}`,
                slot: event.slot,
                tone: 'good',
              }
            : null;
        case 'trophy':
        case 'steal':
        case 'trap':
          // Eigene Meldungen über `trophy-bought`, `coins-stolen`, `trap-triggered`.
          return null;
      }
      return null;
    case 'trophy-bought':
      return { text: `${name(event.slot)} kauft eine Trophäe!`, slot: event.slot, tone: 'gold' };
    case 'trophy-moved':
      return { text: 'Die Trophäe wandert weiter!', slot: null, tone: 'gold' };
    case 'item-gained':
      return {
        text: `${name(event.slot)} findet ein Item: ${ITEM_NAMES[event.item]}`,
        slot: event.slot,
        tone: 'good',
      };
    case 'board-event':
      if (event.event === 'rapid-fire') {
        return {
          text: `${name(event.slot)} löst Schnellfeuer aus: fünf Mikro-Spiele nach dieser Runde!`,
          slot: event.slot,
          tone: 'neutral',
        };
      }
      return {
        text: `Ereignis für ${name(event.slot)}: ${BOARD_EVENT_NAMES[event.event]}!`,
        slot: event.slot,
        tone: 'neutral',
      };
    case 'trap-placed':
      return {
        text: `${name(event.slot)} versteckt eine Falle`,
        slot: event.slot,
        tone: 'neutral',
      };
    case 'trap-triggered':
      return {
        text: `Falle! ${name(event.slot)} zahlt ${coins(event.amount)} an ${name(event.owner)}`,
        slot: event.slot,
        tone: 'bad',
      };
    case 'reaction-resolved':
      switch (event.result) {
        case 'shield':
          return {
            text: `${name(event.slot)} wehrt mit dem Schild ab!`,
            slot: event.slot,
            tone: 'good',
          };
        case 'brace':
          return {
            text: `${name(event.slot)} hält sich fest – nur halber Verlust!`,
            slot: event.slot,
            tone: 'good',
          };
        case 'timeout':
          return { text: `${name(event.slot)} war zu langsam!`, slot: event.slot, tone: 'bad' };
      }
      return null;
    case 'coins-stolen':
      return event.amount > 0
        ? {
            text: `${name(event.to)} klaut ${name(event.from)} ${coins(event.amount)}!`,
            slot: event.to,
            tone: 'bad',
          }
        : {
            text: `${name(event.to)} will klauen – ${name(event.from)} hat nichts!`,
            slot: event.to,
            tone: 'neutral',
          };
    case 'player-auto':
      return {
        text:
          event.reason === 'disconnected'
            ? `${name(event.slot)} ist getrennt – es geht automatisch weiter`
            : `${name(event.slot)} hat zu lange gezögert – automatische Wahl`,
        slot: event.slot,
        tone: 'neutral',
      };
    case 'minigame-started':
      return { text: 'Minispiel-Zeit!', slot: null, tone: 'gold' };
    case 'minigame-results': {
      const winner = event.ranking[0];
      return winner === undefined
        ? null
        : { text: `Minispiel: ${name(winner)} gewinnt!`, slot: winner, tone: 'gold' };
    }
    case 'round-ended':
      return { text: `Runde ${event.round} geschafft!`, slot: null, tone: 'neutral' };
    case 'game-ended':
      return { text: 'Spielende!', slot: null, tone: 'gold' };
    case 'turn-started':
    case 'turn-ended':
    case 'moved':
    case 'reaction-opened':
      return null;
  }
}

/** Eine Zeile der Rückenwind-Ansage: wer, wie viele Münzen. */
export interface TailwindRow {
  readonly slot: SlotNumber;
  readonly name: string;
  readonly coins: number;
}

/** Erklärung unter der Überschrift der Rückenwind-Karte. */
export const TAILWIND_LEAD = 'Wer bei den Trophäen hinten liegt, bekommt Münzen.';

/**
 * Rückenwind-Ansage im Rundenende (CHAOS-125): wer wie viele Münzen bekommt, die meisten
 * zuerst. `null` außerhalb von `round-end` oder ohne Rückenwind.
 */
export function tailwindRows(view: BoardView | null): readonly TailwindRow[] | null {
  if (view?.gamePhase !== 'round-end') return null;
  const bonuses = view.minigame?.tailwind ?? [];
  if (bonuses.length === 0) return null;
  return [...bonuses]
    .sort((a, b) => b.coins - a.coins || a.slot - b.slot)
    .map((bonus) => ({
      slot: bonus.slot,
      name: playerName(view, bonus.slot),
      coins: bonus.coins,
    }));
}

/** „+4 Münzen“ / „+1 Münze“. */
export function tailwindAmount(amount: number): string {
  return `+${coins(amount)}`;
}

/** Große Einblendung in der Bildmitte (Überschrift und Zeile darunter). */
export interface NoticeText {
  readonly title: string;
  readonly detail: string;
}

/** Brett und Rundenzahl, soweit eine Ansage sie braucht (`BoardView` reicht). */
export interface NoticeContext {
  readonly boardId: string;
  readonly rounds: number;
}

/**
 * Lawine des Frostgipfels (CHAOS-198) zu Beginn von Runde `round`: geht sie jetzt ab
 * („Lawine am Gletscherpfad!“) oder nach dieser Runde („Lawinengefahr am Nordhang!“)?
 * `null` ohne Lawine oder ohne Brett.
 */
export function avalancheNotice(round: number, context: NoticeContext | null): NoticeText | null {
  const board = context ? getBoard(context.boardId) : undefined;
  const coinsLost = board?.avalanche?.coins;
  if (!board || !context || coinsLost === undefined) return null;
  const now = avalancheAt(board, round);
  if (now) {
    return {
      title: `Lawine am ${now.name}!`,
      detail: `Wer dort steht, verliert ${coins(coinsLost)}`,
    };
  }
  const soon = avalancheWarning(board, round, context.rounds);
  if (soon) {
    return {
      title: `Lawinengefahr am ${soon.name}!`,
      detail: 'Nach dieser Runde geht sie ab – dort nicht stehen bleiben',
    };
  }
  return null;
}

/**
 * Einblendung zu einem Ereignis oder `null`: die wachsende Sabotage (CHAOS-120,
 * `round-started` mit `sabotage` → „Sabotage wird stärker!“ mit den neuen Werten), sonst die
 * Lawine des Frostgipfels (CHAOS-198, braucht `context`).
 */
export function eventNotice(
  event: BoardEvent,
  context: NoticeContext | null = null,
): NoticeText | null {
  if (event.type !== 'round-started') return null;
  if (!event.sabotage) return avalancheNotice(event.round, context);
  const { steal, trap } = event.sabotage;
  return {
    title: 'Sabotage wird stärker!',
    detail: `Klau: ${coins(steal)} · Falle: ${coins(trap)}`,
  };
}

/** Großes Banner „Blau ist dran!“ zu Zugbeginn, sonst `null`. */
export function bannerText(view: BoardView | null): string | null {
  if (view?.activeSlot == null || view.gamePhase !== 'turn-start') return null;
  return `${playerName(view, view.activeSlot)} ist dran!`;
}

/** Statuszeile zur offenen Entscheidung („Blau wählt einen Weg …“) oder `null`. */
export function promptStatus(view: BoardView | null): string | null {
  const prompt = view?.prompt;
  if (!view || !prompt) return null;
  const who = playerName(view, prompt.slot);
  switch (prompt.kind) {
    case 'roll':
      return `${who} darf würfeln …`;
    case 'target':
      return `${who} wählt ein Ziel …`;
    case 'path':
      return `${who} wählt einen Weg …`;
    case 'trophy':
      return `${who} überlegt: Trophäe kaufen?`;
    case 'reaction':
      return `${who} kann reagieren!`;
  }
}

/** Zusatz zur Statuszeile, z. B. der Trophäenpreis. */
export function promptDetail(view: BoardView | null): string | null {
  if (view?.prompt?.kind !== 'trophy') return null;
  return `Preis: ${coins(view.trophyPrice)}`;
}

/** Restsekunden als absteigende Folge: 3 → „3 … 2 … 1“, 0 → „0“. */
export function countdownText(seconds: number): string {
  if (seconds <= 0) return '0';
  const parts: string[] = [];
  for (let s = Math.ceil(seconds); s >= 1; s--) parts.push(String(s));
  return parts.join(' … ');
}

/** „Runde 2/5“ (vor dem Start „Runde –/5“). */
export function roundText(view: BoardView | null): string {
  if (!view) return 'Runde –';
  const round = view.round > 0 ? String(view.round) : '–';
  return `Runde ${round}/${view.rounds}`;
}

/** Siegertext für den Endstand („Blau gewinnt!“, bei Gleichstand „Blau und Rosa gewinnen!“). */
export function winnerText(view: BoardView | null): string | null {
  const ranking = view?.ranking;
  if (!ranking || ranking.length === 0) return null;
  const winners = ranking.filter((r) => r.place === 1).map((r) => playerName(view, r.slot));
  if (winners.length === 0) return null;
  if (winners.length === 1) return `${winners[0] ?? ''} gewinnt!`;
  const last = winners[winners.length - 1] ?? '';
  return `${winners.slice(0, -1).join(', ')} und ${last} gewinnen!`;
}

/** Text für einen Münzbetrag in Popups: „+3“, „−5“ (echtes Minuszeichen). */
export function signedAmount(delta: number): string {
  if (delta > 0) return `+${delta}`;
  if (delta < 0) return `−${-delta}`;
  return '±0';
}

/**
 * Text des Minispiel-Overlays am Brett (nur Platzhalter oder unbekanntes Minispiel – echte
 * Minispiele zeigt die Minispiel-Bühne).
 */
export function minigameOverlayText(view: BoardView | null): { title: string; lead: string } {
  const id = view?.minigame?.id;
  if (id === undefined || id === 'placeholder') {
    return {
      title: 'Minispiel-Pause',
      lead: 'Diesmal ohne Minispiel: Die Plätze werden ausgelost.',
    };
  }
  return {
    title: 'Minispiel läuft',
    lead: `Dieser PC kennt „${id}“ nicht – bitte Chaos Party aktualisieren. Ohne Ergebnis gibt es keine Münzen.`,
  };
}
