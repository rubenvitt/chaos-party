# USDZ-Assets für den nativen Apple-Host

Stand 2026-11-17, CHAOS-140, [ADR-019](decisions/ADR-019-nativer-apple-host.md) §5. Experiment: EXP-026 in [`experiments.md`](experiments.md).

Der native Host (RealityKit, Mac und Apple TV) zeigt dieselben Figuren und dieselbe Brett-Kulisse wie der Babylon-Host; dazu kommen die Requisiten der Minispiele (CHAOS-221). Alles entsteht mit **einem Befehl** aus den Quellen im Repo und wird nicht eingecheckt.

## Befehl

```bash
pnpm build:apple-assets
```

| Option | Wirkung |
|---|---|
| `--nur=figuren` | nur die vier Figuren (≈ 30 s) |
| `--nur=requisiten` | nur die Requisiten der Minispiele (≈ 5 s) |
| `--nur=brett` | nur die Kulissen (je Brett ≈ 3 min unter Linux, Software-Rendering) |
| `--brett=<id>` | nur die Kulisse dieses Bretts (mit `--nur=brett`; ohne die volle Prüfung) |
| `--out=<ordner>` | anderer Ausgabeordner (Standard `build/apple-assets/`, aus dem Manifest) |
| `--ohne-pruefung` | Prüfungen auslassen |

Umgebung: `BLENDER_PYTHON` (Python mit `bpy` und `usd-core`; ohne die Variable legt das Skript `.venv-blender` mit `uv` an), `BOARD_EXPORT_TIMEOUT` (ms), `BOARD_EXPORT_VERBOSE=1`, `RK_CHECK=0` (keine RealityKit-Prüfung auf dem Mac).

Voraussetzungen: `pnpm install`, Playwright-Chromium (`pnpm exec playwright install chromium`), `uv` oder ein Python 3.13 mit `packages/assets/blender/requirements.txt`. Blender selbst ist nicht nötig, `bpy` kommt als Python-Paket.

## Ausgabe

| Datei | Inhalt |
|---|---|
| `figuren/<id>.usdz` | Figur direkt aus dem bpy-Skript (`packages/assets/blender/build.py <id> <ziel.usdz>`), ≈ 0,5–1 MB |
| `figuren/<id>.clips.json` | Lage der sieben Clips auf der Zeitleiste |
| `requisiten/<id>.usdz` | Requisit der Minispiele (CHAOS-221) direkt aus dem bpy-Skript (`packages/assets/blender/props.py --usdz <id\|all> <ordner>`), 8–108 KiB, 42 Requisiten (CHAOS-88 und CHAOS-222) (Budget 160 KiB je Requisit im Manifest) |
| `bretter/<brett-id>/brett.usdz` | Kulisse eines Bretts aus dem Web-Host (Grafikstufe `hoch`), über Blender nach USDZ, ≈ 25 MB (Wackelwald) bzw. 23 MB (Rummelplatz, mit den Drehteilen `karussell_dreh` und `riesenrad_rad`, CHAOS-199) |
| `bretter/<brett-id>/brett.szene.json` | Brett-ID (`board`), Kamera, Sonne, Himmel, Figurenorte, **Felder** (`fields`), Instanz-Gruppen |
| `bretter/<brett-id>/brett.instanzen.json` | Matrizen für Gras und Blumen (Wackelwald: 64 246 Instanzen) |
| `herkunft.json` | Lizenzen, Namensnennungen und Herkunft je Artefakt, Größe und SHA-256 |

**Je Brett eine Kulisse (CHAOS-212):** Der Export läuft für jedes Brett aus `BOARD_REGISTRY` (`packages/game-core/src/board/registry.ts`) mit einem Vite-Server und einem Browser nacheinander (`exportBoards` in `scripts/lib/board-export.mjs`, Seite `boardExport.html?brett=<id>`). Der Beispiel-Spielstand passt sich dem Brett an (`demoStartMessage` in `apps/host/src/board/demo.ts`), damit Pokal, Falle und „Am Zug“-Marker als Vorlagen im Export liegen. Jedes Brett braucht im Manifest ein Artefakt `bretter/<brett-id>/brett.usdz` mit `from` (Unit-Test `scripts/lib/board-artifacts.test.mjs`); der volle Lauf prüft mit `check_usdz.py --vollstaendig`, dass alle Artefakte vorliegen. Feld-IDs beginnen mit `s` (`pokal_s…`, `falle_s…` sucht `BoardScene.swift`).

## Vertrag für die Swift-Seite

**Koordinaten:** rechtshändig, Y oben, Meter, wie RealityKit. `brett.usdz` mit Identitäts-Transform einsetzen, dann gelten alle Weltkoordinaten aus den JSON-Dateien unverändert. Figuren blicken nach +z, Füße bei y = 0.

**Feld-Anker:** Jedes Feld aus game-core hat im Brett einen leeren Knoten `feld_<id>` (z. B. `feld_s07`) unter `felder`, auf der Feldoberfläche in der Feldmitte. `brett.findEntity(named: "feld_s07")?.position(relativeTo: nil)` ist der Standort einer Figur. Dieselben Daten stehen in `brett.szene.json` → `fields` (`id`, `anchor`, `kind`, `next`, `position`). Die Namensregel (`feld_` + ID, Zeichen außer `A–Z a–z 0–9 _` → `_`) steht in `apps/host/src/export/anchors.ts`. Mehrere Figuren auf einem Feld verteilt der Host selbst (wie `spreadPawns` im Babylon-Host).

**Figuren-Animationen:** USD kennt je Datei nur eine Animation. Alle Clips (`idle`, `run`, `jump`, `hit`, `cheer`, `sad`, `fall`) liegen deshalb nacheinander auf einer Zeitleiste mit 30 Bildern/s und 6 leeren Bildern dazwischen. `<id>.clips.json` nennt je Clip `start`/`end` in Sekunden ab Beginn und `loop`:

```swift
let source = figure.availableAnimations[0]
let clip = try AnimationResource.generate(with: source.definition.trimmed(start: idle.start, end: idle.end))
figure.playAnimation(idle.loop ? clip.repeat() : clip)
```

Der Spike `spikes/renderer-realitykit` macht das schon für `idle` (`SceneBuilder.playIdle`). Dass der Nullpunkt von `trimmed` dem ersten Bild der Zeitleiste entspricht, prüft `check_realitykit.swift` (Dauer = Ende des letzten Clips). Am Gerät ist das noch nicht angesehen.

**Slot-Farbe und Abzeichen:** wie im Babylon-Host. Das Material `akzent` färbt der Host in die Slot-Farbe. Der leere Knoten `abzeichen` (Brust, bewegt sich mit) trägt das Slot-Symbol.

**Requisiten (CHAOS-221):** Vertrag wie das GLB aus CHAOS-88 (`packages/assets/src/props.ts`): Meter, Y oben, vorn +z, Boden bei y = 0, Grundfläche mittig über dem Ursprung, statisch. Prims `/root/<id>/<id>_<material>` (Bindestrich → `_`, also `eichel_faul`), ein Mesh je Material aus `PROP_MATERIALS` (`lack`, `matt`, `glas`, `metall`, `akzent`, `zustand`). Die Vertexfarben sind in eine Farbtextur je Requisit gebacken (256², `textures/<id>_farbe.png`, Primvar `st`). **Färben zur Laufzeit:** `akzent` (Slot-Farbe, immer mit Slot-Symbol) und `zustand` (Spielzustand, z. B. Bräunung des Toasts, Türfarbe) sind weiß und ohne Textur; der Host ersetzt das Material der Entität `<id>_akzent` bzw. `<id>_zustand` (`findEntity(named:)`, alle `ModelComponent` darunter) wie im Babylon-Host. Welche Requisiten welche Laufzeit-Materialien haben, steht in `PROP_RUNTIME`. `glas` ist durchscheinend (Deckkraft 0,55 wie im GLB). **Eingebunden seit CHAOS-237:** `prepare.sh` kopiert `requisiten/*.usdz` in die App (`payload/szene/requisiten/`), `app/PropLibrary.swift` lädt alle beim Start, und `MinigameScene` setzt sie an die Wurzeln aus `minigame.props` (Vertrag: `apps/apple-host/CONTRACT.md`, Abschnitt Minispiel-Darstellung). Die Grundkörper, die der JS-Kern headless baut, zeichnet Swift nur ohne USDZ.

**Materialien:** `UsdPreviewSurface` je Material mit Rauheit, Clearcoat, Metall und Leuchten. Die Vertexfarben der Figuren sind in eine Farbtextur je Figur gebacken (1024², `textures/<rig>_farbe.png` im USDZ, UV-Map `farbatlas` → Primvar `st`), weil RealityKit Vertexfarben im Material ignoriert (EXP-017). **Feinstruktur (CHAOS-172, EXP-032):** Strick, Fell, Lack und Kaktushaut sind eine kachelbare Normal-Textur (256², `textures/struktur_<muster>.png`) am Eingang `normal`, gelesen über die zweite UV-Map, Primvar `struktur` (Würfelprojektion in Weltmaß, `packages/assets/blender/struktur.py`). Die Stärke steckt in der Textur selbst, weil UsdPreviewSurface keine Stärke kennt. **Sheen** (Fell, Strick) und **Subsurface** kennt UsdPreviewSurface nicht; sie fehlen gegenüber Babylon. In der Kulisse verlieren nur die Gras-Grundmeshes `gras_0…2` ihr Material (Vertexfarbe ohne Material, wie im Spike).

## Prüfungen

- **Ohne Mac** (Linux-CI, Job „Apple-Assets (USDZ)“): `packages/assets/usd/check_usdz.py` mit usd-core.
  - alle Validatoren von usd-core
  - Figuren: Clip-Tabelle passt zu Zeitleiste und Manifest, jedes Mesh hat ein Material, keine Vertexfarbe im Shader, `akzent` gebunden, `abzeichen` vorne, mit gebackenem Skinning Füße bei y = 0 und Höhe wie im Manifest (±0,1 m)
  - Figuren, Feinstruktur (CHAOS-172): jede UV-Primvar, die ein Material liest (`st`, `struktur`), liegt am Mesh; mindestens eine Normal-Textur, gelesen als `raw` mit `scale 2`/`bias -1`
  - Figuren, Auflage (CHAOS-161): aufgesetzte Teile schweben nicht über ihrem Träger (`AUFLAGE` in `check_usdz.py`: Socken-Bündchen auf dem Schaft, Kaktus-Blüte auf dem Kaktus, Kaktus im Topf). Gemessen wird der Median des Abstands der Unterseite (unterste 2 cm) zur Trägeroberfläche, Punkte im Träger zählen 0, erlaubt sind 3 cm; in der Ruhepose und am Anfang und in der Mitte jedes Clips, mit gebackenem Skinning. Bounds allein fanden den Fehler nicht.
  - Bretter (je `bretter/<id>/`): `board` in `brett.szene.json` gleich dem Ordnernamen, alle Feld-Anker genau einmal und auf 1 mm am Ort aus `fields`, alle Instanz-Grundmeshes, eingebettete Texturen
- Requisiten (je `requisiten/<id>.usdz`, CHAOS-221): Manifest-Eintrag `requisit-<id>`, Wurzel-Prim `<id>`, Y oben, Boden bei y = 0 und Grundfläche mittig (±5 mm), Höhe wie im Manifest (±1 cm); dieselben Materialien wie das GLB, jedes Mesh mit Material und als `<id>_<material>` benannt; keine Vertexfarbe im Shader, Farbe aus einer eingebetteten Textur; `akzent`/`zustand` weiß ohne Textur; Deckkraft wie im GLB (`baseColorFactor[3]`); jede gelesene UV-Primvar am Mesh. Jedes Requisit aus `PROP_IDS` braucht ein Manifest-Artefakt `requisiten/<id>.usdz` mit `from: [requisit-<id>]` und Budget (Unit-Test `scripts/lib/prop-artifacts.test.mjs`).
- **Herkunft:** Jede Textur im Brett-Export muss aus einem Manifest-Asset kommen, das das Artefakt in `from` nennt, oder eine Beschriftung (Wegweiser, „Am Zug“-Pfeil, gezeichnet mit Nunito) sein (`scripts/lib/board-images.mjs`). `pnpm check:assets` prüft die Einträge unter `builds` im Manifest und, wenn gebaut, die Budgets.
- **Auf dem Mac** zusätzlich `packages/assets/usd/check_realitykit.swift`: RealityKit lädt alles, Achsen, Feld-Anker, `abzeichen`, Länge der Zeitleiste und dieselbe Auflage-Prüfung mit den Meshes, wie RealityKit sie geladen hat (nur Ruhepose: das verformte Skinning gibt RealityKit nicht an die CPU heraus). Die Prüfung läuft nur lokal mit `pnpm build:apple-assets` auf einem Mac; die CI prüft unter Linux nur mit usd-core, und die Mac-Workflows setzen `RK_CHECK=0`.
  - Requisiten (CHAOS-221): Wurzel `<id>` und Teile `<id>_<material>` mit Geometrie, Boden bei y = 0, Grundfläche mittig, `glas` als durchscheinendes `PhysicallyBasedMaterial` geladen.
  - RealityKit unter macOS 27 (CHAOS-201) legt gehäutete Teile (Socke, Bündchen, Kaktus) als Modelle mit dem Teilnamen in die `ModelComponent` der Skelett-Entität (`sigi`, `kalle`); unter dem Teilnamen stehen dann nur leere Entitäten. Findet die Prüfung unter einem Teil keine Geometrie, nimmt sie die gleichnamigen Modelle des nächsten Vorfahren. Ohne diese Suche meldete sie „ohne Geometrie“.
- **Optik:** nur am Mac mit Augen, siehe [Gerätecheckliste](device-test-checklist.md), Abschnitt „USDZ-Assets“.

## Bekannte Grenzen

- **Skin-Modifier-Enden (CHAOS-161):** Skin-Modifier plus Subdivision runden ein Körperende etwa um den Knotenradius ab. Wer ein Teil auf ein Ende setzt (Bündchen, Blüte, Hut), braucht einen Knoten, der bis ins Teil reicht, oder muss das Teil auf die Kuppel absenken; die Auflage-Prüfung meldet es sonst. Rippen und andere Wellen um eine Achse brauchen eine Wellenzahl, die zu den Punkten rundum passt (16 bei Subdivision 2), sonst knittert die Fläche.

- **Nahbilder ohne Mac (CHAOS-162):** `packages/assets/blender/nahbild.py <id> <ziel.png>` rendert eine Figur in Cycles aus drei Blickwinkeln (Dreiviertel, Profil, von oben). Die Babylon-Vitrine zeigt eine Figur aus der Nähe mit `preview.html?nah=<Slot 1–4>`. RealityKit-Nahbilder (`--nah`) gibt es weiter nur am Mac.
- **Farbatlas packen (CHAOS-162):** Smart UV Project allein legte bei fein unterteilten Figuren Inseln übereinander (Knopffarbe auf der Sockenspitze). `bake_vertex_colors` packt die Inseln danach neu (`pack_islands`, ohne Überlappung).

- **Feinstruktur und Nähte (CHAOS-172):** Die Würfelprojektion der UV-Map `struktur` trennt Punkte an den Nähten. Die Hysterese (`STICKY` in `struktur.py`) hält das bei +17 % (Socke) bis +53 % (Schraubi, gefaste Kästen) Eckpunkten. Ob RealityKit die zweite UV-Map liest, ist nur am Mac prüfbar (Gerätecheckliste §35). Falls nicht: Normalen auf `st` in eine Atlas-Textur backen (EXP-032).
- Im **Babylon-Host** fehlten Sheen, Clearcoat und Leuchtstärke der Figuren bis CHAOS-207 (keine glTF-Materialerweiterung registriert, EXP-032 Nebenbefund). Seit CHAOS-207 lädt `apps/host/src/characters/index.ts` `KHR_materials_sheen`, `KHR_materials_clearcoat` und `KHR_materials_emissive_strength`; sie wirken mit `keepPbr` (Brett, Minispiele, Podest). Die Vitrine zeigt das mit `preview.html?pbr=1`, Vorher-nachher-Bilder unter `docs/screenshots/chaos207-*.jpg`. Sheen bleibt ein Unterschied zu RealityKit (siehe oben).

- **Farbatlas backen (CHAOS-221):** Der Diffus-Farbpass von Cycles ist Grundfarbe × (1 − Metallic) × (1 − Transmission) × Alpha. `bake_vertex_colors` stellt Metallic, Transmission und Alpha fürs Backen neutral, sonst kamen Metall-Requisiten fast schwarz und Glas abgedunkelt in die Textur (betraf auch Schraubis Messing, dessen Atlas jetzt etwas heller ist). Blender backt Teil für Teil und füllt den Bake-Rand auch über Inseln anderer Teile; der Rand muss kleiner als der Inselabstand sein. Requisiten: 256², Inselabstand 0,02 (≈ 5 px), Rand 2 px, Packen mit `AABB` (das `CONCAVE`-Packen der Figuren brauchte beim Toaster 60 s). Mit 16 px Rand färbte die Lackfarbe Metall rot (Milchkanne). Vergleich USDZ ↔ GLB: `docs/screenshots/chaos221-requisiten-usdz.jpg` (USDZ in Blender importiert und mit Cycles gerendert, gleiche Szene wie `chaos88-requisiten.jpg`), nicht RealityKit.
- **Bake-Rand der Figuren (CHAOS-234):** Auch bei den Figuren (1024², Inselabstand 0,008 ≈ 8 px) war der Rand mit 16 px zu groß. `packages/assets/blender/atlas_rand.py <figur|all>` wickelt einmal ab, backt mit Rand 0 (Sollwert, Abdeckung aus dem Alphakanal), mit Rand 0 als Gegenprobe und mit den gewählten Rändern, und zählt die Pixel innerhalb der Inseln, die vom Sollwert abweichen. Zwei Läufe (2026-11-21), Rand 16 px: Roboter 1 960 / 1 675 px (≈ 0,45 % der Inseln), Kaktus 381 / 436 px, Waschbär 97 / 108 px, Socke 4 / 4 px; Rand 8, 4 und 2 px: überall 0, Gegenprobe 0. Sichtbar war das als Farbstreifen an Teilkanten, am deutlichsten am Roboter (gelber Strich auf dem Ring des Drehknopfs, dunkle Kante am Bedienfeld): `docs/screenshots/chaos234-robot-vorher-nachher.jpg` (Rand 16 | Rand 4 | Abweichung rot), `chaos234-robot-bedienfeld.jpg` (vergrößert), `chaos234-robot-atlas-rand16.jpg` (Atlas, betroffene Pixel rot). Seither gilt: Rand höchstens der halbe Inselabstand (Figuren `ATLAS_BAKE_MARGIN` = 4 px, Requisiten 2 px bei ≈ 5 px); die 4 px reichen weiter als Schutz gegen Mipmap-Säume. Nahbilder mit dem Atlas statt der Vertexfarben: `nahbild.py <figur> <ziel.png> --atlas[=<rand>]`.
- **Glas-Deckkraft (CHAOS-221):** Blenders USD-Export (5.3) schreibt `opacity` immer als 1, egal wie das Alpha der Principled BSDF gesetzt ist. `props.py --usdz` trägt die Deckkraft danach mit usd-core nach (`packages/assets/usd/set_opacity.py`, eigener Prozess). Die Figuren haben kein durchscheinendes Material.
- **Nicht bitgleich:** Zwei Läufe erzeugen gleichwertige, aber nicht bitgleiche Dateien. Blender packt die UV-Inseln über mehrere Objekte nicht immer gleich, und die Reihenfolge der Prims im USD schwankt. Das galt schon für die GLB-Figuren. Prims, Materialien, Clips und Anker sind gleich; die Prüfungen laufen auf den Inhalt.
- Die Kulisse ist eine Momentaufnahme: Beispiel-Spielstand, Tageslicht-Stimmung, ohne Wasseranimation, Laternen, Glühwürmchen, Lichtstimmungen und Nachbearbeitung (SSAO, Tiefenschärfe). Der native Host zeigt die Kulisse so (CHAOS-142); Lichtstimmungen und Effekte folgen mit CHAOS-148.
- Himmelskuppeln und Dunst (`himmel_*`, `dunst`) sind im USDZ spiegelnde Kugeln; der Host blendet sie aus (wie der Spike).
- Größe: `brett.usdz` ≈ 25 MB je Brett (Budget 32 MiB im Manifest), dazu ≈ 15 MB Instanzen; jedes weitere Brett verlängert den Export um ≈ 3–10 min.
