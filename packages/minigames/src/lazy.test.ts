/**
 * Lade-Register (CHAOS-86): passt zu Katalog und synchronem Register, lädt einmal je Spiel,
 * vergisst Fehlschläge.
 */
import type { MinigameModule } from '@chaos-party/minigame-sdk/babylon';
import { describe, expect, it, vi } from 'vitest';
import { getMinigameModule, MINIGAME_MODULES } from './index.ts';
import {
  createMinigameModuleCache,
  loadedMinigameModule,
  loadMinigameModule,
  MINIGAME_INFOS,
  MINIGAME_LOADERS,
  type MinigameLoader,
} from './lazy.ts';

describe('Lade-Register der Minispiele', () => {
  it('hat genau eine Lade-Funktion je Steckbrief, in Katalog-Reihenfolge', () => {
    expect([...MINIGAME_LOADERS.keys()]).toEqual(MINIGAME_INFOS.map((info) => info.id));
  });

  it.each(MINIGAME_MODULES.map((module) => [module.info.id] as const))(
    '%s lädt dasselbe Modul wie das synchrone Register',
    async (id) => {
      expect(loadedMinigameModule(id)).toBeUndefined();
      const module = await loadMinigameModule(id);
      expect(module).toBe(getMinigameModule(id));
      expect(loadedMinigameModule(id)).toBe(module);
    },
  );

  it('unbekannte Kennung lädt nichts', () => {
    expect(loadMinigameModule('gibt-es-nicht')).toBeUndefined();
    expect(loadedMinigameModule('gibt-es-nicht')).toBeUndefined();
  });
});

describe('createMinigameModuleCache', () => {
  const module = { info: { id: 'probe' } } as unknown as MinigameModule;

  it('lädt je Kennung nur einmal, auch bei gleichzeitigen Aufrufen', async () => {
    const loader = vi.fn<MinigameLoader>(() => Promise.resolve(module));
    const cache = createMinigameModuleCache(new Map([['probe', loader]]));
    const first = cache.load('probe');
    cache.preload('probe');
    expect(cache.load('probe')).toBe(first);
    expect(cache.loaded('probe')).toBeUndefined();
    await expect(first).resolves.toBe(module);
    expect(cache.loaded('probe')).toBe(module);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('vergisst einen fehlgeschlagenen Import, der nächste Versuch lädt neu', async () => {
    const loader = vi
      .fn<MinigameLoader>()
      .mockRejectedValueOnce(new Error('Chunk fehlt'))
      .mockResolvedValueOnce(module);
    const cache = createMinigameModuleCache(new Map([['probe', loader]]));
    await expect(cache.load('probe')).rejects.toThrow('Chunk fehlt');
    expect(cache.loaded('probe')).toBeUndefined();
    await expect(cache.load('probe')).resolves.toBe(module);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('Vorladen schluckt Fehler (keine unbehandelte Ablehnung)', async () => {
    const loader = vi.fn<MinigameLoader>(() => Promise.reject(new Error('offline')));
    const cache = createMinigameModuleCache(new Map([['probe', loader]]));
    cache.preload('probe');
    await Promise.resolve();
    await Promise.resolve();
    expect(loader).toHaveBeenCalledTimes(1);
    expect(cache.loaded('probe')).toBeUndefined();
  });
});
