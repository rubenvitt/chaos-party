/**
 * URLs der Klang-Dateien (CHAOS-223) für den Browser-Host. Vite kopiert die MP3s aus
 * `packages/assets/sounds/` in den Build (Glob zur Build-Zeit). Nur im Browser importieren –
 * der Apple-Host bündelt `samples.ts` ohne `import.meta`.
 */
const files = import.meta.glob<string>('../../../../packages/assets/sounds/*.mp3', {
  query: '?url',
  import: 'default',
  eager: true,
});

/** Dateiname (`coin-2.mp3`) → URL im Build. */
export const SAMPLE_URLS: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(files).map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1), url]),
);
