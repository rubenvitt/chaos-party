/**
 * Zod-Schemas aller Nachrichten zwischen Controller, Server und Host.
 *
 * Grundsätze (Begründung in `docs/decisions/ADR-003-protokoll.md`):
 * - JSON über einen WebSocket-Endpunkt; jede Nachricht ist ein flaches Objekt
 *   mit `v` (Protokollversion) und `type` (Diskriminator).
 * - Alle Objekte sind **strikt**: unbekannte Felder führen zur Ablehnung, damit
 *   manipulierte Nachrichten nicht still durchrutschen.
 * - Eingaben vom Controller tragen `slot` und eine pro Verbindung streng
 *   steigende Sequenznummer `seq` (Annahme B8). Client-Zeitstempel werden nur
 *   als Echo zurückgegeben, nie für Spiellogik verwendet.
 */
import { z } from 'zod';
import { CHARACTER_IDS } from './characters.ts';
import { MAX_PLAYERS } from './players.ts';
import { PROTOCOL_VERSION } from './version.ts';

// ---------------------------------------------------------------------------
// Grenzen
// ---------------------------------------------------------------------------

/** Größte zulässige Nachricht als JSON-Text (Zeichen). Größere werden ungelesen verworfen. */
export const MAX_MESSAGE_LENGTH = 4096;
/** Größte zulässige Server-Nachricht (Brett-Schnappschuss mit Ereignissen) als JSON-Text. */
export const MAX_SERVER_MESSAGE_LENGTH = 65_536;
/** Toleranz für die Joystick-Länge (Rundung auf dem Gerät). */
export const STICK_EPSILON = 0.001;
export const MAX_NAME_LENGTH = 16;
export const MAX_LABEL_LENGTH = 24;
export const MAX_ERROR_MESSAGE_LENGTH = 200;
export const MAX_JOIN_URL_LENGTH = 512;
/** Höchstzahl alternativer Join-Links in `lobby` (weitere LAN-Adressen des PCs, CHAOS-11). */
export const MAX_JOIN_URL_ALTERNATIVES = 8;

// ---------------------------------------------------------------------------
// Aufzählungen
// ---------------------------------------------------------------------------

/**
 * Sitzungsphasen. `play` = M1-Arena (Schubsen mit Joystick, bleibt als Testbett für
 * Eingabelatenz erhalten), `board` = M2-Brettspiel mit allen Unterphasen (`GAME_PHASES`).
 */
export const PHASES = ['lobby', 'play', 'board'] as const;
/** Spielmodus beim Start: Brettspiel (Standard) oder M1-Arena. */
export const GAME_MODES = ['board', 'arena'] as const;
/** Unterphasen des Brettspiels (Spiegel von `GamePhase` in `@chaos-party/game-core`). */
export const GAME_PHASES = [
  'setup',
  'turn-start',
  'roll',
  'choose-target',
  'move',
  'choose-path',
  'trophy-offer',
  'space-event',
  'reaction-window',
  'turn-end',
  'minigame-intro',
  'minigame-play',
  'minigame-results',
  'round-end',
  'game-results',
] as const;
export const ITEM_KINDS = ['double-dice', 'coin-steal', 'trap', 'shield'] as const;
export const PROMPT_KINDS = ['roll', 'target', 'path', 'trophy', 'reaction'] as const;
export const BOARD_EVENT_KINDS = [
  'coin-rain',
  'gust',
  'swap',
  'trophy-shuffle',
  'lucky-find',
] as const;
/** `tailwind` (v4-Nachtrag CHAOS-125): Rückenwind-Münzen für Zurückliegende nach dem Minispiel. */
export const COIN_REASONS = [
  'space',
  'event',
  'trophy',
  'steal',
  'trap',
  'minigame',
  'tailwind',
] as const;
export const BUTTONS = ['a', 'b'] as const;
/** Daumen nach einem Minispiel (v4-Nachtrag CHAOS-87). */
export const VOTES = ['up', 'down'] as const;
export const GESTURE_KINDS = ['swipe-up', 'swipe-down', 'swipe-left', 'swipe-right'] as const;
/** Was ein Controller-Slot in der aktuellen Phase anbieten soll. */
export const ACTIONS = [
  'ready',
  'move',
  'button-a',
  'button-b',
  'gesture',
  'reaction',
  'choose',
  /** Lobby (v4): Figur wählen bzw. umwählen (`pick-character`). */
  'pick-character',
  /** v4-Nachtrag (CHAOS-87): Daumen hoch/runter nach dem Minispiel (`rate`). */
  'rate',
] as const;
/** Bildschirmaufbau eines Controller-Slots. `board` = Brettphase (Status + ggf. Prompt). */
export const LAYOUTS = ['wait', 'lobby', 'joystick-buttons', 'board'] as const;
/** Kurze Rückmeldung an einen Slot (Vibration, Farbblitz, Ton – Darstellung entscheidet der Controller). */
export const FEEDBACK_KINDS = ['confirm', 'hit', 'miss', 'win', 'lose'] as const;
export const ERROR_CODES = [
  'bad-message',
  'too-large',
  'version-mismatch',
  'not-joined',
  'bad-join-code',
  'session-full',
  'bad-token',
  'host-taken',
  'not-your-slot',
  'out-of-phase',
  'stale-seq',
  'rate-limited',
  /** Wahl passt nicht zum aktuellen Prompt (veraltet, falsche Option, nicht dran). */
  'invalid-choice',
  /** Minispiel-Ergebnis vom Host passt nicht (falsche Runde, Wertung, zu spät). */
  'invalid-result',
  /** v4: Figur ist schon von einem anderen Slot gewählt. */
  'character-taken',
  /** v4: Partie ist pausiert (Wahl, Eingaben, erneutes `pause`). */
  'paused',
  'internal',
] as const;

export const PhaseSchema = z.enum(PHASES);
export const ButtonSchema = z.enum(BUTTONS);
export const GestureKindSchema = z.enum(GESTURE_KINDS);
export const ActionSchema = z.enum(ACTIONS);
export const LayoutSchema = z.enum(LAYOUTS);
export const FeedbackKindSchema = z.enum(FEEDBACK_KINDS);
export const ErrorCodeSchema = z.enum(ERROR_CODES);
export const GameModeSchema = z.enum(GAME_MODES);
export const GamePhaseSchema = z.enum(GAME_PHASES);
export const ItemKindSchema = z.enum(ITEM_KINDS);
export const PromptKindSchema = z.enum(PROMPT_KINDS);
export const BoardEventKindSchema = z.enum(BOARD_EVENT_KINDS);
export const CoinReasonSchema = z.enum(COIN_REASONS);
export const VoteSchema = z.enum(VOTES);
/** Figuren-ID (v4, Quelle `./characters.ts`). */
export const CharacterIdSchema = z.enum(CHARACTER_IDS);
/**
 * Welches Kriterium den Platz im Endstand entschieden hat (v4, ADR-015): Trophäen → Münzen →
 * Minispiel-Siege → geteilter Platz. Erlaubt dem Host, die Trophäenzählung zu inszenieren.
 */
export const RANKING_CRITERIA = ['trophies', 'coins', 'minigame-wins', 'shared'] as const;
export const RankingCriterionSchema = z.enum(RANKING_CRITERIA);

// ---------------------------------------------------------------------------
// Bausteine
// ---------------------------------------------------------------------------

export const VersionSchema = z.literal(PROTOCOL_VERSION);
export const SlotSchema = z.literal([1, 2, 3, 4]);
/** Sequenznummer: nicht-negative, sichere Ganzzahl. */
export const SeqSchema = z.int().nonnegative();
export const AxisSchema = z.number().min(-1).max(1);

/** Kurzer Join-Code, vom Server erzeugt: 4–8 Großbuchstaben/Ziffern. */
export const JoinCodeSchema = z.string().regex(/^[A-Z0-9]{4,8}$/);
/** Undurchsichtiges, vom Server erzeugtes Token (base64url), 16–128 Zeichen. */
export const SessionTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{16,128}$/);
export const ColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/);
/** ID eines Brettfelds oder Bretts (`s07`, `wackelwald`). */
export const SpaceIdSchema = z.string().regex(/^[a-z0-9-]{1,32}$/);
/** ID einer Prompt-Option (`roll`, `item:trap`, `slot:2`, `s12`). */
export const OptionIdSchema = z.string().regex(/^[a-z0-9:-]{1,32}$/);
/** Nicht-negative Ganzzahl für Münzen, Trophäen, Runden. */
export const CountSchema = z.int().nonnegative().max(1_000_000);
/** Höchstzahl Runden einer Partie. */
export const MAX_ROUNDS = 20;
/** Rundenzahl einer Partie (Lobby-Einstellung, `start`, `configure`). */
export const RoundsSchema = z.int().min(1).max(MAX_ROUNDS);
/**
 * Brett-Wahl der Lobby (CHAOS-197): eine Brett-ID (`wackelwald`) oder `RANDOM_BOARD`. Das Schema
 * prüft nur die Form; ob es das Brett gibt, prüft der Server gegen das Brett-Register.
 */
export const BoardChoiceSchema = SpaceIdSchema;
/** Höchstzahl Vorschläge für die Rundenzahl in `lobby.settings.roundPresets`. */
export const MAX_ROUND_PRESETS = 6;
/**
 * Brett-Wahl „Zufall“ in der Lobby (CHAOS-197): keine Brett-ID, der Server löst sie erst beim
 * Start auf (`BoardView.boardId` nennt dann das gespielte Brett). Kein Brett darf so heißen.
 */
export const RANDOM_BOARD = 'zufall';
/** Anzeigename der Wahl `RANDOM_BOARD` (Controller, Hosts). */
export const RANDOM_BOARD_NAME = 'Zufallsbrett';
/** Höchstzahl Bretter in `lobby.settings.boards`. */
export const MAX_BOARDS = 16;
/** Höchstlänge eines Brett-Namens (wie „Wackelwald“). */
export const MAX_BOARD_NAME_LENGTH = 40;
/** Höchstlänge der Kurzbeschreibung eines Bretts (gleich `MAX_BOARD_TAGLINE_LENGTH` in game-core). */
export const MAX_BOARD_TAGLINE_LENGTH = 80;
/** Höchstzahl Ereignisse in einer `board`-Nachricht. */
export const MAX_BOARD_EVENTS = 64;
/** Kennung eines Minispiels (gleich `MINIGAME_ID_PATTERN` im minigame-sdk). */
export const MinigameIdSchema = z.string().regex(/^[a-z0-9-]{3,32}$/);
/**
 * Höchstzahl Minispiele in Sperrliste, Favoriten und `lobby.settings.minigames` (CHAOS-85;
 * Ziel des Katalogs sind ~200 volle Minispiele).
 */
export const MAX_ROTATION_MINIGAMES = 256;
/** Liste von Minispiel-Kennungen ohne Doppelte (Sperrliste, Favoriten). */
const MinigameIdListSchema = z
  .array(MinigameIdSchema)
  .max(MAX_ROTATION_MINIGAMES)
  .refine((ids) => new Set(ids).size === ids.length, { message: 'Minispiele doppelt' });
/** Seed eines Minispiels (uint32). */
export const MinigameSeedSchema = z.int().min(0).max(0xffff_ffff);
/** Punktzahl im Minispiel (ganzzahlig, wie `MAX_SCORE` im minigame-sdk). */
export const MinigameScoreSchema = z.int().min(-1_000_000).max(1_000_000);
export const MINIGAME_STAGES = ['intro', 'play', 'results'] as const;

/**
 * Steuerzeichen (C0, DEL, C1) und Bidi-Steuerzeichen sind in Anzeigetexten
 * verboten: Sie können Namen auf Host und Controller unsichtbar verfälschen.
 */
function isForbiddenCodePoint(code: number): boolean {
  return (
    code <= 0x1f ||
    (code >= 0x7f && code <= 0x9f) ||
    (code >= 0x202a && code <= 0x202e) ||
    (code >= 0x2066 && code <= 0x2069)
  );
}

function hasForbiddenChars(text: string): boolean {
  for (const char of text) {
    if (isForbiddenCodePoint(char.codePointAt(0) ?? 0)) return true;
  }
  return false;
}

function displayText(max: number) {
  return z
    .string()
    .min(1)
    .max(max)
    .refine((text) => !hasForbiddenChars(text), 'Steuerzeichen sind nicht erlaubt')
    .refine((text) => text.trim() === text, 'Kein Leerraum am Rand erlaubt');
}

export const PlayerNameSchema = displayText(MAX_NAME_LENGTH);
export const PlayerLabelSchema = displayText(MAX_LABEL_LENGTH);

function hasUniqueSlots(items: readonly { slot: number }[]): boolean {
  return new Set(items.map((item) => item.slot)).size === items.length;
}

function hasUniqueSlotList(slots: readonly number[]): boolean {
  return new Set(slots).size === slots.length;
}

function stickInRange(stick: { x: number; y: number }): boolean {
  return Math.hypot(stick.x, stick.y) <= 1 + STICK_EPSILON;
}

const STICK_ISSUE = { message: 'Joystick-Vektor länger als 1', path: ['x'] };

// ---------------------------------------------------------------------------
// Minispiele (M3, ADR-012)
// ---------------------------------------------------------------------------

export const MinigamePlacementSchema = z.strictObject({
  slot: SlotSchema,
  place: z.int().min(1).max(MAX_PLAYERS),
  score: MinigameScoreSchema,
});

export const MinigameHighlightsSchema = z.array(displayText(64)).max(4);

/** Bedienung am Controller: Text je Element oder `null` = nicht angeboten. */
export const MinigameControlsSchema = z.strictObject({
  joystick: displayText(16).nullable(),
  a: displayText(16).nullable(),
  b: displayText(16).nullable(),
});

/** v4-Nachtrag (CHAOS-89): Spielformen mit Teams bzw. Koop (gleich `TEAM_FORMS` im SDK). */
export const MINIGAME_TEAM_FORMS = ['1v3', '2v2', 'koop'] as const;
/** Tatsächliche Aufstellung; `1v2`/`1v1` sind die Ersatzformen zu dritt bzw. zu zweit. */
export const MINIGAME_TEAM_LAYOUTS = ['1v3', '2v2', '1v2', '1v1', 'koop'] as const;
/** Höchste Koop-Stufe (gleich `KOOP_MAX_TIER` im SDK). */
export const MINIGAME_KOOP_MAX_TIER = 3;

/**
 * v4-Nachtrag (CHAOS-89): Aufstellung eines Minispiels mit Teams bzw. Koop. Bei `1v3`/`1v2`/`1v1`
 * ist Team 0 die Einzelperson, bei `koop` gibt es genau ein Team.
 */
export const MinigameTeamsSchema = z
  .strictObject({
    form: z.enum(MINIGAME_TEAM_FORMS),
    layout: z.enum(MINIGAME_TEAM_LAYOUTS),
    teams: z.array(z.array(SlotSchema).min(1).max(MAX_PLAYERS)).min(1).max(2),
    soloAdvantage: z.boolean(),
  })
  .refine((value) => hasUniqueSlotList(value.teams.flat()), 'Slot in zwei Teams');

/** v4-Nachtrag (CHAOS-89): Ausgang – Siegerteam (Index, `null` = Unentschieden) bzw. Koop-Stufe. */
export const MinigameOutcomeSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('teams'), winner: z.int().min(0).max(1).nullable() }),
  z.strictObject({ kind: z.literal('koop'), tier: z.int().min(0).max(MINIGAME_KOOP_MAX_TIER) }),
]);

/**
 * v4-Nachtrag (CHAOS-89): eigene Rolle am Controller. `solo` = allein gegen die anderen,
 * `team` = in einem Team, `koop` = alle zusammen. `mates`/`opponents` ohne den eigenen Slot.
 */
export const ControllerMinigameTeamSchema = z.strictObject({
  layout: z.enum(MINIGAME_TEAM_LAYOUTS),
  role: z.enum(['solo', 'team', 'koop']),
  /** Index des eigenen Teams (Erkennungszeichen wie am PC: 0 = ☀ Sonne, 1 = ☾ Mond). */
  index: z.int().min(0).max(1),
  mates: z.array(SlotSchema).max(MAX_PLAYERS - 1),
  opponents: z.array(SlotSchema).max(MAX_PLAYERS - 1),
  /** Zu dritt: Die Einzelperson hat einen Vorteil im Spiel. */
  advantage: z.boolean(),
  /** Nur in `results`: eigenes Team gewonnen, verloren oder Unentschieden (nicht bei Koop). */
  result: z.enum(['won', 'lost', 'draw']).optional(),
  /** Nur in `results` bei Koop: erreichte Stufe 0–3. */
  tier: z.int().min(0).max(MINIGAME_KOOP_MAX_TIER).optional(),
});

/** Minispiel aus Sicht eines Controllers (Anleitung, Bedienung, eigenes Ergebnis). */
export const ControllerMinigameInfoSchema = z.strictObject({
  id: MinigameIdSchema,
  title: displayText(24),
  tagline: displayText(64),
  instructions: z.array(displayText(64)).min(1).max(3),
  controls: MinigameControlsSchema,
  stage: z.enum(MINIGAME_STAGES),
  /** Nur in `results`: eigener Platz und Punkte (fehlt bei Abbruch). */
  place: z.int().min(1).max(MAX_PLAYERS).optional(),
  score: MinigameScoreSchema.optional(),
  scoreUnit: displayText(16),
  /** v4 (CHAOS-55): eigener Platz ist mit jemandem geteilt (nur in `results` sinnvoll). */
  tied: z.boolean(),
  /** v4 (CHAOS-55): Minispiel abgebrochen (kein gültiges Ergebnis, keine Münzen). */
  aborted: z.boolean(),
  /** v4: Nur in `results`: eigene Münzbelohnung für den Platz. */
  reward: CountSchema.optional(),
  /** v4 (CHAOS-51, EXP-019): Nur in `results`: Items aus dem Ergebnis (Trostpreis). */
  prizes: z.array(ItemKindSchema).min(1).max(4).optional(),
  /**
   * v4-Nachtrag (CHAOS-66, optional): Minispiel lief in der Partie schon; das Intro zeigt nur
   * Titel und Bedienlegende. Fehlt = `false` (volle Anleitung).
   */
  repeat: z.boolean().optional(),
  /**
   * v4-Nachtrag (CHAOS-214, optional): Nur in `intro`, wenn die Anleitung auf Bereitschaft
   * wartet: `true` = dieser Slot hat schon „Bereit“ gedrückt. Fehlt = Anleitung wartet nicht
   * (feste Anleitungszeit, ältere Server).
   */
  ready: z.boolean().optional(),
  /**
   * v4-Nachtrag (CHAOS-87, optional): Übungsrunde aus der Minispiel-Galerie (keine Münzen).
   * Fehlt = `false`.
   */
  practice: z.boolean().optional(),
  /**
   * v4-Nachtrag (CHAOS-89, optional): eigene Rolle bei Teams bzw. Koop. Fehlt = jeder gegen
   * jeden (bzw. älterer Server).
   */
  team: ControllerMinigameTeamSchema.optional(),
  /**
   * v4-Nachtrag (CHAOS-87, optional), nur in `results`: eigene Daumen-Stimme zu diesem Lauf.
   * Fehlt = noch nicht abgestimmt. Abstimmen geht, solange `actions` `rate` enthält.
   */
  vote: VoteSchema.optional(),
});

// ---------------------------------------------------------------------------
// Eingabe-Intents (ohne Umschlag), auch zur Weiterleitung an den Host
// ---------------------------------------------------------------------------

const slotSeq = { slot: SlotSchema, seq: SeqSchema };

export const MoveIntentSchema = z
  .strictObject({ type: z.literal('move'), ...slotSeq, x: AxisSchema, y: AxisSchema })
  .refine(stickInRange, STICK_ISSUE);
export const PressIntentSchema = z.strictObject({
  type: z.literal('press'),
  ...slotSeq,
  button: ButtonSchema,
});
export const ReleaseIntentSchema = z.strictObject({
  type: z.literal('release'),
  ...slotSeq,
  button: ButtonSchema,
});
export const GestureIntentSchema = z.strictObject({
  type: z.literal('gesture'),
  ...slotSeq,
  kind: GestureKindSchema,
});
export const ReactionIntentSchema = z.strictObject({
  type: z.literal('reaction'),
  ...slotSeq,
  windowId: SeqSchema,
});

/** Spieleingaben, die der Server nach Prüfung an den Host weiterreicht. */
export const InputIntentSchema = z.discriminatedUnion('type', [
  MoveIntentSchema,
  PressIntentSchema,
  ReleaseIntentSchema,
  GestureIntentSchema,
  ReactionIntentSchema,
]);

// ---------------------------------------------------------------------------
// Controller → Server
// ---------------------------------------------------------------------------

export const JoinMessageSchema = z
  .strictObject({
    v: VersionSchema,
    type: z.literal('join'),
    joinCode: JoinCodeSchema,
    /** Anzahl Spielerplätze dieser Verbindung (iPhone: 1, geteiltes iPad: 2–4; Annahme A9). */
    seats: z.int().min(1).max(MAX_PLAYERS),
    names: z.array(PlayerNameSchema).min(1).max(MAX_PLAYERS).optional(),
  })
  .refine((join) => join.names === undefined || join.names.length <= join.seats, {
    message: 'Mehr Namen als Plätze',
    path: ['names'],
  });

export const ReconnectMessageSchema = z.strictObject({
  v: VersionSchema,
  type: z.literal('reconnect'),
  sessionToken: SessionTokenSchema,
});

export const ReadyMessageSchema = z.strictObject({
  v: VersionSchema,
  type: z.literal('ready'),
  ...slotSeq,
});

export const MoveMessageSchema = z
  .strictObject({
    v: VersionSchema,
    type: z.literal('move'),
    ...slotSeq,
    x: AxisSchema,
    y: AxisSchema,
  })
  .refine(stickInRange, STICK_ISSUE);

export const PressMessageSchema = z.strictObject({
  v: VersionSchema,
  type: z.literal('press'),
  ...slotSeq,
  button: ButtonSchema,
});

export const ReleaseMessageSchema = z.strictObject({
  v: VersionSchema,
  type: z.literal('release'),
  ...slotSeq,
  button: ButtonSchema,
});

export const GestureMessageSchema = z.strictObject({
  v: VersionSchema,
  type: z.literal('gesture'),
  ...slotSeq,
  kind: GestureKindSchema,
});

export const ReactionMessageSchema = z.strictObject({
  v: VersionSchema,
  type: z.literal('reaction'),
  ...slotSeq,
  windowId: SeqSchema,
});

/** Wahl für den aktuellen Prompt eines Slots (Brettphase, M2). */
export const ChooseMessageSchema = z.strictObject({
  v: VersionSchema,
  type: z.literal('choose'),
  ...slotSeq,
  promptId: SeqSchema,
  option: OptionIdSchema,
});

/**
 * Figur wählen bzw. umwählen (v4, CHAOS-36). Nur in der Lobby. Vergebene Figur → Fehler
 * `character-taken`; Umwählen ist erlaubt und setzt `ready` zurück (ADR-015).
 */
export const PickCharacterMessageSchema = z.strictObject({
  v: VersionSchema,
  type: z.literal('pick-character'),
  ...slotSeq,
  character: CharacterIdSchema,
});

/**
 * Daumen hoch/runter zum gerade beendeten Minispiel (v4-Nachtrag CHAOS-87). Freiwillig und nur,
 * solange der Kontext `rate` anbietet (Ergebnisanzeige). Erneut senden ändert die Stimme.
 * `minigameId` und `round` benennen den Lauf; passen sie nicht, antwortet der Server mit
 * `invalid-choice`.
 */
export const RateMessageSchema = z.strictObject({
  v: VersionSchema,
  type: z.literal('rate'),
  ...slotSeq,
  minigameId: MinigameIdSchema,
  round: CountSchema,
  vote: VoteSchema,
});

/** Herzschlag von Controller oder Host. `t` ist die Client-Uhr und wird nur zurückgespiegelt (B8). */
export const HeartbeatMessageSchema = z.strictObject({
  v: VersionSchema,
  type: z.literal('heartbeat'),
  t: z.number(),
});

const controllerMessageOptions = [
  JoinMessageSchema,
  ReconnectMessageSchema,
  ReadyMessageSchema,
  MoveMessageSchema,
  PressMessageSchema,
  ReleaseMessageSchema,
  GestureMessageSchema,
  ReactionMessageSchema,
  ChooseMessageSchema,
  PickCharacterMessageSchema,
  RateMessageSchema,
  HeartbeatMessageSchema,
] as const;

export const ControllerMessageSchema = z.discriminatedUnion('type', controllerMessageOptions);

// ---------------------------------------------------------------------------
// Host → Server
// ---------------------------------------------------------------------------

export const HostHelloMessageSchema = z.strictObject({
  v: VersionSchema,
  type: z.literal('host-hello'),
});

/**
 * Host hat Szene und Figuren geladen (v4-Nachtrag CHAOS-68, additiv): Erst danach setzt der
 * Server eine Auto-Pause nach Host-Verlust fort (ADR-015 Nachtrag 3). Der Host schickt sie nach
 * jedem Wiederverbinden, sobald seine Bühne (Brett bzw. Minispiel) steht; sonst ignoriert der
 * Server sie.
 */
export const HostReadyMessageSchema = z.strictObject({
  v: VersionSchema,
  type: z.literal('host-ready'),
});

export const StartMessageSchema = z.strictObject({
  v: VersionSchema,
  type: z.literal('start'),
  /** Fehlt = `board`. `arena` startet die M1-Arena (Phase `play`). */
  mode: GameModeSchema.optional(),
  /** Rundenzahl des Brettspiels (fehlt = Lobby-Einstellung, siehe `configure`). */
  rounds: RoundsSchema.optional(),
  /**
   * v4-Nachtrag (CHAOS-87, optional): Übungsrunde aus der Minispiel-Galerie – nur dieses
   * Minispiel, ohne Brett und Münzen, danach zurück in die Lobby. Nur mit `mode` `board`
   * (oder ohne). Ein unbekanntes Minispiel lehnt der Server mit `bad-message` ab.
   */
  practice: MinigameIdSchema.optional(),
});

/**
 * Lobby-Einstellungen ändern (v4, CHAOS-36): Rundenzahl der nächsten Partie.
 * v4-Nachtrag (CHAOS-124): `moreReactionTime` schaltet das längere Reaktionsfenster
 * (Barrierefreiheit). Beide Felder optional, mindestens eines muss gesetzt sein.
 */
export const ConfigureMessageSchema = z
  .strictObject({
    v: VersionSchema,
    type: z.literal('configure'),
    rounds: RoundsSchema.optional(),
    moreReactionTime: z.boolean().optional(),
    /**
     * v4-Nachtrag (CHAOS-197): Brett der nächsten Partie (Brett-ID oder `RANDOM_BOARD`). Ein
     * unbekanntes Brett lehnt der Server mit `bad-message` ab.
     */
    board: BoardChoiceSchema.optional(),
    /**
     * v4-Nachtrag (CHAOS-85): Sperrliste der Minispiel-Rotation (ersetzt die ganze Liste;
     * `[]` leert sie). Kennungen, die der Server nicht in der Rotation hat, ignoriert er.
     */
    minigameBlocklist: MinigameIdListSchema.optional(),
    /** v4-Nachtrag (CHAOS-85): Favoriten der Rotation (ersetzt die ganze Liste). */
    minigameFavorites: MinigameIdListSchema.optional(),
  })
  .refine(
    (message) =>
      message.rounds !== undefined ||
      message.moreReactionTime !== undefined ||
      message.board !== undefined ||
      message.minigameBlocklist !== undefined ||
      message.minigameFavorites !== undefined,
    {
      message:
        'configure braucht rounds, moreReactionTime, board, minigameBlocklist oder minigameFavorites',
    },
  );

/** Partie anhalten (v4, CHAOS-36): Fristen und Spielzeit stehen, bis `resume` kommt. */
export const PauseMessageSchema = z.strictObject({
  v: VersionSchema,
  type: z.literal('pause'),
});

/** Pausierte Partie fortsetzen; alle Fristen verschieben sich um die Pausendauer. */
export const ResumeMessageSchema = z.strictObject({
  v: VersionSchema,
  type: z.literal('resume'),
});

/** Partie vorzeitig beenden: sofort Endstand (`game-results`, `endedEarly: true`). */
export const EndGameMessageSchema = z.strictObject({
  v: VersionSchema,
  type: z.literal('end-game'),
});

/**
 * Nach dem Endstand zurück in die Lobby (v4, CHAOS-37): Spieler und Figuren bleiben,
 * `ready` wird zurückgesetzt, die nächste Partie bekommt einen neuen Seed.
 */
export const RematchMessageSchema = z.strictObject({
  v: VersionSchema,
  type: z.literal('rematch'),
});

/**
 * Ergebnis des laufenden Minispiels (M3). Der Host spielt das Minispiel, der Server prüft das
 * Ergebnis in game-core (Teilnehmer, Wertung, Runde) und verteilt erst dann Münzen.
 */
export const MinigameResultMessageSchema = z.strictObject({
  v: VersionSchema,
  type: z.literal('minigame-result'),
  minigameId: MinigameIdSchema,
  round: CountSchema,
  placements: z
    .array(MinigamePlacementSchema)
    .min(1)
    .max(MAX_PLAYERS)
    .refine(hasUniqueSlots, 'Slots doppelt'),
  highlights: MinigameHighlightsSchema.optional(),
  /** v4-Nachtrag (CHAOS-89, optional): Pflicht bei Teams bzw. Koop, sonst verboten (game-core). */
  outcome: MinigameOutcomeSchema.optional(),
});

const hostOnlyMessageOptions = [
  HostHelloMessageSchema,
  HostReadyMessageSchema,
  StartMessageSchema,
  MinigameResultMessageSchema,
  ConfigureMessageSchema,
  PauseMessageSchema,
  ResumeMessageSchema,
  EndGameMessageSchema,
  RematchMessageSchema,
] as const;

export const HostMessageSchema = z.discriminatedUnion('type', [
  ...hostOnlyMessageOptions,
  HeartbeatMessageSchema,
]);

/** Alles, was ein Client senden darf (vor dem Handshake ist die Rolle noch unbekannt). */
export const ClientMessageSchema = z.discriminatedUnion('type', [
  ...controllerMessageOptions,
  ...hostOnlyMessageOptions,
]);

// ---------------------------------------------------------------------------
// Server → Controller
// ---------------------------------------------------------------------------

export const PlayerInfoSchema = z.strictObject({
  slot: SlotSchema,
  color: ColorSchema,
  label: PlayerLabelSchema,
});

export const WelcomeMessageSchema = z.strictObject({
  v: VersionSchema,
  type: z.literal('welcome'),
  sessionToken: SessionTokenSchema,
  players: z
    .array(PlayerInfoSchema)
    .min(1)
    .max(MAX_PLAYERS)
    .refine(hasUniqueSlots, 'Slots doppelt'),
});

export const PromptOptionSchema = z.strictObject({
  id: OptionIdSchema,
  label: displayText(32),
  detail: displayText(48).optional(),
  slot: SlotSchema.optional(),
});

/** Entscheidung, die ein Spieler gerade treffen soll (Brettphase). */
export const PromptSchema = z.strictObject({
  id: SeqSchema,
  slot: SlotSchema,
  kind: PromptKindSchema,
  title: displayText(48),
  options: z.array(PromptOptionSchema).min(1).max(8),
  /** Restzeit bis zur Frist beim Senden (ms) oder `null` = unbegrenzt. */
  remainingMs: z.int().nonnegative().nullable(),
});

/** Persönlicher Stand eines Slots für die Controller-Anzeige in der Brettphase. */
export const ControllerBoardInfoSchema = z.strictObject({
  gamePhase: GamePhaseSchema,
  round: CountSchema,
  rounds: CountSchema,
  coins: CountSchema,
  trophies: CountSchema,
  items: z.array(ItemKindSchema).max(8),
  /** Wer gerade dran ist (`null` im Minispiel/Ergebnis). */
  activeSlot: SlotSchema.nullable(),
  /** Platz im Endstand, nur in `game-results`. */
  place: z.int().min(1).max(MAX_PLAYERS).optional(),
  /** v4: Partie pausiert (Controller zeigt Pause, bietet nichts an). */
  paused: z.boolean(),
  /** v4: eigene Figur (für Kopfzeile/Ergebnis). */
  character: CharacterIdSchema,
  /** v4: bisher gewonnene Minispiele (1. Plätze, Gleichstand zählt für alle). */
  minigameWins: CountSchema,
  /** v4, nur in `game-results`: Platz mit jemandem geteilt. */
  tied: z.boolean().optional(),
  /** v4, nur in `game-results`: Partie wurde vorzeitig beendet. */
  endedEarly: z.boolean().optional(),
  /**
   * v4-Nachtrag (CHAOS-125), nur in `round-end`: eigene Rückenwind-Münzen nach dem Minispiel;
   * fehlt, wenn es keine gab.
   */
  tailwind: z.int().positive().optional(),
});

/** Eigener Stand in der Lobby (v4, CHAOS-36): Figurenwahl und Rundenzahl. */
export const ControllerLobbyInfoSchema = z.strictObject({
  /** Eigene Figur oder `null` = noch nicht gewählt (beim Start automatisch zugewiesen). */
  character: CharacterIdSchema.nullable(),
  /** Von anderen Slots gewählte Figuren (nicht wählbar). */
  takenCharacters: z.array(CharacterIdSchema).max(MAX_PLAYERS),
  /**
   * v4-Nachtrag (CHAOS-40): dieselben Figuren mit Besitzer-Slot (gleiche Reihenfolge), damit
   * der Controller vergebene Figuren geräteübergreifend in der Farbe des Besitzers zeigt.
   * Optional für ältere Server; dann bleiben vergebene Figuren neutral.
   */
  takenBy: z
    .array(z.strictObject({ character: CharacterIdSchema, slot: SlotSchema }))
    .max(MAX_PLAYERS)
    .optional(),
  /** Eingestellte Rundenzahl der nächsten Partie. */
  rounds: RoundsSchema,
  /**
   * v4-Nachtrag (CHAOS-197, optional): gewähltes Brett der nächsten Partie mit Anzeigename
   * („Wackelwald“, bei `RANDOM_BOARD` „Zufallsbrett“). Fehlt bei älteren Servern.
   */
  board: z
    .strictObject({
      id: BoardChoiceSchema,
      name: z.string().min(1).max(MAX_BOARD_NAME_LENGTH),
    })
    .optional(),
});

export const ContextMessageSchema = z.strictObject({
  v: VersionSchema,
  type: z.literal('context'),
  slot: SlotSchema,
  phase: PhaseSchema,
  layout: LayoutSchema,
  actions: z.array(ActionSchema).max(ACTIONS.length),
  /** Nur in Phase `board`: offene Entscheidung dieses Slots (dann `actions` enthält `choose`). */
  prompt: PromptSchema.optional(),
  /** Nur in Phase `board`: eigener Stand und wer dran ist. */
  board: ControllerBoardInfoSchema.optional(),
  /** Nur in Phase `board` während eines Minispiels (Intro, Spiel, Ergebnis). */
  minigame: ControllerMinigameInfoSchema.optional(),
  /** v4: Nur in Phase `lobby`: eigene Figur, vergebene Figuren, Rundenzahl. */
  lobby: ControllerLobbyInfoSchema.optional(),
});

export const FeedbackMessageSchema = z.strictObject({
  v: VersionSchema,
  type: z.literal('feedback'),
  slot: SlotSchema,
  kind: FeedbackKindSchema,
});

export const ErrorMessageSchema = z.strictObject({
  v: VersionSchema,
  type: z.literal('error'),
  code: ErrorCodeSchema,
  message: z.string().max(MAX_ERROR_MESSAGE_LENGTH),
  /** Sequenznummer der abgelehnten Eingabe, falls bekannt. */
  seq: SeqSchema.optional(),
});

export const HeartbeatAckMessageSchema = z.strictObject({
  v: VersionSchema,
  type: z.literal('heartbeat-ack'),
  t: z.number(),
});

export const ServerToControllerMessageSchema = z.discriminatedUnion('type', [
  WelcomeMessageSchema,
  ContextMessageSchema,
  FeedbackMessageSchema,
  ErrorMessageSchema,
  HeartbeatAckMessageSchema,
]);

// ---------------------------------------------------------------------------
// Server → Host
// ---------------------------------------------------------------------------

export const LobbyPlayerSchema = z.strictObject({
  slot: SlotSchema,
  color: ColorSchema,
  label: PlayerLabelSchema,
  connected: z.boolean(),
  ready: z.boolean(),
  /** v4: gewählte Figur oder `null` (noch keine Wahl; Auto-Zuweisung beim Start). */
  character: CharacterIdSchema.nullable(),
});

function hasUniqueCharacters(players: readonly { character: string | null }[]): boolean {
  const picked = players.flatMap((player) => (player.character === null ? [] : [player.character]));
  return new Set(picked).size === picked.length;
}

/** Ein wählbares Brett in `lobby.settings.boards` (v4-Nachtrag CHAOS-197). */
export const LobbyBoardSchema = z.strictObject({
  id: SpaceIdSchema.refine((id) => id !== RANDOM_BOARD, {
    message: `${RANDOM_BOARD} ist keine Brett-ID`,
  }),
  name: z.string().min(1).max(MAX_BOARD_NAME_LENGTH),
  /** Ein Satz für die Auswahl. */
  tagline: z.string().max(MAX_BOARD_TAGLINE_LENGTH),
  /** Zahl der Felder (Größe des Bretts). */
  spaces: z.int().min(1).max(999),
  /** Empfohlene Rundenzahl für dieses Brett. */
  recommendedRounds: RoundsSchema,
});

/**
 * Ein Minispiel der Rotation in `lobby.settings.minigames` (v4-Nachtrag CHAOS-85): Der Host
 * zeigt damit Sperrliste und Favoriten an.
 */
export const LobbyMinigameSchema = z.strictObject({
  id: MinigameIdSchema,
  title: displayText(24),
  /** Am Host gesperrt: kommt in keiner Partie (außer alle wären gesperrt). */
  blocked: z.boolean(),
  /** Am Host als Favorit markiert: kommt öfter. */
  favorite: z.boolean(),
});

/** Lobby-Einstellungen (v4, CHAOS-36). */
export const LobbySettingsSchema = z
  .strictObject({
    /** Rundenzahl der nächsten Partie. */
    rounds: RoundsSchema,
    /**
     * v4-Nachtrag (CHAOS-124, optional): längeres Reaktionsfenster für die nächste Partie
     * (Barrierefreiheit). Fehlt = aus.
     */
    moreReactionTime: z.boolean().optional(),
    /** Vorschläge für die Auswahl am PC (aufsteigend, ohne Doppelte). */
    roundPresets: z
      .array(RoundsSchema)
      .min(1)
      .max(MAX_ROUND_PRESETS)
      .refine((presets) => presets.every((value, i) => i === 0 || value > (presets[i - 1] ?? 0)), {
        message: 'Vorschläge aufsteigend ohne Doppelte',
      }),
    /**
     * v4-Nachtrag (CHAOS-197, optional): Brett der nächsten Partie, eine ID aus `boards` oder
     * `RANDOM_BOARD`. Fehlt = Standardbrett (älterer Server).
     */
    board: BoardChoiceSchema.optional(),
    /** v4-Nachtrag (CHAOS-197, optional): wählbare Bretter in Lobby-Reihenfolge. */
    boards: z
      .array(LobbyBoardSchema)
      .min(1)
      .max(MAX_BOARDS)
      .refine((boards) => new Set(boards.map((b) => b.id)).size === boards.length, {
        message: 'Brett-IDs doppelt',
      })
      .optional(),
    /**
     * v4-Nachtrag (CHAOS-85, optional): Minispiele der Rotation mit Sperr- und Favoriten-Stand
     * (Reihenfolge wie im Katalog). Fehlt = älterer Server, keine Auswahl.
     */
    minigames: z
      .array(LobbyMinigameSchema)
      .max(MAX_ROTATION_MINIGAMES)
      .refine((games) => new Set(games.map((g) => g.id)).size === games.length, {
        message: 'Minispiele doppelt',
      })
      .optional(),
  })
  .refine(
    (settings) =>
      settings.board === undefined ||
      settings.boards === undefined ||
      settings.board === RANDOM_BOARD ||
      settings.boards.some((b) => b.id === settings.board),
    { message: 'board ist keins der boards' },
  );

/** Join-Link für den QR-Code: nur `http(s)`, begrenzte Länge. */
export const JoinUrlSchema = z.url({ protocol: /^https?$/ }).max(MAX_JOIN_URL_LENGTH);

/** Sitzungs-Schnappschuss für den Host; wird bei jeder Änderung neu gesendet (auch in `play`). */
export const LobbyMessageSchema = z.strictObject({
  v: VersionSchema,
  type: z.literal('lobby'),
  joinCode: JoinCodeSchema,
  joinUrl: JoinUrlSchema.optional(),
  /**
   * Weitere Join-Links für andere Netzwerkadressen des PCs (CHAOS-11, ADR-007), beste zuerst.
   * Der Host kann damit den QR-Code umschalten, ohne den Server zu fragen. Optional und
   * additiv: `lobby` ohne das Feld bleibt gültig; der Server lässt es weg, wenn es
   * keine Alternativen gibt.
   */
  joinUrlAlternatives: z.array(JoinUrlSchema).max(MAX_JOIN_URL_ALTERNATIVES).optional(),
  phase: PhaseSchema,
  players: z
    .array(LobbyPlayerSchema)
    .max(MAX_PLAYERS)
    .refine(hasUniqueSlots, 'Slots doppelt')
    .refine(hasUniqueCharacters, 'Figur doppelt'),
  /** v4: Einstellungen der (nächsten) Partie. */
  settings: LobbySettingsSchema,
});

/** Geprüfte Controller-Eingabe; `at` ist die Server-Empfangszeit in ms (monoton, Server-Uhr). */
export const InputMessageSchema = z.strictObject({
  v: VersionSchema,
  type: z.literal('input'),
  intent: InputIntentSchema,
  at: z.number().nonnegative(),
});

// ---------------------------------------------------------------------------
// Brett-Schnappschuss Server → Host (M2, ADR-011)
// ---------------------------------------------------------------------------

export const BoardPlayerSchema = z.strictObject({
  slot: SlotSchema,
  name: PlayerLabelSchema,
  spaceId: SpaceIdSchema,
  coins: CountSchema,
  trophies: CountSchema,
  items: z.array(ItemKindSchema).max(8),
  connected: z.boolean(),
  /** v4: gewählte (oder beim Start zugewiesene) Figur. */
  character: CharacterIdSchema,
  /** v4: gewonnene Minispiele (Gleichstand auf Platz 1 zählt für alle). */
  minigameWins: CountSchema,
  /** v4: Statistik nur für Bonus-Anzeigen am Ende, ohne Einfluss auf die Wertung. */
  stats: z.strictObject({
    coinsEarned: CountSchema,
    coinsLost: CountSchema,
    spacesMoved: CountSchema,
    itemsUsed: CountSchema,
  }),
});

export const RankingEntrySchema = z.strictObject({
  slot: SlotSchema,
  place: z.int().min(1).max(MAX_PLAYERS),
  trophies: CountSchema,
  coins: CountSchema,
  /** v4: Anzahl Minispiel-Siege (drittes Kriterium). */
  minigameWins: CountSchema,
  /** v4: welches Kriterium den Platz entschied (`shared` = geteilter Platz). */
  decidedBy: RankingCriterionSchema,
});

/** Münzbelohnung eines Slots aus dem Minispiel (v4, CHAOS-55). */
export const MinigameRewardSchema = z.strictObject({
  slot: SlotSchema,
  coins: CountSchema,
  /** v4 (CHAOS-51, EXP-019): Items aus dem Ergebnis (Trostpreis); fehlt, wenn keine. */
  items: z.array(ItemKindSchema).min(1).max(4).optional(),
});

/** Öffentlicher Spielstand (ohne RNG und interne Zwischenstände). */
export const BoardViewSchema = z.strictObject({
  boardId: SpaceIdSchema,
  gamePhase: GamePhaseSchema,
  round: CountSchema,
  rounds: CountSchema,
  turnOrder: z.array(SlotSchema).max(MAX_PLAYERS),
  activeSlot: SlotSchema.nullable(),
  players: z.array(BoardPlayerSchema).max(MAX_PLAYERS).refine(hasUniqueSlots, 'Slots doppelt'),
  trophySpaces: z.array(SpaceIdSchema).max(64),
  trophyPrice: CountSchema,
  traps: z.array(z.strictObject({ spaceId: SpaceIdSchema, owner: SlotSchema })).max(64),
  /** Offene Entscheidung (wer, was), damit der PC „Blau wählt einen Weg …“ zeigen kann. */
  prompt: PromptSchema.nullable(),
  /** Restzeit der laufenden automatischen Phase (ms) oder `null`. */
  remainingMs: z.int().nonnegative().nullable(),
  /** Takt je Feld beim Laufen (ms); der Host animiert damit. */
  stepMs: CountSchema,
  ranking: z.array(RankingEntrySchema).max(MAX_PLAYERS).nullable(),
  /** Minispiel der Runde (ab `minigame-intro` bis Rundenende), sonst `null`. */
  minigame: z
    .strictObject({
      id: MinigameIdSchema,
      round: CountSchema,
      seed: MinigameSeedSchema,
      playMs: CountSchema,
      /**
       * v4-Nachtrag (CHAOS-66, optional): Minispiel lief in der Partie schon; kurze Anleitung
       * am PC. Fehlt = `false`.
       */
      repeat: z.boolean().optional(),
      /**
       * v4-Nachtrag (CHAOS-214, optional): Slots, die in der Anleitung schon „Bereit“ gedrückt
       * haben. Fehlt = die Anleitung wartet nicht auf Bereitschaft (feste Anleitungszeit).
       */
      ready: z.array(SlotSchema).max(MAX_PLAYERS).optional(),
      /**
       * v4-Nachtrag (CHAOS-89, optional): Aufstellung bei Teams bzw. Koop ab `minigame-intro`.
       * Fehlt = jeder gegen jeden.
       */
      teams: MinigameTeamsSchema.optional(),
      /** v4-Nachtrag (CHAOS-89, optional): Ausgang bei Teams bzw. Koop ab dem Ergebnis. */
      outcome: MinigameOutcomeSchema.optional(),
      /** Seit Beginn von `minigame-play` vergangen (ms) oder `null` davor. */
      elapsedMs: z.int().nonnegative().nullable(),
      placements: z.array(MinigamePlacementSchema).max(MAX_PLAYERS).nullable(),
      highlights: MinigameHighlightsSchema,
      aborted: z.boolean(),
      /**
       * v4 (CHAOS-55): ausgezahlte Münzen je Slot, sobald das Ergebnis feststeht (`null` davor,
       * leer bei Abbruch). Damit ist die Ergebnisanzeige nach einem Host-Neuladen vollständig.
       */
      rewards: z.array(MinigameRewardSchema).max(MAX_PLAYERS).nullable(),
      /**
       * v4-Nachtrag (CHAOS-125), ab `round-end`: Rückenwind-Münzen je Slot (nur Slots mit
       * Münzen). Fehlt, wenn es keinen Rückenwind gab.
       */
      tailwind: z
        .array(z.strictObject({ slot: SlotSchema, coins: z.int().positive() }))
        .min(1)
        .max(MAX_PLAYERS)
        .optional(),
    })
    .nullable(),
  /**
   * v4-Nachtrag (CHAOS-87, optional): Übungsrunde aus der Minispiel-Galerie (ein Minispiel, keine
   * Münzen; nach dem Ergebnis geht es zurück in die Lobby). Fehlt = `false`.
   */
  practice: z.boolean().optional(),
  /** v4: Partie pausiert; Restzeiten stehen still (`remainingMs`, `prompt`, Minispiel). */
  paused: z.boolean(),
  /** v4: Partie wurde vorzeitig beendet (nur in `game-results` `true`). */
  endedEarly: z.boolean(),
});

const slotField = { slot: SlotSchema };

/** Spiegel von `GameEvent` in `@chaos-party/game-core`. */
export const BoardEventSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('game-started'), order: z.array(SlotSchema).max(MAX_PLAYERS) }),
  z.strictObject({
    type: z.literal('round-started'),
    round: CountSchema,
    /**
     * v4-Nachtrag (CHAOS-120, additiv): nur in Runden, in denen die Sabotage wächst – die neuen
     * Münzwerte für Klau und Falle. Der Host kündigt sie an.
     */
    sabotage: z.strictObject({ steal: CountSchema, trap: CountSchema }).optional(),
  }),
  z.strictObject({ type: z.literal('turn-started'), ...slotField, round: CountSchema }),
  z.strictObject({
    type: z.literal('item-used'),
    ...slotField,
    item: ItemKindSchema,
    target: SlotSchema.optional(),
  }),
  z.strictObject({
    type: z.literal('dice-rolled'),
    ...slotField,
    faces: z.array(CountSchema).min(1).max(4),
    total: CountSchema,
  }),
  z.strictObject({ type: z.literal('path-chosen'), ...slotField, spaceId: SpaceIdSchema }),
  z.strictObject({
    type: z.literal('moved'),
    ...slotField,
    path: z.array(SpaceIdSchema).max(64),
  }),
  z.strictObject({
    type: z.literal('coins-changed'),
    ...slotField,
    delta: z.int(),
    balance: CountSchema,
    reason: CoinReasonSchema,
  }),
  z.strictObject({ type: z.literal('trophy-bought'), ...slotField, spaceId: SpaceIdSchema }),
  z.strictObject({ type: z.literal('trophy-moved'), from: SpaceIdSchema, to: SpaceIdSchema }),
  z.strictObject({ type: z.literal('item-gained'), ...slotField, item: ItemKindSchema }),
  z.strictObject({ type: z.literal('board-event'), ...slotField, event: BoardEventKindSchema }),
  z.strictObject({ type: z.literal('trap-placed'), ...slotField, spaceId: SpaceIdSchema }),
  z.strictObject({
    type: z.literal('trap-triggered'),
    ...slotField,
    owner: SlotSchema,
    spaceId: SpaceIdSchema,
    amount: CountSchema,
  }),
  z.strictObject({
    type: z.literal('reaction-opened'),
    promptId: SeqSchema,
    ...slotField,
    attacker: SlotSchema,
    item: ItemKindSchema,
    deadline: z.number().nonnegative(),
  }),
  z.strictObject({
    type: z.literal('reaction-resolved'),
    ...slotField,
    result: z.enum(['shield', 'brace', 'timeout']),
  }),
  z.strictObject({
    type: z.literal('coins-stolen'),
    from: SlotSchema,
    to: SlotSchema,
    amount: CountSchema,
  }),
  z.strictObject({
    type: z.literal('player-auto'),
    ...slotField,
    option: OptionIdSchema,
    reason: z.enum(['disconnected', 'timeout']),
  }),
  z.strictObject({ type: z.literal('turn-ended'), ...slotField }),
  z.strictObject({ type: z.literal('minigame-started'), minigame: MinigameIdSchema }),
  z.strictObject({
    type: z.literal('minigame-results'),
    ranking: z.array(SlotSchema).max(MAX_PLAYERS),
    placements: z.array(MinigamePlacementSchema).max(MAX_PLAYERS),
    aborted: z.boolean(),
  }),
  z.strictObject({ type: z.literal('round-ended'), round: CountSchema }),
  z.strictObject({
    type: z.literal('game-ended'),
    ranking: z.array(RankingEntrySchema).max(MAX_PLAYERS),
    /** v4: Ende per `end-game` statt nach der letzten Runde. */
    endedEarly: z.boolean(),
  }),
]);

/**
 * Brett-Schnappschuss an den Host bei jeder Änderung (Phase `board`). `events` sind die seit
 * der letzten `board`-Nachricht entstandenen Ereignisse; `eventSeq` ist die laufende Nummer
 * des ersten davon (lückenlos, ab 0), damit der Host Doppeltes/Verpasstes erkennt.
 */
export const BoardMessageSchema = z.strictObject({
  v: VersionSchema,
  type: z.literal('board'),
  view: BoardViewSchema,
  events: z.array(BoardEventSchema).max(MAX_BOARD_EVENTS),
  eventSeq: SeqSchema,
});

/**
 * Antwort auf `minigame-result` (v4, CHAOS-55): angenommen oder nicht, mit Fehlercode.
 * Bei Ablehnung kommt zusätzlich wie bisher `error` (`invalid-result`/`out-of-phase`).
 */
export const MinigameResultAckMessageSchema = z.strictObject({
  v: VersionSchema,
  type: z.literal('minigame-result-ack'),
  minigameId: MinigameIdSchema,
  round: CountSchema,
  accepted: z.boolean(),
  code: ErrorCodeSchema.optional(),
});

/** Höchstzahl Minispiele in `ratings` (Katalog-Ziel ~200, mit Luft). */
export const MAX_RATED_MINIGAMES = 512;

/** Stimmen eines Minispiels (v4-Nachtrag CHAOS-87). */
export const MinigameRatingSchema = z.strictObject({
  id: MinigameIdSchema,
  up: CountSchema,
  down: CountSchema,
});

/**
 * Daumen-Übersicht für die Minispiel-Galerie (v4-Nachtrag CHAOS-87): alle gespeicherten Stimmen
 * je Minispiel (nur Minispiele mit mindestens einer Stimme). Der Server schickt sie nach
 * `host-hello` und nach jeder angenommenen Stimme.
 */
export const RatingsMessageSchema = z.strictObject({
  v: VersionSchema,
  type: z.literal('ratings'),
  games: z.array(MinigameRatingSchema).max(MAX_RATED_MINIGAMES),
});

export const ServerToHostMessageSchema = z.discriminatedUnion('type', [
  LobbyMessageSchema,
  BoardMessageSchema,
  InputMessageSchema,
  MinigameResultAckMessageSchema,
  RatingsMessageSchema,
  ErrorMessageSchema,
  HeartbeatAckMessageSchema,
]);

export const ServerMessageSchema = z.discriminatedUnion('type', [
  WelcomeMessageSchema,
  ContextMessageSchema,
  FeedbackMessageSchema,
  LobbyMessageSchema,
  BoardMessageSchema,
  InputMessageSchema,
  MinigameResultAckMessageSchema,
  RatingsMessageSchema,
  ErrorMessageSchema,
  HeartbeatAckMessageSchema,
]);
