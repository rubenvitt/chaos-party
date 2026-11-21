# Vertrag zwischen JS-Kern und Swift-App (ADR-019 §2, CHAOS-138/139)

Swift ist nur Transport, Uhr und Darstellung. Alles Spiel – Session-Server, game-core und die Host-Rolle samt Minispielen (headless, Havok) – läuft als ein JS-Bündel in JavaScriptCore.

**Quelle der Wahrheit ist [`src/contract.ts`](src/contract.ts)** (TypeScript-Typen und zod-Schema). Diese Datei fasst zusammen. Beispielnachrichten je Phase: [`harness/Fixtures/render-state/`](harness/Fixtures/render-state), erzeugt aus `src/examples.ts` mit `node scripts/export-apple-host-fixtures.mjs`.

Ein neues Feld in `renderState` heißt: in `RenderStateSchema` eintragen (sonst scheitert der Bündel-Test, das Schema ist streng), in `app/RenderState.swift` optional ergänzen, Beispiele nachziehen.

## Bündel

`apps/apple-host/dist/chaos-host.js` (IIFE, ES2022, ohne Node- und DOM-APIs) setzt `globalThis.ChaosHost` und `globalThis.ChaosHostInternals` (nur für Harness/Tests: `base64url`, `rotation`, `pendingTimers`). Havok kommt als Bytes von Swift (`env.havokWasm`), nicht per fetch.

```ts
interface HostEnv {
  send(connId: number, text: string): void; // Text-Frame an eine Controller-Verbindung
  close(connId: number, code: number, reason: string): void;
  log(line: string): void;
  randomBytes(n: number): number[]; // Swift: SecRandomCopyBytes, genau n Bytes
  havokWasm: Uint8Array | number[]; // Inhalt von HavokPhysics.wasm
  joinUrl: string; // http://<ip>:<port>/?code=<CODE>
  joinCode: string;
  deferSceneReady?: boolean;                         // true: host-ready erst nach sceneReady() (CHAOS-142)
  tailwind?: boolean;                                // true: Regel Rückenwind an (CHAOS-188, wie RUECKENWIND=1 am PC)
}
interface ChaosHostApi {
  create(env: HostEnv): ChaosHostInstance;
}
interface ChaosHostInstance {
  open(connId: number): void; // neue WebSocket-Verbindung an /ws (IDs > 0)
  message(connId: number, text: string): void; // eingehender Text-Frame
  closed(connId: number): void;
  tick(nowMs: number): void; // ~60× pro s (Anzeige-Takt), monotone ms-Uhr; treibt
  // Zeitgeber, Session-Fristen und 1/60-Schritte der Minispiele
  renderState(): string; // JSON, siehe unten; je Bild nach tick
  hostCommand(cmd: string): void; // 'start' | 'pause' | 'resume' | 'end-game' | 'rematch' | 'configure:…' | 'skip-finale'
  sceneReady(): void; // Brett und Figuren geladen → host-ready (CHAOS-68/142)
}
```

`configure` (CHAOS-166): `configure:rounds=12`, `configure:moreReactionTime=1` (`0`/`1`/`true`/`false`), `configure:board=wackelwald` (Brett-ID oder `zufall`, CHAOS-197) oder mehreres mit Komma, `configure:rounds=12,moreReactionTime=1`. Runden 1–20; ein unbekanntes Brett lehnt der Server ab (Log „Server-Fehler an Host: bad-message …“). Wirkt nur in der Lobby; außerhalb loggt der Kern „ignoriert: nur in der Lobby“, Ungültiges „Ungültiger Host-Befehl“, gesendet wird dann nichts. Der neue Stand steht im nächsten `renderState().lobby.settings`.

`pause`, `resume`, `end-game` und `rematch` (CHAOS-145) gehen nur an den Server, wenn sie passen: `pause` nur bei `renderState().pause.canPause` (Brett und Minispiel, nicht vor dem Start und nicht im Finale), `resume` nur in der Pause, `end-game` nur in der laufenden Partie, `rematch` nur im Finale. Sonst loggt der Kern „Host-Befehl … ignoriert: passt gerade nicht“ (kein Server-Fehler; die Fernbedienung drückt man auch in der Lobby). `skip-finale` wirkt nur im Kern: Die Trophäenzählung springt zum Siegerbildschirm.

`host-ready` (CHAOS-68): Ohne `deferSceneReady` ist der Host sofort bereit (Harness, Tests, `--selftest`). Die App setzt es und ruft `sceneReady()`, sobald die Kulisse des Standardbretts (`bretter/wackelwald/brett.usdz`), die Instanzen und die Figuren geladen sind; bis dahin ist „Partie starten“ gesperrt.

`setTimeout`, `performance`, `structuredClone` und `crypto` gibt es in JavaScriptCore nicht: Das Bündel polyfillt sie aus `tick` und `env.randomBytes`. Nach jedem Aufruf aus Swift laufen die Mikrotasks des Kontexts leer (JSC-Verhalten, auf das sich der Kern verlässt).

## renderState (JSON)

```jsonc
{
  "phase": "lobby" | "board" | "minigame" | "final" | "paused",
  "lobby": { "joinUrl": "…", "joinCode": "AB12",
             "players": [{ "slot": 1, "name": "Anna", "color": "#0072B2", "connected": true, "ready": false, "character": "raccoon" | null }],
             "settings": null | { "rounds": 10, "roundPresets": [10, 16, 20], "moreReactionTime": false,  // CHAOS-166
                                  "board": "wackelwald",  // Brett-ID oder "zufall" (CHAOS-197)
                                  "boards": [ { "id": "wackelwald", "name": "Wackelwald", "detail": "43 Felder",
                                                "selected": true, "random": false },
                                              { "id": "zufall", "name": "Zufall", "detail": "Überraschung!",
                                                "selected": false, "random": true } ] } },
  "board": null | {
    "round": 1, "rounds": 10, "activeSlot": 1 | null,
    "spaces": [{ "id": "s01", "x": 0, "z": 0, "kind": "start" | "coins-plus" | "coins-minus" | "event" | "item" | "trophy" }],
    "pawns": [{ "slot": 1, "spaceId": "s03", "x": 1.2, "z": -3.4, "character": "raccoon",
                "y": 0.4, "hop": null | { "from": "s03", "to": "s04", "t": 0.5, "style": "walk" | "gust" | "swap" },
                "heading": null | 1.57, "connected": true }],                   // Lage aus der Brett-Regie (CHAOS-143)
    "messages": ["Anna würfelt eine 4."],                                // höchstens 6, älteste zuerst
    "notice": null | { "title": "Sabotage wird stärker!", "detail": "Klau: 6 Münzen · Falle: 5 Münzen" }
                                                                         // große Einblendung, 4 s (CHAOS-157)
    // Brett-Regie (CHAOS-143), aus director.getFrame()/getHud() im JS-Kern:
    "popups": [{ "id": 12, "kind": "coins" | "dice" | "item" | "trap" | "trophy" | "event" | "shield" | "steal",
                 "slot": 1 | null, "spaceId": null | "s05", "text": "+3", "tone": "good" | "bad" | "neutral" | "gold",
                 "progress": 0.3, "stack": 0, "reaction": null | "cheer" | "hit" | "jump" }],
                                                                         // stack: Stapelebene gleichzeitiger Popups über derselben Stelle, je 1,4 entlang Kamera-oben (CHAOS-189)
    "ticker": [{ "id": 7, "text": "Anna bekommt 3 Münzen", "slot": 1 | null, "tone": "good" }],   // höchstens 4, je 5 s
    "hud": null | { "boardName": "Wackelwald", "roundText": "Runde 3/10", "banner": null | "Ben ist dran!", "bannerSlot": 2,
                    "status": null | { "slot": 2, "kind": "roll", "text": "Ben darf würfeln …", "detail": null, "countdown": null | "3 … 2 … 1" },
                    "players": [{ "slot": 1, "name": "Anna", "color": "#0072B2", "coins": 12, "trophies": 1,
                                  "items": [{ "id": "shield", "name": "Schild" }], "connected": true, "active": false }],
                    "tailwind": null | { "lead": "…", "rows": [{ "slot": 2, "name": "Ben", "amount": "+4 Münzen" }] } },
    "camera": { "pos": [3.9, 26.7, -14.3], "target": [3.9, 0, 2.4] },  // Pose der Kamera-Regie (camera.ts), Swift setzt sie
    "trophySpaces": ["s12"], "traps": [{ "spaceId": "s15", "owner": 2 }],
    "sounds": [{ "id": 3, "name": "dice", "voices": [{ "wave": "noise", "freq": 0, "attack": 0.002, "duration": 0.04, "gain": 0.26,
                                                       "filter": { "type": "bandpass", "freq": 1900, "q": 2 } }] }],
    "light": { "mood": "mittag", "keyIntensity": 3.4, "keyTint": "#fffaf0", "keyElevation": 0.7,  // CHAOS-193
               "skyIntensity": 1, "fillIntensity": 0.35, "fillSky": "#d4e6f4", "fillGround": "#7d8a52",
               "environment": { "mood": "mittag", "sky": "#d4e6f4", "ground": "#7d8a52", "skyIntensity": 1, "fillIntensity": 0.35 },
               "haze": "#d4e6f4", "exposure": 1.3, "lampsOn": 0, "lanternColor": "#ff9c4a", "lanternIntensity": 0,
               "lanternRange": 0, "grassTip": "#acd462" }
  },
  "minigame": null | {
    "id": "pudding-gerangel", "stage": "intro" | "play" | "results", "elapsedMs": 1234,
    "bodies": [{ "id": "kirsche#57", "shape": "sphere" | "box" | "cylinder",
                 "pos": [0, 0, 0], "rot": [0, 0, 0, 1], "size": [1, 1, 1], "color": "#D7263D",
                 // CHAOS-144, alle optional:
                 "mesh": "g12", "role": "kirsche", "key": "2", "alpha": 0.4, "glow": "#3A0B11",
                 "finish": "matt" | "glanz" | "metall" | "stoff", "twoSided": true }],
    "hud": "48 s · Anna 3 · Ben 1",                                      // Kurzfassung (Debug)
    "ready": true, "round": 3, "repeat": false, "countdown": 7 | null,
    // CHAOS-214, optional: Intro wartet auf „Bereit“ (dann "countdown": null)
    "readiness": null | { "headline": "Alle bereit? Drückt „Bereit!“ auf dem Handy",
                          "players": [{ "slot": 1, "name": "Anna", "character": "Wusel", "color": "#0072B2", "symbol": "●",
                                        "ready": true, "connected": true, "state": "ready" | "waiting" | "disconnected",
                                        "text": "Bereit" | "Drückt Bereit …" | "getrennt" }] },
    "info": { "title": "…", "tagline": "…", "instructions": ["…"], "controls": { "joystick": "Laufen", "a": "Schubsen", "b": null }, "scoreUnit": "Punkte" },
    "camera": null | { "pos": [0, 11.5, -13.5], "target": [0, -1.3, 0.8], "fov": 0.8, "fovAxis": "vertical" | "horizontal" },
    "backdrop": null | { "halfX": 7.2, "halfZ": 7.2, "groundY": -3.3, "surface": "wiese" | "decke" },
    "figures": [{ "slot": 1, "character": "raccoon", "pos": [0, 0, 0], "rot": [0, 0, 0, 1], "scale": [1, 1, 1],
                  "visible": true, "anim": "run", "animSeq": 4 }],
    "scoreboard": null | { "seconds": 48, "banner": "…" | null, "waiting": false,
                           "scores": [{ "slot": 1, "name": "Anna", "character": "Wusel", "color": "#0072B2", "symbol": "●",
                                        "score": 3, "status": null, "connected": true }] },
    "results": null | { "aborted": false, "headline": "Anna gewinnt!", "highlights": ["…"],
                        "rows": [{ "slot": 1, "name": "Anna", "character": "Wusel", "color": "#0072B2", "symbol": "●",
                                   "place": 1, "tied": false, "scoreText": "5 Punkte", "coins": 10, "prizes": ["Schild"] }] },
    "effects": [{ "seq": 7, "kind": "impact" | "sparkle" | "confetti" | … | "shake", "pos": [0, 0, 0], "color": null, "strength": 1 }],
    "geometry": [{ "id": "g12", "vertices": 482, "positions": "<base64>", "normals": "<base64>", "indices": "<base64>",
                   "wideIndices": false, "extent": [1, 0.5, 1] }],
    "geometryTotal": 43,
    "sounds": [{ "id": 41, "name": "hit", "voices": [{ "wave": "sine", "freq": 190, "freqEnd": 70, "attack": 0.004, "duration": 0.16,
                                                       "gain": 0.2 }] }],
    "light": { … }                                                      // wie board.light, Stimmung der Runde (CHAOS-193)
  },
  "final": null | {                                                      // nur in der Phase final (CHAOS-145)
    "beat": "intro" | "reveal" | "tiebreak" | "winner", "beatIndex": 3, "progress": 0.62, "done": false,
    "elapsedMs": 9536, "winnerAtMs": 16600, "endedEarly": false,
    "kicker": "Spielende", "title": "Die Trophäenzählung!", "lead": "Platz 2: Cleo",
    "cards": [{ "slot": 3, "name": "Cleo", "character": "robot", "characterName": "Schraubi", "color": "#009E73", "symbol": "■",
                "place": 2, "badge": "per Münzen" | null, "revealed": true, "active": true, "trophies": 2, "coins": 1, "placeShown": false }],
    "winner": { "headline": "Ben gewinnt!", "reason": null | "Gleich viele Trophäen – …", "earlyNote": null | "Vorzeitig beendet – …",
                "ranking": [{ "slot": 2, "name": "Ben", "character": "sock", "characterName": "Socke Sigi", "color": "#E69F00", "symbol": "▲",
                              "place": 1, "badge": null, "trophies": 2, "coins": 14 }],
                "awards": [{ "id": "coin-magnet", "title": "Münzmagnet", "detail": "31 Münzen eingesammelt", "slots": [4], "names": "Dana" }] },
    "podium": [{ "slot": 2, "character": "sock", "color": "#E69F00", "symbol": "▲", "place": 1, "x": 1.125, "height": 1.5,
                 "blockColor": "#ffd75e", "anim": "cheer" | "sad" | "jump" }],
    "canRematch": false, "sounds": [ /* wie board.sounds, eigene IDs je Finale */ ]
  },
  "pause": { "paused": false, "canPause": true, "roundText": null | "Runde 3/10", "sounds": [ /* pause/resume, IDs über die Laufzeit */ ] }
}
```

- `lobby.settings` (CHAOS-166) ist der Server-Stand der Lobby-Einstellungen für die nächste Partie: Rundenzahl, Vorschläge für die Rundenwahl (aufsteigend) und „Mehr Zeit zum Reagieren“ (CHAOS-124, Reaktionsfenster 5 s statt 3 s). `null` nur, bis die Host-Rolle ihre erste `lobby`-Nachricht hat (in der Praxis schon nach `create`). Ändern über `hostCommand('configure:…')`.
- **Brett-Regie (CHAOS-143):** `round`, `activeSlot`, `messages` und `notice` folgen dem neuesten Stand (wie bisher). Alles andere zeigt den Stand, den die Regie gerade spielt (`apps/host/src/board/director.ts`, unverändert, in `src/boardDirection.ts`): `pawns` (Lage auf der Hüpf- bzw. Flugbahn, `heading` in Babylon-Konvention, RealityKit: negieren), `popups`, `ticker`, `hud` (Texte aus `texts.ts`, Münzen schon um gespielte Ereignisse aktualisiert), `camera`, `trophySpaces`, `traps`. Während eines Minispiels steht die Regie; danach holt sie ohne Animation auf.
- `board.sounds`: Klänge der letzten 1,5 s mit steigender `id` je Partie (neue Partie: ab 1). Swift spielt jede ID einmal und setzt den Zähler in der Lobby zurück. `voices` ist das Rezept aus `apps/host/src/fx/sounds.ts` mit Lautstärke und Tonhöhe angewandt. Seit CHAOS-223 trägt jeder Klang optional `sample` (`{ file, rate, gain }`): die Klang-Datei unter `payload/sounds/` (CC0, Wahl wie im Browser-Host über `apps/host/src/fx/samples.ts`), Abspiel-Rate (Tonhöhe samt Streuung) und Lautstärke 0…2. Swift spielt die Datei; fehlt `sample` oder die Datei, spielt es das Rezept.
- `board.notice` kommt aus `eventNotice` (`apps/host/src/board/texts.ts`): bisher nur in Wachstumsrunden der Sabotage (`round-started` mit `sabotage`), bei `sabotageGrowthRounds: 0` nie. Der Kern hält sie 4 s (`src/notice.ts`); Swift zeigt sie nur in der Phase `board`.
- **Lichtstimmung (CHAOS-193):** `board.light` und `minigame.light` sind der `LightState` des Browser-Hosts (`apps/host/src/lighting/transition.ts`) aus `LIGHT_MOODS`, gerechnet in `src/lightMood.ts`. Das Brett folgt der gezeigten Runde der Regie: der erste Stand gilt sofort, jeder spätere Rundenwechsel blendet über 4 s über (`MOOD_TRANSITION_MS`); während eines Minispiels steht die Überblendung. Minispiele erben die Stimmung ihrer Runde (`moodForRound`), ohne Überblendung. `environment` nennt die Stimmung, deren Himmelslicht gerade gilt (Wechsel zur Hälfte der Überblendung wie das HDRI), mit ihren reinen Farben und Stärken; Swift baut es je Stimmung einmal (`app/SceneLight.swift`). Farben sRGB, Intensitäten in Babylon-Einheiten. In der Lobby gibt es kein `board` und damit keine Stimmung (Swift zeigt das Licht des Exports).
- `phase` ist `lobby`, solange die Session nicht im Brettspiel ist (auch die M1-Arena erscheint als `lobby`). `paused` hat Vorrang vor `minigame` und `final`.
- Koordinaten roh aus Babylon/game-core (linkshändig). Pawns: Feldmitte plus Versatz bei mehreren Figuren auf einem Feld.
- Körper: `pos` = Weltmitte der Bounding-Box, `rot` = Weltrotation (x, y, z, w), `size` = lokale Ausdehnung × Skalierung (vor der Rotation). `shape` wird aus den Eckpunkten geschätzt (Kugel / Zylinder inkl. Scheibe, Kapsel und Torus / sonst Quader). `color` ist `diffuseColor` bzw. `albedoColor`. Unsichtbare und deaktivierte Meshes fehlen; Thin Instances werden nicht einzeln ausgegeben. Figuren (`markVisual`-Rolle `figur`) fehlen in `bodies`; sie kommen als `figures`.

### Minispiel-Darstellung (CHAOS-144)

- **Geometrie statt Grundform:** Die Minispiele bauen ihre Requisiten aus Babylon-Meshes. Der Kern schickt deren echte Geometrie einmal je Minispiel (`src/geometry.ts`): dedupliziert (gleiche Vertexdaten = ein Eintrag), um die Mitte der lokalen Bounding-Box verschoben, als Base64 der rohen Bytes (Float32-Positionen, Int8-Normalen ÷ 127, Uint16- bzw. Uint32-Indizes, little-endian). `geometry` enthält nur, was seit dem letzten `renderState` fertig kodiert ist (höchstens ≈ 256 KB und 2 ms Kodierzeit je Aufruf); jeder Eintrag kommt genau einmal. Ein Körper mit `mesh` wird mit Skalierung `size / extent` je Achse gezeichnet (Achse ohne Ausdehnung: 1); fehlt die Geometrie noch, zeichnet Swift `shape`. Swift spiegelt z an Positionen und Normalen; Babylons Vorderseiten (im Uhrzeigersinn) werden dadurch zu RealityKits Vorderseiten, die Indizes bleiben.
- **Rollen:** `role`/`key` aus `markVisual` (CHAOS-149), fehlt = Kulisse. Swift kann einzelne Rollen später durch eigene Modelle oder Effekte ersetzen; heute zeichnet es jede Rolle mit ihrer Geometrie.
- **Material:** `color` und `alpha` (Material × Sichtbarkeit) je Bild, `glow` = Eigenleuchten, `finish` aus `look.material` (Rauheit wie der Look des Browser-Hosts), `twoSided` = `backFaceCulling = false`.
- **Look:** Die Bühne gibt dem Minispiel wie der Browser-Host einen `look` (gleicher Code-Pfad, kein eigenes Licht, kein Boden bis zum Horizont). `backdrop` ist die Spielfläche aus `look.backdrop`; die Kulisse drumherum (Wiese, Picknickdecke, Bäume, Steine, Blumen, Grashalme, Laternen, Dunst und Himmelskuppel) baut Swift, Licht und Dunst nach `light` (CHAOS-193).
- **Figuren:** Wurzelknoten (Füße) mit Lage, Rotation und Skalierung; `anim` ist die zuletzt gespielte Animation, `animSeq` zählt jedes `play` (Einmal-Clips wie `hit` erneut abspielen). Im Ergebnis jubelt Platz 1, die anderen schmollen (wie `celebrate` im Browser-Host).
- **Kamera:** `scene.activeCamera` je Bild (Position, Ziel, Öffnungswinkel in Radiant).
- **Effekte:** `ctx.fx.burst`/`shake` als nummerierte Ereignisse der letzten 1,5 s; Swift spielt jede `seq` einmal.
- **Klänge (CHAOS-190):** `sounds` wie `board.sounds` (Rezept aus `apps/host/src/fx/sounds.ts` mit Lautstärke und Tonhöhe angewandt), Klänge der letzten 1,5 s, höchstens 48. Die `id` steigt über die ganze Lebenszeit des Kerns (nicht je Minispiel, sonst bliebe eine Revanche stumm); Swift spielt jede ID einmal und setzt den Zähler zurück, wenn ein anderes Minispiel erscheint. Jeder Klang gehört zu dem Minispiel, das ihn ausgelöst hat. Quellen wie im Browser-Host (`src/minigameSounds.ts`):

  | Klang | Wann | Browser-Host |
  | --- | --- | --- |
  | `minigame-start` | Minispiel erscheint in der Anleitung (nicht, wenn es erst im Spiel auftaucht) | `MinigameScreen` beim Erscheinen |
  | `tick` | Countdown der Anleitung bei 3, 2 und 1 s, bei 1 s Tonhöhe × 1,25; in der Pause steht er; nicht, wenn die Anleitung auf „Bereit“ wartet (CHAOS-214) | `MinigameScreen`, Effekt auf `introSeconds` |
  | `go`, `win` und alle Klänge des Spiels | `ctx.fx.sound` des Minispiels (gleicher Code: Start, Treffer, Punkte, Ende) | `fx/minigameFx.ts` |
  | `cheer` | Ergebnis, einmal, wenn die Figuren jubeln | `stage.celebrate` |

  Klänge der Minispiele über `ctx.fx.sound` (Stand CHAOS-190; Lautstärke/Tonhöhe in Klammern): Sockenregen `go`, `whoosh` (0,6; Bügeleisen 0,35/0,7), `bump`, `score`, `coin` (Tonhöhe steigt), `hit`, `pop`, `buzz`, `win` · Pudding-Gerangel `go`, `coin` (0,35, je Slot), `hit` (0,5), `whoosh` (0,6 bzw. 0,4/1,3), `bump` (zufällige Tonhöhe), `splash`, `pop`, `win` · Wackelturm `go`, `pop` (Tonhöhe nach Höhe), `coin`, `whoosh` (auch 1,2), `cheer`/`score` (Bonus), `hit`/`fall`, `bump`, `buzz` (0,5), `win` · Kuckucks-Klatsche `go`, `tick` (0,25/1,3), `pop`, `buzz` (0,45/1,5 und 1), `hit` (0,7), `coin`, `whoosh` (0,7 und 0,3/0,7), `score` (0,8), `lose` (0,6), `bump` (0,4/0,8), `win` · Krümel-Kehraus `go`, `pop` (1,4 und 0,35/1,1), `whoosh` (0,8/0,8 und 0,4/1,3), `bump` (0,5/0,7 und zufällig), `coin`/`score`, `win`. Der Kern ruft dieselben Module auf, also sind es dieselben Aufrufe; `test/minigameSounds.test.ts` prüft je Minispiel der Rotation `go`, `win` und `cheer`, `harness/run.sh full` zählt sie in JavaScriptCore.
- **Bildschirme:** `info`, `countdown` (Intro), `scoreboard` (Spiel), `results` (Ergebnis mit Münzen und Trostpreis) kommen aus denselben Funktionen wie im Browser-Host (`plan.ts`, `results.ts`, `texts.ts`); `repeat` = kurze Anleitung (CHAOS-66).
- **Bereitschaft (CHAOS-214):** Wartet die Anleitung darauf, dass alle verbundenen Spieler auf dem Handy „Bereit!“ drücken (`BoardView.minigame.ready`), kommt `readiness` (`introReadiness` aus `apps/host/src/minigame/readiness.ts`) und `countdown` ist `null`: `remainingMs` ist dann nur Mindestzeit (3 s) bzw. Sicherheitsfrist (60 s), kein Countdown. Swift zeigt statt „Los in“ die Überschrift und je Spieler einen Chip (Häkchen + „Bereit“, „Drückt Bereit …“ oder „getrennt“; getrennte zählen beim Server als bereit). Fehlt `readiness` oder ist `null`, gilt der feste Countdown wie bisher. Die Bühne gilt in dieser Anleitung von Anfang an als knapp (`stageUrgentFor`, ADR-012 Nachtrag 3), weil sie schon nach 3 s enden kann.

### Finale und Pause (CHAOS-145)

- **Finale:** `final` gibt es nur in der Phase `final`. Der Ablauf ist `finalePlan.ts` des Browser-Hosts als Zeitfunktion im Kern (`src/finaleView.ts`), ab dem ersten Endstand: Intro, Aufdecken vom letzten zum ersten Platz (Karten zählen Trophäen und Münzen hoch, dann der Platz als Stempel), bei Gleichstand vorher die Ansage (`tiebreak`), zuletzt der Siegerbildschirm (`done`, bleibt bis zur Revanche). Texte, Begründung, Bonus-Titel (höchstens drei) und Podest-Aufstellung (`podiumLayout.ts`) kommen fertig; Swift zeichnet nur. `podium` steht schon während der Zählung, damit Swift das Podest unsichtbar vorbauen kann. `canRematch` erst am Siegerbildschirm und mit verbundener Host-Rolle.
- **Pause:** `pause` ist immer da. `paused` ist der Server-Stand (`view.paused`); dann ist `phase` `paused`, `board` und `minigame` bleiben gefüllt (Pause über dem Minispiel: `minigame` gesetzt, sonst Brett). `canPause` sagt, ob `hostCommand('pause')` gerade wirkt. Während einer Minispiel-Pause steht die Brett-Regie wie während des Minispiels.
- **Klänge:** `final.sounds` (`finaleCues`: `turn`, `trophy`, `coin`, `pop`, `win`, `cheer`) und `pause.sounds` (`pause`, `resume`) wie `board.sounds`: Rezept fertig, 1,5 s im `renderState`, Swift spielt jede ID einmal (je eigenes `BoardSounds`).
