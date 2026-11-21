# ADR-024: Schnellfeuer als zusammengesetztes Minispiel, Auslöser in game-core

**Status:** Angenommen
**Datum:** 2026-11-21
**Aufgabe:** CHAOS-90, Epic CHAOS-80
**Betroffene Annahmen:** ADR-012 (Minispiel-Vertrag, Server als Schiedsrichter), ADR-021 (Baukasten), README §7 Nr. 3 (Rubens Entscheidung im Konzept-Gate CHAOS-82)

## Kontext

Ruben hat Schnellfeuer im Konzept-Gate CHAOS-82 als **eigene Mechanik** freigegeben: Fünf Mikro-Spiele à 5–8 s am Stück ersetzen das Minispiel einer Runde, gewertet wird über alle fünf, die Münzen folgen der normalen Platzierung. Die Mikro-Spiele bilden einen eigenen Vorrat und zählen nicht zu den ~200 vollen Minispielen. Der Auslöser sollte per Experiment gewählt werden: (a) Brett-Ereignis „Schnellfeuer!“, (b) Halbzeit, (c) Finale.

Randbedingungen: PC-Host (Babylon) und nativer Apple-Host (TS-Kern in JavaScriptCore, RealityKit) zeigen Minispiele über denselben Vertrag; Controller bekommen ihre Bedienung aus dem Steckbrief; der Server prüft jedes Ergebnis.

## Entscheidung

1. **Schnellfeuer ist nach außen ein normales Minispiel-Modul** (`packages/minigames/src/schnellfeuer`, ID `schnellfeuer`, Familie `mikro`, Spielform `Mikro`). Intern spielt eine reine Kette (`chain.ts`) fünf Mikro-Spiele nacheinander: 1,3 s Bildwort (Knöpfe gesperrt), Spielzeit des Mikro-Spiels, 1 s Auswertung. Je Mikro-Spiel gibt es Punkte nach Platz (Anzahl der strikt Schlechteren, bei vier 3/2/1/0), das letzte zählt doppelt („×2“). Die Summe ist das Ergebnis, das der Host wie jedes Minispiel-Ergebnis meldet.
2. **Mikro-Vertrag** (`micro.ts`): 5–8 s, ein Bildwort in Großbuchstaben mit „!“ (≤ 12 Zeichen) und ein Piktogramm statt Anleitung, Skizze aus MG-191 … MG-200. Logik und Bot je Mikro-Spiel rein, die Ansicht baut alle Gegenstände schon in `prepare` (die Kette darf zur Laufzeit nichts asynchron bauen) und schaltet sie mit `setEnabled` um; native Hosts lassen abgeschaltete Meshes weg.
3. **Anzeige ohne neues Protokoll:** Bildwort und Auswertung stehen im HUD-Banner (`MinigameHud.banner`, ≤ 32 Zeichen), Zustände je Person im HUD-Status. Die Bedienung am Controller ist die Vereinigung (Stick „Zielen“, A „Los!“).
4. **Nicht in der Rotation:** `MINIGAME_INFOS` enthält Schnellfeuer (Galerie, Server, Hosts), `ROTATION` nicht. game-core bekommt es getrennt als `GameConfig.rapidFire` und setzt es ein, wenn `rules.rapidFire` auslöst; Mischung und Gedächtnis der Rotation bleiben unberührt.
5. **Auslöser** (`RapidFireRules`): `event` (Brett-Ereignis `rapid-fire`, gilt für das Minispiel derselben Runde; `eventWeight` Lose im Ereignis-Topf, `maxPerGame`, `finaleFallback`), `halftime`, `finale`. Ohne Regel bleibt die Ereignis-Liste (und damit jeder Seed) wie vorher. Standard am Server und im Apple-Host nach EXP-039: Ereignis mit 5 Losen, höchstens einmal, sonst im Finale (`RAPID_FIRE_RULE`, `SCHNELLFEUER=an|aus|ereignis|halbzeit|finale`). `DEFAULT_RULES` bleibt ohne Schnellfeuer.
6. **Protokoll:** v4-Nachtrag (additiv): Brett-Ereignis `rapid-fire`. Sonst nichts Neues.

## Betrachtete Alternativen

| Alternative | Warum nicht |
|---|---|
| Fünf eigene `minigame-play`-Phasen in game-core | Neue Phasen und Nachrichten in Protokoll, Host-Ablauf, Controller und Swift-Overlay; jedes Mikro-Spiel bräuchte Anleitung und Ergebnis über das Netz. Viel Fläche für eine Runde von ~40 s. |
| Mikro-Spiele als eigene Minispiel-Module in der Rotation | Widerspricht Rubens Entscheidung (eigene Mechanik, eigener Vorrat) und dem Vertrag (≥ 5 s, Anleitung in 1–3 Zeilen); einzeln zu kurz für eine Runde. |
| Gleiche Zufallswerte für alle Bahnen | Fairer, aber Schnellfeuer würde zur reinen Können-Probe (Neuling gegen drei Normale 0,5 % Siege). Etwas Glück je Bahn hält den Neuling über der Fairness-Schwelle (EXP-039). |

## Folgen

- PC- und Apple-Host brauchen keinen eigenen Code: Bot-Partie im Apple-Host (`bots --full`) spielt Schnellfeuer mit, Bauschritte < 4 ms ohne JIT.
- Neue Mikro-Spiele (CHAOS-113) brauchen Eintrag in `MICRO_POOL`, Ansicht in `MICRO_VIEWS`, Bot und Mikro-Vertrag. `CHAIN_MAX_MS` (Spielzeit des Steckbriefs) folgt den fünf längsten im Vorrat; mit mehr als fünf im Vorrat endet ein Leerlauf früher als die Spielzeit und der Vertragstest „Leerlauf endet am Zeitlimit“ muss angepasst werden.
- Das Bildwort steht nur am Host, nicht am Controller (Folgeaufgabe).
- Wie sich Tempo und Bildwort anfühlen, beurteilt Ruben bei der Zwischenabnahme CHAOS-92 (Gerätecheckliste §47).
