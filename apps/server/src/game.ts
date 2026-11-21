/**
 * Brettspiel in der Session (M2, ADR-011): verbindet die reinen Regeln aus
 * `@chaos-party/game-core` mit dem Protokoll.
 *
 * Die Klasse hält den autoritativen `GameState`, wendet Befehle an, sammelt die
 * Ereignisse für den Host (fortlaufend nummeriert) und baut daraus die Nachrichten:
 * `board` an den Host und je Slot den `context` mit Prompt und eigenem Stand.
 * Kein Netzwerkcode, keine Uhr: Zeitpunkte kommen von der Session.
 */
import {
  createGame,
  DEFAULT_BOARD,
  DEFAULT_RULES,
  getBoard,
  playedMinigames,
  step,
  viewClock,
  type GameCommand,
  type GameError,
  type GameEvent,
  type GameState,
  type MinigameRotationOptions,
  type MinigameSpec,
  type Prompt,
  type RuleSet,
  type Slot,
} from '@chaos-party/game-core';
import type { MinigameInfo } from '@chaos-party/minigame-sdk';
import { getMinigameInfo, getSteckbrief, rotationInfos } from '@chaos-party/minigames/catalog';
import {
  MAX_BOARD_EVENTS,
  type BoardEvent,
  type CharacterId,
  type BoardMessage,
  type BoardView,
  type ControllerBoardInfo,
  type ControllerMinigameInfo,
  type ControllerMinigameTeam,
  type MinigameControlsInfo,
  type PromptInfo,
} from '@chaos-party/protocol';

/** Einstellungen des Brettspiels, die der Server vorgibt (Umgebung, Tests). */
export interface BoardGameSettings {
  /** Standard-Rundenzahl, wenn `start` keine nennt. */
  readonly rounds: number;
  /** Fester Seed (reproduzierbare Partien) oder `undefined` = zufällig je Partie. */
  readonly seed?: number | undefined;
  readonly rules: RuleSet;
  /**
   * Brett: in der Session die Lobby-Wahl zu Beginn (Brett-ID oder `RANDOM_BOARD`, CHAOS-197;
   * `configure` ändert sie), in `BoardGame` das aufgelöste Brett der Partie.
   */
  readonly boardId: string;
  /**
   * Minispiele der Partie (M3, ADR-012). Standard: die Rotation aus dem Katalog
   * (`@chaos-party/minigames/catalog`); leer = M2-Platzhalter ohne Host-Logik.
   */
  readonly minigames: readonly MinigameSpec[];
  /**
   * Filter, Gewichte und Gedächtnis der Minispiel-Auswahl (CHAOS-85). Die Session setzt sie je
   * Partie aus Lobby-Einstellungen, Aufstellung und letzter Partie; fehlt = keine.
   */
  readonly minigameRotation?: MinigameRotationOptions | undefined;
  /**
   * Vorschläge für die Rundenzahl in der Lobby (`lobby.settings.roundPresets`, aufsteigend).
   * `configure` erlaubt jede Zahl 1–`MAX_ROUNDS`.
   */
  readonly roundPresets: readonly number[];
  /**
   * Lobby-Einstellung „Mehr Zeit zum Reagieren“ zu Beginn (CHAOS-124); `configure` ändert sie.
   * Fehlt = aus.
   */
  readonly moreReactionTime?: boolean | undefined;
  /**
   * Übungsrunde der Minispiel-Galerie (CHAOS-87): `minigames` enthält genau das eine Spiel,
   * `rounds` ist 1. Nur in `BoardGame`, die Session setzt es beim Start mit `start.practice`.
   */
  readonly practice?: boolean | undefined;
}

/**
 * Reaktionsfenster mit „Mehr Zeit zum Reagieren“ (CHAOS-124, Barrierefreiheit). Standard sind
 * 3000 ms (EXP-004). Das langsamste Profil aus EXP-004 („abgelenkt“, Median 2,3 s, σ 0,45)
 * steht hier stellvertretend für langsamere Reaktionen (Kinder, ältere Mitspielende,
 * motorische Einschränkungen): bei 3000 ms gelingen 69 %, bei 5000 ms rechnerisch ≈ 96 %.
 * Zeit kostet das nur, wenn niemand reagiert: höchstens +2 s je Fenster (≈ 1 je Partie).
 */
export const MORE_REACTION_TIME_MS = 5000;

/**
 * Regeln einer Partie mit der Lobby-Einstellung „Mehr Zeit zum Reagieren“. Ohne sie bleiben
 * die Regeln unverändert; mit ihr wird das Fenster mindestens `MORE_REACTION_TIME_MS` lang
 * (ein längeres aus eigenen Regeln bleibt).
 */
export function rulesForGame(rules: RuleSet, moreReactionTime: boolean): RuleSet {
  if (!moreReactionTime) return rules;
  return {
    ...rules,
    pacing: {
      ...rules.pacing,
      reactionWindowMs: Math.max(rules.pacing.reactionWindowMs, MORE_REACTION_TIME_MS),
    },
  };
}

/**
 * Standard-Rundenzahl (EXP-011/012, CHAOS-40): ≈ 14–16 Minuten mit 3–4 Spielern, alle drei
 * Minispiele kommen drei- bis viermal dran, und in 63–81 % der Partien entscheiden die
 * Trophäen (bei 5 Runden nur 49–76 %, ein Drittel der Spieler ohne Trophäe).
 */
export const DEFAULT_ROUNDS = 10;
/**
 * Vorschläge kurz/mittel/lang (EXP-011, Bot-Simulation mit gemütlichem Entscheidungstempo,
 * Minispiel-Rotation und Finale; 3–4 Spieler): 10 ≈ 14–16 min, 16 ≈ 22–25 min,
 * 20 ≈ 27–31 min. 40 Minuten bräuchten 26–30 Runden, mehr als `MAX_ROUNDS` (20).
 */
export const DEFAULT_ROUND_PRESETS: readonly number[] = [10, 16, 20];

/**
 * Regel-Steckbrief eines Minispiels: Kennung, Zeit, Wertung und Achsen der Rotation (CHAOS-85).
 * Kernverb, Spielform und Bedienung kommen aus dem Vielfalts-Steckbrief (ADR-021), Familie und
 * Tauglichkeit aus `MinigameInfo`.
 */
export function minigameSpecOf(info: MinigameInfo): MinigameSpec {
  const steckbrief = getSteckbrief(info.id);
  const controls =
    steckbrief?.bedienung ??
    `${info.controls.joystick === null ? '' : 'S'}${info.controls.a === null ? '' : 'A'}${
      info.controls.b === null ? '' : 'B'
    }`;
  return {
    id: info.id,
    playMs: info.durationMs,
    scoring: info.scoring,
    category: info.category,
    controls,
    // CHAOS-89: Die Spielform im Steckbrief des Minispiels geht vor (Testspiele ohne Katalog-Eintrag).
    form: info.teamPlay?.form ?? steckbrief?.spielform.toLowerCase() ?? 'ffa',
    ...(info.teamPlay === undefined ? {} : { teamPlay: { ...info.teamPlay } }),
    ...(steckbrief === undefined ? {} : { verb: steckbrief.kernverb }),
    ...(info.family === undefined ? {} : { family: info.family }),
    ...(info.minPlayers === undefined ? {} : { minPlayers: info.minPlayers }),
    ...(info.maxPlayers === undefined ? {} : { maxPlayers: info.maxPlayers }),
    ...(info.ipadZone === undefined ? {} : { ipadZone: info.ipadZone }),
    ...(info.secretChoice === undefined ? {} : { secretChoice: info.secretChoice }),
  };
}

/** Spezifikationen der Katalog-Rotation für game-core. */
export function catalogMinigames(): MinigameSpec[] {
  return rotationInfos().map(minigameSpecOf);
}

/** Spezifikation eines Minispiels aus dem Katalog (Übungsrunde, CHAOS-87) oder `undefined`. */
export function catalogMinigame(id: string): MinigameSpec | undefined {
  const info = getMinigameInfo(id);
  return info ? minigameSpecOf(info) : undefined;
}

export const DEFAULT_GAME_SETTINGS: BoardGameSettings = {
  rounds: DEFAULT_ROUNDS,
  rules: DEFAULT_RULES,
  boardId: DEFAULT_BOARD.id,
  minigames: catalogMinigames(),
  roundPresets: DEFAULT_ROUND_PRESETS,
};

/** Welche Eingaben ein Minispiel am Controller anbietet. */
export type MinigameAction = 'move' | 'button-a' | 'button-b';

export interface BoardGamePlayer {
  readonly slot: Slot;
  readonly name: string;
  /** Gewählte bzw. beim Start zugewiesene Figur (nur Darstellung, ADR-015). */
  readonly character: CharacterId;
}

/** Entfernt `readonly` rekursiv (game-core-Typen sind unveränderlich, zod-Typen nicht). */
type DeepWritable<T> = T extends readonly (infer U)[]
  ? DeepWritable<U>[]
  : T extends object
    ? { -readonly [K in keyof T]: DeepWritable<T[K]> }
    : T;

/**
 * Kopie eines Regel-Ereignisses fürs Protokoll. Die Zuweisung prüft zur Übersetzungszeit,
 * dass `GameEvent` (game-core) und `BoardEventSchema` (protocol) zusammenpassen (ADR-011).
 */
function toWireEvent(event: GameEvent): BoardEvent {
  const copy: DeepWritable<GameEvent> = structuredClone(event) as DeepWritable<GameEvent>;
  return copy;
}

export class BoardGame {
  private stateValue: GameState;
  /** Ereignisse, die noch nicht an den Host gingen. */
  private pending: BoardEvent[] = [];
  /** Laufende Nummer des ersten Ereignisses in `pending`. */
  private pendingSeq = 0;
  /** Gesamtzahl erzeugter Ereignisse (nächste freie Nummer). */
  private eventCount = 0;
  /** Sichtbarer Stand der letzten `board`-Nachricht (ohne Restzeiten). */
  private lastViewKey = '';

  readonly seed: number;
  /** Figur je Slot (kosmetisch, nicht Teil der Regeln). */
  private readonly characters: ReadonlyMap<Slot, CharacterId>;

  constructor(players: readonly BoardGamePlayer[], settings: BoardGameSettings, seed: number) {
    const board = getBoard(settings.boardId);
    if (!board) throw new Error(`Unbekanntes Brett: ${settings.boardId}`);
    this.seed = seed;
    this.characters = new Map(players.map((player) => [player.slot, player.character]));
    this.stateValue = createGame({
      board,
      rules: settings.rules,
      rounds: settings.rounds,
      seed,
      players: players.map((player) => ({ slot: player.slot, name: player.name })),
      minigames: settings.minigames,
      ...(settings.practice === true ? { practice: true } : {}),
      ...(settings.minigameRotation === undefined
        ? {}
        : { minigameRotation: settings.minigameRotation }),
    });
  }

  /** Übungsrunde der Minispiel-Galerie (CHAOS-87). */
  get practice(): boolean {
    return this.stateValue.config.practice === true;
  }

  get state(): GameState {
    return this.stateValue;
  }

  /** Minispiele, die in dieser Partie schon liefen (für „nicht gleich wieder“, CHAOS-85). */
  get playedMinigames(): readonly string[] {
    return playedMinigames(this.stateValue);
  }

  /** Wendet einen Befehl an. Fehler lassen den Zustand unverändert. */
  apply(command: GameCommand): { ok: true } | { ok: false; error: GameError } {
    const result = step(this.stateValue, command);
    if (!result.ok) return { ok: false, error: result.error };
    this.stateValue = result.state;
    for (const event of result.events) {
      this.pending.push(toWireEvent(event));
      this.eventCount++;
    }
    return { ok: true };
  }

  hasSlot(slot: Slot): boolean {
    return this.stateValue.players.some((player) => player.slot === slot);
  }

  get paused(): boolean {
    return this.stateValue.paused;
  }

  /** Endstand erreicht (regulär oder per `end`); dann ist `rematch` möglich. */
  get finished(): boolean {
    return this.stateValue.phase === 'game-results';
  }

  /** Figur eines Slots dieser Partie. */
  characterOf(slot: Slot): CharacterId {
    const character = this.characters.get(slot);
    if (!character) throw new Error(`Slot ${String(slot)} hat keine Figur`);
    return character;
  }

  /**
   * Nächste `board`-Nachrichten für den Host: bei neuen Ereignissen (bei sehr vielen mehrere
   * Nachrichten, jede mit vollständigem `view`) oder wenn sich der sichtbare Stand ohne
   * Ereignis geändert hat (z. B. Prompt geöffnet). Bloß ablaufende Restzeit zählt nicht.
   */
  drainBoardMessages(now: number): Omit<BoardMessage, 'v' | 'type'>[] {
    const view = this.view(now);
    const key = viewKey(view);
    if (this.pending.length === 0 && key === this.lastViewKey) return [];
    this.lastViewKey = key;
    if (this.pending.length === 0) return [{ view, events: [], eventSeq: this.pendingSeq }];
    const messages: Omit<BoardMessage, 'v' | 'type'>[] = [];
    for (let index = 0; index < this.pending.length; index += MAX_BOARD_EVENTS) {
      messages.push({
        view,
        events: this.pending.slice(index, index + MAX_BOARD_EVENTS),
        eventSeq: this.pendingSeq + index,
      });
    }
    this.pending = [];
    this.pendingSeq = this.eventCount;
    return messages;
  }

  /** Schnappschuss ohne neue Ereignisse (z. B. für einen neu verbundenen Host). */
  snapshotMessage(now: number): Omit<BoardMessage, 'v' | 'type'> {
    return { view: this.view(now), events: [], eventSeq: this.pendingSeq };
  }

  view(time: number): BoardView {
    const state = this.stateValue;
    // In der Pause stehen alle Restzeiten auf dem Stand des Pausenbeginns.
    const now = viewClock(state, time);
    return {
      boardId: state.boardId,
      gamePhase: state.phase,
      round: state.round,
      rounds: state.rounds,
      turnOrder: [...state.turnOrder],
      activeSlot: state.activeSlot,
      players: state.players.map((player) => ({
        slot: player.slot,
        name: player.name,
        spaceId: player.spaceId,
        coins: player.coins,
        trophies: player.trophies,
        items: [...player.items],
        connected: player.connected,
        character: this.characterOf(player.slot),
        minigameWins: player.minigameWins,
        stats: { ...player.stats },
      })),
      trophySpaces: [...state.trophySpaces],
      trophyPrice: state.config.rules.trophy.price,
      traps: state.traps.map((trap) => ({ spaceId: trap.spaceId, owner: trap.owner })),
      prompt: state.prompt ? wirePrompt(state.prompt, now) : null,
      remainingMs: state.resumeAt === null ? null : remaining(state.resumeAt, now),
      stepMs: state.config.rules.pacing.stepMs,
      ranking: state.ranking ? state.ranking.map((entry) => ({ ...entry })) : null,
      minigame: state.minigame
        ? {
            id: state.minigame.id,
            round: state.minigame.round,
            seed: state.minigame.seed,
            playMs: state.minigame.playMs,
            repeat: state.minigame.repeat,
            ...(state.minigame.ready ? { ready: [...state.minigame.ready] } : {}),
            ...(state.minigame.teams
              ? {
                  teams: {
                    ...state.minigame.teams,
                    teams: state.minigame.teams.teams.map((team) => [...team]),
                  },
                }
              : {}),
            ...(state.minigame.outcome ? { outcome: { ...state.minigame.outcome } } : {}),
            elapsedMs:
              state.minigame.playStartedAt === null
                ? null
                : Math.max(0, Math.floor(now - state.minigame.playStartedAt)),
            placements: state.minigame.placements
              ? state.minigame.placements.map((entry) => ({ ...entry }))
              : null,
            highlights: [...state.minigame.highlights],
            aborted: state.minigame.aborted,
            rewards: state.minigame.rewards
              ? state.minigame.rewards.map((reward) => ({
                  slot: reward.slot,
                  coins: reward.coins,
                  ...(reward.items ? { items: [...reward.items] } : {}),
                }))
              : null,
            ...(state.minigame.tailwind && state.minigame.tailwind.length > 0
              ? { tailwind: state.minigame.tailwind.map((bonus) => ({ ...bonus })) }
              : {}),
          }
        : null,
      paused: state.paused,
      endedEarly: state.endedEarly,
      ...(this.practice ? { practice: true } : {}),
    };
  }

  /**
   * Minispiel aus Sicht eines Controllers (Anleitung, Bedienung, eigenes Ergebnis) oder
   * `undefined` außerhalb der Minispiel-Phasen und beim Platzhalter (kein Steckbrief).
   */
  minigameFor(slot: Slot): ControllerMinigameInfo | undefined {
    const state = this.stateValue;
    const minigame = state.minigame;
    if (!minigame) return undefined;
    const stage =
      state.phase === 'minigame-intro'
        ? 'intro'
        : state.phase === 'minigame-play'
          ? 'play'
          : state.phase === 'minigame-results'
            ? 'results'
            : null;
    const info = getMinigameInfo(minigame.id);
    if (!stage || !info) return undefined;
    const own = minigame.placements?.find((entry) => entry.slot === slot);
    const tied =
      own !== undefined &&
      (minigame.placements ?? []).some((entry) => entry.slot !== slot && entry.place === own.place);
    const ownReward = minigame.rewards?.find((entry) => entry.slot === slot);
    const reward = ownReward?.coins;
    const prizes = ownReward?.items;
    return {
      id: info.id,
      title: info.title,
      tagline: info.tagline,
      instructions: [...info.instructions],
      controls: controlsOf(info.controls),
      stage,
      scoreUnit: info.scoreUnit,
      tied,
      aborted: minigame.aborted,
      ...(own ? { place: own.place, score: own.score } : {}),
      ...(reward === undefined ? {} : { reward }),
      ...(prizes && prizes.length > 0 ? { prizes: [...prizes] } : {}),
      // CHAOS-66: lief schon in dieser Partie → kurzes Intro (nur Titel und Bedienlegende).
      repeat: minigame.repeat,
      ...(this.practice ? { practice: true } : {}),
      // CHAOS-214: Anleitung wartet auf „Bereit“ – eigener Stand.
      ...(stage === 'intro' && minigame.ready ? { ready: minigame.ready.includes(slot) } : {}),
      // CHAOS-89: eigene Rolle bei Teams bzw. Koop (im Ergebnis mit Ausgang).
      ...(minigame.teams ? { team: controllerTeamOf(minigame, slot, stage) } : {}),
    };
  }

  /**
   * Wartet die Anleitung noch auf „Bereit“ dieses Slots (CHAOS-214)? Nicht in der Pause; dann
   * bietet der Controller den Knopf nicht an.
   */
  awaitsReady(slot: Slot): boolean {
    const state = this.stateValue;
    const ready = state.minigame?.ready;
    return (
      state.phase === 'minigame-intro' &&
      !state.paused &&
      ready !== undefined &&
      !ready.includes(slot)
    );
  }

  /** Eingaben, die gerade (Minispiel läuft) angeboten werden; sonst leer. */
  minigameActions(): MinigameAction[] {
    const state = this.stateValue;
    // Pause (ADR-015): keine Eingaben, der Server leitet nichts an den Host weiter.
    if (state.phase !== 'minigame-play' || !state.minigame || state.paused) return [];
    const info = getMinigameInfo(state.minigame.id);
    if (!info) return [];
    const actions: MinigameAction[] = [];
    if (info.controls.joystick !== null) actions.push('move');
    if (info.controls.a !== null) actions.push('button-a');
    if (info.controls.b !== null) actions.push('button-b');
    return actions;
  }

  /** Prompt dieses Slots (oder `undefined`) für den Controller-Kontext. */
  promptFor(slot: Slot, now: number): PromptInfo | undefined {
    const prompt = this.stateValue.prompt;
    if (prompt?.slot !== slot) return undefined;
    return wirePrompt(prompt, viewClock(this.stateValue, now));
  }

  /** Eigener Stand für die Controller-Kopfzeile. */
  infoFor(slot: Slot): ControllerBoardInfo | undefined {
    const state = this.stateValue;
    const player = state.players.find((candidate) => candidate.slot === slot);
    if (!player) return undefined;
    const entry = state.ranking?.find((candidate) => candidate.slot === slot);
    // CHAOS-125: eigene Rückenwind-Münzen, solange das Rundenende sie ansagt.
    const tailwind =
      state.phase === 'round-end'
        ? state.minigame?.tailwind?.find((bonus) => bonus.slot === slot)?.coins
        : undefined;
    return {
      gamePhase: state.phase,
      round: state.round,
      rounds: state.rounds,
      coins: player.coins,
      trophies: player.trophies,
      items: [...player.items],
      activeSlot: state.activeSlot,
      paused: state.paused,
      character: this.characterOf(slot),
      minigameWins: player.minigameWins,
      ...(tailwind === undefined ? {} : { tailwind }),
      ...(entry === undefined
        ? {}
        : {
            place: entry.place,
            tied: entry.decidedBy === 'shared',
            endedEarly: state.endedEarly,
          }),
    };
  }
}

/** Vergleichsschlüssel eines `view` ohne Restzeiten. */
function viewKey(view: BoardView): string {
  return JSON.stringify({
    ...view,
    remainingMs: null,
    prompt: view.prompt ? { ...view.prompt, remainingMs: null } : null,
    minigame: view.minigame ? { ...view.minigame, elapsedMs: null } : null,
  });
}

function controlsOf(controls: {
  readonly joystick: string | null;
  readonly a: string | null;
  readonly b: string | null;
}): MinigameControlsInfo {
  return { joystick: controls.joystick, a: controls.a, b: controls.b };
}

function remaining(deadline: number, now: number): number {
  return Math.max(0, Math.round(deadline - now));
}

function wirePrompt(prompt: Prompt, now: number): PromptInfo {
  return {
    id: prompt.id,
    slot: prompt.slot,
    kind: prompt.kind,
    title: prompt.title,
    options: prompt.options.map((option) => ({
      id: option.id,
      label: option.label,
      ...(option.detail === undefined ? {} : { detail: option.detail }),
      ...(option.slot === undefined ? {} : { slot: option.slot }),
    })),
    remainingMs: prompt.deadline === null ? null : remaining(prompt.deadline, now),
  };
}

/**
 * Eigene Rolle eines Slots in einem Minispiel mit Teams bzw. Koop (CHAOS-89). Im Ergebnis
 * zusätzlich der Ausgang aus eigener Sicht (`result` bzw. Koop-Stufe `tier`).
 */
export function controllerTeamOf(
  minigame: NonNullable<GameState['minigame']>,
  slot: Slot,
  stage: ControllerMinigameInfo['stage'],
): ControllerMinigameTeam {
  const teams = minigame.teams;
  if (!teams) throw new Error('Minispiel ohne Teams');
  const index = teams.teams.findIndex((team) => team.includes(slot));
  const own = teams.teams[index] ?? [];
  const mates = own.filter((other) => other !== slot);
  const opponents = teams.teams.filter((_, i) => i !== index).flat();
  const koop = teams.layout === 'koop';
  const solo = !koop && own.length === 1;
  const outcome = stage === 'results' ? minigame.outcome : undefined;
  return {
    layout: teams.layout,
    role: koop ? 'koop' : solo ? 'solo' : 'team',
    index: index === 1 ? 1 : 0,
    mates: [...mates],
    opponents: [...opponents],
    advantage: solo && teams.soloAdvantage,
    ...(outcome?.kind === 'teams'
      ? { result: outcome.winner === null ? 'draw' : outcome.winner === index ? 'won' : 'lost' }
      : {}),
    ...(outcome?.kind === 'koop' ? { tier: outcome.tier } : {}),
  };
}
