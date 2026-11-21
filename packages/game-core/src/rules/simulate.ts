/**
 * Bot-Simulation ganzer Partien für Balance-Experimente (CHAOS-24, M4: CHAOS-40): Brett-Tempo,
 * Münzbelohnungen, Item-Häufigkeit, Reaktionsdauer, Partiedauer mit echten Minispielen.
 * Deterministisch je Seed.
 *
 * Die Simulation ersetzt keinen menschlichen Spaßtest; sie liefert objektive Kennzahlen
 * (Dauer, Abstände, Sabotage-Häufigkeit) für den Vergleich von Regelvarianten.
 */
import { KOOP_MAX_TIER, rankByScore, teamPlacements } from '@chaos-party/minigame-sdk';
import { avalancheAt, isCableEdge, isIce } from '../board/hazards.ts';
import { activeNext } from '../board/rotation.ts';
import { createRng, pickOne, type Rng } from '../rng.ts';
import type {
  BoardDefinition,
  BoardEventKind,
  GameEvent,
  GameState,
  ItemKind,
  MinigameOutcome,
  MinigameSpec,
  PlayerState,
  Prompt,
  RankingEntry,
  RuleSet,
  Slot,
  StepResult,
} from '../types.ts';
import { DEFAULT_RULES } from './defaults.ts';
import { rankPlayers } from './economy.ts';
import { ITEM_KINDS } from './items.ts';
import { createGame, step } from './machine.ts';
import { PLACEHOLDER_MINIGAME } from './minigame.ts';
import {
  BRACE_OPTION,
  BUY_OPTION,
  CANCEL_OPTION,
  ROLL_OPTION,
  SHIELD_OPTION,
  SKIP_OPTION,
} from './prompts.ts';
import { BOARD_EVENT_KINDS } from './spaces.ts';

/** Bereich [min, max] in ms, gleichverteilt. */
export type MsRange = readonly [number, number];

/**
 * Rechtsschiefe Zeitverteilung (log-normal) wie bei menschlichen Reaktionszeiten: meist
 * um den Median, selten deutlich länger. `sigma` = Streuung des Logarithmus.
 */
export interface LogNormalMs {
  readonly medianMs: number;
  readonly sigma: number;
  /** Untergrenze (schneller geht es nicht: Wahrnehmung + Tippen). */
  readonly minMs: number;
}

/** Zeitmodell: gleichverteilter Bereich oder log-normal. */
export type DelayModel = MsRange | LogNormalMs;

export interface BotPolicy {
  /** Wahrscheinlichkeit, im Würfel-Prompt ein angebotenes Item einzusetzen. */
  readonly itemUseChance: number;
  /** Trophäe kaufen, wenn möglich. */
  readonly buyTrophies: boolean;
  /** Ziel des Münzklaus: reichster Mitspieler oder zufällig. */
  readonly target: 'richest' | 'random';
  /** Wahrscheinlichkeit, im Reaktionsfenster überhaupt zu reagieren. */
  readonly reactionChance: number;
  /** Reaktionszeit; liegt sie hinter der Frist, ist die Reaktion zu spät (`stale-prompt`). */
  readonly reactionDelayMs: DelayModel;
  /** Entscheidungszeit für alle anderen Prompts (Würfeln, Weg, Trophäe, Ziel). */
  readonly decisionMs: MsRange;
  /**
   * Wahrscheinlichkeit, an einer Verzweigung den Weg mit der kürzesten Strecke zur aktiven
   * Trophäe zu nehmen (sonst zufällig). 0 = immer zufällig (bisheriges Verhalten).
   */
  readonly trophyPathChance: number;
  /**
   * Sichtbare Fallen (CHAOS-51, EXP-019): Wahrscheinlichkeit, an einer Verzweigung Wege zu
   * meiden, auf denen in den nächsten `TRAP_LOOKAHEAD` Feldern eine fremde Falle liegt (nur
   * wenn ein Weg ohne Falle bleibt). Wird vor der Trophäen-Wahl geprüft. 0 = Fallen sind
   * egal bzw. unsichtbar (bisheriges Verhalten).
   */
  readonly avoidTrapChance: number;
  /**
   * Feste Wegwahl je Slot (CHAOS-196, EXP-037: Ist die Wegwahl fair?): `short` nimmt an jeder
   * Gabel den Weg mit der kürzesten Strecke zurück zum Start, `long` den längsten. Geht vor
   * Fallen und Trophäe und zieht keine Zufallszahl; Slots ohne Eintrag wählen wie bisher.
   */
  readonly routes: Readonly<Partial<Record<Slot, 'short' | 'long'>>>;
  /**
   * Echte Minispiele (M3/M4): So lange nach Ende der Spielzeit meldet der „Host“ das Ergebnis
   * (Abschlussbild, Netz). Nur mit `SimulationOptions.minigames`.
   */
  readonly minigameResultDelayMs: number;
  /**
   * Punkte je Spieler und Minispiel: gleichverteilt 0 … `minigameScoreSpread` plus Können
   * (`minigameSkill`). Kleine Spannweite = mehr Gleichstände.
   */
  readonly minigameScoreSpread: number;
  /** Zusatzpunkte je Slot im Minispiel (Können; fehlt = 0). */
  readonly minigameSkill: Readonly<Partial<Record<Slot, number>>>;
  /**
   * Teams (CHAOS-89): So oft gewinnt die Einzelperson bei 1 gegen 3 bzw. 1 gegen 2. Fehlt =
   * 0,45 (das Spiel gleicht die Teamgröße aus, die Einzelperson trägt allein mehr Druck).
   */
  readonly soloWinChance?: number;
}

export const DEFAULT_BOT_POLICY: BotPolicy = {
  itemUseChance: 0.5,
  buyTrophies: true,
  target: 'richest',
  reactionChance: 0.7,
  reactionDelayMs: [600, 3600],
  decisionMs: [800, 2500],
  trophyPathChance: 0,
  avoidTrapChance: 0,
  routes: {},
  minigameResultDelayMs: 500,
  // Gleichstand auf Platz 1 bei 4 Spielern ≈ 4 %, wie die echten Minispiele (EXP-005 … 007).
  minigameScoreSpread: 40,
  minigameSkill: {},
};

export interface SimulationOptions {
  readonly board: BoardDefinition;
  readonly rules?: RuleSet;
  readonly rounds: number;
  readonly seed: number;
  readonly players: 2 | 3 | 4;
  readonly policy?: Partial<BotPolicy>;
  /**
   * Echte Minispiele (Katalog-Rotation): game-core zieht je Runde eines, die Bots liefern ein
   * Ergebnis nach Spielzeit + `minigameResultDelayMs`. Fehlt/leer = M2-Platzhalter.
   */
  readonly minigames?: readonly MinigameSpec[];
}

export interface SimulationPlayerResult {
  readonly slot: Slot;
  readonly place: number;
  readonly coins: number;
  readonly trophies: number;
  /** Summe aller Münzgewinne der Partie (`PlayerStats.coinsEarned`). */
  readonly coinsEarned: number;
}

/** Ein Münzverlust durch Sabotage (Klau nach Reaktion oder ausgelöste Falle). */
export interface SabotageLoss {
  readonly kind: 'steal' | 'trap';
  /** Geschädigter Spieler. */
  readonly slot: Slot;
  /** Tatsächlich verlorene Münzen (0 z. B. bei leerem Beutel). */
  readonly amount: number;
  /** Bestand unmittelbar vor dem Verlust. */
  readonly before: number;
  /** Runde, in der der Verlust geschah (1 … `rounds`). */
  readonly round: number;
}

export interface SimulationResult {
  readonly seed: number;
  readonly players: number;
  readonly rounds: number;
  /** Geschätzte Partiedauer: Pacing-Zeiten + Bot-Entscheidungszeiten (ms). */
  readonly durationMs: number;
  readonly turns: number;
  /** Dauer je Zug von `turn-started` bis `turn-ended` (ms). */
  readonly turnDurationsMs: readonly number[];
  readonly avgTurnMs: number;
  /** Gewürfelte Bewegung je Zug (ohne Windstoß/Tausch). */
  readonly spacesPerTurn: readonly number[];
  readonly avgSpacesPerTurn: number;
  readonly standings: readonly SimulationPlayerResult[];
  readonly ranking: readonly RankingEntry[];
  /**
   * Zwischenstand nach Runde `floor(rounds / 2)` (gleiche Wertung wie der Endstand), `null`
   * bei weniger als 2 Runden. Für den Aufholeffekt: Wie oft gewinnt, wer zur Hälfte führt?
   */
  readonly midRanking: readonly RankingEntry[] | null;
  /** Gespielte Minispiele (ohne Platzhalter: echte mit Ergebnis). */
  readonly minigamesPlayed: number;
  /** Spielerzustand am Ende (Statistik, Minispiel-Siege) für nachgelagerte Wertungsvarianten. */
  readonly finalPlayers: readonly PlayerState[];
  /** Minispiele mit geteiltem 1. Platz. */
  readonly minigameSharedWins: number;
  /** Münzen aus Minispielen (Grund `minigame`, alle Spieler zusammen; CHAOS-89). */
  readonly minigameCoins: number;
  /** Minispiele mit Teams bzw. Koop (CHAOS-89). */
  readonly teamMinigames: number;
  /** Trophäen Platz 1 minus Platz 2 (`null` bei einem Spieler). */
  readonly trophyGap: number | null;
  readonly trophiesBought: number;
  /** Gekaufte Trophäen je Feld (CHAOS-199: Sind alle Trophäen-Kandidaten erreichbar?). */
  readonly trophySpacesBought: Readonly<Record<string, number>>;
  /** Gewählte Wege je Ziel-Feld an Gabeln (`path-chosen`, auch automatisch gewählte). */
  readonly pathsChosen: Readonly<Record<string, number>>;
  /** Jede Wegwahl in Reihenfolge, mit Spieler (Wegwahl gegen Platzierung, CHAOS-199). */
  readonly pathChoices: readonly { readonly slot: Slot; readonly spaceId: string }[];
  /** Durchfahrten drehender Felder je Ausgang (Karussell, CHAOS-199). */
  readonly rotationExits: Readonly<Record<string, number>>;
  /** Rutschpartien auf Eis (CHAOS-198) und dabei gerutschte Felder. */
  readonly iceSlides: number;
  readonly iceSlideSpaces: number;
  /** Seilbahnfahrten (CHAOS-198). */
  readonly cableRides: number;
  /** Abgegangene Lawinen und getroffene Figuren (CHAOS-198). */
  readonly avalanches: number;
  readonly avalancheHits: number;
  readonly coinSteals: number;
  readonly coinsStolen: number;
  readonly trapsPlaced: number;
  readonly trapsTriggered: number;
  /** Fallen, die ein Schild abgefangen hat (`shieldBlocksTrap`); zählen nicht als ausgelöst. */
  readonly trapsBlocked: number;
  readonly coinsLostToTraps: number;
  readonly reactions: Readonly<Record<'shield' | 'brace' | 'timeout', number>>;
  /** Reaktionen, die nach der Frist kamen (`stale-prompt`). */
  readonly lateReactions: number;
  /** Je Reaktionsfenster: Zeit von der Öffnung bis zur Auflösung (ms, ohne Ergebnisanzeige). */
  readonly reactionWaitsMs: readonly number[];
  /** Münzverluste durch Sabotage, in Reihenfolge (Schild-Abwehr erzeugt keinen Eintrag). */
  readonly sabotageLosses: readonly SabotageLoss[];
  readonly itemsGained: Readonly<Record<ItemKind, number>>;
  readonly itemsUsed: Readonly<Record<ItemKind, number>>;
  readonly boardEvents: Readonly<Record<BoardEventKind, number>>;
  readonly autoChoices: number;
  readonly events: number;
}

const MAX_COMMANDS = 1_000_000;
const SIM_NAMES = ['Rot', 'Blau', 'Grün', 'Gelb'] as const;

function counter<K extends string>(keys: readonly K[]): Record<K, number> {
  const result = {} as Record<K, number>;
  for (const key of keys) result[key] = 0;
  return result;
}

/** Zeit ziehen: Bereich gleichverteilt, log-normal per Box-Muller (beides seeded). */
export function sampleDelay(rng: Rng, model: DelayModel): number {
  if (!('medianMs' in model)) return inRange(rng, model);
  const u1 = 1 - rng.next(); // (0, 1], damit log(u1) endlich bleibt
  const u2 = rng.next();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return Math.max(Math.round(model.minMs), Math.round(model.medianMs * Math.exp(model.sigma * z)));
}

function inRange(rng: Rng, [min, max]: MsRange): number {
  const lo = Math.max(0, Math.round(Math.min(min, max)));
  const hi = Math.max(0, Math.round(Math.max(min, max)));
  return rng.int(lo, hi);
}

/**
 * Schritte von `from` bis zum nächsten der `targets` entlang der Laufrichtung (BFS), mit der
 * Stellung der drehenden Felder in Runde `round` (CHAOS-199): Bots sehen das Karussell wie die
 * Spieler am Tisch.
 */
function distanceTo(
  board: BoardDefinition,
  from: string,
  targets: readonly string[],
  round: number,
): number {
  const next = new Map(board.spaces.map((space) => [space.id, activeNext(board, space.id, round)]));
  const seen = new Set([from]);
  let frontier = [from];
  for (let distance = 0; frontier.length > 0; distance++) {
    if (frontier.some((id) => targets.includes(id))) return distance;
    const following: string[] = [];
    for (const id of frontier) {
      for (const to of next.get(id) ?? []) {
        if (!seen.has(to)) {
          seen.add(to);
          following.push(to);
        }
      }
    }
    frontier = following;
  }
  return Infinity;
}

/** So weit (Felder) schaut ein Bot an einer Verzweigung nach sichtbaren Fallen. */
export const TRAP_LOOKAHEAD = 6;

function choosePath(
  candidates: readonly string[],
  state: GameState,
  board: BoardDefinition,
  policy: BotPolicy,
  rng: Rng,
): string {
  const route = state.prompt ? policy.routes[state.prompt.slot] : undefined;
  if (route) {
    const lengths = candidates.map((id) => distanceTo(board, id, [board.start], state.round));
    const pick = route === 'short' ? Math.min(...lengths) : Math.max(...lengths);
    return candidates[lengths.indexOf(pick)] ?? pickOne(rng, candidates);
  }
  let ids = candidates;
  if (policy.avoidTrapChance > 0 && rng.next() < policy.avoidTrapChance) {
    const slot = state.prompt?.slot;
    const traps = state.traps.filter((trap) => trap.owner !== slot).map((trap) => trap.spaceId);
    const safe = ids.filter((id) => distanceTo(board, id, traps, state.round) >= TRAP_LOOKAHEAD);
    if (traps.length > 0 && safe.length > 0) ids = safe;
  }
  if (policy.trophyPathChance > 0 && rng.next() < policy.trophyPathChance) {
    const distances = ids.map((id) => distanceTo(board, id, state.trophySpaces, state.round));
    const best = Math.min(...distances);
    const nearest = ids.filter((_, index) => distances[index] === best);
    if (best !== Infinity && nearest.length > 0) return pickOne(rng, nearest);
  }
  return pickOne(rng, ids);
}

function decide(
  prompt: Prompt,
  state: GameState,
  board: BoardDefinition,
  policy: BotPolicy,
  rng: Rng,
): string {
  const ids = prompt.options.map((o) => o.id);
  switch (prompt.kind) {
    case 'roll': {
      const items = ids.filter((id) => id !== ROLL_OPTION);
      if (items.length > 0 && rng.next() < policy.itemUseChance) return pickOne(rng, items);
      return ROLL_OPTION;
    }
    case 'target': {
      const targets = prompt.options.filter((o) => o.slot !== undefined);
      if (targets.length === 0) return CANCEL_OPTION;
      if (policy.target === 'random') return pickOne(rng, targets).id;
      const coinsOf = (slot: Slot | undefined): number =>
        state.players.find((p) => p.slot === slot)?.coins ?? 0;
      return targets.reduce((best, o) => (coinsOf(o.slot) > coinsOf(best.slot) ? o : best)).id;
    }
    case 'path':
      return choosePath(ids, state, board, policy, rng);
    case 'trophy':
      return policy.buyTrophies ? BUY_OPTION : SKIP_OPTION;
    case 'reaction':
      return ids.includes(SHIELD_OPTION) ? SHIELD_OPTION : BRACE_OPTION;
  }
}

/** Eine Partie mit Bots zu Ende spielen und Kennzahlen sammeln. */
export function simulateGame(options: SimulationOptions): SimulationResult {
  const policy: BotPolicy = { ...DEFAULT_BOT_POLICY, ...options.policy };
  const rules = options.rules ?? DEFAULT_RULES;
  const slots = ([1, 2, 3, 4] as const).slice(0, options.players);
  let state = createGame({
    board: options.board,
    rules,
    rounds: options.rounds,
    seed: options.seed,
    players: slots.map((slot) => ({ slot, name: SIM_NAMES[slot - 1] ?? `Bot ${String(slot)}` })),
    ...(options.minigames ? { minigames: options.minigames } : {}),
  });
  // Eigener Zufall für Bot-Entscheidungen, damit der Spiel-RNG nur Regeln bedient.
  const bot = createRng((options.seed ^ 0x5bd1e995) >>> 0);

  const turnDurations: number[] = [];
  const spacesPerTurn: number[] = [];
  const reactions = { shield: 0, brace: 0, timeout: 0 };
  const itemsGained = counter(ITEM_KINDS);
  const itemsUsed = counter(ITEM_KINDS);
  const boardEvents = counter(BOARD_EVENT_KINDS);
  let turnStart = 0;
  let turnSpaces = 0;
  let round = 0;
  let countingMoves = false;
  let trophiesBought = 0;
  const trophySpacesBought: Record<string, number> = {};
  const pathsChosen: Record<string, number> = {};
  const pathChoices: { slot: Slot; spaceId: string }[] = [];
  const rotationExits: Record<string, number> = {};
  const rotating = new Map((options.board.rotations ?? []).map((r) => [r.space, r.exits]));
  const positions = new Map<Slot, string>(slots.map((slot) => [slot, options.board.start]));
  let iceSlides = 0;
  let iceSlideSpaces = 0;
  let cableRides = 0;
  let avalanches = 0;
  let avalancheHits = 0;
  /** Zwischen `round-started` mit Lawine und dem ersten Zug: Verluste sind Lawinentreffer. */
  let inAvalanche = false;
  /** Letztes Ereignis war ein `moved` dieses Slots (Rutschpartie folgt direkt dem Laufen). */
  let lastMoved: Slot | null = null;
  const bump = (record: Record<string, number>, key: string): void => {
    record[key] = (record[key] ?? 0) + 1;
  };
  let coinSteals = 0;
  let coinsStolen = 0;
  let minigameCoins = 0;
  let teamMinigames = 0;
  let trapsPlaced = 0;
  let trapsTriggered = 0;
  let trapsBlocked = 0;
  /** Letztes Ereignis war eine Falle ohne Verlust: ein folgender Schild hat sie abgefangen. */
  let trapWithoutLoss = false;
  let coinsLostToTraps = 0;
  let lateReactions = 0;
  const reactionWaits: number[] = [];
  let reactionOpenedAt = 0;
  const sabotageLosses: SabotageLoss[] = [];
  const coins = new Map<Slot, number>(slots.map((slot) => [slot, rules.economy.startCoins]));
  let autoChoices = 0;
  let eventCount = 0;

  const record = (event: GameEvent, at: number): void => {
    eventCount += 1;
    const blockedTrap = trapWithoutLoss && event.type === 'item-used' && event.item === 'shield';
    trapWithoutLoss = event.type === 'trap-triggered' && event.amount === 0;
    if (blockedTrap) {
      // CHAOS-51: Schild gegen Falle – keine Sabotage, kein Verlust-Eintrag.
      trapsTriggered -= 1;
      trapsBlocked += 1;
      sabotageLosses.pop();
    }
    const afterMove = lastMoved;
    lastMoved = event.type === 'moved' ? event.slot : null;
    switch (event.type) {
      case 'round-started':
        inAvalanche = avalancheAt(options.board, event.round) !== undefined;
        if (inAvalanche) avalanches += 1;
        break;
      case 'turn-started':
        inAvalanche = false;
        round = event.round;
        turnStart = at;
        turnSpaces = 0;
        countingMoves = false;
        break;
      case 'dice-rolled':
        countingMoves = true;
        break;
      case 'moved': {
        if (countingMoves) turnSpaces += event.path.length;
        let from = positions.get(event.slot);
        if (afterMove === event.slot && from !== undefined && isIce(options.board, from)) {
          iceSlides += 1;
          iceSlideSpaces += event.path.length;
        }
        for (const to of event.path) {
          // Nur echte Ausfahrten, kein Platztausch vom Karussell weg.
          if (from !== undefined && rotating.get(from)?.includes(to)) bump(rotationExits, to);
          from = to;
        }
        if (from !== undefined) positions.set(event.slot, from);
        break;
      }
      case 'path-chosen': {
        const at = positions.get(event.slot);
        if (at !== undefined && isCableEdge(options.board, at, event.spaceId)) cableRides += 1;
        bump(pathsChosen, event.spaceId);
        pathChoices.push({ slot: event.slot, spaceId: event.spaceId });
        break;
      }
      case 'board-event':
        countingMoves = false;
        boardEvents[event.event] += 1;
        break;
      case 'turn-ended':
        turnDurations.push(at - turnStart);
        spacesPerTurn.push(turnSpaces);
        countingMoves = false;
        break;
      case 'trophy-bought':
        trophiesBought += 1;
        bump(trophySpacesBought, event.spaceId);
        break;
      case 'item-gained':
        itemsGained[event.item] += 1;
        break;
      case 'item-used':
        itemsUsed[event.item] += 1;
        if (event.item === 'coin-steal') coinSteals += 1;
        break;
      case 'coins-changed':
        if (inAvalanche && event.delta < 0) avalancheHits += 1;
        coins.set(event.slot, event.balance);
        if (event.reason === 'minigame') minigameCoins += event.delta;
        break;
      case 'coins-stolen':
        coinsStolen += event.amount;
        // Der Transfer ist schon verbucht: Bestand davor = jetzt + Verlust.
        sabotageLosses.push({
          kind: 'steal',
          slot: event.from,
          amount: event.amount,
          before: (coins.get(event.from) ?? 0) + event.amount,
          round,
        });
        break;
      case 'trap-placed':
        trapsPlaced += 1;
        break;
      case 'trap-triggered':
        trapsTriggered += 1;
        coinsLostToTraps += event.amount;
        // Das Ereignis kommt vor dem Transfer: Bestand ist noch der alte.
        sabotageLosses.push({
          kind: 'trap',
          slot: event.slot,
          amount: event.amount,
          before: coins.get(event.slot) ?? 0,
          round,
        });
        break;
      case 'reaction-opened':
        reactionOpenedAt = at;
        break;
      case 'reaction-resolved':
        reactions[event.result] += 1;
        reactionWaits.push(at - reactionOpenedAt);
        break;
      case 'player-auto':
        autoChoices += 1;
        break;
      default:
        break;
    }
  };

  const midRound = Math.floor(options.rounds / 2);
  let midRanking = null as RankingEntry[] | null;
  let minigamesPlayed = 0;
  let minigameSharedWins = 0;

  const apply = (result: StepResult, at: number): void => {
    if (!result.ok) {
      throw new Error(
        `Simulation: unerwarteter Fehler ${result.error.code}: ${result.error.message}`,
      );
    }
    state = result.state;
    for (const event of result.events) {
      record(event, at);
      if (event.type === 'round-ended' && event.round === midRound && midRound >= 1) {
        midRanking = rankPlayers(state.players);
      }
      if (event.type === 'minigame-results' && !event.aborted) {
        minigamesPlayed += 1;
        if (event.placements.filter((p) => p.place === 1).length > 1) minigameSharedWins += 1;
      }
    }
  };

  /**
   * Ergebnis eines echten Minispiels: Punkte je Slot, Plätze wie im SDK („1224“). Bei Teams
   * (CHAOS-89) gewinnt die Einzelperson mit `soloWinChance`, sonst das Team mit mehr Punkten im
   * Schnitt; Koop-Stufe = mittlere Punkte relativ zur Spannweite. Ohne Teams bleibt der
   * Zufallsverbrauch wie vorher.
   */
  const minigameResult = (minigame: NonNullable<GameState['minigame']>, at: number): void => {
    const spec = options.minigames?.find((m) => m.id === minigame.id);
    const spread = Math.max(0, Math.round(policy.minigameScoreSpread));
    const scores = state.players.map((p) => {
      const base = bot.int(0, spread);
      const skill = policy.minigameSkill[p.slot] ?? 0;
      return { slot: p.slot, score: spec?.scoring === 'lower' ? base - skill : base + skill };
    });
    const scoring = spec?.scoring ?? 'higher';
    const teams = minigame.teams;
    let placements = rankByScore(scores, scoring);
    let outcome: MinigameOutcome | undefined;
    if (teams) {
      teamMinigames += 1;
      if (teams.layout === 'koop') {
        const average = scores.reduce((sum, e) => sum + e.score, 0) / Math.max(1, scores.length);
        const tier = Math.round((average / Math.max(1, spread)) * KOOP_MAX_TIER);
        outcome = { kind: 'koop', tier: Math.max(0, Math.min(KOOP_MAX_TIER, tier)) };
      } else {
        const soloLayout = (teams.teams[0]?.length ?? 0) === 1 && (teams.teams[1]?.length ?? 0) > 1;
        let winner: number | null;
        if (soloLayout) {
          winner = bot.next() < (policy.soloWinChance ?? 0.45) ? 0 : 1;
        } else {
          const sign = scoring === 'higher' ? 1 : -1;
          const meanOf = (team: readonly Slot[]) =>
            team.reduce((sum, slot) => sum + (scores.find((e) => e.slot === slot)?.score ?? 0), 0) /
            team.length;
          const [a = 0, b = 0] = teams.teams.map(meanOf);
          winner = a === b ? null : sign * (a - b) > 0 ? 0 : 1;
        }
        placements = teamPlacements(teams, winner, scores, scoring);
        outcome = { kind: 'teams', winner };
      }
    }
    apply(
      step(state, {
        type: 'minigame-result',
        minigameId: minigame.id,
        round: minigame.round,
        placements,
        ...(outcome ? { outcome } : {}),
        at,
      }),
      at,
    );
  };

  apply(step(state, { type: 'start', at: 0 }), 0);
  for (let i = 0; state.phase !== 'game-results'; i++) {
    if (i > MAX_COMMANDS) throw new Error('Simulation endet nicht');
    const prompt = state.prompt;
    const minigame = state.minigame;
    if (
      prompt === null &&
      state.phase === 'minigame-play' &&
      minigame !== null &&
      minigame.id !== PLACEHOLDER_MINIGAME &&
      minigame.placements === null &&
      minigame.playStartedAt !== null
    ) {
      const at = Math.max(
        state.now,
        minigame.playStartedAt + minigame.playMs + policy.minigameResultDelayMs,
      );
      minigameResult(minigame, at);
      continue;
    }
    // CHAOS-214: Bots lesen die Anleitung (Bedenkzeit) und drücken nacheinander „Bereit“.
    const waiting =
      state.phase === 'minigame-intro' && minigame?.ready !== undefined
        ? state.players.find((p) => p.connected && !minigame.ready?.includes(p.slot))
        : undefined;
    if (prompt === null && waiting) {
      const at = state.now + inRange(bot, policy.decisionMs);
      apply(step(state, { type: 'minigame-ready', slot: waiting.slot, at }), at);
      continue;
    }
    if (prompt === null) {
      if (state.resumeAt === null) throw new Error(`Simulation hängt in Phase ${state.phase}`);
      apply(step(state, { type: 'tick', at: state.resumeAt }), state.resumeAt);
      continue;
    }
    if (prompt.kind === 'reaction' && !(bot.next() < policy.reactionChance)) {
      // Keine Reaktion: Fenster läuft ab.
      const at = prompt.deadline ?? state.now;
      apply(step(state, { type: 'tick', at }), at);
      continue;
    }
    const delay =
      prompt.kind === 'reaction'
        ? sampleDelay(bot, policy.reactionDelayMs)
        : inRange(bot, policy.decisionMs);
    const at = state.now + delay;
    const option = decide(prompt, state, options.board, policy, bot);
    const result = step(state, {
      type: 'choose',
      slot: prompt.slot,
      promptId: prompt.id,
      option,
      at,
    });
    if (!result.ok && result.error.code === 'stale-prompt' && prompt.kind === 'reaction') {
      lateReactions += 1;
      // Das Fenster ist an der Frist zu Ende gegangen; ab dort läuft die Partie weiter.
      const deadline = prompt.deadline ?? at;
      apply(step(state, { type: 'tick', at: deadline }), deadline);
      continue;
    }
    apply(result, at);
  }

  const ranking = state.ranking ?? [];
  const first = ranking[0];
  const second = ranking[1];
  const mean = (values: readonly number[]): number =>
    values.length === 0 ? 0 : values.reduce((sum, v) => sum + v, 0) / values.length;

  return {
    seed: options.seed,
    players: options.players,
    rounds: options.rounds,
    durationMs: state.now,
    turns: turnDurations.length,
    turnDurationsMs: turnDurations,
    avgTurnMs: mean(turnDurations),
    spacesPerTurn,
    avgSpacesPerTurn: mean(spacesPerTurn),
    standings: ranking.map((r) => ({
      slot: r.slot,
      place: r.place,
      coins: r.coins,
      trophies: r.trophies,
      coinsEarned: state.players.find((p) => p.slot === r.slot)?.stats.coinsEarned ?? 0,
    })),
    ranking,
    midRanking,
    minigamesPlayed,
    finalPlayers: state.players,
    minigameSharedWins,
    minigameCoins,
    teamMinigames,
    trophyGap: first && second ? first.trophies - second.trophies : null,
    trophiesBought,
    trophySpacesBought,
    pathsChosen,
    pathChoices,
    rotationExits,
    iceSlides,
    iceSlideSpaces,
    cableRides,
    avalanches,
    avalancheHits,
    coinSteals,
    coinsStolen,
    trapsPlaced,
    trapsTriggered,
    trapsBlocked,
    coinsLostToTraps,
    reactions,
    lateReactions,
    reactionWaitsMs: reactionWaits,
    sabotageLosses,
    itemsGained,
    itemsUsed,
    boardEvents,
    autoChoices,
    events: eventCount,
  };
}

export interface SimulationSummary {
  readonly games: number;
  readonly avgDurationMs: number;
  readonly avgTurnMs: number;
  readonly avgSpacesPerTurn: number;
  readonly avgTrophyGap: number;
  /** Anteil Partien, in denen Platz 1 geteilt ist. */
  readonly sharedWinRate: number;
  readonly avgTrophiesBought: number;
  readonly avgCoinSteals: number;
  readonly avgCoinsStolen: number;
  readonly avgTrapsTriggered: number;
  readonly reactionShares: Readonly<Record<'shield' | 'brace' | 'timeout', number>>;
  readonly avgFinalCoins: number;
}

/** Mittelwerte über mehrere Simulationen (z. B. Seeds 1–200 je Variante). */
export function summarizeSimulations(results: readonly SimulationResult[]): SimulationSummary {
  const n = results.length;
  const avg = (pick: (r: SimulationResult) => number): number =>
    n === 0 ? 0 : results.reduce((sum, r) => sum + pick(r), 0) / n;
  const totalReactions = results.reduce(
    (sum, r) => sum + r.reactions.shield + r.reactions.brace + r.reactions.timeout,
    0,
  );
  const share = (key: 'shield' | 'brace' | 'timeout'): number =>
    totalReactions === 0 ? 0 : results.reduce((s, r) => s + r.reactions[key], 0) / totalReactions;
  return {
    games: n,
    avgDurationMs: avg((r) => r.durationMs),
    avgTurnMs: avg((r) => r.avgTurnMs),
    avgSpacesPerTurn: avg((r) => r.avgSpacesPerTurn),
    avgTrophyGap: avg((r) => r.trophyGap ?? 0),
    sharedWinRate: avg((r) => (r.ranking.filter((e) => e.place === 1).length > 1 ? 1 : 0)),
    avgTrophiesBought: avg((r) => r.trophiesBought),
    avgCoinSteals: avg((r) => r.coinSteals),
    avgCoinsStolen: avg((r) => r.coinsStolen),
    avgTrapsTriggered: avg((r) => r.trapsTriggered),
    reactionShares: { shield: share('shield'), brace: share('brace'), timeout: share('timeout') },
    avgFinalCoins: avg((r) =>
      r.standings.length === 0
        ? 0
        : r.standings.reduce((s, p) => s + p.coins, 0) / r.standings.length,
    ),
  };
}
