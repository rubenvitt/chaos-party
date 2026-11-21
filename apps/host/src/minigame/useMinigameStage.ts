/**
 * Bühnen-Chunk (`MinigameScreenById`) ohne `React.lazy` (CHAOS-86): `lazy` hält auch einen
 * längst geladenen Chunk beim ersten Rendern per Suspense an, und React deckt einen einmal
 * gezeigten Fallback frühestens nach 300 ms auf (Suspense-Drossel). Gemessen waren das 300 ms
 * Warten beim ersten Minispiel jeder Partie. Stattdessen lädt die App den Chunk in der
 * Brettphase (meist längst vorgeladen, `prefetchGameScenes`) und hängt die Bühne erst ein,
 * wenn die Komponente da ist.
 *
 * Fehlschlag: `vite:preloadError` lädt die Seite neu (`reloadOnChunkError`); hier nur Konsole.
 */
import { useEffect, useState } from 'react';
import { loadMinigameScreen } from '../lazyScenes.ts';
import type { MinigameScreenById } from './MinigameScreenById.tsx';

export type MinigameStageComponent = typeof MinigameScreenById;

export function useMinigameStage(enabled: boolean): MinigameStageComponent | null {
  const [stage, setStage] = useState<{ readonly component: MinigameStageComponent } | null>(null);
  const loaded = stage !== null;
  useEffect(() => {
    if (!enabled || loaded) return;
    let active = true;
    loadMinigameScreen().then(
      (module) => {
        if (active) setStage({ component: module.MinigameScreenById });
      },
      (error: unknown) => {
        if (active) console.error('Minispiel-Bühne konnte nicht geladen werden', error);
      },
    );
    return () => {
      active = false;
    };
  }, [enabled, loaded]);
  return stage?.component ?? null;
}
