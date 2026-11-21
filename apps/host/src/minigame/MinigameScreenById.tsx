/**
 * Einstieg des Bühnen-Chunks (CHAOS-53): die Minispiel-Bühne ohne Minispiele. Die App kennt
 * nur den reinen Katalog (`@chaos-party/minigames/catalog`) und lädt diese Datei erst, wenn
 * ein Minispiel ansteht (oder vorab in der Lobby, siehe `lazyScenes.ts`). Das Modul des
 * Spiels kommt als eigener Chunk dazu (CHAOS-86, `useMinigameModule`).
 */
import { MinigameScreen, type MinigameScreenProps } from './MinigameScreen.tsx';
import { useMinigameModule } from './useMinigameModule.ts';

export interface MinigameScreenByIdProps extends Omit<MinigameScreenProps, 'module'> {
  readonly minigameId: string;
}

export function MinigameScreenById({ minigameId, ...props }: MinigameScreenByIdProps) {
  const module = useMinigameModule(minigameId);
  return module ? <MinigameScreen {...props} module={module} /> : null;
}
