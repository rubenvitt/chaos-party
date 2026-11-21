import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/** Port des Session-Servers (`pnpm --filter @chaos-party/server dev`). */
const SERVER_PORT = Number(process.env.CHAOS_SERVER_PORT ?? 8787);

export default defineConfig({
  // Der Node-Server liefert den Host-Build unter /host/ aus (ADR-007); Dev und Preview
  // laufen unter demselben Pfad, damit Asset-URLs (auch Havok-WASM, C1) überall gleich sind.
  base: '/host/',
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    // Im LAN erreichbar, damit echte Geräte den Dev-Server öffnen können.
    host: true,
    // Der Host verbindet sich immer mit `/ws` am eigenen Ursprung; im Dev-Server
    // leitet Vite das an den Session-Server weiter (ADR-007, Dev-Topologie).
    proxy: {
      '/ws': { target: `ws://localhost:${String(SERVER_PORT)}`, ws: true },
      // Export der Daumen-Stimmen (CHAOS-87) vom Server.
      '/ratings.json': { target: `http://localhost:${String(SERVER_PORT)}` },
    },
  },
  preview: {
    port: 4173,
    strictPort: true,
    proxy: {
      '/ws': { target: `ws://localhost:${String(SERVER_PORT)}`, ws: true },
      // Export der Daumen-Stimmen (CHAOS-87) vom Server.
      '/ratings.json': { target: `http://localhost:${String(SERVER_PORT)}` },
    },
  },
  optimizeDeps: {
    // Havok nicht vorbündeln: Das Modul sucht seine WASM-Datei relativ zu sich selbst.
    // Wir übergeben die URL zwar per `locateFile` (src/scene/havok.ts), halten das
    // Modul aber trotzdem unverändert, damit Dev und Build gleich laden (ADR-004).
    exclude: ['@babylonjs/havok'],
  },
  build: {
    target: 'es2022',
    // Szenen sind eigene Chunks (CHAOS-53, ADR-004 Nachtrag 1); der größte geteilte Babylon-Chunk
    // liegt bei ≈ 950 kB. Das Start-Bundle prüft `pnpm check:bundle` gesondert.
    chunkSizeWarningLimit: 1200,
    // Klang-Dateien (CHAOS-223) bleiben Dateien: als Base64 inline landeten sie im Start-Bundle
    // (`fx/sampleUrls.ts` hängt an `audio.ts`), und geladen werden sie ohnehin erst nach dem Klick.
    assetsInlineLimit: (file) => (file.endsWith('.mp3') ? false : undefined),
    // `dist/.vite/manifest.json`: `pnpm check:bundle` prüft damit, dass jedes Minispiel ein
    // eigener Chunk außerhalb von Start und Bühne ist (CHAOS-86).
    manifest: true,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              // Steckbriefe (`<spiel>/info.ts`) nutzen Start (Katalog) und Spiel-Chunks gemeinsam.
              // Ohne Gruppe legt Rolldown je Steckbrief eine eigene Mini-Datei in den Start –
              // bei ~200 Spielen 200 Anfragen. So bleibt es ein Katalog-Chunk (CHAOS-86).
              name: 'minispiel-katalog',
              test: /packages[\\/]minigames[\\/]src[\\/](?:catalog|lazy|[^\\/]+[\\/]info)\.ts$/,
            },
          ],
        },
      },
    },
  },
});
