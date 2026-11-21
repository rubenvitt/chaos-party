# ADR-020: KI-Spieler – jeder Platz ist Mensch oder KI, Brett-KI im Server, Minispiel-KI im Host

**Status:** Angenommen (Ruben, 2026-11-19, Entscheidungen 1–5 im Chat, siehe CHAOS-178 `## Notizen`). Die übrigen Punkte sind Umsetzungsentscheidungen von Claude im Rahmen dieser Vorgaben.
**Datum:** 2026-11-20
**Aufgabe:** CHAOS-178 (Epic CHAOS-177); Folgeaufgaben CHAOS-179 … CHAOS-187
**Betroffene Annahmen:** `VISION.md` (Spieler), ADR-005 (Session-Server), ADR-008 (iPad-Zonen), ADR-009 (Reconnect), ADR-011 (Brettregeln im Server, Seeds), ADR-012 (Minispiel-Logik im Host), ADR-015 (Lobby, Revanche), ADR-019 (Apple-Host mit TS-Kern)

## Kontext

Bisher spielen nur Menschen, jeder Platz hängt an einem Controller (iPhone oder iPad-Zone). Bots gibt es nur für Messungen:

- **Brett:** `BotPolicy` in `packages/game-core/src/rules/simulate.ts` beantwortet alle Prompts (Würfeln, Item, Weg, Trophäe, Klau-Ziel, Reaktion) ohne echte Zeit. Zeitmodelle gibt es schon (`DelayModel`, log-normal wie menschliche Reaktionen; EXP-004: Median 1,1 / 1,5 / 2,3 s für fokussiert / typisch / abgelenkt). Ein einziger Bot-Strom `createRng(seed ^ 0x5bd1e995)` für alle Plätze.
- **Minispiele:** Bot-Eingaben nur im Headless-Harness und in Prototypen (`packages/minigames/src/prototypes/**`, z. B. `sockenregenBot.ts`, `kruemelKehrausBot.ts`). Kein Vertrag.

Zwei Eigenheiten der Architektur bestimmen, wo eine KI laufen kann:

1. **Brettregeln laufen im Server** (ADR-011). Der Server schickt jedem Controller einen Kontext mit offenen Prompts und nimmt `choose` entgegen. Am Apple-Host läuft derselbe TS-Server in JavaScriptCore (ADR-019).
2. **Minispiel-Logik läuft im Host** (ADR-012 §1), am PC im Browser, am Apple-Host headless in JavaScriptCore. Der Server leitet Controller-Eingaben nur als `input` an den Host weiter und kennt den Minispiel-Zustand nicht. Eine KI, die ein Minispiel spielt, braucht aber diesen Zustand.

### Rubens Entscheidungen (2026-11-19, Chat)

| # | Frage | Antwort | Folge |
|---|---|---|---|
| 1 | Solo oder nur Auffüllen? | „1 allein gegen KI ist ok. jeder Slot entweder Mensch oder KI“ | Solo erlaubt. Jeder der 4 Plätze ist Mensch oder KI, mindestens ein Mensch. |
| 2 | Wer verwaltet KI-Plätze? | „der erste Controller oder am Host“ | Host (Tastatur, Siri Remote) und der erste Controller. |
| 3 | Stärken | „beides. Stufen + dynamisch“ | Feste Stufen und eine dynamische Stärke. |
| 4 | Persönlichkeit | „auch Persönlichkeit, aber zufällig vergeben“ | Spielstile je KI-Platz per Seed, nicht wählbar. |
| 5 | Mensch übernimmt KI-Platz mitten in der Partie? | „ne“ | Kein Übernehmen während einer Partie. |

## Entscheidung

### 1. Plätze und Rolle

- Eine Partie hat **2–4 Plätze**, jeder ist `human` oder `ai`. **Mindestens ein Mensch.** Solo heißt 1 Mensch + 1–3 KI.
- Die Lobby bietet „Start“ erst ab zwei Plätzen an. Mit einem Menschen genügt also eine KI.
- Es bleibt ein **lokales** Spiel an einem Bildschirm. KI ersetzt keine Online-Mitspieler; die Nicht-Ziele in `VISION.md` gelten weiter.
- **In der Lobby** (vor dem Start, auch vor „Nochmal spielen“) darf ein Mensch einen KI-Platz einnehmen. Tritt jemand bei und ist kein Platz frei, verdrängt er den KI-Platz mit der höchsten Nummer. Sonst müsste erst jemand die KI von Hand entfernen. Das ist keine Übernahme im Sinne von Entscheidung 5, weil noch keine Partie läuft.
- **Während einer Partie** wechselt ein Platz nie die Art. Wer später kommt, spielt ab der nächsten Partie mit.

### 2. Verwaltung

- **Am Host:** KI hinzufügen, Stärke wählen, KI entfernen. Am PC per Tastatur und Maus, an der Apple TV per Siri Remote.
- **Am Controller:** dasselbe darf nur die **Spielleitung**. Das ist der verbundene Mensch mit der niedrigsten Platznummer. Trennt er sich, geht die Rolle an den nächsten. Am geteilten iPad gilt die Zone mit dieser Nummer.
- Protokoll: neue Controller-Absicht für KI-Plätze (Name und Form legt CHAOS-179 fest). Der Server prüft die Spielleitung und die Phase (nur Lobby). Verwaltet der Host, läuft das über `configure` oder eine eigene Host-Nachricht.

### 3. Wo die KI läuft

**Brett-KI im Server, als virtueller Controller.** Ein KI-Sitz liest denselben Kontext wie ein Controller (`contextFor(slot)`: offene Prompts und Optionen). Er antwortet über denselben Weg wie `choose`, mit derselben Prüfung durch game-core. Ungültige oder verspätete Antworten werden abgewiesen wie bei Menschen. Am Apple-Host läuft der Server-Code in JavaScriptCore, also gilt **eine Umsetzung für PC, Mac und Apple TV**. Die Entscheidungslogik kommt aus `simulate.ts` in ein gemeinsames Modul (`game-core/src/ai/`, CHAOS-181). Die Simulation nutzt danach dasselbe Modul.

**Minispiel-KI im Host, neben der Minispiel-Laufzeit.** Der Server kennt den Minispiel-Zustand nicht (ADR-012). Deshalb erzeugt der Host die Eingaben der KI-Plätze selbst. Sie gehen durch denselben Eingang wie Netz-Eingaben: `runner.handleInput` mit Achsenbegrenzung, Filter für doppelte Knopfdrücke, nur laufend, nur für Teilnehmer. Babylon-Host und Apple-Host nutzen dieselbe TS-Laufzeit (`createMinigameRunner`), also auch hier nur eine Umsetzung. Welche Plätze KI sind (mit Stärke und Persönlichkeit), erfährt der Host aus dem Brett-Stand.

**Vertrag für Minispiel-Bots** (Details in CHAOS-180):

- Jedes Minispiel-Modul liefert einen Bot-Erzeuger (Arbeitsname `createBot(slot, stärke, persönlichkeit, rng)`). Der Bot gibt je Takt Eingaben aus einer **Beobachtung**, die das Minispiel bereitstellt.
- Die Beobachtung enthält nur, was ein Mensch am Bildschirm sehen kann: keine künftigen Zufallswerte, keine versteckten Zeitpunkte. Bei Kuckucks-Klatsche reagiert der Bot also auf den sichtbaren Kuckuck, mit Reaktionszeit.
- Eingaben höchstens so oft wie ein Controller (`move` ≈ 30 Hz, wie `moveSender`).
- Ein Minispiel ohne Bot darf nicht in die Rotation (Vertragstest in `catalog.test.ts`, Pflicht in `docs/minigames/README.md`).

**Abgelehnt: KI auf einem eigenen Gerät oder als Netz-Client.** Ein Prozess, der sich wie ein Controller per WebSocket verbindet, bräuchte für Minispiele trotzdem den Zustand aus dem Host. Er hätte Netz-Verzögerung, Reconnect und Herzschlag ohne Nutzen.

### 4. Stärke

- In der Lobby gibt es je KI-Platz **eine Wahl mit vier Werten: leicht, mittel, schwer, dynamisch.** Standard ist **mittel**. Die Wahl bleibt über „Nochmal spielen“ erhalten.
- Intern ist die Stärke eine Zahl `s` von 0 bis 1: leicht = 0, mittel = 0,5, schwer = 1. Alle Parameter werden zwischen benannten Eckwerten für leicht und schwer **interpoliert**. So braucht „dynamisch“ keine eigene Logik in den Bots.
- Was `s` steuert:
  - **Brett:** Item-Einsatz gezielt statt zufällig, Weg zur Trophäe, Fallen meiden, Reaktionschance und Reaktionszeit, Wahl des Klau-Ziels.
  - **Minispiele:** Reaktionszeit, Zielfehler (Rauschen auf dem Joystick), Fehlerrate (falscher oder ausgelassener Knopf), Vorausschau.
- Die Eckwerte legt das Experiment in CHAOS-183 fest. Zielbild: „mittel“ gewinnt gegen die Mensch-Näherung etwa so oft wie ein durchschnittlicher Mensch. KI darf nie unfehlbar sein, auch „schwer“ nicht: Reaktionszeit nie unter der menschlichen Untergrenze (`minMs` ≈ 500 ms) und eine Rest-Fehlerrate.
- **Dynamisch** (CHAOS-187):
  - Startet bei `s = 0,5`.
  - Passt sich **nur am Rundenende** an, um höchstens **0,25 je Runde** (eine halbe Stufe), immer zwischen 0 und 1.
  - Maß ist der Abstand der KI zum **Median der Menschen**: zuerst Trophäen, dann Münzen, dann die letzten Minispiel-Plätze. Bei Solo zählt der eine Mensch.
  - Liegt die KI vorn, sinkt `s`; liegt sie hinten, steigt `s`.
  - Die Regel hängt nur vom Spielstand ab und ist damit deterministisch.
  - Ob das mit Aufholhilfe (EXP-022) und Rückenwind (CHAOS-125) zu viel wird, prüft CHAOS-183.

### 5. Persönlichkeit

- Vier Spielstile als Gewichte über der Stärke (CHAOS-186): **Saboteur** (Klau und Fallen), **Sammler** (Münzen, meidet Risiko), **Draufgänger** (riskante Wege, Items sofort), **Fuchs** (spart Items für den passenden Moment).
- Vergabe **beim Partiestart per Seed**, ohne Doppelungen, solange es genug Stile gibt. Nicht wählbar, in der Lobby nicht sichtbar. Bei „Nochmal spielen“ werden sie mit dem neuen Seed neu gezogen.
- Eine Persönlichkeit ändert, **was** die KI tut, nicht **wie gut**. „Leicht“ bleibt leicht. Wie stark ein Stil die Siegquote verschieben darf, legt CHAOS-183 fest.

### 6. Denkpause und Timing

- Jede KI-Entscheidung kommt nach einer **Denkpause** aus einem Zeitmodell (`DelayModel`, log-normal), nie sofort.
- **Brett-Prompts** (Würfeln, Weg, Item, Trophäe, Ziel): etwa 0,8–2,5 s wie `decisionMs`. Leicht ist etwas langsamer. So kann man am Bildschirm verfolgen, was die KI tut, und die Partie zieht sich trotzdem nicht.
- **Reaktionsfenster** (Klau, Schild; 3 s, mit „Mehr Zeit zum Reagieren“ 5 s): Die Reaktionszeit kommt aus einem menschenähnlichen Modell je Stärke (Anhalt EXP-004: schwer ≈ fokussiert, mittel ≈ typisch, leicht ≈ abgelenkt). Die KI hält dieselbe Frist ein. Eine zu späte Antwort lehnt game-core ab (`stale-prompt`), wie bei Menschen. „Mehr Zeit zum Reagieren“ ist für Menschen gedacht. Die KI reagiert deshalb nach demselben Zeitmodell und nutzt die längere Frist nicht absichtlich aus.
- Die Pausen laufen über die Uhr des Servers (`now()` und Zeitgeber, am Apple-Host über die Brücke). **Pause, Auto-Pause nach Host-Verlust und Spielende halten alle KI-Zeitgeber an** bzw. verwerfen sie. Nach dem Fortsetzen beginnt die Denkpause neu.
- Ist **kein Mensch mehr verbunden**, pausiert die Partie. Die KI spielt nie allein weiter.

### 7. Kennzeichnung

- Ein KI-Platz heißt nach seiner Figur und trägt ein **KI-Zeichen**: am Spielerchip, in der Lobby, im HUD, im Minispiel-Ergebnis und auf dem Siegerpodest. Ab dem Start kommt der Stil dazu, z. B. „Schraubi · KI · Saboteur“.
- Die KI wählt in der Lobby **keine Figur**. Beim Start bekommt sie eine freie (`assignCharacters`, Menschen zuerst). So nimmt die KI keinem Menschen eine Figur weg.
- Das genaue Zeichen und die Farbe stimmt CHAOS-182 mit `docs/art-direction.md` ab. Emoji sind nur ein Platzhalter.
- Controller zeigen während eines KI-Zugs „<Name> (KI) ist am Zug“ wie bei Menschen.

### 8. Determinismus

- Jeder KI-Platz hat einen **eigenen Zufallsstrom**, abgeleitet aus Partie-Seed, Platz und Zweck: Brett-Entscheidungen, Denkpausen, Persönlichkeitsvergabe. So verschiebt eine zusätzliche KI-Entscheidung nicht die Würfel und Ereignisse der Partie (game-core-RNG) und nicht die anderen KI-Plätze.
- In Minispielen bekommt jeder Bot einen Strom aus Minispiel-Seed und Platz. `ctx.rng` des Minispiels bleibt unberührt.
- Gleicher Seed, gleiche Menschen-Eingaben und gleiche (Test-)Uhr ergeben dieselbe Partie. In echten Partien schwankt die Wanduhr. Das ist wie bei Menschen gewollt und kein Fehler.
- Die Balance-Simulation darf ihren bisherigen Strom behalten. Einen Regressionsvergleich verlangt CHAOS-181.

### 9. Geteiltes iPad, Reconnect, Revanche

- Eine KI belegt **keine iPad-Zone**. Das iPad zeigt nur Zonen für seine menschlichen Plätze (`join { seats }` wie bisher).
- KI-Plätze haben **keine Verbindung**: keinen Herzschlag, kein Token, keinen Reconnect. Sie gelten nie als getrennt und lösen keine Hinweise wie „Spieler getrennt“ aus.
- „Nochmal spielen“ behält KI-Plätze und ihre Stärke.

### 10. Protokoll

Die Erweiterung ist **additiv, als v4-Nachtrag ohne Versionssprung**, wie bisher bei CHAOS-40, 68 und 197:

- optionale Platzart und Stärke an `LobbyPlayer` und `BoardPlayer`
- die Persönlichkeit an `BoardPlayer`
- eine neue Controller-Absicht für die Spielleitung

Alte Controller ignorieren die Felder und zeigen KI-Plätze als normale Mitspieler. Das ist unschön, bricht aber nichts. Der Apple-Host-Vertrag (`apps/apple-host/src/contract.ts`) und die Fixtures der nativen Controller-App bekommen die Felder mit (CHAOS-179, CHAOS-182).

## Betrachtete Alternativen

| Alternative | Warum nicht |
|---|---|
| Nur Auffüllen (mindestens 2 Menschen) | Ruben hat Solo erlaubt (Entscheidung 1). |
| Ganze KI im Server, auch Minispiele | Der Server kennt den Minispiel-Zustand nicht (ADR-012). Er bräuchte Schnappschüsse vom Host mit Verzögerung, oder die Minispiele müssten in den Server (ADR-012 umkehren). |
| Ganze KI im Host, auch Brett | Brett-Prompts liegen im Server. Der Host müsste Entscheidungen zurückschicken, als eigene Rolle mit neuen Prüfungen. Zwei Hosts (Babylon, Apple) bräuchten die Brett-KI in ihrer Host-Schicht. |
| KI als eigener Netz-Client | Siehe §3: Netz, Herzschlag und Reconnect ohne Nutzen. Für Minispiele bräuchte sie trotzdem den Host-Zustand. |
| Stufen und „dynamisch“ als zwei getrennte Schalter | Mehr Bedienung in der Lobby, und offen bliebe, was „schwer + dynamisch“ heißt. Ein Wert mit vier Möglichkeiten reicht. |
| Persönlichkeit wählbar | Ruben: zufällig vergeben (Entscheidung 4). |
| KI wählt Figur in der Lobby | Kann Menschen eine Lieblingsfigur wegnehmen. Freie Figur beim Start ist einfacher. |
| Ein gemeinsamer KI-Zufallsstrom wie in `simulate.ts` | Eine Entscheidung mehr verschiebt alle folgenden Entscheidungen aller KI. Das macht Tests und Fehlersuche schwerer. |

## Konsequenzen

**Positiv**

- Eine Umsetzung für alle Hosts: Die Brett-KI liegt im Server-Code, die Minispiel-KI in der Minispiel-Laufzeit. Beides ist TypeScript und läuft am PC wie am Apple-Host.
- KI-Antworten gehen durch dieselben Prüfungen wie Menschen-Eingaben. Die KI kann nicht schummeln, und Fehler in der KI können den Spielstand nicht beschädigen.
- Man kann allein oder zu zweit eine volle Partie spielen. Auch Ruben kann so allein testen.
- Simulation und Live-KI nutzen dieselbe Entscheidungslogik. Balance-Messungen sagen dann auch etwas über die Live-KI.

**Negativ / Risiken**

- Jedes Minispiel braucht einen Bot (Mehraufwand je Spiel, auch für den Ausbau auf ~200 Minispiele, CHAOS-80). Der Baukasten (CHAOS-83) muss Bots mitliefern.
- Die Minispiel-KI hängt am Host. Lädt der Host neu, startet das Minispiel neu (ADR-012 §6), die Bots mit. Das ist kein neuer Fehlerfall.
- Ob die KI Spaß macht (fair, erkennbar, angenehme Pausen), zeigt nur ein Test mit Menschen (CHAOS-185). Bot-gegen-Bot-Messungen sind nur eine Näherung.
- Die dynamische Stärke kann sich wie ein Gummiband anfühlen. Gegenmittel sind kleine Schritte nur am Rundenende und Rubens Playtest.
- Alte native Controller-Apps zeigen KI-Plätze ohne Kennzeichnung, bis sie aktualisiert sind.

## Überprüfung

- Nach dem Stärke-Experiment (CHAOS-183): Eckwerte und Ziel-Siegquoten eintragen (Nachtrag).
- Nach Rubens Playtest (CHAOS-185): Denkpausen, Kennzeichnung und den Standard „mittel“ prüfen.
- Wenn Minispiel-Logik je in den Server wandert (Umkehr von ADR-012), muss auch die Minispiel-KI umziehen.

## Nachtrag 1 (2026-11-21, CHAOS-180): Vertrag der Minispiel-Bots

Umsetzungsentscheidungen von Claude im Rahmen von §3, §4 und §8:

- **Ort des Erzeugers:** `createBot` ist eine optionale Methode des Minispiel-**Exemplars** (`Minigame.createBot(options)`), nicht des Moduls. Nur das Exemplar kennt nach `prepare` seinen Zustand, und so braucht der Vertrag keinen Typparameter für die Beobachtung. Die Regel „nur Beobachtbares“ ist Konvention jedes Bots (Review, Tests wie `KuckuckDoorWatcher` gegen die Logik-Ereignisse), nicht vom Typsystem erzwungen. Pflicht wird sie über den Vertragstest der Rotation.
- **Laufzeit:** `createMinigameRunner` bekommt die KI-Plätze als Option `bots` (Platz und Stärke). Ab `start` ruft sie je Platz und festem Schritt `tick()` vor `update` auf und leitet die Eingaben durch den Controller-Eingang. Stick-Eingaben drosselt sie auf 30 Hz (`BOT_MOVE_STEPS = 2`); Knöpfe warten hinter einem gedrosselten Stick, damit ein Rempler in die gewollte Richtung geht. In der Pause fragt sie keinen Bot, danach entscheiden die Bots neu. Wirft ein Bot, steht nur sein Platz still (neutrale Eingaben), das Minispiel läuft weiter. Der Host übergibt die KI-Plätze, sobald er sie aus dem Brett-Stand kennt (CHAOS-179/182).
- **Zufall:** `botSeed(minigameSeed, slot)` je Platz. Ein Test prüft, dass Bots den Spielzufall (`ctx.rng`) nicht verschieben.
- **Eckwerte:** Für Spiele mit `BotProfile` ist leicht = Neuling und schwer = Profi aus der Fairness-Messung (EXP-005), für Havok-Figurenspiele die Stufen aus EXP-006 bzw. CHAOS-84. Der Wackelturm bekommt eigene Eckwerte (EXP-039), weil der Profi-Bot aus EXP-007 gegen den Neuling verliert.
- **Untergrenze der Reaktionszeit:** Die ≈ 500 ms aus §4 gelten für Reaktionsfenster am **Brett** (`DelayModel.minMs`). In Minispielen wäre 500 ms langsamer als ein durchschnittlicher Couch-Mensch (Normal-Profil: 400 ms inklusive Bildschirm- und Funklatenz). Dort ist die Grenze das Profi-Profil (230 ms Mittel, log-normal gestreut) mit Rest-Aussetzern (≥ 2 %), Zielrauschen und Fehlstarts. „Nie unfehlbar“ gilt damit weiter. Die endgültigen Eckwerte stellt CHAOS-183 nach Messung gegen eine Mensch-Näherung ein.
- **Persönlichkeit** (`createBot(…, persönlichkeit, …)` im Arbeitsnamen) ist noch nicht im Vertrag. Sie kommt mit CHAOS-186 als weiteres Feld in `MinigameBotOptions`.
