/**
 * Bot-Profile und Bot-Partien (rein, aus den Arcade-Prototypen von EXP-005 herausgelöst).
 *
 * Jedes Spiel schreibt seinen Bot selbst (was ein guter Zug ist, weiß nur das Spiel), aber
 * über dieselbe Schnittstelle `MinigameBot` und mit denselben Profilen. `runBotMatch` spielt
 * damit eine ganze Runde auf der reinen Logik und liefert ein `GameRecord`; `matchMetrics`
 * fasst viele Runden zu den Kennzahlen der Fairness-Messung zusammen (EXP-005/EXP-016).
 *
 * Werte sind Annahmen für Couch-Spieler (Reaktionszeit inkl. Bildschirm/Funk-Latenz), nicht
 * gemessen. Zahlen aus Bot-Partien sind Näherungen, kein Beweis für Spaß.
 */
import {
  createMinigameRng,
  lerpStrength,
  type MinigameBotDriver,
  type MinigameInput,
  type MinigameRng,
  type Slot,
} from '@chaos-party/minigame-sdk';
import { LeadTracker } from './scoreboard.ts';

export interface BotProfile {
  readonly name: string;
  /** Mittlere Reaktionszeit (ms) auf ein neues Signal. */
  readonly reactionMs: number;
  /** Lenkungsungenauigkeit (Radiant, Standardabweichung). */
  readonly aimNoise: number;
  /** Zeitfehler beim Takt-Drücken (ms, Standardabweichung). */
  readonly timingSdMs: number;
  /** Wahrscheinlichkeit, auf eine Finte hereinzufallen / zu früh zu drücken. */
  readonly falseStart: number;
  /** Wahrscheinlichkeit, eine Gefahr rechtzeitig zu bemerken. */
  readonly awareness: number;
  /** Wahrscheinlichkeit, das beste statt eines zufälligen Ziels zu wählen. */
  readonly judgement: number;
  /** Wahrscheinlichkeit für einen Aussetzer (Takt verpasst, Knopf nicht gedrückt). */
  readonly lapse: number;
  /**
   * Wahrscheinlichkeit, statt des eigenen Vorteils der Führung zu schaden (rempeln, Gefahr
   * auf sie lenken). Fehlt = 0; nur der Störenfried hat einen hohen Wert. Jedes Spiel
   * entscheidet, was das heißt.
   */
  readonly mischief?: number;
}

/**
 * Die gemeinsamen Profile. Neuling, Normal und Profi bilden die Spanne der Fairness-Messung,
 * Gut füllt bei vier Bots auf, der Störenfried spielt mittelmäßig, aber gegen die Führung
 * (Eindringling-Test gegen Dauerdrücken und Hetzjagd).
 */
export const BOT_PROFILES = {
  profi: {
    name: 'Profi',
    reactionMs: 230,
    aimNoise: 0.05,
    timingSdMs: 35,
    falseStart: 0.06,
    awareness: 0.95,
    judgement: 0.9,
    lapse: 0.02,
    mischief: 0,
  },
  gut: {
    name: 'Gut',
    reactionMs: 310,
    aimNoise: 0.1,
    timingSdMs: 55,
    falseStart: 0.12,
    awareness: 0.85,
    judgement: 0.75,
    lapse: 0.04,
    mischief: 0,
  },
  normal: {
    name: 'Normal',
    reactionMs: 400,
    aimNoise: 0.18,
    timingSdMs: 80,
    falseStart: 0.2,
    awareness: 0.7,
    judgement: 0.6,
    lapse: 0.07,
    mischief: 0,
  },
  neuling: {
    name: 'Neuling',
    reactionMs: 560,
    aimNoise: 0.3,
    timingSdMs: 120,
    falseStart: 0.32,
    awareness: 0.5,
    judgement: 0.4,
    lapse: 0.12,
    mischief: 0,
  },
  stoerenfried: {
    name: 'Störenfried',
    reactionMs: 350,
    aimNoise: 0.15,
    timingSdMs: 70,
    falseStart: 0.18,
    awareness: 0.75,
    judgement: 0.6,
    lapse: 0.05,
    mischief: 0.8,
  },
} as const satisfies Record<string, BotProfile>;

export type BotProfileId = keyof typeof BOT_PROFILES;

export type PlayerCount = 2 | 3 | 4;

/**
 * Besetzung je Spielerzahl: immer der stärkste (Profi) und der schwächste (Neuling) Bot,
 * dazwischen aufgefüllt. Index 0 ist der Profi, der letzte Index der Neuling.
 */
export function lineup(players: PlayerCount): BotProfile[] {
  const { profi, gut, normal, neuling } = BOT_PROFILES;
  if (players === 2) return [profi, neuling];
  if (players === 3) return [profi, normal, neuling];
  return [profi, gut, normal, neuling];
}

/** Besetzung mit Störenfried statt des zweitbesten Bots (Eindringling-Test). */
export function lineupWithTroublemaker(players: PlayerCount): BotProfile[] {
  const base = lineup(players);
  if (base.length < 3) return [BOT_PROFILES.stoerenfried, ...base.slice(1)];
  return [base[0] ?? BOT_PROFILES.profi, BOT_PROFILES.stoerenfried, ...base.slice(2)];
}

/** Standardnormalverteilt (Box-Muller). */
export function gaussian(rng: MinigameRng): number {
  const u = Math.max(1e-9, rng.next());
  const v = rng.next();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Log-normal um `mean` (ms) mit Streuung `sigma` (Reaktionszeiten sind rechtsschief). */
export function reactionSample(rng: MinigameRng, mean: number, sigma = 0.25): number {
  return mean * Math.exp(sigma * gaussian(rng) - (sigma * sigma) / 2);
}

/** Winkel in der x/z-Ebene → Stick (x, y = +z) mit Lenkungsrauschen des Profils. */
export function noisyStick(
  angle: number,
  profile: BotProfile,
  rng: MinigameRng,
): { x: number; y: number } {
  const noisy = angle + gaussian(rng) * profile.aimNoise;
  return { x: Math.cos(noisy), y: Math.sin(noisy) };
}

/**
 * Wahrnehmung eines Bots: Ein neues Ding (Socke, Signal, Gefahr) bemerkt er erst nach seiner
 * Reaktionszeit, Gefahren nur mit Wahrscheinlichkeit `awareness`.
 */
export class BotSenses<K extends string | number = number> {
  private readonly seen = new Map<K, { noticeAt: number; aware: boolean }>();

  constructor(
    private readonly profile: BotProfile,
    private readonly rng: MinigameRng,
  ) {}

  /** Neues Ding melden (mehrfach aufrufen ist harmlos). `now` in s. */
  see(id: K, now: number): void {
    if (this.seen.has(id)) return;
    this.seen.set(id, {
      noticeAt: now + reactionSample(this.rng, this.profile.reactionMs) / 1000,
      aware: this.rng.next() < this.profile.awareness,
    });
  }

  /** Bemerkt? `danger` = es ist eine Gefahr (dann zählt auch `awareness`). */
  noticed(id: K, now: number, danger = false): boolean {
    const seen = this.seen.get(id);
    if (!seen || now < seen.noticeAt) return false;
    return !danger || seen.aware;
  }

  forget(id: K): void {
    this.seen.delete(id);
  }
}

/** Was ein Bot in einem Schritt tut: Stick setzen, Knöpfe drücken/loslassen. */
export interface BotAction {
  readonly stick?: { readonly x: number; readonly y: number };
  readonly press?: readonly ('a' | 'b')[];
  readonly release?: readonly ('a' | 'b')[];
}

/** Gemeinsame Bot-Schnittstelle: liest den Spielzustand, liefert eine Aktion oder nichts. */
export interface MinigameBot<G> {
  readonly slot: Slot;
  readonly profile: BotProfile;
  act(game: G): BotAction | null;
  /** Bedeutsame Entscheidungen (Zielwechsel, Knöpfe), für „wie viel zu tun“. */
  readonly decisions?: number;
}

/** Protokoll einer simulierten Runde. `scores[i]` gehört zu Bot `i` der Besetzung. */
export interface GameRecord {
  readonly durationMs: number;
  readonly scores: readonly number[];
  /** Wie oft wechselte die alleinige Führung (Gleichstand zählt nicht als Wechsel). */
  readonly leadChanges: number;
  /** Alleiniger Führender nach 2/3 der Spielzeit (`null` bei Gleichstand). */
  readonly leaderAtTwoThirds: number | null;
  /** Bedeutsame Aktionen je Spieler (Ziele/Knöpfe), für „wie viel zu tun“. */
  readonly actions: readonly number[];
}

/** Wie `runBotMatch` ein Spiel bedient. Alles rein und deterministisch. */
export interface BotMatchAdapter<G> {
  create(slots: readonly Slot[], rng: MinigameRng, durationMs: number): G;
  bot(slot: Slot, profile: BotProfile, rng: MinigameRng): MinigameBot<G>;
  apply(game: G, slot: Slot, action: BotAction): void;
  step(game: G, dt: number): void;
  finished(game: G): boolean;
  /** Punkte je Slot in Reihenfolge der Besetzung (für Führung und Ergebnis). */
  scores(game: G): number[];
  /** Spielzeit in ms (für die Führung nach 2/3). */
  elapsedMs(game: G): number;
  /** Zusätzliche Aktionen je Slot, die der Bot nicht zählt (z. B. Hechtsprünge). */
  extraActions?(game: G, slot: Slot): number;
}

/** Fester Schritt wie in der Laufzeit (ADR-012). */
const STEP_S = 1 / 60;

/**
 * Eine ganze Runde mit Bots auf der reinen Spiellogik (1/60-s-Schritte wie die Laufzeit).
 * Bot `i` bekommt den Zufall `seed × 31 + slot` (wie in EXP-005).
 */
export function runBotMatch<G>(
  adapter: BotMatchAdapter<G>,
  seed: number,
  profiles: readonly BotProfile[],
  durationMs: number,
): GameRecord {
  const slots = ([1, 2, 3, 4] as const).slice(0, profiles.length);
  const game = adapter.create(slots, createMinigameRng(seed), durationMs);
  const bots = slots.map((slot, index) =>
    adapter.bot(slot, profiles[index] ?? BOT_PROFILES.normal, createMinigameRng(seed * 31 + slot)),
  );
  const lead = new LeadTracker((durationMs * 2) / 3);
  // Notbremse: höchstens doppelte Spielzeit simulieren.
  const maxSteps = Math.ceil((durationMs / 1000 / STEP_S) * 2) + 60;
  for (let step = 0; step < maxSteps && !adapter.finished(game); step++) {
    for (const bot of bots) {
      const action = bot.act(game);
      if (action) adapter.apply(game, bot.slot, action);
    }
    adapter.step(game, STEP_S);
    lead.update(adapter.scores(game), adapter.elapsedMs(game));
  }
  return {
    durationMs,
    scores: adapter.scores(game),
    leadChanges: lead.changes,
    leaderAtTwoThirds: lead.leaderAtTwoThirds,
    actions: bots.map(
      (bot) => (bot.decisions ?? 0) + (adapter.extraActions?.(game, bot.slot) ?? 0),
    ),
  };
}

export interface MatchMetrics {
  readonly durationS: number;
  readonly winnerScore: number;
  /** Mittlerer relativer Abstand Platz 1–2: (P1 − P2) / P1. */
  readonly gap: number;
  /** Anteil Runden mit geteiltem ersten Platz. */
  readonly tieForFirst: number;
  readonly leadChanges: number;
  /** Anteil Runden, in denen der Sieger nach 2/3 der Zeit nicht allein führte. */
  readonly comeback: number;
  /** Siegquote des stärksten Bots (Index 0, Gleichstand anteilig). */
  readonly strongestWins: number;
  /** Siegquote des schwächsten Bots (letzter Index, Gleichstand anteilig). */
  readonly weakestWins: number;
  /** Aktionen je Spieler und 10 s. */
  readonly actionsPer10s: number;
}

/** Kennzahlen über viele Runden (gleiche Formeln wie EXP-005/EXP-016). */
export function matchMetrics(records: readonly GameRecord[]): MatchMetrics {
  let duration = 0;
  let winnerScore = 0;
  let gap = 0;
  let ties = 0;
  let leadChanges = 0;
  let comeback = 0;
  let strongest = 0;
  let weakest = 0;
  let actions = 0;
  for (const record of records) {
    const { scores } = record;
    const sorted = [...scores].sort((a, b) => b - a);
    const best = sorted[0] ?? 0;
    const second = sorted[1] ?? 0;
    const winners = scores.flatMap((score, index) => (score === best ? [index] : []));
    duration += record.durationMs / 1000;
    winnerScore += best;
    gap += best > 0 ? (best - second) / best : 0;
    if (winners.length > 1) ties++;
    leadChanges += record.leadChanges;
    if (record.leaderAtTwoThirds === null || !winners.includes(record.leaderAtTwoThirds)) {
      comeback++;
    }
    if (winners.includes(0)) strongest += 1 / winners.length;
    if (winners.includes(scores.length - 1)) weakest += 1 / winners.length;
    const totalActions = record.actions.reduce((sum, value) => sum + value, 0);
    actions += totalActions / scores.length / (record.durationMs / 10_000);
  }
  const n = Math.max(1, records.length);
  return {
    durationS: duration / n,
    winnerScore: winnerScore / n,
    gap: gap / n,
    tieForFirst: ties / n,
    leadChanges: leadChanges / n,
    comeback: comeback / n,
    strongestWins: strongest / n,
    weakestWins: weakest / n,
    actionsPer10s: actions / n,
  };
}

// --- KI-Spieler in echten Partien (CHAOS-180, ADR-020) ------------------------------------

/**
 * Eckwerte der Stärke für Spiele mit `BotProfile`: leicht = Neuling, schwer = Profi (die
 * Spanne der Fairness-Messung, EXP-005). Auch „schwer“ hat Reaktionszeit, Zielrauschen und
 * Aussetzer. Die Werte stellt CHAOS-183 nach Messung ein.
 */
export const BOT_STRENGTH_CORNERS = {
  leicht: BOT_PROFILES.neuling,
  schwer: BOT_PROFILES.profi,
} as const satisfies Record<'leicht' | 'schwer', BotProfile>;

/** Bot-Profil zur Stärke `s` (0 = leicht … 1 = schwer), jeder Wert linear interpoliert. */
export function profileForStrength(strength: number): BotProfile {
  const { leicht, schwer } = BOT_STRENGTH_CORNERS;
  const mix = (key: Exclude<keyof BotProfile, 'name' | 'mischief'>) =>
    lerpStrength(leicht[key], schwer[key], strength);
  return {
    name: `KI ${Math.round(lerpStrength(0, 100, strength))} %`,
    reactionMs: mix('reactionMs'),
    aimNoise: mix('aimNoise'),
    timingSdMs: mix('timingSdMs'),
    falseStart: mix('falseStart'),
    awareness: mix('awareness'),
    judgement: mix('judgement'),
    lapse: mix('lapse'),
    mischief: 0,
  };
}

/**
 * Bot über die gemeinsame Schnittstelle (`MinigameBot`, `act` → `BotAction`) als Laufzeit-Bot
 * (`MinigameBotDriver`): Stick wird `move`, Knöpfe werden `press`/`release`. `observe` liefert
 * den Spielzustand zum Lesen (`null` = noch nicht bereit).
 */
export function kitBotDriver<G>(bot: MinigameBot<G>, observe: () => G | null): MinigameBotDriver {
  return {
    slot: bot.slot,
    tick: () => {
      const game = observe();
      if (game === null) return [];
      const action = bot.act(game);
      return action ? actionInputs(action) : [];
    },
  };
}

/** `BotAction` → Eingaben (Stick zuerst, dann drücken, dann loslassen). */
export function actionInputs(action: BotAction): MinigameInput[] {
  const inputs: MinigameInput[] = [];
  if (action.stick) inputs.push({ type: 'move', x: action.stick.x, y: action.stick.y });
  for (const button of action.press ?? []) inputs.push({ type: 'press', button });
  // Ein Druck ohne eigenes Loslassen ist ein kurzer Tipp (wie die Bots der Bot-Partien).
  for (const button of action.press ?? []) {
    if (!action.release?.includes(button)) inputs.push({ type: 'release', button });
  }
  for (const button of action.release ?? []) inputs.push({ type: 'release', button });
  return inputs;
}

// --- Figuren-Bots für Physik-Spiele (EXP-006, Pudding-Gerangel, Krümel-Kehraus) -------------

/** Können eines Figuren-Bots in Havok-Spielen (EXP-006). */
export interface PawnBotSkill {
  readonly name: string;
  /** Alle wie viele Schritte neu entscheiden (Reaktionszeit). */
  readonly replanSteps: number;
  /** Zielfehler (Bogenmaß-Streuung der Stick-Richtung). */
  readonly noise: number;
  /** Wahrscheinlichkeit, einen guten Rempler auch zu nutzen. */
  readonly dashChance: number;
  /** Achtet auf Gefahren aus der Umgebung. */
  readonly aware: boolean;
}

/**
 * Stufen der Figuren-Bots: Neuling und Normal aus EXP-006 (`SKILLS.weak`/`normal`), Profi aus
 * der Fairness-Prüfung (CHAOS-84: plant alle 6 Schritte, zielt genauer, rempelt gezielter).
 */
export const PAWN_BOT_SKILLS = {
  profi: { name: 'profi', replanSteps: 6, noise: 0.12, dashChance: 0.8, aware: true },
  normal: { name: 'normal', replanSteps: 10, noise: 0.25, dashChance: 0.6, aware: true },
  neuling: { name: 'schwach', replanSteps: 24, noise: 0.6, dashChance: 0.3, aware: false },
} as const satisfies Record<string, PawnBotSkill>;

/** Ab dieser Stärke achtet ein Figuren-Bot auf Gefahren (Neuling nicht, Normal schon). */
export const PAWN_AWARE_FROM = 0.3;

/** Figuren-Können zur Stärke `s` (leicht = Neuling, schwer = Profi). */
export function pawnSkillForStrength(strength: number): PawnBotSkill {
  const { neuling, profi } = PAWN_BOT_SKILLS;
  return {
    name: `KI ${Math.round(lerpStrength(0, 100, strength))} %`,
    replanSteps: Math.round(lerpStrength(neuling.replanSteps, profi.replanSteps, strength)),
    noise: lerpStrength(neuling.noise, profi.noise, strength),
    dashChance: lerpStrength(neuling.dashChance, profi.dashChance, strength),
    aware: lerpStrength(0, 1, strength) >= PAWN_AWARE_FROM,
  };
}

/** Entscheid eines Figuren-Bots: Stick (x, y = +z) und ob gerempelt wird (A). */
export interface PawnDecision {
  readonly x: number;
  readonly y: number;
  readonly dash: boolean;
}

/** Richtung (dx, dz) → Stick mit gleichverteiltem Zielfehler ±`noise` und Tempo `speed`. */
export function aim(
  dx: number,
  dz: number,
  noise: number,
  rng: MinigameRng,
  speed = 1,
): PawnDecision {
  const len = Math.hypot(dx, dz);
  if (len < 1e-3) return { x: 0, y: 0, dash: false };
  const angle = Math.atan2(dz, dx) + (rng.next() * 2 - 1) * noise;
  const s = Math.min(1, speed);
  return { x: Math.cos(angle) * s, y: Math.sin(angle) * s, dash: false };
}

/**
 * Laufzeit-Bot für Figuren-Spiele: entscheidet alle `skill.replanSteps` Schritte neu (versetzt
 * je Platz wie in EXP-006), lenkt dorthin und rempelt mit A. `decide` liefert `null`, solange
 * es nichts zu entscheiden gibt (Figur raus, Spiel noch nicht bereit).
 */
export function pawnBotDriver(
  slot: Slot,
  skill: PawnBotSkill,
  decide: () => PawnDecision | null,
): MinigameBotDriver {
  let step = 0;
  let planned = false;
  return {
    slot,
    tick: () => {
      const due = (step + slot * 3) % skill.replanSteps === 0 || !planned;
      step++;
      if (!due) return [];
      const decision = decide();
      if (!decision) return [];
      planned = true;
      const inputs: MinigameInput[] = [{ type: 'move', x: decision.x, y: decision.y }];
      if (decision.dash) {
        inputs.push({ type: 'press', button: 'a' }, { type: 'release', button: 'a' });
      }
      return inputs;
    },
  };
}
