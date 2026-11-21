/**
 * Klänge der Minispiele für Swift (CHAOS-190): dieselben Klänge wie im Browser-Host, als fertige
 * Rezepte in `renderState().minigame.sounds` (wie `board.sounds`, CHAOS-143). Swift synthetisiert
 * sie mit derselben Synthese wie die Brett-Klänge (`app/BoardSounds.swift`).
 *
 * Quellen wie im Browser-Host:
 * - `ctx.fx.sound` der Minispiele (`fx/minigameFx.ts`; „go“ zum Start, „win“ zum Ende, dazwischen
 *   die Klänge des Spiels) kommt über `onSound` der Headless-Bühne (`./stage.ts`).
 * - Jubel im Ergebnis (`stage.celebrate`: „cheer“) ebenfalls über die Bühne.
 * - Anleitung (`MinigameScreen`): „minigame-start“, wenn das Minispiel in der Anleitung
 *   erscheint, und „tick“ bei 3, 2 und 1 s Countdown (bei 1 höher). Das erkennt `observe` je
 *   `tick`, unabhängig von der Bühne (die fehlt, solange Havok noch lädt).
 */
import type { MINIGAME_STAGES } from '@chaos-party/protocol';
import type { PlayOptions, SoundName } from '../../host/src/fx/sounds.ts';
import { SOUND_WINDOW_MS } from './boardDirection.ts';
import type { SoundCue } from './contract.ts';
import { soundCue, toCue } from './soundCue.ts';

type MinigameStage = (typeof MINIGAME_STAGES)[number];

/** Höchstens so viele Klänge hält das Fenster (Minispiele mit vielen Klängen je Sekunde). */
export const MAX_MINIGAME_SOUNDS = 48;
/** Countdown-Ticks der Anleitung wie im Browser-Host: bei 3, 2 und 1 s. */
export const COUNTDOWN_TICKS = [3, 2, 1] as const;

/** Stand der wartenden Anleitung (CHAOS-214): bereite bzw. getrennte Spieler von allen. */
export interface ReadyProgress {
  readonly done: number;
  readonly total: number;
}

export interface MinigameSounds {
  /**
   * Klang auslösen. `key` ist der Bühnen-Schlüssel (`stageKeyOf`) des Minispiels, zu dem er
   * gehört; fehlt er, der zuletzt beobachtete.
   */
  play(name: SoundName, options?: PlayOptions, key?: string): void;
  /**
   * Je `tick`: gezeigtes Minispiel (`stageKeyOf`, `null` = keins), Abschnitt und Countdown der
   * Anleitung (`introCountdown`). Löst „minigame-start“ und die Countdown-Ticks aus.
   */
  observe(
    key: string | null,
    stage: MinigameStage | null,
    countdown: number | null,
    ready?: ReadyProgress | null,
  ): void;
  /** Klänge des Minispiels `key` aus den letzten `SOUND_WINDOW_MS`. */
  cues(key: string | null): SoundCue[];
}

export function createMinigameSounds(now: () => number): MinigameSounds {
  /**
   * IDs über die ganze Lebenszeit des Kerns fortlaufend (nicht je Minispiel): Eine Revanche mit
   * gleicher Runde und gleichem Spiel bliebe sonst unter Swifts zuletzt gespielter ID stumm.
   */
  let nextId = 1;
  let cues: (SoundCue & { readonly at: number; readonly key: string })[] = [];
  let currentKey: string | null = null;
  let lastCountdown: number | null = null;
  let lastReady = 0;

  const expire = () => {
    const t = now();
    if (cues.length > 0 && t - (cues[0]?.at ?? t) >= SOUND_WINDOW_MS) {
      cues = cues.filter((cue) => t - cue.at < SOUND_WINDOW_MS);
    }
  };

  const play = (name: SoundName, options?: PlayOptions, key?: string) => {
    const owner = key ?? currentKey;
    if (owner === null) return;
    cues.push({ ...soundCue(nextId++, name, options), at: now(), key: owner });
    if (cues.length > MAX_MINIGAME_SOUNDS) cues.splice(0, cues.length - MAX_MINIGAME_SOUNDS);
  };

  return {
    play,
    observe(key, stage, countdown, ready) {
      if (key !== currentKey) {
        currentKey = key;
        lastCountdown = null;
        lastReady = 0;
        // Wie `MinigameScreen` beim Erscheinen: nur, wenn es in der Anleitung beginnt.
        if (key !== null && stage === 'intro') play('minigame-start', undefined, key);
      }
      const shown = key !== null && stage === 'intro' ? countdown : null;
      // Wie der Effekt auf `introSeconds`: jede Änderung auf 3, 2 oder 1 tickt, auch der erste Wert.
      if (shown !== lastCountdown && shown !== null && shown >= 1 && shown <= 3) {
        play('tick', { pitch: shown === 1 ? 1.25 : 1 }, key ?? undefined);
      }
      lastCountdown = shown;
      // CHAOS-214: Statt Countdown tickt jedes neue „Bereit“, das letzte etwas höher.
      const done = key !== null && stage === 'intro' && ready ? ready.done : 0;
      if (ready && done > lastReady) {
        play('tick', { pitch: done >= ready.total ? 1.25 : 1 }, key ?? undefined);
      }
      lastReady = done;
      expire();
    },
    cues(key) {
      expire();
      if (key === null) return [];
      return cues.filter((cue) => cue.key === key).map(toCue);
    },
  };
}
