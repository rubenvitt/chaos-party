# Pilotwelle: Bericht für die Zwischenabnahme (CHAOS-91 → CHAOS-92)

**Stand:** 2026-11-22 · Zunder: `CHAOS-91` (Umsetzung), `CHAOS-92` (Zwischenabnahme durch Ruben) · Experiment: EXP-042 in [`../experiments.md`](../experiments.md)

Die Pilotwelle prüft die Minispiel-Fabrik ([`README.md`](README.md) §5), bevor weitere 190 Spiele folgen: acht Skizzen aus acht Familien, alle Bedienungen, auf dem Baukasten (`packages/minigame-kit`, ADR-021) mit den gemeinsamen Prüfungen (CHAOS-84).

## Ergebnis in einem Satz

**7 von 8 Spielen sind in der Rotation, Drei Türen ist spielbar (Galerie), aber nicht in der Rotation.** *(Nachtrag 2026-11-22, CHAOS-243: Drei Türen ist jetzt auch in der Rotation; der KI-Stärke-Test misst Spiele mit geheimer Wahl einer gegen drei, von Ruben angenommen, EXP-043.)* Die Spiele brauchen im Mittel **607 Zeilen** Spielcode statt 1 500–2 500 wie die Bestandsspiele. Das Ziel von ≤ 500 Zeilen verfehlen sie (Begründung und Baukasten-Folgeaufgabe unten).

## Die acht Spiele

| Nr | Spiel | Familie | Bedienung | Kern in einem Satz | Status |
| --- | --- | --- | --- | --- | --- |
| MG-001 | Nussregen-Netz | Fangen & Sammeln | SA | Seitenansicht unter einer Baumkrone: Nüsse mit dem Kescher in Laufrichtung fangen, A schwingt weit (danach 1 s lahm), faule Nüsse stinken. | Rotation |
| MG-011 | Rasensprenger-Rodeo | Ausweichen & Überleben | S | Drehende Wasserstrahlen, drei Herzen; nass rutscht man nach, dicht am Strahl gibt es mehr Punkte; zum Schluss drehen alle Sprenger. | Rotation |
| MG-023 | Eiswürfel-Sumo | Rempeln (Physik) | SA | Havok-Rempeln auf einem schmelzenden Eiswürfel; Rempler rutschen selbst zurück; in der Schlussphase bleibt drin, wer fällt. | Rotation |
| MG-033 | Toaster-Timing | Timing & Rhythmus | A | Eigener Toaster, Toast im richtigen Moment hochspringen lassen; jeder Toast röstet anders schnell. | Rotation |
| MG-045 | Schnapp den Käse | Reflex & Reaktion | A | Käsestapel wächst, die Falle schnappt zu einem versteckten Zeitpunkt; Zucken kündigt an, kann aber eine Finte sein. | Rotation |
| MG-101 | Bienenstock-Honig | Zocken | AB | A zapft in Serie (immer mehr), B sichert ins Glas; angekündigte Stiche nehmen den ungesicherten Topf. | Rotation |
| MG-111 | Drei Türen | Bluff & geheime Wahl | SA | Acht Runden: geheim eine Tür wählen; nur wer allein vor einer Tür steht, bekommt ihre Münzen. | **Spielbar**, nicht in der Rotation |
| MG-121 | Matschmaler | Revier & Malen | SA | Wiese in der eigenen Farbe (und dem eigenen Muster) färben, Bauchplatscher mit A, Regenstreifen wäscht Felder weg. | Rotation |

Regeln, Varianten und Zahlen je Spiel: EXP-042. Steckbriefe: `packages/minigames/src/steckbriefe.ts` (jedes Paar unterscheidet sich in ≥ 3 von 7 Merkmalen).

## Fairness (Bot-Partien, 200 Seeds je Tisch)

Volle Tabelle: [`pruefbericht.md`](pruefbericht.md). Alle sieben Rotationsspiele bestehen alle Schwellen ohne Ausnahme.

| Spiel | Gleichstand | Abstand 1–2 | Führungswechsel | Neuling | Profi | Stärkster Eindringling | KI schwer/leicht |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Toaster-Timing | 5 % | 10 % | 9,2 | 8 % | 75 % | 0,00 (Dauerdrücken) | 1,00 |
| Nussregen-Netz | 1 % | 21 % | 4,9 | 18 % | 57 % | 0,00 (immer weit schwingen) | 0,75 |
| Matschmaler | 10 % | 14 % | 17,0 | 20 % | 45 % | 0,83 (Dauerplatschen) | 0,74 |
| Rasensprenger-Rodeo | 2 % | 2 % | 3,6 | 8 % | 52 % | 1,06 (Dauerdrücken, A wirkungslos) | 1,00 |
| Schnapp den Käse | 6 % | 15 % | 5,9 | 11 % | 44 % | 0,76 (greift beim Zucken) | 0,84 |
| Eiswürfel-Sumo | 3 % | 23 % | 2,0 (2,1 nach CHAOS-241) | 7 % (8 %) | 30 % (28 %) | 0,88 (1,06) (Dauerrempler) | 0,85 |
| Bienenstock-Honig | 2 % | 13 % | 5,7 | 7 % | 51 % | 0,92 (nur zapfen) | 0,95 |
| Drei Türen | 2,5 % | 40 % | 1,1 | 21 % | 35 % | 1,15 (stur) | 0,71 (mittel/leicht 0,50) |

KI-Stärke: Siegquote zweier „schwer“ gegen zwei „leicht“ (40 Seeds, Toaster und Rodeo 16). Bot gegen Bot zeigt nur, dass Können zählt und kein Trick dominiert; Spaß zeigt erst Rubens Spieltest.

**Drei Türen** besteht die Fairness (knapp: Abstand 40 %, 1,1 Führungswechsel), verfehlt aber den KI-Stärke-Test „mittel schlägt leicht > 50 %“ (0,50 in der CI-Stichprobe). Ursache: In einem Spiel, in dem man allein stehen muss, denken zwei gleich starke Bots gleich und landen an derselben Tür; gerade die Aufstellung 2 schwer gegen 2 leicht trifft das. Drei Versuche am Bot-Modell (Schärfe, zweiter Denkschritt, Denk-Exponent) haben es nicht gelöst. Dazu fehlt am Controller eine private Rückmeldung, welche Tür man gewählt hat. Beides ist eine Folgeaufgabe (siehe unten); das Spiel liegt in der Galerie zum Ausprobieren.

## Aufwand und Baukasten

| Spiel | info | logic | bot | Szene | Summe | Tests |
| --- | --- | --- | --- | --- | --- | --- |
| Toaster-Timing | 25 | 163 | 90 | 243 | 521 | 102 |
| Nussregen-Netz | 25 | 216 | 124 | 290 | 655 | 112 |
| Matschmaler | 25 | 207 | 141 | 220 | 593 | 110 |
| Rasensprenger-Rodeo | 24 | 273 | 142 | 206 | 645 | 124 |
| Schnapp den Käse | 24 | 161 | 104 | 211 | 500 | 109 |
| Eiswürfel-Sumo | 26 | 167 | 90 | 342 | 625 (+ ≈ 55 Havok-Harness); nach CHAOS-241: 26 + 171 + 78 + 225 = **500** | 169 |
| Bienenstock-Honig | 25 | 186 | 98 | 309 | 618 | 94 |
| Drei Türen | 26 | 186 | 194 | 290 | 696 | 124 |
| **Mittel** | | | | | **607** | **118** |

Zum Vergleich die Bestandsspiele ohne Baukasten: Sockenregen ≈ 1 430, Krümel-Kehraus ≈ 1 880 Zeilen.

**Nachtrag 2026-11-22 (CHAOS-240):** Mit Ablauf-Rahmen `KitMinigame`, Requisiten-Teilen `buildProp`/`fallbackParts` und Bot-Anschluss `kitBotAdapter` liegen zwei Spiele unter dem Ziel, bei gleichem Verhalten: Toaster-Timing 443, Schnapp den Käse 447 Zeilen (nach den Katalog-Requisiten aus CHAOS-237, vorher 535 und 527). Bienenstock-Honig sinkt von 693 auf 559 (ADR-021 Nachtrag 3). Eiswürfel-Sumo liegt mit CHAOS-241 bei 500, die übrigen vier folgen mit den restlichen Bausteinen (CHAOS-245).

- **Tests ≤ 300:** erfüllt (Mittel 118).
- **Spielcode ≤ 500:** verfehlt (Mittel 607). Größter Posten ist die Szene (Mittel 264 Zeilen): Jedes Spiel schreibt denselben Rahmen (prepare/start/createBot/update/getHud/finish/dispose, ≈ 50–90 Zeilen) und baut seine Requisiten aus Grundkörpern, die Prettier je Mesh auf fünf Zeilen bricht. Havok-Spiele bauen Figuren-Physik und Harness jeweils neu (≈ 150 Zeilen). Folgeaufgabe: Baukasten-Rahmen und Requisiten-Helfer (unten).
- **Zeit je Spiel:** etwa 1,5 h (Spanne 0,75–2,5 h) von der Skizze bis „besteht alle Prüfungen, Bild angesehen“. Am längsten dauerte das Einstellen der Regeln, bis Können messbar zählt (Matschmaler, Drei Türen).
- **Was der Baukasten abnimmt:** Uhr mit Endphase, Punkte und Plätze, Spawner und Vorwarnung, Gefahrenzonen, Laufen/Hechten/Rempeln, RiskBank, Bot-Profile mit Stärke und Laufzeit-Treiber, Höhepunkte, Arena und Kamera je Ort, Figuren mit Abzeichen und Animation. Neu mit der Pilotwelle: `checks/kitHarness.ts` (Fairness-Prüfung aus dem Bot-Adapter ohne eigene Spielschleife).
- **Was fehlte** (gesammelt aus allen acht Spielen): gemeinsamer Minispiel-Rahmen, Mesh-/Requisiten-Helfer, Havok-Figur und Havok-Harness, Raster (Malen), drehende Gefahr, rutschiges Laufen und Hindernisse, Herzen-Zähler, Halten im Bot-Treiber, Baustein „geheime Wahl“, Ladeweg für die Requisiten-Modelle (CHAOS-237).

## Bekannte Grenzen

- **Bot-Wahrnehmung feiner als der Bildschirm** (README §5.6 „nur Beobachtbares“): Der Rasensprenger-Bot liest während der Vorwarnung den genauen Einschaltzeitpunkt (`sprayAt`), sichtbar ist nur die gleich lange Vorwarnung ohne Countdown; der Bienenstock-Bot liest den genauen Wutwert, sichtbar sind 0–3 kreisende Bienen; der Toaster-Bot liest Bräunung und Tempo aus der Farbe genauer als ein Mensch. Die Fairness-Zahlen sind dadurch eher optimistisch für Bots mit gutem Profil.
- **Requisiten:** Grundkörper im Look statt der Art-Kit-Modelle (CHAOS-237).
- **Drei Türen:** die private Rückmeldung der Wahl am Controller kam mit CHAOS-242 nach. Die KI-Stärke im Duell 2 gegen 2 bleibt strukturell niedrig (0,61); gemessen wird einer gegen drei (CHAOS-243, EXP-043).
- **Matschmaler:** 192 Feld-Körper mit Rolle; im Swift-Harness stieg `renderState` im Minispiel von max. 7,6 auf 11 ms. Bildrate auf dem Ziel-PC und der echten Apple TV ungeprüft (Gerätecheckliste §50).
- **Eiswürfel-Sumo:** im Leerlauf passen alle vier Figuren bis zum Ende aufs Eis (Gleichstand ohne Eingaben).

## Ausfallquote

1 von 8 (12,5 %): Drei Türen nicht in der Rotation. Keine Skizze wurde ganz verworfen. Der Katalog rechnet mit 25–40 % Ausfall; die Pilotwelle liegt darunter, weil jede Skizze beim Schärfen so lange umgebaut wurde, bis sie die Schwellen schaffte (verworfene Varianten in EXP-042).

## Was Ruben bei der Zwischenabnahme prüfen sollte

Abbruchkriterium der Fabrik (README §5.5): Fühlen sich die Spiele gleich an? Bitte die acht Spiele hintereinander in der Galerie spielen („Minispiele ›“ in der Lobby, „Üben“), gern auch eine Partie mit Rotation.

1. **Toaster-Timing und Schnapp den Käse** liegen am nächsten beieinander (Küche, Eigenbereiche, nur A, „drücken, während etwas wächst“). Unterschied: fester Garpunkt mit Tempo-Lesen gegen verstecktes Ende mit Finten. Eines umbauen?
2. **Tempo:** Eiswürfel-Sumo ist sehr hektisch (Bots fallen ≈ 3,7-mal in 30 s), Bienenstock-Honig hat ein enges Reaktionsfenster (Anflug ≈ 1 s, Sichern 0,5 s).
3. **Lesbarkeit:** Matschmaler unterscheidet Felder zusätzlich durch Muster (voll, Raute, Tupfen, Streifen); die Zuordnung Muster ↔ Spieler erklärt das Spiel nicht.
4. **Drei Türen:** Taugt die Wahl per Stickrichtung ohne Rückmeldung am iPhone? Ist das Spiel lustig genug, um die Arbeit an KI und Controller zu rechtfertigen?
5. **Optik:** Alle Requisiten sind Grundkörper im Look; die Modelle aus dem Art-Kit kommen mit CHAOS-237.
6. **Tempo der Wellen:** Eine Familien-Welle (≈ 10 Spiele) kostet nach diesen Zahlen 12–20 Agent-Stunden. Mit dem Baukasten-Rahmen (Folgeaufgabe) sollte das sinken.

## Nachweise

- Automatisch: Vertragstest, Vielfalt, Fairness, KI-Stärke, Darstellungs-Rollen, Apple-Darstellungs-Vertrag (`pnpm test`), Bild-E2E mit Linux-Baselines je Rotationsspiel (`tests/e2e/m3-minispiele-bild.spec.ts`), Apple-Host-Bot-Partien im Node-Bündel (`pnpm --filter @chaos-party/apple-host bots --full --matches 3`).
- Bilder: [`../screenshots/chaos91-pilotwelle-pc-tvos.jpg`](../screenshots/chaos91-pilotwelle-pc-tvos.jpg), je Spiel links der PC-Host (Babylon, Testmodus), rechts der tvOS-Simulator (RealityKit) aus einer Bot-Partie mit allen acht Spielen (`--minispiele=…`, vier Bot-Controller, alle Ergebnisse angenommen).
- Apple-Host: Swift-Harness `apps/apple-host/harness/run.sh full` spielt jetzt 16 Runden, damit alle zwölf Rotationsspiele drankommen (auch mit `hz=10`).
- Leistung (DoD 6, `pnpm perf`, SwiftShader, nur relativ): Die neuen Spiele liegen im Bereich der Bestandsspiele (Bildabstand im Median 87–125 ms gegen 98–131 ms, Draw Calls 164–262 gegen 208–292); die Baseline (`tests/perf/baseline.json`) enthält jetzt alle zwölf Rotationsspiele. Brett-Heap nach GC stieg in der längeren Perf-Partie (zwölf statt fünf Minispiel-Chunks) von 93 auf 128 MB. Bildrate auf dem Ziel-PC mit echter GPU: offen (Gerätecheckliste §50).
- Gerätecheckliste §50 für Rubens Spieltest.
- Nicht geprüft: Spaß mit Menschen, echte iPhones/iPads, Bildrate auf dem Ziel-PC und der echten Apple TV (Gerätecheckliste).

## Folgeaufgaben

- CHAOS-237: Requisiten laden (GLB im Browser, USDZ im Apple-Host).
- CHAOS-240: Baukasten-Rahmen und Helfer aus der Pilotwelle (Zeilenbudget).
- CHAOS-241: Havok-Figur und Havok-Harness im Baukasten (erledigt: `havokPawn`, `bonkPawns`, `HavokBlock`, eckige Insel, `checks/havokHarness.ts`; Eiswürfel-Sumo jetzt 500 Zeilen, ADR-021 Nachtrag 1).
- CHAOS-242: private Rückmeldung bei geheimer Wahl am Controller.
- CHAOS-243: Drei Türen in die Rotation (KI-Stärke für Anti-Koordinations-Spiele).
