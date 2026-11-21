# ADR-012: Minispiele in M3 – Logik im PC-Host, Server als Schiedsrichter, fester 1/60-Takt, Protokoll v3

**Status:** Angenommen
**Datum:** 2026-11-15
**Aufgabe:** CHAOS-3 (CHAOS-26 … CHAOS-34)
**Betroffene Annahmen:** `docs/assumptions.md` D4 (Regeln als reine Zustandsmaschine), C1 (Havok-WASM)

## Kontext

M3 verlangt drei echte Mehrspieler-Minispiele (Arcade, Physik, Hybrid) mit Anleitung, Ergebnis und Tests für Lebenszyklus, Wertung und Aufräumen (ROADMAP M3, ARCHITECTURE „Minigame contract“). In M2 lief nach jeder Runde ein Platzhalter in game-core (Rangfolge per Seed). Die Regeln laufen im Session-Server (ADR-011), die Darstellung im Host. Das Physik-Minispiel braucht Havok, das im Host bereits läuft (ADR-004). Mehrere Subagenten sollten parallel je ein Minispiel bauen; dafür brauchte es vorab einen festen Vertrag und eine Testumgebung ohne Browser.

## Entscheidung

**1. Minispiel-Logik läuft im Host (PC), nicht im Server.** Der Host erzeugt je Minispiel eine eigene Babylon-Szene, rechnet Logik und (falls nötig) Havok-Physik und meldet am Ende ein Ergebnis. Das bleibt PC-autoritativ (Host und Server laufen auf demselben PC); die Controller senden weiter nur Eingaben.

**2. Der Server ist Schiedsrichter.** game-core wählt je Runde ein Minispiel per Seed aus der Rotation (`GameConfig.minigames`, gemischt ohne Wiederholung, bis alle dran waren), vergibt einen Minispiel-Seed und führt die Phasen `minigame-intro` → `minigame-play` → `minigame-results`. Der Host meldet `minigame-result { minigameId, round, placements, highlights? }`; game-core prüft vollständig (laufende Runde/ID, jeder Teilnehmer genau einmal, gültige Wertung mit Gleichstand, Punkte passend zu Plätzen und Wertungsart, Textgrenzen) und verteilt erst dann Münzen je Platz (Gleichstand = gleiche Belohnung). Kommt bis Spielzeit + `minigameResultGraceMs` (15 s) kein gültiges Ergebnis, gilt das Minispiel als abgebrochen: keine Münzen, die Partie läuft weiter. Ohne konfigurierte Minispiele bleibt der M2-Platzhalter.

**3. Vertrag in `packages/minigame-sdk`** (zwei Einstiege):

- Rein (`@chaos-party/minigame-sdk`): Steckbrief `MinigameInfo` (Titel, Untertitel, 1–3 Anleitungszeilen, Bedienung Joystick/A/B mit Text oder `null`, Spielzeit, Physik ja/nein, Wertungsart, Einheit), Eingaben, Ergebnis, `rankByScore`, `checkResult`, `checkInfo`, Seed-RNG, Figuren-IDs/-Namen. Server, game-core und Controller nutzen nur diesen Teil.
- Babylon (`@chaos-party/minigame-sdk/babylon`): `Minigame` mit `prepare(ctx)`, `start()`, `handleInput(slot, input)`, `update(dt)`, `getResult()`, `getHud()`, `dispose()`; `MinigameModule { info, create }`. Die **Laufzeit** `createMinigameRunner` erzwingt die Reihenfolge, gibt Eingaben nur laufend und nur an Teilnehmer (Achsen begrenzt, doppelte Knopfdrücke gefiltert), schickt bei Trennung neutrale Eingaben, rechnet **feste Schritte von 1/60 s** (höchstens 15 je Aufruf = 250 ms Aufholen, längere Hänger werden verworfen; bis etwa 4 Bilder/s bleibt das Spiel in Echtzeit), pausiert ohne Zeitverlust, prüft das Ergebnis und wertet bei Überschreitung (+1 s) oder ungültigem Ergebnis selbst aus dem HUD (`forced`).
- **Szene gehört der Laufzeit**, alles darin dem Minispiel: Es legt Meshes, Materialien, Kamera, Licht, Physik-Körper und Beobachter selbst an und räumt sie in `dispose()` weg. Zeit nur über `update`, Zufall nur über `ctx.rng`. Effekte (`ctx.fx`: Klang, Partikel, Kamerawackeln) und Figuren (`ctx.characters`) kommen von der Laufzeit.
- **Physik:** Havok wird vor `prepare` in der Szene aktiviert, aber vom Rendern entkoppelt (`scene.physicsEnabled = false`); die Laufzeit rechnet nach jedem `update` genau einen Physikschritt. Damit läuft die Physik unabhängig von der Bildrate (60/120/144 Hz) gleich schnell.
- **Testharness** (`@chaos-party/minigame-sdk/testing`): NullEngine-Szene, Havok aus der WASM-Datei in Node, aufzeichnende Effekte, Kapsel-Figuren, `runMinigameHeadless` mit Eingabe-Skript, `sceneResidue` für die Aufräumprüfung. Physik wird über Invarianten getestet, nicht bitgenau.

**4. Minispiele als Module in `packages/minigames`.** Je Ordner ein Minispiel (`info.ts` rein, `index.ts` Babylon). `./catalog` (rein) liefert Steckbriefe und Rotation für den Server, `.` die Module für den Host. `pump-parade` ist das Referenz-Minispiel des Vertrags und Rückfall, nicht in der Rotation. Ein generischer Test prüft jedes registrierte Modul (2–4 Spieler, Zufalls-Bots, gültiges Ergebnis, Szene leer nach `dispose`, Verbindungsverlust).

**5. Protokoll v3** (additiv zu v2):

- `BoardView.minigame` (`id`, `round`, `seed`, `playMs`, `elapsedMs`, `placements`, `highlights`, `aborted`); Ereignisse `minigame-started { minigame }` und `minigame-results { ranking, placements, aborted }`.
- Host → Server `minigame-result`; Fehlercode `invalid-result` (Partie läuft weiter).
- Controller-Kontext in der Brettphase mit `minigame` (`stage` `intro|play|results`, Anleitung, Bedienung, eigener Platz/Punkte). Während `minigame-play` Layout `joystick-buttons` mit genau den angebotenen Eingaben; `move`/`press`/`release` gehen wie in der M1-Arena als `input` an den Host.

**6. Host-Neuladen mitten im Minispiel:** Der Schnappschuss enthält `elapsedMs`; der Host startet das Minispiel mit der Restzeit neu (gleicher Seed, Spielstand des Minispiels geht verloren). Das ist selten (Host und Server auf demselben PC) und hält die Partie am Laufen.

## Betrachtete Alternativen

| Alternative                                          | Warum nicht                                                                                                                                                                                                                                |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Minispiel-Logik im Server, Host zeigt Schnappschüsse | Physik-Minispiel bräuchte Babylon + Havok im Node-Server und 30–60 Hz-Schnappschüsse mit Interpolation im Host; mehr bewegliche Teile, sichtbar ruckeliger. Vorteil (Host-Reload verlustfrei) ist bei Host und Server auf einem PC gering. |
| Physik im Render-Schritt (Babylon-Standard)          | Physik-Tempo hinge von der Bildrate ab (144-Hz-Monitor = schnelleres Spiel); Tests ohne Rendern wären nicht möglich.                                                                                                                       |
| Ergebnis ungeprüft übernehmen                        | Host-Nachricht ist Eingabe von außen; ein Fehler im Minispiel (doppelter Slot, Lücken) würde Münzen falsch verteilen. Die Prüfung kostet wenig.                                                                                            |
| Eigene Controller-Layouts je Minispiel               | Mehr Protokoll und Controller-Code; Joystick + A/B mit Texten deckt die drei Konzepte ab und passt in kleine iPad-Zonen.                                                                                                                   |
| Minispiele als Teil von game-core                    | game-core bliebe nicht rein (Babylon/Havok); Server bräuchte Render-Abhängigkeiten.                                                                                                                                                        |

## Konsequenzen

**Positiv**

- Minispiele sind isoliert testbar (headless in Millisekunden bis wenige Sekunden je Lauf), parallel entwickelbar und austauschbar, ohne Regeln oder Server zu ändern.
- Brett ↔ Minispiel ist über die Session mit synthetischem Host durchgetestet (`apps/server/src/boardGame.integration.test.ts`).
- Gleichstände, Abbrüche und Host-Fehler führen nie zum Stillstand der Partie.

**Negativ / Risiken**

- Host-Neuladen setzt das laufende Minispiel zurück (Restzeit bleibt).
- Der Host ist für die Wertung vertrauenswürdig; manipulierte Ergebnisse mit gültiger Form erkennt der Server nicht (lokales Spiel, kein Wettbewerb – bewusst akzeptiert).
- Zwei Typquellen (game-core `MinigamePlacement`, zod-Schema) – wie ADR-011 über die Zuweisung in `apps/server/src/game.ts` abgesichert.

## Überprüfung

Neu bewerten, wenn Host-Neuladen im Playtest stört, wenn ein Minispiel eigene Controller-Elemente braucht (z. B. Neigung, Mehrfach-Touch), oder wenn Online-/Fernspiel ein Thema würde (dann Server-autoritative Minispiele).

## Nachtrag 1 (2026-11-18, CHAOS-141): verteilter Aufbau mit `ctx.pace()`

`MinigameContext` bekommt `pace(): Promise<void>`. Minispiele rufen es in `prepare` zwischen ihren Bauschritten auf (`await ctx.pace()`, etwa je Mesh-Gruppe, Figur oder vorgewärmtem Gegenstand). Mit Taktgeber (`RunnerOptions.pacing`: nächstes Bild, echte Uhr, Budget in ms) gibt `pace` ab, sobald das Budget des Bildes verbraucht ist, und der Aufbau geht im nächsten Bild weiter. Ohne Taktgeber löst `pace` sofort auf: Tests und der PC-Host bauen wie bisher am Stück. Wird die Laufzeit während des Aufbaus entsorgt, wirft `pace` `PrepareAborted` und `prepare` endet ohne weitere Meshes.

Grund: Im nativen Apple-Host läuft JavaScriptCore ohne JIT. Ein Aufbau am Stück hielt dort ein Bild bis zu 98 ms an (EXP-024), in der Interpreter-Näherung des Harness bis 330 ms. Mit `pace` und 2 ms Budget liegt das längste Bild in der Näherung bei 19 ms (EXP-024, Nachtrag). Bauschritte zwischen zwei `pace` sollten klein bleiben: eine Kugel mit Standard-Segmenten kostet ohne JIT bereits gut 10 ms.

## Nachtrag 2 (2026-11-20, CHAOS-206): Host wertet vor der Frist des Servers

Die Spielzeit eines Minispiels steht schon im Aufbau fest (`ctx.timeLimitMs`). Ist die Bühne erst nach dem Countdown fertig (langsamer Aufbau, gedrosselter Mac, CHAOS-203, Software-Rendering in der CI) oder rechnet der Host langsamer als die Uhr, läuft sein Spiel über das Ende beim Server hinaus. Das ist in Ordnung, solange das Ergebnis vor der Frist kommt (Spielzeit + `minigameResultGraceMs`, sonst bricht der Server ab). Darum richtet der Host seinen Ablauf an dieser Frist aus (`playDeadline` in `apps/host/src/minigame/plan.ts`, beide Hosts). Die Frist liest er aus `view.remainingMs` in `minigame-play`, so gilt auch eine anders eingestellte Kulanz.

- Läuft das Spiel noch, wenn bis zur Frist höchstens `RESULT_MARGIN_MS` (3 s) bleiben, beendet der Host es mit `runner.finishNow()`. Hat das Minispiel noch kein Ergebnis, wertet die Laufzeit den Stand aus dem HUD (`RunnerResult.cut`, Log „Frist des Servers“).
- Bleiben bei Fertigstellung der Bühne bis zu diesem Punkt weniger als `MIN_RESTART_MS` (3 s) Spielzeit, startet das Spiel nicht mehr (Begründung wie beim Neuladen, Punkt 6). Der Server bricht nach seiner Frist ohne Münzen ab.
- Die angezeigte Restzeit reicht höchstens bis zum Werten vor der Frist (`shownRemainingMs`). Sonst stünden beim Abbruch noch Sekunden auf der Uhr.
- Ein wenig zu spät gestartetes Spiel behält seine volle Spielzeit und endet in der Kulanz. Gekürzt wird nur, wenn die Frist sonst reißt.
- In der Pause steht die Uhr. Im Testmodus und im lokalen Ablauf des PC-Hosts greift nichts davon (kein Server).

Verworfen: Das Spiel schon 1 s nach dem Ende der Spielzeit beim Server zu beenden. Das ließ in der CI unter Software-Rendering ein 8-s-Minispiel nie starten, dessen Bühne 5 s zu spät fertig war (`m2-brett-durchstich`, 60 s Kulanz). Vorher wurde es innerhalb der Kulanz angenommen.

Nachstellen: `HostEnv.debugStageDelayMs` verzögert im Apple-Host jede Bühne künstlich. Zwei Bündel-Tests prüfen das. Bei 5 s Verspätung wird mit voller Spielzeit angenommen. Bei 20 s Verspätung wird vor der Frist gewertet und angenommen; ohne die Ausrichtung meldete der Kern dort „nicht mehr gebraucht“.

## Nachtrag 3 (2026-11-20, CHAOS-205): Aufbau-Budget folgt der Tick-Dauer

Im Apple-Host bekam der Minispiel-Aufbau fest 2 ms je `tick` (Nachtrag 1). Tickt die App langsamer, etwa im Ersatztakt eines gedrosselten Macs (CHAOS-203) oder wenn Ticks ausfallen, kommt der Aufbau je Sekunde entsprechend weniger weit. Im Swift-Harness ohne JIT mit 10 Hz war die Bühne nur in 6 von 10 Runden vor dem Countdown-Ende fertig, vor allem bei der kurzen Anleitung (3 s) einer Wiederholung.

Jetzt hängt das Budget an der Dauer des Ticks (`prepareBudgetMs` in `apps/apple-host/src/stage.ts`). Es gilt für `ctx.pace()` und für das Kodieren der Geometrie in `renderState`.

- **Normal:** derselbe Anteil der Tick-Dauer wie bei 60 Hz (2 von 16,7 ms, also 12 %). Bei 60 Hz und schneller bleibt es bei 2 ms.
- **Knapp:** Ist die Bühne noch nicht fertig und bleiben von der Anleitung höchstens 2 s (`PREPARE_URGENT_MS`), oder läuft das Spiel schon, bekommt der Aufbau die halbe Tick-Dauer. Bei 60 Hz sind das gut 8 ms, einzelne Bilder dauern dann länger als 16,7 ms. Das ist besser als ein Spielstart ohne Bühne.
- Das Budget liegt immer zwischen 2 und 20 ms. Ein einzelner Hänger gibt nur dem nächsten Tick mehr, gedeckelt.

Allein der Anteil von 12 % reichte auf dem langsameren CI-Mac nicht: Bei 10 Hz war die Bühne dort nur in 9 von 10 Runden rechtzeitig fertig, bei der 3-s-Anleitung von Sockenregen. In 3 s sind das wie bei 60 Hz nur 360 ms Aufbau. Mit der Regel für knappe Bühnen sind es bei 10 Hz 520 ms.

Messung im Swift-Harness, ganze Partie ohne JIT, lokal:
- 10 Hz: 10 von 10 Bühnen rechtzeitig, vorher 6 von 10. Das längste Bild der Anleitung dauerte 49 ms, bei einem Tick-Abstand von 100 ms.
- 5 Hz: 10 von 10.
- 60 Hz: 10 von 10 wie vorher. Das längste Bild der Anleitung (`tick` + `renderState`) lag vorher bei 14,5/15,4/18,1 ms (drei Läufe) und nachher bei 18,2/16,4/21,8/18,9 ms. Die Spitzen streuen von Lauf zu Lauf.
- Bilder über 16,7 ms gab es schon vorher. Sie stammen von einzelnen Bauschritten zwischen zwei `pace` (Nachtrag 1, dort 19 ms; Folgeaufgabe CHAOS-209).

Der CI-Job „macOS“ spielt die Partie im Harness zusätzlich mit `hz=10`. Ist dabei eine Bühne beim Spielstart nicht fertig, schlägt er fehl.

## Nachtrag 4 (2026-11-20, CHAOS-209): kleine Bauschritte, Reserve bei knapper Bühne

Im Swift-Harness ohne JIT dauerten bei 60 Hz einzelne Bilder der Anleitung länger als 16,7 ms (Nachtrag 3). Ursache waren einzelne Bauschritte zwischen zwei `ctx.pace()`, die allein 7–17 ms kosteten, und das Budget von 8,3 ms bei knapper Bühne.

- **Bauschritte:** Ein Abschnitt zwischen zwei `pace` soll ohne JIT höchstens etwa 5 ms kosten. Teuer sind fast nur Kugeln und Tori, weil Babylon jeden Eckpunkt einzeln rechnet: Kugel mit Standard-Segmenten (32) gut 10 ms, mit 16 gut 3 ms, mit 12 gut 2 ms; Torus mit `tessellation: 64` gut 9 ms, mit 48 gut 4 ms, mit 32 gut 2 ms (Node als reiner Interpreter). Quader, Zylinder, Scheiben und Kapseln kosten unter 1 ms. Die Regel für Minispiele: bei Kugeln immer `segments` angeben, Tori höchstens mit 48, mehrere Kugeln oder Tori durch `pace` trennen. Gemessen wird mit `apps/apple-host/scripts/pace-segments.ts`.
- **Knappe Bühne:** Das Budget bei knapper Bühne (Nachtrag 3) bleibt die halbe Tick-Dauer, aber höchstens die Tick-Dauer minus `FRAME_RESERVE_MS` (10 ms) für einen überlangen Bauschritt, Session und `renderState`. Bei 60 Hz sind das 6,7 statt 8,3 ms, ab 40 Hz gilt wieder die halbe Tick-Dauer, bei 10 Hz bleibt es bei 20 ms. Bei 60 Hz war die Bühne auch ohne die Regel für knappe Bühnen immer rechtzeitig fertig (Nachtrag 3: 10 von 10).

Ergebnis in der Interpreter-Näherung (Node, ganze Bot-Partie mit 10 Runden, `tick` + `renderState`): Das längste Bild der Anleitung sank von 16,8/18,6 ms auf 12,3–14,4 ms in sechs Läufen. Der längste Bauschritt eines Minispiels sank von 17 auf rund 5 ms. Im Swift-Harness auf dem Mac (Apple M3 Max, `JSC_useJIT=false apps/apple-host/harness/run.sh full`, drei Läufe am 2026-11-20) lag das längste Bild der Anleitung bei 12,3, 10,7 und 11,8 ms (tick max 8,2–10,0 ms, renderState max 3,6–4,3 ms), also unter 16,7 ms. Der langsamere CI-Mac (`macos-26`) zeigte in einem Lauf 24,6 ms; auf der Apple TV ist der Kern ebenfalls langsamer, dort entscheidet die Gerätecheckliste §34.

## Nachtrag 5 (2026-11-20, CHAOS-214): Anleitung wartet auf „Bereit“

Ruben, 2026-11-20: „Alle Spieler sollten in dem Hilfebildschirm bereit drücken, bevor das Spiel startet.“ Bisher lief die Anleitung eine feste Zeit (7 s, bei Wiederholung 3 s). Wer langsam liest oder gerade nicht hinsieht, verpasste den Start.

- **Regeln:** Mit `pacing.minigameReadyTimeoutMs` (Standard 60 s) wartet `minigame-intro` auf den Befehl `minigame-ready` aller verbundenen Spieler (`MinigameState.ready`, aufsteigende Slots). Das letzte „Bereit“ startet das Spiel sofort, frühestens aber nach `minigameReadyMinMs` (Standard 3 s, so lang wie die kurze Anleitung): Zeit zum Ansehen, kein versehentliches Durchtippen, und der Host baut die Bühne fertig (Nachtrag 3). Getrennte Spieler zählen als bereit; spätestens nach der Sicherheitsfrist geht es los (Handy weggelegt, alte Controller-App ohne Knopf). In der Pause läuft nichts ab und `minigame-ready` ist abgewiesen; Bereitschaft vor der Pause bleibt. `minigameReadyTimeoutMs: 0` (z. B. `ZERO_PACING`) = feste Anleitungszeit wie bisher. Der M2-Platzhalter wartet nie.
- **Protokoll (v4-Nachtrag, additiv):** Die vorhandene Nachricht `ready` ist auch in der Brettphase erlaubt; die Session nimmt sie nur an, wenn der Kontext die Aktion `ready` anbietet (Anleitung, Slot noch nicht bereit, keine Pause). `ControllerMinigameInfo.ready` (eigener Stand) und `BoardView.minigame.ready` (bereite Slots), beide optional.
- **Anzeige:** Controller zeigen in der Anleitung „Bereit!“ und danach „Warte auf die anderen …“, Hosts zeigen je Spieler den Stand und keinen Countdown. `remainingMs` ist in der wartenden Anleitung erst die Zeit bis zur Mindestdauer, dann bis zur Sicherheitsfrist, also kein Lese-Countdown.
- **Bots:** Server-Harness, `simulateGame`, E2E-Bots und die Apple-Host-Bots drücken „Bereit“ nach ihrer Bedenkzeit. Experimente mit `ZERO_PACING` bleiben unverändert.

Verworfen: eine neue Nachricht `minigame-ready` im Protokoll. Die Lobby-Nachricht `ready` passt, und die native Controller-App kann sie schon senden.

## Nachtrag 6 (2026-11-20, CHAOS-85): Rotation für einen großen Katalog

Für ~200 Minispiele (CHAOS-80, `docs/minigames/README.md` §5.5, §6) reicht „gemischt per Seed, ohne Wiederholung“ nicht mehr. Die Auswahl liegt weiter in game-core (`packages/game-core/src/rules/rotation.ts`), deterministisch per Seed, und baut auf dem Beutel aus M3 auf:

- **Steckbrief (additiv, optional):** `MinigameInfo` bekommt `family` (20 Familien, `MINIGAME_FAMILIES`), `minPlayers`/`maxPlayers`, `ipadZone` (`false` = nur iPhone) und `secretChoice`. Kernverb, Spielform und Bedienung liest die Rotation aus dem Vielfalts-Steckbrief (`packages/minigames/src/steckbriefe.ts`, ADR-021), damit es dafür nur eine Quelle gibt. `MinigameSpec` trägt alle Achsen; der Server füllt sie aus Katalog und Steckbrief (`minigameSpecOf`). Ohne Achsen und Optionen zieht game-core genau wie vorher (gleiche Zufallszahlen, gleiche Reihenfolge, Test in `rotation.test.ts`).
- **Filter beim Füllen des Beutels:** Spielerzahl, „nur iPhone“ bei iPad-Zonen, Sperrliste; Mikro-Spiele nie (Schnellfeuer ist eine eigene Rundenart, CHAOS-90). Bliebe nichts übrig, fällt der Filter weg.
- **Gewichte beim Mischen** (Efraimidis–Spirakis, nur wenn nicht alle Gewichte 1 sind): Favorit ×2, geheime Wahl bei iPad-Zonen ×0,2 (Ruben, CHAOS-82: „deutlich seltener“, kein Ausschluss). Spiele der letzten Partie kommen ans Ende des Beutels.
- **Mischen über Achsen beim Ziehen:** Aus den nächsten 64 Spielen des Beutels gewinnt das erste mit den wenigsten Strafpunkten. Hart: gleiche Familie oder gleiches Kernverb direkt hintereinander (nur wenn der ganze Beutel keinen Ausweg hat). Weich: gleiche Kategorie, Bedienung oder Team-Form wie zuletzt (vorletztes Spiel halb), Familie kürzlich schon dran (Familien reihum), Gewicht (je Verdopplung 5 Punkte).
- **Session:** erkennt iPad-Zonen (eine Verbindung mit mindestens zwei mitspielenden Slots), merkt sich die Minispiele der letzten Partie bis zur Revanche und hält Sperrliste und Favoriten (`configure.minigameBlocklist`/`minigameFavorites`, Protokoll v4-Nachtrag; Stand in `lobby.settings.minigames`). Der PC-Host zeigt sie im Dialog „Minispiele“ und speichert sie lokal (`localStorage`); beim ersten Lobby-Stand jeder Session schickt er sie wieder.

Simulation mit 200 Dummy-Steckbriefen (300 Seeds, 20 Runden, `rotation.test.ts`): keine Wiederholung, nie gleiche Familie oder gleiches Kernverb hintereinander, im Mittel 18,9 von 19 Familien je Partie (reines Mischen: 13,0), Anteile je Kategorie, Bedienung, Familie und Spielform weichen höchstens ein Viertel vom Katalog-Anteil ab, gleiche Kategorie bzw. Bedienung hintereinander weniger als halb so oft wie beim reinen Mischen, geheime Wahl bei iPad-Zonen weniger als halb so oft. Grenzen: Das Gedächtnis „letzte Partie“ lebt nur in der Session (Server-Neustart vergisst es); Sperrliste und Favoriten am Apple-Host folgen in CHAOS-216.

## Nachtrag 7 (2026-11-20, CHAOS-227): Aufbau-Deckel bei knapper Bühne

Seit CHAOS-214 endet die Anleitung nach 3 s, wenn alle bereit sind, auch beim ersten Spielen. Bei 10 Hz bekam der Aufbau bei knapper Bühne höchstens 20 ms je Takt (Nachtrag 3/4), in 3 s also rund 600 ms. Im Swift-Harness (Bots drücken sofort „Bereit“) war deshalb je nach Reihenfolge der Minispiele eine von zehn Bühnen beim Spielstart nicht fertig (PR #126, CHAOS-85: einmal Sockenregen, einmal Kuckucks-Klatsche). Bei knapper Bühne gilt jetzt ein eigener Deckel `PREPARE_URGENT_MAX_MS` = 50 ms: bei 10 Hz die halbe Tick-Dauer, wie in Nachtrag 3 gedacht, und `FRAME_RESERVE_MS` bleibt frei. Bei 60 Hz bleibt es bei 6,7 ms, ohne knappe Bühne bei 20 ms. Ein einzelner Hänger bleibt gedeckelt. Nachweis: CI-Job „Native Apps“, Schritt 10 Hz.

## Nachtrag 8 (2026-11-21, CHAOS-89): Spielformen mit Teams und Koop

Ein Minispiel erklärt seine Spielform im Steckbrief (`MinigameInfo.teamPlay`: `1v3`, `2v2` oder `koop`, Zuteilung `random`/`last-vs-all`/`board`, Ersatz zu dritt und zu zweit). **game-core teilt beim Start der Anleitung ein** (`planTeams` aus dem SDK, Zufall nur bei Zufallszuteilung, damit jeder-gegen-jeden-Partien ihren Seed-Verlauf behalten) und legt die Aufstellung in `MinigameState.teams`. Zu dritt wird daraus 1 gegen 2 mit Vorteil für die Einzelperson (`soloAdvantage`, das Spiel entscheidet, welcher), zu zweit 1 gegen 1. Host, Controller und Minispiel (`MinigameContext.teams`) bekommen die fertige Aufstellung und rechnen nichts neu aus.

Das Ergebnis behält die Einzelplätze und nennt zusätzlich den **Ausgang** (`MinigameResult.outcome`): Siegerteam bzw. Unentschieden, oder die Koop-Stufe 0–3. `checkResult` prüft bei Teams, dass die Plätze allein aus dem Ausgang folgen (Siegerteam Platz 1, die anderen dahinter; `teamPlacements`), bei Koop sind die Plätze die Einzelwertung. Ohne gültiges Ergebnis wertet die Laufzeit Teams als Unentschieden und Koop als Stufe 0. Münzen zahlt game-core nach `economy.teamRewards` (EXP-038).

Protokoll: v4-Nachtrag ohne Versionssprung (`BoardView.minigame.teams`/`outcome`, Kontext `team`, `minigame-result.outcome`, alle optional). Ein Sprung auf v5 hätte installierte iOS-Controller und den Apple-Host ausgesperrt; Gegenstellen ohne Nachtrag zeigen Teams nicht an (CHAOS-229, CHAOS-230). Teams sind nie nur an der Farbe erkennbar: Name und Symbol (☀ Sonne, ☾ Mond, ♥ alle zusammen, `TEAM_MARKS`).
