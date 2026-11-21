/**
 * Wiederholbare Balance-Experimente der Brettphase (CHAOS-24, `docs/experiments.md`).
 *
 * Reine Funktionen: Varianten (Regeln, Brett, Bot-Verhalten) definieren, mit festen Seeds
 * per `simulateGame` durchspielen und als Markdown-Tabellen auswerten. Ausführen:
 *
 * ```sh
 * EXPERIMENTS=1 pnpm exec vitest run packages/game-core/src/rules/experiments.test.ts
 * ```
 *
 * Die Zahlen sind Näherungen aus Bot-Partien (Bots würfeln, setzen Items zufällig ein und
 * reagieren mit angenommenen Reaktionszeiten). Ob sich das gut anfühlt, entscheidet erst
 * der Playtest bei der Abnahme.
 */
import { WACKELWALD_M2 } from '../board/wackelwaldM2.ts';
import type { BoardDefinition, MinigameSpec, RuleSet, SpaceKind } from '../types.ts';
import { DEFAULT_RULES, withRules, type RuleOverrides } from './defaults.ts';
import {
  DEFAULT_BOT_POLICY,
  simulateGame,
  type BotPolicy,
  type DelayModel,
  type SimulationResult,
} from './simulate.ts';

// ---------------------------------------------------------------------------
// Grundlagen
// ---------------------------------------------------------------------------

export type PlayerCount = 2 | 3 | 4;

/**
 * Bot-Verhalten der Experimente: wie `DEFAULT_BOT_POLICY`, aber an Verzweigungen meist
 * Richtung Trophäe (Menschen sehen die Trophäe auf dem Bildschirm und steuern sie an).
 */
export const EXPERIMENT_POLICY: BotPolicy = { ...DEFAULT_BOT_POLICY, trophyPathChance: 0.75 };

export interface Variant {
  /** Kurzzeichen für Tabellen (A, B, …). */
  readonly id: string;
  readonly label: string;
  readonly rules: RuleSet;
  readonly board?: BoardDefinition;
  readonly policy?: Partial<BotPolicy>;
  /** Rundenzahl, falls abweichend vom Experiment. */
  readonly rounds?: number;
  /** Echte Minispiele (M4-Experimente); fehlt = M2-Platzhalter. */
  readonly minigames?: readonly MinigameSpec[];
}

export interface ExperimentSetup {
  readonly seeds: readonly number[];
  readonly players: readonly PlayerCount[];
  readonly rounds: number;
}

/** `count` aufeinanderfolgende Seeds ab `first` (Standard: 1 … count). */
export function seedRange(count: number, first = 1): number[] {
  return Array.from({ length: count }, (_, index) => first + index);
}

/** Standard der Experimente: Seeds 1–200, 2/3/4 Spieler, 5 Runden (Server-Standard bis CHAOS-40, seitdem 10). */
export const DEFAULT_SETUP: ExperimentSetup = {
  seeds: seedRange(200),
  players: [2, 3, 4],
  rounds: 5,
};

/**
 * Startwerte vor CHAOS-24 (Stand nach CHAOS-17 … CHAOS-21). Alle Varianten bauen darauf
 * auf, damit die Tabellen auch nach einer Änderung von `DEFAULT_RULES` wiederholbar bleiben.
 */
export const START_RULES: RuleSet = {
  diceFaces: [1, 2, 3, 4, 5, 6],
  economy: { startCoins: 10, coinsPlus: 3, coinsMinus: 3, minigameRewards: [10, 5, 3, 0] },
  trophy: { price: 20, mode: 'wandering', activeCount: 1 },
  items: {
    capacity: 3,
    startItems: 0,
    weights: { 'double-dice': 3, 'coin-steal': 3, trap: 3, shield: 2 },
    stealAmount: 6,
    trapAmount: 5,
    sabotageGrowthRounds: 0,
    trapTrigger: 'land',
  },
  pacing: {
    turnStartMs: 1200,
    rollMs: 1000,
    stepMs: 350,
    spaceEventMs: 1500,
    turnEndMs: 600,
    minigameIntroMs: 2500,
    minigamePlayMs: 3000,
    minigameResultsMs: 3000,
    roundEndMs: 1500,
    reactionWindowMs: 3000,
    disconnectGraceMs: 15000,
  },
};

/** Variante aus Abweichungen von `START_RULES`. */
export function variant(
  id: string,
  label: string,
  overrides: RuleOverrides = {},
  extra: Omit<Variant, 'id' | 'label' | 'rules'> = {},
): Variant {
  return { id, label, rules: withRules(overrides, START_RULES), ...extra };
}

/** Die aktuellen Standardregeln auf dem Brett der Experimente (Wackelwald M2) als Vergleichszeile. */
export function currentDefaults(id = 'Z', label = 'neue Standardwerte'): Variant {
  return { id, label, rules: DEFAULT_RULES, board: WACKELWALD_M2 };
}

/** Alle Partien einer Variante für eine Spielerzahl. */
export function runVariant(
  v: Variant,
  players: PlayerCount,
  setup: Pick<ExperimentSetup, 'seeds' | 'rounds'>,
): SimulationResult[] {
  return setup.seeds.map((seed) =>
    simulateGame({
      board: v.board ?? START_BOARD,
      rules: v.rules,
      rounds: v.rounds ?? setup.rounds,
      seed,
      players,
      policy: { ...EXPERIMENT_POLICY, ...v.policy },
      ...(v.minigames ? { minigames: v.minigames } : {}),
    }),
  );
}

/** Brett mit geänderten Feldtypen (Topologie und Lage bleiben). */
export function withSpaceKinds(
  board: BoardDefinition,
  kinds: Readonly<Record<string, SpaceKind>>,
  id = `${board.id}-variante`,
): BoardDefinition {
  for (const spaceId of Object.keys(kinds)) {
    if (!board.spaces.some((s) => s.id === spaceId)) {
      throw new RangeError(`Feld ${spaceId} gibt es auf ${board.id} nicht`);
    }
  }
  return {
    ...board,
    id,
    spaces: board.spaces.map((s) => {
      const kind = kinds[s.id];
      return kind === undefined ? s : { ...s, kind };
    }),
  };
}

/** Wackelwald vor CHAOS-24: 4 Trophäen-Kandidaten (s12, s24, s36, s42), 4 Item-Felder. */
export const START_BOARD: BoardDefinition = withSpaceKinds(
  WACKELWALD_M2,
  { s16: 'coins-plus', s19: 'coins-plus', s21: 'coins-plus', s39: 'coins-plus' },
  'wackelwald-start',
);

/** EXP-002: zwei zusätzliche Trophäen-Kandidaten in Reichweite kurzer Partien. */
export const TROPHY_KINDS: Readonly<Record<string, SpaceKind>> = { s16: 'trophy', s21: 'trophy' };
/** EXP-003: zwei zusätzliche Item-Felder (dann etwa alle sechs Felder eins). */
export const ITEM_KINDS_EXTRA: Readonly<Record<string, SpaceKind>> = { s19: 'item', s39: 'item' };

export const TROPHY_BOARD = withSpaceKinds(START_BOARD, TROPHY_KINDS, 'wackelwald-trophaeen');
export const CHOICE_BOARD = withSpaceKinds(
  START_BOARD,
  { ...TROPHY_KINDS, ...ITEM_KINDS_EXTRA },
  'wackelwald-wahl',
);

/** Entscheidung EXP-002 (Ökonomie), Abweichung von `START_RULES`. */
export const ECONOMY_CHOICE: RuleOverrides = { trophy: { price: 15, activeCount: 3 } };

/** Entscheidung EXP-003 (Items), zusätzlich zu `ECONOMY_CHOICE`. */
export const ITEM_CHOICE: NonNullable<RuleOverrides['items']> = {
  startItems: 1,
  trapTrigger: 'pass',
  stealAmount: 5,
  trapAmount: 4,
};

/** Entscheidung EXP-018 (CHAOS-67): Sabotage wächst alle 5 Runden um eine Münze. */
export const SABOTAGE_GROWTH_CHOICE: NonNullable<RuleOverrides['items']> = {
  sabotageGrowthRounds: 5,
};

/** Alle Entscheidungen zusammen; muss `DEFAULT_RULES` ergeben (Test in experiments.test.ts). */
export const CHOICE_RULES: RuleSet = withRules(
  { ...ECONOMY_CHOICE, items: { ...ITEM_CHOICE, ...SABOTAGE_GROWTH_CHOICE } },
  START_RULES,
);

// ---------------------------------------------------------------------------
// Statistik und Ausgabe
// ---------------------------------------------------------------------------

export function mean(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Quantil (0–1) mit linearer Interpolation; leere Liste → 0. */
export function quantile(values: readonly number[], q: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = Math.min(1, Math.max(0, q)) * (sorted.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  const a = sorted[lo] ?? 0;
  const b = sorted[hi] ?? a;
  return a + (b - a) * (pos - lo);
}

export interface Table {
  readonly title: string;
  readonly headers: readonly string[];
  readonly rows: readonly (readonly string[])[];
}

/** Zahl deutsch formatiert (Komma), feste Nachkommastellen. */
export function num(value: number, digits = 1): string {
  return value.toFixed(digits).replace('.', ',');
}

export function pct(share: number): string {
  return `${String(Math.round(share * 100))} %`;
}

export function toMarkdown(table: Table): string {
  const line = (cells: readonly string[]): string => `| ${cells.join(' | ')} |`;
  return [
    `**${table.title}**`,
    '',
    line(table.headers),
    line(table.headers.map(() => '---')),
    ...table.rows.map(line),
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Kennzahlen je Thema
// ---------------------------------------------------------------------------

/** Feste Wartezeit des Platzhalter-Minispiels je Runde (Intro, Spiel, Ergebnis, Rundenende). */
export function minigameMsPerRound(rules: RuleSet): number {
  const p = rules.pacing;
  return p.minigameIntroMs + p.minigamePlayMs + p.minigameResultsMs + p.roundEndMs;
}

export interface PaceMetrics {
  /** Partiedauer ohne Minispiel-Phasen (min). */
  readonly boardMinutes: number;
  /** 90-%-Quantil der Brett-Dauer (min). */
  readonly boardMinutesP90: number;
  readonly turnSeconds: number;
  readonly turnSecondsP90: number;
  /** Wartezeit zwischen zwei eigenen Zügen (Summe der fremden Züge, s). */
  readonly waitSeconds: number;
  readonly spacesPerTurn: number;
  /** Anteil Züge mit höchstens 2 gelaufenen Feldern. */
  readonly shortTurnShare: number;
  /** Gelaufene Felder je Spieler und Partie. */
  readonly spacesPerPlayer: number;
}

export function paceMetrics(results: readonly SimulationResult[], rules: RuleSet): PaceMetrics {
  const first = results[0];
  if (!first) {
    return {
      boardMinutes: 0,
      boardMinutesP90: 0,
      turnSeconds: 0,
      turnSecondsP90: 0,
      waitSeconds: 0,
      spacesPerTurn: 0,
      shortTurnShare: 0,
      spacesPerPlayer: 0,
    };
  }
  const minigame = minigameMsPerRound(rules);
  const board = results.map((r) => (r.durationMs - r.rounds * minigame) / 60_000);
  const turns = results.flatMap((r) => r.turnDurationsMs.map((ms) => ms / 1000));
  const spaces = results.flatMap((r) => r.spacesPerTurn);
  const turnSeconds = mean(turns);
  return {
    boardMinutes: mean(board),
    boardMinutesP90: quantile(board, 0.9),
    turnSeconds,
    turnSecondsP90: quantile(turns, 0.9),
    waitSeconds: (first.players - 1) * turnSeconds,
    spacesPerTurn: mean(spaces),
    shortTurnShare: mean(spaces.map((s) => (s <= 2 ? 1 : 0))),
    spacesPerPlayer: mean(spaces) * first.rounds,
  };
}

export interface EconomyMetrics {
  readonly trophiesPerGame: number;
  readonly trophiesOfWinner: number;
  /** Trophäen Platz 1 minus Platz 2 (Mittel). */
  readonly trophyGap: number;
  /** Anteil Partien, in denen Platz 1 und 2 gleich viele Trophäen haben (Münzen entscheiden). */
  readonly coinsDecideShare: number;
  /** Anteil Partien mit geteiltem Platz 1 (gleiche Trophäen und Münzen). */
  readonly sharedWinShare: number;
  /** Anteil Spieler ohne Trophäe am Ende. */
  readonly noTrophyShare: number;
  /** Anteil Partien ganz ohne gekaufte Trophäe. */
  readonly noTrophyGameShare: number;
  readonly finalCoins: number;
}

export function economyMetrics(results: readonly SimulationResult[]): EconomyMetrics {
  const players = results.flatMap((r) => r.standings);
  return {
    trophiesPerGame: mean(results.map((r) => r.trophiesBought)),
    trophiesOfWinner: mean(results.map((r) => r.ranking[0]?.trophies ?? 0)),
    trophyGap: mean(results.map((r) => r.trophyGap ?? 0)),
    coinsDecideShare: mean(
      results.map((r) => {
        const [a, b] = r.ranking;
        return b !== undefined && a?.trophies === b.trophies ? 1 : 0;
      }),
    ),
    sharedWinShare: mean(
      results.map((r) => (r.ranking.filter((e) => e.place === 1).length > 1 ? 1 : 0)),
    ),
    noTrophyShare: mean(players.map((p) => (p.trophies === 0 ? 1 : 0))),
    noTrophyGameShare: mean(results.map((r) => (r.trophiesBought === 0 ? 1 : 0))),
    finalCoins: mean(players.map((p) => p.coins)),
  };
}

export interface ItemMetrics {
  /** Gezogene Items je Spieler und Partie. */
  readonly itemsPerPlayer: number;
  /** Eingesetzte Items je Spieler und Partie (inkl. Schild). */
  readonly usedPerPlayer: number;
  /** Sabotagen je Partie: Münzklau-Versuche + ausgelöste Fallen. */
  readonly sabotagePerGame: number;
  readonly stealsPerGame: number;
  readonly trapsPlacedPerGame: number;
  readonly trapsTriggeredPerGame: number;
  /** Mittlerer Verlust je Sabotage relativ zum Bestand davor (nur Verluste mit Bestand > 0). */
  readonly lossShare: number;
  /** 90-%-Quantil dieses Anteils. */
  readonly lossShareP90: number;
  /** Mittlere verlorene Münzen je Sabotage. */
  readonly lossCoins: number;
  /** Höchste Zahl Sabotage-Treffer, die ein einzelner Spieler in einer Partie einsteckt (Mittel). */
  readonly maxHitsOnOne: number;
}

export function itemMetrics(results: readonly SimulationResult[]): ItemMetrics {
  const sum = (record: Readonly<Record<string, number>>): number =>
    Object.values(record).reduce((s, v) => s + v, 0);
  const playerGames = results.reduce((s, r) => s + r.players, 0) || 1;
  const losses = results.flatMap((r) => r.sabotageLosses);
  const withCoins = losses.filter((l) => l.before > 0);
  const shares = withCoins.map((l) => l.amount / l.before);
  return {
    itemsPerPlayer: results.reduce((s, r) => s + sum(r.itemsGained), 0) / playerGames,
    usedPerPlayer: results.reduce((s, r) => s + sum(r.itemsUsed), 0) / playerGames,
    sabotagePerGame: mean(results.map((r) => r.coinSteals + r.trapsTriggered)),
    stealsPerGame: mean(results.map((r) => r.coinSteals)),
    trapsPlacedPerGame: mean(results.map((r) => r.trapsPlaced)),
    trapsTriggeredPerGame: mean(results.map((r) => r.trapsTriggered)),
    lossShare: mean(shares),
    lossShareP90: quantile(shares, 0.9),
    lossCoins: mean(losses.map((l) => l.amount)),
    maxHitsOnOne: mean(
      results.map((r) => {
        const hits = new Map<number, number>();
        for (const l of r.sabotageLosses) hits.set(l.slot, (hits.get(l.slot) ?? 0) + 1);
        return Math.max(0, ...hits.values());
      }),
    ),
  };
}

export interface ReactionMetrics {
  readonly windowsPerGame: number;
  /** Anteil Fenster mit gelungener Reaktion (Schild oder Festhalten). */
  readonly successShare: number;
  /** Anteil verspäteter Reaktionen (nach der Frist). */
  readonly lateShare: number;
  /** Mittlere Dauer eines Fensters bis zur Auflösung (s). */
  readonly waitSeconds: number;
  /** Zeit je Partie in Reaktionsfenstern inkl. Ergebnisanzeige (s). */
  readonly secondsPerGame: number;
}

export function reactionMetrics(
  results: readonly SimulationResult[],
  rules: RuleSet,
): ReactionMetrics {
  const waits = results.flatMap((r) => r.reactionWaitsMs);
  const windows = waits.length;
  const ok = results.reduce((s, r) => s + r.reactions.shield + r.reactions.brace, 0);
  const late = results.reduce((s, r) => s + r.lateReactions, 0);
  return {
    windowsPerGame: windows / (results.length || 1),
    successShare: windows === 0 ? 0 : ok / windows,
    lateShare: windows === 0 ? 0 : late / windows,
    waitSeconds: mean(waits) / 1000,
    secondsPerGame:
      (waits.reduce((s, w) => s + w, 0) + windows * rules.pacing.spaceEventMs) /
      1000 /
      (results.length || 1),
  };
}

// ---------------------------------------------------------------------------
// Varianten der vier Themen
// ---------------------------------------------------------------------------

/** Je Variante und Spielerzahl eine Zeile. */
function perVariant(
  title: string,
  headers: readonly string[],
  variants: readonly Variant[],
  setup: ExperimentSetup,
  cells: (results: readonly SimulationResult[], v: Variant) => readonly string[],
): Table {
  const rows: string[][] = [];
  for (const v of variants) {
    for (const players of setup.players) {
      rows.push([
        `${v.id}: ${v.label}`,
        String(players),
        ...cells(runVariant(v, players, setup), v),
      ]);
    }
  }
  return { title, headers: ['Variante', 'Sp.', ...headers], rows };
}

export function seedText(setup: Pick<ExperimentSetup, 'seeds'>): string {
  const first = setup.seeds[0] ?? 0;
  const last = setup.seeds[setup.seeds.length - 1] ?? 0;
  return `Seeds ${String(first)}–${String(last)} je Zeile`;
}

function setupText(setup: ExperimentSetup): string {
  return `${String(setup.rounds)} Runden, ${seedText(setup)}`;
}

/** EXP-001 Brett-Tempo: Würfelverteilung und Pacing (Startregeln, Startbrett). */
export const PACE_VARIANTS: readonly Variant[] = [
  variant('A', 'W6, 350 ms/Feld (Start)'),
  variant('B', 'Würfel 1,2,3,3,4,4,5,6', { diceFaces: [1, 2, 3, 3, 4, 4, 5, 6] }),
  variant('C', 'W4 + Doppelwürfel ×2', {
    diceFaces: [1, 2, 3, 4],
    items: { weights: { 'double-dice': 6 } },
  }),
  variant('D', 'Würfel 2–7', { diceFaces: [2, 3, 4, 5, 6, 7] }),
  variant('E', 'W6, 250 ms/Feld', { pacing: { stepMs: 250 } }),
  variant('F', 'W6, knappe Pausen', {
    pacing: { stepMs: 300, turnStartMs: 900, turnEndMs: 400, rollMs: 900, spaceEventMs: 1300 },
  }),
  currentDefaults(),
];

export function paceExperiment(setup: ExperimentSetup = DEFAULT_SETUP): Table {
  return perVariant(
    `EXP-001 Brett-Tempo (${setupText(setup)})`,
    [
      'Brett min',
      'Brett min p90',
      'Zug s',
      'Zug s p90',
      'Warten s',
      'Felder/Zug',
      '≤ 2 Felder',
      'Trophäen',
    ],
    PACE_VARIANTS,
    setup,
    (results, v) => {
      const m = paceMetrics(results, v.rules);
      return [
        num(m.boardMinutes),
        num(m.boardMinutesP90),
        num(m.turnSeconds),
        num(m.turnSecondsP90),
        num(m.waitSeconds, 0),
        num(m.spacesPerTurn, 2),
        pct(m.shortTurnShare),
        num(economyMetrics(results).trophiesPerGame, 2),
      ];
    },
  );
}

/** EXP-001 Zusatz: Rundenzahl mit den neuen Standardwerten (für Runden-Voreinstellungen). */
export const ROUND_COUNTS: readonly number[] = [5, 8, 10, 12];

export function roundsExperiment(setup: ExperimentSetup = DEFAULT_SETUP): Table {
  const rows: string[][] = [];
  for (const rounds of ROUND_COUNTS) {
    const v = currentDefaults(`${String(rounds)} Runden`);
    for (const players of setup.players) {
      const results = runVariant(v, players, { seeds: setup.seeds, rounds });
      const pace = paceMetrics(results, v.rules);
      const eco = economyMetrics(results);
      rows.push([
        v.id,
        String(players),
        num(pace.boardMinutes),
        num(pace.spacesPerPlayer, 0),
        num(eco.trophiesPerGame, 2),
        num(eco.trophiesOfWinner, 2),
        pct(eco.noTrophyShare),
        pct(eco.coinsDecideShare),
      ]);
    }
  }
  return {
    title: `EXP-001 Rundenzahl mit neuen Standardwerten (${seedText(setup)})`,
    headers: [
      'Runden',
      'Sp.',
      'Brett min',
      'Felder/Sp.',
      'Trophäen',
      'Sieger',
      'ohne Trophäe',
      'Münzen entscheiden',
    ],
    rows,
  };
}

/** EXP-002 Ökonomie: Preis, Trophäen-Modus, Zahl aktiver Trophäen, Kandidaten auf dem Brett. */
export const ECONOMY_VARIANTS: readonly Variant[] = [
  variant('A', 'Preis 20, 1 wandernd (Start)'),
  variant('B', 'Preis 15', { trophy: { price: 15 } }),
  variant('C', 'alle 4 fest aktiv', { trophy: { mode: 'fixed' } }),
  variant('D', '2 von 4 wandernd', { trophy: { activeCount: 2 } }),
  variant(
    'E',
    '6 Kand., 2 wandernd, Preis 15',
    { trophy: { activeCount: 2, price: 15 } },
    { board: TROPHY_BOARD },
  ),
  variant(
    'F',
    '6 Kand., 3 wandernd, Preis 20',
    { trophy: { activeCount: 3 } },
    {
      board: TROPHY_BOARD,
    },
  ),
  variant('G', '6 Kand., 3 wandernd, Preis 15', ECONOMY_CHOICE, { board: TROPHY_BOARD }),
  variant(
    'H',
    'G + Würfel 2–7',
    { ...ECONOMY_CHOICE, diceFaces: [2, 3, 4, 5, 6, 7] },
    { board: TROPHY_BOARD },
  ),
  currentDefaults(),
];

export function economyExperiment(setup: ExperimentSetup = DEFAULT_SETUP): Table {
  return perVariant(
    `EXP-002 Ökonomie (${setupText(setup)})`,
    [
      'Trophäen/Partie',
      'Sieger',
      'Abstand 1–2',
      'Münzen entscheiden',
      'geteilter Sieg',
      'ohne Trophäe',
      'Partien ohne',
      'Münzen Ende',
    ],
    ECONOMY_VARIANTS,
    setup,
    (results) => {
      const m = economyMetrics(results);
      return [
        num(m.trophiesPerGame, 2),
        num(m.trophiesOfWinner, 2),
        num(m.trophyGap, 2),
        pct(m.coinsDecideShare),
        pct(m.sharedWinShare),
        pct(m.noTrophyShare),
        pct(m.noTrophyGameShare),
        num(m.finalCoins),
      ];
    },
  );
}

/** EXP-003 Items: Item-Felder, Start-Item, Fallen-Auslösung, Verlusthöhe (auf Basis EXP-002). */
export const ITEM_VARIANTS: readonly Variant[] = [
  variant('A', '4 Item-Felder (Stand EXP-002)', ECONOMY_CHOICE, { board: TROPHY_BOARD }),
  variant('B', '6 Item-Felder', ECONOMY_CHOICE, { board: CHOICE_BOARD }),
  variant(
    'C',
    'B + Falle beim Überqueren',
    { ...ECONOMY_CHOICE, items: { trapTrigger: 'pass' } },
    { board: CHOICE_BOARD },
  ),
  variant(
    'D',
    'B + 1 Start-Item',
    { ...ECONOMY_CHOICE, items: { startItems: 1 } },
    { board: CHOICE_BOARD },
  ),
  variant(
    'E',
    'C + 1 Start-Item (Klau 6/Falle 5)',
    { ...ECONOMY_CHOICE, items: { trapTrigger: 'pass', startItems: 1 } },
    { board: CHOICE_BOARD },
  ),
  variant(
    'F',
    'E mit Klau 5/Falle 4',
    { ...ECONOMY_CHOICE, items: ITEM_CHOICE },
    { board: CHOICE_BOARD },
  ),
  variant(
    'G',
    'F + Münzklau-Gewicht 4',
    { ...ECONOMY_CHOICE, items: { ...ITEM_CHOICE, weights: { 'coin-steal': 4 } } },
    { board: CHOICE_BOARD },
  ),
  currentDefaults(),
];

export function itemExperiment(setup: ExperimentSetup = DEFAULT_SETUP): Table {
  return perVariant(
    `EXP-003 Items (${setupText(setup)})`,
    [
      'Items/Sp.',
      'eingesetzt/Sp.',
      'Sabotagen/Partie',
      'Klau',
      'Fallen gelegt',
      'Fallen ausgelöst',
      'Verlust/Bestand',
      'p90',
      'Münzen/Treffer',
      'max. Treffer auf einen',
      'Trophäen',
    ],
    ITEM_VARIANTS,
    setup,
    (results) => {
      const m = itemMetrics(results);
      return [
        num(m.itemsPerPlayer, 2),
        num(m.usedPerPlayer, 2),
        num(m.sabotagePerGame, 2),
        num(m.stealsPerGame, 2),
        num(m.trapsPlacedPerGame, 2),
        num(m.trapsTriggeredPerGame, 2),
        pct(m.lossShare),
        pct(m.lossShareP90),
        num(m.lossCoins),
        num(m.maxHitsOnOne, 2),
        num(economyMetrics(results).trophiesPerGame, 2),
      ];
    },
  );
}

export interface ReactionProfile {
  readonly label: string;
  readonly delay: DelayModel;
}

/**
 * Angenommene Reaktionszeiten des angegriffenen Spielers (Begründung in EXP-004): Wer nicht
 * am Zug ist, schaut meist auf den Fernseher, muss den Angriff bemerken, aufs Handy blicken,
 * den Titel lesen und tippen. Log-normal, weil menschliche Reaktionszeiten rechtsschief sind.
 */
export const REACTION_PROFILES: readonly ReactionProfile[] = [
  { label: 'gleichverteilt 600–2500', delay: [600, 2500] },
  { label: 'fokussiert (Median 1,1 s)', delay: { medianMs: 1100, sigma: 0.3, minMs: 500 } },
  { label: 'typisch (Median 1,5 s)', delay: { medianMs: 1500, sigma: 0.4, minMs: 600 } },
  { label: 'abgelenkt (Median 2,3 s)', delay: { medianMs: 2300, sigma: 0.45, minMs: 800 } },
];

export const REACTION_WINDOWS: readonly number[] = [2000, 2500, 3000, 3500, 4000];

/**
 * EXP-004 Reaktionsdauer: Fenster × Reaktionsprofil auf den gewählten Regeln (EXP-002/003).
 * Alle Angegriffenen versuchen zu reagieren; gezählt wird, wer es rechtzeitig schafft.
 */
export function reactionExperiment(setup: ExperimentSetup = DEFAULT_SETUP): Table {
  const rows: string[][] = [];
  for (const windowMs of REACTION_WINDOWS) {
    const rules = withRules({ pacing: { reactionWindowMs: windowMs } }, CHOICE_RULES);
    for (const profile of REACTION_PROFILES) {
      const v: Variant = {
        id: `${String(windowMs)} ms`,
        label: profile.label,
        rules,
        board: CHOICE_BOARD,
        policy: { reactionChance: 1, reactionDelayMs: profile.delay },
      };
      const results = setup.players.flatMap((players) => runVariant(v, players, setup));
      const m = reactionMetrics(results, rules);
      rows.push([
        v.id,
        profile.label,
        num(m.windowsPerGame, 2),
        pct(m.successShare),
        pct(m.lateShare),
        num(m.waitSeconds),
        num(m.secondsPerGame),
      ]);
    }
  }
  return {
    title: `EXP-004 Reaktionsdauer (${setupText(setup)} und Spielerzahl ${setup.players.join('/')}, Regeln aus EXP-002/003)`,
    headers: [
      'Fenster',
      'Reaktionszeit',
      'Fenster/Partie',
      'gelungen',
      'zu spät',
      'Ø bis Auflösung s',
      's/Partie',
    ],
    rows,
  };
}

/** Robustheit: hängen die Entscheidungen am angenommenen Bot-Verhalten? */
export const ROBUSTNESS_VARIANTS: readonly Variant[] = [
  { ...variant('A', 'Start, Bots wie immer') },
  { ...variant('A0', 'Start, Wege zufällig'), policy: { trophyPathChance: 0 } },
  currentDefaults('Z', 'neu, Bots wie immer'),
  { ...currentDefaults('Z0', 'neu, Wege zufällig'), policy: { trophyPathChance: 0 } },
  { ...currentDefaults('Z8', 'neu, Items zu 80 % einsetzen'), policy: { itemUseChance: 0.8 } },
  { ...currentDefaults('ZR', 'neu, Klau-Ziel zufällig'), policy: { target: 'random' } },
];

export function robustnessExperiment(setup: ExperimentSetup = DEFAULT_SETUP): Table {
  return perVariant(
    `Robustheit gegen Bot-Verhalten (${setupText(setup)})`,
    [
      'Trophäen/Partie',
      'ohne Trophäe',
      'Münzen entscheiden',
      'Sabotagen/Partie',
      'Verlust/Bestand',
      'max. Treffer auf einen',
      'Brett min',
    ],
    ROBUSTNESS_VARIANTS,
    setup,
    (results, v) => {
      const eco = economyMetrics(results);
      const items = itemMetrics(results);
      return [
        num(eco.trophiesPerGame, 2),
        pct(eco.noTrophyShare),
        pct(eco.coinsDecideShare),
        num(items.sabotagePerGame, 2),
        pct(items.lossShare),
        num(items.maxHitsOnOne, 2),
        num(paceMetrics(results, v.rules).boardMinutes),
      ];
    },
  );
}

/** Alle Tabellen als Markdown (für `docs/experiments.md`). */
export function runAllExperiments(setup: ExperimentSetup = DEFAULT_SETUP): string {
  return [
    paceExperiment(setup),
    roundsExperiment(setup),
    economyExperiment(setup),
    itemExperiment(setup),
    reactionExperiment(setup),
    robustnessExperiment(setup),
  ]
    .map(toMarkdown)
    .join('\n\n');
}
