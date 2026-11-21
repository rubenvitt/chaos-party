import type { CatchUpRules, Pacing, RuleSet, TeamRewards } from '../types.ts';

/**
 * Standardregeln. Festgelegt per Bot-Simulation in CHAOS-24 (`docs/experiments.md`,
 * EXP-001 … EXP-004; Startwerte davor: `START_RULES` in `experiments.ts`). In M4 (CHAOS-40,
 * EXP-012/013) mit echter Minispiel-Rotation und 10–20 Runden geprüft und unverändert
 * behalten; der Hebel war die Rundenzahl (`apps/server/src/game.ts`). Seit CHAOS-67 (EXP-018)
 * wächst die Sabotage mit der Runde, seit CHAOS-65 (EXP-022) gibt es eine Aufholhilfe. Ob sich
 * das gut anfühlt, entscheidet der Playtest.
 */
export const DEFAULT_RULES: RuleSet = {
  diceFaces: [1, 2, 3, 4, 5, 6],
  economy: {
    startCoins: 10,
    coinsPlus: 3,
    coinsMinus: 3,
    minigameRewards: [10, 5, 3, 0],
  },
  // EXP-002: 3 von 6 Kandidaten aktiv, Preis 15 – sonst fallen in 5 Runden kaum Trophäen.
  // CHAOS-65 (EXP-022): Eine wandernde Trophäe landet vor den Letzten. Zu zweit gewinnt der
  // Halbzeit-Führende 64 statt 72 %, kaum noch jemand bleibt ohne Trophäe (1–3 statt 4–12 %).
  trophy: { price: 15, mode: 'wandering', activeCount: 3, placement: 'nearest-to-last' },
  items: {
    capacity: 3,
    // EXP-003: Start-Item und Fallen beim Darüberlaufen, damit Sabotage überhaupt vorkommt;
    // Verluste passend zum niedrigeren Trophäenpreis etwas kleiner.
    startItems: 1,
    weights: { 'double-dice': 3, 'coin-steal': 3, trap: 3, shield: 2 },
    stealAmount: 5,
    trapAmount: 4,
    // EXP-018: +1 alle 5 Runden (Runde 6–10: Klau 6/Falle 5, 11–15: 7/6 …). Der Bestand wächst
    // mit den Minispiel-Münzen; feste Werte bissen im letzten Drittel nur noch halb so stark.
    sabotageGrowthRounds: 5,
    trapTrigger: 'pass',
    // EXP-019 (CHAOS-51): Trostpreis – wer im Minispiel Letzte(r) wird, bekommt ein Item.
    // Verdoppelt die Sabotage (zu zweit etwa alle 2–3 statt alle 6 Runden) und dämpft den
    // Vorsprung guter Minispieler, statt ihn wie ein Sieg-Item zu verstärken.
    minigameLastItems: 1,
  },
  pacing: {
    turnStartMs: 1200,
    rollMs: 1000,
    stepMs: 350,
    spaceEventMs: 1500,
    turnEndMs: 600,
    // M3: Zeit zum Lesen der Anleitung bzw. der Ergebniskarte (Platzhalter-Minispiel: 3 s Spiel).
    minigameIntroMs: 7000,
    // CHAOS-66: Wiederholung eines Minispiels in derselben Partie, nur Titel + Bedienlegende.
    minigameRepeatIntroMs: 3000,
    // CHAOS-214: Anleitung wartet auf „Bereit“ aller; nach 60 s geht es trotzdem los. Mindestens
    // 3 s, damit die Bühne steht (wie die kurze Anleitung, ADR-012 Nachtrag 3).
    minigameReadyTimeoutMs: 60_000,
    minigameReadyMinMs: 3000,
    minigamePlayMs: 3000,
    minigameResultsMs: 6000,
    roundEndMs: 1500,
    // CHAOS-125: Rundenende mit Rückenwind-Ansage (nur wenn die Regel an ist und Münzen fließen).
    tailwindMs: 3500,
    reactionWindowMs: 3000,
    disconnectGraceMs: 15000,
  },
};

/** Alle automatischen Pausen 0 (Fristen für Reaktion/Disconnect bleiben): für Tests und Simulation. */
export const ZERO_PACING: Pacing = {
  ...DEFAULT_RULES.pacing,
  turnStartMs: 0,
  rollMs: 0,
  stepMs: 0,
  spaceEventMs: 0,
  turnEndMs: 0,
  minigameIntroMs: 0,
  minigameRepeatIntroMs: 0,
  minigameReadyTimeoutMs: 0,
  minigameReadyMinMs: 0,
  minigamePlayMs: 0,
  minigameResultsMs: 0,
  roundEndMs: 0,
  tailwindMs: 0,
};

/**
 * Rückenwind (CHAOS-65/CHAOS-125, EXP-022): 2 Münzen je Trophäe Rückstand, höchstens 6, nach
 * jedem Minispiel außer dem letzten. Standard aus, bis der Playtest entscheidet; der Server
 * schaltet ihn mit `RUECKENWIND=1` ein (`withTailwind`).
 */
export const TAILWIND_RULE: NonNullable<CatchUpRules['tailwind']> = { perTrophy: 2, max: 6 };

/** Regeln mit eingeschaltetem Rückenwind (übrige Aufholhilfen bleiben). */
export function withTailwind(base: RuleSet = DEFAULT_RULES): RuleSet {
  return { ...base, catchUp: { ...base.catchUp, tailwind: TAILWIND_RULE } };
}

/** Regeln mit überschriebenen Teilen (flach je Gruppe zusammengeführt). */
export interface RuleOverrides {
  readonly diceFaces?: readonly number[];
  readonly economy?: Partial<RuleSet['economy']>;
  readonly trophy?: Partial<RuleSet['trophy']>;
  readonly items?: Partial<Omit<RuleSet['items'], 'weights'>> & {
    readonly weights?: Partial<RuleSet['items']['weights']>;
  };
  readonly pacing?: Partial<Pacing>;
  /** Aufholhilfen: ersetzt einzelne Hilfen (flach zusammengeführt). */
  readonly catchUp?: CatchUpRules;
}

export function withRules(overrides: RuleOverrides, base: RuleSet = DEFAULT_RULES): RuleSet {
  return {
    diceFaces: overrides.diceFaces ?? base.diceFaces,
    economy: { ...base.economy, ...overrides.economy },
    trophy: { ...base.trophy, ...overrides.trophy },
    items: {
      ...base.items,
      ...overrides.items,
      weights: { ...base.items.weights, ...overrides.items?.weights },
    },
    pacing: { ...base.pacing, ...overrides.pacing },
    ...(base.catchUp || overrides.catchUp
      ? { catchUp: { ...base.catchUp, ...overrides.catchUp } }
      : {}),
  };
}

/**
 * Münz-Regel für Teams und Koop (CHAOS-89), solange `economy.teamRewards` fehlt. Festgelegt in
 * EXP-038 (Variante E): Je Minispiel fließen bei 3–4 Personen etwa so viele Münzen wie bei jeder
 * gegen jeden (17–18), zu viert gewinnt die zur Halbzeit führende Person seltener (46 statt 55 %).
 * Verlierer bekommen etwas, damit Teams nicht nur Münzen umverteilen; Einzelsieg doppelt; Koop
 * zahlt bei Stufe 2 von 3 etwa wie jeder gegen jeden, bei Stufe 3 mehr. 1 gegen 1 zahlt wie
 * jeder gegen jeden (`minigameRewards`).
 */
export const DEFAULT_TEAM_REWARDS: TeamRewards = {
  win: 7,
  lose: 2,
  draw: 4,
  soloWinFactor: 2,
  koop: [12, 9, 6, 3],
};

/** Startwert aus dem Konzept (README §7 Nr. 2), Variante B in EXP-038. */
export const START_TEAM_REWARDS: TeamRewards = {
  win: 10,
  lose: 0,
  draw: 3,
  soloWinFactor: 2,
  koop: [10, 5, 3, 0],
};
