/**
 * Testhelfer für Session-Integrationstests (CHAOS-23/34, M4 ADR-015): Session mit künstlicher
 * Uhr, synthetische Controller-Bots (antworten nur auf angebotene Prompts) und ein
 * synthetischer Host (zeichnet `board`/`lobby`/`input`/Bestätigungen auf, meldet Minispiel-
 * Ergebnisse). Nur für Tests; kein Teil des Server-Builds (`main.ts` importiert es nicht).
 */
import { createRng } from '@chaos-party/game-core';
import { KOOP_MAX_TIER, rankByScore, teamPlacements } from '@chaos-party/minigame-sdk';
import { getMinigameInfo } from '@chaos-party/minigames/catalog';
import {
  createMessage,
  parseServerMessage,
  type BoardEvent,
  type BoardMessage,
  type CharacterId,
  type ClientMessage,
  type ContextMessage,
  type InputMessage,
  type LobbyMessage,
  type MinigameResultAckMessage,
  type MinigameResultMessage,
  type MinigameTeamsInfo,
  type RatingsMessage,
  type ServerMessage,
  type SlotNumber,
} from '@chaos-party/protocol';
import { minigameSpecOf } from './game.ts';
import { Session, type ConnectionId, type Outgoing, type SessionOptions } from './session.ts';

export const CODE = 'ABCD';
/** Verbindungs-ID des synthetischen Hosts. */
export const HOST = 100;
/** Server-Takt wie im echten Server (ADR-011). */
export const TICK_MS = 100;
/** Bedenkzeit der Bots, bevor sie antworten (virtuelle ms). */
const THINK_MS = 300;
const HEARTBEAT_MS = 5_000;

/** Seeds der Integrationstests (dokumentiert in docs/progress.md). */
export const INTEGRATION_SEEDS = { two: 20261115, three: 7, four: 424242 } as const;

export type ReactionPolicy = 'brace' | 'shield' | 'timeout' | 'late';

export interface BotPolicy {
  /** Setzt Items ein, sobald angeboten (für Sabotage-Abdeckung). */
  readonly useItems: boolean;
  readonly reaction: ReactionPolicy;
  /** CHAOS-214: In der Minispiel-Anleitung „Bereit“ drücken (Standard ja). */
  readonly minigameReady?: boolean;
}

export interface Controller {
  readonly id: ConnectionId;
  readonly slots: SlotNumber[];
  token: string | null;
  seq: number;
  connected: boolean;
}

/**
 * Session + synthetische Controller und Host mit künstlicher Uhr (100-ms-Takt). Jede
 * ausgehende Nachricht wird mit dem echten Protokoll-Parser geprüft (sonst Ausnahme).
 */
export class Harness {
  clock = 1_000;
  readonly session: Session;
  readonly controllers = new Map<ConnectionId, Controller>();
  /** Letzter Kontext je Slot. */
  readonly contexts = new Map<SlotNumber, { context: ContextMessage; at: number }>();
  /** Alle `board`-Nachrichten an den Host, in Reihenfolge. */
  readonly boards: BoardMessage[] = [];
  /** Fehler je Verbindung. */
  readonly errors: { to: ConnectionId; code: string }[] = [];
  /** Alle `lobby`-Nachrichten an den Host (v4: Figuren, Einstellungen). */
  readonly lobbies: LobbyMessage[] = [];
  /** Bestätigungen auf `minigame-result` (v4, CHAOS-55). */
  readonly acks: MinigameResultAckMessage[] = [];
  /** Daumen-Übersichten an den Host (CHAOS-87). */
  readonly ratings: RatingsMessage[] = [];
  /** Vom Server an den Host weitergeleitete Controller-Eingaben (Minispiele, M3). */
  readonly hostInputs: InputMessage[] = [];
  /** Vom Server geschlossene Verbindungen (Close-Code, Grund). */
  readonly closes: { to: ConnectionId; code: number; reason: string }[] = [];
  /**
   * Sendet der synthetische Host Herzschläge? `false` simuliert einen eingefrorenen PC-Tab
   * (nach `hostSilenceMs` trennt ihn der Server, CHAOS-38).
   */
  hostHeartbeats = true;
  /** Prompts, auf die ein Bot schon geantwortet hat (Slot:PromptId). */
  private readonly answered = new Set<string>();
  /** Reaktionen, die absichtlich erst nach der Frist gesendet werden (Politik `late`). */
  private readonly lateReactions: { slot: SlotNumber; promptId: number; sendAt: number }[] = [];
  private readonly rng;

  constructor(
    options: Partial<SessionOptions>,
    private readonly policy: BotPolicy = { useItems: false, reaction: 'brace' },
    botSeed = 1,
  ) {
    let tokens = 0;
    this.rng = createRng(botSeed);
    this.session = new Session({
      joinCode: CODE,
      now: () => this.clock,
      createToken: () => `token-${String(++tokens).padStart(16, '0')}`,
      logError: (error) => {
        throw error;
      },
      ...options,
    });
  }

  private handle(out: Outgoing[]): void {
    for (const action of out) {
      if (action.kind === 'close') {
        this.closes.push({ to: action.to, code: action.code, reason: action.reason });
        const controller = this.controllers.get(action.to);
        if (controller) controller.connected = false;
        continue;
      }
      const parsed = parseServerMessage(JSON.stringify(action.message));
      if (!parsed.ok) {
        throw new Error(
          `Ungültige Server-Nachricht (${parsed.error.message}): ${JSON.stringify(action.message)}`,
        );
      }
      this.receive(action.to, action.message);
    }
  }

  private receive(to: ConnectionId, message: ServerMessage): void {
    switch (message.type) {
      case 'board':
        if (to === HOST) this.boards.push(message);
        return;
      case 'input':
        if (to === HOST) this.hostInputs.push(message);
        return;
      case 'lobby':
        if (to === HOST) this.lobbies.push(message);
        return;
      case 'minigame-result-ack':
        if (to === HOST) this.acks.push(message);
        return;
      case 'ratings':
        if (to === HOST) this.ratings.push(message);
        return;
      case 'context':
        this.contexts.set(message.slot, { context: message, at: this.clock });
        return;
      case 'welcome': {
        const controller = this.controllers.get(to);
        if (controller) controller.token = message.sessionToken;
        return;
      }
      case 'error':
        this.errors.push({ to, code: message.code });
        return;
      default:
        return;
    }
  }

  send(id: ConnectionId, message: ClientMessage): void {
    this.sendRaw(id, JSON.stringify(message));
  }

  /** Beliebiger Rohtext (auch kaputt oder übergroß) über eine Verbindung. */
  sendRaw(id: ConnectionId, raw: string): void {
    this.handle(this.session.message(id, raw));
  }

  /** Neue Verbindung ohne Handshake (z. B. für einen späten `join`). */
  connect(id: ConnectionId): void {
    this.handle(this.session.connect(id));
  }

  /**
   * Host meldet sich an. Standard: Szene sofort geladen (`host-ready` direkt nach `host-hello`);
   * mit `{ ready: false }` lädt er noch, bis der Test `hostReady()` aufruft (CHAOS-68).
   */
  host(options: { ready?: boolean } = {}): void {
    this.handle(this.session.connect(HOST));
    this.send(HOST, createMessage('host-hello', {}));
    if (options.ready ?? true) this.hostReady();
  }

  /** Host hat Szene und Figuren geladen (CHAOS-68). */
  hostReady(): void {
    this.send(HOST, createMessage('host-ready', {}));
  }

  /** Seiten-Reload am PC: Host-Verbindung weg, neuer Host meldet sich. */
  reloadHost(options: { ready?: boolean } = {}): void {
    this.dropHost();
    this.host(options);
  }

  /** Host-Verbindung bricht ab (Tab zu, Netz weg); kein neuer Host. */
  dropHost(): void {
    this.handle(this.session.disconnect(HOST));
  }

  join(id: ConnectionId, seats = 1): void {
    this.handle(this.session.connect(id));
    const slotsBefore = new Set(this.session.snapshot().players.map((p) => p.slot));
    this.controllers.set(id, { id, slots: [], token: null, seq: 0, connected: true });
    this.send(id, createMessage('join', { joinCode: CODE, seats }));
    const slots = this.session
      .snapshot()
      .players.map((p) => p.slot)
      .filter((slot) => !slotsBefore.has(slot));
    const controller = this.controllers.get(id);
    if (controller) controller.slots.push(...slots);
  }

  ready(id: ConnectionId): void {
    const controller = this.controller(id);
    for (const slot of controller.slots) {
      this.send(id, createMessage('ready', { slot, seq: ++controller.seq }));
    }
  }

  start(rounds?: number): void {
    // Neue Partie (auch nach `rematch`): Prompt-IDs beginnen wieder bei 1.
    this.answered.clear();
    this.lateReactions.length = 0;
    this.send(
      HOST,
      createMessage('start', rounds === undefined ? { mode: 'board' } : { mode: 'board', rounds }),
    );
  }

  /** Übungsrunde der Minispiel-Galerie (CHAOS-87) mit diesem Minispiel starten. */
  startPractice(minigameId: string): void {
    this.answered.clear();
    this.send(HOST, createMessage('start', { practice: minigameId }));
  }

  /** Daumen (CHAOS-87) für das Minispiel im letzten Kontext dieses Slots. */
  rate(
    slot: SlotNumber,
    vote: 'up' | 'down',
    override: { minigameId?: string; round?: number } = {},
  ): void {
    const controller = this.controllerOf(slot);
    const minigame = this.boards.at(-1)?.view.minigame;
    this.send(
      controller.id,
      createMessage('rate', {
        slot,
        seq: ++controller.seq,
        minigameId: override.minigameId ?? minigame?.id ?? 'unbekannt',
        round: override.round ?? minigame?.round ?? 0,
        vote,
      }),
    );
  }

  /** Figur wählen (v4) für einen Slot dieser Verbindung. */
  pickCharacter(id: ConnectionId, slot: SlotNumber, character: CharacterId): void {
    const controller = this.controller(id);
    this.send(id, createMessage('pick-character', { slot, seq: ++controller.seq, character }));
  }

  /** Host-Befehle (v4). */
  configure(rounds: number): void {
    this.send(HOST, createMessage('configure', { rounds }));
  }

  /** Lobby-Schalter „Mehr Zeit zum Reagieren“ (CHAOS-124). */
  configureReactionTime(moreReactionTime: boolean): void {
    this.send(HOST, createMessage('configure', { moreReactionTime }));
  }

  /** Brett-Wahl der Lobby (CHAOS-197): Brett-ID oder `zufall`. */
  configureBoard(board: string): void {
    this.send(HOST, createMessage('configure', { board }));
  }

  pause(): void {
    this.send(HOST, createMessage('pause', {}));
  }

  resume(): void {
    this.send(HOST, createMessage('resume', {}));
  }

  endGame(): void {
    this.send(HOST, createMessage('end-game', {}));
  }

  rematch(): void {
    this.send(HOST, createMessage('rematch', {}));
  }

  /** Letzte `lobby`-Nachricht an den Host. */
  get lobby(): LobbyMessage | undefined {
    return this.lobbies.at(-1);
  }

  disconnect(id: ConnectionId): void {
    this.controller(id).connected = false;
    this.handle(this.session.disconnect(id));
  }

  /** Neue Verbindung mit gespeichertem Token (wie der echte Controller nach Netzverlust). */
  reconnect(oldId: ConnectionId, newId: ConnectionId): void {
    const old = this.controller(oldId);
    if (!old.token) throw new Error('kein Token');
    this.controllers.delete(oldId);
    this.controllers.set(newId, {
      id: newId,
      slots: old.slots,
      token: old.token,
      seq: 0,
      connected: true,
    });
    this.handle(this.session.connect(newId));
    this.send(newId, createMessage('reconnect', { sessionToken: old.token }));
  }

  choose(id: ConnectionId, slot: SlotNumber, promptId: number, option: string): void {
    const controller = this.controller(id);
    this.send(id, createMessage('choose', { slot, seq: ++controller.seq, promptId, option }));
  }

  controller(id: ConnectionId): Controller {
    const controller = this.controllers.get(id);
    if (!controller) throw new Error(`Controller ${String(id)} fehlt`);
    return controller;
  }

  controllerOf(slot: SlotNumber): Controller {
    for (const controller of this.controllers.values()) {
      if (controller.slots.includes(slot)) return controller;
    }
    throw new Error(`kein Controller für Slot ${String(slot)}`);
  }

  tick(): void {
    const before = this.clock;
    this.clock += TICK_MS;
    // Herzschlag alle 5 s wie die echten Clients (sonst trennt der Server nach 15 s/30 s); auch
    // wenn ein Test die Uhr zwischen zwei Takten verstellt hat.
    if (Math.floor(before / HEARTBEAT_MS) !== Math.floor(this.clock / HEARTBEAT_MS)) {
      for (const controller of this.controllers.values()) {
        if (controller.connected) {
          this.send(controller.id, createMessage('heartbeat', { t: this.clock }));
        }
      }
      if (this.hostConnected && this.hostHeartbeats) {
        this.send(HOST, createMessage('heartbeat', { t: this.clock }));
      }
    }
    this.handle(this.session.tick());
  }

  get hostConnected(): boolean {
    return this.session.snapshot().hostConnected;
  }

  get events(): BoardEvent[] {
    return this.boards.flatMap((board) => board.events);
  }

  get gamePhase(): string | undefined {
    return this.boards.at(-1)?.view.gamePhase;
  }

  /** Offener Prompt einer Art bei einem verbundenen Controller (Slot + Prompt) oder `null`. */
  openPrompt(
    kind?: NonNullable<ContextMessage['prompt']>['kind'],
  ): { slot: SlotNumber; prompt: NonNullable<ContextMessage['prompt']> } | null {
    for (const [slot, { context }] of this.contexts) {
      const prompt = context.prompt;
      if (!prompt || !context.actions.includes('choose')) continue;
      if (kind !== undefined && prompt.kind !== kind) continue;
      if (!this.controllerOf(slot).connected) continue;
      return { slot, prompt };
    }
    return null;
  }

  /** „Bereit“ in der Minispiel-Anleitung für einen Slot (CHAOS-214). */
  minigameReady(slot: SlotNumber): void {
    const controller = this.controllerOf(slot);
    this.send(controller.id, createMessage('ready', { slot, seq: ++controller.seq }));
  }

  /** Bots beantworten offene Prompts nach ihrer Bedenkzeit. */
  answerPrompts(): void {
    if (this.policy.minigameReady !== false) {
      for (const [slot, { context, at }] of this.contexts) {
        if (context.phase !== 'board' || !context.actions.includes('ready')) continue;
        if (!this.controllerOf(slot).connected || this.clock - at < THINK_MS) continue;
        // Kontext sofort als erledigt merken; der Server schickt den neuen ohne `ready`.
        this.contexts.set(slot, { context: { ...context, actions: [] }, at });
        this.minigameReady(slot);
      }
    }
    for (const late of this.lateReactions.filter((entry) => this.clock >= entry.sendAt)) {
      this.lateReactions.splice(this.lateReactions.indexOf(late), 1);
      this.choose(this.controllerOf(late.slot).id, late.slot, late.promptId, 'brace');
    }
    for (const [slot, { context, at }] of this.contexts) {
      const prompt = context.prompt;
      if (!prompt || !context.actions.includes('choose')) continue;
      const controller = this.controllerOf(slot);
      if (!controller.connected) continue;
      const key = `${String(slot)}:${String(prompt.id)}`;
      if (this.answered.has(key)) continue;
      if (prompt.kind === 'reaction') {
        if (this.policy.reaction === 'timeout') continue;
        if (this.policy.reaction === 'late') {
          // Antwort erst nach Ablauf der Frist: Der Server muss sie abweisen.
          this.answered.add(key);
          this.lateReactions.push({
            slot,
            promptId: prompt.id,
            sendAt: at + (prompt.remainingMs ?? 0) + TICK_MS,
          });
          continue;
        }
        if (this.clock - at < THINK_MS) continue;
      } else if (this.clock - at < THINK_MS) continue;
      this.answered.add(key);
      this.choose(controller.id, slot, prompt.id, this.pick(prompt));
    }
  }

  private pick(prompt: NonNullable<ContextMessage['prompt']>): string {
    const ids = prompt.options.map((option) => option.id);
    switch (prompt.kind) {
      case 'roll': {
        const item = ids.find((id) => id.startsWith('item:'));
        return this.policy.useItems && item !== undefined ? item : 'roll';
      }
      case 'target':
        return ids.find((id) => id.startsWith('slot:')) ?? 'cancel';
      case 'trophy':
        return 'buy';
      case 'reaction':
        if (this.policy.reaction === 'shield' && ids.includes('shield')) return 'shield';
        return 'brace';
      case 'path':
      default:
        return ids[this.rng.int(0, ids.length - 1)] ?? ids[0] ?? 'roll';
    }
  }

  /** Bots spielen (Prompts beantworten, Zeit läuft), bis `done` gilt; wirft nach `maxTicks`. */
  runUntil(done: (h: Harness) => boolean, maxTicks = 200_000, onTick?: (h: Harness) => void): void {
    for (let i = 0; i < maxTicks; i++) {
      if (done(this)) return;
      this.answerPrompts();
      onTick?.(this);
      this.tick();
    }
    if (!done(this)) throw new Error(`Bedingung nach ${String(maxTicks)} Takten nicht erreicht`);
  }

  /** Spielt, bis das Ergebnis feststeht (oder die Grenze erreicht ist). */
  runToEnd(maxTicks = 200_000, onTick?: (h: Harness) => void): void {
    for (let i = 0; i < maxTicks && this.gamePhase !== 'game-results'; i++) {
      this.answerPrompts();
      onTick?.(this);
      this.tick();
    }
  }
}

/** Partie mit Platzhalter-Minispiel (M2-Ablauf): Host, n Controller, alle bereit, Start. */
export function setupGame(
  players: number,
  seed: number,
  options: { rounds?: number; policy?: Partial<BotPolicy>; seats?: number[] } = {},
): Harness {
  const h = new Harness(
    // M2-Ablauf mit Minispiel-Platzhalter; echte Minispiele: unten „Minispiele über die Session“.
    { game: { seed, rounds: options.rounds ?? 3, minigames: [] } },
    { useItems: true, reaction: 'brace', ...options.policy },
    seed,
  );
  h.host();
  const seats = options.seats ?? Array.from({ length: players }, () => 1);
  seats.forEach((count, index) => {
    h.join(index + 1, count);
  });
  for (const id of h.controllers.keys()) h.ready(id);
  h.start();
  return h;
}

/**
 * Wirft, wenn die Ereignisnummern der `board`-Nachrichten Lücken oder Doppelte haben. Eine neue
 * Partie (nach `rematch`) beginnt wieder bei 0 mit `game-started`.
 */
export function assertContiguousEvents(h: Harness): void {
  let expected = 0;
  for (const board of h.boards) {
    if (board.events.length === 0) continue;
    if (board.eventSeq === 0 && board.events[0]?.type === 'game-started') expected = 0;
    if (board.eventSeq !== expected) {
      throw new Error(`eventSeq ${String(board.eventSeq)}, erwartet ${String(expected)}`);
    }
    expected += board.events.length;
  }
}

export function turnsPerSlot(events: BoardEvent[]): Map<number, number> {
  const turns = new Map<number, number>();
  for (const event of events) {
    if (event.type === 'turn-started') turns.set(event.slot, (turns.get(event.slot) ?? 0) + 1);
  }
  return turns;
}

/**
 * Synthetischer Host für Minispiele: zählt die weitergeleiteten Eingaben je Slot während
 * `minigame-play` und meldet nach der Spielzeit ein Ergebnis (mehr Eingaben = mehr Punkte),
 * wie es der echte Host über die Minispiel-Laufzeit tut.
 */
export function playMinigameAsHost(
  h: Harness,
  host: { readonly sent: Set<number>; readonly startedAt: Map<number, number> },
): void {
  const view = h.boards.at(-1)?.view;
  const minigame = view?.minigame;
  if (view?.gamePhase !== 'minigame-play' || !minigame || host.sent.has(minigame.round)) return;
  const startedAt = host.startedAt.get(minigame.round) ?? h.clock;
  host.startedAt.set(minigame.round, startedAt);
  if (h.clock - startedAt < minigame.playMs) return;
  const info = getMinigameInfo(minigame.id);
  if (!info) throw new Error(`Unbekanntes Minispiel ${minigame.id}`);
  const counts = new Map<SlotNumber, number>();
  for (const input of h.hostInputs) {
    counts.set(input.intent.slot, (counts.get(input.intent.slot) ?? 0) + 1);
  }
  const scores = view.players.map((player) => ({
    slot: player.slot,
    score:
      info.scoring === 'higher' ? (counts.get(player.slot) ?? 0) : -(counts.get(player.slot) ?? 0),
  }));
  host.sent.add(minigame.round);
  h.send(
    HOST,
    createMessage('minigame-result', {
      minigameId: minigame.id,
      round: minigame.round,
      ...teamResult(minigame.teams, scores, info.scoring),
      highlights: ['Testlauf'],
    }),
  );
}

/**
 * Plätze und Ausgang wie die Laufzeit (CHAOS-89): ohne Teams nach Punkten; bei Teams gewinnt
 * das Team mit mehr Punkten im Schnitt (gleich = Unentschieden); bei Koop ist die Stufe die Zahl
 * der Personen mit Punkten (höchstens 3).
 */
function teamResult(
  teams: MinigameTeamsInfo | undefined,
  scores: { slot: SlotNumber; score: number }[],
  scoring: 'higher' | 'lower',
): Pick<MinigameResultMessage, 'placements' | 'outcome'> {
  if (!teams) return { placements: rankByScore(scores, scoring) };
  if (teams.layout === 'koop') {
    const tier = Math.min(KOOP_MAX_TIER, scores.filter((entry) => entry.score !== 0).length);
    return { placements: rankByScore(scores, scoring), outcome: { kind: 'koop', tier } };
  }
  const mean = (team: readonly SlotNumber[]) =>
    team.reduce((sum, slot) => sum + (scores.find((e) => e.slot === slot)?.score ?? 0), 0) /
    team.length;
  const [a = 0, b = 0] = teams.teams.map(mean);
  const sign = scoring === 'higher' ? 1 : -1;
  const winner = a === b ? null : sign * (a - b) > 0 ? 0 : 1;
  return {
    placements: teamPlacements(teams, winner, scores, scoring),
    outcome: { kind: 'teams', winner },
  };
}

/** Controller-Bots im Minispiel: jeder Slot drückt so oft, wie seine Slot-Nummer vorgibt. */
export function pressInMinigame(h: Harness, pressed: Map<SlotNumber, number>): void {
  for (const [slot, { context }] of h.contexts) {
    if (context.layout !== 'joystick-buttons' || context.minigame?.stage !== 'play') continue;
    const controller = h.controllerOf(slot);
    if (!controller.connected) continue;
    const done = pressed.get(slot) ?? 0;
    if (done >= slot * 2) continue;
    pressed.set(slot, done + 1);
    if (context.actions.includes('button-a')) {
      h.send(controller.id, createMessage('press', { slot, seq: ++controller.seq, button: 'a' }));
      h.send(controller.id, createMessage('release', { slot, seq: ++controller.seq, button: 'a' }));
    } else if (context.actions.includes('move')) {
      h.send(controller.id, createMessage('move', { slot, seq: ++controller.seq, x: 1, y: 0 }));
      h.send(controller.id, createMessage('move', { slot, seq: ++controller.seq, x: 0, y: 0 }));
    }
  }
}

export function setupMinigameGame(
  minigameId: string,
  players: number,
  seed: number,
  rounds = 2,
  policy: Partial<BotPolicy> = {},
): Harness {
  const info = getMinigameInfo(minigameId);
  if (!info) throw new Error(`Unbekanntes Minispiel ${minigameId}`);
  const h = new Harness(
    {
      game: {
        seed,
        rounds,
        minigames: [minigameSpecOf(info)],
      },
    },
    { useItems: false, reaction: 'brace', ...policy },
    seed,
  );
  h.host();
  for (let id = 1; id <= players; id++) h.join(id);
  for (const id of h.controllers.keys()) h.ready(id);
  h.start();
  return h;
}
