/**
 * Geometrie des geteilten iPads (CHAOS-13, ADR-008): Spielerzonen und ihre
 * Bedienelemente als Rechtecke. Reine Funktionen ohne DOM.
 *
 * Dieselben Rechtecke dienen der Darstellung (absolut positioniert) **und** der
 * Trefferprüfung im Zonen-Tracker – was man sieht, ist genau das, was reagiert.
 *
 * Koordinaten:
 * - **Bildschirm**: Pixel relativ zur linken oberen Ecke der Spielfläche (CSS-px, y nach unten).
 * - **Zonen-lokal**: Pixel im Inhalt der Zone, *vor* ihrer Drehung. Eine um 180° gedrehte
 *   Zone (Spieler sitzt gegenüber) hat ihr lokales „oben“ auf dem Bildschirm unten.
 */
import type { Action, Button, CharacterId, Layout, SlotNumber, Vote } from '@chaos-party/protocol';
import type { IntroReadyState } from '../minigame/view.ts';

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Size {
  readonly width: number;
  readonly height: number;
}

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Drehung des Zoneninhalts im Uhrzeigersinn (CSS `rotate`). */
export type Rotation = 0 | 90 | 180 | 270;

/** Lage einer Spielerzone auf dem Bildschirm. */
export interface ZoneFrame {
  readonly slot: SlotNumber;
  /** Position in der Sitzreihenfolge (0 = erster Spieler aus `welcome`). */
  readonly index: number;
  /** Rechteck auf dem Bildschirm. */
  readonly rect: Rect;
  /** Drehung des Inhalts, damit er zur Person an dieser Kante zeigt. */
  readonly rotation: Rotation;
}

/**
 * Wahlknopf der Brettphase (CHAOS-22): `choice:<promptId>:<optionId>`. Die Prompt-ID
 * gehört zur Kennung, damit ein Finger, der auf einem Knopf eines alten Prompts liegt,
 * nie eine gleichnamige Option des nächsten Prompts auslöst (`setZones` legt ihn still).
 */
export type ChoiceControlKind = `choice:${number}:${string}`;

/** Figurenkarte der Lobby (v4, CHAOS-36): `pick:<characterId>`. */
export type PickControlKind = `pick:${string}`;

/** Daumen nach dem Minispiel (CHAOS-218): `vote:up` bzw. `vote:down`. */
export type VoteControlKind = `vote:${Vote}`;

export type ControlKind =
  | 'stick'
  | 'button-a'
  | 'button-b'
  | 'ready'
  | ChoiceControlKind
  | PickControlKind
  | VoteControlKind;

/** Ein Bedienelement in Zonen-lokalen Koordinaten. */
export interface ControlGeometry {
  readonly kind: ControlKind;
  /** Sichtbare Fläche. */
  readonly rect: Rect;
  /** Reagierende Fläche (Knöpfe etwas großzügiger als sichtbar). */
  readonly hit: Rect;
  /** Löst schon beim Aufsetzen aus (Reaktion), nicht erst beim Abheben auf dem Knopf. */
  readonly instant?: true;
  /** Nur sichtbar, reagiert nicht (Wahl gesendet, Knöpfe gesperrt). */
  readonly inert?: true;
}

export function choiceControl(promptId: number, option: string): ChoiceControlKind {
  return `choice:${String(promptId)}:${option}` as ChoiceControlKind;
}

/** Prompt-ID und Option eines Wahlknopfs, sonst `null`. */
export function parseChoiceControl(
  kind: ControlKind | null,
): { readonly promptId: number; readonly option: string } | null {
  if (!kind?.startsWith('choice:')) return null;
  const match = /^choice:(\d+):(.+)$/.exec(kind);
  if (!match?.[1] || !match[2]) return null;
  return { promptId: Number(match[1]), option: match[2] };
}

export function pickControl(character: CharacterId): PickControlKind {
  return `pick:${character}`;
}

/** Figur einer Figurenkarte, sonst `null`. */
export function parsePickControl(kind: ControlKind | null): string | null {
  if (!kind?.startsWith('pick:')) return null;
  const id = kind.slice('pick:'.length);
  return id.length > 0 ? id : null;
}

export function voteControl(vote: Vote): VoteControlKind {
  return `vote:${vote}`;
}

/** Daumen eines Daumen-Knopfs, sonst `null`. */
export function parseVoteControl(kind: ControlKind | null): Vote | null {
  if (kind === 'vote:up') return 'up';
  if (kind === 'vote:down') return 'down';
  return null;
}

/** Vollständige Zone: Lage, lokale Größe, Bedienelemente. */
export interface ZoneGeometry extends ZoneFrame {
  /** Größe des Inhalts vor der Drehung (bei 90°/270° Breite und Höhe vertauscht). */
  readonly local: Size;
  /** Prüfreihenfolge: Knöpfe vor dem Joystick-Feld. */
  readonly controls: readonly ControlGeometry[];
  /** Radius des Joystick-Rings in px (voller Ausschlag). */
  readonly stickRadius: number;
}

/** Toter Streifen zwischen zwei Zonen: Berührungen dort gehören niemandem. */
export const ZONE_GUTTER = 16;

/** Abstand der Bedienelemente zum Zonenrand (Systemgesten vom Bildschirmrand, A3). */
export const ZONE_PADDING = 20;

/** Höhe des Plakettenstreifens oben in jeder Zone (nicht bedienbar). */
export const BADGE_STRIP = 78;

/** Zusätzliche Trefferfläche um Knöpfe. */
export const HIT_SLOP = 10;

/** Höchstzahl Zonen auf einem iPad (VISION: 2–4 Spieler). */
export const MAX_ZONES = 4;

export function rectContains(rect: Rect, point: Point): boolean {
  return (
    point.x >= rect.x &&
    point.x < rect.x + rect.width &&
    point.y >= rect.y &&
    point.y < rect.y + rect.height
  );
}

export function rectsEqual(a: Rect, b: Rect): boolean {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

export function inflate(rect: Rect, by: number): Rect {
  return {
    x: rect.x - by,
    y: rect.y - by,
    width: rect.width + 2 * by,
    height: rect.height + 2 * by,
  };
}

export function rectCenter(rect: Rect): Point {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

/** Größe des Inhalts vor der Drehung. */
export function localSize(rect: Rect, rotation: Rotation): Size {
  return rotation === 90 || rotation === 270
    ? { width: rect.height, height: rect.width }
    : { width: rect.width, height: rect.height };
}

/** Exakte Kosinus/Sinus-Werte für Vielfache von 90° (keine Rundungsfehler). */
function cosSin(rotation: Rotation): [number, number] {
  switch (rotation) {
    case 0:
      return [1, 0];
    case 90:
      return [0, 1];
    case 180:
      return [-1, 0];
    case 270:
      return [0, -1];
  }
}

function clean(value: number): number {
  return value === 0 ? 0 : value;
}

/**
 * Bildschirm-Versatz → lokaler Versatz (Drehung rückgängig machen).
 * Beispiel 180°: Finger nach oben auf dem Bildschirm = für die gegenübersitzende
 * Person nach unten.
 */
export function deltaToLocal(rotation: Rotation, dx: number, dy: number): Point {
  const [cos, sin] = cosSin(rotation);
  // Inverse Drehung um −θ (Bildschirm-y zeigt nach unten, CSS dreht im Uhrzeigersinn).
  return { x: clean(dx * cos + dy * sin), y: clean(-dx * sin + dy * cos) };
}

/** Lokaler Versatz → Bildschirm-Versatz. */
export function deltaToScreen(rotation: Rotation, dx: number, dy: number): Point {
  const [cos, sin] = cosSin(rotation);
  return { x: clean(dx * cos - dy * sin), y: clean(dx * sin + dy * cos) };
}

/** Bildschirmpunkt → Zonen-lokaler Punkt. */
export function toLocal(zone: ZoneFrame, point: Point): Point {
  const center = rectCenter(zone.rect);
  const local = localSize(zone.rect, zone.rotation);
  const d = deltaToLocal(zone.rotation, point.x - center.x, point.y - center.y);
  return { x: d.x + local.width / 2, y: d.y + local.height / 2 };
}

/** Zonen-lokaler Punkt → Bildschirmpunkt. */
export function toScreen(zone: ZoneFrame, point: Point): Point {
  const center = rectCenter(zone.rect);
  const local = localSize(zone.rect, zone.rotation);
  const d = deltaToScreen(zone.rotation, point.x - local.width / 2, point.y - local.height / 2);
  return { x: d.x + center.x, y: d.y + center.y };
}

/**
 * Ordnet die Spielerzonen auf dem Bildschirm an.
 *
 * - 1 Platz: ganze Fläche.
 * - 2 Plätze, Querformat: links | rechts, beide aufrecht (nebeneinander an der langen Kante).
 * - 2 Plätze, Hochformat: unten (aufrecht) und oben (180°, Person sitzt gegenüber).
 * - 3–4 Plätze: 2×2-Raster; untere Reihe aufrecht, obere Reihe 180°. Reihenfolge im
 *   Uhrzeigersinn um den Tisch: unten links, unten rechts, oben rechts, oben links.
 *   Bei drei Plätzen bleibt oben links frei.
 *
 * Zwischen den Zonen liegt ein toter Streifen von {@link ZONE_GUTTER} px.
 */
export function arrangeZones(slots: readonly SlotNumber[], viewport: Size): ZoneFrame[] {
  const used = slots.slice(0, MAX_ZONES);
  const { width: w, height: h } = viewport;
  if (used.length === 0 || !(w > 0) || !(h > 0)) return [];
  const g = ZONE_GUTTER;
  const halfW = (w - g) / 2;
  const halfH = (h - g) / 2;
  const left: Rect = { x: 0, y: 0, width: halfW, height: h };
  const right: Rect = { x: halfW + g, y: 0, width: halfW, height: h };
  const top: Rect = { x: 0, y: 0, width: w, height: halfH };
  const bottom: Rect = { x: 0, y: halfH + g, width: w, height: halfH };

  let cells: { rect: Rect; rotation: Rotation }[];
  if (used.length === 1) {
    cells = [{ rect: { x: 0, y: 0, width: w, height: h }, rotation: 0 }];
  } else if (used.length === 2) {
    cells =
      w >= h
        ? [
            { rect: left, rotation: 0 },
            { rect: right, rotation: 0 },
          ]
        : [
            { rect: bottom, rotation: 0 },
            { rect: top, rotation: 180 },
          ];
  } else {
    const bottomY = halfH + g;
    cells = [
      { rect: { x: 0, y: bottomY, width: halfW, height: halfH }, rotation: 0 },
      { rect: { x: halfW + g, y: bottomY, width: halfW, height: halfH }, rotation: 0 },
      { rect: { x: halfW + g, y: 0, width: halfW, height: halfH }, rotation: 180 },
      { rect: { x: 0, y: 0, width: halfW, height: halfH }, rotation: 180 },
    ];
  }

  return used.map((slot, index) => {
    const cell = cells[index];
    if (!cell) throw new Error('Zonenraster zu klein');
    return { slot, index, rect: cell.rect, rotation: cell.rotation };
  });
}

/** Wahlknöpfe einer Zone in der Brettphase (eigener Prompt). */
export interface ZoneChoicesInput {
  readonly promptId: number;
  /** Große Knöpfe (Options-IDs in Anzeigereihenfolge). */
  readonly main: readonly string[];
  /** Kleine Knöpfe in einer Zeile darunter (Items, Abbrechen). */
  readonly extra: readonly string[];
  /** Reaktion: Hauptknöpfe füllen die Fläche und lösen beim Aufsetzen aus. */
  readonly instant: boolean;
  /** Wahl gesendet: Knöpfe sichtbar, aber ohne Wirkung. */
  readonly locked: boolean;
}

/** Lobby mit Charakterwahl in einer Zone (v4, CHAOS-36). */
export interface ZoneLobbyInput {
  /** Figuren in Anzeigereihenfolge; nicht wählbare (vergeben, eigene) sind sichtbar, aber `inert`. */
  readonly characters: readonly { readonly id: CharacterId; readonly selectable: boolean }[];
  /** „Bereit!“-Knopf zeigen (angeboten und noch nicht gesendet). */
  readonly showReady: boolean;
}

/** Was eine Zone gerade anzeigen soll (aus dem Server-Kontext abgeleitet). */
export interface ZoneControlsInput {
  readonly layout: Layout;
  readonly actions: readonly Action[];
  /** `ready` wurde schon gesendet: Knopf ausblenden (wie `LobbyPanel`). */
  readonly readySent?: boolean;
  /** Nur Layout `board` mit eigenem Prompt. */
  readonly choices?: ZoneChoicesInput;
  /** Nur Lobby mit Charakterwahl (Layout `lobby` oder `wait`). */
  readonly lobby?: ZoneLobbyInput;
  /**
   * Nur Minispiel-Anleitung, die auf „Bereit“ wartet (CHAOS-214): `guard` zeigt den Knopf
   * gesperrt (`inert`), `button` antippbar, `done` die Bestätigung (kein Bedienelement).
   * Fehlt = Anleitung mit fester Zeit, keine Fußzeile.
   */
  readonly introReady?: Exclude<IntroReadyState, 'timer'>;
  /**
   * Nur Minispiel-Ergebnis, während der Server `rate` anbietet (CHAOS-218): Daumen hoch/runter
   * in der Fußzeile unter der Ergebniskarte. Beide bleiben antippbar (Umentscheiden).
   */
  readonly vote?: true;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Größter Knopf ohne Joystick (Minispiel mit nur Knöpfen). */
export const MAX_BIG_BUTTON = 220;

/** Durchmesser von A und B für eine Knopffläche. */
export function buttonDiameters(area: Size): { a: number; b: number } {
  const a = clamp(Math.min(area.width, area.height) * 0.46, 88, 140);
  return { a, b: Math.max(76, Math.round(a * 0.8)) };
}

function circle(center: Point, diameter: number): Rect {
  return {
    x: center.x - diameter / 2,
    y: center.y - diameter / 2,
    width: diameter,
    height: diameter,
  };
}

/**
 * Knöpfe ohne Joystick: einer groß in der Mitte, zwei gleich groß nebeneinander (breite
 * Fläche) oder übereinander (hohe Fläche). Trefferflächen überlappen nicht.
 */
function bigButtons(area: Rect, buttons: readonly Button[]): ControlGeometry[] {
  const kindOf = (button: Button): ControlKind => (button === 'a' ? 'button-a' : 'button-b');
  const c = rectCenter(area);
  if (buttons.length === 1) {
    const [only] = buttons;
    if (!only) return [];
    const d = clamp(Math.min(area.width, area.height) * 0.62, 88, MAX_BIG_BUTTON);
    return [control(kindOf(only), circle(c, d), HIT_SLOP)];
  }
  const gap = 24 + 2 * HIT_SLOP;
  const wide = area.width >= area.height;
  const cell = wide ? (area.width - gap) / 2 : (area.height - gap) / 2;
  const d = clamp(Math.min(cell, wide ? area.height : area.width) * 0.8, 76, MAX_BIG_BUTTON);
  const offset = (cell + gap) / 2;
  // A links (breit) bzw. unten (hoch), B gegenüber.
  const centerA = wide ? { x: c.x - offset, y: c.y } : { x: c.x, y: c.y + offset };
  const centerB = wide ? { x: c.x + offset, y: c.y } : { x: c.x, y: c.y - offset };
  return buttons.map((button) =>
    control(kindOf(button), circle(button === 'a' ? centerA : centerB, d), HIT_SLOP),
  );
}

function control(kind: ControlKind, rect: Rect, slop = 0): ControlGeometry {
  return { kind, rect, hit: slop > 0 ? inflate(rect, slop) : rect };
}

/**
 * Bedienelemente einer Zone in lokalen Koordinaten.
 *
 * - `lobby` mit `ready` (noch nicht gesendet): großer Bereit-Knopf in der Mitte.
 * - `joystick-buttons`: Joystick-Feld und A/B. Breite Zonen wie ein Gamepad
 *   (Joystick links, Knöpfe rechts), hohe Zonen wie das iPhone im Hochformat
 *   (Knöpfe oben, Joystick unten).
 * - `board` mit eigenem Prompt: Wahlknöpfe ({@link layoutChoiceControls}, CHAOS-22).
 * - sonst (`wait`, Lobby nach „Bereit!“): keine Bedienelemente.
 */
export function layoutZoneControls(local: Size, input: ZoneControlsInput): ControlGeometry[] {
  const p = ZONE_PADDING;
  const area: Rect = {
    x: p,
    y: BADGE_STRIP,
    width: Math.max(0, local.width - 2 * p),
    height: Math.max(0, local.height - BADGE_STRIP - p),
  };
  if (area.width <= 0 || area.height <= 0) return [];

  if (input.lobby) return layoutLobbyControls(local, input.lobby);

  if (input.layout === 'lobby') {
    if (!input.actions.includes('ready') || input.readySent === true) return [];
    const width = Math.min(300, area.width);
    const height = Math.min(112, area.height);
    const center = rectCenter(area);
    return [
      control(
        'ready',
        { x: center.x - width / 2, y: center.y - height / 2, width, height },
        HIT_SLOP,
      ),
    ];
  }

  if (input.layout === 'board') {
    if (input.introReady === 'guard' || input.introReady === 'button') {
      return [introReadyControl(local, input.introReady === 'guard')];
    }
    if (input.vote === true) return voteControls(local);
    return input.choices ? layoutChoiceControls(boardZoneFrames(local).body, input.choices) : [];
  }

  if (input.layout !== 'joystick-buttons') return [];

  const buttons = (['a', 'b'] as const satisfies readonly Button[]).filter((button) =>
    input.actions.includes(button === 'a' ? 'button-a' : 'button-b'),
  );
  const canMove = input.actions.includes('move');
  const wide = area.width >= area.height * 1.15;
  const gap = 16;

  let stickArea: Rect;
  let buttonArea: Rect;
  if (wide) {
    const stickWidth = buttons.length > 0 ? (area.width - gap) * 0.56 : area.width;
    stickArea = { x: area.x, y: area.y, width: stickWidth, height: area.height };
    buttonArea = {
      x: area.x + stickWidth + gap,
      y: area.y,
      width: area.width - stickWidth - gap,
      height: area.height,
    };
  } else {
    const buttonHeight = canMove ? (area.height - gap) * 0.44 : area.height;
    buttonArea = { x: area.x, y: area.y, width: area.width, height: buttonHeight };
    stickArea = {
      x: area.x,
      y: area.y + buttonHeight + gap,
      width: area.width,
      height: area.height - buttonHeight - gap,
    };
  }
  if (!canMove) buttonArea = area;
  if (buttons.length === 0) stickArea = area;

  const result: ControlGeometry[] = [];
  if (buttons.length > 0 && !canMove) {
    // Ohne Joystick (Minispiel, CHAOS-33): Knöpfe größer und mittig, nebeneinander bzw.
    // in hohen Zonen übereinander – A links bzw. unten (Daumenruhe).
    result.push(...bigButtons(buttonArea, buttons));
  } else if (buttons.length > 0) {
    const d = buttonDiameters(buttonArea);
    if (buttons.length === 1) {
      const only = buttons[0] === 'a' ? 'button-a' : 'button-b';
      result.push(
        control(only, circle(rectCenter(buttonArea), only === 'button-a' ? d.a : d.b), HIT_SLOP),
      );
    } else {
      // Wie das iPhone: A unten links (Daumenruhe), B oben rechts.
      const c = rectCenter(buttonArea);
      // Diagonal versetzt, A bleibt ganz in der Knopffläche; die Trefferflächen
      // (inklusive Zugabe) überlappen nicht (unit-getestet für iPad-Größen).
      const spreadX = Math.max(0, Math.min(buttonArea.width / 2 - d.a / 2, d.a * 0.62));
      const spreadY = Math.max(0, Math.min(buttonArea.height / 2 - d.a / 2, d.a * 0.62));
      result.push(
        control('button-a', circle({ x: c.x - spreadX, y: c.y + spreadY }, d.a), HIT_SLOP),
        control('button-b', circle({ x: c.x + spreadX, y: c.y - spreadY }, d.b), HIT_SLOP),
      );
    }
  }
  if (canMove) result.push(control('stick', stickArea));
  return result;
}

/* ---------------------------------------------------------------------------
 * Brettphase (CHAOS-22): Statuszeile, Titel, Countdown und Wahlknöpfe
 * ------------------------------------------------------------------------- */

/** Statuszeile (Münzen, Trophäen, Runde, Items) unter der Plakette. */
export const BOARD_STATUS_HEIGHT = 44;
/** Titel des Prompts bzw. Hinweis „Gesendet …“. */
export const BOARD_TITLE_HEIGHT = 40;
/** Countdown-Balken (auch ohne Frist reserviert, damit Knöpfe nicht springen). */
export const BOARD_TIMER_HEIGHT = 14;
/** Abstand zwischen Wahlknöpfen. */
export const CHOICE_GAP = 12;
/** Höhe der Zeile mit Zusatzknöpfen. */
export const EXTRA_ROW_HEIGHT = 64;
/** Mindestgröße eines Wahlknopfs (Touch-Ziel). */
export const MIN_CHOICE_SIZE = 56;
/** Hauptknöpfe (außer Reaktion) werden höchstens so hoch – große Zonen sehen sonst leer aus. */
export const MAX_CHOICE_HEIGHT = 180;
/** Zusatzknöpfe werden höchstens so breit. */
export const MAX_EXTRA_WIDTH = 240;

export interface BoardZoneFrames {
  readonly status: Rect;
  readonly title: Rect;
  readonly timer: Rect;
  /** Fläche für die Wahlknöpfe bzw. die Warte-Anzeige. */
  readonly body: Rect;
}

/** Bereiche einer Zone in der Brettphase (lokal; Darstellung und Trefferprüfung). */
export function boardZoneFrames(local: Size): BoardZoneFrames {
  const p = ZONE_PADDING;
  const width = Math.max(0, local.width - 2 * p);
  const status: Rect = { x: p, y: BADGE_STRIP, width, height: BOARD_STATUS_HEIGHT };
  const title: Rect = {
    x: p,
    y: status.y + status.height + 4,
    width,
    height: BOARD_TITLE_HEIGHT,
  };
  const timer: Rect = { x: p, y: title.y + title.height, width, height: BOARD_TIMER_HEIGHT };
  const bodyY = timer.y + timer.height + 8;
  const body: Rect = { x: p, y: bodyY, width, height: Math.max(0, local.height - p - bodyY) };
  return { status, title, timer, body };
}

/**
 * Raster für `count` gleich große Knöpfe in `area`: Spaltenzahl so, dass die Knöpfe
 * möglichst groß und eher breit als hoch werden (Text passt), bei Gleichstand weniger Spalten.
 */
export function choiceGrid(area: Size, count: number): { columns: number; rows: number } {
  let best = { columns: 1, rows: Math.max(1, count), score: -Infinity };
  for (let columns = 1; columns <= Math.max(1, count); columns++) {
    const rows = Math.ceil(count / columns);
    const w = (area.width - (columns - 1) * CHOICE_GAP) / columns;
    const h = (area.height - (rows - 1) * CHOICE_GAP) / rows;
    const score = Math.min(w / 2.2, h);
    if (score > best.score + 0.5) best = { columns, rows, score };
  }
  return { columns: best.columns, rows: best.rows };
}

function gridRects(area: Rect, count: number, maxHeight: number): Rect[] {
  if (count === 0 || area.width <= 0 || area.height <= 0) return [];
  const { columns, rows } = choiceGrid(area, count);
  const w = (area.width - (columns - 1) * CHOICE_GAP) / columns;
  const h = Math.min(maxHeight, (area.height - (rows - 1) * CHOICE_GAP) / rows);
  const usedHeight = rows * h + (rows - 1) * CHOICE_GAP;
  const top = area.y + (area.height - usedHeight) / 2;
  return Array.from({ length: count }, (_, i) => {
    const row = Math.floor(i / columns);
    // Letzte, unvollständige Reihe mittig.
    const inRow = row === rows - 1 ? count - row * columns : columns;
    const rowWidth = inRow * w + (inRow - 1) * CHOICE_GAP;
    const left = area.x + (area.width - rowWidth) / 2;
    const col = i - row * columns;
    return {
      x: left + col * (w + CHOICE_GAP),
      y: top + row * (h + CHOICE_GAP),
      width: w,
      height: h,
    };
  });
}

function rowRects(area: Rect, count: number): Rect[] {
  if (count === 0) return [];
  const w = Math.min(MAX_EXTRA_WIDTH, (area.width - (count - 1) * CHOICE_GAP) / count);
  const rowWidth = count * w + (count - 1) * CHOICE_GAP;
  const left = area.x + (area.width - rowWidth) / 2;
  return Array.from({ length: count }, (_, i) => ({
    x: left + i * (w + CHOICE_GAP),
    y: area.y,
    width: w,
    height: area.height,
  }));
}

/**
 * Wahlknöpfe in `body` (lokal): Hauptknöpfe im Raster, Zusatzknöpfe als Zeile unten.
 * Gesperrt (`locked`) bleiben die Rechtecke gleich, reagieren aber nicht (`inert`).
 * Kein Trefferzuschlag: Wahlknöpfe liegen dicht nebeneinander.
 */
export function layoutChoiceControls(body: Rect, input: ZoneChoicesInput): ControlGeometry[] {
  const extraHeight = input.extra.length > 0 ? EXTRA_ROW_HEIGHT + CHOICE_GAP : 0;
  const mainArea: Rect = { ...body, height: Math.max(0, body.height - extraHeight) };
  const extraArea: Rect = {
    x: body.x,
    y: body.y + body.height - EXTRA_ROW_HEIGHT,
    width: body.width,
    height: EXTRA_ROW_HEIGHT,
  };
  const flags = (instant: boolean): Pick<ControlGeometry, 'instant' | 'inert'> => ({
    ...(instant && { instant: true as const }),
    ...(input.locked && { inert: true as const }),
  });
  const main = gridRects(
    mainArea,
    input.main.length,
    input.instant ? Number.POSITIVE_INFINITY : MAX_CHOICE_HEIGHT,
  );
  const extra = rowRects(extraArea, input.extra.length);
  return [
    ...input.main.map((option, i) => ({
      kind: choiceControl(input.promptId, option),
      rect: main[i] ?? { x: 0, y: 0, width: 0, height: 0 },
      hit: main[i] ?? { x: 0, y: 0, width: 0, height: 0 },
      ...flags(input.instant),
    })),
    ...input.extra.map((option, i) => ({
      kind: choiceControl(input.promptId, option),
      rect: extra[i] ?? { x: 0, y: 0, width: 0, height: 0 },
      hit: extra[i] ?? { x: 0, y: 0, width: 0, height: 0 },
      ...flags(false),
    })),
  ];
}

/* ---------------------------------------------------------------------------
 * Minispiel-Anleitung (CHAOS-214): Karte und Fußzeile mit „Bereit!“
 * ------------------------------------------------------------------------- */

/** Fußzeile der Anleitung: wächst mit der Zone, mindestens 64 px (Touch-Ziel). */
export function minigameFootHeight(local: Size): number {
  return Math.round(clamp(local.height * 0.12, 64, 96));
}

/** Abstand zwischen Anleitungskarte und Fußzeile. */
export const MINIGAME_FOOT_GAP = 10;
/** Bereit-Knopf der Anleitung wird höchstens so breit. */
export const MAX_INTRO_READY_WIDTH = 320;

export interface MinigameZoneFrames {
  /** Anleitung bzw. Ergebnis (ganze Fläche unter der Plakette, mit Fußzeile kürzer). */
  readonly card: Rect;
  /** „Bereit!“ bzw. Bestätigung; ohne Fußzeile leer (Höhe 0) am unteren Rand. */
  readonly foot: Rect;
}

/** Bereiche einer Zone im Minispiel-Intro/-Ergebnis (lokal; Darstellung und Trefferprüfung). */
export function minigameZoneFrames(local: Size, withFoot: boolean): MinigameZoneFrames {
  const p = ZONE_PADDING;
  const width = Math.max(0, local.width - 2 * p);
  const bottom = Math.max(BADGE_STRIP, local.height - p);
  const footHeight = withFoot ? minigameFootHeight(local) : 0;
  const foot: Rect = { x: p, y: bottom - footHeight, width, height: footHeight };
  const cardBottom = withFoot ? foot.y - MINIGAME_FOOT_GAP : bottom;
  const card: Rect = {
    x: p,
    y: BADGE_STRIP,
    width,
    height: Math.max(0, cardBottom - BADGE_STRIP),
  };
  return { card, foot };
}

/** „Bereit!“ mittig in der Fußzeile; in der Schonfrist sichtbar, aber `inert`. */
function introReadyControl(local: Size, inert: boolean): ControlGeometry {
  const { foot } = minigameZoneFrames(local, true);
  const width = Math.min(MAX_INTRO_READY_WIDTH, foot.width);
  const rect: Rect = {
    x: rectCenter(foot).x - width / 2,
    y: foot.y,
    width,
    height: foot.height,
  };
  const ready = control('ready', rect, HIT_SLOP);
  return inert ? { ...ready, inert: true } : ready;
}

/* ---------------------------------------------------------------------------
 * Daumen nach dem Minispiel (CHAOS-218): Frage und zwei Knöpfe in der Fußzeile
 * ------------------------------------------------------------------------- */

/** Daumen-Knöpfe werden höchstens so breit (große Zonen sehen sonst leer aus). */
export const MAX_VOTE_WIDTH = 112;
/** Mindestbreite eines Daumen-Knopfs (Touch-Ziel, Emoji passt). */
export const MIN_VOTE_WIDTH = 72;
/** Abstand der Daumen: beide Trefferflächen (mit Zugabe) berühren sich nicht. */
export const VOTE_GAP = 2 * HIT_SLOP + 4;
/** Abstand zwischen Frage und Knöpfen. */
export const VOTE_QUESTION_GAP = 16;
/** Unter dieser Breite entfällt die Frage neben den Knöpfen (die Knöpfe sprechen für sich). */
export const MIN_VOTE_QUESTION_WIDTH = 120;

export interface MinigameVoteFrames {
  /** Ergebniskarte (wie {@link minigameZoneFrames} mit Fußzeile). */
  readonly card: Rect;
  /** Fußzeile für Frage und Daumen. */
  readonly foot: Rect;
  /** „Hat's Spaß gemacht?“ links der Knöpfe; Breite 0, wenn die Zone zu schmal ist. */
  readonly question: Rect;
  readonly up: Rect;
  readonly down: Rect;
}

/**
 * Bereiche der Ergebnisanzeige mit Daumen (lokal; Darstellung und Trefferprüfung).
 * Frage und Knöpfe teilen sich die Fußzeile an ihrer Mitte: Frage rechtsbündig links davon,
 * 👍 und 👎 rechts davon. Ist die Hälfte zu schmal, stehen nur die Knöpfe mittig.
 */
export function minigameVoteFrames(local: Size): MinigameVoteFrames {
  const { card, foot } = minigameZoneFrames(local, true);
  const width = clamp(foot.height * 1.45, MIN_VOTE_WIDTH, MAX_VOTE_WIDTH);
  const buttons = 2 * width + VOTE_GAP;
  const center = rectCenter(foot).x;
  const half = foot.width / 2 - VOTE_QUESTION_GAP / 2;
  const withQuestion = half >= buttons && half >= MIN_VOTE_QUESTION_WIDTH;
  const left = withQuestion ? center + VOTE_QUESTION_GAP / 2 : center - buttons / 2;
  const question: Rect = withQuestion
    ? { x: foot.x, y: foot.y, width: half, height: foot.height }
    : { x: center, y: foot.y, width: 0, height: foot.height };
  const up: Rect = { x: left, y: foot.y, width, height: foot.height };
  const down: Rect = { x: left + width + VOTE_GAP, y: foot.y, width, height: foot.height };
  return { card, foot, question, up, down };
}

/** 👍 und 👎 mit Trefferzugabe; wählen beim Abheben auf dem Knopf. */
function voteControls(local: Size): ControlGeometry[] {
  const frames = minigameVoteFrames(local);
  return [
    control(voteControl('up'), frames.up, HIT_SLOP),
    control(voteControl('down'), frames.down, HIT_SLOP),
  ];
}

/* ---------------------------------------------------------------------------
 * Lobby mit Charakterwahl (v4, CHAOS-36): Kopf, vier Figurenkarten, „Bereit!“
 * ------------------------------------------------------------------------- */

/** Kopfzeile mit Titel und Rundenzahl. */
export const LOBBY_HEAD_HEIGHT = 40;
/** Abstand zwischen Figurenkarten (Karten haben keine Trefferzugabe: kein Überlappen). */
export const CHARACTER_GAP = 12;
/** Figurenkarten werden höchstens so groß (große Zonen sehen sonst leer aus). */
export const MAX_CHARACTER_WIDTH = 210;
export const MAX_CHARACTER_HEIGHT = 230;
/** Fußzeile mit „Bereit!“ bzw. Bestätigung: Höhe wächst mit der Zone, mindestens 72 px. */
export function lobbyFootHeight(local: Size): number {
  return Math.round(clamp(local.height * 0.14, 72, 112));
}

export interface LobbyZoneFrames {
  readonly head: Rect;
  /** Fläche für die Figurenkarten. */
  readonly grid: Rect;
  /** „Bereit!“ bzw. „✓ Bereit“. */
  readonly foot: Rect;
}

export function lobbyZoneFrames(local: Size): LobbyZoneFrames {
  const p = ZONE_PADDING;
  const width = Math.max(0, local.width - 2 * p);
  const head: Rect = { x: p, y: BADGE_STRIP - 4, width, height: LOBBY_HEAD_HEIGHT };
  const footHeight = lobbyFootHeight(local);
  const foot: Rect = { x: p, y: local.height - p - footHeight, width, height: footHeight };
  const gridY = head.y + head.height + 6;
  const grid: Rect = {
    x: p,
    y: gridY,
    width,
    height: Math.max(0, foot.y - 10 - gridY),
  };
  return { head, grid, foot };
}

/** 4 nebeneinander (breite Fläche) oder 2×2 (hohe Fläche): die größeren Karten gewinnen. */
export function characterGrid(area: Size, count: number): { columns: number; rows: number } {
  const options = count <= 2 ? [count] : [count, Math.ceil(count / 2)];
  let best = { columns: Math.max(1, count), rows: 1, score: -Infinity };
  for (const columns of options) {
    const rows = Math.ceil(count / columns);
    const w = (area.width - (columns - 1) * CHARACTER_GAP) / columns;
    const h = (area.height - (rows - 1) * CHARACTER_GAP) / rows;
    // Karten etwas höher als breit (Porträt + Name).
    const score = Math.min(w, h * 0.85);
    if (score > best.score + 0.5) best = { columns, rows, score };
  }
  return { columns: best.columns, rows: best.rows };
}

/** Rechtecke der Figurenkarten in `area` (mittig, höchstens {@link MAX_CHARACTER_WIDTH}). */
export function characterRects(area: Rect, count: number): Rect[] {
  if (count === 0 || area.width <= 0 || area.height <= 0) return [];
  const { columns, rows } = characterGrid(area, count);
  const w = Math.min(MAX_CHARACTER_WIDTH, (area.width - (columns - 1) * CHARACTER_GAP) / columns);
  const h = Math.min(MAX_CHARACTER_HEIGHT, (area.height - (rows - 1) * CHARACTER_GAP) / rows);
  const usedW = columns * w + (columns - 1) * CHARACTER_GAP;
  const usedH = rows * h + (rows - 1) * CHARACTER_GAP;
  const left = area.x + (area.width - usedW) / 2;
  const top = area.y + (area.height - usedH) / 2;
  return Array.from({ length: count }, (_, i) => {
    const row = Math.floor(i / columns);
    const col = i - row * columns;
    return {
      x: left + col * (w + CHARACTER_GAP),
      y: top + row * (h + CHARACTER_GAP),
      width: w,
      height: h,
    };
  });
}

/** Figurenkarten (wählen beim Abheben) und ggf. „Bereit!“ in der Fußzeile. */
export function layoutLobbyControls(local: Size, input: ZoneLobbyInput): ControlGeometry[] {
  const frames = lobbyZoneFrames(local);
  const rects = characterRects(frames.grid, input.characters.length);
  const cards = input.characters.map(({ id, selectable }, i): ControlGeometry => {
    const rect = rects[i] ?? { x: 0, y: 0, width: 0, height: 0 };
    return { kind: pickControl(id), rect, hit: rect, ...(!selectable && { inert: true as const }) };
  });
  if (!input.showReady) return cards;
  const width = Math.min(320, frames.foot.width);
  const center = rectCenter(frames.foot);
  const ready = control(
    'ready',
    {
      x: center.x - width / 2,
      y: frames.foot.y,
      width,
      height: frames.foot.height,
    },
    HIT_SLOP,
  );
  return [...cards, ready];
}

/** Radius des Joystick-Rings passend zur Zonengröße. */
export function stickRadiusFor(local: Size): number {
  return Math.round(clamp(Math.min(local.width, local.height) * 0.17, 56, 85));
}

/** Zonen samt Bedienelementen für Plätze, Bildschirmgröße und Kontexte. */
export function buildZones(
  slots: readonly SlotNumber[],
  viewport: Size,
  inputFor: (slot: SlotNumber) => ZoneControlsInput,
): ZoneGeometry[] {
  return arrangeZones(slots, viewport).map((frame) => {
    const local = localSize(frame.rect, frame.rotation);
    return {
      ...frame,
      local,
      controls: layoutZoneControls(local, inputFor(frame.slot)),
      stickRadius: stickRadiusFor(local),
    };
  });
}

/** Zone, in der ein Bildschirmpunkt liegt (Randstreifen → `null`). */
export function zoneAt<Z extends ZoneFrame>(zones: readonly Z[], point: Point): Z | null {
  return zones.find((zone) => rectContains(zone.rect, point)) ?? null;
}

/** Bedienelement unter einem lokalen Punkt (Reihenfolge = Priorität; gesperrte zählen nicht). */
export function controlAt(zone: ZoneGeometry, local: Point): ControlGeometry | null {
  return zone.controls.find((c) => c.inert !== true && rectContains(c.hit, local)) ?? null;
}

/** Gleiche Lage und Drehung (Bedienelemente dürfen sich unterscheiden). */
export function sameFrame(a: ZoneFrame, b: ZoneFrame): boolean {
  return a.slot === b.slot && a.rotation === b.rotation && rectsEqual(a.rect, b.rect);
}
