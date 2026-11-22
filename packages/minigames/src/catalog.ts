/**
 * Reiner Katalog aller Minispiele (nur Steckbriefe, kein Babylon). Server, game-core-
 * Konfiguration und Controller nutzen ihn; der Host im Browser lädt die Module je Spiel über
 * `./lazy.ts` (CHAOS-86), Apple-Host und Werkzeuge synchron über `./index.ts`.
 *
 * Neues Minispiel: Ordner `src/<id>/` mit `info.ts` (rein) und `index.ts` (Modul), hier in
 * `MINIGAME_INFOS` und – wenn es in Partien vorkommen soll – in `ROTATION` eintragen, in
 * `index.ts` das Modul registrieren, in `lazy.ts` eine Lade-Funktion ergänzen und in
 * `steckbriefe.ts` den Vielfalts-Steckbrief anlegen.
 * Bausteine dafür im Baukasten `@chaos-party/minigame-kit` (ADR-021); Muster: `hallo-baukasten/`.
 */
import type { MinigameInfo } from '@chaos-party/minigame-sdk';
import { HALLO_BAUKASTEN_INFO } from './hallo-baukasten/info.ts';
import { KRUEMEL_KEHRAUS_INFO } from './kruemel-kehraus/info.ts';
import { KUCKUCKS_KLATSCHE_INFO } from './kuckucks-klatsche/info.ts';
import { PUDDING_GERANGEL_INFO } from './pudding-gerangel/info.ts';
import { PUMP_DUELL_INFO } from './pump-duell/info.ts';
import { PUMP_PARADE_INFO } from './pump-parade/info.ts';
import { PUMP_RIESE_INFO } from './pump-riese/info.ts';
import { PUMP_SOLO_INFO } from './pump-solo/info.ts';
import { SCHNELLFEUER_INFO } from './schnellfeuer/info.ts';
import { SOCKENREGEN_INFO } from './sockenregen/info.ts';
import { TOASTER_TIMING_INFO } from './toaster-timing/info.ts';
import { NUSSREGEN_NETZ_INFO } from './nussregen-netz/info.ts';
import { MATSCHMALER_INFO } from './matschmaler/info.ts';
import { RASENSPRENGER_RODEO_INFO } from './rasensprenger-rodeo/info.ts';
import { SCHNAPP_DEN_KAESE_INFO } from './schnapp-den-kaese/info.ts';
import { WACKELTURM_INFO } from './wackelturm/info.ts';

/** Vielfalts-Steckbriefe (ADR-021): rein, auch für Server und Rotation (CHAOS-85). */
export { getSteckbrief, STECKBRIEFE } from './steckbriefe.ts';

export const MINIGAME_INFOS: readonly MinigameInfo[] = [
  PUMP_PARADE_INFO,
  SOCKENREGEN_INFO,
  PUDDING_GERANGEL_INFO,
  WACKELTURM_INFO,
  KUCKUCKS_KLATSCHE_INFO,
  KRUEMEL_KEHRAUS_INFO,
  HALLO_BAUKASTEN_INFO,
  // Pilotwelle der Minispiel-Fabrik (CHAOS-91).
  TOASTER_TIMING_INFO,
  NUSSREGEN_NETZ_INFO,
  MATSCHMALER_INFO,
  RASENSPRENGER_RODEO_INFO,
  SCHNAPP_DEN_KAESE_INFO,
  // Testspiele der Spielformen (CHAOS-89), nicht in der Rotation.
  PUMP_DUELL_INFO,
  PUMP_SOLO_INFO,
  PUMP_RIESE_INFO,
  SCHNELLFEUER_INFO,
];

/**
 * Minispiele, die in echten Partien vorkommen (Reihenfolge egal; game-core mischt per Seed).
 * Solange keines eingetragen ist, läuft die Pump-Parade als Rückfall.
 */
export const ROTATION: readonly string[] = [
  SOCKENREGEN_INFO.id,
  PUDDING_GERANGEL_INFO.id,
  WACKELTURM_INFO.id,
  KUCKUCKS_KLATSCHE_INFO.id,
  KRUEMEL_KEHRAUS_INFO.id,
  // Pilotwelle (CHAOS-91), hinten angehängt: Integrationstests nutzen ROTATION[0]/[1].
  TOASTER_TIMING_INFO.id,
  NUSSREGEN_NETZ_INFO.id,
  MATSCHMALER_INFO.id,
  RASENSPRENGER_RODEO_INFO.id,
  SCHNAPP_DEN_KAESE_INFO.id,
];

/**
 * Schnellfeuer (CHAOS-90): eigene Rundenart, **nicht** in `ROTATION`. game-core setzt es statt
 * des gezogenen Minispiels ein, wenn der Auslöser `rules.rapidFire` greift.
 */
export const RAPID_FIRE_ID = SCHNELLFEUER_INFO.id;
export { SCHNELLFEUER_INFO };

export function getMinigameInfo(id: string): MinigameInfo | undefined {
  return MINIGAME_INFOS.find((info) => info.id === id);
}

/** Steckbriefe der Rotation (oder der Rückfall). */
export function rotationInfos(): MinigameInfo[] {
  const infos = ROTATION.map((id) => getMinigameInfo(id)).filter(
    (info): info is MinigameInfo => info !== undefined,
  );
  return infos.length > 0 ? infos : [PUMP_PARADE_INFO];
}
