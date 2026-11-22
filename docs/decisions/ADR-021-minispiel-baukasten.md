# ADR-021: Minispiel-Baukasten als eigenes Paket `minigame-kit` (Unterbau, keine Spielvorlage)

**Status:** Angenommen
**Datum:** 2026-11-20
**Aufgabe:** CHAOS-83 (Epic CHAOS-80, Konzept-Gate CHAOS-82)
**Betroffene Annahmen:** `docs/minigames/README.md` §5.1 und §5.5

## Kontext

Für rund 200 Minispiele (CHAOS-80) baut heute jedes Spiel Uhr, Spawner, Punkte, Höhepunkte, Slot-Abzeichen, Materialien und Bots selbst. Die Module der fünf Spiele haben 800–1 200 Zeilen. Ziel der Fabrik: höchstens 500 Zeilen Spielcode und 300 Zeilen Tests je neuem Spiel (README §1).

Ruben hat die Fabrik am 2026-11-16 mit einer Auflage freigegeben (CHAOS-82): Die Spiele dürfen „keinem Muster folgen“. Der Baukasten darf darum nur **Unterbau** sein. Eine Spielvorlage mit Lücken zum Ausfüllen gibt es nicht (README §5.5). Arenen sollen verschiedene Orte und Kameras können, nicht nur runde Arenen von oben.

Der Vertrag in `minigame-sdk` (ADR-012) ist stabil und wird vom Server, von game-core und vom Controller gelesen. Er soll nicht mit Hilfscode wachsen.

## Entscheidung

**1. Neues Paket `packages/minigame-kit`** mit zwei Einstiegen. Das SDK bleibt der Vertrag. Der Baukasten hängt vom SDK ab, nie umgekehrt.

- `@chaos-party/minigame-kit` (rein, ohne Babylon, für Logik, Bots und Tests):

| Modul | Inhalt | Herausgelöst aus |
|---|---|---|
| `clock.ts` | `MatchClock` (Spielzeit, Endphase „letzte n s“, Ende mit Toleranz für feste Schritte), `Countdown`, `Cooldown` | Sockenregen |
| `scoreboard.ts` | `Scoreboard` (Punkte, Führung, Plätze über `rankByScore`, HUD-Zeilen), `uniqueMax`, `LeadTracker` | Sockenregen, Kuckucks-Klatsche, Prototypen |
| `spawner.ts` | `Spawner` mit Vorwarnung (Takt, schnellerer Takt in der Endphase, nichts, was erst nach dem Ende ankäme), `warningProgress` | Sockenregen |
| `hazards.ts` | `HazardField`: Zonen (Kreis, Rechteck, Ring) mit Phasen Warnung → scharf → vorbei | neu nach README §4 (Familie 2) |
| `status.ts` | `StatusTimers`, `StunTracker` (Benommenheit mit Schonfrist, Trefferzähler) | Sockenregen, Kuckucks-Klatsche |
| `bank.ts` | `RiskBank`: Sichern/Riskieren-Konto (Topf, sichern, platzen) | neu nach README §4 (Familie 11) |
| `movement.ts` | Laufen, Hechten, Benommenheit (`stepWalker`, `tryDash`, `stunWalker`), Rempeln (`resolveBumps`), Greifen/Tragen/Werfen (`grabNearest`, `carryAlong`, `letGo`), Physik-Lenkung für Havok (`steeringDeltaV`, `clampStick`, `clampHorizontalSpeed`) | Sockenregen, Pudding-Gerangel |
| `geometry.ts` | Grenzen (Kreis/Rechteck), Wurfparabel, Zufallspunkte, `nearestWithin` | Sockenregen |
| `arena.ts` | Grundrisse `rund`, `eckig`, `bahnen`, `insel` (mit Kante), `eigenbereiche` (vier Felder) mit Grenzen, Bahnen, Feldern, Startpunkten | neu |
| `bots.ts` | Bot-Profile Neuling, Normal, Gut, Profi, **Störenfried** (`mischief`); `BotSenses` (Reaktionszeit, Aufmerksamkeit), `noisyStick`; Schnittstelle `MinigameBot` + `BotMatchAdapter`; `runBotMatch` und `matchMetrics` (Kennzahlen wie EXP-005/EXP-016) | Arcade-Prototypen (EXP-005) |
| `highlights.ts` | `EventTally` und Vorlagen (`top`, `last`, `custom`) mit Textgrenzen | Sockenregen, Kuckucks-Klatsche, Wackelturm |
| `steckbrief.ts` | Vielfalts-Steckbrief (siehe Punkt 3), `differences`, `mostSimilar`, `bedienungOf` | neu (README §5.5) |

- `@chaos-party/minigame-kit/babylon` (Host und Tests mit NullEngine):

| Modul | Inhalt |
|---|---|
| `stage.ts` | `MinigameStage`: sammelt alles fürs Aufräumen, Materialien im Look (`ctx.look`, ADR-014) oder ohne Look, geteilt je Wunsch; Kulisse über `backdrop`, ohne Look Grundlicht; Bau-Helfer `node` (mit `markVisual`) und `add`; Requisiten aus dem Katalog mit `prop` (Nachtrag 1) |
| `arena.ts` | `buildArena`: Spielfläche zum Grundriss an einem **Ort** (`garten`, `kueche`, `bad`, `teich`, `spielzimmer`, `wald`, `dachboden`) mit eigener Farbwelt und Unterlage (Wiese/Decke) |
| `camera.ts` | Kamera-Vorlagen `draufsicht`, `schraeg`, `seite` (auch von links), `verfolger` (rückt weich zur Mitte der Figuren und zoomt mit ihrem Abstand), `fest` |
| `badges.ts` | Slot-Symbol (● ▲ ■ ★), Abzeichen, Ring in Slot-Farbe, Benommenheits-Sterne |
| `figures.ts` | `pickAnimation`, `AnimationSync`, `celebrate`, `SlotFigure` (Figur + Kennzeichen, `place`/`show`) |
| `pool.ts` | `NodePool`: im Aufbau vorwärmen, im Spiel nur ein- und ausblenden (ADR-012 Nachtrag 4) |

**2. Regeln gegen Gleichförmigkeit (README §5.5) im Baukasten selbst:**

- Es gibt **keine Basisklasse und keinen Spielablauf** im Baukasten. Jedes Spiel implementiert `Minigame` (ADR-012) selbst und entscheidet, welche Bausteine es nimmt. Kernverb, Ziel, Kniff, Requisiten und Ablauf schreibt das Spiel.
- Arena-Vorlagen sind nur die Spielfläche. Requisiten-Sets je Familie kommen mit CHAOS-88; was ein Spiel ausmacht, baut es selbst.
- Arenen gibt es in fünf Formen an sieben Orten, Kameras in fünf Vorlagen. Kein Spiel muss rund und von oben sein.
- Bots schreibt jedes Spiel selbst (was ein guter Zug ist, weiß nur das Spiel), aber gegen die gemeinsame Schnittstelle. So kommt jedes Spiel ohne Extra-Code in die Fairness-Messung (CHAOS-84).

**3. Felder des Vielfalts-Steckbriefs** (`Steckbrief`, je Spiel in `packages/minigames/src/steckbriefe.ts`):

| Feld | Werte |
|---|---|
| Kernverb | fangen, sammeln, ausweichen, rempeln, zielen, werfen, stapeln, balancieren, timen, reagieren, pumpen, rennen, merken, zocken, waehlen, malen, fahren, schaetzen, liefern, verstecken |
| Ziel | meiste, ueberleben, zuerst, genau, mehrheit, letzter |
| Arena-Form | rund, eckig, bahnen, insel, eigenbereiche, strecke, buehne, frei |
| Kamera | draufsicht, schraeg, seite, verfolger, fest |
| Bedienung | A, AB, S, SA, SAB (muss zu `info.controls` passen, Test) |
| Spielform | FFA, 1v3, 2v2, Koop, Mikro |
| Tempo | ruhig, wechselnd, hektisch |
| Ort (zählt nicht zum Abstand) | garten, kueche, bad, teich, spielzimmer, wald, dachboden |

Der Mindestabstand ist `MIN_DIFFERENCES = 3` Merkmale zum ähnlichsten Spiel (README §5.5). `mostSimilar` nennt das ähnlichste Spiel. Durchgesetzt wird der Abstand im gemeinsamen Vertragstest (CHAOS-84). Der Ort zählt nicht, weil eine andere Farbwelt allein kein neues Spiel macht.

**4. Beweis am Bestand, ohne Verhaltensänderung.** Sockenregen nutzt den Baukasten für Uhr, Wurf-Takt, Bewegung, Benommenheit, Führung, Höhepunkte, Bühne, Abzeichen, Ring, Sterne, Animationen und Bot-Partie. Weitere Dubletten sind entfernt: das Slot-Symbol in Kuckucks-Klatsche und Krümel-Kehraus, `uniqueMax`/Kürzen in Kuckucks-Klatsche und Wackelturm, die Lenkung in Pudding-Gerangel (auch für Krümel-Kehraus). Die Prototypen von EXP-005 beziehen Profile und Kennzahlen aus dem Baukasten. Nachweis „keine Verhaltensänderung“ (2026-11-20, einmalige Vergleichsläufe, nicht eingecheckt):

- Logik und Bots von Sockenregen: Prüfsumme über 45 Bot-Partien (2–4 Spieler, Seeds 1–15), jeden Schritt aller Läufer und die Höhepunkte, vorher und nachher gleich.
- Szenengraph (Name, Eltern, Lage, Größe, Material, Farbe, Kennzeichnung je Mesh und Knoten zu drei Zeitpunkten), Effekt-Protokoll und Ergebnis von Sockenregen, Kuckucks-Klatsche, Krümel-Kehraus, Pudding-Gerangel und Wackelturm mit 2 und 4 Spielern: vorher und nachher gleich.
- Alle bisherigen Tests und die Screenshot-Baselines bleiben grün.

**5. Muster-Minispiel „Hallo Baukasten“** (`packages/minigames/src/hallo-baukasten/`, nicht in der Rotation): Glühwürmchen landen angekündigt am Teich; wer im Lichtkreis steht, fängt sie. Steckbrief, Logik und Ansicht haben zusammen 300 Zeilen (ein Test hält die Grenze), der Bot 71 Zeilen. Es zeigt die Aufteilung `info.ts` / `logic.ts` (rein) / `bot.ts` / `index.ts` (Ansicht) und läuft automatisch durch die Katalog-Prüfungen (CHAOS-34). Es ist ein Lesebeispiel, keine Vorlage zum Kopieren der Spielidee.

**6. Zusammenspiel mit den KI-Spielern (ADR-020).** ADR-020 verlangt für jedes Minispiel der Rotation einen Bot, den der Host für KI-Plätze nutzt; den Vertrag dafür legt CHAOS-180 fest. Die Bausteine hier sind dafür die Grundlage: `BotProfile` mit Reaktionszeit, Zielrauschen, Aufmerksamkeit und Fehlerrate entspricht den Stellgrößen der Stärke aus ADR-020, `BotSenses` lässt einen Bot nur sehen, was ein Mensch sehen kann (angekündigt, mit Reaktionszeit). Die Stärke 0–1 aus ADR-020 auf ein Profil abzubilden (zwischen Neuling und Profi interpolieren) und die Beobachtung statt der ganzen Logik zu übergeben, gehört zu CHAOS-180, nicht hierher.

## Betrachtete Alternativen

| Alternative | Warum nicht |
|---|---|
| Bausteine in `minigame-sdk` | Das SDK ist der Vertrag, den auch Server und Controller lesen. Hilfscode würde ihn aufblähen und bei jeder Änderung den Vertrag berühren. |
| Basisklasse `BaseMinigame` mit Hooks (`onSpawn`, `onScore`, …) | Genau die „Spielvorlage mit Lücken“, die Ruben mit „keinem Muster folgen“ ausgeschlossen hat (README §5.5). Spiele würden sich im Ablauf gleichen. |
| Deklarative Spielbeschreibung (JSON/DSL) | Für 20 sehr verschiedene Familien zu eng; Kniffe ließen sich nur über Ausnahmen ausdrücken. |
| Arena-Vorlagen mit fertigen Requisiten | Würden Optik vereinheitlichen; Requisiten-Sets kommen je Familie aus dem Art-Kit (CHAOS-88). |
| Bestehende Spiele nicht anfassen | Ohne Umstellung wäre nicht belegt, dass die Bausteine tragen. Mit Prüfsummen lässt sich das ohne Risiko nachweisen. |

## Konsequenzen

**Positiv**

- Ein neues Spiel schreibt nur noch seine Regeln, seine Ansicht und seinen Bot. Das Muster kommt mit 300 Zeilen aus. Sockenregen ist nach der Umstellung 190 Zeilen kürzer (Modul, Logik und Höhepunkte 1 488 → 1 298), obwohl es seine Optik behält.
- Jedes Spiel kann über `runBotMatch` in die Fairness-Messung, mit dem Störenfried als Eindringling-Test.
- Gleiche Dinge sehen überall gleich aus (Slot-Abzeichen, Sterne) und räumen sich gleich auf.
- Der Steckbrief macht Vielfalt messbar, bevor ein Spiel gebaut wird.

**Negativ / Risiken**

- Ein zweites Paket, das gepflegt werden will. Änderungen an geteilten Bausteinen wirken auf viele Spiele. Darum sind die Bausteine klein, rein getestet (60 Tests) und ohne Spielablauf.
- Arena-Vorlagen und Orte sind bisher nur Farbwelten mit Grundkörpern. Ob sie am Fernseher unterscheidbar genug wirken, zeigt erst die Pilotwelle (CHAOS-91) und die Zwischenabnahme (CHAOS-92).
- Pudding-Gerangel, Wackelturm, Kuckucks-Klatsche und Krümel-Kehraus nutzen erst einzelne Bausteine. Weiter umgestellt wird nur, wenn ein Spiel ohnehin angefasst wird.

## Nachtrag 1 (2026-11-22, CHAOS-241): Havok-Figur und Havok-Harness

Die Pilotwelle (CHAOS-91) zeigte, dass jedes Physik-Spiel dieselbe Figuren-Physik und denselben headless Fairness-Harness neu schreibt (Eiswürfel-Sumo ≈ 105 + 55 Zeilen). 28 % des Katalogs sind Physik-Skizzen. Darum kommen in den Baukasten:

- **`havokPawn(stage, player, opts)` → `HavokPawn`** (`minigame-kit/babylon/pawn.ts`): aufrechte Kapsel (Trägheit 0, Füße am Knotenursprung), `input` (Stick, Blick, A vormerken), `steer(now, dt)` (Antritt setzt das Tempo in Blickrichtung, Abklingzeit, Lenkpause, sonst Lenk-Impuls aus `steeringDeltaV`), `park`/`recall`/`teleport` mit `settle()` am Anfang jedes `update` (`disablePreStep`), `view(now)` als `PawnBotView` für Bots und `show(...)` für Figur und Animation. Wann gelenkt wird (auf dem Boden, auf dem Eis), entscheidet das Spiel.
- **`bonkPawns(pawns, now)`** löst Rempler auf (Treffer im Vorwärtskegel in Reichweite, Stoß für das Opfer, Rückstoß und Lenkpausen) und meldet sie; Punkte, Gutschrift und Geräusch macht das Spiel (`bonkFx` für die übliche Wirkung).
- **`HavokBlock`**: statischer Körper mit tauschbarer Box (schmelzende Scholle, schrumpfende Insel).
- **Eckige Insel**: `arenaLayout({ form: 'insel', halfX, halfZ })` mit Kante ringsum (`offEdge` über die Ecke), `buildArena` baut Block und Deckel.
- **`havokHarness`** (`packages/minigames/src/checks/havokHarness.ts`), Gegenstück zu `kitHarness`: echtes Modul headless, Instanz über `create`, sichtbare Lage über `view`, Entscheid je Platz und Strategie über `decide`, getaktet wie `pawnBotDriver` (auch der erste Plan sofort), Können `PAWN_BOT_SKILLS`, Führungswechsel über `LeadCounter`.

Umgestellt: Eiswürfel-Sumo (Spielcode 625 → 500 Zeilen; Physik und KI-Partien bit-gleich, der Harness plant jetzt wie der Laufzeit-Bot gleich im ersten Schritt, Zahlen bei 200 Seeds weiter in allen Schwellen) und der Fairness-Harness von Pudding-Gerangel (bit-gleiche Zahlen). Pudding-Gerangel und Krümel-Kehraus behalten ihre eigene Figuren-Physik: Pudding rempelt additiv ohne Vorwärtskegel und mit Führungs-Zuschlag auf einem kippenden Pudding, Krümel misst seine Fairness über die Simulation aus EXP-023. Eine Umstellung würde Verhalten und Baselines ändern, ohne dass die Spiele ohnehin angefasst werden (Regel aus „Negativ / Risiken“).

## Überprüfung

Neu bewerten bei der Zwischenabnahme nach der Pilotwelle (CHAOS-92): Liegen die Pilot-Spiele bei höchstens 500 Zeilen Spielcode? Fühlen sie sich verschieden an? Wenn Spiele den Baukasten umgehen müssen, um ihren Kniff zu bauen, ist ein Baustein zu eng geschnitten.

## Nachtrag 1 (2026-11-22, CHAOS-237): Requisiten laden mit `stage.prop`

Die Requisiten-Sets aus CHAOS-88 kommen jetzt ins Spiel. Vertrag im SDK: `MinigameContext.props` (`PropFactory`, optional wie `look`) liefert synchron ein `PropHandle` (Wurzel, `tint`, `dispose`) oder `null`. Der Browser-Host lädt vor `prepare` die Sets des Spiels (`apps/host/src/minigame/props.ts`, Schlüssel in `MINIGAME_PROP_SETS` ist jetzt die Minispiel-ID statt der Katalog-Nummer, weil die Laufzeit nur die ID kennt).

```ts
const toaster = stage.prop('toaster', {
  role: 'toaster', key: player.slot, akzent: player.color,
  fallback: (root) => { /* Grundkörper in Modell-Maßen unter root */ return { akzent: [body] }; },
});
toaster.root.position.set(x, 0, z);
toaster.root.scaling.setAll(1.75);
toast.tint('zustand', breadColor(browning), { finish: 'matt' });
```

- **Rückfall Pflicht:** Ohne Modell (Unit-Tests mit NullEngine, headless Apple-Host, Laden gescheitert, Requisit nicht im Set) baut `fallback(root)` Grundkörper in den Maßen des Modells. So bleiben Tests, Bot-Fairness und Darstellungs-Vertrag ohne GLB-Dateien lauffähig, und der Apple-Host hat etwas zu zeigen, falls ein USDZ fehlt.
- **Statisch:** Requisiten haben keine beweglichen Teile. Was sich im Spiel bewegt (Mausefallen-Bügel, Sprenger-Arm), bleibt ein eigener Knoten mit Rolle, oder das ganze Requisit bewegt sich.
- **Farbe:** `tint('akzent' | 'zustand', hex)` färbt Modell und Grundkörper gleich und hält die Farbe in der Requisit-Kennung fest (`markProp`), die der Apple-Host liest (ADR-019 Nachtrag 8). Gleiche Farbe zweimal kostet nichts (Spiele färben je Bild).
- **Neue Spiele:** Sets in `MINIGAME_PROP_SETS` eintragen, dann `stage.prop`. `check:assets` rechnet das Budget je Spiel, `apps/apple-host/test/stage.test.ts` prüft, dass ein Spiel nur Requisiten seiner Sets nennt.
