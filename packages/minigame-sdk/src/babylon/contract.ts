/**
 * Babylon-Laufzeitvertrag für Minispiele (CHAOS-26, ADR-012). Nur der Host (und Tests mit
 * NullEngine) importieren das.
 *
 * Lebenszyklus (die Laufzeit `createMinigameRunner` erzwingt die Reihenfolge):
 *
 *   create() → prepare(ctx) → start() → { handleInput | update(1/60) }* → getResult() ≠ null
 *            → dispose()
 *
 * Regeln:
 * - **Szene:** Die Laufzeit erzeugt für jedes Minispiel eine frische `Scene` und entsorgt
 *   sie danach. Das Minispiel legt alles (Meshes, Materialien, Kamera, Licht, Physik-Körper,
 *   Partikel, Beobachter) **in dieser Szene** an und räumt es in `dispose()` selbst weg.
 *   Tests prüfen nach `dispose()`, dass nichts übrig ist (`sceneResidue`).
 * - **Zeit:** Nur `update(dtSeconds)` lässt Zeit vergehen, immer mit festem Schritt
 *   `FIXED_STEP_SECONDS`. Keine Uhr (`Date`, `performance`), keine Timer, kein
 *   `scene.onBeforeRenderObservable` für Spiellogik. So sind Pause, Zeitraffer in Tests und
 *   Determinismus geschenkt. Physik rechnet die Laufzeit nach jedem `update` einen Schritt.
 * - **Zufall:** nur `ctx.rng` (Seed vom Server).
 * - **Eingaben:** `handleInput` kommt nur für teilnehmende Slots und nur während des Spiels.
 *   Achsen sind auf [-1, 1] begrenzt; y > 0 heißt „nach oben/vorn“ am Joystick.
 *   Trennt sich ein Controller, schickt die Laufzeit neutrale Eingaben (Stick 0/0, Knöpfe
 *   losgelassen); der Spieler bleibt im Spiel, seine Figur steht still.
 * - **Ende:** Das Minispiel liefert spätestens nach `ctx.timeLimitMs` Spielzeit ein Ergebnis
 *   (`getResult()` ≠ null), gern früher (alle bis auf einen raus). Danach ist das Ergebnis
 *   endgültig; weitere `update`-Aufrufe dürfen nur noch Anzeige ändern.
 * - **Wertung:** Ergebnis mit allen Teilnehmern; `rankByScore` hilft. Kein Zugriff auf
 *   Münzen/Trophäen – das macht game-core aus dem Ergebnis.
 * - **Anzeige:** Kamera setzt das Minispiel in `prepare`. Text-Overlays (Anleitung, Countdown,
 *   Punkte, Ergebnis) macht der Host aus `info` und `getHud()`; das Minispiel zeichnet kein
 *   eigenes HTML.
 * - **Look (CHAOS-62, optional):** Gibt die Laufzeit `ctx.look` mit, ruft das Minispiel in
 *   `prepare` genau einmal `look.backdrop(…)` auf und legt dann **kein** eigenes Licht, keinen
 *   Boden bis zum Horizont und keinen Hintergrund an; Materialien holt es über
 *   `look.material(…)`. Ohne `ctx.look` (Tests, Vorschau) baut es wie bisher alles selbst.
 */
import type { Material } from '@babylonjs/core/Materials/material.js';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import type { Scene } from '@babylonjs/core/scene.js';
import type { CharacterId, MinigameInfo, MinigameInput, MinigameResult, Slot } from '../info.ts';
import type { MinigameRng } from '../rng.ts';
import type { MinigameTeams } from '../teams.ts';

/** Fester Logik- und Physikschritt (60 Hz). */
export const FIXED_STEP_SECONDS = 1 / 60;

export interface MinigamePlayer {
  readonly slot: Slot;
  readonly name: string;
  /** Slot-Farbe (`#rrggbb`), immer zusätzlich zur Figur zeigen (Farbe + Symbol, M1). */
  readonly color: string;
  /** Farbunabhängiges Symbol des Slots (●, ▲, ■, ★). */
  readonly symbol: string;
  readonly character: CharacterId;
}

/** Klang-Effekte, die die Laufzeit bereitstellt (prozedural erzeugt, siehe CHAOS-33). */
export const SOUND_IDS = [
  'tick',
  'go',
  'hit',
  'bump',
  'coin',
  'score',
  'fall',
  'splash',
  'whoosh',
  'pop',
  'buzz',
  'cheer',
  'win',
  'lose',
] as const;
export type SoundId = (typeof SOUND_IDS)[number];

/** Partikel-Effekte (kurzlebig, räumt die Laufzeit selbst auf). */
export const VFX_IDS = [
  'sparkle',
  'dust',
  'confetti',
  'impact',
  'splash',
  'stars',
  'smoke',
] as const;
export type VfxId = (typeof VFX_IDS)[number];

export interface Vec3Like {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * Sound, VFX und Kamerawackeln. In Tests ein Aufzeichner ohne Wirkung. Effekte dürfen das
 * Spielergebnis nie beeinflussen. Was `burst` in der Szene anlegt, gehört der Laufzeit.
 */
export interface MinigameFx {
  sound(id: SoundId, options?: { readonly volume?: number; readonly pitch?: number }): void;
  burst(id: VfxId, at: Vec3Like, color?: string): void;
  /** Kurzes Kamerawackeln, Stärke 0–1. */
  shake(strength: number): void;
}

/** Animationsnamen jeder Figur (CHAOS-27/28 prüfen sie im Asset-Manifest). */
export const CHARACTER_ANIMATIONS = ['idle', 'run', 'jump', 'hit', 'cheer', 'sad', 'fall'] as const;
export type CharacterAnimation = (typeof CHARACTER_ANIMATIONS)[number];

/**
 * Eine Figur in der Szene. Maßstab (verbindlich für alle Figuren): Füße bei y = 0,
 * Blickrichtung +Z, Höhe 1,4–1,8 Einheiten, Grundfläche passt in einen Kreis mit Radius 0,5.
 * `root` darf das Minispiel bewegen/drehen/skalieren; Kollision/Hitbox baut das Minispiel
 * selbst (unabhängig vom Render-Mesh).
 */
export interface CharacterHandle {
  readonly root: TransformNode;
  readonly id: CharacterId;
  /** Spielt eine Animation (Schleife bei idle/run, sonst einmal und dann idle). */
  play(animation: CharacterAnimation): void;
  /** Entfernt Meshes, Materialien und Animationen der Figur aus der Szene. */
  dispose(): void;
}

export interface CharacterFactory {
  create(scene: Scene, player: MinigamePlayer): CharacterHandle;
}

/** Oberfläche eines Materials im Look der Laufzeit. */
export type LookFinish = 'matt' | 'lack' | 'glanz' | 'metall' | 'stoff';

export interface LookMaterialOptions {
  /** Eigenleuchten als Anteil der Farbe (Signalfarben, Slot-Ringe), 0–1. */
  readonly emissive?: number;
  readonly alpha?: number;
  /** Standard `lack`. */
  readonly finish?: LookFinish;
  /** Licht scheint durch (Pudding, Blätter, Stoff), 0–1. */
  readonly translucency?: number;
}

/** Spielfläche um den Ursprung, die die Kulisse frei und eben lässt. */
export interface LookArea {
  /** Halbe Breite (x) und Tiefe (z) der freien Fläche. */
  readonly halfX: number;
  readonly halfZ: number;
  /** Höhe der Wiese (Standard 0). Fallen Figuren hinunter, liegt die Wiese tiefer. */
  readonly groundY?: number;
  /** Kulisse unter der Spielfläche: Wiese oder Picknickdecke (Standard `wiese`). */
  readonly surface?: 'wiese' | 'decke';
}

/**
 * Look der Laufzeit (CHAOS-62, „Stilisierte Natur“): Kulisse, Licht, Himmel und
 * Nachbearbeitung kommen vom Host; das Minispiel bringt nur seine Spielfläche mit.
 */
export interface MinigameLook {
  /**
   * Neues Material im Look (gehört dem Minispiel wie ein selbst angelegtes: in `dispose()`
   * entsorgen). Gleiche Wünsche dürfen ein Material teilen, das regelt das Minispiel.
   */
  material(hex: string, options?: LookMaterialOptions): Material;
  /**
   * Kulisse um die Spielfläche: Wiese oder Decke, Gras, Bäume, Himmel, Licht, Schatten.
   * Alles, was sie anlegt, gehört der Laufzeit. Höchstens einmal je Minispiel aufrufen.
   */
  backdrop(area: LookArea): void;
}

export interface MinigameContext {
  readonly scene: Scene;
  readonly players: readonly MinigamePlayer[];
  readonly seed: number;
  readonly rng: MinigameRng;
  /** Spielzeit in ms (normal `info.durationMs`; nach Host-Neuladen ggf. die Restzeit). */
  readonly timeLimitMs: number;
  readonly fx: MinigameFx;
  readonly characters: CharacterFactory;
  /** Testmodus: keine Zufalls-Kamerafahrten, Effekte knapp (Screenshots stabil). */
  readonly testMode: boolean;
  /** Look der Laufzeit (Host); fehlt in Tests und Vorschauen ohne Look. */
  readonly look?: MinigameLook;
  /**
   * Aufstellung bei Teams bzw. Koop (CHAOS-89), fertig vom Server: nicht selbst neu einteilen.
   * Fehlt = jeder gegen jeden (auch, wenn ein Team-Spiel ohne Teams läuft, etwa in einer
   * Vorschau). Dann `outcome` weglassen.
   */
  readonly teams?: MinigameTeams;
  /**
   * Gibt das Bild ab, sobald das Zeitbudget für den Aufbau verbraucht ist (CHAOS-141): in
   * `prepare` zwischen Bauschritten `await ctx.pace()`, damit der Aufbau über mehrere Bilder
   * verteilt läuft statt ein Bild lang zu blockieren. Ohne Taktgeber des Hosts (Tests) löst es
   * sofort auf. Wirft `PrepareAborted`, wenn die Laufzeit inzwischen entsorgt wurde: Dann nichts
   * mehr bauen (das Werfen beendet `prepare` von selbst).
   */
  readonly pace: () => Promise<void>;
}

/** Laufende Anzeige für den Host-HUD (Punkte je Slot, Restzeit, optional Status). */
export interface MinigameHud {
  readonly remainingMs: number;
  readonly scores: readonly {
    readonly slot: Slot;
    readonly score: number;
    /** Kurzer Zustand („raus“, „im Ziel“, „×2“), ≤ 16 Zeichen. */
    readonly status?: string;
  }[];
  /** Kurze Meldung mitten im Spiel („Die Flut steigt!“), ≤ 32 Zeichen. */
  readonly banner?: string;
}

export interface Minigame {
  /** Szene aufbauen (Kamera, Licht, Figuren, Physik-Körper). Darf Assets laden. */
  prepare(context: MinigameContext): Promise<void>;
  /** Ab jetzt zählt die Spielzeit; Eingaben wirken. */
  start(): void;
  handleInput(slot: Slot, input: MinigameInput): void;
  /** Ein fester Logikschritt (`FIXED_STEP_SECONDS`). */
  update(dtSeconds: number): void;
  /** `null` solange das Spiel läuft, danach das endgültige Ergebnis. */
  getResult(): MinigameResult | null;
  getHud(): MinigameHud;
  /** Alles entfernen, was das Minispiel angelegt hat (idempotent). */
  dispose(): void;
}

/** Ein Minispiel-Modul: Steckbrief (rein) + Fabrik. */
export interface MinigameModule {
  readonly info: MinigameInfo;
  create(): Minigame;
}
