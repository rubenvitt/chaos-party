# Gerätecheckliste (echte iPhones, iPad und PC): M1, ab Abschnitt 8 M2, ab 9 M3, ab 11 M4, 13 Natur-Look

**Stand:** 2026-11-14 · **Aufgabe:** CHAOS-15 · **Gate:** CHAOS-16 (M1-Abnahme, nur Ruben)

Diese Liste prüft, was Browser-Automatisierung **nicht** beweisen kann: echtes iOS-/iPadOS-Safari, Multitouch, WLAN, Firewall, Sperrbildschirm und gefühlte Latenz. Alle automatischen Tests laufen in Chromium mit Geräte-Emulation und synthetischen Touch-Ereignissen. Sie sind ein Hinweis, kein Beleg.

**Regeln**

- Ausfüllen nur durch Ruben (oder wer die Geräte in der Hand hat). Claude trägt hier keine Ergebnisse ein, die nicht gemeldet wurden.
- Ergebnis je Punkt: `ok` · `fehlerhaft` (mit Beschreibung) · `nicht unterstützt` (Gerät/Browser kann es nicht) · `nicht geprüft`.
- Nachweis: Foto, Bildschirmaufnahme, kurze Notiz oder Terminal-Ausgabe. Dateien gern nach `docs/acceptance/m1-nachweise/` legen oder in Zunder an CHAOS-16 hängen.
- Spalte „Annahme“ verweist auf [`assumptions.md`](assumptions.md). Ergebnisse dort mit Datum nachtragen.
- Ablauf zum Starten: [M1-Demo-Anleitung](m1-demo.md). Netzwerkprobleme: [network-setup.md](network-setup.md).
- Messwerte: `?debug=1` (Host) bzw. `&debug=1` (Controller) blendet eine Messanzeige mit „Kopieren“ ein ([ADR-010](decisions/ADR-010-messanzeige.md)). Es gibt bewusst keine Grenzwerte; die Werte dieser Liste sind die M1-Baseline.

## 1. Testumgebung

| Feld                                                           | Eintrag |
| -------------------------------------------------------------- | ------- |
| Datum                                                          |         |
| Commit / Branch                                                |         |
| PC: Betriebssystem, CPU/GPU                                    |         |
| PC: Browser + Version (Host)                                   |         |
| PC: Netz (WLAN oder Kabel), Router/Mesh-Modell                 |         |
| WLAN-Art (Heimnetz, Mesh, Gästenetz, Hotspot)                  |         |
| Firewall-Abfrage beim ersten Start erschienen? (Windows/macOS) |         |

| Gerät              | Modell | iOS/iPadOS-Version | Browser + Version | Rolle                            |
| ------------------ | ------ | ------------------ | ----------------- | -------------------------------- |
| iPhone 1           |        |                    | Safari            | Spieler (1 Platz)                |
| iPhone 2           |        |                    | Safari            | Spieler (1 Platz)                |
| iPad               |        |                    | Safari            | geteilt (2 Plätze, optional 3–4) |
| weitere (optional) |        |                    | z. B. Chrome iOS  |                                  |

## 2. Start und Beitritt

| ID  | Annahme    | Schritt                                                                                          | Erwartung                                                                                                                        | Ergebnis | Nachweis |
| --- | ---------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | -------- | -------- |
| J1  | B3         | `pnpm build && pnpm start` im Terminal                                                           | Terminal zeigt Link `http://<LAN-IP>:8787/?code=XXXX`, Begründung der Adresswahl, QR-Code; IP passt zum WLAN (z. B. `192.168.…`) |          |          |
| J2  | C5         | Am PC `http://localhost:8787/host/` öffnen                                                       | Arena, Lobby mit QR-Code, großem Join-Code, Link; Badge „Server: verbunden“                                                      |          |          |
| J3  | B1, B2, B4 | iPhone 1: QR mit der **Kamera-App** scannen, Link öffnen                                         | Controller öffnet sich ohne Fehlermeldung, Lobby-Bildschirm in Spielerfarbe mit Symbol                                           |          |          |
| J4  | B2         | Falls J3 scheitert: Firewall-Abfrage/Freigabe nach [network-setup.md](network-setup.md#firewall) | nach Freigabe klappt J3; notieren, welcher Schritt nötig war                                                                     |          |          |
| J5  | –          | iPhone 2: QR scannen                                                                             | zweiter, **anderer** Slot (andere Farbe/Symbol); Host-Lobby zeigt 2 Spieler                                                      |          |          |
| J6  | –          | Code von Hand eingeben: Seite `http://<LAN-IP>:8787/` ohne `?code=` öffnen                       | Code-Eingabe erscheint, groß und gut tippbar; nach 4 Zeichen Beitritt                                                            |          |          |
| J7  | E5         | Auf beiden iPhones „Bereit!“ tippen                                                              | Host zeigt beide als „bereit“; Controller wechseln in Warteansicht                                                               |          |          |
| J8  | –          | Am PC „Los geht’s!“                                                                              | beide Controller zeigen Joystick + A/B; Lobby verschwindet am Host                                                               |          |          |

## 3. Zwei iPhones gleichzeitig

| ID  | Annahme | Schritt                                                                                                                                                                                | Erwartung                                                                                                                                                                                               | Ergebnis | Nachweis |
| --- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------- |
| P1  | –       | Beide Personen bewegen gleichzeitig ihren Joystick in verschiedene Richtungen                                                                                                          | jede Figur folgt **nur** ihrem iPhone; Richtung stimmt (Joystick hoch = Figur vom Betrachter weg)                                                                                                       |          |          |
| P2  | –       | Taste A (Schubser) auf beiden, auch gleichzeitig, Figuren gegeneinander                                                                                                                | Figuren stoßen sich sichtbar, Physik wirkt plausibel                                                                                                                                                    |          |          |
| P3  | B6      | Gefühlte Latenz: schnelle Richtungswechsel, Antippen. Dazu Controller mit `&debug=1` öffnen (Link um `&debug=1` ergänzen) und nach 1 min Spielen „Kopieren“ bzw. die Zeile abschreiben | Bewertung 1 (unspielbar) – 5 (wie Konsole): ___ ; Rundlaufzeit Controller↔Server Median/p95: ___ / ___ ms; optional Zeitlupenvideo (240 fps): Bilder zwischen Fingerbewegung und Figurbewegung → ___ ms |          |          |
| P4  | E5      | Lesbarkeit: Wer bin ich? Was kann ich drücken?                                                                                                                                         | Spielerfarbe/-symbol und Knöpfe ohne Erklärung verständlich; Knöpfe groß genug                                                                                                                          |          |          |
| P5  | A4      | Hämmern auf A/B, Doppeltipp, Zwei-Finger-Zoom, langes Halten, über den Rand ziehen                                                                                                     | kein Zoom, kein Scrollen, keine Textauswahl, keine Lupe, kein Kontextmenü                                                                                                                               |          |          |
| P6  | A5      | Vom linken Rand nach rechts wischen; oben nach unten ziehen                                                                                                                            | keine Zurück-Navigation, kein Neuladen – oder: Seite kommt nach Reload sofort wieder in denselben Slot (R3)                                                                                             |          |          |
| P7  | A6      | iPhone mitten im Spiel zwischen Hoch- und Querformat drehen, auch während der Joystick gehalten wird                                                                                   | Layout passt sich an, nichts „klemmt“ (Figur läuft nicht weiter, wenn losgelassen)                                                                                                                      |          |          |
| P8  | A7      | Ältestes verfügbares iPhone mitspielen lassen                                                                                                                                          | Controller reagiert flüssig                                                                                                                                                                             |          |          |
| P9  | C2      | Host-Bildrate am PC: Host mit `http://localhost:8787/host/?debug=1` öffnen, 1 min mit 2 (testweise 4) Figuren spielen, Messzeile kopieren                                              | fps: ___ ; Frame-Zeit Median/p95: ___ / ___ ms; Eingabe→Frame Median/p95: ___ / ___ ms; GPU/WebGL laut Anzeige: ___                                                                                     |          |          |

## 4. Geteiltes iPad (2 Zonen)

Beitritt: In der Host-Lobby den Link für das iPad verwenden (siehe [M1-Demo-Anleitung](m1-demo.md#5-ipad-als-geteilter-controller-2-spieler)) oder auf dem iPad `http://<LAN-IP>:8787/?code=XXXX&seats=2` öffnen, alternativ ohne Code öffnen und „2 Spieler · iPad“ wählen.

| ID  | Annahme | Schritt                                                                                    | Erwartung                                                                                                                                                        | Ergebnis | Nachweis |
| --- | ------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------- |
| I1  | A9      | iPad tritt mit 2 Plätzen bei                                                               | zwei Zonen in zwei Spielerfarben; Host zeigt zwei neue Spieler                                                                                                   |          |          |
| I2  | A1      | Zwei Personen bedienen **gleichzeitig** je ihren Joystick                                  | beide Figuren bewegen sich unabhängig, kein Übersprechen                                                                                                         |          |          |
| I3  | A1      | Person 1 hält den Joystick, Person 2 hämmert auf A                                         | Joystick von Person 1 bleibt stabil, Schubser von Person 2 kommt jedes Mal an                                                                                    |          |          |
| I4  | A1      | Finger über die Zonengrenze ziehen                                                         | Finger bleibt „seiner“ Zone zugeordnet, steuert nicht die andere Figur                                                                                           |          |          |
| I5  | A6      | iPad mitten im Spiel drehen (Hoch ↔ Quer)                                                  | Zonen ordnen sich neu (hoch: obere Zone um 180° gedreht); gehaltene Eingaben werden sauber beendet                                                               |          |          |
| I6  | A3      | Mit 4–5 Fingern gleichzeitig spielen, vom Rand wischen                                     | Systemgesten (Home, App-Wechsler, Kontrollzentrum) stören? Notieren, was passiert; Gegenmittel „Geführter Zugriff“ testen (siehe [ipad-zonen.md](ipad-zonen.md)) |          |          |
| I7  | E4      | Platz und Haltung: Sitzen zwei Personen bequem am iPad, sehen sie dabei den PC-Bildschirm? | Bewertung + Notiz                                                                                                                                                |          |          |
| I8  | A9      | Gemischt: iPad (2 Plätze) + 1 iPhone = 3 Spieler                                           | alle drei Figuren unabhängig steuerbar                                                                                                                           |          |          |
| I9  | A2      | Optional: iPad mit `seats=4`, vier Personen                                                | wie viele gleichzeitige Finger kommen an? Wird es zu eng?                                                                                                        |          |          |

## 5. Verbindung, Abbruch, Wiederverbindung

| ID  | Annahme | Schritt                                                                 | Erwartung                                                                                                                                       | Ergebnis | Nachweis |
| --- | ------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------- |
| R1  | B7      | iPhone sperren, 10 s warten, entsperren                                 | Controller zeigt kurz „Verbindung verloren …“ und verbindet sich automatisch; **gleicher** Slot/gleiche Farbe; Host zeigt dazwischen „getrennt“ |          |          |
| R2  | B7      | Zu einer anderen App wechseln, nach 30 s zurück                         | wie R1                                                                                                                                          |          |          |
| R3  | A5, B7  | Controller-Seite neu laden                                              | kommt in denselben Slot zurück                                                                                                                  |          |          |
| R4  | B7      | WLAN am iPhone 5 s aus- und wieder einschalten                          | automatische Wiederverbindung, gleicher Slot                                                                                                    |          |          |
| R5  | –       | Flugmodus am iPhone ≥ 20 s                                              | Host markiert den Spieler deutlich als getrennt; nach Rückkehr wieder verbunden                                                                 |          |          |
| R6  | –       | Host-Tab am PC neu laden                                                | Lobby/Spielstand (Phase, Spieler) erscheint wieder, Controller bleiben verbunden                                                                |          |          |
| R7  | B1      | Mesh/Repeater: mit dem iPhone durch die Wohnung gehen (falls vorhanden) | Verbindung hält oder kommt automatisch zurück                                                                                                   |          |          |
| R8  | B7      | Gerät ≥ 2 min im Sperrbildschirm lassen                                 | nach Entsperren: Wiederverbindung oder klare Meldung, wie man wieder beitritt                                                                   |          |          |

## 6. Nicht unterstützte Kombinationen

Hier jede Gerät-/Browser-Kombination eintragen, die nicht funktioniert hat (z. B. sehr altes iOS, In-App-Browser von Messenger-Apps nach Link-Klick, Gäste-WLAN).

| Gerät / Browser / Netz | Was passiert | Workaround |
| ---------------------- | ------------ | ---------- |
|                        |              |            |

## 7. Gesamturteil (für CHAOS-16)

| Frage                                                            | Antwort                                                                                              |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Join funktioniert zuverlässig?                                   |                                                                                                      |
| Gleichzeitige Eingaben (2 iPhones, iPad mit 2 Zonen) unabhängig? |                                                                                                      |
| Controls lesbar und ohne Erklärung verständlich?                 |                                                                                                      |
| Verbindung stabil, Wiederverbindung brauchbar?                   |                                                                                                      |
| Reaktionszeit tolerierbar?                                       |                                                                                                      |
| Entscheidung                                                     | **APPROVED** durch Ruben am 2026-11-15 („approved“); nur iPhone getestet, Einzelwerte nicht gemeldet |

## 8. M2 – Brettspiel (für CHAOS-25)

**Stand:** 2026-11-15 · **Aufgabe:** CHAOS-2 · **Gate:** CHAOS-25 (M2-Abnahme, nur Ruben) · Ablauf: [m2-demo.md](m2-demo.md)

Automatisch geprüft (Chromium-Emulation, synthetische Touches) sind alle Entscheidungen, die Sperre nach dem Senden, der Countdown, gleichzeitige Wahlen in zwei iPad-Zonen und eine komplette Runde mit Host und zwei iPhones gegen den echten Server. Diese Liste prüft, was nur echte Geräte und echte Menschen zeigen.

**iPad nach M3 verschoben (Ruben, 2026-11-15):** M2 wird nur mit iPhones getestet. B6/B7 und das geteilte iPad aus Abschnitt 4 (I1–I9, CHAOS-47) folgen nach dem M3-Gate; dort als „verschoben“ eintragen.

| ID  | Schritt                                                                                                                                                                                                  | Erwartung                                                                                                                                                                                     | Ergebnis | Nachweis |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------- |
| B1  | 2–4 Personen spielen eine Partie mit 3 Runden (`ROUNDS=3 pnpm start`)                                                                                                                                    | Alle verstehen ohne Erklärung, wer dran ist und was zu tippen ist                                                                                                                             |          |          |
| B2  | Würfeln, Weg wählen, Trophäe kaufen auf dem iPhone                                                                                                                                                       | Knöpfe groß, sofort verständlich, keine versehentlichen Doppeltipps                                                                                                                           |          |          |
| B3  | Münzklau gegen eine Person: Reaktionsfenster                                                                                                                                                             | Countdown und pulsierender Knopf fallen auf; Reaktion per Daumen in der Zeit schaffbar; fühlt sich fair an                                                                                    |          |          |
| B4  | Vibration bei Reaktion                                                                                                                                                                                   | iOS-Safari unterstützt `navigator.vibrate` nicht: **keine** Vibration erwartet; prüfen, ob das stört                                                                                          |          |          |
| B4a | Hinweiston bei Reaktion (CHAOS-122), echtes iPhone: einmal irgendwo tippen (Code, „Bereit“), dann Münzklau gegen diese Person; einmal **laut**, einmal mit Stumm-Schalter (bzw. Kontrollzentrum „Stumm“) | Laut: kurzes „ding-ding“ nur am Handy der angegriffenen Person, nicht bei den anderen; stumm: **kein** Ton; laufende Musik einer anderen App wird nicht unterbrochen; Ton kommt nicht doppelt |          |          |
| B4b | Hinweiston am geteilten iPad (CHAOS-122)                                                                                                                                                                 | „ding-ding“ ertönt, der Rahmen der angegriffenen Zone blinkt gelb, die anderen Zonen bleiben ruhig; klar, wer reagieren muss                                                                  |          |          |
| B5  | Lange Optionstexte (Wegweiser, Namen) auf kleinem iPhone hoch/quer                                                                                                                                       | Lesbar, Silbentrennung sinnvoll, nichts abgeschnitten                                                                                                                                         |          |          |
| B6  | Geteiltes iPad, 2 Zonen: zwei Personen wählen **gleichzeitig** (z. B. eine reagiert, eine wählt einen Weg)                                                                                               | Jede Wahl landet beim richtigen Spieler; Finger in Zone 1 löst nichts in Zone 2 aus                                                                                                           |          |          |
| B7  | Geteiltes iPad, 4 Zonen: Brett-Knöpfe                                                                                                                                                                    | Groß genug, lesbar aus jeder Sitzposition                                                                                                                                                     |          |          |
| B8  | iPhone mitten im eigenen Zug sperren, 20 s warten, entsperren                                                                                                                                            | Spiel wählt nach ~15 s automatisch weiter; nach dem Entsperren gleicher Platz, aktueller Stand                                                                                                |          |          |
| B9  | Host-Tab neu laden mitten in der Partie                                                                                                                                                                  | Brett, Stand und „am Zug“ erscheinen sofort wieder; Partie läuft weiter                                                                                                                       |          |          |
| B10 | Brett am Fernseher/Monitor aus Sofa-Abstand                                                                                                                                                              | Feldtypen, Figuren, Wegweiser, HUD und Meldungen lesbar                                                                                                                                       |          |          |
| B11 | Tempo                                                                                                                                                                                                    | Wartezeit bei fremden Zügen ok; Animationen nicht zu langsam/schnell; Reaktionsfenster bremst nicht                                                                                           |          |          |
| B12 | Sabotage                                                                                                                                                                                                 | Klau/Falle überraschen und sind lustig statt frustrierend                                                                                                                                     |          |          |

### Gesamturteil M2 (für CHAOS-25)

| Frage                                                 | Antwort                                                                                              |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 2–4 Personen spielen wiederholt Züge ohne Verwirrung? |                                                                                                      |
| Sabotage macht Spaß statt zu frustrieren?             |                                                                                                      |
| Reaktionsfenster bremsen die Runde nicht?             |                                                                                                      |
| Entscheidung                                          | **APPROVED** durch Ruben am 2026-11-15 („approved“); nur iPhone getestet, Einzelwerte nicht gemeldet |

## 9. M3 – Minispiele am Controller (für CHAOS-35)

**Stand:** 2026-11-15 · **Aufgabe:** CHAOS-33 (Controller-Teil) · **Gate:** CHAOS-35 (M3-Abnahme, nur Ruben)

Automatisch geprüft (Chromium-Emulation, synthetische Touches, nachgebauter Server: `tests/e2e/controller-minispiel.spec.ts`): Intro mit Titel, Anleitung und Bedienlegende; Spiel-Layout mit beschrifteten Knöpfen, ausgeblendetem Joystick/B laut Steckbrief; Loslassen gehaltener Knöpfe und Joysticks beim Wechsel ins Ergebnis; Platz, Punkte und Abbruch; vier iPad-Zonen mit gleichzeitigen Fingern. Diese Liste prüft, was nur echte Geräte und echte Hände zeigen. Belegbilder der Emulation: `docs/screenshots/m3-controller-intro.png`, `m3-controller-spiel.png`, `m3-controller-ergebnis.png`, `m3-ipad-minispiel.png`.

| ID  | Schritt                                                                                            | Erwartung                                                                                                                             | Ergebnis | Nachweis |
| --- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------- |
| G1  | Intro auf dem iPhone hoch und quer, Armlänge Abstand                                               | Titel, Untertitel, Anleitung und Bedienlegende in wenigen Sekunden lesbar; nichts abgeschnitten, kein Scrollen nötig                  |          |          |
| G2  | Intro in iPad-Zonen (2 und 4 Zonen), aus jeder Sitzposition                                        | Kompakte Anleitung in der eigenen Zone lesbar; gedrehte Zonen zeigen zur gegenübersitzenden Person                                    |          |          |
| G3  | Bedienlegende vs. Spiel                                                                            | Was die Legende zeigt (Joystick/A/B mit Verb), erscheint im Spiel genau so; fehlende Elemente fehlen auch im Spiel                    |          |          |
| G4  | Spiel mit Joystick + A (iPhone hoch und quer)                                                      | Daumen erreichen Joystick und Knopf ohne Umgreifen; Beschriftung im Knopf lesbar, auch während der Daumen darauf liegt                |          |          |
| G5  | Spiel nur mit Knöpfen (z. B. Pump-Parade)                                                          | Großer Knopf mittig; schnelles Tippen (≥ 5/s) zählt jeden Tipper, kein Zoomen, Markieren oder Doppeltipp-Zoom                         |          |          |
| G6  | Geteiltes iPad, 2–4 Personen spielen ein Minispiel gleichzeitig mit mehreren Fingern               | Jede Eingabe wirkt nur für die eigene Zone; Finger in der Nachbarzone stören nicht; kein Hängenbleiben eines Knopfes                  |          |          |
| G7  | Ende des Minispiels, während ein Daumen noch auf A bzw. dem Joystick liegt                         | Figur am PC bleibt sofort stehen bzw. lässt los; danach erscheint das Ergebnis, kein „klebender“ Knopf in der nächsten Phase          |          |          |
| G8  | Ergebnis auf iPhone und in iPad-Zonen                                                              | Eigener Platz („Platz 1!“) groß und sofort klar, Punkte mit Einheit lesbar; Gleichstand (zwei Mal Platz 1) verständlich               |          |          |
| G9  | Abbruch eines Minispiels auslösen (Weg laut Server-Doku, z. B. Host-Tab mitten im Spiel schließen) | Controller zeigt „Minispiel abgebrochen“, danach wieder die Brettanzeige                                                              |          |          |
| G10 | iPhone mitten im Minispiel sperren, 10 s warten, entsperren                                        | Gehaltene Eingaben wurden beim Sperren losgelassen; nach dem Entsperren gleicher Platz und aktuelle Stage (Spiel oder schon Ergebnis) |          |          |
| G11 | App-Wechsel bzw. Kontrollzentrum während des Spiels (iPhone und iPad)                              | Keine hängenden Eingaben; zurück im Spiel funktionieren Joystick und Knöpfe sofort                                                    |          |          |
| G12 | Systemgesten am Rand während des Spiels (Home-Leiste, Mitteilungen)                                | Gesten vom Bildschirmrand lösen keine Spieleingabe aus; Spielelemente liegen weit genug vom Rand                                      |          |          |
| G13 | Farbe und Symbol des Slots                                                                         | In Intro, Spiel und Ergebnis jederzeit erkennbar, welcher Spieler man ist                                                             |          |          |
| G14 | „Bewegung reduzieren“ in iOS einschalten                                                           | Titel und Platz erscheinen ohne Hüpf-Animation; alles bleibt bedienbar                                                                |          |          |
| G15 | Rückmeldung                                                                                        | Keine Vibration auf iOS erwartet (Safari kann es nicht); Farbblitz bei Rückmeldung sichtbar, stört nicht                              |          |          |
| G16 | Gefühlte Eingabeverzögerung im Minispiel (`&debug=1` für Messwerte)                                | Knopfdruck → Reaktion am PC fühlt sich direkt an; Werte notieren                                                                      |          |          |

### Gesamturteil Minispiel-Controller (für CHAOS-35)

| Frage                                                                    | Antwort |
| ------------------------------------------------------------------------ | ------- |
| Versteht man jedes Minispiel aus dem Intro am Controller ohne Erklärung? |         |
| Bedienung im Spiel daumenfreundlich, ohne versehentliche Gesten?         |         |
| iPad-Zonen mit mehreren Fingern zuverlässig?                             |         |
| Ergebnis sofort verständlich?                                            |         |
| Entscheidung                                                             |         |

## 10. M3 – Minispiele, Figuren und Ton am PC (für CHAOS-35)

**Stand:** 2026-11-15 · **Aufgabe:** CHAOS-3 · **Gate:** CHAOS-35 (nur Ruben) · **Anleitung:** [m3-demo.md](m3-demo.md)

Automatisch geprüft: Lebenszyklus, Wertung und Aufräumen jedes Minispiels headless (`packages/minigames`), Brett ↔ Minispiel über den Server (`apps/server/src/boardGame.integration.test.ts`), Bild jedes Minispiels mit festem Seed (`tests/e2e/m3-minispiele-bild.spec.ts`), Bühne mit echten Seiten (`tests/e2e/m3-minispiel-durchstich.spec.ts`). Diese Liste prüft, was nur Menschen am echten PC/Fernseher beurteilen können. Mit 2–4 Personen, `ROUNDS=5 pnpm start` (jedes Minispiel einmal; bis CHAOS-54 waren es drei, bis CHAOS-79 vier).

| ID  | Schritt                                                                                                                  | Erwartung                                                                                                                                                                                                                                                                                                                                                                                                                                             | Ergebnis | Nachweis |
| --- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------- |
| P1  | Lobby mit 4 Spielern                                                                                                     | Figur-Porträts mit Namen, klar unterscheidbar; jeder findet „seine“ Figur                                                                                                                                                                                                                                                                                                                                                                             |          |          |
| P1a | Porträts am iPhone/iPad (Safari, CHAOS-61)                                                                               | Figurenkarten der Lobby (CHAOS-36) mit den Render-Porträts, vergebene Figuren mit Akzent in der Besitzerfarbe; gewählte Figur in der Plakette als Avatar mit Symbol-Marke und groß im Endstand; Akzent (Halsring/Halstuch/Bündchen) in Slot-Farbe, nicht als Fläche über dem Bild (CSS-Maske + `multiply` auf iOS)                                                                                                                                    |          |          |
| P2  | Brett mit Figuren (Fernseher, Sofa-Abstand)                                                                              | Figuren erkennbar, laufen/jubeln/zucken passend; Sockel/Symbol zeigt den Slot                                                                                                                                                                                                                                                                                                                                                                         |          |          |
| P3  | Anleitung jedes Minispiels (7 s)                                                                                         | Alle haben vor dem Start verstanden, was zu tun ist (ohne Erklärung von außen)                                                                                                                                                                                                                                                                                                                                                                        |          |          |
| P4  | Sockenregen spielen                                                                                                      | Socke, Goldsocke und Bügeleisen sofort unterscheidbar; Schleudergang spürbar; fühlt sich fair an                                                                                                                                                                                                                                                                                                                                                      |          |          |
| P5  | Pudding-Gerangel spielen                                                                                                 | Kirschfleck als Ziel klar; Kippen/Rempeln/Löffel witzig statt frustrierend; Rückkehr nach Sturz klar                                                                                                                                                                                                                                                                                                                                                  |          |          |
| P6  | Wackelturm spielen                                                                                                       | Wackeln früh sichtbar; Kippen nachvollziehbar (nicht „grundlos“); Klauen witzig statt gemein                                                                                                                                                                                                                                                                                                                                                          |          |          |
| P6a | Kuckucks-Klatsche spielen (CHAOS-54, nur Knopf A; Vorschau `/host/?local=1&minigame=kuckucks-klatsche&players=4`)        | Eigene Tür (Farbe + Symbol) sofort gefunden; Kuckuck vs. Ente/Socke/Blume auf Sofa-Abstand unterscheidbar; weißer Gong-Ring als „jetzt darf jeder“ verstanden; Klauen und Benommenheit witzig statt gemein; fühlt sich „bei mir kam kaum was“ (Türglück) unfair an? Am geteilten iPad: großer A-Knopf je Zone reicht                                                                                                                                  |          |          |
| P6b | Minispiel zum zweiten Mal in derselben Partie (CHAOS-66; Vorschau `/host/?local=1&minigame=pump-parade&flow=1&repeat=1`) | PC und Handy/iPad-Zone zeigen „Nochmal!“, Titel und Bedienung ohne Anleitungsschritte, auch die native Controller-App (CHAOS-128; Simulator-Vorschau `-sample minigameIntroRepeat`); 3 s reichen, um zu erkennen, welches Minispiel kommt, und das Gerät richtig zu halten; niemand vermisst die Anleitung                                                                                                                                            |          |          |
| P6c | Krümel-Kehraus spielen (CHAOS-79, Stick + A; Vorschau `/host/?local=1&minigame=kruemel-kehraus&players=4`)               | Eigenes Mauseloch (Torbogen + Symbol in Slot-Farbe) sofort gefunden, mit 3 Personen auch die Kerbe hinten in der Mitte (fühlt sie sich gleichwertig an?); Krümel schieben fühlt sich steuerbar an (nicht zu glitschig, nicht zu träge); Goldkrümel sofort erkannt; Gerangel um Gold witzig statt zäh; Keksregen am Ende als Finale verstanden; „Krümel in fremdes Loch geschoben“ lustig statt ärgerlich; mit 2 Personen (diagonale Ecken) genug los? |          |          |
| P7  | Eigene Figur im Gedränge finden                                                                                          | In allen Minispielen jederzeit klar, wer man ist (Farbe + Symbol + Figur)                                                                                                                                                                                                                                                                                                                                                                             |          |          |
| P8  | Ergebnisanzeige                                                                                                          | Plätze, Punkte, Münzen und Gleichstand sofort klar; 6 s reichen zum Lesen                                                                                                                                                                                                                                                                                                                                                                             |          |          |
| P9  | Ton (Lautsprecher/Fernseher)                                                                                             | Klänge passen, nerven nicht, nicht zu laut; `?volume=` / `?mute=1` wirken                                                                                                                                                                                                                                                                                                                                                                             |          |          |
| P10 | Bildrate am PC während der Minispiele (`&debug=1`)                                                                       | flüssig (Wert notieren, Rechner/Browser angeben)                                                                                                                                                                                                                                                                                                                                                                                                      |          |          |
| P11 | Host-Tab mitten im Minispiel neu laden                                                                                   | Minispiel startet mit Restzeit neu, Partie läuft weiter                                                                                                                                                                                                                                                                                                                                                                                               |          |          |

### Gesamturteil M3 (für CHAOS-35)

| Frage                                                 | Antwort |
| ----------------------------------------------------- | ------- |
| Versteht man jedes Minispiel schnell?                 |         |
| Sind die Ergebnisse klar unterscheidbar?              |         |
| Macht das Chaos Spaß und bleibt fair?                 |         |
| Passen Figuren und Stil zur Produktrichtung?          |         |
| Lieblings- und schwächstes Minispiel, warum?          |         |
| Entscheidung (APPROVED / CHANGES REQUESTED / BLOCKED) |         |

## 11. M4 – Performance (für CHAOS-43)

**Stand:** 2026-11-15 · **Aufgabe:** CHAOS-39 · **Gate:** CHAOS-43 (nur Ruben) · **Hintergrund:** [performance.md](performance.md)

Automatisch gemessen wird nur im Headless-Chromium mit Software-Rendering (SwiftShader, `pnpm perf`): Das taugt für Vorher/Nachher-Vergleiche, sagt aber **nichts** über Rubens PC, Fernseher oder iPhones. Einmal gemessen ist ein Mac mit M3 Max (CHAOS-73, [performance.md §3b](performance.md#3b-erste-messung-auf-echter-gpu-chaos-73)); Zielwert für CHAOS-73: Brett und alle drei Minispiele in 1080p mit Bildabstand p95 ≤ 20 ms (≥ 50 fps). Diese Punkte liefern die echten Werte; daraus werden die Schwellen für echte Hardware (bis dahin: „offen, Messung durch Ruben“).

**So geht’s:** Host mit `http://localhost:8787/host/?debug=1` öffnen, Controller-Links um `&debug=1` ergänzen. Die Host-Anzeige (unten rechts) misst je Szene (`lobby`, `brett`, `minispiel:<id>`, Anleitung/Ergebnis als `minispiel:<id>:intro`/`:results`, `finale`, `podest`); „Alle Szenen kopieren“ legt eine Zeile je Szene in die Zwischenablage. Der Controller zeigt die Rundlaufzeit und kopiert sie je Szene (`lobby`, `brett`, `minispiel`, `endstand`). Kopierten Text bitte vollständig in die Spalte „Ergebnis“ oder als Datei nach `docs/acceptance/m4-nachweise/` legen.

| ID   | Schritt                                                                                                                                                                     | Erwartung / was notieren                                                                                                               | Ergebnis | Nachweis |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------- |
| PF0  | Testumgebung: PC (Betriebssystem, CPU, GPU), Browser + Version, Monitor/Fernseher (Auflösung, Bildwiederholrate), Fenster/Vollbild, Netz (WLAN/Kabel)                       | vollständig ausgefüllt; die Host-Zeile nennt GPU und Render-Auflösung                                                                  |          |          |
| PF1  | Ganze Partie mit 4 Spielern (`ROUNDS=5 pnpm start`, jedes Minispiel einmal; seit CHAOS-79 fünf Minispiele), Host mit `?debug=1`; am Siegerbildschirm „Alle Szenen kopieren“ | Zeilen für `lobby`, `brett`, alle fünf Minispiele, `finale`, `podest`; Text einfügen                                                   |          |          |
| PF2  | Bildrate je Szene aus PF1: fps und Bildabstand p95 je Szene                                                                                                                 | Werte notieren; gefühlt flüssig (1–5) je Szene; Ruckler wann?                                                                          |          |          |
| PF3  | Eingabe→Frame im Minispiel und Brett→Frame auf dem Brett (aus PF1)                                                                                                          | Median/p95 notieren (misst bis Ende des JS-Renderings, ohne GPU/Bildschirm, ADR-010)                                                   |          |          |
| PF4  | WebGL-Kontexte und Render-Schleifen (aus PF1)                                                                                                                               | `finale` und `podest`: „Kontexte max 2“, „Schleifen max 1“ (Brett pausiert hinter dem Finale); jede andere Szene 1 Kontext, 1 Schleife |          |          |
| PF5  | iPhone mit `&debug=1` eine ganze Partie spielen, am Endstand „Kopieren“                                                                                                     | RTT Median/p95 je Szene (`lobby`, `brett`, `minispiel`) notieren; Bewertung der gefühlten Reaktion 1–5                                 |          |          |
| PF6  | Geteiltes iPad mit `&seats=2&debug=1` (falls verfügbar), wie PF5                                                                                                            | RTT je Szene; Unterschied zum iPhone?                                                                                                  |          |          |
| PF7  | Optional: Zeitlupenvideo (240 fps) von Daumen und Fernseher im Minispiel                                                                                                    | Bilder zwischen Daumenbewegung und Figurbewegung → ms (Gesamtlatenz Finger → Bild, nicht automatisch messbar)                          |          |          |
| PF8  | Zweimal „Nochmal spielen“ (3 Partien hintereinander), danach in der Lobby „Alle Szenen kopieren“                                                                            | `Heap max` der Lobby nach Partie 3 ungefähr wie nach Partie 1 (nur Chrome/Edge zeigen den Heap); keine spürbare Verlangsamung          |          |          |
| PF9  | Host-Tab mitten im Brett 30 s in den Hintergrund (anderer Tab/minimiert), dann zurück                                                                                       | „Pausen“ steigt um 1; Spiel läuft danach normal weiter, kein Nachruckeln                                                               |          |          |
| PF10 | Optional: schwächster verfügbarer Rechner (z. B. Laptop mit integrierter Grafik), wie PF1                                                                                   | Werte wie PF2; ab welcher Szene wird es unflüssig?                                                                                     |          |          |

### Schwellen auf echter Hardware (offen, Messung durch Ruben)

| Kennzahl                                 | Schwelle                   | Herkunft                                                                                     |
| ---------------------------------------- | -------------------------- | -------------------------------------------------------------------------------------------- |
| Bildabstand p95 je Szene am Host-PC      | offen                      | aus PF1/PF2; Vorschlag nach der Messung: Messwert von Rubens PC + 25 % als Regressionsgrenze |
| Eingabe→Frame p95 im Minispiel           | offen                      | aus PF3                                                                                      |
| RTT p95 Controller ↔ Server je Szene     | offen                      | aus PF5/PF6 (M1-P3 wurde nicht gemeldet)                                                     |
| WebGL-Kontexte/Render-Schleifen je Szene | strukturell, schon gesetzt | `tests/perf/baseline.json`: Finale/Podest höchstens 2 Kontexte und 1 Schleife, sonst 1/1     |

## 12. M4 – Vollständiger Slice (für CHAOS-43)

**Stand:** 2026-11-15 · **Aufgabe:** CHAOS-41 · **Gate:** CHAOS-43 (M4-Abnahme, nur Ruben) · **Ablauf:** [m4-demo.md](m4-demo.md)

Automatisch geprüft (Chromium-Emulation, synthetische CDP-Touches, echter Server, beschleunigtes Test-Pacing): `tests/e2e/m4-gesamtablauf.spec.ts` spielt zwei komplette Partien über die echte Controller-UI – zwei iPhones mit 2 Runden und gemischt 2 iPhones + iPad mit 2 Zonen – inklusive Figurenwahl, Rundenwahl und Start am PC, Pause/Weiter, Neuladen eines Controllers (Brett bzw. Minispiel), Trophäenzählung, Siegerbildschirm, Endstand auf jedem Controller (gleicher Platz wie am PC) und „Nochmal spielen“. Dazu Reconnect je Phase und Host-Verlust in der Server-Integration (`reconnect.integration.test.ts`, `hostLoss.integration.test.ts`). **Nichts davon ersetzt echte Geräte, echtes WLAN, echte Hände und echten Spaß.** Diese Liste ist für Rubens Durchgang; Claude trägt keine Ergebnisse ein.

Vorher erledigen bzw. mitprüfen: iPad-Nachtest aus Abschnitt 4 (I1–I9, CHAOS-47) Performance aus Abschnitt 11 (PF0–PF10, gleiche Partie mit `?debug=1` möglich) und Natur-Look aus Abschnitt 13 (N1–N7, CHAOS-62). Start: `pnpm build && pnpm start`, Host `http://localhost:8787/host/`.

Ergebnis je Punkt wie oben: `ok` · `fehlerhaft` (mit Beschreibung) · `nicht unterstützt` · `nicht geprüft`.

### 12.1 Komplette Partie ohne Entwicklerhilfe

| ID  | Schritt                                                                                                                                                                                       | Erwartung                                                                                                                               | Ergebnis | Datum / Gerät | Nachweis |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------- | -------- |
| V1  | Vier Personen, die das Spiel nicht kennen, spielen eine komplette Partie (Standard 10 Runden). Ruben startet nur den Server und öffnet den Host; danach **keine** Erklärung und kein Eingriff | Beitritt per QR, Figurenwahl, Bereit, Start, alle Runden, Finale und Siegerbildschirm ohne Rückfrage; notieren, wo jemand fragen musste |          |               |          |
| V2  | Partiedauer mit Stoppuhr messen (von „Los geht’s!“ bis Siegerbildschirm), Zahl der Spieler notieren                                                                                           | Dauer: ___ min bei ___ Spielern und 10 Runden (Vorhersage EXP-011: ≈ 14–16 min mit 3–4 Spielern)                                        |          |               |          |
| V3  | Rundenwahl in der Lobby: 10 / 16 / 20 antippen bzw. anklicken, Zeitangabe lesen                                                                                                               | Auswahl sofort sichtbar, auch auf allen Controllern („10 Runden“); geschätzte Dauer verständlich                                        |          |               |          |
| V4  | Lesbarkeit am Fernseher aus Sofa-Abstand: Lobby mit Figuren, Brett-HUD, Minispiel-Anleitung, Ergebnis, Trophäenzählung, Siegerbildschirm                                                      | Namen, Figuren, Zahlen und Ansagen lesbar; jeder findet sich selbst über Farbe + Symbol + Figur                                         |          |               |          |
| V5  | Ton über Fernseher/Lautsprecher während der ganzen Partie (Brett, Minispiele, Trophäenzählung, Siegerbildschirm)                                                                              | Klänge passen, nichts nervt nach 10 Runden, Lautstärke angemessen; `?volume=`/`?mute=1` wirken                                          |          |               |          |
| V6  | Trophäenzählung am Ende in normalem Tempo ansehen (kein Überspringen)                                                                                                                         | Spannung kommt auf; Aufdecken vom letzten Platz an ist verständlich; bei Gleichstand wird erklärt, was entscheidet                      |          |               |          |
| V7  | Siegerbildschirm: Podest, Endstand, Bonus-Titel; Controller zeigen den eigenen Endstand                                                                                                       | Gewinner sofort klar; Platz am Controller stimmt mit dem PC überein (auch geteilte Plätze)                                              |          |               |          |
| V8  | „Nochmal spielen“ am PC (Klick oder Enter)                                                                                                                                                    | Alle Controller landen in der Lobby, jede Person behält ihre Figur, „Bereit!“ erscheint wieder; Rundenzahl bleibt                       |          |               |          |
| V9  | Revanche direkt spielen (zweite Partie, gern kürzer)                                                                                                                                          | Zweite Partie startet ohne Neuladen von Host oder Controllern; nichts aus Partie 1 hängt nach                                           |          |               |          |

### 12.2 Vier iPhones

| ID  | Schritt                                                                                        | Erwartung                                                                                                                                                          | Ergebnis | Datum / Gerät | Nachweis |
| --- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | ------------- | -------- |
| V10 | Vier iPhones treten per QR bei und wählen gleichzeitig Figuren, zwei Personen bewusst dieselbe | Wer zuerst kommt, bekommt sie; die andere Person sieht „Die Figur hat sich gerade jemand anderes geschnappt.“ und die Karte als vergeben (mit Farbe des Besitzers) |          |               |          |
| V11 | Nach „Bereit!“ noch einmal umwählen                                                            | „Bereit“ wird zurückgesetzt, Host zeigt es sofort; erneut „Bereit!“ nötig                                                                                          |          |               |          |
| V12 | Ganze Runde mit vier iPhones: Prompts, Reaktionsfenster, Minispiel                             | Nur wer dran ist, bekommt Knöpfe; die anderen sehen, wer dran ist; Minispiel mit vier Daumen gleichzeitig ohne Übersprechen                                        |          |               |          |

### 12.3 Geteiltes iPad mit 4 Zonen

| ID  | Schritt                                                                                                                     | Erwartung                                                                                                                                                               | Ergebnis | Datum / Gerät | Nachweis |
| --- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------- | -------- |
| V13 | iPad mit `&seats=4` beitreten (Host-Lobby: „iPad“, Link anpassen oder Code-Eingabe), vier Personen am iPad                  | Vier Zonen in vier Farben; Host zeigt vier Spieler                                                                                                                      |          |               |          |
| V14 | Figurenwahl mit **vier Fingern gleichzeitig** (jede Person tippt ihre Figur zur selben Zeit)                                | Jede Wahl landet in der richtigen Zone; keine Zone wählt für eine andere                                                                                                |          |               |          |
| V15 | Zwei Zonen tippen gleichzeitig dieselbe Figur                                                                               | Eine bekommt sie; in der **anderen Zone** erscheint der Hinweis „Figur weggeschnappt“ (gedreht wie die Zone), nicht in einer fremden                                    |          |               |          |
| V16 | Lesbarkeit der gedrehten Zonen (gegenübersitzende Personen): Lobby, Prompts, Minispiel-Anleitung, Ergebnis, Pause, Endstand | Jede Person liest ihre Zone ohne Kopfverrenken; nichts abgeschnitten                                                                                                    |          |               |          |
| V17 | Komplette Partie (gern 3 Runden) nur mit dem iPad                                                                           | Brett-Entscheidungen, Reaktionen und Minispiele mit mehreren Fingern zuverlässig; Systemgesten stören nicht (sonst „Geführter Zugriff“, [ipad-zonen.md](ipad-zonen.md)) |          |               |          |

### 12.4 Gemischt: 2 iPhones + iPad mit 2 Zonen

| ID  | Schritt                                                 | Erwartung                                                                                               | Ergebnis | Datum / Gerät | Nachweis |
| --- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | -------- | ------------- | -------- |
| V18 | Zwei iPhones per QR, iPad über den iPad-Link (2 Plätze) | Vier Spieler; die iPad-Zonen sehen die Figuren der iPhones als vergeben (mit deren Farbe) und umgekehrt |          |               |          |
| V19 | Partie über mindestens 3 Runden                         | Alle vier gleich gut bedienbar; Minispiel mit iPhones und iPad-Zonen gleichzeitig ohne Übersprechen     |          |               |          |

### 12.5 Verbindung und Wiederkehr je Phase

Jeweils ein Controller (iPhone, einmal auch das iPad) **während** der genannten Phase: Seite neu laden, Sperrbildschirm 10–20 s, App-Wechsel 30 s. Erwartung überall: gleicher Platz, gleiche Figur, richtiger Bildschirm der aktuellen Phase, Partie läuft ohne Abbruch weiter; der Host zeigt dazwischen „getrennt“.

| ID  | Phase                                                            | Erwartung zusätzlich                                                                                                                                                                                                                                                    | Ergebnis | Datum / Gerät | Nachweis |
| --- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------- | -------- |
| V20 | Lobby (Figur gewählt, bereit)                                    | Figur bleibt; „bereit“ bleibt oder ist klar zurückgesetzt                                                                                                                                                                                                               |          |               |          |
| V21 | Eigener Zug (Würfeln/Weg/Trophäe offen)                          | Innerhalb ~15 s zurück: derselbe Prompt; später: Spiel hat automatisch gewählt, aktueller Stand                                                                                                                                                                         |          |               |          |
| V22 | Reaktionsfenster (Münzklau gegen diese Person)                   | Nach Rückkehr: Fenster noch offen oder Ergebnis sichtbar; nichts hängt                                                                                                                                                                                                  |          |               |          |
| V23 | Minispiel (Spiel läuft)                                          | Nach Rückkehr wieder Joystick/Knöpfe, Eingaben wirken sofort; iPad: beide Zonen zurück                                                                                                                                                                                  |          |               |          |
| V24 | Pause                                                            | Nach Rückkehr Pause-Bildschirm; nach „Weiter“ am PC normal weiter                                                                                                                                                                                                       |          |               |          |
| V25 | Endstand                                                         | Eigener Endstand (Platz, Figur, Trophäen, Münzen) wieder da; „Nochmal spielen“ am PC holt das Gerät in die Lobby                                                                                                                                                        |          |               |          |
| V26 | Host-Tab am PC neu laden mitten im Brett und mitten im Minispiel | Partie pausiert automatisch (Controller zeigen Pause), bis Brett bzw. Minispiel am PC fertig geladen ist; erst dann geht es weiter, ohne Pause-Fenster am PC. Minispiel startet mit der Restzeit vom Moment des Neuladens, auch wenn das Laden länger dauert (CHAOS-68) |          |               |          |

### 12.6 Pause und Ende am PC

| ID  | Schritt                                                           | Erwartung                                                                                                                                                                                                 | Ergebnis | Datum / Gerät | Nachweis |
| --- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------- | -------- |
| V27 | Mitten im Zug „Pause“ (Knopf oder Taste P/Esc)                    | PC zeigt Pause mit „Weiter“ und „Partie beenden“; alle Controller zeigen „Pause – Der PC hat angehalten.“ ohne Knöpfe; Countdowns stehen                                                                  |          |               |          |
| V28 | Pause mitten im Minispiel, nach 20 s „Weiter“                     | Minispiel steht still und läuft mit derselben Restzeit weiter                                                                                                                                             |          |               |          |
| V29 | „Partie beenden“ → Rückfrage → bestätigen                         | Finale mit Hinweis „vorzeitig beendet“; Controller zeigen den Endstand mit diesem Hinweis                                                                                                                 |          |               |          |
| V30 | Nach einem Minispiel mit klarem letzten Platz (CHAOS-51, EXP-019) | PC-Ergebniskarte zeigt beim letzten Platz „Trostpreis“ mit Item, in den 6 s lesbar; nur das Handy dieser Person zeigt „Trostpreis: …“; das Item ist danach im Brett-HUD und beim nächsten Würfeln wählbar |          |               |          |

### Gesamturteil M4 (für CHAOS-43)

| Frage                                                                                                                                                                                                                                        | Antwort |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| Hat die Gruppe eine ganze Partie ohne Entwicklerhilfe geschafft (V1)?                                                                                                                                                                        |         |
| Ist die Steuerung angenehm (iPhone, iPad-Zonen, gemischt)?                                                                                                                                                                                   |         |
| Sind die Regeln verständlich (Würfeln, Trophäen, Items, Minispiele, Wertung)?                                                                                                                                                                |         |
| Wollte die Gruppe direkt noch eine Runde spielen?                                                                                                                                                                                            |         |
| Echte Partiedauer bei 10 Runden (V2) – passt 10 als Standard, oder lieber kürzer/länger?                                                                                                                                                     |         |
| Hatte der Führende zur Halbzeit einen uneinholbaren Vorsprung, oder blieb es spannend?                                                                                                                                                       |         |
| Ist Sabotage (Klau, Falle) zu zahm – besonders zu zweit? Seit EXP-018 wächst sie ab Runde 6 (Klau 6, 7, 8), seit CHAOS-120 mit Ansage am PC („Sabotage wird stärker!“, Abschnitt 24): Fällt das auf, wird das Ende spannender oder gemeiner? |         |
| Wurde der Münz-Tiebreak bei Trophäengleichstand verstanden (Trophäenzählung, V6)?                                                                                                                                                            |         |
| Lieblingsmoment und größtes Ärgernis                                                                                                                                                                                                         |         |
| Entscheidung (APPROVED / CHANGES REQUESTED / BLOCKED)                                                                                                                                                                                        |         |

## 13. Natur-Look am PC und Fernseher (für CHAOS-56/CHAOS-62)

**Stand:** 2026-11-15 · **Aufgabe:** CHAOS-62 · **ADR:** [ADR-014](decisions/ADR-014-natur-look.md) · Belege der Automatik: `docs/screenshots/chaos62-*.jpg` (volle Stufe, Software-Rendering, nur Optik, keine Bildrate)

Automatisch geprüft: Spielabläufe, Screenshot-Regression in der Sparstufe `minimal`, Asset-Manifest und Lizenzen (nur CC0). **Nicht** automatisch prüfbar: Bildrate auf echter GPU, Wirkung am Fernseher. `pnpm build && pnpm start`, Host mit `?debug=1` öffnen; die Debug-Zeile nennt die Grafikstufe und die erkannte Bildwiederholrate („Grafik hoch (auto, 60 Hz)“, CHAOS-76) und die tatsächliche Renderauflösung (seit CHAOS-73 höchstens 2560×1440 bei `hoch`, 1920×1080 bei `mittel`, 1600×900 bei `niedrig`). Stuft die Automatik ab, gilt die Stufe für den Rest der Sitzung (Neuladen setzt sie zurück). N1 und N2 lassen sich in derselben Partie wie PF1 (Abschnitt 11) messen.

| ID  | Schritt                                                                                                                                                                                     | Erwartung                                                                                                                                                                                                                                          | Ergebnis | Nachweis |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------- |
| N1  | Brett 2 min laufen lassen (2–4 Spieler), Messzeile kopieren                                                                                                                                 | ≥ 50 fps bei `hoch`; bleibt die Stufe auf „hoch (auto)“ oder stuft die Automatik ab? Wert und GPU notieren                                                                                                                                         |          |          |
| N2  | Jedes Minispiel einmal mit `?debug=1`                                                                                                                                                       | flüssig (≥ 50 fps); Stufe aus der Debug-Zeile beim nächsten Brett notieren (die Minispiel-Bühne zeigt keine eigene, die Stufe gilt für die Sitzung)                                                                                                |          |          |
| N3  | Zum Vergleich `?qualitaet=mittel` und `?qualitaet=niedrig`                                                                                                                                  | fps je Stufe; sieht man den Unterschied aus 3 m?                                                                                                                                                                                                   |          |          |
| N4  | Ruckeln beim Wechsel Brett → Minispiel → Brett; dabei auf die Anleitungskarte achten (läuft der Countdown gleichmäßig?)                                                                     | kein langes Standbild beim Laden (Himmel, Texturen); seit CHAOS-132 übersetzt der Host Shader schrittweise, seit CHAOS-152 baut er das Brett nach dem Minispiel nicht mehr neu auf. Falls Standbild: ungefähre Dauer, Grafikstufe (`?debug=1`) und Richtung (zum Minispiel oder zurück zum Brett) notieren (für CHAOS-152/174; SwiftShader zeigt hier ≈ 0,8 s Warten auf den GPU-Prozess, EXP-030) |          |          |
| N5  | Lesbarkeit aus 3 m am Fernseher                                                                                                                                                             | Feldtypen (Farbe **und** Form der Einlage, Symbol), Figuren, Sockel und Slot-Symbol sofort erkennbar; Wegpfeile und Wegweiser lesbar                                                                                                               |          |          |
| N6  | Optional: `?stimmung=nacht` und `?stimmung=morgen`                                                                                                                                          | Felder und Slot-Farben auch nachts lesbar (Lichtverlauf je Runde: Abschnitt 14)                                                                                                                                                                    |          |          |
| N7  | Gesamteindruck Brett und Minispiel-Arenen                                                                                                                                                   | „modern und schön“? Was stört noch?                                                                                                                                                                                                                |          |          |
| N8  | Nur falls ein Bildschirm mit 30 Hz (oder 50 Hz) vorhanden ist, z. B. 4K-Fernseher über HDMI 1.4 (CHAOS-76): Host **ohne** `?qualitaet` und mit `?debug=1` öffnen, Brett 2 min laufen lassen | Debug-Zeile zeigt „Grafik hoch (auto, 30 Hz)“ (bzw. 50 Hz) und bleibt bei `hoch`, solange das Bild flüssig ist; fps um 30. Stuft sie trotzdem ab: Grafikkarte, Hz-Angabe und fps notieren                                                          |          |          |

## 14. Lichtverlauf je Runde am Fernseher (für CHAOS-56/CHAOS-63)

**Stand:** 2026-11-16 · **Aufgabe:** CHAOS-63 · Beleg der Automatik: `docs/screenshots/chaos63-lichtverlauf.jpg` (Stufe `mittel`, Software-Rendering, nur Optik, keine Bildrate)

Automatisch geprüft: Reihenfolge der Stimmungen je Rundenzahl und stetige Überblendung (`apps/host/src/lighting/transition.test.ts`), Rundenwechsel 2→5 am Brett mit Fortschritt der Überblendung und Nachtbild in der Sparstufe (`host-brett.spec.ts`). **Nicht** automatisch prüfbar: Wirkung und Lesbarkeit am Fernseher, Bildrate nachts auf echter GPU, ob man den Wechsel des Umgebungslichts zur Hälfte der Überblendung sieht. Ablauf: `pnpm build && pnpm start`, Partie mit 5 Runden (Standard) und `?debug=1`; für mehr Runden in der Lobby umstellen.

| ID  | Schritt                                                               | Erwartung                                                                                                                                               | Ergebnis | Nachweis |
| --- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------- |
| L1  | Partie mit 5 Runden durchspielen                                      | Runde 1 Morgen, 2 Mittag, 3 Goldene Stunde, 4 Dämmerung, 5 Nacht; Minispiele in derselben Stimmung wie ihre Runde                                       |          |          |
| L2  | Rundenwechsel beobachten (nach dem Minispiel, „Runde x beginnt!“)     | weiche Überblendung über ≈ 4 s, kein Standbild, kein Ruckler, kein sichtbarer Sprung des Himmels; fällt der Wechsel des Umgebungslichts zur Hälfte auf? |          |          |
| L3  | Lesbarkeit aus 3 m in jeder Stimmung                                  | Feldtypen (Farbe **und** Form, Symbol), Figuren, Sockel und Slot-Farben erkennbar, besonders in Dämmerung und Nacht (leuchtende Felder nicht zu blass)  |          |          |
| L4  | HUD-Unterzeile „Wackelwald · Runde x/y“ oben links                    | in Dämmerung und Nacht hell und lesbar                                                                                                                  |          |          |
| L5  | Bildrate in Runde 4 und 5 (`?debug=1`, bis zu 6 Lichter pro Material) | ≥ 50 fps bei `hoch`, sonst Stufe notieren; Vergleich zur Bildrate in Runde 1–2                                                                          |          |          |
| L6  | Optional: 10 Runden                                                   | Stimmungen nie rückwärts, letzte Runde nachts                                                                                                           |          |          |
| L7  | Gesamteindruck „ein Tag pro Partie“                                   | passt der Verlauf? Zu schnell dunkel, zu lang hell?                                                                                                     |          |          |

## 15. Lobby und Siegerehrung im Natur-Look (für CHAOS-56/CHAOS-77)

**Stand:** 2026-11-16 · **Aufgabe:** CHAOS-77 · Belege der Automatik: `docs/screenshots/chaos77-lobby.jpg`, `chaos77-arena.jpg`, `chaos77-podest.jpg` (Stufe `mittel`, Software-Rendering, nur Optik, keine Bildrate)

Automatisch geprüft: Lobby, Arena und Siegerbildschirm laden ohne Fehler, Physik und Eingaben der Arena unverändert, Screenshot-Regression in der Sparstufe `minimal`. **Nicht** automatisch prüfbar: Wirkung am Fernseher, Bildrate, Standbild beim Übergang zum Podest auf echter GPU (CHAOS-71). Ablauf: `pnpm build && pnpm start`, Host mit `?debug=1`, eine kurze Partie bis zur Siegerehrung.

| ID  | Schritt                                                                                                 | Erwartung                                                                                                                                                        | Ergebnis | Nachweis |
| --- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------- |
| LS1 | Lobby öffnen, zwei Controller beitreten lassen                                                          | Goldene Stunde: warmes, tiefes Licht, lange Schatten, Lichtung mit Baumstämmen; QR-Code und Panel gut lesbar; Unterzeile oben links hell und lesbar              |          |          |
| LS2 | In der Lobby mit den Figuren herumlaufen und schubsen                                                   | Bewegung und Banden wie vorher, Figuren und Slot-Farben gut erkennbar; flüssig (Debug-Zeile: Stufe und fps notieren)                                             |          |          |
| LS3 | Übergang Trophäenzählung → Siegerbildschirm, einmal mit voller Zählung und einmal sofort „Überspringen“ | kein Standbild > 1 s (CHAOS-71: Podest entsteht schon während der Zählung); ruckelt die Zählung selbst kurz? Falls Standbild: Dauer, Stufe und Variante notieren |          |          |
| LS4 | Siegerbildschirm aus 3 m                                                                                | Nacht mit Spot, Laternen und Glühwürmchen; Platzziffern, Figuren und leuchtende Slot-Deckel sofort erkennbar; Endstand rechts gut lesbar                         |          |          |
| LS5 | Gesamteindruck                                                                                          | Passen Lobby und Siegerehrung zum Look des Bretts? Zu dunkel, zu bunt, zu blass?                                                                                 |          |          |

## 16. Renderer-Spike: WebGPU, Bevy WebAssembly, Bevy nativ (für CHAOS-75)

**Stand:** 2026-11-17 · **Aufgabe:** CHAOS-75; PC-Teile entfallen (CHAOS-131: kein PC, nur am Mac messen) · **Entscheidung:** [ADR-016](decisions/ADR-016-renderer.md) (angenommen) · **Anleitung und Messbogen:** [`renderer-spike.md`](renderer-spike.md)

Automatisch geprüft: Bau aller Varianten, Unit-Tests für `?gpu=` und die Messanzeige, Bild der Bevy-WebGL2-Fassung unter Software-Rendering (nur Optik). **Nicht** automatisch prüfbar: jede Bildrate, das Aussehen unter WebGPU (die Software-GPU der Cloud verliert das Gerät beim ersten Bild; den Aufbau des Bretts unter WebGPU prüft seit CHAOS-117 nur ein Test-Skript mit Ersatz-Canvas, siehe EXP-015), Bevy nativ mit Fenster, Apple TV.

| ID  | Schritt                                                                                                         | Erwartung                                                                                                                                                     | Ergebnis                                                                               | Nachweis                                    |
| --- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------- |
| RS1 | Brett mit `&gpu=webgpu&qualitaet=hoch` in Chrome/Edge am PC und in Safari 26 am Mac (nach CHAOS-117 neu prüfen) | Messanzeige nennt „WebGPU …“ und nach einigen Sekunden „Schleifen 1“, Frames steigen; Brett sieht aus wie mit WebGL2 (Schatten, Gras, Figuren, Schrift, SSAO) | Chromium 153 am Mac: ok (17.11., Claude), sieht aus wie WebGL2. Safari 26 und PC offen | `screenshots/chaos117-brett-webgpu-mac.jpg` |
| RS2 | Messbogen R1–R3, R7–R8 (Babylon WebGL2 vs. WebGPU)                                                              | Bildabstand je Variante; Vorteil von WebGPU in %                                                                                                              |                                                                                        |                                             |
| RS3 | Bevy WebAssembly, `?variante=webgpu` und `webgl2` (R4, R5, R9)                                                  | Szene erscheint wie im Referenzbild; `SPIKE-ERGEBNIS` kopieren                                                                                                |                                                                                        |                                             |
| RS4 | Bevy nativ (R6, R10)                                                                                            | Fenster mit der Szene; `SPIKE-ERGEBNIS` aus dem Terminal                                                                                                      |                                                                                        |                                             |
| RS5 | Gesamteindruck                                                                                                  | Sieht eine der Varianten deutlich flüssiger aus? Lohnt sich der Umbau?                                                                                        |                                                                                        |                                             |

## 17. RealityKit-Prototyp auf Apple TV und Mac (für CHAOS-78)

**Stand:** 2026-11-16 · **Aufgabe:** CHAOS-78 · **Experiment:** [EXP-017](experiments.md) · **Anleitung:** [`spikes/renderer-realitykit/README.md`](../spikes/renderer-realitykit/README.md)

Automatisch geprüft: Bau für macOS, iOS-Simulator und tvOS-Simulator; volle Szene (64 246 Instanzen) im iPad- und tvOS-Simulator sichtbar ([Bild tvOS](screenshots/chaos78-realitykit-tvos-sim.jpg)); Handshake der App mit dem lokalen Server bis `lobby`. **Nicht** automatisch prüfbar: Bildrate auf einer echten Apple TV, Signieren für Geräte, Idle-Animation sichtbar, Figuren bewegen sich bei echtem `board`-Stand. iPhone/iPad sind hier nur Renderer-Benchmark, kein Spiel-Host.

| ID  | Schritt                                                                                                                                           | Erwartung                                                                                                                                                                                        | Ergebnis                                                                                                                                             | Nachweis                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| RK1 | Mac: `ChaosRenderSpike --sekunden=30` mit sichtbarem Fenster, sonst nichts laufen lassen (kein GeForce NOW, kein Vollbild-Spiel)                  | `SPIKE-ERGEBNIS` mit Median ≈ 8,3 ms (120 Hz); p95 eintragen (R13)                                                                                                                               | ok (17.11., 60-Hz-Monitor): 60 fps am Deckel, GPU 6,3 ms (1080p) / 7,3 ms (4K)                                                                       | EXP-017                                      |
| RK2 | Mac: dasselbe mit `--durchsatz=1` (R14) und `--breite=3840 --hoehe=2160`                                                                          | Offscreen-Bildzeit 1080p und 4K                                                                                                                                                                  | ok (17.11.): 16,6 ms / 49,6 ms                                                                                                                       | EXP-017                                      |
| RK3 | Xcode: Team eintragen (ob ein kostenloser Apple-Account für tvOS-Geräte reicht, prüfen; Profile gelten dann 7 Tage), App auf die Apple TV spielen | App startet, Brett mit Gras, Figuren, Schatten                                                                                                                                                   | ok (17.11., bezahltes Team, Apple TV per Xcode gekoppelt, Build mit `-destination id=<UDID> -allowProvisioningDeviceRegistration`)                   | `devicectl` install/launch, `SPIKE-ERGEBNIS` |
| RK4 | Apple TV 1080p und 4K, `--sekunden=30` (Argumente im Xcode-Schema) (R12)                                                                          | Median 16,7 ms (60 Hz) halten; p95 und Eindruck notieren                                                                                                                                         | 4K: **nicht erfüllt**, 20 fps (Median 51 ms, GPU 34,7 ms). 1080p entfällt: Ruben bleibt bei 4K-Ausgabe (17.11.)                                      | EXP-017                                      |
| RK5 | Apple TV mit `--server=ws://<mac>:8787/ws`, Partie mit Controllern starten                                                                        | Figuren springen auf ihre Felder (keine Laufanimation)                                                                                                                                           | entfällt: ADR-019 wählt W2 (Apple TV hostet allein); der Protokollweg ist dort auf der echten Apple TV gezeigt (CHAOS-138, Partie bis ins Minispiel) | EXP-024                                      |
| RK6 | Gesamteindruck am Fernseher                                                                                                                       | Sieht der RealityKit-Look gut genug aus (kein HDRI, keine Nachbearbeitung, Gesichter ohne Leuchten)?                                                                                             | verschoben: Der Look wird mit der echten Brett-Grafik im Apple-Host beurteilt (CHAOS-148, Figuren direkt als USDZ aus bpy, ADR-019 §5)               |                                              |
| RK7 | Mac oder Apple TV mit `--server=ws://<pc>:8787/ws`, Partie mit Controllern bis aufs Brett, dann die App beenden und neu starten (CHAOS-121)       | Am PC-Server pausiert die Partie beim Abriss; sobald Brett und Figuren wieder stehen, läuft sie ohne 30 s Wartezeit weiter. Log: `Server: host-ready gesendet`. Figuren stehen auf ihren Feldern |                                                                                                                                                      | Log-Auszug                                   |

## 18. Apple TV bei 4K: interne Auflösung und Hochskalierung (für CHAOS-114)

**Stand:** 2026-11-17 · **Aufgabe:** CHAOS-114 · **Experiment:** [EXP-020](experiments.md) · **Anleitung:** [`spikes/renderer-realitykit/README.md`](../spikes/renderer-realitykit/README.md), Abschnitt „Hochskalierter Pfad und Profilierung“

Automatisch geprüft ist nur der Build: Die CI (Xcode 26.6) baut für macOS, iOS und tvOS, mit dem tvOS-SDK 26.5 ohne MetalFX. Alles Weitere braucht Rubens Mac und die echte Apple TV.

| ID   | Schritt                                                                                        | Erwartung                                                                                                 | Ergebnis                                                                                                                  | Nachweis                     |
| ---- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| RK7  | Mac: `xcodegen generate`, Release für macOS und tvOS bauen                                     | baut ohne Fehler; sonst Fehlermeldung an CHAOS-114                                                        | ok (17.11., Xcode 27, tvOS-Gerät)                                                                                         | Build-Log                    |
| RK8  | Mac: `ChaosRenderSpike --hochskalieren=1 --sekunden=20` und `--skalierer=bilinear`             | Bild erscheint, `SPIKE-ERGEBNIS` mit `"spike":"CHAOS-114"`, `skalierer` `metalfx-spatial` bzw. `bilinear` |                                                                                                                           | Log                          |
| RK9  | Apple TV: tvOS-Version notieren (Einstellungen → Allgemein → Info); MetalFX braucht ≥ 27.2     | Version notiert                                                                                           | tvOS 27.3 (24K5298d); MetalFX trotzdem **nicht verfügbar**, Rückfall bilinear                                             | `SPIKE-ERGEBNIS` `os`        |
| RK10 | Apple TV: `./messreihe-atv.sh <ID> 20` (alle Varianten, ca. 10 Min.)                           | `zusammenfassung.tsv`; Ziel: `hoch-0.5-metalfx` ≥ 30 fps stabil, besser 60 (R16–R19)                      | ok (17.11., Claude per `devicectl`): Standardvarianten 12–45 fps; **`--skala=0.5 --msaa=0 --imflug=3` hält 60 fps** (R20) | EXP-020                      |
| RK11 | Apple TV: `--hochskalieren=1 --bild=…` für 0,5 und 0,667 sowie die ARView am Fernseher ansehen | Schärfe aus Sofa-Abstand vertretbar? Schilder lesbar, Gras nicht matschig                                 |                                                                                                                           | Bilder, Eindruck             |
| RK12 | Instruments: Metal System Trace je einmal ARView und `--hochskalieren=1 --skala=1`             | größte GPU-Durchgänge mit Dauer notiert                                                                   |                                                                                                                           | `.trace` oder Bildschirmfoto |

## 19. Windstoß, Platztausch und Wegweiser am Fernseher (für CHAOS-52)

**Stand:** 2026-11-17 · **Aufgabe:** CHAOS-52 · **Bilder:** [Windstoß](screenshots/chaos52-windstoss.png), [Platztausch](screenshots/chaos52-platztausch.png)

Automatisch geprüft (Software-Rendering, feste Frames): Figur fliegt beim Windstoß hoch und weit zum Zielfeld, beim Platztausch sind beide Figuren gleichzeitig in der Luft und landen auf den getauschten Feldern; Wegweiser „Klippenweg“ steht im Demo-Stand neben dem Zug-Pfeil (`host-brett.spec.ts`). **Nicht** automatisch prüfbar: wie flüssig und lesbar das in echter Bildrate vom Sofa aus wirkt, ob Windringe und Tausch-Ringe auf dem Fernseher erkennbar sind.

| ID  | Schritt                                                                                | Erwartung                                                                                                                            | Ergebnis | Nachweis |
| --- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------- | -------- |
| WT1 | Partie, bis jemand auf ein Ereignisfeld (lila) kommt und „Windböe!“ erscheint          | Figur wirbelt in weißen Windringen davon und landet 1–2 Felder weiter; kein Sprung ohne Bewegung                                     |          |          |
| WT2 | Ereignis „Tausch!“                                                                     | Beide Figuren fliegen gleichzeitig auf Bögen über Kreuz, farbige Ringe an Abflug- und Zielfeld; man sieht, wer mit wem getauscht hat |          |          |
| WT3 | Gabel A (Klippenweg/Sumpfabkürzung) und Gabel B (Pilzpfad/Wackelbrücke) beim Wegwählen | Beide Schilder vollständig lesbar, keins liegt unter dem gelben Pfeil                                                                |          |          |

## 20. Apple-TV- und Mac-App über TestFlight (für CHAOS-119, CHAOS-151, CHAOS-200)

**Stand:** 2026-11-18 · **Aufgabe:** CHAOS-119, CHAOS-147 (TV6–TV9), CHAOS-151 (TH1–TH4), CHAOS-141 (TH5–TH6) · **Anleitung:** [`apps/apple-host/README.md`](../apps/apple-host/README.md), Abschnitt „TestFlight“; für TV4–TV9 [`spikes/renderer-realitykit/README.md`](../spikes/renderer-realitykit/README.md)

Automatisch geprüft ist nur, was ohne Mac geht: Icons erzeugt und angesehen, Nutzlast (`prepare.sh`) unter Linux gebaut, Abbruch des Skripts bei fehlender Nutzlast. Archivieren, Signieren und Upload laufen erst im Workflow `testflight-tv.yml` auf `main`.

**2026-11-19 (CHAOS-200):** TV1 erledigt Claude, TV3 teilweise: App-Eintrag „Chaos Party Host“ (Store-Name „Chaos Party“ war vergeben) mit tvOS und macOS, interne Gruppe „Intern“ mit Zugriff auf alle Builds, Ruben als Tester. TV2/TH1 grün (Lauf 44562548725, Build 20261119.1610); der Build war am Abend noch in der Verarbeitung bei Apple, die Gruppe bekommt ihn danach automatisch. Die Mac-App kommt seitdem als App-Store-Variante in denselben Eintrag (TM1–TM2).

Seit CHAOS-151 ist der neueste Build der native Host (`apps/apple-host`), nicht mehr der RealityKit-Spike. TV1–TV3 gelten unverändert. TV4–TV9 betreffen die älteren Spike-Builds; sie bleiben in der TestFlight-App unter den älteren Builds installierbar, bis sie ablaufen (90 Tage nach dem Upload).

| ID  | Schritt                                                                                                                                                                                                                                                                                 | Erwartung                                                                                                                                                                                | Ergebnis | Nachweis      |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------- |
| TV1 | App Store Connect: neue App, Plattform **tvOS**, Bundle-ID `dev.rubeen.chaosparty.tv`, Name z. B. „Chaos Party TV“ (die Bundle-ID erscheint erst, wenn sie im Developer-Portal existiert: dort vorher anlegen oder einmal den Workflow laufen lassen)                                   | App-Eintrag existiert                                                                                                                                                                    |          |               |
| TV2 | GitHub: Actions → „TestFlight (Apple TV)“ → Run workflow auf `main`                                                                                                                                                                                                                     | Lauf grün, Log endet mit „Hochgeladen: Build …“; der Schritt „Testszene mit RealityKit prüfen“ darf gelb sein (Ergebnis notieren)                                                        |          | Link zum Lauf |
| TV3 | App Store Connect → TestFlight: Build erscheint, interne Gruppe hinzufügen                                                                                                                                                                                                              | Build „Bereit zum Testen“, keine Exportfrage                                                                                                                                             |          |               |
| TV4 | Apple TV: TestFlight-App, „Chaos Party“ installieren und starten                                                                                                                                                                                                                        | Icon mit Parallaxe, Brett mit Gras, Figuren und Schatten wie in RK3                                                                                                                      |          | Foto          |
| TV5 | Apple TV: App in die oberste Reihe legen                                                                                                                                                                                                                                                | Top-Shelf-Bild erscheint                                                                                                                                                                 |          |               |
| TV6 | Apple TV (CHAOS-147): App aus TestFlight starten, Play/Pause auf der Siri Remote drücken                                                                                                                                                                                                | Menü „Messvariante“ mit fünf Einträgen, Häkchen bei „Nativ (ARView)“; Menü-Taste schließt es                                                                                             |          | Foto          |
| TV7 | „Hochskaliert ×0,5, MetalFX“ wählen                                                                                                                                                                                                                                                     | Brett erscheint neu, HUD-Zeile 1 „Variante: Hochskaliert ×0,5, MetalFX (Menü)“; nach ca. 23 s Ergebnis mit `"spike":"CHAOS-114"`, fps notieren (unter tvOS < 27.2 steht dort `bilinear`) |          | Foto, fps     |
| TV8 | App beenden (Home-Taste doppelt, nach oben wischen) und neu starten                                                                                                                                                                                                                     | Variante bleibt, HUD zeigt „(gespeichert)“                                                                                                                                               |          |               |
| TV9 | Mac: `./messreihe-atv.sh <ID> 20 arview hoch-0.5-metalfx` bei gespeicherter hochskalierter Wahl                                                                                                                                                                                         | `arview` misst die ARView (`"spike":"CHAOS-78"`), nicht die gespeicherte Variante                                                                                                        |          | TSV           |
| TH1 | GitHub: Actions → „TestFlight (Apple TV)“ → Run workflow auf `main` (oder ein Push, der `apps/apple-host` ändert)                                                                                                                                                                       | Lauf grün, Log zeigt „Nutzlast 7–8M“ und endet mit „Hochgeladen: Build …“                                                                                                                |          | Link zum Lauf |
| TH2 | Apple TV: TestFlight-App, neuesten Build von „Chaos Party“ installieren und starten; Frage nach dem lokalen Netzwerk, falls sie kommt, erlauben                                                                                                                                         | Lobby mit QR-Code, Link `http://<ATV-IP>:8787/?code=…` und Spielerliste; Icon mit Parallaxe wie bisher                                                                                   |          | Foto          |
| TH3 | Rechner aus dem WLAN nehmen oder ausschalten. iPhone (Safari, gleiches WLAN): QR-Code am Fernseher scannen                                                                                                                                                                              | Controller lädt von der Apple TV, Figurenwahl erscheint; auf dem Fernseher steht der Spieler in der Liste                                                                                |          | Foto          |
| TH4 | Zweites iPhone tritt bei, beide „Bereit!“, auf der Siri Remote „Partie starten“ wählen                                                                                                                                                                                                  | Brett (noch Grundkörper) erscheint, Würfeln am iPhone bewegt die Figur                                                                                                                   |          |               |
| TH5 | CHAOS-141, Build nach dem Merge: App per `xcrun devicectl device process launch … --console` starten (README, Abschnitt „Bauen“), zwei iPhones, ganze Partie bis zum Endstand; Log sichern                                                                                              | In jeder `HOST-MESSUNG`-Zeile rund um Minispiel-Start (Phase `minigame` nach `board`) und -Ende (zurück zu `board`): `js_ms_max` < 16,7 und `js_uebersprungen` 0                         |          | Log-Auszug    |
| TM1 | Mac (CHAOS-200): TestFlight-App aus dem Mac App Store, „Chaos Party Host“ installieren und starten; Frage nach eingehenden Verbindungen bzw. dem lokalen Netzwerk erlauben | Lobby mit QR-Code wie bei der Developer-ID-App, kein Menüpunkt „Nach Updates suchen …“ | | Foto |
| TM2 | iPhone (Safari, gleiches WLAN) scannt den QR-Code am Mac, Partie mit zwei iPhones bis zum ersten Minispiel | Controller lädt vom Mac, Würfeln bewegt die Figur, Minispiel startet (die Sandbox blockiert nichts) | | |
| TH6 | CHAOS-141, erst wenn die App am Endstand eine Revanche anbietet (Stand 18.11.: noch nicht, bis dahin misst nur der Harness, EXP-024 Nachtrag): drei Partien am Stück, Speicher der App in Xcode (Debug Navigator → Memory) oder Instruments (Allocations) am Ende jeder Partie notieren | Speicher nach Partie 3 höchstens 20 MB über dem Stand nach Partie 1                                                                                                                      |          | drei Werte    |

## 21. Trostpreis in der nativen Controller-App (für CHAOS-127)

**Stand:** 2026-11-17 · **Aufgabe:** CHAOS-127 · **Bild:** [`chaos127-iphone-minigameConsolation.jpg`](screenshots/chaos127-iphone-minigameConsolation.jpg) (Beispielzustand im Simulator, aus CI)

Automatisch geprüft (CI „Native Apps“, Simulator): Die App dekodiert `minigame.prizes` aus der Fixture, die Texte stimmen mit dem Browser-Controller überein („Trostpreis: Falle“), der Beispielzustand `-sample minigameConsolation` wird fotografiert. **Nicht** automatisch geprüft: das echte Ergebnis einer Partie auf einem iPhone mit der TestFlight-App.

| ID  | Schritt                                                                              | Erwartung                                                                                                                               | Ergebnis | Nachweis |
| --- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------- |
| NT1 | Partie mit der nativen App auf einem iPhone, dort im Minispiel klar Letzte(r) werden | Ergebnis zeigt unter den Münzen das Item-Symbol und „Trostpreis: …“ mit dem Item-Namen; die anderen Controller zeigen keinen Trostpreis |          | Foto     |
| NT2 | VoiceOver an, Ergebnis vorlesen lassen                                               | „Trostpreis: …“ wird als eine Zeile vorgelesen, das Symbol nicht extra                                                                  |          |          |

## 22. Nativer Apple-Host am Mac (für CHAOS-139)

**Stand:** 2026-11-17 · **Aufgabe:** CHAOS-139 · **Anleitung:** [`apps/apple-host/README.md`](../apps/apple-host/README.md), Abschnitte „Bauen“ und „Prüfen“

Automatisch geprüft: JS-Kern im nackten `node:vm`-Kontext (ganze Partie mit Bots), in der CI zusätzlich der Swift-Harness in JavaScriptCore und der Build für macOS und tvOS. **Nicht** geprüft: ob die App am Mac startet und ein echtes iPhone per QR beitritt. Die Darstellung besteht noch aus Grundkörpern (echte Grafik: CHAOS-142/148/149).

| ID  | Schritt                                                                                                                     | Erwartung                                                                                                                             | Ergebnis | Nachweis   |
| --- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------- |
| AH1 | Mac: `cd apps/apple-host && ./prepare.sh && xcodegen generate`, dann für `platform=macOS` bauen und `ChaosHost.app` starten | Fenster „Chaos Party“ mit QR-Code, Link und „Bereit – Controller scannen den QR-Code“; im Log `JOIN-URL http://<Mac-IP>:8787/?code=…` |          | Log-Zeile  |
| AH2 | macOS fragt beim ersten Start nach dem lokalen Netzwerk bzw. der Firewall                                                   | Erlauben; danach liefert `curl -s -o /dev/null -w '%{http_code}' 'http://<Mac-IP>:8787/?code=<CODE>'` vom selben WLAN `200`           |          |            |
| AH3 | iPhone (Safari, gleiches WLAN): QR-Code am Mac scannen                                                                      | Controller lädt, Figurenwahl erscheint; in der App steht der Spieler in der Liste                                                     |          | Foto       |
| AH4 | Zweiter Spieler (zweites iPhone oder privates Browserfenster am Mac), beide „Bereit!“, am Mac Return („Partie starten“)     | Brett aus Scheiben und Kugeln erscheint, Würfeln am iPhone bewegt die Figur                                                           |          |            |
| AH5 | Bis zum ersten Minispiel weiterspielen                                                                                      | Minispiel als Grundkörper sichtbar, Stick/Knopf am iPhone wirken, danach zurück aufs Brett                                            |          |            |
| AH6 | Log nach 2–3 Minuten ansehen                                                                                                | keine `JS-FEHLER`- oder `FEHLER`-Zeilen; `HOST-MESSUNG` mit `js_ms_p95` notieren                                                      |          | Log-Auszug |

## 23. „Mehr Zeit zum Reagieren“ (für CHAOS-124)

**Stand:** 2026-11-17 · **Aufgabe:** CHAOS-124 · **Doku:** [ADR-015, Nachtrag 5](decisions/ADR-015-vertical-slice.md)

Automatisch geprüft: Schalter in der PC-Lobby per Maus und Tastatur (Enter, Leertaste), Server übernimmt die Einstellung, die Partie läuft mit 5000 ms statt 3000 ms, eine Reaktion nach 4 s zählt nur mit Option, die Revanche behält die Einstellung (`host-lobby-figuren.spec.ts`, `apps/server/src/reactionTime.integration.test.ts`). **Nicht** automatisch prüfbar: ob 5 s für Kinder, ältere Mitspielende oder Menschen mit motorischen Einschränkungen reichen und ob sich das Fenster für die anderen zu lang anfühlt.

| ID  | Schritt                                                                                             | Erwartung                                                                            | Ergebnis | Nachweis |
| --- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | -------- | -------- |
| RT1 | PC-Lobby: „Mehr Zeit zum Reagieren“ einschalten, Partie starten, bis jemandem Münzen geklaut werden | Countdown am iPhone startet bei 5 s statt 3 s, Reaktion ist in Ruhe schaffbar        |          |          |
| RT2 | Gleiche Situation ohne Option                                                                       | Countdown startet bei 3 s (wie bisher)                                               |          |          |
| RT3 | Mit Option eine ganze Partie mit einer langsamer reagierenden Person                                | Sie schafft die Reaktion meistens; die anderen empfinden das Warten nicht als Bremse |          |          |
| RT4 | Nach dem Endstand „Nochmal spielen“                                                                 | Schalter in der Lobby ist noch an                                                    |          |          |

## 24. Ansage „Sabotage wird stärker!“ (für CHAOS-120)

**Stand:** 2026-11-17 · **Aufgabe:** CHAOS-120 · **Bild:** [Ansage am PC](screenshots/chaos120-sabotage-ansage.png)

Automatisch geprüft: Ansage nur in Wachstumsrunden (Spielkern-Test, bei `sabotageGrowthRounds: 0` nie), Einblendung am Host mit den neuen Werten, kurze Pause vor „… ist dran!“, nach 4 s wieder weg (`host-brett.spec.ts`, Screenshot `host-brett-sabotage`); Fallen-Text „Kostet andere ab 4 Münzen“, solange die Falle bis zum Partieende noch mehr bringen kann. **Nicht** automatisch prüfbar: ob man die Ansage vom Sofa aus bemerkt und versteht, ob der Klang passt.

| ID  | Schritt                                                          | Erwartung                                                                                                                                                                                                                        | Ergebnis | Nachweis |
| --- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------- |
| SA1 | Partie mit 10 Runden bis Runde 6 spielen                         | Zu Beginn von Runde 6 erscheint oben mittig „Sabotage wird stärker!“ mit „Klau: 6 Münzen · Falle: 5 Münzen“, dazu ein tiefer Fallen-Klang; danach „… ist dran!“                                                                  |          | Foto     |
| SA2 | Runde 2–5 und 7–10                                               | Keine Ansage, nur „Runde n beginnt!“ in der Meldungsleiste                                                                                                                                                                       |          |          |
| SA3 | Falle im Würfel-Menü am iPhone/iPad, Runde 1–5                   | Zusatzzeile „Kostet andere ab 4 Münzen“; in Runde 6–10 (letzte Stufe bei 10 Runden) „Kostet andere 5 Münzen“                                                                                                                     |          | Foto     |
| SA4 | Gefühl in der Gruppe                                             | Hat jemand die Ansage bemerkt und verstanden? Zu laut, zu leise, zu lang?                                                                                                                                                        |          | Notiz    |
| SA5 | Nativer Apple-Host (Mac oder Apple TV, Abschnitt 22) bis Runde 6 | Große Einblendung oben mittig „Sabotage wird stärker!“ / „Klau: 6 Münzen · Falle: 5 Münzen“, rund 4 s sichtbar, nicht in Runde 2–5; die Meldungsleiste zeigt die Ansage nicht mehr als eigene Zeile. Noch ohne Klang (CHAOS-157) |          | Foto     |

## 25. Notarisierte Mac-App auf einem fremden Mac (für CHAOS-118)

**Stand:** 2026-11-17 · **Aufgabe:** CHAOS-118 · **Anleitung:** [`apps/apple-host/README.md`](../apps/apple-host/README.md), Abschnitt „Release“

Automatisch geprüft (CI, jeder PR): Archiv mit Hardened Runtime ohne `get-task-allow`, Universal-Binary, Selbsttest der fertigen App (JS-Kern, Havok, Controller-Seite, WebSocket-Beitritt). Im Release-Workflow zusätzlich Notarisierung, Heften und `spctl` („Notarized Developer ID“). **Nicht** geprüft: der Download über einen Browser auf einem Mac, der die App noch nie gesehen hat (Quarantäne-Attribut, Gatekeeper beim ersten Öffnen), und ein Spiel mit echten iPhones aus der heruntergeladenen App.

Voraussetzung: Secrets `MACOS_CERTIFICATE_P12` und `MACOS_CERTIFICATE_PASSWORD` sind gesetzt, der Workflow „Release (Mac-App)“ lief grün und hat einen Release `macos-v…` angelegt.

| ID  | Schritt                                                                                                                                                                    | Erwartung                                                                                                                                       | Ergebnis | Nachweis                     |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------------------------- |
| MA1 | Auf einem **anderen** Mac (oder anderem Benutzerkonto ohne Xcode-Builds) den Zip vom GitHub-Release mit Safari laden, entpacken, „Chaos Party.app“ nach „Programme“ ziehen | `shasum -a 256` passt zur `.sha256` des Releases                                                                                                |          |                              |
| MA2 | Doppelklick auf die App                                                                                                                                                    | Kein „kann nicht geöffnet werden“ und kein „Entwickler nicht verifiziert“; höchstens die normale Rückfrage „aus dem Internet geladen … Öffnen?“ |          | Bildschirmfoto der Rückfrage |
| MA3 | Terminal: `spctl --assess --type execute -vv "/Applications/Chaos Party.app"` und `xcrun stapler validate "/Applications/Chaos Party.app"`                                 | `accepted`, `source=Notarized Developer ID`; „The validate action worked!“                                                                      |          | Ausgabe                      |
| MA4 | Erster Start: Rückfragen zu lokalem Netzwerk bzw. eingehenden Verbindungen                                                                                                 | Erlauben; Fenster „Chaos Party“ mit QR-Code und Link                                                                                            |          |                              |
| MA5 | Zwei iPhones im selben WLAN: QR-Code scannen, Figur wählen, „Bereit!“, am Mac Return                                                                                       | Partie startet, Würfeln bewegt die Figur, das erste Minispiel läuft und kehrt aufs Brett zurück                                                 |          | Foto                         |
| MA6 | „Über Chaos Party“ bzw. Finder → Informationen                                                                                                                             | Version passt zum Release-Tag (`macos-v0.1.N` → 0.1.N)                                                                                          |          |                              |

## 26. Rückenwind-Ansage im Playtest (für CHAOS-125)

**Stand:** 2026-11-17 · **Aufgabe:** CHAOS-125 · **Bilder:** `tests/e2e/__screenshots__/host-brett.spec.ts/host-brett-rueckenwind-chromium-linux.png`, `tests/e2e/__screenshots__/controller-brett.spec.ts/brett-rueckenwind-iphone-hoch-linux.png`

Automatisch geprüft: Regel und Münz-Grund `tailwind` (`packages/game-core/src/rules/catchUp.test.ts`), Stand und Controller-Kontext über den Server (`apps/server/src/session.v4.test.ts`), Karte am PC und Hinweis am iPhone-Controller im Browser (`host-brett.spec.ts`, `controller-brett.spec.ts`). **Nicht** automatisch prüfbar: ob man die Ansage vom Sofa versteht und ob sich die Hilfe fair anfühlt. Die native iPhone-App ist nur im CI gebaut, nicht auf dem Gerät angesehen. Nativer Host (CHAOS-188): Schalter `HostEnv.tailwind` und Karte im `renderState` in einer ganzen Bot-Partie geprüft (`bots --full --rueckenwind`, Node); Swift-Teil (`--rueckenwind`) nur im macOS-CI gebaut.

| ID  | Schritt                                                                            | Erwartung                                                                                                                                   | Ergebnis | Nachweis |
| --- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------- |
| RW1 | 3–4 Personen, `RUECKENWIND=1 ROUNDS=10 pnpm start`; Terminal zeigt „Rückenwind an“ | Partie läuft wie gewohnt                                                                                                                    |          |          |
| RW2 | Nach einem Minispiel, sobald jemand mehr Trophäen hat                              | Karte „Rückenwind!“ mittig am Fernseher, Namen und „+2/+4/+6 Münzen“ lesbar, Münzen erscheinen an den Figuren; danach geht es normal weiter |          | Foto     |
| RW3 | Am Handy derer, die Rückenwind bekommen                                            | „Rückenwind: +… Münzen!“ mit Erklärung; die anderen sehen „Schau auf den großen Bildschirm!“                                                |          | Foto     |
| RW4 | Nach der Partie fragen                                                             | Versteht man ohne Erklärung, warum es Münzen gab? Fühlt es sich fair an oder wie Mitleid? Kippt es zu stark zu den Letzten?                 |          | Notiz    |
| RW5 | Nativer Host (Mac-App oder Apple TV) mit Startparameter `--rueckenwind` (Mac: `open -a "Chaos Party" --args --rueckenwind`), 3–4 Personen (CHAOS-188) | Log zeigt „Regel Rückenwind an“; nach einem Minispiel mit Trophäen-Rückstand erscheint die Rückenwind-Karte samt Münz-Popups wie am PC (RW2) |          | Foto     |

## 27. USDZ-Assets: Figuren und Kulisse in RealityKit wie im Babylon-Host (für CHAOS-140)

**Stand:** 2026-11-17 · **Aufgabe:** CHAOS-140 · **Experiment:** [EXP-026](experiments.md) · **Anleitung:** [`apple-assets.md`](apple-assets.md)

Automatisch geprüft (Linux, ohne Mac): USDZ entstehen mit `pnpm build:apple-assets`; usd-core findet keine Fehler; Materialien mit Rauheit, Clearcoat, Metall und Leuchten im USD; Feld-Anker am Ort; Füße und Höhe mit gebackenem Skinning. **Nicht** automatisch prüfbar: ob RealityKit alles lädt und wie es aussieht, ob `trimmed` die Clips richtig ausschneidet, Rubens Urteil zur Optik.

| ID  | Schritt                                                                                                                                                                                             | Erwartung                                                                                                                                                                                     | Ergebnis                                                                                                                                                                                                                                                                                       | Nachweis                                                                                                                                                                                               |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| UA1 | Mac: `pnpm build:apple-assets`                                                                                                                                                                      | Endet mit „USDZ ok“, danach die RealityKit-Prüfung mit „OK“ (Feld-Anker 43 von 43, Zeitleiste je Figur 9,80 s)                                                                                | ✓ 18.11. (Claude, M3 Max): in 45 s „USDZ ok“ und „OK“, 43 von 43, 9,80 s je Figur. Die Prüfung erkennt die Fehler aus UA2 nicht.                                                                                                                                                               | Log im Kommentar an CHAOS-140                                                                                                                                                                          |
| UA2 | Mac: Spike mit den neuen Assets bauen und starten (`spikes/renderer-realitykit/convert/convert.sh`, dann wie im Spike-README, `--sekunden=60 --bleiben=1`; Nahansicht je Figur mit `--nah=<figur>`) | Brett wie bisher, vier Figuren mit Glanz, Roboter-Augen und Glühbirne leuchten, Figuren wippen in `idle` (keine anderen Clips, kein Springen am Schleifenende)                                | 18.11. (Claude, M3 Max, macOS 27.2.1, Xcode 27.0): Brett, Glanz und Materialien wie erwartet, 59,5 fps. **Fehler:** Socken-Bündchen und Kaktus-Blüte stehen ein Stück über dem Körper, der Kaktus wirkt unten zerknittert, auch ohne Animation (`--idle=0`). Wippen in `idle` nicht beurteilt. | [`chaos140-realitykit-brett.jpg`](screenshots/chaos140-realitykit-brett.jpg), [`…-nah.jpg`](screenshots/chaos140-realitykit-nah.jpg), [`…-ruhepose.jpg`](screenshots/chaos140-realitykit-ruhepose.jpg) |
| UA3 | Mac: Babylon-Host daneben (`pnpm play`, Brett im Beispielstand) und Screenshots aus ähnlicher Kamera                                                                                                | Figuren und Kulisse erkennbar dieselben; Unterschiede notieren (Fell-Sheen fehlt, kein SSAO/HDRI)                                                                                             | Entfällt (18.11.): Die Figuren werden ohnehin überarbeitet (CHAOS-162), dort mit Vorher-nachher-Bildern aus beiden Hosts.                                                                                                                                                                      | zwei Screenshots nach `docs/screenshots/chaos140-*.jpg`                                                                                                                                                |
| UA4 | Ruben: Urteil zur Optik                                                                                                                                                                             | „sieht aus wie am PC“ oder eine Liste, was fehlt                                                                                                                                              | 18.11., Ruben: „passt so“ zum fehlenden Sheen. Die Figuren müssen in der Nähe detaillierter werden, Kaktus und Socke sind kaputt bzw. nicht schön → CHAOS-161, CHAOS-162.                                                                                                                      | Kommentar an CHAOS-140                                                                                                                                                                                 |
| UA5 | Mac, nach CHAOS-161: `pnpm build:apple-assets`, dann Spike mit `--nah=sock` und `--nah=cactus`, je mit und ohne `--idle=0`                                                                          | RealityKit-Prüfung „OK“ mit Zeilen „buendchen auf socke“, „bluete auf kaktus“, „kaktus auf topf“ (je unter 3 cm); Bündchen und Blüte sitzen am Körper, der Kaktus ist unten nicht zerknittert | offen. Unter Linux geprüft: usd-core-Prüfung schlägt mit dem alten Export fehl (Bündchen 10,2 cm, Blüte 9,4 cm) und läuft mit dem neuen durch (1,5 cm, 0,7 cm); Blender-Render siehe Nachweis. Die Swift-Prüfung ist ungetestet (kein Mac in der Cloud).                                       | [`chaos161-vorher-nachher.jpg`](screenshots/chaos161-vorher-nachher.jpg)                                                                                                                               |

## 28. Automatisches Update der Mac-App (für CHAOS-156)

**Stand:** 2026-11-18 · **Aufgabe:** CHAOS-156 · **Anleitung:** [`apps/apple-host/README.md`](../apps/apple-host/README.md), Abschnitt „Automatische Updates“

Automatisch geprüft (CI, jeder PR): App mit Sparkle ad hoc gebaut, Sparkle samt Helfern neu signiert, Selbsttest lädt Sparkle; mit einem Wegwerf-Schlüssel signiert `sign_update` einen Zip, die Signatur passt zum Schlüssel im Info.plist, die `appcast.xml` ist signiert und geprüft. **Nicht** geprüft: dass eine installierte, notarisierte App das nächste Release wirklich findet, lädt, ohne Gatekeeper-Warnung ersetzt und neu startet.

Voraussetzung: Variable `SPARKLE_PUBLIC_ED_KEY` und Secret `SPARKLE_ED_PRIVATE_KEY` sind gesetzt; danach liefen **zwei** Releases (jeder Merge mit einem `feat`- oder `fix`-Commit erzeugt einen; ein manueller Lauf ohne neue solche Commits erzeugt keinen), und `…/releases/download/macos-appcast/appcast.xml` zeigt die zweite Version.

| ID | Schritt | Erwartung | Ergebnis | Nachweis |
|---|---|---|---|---|
| SU1 | Den **ersten** der beiden Releases (`macos-v0.1.N`) laden und nach „Programme“ legen, öffnen | Startet wie in §25; im App-Menü ist „Nach Updates suchen …“ aktiv | | |
| SU2 | „Chaos Party → Nach Updates suchen …“ | Fenster „Eine neue Version von Chaos Party ist verfügbar“ mit der Version des zweiten Releases und dem Hinweistext | | Bildschirmfoto |
| SU3 | „Update installieren“, dann „Installieren und neu starten“ | Lädt, beendet die App und startet sie neu; **keine** Gatekeeper-Rückfrage, kein „beschädigt“ | | |
| SU4 | „Über Chaos Party“ | Version des zweiten Releases | | |
| SU5 | App mit der alten Version erneut installieren, einen Tag offen lassen (oder `defaults delete dev.rubeen.chaosparty.host SULastCheckTime` und neu starten) | Sparkle meldet das Update ohne Klick auf den Menüpunkt | | |

## 29. Nativer Host mit echter Grafik: Lobby, Brett, 4K auf der Apple TV (für CHAOS-142)

**Stand:** 2026-11-18 · **Aufgabe:** CHAOS-142 · **Anleitung:** [`apps/apple-host/README.md`](../apps/apple-host/README.md), Abschnitte „App“ und „Bauen“

Automatisch bzw. von Claude geprüft (M3 Max, macOS 27.2, 18.11.): App am Mac und im tvOS-Simulator (Apple TV 4K, 3840×2160, intern 1920×1080) mit zwei Bot-Controllern bis ins erste Minispiel. Brett mit Instanzen und vier Figuren lädt in 1,3–1,4 s (Mac) bzw. 5,9 s (Simulator), danach `host-ready`; Figuren stehen auf den Feldern und laufen zum neuen Feld; Mac 55–58 fps, Simulator 59,5 fps (nur Anhaltspunkt). Bilder: [`chaos142-mac-lobby.jpg`](screenshots/chaos142-mac-lobby.jpg) (Lobby als Einzelbild gerendert, Hintergrund verzerrt), [`chaos142-tvos-brett.jpg`](screenshots/chaos142-tvos-brett.jpg). Zum Vergleich der Babylon-Host im Beispielstand: [`host-brett-chromium-darwin.png`](../tests/e2e/__screenshots__/host-brett.spec.ts/host-brett-chromium-darwin.png). **Nicht** geprüft: echte Apple TV (am 18.11. installiert, Start scheiterte an „System is asleep“), Start mit der Fernbedienung (der Simulator lässt sich hier nicht bedienen; alle Läufe mit `--autostart`), echtes iPhone, Bildrate bei 4K am Gerät, Rubens Urteil.

| ID | Schritt | Erwartung | Ergebnis | Nachweis |
|---|---|---|---|---|
| NH1 | Mac: `pnpm build:apple-assets`, dann wie im README bauen und `ChaosHost.app` starten | Lobby über dem Brett: QR-Code, Join-Code, vier Plätze; „Partie starten“ grau, bis das Brett geladen ist | | Foto |
| NH2 | iPhone per QR beitreten, Figur wählen, „Bereit!“ | Karte mit Porträt der Figur, Rahmen und Halstuch in Slot-Farbe, „bereit ✓“ | | Foto |
| NH3 | Zweiter Spieler, beide bereit, Return (Mac) | Brett mit echten Figuren auf dem Start; Kamera wie am PC | | Foto neben dem Babylon-Host |
| NH4 | Würfeln am iPhone | Figur läuft zum neuen Feld (geradlinig, Laufen-Animation), Kamera rückt leicht zum aktiven Spieler | | |
| NH5 | Apple TV (TestFlight-Build nach dem Merge): dasselbe wie NH1–NH4 mit der Fernbedienung für den Start | wie am Mac; Lobby lesbar aus Sofa-Abstand | Entfällt (18.11., Ruben: „ignorieren wir den tv teil & gehen davon aus, dass alles passt“) | Foto |
| NH6 | Apple TV bei 4K-Ausgabe 2–3 Minuten Brett laufen lassen, Log mit `xcrun devicectl … --console` (README) | `HOST-MESSUNG` mit `"fps"` und `angezeigt_ms_p95` notieren; Ziel ≥ 30 fps prüft der Gesamtlauf | Entfällt (18.11., Ruben, siehe NH5) | Log-Auszug |
| NH7 | Ruben: Urteil zur Optik von Lobby und Brett | „passt“ oder eine Liste, was fehlt (bekannt: keine Lichtstimmungen je Runde, kein SSAO/Tiefenschärfe, Hintergrund hellblau statt warm) | | Kommentar an CHAOS-142 |

## 30. Nativer Host: Finale, Pause, Wiederverbindung, Controller-App (für CHAOS-145)

**Stand:** 2026-11-19 · **Aufgabe:** CHAOS-145 · **Anleitung:** [`apps/apple-host/README.md`](../apps/apple-host/README.md), Abschnitte „App“ und „Hintergrund, Ruhezustand, Wiederverbindung“

Automatisch geprüft: `bots --full` (Pause im Brett und im Minispiel, saubere Trennung und Funkstille mit Wiederverbindung, Finale bis zum Siegerbildschirm, Revanche mit „Überspringen“), Swift-Harness, Builds für macOS und tvOS. Im tvOS-Simulator mit Bot-Controllern: Pause im Brett und im Minispiel, Trennen und Funkstille, Finale mit Podest, Revanche, Hintergrund und zurück (gleiche PID, Partie pausiert). **Nicht** geprüft: echte Apple TV, Fernbedienung, iPhone mit WLAN-Verlust, Controller-App gegen den nativen Host.

| ID  | Schritt | Erwartung | Ergebnis | Nachweis |
| --- | ------- | --------- | -------- | -------- |
| FP1 | Apple TV: iPhone A mit der Controller-App (QR scannen), iPhone B im Browser (QR scannen) | Beide stehen in der Lobby, Figuren wählbar, „Bereit!“ | | Foto |
| FP2 | Partie starten, im Brett **Play/Pause** auf der Fernbedienung | Pausenkarte mit „Runde x/y“, beide Handys zeigen die Pause; Play/Pause setzt fort | | Foto |
| FP3 | Im laufenden Minispiel Play/Pause, dann **Menü** | Pausenkarte über dem Minispiel, Restzeit steht; Menü setzt fort | | Foto |
| FP4 | In der Pause „Partie beenden“ → „Ja, beenden“ (Fernbedienung) | Trophäenzählung mit „Partie vorzeitig beendet“ | | |
| FP5 | iPhone B: WLAN 30 s aus, dann wieder an | Figur nach etwa 15 s halbtransparent; nach WLAN an kommt B ohne neues Scannen zurück, gleicher Platz | | Foto |
| FP6 | iPhone A (Controller-App): App 30 s in den Hintergrund, dann zurück | A verbindet sich selbst neu, gleicher Platz | | |
| FP7 | Apple TV: Home-Taste, 1 Minute warten, App wieder öffnen | Partie pausiert, nicht verloren; beide Handys verbinden sich neu (Log „Listener … neu starten“ ist möglich); „Weiter“ setzt fort | | Log |
| FP8 | Apple TV per Hand in den Ruhezustand, 2 Minuten, aufwecken, App öffnen | wie FP7 | | Log |
| FP9 | Partie zu Ende spielen (z. B. 2 Runden) | Zählung, Podest mit Figuren (Platz 1 jubelt), Endstand, Bonus-Titel; Klänge passen | | Foto |
| FP10 | „Nochmal spielen“ (Auswahl auf der Fernbedienung) | Zurück in die Lobby ohne Neustart, Figuren bleiben, neue Partie startet | | |

## 31. Gleichzeitige Popups über dem Brett (für CHAOS-189)

**Stand:** 2026-11-19 · **Aufgabe:** CHAOS-189

Automatisch bzw. von Claude geprüft: Regie-Tests (`apps/host/src/board/director.test.ts`, Stapelebenen und Freigabe abgelaufener Ebenen), Babylon-Host im lokalen Brett-Modus mit Würfel-, Münz- und Item-Popup über Blau (Bild [`chaos189-popups-gestapelt.jpg`](screenshots/chaos189-popups-gestapelt.jpg)). **Nicht** geprüft: der native Host (Swift-Teil, in der Cloud-Sitzung gab es kein Swift; die CI baut ihn auf macOS), Rubens Urteil.

| ID | Schritt | Erwartung | Ergebnis | Nachweis |
|---|---|---|---|---|
| PS1 | PC: Partie spielen, bis eine Figur auf einem Münzfeld ein Item bekommt oder würfelt und gleich danach Münzen bekommt | Die Popups stehen übereinander, beide lesbar; das jüngere schiebt sich nicht über das ältere | | Foto |
| PS2 | Mac-App (nativer Host): dasselbe | wie PS1 | | Foto |

## 32. Minispiel-Klänge im nativen Host (für CHAOS-190)

**Stand:** 2026-11-19 · **Aufgabe:** CHAOS-190 · **Anleitung:** [`apps/apple-host/README.md`](../apps/apple-host/README.md), „Minispiel-Klänge“; Vertrag: [`CONTRACT.md`](../apps/apple-host/CONTRACT.md) „Klänge“

Automatisch bzw. von Claude geprüft (19.11.): Klänge je Minispiel wie im Browser-Host (Unit-Tests, Swift-Harness `full` zählt je Minispiel `minigame-start`, 3 × `tick`, `go`, `win`, `cheer`); Synthese offline in WAV gerendert (Länge, Pegel, Hauptfrequenz je Klang); tvOS-Simulator mit vier Bot-Spielern: alle fünf Minispiele mit 40–211 Klängen je Minispiel, 0 verworfen (Logzeile `Minispiel-Klänge …`). **Nicht** geprüft: das Hören selbst, Lautstärke im Verhältnis zum Brett, Gleichlauf von Ton und Bild am Fernseher.

| ID  | Schritt                                                                     | Erwartung                                                                                                                         | Ergebnis | Nachweis   |
| --- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------- |
| MK1 | Mac oder Apple TV: Partie bis zum ersten Minispiel spielen                  | Beim Erscheinen der Anleitung ein Aufwärts-Swoosh mit Tusch, dann „tick“ bei 3, 2, 1 (der letzte höher), zum Start ein „Los!“-Dreiklang |          |            |
| MK2 | Minispiel spielen                                                           | Klänge zu Treffern, Punkten, Stürzen usw. kommen im selben Moment wie das Bild, nicht verzögert; nichts klirrt oder knackt         |          |            |
| MK3 | Ende und Ergebnis                                                           | Siegesfanfare zum Ende, Jubel im Ergebnis, wenn Platz 1 jubelt                                                                    |          |            |
| MK4 | Kuckucks-Klatsche mit vier Spielern (dichteste Klangfolge)                  | Ton bleibt im Takt; Log: `Minispiel-Klänge …: n gespielt, m verworfen` mit kleinem `m`                                           |          | Log-Zeile  |
| MK5 | Gleiche Stelle am PC (Babylon-Host) anhören                                 | Gleiche Klänge, ähnliche Lautstärke wie am PC und wie die Brett-Klänge                                                            |          |            |
| MK6 | App mit `--stumm` starten                                                   | Minispiele bleiben still                                                                                                          |          |            |

## 33. Nativer Host: Lichtstimmung je Runde, Flug-Effekte, Minispiel-Kulisse, Aufwärmen (für CHAOS-193, CHAOS-192)

**Stand:** 2026-11-19 · **Aufgaben:** CHAOS-193, CHAOS-192 · **Anleitung:** [`apps/apple-host/README.md`](../apps/apple-host/README.md), Abschnitt „App“ (Lichtstimmung, Minispiele, Aufwärmen)

Automatisch geprüft: Unit-Tests der Stimmung und Überblendung (`test/lightMood.test.ts`), Bündel-Test mit strengem Schema, `bots --full`, Swift-Harness, Builds für macOS und tvOS. Im tvOS-Simulator und am Mac mit Bot-Controllern: fünf Runden Morgen bis Nacht, alle fünf Minispiele, Bildpaare gegen den Babylon-Host, Bildrate im Simulator, Aufwärmen im Log. **Nicht** geprüft: echte Apple TV (Bildrate mit 12 000 Grashalmen und bis zu sechs Punktlichtern nachts, Dauer des Aufwärmens), Windstoß und Platztausch (kamen in den Bot-Partien nicht vor).

| ID  | Schritt | Erwartung | Ergebnis | Nachweis |
| --- | ------- | --------- | -------- | -------- |
| LS1 | Apple TV: App starten, Log lesen | `Aufwärmen: … Bilder unsichtbar […] ms` vor `host-ready`; Lobby erscheint ohne merkliche Verzögerung | | Log |
| LS2 | Partie mit 5 Runden, erstes Minispiel | Geometrie steht vor Ende des Countdowns (Log: `… s vor Ende des Countdowns`), kein Ruckeln beim Wechsel | | Log |
| LS3 | Brett über alle Runden ansehen | Morgen, Mittag, Abend, Dämmerung, Nacht; Wechsel weich über etwa 4 s; nachts leuchten die Laternen | | Foto |
| LS4 | Minispiele über die Runden | Licht passt zur Runde; Kuckucksuhr orange statt braun; Grashalme und Laternen; im flachen Blick (Kuckucks-Klatsche) keine Kante am Horizont | | Foto |
| LS5 | Bildrate (Log `HOST-MESSUNG`) im Brett und im Minispiel, besonders nachts | wie vor CHAOS-193 (Median ≈ 58–60 Bilder/s) | | Log |
| LS6 | Windstoß- bzw. Platztausch-Feld erreichen | Windringe um die Figur bzw. Ring in Slot-Farbe an Abflug- und Zielfeld | | Foto |
| LS7 | Siegerpodest | Nachtdunst, Laternen leuchten | | Foto |

## 34. Gesamtlauf: komplette Partie auf der Apple TV und am Mac ohne Rechner (für CHAOS-146, M5-Abnahme CHAOS-164)

**Stand:** 2026-11-19 · **Aufgabe:** CHAOS-146, Gate CHAOS-164 · **Anleitung:** [`apps/apple-host/README.md`](../apps/apple-host/README.md) (Bauen, TestFlight, Startparameter), Messwerte aus dem Simulator in EXP-031

Automatisch geprüft, ohne echte Geräte: ganze Partien im tvOS-Simulator (Apple TV 4K, 4K-Ausgabe) und in der Mac-App mit Bot-Controllern über echtes WebSocket. Abgedeckt waren alle fünf Minispiele der Rotation, Pause im Brett und im Minispiel, Trennen und Funkstille mit Wiederverbindung, Hintergrund und Vordergrund, Finale mit Podest und Revanche (EXP-031). **Nicht** geprüft sind echte Fernbedienung, echte iPhones (Browser und native Controller-App), Bildrate und JS-Zeit auf der Apple TV (A15, JavaScriptCore ohne JIT), Hören, Eingabe → Bild. Das ist dieser Abschnitt.

Vorbereitung: Apple TV und iPhones im selben WLAN, **kein Rechner nötig**. Neuester TestFlight-Build „Chaos Party“ auf der Apple TV (§20 TH1–TH2). Für die Messzeilen die App einmal per `xcrun devicectl device process launch … --console` starten (README, „Bauen“) und das Log sichern. Am Mac die neueste notarisierte App oder ein lokaler Build.

| ID   | Schritt | Erwartung | Ergebnis | Nachweis |
| ---- | ------- | --------- | -------- | -------- |
| GL1  | Apple TV: App starten, Lobby abwarten | QR-Code, Code, Link `http://<ATV-IP>:8787/?code=…`, Brett im Hintergrund; „Partie starten“ erst nach dem Laden | | Foto |
| GL2  | iPhone 1 (Safari): QR scannen, Figur wählen, „Bereit!“ | Controller lädt von der Apple TV; Karte am Fernseher mit Porträt und „bereit“ | | |
| GL3  | iPhone 2 (native Controller-App, ADR-017): QR scannen oder Code eingeben, Figur wählen, „Bereit!“ | Beitritt ohne Rechner; vergebene Figur von iPhone 1 ausgegraut | | Foto |
| GL4  | Optional iPhone 3 und 4 (gemischt Browser/App); Rundenwahl und „Mehr Zeit zum Reagieren“ mit der Fernbedienung einstellen (Fokus vom Startknopf nach oben), dann starten | Auswahl folgt dem Fokus, Brett zeigt „Runde 1/N“ mit der gewählten Zahl | | |
| GL5  | Ganze Partie spielen (10 Runden genügen) | Würfel, Hüpfen, Popups, HUD, Kamera auf den Zug; alle fünf Minispiele der Rotation mit Anleitung, Countdown, Spiel und Ergebnis; Lichtstimmung wandert von Morgen bis Nacht | | Fotos je Minispiel |
| GL6  | Während einer Brettrunde Play/Pause auf der Siri Remote, nach 10 s „Weiter“; dasselbe im laufenden Minispiel | Pausenkarte über Brett bzw. Minispiel; Controller zeigen „Pause“; Fortsetzen ohne Sprung | | |
| GL7  | iPhone 1: WLAN 20 s aus, wieder an | Host zeigt den Spieler getrennt, danach wieder verbunden; die Partie läuft weiter (Standardwahl bei Fristen) | | |
| GL8  | Apple TV: Home-Taste, 30 s eine andere App, zurück zu Chaos Party | Partie steht pausiert an derselben Stelle; „Weiter“ setzt fort; Controller bleiben verbunden | | |
| GL9  | Partie bis zum Ende | Trophäenzählung, Podest mit Figuren (Sieger jubelt), Endstand, Bonus-Titel | | Foto |
| GL10 | „Nochmal spielen“ | Zurück in die Lobby, Figuren und Runden bleiben; zweite Partie startet | | |
| GL11 | Messung: im Log alle `HOST-MESSUNG`-Zeilen je Phase (`lobby`, `board`, `minigame`, `final`) | `fps` ≥ 30 in allen Phasen (Ziel 60); rund um Minispiel-Start und -Ende `js_ms_max` < 16,7 und `js_uebersprungen` 0 (CHAOS-169) | | Log |
| GL12 | Speicher über die Partie: Xcode → Debug Navigator (oder Instruments „Allocations“) am Anfang, nach dem 5. Minispiel und am Endstand | Kein stetiges Wachstum über die Partie, nach der Revanche nicht deutlich höher | | Werte |
| GL13 | Eingabe → Bild: Zeitlupe (iPhone-Kamera 240 fps) auf Fernseher und Controller, im Minispiel den Stick bewegen | Abstand Daumen → Bewegung am Fernseher notieren (Ziel < 150 ms) | | ms |
| GL14 | Ton: Brett- und Minispiel-Klänge (§32) | Klänge zur richtigen Zeit, nichts knackt | | |
| GL15 | Mac: GL1–GL10 mit der Mac-App (Tastatur statt Fernbedienung: Return startet, P/Esc pausiert) | Wie auf der Apple TV | | |
| GL16 | Gesamturteil | Optik nah am PC-Host? Flüssig? Lust auf eine weitere Runde? | | Kommentar an CHAOS-164 |

## 35. Feinstruktur der Figuren in RealityKit und im Babylon-Host (für CHAOS-172)

**Stand:** 2026-11-20 · **Aufgabe:** CHAOS-172 · **Experiment:** [EXP-032](experiments.md) · **Anleitung:** [`apple-assets.md`](apple-assets.md)

Automatisch geprüft (Linux, ohne Mac): Normal-Textur je Figur im GLB (`pnpm check:assets`) und im USDZ (`check_usdz.py`: Primvar `struktur` am Mesh, `raw`, `scale 2`/`bias -1`); Babylon lädt die WebP-Texturen (Vitrine, Unit-Test). **Nicht** automatisch prüfbar: ob RealityKit die zweite UV-Map liest, wie die Struktur auf dem Fernseher wirkt, Rubens Urteil.

| ID  | Schritt | Erwartung | Ergebnis | Nachweis |
| --- | ------- | --------- | -------- | -------- |
| FS1 | Mac: `pnpm build:apple-assets --nur=figuren` | „USDZ ok“ mit Zeilen „Feinstruktur an …“, danach RealityKit-Prüfung „OK“ | | Log |
| FS2 | Mac: Spike mit `--nah=sock`, `--nah=raccoon`, `--nah=robot`, `--nah=cactus` | Strickmaschen auf Socke und Bündchen, Fellstrich bei Wusel, feine Kratzer bei Schraubi, Tüpfel bei Kalle; keine Streifen oder harten Kanten an den Projektionsnähten, Farben wie vorher | | Screenshots `docs/screenshots/chaos172-realitykit-*.jpg` |
| FS3 | Apple TV oder Mac: Brett mit vier Figuren | Im Brettblick kein Flimmern und kein Moiré auf den Figuren | | Foto |
| FS4 | PC: `pnpm play`, Figur aus der Nähe (Lobby, Podest) | Struktur sichtbar, keine Nähte; Ladezeit der Figuren unauffällig | | |
| FS5 | Ruben: Urteil | Strick, Fell, Lack, Haut passend oder zu viel bzw. zu wenig (je Figur) | | Kommentar an CHAOS-172 |


## 36. Dynamische Brett-Kamera am Fernseher (für CHAOS-194)

**Stand:** 2026-11-20 · **Aufgabe:** CHAOS-194 · **Experiment:** [EXP-033](experiments.md)

Automatisch geprüft: Einstellungen je Phase und Feder (Unit-Tests `apps/host/src/board/camera.test.ts`), Phasenbilder im PC-Host (Playwright, SwiftShader), eine Bot-Partie im tvOS-Simulator mit `--bild`/`--ereignisbild`. **Nicht** automatisch prüfbar: wie sich Nähe und Tempo vom Sofa aus anfühlen, ob jemandem schwindlig wird, Bildrate auf echter Hardware, der Mac-Host (gleicher Swift-Weg wie tvOS, nicht eigens gestartet).

| ID  | Schritt | Erwartung | Ergebnis | Nachweis |
| --- | ------- | --------- | -------- | -------- |
| KA1 | PC am Fernseher: `pnpm play`, Partie mit 2–4 Spielern, eine Runde | Kamera nah an der Figur am Zug; beim Würfeln kurzer Zoom, beim Laufen Blick voraus; keine Dauer-Vollansicht | | Video |
| KA2 | Gabel (Weg wählen) | Beide Wege samt Wegweisern lesbar; Wegweiser verdecken den Pfeil nicht | | Foto |
| KA3 | Zugwechsel zu einer weit entfernten Figur | Ruhige Fahrt mit leichtem Anheben, kein Ruck, keine Übelkeit | | |
| KA4 | Münzklau / Reaktion / Platztausch | Beide beteiligten Figuren im Bild | | Foto |
| KA5 | Rundenbeginn, Trophäen-Wirbel | Kurzer Überblick über das ganze Brett, danach zurück zur Figur am Zug | | |
| KA6 | Apple TV (TestFlight): KA1–KA5 | Wie am PC; Bildrate in `HOST-MESSUNG` (Phase `board`) weiter ≥ 30 fps | | Log |
| KA7 | Mac-App: KA1–KA3 | Wie auf der Apple TV | | |
| KA8 | Ruben: Urteil | Nähe richtig? Tempo ruhig genug? Überblick oft genug? Fehlt ein Hinweis, wo die anderen stehen (→ CHAOS-210)? | | Kommentar an CHAOS-194 |

## 37. Brett-Auswahl in der Lobby (für CHAOS-197)

**Stand:** 2026-11-20 · **Aufgabe:** CHAOS-197 · **Entscheidung:** ADR-015 Nachtrag 6

Automatisch geprüft (Linux): Protokoll-Validierung, Server-Integration (Wahl, Zufall, unbekanntes Brett, Revanche), PC-Lobby per Maus und Tastatur bis aufs Brett (E2E), Kern des Apple-Hosts im Bündel. **Nicht** automatisch geprüft: SwiftUI-Lobby auf Mac und Apple TV (kein Swift in der Cloud), Fokus mit der Siri Remote, Lesbarkeit am Fernseher. Mit nur Wackelwald zeigt der Knopf „Wackelwald“ und „Zufall“; Zufall lost Wackelwald.

| ID  | Schritt | Erwartung | Ergebnis | Nachweis |
| --- | ------- | --------- | -------- | -------- |
| BA1 | PC: `pnpm play`, Lobby | Neben „Runden“ steht „Brett: Wackelwald · 74 Felder“ (seit CHAOS-196; vorher 43); Klick wechselt auf „🎲 Zufall“ und zurück; Startknopf zeigt „10 Runden · Wackelwald“ bzw. „· Zufallsbrett“ | | |
| BA2 | iPhone und iPad in der Lobby | Kopfzeile zeigt das gewählte Brett und folgt jeder Änderung am Host; auf dem iPad passt die Kopfzeile in jede Zone | | Foto |
| BA3 | Mac-App: Lobby, Taste B bzw. Klick auf den Brett-Knopf rechts neben „Chaos Party“ | Wechselt Wackelwald ↔ Zufall; Lobby wird nicht höher, nichts überlappt | | Foto |
| BA4 | Apple TV: Fokus mit der Fernbedienung auf den Brett-Knopf (von den Einstellungen nach oben), drücken | Fokusrahmen sichtbar, Wechsel wie am Mac; danach erreicht man Runden, Schalter und Start weiterhin | | Foto |
| BA5 | Partie mit „Zufall“ starten, danach „Nochmal spielen“ | Partie läuft auf Wackelwald; in der Revanche-Lobby steht weiter „Zufall“ | | |
| BA6 | Mac-App mit `--brett=zufall` starten | Lobby zeigt sofort „Zufall“ | | |


## 38. Kulisse je Brett im nativen Host (für CHAOS-212)

**Stand:** 2026-11-20 · **Aufgabe:** CHAOS-212

Automatisch geprüft (Mac): `pnpm build:apple-assets` legt die Kulisse unter `bretter/wackelwald/` ab, `check_usdz.py --vollstaendig` und `check_realitykit.swift` grün, Swift-Harness grün, Mac-App mit zwei Bots: „Brett wackelwald geladen“, Lobby und Brett wie vorher. Seit CHAOS-199: Mac-App mit „Zufall“ und sieben Revanchen, die Kulisse wechselte sechsmal zwischen Wackelwald und Rummelplatz ohne Neustart.

| ID  | Schritt | Erwartung | Ergebnis | Nachweis |
| --- | ------- | --------- | -------- | -------- |
| KB1 | Mac und Apple TV: App starten, Lobby | Wackelwald im Hintergrund wie bisher; „Partie starten“ erst nach dem Laden | | Foto |
| KB2 | Sobald es zwei Bretter gibt: in der Lobby das zweite Brett wählen | Hintergrund wechselt nach kurzem Laden auf dessen Kulisse; Log „Brett <id> geladen … in … ms“ (Ladezeit auf der Apple TV notieren) | | Log |
| KB3 | Partie auf dem zweiten Brett, danach „Nochmal spielen“ mit Wackelwald | Figuren stehen auf den Feldern der jeweils richtigen Kulisse, kein Neustart nötig | | Foto |
| KB4 | „Zufall“ wählen und starten, bis ein nicht geladenes Brett gelost wird | Zu Beginn kurz Grundkörper (Scheiben und Kugeln), dann die Kulisse; Dauer auf der Apple TV notieren | | |

## 39. „Bereit“ in der Minispiel-Anleitung (für CHAOS-214)

**Stand:** 2026-11-20 · **Aufgabe:** CHAOS-214

Automatisch geprüft (Linux-CI): Regeln, Server und Bots (Unit- und Integrationstests), Web-Controller und PC-Host in Playwright. **Nicht** geprüft: native Controller-App und Apple-Host (Swift nur am Mac übersetzbar), echte Handys, echtes Gefühl beim Warten.

| ID  | Schritt | Erwartung | Ergebnis | Nachweis |
| --- | ------- | --------- | -------- | -------- |
| BR1 | Partie zu dritt (iPhones), erste Minispiel-Anleitung | Jedes Handy zeigt die Anleitung mit großem „Bereit!“; der Host zeigt je Spieler, wer schon bereit ist | | Foto |
| BR2 | Zwei drücken „Bereit!“, der Dritte wartet 15 s | Minispiel startet nicht; die zwei sehen „Warte auf die anderen …“; der Host hebt den Dritten hervor | | |
| BR3 | Der Dritte drückt „Bereit!“ | Minispiel startet sofort (höchstens 3 s nach Beginn der Anleitung); Bühne steht, kein Standbild | | Video |
| BR4 | Alle drücken sofort „Bereit!“ | Anleitung bleibt mindestens etwa 3 s stehen, dann Start; auf der Apple TV ist die Bühne fertig | | Video |
| BR5 | Ein Handy sperren bzw. WLAN aus, während die anderen bereit sind | Nach dem Trennen startet das Spiel ohne diesen Spieler zu blockieren | | |
| BR6 | Niemand drückt „Bereit!“ | Nach 60 s startet das Minispiel trotzdem | | |
| BR7 | Geteiltes iPad (2 Zonen) | Jede Zone hat ihren eigenen „Bereit!“-Knopf, Druck in einer Zone wirkt nur dort | | Foto |
| BR8 | Pause am Host während der Anleitung | Kein „Bereit!“ angeboten; nach dem Fortsetzen wieder da, schon gedrückte bleiben bereit | | |

## 40. Minispiel-Rotation: Sperrliste, Favoriten, iPad-Zonen (für CHAOS-85)

**Stand:** 2026-11-20 · **Aufgabe:** CHAOS-85

Automatisch geprüft: Auswahl ohne Wiederholung, Familien und Kernverben nie direkt hintereinander, Filter für Spielerzahl und iPad-Zonen, Gewichte, letzte Partie (`packages/game-core/src/rules/rotation.test.ts`, 200 Dummy-Steckbriefe); Sperrliste/Favoriten über die Session und die Revanche (`apps/server/src/minigameRotation.integration.test.ts`); Dialog „Minispiele“ am PC per Maus und Escape, lokale Speicherung und erneutes Senden an eine frische Session (`tests/e2e/host-minispiel-rotation.spec.ts`). **Nicht** automatisch prüfbar: ob die Mischung sich am Abend abwechslungsreich anfühlt (bei fünf Spielen kaum sichtbar, erst mit der Pilotwelle CHAOS-91) und die Erkennung eines echten geteilten iPads.

| ID  | Schritt | Erwartung | Ergebnis | Nachweis |
| --- | ------- | --------- | -------- | -------- |
| RO1 | PC-Lobby: „Minispiele ›“ öffnen, ein Spiel sperren, eines als Favorit markieren, „Fertig“ | Knopf zeigt „4 im Topf · 1 ★ · 1 ⦸“ | | Foto |
| RO2 | Partie mit 10 Runden spielen | Das gesperrte Minispiel kommt nicht vor | | |
| RO3 | Browser schließen, Server neu starten, Host wieder öffnen | Sperre und Favorit sind wieder gesetzt | | |
| RO4 | Partie mit geteiltem iPad (zwei Zonen) und einem iPhone | Startet normal; alle Minispiele bleiben an den Zonen bedienbar (heute sind alle als iPad-tauglich markiert) | | |

## 41. Rummelplatz: Karussell, Kulisse und Nacht (für CHAOS-199)

**Stand:** 2026-11-20 · **Aufgabe:** CHAOS-199 · **Entscheidung:** ADR-022 · **Experiment:** EXP-035

Automatisch geprüft (Mac): Regeln und Validierung (Unit- und Integrationstests, Bot-Partien), PC-Host im Chromium mit Metal (Bilder unter `docs/screenshots/chaos199-*`), USDZ-Export und beide Prüfskripte, Mac-App und tvOS-Simulator mit je vier Bots über drei Runden bis zum Siegerbild, Zufall mit sieben Revanchen am Mac (Kulisse wechselte sechsmal in beide Richtungen ohne Neustart). **Nicht** geprüft: echte Apple TV (Ladezeit der zweiten Kulisse, im Simulator 4,2 s; Bildrate bei 81 Feldern und Lichterketten), Lesbarkeit und Spielspaß am Fernseher.

| ID  | Schritt | Erwartung | Ergebnis | Nachweis |
| --- | ------- | --------- | -------- | -------- |
| RP1 | PC und Apple TV: Lobby, Brett „Rummelplatz“ wählen | Lobby zeigt „Rummelplatz · 81 Felder“; Apple TV wechselt den Hintergrund auf den nächtlichen Jahrmarkt | | Foto |
| RP2 | Partie starten, erste Runde | Dämmerung, Lichterketten leuchten, das goldene Tor des Karussells zeigt nach links (Spiegelkabinett) | | Foto |
| RP3 | Rundenwechsel | Karussell dreht eine Runde weiter und zeigt nach vorn (Startplatz), dann rechts (Geisterbahn); ab etwa Runde 4 von 12 Nacht | | Video |
| RP4 | An Gabel B (oben Mitte) wählen | Controller zeigt „Karussell“ mit Zusatz „Karussell → …“ passend zum Tor; die Figur fährt ohne Nachfrage über das Karussell zum angesagten Ausgang | | Foto |
| RP5 | Geisterbahn und Losbudengasse ansehen | Portale, Gespenster, Losbuden erkennbar, kein Feld verdeckt | | Foto |
| RP6 | Apple TV: ganze Partie mit 4 Spielern | Bildrate wie auf dem Wackelwald (Gerätecheckliste §34), Log „Brett rummelplatz geladen … in … ms“ notieren | | Log |
| RP7 | Spieltest-Frage | Ist die Ost-Ausfahrt (Ehrenrunde zurück in die Geisterbahn) lustig oder ärgerlich? Ist klar, wohin das Karussell gerade fährt? | | Notiz |

## 42. Minispiel-Galerie und Daumen (für CHAOS-87)

**Stand:** 2026-11-20 · **Aufgabe:** CHAOS-87 · **Protokoll:** v4-Nachtrag CHAOS-87 (`start.practice`, `rate`, `ratings`)

Automatisch geprüft (Linux): Übungsrunde in game-core (ohne Münzen, Siege, Items; Ende nach dem Ergebnis), Session (Übungsstart, Daumen nur in der Ergebnisanzeige, Umentscheiden ersetzt, Rückweg zum Brett bzw. in die Lobby genauso schnell mit und ohne Stimmen), Stimmen-Datei und Export `/ratings.json`, E2E: Galerie öffnen → Pump-Parade üben → Ergebnis → Daumen am iPhone (Chromium-Emulation) → Galerie zeigt die Stimme. **Nicht** automatisch geprüft: Tippen auf echtem iOS, Lesbarkeit am Fernseher, Datei nach Server-Neustart auf Rubens PC. **Noch nicht umgesetzt:** Daumen in den iPad-Zonen und in der nativen Controller-App, Galerie am Apple-Host (eigene Folgeaufgaben); dort fehlen die Knöpfe, alles andere läuft wie bisher.

| ID  | Schritt | Erwartung | Ergebnis | Nachweis |
| --- | ------- | --------- | -------- | -------- |
| GA1 | PC: `pnpm play`, Lobby, „Minispiel-Galerie“ | Alle Minispiele mit Status (Rotation/Spielbar), Kategorie, Spielzeit, Bedienung und Daumen; Liste scrollt, Escape schließt | | Foto |
| GA2 | Ein iPhone verbinden (nicht bereit), in der Galerie „Üben“ bei einem Spiel, am Handy „Bereit!“ | Gleich die Anleitung dieses Spiels, kein Brettzug; auch gesperrte Spiele lassen sich üben; Handy zeigt Anleitung, dann Joystick/Knöpfe | | |
| GA3 | Spiel zu Ende spielen | PC: Ergebnis ohne Münzspalte, Hinweis „Übungsrunde – keine Münzen“; iPhone: Platz, kein „Keine Münzen“, Frage „Hat’s Spaß gemacht?“ mit 👍/👎 | | Foto |
| GA4 | 👍 tippen, dann 👎 | Gewählter Daumen leuchtet in Spielerfarbe sofort; Umentscheiden geht; nach ~6 s ohne Warten zurück in der Lobby | | |
| GA5 | Galerie erneut öffnen | Spiel zeigt 👍 0 · 👎 1 („1 Stimme“) | | |
| GA6 | Echte Partie, nach einem Minispiel 👍 am Handy | Stimme zählt in der Galerie dazu; das Brett geht nach dem Ergebnis genauso schnell weiter wie ohne Stimme | | |
| GA7 | „Stimmen exportieren“ | Browser lädt `minispiel-stimmen-<Datum>.json` mit allen Spielen und Einzelstimmen | | Datei |
| GA8 | Server beenden und neu starten (`pnpm play`), Galerie öffnen | Stimmen sind noch da (Datei `~/.chaos-party/minispiel-stimmen.json`, Pfad steht beim Start im Terminal) | | |
| GA9 | Ruben: Urteil | Sind die Daumen am Handy schnell genug erreichbar? Schwelle für den Rauswurf-Vorschlag (6 Stimmen, ≥ 60 % runter) sinnvoll? | | Kommentar an CHAOS-87 |

## 43. Frostgipfel: Eis, Seilbahn, Lawinen und Winterkulisse (für CHAOS-198)

**Stand:** 2026-11-20 · **Aufgabe:** CHAOS-198 · **Entscheidung:** ADR-023 · **Experiment:** EXP-036

Automatisch geprüft (Mac): Regeln und Validierung (Unit- und Integrationstests, Bot-Partien), PC-Host in Chrome mit Metal (Bilder unter `docs/screenshots/chaos198-*`), E2E Lobby-Wahl und Brett-Szene, USDZ-Export samt Prüfung, Mac-App und tvOS-Simulator mit je vier Bots über vier Runden bis zum Siegerbild (Lawine zu Beginn von Runde 4 angesagt). **Nicht** geprüft: echte Apple TV (Ladezeit der Kulisse, im Simulator 4,1 s; Bildrate in 4K), Lesbarkeit und Spielspaß am Fernseher.

| ID  | Schritt | Erwartung | Ergebnis | Nachweis |
| --- | ------- | --------- | -------- | -------- |
| FG1 | PC und Apple TV: Lobby, Brett „Frostgipfel“ wählen | Lobby zeigt „Frostgipfel · 75 Felder“; Partie startet im Schnee mit Gipfel in der Mitte | | Foto |
| FG2 | An der Talstation (unten rechts vom Start) mit mindestens 8 Münzen ankommen | Controller bietet „Talweg“ und „Seilbahn · 8 Münzen“; mit weniger als 8 Münzen läuft die Figur ohne Frage den Talweg | | Foto |
| FG3 | Seilbahn wählen | 8 Münzen weg, die Figur springt zur Bergstation vor dem Gipfel und läuft dort weiter | | Video |
| FG4 | Auf einem Eisfeld (hellblau mit Schneeflocke) landen | Figur rutscht weiter, Popup „Rutsch!“; auf der Rodelbahn bis zum ersten festen Feld; erst dort gilt das Feld | | Video |
| FG5 | Runde 3 beginnt | Einblendung „Lawinengefahr am Gletscherpfad!“; zu Beginn von Runde 4 „Lawine am Gletscherpfad!“, Kamera zeigt den Hang, Figuren dort verlieren 5 Münzen | | Video |
| FG6 | Apple TV: ganze Partie mit 4 Spielern | Bildrate wie auf dem Wackelwald (Gerätecheckliste §34), Log „Brett frostgipfel geladen … in … ms“ notieren | | Log |
| FG7 | Spieltest-Frage | Ist die Lawinen-Warnung verständlich? Lohnt sich die Seilbahn gezielt? Fühlt sich das Rutschen lustig oder zufällig an? | | Notiz |

## 44. Echte Klänge am Fernseher und am PC (für CHAOS-223)

**Stand:** 2026-11-20 · **Aufgabe:** CHAOS-223 · **Entscheidung:** ADR-019 Nachtrag 6, EXP-035

Automatisch geprüft (Mac): Klang-Dateien im Bündel und dekodierbar (`--selftest`), Wahl und Rückfall in Unit-Tests, Bot-Partie am Mac ohne Fehlerzeilen. **Nicht** automatisch prüfbar: wie es klingt, Lautstärke im Verhältnis, Lautsprecher der Apple TV bzw. des Fernsehers.

| ID  | Schritt | Erwartung | Ergebnis | Nachweis |
| --- | ------- | --------- | -------- | -------- |
| KL1 | Apple TV: App starten, Partie mit iPhones | Log „Klang-Dateien: 40 geladen in … ms“; Würfel klappern, Münzen klimpern, Zugbeginn ist ein kurzer Pizzicato-Lauf | | Log |
| KL2 | Minispiele der Rotation spielen | Trillerpfeife zum Start, Boing, Platschen, Wusch, Plopp hörbar; nichts kommt verspätet | | |
| KL3 | Ergebnis und Finale, Kuckucks-Klatsche | Jubel und Fanfare nicht zu lang, nicht zu laut; die Finte (kurzer Saxofon-Lauf abwärts, bis zu 8× je Spiel) nervt nicht | | |
| KL4 | Pause (Play/Pause) und Weiter | Kurzer Klang beim Anhalten und Weiterspielen | | |
| KL5 | PC: `pnpm play`, eine Runde | Dieselben Klänge wie auf der Apple TV | | |
| KL6 | Ruben: Urteil | Welche Klänge tauschen, welche lauter oder leiser? | | Kommentar an CHAOS-223 |

## 45. Großer Wackelwald (für CHAOS-196)

**Stand:** 2026-11-20 · **Aufgabe:** CHAOS-196 · **Experiment:** [EXP-037](experiments.md)

Automatisch geprüft: Brett-Validierung, Bot-Simulation (Trophäen, faire Wegwahl), Unit-Tests der Kulisse, E2E am PC-Host (Linux, SwiftShader), Kulisse als USDZ (`pnpm build:apple-assets`, `check_usdz.py`, `check_realitykit.swift`), Bot-Partie im tvOS-Simulator. **Nicht** automatisch prüfbar: ob das größere Brett vom Sofa aus lesbar ist, Bildrate und Ladezeit auf der echten Apple TV, wie sich die Wegwahl anfühlt.

| ID  | Schritt | Erwartung | Ergebnis | Nachweis |
| --- | ------- | --------- | -------- | -------- |
| GW1 | PC am Fernseher: `pnpm play`, Partie mit 4 Spielern, 12 Runden | Überblick zu Rundenbeginn zeigt das ganze Brett, Felder und Wegweiser lesbar; danach nah an der Figur | | Foto |
| GW2 | An jeder der vier Gabeln wählen (Klippenweg/Sumpf, Bachlauf/Lichtung, Uferweg/Baumkronenweg, Pilzpfad/Wackelbrücke) | Beide Wege samt Wegweiser im Bild, Controller-Knöpfe zeigen die Namen | | Foto |
| GW3 | Apple TV (TestFlight): GW1 | Wie am PC; Bildrate in `HOST-MESSUNG` (Phase `board`) weiter ≥ 30 fps, Ladezeit der Kulisse im Log notieren | | Log |
| GW4 | Mac-App: GW1–GW2 | Wie auf der Apple TV | | |
| GW5 | Ruben: Urteil | Brett groß genug? Wege abwechslungsreich? Lichtung als Abkürzung reizvoll, Baumkronenweg riskant genug? 10 oder 12 Runden? | | Kommentar an CHAOS-196 |

## 46. Spielformen mit Teams und Koop (für CHAOS-89)

**Stand:** 2026-11-21 · **Aufgabe:** CHAOS-89 · **Protokoll:** v4-Nachtrag CHAOS-89 (`teams`, `outcome`, Kontext `team`)

Automatisch geprüft (Linux): Zuteilung, Ersatz zu zweit und zu dritt, Prüfung des Ausgangs und Münzen in game-core; Session mit Pump-Duell, Pump-Solo und Riesenballon für 2, 3 und 4 Personen; Headless-Läufe der drei Testspiele; E2E: Galerie → Pump-Duell mit vier iPhones (Chromium-Emulation) → Team-Ansage am PC, Rolle am Handy, Team-Ergebnis (Bilder `tests/e2e/__screenshots__/minispiel-spielformen.spec.ts/`). **Nicht** automatisch geprüft: Lesbarkeit am Fernseher, ob Teams Spaß machen. **Noch nicht umgesetzt:** Rolle in der nativen Controller-App (CHAOS-229), Team-Ansage am Apple-Host (CHAOS-230).

| ID  | Schritt | Erwartung | Ergebnis | Nachweis |
| --- | ------- | --------- | -------- | -------- |
| SF1 | PC: Galerie, vier iPhones, „Üben“ bei Pump-Duell | Anleitung zeigt „2 gegen 2“, Team ☀ Sonne und Team ☾ Mond mit Namen; jedes Handy zeigt „Team Sonne“ bzw. „Team Mond“ und „Du und … gegen …“ | | Foto |
| SF2 | Nur ein Team pumpt | PC: „☾ Team Mond gewinnt: …“; Handys: „Dein Team hat gewonnen!“ bzw. „verloren“ | | Foto |
| SF3 | Pump-Solo mit drei Handys | „Einer gegen zwei“, Hinweis „… spielt allein und hat einen Vorteil“; Handy der Einzelperson „Allein gegen alle“ | | Foto |
| SF4 | Riesenballon mit zwei Handys | „Alle zusammen“, Banner „Stufe … von 3“ im Spiel, Ergebnis „Gut geschafft – Stufe 2 von 3“ o. ä. | | Foto |
| SF5 | Ruben: Urteil | Team-Sieg mit 7 Münzen lohnend? „Letzter gegen alle“ spannend oder demütigend? Koop für alle lohnend? (EXP-038) | | Kommentar an CHAOS-89 |
