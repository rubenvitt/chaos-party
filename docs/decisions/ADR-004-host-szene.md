# ADR-004: Host-Szene mit Babylon.js und Havok – WASM-Laden, Eingabe-Naht, Testmodus

**Status:** Angenommen
**Datum:** 2026-11-14
**Aufgabe:** CHAOS-8
**Betroffene Annahmen:** `docs/assumptions.md` C1, C2, C3, C4, C5

## Kontext

CHAOS-8 bringt die erste echte Spielszene auf den PC-Host: Babylon.js-Canvas mit React-Overlay, eine steuerbare Figur pro Spieler in Spielerfarbe und Havok-Physik (Kollisionen, Schubsen). Offen waren:

- **C1:** Lädt `@babylonjs/havok` (WASM) im Vite-Dev-Server **und** im Production-Build?
- **C3:** Lassen sich Screenshots der Szene in Headless-Chromium stabil vergleichen?
- **C4:** Havok ist nicht bitgenau deterministisch – wie testen wir trotzdem Bewegung?
- **C5:** Wie kommen React (DOM) und Babylon (Canvas) ohne Render-Konflikte zusammen?
- Die Netzwerkschicht (CHAOS-9/12) ist noch nicht da; die Szene muss heute lokal steuerbar sein und später ohne Umbau Controller-Eingaben bekommen.

## Entscheidung

### Havok-WASM laden (C1)

- `src/scene/havok.ts` importiert die WASM-Datei per **`?url`** (`@babylonjs/havok/lib/esm/HavokPhysics.wasm?url`) und übergibt sie über **`locateFile`** an `HavokPhysics()`. Vite kopiert die Datei im Build mit Hash nach `dist/assets/` und liefert sie im Dev-Server über `/@fs/…` aus – in beiden Fällen kennt Havok die exakte URL.
- `optimizeDeps.exclude: ['@babylonjs/havok']`: Das Modul wird nicht vorgebündelt, Dev und Build laden es gleich.
- Havok wird pro Seite **einmal** instanziiert (geteiltes Promise); schlägt es fehl, wird beim nächsten Versuch neu geladen.
- MIME-Typ `application/wasm`: Vite (Dev/Preview) setzt ihn; der Node-Server hat `.wasm` bereits in seiner MIME-Liste (für eine spätere Auslieferung des Hosts über den Server).
- Babylon wird über **Deep-Imports** (`@babylonjs/core/…/x.js`) statt über den Barrel eingebunden. Seiteneffekt-Module (`Physics/joinedPhysicsEngineComponent.js`, `Physics/v2/physicsEngineComponent.js`, `Lights/Shadows/shadowGeneratorSceneComponent.js`) werden explizit importiert. Ergebnis: Host-Hauptchunk ≈ 1,3 MB (≈ 330 kB gzip), Shader als nachgeladene Chunks.

### Szenen-API und Eingabe-Naht

`apps/host/src/scene/` ist framework-unabhängig (kein React):

```ts
createGameScene(canvas: HTMLCanvasElement, options: { seed: number; testMode?: boolean }): GameScene

interface GameScene extends PlayerInputSink {
  physicsReady: Promise<void>;   // Havok geladen, Physik aktiv
  ready: Promise<void>;          // Szene aufgebaut, erstes Bild gerendert
  setPlayers(players: readonly ScenePlayer[]): void;   // { slot: 1–4, color, label, connected }
  applyInput(slot: PlayerSlot, input: PlayerInput): void;
  stepFrames(n: number): void;   // nur Testmodus
  getPlayerPositions(): PlayerPosition[];
  dispose(): void;
}

type PlayerInput =
  | { type: 'move'; x: number; y: number }                       // Stick, x rechts, y vorn, Länge ≤ 1
  | { type: 'button'; button: 'dash'; pressed: boolean };
```

- **Eingabequelle** (`src/input/inputSource.ts`): `interface InputSource { start(sink: PlayerInputSink): () => void }`. Heute gibt es nur `createKeyboardInputSource()` (Slot 1 WASD + Leertaste, Slot 2 Pfeile + Enter, Slot 3 IJKL + O, Slot 4 Ziffernblock 8/4/5/6 + 0; `KeyboardEvent.code`, also layoutunabhängig). Die WebSocket-Quelle (CHAOS-9/12) implementiert dasselbe Interface und übersetzt Protokollnachrichten in `PlayerInput`; die Szene ändert sich dafür nicht.
- **Spielerfarben** liegen vorläufig in `src/players.ts` (`PLAYER_COLORS`); sobald das Protokoll/die Lobby Farben vergibt, kommen sie über `setPlayers`.
- **Bewegung**: Pro Physikschritt eine Lenk-Impulsänderung Richtung Stick × 6 m/s, begrenzt auf 45 m/s² (Figuren lassen sich also wegschubsen). `dash` gibt einen Impuls von 11 m/s (Stick- oder Blickrichtung), 0,6 s Abklingzeit, 0,25 s ohne Lenkung. Trägheit 0 sperrt die Rotation, Figuren bleiben aufrecht; ein Gesichts-Knoten dreht sich in Laufrichtung. Die Mathematik liegt rein in `movement.ts` (Unit-Tests).
- **Feste Physikschritte**: Havok läuft mit `useDeltaForWorldStep=false` und 1/60 s. Im Normalbetrieb sorgt Babylons `deterministicLockstep` für 60-Hz-Schritte unabhängig von der Bildrate.
- **React-Overlay (C5)**: React legt das Canvas imperativ in einem Effekt an (frischer WebGL-Kontext pro Szene, robust gegen StrictMode-Doppelaufruf) und entsorgt es beim Aufräumen. Zustand fließt nur React → Szene (`setPlayers`, Eingaben); zurück kommen nur `physicsReady`/`ready`. Der HUD ist ein DOM-Overlay mit `pointer-events: none`. Das Wurzelelement trägt `data-physics="loading|ready|error"` und `data-scene="loading|ready"`.

### Testmodus und Screenshot-Strategie (C3, C4)

- `?test=1` schaltet die Render-Schleife ab: Nur `window.__chaos.stepFrames(n)` simuliert und rendert, jeder Frame genau 1/60 s Physik. Dazu `preserveDrawingBuffer` (Canvas-Pixel lesbar) und Gerätepixelverhältnis 1. `window.__chaos` = `{ ready, physicsReady, stepFrames(n), getPlayerPositions() }`, Typ in `src/testHook.ts`.
- Weitere URL-Parameter: `?players=1–4` (Standard 2), `?seed=` (Standard 2026) für die Startpunkte (`computeSpawnPoints` mit `createRng` aus `@chaos-party/game-core`; ein fester Punkt pro Slot).
- Feste Kamera, keine Kamera-Eingaben; Idle-Animation (Antennen-Wippen) läuft in Simulationszeit und ist damit im Testmodus reproduzierbar.
- **Screenshots** nur vom **eingeschwungenen Startzustand** (60 Frames nach dem Spawn), Vergleich mit `maxDiffPixelRatio: 0.02`. HUD-Texte werden maskiert, weil sich installierte Schriften zwischen Rechnern und CI-Runnern unterscheiden; Texte prüfen DOM-Assertions. Baseline ist nur für Linux eingecheckt (`tests/e2e/__screenshots__/…/host-szene-chromium-linux.png`).
- **Bewegungstests** vergleichen Positionen mit Toleranz (z. B. „> 1 m nach rechts“, „Spieler 2 bewegt sich < 5 cm“), nie exakte Koordinaten (C4).
- Ungemaskierter Beleg für Abnahmeberichte: `HOST_SZENE_BELEG=1 pnpm test:e2e` schreibt `docs/screenshots/m1-host-szene.png`.

### Headless-WebGL

Playwright startet Chromium mit `--use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`: WebGL2 per Software-Rendering, lokal und in CI gleich (neuere Chromium-Versionen schalten den SwiftShader-Fallback ohne `--enable-unsafe-swiftshader` ab). E2E läuft gegen den **Production-Build** (`vite build` + `vite preview` auf Port 4173), damit C1 am ausgelieferten Bundle geprüft wird. `@playwright/test` ist exakt auf 1.63.0 gepinnt.

## Betrachtete Alternativen

| Alternative | Warum nicht |
|---|---|
| WASM nach `public/` kopieren und mit festem Pfad laden | Zusätzlicher Kopierschritt, kein Cache-Busting per Hash, Pfad bricht bei anderem `base` |
| Havok über `new URL(..., import.meta.url)` im Paket selbst finden lassen | Funktioniert im Build, bricht aber, sobald Vite das Modul im Dev-Server vorbündelt; `locateFile` ist in beiden Modi eindeutig |
| `@babylonjs/core`-Barrel importieren | Einfacher, bündelt aber praktisch die ganze Engine (alle Barrel-Module haben Seiteneffekte) |
| Szene direkt in React-Komponenten (z. B. react-babylonjs) | Bindet Spiellogik an React-Renderzyklen; erschwert späteren Minigame-Lebenszyklus und Tests ohne React |
| Physik über Positions-Snapshots testen | Havok nicht bitgenau deterministisch (C4); Toleranzen und Invarianten sind robuster |
| Screenshots mit laufender Render-Schleife | Zeitabhängig, flackert; `stepFrames` macht den Zustand reproduzierbar |
| Playwright-Docker-Image in CI für identische Schriften | Schwerer CI-Aufbau; Maskierung der Texte reicht für M1 |

## Konsequenzen

**Positiv**
- C1 wird bei jedem CI-Lauf am Production-Build geprüft (WASM-Antwort 200, `application/wasm`, `data-physics="ready"`).
- Netzwerk-Eingaben lassen sich später als weitere `InputSource` anschließen, ohne die Szene anzufassen.
- Bewegung, Startpunkte, Tastaturzustand und URL-Parameter sind ohne Browser unit-getestet.

**Negativ / Risiken**
- SwiftShader ist langsam; E2E-Läufe dauern ~20–30 s. Bildrate auf echter Hardware (C2) ist damit nicht gemessen – das bleibt Teil der Gerätecheckliste.
- Die Screenshot-Baseline entstand in einer lokalen Linux-Umgebung; weichen GitHub-Runner trotz Maskierung ab (andere Mesa-/Treiber-Details), muss die Baseline einmal aus dem CI-Artefakt übernommen werden.
- Deep-Imports hängen an Babylons Dateistruktur; Major-Updates können Pfade ändern.
- Spielerfarben sind vorläufig im Host definiert und müssen später ins Protokoll/die Lobby wandern.

## Überprüfung

Neu bewerten, wenn Screenshots in CI wiederholt flackern (dann Toleranz/Maskierung erhöhen oder Playwright-Container nutzen), wenn ein Babylon-Major-Update Deep-Imports bricht, oder wenn die Bildrate auf Rubens PC (C2) nicht reicht.

## Nachtrag 1 (2026-11-17, CHAOS-53): Szenen als eigene Chunks

Das Host-Bundle war bis M4 ein einziger Einstieg mit Babylon, Arena, Brett, Finale und allen Minispielen (2.750 kB statisch). Jetzt gilt:

- **Start-Bundle ohne Babylon-Engine.** `main.tsx`/`App.tsx` laden Szenen nur über `apps/host/src/lazyScenes.ts` (dynamischer Import): Arena, Brett (mit Finale/Podest), Minispiel-Bühne (mit allen Minispiel-Modulen), Entwickler-Ansichten. Für Entscheidungen ohne Szene reicht der reine Katalog `@chaos-party/minigames/catalog`.
- **Vorladen:** Steht die Arena hinter der Lobby, lädt die App Brett und Minispiel-Bühne im Hintergrund.
- **Seiteneffekt-Imports explizit:** Jede Szene importiert die Babylon-Seiteneffekte selbst, die sie braucht (z. B. `Materials/standardMaterial.js` für `Scene.DefaultMaterialFactory`). Vorher konnten sie unbemerkt aus einem anderen Teil desselben Bundles kommen.
- **Workspace-Pakete ohne Seiteneffekte** tragen `"sideEffects": false` (zuerst `minigame-sdk`), damit ein Barrel-Import einer Konstante keine Babylon-Laufzeit mitzieht.
- **CSS-Reihenfolge bleibt fest:** Stile, die vor `styles.css` stehen müssen (`portrait.css`, `finale.css`), importiert `App.tsx` vorab, auch wenn die Komponente im Chunk liegt.
- **Budget:** `pnpm check:bundle` (CI) begrenzt den Start auf 520 kB und verbietet die Babylon-Engine darin.

Messwerte: [`performance.md` §3c](../performance.md#3c-host-bundle-aufgeteilt-chaos-53). Risiko: Ein neuer statischer Import einer Szene in `App.tsx` holt Babylon zurück in den Start – das fängt `pnpm check:bundle`.

## Nachtrag 2 (2026-11-20, CHAOS-86): ein Chunk je Minispiel

Mit dem Minispiel-Ausbau (CHAOS-80, ~200 Spiele) würde die Minispiel-Bühne aus Nachtrag 1 mit jedem Spiel wachsen (je Spiel ≈ 30–90 kB), und die App lädt sie schon in der Lobby vor. Jetzt gilt:

- **Lade-Register `@chaos-party/minigames/lazy`:** je Spiel eine Lade-Funktion (`() => import('./<spiel>/index.ts')`), ein Versprechen je Kennung (Fehlschlag wird vergessen, der nächste Versuch lädt neu), `loadedMinigameModule` liefert ein geladenes Modul synchron. Die Steckbriefe bleiben synchron (`./catalog`).
- **Host im Browser** holt Module nur darüber. Der Bühnen-Chunk (`MinigameScreenById`) enthält kein Minispiel mehr. `App.tsx` lädt das Spiel der Runde, sobald der Stand es nennt (ab der Anleitung), und hängt die Bühne erst ein, wenn Bühnen-Chunk und Spiel-Modul geladen sind (`useMinigameStage`, `useMinigameModuleStatus`).
- **Kein Suspense beim Szenenwechsel:** Hat React einmal einen Fallback gezeigt, deckt es den Inhalt frühestens nach 300 ms auf. Mit `use()` bzw. `React.lazy` kostete das gemessen 300 ms je Minispiel bzw. beim ersten Minispiel jeder Partie. Suspense (`useMinigameModule`) bleibt nur für Entwickler-Ansichten und als Rückfall nach einem fehlgeschlagenen Import.
- **Synchrones Register `@chaos-party/minigames` bleibt** für den Apple-Host (JavaScriptCore-Bündel ohne Nachladen, ADR-019), Tests und Werkzeuge in Node. Im Host im Browser verbietet ESLint (`no-restricted-imports`) diesen Import.
- **Steckbriefe in einem Chunk:** `info.ts` nutzen Start (Katalog) und Spiel-Chunk gemeinsam; ohne Vorgabe legt Rolldown je Steckbrief eine Mini-Datei in den Start. Die Gruppe `minispiel-katalog` (`build.rolldownOptions.output.codeSplitting` in `apps/host/vite.config.ts`) hält sie zusammen.
- **Prüfung:** `pnpm check:bundle` liest das Vite-Manifest (`build.manifest`) und bricht ab, wenn ein Minispiel-Ordner keinen eigenen Chunk hat, ein Spiel im Start oder in der statischen Kette der Bühne liegt oder der Start mehr als 10 Dateien hat.
- **Assets je Spiel:** Die Minispiele bauen ihre Geometrie im Code; Figuren und Natur-Look teilen sie mit der Bühne. Damit ist der Spiel-Chunk das ganze Asset. Die Requisiten-GLBs aus dem Art-Kit (CHAOS-88) lädt das jeweilige Spiel bei Bedarf in `prepare`, nicht die Bühne vorab (Umsetzung mit der Pilotwelle CHAOS-91).

Messwerte: [`performance.md` §3j](../performance.md#3j-ein-chunk-je-minispiel-chaos-86). Kehrseite: Ein neues Spiel braucht eine Zeile in `lazy.ts` zusätzlich zu `index.ts`; `lazy.test.ts` prüft, dass beide zum Katalog passen.
