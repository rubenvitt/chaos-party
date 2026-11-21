# Experiment-Log

Gameplay-, Art- und Technik-Experimente nach dem Protokoll aus `CLAUDE.md` („Experiment protocol“). Ablauf und Zunder-Spiegelung beschreibt der Skill `experiment-protokollieren`.

**Grundsätze**

- Eintrag **vor** dem Experiment anlegen (Hypothese, Varianten, Messgrößen), Ergebnis und Entscheidung **danach** ergänzen.
- Fortlaufende Nummer `EXP-<nnn>`, auslösende Aufgabe `CHAOS-…` im Titel.
- Feste Seeds, wiederholbare Skripte; Commit angeben.
- Automatische Messwerte sind **Näherungen**, kein Beweis für Spaß. Was nur Menschen beurteilen können, steht unter „Offen für Playtest“ und wandert in den Abnahmebericht.
- Experimente ändern nichts, was eine Freigabe braucht (PC-only-Host, 2–4 lokale Spieler, Controller-Modell, Genre, Trophäen-Sieg, Art-Direction-Kern, Meilenstein-Umfang, Kosten).
- Verworfene, später vielleicht interessante Varianten → Unteraufgabe von `CHAOS-44` mit Verweis auf `EXP-<nnn>`.

## Übersicht

| EXP     | Thema                                                                                             | Aufgabe            | Entscheidung                                                                                                                                                                                          |
| ------- | ------------------------------------------------------------------------------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| EXP-001 | Brett-Tempo: Würfel und Pacing                                                                    | CHAOS-24           | keep: W6, Pacing unverändert; Rundenzahl als Frage an Ruben                                                                                                                                           |
| EXP-002 | Münzen und Trophäen                                                                               | CHAOS-24           | keep G: 6 Kandidaten, 3 wandernd aktiv, Preis 15                                                                                                                                                      |
| EXP-003 | Item-Häufigkeit und Sabotage                                                                      | CHAOS-24           | keep F: 6 Item-Felder, 1 Start-Item, Falle beim Überqueren, Klau 5/Falle 4                                                                                                                            |
| EXP-004 | Reaktionsfenster                                                                                  | CHAOS-24           | keep 3000 ms; nach Playtest mit echten Reaktionszeiten neu bewerten                                                                                                                                   |
| EXP-005 | Arcade-Minispiel: drei Konzepte                                                                   | CHAOS-29, CHAOS-30 | keep A4 „Sockenregen“; B „Kuckucks-Klatsche“, C „Aufzieh-Takt“ discard                                                                                                                                |
| EXP-006 | Physik-Minispiel (Havok): Konzepte                                                                | CHAOS-29, CHAOS-31 | keep A5 „Pudding-Gerangel“ (Kirschfleck + Wackelkrone); „Letzter oben“, Saldo, „Krümel-Kehraus“ discard                                                                                               |
| EXP-007 | Hybrid-Minispiel: Konzepte                                                                        | CHAOS-29, CHAOS-32 | keep A6 „Wackelturm“; B „Geysir-Gier“ discard (gierig dominant)                                                                                                                                       |
| EXP-008 | Look-Dev: drei moderne Stilrichtungen                                                             | CHAOS-56           | Mix aus A und C, etwas realistischer → EXP-009                                                                                                                                                        |
| EXP-009 | Look-Dev Runde 2: „Stilisierte Natur“                                                             | CHAOS-57           | keep: Richtung bestätigt (Ruben, 2026-11-15); Lichtstimmung offen → EXP-010                                                                                                                           |
| EXP-010 | Lichtstimmung: je Brett, Uhrzeit oder Spielverlauf, inkl. Nacht                                   | CHAOS-60           | keep C „Spielverlauf“ (Ruben, 2026-11-15); A und B discard                                                                                                                                            |
| EXP-011 | Partiedauer und Runden-Vorschläge mit echten Minispielen                                          | CHAOS-40, CHAOS-66 | Vorschläge 3/5/8 → **10/16/20**, Standard 5 → **10**; 40 min nicht unter `MAX_ROUNDS` 20; Nachtrag: kurze Anleitung bei Wiederholung (3 s) spart 0,4–1,1 min                                          |
| EXP-012 | Wertung, Gleichstandsregel, Aufholeffekt, Trophäen-Ökonomie                                       | CHAOS-40           | keep: Preis 15, Minispiel 10/5/3/0; dritte Stufe (Minispiel-Siege) fast nie nötig                                                                                                                     |
| EXP-013 | Sabotage-Häufigkeit und Item-Stärke über lange Partien                                            | CHAOS-40           | keep Klau 5/Falle 4; iterate nach Playtest (erster Hebel Klau 6/Falle 5)                                                                                                                              |
| EXP-014 | Host-Grafik auf echter GPU: Engpass der Grafikstufen                                              | CHAOS-73           | keep: PCSS mit Filterstufe LOW, Auflösungsgrenze je Stufe, Automatik merkt sich die Stufe; WebGPU → CHAOS-75                                                                                          |
| EXP-016 | Kuckucks-Klatsche überarbeitet: Arcade nur mit A                                                  | CHAOS-54           | keep K2: eigene Türen, Gong-Klau, Finten, 1 s benommen, Mitternacht; Finten-Beutel (K8) discard                                                                                                       |
| EXP-018 | Wachsende Sabotage über die Partiedauer                                                           | CHAOS-67           | keep F: Klau 5/Falle 4, **+1 alle 5 Runden**; Klau 6/Falle 5 fest discard (Anfang zu hart)                                                                                                            |
| EXP-019 | Zurückgestellte Balance-Ideen (Würfel 2–7, Trophäen-Ziel, Item nach dem Minispiel, Schild/Fallen) | CHAOS-51           | keep **Trostpreis**: 1 Item für den letzten Minispiel-Platz (neuer Standard); Sieg-Item, W 2–7, Schild gegen Fallen discard; `ahead` iterate; Fallen bleiben sichtbar                                 |
| EXP-022 | Aufholhilfe für Zurückliegende                                                                    | CHAOS-65           | keep T: Trophäe wandert vor die Letzten (`trophy.placement: 'nearest-to-last'`, Standard); iterate Rückenwind (abschaltbar, aus); Rabatt, Finale-Fieber, Bonus-Trophäen, „weg von der Spitze“ discard |

---

## Vorlage

Zum Anlegen kopieren und unterhalb dieser Vorlage einfügen (neueste unten).

```markdown
## EXP-<nnn>: <Thema> (<JJJJ-MM-TT>, CHAOS-…)

**Hypothese / gewünschtes Spielerlebnis:** …

**Varianten:**

- A: … – erwartete Vor-/Nachteile
- B: … – erwartete Vor-/Nachteile

**Objektive Messgrößen:** z. B. Rundendauer, Trophäen-Abstand, Sabotage-Häufigkeit,
Eingabelatenz, Kollisionsstabilität, Disconnect-Rate

**Subjektive Playtest-Fragen (für Ruben):** …

**Testumgebung:** Rechner/Browser, Seeds, Anzahl simulierter Partien, Commit

<!-- nach dem Experiment ergänzen -->

**Ergebnisse:** Tabelle/Zahlen, Screenshot- oder Videopfade

**Entscheidung:** keep | iterate | discard – Begründung

**Offen für Playtest:** …
```

---

<!-- Einträge ab hier -->

## Gemeinsamer Aufbau von EXP-001 … EXP-004 (2026-11-15, CHAOS-24)

Die vier ersten Gameplay-Experimente für M2 sind Bot-Simulationen ganzer Partien mit dem echten Regelwerk (`packages/game-core`). Sie liefern **Näherungen**: Bots würfeln, wählen Wege und setzen Items nach festen Regeln ein. Ob das Brett Spaß macht, Sabotage witzig statt gemein ist und das Tempo stimmt, beurteilt erst Ruben im Playtest bei der M2-Abnahme.

**Wiederholen** (≈ 7 s):

```sh
EXPERIMENTS=1 pnpm exec vitest run packages/game-core/src/rules/experiments.test.ts --silent=false
```

`--silent=false` ist nötig, weil Vitest die Konsolenausgabe bestandener Tests sonst ausblendet. Ohne `EXPERIMENTS=1` läuft nur ein Smoke-Test mit 2 Seeds (Teil von `pnpm test`, < 0,5 s).

- **Code:** Varianten und Kennzahlen in `packages/game-core/src/rules/experiments.ts`, Bot-Partien in `packages/game-core/src/rules/simulate.ts`.
- **Seeds:** 1–200 je Variante und Spielerzahl (2, 3, 4), also 600 Partien je Variante. **5 Runden** (damaliger Server-Standard `DEFAULT_ROUNDS`, seit EXP-011 10), Brett Wackelwald.
- **Wiederholbarkeit:** Alle Varianten bauen auf `START_RULES`/`START_BOARD` auf (Werte vor CHAOS-24), nicht auf `DEFAULT_RULES`. Die Zeile **Z** zeigt jeweils die neuen Standardwerte. Ein Test prüft, dass die gewählten Werte (`CHOICE_RULES`, `CHOICE_BOARD`) genau `DEFAULT_RULES` und dem Wackelwald entsprechen.
- **Bots (`EXPERIMENT_POLICY`):** Entscheidungszeit gleichverteilt 0,8–2,5 s. Items vor dem Wurf mit 50 % Wahrscheinlichkeit einsetzen. Münzklau auf die reichste Person. Trophäe immer kaufen, wenn das Geld reicht. An Gabeln zu 75 % den kürzeren Weg zur nächsten aktiven Trophäe, sonst zufällig (Menschen sehen die Trophäe am Fernseher). Reaktion zu 70 % mit 600–3600 ms (EXP-004: eigene Profile). Wie stark die Ergebnisse am Bot-Verhalten hängen, zeigt die Robustheitstabelle unter EXP-003.
- **Dauer:** Pacing plus Bot-Entscheidungszeit. „Brett min“ ist die Partiedauer ohne die Minispielphasen. Der Platzhalter braucht 10 s je Runde (Intro, Spiel, Ergebnis, Rundenende). Echte Minispiele (M3) dauern länger.
- **Testumgebung:** Node 22.23, Linux-Container, Branch `worktree-agent-ac81de606622de954`, Basis-Commit `9e8da68`, Ergebnisse vom Commit, der diesen Eintrag einführt.

**Neue Regel-Stellschrauben (additiv im `RuleSet`, Protokoll und Apps unverändert):**

- `trophy.activeCount`: Bei `wandering` sind so viele Trophäen gleichzeitig aktiv. Nach einem Kauf wandert genau die gekaufte Trophäe auf ein freies Feld, der Trophäen-Wirbel bewegt eine zufällige aktive.
- `items.startItems`: So viele zufällige Items bekommt jeder beim Start (`item-gained` direkt nach `game-started`).
- `items.trapTrigger`: Bei `land` löst eine Falle nur beim Landen aus, bei `pass` auch beim Darüberlaufen. Die Figur hält an, die Falle löst aus (`trap-triggered`, Münzen), nach `spaceEventMs` geht es weiter. Liegt dort auch eine aktive Trophäe, folgt danach das Kaufangebot.

**Neu in der Simulation:** `BotPolicy.trophyPathChance`, log-normale Reaktionszeiten (`DelayModel`), `SimulationResult.reactionWaitsMs` und `sabotageLosses` (Verlust samt Bestand davor).

---

## EXP-001: Brett-Tempo – Würfelverteilung und Pacing (2026-11-15, CHAOS-24)

**Hypothese / gewünschtes Spielerlebnis:** Der Brettteil ist schnell und lesbar. Ein fremder Zug dauert unter ~10 s, die Wartezeit bis zum eigenen Zug liegt bei 4 Spielern unter ~30 s. Kaum ein Wurf wirkt nutzlos. Richtwert des Koordinators: 4 Spieler, 5 Runden, ohne Minispiele grob 8–15 Minuten. Erwartung vorher: Würfel und Feldtakt bestimmen die Partiedauer spürbar.

**Varianten:**

- A: W6, 350 ms je Feld (Startwerte). Vertraut, ein Drittel der Würfe ist 1–2.
- B: Würfel [1,2,3,3,4,4,5,6]. Gleicher Mittelwert, weniger Ausreißer, ungewohnter Würfel.
- C: W4, Doppelwürfel doppelt so häufig. Kurze Züge, Items wichtiger.
- D: Würfel 2–7. Mehr Strecke je Zug, keine 1.
- E: W6, 250 ms je Feld. Schneller, Laufen schwerer zu verfolgen.
- F: W6 mit knappen Pausen (Zugbeginn 900, Wurf 900, Feld 300, Feldereignis 1300, Zugende 400 ms). Schneller, Host-Effekte (700–1300 ms) knapp.

**Objektive Messgrößen:** Brett-Dauer je Partie (Mittel, 90 %-Quantil), Zugdauer (Mittel, p90), Wartezeit zwischen zwei eigenen Zügen (= (Spieler − 1) × Zugdauer), Felder je Zug, Anteil Züge mit höchstens 2 Feldern, Trophäen je Partie als Nebenwirkung.

**Subjektive Playtest-Fragen (für Ruben):** Fühlt sich ein Zug (≈ 8 s) zügig an, und ist die Wartezeit (≈ 25 s bei vier Spielern) okay? Reichen die Pausen, um Münzen, Items und Fallen am Fernseher mitzubekommen? Welche Rundenzahl soll Standard sein (5 = kurz)?

**Testumgebung:** siehe „Gemeinsamer Aufbau“. Zusatztabelle Rundenzahl: neue Standardwerte, 5/8/10/12 Runden, Seeds 1–200.

**Ergebnisse:**

**EXP-001 Brett-Tempo (5 Runden, Seeds 1–200 je Zeile)**

| Variante                   | Sp. | Brett min | Brett min p90 | Zug s | Zug s p90 | Warten s | Felder/Zug | ≤ 2 Felder | Trophäen |
| -------------------------- | --- | --------- | ------------- | ----- | --------- | -------- | ---------- | ---------- | -------- |
| A: W6, 350 ms/Feld (Start) | 2   | 1,3       | 1,4           | 7,3   | 9,5       | 7        | 3,59       | 32 %       | 0,63     |
| A: W6, 350 ms/Feld (Start) | 3   | 2,0       | 2,1           | 7,3   | 9,4       | 15       | 3,58       | 33 %       | 0,66     |
| A: W6, 350 ms/Feld (Start) | 4   | 2,6       | 2,8           | 7,2   | 9,2       | 22       | 3,52       | 34 %       | 0,68     |
| B: Würfel 1,2,3,3,4,4,5,6  | 2   | 1,3       | 1,4           | 7,3   | 9,4       | 7        | 3,60       | 23 %       | 0,59     |
| B: Würfel 1,2,3,3,4,4,5,6  | 3   | 2,0       | 2,1           | 7,3   | 9,5       | 15       | 3,60       | 24 %       | 0,61     |
| B: Würfel 1,2,3,3,4,4,5,6  | 4   | 2,6       | 2,7           | 7,3   | 9,2       | 22       | 3,56       | 25 %       | 0,70     |
| C: W4 + Doppelwürfel ×2    | 2   | 1,3       | 1,4           | 6,9   | 8,9       | 7        | 2,59       | 50 %       | 0,30     |
| C: W4 + Doppelwürfel ×2    | 3   | 1,9       | 2,0           | 6,9   | 8,9       | 14       | 2,61       | 48 %       | 0,39     |
| C: W4 + Doppelwürfel ×2    | 4   | 2,5       | 2,6           | 6,9   | 8,8       | 21       | 2,59       | 49 %       | 0,42     |
| D: Würfel 2–7              | 2   | 1,4       | 1,5           | 7,9   | 10,2      | 8        | 4,55       | 16 %       | 0,93     |
| D: Würfel 2–7              | 3   | 2,1       | 2,3           | 7,9   | 10,2      | 16       | 4,58       | 16 %       | 1,01     |
| D: Würfel 2–7              | 4   | 2,8       | 2,9           | 7,8   | 9,9       | 23       | 4,54       | 17 %       | 1,09     |
| E: W6, 250 ms/Feld         | 2   | 1,3       | 1,4           | 7,0   | 9,0       | 7        | 3,59       | 32 %       | 0,63     |
| E: W6, 250 ms/Feld         | 3   | 1,9       | 2,0           | 7,0   | 8,9       | 14       | 3,58       | 33 %       | 0,66     |
| E: W6, 250 ms/Feld         | 4   | 2,5       | 2,6           | 6,9   | 8,7       | 21       | 3,52       | 34 %       | 0,68     |
| F: W6, knappe Pausen       | 2   | 1,2       | 1,2           | 6,5   | 8,6       | 7        | 3,59       | 32 %       | 0,63     |
| F: W6, knappe Pausen       | 3   | 1,7       | 1,8           | 6,5   | 8,5       | 13       | 3,58       | 33 %       | 0,66     |
| F: W6, knappe Pausen       | 4   | 2,3       | 2,4           | 6,4   | 8,3       | 19       | 3,52       | 34 %       | 0,68     |
| Z: neue Standardwerte      | 2   | 1,6       | 1,7           | 8,7   | 13,1      | 9        | 3,79       | 31 %       | 2,52     |
| Z: neue Standardwerte      | 3   | 2,3       | 2,5           | 8,5   | 12,6      | 17       | 3,75       | 32 %       | 2,90     |
| Z: neue Standardwerte      | 4   | 3,0       | 3,2           | 8,4   | 12,3      | 25       | 3,75       | 32 %       | 3,18     |

**EXP-001 Rundenzahl mit neuen Standardwerten (Seeds 1–200 je Zeile)**

| Runden    | Sp. | Brett min | Felder/Sp. | Trophäen | Sieger | ohne Trophäe | Münzen entscheiden |
| --------- | --- | --------- | ---------- | -------- | ------ | ------------ | ------------------ |
| 5 Runden  | 2   | 1,6       | 19         | 2,52     | 1,75   | 18 %         | 30 %               |
| 5 Runden  | 3   | 2,3       | 19         | 2,90     | 1,66   | 28 %         | 38 %               |
| 5 Runden  | 4   | 3,0       | 19         | 3,18     | 1,50   | 35 %         | 51 %               |
| 8 Runden  | 2   | 2,4       | 30         | 4,09     | 2,77   | 6 %          | 16 %               |
| 8 Runden  | 3   | 3,6       | 30         | 5,04     | 2,64   | 13 %         | 30 %               |
| 8 Runden  | 4   | 4,7       | 30         | 5,39     | 2,26   | 17 %         | 45 %               |
| 10 Runden | 2   | 3,0       | 37         | 5,03     | 3,32   | 4 %          | 22 %               |
| 10 Runden | 3   | 4,5       | 37         | 6,08     | 3,13   | 9 %          | 25 %               |
| 10 Runden | 4   | 5,9       | 37         | 6,59     | 2,75   | 13 %         | 41 %               |
| 12 Runden | 2   | 3,6       | 45         | 6,43     | 4,18   | 2 %          | 15 %               |
| 12 Runden | 3   | 5,4       | 44         | 7,92     | 4,01   | 5 %          | 20 %               |
| 12 Runden | 4   | 7,1       | 44         | 8,76     | 3,64   | 8 %          | 27 %               |

- Die Zugdauer ist fast nur Pacing plus Entscheidung: A–F liegen bei 6,4–7,9 s. 250 ms je Feld spart 0,3 s je Zug, knappe Pausen sparen 0,8 s. Der Würfel ändert die Dauer kaum (2–7: +0,6 s).
- Mit den neuen Regeln (Z) dauert ein Zug im Mittel 8,4–8,7 s (p90 12–13 s): mehr Items, Reaktionsfenster, Fallen und Trophäenkäufe. Bei 4 Spielern wartet man ≈ 25 s auf den eigenen Zug.
- **Der Richtwert 8–15 min wird mit 5 Runden deutlich unterschritten:** 4 Spieler brauchen ≈ 3 min Brettzeit. Langsameres Pacing wäre der falsche Hebel, denn das widerspricht „schnell und lesbar“. Mit echten Minispielen (angenommen 60–90 s plus ≈ 8,5 s Intro und Ergebnis je Runde) kommen 5 Runden auf ≈ 9–11 min, 8 Runden auf ≈ 14–18 min.
- B senkt die Kurzzüge von ≈ 33 % auf ≈ 24 % bei gleicher Länge. Ob man das am Tisch merkt, ist fraglich, und ein W6 versteht jeder sofort. C halbiert die Trophäen und macht jeden zweiten Zug kurz. D bringt +27 % Strecke und mehr Trophäen, wirkt aber erst zusammen mit der Ökonomie (EXP-002, Variante H).

**Entscheidung:** **keep** – W6 und das bisherige Pacing bleiben (`stepMs` 350, `spaceEventMs` 1500 ≥ 700–1300 ms Host-Effekt). **discard** B (kein messbarer Vorteil, ungewohnter Würfel), C (zu zäh), E und F (weniger als 1 s Gewinn je Zug, Risiko, dass Host-Animationen nicht mehr in die Pausen passen). D zurückgestellt (siehe unten). Die Rundenzahl ist der eigentliche Hebel für die Partiedauer, das ist eine Frage an Ruben (siehe „Offen für Playtest“).

**Offen für Playtest:** Zugtempo und Wartezeit am echten Fernseher. Standard-Rundenzahl: Vorschlag 5 als „kurz“, 8 als „normal“ für die Lobby-Einstellung in M4.

**Für später (CHAOS-44):** Würfel 2–7 als Option für kurze Partien (EXP-001 D, EXP-002 H). Runden-Voreinstellungen kurz/normal/lang (5/8/12) in der Lobby.

---

## EXP-002: Münzbelohnungen und Trophäen-Ökonomie (2026-11-15, CHAOS-24)

**Hypothese / gewünschtes Spielerlebnis:** Trophäen entscheiden das Spiel. Auch in einer kurzen Partie hat fast jeder eine realistische Chance auf eine Trophäe, der Sieger hat meist mehr als eine, und Münzen entscheiden nur bei Gleichstand. Eigene Zielwerte für 5 Runden: kaum Partien ohne Trophäe (≤ 2 %), höchstens 40 % der Spieler ohne Trophäe, Sieger im Mittel mindestens 1,5 Trophäen, Münzen entscheiden in höchstens etwa der Hälfte der Partien.

**Varianten** (A–D auf dem Startbrett mit 4 Trophäen-Kandidaten s12, s24, s36, s42; E–H mit zwei zusätzlichen Kandidaten s16 (Sumpfabkürzung) und s21 (oben), die in 5 Runden erreichbar sind):

- A: Preis 20, eine wandernde Trophäe (Startwerte).
- B: Preis 15. Billiger, aber die Erreichbarkeit bleibt gleich.
- C: alle 4 fest aktiv. Viele Gelegenheiten, aber keine Wanderung und der Trophäen-Wirbel wirkt nicht.
- D: 2 von 4 wandernd.
- E: 6 Kandidaten, 2 wandernd, Preis 15.
- F: 6 Kandidaten, 3 wandernd, Preis 20.
- G: 6 Kandidaten, 3 wandernd, Preis 15.
- H: G mit Würfel 2–7.

**Objektive Messgrößen:** gekaufte Trophäen je Partie, Trophäen des Siegers, Abstand Platz 1–2, Anteil Partien mit gleich vielen Trophäen auf Platz 1 und 2 („Münzen entscheiden“), geteilter Sieg, Anteil Spieler ohne Trophäe, Anteil Partien ganz ohne Trophäe, Münzen am Ende.

**Subjektive Playtest-Fragen (für Ruben):** Sind drei gleichzeitig sichtbare Trophäen am Fernseher lesbar und reizvoll? Wirkt ein Preis von 15 Münzen verdient oder zu billig? Ist es in Ordnung, dass bei vier Spielern in etwa jeder zweiten 5-Runden-Partie die Münzen den Gleichstand entscheiden? (VISION: Münzen als Tiebreaker sollen validiert werden.) Lohnt sich die Wegwahl Richtung Trophäe?

**Testumgebung:** siehe „Gemeinsamer Aufbau“.

**Ergebnisse:**

**EXP-002 Ökonomie (5 Runden, Seeds 1–200 je Zeile)**

| Variante                         | Sp. | Trophäen/Partie | Sieger | Abstand 1–2 | Münzen entscheiden | geteilter Sieg | ohne Trophäe | Partien ohne | Münzen Ende |
| -------------------------------- | --- | --------------- | ------ | ----------- | ------------------ | -------------- | ------------ | ------------ | ----------- |
| A: Preis 20, 1 wandernd (Start)  | 2   | 0,63            | 0,54   | 0,46        | 59 %               | 2 %            | 71 %         | 50 %         | 47,4        |
| A: Preis 20, 1 wandernd (Start)  | 3   | 0,66            | 0,57   | 0,48        | 53 %               | 2 %            | 78 %         | 44 %         | 42,2        |
| A: Preis 20, 1 wandernd (Start)  | 4   | 0,68            | 0,56   | 0,45        | 56 %               | 0 %            | 83 %         | 45 %         | 35,5        |
| B: Preis 15                      | 2   | 0,65            | 0,56   | 0,48        | 57 %               | 2 %            | 71 %         | 50 %         | 48,8        |
| B: Preis 15                      | 3   | 0,68            | 0,58   | 0,48        | 53 %               | 2 %            | 78 %         | 44 %         | 43,2        |
| B: Preis 15                      | 4   | 0,71            | 0,59   | 0,49        | 52 %               | 0 %            | 83 %         | 43 %         | 36,0        |
| C: alle 4 fest aktiv             | 2   | 2,44            | 1,49   | 0,55        | 51 %               | 2 %            | 7 %          | 1 %          | 30,7        |
| C: alle 4 fest aktiv             | 3   | 3,24            | 1,50   | 0,46        | 56 %               | 2 %            | 11 %         | 0 %          | 26,1        |
| C: alle 4 fest aktiv             | 4   | 3,61            | 1,27   | 0,26        | 74 %               | 5 %            | 17 %         | 0 %          | 22,3        |
| D: 2 von 4 wandernd              | 2   | 1,10            | 0,94   | 0,77        | 37 %               | 1 %            | 52 %         | 22 %         | 42,6        |
| D: 2 von 4 wandernd              | 3   | 1,24            | 0,95   | 0,69        | 40 %               | 1 %            | 62 %         | 15 %         | 38,4        |
| D: 2 von 4 wandernd              | 4   | 1,28            | 0,93   | 0,64        | 41 %               | 1 %            | 69 %         | 13 %         | 33,2        |
| E: 6 Kand., 2 wandernd, Preis 15 | 2   | 1,60            | 1,25   | 0,91        | 32 %               | 0 %            | 38 %         | 11 %         | 40,8        |
| E: 6 Kand., 2 wandernd, Preis 15 | 3   | 2,01            | 1,29   | 0,70        | 45 %               | 1 %            | 47 %         | 7 %          | 35,1        |
| E: 6 Kand., 2 wandernd, Preis 15 | 4   | 2,10            | 1,22   | 0,59        | 49 %               | 1 %            | 56 %         | 7 %          | 30,2        |
| F: 6 Kand., 3 wandernd, Preis 20 | 2   | 1,96            | 1,36   | 0,77        | 39 %               | 1 %            | 22 %         | 2 %          | 33,5        |
| F: 6 Kand., 3 wandernd, Preis 20 | 3   | 2,27            | 1,28   | 0,53        | 53 %               | 2 %            | 35 %         | 2 %          | 30,3        |
| F: 6 Kand., 3 wandernd, Preis 20 | 4   | 2,50            | 1,18   | 0,37        | 66 %               | 2 %            | 42 %         | 2 %          | 25,6        |
| G: 6 Kand., 3 wandernd, Preis 15 | 2   | 2,28            | 1,64   | 1,00        | 28 %               | 1 %            | 22 %         | 1 %          | 35,9        |
| G: 6 Kand., 3 wandernd, Preis 15 | 3   | 2,83            | 1,65   | 0,76        | 37 %               | 1 %            | 30 %         | 1 %          | 31,4        |
| G: 6 Kand., 3 wandernd, Preis 15 | 4   | 3,02            | 1,46   | 0,51        | 55 %               | 2 %            | 38 %         | 1 %          | 26,8        |
| H: G + Würfel 2–7                | 2   | 2,75            | 1,94   | 1,13        | 22 %               | 1 %            | 15 %         | 0 %          | 31,4        |
| H: G + Würfel 2–7                | 3   | 3,43            | 1,77   | 0,60        | 49 %               | 2 %            | 20 %         | 1 %          | 27,6        |
| H: G + Würfel 2–7                | 4   | 3,63            | 1,64   | 0,57        | 47 %               | 1 %            | 28 %         | 0 %          | 23,9        |
| Z: neue Standardwerte            | 2   | 2,52            | 1,75   | 0,99        | 30 %               | 1 %            | 18 %         | 2 %          | 32,7        |
| Z: neue Standardwerte            | 3   | 2,90            | 1,66   | 0,79        | 38 %               | 1 %            | 28 %         | 1 %          | 30,2        |
| Z: neue Standardwerte            | 4   | 3,18            | 1,50   | 0,54        | 51 %               | 1 %            | 35 %         | 1 %          | 25,1        |

- **Startwerte (A) tragen den Trophäen-Sieg nicht:** 0,6–0,7 Trophäen je Partie, 44–50 % der Partien ganz ohne Trophäe, 71–83 % der Spieler ohne. Ursache: In 5 Runden läuft jeder nur ≈ 18 Felder, also eine halbe Brettrunde. Erreichbar sind nur s12 (nur über den Klippenweg) und s24. Die einzige aktive Trophäe steht oft außer Reichweite und springt nach einem Kauf meist wieder dorthin.
- Der Preis allein (B) ändert fast nichts, weil Münzen reichlich da sind (am Ende Ø 36–49). Engpass ist die Erreichbarkeit, nicht das Geld.
- C bringt viele Trophäen, aber bei 4 Spielern viele Gleichstände (Münzen entscheiden in 74 %) und keine wandernde Trophäe.
- G erfüllt die Zielwerte am besten mit nur einer neuen Stellschraube: 2,3–3,0 Trophäen, Sieger 1,46–1,65, 1 % Partien ohne, 22–38 % Spieler ohne. H ist noch etwas besser, ändert aber zusätzlich den Würfel.
- Mit Items (Z, siehe EXP-003): 2,5–3,2 Trophäen, 18–35 % ohne Trophäe, Münzen entscheiden in 30 % (2 Spieler) bis 51 % (4 Spieler). Bei vier Spielern teilen sich ≈ 3 Trophäen auf vier Leute (oft 1-1-1-0), daher die vielen Gleichstände. Mit 8 oder mehr Runden sinkt der Anteil (Rundenzahl-Tabelle in EXP-001).

**Entscheidung:** **keep Variante G** als neue Standardwerte: `trophy.activeCount` 1 → **3** (neue Stellschraube), `trophy.price` 20 → **15**, Wackelwald mit **6 Trophäen-Kandidaten** (s16 und s21 von Plus zu Trophäe). Startmünzen (10), Plus/Minus (3/3) und Minispiel-Belohnungen (10/5/3/0) bleiben, denn Münzen sind reichlich vorhanden (Ende Ø 25–33). Die Entscheidung hängt nicht an der Annahme, dass Bots die Trophäe ansteuern: Mit zufälliger Wegwahl ergeben sich 2,2–2,9 Trophäen (Robustheitstabelle unter EXP-003).

**Offen für Playtest:** Lesbarkeit von drei aktiven Trophäen, Preisgefühl, Münz-Gleichstand als Entscheidung, Reiz der Wegwahl.

**Für später (CHAOS-44):** Trophäe wandert bevorzugt vor die Spieler statt zufällig (weniger tote Trophäen in kurzen Partien). Ökonomie neu bewerten, wenn echte Minispiele (M3) die Belohnungen ändern. Würfel 2–7 (H).

---

## EXP-003: Item-Häufigkeit und Sabotage (2026-11-15, CHAOS-24)

**Hypothese / gewünschtes Spielerlebnis:** Sabotage kommt in jeder Partie vor und **überrascht, ohne dauerhaft zu bestrafen** (VISION, Produktsäule 1). Eigene Zielwerte für 5 Runden: mindestens 1 Item je Spieler und Partie, bei 4 Spielern ≈ 1,5–2,5 Sabotagen je Partie, Verlust je Treffer im Mittel ≤ 25 % des Bestands, die am meisten getroffene Person im Mittel höchstens etwa ein Treffer je Partie.

**Varianten** (alle mit der Ökonomie aus EXP-002 G):

- A: 4 Item-Felder, Fallen nur beim Landen, Klau 6/Falle 5 (Startwerte).
- B: 6 Item-Felder (s19 oben und s39 unten links von Plus zu Item, dann etwa alle sechs Felder eins).
- C: B, Falle löst auch beim Darüberlaufen aus.
- D: B mit 1 Start-Item je Spieler.
- E: C und D zusammen (Klau 6, Falle 5).
- F: E mit Klau 5, Falle 4.
- G: F mit Münzklau-Gewicht 4 statt 3.

**Objektive Messgrößen:** gezogene und eingesetzte Items je Spieler, Sabotagen je Partie (Münzklau-Versuche plus ausgelöste Fallen), gelegte und ausgelöste Fallen, Verlust je Treffer relativ zum Bestand davor (Mittel, p90), Münzen je Treffer, höchste Trefferzahl auf eine Person je Partie, Trophäen je Partie.

**Subjektive Playtest-Fragen (für Ruben):** Ist ein Start-Item verständlich („Warum habe ich schon was?“)? Versteht man am Fernseher, dass die Figur auf einer fremden Falle anhält und zahlt? Fühlt sich ein Klau von 5 Münzen witzig oder gemein an? Wird die führende Person zu oft beklaut?

**Testumgebung:** siehe „Gemeinsamer Aufbau“.

**Ergebnisse:**

**EXP-003 Items (5 Runden, Seeds 1–200 je Zeile)**

| Variante                             | Sp. | Items/Sp. | eingesetzt/Sp. | Sabotagen/Partie | Klau | Fallen gelegt | Fallen ausgelöst | Verlust/Bestand | p90  | Münzen/Treffer | max. Treffer auf einen | Trophäen |
| ------------------------------------ | --- | --------- | -------------- | ---------------- | ---- | ------------- | ---------------- | --------------- | ---- | -------------- | ---------------------- | -------- |
| A: 4 Item-Felder (Stand EXP-002)     | 2   | 0,45      | 0,25           | 0,18             | 0,18 | 0,15          | 0,01             | 18 %            | 30 % | 3,9            | 0,17                   | 2,28     |
| A: 4 Item-Felder (Stand EXP-002)     | 3   | 0,44      | 0,24           | 0,27             | 0,25 | 0,21          | 0,02             | 18 %            | 30 % | 4,4            | 0,23                   | 2,83     |
| A: 4 Item-Felder (Stand EXP-002)     | 4   | 0,47      | 0,24           | 0,36             | 0,34 | 0,27          | 0,03             | 18 %            | 31 % | 4,4            | 0,32                   | 3,02     |
| B: 6 Item-Felder                     | 2   | 0,74      | 0,37           | 0,27             | 0,27 | 0,23          | 0,01             | 21 %            | 30 % | 4,1            | 0,23                   | 2,31     |
| B: 6 Item-Felder                     | 3   | 0,72      | 0,38           | 0,40             | 0,38 | 0,35          | 0,03             | 18 %            | 29 % | 4,3            | 0,33                   | 2,83     |
| B: 6 Item-Felder                     | 4   | 0,75      | 0,35           | 0,48             | 0,43 | 0,41          | 0,05             | 19 %            | 35 % | 4,6            | 0,41                   | 3,02     |
| C: B + Falle beim Überqueren         | 2   | 0,74      | 0,37           | 0,28             | 0,27 | 0,23          | 0,01             | 21 %            | 30 % | 4,1            | 0,24                   | 2,31     |
| C: B + Falle beim Überqueren         | 3   | 0,72      | 0,38           | 0,48             | 0,38 | 0,35          | 0,10             | 18 %            | 30 % | 4,4            | 0,40                   | 2,82     |
| C: B + Falle beim Überqueren         | 4   | 0,75      | 0,35           | 0,61             | 0,43 | 0,41          | 0,17             | 20 %            | 36 % | 4,6            | 0,51                   | 3,02     |
| D: B + 1 Start-Item                  | 2   | 1,76      | 1,19           | 0,85             | 0,83 | 0,68          | 0,01             | 30 %            | 60 % | 4,2            | 0,60                   | 2,50     |
| D: B + 1 Start-Item                  | 3   | 1,71      | 1,15           | 1,21             | 1,13 | 1,03          | 0,08             | 27 %            | 46 % | 4,6            | 0,81                   | 2,92     |
| D: B + 1 Start-Item                  | 4   | 1,76      | 1,16           | 1,56             | 1,47 | 1,51          | 0,10             | 26 %            | 46 % | 4,5            | 0,93                   | 3,19     |
| E: C + 1 Start-Item (Klau 6/Falle 5) | 2   | 1,76      | 1,19           | 0,92             | 0,83 | 0,68          | 0,09             | 29 %            | 60 % | 4,2            | 0,65                   | 2,51     |
| E: C + 1 Start-Item (Klau 6/Falle 5) | 3   | 1,71      | 1,15           | 1,38             | 1,14 | 1,03          | 0,24             | 27 %            | 46 % | 4,6            | 0,90                   | 2,90     |
| E: C + 1 Start-Item (Klau 6/Falle 5) | 4   | 1,75      | 1,16           | 1,93             | 1,47 | 1,51          | 0,46             | 26 %            | 46 % | 4,6            | 1,13                   | 3,19     |
| F: E mit Klau 5/Falle 4              | 2   | 1,76      | 1,19           | 0,92             | 0,83 | 0,68          | 0,09             | 23 %            | 50 % | 3,3            | 0,65                   | 2,52     |
| F: E mit Klau 5/Falle 4              | 3   | 1,71      | 1,15           | 1,37             | 1,13 | 1,03          | 0,24             | 21 %            | 38 % | 3,6            | 0,91                   | 2,90     |
| F: E mit Klau 5/Falle 4              | 4   | 1,75      | 1,16           | 1,92             | 1,47 | 1,50          | 0,46             | 20 %            | 38 % | 3,6            | 1,15                   | 3,18     |
| G: F + Münzklau-Gewicht 4            | 2   | 1,78      | 1,23           | 1,10             | 1,02 | 0,59          | 0,08             | 22 %            | 50 % | 3,2            | 0,73                   | 2,48     |
| G: F + Münzklau-Gewicht 4            | 3   | 1,69      | 1,17           | 1,55             | 1,34 | 0,98          | 0,21             | 21 %            | 42 % | 3,6            | 1,02                   | 2,92     |
| G: F + Münzklau-Gewicht 4            | 4   | 1,74      | 1,18           | 2,21             | 1,78 | 1,44          | 0,42             | 20 %            | 38 % | 3,6            | 1,30                   | 3,23     |
| Z: neue Standardwerte                | 2   | 1,76      | 1,19           | 0,92             | 0,83 | 0,68          | 0,09             | 23 %            | 50 % | 3,3            | 0,65                   | 2,52     |
| Z: neue Standardwerte                | 3   | 1,71      | 1,15           | 1,37             | 1,13 | 1,03          | 0,24             | 21 %            | 38 % | 3,6            | 0,91                   | 2,90     |
| Z: neue Standardwerte                | 4   | 1,75      | 1,16           | 1,92             | 1,47 | 1,50          | 0,46             | 20 %            | 38 % | 3,6            | 1,15                   | 3,18     |

**Robustheit gegen Bot-Verhalten (5 Runden, Seeds 1–200 je Zeile)**

| Variante                         | Sp. | Trophäen/Partie | ohne Trophäe | Münzen entscheiden | Sabotagen/Partie | Verlust/Bestand | max. Treffer auf einen | Brett min |
| -------------------------------- | --- | --------------- | ------------ | ------------------ | ---------------- | --------------- | ---------------------- | --------- |
| A: Start, Bots wie immer         | 2   | 0,63            | 71 %         | 59 %               | 0,14             | 16 %            | 0,12                   | 1,3       |
| A: Start, Bots wie immer         | 3   | 0,66            | 78 %         | 53 %               | 0,28             | 17 %            | 0,26                   | 2,0       |
| A: Start, Bots wie immer         | 4   | 0,68            | 83 %         | 56 %               | 0,34             | 16 %            | 0,30                   | 2,6       |
| A0: Start, Wege zufällig         | 2   | 0,53            | 75 %         | 64 %               | 0,19             | 15 %            | 0,18                   | 1,3       |
| A0: Start, Wege zufällig         | 3   | 0,58            | 81 %         | 62 %               | 0,27             | 16 %            | 0,23                   | 2,0       |
| A0: Start, Wege zufällig         | 4   | 0,56            | 86 %         | 64 %               | 0,40             | 14 %            | 0,34                   | 2,6       |
| Z: neu, Bots wie immer           | 2   | 2,52            | 18 %         | 30 %               | 0,92             | 23 %            | 0,65                   | 1,6       |
| Z: neu, Bots wie immer           | 3   | 2,90            | 28 %         | 38 %               | 1,37             | 21 %            | 0,91                   | 2,3       |
| Z: neu, Bots wie immer           | 4   | 3,18            | 35 %         | 51 %               | 1,92             | 20 %            | 1,15                   | 3,0       |
| Z0: neu, Wege zufällig           | 2   | 2,20            | 23 %         | 28 %               | 0,94             | 23 %            | 0,67                   | 1,5       |
| Z0: neu, Wege zufällig           | 3   | 2,54            | 35 %         | 42 %               | 1,44             | 20 %            | 0,93                   | 2,3       |
| Z0: neu, Wege zufällig           | 4   | 2,94            | 39 %         | 54 %               | 1,85             | 20 %            | 1,09                   | 3,0       |
| Z8: neu, Items zu 80 % einsetzen | 2   | 2,56            | 18 %         | 30 %               | 1,01             | 25 %            | 0,73                   | 1,6       |
| Z8: neu, Items zu 80 % einsetzen | 3   | 2,94            | 28 %         | 40 %               | 1,53             | 22 %            | 0,95                   | 2,3       |
| Z8: neu, Items zu 80 % einsetzen | 4   | 3,27            | 33 %         | 53 %               | 2,09             | 22 %            | 1,19                   | 3,0       |
| ZR: neu, Klau-Ziel zufällig      | 2   | 2,48            | 18 %         | 26 %               | 0,94             | 24 %            | 0,68                   | 1,6       |
| ZR: neu, Klau-Ziel zufällig      | 3   | 2,81            | 29 %         | 44 %               | 1,35             | 24 %            | 0,89                   | 2,3       |
| ZR: neu, Klau-Ziel zufällig      | 4   | 3,31            | 33 %         | 51 %               | 1,88             | 28 %            | 1,19                   | 3,0       |

- **Mit den Startwerten (A) gibt es kaum Sabotage:** weniger als 0,5 Items je Spieler, 0,2–0,4 Sabotagen je Partie. Fallen lösen praktisch nie aus (0,01–0,03 je Partie), weil man exakt auf dem Feld landen muss und gelegte Fallen meist hinter allen anderen liegen.
- Mehr Item-Felder (B) bringen +60 % Items, aber immer noch weniger als 1 je Spieler. Das Start-Item (D) ist der wirksame Hebel: 1,7 Items je Spieler, dreimal so viele Sabotagen.
- Fallen beim Darüberlaufen (C/E) lösen drei- bis fünfmal so oft aus (4 Spieler mit Start-Item: 0,10 → 0,46 je Partie).
- Mit Klau 6/Falle 5 (E) kostet ein Treffer im Mittel 26–29 % des Bestands, p90 46–60 % (früh in der Partie mit wenigen Münzen). Mit Klau 5/Falle 4 (F) sind es 20–23 %, p90 38–50 %, im Mittel 3,3–3,6 Münzen, also knapp ein Viertel einer Trophäe. Die am meisten getroffene Person kassiert im Mittel 0,65 (2 Spieler) bis 1,15 (4 Spieler) Treffer je Partie.
- Ein höheres Münzklau-Gewicht (G) bringt mehr Klau, aber auch mehr Treffer auf dieselbe Person (1,3).
- Robust gegen Bot-Annahmen: Mit zufälliger Wegwahl, häufigerem Item-Einsatz (80 %) oder zufälligem Klau-Ziel bleiben Trophäen, Sabotagen und Verluste im selben Bereich. Das Ziel „reichste Person“ wirkt als Aufholhilfe: Bei zufälligem Ziel steigt der Verlust je Treffer auf 24–28 %.

**Entscheidung:** **keep Variante F** als neue Standardwerte: `items.startItems` 0 → **1** und `items.trapTrigger` `land` → **`pass`** (beides neue Stellschrauben), `stealAmount` 6 → **5**, `trapAmount` 5 → **4** (passend zum Trophäenpreis 15: ein Klau kostet etwa ein Drittel einer Trophäe statt 30 % wie vorher bei Preis 20). Wackelwald mit **6 Item-Felder** (s19, s39). Gewichte (3/3/3/2) und Kapazität (3) bleiben. Auswirkung auf den Host: Beim Darüberlaufen kommen die Ereignisse als `moved` (bis zur Falle), `trap-triggered`, `coins-changed` und nach `spaceEventMs` wieder `moved` (Rest). Start-Items kommen als `item-gained` direkt nach `game-started`. Protokoll und Host-Code sind unverändert, der Host spielt Ereignisse der Reihe nach ab. Die Darstellung sollte trotzdem einmal im Browser angeschaut werden.

**Offen für Playtest:** Start-Item und Falle beim Überqueren verständlich? Sabotage witzig statt frustrierend? Trifft es die führende Person zu oft?

**Für später (CHAOS-44):** Item als Bonus für den Minispiel-Sieg (M3). Schild auch gegen Fallen. Sichtbare oder versteckte Fallen als Variante.

---

## EXP-004: Reaktionsdauer des Münzklau-Fensters (2026-11-15, CHAOS-24)

**Hypothese / gewünschtes Spielerlebnis:** Das Reaktionsfenster ist ein kurzer, spannender Moment („Festhalten!“). Wer aufpasst, schafft es fast immer, wer abgelenkt ist, manchmal nicht. Die Partie wird nicht ausgebremst. Ziel: bei typischen Reaktionszeiten ≥ 90 % gelungene Reaktionen, Zeitkosten je Partie im Bereich weniger Sekunden.

**Annahme Reaktionszeiten (nicht gemessen, begründet):** Die angegriffene Person ist nicht am Zug und schaut meist auf den Fernseher. Bis zum Tippen braucht es diese Schritte: Angriff bemerken (Ansage am PC oder Wechsel am Handy, ≈ 300–600 ms), Blick zum Handy und scharf stellen (≈ 300–500 ms), Titel und zwei große Knöpfe erfassen (≈ 300–500 ms), tippen (≈ 200–300 ms). Eine reine Wahlreaktion dauert allein schon ≈ 400–600 ms. Safari auf iOS unterstützt `navigator.vibrate` nicht, ein haptischer Hinweis fällt also weg. Menschliche Reaktionszeiten sind rechtsschief, deshalb log-normal:

- fokussiert (Handy in der Hand): Median 1,1 s, σ 0,3, mindestens 0,5 s, p90 ≈ 1,6 s
- typisch: Median 1,5 s, σ 0,4, mindestens 0,6 s, p90 ≈ 2,5 s
- abgelenkt (redet, Handy im Schoß): Median 2,3 s, σ 0,45, mindestens 0,8 s, p90 ≈ 4,1 s
- zum Vergleich gleichverteilt 600–2500 ms (Vorgabe des Koordinators). Diese Verteilung hat eine harte Obergrenze, deshalb springt das Ergebnis zwischen 2000 und 2500 ms von 74 % auf 100 %.

**Varianten:** `reactionWindowMs` 2000, 2500, 3000 (Start), 3500 und 4000 ms. Jede Variante mit allen vier Profilen. Alle Angegriffenen versuchen zu reagieren (`reactionChance` 1), Regeln und Brett aus EXP-002/003.

**Objektive Messgrößen:** Reaktionsfenster je Partie, Anteil gelungener Reaktionen (Schild oder Festhalten), Anteil verspäteter Reaktionen, mittlere Zeit bis zur Auflösung, Zeit je Partie in Reaktionsfenstern samt Ergebnisanzeige.

**Subjektive Playtest-Fragen (für Ruben):** Bemerkt die angegriffene Person das Fenster rechtzeitig, obwohl sie auf den Fernseher schaut? Fühlen sich 3 s hektisch-witzig oder unfair an? Versteht man „Festhalten!“ ohne Erklärung?

**Testumgebung:** siehe „Gemeinsamer Aufbau“. Je Zeile Seeds 1–200 für jede Spielerzahl 2/3/4, also 600 Partien.

**Ergebnisse:**

**EXP-004 Reaktionsdauer (5 Runden, Seeds 1–200 je Zeile und Spielerzahl 2/3/4, Regeln aus EXP-002/003)**

| Fenster | Reaktionszeit             | Fenster/Partie | gelungen | zu spät | Ø bis Auflösung s | s/Partie |
| ------- | ------------------------- | -------------- | -------- | ------- | ----------------- | -------- |
| 2000 ms | gleichverteilt 600–2500   | 1,16           | 74 %     | 26 %    | 1,5               | 3,5      |
| 2000 ms | fokussiert (Median 1,1 s) | 1,11           | 99 %     | 1 %     | 1,2               | 3,0      |
| 2000 ms | typisch (Median 1,5 s)    | 1,11           | 74 %     | 26 %    | 1,5               | 3,3      |
| 2000 ms | abgelenkt (Median 2,3 s)  | 1,11           | 34 %     | 66 %    | 1,8               | 3,7      |
| 2500 ms | gleichverteilt 600–2500   | 1,16           | 100 %    | 0 %     | 1,6               | 3,5      |
| 2500 ms | fokussiert (Median 1,1 s) | 1,11           | 100 %    | 0 %     | 1,2               | 3,0      |
| 2500 ms | typisch (Median 1,5 s)    | 1,11           | 88 %     | 12 %    | 1,6               | 3,5      |
| 2500 ms | abgelenkt (Median 2,3 s)  | 1,11           | 54 %     | 46 %    | 2,1               | 4,0      |
| 3000 ms | gleichverteilt 600–2500   | 1,16           | 100 %    | 0 %     | 1,6               | 3,5      |
| 3000 ms | fokussiert (Median 1,1 s) | 1,11           | 100 %    | 0 %     | 1,2               | 3,0      |
| 3000 ms | typisch (Median 1,5 s)    | 1,11           | 97 %     | 3 %     | 1,6               | 3,5      |
| 3000 ms | abgelenkt (Median 2,3 s)  | 1,10           | 69 %     | 31 %    | 2,3               | 4,2      |
| 3500 ms | gleichverteilt 600–2500   | 1,16           | 100 %    | 0 %     | 1,6               | 3,5      |
| 3500 ms | fokussiert (Median 1,1 s) | 1,11           | 100 %    | 0 %     | 1,2               | 3,0      |
| 3500 ms | typisch (Median 1,5 s)    | 1,11           | 99 %     | 1 %     | 1,7               | 3,5      |
| 3500 ms | abgelenkt (Median 2,3 s)  | 1,11           | 79 %     | 21 %    | 2,4               | 4,4      |
| 4000 ms | gleichverteilt 600–2500   | 1,16           | 100 %    | 0 %     | 1,6               | 3,5      |
| 4000 ms | fokussiert (Median 1,1 s) | 1,11           | 100 %    | 0 %     | 1,2               | 3,0      |
| 4000 ms | typisch (Median 1,5 s)    | 1,11           | 100 %    | 0 %     | 1,7               | 3,5      |
| 4000 ms | abgelenkt (Median 2,3 s)  | 1,11           | 87 %     | 13 %    | 2,5               | 4,4      |

- Bei 3000 ms gelingen fokussiert 100 %, typisch 97 % und abgelenkt 69 % der Reaktionen. Mit 2000 ms schafft es auch typisch nur noch 74 %. Mit 4000 ms kommen abgelenkte Spieler auf 87 %.
- Die Zeitkosten sind in allen Varianten klein: ≈ 1,1 Fenster je Partie, zusammen 3–4,4 s je Partie (≈ 2 % der Brettzeit). Ein längeres Fenster kostet nur dann Zeit, wenn niemand reagiert (+0,5 s je 500 ms).
- Die Unsicherheit liegt in der Annahme über die Reaktionszeit, nicht im Fenster. Zwischen den Profilen liegen bei 3000 ms 31 Prozentpunkte, zwischen 3000 und 3500 ms bei „typisch“ nur 2.

**Entscheidung:** **keep 3000 ms.** Bei typischen Reaktionszeiten gelingen ≥ 95 %, die Zeitkosten sind vernachlässigbar, und der Druckmoment bleibt kurz. **iterate** nach dem Playtest: Liegt die gemessene Reaktionszeit im Median über ≈ 2 s, auf 3500 ms erhöhen.

**Nachtrag (2026-11-17, CHAOS-124):** Standard bleibt 3000 ms. Für langsamere Reaktionen gibt es die Lobby-Option „Mehr Zeit zum Reagieren“ mit **5000 ms** (Barrierefreiheit, keine Balance-Variante; ADR-015 Nachtrag 5). Begründung aus dem Modell oben, nur aus der Verteilung gerechnet und ohne neue Simulation: Für das Profil „abgelenkt“ (Median 2,3 s, σ 0,45) liegt der Anteil unter der Frist bei 3 s bei 72 % (Simulation: 69 %), bei 4 s bei 89 % und bei 5 s bei 96 %. Mit 5 s gelingt also auch einer deutlich langsameren Person fast jede Reaktion. Zeit kostet das nur, wenn niemand reagiert: höchstens +2 s je Fenster. Ob 5 s reichen, prüft die Gerätecheckliste §23 (RT1–RT4).

**Offen für Playtest:** Ob Menschen das Fenster bemerken, lässt sich nur am echten Gerät beurteilen. Dafür am besten die echten Reaktionszeiten mitschreiben (Vorschlag als Folgeaufgabe).

**Für später (CHAOS-44):** Kurzer Hinweiston am Controller beim Angriff (iOS kann nicht vibrieren). Längeres Fenster als Barrierefreiheits-Option.

---

## EXP-005: Arcade-Minispiel – Konzeptvergleich (2026-11-15, CHAOS-29, CHAOS-30)

**Hypothese / gewünschtes Spielerlebnis:** Das Arcade-Minispiel ist in Sekunden verstanden, verlangt Reflex, Timing oder Positionierung (kein Physik-Schubsen, das macht das Physik-Minispiel) und bleibt bis zum Schluss offen: Die Führung wechselt, Fehler sind witzig statt bitter, und auch schwächere Spieler gewinnen gelegentlich. Am Fernseher passiert ständig etwas, alle spielen gleichzeitig. Erwartung vorher: Ein Positionierungsspiel in einer gemeinsamen Arena erzeugt mehr Wechsel und mehr Chancen für Schwächere als reine Reaktions- oder Taktspiele, die nur die schnellsten Finger belohnen.

**Varianten** (drei eigene Konzepte, Figuren und Namen frei erfunden):

- **A „Sockenregen“ (Positionierung + Reflex):** Waschmaschine Wumms schleudert Socken und Bügeleisen in eine runde Arena, ein Schatten zeigt den Landepunkt. Socke fangen oder vom Boden aufsammeln = 1 Punkt, Goldsocke = 3. Bügeleisen plätten alle im roten Kreis (1,4 s bewegungsunfähig). Letzte 8 s „Schleudergang“: doppelt so viele Würfe. Erwartet: viel Gedränge und Wechsel; Stick braucht in kleinen iPad-Zonen Platz.
  - A1: nur Stick.
  - A2: + A = Hechtsprung (kurz 2,6× schneller, 1,6 s Abklingzeit). Mehr Ausdruck, ein Knopf mehr.
  - A3: A2 + Treffer kostet eine Socke, die daneben liegen bleibt und die jeder schnappen darf.
  - A4: A3 + gezielte Bügeleisen (50 % der Bügeleisen) fliegen bevorzugt auf die alleinige Führung („Wumms mag keine Angeber“). Sichtbarer Aufholmechanismus.
  - A5: A4 + die Hälfte der Goldsocken landet neben der/dem Letzten (unsichtbarer Gummiband-Effekt).
- **B „Kuckucks-Klatsche“ (Reflex):** Eine schiefe Kuckucksuhr öffnet ihr Türchen. Kuckuck → sofort A; Finte (Gummiente, Socke, Blume) oder zu früh → −1. B1: nur der Schnellste +1. B2: Schnellster +2, alle anderen im Zeitfenster +1. Erwartet: perfekt für iPad-Zonen, aber viel Warten und Sieg für die schnellsten Finger.
- **C „Aufzieh-Takt“ (Timing):** Ein Ring schrumpft auf Schraubis Aufziehschlüssel; A im richtigen Moment = 2 (genau) / 1 (knapp), 5 Treffer am Stück +1, Takt wird schneller. Erwartet: sehr leicht verständlich, aber jeder spielt für sich.

**Objektive Messgrößen:** Rundendauer, Punkte des Siegers, relativer Abstand Platz 1–2, Gleichstand auf Platz 1, Führungswechsel je Runde, „Comeback“ (Sieger führte nach 2/3 der Zeit nicht allein), Siegquote des stärksten und des schwächsten Bots (Gleichstand anteilig) gegen den fairen Anteil 1/n, Aktionen je Spieler und 10 s (Ziele wählen, Knöpfe), Eingabe-Komplexität, Eignung für kleine iPad-Zonen, Länge der Anleitung (≤ 3 Zeilen à 64 Zeichen).

**Subjektive Playtest-Fragen (für Ruben):** siehe „Offen für Playtest“.

**Testumgebung:** Node 22.23, Linux-Container, Basis-Commit `290a4d1`, Branch `worktree-agent-a376da6934423c3cc`; Ergebnisse vom Commit, der diesen Eintrag einführt. Seeds 1–300 je Zeile und Spielerzahl (2, 3, 4). Prototypen grob mit 1/30-s-Schritten, die Kontrollzeile A4* mit 1/60-s-Schritten auf der echten Spiellogik.

- **Wiederholen** (≈ 6 s): `EXPERIMENTS=1 pnpm exec vitest run packages/minigames/src/prototypes/arcade --silent=false`. Ohne `EXPERIMENTS=1` läuft nur ein Smoke-Test (Teil von `pnpm test`).
- **Code:** `packages/minigames/src/prototypes/arcade/` – `common.ts` (Bot-Profile, Kennzahlen), `sockenregen.ts`, `kuckuck.ts`, `aufziehtakt.ts` (Prototypen), `sockenregenBot.ts` (Bots für die echte Logik `packages/minigames/src/sockenregen/logic.ts`), `experiment.ts` (Tabellen).
- **Bots:** vier Profile mit angenommenen Couch-Werten (nicht gemessen): Profi (Reaktion 230 ms, Takt-Fehler σ 35 ms, Finte 6 %), Gut (310 ms, 55 ms, 12 %), Normal (400 ms, 80 ms, 20 %), Neuling (560 ms, 120 ms, 32 %); dazu Lenkrauschen, Gefahr-Bemerken (95–50 %), Zielwahl-Urteil (90–40 %), Aussetzer (2–12 %). Reaktionszeiten log-normal. Besetzung: 2 Sp. = Profi + Neuling, 3 Sp. = Profi + Normal + Neuling, 4 Sp. = alle. Zusätzlich „knappe Besetzungen“: Duell Gut gegen Normal und 4× Normal.
- **Rauschen:** Bei 300 Seeds liegt der Standardfehler einer Quote um 50 % bei ≈ 3 Prozentpunkten. Unterschiede von 1–4 Punkten zwischen A-Varianten sind Rauschen (A1 und A2 verschieben sich schon, wenn eine Variante eine Zufallszahl mehr zieht).

**Ergebnisse:**

**EXP-005 Arcade-Konzepte (Seeds 1–300 je Zeile)**

| Variante                               | Sp. | Dauer s | Punkte P1 | Abstand 1–2 | Gleichstand P1 | Führungswechsel | Comeback | Siege Profi | Siege Neuling | fair | Aktionen/10 s |
| -------------------------------------- | --- | ------- | --------- | ----------- | -------------- | --------------- | -------- | ----------- | ------------- | ---- | ------------- |
| A1: Sockenregen, nur Stick             | 2   | 30      | 30,8      | 32 %        | 3 %            | 1,6             | 13 %     | 90 %        | 10 %          | 50 % | 19,4          |
| A1: Sockenregen, nur Stick             | 3   | 30      | 24,1      | 26 %        | 5 %            | 2,1             | 23 %     | 82 %        | 3 %           | 33 % | 18,7          |
| A1: Sockenregen, nur Stick             | 4   | 30      | 19,8      | 22 %        | 9 %            | 2,6             | 31 %     | 63 %        | 2 %           | 25 % | 18,3          |
| A2: Sockenregen + Hechtsprung (A)      | 2   | 30      | 32,0      | 33 %        | 2 %            | 1,3             | 9 %      | 94 %        | 6 %           | 50 % | 22,4          |
| A2: Sockenregen + Hechtsprung (A)      | 3   | 30      | 24,8      | 26 %        | 5 %            | 2,2             | 19 %     | 79 %        | 2 %           | 33 % | 21,9          |
| A2: Sockenregen + Hechtsprung (A)      | 4   | 30      | 20,2      | 22 %        | 6 %            | 2,5             | 33 %     | 70 %        | 2 %           | 25 % | 21,4          |
| A3: A2 + Bügeleisen kostet 1 Socke     | 2   | 30      | 32,2      | 34 %        | 1 %            | 1,3             | 8 %      | 94 %        | 6 %           | 50 % | 22,5          |
| A3: A2 + Bügeleisen kostet 1 Socke     | 3   | 30      | 24,8      | 26 %        | 5 %            | 2,2             | 21 %     | 84 %        | 2 %           | 33 % | 22,1          |
| A3: A2 + Bügeleisen kostet 1 Socke     | 4   | 30      | 20,5      | 23 %        | 8 %            | 2,6             | 33 %     | 70 %        | 1 %           | 25 % | 21,7          |
| A4: A3 + Bügeleisen zielen auf Führung | 2   | 30      | 31,8      | 32 %        | 3 %            | 1,4             | 10 %     | 95 %        | 5 %           | 50 % | 22,6          |
| A4: A3 + Bügeleisen zielen auf Führung | 3   | 30      | 25,0      | 28 %        | 2 %            | 2,0             | 19 %     | 85 %        | 2 %           | 33 % | 22,1          |
| A4: A3 + Bügeleisen zielen auf Führung | 4   | 30      | 20,7      | 24 %        | 4 %            | 2,6             | 32 %     | 65 %        | 2 %           | 25 % | 21,8          |
| A5: A4 + halbe Goldsocken beim Letzten | 2   | 30      | 31,8      | 33 %        | 1 %            | 1,3             | 10 %     | 94 %        | 6 %           | 50 % | 22,5          |
| A5: A4 + halbe Goldsocken beim Letzten | 3   | 30      | 24,6      | 26 %        | 5 %            | 2,2             | 23 %     | 79 %        | 3 %           | 33 % | 22,1          |
| A5: A4 + halbe Goldsocken beim Letzten | 4   | 30      | 20,5      | 23 %        | 7 %            | 2,6             | 30 %     | 68 %        | 2 %           | 25 % | 21,5          |
| A4*: A4 auf der echten Spiellogik      | 2   | 30      | 32,2      | 36 %        | 1 %            | 1,3             | 8 %      | 95 %        | 5 %           | 50 % | 22,6          |
| A4*: A4 auf der echten Spiellogik      | 3   | 30      | 24,9      | 28 %        | 5 %            | 2,0             | 20 %     | 85 %        | 2 %           | 33 % | 22,0          |
| A4*: A4 auf der echten Spiellogik      | 4   | 30      | 20,5      | 24 %        | 7 %            | 2,6             | 32 %     | 70 %        | 3 %           | 25 % | 21,3          |
| B1: Kuckucks-Klatsche, Schnellster +1  | 2   | 30      | 4,8       | 98 %        | 0 %            | 0,0             | 0 %      | 100 %       | 0 %           | 50 % | 1,7           |
| B1: Kuckucks-Klatsche, Schnellster +1  | 3   | 30      | 4,5       | 91 %        | 1 %            | 0,1             | 5 %      | 99 %        | 0 %           | 33 % | 1,7           |
| B1: Kuckucks-Klatsche, Schnellster +1  | 4   | 30      | 3,7       | 67 %        | 9 %            | 0,3             | 13 %     | 89 %        | 0 %           | 25 % | 1,7           |
| B2: Kuckucks-Klatsche, 2 / Rest 1      | 2   | 30      | 9,7       | 62 %        | 0 %            | 0,1             | 1 %      | 100 %       | 0 %           | 50 % | 1,7           |
| B2: Kuckucks-Klatsche, 2 / Rest 1      | 3   | 30      | 9,4       | 48 %        | 1 %            | 0,2             | 6 %      | 99 %        | 0 %           | 33 % | 1,7           |
| B2: Kuckucks-Klatsche, 2 / Rest 1      | 4   | 30      | 8,7       | 32 %        | 10 %           | 0,3             | 13 %     | 88 %        | 0 %           | 25 % | 1,7           |
| C1: Aufzieh-Takt                       | 2   | 30      | 79,5      | 57 %        | 0 %            | 0,1             | 0 %      | 100 %       | 0 %           | 50 % | 12,7          |
| C1: Aufzieh-Takt                       | 3   | 30      | 79,4      | 35 %        | 0 %            | 0,3             | 0 %      | 100 %       | 0 %           | 33 % | 12,7          |
| C1: Aufzieh-Takt                       | 4   | 30      | 79,8      | 16 %        | 1 %            | 0,9             | 5 %      | 99 %        | 0 %           | 25 % | 12,8          |

**EXP-005 Knappe Besetzungen (Seeds 1–300)**

| Variante                               | Duell: Siege Normal | Duell: Gleichstand | Duell: Führungswechsel | 4× Normal: Abstand 1–2 | 4× Normal: Gleichstand P1 | 4× Normal: Führungswechsel | 4× Normal: Comeback |
| -------------------------------------- | ------------------- | ------------------ | ---------------------- | ---------------------- | ------------------------- | -------------------------- | ------------------- |
| A1: Sockenregen, nur Stick             | 33 %                | 5 %                | 2,2                    | 17 %                   | 12 %                      | 3,2                        | 40 %                |
| A2: Sockenregen + Hechtsprung (A)      | 32 %                | 5 %                | 2,2                    | 17 %                   | 13 %                      | 3,0                        | 42 %                |
| A3: A2 + Bügeleisen kostet 1 Socke     | 33 %                | 3 %                | 2,3                    | 17 %                   | 16 %                      | 3,2                        | 42 %                |
| A4: A3 + Bügeleisen zielen auf Führung | 33 %                | 4 %                | 2,2                    | 19 %                   | 8 %                       | 3,0                        | 42 %                |
| A5: A4 + halbe Goldsocken beim Letzten | 31 %                | 6 %                | 2,5                    | 18 %                   | 10 %                      | 3,1                        | 41 %                |
| A4*: A4 auf der echten Spiellogik      | 34 %                | 4 %                | 2,5                    | 17 %                   | 10 %                      | 3,0                        | 49 %                |
| B1: Kuckucks-Klatsche, Schnellster +1  | 15 %                | 7 %                | 0,3                    | 40 %                   | 32 %                      | 0,6                        | 35 %                |
| B2: Kuckucks-Klatsche, 2 / Rest 1      | 15 %                | 8 %                | 0,3                    | 17 %                   | 27 %                      | 0,6                        | 34 %                |
| C1: Aufzieh-Takt                       | 2 %                 | 1 %                | 1,0                    | 8 %                    | 9 %                       | 2,9                        | 38 %                |

**EXP-005 Bedienung und Verständlichkeit**

| Konzept              | Eingabe     | Interaktion                    | iPad-Zone                   | Anleitung | längste Zeile |
| -------------------- | ----------- | ------------------------------ | --------------------------- | --------- | ------------- |
| A: Sockenregen       | Stick (+ A) | hoch: gleiche Socken, Gedränge | mittel: Stick braucht Platz | 3 Zeilen  | 62 Zeichen    |
| B: Kuckucks-Klatsche | nur A       | mittel: Wettlauf um den Ersten | sehr gut: ein großer Knopf  | 2 Zeilen  | 53 Zeichen    |
| C: Aufzieh-Takt      | nur A       | kaum: jeder spielt für sich    | sehr gut: ein großer Knopf  | 2 Zeilen  | 58 Zeichen    |

- **Chancen für Schwächere:** Nur Sockenregen lässt den Schwächeren gewinnen. Im knappen Duell (Gut gegen Normal) gewinnt Normal in A 31–34 %, in B 15 %, in C 2 %. Gegen den Profi gewinnt der Neuling in A noch 5–10 % (2 Sp.), in B und C nie. B und C sind reine Fingerrennen: Wer schneller reagiert oder genauer drückt, gewinnt fast immer.
- **Spannung:** A hat 1,3–2,6 Führungswechsel je Runde (4× Normal: 3,0), B 0–0,6, C 0,1–0,9 (bei gleich starken 2,9, weil alle eng beieinander liegen). Comeback-Quote A 8–33 % je nach Besetzung, bei gleich Starken 40–49 %.
- **Beschäftigung:** A ≈ 22 Aktionen je Spieler und 10 s, C ≈ 13 (alle 0,8 s ein Druck), B nur 1,7: Bei der Kuckucks-Klatsche wartet man 90 % der Zeit.
- **Gleichstand:** A 1–9 %, B bis 32 % (4× Normal, B1) – zu viele geteilte Plätze bei wenigen Punkten.
- **Hechtsprung (A2):** misst sich kaum in Siegquoten, bringt aber +15 % Aktionen und eine Ausweich-/Rettungsmöglichkeit; macht aus „nur laufen“ eine Entscheidung (wann?).
- **Aufholhelfer (A3–A5):** keine messbare Wirkung auf die Siegquoten (innerhalb des Rauschens). A4 senkt den Gleichstand bei 4 Spielern leicht (4 % statt 6–8 %), ebenfalls nahe am Rauschen. Der Abstand zwischen Profi und Neuling ist größer, als ein Spielelement ausgleichen kann, ohne unfair zu werden.
- **A4\* (echte Spiellogik)** liegt in allen Kennzahlen innerhalb des Rauschens von A4: Die umgesetzte Logik entspricht dem Prototyp.
- **Verständlichkeit:** Alle Anleitungen passen in 2–3 Zeilen (≤ 62 Zeichen). B und C brauchen nur A und eignen sich am besten für kleine iPad-Zonen; A braucht Stick + A (gleiches Layout wie überall, aber der Stick braucht in der 4er-Zone Platz).

**Entscheidung:** **keep A4 „Sockenregen“** (ID `sockenregen`, 30 s, Stick = Laufen, A = Hechtsprung): klar die meisten Führungswechsel und als einziges Konzept echte Chancen für Schwächere, dazu ständig Bewegung am Fernseher und Interaktion um dieselben Socken, ohne Physik-Schubsen. Hechtsprung (A2) bleibt wegen des Ausdrucks und der Rettungsmomente. „Treffer kostet eine Socke“ (A3) bleibt als sichtbares Chaos (die Socke fliegt heraus, alle rennen hin) ohne harte Strafe (nie unter 0). „Bügeleisen zielen auf die Führung“ (A4) bleibt als sichtbarer, erklärbarer Aufholmechanismus, obwohl er sich in Siegquoten nicht messen lässt; ob er sich gut oder gemein anfühlt, klärt der Playtest. **discard A5** (unsichtbares Gummiband ohne messbare Wirkung). **discard B** (Wartezeit, Gleichstände, Sieg der schnellsten Finger) und **C** (keine Interaktion, Schwächere chancenlos) als M3-Arcade-Spiel; B bleibt ein Kandidat für ein kurzes Zwischenspiel (siehe unten).

**Umsetzung:** `packages/minigames/src/sockenregen/` (`logic.ts` rein, `index.ts` Babylon-Ansicht, `highlights.ts`, Tests). Belegbilder: `docs/screenshots/m3-minispiel-sockenregen.png` (mitten im Spiel, 4 Spieler, Blau gerade geplättet, Bügeleisen im Anflug) und `docs/screenshots/m3-minispiel-sockenregen-ende.png` (Ende, Sieger hüpft).

**Offen für Playtest:**

- Erkennt man auf dem Fernseher sofort Socke (weißer Ring) gegen Bügeleisen (roter Kreis), auch bei vier Spielern und im Schleudergang?
- Fühlt sich „Bügeleisen zielen auf die Führung“ witzig („Wumms mag keine Angeber“) oder gemein an? Merkt man es überhaupt?
- Ist „geplättet“ (1,4 s still, eine Socke weg) die richtige Härte?
- Wird der Hechtsprung genutzt und verstanden, oder reicht der Stick?
- Ist der Stick in der 4er-iPad-Zone präzise genug für 0,8 m Fangradius? (Simulation kann Touch-Präzision nicht beurteilen.)
- 30 s: zu kurz, genau richtig, zu lang? Ist der Schleudergang als Finale spürbar?
- Die Bot-Profile sind Annahmen; echte Reaktionszeiten am Gerät könnten die Abstände verschieben.

**Für später (CHAOS-44):** B „Kuckucks-Klatsche“ als kurzes Reaktions-Zwischenspiel (nur A, ideal für iPad-Zonen; mit 2/1-Wertung und weniger Finten). C „Aufzieh-Takt“ als Solo-Übung im Controller-Wartebildschirm.

---

## EXP-006: Physik-Minispiel – Konzeptvergleich mit Havok (2026-11-15, CHAOS-29, CHAOS-31)

**Hypothese / gewünschtes Spielerlebnis:** Ein Physik-Minispiel macht Spaß, wenn die Umgebung selbst Chaos stiftet und die Spieler sich gegenseitig schubsen. Es soll trotzdem lesbar und fair bleiben: ein klares Ziel am Fernseher, niemand sitzt lange daneben, ein Comeback ist möglich. Bedienung nur mit Joystick und einem Knopf, damit es auch in einer iPad-Zone geht. Die Erwartung vorher war, dass ein reines Runterschubsen („Letzter oben“) am witzigsten, aber am unfairsten ist und Ausgeschiedene langweilt.

**Varianten:** Alle Varianten sind eigene Ideen. Figuren sind Havok-Kapseln (1,5 × 0,45 m, gesperrte Drehung) mit Lenkung, Rempler auf A (Stoß 9 m/s, Abklingzeit 1 s) und einem Extra-Schubs beim Treffer.

- **A „Wackelpudding – Letzter oben“:** Ein runder Wackelpudding (r = 6 m, ANIMATED-Körper) kippt zum Gewicht der Figuren und schwabbelt von selbst. Ein Rührlöffel kreist. Wer fällt, ist raus. Punkte = überlebte Sekunden. Erwartet: viel Spannung, aber Zuschauerzeit und viele Gleichstände.
- **A2 „Plumps-Comeback“:** wie A, aber Gefallene plumpsen nach 1,5 s von oben zurück. Wertung entweder _Saldo_ (Schubser − Stürze) oder _Stürze_ (wer am seltensten fällt). Erwartet: keine Zuschauer, aber kleine Punktzahlen und damit Gleichstände.
- **A2 ohne Besen:** wie A2 Saldo, ohne Rührlöffel. Prüft, wie viel der Löffel beiträgt.
- **A3 „Wackel-Wahnsinn“:** A/A2 nach Runde 1 mit mehr Chaos: rutschiger (Reibung 0,12 statt 0,35), stärkere Neigung (max. 0,3 rad), mehr Schwabbeln, schnellerer und höherer Löffel, kräftigere Rempler (×1,3).
- **A4 „Kirschfleck“:** A3 plus ein Kirschfleck (r = 1,4 m), der alle 6 s weiterhüpft. Punkte gibt es pro Sekunde auf dem Fleck (4 je s). Weil sich alle am Fleck drängen, kippt der Pudding genau dorthin. _A4b:_ Fleck größer (1,7 m) und schneller (alle 4 s). _A4c:_ wie A4b, aber die Punkte werden unter allen auf dem Fleck geteilt.
- **A5 „Kirschfleck + Wackelkrone“:** A4b plus Wackelkrone: Rempler gegen die alleinige Führung wirken 1,5-mal so stark, und die Bots jagen bevorzugt die Führung.
- **B „Krümel-Kehraus“:** Runder Tisch mit Rand und einer Lücke je Spieler (Tor in Slot-Farbe). Zehn Kekskrümel (Havok-Kugeln) schiebt man durch die eigene Lücke. Ein schweres Wollknäuel wird alle 5 s quer über den Tisch gekickt. Wer selbst durch eine Lücke fällt, ist 1 s weg. Erwartet: viele Körper, viel Physik, aber unübersichtlich.
- **Z „Pudding-Gerangel“:** die Umsetzung von A5 als echtes Minispiel. Gleiche Bots, eigene Logik, Optik und Löffel-Zuordnung. Die Zeile prüft, ob die Umsetzung den Prototyp trifft.

**Objektive Messgrößen:**

- Rundendauer.
- Punktabstand (Erster − Letzter).
- Gleichstand auf Platz 1.
- Chancen der schwächsten Person: Siegquote und Ø-Platz des schwachen Bots im Vergleich zum fairen Anteil 1/n.
- Stürze, Schubser (Sturz ≤ 4 s nach einem Rempler) und Löffel-Stürze je Runde.
- Zuschauer-Anteil (Zeit als Ausgeschiedener).
- Physik-Stabilität, gezählt bei jedem Schritt:
  - NaN in Position oder Geschwindigkeit,
  - eine Figur unter der Untergrenze, die nicht als „raus“ gilt,
  - eine Kapselmitte unter der Spielfläche, obwohl die Figur über der Fläche steht (Tunneln),
  - aktive Körper nach `dispose()`.
- Höchste Geschwindigkeit.
- Rechenzeit je fester Schritt (Logik + Havok + Bot, Mittel und p99).
- Bedienung (Knöpfe) und Anleitungslänge.

**Subjektive Playtest-Fragen (für Ruben):** siehe „Offen für Playtest“.

**Testumgebung:**

- Node 22.23, Linux-Container, Havok 1.3 (WASM) über `runMinigameHeadless`, NullEngine, fester Schritt 1/60 s.
- Branch `worktree-agent-a84e8eeaaeff11961`, Basis-Commit `290a4d1`; Ergebnisse vom Commit, der diesen Eintrag einführt.
- Seeds 1–40 je Variante und Spielerzahl (2, 3, 4), also 120 Runden je Variante. Runden von 30 s.
- **Bots:** Je Runde ist ein Bot schwach, und welcher, wechselt reihum mit dem Seed (keine Slot-Verzerrung). Die anderen sind normal.
  - _normal:_ entscheidet alle 10 Schritte, Zielstreuung 0,25 rad, nutzt 60 % der Rempler-Gelegenheiten, weicht dem Löffel aus.
  - _schwach:_ alle 24 Schritte, Streuung 0,6 rad, 30 % der Rempler, sieht den Löffel nicht.
  - _etwas schwächer_ (Empfindlichkeit): alle 14 Schritte, Streuung 0,35 rad, 45 % der Rempler.
- Die Bots in A/A2/A3 bleiben in der Mitte, wenn Rand, Gefälle oder Löffel drohen, und jagen sonst die nächste Figur. In A4/A5/Z laufen sie zum Fleck und rempeln dort Rivalen, die Führung zuerst. In B wählen sie den Krümel mit dem besten Weg-und-Tor-Abstand, stellen sich dahinter und schieben.
- **Wiederholen** (≈ 6 min):

  ```sh
  EXPERIMENTS=1 pnpm exec vitest run packages/minigames/src/prototypes/physics --silent=false
  ```

  `EXP_FILTER=<Teil des Namens>` beschränkt auf einzelne Varianten. Ohne `EXPERIMENTS=1` läuft nur ein Smoke-Test: je Variante ein 6-s-Lauf mit 4 Bots, Stabilität und Aufräumen, Teil von `pnpm test`.

- **Code:** Prototypen in `packages/minigames/src/prototypes/physics/` (`wackel.ts`, `kruemel.ts`, `shared.ts`, `experiments.test.ts`), Umsetzung in `packages/minigames/src/pudding-gerangel/`.
- **Rechenzeit:** Zeit zwischen zwei Skriptaufrufen, also Logik + Havok-Schritt + Bot + Messung, in Node ohne Rendern. Die p99-Werte sind verrauscht, weil parallel Browser-Screenshots und andere Tests liefen. Einzelne Ausreißer (bis 41 ms) sind GC und JIT beim Aufwärmen. Die Mittelwerte sind belastbar.

**Ergebnisse:**

**EXP-006 Physik-Prototypen (30 s, Seeds 1–40 je Zeile)**

| Variante                        | Sp. | Dauer s | Abstand | Gleichst. Pl. 1 | Schwach Pl. 1 | Schwach Ø Platz | fair | Stürze | Schubser | Krümel | Zuschauer-Anteil | Löffel-Stürze | instabil | max m/s | ms/Schritt | ms p99 |
| ------------------------------- | --- | ------- | ------- | --------------- | ------------- | --------------- | ---- | ------ | -------- | ------ | ---------------- | ------------- | -------- | ------- | ---------- | ------ |
| A: Letzter oben                 | 2   | 19,3    | 0,7     | 30 %            | 57 %          | 1,4             | 50 % | 0,0    | 0,0      | 0,0    | 0,0              | 0,0           | 0        | 14,0    | 0,047      | 2,85   |
| A: Letzter oben                 | 3   | 20,4    | 9,1     | 38 %            | 35 %          | 2,0             | 33 % | 0,9    | 0,8      | 0,0    | 0,1              | 0,0           | 0        | 16,2    | 0,103      | 6,50   |
| A: Letzter oben                 | 4   | 24,9    | 10,2    | 63 %            | 43 %          | 2,2             | 25 % | 1,5    | 1,4      | 0,0    | 0,1              | 0,0           | 0        | 14,2    | 0,046      | 1,14   |
| A2: Comeback, Saldo             | 2   | 30,0    | 1,2     | 45 %            | 70 %          | 1,3             | 50 % | 1,4    | 1,2      | 0,0    | 0,0              | 0,0           | 0        | 14,0    | 0,027      | 0,15   |
| A2: Comeback, Saldo             | 3   | 30,0    | 2,0     | 28 %            | 45 %          | 1,9             | 33 % | 2,9    | 2,7      | 0,0    | 0,0              | 0,0           | 0        | 16,4    | 0,047      | 1,18   |
| A2: Comeback, Saldo             | 4   | 30,0    | 2,0     | 35 %            | 30 %          | 2,2             | 25 % | 2,6    | 2,4      | 0,0    | 0,0              | 0,0           | 0        | 16,6    | 0,062      | 0,76   |
| A2: Comeback, Stürze            | 2   | 30,0    | 0,6     | 53 %            | 70 %          | 1,3             | 50 % | 1,4    | 1,2      | 0,0    | 0,0              | 0,0           | 0        | 14,0    | 0,042      | 0,23   |
| A2: Comeback, Stürze            | 3   | 30,0    | 1,0     | 53 %            | 45 %          | 1,9             | 33 % | 2,9    | 2,7      | 0,0    | 0,0              | 0,0           | 0        | 16,4    | 0,069      | 4,19   |
| A2: Comeback, Stürze            | 4   | 30,0    | 1,1     | 78 %            | 48 %          | 2,2             | 25 % | 2,6    | 2,4      | 0,0    | 0,0              | 0,0           | 0        | 16,6    | 0,055      | 1,58   |
| A2 ohne Besen, Saldo            | 2   | 30,0    | 1,9     | 33 %            | 40 %          | 1,6             | 50 % | 1,4    | 1,2      | 0,0    | 0,0              | 0,0           | 0        | 14,1    | 0,038      | 0,17   |
| A2 ohne Besen, Saldo            | 3   | 30,0    | 2,4     | 25 %            | 30 %          | 2,0             | 33 % | 2,9    | 2,6      | 0,0    | 0,0              | 0,0           | 0        | 16,1    | 0,041      | 0,27   |
| A2 ohne Besen, Saldo            | 4   | 30,0    | 2,2     | 48 %            | 33 %          | 2,4             | 25 % | 2,6    | 2,5      | 0,0    | 0,0              | 0,0           | 0        | 15,8    | 0,039      | 1,39   |
| A3: Wackel-Wahnsinn, Saldo      | 2   | 30,0    | 1,6     | 18 %            | 55 %          | 1,5             | 50 % | 4,0    | 2,4      | 0,0    | 0,0              | 0,0           | 0        | 17,3    | 0,038      | 0,21   |
| A3: Wackel-Wahnsinn, Saldo      | 3   | 30,0    | 2,7     | 18 %            | 25 %          | 2,0             | 33 % | 5,3    | 3,8      | 0,0    | 0,0              | 0,0           | 0        | 21,3    | 0,042      | 0,26   |
| A3: Wackel-Wahnsinn, Saldo      | 4   | 30,0    | 2,9     | 35 %            | 23 %          | 2,7             | 25 % | 6,6    | 4,6      | 0,0    | 0,0              | 0,0           | 0        | 17,7    | 0,059      | 0,52   |
| A3: Wackel-Wahnsinn, Stürze     | 2   | 30,0    | 0,8     | 40 %            | 63 %          | 1,4             | 50 % | 4,0    | 2,4      | 0,0    | 0,0              | 0,0           | 0        | 17,3    | 0,042      | 1,84   |
| A3: Wackel-Wahnsinn, Stürze     | 3   | 30,0    | 1,6     | 45 %            | 33 %          | 2,0             | 33 % | 5,3    | 3,8      | 0,0    | 0,0              | 0,0           | 0        | 21,3    | 0,046      | 0,61   |
| A3: Wackel-Wahnsinn, Stürze     | 4   | 30,0    | 2,0     | 43 %            | 23 %          | 2,7             | 25 % | 6,6    | 4,6      | 0,0    | 0,0              | 0,0           | 0        | 17,7    | 0,048      | 0,37   |
| A4: Kirschfleck                 | 2   | 30,0    | 34,1    | 0 %             | 3 %           | 2,0             | 50 % | 2,4    | 1,5      | 0,0    | 0,0              | 0,0           | 0        | 16,5    | 0,038      | 0,88   |
| A4: Kirschfleck                 | 3   | 30,0    | 23,0    | 13 %            | 3 %           | 2,9             | 33 % | 3,3    | 2,5      | 0,0    | 0,0              | 0,0           | 0        | 18,0    | 0,040      | 0,48   |
| A4: Kirschfleck                 | 4   | 30,0    | 18,9    | 3 %             | 5 %           | 3,6             | 25 % | 5,8    | 4,8      | 0,0    | 0,0              | 0,0           | 0        | 20,5    | 0,047      | 0,49   |
| A4b: Kirschfleck flink+groß     | 2   | 30,0    | 29,6    | 0 %             | 3 %           | 2,0             | 50 % | 1,8    | 1,2      | 0,0    | 0,0              | 0,0           | 0        | 17,2    | 0,031      | 0,13   |
| A4b: Kirschfleck flink+groß     | 3   | 30,0    | 23,1    | 10 %            | 0 %           | 2,9             | 33 % | 3,6    | 2,8      | 0,0    | 0,0              | 0,0           | 0        | 21,1    | 0,030      | 0,11   |
| A4b: Kirschfleck flink+groß     | 4   | 30,0    | 22,3    | 3 %             | 0 %           | 3,7             | 25 % | 5,9    | 4,6      | 0,0    | 0,0              | 0,0           | 0        | 22,0    | 0,042      | 0,33   |
| A4c: Kirschfleck geteilt        | 2   | 30,0    | 29,5    | 0 %             | 3 %           | 2,0             | 50 % | 1,8    | 1,2      | 0,0    | 0,0              | 0,0           | 0        | 17,2    | 0,045      | 1,02   |
| A4c: Kirschfleck geteilt        | 3   | 30,0    | 17,8    | 13 %            | 0 %           | 2,8             | 33 % | 3,5    | 2,7      | 0,0    | 0,0              | 0,0           | 0        | 21,1    | 0,057      | 2,39   |
| A4c: Kirschfleck geteilt        | 4   | 30,0    | 14,1    | 13 %            | 3 %           | 3,6             | 25 % | 5,8    | 4,9      | 0,0    | 0,0              | 0,0           | 0        | 22,0    | 0,072      | 0,64   |
| A5: Kirschfleck + Wackelkrone   | 2   | 30,0    | 22,2    | 0 %             | 5 %           | 2,0             | 50 % | 2,7    | 1,9      | 0,0    | 0,0              | 0,0           | 0        | 17,2    | 0,041      | 0,15   |
| A5: Kirschfleck + Wackelkrone   | 3   | 30,0    | 18,5    | 0 %             | 0 %           | 2,7             | 33 % | 4,8    | 3,7      | 0,0    | 0,0              | 0,0           | 0        | 23,6    | 0,042      | 0,21   |
| A5: Kirschfleck + Wackelkrone   | 4   | 30,0    | 17,7    | 10 %            | 3 %           | 3,6             | 25 % | 7,9    | 6,7      | 0,0    | 0,0              | 0,0           | 0        | 27,7    | 0,046      | 0,47   |
| A4: Kirschfleck ohne Besen      | 2   | 30,0    | 30,0    | 0 %             | 3 %           | 2,0             | 50 % | 1,6    | 1,3      | 0,0    | 0,0              | 0,0           | 0        | 16,2    | 0,028      | 0,13   |
| A4: Kirschfleck ohne Besen      | 3   | 30,0    | 20,9    | 10 %            | 0 %           | 2,9             | 33 % | 3,5    | 3,3      | 0,0    | 0,0              | 0,0           | 0        | 18,1    | 0,033      | 0,22   |
| A4: Kirschfleck ohne Besen      | 4   | 30,0    | 18,8    | 5 %             | 8 %           | 3,4             | 25 % | 5,9    | 5,6      | 0,0    | 0,0              | 0,0           | 0        | 19,8    | 0,040      | 0,23   |
| A3: Wackel-Wahnsinn, Letzter    | 2   | 10,0    | 1,0     | 0 %             | 65 %          | 1,4             | 50 % | 0,0    | 0,0      | 0,0    | 0,0              | 0,0           | 0        | 15,7    | 0,053      | 4,89   |
| A3: Wackel-Wahnsinn, Letzter    | 3   | 16,8    | 8,7     | 18 %            | 33 %          | 1,9             | 33 % | 1,0    | 0,7      | 0,0    | 0,1              | 0,0           | 0        | 17,9    | 0,096      | 40,85  |
| A3: Wackel-Wahnsinn, Letzter    | 4   | 20,8    | 14,1    | 35 %            | 15 %          | 2,8             | 25 % | 2,0    | 1,8      | 0,0    | 0,2              | 0,0           | 0        | 16,5    | 0,081      | 4,16   |
| Z: Pudding-Gerangel (Umsetzung) | 2   | 30,0    | 24,4    | 0 %             | 5 %           | 2,0             | 50 % | 2,3    | 1,6      | 0,0    | 0,0              | 0,6           | 0        | 20,1    | 0,066      | 4,26   |
| Z: Pudding-Gerangel (Umsetzung) | 3   | 30,0    | 16,1    | 5 %             | 3 %           | 2,8             | 33 % | 4,8    | 3,9      | 0,0    | 0,0              | 0,8           | 0        | 21,9    | 0,103      | 12,81  |
| Z: Pudding-Gerangel (Umsetzung) | 4   | 30,0    | 14,2    | 10 %            | 8 %           | 3,4             | 25 % | 7,6    | 6,3      | 0,0    | 0,0              | 0,9           | 0        | 20,0    | 0,073      | 2,55   |
| B: Krümel-Kehraus               | 2   | 30,0    | 1,2     | 28 %            | 53 %          | 1,5             | 50 % | 6,8    | 0,0      | 9,1    | 0,0              | 0,0           | 0        | 14,2    | 0,091      | 3,54   |
| B: Krümel-Kehraus               | 3   | 30,0    | 2,7     | 30 %            | 23 %          | 2,3             | 33 % | 9,1    | 0,0      | 12,7   | 0,0              | 0,0           | 0        | 14,3    | 0,089      | 4,24   |
| B: Krümel-Kehraus               | 4   | 30,0    | 2,8     | 33 %            | 18 %          | 2,9             | 25 % | 16,2   | 0,0      | 20,0   | 0,0              | 0,0           | 0        | 14,4    | 0,076      | 3,79   |

**EXP-006 Empfindlichkeit: etwas schwächerer Bot (Seeds 1–40 je Zeile)**

| Variante                        | Sp. | Dauer s | Abstand | Gleichst. Pl. 1 | Schwach Pl. 1 | Schwach Ø Platz | fair | instabil | max m/s | ms/Schritt | ms p99 |
| ------------------------------- | --- | ------- | ------- | --------------- | ------------- | --------------- | ---- | -------- | ------- | ---------- | ------ |
| A3: Wackel-Wahnsinn, Saldo      | 2   | 30,0    | 1,4     | 18 %            | 70 %          | 1,3             | 50 % | 0        | 17,1    | 0,027      | 0,13   |
| A3: Wackel-Wahnsinn, Saldo      | 3   | 30,0    | 2,8     | 23 %            | 40 %          | 1,8             | 33 % | 0        | 16,7    | 0,039      | 0,17   |
| A3: Wackel-Wahnsinn, Saldo      | 4   | 30,0    | 3,1     | 30 %            | 45 %          | 2,3             | 25 % | 0        | 18,2    | 0,054      | 0,33   |
| A5: Kirschfleck + Wackelkrone   | 2   | 30,0    | 16,7    | 5 %             | 20 %          | 1,8             | 50 % | 0        | 18,8    | 0,036      | 0,14   |
| A5: Kirschfleck + Wackelkrone   | 3   | 30,0    | 14,3    | 13 %            | 15 %          | 2,4             | 33 % | 0        | 22,2    | 0,038      | 0,29   |
| A5: Kirschfleck + Wackelkrone   | 4   | 30,0    | 13,7    | 15 %            | 8 %           | 3,2             | 25 % | 0        | 21,5    | 0,049      | 0,25   |
| Z: Pudding-Gerangel (Umsetzung) | 2   | 30,0    | 16,8    | 0 %             | 8 %           | 1,9             | 50 % | 0        | 17,0    | 0,037      | 0,20   |
| Z: Pudding-Gerangel (Umsetzung) | 3   | 30,0    | 14,2    | 8 %             | 18 %          | 2,3             | 33 % | 0        | 21,9    | 0,078      | 16,62  |
| Z: Pudding-Gerangel (Umsetzung) | 4   | 30,0    | 13,6    | 10 %            | 8 %           | 3,2             | 25 % | 0        | 21,9    | 0,067      | 2,78   |
| B: Krümel-Kehraus               | 2   | 30,0    | 1,5     | 15 %            | 45 %          | 1,6             | 50 % | 0        | 14,1    | 0,052      | 0,72   |
| B: Krümel-Kehraus               | 3   | 30,0    | 2,5     | 33 %            | 40 %          | 1,9             | 33 % | 0        | 14,0    | 0,076      | 2,61   |
| B: Krümel-Kehraus               | 4   | 30,0    | 2,5     | 38 %            | 40 %          | 2,1             | 25 % | 0        | 16,0    | 0,076      | 3,61   |

Spalten: _Abstand_ = Ø Punkte Erster − Letzter (in der Einheit der Variante). _Gleichst. Pl. 1_ = Anteil der Runden mit geteiltem ersten Platz. _Schwach Pl. 1_ = Siegquote des schwachen Bots (geteilte Siege zählen). _fair_ = 1/n. _Stürze_, _Schubser_ und _Löffel-Stürze_ sind Summen je Runde über alle Spieler. _instabil_ = Summe aus NaN, verlorenen Körpern, Tunnel-Schritten und Resten nach `dispose()` über alle 120 Runden.

**Beobachtungen:**

- **Stabilität:** in allen 2 160 simulierten Runden (14 Varianten + 4 Empfindlichkeitsläufe à 120) ohne Befund. Keine NaN, kein unbemerktes Durchfallen, kein Tunneln, alle Körper nach `dispose()` weg. Die Höchstgeschwindigkeit liegt bei 14–28 m/s (harte Grenze 22 m/s vor dem Schritt; ein Rempler im selben Schritt kann kurz darüber liegen). Rechenzeit im Mittel 0,03–0,1 ms je Schritt mit bis zu 4 Figuren und 13 Körpern. Das sind < 1 % des 60-fps-Budgets (16,7 ms), viel Luft fürs Rendern.
- **A „Letzter oben“:** zu kurz und zu zufällig. Mit 2 Spielern ist die Runde nach Ø 19 s vorbei, in A3 sogar nach 10 s. Bei 4 Spielern sind 63 % der Siege geteilt. Ausgeschiedene schauen 10–20 % der Zeit zu. → discard.
- **A2/A3 mit Saldo- oder Stürze-Wertung:** keine Zuschauer, aber kleine Zahlen (Abstand 1–3 Punkte), daher 18–78 % geteilte Siege. Der schwache Bot gewinnt so oft wie oder öfter als die normalen (bis 70 % bei 2 Spielern). Können zählt kaum, die Runde ist eine Lotterie. Das Chaos-Tuning (A3) hat die Stürze verdoppelt (4–6,6 je Runde) und den Pudding sichtbar lebendiger gemacht. Der Löffel trägt in A2 nur wenig bei (A2 mit und ohne Löffel fast gleich), mit A3-Werten deutlich mehr.
- **A4/A5/Z „Kirschfleck“:** fast nie Gleichstand (0–15 %). Laufende Punkte, alle immer im Spiel, ein klares Ziel am Bildschirm. Das Gedränge kippt den Pudding zum Fleck, so treibt die Physik das Spiel an. Der Preis: Können zählt stark. Der _schwache_ Bot gewinnt nur 0–8 %. Der _etwas schwächere_ gewinnt 8–20 % (fair wären 25–50 %), bei Ø-Platz 1,8–3,2. Größerer, schnellerer Fleck (A4b) und Teilen (A4c) helfen dem Schwachen nicht. Die Wackelkrone (A5) verkleinert den Abstand von ≈ 22 auf ≈ 14–18 Punkte.
- **B „Krümel-Kehraus“:** physikalisch am reichsten (13 Körper) und ebenfalls stabil. Mit 28–38 % geteilten Siegen und einem schwachen Bot, der bei 2 Spielern gleichauf liegt, ist B aber ähnlich zufällig wie A2. Bots fallen sehr oft durch die eigene Lücke (7–16 Stürze je Runde). Auf dem Fernseher wird es mit 10 Krümeln, 4 Toren und Knäuel unübersichtlich.
- **Z (Umsetzung) = A5:** Die Kennzahlen liegen innerhalb des Rauschens. Stürze 2,3/4,8/7,6 je Runde, Schubser 1,6/3,9/6,3, Löffel-Stürze 0,6–0,9.

**Entscheidung:** **keep A5 → umgesetzt als „Pudding-Gerangel“ (`pudding-gerangel`, 30 s).** Begründung:

1. Lesbarkeit: ein Ziel (Kirschfleck mit Kirsche an der Stange), eine Gefahr (runterfallen), sichtbare Führung (Krone).
2. Physik ist der Kern: Kippen zum Gewicht, Rutschen, Rempler, Löffel und Plumpsen erzeugen das Chaos. Es sind keine Effekte obendrauf.
3. Niemand schaut zu (Comeback nach 1,5 s).
4. Kaum geteilte Siege.
5. Bedienung: Joystick + A, Anleitung 3 Zeilen ≤ 64 Zeichen, iPad-Zonen-tauglich.
6. Stabil und billig.

Dass Können hier mehr zählt als bei A2/B, ist gewollt. Die Kategorie heißt „Physik“, nicht „Lotterie“, und die Wackelkrone ist das Comeback-Werkzeug. Ob das für schwächere Mitspieler fair genug ist, kann nur der Playtest zeigen (siehe unten). Stellschrauben: `TUNING.leaderBonk`, `zoneMoveMs`, `zoneRadius` und `zoneRate` in `packages/minigames/src/pudding-gerangel/logic.ts`.

**Verworfen:**

- A „Letzter oben“: zu kurz, Zuschauerzeit, geteilte Siege.
- A2/A3 mit Saldo- oder Stürze-Wertung: Lotterie, Gleichstände.
- B „Krümel-Kehraus“: unübersichtlich, zufällig, Bots fallen ständig in Tore.

B könnte als späteres Physik-Minispiel mit weniger Krümeln und Toren an festen Ecken wiederkommen (Kandidat für `CHAOS-44`, der Koordinator legt die Aufgabe an).

**Simulation ist kein Spaßbeweis.** Bots sind keine Menschen. Sie überschießen den Fleck, lachen nicht, verbünden sich nicht spontan gegen die Führung und unterschätzen, wie lustig ein Sturz in die Sahne aussieht. Die Zahlen zeigen nur, dass die Regeln funktionieren und die Physik stabil bleibt.

**Belegbilder:** `docs/screenshots/m3-minispiel-pudding-gerangel.png` (Gerangel am Kirschfleck, 4 Spieler, 2×), `docs/screenshots/m3-minispiel-pudding-gerangel-ende.png` (Rundenende mit Wackelkrone, 2×).

**Offen für Playtest (Ruben):**

- Versteht man ohne Erklärung, dass der Sahnefleck mit der Kirsche Punkte gibt und dass der Pudding dorthin kippt, wo alle stehen?
- Ist der Pudding zu rutschig? (Reibung 0,12; man kann gegensteuern.) Fühlen sich Stürze witzig oder unfair an, besonders die durch den Rührlöffel?
- Gewinnt die schwächste Person oft genug? Sim: schwach 0–8 %, etwas schwächer 8–20 %. Falls nicht: Krone stärker (`leaderBonk` 1,5 → 2) oder Fleck öfter wechseln.
- Ist der Rempler (A) mit Abklingzeit 1 s befriedigend, und reicht die Wackelkrone als Ziel?
- Sind 30 s die richtige Länge? Sind 4 Punkte je Sekunde auf dem Fleck gut lesbar oder zu hektisch?
- Erkennt man die eigene Figur im Gedränge (Ring + Wimpel in Slot-Farbe), auch mit den echten Figuren statt der Platzhalter-Kapseln?

---

## EXP-007: Hybrid-Minispiel – Konzeptvergleich „Wackelturm“ gegen „Geysir-Gier“ (2026-11-15, CHAOS-29, CHAOS-32)

**Hypothese / gewünschtes Spielerlebnis:** Das Hybrid-Minispiel verbindet schnelle Ausführung (lenken, greifen, ausweichen, zielen) mit einer taktischen Entscheidung, die man **am Fernseher sieht** und die für Zuschauer lustig ist: Wer geht wie viel Risiko ein, wer räumt ab, wer klaut? Regeln in höchstens 3 Zeilen à 64 Zeichen, Bedienung Joystick + A + B (iPad-Zonen sind klein), 20–45 s. Keine Strategie soll immer gewinnen; ein ungeschickter Spieler soll eine echte, wenn auch kleinere Chance haben.

**Varianten (zwei eigene Konzepte, keine Nachbauten):**

- **A „Wackelturm“** (Picknickdecke, Törtchenberg in der Mitte, je Spieler ein Nest in einer Ecke): Mit A Törtchen am Berg greifen, als Turm auf dem Kopf ins eigene Nest tragen, dort zählen sie. Ab 6 Stück zählt der Turm doppelt (Krone auf dem Turm). Hohe Türme sind langsam, träge und wackeln bei scharfem Lenken und schnellem Laufen – zu viel Wackeln, und er kippt. Mit leeren Händen rempelt B (kurzer Sprint): Ein getroffener Turm wechselt den Besitzer, ein Fehlversuch endet im Bauchklatscher. Ab und zu liegt ein Goldtörtchen (zählt 3) abseits.
  Taktik sichtbar: Turmhöhe, Krone, Umweg zum Gold, Jäger ohne Turm. Erwartet: viel Ausführung (sanft lenken), klare Bilder; Risiko: „gierig“ oder „Rempeln“ dominiert.
  - A1 linear, ohne Rempeln/Gold, nur Lenkwackeln · A2 + Turmbonus · A3 + Rempeln immer, ohne Klau · A4 Rempeln nur mit leeren Händen, Klau ½, Gold (erste Fassung) · A5 + Laufwackeln, Trägheit hoher Türme, Klau ganz, Bauchklatscher · **A6 + hoch stapeln dauert länger (gewählt)**
- **B „Geysir-Gier“**: Vier Blubberbecken (Ertrag 1/2/3/5 je s, geteilt unter allen im Becken, Multiplikator ×1→×3 fürs Bleiben). Becken verlassen sichert den Topf; ertragreiche Becken brechen öfter und mit kürzerer Vorwarnung aus, wer drinsteht, verliert den Topf. A = Hüpfer (wer den Ausbruch in der Luft „reitet“, verdoppelt), B = Schubsen.
  Erwartet: starke Push-your-luck-Spannung, Gedränge im roten Becken; Risiko: wenig Ausführung, viele Begriffe.
  - B1 ohne Ritt/Schubsen · B2 mit Ritt ×2 und Schubsen · B3 B2 ohne Überraschungs-Ausbrüche · B4 B2, rotes Becken öfter, Ritt ×1,5

**Objektive Messgrößen:** Rundendauer; Siegerpunkte; relativer Abstand Platz 1–2; Gleichstand auf Platz 1; Führungswechsel (nach gesicherten Punkten); Zuschauer-Momente je Partie (A: umgekippte/geklaute Türme, B: Treffer und Ritte); Eingaben je Sitz und Sekunde und B-Anteil (Ausführungs-/Bedienlast); Strategie-Turnier (Siegfaktor je Strategie bei gleicher Geschicklichkeit, 1,00 = fair); **Eindringling gegen Monokultur** (lohnt es sich, von einer Strategie abzuweichen? Eine Strategie mit Faktor > 1 gegen alle wäre dominant); Außenseiter-Chance (Geschick 0,2 gegen 0,9); Anleitungslänge und Zahl der Regelbegriffe.

**Bots:** vier Strategien – _vorsichtig_ (A: 2–4 Törtchen; B: grüne/gelbe Becken, früh sichern, bei Warnung raus), _gierig_ (A: 7–10; B: orange/rot, lange bleiben, Geysir reiten), _zufällig_ (A: 1–10 je Gang; B: zufällige Becken und Zeiten), _Raufbold_ (A: 3–5 und jagt hohe Türme mit B; B: gierig und schubst Mitbewohner raus). Geschicklichkeit 0–1 steuert Reaktionszeit (0,45–0,15 s), Lenkfehler, Drehrate des Sticks, Gefühl für die Kippgrenze, Ausweichen vor Remplern, Timing des Hüpfers. Bots sehen nur, was ein Mensch am Fernseher sieht (Positionen, Türme, Wackeln, Warnungen), nicht den Zufall.

**Subjektive Playtest-Fragen (für Ruben):** siehe „Offen für Playtest“.

**Testumgebung:** Node 22, Vitest, reines TypeScript ohne Babylon; fester Schritt 1/60 s; Spielzufall `createMinigameRng(seed)`, Bot-Zufall getrennt je Sitz. Seeds 1–200 je Zeile (Eindringling: 1–200, 3 Spieler), 35 s je Partie. Konzept A spielt die **echten Regeln** aus `packages/minigames/src/wackelturm/logic.ts` (Varianten = Parameter-Sätze), Konzept B den Prototyp `packages/minigames/src/prototypes/hybrid/geysir.ts`. Wiederholen:

```sh
EXPERIMENTS=1 pnpm exec vitest run packages/minigames/src/prototypes/hybrid --silent=false
```

Laufzeit ≈ 4,5 min. Ohne `EXPERIMENTS=1` läuft nur ein Smoke-Test mit 3 Seeds.

**Ergebnisse:**

**EXP-007 Verlauf (gemischte Tische, Seeds 1–200)**

| Variante                                               | Sp. | Dauer s | Sieger-Punkte | Abstand 1–2 | Gleichstand | Führungswechsel | Momente | Eingaben/s | B-Anteil |
| ------------------------------------------------------ | --- | ------- | ------------- | ----------- | ----------- | --------------- | ------- | ---------- | -------- |
| A1: linear, ohne Rempeln, ohne Gold                    | 2   | 35      | 25,2          | 43 %        | 5 %         | 2,3             | 4,7     | 2,9        | 0 %      |
| A1: linear, ohne Rempeln, ohne Gold                    | 3   | 35      | 27,3          | 24 %        | 5 %         | 4,7             | 7,0     | 3,0        | 0 %      |
| A1: linear, ohne Rempeln, ohne Gold                    | 4   | 35      | 27,6          | 16 %        | 11 %        | 6,1             | 9,5     | 3,0        | 0 %      |
| A2: + Turmbonus ×2 ab 6                                | 2   | 35      | 32,7          | 42 %        | 6 %         | 2,0             | 4,7     | 2,9        | 0 %      |
| A2: + Turmbonus ×2 ab 6                                | 3   | 35      | 37,4          | 29 %        | 3 %         | 3,9             | 7,0     | 3,0        | 0 %      |
| A2: + Turmbonus ×2 ab 6                                | 4   | 35      | 37,4          | 23 %        | 9 %         | 4,8             | 9,5     | 3,0        | 0 %      |
| A3: + Rempeln immer, ohne Klau                         | 2   | 35      | 9,0           | 54 %        | 25 %        | 0,5             | 17,9    | 4,9        | 11 %     |
| A3: + Rempeln immer, ohne Klau                         | 3   | 35      | 9,3           | 56 %        | 13 %        | 0,5             | 27,0    | 4,8        | 14 %     |
| A3: + Rempeln immer, ohne Klau                         | 4   | 35      | 8,4           | 52 %        | 14 %        | 0,6             | 37,2    | 4,8        | 14 %     |
| A4: Rempeln nur mit leeren Händen, Klau ½, Gold        | 2   | 35      | 33,1          | 42 %        | 4 %         | 2,0             | 5,4     | 3,1        | 1 %      |
| A4: Rempeln nur mit leeren Händen, Klau ½, Gold        | 3   | 35      | 34,1          | 27 %        | 7 %         | 3,3             | 8,9     | 3,3        | 2 %      |
| A4: Rempeln nur mit leeren Händen, Klau ½, Gold        | 4   | 35      | 34,5          | 22 %        | 7 %         | 4,5             | 12,7    | 3,4        | 2 %      |
| A5: + Laufwackeln, Trägheit, Klau ganz, Bauchklatscher | 2   | 35      | 46,3          | 30 %        | 5 %         | 2,8             | 1,1     | 2,3        | 2 %      |
| A5: + Laufwackeln, Trägheit, Klau ganz, Bauchklatscher | 3   | 35      | 48,1          | 25 %        | 6 %         | 4,1             | 2,9     | 2,4        | 4 %      |
| A5: + Laufwackeln, Trägheit, Klau ganz, Bauchklatscher | 4   | 35      | 49,8          | 24 %        | 4 %         | 4,8             | 5,2     | 2,4        | 5 %      |
| A6: + hoch stapeln dauert länger (gewählt)             | 2   | 35      | 37,9          | 25 %        | 5 %         | 2,7             | 1,2     | 2,1        | 2 %      |
| A6: + hoch stapeln dauert länger (gewählt)             | 3   | 35      | 39,6          | 22 %        | 4 %         | 4,3             | 2,7     | 2,2        | 4 %      |
| A6: + hoch stapeln dauert länger (gewählt)             | 4   | 35      | 41,0          | 20 %        | 4 %         | 5,2             | 4,3     | 2,3        | 4 %      |
| B1: ohne Hüpfer-Ritt, ohne Schubsen                    | 2   | 35      | 112,4         | 32 %        | 2 %         | 3,4             | 2,7     | 0,7        | 0 %      |
| B1: ohne Hüpfer-Ritt, ohne Schubsen                    | 3   | 35      | 102,0         | 23 %        | 4 %         | 5,5             | 3,7     | 0,7        | 0 %      |
| B1: ohne Hüpfer-Ritt, ohne Schubsen                    | 4   | 35      | 88,2          | 20 %        | 2 %         | 6,9             | 4,7     | 0,7        | 0 %      |
| B2: + Hüpfer-Ritt ×2, Schubsen                         | 2   | 35      | 150,8         | 45 %        | 0 %         | 2,3             | 5,1     | 0,7        | 10 %     |
| B2: + Hüpfer-Ritt ×2, Schubsen                         | 3   | 35      | 138,9         | 33 %        | 0 %         | 4,0             | 7,2     | 0,7        | 19 %     |
| B2: + Hüpfer-Ritt ×2, Schubsen                         | 4   | 35      | 131,2         | 28 %        | 2 %         | 5,1             | 9,3     | 0,7        | 30 %     |
| B3: B2 ohne Überraschungs-Ausbrüche                    | 2   | 35      | 155,4         | 44 %        | 0 %         | 2,5             | 4,7     | 0,7        | 11 %     |
| B3: B2 ohne Überraschungs-Ausbrüche                    | 3   | 35      | 145,8         | 34 %        | 1 %         | 4,1             | 6,4     | 0,7        | 19 %     |
| B3: B2 ohne Überraschungs-Ausbrüche                    | 4   | 35      | 129,7         | 26 %        | 3 %         | 5,5             | 8,3     | 0,8        | 27 %     |
| B4: B2, rotes Becken öfter, Ritt nur ×1,5              | 2   | 35      | 106,5         | 43 %        | 1 %         | 2,2             | 6,9     | 0,8        | 8 %      |
| B4: B2, rotes Becken öfter, Ritt nur ×1,5              | 3   | 35      | 102,9         | 29 %        | 1 %         | 4,2             | 9,4     | 0,8        | 17 %     |
| B4: B2, rotes Becken öfter, Ritt nur ×1,5              | 4   | 35      | 101,4         | 27 %        | 0 %         | 5,1             | 11,9    | 0,8        | 25 %     |

**EXP-007 Strategien (Siegfaktor bei gleicher Geschicklichkeit 0,7; 1,00 = fair)**

| Variante                                               | Sp. | vorsichtig | gierig | zufällig | Raufbold | Außenseiter (0,2 vs 0,9) gewinnt |
| ------------------------------------------------------ | --- | ---------- | ------ | -------- | -------- | -------------------------------- |
| A1: linear, ohne Rempeln, ohne Gold                    | 2   | 1,14       | 0,42   | 0,82     | 1,67     | 66 % (fair 50 %)                 |
| A1: linear, ohne Rempeln, ohne Gold                    | 3   | 1,10       | 0,19   | 0,64     | 2,24     | 54 % (fair 33 %)                 |
| A1: linear, ohne Rempeln, ohne Gold                    | 4   | 0,93       | 0,11   | 0,57     | 2,48     | 48 % (fair 25 %)                 |
| A2: + Turmbonus ×2 ab 6                                | 2   | 1,00       | 0,53   | 0,99     | 1,51     | 72 % (fair 50 %)                 |
| A2: + Turmbonus ×2 ab 6                                | 3   | 0,90       | 0,56   | 0,95     | 1,70     | 62 % (fair 33 %)                 |
| A2: + Turmbonus ×2 ab 6                                | 4   | 0,72       | 0,36   | 1,10     | 1,88     | 59 % (fair 25 %)                 |
| A3: + Rempeln immer, ohne Klau                         | 2   | 1,40       | 0,95   | 0,90     | 0,74     | 55 % (fair 50 %)                 |
| A3: + Rempeln immer, ohne Klau                         | 3   | 1,82       | 0,76   | 0,57     | 0,75     | 38 % (fair 33 %)                 |
| A3: + Rempeln immer, ohne Klau                         | 4   | 2,23       | 0,73   | 0,55     | 0,60     | 24 % (fair 25 %)                 |
| A4: Rempeln nur mit leeren Händen, Klau ½, Gold        | 2   | 1,11       | 0,49   | 0,94     | 1,49     | 76 % (fair 50 %)                 |
| A4: Rempeln nur mit leeren Händen, Klau ½, Gold        | 3   | 1,07       | 0,42   | 0,80     | 1,82     | 52 % (fair 33 %)                 |
| A4: Rempeln nur mit leeren Händen, Klau ½, Gold        | 4   | 0,85       | 0,37   | 0,84     | 2,01     | 45 % (fair 25 %)                 |
| A5: + Laufwackeln, Trägheit, Klau ganz, Bauchklatscher | 2   | 0,34       | 1,64   | 1,12     | 0,88     | 58 % (fair 50 %)                 |
| A5: + Laufwackeln, Trägheit, Klau ganz, Bauchklatscher | 3   | 0,18       | 1,76   | 1,24     | 0,86     | 26 % (fair 33 %)                 |
| A5: + Laufwackeln, Trägheit, Klau ganz, Bauchklatscher | 4   | 0,14       | 1,63   | 1,11     | 0,98     | 25 % (fair 25 %)                 |
| A6: + hoch stapeln dauert länger (gewählt)             | 2   | 0,49       | 1,33   | 1,26     | 0,89     | 48 % (fair 50 %)                 |
| A6: + hoch stapeln dauert länger (gewählt)             | 3   | 0,37       | 1,27   | 1,36     | 1,07     | 24 % (fair 33 %)                 |
| A6: + hoch stapeln dauert länger (gewählt)             | 4   | 0,36       | 1,32   | 0,88     | 1,35     | 31 % (fair 25 %)                 |
| B1: ohne Hüpfer-Ritt, ohne Schubsen                    | 2   | 0,24       | 1,50   | 0,93     | 1,32     | 51 % (fair 50 %)                 |
| B1: ohne Hüpfer-Ritt, ohne Schubsen                    | 3   | 0,11       | 1,33   | 1,23     | 1,47     | 33 % (fair 33 %)                 |
| B1: ohne Hüpfer-Ritt, ohne Schubsen                    | 4   | 0,26       | 0,96   | 1,47     | 1,27     | 18 % (fair 25 %)                 |
| B2: + Hüpfer-Ritt ×2, Schubsen                         | 2   | 0,30       | 1,45   | 0,93     | 1,31     | 43 % (fair 50 %)                 |
| B2: + Hüpfer-Ritt ×2, Schubsen                         | 3   | 0,09       | 1,71   | 0,95     | 1,34     | 18 % (fair 33 %)                 |
| B2: + Hüpfer-Ritt ×2, Schubsen                         | 4   | 0,04       | 1,82   | 0,65     | 1,31     | 11 % (fair 25 %)                 |
| B3: B2 ohne Überraschungs-Ausbrüche                    | 2   | 0,28       | 1,43   | 1,00     | 1,28     | 47 % (fair 50 %)                 |
| B3: B2 ohne Überraschungs-Ausbrüche                    | 3   | 0,09       | 1,69   | 0,95     | 1,36     | 25 % (fair 33 %)                 |
| B3: B2 ohne Überraschungs-Ausbrüche                    | 4   | 0,02       | 1,76   | 0,85     | 1,21     | 16 % (fair 25 %)                 |
| B4: B2, rotes Becken öfter, Ritt nur ×1,5              | 2   | 0,34       | 1,22   | 1,05     | 1,40     | 46 % (fair 50 %)                 |
| B4: B2, rotes Becken öfter, Ritt nur ×1,5              | 3   | 0,28       | 1,23   | 1,27     | 1,32     | 27 % (fair 33 %)                 |
| B4: B2, rotes Becken öfter, Ritt nur ×1,5              | 4   | 0,18       | 1,24   | 1,21     | 1,27     | 17 % (fair 25 %)                 |

**EXP-007 Eindringling gegen Monokultur (3 Spieler, Siegfaktor; 1,00 = fair)**

| Var. | Eindringling | gegen 2× vorsichtig | gegen 2× gierig | gegen 2× zufällig | gegen 2× Raufbold |
| ---- | ------------ | ------------------- | --------------- | ----------------- | ----------------- |
| A4   | vorsichtig   | 1,04                | 2,20            | 1,52              | 0,37              |
| A4   | gierig       | 0,38                | 0,86            | 0,48              | 0,04              |
| A4   | zufällig     | 1,01                | 1,55            | 1,03              | 0,49              |
| A4   | Raufbold     | 2,06                | 2,46            | 1,97              | 1,04              |
| A6   | vorsichtig   | 0,97                | 0,13            | 0,14              | 1,03              |
| A6   | gierig       | 2,59                | 0,91            | 1,20              | 0,82              |
| A6   | zufällig     | 2,61                | 0,92            | 1,13              | 1,17              |
| A6   | Raufbold     | 1,60                | 1,21            | 0,55              | 1,06              |
| B2   | vorsichtig   | 1,11                | 0,11            | 0,00              | 0,16              |
| B2   | gierig       | 2,75                | 0,99            | 1,97              | 1,46              |
| B2   | zufällig     | 2,88                | 0,50            | 1,14              | 0,85              |
| B2   | Raufbold     | 2,97                | 0,63            | 1,40              | 1,03              |
| B4   | vorsichtig   | 1,18                | 0,40            | 0,02              | 0,31              |
| B4   | gierig       | 2,19                | 0,92            | 1,26              | 0,90              |
| B4   | zufällig     | 2,85                | 1,27            | 0,95              | 1,09              |
| B4   | Raufbold     | 2,92                | 1,59            | 1,16              | 0,99              |

**EXP-007 Bedienung und Anleitung**

| Konzept     | Bedienung                  | Anleitung (Zeilen, längste) | Regel-Begriffe                                                    |
| ----------- | -------------------------- | --------------------------- | ----------------------------------------------------------------- |
| Wackelturm  | Laufen / Greifen / Rempeln | 3, 56/64 Zeichen            | Berg, Nest, Turmbonus, Wackeln, Rempeln (5)                       |
| Geysir-Gier | Laufen / Hüpfen / Schubsen | 3, 60/64 Zeichen            | Becken, Topf, Multiplikator, Teilen, Ausbruch, Ritt, Schubsen (7) |

**Auswertung:**

- **Die frühen A-Fassungen sind kippelig balanciert.** Im ersten Lauf (frühere Bot-Fassung: ohne Ausweichen, Geschickte liefen grundlos langsamer) dominierte „gierig“ in A1/A2/A4 mit Faktor 1,7–2,4 – lange Wege lohnen sich mit großen Türmen. Mit den endgültigen Bots (Tabelle) kippt dieselbe Regel ins Gegenteil: Ohne Trägheit fallen hohe Türme schon beim Losgehen, „gierig“ sinkt auf 0,1–0,6, der Raufbold dominiert (A4: Eindringling ≥ 1,04 gegen alle), und der Außenseiter gewinnt sogar öfter als fair (45–76 %), weil Geschick kaum zählt. Beides zeigt: Reines Lenkwackeln trägt die Balance nicht. In B2 ist „gierig“ dominant (Eindringling > 1 gegen alle Monokulturen außer sich selbst, 0,99).
- **Rempeln mit Turm ist Chaos ohne Fortschritt.** A3 (immer rempeln, auch mit Turm): Siegerpunkte ≈ 9, bis 25 % Gleichstand, 37 Momente in 35 s, nur „vorsichtig“ kommt durch (2,2). Darum: Rempeln nur mit leeren Händen.
- **Gewählte Fassung A6:** Laufwackeln + Trägheit hoher Türme (Tempo wird zur Geschicklichkeitsfrage), ganzer Turm wird geklaut (Revanche-Jagd, lustig), Bauchklatscher bei Fehlrempler, und **jedes weitere Törtchen auf dem Kopf dauert länger** (0,25 s + 0,12 s je Stück). Ergebnis: keine Strategie gewinnt gegen alle – es gibt einen Kreis: Raufbold schlägt Gierige (1,21; umgekehrt 0,82), Zufällig/Mittelhoch schlägt Raufbolde (1,17; umgekehrt 0,55), Gierig schlägt Zufällig knapp (1,20; umgekehrt 0,92). Gleichstand 4–5 %, Abstand 1–2 rund 20–25 %, 2,7–5,2 Führungswechsel, Außenseiter 48/24/31 % (fair 50/33/25 %). Rein vorsichtig (nie der Turmbonus) ist schwach (0,36–0,49) – gewollt: „Ab 6 zählt doppelt“ soll zum Risiko locken.
- **B im Vergleich:** spektakulärer in Zahlen (5–12 Momente je Partie), aber kaum Ausführung (0,7–0,8 Eingaben/s gegenüber 2,1–2,3 in A6), die Taktik sitzt in unsichtbaren Größen (Topf, Multiplikator, geteilter Ertrag), 7 Regelbegriffe in fast vollen 3 Zeilen (60/64 Zeichen, erste Fassung passte nicht), dominantes „gierig“ in B2, und der Außenseiter hat bei 4 Spielern nur 11–17 % (fair 25 %). B4 dämpft das, löst es aber nicht.
- Simulation ist **kein Spaß-Beweis**: Bots spielen nach festen Regeln, Menschen passen sich an (z. B. Revanche nach einem Klau, Gedränge am Berg, Schadenfreude). Die Zahlen sagen nur, dass keine offensichtliche Gewinnformel und keine kaputte Wertung existiert.

**Entscheidung:** **keep A6 „Wackelturm“** als Hybrid-Minispiel (`packages/minigames/src/wackelturm/`, in Katalog und Rotation), **discard B „Geysir-Gier“** für den Vertical Slice.
Begründung: A verbindet Ausführung (sanft lenken unter Kippgefahr, greifen, ausweichen, zielen) und Taktik (wie hoch stapeln, Gold-Umweg, sammeln oder jagen) in einem einzigen sichtbaren Bild – dem schwankenden Turm mit Krone. Keine dominante Strategie, fairere Außenseiter-Chance, 5 statt 7 Begriffe, Bedienung Joystick + A + B mit seltenem B (2–5 % der Knopfdrücke). B bleibt als Idee für später (Becken mit geteiltem Ertrag, Geysir reiten) – Kandidat für `CHAOS-44`.

**Gewählte Werte (`WACKELTURM_PARAMS`):** Arena 16 × 9, Berg-Radius 1,5, Nest-Radius 1,15 in den Ecken; Tempo 4,6 / (1 + 0,06 · Höhe); Beschleunigung 14 / (1 + 0,12 · Höhe); sicher bis 2 Stück; Wackeln (0,5 · Lenken² + 0,7 · Tempo²) · (Höhe − 2), Abklingen 1,3/s, kippt bei 1; Greifen 0,25 s + 0,12 s je Stück auf dem Kopf, höchstens 10; Turmbonus ×2 ab 6; Gold alle 7 s (lebt 6 s, zählt 3); Rempeln: Sprint 0,22 s mit 10 Einheiten/s, Reichweite 1,05, Abklingzeit 2 s, nur mit leeren Händen, ganzer Turm wird geklaut, Opfer 0,7 s benommen, Bauchklatscher 0,6 s, im eigenen Nest sicher; Sturz durch Wackeln 0,8 s benommen; Spielzeit 35 s.

**Belegbilder:** `docs/screenshots/m3-minispiel-wackelturm.png` (4 Spieler mitten im Spiel: Grüns 10er-Turm kippelt, Blau liefert 7er-Turm mit Krone ab), `docs/screenshots/m3-minispiel-wackelturm-kippt.png` (eine Sekunde später: Turm eingestürzt, Krümel fliegen, Goldtörtchen liegt aus). Vorschau: `pnpm --filter @chaos-party/host dev`, dann `/host/?local=1&minigame=wackelturm&players=4`.

**Offen für Playtest (Ruben, echte Controller):**

1. Ist sanftes Lenken mit dem virtuellen Joystick am iPhone und in einer kleinen iPad-Zone machbar, oder kippen Türme gefühlt „ohne Grund“? (Stellschrauben: `walkWobble`, `wobbleGain`, `loadInertia`.)
2. Ist das Schwanken früh genug sichtbar, um rechtzeitig vom Gas zu gehen? Reicht „kippelt!“ im HUD?
3. Fühlt sich der Klau des ganzen Turms witzig an oder gemein? Kommt es zu Revanche-Jagden?
4. Lockt „ab 6 doppelt“ zum Risiko, oder stapeln alle stur genau 6?
5. Sind 35 s richtig (genug für 3–5 Gänge), oder zu lang/kurz?
6. Erkennen Zuschauer am Fernseher sofort, wer wie hoch stapelt und wer gerade jagt?

**Für später (CHAOS-44):** Konzept B „Geysir-Gier“ (geteilte Becken, Geysir-Ritt); verstreute Krümel nach einem Sturz zum Aufsammeln; Törtchenberg, der schrumpft und nachwächst.

---

## EXP-008: Look-Dev – drei moderne Stilrichtungen (2026-11-15, CHAOS-56)

**Hypothese / gewünschtes Spielerlebnis:** Ruben findet den M2/M3-Look „70er-Jahre“ (flaches `StandardMaterial`, Halbkugellicht, Bonbonfarben, Grundkörper). Mit moderner Render-Pipeline (Umgebungslicht, weiche Schatten, Nachbearbeitung) und weicher modellierten Formen wirkt dasselbe Spiel „modern und schön“, ohne gekaufte Assets und ohne die Lesbarkeit am Fernseher zu verlieren. Welche Richtung „modern“ trifft, entscheidet Ruben (Art Direction ist Produktentscheidung).

**Varianten** (gleicher Ausschnitt: Brettstück mit 8 Feldern, Bäumen, Teich, Trophäe; Nahansicht zweier Figuren; Pudding-Arena mit vier Figuren; HUD-Karten):

- **A „Weich & glänzend“:** PBR mit Klarlack, Umgebungslicht aus prozeduralem Himmel (RGBE im Speicher → `HDRCubeTexture`, Harmonische + Vorfilterung), Kontaktschatten (PCSS), SSAO2, ACES, Bloom, Vignette; UI als Glas-Karten. Erwartet: am hochwertigsten; Risiko GPU-Last, Farben kippen ins Spielzeughafte.
- **B „Cel-Shading“:** `StandardMaterial` + Material-Plugin `ToonPlugin` (Licht in drei Stufen, harte Glanzpunkte, Randlicht), farbige Konturen (`renderOutline`), FXAA; UI mit dicker Kontur und Versatzschatten. Erwartet: günstig, sehr lesbar, „Animationsfilm“; Risiko: doppelte Zeichenaufrufe, Flimmern dünner Teile.
- **C „Low-Poly-Diorama“:** facettierte Formen (Flat-Shading, 9 Segmente), Pastell, tiefe warme Sonne, Dunst, SSAO, Tilt-Shift-Tiefenunschärfe; UI als Papier-Karten. Erwartet: ruhig, edel; Risiko: zu wenig „Chaos“, kontrastarm am Fernseher.

**Objektive Messgrößen:** Zeichenaufrufe und Eckpunkte je Ansicht; Bildzeit (nur relativ, siehe Testumgebung); Lesbarkeit von Slot-Farbe + Symbol in der Brettansicht (Sichtprüfung).

**Subjektive Fragen (für Ruben):** Wirkt modern? Schön? Passt zu Chaos Party? Was stört? Welche Richtung oder welcher Mix?

**Testumgebung:** Look-Dev-Vitrine `apps/host/src/lookdev/lookdev.html?look=<weich|toon|diorama>&shot=<brett|figur|minispiel>&test=1` (nur Dev-Server), Chromium headless mit SwiftShader (Software-WebGL), 1600×900, Pixeldichte 2, 3 Aufwärm-Frames. Szene deterministisch (Seed 56 Brett, 7 Arena). Figuren = bestehende GLBs aus CHAOS-27, nur umgefärbt/umgeschattet.

**Ergebnisse:**

| Richtung  | Zeichenaufrufe Brett / Arena | Eckpunkte Brett | Bildzeit SwiftShader Brett |
| --------- | ---------------------------- | --------------- | -------------------------- |
| A Weich   | 421 / 213                    | 101 435         | ≈ 12,6 s                   |
| B Toon    | 820 / 399                    | 79 942          | ≈ 2,0 s                    |
| C Diorama | 631 / 320                    | 103 918         | ≈ 11,2 s                   |

Software-Rendering ist kein Maß für den Ziel-PC; die Zeiten zeigen nur das Verhältnis: A und C kosten durch SSAO/MSAA/Unschärfe ein Vielfaches von B. Zeichenaufrufe sind in allen Richtungen unoptimiert (keine Instanzen, keine zusammengeführten Meshes) und würden bei der Umsetzung deutlich sinken. Belege: `docs/screenshots/chaos56-lookdev-<richtung>-<ansicht>.jpg`; Entscheidungsseite mit Bewertung: https://claude.ai/artifact/P6iu4tF9iBFzfnSqgukHfR.

**Entscheidung:** iterate – Ruben (2026-11-15): „Wenn überhaupt ein Mix aus 1 und 3. Vielleicht ganz bisschen realistischer? Mir gefällt aber einiges daran nicht.“ Es stören Figuren, zu simple Modelle, kindliche Farben, Licht/Stimmung. Weiter in EXP-009.

**Offen für Playtest:** Wirkung am Fernseher aus 3 m; Bildrate am Ziel-PC (`?debug=1`-Messanzeige) für die gewählte Richtung.

---

## EXP-009: Look-Dev Runde 2 – „Stilisierte Natur“ (2026-11-15, CHAOS-57)

**Hypothese / gewünschtes Spielerlebnis:** Ein Mix aus A (weiches PBR) und C (Diorama), etwas realistischer, trifft Rubens „modern und schön“: eine lebendige kleine Welt mit echten Materialien statt Grundkörpern in Bonbonfarben, aber stilisierte Formen und Figuren, damit es verspielt bleibt.

**Varianten:** gleiche Welt, drei Lichtstimmungen (HDRI + Sonne + Dunst + Gras-Tönung):

- N1 „Sommermorgen“ (`qwantani_mid_morning_puresky`), N2 „Goldene Stunde“ (`qwantani_late_afternoon_puresky`), N3 „Leicht bewölkt“ (`kloofendal_48d_partly_cloudy_puresky`).

**Aufbau:** `apps/host/src/lookdev/nature.ts`: unregelmäßige Insel mit Hügeln und Erdkante, CC0-Texturen von Poly Haven (Wiese, Erde, Rinde, Moosfels, Eichenholz, Bretter; Liste `polyhaven.json`, Abruf `node scripts/fetch-lookdev-assets.mjs`, nicht eingecheckt), ≈ 42 000 Grashalme als Thin Instances (drei Farbsorten), Bäume mit Rindenstamm und weichen Kronen, Steine mit Moos, Felder als Baumscheiben mit lackierter Farbeinlage + Symbol, Teich, Farne/Blumen (CC0-Modelle). Licht: HDRI als Umgebungslicht und Himmel, Sonne aus den Harmonischen des HDRI abgeleitet und so gedreht, dass sie schräg von vorn links kommt (kein Gegenlicht), Halbkugellicht als Bodenlicht (Puresky-HDRIs sind unten schwarz), PCSS-Schatten, SSAO, ACES, leichte Tiefenunschärfe, Korn.

**Testumgebung:** Vitrine `lookdev.html?look=natur-<morgen|abend|wolken>&shot=<brett|figur|minispiel>`; begehbare 3D-Fassung als Artefakt https://claude.ai/artifact/P4BrCKbYSyfXGHAo726W71 (gepackt mit `node scripts/pack-lookdev-artifact.mjs <ziel>`), Entscheidungsseite https://claude.ai/artifact/P6iu4tF9iBFzfnSqgukHfR. SwiftShader-Bildzeit ≈ 20 s (nur relativ), ≈ 700 Zeichenaufrufe, ≈ 330 000 Eckpunkte im Brett.

**Ergebnisse:** Fehler unterwegs behoben: Instanzfarbe ersetzt den Halm-Verlauf (→ drei Halm-Sorten), IcoSphere standardmäßig flach (→ `flat: false`, mehr Unterteilung), Gegenlicht (→ HDRI gedreht), Himmelsbox größer als Sichtweite (→ 500), schwarzer Unterhimmel (→ Dunst-Ebene), Decke falsch abgetastet (→ Höhe an gedrehter Position).

**Entscheidung:** keep – Ruben nach der 3D-Fassung (2026-11-15): „ja passt so“. Offen: Lichtstimmung (N1/N2/N3 oder je Brett eine), neue Figuren (CHAOS-58), Controller-UI (CHAOS-59), Bildrate am Ziel-PC.

**Offen für Playtest:** Bildrate am Ziel-PC mit 40 000 Halmen, SSAO und Unschärfe; Lesbarkeit der Felder und Slot-Farben aus 3 m am Fernseher.

---

## EXP-010: Lichtstimmung je Brett, nach Uhrzeit oder nach Spielverlauf, inkl. Nacht (2026-11-15, CHAOS-60)

**Hypothese / gewünschtes Spielerlebnis:** Ein Wechsel der Lichtstimmung macht die Welt lebendiger als ein fest eingestelltes Licht. Am stärksten wirkt er als Bogen über die Partie: Die erste Runde spielt morgens, die letzte nachts mit Laternen. So spürt man das Finale, ohne dass Text es ansagt. Dabei bleiben Felder, Figuren und Slot-Farben in jeder Stimmung am Fernseher lesbar.

**Varianten (Zuordnung):**

- A „je Brett“: jedes Brett hat eine feste Stimmung (Wackelwald = goldene Stunde). Am ruhigsten und am besten planbar, aber ohne Abwechslung innerhalb einer Partie.
- B „PC-Uhrzeit“: Stimmung nach der echten Uhrzeit (6–11 Morgen, 11–16 Mittag, 16–19 goldene Stunde, 19–21 Dämmerung, sonst Nacht). Überraschend und „echt“, aber Partyabende liegen fast immer bei Dämmerung oder Nacht: Dann sieht man meist dieselbe Stimmung, und Tagesbilder gibt es abends nie.
- C „Spielverlauf“: Runde 1 → Morgen, … letzte Runde → Nacht (`ROUND_ARC`, bei 5 Runden jede Stimmung einmal, bei mehr Runden länger je Stimmung, nie rückwärts). Minispiele erben die Stimmung der Runde. Liefert Abwechslung und Dramaturgie, kostet einen Lichtwechsel pro Runde (zwischen den Runden, hinter einer Überblendung).

**Stimmungen (Daten in `apps/host/src/lighting/moods.ts`):** Morgen, Mittag, Bewölkt, Goldene Stunde, Dämmerung, Nacht. Alle außer „Bewölkt“ stammen aus derselben Poly-Haven-Serie (Qwantani, CC0), der Himmel passt also zusammen. Dämmerung und Nacht bringen 4 Laternen (Punktlichter, leuchtendes Glas), Glühwürmchen (Thin Instances mit Schein) und leuchtende Feld-Einlagen und Slot-Ringe (`tileGlow` 0,25 bzw. 0,7) mit.

**Objektive Messgrößen:** Lesbarkeit der Feld-Symbole und Slot-Ringe im Screenshot (1280×720, wie aus 3 m), mittlere Bildhelligkeit je Stimmung, Zeichenaufrufe (Nacht: +16 durch Laternen und Glühwürmchen) und Lichter pro Material (Nacht bis 6 statt 2).

**Subjektive Playtest-Fragen (für Ruben):** Welche Zuordnung? Ist die Nacht dunkel genug, um Nacht zu sein, aber hell genug zum Spielen? Stören die Laternen am Tag? Soll „Bewölkt“ als Brett-Stimmung bleiben?

**Testumgebung:** Vitrine `lookdev.html?look=natur-<morgen|mittag|wolken|abend|daemmerung|nacht>&shot=<brett|figur|minispiel>`, Feinabstimmung ohne Neubau mit `&tune={"key":{"intensity":2}}`. SwiftShader (Software-Rendering), Chromium, 1280×720, 1 Bild nach `whenReadyAsync`.

**Ergebnisse:** Alle 18 Bilder (6 Stimmungen × Brett/Figuren/Minispiel) rendern ohne Seitenfehler. Mittlere Bildhelligkeit (0–255) Brett / Figuren / Minispiel: Morgen 159/114/163, Mittag 154/106/157, Bewölkt 170/125/173, Goldene Stunde 158/122/164, Dämmerung 83/100/127, Nacht 38/82/85. Die Nacht ist im Brett-Überblick deutlich dunkel, die Feld-Einlagen, Symbole und Slot-Ringe stechen aber durch ihr Eigenleuchten heraus. In der Figuren-Nahansicht bleiben alle Slot-Farben unterscheidbar. Zeichenaufrufe Brett 688 → 704 nachts (Laternen, Glühwürmchen), Minispiel 409 → 425.

Fehler unterwegs behoben: Gras und Kronen wurden in Dämmerung und Nacht weißlich. Die Ursache war die starke Umgebungsbeleuchtung aus dem HDRI, die bei schwacher Sonne dominiert; Laternen und zusätzliche Lichter pro Material waren es nicht (gegengeprüft per Abschaltung). Lösung: Umgebungsstärke 0,35 bzw. 0,5 statt 1,3 bzw. 2,5, dafür mehr Belichtung und stärkere Laternen. HDRI-Vergleich Nacht: `qwantani_moonrise_puresky` und `qwantani_night_puresky` zeigen über dem Horizont einen hellen Streifen, `qwantani_moon_noon_puresky` bleibt sauber dunkelblau → gewählt. Dämmerung: `dusk_1` und `dusk_2` fast gleich, `dusk_2` behalten. Verworfene HDRIs sind wieder aus `polyhaven.json` entfernt.

Bilder: Entscheidungsseite https://claude.ai/artifact/5WVskYB8BoiVT7wxsYuYCK, begehbare 3D-Fassung mit allen Stimmungen https://claude.ai/artifact/P4BrCKbYSyfXGHAo726W71 (Version 5).

**Entscheidung:** keep C „Spielverlauf“, Ruben im Chat am 2026-11-15: „C“. Jede Partie ist ein Tag (`moodForRound`), Minispiele erben die Stimmung der Runde. A (fest je Brett) und B (Uhrzeit) sind verworfen; `moodForBoard` bleibt als Rückfall für Szenen ohne Runde (Lobby, Siegerehrung). Einbau ins Spiel: CHAOS-62 (Natur-Look im Spiel), CHAOS-63 (Lichtverlauf je Runde mit Überblendung).

**Offen für Playtest:** Wirkung der Nacht am Fernseher (Schwarzwert, Abstand 3 m), Bildrate am Ziel-PC mit 6 Lichtern pro Material, ob der Wechsel zwischen den Runden als Überblendung reicht.

---

## Gemeinsamer Aufbau von EXP-011 … EXP-013 (2026-11-15, CHAOS-40)

M4-Bot-Simulationen mit den **aktuellen** Regeln (`DEFAULT_RULES`, Brett Wackelwald, Stand nach EXP-001 … EXP-004) und – neu – der **echten Minispiel-Rotation** aus M3 statt des Platzhalters. Wie bei EXP-001 … 004 sind das **Näherungen**, kein Spaß-Beweis: Bots entscheiden nach festen Regeln, Minispiel-Ergebnisse sind Zufallspunkte.

**Wiederholen** (≈ 8 s):

```sh
EXPERIMENTS=m4 pnpm exec vitest run packages/game-core/src/rules/experimentsM4.test.ts --silent=false
```

- **Code:** `packages/game-core/src/rules/experimentsM4.ts` (Kennzahlen, Varianten, Tabellen), Bot-Partien in `simulate.ts`. Ohne `EXPERIMENTS=m4` läuft nur ein Smoke-Test (Teil von `pnpm test`).
- **Seeds:** 1–200 je Zeile und Spielerzahl (2, 3, 4).
- **Minispiele:** `ROTATION_SPECS` = Sockenregen (30 s), Pudding-Gerangel (30 s), Wackelturm (35 s); ein Test prüft Gleichheit mit dem Katalog (`@chaos-party/minigames/catalog`, dafür neue devDependency von game-core). game-core zieht je Runde eines ohne Wiederholung (wie im Server). Der Bot-„Host“ meldet das Ergebnis 0,5 s nach Spielende (`minigameResultDelayMs`). Punkte je Spieler gleichverteilt 0–40 (`minigameScoreSpread`), dadurch ist der 1. Platz in 2–5 % der Minispiele geteilt, wie bei den Prototypen in EXP-005 … 007 (1–15 %). Variante „Profi“: Slot 1 bekommt +10 Punkte (`minigameSkill`).
- **Dauer** = Pacing (`stepMs` 350 usw.) + Entscheidungszeit + je Runde Anleitung 7 s (seit CHAOS-66 bei Wiederholung 3 s) + Spielzeit + Ergebnis 6 s + Rundenende 1,5 s, dazu pauschal **20 s Finale** (Trophäenzählung 2,2 s + 2,8 s je Platz + 3,4 s Sieger, ggf. 2,6 s Gleichstand). Die Lobby (QR, Figuren) zählt nicht. Entscheidungstempo **flott** = Bot-Standard 0,8–2,5 s je Prompt, **gemütlich** = 1,5–4,5 s (Menschen reden, lachen, suchen das Handy). Beides sind Annahmen.
- **Neu in der Simulation:** `SimulationOptions.minigames`, `BotPolicy.minigameResultDelayMs`/`minigameScoreSpread`/`minigameSkill`, `SimulationResult.midRanking` (Wertung nach Runde ⌊n/2⌋), `minigamesPlayed`, `minigameSharedWins`, `standings[].coinsEarned`. Ohne `minigames` ändert sich nichts (Platzhalter, gleiche Zufallsfolge), EXP-001 … 004 bleiben reproduzierbar.
- **Testumgebung:** Node 22, Linux-Container, Basis-Commit `c4df936`, Ergebnisse vom Commit, der diese Einträge einführt.

---

## EXP-011: Partiedauer und Runden-Vorschläge mit echten Minispielen (2026-11-15, CHAOS-40)

**Hypothese / gewünschtes Spielerlebnis:** Die Lobby bietet drei Vorschläge, die sich wie „kurz/mittel/lang“ anfühlen: ≈ 15, 25 und 40 Minuten. Die Platzhalter 3/5/8 Runden (CHAOS-36) sind viel zu kurz, seit jede Runde ein echtes Minispiel von 30–35 s plus Anleitung und Ergebnis hat. Die Lobby-Anzeige „≈ 3 Min./Runde“ ist geraten.

**Varianten:** Rundenzahl 5, 8, 10, 12, 15, 16, 18, 20 (`MAX_ROUNDS`) × 2/3/4 Spieler × Tempo flott/gemütlich.

**Objektive Messgrößen:** Partiedauer (Mittel, p90) inkl. Finale, Minuten je Runde, Anteil der Zeit außerhalb der Brettzüge (Minispiel-Phasen, Rundenwechsel).

**Subjektive Playtest-Fragen (für Ruben):** Passen die angezeigten Minuten zur echten Partie (Stoppuhr)? Ist 10 Runden als Standard für die erste Partie richtig? Wie fühlt es sich an, dass mehr als die Hälfte der Zeit Minispiele sind?

**Testumgebung:** siehe „Gemeinsamer Aufbau“.

**Ergebnisse:**

**EXP-011 Partiedauer mit Minispiel-Rotation und Finale (Seeds 1–200 je Zeile)**

| Runden | Sp. | min flott | min gemütlich | p90 gemütlich | min/Runde gemütlich | Anteil ohne Brettzüge |
| ------ | --- | --------- | ------------- | ------------- | ------------------- | --------------------- |
| 5      | 2   | 5,8       | 6,2           | 6,4           | 1,17                | 68 %                  |
| 5      | 3   | 6,5       | 7,1           | 7,4           | 1,35                | 60 %                  |
| 5      | 4   | 7,2       | 8,0           | 8,2           | 1,53                | 54 %                  |
| 8      | 2   | 9,0       | 9,6           | 9,9           | 1,16                | 69 %                  |
| 8      | 3   | 10,1      | 11,0          | 11,4          | 1,34                | 60 %                  |
| 8      | 4   | 11,3      | 12,5          | 12,8          | 1,52                | 54 %                  |
| 10     | 2   | 11,1      | 11,9          | 12,3          | 1,16                | 69 %                  |
| 10     | 3   | 12,5      | 13,7          | 14,0          | 1,33                | 61 %                  |
| 10     | 4   | 14,0      | 15,5          | 15,8          | 1,51                | 54 %                  |
| 12     | 2   | 13,3      | 14,2          | 14,6          | 1,16                | 69 %                  |
| 12     | 3   | 15,0      | 16,4          | 16,8          | 1,34                | 60 %                  |
| 12     | 4   | 16,7      | 18,5          | 18,9          | 1,51                | 54 %                  |
| 15     | 2   | 16,5      | 17,7          | 18,1          | 1,16                | 69 %                  |
| 15     | 3   | 18,7      | 20,4          | 20,9          | 1,34                | 60 %                  |
| 15     | 4   | 20,8      | 23,0          | 23,5          | 1,51                | 54 %                  |
| 16     | 2   | 17,6      | 18,9          | 19,3          | 1,16                | 69 %                  |
| 16     | 3   | 19,9      | 21,8          | 22,2          | 1,34                | 60 %                  |
| 16     | 4   | 22,2      | 24,5          | 25,0          | 1,51                | 54 %                  |
| 18     | 2   | 19,8      | 21,2          | 21,6          | 1,16                | 69 %                  |
| 18     | 3   | 22,4      | 24,4          | 24,9          | 1,34                | 60 %                  |
| 18     | 4   | 24,9      | 27,5          | 28,1          | 1,51                | 54 %                  |
| 20     | 2   | 21,9      | 23,5          | 24,0          | 1,16                | 69 %                  |
| 20     | 3   | 24,8      | 27,1          | 27,6          | 1,34                | 60 %                  |
| 20     | 4   | 27,6      | 30,6          | 31,1          | 1,51                | 54 %                  |

- Eine Runde dauert (gemütlich) **1,16 min mit 2, 1,34 min mit 3 und 1,51 min mit 4 Spielern**, flott etwa 8–10 % weniger. Die Streuung ist klein (p90 nur ≈ 0,3–0,5 min über dem Mittel), denn die Minispiele haben feste Längen.
- **54–69 % der Partie** sind Minispiel-Phasen und Rundenwechsel (bei 2 Spielern mehr, weil es weniger Züge je Runde gibt). Je Runde sind ≈ 45–50 s fest: 7 s Anleitung, 30–35 s Spiel, 6 s Ergebnis, 1,5 s Rundenende.
- **≈ 15 min:** 10 Runden (14,0–15,5 min mit 4, 12,5–13,7 mit 3 Spielern). **≈ 25 min:** 16 Runden (22,2–24,5 mit 4, 19,9–21,8 mit 3). **≈ 40 min** bräuchte 26 (4 Spieler) bis 30 (3 Spieler) Runden, also mehr als `MAX_ROUNDS` = 20. Mit 20 Runden sind es 27,6–30,6 min (4) bzw. 24,8–27,1 min (3).
- Die bisherigen Vorschläge 3/5/8 ergeben 4–12,5 min. 3 Runden sind außerdem wertungsschwach (EXP-012).

**Entscheidung:** **keep** neue Vorschläge **10 / 16 / 20** (`DEFAULT_ROUND_PRESETS`) und Standard **10** (`DEFAULT_ROUNDS`, vorher 5) in `apps/server/src/game.ts`. Begründung für den Standard: ≈ 15 min passt zu einer Couch-Party und einer ersten Partie, jedes der drei Minispiele kommt 3–4-mal dran, und die Trophäen entscheiden in 63–81 % der Partien (EXP-012; mit 5 Runden nur 49–76 %, und ein Drittel der Spieler bleibt ohne Trophäe). „Lang“ ist 20, weil `MAX_ROUNDS` ein Protokollwert ist (v4) und 26–30 Runden mit nur drei Minispielen (je 9–10-mal) eher ermüden als Spaß machen. **Frage an Ruben:** Sind „40 min“ wirklich gewollt? Dann `MAX_ROUNDS` anheben, am besten zusammen mit mehr Minispielen. Die Lobby zeigt die Dauer jetzt nach Spielerzahl (`roundsDuration(rounds, players)` in `apps/host/src/lobby/lobbyState.ts`: 1,15/1,35/1,5 min je Runde + Finale, auf 5 min gerundet; ohne Spieler wird mit 4 gerechnet).

**Offen für Playtest:** Echte Dauer mit Stoppuhr (Menschen sind vermutlich langsamer als „gemütlich“: Erklären, Lachen, Nachfragen). Verdrängt der hohe Minispiel-Anteil das Brettspiel (VISION, Produktsäule 3)?

**Für später (CHAOS-44):** Anleitung eines schon gespielten Minispiels kürzer zeigen (spart ≈ 4 s je Runde). Längere Partien erst mit mehr Minispielen und höherem `MAX_ROUNDS`.

**Nachtrag 2026-11-17 (CHAOS-66): kurze Anleitung bei Wiederholung**

Umgesetzt: Läuft ein Minispiel in der Partie zum zweiten (oder weiteren) Mal, dauert die Anleitung **3 s statt 7 s** (`pacing.minigameRepeatIntroMs`; fehlt der Wert, gilt `minigameIntroMs`). PC und Controller zeigen dann nur Titel, „Nochmal!“, Bedienlegende (und am PC Mitspieler und Countdown); Untertitel und Anleitungsschritte entfallen. Seit CHAOS-54 sind **vier** Minispiele in der Rotation (`ROTATION_SPECS` mit Kuckucks-Klatsche), daher wiederholt sich bei 10 Runden jedes 2–3-mal.

Neu gerechnet mit `EXPERIMENTS=m4` (Seeds 1–200, gleicher Aufbau, Code `repeatIntroExperiment` in `experimentsM4.ts`). Die Spalten „voll“ simulieren dieselbe Rotation mit 7 s Anleitung bei jedem Vorkommen.

**EXP-011 Nachtrag (CHAOS-66): volle gegen kurze Anleitung bei Wiederholung, gemütlich (Seeds 1–200 je Zeile)**

| Runden | Sp. | min voll | min kurz | gespart (min) | min/Runde kurz | Anteil ohne Brettzüge voll | Anteil ohne Brettzüge kurz |
| ------ | --- | -------- | -------- | ------------- | -------------- | -------------------------- | -------------------------- |
| 10     | 2   | 11,8     | 11,4     | 0,4           | 1,11           | 69 %                       | 68 %                       |
| 10     | 3   | 13,6     | 13,2     | 0,4           | 1,29           | 60 %                       | 59 %                       |
| 10     | 4   | 15,4     | 15,0     | 0,4           | 1,46           | 54 %                       | 53 %                       |
| 16     | 2   | 18,8     | 18,0     | 0,8           | 1,10           | 69 %                       | 67 %                       |
| 16     | 3   | 21,6     | 20,8     | 0,8           | 1,28           | 60 %                       | 59 %                       |
| 16     | 4   | 24,4     | 23,6     | 0,8           | 1,46           | 54 %                       | 52 %                       |
| 20     | 2   | 23,3     | 22,3     | 1,1           | 1,10           | 69 %                       | 67 %                       |
| 20     | 3   | 26,9     | 25,8     | 1,1           | 1,27           | 60 %                       | 59 %                       |
| 20     | 4   | 30,4     | 29,4     | 1,1           | 1,45           | 54 %                       | 52 %                       |

**Aktuelle Partiedauer (Standard mit kurzer Anleitung, vier Minispiele, Seeds 1–200 je Zeile)**

| Runden | Sp. | min flott | min gemütlich | p90 gemütlich | min/Runde gemütlich | Anteil ohne Brettzüge |
| ------ | --- | --------- | ------------- | ------------- | ------------------- | --------------------- |
| 5      | 2   | 5,7       | 6,1           | 6,3           | 1,15                | 68 %                  |
| 5      | 3   | 6,4       | 7,0           | 7,2           | 1,32                | 60 %                  |
| 5      | 4   | 7,1       | 7,9           | 8,1           | 1,50                | 53 %                  |
| 8      | 2   | 8,7       | 9,3           | 9,6           | 1,12                | 68 %                  |
| 8      | 3   | 9,8       | 10,7          | 11,1          | 1,30                | 59 %                  |
| 8      | 4   | 11,0      | 12,1          | 12,5          | 1,48                | 53 %                  |
| 10     | 2   | 10,7      | 11,4          | 11,7          | 1,11                | 68 %                  |
| 10     | 3   | 12,1      | 13,2          | 13,6          | 1,29                | 59 %                  |
| 10     | 4   | 13,5      | 15,0          | 15,3          | 1,46                | 53 %                  |
| 12     | 2   | 12,7      | 13,6          | 14,0          | 1,11                | 67 %                  |
| 12     | 3   | 14,4      | 15,7          | 16,1          | 1,28                | 59 %                  |
| 12     | 4   | 16,1      | 17,8          | 18,3          | 1,46                | 53 %                  |
| 15     | 2   | 15,7      | 16,9          | 17,3          | 1,10                | 67 %                  |
| 15     | 3   | 17,8      | 19,5          | 19,9          | 1,28                | 59 %                  |
| 15     | 4   | 20,0      | 22,2          | 22,6          | 1,46                | 52 %                  |
| 16     | 2   | 16,7      | 18,0          | 18,4          | 1,10                | 67 %                  |
| 16     | 3   | 19,0      | 20,8          | 21,2          | 1,28                | 59 %                  |
| 16     | 4   | 21,3      | 23,6          | 24,2          | 1,46                | 52 %                  |
| 18     | 2   | 18,7      | 20,1          | 20,5          | 1,10                | 67 %                  |
| 18     | 3   | 21,3      | 23,3          | 23,8          | 1,28                | 59 %                  |
| 18     | 4   | 23,8      | 26,5          | 27,0          | 1,45                | 52 %                  |
| 20     | 2   | 20,7      | 22,3          | 22,7          | 1,10                | 67 %                  |
| 20     | 3   | 23,6      | 25,8          | 26,2          | 1,27                | 59 %                  |
| 20     | 4   | 26,4      | 29,4          | 29,9          | 1,45                | 52 %                  |

- Die kurze Anleitung spart **4 s je Wiederholung**: 0,4 min bei 10 Runden (6 Wiederholungen), 0,8 min bei 16 und 1,1 min bei 20 Runden. Das sind 3–4 % der Partie; der Anteil außerhalb der Brettzüge sinkt nur um 1–2 Prozentpunkte (52–68 %).
- Die Runden-Vorschläge 10/16/20 bleiben passend (≈ 15/24/29 min mit 4 Spielern). Die Lobby-Schätzung rechnet jetzt mit 1,1/1,3/1,45 min je Runde für 2/3/4 Spieler (`apps/host/src/lobby/lobbyState.ts`); 20 Runden zu zweit zeigen damit „≈ 20 Min.“ statt „≈ 25 Min.“.
- Der eigentliche Gewinn ist vermutlich nicht die Zeit, sondern dass niemand dieselbe Anleitung dreimal ganz lesen muss. Das zeigt erst der Playtest.

**Entscheidung:** **keep** 3 s kurze Anleitung bei Wiederholung (Standard `minigameRepeatIntroMs: 3000`).

**Offen für Playtest:** Reichen 3 s, um zu sehen, welches Minispiel kommt, und das Handy richtig zu halten? Vermisst jemand die Anleitung beim zweiten Mal (etwa nach langer Pause dazwischen)?

---

## EXP-012: Wertung, Gleichstandsregel, Aufholeffekt und Trophäen-Ökonomie (2026-11-15, CHAOS-40)

**Hypothese / gewünschtes Spielerlebnis:** Meistens entscheiden die Trophäen. Die Gleichstandsregel (Trophäen → Münzen → Minispiel-Siege, ADR-015) ist ein seltener, erklärbarer Sonderfall, und ein geteilter Sieg bleibt die Ausnahme. Wer zur Halbzeit führt, hat einen Vorteil, aber kein sicheres Ende („Comeback möglich“). Die Ökonomie aus EXP-002 (Preis 15, Minispiel 10/5/3/0) wurde nur mit dem Platzhalter-Minispiel und 5 Runden gemessen. Trägt sie auch längere Partien mit echter Rotation?

**Varianten:**

- Rundenzahl 3, 5, 8, 10, 16, 20 mit den Standardwerten.
- Ökonomie bei 10 und 20 Runden: A Stand, B Preis 20, C Minispiel 8/4/2/0, D Minispiel 10/6/3/1 (Trostmünze), E Preis 20 + Minispiel 12/6/3/0, S Stand mit einem Minispiel-Profi (Slot 1, +10 Punkte).

**Objektive Messgrößen:** Trophäen je Partie und des Siegers, Sieger ohne Trophäe, Spieler ohne Trophäe, womit Platz 1 entschieden wird (`decidedBy`: Trophäen, Münzen, Minispiel-Siege, geteilt), irgendein geteilter Platz, geteilter 1. Platz im Minispiel, Siegquote des alleinigen Führenden bzw. Letzten nach Runde ⌊n/2⌋ (gegen fair 1/n), Siegquote des Profis, Münzen am Ende.

**Subjektive Playtest-Fragen (für Ruben):** Versteht man am PC „Gleich viele Trophäen – die Münzen haben entschieden“? Fühlt sich ein Münz-Sieg verdient an? Ist es frustrierend, dass der Halbzeit-Führende etwa doppelt so oft gewinnt wie fair? Sind 5–6 Trophäen für den Sieger in langen Partien noch etwas Besonderes?

**Testumgebung:** siehe „Gemeinsamer Aufbau“.

**Ergebnisse:**

**EXP-012 Wertung, Gleichstand, Aufholeffekt (Standardregeln + Rotation, Seeds 1–200 je Zeile)**

| Runden | Sp. | Trophäen/Partie | Sieger-Trophäen | Sieger ohne Trophäe | Spieler ohne Trophäe | Sieg per Trophäen | per Münzen | per Minispiel-Siegen | Sieg geteilt | ein Platz geteilt | Minispiel P1 geteilt | Führender (Hälfte) gewinnt | Letzter (Hälfte) gewinnt | fair 1/n |
| ------ | --- | --------------- | --------------- | ------------------- | -------------------- | ----------------- | ---------- | -------------------- | ------------ | ----------------- | -------------------- | -------------------------- | ------------------------ | -------- |
| 3      | 2   | 0,96            | 0,80            | 26 %                | 55 %                 | 60 %              | 39 %       | 1 %                  | 0 %          | 0 %               | 2 %                  | 65 %                       | 35 %                     | 50 %     |
| 3      | 3   | 1,25            | 0,86            | 19 %                | 60 %                 | 51 %              | 48 %       | 2 %                  | 1 %          | 1 %               | 2 %                  | 40 %                       | 23 %                     | 33 %     |
| 3      | 4   | 1,39            | 0,90            | 14 %                | 66 %                 | 48 %              | 49 %       | 2 %                  | 1 %          | 5 %               | 7 %                  | 42 %                       | 10 %                     | 25 %     |
| 5      | 2   | 2,44            | 1,75            | 2 %                 | 20 %                 | 76 %              | 24 %       | 1 %                  | 0 %          | 0 %               | 2 %                  | 68 %                       | 32 %                     | 50 %     |
| 5      | 3   | 3,04            | 1,65            | 1 %                 | 26 %                 | 55 %              | 44 %       | 1 %                  | 1 %          | 1 %               | 3 %                  | 54 %                       | 18 %                     | 33 %     |
| 5      | 4   | 3,31            | 1,52            | 0 %                 | 33 %                 | 49 %              | 48 %       | 2 %                  | 2 %          | 4 %               | 5 %                  | 45 %                       | 6 %                      | 25 %     |
| 8      | 2   | 4,11            | 2,77            | 1 %                 | 10 %                 | 78 %              | 21 %       | 1 %                  | 1 %          | 1 %               | 2 %                  | 78 %                       | 22 %                     | 50 %     |
| 8      | 3   | 5,04            | 2,62            | 0 %                 | 13 %                 | 65 %              | 34 %       | 1 %                  | 1 %          | 2 %               | 3 %                  | 61 %                       | 15 %                     | 33 %     |
| 8      | 4   | 5,63            | 2,41            | 0 %                 | 17 %                 | 65 %              | 35 %       | 0 %                  | 1 %          | 2 %               | 5 %                  | 60 %                       | 10 %                     | 25 %     |
| 10     | 2   | 5,01            | 3,35            | 0 %                 | 7 %                  | 81 %              | 19 %       | 1 %                  | 0 %          | 0 %               | 2 %                  | 73 %                       | 27 %                     | 50 %     |
| 10     | 3   | 6,16            | 3,18            | 0 %                 | 10 %                 | 75 %              | 25 %       | 1 %                  | 0 %          | 0 %               | 3 %                  | 59 %                       | 10 %                     | 33 %     |
| 10     | 4   | 6,77            | 2,84            | 0 %                 | 13 %                 | 63 %              | 36 %       | 1 %                  | 1 %          | 3 %               | 5 %                  | 60 %                       | 11 %                     | 25 %     |
| 16     | 2   | 9,14            | 5,82            | 0 %                 | 1 %                  | 88 %              | 12 %       | 0 %                  | 0 %          | 0 %               | 2 %                  | 74 %                       | 26 %                     | 50 %     |
| 16     | 3   | 11,88           | 5,58            | 0 %                 | 2 %                  | 79 %              | 22 %       | 0 %                  | 0 %          | 0 %               | 3 %                  | 62 %                       | 12 %                     | 33 %     |
| 16     | 4   | 13,29           | 5,01            | 0 %                 | 2 %                  | 72 %              | 28 %       | 1 %                  | 1 %          | 1 %               | 5 %                  | 56 %                       | 7 %                      | 25 %     |
| 20     | 2   | 11,46           | 7,12            | 0 %                 | 0 %                  | 89 %              | 11 %       | 0 %                  | 0 %          | 0 %               | 2 %                  | 73 %                       | 27 %                     | 50 %     |
| 20     | 3   | 14,93           | 6,99            | 0 %                 | 1 %                  | 88 %              | 12 %       | 0 %                  | 0 %          | 0 %               | 3 %                  | 64 %                       | 11 %                     | 33 %     |
| 20     | 4   | 17,08           | 6,22            | 0 %                 | 1 %                  | 77 %              | 23 %       | 1 %                  | 0 %          | 1 %               | 5 %                  | 62 %                       | 4 %                      | 25 %     |

**EXP-012 Ökonomie-Varianten mit Rotation (Seeds 1–200 je Zeile)**

| Runden | Variante                                      | Sp. | Trophäen/Partie | Sieger-Trophäen | ohne Trophäe | Sieg per Trophäen | Führender (Hälfte) gewinnt | Siege Slot 1 | Münzen Ende |
| ------ | --------------------------------------------- | --- | --------------- | --------------- | ------------ | ----------------- | -------------------------- | ------------ | ----------- |
| 10     | A: Preis 15, Minispiel 10/5/3/0 (Stand)       | 2   | 5,01            | 3,35            | 7 %          | 81 %              | 73 %                       | 52 %         | 56,2        |
| 10     | A: Preis 15, Minispiel 10/5/3/0 (Stand)       | 3   | 6,16            | 3,18            | 10 %         | 75 %              | 59 %                       | 33 %         | 48,9        |
| 10     | A: Preis 15, Minispiel 10/5/3/0 (Stand)       | 4   | 6,77            | 2,84            | 13 %         | 63 %              | 60 %                       | 24 %         | 39,9        |
| 10     | B: Preis 20                                   | 2   | 4,37            | 2,83            | 5 %          | 79 %              | 69 %                       | 54 %         | 50,2        |
| 10     | B: Preis 20                                   | 3   | 5,41            | 2,68            | 8 %          | 70 %              | 62 %                       | 31 %         | 43,4        |
| 10     | B: Preis 20                                   | 4   | 5,74            | 2,36            | 14 %         | 55 %              | 58 %                       | 23 %         | 36,6        |
| 10     | C: Minispiel 8/4/2/0                          | 2   | 4,67            | 3,06            | 6 %          | 80 %              | 70 %                       | 51 %         | 43,4        |
| 10     | C: Minispiel 8/4/2/0                          | 3   | 5,87            | 2,88            | 8 %          | 66 %              | 65 %                       | 28 %         | 36,6        |
| 10     | C: Minispiel 8/4/2/0                          | 4   | 6,28            | 2,59            | 11 %         | 62 %              | 56 %                       | 24 %         | 31,4        |
| 10     | D: Minispiel 10/6/3/1                         | 2   | 5,09            | 3,42            | 6 %          | 81 %              | 75 %                       | 53 %         | 60,5        |
| 10     | D: Minispiel 10/6/3/1                         | 3   | 6,21            | 3,21            | 10 %         | 77 %              | 55 %                       | 32 %         | 51,9        |
| 10     | D: Minispiel 10/6/3/1                         | 4   | 6,94            | 2,92            | 14 %         | 64 %              | 57 %                       | 25 %         | 44,3        |
| 10     | E: Preis 20, Minispiel 12/6/3/0               | 2   | 4,67            | 3,12            | 6 %          | 79 %              | 69 %                       | 50 %         | 62,0        |
| 10     | E: Preis 20, Minispiel 12/6/3/0               | 3   | 5,71            | 2,83            | 9 %          | 68 %              | 68 %                       | 32 %         | 51,4        |
| 10     | E: Preis 20, Minispiel 12/6/3/0               | 4   | 6,04            | 2,52            | 13 %         | 60 %              | 57 %                       | 22 %         | 42,8        |
| 10     | S: Stand, Slot 1 Minispiel-Profi (+10 Punkte) | 2   | 4,97            | 3,29            | 6 %          | 80 %              | 76 %                       | 63 %         | 56,5        |
| 10     | S: Stand, Slot 1 Minispiel-Profi (+10 Punkte) | 3   | 6,20            | 3,10            | 9 %          | 68 %              | 62 %                       | 43 %         | 48,4        |
| 10     | S: Stand, Slot 1 Minispiel-Profi (+10 Punkte) | 4   | 6,83            | 2,93            | 13 %         | 70 %              | 64 %                       | 46 %         | 39,6        |
| 20     | A: Preis 15, Minispiel 10/5/3/0 (Stand)       | 2   | 11,46           | 7,12            | 0 %          | 89 %              | 73 %                       | 47 %         | 91,8        |
| 20     | A: Preis 15, Minispiel 10/5/3/0 (Stand)       | 3   | 14,93           | 6,99            | 1 %          | 88 %              | 64 %                       | 30 %         | 74,1        |
| 20     | A: Preis 15, Minispiel 10/5/3/0 (Stand)       | 4   | 17,08           | 6,22            | 1 %          | 77 %              | 62 %                       | 26 %         | 56,9        |
| 20     | B: Preis 20                                   | 2   | 10,60           | 6,45            | 0 %          | 87 %              | 67 %                       | 56 %         | 71,7        |
| 20     | B: Preis 20                                   | 3   | 13,30           | 5,79            | 0 %          | 76 %              | 60 %                       | 30 %         | 60,1        |
| 20     | B: Preis 20                                   | 4   | 14,63           | 5,05            | 1 %          | 65 %              | 52 %                       | 25 %         | 48,0        |
| 20     | C: Minispiel 8/4/2/0                          | 2   | 11,17           | 6,80            | 0 %          | 90 %              | 69 %                       | 50 %         | 63,5        |
| 20     | C: Minispiel 8/4/2/0                          | 3   | 13,94           | 6,26            | 1 %          | 82 %              | 63 %                       | 34 %         | 52,5        |
| 20     | C: Minispiel 8/4/2/0                          | 4   | 15,68           | 5,43            | 1 %          | 65 %              | 51 %                       | 31 %         | 41,4        |
| 20     | D: Minispiel 10/6/3/1                         | 2   | 11,61           | 7,21            | 0 %          | 91 %              | 77 %                       | 52 %         | 100,4       |
| 20     | D: Minispiel 10/6/3/1                         | 3   | 15,11           | 7,05            | 1 %          | 87 %              | 63 %                       | 31 %         | 79,9        |
| 20     | D: Minispiel 10/6/3/1                         | 4   | 17,29           | 6,34            | 1 %          | 77 %              | 63 %                       | 23 %         | 65,6        |
| 20     | E: Preis 20, Minispiel 12/6/3/0               | 2   | 11,22           | 6,89            | 0 %          | 89 %              | 71 %                       | 51 %         | 95,5        |
| 20     | E: Preis 20, Minispiel 12/6/3/0               | 3   | 13,84           | 6,30            | 1 %          | 81 %              | 61 %                       | 33 %         | 76,6        |
| 20     | E: Preis 20, Minispiel 12/6/3/0               | 4   | 15,67           | 5,58            | 1 %          | 79 %              | 49 %                       | 28 %         | 57,9        |
| 20     | S: Stand, Slot 1 Minispiel-Profi (+10 Punkte) | 2   | 11,33           | 7,04            | 0 %          | 91 %              | 74 %                       | 55 %         | 92,9        |
| 20     | S: Stand, Slot 1 Minispiel-Profi (+10 Punkte) | 3   | 14,88           | 6,72            | 0 %          | 83 %              | 67 %                       | 40 %         | 74,3        |
| 20     | S: Stand, Slot 1 Minispiel-Profi (+10 Punkte) | 4   | 16,70           | 6,13            | 1 %          | 81 %              | 58 %                       | 47 %         | 57,8        |

- **Kurze Partien tragen den Trophäen-Sieg nicht:** Bei 3 Runden hat der Sieger in 14–26 % der Partien **keine** Trophäe, 55–66 % der Spieler bleiben ohne, und die Münzen entscheiden fast jede zweite Partie. Ab 8 Runden hat praktisch jeder Sieger eine Trophäe. Bei 10 Runden bleiben 7–13 % der Spieler ohne, bei 16 nur noch 1–2 %.
- **Gleichstandsregel:** Die Münzen entscheiden Platz 1 bei 10 Runden in 19–36 % der Partien (5 Runden: 24–48 %, 20 Runden: 11–23 %), am häufigsten mit vier Spielern. **Minispiel-Siege** entscheiden nur in 0–2 %, ein **geteilter Sieg** kommt in 0–2 % vor, irgendein geteilter Platz in 0–5 %. Die dritte Stufe ist also ein seltener Notnagel: gut für die Inszenierung, kein Alltag.
- **Aufholeffekt:** Der alleinige Halbzeit-Führende gewinnt bei 10 Runden 59–73 % (fair 33–50 %), mit vier Spielern 56–62 % (fair 25 %). Der Halbzeit-Letzte gewinnt noch 10–27 % (vier Spieler: 4–11 %). Führung zählt deutlich, aber ab 8 Runden dreht sich unabhängig von der Rundenzahl noch jede dritte bis vierte Partie.
- **Ökonomie:** Preis 20 (B, E) senkt die Trophäen und erhöht die Münz-Entscheidungen (4 Spieler, 10 Runden: Sieg per Trophäen 55–60 % statt 63 %). Weniger Minispiel-Münzen (C) wirken ebenso. Die Trostmünze (D) ändert praktisch nichts. Ein Minispiel-Profi (+10 von 40 Punkten) gewinnt mit vier Spielern 46–47 % statt fair 25 %: Können in Minispielen zahlt sich aus, ohne dass das Brett egal wird.

**Entscheidung:** **keep** – Trophäenpreis 15 und Minispiel-Münzen 10/5/3/0 bleiben (`packages/game-core/src/rules/defaults.ts` unverändert). Keine Variante erhöht den Anteil der Trophäen-Siege, und die Münzen reichen auch in langen Partien (Ende Ø 40–92). Die Gleichstandsregel bleibt (ADR-015). Der wirksame Hebel ist die Rundenzahl (EXP-011: Standard 10 statt 5).

**Offen für Playtest:** Verständlichkeit und Gefühl der Münz-Entscheidung, Halbzeit-Vorteil, Wert einer Trophäe in langen Partien.

**Für später (CHAOS-44):** Aufholhilfe für die Letzten (z. B. Trophäe wandert bevorzugt vor die Hintersten), falls der Playtest den Halbzeit-Vorteil als zu stark empfindet.

**Nachtrag 2026-11-17 (CHAOS-65):** Aufholhilfen simuliert in [EXP-022](#exp-022-aufholhilfe-für-zurückliegende-2026-11-17-chaos-65). Neuer Standard: Die Trophäe wandert vor die Letzten. Neu gerechnete EXP-012-Tabellen fallen darum anders aus als oben.

---

## EXP-013: Sabotage-Häufigkeit und Item-Stärke über lange Partien (2026-11-15, CHAOS-40)

**Hypothese / gewünschtes Spielerlebnis:** Sabotage (Münzklau, Falle) sorgt für Schadenfreude und Überraschung, **ohne zu frustrieren** (VISION, Produktsäule 1). Ziel aus EXP-003: Verlust je Treffer im Mittel ≤ 25 % des Bestands. Neu für M4: Der gesamte Sabotage-Verlust bleibt ein kleiner Teil der Einnahmen, und die am stärksten getroffene Person verliert über die Partie höchstens etwa eine Trophäe (15 Münzen). Erwartung: Mit dem neuen Standard von 10 Runden und den Minispiel-Münzen werden Sabotagen relativ schwächer.

**Varianten** (10 und 20 Runden): A Klau 5/Falle 4 (Stand), B Klau 6/Falle 5 (Werte vor EXP-003), C Klau 7/Falle 5, D Münzklau-Gewicht 4 statt 3, E = B + D.

**Objektive Messgrößen:** Sabotagen je Partie und je Runde, verlorene Münzen / alle eingenommenen Münzen, Verlust je Treffer relativ zum Bestand (Mittel, p90), Münzen je Treffer, Spitzenopfer (höchster Gesamtverlust einer Person je Partie: Münzen, p90, Anteil an ihren Einnahmen), meiste Treffer auf eine Person, Trophäen je Partie.

**Subjektive Playtest-Fragen (für Ruben):** Kommt Sabotage oft genug vor, damit es sich nach Chaos anfühlt (mit vier Spielern ≈ alle 2–3 Runden)? Sind 5 geklaute Münzen witzig oder egal? Fühlt sich das Spitzenopfer gemobbt?

**Testumgebung:** siehe „Gemeinsamer Aufbau“.

**Ergebnisse:**

**EXP-013 Sabotage mit Rotation (Seeds 1–200 je Zeile)**

| Runden | Variante                               | Sp. | Sabotagen/Partie | je Runde | Verlust/Einnahmen | Verlust/Bestand | p90  | Münzen/Treffer | Spitzenopfer Münzen | p90 | Spitzenopfer/Einnahmen | max. Treffer auf einen | Trophäen |
| ------ | -------------------------------------- | --- | ---------------- | -------- | ----------------- | --------------- | ---- | -------------- | ------------------- | --- | ---------------------- | ---------------------- | -------- |
| 10     | A: Klau 5, Falle 4 (Stand)             | 2   | 1,77             | 0,18     | 3 %               | 18 %            | 36 % | 3,6            | 4,5                 | 9   | 5 %                    | 1,19                   | 5,01     |
| 10     | A: Klau 5, Falle 4 (Stand)             | 3   | 2,59             | 0,26     | 4 %               | 19 %            | 38 % | 3,8            | 6,0                 | 10  | 8 %                    | 1,49                   | 6,16     |
| 10     | A: Klau 5, Falle 4 (Stand)             | 4   | 3,94             | 0,39     | 5 %               | 20 %            | 38 % | 3,7            | 7,4                 | 12  | 11 %                   | 1,91                   | 6,77     |
| 10     | B: Klau 6, Falle 5                     | 2   | 1,76             | 0,18     | 4 %               | 22 %            | 41 % | 4,6            | 5,6                 | 11  | 6 %                    | 1,19                   | 5,02     |
| 10     | B: Klau 6, Falle 5                     | 3   | 2,60             | 0,26     | 5 %               | 24 %            | 46 % | 4,8            | 7,5                 | 12  | 10 %                   | 1,49                   | 6,13     |
| 10     | B: Klau 6, Falle 5                     | 4   | 3,94             | 0,39     | 6 %               | 25 %            | 46 % | 4,6            | 9,2                 | 15  | 14 %                   | 1,90                   | 6,74     |
| 10     | C: Klau 7, Falle 5                     | 2   | 1,76             | 0,18     | 4 %               | 24 %            | 45 % | 4,9            | 6,1                 | 12  | 7 %                    | 1,19                   | 5,02     |
| 10     | C: Klau 7, Falle 5                     | 3   | 2,61             | 0,26     | 5 %               | 26 %            | 54 % | 5,1            | 8,1                 | 14  | 10 %                   | 1,49                   | 6,13     |
| 10     | C: Klau 7, Falle 5                     | 4   | 3,96             | 0,40     | 7 %               | 26 %            | 54 % | 4,9            | 9,8                 | 15  | 15 %                   | 1,91                   | 6,78     |
| 10     | D: Münzklau-Gewicht 4                  | 2   | 1,97             | 0,20     | 3 %               | 18 %            | 33 % | 3,5            | 4,9                 | 9   | 5 %                    | 1,32                   | 4,98     |
| 10     | D: Münzklau-Gewicht 4                  | 3   | 2,87             | 0,29     | 4 %               | 19 %            | 38 % | 3,7            | 6,4                 | 10  | 8 %                    | 1,60                   | 6,09     |
| 10     | D: Münzklau-Gewicht 4                  | 4   | 4,35             | 0,43     | 6 %               | 19 %            | 38 % | 3,6            | 8,0                 | 13  | 12 %                   | 2,12                   | 6,72     |
| 10     | E: Klau 6, Falle 5, Münzklau-Gewicht 4 | 2   | 1,97             | 0,20     | 4 %               | 22 %            | 40 % | 4,5            | 6,2                 | 11  | 7 %                    | 1,32                   | 4,99     |
| 10     | E: Klau 6, Falle 5, Münzklau-Gewicht 4 | 3   | 2,88             | 0,29     | 5 %               | 23 %            | 46 % | 4,7            | 7,9                 | 12  | 10 %                   | 1,59                   | 6,04     |
| 10     | E: Klau 6, Falle 5, Münzklau-Gewicht 4 | 4   | 4,35             | 0,43     | 7 %               | 24 %            | 46 % | 4,6            | 9,9                 | 16  | 15 %                   | 2,09                   | 6,64     |
| 20     | A: Klau 5, Falle 4 (Stand)             | 2   | 3,28             | 0,16     | 3 %               | 13 %            | 25 % | 3,7            | 7,8                 | 14  | 4 %                    | 2,04                   | 11,46    |
| 20     | A: Klau 5, Falle 4 (Stand)             | 3   | 5,05             | 0,25     | 4 %               | 14 %            | 31 % | 3,8            | 10,1                | 15  | 7 %                    | 2,56                   | 14,93    |
| 20     | A: Klau 5, Falle 4 (Stand)             | 4   | 7,17             | 0,36     | 5 %               | 16 %            | 33 % | 3,7            | 11,7                | 18  | 9 %                    | 3,07                   | 17,08    |
| 20     | B: Klau 6, Falle 5                     | 2   | 3,28             | 0,16     | 4 %               | 16 %            | 32 % | 4,7            | 9,8                 | 17  | 5 %                    | 2,04                   | 11,48    |
| 20     | B: Klau 6, Falle 5                     | 3   | 5,12             | 0,26     | 5 %               | 18 %            | 38 % | 4,8            | 12,7                | 19  | 8 %                    | 2,58                   | 14,96    |
| 20     | B: Klau 6, Falle 5                     | 4   | 7,13             | 0,36     | 6 %               | 20 %            | 42 % | 4,7            | 14,7                | 22  | 11 %                   | 3,08                   | 17,06    |
| 20     | C: Klau 7, Falle 5                     | 2   | 3,28             | 0,16     | 4 %               | 18 %            | 35 % | 5,0            | 10,5                | 18  | 6 %                    | 2,04                   | 11,48    |
| 20     | C: Klau 7, Falle 5                     | 3   | 5,13             | 0,26     | 5 %               | 19 %            | 40 % | 5,1            | 13,5                | 20  | 9 %                    | 2,58                   | 14,93    |
| 20     | C: Klau 7, Falle 5                     | 4   | 7,12             | 0,36     | 6 %               | 21 %            | 44 % | 4,9            | 15,4                | 23  | 12 %                   | 3,02                   | 17,07    |
| 20     | D: Münzklau-Gewicht 4                  | 2   | 3,60             | 0,18     | 3 %               | 13 %            | 25 % | 3,7            | 8,4                 | 14  | 5 %                    | 2,21                   | 11,39    |
| 20     | D: Münzklau-Gewicht 4                  | 3   | 5,53             | 0,28     | 4 %               | 14 %            | 29 % | 3,8            | 10,9                | 15  | 7 %                    | 2,79                   | 15,02    |
| 20     | D: Münzklau-Gewicht 4                  | 4   | 7,57             | 0,38     | 5 %               | 16 %            | 33 % | 3,7            | 12,4                | 18  | 10 %                   | 3,33                   | 17,03    |
| 20     | E: Klau 6, Falle 5, Münzklau-Gewicht 4 | 2   | 3,60             | 0,18     | 4 %               | 17 %            | 31 % | 4,6            | 10,6                | 17  | 6 %                    | 2,22                   | 11,40    |
| 20     | E: Klau 6, Falle 5, Münzklau-Gewicht 4 | 3   | 5,51             | 0,28     | 5 %               | 17 %            | 35 % | 4,8            | 13,4                | 19  | 8 %                    | 2,74                   | 15,10    |
| 20     | E: Klau 6, Falle 5, Münzklau-Gewicht 4 | 4   | 7,53             | 0,38     | 6 %               | 19 %            | 42 % | 4,6            | 15,3                | 22  | 12 %                   | 3,27                   | 16,97    |

- **Häufigkeit:** 0,16–0,18 Sabotagen je Runde mit 2, 0,25–0,26 mit 3 und 0,36–0,39 mit 4 Spielern, bei 10 Runden also 1,8 / 2,6 / 3,9 je Partie. Das Münzklau-Gewicht 4 (D) bringt ≈ +10 %.
- **Stärke:** Sabotage kostet insgesamt nur **3–5 % aller eingenommenen Münzen**. Ein Treffer nimmt im Mittel 18–20 % des Bestands (p90 36–38 %) bei 10 Runden und 13–16 % bei 20 Runden, weil der Bestand mit den Minispiel-Münzen wächst. Klau 6/Falle 5 (B) liegt bei 22–25 % (p90 41–46 %), Klau 7 (C) bei 24–26 % (p90 bis 54 %).
- **Spitzenopfer:** verliert bei 10 Runden im Mittel 4,5–7,4 Münzen (p90 9–12), also weniger als eine halbe Trophäe und 5–11 % der eigenen Einnahmen; bei 20 Runden 7,8–11,7 (p90 14–18). Die meisten Treffer auf eine Person: 1,2–1,9 je 10-Runden-Partie.
- Die Trophäen je Partie ändern sich durch keine Variante messbar (± 0,1).

**Entscheidung:** **keep** Klau 5 / Falle 4 / Gewichte 3-3-3-2 (`defaults.ts` unverändert). Alle Zielwerte sind erfüllt, und nichts in den Daten zeigt Frust (kleiner Anteil am Geld, Spitzenopfer unter einer Trophäe). Ob es sich **zu zahm** anfühlt, kann nur der Playtest sagen: Die Simulation misst keine Schadenfreude. **iterate** nach dem Playtest: Ist Sabotage zu harmlos, zuerst **Klau 6 / Falle 5** (B: bleibt ab 10 Runden unter 25 % je Treffer, Spitzenopfer ≈ 9 Münzen), danach Münzklau-Gewicht 4 (D) für mehr Häufigkeit.

**Offen für Playtest:** Chaos-Gefühl gegen Frust, Häufigkeit mit 2 Spielern (nur etwa alle 6 Runden eine Sabotage).

**Für später (CHAOS-44):** Sabotage-Stärke mit der Partiedauer skalieren (z. B. Klau = 5 + Runde/5), falls lange Partien zahm wirken.

---

## EXP-014: Host-Grafik auf echter GPU – Engpass der Grafikstufen (2026-11-16, CHAOS-73)

**Hypothese / gewünschtes Spielerlebnis:** Ruben fand den Natur-Look am PC „zu langsam“. Gemessen war bisher nur SwiftShader. Annahme: Ein einzelner teurer Teil der Stufe `hoch` (Schatten, SSAO, Nachbearbeitung, Gras oder Auflösung) frisst die GPU. Ziel: Brett und Minispiele flüssig (p95 ≤ 20 ms, Ziel 60 fps) ohne sichtbaren Rückfall auf Notgrafik.

**Testumgebung:** MacBook Pro, Apple M3 Max, Chromium 153 (Playwright, **sichtbares Fenster** – headless nimmt Chromium auf dem Mac SwiftShader), ANGLE/Metal, **ohne VSync** (`--disable-gpu-vsync --disable-frame-rate-limit`), damit der Bildabstand die Kosten zeigt und nicht die 60 Hz. Brett im Demo-Modus (`/host/?local=1&board=1&demo=1&debug=1`), je Variante 9 s Anlauf, dann 4 s Messung mit `__chaosPerf`; ganze Partie mit `PERF_GPU=1 pnpm perf -g Partie` (4 Bots, Seed 2026). Varianten über einen temporären URL-Schalter je Feld der Grafikstufe (nicht eingecheckt).

**Messgrößen:** Bildabstand Median/p95, JS-Render-Zeit, Draw Calls; CPU-Profil (CDP) der Render-Schleife.

**Ergebnisse – Brett, 1920×1080, DPR 1 (Median ms):**

| Variante                                                                        | Bildabstand            | Draw Calls |
| ------------------------------------------------------------------------------- | ---------------------- | ---------- |
| `hoch` (Stand vorher)                                                           | **28**                 | 441        |
| `mittel` (vorher)                                                               | 21                     | 436        |
| `niedrig`                                                                       | 1,8                    | 269        |
| `minimal`                                                                       | 1,9                    | 265        |
| `mittel` ohne Tiefenunschärfe / ohne Bloom / Schatten 1024 / Gras 25 % / MSAA 1 | 20 / 20 / 18 / 17 / 15 | 273 … 436  |
| `mittel` ohne PCSS (PCF)                                                        | **3,7**                | 436        |
| `hoch` ohne PCSS (PCF HIGH / MEDIUM / LOW)                                      | 5,2 / 5,1 / 5,2        | 441        |
| `hoch` mit PCSS, Filterstufe MEDIUM / **LOW**                                   | 6,4 / **6,1**          | 441        |

- **Engpass:** die weichen Kontaktschatten (PCSS, `useContactHardeningShadow`) in Babylons Standard-Filterstufe `HIGH` – ≈ 23 ms je Bild auf einer M3 Max. Das CPU-Profil zeigt 54 % in `uniformMatrix4fv` und 20 % in `drawElementsInstanced` bei Render-Zeit ≈ Bildabstand: Der Befehlspuffer ist voll, JS wartet auf die GPU. Draw Calls sind auf diesem Rechner nicht der Hebel (269 Draw Calls in 1,6 ms bei `niedrig`).
- PCSS mit Filterstufe `LOW` sieht im Vergleich (Ausschnitt Figur und Felder, 1080p) praktisch gleich aus wie `HIGH` und kostet ≈ 1 ms mehr als PCF.
- **Auflösung:** 4K (1920×1080 bei DPR 2) kostet `hoch` ohne PCSS 15 ms, mit Grenze 2560×1440 noch 8,8 ms; `mittel` (Grenze 1080p) 4,0 ms, `niedrig` (1600×900) 1,9 ms.
- **Automatik:** Jede Szene baute eine neue Engine und begann wieder bei `hoch`; die erste Abstufung kam frühestens nach ≈ 7 s, Schattenart und -größe änderten sich zur Laufzeit nie. In der GPU-Partie vorher lief das Brett 74 s mit 26 ms Median.

**Ganze Partie, M3 Max, ohne VSync (Bildabstand p50 / p95 ms):**

| Szene                      | vorher 1080p          | nachher 1080p         | nachher 4K (DPR 2)    |
| -------------------------- | --------------------- | --------------------- | --------------------- |
| brett                      | 26 / 29               | 5,5 / 8,0             | 8,7 / 13,6            |
| minispiel:sockenregen      | 15 / 19               | 4,2 / 6,1             | 7,4 / 12,0            |
| minispiel:pudding-gerangel | 20 / 25               | 4,8 / 7,2             | 8,2 / 12,8            |
| minispiel:wackelturm       | 15 / 18               | 4,4 / 6,0             | 7,6 / 13,2            |
| lobby / podest             | 0,8 / 2,5 · 1,7 / 2,6 | 1,8 / 2,6 · 0,9 / 2,5 | 2,3 / 2,8 · 1,6 / 2,8 |

**Entscheidung:** keep –

1. PCSS bleibt (Look), aber immer mit Filterstufe `LOW` (`nature/lighting.ts`).
2. Jede Stufe begrenzt die Renderpixel (`maxRenderPixels`: `hoch` 2560×1440, `mittel` 1920×1080, `niedrig` 1600×900; `minimal` unverändert). Wirkt sofort, auch bei einer Abstufung mitten in der Szene.
3. Die Automatik merkt sich die erreichte Stufe für die Sitzung; Brett und Minispiele danach starten mit ihr.
4. **WebGPU** (`WebGPUEngine`) nicht gemessen: In Playwrights Chromium gibt es `navigator.gpu` nicht ohne Zusatzschalter, und der Wechsel braucht asynchronen Engine-Start und WGSL-Übersetzung an fünf Stellen. Nach dem Fund ist WebGL nicht der Engpass; WebGPU gehört in den Renderer-Spike CHAOS-75.

**Offen (nur auf echter Hardware):** Rubens PC und Fernseher (Grafikkarte, Browser, Auflösung, Bildwiederholrate), Checkliste PF0–PF10 und N1–N3. Ein Fernseher mit 30 Hz (4K über HDMI 1.4) lag dauerhaft unter 45 fps und stufte bis `niedrig` ab; seit CHAOS-76 folgt die Schwelle der erkannten Bildwiederholrate (ADR-014, Nachtrag CHAOS-76).

## EXP-015: Renderer-Alternativen – WebGPU, WebAssembly, nativ (2026-11-16, CHAOS-75)

**Hypothese / gewünschtes Spielerlebnis:** Ruben will ein flüssiges Bild am PC und Fernseher und später eine Apple TV als Host. Frage: Bringt ein anderer Renderer (Babylon mit WebGPU, Bevy als WebAssembly, Bevy nativ) bei **derselben Szene** spürbar mehr Bildrate, und welcher Weg führt zu tvOS? Erwartung nach EXP-014: Der Haupt-Engpass (PCSS) ist behoben; ein API-Wechsel spart vor allem CPU-Zeit je Draw Call, kaum GPU-Zeit.

**Varianten:**

| #   | Variante                                                   | Prototyp                                                                           |
| --- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| V1  | Babylon.js WebGL2 (heute)                                  | Spiel, `/host/?local=1&board=1&demo=1&debug=1`                                     |
| V2  | Babylon.js WebGPU, gleicher Code                           | `&gpu=webgpu` (nur Brett, WebGL2-Rückfall; `apps/host/src/scene/engineFactory.ts`) |
| V3  | Bevy 0.20.1 als WebAssembly (WebGPU bzw. WebGL2)           | `spikes/renderer-bevy`, `build-web.sh`                                             |
| V4  | Bevy 0.20.1 nativ (Metal/DX12/Vulkan)                      | `spikes/renderer-bevy`, `cargo run --release`                                      |
| V5  | Swift/RealityKit (tvOS 26), Unity 6, Godot, Babylon Native | kein Prototyp, Recherche                                                           |

**Testszene:** das echte Brett „Wackelwald“ im Beispiel-Spielstand, Stufe `hoch`, exportiert mit `node scripts/spike-export-board.mjs` (Babylon-Serializer → GLB). Umfang laut Export: 201 Meshes (176 aktiv), ≈ 500 000 Vertices, 94 Materialien, 55 Texturen; im GLB 121 Meshes, 57 Materialien, 23 Texturen (PNG); 8 Thin-Instance-Gruppen mit 64 246 Instanzen (Gras, Blumen); 4 Figuren aus den Original-GLBs mit Idle-Animation. Unterschiede der Bevy-Szene (kein HDRI-Licht, keine Nachbearbeitung, statische Bäume, `KHR_texture_transform` nur auf der Grundfarbe): [`renderer-spike.md` §4](renderer-spike.md#4-was-die-szenen-gleich-haben--und-was-nicht).

**Messgrößen:** Bildabstand Median/p95 ohne VSync (Babylon: Messanzeige bzw. `PERF_GPU=1 pnpm perf`; Bevy: `SPIKE-ERGEBNIS`-Zeile), Auflösung 1080p und 4K; dazu Aufwand, Lizenz/Kosten, Weiterverwendbarkeit von game-core, Protokoll und Controllern, tvOS-Reife. Subjektiv: sieht die Szene gleichwertig aus, Ladezeit.

**Testumgebung bisher:** nur die Cloud-Umgebung (Linux x64, 4 Kerne, 16 GB, **keine GPU**). Dort ließ sich nur bauen und funktional prüfen:

- **V2:** Typecheck, Lint, Unit-Tests grün. Die `WebGPUEngine` startet in Headless-Chromium 153 (Adapter „swiftshader“), lädt nichts vom CDN (glslang/twgsl werden nicht gebraucht), aber das Gerät geht beim ersten Zeichnen verloren („Device was destroyed“). Ein Rohtest ohne Spielcode (Canvas konfigurieren, 30× leeren) verliert das Gerät genauso, mit drei Flag-Kombinationen. → Grenze der Software-GPU, kein Befund über den Spielcode. In CI bleibt WebGPU damit unprüfbar.
- **V3 (WebAssembly):** baut in ≈ 8 min (WebGPU und WebGL2). Programm 35 MB (≈ 8 MB gzip) plus Szene ≈ 43 MB. Die **WebGL2-Fassung rendert im Headless-Chromium** (SwiftShader) dieselbe Szene: Insel, Felder, Bäume, Teich, Pokale, Wegweiser, 4 Figuren, 64 246 Gras-/Blumen-Instanzen ([Bild](screenshots/chaos75-bevy-webgl2-swiftshader.jpg); Vergleich: [`chaos62-brett-hoch.jpg`](screenshots/chaos62-brett-hoch.jpg)). Sie wirkt heller und flacher (kein HDRI, keine Nachbearbeitung). Unter WebGL2 schaltet Bevy SSAO, OIT und Compute ab und erlaubt nur **eine** Schattenkaskade. Bildabstand unter SwiftShader ≈ 6 s – nur Funktionsnachweis. Die WebGPU-Fassung ist hier nicht prüfbar (wie V2).
- **V4 (nativ):** baut in ≈ 10 min (Erst-Build). In der Cloud ließ sich weder ein Fenster (SwiftShader-Vulkan ohne X11-Oberfläche, GL-Backend nicht gebaut) noch ein Offscreen-Bild erzeugen (Bildabstände wurden gemeldet, aber kein Bild – Zahlen verworfen). Nach drei Versuchen eingestellt (Fehlerregel aus `CLAUDE.md`); das Programm ist identisch mit V3 bis auf die Plattformschicht.
- **Fehler im Spike gefunden und behoben:** Der Babylon-Serializer rechnet linkshändig → rechtshändig durch Spiegeln von **x** um, nicht von z. Mit z-Spiegelung stand die Bevy-Kamera auf der Gegenseite (Schrift spiegelverkehrt); jetzt stimmen Kamera, Licht, Figuren und Instanzen mit dem GLB überein.
- Bevy-API: zwischen den bekannten Versionen und 0.20 viele Umbenennungen (`SceneRoot` → `WorldAssetRoot`, `shadows_enabled` → `shadow_maps_enabled`, `FontSize`); glTF-Erweiterung `EXT_mesh_gpu_instancing` nicht unterstützt (Instanzen deshalb als eigene Datei).

**Ergebnisse auf echter Hardware:** Mac gemessen am 17.11. (MacBook Pro M3 Max, zwei 4K-Monitore mit 60 Hz, nichts anderes lief). PC-Zeilen R1–R6 entfallen: Ruben hat keinen PC zum Messen (17.11., CHAOS-131: „es wird nur mac geben“). Messbogen: [`renderer-spike.md`](renderer-spike.md#5-messbogen).

| #        | Kandidat, 1920×1080         | Median        | p95            | Bemerkung                                                               |
| -------- | --------------------------- | ------------- | -------------- | ----------------------------------------------------------------------- |
| R7       | Babylon `hoch`, WebGL2      | 8,4 ms        | 11,2 ms        | Render 7,8 ms, 117 fps                                                  |
| R8       | Babylon `hoch`, WebGPU      | –             | –              | nicht messbar: Das Brett zeichnet mit WebGPU nie ein Bild (siehe unten) |
| R9       | Bevy WebAssembly, WebGPU    | 12,8 ms       | 13,6 ms        | WebGL2-Fassung: 39,9 / 41,1 ms                                          |
| R10      | Bevy nativ, offscreen       | 3,8 ms        | 4,8 ms         | `niedrig`-Paar 1600×900: 2,7 / 3,3 ms                                   |
| R11 (4K) | Babylon WebGL2 / Bevy nativ | 19,3 / 7,1 ms | 27,5 / 11,1 ms | Babylon rendert bei `hoch` höchstens 2560×1440                          |

- **Babylon mit WebGL2 erreicht das Ziel am Mac klar.** Ziel ist ein Brett-p95 von höchstens 20 ms bei 1080p; gemessen sind 11,2 ms.
- **Bevy nativ ist etwa doppelt so schnell.** Es fehlen dort aber SSAO, Tiefenunschärfe, Bloom und das HDRI-Licht, der Vergleich ist also zu günstig für Bevy (§4).
- **Bevy als WebAssembly ist langsamer als Babylon.** Mit WebGPU liegt es bei 12,8 ms, mit WebGL2 sogar bei 39,9 ms.
- **R8, WebGPU-Fehler:** Mit `?gpu=webgpu` startet die WebGPU-Engine (Messanzeige „WebGPU metal-3“, Babylon-Log „WebGPU1 engine“). Das Brett zeichnet trotzdem kein Bild: keine Render-Schleife, 0 Bilder, kein Fehler in der Konsole, keine Anfragen nach außen. Vermutlich kehrt der Aufbau nie zurück (`scene.whenReadyAsync`). Ungeprüft, Folgeaufgabe angelegt. In der Cloud war dieser Fehler nicht zu sehen, weil dort das Gerät schon vorher verloren ging.
- **Bevy im Fenster** rastet auf dem 60-Hz-Monitor trotz `vsync=0` bei 16,7 ms ein. Deshalb sind die Werte offscreen gemessen (`--fenster=0`).

**Recherche (Stand 16.11.2026):**

| Thema           | Befund                                                                                                                                                      | Quelle                                                                                |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| tvOS Web        | kein öffentliches WKWebView, kein Browser; JavaScriptCore seit tvOS 9                                                                                       | developer.apple.com/documentation/webkit/wkwebview, …/javascriptcore                  |
| RealityKit tvOS | ab tvOS 26: ShaderGraph/Custom Materials, Partikel, Physik, Richtungslicht-Schatten, Skelett-Posen; USD/USDZ, glTF nur über Umwandlung; SceneKit in Wartung | developer.apple.com/documentation/realitykit, WWDC25 Session 288, Forum-Thread 831599 |
| Bevy            | 0.20.1 (28.10.2026); tvOS-Issue #13058 offen, winit 0.30 ohne tvOS (0.31 Beta); WebGPU im Browser „experimentell“                                           | crates.io, github.com/bevyengine/bevy/issues/13058, Bevy examples/README              |
| Rust tvOS       | `aarch64-apple-tvos(-sim)` Tier 2 seit Rust 1.95                                                                                                            | rust-lang/rust RELEASES.md, platform-support                                          |
| Unity 6         | tvOS offiziell (Metal); Personal frei bis 200 000 $, Splash optional (Stand 2024, 2026 unverifiziert)                                                       | docs.unity3d.com, unity.com Blog 12.09.2024                                           |
| Godot           | kein offizieller tvOS-Export (Entwurfs-PR #118332); Web ohne WebGPU                                                                                         | godot-docs, github.com/godotengine/godot/pull/118332                                  |
| Babylon Native  | kein tvOS, „public preview“                                                                                                                                 | BabylonNative README                                                                  |
| Babylon WebGPU  | Umsetzung vollständig; WGSL-Kern-Shader, glslang/twgsl nur für GLSL; Safari 26 mit WebGPU                                                                   | Babylon-Doku webGPUStatus, Safari-26-Release-Notes                                    |

**Entscheidung:** **keep Babylon.js (WebGL2)** – von Ruben am 2026-11-17 angenommen („Annehmen, PC folgt“), siehe [ADR-016](decisions/ADR-016-renderer.md).

- Am Mac erreicht Babylon das Ziel klar (R7: p95 11,2 ms bei 1080p).
- Bevy als WebAssembly ist langsamer.
- Bevy nativ ist schneller, aber ohne Nachbearbeitung. Dafür wäre der Host-Code komplett neu zu schreiben, inklusive Minispiel-Logik und Physik.
- **discard** für Bevy (WebAssembly und nativ) als Host-Renderer. Der Prototyp bleibt als Messlatte.
- **WebGPU:** bleibt Mess-Schalter. Neu bewertet wird es erst, wenn CHAOS-117 behoben ist.
- **tvOS:** eigener RealityKit-Spike CHAOS-78 (EXP-017).
- **PC-Messung entfällt (CHAOS-131, 17.11.):** Es gibt keinen PC zum Messen. Die Entscheidung stützt sich dauerhaft auf die Mac-Zeilen. R8 (WebGPU am Mac) ist seit CHAOS-117 gemessen: kein Vorteil.

**Nachtrag 2026-11-17 (CHAOS-117): Warum R8 kein Bild hatte.**

- **Ursache:** Babylons `MultiRenderTarget` registriert nur die WebGL-Variante von `createMultipleRenderTarget`. `webgpuEngine.js` lädt die WebGPU-Variante (`Engines/WebGPU/Extensions/engine.multiRender.js`) nicht mit. Ab Stufe `hoch` baut SSAO2 einen Geometriepuffer mit mehreren Renderzielen; dort bricht der Aufbau des Bretts mit `createMultipleRenderTarget is not a function` ab. Die Render-Schleife startet nie: 0 Bilder, „Schleifen 0“. `mittel`/`niedrig` brachen nicht ab, hingen aber an der zweiten Ursache (Nachtrag unten).
- **Warum „kein Fehler“:** Die Meldung kommt erst nach dem 30-s-Zeitlimit beim Himmel (zweite Ursache, Nachtrag unten; im Container zunächst fälschlich für Shader-Übersetzung gehalten) als `console.error` („Brett-Szene konnte nicht aufgebaut werden“). Der Messlauf „Partie“ gibt die Konsole der Host-Seite nicht aus.
- **Fix:** `apps/host/src/scene/engineFactory.ts` lädt die fehlende Erweiterung zusammen mit der WebGPU-Engine (`loadWebGpuEngine`). Ein Unit-Test prüft die Methoden der Mehrfach-Renderziele (`engineFactory.test.ts`; ohne Fix rot).
- **Nachgestellt im Cloud-Container:** Headless-Chromium 153 mit `--enable-unsafe-webgpu` bietet einen SwiftShader-Adapter, verliert das Gerät aber beim ersten Bild auf einem Canvas („Device was destroyed“), auch ohne Babylon. Zum Nachstellen ersetzte ein Test-Skript (nicht eingecheckt) den Canvas-Kontext durch eine gewöhnliche GPU-Textur. Damit: vor dem Fix `hoch` → Frames 0, Schleifen 0, Fehler wie oben; nach dem Fix `hoch`, `mittel`, `niedrig` und `minimal` → Schleifen 1, Bilder laufen (441 Draw Calls bei `hoch`). Bildabstände aus SwiftShader sagen nichts über echte Hardware; ein Bild ließ sich dort nicht zurücklesen.
- **Offen:** R8 (Mac) und R2 (PC) auf echter Hardware messen, dabei Aussehen mit WebGL2 vergleichen (Gerätecheckliste).

**Nachtrag 2026-11-17 abends (CHAOS-117, echte Hardware): zweite Ursache und R8.**

- **Der erste Fix reichte nicht:** Auf dem Mac (M3 Max, Chromium 153, echte GPU) zeichnete das Brett mit `?gpu=webgpu` weiter nicht, in `pnpm perf` 0 Bilder über 124 s. Nur `minimal` lief. Ab `niedrig` lädt das Brett den HDRI-Himmel.
- **Zweite Ursache:** Unter WebGPU feuert `HDRCubeTexture.onLoadObservable` nie. `loaded()` in `apps/host/src/nature/lighting.ts` wartete deshalb bis zum Zeitlimit von 30 s; dann war die Textur längst fertig, und der Aufbau ging weiter. Gemessen mit Zeitstempeln: Himmel „geladen“ genau bei 31,0 s, danach `whenReadyAsync` in 0,4 s. In der Partie wird das Brett nach jedem Minispiel neu aufgebaut, die Brettphase war meist kürzer als 30 s: deshalb nie ein Bild.
- **Fix:** `loaded()` fragt `isReady()` alle 20 ms ab, statt auf das Ereignis zu warten (Zeitlimit bleibt). Unit-Test `lighting.test.ts`. Das Brett zeichnet jetzt nach gut 2 s auf allen Stufen.
- **R8 (Mac, `hoch`, 1920×1080, ohne VSync):** WebGPU 5,7 / 17,5 ms (Median / p95), 103 fps; WebGL2 im selben Durchgang 6,6 / 8,5 ms, 147 fps. WebGPU ist im Median 14 % schneller, im p95 doppelt so langsam (Ruckler). Der Mac war durch andere Prozesse belastet (Last ≈ 7–8), beide Läufe gleich.
- **Aussehen:** Chromium zeigt unter WebGPU und WebGL2 dasselbe Brett ([WebGPU](screenshots/chaos117-brett-webgpu-mac.jpg), [WebGL2](screenshots/chaos117-brett-webgl2-mac.jpg)). Safari 26 ist ungeprüft: Die Sitzung durfte weder den Bildschirm aufnehmen noch Safari fernsteuern.
- **Entscheidung:** ADR-016 bleibt: Am Mac bringt WebGPU nicht die geforderten 20 %. Offen bleiben R2 am PC (CHAOS-131) und Safari (RS1).

---

## EXP-016: Kuckucks-Klatsche überarbeitet – Arcade nur mit Knopf A (2026-11-16, CHAOS-54)

**Anlass:** Nach M4 soll es mehr Minispiel-Vielfalt geben (CHAOS-54). Kandidaten waren die in M3 verworfenen Konzepte Kuckucks-Klatsche, Aufzieh-Takt (EXP-005), Krümel-Kehraus (EXP-006) und Geysir-Gier (EXP-007). Gewählt wurde **Kuckucks-Klatsche**, weil es als einziges Konzept nur Knopf A braucht. Das ist eine neue Bedienung in der Rotation und ideal für die kleinen Zonen am geteilten iPad (EXP-005: „sehr gut: ein großer Knopf“). Physik ist mit Pudding-Gerangel besetzt und Push-your-luck mit Wackelturm (Turmhöhe). Ein zweites Spiel derselben Art hätte weniger Vielfalt gebracht als eine neue Bedienung.

**Hypothese / gewünschtes Spielerlebnis:** Ein Reflexspiel nur mit A wird fair und spannend, wenn es kein Wettrennen um den schnellsten Finger ist. Jede Person bekommt ihre eigenen Signale. Geschwindigkeit entscheidet nur noch darüber, wer einen verschlafenen Kuckuck klauen darf. Die Erwartung vorher: Schwächere gewinnen deutlich öfter als in B1/B2 (0 %), es gibt laufend etwas zu tun (B: 1,7 Drücke je 10 s), und Dauerdrücken lohnt sich nicht.

**Was aus EXP-005 … EXP-007 übernommen wurde:**

- _EXP-005, B:_ 90 % Wartezeit, Sieg der schnellsten Finger, bis 32 % Gleichstand → eigene Türen statt einer Uhr, Punkte für alle statt nur für den Schnellsten, mehr Ereignisse.
- _EXP-005, A:_ sichtbare Endphase (Schleudergang) erzeugt Spannung → „Mitternacht“: in den letzten 8 s öffnen die Türen doppelt so oft. Unsichtbares Gummiband (A5) ohne Wirkung → kein verdeckter Aufholmechanismus.
- _EXP-007:_ dominante Strategien mit dem Eindringling-Test suchen (Dauerklatscher, Raffzahn, brav). Höchstens 3 Anleitungszeilen und wenige Begriffe (hier 4: Tür, Gong, Finte, benommen).

**Regeln (gewählte Fassung K2, `KUCKUCK_RULES` in `packages/minigames/src/kuckucks-klatsche/logic.ts`):**

- Jede Person hat eine runde Tür in ihrer Farbe mit ihrem Symbol. Die Tür rappelt 0,35 s, dann springt etwas heraus.
- **Kuckuck:** 0,8 s lang darf nur die Besitzerin klatschen (+2). Danach Gong (weißer Ring): 0,9 s lang darf jeder (Erster bekommt ihn; Besitzerin +1, Klau +1). Sonst entwischt er.
- **Finte** (28 %, Gummiente, Socke, Blume): wer bei der eigenen Finte klatscht, verliert 1 Punkt (nie unter 0) und ist benommen.
- **Leerklatscher:** Ein Druck ohne Ziel (Tür zu, rappelt noch, fremder Kuckuck vor dem Gong) macht 1,0 s benommen. Benommen zählt kein Druck.
- Ein Druck trifft zuerst die eigene Tür, sonst den am längsten freigegebenen fremden Kuckuck.
- Pausen zwischen zwei Öffnungen 0,9–2,3 s, zu Mitternacht (letzte 8 s) halb so lang. Spielzeit 30 s.

**Varianten:** B1/B2 (alter Prototyp aus EXP-005) und A4* (Sockenregen, echte Logik) als Messlatten. K1–K8 laufen auf der **echten Spiellogik**, die Varianten sind Regel-Sätze:

- K1: eigene Türen, Gong-Klau, Leerklatscher, ohne Mitternacht
- **K2: K1 + Mitternacht (gewählt)**
- K3/K4: eigenes Fenster 0,6 s bzw. 1,0 s statt 0,8 s
- K5: ohne Klauen (nach dem Gong nur noch die Besitzerin, +1)
- K6: Benommenheit 0,7 s (erste Fassung), K7: ohne Benommenheit
- K8: Finten-Beutel (je Tür genau 2 Finten in 7 Öffnungen, gleich viele Chancen für alle)

**Objektive Messgrößen:** wie EXP-005 (Punkte des Siegers, Abstand Platz 1–2, Gleichstand, Führungswechsel, Comeback, Siegquote Profi und Neuling, knappe Besetzungen Gut gegen Normal und 4× Normal, Drücke je 10 s). Dazu Klau, Finten und Leerklatscher je Runde sowie der Eindringling-Test aus EXP-007: Eine Strategie spielt gegen zwei normale Bots (3 Spieler, alle mit Profil Normal, Platz reihum). Faktor > 1 heißt, die Strategie schlägt die normale Spielweise.

**Bots:** Profile aus EXP-005 (Profi, Gut, Normal, Neuling; Annahmen, nicht gemessen). Sie sehen nur, was ein Mensch am Fernseher sieht: welche Tür rappelt, was herausspringt, den Gong, ob ein Kuckuck schon weg ist. Ungeduld (`falseStart`) führt zu Vorausdrücken und Finten-Klatschern, Aussetzer (`lapse`) zum Verschlafen. Ob jemand klaut, steuert `judgement` (Strategie „normal“). Ist das Ziel schon weg, bremst ein Bot mit Wahrscheinlichkeit `judgement`. Wer benommen ist, drückt danach meist gleich noch einmal. Strategien: _brav_ klaut nie, _Raffzahn_ klaut alles, _Dauerklatscher_ drückt stur alle 0,22 s.

**Testumgebung:** Node 22, Vitest, Linux-Container, Basis-Commit `5fdd6e8`, Ergebnisse vom Commit, der diesen Eintrag einführt. Fester Schritt 1/60 s, Seeds 1–300 je Zeile. Laufzeit ≈ 20 s:

```sh
EXPERIMENTS=1 pnpm exec vitest run packages/minigames/src/prototypes/arcade/experimentKuckuck --silent=false
```

Code: `packages/minigames/src/prototypes/arcade/kuckucksKlatscheBot.ts` (Bots für die echte Logik), `experimentKuckuck.ts` (Varianten und Tabellen). Ohne `EXPERIMENTS=1` läuft nur ein Smoke-Test (Teil von `pnpm test`). Rauschen: Bei 300 Seeds liegt der Standardfehler einer Quote um 50 % bei ≈ 3 Prozentpunkten, der eines Siegfaktors bei ≈ 0,08.

**Ergebnisse:**

**EXP-016 Kuckucks-Klatsche neu gegen alt (30 s, Seeds 1–300 je Zeile)**

| Variante                                    | Sp. | Punkte P1 | Abstand 1–2 | Gleichstand P1 | Führungswechsel | Comeback | Siege Profi | Siege Neuling | fair | Drücke/10 s | Klau/Runde | Finten/Runde | Leer/Runde |
| ------------------------------------------- | --- | --------- | ----------- | -------------- | --------------- | -------- | ----------- | ------------- | ---- | ----------- | ---------- | ------------ | ---------- |
| B1: alt: eine Uhr, Schnellster +1           | 2   | 4,8       | 98 %        | 0 %            | 0,0             | 0 %      | 100 %       | 0 %           | 50 % | 1,7         | –          | –            | –          |
| B1: alt: eine Uhr, Schnellster +1           | 3   | 4,5       | 91 %        | 1 %            | 0,1             | 5 %      | 99 %        | 0 %           | 33 % | 1,7         | –          | –            | –          |
| B1: alt: eine Uhr, Schnellster +1           | 4   | 3,7       | 67 %        | 9 %            | 0,3             | 13 %     | 89 %        | 0 %           | 25 % | 1,7         | –          | –            | –          |
| B2: alt: eine Uhr, 2 / Rest 1               | 2   | 9,7       | 62 %        | 0 %            | 0,1             | 1 %      | 100 %       | 0 %           | 50 % | 1,7         | –          | –            | –          |
| B2: alt: eine Uhr, 2 / Rest 1               | 3   | 9,4       | 48 %        | 1 %            | 0,2             | 6 %      | 99 %        | 0 %           | 33 % | 1,7         | –          | –            | –          |
| B2: alt: eine Uhr, 2 / Rest 1               | 4   | 8,7       | 32 %        | 10 %           | 0,3             | 13 %     | 88 %        | 0 %           | 25 % | 1,7         | –          | –            | –          |
| K1: eigene Türen, Gong-Klau, Leerklatscher  | 2   | 18,3      | 32 %        | 5 %            | 1,6             | 17 %     | 80 %        | 20 %          | 50 % | 3,2         | 0,8        | 1,4          | 1,0        |
| K1: eigene Türen, Gong-Klau, Leerklatscher  | 3   | 19,2      | 20 %        | 9 %            | 2,8             | 26 %     | 65 %        | 12 %          | 33 % | 3,2         | 1,5        | 2,2          | 2,1        |
| K1: eigene Türen, Gong-Klau, Leerklatscher  | 4   | 20,2      | 16 %        | 10 %           | 3,7             | 35 %     | 47 %        | 10 %          | 25 % | 3,2         | 1,9        | 2,6          | 3,3        |
| K2: K1 + Mitternacht (gewählt)              | 2   | 20,3      | 34 %        | 5 %            | 1,7             | 19 %     | 84 %        | 16 %          | 50 % | 3,5         | 0,8        | 1,6          | 1,0        |
| K2: K1 + Mitternacht (gewählt)              | 3   | 21,5      | 22 %        | 7 %            | 2,9             | 32 %     | 65 %        | 9 %           | 33 % | 3,6         | 1,6        | 2,5          | 2,3        |
| K2: K1 + Mitternacht (gewählt)              | 4   | 22,1      | 15 %        | 11 %           | 3,9             | 39 %     | 51 %        | 8 %           | 25 % | 3,6         | 2,0        | 3,1          | 3,6        |
| K3: K2, eigenes Fenster 0,6 s               | 2   | 20,5      | 44 %        | 1 %            | 1,3             | 11 %     | 93 %        | 7 %           | 50 % | 3,7         | 1,1        | 1,6          | 2,0        |
| K3: K2, eigenes Fenster 0,6 s               | 3   | 21,2      | 25 %        | 6 %            | 2,5             | 25 %     | 72 %        | 5 %           | 33 % | 3,8         | 1,9        | 2,7          | 3,9        |
| K3: K2, eigenes Fenster 0,6 s               | 4   | 22,3      | 18 %        | 7 %            | 3,8             | 41 %     | 58 %        | 1 %           | 25 % | 3,9         | 2,8        | 3,4          | 5,8        |
| K4: K2, eigenes Fenster 1,0 s               | 2   | 20,6      | 33 %        | 6 %            | 1,6             | 20 %     | 81 %        | 20 %          | 50 % | 3,4         | 0,8        | 1,4          | 0,8        |
| K4: K2, eigenes Fenster 1,0 s               | 3   | 21,0      | 20 %        | 8 %            | 2,8             | 36 %     | 62 %        | 15 %          | 33 % | 3,5         | 1,4        | 2,3          | 1,9        |
| K4: K2, eigenes Fenster 1,0 s               | 4   | 22,2      | 15 %        | 12 %           | 3,8             | 40 %     | 46 %        | 5 %           | 25 % | 3,5         | 1,9        | 3,0          | 2,8        |
| K5: K2 ohne Klauen                          | 2   | 19,5      | 31 %        | 4 %            | 1,7             | 25 %     | 81 %        | 19 %          | 50 % | 3,5         | 0,0        | 1,5          | 1,6        |
| K5: K2 ohne Klauen                          | 3   | 20,0      | 20 %        | 7 %            | 3,0             | 38 %     | 57 %        | 16 %          | 33 % | 3,6         | 0,0        | 2,6          | 3,9        |
| K5: K2 ohne Klauen                          | 4   | 20,8      | 14 %        | 14 %           | 3,4             | 35 %     | 38 %        | 10 %          | 25 % | 3,7         | 0,0        | 3,3          | 6,1        |
| K6: K2, benommen nur 0,7 s (erste Fassung)  | 2   | 20,4      | 33 %        | 5 %            | 1,7             | 20 %     | 83 %        | 17 %          | 50 % | 3,5         | 0,8        | 1,6          | 1,0        |
| K6: K2, benommen nur 0,7 s (erste Fassung)  | 3   | 21,5      | 22 %        | 9 %            | 2,9             | 33 %     | 65 %        | 9 %           | 33 % | 3,6         | 1,4        | 2,5          | 2,2        |
| K6: K2, benommen nur 0,7 s (erste Fassung)  | 4   | 22,1      | 15 %        | 13 %           | 4,1             | 45 %     | 47 %        | 8 %           | 25 % | 3,6         | 1,9        | 3,0          | 3,3        |
| K7: K2 ohne Benommenheit                    | 2   | 20,6      | 33 %        | 6 %            | 1,7             | 20 %     | 84 %        | 17 %          | 50 % | 3,5         | 0,8        | 1,6          | 1,0        |
| K7: K2 ohne Benommenheit                    | 3   | 21,4      | 21 %        | 9 %            | 2,9             | 34 %     | 63 %        | 10 %          | 33 % | 3,6         | 1,3        | 2,5          | 2,2        |
| K7: K2 ohne Benommenheit                    | 4   | 22,3      | 16 %        | 11 %           | 4,0             | 41 %     | 49 %        | 7 %           | 25 % | 3,6         | 1,7        | 3,1          | 3,4        |
| K8: K2 mit Finten-Beutel (2 je 7 Öffnungen) | 2   | 19,3      | 30 %        | 2 %            | 1,8             | 14 %     | 95 %        | 5 %           | 50 % | 3,5         | 0,8        | 1,7          | 1,1        |
| K8: K2 mit Finten-Beutel (2 je 7 Öffnungen) | 3   | 20,0      | 18 %        | 7 %            | 3,4             | 28 %     | 83 %        | 4 %           | 33 % | 3,6         | 1,5        | 2,6          | 2,3        |
| K8: K2 mit Finten-Beutel (2 je 7 Öffnungen) | 4   | 20,2      | 11 %        | 13 %           | 4,7             | 48 %     | 68 %        | 2 %           | 25 % | 3,6         | 2,0        | 3,1          | 3,6        |
| A4*: Sockenregen (Messlatte)                | 2   | 32,2      | 36 %        | 1 %            | 1,3             | 8 %      | 95 %        | 5 %           | 50 % | 22,6        | –          | –            | –          |
| A4*: Sockenregen (Messlatte)                | 3   | 24,9      | 28 %        | 5 %            | 2,0             | 20 %     | 85 %        | 2 %           | 33 % | 22,0        | –          | –            | –          |
| A4*: Sockenregen (Messlatte)                | 4   | 20,5      | 24 %        | 7 %            | 2,6             | 32 %     | 70 %        | 3 %           | 25 % | 21,3        | –          | –            | –          |

**EXP-016 Knappe Besetzungen (Seeds 1–300)**

| Variante                                    | Duell: Siege Normal | Duell: Gleichstand | Duell: Führungswechsel | 4× Normal: Abstand 1–2 | 4× Normal: Gleichstand P1 | 4× Normal: Führungswechsel | 4× Normal: Comeback |
| ------------------------------------------- | ------------------- | ------------------ | ---------------------- | ---------------------- | ------------------------- | -------------------------- | ------------------- |
| B1: alt: eine Uhr, Schnellster +1           | 15 %                | 7 %                | 0,3                    | 40 %                   | 32 %                      | 0,6                        | 35 %                |
| B2: alt: eine Uhr, 2 / Rest 1               | 15 %                | 8 %                | 0,3                    | 17 %                   | 27 %                      | 0,6                        | 34 %                |
| K1: eigene Türen, Gong-Klau, Leerklatscher  | 42 %                | 7 %                | 1,8                    | 14 %                   | 12 %                      | 3,6                        | 38 %                |
| K2: K1 + Mitternacht (gewählt)              | 40 %                | 7 %                | 2,1                    | 15 %                   | 9 %                       | 3,9                        | 37 %                |
| K3: K2, eigenes Fenster 0,6 s               | 36 %                | 7 %                | 1,9                    | 15 %                   | 9 %                       | 4,1                        | 43 %                |
| K4: K2, eigenes Fenster 1,0 s               | 39 %                | 7 %                | 2,0                    | 15 %                   | 9 %                       | 3,6                        | 35 %                |
| K5: K2 ohne Klauen                          | 44 %                | 6 %                | 2,1                    | 15 %                   | 11 %                      | 3,7                        | 38 %                |
| K6: K2, benommen nur 0,7 s (erste Fassung)  | 39 %                | 8 %                | 2,0                    | 14 %                   | 12 %                      | 3,9                        | 40 %                |
| K7: K2 ohne Benommenheit                    | 41 %                | 8 %                | 2,0                    | 14 %                   | 10 %                      | 3,8                        | 38 %                |
| K8: K2 mit Finten-Beutel (2 je 7 Öffnungen) | 33 %                | 10 %               | 3,0                    | 8 %                    | 21 %                      | 5,3                        | 51 %                |
| A4*: Sockenregen (Messlatte)                | 34 %                | 4 %                | 2,5                    | 17 %                   | 10 %                      | 3,0                        | 49 %                |

**EXP-016 Eindringling gegen 2× normal (3 Sp., alle Profil Normal, Siegfaktor; 1,00 = fair; Seeds 1–300)**

| Variante                                    | normal | brav (klaut nie) | Raffzahn (klaut alles) | Dauerklatscher |
| ------------------------------------------- | ------ | ---------------- | ---------------------- | -------------- |
| K1: eigene Türen, Gong-Klau, Leerklatscher  | 1,01   | 0,81             | 1,09                   | 0,41           |
| K2: K1 + Mitternacht (gewählt)              | 0,98   | 0,83             | 1,02                   | 0,55           |
| K3: K2, eigenes Fenster 0,6 s               | 1,04   | 0,88             | 1,17                   | 0,29           |
| K4: K2, eigenes Fenster 1,0 s               | 1,02   | 0,92             | 1,13                   | 0,85           |
| K5: K2 ohne Klauen                          | 1,00   | 1,02             | 1,00                   | 0,42           |
| K6: K2, benommen nur 0,7 s (erste Fassung)  | 1,01   | 0,86             | 1,04                   | 1,06           |
| K7: K2 ohne Benommenheit                    | 1,05   | 0,96             | 1,13                   | 1,88           |
| K8: K2 mit Finten-Beutel (2 je 7 Öffnungen) | 0,92   | 0,82             | 0,98                   | 0,32           |

**Auswertung:**

- **Gegenüber der alten Fassung:** Der Neuling gewinnt gegen den Profi jetzt 16 % (2 Sp.) bzw. 8–9 % (3/4 Sp.) statt nie. Im knappen Duell gewinnt Normal gegen Gut 40 % statt 15 %, mehr als bei Sockenregen (34 %). Es gibt 1,7–3,9 Führungswechsel statt 0–0,3, und unter vier gleich Starken sinken die Gleichstände von 27–32 % auf 9 %. Je Person und 10 s kommen 3,6 Drücke statt 1,7. Das bleibt ein Reflexspiel und ist ruhiger als Sockenregen (22 Aktionen), aber man wartet nicht mehr 90 % der Zeit.
- **Woher die Chancen kommen:** Vor allem vom **Türglück**. Jede Tür würfelt ihre Finten und Pausen selbst, also bekommt mal die eine, mal die andere Person mehr echte Kuckucke. K8 (Finten-Beutel, gleich viele Chancen für alle) nimmt dieses Glück weg. Der Neuling gewinnt dann nur noch 2–5 %, der Profi 68–95 %, und unter gleich Starken verdoppeln sich die Gleichstände (9 % → 21 %). Mit dem Beutel wird die Wertung strenger, aber nicht fairer.
- **Fenster der Besitzerin:** 0,6 s (K3) bestraft langsame Reaktion zu stark (Neuling 1–7 %). 1,0 s (K4) hilft dem Neuling bei 2–3 Spielern (15–20 %), lässt aber Dauerklatschen fast aufholen (0,85). 0,8 s ist der Kompromiss.
- **Klauen (K5):** Ohne Klauen ist das Spiel etwas fairer für Schwache (10–19 %), aber es gibt keine Interaktion. Man spielt dann nur noch neben-, nicht gegeneinander. Das war in EXP-005 der Hauptgrund gegen C. Mit Klauen gibt es 0,8–2 Klau-Momente je Runde, sichtbar als fliegende Klatsche. „Brav“ (nie klauen) fällt auf 0,83 und „Raffzahn“ steigt nur auf 1,02: Klauen lohnt sich, dominiert aber nicht.
- **Benommenheit gegen Dauerdrücken:** Ohne Benommenheit (K7) gewinnt der Dauerklatscher fast doppelt so oft wie fair (1,88). Mit 0,7 s (K6, erste Fassung) liegt er noch bei 1,06. Erst 1,0 s macht Dauerdrücken klar schlechter (0,55), ohne die übrigen Kennzahlen zu verschieben. Der Grund: Benommen bleibt der Dauerklatscher fast immer und trifft den eigenen Kuckuck dann oft erst nach dem Gong. Fast jede eigene Finte erwischt er.
- **Mitternacht (K2 gegen K1):** Am Ende kommen mehr Ereignisse, die Comebacks steigen leicht (4 Sp.: 35 % → 39 %), und es gibt etwas mehr Führungswechsel. Der Neuling verliert bei 2 Spielern ein paar Punkte (20 % → 16 %, nahe am Rauschen). Behalten als sichtbares Finale, wie der Schleudergang bei Sockenregen.
- **Ein einzelner Lauf ist kein Beleg.** Im headless Test (`kuckucksKlatsche.test.ts`) schlägt der Dauerklatscher einzelne Spieler, wenn eine dritte Person gar nicht drückt. Die verschlafenen Kuckucke klaut dann fast nur er. Das ist am echten Tisch selten und zeigt sich nur über viele Seeds.

**Entscheidung:** **keep K2** als „Kuckucks-Klatsche“ (`kuckucks-klatsche`, Arcade, 30 s, nur A, ohne Physik), in Katalog und Rotation.

- **Gründe:** Neue Bedienung (nur A) für mehr Vielfalt und für die iPad-Zonen. Echte Chancen für Schwächere, mehr als bei jedem anderen Arcade-Konzept. Interaktion durch Klauen ohne Wettrennen-Zwang. Keine dominante Strategie. 3 Anleitungszeilen mit 4 Begriffen.
- **Rotation:** Es sind jetzt vier Minispiele; bei 10 Runden kommt jedes 2–3-mal statt 3–4-mal (EXP-011: Wiederholung war ein Kritikpunkt). Kuckucks-Klatsche dauert 30 s wie Sockenregen; die Partiedauer aus EXP-011 ändert sich dadurch kaum.
- **discard:** K8 (Beutel: weniger Chancen, mehr Gleichstand), K3 (zu streng), K6/K7 (Dauerdrücken lohnt). K4 und K5 bleiben Stellschrauben, falls der Playtest es verlangt (`ownS`, `steal`).

**Umsetzung:** `packages/minigames/src/kuckucks-klatsche/` (`logic.ts` rein, `index.ts` Babylon-Ansicht mit Natur-Look, `highlights.ts`, Tests). Die Logik gibt Ereignisse aus (`drainEvents`), daraus macht die Ansicht Ton, Effekte und Animationen. Belegbild: `docs/screenshots/chaos54-kuckucks-klatsche.jpg` (4 Spieler, Orange klatscht, Blau verpasst das eigene Fenster: weißer Gong-Ring). Vorschau: `/host/?local=1&minigame=kuckucks-klatsche&players=4`.

**Offen für Playtest (Ruben, Gerätecheckliste P6a):**

1. Findet jede Person ihre Tür sofort (Farbe + Symbol über der Tür, Figur daneben)?
2. Unterscheidet man auf Sofa-Abstand den Kuckuck von Ente, Socke und Blume? Ist die Finte witzig oder gemein?
3. Wird der weiße Gong-Ring als „jetzt darf jeder“ verstanden? Fühlt sich Klauen witzig an?
4. Fühlt sich Türglück („bei mir kam kaum was“) unfair an? Falls ja: Beutel (K8) erneut abwägen, obwohl er Schwächeren schadet.
5. Ist 1 s Benommenheit nach einem Leerklatscher die richtige Härte, und merkt man, warum man benommen ist (Sterne, „benommen“ im HUD)?
6. Reicht der große A-Knopf in der 4er-Zone am iPad? Ist das Spiel mit 30 s zu lang für reines Klatschen?
7. Die Bot-Profile sind Annahmen. Echte Reaktionszeiten (CHAOS-49) können die Fenster verschieben.

**Für später:** Die übrigen verworfenen Konzepte (Aufzieh-Takt, Krümel-Kehraus, Geysir-Gier) → CHAOS-79.

---

## EXP-017: Native RealityKit-App für macOS, tvOS (und iPhone/iPad als Benchmark) (2026-11-16, CHAOS-78)

**Hypothese / gewünschtes Spielerlebnis:** Ruben will das Spiel am Fernseher über eine Apple TV und wünscht sich native Apps („native Mac App, iPad App, iOS App und TV App“). Frage: Schafft RealityKit dieselbe Testszene wie EXP-015 flüssig auf Apple-Geräten, und wie groß ist der Bruch zum Babylon-Host? Erwartung: RealityKit hält 60 Hz auf der Apple TV, braucht aber einen zweiten Renderer und verliert Teile des Looks.

**Rahmen:** Die Produktsäule bleibt unverändert: Server und Spiel laufen auf PC/Mac, iPhone/iPad sind Controller. Die iOS/iPadOS-Ziele der App sind **nur Renderer-Benchmark**. tvOS ist Kandidat für eine reine Host-Anzeige (ADR-016, Server-Variante 1); die Entscheidung über CHAOS-74 liegt bei Ruben.

**Varianten:**

| #   | Variante                                                 | Prototyp                                                                              |
| --- | -------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| V6  | RealityKit `ARView` (vsync) auf macOS, iPadOS, tvOS      | `spikes/renderer-realitykit`, ein xcodegen-Ziel für drei Plattformen, Deployment 26.0 |
| V7  | RealityKit `RealityRenderer` offscreen (`--durchsatz=1`) | gleiche App, nur macOS gemessen                                                       |

**Testszene:** wie EXP-015, aus dem GLB-Export mit Blender (`bpy==5.3.0`) nach USDZ umgewandelt (`convert/convert.sh`, ≈ 40 s, `usdchecker` grün). 64 246 Gras-/Blumen-Instanzen als echtes GPU-Instancing (`MeshInstancesComponent`, `LowLevelInstanceData`, ab 26.0 auf allen drei Plattformen), 4 Figuren mit Idle-Clip, Kamera/Sonne aus `brett.szene.json`, Himmel als Verlaufs-IBL.

**Messgrößen:** Bildabstand Median/p95 (`SPIKE-ERGEBNIS`, gleiche Schlüssel wie Bevy), sichtbare Gleichheit zum Babylon-Bild, Aufwand.

**Ergebnisse (16.11.2026, MacBook Pro M3 Max, 120 Hz; vorläufig, weil GeForce NOW parallel lief):**

| Pfad                                               | Auflösung             | gras | Schatten | Median                    | p95                                  |
| -------------------------------------------------- | --------------------- | ---- | -------- | ------------------------- | ------------------------------------ |
| ARView (vsync), 17.11. ohne Störung, 60-Hz-Monitor | 1920×1080             | 1    | an       | 16,68 ms (60 fps, Deckel) | 17,8 ms; **GPU 6,3 ms**, p95 9,4 ms  |
| ARView (vsync), 17.11., 4K                         | 3840×2160             | 1    | an       | 16,68 ms (60 fps, Deckel) | 17,9 ms; **GPU 7,3 ms**, p95 13,1 ms |
| offscreen, 17.11.                                  | 1920×1080 / 3840×2160 | 1    | an       | 16,6 / 49,6 ms            | 33,5 / 50,9 ms                       |
| ARView (vsync), 16.11. vorläufig                   | 1920×1080             | 1    | an       | 8,30 ms                   | 17,0 ms                              |
| offscreen, nacheinander                            | 1920×1080             | 1    | an       | 16,8–21,3 ms              | 23–40 ms                             |
| offscreen                                          | 1920×1080             | 0,25 | an       | 15,6 ms                   | 31,7 ms                              |
| offscreen                                          | 1920×1080             | 1    | aus      | 13,6 ms                   | 20,1 ms                              |

- Die ARView hält im Median 120 Hz, das p95 zeigt einzelne verpasste Bilder; Reserve über 120 Hz unbekannt. Weitere ARView-Läufe waren ungültig, weil macOS das verdeckte Fenster auf ≈ 10 Hz drosselte.
- Offscreen-Werte warten jedes Bild ab (kein Pipelining) und sind deshalb **nicht** mit Bevy `vsync=0` vergleichbar. Nur „Schatten aus“ hebt sich vom Rauschen ab.
- RealityKit selbst liefert unter macOS keine GPU-Zeit (`__frameTime()` = 0). Auf Geräten liefert sie der Metal-Performance-HUD (`MTL_HUD_ENABLED=1`, `MTL_HUD_LOG_ENABLED=1` per `devicectl --environment-variables`), siehe README.
- **Simulatoren (keine Messungen):** iPhone 17 Pro, iPad (A16) 2360×1640 und Apple TV 4K (3. Gen., tvOS 27) 3840×2160 zeigen die volle Szene bei 60 Hz ([Mac](screenshots/chaos78-realitykit-macos.jpg), [iPad-Sim](screenshots/chaos78-realitykit-ipad-sim.jpg), [iPhone-Sim](screenshots/chaos78-realitykit-iphone-sim.jpg), [tvOS-Sim](screenshots/chaos78-realitykit-tvos-sim.jpg)).
- **iPhone 16 Pro (echtes Gerät, nur Benchmark, kein Host):** volle Szene bei nativer Auflösung 2622×1206, Median 16,68 ms, p95 17,4 ms, max 20,6 ms, 60,0 fps über 30 s (zwei Läufe gleich). Die ARView bleibt bei 60 Hz, auch mit `--bildrate=120` und `CADisableMinimumFrameDurationOnPhone`; die Reserve darüber ist unbekannt. Weil das iPhone (A18 Pro) eine stärkere GPU hat als die Apple TV 4K (A15), ist das nur ein Hinweis, kein Ersatz für R12.
- **Echte Apple TV 4K (3. Gen., A15), 17.11., Ausgabe 4K/60 Hz:** volle Szene läuft stabil, aber mit **20 fps** (Median 51,1 ms, p95 59,4 ms). Der Metal-HUD zeigt 34,7 ms GPU-Zeit je Bild: knapp über der 30-fps-Grenze (33,3 ms), weit weg von 60 fps (16,7 ms). Gras aus und Schatten aus ändern nichts (34,7–34,8 ms). Offscreen hängt die Bildzeit stark an der Auflösung (4K 117 ms, 1080p 42 ms, 720p 33 ms, jeweils MSAA 4×, nacheinander gemessen). → Die Apple TV ist bei 4K pixelgebunden. Eine 1080p-Ausgabe entfällt: Ruben bleibt bei 4K (17.11.). Das iPhone 16 Pro (A18 Pro) hält bei 2622×1206 60 fps; die Apple TV liegt bei 4K weit dahinter.

**Befunde unterwegs:**

- RealityKit ignoriert Vertexfarben, solange ein Material gebunden ist (auch `UsdPrimvarReader`). Der Konverter backt die Materialfarbe in die Vertexfarbe und entfernt das Material: Farben stimmen, aber Rauheit, Clearcoat, Sheen und Leuchten (Gesichter der Figuren) fallen weg.
- Himmelskuppeln und Dunst kommen aus dem Babylon-Export als schwarze Spiegelkugeln; ausgeblendet, Hintergrund aus `clearColor`.
- tvOS-27-Simulator stürzt mit expliziter `bounds`-Hülle an `MeshInstancesComponent` ab (`bad_variant_access` im Occlusion-Culling); ohne Hülle stabil. Auf echter Hardware ungeprüft.
- Host-Weg über das Protokoll: `HostClient.swift` meldet sich mit `host-hello` v4 an und bekommt `lobby` vom echten Server. Figuren nach `board` setzen ist eingebaut, aber ohne Partie mit Controllern ungeprüft.

**Aufwand und Brüche bei einem echten tvOS-Host (Schätzung, nicht gemessen):** Brett-Regie (Kamerafahrten, Laufanimation, Popups, HUD) in Swift neu; Minispiel-Logik (ADR-012, läuft im Host) in Swift portieren oder per JavaScriptCore ohne Havok betreiben, Physik auf RealityKit umstellen; Podest und Effekte neu; Asset-Pfad GLB → USDZ mit den Materialverlusten oben; Signieren/Verteilen braucht ein Apple-Developer-Konto (ob ein kostenloser Account für eigene tvOS-Geräte reicht, ist ungeprüft; TestFlight/App Store kosten Geld → Rubens Freigabe). game-core, Protokoll und Controller bleiben, solange der Server auf PC/Mac läuft.

**Entscheidung:** **iterate** – RealityKit rendert die Szene mit allen Instanzen auf allen Apple-Plattformen. Auf der echten Apple TV 4K reicht es bei 4K-Ausgabe nur für 20 fps; weil Ruben bei 4K-Ausgabe bleibt, muss ein tvOS-Host die Pixelkosten senken: geringere interne Auflösung mit Hochskalierung (z. B. MetalFX, eigene Render-Pipeline statt ARView) und gezielte Profilierung mit Instruments. Danach ADR für den tvOS-Host als Entwurf; Rubens Entscheidung zu CHAOS-74 (Produktsäule) steht aus.

**Nachtrag 2026-11-17:** Weiter in [EXP-020](#exp-020-apple-tv-bei-4k-ausgabe--interne-auflösung-hochskalierung-profilierung-2026-11-17-chaos-114) (CHAOS-114): interne Auflösung mit Hochskalierung und Diagnose-Schalter.

**Abschluss 2026-11-17 (CHAOS-78):** Ruben hat die Apple TV als Spiel-Host freigegeben (CHAOS-74). [ADR-019](decisions/ADR-019-nativer-apple-host.md) wählt W2: Die Apple TV hostet allein, der TypeScript-Kern läuft in JavaScriptCore. Damit ist die Server-Variante 1 dieses Spikes (Server auf PC/Mac, RK5) nur noch ein optionaler Entwicklungsweg. Den Weg über das Protokoll zeigt [EXP-024](#exp-024-apple-tv-hostet-allein--typescript-kern-in-javascriptcore-2026-11-17-chaos-138) auf der echten Apple TV. Die Aufwandsschätzung oben ist durch ADR-019 ersetzt: Minispiel-Logik und Havok laufen dort unverändert in TypeScript, neu sind nur Darstellung und Brücke. Den Gesamteindruck (RK6) beurteilt Ruben mit der echten Grafik (CHAOS-148).

---

## EXP-018: Wachsende Sabotage über die Partiedauer (2026-11-17, CHAOS-67)

**Hypothese / gewünschtes Spielerlebnis:** Sabotage (Münzklau, Falle) soll über die ganze Partie spürbar bleiben: Schadenfreude statt Achselzucken, aber kein Frust (VISION, Produktsäule 1). EXP-013 hat gezeigt, dass Sabotage insgesamt nur 3–5 % aller Münzen kostet. Vermutung: Mit festen Werten wird sie zum Ende hin **zahmer**, weil der Bestand mit den Minispiel-Münzen wächst, der Klau aber bei 5 bleibt. Ein Wert, der mit der Runde wächst, sollte das ausgleichen, ohne den Anfang härter zu machen. Klau 6 / Falle 5 (der erste Hebel aus EXP-013) macht dagegen jeden Treffer stärker, auch früh, wenn alle wenig haben.

**Varianten** (10, 16, 20 Runden; 2–4 Spieler):

- A: Klau 5, Falle 4 fest (Stand vor diesem Experiment)
- B: Klau 6, Falle 5 fest (Hebel aus EXP-013): stärker, aber auch am Anfang
- F: 5/4, **+1 alle 5 Runden** (Runde 6–10: 6/5, 11–15: 7/6, 16–20: 8/7)
- G: 5/4, +1 alle 4 Runden
- H: 5/4, +1 alle 3 Runden
- I: 6/5, +1 alle 5 Runden (B und F zusammen)

**Neue Regel-Stellschraube:** `items.sabotageGrowthRounds` im `RuleSet` (`packages/game-core/src/types.ts`, `0` = fest). `sabotageAmount()` in `economy.ts` liefert den Wert der laufenden Runde. Er gilt beim Auslösen: für den Klau beim Auflösen des Reaktionsfensters („Festhalten!“ halbiert den gewachsenen Wert), für die Falle, wenn jemand hineinläuft, nicht beim Legen. Der Würfel-Prompt am Controller zeigt den Wert der laufenden Runde („Bis zu 6 Münzen klauen“). Protokoll und Apps bleiben unverändert, weil Host und Controller die Beträge aus den Ereignissen bzw. dem Prompt-Text nehmen.

**Objektive Messgrößen:** wie EXP-013 (Sabotagen je Partie, Verlust/Einnahmen, Verlust/Bestand mit p90, Münzen je Treffer, Spitzenopfer), neu **Verlust/Bestand im ersten und im letzten Drittel** der Partie (`SabotageLoss.round`) und Münzen je Treffer im letzten Drittel; als Nebenwirkung Sieg per Trophäen, Siegquote des Halbzeit-Führenden, Trophäen je Partie. Zielwerte aus EXP-003/013: Verlust je Treffer im Mittel ≤ 25 % des Bestands, Spitzenopfer über die Partie im Mittel höchstens etwa eine Trophäe (15 Münzen).

**Subjektive Playtest-Fragen (für Ruben):** Merkt man, dass der Klau später mehr bringt (6, 7, 8 Münzen), und macht das das Ende spannender? Fühlt sich ein Klau über 8 Münzen in Runde 16+ gemein an? Bleibt Sabotage zu zweit trotzdem zu selten (Häufigkeit ändert diese Stellschraube nicht)?

**Testumgebung:** wie „Gemeinsamer Aufbau von EXP-011 … EXP-013“, aber mit der aktuellen Rotation aus **vier** Minispielen (inkl. Kuckucks-Klatsche, CHAOS-54). Seeds 1–200 je Zeile, Node 22, Linux-Container, Basis-Commit `3703994`. Die Zahlen für A weichen deshalb leicht von EXP-013 ab. Alle Varianten setzen `sabotageGrowthRounds` ausdrücklich und bleiben unabhängig vom Standard wiederholbar (≈ 8 s):

```sh
EXPERIMENTS=growth pnpm exec vitest run packages/game-core/src/rules/experimentsM4.test.ts --silent=false
```

**Ergebnisse:**

| Runden | Variante                                | Sp. | Sabotagen/Partie | Verlust/Einnahmen | Verlust/Bestand | p90  | 1. Drittel | 3. Drittel | Münzen/Treffer | Münzen/Treffer 3. Drittel | Spitzenopfer Münzen | p90 | Spitzenopfer/Einnahmen | Sieg per Trophäen | Führender (Hälfte) gewinnt | Trophäen |
| ------ | --------------------------------------- | --- | ---------------- | ----------------- | --------------- | ---- | ---------- | ---------- | -------------- | ------------------------- | ------------------- | --- | ---------------------- | ----------------- | -------------------------- | -------- |
| 10     | A: Klau 5, Falle 4 (fest, vorher Stand) | 2   | 1,73             | 3 %               | 19 %            | 42 % | 25 %       | 13 %       | 3,6            | 3,7                       | 4,2                 | 8   | 5 %                    | 85 %              | 77 %                       | 5,03     |
| 10     | A: Klau 5, Falle 4 (fest, vorher Stand) | 3   | 2,85             | 4 %               | 17 %            | 36 % | 23 %       | 14 %       | 3,7            | 3,8                       | 6,2                 | 10  | 8 %                    | 72 %              | 59 %                       | 6,01     |
| 10     | A: Klau 5, Falle 4 (fest, vorher Stand) | 4   | 3,92             | 5 %               | 19 %            | 38 % | 22 %       | 18 %       | 3,7            | 3,8                       | 7,3                 | 12  | 12 %                   | 67 %              | 55 %                       | 6,53     |
| 10     | B: Klau 6, Falle 5                      | 2   | 1,74             | 4 %               | 24 %            | 50 % | 32 %       | 16 %       | 4,6            | 4,7                       | 5,3                 | 11  | 6 %                    | 86 %              | 77 %                       | 5,04     |
| 10     | B: Klau 6, Falle 5                      | 3   | 2,85             | 5 %               | 22 %            | 45 % | 29 %       | 18 %       | 4,7            | 4,8                       | 7,8                 | 12  | 10 %                   | 73 %              | 60 %                       | 6,00     |
| 10     | B: Klau 6, Falle 5                      | 4   | 3,94             | 7 %               | 24 %            | 46 % | 28 %       | 23 %       | 4,7            | 4,8                       | 9,1                 | 14  | 14 %                   | 66 %              | 56 %                       | 6,58     |
| 10     | F: 5/4, +1 alle 5 Runden (neuer Stand)  | 2   | 1,73             | 3 %               | 21 %            | 46 % | 25 %       | 16 %       | 4,1            | 4,7                       | 4,7                 | 9   | 5 %                    | 85 %              | 76 %                       | 5,01     |
| 10     | F: 5/4, +1 alle 5 Runden (neuer Stand)  | 3   | 2,86             | 5 %               | 19 %            | 38 % | 23 %       | 17 %       | 4,2            | 4,8                       | 7,1                 | 11  | 9 %                    | 72 %              | 59 %                       | 5,99     |
| 10     | F: 5/4, +1 alle 5 Runden (neuer Stand)  | 4   | 3,92             | 6 %               | 21 %            | 38 % | 22 %       | 22 %       | 4,2            | 4,8                       | 8,3                 | 13  | 13 %                   | 67 %              | 55 %                       | 6,51     |
| 10     | G: 5/4, +1 alle 4 Runden                | 2   | 1,73             | 4 %               | 22 %            | 50 % | 25 %       | 18 %       | 4,3            | 5,2                       | 5,1                 | 9   | 6 %                    | 85 %              | 76 %                       | 5,01     |
| 10     | G: 5/4, +1 alle 4 Runden                | 3   | 2,86             | 5 %               | 20 %            | 38 % | 23 %       | 19 %       | 4,5            | 5,3                       | 7,6                 | 12  | 10 %                   | 72 %              | 58 %                       | 5,99     |
| 10     | G: 5/4, +1 alle 4 Runden                | 4   | 3,94             | 6 %               | 22 %            | 38 % | 22 %       | 24 %       | 4,5            | 5,2                       | 8,9                 | 14  | 14 %                   | 66 %              | 55 %                       | 6,53     |
| 10     | H: 5/4, +1 alle 3 Runden                | 2   | 1,73             | 4 %               | 22 %            | 50 % | 25 %       | 19 %       | 4,6            | 5,7                       | 5,4                 | 10  | 6 %                    | 84 %              | 76 %                       | 5,01     |
| 10     | H: 5/4, +1 alle 3 Runden                | 3   | 2,86             | 5 %               | 21 %            | 41 % | 23 %       | 21 %       | 4,8            | 5,9                       | 8,2                 | 13  | 10 %                   | 72 %              | 59 %                       | 6,00     |
| 10     | H: 5/4, +1 alle 3 Runden                | 4   | 3,94             | 7 %               | 24 %            | 40 % | 22 %       | 26 %       | 4,8            | 5,8                       | 9,6                 | 15  | 15 %                   | 67 %              | 56 %                       | 6,52     |
| 10     | I: 6/5, +1 alle 5 Runden                | 2   | 1,74             | 4 %               | 25 %            | 50 % | 32 %       | 18 %       | 4,9            | 5,5                       | 5,7                 | 11  | 6 %                    | 86 %              | 77 %                       | 5,02     |
| 10     | I: 6/5, +1 alle 5 Runden                | 3   | 2,85             | 6 %               | 23 %            | 46 % | 29 %       | 20 %       | 5,1            | 5,6                       | 8,5                 | 13  | 11 %                   | 73 %              | 60 %                       | 5,99     |
| 10     | I: 6/5, +1 alle 5 Runden                | 4   | 3,96             | 7 %               | 26 %            | 46 % | 28 %       | 27 %       | 5,1            | 5,5                       | 9,9                 | 16  | 16 %                   | 66 %              | 55 %                       | 6,57     |
| 16     | A: Klau 5, Falle 4 (fest, vorher Stand) | 2   | 2,67             | 3 %               | 15 %            | 29 % | 24 %       | 8 %        | 3,6            | 3,8                       | 6,3                 | 10  | 4 %                    | 88 %              | 82 %                       | 9,38     |
| 16     | A: Klau 5, Falle 4 (fest, vorher Stand) | 3   | 4,46             | 4 %               | 14 %            | 29 % | 21 %       | 9 %        | 3,7            | 3,8                       | 8,9                 | 14  | 7 %                    | 78 %              | 66 %                       | 11,43    |
| 16     | A: Klau 5, Falle 4 (fest, vorher Stand) | 4   | 5,89             | 5 %               | 17 %            | 33 % | 20 %       | 13 %       | 3,7            | 3,8                       | 10,0                | 15  | 10 %                   | 72 %              | 56 %                       | 13,28    |
| 16     | B: Klau 6, Falle 5                      | 2   | 2,68             | 4 %               | 19 %            | 37 % | 30 %       | 10 %       | 4,6            | 4,8                       | 8,0                 | 13  | 5 %                    | 88 %              | 80 %                       | 9,36     |
| 16     | B: Klau 6, Falle 5                      | 3   | 4,47             | 5 %               | 18 %            | 35 % | 27 %       | 12 %       | 4,7            | 4,8                       | 11,2                | 17  | 9 %                    | 79 %              | 67 %                       | 11,40    |
| 16     | B: Klau 6, Falle 5                      | 4   | 5,95             | 6 %               | 21 %            | 43 % | 25 %       | 15 %       | 4,7            | 4,8                       | 12,4                | 18  | 12 %                   | 72 %              | 55 %                       | 13,24    |
| 16     | F: 5/4, +1 alle 5 Runden (neuer Stand)  | 2   | 2,67             | 4 %               | 18 %            | 35 % | 24 %       | 12 %       | 4,7            | 5,8                       | 8,1                 | 14  | 6 %                    | 88 %              | 80 %                       | 9,35     |
| 16     | F: 5/4, +1 alle 5 Runden (neuer Stand)  | 3   | 4,46             | 5 %               | 17 %            | 37 % | 21 %       | 15 %       | 4,8            | 5,8                       | 11,4                | 17  | 9 %                    | 78 %              | 66 %                       | 11,44    |
| 16     | F: 5/4, +1 alle 5 Runden (neuer Stand)  | 4   | 5,86             | 6 %               | 20 %            | 38 % | 20 %       | 18 %       | 4,7            | 5,7                       | 12,5                | 18  | 12 %                   | 74 %              | 56 %                       | 13,21    |
| 16     | G: 5/4, +1 alle 4 Runden                | 2   | 2,67             | 4 %               | 18 %            | 36 % | 25 %       | 13 %       | 5,0            | 6,2                       | 8,7                 | 15  | 6 %                    | 88 %              | 80 %                       | 9,35     |
| 16     | G: 5/4, +1 alle 4 Runden                | 3   | 4,45             | 5 %               | 18 %            | 38 % | 22 %       | 15 %       | 5,1            | 6,3                       | 12,2                | 19  | 10 %                   | 78 %              | 67 %                       | 11,42    |
| 16     | G: 5/4, +1 alle 4 Runden                | 4   | 5,88             | 7 %               | 21 %            | 40 % | 20 %       | 20 %       | 5,1            | 6,3                       | 13,6                | 20  | 13 %                   | 76 %              | 54 %                       | 13,18    |
| 16     | H: 5/4, +1 alle 3 Runden                | 2   | 2,67             | 4 %               | 20 %            | 40 % | 25 %       | 15 %       | 5,6            | 7,3                       | 9,8                 | 17  | 7 %                    | 89 %              | 80 %                       | 9,34     |
| 16     | H: 5/4, +1 alle 3 Runden                | 3   | 4,44             | 6 %               | 20 %            | 39 % | 22 %       | 18 %       | 5,7            | 7,3                       | 13,6                | 21  | 11 %                   | 78 %              | 66 %                       | 11,46    |
| 16     | H: 5/4, +1 alle 3 Runden                | 4   | 5,88             | 7 %               | 23 %            | 46 % | 21 %       | 23 %       | 5,6            | 7,3                       | 15,0                | 21  | 14 %                   | 76 %              | 54 %                       | 13,18    |
| 16     | I: 6/5, +1 alle 5 Runden                | 2   | 2,68             | 4 %               | 21 %            | 40 % | 30 %       | 14 %       | 5,6            | 6,7                       | 9,7                 | 17  | 7 %                    | 88 %              | 79 %                       | 9,32     |
| 16     | I: 6/5, +1 alle 5 Runden                | 3   | 4,46             | 6 %               | 21 %            | 41 % | 27 %       | 16 %       | 5,7            | 6,8                       | 13,6                | 20  | 11 %                   | 79 %              | 69 %                       | 11,43    |
| 16     | I: 6/5, +1 alle 5 Runden                | 4   | 5,95             | 7 %               | 24 %            | 46 % | 25 %       | 21 %       | 5,6            | 6,7                       | 14,8                | 21  | 14 %                   | 74 %              | 56 %                       | 13,21    |
| 20     | A: Klau 5, Falle 4 (fest, vorher Stand) | 2   | 3,21             | 3 %               | 14 %            | 28 % | 23 %       | 7 %        | 3,7            | 3,9                       | 7,5                 | 13  | 4 %                    | 90 %              | 79 %                       | 11,77    |
| 20     | A: Klau 5, Falle 4 (fest, vorher Stand) | 3   | 5,31             | 4 %               | 13 %            | 27 % | 20 %       | 7 %        | 3,7            | 3,8                       | 10,3                | 15  | 7 %                    | 83 %              | 65 %                       | 14,45    |
| 20     | A: Klau 5, Falle 4 (fest, vorher Stand) | 4   | 7,10             | 5 %               | 16 %            | 33 % | 20 %       | 11 %       | 3,7            | 3,7                       | 11,5                | 16  | 9 %                    | 78 %              | 54 %                       | 16,80    |
| 20     | B: Klau 6, Falle 5                      | 2   | 3,23             | 4 %               | 17 %            | 32 % | 30 %       | 9 %        | 4,7            | 4,9                       | 9,5                 | 16  | 5 %                    | 91 %              | 79 %                       | 11,72    |
| 20     | B: Klau 6, Falle 5                      | 3   | 5,33             | 5 %               | 17 %            | 32 % | 25 %       | 10 %       | 4,8            | 4,9                       | 12,9                | 19  | 8 %                    | 83 %              | 65 %                       | 14,35    |
| 20     | B: Klau 6, Falle 5                      | 4   | 7,20             | 6 %               | 20 %            | 38 % | 25 %       | 14 %       | 4,7            | 4,7                       | 14,3                | 21  | 11 %                   | 78 %              | 55 %                       | 16,75    |
| 20     | F: 5/4, +1 alle 5 Runden (neuer Stand)  | 2   | 3,22             | 4 %               | 16 %            | 31 % | 24 %       | 11 %       | 5,0            | 6,4                       | 10,2                | 18  | 6 %                    | 91 %              | 80 %                       | 11,71    |
| 20     | F: 5/4, +1 alle 5 Runden (neuer Stand)  | 3   | 5,29             | 5 %               | 16 %            | 33 % | 21 %       | 12 %       | 5,1            | 6,4                       | 14,0                | 20  | 9 %                    | 84 %              | 64 %                       | 14,41    |
| 20     | F: 5/4, +1 alle 5 Runden (neuer Stand)  | 4   | 7,08             | 6 %               | 20 %            | 38 % | 20 %       | 18 %       | 5,0            | 6,1                       | 15,1                | 23  | 12 %                   | 80 %              | 55 %                       | 16,74    |
| 20     | G: 5/4, +1 alle 4 Runden                | 2   | 3,23             | 4 %               | 17 %            | 33 % | 24 %       | 13 %       | 5,4            | 7,1                       | 11,1                | 19  | 6 %                    | 91 %              | 80 %                       | 11,71    |
| 20     | G: 5/4, +1 alle 4 Runden                | 3   | 5,28             | 6 %               | 17 %            | 35 % | 21 %       | 13 %       | 5,5            | 7,1                       | 15,1                | 22  | 10 %                   | 84 %              | 66 %                       | 14,38    |
| 20     | G: 5/4, +1 alle 4 Runden                | 4   | 7,09             | 7 %               | 21 %            | 41 % | 21 %       | 20 %       | 5,4            | 6,9                       | 16,6                | 25  | 13 %                   | 79 %              | 55 %                       | 16,66    |
| 20     | H: 5/4, +1 alle 3 Runden                | 2   | 3,22             | 5 %               | 19 %            | 36 % | 25 %       | 15 %       | 6,1            | 8,4                       | 12,6                | 22  | 7 %                    | 91 %              | 80 %                       | 11,71    |
| 20     | H: 5/4, +1 alle 3 Runden                | 3   | 5,25             | 6 %               | 19 %            | 38 % | 21 %       | 16 %       | 6,2            | 8,4                       | 17,0                | 25  | 11 %                   | 84 %              | 67 %                       | 14,38    |
| 20     | H: 5/4, +1 alle 3 Runden                | 4   | 7,04             | 7 %               | 23 %            | 46 % | 21 %       | 23 %       | 6,0            | 8,1                       | 18,4                | 28  | 14 %                   | 80 %              | 51 %                       | 16,72    |
| 20     | I: 6/5, +1 alle 5 Runden                | 2   | 3,23             | 5 %               | 20 %            | 38 % | 30 %       | 13 %       | 5,9            | 7,3                       | 12,0                | 21  | 6 %                    | 91 %              | 79 %                       | 11,69    |
| 20     | I: 6/5, +1 alle 5 Runden                | 3   | 5,28             | 6 %               | 20 %            | 38 % | 26 %       | 14 %       | 6,0            | 7,3                       | 16,3                | 23  | 10 %                   | 83 %              | 66 %                       | 14,34    |
| 20     | I: 6/5, +1 alle 5 Runden                | 4   | 7,18             | 7 %               | 23 %            | 46 % | 25 %       | 20 %       | 5,9            | 7,0                       | 17,8                | 27  | 14 %                   | 79 %              | 52 %                       | 16,66    |

- **Feste Werte werden zahm:** Bei A nimmt ein Treffer im ersten Drittel 20–25 % des Bestands, im letzten Drittel nur noch 13–18 % (10 Runden), 8–13 % (16 Runden) und 7–11 % (20 Runden). Die Hypothese stimmt.
- **Klau 6 / Falle 5 (B) trifft den Falschen:** Im ersten Drittel steigt der Biss auf 28–32 % und liegt damit über dem Ziel ≤ 25 % aus EXP-003. Am Ende bleibt es bei 9–14 % (20 Runden). B macht den Anfang härter, ohne das Ende zu retten.
- **Wachsend (F) gleicht aus:** Im ersten Drittel ist F identisch mit A (20–25 %). Im letzten Drittel steigt der Biss auf 16–22 % (10 Runden) bzw. 11–18 % (20 Runden). Insgesamt 16–21 % je Treffer (p90 ≤ 46 %), Sabotage kostet 3–6 % aller Münzen. Das Spitzenopfer verliert bei 10 Runden 4,7–8,3 Münzen (p90 9–13), bei 20 Runden 10–15 (p90 18–23), also auch in langen Partien im Mittel höchstens eine Trophäe.
- **Schneller wachsend (G, H) überzieht lange Partien:** H bringt im letzten Drittel 8 Münzen je Treffer, das Spitzenopfer verliert bei 20 Runden / 4 Spielern 18 Münzen (p90 28, fast zwei Trophäen). G liegt dazwischen (16,6, p90 25). I (6/5 + Wachstum) erbt die harte Anfangsphase von B.
- **Wertung unberührt:** Trophäen je Partie, Sieg per Trophäen und die Siegquote des Halbzeit-Führenden ändern sich in keiner Variante über das Rauschen hinaus (± 2 Prozentpunkte). Wachsende Sabotage ist also **keine Aufholhilfe**; dafür bleibt CHAOS-65.
- **Häufigkeit unverändert:** Die Stellschraube ändert nur die Stärke. Zu zweit gibt es weiterhin nur etwa alle 6 Runden eine Sabotage (1,7 je 10-Runden-Partie).

**Entscheidung:** **keep F** – `sabotageGrowthRounds: 5` in `DEFAULT_RULES` (`packages/game-core/src/rules/defaults.ts`). F ist die stärkste Variante, die alle Zielwerte einhält. Sie lässt den bewährten Anfang unverändert und gibt das zurück, was der wachsende Bestand der Sabotage nimmt. Beim Standard von 10 Runden heißt das: Ab Runde 6 klaut man 6 statt 5 Münzen, eine Falle kostet 5 statt 4. **discard** B als Standard (Anfang zu hart), G und H (lange Partien zu hart), I (wie B). Rückweg ohne Codeänderung: `sabotageGrowthRounds: 0`.

Die Aufgabe sah „nach Playtest-Feedback“ vor. Die Sabotage-Frage aus der M4-Abnahme (CHAOS-43, Frage 4) blieb unbeantwortet, weil die Partie auf Rubens Hardware ruckelte. Die Entscheidung beruht deshalb nur auf der Simulation. Sie ist klein, lässt sich mit einem Wert zurücknehmen und gehört in den nächsten Playtest.

**Nachtrag 2026-11-17 (CHAOS-120):** Das Wachstum wird jetzt angesagt. In jeder Wachstumsrunde trägt `round-started` die neuen Werte (`sabotage: { steal, trap }`, Protokoll v4-Nachtrag), der Host blendet „Sabotage wird stärker!“ mit Klau- und Fallenwert ein (1,2 s Pause vor dem Zugbeginn, tiefer Fallen-Klang). Der Fallen-Text am Controller heißt „Kostet andere ab 4 Münzen“, solange die Falle bis zum Partieende noch mehr bringen kann. Die Regeln selbst ändern sich nicht; die Simulationswerte oben gelten weiter. Gerätetest: Checkliste Abschnitt 24.

**Offen für Playtest:** Fühlt sich das Ende mit 6–8 Münzen Klau spannender an oder gemeiner? Fällt das Wachsen überhaupt auf? Der Host kündigt es bisher nicht an, nur der Controller zeigt den höheren Wert (Idee: CHAOS-120 im Backlog CHAOS-44). Die Falle zahlt den Wert der Runde, in der sie auslöst; wer sie in Runde 5 legt, sieht dort noch „Kostet andere 4 Münzen“, auch wenn sie erst in Runde 6 fünf Münzen bringt.

---

## EXP-019: Zurückgestellte Balance-Ideen aus EXP-001 … EXP-004 mit dem M4-Stand (2026-11-17, CHAOS-51)

**Hypothese / gewünschtes Spielerlebnis:** Bei den M2-Experimenten zurückgestellte Ideen könnten zwei offene Punkte aus M4 verbessern: In kurzen Partien bleiben Spieler ohne Trophäe („tote“ Trophäen hinter allen Figuren), und Sabotage ist zu zweit selten (EXP-013: etwa alle 6 Runden). Gewünscht sind mehr überraschende Wendungen (VISION: „laugh at unexpected reversals“), ohne dass Sabotage gnadenlos wird oder gute Minispieler davonziehen.

**Stand der sieben Ideen aus CHAOS-51:**

| Idee                                                                     | Herkunft  | Stand                                                                         |
| ------------------------------------------------------------------------ | --------- | ----------------------------------------------------------------------------- |
| Würfel 2–7 für kurze Partien                                             | EXP-001 D | geprüft, Tabelle A                                                            |
| Runden-Voreinstellungen kurz/normal/lang                                 | EXP-001   | **schon erledigt** durch EXP-011 (10/16/20, Standard 10)                      |
| Trophäe wandert bevorzugt vor die Spieler                                | EXP-002   | geprüft, Tabelle B (dazu „vor die Letzten“ als Aufholhilfe, CHAOS-65)         |
| Ökonomie mit echten Minispielen neu bewerten                             | EXP-002   | **schon erledigt** durch EXP-012 (Preis 15, 10/5/3/0 bleiben)                 |
| Item als Bonus für den Minispiel-Sieg                                    | EXP-003   | geprüft, Tabelle C (dazu neu: Item als Trostpreis für den letzten Platz)      |
| Schild auch gegen Fallen; sichtbare vs. versteckte Fallen                | EXP-003   | geprüft, Tabelle D                                                            |
| Hinweiston am Controller; längeres Reaktionsfenster als Barrierefreiheit | EXP-004   | keine Balance-Frage, eigene Aufgaben CHAOS-122 und CHAOS-124 (unter CHAOS-44) |

**Varianten (neue Regel-Stellschrauben in `packages/game-core`, fehlen = bisheriges Verhalten):**

- `trophy.placement`: `random` (Stand), `ahead` (die nähere Hälfte der freien Kandidaten, gemessen am kürzesten Weg vorwärts von der nächsten Figur), `ahead-of-last` (dasselbe nur von den Letztplatzierten).
- `items.minigameWinItems` / `items.minigameLastItems`: so viele zufällige Items für den 1. bzw. den letzten Platz im Minispiel (geteilt: alle; sind alle gleichauf, gibt es keinen letzten Platz). Kapazität wie auf Item-Feldern.
- `items.shieldBlocksTrap`: ein gehaltener Schild fängt eine fremde Falle automatisch ab (ohne Reaktionsfenster).
- Bot-Policy `avoidTrapChance` (nur Simulation): Fallen sind sichtbar, Bots meiden an Gabeln zu 75 % Wege mit einer fremden Falle in den nächsten 6 Feldern. Ohne das (Stand) verhalten sich Bots wie bei versteckten Fallen.

**Aufbau:** wie EXP-011 … EXP-013 (Wackelwald, Minispiel-Rotation, Bots `EXPERIMENT_POLICY`), Basis `M4_RULES` = `DEFAULT_RULES` ohne Trostpreis, also mit der wachsenden Sabotage aus EXP-018 (CHAOS-67). Seeds 1–200 je Zeile, 2/3/4 Spieler. Wiederholen (≈ 8 s):

```sh
EXPERIMENTS=balance pnpm exec vitest run packages/game-core/src/rules/experimentsBalance.test.ts --silent=false
```

Code: `packages/game-core/src/rules/experimentsBalance.ts`. Basis-Commit `474ac6a` (main mit EXP-018), Ergebnisse vom Merge-Commit, der diesen Eintrag auf diese Basis bringt. Ein erster Lauf ohne EXP-018 (Basis `3703994`) ergab dieselben Entscheidungen; die wachsende Sabotage greift erst ab Runde 6.

**Messgrößen:** Trophäen je Partie, Züge je gekaufter Trophäe, Anteil Spieler ohne Trophäe, Sieg per Trophäen, Aufholeffekt (Halbzeit-Führender bzw. -Letzter gewinnt), Sabotagen je Partie und Runde, Verlust durch Sabotage relativ zu den Einnahmen, Vorteil eines Minispiel-Profis (Slot 1 +10 Punkte), Partiedauer.

**Ergebnisse:**

**EXP-019 A Würfel 2–7 mit Rotation (Seeds 1–200 je Zeile)**

| Runden                                                                                  | Variante                                         | Sp. | min             | Felder/Zug      | Trophäen/Partie      | ohne Trophäe         | Sieg per Trophäen | Führender (Hälfte) gewinnt |
| --------------------------------------------------------------------------------------- | ------------------------------------------------ | --- | --------------- | --------------- | -------------------- | -------------------- | ----------------- | -------------------------- |
| 5                                                                                       | A: W6 1–6 (Stand M4)                             | 2   | 5,7             | 3,8             | 2,45                 | 20 %                 | 74 %              | 71 %                       |
| 5                                                                                       | A: W6 1–6 (Stand M4)                             | 3   | 6,4             | 3,7             | 2,86                 | 28 %                 | 55 %              | 44 %                       |
| 5                                                                                       | A: W6 1–6 (Stand M4)                             | 4   | 7,2             | 3,7             | 3,06                 | 37 %                 | 43 %              | 41 %                       |
| 5                                                                                       | B: Würfel 2–7                                    | 2   | 5,8             | 4,9             | 3,01                 | 10 %                 | 71 %              | 62 %                       |
| 5                                                                                       | B: Würfel 2–7                                    | 3   | 6,6             | 4,8             | 3,42                 | 20 %                 | 57 %              | 55 %                       |
| 5                                                                                       | B: Würfel 2–7                                    | 4   | 7,4             | 4,9             | 3,94                 | 26 %                 | 54 %              | 51 %                       |
| 10                                                                                      | A: W6 1–6 (Stand M4)                             | 2   | 11,1            | 3,7             | 5,01                 | 6 %                  | 85 %              | 76 %                       |
| 10                                                                                      | A: W6 1–6 (Stand M4)                             | 3   | 12,5            | 3,7             | 5,99                 | 10 %                 | 72 %              | 59 %                       |
| 10                                                                                      | A: W6 1–6 (Stand M4)                             | 4   | 13,9            | 3,7             | 6,51                 | 15 %                 | 67 %              | 55 %                       |
| 10                                                                                      | B: Würfel 2–7                                    | 2   | 11,3            | 4,8             | 6,67                 | 2 %                  | 86 %              | 76 %                       |
| 10                                                                                      | B: Würfel 2–7                                    | 3   | 12,8            | 4,7             | 7,82                 | 6 %                  | 70 %              | 59 %                       |
| 10                                                                                      | B: Würfel 2–7                                    | 4   | 14,3            | 4,8             | 8,79                 | 7 %                  | 68 %              | 55 %                       |
| **EXP-019 B Ziel der wandernden Trophäe (Seeds 1–200 je Zeile)**                        |
| Runden                                                                                  | Variante                                         | Sp. | Trophäen/Partie | Züge je Trophäe | ohne Trophäe         | Abstand Erste–Letzte | Sieg per Trophäen | Führender (Hälfte) gewinnt | Letzter (Hälfte) gewinnt   | fair 1/n            |
| ---                                                                                     | ---                                              | --- | ---             | ---             | ---                  | ---                  | ---               | ---                        | ---                        | ---                 |
| 5                                                                                       | A: zufällig (Stand M4)                           | 2   | 2,45            | 4,1             | 20 %                 | 1,02                 | 74 %              | 71 %                       | 29 %                       | 50 %                |
| 5                                                                                       | A: zufällig (Stand M4)                           | 3   | 2,86            | 5,2             | 28 %                 | 1,21                 | 55 %              | 44 %                       | 23 %                       | 33 %                |
| 5                                                                                       | A: zufällig (Stand M4)                           | 4   | 3,06            | 6,5             | 37 %                 | 1,33                 | 43 %              | 41 %                       | 10 %                       | 25 %                |
| 5                                                                                       | B: vor die Spieler                               | 2   | 2,71            | 3,7             | 16 %                 | 1,00                 | 74 %              | 71 %                       | 29 %                       | 50 %                |
| 5                                                                                       | B: vor die Spieler                               | 3   | 3,19            | 4,7             | 24 %                 | 1,24                 | 56 %              | 45 %                       | 22 %                       | 33 %                |
| 5                                                                                       | B: vor die Spieler                               | 4   | 3,60            | 5,6             | 29 %                 | 1,35                 | 50 %              | 38 %                       | 13 %                       | 25 %                |
| 5                                                                                       | C: vor die Letzten                               | 2   | 2,69            | 3,7             | 16 %                 | 0,96                 | 71 %              | 73 %                       | 27 %                       | 50 %                |
| 5                                                                                       | C: vor die Letzten                               | 3   | 3,06            | 4,9             | 25 %                 | 1,21                 | 60 %              | 46 %                       | 23 %                       | 33 %                |
| 5                                                                                       | C: vor die Letzten                               | 4   | 3,28            | 6,1             | 34 %                 | 1,35                 | 50 %              | 37 %                       | 13 %                       | 25 %                |
| 10                                                                                      | A: zufällig (Stand M4)                           | 2   | 5,01            | 4,0             | 6 %                  | 1,71                 | 85 %              | 76 %                       | 24 %                       | 50 %                |
| 10                                                                                      | A: zufällig (Stand M4)                           | 3   | 5,99            | 5,0             | 10 %                 | 2,08                 | 72 %              | 59 %                       | 14 %                       | 33 %                |
| 10                                                                                      | A: zufällig (Stand M4)                           | 4   | 6,51            | 6,1             | 15 %                 | 2,21                 | 67 %              | 55 %                       | 6 %                        | 25 %                |
| 10                                                                                      | B: vor die Spieler                               | 2   | 5,59            | 3,6             | 3 %                  | 1,52                 | 78 %              | 79 %                       | 22 %                       | 50 %                |
| 10                                                                                      | B: vor die Spieler                               | 3   | 7,08            | 4,2             | 7 %                  | 2,04                 | 73 %              | 60 %                       | 14 %                       | 33 %                |
| 10                                                                                      | B: vor die Spieler                               | 4   | 7,67            | 5,2             | 9 %                  | 2,14                 | 58 %              | 55 %                       | 7 %                        | 25 %                |
| 10                                                                                      | C: vor die Letzten                               | 2   | 5,53            | 3,6             | 3 %                  | 1,49                 | 77 %              | 77 %                       | 23 %                       | 50 %                |
| 10                                                                                      | C: vor die Letzten                               | 3   | 6,54            | 4,6             | 9 %                  | 2,06                 | 70 %              | 58 %                       | 15 %                       | 33 %                |
| 10                                                                                      | C: vor die Letzten                               | 4   | 6,95            | 5,8             | 11 %                 | 2,07                 | 65 %              | 55 %                       | 8 %                        | 25 %                |
| 20                                                                                      | A: zufällig (Stand M4)                           | 2   | 11,71           | 3,4             | 0 %                  | 2,75                 | 91 %              | 80 %                       | 21 %                       | 50 %                |
| 20                                                                                      | A: zufällig (Stand M4)                           | 3   | 14,41           | 4,2             | 0 %                  | 3,78                 | 84 %              | 64 %                       | 11 %                       | 33 %                |
| 20                                                                                      | A: zufällig (Stand M4)                           | 4   | 16,74           | 4,8             | 1 %                  | 3,79                 | 80 %              | 55 %                       | 6 %                        | 25 %                |
| 20                                                                                      | B: vor die Spieler                               | 2   | 12,76           | 3,1             | 0 %                  | 2,51                 | 88 %              | 75 %                       | 26 %                       | 50 %                |
| 20                                                                                      | B: vor die Spieler                               | 3   | 16,91           | 3,5             | 0 %                  | 3,31                 | 75 %              | 65 %                       | 10 %                       | 33 %                |
| 20                                                                                      | B: vor die Spieler                               | 4   | 19,30           | 4,1             | 0 %                  | 3,27                 | 71 %              | 52 %                       | 8 %                        | 25 %                |
| 20                                                                                      | C: vor die Letzten                               | 2   | 12,80           | 3,1             | 0 %                  | 2,36                 | 87 %              | 72 %                       | 28 %                       | 50 %                |
| 20                                                                                      | C: vor die Letzten                               | 3   | 16,05           | 3,7             | 0 %                  | 3,35                 | 81 %              | 59 %                       | 16 %                       | 33 %                |
| 20                                                                                      | C: vor die Letzten                               | 4   | 18,18           | 4,4             | 0 %                  | 3,26                 | 79 %              | 55 %                       | 7 %                        | 25 %                |
| **EXP-019 C Item für den Minispiel-Sieg oder den letzten Platz (Seeds 1–200 je Zeile)** |
| Runden                                                                                  | Variante                                         | Sp. | min             | Items/Spieler   | Sabotagen/Partie     | je Runde             | Verlust/Einnahmen | Trophäen/Partie            | Führender (Hälfte) gewinnt | Siege Slot 1        | fair 1/n |
| ---                                                                                     | ---                                              | --- | ---             | ---             | ---                  | ---                  | ---               | ---                        | ---                        | ---                 | ---      |
| 10                                                                                      | A: kein Item (Stand M4)                          | 2   | 11,1            | 2,4             | 1,73                 | 0,17                 | 3 %               | 5,01                       | 76 %                       | 55 %                | 50 %     |
| 10                                                                                      | A: kein Item (Stand M4)                          | 3   | 12,5            | 2,4             | 2,86                 | 0,29                 | 5 %               | 5,99                       | 59 %                       | 38 %                | 33 %     |
| 10                                                                                      | A: kein Item (Stand M4)                          | 4   | 13,9            | 2,4             | 3,92                 | 0,39                 | 6 %               | 6,51                       | 55 %                       | 26 %                | 25 %     |
| 10                                                                                      | B: 1 Item für den Sieg                           | 2   | 11,3            | 6,3             | 3,53                 | 0,35                 | 6 %               | 5,35                       | 74 %                       | 43 %                | 50 %     |
| 10                                                                                      | B: 1 Item für den Sieg                           | 3   | 12,8            | 5,3             | 5,18                 | 0,52                 | 8 %               | 6,31                       | 65 %                       | 37 %                | 33 %     |
| 10                                                                                      | B: 1 Item für den Sieg                           | 4   | 14,3            | 4,7             | 6,82                 | 0,68                 | 10 %              | 6,95                       | 59 %                       | 26 %                | 25 %     |
| 10                                                                                      | L: 1 Item für den letzten Platz                  | 2   | 11,4            | 6,3             | 3,80                 | 0,38                 | 7 %               | 5,29                       | 71 %                       | 45 %                | 50 %     |
| 10                                                                                      | L: 1 Item für den letzten Platz                  | 3   | 12,8            | 5,3             | 5,38                 | 0,54                 | 8 %               | 6,29                       | 56 %                       | 37 %                | 33 %     |
| 10                                                                                      | L: 1 Item für den letzten Platz                  | 4   | 14,3            | 4,7             | 6,69                 | 0,67                 | 10 %              | 7,32                       | 55 %                       | 26 %                | 25 %     |
| 10                                                                                      | P: Stand, Slot 1 Profi (+10)                     | 2   | 11,1            | 2,4             | 1,73                 | 0,17                 | 3 %               | 5,07                       | 72 %                       | 66 %                | 50 %     |
| 10                                                                                      | P: Stand, Slot 1 Profi (+10)                     | 3   | 12,5            | 2,4             | 2,92                 | 0,29                 | 5 %               | 5,96                       | 66 %                       | 53 %                | 33 %     |
| 10                                                                                      | P: Stand, Slot 1 Profi (+10)                     | 4   | 13,9            | 2,4             | 3,98                 | 0,40                 | 6 %               | 6,57                       | 60 %                       | 43 %                | 25 %     |
| 10                                                                                      | Q: 1 Item für den Sieg, Slot 1 Profi             | 2   | 11,3            | 6,0             | 3,44                 | 0,34                 | 7 %               | 5,30                       | 72 %                       | 63 %                | 50 %     |
| 10                                                                                      | Q: 1 Item für den Sieg, Slot 1 Profi             | 3   | 12,8            | 5,2             | 5,08                 | 0,51                 | 8 %               | 6,42                       | 65 %                       | 53 %                | 33 %     |
| 10                                                                                      | Q: 1 Item für den Sieg, Slot 1 Profi             | 4   | 14,2            | 4,6             | 6,47                 | 0,65                 | 9 %               | 7,01                       | 57 %                       | 50 %                | 25 %     |
| 10                                                                                      | R: 1 Item für den letzten Platz, Slot 1 Profi    | 2   | 11,4            | 6,0             | 3,58                 | 0,36                 | 7 %               | 5,25                       | 68 %                       | 54 %                | 50 %     |
| 10                                                                                      | R: 1 Item für den letzten Platz, Slot 1 Profi    | 3   | 12,8            | 5,2             | 5,15                 | 0,51                 | 8 %               | 6,27                       | 59 %                       | 39 %                | 33 %     |
| 10                                                                                      | R: 1 Item für den letzten Platz, Slot 1 Profi    | 4   | 14,3            | 4,7             | 6,75                 | 0,67                 | 10 %              | 7,16                       | 53 %                       | 39 %                | 25 %     |
| 20                                                                                      | A: kein Item (Stand M4)                          | 2   | 21,8            | 3,7             | 3,22                 | 0,16                 | 4 %               | 11,71                      | 80 %                       | 53 %                | 50 %     |
| 20                                                                                      | A: kein Item (Stand M4)                          | 3   | 24,6            | 3,8             | 5,29                 | 0,26                 | 5 %               | 14,41                      | 64 %                       | 38 %                | 33 %     |
| 20                                                                                      | A: kein Item (Stand M4)                          | 4   | 27,5            | 3,8             | 7,08                 | 0,35                 | 6 %               | 16,74                      | 55 %                       | 26 %                | 25 %     |
| 20                                                                                      | B: 1 Item für den Sieg                           | 2   | 22,5            | 10,6            | 8,56                 | 0,43                 | 10 %              | 12,48                      | 75 %                       | 44 %                | 50 %     |
| 20                                                                                      | B: 1 Item für den Sieg                           | 3   | 25,5            | 9,0             | 11,68                | 0,58                 | 11 %              | 15,56                      | 66 %                       | 36 %                | 33 %     |
| 20                                                                                      | B: 1 Item für den Sieg                           | 4   | 28,4            | 8,0             | 14,38                | 0,72                 | 12 %              | 18,20                      | 57 %                       | 27 %                | 25 %     |
| 20                                                                                      | L: 1 Item für den letzten Platz                  | 2   | 22,5            | 10,6            | 8,59                 | 0,43                 | 10 %              | 12,59                      | 76 %                       | 51 %                | 50 %     |
| 20                                                                                      | L: 1 Item für den letzten Platz                  | 3   | 25,5            | 9,0             | 12,11                | 0,61                 | 11 %              | 15,68                      | 57 %                       | 31 %                | 33 %     |
| 20                                                                                      | L: 1 Item für den letzten Platz                  | 4   | 28,4            | 8,0             | 14,41                | 0,72                 | 12 %              | 18,45                      | 52 %                       | 24 %                | 25 %     |
| 20                                                                                      | P: Stand, Slot 1 Profi (+10)                     | 2   | 21,8            | 3,7             | 3,23                 | 0,16                 | 4 %               | 11,71                      | 77 %                       | 62 %                | 50 %     |
| 20                                                                                      | P: Stand, Slot 1 Profi (+10)                     | 3   | 24,6            | 3,8             | 5,15                 | 0,26                 | 5 %               | 14,52                      | 65 %                       | 45 %                | 33 %     |
| 20                                                                                      | P: Stand, Slot 1 Profi (+10)                     | 4   | 27,5            | 3,8             | 7,18                 | 0,36                 | 6 %               | 16,86                      | 56 %                       | 43 %                | 25 %     |
| 20                                                                                      | Q: 1 Item für den Sieg, Slot 1 Profi             | 2   | 22,4            | 10,1            | 8,13                 | 0,41                 | 9 %               | 12,65                      | 80 %                       | 61 %                | 50 %     |
| 20                                                                                      | Q: 1 Item für den Sieg, Slot 1 Profi             | 3   | 25,4            | 8,6             | 11,07                | 0,55                 | 10 %              | 16,11                      | 74 %                       | 56 %                | 33 %     |
| 20                                                                                      | Q: 1 Item für den Sieg, Slot 1 Profi             | 4   | 28,3            | 7,8             | 13,81                | 0,69                 | 12 %              | 17,98                      | 59 %                       | 59 %                | 25 %     |
| 20                                                                                      | R: 1 Item für den letzten Platz, Slot 1 Profi    | 2   | 22,4            | 10,0            | 8,32                 | 0,42                 | 9 %               | 12,21                      | 75 %                       | 56 %                | 50 %     |
| 20                                                                                      | R: 1 Item für den letzten Platz, Slot 1 Profi    | 3   | 25,4            | 8,5             | 11,34                | 0,57                 | 11 %              | 15,55                      | 59 %                       | 33 %                | 33 %     |
| 20                                                                                      | R: 1 Item für den letzten Platz, Slot 1 Profi    | 4   | 28,3            | 7,7             | 14,06                | 0,70                 | 12 %              | 17,98                      | 54 %                       | 38 %                | 25 %     |
| **EXP-019 D Schild gegen Fallen, sichtbare Fallen (Seeds 1–200 je Zeile)**              |
| Runden                                                                                  | Variante                                         | Sp. | Fallen gelegt   | ausgelöst       | per Schild abgewehrt | getroffen/gelegt     | Schild gegen Klau | Sabotagen/Partie           | Verlust/Einnahmen          | Spitzenopfer Münzen |
| ---                                                                                     | ---                                              | --- | ---             | ---             | ---                  | ---                  | ---               | ---                        | ---                        | ---                 |
| 10                                                                                      | A: Schild nur gegen Klau, Fallen egal (Stand M4) | 2   | 1,08            | 0,49            | 0,00                 | 46 %                 | 0,17              | 1,73                       | 3 %                        | 4,7                 |
| 10                                                                                      | A: Schild nur gegen Klau, Fallen egal (Stand M4) | 3   | 1,77            | 1,14            | 0,00                 | 64 %                 | 0,23              | 2,86                       | 5 %                        | 7,1                 |
| 10                                                                                      | A: Schild nur gegen Klau, Fallen egal (Stand M4) | 4   | 2,17            | 1,64            | 0,00                 | 75 %                 | 0,26              | 3,92                       | 6 %                        | 8,3                 |
| 10                                                                                      | B: Schild auch gegen Fallen                      | 2   | 1,08            | 0,39            | 0,10                 | 46 %                 | 0,17              | 1,63                       | 3 %                        | 4,4                 |
| 10                                                                                      | B: Schild auch gegen Fallen                      | 3   | 1,76            | 0,88            | 0,25                 | 64 %                 | 0,22              | 2,60                       | 4 %                        | 6,5                 |
| 10                                                                                      | B: Schild auch gegen Fallen                      | 4   | 2,17            | 1,25            | 0,39                 | 75 %                 | 0,24              | 3,55                       | 5 %                        | 7,8                 |
| 10                                                                                      | C: Fallen sichtbar, Bots weichen aus             | 2   | 1,10            | 0,50            | 0,00                 | 45 %                 | 0,18              | 1,68                       | 3 %                        | 4,8                 |
| 10                                                                                      | C: Fallen sichtbar, Bots weichen aus             | 3   | 1,70            | 1,07            | 0,00                 | 63 %                 | 0,24              | 2,75                       | 5 %                        | 6,7                 |
| 10                                                                                      | C: Fallen sichtbar, Bots weichen aus             | 4   | 2,21            | 1,53            | 0,00                 | 69 %                 | 0,23              | 3,54                       | 5 %                        | 8,0                 |
| 10                                                                                      | D: B + C                                         | 2   | 1,10            | 0,41            | 0,09                 | 45 %                 | 0,18              | 1,59                       | 3 %                        | 4,4                 |
| 10                                                                                      | D: B + C                                         | 3   | 1,70            | 0,81            | 0,26                 | 63 %                 | 0,23              | 2,50                       | 4 %                        | 6,1                 |
| 10                                                                                      | D: B + C                                         | 4   | 2,19            | 1,20            | 0,33                 | 70 %                 | 0,23              | 3,23                       | 5 %                        | 7,5                 |

- **Würfel 2–7 (A):** +33 % Felder je Zug, ein Drittel mehr Trophäen, weniger Spieler ohne Trophäe (10 Runden, 4 Spieler: 15 % → 7 %). Aufholeffekt und Sieg per Trophäen bleiben gleich, die Partie wird kaum länger (+0,2–0,4 min). Seit EXP-011 ist 10 der kürzeste Vorschlag; das Problem der kurzen 5-Runden-Partie gibt es so nicht mehr.
- **Trophäen-Ziel (B):** „vor die Spieler“ verkürzt die Wartezeit auf eine Trophäe (4 Spieler, 10 Runden: 6,1 → 5,2 Züge je Kauf) und senkt den Anteil ohne Trophäe (15 % → 9 %). Dafür häufen sich Trophäen-Gleichstände, und bei 4 Spielern entscheiden Trophäen seltener (67 % → 58 %). „Vor die Letzten“ hilft beim Aufholen nicht messbar (Halbzeit-Letzter gewinnt 6 % → 8 %, im Rauschen). Als Aufholhilfe für CHAOS-65 taugt das Trophäen-Ziel also nicht.
- **Item nach dem Minispiel (C):** Beide Varianten verdoppeln die Sabotage (zu zweit 0,17 → 0,35–0,38 je Runde, also etwa alle 2–3 statt alle 6 Runden) bei kleinem Gesamtschaden (Verlust 3–6 % → 7–10 % der Einnahmen bei 10 Runden, bis 12 % bei 20 Runden) und +0,3 min Partiedauer. Der Unterschied liegt bei der Fairness: Das **Sieg-Item (B)** verstärkt Können (Profi bei 4 Spielern, 20 Runden: 43 % → 59 % Siege), der **Trostpreis (L)** dämpft es (43 % → 39 % bei 10 Runden, 43 % → 38 % bei 20 Runden; 3 Spieler 53 % → 39 %). Mit 1000 Seeds (2 und 3 Spieler, 10 Runden) sinkt der Halbzeit-Vorteil mit L leicht (75 % → 72 %, 62 % → 59 %), mit B nicht (75 %, 63 %). Die Abweichung von Slot 1 bei 2 Spielern in der Tabelle (55 % gegen 43–45 %) ist Rauschen: Mit 1000 Seeds liegen A, B und L bei 49–50 %.
- **Fallen (D):** Ein Schild gegen Fallen fängt etwa ein Viertel der Fallen ab (4 Spieler: 1,64 → 1,25 ausgelöst) und senkt die ohnehin seltene Sabotage um ≈ 10 %. Sichtbare Fallen, denen Bots an Gabeln ausweichen, ändern wenig (Treffer je gelegter Falle 75 % → 69 % bei 4 Spielern): Der Wackelwald hat nur zwei Gabeln, die meisten Fallen liegen auf dem Pflichtweg.

**Entscheidung:**

- **keep L als neuer Standard:** `items.minigameLastItems: 1` in `DEFAULT_RULES`. Wer im Minispiel Letzte(r) wird, bekommt ein zufälliges Item als **Trostpreis**. Das verdoppelt das Chaos, vor allem zu zweit, ohne den Schaden je Treffer zu ändern, und arbeitet gegen den Vorsprung guter Minispieler. Sichtbar am PC auf der Ergebniskarte („Trostpreis“ mit Item) und am Handy der betroffenen Person („Trostpreis: Falle“); der Server trägt die Items in `view.minigame.rewards[].items` und im Controller-Kontext `minigame.prizes` (Protokoll v4, optionale Felder). Die Endstand-Schnappschüsse der Server-Tests und der Seed für alle Prompt-Arten (1 → 2) sind neu eingetragen (`docs/testing.md`).
- **discard B** (Sieg-Item): gleich viel Chaos wie L, aber verstärkt Können und Führung.
- **discard** Würfel 2–7: kein Bedarf mehr seit Standard 10 Runden, und einen W6 versteht jeder (EXP-001).
- **discard** `ahead-of-last` als Aufholhilfe (wirkt nicht). **iterate** `ahead`: Stellschraube bleibt im Code, Standard bleibt `random`; der Nutzen (weniger Leerläufer ohne Trophäe) steht gegen seltenere Trophäen-Siege bei 4 Spielern. Wieder ansehen, wenn der Playtest „tote“ Trophäen bemängelt.
- **discard** Schild gegen Fallen als Standard: macht die seltene Sabotage noch seltener und verbraucht den Schild ohne eigene Entscheidung. Stellschraube bleibt für den Fall, dass Sabotage im Playtest als zu hart empfunden wird.
- **keep sichtbare Fallen:** Der PC zeigt Fallen weiter an (lesbar, „Chaos sichtbar“). Versteckte Fallen brächten auf dem Wackelwald kaum Balance-Gewinn und kosten Lesbarkeit.

**Folgen für andere Experimente:** EXP-011 … EXP-013 und EXP-018 laufen auf `M4_RULES` (ohne Trostpreis); ihre Zahlen beschreiben den Stand vor EXP-019. Mit Trostpreis steigen Items und Sabotagen wie in Tabelle C, die Dauer um ≈ 0,3 min.

**Offen für Playtest:** Fühlt sich der Trostpreis wie ein Trost an oder wie Belohnung fürs Verlieren? Wird die Ergebniskarte mit Item-Zeile noch in den 6 s gelesen? Ist Sabotage zu zweit jetzt spürbar, aber nicht nervig? Bemerkt jemand Trophäen, die lange hinter allen liegen?

**Für später (CHAOS-44):** Hinweiston am Controller beim Angriff (CHAOS-122) und längeres Reaktionsfenster als Barrierefreiheits-Option (CHAOS-124). `trophy.placement: 'ahead'` nach dem Playtest. Aufholhilfe (CHAOS-65) mit dem Trostpreis neu bewerten. Trostpreis und wachsende Sabotage (EXP-018) zusammen im Playtest beurteilen: Beide machen späte Runden bissiger.

**Nachtrag 2026-11-17 (CHAOS-65):** Das genaue Trophäen-Ziel „vor die Letzten“ (`nearest-to-last`) wirkt mit 1000 Seeds deutlich; die nähere Hälfte (`ahead-of-last`) etwa halb so stark. Neuer Standard ist `nearest-to-last`, siehe [EXP-022](#exp-022-aufholhilfe-für-zurückliegende-2026-11-17-chaos-65).

---

## EXP-020: Apple TV bei 4K-Ausgabe – interne Auflösung, Hochskalierung, Profilierung (2026-11-17, CHAOS-114)

**Hypothese / gewünschtes Spielerlebnis:** Ruben bleibt bei 4K-Ausgabe (17.11.). Die RealityKit-Testszene läuft auf der Apple TV 4K (A15) mit 20 fps, die ARView braucht 34,7 ms GPU je Bild und ist pixelgebunden (EXP-017). Rendert die Szene intern mit 1920×1080 oder 2560×1440 und wird auf 4K hochskaliert, sinken die Pixelkosten auf ¼ bzw. ~45 %. Erwartung: ≥ 30 fps sicher, 60 fps bei 0,5 wahrscheinlich, bei sichtbar weicherem, aber am Fernseher aus Sofa-Abstand vertretbarem Bild. Ruben hat am 17.11. die Apple TV als Host freigegeben (ADR-019, CHAOS-74). Ohne flüssige 4K-Ausgabe erreicht ein tvOS-Host das Ziel aber nicht.

**Varianten** (`spikes/renderer-realitykit`, `--hochskalieren=1`, `messreihe-atv.sh`):

| #     | Variante                                                                                                              | Erwartete Abwägung                                                  |
| ----- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| V8    | ARView (Bezug, wie R12)                                                                                               | 20 fps, volle Schärfe                                               |
| V9    | `RealityRenderer` intern 0,5 (1920×1080) + MetalFX Spatial → 4K                                                       | schnellste Variante; weicher, MetalFX schärft nach                  |
| V10   | wie V9, bilinear statt MetalFX                                                                                        | billiger als MetalFX, sichtbar weicher; Rückfall für tvOS < 27.2    |
| V11   | intern 0,667 (2560×1440) + MetalFX                                                                                    | Mittelweg Schärfe/Kosten                                            |
| V12   | V9/V11 mit MSAA aus                                                                                                   | spart Auflösungs-Durchgang; mehr Treppen, die MetalFX teils glättet |
| V13   | `--imflug=1/2/3`                                                                                                      | Überlappung von CPU und GPU gegen Verzögerung                       |
| D1–D6 | Diagnose bei nativer 4K (`--skala=1`): MSAA, Tonemapping, IBL, `material=einfach`, `material=unbeleuchtet`, alles aus | zeigt, welcher Kostenblock die 34,7 ms trägt                        |

**Messgrößen:** Anzeige-fps sowie Median/p95 der angezeigten Bildabstände (`presentedTime`, `SPIKE-ERGEBNIS`); GPU je Bild aus dem Metal-HUD; GPU-Zeit des Hochskalierens; ausgelassene Takte. Instruments (Metal System Trace) für die Aufteilung auf RealityKit-Durchgänge. Subjektiv: Schärfe aus Sofa-Abstand (Schilder, Gras, Figurenränder) gegen ARView, `--bild=…` als Beleg.

**Testumgebung:** Apple TV 4K (3. Gen., A15), Ausgabe 3840×2160 bei 60 Hz, Release-Build, volle Szene (64 246 Instanzen), kein Seed nötig (keine Zufallsanteile).

**Stand 2026-11-17:** Prototyp und Messreihen-Skript geschrieben, **noch nicht gemessen.** Die CI (Xcode 26.6, SDK 26.5) baut den Spike für macOS, iOS und tvOS ohne Fehler. Das tvOS-SDK 26.5 enthält kein MetalFX, dort ist nur der bilineare Weg übersetzt. Gelaufen ist der Pfad noch nirgends. Die Auswertung des Skripts ist mit Beispiel-Logs geprüft. Nebenbefund zu EXP-017: Die seriellen Offscreen-Werte (720p 33,2 ms ≈ zwei Bildwechsel bei 60 Hz) sind vermutlich an den Anzeigetakt gebunden und unterschätzen die Reserve. Die überlappende Schleife misst das sauberer.

**Ergebnisse (17.11.2026, echte Apple TV 4K, tvOS 27.3, Ausgabe 3840×2160 bei 60 Hz, je 20 s, Metal-HUD):** Gemessen von Claude am Mac über `devicectl` (`messreihe-atv.sh` plus Zusatzläufe), Rohdaten im Scratchpad der Sitzung, Zusammenfassung hier und in R16–R20.

- **MetalFX ist auf der Apple TV nicht verfügbar:** Auf tvOS 27.3 mit A15 scheitert `MTLFXSpatialScaler` (Log: „nicht verfügbar für dieses Gerät/Format“), alle `metalfx`-Varianten liefen bilinear. Ob `supportsDevice` oder das Format `bgra8Unorm_srgb` scheitert, ist offen.
- **Diagnose bei nativer 4K** (GPU je Bild, Median / p95): alles an 37,4 / 87,5 ms · MSAA aus 28,2 / 63,8 · Gras aus 25,7 / 58,8 · Schatten aus 32,7 / 68,2 · Tonemapping aus 36,9 · IBL aus 38,0 · `material=einfach` 37,1 · `unbeleuchtet` 17,8 / 33,6 · alles aus 6,6 / 7,2 ms (60 fps). Die Kosten verteilen sich auf Beleuchtung/PBR, MSAA und Gras; Tonemapping, IBL und Materialvarianten zählen kaum.
- **Hochskaliert** (Anzeige-fps, GPU Median / p95):

| Variante                            | intern        | MSAA    | im Flug | fps       | GPU ms                    | ausgelassene Takte |
| ----------------------------------- | ------------- | ------- | ------- | --------- | ------------------------- | ------------------ |
| ARView (Bezug)                      | nativ         | ?       | –       | 19,0      | 34,5 / 41,6               | –                  |
| `hoch-0.5`                          | 1920×1080     | 4×      | 2       | 35,4–35,8 | 22,3 / 47,0               | 558                |
| `hoch-0.5`, im Flug 3               | 1920×1080     | 4×      | 3       | 42,6–44,7 | 21–23,5 / 48–50           | 346–386            |
| `hoch-0.5`, MSAA aus                | 1920×1080     | aus     | 2       | 39,9      | 14,6–14,9 / 36            | 453–456            |
| **`hoch-0.5`, MSAA aus, im Flug 3** | **1920×1080** | **aus** | **3**   | **59,9**  | **14,4–14,9 / 15,0–31,3** | **2–5**            |
| `hoch-0.667`, MSAA aus, im Flug 3   | 2562×1440     | aus     | 3       | 49,2      | 20,8 / 43,2               | 233                |
| `hoch-0.667`                        | 2562×1440     | 4×      | 2       | 27,7      | 29,2 / 60,9               | 740                |
| `hoch-0.5`, im Flug 1               | 1920×1080     | 4×      | 1       | 12,1      | 53,5                      | 1097               |

- **Bestätigung über 60 s** (`--skala=0.5 --msaa=0 --imflug=3`, bilinear): 59,94 fps, 3598 Bilder, größter Bildabstand **16,69 ms**, 5 ausgelassene Takte, 0 nicht angezeigt. Die Zusatzschalter Schatten, Gras, IBL und Tonemapping ändern in dieser Variante nichts (alle 59,9 fps).
- **Preis:** Von der Übergabe bis zum fertigen Bild vergehen 37,5 ms (p95 40,2 ms), also gut zwei Bilder Verzögerung durch drei Bilder im Flug. Das Bild ist ohne MSAA und mit bilinearer Hochskalierung weicher als die ARView. Wie das am Fernseher aus Sofa-Abstand wirkt, ist Rubens Urteil (Checkliste RK11).
- Nicht gemacht: Instruments (Metal System Trace, RK12); die Diagnose-Schalter haben die Kostenblöcke schon getrennt.

**Entscheidung:** **keep.** Kriterium aus CHAOS-114 (4K-Ausgabe ≥ 30 fps stabil, Ziel 60) ist erreicht: Intern 1920×1080 ohne MSAA, drei Bilder im Flug, bilinear auf 4K hält **60 fps** mit voller Szene. Das wird die Standard-Grafikstufe des nativen Hosts auf der Apple TV (CHAOS-142, CHAOS-147). Offen: Schärfe-Urteil am Fernseher (RK11), MetalFX auf tvOS (warum nicht verfügbar), Kantenglättung ohne MSAA (z. B. FXAA-Durchgang nach dem Hochskalieren) falls die Kanten stören.

---

## EXP-021: Siegerpodest ohne Standbild beim Übergang (2026-11-17, CHAOS-71)

**Hypothese / gewünschtes Spielerlebnis:** Nach der Trophäenzählung erscheint das 3D-Podest sofort, ohne dass das Bild steht. Bisher baute der Siegerbildschirm das Podest erst beim Erscheinen und übersetzte alle Shader am Stück (`whenReadyAsync`, KI-25). Annahme: Wird das Podest schon während der Zählung (≈ 14 s, mit `fast` ≈ 3,5 s) vorbereitet und werden die Shader stückweise übersetzt, kostet der Übergang selbst fast nichts.

**Testumgebung:** Sandbox-Linux, 4 Kerne, Headless-Chromium mit SwiftShader (`--use-angle=swiftshader`, **kein** `KHR_parallel_shader_compile`), 1280×720, Production-Build, lokaler Brett-Modus mit Testhaken (`/host/?local=1&board=1&test=1`, Endstand wie `host-finale.spec.ts`). Stufe `hoch` über einen temporären Schalter (im Testmodus sonst immer `minimal`, nicht eingecheckt). Gemessen: Long Tasks (`PerformanceObserver`, > 50 ms) und gelinkte WebGL-Programme je Phase; frischer Browser je Lauf (mehrere Seiten in einem Browser teilen sich den GPU-Prozess, das Aufräumen der Vorgängerseite erzeugte 5–22-s-Ausreißer). Messskript im Scratchpad, nicht eingecheckt.

**Varianten:**

| Variante                                                                                                                  | Übergang zum Podest (Sparstufe `minimal`)                  | Übergang (Stufe `hoch`)                                                      | Während der Zählung                                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A: alt – Aufbau am Siegerbildschirm, `whenReadyAsync` am Stück                                                            | 3 Blöcke, längster **0,84–1,04 s**, Summe 1,35–1,6 s       | längster 1,0–1,2 s; 2 von 3 Läufen ein 21–22-s-Block (GPU-Prozess, Texturen) | –                                                                                                                                                                                                                                  |
| B: Aufbau während der Zählung, je Mesh ein Schritt, unfertige in weiteren Runden, Rest per `whenReadyAsync` (**gewählt**) | **35–47 ms**, kein Long Task                               | **46–110 ms**, kein Long Task                                                | viele 50–90-ms-Blöcke, längster 0,2–1,1 s (`minimal`) bzw. 1,0–1,3 s (`hoch`, Rest in `whenReadyAsync`)                                                                                                                            |
| C: wie B, zusätzlich Schattenkarten, Tiefenkarte, Schein und Nachbearbeitung einzeln                                      | wie B                                                      | wie B                                                                        | Vorbereitung in ≤ 100-ms-Stücken, dafür **erstes Bild 2,9–3,3 s**: Die einzelnen Bereitschaftsprüfungen außerhalb ihres Render-Passes melden „bereit“, die 20 Programme entstehen erst beim Zeichnen und kosten dort das Dreifache |
| B ohne Zählung (`?finale=skip`, „Überspringen“ sofort)                                                                    | 9–14 kleine Blöcke, längster 0,22–0,28 s (ein Lauf 1,75 s) | längster 1,1–1,3 s                                                           | –                                                                                                                                                                                                                                  |

- Babylon 9 lädt Shader-Quellen nach: Der erste `isReady` eines Materials meldet „nicht bereit“ ohne Übersetzung. Ohne zweite Runde blieb alles für `whenReadyAsync` übrig.
- `isReady` je Mesh muss im Render-Pass der Kamera laufen (`engine.currentRenderPassId`), sonst übersetzt `whenReadyAsync` alles noch einmal.
- Mit `KHR_parallel_shader_compile` (Chrome auf D3D11 und Metal) stößt jeder Schritt die Übersetzung nur an; dort ist der Gewinn vor allem, dass die Arbeit in die Zählung fällt.

**Entscheidung:** keep B. `scene/prepareGradually.ts` (Abschnitte ≈ 12 ms, Bildpause dazwischen, Runden für unfertige Schritte), Podest mit `show()`/`hide()` und ohne Render-Schleife bis zum Einhängen, Finale baut es zu Beginn der Zählung auf einem unsichtbaren Parkplatz gleicher Größe. C verworfen (teurer). Der verbleibende Block bis ≈ 1 s während der Zählung (Rest in `whenReadyAsync`: Tiefenkarte, Schein, Nachbearbeitung) trifft nur die 2D-Zählung, nicht den Übergang.

**Offen (nur auf echter Hardware):** Standbild beim Übergang auf Rubens PC (Gerätecheckliste LS3). Die Minispiel-Bühne baut weiterhin am Stück (KI-25).

---

## EXP-022: Aufholhilfe für Zurückliegende (2026-11-17, CHAOS-65)

**Hypothese / gewünschtes Spielerlebnis:** Wer zur Halbzeit führt, soll im Vorteil sein, aber nicht fast sicher gewinnen. Laut EXP-012 gewinnt der alleinige Halbzeit-Führende bei 10 Runden 59–73 % der Partien (fair 25–50 %), und 7–13 % der Spieler bleiben ohne Trophäe. Eine Aufholhilfe soll Comebacks häufiger machen, ohne dass der Trophäen-Sieg (Produktsäule) verwässert oder Können in Minispielen nichts mehr zählt. Eine Trostmünze (EXP-012, Variante D) half nicht. Erwartung: Hilfen am Brett (wo die Trophäe hinwandert) wirken stärker als kleine Münzbeträge.

**Varianten** (Basis = aktueller Standard ohne Aufholhilfe, also mit wachsender Sabotage aus EXP-018 und Trostpreis aus EXP-019):

- A: Basis, Trophäe wandert zufällig.
- T: **Trophäe wandert vor die Letzten** (`trophy.placement: 'nearest-to-last'`): Eine gekaufte oder vom Wirbel bewegte Trophäe springt auf genau das freie Trophäenfeld, das vor der bzw. dem Letzten am nächsten liegt. Keine neue Anzeige nötig.
- H: die **nähere Hälfte** der freien Felder vor den Letzten (`'ahead-of-last'` aus EXP-019), zum Vergleich.
- T2: Trophäe wandert **weg von der Spitze** (`'away-from-leader'`): auf das freie Feld, das von Platz 1 am weitesten entfernt ist.
- R: **Rabatt** (`catchUp.discount`): Preis 10 statt 15 ab 2 Trophäen Rückstand. Bräuchte einen Preis je Spieler in der Anzeige.
- W / W3: **Rückenwind** (`catchUp.tailwind`): Nach jedem Minispiel außer dem letzten 2 (3) Münzen je Trophäe Rückstand, höchstens 6 (9). Bräuchte einen sichtbaren Moment („Rückenwind +4“).
- F: **Finale-Fieber** (`catchUp.finale`): In den letzten 3 Runden zählen Minispiel-Münzen doppelt.
- X: **Bonus-Trophäen** am Ende: Die Titel „Minispiel-Ass“ und „Pechvogel“ vom Siegerbildschirm geben je eine Trophäe (nur nachgerechnet, keine Regel). „Pechvogel“ zählt hier Verluste ohne Trophäenkauf. Seit CHAOS-123 zählt `coinsLost` selbst nur Pech (Minus-Feld, Klau, Falle); ein Nachlauf auf `main` `82a1a0b` ergab für X mit der alten Näherung und mit der neuen Zählung dieselben Zahlen.
- TW, T2W, TW3: Kombinationen.

**Objektive Messgrößen:** Siegquote des alleinigen Halbzeit-Führenden bzw. -Letzten (gegen fair 1/n), Trophäen je Partie, Anteil Spieler ohne Trophäe, Sieg per Trophäen (statt Münzen), Trophäen-Abstand Platz 1 zu 2, Siegquote eines Minispiel-Profis (Slot 1, +10 von 40 Punkten, wie EXP-012 S; eigener Lauf je Zeile).

**Subjektive Playtest-Fragen (für Ruben):** Merkt jemand, dass die Trophäe den Letzten entgegenkommt? Wirkt das wie Glück („die Trophäe hat Mitleid“) oder wie Schummeln? Fühlt sich ein Comeback verdient an? Ist ein knapper Endstand spannender, oder nervt es, wenn die Münzen öfter entscheiden?

**Testumgebung:** Node 22.23, Linux-Container, Branch `claude/confident-bardeen-lui8oc`, Basis `main` `0e34732` (mit EXP-018 und EXP-019). Brett Wackelwald, Rotation mit vier Minispielen, Bots wie EXP-012 (`EXPERIMENT_POLICY`). **Seeds 1–1000** je Zeile (mit 200 Seeds schwankt die Führenden-Quote um ±4 Punkte, die Effekte liegen bei 5–15). Dauer ≈ 2 min:

```sh
EXPERIMENTS=catchup pnpm exec vitest run packages/game-core/src/rules/experimentsCatchUp.test.ts --silent=false
```

Code: Varianten in `packages/game-core/src/rules/experimentsCatchUp.ts`. Regeln in `economy.ts`: `wanderTargets` (Trophäen-Ziel), `trophyPrice` (Rabatt), `applyTailwind` (Rückenwind). Außerdem `minigame.ts` (Finale-Fieber) und `machine.ts` (Zeitpunkt Rückenwind). Tests in `catchUp.test.ts`. Ein erster Lauf vor EXP-018/019 (Basis `3703994`) ergab dieselbe Rangfolge (A 75/62/56 %, T 66/56/54 %).

**Ergebnisse:**

| Runden | Variante                                              | Sp. | Führender (Hälfte) gewinnt | Letzter (Hälfte) gewinnt | fair 1/n | Trophäen/Partie | ohne Trophäe | Sieg per Trophäen | Abstand P1–P2 | Profi gewinnt |
| ------ | ----------------------------------------------------- | --- | -------------------------- | ------------------------ | -------- | --------------- | ------------ | ----------------- | ------------- | ------------- |
| 10     | A: Basis (keine Aufholhilfe)                          | 2   | 72 %                       | 28 %                     | 50 %     | 5,39            | 4 %          | 85 %              | 1,73          | 57 %          |
| 10     | A: Basis (keine Aufholhilfe)                          | 3   | 59 %                       | 15 %                     | 33 %     | 6,44            | 9 %          | 74 %              | 1,21          | 44 %          |
| 10     | A: Basis (keine Aufholhilfe)                          | 4   | 54 %                       | 7 %                      | 25 %     | 7,13            | 12 %         | 66 %              | 0,89          | 40 %          |
| 10     | T: Trophäe wandert vor die Letzten                    | 2   | 64 %                       | 36 %                     | 50 %     | 6,57            | 1 %          | 76 %              | 1,34          | 56 %          |
| 10     | T: Trophäe wandert vor die Letzten                    | 3   | 57 %                       | 18 %                     | 33 %     | 8,05            | 2 %          | 68 %              | 1,00          | 46 %          |
| 10     | T: Trophäe wandert vor die Letzten                    | 4   | 51 %                       | 10 %                     | 25 %     | 8,72            | 3 %          | 63 %              | 0,83          | 47 %          |
| 10     | H: nähere Hälfte vor den Letzten (EXP-019)            | 2   | 68 %                       | 33 %                     | 50 %     | 5,84            | 2 %          | 80 %              | 1,59          | 55 %          |
| 10     | H: nähere Hälfte vor den Letzten (EXP-019)            | 3   | 59 %                       | 15 %                     | 33 %     | 7,01            | 5 %          | 76 %              | 1,21          | 43 %          |
| 10     | H: nähere Hälfte vor den Letzten (EXP-019)            | 4   | 52 %                       | 8 %                      | 25 %     | 7,50            | 9 %          | 66 %              | 0,91          | 43 %          |
| 10     | T2: Trophäe wandert weg von der Spitze                | 2   | 61 %                       | 39 %                     | 50 %     | 4,95            | 3 %          | 73 %              | 1,14          | 54 %          |
| 10     | T2: Trophäe wandert weg von der Spitze                | 3   | 46 %                       | 19 %                     | 33 %     | 6,49            | 5 %          | 61 %              | 0,77          | 42 %          |
| 10     | T2: Trophäe wandert weg von der Spitze                | 4   | 43 %                       | 10 %                     | 25 %     | 7,27            | 7 %          | 51 %              | 0,59          | 38 %          |
| 10     | R: Rabatt: Preis 10 ab 2 Trophäen Rückstand           | 2   | 71 %                       | 29 %                     | 50 %     | 5,41            | 4 %          | 85 %              | 1,73          | 56 %          |
| 10     | R: Rabatt: Preis 10 ab 2 Trophäen Rückstand           | 3   | 55 %                       | 16 %                     | 33 %     | 6,46            | 9 %          | 72 %              | 1,19          | 44 %          |
| 10     | R: Rabatt: Preis 10 ab 2 Trophäen Rückstand           | 4   | 52 %                       | 8 %                      | 25 %     | 7,21            | 12 %         | 65 %              | 0,87          | 40 %          |
| 10     | W: Rückenwind: 2 Münzen je Trophäe Rückstand, max. 6  | 2   | 69 %                       | 31 %                     | 50 %     | 5,41            | 4 %          | 85 %              | 1,74          | 56 %          |
| 10     | W: Rückenwind: 2 Münzen je Trophäe Rückstand, max. 6  | 3   | 54 %                       | 17 %                     | 33 %     | 6,51            | 9 %          | 72 %              | 1,19          | 43 %          |
| 10     | W: Rückenwind: 2 Münzen je Trophäe Rückstand, max. 6  | 4   | 48 %                       | 10 %                     | 25 %     | 7,37            | 12 %         | 64 %              | 0,88          | 37 %          |
| 10     | W3: Rückenwind: 3 Münzen je Trophäe Rückstand, max. 9 | 2   | 69 %                       | 31 %                     | 50 %     | 5,42            | 4 %          | 85 %              | 1,74          | 55 %          |
| 10     | W3: Rückenwind: 3 Münzen je Trophäe Rückstand, max. 9 | 3   | 52 %                       | 18 %                     | 33 %     | 6,52            | 9 %          | 72 %              | 1,19          | 42 %          |
| 10     | W3: Rückenwind: 3 Münzen je Trophäe Rückstand, max. 9 | 4   | 46 %                       | 11 %                     | 25 %     | 7,46            | 12 %         | 67 %              | 0,91          | 36 %          |
| 10     | F: Finale-Fieber: letzte 3 Runden Minispiel-Münzen ×2 | 2   | 72 %                       | 28 %                     | 50 %     | 5,45            | 4 %          | 86 %              | 1,78          | 57 %          |
| 10     | F: Finale-Fieber: letzte 3 Runden Minispiel-Münzen ×2 | 3   | 57 %                       | 15 %                     | 33 %     | 6,51            | 9 %          | 74 %              | 1,25          | 43 %          |
| 10     | F: Finale-Fieber: letzte 3 Runden Minispiel-Münzen ×2 | 4   | 53 %                       | 7 %                      | 25 %     | 7,28            | 12 %         | 67 %              | 0,95          | 38 %          |
| 10     | X: Bonus-Trophäen: Minispiel-Ass + Pechvogel          | 2   | 68 %                       | 32 %                     | 50 %     | 5,39            | 1 %          | 85 %              | 2,01          | 76 %          |
| 10     | X: Bonus-Trophäen: Minispiel-Ass + Pechvogel          | 3   | 53 %                       | 18 %                     | 33 %     | 6,44            | 3 %          | 75 %              | 1,35          | 68 %          |
| 10     | X: Bonus-Trophäen: Minispiel-Ass + Pechvogel          | 4   | 46 %                       | 10 %                     | 25 %     | 7,13            | 5 %          | 71 %              | 1,12          | 65 %          |
| 10     | TW: T + W                                             | 2   | 62 %                       | 38 %                     | 50 %     | 6,64            | 1 %          | 75 %              | 1,35          | 55 %          |
| 10     | TW: T + W                                             | 3   | 52 %                       | 21 %                     | 33 %     | 8,26            | 2 %          | 68 %              | 0,99          | 43 %          |
| 10     | TW: T + W                                             | 4   | 45 %                       | 15 %                     | 25 %     | 9,23            | 3 %          | 62 %              | 0,80          | 40 %          |
| 10     | T2W: T2 + W                                           | 2   | 60 %                       | 40 %                     | 50 %     | 4,97            | 3 %          | 73 %              | 1,16          | 54 %          |
| 10     | T2W: T2 + W                                           | 3   | 45 %                       | 23 %                     | 33 %     | 6,56            | 5 %          | 61 %              | 0,77          | 40 %          |
| 10     | T2W: T2 + W                                           | 4   | 39 %                       | 13 %                     | 25 %     | 7,51            | 8 %          | 49 %              | 0,56          | 35 %          |
| 10     | TW3: T + W3                                           | 2   | 62 %                       | 38 %                     | 50 %     | 6,67            | 1 %          | 74 %              | 1,35          | 55 %          |
| 10     | TW3: T + W3                                           | 3   | 51 %                       | 21 %                     | 33 %     | 8,32            | 2 %          | 69 %              | 1,02          | 41 %          |
| 10     | TW3: T + W3                                           | 4   | 42 %                       | 17 %                     | 25 %     | 9,43            | 3 %          | 60 %              | 0,77          | 39 %          |
| 20     | A: Basis (keine Aufholhilfe)                          | 2   | 73 %                       | 27 %                     | 50 %     | 12,70           | 0 %          | 89 %              | 2,67          | 54 %          |
| 20     | A: Basis (keine Aufholhilfe)                          | 3   | 62 %                       | 13 %                     | 33 %     | 15,90           | 1 %          | 84 %              | 1,96          | 39 %          |
| 20     | A: Basis (keine Aufholhilfe)                          | 4   | 52 %                       | 7 %                      | 25 %     | 18,16           | 1 %          | 75 %              | 1,32          | 38 %          |
| 20     | T: Trophäe wandert vor die Letzten                    | 2   | 65 %                       | 35 %                     | 50 %     | 15,29           | 0 %          | 76 %              | 1,62          | 55 %          |
| 20     | T: Trophäe wandert vor die Letzten                    | 3   | 51 %                       | 20 %                     | 33 %     | 19,25           | 0 %          | 77 %              | 1,42          | 44 %          |
| 20     | T: Trophäe wandert vor die Letzten                    | 4   | 51 %                       | 10 %                     | 25 %     | 21,32           | 0 %          | 70 %              | 1,13          | 45 %          |
| 20     | H: nähere Hälfte vor den Letzten (EXP-019)            | 2   | 70 %                       | 31 %                     | 50 %     | 13,82           | 0 %          | 85 %              | 2,36          | 52 %          |
| 20     | H: nähere Hälfte vor den Letzten (EXP-019)            | 3   | 58 %                       | 15 %                     | 33 %     | 17,20           | 0 %          | 81 %              | 1,71          | 38 %          |
| 20     | H: nähere Hälfte vor den Letzten (EXP-019)            | 4   | 53 %                       | 9 %                      | 25 %     | 19,10           | 0 %          | 78 %              | 1,38          | 44 %          |
| 20     | T2: Trophäe wandert weg von der Spitze                | 2   | 61 %                       | 39 %                     | 50 %     | 11,32           | 0 %          | 74 %              | 1,41          | 49 %          |
| 20     | T2: Trophäe wandert weg von der Spitze                | 3   | 44 %                       | 21 %                     | 33 %     | 15,44           | 0 %          | 66 %              | 0,94          | 36 %          |
| 20     | T2: Trophäe wandert weg von der Spitze                | 4   | 36 %                       | 14 %                     | 25 %     | 18,24           | 0 %          | 59 %              | 0,73          | 34 %          |
| 20     | R: Rabatt: Preis 10 ab 2 Trophäen Rückstand           | 2   | 72 %                       | 28 %                     | 50 %     | 12,71           | 0 %          | 88 %              | 2,67          | 54 %          |
| 20     | R: Rabatt: Preis 10 ab 2 Trophäen Rückstand           | 3   | 59 %                       | 13 %                     | 33 %     | 15,95           | 1 %          | 83 %              | 1,95          | 39 %          |
| 20     | R: Rabatt: Preis 10 ab 2 Trophäen Rückstand           | 4   | 48 %                       | 8 %                      | 25 %     | 18,45           | 1 %          | 76 %              | 1,31          | 36 %          |
| 20     | W: Rückenwind: 2 Münzen je Trophäe Rückstand, max. 6  | 2   | 71 %                       | 29 %                     | 50 %     | 12,73           | 0 %          | 89 %              | 2,69          | 51 %          |
| 20     | W: Rückenwind: 2 Münzen je Trophäe Rückstand, max. 6  | 3   | 58 %                       | 14 %                     | 33 %     | 16,03           | 1 %          | 84 %              | 1,97          | 36 %          |
| 20     | W: Rückenwind: 2 Münzen je Trophäe Rückstand, max. 6  | 4   | 46 %                       | 10 %                     | 25 %     | 18,84           | 1 %          | 75 %              | 1,36          | 33 %          |
| 20     | W3: Rückenwind: 3 Münzen je Trophäe Rückstand, max. 9 | 2   | 71 %                       | 29 %                     | 50 %     | 12,76           | 0 %          | 89 %              | 2,70          | 51 %          |
| 20     | W3: Rückenwind: 3 Münzen je Trophäe Rückstand, max. 9 | 3   | 57 %                       | 14 %                     | 33 %     | 16,04           | 1 %          | 84 %              | 2,00          | 36 %          |
| 20     | W3: Rückenwind: 3 Münzen je Trophäe Rückstand, max. 9 | 4   | 46 %                       | 11 %                     | 25 %     | 19,07           | 1 %          | 76 %              | 1,41          | 31 %          |
| 20     | F: Finale-Fieber: letzte 3 Runden Minispiel-Münzen ×2 | 2   | 74 %                       | 26 %                     | 50 %     | 12,72           | 0 %          | 89 %              | 2,69          | 54 %          |
| 20     | F: Finale-Fieber: letzte 3 Runden Minispiel-Münzen ×2 | 3   | 61 %                       | 12 %                     | 33 %     | 15,93           | 1 %          | 84 %              | 1,99          | 39 %          |
| 20     | F: Finale-Fieber: letzte 3 Runden Minispiel-Münzen ×2 | 4   | 51 %                       | 7 %                      | 25 %     | 18,25           | 1 %          | 76 %              | 1,36          | 38 %          |
| 20     | X: Bonus-Trophäen: Minispiel-Ass + Pechvogel          | 2   | 71 %                       | 28 %                     | 50 %     | 12,70           | 0 %          | 89 %              | 2,88          | 69 %          |
| 20     | X: Bonus-Trophäen: Minispiel-Ass + Pechvogel          | 3   | 59 %                       | 14 %                     | 33 %     | 15,90           | 0 %          | 84 %              | 2,02          | 61 %          |
| 20     | X: Bonus-Trophäen: Minispiel-Ass + Pechvogel          | 4   | 49 %                       | 9 %                      | 25 %     | 18,16           | 0 %          | 76 %              | 1,44          | 61 %          |
| 20     | TW: T + W                                             | 2   | 64 %                       | 36 %                     | 50 %     | 15,45           | 0 %          | 79 %              | 1,69          | 52 %          |
| 20     | TW: T + W                                             | 3   | 49 %                       | 23 %                     | 33 %     | 19,86           | 0 %          | 75 %              | 1,37          | 38 %          |
| 20     | TW: T + W                                             | 4   | 35 %                       | 18 %                     | 25 %     | 22,74           | 0 %          | 69 %              | 1,10          | 37 %          |
| 20     | T2W: T2 + W                                           | 2   | 58 %                       | 42 %                     | 50 %     | 11,37           | 0 %          | 75 %              | 1,41          | 47 %          |
| 20     | T2W: T2 + W                                           | 3   | 44 %                       | 23 %                     | 33 %     | 15,56           | 0 %          | 66 %              | 0,95          | 35 %          |
| 20     | T2W: T2 + W                                           | 4   | 33 %                       | 17 %                     | 25 %     | 18,82           | 0 %          | 58 %              | 0,73          | 30 %          |
| 20     | TW3: T + W3                                           | 2   | 64 %                       | 36 %                     | 50 %     | 15,54           | 0 %          | 80 %              | 1,69          | 51 %          |
| 20     | TW3: T + W3                                           | 3   | 46 %                       | 24 %                     | 33 %     | 20,03           | 0 %          | 76 %              | 1,40          | 36 %          |
| 20     | TW3: T + W3                                           | 4   | 34 %                       | 19 %                     | 25 %     | 23,34           | 0 %          | 69 %              | 1,11          | 35 %          |

- **Rabatt (R) und Finale-Fieber (F) wirken kaum** (≤ 4 Punkte, meist im Rauschen). Wer weit hinten liegt, hat selten genug Münzen und steht selten an einer Trophäe; doppelte Minispiel-Münzen gehen genauso oft an die Führenden.
- **Rückenwind (W, W3)** hilft vor allem zu viert (54 → 48 bzw. 46 %), zu zweit wenig (72 → 69 %).
- **Trophäe vor die Letzten (T)** ist der stärkste Hebel ohne neue Anzeige: zu zweit 72 → 64 %, zu dritt 59 → 57 %, zu viert 54 → 51 % (bei 20 Runden 73/62/52 → 65/51/51 %). Der Nebeneffekt ist erwünscht: Ohne Trophäe bleiben nur noch 1–3 % statt 4–12 % der Spieler, je Partie werden 1,2–1,6 Trophäen mehr gekauft. Die Münzen entscheiden etwas öfter (Sieg per Trophäen 85/74/66 → 76/68/63 %), der Profi gewinnt gleich oft oder etwas öfter.
- **Die nähere Hälfte (H, EXP-019)** wirkt nur etwa halb so stark (68/59/52 %, ohne Trophäe 2/5/9 %). Das erklärt, warum EXP-019 mit 200 Seeds keinen messbaren Aufholeffekt sah: Unter mehreren nahen Feldern landet die Trophäe oft vor jemand anderem.
- **T2 (weg von der Spitze)** dämpft stärker (61/46/43 %), lässt aber zu viert in jeder zweiten Partie die Münzen entscheiden (Sieg per Trophäen 51 %, Abstand P1–P2 0,59 Trophäen). Das schwächt den Trophäen-Sieg.
- **Bonus-Trophäen (X)** dämpfen mäßig (68/53/46 %), belohnen aber vor allem Minispiel-Können: Der Profi gewinnt 65–76 % statt 40–57 %. Das ist eine Können-Prämie, keine Aufholhilfe.
- **Kombinationen:** TW 62/52/45 %, TW3 62/51/42 %, T2W 60/45/39 %. Rückenwind ergänzt T vor allem zu viert (20 Runden: TW 35 %).

**Entscheidung:** **keep T** als neuer Standard (`trophy.placement: 'nearest-to-last'` in `packages/game-core/src/rules/defaults.ts`). Begründung: Die Hilfe ist unaufdringlich (die Trophäe wandert schon immer, nur das Ziel ist nicht mehr zufällig), braucht keine neue Anzeige und keine Protokolländerung und hilft genau dort, wo Frust entsteht: Kaum noch jemand geht ohne Trophäe nach Hause. Der Halbzeit-Führende bleibt im Vorteil (zu zweit 64 % statt fair 50 %), Comebacks werden aber häufiger. Minispiel-Können zählt weiter. Die schwächere Form H (EXP-019) bleibt als Stellschraube. **iterate W** (Rückenwind) als nächster Hebel für 3–4 Spieler: bleibt als abschaltbare Stellschraube `catchUp.tailwind` im Regelwerk, Standard aus, weil er erst mit einer sichtbaren Ansage am PC verständlich wäre (CHAOS-125). **discard** R, F, X und T2: R und F wirkungslos; X belohnt Können statt Rückstand; T2 schwächt den Trophäen-Sieg. Die Stellschrauben `catchUp.discount`, `catchUp.finale` und `placement: 'away-from-leader'` bleiben für spätere Experimente im Regelwerk (Standard aus).

**Offen für Playtest:** Fällt das Entgegenkommen der Trophäe auf, und stört es? Ist der Halbzeit-Vorteil zu dritt und zu viert (57 bzw. 51 %) noch zu stark? Dann zuerst Rückenwind mit Ansage (TW: 52/45 %). Entscheiden die Münzen jetzt zu oft?

**Nachtrag 2026-11-17 (CHAOS-125): Rückenwind mit Ansage, Standard weiter aus.** Ein Playtest-Ergebnis gibt es noch nicht. Ruben hat entschieden: Die Ansage wird jetzt gebaut, der Standard bleibt aus, bis der Playtest zeigt, dass der Halbzeit-Vorteil zu dritt oder zu viert zu stark ist.

- **Regel unverändert** (W: 2 Münzen je Trophäe Rückstand, höchstens 6, nach jedem Minispiel außer dem letzten). Die Münzen haben jetzt den eigenen Grund `tailwind` statt `event`; die Zahlen aus der Simulation oben gelten weiter.
- **Am PC:** Im Rundenende erscheint mittig die Karte „Rückenwind!“ mit allen, die Münzen bekommen (meiste zuerst), dazu Münz-Popups an den Figuren und Ticker „Rückenwind: Blau +4 Münzen“. Das Rundenende dauert dann 3,5 s länger (`pacing.tailwindMs`), damit man die Karte lesen kann.
- **Am Controller:** „Rückenwind: +4 Münzen!“ mit kurzer Erklärung, nur bei denen, die Münzen bekommen (Web und native iPhone-App).
- **Einschalten für den Playtest:** `RUECKENWIND=1 pnpm start` (Server, `withTailwind()`); dauerhaft einschalten hieße `catchUp: { tailwind: TAILWIND_RULE }` in `DEFAULT_RULES` und die Determinismus-Tests anpassen.
- **Belege:** `tests/e2e/__screenshots__/host-brett.spec.ts/host-brett-rueckenwind-chromium-linux.png`, `tests/e2e/__screenshots__/controller-brett.spec.ts/brett-rueckenwind-iphone-*-linux.png`.

**Entscheidung:** iterate W (unverändert). Ansage fertig, Standard aus. **Offen für Playtest (mit `RUECKENWIND=1`):** Versteht man die Karte ohne Erklärung? Fühlt es sich fair an oder wie Mitleid? Kippt es zu dritt oder zu viert zu stark zu den Letzten?

---

## EXP-023: Krümel-Kehraus überarbeitet – Physik mit festen Ecken statt Absturzlücken (2026-11-17, CHAOS-79)

**Anlass:** CHAOS-79 hält die drei übrigen in M3 verworfenen Konzepte als Kandidaten fest. Nach Rubens Freigabe des Minispiel-Ausbaus (CHAOS-80/82) ist mehr Vielfalt ausdrücklich gewünscht. Gewählt wurde **Krümel-Kehraus**: Aufzieh-Takt ist als MG-090 „Aufzieh-Wettlauf“ in Familien-Welle 9 eingeplant (CHAOS-102), Geysir-Gier in Welle 11 (CHAOS-104). Krümel-Kehraus kam nirgends vor, und Physik ist laut Katalog eine Lücke (CHAOS-93). Bisher gab es nur ein Physik-Minispiel (Pudding-Gerangel).

**Hypothese / gewünschtes Spielerlebnis:** Ein Schiebe-Physikspiel wird lesbar und fair, wenn die Kritik aus EXP-006 behoben ist: **feste Ziele in den Ecken** statt Lücken im Rand, **niemand fällt herunter**, **weniger Krümel**. Die Erkenntnisse aus EXP-016 helfen gegen Zufall und Gleichstand: **sichtbares Glück** (Goldkrümel, Krümel fallen an zufälligen Stellen neu herein) gibt Schwächeren Chancen und senkt Gleichstände, und ein **Eindringling-Test** sucht dominante Störstrategien. Erwartung vorher: weniger Gleichstände als B (28–31 %), ein schwacher Bot gewinnt gelegentlich, keine Stürze, keine Strategie schlägt das normale Schieben.

**Was aus EXP-006 und EXP-016 übernommen wurde:**

- _EXP-006, B:_ 10 Krümel, 4 Lücken und ein Knäuel waren unübersichtlich, Bots fielen 7–16-mal je Runde durch die eigene Lücke, 28–38 % geteilte Siege. Deshalb jetzt ein rechteckiges Holzblech mit hohem Rand und ein Mauseloch je Person in einer **festen Ecke**. Die Öffnung ist schräg, ein Sturz in Slot-Farbe liegt darüber: Krümel passen darunter durch, Figuren nicht. Statt 10 liegen 6 Krümel aus, das Knäuel ist nur noch eine Variante (R6).
- _EXP-016:_ Türglück hat Schwächeren geholfen und Gleichstände gesenkt. Hier entsteht Glück, weil getroffene Krümel nach 0,7 s an einer zufälligen Stelle von oben neu hereinfallen, und durch einen **Goldkrümel** (zählt 3), der nach 6 s erscheint und 6 s nach jedem Treffer wiederkommt. Als sichtbares Finale wie „Mitternacht“ dient der **Keksregen**: In den letzten 8 s zerbröselt ein Riesenkeks, 6 Krümel fallen im Kreis um die Mitte. Den Eindringling-Test gibt es auch hier.

**Regeln (gewählte Fassung R3, `KRUEMEL_RULES` in `packages/minigames/src/kruemel-kehraus/logic.ts`):**

- Blech 14 × 9 m, Rand 1 m hoch (dahinter eine unsichtbare Kollisionswand bis 3,2 m). Löcher bei 2 Personen in diagonalen Ecken, bei 4 in allen Ecken. Bei 3 Personen vorn links, vorn rechts und als 90°-Kerbe mitten in der Rückwand (gespiegelte Ecke, siehe „Ecken-Fairness“). Geschlossene Ecken sind abgeschrägt.
- Neue Krümel fallen bei 2 und 4 Personen irgendwo in die Innenfläche, bei 3 Personen in ein Feld um z = 0,8 (6 × 3,2 m), damit alle drei Löcher gleich oft treffen.
- Ein Krümel zählt für die Person der Ecke, sobald seine Mitte hinter der Schräge liegt, egal wer ihn geschoben hat. Krümel in fremden Löchern sind ein Geschenk an diese Person (Höhepunkt „schob 3 Krümel in fremde Löcher“).
- Stick = Laufen, A = Rempeln. Bewegung und Rempler sind dieselben wie bei Pudding-Gerangel (`PAWN`). Ein Rempler schießt Krümel weg und schubst Figuren, es gibt keinen Führungsbonus.
- 30 s, Punkte = Krümel (Gold 3).

**Varianten** (alle auf der **echten Spiellogik**, Varianten = Regel-Sätze; B ist der alte Prototyp aus EXP-006 mit denselben Bots):

- B: alt (runder Tisch, 10 Krümel, Lücken im Rand, Knäuel)
- R1: Blech, Ecken-Löcher, 6 Krümel · R2: R1 + Goldkrümel · **R3: R2 + Keksregen (gewählt)**
- R4/R5: R3 mit 4 bzw. 9 Krümeln · R6: R3 + Wollknäuel (alle 5 s quer übers Blech gekickt)

**Objektive Messgrößen:** Punkte des Siegers, Abstand Platz 1–2 (relativ), Gleichstand auf Platz 1, Führungswechsel, Comeback (Sieger führte nach 2/3 der Zeit nicht allein), Siegquote eines schwachen Bots (Platz reihum, geteilte Siege anteilig) gegen den fairen Anteil 1/n, Treffer je Runde, Krümel in fremden Löchern, Rempler, Stürze, Instabilitäten (NaN, Durchtunneln, Körper außerhalb des Blechs, Reste nach `dispose()`), Höchsttempo, Rechenzeit je Schritt. Dazu knappe Besetzungen (Duell normal gegen etwas schwächer, 4× normal), die Siegquote je Ecke unter gleich Starken und der Eindringling-Test aus EXP-016: eine Strategie gegen zwei normale Bots (3 Spieler, alle Können normal, Platz reihum), Faktor > 1 schlägt die normale Spielweise.

**Bots:** Können-Stufen aus EXP-006 (`SKILLS`: normal, etwas schwächer, schwach: Neuplanung alle 10/14/24 Schritte, Zielstreuung 0,25/0,35/0,6 rad, Rempelneigung 0,6/0,45/0,3). Strategie „normal“: Krümel mit dem besten Verhältnis aus Weg und Lochabstand wählen (Gold zählt als 2,5 m näher), sich dahinter stellen und Richtung eigenes Loch schieben, an Wänden entlang statt hinein. Bei guter Linie wird der Krümel mit einem Rempler geschossen. Drückt jemand am selben Krümel dagegen, wird gerempelt. Eindringlinge: _Torsteher_ (stellt sich vor das Loch der führenden anderen Person), _Dauerrempler_ (schiebt normal, rempelt aber, sobald es geht), _Raufbold_ (jagt und rempelt die führende Person statt Krümel zu schieben). Bots sehen nur, was ein Mensch am Fernseher sieht. Ihre Werte sind Annahmen, nicht gemessen.

**Testumgebung:** Node 22, Vitest, Havok (WASM) mit NullEngine, Linux-Container, fester Schritt 1/60 s. Seeds 1–150 je Zeile, 30 s je Partie. Wegen eines Speicherlecks im Headless-Harness (siehe unten) läuft die Messung in Teilen, jeder Teil in einem eigenen Prozess (gesamt ≈ 25 min bei 3 parallelen Prozessen):

```sh
EXPERIMENTS=1 KRUEMEL_SEEDS=150 KRUEMEL_TABLES=main KRUEMEL_ONLY=R3 pnpm exec vitest run packages/minigames/src/prototypes/physics/experimentKruemel --silent=false
```

`KRUEMEL_TABLES` = `main`, `close`, `seat`, `intruder` (Standard: alle), `KRUEMEL_ONLY` = Varianten-IDs. Code: `packages/minigames/src/prototypes/physics/kruemelKehrausBot.ts` (Bots), `experimentKruemel.ts` (Varianten und Tabellen). Ohne `EXPERIMENTS=1` läuft nur ein Smoke-Test (Teil von `pnpm test`). Rauschen: Bei 150 Seeds liegt der Standardfehler einer Quote um 20 % bei ≈ 3 Prozentpunkten, um 50 % bei ≈ 4, der eines Siegfaktors bei ≈ 0,1.

**Ergebnisse:**

**EXP-023 Krümel-Kehraus alt gegen neu, ein schwacher Bot reihum (30 s, Seeds 1–150 je Zeile)**

| Variante                                                  | Sp. | Punkte P1 | Abstand 1–2 | Gleichstand P1 | Führungswechsel | Comeback | Siege schwach | fair | Treffer/Runde | fremde Löcher | Rempler | Stürze | instabil | max m/s | ms/Schritt |
| --------------------------------------------------------- | --- | --------- | ----------- | -------------- | --------------- | -------- | ------------- | ---- | ------------- | ------------- | ------- | ------ | -------- | ------- | ---------- |
| B: alt (EXP-006): runder Tisch, 10 Krümel, Lücken, Knäuel | 2   | 5,5       | 28 %        | 18 %           | 0,6             | 15 %     | 22 %          | 50 % | 9,4           | 0,0           | 0,0     | 5,6    | 0        | 14,5    | 0,04       |
| B: alt (EXP-006): runder Tisch, 10 Krümel, Lücken, Knäuel | 3   | 6,2       | 16 %        | 30 %           | 1,3             | 27 %     | 12 %          | 33 % | 15,1          | 0,0           | 0,0     | 8,0    | 0        | 15,6    | 0,05       |
| B: alt (EXP-006): runder Tisch, 10 Krümel, Lücken, Knäuel | 4   | 6,9       | 15 %        | 31 %           | 1,6             | 28 %     | 7 %           | 25 % | 21,3          | 0,0           | 0,0     | 12,1   | 0        | 15,8    | 0,06       |
| R1: Blech, Ecken-Löcher, 6 Krümel                         | 2   | 7,1       | 28 %        | 5 %            | 0,5             | 10 %     | 5 %           | 50 % | 12,1          | 0,0           | 0,5     | 0,0    | 0        | 14,2    | 0,04       |
| R1: Blech, Ecken-Löcher, 6 Krümel                         | 3   | 7,0       | 17 %        | 31 %           | 1,1             | 21 %     | 5 %           | 33 % | 17,1          | 0,2           | 6,0     | 0,0    | 0        | 16,3    | 0,05       |
| R1: Blech, Ecken-Löcher, 6 Krümel                         | 4   | 7,4       | 16 %        | 29 %           | 1,5             | 21 %     | 1 %           | 25 % | 22,2          | 1,0           | 22,6    | 0,0    | 0        | 18,1    | 0,06       |
| R2: R1 + Goldkrümel (3)                                   | 2   | 9,0       | 42 %        | 5 %            | 0,9             | 21 %     | 22 %          | 50 % | 10,2          | 0,3           | 3,8     | 0,0    | 0        | 14,3    | 0,04       |
| R2: R1 + Goldkrümel (3)                                   | 3   | 7,1       | 33 %        | 10 %           | 1,3             | 31 %     | 11 %          | 33 % | 11,3          | 0,9           | 20,9    | 0,0    | 0        | 16,9    | 0,05       |
| R2: R1 + Goldkrümel (3)                                   | 4   | 8,2       | 25 %        | 17 %           | 1,8             | 30 %     | 7 %           | 25 % | 17,9          | 2,0           | 35,3    | 0,0    | 0        | 18,3    | 0,06       |
| R3: R2 + Keksregen (gewählt)                              | 2   | 9,1       | 41 %        | 7 %            | 0,9             | 22 %     | 22 %          | 50 % | 10,5          | 0,3           | 3,6     | 0,0    | 0        | 14,3    | 0,05       |
| R3: R2 + Keksregen (gewählt)                              | 3   | 7,3       | 32 %        | 15 %           | 1,3             | 24 %     | 10 %          | 33 % | 11,7          | 0,9           | 20,2    | 0,0    | 0        | 17,2    | 0,06       |
| R3: R2 + Keksregen (gewählt)                              | 4   | 8,5       | 24 %        | 15 %           | 1,8             | 29 %     | 6 %           | 25 % | 18,9          | 2,0           | 33,5    | 0,0    | 0        | 18,8    | 0,07       |
| R4: R3 mit 4 Krümeln                                      | 2   | 8,5       | 45 %        | 7 %            | 0,8             | 15 %     | 16 %          | 50 % | 9,2           | 0,3           | 4,7     | 0,0    | 0        | 14,6    | 0,04       |
| R4: R3 mit 4 Krümeln                                      | 3   | 7,0       | 33 %        | 12 %           | 1,2             | 32 %     | 13 %          | 33 % | 11,0          | 0,9           | 21,6    | 0,0    | 0        | 20,3    | 0,05       |
| R4: R3 mit 4 Krümeln                                      | 4   | 7,6       | 23 %        | 23 %           | 1,9             | 29 %     | 9 %           | 25 % | 16,2          | 2,0           | 37,8    | 0,0    | 0        | 18,2    | 0,05       |
| R5: R3 mit 9 Krümeln                                      | 2   | 9,6       | 40 %        | 6 %            | 0,9             | 21 %     | 20 %          | 50 % | 11,3          | 0,3           | 3,2     | 0,0    | 0        | 14,2    | 0,06       |
| R5: R3 mit 9 Krümeln                                      | 3   | 8,1       | 30 %        | 16 %           | 1,5             | 27 %     | 10 %          | 33 % | 13,9          | 0,9           | 17,2    | 0,0    | 0        | 19,6    | 0,07       |
| R5: R3 mit 9 Krümeln                                      | 4   | 9,4       | 21 %        | 15 %           | 2,1             | 36 %     | 7 %           | 25 % | 22,5          | 1,8           | 27,7    | 0,0    | 0        | 17,4    | 0,07       |
| R6: R3 + Wollknäuel                                       | 2   | 9,0       | 42 %        | 7 %            | 0,9             | 21 %     | 19 %          | 50 % | 10,3          | 0,3           | 3,3     | 0,0    | 0        | 14,1    | 0,05       |
| R6: R3 + Wollknäuel                                       | 3   | 7,6       | 31 %        | 17 %           | 1,4             | 27 %     | 13 %          | 33 % | 12,7          | 0,9           | 17,5    | 0,0    | 0        | 16,8    | 0,06       |
| R6: R3 + Wollknäuel                                       | 4   | 8,3       | 20 %        | 27 %           | 2,1             | 31 %     | 7 %           | 25 % | 19,3          | 1,8           | 29,9    | 0,0    | 0        | 19,3    | 0,06       |

Spalten: _Abstand 1–2_ = (Punkte P1 − P2) / Punkte P1. _Siege schwach_ = Siegquote des schwachen Bots (Platz reihum). _Treffer/Runde_ = Krümel in Löchern (Gold zählt als 1 Treffer). _fremde Löcher_ = Krümel, die zuletzt jemand anderes berührt hat. _Stürze_ nur bei B (dort fällt man durch die Lücken). _instabil_ = Summe aus NaN, Durchtunneln, Körpern außerhalb des Blechs und Resten nach `dispose()` über alle 150 Runden.

**EXP-023 Knappe Besetzungen (Seeds 1–150)**

| Variante                                                  | Duell: Siege etwas schwächer | Duell: Gleichstand | 4× normal: Abstand 1–2 | 4× normal: Gleichstand P1 | 4× normal: Führungswechsel | 4× normal: Comeback |
| --------------------------------------------------------- | ---------------------------- | ------------------ | ---------------------- | ------------------------- | -------------------------- | ------------------- |
| B: alt (EXP-006): runder Tisch, 10 Krümel, Lücken, Knäuel | 48 %                         | 25 %               | 15 %                   | 31 %                      | 1,9                        | 25 %                |
| R1: Blech, Ecken-Löcher, 6 Krümel                         | 30 %                         | 29 %               | 12 %                   | 39 %                      | 2,1                        | 31 %                |
| R2: R1 + Goldkrümel (3)                                   | 42 %                         | 7 %                | 21 %                   | 17 %                      | 2,2                        | 32 %                |
| R3: R2 + Keksregen (gewählt)                              | 42 %                         | 11 %               | 19 %                   | 21 %                      | 2,3                        | 31 %                |
| R4: R3 mit 4 Krümeln                                      | 40 %                         | 14 %               | 23 %                   | 16 %                      | 1,9                        | 30 %                |
| R5: R3 mit 9 Krümeln                                      | 37 %                         | 15 %               | 18 %                   | 18 %                      | 2,5                        | 41 %                |
| R6: R3 + Wollknäuel                                       | 39 %                         | 12 %               | 20 %                   | 21 %                      | 2,2                        | 37 %                |

**EXP-023 Eindringling gegen 2× normal (3 Sp., alle Können normal, Siegfaktor; 1,00 = fair; Seeds 1–150)**

| Variante                          | normal | Torsteher | Dauerrempler | Raufbold |
| --------------------------------- | ------ | --------- | ------------ | -------- |
| R1: Blech, Ecken-Löcher, 6 Krümel | 1,03   | 0,00      | 0,83         | 0,00     |
| R2: R1 + Goldkrümel (3)           | 0,77   | 0,01      | 1,12         | 0,03     |
| R3: R2 + Keksregen (gewählt)      | 0,87   | 0,02      | 0,90         | 0,02     |
| R4: R3 mit 4 Krümeln              | 1,01   | 0,02      | 1,43         | 0,04     |
| R5: R3 mit 9 Krümeln              | 0,88   | 0,03      | 1,15         | 0,01     |
| R6: R3 + Wollknäuel               | 0,92   | 0,02      | 1,21         | 0,00     |

**EXP-023 Siegquote je Loch, alle Bots normal (R3, Seeds 1–150; bei 3 Personen: vorn links, vorn rechts, hinten Mitte)**

| Sp. | vorn links | 2. Loch | 3. Loch | 4. Loch | fair |
| --- | ---------- | ------- | ------- | ------- | ---- |
| 2   | 51 %       | 49 %    | –       | –       | 50 % |
| 3   | 34 %       | 31 %    | 35 %    | –       | 33 % |
| 4   | 25 %       | 26 %    | 23 %    | 26 %    | 25 % |

Reihenfolge der Löcher: 2 Personen vorn links, hinten rechts; 3 Personen vorn links, vorn rechts, hinten Mitte; 4 Personen vorn links, hinten rechts, vorn rechts, hinten links.

**Ecken-Fairness bei drei Personen (Iteration, R3, alle Bots normal):** Die erste Fassung nutzte drei der vier Ecken.

| Aufstellung (3 Sp.)                                               | Seeds | Siege Loch 1 / 2 / 3                 | Bemerkung                                           |
| ----------------------------------------------------------------- | ----- | ------------------------------------ | --------------------------------------------------- |
| vorn links, hinten rechts, vorn rechts; hinten links zu           | 150   | 59 % / 14 % / 27 %                   | vorn links hat keinen nahen Nachbarn                |
| dasselbe, hinten links als neutrales Loch („Hausmaus frisst“)     | 90    | 60 % / 15 % / 25 %                   | kaum ein Krümel landete dort, keine Wirkung         |
| vorn links, vorn rechts, Loch in der geraden Rückwand             | 90    | 43–51 % / 45–53 % / 3–4 %            | ohne Wände, die zur Öffnung leiten, trifft man kaum |
| … Rückwand-Loch als 90°-Kerbe, Fallfeld um z = −1,7 / −1,1 / −0,5 | 90    | 49/49/1 · 41/48/11 · 41/45/14 %      | geometrisch gleich weit wäre z ≈ −1,1               |
| … Fallfeld um z = 0,2 / **0,8** / 1,4                             | 90    | 37/34/28 · **37/29/35** · 20/24/56 % | Punkte bei 0,8: 5,9 / 5,8 / 6,0                     |
| **gewählt: Kerbe + Fallfeld z = 0,8**                             | 150   | **34 % / 31 % / 35 %**               | Tabelle oben                                        |

(Die 90-Seed-Läufe der Kerbe liefen nach einer Korrektur: Die Notfall-Grenze „Körper außerhalb des Blechs“ lag zuerst vor der Kerbe und nahm dem hinteren Loch seine Treffer.)

**Auswertung:**

- **Gegen den alten Prototyp (B):** Niemand fällt mehr herunter (B: 5,6–12,1 Stürze je Runde), die Rechnung bleibt stabil (0 Instabilitäten in allen Läufen, höchstens 20 m/s, ≈ 0,05 ms je Schritt). B wirkt fair für Schwache (22 % im Duell), aber nur, weil es zufällig ist: 18–31 % geteilte Siege, und im knappen Duell gewinnt der etwas Schwächere 48 %, also so oft wie der Bessere.
- **Feste Ecken allein (R1)** machen das Spiel sauber, aber streng: Der schwache Bot gewinnt nur noch 1–5 %, unter vier Gleichstarken teilen sich 39 % der Runden den Sieg (je Krümel 1 Punkt, wenige Treffer).
- **Goldkrümel (R2) ist der wirksamste Hebel**, wie das Türglück in EXP-016: Gleichstände unter vier Gleichstarken sinken von 39 % auf 17 %, im Duell gewinnt der etwas Schwächere 42 % statt 30 %, der schwache Bot im Duell 22 % statt 5 %. Gold sammelt alle zu einem sichtbaren Gerangel (Rempler je Runde 4 → 21–35).
- **Keksregen (R3 gegen R2)** ändert die Zahlen kaum (alles innerhalb des Rauschens; Gleichstände 4× normal 21 % gegen 17 %). Er bleibt als sichtbares Finale, wie „Mitternacht“ und der Schleudergang. Ob er sich lohnt, klärt der Playtest; Stellschraube `rainMs: null`.
- **Krümelzahl:** Mit 4 Krümeln (R4) lohnt sich Dauerrempeln (Faktor 1,43), weil man um wenige Krümel rangelt. 9 Krümel (R5) bringen mehr Führungswechsel und Comebacks (4× normal: 2,5 Wechsel, 41 %), mit Keksregen liegen am Ende aber 15 Krümel auf dem Blech – genau die Unübersichtlichkeit aus EXP-006. 6 Krümel sind der Kompromiss.
- **Wollknäuel (R6)** bringt nichts Messbares außer mehr Gleichständen bei 4 Personen (27 %) und einem Vorteil fürs Dauerrempeln (1,21). Verworfen, wie in EXP-006.
- **Eindringling:** Torsteher und Raufbold gewinnen praktisch nie (0,00–0,04): Wer andere stört, statt selbst zu schieben, verliert. Ihr Opfer verliert ebenfalls, die dritte Person gewinnt (Königsmacher-Effekt, an echten Tischen eher lustig). Dauerrempeln ist in R3 nicht besser als normales Spiel (0,90).
- **Ecken-Fairness:** Bei 2 und 4 Personen sind alle Löcher gleich gut (49–51 % bzw. 23–26 %). Bei 3 Personen war die erste Aufstellung klar unfair (59 / 14 / 27 %). Die Kerbe in der Rückwand mit verschobenem Fallfeld gleicht das aus (34 / 31 / 35 %). Der Ausgleich ist an Bots kalibriert; bei Menschen kann sich der Punkt verschieben (Stellschraube `drop3Z`).
- **Chancen für Schwache bleiben klein:** In R3 gewinnt der schwache Bot 22 % im Duell, aber 10 % bzw. 6 % bei 3 bzw. 4 Personen (fair: 33 % bzw. 25 %). Mit anderen Minispielen ist das nur grob vergleichbar, weil die Besetzungen anders waren (dort Neuling gegen Profi: Sockenregen 3–5 %, Kuckucks-Klatsche 8–16 %). Physik belohnt Geschick; Aufholhilfen gehören zu CHAOS-65.
- **Gerangel um Gold kann zäh werden:** In einzelnen Läufen jagen alle drei Bots nur das Gold, normale Krümel bleiben liegen (z. B. 3 Sp., Seed 3: 6 Treffer statt ≈ 12). Ob das Menschen genauso tun und ob es sich zäh anfühlt, klärt der Playtest.

**Entscheidung:** **keep R3** als „Krümel-Kehraus“ (`kruemel-kehraus`, Physik, 30 s, Stick + Rempeln), in Katalog und Rotation (fünftes Minispiel).

- **Gründe:** Die Kritik aus EXP-006 ist behoben (keine Stürze, feste Ecken, 6 statt 10 Krümel). Gleichstände liegen unter denen von B, Störstrategien lohnen sich nicht, alle Löcher sind bei 2–4 Personen gleich gut. Es ist das zweite Physik-Spiel neben Pudding-Gerangel, mit anderem Ziel: Gegenstände befördern statt Platz halten.
- **discard:** R1 (zu viele Gleichstände, Schwache chancenlos), R4 (Dauerrempeln lohnt), R6 (Knäuel ohne Nutzen). R5 und R2 bleiben Stellschrauben (`crumbs`, `rainMs`).
- **Nebenbefund:** Der Headless-Harness verliert je Lauf 1,5–3,6 MB, auch bei anderen Minispielen; die Messung brach nach ≈ 1 500 Läufen ab. Folgeaufgabe CHAOS-126 (wichtig für die Bot-Fairness-Vorlage CHAOS-84). **Behoben (2026-11-18):** Kein Leck im Spiel, sondern Babylons `TimingTools.SetImmediate`-Warteschlange (1-ms-Zeitgeber), die jede Szene festhielt, solange die Messschleife nur Promises abwartete. `runMinigameHeadless` leert sie jetzt (`flushBabylonTimers()`); 1 000 Läufe in einem Prozess wachsen um ≤ 0,03 MB je Lauf.

**Umsetzung:** `packages/minigames/src/kruemel-kehraus/` (`logic.ts` rein, `index.ts` Babylon/Havok-Ansicht im Natur-Look, `visuals.ts`, Tests). Krümel und Gold sind dynamische Kugeln, Figuren dynamische Kapseln mit gesperrter Drehung (wie Pudding-Gerangel), Rand und Stürze statisch. Zwei Fehler fand erst die Messung: Körper, die in `prepare` versetzt werden, übernimmt Havok nicht (die Startkrümel lagen auf dem Parkplatz hinter einer Ecke und zählten sofort; jetzt entstehen sie am Zielort, Regressionstest „ohne Eingaben keine Punkte“). Und eine Figur, die auf einem Krümel steht und gerempelt wird, kam über den 1 m hohen Rand (jetzt unsichtbare Kollisionswand bis 3,2 m, Krümel steigen höchstens mit 2,5 m/s). Belegbilder: `docs/screenshots/chaos79-kruemel-kehraus.jpg` (4 Spieler, Gerangel um den Goldkrümel, Banner „Ein Goldkrümel!“), Screenshot-Baseline `tests/e2e/__screenshots__/m3-minispiele-bild.spec.ts/minispiel-kruemel-kehraus-chromium-linux.png`. Vorschau: `/host/?local=1&minigame=kruemel-kehraus&players=4` (mit `players=3` die Kerbe).

**Offen für Playtest (Ruben, Gerätecheckliste P6c):**

1. Findet jede Person ihr Mauseloch sofort (Torbogen und Symbol in Slot-Farbe)? Auch bei drei Personen die Kerbe hinten?
2. Fühlt sich das Schieben steuerbar an, oder rollen die Krümel zu leicht weg bzw. kleben am Fuß?
3. Ist das Gerangel um den Goldkrümel witzig oder zäh? Stört es, dass normale Krümel dann liegen bleiben?
4. Wird der Keksregen als Finale verstanden, und bringt er etwas? Falls nicht: `rainMs: null` (R2).
5. Krümel in fremden Löchern: lustig oder ärgerlich?
6. Bei drei Personen: Fühlt sich das hintere Loch gleichwertig an? (An Bots kalibriert, `drop3Z`.)
7. Die Bot-Werte sind Annahmen, keine Messung. Echte Menschen rempeln öfter und gezielter.

**Für später:** Aufzieh-Takt und Geysir-Gier gehen im Minispiel-Ausbau auf (MG-090 in CHAOS-102, Abgleich Geysir-Gier in CHAOS-104). Für MG-008 „Laubbläser-Liga“ (Blätter in die eigene Ecke) ist der Unterschied zu Krümel-Kehraus zu schärfen (Katalog-Hinweis).

---

## EXP-024: Apple TV hostet allein – TypeScript-Kern in JavaScriptCore (2026-11-17, CHAOS-138)

**Hypothese:** Nach ADR-019 (W2) kann die Apple TV eine Partie ohne Rechner hosten. Session-Server, game-core, Host-Rolle und Minispiele samt Havok laufen als ein JS-Bündel in JavaScriptCore; Swift übernimmt Netzwerk und Darstellung. Erwartet: Die JS-Last bleibt deutlich unter dem Bild-Budget von 16,7 ms.

**Aufbau** (`spikes/apple-host`, Vertrag in `CONTRACT.md`; seit CHAOS-139 als Produktcode unter [`apps/apple-host`](../apps/apple-host/README.md)):

- **JS-Kern `jscore/`:** ein Bündel mit 4,8 MB plus `HavokPhysics.wasm`.
  - `Session` aus `apps/server` und `connectHost` aus `apps/host`, beide unverändert.
  - Die Minispiele laufen headless mit Babylon-NullEngine und Havok, instanziiert synchron über `instantiateWasm`.
  - Polyfills: `setTimeout`, `performance`, `structuredClone`, `global`, `node:crypto`.
- **App `app/`** für tvOS und macOS:
  - JavaScriptCore mit monotoner Uhr
  - ein `NWListener` auf Port 8787 für HTTP (Browser-Controller) und WebSocket `/ws`; das WebSocket-Protokoll ist selbst geschrieben, weil ein Listener sonst keine normalen Seiten liefern kann
  - Lobby mit QR-Code
  - RealityKit-Darstellung mit Grundkörpern statt echter Grafik

**Ergebnisse:**

- **macOS, JavaScriptCore ohne JIT, Harness:** eine ganze Partie mit 10 Runden. Alle vier Minispiele der Rotation liefen headless (drei davon mit Havok), 10 von 10 Ergebnissen wurden angenommen, ohne JS-Ausnahme.
- **Echte Apple TV 4K (A15, tvOS 27, 4K-Ausgabe):**
  - Die Controller-Seite liegt vom Mac aus unter `http://<tv-ip>:8787` (200).
  - WebSocket-Handshake über das LAN geht.
  - Ein Controller trat bei, die Partie lief bis ins Minispiel `wackelturm` mit 138 Körpern.
  - Ein Dialog fürs lokale Netzwerk war nicht nötig: Für eingehende Verbindungen fragt tvOS nicht.

| Phase                 | Bildabstand Median / p95 | JS je Bild (`tick` + `renderState`) Median / p95 / max | ausgelassene Ticks |
| --------------------- | ------------------------ | ------------------------------------------------------ | ------------------ |
| Lobby                 | 16,68 / 16,8 ms          | 0,20 / 0,37 / 3,7 ms                                   | –                  |
| Brett                 | 16,68 / 16,8 ms          | 0,19 / 0,37 / 6,9 ms                                   | –                  |
| Minispiel, 138 Körper | 16,68 / 16,77 ms         | 0,75 / 5,0 / **98 ms**                                 | 5 von 600          |

- **Nicht gemessen bzw. offen:**
  - Die Spitze von 98 ms ist ungeklärt; vermutlich Aufbau der Minispiel-Bühne (am Mac bis 960 ms am Stück) oder Speicherbereinigung.
  - Kein Beitritt mit der nativen Controller-App.
  - Speicher über eine ganze Partie.
  - Pause, Wiederverbindung, Revanche.
  - Eingabe → Bild nicht gemessen.
- **Darstellung (Ruben, 17.11.):** „die app ist unspielbar auf dem tv weil das garnicht die echten grafiken sind“. Erwartet für den Spike, der nur Grundkörper zeichnet. Die echte Grafik ist der nächste Schritt.

**Entscheidung:** **keep (W2 bestätigt).** Hosten allein auf der Apple TV ist machbar: Die Spiellogik kostet im Median unter 1 ms je Bild. Weiter geht es mit der echten Darstellung (Brett-Kulisse und Figuren als USDZ, Regie, Minispiel-Grafik) und mit der Bühnen-Spitze (Aufbau verteilen).

**Nachtrag 2026-11-18 (CHAOS-141): Spitze beim Minispiel-Aufbau und Speicher über drei Partien.**

- **Ursache der Spitze:** Der Aufbau einer Minispiel-Bühne lief am Stück in einem `tick`. Fast die ganze Zeit steckt in `prepare` der Minispiele: Meshes erzeugen (Kugeln, Tori und Zylinder mit vielen Segmenten), Materialien, Figuren. NullEngine, Szene, Havok-Welt und `dispose` kosten wenig. Eine einzelne Kugel mit Standard-Segmenten kostet ohne JIT gut 10 ms.
- **Lösung:** `MinigameContext.pace()` im minigame-sdk. Die Minispiele rufen es zwischen ihren Bauschritten auf (je Mesh-Gruppe, Figur, vorgewärmtem Gegenstand). Ist das Budget des Bildes verbraucht (Apple-Host: 2 ms, gemessen mit `Date.now()`), geht der Aufbau im nächsten `tick` weiter. Ohne Taktgeber (Tests, PC-Host) baut `prepare` wie bisher am Stück. Danach bestimmt die Bühne die Grundform jedes Meshes, ebenfalls verteilt. `bodies()` bleibt leer, bis alles steht, und das Minispiel startet erst dann. Wird die Bühne mitten im Aufbau entsorgt, bricht `pace()` mit `PrepareAborted` ab. Der Aufbau dauert jetzt bis zu etwa 250 Bilder (gut 4 s), das Intro dauert 7 s.
- **Messung im Harness** (Node, ganze Bot-Partie mit 10 Runden, JS je Bild = `tick` mit den Mikrotasks danach plus `renderState`). Zur Näherung an JavaScriptCore ohne JIT läuft Node zusätzlich als reiner Interpreter (`--no-opt --no-sparkplug --no-maglev`). Das ist nur eine Näherung, die Apple TV kann langsamer sein.

| JS je Bild                                   | vorher, JIT   | nachher, JIT  | vorher, Interpreter | nachher, Interpreter   |
| -------------------------------------------- | ------------- | ------------- | ------------------- | ---------------------- |
| Wechsel Brett → Minispiel (Aufbau), max      | 124,8 ms      | 14,4 ms       | **329,8 ms**        | **18,9 ms**            |
| Intro mit Aufbau, p95 / max                  | 0,25 / 9,3 ms | 1,9 / 11,6 ms | 0,48 / 9,9 ms       | 3,1 / 18,9 ms          |
| Bilder > 16,7 ms in der Partie               | 10            | 0             | 10                  | 2 (von 3.001 im Intro) |
| Ende (Ergebnis, Abbau, 30 Bilder Brett), max | 8,8 ms        | 6,3 ms        | 7,1 ms              | 7,2 ms                 |
| Minispiel läuft, p95 / max                   | 0,69 / 5,5 ms | 0,77 / 8,3 ms | 2,6 / 14,5 ms       | 2,7 / 13,8 ms          |

- **Speicher über drei Partien** (`bots --full --matches 3`, zwei Bots, Revanche dazwischen; nach `gc()` am Endstand jeder Partie): Heap 31,0 → 32,3 → 32,7 MB, `external` (ArrayBuffer und Havok-Wasm) 28,5 MB gleichbleibend, wartende Zeitgeber der virtuellen Uhr 2 → 2 → 2. Zuwachs nach Partie 3 gegenüber Partie 1: **+1,7 MB** (Kriterium < 20 MB). Das Leck aus CHAOS-126 tritt im eingebetteten Weg nicht auf: Babylons `SetImmediate`-Zeitgeber laufen über die virtuelle Uhr in jedem `tick` ab, ihre Zahl wächst nicht. Die CI prüft das jetzt im Linux-Job.
- **Nicht gemessen:** die echte Apple TV (JS-Zeit je Bild bei Minispiel-Start und -Ende, ausgelassene Ticks, Speicher in Instruments). Das misst Ruben nach der Gerätecheckliste §20, TH5–TH6. Pause und Wiederverbindung über eine ganze Partie bleiben ungemessen.
- **Entscheidung:** keep. Der verteilte Aufbau bleibt; der PC-Host kann denselben Taktgeber nutzen (`RunnerOptions.pacing`), das ist eine eigene Aufgabe.

---

## EXP-025: Minispiel-Bühne und Brett ohne Shader-Standbild (2026-11-17, CHAOS-132)

**Hypothese / gewünschtes Spielerlebnis:** Beim Wechsel Brett → Minispiel → Brett steht das Bild nicht. Bisher übersetzten Minispiel-Bühne und Brett alle Shader am Stück (`whenReadyAsync`, KI-25); die Anleitungskarte und ihr Countdown blieben dabei stehen. Annahme: Mit `prepareSceneGradually` aus CHAOS-71 (EXP-021) zerfällt die Vorbereitung in kleine Blöcke.

**Testumgebung:** Sandbox-Linux, 4 Kerne, Headless-Chromium mit SwiftShader (**kein** `KHR_parallel_shader_compile`), 1280×720, Production-Build, frischer Browser je Lauf. Zwei Abläufe:

- **Minispiel allein:** `/host/?local=1&minigame=<id>&flow=1&players=4&seed=7` (ohne Testmodus, Sparstufe automatisch `minimal`; Stufe `hoch` per `&qualitaet=hoch`), alle 6 Minispiele, je 2 Läufe.
- **Echter Ablauf:** Perf-Partie (`pnpm perf`, Szenario „Partie“, 4 Bots, Server im selben Rechner), Stufe `minimal`.

Gemessen: Long Tasks (`PerformanceObserver`, > 50 ms) zwischen dem Ende von `runner.prepare` und dem ersten Bild, gelinkte WebGL-Programme je Phase. Messmarken und Skripte nur temporär (Scratchpad), nicht eingecheckt.

**Varianten und Ergebnisse (Minispiel allein):**

| Variante                                                                           | Längster Block `minimal`                         | Längster Block `hoch`                                | Programme im ersten Bild (`hoch`) |
| ---------------------------------------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------- | --------------------------------- |
| A: alt, `whenReadyAsync` am Stück                                                  | 0,61–0,88 s (Median 0,68)                        | **1,02–1,81 s** (Median 1,48)                        | 1                                 |
| B: nur `prepareSceneGradually`                                                     | ≈ 0,7 s, kein Gewinn                             | –                                                    | –                                 |
| C: B + Shader-Quellen vorab laden                                                  | Vorbereitung ≤ 0,1 s                             | längster 1,7–2,3 s (erstes Bild)                     | **21**                            |
| D: C + Pre-Pass wie `scene.isReady` + Bildpause vor der ersten Runde (**gewählt**) | 0,54–0,75 s (Median 0,66); davon Shader ≤ 0,14 s | **0,50–0,77 s** (Median 0,63); davon Shader ≤ 0,33 s | 1                                 |

- **B scheitert an nachgeladenen Shader-Quellen:** Babylon 9 importiert die Quellen je Material-Klasse (`PBRMaterial`, `StandardMaterial`, …) erst beim ersten Effekt. Alle Effekte, die bis dahin entstehen, warten auf denselben Import und übersetzen danach gemeinsam in **einer** Aufgabe (≈ 0,64 s, 15 Programme). Beim Podest fiel das nicht auf, weil das Brett die Quellen schon geladen hatte. `preloadShaderSources` lädt sie vorab über Babylons `_ShaderLoader` (intern, aber stabil seit Babylon 9).
- **C scheitert bei `hoch` am Pre-Pass:** SSAO2 braucht den Pre-Pass; `scene.isReady` schaltet ihn mit `prePassRenderer.update()` ein, bevor es Materialien prüft. Die Schritte taten das nicht und übersetzten Varianten ohne Pre-Pass. Das erste Bild übersetzte dann 21 Programme neu (≈ 2,1 s).
- **Restblock bei D liegt vor der Shader-Vorbereitung:** `runner.prepare` (Minispiel-Szene, Figuren) kostet 0,5–0,8 s am Stück, in A und D gleich.

**Echter Ablauf (Perf-Partie, `minimal`), längster Block zwischen Figuren geladen und erstem Bild:**

|                   | alt (A)     | neu (Brett und Bühne schrittweise, Quellen vorab; noch ohne Bildpause vor der ersten Runde) |
| ----------------- | ----------- | ------------------------------------------------------------------------------------------- |
| Brett → Minispiel | 0,74–1,87 s | 0,70–1,25 s                                                                                 |
| Minispiel → Brett | 0,69–1,84 s | 0,31–1,11 s                                                                                 |

Größere Blöcke liegen im echten Ablauf **außerhalb** der Shader-Vorbereitung und bleiben offen (CHAOS-152; Kennzahl in `pnpm perf`: CHAOS-153):

- `new Engine(…)` der Minispiel-Bühne direkt nach dem Entsorgen des Brett-Kontexts: 0,7–2,7 s am Stück. SwiftShader wartet beim neuen Kontext auf das Aufräumen des alten.
- Brett-Neuaufbau nach jedem Minispiel (Kontext + `buildNatureBoard`, synchron): 1,5–3,4 s.
- Erste Bilder nach der Vorbereitung: 0,3–1,3 s (vermutlich SwiftShader-JIT beim ersten Zeichnen).
- Unter Perf-Last kostet ein einzelner Shader-Schritt 0,3–0,7 s; kleiner geht es von JavaScript aus nicht.

**Entscheidung:** keep D. Minispiel-Bühne (`minigame/stage.ts`) und Brett (`board/createBoardScene.ts`) nutzen `prepareSceneGradually`. Die Hilfsfunktion lädt die Shader-Quellen vorab, schaltet den Pre-Pass ein und lässt vor der ersten Runde ein Bild zeichnen. Das Podest (CHAOS-71) profitiert mit.

**Offen (nur auf echter Hardware):** Mit Grafikkarte ohne `KHR_parallel_shader_compile` kostet ein Programm wenige ms; dort war der gebündelte Import-Block (A/B) die wahrscheinliche Spitze. Rubens Messung N4 (Gerätecheckliste) steht aus; ob Kontext-Neuaufbau und Brett-Neuaufbau dort spürbar sind, entscheidet über CHAOS-152.

**Nachtrag 2026-11-19 (CHAOS-168): `runner.prepare` verteilt am PC-Host.** Die Bühne gibt dem Runner jetzt `pacing` mit (`apps/host/src/minigame/preparePacing.ts`): höchstens 6 ms je Bild, danach weiter nach dem nächsten gezeichneten Bild (`requestAnimationFrame` + Makroaufgabe, im Hintergrund-Tab spätestens nach 100 ms). Das gilt auch im Testmodus; das Ergebnis des Aufbaus ändert sich nicht, nur seine Verteilung über die Zeit. Gemessen mit temporären Messmarken auf einem Mac (Apple Silicon, Headless-Chromium mit SwiftShader, 1280×720). Die Werte sind nur relativ zu verstehen und nicht mit der Sandbox oben vergleichbar.

| Ablauf | ohne `pacing` | mit `pacing` |
| --- | --- | --- |
| Minispiel allein (`?local=1&minigame=…&flow=1&players=4&seed=7`, 5 Minispiele × 2, ohne ersten Lauf mit JIT-Ausreißer): längster Block | 182–212 ms, umfasst Figuren-Ende, `runner.prepare` und Look | 134–160 ms, endet beim Start von `runner.prepare`; in `prepare` kein Long Task |
| Perf-Partie (`pnpm perf`), Brett → Minispiel: längster Block Median / max | 719 / 794 ms | 763 / 809 ms |

- **Perf-Partie unverändert, weil der längste Block woanders liegt:** Mit Messmarken liegt er in allen 5 Wechseln bei `new Engine(…)` der Minispiel-Bühne (456–845 ms). Das ist der zweite WebGL-Kontext neben dem eingehängten Brett (CHAOS-152). `runner.prepare` erscheint dort höchstens noch als einzelner Abschnitt (einmal 213 ms: ein Bauschritt ohne `pace` dazwischen).
- **Nach dem ersten Bild** folgen weiterhin Blöcke von 3,6–4,9 s (SwiftShader übersetzt beim ersten Zeichnen mit laufender Render-Schleife). Die Kennzahl „Aufbau → erstes Bild“ zählt sie nicht.
- **Entscheidung:** keep. Der Aufbau des Minispiels blockiert nicht mehr am Stück. Das Akzeptanzkriterium aus CHAOS-168 („längster Block Brett → Minispiel deutlich unter 0,5–0,77 s“) ist in der Perf-Partie **nicht** erreicht; der nächste Hebel ist der Kontextaufbau (Folgeaufgabe unter CHAOS-44). **Korrektur (EXP-030, CHAOS-174):** Nicht der Kontextaufbau kostet die Zeit, sondern das Warten des ersten synchronen GL-Aufrufs auf den GPU-Prozess, der noch Brett-Bilder abarbeitet; ein frischer Kontext kostet 15–20 ms.

## EXP-026: Figuren als USDZ direkt aus bpy – Vertexfarben als Textur gebacken (2026-11-17, CHAOS-140)

**Hypothese / gewünschtes Spielerlebnis:** Ruben über den Spike CHAOS-138: „die app ist unspielbar auf dem tv weil das garnicht die echten grafiken sind“. Der native Host braucht dieselben Figuren wie der Babylon-Host, mit lackiertem Glanz, leuchtenden Augen und Messing. Erwartet: Werden die Vertexfarben vor dem USD-Export in eine Farbtextur gebacken, bleiben Rauheit, Clearcoat, Metall und Leuchten als `UsdPreviewSurface` erhalten, und RealityKit zeigt die Figuren wie Babylon (bis auf Sheen und Subsurface).

**Varianten:**

|             | Weg                                                                                                                                                                                                  | Erwartung                                                                                              |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| A (EXP-017) | GLB → Blender-Import → USDZ, Material an vertexgefärbten Teilen entfernt                                                                                                                             | Farben stimmen, Material weg: Figuren matt, Gesichter leuchten nicht                                   |
| B           | bpy-Skript → Vertexfarben in einen gepackten 1024²-Atlas je Figur gebacken (Cycles, Diffuse-Farbe) → Materialien auf die Textur umgestellt → USDZ, alle Clips auf einer Zeitleiste plus Clip-Tabelle | Material bleibt, eine Textur je Figur, ≈ 0,5–1 MB                                                      |
| B′          | wie B, aber je Teil eine feste Kachel im Raster (für bitgleiche Ergebnisse)                                                                                                                          | deterministisch, weniger Auflösung je Teil                                                             |
| C           | je Farbe ein eigenes Material statt Textur                                                                                                                                                           | nicht versucht: Die Vertexfarben sind Verläufe (`paint` aus Position und Normale), keine Flächenfarben |

**Messgrößen:** Materialparameter im USD, Validatoren von usd-core, Größe, Dauer, Höhe/Füße mit gebackenem Skinning, Reproduzierbarkeit. Umgebung: Linux-Container, bpy 5.3.0, usd-core 26.11, `pnpm build:apple-assets`.

**Ergebnisse:**

- **A** (Gegenprobe mit `check_usdz.py` am Roboter): 11 von 11 Meshes ohne Material, auch der Bildschirm. Kein Knoten `abzeichen`, Zeitleiste nur `idle` mit 24 Bildern/s. Die neue Prüfung schlägt mit 14 Fehlern an.
- **B**, alle vier Figuren:
  - Alle Materialien kommen als `UsdPreviewSurface` an, z. B. Roboter `lack` Rauheit 0,32, Clearcoat 0,6; `messing` Metall 0,85; `leuchten` mit `emissiveColor` (1,04; 1,81; 2,0); `akzent` als Konstante.
  - 30 Validatoren von usd-core ohne Fehler.
  - Größen: Roboter 518 KiB, Kaktus 877 KiB, Wusel 948 KiB, Sigi 577 KiB.
  - Dauer: ≈ 6 s je Figur, mit Brett ≈ 3 min für alles.
  - Mit gebackenem Skinning stehen die Füße bei y = 0. Höhen im ersten Bild von `idle`: 1,475 / 1,646 / 1,568 / 1,526 m, Manifest-Ruhepose 1,47 / 1,59 / 1,543 / 1,507 m.
  - Die Atlanten sehen sauber aus: Inseln mit Rand, keine Nähte sichtbar in der Textur.
- **Reproduzierbarkeit:** Zwei Läufe liefern dieselben Prims, Materialien, Clips und Anker, aber nicht bitgleiche Dateien. Die Prim-Reihenfolge im USD und die Anordnung im Atlas schwanken. Schon die GLB-Figuren waren zwischen zwei Läufen nicht bitgleich (geprüft am Roboter).
- **B′:** Auch damit wich eine Kachel zwischen zwei Läufen ab, und der Rumpf bekam sichtbar weniger Auflösung. Verworfen.
- **Nicht geprüft:** wie RealityKit die Figuren darstellt. Kein Mac im Container; dafür gibt es den Screenshot-Vergleich in der Gerätecheckliste.

**Entscheidung:** **B behalten.** Clearcoat, Metall und Leuchten bleiben erhalten, und `check_usdz.py` hält das in der CI fest. Sheen (Fell, Strick) und Subsurface fehlen weiter; für Fell und Socke ist das die größte sichtbare Abweichung. Ob sie stört, entscheidet Rubens Blick am Mac. Wenn ja, wäre der nächste Versuch, Sheen über eine hellere Kante in der gebackenen Farbe anzunähern. B′ ist verworfen; Bitgleichheit ist für nicht eingecheckte Artefakte kein Muss.

**Subjektive Fragen an Ruben (am Mac, Spike neben dem Babylon-Host):** Wirken die Figuren wie dieselben Figuren? Glänzt der Lack, leuchten Augen und Glühbirne? Fehlt dem Fell der weiche Schimmer so, dass es stört?

## EXP-027: Figuren für die Nahansicht – Kaktus und Socke neu geformt (2026-11-18, CHAOS-162)

**Hypothese / gewünschtes Spielerlebnis:** Ruben über die RealityKit-Nahbilder (CHAOS-140): „die figuren müssen im nahbereich detaillierter werden - und der kaktuS und die wurst sind kaputt bzw. nicht schön“. Aus 2–3 m wirken Kaktus und Socke grob: Der Kaktus hat fleckige, knittrige Rippen (weiße Flecken aus Dornenfarbe auf zu wenigen Punkten), kantige Arme, einen Schwimmring als Halstuch, Mund und Brille schweben vor dem Gesicht. Die Socke liest sich als Wurst: ein Schlauch mit kaum sichtbarem Fuß, verwaschenen Ringeln, ohne Ferse und Spitze (die Farbmaske dafür griff nicht), Knöpfe und Mund schweben 4 cm vor dem Schaft, das Bündchen ist ein glatter Zylinder. Annahme: Mit Formen, die nicht aus Skin-Modifier plus Subdivision kommen, sondern als Röhren mit eigenem Querschnitt gebaut werden, werden beide aus der Nähe sauber, ohne dass die Brettansicht leidet.

**Varianten:**

| | Weg | Erwartung |
|---|---|---|
| A (Stand CHAOS-161) | Skin-Modifier + Subdivision 2, Rippen und Strick als nachträgliche Verformung bzw. Vertexfarbe | wenige Punkte (Kaktus 1 200, Socke 480), Rippen und Ringel bleiben grob |
| B | Skin-Modifier mit Subdivision 3 | 4× Punkte, aber Rippen weiter an das 4er-Raster des Skin-Modifiers gebunden, Enden weiter rund abgeschnitten (CHAOS-161) |
| C | neue Bausteine `path_frames`/`tube`/`rings_mesh` in `figurkit.py`: Röhre entlang einer glatten Mittellinie, Querschnitt je Winkel frei (Rippenprofil, Abflachung), Kuppel-Enden; Gesicht und Halstuch exakt auf die Oberfläche gerechnet, Gewichte von Hand (`k.weight`) | saubere Grate und Ringel, Silhouette frei formbar; kostet Punkte und damit Dateigröße |
| D | Normal- oder Rauheitstextur für Strick, Fell, Lack | feinste Struktur ohne Punkte; braucht Texturen im GLB und eine zweite UV-Abwicklung neben dem Farbatlas des USDZ – eigener Umbau, nicht in diesem Schritt |

**Messgrößen:** Nahbilder (Blender-Cycles, Babylon-Vitrine mit `nah=<Slot>`, USDZ mit Farbatlas), Brettblick der Vitrine, Dreiecke, Dateigröße, Auflage-Prüfung (`check_usdz.py`), Höhe und Grundfläche (`pnpm check:assets`). Umgebung: Linux-Container, bpy 5.3.0, Chromium mit SwiftShader.

**Ergebnisse (Variante C):**

- **Kaktus:** Rumpf mit 56 Punkten rundum (8 Rippen, breite runde Grate, schmale Rillen), Arme als gebogene Röhren mit Kuppel, 2–3 Areolen mit Dornen je Grat (je 1–2 Dornen, nicht im Gesicht und unter dem Halstuch), Sonnenbrille mit Fassung, Steg und Glanzlicht, Grinsen als Rille auf der Oberfläche, Halstuch als enges Band mit Knoten und zwei Zipfeln, Blüte aus 6 + 5 gewölbten Blättern mit Staubgefäßen, Topf mit Randwulst, Drehrillen und Erde mit Kieseln. 14 386 Dreiecke (vorher 6 444), GLB 486 KiB (vorher 220 KiB), USDZ 1,3 MiB. Höhe 1,58 m (Blüte etwas größer).
- **Socke:** Röhre entlang einer L-Linie (gerader Schaft, Ferse hinten unten mit Ausbeulung, flacher Fuß, runde Spitze), Strickrippen mit zwei Punkten je Rippe (am Fuß schwächer), vier scharfe Ringel, Ferse und Spitze in Dunkelrot, Bäckchen, Knöpfe auf dem Schaft mit Rand, Löchern und Faden (Kreuz bzw. zwei Striche), gestickter Mund aus fünf Stichen, gestickte Augenbraue, Bündchen mit 24 runden Rippen und umgeschlagenem Rand. 11 452 Dreiecke (vorher 2 968), GLB 371 KiB (vorher 114 KiB), USDZ 995 KiB.
- **Auflage (CHAOS-161):** Bündchen auf Schaft 0,0 cm, Blüte auf Kaktus 2,3 cm, Kaktus im Topf 0,0 cm; alle USDZ-Prüfungen grün.
- **Farbatlas:** Mit den feiner unterteilten Figuren legte Smart UV Project Inseln übereinander; auf der Sockenspitze erschienen blaue und braune Flecken aus den Knöpfen. Abhilfe: nach Smart UV Project neu packen (`pack_islands`, konkav, ohne Überlappung) und den Back-Rand auf 16 px. Danach fleckenfrei (`docs/screenshots/chaos162-usdz-nachher.jpg`).
- **Brettansicht:** Im Brettblick der Vitrine bleiben beide Figuren klar lesbar; der Kaktus ist ohne die weißen Flecken ruhiger und etwas dunkler, die Socke zeigt jetzt die rote Spitze. Vergleich in `docs/screenshots/chaos162-babylon-vorher-nachher.jpg`.
- **Budgets:** Der Kaktus sprengt mit 486 KiB das Figurenbudget von 384 KiB. Budget je Figur auf 512 KiB angehoben, nur Kaktus und Socke nutzen es; Wusel und Schraubi bleiben bei 384 KiB. Begründung: Die Größe kommt aus Punkten (Skinning, Normalen, Vertexfarben je Punkt), nicht aus Texturen; die Apple TV ist bei 4K pixel-, nicht vertexgebunden, und im Web lädt der Host die Figuren nach dem Start-Bundle (`pnpm check:bundle` bleibt unverändert). Die Dreiecksgrenze von 15 000 hält.
- **Nicht geprüft:** RealityKit selbst (kein Mac im Container), daher keine neuen `--nah`-Bilder aus dem Spike. Schraubi und Wusel sind in diesem Schritt unverändert.

**Entscheidung:** **C behalten** für Kaktus und Socke. B verworfen, weil die Rippen am 4er-Raster des Skin-Modifiers hängen bleiben. D ist der nächste Schritt für Feinstruktur (Strickmaschen, Fell, Lackkratzer) und betrifft alle vier Figuren.

**Subjektive Fragen an Ruben:** Ist die Socke jetzt klar eine Socke und schön? Ist der Kaktus sauber? Passen Dornen und Strickrippen zum Stil, oder sind sie zu fein bzw. zu grob? Wie wirken beide in RealityKit (`--nah=cactus`, `--nah=sock`) auf dem Fernseher?

## EXP-028: Schraubi und Wusel für die Nahansicht (2026-11-18, CHAOS-171)

**Hypothese / gewünschtes Spielerlebnis:** Nach EXP-027 (Kaktus und Socke) fragte Ruben: „ja viel besser. kann man die anderen auch nochmal verbessern?“ Schraubi wirkt aus der Nähe wie glatte Kisten mit Stäben, Wusel hat ein leeres Gesicht (kein Mund, keine Schnurrhaare), stummelige Pfoten ohne Finger und einen Schwanz mit weichen, verwaschenen Ringeln. Annahme: Mit den Röhren-Bausteinen aus EXP-027 und kleinen, auf die Oberfläche gesetzten Details werden beide aus der Nähe so lesbar wie Kaktus und Socke, ohne dass der Brettblick unruhig wird.

**Varianten:** wie EXP-027 Variante C (Röhren, Teile auf die Oberfläche gerechnet). Normal-/Rauheitstexturen bleiben CHAOS-172.

**Messgrößen:** Nahbilder (Blender-Cycles mit `nahbild.py`, Babylon-Vitrine `nah=1`/`nah=3`, USDZ mit Farbatlas), Dreiecke, Dateigröße, Höhe und Grundfläche (`pnpm check:assets`), USDZ-Prüfung. Umgebung: Linux-Container, bpy 5.3.0, Chromium mit SwiftShader.

**Ergebnisse:**

- **Schraubi:** Rumpf und Kopf mit gefasten Kanten, Nietenreihen, Naht und Gürtel, Bedienleiste über dem Abzeichen (drei Knöpfe, Drehregler mit Zeiger), je vier Lüftungsschlitze an den Seiten; Bildschirm mit dunklem Rahmen, Wangenstriche, Ohrschrauben mit Schlitz, Eck-Nieten, Schlitze oben; Arme und Beine als gerippte Schläuche mit Schulterkugel, Manschetten, Daumen, Stiefel mit Sohle und Kappe; Antenne mit Spiralfeder und Messingsockel. 14 056 Dreiecke (vorher 6 312), GLB 372 KiB (vorher 212 KiB), USDZ 903 KiB. Weiter 12 Meshes, keine Skin-Gewichte.
- **Wusel:** Kopf feiner unterteilt, Maske als Tropfenform mit schärferem Rand, je drei Wangenbüschel, Nasenlinie, „w“-Mund und je drei Schnurrhaare (per `ray_cast` auf die Kopfoberfläche gesetzt), Halstuch als eng anliegendes Band mit Knoten und zwei Zipfeln, Schwanz als Röhre mit 5,5 scharfen Ringeln, leichtem Bausch je Ringel und dunkler Spitze, dunkle Pfoten mit je drei Fingern und Zehen. Finger und Zehen sitzen per `closest_point_on_mesh` auf der Körperoberfläche (die Skin-Form schrumpft durch die Unterteilung, feste Koordinaten schwebten daneben) und übernehmen die Gewichte der nächsten Körperstelle. 14 120 Dreiecke (vorher 10 272), GLB 430 KiB (vorher 323 KiB), USDZ 1,1 MiB.
- **Budget:** Wusel überschreitet mit 430 KiB die 384 KiB und bekommt wie Kaktus und Socke 512 KiB (Begründung wie EXP-027: Punkte, keine Texturen). Schraubi bleibt mit 372 KiB unter 384 KiB.
- **Brettansicht:** Beide bleiben im Brettblick klar lesbar; bei Schraubi sind Bedienleiste und Nieten aus der Ferne nur noch als Punkte sichtbar, bei Wusel fallen Schnurrhaare und Ringel auf. Vergleich in `docs/screenshots/chaos171-babylon-vorher-nachher.jpg`, Blender in `docs/screenshots/chaos171-blender-vorher-nachher.jpg`, USDZ in `docs/screenshots/chaos171-usdz-nachher.jpg`.
- **Nicht geprüft:** RealityKit selbst (kein Mac im Container).

**Entscheidung:** **behalten**, vorbehaltlich Rubens Urteil über die Nahbilder.

**Subjektive Fragen an Ruben:** Ist Schraubi mit Nieten und Bedienleiste schöner oder zu kleinteilig? Passt Wusels Gesicht mit Mund und Schnurrhaaren? Wie wirken beide in RealityKit (`--nah=robot`, `--nah=raccoon`)?

---

## EXP-029: Brett bleibt während des Minispiels eingehängt (2026-11-18, CHAOS-152)

**Hypothese / gewünschtes Spielerlebnis:** Beim Wechsel Brett → Minispiel → Brett steht das Bild nicht mehr sekundenlang. Nach EXP-025 lagen die großen Blöcke außerhalb der Shader: `new Engine(…)` der Minispiel-Bühne direkt nach dem Entsorgen des Brett-Kontexts (SwiftShader wartet auf das Aufräumen) und der synchrone Brett-Neuaufbau nach jedem Minispiel. Annahme: Wird das Brett nicht entsorgt, sondern nur ausgeblendet und angehalten, entfallen beide.

**Auftrag:** Ruben hat die Aufgabe am 2026-11-18 direkt beauftragt („CHAOS-152“), ohne die Messung N4 abzuwarten. Ob die Blöcke auf echter Hardware spürbar waren, ist damit weiter offen.

**Varianten:**

| | Idee | Erwartung |
|---|---|---|
| a | Brett während des Minispiels ausblenden statt entsorgen (wie im Finale; zwei Kontexte) | beide Blöcke weg; Preis: Speicher des Bretts bleibt belegt |
| b | Minispiel-Bühne schon während der Brett-Ansage auf unsichtbarer Leinwand anlegen (wie das Podest, CHAOS-71) | Block Brett → Minispiel kleiner; Brett-Neuaufbau bleibt |
| c | `buildNatureBoard` in Schritte zerlegen | Block Minispiel → Brett kleiner, aber Kontext-Neuaufbau bleibt; viel Umbau |

Umgesetzt und gemessen wurde nur **a**: Es deckt beide Blöcke ab. b und c lösen jeweils nur eine Hälfte.

**Umsetzung (a):** `App.tsx` hängt `BoardStage` in der ganzen Brettphase ein; die Minispiel-Bühne liegt darüber (eigene Suspense-Grenze). `BoardStage hidden` blendet die Brett-Ebene per `visibility: hidden` aus (Leinwand behält ihre Größe; `inert`, `aria-hidden`) und ruft `BoardScene.setHidden`: keine Render-Schleife, **keine** Regie. Beim Zeigen holt `director.settle()` die Regie ein, wie früher beim Neuaufbau. Weil das Brett jetzt die ganze Partie lebt, lädt es die Stimmung der Runde nach dem Minispiel währenddessen nach (`NatureLook.prepareMood`: Himmel, ggf. Nachtlichter, danach `prepareSceneGradually`), solange niemand hinsieht. Messung (`attachPerf`) ist während des Minispiels abgemeldet; das Zeigen setzt die Marke `brett:aufbau`, damit „minispiel → brett“ weiter gemessen wird.

**Testumgebung:** Sandbox-Linux, 4 Kerne, Headless-Chromium mit SwiftShader, `pnpm perf` (Partie: 4 Bots, 3 Runden, 5 Minispiele, Stufe `minimal`; Revanche ×3). Je ein Lauf vorher (`main` 1604c06) und nachher, gleicher Rechner direkt hintereinander.

**Ergebnisse (Long Tasks ≥ 50 ms je Übergang):**

| Übergang | längster Block Median / max, vorher | nachher | Aufbau→erstes Bild Median, vorher | nachher |
|---|---|---|---|---|
| brett → minispiel | 500 / 9069 ms | 485 / **742 ms** | 1259 ms | 1172 ms |
| minispiel → brett | 2200 / 3380 ms (1 ohne erstes Bild) | **570 / 2412 ms** (alle mit Bild) | 1653 ms | **9 ms** |
| lobby → brett | 1976 ms | 1868 ms | 1859 ms | 1856 ms |
| zählung → podest | 331 ms | 297 ms | 1737 ms | 1343 ms |

| Preis | vorher | nachher |
|---|---|---|
| WebGL-Kontexte während eines Minispiels | 1 | 2 (wie Finale/Podest) |
| Render-Schleifen während eines Minispiels | 1 | 1 (Brett ohne Schleife) |
| Heap nach GC im Minispiel | 52–74 MB | 112–145 MB |
| Heap nach GC am Brett | 85 MB | 93 MB (Himmel der nächsten Runde) |
| Revanche ×3 (Lobby nach jeder Partie) | 38,6 → 51,7 MB, 1 Kontext | 38,6 → 51,6 MB, 1 Kontext |

- **Zweiter Lauf** (beim Neuschreiben der Baseline): brett → minispiel 491 / 523 ms, minispiel → brett 580 / 2069 ms, erstes Brett-Bild nach 13 ms. Bestätigt den ersten Lauf.
- Der Höchstwert „brett → minispiel“ (vorher 9 s) ist das kalte erste Minispiel; er schwankt stark (EXP-025: 3,6–8,6 s). Ein Lauf belegt also keine Verbesserung um Faktor 12. Plausibel ist sie trotzdem: Das Warten auf das Aufräumen des alten Kontexts entfällt.
- Der verbleibende Block „minispiel → brett“ (Median 0,57 s) ist das Entsorgen der Minispiel-Bühne samt Kontext; das Brett zeichnet sein erstes Bild nach 9 ms.
- Bildabstand/Render-Zeit p95 bei Sockenregen und Wackelturm über der Schwelle: genauso im Vorher-Lauf (CHAOS-165, zu wenige Bilder).
- Graskolorit: Die Grasspitzen behalten die Farbe der Stimmung beim Aufbau (Vertexfarben). Früher wechselten sie nach jedem Minispiel mit, jetzt erst mit der nächsten Partie. Licht, Himmel und Feldleuchten blenden weiter über.

**Entscheidung:** **keep a.** Baseline der Partie neu geschrieben (`PERF_UPDATE_BASELINE=1 pnpm perf -g Partie`): Kontexte 2 und Heap im Minispiel sind gewollt. b und c nicht umgesetzt; nur angehen, falls N4 auf echter Hardware noch ein Standbild zeigt.

**Offen (nur auf echter Hardware):** N4 (Gerätecheckliste). Speicher: Zwei Kontexte gibt es seit CHAOS-39/71 schon im Finale; neu ist, dass sie während jedes Minispiels bestehen. Auf einem PC mit wenig Grafikspeicher (integrierte GPU) wäre ein Kontextverlust denkbar; nicht beobachtet.

---

## EXP-030: Minispiel-Engine über die Partie behalten (2026-11-19, CHAOS-174)

**Hypothese / gewünschtes Spielerlebnis:** Der längste Block beim Wechsel Brett → Minispiel (Perf-Partie, Mac, Median ≈ 0,72–0,76 s) entsteht beim Erzeugen des zweiten WebGL-Kontexts neben dem eingehängten Brett (EXP-025, Nachtrag CHAOS-168: Messmarken legten ihn auf `new Engine(…)`). Bleibt die Minispiel-Engine samt Leinwand über die Minispiele einer Partie bestehen und ist nur die Szene je Minispiel neu, entfällt er.

**Auftrag:** Ruben hat die Aufgabe am 2026-11-19 direkt beauftragt („CHAOS-174 + CHAOS-175“).

**Varianten:**

| | Idee | Erwartung |
|---|---|---|
| A | Geteilte Engine (Ausleihe je Minispiel, entsorgt beim Finale bzw. in der Lobby), Auflösung bei jeder Ausleihe auf den Ausgangswert zurück | Block weg ab dem 2. Minispiel; Preis: 2 Kontexte am Brett |
| A′ | wie A, aber ohne Größenwechsel der Leinwand beim Ausleihen | wie A |
| B | Messprobe, nicht zum Behalten: eigene Engine wie bisher, Aufbau der Bühne 1,5 s nach dem Ausblenden des Bretts | zeigt, ob `new Engine(…)` selbst teuer ist |

**Testumgebung:** Mac (Apple Silicon), Headless-Chromium mit SwiftShader, `pnpm perf` (Partie: 4 Bots, 3 Runden, 5 Minispiele, Stufe `minimal`), ein Worker, nichts anderes rechenintensiv daneben. Für A′ und B temporäre Messmarken in Bühne und Brett (`performance.now()` je Schritt) plus die Long Tasks des Debug-Protokolls. Werte nur relativ, nur auf diesem Rechner.

**Ergebnisse (längster Block je Wechsel Brett → Minispiel, in Partie-Reihenfolge):**

| Lauf | 1 | 2 | 3 | 4 | 5 | Median | Wo der Block liegt |
|---|---|---|---|---|---|---|---|
| vorher (`main` 102589a) | 571 | 622 | 11 473 | 899 | 836 | 836 ms | `new Engine(…)` (EXP-025) |
| A | 416 | 728 | 1701 | 1344 | 3772 | 1344 ms | `engine.resize()` der geliehenen Engine: 761–1017 ms |
| A′ | 619 | 739 | 803 | 873 | 789 | 789 ms | jetzt im Laden der Figuren bzw. im ersten Schritt von `runner.prepare` |
| B | 150 | 124 | 779 | 143 | 131 | 143 ms | `new Engine(…)` kostet 15–20 ms; Wechsel 3: Brett bereitet die Nacht-Stimmung vor (`prepareSceneGradually` des Bretts direkt beim Ausblenden) |

- **Hypothese widerlegt:** Der Block hängt nicht am Kontextaufbau, sondern am **ersten synchronen GL-Aufruf nach dem Ausblenden des Bretts**. Vorher war das `new Engine(…)`, in A die Größenänderung der Leinwand, in A′ ein Aufruf beim Figuren-Laden, in B Wechsel 3 die Shader-Vorbereitung des Bretts. Jeder wartet ≈ 0,8 s auf den GPU-Prozess. Mit 1,5 s Abstand (B) ist dieselbe Wartezeit verschwunden, und ein frischer Kontext kostet 15–20 ms.
- **Wahrscheinliche Ursache:** SwiftShader rechnet die Bilder des Bretts auf der CPU im GPU-Prozess; Chromium lässt die Seite einige Bilder vorauslaufen. Beim Ausblenden liegen noch ≈ 0,8 s Brett-Arbeit in der Warteschlange, und der erste synchrone Aufruf (egal welcher Kontext) wartet, bis sie abgearbeitet ist. Auf einer echten GPU wären das wenige Bilder zu je wenigen ms. Gesichert ist nur die Verschiebung des Blocks; die Warteschlange als Ursache ist abgeleitet, nicht direkt gemessen.
- **Minispiel → Brett:** auf diesem Mac schon vorher ohne Long Task (alle 5 Wechsel 0 ms), also auch dort kein Gewinn durch A.
- **Preis von A:** zweiter Kontext während der ganzen Brettphase (`brett.contextsMax` 1 → 2, schlägt gegen die Baseline an). Revanche ×3 blieb bei 1 Kontext in der Lobby, Heap unverändert (37,6 → 52,5 MB gegenüber 37,9 → 52,2 MB vorher).
- Nach dem ersten Bild folgen in allen Varianten weiter 3,6–4,9 s Shader-Übersetzung mit laufender Render-Schleife (wie EXP-025); die Kennzahl zählt sie nicht.

**Entscheidung:** **discard A/A′.** Kein messbarer Gewinn, dafür ein dauerhafter zweiter Kontext. B war nur eine Messprobe. Ein künstliches Warten vor dem Aufbau (feste Pause oder Fence-Abfrage, bis der GPU-Prozess leer ist) würde die Kennzahl senken, aber auf SwiftShader steht das Bild in dieser Zeit ohnehin (der GPU-Prozess ist belegt), und auf echter Hardware ist die Warteschlange kurz. Nicht umgesetzt; ob überhaupt ein Standbild auf echter Hardware bleibt, zeigt N4. Entwurf und Messcode liegen nicht im Repo (verworfen).

**Offen (nur auf echter Hardware):** N4 der Gerätecheckliste. CHAOS-174 ist verworfen (2026-11-19, Entscheidung an Claude übertragen, `docs/blockers.md`); eine neue Aufgabe nur, wenn N4 ein Standbild zeigt.

---

## EXP-031: Gesamtlauf nativer Apple-Host – komplette Partie im tvOS-Simulator und am Mac (2026-11-19, CHAOS-146)

**Hypothese:** Nach CHAOS-142 … CHAOS-145, CHAOS-190 und CHAOS-193 hostet der native Host eine komplette Partie allein: Lobby mit QR-Code, Brett mit Regie, alle fünf Minispiele der Rotation, Pause, Wiederverbindung, Finale mit Podest und Revanche. Erwartet werden mindestens 30 fps bei 4K in allen Phasen (Ziel 60) und keine JS-Spitze über dem Bild-Budget.

**Aufbau:**

- **Stand:** `main` bei `b477d1f` (PR #92 … #103). USDZ frisch mit `pnpm build:apple-assets` gebaut; ein älterer lokaler Stand vom 18.11. zeigte noch das schwebende Socken-Bündchen.
- **tvOS:** Simulator „Apple TV 4K (3rd generation)“, tvOS 27.0, 4K-Ausgabe (intern 1920×1080, bilinear, wie auf dem Gerät), am Mac (M3 Max). **Auf Rubens Wunsch statt der echten Apple TV** (19.11.: „wäre es mir lieb, wenn du einen echten Simulator einfach benutzt statt dem Fernseher“).
- **Mac:** Release-Build, ad hoc signiert mit Hardened Runtime (JavaScriptCore ohne JIT), Display mit 120 Hz.
- **Controller:** `apps/apple-host/scripts/live-bots.mjs` über echtes WebSocket. tvOS mit 4 Bots, Mac mit 2 Bots, jeweils `--bunt` (Items, Trophäenkauf, Schild, mal zu spät). Dazu `--trennen` (Ben trennt sich und kommt mit Token zurück) und `--funkstille` (Ben verstummt, der Host trennt nach 15 s, Ben kommt zurück).
- **App:** `--autostart --stumm --pausentest --revanche=8` (Pause einmal im Brett und einmal im Minispiel für je 8 s, „Nochmal spielen“ 8 s nach dem Sieger) und `--bild` für Bilder je Phase. 10 Runden.
- **Messung:** `HOST-MESSUNG` alle 10 s (fps, JS je Tick, ausgelassene Ticks). Ausgewertet je Phase über alle Fenster. Fenster ohne Anzeige (Mac mit abgeschaltetem Display) sind getrennt gezählt.

**Ergebnis tvOS-Simulator (4 Bots, eine ganze Partie):**

- **Ablauf:** 10 von 10 Minispielen angenommen (jedes der fünf zweimal), Pause im Brett und im Minispiel, Trennen und Funkstille mit Wiederverbindung, Trophäenzählung, Podest. Danach „Nochmal spielen“, die zweite Partie startet. Keine Fehlerzeile, kein Absturz. Aufwärmen der Minispiel-Bühne beim Start: 364 ms.
- **Hintergrund:** In einem eigenen Lauf lief 25 s lang die Einstellungen-App vorn. Danach war es dieselbe PID, die Partie stand pausiert („Hintergrund: Partie pausiert“, „Vordergrund nach 25,3 s“).

| Phase | Fenster à 10 s | fps Median / Minimum | JS je Tick Median / p95 (Median) / max | ausgelassene Ticks |
| ----- | -------------- | -------------------- | -------------------------------------- | ------------------ |
| Brett | 34 | 58,6 / 50,7 | 0,13 / 0,23 / 4,7 ms | 2 von 20261 |
| Minispiel | 43 | 57,9 / 54,4 | 0,53 / 0,66 / 10,3 ms | 4 von 25489 |
| Pause | 1 | 58,8 | 0,49 / 0,94 / 7,3 ms | 0 |
| Finale | 2 | 59,3 / 54,3 | 0,24 / 0,61 / 2,7 ms | 1 von 1169 |

Zum Vergleich der Stand vor PR #96 und PR #100 (gleicher Aufbau, ohne Pausentest): Brett 58,1 / 29,1 fps (das Minimum im ersten Fenster nach dem Laden), Minispiel 58,3 / 49,3 fps, JS max 31,5 ms beim ersten Minispiel-Aufbau. Mit dem Aufwärmen aus CHAOS-192 fällt diese Spitze weg (max 10,3 ms).

**Ergebnis Mac (2 Bots, eine ganze Partie):**

Zwei Läufe, weil das Display des gesperrten Macs im zweiten Lauf abschaltete:

- **Lauf 1, Display an** (Stand vor PR #96 und #100, also ohne Minispiel-Klänge und neue Lichtstimmung): 10 von 10 Minispielen angenommen, Trennen und Funkstille mit Wiederverbindung, Podest.

| Phase | Fenster à 10 s | fps Median / Minimum (Display 120 Hz) | JS je Tick Median / p95 (Median) / max | ausgelassene Ticks |
| ----- | -------------- | ------------------------------------- | -------------------------------------- | ------------------ |
| Brett | 16 | 106,3 / 95,4 | 0,19 / 1,53 / 9,3 ms | 11 von 18877 |
| Minispiel | 42 | 112,6 / 95,8 | 1,24 / 2,13 / 22,9 ms | 91 von 49769 |
| Finale | 57 | 118,7 / 109,4 | 0,24 / 0,34 / 6,6 ms | 0 von 68320 |

  JavaScriptCore läuft in der Mac-App ohne JIT (Hardened Runtime). Deshalb ist die JS-Zeit im Minispiel höher als im Simulator, und ab und zu fällt ein Tick aus (0,2 %). Die Spielzeit bleibt trotzdem richtig, weil der Kern feste 1/60-Schritte nachholt.
- **Lauf 2, Display aus** (Endstand `main`, mit `--pausentest` und Revanche): Pause im Brett und im Minispiel, Funkstille mit Wiederverbindung, Finale und Revanche liefen durch. Die App lief aber die ganze Zeit im Ersatztakt (10 Bilder je Sekunde, `angezeigt` 0), und macOS drosselte sie. Bei **4 von 10 Minispielen kam das Ergebnis zu spät** („nicht mehr gebraucht (Server ist weiter)“). Das ist ein echter Fehler für einen verdeckten oder minimierten Mac-Host → **CHAOS-203**. Bildraten aus diesem Lauf sind nicht verwertbar.
- **Nachtrag CHAOS-203 (PR #105):** Ursache war die Drosselung durch macOS (Ersatztakt 4 statt 8 Hz, JS-Ticks bis 1,25 s) zusammen mit dem verteilten Aufbau (2 ms je Tick). Mit 8 Hz war die Bühne auch ungedrosselt in 8 von 10 Runden erst nach dem Countdown fertig. Jetzt läuft die Partie ohne Drosselung (`beginActivity`), der Ersatztakt mit 60 Hz. Minimiert: vorher 10/10 angenommen, aber die Bühne nur in 2/10 Runden rechtzeitig; nachher 10/10 angenommen und 10/10 rechtzeitig, längster JS-Tick 31 ms.

**Nebenbefunde:**

- `live-bots.mjs` blieb zweimal am Zug eines Bots stehen. Der Host war daran unschuldig. (1) Eine Antwort fiel in die Pause, der Server lehnte sie mit `paused` ab, und der Bot versuchte es nie wieder. (2) Nach der Revanche zählen die Frage-IDs von vorn, und der Bot hielt sie für schon beantwortet. Beides ist im Skript behoben (wie `test/botMatch.ts`). Ein Mensch tippt nach der Pause ohnehin erneut. Das Spiel wartet bei verbundenen Spielern bewusst ohne Frist.
- **Speicher:** nicht im Simulator gemessen (der Prozess enthält Metal und Simulator-Hülle, rund 800 MB RSS, kein Vergleich zur Apple TV). Gemessen ist der Speicher des JS-Kerns über drei Partien im Harness (CHAOS-141, CHAOS-145: Zuwachs ≤ 1,7 MB). Auf dem Gerät prüft Ruben GL12.
- Am gesperrten Mac schaltet das Display nach einiger Zeit ab. Die App läuft dann im Ersatztakt mit 10 Bildern je Sekunde ohne Anzeige weiter (`angezeigt` 0), und macOS drosselt sie: JS-Spitzen bis 5 s. Für das Spiel hat das keine Bedeutung, ein Host-Mac mit dunklem Display spielt nicht.

**Nicht gemessen (echte Hardware, Ruben, Gerätecheckliste §34):**

- Apple TV mit A15: JavaScriptCore ohne JIT, echte GPU bei 4K
- Fernbedienung
- echte iPhones im Browser und in der nativen Controller-App
- Eingabe → Bild
- Ton

Der Simulator rendert auf der GPU des Macs, und JavaScriptCore hat dort JIT. Die Werte oben sind also eine Obergrenze für die Apple TV, kein Nachweis.

**Entscheidung:** **keep.** Der native Host spielt eine komplette Partie ohne Rechner-Server, mit allen Minispielen der Rotation, Pause, Wiederverbindung, Finale und Revanche. Im Simulator und am Mac bleibt er in allen Phasen weit über 30 fps. Offen ist der Nachweis auf der echten Apple TV (GL1–GL16), danach die M5-Abnahme CHAOS-164.

---

## EXP-032: Feinstruktur der Figuren über Normal-Texturen (2026-11-20, CHAOS-172)

**Hypothese / gewünschtes Spielerlebnis:** Nach EXP-027 und EXP-028 sitzen Form und grobes Detail der vier Figuren in Punkten und Vertexfarben. Aus der Nähe fehlt Material: Die Socke ist glatter Kunststoff statt Strick, Wusel hat kein Fell, Schraubis Lack ist makellos. Annahme (EXP-027, Variante D): Eine kleine, kachelbare Normal-Textur je Figur bringt diese Struktur ohne neue Punkte. Aus der Brettentfernung mitteln die Mipmaps sie weg.

**Auftrag:** Ruben hat die Aufgabe am 2026-11-20 direkt genannt („CHAOS-172“). Sie lag im zurückgestellten Backlog unter CHAOS-44 (Kommentar vom 19.11.).

**Varianten:**

| | Weg | Erwartung |
|---|---|---|
| a | Normal-Textur aus einem Fremd-Asset (z. B. Poly Haven) | fertige Optik, aber Lizenz- und Herkunftspflege und Größe (512²+) |
| b | **prozedural mit numpy** (`packages/assets/blender/struktur.py`): Höhenfeld aus ganzzahligen Sinuswellen, Maschen-Ellipsen, Kratzer-Rillen, Tüpfeln → Normalen; 256², kachelbar, fester Startwert | eigenes Werk, reproduzierbar, sehr klein; Optik muss man selbst treffen |
| c | Rauheits- statt Normal-Textur | billiger im Shader, aber Strick und Fell leben von Licht und Schatten der Struktur, nicht vom Glanz |

Umgesetzt und gemessen wurde **b**. Bei der UV-Abwicklung gab es zwei Schritte:

| | UV-Map `struktur` | Eckpunkte Socke (vorher 5 772) |
|---|---|---|
| b1 | Würfelprojektion je Fläche nach der Hauptachse der Normale | 7 770 (+35 %), GLB 546 KiB |
| b2 | **Würfelprojektion mit Hysterese:** Die Achse wächst über Nachbarflächen und wechselt erst ab 53° Abweichung (`STICKY = 0.6`) | 6 781 (+17 %), GLB 489 KiB |

**Umsetzung:**
- Vier Muster: `strick` (Spalten aus V-Maschen, Kachel 12 cm), `fell` (gekämmte Strähnen, 10 cm), `lack` (Orangenhaut und neun Kratzer, 30 cm), `haut` (Tüpfel, 9 cm). Je Figur genau ein Muster: Socke Strick (auch das Bündchen), Wusel Fell, Schraubi Lack (auch der Halsring), Kalle Kaktushaut.
- Tangentenbasis je Projektionsachse rechtshändig, auf Seitenflächen zeigt V nach oben (Maschen stehen senkrecht, Fell fällt nach unten).
- Die Stärke steckt in der Textur (`relief`), die Normal Map im Material hat Stärke 1. Grund: `UsdPreviewSurface` kennt keine Stärke (der USD-Export schreibt immer `scale 2`/`bias -1`). So sehen Babylon und RealityKit gleich stark aus.
- **GLB:** `normalTexture` auf `TEXCOORD_0` (die einzige UV-Map; Farben bleiben Vertexfarben), Bild als WebP (Qualität 90, `EXT_texture_webp`). Der Babylon-Host registriert dafür `EXT_texture_webp`; ohne den Import lehnte der Lader die Dateien ab („Required extension … not available“).
- **USDZ:** Der Farbatlas bekommt eine eigene UV-Map `farbatlas` (wird zur Primvar `st`), die Struktur liest die Primvar `struktur`. Die Normal-Textur liegt als PNG im Paket (`textures/struktur_<muster>.png`).

**Messgrößen und Ergebnisse** (Linux-Container, bpy 5.3.0, Chromium mit SwiftShader):

| Figur | GLB vorher | GLB nachher | Bild | Eckpunkte | USDZ vorher → nachher |
|---|---|---|---|---|---|
| Socke | 371 KiB | 488 KiB | 24 KiB | 5 772 → 6 781 | 995 KiB → 1,41 MiB |
| Wusel | 430 KiB | 594 KiB | 12 KiB | 7 180 → 9 371 | 1,1 → 1,54 MiB |
| Schraubi | 372 KiB | 580 KiB | 3 KiB | 7 198 → 11 017 | 903 KiB → 1,01 MiB |
| Kalle | 486 KiB | 636 KiB | 8 KiB | 8 172 → 9 957 | 1,3 → 1,44 MiB |

- Dreiecke unverändert (Grenze 15 000). Die Größe kommt fast ganz aus der UV-Map (8 Byte je Punkt) und den Nähten (getrennte Punkte mit Normale, Vertexfarbe und Gewichten). Die Bilder selbst sind 3–24 KiB groß. Schraubi wächst am stärksten, weil seine gefasten Kästen an jeder Fase die Projektionsachse wechseln.
- **Nahbilder** (Blender-Cycles): Strickmaschen, Fellstrich und Kaktustüpfel deutlich, Lackkratzer dezent ([`chaos172-blender-nahbilder.jpg`](screenshots/chaos172-blender-nahbilder.jpg)). Muster: [`chaos172-muster.jpg`](screenshots/chaos172-muster.jpg).
- **Babylon-Vitrine:** Die Socke zeigt aus der Nähe Maschen. Im Brettblick ist kein Unterschied zu vorher zu sehen ([`chaos172-babylon-vorher-nachher.jpg`](screenshots/chaos172-babylon-vorher-nachher.jpg)).
- **USDZ** (in Blender importiert und gerendert): Farbatlas und Struktur sitzen richtig, keine Flecken ([`chaos172-usdz-nachher.jpg`](screenshots/chaos172-usdz-nachher.jpg)).
- **Nebenbefund:** Der Babylon-Host registriert keine einzige glTF-Materialerweiterung. Sheen, Clearcoat und `KHR_materials_emissive_strength` der Figuren kommen im Spiel nicht an (Test mit `keepPbr`: `sheen.isEnabled` und `clearCoat.isEnabled` sind bei allen vier Figuren `false`). Das ist älter als diese Aufgabe und hier bewusst nicht behoben, weil es den abgenommenen Look ändern würde → CHAOS-207. **Nachtrag 2026-11-20 (CHAOS-207):** Die drei Erweiterungen sind registriert. Wirkung (Vitrine `?pbr=1`, `docs/screenshots/chaos207-*.jpg`): Fell und Strick werden heller und samtiger, an den Rändern mit Glanz. Knöpfe, Augen und Lack glänzen stärker. Schraubis Augen und Glühbirne strahlen reinweiß (Leuchtstärke 2), der türkise Schimmer der Augen geht verloren. Brett-, Minispiel- und Podest-Screenshots bleiben unter der E2E-Toleranz (2 %), weil die Figuren dort klein sind. Ruben hat den Look am 2026-11-20 abgenommen („Ja, Look passt“), PR #112.

**Budgets** (Manifest `budgets.model`):
- Neu: `maxImages` 1, `maxImageBytes` 32 KiB, `maxImageSize` 256. Texturen in Figuren nur als `normalTexture`. Eine Grundfarbe aus einer Textur würde die Slot-Färbung von `akzent` und die Vertexfarben umgehen.
- Dateigröße je Figur: Art-Budget von 512 auf 768 KiB. Je Figur: Socke 576 KiB, Schraubi und Wusel 640 KiB, Kalle 704 KiB. Begründung wie EXP-027: Die Größe kommt aus Punkten, nicht aus der Grafikleistung. Im Web lädt der Host die Figuren nach dem Start-Bundle (`pnpm check:bundle` unverändert), alle vier zusammen 2,3 MiB über das lokale Netz.
- USDZ je Figur: 1,5 → 2 MiB (Wusel 1,54 MiB).

**Nicht geprüft:**
- **RealityKit:** ob es die zweite UV-Map (`struktur`) für die Normal-Textur liest und daraus Tangenten bildet. Dafür gibt es kein Werkzeug im Container, also Gerätecheckliste §35.
- Echte GPU am PC (SwiftShader rendert Normal Maps korrekt, aber ohne anisotrope Filterung).

**Entscheidung:** **b2 behalten**, vorbehaltlich RealityKit am Mac und Rubens Urteil. Falls RealityKit nur `st` liest: Normalen in eine zweite Atlas-Textur auf `st` backen (1024², ohne Kacheln). Das ist gröber, braucht aber keine zweite UV-Map.

**Subjektive Fragen an Ruben:** Ist die Struktur aus der Nähe schön oder zu viel (Strick vor allem)? Wirkt Wusels Fell wie Fell? Sind die Lackkratzer bei Schraubi passend oder überflüssig?

## EXP-033: Dynamische Brett-Kamera – Figur am Zug statt Vollansicht (2026-11-20, CHAOS-194)

**Hypothese / gewünschtes Spielerlebnis:** Die Kamera bleibt nah an der Figur, die gerade dran ist. Sie schaut beim Laufen voraus, zoomt bei Ereignissen kurz heran und zieht nur auf, wo mehr zählt: an der Gabel beide Wege, beim Klau beide Figuren, zu Rundenbeginn das ganze Brett. Am Fernseher wirkt das lebendig, bleibt aber ruhig, ohne Hektik und ohne Übelkeit. Ruben (2026-11-19): „Ich möchte auf die Figur konzentrieren die dran ist und nicht immer eine vollansicht vom brett. muss dynamischer werden.“

**Varianten:**
- **A (bisher):** Vollansicht des Bretts, Blickpunkt rückt um 12 % (seitlich) bzw. 4 % (Tiefe) zur Figur am Zug, fester Abstand 33, exponentielles Nachziehen (Halbwertszeit 700 ms). Übersichtlich, aber statisch; auf größeren Brettern (CHAOS-196/198/199) zu klein.
- **B:** Nur nah folgen (fester Abstand 17), ohne Einpassen. Dynamisch, aber an Gabeln ist ein Weg abgeschnitten, und beim Klau fehlt eine der beiden Figuren.
- **C (gewählt):** Einstellungen je Moment (`apps/host/src/board/camera.ts`): Würfeln und Warten nah (17), Laufen etwas weiter (19) mit 2,4 Einheiten Vorausblick entlang des Wegs, Ereignis-Zoom (15). Gabel, Klau, Reaktion, Platztausch und Windstoß werden per Projektion eingepasst (mindestens 17). Überblick nur zu Rundenbeginn, beim Trophäen-Wirbel und Münzregen (alle Figuren), wenn eine Trophäe wandert (Start und Ziel), und außerhalb der Züge (Minispiel, Ende). Tempo: kritisch gedämpfte Feder statt Exponentialkurve (weich an, weich aus), 420 ms beim Laufen bis 1000 ms im Überblick. Bei weiten Fahrten (Zugwechsel) hebt sich die Kamera unterwegs um 0,35 je Einheit Fahrweg, höchstens 12.

Feinabstimmung innerhalb von C:
- Vorhalt: Mit dem alten Vorhalt (1,6 vor dem Ziel, mit dem Abstand skaliert) stand die Figur nah oberhalb der Bildmitte, und das Würfel-Popup ragte in das Banner. Jetzt liegt der Blickpunkt nah 1,2 hinter der Figur und geht bis zum Überblick linear auf −1,6.
- Sicherer Bildbereich: Erst symmetrisch (oben 0,78, unten 0,84), dabei stand die Figur an der Gabel direkt über der Spielerleiste. Jetzt oben 0,76, unten 0,56 der halben Bildhöhe, und die Punkte werden senkrecht in diesem Bereich mittig gesetzt. Der Überblick des Wackelwalds liegt dadurch etwa 10 % weiter weg als A (36,3 statt 33).
- Brettrand: Nahe Einstellungen bleiben um 55 % der halben Bildbreite innerhalb der Felder (mit 45 % war an Randfeldern noch ein Drittel des Bilds leer). Die Figur rückt dann aus der Mitte, bleibt aber im Bild. In der Tiefe begrenzt das nichts mehr: Im tvOS-Simulator schob die Begrenzung eine Figur am vorderen Rand unter die Spielerleiste.

**Objektive Messgrößen:** Abstand je Einstellung; ob alle eingepassten Punkte im Bild liegen (Projektion, feste Seeds 1/7/42/2026 mit je 25 Punktwolken); Weg je Bild bei einem Zugwechsel (s07 → s34, höchstens 5 % des Wegs je Bild bei 60 fps); Gleichheit der Posen bei 30/60/144 fps; Determinismus über den Demo-Ablauf.

**Subjektive Playtest-Fragen (für Ruben):** Ist die Nähe richtig, oder fehlt dir der Überblick, wo die anderen stehen? Ist das Tempo ruhig genug am Fernseher (Zugwechsel, Ereignis-Zoom), wird jemandem schwindlig? Reicht der Überblick zu Rundenbeginn, oder soll er öfter oder länger kommen? Ist die Gabel-Ansicht gut lesbar?

**Testumgebung:** MacBook (Apple Silicon), Chromium mit SwiftShader (Playwright, Testmodus 1/60 s), Branch `claude/chaos-194-brett-kamera`. Unit-Tests `apps/host/src/board/camera.test.ts`, E2E `tests/e2e/host-brett.spec.ts` („Kamera-Regie …“).

**Ergebnisse:**
- Wackelwald: Würfeln/Warten 17, Laufen 19, Ereignis 15, Gabel A (s07) 17,6, Gabel s29 20,0, Überblick 36,3 (A: immer 33).
- Brett um den Faktor 2,5 gestreckt: Überblick wächst mit (mehr als das Doppelte), Figur am Zug bleibt bei 17, Gabeln passen ins Bild. Es gibt keine festen Brettgrenzen mehr.
- Zugwechsel s07 → s34: kein Sprung (höchster Weg je Bild unter 5 % der Strecke), unterwegs mehr als 2 Einheiten höher, nach 5 s angekommen.
- Feder: Posen bei 30, 60 und 144 Schritten je Sekunde gleich (exakte Lösung je Schritt), kein Überschwingen. Demo-Ablauf zweimal gespielt: Posen identisch.
- Bilder (Testmodus, Sparstufe): [`chaos194-kamera-gabel.jpg`](screenshots/chaos194-kamera-gabel.jpg), [`chaos194-kamera-laufen.jpg`](screenshots/chaos194-kamera-laufen.jpg), [`chaos194-kamera-zugwechsel.jpg`](screenshots/chaos194-kamera-zugwechsel.jpg), [`chaos194-kamera-ereignis.jpg`](screenshots/chaos194-kamera-ereignis.jpg), [`chaos194-kamera-ueberblick.jpg`](screenshots/chaos194-kamera-ueberblick.jpg).

- Apple-Host im tvOS-Simulator (Apple TV 4K, 3. Generation; 4 Bots mit `--bunt`, 2 Runden, `--bild` und `--ereignisbild`): dieselben Einstellungen wie am PC, keine `FEHLER` im Log, beide Minispiel-Ergebnisse angenommen. Bilder: [`chaos194-apple-tv-wuerfeln.jpg`](screenshots/chaos194-apple-tv-wuerfeln.jpg) (Würfel und Falle nah), [`chaos194-apple-tv-klau.jpg`](screenshots/chaos194-apple-tv-klau.jpg) (Klau mit beiden Figuren im Bild).

- Aufholen der Regie (Rückstand über 2,5 s, dreifach schnell): Mit der Uhrzeit als Maß rechnete die Lauf-Einstellung den Sprung zu niedrig und blickte zurück statt voraus. Ereignisse zählen deshalb in gespielter Regie-Zeit (`FrameCue.elapsedMs`); Unit-Test mit 10 Feldern samt Würfel und Münzen.
- Rechenzeit: `cameraShot` mit Einpassen ≈ 0,08 ms am Mac (Node mit JIT). Die Apple TV rechnet ohne JIT; deshalb merkt sich `fitShot` die Ergebnisse (gleiche Punkte Bild für Bild bei offenem Prompt), danach ≈ 0,002 ms. Ohne JIT nicht gemessen (Node `--jitless` lädt das Projekt nicht, WebAssembly fehlt), offen in der Gerätecheckliste §36.

**Entscheidung:** **C behalten.** B scheitert an Gabel und Klau, A erfüllt Rubens Wunsch nicht und taugt nicht für größere Bretter. Die Zahlen sind ein erster Wurf aus Screenshots, kein Spieltest.

**Offen für Playtest:** Der menschliche Spieltest am Fernseher (PC-Host und Apple TV) steht aus: Nähe, Tempo, Übelkeit und ob man die anderen Figuren vermisst. Randmarker für Figuren außerhalb des Bilds gibt es noch nicht. Betroffene Figuren werden stattdessen eingepasst; Folgeaufgabe CHAOS-210.

## EXP-034: Rummelplatz – Karussell dreht den Weg (2026-11-20, CHAOS-199)

**Hypothese / gewünschtes Spielerlebnis:** Ein drittes, großes Brett mit eigenem Thema bringt Abwechslung. Das Karussell in der Mitte ändert jede Runde, wohin seine Abkürzung führt. Spieler sehen die Stellung (Tor am Karussell, Zusatz an der Wegwahl) und planen danach. Die Wegwahl bleibt fair: Kein Weg gewinnt deutlich öfter, alle Trophäen-Kandidaten kommen ins Spiel.

**Varianten:**
- **Drehung je Runde, fest reihum (gewählt, ADR-022):** West (Spiegelkabinett) → Süd (Abkürzung zum Startplatz) → Ost (Ehrenrunde zurück in die Geisterbahn). Planbar, ohne Protokolländerung.
- Drehung per Zufall je Runde: verworfen, nicht planbar.
- Karussell als normale Gabel mit wechselnden Optionen: verworfen, dann entscheidet der Spieler statt des Karussells.
- Losbude als neuer Feldtyp: zurückgestellt. Ein neuer `SpaceKind` hätte Protokoll, Controller und beide Hosts berührt. Die Losbudengasse ist stattdessen der Glücksweg (fünf Item- und zwei Ereignisfelder auf zehn Feldern).

**Layout:** 81 Felder auf ≈ 44 × 24, drei Gabeln (Riesenradweg 10 / Geisterbahn 7 Felder, Zuckerwattenallee / Karussell, Losbudengasse 10 / Spiegelkabinett 7), neun Trophäen-Kandidaten, Runde über den Start 43–49 Felder (über das Karussell nach Westen 41–44), Schleife über das Karussell nach Süden 28–31.

**Objektive Messgrößen:** gekaufte Trophäen je Partie, Abstand Platz 1/2 (Trophäen), gekaufte Kandidaten, Wegwahlen, Karussell-Ausfahrten, Siegquote nach Anteil riskanter Wege (Geisterbahn, Spiegelkabinett, Karussell bzw. im Wackelwald Sumpf und Brücke; Spieler unter/über dem Median).

**Testumgebung:** `simulateGame` mit `DEFAULT_RULES`, 4 Bots, Seeds 1–300 je Zeile, MacBook (Node 26). Skript wie in CHAOS-199 beschrieben (Zähler `trophySpacesBought`, `pathsChosen`, `pathChoices`, `rotationExits` in `SimulationResult`).

**Ergebnisse:**

| Brett | Runden | Dauer (min) | Trophäen | Abstand 1/2 | Kandidaten gekauft | Sieg wenig/viel riskant |
|---|---|---|---|---|---|---|
| Wackelwald | 10 | 9,2 | 7,5 | 0,83 | 6/6 | 21 % / 29 % |
| Wackelwald | 12 | 11,0 | 9,8 | 1,10 | 6/6 | 21 % / 29 % |
| Rummelplatz | 10 | 9,1 | 5,6 | 0,73 | 9/9 | 27 % / 23 % |
| Rummelplatz | 12 | 10,9 | 7,6 | 0,85 | 9/9 | 26 % / 24 % |
| Rummelplatz | 16 | 14,6 | 11,3 | 0,88 | 9/9 | 28 % / 23 % |

- Auf dem größeren Brett liegen Trophäen weiter auseinander: Mit 12 Runden werden so viele gekauft wie im Wackelwald mit 10. Darum empfiehlt das Register 12 Runden (`recommendedRounds`).
- Alle neun Kandidaten werden gekauft. Am seltensten s52 (Ende der Losbudengasse, 0,2 je Partie bei 10 Runden) und s73 (Süd-Ausfahrt, nur in jeder dritten Runde erreichbar, 0,37).
- Wegwahl je Partie (10 Runden): Gabel A 2,3 / 2,3, Gabel B 2,1 oben / 2,2 Karussell, Gabel C 0,9 / 0,9. Gabel C sehen Bots seltener, weil zwei Karussell-Ausfahrten an ihr vorbeiführen.
- Karussell-Ausfahrten je Partie: West 0,7, Süd 0,6, Ost 0,8, also gleich verteilt.
- Fairness: Wer viel riskant fährt, gewinnt auf dem Rummelplatz 3–5 Prozentpunkte seltener, im Wackelwald 4–8 Punkte öfter. Beides ist klein gegen die Grundquote von 25 %. Kein Weg dominiert.
- Ganze Partien laufen auf PC-Host (Chromium, Metal), Mac-App und im tvOS-Simulator (Apple TV 4K, 3. Generation; je vier Bots mit `--bunt`, drei Runden bis zum Siegerbild, alle Minispiel-Ergebnisse angenommen, keine `FEHLER`) ohne Fehler.
- Apple-Host: Kulisse Rummelplatz lädt am Mac in ≈ 1,0 s, im tvOS-Simulator in 4,2 s (in der Lobby vorgeladen, parallel zum Aufwärmen). Speicher im Simulator in der Lobby (`footprint`): nur Wackelwald 354 MB, Wackelwald und Rummelplatz geladen 365 MB; RSS-Spitze während der Partie 619 MB (ohne Vergleichswert, andere Messart als CHAOS-191). Mit „Zufall“ und sieben Revanchen am Mac wechselte die Kulisse sechsmal in beide Richtungen ohne Neustart (CHAOS-212).
- Ausfahrt-Tor im Apple-Host: Mit dem gerechneten Vorzeichen (`-angle` wegen der x-Spiegelung) zeigte es am Mac zum Gegen-Ausgang (Osten statt Westen in Runde 1). Mit `+angle` zeigt es im tvOS-Simulator richtig nach Westen. Bilder: [`chaos199-rummelplatz-pc-ueberblick.jpg`](screenshots/chaos199-rummelplatz-pc-ueberblick.jpg), [`chaos199-rummelplatz-pc-gabel.jpg`](screenshots/chaos199-rummelplatz-pc-gabel.jpg), [`chaos199-rummelplatz-mac.jpg`](screenshots/chaos199-rummelplatz-mac.jpg), [`chaos199-rummelplatz-apple-tv-sim.jpg`](screenshots/chaos199-rummelplatz-apple-tv-sim.jpg).

**Entscheidung:** **Behalten**, mit 12 empfohlenen Runden. Die Zahlen sind Bot-Simulation, kein Spieltest. Offen für Ruben (Gerätecheckliste §41): Ist die Stellung des Karussells am Fernseher klar, und fühlt sich die Ehrenrunde lustig oder ärgerlich an?

## EXP-035: Echte Klänge statt Synthese (2026-11-20, CHAOS-223)

**Hypothese / gewünschtes Spielerlebnis:** Echte Aufnahmen (Würfelklappern, Boing, Platschen, Fanfare, Jubel) machen die Partie am Fernseher lebendig und cartoonig. Die prozeduralen Rezepte (CHAOS-33) klangen nach Piepsen. Ruben nach einer Partie auf der Apple TV (2026-11-20): „Wir brauchen dringend VIEL BESSERE Töne. Das ist ja grauenhaft so.“

**Varianten:**
- **A (bisher):** 35 Rezepte aus Oszillator und Rauschen (`apps/host/src/fx/sounds.ts`), Synthese per WebAudio bzw. AVAudioEngine.
- **B (gewählt):** CC0-Aufnahmen. Kenney-Pakete (Casino: Würfel; Interface: Bestätigen, Fehler, Glas, Pause/Weiter; Impact: Holz, Treffer; RPG: Münzbeutel; Music Jingles: Pizzicato-Läufe für Zugbeginn, Minispiel-Zeit, Münzverlust, ein Saxofon-Lauf abwärts für die Finte) und freesound.org für das, was Kenney nicht hat (Boing, Platschen, Wusch, Plopp, Münze, Trillerpfeife, Lotusflöte, Jubel, Fanfaren, Mausefalle). Je häufigem Klang zwei bis drei Varianten reihum, dazu ±2–10 % Tonhöhen-Streuung.
- **Verworfen:** Kenney „Voiceover Pack“ (englische Ansagen „Go!“, „You win“) passt nicht zu deutschen Texten. Kenney „Digital Audio“ und „Sci-Fi Sounds“ klingen nach Weltraum, nicht nach Picknick. Sonniss-, BBC- und Pixabay-Sammlungen sind nicht CC0 und dürfen nicht als Rohdatei in ein öffentliches Repository.

**Auswahl ohne Ohr:** Claude kann nicht hören. Grundlage waren Titel, Beschreibung und Downloadzahl auf freesound.org, die Paketstruktur bei Kenney und eine grobe Tonhöhen-Kontur der Jingles (dominante Frequenz je 50 ms): aufsteigend (+5 bis +9 Halbtöne) für Zugbeginn und Minispiel-Zeit, fallend (−9) für Münzverlust. Das Urteil liegt bei Ruben.

**Objektive Messgrößen:** Dauer je Datei (häufige Klänge ≤ 0,3–0,6 s, längste 1,9 s), Spitzenpegel ≤ −0,1 dBFS, Effektivpegel nach dem Import (Ziel −18 dBFS, Würfel und Münzbeutel wegen Pausen zwischen den Anschlägen −21 bis −30 dBFS), Größe (40 Dateien, rund 310 KiB), verworfene Klänge je Minispiel (Logzeile „Minispiel-Klänge …: n gespielt, m verworfen“), Ladezeit der Dateien in Swift (Log „Klang-Dateien: n geladen in … ms“).

**Subjektive Playtest-Fragen (für Ruben):** Klingt es jetzt nach Partyspiel? Welche Klänge nerven nach zehn Runden (Zugbeginn, Münzen, Würfel)? Ist etwas zu laut oder zu leise im Verhältnis? Passt die Trillerpfeife zum Minispiel-Start? Sind Jubel und Fanfare zu lang?

**Testumgebung:** MacBook (Apple Silicon), Import mit ffmpeg 8 und libmp3lame (VBR q3, mono 44,1 kHz), Branch `claude/chaos-223-klaenge`. Unit-Tests `apps/host/src/fx/samples.test.ts`, `audio.test.ts`, `apps/apple-host/test/soundCue.test.ts`; Mac-App mit `--selftest` und Bot-Partie.

**Ergebnisse:**
- Mac-App (Release, `--autostart --runden=3`, vier Bots mit `--bunt`): „Klang-Dateien: 40 geladen in 126 ms“ (Hintergrund-Queue). Alle Minispiel-Klänge kamen aus Dateien, keiner wurde verworfen: Sockenregen 114 (whoosh×69, coin×20, bump×17), Kuckucks-Klatsche 223 (pop×46, tick×49, bump×35), Pudding-Gerangel 134 (whoosh×33, splash×31, pop×30).
- Befund: Kuckucks-Klatsche spielt `lose` bei jeder Finte (8× in einem Spiel). Die erste Wahl, ein 1,9 s langes „Wah-wah-wah“ (freesound 835112), wäre dort nervig gewesen. Ersetzt durch einen Saxofon-Lauf abwärts (Kenney `jingles_SAX01`, 0,84 s), Test-Grenze für `lose` 1,2 s.
- `--selftest` meldet 40 Klang-Dateien, Browser-Build und Apple-Host-Bündel im Budget (Apple-Host-Bündel enthält nur die Dateinamen, keine Tondaten).
- Hörprobe alt gegen neu als Seite: https://claude.ai/artifact/WvAV3q58ah5VLnCRWTLMj7

**Entscheidung:** B behalten, vorbehaltlich Rubens Hörprobe am Fernseher (Gerätecheckliste §44). Einzelne Klänge tauscht eine Zeile in `packages/assets/sounds.json`.

## EXP-036: Frostgipfel – Eis, Seilbahn und Lawinen (2026-11-20, CHAOS-198)

**Hypothese / gewünschtes Spielerlebnis:** Ein zweites Themenbrett „Frostgipfel“ mit drei eigenen Mechaniken bringt Abwechslung, ohne die Wegwahl zu verzerren. Eisfelder sorgen für kleine Überraschungen (die Figur rutscht weiter, manchmal auf ein Minusfeld). Die Lawine ist eine angekündigte Gefahr: Wer in der Warnrunde am Hang stehen bleibt, verliert Münzen. Die Seilbahn ist eine teure Abkürzung, die sich gezielt lohnt (Trophäe vorn), aber nicht immer.

**Varianten:**
- **Seilbahn-Preis 4 / 5 / 6 / 8 / 10 / 12 / 15 Münzen (8 gewählt):** Unter 12 wählen Bots sie in rund der Hälfte der Fälle, ab 12 deutlich seltener. Der Preis allein ändert die Siegquote der Fahrer kaum.
- **Trophäen-Kandidat am Gipfelweg vor (g04) oder hinter der Bergstation (g07, gewählt):** Mit g04 überspringt die Seilbahn zwei Kandidaten. Wer zweimal oder öfter fährt, gewinnt dann nur 16–18 %. Mit g07 liegt ein Kandidat direkt hinter der Bergstation (22–23 %, kein Weg dominiert).
- **Lawine am Rundenende oder am Rundenbeginn (gewählt, ADR-023):** Rundenbeginn trennt sie vom Minispiel-Ergebnis und vom Rückenwind. Warnung genau eine Runde vorher.
- **Lawine schiebt Figuren ins Tal:** verworfen, weil „Tal“ auf dem Frostgipfel oft in Laufrichtung liegt (Geschenk statt Strafe).
- Eigene Feldtypen oder Ereignisse für Eis, Seilbahn, Lawine: verworfen (Protokoll, Controller, beide Hosts; ADR-023).

**Layout:** 75 Felder auf ≈ 44 × 24, vier Gabeln (Talstation: Talweg / Seilbahn für 8 Münzen; A: Lärchenhang 10 / Gletscherpfad 7; B: Höhenweg / Gipfelweg; C: Serpentinen 10 / Rodelbahn 7), sieben Eisfelder (Rodelbahn r1–r3 am Stück), Lawine alle drei Runden abwechselnd am Gletscherpfad und am Nordhang (je fünf Felder, 5 Münzen), neun Trophäen-Kandidaten. Runde über den Start 42–49 Felder, über die Seilbahn 21.

**Objektive Messgrößen:** wie EXP-034 (Trophäen, Abstand 1/2, gekaufte Kandidaten, Wegwahlen, Siegquote nach Anteil riskanter Wege: Gletscherpfad, Gipfelweg, Rodelbahn, Seilbahn), dazu Rutschpartien, Seilbahnfahrten, Lawinen und Treffer (`iceSlides`, `cableRides`, `avalanches`, `avalancheHits` in `SimulationResult`).

**Testumgebung:** `simulateGame` mit `DEFAULT_RULES`, 4 Bots, Seeds 1–300 je Zeile, MacBook (Node 26).

**Ergebnisse:**

| Brett | Runden | Dauer (min) | Trophäen | Abstand 1/2 | Kandidaten gekauft | Sieg wenig/viel riskant |
|---|---|---|---|---|---|---|
| Frostgipfel | 10 | 9,2 | 6,2 | 0,64 | 9/9 | 28 % / 23 % |
| Frostgipfel | 12 | 11,1 | 8,0 | 0,79 | 9/9 | 26 % / 23 % |
| Frostgipfel | 16 | 14,8 | 11,9 | 0,78 | 9/9 | 25 % / 24 % |

- Mit 12 Runden werden etwa so viele Trophäen gekauft wie im Wackelwald mit 10 (EXP-034). Darum empfiehlt das Register 12 Runden.
- Alle neun Kandidaten werden gekauft. Am seltensten f48 (Ende der Serpentinen, 0,23 je Partie bei 12 Runden): Gipfelweg und Seilbahn führen an Gabel C vorbei. Am häufigsten j7 vor dem Start (1,8) und r5 auf der Rodelbahn (1,4), weil fast jeder Weg dort vorbeiführt.
- Je Partie (12 Runden): 3,7 Rutschpartien mit zusammen 4,2 Feldern, 3,5 Seilbahnfahrten, 3 Lawinen mit 0,8 Treffern. Die Lawine trifft selten, weil sie angesagt ist und die Hänge kurz sind. Bots kennen die Warnung nicht; Menschen dürften noch seltener getroffen werden.
- Wegwahl je Partie (12 Runden): Talstation 3,4 Talweg / 3,5 Seilbahn, Gabel A 1,8 / 1,7, Gabel B 1,4 Höhenweg / 1,4 Gipfelweg, Gabel C 0,5 / 0,6.
- Siegquote nach Nutzung (12 Runden): Seilbahn nie 25 %, einmal 26 %, zweimal oder öfter 23 %. Gletscherpfad nie 23 %, einmal 27 %. Kein Weg dominiert. Die Spreizung „wenig/viel riskant“ (3 Punkte) liegt im Bereich von Rummelplatz und Wackelwald.
- PC-Host (Chrome, Metal): Kulisse lädt ohne Fehler, Überblick und Gabel an der Talstation siehe [`chaos198-frostgipfel-pc-ueberblick.jpg`](screenshots/chaos198-frostgipfel-pc-ueberblick.jpg) und [`chaos198-frostgipfel-pc-gabel.jpg`](screenshots/chaos198-frostgipfel-pc-gabel.jpg).
- Apple-Host: ganze Partien mit vier Bots (`--bunt`, 4 Runden bis zum Siegerbild, alle Minispiel-Ergebnisse angenommen, keine `FEHLER`) am Mac und im tvOS-Simulator (Apple TV 4K, 3. Generation). Kulisse Frostgipfel (USDZ 15,2 MiB, 75 Feld-Anker) lädt am Mac in 0,7 s (erster Start nach dem Bauen 6,0 s), im Simulator in 4,1 s; im Simulator 60 Bilder/s auf dem Brett. Zu Beginn von Runde 4 zeigen Mac und Simulator „Lawine am Gletscherpfad!“ samt Tickerzeile. Bilder: [`chaos198-frostgipfel-mac-lawine.jpg`](screenshots/chaos198-frostgipfel-mac-lawine.jpg), [`chaos198-frostgipfel-apple-tv-sim.jpg`](screenshots/chaos198-frostgipfel-apple-tv-sim.jpg).

**Entscheidung:** **Behalten**: Seilbahn 8 Münzen, Kandidat hinter der Bergstation, Lawine alle drei Runden mit 5 Münzen, 12 empfohlene Runden. Die Zahlen sind Bot-Simulation, kein Spieltest. Offen für Ruben (Gerätecheckliste §43): Ist die Lawinen-Warnung klar, wird die Seilbahn gezielt genutzt, ist die Rutschpartie nachvollziehbar?

## EXP-037: Großer Wackelwald – 74 Felder, vier Gabeln (2026-11-20, CHAOS-196)

**Hypothese / gewünschtes Spielerlebnis:** Ein größeres Brett mit mehr Wegen macht die Wegwahl interessanter und das Brett abwechslungsreicher, ohne dass Trophäen außer Reichweite geraten. Ruben (2026-11-19): „auch das wackelwald brett muss größer werden“. Die dynamische Kamera (CHAOS-194, EXP-033) hält das größere Brett lesbar.

**Varianten:**
- **A (bisher, `wackelwaldM2.ts`):** 43 Felder auf ≈ 32 × 18, zwei Gabeln (Klippenweg/Sumpf, Pilzpfad/Wackelbrücke), Runde 32–36 Felder, sechs Trophäen-Kandidaten, sechs Item-Felder. Bleibt für EXP-001 … EXP-022 erhalten (`rules/experiments.ts`, `rules/experimentsM4.ts`), damit deren Tabellen wiederholbar bleiben.
- **B1 (erster Entwurf):** 74 Felder auf ≈ 41 × 26, vier Gabeln: A Klippenweg 6 / Sumpfabkürzung 4, D Bachlauf oben herum / Lichtung 11 quer durch die Mitte, B (oben) Uferweg 11 / Baumkronenweg 8, C Pilzpfad 6 / Wackelbrücke 4; Runde 37–47 Felder. Acht Trophäen-Kandidaten, vorwiegend auf kurzen Zweigen wie in A.
- **B2:** wie B1, zusätzlich Trophäen-Kandidaten auf Pilzpfad, Uferweg und oben (s22), Lichtung beginnt mit Minus.
- **B3:** wie B2 ohne s22, Lichtung wieder mit Plus; dafür drei Kandidaten auf gemeinsamen Stücken (s05 nach dem Start, s73 hinter Lichtung und Bachlauf, s42 wie bisher) und ein Ereignis statt Minus am Ende der Sumpfabkürzung. Zwölf Kandidaten, zehn Item-Felder, jeder Zweig hat einen Kandidaten.
- **B4 (gewählt):** wie B3, dazu ein Kandidat auf s18 (gemeinsam, hinter Gabel A): In fünf Runden läuft man nur etwa 20 Felder, also bis kurz hinter Gabel A. 13 Kandidaten.

**Objektive Messgrößen:** Bot-Partien mit den Standardregeln und echter Minispiel-Rotation (`packages/game-core/src/rules/experimentsBoard.ts`, Seeds 1–200, 2–4 Spieler, 5/10/12/15/20 Runden): Trophäen je Partie, Anteil Spieler und Partien ohne Trophäe, gelaufene Runden ums Brett. **Fairness der Wegwahl:** Bots mit fester Wegwahl (`BotPolicy.routes`: an jeder Gabel der kürzeste bzw. längste Weg zurück zum Start) spielen gegeneinander, die Hälfte „immer kurz“, die Hälfte „immer lang“, mit getauschten Rollen gegen den Vorteil der Zugreihenfolge. Fair heißt: Siegquote „kurz“ nahe 50 %. Dazu die Wahl je Gabel und die gekauften Trophäen je Feld mit dem Experiment-Verhalten (75 % Richtung Trophäe).

**Testumgebung:** MacBook (Apple Silicon), Node, Vitest; `EXPERIMENTS=brett pnpm exec vitest run packages/game-core/src/rules/experimentsBoard.test.ts --silent=false` (≈ 4 s). Branch `claude/chaos-196-wackelwald-gross`.

**Ergebnisse (B4, alt zum Vergleich; 12 und 15 Runden liefert der Lauf zusätzlich):**

Rundenlänge alt: 32–36 Felder (4 Wegkombinationen); neu: 37–47 Felder (12 Wegkombinationen)

**EXP-037 Brettgröße (Standardregeln + Rotation, Seeds 1–200 je Zeile)**

| Brett | Runden | Sp. | Partie min | Felder/Sp. | Runden ums Brett | Trophäen | Trophäen Sieger | ohne Trophäe | Partie ohne Trophäe | Münzen entscheiden |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Wackelwald alt (43 Felder) | 5 | 2 | 5,8 | 20 | 0,58 | 3,04 | 1,95 | 11 % | 1 % | 39 % |
| Wackelwald alt (43 Felder) | 5 | 3 | 6,6 | 20 | 0,58 | 3,91 | 1,88 | 12 % | 1 % | 46 % |
| Wackelwald alt (43 Felder) | 5 | 4 | 7,3 | 19 | 0,57 | 4,18 | 1,71 | 20 % | 0 % | 54 % |
| Wackelwald alt (43 Felder) | 10 | 2 | 11,1 | 40 | 1,16 | 6,55 | 3,94 | 1 % | 0 % | 23 % |
| Wackelwald alt (43 Felder) | 10 | 3 | 12,6 | 39 | 1,16 | 8,16 | 3,64 | 1 % | 0 % | 34 % |
| Wackelwald alt (43 Felder) | 10 | 4 | 14,0 | 39 | 1,13 | 8,68 | 3,15 | 3 % | 0 % | 44 % |
| Wackelwald alt (43 Felder) | 20 | 2 | 21,5 | 78 | 2,29 | 14,98 | 8,39 | 0 % | 0 % | 21 % |
| Wackelwald alt (43 Felder) | 20 | 3 | 24,6 | 78 | 2,29 | 19,09 | 7,57 | 0 % | 0 % | 26 % |
| Wackelwald alt (43 Felder) | 20 | 4 | 27,5 | 77 | 2,26 | 21,31 | 6,73 | 0 % | 0 % | 31 % |
| Wackelwald neu (74 Felder) | 5 | 2 | 5,9 | 19 | 0,46 | 2,52 | 1,56 | 21 % | 12 % | 53 % |
| Wackelwald neu (74 Felder) | 5 | 3 | 6,7 | 20 | 0,47 | 3,38 | 1,66 | 20 % | 6 % | 45 % |
| Wackelwald neu (74 Felder) | 5 | 4 | 7,4 | 19 | 0,46 | 3,56 | 1,49 | 26 % | 2 % | 49 % |
| Wackelwald neu (74 Felder) | 10 | 2 | 11,1 | 39 | 0,93 | 7,19 | 4,06 | 1 % | 0 % | 32 % |
| Wackelwald neu (74 Felder) | 10 | 3 | 12,7 | 39 | 0,93 | 9,38 | 3,83 | 1 % | 0 % | 38 % |
| Wackelwald neu (74 Felder) | 10 | 4 | 14,2 | 38 | 0,91 | 10,06 | 3,40 | 0 % | 0 % | 43 % |
| Wackelwald neu (74 Felder) | 20 | 2 | 21,7 | 78 | 1,85 | 16,82 | 8,92 | 0 % | 0 % | 29 % |
| Wackelwald neu (74 Felder) | 20 | 3 | 24,9 | 78 | 1,86 | 21,32 | 7,87 | 0 % | 0 % | 41 % |
| Wackelwald neu (74 Felder) | 20 | 4 | 27,8 | 76 | 1,81 | 22,95 | 6,82 | 0 % | 0 % | 38 % |

**EXP-037 Wegwahl: immer kurz gegen immer lang (Rollen getauscht, Seeds 1–200 je Zeile × 2)**

| Brett | Runden | Sp. | Sieg kurz (fair ≈ 50 %) | Trophäen kurz / lang | Münzen kurz / lang |
| --- | --- | --- | --- | --- | --- |
| Wackelwald alt (43 Felder) | 5 | 2 | 45 % | 1,45 / 1,46 | 28,5 / 33,2 |
| Wackelwald alt (43 Felder) | 5 | 4 | 50 % | 1,06 / 0,97 | 20,7 / 25,7 |
| Wackelwald alt (43 Felder) | 10 | 2 | 69 % | 3,42 / 2,58 | 40,4 / 60,8 |
| Wackelwald alt (43 Felder) | 10 | 4 | 66 % | 2,28 / 1,72 | 30,2 / 43,9 |
| Wackelwald alt (43 Felder) | 20 | 2 | 75 % | 7,76 / 6,13 | 57,4 / 96,6 |
| Wackelwald alt (43 Felder) | 20 | 4 | 64 % | 5,30 / 4,53 | 39,3 / 60,6 |
| Wackelwald neu (74 Felder) | 5 | 2 | 41 % | 1,00 / 1,14 | 36,8 / 38,0 |
| Wackelwald neu (74 Felder) | 5 | 4 | 44 % | 0,71 / 0,75 | 26,3 / 29,4 |
| Wackelwald neu (74 Felder) | 10 | 2 | 49 % | 3,38 / 3,37 | 42,6 / 49,2 |
| Wackelwald neu (74 Felder) | 10 | 4 | 47 % | 2,27 / 2,21 | 30,7 / 37,6 |
| Wackelwald neu (74 Felder) | 20 | 2 | 51 % | 7,87 / 7,74 | 60,2 / 71,3 |
| Wackelwald neu (74 Felder) | 20 | 4 | 51 % | 5,28 / 5,20 | 40,8 / 52,5 |

**EXP-037 Wegwahl und Trophäenfelder (10 Runden, 2–4 Sp., Seeds 1–200 je Zeile)**

| Gabel / Feld | Anteil |
| --- | --- |
| Gabel s07 | Klippenweg 26 % · Sumpfabkürzung 74 % |
| Gabel s20 | Bachlauf 62 % · Lichtung 38 % |
| Gabel s25 | Uferweg 30 % · Baumkronenweg 70 % |
| Gabel s29 | Pilzpfad 23 % · Wackelbrücke 77 % |
| Trophäen gekauft je Feld | s05 7 % · s12 5 % · s16 9 % · s18 8 % · s49 6 % · s24 10 % · s57 3 % · s62 3 % · s67 8 % · s73 16 % · s33 4 % · s36 12 % · s42 9 % |

- Fairness je Entwurf (10 Runden, 2 / 4 Spieler, Siegquote „immer kurz“): A 69 / 66 %, B1 74 / 70 %, B2 30 / 35 %, B2 ohne s22 37 / 43 %, B3 47 / 47 % (20 Runden ebenfalls), B4 **49 / 47 %** (20 Runden 51 / 51 %). Schon das alte Brett bevorzugte kurze Wege: Die Trophäen-Kandidaten lagen dort, und auf der kürzeren Runde kommt man öfter an ihnen vorbei. Münzen allein gleichen das nicht aus, sie zählen erst bei gleich vielen Trophäen.
- Wahl je Gabel mit Experiment-Verhalten: Kurze Wege werden häufiger genommen (Sumpf 74 %, Brücke 77 %, Baumkronen 70 %), weil Bots Richtung Trophäe laufen und der kurze Weg meist näher dran ist. Die Lichtung nehmen 38 %. Gekaufte Trophäen verteilen sich auf alle 13 Kandidaten (3–16 %).
- Trophäen bei 10 Runden etwas mehr als auf dem alten Brett (7,2–10,1 statt 6,6–8,7 je Partie), kaum jemand ohne Trophäe (0–1 %). Nach 10 Runden ist man aber erst 0,93-mal ums Brett gelaufen, nach 12 Runden 1,1-mal.
- Kurze Partien (5 Runden) leiden: 20–26 % der Spieler und 2–12 % der Partien ohne Trophäe (alt 11–20 % bzw. 0–1 %; B3 31–39 % bzw. 6–14 %). Am stärksten zu zweit.
- Bild (Playwright, SwiftShader, Testmodus): Der Überblick zu Rundenbeginn ist 1,5-mal so weit weg wie die frühere Vollansicht, Felder und Wegweiser bleiben lesbar; nah an der Figur unverändert 17.

**Kulisse (`apps/host/src/board/wackelwaldScenery.ts`):** Bach zwischen Uferweg und Baumkronenweg (Wasserband, Ufersteine), Teich im Wald unten zwischen Start-Reihe, Sumpf und Lichtung, Lichtung mit Hexenring, Hängebrücken-Bretter am Baumkronenweg wie an der Wackelbrücke. Bäume stehen nicht mehr in einer festen Liste, sondern locker im Inneren (Raster mit Zufall, Seed 62), mit Abstand zu Feldern, Wegen, Teich, Bach und Lichtung und nie knapp vor einem Feld (die Kamera schaut von vorn). Inselrand, Randbäume, Blumen und Laternen wachsen mit dem Brett. Grashalme bleiben bei 64 000 (Apple-TV-Budget, EXP-020), stehen also dünner.

**Hosts:** PC-Host im Playwright-Lauf (alle 173 E2E-Tests grün im Playwright-Docker-Image, 14 Referenzbilder neu: Brett, Lobby mit „74 Felder“, Siegerbilder des Gesamtablaufs mit anderem Partieverlauf). Apple-Host: `pnpm build:apple-assets` grün (`check_usdz.py`, `check_realitykit.swift`: 74 von 74 Feld-Ankern), `brett.usdz` 32,5 statt 25,6 MB, Instanzen unverändert 64 338. tvOS-Simulator (Apple TV 4K, 3. Generation, eigenes Gerät), 4 Bots mit `--bunt`, 3 Runden: „Brett wackelwald geladen: 74 Felder … in 1946 ms“, drei Minispiel-Ergebnisse angenommen, Finale, keine `FEHLER`; Phase `board` im Simulator Median 56,6 fps (Simulator, kein Gerätewert). Die Minispiel-Kulisse des Apple-Hosts ist eine eigene Szene (`MinigameBackdrop.swift`) und bleibt unverändert. Mac-App (B4, Release-Build) mit 2 Bots, 2 Runden: „Brett wackelwald geladen: 74 Felder … in 1186 ms“, beide Minispiel-Ergebnisse angenommen, Finale, keine `FEHLER`. Swift-Harness `run.sh`: OK. E2E nach B4 erneut im Docker-Image: 173 grün, drei Siegerbilder des Gesamtablaufs neu.

Bilder: [`chaos196-ueberblick.jpg`](screenshots/chaos196-ueberblick.jpg) (PC, Überblick zu Rundenbeginn), [`chaos196-zonen.jpg`](screenshots/chaos196-zonen.jpg) (Lichtung, Baumkronenweg, Uferweg, Wackelbrücke aus der Nähe), [`chaos196-apple-tv-ueberblick.jpg`](screenshots/chaos196-apple-tv-ueberblick.jpg) (tvOS-Simulator). Die Bilder entstanden mit B3; B4 ändert nur den Typ von s18.

**Entscheidung:** **B4 behalten.** Empfohlene Rundenzahl im Brett-Register 12 statt 10 (`recommendedRounds`, nur Anzeige; der Server-Standard bleibt 10). Fünf-Runden-Partien bleiben möglich, haben aber öfter Spieler ohne Trophäe als auf dem alten Brett. **Offen für Ruben** (Abweichung vom Akzeptanzkriterium „erreichbare Trophäen in kurzen Partien“): akzeptieren, oder für den großen Wackelwald kürzere Partien als 8 Runden ausblenden bzw. mehr aktive Trophäen?

**Offen für Playtest:** Ist die Lichtung als Abkürzung erkennbar und reizvoll? Fühlt sich der Baumkronenweg riskant an? Reicht der Überblick zu Rundenbeginn, um sich auf dem großen Brett zurechtzufinden? Sind 10 Runden zu kurz? Gerätecheckliste §45.

## EXP-038: Münz-Regel für Spielformen mit Teams und Koop (2026-11-21, CHAOS-89)

**Hypothese / gewünschtes Spielerlebnis:** Team-Spiele (2 gegen 2, 1 gegen 3) und Koop bringen Abwechslung, ohne die Münz-Ökonomie zu verschieben. Ein Team-Sieg fühlt sich lohnend an, Verlierer gehen nicht leer aus, ein Einzelsieg gegen alle ist ein besonderer Moment. Koop belohnt gemeinsames Gelingen, die eigene Leistung zählt trotzdem.

**Varianten (Münzen je Person):**
- **A** Bezug: nur jeder gegen jeden (`minigameRewards` 10/5/3/0).
- **B** Startwert aus dem Konzept: Sieg 10, Niederlage 0, Unentschieden 3, Einzelsieg ×2, Koop 10/5/3/0 × Stufe/3. Erwartung: Teams blähen die Münzen auf (2 gegen 2: 20 statt 18), Koop drückt sie.
- **C** ausgeglichen: Sieg 7, Niederlage 2, Unentschieden 4, Einzelsieg ×2, Koop 8/6/4/2. Erwartung: je Spiel etwa 18 Münzen wie bei A.
- **D** wie C, Einzelsieg ×3.
- **E** wie C, Koop 12/9/6/3 (Stufe 2 ≈ jeder gegen jeden, Stufe 3 mehr).

Bei allen Varianten zahlt 1 gegen 1 (Ersatz zu zweit) wie jeder gegen jeden. Das ist ein Ergebnis der ersten Messung: Mit der Team-Regel bekam ein Duell 10 statt 15 Münzen, die Partie zu zweit lief deutlich ärmer.

**Objektive Messgrößen:** Münzen aus Minispielen je Minispiel, Münzen am Ende, gekaufte Trophäen je Partie, Siegquote der zur Halbzeit Führenden und Letzten (eindeutige Plätze), Anteil Personen ohne Trophäe.

**Testumgebung:** `simulateGame` mit `M4_RULES` (Standard ohne Trostpreis), Wackelwald in der Fassung vor CHAOS-196 (43 Felder), 10 Runden, Seeds 1–300 je Zeile, MacBook (Node 26). Rotation = fünf Spiele jeder gegen jeden plus drei Team-Spiele (Pump-Duell mit Zufalls-Teams, Pump-Solo „Letzter gegen alle“, Riesenballon Koop), also 3 von 8 Team-Spiele; im fertigen Katalog sind es eher 15 %. Bots: Punkte gleichverteilt, die Einzelperson gewinnt mit 45 %, Koop-Stufe aus den mittleren Punkten. Skript: `EXPERIMENTS=teams pnpm exec vitest run packages/game-core/src/rules/experimentsTeams.test.ts --silent=false` (`experimentsTeams.ts`).

**Ergebnisse:**

| Variante | Spieler | Münzen je Minispiel | Team-Anteil | Münzen am Ende | Trophäen/Partie | Halbzeit-Führende gewinnt | Halbzeit-Letzte gewinnt | ohne Trophäe |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A nur jeder gegen jeden (Bezug) | 2 | 15,1 | 0 % | 48,0 | 6,14 | 65 % | 35 % | 1 % |
| B Startwert: Sieg 10, Niederlage 0, allein ×2, Koop 10/5/3/0 | 2 | 14,2 | 38 % | 44,9 | 6,01 | 72 % | 28 % | 2 % |
| C ausgeglichen: Sieg 7, Niederlage 2, allein ×2, Koop 8/6/4/2 | 2 | 14,1 | 38 % | 44,6 | 6,00 | 72 % | 28 % | 2 % |
| D ausgeglichen, allein ×3 | 2 | 14,1 | 38 % | 44,6 | 6,00 | 72 % | 28 % | 2 % |
| E ausgeglichen, Koop 12/9/6/3 | 2 | 14,6 | 38 % | 46,4 | 6,07 | 73 % | 27 % | 2 % |
| A nur jeder gegen jeden (Bezug) | 3 | 18,3 | 0 % | 41,1 | 7,74 | 55 % | 15 % | 3 % |
| B Startwert: Sieg 10, Niederlage 0, allein ×2, Koop 10/5/3/0 | 3 | 17,6 | 37 % | 41,5 | 7,27 | 61 % | 16 % | 3 % |
| C ausgeglichen: Sieg 7, Niederlage 2, allein ×2, Koop 8/6/4/2 | 3 | 16,8 | 37 % | 38,7 | 7,28 | 56 % | 15 % | 3 % |
| D ausgeglichen, allein ×3 | 3 | 17,6 | 37 % | 40,9 | 7,38 | 56 % | 17 % | 3 % |
| E ausgeglichen, Koop 12/9/6/3 | 3 | 17,3 | 37 % | 40,1 | 7,35 | 56 % | 16 % | 3 % |
| A nur jeder gegen jeden (Bezug) | 4 | 18,5 | 0 % | 34,1 | 8,44 | 55 % | 9 % | 4 % |
| B Startwert: Sieg 10, Niederlage 0, allein ×2, Koop 10/5/3/0 | 4 | 18,3 | 38 % | 35,2 | 8,03 | 50 % | 12 % | 5 % |
| C ausgeglichen: Sieg 7, Niederlage 2, allein ×2, Koop 8/6/4/2 | 4 | 17,8 | 38 % | 33,3 | 8,13 | 47 % | 11 % | 4 % |
| D ausgeglichen, allein ×3 | 4 | 18,2 | 38 % | 34,1 | 8,21 | 47 % | 13 % | 4 % |
| E ausgeglichen, Koop 12/9/6/3 | 4 | 18,4 | 38 % | 34,2 | 8,30 | 46 % | 12 % | 4 % |

- Bei 3–4 Personen halten C, D und E die Münzmenge je Spiel auf dem Niveau von A (17,3–18,4 gegen 18,3–18,5). Der Startwert B liegt zu dritt ebenfalls nah, aber nur, weil Koop (≈ 1,5 Stufen) den Überschuss der Team-Siege auffrisst.
- Zu viert helfen Teams beim Aufholen: Die zur Halbzeit Führende gewinnt 46–50 % statt 55 %, die Letzte 11–13 % statt 9 %. Zufällige Teams und „Letzter gegen alle“ mischen die Reihenfolge.
- Zu zweit gibt es nur Duelle und Koop. Koop verteilt die Münzen gleichmäßiger als ein Duell, darum hält die Führende ihren Vorsprung etwas öfter (72–73 % statt 65 %). Bei 15 % Team-Spielen in der Rotation sinkt der Effekt auf etwa ein Drittel.
- Einzelsieg ×3 (D) ändert kaum etwas gegen ×2 (C), weil die Einzelperson nur in 1 gegen 3 bzw. 1 gegen 2 vorkommt.

**Entscheidung:** **E behalten** (`DEFAULT_TEAM_REWARDS`: Sieg 7, Niederlage 2, Unentschieden 4, Einzelsieg ×2, Koop 12/9/6/3 × Stufe/3; 1 gegen 1 wie jeder gegen jeden). Münzen wie bei A, zu viert der stärkste Aufholeffekt, und Koop lohnt sich bei gutem Gelingen. Minispiel-Siege zählen bei Teams für alle im Siegerteam, bei Koop für niemanden; den Trostpreis gibt es bei Teams nur, wenn eine Einzelperson verliert. Die Zahlen sind Bot-Simulation, kein Spieltest.

**Offen für Playtest (Ruben, Gerätecheckliste §46):** Fühlt sich ein Team-Sieg mit 7 Münzen lohnend an, oder wirkt er kleiner als Platz 1 mit 10? Ist „Letzter gegen alle“ spannend oder demütigend? Lohnt sich im Koop das Mitmachen, auch für die Person auf dem letzten Einzelplatz?
