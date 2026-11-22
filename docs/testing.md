# Tests in Chaos Party

Stand: M2 (CHAOS-2, 2026-11-15); M1-Teile aus CHAOS-45; M4-Gesamtablauf aus CHAOS-41 (Abschnitt [M4-Gesamtablauf](#m4-gesamtablauf-chaos-41)). Dieses Dokument beschreibt, welche automatischen Tests es gibt, was sie beweisen, wie man sie startet und Screenshot-Baselines pflegt – und was **nicht** automatisch geprüft werden kann und deshalb in die Gerätecheckliste (`docs/device-test-checklist.md`) gehört.

## Überblick

| Suite | Werkzeug | Umfang (Stand M2) | Start |
|---|---|---|---|
| Unit- und Integrationstests | Vitest | 791 Tests in 62 Dateien (+1 nur mit `EXPERIMENTS=1`) | `pnpm test` |
| E2E (Browser) | Playwright 1.63, nur Chromium | 89 Tests in 11 Specs, 5 Projekte | `pnpm test:e2e` |
| Experimente (Simulation) | Vitest + `simulateGame` | 600 Partien je Variante, Seeds 1–200 | `EXPERIMENTS=1 pnpm exec vitest run packages/game-core/src/rules/experiments.test.ts --silent=false` |
| Statische Prüfungen | `tsc` strict, ESLint, Prettier, Lizenzprüfung | – | `pnpm check` (inkl. `pnpm test` und `pnpm build`) |

Vitest-Tests nach Paket:

- `packages/protocol` (176): Schemas, Parser für jede Nachricht (v2: `choose`, `board`, `prompt` im Kontext), ungültige/übergroße Eingaben, Phasen-/Aktionsregeln, Slot-Farben, `seq`-Wächter.
- `packages/game-core` (162, M2): jeder Übergang des Zustandsautomaten, ungültige Übergänge mit allen Fehlercodes, Würfel, Pfadwahl, Trophäe (passieren/landen/kaufen/wandern, mehrere aktiv), Münzen nie negativ, jedes Item, jedes Brett-Ereignis, Fallen (landen/darüberlaufen, eigen/fremd), Reaktionsfenster (Schild, Festhalten, Timeout, verspätete Wahl), Disconnect mitten im Zug, komplette Partien mit 2–4 Spielern, Determinismus je Seed, JSON-Festigkeit, Brett-Validierung (Wackelwald + je Regel ein kaputtes Brett), Simulation.
- `apps/server` (143): **Brettspiel über die Session** (`boardGame.integration.test.ts`, CHAOS-23: komplette Partien mit 2/3/4 Spielern und gemischt iPhone + iPad, gleicher Seed → gleicher Ablauf, Disconnect mitten im Zug mit Auto-Wahl und Rückkehr, Reaktionsfenster mit Festhalten/Timeout/verspäteter Wahl, Eingaben außer der Reihe, Host-Reload, Arena-Modus), Selbstprüfung von `localhost` (CHAOS-48), dazu wie in M1: Session als reine Zustandsmaschine (Beitritt, Slots, Start, Bereit, Reconnect-Politik, Herzschlag/Timeouts mit künstlicher Uhr, Rate-Limit), LAN-Adresswahl, Startausgabe, **Integration mit echten `ws`-Clients** gegen den HTTP/WebSocket-Server (`server.test.ts`, `socket.test.ts`): Auslieferung, Handshake, mehrere gleichzeitige Controller, kaputte Nachrichten, Abbruch und Wiederverbinden.
- `apps/controller` (184): Brettphase (Prompt → Knöpfe, Sperre nach dem Senden, Countdown, `choose` mit `seq`, Wahlknöpfe in iPad-Zonen), Joystick-Mathematik, Drosselung der `move`-Nachrichten, Touch-Zonen (Geometrie, Finger-Zuordnung, Zonen-Tracker), Client/Session mit Fake-Socket und Fake-Timern (Backoff, Wachhund, Token), Reducer, Fehlertexte.
- `apps/host` (100): Brett-Regie (Ereignisse abspielen, Lücken in `eventSeq`, Aufholen), Meldungstexte, Figur-Versatz, Demo-Stand, Start-Modus, Bewegung/Dash-Mathematik, Spawn-Punkte aus dem Seed, Tastatur- und Netzwerk-Eingabequelle, Host-Verbindung, Verbindungsmeldungen, Join-Link je Gerät (`joinLink.test.ts`).
- `packages/metrics` (CHAOS-45): Ringpuffer, Median/p95 (Nearest-Rank), Formatierung, User-Agent-Kurzform; dazu Messer in Controller (RTT) und Host (Bildabstand, Eingabe→Frame).

### Server-Integration M4: Reconnect, Host-Verlust, gemischte Aufstellung, Robustheit, Determinismus (CHAOS-37/38)

Alle Dateien unter `apps/server/src/`, über den Testhelfer `testHarness.ts` (künstliche Uhr im 100-ms-Takt, synthetische Controller-Bots und Host, jede Server-Nachricht mit dem echten Parser geprüft; keine echten Wartezeiten – alle Dateien zusammen laufen in wenigen Sekunden).

| Datei | Beweist | Seeds |
|---|---|---|
| `reconnect.integration.test.ts` | Trennung + Rückkehr in jeder Phase ohne Spielabbruch: je Prompt-Art (Würfeln, Weg, Ziel, Trophäe, Reaktion) Rückkehr **innerhalb** der Frist (gleicher Prompt, eigene Wahl zählt) und **nach** der Frist (Standardoption nach `disconnectGraceMs` bzw. Reaktionsfrist, Grund `disconnected`); Lobby mit Figur und Bereitschaft über die Schonfrist hinweg (danach Platz und Figur frei, `bad-token`); reservierter Spieler beim Start; Minispiel-Intro/-Spiel/-Ergebnis (Eingaben fließen nach Rückkehr); Spieler bleibt im Minispiel weg; Pause (Schonfrist zählt erst nach `resume`); Endstand und nach Revanche; iPad mit beiden Zonen; zweiter Tab ersetzt die alte Verbindung. Überall `assertContiguousEvents` und Partie bis `game-results`. | `INTEGRATION_SEEDS`; Seed **2** (3 Spieler, 3 Runden: alle Prompt-Arten; bis EXP-019 Seed 1) |
| `hostLoss.integration.test.ts` | Auto-Pause bei Host-Verlust (ADR-015 Nachtrag 1): Abriss beim Würfeln, zwischen zwei Takten mit fälligem Übergang (kein Ereignis verloren), eingefrorener Tab (Herzschlag-Timeout), mitten im Minispiel (kein Abbruch, Spielzeit steht, Restzeit gleich), Ergebnis nach Wiederverbinden angenommen und Doppeltes abgelehnt, manuelle Pause übersteht Reload, Endstand/Lobby ohne Pause, gleicher Ablauf mit und ohne Host-Verlust. CHAOS-68 (Nachtrag 3): Host lädt nach der Rückkehr noch → Pause bis `host-ready` (im Zug: Restzeit der automatischen Phase gleich; im Minispiel: `elapsedMs` gleich), Rückfall nach `hostReadyMs`, erneuter Abriss beim Laden, eigene Pause/„Weiter“ beim Laden, `host-ready` ohne Auto-Pause wirkungslos. | `INTEGRATION_SEEDS` |
| `mixedSetup.integration.test.ts` | 2 iPhones + iPad mit 2 Zonen, komplette Partie mit echten Minispielen: Figurenwahl je Zone (Konflikt zwischen den Zonen → `character-taken`), Bereit je Zone, gleichzeitige Eingaben aller vier Slots im selben Takt mit richtiger Slot-Zuordnung, Spoofing vom iPad, iPad-Reconnect mit beiden Zonen mitten im Minispiel; 60 Hz je Slot auf allen Geräten ohne Drosselung. | `INTEGRATION_SEEDS.four` |
| `robustness.test.ts` | Unpassende/kaputte v4-Nachrichten: `pick-character` im Brett, `pause`/`resume`/`end-game`/`rematch` in der Lobby, `rematch` im Spiel, doppelte Pause, `configure` mit ungültiger Rundenzahl (0, 21, 2.5, Text, fehlend, Zusatzfeld), unbekannte Figur, Spoofing fremder Slots, Host-Befehle von Controllern (→ 4008 nach 20), Controller-Nachrichten vom Host; Rate-Limit-Flut (eine Fehlermeldung je Sekunde, Close nach 5 s), flutender Host → getrennt + Auto-Pause. **Fuzz:** seeded Folge gültiger und ungültiger Nachrichten von 3 Verbindungen (iPad mit 2 Zonen) und Host über eine ganze Partie mit echten Minispielen, inkl. Müll, übergroßer Nachrichten, veralteter `seq`, zufälliger Trennungen, Rauswürfe, Reconnects, Host-Reloads und Pausen – keine Ausnahme, kein `internal`, lückenlose Ereignisse, Ende in `game-results`; gleicher Seed → gleicher Ablauf. | Fuzz-Seeds 1, 2, 3, 2026 (+ 7 für den Determinismus-Vergleich) |
| `boardAi.integration.test.ts` | Brett-KI im Live-Spiel (CHAOS-181): ganze Partie 1 Mensch + KI leicht/mittel/schwer, fester Seed → gleiche Ereignisse, gleicher Endstand, gleiche Dauer bei Wiederholung; KI würfelt und wählt selbst (nie per Zeitablauf), keine abgewiesene KI-Antwort; Denkpause nie unter der Mindestpause der Stärke; KI reagiert im Reaktionsfenster selbst oder verpasst es; „Nochmal spielen“ mit neuen KI-Strömen. Regeln der KI ohne Server: `packages/game-core/src/ai/*.test.ts` (Regressionsvergleich der Brett-Entscheidungen mit der Logik vor dem Umzug aus `simulate.ts`, gezielter Item-Einsatz, Stärke-Eckwerte, getrennte Ströme, Fallen meiden, verpasste Reaktionen). | `INTEGRATION_SEEDS`, Seeds 1–8 (Reaktionen) |
| `determinism.integration.test.ts` | Endstand-Schnappschuss (Ranking inkl. `decidedBy`, Figuren, Statistik, Ereigniszahl) für 2/3/4 Spieler, zweimal gleich; konstruierter Gleichstand (Würfel immer 0, keine Minispiel-Münzen), den die **Minispiel-Siege** entscheiden, mit geteiltem Platz 3 (`shared`); vollständiger Gleichstand per Ende direkt nach dem Start (alle Platz 1, `tied`). | `INTEGRATION_SEEDS` (2: 20261115, 3: 7, 4: 424242), Gleichstand: 99 |

Ändern sich Regeln oder Zufallsfolge, schlagen die Endstand-Schnappschüsse in `determinism.integration.test.ts` bewusst fehl: Werte prüfen, neu eintragen und hier erwähnen. Zuletzt neu eingetragen mit dem Trostpreis nach dem Minispiel (EXP-019, CHAOS-51, 2026-11-17): mehr Items im Umlauf, je eine Trophäe bei 2 und 3 Spielern.

### Gemeinsame Minispiel-Prüfungen (CHAOS-84)

Für jedes Minispiel ohne eigenen Testcode (Details: [`minigames/pruefungen.md`](minigames/pruefungen.md)):

- **Vertragstest** `packages/minigames/src/catalog.test.ts`: Steckbrief, 2/3/4 Spieler, gültiges Ergebnis (`checkResult`), Ende am Zeitlimit, Leerlauf, Dauerdrücken, Verbindungsabbruch, leere Szene nach `dispose()` (≈ 3 s für alle).
- **Bot-Fairness** `packages/minigames/src/checks/checks.test.ts`: feste Tische (4× Normal, Neuling bzw. Profi gegen 3× Normal, Eindringling gegen 2× Normal) mit festen Schwellen; CI-Stichprobe 0,3–9 s je Spiel. Voller Bericht: `PRUEFBERICHT=1 pnpm exec vitest run packages/minigames/src/checks --silent=false` → `docs/minigames/pruefbericht.md`.
- **Vielfalt** im selben Test: jedes Spiel der Rotation unterscheidet sich von jedem anderen in ≥ 3 von 7 Steckbrief-Merkmalen (Steckbriefe aus `packages/minigames/src/steckbriefe.ts`, Baukasten ADR-021).

## E2E-Aufbau

- **Ein Build, viele Server.** `tests/e2e/global-setup.ts` führt einmal `pnpm build` aus. Danach startet die Fixture `chaosServer` (`tests/e2e/fixtures/test.ts`) **für jeden Test** einen eigenen echten Server im Playwright-Prozess (`createChaosServer` aus `apps/server/src/server.ts`): Production-Builds wie bei `pnpm start` (Controller unter `/`, Host unter `/host/`, WebSocket unter `/ws`, ein Port), nur auf `127.0.0.1`, freier Port, fester Join-Code `E2ETEST`, Join-Link `http://127.0.0.1:<port>/?code=E2ETEST`. `baseURL` zeigt auf diesen Server. Kein Test sieht den Zustand eines anderen; die Reihenfolge ist egal, Tests laufen parallel (2 Worker).
- **Weitere Geräte.** Die Fixture `openDevice('PC' | 'iPhone 13' | 'iPhone 13 landscape' | 'iPad Pro 11 landscape')` öffnet eine Seite in einem eigenen Browser-Kontext (eigener Speicher, also eigenes Token – wie ein eigenes Gerät) mit Geräte-Emulation in Chromium und schließt ihn am Testende. Telefone und iPads laufen in einem eigenen Chromium je Worker **ohne GPU** (`--disable-gpu`, Fixture `deviceBrowser`), der PC im Browser des Projekts. Grund (CHAOS-64): Über den gemeinsamen Software-GPU-Pfad (SwiftShader) wartete der Compositor des Controllers, während der Host beim Spielstart Shader übersetzt. Der Hauptthread des Controllers stand dabei bis zu 13 s still, nach 10 s verband er neu und ließ den gehaltenen Joystick los.
- **Zwei Arten von Controller-Tests.** `controller-ui.spec.ts` und `ipad-zonen.spec.ts` laden den echten Controller-Build, fangen `/ws` aber per `routeWebSocket` ab und sprechen mit einem nachgebauten Session-Server (`fixtures/fakeSession.ts`, prüft jede Nachricht mit dem echten Protokoll-Parser) – so lassen sich Fehlerfälle und Layout-Wechsel gezielt erzeugen. `m1-durchstich.spec.ts` und `reconnect-slot.spec.ts` laufen **ohne** Nachbau gegen den echten Server.
- **Touch.** `fixtures/touch.ts` schickt echte Touch-Ereignisse per CDP (`Input.dispatchTouchEvent`), auch mehrere Finger gleichzeitig (`down`, `move`, `moveAll`, `lift`, `cancelAll`). Chromium erzeugt daraus Touch- und Pointer-Ereignisse wie auf dem Gerät.
- **Host-Testhaken.** `/host/?test=1` schaltet die Render-Schleife ab; die Physik läuft nur mit `window.__chaos.stepFrames(n)` (je 1/60 s; seit CHAOS-77 zeichnet die Arena nur das letzte der n Bilder). Dazu `getPlayerPositions()`, `networkInputs` (Zahl angewandter Controller-Eingaben) und `lastMoves` (letzter Stick je Slot, CHAOS-14). Damit sind Bewegungsprüfungen deterministisch, unabhängig von Rechnerlast.
- **Warten.** Nur ereignisgesteuert: DOM-Attribute (`data-layout`, `data-connected`, `data-active` …), `waitForHostStick` (`lastMoves`) und `networkInputs`. Feste Zeit vergeht nur in `stepFrames`. Bewegungen werden mit Toleranzen geprüft (Richtung, Mindestweg 1 m, Querversatz < 0,5 m, Stillstand < 5 cm; Annahme C4), nie mit exakten Positionen.
- **Fehler.** Jede Seite sammelt Konsolenfehler und unbehandelte Ausnahmen; die Tests erwarten beide leer (beim absichtlichen Offline-Schalten nur die erwarteten WebSocket-Meldungen ausgenommen).

### Playwright-Projekte

| Projekt | Specs | Emulation |
|---|---|---|
| `chromium` | `host-szene`, `host-lobby`, `reconnect-slot`, `m1-durchstich`, `debug-anzeige`, `host-brett`, `m2-brett-durchstich`, M3-/M4-Host-Specs, `m4-gesamtablauf` | Desktop 1280×720, WebGL über SwiftShader (Software) |
| `iphone-hoch`, `iphone-quer` | `controller-ui`, `controller-brett` | iPhone 13 hoch/quer |
| `ipad-quer`, `ipad-hoch` | `ipad-zonen`, `ipad-brett` | iPad Pro 11 quer/hoch |

Seit M2 öffnen die M1-Specs den Host mit `&arena=1` (Start der M1-Arena statt des Brettspiels). Alle E2E-Server nutzen den festen Brettspiel-Seed `E2E_GAME_SEED = 2026` (`fixtures/server.ts`).

### Specs und was sie beweisen

| Spec | Gegen | Beweist |
|---|---|---|
| `host-szene.spec.ts` (5) | lokaler Tastatur-Modus | Havok-WASM lädt vom Node-Server mit `application/wasm` (C1), Arena mit Figuren, Tastatur bewegt Spieler 1, Schubser-Impuls, vier Figuren, Screenshot der Startszene. |
| `host-lobby.spec.ts` (5) | echter Server, synthetische WebSocket-Controller | QR-Code/Join-Code/Link, Firewall-Hinweis nach Wartezeit, **Umschalter iPhone/iPad** (Link mit `seats=2`), „Andere Adresse“, zweites Host-Fenster wartet, Beitritt/Bereit/Start, `move` bewegt nur die eigene Figur, Schubser, Trennung sichtbar; Screenshot der Lobby. |
| `m1-durchstich.spec.ts` (3) | echter Server, **echte Host- und Controller-Seiten** | (1) Zwei iPhones öffnen den Link aus der Lobby, bekommen verschiedene Plätze/Farben (Handy und Host), tippen „Bereit!“, Host startet; beide ziehen **gleichzeitig** ihren Joystick (rechts/oben) → jede Figur läuft in ihre Richtung und nicht in die der anderen; Knopf A → Schubser nur bei Figur 2; Handy 1 verliert das Netz → Host „getrennt“, Handy-Overlay; wieder online → automatisch **derselbe Platz**, Joystick steuert wieder die eigene Figur. (2) Geteiltes iPad über den iPad-Link: zwei Zonen, zwei neue Spieler am Host, zwei Finger gleichzeitig (eine `touchMove`-Folge für beide) steuern zwei Figuren unabhängig; Joystick in Zone 1 + Knopf A in Zone 2 zugleich. (3) Gemischt: 1 iPhone + iPad(2) = drei Spieler (Slots 1–3) bewegen sich gleichzeitig unabhängig; Screenshot der Szene mit drei Figuren. |
| `reconnect-slot.spec.ts` (4) | echter Server, iPhone-/iPad-Seiten, Verbindung über `routeWebSocket` steuerbar | Abbruch → Overlay mit Versuchszähler → automatischer Reconnect auf denselben Platz, Host-Meldungen „verloren“/„wieder da“; Neuladen behält den Platz; zweiter Tab übernimmt ohne Hin und Her; iPad: alle Plätze kommen zurück, gehaltener Joystick wird beim Abriss losgelassen. |
| `debug-anzeige.spec.ts` (5, CHAOS-45, CHAOS-46) | echter Server, echte Host-/Controller-Seiten, Host **ohne** Testmodus | `?debug=1`: Host zeigt Bildrate, Bildabstand-p95, Grafikkarte und nach Joystick-Eingaben Eingabe→Frame als Zahlen; iPhone und geteiltes iPad zeigen RTT-Median/p95 (Herzschlag 1 s); ohne `debug` keine Anzeige. Prüft nur „Zahlen erscheinen“, keine Schwellen. Dazu lokal (Arena und Brett, 4 Spieler, Testmodus): Die Anzeige überschneidet keinen Spielerchip (CHAOS-46). |
| `host-brett.spec.ts` (7, M2) | lokaler Brett-Modus `?local=1&board=1&test=1`, Ereignisse per Testhaken eingespeist | Brett lädt ohne Konsolenfehler, Figur hüpft Feld für Feld, Zugwechsel/Würfel/Münzen/Klau mit Countdown, Lücke in `eventSeq` → Sprung, Minispiel-Platzhalter und Endstand; **Lichtverlauf (CHAOS-63):** Runde 2→3→4→5 blendet Mittag → Goldene Stunde → Dämmerung → Nacht über (Fortschritt nach 2 s ≈ 0,5, nach 4 s fertig, HUD `data-sky`); Screenshots `host-brett` (Runde 2, Mittag) und `host-brett-nacht` (Runde 5) mit maskiertem HUD-Text. Belegbilder ungemaskiert: `HOST_BRETT_BELEG=1`. |
| `m2-brett-durchstich.spec.ts` (1, M2) | echter Server, **echte Host- und zwei iPhone-Seiten**, Host ohne Testmodus | Beitritt, Bereit, Start des Brettspiels mit `?rounds=1`; genau ein Handy bekommt den Würfel, das andere wartet; Würfeln sperrt; alle angebotenen Entscheidungen werden getippt, bis Host und Handys den Endstand zeigen; Minispiel-Abschnitte in der Reihenfolge Anleitung → Spiel → Ergebnis (nicht abgebrochen); Server-Stand `game-results`. Welche Abschnitte im DOM standen, schreibt ein `MutationObserver` im Host mit (`addInitScript`): Unter Software-Rendering blockiert der Bühnenaufbau den Hauptthread während der Anleitung sekundenlang, Abtasten von außen verpasst sie dann (CHAOS-41). Die Frist des Servers für das Host-Ergebnis ist im Test 60 s statt 15 s (CHAOS-134): Unter SwiftShader war die Bühne 3–5 s nach Spielstart bereit, einzelne Bilder dauerten 5–11 s, und die Minispiel-Uhr holt je Bild höchstens 4 s nach. Das Ergebnis kam so in ≈ 1 von 4 Läufen nach der 15-s-Frist, und der Server brach ab. Geprüft wird weiter, dass der Server das Ergebnis des Hosts annimmt. |
| `m3-minispiel-durchstich.spec.ts` (2, M3) | echter Server (Referenz-Minispiel, Intro 4 s), echte Host- und iPhone-Seiten bzw. synthetische Controller | Brett → Anleitung → Spiel; Tipp auf A kommt im Minispiel an; Host meldet das Ergebnis, Server nimmt es an (Münzen im Stand), nächste Runde, Bühne entsorgt; Host-Neuladen mitten im Spiel startet mit Restzeit; Ergebnis nach Verbindungsabbruch erneut gesendet. |
| `m3-minispiel-anzeige.spec.ts` (M3) | lokaler Ablauf `?local=1&minigame=pump-parade&flow=1&test=1` | Anleitungskarte und Ergebnisanzeige (inkl. Gleichstand) als Screenshot-Baselines, Tastatur; Belegbilder `M3_BELEG=1`. |
| `m3-minispiele-bild.spec.ts` (2 je Rotationsspiel, M3, CHAOS-84) | lokale Vorschau `?local=1&minigame=<id>&test=1&seed=7`, Intro mit `&flow=1` | Jedes Minispiel der Rotation nach genau 2 s Spielzeit (feste Schritte, feste Kamera, Animationen mit konstantem Zeitschritt) gegen eine Baseline; HUD mit 4 Spielern und Restzeit. Seit CHAOS-84 zusätzlich die Anleitungskarte je Spiel (`minispiel-<id>-intro`, Titel, Anleitung, Bedienung, Umbruchkanten-Prüfung). Neues Spiel: `--update-snapshots=missing`. |
| `controller-minispiel.spec.ts` (6 × 2 Lagen, M3) | nachgebauter Session-Server | Intro, beschriftetes Spiel-Layout, Loslassen beim Wechsel ins Ergebnis, nur-A-Minispiel, Platz/Abbruch, vier iPad-Zonen mit gleichzeitigen Fingern; Screenshots. |
| `controller-brett.spec.ts` (9 × 2 Lagen, M2) | nachgebauter Session-Server | Warte-Karte mit Stand, jeder Prompt-Typ (Würfeln mit Items, Weg, Trophäe, Ziel, Reaktion) sendet das richtige `choose`, Sperre nach dem Senden, Countdown, `invalid-choice`-Hinweis, Endplatz, Wiederverbinden mitten in der Wahl; Screenshots (Text maskiert). Belegbilder: `BRETT_BELEG=<ordner>`. |
| `ipad-brett.spec.ts` (5 × 2 Lagen, M2) | nachgebauter Session-Server | Zwei Zonen mit unterschiedlichen Prompts und eigenem Stand, **gleichzeitige** Finger in beiden Zonen wählen je für den richtigen Slot, ein Finger aus Zone 1 löst keine Knöpfe in Zone 2 aus, Reaktion wählt schon beim Aufsetzen, Warten/Endstand je Zone und Lösen der Sperre durch einen neuen Prompt; Screenshot. |
| `controller-ui.spec.ts` (9 × 2 Lagen) | nachgebauter Session-Server | Beitritt per `?code=`, Code-Eingabe und Fehlertexte, Lobby → Spiel-Layout, Joystick-Vektoren und Drosselung, Knöpfe auch gleichzeitig mit dem Joystick, `seq` steigt, Layout folgt dem Kontext, Release beim Verschwinden, freundliche Fehler, Reconnect per Token, kein Scrollen/Zoomen bei Gesten; Screenshots Lobby/Spiel. |
| `m4-gesamtablauf.spec.ts` (2, M4) | echter Server mit Test-Pacing, **echte Host-, iPhone- und iPad-Seiten**, alle Spieler-Eingaben über die Controller-UI | Komplette Partie Lobby → Figurenwahl → Rundenwahl/Start → Brett + Minispiele → Pause/Weiter → Neuladen eines Controllers → Trophäenzählung → Siegerbildschirm → Endstand je Controller (gleicher Platz wie am PC) → „Nochmal spielen“ → Lobby mit Figuren; zwei iPhones (2 Runden) und gemischt 2 iPhones + iPad mit 2 Zonen (1 Runde). Details unten. |
| `ipad-zonen.spec.ts` (8 × 2 Lagen) | nachgebauter Session-Server | Zwei Zonen über eine Verbindung, gedrehte Zone im Hochformat, gleichzeitige Finger in verschiedenen Zonen mit richtigem Slot, `touchcancel`, Finger über die Zonengrenze, Drehen mitten im Spiel, vier Zonen mit vier Fingern, iPad-Modus in der Code-Eingabe; Screenshot mit zwei Zonen. |

### M4-Gesamtablauf (CHAOS-41)

`tests/e2e/m4-gesamtablauf.spec.ts` (Projekt `chromium`, je Test ein eigener Server) beweist den ganzen Lebenszyklus einer Partie mit echten Seiten. **Alle Spieler-Eingaben laufen über die echte Controller-UI**: Figur antippen, „Bereit!“, Prompt-Knöpfe, im Minispiel Joystick ziehen und Knopf A (CDP-Touch, in iPad-Zonen mehrere Finger gleichzeitig). Keine synthetischen Protokollnachrichten für Spieler. Der Host wird über seine UI bedient (Gerätewahl iPhone/iPad, Rundenwahl, Start, Pause-Knopf, „Weiter“, „Nochmal spielen“).

| Test | Aufstellung | Ablauf und Prüfungen |
|---|---|---|
| zwei iPhones | 2 × iPhone 13, Beitritt über den Link aus dem QR-Code | Figuren Socke/Waschbär (nicht die Standardfiguren), fremde Figur als vergeben; Host-Lobby zeigt Figuren und „bereit ✓“; **2 Runden** per Klick; Brett zeigt die gewählten Figuren; Pause mit offenem Würfel-Prompt (alle Controller `pause`, keine Knöpfe), „Weiter“ → derselbe Prompt; **iPhone 2 lädt in Runde 2 neu** (gleicher Platz, kein neuer Spieler, Server: verbunden); zwei **verschiedene** Minispiele mit Joystick- und A-Eingaben je Slot am Host; Trophäenzählung (Intro → Aufdecken vom letzten Platz → Sieger); Host-Ranking = Server-Ranking = Endstand je iPhone (`data-place`, `data-tied`, Figur); Revanche → Lobby, Figur `mine`, „Bereit!“ wieder da. |
| gemischt | 2 × iPhone 13 + iPad Pro 11 quer mit 2 Zonen (Link aus der Lobby, `seats=2`) | Zonen wählen Figur und „Bereit“ **gleichzeitig mit zwei Fingern**; **1 Runde**; Pause wie oben in allen vier Plätzen; **iPad lädt mitten im Minispiel neu** → beide Zonen zurück im Spiel, Phase bleibt `minigame-play`, danach Joystick/A beider Zonen am Host; Finale mit geteilten Plätzen; Endstand je Platz; Revanche. |

**Testmodus (nur im Test, nicht im Normalbetrieb):** Die Spec startet ihren Server über die Fixture-Optionen (`startChaosServer({ game })`, kein Env-Schalter nötig) mit schnellem Pacing (`TEST_PACING`: Züge 0,1–0,4 s, Anleitung 3 s, Ergebnis 5 s (CHAOS-170: vorher 2 s, unter Last war die Ergebnisanzeige weg, bevor der Test sie prüfte; geprüft wird sie vor der Annahme), Reaktionsfenster 5 s, Ergebnisfrist der Minispiele 120 s), den drei Rotations-Minispielen mit **6 s** Spielzeit und Rundenvorschlägen **1/2/3** statt 10/16/20. Der Host läuft mit `/host/?test=1&finale=manual`: Brett-Regie (`board.advance`), Minispiel-Bühne (`__chaosMinigame.step`) und Trophäenzählung (`__chaosFinale.advance`) rechnen nur auf Zuruf – unabhängig von der Rechnerlast. Seed fest (`E2E_GAME_SEED` = 2026); Prompt-Politik wie die Bots (würfeln, kaufen, festhalten, abbrechen, sonst erste Option). Im Minispiel rechnet der Test erst weiter, wenn am Host die **letzte** Eingabe jedes Platzes angekommen ist (voller Stick-Ausschlag, Stick wieder in der Mitte, A gedrückt und losgelassen; Testhaken `lastNetworkInputs`). Deshalb ist der Endstand auch unter Last reproduzierbar; vorher hing er davon ab, wie viele Zwischenstellungen des Wischs rechtzeitig ankamen (CHAOS-41).

**Laufzeit und Stabilität:** je Test 45–55 s bei zwei parallelen Workern (Zeitlimit 180 s); vor dem Einchecken 12 Läufe in Folge grün (`--repeat-each=6`). Zwei Stolpersteine sind im Test erklärt: In iPad-Zonen ist der Prompt-Rahmen ein Layout-Container ohne eigene Box und die Wahlflächen sind keine `<button>` (die Zonen bekommen echte CDP-Touches statt `locator.tap()`); nach dem Neuladen des iPads wartet der Test zwei Frames, bevor ein Finger aufsetzt (Chromium kennt den Touch-Listener der Spielfläche erst nach dem nächsten Frame). Das Podest wird vor dem Screenshot mit festen 60 Bildern gerendert, in sechs Aufrufen zu je 10 Bildern, und per `toDataURL` abgewartet: 60 Bilder am Stück hielten den Hauptthread des Hosts unter Last 15–30 s fest, der Host verlor die Verbindung und „Nochmal spielen“ ging verloren. Zwei Echtzeit-Fenster prüft der Test nicht mehr von außen: Ob jeder Controller Platz und Münzen des Minispiels gezeigt hat, zählt ein `MutationObserver` im Controller mit (die Ergebnisphase dauert im Test-Pacing nur 2 s), und vor der Trophäenzählung wartet er, bis der Host das Brett nach dem letzten Minispiel wieder aufgebaut hat (`__chaos.board.ready`). Auf `data-podium="ready"` wartet der Test bis zu 45 s: Der Podest-Aufbau übersetzt mit SwiftShader alle Shader am Stück (gemessen 0,5–8,7 s auf zwei Kernen mit zwei parallelen Tests, im CI über 15 s; CHAOS-41). Das Minispiel rechnet der Test in **einem** `step`-Aufruf zu Ende statt in vielen kleinen (CHAOS-211): Jeder Aufruf zeichnet ein Bild, und ≈ 9 Bilder kurz hintereinander stauten sich in SwiftShader so weit auf, dass der Host-Hauptthread in der Cloud-Sandbox ≈ 11 s lang weder Timer noch WebSocket-Nachrichten abarbeitete. Der Server hatte die 5-s-Ergebnisphase dann schon beendet, bevor der Host sie überhaupt zeigte (im CI reichte die schnellere Maschine).

**Screenshots** (Texte, Glyphen und der QR-Code mit zufälligem Port maskiert): `gesamtablauf-iphone-figurenwahl` (Charakterwahl am iPhone), `gesamtablauf-host-lobby` (PC-Lobby mit zwei Figuren, alle bereit), `gesamtablauf-host-sieger-2` und `-4` (Siegerbildschirm mit Podest), `gesamtablauf-iphone-endstand` (Endstand am iPhone).

## Ausführen

```bash
pnpm install
pnpm test                         # Vitest (Unit + Server-Integration)
pnpm test:e2e                     # baut einmal, dann alle E2E-Projekte (2 Worker)
pnpm test:e2e m1-durchstich       # nur eine Spec (Dateiname-Filter)
pnpm test:e2e --project chromium  # nur ein Projekt
pnpm test:e2e -g "geteiltes iPad" # nur Tests mit passendem Titel
pnpm check                        # Typen, Lint, Format, Vitest, Build, Lizenzen
```

Umgebungsvariablen:

- `E2E_SKIP_BUILD=1` – Build überspringen (nur lokal, wenn gerade gebaut wurde; fehlt ein Build, bricht das Setup mit Hinweis ab).
- `E2E_WORKERS=<n>` – Zahl der Worker (Standard 2). Die Host-Seiten rendern per Software; mehr als 2 Worker bringen auf 4 Kernen wenig.
- Belege für Abnahmeberichte (ungemaskierte Screenshots nach `docs/screenshots/`): `HOST_SZENE_BELEG=1`, `HOST_LOBBY_BELEG=1`, `HOST_SPIEL_BELEG=1`, `CONTROLLER_BELEG=1`.

Dauer: ein vollständiger Lauf (Build + 54 Tests) braucht auf 4 Kernen gut 1,5 Minuten; die drei Durchstich-Tests sind mit je 10–22 s die längsten (Software-Rendering, ~250 Physik-Frames). Sie haben ein eigenes Zeitlimit von 120 s.

Browser: Playwright ist auf 1.63.0 gepinnt; Chromium wird mit `pnpm exec playwright install chromium` passend installiert (CI: mit `--with-deps`).

## Messanzeige für den Gerätetest (`?debug=1`, CHAOS-45)

Bildrate und Latenz lassen sich automatisch nicht sinnvoll belegen (Chromium-Emulation, Software-Rendering, localhost). Dafür gibt es eine Messanzeige, die beim Gerätetest abgelesen wird (Entscheidung und Grenzen: [ADR-010](decisions/ADR-010-messanzeige.md)):

- **Host:** `http://localhost:8787/host/?debug=1` – unten rechts fps, Bildabstand (Median/p95), **Eingabe→Frame** (Eingang einer Controller-Eingabe bis Ende des nächsten gerenderten Frames, Median/p95, Anzahl), Pausen der Render-Schleife, WebGL-Version, Grafikkarte, Auflösung, Browser.
- **Controller:** Join-Link um `&debug=1` ergänzen (iPhone und iPad, z. B. `…/?code=ABCD&seats=2&debug=1`) – Rundlaufzeit Controller ↔ Server (Median/p95/letzte, Anzahl der letzten 60), unbeantwortete Proben, gesendete Eingaben/s, Gerät. Herzschlag dann jede Sekunde statt alle 5 s.
- **Kopieren:** Der Knopf legt eine Zeile mit allen Werten, Gerät und vollem User-Agent in die Zwischenablage. Im LAN ohne HTTPS (Handy) erscheint sie markiert in einem Textfeld zum manuellen Kopieren.
- Es gibt **keine Schwellen**: Werte notieren, zusammen mit Bedingungen (Gerät, WLAN, Abstand zum Router, Zahl der Spieler). Schwellen entstehen aus diesen M1-Baselines.
- Unit-Tests: `packages/metrics` (Ringpuffer, Median, p95, Formatierung), `apps/controller/src/debug/latencyMeter.test.ts` und Sitzung mit Messer (`session.test.ts`, künstliche Uhr + Fake-Socket), `apps/host/src/debug/frameMeter.test.ts` (vorgegebene Zeitstempel).

## Screenshot-Baselines

Eingecheckt unter `tests/e2e/__screenshots__/<spec>/<name>-<projekt>-linux.png`, **nur für Linux** (wie CI). Auf macOS/Windows überspringt Playwright die Screenshot-Vergleiche (`ignoreSnapshots` in `playwright.config.ts`, CHAOS-175): `pnpm test:e2e` prüft dort alle DOM-Assertions, aber nicht die Optik. Bis 19.11.2026 lagen zusätzlich 64 `*-darwin.png` im Repo; ungeprüft von der CI waren sie nach wenigen Tagen veraltet (bis 73 % abweichende Pixel) und ließen `pnpm test:e2e` am Mac scheitern. Sie sind entfernt, `.gitignore` hält neue fern. Die Optik vergleicht die CI; lokal geht das unter Linux, z. B. im Playwright-Docker-Image derselben Version (`mcr.microsoft.com/playwright:v1.63.0-noble`).

| Baseline | Moment |
|---|---|
| `host-szene-chromium` | lokaler Modus, 2 Figuren, 60 Frames nach dem Start |
| `host-lobby-chromium` | Lobby mit 2 Spielern (einer bereit), Gerätewahl „iPhone“, QR-Code eines **festen** Links (der echte Link enthält einen zufälligen Port; der Test ersetzt nur `lobby.joinUrl` in der Host-Verbindung) |
| `host-spiel-3-spieler-chromium` | Spiel mit 3 Spielern (iPhone + iPad), 60 Frames nach dem Start, vor jeder Eingabe, Seed 2026 |
| `controller-lobby/-play-iphone-hoch/-quer` | Controller-Lobby und Spiel-Layout |
| `ipad-2-zonen-spiel-ipad-quer/-hoch` | iPad mit zwei Zonen im Spiel |
| `host-brett-kamera-laufen/-zugwechsel/-ereignis/-ueberblick-chromium` (CHAOS-194) | Kamera-Regie im Demo-Ablauf: Blau läuft (25 Frames nach dem Pfad), Grün nach der Fahrt (170 Frames), Grün würfelt (30 Frames), Rundenbeginn (75 Frames) |
| `gesamtablauf-*-chromium` (M4) | Gesamtablauf: Figurenwahl am iPhone, PC-Lobby mit Figuren, Siegerbildschirm mit 2 und 4 Spielern, Endstand am iPhone (Seed 2026, Test-Pacing) |

**Natur-Look (CHAOS-62, ADR-014):** Brett, Minispiele und seit CHAOS-77 auch Lobby-Arena und Siegerpodest rendern im Testmodus die Sparstufe `minimal` (8 % Gras, Schatten, Texturen, Dunst; ohne HDRI-Umgebungslicht, Bloom, SSAO, Unschärfe, Detailkarten). Die Baselines `host-brett`, `minispiel-<id>`, `m3-minispiel-intro/-ergebnis`, `host-szene`, `host-lobby*`, `host-finale-*`, `gesamtablauf-host-*` und die Controller-Bilder mit Brett im Hintergrund zeigen deshalb den Look in Sparstufe, nicht die volle Optik (die zeigen `docs/screenshots/chaos62-*.jpg`). Auch ohne Testmodus wählt der Host bei Software-Rendering (SwiftShader, llvmpipe) die Sparstufe und macht größere Zeitschritte (Brett-Regie bis 4 s, Minispiel-Uhr bis 240 Schritte (4 s) je Bild), damit Durchstich-Tests in Echtzeit bleiben. Ein Bild kostet mit SwiftShader im Container ≈ 0,5–0,8 s; `stepFrames(n)` von Brett und Arena und `__chaosFinale.stepPodium(n)` rechnen daher n Schritte und zeichnen nur das letzte Bild (wie `__chaosMinigame.step`).

Stabilität: fester Seed, Kamera nur über `stepFrames` bewegt (Feder mit festen Schritten, CHAOS-194), Physik nur über `stepFrames`, `animations: 'disabled'`. Texte und Glyphen sind maskiert, weil Schriften zwischen Rechnern/Runnern abweichen; geprüft werden Layout, Farben, Formen und die 3D-Szene. Texte prüfen die DOM-Assertions. Toleranz: `maxDiffPixelRatio 0.02`, `threshold 0.2` (SwiftShader kann um einzelne Pixel abweichen).

**Umbruchkanten (CHAOS-41):** Die Maske verdeckt Text, nicht seine Zeilenzahl. Passt ein Satz nur mit wenigen Pixeln Luft in eine Zeile (oder bricht mit wenigen Pixeln zu viel um), kippt schon 1 % andere Schriftrasterung den Umbruch, und die ganze Karte springt (so `m4-endstand-iphone-hoch`: lokal grün, in CI 16 % Abweichung). Dasselbe gilt für Reihen mit `flex-wrap` (etwa die Bedienlegende im Minispiel-Intro): Passt die letzte Pille nur knapp, rutscht sie in eine zweite Reihe. Prüfen lässt sich das, indem man testweise `letter-spacing: ±0.1px` (bzw. ±0,3 px) auf `body` setzt und die Screenshot-Specs laufen lässt. Abhilfe bei festen Produkttexten: feste Satzbreite mit `text-wrap: balance`, sodass der Satz deutlich zwei Zeilen braucht. Bei Testdaten (etwa den Minispiel-Steckbriefen im Spec) den Text so wählen, dass er deutlich passt oder deutlich umbricht.

**Automatische Prüfung (CHAOS-72):** `expectStableWrapping(locator)` aus `tests/e2e/fixtures/wrapping.ts` misst jeden Text unter dem Locator bei 0 und ±0,3 px Zeichenabstand: Zeilenzahl und senkrechte Lage (Toleranz 2 px). Ändert sich eins davon, schlägt der Test vor dem Screenshot fehl und nennt den Text. `controller-minispiel.spec.ts` ruft sie vor jedem Screenshot auf; bei neuen Screenshot-Tests mit Text ebenfalls davorsetzen.

**Keine Bildvergleiche aus `openDevice`-Geräten (CHAOS-233):** Telefone und iPads aus `openDevice` laufen im Geräte-Browser ohne GPU (`deviceBrowser`, `--disable-gpu`). Dort rastert Chromium Text auf der CPU, und das Schriftbild weicht je Rechner leicht ab: Das Handy-Bild aus `minispiel-spielformen.spec.ts` lag im Cloud-Container in jedem Lauf um genau 4 419 Pixel (3 %) neben der CI-Baseline, während alle Bilder der Projekte `iphone-hoch`/`-quer` dort passten. In Specs mit `openDevice` prüft deshalb der DOM die Controller; Controller-Bilder entstehen in den Controller-Projekten mit `FakeSession` (etwa `minispiel-intro-team` in `controller-minispiel.spec.ts`). Host-Bilder mit Minispiel-Anleitung erst aufnehmen, wenn die Bühne steht (`__chaosMinigame.ready`, Pause-Knopf sichtbar): Vorher fehlt der Pause-Knopf und die Arena ist noch nicht da. Geht es nur um die Karte, die 3D-Fläche ausblenden (`.minigame-screen canvas { visibility: hidden; }`, wie `m3-minispiel-anzeige.spec.ts`).

Baseline bewusst aktualisieren (nur wenn sich die Oberfläche absichtlich geändert hat):

1. Test laufen lassen; bei Abweichung liegen `*-actual.png`, `*-expected.png` und `*-diff.png` unter `test-results/`. Prüfen, ob die Änderung gewollt ist.
2. `pnpm test:e2e:update` (aktualisiert nur abweichende Baselines) oder gezielt `pnpm test:e2e <spec> --update-snapshots=changed`.
3. Neue PNGs ansehen und mit Begründung im Commit einchecken. Auf einem Nicht-Linux-Rechner keine Baselines erzeugen; im Zweifel unter Linux mit derselben Playwright-Version (z. B. im passenden Playwright-Docker-Image) neu erzeugen.

## CI

`.github/workflows/ci.yml`: Install (`--frozen-lockfile`), Typecheck, Lint, Format, Vitest, Build, Start-Bundle des Hosts (`pnpm check:bundle`: Budget 520 kB, keine Babylon-Engine vor der Lobby; CHAOS-53), Lizenzen, Rauchtest des Start-Ablaufs (`pnpm smoke`: Server aus dem Build starten, `/health`, Host, Controller samt Skripten, WebSocket-Join, sauberes Beenden; CHAOS-42), Playwright-Chromium (Cache je Playwright-Version, bei Treffer nur Systempakete), dann `pnpm test:e2e --trace off`. Bei Fehlern werden `test-results/` (Diff-Bilder, Fehler-Screenshots) und `playwright-report/` (HTML-Bericht) als Artefakt `playwright-ergebnisse` hochgeladen (7 Tage). Zeitlimit des Jobs: 20 Minuten.

## Automatische Abdeckung je M1-Lieferumfang (ROADMAP)

| Lieferumfang | Automatisch belegt durch | Nur am Gerät |
|---|---|---|
| pnpm-TypeScript-Workspace (Host, Controller, Server, Protokoll) | `pnpm check` in CI (strict, Lint, Format, Build, Lizenzen) | – |
| Babylon.js-Szene mit steuerbarem Objekt, Havok | `host-szene.spec.ts` (WASM, Figuren, Tastatur, Impuls, Screenshot); Bewegung/Dash-Unit-Tests | Bildrate/Optik auf dem echten PC-Monitor |
| QR-Join über LAN, Spieler-Identität/Slots | `host-lobby.spec.ts`, `m1-durchstich.spec.ts` (Link aus der Lobby → Controller → Slot/Farbe auf Handy und Host); Netzwerkwahl-Unit-Tests | Kamera-Scan, Erreichbarkeit im WLAN, Firewall, Client-Isolation |
| Zwei iPhones gleichzeitig, getrennte Figuren | `m1-durchstich.spec.ts` Test 1 (gleichzeitige Joysticks auf zwei Seiten), Server-Integration mit mehreren `ws`-Clients | echte Gleichzeitigkeit zweier Geräte, Latenz |
| Geteiltes iPad, ≥ 2 unabhängige Touch-Zonen, Weg zu 4 | `m1-durchstich.spec.ts` Test 2/3 (zwei Finger, echte Server-Session), `ipad-zonen.spec.ts` (inkl. 4 Zonen), Zonen-Unit-Tests | echtes iPadOS-Multitouch, Handballen, Systemgesten |
| Reconnect und Trennungs-Feedback; kontextabhängiges Layout | `reconnect-slot.spec.ts`, `m1-durchstich.spec.ts` (offline/online → gleicher Platz), `controller-ui.spec.ts` (Layout folgt Kontext), Session-/Client-Unit-Tests | Bildschirmsperre, Safari im Hintergrund, WLAN-Wechsel |
| Playwright-Smoke-Tests, Protokolltests, Gerätecheckliste | diese Suiten; `packages/protocol` (161 Tests) | Checkliste selbst: `docs/device-test-checklist.md` |

## Automatische Abdeckung je M2-Lieferumfang (ROADMAP)

| Lieferumfang | Automatisch belegt durch | Nur am Gerät / im Playtest |
|---|---|---|
| 3D-Brett mit Verzweigungen und unterschiedlichen Ereignisfeldern | `validateBoard` + `board.test.ts` (Wackelwald gültig, je Regel ein kaputtes Brett), `host-brett.spec.ts` (Screenshot, `docs/screenshots/m2-host-brett.png`) | Lesbarkeit am Fernseher (Checkliste B10) |
| Würfeln, Zugreihenfolge, Pfadwahl, Bewegung | `machine`/`movement`-Tests mit Seeds, `boardGame.integration.test.ts`, `host-brett.spec.ts` (Figur hüpft Feld für Feld), `m2-brett-durchstich.spec.ts` | Verständlichkeit (B1, B2) |
| Münzen, Trophäen-Erwerb, Basis-Ökonomie | `economy`-Tests (Untergrenze 0, Kauf, zu wenig Geld, Wandern, Rangfolge mit Gleichstand), EXP-002 | Gefühl für Preise und Tempo (B11) |
| ≥ 3 Items inkl. Sabotage, begrenztes Reaktionsfenster | `items`/`reaction`-Tests (je Item, Schild/Festhalten/Timeout/verspätet), Integration mit Timeout und später Wahl, `controller-brett`/`ipad-brett` (Countdown, Reaktion beim Aufsetzen), EXP-003/004 | Reaktion in der Zeit schaffbar, Sabotage lustig statt gemein (B3, B12) |
| Brettzustand und Wertung autoritativ auf dem PC; Integrationstests Zugzyklus | Server-Integration mit synthetischen Controllern (2/3/4 Spieler, gemischt, Disconnect, Host-Reload), feste Seeds (`docs/progress.md`) | Host-Reload und Sperrbildschirm auf echten Geräten (B8, B9) |
| Erste Experimente | `docs/experiments.md` EXP-001 … EXP-004, Befehl oben | Spaß: nur Playtest |

## Automatische Abdeckung je M3-Lieferumfang (ROADMAP)

| Lieferumfang | Automatisch belegt durch | Nur am Gerät / im Playtest |
|---|---|---|
| Drei Minispiele (Arcade, Physik, Hybrid) | je Minispiel Logik- und Headless-Tests (`packages/minigames/src/<id>/`), Vertragsprüfung je Modul mit 2/3/4 Zufalls-Bots (`catalog.test.ts`), Physik-Invarianten (Pudding-Gerangel), `m3-minispiele-bild.spec.ts` | Spaß, Fairness, Verständlichkeit (Checkliste 10, P3–P7) |
| Vier kosmetische Figuren | `packages/assets` (Generator byte-genau, Manifest-Prüfung: Höhe, Animationen, Budgets), `apps/host/src/characters` (NullEngine-Tests), Baselines `host-brett`/`host-lobby` | Unterscheidbarkeit am Fernseher (P1, P2, P7) |
| Hybride Asset-Pipeline, Lizenz-/Attributions-Manifest | `pnpm check:assets` (CI-Schritt „Assets“), 14 Fälle mit kaputten Manifesten | – (Lizenz seit CHAOS-69: GPL-3.0-only, ADR-018) |
| Animation, Sound, VFX, Anleitungen, Ergebnisse | Fx-Unit-Tests (Klang-Rezepte, nachgebautes WebAudio, Partikel mit NullEngine), `m3-minispiel-anzeige` (Karten), `controller-minispiel` | Klang und Lesbarkeit (P8, P9, G1–G8) |
| Experimente zu Minispiel-Konzepten | EXP-005 … EXP-007 mit Prototyp-Simulationen (`packages/minigames/src/prototypes/`, `EXPERIMENTS=1`) | Spaß: nur Playtest |
| Tests für Lebenszyklus, Wertung, Scene-Cleanup | `minigame-sdk` (Laufzeit, Wertung, Ergebnisprüfung), game-core `minigame.test.ts`, Server-Integration Brett ↔ Minispiel je Minispiel mit 2/3/4 Spielern, `sceneResidue` = leer nach `dispose` | – |

## Automatische Abdeckung je M4-Lieferumfang (ROADMAP)

| Lieferumfang | Automatisch belegt durch | Nur am Gerät / im Playtest (Checkliste Abschnitt 12) |
|---|---|---|
| Lobby, Beitritt, Charakterwahl, Rundenwahl, Start/Pause/Ende | `m4-gesamtablauf` (echte UI aller Geräte), `host-lobby-figuren`, `host-pause`, `controller-m4`, `controller-m4-durchstich`, `ipad-m4`, Server `session.v4.test.ts`/`robustness.test.ts` | V1, V3, V10–V11, V13–V15, V27–V29 |
| Brettzüge, Minispiele, Belohnungen, Trophäenzählung, Siegerbildschirm | `m4-gesamtablauf` (2 bzw. 1 Runden, zwei verschiedene Minispiele), `host-finale` (Gleichstand, geteilter Sieg, vorzeitiges Ende), `determinism.integration.test.ts` | V2, V4–V7 |
| 2–4 Spieler, geteiltes iPad, Reconnect | `m4-gesamtablauf` (2 iPhones; 2 iPhones + iPad mit 2 Zonen; Neuladen im Brett und im Minispiel), `reconnect.integration.test.ts` (jede Phase), `hostLoss.integration.test.ts`, `mixedSetup.integration.test.ts`, `reconnect-slot` | V12, V16–V26, iPad-Nachtest Abschnitt 4 (CHAOS-47) |
| Performance | `pnpm perf` (nur relativ, nicht in CI), [performance.md](performance.md) | Abschnitt 11 (PF0–PF10) |
| Automatischer E2E-Test des ganzen Lebenszyklus, Gerätevalidierung dokumentiert | `m4-gesamtablauf` in CI; Checkliste Abschnitt 12 | Rubens Durchgang |

## Was die Automatik **nicht** beweist (Gerätecheckliste)

Browser-Automatisierung in Chromium mit Geräte-Emulation ist kein iPhone und kein iPad. Folgendes bleibt Handarbeit auf echten Geräten (`docs/device-test-checklist.md`):

- Echtes Multitouch in iOS-/iPadOS-Safari: mehrere Finger, Handballen, Systemgesten (Kontrollzentrum, Home-Wisch), Zoom-/Scroll-Sperren, Doppeltipp, Haptik.
- Safari-/WebKit-Eigenheiten generell (Tests laufen nur in Chromium mit iOS-User-Agent).
- QR-Scan mit der Kamera-App, Öffnen des Links, Erreichbarkeit im echten WLAN, Firewall-Dialog am PC, Gäste-WLAN/Client-Isolation.
- Eingabelatenz und „fühlt sich direkt an“; Bildrate des Hosts mit echter GPU.
- Bildschirmsperre, App-Wechsel, eingefrorene Tabs, WLAN-Wechsel und echte Funklöcher (der E2E-Netzabbruch schaltet den Browser-Kontext offline und schließt die laufende Verbindung – das ist eine Nachbildung).
- Lesbarkeit vom Sofa, Größe der Bedienelemente in der Hand, Spaß.
