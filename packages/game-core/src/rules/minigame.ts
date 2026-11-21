/**
 * Minispiel-Phasen (M3, CHAOS-26/34, ADR-012).
 *
 * Ablauf: `minigame-intro` (Anleitung, `minigameIntroMs`; lief das Minispiel in der Partie schon,
 * die kurze `minigameRepeatIntroMs`, CHAOS-66; mit `minigameReadyTimeoutMs` wartet sie stattdessen,
 * bis alle verbundenen Spieler „Bereit“ gedrückt haben, CHAOS-214) → `minigame-play` (der Host spielt,
 * Frist = Spielzeit + `minigameResultGraceMs`) → `minigame-results` → `round-end`.
 *
 * Die Regeln kennen von einem Minispiel nur Kennung, Spielzeit und Wertungsart. Das Ergebnis
 * kommt als Befehl `minigame-result` vom Host und wird hier vollständig geprüft (Teilnehmer,
 * Wertung mit Gleichstand, Punkte passend zu den Plätzen), bevor Münzen verteilt werden.
 * Ohne konfigurierte Minispiele bleibt der M2-Platzhalter (Rangfolge per Seed).
 */
import { checkResult, KOOP_MAX_TIER, planTeams } from '@chaos-party/minigame-sdk';
import { shuffled } from '../rng.ts';
import type {
  GameState,
  ItemKind,
  MinigameOutcome,
  MinigamePlacement,
  MinigameSpec,
  MinigameState,
  MinigameTeams,
  Pacing,
  Slot,
} from '../types.ts';
import { DEFAULT_TEAM_REWARDS } from './defaults.ts';
import { changeCoins, rankPlayers } from './economy.ts';
import { playerOf, schedule, type Ctx } from './internal.ts';
import { gainRandomItem } from './items.ts';
import {
  eligibleMinigames,
  fillMinigameBag,
  pickMinigameIndex,
  rememberMinigame,
} from './rotation.ts';

export const PLACEHOLDER_MINIGAME = 'placeholder';
export const DEFAULT_MINIGAME_RESULT_GRACE_MS = 15_000;

function specs(ctx: Ctx): readonly MinigameSpec[] {
  return ctx.d.config.minigames;
}

/**
 * Nächstes Minispiel: aus einer gemischten Liste ohne Wiederholung ziehen, mit Filtern,
 * Gewichten und Mischen über die Achsen (CHAOS-85, `rotation.ts`).
 */
function drawMinigame(ctx: Ctx): MinigameSpec | null {
  const all = specs(ctx);
  if (all.length === 0) return null;
  const { internal } = ctx.d;
  const options = ctx.d.config.minigameRotation ?? {};
  if (internal.minigameBag.length === 0) {
    const pool = eligibleMinigames(all, ctx.d.players.length, options);
    internal.minigameBag = fillMinigameBag(ctx.rng, pool, options, internal.minigameLast);
  }
  const byId = new Map(all.map((spec) => [spec.id, spec]));
  const index = pickMinigameIndex(internal.minigameBag, byId, internal.minigameHistory, options);
  const [id] = internal.minigameBag.splice(index, 1);
  if (id === undefined) return null;
  internal.minigameHistory = rememberMinigame(internal.minigameHistory, id);
  internal.minigameLast = id;
  return byId.get(id) ?? null;
}

/** Minispiele, die in dieser Partie schon liefen (Reihenfolge des ersten Starts, CHAOS-85). */
export function playedMinigames(state: GameState): readonly string[] {
  const played = (state.internal as { minigamePlayed?: unknown }).minigamePlayed;
  return Array.isArray(played) ? played.filter((id): id is string => typeof id === 'string') : [];
}

/** Nach dem letzten Zug der Runde: Minispiel wählen und Anleitung zeigen. */
export function enterMinigame(ctx: Ctx, t: number): void {
  const { d } = ctx;
  const spec = drawMinigame(ctx);
  const id = spec?.id ?? PLACEHOLDER_MINIGAME;
  // Der Platzhalter (M2) hat keine Anleitung zum Kürzen: dort zählt jede Runde als erste.
  const played = d.internal.minigamePlayed;
  const repeat = spec !== null && played.includes(id);
  if (spec !== null && !repeat) played.push(id);
  // CHAOS-214: Anleitung eines echten Minispiels wartet auf „Bereit“ (Platzhalter hat keine).
  const readyTimeoutMs = ctx.rules.pacing.minigameReadyTimeoutMs ?? 0;
  const waitForReady = spec !== null && readyTimeoutMs > 0;
  d.activeSlot = null;
  const teams = spec ? teamsFor(ctx, spec) : null;
  d.minigame = {
    id,
    round: d.round,
    seed: ctx.rng.int(0, 0xffff_ffff),
    playMs: spec?.playMs ?? ctx.rules.pacing.minigamePlayMs,
    repeat,
    ...(waitForReady ? { ready: [] } : {}),
    ...(teams ? { teams } : {}),
    playStartedAt: null,
    placements: null,
    highlights: [],
    aborted: false,
    rewards: null,
  };
  ctx.events.push({ type: 'minigame-started', minigame: d.minigame.id });
  if (waitForReady) {
    // Erst die Mindestdauer (`resumeMinigameIntro` öffnet dann das Warten), dann bis zur Frist.
    d.internal.minigameReadyOpen = false;
    schedule(ctx, 'minigame-intro', t, Math.min(readyMinMs(ctx), readyTimeoutMs));
  } else {
    schedule(ctx, 'minigame-intro', t, minigameIntroMs(ctx.rules.pacing, repeat));
  }
}

/**
 * Aufstellung für ein Minispiel mit Teams oder Koop (CHAOS-89). Brett-Stand = Endwertung
 * (Trophäen, Münzen, Siege; Gleichstand nach Slot). Zufall nur bei Zufallszuteilung, damit
 * jeder-gegen-jeden-Partien denselben Seed-Verlauf behalten. `null` = ohne Teams spielen.
 */
function teamsFor(ctx: Ctx, spec: MinigameSpec): MinigameTeams | null {
  if (!spec.teamPlay) return null;
  const slots = ctx.d.players.map((p) => p.slot);
  const standing = rankPlayers(ctx.d.players).map((entry) => entry.slot);
  return planTeams(spec.teamPlay, slots, standing, (n) => ctx.rng.int(0, n - 1));
}

function readyMinMs(ctx: Ctx): number {
  return Math.max(0, ctx.rules.pacing.minigameReadyMinMs ?? 0);
}

/**
 * Geplanter Zeitpunkt der Anleitung erreicht: feste Anleitung vorbei, Sicherheitsfrist
 * abgelaufen oder (CHAOS-214) Mindestdauer vorbei – dann wartet sie bis zur Frist weiter,
 * sofern noch nicht alle bereit sind.
 */
export function resumeMinigameIntro(ctx: Ctx, t: number): void {
  const { d } = ctx;
  if (waitsForReady(ctx) && d.internal.minigameReadyOpen === false) {
    d.internal.minigameReadyOpen = true;
    const timeoutMs = ctx.rules.pacing.minigameReadyTimeoutMs ?? 0;
    d.resumeAt = t + Math.max(0, timeoutMs - readyMinMs(ctx));
    releaseMinigameIntro(ctx, t);
    return;
  }
  startMinigamePlay(ctx, t);
}

/** Wartet die laufende Anleitung auf „Bereit“ (CHAOS-214)? */
function waitsForReady(ctx: Ctx): boolean {
  return ctx.d.phase === 'minigame-intro' && ctx.d.minigame?.ready !== undefined;
}

export type MinigameReadyCheck = { ok: true } | { ok: false; message: string };

/** Prüft `minigame-ready` (ohne etwas zu ändern). */
export function checkMinigameReady(ctx: Ctx): MinigameReadyCheck {
  if (!waitsForReady(ctx)) {
    return {
      ok: false,
      message: `Keine Anleitung, die auf Bereitschaft wartet (Phase ${ctx.d.phase})`,
    };
  }
  return { ok: true };
}

/** Slot ist bereit (CHAOS-214); doppelt ändert nichts. Start prüft `releaseMinigameIntro`. */
export function markMinigameReady(ctx: Ctx, slot: Slot): void {
  const minigame = ctx.d.minigame;
  const ready = minigame?.ready;
  if (!minigame || !ready || ready.includes(slot)) return;
  ctx.d.minigame = { ...minigame, ready: [...ready, slot].sort((a, b) => a - b) };
}

/**
 * Sind alle verbundenen Spieler bereit und ist die Mindestdauer vorbei, endet die Anleitung
 * sofort (CHAOS-214). Getrennte Spieler zählen als bereit, damit ein verlorenes Handy das Spiel
 * nicht aufhält; die Sicherheitsfrist (`resumeAt`) fängt Controller ab, die keinen Knopf anbieten.
 */
export function releaseMinigameIntro(ctx: Ctx, t: number): void {
  const { d } = ctx;
  if (d.paused || !waitsForReady(ctx) || d.internal.minigameReadyOpen !== true) return;
  const ready = d.minigame?.ready ?? [];
  if (!d.players.every((p) => !p.connected || ready.includes(p.slot))) return;
  d.resumeAt = null;
  startMinigamePlay(ctx, t);
}

/** Dauer der Anleitung: voll beim ersten Mal, kurz bei Wiederholung (CHAOS-66). */
export function minigameIntroMs(pacing: Pacing, repeat: boolean): number {
  return repeat ? (pacing.minigameRepeatIntroMs ?? pacing.minigameIntroMs) : pacing.minigameIntroMs;
}

/** Anleitung vorbei: Spielzeit läuft. */
export function startMinigamePlay(ctx: Ctx, t: number): void {
  const { d } = ctx;
  const minigame = d.minigame;
  if (!minigame) throw new Error('Minispiel fehlt');
  d.minigame = { ...minigame, playStartedAt: t };
  const wait =
    minigame.id === PLACEHOLDER_MINIGAME
      ? minigame.playMs
      : minigame.playMs +
        (ctx.rules.pacing.minigameResultGraceMs ?? DEFAULT_MINIGAME_RESULT_GRACE_MS);
  schedule(ctx, 'minigame-play', t, wait);
}

/** Frist von `minigame-play` abgelaufen: Platzhalter auflösen bzw. echtes Minispiel abbrechen. */
export function expireMinigame(ctx: Ctx, t: number): void {
  const minigame = ctx.d.minigame;
  if (!minigame) throw new Error('Minispiel fehlt');
  if (minigame.id === PLACEHOLDER_MINIGAME) {
    const ranking = shuffled(
      ctx.rng,
      ctx.d.players.map((p) => p.slot),
    );
    finishMinigame(
      ctx,
      ranking.map((slot, index) => ({ slot, place: index + 1, score: 0 })),
      [],
      t,
    );
    return;
  }
  ctx.d.minigame = { ...minigame, placements: [], aborted: true, rewards: [] };
  ctx.events.push({ type: 'minigame-results', ranking: [], placements: [], aborted: true });
  schedule(ctx, 'minigame-results', t, ctx.rules.pacing.minigameResultsMs);
}

export type MinigameResultCheck = { ok: true } | { ok: false; message: string };

/** Prüft ein Host-Ergebnis gegen das laufende Minispiel (ohne etwas zu ändern). */
export function checkMinigameResult(
  ctx: Ctx,
  command: {
    readonly minigameId: string;
    readonly round: number;
    readonly placements: readonly MinigamePlacement[];
    readonly highlights?: readonly string[];
    readonly outcome?: MinigameOutcome;
  },
): MinigameResultCheck {
  const { d } = ctx;
  const minigame = d.minigame;
  if (d.phase !== 'minigame-play' || !minigame || minigame.id === PLACEHOLDER_MINIGAME) {
    return { ok: false, message: `Kein Minispiel-Ergebnis erwartet (Phase ${d.phase})` };
  }
  if (command.round !== minigame.round) {
    return {
      ok: false,
      message: `Ergebnis für Runde ${String(command.round)}, läuft ${String(minigame.round)}`,
    };
  }
  const spec = specs(ctx).find((candidate) => candidate.id === minigame.id);
  const check = checkResult(
    {
      minigameId: command.minigameId,
      placements: command.placements,
      ...(command.highlights === undefined ? {} : { highlights: command.highlights }),
      ...(command.outcome === undefined ? {} : { outcome: command.outcome }),
    },
    {
      minigameId: minigame.id,
      slots: d.players.map((p) => p.slot),
      ...(spec ? { scoring: spec.scoring } : {}),
      teams: minigame.teams ?? null,
    },
  );
  return check.ok ? { ok: true } : { ok: false, message: check.reason };
}

/** Geprüftes Ergebnis übernehmen: Münzen je Platz, Ergebnisanzeige. */
export function finishMinigame(
  ctx: Ctx,
  placements: readonly MinigamePlacement[],
  highlights: readonly string[],
  t: number,
  outcome?: MinigameOutcome,
): void {
  const { d } = ctx;
  const minigame = d.minigame;
  if (!minigame) throw new Error('Minispiel fehlt');
  const withOutcome = outcome === undefined ? {} : { outcome };
  const sorted = [...placements]
    .map((entry) => ({ slot: entry.slot, place: entry.place, score: entry.score }))
    .sort((a, b) => a.place - b.place || a.slot - b.slot);
  ctx.events.push({
    type: 'minigame-results',
    ranking: sorted.map((entry) => entry.slot),
    placements: sorted,
    aborted: false,
  });
  if (d.config.practice === true) {
    // Übungsmodus (CHAOS-87): nur Plätze und Punkte, keine Münzen, Siege oder Items.
    d.minigame = {
      ...minigame,
      placements: sorted,
      highlights: [...highlights],
      aborted: false,
      rewards: sorted.map((entry) => ({ slot: entry.slot, coins: 0 })),
      ...withOutcome,
    };
    schedule(ctx, 'minigame-results', t, ctx.rules.pacing.minigameResultsMs);
    return;
  }
  const finale = ctx.rules.catchUp?.finale;
  const factor = finale && d.round > d.rounds - finale.rounds ? finale.factor : 1;
  const payout = payoutRule(ctx, minigame, outcome);
  const rewards = sorted.map((entry) => {
    const reward = payout.coins(entry) * factor;
    // Siege zählen sofort (drittes Wertungskriterium, CHAOS-37); Gleichstand auf 1 für alle.
    // Koop hat keinen Sieger (CHAOS-89).
    if (payout.wins && entry.place === 1) playerOf(ctx, entry.slot).minigameWins += 1;
    return { slot: entry.slot, coins: changeCoins(ctx, entry.slot, reward, 'minigame') };
  });
  // CHAOS-51 (EXP-019): optional Items für den Sieg bzw. als Trostpreis für den letzten Platz
  // (geteilt: alle; sind alle gleichauf, gibt es keinen letzten Platz). Bei Teams nur, wenn eine
  // Einzelperson verliert; Koop hat keinen letzten Platz (CHAOS-89).
  const lastPlace = Math.max(...sorted.map((entry) => entry.place));
  const withItems = rewards.map((reward, index) => {
    const entry = sorted[index];
    if (!entry) return reward;
    let count = payout.wins && entry.place === 1 ? (ctx.rules.items.minigameWinItems ?? 0) : 0;
    if (payout.consolation && entry.place === lastPlace && lastPlace > 1) {
      count += ctx.rules.items.minigameLastItems ?? 0;
    }
    const items: ItemKind[] = [];
    for (let i = 0; i < count; i++) {
      const item = gainRandomItem(ctx, entry.slot);
      if (item) items.push(item);
    }
    return items.length > 0 ? { ...reward, items } : reward;
  });
  d.minigame = {
    ...minigame,
    placements: sorted,
    highlights: [...highlights],
    aborted: false,
    rewards: withItems,
    ...withOutcome,
  };
  schedule(ctx, 'minigame-results', t, ctx.rules.pacing.minigameResultsMs);
}

interface PayoutRule {
  /** Grundmünzen eines Platzes (vor dem Finale-Faktor). */
  readonly coins: (entry: MinigamePlacement) => number;
  /** Zählen erste Plätze als Minispiel-Sieg (und bekommen Sieg-Items)? */
  readonly wins: boolean;
  /** Bekommt der letzte Platz den Trostpreis? */
  readonly consolation: boolean;
}

/**
 * Münz-Regel je Spielform (CHAOS-89): jeder gegen jeden nach `minigameRewards`, Teams und Koop
 * nach `economy.teamRewards` (siehe `TeamRewards`).
 */
function payoutRule(
  ctx: Ctx,
  minigame: MinigameState,
  outcome: MinigameOutcome | undefined,
): PayoutRule {
  const placeRewards = ctx.rules.economy.minigameRewards;
  const teams = minigame.teams;
  // 1 gegen 1 (Ersatz zu zweit) ist ein Duell wie jeder gegen jeden: gleiche Münzen (EXP-038).
  if (!teams || !outcome || teams.layout === '1v1') {
    return {
      coins: (entry) => placeRewards[entry.place - 1] ?? 0,
      wins: true,
      consolation: true,
    };
  }
  const rule = ctx.rules.economy.teamRewards ?? DEFAULT_TEAM_REWARDS;
  if (outcome.kind === 'koop') {
    const share = Math.max(0, Math.min(KOOP_MAX_TIER, outcome.tier)) / KOOP_MAX_TIER;
    return {
      coins: (entry) => Math.round((rule.koop[entry.place - 1] ?? 0) * share),
      wins: false,
      consolation: false,
    };
  }
  const winners = outcome.winner === null ? null : (teams.teams[outcome.winner] ?? []);
  const losers = teams.teams.filter((team) => team !== winners).flat();
  const soloWin = winners !== null && winners.length === 1 && losers.length > 1;
  return {
    coins: (entry) => {
      if (winners === null) return rule.draw;
      if (!winners.includes(entry.slot)) return rule.lose;
      return soloWin ? Math.round(rule.win * rule.soloWinFactor) : rule.win;
    },
    wins: true,
    consolation: winners !== null && losers.length === 1,
  };
}
