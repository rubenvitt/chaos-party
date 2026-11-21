# Effekte des Hosts (CHAOS-33, CHAOS-223)

**Klänge sind echte Aufnahmen** (seit CHAOS-223, alle CC0): Kenney-Audio-Pakete und einzelne
Klänge von freesound.org, ausgewählt in [`packages/assets/sounds.json`](../../../../packages/assets/sounds.json),
importiert als normalisierte MP3 nach `packages/assets/sounds/` (Herkunft je Datei im
Asset-Manifest, `klang-…`). `samples.ts` wählt je Klang-Name die Datei (Varianten reihum),
Abspiel-Rate (Tonhöhe samt kleiner Streuung) und Lautstärke; `audio.ts` spielt sie per WebAudio
(`sampleUrls.ts` liefert die URLs aus dem Vite-Build). Der Apple-Host benutzt denselben Picker und
schickt die Wahl im `SoundCue` an Swift. Die prozeduralen **Rezepte** (`sounds.ts`: Oszillatoren/
Rauschen mit Hüllkurven) bleiben als Rückfall, solange die Dateien laden oder wenn eine fehlt.

Einen Klang tauschen: Quelle in `sounds.json` ändern, `pnpm --filter @chaos-party/assets
import:sounds` (ffmpeg mit libmp3lame), dann Prettier und `pnpm check:assets`. Lautstärke im Mix
(`gain`) und Streuung (`jitter`) stehen ebenfalls dort.

Partikel sind **prozedural** erzeugt (keine Bilddateien). Partikel: Babylon-`ParticleSystem` mit Texturen, die als RGBA-Pixel berechnet werden
(`particles.ts`). Kamerawackeln: `shake.ts`. Alles zusammen als `MinigameFx` für Minispiele:
`minigameFx.ts`; Brett-Klänge je Regie-Ereignis: `boardSounds.ts`.

Effekte sind nie spielrelevant. Im Testmodus (`?test=1`) und mit `?mute=1` ist der Ton aus; im
Testmodus werden Partikel und Wackeln nur gezählt. Der `AudioContext` entsteht erst mit einer
Nutzer-Geste (Klick auf „Los geht’s!“ in der Lobby oder erste Taste/erster Klick auf der Seite).
Gesamtlautstärke: `?volume=0…100` (Standard 70).

## Klänge – Minispiele (`SOUND_IDS` aus `@chaos-party/minigame-sdk/babylon`)

Die Beschreibung nennt das Rezept (Rückfall); welche Aufnahme spielt, steht in `sounds.json`.

| ID       | Beschreibung                                         |
| -------- | ---------------------------------------------------- |
| `tick`   | Kurzes Holzklötzchen-Tick (Countdown)                |
| `go`     | Aufsteigender Dreiklang „Los!“                       |
| `hit`    | Dumpfer Treffer: Rauschstoß mit tiefem Plopp         |
| `bump`   | Gummi-„Boing“ beim Zusammenstoßen                    |
| `coin`   | Münz-Pling in zwei Tönen                             |
| `score`  | Fröhliches Aufwärts-Glissando für Punkte             |
| `fall`   | Lotusflöte abwärts (jemand fällt runter)             |
| `splash` | Platschen: gefiltertes Rauschen und Blubb            |
| `whoosh` | Luftzug: Rauschen mit wanderndem Bandpass            |
| `pop`    | Kurzes Blubb-Plopp (Pumpen, Einsammeln)              |
| `buzz`   | Weicher Fehler-Summer                                |
| `cheer`  | Jubel: Rausch-Raunen mit zwei „Juhu“-Stimmen         |
| `win`    | Kleine Siegesfanfare (C-E-G-C)                       |
| `lose`   | Trauriges „Wah-wah-wah“ abwärts                      |

## Klänge – Spielbrett und Bühne (`BOARD_SOUND_IDS`, nur Host)

| ID               | Beschreibung                                    | Auslöser                                          |
| ---------------- | ----------------------------------------------- | ------------------------------------------------- |
| `dice`           | Würfelklappern mit Aufschlag                    | `dice-rolled`                                     |
| `coin-gain`      | Münzen bekommen: helles Doppel-Pling            | `coins-changed` > 0 (Feld, Ereignis, Minispiel)   |
| `coin-loss`      | Münzen verlieren: absackende Töne               | `coins-changed` < 0 (Feld, Ereignis)              |
| `steal`          | Münzklau: Wusch und schleichendes Tiefton-Motiv | `coins-stolen`                                    |
| `trap`           | Falle schnappt zu: Klick und tiefes Zuschnappen | `trap-triggered` (leiser/höher: `trap-placed`)    |
| `shield`         | Schild: schimmernder Glockenklang               | Schild benutzt, Reaktion „Schild“                 |
| `trophy`         | Trophäe gekauft: Fanfare mit Glitzern           | `trophy-bought`                                   |
| `turn`           | Zugbeginn: sanfter Zweiklang-Gong               | `turn-started`                                    |
| `minigame-start` | Minispiel-Zeit: Aufwärts-Swoosh mit Tusch       | Minispiel-Bühne erscheint (Anleitung)             |
| `pause`          | Pause: zwei sanfte, absteigende Töne            | `view.paused` wird `true` (auch Auto-Pause)       |
| `resume`         | Weiter: zwei sanfte, aufsteigende Töne          | `view.paused` wird `false`                        |

Weitere Zuordnungen am Brett: Item gefunden → `pop`, andere Items → `whoosh`, Reaktion
„festhalten“ → `bump`, zu langsam/leerer Klau → `buzz`, Spielende → `win`. In der Anleitung tickt
`tick` bei 3-2-1, zum Ergebnis spielt `cheer`.

## Partikel (`VFX_IDS` aus `@chaos-party/minigame-sdk/babylon`)

| ID         | Form   | Beschreibung                                 |
| ---------- | ------ | -------------------------------------------- |
| `sparkle`  | Stern  | Goldene Glitzersterne (Punkte, Einsammeln)   |
| `dust`     | Punkt  | Staubwölkchen am Boden (Landen, Bremsen)     |
| `confetti` | Viereck| Bunte Konfetti-Fontäne (Sieg)                |
| `impact`   | Ring   | Weißer Aufprall-Ring (Treffer)               |
| `splash`   | Punkt  | Wasserspritzer (Reinfallen)                  |
| `stars`    | Stern  | Kreisende Benommenheits-Sterne (umgehauen)   |
| `smoke`    | Punkt  | Graue Rauchwölkchen (Puff, Ausscheiden)      |

`burst(id, at, color?)`: Mit Farbe (z. B. Slot-Farbe) wird die Farbe des Presets ersetzt.
Höchstens 24 Ausbrüche gleichzeitig; jeder entsorgt sich nach dem Verglühen selbst.

## Kamerawackeln

`shake(stärke 0…1)`: höchstens 0,35 Einheiten Versatz, klingt in 380 ms linear ab. Der Versatz
gilt nur fürs Rendern (vor dem Bild addiert, danach abgezogen).
