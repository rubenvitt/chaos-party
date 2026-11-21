/**
 * Aufgeteiltes Host-Bundle (CHAOS-53): Das Start-Bundle enthält nur React, Lobby, HUD und die
 * Verbindung. Babylon und die Szenen kommen als eigene Chunks per dynamischem Import:
 *
 * - **Arena** (`createGameScene`): hinter der Lobby und im Arena-Modus; lädt sofort nach dem
 *   ersten Bild der Lobby.
 * - **Brett** (`BoardStage` mit Finale und Podest) und **Minispiel-Bühne** (ohne Minispiele):
 *   lädt die App vorab, sobald die Arena steht ({@link prefetchGameScenes}), damit der
 *   Wechsel in die Partie nicht auf das Netz wartet.
 * - **Je Minispiel** ein eigener Chunk (CHAOS-86, `@chaos-party/minigames/lazy`): lädt die App,
 *   sobald der Stand das Minispiel der Runde nennt (ab der Anleitung). So wächst weder Start
 *   noch Bühne mit dem Katalog.
 * - **Entwickler-Ansichten** (`?local=1&minigame=…`): nur bei Bedarf.
 *
 * Vite legt gemeinsam genutzte Babylon-Module in geteilte Chunks; jeder Import lädt also nur,
 * was noch fehlt.
 */
export const loadArenaScene = () => import('./scene/createGameScene.ts');
export const loadBoardStage = () => import('./board/BoardStage.tsx');
export const loadMinigameScreen = () => import('./minigame/MinigameScreenById.tsx');
export const loadLocalMinigameFlow = () => import('./minigame/LocalMinigameFlow.tsx');
export const loadMinigamePreview = () => import('./minigame/MinigamePreview.tsx');

/**
 * Brett und Minispiel-Bühne im Hintergrund laden (einmal je Seite). Fehler hier sind egal:
 * Der echte Import beim Szenenwechsel meldet sie dann selbst.
 */
let prefetched = false;
export function prefetchGameScenes(): void {
  if (prefetched) return;
  prefetched = true;
  const ignore = () => undefined;
  loadBoardStage().catch(ignore);
  loadMinigameScreen().catch(ignore);
}

/**
 * Chunk nicht ladbar (CHAOS-53): Meist wurde der Host neu gebaut, während die Seite offen
 * war, und die alten Dateinamen gibt es nicht mehr. Dann die Seite neu laden (der Server
 * kennt die Host-Rückkehr, ADR-015) – höchstens einmal je 30 s, damit ein dauerhaft
 * fehlender Chunk keine Neulade-Schleife auslöst.
 */
export function reloadOnChunkError(target: Window): void {
  target.addEventListener('vite:preloadError', (event) => {
    const key = 'chaos-chunk-reload';
    const now = Date.now();
    let last: number;
    try {
      last = Number(target.sessionStorage.getItem(key) ?? 0);
      target.sessionStorage.setItem(key, String(now));
    } catch {
      return;
    }
    if (now - last < 30_000) return;
    event.preventDefault();
    target.location.reload();
  });
}
