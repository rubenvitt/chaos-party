/**
 * Minispiel-Module bei Bedarf laden (CHAOS-86): je Spiel ein dynamischer Import, damit der
 * Host im Browser mit dem Katalog (~200 Spiele, CHAOS-80) nicht wächst. Vite legt jedes Spiel
 * in einen eigenen Chunk; `pnpm check:bundle` prüft, dass keines in Start oder Bühne rutscht.
 *
 * - Steckbriefe bleiben synchron (`./catalog.ts`, hier mit exportiert).
 * - `loadMinigameModule` lädt einmal je Spiel und merkt sich das Versprechen; ein
 *   fehlgeschlagener Import wird vergessen, damit ein späterer Versuch neu lädt.
 * - `loadedMinigameModule` liefert ein schon geladenes Modul synchron (kein Suspense-Flackern
 *   bei Wiederholung oder nach dem Vorladen).
 *
 * Neues Minispiel: hier eine Zeile in `MINIGAME_LOADERS` (zusätzlich zu `./index.ts`). Der
 * Test `lazy.test.ts` prüft, dass beide Register zum Katalog passen.
 *
 * Der Apple-Host (ein JavaScriptCore-Bündel ohne Nachladen) und Werkzeuge in Node nutzen
 * weiter das synchrone Register aus `./index.ts`.
 */
import type { MinigameModule } from '@chaos-party/minigame-sdk/babylon';
import { HALLO_BAUKASTEN_INFO } from './hallo-baukasten/info.ts';
import { KRUEMEL_KEHRAUS_INFO } from './kruemel-kehraus/info.ts';
import { KUCKUCKS_KLATSCHE_INFO } from './kuckucks-klatsche/info.ts';
import { PUDDING_GERANGEL_INFO } from './pudding-gerangel/info.ts';
import { PUMP_DUELL_INFO } from './pump-duell/info.ts';
import { PUMP_PARADE_INFO } from './pump-parade/info.ts';
import { PUMP_RIESE_INFO } from './pump-riese/info.ts';
import { PUMP_SOLO_INFO } from './pump-solo/info.ts';
import { SOCKENREGEN_INFO } from './sockenregen/info.ts';
import { WACKELTURM_INFO } from './wackelturm/info.ts';

export * from './catalog.ts';

export type MinigameLoader = () => Promise<MinigameModule>;

/** Lade-Funktion je Minispiel-Kennung, Reihenfolge wie `MINIGAME_INFOS`. */
export const MINIGAME_LOADERS: ReadonlyMap<string, MinigameLoader> = new Map<
  string,
  MinigameLoader
>([
  [PUMP_PARADE_INFO.id, () => import('./pump-parade/index.ts').then((m) => m.pumpParade)],
  [SOCKENREGEN_INFO.id, () => import('./sockenregen/index.ts').then((m) => m.sockenregen)],
  [
    PUDDING_GERANGEL_INFO.id,
    () => import('./pudding-gerangel/index.ts').then((m) => m.puddingGerangel),
  ],
  [WACKELTURM_INFO.id, () => import('./wackelturm/index.ts').then((m) => m.wackelturm)],
  [
    KUCKUCKS_KLATSCHE_INFO.id,
    () => import('./kuckucks-klatsche/index.ts').then((m) => m.kuckucksKlatsche),
  ],
  [
    KRUEMEL_KEHRAUS_INFO.id,
    () => import('./kruemel-kehraus/index.ts').then((m) => m.kruemelKehraus),
  ],
  [
    HALLO_BAUKASTEN_INFO.id,
    () => import('./hallo-baukasten/index.ts').then((m) => m.halloBaukasten),
  ],
  // Testspiele der Spielformen (CHAOS-89).
  [PUMP_DUELL_INFO.id, () => import('./pump-duell/index.ts').then((m) => m.pumpDuell)],
  [PUMP_SOLO_INFO.id, () => import('./pump-solo/index.ts').then((m) => m.pumpSolo)],
  [PUMP_RIESE_INFO.id, () => import('./pump-riese/index.ts').then((m) => m.pumpRiese)],
]);

export interface MinigameModuleCache {
  /** Lädt das Modul (einmal je Kennung) oder `undefined` bei unbekannter Kennung. */
  load(id: string): Promise<MinigameModule> | undefined;
  /** Schon geladenes Modul oder `undefined` (lädt nichts). */
  loaded(id: string): MinigameModule | undefined;
  /** Im Hintergrund laden; Fehler meldet erst der echte `load` beim Anzeigen. */
  preload(id: string): void;
}

/** Zwischenspeicher über beliebige Lade-Funktionen (für Tests mit eigenen Ladern). */
export function createMinigameModuleCache(
  loaders: ReadonlyMap<string, MinigameLoader>,
): MinigameModuleCache {
  const pending = new Map<string, Promise<MinigameModule>>();
  const ready = new Map<string, MinigameModule>();
  const load = (id: string): Promise<MinigameModule> | undefined => {
    const existing = pending.get(id);
    if (existing) return existing;
    const loader = loaders.get(id);
    if (!loader) return undefined;
    const promise = loader().then(
      (module) => {
        ready.set(id, module);
        return module;
      },
      (error: unknown) => {
        pending.delete(id);
        throw error;
      },
    );
    pending.set(id, promise);
    return promise;
  };
  return {
    load,
    loaded: (id) => ready.get(id),
    preload: (id) => {
      load(id)?.catch(() => undefined);
    },
  };
}

const cache = createMinigameModuleCache(MINIGAME_LOADERS);

export function loadMinigameModule(id: string): Promise<MinigameModule> | undefined {
  return cache.load(id);
}

export function loadedMinigameModule(id: string): MinigameModule | undefined {
  return cache.loaded(id);
}

export function preloadMinigameModule(id: string): void {
  cache.preload(id);
}
