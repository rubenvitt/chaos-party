# Fortschritt

**Stand:** 2026-11-21 (CHAOS-89: Spielformen 1 gegen 3, 2 gegen 2 und Koop mit Einzelwertung – Steckbrief `teamPlay`, game-core teilt die Teams ein (Ersatz 1 gegen 2 mit Vorteil zu dritt, 1 gegen 1 zu zweit), Ausgang im Ergebnis, Münz-Regel nach EXP-038, Team-Ansage am PC und Rolle am Web-Controller, Testspiele Pump-Duell/Pump-Solo/Riesenballon in der Galerie, v4-Nachtrag ohne Versionssprung, ADR-012 Nachtrag 8, Gerätecheckliste §46; iOS-Controller und Apple-Host folgen in CHAOS-229/230; CHAOS-86: Minispiele je Spiel als eigener Chunk über `@chaos-party/minigames/lazy`, Minispiel-Bühne 2.737 → 2.568 kB und wächst nicht mehr mit dem Katalog, keine 300-ms-Suspense-Drossel mehr beim ersten Minispiel, Marke `minispiel:angefragt`, `pnpm check:bundle` prüft per Vite-Manifest, ADR-004 Nachtrag 2; CHAOS-196: Wackelwald mit 74 statt 43 Feldern und vier Gabeln – Lichtung, Bachlauf/Uferweg, Baumkronenweg –, Kulisse mit Bach, Teich und Lichtung, faire Wegwahl in Bot-Partien (EXP-037), empfohlen 12 Runden, Gerätecheckliste §45; CHAOS-198: zweites Themenbrett „Frostgipfel“ mit 75 Feldern, vier Gabeln, Eisfeldern, Seilbahn gegen Münzen und angesagten Lawinen – optionale Brett-Daten im Regelkern ohne Protokolländerung, ADR-023, EXP-036, Winterkulisse auf PC- und Apple-Host, Gerätecheckliste §43; CHAOS-87: Minispiel-Galerie in der PC-Lobby mit Übungsrunde (`start.practice`, ein Minispiel ohne Münzen, danach zurück in die Lobby) und Daumen hoch/runter am iPhone nach jedem Minispiel (`rate`, nichts wartet darauf), Stimmen in `~/.chaos-party/minispiel-stimmen.json`, Export `/ratings.json`, Rauswurf-Vorschlag ab 6 Stimmen mit ≥ 60 % runter, Gerätecheckliste §42; CHAOS-85: Minispiel-Rotation für einen großen Katalog – Steckbrief mit Familie, Kernverb, Spielform und Tauglichkeit, Filter für Spielerzahl und iPad-Zonen, Familien reihum, nie gleiche Familie oder gleiches Kernverb hintereinander, letzte Partie ans Ende, Sperrliste und Favoriten im Lobby-Dialog „Minispiele“ am PC, ADR-012 Nachtrag 6, Gerätecheckliste §40; CHAOS-84: gemeinsame Minispiel-Prüfungen – Vertragstest mit Leerlauf und Dauerdrücken, Bot-Fairness-Vorlage mit festen Schwellen, Mindestabstand ≥ 3 Merkmale über die Steckbriefe des Baukastens, Intro-Screenshot je Spiel, `docs/minigames/pruefungen.md`; Wackelturm mit begründeter Ausnahme, Klärung in CHAOS-215; CHAOS-214: Minispiel-Anleitung wartet, bis alle verbundenen Spieler „Bereit“ gedrückt haben – mindestens 3 s, spätestens 60 s, getrennte zählen als bereit; Knopf an iPhone, iPad-Zonen und nativer App, Bereit-Stand an PC- und Apple-Host, ADR-012 Nachtrag 5, Gerätecheckliste §39; CHAOS-83: Minispiel-Baukasten `packages/minigame-kit` – Uhr, Spawner mit Vorwarnung, Gefahrenzonen, Benommenheit, Sichern/Riskieren-Konto, Bewegung, Bot-Profile mit Störenfried und gemeinsamer Bot-Partie, Höhepunkt-Vorlagen, Vielfalts-Steckbrief, Arena-Vorlagen an sieben Orten, fünf Kameras; Sockenregen umgestellt ohne Verhaltensänderung, Muster-Minispiel „Hallo Baukasten“ in 300 Zeilen, ADR-021; CHAOS-88: Art-Kit für Minispiel-Requisiten – 27 Requisiten in 10 Sets aus Blender-Skripten (`requisitkit.py`, `requisiten.py`), Katalog `packages/assets/src/props.ts`, Budget je Requisit und je Minispiel in `check:assets`, Babylon-Ladetest, Kontaktbogen `docs/screenshots/chaos88-requisiten.jpg`; CHAOS-212: nativer Host lädt die Kulisse je Brett aus `bretter/<brett-id>/`, Export und Prüfung über alle Bretter des Registers, Gerätecheckliste §38; CHAOS-197: Brett-Auswahl in der Lobby – Brett-Register in game-core, `configure.board` mit „Zufall“, Wechselknopf in PC- und Apple-Lobby, Brett in der Controller-Lobby, ADR-015 Nachtrag 6, Gerätecheckliste §37; CHAOS-194: dynamische Brett-Kamera – nah an der Figur am Zug, Blick voraus beim Laufen, Ereignis-Zoom, Gabel und Klau eingepasst, Überblick nur zu Rundenbeginn; eine Regie in `apps/host/src/board/camera.ts` für PC- und Apple-Host, EXP-033, Spieltest am Fernseher offen; CHAOS-209: Minispiel-Aufbau in Schritten von höchstens etwa 5 ms ohne JIT, Reserve von 10 ms je Bild auch bei knapper Bühne, längstes Bild der Anleitung in der Interpreter-Näherung 12–14 statt 17–19 ms, im Swift-Harness ohne JIT auf dem Mac 10,7–12,3 ms in drei Läufen, ADR-012 Nachtrag 4; CHAOS-205: Aufbau-Budget des Apple-Hosts folgt der Tick-Dauer, Bühne auch bei 10 Hz rechtzeitig fertig, ADR-012 Nachtrag 3; CHAOS-206: Apple- und PC-Host werten ein spät gestartetes Minispiel vor der Frist des Servers, ADR-012 Nachtrag 2; M5 abnahmebereit: Mac und Apple TV hosten eine komplette Partie mit dem nativen RealityKit-Host, Gesamtlauf im tvOS-Simulator und am Mac mit Bots (EXP-031), echte Apple TV und iPhones offen (Gerätecheckliste §34, Gate CHAOS-164); M4 freigegeben; CHAOS-168: PC-Host verteilt `runner.prepare` über mehrere Bilder (`ctx.pace()`, 6 ms je Bild); im Minispiel-Aufbau kein Long Task mehr, längster Block Brett → Minispiel bleibt aber der Kontextaufbau (`new Engine`, EXP-025 Nachtrag); CHAOS-142: nativer Apple-Host zeigt Lobby und Brett mit echter Grafik (USDZ aus CHAOS-140), hochskalierter 4K-Pfad, `host-ready` nach dem Laden; CHAOS-152: Brett bleibt während des Minispiels eingehängt statt neu gebaut zu werden, Minispiel → Brett ohne Neuaufbau (längster Block Median 2,2 → 0,57 s in SwiftShader), EXP-029; CHAOS-161: Socken-Bündchen und Kaktus-Blüte sitzen wieder auf dem Körper, Kaktus knittert nicht mehr, Auflage-Prüfung in `check_usdz.py` und `check_realitykit.swift`; CHAOS-151: TestFlight liefert den nativen Apple-Host statt des RealityKit-Spikes auf die Apple TV; CHAOS-132: Minispiel-Bühne und Brett übersetzen Shader schrittweise, Shader-Vorbereitung ohne Block > 0,33 s in SwiftShader, EXP-025; CHAOS-124: Lobby-Option „Mehr Zeit zum Reagieren“ (5 s statt 3 s Reaktionsfenster, ADR-015 Nachtrag 5), Leertaste löst Knöpfe am PC wieder aus; CHAOS-139: nativer Apple-Host als Workspace-Paket `apps/apple-host` – JS-Kern im `pnpm build`, Vertrag als zod-Schema, ganze Bot-Partie in Node und JavaScriptCore in der CI, App für macOS und tvOS; CHAOS-46: Messanzeige am Host im Spiel links mittig statt über dem 4. Spielerchip, ADR-007/ADR-010 nachgetragen, CI-Actions auf Node 24 (per Dependabot); CHAOS-147: Apple-TV-App wählt die Messvariante per Siri Remote (Play/Pause), Wahl gespeichert, Startparameter haben Vorrang; CHAOS-119: TestFlight-Pipeline für die Apple-TV-App (RealityKit-Spike als „Chaos Party“, `dev.rubeen.chaosparty.tv`); CHAOS-79: fünftes Minispiel „Krümel-Kehraus“ in der Rotation, EXP-023; CHAOS-65: Aufholhilfe „Trophäe wandert vor die Letzten“, EXP-022; CHAOS-66: kurze Minispiel-Anleitung bei Wiederholung, EXP-011-Nachtrag, seit CHAOS-128 auch in der nativen Controller-App; CHAOS-53: Host-Bundle aufgeteilt, Start 2.750 → 404 kB, `pnpm check:bundle`; CHAOS-76: Grafik-Automatik erkennt 30-Hz-Bildschirme; CHAOS-71: Siegerpodest entsteht während der Trophäenzählung, kein Standbild mehr am Übergang, EXP-021; CHAOS-69: Projekt ist Open Source unter GPL-3.0-only, ADR-018; CHAOS-73: Grafik-Engpass auf echter GPU gefunden und behoben, Messung an Rubens PC offen; CHAOS-75: Renderer-Spike abgeschlossen, ADR-016 angenommen (bei Babylon bleiben), PC-Messung folgt in CHAOS-131; CHAOS-54: viertes Minispiel „Kuckucks-Klatsche“ in der Rotation, EXP-016; CHAOS-78: native RealityKit-App für macOS/tvOS, iPhone/iPad als Benchmark, EXP-017; CHAOS-68: nach Host-Neuladen erst fortsetzen, wenn die Bühne steht; CHAOS-51: Trostpreis-Item für den letzten Minispiel-Platz als neuer Standard, EXP-019) · **Aktueller Meilenstein:** M5 – Nativer Apple-Host (`CHAOS-163`, Gate CHAOS-164)

Aufgabenstatus im Detail führt Zunder (Projekt „Chaos Party“, `CHAOS-…`). Diese Datei ist der dauerhafte Schnappschuss im Repo: Meilensteinstand, geprüfte Befehle, nächste Schritte.

## Meilensteine

| Meilenstein | Epic | Gate | Status |
|---|---|---|---|
| M1 – Technischer Durchstich | CHAOS-1 | CHAOS-16 | **APPROVED** 2026-11-15 (nur iPhone getestet, iPad offen) |
| M2 – Spielbares Brett | CHAOS-2 | CHAOS-25 | **APPROVED** 2026-11-15 (nur iPhone getestet, iPad nach M3 verschoben) ([`acceptance/M2.md`](acceptance/M2.md)) |
| M3 – Party-Identität und Minispiele | CHAOS-3 | CHAOS-35 | **APPROVED** 2026-11-15 (Optik → eigenes Epic CHAOS-56) ([`acceptance/M3.md`](acceptance/M3.md)) |
| M4 – Vollständiger Vertical Slice | CHAOS-4 | CHAOS-43 | **APPROVED** 2026-11-16 trotz Ruckeln; Performance auf echter Hardware folgt (CHAOS-73) ([`acceptance/M4.md`](acceptance/M4.md)) |
| M5 – Nativer Apple-Host: komplette Partie auf Mac und Apple TV | CHAOS-163 (Inhalt CHAOS-137) | CHAOS-164 | **abnahmebereit** 2026-11-19, Entscheidung durch Ruben offen ([`acceptance/M5.md`](acceptance/M5.md)) |

## M1 – Aufgaben

| Aufgabe | Inhalt | Stand |
|---|---|---|
| CHAOS-5 | Annahmenliste + Arbeitsartefakte | erledigt (PR #2) |
| CHAOS-6 | pnpm-Monorepo + Pipelines | erledigt (PR #3) |
| CHAOS-7 | Typisiertes WebSocket-Protokoll (ADR-003) | erledigt (PR #4) |
| CHAOS-8 | Babylon.js-Szene + Havok (ADR-004) | erledigt (PR #4) |
| CHAOS-9 | Session-Server (ADR-005) | erledigt (PR #4) |
| CHAOS-10 | iPhone-Controller-UI (ADR-006) | erledigt (PR #4) |
| CHAOS-11 | QR-Join über LAN (ADR-007) | erledigt (PR #4) |
| CHAOS-12 | Reconnect/Disconnect (ADR-009) | erledigt (PR #4) |
| CHAOS-13 | Shared-iPad-Zonen (ADR-008) | erledigt (PR #4) |
| CHAOS-14 | Playwright + Integrationstests (`testing.md`) | erledigt (PR #4) |
| CHAOS-45 | Messanzeige Latenz/Bildrate (ADR-010) | erledigt (PR #4) |
| CHAOS-15 | Gerätecheckliste, Demo-Anleitung, Abnahmebericht | erledigt (PR #4) |
| CHAOS-16 | **M1-Abnahme (Ruben)** | APPROVED 2026-11-15, siehe [`acceptance/M1.md`](acceptance/M1.md) |

## M2 – Aufgaben

Umgesetzt in **einem** PR (Branch `claude/chaos-2-orchestrierung-subagents-uuzx8a`), orchestriert mit Subagenten: Verträge zuerst (Protokoll v2, game-core-Typen), dann parallel Regeln, Brett + Host, Controller; danach Server-Integration, Integrationstests und Experimente.

| Aufgabe | Inhalt | Stand |
|---|---|---|
| CHAOS-17 | game-core: Zustandsautomat mit Seeded RNG (ADR-011) | im PR |
| CHAOS-18 | Brett „Wackelwald“ als Daten + Validierung, prozedurale Host-Szene | im PR |
| CHAOS-19 | Würfeln, Zugreihenfolge, Pfadwahl, Bewegung (Regeln + Animation) | im PR |
| CHAOS-20 | Münzen, Trophäen, Ökonomie, HUD | im PR |
| CHAOS-21 | Items (Doppelwürfel, Münzklau, Falle, Schild) + Reaktionsfenster | im PR |
| CHAOS-22 | Controller-Kontext der Brettphase (iPhone, iPad-Zonen), Server-Verdrahtung | im PR |
| CHAOS-23 | Deterministische Integrationstests des Zugzyklus | im PR |
| CHAOS-24 | Experimente EXP-001 … EXP-004 | im PR |
| CHAOS-48 | Warnung bei belegtem `localhost` | im PR |
| CHAOS-47 | **Ruben:** iPad-Nachtest aus M1 (I1–I9) | nach M3 verschoben (Ruben, 2026-11-15), Voraussetzung für CHAOS-43 |
| CHAOS-25 | **M2-Abnahme (Ruben)** | APPROVED 2026-11-15 |

## M3 – Aufgaben

Umgesetzt in **einem** PR ([#6](https://github.com/rubenvitt/chaos-party/pull/6), Branch `claude/inspiring-darwin-1iwg23`, gestapelt auf den M2-Branch), orchestriert mit Subagenten: Verträge zuerst (minigame-sdk, Protokoll v3, game-core, Server, Vorschau), dann parallel Figuren/Assets, je ein Minispiel pro Kategorie (mit Konzeptvergleich), Host-Bühne + Ton/VFX und Controller; Integration, übergreifende Tests und Doku durch den Koordinator.

| Aufgabe | Inhalt | Stand |
|---|---|---|
| CHAOS-26 | minigame-sdk: Vertrag, Laufzeit (fester Takt), Headless-Harness, Host-Bühne (ADR-012) | im PR |
| CHAOS-27 | Art Direction + vier Figuren (GLB aus eigenem Generator) | im PR |
| CHAOS-28 | Asset-Paket, Manifest, `pnpm check:assets` in CI | im PR |
| CHAOS-29 | Konzeptvergleiche EXP-005 … EXP-007 | im PR |
| CHAOS-30 | Arcade: Sockenregen | im PR |
| CHAOS-31 | Physik: Pudding-Gerangel (Havok) | im PR |
| CHAOS-32 | Hybrid: Wackelturm | im PR |
| CHAOS-33 | Anleitungen, Ergebnisse, Ton, VFX, Animation (Host + Controller) | im PR |
| CHAOS-34 | Tests Brett ↔ Minispiel, Wertung, Cleanup, Screenshot-Regression | im PR |
| CHAOS-35 | **M3-Abnahme (Ruben)** | APPROVED 2026-11-15 |

## M4 – Aufgaben

Umgesetzt in **einem** PR ([#16](https://github.com/rubenvitt/chaos-party/pull/16), Branch `claude/affectionate-noether-ye4h0b`), orchestriert mit Subagenten in drei Phasen: (A) Verträge zuerst – Protokoll v4, game-core, Server, ADR-015; (B) parallel in eigenen Worktrees Host-UI, Controller-UI und Server-Robustheit; (C) parallel Performance- und Balance-Pass, danach Gesamt-E2E und Start-Ablauf. Integration, Gesamtprüfung und Doku durch den Koordinator.

| Aufgabe | Inhalt | Stand |
|---|---|---|
| CHAOS-36 | Lobby mit Figuren, Charakterwahl, Rundenwahl, Start/Pause/Ende (ADR-015) | im PR |
| CHAOS-37 | Gleichstandsregel, Trophäenzählung, Siegerbildschirm mit Podest, Revanche | im PR |
| CHAOS-38 | iPad-Zonen 2/3/4 in allen Phasen, gemischte Aufstellung, Reconnect je Phase, Auto-Pause bei Host-Verlust | im PR |
| CHAOS-55 | Minispiel-Münzen im Stand, „geteilt“/„abgebrochen“ am Controller, Ergebnis-Bestätigung | im PR |
| CHAOS-39 | Messung je Szene, `pnpm perf`, Optimierungen ([`performance.md`](performance.md)) | im PR |
| CHAOS-40 | EXP-011 … EXP-013, Runden-Vorschläge 10/16/20, Feinschliff | im PR |
| CHAOS-41 | Gesamtablauf-E2E, Gerätecheckliste Abschnitt 12, [`m4-demo.md`](m4-demo.md) | im PR |
| CHAOS-42 | `pnpm play`, `pnpm smoke`, [`known-issues.md`](known-issues.md), [`security-license-review.md`](security-license-review.md), Abnahmebericht | im PR |
| CHAOS-47 | **Ruben:** iPad-Nachtest aus M1 (I1–I9) | offen, Voraussetzung für CHAOS-43 |
| CHAOS-43 | **M4-Abnahme (Ruben)** | APPROVED 2026-11-16 (trotz Ruckeln, „hakelig langsam“) |
| CHAOS-73 | Ruckeln auf echter GPU: PCSS-Filterstufe `LOW`, Auflösungsgrenze je Grafikstufe, Automatik merkt sich die Stufe ([EXP-014](experiments.md)) | im PR, Messung an Rubens PC/Fernseher offen |
| CHAOS-123 (Backlog CHAOS-44) | Bonus-Titel „Pechvogel“: `PlayerStats.coinsLost` zählt nur noch Minus-Feld, Münzklau und Falle, keine Trophäenkäufe (`rules/stats.ts`); vorher bekam oft der Sieger den Titel | im PR |
| CHAOS-76 (Backlog CHAOS-44) | Grafik-Automatik: Schwelle folgt der erkannten Bildwiederholrate (`nature/refreshRate.ts`), 30-Hz-Fernseher bleibt bei `hoch`, solange die GPU mitkommt; KI-26 behoben | im PR, Prüfung an einem 30-Hz-Bildschirm offen (Checkliste N8) |
| CHAOS-75 (Backlog CHAOS-44) | Renderer-Spike: `?gpu=webgpu` am Brett, Bevy-Prototyp (WebAssembly + nativ) mit exportierter Brett-Szene, Recherche tvOS ([EXP-015](experiments.md), [ADR-016](decisions/ADR-016-renderer.md), [`renderer-spike.md`](renderer-spike.md)) | ADR-016 angenommen 2026-11-17; Mac-Zeilen R7–R11 gemessen, PC-Zeilen R1–R6 entfallen (CHAOS-131: kein PC, 17.11.) |
| CHAOS-53 (Backlog CHAOS-44) | Host-Bundle aufgeteilt: Arena, Brett, Minispiele als Chunks, Vorladen, `minigame-sdk` nebenwirkungsfrei, Budget `pnpm check:bundle` ([`performance.md` §3c](performance.md#3c-host-bundle-aufgeteilt-chaos-53), ADR-004 Nachtrag 1) | im PR |
| CHAOS-68 (Backlog CHAOS-44) | Auto-Pause endet erst mit `host-ready` (Bühne samt Figuren geladen), Rückfall nach 30 s; KI-6 behoben ([ADR-015 Nachtrag 3](decisions/ADR-015-vertical-slice.md)) | im PR |
| CHAOS-71 (Backlog CHAOS-44) | Siegerpodest ohne Standbild: Aufbau schon während der Trophäenzählung, Shader stückweise (`scene/prepareGradually.ts`), Übergang 35–110 ms statt Blöcken bis ≈ 1 s (SwiftShader, [EXP-021](experiments.md)) | im PR, LS3 auf Rubens PC offen |
| CHAOS-133 (Backlog CHAOS-44) | Perf-Baseline nach Natur-Look von Lobby und Podest (CHAOS-77) und Podest-Aufbau während der Zählung (CHAOS-71) neu geschrieben; `pnpm perf` auf `main` wieder grün ([`performance.md` §3d](performance.md#3d-nach-chaos-77-und-chaos-71-aktuelle-baseline)) | im PR |
| CHAOS-132 (Backlog CHAOS-44) | Minispiel-Bühne und Brett ohne Shader-Standbild: `prepareSceneGradually` mit vorab geladenen Shader-Quellen und eingeschaltetem Pre-Pass; Shader-Blöcke ≤ 0,14 s (`minimal`) bzw. ≤ 0,33 s (`hoch`) statt bis 1,8 s (SwiftShader, [EXP-025](experiments.md)) | im PR, N4 auf Rubens PC offen; Kontext-/Brett-Neuaufbau → CHAOS-152, Perf-Kennzahl → CHAOS-153 |
| CHAOS-152 (Backlog CHAOS-44) | Brett bleibt während des Minispiels eingehängt, ausgeblendet und angehalten; kein neuer Kontext und kein Brett-Neuaufbau nach jedem Minispiel; Stimmung der nächsten Runde lädt währenddessen ([EXP-029](experiments.md), [`performance.md` §3h](performance.md#3h-brett-bleibt-während-des-minispiels-eingehängt-chaos-152)) | im PR, N4 auf Rubens PC offen |
| CHAOS-78 (Backlog CHAOS-44) | RealityKit-App (`spikes/renderer-realitykit`): macOS, tvOS, iPhone/iPad nur als Benchmark; USDZ-Konverter, GPU-Instancing, Host-Client an `/ws` ([EXP-017](experiments.md)) | abgeschlossen: Apple TV 4K bei 4K 20 fps (R12), Mac R13/R14 gemessen; abgelöst durch ADR-019 (W2) und CHAOS-138 |
| CHAOS-139 (Epic CHAOS-137) | Apple-Host im Produktcode: `apps/apple-host` (JS-Kern als Workspace-Paket, Vertrag `src/contract.ts`, Beispielnachrichten, Swift-App für macOS/tvOS, Harness), `spikes/apple-host` entfernt ([ADR-019 Nachtrag 1](decisions/ADR-019-nativer-apple-host.md), [`apps/apple-host/README.md`](../apps/apple-host/README.md)) | im PR; Mac-Start + iPhone-Beitritt offen (Gerätecheckliste §22, AH1–AH6) |
| CHAOS-141 (Epic CHAOS-137) | JS-Kern: Minispiel-Aufbau über mehrere `tick` verteilt (`ctx.pace()` im minigame-sdk, alle Minispiele), Speicher über drei Partien im Harness ([EXP-024 Nachtrag](experiments.md), [ADR-012 Nachtrag 1](decisions/ADR-012-minispiele.md)) | im PR; Messung auf der echten Apple TV offen (Gerätecheckliste §20, TH5–TH6) |
| CHAOS-51 (Backlog CHAOS-44) | Zurückgestellte Balance-Ideen per Bot-Simulation ([EXP-019](experiments.md)): **Trostpreis** (1 Item für den letzten Minispiel-Platz) neuer Standard, am PC und Handy angezeigt; Stellschrauben `trophy.placement`, `items.minigameWinItems`, `items.shieldBlocksTrap` bleiben aus | im PR, Playtest offen |
| CHAOS-125 (Backlog CHAOS-44) | Rückenwind mit Ansage: eigener Münz-Grund `tailwind`, Karte „Rückenwind!“ am PC im Rundenende, Hinweis am Controller (Web und iPhone-App), Schalter `RUECKENWIND=1`; Standard bleibt aus ([EXP-022](experiments.md) Nachtrag) | im PR, Playtest mit `RUECKENWIND=1` offen (Checkliste Abschnitt 26) |
| CHAOS-127 (Backlog CHAOS-44) | Native Controller-App zeigt den **Trostpreis** im Minispiel-Ergebnis wie der Browser („Trostpreis: Falle“ mit Item-Symbol); `prizes` im Swift-Protokoll, Fixture `context-minigame-results-prize`, Beispielzustand `minigameConsolation`; CI „Native Apps“ fotografiert ihn (`scripts/screenshots.sh`) | im PR, Gerätetest NT1–NT2 offen |
| CHAOS-65 (Backlog CHAOS-44) | Aufholhilfe: Trophäen-Ziel `trophy.placement: 'nearest-to-last'` (neu, Standard) und Münz-Hilfen `RuleSet.catchUp` (Rabatt, Rückenwind, Finale-Fieber, Standard aus), Simulation mit 1000 Seeds; neuer Standard: Trophäe wandert vor die Letzten ([EXP-022](experiments.md)) | im PR, Gefühl im Playtest offen |
| CHAOS-122 (Backlog CHAOS-44) | Hinweiston beim Angriff: kurzes, selbst erzeugtes „ding-ding“ (Web Audio, `apps/controller/src/board/alertTone.ts`) nur am Controller der angegriffenen Person, erst nach der ersten Berührung, einmal je Prompt, `audioSession` „ambient“ (Stumm-Schalter gilt); geteiltes iPad: Ton plus gelb blinkender Rahmen der angegriffenen Zone | im PR, Gerätetest B4a/B4b offen |
| CHAOS-158 | `PERF_STRICT=1` vergleicht den **Heap nach GC** je Szene statt des Heap-Höchstwerts (schwankte im selben Stand bis +130 %, jetzt ≤ 2 MB); p95-Vergleiche erst ab 25 Bildern je Szene; Baseline neu ([`performance.md` §3f](performance.md#3f-heap-nach-gc-statt-heap-höchstwert-chaos-158)). Offen: Render-Zeit p95 Sockenregen (CHAOS-165) | im PR |
| CHAOS-165 (Backlog CHAOS-44) | `PERF_STRICT=1` vergleicht Bildabstand und Render-Zeit als **Median** ab 25 Bildern, p95 erst ab 100 Bildern (unter SwiftShader nur noch im Brett); Render p95 Sockenregen schwankte bei ≈ 30 Bildern 14–47 ms. Zwei Strict-Läufe in Folge grün, Unit-Tests `tests/perf/report.test.ts` ([`performance.md` §3g](performance.md#3g-median-statt-p95-bei-szenen-unter-100-bildern-chaos-165)) | im PR |
| CHAOS-153 (Backlog CHAOS-44) | `pnpm perf` misst das Standbild je Szenenwechsel: Marken `aufbau`/`sichtbar`/`erstes-bild` an Brett, Minispiel-Bühne und Podest plus Long Tasks (nur `?debug=1`, `debug/sceneMarks.ts`, `debug/transitions.ts`), Tabelle „längster Block je Übergang“, Baseline-Szenario `partie-uebergaenge`, Vergleich mit `PERF_STRICT=1` ([`performance.md` §3e](performance.md#3e-standbild-je-szenenwechsel-chaos-153)) | im PR |
| CHAOS-134 (Backlog CHAOS-44) | Wackelnder E2E `m2-brett-durchstich`: Ursache gemessen (Bühne unter SwiftShader 3–5 s nach Spielstart bereit, Bilder bis 11 s, Minispiel-Uhr holt je Bild nur 4 s nach → Ergebnis nach der 15-s-Frist, Server bricht ab); Test mit 60-s-Ergebnisfrist, `aborted = false` bleibt geprüft; KI-25 ergänzt | im PR |

### Messwerte Performance (CHAOS-39)

SwiftShader (Xeon 2,3 GHz ×4, Chromium 153 headless, 1280×720, Seed 2026, 4 Bots) – nur relativ, keine Aussage über echte Hardware. Historie (altes Brett aus Grundkörpern, vor CHAOS-62):

| Szene | Bildabstand p50/p95 ms vorher → nachher | Draw Calls | Render-Schleifen |
|---|---|---|---|
| Brett | 217/576 → 162/453 (im Rauschen) | 187 → 150 | 1 |
| Finale (Brett dahinter) | 244/922 → kein Bild mehr | 184 → – | 2 → 1 |
| Podest | 351/902 → 100/226 | 71 | 2 → 1 |

Revanche ×3: Heap nach GC 20,0 → 21,3 MB, kein Leck. Server `board` ≈ 0,5/s à 1,4 kB. Hardware-Schwellen offen (Gerätecheckliste PF0–PF10). Details: [`performance.md`](performance.md).

Nach CHAOS-62 (Natur-Look, Sparstufe `minimal` bei Software-Rendering in halber Auflösung; Baseline `tests/perf/baseline.json` neu geschrieben):

| Szene | Bildabstand p50/p95 ms | Draw Calls | Render-Schleifen | Heap max MB |
|---|---|---|---|---|
| Brett | 204/899 | 256 (Bäume je Baum verformt, nicht instanzierbar; Schattenpass) | 1 | 194 |
| Minispiele | 223–322 / 507–892 | 205–260 (Natur-Kulisse) | 1 | 90–120 |
| Finale (Brett dahinter) | kein Bild | – | 1 | 175 |
| Podest | 63/106 | 71 | 1 | 130 |

Render-Pause hinter dem Finale und Messung je Szene funktionieren mit dem Natur-Brett; Revanche ×3: Heap nach GC 21,9 → 23,1 MB, kein Leck. Details: [`performance.md` §3a](performance.md#3a-nach-chaos-62-natur-look).

Nach CHAOS-77/CHAOS-71 (Lobby und Podest im Natur-Look, Podest entsteht während der Zählung; Baseline neu, CHAOS-133, anderer Messrechner Xeon 2,1 GHz ×4): Lobby 134 Draw Calls (vorher 70), Podest 162 (71), Brett und Minispiele unverändert bzw. in der Toleranz, Finale Heap max ≈ 223 MB, je Szene weiter eine Render-Schleife; Revanche ×3 Heap nach GC 37,8 → 51,4 MB, kein Leck. Details: [`performance.md` §3d](performance.md#3d-nach-chaos-77-und-chaos-71-aktuelle-baseline).

### Seeds (M4)

| Wo | Seed |
|---|---|
| E2E-Gesamtablauf (`m4-gesamtablauf.spec.ts`) | 2026, schnelles Test-Pacing, Minispiele 6 s |
| Server-Integration (Reconnect, Host-Verlust, gemischt, Determinismus, Fuzz) | siehe [`testing.md`](testing.md) (u. a. `INTEGRATION_SEEDS`, 424242, 99, Fuzz 1/2/3/2026) |
| Experimente EXP-011 … EXP-013 | Seeds 1–200 je Spielerzahl (`EXPERIMENTS=m4 …`) |
| Experiment EXP-016 (Kuckucks-Klatsche, CHAOS-54) | Seeds 1–300 je Zeile (`EXPERIMENTS=1 … experimentKuckuck`) |
| Experiment EXP-019 (Balance-Ideen, CHAOS-51) | Seeds 1–200 je Zeile (`EXPERIMENTS=balance … experimentsBalance`) |
| Experiment EXP-023 (Krümel-Kehraus, CHAOS-79) | Seeds 1–150 je Zeile (`EXPERIMENTS=1 KRUEMEL_SEEDS=150 … experimentKruemel`, in Teilen: `KRUEMEL_TABLES`, `KRUEMEL_ONLY`) |
| `pnpm perf` | 2026 |

### Seeds (M3)

| Wo | Seed |
|---|---|
| Server-Integration Brett ↔ Minispiel | 424242 + Spielerzahl (je Minispiel der Rotation), 20261115/7 für Fehlerfälle |
| Vertragsprüfung je Minispiel (`catalog.test.ts`) | 1000 + Spielerzahl, Bots mit Seed = Spielerzahl |
| Screenshot-Regression Minispiele | `seed=7`, vier Spieler, 120 feste Schritte |
| Experimente EXP-005 … EXP-007 | siehe `docs/experiments.md` |

### Seeds M2 (reproduzierbar)

| Wo | Seed |
|---|---|
| Server-Integrationstests (`apps/server/src/boardGame.integration.test.ts`) | 20261115 (2 Spieler), 7 (3 Spieler, auch Reaktionstest mit 10 Runden), 424242 (4 Spieler) |
| E2E-Brettspiel (`tests/e2e/fixtures/server.ts`) | `E2E_GAME_SEED = 2026` |
| Experimente (`EXPERIMENTS=1 …`) | 1–200 je Variante und Spielerzahl |
| Echte Partie | Terminal zeigt „Seed <Zahl>“; nachspielen mit `SEED=<Zahl> pnpm start` |

## M5 – Aufgaben

Inhalt ist das Epic CHAOS-137 (ADR-019). Am 2026-11-19 orchestriert mit Workern in eigenen Worktrees, ein PR je Aufgabe, Merge nach grüner CI (Ruben, 19.11.: „Ja, selbst mergen“).

| Aufgabe | Inhalt | Stand |
|---|---|---|
| CHAOS-138, CHAOS-139, CHAOS-140, CHAOS-141, CHAOS-149, CHAOS-151, CHAOS-157, CHAOS-161, CHAOS-162, CHAOS-171 | Spike, Produktcode, USDZ-Assets, Aufbau verteilt, Darstellungsvertrag, TestFlight, Sabotage-Ansage, Figuren | erledigt (bis 18.11.) |
| CHAOS-142 | Lobby und Brett mit echter Grafik | erledigt (PR #80) |
| CHAOS-166 | Lobby: Rundenwahl, „Mehr Zeit zum Reagieren“ | erledigt (PR #92) |
| CHAOS-176 | Lokaler Mac-Build startet unter macOS 27 (Sparkle, Library Validation) | erledigt (PR #93) |
| CHAOS-143 | Brett-Regie über den geteilten Regisseur, HUD, Popups, Kamera, Klänge | erledigt (PR #94) |
| CHAOS-144 | Alle fünf Minispiele mit echter Grafik, Anleitung, HUD, Ergebnis (Geometrie-Export, ADR-019 Nachtrag 5) | erledigt (PR #95) |
| CHAOS-145 | Finale mit Podest, Pause, Wiederverbindung, Hintergrund, Revanche | erledigt (PR #97) |
| CHAOS-190 | Minispiel-Klänge | erledigt (PR #96) |
| CHAOS-193, CHAOS-192 | Lichtstimmung je Runde, Flug-Effekte, Minispiel-Kulisse, Aufwärmen | erledigt (PR #100) |
| CHAOS-201 | RealityKit-Prüfung der Assets unter macOS 27 | erledigt (PR #103) |
| CHAOS-191 | Gemeinsame Figurenbibliothek für Brett, Minispiel und Podest (Backlog CHAOS-44): jede Figur nur einmal geladen, im tvOS-Simulator Speicherspitze 317/321 → 274 MB | erledigt (PR #107) |
| CHAOS-146 | Gesamtlauf: tvOS-Simulator und Mac mit Bots (EXP-031), Gerätecheckliste §34 | Simulator/Mac erledigt; echte Apple TV bei Ruben |
| CHAOS-160, CHAOS-169 | **Ruben:** TestFlight auf der Apple TV, Messung Minispiel-Start/-Ende auf dem Gerät | offen |
| CHAOS-164 | **M5-Abnahme (Ruben)** | offen |
| CHAOS-172 | Feinstruktur der Figuren als Normal-Textur (Strick, Fell, Lack, Kaktushaut; EXP-032), aus dem Backlog von Ruben direkt beauftragt | PR offen; RealityKit am Mac offen (Gerätecheckliste §35) |
| CHAOS-214 | Minispiel-Anleitung wartet auf „Bereit“ aller (Ruben, 20.11., direkt beauftragt); ADR-012 Nachtrag 5 | PR offen; native Apps am Mac und echte Handys offen (Gerätecheckliste §39) |

## Validierte Befehle

Stand 2026-11-15 (M4), lokal Node 22 / pnpm 10.28; CI Node 24 (`.nvmrc`), `ubuntu-latest`.

| Befehl | Ergebnis |
|---|---|
| `pnpm play` | ein Befehl: installiert/baut bei Bedarf, startet Port 8787, öffnet den Host (`OPEN=0` ohne Browser, `--rebuild`); frischer Klon bis `/health` ≈ 8 s (Linux) |
| `pnpm check:bundle` | ok (2026-11-20, CHAOS-86) – nach `pnpm build`: Host-Start 6 Dateien, 420 kB (gzip 135 kB), Budget 520 kB / höchstens 10 Dateien, keine Babylon-Engine; Minispiel-Bühne 2.568 kB ohne Spiel, je Minispiel ein eigener Chunk (31–87 kB); läuft in `pnpm check` und CI |
| `pnpm check` + `pnpm test:e2e --trace off` (CHAOS-53) | ok (2026-11-17) – 1472 Tests in 124 Dateien; E2E 157 bestanden, 3 bewusst übersprungen, ≈ 5,5 min |
| `apps/apple-host`: `prepare.sh` + macOS-/tvOS-Build, App mit `--autostart --bild=…` und zwei Bot-Controllern (CHAOS-142) | ok (2026-11-18, M3 Max) – Lobby, Brett mit Figuren, Zug sichtbar; tvOS-Simulator 4K über 1080p; Harness `full`, Selbsttest und `RELEASE_DRY_RUN=1` grün |
| `pnpm build:apple-assets` (CHAOS-140) | ok (2026-11-17, Linux-Container) – 4 Figuren + Brett nach `build/apple-assets/` in ≈ 3 min, usd-core-Prüfung grün (43 Feld-Anker, 7 Clips je Figur); RealityKit-Prüfung nur am Mac |
| `pnpm generate:props` / `pnpm check:assets` (CHAOS-88) | ok (2026-11-20, M3 Max) – 27 Requisiten in ≈ 3 s gebaut, Kontaktbogen mit `--vorschau` ≈ 25 s; Prüfung: je Requisit 3,7–111 KiB, je Pilot-Spiel 46–282 KiB (Budget 512 KiB), Ladetest 1–6 ms je Spiel |
| `pnpm smoke` | ok – Rauchtest des Start-Ablaufs nach `pnpm build` (≈ 1–6 s), läuft in CI |
| `pnpm check` (M4, nach Merge von `main` mit CHAOS-62; CHAOS-41-Fix) | ok – 1420 Tests in 120 Dateien, 13 Laufzeit-Pakete, 51 Asset-Einträge (Porträts als WebP + Masken, Natur-Texturen und Himmel) |
| `pnpm test:e2e --trace off` (M4) | ok – 154 bestanden, 3 bewusst übersprungen, ≈ 5 min; mit Natur-Brett `m4-gesamtablauf host-pause host-finale` 2× hintereinander grün |
| CI-Nachstellung (CHAOS-41) | `CI=1 taskset -c 0-1 pnpm exec playwright test m2-brett-durchstich m4-gesamtablauf --project=chromium --repeat-each=5`: vorher 4 von 6 Läufen rot (Anleitung nicht gesehen, Podest „loading“, Revanche verloren), nach dem Fix 15/15 grün; `controller-m4` Endstand mit ±0,1–0,3 px Zeichenabstand stabil |
| Umbruchkanten Minispiel-Controller (CHAOS-72) | `pnpm exec playwright test tests/e2e/controller-minispiel.spec.ts` mit testweise `body { letter-spacing: −0,3 / −0,1 / +0,1 / +0,3 px }` vor jedem Screenshot: je 12/12 grün (vorher `minispiel-intro-iphone-hoch` bei −0,1 px 11 % und `ipad-hoch-minispiel-intro` bei +0,1 px 17 % Abweichung); `expectStableWrapping` prüft das jetzt in jedem Lauf |
| `pnpm perf` | ok – Messläufe Partie + Revanche ×3 gegen Baseline, ≈ 6–7 min (nicht in CI); Baseline nach CHAOS-62 neu geschrieben |
| `E2E_SKIP_BUILD=1 PERF_GPU=1 PERF_VIEWPORT=1920x1080 PERF_DPR=1 pnpm perf -g Partie` | ok (2026-11-16, CHAOS-73, M3 Max) – Partie auf echter GPU im sichtbaren Fenster ohne VSync, ≈ 3 min; Brett 5,5 ms Median (vorher 26 ms), siehe [`performance.md` §3b](performance.md#3b-erste-messung-auf-echter-gpu-chaos-73) |
| `node scripts/spike-export-board.mjs` | ok (2026-11-16, CHAOS-75) – exportiert das Brett (Stufe `hoch`) nach `spikes/renderer-bevy/assets/export/`, ≈ 2–3 min unter Software-Rendering |
| `cd spikes/renderer-bevy && cargo build --release` / `./build-web.sh` | ok (2026-11-16, CHAOS-75, Rust 1.100, Bevy 0.20.1) – Erst-Build ≈ 10 min nativ, ≈ 8 min je WebAssembly-Variante; Messung nur auf echter Hardware ([`renderer-spike.md`](renderer-spike.md)) |
| `node scripts/fetch-lookdev-assets.mjs && node scripts/spike-export-board.mjs`, dann `glb_to_usdz.py` für Brett und Figur | ok (2026-11-17, CHAOS-119, Linux-Container) – 46 Texturen, Export ≈ 2:45 min, `brett.usdz` 25,6 MB wie unter macOS; `xcrun`-Schritte und Archivieren nur auf dem Mac/Runner |
| `spikes/renderer-realitykit/convert/convert.sh`, `xcodegen generate`, `xcodebuild … -destination 'platform=macOS' / 'generic/platform=iOS Simulator' / 'generic/platform=tvOS Simulator'` | ok (2026-11-16, CHAOS-78, Xcode 27, bpy 5.3.0 mit Python 3.13 über uv) – siehe [`spikes/renderer-realitykit/README.md`](../spikes/renderer-realitykit/README.md) |
| `EXPERIMENTS=m4 pnpm exec vitest run packages/game-core/src/rules/experimentsM4.test.ts --silent=false` | Tabellen für EXP-011 (mit Nachtrag CHAOS-66) … EXP-013, ≈ 19 s |
| `EXPERIMENTS=balance pnpm exec vitest run packages/game-core/src/rules/experimentsBalance.test.ts --silent=false` | Tabellen für EXP-019, ~8 s |
| `EXPERIMENTS=catchup pnpm exec vitest run packages/game-core/src/rules/experimentsCatchUp.test.ts --silent=false` | ok (2026-11-17, CHAOS-65) – Tabelle für EXP-022, 1000 Seeds je Zeile, ≈ 2 min |
| `pnpm check` (2026-11-17, CHAOS-69) | ok – 1475 Tests in 125 Dateien; `pnpm build` schreibt `LICENSE.txt` + `THIRD-PARTY-NOTICES.txt` in alle 3 Builds, `check:licenses` meldet „Lizenzhinweise ok: 3 Builds“ (fehlende/veraltete Datei → Fehler, gegengeprüft), 51 Asset-Einträge mit `GPL-3.0-only` |
| `pnpm --filter @chaos-party/apple-host bots --full` | ok (2026-11-17, CHAOS-139, Linux) – JS-Kern-Bündel im nackten `node:vm`-Kontext: 10 Runden, alle 5 Minispiele der Rotation, 10/10 Ergebnisse angenommen, `renderState` vertragsgemäß, ≈ 19 s; läuft in CI |
| `pnpm --filter @chaos-party/apple-host bots --full --matches 3` | ok (2026-11-18, CHAOS-141, Linux) – drei ganze Partien mit Revanche, je 10/10 Ergebnisse angenommen; Heap nach `gc()` 31,0 → 32,3 → 32,7 MB, `external` 28,5 MB gleich, Zuwachs +1,7 MB (Grenze 20 MB), wartende Zeitgeber 2/2/2; ≈ 36 s; läuft in CI statt `bots --full` |
| `pnpm --filter @chaos-party/apple-host bots --full --rueckenwind` | ok (2026-11-19, CHAOS-188, Linux) – ganze Partie mit Regel Rückenwind (`HostEnv.tailwind`): Rückenwind-Karte (`board.hud.tailwind`) ab Runde 6 bzw. 8 (je nach Ablauf), 10/10 Ergebnisse angenommen, ≈ 20 s; ohne die Regel erscheint sie nie (beide Fälle prüft `ok`); läuft in CI |
| `apps/apple-host/harness/run.sh full` | dieselbe Partie in JavaScriptCore (nur macOS, CI-Job „Native Apps“ mit `JSC_useJIT=false`) |
| `node scripts/export-apple-host-fixtures.mjs [--check]` | Beispielnachrichten `renderState` für Swift schreiben bzw. prüfen (CHAOS-139) |
| `apps/apple-host/scripts/sparkle-feed.sh` | Sparkle-Feed: Zip mit `sign_update` signieren, Signatur gegen den Schlüssel der App prüfen, signierte `appcast.xml` schreiben (nur macOS; Release-Workflow und CI mit Wegwerf-Schlüssel, CHAOS-156) |
| `RELEASE_DRY_RUN=1 apps/apple-host/scripts/release-macos.sh` | Mac-App ad hoc mit Hardened Runtime archivieren, prüfen und `--selftest` starten (nur macOS, CI-Job „Native Apps“); ohne `RELEASE_DRY_RUN` mit Developer ID, Notarisierung und Heften (CHAOS-118, Workflow `release-macos.yml`) |
| `pnpm notices` | Lizenzhinweise in vorhandene `apps/*/dist` schreiben (läuft am Ende von `pnpm build`, ADR-018) |
| `pnpm vitest run --project @chaos-party/minigame-kit` | ok (2026-11-20, CHAOS-83) – 60 Tests der Baukasten-Helfer (rein und Babylon/NullEngine) in unter 2 s |
| `pnpm install --frozen-lockfile` | ok |
| `pnpm check` (typecheck, lint, format, test, build, Lizenzen, Assets) | ok – 1098 Unit-/Integrationstests, 12 Laufzeit-Pakete auf der Positivliste, 22 Asset-Einträge |
| `pnpm test:e2e --trace off` | ok – 108 Tests in 15 Specs (Desktop, iPhone hoch/quer, iPad quer/hoch), ~3,5 min |
| `pnpm check:assets` / `pnpm generate:assets` | Asset-Manifest prüfen / Figuren und Porträts neu erzeugen (Blender-venv, ADR-013) |
| `pnpm --filter @chaos-party/assets import:polyhaven` | ok (2026-11-15, CHAOS-62) – 18 Natur-Texturen (512²-WebP) und 6 Himmel (512 × 256-HDR) von Poly Haven, ≈ 5 s, braucht ImageMagick mit WebP |
| `/host/?qualitaet=<stufe>&stimmung=<id>` | Lobby (bzw. mit `local=1` die Arena) im Natur-Look mit fester Stufe; ohne `stimmung` Goldene Stunde (CHAOS-77) |
| `/host/?local=1&board=1&qualitaet=<hoch\|mittel\|niedrig\|minimal>&stimmung=<id>` | Brett im Natur-Look mit fester Grafikstufe und Lichtstimmung (CHAOS-62); ohne `qualitaet` startet `hoch` mit Automatik; ohne `stimmung` folgt das Licht der Runde (CHAOS-63) |
| `packages/assets/blender/portraits-all.sh` | ok (2026-11-15, CHAOS-61) – vier Porträts + Masken in ≈ 40 s (Cycles CPU), 7–12 KiB je Bild |
| `/host/?local=1&minigame=<id>&players=4` | Minispiel ohne Server mit Tastatur (`&flow=1` mit Anleitung und Ergebnis, `&repeat=1` mit kurzer Anleitung wie bei einer Wiederholung, CHAOS-66) |
| `lookdev.html?look=natur-<morgen\|mittag\|wolken\|abend\|daemmerung\|nacht>&shot=<brett\|figur\|minispiel>` | Look-Dev-Vitrine (Dev-Server, vorher `node scripts/fetch-lookdev-assets.mjs`); `&tune={…}` überschreibt Felder einer Lichtstimmung |
| `PRUEFBERICHT=1 pnpm exec vitest run packages/minigames/src/checks --silent=false` | ok (2026-11-20, CHAOS-84) – Prüfbericht aller Rotationsspiele, 200 Seeds je Tisch, ≈ 4 min |
| `EXPERIMENTS=1 pnpm exec vitest run packages/game-core/src/rules/experiments.test.ts --silent=false` | ok – Tabellen für EXP-001 … EXP-004, ~7 s |
| `ROUNDS=3 SEED=2026 pnpm start` | Brettspiel mit 3 Runden und festem Seed; Terminal meldet den Seed beim Start |
| `pnpm build && pnpm start` | Host `http://localhost:8787/host/`, Controller `/`, WebSocket `/ws`; Terminal zeigt LAN-Link, Join-Code, QR |
| `pnpm dev` | Host :5173/host/, Controller :5174 (beide leiten `/ws` an :8787 weiter), Server :8787 |
| Manueller Durchstich (Koordinator, Chromium-Emulation) | Host + 2 iPhone-Seiten + iPad (2 Zonen) gegen echten Server: Join, Bereit, Start, Joysticks bewegen je die eigene Figur, keine Seitenfehler |

Details: [`testing.md`](testing.md).

## Arbeitsartefakte

| Datei | Zweck |
|---|---|
| [`assumptions.md`](assumptions.md) | Annahmen mit Validierungsweg und Stand |
| [`decisions/`](decisions/README.md) | ADR-001 … ADR-015 |
| [`experiments.md`](experiments.md) | Experiment-Log (EXP-001 … EXP-004 aus M2, EXP-005 … EXP-007 aus M3) |
| [`testing.md`](testing.md) | Test-Suiten, Ausführen, Baselines, Abdeckung je M1-Lieferumfang |
| [`m1-demo.md`](m1-demo.md) | M1 auf echten Geräten ausprobieren |
| [`device-test-checklist.md`](device-test-checklist.md) | Gerätecheckliste für die Abnahme (offen) |
| [`network-setup.md`](network-setup.md) | Firewall, WLAN, Adresswahl |
| [`ipad-zonen.md`](ipad-zonen.md) | Geteiltes iPad: Layouts und Grenzen |
| [`acceptance/M1.md`](acceptance/M1.md) | Abnahmebericht M1 |
| [`m2-demo.md`](m2-demo.md) | M2-Brettspiel ausprobieren |
| [`acceptance/M2.md`](acceptance/M2.md) | Abnahmebericht M2 (APPROVED) |
| [`m3-demo.md`](m3-demo.md) | M3-Minispiele ausprobieren |
| [`acceptance/M3.md`](acceptance/M3.md) | Abnahmebericht M3 (APPROVED) |
| [`art-direction.md`](art-direction.md) | Stil-Leitfaden, Figuren |
| [`m4-demo.md`](m4-demo.md) | M4: komplette Partie auf echten Geräten |
| [`acceptance/M4.md`](acceptance/M4.md) | Abnahmebericht M4 (offen) |
| [`known-issues.md`](known-issues.md) | Bekannte Probleme des Release Candidate |
| [`security-license-review.md`](security-license-review.md) | Sicherheits-, Lizenz- und Secret-Prüfung |
| [`performance.md`](performance.md) | Messmethode, Messwerte, Schwellen |
| [`renderer-spike.md`](renderer-spike.md) | Renderer-Spike CHAOS-75: Anleitung und Messbogen |
| [`../LICENSE`](../LICENSE) | Projektlizenz GPL-3.0-only (Code und eigene Assets, ADR-018, CHAOS-69) |
| `blockers.md` | nicht nötig (keine Blocker) |

## Nächste Schritte

0. **M5-Abnahme (CHAOS-164):** Ruben spielt eine Partie auf der echten Apple TV und am Mac mit iPhones nach Gerätecheckliste §34 (CHAOS-204) und entscheidet dann über das Gate. Bericht: [`acceptance/M5.md`](acceptance/M5.md), Messwerte aus Simulator und Mac in EXP-031. Vorbeugend erledigt: CHAOS-205 (Aufbau-Budget je Tick, ADR-012 Nachtrag 3), CHAOS-206 (Spielende an der Frist des Servers ausgerichtet, ADR-012 Nachtrag 2) und CHAOS-209 (kleine Bauschritte, kein Bild der Anleitung über 16,7 ms in der Interpreter-Näherung; Swift-Harness-Messung am Mac offen, ADR-012 Nachtrag 4).
   - **CHAOS-223 (2026-11-20):** Echte Klänge statt Synthese: 40 CC0-Aufnahmen (Kenney, freesound.org) in `packages/assets/sounds/`, eine Wahl für PC- und Apple-Host (`apps/host/src/fx/samples.ts`), Rezepte als Rückfall, ADR-019 Nachtrag 6, EXP-035. Offen: Rubens Hörprobe am Fernseher (Gerätecheckliste §44).
1. M4-PR [#16](https://github.com/rubenvitt/chaos-party/pull/16) mergen (nach CI). Stand von `main` (CHAOS-60, CHAOS-61, CHAOS-64, CHAOS-62) ist eingemischt: Die Figurenwahl im Controller, die Plakette und der Endstand zeigen die neuen Blender-Porträts (Plakette mit der gewählten Figur), die M4-E2E-Tests öffnen Controller-Geräte im Chromium ohne GPU (`deviceBrowser`). Das Brett im Natur-Look (CHAOS-62) behält die M4-Fähigkeiten: Render-Pause hinter Trophäenzählung/Podest, Messung je Szene, gewählte Figuren und Revanche; die Minispiel-Bühne verbindet `ctx.look`/Grafikstufen mit der Pause (ADR-015).
2. **Performance auf echter Hardware (höchste Priorität):** Ruben erlebt die Partie als „hakelig langsam“. Erst messen (`?debug=1` → „Alle Szenen kopieren“, Checkliste PF0–PF10, N1–N7), dann die Ursache beheben (CHAOS-73; Kandidaten in [`performance.md`](performance.md) §3a, Podest CHAOS-71). Offen bleibt der iPad-Nachtest CHAOS-47 (Checkliste Abschnitt 4).
3. Grafik-Neuausrichtung CHAOS-56 läuft getrennt weiter: Look-Dev abgeschlossen (EXP-008, EXP-009; PR #7, #8). Figuren neu aus Blender-Skripten (CHAOS-58, ADR-013), von Ruben abgenommen. Controller-UI „Glas & Licht“ umgesetzt (CHAOS-59). Porträts der neuen Figuren in Lobby und Controller (CHAOS-61, Blender-Render, `docs/screenshots/chaos61-portraets.jpg`). Lichtstimmungen als Daten (`apps/host/src/lighting/moods.ts`, CHAOS-60, EXP-010): sechs Stimmungen inkl. Dämmerung und Nacht (Laternen, Glühwürmchen, leuchtende Felder), Ruben wählte den Lichtwechsel im Lauf der Partie (Runde 1 morgens, letzte Runde nachts). Natur-Look im Spiel erledigt (CHAOS-62, ADR-014): Modul `apps/host/src/nature/`, Brett als Insel mit Baumscheiben-Feldern (`board/natureBoard.ts`), Minispiele über den optionalen Vertrag `ctx.look` (Kulisse, PBR-Materialien), CC0-Texturen und -Himmel im Asset-Paket, Grafikstufen `hoch`/`mittel`/`niedrig` mit Automatik und Sparstufe `minimal` (Testmodus, Software-Rendering). Bilder: `docs/screenshots/chaos62-*.jpg`. Offen: Bildrate am Ziel-PC (Gerätecheckliste N1–N7). Lichtverlauf je Runde umgesetzt (CHAOS-63): Partie als Tag von Morgen bis Nacht, 4 s Überblendung beim Rundenwechsel ohne Nachladen, Minispiele erben die Runden-Stimmung, HUD nachts hell; Bild `docs/screenshots/chaos63-lichtverlauf.jpg`, Gerätetest Checkliste Abschnitt 14 (L1–L7). Lobby-Arena und Siegerpodest im Natur-Look (CHAOS-77): gemeinsame Bühnen-Kulisse `nature/stageLook.ts`, Lobby fest in der Goldenen Stunde (Baumstamm-Banden, Baumstumpf-Pfosten), Siegerehrung fest nachts (Holzpodest, leuchtende Slot-Deckel, Spot, Laternen), CSS-Hintergründe passend; Bilder `docs/screenshots/chaos77-*.jpg`, Gerätetest Checkliste Abschnitt 15 (LS1–LS5). Wackelnder E2E-Test „geteiltes iPad: zwei Finger steuern zwei Figuren“ behoben (CHAOS-64): Controller-Geräte laufen im Test in einem eigenen Chromium ohne GPU (siehe `docs/testing.md`).
4. **Renderer (CHAOS-75 abgeschlossen):** Ruben hat [ADR-016](decisions/ADR-016-renderer.md) am 2026-11-17 angenommen. Am PC bleibt es bei Babylon.js mit WebGL2, `?gpu=webgpu` bleibt ein Mess-Schalter (zeichnet seit CHAOS-117 auf allen Stufen; R8 am Mac ohne Vorteil), tvOS läuft über CHAOS-78. Die PC-Zeilen R1–R6 entfallen (**CHAOS-131** verworfen, 17.11.: Ruben hat keinen PC zum Messen); ADR-016 stützt sich auf die Mac-Messung in [`renderer-spike.md`](renderer-spike.md).
   - **CHAOS-114:** Die Apple TV ist bei 4K pixelgebunden (20 fps). Die Spike-App hat jetzt einen hochskalierten Pfad (`--hochskalieren=1`: interne Auflösung, MetalFX Spatial/bilinear) und Diagnose-Schalter. `messreihe-atv.sh` misst alle Varianten auf einen Schlag. Am 17.11. auf der echten Apple TV gemessen (EXP-020, R16–R20): MetalFX ist auf tvOS 27.3 nicht verfügbar; **intern 1920×1080, MSAA aus, drei Bilder im Flug, bilinear → 60 fps bei 4K** mit voller Szene. Offen: Rubens Schärfe-Urteil am Fernseher (RK11).
   - **CHAOS-119:** Workflow `testflight-tv.yml` lädt den RealityKit-Spike bei Änderungen in `spikes/renderer-realitykit/` (oder manuell) zu TestFlight hoch und erzeugt die Testszene dabei selbst. Offen bei Ruben: App-Eintrag `dev.rubeen.chaosparty.tv` (tvOS) in App Store Connect anlegen, ersten Lauf manuell starten, Installation auf der Apple TV prüfen (Gerätecheckliste §20, TV1–TV5).
   - **CHAOS-151:** `testflight-tv.yml` lädt jetzt den nativen Host (`apps/apple-host`, `scripts/testflight.sh`) unter `dev.rubeen.chaosparty.tv` hoch, bei Änderungen am Host oder an seiner Nutzlast (Server, Host-Rolle, Controller, Pakete). Nutzlast über `prepare.sh`, Abbruch ohne JS-Kern/Havok/Controller (vor dem Archiv und im Archiv). Die tvOS-Icons liegen jetzt beim Host. Die Mac-App kommt signiert aus `release-macos.yml` (CHAOS-118). Messvarianten (CHAOS-147) nicht übernommen; ältere Spike-Builds bleiben in TestFlight wählbar. Offen bei Ruben: Gerätecheckliste §20, TH1–TH4 (Apple TV ohne Rechner, iPhone per QR).
   - **CHAOS-200 (2026-11-19):** App Store Connect eingerichtet: App-Eintrag „Chaos Party Host“ (`dev.rubeen.chaosparty.tv`, tvOS + macOS, „Chaos Party“ war als Store-Name vergeben), interne TestFlight-Gruppe „Intern“ mit Ruben; der erste Apple-TV-Build (20261119.1610) ist hochgeladen. Neu: Mac-App über TestFlight als App-Store-Variante (Ziel `ChaosHostAppStore`: App Sandbox, ohne Sparkle, Mac-Icon), `scripts/testflight-macos.sh` und Workflow `testflight-macos.yml`; Selbsttest in der Sandbox grün. Der Developer-ID-Kanal mit Sparkle bleibt unverändert. Offen bei Ruben: Gerätecheckliste §20 TH2–TH4 (Apple TV) und TM1–TM2 (Mac).
   - **CHAOS-147:** In der TestFlight-App öffnet Play/Pause ein Menü mit den Messvarianten (nativ, hochskaliert ×0,5/×0,667, MetalFX/bilinear). Die Wahl baut Szene und Messung neu auf, bleibt in `UserDefaults` und gilt nur bei Starts ohne `--`-Parameter, `messreihe-atv.sh` misst also unverändert. Logik geprüft mit `tests/main.swift` (CI, macOS). Build für macOS, iOS und tvOS in der CI grün (PR #49), Gerätecheck §20 TV6–TV9.
   - **CHAOS-139:** Der Apple-Host ist Produktcode (`apps/apple-host`). Offen bei Ruben: App am Mac starten und mit einem echten iPhone per QR beitreten (Gerätecheckliste §22, AH1–AH6). Danach CHAOS-141 (98-ms-Spitze, Speicher) und CHAOS-142 (Lobby und Brett mit echter Grafik, hochskalierter 4K-Pfad); CHAOS-118 (Mac-App notarisiert) ist frei.
   - **CHAOS-141:** Der Minispiel-Aufbau im JS-Kern läuft über mehrere `tick` (`ctx.pace()`, 2 ms je Bild). Im Harness als reiner Interpreter (Näherung an JavaScriptCore ohne JIT) sinkt das längste Bild am Wechsel Brett → Minispiel von 330 auf 19 ms; der Speicher wächst über drei Partien um 1,7 MB. Offen bei Ruben: Messung auf der echten Apple TV (Gerätecheckliste §20, TH5; TH6, sobald die App eine Revanche anbietet). Der PC-Host nutzt den Taktgeber noch nicht.
   - **CHAOS-118:** Release-Pipeline für die Mac-App steht (`apps/apple-host/scripts/release-macos.sh`, Workflow `release-macos.yml`, ADR-019 Nachtrag 3): Developer ID, Hardened Runtime, Notarisierung, Heften, GitHub-Release `macos-v0.1.N` bei Push auf `main`. Die CI prüft bei jedem PR einen ad-hoc-signierten Probelauf samt Selbsttest der fertigen App. Offen bei Ruben: Secrets `MACOS_CERTIFICATE_P12` und `MACOS_CERTIFICATE_PASSWORD` setzen, ersten Lauf abwarten, Test auf einem fremden Mac (Gerätecheckliste §25, MA1–MA6).
   - **CHAOS-156:** Die Mac-App aktualisiert sich selbst (Sparkle 2.10.1, ADR-019 Nachtrag 4). Der Release-Workflow signiert Zip und `appcast.xml` mit EdDSA und legt den Feed an den festen Release `macos-appcast`; Menüpunkt „Nach Updates suchen …“. Versionen bestimmt jetzt semantic-release aus Conventional Commits (Regel in `CLAUDE.md`, CI-Job „Commit-Nachrichten“); Releases gibt es nur bei `feat`/`fix`/`perf`. Die CI baut bei jedem PR mit Wegwerf-Schlüssel und schreibt einen Probe-Feed. Schlüssel sind seit 18.11. hinterlegt. Offen bei Ruben: Update-Test am Mac (Gerätecheckliste §28, SU1–SU5).
   - **CHAOS-140 (nativer Apple-Host, Assets):** `pnpm build:apple-assets` erzeugt Figuren als USDZ direkt aus den bpy-Skripten (Vertexfarben als Textur gebacken, Clearcoat, Metall und Leuchten bleiben; alle Clips auf einer Zeitleiste mit `clips.json`) und die Brett-Kulisse mit Feld-Ankern `feld_<id>`, dazu `herkunft.json`. Geprüft mit usd-core im neuen CI-Job „Apple-Assets (USDZ)“; der RealityKit-Spike erzeugt seine Testszene auf demselben Weg (`convert.sh`). Der native Apple-Host lädt die USDZ ab CHAOS-142. Offen bei Ruben: Blick am Mac neben dem Babylon-Host (Gerätecheckliste, Abschnitt „USDZ-Assets“; EXP-026, [`apple-assets.md`](apple-assets.md)).
   - **CHAOS-142 (nativer Apple-Host, Lobby und Brett):** Die App rendert mit `RealityRenderer` und Hochskalierung (tvOS intern 1920×1080, EXP-020), lädt `brett.usdz`, Instanzen und Figuren aus `payload/szene` und stellt Figuren auf die Feld-Anker. Lobby mit Spielerkarten (Porträt, Slot-Farbe, bereit). `host-ready` erst nach dem Laden (`deferSceneReady`). `prepare.sh` bricht ohne USDZ ab; TestFlight und Release bauen sie. Offen bei Ruben: Gerätecheckliste §29 (Apple TV bei 4K, Urteil zur Optik). Danach CHAOS-143 (Brett-Regie).
   - **CHAOS-189:** Gleichzeitige Popups über derselben Stelle (Figur oder Feld) überdecken sich nicht mehr. Die Regie (`director.ts`) gibt jedem Popup eine Stapelebene (`FramePopup.stack`, niedrigste freie Ebene); Babylon-Host und nativer Host versetzen es um `stack × POPUP_STACK_HEIGHT` (1,4) entlang der Bildschirm-Senkrechten. Vertrag des Apple-Hosts: `popups[].stack`. Bild `docs/screenshots/chaos189-popups-gestapelt.jpg`, Gerätetest Checkliste §31.
   - **CHAOS-78 abgeschlossen:** Messungen stehen in EXP-017. Ruben hat die Apple TV als Host freigegeben (CHAOS-74), der Weg steht in ADR-019 (W2). RK5 entfällt, RK6 folgt mit der echten Grafik (CHAOS-148).
5. Ideen außerhalb von M4 liegen im Backlog CHAOS-44. Wachsende Sabotage ist seit CHAOS-67 umgesetzt (EXP-018: Klau/Falle +1 alle 5 Runden). Aufholhilfe (CHAOS-65): Die Trophäe wandert jetzt vor die Letzten (EXP-022). Fühlt sich der Halbzeit-Vorteil zu dritt oder zu viert im Playtest noch zu stark an, ist „Rückenwind“ der nächste Hebel: Seit CHAOS-125 ist er mit Ansage am PC und Controller fertig und lässt sich mit `RUECKENWIND=1 pnpm start` einschalten (Standard aus). Im nativen Apple-Host schaltet ihn seit CHAOS-188 der Startparameter `--rueckenwind` (oder `RUECKENWIND=1`) ein; die CI prüft das mit `bots --full --rueckenwind`. CHAOS-50 (neue Partie ohne Server-Neustart) war schon mit „Nochmal spielen“ (CHAOS-37) umgesetzt; der Lebenszyklus-Test spielt jetzt zwei ganze Partien hintereinander und prüft, dass Controller-Verbindungen und Tokens bleiben. Erledigt daraus außerdem: CHAOS-52 (2026-11-17), Windstoß und Platztausch fliegen am Host statt zu springen, Wegweiser weichen dem Zug-Pfeil über ihrer Gabel aus (Bilder `docs/screenshots/chaos52-*.png`, Gerätetest Checkliste Abschnitt 19). CHAOS-46 (2026-11-17): CI-Actions auf Node-24-Hauptversionen (`checkout@v7`, `setup-node@v7`, `cache@v6`, `upload-artifact@v7`, `pnpm/action-setup` v6.1.1 per SHA; gleichzeitig per Dependabot auf `main`), Messanzeige am Host außerhalb der Lobby links mittig (ADR-010, Nachtrag), ADR-007 verweist für E2E auf `testing.md`.
   - **CHAOS-120 umgesetzt:** Wächst die Sabotage (Runde 6, 11, 16 bei `sabotageGrowthRounds: 5`), blendet der PC „Sabotage wird stärker!“ mit den neuen Werten ein, mit kurzer Pause und tiefem Fallen-Klang. Der Server schickt die Werte im Ereignis `round-started` (`sabotage`, Protokoll v4-Nachtrag). Der Fallen-Text am Controller sagt „Kostet andere ab 4 Münzen“, solange die Falle später noch mehr bringen kann. Bild `docs/screenshots/chaos120-sabotage-ansage.png`, Gerätetest Checkliste Abschnitt 24 (SA1–SA4).
   - **CHAOS-157:** Der native Apple-Host zeigt „Sabotage wird stärker!“ jetzt als große Einblendung oben mittig wie der PC (4 s), nicht mehr als Zeile in der Meldungsleiste. Vertrag: `board.notice` (`apps/apple-host/src/contract.ts`, `src/notice.ts`), Beispiel `board-sabotage-notice.json`. Klang folgt, sobald der native Host Klänge hat. Offen bei Ruben: Gerätecheckliste §24, SA5.
   - **CHAOS-124 umgesetzt:** Schalter „Mehr Zeit zum Reagieren“ in der PC-Lobby (Standard aus). Damit dauert das Reaktionsfenster beim Münzklau 5 s statt 3 s. Die Einstellung geht per `configure` an den Server und bleibt über die Revanche (ADR-015 Nachtrag 5, EXP-004 Nachtrag). Nebenbei behoben: Die Leertaste löste fokussierte Knöpfe am PC nicht aus, weil die Tastatursteuerung beim Loslassen `preventDefault` rief. Gerätetest: Checkliste §23 (RT1–RT4).
   - **CHAOS-66 umgesetzt:** Läuft ein Minispiel in der Partie schon zum zweiten Mal, zeigen PC und Controller nur Titel, „Nochmal!“ und Bedienlegende, 3 s statt 7 s (`pacing.minigameRepeatIntroMs`, `minigame.repeat`, Protokoll v4-Nachtrag). Spart 0,4–1,1 min je Partie (EXP-011, Nachtrag); Lobby-Schätzung angepasst. Lokal ansehen: `/host/?local=1&minigame=pump-parade&flow=1&repeat=1`; Bild `docs/screenshots/chaos66-minispiel-intro-kurz.jpg`. Gerätetest: Checkliste P6b.
   - **CHAOS-128:** Die native Controller-App (CHAOS-115) liest `minigame.repeat` jetzt auch und zeigt die Kurzform wie der Browser-Controller (`MinigameCardText` in `apps/controller-ios/Sources/UI/PlayView.swift`, Fixture `context-minigame-intro-repeat.json`, Vorschau `-sample minigameIntroRepeat`). Swift-Tests (`apps/controller-ios/scripts/run-tests.sh`) laufen nur auf dem Mac; in der Cloud-Sitzung gab es kein Swift.
6. **Mehr Minispiel-Vielfalt (CHAOS-54):** Kuckucks-Klatsche ist überarbeitet (EXP-016) und läuft als viertes Minispiel in der Rotation (`packages/minigames/src/kuckucks-klatsche/`). Es ist das erste Minispiel nur mit Knopf A, gedacht auch für die kleinen Zonen am geteilten iPad. Bei 10 Runden kommt jedes Minispiel jetzt 2–3-mal statt 3–4-mal. Ruben prüft es mit Gerätecheckliste P6a; Bild: `docs/screenshots/chaos54-kuckucks-klatsche.jpg`. Die übrigen verworfenen Konzepte (Aufzieh-Takt, Krümel-Kehraus, Geysir-Gier) bleiben Kandidaten im Backlog (CHAOS-79).
7. **Minispiel-Ausbau auf ~200 (CHAOS-80):** Ruben möchte rund 200 Minispiele. Konzept steht in [`minigames/README.md`](minigames/README.md) (Fabrik aus Baukasten, gemeinsamen Prüfungen und Trichter) und [`minigames/katalog.md`](minigames/katalog.md) (200 Skizzen MG-001 … MG-200 in 20 Familien). Ruben hat das Konzept-Gate CHAOS-82 am 2026-11-16 freigegeben, mit Auflage: keine Gleichförmigkeit (README §5.5). Neue Spielformen ja, Schnellfeuer als eigene Rundenart, geheime Wahl am iPad seltener. Fundament: Der Baukasten steht (CHAOS-83, ADR-021, `packages/minigame-kit`, Muster `packages/minigames/src/hallo-baukasten/`, Steckbriefe in `packages/minigames/src/steckbriefe.ts`). Art-Kit erledigt (CHAOS-88): Requisiten-Sets für die acht Pilot-Familien plus Kulissen Garten und Küche, Regeln und Budget in [`art-direction.md`](art-direction.md) („Requisiten der Minispiele“); Laden und Platzieren im Spiel folgt mit CHAOS-91, USDZ für den Apple-Host als Folgeaufgabe. Die gemeinsamen Prüfungen stehen (CHAOS-84, [`minigames/pruefungen.md`](minigames/pruefungen.md)): Jedes neue Spiel der Rotation braucht einen Fairness-Harness und einen Steckbrief; Messwerte in [`minigames/pruefbericht.md`](minigames/pruefbericht.md). Rotation für den großen Katalog erledigt (CHAOS-85, ADR-012 Nachtrag 6; Simulation mit 200 Dummy-Steckbriefen in `packages/game-core/src/rules/rotation.test.ts`). Als Nächstes Galerie (CHAOS-87). Laden bei Bedarf (CHAOS-86) steht: Chunk je Minispiel, neues Spiel zusätzlich in `packages/minigames/src/lazy.ts` eintragen ([`performance.md` §3j](performance.md#3j-ein-chunk-je-minispiel-chaos-86)). Nachschub-Runde 1 (CHAOS-93, 2026-11-21): 7 Dubletten verworfen, 4 Kniffe geschärft, 26 neue Skizzen MG-201 … MG-226 ohne Stick (21 davon Physik); jetzt 209 aktive volle Minispiele, 35 % ohne Stick, 28 % Physik. `packages/minigames/src/sketchCatalog.test.ts` hält ≥ 200 aktiv, ≥ 30 % ohne Stick und ≥ 25 % Physik.
8. **Open Source (CHAOS-69, ADR-018):** Ruben hat am 2026-11-17 GPL-3.0-only für Code und eigene Assets gewählt; `LICENSE` liegt im Repo, jeder Build bringt Lizenzhinweise mit. Das Repository öffentlich zu stellen bleibt Rubens Schritt; App Store/TestFlight (Controller-App CHAOS-115, tvOS CHAOS-74) geht, solange nur Ruben Urheber ist; vor fremden Beiträgen in diese Apps braucht es eine Beitragsvereinbarung (ADR-018).
9. **Krümel-Kehraus (CHAOS-79):** Das in EXP-006 verworfene Physik-Konzept ist überarbeitet (EXP-023) und läuft als fünftes Minispiel in der Rotation (`packages/minigames/src/kruemel-kehraus/`): Holzblech mit Mauslöchern in festen Ecken (bei drei Personen das dritte als Kerbe hinten in der Mitte, damit alle Löcher gleich gut sind), niemand fällt herunter, 6 Krümel, Goldkrümel (3), Keksregen in den letzten 8 s. Ruben prüft es mit Gerätecheckliste P6c; Bild: `docs/screenshots/chaos79-kruemel-kehraus.jpg`. Aufzieh-Takt und Geysir-Gier gehen im Minispiel-Ausbau auf (CHAOS-102, CHAOS-104). Gefunden: Der Headless-Harness verlor je Lauf Speicher (CHAOS-126, behoben: Babylons verschobene Zeitgeber werden nach jedem Lauf geleert, Regressionstest `packages/minigames/src/headlessMemory.test.ts`); große Bot-Messungen laufen wieder in einem Prozess.

10. **Größere Bretter (CHAOS-195):** Seit CHAOS-197 ist das Brett eine Lobby-Einstellung (Register `packages/game-core/src/board/registry.ts`, ADR-015 Nachtrag 6; Server: `BRETT=zufall pnpm start`, Mac-App: `--brett=zufall`). Seit CHAOS-212 lädt der Apple-Host die Kulisse je Brett (`bretter/<brett-id>/`, Gerätecheckliste §38), seit CHAOS-199 gibt es den Rummelplatz (ADR-022, EXP-034, §41), seit CHAOS-198 den Frostgipfel (ADR-023, EXP-036, §43). Seit CHAOS-196 hat der Wackelwald 74 Felder und vier Gabeln (EXP-037; das alte Brett bleibt als `WACKELWALD_M2` für die Experimente EXP-001 … EXP-022). Offen bei Ruben: Gerätecheckliste §37 und §45.

11. **KI-Spieler (CHAOS-177):** Konzept steht in [ADR-020](decisions/ADR-020-ki-spieler.md) (CHAOS-178, Rubens Entscheidungen vom 2026-11-19): Jeder Platz ist Mensch oder KI, Solo erlaubt. Die Brett-KI läuft im Server als virtueller Controller, die Minispiel-KI im Host neben der Minispiel-Laufzeit. Stärke: leicht, mittel, schwer oder dynamisch. Persönlichkeit per Seed. `VISION.md` (Spieler) und `ARCHITECTURE.md` sind nachgezogen. Als Nächstes CHAOS-179 (KI-Sitze im Server) und CHAOS-180 (Bot-Vertrag der Minispiele).

## Offene Risiken (Kurzfassung)

Höchstes Risiko in M1 sind die Annahmen, die nur auf echter Hardware prüfbar sind: iPad-Multitouch für mehrere Zonen (A1–A3), LAN-Erreichbarkeit/Firewall/Client-Isolation (B1, B2), Latenz (B6) und Bildschirmsperre/Reconnect auf iOS (B7). Details und Validierungswege: [`assumptions.md`](assumptions.md).

Neu in M2: Ob das Brettspiel **Spaß macht** und verständlich ist, zeigen nur Testrunden mit Menschen. Alle Balance-Werte stammen aus Bot-Simulationen (EXP-001 … EXP-004). Das Reaktionsfenster (3 s) beruht auf angenommenen Reaktionszeiten; auf iOS gibt es keine Vibration als Hinweis (seit CHAOS-122 ein kurzer Hinweiston, Wirkung auf echten Geräten ungeprüft).

Neu in M3: Ob die drei Minispiele Spaß machen, fair sind und schnell verstanden werden, zeigt nur der Test mit Menschen; alle Minispiel-Werte stammen aus Bot-Simulationen (EXP-005 … EXP-007). Leistung am echten PC während der Minispiele (Figuren, Partikel, Havok) ist ungemessen; unter ~4 Bilder/s läuft ein Minispiel langsamer als Echtzeit.

Neu in M4: Die Werte für Partiedauer, Gleichstandsregel und Sabotage stammen aus Bot-Simulationen (EXP-011 … EXP-013); der Halbzeit-Führende gewinnt dort 59–73 % (seit CHAOS-65 mit Aufholhilfe 51–64 %, EXP-022). Ob eine ganze Partie trägt und Lust auf eine weitere macht, zeigt nur Rubens Gruppentest. Performance-Schwellen sind nur relativ (SwiftShader); echte Werte fehlen. Vollständige Liste: [`known-issues.md`](known-issues.md).
