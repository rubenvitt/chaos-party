# ADR-011: Brettspiel in M2 – Regeln als reiner Reducer im Server, Protokoll v2, Host zeigt nur an

**Status:** Angenommen
**Datum:** 2026-11-15
**Aufgabe:** CHAOS-2 (CHAOS-17 … CHAOS-24)
**Betroffene Annahmen:** `docs/assumptions.md` B8 (Zeitbezug nur Server-Uhr), D4 (Regeln als reine Zustandsmaschine mit Seeded RNG)

## Kontext

M2 verlangt einen vollständig spielbaren Brett-Zugzyklus: Brett mit Verzweigungen, Würfeln, Zugreihenfolge, Pfadwahl, Münzen, Trophäen, mindestens drei Items mit Sabotage und ein begrenztes Reaktionsfenster. Brettzustand und Wertung müssen **autoritativ auf dem PC** liegen und mit festen Seeds reproduzierbar testbar sein (ARCHITECTURE „Game-core design“, ROADMAP M2). Bis M1 leitet der Server Eingaben nur an den Host weiter, der die Arena simuliert (ADR-005, ADR-004). Die Arbeit wurde parallel von Subagenten erledigt; dafür brauchte es vorab feste Verträge.

## Entscheidung

**1. Regeln als reiner Reducer (`packages/game-core`).** `createGame(config)` und `step(state, command) → { ok, state, events } | { ok: false, error }`. Zustand ist JSON-serialisierbar; RNG-Zustand (mulberry32) und Zwischenstände liegen in `state.internal`. Befehle: `start`, `choose { slot, promptId, option }`, `tick`, `connection { slot, connected }` – alle mit `at` (Server-Uhr). Jeder Befehl lässt zuerst die Zeit bis `at` laufen (Fristen, Pacing), dann wirkt er. Dadurch ist eine verspätete Wahl automatisch `stale-prompt`. Explizite Phasen `setup → turn-start → roll (→ choose-target → reaction-window) → move (→ choose-path / trophy-offer) → space-event → turn-end → … → minigame-intro/play/results → round-end → game-results`. Entscheidungen sind generische **Prompts** (`roll`, `target`, `path`, `trophy`, `reaction`) mit Optionen, Standardoption und Frist. Alle Zahlen (Würfelseiten, Münzen, Preise, Item-Gewichte, Pacing, Reaktionsdauer) stehen in einem `RuleSet` – die Stellschrauben der Experimente.

**2. Das Spiel läuft im Session-Server**, nicht im Host. Der Server läuft auf dem PC und ist ohnehin autoritativ für Slots und Phasen; der Host bleibt reine Anzeige. `apps/server/src/game.ts` (`BoardGame`) hält den `GameState`, nummeriert die Ereignisse und baut die Nachrichten. Die Session ruft `tick()` jetzt alle **100 ms** (statt 1 s), damit Pacing und Reaktionsfenster genau laufen.

**3. Protokoll v2** (`PROTOCOL_VERSION = 2`, additiv zu ADR-003):
- Phase `board` (ganzes Brettspiel); `play` bleibt die M1-Arena.
- `start { mode?: 'board' | 'arena', rounds? }` – Standard ist das Brettspiel; der Host startet die Arena mit `?arena=1`.
- Controller → Server: `choose { slot, seq, promptId, option }`. Prüfreihenfolge wie ADR-005, dann „Prompt offen für diesen Slot“ und die Regel selbst; Fehler → `invalid-choice` (zählt nicht als Missbrauch, kommt bei Fristablauf normal vor).
- `context` trägt in `board` optional `prompt` (Titel, Optionen mit Label/Detail/Slot, `remainingMs`) und `board` (eigene Münzen, Trophäen, Items, Runde, wer dran ist, Platz). Kontexte gehen nur bei Änderung raus (Vergleich ohne Restzeit).
- Server → Host: `board { view, events, eventSeq }`. `view` ist der öffentliche Stand (ohne RNG), `events` die seit der letzten Nachricht entstandenen Ereignisse, `eventSeq` lückenlos ab 0. Ein neu verbundener Host bekommt sofort einen Schnappschuss ohne Ereignisse.
- Server-Nachrichten dürfen bis 64 KiB groß sein (Client-Nachrichten bleiben bei 4096 Zeichen).
- `GameEvent` (game-core) und `BoardEventSchema` (protocol) sind getrennt definiert; eine Zuweisung in `game.ts` prüft zur Übersetzungszeit, dass sie zusammenpassen.

**4. Disconnect mitten im Zug** hält die Partie nicht auf: Hat ein getrennter Spieler den offenen Prompt, gilt nach `disconnectGraceMs` (15 s) die Standardoption (`player-auto`). Reservierte Slots bleiben (ADR-009); nach `reconnect` bekommt der Controller sofort seinen Kontext.

**5. Minispiel-Phase** ist in M2 ein **Platzhalter**: Intro, kurze Wartezeit, Rangfolge per Seed, Münzbelohnung. Echte Minispiele und ihr Vertrag folgen in M3 (CHAOS-26).

**6. Brett als Daten, Darstellung im Host.** Das Brett „Wackelwald“ ist ein Graph in `packages/game-core/src/board/` (43 Felder, zwei Verzweigungen: Klippenweg/Sumpfabkürzung und Pilzpfad/Wackelbrücke, Rundenlänge 32–36 Felder, 4 Trophäen-Kandidaten; seit CHAOS-196 74 Felder, vier Gabeln, Rundenlänge 37–47 Felder, 13 Kandidaten, EXP-037). `validateBoard` prüft eindeutige IDs, genau ein Start, bekannte Nachfolger, keine Selbstschleifen und Sackgassen, Erreichbarkeit in beide Richtungen (stark zusammenhängend), verschiedene Nachfolger an Verzweigungen, Wegweiser-Länge, Mindestabstand, ≥ 1 Trophäenfeld und ≥ 1 Verzweigung. Der Host baut daraus eine **eigene Babylon-Szene ohne Havok** (`apps/host/src/board/`), die je nach Phase die M1-Arena ersetzt. Feldtypen unterscheiden sich durch Farbe **und** Form/Symbol.

**7. Regie im Host (`director.ts`).** Der Host spielt die Ereignisse einer `board`-Nachricht nacheinander ab (Figuren hüpfen im Takt `view.stepMs`, Effekte 700–1300 ms) und übernimmt den `view` erst danach. Doppelte Ereignisse werden verworfen, bei einer Lücke in `eventSeq` springt er direkt auf den neuen Stand. Liegt er mehr als 2,5 s zurück, läuft er dreifach schnell, ab 8 s springt er. Countdowns rechnet er aus `remainingMs` plus eigener Empfangszeit. Daraus folgt: Server-Pausen wie `spaceEventMs` sollten nicht kürzer sein als die Host-Effekte, sonst holt der Host per Zeitraffer auf. *Nachtrag CHAOS-52 (2026-11-17):* Ein `moved` direkt nach `board-event` `gust` spielt der Host als einen Flug (0,9 s), die beiden `moved` eines Platztauschs als einen gemeinsamen Flug beider Figuren über Kreuz (1 s); die Ansage davor dauert dann nur 0,4 s. Das Protokoll bleibt unverändert, die Regie erkennt beides an der Ereignisfolge (`toQueueItems`).

## Betrachtete Alternativen

| Alternative | Warum nicht |
|---|---|
| Regeln im Host (Browser) wie die M1-Arena | Host-Reload würde die Partie verlieren; Controller-Kontexte (wer darf was) müsste der Host über den Server zurückspielen; Tests bräuchten einen Browser. |
| Klasse mit veränderlichem Zustand statt Reducer | Replays, Determinismus-Tests und Simulationen (Experimente) sind mit einem reinen Reducer trivial; der Zustand bleibt serialisierbar. |
| Eigene Nachricht je Entscheidungsart (`roll`, `choose-path`, `buy` …) | Mehr Protokoll und Controller-Code je neuer Mechanik; generische Prompts lassen neue Optionen ohne Controller-Änderung zu. |
| Nur Zustand an den Host, keine Ereignisse | Der Host müsste Bewegungspfade und Ursachen (Klau, Falle) aus Differenzen erraten; Ereignisse machen Animation und Meldungen eindeutig. |
| Server-Takt 1 s beibehalten | Reaktionsfenster (3 s) und Feldtakt (350 ms) wären um bis zu 1 s ungenau. |

## Konsequenzen

**Positiv**
- Komplette Partien laufen in Unit- und Integrationstests ohne Browser in Millisekunden, mit festen Seeds reproduzierbar (`apps/server/src/boardGame.integration.test.ts`).
- Dieselbe Simulation dient den Experimenten (`simulateGame`, `docs/experiments.md`).
- Host-Reload und Controller-Reconnect verlieren nichts; der Server schickt den vollständigen Stand.

**Negativ / Risiken**
- Zwei Typquellen (game-core-Typen und zod-Schemas) – abgesichert durch die Typprüfung in `game.ts`.
- Animationen im Host laufen mit dem Pacing des Servers mit; ist der Host-Tab im Hintergrund oder sehr langsam, springt er auf den `view`.
- ~~Nach `game-results` gibt es noch keinen Weg zurück in die Lobby (Neustart des Servers); kommt mit dem Start-/Pause-/Ende-Ablauf in M4.~~ Überholt: „Nochmal spielen“ (`rematch`, ADR-015 §5, CHAOS-37) führt ohne Neustart zurück in die Lobby; zwei Partien hintereinander mit denselben Verbindungen deckt `apps/server/src/lifecycle.integration.test.ts` ab (CHAOS-50).

## Überprüfung

Neu bewerten, wenn echte Minispiele (M3) Host-seitige Ergebnisse liefern müssen (dann Ergebnis-Nachricht Host → Server mit Validierung), wenn Playtests ein anderes Pacing-Modell verlangen (z. B. Host meldet „Animation fertig“) oder wenn die Nachrichtengröße bei vielen Ereignissen spürbar Latenz kostet.
