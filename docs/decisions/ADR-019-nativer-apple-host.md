# ADR-019: Nativer Apple-Host mit RealityKit, Apple TV hostet allein, Babylon bleibt am PC

**Status:** Angenommen (Ruben, 2026-11-17: „ja dann go“ auf W2, Browser-Controller ausliefern; Meilenstein offen). Überprüfung nach dem Spike „Apple TV hostet allein“.
**Datum:** 2026-11-17
**Aufgabe:** CHAOS-135; Folge für CHAOS-74 (Apple TV), CHAOS-118 (Mac-App), CHAOS-114 (4K-Leistung)
**Betroffene Annahmen:** ADR-001 (Stack), ADR-004 (Host-Szene), ADR-005 (Session-Server), ADR-012 (Minispiel-Logik im Host), ADR-016 (Renderer)

## Kontext

Bisher läuft das Spiel nur auf einem PC. Session-Server (Node) und Host (Babylon.js im Browser) laufen dort zusammen, iPhones und iPads sind Controller. ADR-016 lässt Babylon am PC und hat die Apple TV als eigene Produktfrage abgetrennt.

Rubens Entscheidungen am 2026-11-17 (Chat):

- **„Ja, Apple TV als Host“**: Die Apple TV darf Spiel-Host sein. Damit wird die Säule „PC-only game hosting“ erweitert.
- **„Nativer Host (RealityKit)“**: Die Mac-App wird ein eigener nativer Host, keine Hülle um den Web-Host. Den nativen Host gibt es für tvOS ohnehin, der Mac bekommt ihn fast umsonst dazu.
- **„ja passt“**: Am Mac bleibt der Browser-Host Rückfall, bis der native Host alles kann; Spielregeln und Server bleiben TypeScript.
- **„AppleTV muss HOST sein können“**: Die Apple TV muss allein hosten können, **ohne Rechner im LAN**. Das verwirft die Server-Variante 1 aus ADR-016 als einzigen Weg.

iPhones und iPads bleiben ausschließlich Controller.

### Gemessen

**Rendern:**

| Gerät | Renderer | Ergebnis | Quelle |
|---|---|---|---|
| Mac (M3 Max), 1080p | Babylon WebGL2 (Spiel) | 8,4 / 11,2 ms (Median / p95) | EXP-015, R7 |
| Mac (M3 Max), 1080p | RealityKit, Testszene | 60 fps am VSync-Deckel, GPU 6,3 ms | EXP-017, R13 |
| iPhone 16 Pro, 2622×1206 | RealityKit, Testszene | 60 fps stabil | EXP-017, R15 |
| Apple TV 4K (A15), 4K-Ausgabe | RealityKit, Testszene | **20 fps**, GPU 34,7 ms, pixelgebunden | EXP-017, R12 |

Für die Apple TV gibt es einen Spike, der intern kleiner rendert und auf 4K hochskaliert (PR #27, CHAOS-114). Gemessen ist er noch nicht.

**Allein hosten auf der echten Apple TV 4K** (A15, tvOS 27; Probe-App [`spikes/apple-host-probe`](../../spikes/apple-host-probe/README.md) am 17.11.):

| Prüfung | Ergebnis |
|---|---|
| `WebAssembly` in JavaScriptCore (ohne WebKit) | vorhanden; kleines Modul: 5 Mio. Aufrufe in 0,5 s |
| Havok (`HavokPhysics.wasm`, 2,1 MB) | übersetzt in 16 ms; Start über `instantiateWasm` (synchron) in 21 ms. Ein Schritt mit 40 dynamischen Körpern dauert **0,77 ms** (Budget je Bild: 16,7 ms). Nötig sind ein Polyfill für `performance.now()` und eine synchrone Instanziierung; die asynchrone Emscripten-Instanziierung kehrt in JavaScriptCore nicht zurück. |
| game-core (gebündelt mit esbuild, 63 KB) | 20 komplette Bot-Partien (4 Spieler, 10 Runden, 800 Züge) in **77 ms** |
| `NWListener` mit WebSocket-Protokoll (Network.framework) | lauscht auf einem Port, Status `ready` |

**Minispiele headless auf dem Mac** (M3 Max, `runMinigameHeadless`, 4 Zufalls-Bots): 0,016–0,057 ms je 1/60-Schritt für alle vier Minispiele der Rotation.

## Vergleich der Wege

Gesucht ist ein Weg, auf dem die Apple TV allein hostet, der Mac dasselbe kann und der PC unverändert bleibt.

| | **W1: Alles in Swift** | **W2: TypeScript-Kern eingebettet (JavaScriptCore)** | **W3: Server auf Rechner im LAN** |
|---|---|---|---|
| Apple TV allein | ja | ja | **nein** (verwirft Rubens Vorgabe) |
| Spielregeln (game-core) | **zweimal**: TS am PC, Swift auf Apple-Geräten; jede Regel- und Balanceänderung doppelt | **einmal**: dieselbe TS-Datei läuft am PC (Node) und in der App (JavaScriptCore). Gemessen: 800 Züge in 77 ms. | einmal (Node) |
| Session-Server, Protokoll | in Swift neu | TS-Server in JavaScriptCore; Swift stellt nur Socket und Port bereit (`NWListener`) | unverändert |
| Minispiel-Logik und Physik | **zweimal**, RealityKit-Physik statt Havok: dasselbe Minispiel spielt sich anders; die Balance-Daten (EXP-005 … EXP-020) gelten nicht mehr | **einmal**: dieselben TS-Module mit Havok im festen 1/60-Takt in JavaScriptCore. Gemessen: Havok 0,77 ms je Schritt mit 40 Körpern. Der Host rechnet weiter selbst, wie in ADR-012 §1, nur in der App statt im Browser. | im Server (würde ADR-012 umkehren) oder in Swift |
| Darstellung | RealityKit | RealityKit: Brett, Regie, Minispiel-Darstellung und Podest **neu**, egal welcher Weg | RealityKit |
| Controller | Browser-Seiten bräuchten einen HTTP-Server in Swift | die native Controller-App (ADR-017) verbindet sich per WebSocket. Für Browser-Controller liefert die App die gebauten Seiten über einen kleinen HTTP-Teil im selben `NWListener` aus. | unverändert |
| Aufwand | sehr groß und wächst mit jedem Minispiel und jeder Regel | groß, aber einmalig: Brücke Swift ↔ JavaScriptCore, Darstellung | mittel |
| Größte Risiken | dauerhafte Abweichung zwischen PC und Apple TV | Ob Babylons `NullEngine` als Szene der Minispiele in JavaScriptCore läuft, ist **ungeprüft**. Ebenfalls offen: Speicher, Laufzeit über eine ganze Partie, App-Store-Regeln für einen Server in der App (für TestFlight unkritisch). | Apple TV nie allein |

**Empfehlung: W2.** Er erfüllt Rubens Vorgabe und hält Regeln, Server und Minispiel-Physik als eine einzige TypeScript-Wahrheit für PC, Mac und Apple TV. Neu ist nur, was zu Apple-Geräten gehört: Darstellung in RealityKit und die dünne Brücke für Netz und JavaScript-Laufzeit.

## Entscheidung (Vorschlag)

1. **Ein nativer Host für Mac und Apple TV.** Eine SwiftUI-App mit RealityKit, ein Code für macOS und tvOS (26+). Am PC (Windows) bleibt Babylon. **Am Mac bleibt der Browser-Host die Rückfallebene**, bis der native Host alles kann.
2. **Die App hostet allein (W2).**
   - Session-Server und game-core laufen als gebündeltes TypeScript in JavaScriptCore in der App.
   - Swift stellt Netzwerk (`NWListener`: WebSocket für Controller, HTTP für die Controller-Seiten), Zeitgeber und Speicher bereit.
   - Derselbe Code läuft am PC weiter in Node. Der Server bekommt dafür eine Transportschicht mit zwei Umsetzungen, `ws` in Node und die Brücke in der App.
3. **Minispiele:** Die bestehenden TS-Module laufen headless in JavaScriptCore der App, mit Havok und festem 1/60-Takt. Das ist derselbe Weg wie `runMinigameHeadless`, also ohne Umkehr von ADR-012. RealityKit stellt den Zustand dar; je Minispiel gibt es dafür eine Darstellungsschicht in Swift.
4. **Optional:** Die Apple TV kann sich trotzdem mit einem Server auf PC oder Mac verbinden (Rolle Host, wie heute der Browser-Host). Das ist praktisch zum Entwickeln, aber nicht Pflicht.
5. **Assets:**
   - **Figuren** kommen als USDZ direkt aus den bpy-Skripten (ADR-013). Der Umweg GLB→USDZ verliert Rauheit, Clearcoat und Leuchten (EXP-017).
   - **Kulisse des Bretts:** Der Babylon-Export (`scripts/spike-export-board.mjs`) wird ein Build-Schritt mit USDZ als Artefakt. Feldkoordinaten und Wege kommen aus game-core.
   - *Umgesetzt (CHAOS-140, EXP-026):* `pnpm build:apple-assets` erzeugt beides. Die Vertexfarben der Figuren werden dafür in eine Farbtextur gebacken. Die Kulisse hat Feld-Anker `feld_<id>`. Herkunft und Lizenzen stehen im Manifest unter `builds`. Siehe [`docs/apple-assets.md`](../apple-assets.md).
6. **Protokoll-Vertrag:**
   - Die Swift-Seite der Brücke und die Darstellung bekommen Beispielnachrichten wie die Controller-App (ADR-017, `scripts/export-protocol-fixtures.mjs`), erweitert um die Host-Rolle.
   - Das gebündelte TypeScript wird in der CI gebaut und gegen dieselben Tests geprüft.
7. **CI und Verteilung:**
   - **CI:** Der Job „Native Apps“ baut den Host für macOS und tvOS.
   - **Mac-App:** Developer-ID-Signatur, Notarisierung und GitHub-Release wie in lichtung (CHAOS-118). JavaScriptCore läuft ohne JIT-Berechtigung, ein eingebautes Node ist nicht nötig.
   - **Apple-TV-App:** über TestFlight (CHAOS-119).

## Betrachtete Alternativen

| Alternative | Warum nicht |
|---|---|
| W1: Alles in Swift | Regeln und Minispiel-Physik zweimal, dazu eine andere Physik-Engine. Das führt zu dauerhafter Abweichung zwischen PC und Apple TV und zu doppelter Arbeit bei jeder Änderung. |
| W3: Server nur auf Rechner im LAN | Erfüllt „AppleTV muss HOST sein können“ nicht. Bleibt als optionaler Modus (Entscheidung 4). |
| Mac-App als Hülle um den Browser-Host | Ruben hat sich für den nativen Host entschieden. Die Hülle bleibt als Rückfall (Entscheidung 1). |
| Node in der Mac-App einbetten | Unnötig, weil JavaScriptCore auf macOS und tvOS denselben Kern trägt. Node bräuchte unter der Hardened Runtime eine JIT-Berechtigung und würde das Bundle vergrößern. |
| Babylon Native, Unity, Godot, Bevy | ADR-016: kein tvOS (Babylon Native, Godot, Bevy) bzw. Editor-zentriert und Lizenzfragen (Unity). |

## Konsequenzen

**Positiv**

- Die Apple TV hostet allein, der Mac ebenso. Der PC ändert sich nicht.
- Eine Wahrheit für Regeln, Server und Minispiel-Physik: Balance-Messungen und Tests gelten überall.
- Der Mac wird die schnelle Entwicklungs- und Testplattform für den tvOS-Host.

**Negativ / Risiken**

- **Zwei Renderer dauerhaft:** Babylon am PC, RealityKit auf Apple-Geräten. Jede Darstellung (Brett-Effekte, Minispiele, Podest) entsteht zweimal.
- **4K auf der Apple TV:** 20 fps ohne hochskalierten Pfad (CHAOS-114). Größtes technisches Risiko.
- **Babylon-`NullEngine` in JavaScriptCore ungeprüft.** Die Minispiel-Module brauchen eine Babylon-Szene. Läuft sie nicht, müssen die Module von Babylon entkoppelt werden; die Logik bleibt TypeScript.
- **JavaScriptCore ohne JIT:** Gemessen reicht die Leistung für game-core und Havok. Ob sie bei einer ganzen Partie mit Minispielen und Rendering gleichzeitig reicht, ist offen.
- **Neuer Code für den Server:** eine Transportschicht (Node-`ws` oder Brücke) und ein kleiner HTTP-Teil in Swift für die Controller-Seiten.
- Regie, Kamerafahrten, Laufanimation, Popups, HUD, Lobby mit QR und Podest werden für den nativen Host neu geschrieben.

## Offene Fragen an Ruben

1. **W2 so freigeben?** Die Apple TV hostet allein mit eingebettetem TypeScript-Kern. Zuerst kommt der Spike unten.
2. **Browser-Controller auf der Apple TV:** Soll die App die Controller-Seiten ausliefern, damit Gäste ohne App per QR beitreten können? Oder reicht die native Controller-App? Vorschlag: ausliefern, damit niemand eine App braucht.
3. **Meilenstein:** Kommt der native Host in einen neuen Meilenstein M5, oder bleibt er im Backlog (CHAOS-44)?

## Folgeaufgaben (Vorschlag, Reihenfolge)

1. **4K auf der Apple TV** (CHAOS-114, PR #27): den hochskalierten Pfad messen. Ziel: mindestens 30 fps stabil, besser 60.
2. **Spike „Apple TV hostet allein“:**
   - Server und game-core gebündelt in JavaScriptCore
   - Brücke über `NWListener`
   - die native Controller-App und ein Browser-Controller treten bei
   - Brett-Zug sichtbar in RealityKit
   - ein Minispiel (`pudding-gerangel`, wegen Havok) headless in JavaScriptCore, dargestellt in RealityKit
   - messen: Eingabe → Bild, Bildrate, Speicher, Laufzeit einer Partie
3. **Transportschicht im Server** (Node-`ws` oder Brücke), mit Tests am PC.
4. **Brett im nativen Host:**
   - USDZ als Build-Schritt
   - Figuren als USDZ direkt aus bpy
   - Regie, Laufanimation, HUD, Lobby mit QR
5. **Darstellung der Minispiele** im nativen Host.
6. **Finale/Podest, Pause, Wiederverbindung.**
7. **Verteilung:** Mac-App mit Notarisierung (CHAOS-118) und tvOS über TestFlight (CHAOS-119).

## Überprüfung

- **Nach dem Spike (Schritt 2):** Läuft die Babylon-`NullEngine` nicht in JavaScriptCore oder reicht die Leistung nicht, die Entkopplung der Minispiele von Babylon prüfen, bevor W1 in Frage kommt.
- **Wenn der hochskalierte Pfad 30 fps bei 4K nicht erreicht:** Grafikstufe oder Szene für die Apple TV anpassen.
- **Wenn Babylon Native, Bevy oder Godot tvOS offiziell unterstützen:** einen gemeinsamen Renderer mit dem PC prüfen.

## Nachtrag 1 (2026-11-17, CHAOS-139): Spike im Produktcode

- **Ort:** Der Spike `spikes/apple-host` ist jetzt das Workspace-Paket [`apps/apple-host`](../../apps/apple-host/README.md) (`@chaos-party/apple-host`): JS-Kern in `src/`, Swift-App in `app/` (ein Ziel für macOS und tvOS, `dev.rubeen.chaosparty.host`), Harness in `harness/`. `pnpm build` erzeugt `dist/chaos-host.js` und `dist/HavokPhysics.wasm` samt Lizenzhinweisen (ADR-018).
- **Schritt 3 (Transportschicht) entfällt:** `Session` war schon transportunabhängig (`ConnectionId`/`Outgoing`, `ws`-Adapter in `apps/server/src/socket.ts`). Einzige Änderung am Server: `DEFAULT_TICK_MS` liegt jetzt in `session.ts`, damit das Bündel `socket.ts` (und damit `ws`) nicht braucht.
- **§6 Beispielnachrichten:** Die Host-Rolle läuft im JS-Kern selbst; Swift reicht das Controller-Protokoll nur durch. Der Vertrag, den Swift versteht, ist deshalb `renderState` (plus `HostEnv`/`ChaosHostInstance`). Er steht als zod-Schema in `apps/apple-host/src/contract.ts`; Beispiele je Phase erzeugt `scripts/export-apple-host-fixtures.mjs`, der Swift-Harness dekodiert sie mit dem `RenderState` der App.
- **§7 CI:** Der Linux-Job prüft das Bündel in einem nackten `node:vm`-Kontext (Unit-Test bis zum ersten Minispiel, `bots --full` mit ganzer Partie) und dessen Größe (`pnpm check:bundle`). Der Job „Native Apps“ spielt die ganze Partie im Swift-Harness in JavaScriptCore (`JSC_useJIT=false`) und baut die App für macOS und tvOS.
- **Noch nicht übernommen:** der hochskalierte 4K-Pfad (CHAOS-114) und die Render-Schleife des RealityKit-Spikes. Die App zeichnet weiter Grundkörper über die `ARView`; beides kommt mit der echten Grafik (CHAOS-142, CHAOS-148).

## Nachtrag 2 (2026-11-17): Eine Variante, alle Minispiele auf jedem Host

Ruben (Chat, CHAOS-137): „ich habe nur DIE EINE Variante, deshalb alle Minispiele in allen Versionen verfügbar“.

- Es gibt **keine abgespeckte Apple-Variante**. Eine Rotation je Host oder eine erste Version mit weniger Minispielen ist verworfen. Am PC, auf dem Mac und auf der Apple TV laufen dieselben Minispiele.
- **Folge für Entscheidung 3:** Eine eigene Swift-Darstellung je Minispiel skaliert nicht auf den geplanten Katalog (CHAOS-80, ~200 Spiele). Die Darstellung im nativen Host läuft deshalb über die **Rollen-Kennzeichnung** (`markVisual`/`visualOf` aus `packages/minigame-sdk`, CHAOS-149). Swift hält eine Bibliothek von Darstellungen je Rolle, die Minispiele derselben Familie teilen. Eigener Swift-Code je Minispiel nur, wo eine Rolle nicht reicht.
- **Folge für die Minispiel-Fabrik:** Ein Minispiel ist erst fertig, wenn es auch im Apple-Host mit echter Grafik läuft (Definition of Done je Minispiel, [`docs/minigames/README.md` §5.3](../minigames/README.md)).
- Der Nachweis bleibt der Gesamtlauf mit allen Minispielen der Rotation (CHAOS-146).

## Nachtrag 3 (2026-11-17, CHAOS-118): Mac-App signiert und notarisiert

- **Skript und Workflow:** `apps/apple-host/scripts/release-macos.sh` baut, signiert (Developer ID, Hardened Runtime, Zeitstempel, ohne `get-task-allow`), notarisiert (`notarytool` mit dem API-Key der TestFlight-Workflows), heftet und packt. `.github/workflows/release-macos.yml` legt bei jedem Push auf `main`, der App, Server, Host-Rolle, Controller oder `packages/` ändert, einen GitHub-Release `macos-v<Version>` an (Vorabversion, solange Grundkörper).
- **Kein semantic-release** (Abweichung von der Aufgabe, die lichtung als Vorlage nennt): Die Commits hier folgen nicht Conventional Commits, semantic-release würde nie eine Version erzeugen. Version ist `MARKETING_VERSION` aus `project.yml` plus Laufnummer des Workflows; eine neue Hauptversion setzt man in `project.yml`. Überholt durch Nachtrag 4: Ruben wollte die Version automatisch.
- **Ohne JIT-Berechtigung:** Die App bekommt keine Entitlements. Dass JavaScriptCore samt WebAssembly (Havok) unter der Hardened Runtime trotzdem läuft, belegt der Selbsttest `ChaosHost --selftest` in der CI bei jedem PR (ad hoc signiert, sonst wie das Release). Scheitert er eines Tages daran, ist `com.apple.security.cs.allow-jit` die Abhilfe; sie ist mit der Notarisierung vereinbar.
- **Universal-Binary** (arm64 + x86_64), weil macOS 26 noch Intel-Macs unterstützt.
- **Kein Sparkle-Feed:** Aktualisieren heißt vorerst, den neuen Zip vom Release zu laden (Backlog-Idee). Überholt durch Nachtrag 4.

## Nachtrag 4 (2026-11-18, CHAOS-156): Automatische Updates der Mac-App mit Sparkle

- **Sparkle 2.10.1** (MIT) als Swift Package, nur im macOS-Ziel (`destinationFilters: [macOS]`); tvOS bekommt Updates weiter über TestFlight. Menüpunkt „Nach Updates suchen …“ im App-Menü, sonst prüft Sparkle täglich von selbst.
- **Feed an fester Adresse:** `appcast.xml` liegt als Asset am Release `macos-appcast` (Vorabversion, wird bei jedem Lauf ersetzt): `…/releases/download/macos-appcast/appcast.xml`. Kein GitHub Pages, keine zweite Stelle. Der Feed enthält nur das neueste Release; Sparkle braucht nicht mehr. Der Release `macos-appcast` darf nicht gelöscht werden.
- **Versionen:** Sparkle vergleicht `CFBundleVersion`, und die ist die Laufnummer des Workflows (steigt immer). Lokale Builds tragen einen Zeitstempel als Build-Nummer und sehen darum keine Updates.
- **semantic-release (Ruben, 18.11.: „möchte das eig automatisch haben“):** Ab jetzt folgen alle Commits Conventional Commits (Regel in `CLAUDE.md`, CI-Job „Commit-Nachrichten“ mit commitlint; Betreff bleibt deutsch, darum ohne Groß-/Kleinschreibungsregel). Der Workflow fragt semantic-release zuerst im Probelauf unter Linux nach der nächsten Version (`apps/apple-host/scripts/next-version.mjs`, `release.config.mjs`); nur wenn ein `feat`, `fix` oder `perf` seit dem letzten `macos-v…` kam, baut er am Mac, notarisiert und legt danach selbst Tag und Release an, mit den Notizen von semantic-release. So entsteht nie ein Tag ohne fertige App, und der Probelauf kostet keine macOS-Minuten. Die bisherigen Tags `macos-v0.1.1` … `macos-v0.1.5` sind der Ausgangspunkt; der erste `feat` ergibt `0.2.0`. Alte Commits ohne Schema zählen nicht.
- **Zwei Signaturen:** EdDSA für Zip und Feed (`SURequireSignedFeed`, `SUVerifyUpdateBeforeExtraction`) und Developer ID für die App. Der Workflow prüft die Zip-Signatur gegen genau den öffentlichen Schlüssel, der in der App steht (`scripts/appcast.mjs`); ein Schlüsselpaar, das nicht zusammenpasst, bricht den Lauf ab, bevor ein Feed erscheint.
- **Schlüssel außerhalb des Repos:** öffentlicher Schlüssel als Repository-Variable `SPARKLE_PUBLIC_ED_KEY` (kommt beim Bau als `SUPublicEDKey` ins Info.plist), privater als Secret `SPARKLE_ED_PRIVATE_KEY`. Fehlen beide, baut der Workflow das Release ohne Updater und warnt; fehlt nur der private, bricht er ab.
- **Sparkle neu signiert:** Xcode signiert beim Kopieren nur die Hülle des Frameworks. `release-macos.sh` signiert XPC-Dienste, `Autoupdate`, `Updater.app`, das Framework und danach die App mit Developer ID und Hardened Runtime nach. Der Selbsttest prüft, dass Sparkle lädt.

## Nachtrag 5 (2026-11-19, CHAOS-143 … CHAOS-146): Darstellung im nativen Host, Gesamtlauf

- **Regie und Texte bleiben TypeScript (CHAOS-143, CHAOS-145):** Der Brett-Regisseur (`apps/host/src/board/director.ts`), die Lichtstimmung je Runde (`LIGHT_MOODS`), der Finale-Ablauf (`finalePlan.ts`) und die Pause laufen unverändert im JS-Kern. `renderState` liefert Swift das fertige Bild: Figurenlage samt Sprung und Flug, Popups, HUD, Kamera-Ziel, Licht, Klang-Rezepte, Podest. Swift baut keine Regie nach. Das löst den Punkt „Regie, Laufanimation, Popups und HUD entstehen neu“ aus den Konsequenzen.
- **Minispiele: Geometrie-Export statt Rollen-Bibliothek (CHAOS-144). Abweichung von Nachtrag 2:** Der JS-Kern schickt die Geometrie der echten Babylon-Meshes einmal je Minispiel an Swift, dedupliziert und in Stücken mit 2 ms Budget. Swift baut daraus RealityKit-Meshes und setzt nur noch Lage und Material je Bild. Damit läuft **jedes** Minispiel ohne Swift-Code so wie am PC, auch künftige aus der Minispiel-Fabrik. Das trägt Rubens Vorgabe „alle Minispiele in allen Versionen“ besser als eine Swift-Darstellung je Rolle. Die Rollen aus `markVisual` bleiben in jedem Körper und dienen als Haken: Wo eine Rolle eine eigene Swift-Darstellung braucht (Figuren als USDZ, Effekte), nimmt Swift sie. Definition of Done je Minispiel (`docs/minigames/README.md` §5.3) bleibt: Ein neues Minispiel muss im Apple-Host sichtbar laufen; eigener Swift-Code ist dafür im Regelfall nicht nötig.
- **Klänge (CHAOS-143, CHAOS-190):** Die Klang-Rezepte aus `apps/host/src/fx/sounds.ts` gehen als Daten an Swift und werden mit AVAudioEngine synthetisiert. Es gibt keine Tondateien und damit keine Lizenzfragen. *(Überholt durch Nachtrag 6: echte Aufnahmen, Rezepte nur noch als Rückfall.)*
- **Überprüfung „hochskalierter Pfad, 30 fps bei 4K“:** Im tvOS-Simulator (Apple TV 4K, 4K-Ausgabe) lief die ganze Partie mit 4 Bots in allen Phasen im Median bei 58–59 fps, mindestens 50,7 fps (EXP-031). Der Simulator rendert aber auf der GPU des Macs, und JavaScriptCore hat dort JIT. **Auf der echten Apple TV ist der Gesamtlauf noch offen** (Gerätecheckliste §34, Ruben). Die Überprüfung bleibt deshalb offen, bis GL11 gemessen ist.
- **Gefunden:** RealityKit 27 legt gehäutete Meshes an die Skelett-Entität statt unter den Teilnamen (CHAOS-201; nur die Prüfung war betroffen). Ist der Mac-Host verdeckt oder das Display dunkel, drosselt macOS die App, und Minispiel-Ergebnisse kommen zu spät (CHAOS-203). Lokale Mac-Builds brauchen unter macOS 27 `disable-library-validation` (CHAOS-176, nur ad hoc signiert, nie im Release).

## Nachtrag 6 (2026-11-20, CHAOS-223): Echte Klänge statt Synthese

Ruben nach einer Partie auf der Apple TV: „Wir brauchen dringend VIEL BESSERE Töne. Das ist ja grauenhaft so.“ Die prozeduralen Rezepte klangen nach Piepsen, nicht nach Cartoon-Partyspiel (VISION Säule 5).

- **Entscheidung:** Beide Hosts spielen echte Aufnahmen. Quellen nur **CC0** (Ruben: „CC0 wäre perfekt, kannst du aber selbst dich drum kümmern“): Kenney-Audio-Pakete und einzelne freesound.org-Klänge, deren CC0-Lizenz das Importskript auf der Seite jedes Klangs prüft. Auswahl in `packages/assets/sounds.json`, Import mit `pnpm --filter @chaos-party/assets import:sounds` (ffmpeg): Stille ab, mono 44,1 kHz, gemeinsamer Effektivpegel, MP3 nach `packages/assets/sounds/`, Herkunft je Datei im Asset-Manifest. 40 Dateien, zusammen rund 310 KiB.
- **Eine Wahl für beide Hosts:** `apps/host/src/fx/samples.ts` wählt je Klang-Name Datei (Varianten reihum), Abspiel-Rate (Tonhöhe des Aufrufs samt kleiner Streuung aus einem Zufallsgenerator mit festem Startwert) und Lautstärke. Rein und ohne `import.meta`, damit der JS-Kern des Apple-Hosts es bündeln kann. Der Browser-Host spielt die Datei per WebAudio, der Apple-Host schickt die Wahl im `SoundCue` (`sample`, optional) an Swift. Swift dekodiert alle Dateien beim Start im Hintergrund (`SoundBank`) und spielt sie über Stimmen mit `AVAudioUnitVarispeed` (`SoundVoices`); ist keine Stimme frei, entfällt der Klang wie bisher.
- **Rezepte bleiben** als Rückfall, solange die Dateien laden oder wenn eine fehlt, und für ältere Kerne ohne `sample`. Der Vertrag bleibt rückwärtskompatibel.
- **Absicherung:** Tests prüfen, dass jeder Klang-Name Dateien hat, die im Repository liegen, und dass häufige Klänge kurz bleiben (≤ 0,3–0,6 s, damit Ausklänge keine Stimmen blockieren). `prepare.sh` legt die Dateien in die Nutzlast, die TestFlight-Skripte und `--selftest` prüfen, dass sie im Bündel liegen und dekodieren.
- **Offen:** Wie es klingt, entscheidet Rubens Ohr am Fernseher (EXP-035, Gerätecheckliste §44). Einen Klang tauschen kostet eine Zeile in `sounds.json` und einen Import.

