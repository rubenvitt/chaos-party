# Gemeinsame Prüfungen für alle Minispiele

**Stand:** 2026-11-20 · **Zunder:** `CHAOS-84` (Epic `CHAOS-80`) · **Rahmen:** [`README.md`](README.md) §5.2, §5.3, §5.5 · **Messwerte:** [`pruefbericht.md`](pruefbericht.md)

Bei rund 200 Minispielen kann nicht jedes Spiel seine Rahmen-Tests selbst mitbringen. Vier gemeinsame Prüfungen sichern alle gleich ab, eine fünfte hält den Skizzen-Vorrat im Katalog groß und ausgewogen genug. Ein neues Spiel wird ohne eigenen Testcode mitgeprüft, sobald es im Katalog steht; für Fairness und Vielfalt braucht es je einen Eintrag (Bots, Steckbrief), sonst schlägt der Test fehl und sagt, was fehlt.

| Prüfung | Datei | Für | Läuft |
|---|---|---|---|
| Vertragstest | `packages/minigames/src/catalog.test.ts` | jedes Spiel in `MINIGAME_INFOS` | `pnpm test` (CI) |
| Bot-Fairness | `packages/minigames/src/checks/` (`fairness.ts`, `harnesses.ts`) | jedes Spiel in `ROTATION` | `pnpm test` (Stichprobe), Bericht mit `PRUEFBERICHT=1` |
| Vielfalt | `packages/minigames/src/checks/variety.ts` mit den Steckbriefen aus `packages/minigames/src/steckbriefe.ts` (Baukasten, ADR-021) | jedes Spiel in `ROTATION` | `pnpm test` (CI) |
| Screenshots | `tests/e2e/m3-minispiele-bild.spec.ts` | jedes Spiel in `ROTATION` | `pnpm test:e2e` (CI) |
| Katalog-Bestand | `packages/minigames/src/sketchCatalog.test.ts` | Skizzen in `docs/minigames/katalog.md` (≥ 200 aktiv, ≥ 30 % ohne Stick, ≥ 25 % Physik, `CHAOS-93`) | `pnpm test` (CI) |

## 1. Vertragstest

Schleife über alle Module, je Spiel:

- Steckbrief gültig (`checkInfo`): ID, Titel ≤ 24, Untertitel ≤ 64, 1–3 Anleitungszeilen ≤ 64, Bedien-Texte ≤ 16, Dauer 5–90 s, Punkte-Einheit.
- 2, 3 und 4 Spieler mit Zufalls-Bots: Ergebnis ohne Rückfallwertung (`forced: false`), Ende spätestens bei `durationMs` (+50 ms), `checkResult` gültig (alle Slots genau einmal, Plätze passen zu den Punkten, Höhepunkte in den Grenzen), Szene nach `dispose()` leer (Meshes, Materialien, Texturen, Beobachter, Physik-Körper).
- **Leerlauf** (CHAOS-84): niemand drückt etwas; das Spiel endet am Zeitlimit mit gültigem Ergebnis.
- **Dauerdrücken** (CHAOS-84): alle vier hämmern A und B im Wechsel, Stick voll in eine Richtung; gültiges Ergebnis, nichts bricht.
- **Verbindungsabbruch** mitten im Spiel (3 Spieler, Slot 2 weg und wieder da).

Laufzeit: alle sechs Module zusammen ≈ 3 s.

## 2. Bot-Fairness

### Tische

Jedes Spiel spielt dieselben Tische mit Seeds `1 … n`:

| Tisch | Besetzung | Kennzahl |
|---|---|---|
| Gleich stark | 4× Normal | Gleichstand auf Platz 1, relativer Abstand Platz 1–2, Führungswechsel je Partie |
| Neuling | 1 Neuling + 3× Normal, Platz reihum | Siegquote Neuling (geteilte Siege anteilig; fair 25 %) |
| Profi | 1 Profi + 3× Normal, Platz reihum | Siegquote Profi (fair 25 %) |
| Eindringling | 1 Strategie + 2× Normal (3 Sp.), Platz reihum, alle Können Normal | Siegfaktor = Quote × 3 (1,00 = fair), je Strategie; die erste ist immer **Dauerdrücken** |

Die Kennzahlen sind dieselben wie in EXP-005/007/016/023; neu ist nur, dass die Tische für alle Spiele gleich sind (bisher hatte jedes Experiment eigene Besetzungen, etwa Profi/Gut/Normal/Neuling in EXP-005).

### Schwellen und Begründung

Die Schwellen sollen die **angenommenen** Spiele (Sockenregen A4, Pudding-Gerangel A5, Wackelturm A6, Kuckucks-Klatsche K2, Krümel-Kehraus R3) von den **verworfenen** Konzepten trennen und dabei Abstand zum Rauschen halten (`FAIRNESS_THRESHOLDS` in `fairness.ts`).

| Kennzahl | Schwelle | Angenommen (200 Seeds, CHAOS-84) | Verworfen (Experimente) | Begründung |
|---|---|---|---|---|
| Gleichstand Platz 1 | ≤ 25 % | 7–21 % | B (EXP-005) bis 32 %, Krümel B (EXP-006) 28–31 % | Geteilte Siege sind ein schwaches Ende; jede vierte Partie ist die Grenze. |
| Abstand Platz 1–2 | ≤ 45 % | 8–19 % | B1 67–98 %, B2 32–62 %, C1 16–57 % | Einseitige Partien ohne Spannung. |
| Führungswechsel | ≥ 1,0 | 2,2–6,9 | B1/B2 0,0–0,3, C1 0,1–0,9 | Ohne Wechsel steht der Sieger früh fest. |
| Siege Neuling | 2–25 % | 6–8 % (Wackelturm 32 %, Ausnahme) | B1/B2/C1 0 % | Untergrenze: Neulinge gewinnen manchmal. Obergrenze fair: Können muss zählen (EXP-007: Außenseiter über fair = „Geschick zählt kaum“). |
| Siege Profi | ≥ 25 % | 34–72 % (Wackelturm 17 %, Ausnahme) | – | Gegenstück: Wer besser spielt, gewinnt mindestens den fairen Anteil. |
| Eindringling | ≤ 1,50 | höchstens 1,28 (Wackelturm „gierig“) | EXP-007 B2 „gierig“ 1,97–2,75, A4 Raufbold ≥ 1,04 gegen alle | Eine Strategie, die die normale Spielweise um die Hälfte übertrifft, ist dominant. Leichte Vorteile (1,1–1,3) sind gewollte Taktik. |

**Stichprobe und Rauschen:** In CI misst jedes Spiel nur eine Stichprobe (`ciSeeds`: 60 bei reiner Logik, 12 bzw. 8 bei Havok-Spielen), damit die Prüfung unter 10 s je Spiel bleibt. Quoten (Gleichstand, Siege, Eindringling) gelten deshalb erst als verletzt, wenn ihr ganzer 95-%-Vertrauensbereich (Wilson) jenseits der Schwelle liegt; Mittelwerte (Abstand, Führungswechsel) werden direkt verglichen. Bei den Havok-Spielen findet die Stichprobe nur grobe Verstöße; maßgeblich ist der Prüfbericht mit 200 Seeds je Tisch, der dieselbe Regel nutzt.

**Ausnahmen** stehen am Harness (`exceptions` mit Kennzahl, Wert und Begründung ≥ 40 Zeichen) und gehören in den Katalog-Eintrag des Spiels. Aktuell eine:

- **Wackelturm** – `maxNoviceWins` (32 %) und `minProWins` (17 %). EXP-007 maß für die gewählte Fassung A6 schon 31 % Außenseiter-Siege bei 4 Spielern, Ruben hat das Spiel in M3 abgenommen. Ob die Bots (Geschick = Tempo und Lenkung, kein besseres Gefühl für die Kippgrenze) oder das Spiel die Ursache sind, klärt `CHAOS-215`.

### Bots je Spiel

`harnesses.ts` verbindet die vorhandenen Experiment-Bots mit der Vorlage:

| Spiel | Bots | Können Profi / Normal / Neuling | Eindringlinge |
|---|---|---|---|
| Sockenregen | `SockenregenBot` (EXP-005) auf der echten Logik | Profile aus EXP-005 | Dauerdrücken (Hechtsprung, sobald bereit) |
| Kuckucks-Klatsche | `simulateKuckucksKlatsche` (EXP-016) | Profile aus EXP-005 | Dauerklatscher, Raffzahn, brav |
| Wackelturm | `playWackelturm` (EXP-007), normale Spielweise „zufällig“ | Geschick 0,9 / 0,6 / 0,2 | Raufbold (rempelt immer), gierig, vorsichtig |
| Pudding-Gerangel | `wackelBot` (EXP-006) auf dem echten Modul (Havok, headless) | `SKILLS` aus EXP-006 + Profi (plant alle 6 Schritte, Streuung 0,12) | Dauerrempler |
| Krümel-Kehraus | `simulateKruemel` R3 (EXP-023, Havok, headless) | wie Pudding-Gerangel | Dauerrempler, Torsteher, Raufbold |

Neue Spiele auf dem Baukasten (`CHAOS-83`) binden ihre Bots über dessen Bot-Profile an; sie brauchen dann nur einen kurzen Harness-Eintrag.

### Prüfbericht

```sh
PRUEFBERICHT=1 pnpm exec vitest run packages/minigames/src/checks --silent=false
```

misst alle Spiele der Rotation mit 200 Seeds je Tisch (`FAIRNESS_SEEDS` ändert das) und schreibt [`pruefbericht.md`](pruefbericht.md): Kennzahlen je Spiel, Ergebnis mit Ausnahmen, Eindringling je Strategie, Vielfalts-Steckbriefe. Dauer ≈ 4 min (Havok-Spiele 70–170 s). Mit `PRUEFBERICHT_NUR=<id>` nur ein Spiel, Ausgabe auf der Konsole – die Zeile gehört in den Katalog-Eintrag.

Die Bots sind Annahmen über Couch-Spieler, nicht gemessen. Die Prüfung findet unfaire oder früh entschiedene Spiele; ob ein Spiel Spaß macht, zeigen erst Menschen (Daumen-Bewertung, CHAOS-87).

## 3. Vielfalt (Auflage aus dem Konzept-Gate)

Jedes Spiel hat einen Vielfalts-Steckbrief aus dem Baukasten (`CHAOS-83`, ADR-021): Typ `Steckbrief` und Wertelisten in `packages/minigame-kit/src/steckbrief.ts`, Daten in `packages/minigames/src/steckbriefe.ts`. Sieben Merkmale zählen (`STECKBRIEF_MERKMALE`): Kernverb, Ziel, Arena, Kamera, Bedienung, Spielform, Tempo. Der Ort zählt nicht, weil Optik allein kein neues Spiel macht. Dass jedes Spiel einen Steckbrief hat und die Bedienung zu `info.controls` passt, prüft `steckbriefe.test.ts`.

**Regel** (`checks/variety.ts`): Ein Spiel muss sich von **jedem** anderen Spiel der Rotation in mindestens `MIN_DIFFERENCES` = 3 Merkmalen unterscheiden. Geprüft wird jedes Paar und nicht nur das ähnlichste Spiel; sonst könnte eine Ausnahme für ein Paar ein zweites, ebenso nahes Spiel verdecken. Bei einem Verstoß nennt der Test das zu ähnliche Spiel und die gleichen Merkmale. Ausnahmen stehen in `VARIETY_EXCEPTIONS` (Spiel, ähnliches Spiel, Begründung) und brauchen einen Satz im Katalog-Eintrag, warum sich die Spiele trotzdem verschieden anfühlen. Spiele außerhalb der Rotation (Pump-Parade, das Muster „Hallo Baukasten“) prüft die Regel nicht.

Heute liegt der kleinste Abstand bei 3, und zwar dreimal: zwischen Sockenregen, Pudding-Gerangel und Krümel-Kehraus. Alle fünf Spiele haben dasselbe Ziel („meiste“) und dieselbe Spielform (FFA), drei davon dieselbe Bedienung (SA). Neue Spiele sollten deshalb bei Ziel, Spielform oder Bedienung abweichen, sonst wird der Mindestabstand eng.

## 4. Screenshots

`m3-minispiele-bild.spec.ts` erzeugt je Spiel der Rotation zwei Baselines ohne Extra-Code:

- `minispiel-<id>-intro`: Anleitungskarte vor dem Start (lokaler Ablauf `flow=1`, Seed 7, vier Spieler). Vorher prüft `expectStableWrapping`, dass kein Anleitungstext an einer Umbruchkante steht.
- `minispiel-<id>`: Spielszene nach genau 2 s.

Neues Spiel: unter Linux `pnpm test:e2e m3-minispiele-bild --update-snapshots=missing`, die neuen PNGs ansehen, einchecken (siehe `docs/testing.md`, Screenshot-Baselines).

**Gefunden beim Einführen (CHAOS-84):** Die Anleitungszeile „Lauf unter die Schatten und fang die Socken. Gold zählt 3.“ (58 Zeichen) lag bei 30 px Schrift genau an der Umbruchkante der Karte; erlaubt sind 64 Zeichen. Die Anleitungsschrift ist jetzt 26 px (`.minigame-instructions li`), damit 64-Zeichen-Zeilen einzeilig bleiben.
