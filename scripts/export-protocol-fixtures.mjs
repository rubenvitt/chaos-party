// Schreibt den Fixture-Korpus für die native Controller-App (CHAOS-115, ADR-017):
// echte, schemagültige Nachrichten der Controller-Rolle in beide Richtungen, ein paar
// kaputte Nachrichten und die Aufzählungen/Grenzen des Protokolls. Jede Fixture läuft durch
// den echten Parser aus `@chaos-party/protocol`; ungültige Fixtures müssen dort scheitern.
// Die Swift-Tests (`apps/controller-ios/Tests`) dekodieren bzw. kodieren jede Datei.
//
// Aufruf: `node scripts/export-protocol-fixtures.mjs` (Node ≥ 22.18, lädt TS direkt).
// Prüfen ohne Schreiben: `node scripts/export-protocol-fixtures.mjs --check` (Exit 1 bei Abweichung).
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as protocol from '../packages/protocol/src/index.ts';

const {
  ACTIONS,
  BUTTONS,
  CHARACTER_IDS,
  ControllerMessageSchema,
  ERROR_CODES,
  FEEDBACK_KINDS,
  GAME_PHASES,
  GESTURE_KINDS,
  ITEM_KINDS,
  LAYOUTS,
  MAX_ERROR_MESSAGE_LENGTH,
  MAX_MESSAGE_LENGTH,
  MAX_NAME_LENGTH,
  MAX_PLAYERS,
  MAX_SERVER_MESSAGE_LENGTH,
  MINIGAME_STAGES,
  PHASES,
  PROMPT_KINDS,
  PROTOCOL_VERSION,
  STICK_EPSILON,
  ServerToControllerMessageSchema,
  createMessage,
  encode,
  parseControllerMessage,
  parseServerMessage,
  parseServerToControllerMessage,
} = protocol;

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'apps/controller-ios/Tests/Fixtures');
const check = process.argv.includes('--check');

// Offensichtlich erfundener Wert ohne hohe Entropie: Ein zufällig aussehendes Token meldet
// GitGuardian als Geheimnis ("Generic High Entropy Secret"), und "Alle Checks grün" wird rot.
const TOKEN = 'test-session-token-0000';
const SETTINGS = { rounds: 5, roundPresets: [3, 5, 8] };
const CONTROLS = { joystick: 'Lenken', a: 'Pumpen', b: null };

function board(patch = {}) {
  return {
    gamePhase: 'roll',
    round: 2,
    rounds: 5,
    coins: 12,
    trophies: 1,
    items: ['double-dice', 'shield'],
    activeSlot: 1,
    paused: false,
    character: 'cactus',
    minigameWins: 1,
    ...patch,
  };
}

function minigame(patch = {}) {
  return {
    id: 'pump-race',
    title: 'Pump-Rennen',
    tagline: 'Wer pumpt am schnellsten?',
    instructions: ['Tippe A so schnell du kannst', 'Mit dem Stick lenken'],
    controls: CONTROLS,
    stage: 'intro',
    scoreUnit: 'Pumpstöße',
    tied: false,
    aborted: false,
    ...patch,
  };
}

/** @param {any} body Kontext ohne `v`/`type`/`slot`; geprüft wird unten mit dem echten Parser. */
function context(body) {
  return createMessage('context', { slot: 1, ...body });
}

/** Server → Controller: jede Variante, die der Controller sehen kann. */
const serverToController = {
  'welcome-one-slot': createMessage('welcome', {
    sessionToken: TOKEN,
    players: [{ slot: 1, color: '#0072B2', label: 'Blau' }],
  }),
  'welcome-named': createMessage('welcome', {
    sessionToken: TOKEN,
    players: [{ slot: 3, color: '#009E73', label: 'Jörg' }],
  }),
  'context-lobby-pick': context({
    phase: 'lobby',
    layout: 'lobby',
    actions: ['ready', 'pick-character'],
    lobby: {
      character: null,
      takenCharacters: ['robot'],
      takenBy: [{ character: 'robot', slot: 2 }],
      rounds: 5,
    },
  }),
  'context-lobby-ready-without-taken-by': context({
    phase: 'lobby',
    layout: 'wait',
    actions: ['pick-character'],
    lobby: { character: 'cactus', takenCharacters: ['robot', 'sock'], rounds: 8 },
  }),
  // CHAOS-179: Spielleitung mit belegten Plätzen (Mensch und KI mit Stärke).
  'context-lobby-lead-ai': context({
    phase: 'lobby',
    layout: 'lobby',
    actions: ['ready', 'pick-character'],
    lobby: {
      character: null,
      takenCharacters: [],
      takenBy: [],
      rounds: 5,
      lead: true,
      seats: [
        { slot: 1, kind: 'human' },
        { slot: 3, kind: 'ai', strength: 'schwer' },
      ],
    },
  }),
  'context-lobby-basic': context({ phase: 'lobby', layout: 'lobby', actions: ['ready'] }),
  'context-wait': context({ phase: 'lobby', layout: 'wait', actions: [] }),
  'context-arena-play': context({
    phase: 'play',
    layout: 'joystick-buttons',
    actions: ['move', 'button-a', 'button-b'],
  }),
  'context-board-waiting': context({
    phase: 'board',
    layout: 'board',
    actions: [],
    board: board({ activeSlot: 2 }),
  }),
  'context-board-roll-prompt': context({
    phase: 'board',
    layout: 'board',
    actions: ['choose'],
    prompt: {
      id: 7,
      slot: 1,
      kind: 'roll',
      title: 'Du bist dran!',
      options: [
        { id: 'roll', label: 'Würfeln' },
        { id: 'item:double-dice', label: 'Doppelwürfel', detail: 'Zwei Würfel' },
      ],
      remainingMs: 15000,
    },
    board: board(),
  }),
  'context-board-target-prompt-unlimited': context({
    phase: 'board',
    layout: 'board',
    actions: ['choose'],
    prompt: {
      id: 8,
      slot: 1,
      kind: 'target',
      title: 'Wen beklaust du?',
      options: [
        { id: 'slot:2', label: 'Orange', slot: 2 },
        { id: 'cancel', label: 'Abbrechen' },
      ],
      remainingMs: null,
    },
    board: board({ gamePhase: 'choose-target' }),
  }),
  'context-board-path-prompt': context({
    phase: 'board',
    layout: 'board',
    actions: ['choose'],
    prompt: {
      id: 9,
      slot: 1,
      kind: 'path',
      title: 'Welcher Weg?',
      options: [
        { id: 's12', label: 'Links', detail: 'Zum Pilzhain' },
        { id: 's20', label: 'Rechts' },
      ],
      remainingMs: 8000,
    },
    board: board({ gamePhase: 'choose-path' }),
  }),
  'context-board-trophy-prompt': context({
    phase: 'board',
    layout: 'board',
    actions: ['choose'],
    prompt: {
      id: 10,
      slot: 1,
      kind: 'trophy',
      title: 'Trophäe kaufen?',
      options: [
        { id: 'buy', label: 'Kaufen', detail: '15 Münzen' },
        { id: 'skip', label: 'Weiter' },
      ],
      remainingMs: 10000,
    },
    board: board({ gamePhase: 'trophy-offer' }),
  }),
  'context-board-reaction-prompt': context({
    phase: 'board',
    layout: 'board',
    actions: ['choose'],
    prompt: {
      id: 11,
      slot: 1,
      kind: 'reaction',
      title: 'Orange klaut Münzen!',
      options: [
        { id: 'shield', label: 'Schild' },
        { id: 'brace', label: 'Festhalten' },
      ],
      remainingMs: 3000,
    },
    board: board({ gamePhase: 'reaction-window', activeSlot: 2 }),
  }),
  'context-board-paused': context({
    phase: 'board',
    layout: 'board',
    actions: [],
    board: board({ paused: true }),
  }),
  'context-minigame-intro': context({
    phase: 'board',
    layout: 'board',
    actions: [],
    board: board({ gamePhase: 'minigame-intro', activeSlot: null }),
    minigame: minigame(),
  }),
  'context-minigame-intro-repeat': context({
    phase: 'board',
    layout: 'board',
    actions: [],
    board: board({ gamePhase: 'minigame-intro', activeSlot: null }),
    minigame: minigame({ repeat: true }),
  }),
  // CHAOS-214: Anleitung wartet auf „Bereit“ – angeboten bzw. schon gedrückt.
  'context-minigame-intro-ready': context({
    phase: 'board',
    layout: 'board',
    actions: ['ready'],
    board: board({ gamePhase: 'minigame-intro', activeSlot: null }),
    minigame: minigame({ ready: false }),
  }),
  'context-minigame-intro-ready-done': context({
    phase: 'board',
    layout: 'board',
    actions: [],
    board: board({ gamePhase: 'minigame-intro', activeSlot: null }),
    minigame: minigame({ ready: true }),
  }),
  'context-minigame-play': context({
    phase: 'board',
    layout: 'joystick-buttons',
    actions: ['move', 'button-a'],
    board: board({ gamePhase: 'minigame-play', activeSlot: null }),
    minigame: minigame({
      stage: 'play',
      controls: { joystick: null, a: 'Pumpen', b: 'Bremsen' },
    }),
  }),
  'context-minigame-results': context({
    phase: 'board',
    layout: 'board',
    actions: [],
    board: board({ gamePhase: 'minigame-results', activeSlot: null }),
    minigame: minigame({ stage: 'results', place: 1, score: 42, tied: true, reward: 10 }),
  }),
  // Trostpreis für den letzten Platz (CHAOS-51, EXP-019; Swift: CHAOS-127).
  'context-minigame-results-prize': context({
    phase: 'board',
    layout: 'board',
    actions: [],
    board: board({ gamePhase: 'minigame-results', activeSlot: null }),
    minigame: minigame({ stage: 'results', place: 4, score: 17, reward: 0, prizes: ['trap'] }),
  }),
  'context-minigame-aborted': context({
    phase: 'board',
    layout: 'board',
    actions: [],
    board: board({ gamePhase: 'minigame-results', activeSlot: null }),
    minigame: minigame({ stage: 'results', aborted: true }),
  }),
  'context-final': context({
    phase: 'board',
    layout: 'board',
    actions: [],
    board: board({
      gamePhase: 'game-results',
      activeSlot: null,
      place: 1,
      tied: false,
      endedEarly: true,
    }),
  }),
  'feedback-confirm': createMessage('feedback', { slot: 1, kind: 'confirm' }),
  'feedback-win': createMessage('feedback', { slot: 1, kind: 'win' }),
  'error-with-seq': createMessage('error', {
    code: 'character-taken',
    message: 'Figur vergeben',
    seq: 4,
  }),
  'error-without-seq': createMessage('error', {
    code: 'bad-join-code',
    message: 'Unbekannter Code',
  }),
  'heartbeat-ack': createMessage('heartbeat-ack', { t: 123456.789 }),
};

/** Controller → Server: alles, was die App sendet (inklusive Typen ohne heutige UI). */
const controllerToServer = {
  'join-phone': createMessage('join', { joinCode: 'AB12', seats: 1 }),
  'join-named': createMessage('join', { joinCode: 'AB12', seats: 1, names: ['Jörg'] }),
  reconnect: createMessage('reconnect', { sessionToken: TOKEN }),
  heartbeat: createMessage('heartbeat', { t: 98765.4321 }),
  ready: createMessage('ready', { slot: 1, seq: 1 }),
  'pick-character': createMessage('pick-character', { slot: 1, seq: 2, character: 'raccoon' }),
  choose: createMessage('choose', { slot: 1, seq: 3, promptId: 7, option: 'item:double-dice' }),
  move: createMessage('move', { slot: 1, seq: 4, x: 0.6, y: -0.8 }),
  'move-release': createMessage('move', { slot: 1, seq: 5, x: 0, y: 0 }),
  press: createMessage('press', { slot: 1, seq: 6, button: 'a' }),
  release: createMessage('release', { slot: 1, seq: 7, button: 'b' }),
  gesture: createMessage('gesture', { slot: 1, seq: 8, kind: 'swipe-left' }),
  reaction: createMessage('reaction', { slot: 1, seq: 9, windowId: 3 }),
  // CHAOS-179: KI-Platz setzen bzw. entfernen (nur Spielleitung; Oberfläche folgt mit CHAOS-182).
  'ai-seat': createMessage('ai-seat', { slot: 1, seq: 11, seat: 3, strength: 'mittel' }),
  'ai-seat-remove': createMessage('ai-seat', { slot: 1, seq: 12, seat: 3, strength: null }),
  // CHAOS-87: Daumen nach dem Minispiel (native App ohne Oberfläche dafür, CHAOS-219).
  rate: createMessage('rate', {
    slot: 1,
    seq: 10,
    minigameId: 'sockenregen',
    round: 2,
    vote: 'up',
  }),
};

/** Server-Nachrichten anderer Rollen: Der Controller muss sie als `.unknown` überspringen. */
const unknownType = {
  'host-lobby': createMessage('lobby', {
    joinCode: 'AB12',
    phase: 'lobby',
    players: [
      { slot: 1, color: '#0072B2', label: 'Blau', connected: true, ready: false, character: null },
    ],
    settings: SETTINGS,
  }),
};

/**
 * Kaputte Server-Nachrichten, die auch Swift ablehnen muss. Dateiname = erwarteter Fehler
 * (`bad-message-…`, `version-mismatch-…`, `too-large`). Text statt Objekt, weil manche kein
 * gültiges JSON sind.
 */
const invalid = {
  'bad-message-not-json': '{"v":4,"type":"context"',
  'bad-message-array': '[4,"welcome"]',
  'bad-message-missing-version': '{"type":"feedback","slot":1,"kind":"hit"}',
  'bad-message-missing-type': '{"v":4,"slot":1,"kind":"hit"}',
  'bad-message-context-missing-layout':
    '{"v":4,"type":"context","slot":1,"phase":"lobby","actions":[]}',
  'bad-message-welcome-players-not-array': `{"v":4,"type":"welcome","sessionToken":"${TOKEN}","players":{}}`,
  'version-mismatch-old': '{"v":3,"type":"feedback","slot":1,"kind":"hit"}',
  'version-mismatch-string': '{"v":"4","type":"feedback","slot":1,"kind":"hit"}',
  'too-large': JSON.stringify({
    v: PROTOCOL_VERSION,
    type: 'error',
    code: 'internal',
    message: 'x'.repeat(MAX_SERVER_MESSAGE_LENGTH),
  }),
};

const constants = {
  version: PROTOCOL_VERSION,
  limits: {
    maxMessageLength: MAX_MESSAGE_LENGTH,
    maxServerMessageLength: MAX_SERVER_MESSAGE_LENGTH,
    maxNameLength: MAX_NAME_LENGTH,
    maxErrorMessageLength: MAX_ERROR_MESSAGE_LENGTH,
    maxPlayers: MAX_PLAYERS,
    stickEpsilon: STICK_EPSILON,
  },
  enums: {
    phases: PHASES,
    layouts: LAYOUTS,
    actions: ACTIONS,
    feedbackKinds: FEEDBACK_KINDS,
    errorCodes: ERROR_CODES,
    gamePhases: GAME_PHASES,
    itemKinds: ITEM_KINDS,
    promptKinds: PROMPT_KINDS,
    characterIds: CHARACTER_IDS,
    minigameStages: MINIGAME_STAGES,
    buttons: BUTTONS,
    gestureKinds: GESTURE_KINDS,
  },
};

// --- Prüfen ---------------------------------------------------------------------------

/**
 * @param {string} name
 * @param {(raw: unknown) => import('../packages/protocol/src/index.ts').ParseResult<unknown>} parse
 * @param {import('../packages/protocol/src/index.ts').ProtocolMessage} message
 */
function assertValid(name, parse, message) {
  const result = parse(encode(message));
  if (!result.ok) throw new Error(`${name}: ${result.error.code} ${result.error.message}`);
}

for (const [name, m] of Object.entries(serverToController)) {
  assertValid(name, parseServerToControllerMessage, m);
}
for (const [name, m] of Object.entries(controllerToServer)) {
  assertValid(name, parseControllerMessage, m);
}
for (const [name, m] of Object.entries(unknownType)) {
  assertValid(name, parseServerMessage, m);
  if (parseServerToControllerMessage(encode(m)).ok) throw new Error(`${name}: kein Fremdtyp`);
}
for (const [name, text] of Object.entries(invalid)) {
  const result = parseServerToControllerMessage(text);
  if (result.ok) throw new Error(`${name}: wird angenommen, soll scheitern`);
  if (!name.startsWith(result.error.code)) {
    throw new Error(`${name}: Fehler ${result.error.code} passt nicht zum Dateinamen`);
  }
}

/**
 * Jeder Nachrichtentyp der Controller-Rolle braucht mindestens eine Fixture.
 * @param {string} label
 * @param {{ options: readonly unknown[] }} schema
 * @param {Record<string, { type: string }>} messages
 */
function assertCovered(label, schema, messages) {
  const types = schema.options.map(
    (option) => /** @type {{ shape: { type: { value: string } } }} */ (option).shape.type.value,
  );
  const covered = new Set(Object.values(messages).map((m) => m.type));
  const missing = types.filter((type) => !covered.has(type));
  if (missing.length > 0) throw new Error(`${label}: keine Fixture für ${missing.join(', ')}`);
}
assertCovered('Server → Controller', ServerToControllerMessageSchema, serverToController);
assertCovered('Controller → Server', ControllerMessageSchema, controllerToServer);

// --- Schreiben ------------------------------------------------------------------------

/** Erwartete Dateien: relativer Pfad → Inhalt. */
const files = new Map();
const json = (/** @type {unknown} */ value) => `${JSON.stringify(value, null, 2)}\n`;
for (const [name, m] of Object.entries(serverToController)) {
  files.set(`server-to-controller/${name}.json`, json(m));
}
for (const [name, m] of Object.entries(controllerToServer)) {
  files.set(`controller-to-server/${name}.json`, json(m));
}
for (const [name, m] of Object.entries(unknownType)) {
  files.set(`unknown-type/${name}.json`, json(m));
}
for (const [name, text] of Object.entries(invalid)) files.set(`invalid/${name}.txt`, text);
files.set('protocol-constants.json', json(constants));

/** Alle vorhandenen Dateien unter `dir` als relative Pfade (leer, wenn es fehlt). */
/** @param {string} dir */
function existing(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(dir, join(entry.parentPath, entry.name)));
}

if (check) {
  const stale = [];
  for (const [path, content] of files) {
    let current = null;
    try {
      current = readFileSync(join(outDir, path), 'utf8');
    } catch {
      // fehlt
    }
    if (current !== content) stale.push(path);
  }
  for (const path of existing(outDir)) if (!files.has(path)) stale.push(path);
  if (stale.length > 0) {
    console.error(`Fixtures veraltet (${stale.length}): ${stale.join(', ')}`);
    console.error('Neu erzeugen: node scripts/export-protocol-fixtures.mjs');
    process.exit(1);
  }
  console.log(`Fixtures aktuell (${files.size} Dateien).`);
} else {
  rmSync(outDir, { recursive: true, force: true });
  for (const [path, content] of files) {
    mkdirSync(dirname(join(outDir, path)), { recursive: true });
    writeFileSync(join(outDir, path), content);
  }
  console.log(`${files.size} Fixtures geschrieben nach ${outDir}`);
}
