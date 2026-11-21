# Performance: Bildrate und Latenz (M4)

**Stand:** 2026-11-20 (Chunk je Minispiel und Marke `angefragt`, CHAOS-86; Baseline nach Natur-Look von Lobby und Podest, CHAOS-133; Standbild je Szenenwechsel, CHAOS-153) · **Aufgabe:** CHAOS-39, CHAOS-73, CHAOS-133, CHAOS-153, CHAOS-86 · **Grundlage:** ARCHITECTURE „Testing strategy“ Punkt 4, [ADR-010](decisions/ADR-010-messanzeige.md) (Messanzeige aus M1)

Kurz: Gemessen wird an zwei Stellen – **auf echter Hardware** mit der Messanzeige (`?debug=1`, Ruben, Abschnitt 11 der [Gerätecheckliste](device-test-checklist.md#11-m4--performance-für-chaos-43)) und **automatisch** im Headless-Chromium mit Software-Rendering (`pnpm perf`). Die automatischen Werte erlauben **nur relative Vergleiche** auf demselben Rechner (vorher/nachher). Sie sagen nichts darüber, wie flüssig das Spiel auf Rubens PC oder Fernseher läuft.

## 1. Was gemessen wird

### Host (`/host/?debug=1`)

Die Messanzeige aus M1 misst jetzt **je Szene**. Jede Szene meldet sich beim Aufbau an (`attachPerf`, `apps/host/src/debug/perf.ts`) und beim Entsorgen ab. Ohne `?debug=1` gibt es keine Beobachter und keine Kosten.

| Szene | Wann |
|---|---|
| `lobby` | Arena hinter dem Lobby-Panel |
| `arena` | Schubs-Arena (`?arena=1`, M1) |
| `brett` | Brettphase |
| `minispiel:<id>` | Spielphase eines Minispiels; Anleitung und Ergebnis getrennt als `minispiel:<id>:intro` bzw. `:results` |
| `finale` | Brett hinter der Trophäenzählung bzw. dem Siegerbildschirm |
| `podest` | 3D-Siegerpodest |

| Kennzahl | Messung |
|---|---|
| Bildabstand Median/p95/max, fps | Abstand zwischen zwei fertigen Bildern derselben Szene; Lücken > 1 s zählen als Pause (wie ADR-010) |
| Render-Zeit (ms) | JS-Zeit von `scene.render()` (ab `onBeforeAnimations` bis `onAfterRender`); ohne GPU-Arbeit – mit SwiftShader ist sie trotzdem nur der JS-Anteil |
| Draw Calls | WebGL-Zeichenaufrufe je Bild (Babylon-Zähler der Engine, inkl. Schattenkarte) |
| aktive Meshes | Meshes, die Babylon je Bild als sichtbar auswählt |
| Eingabe→Frame | Eintreffen einer Controller-Eingabe (`input`) im Host-JS bis Ende des nächsten Bildes (ADR-010) |
| Brett→Frame | Eintreffen eines neuen Brett-Stands (`board`, z. B. nach „Würfeln“ am Handy) bis Ende des nächsten Bildes |
| Kontexte / Schleifen | lebende Babylon-Engines (= WebGL-Kontexte) und laufende Render-Schleifen der ganzen Seite, Höchstwert je Szene |
| Heap | `performance.memory.usedJSHeapSize` (nur Chromium/Edge; Safari/Firefox: „–“), Höchstwert je Szene. Der Messlauf `pnpm perf` misst zusätzlich den **Heap nach GC** je Szene (CDP, Abschnitt 3f) |
| Bestand | Meshes, Materialien, Texturen und geschätzter Texturspeicher (B·H·4, Würfel ·6, Mipmaps ·4/3) |

- „Kopieren“ legt wie bisher eine Zeile mit den Gesamtwerten ab; **„Alle Szenen kopieren“** eine Zeile je Szene plus Grafikkarte, Auflösung und User-Agent. Auf der Konsole liefert `__chaosPerf.summary()` denselben Text, `__chaosPerf.report()` die Zahlen.
- Beim Szenenwechsel werden wartende Eingänge verworfen: Die Ladezeit der nächsten Szene ist keine Eingabelatenz.
- **Standbild je Szenenwechsel** (CHAOS-153): Brett, Minispiel-Bühne und Podest setzen Marken `chaos:<szene>:aufbau` (Aufbau beginnt), beim Podest zusätzlich `:sichtbar` (vorbereitetes Podest wird gezeigt), bei der Minispiel-Bühne zusätzlich `:angefragt` (Empfang des Stands, der das Minispiel nennt; der Übergang zählt dann ab da und weist die Zeit bis zum Aufbau als `requestMs` aus, CHAOS-86), und `:erstes-bild` (`performance.mark`, im Performance-Profil der DevTools sichtbar; `apps/host/src/debug/sceneMarks.ts`). Dazu protokolliert der Host Long Tasks (`PerformanceObserver`, Typ `longtask`, ≥ 50 ms, nur Chromium/Edge). `__chaosPerf.transitions()` liefert je Übergang (`lobby → brett`, `brett → minispiel`, `minispiel → brett`, `zählung → podest`) den **längsten Block**, die blockierte Zeit und die Wartezeit bis zum ersten Bild (`transitions.ts`). Fenster: Aufbau bis erstes Bild; beim Podest Vorbereitung (während der Zählung) bis zum vorab gezeichneten Bild **plus** Zeigen bis zum ersten Bild danach, nicht die Zählung dazwischen. Eine Long Task zählt mit voller Dauer, wenn sie ein Fenster überlappt: Entsorgen der alten Szene und `new Engine(…)` der neuen laufen oft in derselben Aufgabe, die vor der Marke beginnt.
- Grenzen wie in ADR-010: Eingabe→Frame endet am Ende des JS-Renderings (ohne GPU, Compositor, Bildschirm). Der Weg Finger → Bild als Ganzes lässt sich nur per Zeitlupenvideo messen (Checkliste PF7).

### Controller (`…&debug=1`)

Die Rundlaufzeit Controller ↔ Server (Herzschlag jede Sekunde, ADR-010) wird zusätzlich **je Szene** gesammelt (`lobby`, `arena`, `brett`, `minispiel`, `minispiel:intro`/`:results`, `endstand`; maßgeblich ist die Szene beim Eintreffen der Antwort). Die kopierte Zeile enthält „RTT je Szene ms (Median/p95)“.

### Server

Die Weiterleitung einer Controller-Eingabe an den Host ist im Server synchron (Empfang → `send` im selben Ereignis, `session.ts`). Ihre Latenz ist die Wartezeit in der Node-Ereignisschleife. Der Messlauf misst deshalb die **Verzögerung der Ereignisschleife** (`monitorEventLoopDelay`, Server und Bots im selben Prozess), die **Bot-Rundlaufzeit** über den Server und Anzahl/Größe aller Nachrichten an den Host.

## 2. Automatische Messläufe (`pnpm perf`)

```bash
pnpm perf                              # baut, misst, vergleicht mit tests/perf/baseline.json
E2E_SKIP_BUILD=1 pnpm perf             # ohne Neubau (direkt nach pnpm build)
PERF_LABEL=vorher pnpm perf            # Ergebnisdatei perf-results/partie-vorher.json usw.
PERF_STRICT=1 pnpm perf                # zusätzlich zeitliche Schwellen prüfen (gleicher Rechner!)
PERF_UPDATE_BASELINE=1 pnpm perf       # Baseline neu schreiben (nach bewusster Änderung)
pnpm perf -g Revanche                  # nur ein Szenario

# Echte Grafikkarte (CHAOS-73): sichtbares Fenster, ohne VSync, ohne Baseline-Vergleich
E2E_SKIP_BUILD=1 PERF_GPU=1 PERF_VIEWPORT=1920x1080 PERF_DPR=2 PERF_LABEL=gpu-4k pnpm perf -g Partie
PERF_QUERY='&qualitaet=mittel' …        # feste Grafikstufe statt Automatik
```

Headless nimmt Chromium auch auf einem Rechner mit GPU SwiftShader; `PERF_GPU=1` öffnet deshalb ein Fenster. Ohne VSync zeigt der Bildabstand die Kosten (hunderte fps möglich), nicht die Bildwiederholrate.

Aufbau: `playwright.perf.config.ts`, `tests/perf/` (eigenes Playwright-Projekt, nicht Teil von `pnpm test:e2e`). Production-Build, echter Server im Testprozess, Host-Seite **ohne** Testmodus (echte Render-Schleife) mit `?debug=1`, 1280×720, DPR 1, ein Worker. Vier synthetische Controller (`tests/perf/perfBot.ts`) wählen Figuren, sind bereit, beantworten jede Brett-Entscheidung und spielen Minispiele mit `move` 30/s (Zufallsweg, fester Seed) sowie A alle ~0,7 s und B alle ~1,5 s, soweit angeboten. Brett-Seed `2026`.

| Szenario | Ablauf | Prüft immer |
|---|---|---|
| **Partie** | Lobby 10 s → 3 Runden (jedes Minispiel der Rotation einmal, Spielzeit 15 s, Anleitung/Ergebnis 5 s) → Finale (Trophäenzählung normal) → Podest 10 s | alle Szenen gemessen; Szenenwechsel Brett → Minispiel, Minispiel → Brett und Zählung → Podest je mit erstem Bild gemessen; strukturelle Schwellen gegen die Baseline; keine Seitenfehler |
| **Revanche ×3** | drei Partien à 1 Runde mit „Nochmal spielen“; nach jeder in der Lobby: GC, Heap, DOM-Knoten, Canvas, Kontexte | Heap nach Partie 3 ≤ max(+10 %, +5 MB) gegenüber Partie 1; DOM ≤ +20 Knoten; in der Lobby genau 1 Canvas und 1 Kontext; neue Partie zeigt nicht den alten Endstand |

Ergebnisse: `perf-results/partie[-LABEL].json`, `perf-results/revanche[-LABEL].json` (nicht eingecheckt) und Tabellen auf der Konsole. Die JSON-Datei enthält zusätzlich `environment` (CPU, Speicher, Node, Browser, Systemlast) sowie je Szenenwechsel die Zusammenfassung (`transitions`) und jedes einzelne Vorkommen (`transitionList`, CHAOS-153).

### SwiftShader – was die Zahlen bedeuten

SwiftShader rendert WebGL **auf der CPU**. Bildabstände von 100–250 ms (4–10 fps) sind hier normal und sagen nichts über eine echte Grafikkarte. Sinnvoll sind:

- **Strukturelle Kennzahlen** (rechnerunabhängig, deterministisch genug): Draw Calls, aktive Meshes, Kontexte, Render-Schleifen, Bestand, Heap-Verlauf über mehrere Partien, Nachrichten an den Host.
- **Zeitliche Kennzahlen nur relativ**, auf demselben Rechner, ohne andere Last, möglichst mehrere Läufe. Auf dem Messrechner (4 Kerne, parallel liefen E2E-Tests anderer Arbeitsstränge, Systemlast 6–8) schwankte der Bildabstand des Bretts zwischen zwei Läufen desselben Stands um ±30 %.

## 3. Messung vorher/nachher (CHAOS-39)

> **Historie:** Die Tabellen dieses Abschnitts messen das alte Brett aus Grundkörpern (vor dem Natur-Look CHAOS-62). Natur-Look: [Abschnitt 3a](#3a-nach-chaos-62-natur-look); aktuelle Baseline: [Abschnitt 3d](#3d-nach-chaos-77-und-chaos-71-aktuelle-baseline).

**Testbedingungen:** Linux x64, Intel Xeon @ 2,30 GHz ×4, 16 GB, Node 22.23, Chromium 153 headless, ANGLE/SwiftShader, 1280×720, DPR 1; Szenario „Partie“ (4 Bots, Seed 2026); Systemlast 6–8 durch parallele Tests anderer Arbeitsstränge. „vorher“ = Stand mit Messung, ohne Optimierungen; „nachher“ = mit den Optimierungen aus Abschnitt 4. Je ein Lauf (der erste Vorher-Lauf hatte noch einen Fehler im Draw-Call-Zähler; seine Bildabstände stehen in Klammern).

| Szene | Bildabstand p50 / p95 ms vorher → nachher | Draw Calls p50 | aktive Meshes | Render-Schleifen max | Kontexte max | Heap max MB |
|---|---|---|---|---|---|---|
| lobby | 62 / 164 → 61 / 138 | 70 → 70 | 42 | 1 → 1 | 1 → 1 | 28 → 24 |
| brett | 217 / 576 (157 / 390) → 162 / 453 | **187 → 150** | 149 | 1 → 1 | 1 → 1 | 66 → 63 |
| minispiel:sockenregen | 242 / 557 (171 / 399) → 252 / 558 | 160 → 156 | 160 | 1 → 1 | 1 → 1 | 66 → 70 |
| minispiel:pudding-gerangel | 123 / 426 (94 / 209) → 129 / 284 | 82 → 82 | 85 | 1 → 1 | 1 → 1 | 46 → 45 |
| minispiel:wackelturm | 165 / 390 (127 / 394) → 93 / 258 | 77 → 77 | 199 | 1 → 1 | 1 → 1 | 45 → 56 |
| finale (Brett hinter der Zählung) | 244 / 922 (161 / 431) → **kein Bild** | 184 → – | 146 → – | **2 → 1** | 2 → 2 | 79 → 76 |
| podest | 351 / 902 (248 / 441) → **100 / 226** | 71 → 71 | 59 | **2 → 1** | 2 → 2 | 75 → 70 |

| Weitere Werte (nachher) | |
|---|---|
| Eingabe→Frame p50 / p95 (Minispiele) | 68–164 / 228–540 ms – folgt dem Bildabstand von SwiftShader (eine Eingabe wartet im Mittel ein halbes Bild) |
| Nachrichten an den Host (≈ 186 s) | `input` 6927 (≈ 105 B, ≈ 37/s), `board` **96** (≈ 1,4 kB, max 2,4 kB, ≈ 0,5/s), `lobby` 14, `heartbeat-ack` 37 |
| Bot-Rundlaufzeit über den Server | p50 0,45 ms, p95 0,96 ms, max 17 ms (n = 756) |
| Node-Ereignisschleife (Server + Bots + Playwright) | Verzögerung p50 10 ms (Auflösung 10 ms), p99 16 ms, max 70 ms |
| Revanche ×3, Heap nach GC in der Lobby | vorher 14,1 → 20,9 → 20,2 → 20,8 MB; nachher 14,2 → 20,0 → 20,6 → 21,3 MB; DOM 255 → 263 → 263 → 263; je 1 Canvas, 1 Kontext |

**Lesart:** Belegt sind die strukturellen Änderungen – Brett −20 % Draw Calls, hinter dem Finale keine Brett-Bilder mehr und eine statt zwei Render-Schleifen. Am Podest halbiert das den Bildabstand bis auf ein Drittel (SwiftShader rechnet nur noch eine Szene); auf einer echten GPU ist der Gewinn kleiner, aber die doppelte Arbeit entfällt dort genauso. Die übrigen Unterschiede im Bildabstand liegen im Rauschen der Systemlast. Kein Speicherleck über drei Partien (Heap nach GC schwankt um ±0,7 MB, nach der ersten Partie sind Figuren, Shader und Schriften einmal geladen).

## 3a. Nach CHAOS-62 (Natur-Look)

> **Historie:** Lobby und Podest zeigen hier noch den alten Look; seit CHAOS-77/CHAOS-71 gilt die Baseline aus [Abschnitt 3d](#3d-nach-chaos-77-und-chaos-71-aktuelle-baseline).

Mit dem Merge von `main` (CHAOS-62, [ADR-014](decisions/ADR-014-natur-look.md)) zeigen Brett und Minispiele den Natur-Look: Insel mit Baumscheiben, Gras als Thin Instances, PBR-Materialien mit HDRI, Schatten, eigene Bäume. Bei Software-Rendering (also auch in `pnpm perf`) wählt die Szene ohne `?qualitaet=` die Sparstufe `minimal`, rendert in halber Auflösung (`setHardwareScalingLevel(2)`, 640 × 360 statt 1280 × 720) und macht größere Zeitschritte in Brett-Regie und Minispiel-Uhr. Die Zahlen sind deshalb **nicht** mit Abschnitt 3 vergleichbar; die Baseline `tests/perf/baseline.json` ist neu geschrieben (`PERF_UPDATE_BASELINE=1 pnpm perf`, 2026-11-15, gleicher Rechner, Systemlast ≈ 4).

| Szene | Bildabstand p50 / p95 ms | Draw Calls p50 (vorher, altes Brett) | aktive Meshes | Render-Schleifen max | Kontexte max | Heap max MB | Texturen ~MB |
|---|---|---|---|---|---|---|---|
| lobby | 57 / 114 | 70 (70) | 42 | 1 | 1 | 25 | 4 |
| brett | 204 / 899 | **256** (150) | 166 | 1 | 1 | 194 | 20 |
| minispiel:sockenregen | 322 / 892 | 260 (156) | 162 | 1 | 1 | 104 | 12 |
| minispiel:pudding-gerangel | 306 / 794 | 211 (82) | 113 | 1 | 1 | 120 | 14 |
| minispiel:wackelturm | 223 / 507 | 205 (77) | 236 | 1 | 1 | 90 | 12 |
| finale (Brett hinter der Zählung) | **kein Bild** | – | – | **1** | 2 | 175 | 19 |
| podest | 63 / 106 | 71 (71) | 59 | **1** | 2 | 130 | 6 |

| Weitere Werte | |
|---|---|
| Revanche ×3, Heap nach GC in der Lobby | 14,5 → 21,9 → 22,0 → 23,1 MB; DOM 177 → 193 → 193 → 193; je 1 Canvas, 1 Kontext |
| Nachrichten an den Host (≈ 184 s) | `board` 96 (max 2,4 kB), `input` 6531, `lobby` 14 – wie vorher |
| Bot-Rundlaufzeit über den Server | p50 0,51 ms, p95 0,82 ms, max 3,8 ms (n = 743) |

**Lesart:**
- **Die M4-Optimierungen tragen weiter:** Hinter der Trophäenzählung zeichnet das Natur-Brett kein Bild (`finale`: 0 Bilder, 1 Schleife), am Podest läuft nur dessen Szene (1 Schleife). Kein Speicherleck über drei Partien.
- **Mehr Draw Calls durch den Look, nicht durch den Merge:** Brett 150 → 256, Minispiele +100 bis +130 (Kulisse aus `ctx.look`, Gras, Schattenpass). Die Baum-Instanzierung aus CHAOS-39 entfällt: Die Natur-Bäume sind je Baum verformt und je Material verschmolzen (`StaticBatch`, zwei Meshes je Baum, ≈ 30 Bäume, dazu der Schattenpass). Gleiche Geometrie für Instanzen gibt es nicht mehr.
- **Heap und Texturspeicher steigen** durch PBR-Texturen, HDRI-Himmel und Umgebungslicht (Brett 63 → 194 MB Heap-Höchstwert, ≈ 20 MB Texturen). Der Heap nach GC in der Lobby bleibt bei ≈ 22 MB.
- Bildabstände sind wegen halber Auflösung und Sparstufe nicht mit Abschnitt 3 vergleichbar. Wie flüssig `hoch`/`mittel`/`niedrig` auf einer echten GPU laufen, zeigen nur PF1/PF2 und N1–N3 der [Gerätecheckliste](device-test-checklist.md).

## 3b. Erste Messung auf echter GPU (CHAOS-73)

Apple M3 Max, Chromium 153 mit ANGLE/Metal, ohne VSync, ganze Partie (`PERF_GPU=1`), Automatik an. Herleitung, Varianten und Profil: [EXP-014](experiments.md#exp-014-host-grafik-auf-echter-gpu--engpass-der-grafikstufen-2026-11-16-chaos-73).

| Szene | Bildabstand p50 / p95 ms vorher, 1080p | nachher, 1080p | nachher, 4K (DPR 2) | Draw Calls p50 |
|---|---|---|---|---|
| lobby | 0,8 / 2,5 | 1,8 / 2,6 | 2,3 / 2,8 | 70 |
| brett | **26 / 29** | **5,5 / 8,0** | 8,7 / 13,6 | 422 |
| minispiel:sockenregen | 15 / 19 | 4,2 / 6,1 | 7,4 / 12,0 | 415 |
| minispiel:pudding-gerangel | 20 / 25 | 4,8 / 7,2 | 8,2 / 12,8 | 327 |
| minispiel:wackelturm | 15 / 18 | 4,4 / 6,0 | 7,6 / 13,2 | 328 |
| podest | 1,7 / 2,6 | 0,9 / 2,5 | 1,6 / 2,8 | 71 |

**Lesart:**
- **Engpass waren die weichen Kontaktschatten (PCSS)** in Babylons Filterstufe `HIGH`: ≈ 23 ms je Bild am Brett, selbst auf einer M3 Max. Die GPU war voll, JS wartete in `uniformMatrix4fv`/`drawElements` (Render-Zeit ≈ Bildabstand). Mit Filterstufe `LOW` sehen sie praktisch gleich aus und kosten ≈ 1 ms.
- **Auflösung** ist der zweite Hebel: Bei 4K kostet dieselbe Szene etwa das Dreifache. Jede Stufe begrenzt jetzt die Renderpixel (`hoch` 2560×1440, `mittel` 1920×1080, `niedrig` 1600×900); die Host-Zeile der Messanzeige zeigt die tatsächliche Renderauflösung.
- **Draw Calls** (≈ 330–420 bei `hoch`; Tiefenunschärfe und Schattenpass zeichnen die Szene erneut) sind auf diesem Rechner kein Engpass (`niedrig`: 269 Draw Calls in 1,6 ms). Auf schwachen CPUs bleibt Bündeln ein Kandidat.
- Wie viel Luft eine schwächere Grafikkarte hat, zeigt nur Rubens Messung (PF1/PF2, N1–N3). Reicht `hoch` dort nicht, stuft die Automatik ab und merkt sich die Stufe für die Sitzung (jede neue Szene startet mit ihr statt wieder bei `hoch`).

## 3c. Host-Bundle aufgeteilt (CHAOS-53)

Gemessen am Production-Build (`apps/host`, Vite 8 / Rolldown), 2026-11-17. „Start“ = was `index.html` sofort lädt (Einstiegs-Skript plus alle `modulepreload`-Dateien); die übrigen Zeilen zählen die Chunk-Kette des jeweiligen dynamischen Imports dazu. Analyse über die Sourcemap des Einstiegs-Chunks.

| Was | vorher | nachher |
|---|---|---|
| Einstiegs-Skript `index-*.js` | 2.039 kB (gzip 532 kB) | **297 kB (gzip 98 kB)** |
| Start (statisch, vor dem ersten Bild der Lobby) | 2.750 kB (gzip 739 kB), 39 Dateien | **404 kB (gzip 130 kB), 5 Dateien** |
| Lobby inklusive Arena dahinter | 2.750 kB (gzip 739 kB) | 2.119 kB (gzip 579 kB) |
| Ganze Partie (Arena, Brett, Finale, Minispiele) | 2.750 kB (gzip 739 kB) | 2.757 kB (gzip 745 kB) |

**Was vorher im Einstieg lag:** Babylon 1.252 kB, React-DOM 203 kB, zod 85 kB, glTF-Lader 84 kB, Brett 44 kB, Havok-Lader 34 kB, Natur-Look 28 kB, je Minispiel ≈ 21 kB. Die Babylon-Imports waren schon Deep-Imports (ADR-004); der Hebel war das Aufteilen.

**Was sich geändert hat** (`apps/host/src/lazyScenes.ts`):
- Arena (`createGameScene`), Brett (`BoardStage` mit Finale und Podest), Minispiel-Bühne (`MinigameScreenById` mit allen Minispiel-Modulen) und die Entwickler-Ansichten einzelner Minispiele laden per dynamischem Import. Die App kennt für die Entscheidung „Minispiel oder Brett“ nur den reinen Katalog (`@chaos-party/minigames/catalog`).
- Brett und Minispiel-Bühne lädt die App im Hintergrund vor, sobald die Arena hinter der Lobby steht – der Start der Partie wartet nicht auf das Netz.
- `@chaos-party/minigame-sdk` ist als nebenwirkungsfrei markiert (`"sideEffects": false`). Vorher zog `fx/sounds.ts` mit der Konstante `SOUND_IDS` über das Barrel `minigame-sdk/babylon` den Minispiel-Runner samt Babylon-Physik statisch in den Start (1.248 kB statt 404 kB).
- Nicht ladbarer Chunk (Host neu gebaut, während die Seite offen war): `vite:preloadError` lädt die Seite neu, höchstens einmal je 30 s.
- Die Größe bleibt geprüft: `pnpm check:bundle` (in `pnpm check` und CI) bricht ab, wenn der Start über 520 kB wächst oder die Babylon-Engine enthält.

**Was beim Aufteilen aufgefallen ist** (beides von der E2E-Suite gefunden):
- Die Arena brauchte den Seiteneffekt-Import `Materials/standardMaterial.js` (`Scene.DefaultMaterialFactory`), den bisher zufällig das Brett im selben Bundle mitbrachte. Jetzt explizit in `createGameScene.ts`.
- `finale.css` wäre in den Brett-Chunk gewandert und *nach* `styles.css` geladen worden; bei gleicher Spezifität gewann dann `.finale-rematch { margin-top: auto }` gegen `.start-button` und „Nochmal spielen“ rutschte ans Panel-Ende. `App.tsx` importiert `portrait.css` und `finale.css` deshalb vorab – das Start-CSS ist byte-gleich zum Stand vorher.

**Nicht geprüft:** Ladezeit auf Rubens PC. Lokal ausgeliefert ist der Gewinn vor allem Parse- und Ausführungszeit bis zum ersten Bild der Lobby (QR-Code, Join-Code); die Arena erscheint kurz danach.

## 3d. Nach CHAOS-77 und CHAOS-71 (aktuelle Baseline)

CHAOS-77 hat Lobby-Arena und Siegerpodest in den Natur-Look gebracht (Kulisse, Schattenpass, Gras, feste Lichtstimmung), CHAOS-71 baut das Podest schon während der Trophäenzählung auf einer unsichtbaren Leinwand. Die Baseline aus Abschnitt 3a kannte beides nicht: `pnpm perf` scheiterte auf `main` an `lobby.drawCallsMedian: 134 > 82` und `podest.drawCallsMedian: 162 > 83` (CHAOS-133). Außerdem fehlten die Minispiele Kuckucks-Klatsche (CHAOS-54) und Krümel-Kehraus (CHAOS-79) in der Baseline; sie wurden gemessen, aber nicht verglichen.

**Baseline neu geschrieben** mit `E2E_SKIP_BUILD=1 PERF_UPDATE_BASELINE=1 pnpm perf -g Partie` auf `main` 82a1a0b (2026-11-17), danach ein vollständiger Kontrolllauf `pnpm perf` ohne Update: **2 passed**, keine strukturelle Regression. `PERF_UPDATE_BASELINE=1` legt die Datei jetzt so ab, wie Prettier sie formatiert; vorher musste sie für `pnpm format:check` von Hand nachformatiert werden. Messrechner (steht als `environment` in `tests/perf/baseline.json`): Cloud-Container, Linux x64, Intel Xeon @ 2,10 GHz ×4, 16 GB, Node 22.23, Chromium 153 headless, ANGLE/SwiftShader, 1280×720, DPR 1, Systemlast ≈ 4. Das ist **ein anderer Rechner** als bei 3a (2,30 GHz): Zeitliche Werte sind nicht mit 3a vergleichbar, `PERF_STRICT=1` gilt nur auf diesem Rechner. Strukturelle Werte waren in allen drei Läufen (alte Baseline, Update, Kontrolle) für Lobby, Brett, Finale und Podest gleich; die Draw Calls der Minispiele schwanken mit dem Spielverlauf um bis zu ±10 (z. B. Kuckucks-Klatsche 292 / 282 / 275).

| Szene | Draw Calls p50 (3a) | aktive Meshes (3a) | Kontexte max | Schleifen max | Heap max MB (3a) | Texturen ~MB (3a) |
|---|---|---|---|---|---|---|
| lobby | **134** (70) | 72 (42) | 1 | 1 | 78 (25) | 17,6 (4) |
| brett | 256 (256) | 166 (166) | 1 | 1 | 211 (194) | 21 (20) |
| minispiel:sockenregen | 272 (260) | 158 (162) | 1 | 1 | 106 (104) | 12,7 (12) |
| minispiel:pudding-gerangel | 208 (211) | 110 (113) | 1 | 1 | 91 (120) | 13,6 (14) |
| minispiel:wackelturm | 221 (205) | 234 (236) | 1 | 1 | 142 (90) | 12,7 (12) |
| minispiel:kuckucks-klatsche | 282 (–) | 160 (–) | 1 | 1 | 95 (–) | 12,3 (–) |
| minispiel:kruemel-kehraus | 250 (–) | 136 (–) | 1 | 1 | 84 (–) | 13,6 (–) |
| finale (Brett hinter der Zählung, Podest wird aufgebaut) | kein Bild | – | 2 | **1** | **223** (175) | 19,7 (19) |
| podest | **162** (71) | 83 (59) | 2 | **1** | 172 (130) | 17,9 (6) |

| Weitere Werte | |
|---|---|
| Revanche ×3, Heap nach GC in der Lobby | 37,8 → 50,0 → 51,4 → 51,4 MB (erster Lauf 38,2 → 50,0 → 51,3 → 52,0); DOM 205 → 220 → 220 → 220; je 1 Canvas, 1 Kontext |
| Nachrichten an den Host (≈ 300 s, 5 Minispiele) | `board` 158 (max 2,4 kB), `input` 9481, `lobby` 14 |
| Bot-Rundlaufzeit über den Server | p50 0,50 ms, p95 0,79 ms, max 4,4 ms (n = 1204) |

**Lesart:**
- **Mehr Draw Calls in Lobby und Podest kommen vom Look**, nicht von einem Fehler: Natur-Kulisse, Gras und Schattenpass (Lobby 70 → 134, Podest 71 → 162; aktive Meshes 42 → 72 bzw. 59 → 83). Brett unverändert; Minispiele −3 bis +16, innerhalb der Toleranz (·1,1 + 5).
- **CHAOS-71 ist erfasst:** Im Finale laufen weiter nur eine Render-Schleife und zwei Kontexte (Brett pausiert, Podest unsichtbar ohne Schleife); der Heap-Höchstwert im Finale steigt auf ≈ 223 MB, weil das Podest dort schon gebaut wird. Am Podest bleibt es bei einer Schleife.
- **Heap in der Lobby höher** (nach GC vor der ersten Partie ≈ 38 MB statt ≈ 15 MB) durch HDRI und PBR-Texturen der Arena; über drei Revanchen kein Wachstum über die Schwelle (Partie 3 ≤ max(+10 %, +5 MB) gegenüber Partie 1).
- Wie sich die zusätzlichen Draw Calls auf einer echten GPU auswirken, zeigt nur LS1–LS3 der [Gerätecheckliste](device-test-checklist.md).

## 3e. Standbild je Szenenwechsel (CHAOS-153)

Für CHAOS-132 ([EXP-025](experiments.md)) mussten Standbilder beim Wechsel Brett ↔ Minispiel mit temporären Messmarken gemessen werden; `pnpm perf` sah sie nicht, weil der Bildabstand nur Bilder **einer** Szene vergleicht und die Lücke beim Wechsel zwischen zwei Szenen liegt. Jetzt misst die Partie je Übergang die Long Tasks zwischen Aufbau und erstem Bild (Abschnitt 1, „Standbild je Szenenwechsel“) und vergleicht den **längsten Block** mit der Baseline (Szenario `partie-uebergaenge` in `tests/perf/baseline.json`, Schwellen in Abschnitt 5).

Baseline: Lauf auf `main` d28cc48 plus CHAOS-153 (2026-11-17, gleicher Messrechner wie 3d, Xeon 2,10 GHz ×4, Systemlast ≈ 3,5). Szenenwerte der Baseline unverändert gelassen. Kontrolllauf mit `PERF_STRICT=1`: alle Übergänge `ok`.

| Übergang | n (ohne erstes Bild) | längster Block Median / max ms, Baseline | Kontrolllauf | blockiert Median ms | Aufbau→erstes Bild Median ms |
|---|---|---|---|---|---|
| lobby → brett | 1 (0) | 1944 / 1944 | 1982 / 1982 | 3784 | 2112 |
| brett → minispiel | 5 (0) | 460 / **8595** | 447 / 3584 | 902 | 1022 |
| minispiel → brett | 5 (1) | 2381 / 3488 | 2494 / 3643 | 3835 | 1742 |
| zählung → podest | 1 (0) | 428 / 428 | 391 / 391 | 1510 | 1938 |

**Lesart:**
- **Brett → Minispiel** blockiert meist ≈ 0,45 s am Stück. Beim **ersten** Minispiel der Partie lag einmal ein Block von 8,6 s, im Kontrolllauf 3,6 s (erstes Minispiel, kalter Start: Chunk, Physik, Shader-Quellen). Das ist das Standbild aus KI-25. Der Median bleibt davon unberührt, der Höchstwert schwankt deshalb stark; seine Schwelle ist entsprechend weit.
- **Minispiel → Brett** ist der größte regelmäßige Block (≈ 2,4 s): Kontext und Natur-Brett werden nach jedem Minispiel synchron neu gebaut (CHAOS-152). Nach dem **letzten** Minispiel baut das Brett ≈ 1 s vor dem Finale neu auf und zeichnet dahinter nie ein Bild: Das Vorkommen zählt als „ohne erstes Bild“ und endet mit dem Aufbau des Podests.
- **Zählung → Podest** (Vorbereitung während der Zählung plus Zeigen): längster Block ≈ 0,4 s, wie seit CHAOS-71 erwartet. Die Trophäenzählung dazwischen zählt nicht mit.
- PR #69 (CHAOS-132) war beim Messen noch nicht gemergt. Nach dem Merge die Baseline der Übergänge neu schreiben (`PERF_UPDATE_BASELINE=1 pnpm perf -g Partie`, schreibt auch `partie`).
- Wie bei allen zeitlichen Werten: nur relativ, nur auf diesem Rechner. Ob ein Block auf echter Hardware spürbar ist, zeigt nur die Gerätecheckliste (N4).

## 3f. Heap nach GC statt Heap-Höchstwert (CHAOS-158)

**Befund:** `PERF_STRICT=1 pnpm perf -g Partie` scheiterte auf dem Messrechner (Xeon 2,10 GHz ×4, wie 3d) auch auf `main` ohne Codeänderung an `heapMaxMB`, jedes Mal an anderen Szenen. Referenzlauf auf `main` 73036b7 (2026-11-18): Krümel-Kehraus-Anleitung 81 → **184 MB**, Wackelturm-Ergebnis 76 → 119 MB, Pudding-Ergebnis 83 → 111 MB über der Grenze; zugleich **fallen** andere Szenen deutlich (Podest 172 → 135 MB, Wackelturm-Anleitung 146 → 124 MB). Der Höchstwert ohne GC zeigt, wie viel Müll bis zur nächsten Garbage Collection liegen bleibt, und hängt am GC-Zeitpunkt, nicht am Stand. Kein Leck: Revanche ×3 bleibt grün.

**Änderung:** Der Messlauf erzwingt je Vorkommen einer Szene einmal eine GC (`HeapProfiler.collectGarbage`) und liest danach den Heap (`heapRetainedMB`), sobald die Szene ≥ 6 s (4 Takte à 2 s) in Folge aktiv ist: aufgebaut, mit erstem Bild, die GC fällt nicht in den gemessenen Szenenwechsel. Je Szene zählt der Höchstwert über die Vorkommen (Brett 3×). Anleitung, Ergebnis (je 5 s) und Lobby (vor dem Start der Proben) bleiben ohne Wert. `heapMaxMB` bleibt in Tabelle und Baseline („Heap max / nach GC“), wird aber nicht mehr verglichen. Zusätzlich vergleicht `PERF_STRICT=1` Bildabstand p95 und Render-Zeit p95 erst ab 25 Bildern je Szene: Die Anleitung von Sockenregen zeichnet 3–4 Bilder, ihr p95 schwankte im selben Stand zwischen 10 und 619 ms.

**Baseline neu geschrieben** (`PERF_UPDATE_BASELINE=1`, Stand 73036b7 plus CHAOS-158, 2026-11-18), danach zwei Kontrollläufe mit `PERF_STRICT=1`:

| Szene | Heap max MB (Baseline / Lauf 2 / Lauf 3) | Heap nach GC MB (Baseline / Lauf 2 / Lauf 3) |
|---|---|---|
| brett | 206 / 203 / 206 | 84,7 / 85,2 / 85,5 |
| minispiel:pudding-gerangel | 101 / 109 / 93 | 54,9 / 55,3 / 54,9 |
| minispiel:kruemel-kehraus | 95 / 110 / 113 | 51,7 / 51,1 / 51,0 |
| minispiel:kuckucks-klatsche | 133 / 104 / 133 | 62,8 / 62,8 / 62,4 |
| minispiel:sockenregen | 153 / 146 / 144 | 73,1 / 73,8 / 74,8 |
| minispiel:wackelturm | 140 / 139 / 138 | 66,0 / 67,7 / 64,8 |
| finale | 228 / 253 / 247 | 112,1 / 112,6 / 112,7 |
| podest | 135 / 135 / 130 | 112,9 / 113,4 / 112,8 |

Heap nach GC schwankt um ≤ 2 MB (≤ 3 %), der Höchstwert um bis zu 30 %. Die Toleranz bleibt deshalb bei +20 % + 10 MB; ein echter Anstieg (z. B. eine Textur von 16 MB mehr im Speicher) fällt im Brett bei 85 MB trotzdem auf. Die erzwungene GC kostet je Vorkommen eine kurze Pause in der Szene; bei 30–200 Bildern je Szene verschiebt ein einzelnes langes Bild p95 kaum, die Szenenwechsel blieben in allen drei Läufen `ok`.

**Verbleibende Abweichung:** Beide Kontrollläufe sind in allen Heap-Werten, allen Szenenwechseln und allen strukturellen Werten grün. Rot blieb nur die **Render-Zeit p95 von Sockenregen** (22,1 bzw. 47,3 ms, Grenze 19,5 ms). Über fünf Läufe desselben Stands lag sie bei 24, 46, 14, 22 und 47 ms, der Median bei 6,5–8,6 ms. Bei ≈ 30 Bildern ist p95 praktisch der zweithöchste Einzelwert; eine Schwelle auf diesen Wert ist Zufall. Das ist kein Heap-Thema; gelöst mit CHAOS-165 (Abschnitt 3g).

## 3g. Median statt p95 bei Szenen unter 100 Bildern (CHAOS-165)

**Befund:** Nach CHAOS-158 blieb in `PERF_STRICT=1 pnpm perf -g Partie` nur die Render-Zeit p95 von Sockenregen rot, und das zufällig: 24, 46, 14, 22 und 47 ms in fünf Läufen desselben Stands, Grenze 19,5 ms. Unter SwiftShader zeichnen die Minispiele in 15 s Spielzeit 28–62 Bilder, Lobby ≈ 80, Podest ≈ 50; bei 30 Bildern ist p95 der zweithöchste Einzelwert.

**Varianten** (aus der Aufgabe):

| Variante | Bewertung |
|---|---|
| (a) Baseline aus mehreren Läufen (Höchstwert/Median von drei) | Verschiebt nur die Grenze; der Vergleichswert bleibt ein Einzelbild und kann weiter zufällig darüber liegen. Jedes Baseline-Update kostet drei Läufe (≈ 15 min). Verworfen |
| (b) Längere Spielzeit (z. B. 60 s statt 15 s je Minispiel) | Erst ab ≈ 100 Bildern ist p95 ein Perzentil; das hieße ≈ 50 s je Minispiel, Lauf 5 → ≈ 9 min, und Lobby/Podest bräuchten dasselbe. Verworfen |
| (c) Unter 100 Bildern den Median statt p95 vergleichen | Kostet nichts, der Median schwankt im selben Stand um ≈ ±15 %, eine echte Verlangsamung je Bild verschiebt ihn genauso. Einzelne lange Bilder fangen die Szenenwechsel-Schwellen (3e). **Gewählt** |

**Änderung** (`tests/perf/report.ts`): `PERF_STRICT=1` vergleicht Bildabstand und Render-Zeit jetzt als **Median** (Toleranz wie p95: +25 % + 4 ms bzw. + 2 ms) ab 25 Bildern und als **p95** erst ab 100 Bildern (`MIN_FRAMES_FOR_MEDIAN`, `MIN_FRAMES_FOR_P95`). Darunter steht in der Vergleichstabelle „zu wenige Bilder“; p95 bleibt in der Szenentabelle sichtbar. Unter SwiftShader wird p95 damit nur noch im Brett (≈ 200 Bilder) verglichen. Die Baseline enthält die Mediane bereits, sie blieb unverändert (12:55-Stand aus 3f). Unit-Tests: `tests/perf/report.test.ts` (Vitest-Projekt `perf-report`); das Perf-Playwright-Projekt sammelt nur noch `*.spec.ts`.

**Kontrolle:** zwei aufeinanderfolgende Läufe `E2E_SKIP_BUILD=1 PERF_STRICT=1 pnpm perf -g Partie` auf `main` 1604c06 plus dieser Änderung (2026-11-18, Xeon 2,10 GHz ×4, Systemlast ≈ 3,3), beide **grün**. Werte Baseline / Lauf 1 / Lauf 2 (Grenze):

| Szene | Bilder | Render Median ms | Render p95 ms (nur berichtet, außer Brett) | Bildabstand Median ms |
|---|---|---|---|---|
| lobby | 79 / 78 / 79 | 2,9 / 3,6 / 3,4 (≤ 5,6) | 20,5 / 13,2 / 13,8 | 208 / 217 / 214 (≤ 264) |
| brett | 212 / 197 / 192 | 6,0 / 6,1 / 6,9 (≤ 9,5) | 18,2 / 22,4 / 20,8 (≤ 24,7, verglichen) | 521 / 541 / 572 (≤ 655) |
| minispiel:pudding-gerangel | 38 / 40 / 37 | 5,2 / 5,6 / 5,5 (≤ 8,6) | 17,7 / 12,9 / 16,9 | 371 / 354 / 380 (≤ 468) |
| minispiel:kruemel-kehraus | 62 / 53 / 54 | 4,5 / 5,3 / 6,0 (≤ 7,6) | 8,1 / 11,6 / 11,5 | 248 / 283 / 282 (≤ 314) |
| minispiel:kuckucks-klatsche | 54 / 52 / 50 | 5,4 / 6,5 / 6,5 (≤ 8,7) | 12,0 / 13,1 / 13,5 | 285 / 293 / 299 (≤ 360) |
| minispiel:sockenregen | 29 / 31 / 28 | 8,6 / 7,5 / 9,5 (≤ 12,7) | 14,0 / 18,0 / **22,1** (alte Grenze 19,5) | 525 / 489 / 532 (≤ 660) |
| minispiel:wackelturm | 42 / 41 / 41 | 7,1 / 7,4 / 8,2 (≤ 10,9) | 13,7 / 15,4 / 14,9 | 359 / 364 / 368 (≤ 452) |
| podest | 49 / 46 / 46 | 4,9 / 4,7 / 4,5 (≤ 8,1) | 12,7 / 8,7 / 9,4 | 216 / 229 / 227 (≤ 274) |

**Lesart:** Nach der alten Regel wäre Lauf 2 wieder an Sockenregen gescheitert (22,1 > 19,5 ms), ohne Codeänderung. Die Mediane liegen in beiden Läufen mit Abstand unter ihrer Grenze (höchstens 79 % davon, Krümel-Kehraus Render 6,0 von 7,6 ms). Grenze der Methode: Ein Rückfall, der nur **einzelne** Bilder einer kurzen Szene verlängert, fällt im Median nicht auf; Standbilder beim Szenenwechsel misst 3e, Ruckler auf echter Hardware nur die Gerätecheckliste. Das Brett liegt mit p95 22,4 ms nahe an seiner Grenze 24,7 ms: Schlägt es künftig ohne Änderung an, ist dort derselbe Mechanismus zu prüfen (≈ 200 Bilder, p95 = zehnthöchster Wert).

## 3h. Brett bleibt während des Minispiels eingehängt (CHAOS-152)

`BoardStage` wird nach dem Minispiel nicht mehr neu gebaut, sondern nur ausgeblendet und angehalten (kein Rendern, keine Regie; [EXP-029](experiments.md)). Vergleich vorher (`main` 1604c06) / nachher, je ein Lauf, gleicher Rechner:

| Übergang | längster Block Median / max ms | Aufbau→erstes Bild Median ms |
|---|---|---|
| brett → minispiel | 500 / 9069 → 485 / 742 | 1259 → 1172 |
| minispiel → brett | 2200 / 3380 → 570 / 2412 | 1653 → 9 |

**Gewollte Strukturänderung:** Kontexte im Minispiel 1 → 2, Heap nach GC im Minispiel 52–74 → 112–145 MB (Brett bleibt im Speicher; Finale/Podest liegen bei ≈ 120 MB). Revanche ×3 unverändert (Lobby 1 Kontext, kein Wachstum). Baseline der Partie danach neu geschrieben (`PERF_UPDATE_BASELINE=1 pnpm perf -g Partie`).

## 3i. Wechsel Brett → Minispiel: Warten auf den GPU-Prozess (CHAOS-174)

Der längste Block Brett → Minispiel (Perf-Partie auf dem Mac, Median 0,79–0,84 s) ist **kein** Kontextaufbau. Mit Messmarken ([EXP-030](experiments.md)) wandert er immer zum ersten synchronen GL-Aufruf nach dem Ausblenden des Bretts (`new Engine(…)`, eine Größenänderung der Leinwand oder ein Aufruf beim Figuren-Laden) und dauert dort ≈ 0,8 s. Wird die Bühne 1,5 s später aufgebaut, kostet `new Engine(…)` 15–20 ms und der längste Block sinkt auf 124–150 ms. Lesart: SwiftShader arbeitet beim Wechsel noch vorausgelaufene Brett-Bilder ab. Eine über die Partie geteilte Minispiel-Engine brachte keinen Gewinn (Median 789–1344 ms) und wurde verworfen. Die Kennzahl „brett → minispiel“ misst auf SwiftShader also vor allem diese Warteschlange; ob auf echter Hardware ein Standbild bleibt, zeigt nur N4.

## 3j. Ein Chunk je Minispiel (CHAOS-86)

Mit ~200 Minispielen (CHAOS-80) wüchse die Minispiel-Bühne aus §3c um ≈ 30–90 kB je Spiel, und die App lädt sie schon in der Lobby vor. Jetzt lädt der Host jedes Spiel als eigenen Chunk über `@chaos-party/minigames/lazy`, sobald der Stand das Minispiel der Runde nennt ([ADR-004 Nachtrag 2](decisions/ADR-004-host-szene.md)).

**Bundle** (Production-Build, `pnpm check:bundle`, 2026-11-20):

| Was | vorher (`main` 097aa5a) | nachher |
|---|---|---|
| Start (statisch) | 414 kB (gzip 133 kB), 5 Dateien | 420 kB (gzip 135 kB), 6 Dateien (Steckbriefe als `minispiel-katalog` 7,7 kB) |
| Minispiel-Bühne (statische Kette, lädt vorab in der Lobby) | 2.737 kB (gzip 737 kB) mit allen 6 Spielen | **2.568 kB (gzip 694 kB)** ohne Spiel |
| je Minispiel zusätzlich zur Bühne | – (in der Bühne) | 31–87 kB (gzip 11–22 kB) |

Was mit jedem neuen Spiel im Start bleibt: sein Steckbrief (`info.ts`, ≈ 0,3–0,5 kB) und eine Lade-Zeile. Der Start wächst also nicht mit dem Spiel-Code, die Bühne gar nicht.

**Warten beim Start eines Minispiels.** Die Marke `minispiel:aufbau` sitzt in der Bühne, also *nach* dem Laden des Spiel-Chunks. Neu ist deshalb die Marke `minispiel:angefragt` auf dem Empfang des Stands, der das Minispiel nennt (`App.tsx`). Die Übergänge zählen ab da; `requestMs` (Anfrage bis Aufbau) steht in `perf-results/partie*.json` unter `transitions`/`transitionList`. Vorher-Lauf = `main` plus nur diese Marke. Perf-Partie, je 5 Wechsel brett → minispiel, SwiftShader, gleicher Rechner:

| Lauf | Anfrage → Aufbau je Wechsel ms | Median | Wartezeit bis erstes Bild Median ms |
|---|---|---|---|
| vorher | 302 · 2 · 24 · 2 · 1 | 2 | 1642 |
| nachher, erster Entwurf (Bühne wartet per Suspense) | 302 · 302 · 350 · 303 · 302 | 302 | 1587 |
| nachher (Bühne erst mit geladenem Modul) | 15 · 14 · 142 · 11 · 10 | 14 | 1575 |
| nachher, Wiederholung | 34 · 16 · 92 · 12 · 9 | 16 | 1534 |

- **Gefunden dabei: Suspense-Drossel.** Hat React einmal einen Fallback gezeigt, deckt es den Inhalt frühestens nach 300 ms auf. Der erste Entwurf (`use()` in der Bühne) kostete so jedes Minispiel 300 ms. Dasselbe galt schon vorher für das **erste** Minispiel jeder Partie (302 ms): `React.lazy` hält auch einen längst vorgeladenen Chunk beim ersten Rendern an. Jetzt lädt die App Bühnen-Chunk und Spiel-Modul selbst (`useMinigameStage`, `useMinigameModuleStatus`) und hängt die Bühne erst ein, wenn beides da ist.
- **Ergebnis:** Über die Partie wartet der Host weniger als vorher (Summe 163–192 statt 331 ms), weil die 300 ms am ersten Minispiel wegfallen. Je späterem Minispiel kommen ≈ 10 ms dazu (Chunk holen und ausführen, lokal ausgeliefert), bei einem Spiel 70–120 ms. Gegenüber 1,0–2,1 s bis zum ersten Bild der Anleitung liegt das im Rauschen der Wartezeit (±30 %, §2).
- **Nicht geprüft:** Ladezeit auf Rubens PC und am Fernseher (N4 der Gerätecheckliste). Früher vorladen ginge nur, wenn der Server das Minispiel vor `minigame-intro` nennt (CHAOS-225).

## 4. Umgesetzte Optimierungen

| Engpass (belegt durch) | Änderung | Ergebnis |
|---|---|---|
| Brett rendert hinter Trophäenzählung und Podest weiter: 2 Render-Schleifen, 2 Szenen je Bild (`finale`/`podest`: Schleifen 2) | `BoardScene.setRenderPaused`: Sobald das Finale das Brett überdeckt, stoppt `BoardStage` die Render-Schleife des Bretts; nur die Regie läuft per `requestAnimationFrame` weiter (Stand, HUD). Die Leinwand behält das letzte Bild (die Zählung ist zu 92–95 % deckend, das Podest ganz). Der Kontext bleibt: „Nochmal spielen“ führt in die Lobby, die das Brett ohnehin entsorgt. | Schleifen 2 → 1, Podest-Bildabstand p50 351 → 100 ms (SwiftShader) |
| Brett: 15 Bäume aus je 3 Meshes = 45 Draw Calls | Bäume als Instanzen (`createInstance`) von 5 Vorlagen (Stamm, je Kronenform und Material); Wackeln weiter je Baum-Knoten | Draw Calls 187 → 150; Screenshot `host-brett` unverändert. **Entfallen mit CHAOS-62** (neue, je Baum verformte Bäume, siehe Abschnitt 3a) |
| Start-Bundle des Hosts 2.750 kB statisch, inkl. Babylon und aller Szenen (CHAOS-53, Sourcemap-Analyse) | Arena, Brett, Minispiele per dynamischem Import, Vorladen nach der Arena, `minigame-sdk` nebenwirkungsfrei, Budget-Prüfung `pnpm check:bundle` (Abschnitt 3c) | Start 2.750 → 404 kB (gzip 739 → 130 kB); ganze Partie unverändert |
| Minispiel-Bühne enthält alle Minispiele und wächst mit dem Katalog (CHAOS-86, Vite-Manifest) | Chunk je Minispiel über `@chaos-party/minigames/lazy`, Steckbriefe in einem Katalog-Chunk, Bühne erst mit geladenem Modul (keine Suspense-Drossel), Prüfung in `pnpm check:bundle` (Abschnitt 3j) | Bühne 2.737 → 2.568 kB und wächst nicht mehr; erstes Minispiel der Partie 302 → 15–34 ms von der Anfrage bis zum Aufbau |
| Alter Endstand nach „Nochmal spielen“: Der Server zählt `eventSeq` je Partie ab 0, die Regie hielt die neue Partie für „veraltet“ und zeigte weiter den Siegerbildschirm samt Podest (zwei Szenen) | Regie (`director.ts`) erkennt eine neue Partie (eventSeq 0 nach `game-results`) und springt auf den Stand; Unit-Test und Prüfung im Revanche-Messlauf | gefunden durch den Revanche-Messlauf; funktionaler Fehler, nicht nur Performance |

| Siegerpodest baut erst beim Erscheinen und übersetzt alle Shader am Stück (`whenReadyAsync`): 3 Blöcke bis 0,84–1,04 s am Übergang (SwiftShader, `minimal`), KI-25 (CHAOS-71) | Das Finale baut das Podest zu Beginn der Trophäenzählung auf einer unsichtbaren Leinwand (ohne Render-Schleife); Pausen zwischen den Aufbauschritten, Shader je Mesh in ≈ 12-ms-Abschnitten mit Bildpause (`scene/prepareGradually.ts`), erstes Bild vorab. Der Siegerbildschirm hängt die Leinwand nur ein und startet die Schleife. Während der Zählung zwei WebGL-Kontexte (Brett pausiert + Podest), wie bisher am Podest | Übergang 35–47 ms (`minimal`) bzw. 46–110 ms (`hoch`), kein Long Task; während der Zählung ein Block bis ≈ 1 s ([EXP-021](experiments.md)) |
| Minispiel-Bühne und Brett übersetzen alle Shader am Stück (`whenReadyAsync`): Anleitung steht 0,6–0,9 s (`minimal`) bzw. 1,0–1,8 s (`hoch`), SwiftShader, KI-25 (CHAOS-132) | Beide nutzen `prepareSceneGradually`. Die Hilfsfunktion lädt jetzt die Shader-Quellen vorab (sonst übersetzen alle Effekte nach Babylons Nach-Import in einer Aufgabe), schaltet den Pre-Pass ein wie `scene.isReady` (sonst übersetzt bei `hoch` das erste Bild 21 Programme neu) und lässt vor der ersten Runde ein Bild zeichnen | Shader-Blöcke ≤ 0,14 s (`minimal`) bzw. ≤ 0,33 s (`hoch`); längster Block nach `runner.prepare` bei `hoch` 1,0–1,8 → 0,5–0,77 s. Kontext- und Brett-Neuaufbau beim Wechsel: seit CHAOS-152 entfallen ([EXP-025](experiments.md)) |
| Nach jedem Minispiel neuer WebGL-Kontext und synchroner Brett-Neuaufbau: Minispiel → Brett längster Block Median 2,2 s, Kontext-Warten bis 2,7 s (KI-25, CHAOS-152) | Brett bleibt während des Minispiels eingehängt, ausgeblendet (`visibility`) und angehalten (`BoardScene.setHidden`: keine Schleife, keine Regie); `director.settle()` beim Zeigen; Stimmung der nächsten Runde wird währenddessen vorbereitet (`NatureLook.prepareMood`) | Minispiel → Brett Median 2,2 → 0,57 s, erstes Brett-Bild nach 9 ms; Preis: 2 Kontexte und +60 MB Heap im Minispiel ([EXP-029](experiments.md), Abschnitt 3h) |

Geprüft und **nicht** geändert:

| Kandidat | Befund |
|---|---|
| Brett-Szene während der Minispiele | Früher entsorgt (je 1 Kontext, 1 Schleife). **Seit CHAOS-152** bewusst eingehängt und angehalten (2 Kontexte, 1 Schleife), siehe Abschnitt 3g |
| Render-Schleife bei verdecktem Tab | Babylon nutzt `requestAnimationFrame`; Browser pausieren es in Hintergrund-Tabs. Die Messanzeige zählt solche Lücken als „Pausen“; Prüfung am Gerät: PF9 |
| Speicher über mehrere Partien | Kein Wachstum (Revanche ×3); Dispose beim Szenenwechsel greift |
| Server-Broadcast der `board`-Views | ≈ 0,5 Nachrichten/s mit ≈ 1,4 kB; nur bei Ereignis oder geänderter Sicht (`lastViewKey`). Nicht relevant, nicht geändert |
| `freezeActiveMeshes`, eingefrorene Materialien | JS-Render-Zeit je Bild 2–6 ms (Median) bei 60–250 ms Bildabstand: kein Engpass in SwiftShader; auf echter Hardware erst nach Rubens Messung bewerten (Figuren, Popups und Marker ändern die aktive Liste ständig) |
| Schatten (1024er Karte, PCF) | Zeichnet nur Figuren, Wegweiser und Pokale; Änderung wäre sichtbar → nur bei Bedarf nach Hardware-Messung. **Nachtrag CHAOS-73:** Der Natur-Look nutzt bei `hoch`/`mittel` PCSS; dessen Filterstufe `HIGH` war der Engpass (Abschnitt 3b), jetzt `LOW` |
| Minispiel Sockenregen (≈ 160 Draw Calls, mit Natur-Kulisse ≈ 260) | Größter Minispiel-Wert; liegt im Minispiel-Paket. Kandidat für Instanzen, falls Rubens Messung dort Ruckler zeigt |
| Natur-Bäume auf dem Brett (CHAOS-62, ≈ 30 Bäume à 2 Meshes plus Schattenpass) | Nicht instanzierbar (jeder Baum eigene Geometrie), wackeln je Baum. Zusammenfassen ginge nur mit Wind im Vertex-Shader statt Knoten-Drehung; erst nach Rubens Messung (PF2, N1–N3) und nur, wenn das Brett auf seiner GPU ruckelt |

## 5. Schwellen

**Keine erfundenen Universalwerte.** M1 hat keine Hardware-Messwerte geliefert (Abnahme M1: „Einzelergebnisse nicht gemeldet“, P3/P9 leer). Deshalb:

| Schwelle | Wert | Herkunft | Geprüft |
|---|---|---|---|
| WebGL-Kontexte je Szene | ≤ Baseline (heute: 1, am Podest/Finale 2) | eigene Baseline `tests/perf/baseline.json` | immer (`pnpm perf`) |
| Render-Schleifen je Szene | ≤ Baseline (heute überall 1) | eigene Baseline | immer |
| Draw Calls je Szene (Median) | ≤ Baseline · 1,1 + 5 | eigene Baseline; Rest-Schwankung durch Spielverlauf | immer |
| Bildabstand Median je Szene (CHAOS-165) | ≤ Baseline · 1,25 + 4 ms, ab 25 Bildern | eigene Baseline (SwiftShader, Abschnitt 3g) | nur `PERF_STRICT=1` auf dem Baseline-Rechner |
| Bildabstand p95 je Szene | ≤ Baseline · 1,25 + 4 ms, ab 100 Bildern | eigene Baseline (SwiftShader) | nur `PERF_STRICT=1` auf dem Baseline-Rechner |
| Render-Zeit Median je Szene (CHAOS-165) | ≤ Baseline · 1,25 + 2 ms, ab 25 Bildern | eigene Baseline (Abschnitt 3g) | nur `PERF_STRICT=1` |
| Render-Zeit p95 je Szene | ≤ Baseline · 1,25 + 2 ms, ab 100 Bildern | eigene Baseline | nur `PERF_STRICT=1` |
| Heap nach GC je Szene (CHAOS-158) | ≤ Baseline · 1,2 + 10 MB | eigene Baseline; erzwungene GC einmal je Vorkommen nach ≥ 6 s, Höchstwert über die Vorkommen (Abschnitt 3f). Der Heap-**Höchstwert** ohne GC wird nur noch berichtet | nur `PERF_STRICT=1` |
| Mindestzahl Bilder (CHAOS-158, CHAOS-165) | Median ab 25, p95 ab 100 Bildern je Szene, sonst „zu wenige Bilder“ statt Vergleich | Anleitung und Ergebnis der Minispiele zeichnen 3–20 Bilder (3f); bei 28–62 Bildern ist p95 ein Einzelwert und schwankte 14–47 ms (3g). Unter SwiftShader wird p95 nur im Brett verglichen | nur `PERF_STRICT=1` |
| Längster Block je Szenenwechsel, Median über die Vorkommen (CHAOS-153) | ≤ Baseline · 1,5 + 150 ms | eigene Baseline, Szenario `partie-uebergaenge`; weiter als beim Bildabstand, weil Long Tasks unter SwiftShader stärker schwanken (EXP-025) | nur `PERF_STRICT=1` |
| Längster Block je Szenenwechsel, Höchstwert | ≤ Baseline · 1,5 + 250 ms | wie oben; fängt einen einzelnen Rückfall (z. B. Shader wieder am Stück) | nur `PERF_STRICT=1` |
| Heap über drei Partien | Partie 3 ≤ max(Partie 1 · 1,1; Partie 1 + 5 MB) | im selben Lauf | immer |
| Bildrate/Bildabstand auf Rubens PC | **offen, Messung durch Ruben** (PF1/PF2); Ziel CHAOS-73: Brett und Minispiele p95 ≤ 20 ms in 1080p | Gerätecheckliste | – |
| Bildabstand auf dem Mac (M3 Max, ohne VSync) | Richtwert aus Abschnitt 3b; nur Vergleich vorher/nachher mit `PERF_GPU=1` auf demselben Rechner | EXP-014 | – (kein Grenzwert in `pnpm perf`) |
| Eingabe→Frame und RTT auf echten Geräten | **offen, Messung durch Ruben** (PF3, PF5, PF6) | Gerätecheckliste | – |

Vorschlag für die Zeit nach Rubens Messung: dieselbe Regel wie oben (+25 % auf den gemessenen p95 je Szene) als Regressionsgrenze für spätere Messungen auf **seinem** Rechner; eine harte Untergrenze („mindestens X fps“) erst, wenn PF2 zeigt, ab welchem Wert es sich unflüssig anfühlt.

Die Baseline gilt für den Rechner, auf dem sie entstand (`environment` in der Datei). Auf einem anderen Rechner erst `PERF_UPDATE_BASELINE=1 pnpm perf` auf dem alten Stand, dann vergleichen.

## 6. Nur auf echter Hardware messbar

- Bildrate und Bildabstand mit **Rubens** GPU, HiDPI/4K-Auflösung und Fernseher (Bildwiederholrate, Eingabeverzögerung des Fernsehers). Gemessen ist bisher nur ein Mac mit M3 Max (Abschnitt 3b).
- Gesamtlatenz Finger → Bild (Touch-Verarbeitung in iOS-Safari, WLAN, Compositor, Monitor): nur Zeitlupenvideo.
- RTT über echtes WLAN (2,4/5 GHz, Mesh, Störungen), iOS-Timer-Drosselung, Energiesparmodus.
- Verhalten schwacher PCs (integrierte Grafik), Thermik über eine lange Partie.
- `performance.memory` gibt es in Safari/Firefox nicht; Heap am PC nur mit Chrome/Edge.

Messpunkte dafür: [Gerätecheckliste, Abschnitt 11](device-test-checklist.md#11-m4--performance-für-chaos-43).
