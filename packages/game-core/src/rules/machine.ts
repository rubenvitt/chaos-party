/**
 * Zustandsautomat der Brettphase (CHAOS-17): `createGame` und der reine Reducer `step`.
 *
 * Jeder Befehl lässt zuerst die Zeit bis `at` laufen (Fristen und `resumeAt` in
 * zeitlicher Reihenfolge, beliebig viele automatische Übergänge), dann wird er angewandt,
 * danach läuft alles sofort Fällige (`resumeAt <= at`) weiter. Automatische Übergänge
 * rechnen mit ihrem geplanten Zeitpunkt, nicht mit dem Tick-Zeitpunkt; der Ablauf hängt
 * deshalb nicht davon ab, wie oft der Server tickt.
 */
import { avalancheAt } from '../board/hazards.ts';
import { createRng, pickOne, shuffled } from '../rng.ts';
import type {
  GameCommand,
  GameConfig,
  GameErrorCode,
  GameState,
  ItemKind,
  Slot,
  StepResult,
} from '../types.ts';
import {
  applyTailwind,
  changeCoins,
  rankPlayers,
  sabotageGrows,
  sabotageLevel,
} from './economy.ts';
import {
  closeDraft,
  openDraft,
  playerOf,
  schedule,
  spaceMap,
  type Ctx,
  type Internal,
} from './internal.ts';
import { gainRandomItem, useCoinSteal, useItemFromRoll } from './items.ts';
import { choosePath, decideTrophy, resumeMovement, rollDice } from './movement.ts';
import {
  ACTIVE_ITEMS,
  BUY_OPTION,
  CANCEL_OPTION,
  graceDeadline,
  openRollPrompt,
  ROLL_OPTION,
  slotOption,
} from './prompts.ts';
import {
  checkMinigameReady,
  checkMinigameResult,
  enterMinigame,
  expireMinigame,
  finishMinigame,
  markMinigameReady,
  releaseMinigameIntro,
  resumeMinigameIntro,
} from './minigame.ts';
import { resolveReaction } from './reaction.ts';
import { copyRotationOptions } from './rotation.ts';
import { tallyStats } from './stats.ts';
import { enterSpaceEvent } from './spaces.ts';

/** Schutz gegen Endlosschleifen bei fehlerhafter Konfiguration (z. B. Brett ohne Ziel). */
const MAX_TRANSITIONS_PER_STEP = 100_000;

const VALID_SLOTS: readonly Slot[] = [1, 2, 3, 4];

// ---------------------------------------------------------------------------
// Partie anlegen
// ---------------------------------------------------------------------------

function assertConfig(config: GameConfig): void {
  const { board, rules, players, rounds } = config;
  if (!Number.isInteger(rounds) || rounds < 1) {
    throw new RangeError(`Rundenzahl muss eine ganze Zahl ≥ 1 sein, war ${String(rounds)}`);
  }
  if (players.length < 1 || players.length > 4) {
    throw new RangeError(`1–4 Spieler erwartet, waren ${String(players.length)}`);
  }
  const slots = new Set<number>();
  for (const player of players) {
    if (!VALID_SLOTS.includes(player.slot)) {
      throw new RangeError(`Ungültiger Slot ${String(player.slot)}`);
    }
    if (slots.has(player.slot)) throw new RangeError(`Slot ${String(player.slot)} doppelt`);
    slots.add(player.slot);
  }
  const spaces = spaceMap(board);
  if (spaces.size !== board.spaces.length) throw new RangeError('Feld-IDs doppelt');
  if (!spaces.has(board.start)) throw new RangeError(`Startfeld ${board.start} fehlt`);
  for (const space of board.spaces) {
    for (const next of space.next) {
      if (!spaces.has(next)) throw new RangeError(`Feld ${space.id}: Nachfolger ${next} fehlt`);
    }
  }
  for (const rotation of board.rotations ?? []) {
    const next = spaces.get(rotation.space)?.next;
    if (!next) throw new RangeError(`Drehung an unbekanntem Feld ${rotation.space}`);
    if (rotation.exits.length < 1 || rotation.exits.some((id) => !next.includes(id))) {
      throw new RangeError(`Drehung an ${rotation.space}: Ausgänge passen nicht zu next`);
    }
  }
  // CHAOS-198: Eis, Seilbahn und Lawine dürfen den Regelkern nicht festfahren (Endlos-Rutschen,
  // unbekannte Felder, kostenlose Standardoption). Die ausführliche Prüfung macht `validateBoard`.
  const ice = new Set(board.ice ?? []);
  for (const id of ice) {
    if (spaces.get(id)?.next.length !== 1) {
      throw new RangeError(`Eisfeld ${id} fehlt oder hat nicht genau einen Nachfolger`);
    }
  }
  if (ice.size > 0 && ice.size === spaces.size) throw new RangeError('Brett ist nur Eis');
  for (const id of ice) {
    let current = id;
    for (let i = 0; ice.has(current); i++) {
      if (i > ice.size) throw new RangeError(`Eis ab ${id} läuft im Kreis`);
      current = spaces.get(current)?.next[0] ?? current;
    }
  }
  for (const car of board.cableCars ?? []) {
    const next = spaces.get(car.from)?.next ?? [];
    if (!next.includes(car.to) || next[0] === car.to || !(car.price >= 1)) {
      throw new RangeError(`Seilbahn ${car.from} → ${car.to} ist ungültig`);
    }
  }
  if (board.avalanche) {
    const { every, coins, zones } = board.avalanche;
    if (!Number.isInteger(every) || every < 1 || !(coins >= 1)) {
      throw new RangeError('Lawine: every und coins müssen ≥ 1 sein');
    }
    for (const zone of zones) {
      for (const id of zone.spaces) {
        if (!spaces.has(id)) throw new RangeError(`Lawinenzone ${zone.name}: Feld ${id} fehlt`);
      }
    }
  }
  if (!Number.isInteger(rules.trophy.activeCount) || rules.trophy.activeCount < 1) {
    throw new RangeError('trophy.activeCount muss eine ganze Zahl ≥ 1 sein');
  }
  if (!Number.isInteger(rules.items.startItems) || rules.items.startItems < 0) {
    throw new RangeError('items.startItems muss eine ganze Zahl ≥ 0 sein');
  }
  for (const key of ['minigameWinItems', 'minigameLastItems'] as const) {
    const count = rules.items[key] ?? 0;
    if (!Number.isInteger(count) || count < 0) {
      throw new RangeError(`items.${key} muss eine ganze Zahl ≥ 0 sein`);
    }
  }
  if (!Number.isInteger(rules.items.sabotageGrowthRounds) || rules.items.sabotageGrowthRounds < 0) {
    throw new RangeError('items.sabotageGrowthRounds muss eine ganze Zahl ≥ 0 sein');
  }
  const minigameIds = new Set<string>();
  for (const spec of config.minigames ?? []) {
    if (!/^[a-z0-9-]{3,32}$/.test(spec.id))
      throw new RangeError(`Minispiel-ID ${spec.id} ungültig`);
    if (minigameIds.has(spec.id)) throw new RangeError(`Minispiel ${spec.id} doppelt`);
    minigameIds.add(spec.id);
    if (!Number.isInteger(spec.playMs) || spec.playMs < 1_000) {
      throw new RangeError(`Minispiel ${spec.id}: playMs muss ≥ 1000 sein`);
    }
  }
  if (config.practice === true) {
    if ((config.minigames ?? []).length !== 1) {
      throw new RangeError('Übungsmodus braucht genau ein Minispiel');
    }
    if (rounds !== 1) throw new RangeError('Übungsmodus hat genau eine Runde');
  }
  if (rules.diceFaces.length === 0) throw new RangeError('diceFaces ist leer');
  if (rules.diceFaces.some((face) => !Number.isInteger(face) || face < 0)) {
    throw new RangeError('diceFaces: nur ganze Zahlen ≥ 0');
  }
}

/** Neue Partie in Phase `setup`. Wirft bei ungültiger Konfiguration (Programmierfehler). */
export function createGame(config: GameConfig): GameState {
  assertConfig(config);
  const { board, rules, seed } = config;
  const rng = createRng(seed);
  const trophies = board.spaces.filter((s) => s.kind === 'trophy').map((s) => s.id);
  const active = Math.min(rules.trophy.activeCount, trophies.length);
  const trophySpaces =
    rules.trophy.mode === 'fixed' || trophies.length === 0
      ? trophies
      : active <= 1
        ? [pickOne(rng, trophies)]
        : shuffled(rng, trophies).slice(0, active);
  const internal: Internal = {
    board,
    rng: rng.state(),
    promptSeq: 0,
    turnIndex: 0,
    itemUsed: false,
    diceCount: 1,
    move: null,
    reaction: null,
    promptBaseDeadline: null,
    minigameBag: [],
    minigameLast: null,
    minigameHistory: [],
    minigamePlayed: [],
  };
  return {
    boardId: board.id,
    phase: 'setup',
    round: 0,
    rounds: config.rounds,
    turnOrder: [],
    activeSlot: null,
    players: config.players.map((p) => ({
      slot: p.slot,
      name: p.name,
      spaceId: board.start,
      coins: rules.economy.startCoins,
      trophies: 0,
      items: [],
      connected: true,
      minigameWins: 0,
      stats: { coinsEarned: 0, coinsLost: 0, spacesMoved: 0, itemsUsed: 0 },
    })),
    trophySpaces,
    traps: [],
    prompt: null,
    resumeAt: null,
    now: 0,
    ranking: null,
    paused: false,
    pausedAt: null,
    endedEarly: false,
    minigame: null,
    config: {
      rules,
      seed,
      minigames: (config.minigames ?? []).map((spec) => ({ ...spec })),
      ...(config.practice === true ? { practice: true } : {}),
      ...(config.minigameRotation === undefined
        ? {}
        : { minigameRotation: copyRotationOptions(config.minigameRotation) }),
    },
    internal: internal as unknown as Readonly<Record<string, unknown>>,
  };
}

// ---------------------------------------------------------------------------
// Zugablauf
// ---------------------------------------------------------------------------

function startTurn(ctx: Ctx, t: number): void {
  const { d } = ctx;
  const slot = d.turnOrder[d.internal.turnIndex];
  if (slot === undefined) throw new Error('Kein Spieler für diesen Zug');
  d.activeSlot = slot;
  d.internal.itemUsed = false;
  d.internal.diceCount = 1;
  d.internal.move = null;
  d.internal.reaction = null;
  ctx.events.push({ type: 'turn-started', slot, round: d.round });
  schedule(ctx, 'turn-start', t, ctx.rules.pacing.turnStartMs);
}

function startRound(ctx: Ctx, t: number): void {
  const { d } = ctx;
  d.round += 1;
  d.internal.turnIndex = 0;
  d.minigame = null;
  ctx.events.push(
    sabotageGrows(ctx.rules.items, d.round)
      ? {
          type: 'round-started',
          round: d.round,
          sabotage: sabotageLevel(ctx.rules.items, d.round),
        }
      : { type: 'round-started', round: d.round },
  );
  applyAvalanche(ctx);
  startTurn(ctx, t);
}

/**
 * Lawine zu Rundenbeginn (CHAOS-198, `avalancheAt`): Wer auf einem Feld der Zone steht,
 * verliert `coins` Münzen (Grund `space`, zählt als Pech). Ohne Zufall; die Hosts sagen sie
 * an `round-started` an.
 */
function applyAvalanche(ctx: Ctx): void {
  const board = ctx.d.internal.board;
  const zone = avalancheAt(board, ctx.d.round);
  const coins = board.avalanche?.coins ?? 0;
  if (!zone || coins <= 0) return;
  const spaces = new Set(zone.spaces);
  for (const slot of ctx.d.turnOrder) {
    if (spaces.has(playerOf(ctx, slot).spaceId)) changeCoins(ctx, slot, -coins, 'space');
  }
}

function startGame(ctx: Ctx, t: number): void {
  const { d } = ctx;
  d.turnOrder = shuffled(
    ctx.rng,
    d.players.map((p) => p.slot),
  );
  ctx.events.push({ type: 'game-started', order: [...d.turnOrder] });
  if (d.config.practice === true) {
    // Übungsmodus (CHAOS-87): gleich das eine Minispiel, ohne Brettzug und ohne Start-Items.
    d.round = 1;
    enterMinigame(ctx, t);
    return;
  }
  // Start-Items in Zugreihenfolge (Ereignisse zeigen sie am PC und am Controller).
  for (let i = 0; i < ctx.rules.items.startItems; i++) {
    for (const slot of d.turnOrder) gainRandomItem(ctx, slot);
  }
  startRound(ctx, t);
}

function endTurn(ctx: Ctx, t: number): void {
  const slot = ctx.d.activeSlot;
  if (slot === null) throw new Error('Zugende ohne Spieler am Zug');
  ctx.events.push({ type: 'turn-ended', slot });
  schedule(ctx, 'turn-end', t, ctx.rules.pacing.turnEndMs);
}

function afterTurn(ctx: Ctx, t: number): void {
  const { d } = ctx;
  d.internal.turnIndex += 1;
  if (d.internal.turnIndex < d.turnOrder.length) {
    startTurn(ctx, t);
    return;
  }
  enterMinigame(ctx, t);
}

/**
 * Endstand. `endedEarly` (Befehl `end`, M4): mitten in der Partie aus dem aktuellen Stand;
 * ein laufendes Minispiel verfällt ohne Münzen, eine Pause endet.
 */
function finishGame(ctx: Ctx, endedEarly = false): void {
  const { d } = ctx;
  const ranking = rankPlayers(d.players);
  d.ranking = ranking;
  d.activeSlot = null;
  d.phase = 'game-results';
  d.prompt = null;
  d.resumeAt = null;
  d.internal.promptBaseDeadline = null;
  d.internal.move = null;
  d.internal.reaction = null;
  d.paused = false;
  d.pausedAt = null;
  d.endedEarly = endedEarly;
  if (endedEarly) d.minigame = null;
  ctx.events.push({ type: 'game-ended', ranking, endedEarly });
}

/**
 * Pause vorbei (M4): Alle absoluten Fristen rücken um die Pausendauer nach hinten, damit
 * niemand durch die Pause Zeit verliert (Prompt-Frist, automatische Phase, Minispiel-Beginn
 * und damit Spielzeit + Schonfrist).
 */
function shiftDeadlines(ctx: Ctx, delta: number): void {
  const { d } = ctx;
  if (delta <= 0) return;
  if (d.resumeAt !== null) d.resumeAt += delta;
  if (d.prompt && d.prompt.deadline !== null) {
    d.prompt = { ...d.prompt, deadline: d.prompt.deadline + delta };
  }
  if (d.internal.promptBaseDeadline !== null) d.internal.promptBaseDeadline += delta;
  if (d.minigame && d.minigame.playStartedAt !== null) {
    d.minigame = { ...d.minigame, playStartedAt: d.minigame.playStartedAt + delta };
  }
}

/** Geplanter Zeitpunkt `t` einer automatischen Phase ist erreicht. */
function resume(ctx: Ctx, t: number): void {
  const { d } = ctx;
  const { pacing } = ctx.rules;
  switch (d.phase) {
    case 'turn-start':
      openRollPrompt(ctx, t);
      return;
    case 'move':
      if (resumeMovement(ctx, t)) enterSpaceEvent(ctx, t);
      return;
    case 'space-event':
      endTurn(ctx, t);
      return;
    case 'reaction-window':
      // Anzeige des Reaktionsergebnisses vorbei: Angreifer würfelt weiter.
      d.internal.reaction = null;
      openRollPrompt(ctx, t);
      return;
    case 'turn-end':
      afterTurn(ctx, t);
      return;
    case 'minigame-intro':
      resumeMinigameIntro(ctx, t);
      return;
    case 'minigame-play':
      expireMinigame(ctx, t);
      return;
    case 'minigame-results': {
      // Übungsmodus (CHAOS-87): nach dem Ergebnis ist Schluss, ohne Rundenende.
      if (d.config.practice === true) {
        finishGame(ctx);
        return;
      }
      // CHAOS-125: Rückenwind wird beim Rundenende angesagt (PC-Karte, Controller-Hinweis).
      const tailwind = d.round < d.rounds ? applyTailwind(ctx) : [];
      if (tailwind.length > 0 && d.minigame) d.minigame = { ...d.minigame, tailwind };
      ctx.events.push({ type: 'round-ended', round: d.round });
      const announceMs = tailwind.length > 0 ? (pacing.tailwindMs ?? 0) : 0;
      schedule(ctx, 'round-end', t, pacing.roundEndMs + announceMs);
      return;
    }
    case 'round-end':
      if (d.round < d.rounds) startRound(ctx, t);
      else finishGame(ctx);
      return;
    case 'setup':
    case 'roll':
    case 'choose-target':
    case 'choose-path':
    case 'trophy-offer':
    case 'game-results':
      throw new Error(`Phase ${d.phase} hat keinen automatischen Übergang`);
  }
}

/** Gültige Wahl für den offenen Prompt anwenden (Prüfung ist schon erfolgt). */
function applyOption(ctx: Ctx, option: string, t: number): void {
  const prompt = ctx.d.prompt;
  if (!prompt) throw new Error('Kein Prompt offen');
  switch (prompt.kind) {
    case 'roll':
      if (option === ROLL_OPTION) rollDice(ctx, t);
      else useItemFromRoll(ctx, option.slice('item:'.length) as ItemKind, t);
      return;
    case 'target':
      if (option === CANCEL_OPTION) openRollPrompt(ctx, t);
      else useCoinSteal(ctx, Number(option.slice('slot:'.length)) as Slot, t);
      return;
    case 'path':
      choosePath(ctx, option, t);
      return;
    case 'trophy':
      decideTrophy(ctx, option === BUY_OPTION, t);
      return;
    case 'reaction':
      resolveReaction(ctx, option, t);
      return;
  }
}

/** Frist abgelaufen: Standardoption anwenden. */
function expirePrompt(ctx: Ctx, t: number): void {
  const prompt = ctx.d.prompt;
  if (!prompt) return;
  const connected = playerOf(ctx, prompt.slot).connected;
  ctx.events.push({
    type: 'player-auto',
    slot: prompt.slot,
    option: prompt.defaultOption,
    reason: connected ? 'timeout' : 'disconnected',
  });
  applyOption(ctx, prompt.defaultOption, t);
}

/** Zeit bis `at` laufen lassen: Fristen und automatische Phasen in zeitlicher Folge. */
function advance(ctx: Ctx, at: number): void {
  const { d } = ctx;
  for (let i = 0; ; i++) {
    if (i > MAX_TRANSITIONS_PER_STEP) {
      throw new Error('Zu viele automatische Übergänge in einem Schritt');
    }
    const deadline = d.prompt?.deadline ?? null;
    if (deadline !== null && deadline <= at) {
      d.now = Math.max(d.now, deadline);
      expirePrompt(ctx, d.now);
      continue;
    }
    if (d.resumeAt !== null && d.resumeAt <= at) {
      const t = d.resumeAt;
      d.resumeAt = null;
      d.now = Math.max(d.now, t);
      resume(ctx, t);
      continue;
    }
    break;
  }
  d.now = Math.max(d.now, at);
}

// ---------------------------------------------------------------------------
// Befehle
// ---------------------------------------------------------------------------

function fail(state: GameState, code: GameErrorCode, message: string): StepResult {
  return { ok: false, state, error: { code, message } };
}

/** Option im offenen Prompt zulässig? `item:*` zusätzlich gegen den Bestand geprüft. */
function isOfferedOption(ctx: Ctx, option: string): boolean {
  const prompt = ctx.d.prompt;
  if (!prompt?.options.some((o) => o.id === option)) return false;
  if (prompt.kind === 'roll' && option !== ROLL_OPTION) {
    const item = option.slice('item:'.length) as ItemKind;
    return ACTIVE_ITEMS.includes(item) && playerOf(ctx, prompt.slot).items.includes(item);
  }
  if (prompt.kind === 'target' && option !== CANCEL_OPTION) {
    return ctx.d.players.some((p) => slotOption(p.slot) === option && p.slot !== prompt.slot);
  }
  return true;
}

function setConnection(ctx: Ctx, slot: Slot, connected: boolean, at: number): void {
  const { d } = ctx;
  playerOf(ctx, slot).connected = connected;
  const prompt = d.prompt;
  if (prompt?.slot !== slot) return;
  const deadline = connected
    ? d.internal.promptBaseDeadline
    : Math.min(prompt.deadline ?? Infinity, graceDeadline(ctx, null, at));
  d.prompt = { ...prompt, deadline };
}

/**
 * Reiner Reducer: wendet `command` auf `state` an und liefert neuen Zustand und Ereignisse.
 * Bei einem Fehler (`ok: false`) ist der zurückgegebene Zustand der unveränderte Eingang.
 */
export function step(state: GameState, command: GameCommand): StepResult {
  const at = command.at;
  if (!Number.isFinite(at) || at < state.now) {
    return fail(
      state,
      'time-went-back',
      `Zeitpunkt ${String(at)} liegt vor dem letzten (${String(state.now)})`,
    );
  }
  const ctx = openDraft(state);
  const { d } = ctx;
  // Pausiert: Fristen laufen nicht ab, nur `now` rückt vor (Befehle bleiben monoton).
  const run = () => {
    if (d.paused) d.now = Math.max(d.now, at);
    else advance(ctx, at);
  };
  run();
  /** Zeitpunkt, zu dem ein Befehl wirkt: in der Pause der Pausenbeginn (wird später verschoben). */
  const effectiveAt = d.paused ? (d.pausedAt ?? at) : at;

  switch (command.type) {
    case 'tick':
      break;
    case 'pause':
      if (d.phase === 'setup' || d.phase === 'game-results') {
        return fail(state, 'wrong-phase', `Pause nur während der Partie (Phase ${d.phase})`);
      }
      if (d.paused) return fail(state, 'paused', 'Partie ist bereits pausiert');
      d.paused = true;
      d.pausedAt = at;
      break;
    case 'resume':
      if (!d.paused) return fail(state, 'not-paused', 'Partie ist nicht pausiert');
      shiftDeadlines(ctx, at - (d.pausedAt ?? at));
      d.paused = false;
      d.pausedAt = null;
      break;
    case 'end':
      if (d.phase === 'setup' || d.phase === 'game-results') {
        return fail(state, 'wrong-phase', `Beenden nur während der Partie (Phase ${d.phase})`);
      }
      finishGame(ctx, true);
      break;
    case 'start':
      if (d.phase !== 'setup') {
        return fail(state, 'wrong-phase', `Start nur in setup möglich (Phase ${d.phase})`);
      }
      startGame(ctx, at);
      break;
    case 'connection':
      if (!d.players.some((p) => p.slot === command.slot)) {
        return fail(state, 'unknown-player', `Slot ${String(command.slot)} spielt nicht mit`);
      }
      setConnection(ctx, command.slot, command.connected, effectiveAt);
      break;
    case 'choose': {
      if (!d.players.some((p) => p.slot === command.slot)) {
        return fail(state, 'unknown-player', `Slot ${String(command.slot)} spielt nicht mit`);
      }
      if (d.paused) return fail(state, 'paused', 'Partie ist pausiert');
      const prompt = d.prompt;
      if (prompt?.id !== command.promptId) {
        // Schon vergebene (inzwischen aufgelöste) Prompt-ID = verspätete Wahl.
        if (command.promptId >= 1 && command.promptId <= d.internal.promptSeq) {
          return fail(state, 'stale-prompt', `Prompt ${String(command.promptId)} ist vorbei`);
        }
        if (!prompt) return fail(state, 'wrong-phase', `Keine offene Wahl (Phase ${d.phase})`);
        return fail(state, 'stale-prompt', `Prompt ${String(command.promptId)} ist unbekannt`);
      }
      if (prompt.slot !== command.slot) {
        return fail(state, 'not-your-turn', `Spieler ${String(prompt.slot)} wählt gerade`);
      }
      if (!isOfferedOption(ctx, command.option)) {
        return fail(state, 'invalid-option', `Option ${command.option} steht nicht zur Wahl`);
      }
      applyOption(ctx, command.option, at);
      break;
    }
    case 'minigame-ready': {
      if (!d.players.some((p) => p.slot === command.slot)) {
        return fail(state, 'unknown-player', `Slot ${String(command.slot)} spielt nicht mit`);
      }
      if (d.paused) return fail(state, 'paused', 'Partie ist pausiert');
      const check = checkMinigameReady(ctx);
      if (!check.ok) return fail(state, 'wrong-phase', check.message);
      markMinigameReady(ctx, command.slot);
      break;
    }
    case 'minigame-result': {
      const check = checkMinigameResult(ctx, command);
      if (!check.ok) {
        return fail(
          state,
          d.phase === 'minigame-play' ? 'invalid-result' : 'wrong-phase',
          check.message,
        );
      }
      finishMinigame(
        ctx,
        command.placements,
        command.highlights ?? [],
        effectiveAt,
        command.outcome,
      );
      break;
    }
  }

  // CHAOS-214: Bereit, Verbindungsverlust oder Pausenende kann die letzte Bereitschaft sein.
  releaseMinigameIntro(ctx, at);
  run();
  tallyStats(ctx);
  return { ok: true, state: closeDraft(ctx), events: ctx.events };
}
