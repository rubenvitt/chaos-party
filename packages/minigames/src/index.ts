/**
 * Babylon-Module aller Minispiele, synchron. Reihenfolge wie `MINIGAME_INFOS`.
 *
 * Für den Apple-Host (ein JavaScriptCore-Bündel), Tests und Werkzeuge in Node. Der Host im
 * Browser importiert diese Datei **nicht**, sondern lädt je Spiel über `./lazy.ts`
 * (CHAOS-86, ESLint-Regel in `eslint.config.js`, `pnpm check:bundle`).
 */
import type { MinigameModule } from '@chaos-party/minigame-sdk/babylon';
import { halloBaukasten } from './hallo-baukasten/index.ts';
import { kruemelKehraus } from './kruemel-kehraus/index.ts';
import { kuckucksKlatsche } from './kuckucks-klatsche/index.ts';
import { puddingGerangel } from './pudding-gerangel/index.ts';
import { pumpDuell } from './pump-duell/index.ts';
import { pumpParade } from './pump-parade/index.ts';
import { pumpRiese } from './pump-riese/index.ts';
import { pumpSolo } from './pump-solo/index.ts';
import { sockenregen } from './sockenregen/index.ts';
import { wackelturm } from './wackelturm/index.ts';

export * from './catalog.ts';

export const MINIGAME_MODULES: readonly MinigameModule[] = [
  pumpParade,
  sockenregen,
  puddingGerangel,
  wackelturm,
  kuckucksKlatsche,
  kruemelKehraus,
  halloBaukasten,
  pumpDuell,
  pumpSolo,
  pumpRiese,
];

export function getMinigameModule(id: string): MinigameModule | undefined {
  return MINIGAME_MODULES.find((module) => module.info.id === id);
}
