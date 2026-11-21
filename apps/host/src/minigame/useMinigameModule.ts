/**
 * Minispiel-Modul für die Bühne (CHAOS-86): je Spiel ein eigener Chunk, geladen über
 * `@chaos-party/minigames/lazy`.
 *
 * - {@link useMinigameModuleStatus} (App): lädt das Modul, sobald der Stand das Minispiel
 *   nennt, und meldet `ready`. Die App hängt die Bühne erst dann ein. So wartet nichts per
 *   Suspense: Hat React einmal einen Fallback gezeigt, deckt es den Inhalt frühestens nach
 *   300 ms auf (Suspense-Drossel) – gemessen genau so viel Warten je Minispiel.
 * - {@link useMinigameModule} (Bühne, Entwickler-Ansichten): liefert ein geladenes Modul
 *   synchron, sonst wartet die Komponente per Suspense auf den Import. Fehlschläge gehen an die
 *   nächste Fehlergrenze bzw. lösen `vite:preloadError` aus (`lazyScenes.ts`).
 *
 * `undefined` = unbekannte Kennung.
 */
import type { MinigameModule } from '@chaos-party/minigame-sdk/babylon';
import { loadedMinigameModule, loadMinigameModule } from '@chaos-party/minigames/lazy';
import { use, useEffect, useState } from 'react';

export function useMinigameModule(id: string): MinigameModule | undefined {
  const ready = loadedMinigameModule(id);
  if (ready) return ready;
  const pending = loadMinigameModule(id);
  return pending ? use(pending) : undefined;
}

/**
 * `ready`: Modul geladen (oder Kennung unbekannt – dann entscheidet die Bühne);
 * `loading`: Import läuft; `failed`: Import fehlgeschlagen – die Bühne darf trotzdem
 * einhängen, ihr eigener Import meldet den Fehler. `idle` ohne Kennung.
 */
export type MinigameModuleStatus = 'idle' | 'loading' | 'ready' | 'failed';

export function useMinigameModuleStatus(id: string | undefined): MinigameModuleStatus {
  const [failedId, setFailedId] = useState<string | null>(null);
  const [, setLoadedId] = useState<string | null>(null);
  const pending =
    id !== undefined && !loadedMinigameModule(id) ? loadMinigameModule(id) : undefined;
  useEffect(() => {
    if (id === undefined || !pending) return;
    let active = true;
    pending.then(
      () => {
        if (active) setLoadedId(id);
      },
      () => {
        if (active) setFailedId(id);
      },
    );
    return () => {
      active = false;
    };
  }, [id, pending]);
  if (id === undefined) return 'idle';
  if (!pending) return 'ready';
  return failedId === id ? 'failed' : 'loading';
}
