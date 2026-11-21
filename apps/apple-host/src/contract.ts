/**
 * Vertrag zwischen JS-Kern und Swift-App (ADR-019 §2, CHAOS-139). Menschenlesbar in
 * `../CONTRACT.md`; dies hier ist die Quelle der Wahrheit:
 *
 * - `HostEnv`, `ChaosHostApi`, `ChaosHostInstance`: was Swift hineingibt und aufruft.
 * - `RenderStateSchema`: was `renderState()` liefert. Streng (`strictObject`): Ein neues Feld muss
 *   hier eingetragen werden, sonst scheitert der Bündel-Test. Swift dekodiert nachsichtig
 *   (`apps/apple-host/app/RenderState.swift`) und prüft die Beispielnachrichten im Harness.
 *
 * Koordinaten sind roh aus Babylon/game-core: linkshändig, y oben, x rechts, z nach hinten.
 * RealityKit (rechtshändig) spiegelt z und die x/y-Anteile der Quaternion.
 */
import {
  BoardChoiceSchema,
  CHARACTER_IDS,
  MAX_BOARDS,
  MAX_ROUND_PRESETS,
  MINIGAME_STAGES,
  RoundsSchema,
} from '@chaos-party/protocol';
import { z } from 'zod';
import { LIGHT_MOOD_IDS } from '../../host/src/lighting/moods.ts';

// --- Swift → JS ------------------------------------------------------------------------------

export interface HostEnv {
  /** Text-Frame an eine Controller-Verbindung. */
  send(connId: number, text: string): void;
  close(connId: number, code: number, reason: string): void;
  log(line: string): void;
  /** Swift: `SecRandomCopyBytes`. Muss genau `n` Bytes liefern. */
  randomBytes(n: number): number[];
  /** Inhalt von `HavokPhysics.wasm`; am besten ohne Kopie als `Uint8Array`. */
  havokWasm: Uint8Array | number[];
  /** `http://<ip>:<port>/?code=<CODE>` für den QR-Code. */
  joinUrl: string;
  /** 4 Zeichen aus dem Alphabet von `apps/server/src/ids.ts`. */
  joinCode: string;
  /**
   * `true`: `host-ready` erst nach `sceneReady()` (die App lädt Brett und Figuren, CHAOS-142,
   * CHAOS-68). Fehlt der Wert, ist der Host sofort bereit (Harness, Tests, `--selftest`).
   */
  deferSceneReady?: boolean;
  /**
   * `true`: Regel Rückenwind an (CHAOS-188), wie `RUECKENWIND=1` am PC-Server (CHAOS-125,
   * EXP-022). Fehlt der Wert, bleibt sie aus (Standard bis zum Playtest). Swift setzt ihn mit
   * dem Startparameter `--rueckenwind` oder der Umgebungsvariable `RUECKENWIND=1`.
   */
  tailwind?: boolean;
  /**
   * Nur Tests und Nachstellen (CHAOS-206): Jede Minispiel-Bühne ist frühestens so viele ms nach
   * Beginn ihres Aufbaus fertig, wie auf einem gedrosselten Gerät. Fehlt der Wert, baut sie so
   * schnell wie möglich.
   */
  debugStageDelayMs?: number;
}

/** Host-Befehle, die `hostCommand` versteht (wie die Knöpfe am PC-Host). */
export const HOST_COMMANDS = ['start', 'pause', 'resume', 'end-game', 'rematch'] as const;
export type HostCommandName = (typeof HOST_COMMANDS)[number];

/**
 * Host-Befehle, die nur im Kern wirken und nie an den Server gehen (CHAOS-145):
 * `skip-finale` springt in der Trophäenzählung direkt zum Siegerbildschirm („Überspringen“).
 */
export const LOCAL_HOST_COMMANDS = ['skip-finale'] as const;
export type LocalHostCommandName = (typeof LOCAL_HOST_COMMANDS)[number];

/**
 * Lobby-Einstellungen über `hostCommand` (CHAOS-166), wie Rundenwahl und Schalter am PC-Host:
 * `configure:rounds=12`, `configure:moreReactionTime=1` (`0`/`1`/`true`/`false`),
 * `configure:board=wackelwald` (Brett-ID oder `zufall`, CHAOS-197) oder mehreres mit Komma:
 * `configure:rounds=12,moreReactionTime=1`. Runden 1–`MAX_ROUNDS`. Nur in der Lobby;
 * sonst und bei ungültigem Text loggt der Kern und sendet nichts. Ergebnis in
 * `renderState().lobby.settings`. Parser: `./hostCommand.ts`.
 */
export const CONFIGURE_PREFIX = 'configure:';

export interface ChaosHostInstance {
  /** Neue WebSocket-Verbindung an `/ws`. IDs > 0 (negative nutzt der Kern selbst). */
  open(connId: number): void;
  /** Eingehender Text-Frame. */
  message(connId: number, text: string): void;
  closed(connId: number): void;
  /**
   * ~60× pro s (Anzeige-Takt). Beliebige monotone ms-Uhr (`CACurrentMediaTime() * 1000`); der
   * Kern zählt ab dem ersten Aufruf von 0. Treibt Zeitgeber, Session-Fristen und die festen
   * 1/60-Schritte der Minispiele.
   */
  tick(nowMs: number): void;
  /** JSON nach `RenderStateSchema`; Swift ruft es je Bild nach `tick` auf. */
  renderState(): string;
  /**
   * Einer von `HOST_COMMANDS`, `LOCAL_HOST_COMMANDS` oder `configure:…` (`CONFIGURE_PREFIX`);
   * Unbekanntes wird geloggt und ignoriert. `pause`, `resume` und `rematch` gehen nur an den
   * Server, wenn sie gerade passen (`renderState().pause.canPause`, `pause.paused`, Finale);
   * sonst loggt der Kern „ignoriert“ (CHAOS-145).
   */
  hostCommand(cmd: string): void;
  /** Szene geladen (nur mit `env.deferSceneReady`): schickt `host-ready` (CHAOS-142). */
  sceneReady(): void;
}

/** `globalThis.ChaosHost` im Bündel. */
export interface ChaosHostApi {
  create(env: HostEnv): ChaosHostInstance;
}

/** `globalThis.ChaosHostInternals`: nur für Harness und Tests. */
export interface ChaosHostInternals {
  base64url(bytes: Uint8Array): string;
  /** Minispiele der Rotation; eine ganze Partie muss jedes davon aufbauen. */
  rotation: readonly string[];
  /**
   * Wartende Zeitgeber der virtuellen Uhr (CHAOS-141): wächst die Zahl über Partien, hält eine
   * Warteschlange entsorgte Szenen fest (vgl. CHAOS-126).
   */
  pendingTimers(): number;
}

// --- JS → Swift: renderState -----------------------------------------------------------------

export const CONTRACT_PHASES = ['lobby', 'board', 'minigame', 'final', 'paused'] as const;
export type ContractPhase = (typeof CONTRACT_PHASES)[number];

export const BODY_SHAPES = ['sphere', 'box', 'cylinder'] as const;
export type BodyShape = (typeof BODY_SHAPES)[number];

const slot = z.number().int().min(1).max(4);
const vec3 = z.tuple([z.number(), z.number(), z.number()]);
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const character = z.enum(CHARACTER_IDS);

export const LobbyPlayerSchema = z.strictObject({
  slot,
  name: z.string(),
  color: hexColor,
  connected: z.boolean(),
  ready: z.boolean(),
  character: character.nullable(),
});

/**
 * Lobby-Einstellungen der nächsten Partie (CHAOS-166, Brett CHAOS-197), der Server-Stand aus
 * `lobby.settings`;
 * ändern über `hostCommand('configure:…')`.
 */
export const LobbySettingsStateSchema = z.strictObject({
  /** Rundenzahl der nächsten Partie (1–`MAX_ROUNDS`). */
  rounds: RoundsSchema,
  /** Vorschläge für die Rundenwahl, aufsteigend (Server: 10, 16, 20). */
  roundPresets: z.array(RoundsSchema).min(1).max(MAX_ROUND_PRESETS),
  /** „Mehr Zeit zum Reagieren“ (CHAOS-124): Reaktionsfenster 5 s statt 3 s. */
  moreReactionTime: z.boolean(),
  /** Brett-Wahl (CHAOS-197): Brett-ID oder `zufall`; ändern über `configure:board=<id>`. */
  board: BoardChoiceSchema,
  /**
   * Knöpfe der Brett-Auswahl in Lobby-Reihenfolge, zuletzt „Zufall“ (`boardOptions` aus
   * `apps/host/src/lobby/lobbyState.ts`); genau einer ist gewählt.
   */
  boards: z
    .array(
      z.strictObject({
        id: BoardChoiceSchema,
        /** „Wackelwald“, „Zufall“. */
        name: z.string(),
        /** Zweite Zeile: „74 Felder“, „Überraschung!“. */
        detail: z.string(),
        selected: z.boolean(),
        random: z.boolean(),
      }),
    )
    .max(MAX_BOARDS + 1),
});

export const BoardSpaceSchema = z.strictObject({
  id: z.string(),
  x: z.number(),
  z: z.number(),
  /** `SpaceKind` aus game-core (`start`, `coins-plus`, `coins-minus`, `event`, `item`, `trophy`). */
  kind: z.string(),
});

/** Wie eine Figur zum Ziel kommt (CHAOS-52): `walk` hüpft, `gust`/`swap` fliegen. */
export const MOVE_STYLES = ['walk', 'gust', 'swap'] as const;

export const PawnHopSchema = z.strictObject({
  from: z.string(),
  to: z.string(),
  /** Fortschritt des laufenden Sprungs bzw. Flugs 0…1. */
  t: z.number().min(0).max(1),
  style: z.enum(MOVE_STYLES),
});

export const PawnSchema = z.strictObject({
  slot,
  /** Feld, auf dem die Figur steht; beim Hüpfen und Fliegen das Feld, von dem sie abspringt. */
  spaceId: z.string(),
  /**
   * Gezeigte Lage aus der Brett-Regie (CHAOS-143): im Stand Feldmitte plus Versatz
   * (`spreadPawns`), beim Hüpfen und Fliegen der Punkt auf der Bahn (`hopPoint`/`flightPoint`).
   */
  x: z.number(),
  z: z.number(),
  character,
  /** Höhe über der Feldoberfläche (Sprung- bzw. Flugbogen), im Stand 0. */
  y: z.number(),
  /** Laufender Sprung oder Flug, sonst `null`. */
  hop: PawnHopSchema.nullable(),
  /**
   * Blickrichtung (Babylon: Drehung um y, `atan2(dx, dz)`): beim Hüpfen die Laufrichtung (weich
   * hindrehen), im Flug samt Drehung um sich selbst (direkt setzen); im Stand `null` (zur Kamera).
   */
  heading: z.number().nullable(),
  connected: z.boolean(),
});

export const POPUP_KINDS = [
  'coins',
  'dice',
  'item',
  'trap',
  'trophy',
  'event',
  'shield',
  'steal',
] as const;
export const MESSAGE_TONES = ['good', 'bad', 'neutral', 'gold'] as const;
/** Einmal-Reaktionen der Figur auf ein Popup über ihr (Clips aus `clips.json`). */
export const PAWN_REACTIONS = ['cheer', 'hit', 'jump'] as const;

export const PopupSchema = z.strictObject({
  /** Eindeutig, solange das Popup lebt (`POPUP_MS` = 1,4 s). */
  id: z.number().int(),
  kind: z.enum(POPUP_KINDS),
  /** Über dieser Figur … */
  slot: slot.nullable(),
  /** … oder über diesem Feld (wenn `slot` `null` ist). */
  spaceId: z.string().nullable(),
  /** Kurzer Text (≤ 12 Zeichen), z. B. „+3“, „5“, „Falle!“. */
  text: z.string(),
  tone: z.enum(MESSAGE_TONES),
  /** 0 beim Erscheinen … 1 beim Verschwinden. */
  progress: z.number().min(0).max(1),
  /**
   * Stapelebene (CHAOS-189): 0 = unten; gleichzeitige Popups über derselben Stelle werden um
   * `stack × POPUP_STACK_HEIGHT` (1,4) entlang der Bildschirm-Senkrechten versetzt.
   */
  stack: z.number().int().min(0),
  /** Reaktion der Figur `slot` (einmal je Popup), wie `reactionFor` im Babylon-Host. */
  reaction: z.enum(PAWN_REACTIONS).nullable(),
});

export const TickerEntrySchema = z.strictObject({
  id: z.number().int(),
  text: z.string(),
  /** Färbt die Meldung (Spielerfarbe); `null` = neutral. */
  slot: slot.nullable(),
  tone: z.enum(MESSAGE_TONES),
});

export const HudPlayerSchema = z.strictObject({
  slot,
  name: z.string(),
  color: hexColor,
  coins: z.number().int(),
  trophies: z.number().int(),
  /** `ItemKind` aus game-core und Anzeigename (`ITEM_NAMES`). */
  items: z.array(z.strictObject({ id: z.string(), name: z.string() })),
  connected: z.boolean(),
  active: z.boolean(),
});

export const HudSchema = z.strictObject({
  /** Name des Bretts („Wackelwald“). */
  boardName: z.string(),
  /** „Runde 2/10“ (`roundText`) aus dem gezeigten Stand. */
  roundText: z.string(),
  /** Großes Banner „Anna ist dran!“ (`bannerText`) oder `null`. */
  banner: z.string().nullable(),
  bannerSlot: slot.nullable(),
  /** Statuszeile zur offenen Entscheidung (`promptStatus`/`promptDetail`/`countdownText`). */
  status: z
    .strictObject({
      slot,
      kind: z.string(),
      text: z.string(),
      detail: z.string().nullable(),
      /** „3 … 2 … 1“ nur im Reaktionsfenster, sonst `null`. */
      countdown: z.string().nullable(),
    })
    .nullable(),
  /** Spielerleiste unten, nach Slot sortiert; Münzen schon um gespielte Ereignisse aktualisiert. */
  players: z.array(HudPlayerSchema),
  /** Rückenwind-Karte im Rundenende (CHAOS-125) oder `null`. */
  tailwind: z
    .strictObject({
      lead: z.string(),
      rows: z.array(z.strictObject({ slot, name: z.string(), amount: z.string() })),
    })
    .nullable(),
});

export const SOUND_WAVES = ['sine', 'triangle', 'square', 'sawtooth', 'noise'] as const;

/** Eine Stimme eines prozeduralen Klangs (`apps/host/src/fx/sounds.ts`), Zeiten in s. */
export const SoundVoiceSchema = z.strictObject({
  wave: z.enum(SOUND_WAVES),
  freq: z.number(),
  freqEnd: z.number().optional(),
  delay: z.number().optional(),
  attack: z.number(),
  duration: z.number(),
  gain: z.number(),
  filter: z
    .strictObject({
      type: z.enum(['lowpass', 'bandpass', 'highpass']),
      freq: z.number(),
      freqEnd: z.number().optional(),
      q: z.number().optional(),
    })
    .optional(),
});

export const SoundCueSchema = z.strictObject({
  /** Steigt je Klang; Swift spielt jede ID einmal. */
  id: z.number().int(),
  /** `SoundName` aus `apps/host/src/fx/sounds.ts`. */
  name: z.string(),
  /** Rezept mit Lautstärke und Tonhöhe schon angewandt (`shapeRecipe`); Rückfall ohne Datei. */
  voices: z.array(SoundVoiceSchema),
  /**
   * Klang-Datei (CHAOS-223, `apps/host/src/fx/samples.ts`): Name unter `payload/sounds/`,
   * Abspiel-Rate (Tonhöhe samt Streuung) und Lautstärke 0…2. Fehlt sie oder liegt die Datei
   * nicht im Bündel, spielt Swift das Rezept.
   */
  sample: z.strictObject({ file: z.string(), rate: z.number(), gain: z.number() }).optional(),
});

export const NoticeSchema = z.strictObject({
  title: z.string(),
  detail: z.string(),
});

/**
 * Lichtstimmung (CHAOS-193): `LightState` aus `apps/host/src/lighting/transition.ts`, im Kern
 * aus `LIGHT_MOODS` gerechnet (`./lightMood.ts`) und beim Rundenwechsel über 4 s gemischt wie im
 * Browser-Host. Farben sRGB. Swift setzt Sonne, Himmelslicht, Klarfarbe und Laternen danach.
 */
export const LightSchema = z.strictObject({
  /** Ziel- bzw. aktuelle Stimmung (`LightMoodId`). */
  mood: z.enum(LIGHT_MOOD_IDS),
  /** Sonne (nachts Mond): Babylon-Intensität, Farbe, Höhe (Sinus der Elevation). */
  keyIntensity: z.number().min(0),
  keyTint: hexColor,
  keyElevation: z.number().min(0).max(1),
  /** Umgebungslicht des Himmels (HDRI im Browser-Host). */
  skyIntensity: z.number().min(0),
  /** Bodenlicht (Hemisphäre): Stärke, Himmels- und Bodenfarbe. */
  fillIntensity: z.number().min(0),
  fillSky: hexColor,
  fillGround: hexColor,
  /**
   * Himmelslicht-Umgebung: Stimmung, deren Umgebung gerade gilt (Browser-Host wechselt sie zur
   * Hälfte der Überblendung), mit deren reinen Bodenlicht-Farben und Stärken (Swift baut sie je
   * Stimmung einmal).
   */
  environment: z.strictObject({
    mood: z.enum(LIGHT_MOOD_IDS),
    sky: hexColor,
    ground: hexColor,
    /** Stärken dieser Stimmung (HDRI und Bodenlicht), für die Form der Umgebung. */
    skyIntensity: z.number().min(0),
    fillIntensity: z.number().min(0),
  }),
  /** Dunst: Klarfarbe und Horizont. */
  haze: hexColor,
  /** Belichtung der Farbabstimmung (Babylon `exposure`). */
  exposure: z.number().min(0),
  /** Laternen an (0…1, Glas leuchtet ab 0,25), Farbe, Lichtstärke (Babylon) und Reichweite. */
  lampsOn: z.number().min(0).max(1),
  lanternColor: hexColor,
  lanternIntensity: z.number().min(0),
  lanternRange: z.number().min(0),
  /** Farbe der Grasspitzen der Zielstimmung. */
  grassTip: hexColor,
});

export const BoardStateSchema = z.strictObject({
  /**
   * Gespieltes Brett (CHAOS-212): ID aus dem Brett-Register, schon aufgelöst (unbekannte ID →
   * Standardbrett). Swift lädt danach die Kulisse `bretter/<boardId>/`.
   */
  boardId: z.string(),
  round: z.number().int().min(1),
  rounds: z.number().int().min(1),
  activeSlot: slot.nullable(),
  spaces: z.array(BoardSpaceSchema),
  pawns: z.array(PawnSchema),
  /** Die letzten Ereignistexte (höchstens `MAX_MESSAGES`), älteste zuerst. */
  messages: z.array(z.string()),
  /**
   * Große Einblendung oben mittig (CHAOS-157), z. B. „Sabotage wird stärker!“ /
   * „Klau: 6 Münzen · Falle: 5 Münzen“ in Wachstumsrunden; 4 s sichtbar, sonst `null`.
   */
  notice: NoticeSchema.nullable(),
  /** Popups über Figuren und Feldern (Münzen, Würfel, Items …) aus der Brett-Regie (CHAOS-143). */
  popups: z.array(PopupSchema),
  /** Ereignis-Ticker der Regie: höchstens 4, je 5 s, mit Ton und Spielerfarbe. */
  ticker: z.array(TickerEntrySchema),
  /** HUD-Daten aus dem gezeigten Stand der Regie. */
  hud: HudSchema.nullable(),
  /**
   * Kamera-Pose aus der gemeinsamen Regie (`apps/host/src/board/camera.ts`, CHAOS-194):
   * Standort und Blickpunkt in Babylon-Koordinaten, schon nachgezogen. Swift setzt sie nur.
   */
  camera: z.strictObject({ pos: vec3, target: vec3 }),
  /** Felder mit Trophäe (Pokal sichtbar). */
  trophySpaces: z.array(z.string()),
  /** Versteckte Fallen samt Besitzer (Mitte in Besitzerfarbe). */
  traps: z.array(z.strictObject({ spaceId: z.string(), owner: slot })),
  /** Klänge der letzten `SOUND_WINDOW_MS`, in dem Moment ausgelöst, in dem die Regie spielt. */
  sounds: z.array(SoundCueSchema),
  /** Lichtstimmung der gezeigten Runde, beim Rundenwechsel überblendet (CHAOS-193). */
  light: LightSchema,
  /**
   * Fahrgeschäfte der Kulisse (CHAOS-199, `apps/host/src/board/rides.ts`): Knoten im USDZ
   * (`karussell_dreh`, `riesenrad_rad`), Drehachse und Winkel in Babylon-Koordinaten (rad). Der
   * Knoten steht im Export in Ruhe; Swift dreht ihn um `angle` um die Weltachse `axis`, relativ
   * zur Ruhelage (Vorzeichen am Mac geprüft). Leer auf Brettern ohne Fahrgeschäfte.
   */
  rides: z.array(z.strictObject({ node: z.string(), axis: z.enum(['y', 'z']), angle: z.number() })),
});

/** Oberflächen aus `look.material` (`LookFinish` im minigame-sdk, CHAOS-62). */
export const MATERIAL_FINISHES = ['matt', 'lack', 'glanz', 'metall', 'stoff'] as const;

export const BodySchema = z.strictObject({
  /** `<Mesh-Name>#<uniqueId>`, stabil solange das Mesh lebt. */
  id: z.string(),
  shape: z.enum(BODY_SHAPES),
  /** Weltmitte der Bounding-Box. */
  pos: vec3,
  /** Weltrotation als Quaternion (x, y, z, w). */
  rot: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  /** Lokale Ausdehnung × Skalierung (vor der Rotation). */
  size: vec3,
  color: hexColor,
  /**
   * Geometrie aus `minigame.geometry` (CHAOS-144). Skalierung = `size` / `extent` der Geometrie
   * je Achse (Achse ohne Ausdehnung: 1). Fehlt sie oder ist sie noch nicht angekommen, zeichnet
   * Swift die Grundform `shape`.
   */
  mesh: z.string().optional(),
  /** Darstellungs-Rolle (`markVisual`, CHAOS-149); fehlt = Kulisse des Minispiels. */
  role: z.string().optional(),
  /** Schlüssel der Rolle (Slot, laufende Nummer). */
  key: z.string().optional(),
  /** Deckkraft (Material × Sichtbarkeit), nur wenn kleiner 1. */
  alpha: z.number().min(0).max(1).optional(),
  /** Eigenleuchten, nur wenn nicht schwarz. */
  glow: hexColor.optional(),
  /** Oberfläche aus `look.material`; fehlt = `lack`. */
  finish: z.enum(MATERIAL_FINISHES).optional(),
  /** Beide Seiten zeichnen (`backFaceCulling = false`). */
  twoSided: z.boolean().optional(),
});

/**
 * Geometrie eines Minispiel-Meshes (CHAOS-144), einmal je Minispiel. Base64 (Standard, mit
 * Auffüllung) der rohen Bytes, little-endian: `positions` Float32 × 3, um die Mitte der lokalen
 * Bounding-Box verschoben; `normals` Int8 × 3 (÷ 127); `indices` Uint16 (`wideIndices`:
 * Uint32), je drei ein Dreieck. Koordinaten roh aus Babylon (linkshändig).
 */
export const MinigameGeometrySchema = z.strictObject({
  id: z.string(),
  vertices: z.number().int().min(3),
  positions: z.string(),
  normals: z.string(),
  indices: z.string(),
  wideIndices: z.boolean(),
  /** Kantenlängen der lokalen Bounding-Box (Bezug für `size` der Körper). */
  extent: vec3,
});

/** Figur eines Spielers im Minispiel; Swift zeichnet das USDZ der Figur (CHAOS-140). */
export const MinigameFigureSchema = z.strictObject({
  slot,
  character,
  /** Welt-Lage des Figuren-Wurzelknotens (Füße), Rotation (x, y, z, w), Skalierung. */
  pos: vec3,
  rot: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  scale: vec3,
  visible: z.boolean(),
  /** Zuletzt gespielte Animation (`CHARACTER_ANIMATIONS`). */
  anim: z.string(),
  /** Zählt bei jedem `play` hoch: gleiche Animation zweimal heißt zweimal abspielen. */
  animSeq: z.number().int().min(0),
});

export const MinigameCameraSchema = z.strictObject({
  pos: vec3,
  target: vec3,
  /** Öffnungswinkel in Radiant. */
  fov: z.number(),
  /** Achse, auf die sich `fov` bezieht (Babylon: `fovMode`). */
  fovAxis: z.enum(['vertical', 'horizontal']),
});

/** `LookArea` aus `look.backdrop` (CHAOS-62): freie Spielfläche um den Ursprung. */
export const MinigameBackdropSchema = z.strictObject({
  halfX: z.number(),
  halfZ: z.number(),
  groundY: z.number(),
  surface: z.enum(['wiese', 'decke']),
});

/** Effekt aus `ctx.fx`: Partikel-Ausbruch (`VfxId`) oder Kamerawackeln (`shake`). */
export const MinigameEffectSchema = z.strictObject({
  /** Fortlaufend je Minispiel; Swift spielt jede Nummer einmal. */
  seq: z.number().int().min(1),
  kind: z.string(),
  pos: vec3,
  color: hexColor.nullable(),
  /** Stärke 0–1 (nur `shake`). */
  strength: z.number(),
});

export const MinigameControlsSchema = z.strictObject({
  joystick: z.string().nullable(),
  a: z.string().nullable(),
  b: z.string().nullable(),
});

/** Steckbrief für Anleitung und HUD (`MinigameInfo`). */
export const MinigameInfoSchema = z.strictObject({
  title: z.string(),
  tagline: z.string(),
  instructions: z.array(z.string()),
  controls: MinigameControlsSchema,
  scoreUnit: z.string(),
});

const playerLabel = {
  slot,
  name: z.string(),
  /** Anzeigename der Figur („Wusel“). */
  character: z.string(),
  color: hexColor,
  /** Slot-Symbol (●, ▲, ■, ★), immer zusätzlich zur Farbe. */
  symbol: z.string(),
};

export const MinigameScoreSchema = z.strictObject({
  ...playerLabel,
  score: z.number(),
  /** Kurzer Zustand aus dem HUD („raus“), bei Trennung „⚠ getrennt“. */
  status: z.string().nullable(),
  connected: z.boolean(),
});

export const MinigameScoreboardSchema = z.strictObject({
  /** Ganze Restsekunden. */
  seconds: z.number().int().min(0),
  banner: z.string().nullable(),
  /** Restzeit zu kurz für einen Neustart nach Host-Neuladen: Server wertet aus. */
  waiting: z.boolean(),
  scores: z.array(MinigameScoreSchema),
});

export const MinigameResultRowSchema = z.strictObject({
  ...playerLabel,
  place: z.number().int().min(1),
  tied: z.boolean(),
  /** „7 Socken“ */
  scoreText: z.string(),
  /** Gewonnene Münzen; `null` = unbekannt. */
  coins: z.number().int().nullable(),
  /** Trostpreis-Items (Anzeigenamen, CHAOS-51). */
  prizes: z.array(z.string()),
});

/** Ein Spieler in der Bereitschaft der Anleitung (CHAOS-214). */
export const MinigameReadyPlayerSchema = z.strictObject({
  ...playerLabel,
  /** Hat auf dem Handy „Bereit!“ gedrückt. */
  ready: z.boolean(),
  connected: z.boolean(),
  /** Anzeige: getrennt geht vor bereit (zählt beim Server als bereit), sonst wartend. */
  state: z.enum(['ready', 'waiting', 'disconnected']),
  /** „Bereit“, „Drückt Bereit …“ bzw. „getrennt“. */
  text: z.string(),
});

/** `introReadiness` aus `apps/host/src/minigame/readiness.ts` (CHAOS-214). */
export const MinigameReadinessSchema = z.strictObject({
  /** „Alle bereit? Drückt „Bereit!“ auf dem Handy“ */
  headline: z.string(),
  players: z.array(MinigameReadyPlayerSchema),
});

/** `resultsDisplay` aus `apps/host/src/minigame/results.ts`. */
export const MinigameResultsSchema = z.strictObject({
  aborted: z.boolean(),
  headline: z.string(),
  rows: z.array(MinigameResultRowSchema),
  highlights: z.array(z.string()),
});

export const MinigameStateSchema = z.strictObject({
  id: z.string(),
  stage: z.enum(MINIGAME_STAGES),
  elapsedMs: z.number().min(0),
  bodies: z.array(BodySchema),
  /** Kurzfassung als eine Zeile (Debug-Anzeige). */
  hud: z.string(),
  /** Bühne aufgebaut (Szene steht, Körper und Geometrie kommen). */
  ready: z.boolean(),
  info: MinigameInfoSchema,
  /** Runde der Partie, in der das Minispiel läuft. */
  round: z.number().int().min(1),
  /** Lief in der Partie schon: kurze Anleitung (CHAOS-66). */
  repeat: z.boolean(),
  /**
   * Intro: ganze Sekunden bis zum Start, sonst `null`. Auch `null`, wenn die Anleitung auf
   * „Bereit“ wartet (`readiness`, CHAOS-214): Dann gibt es keinen festen Start.
   */
  countdown: z.number().int().min(0).nullable(),
  /**
   * CHAOS-214 (optional): Intro wartet auf „Bereit“ aller verbundenen Spieler; statt des
   * Countdowns zeigt Swift diese Chips. Fehlt oder `null` = feste Anleitungszeit.
   */
  readiness: MinigameReadinessSchema.nullable().optional(),
  camera: MinigameCameraSchema.nullable(),
  backdrop: MinigameBackdropSchema.nullable(),
  figures: z.array(MinigameFigureSchema),
  /** Nur im Spiel. */
  scoreboard: MinigameScoreboardSchema.nullable(),
  /** Nur im Ergebnis. */
  results: MinigameResultsSchema.nullable(),
  /** Effekte der letzten Sekunden (Swift spielt neue `seq`). */
  effects: z.array(MinigameEffectSchema),
  /**
   * Neue Geometrie seit dem letzten `renderState` (in Stücken, höchstens etwa 256 KB je Aufruf).
   * Jeder Eintrag kommt genau einmal; Swift sammelt sie je Minispiel.
   */
  geometry: z.array(MinigameGeometrySchema),
  /** So viele Geometrien kennt die Bühne bisher (ausgeliefert oder wartend). */
  geometryTotal: z.number().int().min(0),
  /**
   * Klänge der letzten `SOUND_WINDOW_MS` (CHAOS-190), wie im Browser-Host: `ctx.fx.sound` des
   * Minispiels, „minigame-start“ und Countdown-„tick“ in der Anleitung, „cheer“ im Ergebnis. IDs
   * steigen über die Lebenszeit des Kerns; Swift spielt jede ID einmal.
   */
  sounds: z.array(SoundCueSchema),
  /** Lichtstimmung der Runde des Minispiels, ohne Überblendung (CHAOS-193). */
  light: LightSchema,
});

// --- Finale und Pause (CHAOS-145) -------------------------------------------------------------

/** Abschnitte des Finales (`FinaleBeat` aus `apps/host/src/finale/finalePlan.ts`). */
export const FINALE_BEATS = ['intro', 'reveal', 'tiebreak', 'winner'] as const;

const finalePlayer = {
  slot,
  name: z.string(),
  /** Figur (USDZ auf dem Podest, Porträt in Karten und Rangliste). */
  character,
  /** Anzeigename der Figur („Wusel“). */
  characterName: z.string(),
  color: hexColor,
  /** Slot-Symbol (●, ▲, ■, ★), immer zusätzlich zur Farbe. */
  symbol: z.string(),
};

/** Karte der Trophäenzählung (`FinaleCard`), Werte schon hochgezählt. */
export const FinaleCardSchema = z.strictObject({
  ...finalePlayer,
  place: z.number().int().min(1),
  /** „per Münzen“, „per Minispiel-Siegen“, „geteilt“ (`CRITERION_BADGE`) oder `null`. */
  badge: z.string().nullable(),
  /** Aufgedeckt (oder gerade im Aufdecken). */
  revealed: z.boolean(),
  /** Gerade dran. */
  active: z.boolean(),
  trophies: z.number().int().min(0),
  coins: z.number().int().min(0),
  /** Platz als Stempel sichtbar. */
  placeShown: z.boolean(),
});

/** Zeile des Endstands am Siegerbildschirm (nach Platz, dann Slot). */
export const FinaleRankSchema = z.strictObject({
  ...finalePlayer,
  place: z.number().int().min(1),
  badge: z.string().nullable(),
  trophies: z.number().int().min(0),
  coins: z.number().int().min(0),
});

/** Bonus-Titel (`bonusAwards`, höchstens drei). */
export const FinaleAwardSchema = z.strictObject({
  /** `AwardId` (`coin-magnet`, `minigame-ace`, …). */
  id: z.string(),
  title: z.string(),
  /** „17 Münzen eingesammelt“ */
  detail: z.string(),
  slots: z.array(slot),
  /** Namen der Träger, mit „ & “ verbunden. */
  names: z.string(),
});

/**
 * Ein Platz auf dem Siegerpodest (`apps/host/src/finale/podiumLayout.ts`): Block der Höhe
 * `height` bei `x` (Babylon-Koordinaten, Kamera blickt von −z), Deckel in Slot-Farbe, Figur oben.
 */
export const PodiumEntrySchema = z.strictObject({
  slot,
  character,
  color: hexColor,
  symbol: z.string(),
  place: z.number().int().min(1),
  x: z.number(),
  height: z.number().positive(),
  /** Farbstich des Holzblocks (Gold, Silber, Bronze, Lila). */
  blockColor: hexColor,
  /** Clip der Figur: Platz 1 `cheer`, letzter Platz `sad`, sonst `jump` (wie `celebrate`). */
  anim: z.enum(['cheer', 'sad', 'jump']),
});

/** Siegerbildschirm: Endstand, Begründung, Bonus-Titel. */
export const FinaleWinnerSchema = z.strictObject({
  /** „Anna gewinnt!“ bzw. „Anna & Ben gewinnen!“ (`winnerText`). */
  headline: z.string(),
  /** Begründung, wenn der Sieg nicht über die Trophäen fiel (`winnerReason`), sonst `null`. */
  reason: z.string().nullable(),
  /** „Vorzeitig beendet – es zählt der Stand von Runde 4/10“ oder `null`. */
  earlyNote: z.string().nullable(),
  ranking: z.array(FinaleRankSchema),
  awards: z.array(FinaleAwardSchema),
});

/**
 * Finale (CHAOS-145): Trophäenzählung und Siegerbildschirm wie `Finale.tsx` im Browser-Host.
 * Der Ablauf (`finalePlan.ts`) läuft als Zeitfunktion im Kern (`src/finaleView.ts`); Swift
 * zeichnet Karten bzw. Podest, Endstand und Bonus-Titel und spielt `sounds`.
 */
export const FinaleStateSchema = z.strictObject({
  beat: z.enum(FINALE_BEATS),
  beatIndex: z.number().int().min(0),
  /** Fortschritt im aktuellen Abschnitt 0…1 (Sieger: 1). */
  progress: z.number().min(0).max(1),
  /** Siegerbildschirm erreicht (bleibt stehen bis zur Revanche). */
  done: z.boolean(),
  /** ms seit Beginn des Finales (nach `skip-finale`: `winnerAtMs`). */
  elapsedMs: z.number().min(0),
  /** Ab hier steht der Siegerbildschirm. */
  winnerAtMs: z.number().min(0),
  endedEarly: z.boolean(),
  /** „Spielende“ bzw. „Partie vorzeitig beendet“. */
  kicker: z.string(),
  /** Titel und Zeile der Trophäenzählung (Gleichstand-Ansage im Abschnitt `tiebreak`). */
  title: z.string(),
  lead: z.string(),
  /** Karten der Zählung in Slot-Reihenfolge. */
  cards: z.array(FinaleCardSchema),
  winner: FinaleWinnerSchema,
  /** Podest nach Platz (dann Slot); steht schon in der Zählung, damit Swift es vorab bauen kann. */
  podium: z.array(PodiumEntrySchema),
  /** „Nochmal spielen“ möglich (Siegerbildschirm, Host verbunden): `hostCommand('rematch')`. */
  canRematch: z.boolean(),
  /** Klänge des Finales der letzten 1,5 s (`finaleCues`), eigene IDs ab 1 je Finale. */
  sounds: z.array(SoundCueSchema),
});

/**
 * Pause (CHAOS-145) wie `PauseControls` im Browser-Host. Maßgeblich ist der Server-Stand
 * (`view.paused`); Pausieren geht im Brett und im Minispiel, nicht vor dem Start und nicht im
 * Finale (`canPause`).
 */
export const PauseStateSchema = z.strictObject({
  /** Partie pausiert (auch über einem Minispiel: `phase` ist dann `paused`, `minigame` bleibt). */
  paused: z.boolean(),
  /** `hostCommand('pause')` wirkt gerade (Fernbedienung, P/Esc, Knopf). */
  canPause: z.boolean(),
  /** „Runde 3/10“ für die Pausenkarte; `null` außerhalb der Partie. */
  roundText: z.string().nullable(),
  /** `pause`- bzw. `resume`-Klang beim Wechsel der letzten 1,5 s; IDs steigen über die App-Laufzeit. */
  sounds: z.array(SoundCueSchema),
});

export const RenderStateSchema = z.strictObject({
  phase: z.enum(CONTRACT_PHASES),
  lobby: z.strictObject({
    joinUrl: z.string(),
    joinCode: z.string(),
    players: z.array(LobbyPlayerSchema),
    /** `null`, bis die Host-Rolle die erste `lobby`-Nachricht hat (CHAOS-166). */
    settings: LobbySettingsStateSchema.nullable(),
  }),
  board: BoardStateSchema.nullable(),
  minigame: MinigameStateSchema.nullable(),
  /** Finale (Phase `final`), sonst `null` (CHAOS-145). */
  final: FinaleStateSchema.nullable(),
  /** Pause und ob sie gerade möglich ist; immer da (CHAOS-145). */
  pause: PauseStateSchema,
});

export type LobbyPlayer = z.infer<typeof LobbyPlayerSchema>;
export type LobbySettingsState = z.infer<typeof LobbySettingsStateSchema>;
export type Notice = z.infer<typeof NoticeSchema>;
export type Pawn = z.infer<typeof PawnSchema>;
export type Popup = z.infer<typeof PopupSchema>;
export type TickerEntry = z.infer<typeof TickerEntrySchema>;
export type Hud = z.infer<typeof HudSchema>;
export type SoundCue = z.infer<typeof SoundCueSchema>;
export type BoardState = z.infer<typeof BoardStateSchema>;
export type Light = z.infer<typeof LightSchema>;
export type Body = z.infer<typeof BodySchema>;
export type MinigameState = z.infer<typeof MinigameStateSchema>;
export type MaterialFinish = (typeof MATERIAL_FINISHES)[number];
export type MinigameGeometry = z.infer<typeof MinigameGeometrySchema>;
export type MinigameFigure = z.infer<typeof MinigameFigureSchema>;
export type MinigameCamera = z.infer<typeof MinigameCameraSchema>;
export type MinigameBackdrop = z.infer<typeof MinigameBackdropSchema>;
export type MinigameEffect = z.infer<typeof MinigameEffectSchema>;
export type MinigameInfoView = z.infer<typeof MinigameInfoSchema>;
export type MinigameScoreboard = z.infer<typeof MinigameScoreboardSchema>;
export type MinigameResults = z.infer<typeof MinigameResultsSchema>;
export type MinigameReadiness = z.infer<typeof MinigameReadinessSchema>;
export type FinaleCard = z.infer<typeof FinaleCardSchema>;
export type FinaleRank = z.infer<typeof FinaleRankSchema>;
export type FinaleAward = z.infer<typeof FinaleAwardSchema>;
export type PodiumEntry = z.infer<typeof PodiumEntrySchema>;
export type FinaleState = z.infer<typeof FinaleStateSchema>;
export type PauseState = z.infer<typeof PauseStateSchema>;
export type RenderState = z.infer<typeof RenderStateSchema>;
