/**
 * Beispielnachrichten für die Swift-Seite (ADR-019 §6, CHAOS-139): je Phase ein `renderState`,
 * von Hand geschrieben und gegen `RenderStateSchema` geprüft (`test/contract.test.ts`).
 * `scripts/export-apple-host-fixtures.mjs` schreibt sie nach `harness/Fixtures/render-state/`;
 * der Swift-Harness dekodiert jede Datei mit `app/RenderState.swift`.
 *
 * Von Hand statt aus einer echten Partie: Spielregeln und Minispiele ändern sich oft, der Vertrag
 * selten. Dass echte Ausgaben den Vertrag einhalten, prüft der Bündel-Test.
 */
import type {
  BoardState,
  FinaleState,
  Hud,
  LobbyPlayer,
  LobbySettingsState,
  MinigameGeometry,
  MinigameState,
  PauseState,
  RenderState,
} from './contract.ts';
import { LIGHT_MOODS } from '../../host/src/lighting/moods.ts';
import { lightStateOf, mixLightStates } from '../../host/src/lighting/transition.ts';
import { lightOf, moodLight } from './lightMood.ts';

/** Brett-Knöpfe der Lobby (CHAOS-197): Wackelwald (gewählt) und Zufall. */
const BOARD_CHOICES: LobbySettingsState['boards'] = [
  { id: 'wackelwald', name: 'Wackelwald', detail: '74 Felder', selected: true, random: false },
  { id: 'zufall', name: 'Zufall', detail: 'Überraschung!', selected: false, random: true },
];

/**
 * Server-Standard: 10 Runden, Vorschläge 10/16/20, „Mehr Zeit zum Reagieren“ aus (CHAOS-166),
 * Brett Wackelwald (CHAOS-197).
 */
const SETTINGS: LobbySettingsState = {
  rounds: 10,
  roundPresets: [10, 16, 20],
  moreReactionTime: false,
  board: 'wackelwald',
  boards: BOARD_CHOICES,
};

const JOIN = {
  joinUrl: 'http://192.168.0.2:8787/?code=AB12',
  joinCode: 'AB12',
  settings: SETTINGS,
};

const ANNA: LobbyPlayer = {
  slot: 1,
  name: 'Anna',
  color: '#0072B2',
  connected: true,
  ready: true,
  character: 'raccoon',
};
const BEN: LobbyPlayer = {
  slot: 2,
  name: 'Ben',
  color: '#E69F00',
  connected: true,
  ready: false,
  character: null,
};

const HUD: Hud = {
  boardName: 'Wackelwald',
  roundText: 'Runde 3/10',
  banner: null,
  bannerSlot: null,
  status: { slot: 2, kind: 'roll', text: 'Ben darf würfeln …', detail: null, countdown: null },
  players: [
    {
      slot: 1,
      name: 'Anna',
      color: '#0072B2',
      coins: 12,
      trophies: 1,
      items: [{ id: 'shield', name: 'Schild' }],
      connected: true,
      active: false,
    },
    {
      slot: 2,
      name: 'Ben',
      color: '#E69F00',
      coins: 7,
      trophies: 0,
      items: [],
      connected: true,
      active: true,
    },
  ],
  tailwind: null,
};

const BOARD: BoardState = {
  boardId: 'wackelwald',
  round: 3,
  rounds: 10,
  activeSlot: 2,
  spaces: [
    { id: 's00', x: 0, z: 0, kind: 'start' },
    { id: 's01', x: 2.4, z: 0.5, kind: 'coins-plus' },
    { id: 's02', x: 4.6, z: 1.6, kind: 'coins-minus' },
    { id: 's03', x: 6.2, z: 3.4, kind: 'event' },
    { id: 's04', x: 6.8, z: 5.8, kind: 'item' },
    { id: 's05', x: 5.9, z: 8.1, kind: 'trophy' },
  ],
  pawns: [
    {
      slot: 1,
      spaceId: 's03',
      x: 5.75,
      z: 3.4,
      character: 'raccoon',
      y: 0,
      hop: null,
      heading: null,
      connected: true,
    },
    {
      slot: 2,
      spaceId: 's03',
      x: 6.65,
      z: 3.4,
      character: 'sock',
      y: 0,
      hop: null,
      heading: null,
      connected: true,
    },
  ],
  messages: ['Anna würfelt eine 4.', 'Anna bekommt 3 Münzen.', 'Ben ist am Zug.'],
  notice: null,
  popups: [],
  ticker: [
    { id: 4, text: 'Anna würfelt 4!', slot: 1, tone: 'neutral' },
    { id: 7, text: 'Anna bekommt 3 Münzen', slot: 1, tone: 'good' },
  ],
  hud: HUD,
  camera: { pos: [3.9, 26.7, -14.3], target: [3.9, 0, 2.4] },
  trophySpaces: ['s05'],
  traps: [{ spaceId: 's02', owner: 1 }],
  sounds: [],
  // Runde 3 von 10: Mittag (CHAOS-193).
  light: moodLight('mittag'),
  rides: [],
};

/** Mitten in der Regie: Ben hüpft, Würfel- und Münz-Popup, Klang, Anna weht davon. */
const BOARD_EVENTS: BoardState = {
  ...BOARD,
  pawns: [
    {
      slot: 1,
      spaceId: 's01',
      x: 3.1,
      z: 1.9,
      character: 'raccoon',
      y: 1.2,
      hop: { from: 's01', to: 's04', t: 0.4, style: 'gust' },
      heading: 4.2,
      connected: true,
    },
    {
      slot: 2,
      spaceId: 's03',
      x: 6.4,
      z: 4.2,
      character: 'sock',
      y: 0.81,
      hop: { from: 's03', to: 's04', t: 0.35, style: 'walk' },
      heading: 0.24,
      connected: false,
    },
  ],
  popups: [
    {
      id: 11,
      kind: 'dice',
      slot: 2,
      spaceId: null,
      text: '5',
      tone: 'neutral',
      progress: 0.3,
      stack: 0,
      reaction: null,
    },
    {
      id: 12,
      kind: 'coins',
      slot: 1,
      spaceId: null,
      text: '−3',
      tone: 'bad',
      progress: 0.1,
      stack: 0,
      reaction: 'hit',
    },
    {
      id: 13,
      kind: 'trophy',
      slot: null,
      spaceId: 's05',
      text: 'Hier!',
      tone: 'gold',
      progress: 0.6,
      stack: 0,
      reaction: null,
    },
  ],
  hud: {
    ...HUD,
    banner: 'Ben ist dran!',
    bannerSlot: 2,
    status: {
      slot: 1,
      kind: 'reaction',
      text: 'Anna kann reagieren!',
      detail: null,
      countdown: '3 … 2 … 1',
    },
    tailwind: {
      lead: 'Wer bei den Trophäen hinten liegt, bekommt Münzen.',
      rows: [{ slot: 2, name: 'Ben', amount: '+4 Münzen' }],
    },
  },
  sounds: [
    {
      id: 3,
      name: 'dice',
      voices: [
        {
          wave: 'noise',
          freq: 0,
          delay: 0,
          attack: 0.002,
          duration: 0.04,
          gain: 0.26,
          filter: { type: 'bandpass', freq: 1900, q: 2 },
        },
        {
          wave: 'sine',
          freq: 210,
          freqEnd: 110,
          delay: 0.32,
          attack: 0.003,
          duration: 0.14,
          gain: 0.3,
        },
      ],
    },
  ],
};

const PLAYERS_IN_GAME: LobbyPlayer[] = [ANNA, { ...BEN, ready: true, character: 'sock' }];

/** Kleinstes Beispiel einer Geometrie (CHAOS-144): ein Quadrat 1 × 1 in der x/z-Ebene. */
const QUAD_GEOMETRY: MinigameGeometry = {
  id: 'g1',
  vertices: 4,
  positions: 'AAAAvwAAAAAAAAC/AAAAPwAAAAAAAAC/AAAAPwAAAAAAAAA/AAAAvwAAAAAAAAA/',
  normals: 'AH8AAH8AAH8AAH8A',
  indices: 'AAABAAIAAAACAAMA',
  wideIndices: false,
  extent: [1, 0, 1],
};

const MINIGAME_INFO: MinigameState['info'] = {
  title: 'Pudding-Gerangel',
  tagline: 'Wer bleibt auf dem wackelnden Pudding?',
  instructions: ['Schubst die anderen vom Pudding.', 'Kirschen geben Extra-Punkte.'],
  controls: { joystick: 'Laufen', a: 'Schubsen', b: null },
  scoreUnit: 'Punkte',
};

const MINIGAME_PLAY: MinigameState = {
  id: 'pudding-gerangel',
  stage: 'play',
  elapsedMs: 12_345,
  ready: true,
  info: MINIGAME_INFO,
  round: 3,
  repeat: false,
  countdown: null,
  camera: { pos: [0, 11.5, -13.5], target: [0, -1.3, 0.8], fov: 0.8, fovAxis: 'vertical' },
  backdrop: { halfX: 7.2, halfZ: 7.2, groundY: -3.3, surface: 'decke' },
  figures: [
    {
      slot: 1,
      character: 'raccoon',
      pos: [-2.1, 0, 1.3],
      rot: [0, 0.383, 0, 0.924],
      scale: [1, 1, 1],
      visible: true,
      anim: 'run',
      animSeq: 4,
    },
    {
      slot: 2,
      character: 'sock',
      pos: [1.7, 0, -0.4],
      rot: [0, -0.259, 0, 0.966],
      scale: [1, 1, 1],
      visible: true,
      anim: 'hit',
      animSeq: 2,
    },
  ],
  scoreboard: {
    seconds: 48,
    banner: 'Kirschenregen!',
    waiting: false,
    scores: [
      {
        slot: 1,
        name: 'Anna',
        character: 'Wusel',
        color: '#0072B2',
        symbol: '●',
        score: 3,
        status: null,
        connected: true,
      },
      {
        slot: 2,
        name: 'Ben',
        character: 'Socke Sigi',
        color: '#E69F00',
        symbol: '▲',
        score: 1,
        status: 'raus',
        connected: true,
      },
    ],
  },
  results: null,
  effects: [
    { seq: 7, kind: 'impact', pos: [0.4, 0.8, 1.1], color: null, strength: 1 },
    { seq: 8, kind: 'shake', pos: [0, 0, 0], color: null, strength: 0.3 },
    { seq: 9, kind: 'sparkle', pos: [0.2, 0.6, 2.9], color: '#E0233D', strength: 1 },
  ],
  geometry: [QUAD_GEOMETRY],
  geometryTotal: 1,
  // CHAOS-190: `ctx.fx.sound('hit', { volume: 0.5 })` aus dem Pudding-Gerangel.
  sounds: [
    {
      id: 41,
      name: 'hit',
      voices: [
        {
          wave: 'noise',
          freq: 0,
          attack: 0.002,
          duration: 0.09,
          gain: 0.15,
          filter: { type: 'lowpass', freq: 1400, freqEnd: 300 },
        },
        { wave: 'sine', freq: 190, freqEnd: 70, attack: 0.004, duration: 0.16, gain: 0.2 },
      ],
    },
  ],
  light: moodLight('mittag'),
  bodies: [
    {
      id: 'buehne#12',
      shape: 'cylinder',
      pos: [0, -0.25, 0],
      rot: [0, 0, 0, 1],
      size: [12, 0.5, 12],
      color: '#F4D35E',
      mesh: 'g1',
      finish: 'matt',
    },
    {
      id: 'kirsche#57',
      shape: 'sphere',
      pos: [0.2, 0.3, 2.9],
      rot: [0, 0, 0, 1],
      size: [0.6, 0.6, 0.6],
      color: '#D7263D',
      role: 'kirsche',
      key: '2',
      glow: '#3A0B11',
    },
    {
      id: 'kiste#61',
      shape: 'box',
      pos: [3.5, 0.5, 3.5],
      rot: [0.05, 0.2, -0.03, 0.978],
      size: [1, 1, 1],
      color: '#8D6E63',
      role: 'kirschfleck-vorwarnung',
      alpha: 0.4,
      twoSided: true,
    },
  ],
  hud: '48 s · Anna 3 · Ben 1',
};

/**
 * Finale (CHAOS-145): vier Spieler, Ben und Cleo gleichauf bei den Trophäen, die Münzen
 * entscheiden; Partie vorzeitig beendet. Hier der Siegerbildschirm, `final-tally` die Zählung.
 */
const FINALE_WINNER: FinaleState = {
  beat: 'winner',
  beatIndex: 6,
  progress: 1,
  done: true,
  elapsedMs: 16_600,
  winnerAtMs: 16_600,
  endedEarly: true,
  kicker: 'Partie vorzeitig beendet',
  title: 'Endstand',
  lead: 'Ben gewinnt!',
  cards: [
    {
      slot: 1,
      name: 'Anna',
      character: 'raccoon',
      characterName: 'Wusel',
      color: '#0072B2',
      symbol: '●',
      place: 3,
      badge: null,
      revealed: true,
      active: false,
      trophies: 1,
      coins: 9,
      placeShown: true,
    },
    {
      slot: 2,
      name: 'Ben',
      character: 'sock',
      characterName: 'Socke Sigi',
      color: '#E69F00',
      symbol: '▲',
      place: 1,
      badge: 'per Münzen',
      revealed: true,
      active: false,
      trophies: 2,
      coins: 14,
      placeShown: true,
    },
    {
      slot: 3,
      name: 'Cleo',
      character: 'robot',
      characterName: 'Schraubi',
      color: '#009E73',
      symbol: '■',
      place: 2,
      badge: 'per Münzen',
      revealed: true,
      active: false,
      trophies: 2,
      coins: 6,
      placeShown: true,
    },
    {
      slot: 4,
      name: 'Dana',
      character: 'cactus',
      characterName: 'Kalle Kaktus',
      color: '#CC79A7',
      symbol: '★',
      place: 4,
      badge: null,
      revealed: true,
      active: false,
      trophies: 0,
      coins: 21,
      placeShown: true,
    },
  ],
  winner: {
    headline: 'Ben gewinnt!',
    reason: 'Gleich viele Trophäen – die Münzen haben entschieden.',
    earlyNote: 'Vorzeitig beendet – es zählt der Stand von Runde 7/10',
    ranking: [
      {
        slot: 2,
        name: 'Ben',
        character: 'sock',
        characterName: 'Socke Sigi',
        color: '#E69F00',
        symbol: '▲',
        place: 1,
        badge: 'per Münzen',
        trophies: 2,
        coins: 14,
      },
      {
        slot: 3,
        name: 'Cleo',
        character: 'robot',
        characterName: 'Schraubi',
        color: '#009E73',
        symbol: '■',
        place: 2,
        badge: 'per Münzen',
        trophies: 2,
        coins: 6,
      },
      {
        slot: 1,
        name: 'Anna',
        character: 'raccoon',
        characterName: 'Wusel',
        color: '#0072B2',
        symbol: '●',
        place: 3,
        badge: null,
        trophies: 1,
        coins: 9,
      },
      {
        slot: 4,
        name: 'Dana',
        character: 'cactus',
        characterName: 'Kalle Kaktus',
        color: '#CC79A7',
        symbol: '★',
        place: 4,
        badge: null,
        trophies: 0,
        coins: 21,
      },
    ],
    awards: [
      {
        id: 'coin-magnet',
        title: 'Münzmagnet',
        detail: '31 Münzen eingesammelt',
        slots: [4],
        names: 'Dana',
      },
      {
        id: 'minigame-ace',
        title: 'Minispiel-Ass',
        detail: '3 Minispiele gewonnen',
        slots: [1, 2],
        names: 'Anna & Ben',
      },
      {
        id: 'globetrotter',
        title: 'Weltenbummler',
        detail: '58 Felder gelaufen',
        slots: [3],
        names: 'Cleo',
      },
    ],
  },
  podium: [
    {
      slot: 2,
      character: 'sock',
      color: '#E69F00',
      symbol: '▲',
      place: 1,
      x: 1.125,
      height: 1.5,
      blockColor: '#ffd75e',
      anim: 'cheer',
    },
    {
      slot: 3,
      character: 'robot',
      color: '#009E73',
      symbol: '■',
      place: 2,
      x: -1.125,
      height: 1,
      blockColor: '#e2e8ee',
      anim: 'jump',
    },
    {
      slot: 1,
      character: 'raccoon',
      color: '#0072B2',
      symbol: '●',
      place: 3,
      x: 3.375,
      height: 0.68,
      blockColor: '#eaa974',
      anim: 'jump',
    },
    {
      slot: 4,
      character: 'cactus',
      color: '#CC79A7',
      symbol: '★',
      place: 4,
      x: -3.375,
      height: 0.42,
      blockColor: '#cfc6f2',
      anim: 'sad',
    },
  ],
  canRematch: true,
  sounds: [
    {
      id: 9,
      name: 'win',
      voices: [{ wave: 'triangle', freq: 523, delay: 0, attack: 0.01, duration: 0.18, gain: 0.3 }],
      // Klang-Datei (CHAOS-223); Swift spielt sie, das Rezept ist der Rückfall.
      sample: { file: 'win-2.mp3', rate: 1, gain: 0.75 },
    },
  ],
};

/** Mitten in der Zählung: Cleo (Platz 2) wird gerade aufgedeckt, Münzen zählen noch. */
const FINALE_TALLY: FinaleState = {
  ...FINALE_WINNER,
  beat: 'reveal',
  beatIndex: 3,
  progress: 0.62,
  done: false,
  elapsedMs: 9_536,
  title: 'Die Trophäenzählung!',
  lead: 'Platz 2: Cleo',
  cards: FINALE_WINNER.cards.map((card) =>
    card.slot === 3
      ? { ...card, active: true, coins: 1, placeShown: false }
      : card.place < 2
        ? { ...card, revealed: false, trophies: 0, coins: 0, placeShown: false }
        : card,
  ),
  canRematch: false,
  sounds: [],
};

const PLAYERS_FINALE: LobbyPlayer[] = [
  ...PLAYERS_IN_GAME,
  { slot: 3, name: 'Cleo', color: '#009E73', connected: true, ready: true, character: 'robot' },
  { slot: 4, name: 'Dana', color: '#CC79A7', connected: false, ready: true, character: 'cactus' },
];

/** Pause (CHAOS-145): außerhalb der Partie weder Pause noch Rundentext. */
const NO_PAUSE: PauseState = { paused: false, canPause: false, roundText: null, sounds: [] };

/** `pause` passend zur Phase, falls ein Beispiel nichts Eigenes setzt. */
function pauseFor(example: ExampleBase): PauseState {
  const roundText = example.board
    ? `Runde ${String(example.board.round)}/${String(example.board.rounds)}`
    : null;
  switch (example.phase) {
    case 'board':
    case 'minigame':
      return { ...NO_PAUSE, canPause: true, roundText };
    case 'paused':
      return { ...NO_PAUSE, paused: true, roundText };
    case 'final':
      return { ...NO_PAUSE, roundText };
    default:
      return NO_PAUSE;
  }
}

/** Beispiele ohne die Felder, die fast immer gleich sind (`final`, `pause`, CHAOS-145). */
type ExampleBase = Omit<RenderState, 'final' | 'pause'> &
  Partial<Pick<RenderState, 'final' | 'pause'>>;

const EXAMPLES: Readonly<Record<string, ExampleBase>> = {
  'lobby-empty': {
    phase: 'lobby',
    lobby: { ...JOIN, players: [] },
    board: null,
    minigame: null,
  },
  'lobby-two-players': {
    phase: 'lobby',
    lobby: { ...JOIN, players: [ANNA, BEN] },
    board: null,
    minigame: null,
  },
  // CHAOS-166: 12 ist kein Vorschlag (die Lobby zeigt sie zusätzlich), der Schalter ist an.
  // CHAOS-197: Brett „Zufall“ gewählt.
  'lobby-settings': {
    phase: 'lobby',
    lobby: {
      ...JOIN,
      players: [ANNA, { ...BEN, ready: true, character: 'sock' }],
      settings: {
        ...SETTINGS,
        rounds: 12,
        moreReactionTime: true,
        board: 'zufall',
        boards: BOARD_CHOICES.map((choice) => ({ ...choice, selected: choice.random })),
      },
    },
    board: null,
    minigame: null,
  },
  board: {
    phase: 'board',
    lobby: { ...JOIN, players: PLAYERS_IN_GAME },
    board: BOARD,
    minigame: null,
  },
  'board-events': {
    phase: 'board',
    lobby: { ...JOIN, players: PLAYERS_IN_GAME },
    board: BOARD_EVENTS,
    minigame: null,
  },
  'board-disconnected-player': {
    phase: 'board',
    lobby: {
      ...JOIN,
      players: [ANNA, { ...BEN, connected: false, ready: true, character: 'sock' }],
    },
    board: {
      ...BOARD,
      activeSlot: 1,
      messages: [],
      pawns: BOARD.pawns.map((p) => (p.slot === 2 ? { ...p, connected: false } : p)),
    },
    minigame: null,
  },
  'board-sabotage-notice': {
    phase: 'board',
    lobby: { ...JOIN, players: PLAYERS_IN_GAME },
    board: {
      ...BOARD,
      round: 6,
      activeSlot: 1,
      // Rundenwechsel 5 → 6 mitten in der Überblendung Abend → Dämmerung (CHAOS-193).
      light: lightOf({
        from: 'abend',
        to: 'daemmerung',
        mix: 0.4,
        state: mixLightStates(
          lightStateOf(LIGHT_MOODS.abend),
          lightStateOf(LIGHT_MOODS.daemmerung),
          0.4,
        ),
      }),
      messages: ['Runde 6 beginnt!'],
      notice: { title: 'Sabotage wird stärker!', detail: 'Klau: 6 Münzen · Falle: 5 Münzen' },
    },
    minigame: null,
  },
  'minigame-intro': {
    phase: 'minigame',
    lobby: { ...JOIN, players: PLAYERS_IN_GAME },
    board: { ...BOARD, activeSlot: null },
    minigame: {
      ...MINIGAME_PLAY,
      stage: 'intro',
      elapsedMs: 0,
      bodies: [],
      hud: '',
      ready: false,
      repeat: true,
      countdown: 7,
      camera: null,
      figures: [],
      scoreboard: null,
      effects: [],
      geometry: [],
      geometryTotal: 0,
      // CHAOS-190: Das Minispiel erscheint in der Anleitung.
      sounds: [
        {
          id: 30,
          name: 'minigame-start',
          voices: [
            { wave: 'sine', freq: 300, freqEnd: 900, attack: 0.02, duration: 0.35, gain: 0.22 },
            { wave: 'triangle', freq: 784, delay: 0.3, attack: 0.008, duration: 0.14, gain: 0.18 },
            { wave: 'triangle', freq: 1046, delay: 0.4, attack: 0.008, duration: 0.45, gain: 0.2 },
          ],
        },
      ],
    },
  },
  // CHAOS-190: Countdown der Anleitung, Ticks bei 2 und 1 s (bei 1 s Tonhöhe × 1,25).
  'minigame-countdown': {
    phase: 'minigame',
    lobby: { ...JOIN, players: PLAYERS_IN_GAME },
    board: { ...BOARD, activeSlot: null },
    minigame: {
      ...MINIGAME_PLAY,
      stage: 'intro',
      elapsedMs: 0,
      hud: '',
      countdown: 1,
      scoreboard: null,
      effects: [],
      geometry: [],
      sounds: [
        {
          id: 32,
          name: 'tick',
          voices: [
            { wave: 'sine', freq: 740, freqEnd: 620, attack: 0.003, duration: 0.07, gain: 0.25 },
          ],
        },
        {
          id: 33,
          name: 'tick',
          voices: [
            { wave: 'sine', freq: 925, freqEnd: 775, attack: 0.003, duration: 0.07, gain: 0.25 },
          ],
        },
      ],
    },
  },
  // CHAOS-214: Anleitung wartet auf „Bereit“ – kein Countdown, Chips je Spieler.
  'minigame-ready': {
    phase: 'minigame',
    lobby: { ...JOIN, players: PLAYERS_FINALE },
    board: { ...BOARD, activeSlot: null },
    minigame: {
      ...MINIGAME_PLAY,
      stage: 'intro',
      elapsedMs: 0,
      hud: '',
      countdown: null,
      readiness: {
        headline: 'Alle bereit? Drückt „Bereit!“ auf dem Handy',
        players: [
          { slot: 1, name: 'Anna', character: 'Wusel', color: '#0072B2', symbol: '●', ready: true },
          {
            slot: 2,
            name: 'Ben',
            character: 'Socke Sigi',
            color: '#E69F00',
            symbol: '▲',
            ready: false,
          },
          {
            slot: 3,
            name: 'Cleo',
            character: 'Schraubi',
            color: '#009E73',
            symbol: '■',
            ready: true,
          },
          {
            slot: 4,
            name: 'Dana',
            character: 'Kalle Kaktus',
            color: '#CC79A7',
            symbol: '★',
            ready: false,
          },
        ].map((player) => {
          const connected = player.slot !== 4;
          const state = !connected ? 'disconnected' : player.ready ? 'ready' : 'waiting';
          const text = { ready: 'Bereit', waiting: 'Drückt Bereit …', disconnected: 'getrennt' };
          return { ...player, connected, state, text: text[state] } as const;
        }),
      },
      scoreboard: null,
      effects: [],
      geometry: [],
      sounds: [],
    },
  },
  'minigame-play': {
    phase: 'minigame',
    lobby: { ...JOIN, players: PLAYERS_IN_GAME },
    board: { ...BOARD, activeSlot: null },
    minigame: MINIGAME_PLAY,
  },
  'minigame-results': {
    phase: 'minigame',
    lobby: { ...JOIN, players: PLAYERS_IN_GAME },
    board: { ...BOARD, activeSlot: null },
    minigame: {
      ...MINIGAME_PLAY,
      stage: 'results',
      elapsedMs: 60_000,
      hud: '0 s · Anna 5 · Ben 2',
      scoreboard: null,
      geometry: [],
      effects: [{ seq: 12, kind: 'confetti', pos: [-2.1, 1.6, 1.3], color: null, strength: 1 }],
      // CHAOS-190: Jubel, wenn die Figuren im Ergebnis jubeln (`celebrate`).
      sounds: [
        {
          id: 58,
          name: 'cheer',
          voices: [
            {
              wave: 'noise',
              freq: 0,
              attack: 0.12,
              duration: 1,
              gain: 0.16,
              filter: { type: 'bandpass', freq: 900, freqEnd: 1300, q: 0.7 },
            },
            { wave: 'triangle', freq: 440, freqEnd: 660, attack: 0.04, duration: 0.45, gain: 0.14 },
            {
              wave: 'triangle',
              freq: 554,
              freqEnd: 830,
              delay: 0.18,
              attack: 0.04,
              duration: 0.5,
              gain: 0.12,
            },
          ],
        },
      ],
      figures: MINIGAME_PLAY.figures.map((figure) => ({
        ...figure,
        anim: figure.slot === 1 ? 'cheer' : 'sad',
        animSeq: figure.animSeq + 1,
      })),
      results: {
        aborted: false,
        headline: 'Anna gewinnt!',
        highlights: ['Anna schnappt sich 3 Kirschen.'],
        rows: [
          {
            slot: 1,
            name: 'Anna',
            character: 'Wusel',
            color: '#0072B2',
            symbol: '●',
            place: 1,
            tied: false,
            scoreText: '5 Punkte',
            coins: 10,
            prizes: [],
          },
          {
            slot: 2,
            name: 'Ben',
            character: 'Socke Sigi',
            color: '#E69F00',
            symbol: '▲',
            place: 2,
            tied: false,
            scoreText: '2 Punkte',
            coins: 3,
            prizes: ['Schild'],
          },
        ],
      },
    },
  },
  paused: {
    phase: 'paused',
    lobby: { ...JOIN, players: PLAYERS_IN_GAME },
    board: BOARD,
    minigame: null,
    pause: {
      paused: true,
      canPause: false,
      roundText: 'Runde 3/10',
      sounds: [
        {
          id: 4,
          name: 'pause',
          voices: [
            { wave: 'sine', freq: 660, freqEnd: 330, attack: 0.01, duration: 0.2, gain: 0.2 },
          ],
        },
      ],
    },
  },
  // CHAOS-145: Pause über einem laufenden Minispiel; die Anzeige des Minispiels bleibt stehen.
  'paused-minigame': {
    phase: 'paused',
    lobby: { ...JOIN, players: PLAYERS_IN_GAME },
    board: { ...BOARD, activeSlot: null },
    minigame: { ...MINIGAME_PLAY, geometry: [], effects: [], sounds: [] },
  },
  final: {
    phase: 'final',
    lobby: { ...JOIN, players: PLAYERS_FINALE },
    board: {
      ...BOARD,
      round: 7,
      activeSlot: null,
      messages: ['Ben gewinnt!'],
      light: moodLight('nacht'),
    },
    minigame: null,
    final: FINALE_WINNER,
  },
  'final-tally': {
    phase: 'final',
    lobby: { ...JOIN, players: PLAYERS_FINALE },
    board: { ...BOARD, round: 7, activeSlot: null, messages: ['Ben gewinnt!'] },
    minigame: null,
    final: FINALE_TALLY,
  },
};

/** Name (Dateiname ohne `.json`) → Beispiel. */
export const RENDER_STATE_EXAMPLES: Readonly<Record<string, RenderState>> = Object.fromEntries(
  Object.entries(EXAMPLES).map(([name, example]) => [
    name,
    { ...example, final: example.final ?? null, pause: example.pause ?? pauseFor(example) },
  ]),
);
