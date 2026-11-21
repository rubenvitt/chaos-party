/**
 * Klang-Ausgabe des Hosts (CHAOS-33, CHAOS-223): spielt echte Klang-Dateien (CC0, `samples.ts`)
 * per WebAudio ab, bis sie geladen sind (oder wenn eine fehlt) die Rezepte aus `sounds.ts`.
 *
 * - Die Dateien lädt `unlock()` (Abruf und `decodeAudioData`, einmal je Datei); jede Wahl kommt
 *   aus dem gemeinsamen Picker (Varianten reihum, Tonhöhen-Streuung), wie im Apple-Host.
 *
 * - Der `AudioContext` entsteht erst mit `unlock()` – das muss in einer Nutzer-Geste passieren
 *   (Browser-Autoplay-Regeln). Der „Los geht’s!“-Klick in der Lobby ruft es auf, zusätzlich
 *   schaltet die erste Taste/Klick auf der Seite frei (`unlockOnFirstGesture`). Vorher
 *   gespielte Klänge entfallen still.
 * - Stumm (`?mute=1`, Testmodus): kein `AudioContext`, `play` zählt nur mit.
 * - Gesamtlautstärke über einen Master-Pegel mit Kompressor (verhindert Übersteuern, wenn
 *   viele Klänge gleichzeitig kommen); höchstens `MAX_VOICES` Stimmen gleichzeitig.
 */
import { SAMPLE_URLS } from './sampleUrls.ts';
import { createSamplePicker, type SampleChoice } from './samples.ts';
import { SOUNDS, shapeRecipe, type PlayOptions, type SoundName, type Voice } from './sounds.ts';

/** Gleichzeitige Stimmen; darüber hinaus werden neue Klänge verworfen. */
export const MAX_VOICES = 32;
/** Standard-Gesamtlautstärke 0…1. */
export const DEFAULT_VOLUME = 0.7;

export interface SoundEngine {
  readonly muted: boolean;
  /** `AudioContext` angelegt (nach einer Nutzer-Geste). */
  readonly unlocked: boolean;
  /** Abgespielte (bzw. stumm gezählte) Klänge – für Tests und Debug. */
  readonly played: number;
  readonly lastPlayed: SoundName | null;
  /** Geladene Klang-Dateien (nach `unlock()`); bis dahin spielen die Rezepte. */
  readonly samplesLoaded: number;
  /** In einer Nutzer-Geste aufrufen; legt den `AudioContext` an bzw. weckt ihn. */
  unlock(): void;
  play(name: SoundName, options?: PlayOptions): void;
  /** Gesamtlautstärke 0…1. */
  setVolume(volume: number): void;
}

export interface SoundEngineOptions {
  readonly muted: boolean;
  readonly volume?: number;
  /** Fabrik für den Kontext (Tests); Standard: `new AudioContext()`. */
  readonly createContext?: () => AudioContext;
  /** Dateiname → URL der Klang-Dateien; Standard: alle aus `packages/assets/sounds/`. */
  readonly sampleUrls?: Readonly<Record<string, string>>;
  /** Abruf der Dateien (Tests); Standard: `fetch`. */
  readonly fetchSample?: (url: string) => Promise<ArrayBuffer>;
}

export function createSoundEngine(options: SoundEngineOptions): SoundEngine {
  const { muted } = options;
  let volume = clampVolume(options.volume ?? DEFAULT_VOLUME);
  let context: AudioContext | null = null;
  let master: GainNode | null = null;
  let noise: AudioBuffer | null = null;
  let voices = 0;
  let played = 0;
  const samples = new Map<string, AudioBuffer>();
  const pickSample = createSamplePicker();
  const sampleUrls = options.sampleUrls ?? SAMPLE_URLS;
  const fetchSample =
    options.fetchSample ??
    (async (url: string) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${url}: HTTP ${String(res.status)}`);
      return res.arrayBuffer();
    });
  let lastPlayed: SoundName | null = null;

  const createContext =
    options.createContext ??
    (() => {
      const Ctor = globalThis.AudioContext as typeof AudioContext | undefined;
      if (!Ctor) throw new Error('WebAudio nicht verfügbar');
      return new Ctor();
    });

  function setup(ctx: AudioContext) {
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -14;
    compressor.ratio.value = 6;
    compressor.connect(ctx.destination);
    master = ctx.createGain();
    master.gain.value = volume;
    master.connect(compressor);
    // Weißes Rauschen (1 s) für alle Rausch-Stimmen; Zufall hier ist reine Klangfarbe.
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let index = 0; index < data.length; index++) data[index] = Math.random() * 2 - 1;
    loadSamples(ctx);
  }

  /** Alle Klang-Dateien laden; was fehlt oder nicht dekodiert, spielt weiter als Rezept. */
  function loadSamples(ctx: AudioContext) {
    for (const [file, url] of Object.entries(sampleUrls)) {
      fetchSample(url)
        .then((bytes) => ctx.decodeAudioData(bytes))
        .then((buffer) => samples.set(file, buffer))
        .catch((error: unknown) => {
          console.warn(`Klang ${file} nicht geladen, Rezept als Ersatz`, error);
        });
    }
  }

  function playSample(
    ctx: AudioContext,
    output: GainNode,
    buffer: AudioBuffer,
    choice: SampleChoice,
  ) {
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = choice.rate;
    const level = ctx.createGain();
    level.gain.value = choice.gain;
    source.connect(level);
    level.connect(output);
    voices++;
    source.onended = () => {
      voices--;
      source.disconnect();
      level.disconnect();
    };
    source.start();
  }

  function playVoice(ctx: AudioContext, output: GainNode, voice: Voice) {
    const start = ctx.currentTime + (voice.delay ?? 0);
    const end = start + voice.duration;
    let source: AudioScheduledSourceNode;
    if (voice.wave === 'noise') {
      const buffer = ctx.createBufferSource();
      buffer.buffer = noise;
      buffer.loop = true;
      source = buffer;
    } else {
      const osc = ctx.createOscillator();
      osc.type = voice.wave;
      osc.frequency.setValueAtTime(voice.freq, start);
      if (voice.freqEnd !== undefined) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, voice.freqEnd), end);
      }
      source = osc;
    }
    const envelope = ctx.createGain();
    const peak = Math.max(0.0002, voice.gain);
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.linearRampToValueAtTime(peak, start + Math.max(0.001, voice.attack));
    envelope.gain.exponentialRampToValueAtTime(0.0001, end);
    let last: AudioNode = source;
    if (voice.filter) {
      const filter = ctx.createBiquadFilter();
      filter.type = voice.filter.type;
      filter.frequency.setValueAtTime(voice.filter.freq, start);
      if (voice.filter.freqEnd !== undefined) {
        filter.frequency.exponentialRampToValueAtTime(voice.filter.freqEnd, end);
      }
      if (voice.filter.q !== undefined) filter.Q.value = voice.filter.q;
      source.connect(filter);
      last = filter;
    }
    last.connect(envelope);
    envelope.connect(output);
    voices++;
    source.onended = () => {
      voices--;
      source.disconnect();
      envelope.disconnect();
      if (last !== source) last.disconnect();
    };
    source.start(start);
    source.stop(end + 0.02);
  }

  return {
    muted,
    get unlocked() {
      return context !== null;
    },
    get played() {
      return played;
    },
    get lastPlayed() {
      return lastPlayed;
    },
    get samplesLoaded() {
      return samples.size;
    },
    unlock() {
      if (muted) return;
      try {
        if (!context) {
          context = createContext();
          setup(context);
        }
        if (context.state === 'suspended') void context.resume();
      } catch (error) {
        console.warn('Ton nicht verfügbar', error);
      }
    },
    play(name, playOptions) {
      played++;
      lastPlayed = name;
      if (muted || !context || !master || context.state !== 'running') return;
      const choice = pickSample(name, playOptions);
      const buffer = choice ? samples.get(choice.file) : undefined;
      if (choice && buffer) {
        if (voices + 1 > MAX_VOICES) return;
        playSample(context, master, buffer, choice);
        return;
      }
      const recipe = shapeRecipe(SOUNDS[name].recipe, playOptions);
      if (voices + recipe.length > MAX_VOICES) return;
      for (const voice of recipe) playVoice(context, master, voice);
    },
    setVolume(next) {
      volume = clampVolume(next);
      if (master && context) master.gain.setTargetAtTime(volume, context.currentTime, 0.05);
    },
  };
}

function clampVolume(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : DEFAULT_VOLUME;
}

/** Schaltet den Ton mit der ersten Taste/dem ersten Klick frei (z. B. nach Host-Neuladen). */
export function unlockOnFirstGesture(engine: SoundEngine, target: EventTarget): () => void {
  const events = ['pointerdown', 'keydown', 'touchstart'] as const;
  const handler = () => {
    engine.unlock();
    stop();
  };
  const stop = () => {
    for (const type of events) target.removeEventListener(type, handler);
  };
  for (const type of events) target.addEventListener(type, handler);
  return stop;
}

/** Klang-Ausgabe der Seite; bis `configureSound` stumm (Tests, Node). */
let shared: SoundEngine = createSoundEngine({ muted: true });

export function configureSound(options: SoundEngineOptions): SoundEngine {
  shared = createSoundEngine(options);
  return shared;
}

export function soundEngine(): SoundEngine {
  return shared;
}
