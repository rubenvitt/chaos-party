# Minispiel-Ausbau: Rahmen für ~200 Minispiele

**Stand:** 2026-11-16 · **Zunder:** Epic `CHAOS-80`, Konzept `CHAOS-81`, Gate `CHAOS-82` · **Katalog:** [`katalog.md`](katalog.md)

Ruben möchte den Bestand von vier Minispielen in der Rotation (Sockenregen, Pudding-Gerangel, Wackelturm, Kuckucks-Klatsche) auf **rund 200** ausbauen. Dieses Dokument beschreibt, wie das gehen kann, ohne dass jedes Spiel ein Einzelstück wird. Es ist **Konzeptarbeit**: Umgesetzt wird erst, wenn Ruben den Rahmen freigibt (Gate `CHAOS-82`).

## 1. Einordnung

- **Umfang:** 200 Minispiele sind mehr, als die meisten kommerziellen Partyspiele mitbringen (typisch 80–110). Der Wunsch übersteigt den VISION-Rahmen des Vertical Slice („dozens of minigames“ war dort ausdrücklich draußen). Nach der M4-Freigabe ist das eine neue Ausbaustufe, die Ruben selbst angestoßen hat.
- **Aufwand heute:** Ein Minispiel im jetzigen Stil kostet rund 1 500–2 500 Zeilen (Modul 800–1 200, Logik 300–600, Tests 400–700) plus Bot-Experiment. Bei 200 Spielen wären das 300 000+ Zeilen. Das trägt nur, wenn **gemeinsame Bausteine** die Zeilen je Spiel auf etwa ein Viertel drücken (Ziel: ≤ 500 Zeilen Spielcode + ≤ 300 Zeilen Tests).
- **Engpass ist der Spaß, nicht der Code.** Bots messen Fairness, Tempo und Gleichstände, aber nicht, ob etwas lustig ist. Bei 200 Spielen kann Ruben nicht jedes einzeln abnehmen. Darum gibt es einen **Trichter** (Abschnitt 5) mit Bewertung nach jedem gespielten Minispiel.
- **Ausfallquote:** Aus Skizzen werden nicht alle Spiele. Erwartet sind 25–40 % Ausfall (zu ähnlich, nicht lustig, am iPad nicht bedienbar). Der Katalog ist deshalb ein **Vorrat**, der nachgefüllt wird (eigene Aufgabe „Konzept-Nachschub“).

## 2. Feste Rahmenbedingungen

Aus dem bestehenden Vertrag (`packages/minigame-sdk/src/info.ts`, ADR-012) und VISION:

- 2–4 Personen, Spiel läuft am PC, Eingabe nur über Controller: **Stick, A, B** (iPhone und iPad-Zone haben dasselbe Layout).
- Kurze Partien (Standard 25–40 s), Anleitung **≤ 3 Zeilen à 64 Zeichen**, Titel ≤ 24 Zeichen.
- Ergebnis sind Plätze mit Punkten; Gleichstand = gleicher Platz.
- Kategorien laut SDK: `arcade`, `physics`, `hybrid`.
- Natur-Look (ADR-014), cartoonig und frech, nicht düster (Art-Direction-Guide).
- **Eigenständig:** keine Nachbauten bekannter Minispiele aus anderen Spielen (Namen, Figuren, Optik, Level). Gängige Spielformen (Fangen, Ausweichen, Revier) sind erlaubt, der Kniff muss unser eigener sein.

## 3. Achsen für Vielfalt

Jede Skizze im Katalog ist auf vier Achsen eingeordnet. Die Rotation soll später über diese Achsen mischen, damit nicht dreimal hintereinander „mit dem Stick Dinge einsammeln“ kommt.

| Achse | Werte | Kürzel im Katalog |
|---|---|---|
| Kategorie (SDK) | Arcade, Physik, Hybrid | `Ar`, `Ph`, `Hy` |
| Bedienung | nur A · A+B · nur Stick · Stick+A · Stick+A+B | `A`, `AB`, `S`, `SA`, `SAB` |
| Spielform | Jeder gegen jeden · 1 gegen 3 · 2 gegen 2 · Gemeinsam gegen das Spiel · Mikro | `FFA`, `1v3`, `2v2`, `Koop`, `Mikro` |
| Familie | 20 Mechanik-Familien (Abschnitt 4) | Kapitel im Katalog |

**Bedienung am geteilten iPad:** `A` und `AB` sind dort am angenehmsten (EXP-005, EXP-016). Ziel für den Katalog: mindestens 30 % der Spiele ohne Stick (`CHAOS-93`).

## 4. Familien und Verteilung

| # | Familie | Nr. | Spielform | Neuer Baustein nötig |
|---|---|---|---|---|
| 1 | Fangen & Sammeln | 001–010 | FFA | Spawner mit Schattenwurf (aus Sockenregen herauslösen) |
| 2 | Ausweichen & Überleben | 011–020 | FFA | Gefahrenzonen mit Vorwarnung, Lebenspunkte |
| 3 | Rempeln & Runterschubsen | 021–030 | FFA | Physik-Arena mit Absturzkante (aus Pudding-Gerangel) |
| 4 | Timing & Rhythmus | 031–040 | FFA | Takt-Uhr mit Trefferfenstern |
| 5 | Reflex & Reaktion | 041–050 | FFA | Signal-Ablauf mit Finten (aus Kuckucks-Klatsche) |
| 6 | Pumpen, Kurbeln, Dosieren | 051–060 | FFA | Halte-/Kurbel-Eingabe (Stick-Kreis) |
| 7 | Zielen & Werfen | 061–070 | FFA | Zielkreuz, Wurfbahn |
| 8 | Balance & Stapeln | 071–080 | FFA | Neige-/Wackel-Modell (aus Wackelturm) |
| 9 | Rennen & Parcours | 081–090 | FFA | Strecke mit Fortschritt, Ziel-Reihenfolge |
| 10 | Gedächtnis & Muster | 091–100 | FFA | Zeige-/Abfrage-Phasen |
| 11 | Zocken & Push-your-luck | 101–110 | FFA | Sichern/Riskieren-Konto |
| 12 | Bluff & geheime Wahl | 111–120 | FFA | Geheime Auswahl am Controller, gleichzeitiges Aufdecken |
| 13 | Revier & Malen | 121–130 | FFA | Feld-Raster mit Besitz |
| 14 | Fahrzeuge & Schwung | 131–140 | FFA | Fahrzeug-Steuerung (Havok) |
| 15 | Schätzen & Wahrnehmung | 141–150 | FFA | Auswahl-Rad am Controller |
| 16 | Hektik-Küche & Laden | 151–160 | FFA | Bestellungen, Ablage-Stationen |
| 17 | Einer gegen alle | 161–170 | `1v3` | **Spielform Teams** (Vertrag, Wertung) |
| 18 | Zwei gegen zwei | 171–180 | `2v2` | **Spielform Teams** |
| 19 | Gemeinsam gegen das Chaos | 181–190 | `Koop` | **Spielform Koop mit Einzelwertung** |
| 20 | Mikro-Spiele | 191–200 | `Mikro` | **Schnellfeuer-Kette** (mehrere 5–8-s-Spiele am Stück) |

Verteilung der ersten 200 Skizzen (2026-11-16): Kategorie Arcade 84, Physik 40, Hybrid 76. Bedienung: nur A 28, A+B 25, nur Stick 39, Stick+A 104, Stick+A+B 4 – also 53 Spiele (26 %) ohne Stick.

**Nach Nachschub-Runde 1 (`CHAOS-93`, 2026-11-21):** 209 aktive volle Minispiele (ohne die 10 Mikro-Spiele, ohne 7 verworfene Dubletten), Physik 59 (28 %), ohne Stick 73 (35 %). Untergrenzen ≥ 200 aktiv, ≥ 30 % ohne Stick, ≥ 25 % Physik prüft `packages/minigames/src/sketchCatalog.test.ts`; Einzelheiten am Ende des Katalogs.

## 5. Die Minispiel-Fabrik

### 5.1 Bausteine im SDK

Heute baut jedes Minispiel Arena, Spawner, Zeitanzeige, Punkte-Schilder, Highlights und Bot-Profile selbst. Für 200 Spiele kommt ein **Baukasten** ins `minigame-sdk` (bzw. ein neues Paket `minigame-kit`):

- **Arena-Vorlagen** im Natur-Look: rund, rechteckig, Bahnen, Insel mit Kante, vier Eigenbereiche (für iPad-taugliche „jeder hat seine Zone“-Spiele).
- **Laufzeit-Helfer:** Countdown, Endphase („letzte 8 s“), Punktestand, Spawner mit Vorwarnung, Gefahrenzonen, Benommenheit, Sichern/Riskieren-Konto.
- **Figuren-Steuerung:** Laufen, Hechten, Rempeln, Greifen/Tragen als fertige Bausteine.
- **Bot-Profile** (Neuling, Normal, Profi, Störenfried) über eine gemeinsame Schnittstelle, damit jedes Spiel ohne Extra-Code in die Fairness-Messung kann.
- **Highlights** aus Ereignissen („Rot wurde dreimal geplättet“) per Vorlage.

**Umgesetzt (CHAOS-83, ADR-021):** Paket `packages/minigame-kit` (rein) und `@chaos-party/minigame-kit/babylon` (Optik). Sockenregen nutzt den Baukasten ohne Verhaltensänderung; das Muster-Minispiel „Hallo Baukasten“ (`packages/minigames/src/hallo-baukasten/`, nicht in der Rotation) zeigt die Aufteilung in 300 Zeilen. Die Steckbriefe aller Spiele stehen in `packages/minigames/src/steckbriefe.ts`, die Felder in ADR-020 §3.

### 5.2 Gemeinsame Prüfungen

Umgesetzt in `CHAOS-84`; Regeln, Tische, Schwellen mit Begründung und Ausnahmen in [`pruefungen.md`](pruefungen.md), Messwerte in [`pruefbericht.md`](pruefbericht.md).

- **Vertragstest für alle Spiele:** Ein Test läuft automatisch über `MINIGAME_INFOS` und prüft Textlängen, Dauer, Ende spätestens nach `durationMs`, Ergebnis mit allen Slots, 2/3/4 Spieler, Disconnect mitten im Spiel, Aufräumen der Szene.
- **Bot-Fairness je Spiel:** gleiche Kennzahlen wie EXP-005/EXP-016 (Gleichstand, Abstand Platz 1–2, Siegquote Neuling, Eindringling-Test gegen Dauerdrücken). Schwellen gelten für alle, Ausnahmen werden begründet.
- **Screenshot je Spiel** (Intro + Spielszene) für die visuelle Regression.

### 5.3 Definition of Done je Minispiel

1. `info.ts` mit Anleitung ≤ 3 Zeilen, Bedienung, Dauer, Kategorie, Familie, Spielform; Vielfalts-Steckbrief in `packages/minigames/src/steckbriefe.ts` (Felder: ADR-021 §3).
2. Logik rein und deterministisch (Seed), Unit-Tests für Wertung und Sonderfälle. Unterbau aus dem Baukasten (`@chaos-party/minigame-kit`), Bot über `MinigameBot`/`BotMatchAdapter` (Muster: `hallo-baukasten/`).
3. Besteht Vertragstest und Bot-Fairness-Schwellen.
4. Läuft am geteilten iPad (Zone) bedienbar, sonst als „nur iPhone“ markiert und von der Rotation bei iPad-Zonen ausgeschlossen.
5. Screenshot-Baseline, kurzer Eintrag im Katalog (Status, Zahlen).
6. Grafikstufe `niedrig` hält auf dem Ziel-PC mindestens die Bildrate der bestehenden Spiele.
7. Läuft auch im nativen Apple-Host (Mac, Apple TV) mit echter Grafik. Es gibt nur eine Variante des Spiels (Ruben, 2026-11-17, ADR-019 Nachtrag 2), kein Minispiel kommt nur auf einen Host. Seit CHAOS-144 überträgt der JS-Kern die Geometrie der Babylon-Meshes an RealityKit (ADR-019 Nachtrag 5). Eigener Swift-Code ist dafür im Regelfall nicht nötig. Bewegliche Objekte bleiben per `markVisual` mit einer Rolle gekennzeichnet; Swift nutzt die Rolle für Figuren (USDZ) und Effekte. Nachweis: eine Bot-Partie im tvOS-Simulator, in der das Minispiel sichtbar durchläuft, und `apps/apple-host/harness/run.sh full`. Klänge kommen über `ctx.fx.sound` von selbst mit (CHAOS-190).

### 5.4 Trichter (Status im Katalog)

`Skizze → Geschärft → Prototyp (Bot-Sim) → Spielbar → Rotation` oder `Verworfen`

- **Geschärft:** Regeln, Anleitungstext und Bot-Strategien stehen; offensichtliche Dubletten fliegen raus.
- **Prototyp:** reine Logik + Bot-Simulation ohne 3D. Billig, viele parallel. Was hier schlecht abschneidet, wird verworfen oder geändert.
- **Spielbar:** mit Szene im Baukasten, über die **Minispiel-Galerie** am Host einzeln startbar (Übungsmodus).
- **Rotation:** in echten Partien. Nach jedem Minispiel können alle am Controller **Daumen hoch / runter** geben. Die Stimmen werden lokal gesammelt; Spiele mit vielen Daumen runter fallen aus der Rotation und gehen zurück in den Trichter.

**Umgesetzt (CHAOS-87, 2026-11-20):** Die Galerie steht in der PC-Lobby („Minispiel-Galerie“): alle Spiele mit Status (`rotation`/`spielbar`, abgeleitet aus `ROTATION` im Katalog), Kategorie, Familie (sobald CHAOS-85 sie in den Steckbrief bringt), Spielzeit, Bedienung und Daumen. „Üben“ startet eine Übungsrunde (`start.practice`): nur dieses Spiel, keine Münzen, Siege oder Items, danach zurück in die Lobby. Daumen gibt es am iPhone in der Ergebnisanzeige jedes Minispiels (Partie und Übung, Controller-Nachricht `rate`); nichts wartet darauf. Der Server speichert die Stimmen in `~/.chaos-party/minispiel-stimmen.json` (`STIMMEN_DATEI`), der Export liegt unter `/ratings.json`. Rauswurf-Vorschlag ab **6 Stimmen mit ≥ 60 % Daumen runter** (`packages/minigames/src/gallery.ts`); er gilt nur für Spiele der Rotation, entscheiden tut Ruben. Offen: Daumen in iPad-Zonen und in der nativen Controller-App, Galerie am Apple-Host.

### 5.5 Gegen Gleichförmigkeit

Rubens Sorge beim Konzept-Gate (2026-11-16): Mit einem Baukasten könnten die Spiele „einem Muster folgen“. Die Fabrik ist nur dann freigegeben, wenn das nicht passiert. Darum gelten diese Regeln:

- **Baukasten = Unterbau, nie Spielidee.** Er liefert Zeit, Punkte, Bots, Laden, Highlights, Arenen und Figuren-Grundbewegung. Es gibt keine Spielvorlage mit Lücken zum Ausfüllen. Kernmechanik und Kniff schreibt jedes Spiel selbst.
- **Vielfalts-Steckbrief je Spiel** (Felder im Steckbrief): Kernverb (fangen, ausweichen, rempeln, zielen, stapeln, wählen …), Ziel (sammeln, überleben, zuerst, genau, Mehrheit …), Arena-Form, Kamera (Draufsicht, Seite, Verfolger, fest), Bedienung, Spielform, Tempo (ruhig, wechselnd, hektisch).
- **Mindestabstand:** Ein neues Spiel muss sich vom ähnlichsten bestehenden Spiel in **mindestens 3** Merkmalen unterscheiden. Der gemeinsame Vertragstest rechnet das aus und nennt das ähnlichste Spiel. Ausnahmen begründet der Katalog-Eintrag.
- **Eigener Kniff:** Der Kniff eines Spiels (Spalte im Katalog) kommt in keinem anderen Spiel vor.
- **Optik variiert bewusst:** Orte (Garten, Küche, Bad, Teich, Spielzimmer, Wald, Dachboden), Tageszeit, Kamera. Es soll nicht jedes Spiel eine runde Arena von oben sein.
- **Rotation:** nie zwei Spiele derselben Familie oder mit demselben Kernverb hintereinander.
- **Abbruchkriterium:** Bei der Zwischenabnahme (`CHAOS-92`) spielt Ruben die Pilot-Spiele hintereinander. Fühlen sie sich gleich an, wird die Fabrik geändert, bevor weitere Wellen starten.

## 6. Folgen für den Rest des Spiels

- **Rotation:** Bei 200 Spielen kommt in einer Partie (10–20 Runden) fast nie ein Spiel doppelt. Die Auswahl braucht: Ziehen ohne Wiederholung (auch über Partien hinweg), Mischen über die Achsen, Filter nach Spielerzahl und iPad-Zonen, Sperrliste/Favoriten. Umgesetzt in `CHAOS-85` (ADR-012 Nachtrag 6): Felder `family`, `minPlayers`/`maxPlayers`, `ipadZone`, `secretChoice` in `MinigameInfo`, Kernverb/Spielform/Bedienung aus dem Vielfalts-Steckbrief (ADR-021); Auswahl in `packages/game-core/src/rules/rotation.ts`; Sperrliste und Favoriten im Lobby-Dialog „Minispiele“ am PC.
- **Anleitungen:** Bei vielen neuen Spielen ist fast jedes Spiel neu für die Runde. Kurze, klare Anleitung und eine **Probephase** (5 s üben vor dem Start) werden wichtiger als die verkürzte Anleitung bei Wiederholung (CHAOS-66).
- **Assets:** Viele Spiele brauchen Requisiten (Toaster, Melone, Gießkanne). Weiter mit dem eigenen Blender-Skript-Generator (ADR-013) und CC0-Quellen; je Familie ein **Requisiten-Set**, keine Einzelanfertigung je Spiel. Umgesetzt in CHAOS-88: Art-Kit `packages/assets/blender/requisitkit.py`, Sets und Budget je Spiel in `packages/assets/src/props.ts`, Regeln in `docs/art-direction.md` („Requisiten der Minispiele“).
- **Ladezeit und Bundle:** 200 Spiele dürfen den Host nicht aufblähen. Minispiel-Module werden **erst bei Bedarf geladen** (dynamischer Import je Spiel). Umgesetzt mit CHAOS-86: neues Spiel zusätzlich in `packages/minigames/src/lazy.ts` eintragen (ADR-004 Nachtrag 2).

## 7. Entscheidungen (Konzept-Gate `CHAOS-82`, Ruben, 2026-11-16)

| # | Frage | Rubens Antwort | Folge |
|---|---|---|---|
| 1 | Fabrik-Ansatz | „ich habe angst, dass sie dann einem pattern folgen. aber wenn dem nicht so ist go for it“ | Freigegeben mit Auflage: Regeln gegen Gleichförmigkeit (§5.5), Prüfung bei der Zwischenabnahme |
| 2 | Neue Spielformen 1v3, 2v2, Koop | „ja neue formen“ | `CHAOS-89` freigegeben und umgesetzt (ADR-012 Nachtrag 8). Münz-Regel nach EXP-038: Sieg 7, Niederlage 2, Einzelsieg doppelt, Koop 12/9/6/3 × Stufe/3, 1 gegen 1 wie jeder gegen jeden; Testspiele Pump-Duell, Pump-Solo, Riesenballon |
| 3 | Mikro-Spiele / Schnellfeuer | „ja bestimmt(?) aber als neue Mechanik dann?“ | Ja, als **eigene Mechanik**: Schnellfeuer ist eine eigene Rundenart, kein normales Minispiel (siehe unten) |
| 4 | Geheime Wahl am geteilten iPad | „ja, aber da bringt das glaube ich wenig am ipad“ | Erlaubt. Die Rotation zieht diese Spiele bei iPad-Zonen deutlich seltener (`CHAOS-85`) |
| 5 | Reihenfolge Pilot → Zwischenabnahme → Familien | „ja“ | Wie §8 |

**Schnellfeuer als eigene Mechanik:** Fünf Mikro-Spiele am Stück ersetzen das normale Minispiel einer Runde. Gewertet wird über alle fünf, die Münzen folgen der normalen Platzierung. Der Auslöser wird per Experiment gewählt (`CHAOS-90`). Varianten: (a) ein neues Brett-Ereignis „Schnellfeuer!“, (b) feste Runde zur Halbzeit, (c) Finale in der letzten Runde. Vorschlag: (a), weil Brett-Ereignisse zum Kern des Spiels gehören und die Überraschung erhalten. Die Mikro-Spiele bilden einen eigenen Vorrat und zählen nicht als volle Minispiele. Das Ziel „~200“ meint volle Minispiele, die Mikro-Spiele kommen obendrauf.

## 8. Wellenplan (Vorschlag)

| Schritt | Inhalt | Zunder |
|---|---|---|
| 0 | Konzept (dieses Dokument + Katalog) | `CHAOS-81` |
| Gate | Konzept-Abnahme durch Ruben (§7) | `CHAOS-82` |
| 1 | Fundament: Baukasten, gemeinsame Prüfungen, Rotation für großen Katalog, Laden bei Bedarf, Galerie mit Daumen-Bewertung, Art-Kit | `CHAOS-83` … `CHAOS-88` |
| 1b | Neue Spielformen (Teams, Koop) und Schnellfeuer als eigene Rundenart (beides freigegeben) | `CHAOS-89`, `CHAOS-90` |
| 2 | Pilotwelle: MG-001, MG-011, MG-023, MG-033, MG-045, MG-101, MG-111, MG-121 (alle Bedienungen, acht Familien). Messen: Zeilen und Aufwand je Spiel, Ausfallquote, Bewertung | `CHAOS-91` |
| Gate | Zwischenabnahme durch Ruben: Fabrik bestätigt oder angepasst, Tempo der Wellen | `CHAOS-92` |
| 3 | Familien-Wellen 1–20 (Familien 17–20 erst nach `CHAOS-89`/`CHAOS-90`) | `CHAOS-94` … `CHAOS-113` |
| laufend | Konzept-Nachschub für verworfene Skizzen, damit am Ende ~200 spielbare Minispiele stehen | `CHAOS-93` |
