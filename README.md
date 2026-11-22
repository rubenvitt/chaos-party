# Chaos Party

Chaotisches 3D-Party-Brettspiel für 2–4 Personen im selben Raum. Das Spiel läuft auf dem PC; iPhones bzw. ein geteiltes iPad dienen per Browser als Controller.

## So wird gespielt

```bash
pnpm play
```

Das ist der eine Befehl (Windows, macOS, Linux). Er prüft Node.js und pnpm, installiert beim ersten Mal die Abhängigkeiten, baut das Spiel nur, wenn der Build fehlt oder veraltet ist, startet den Server und öffnet das Spiel am PC im Browser (`http://localhost:8787/host/`). Das Terminal zeigt Join-Code, QR-Code und den Link für die Handys. **Strg+C** beendet den Server.

**Frischer PC – einmalig:**

1. [Node.js 24 LTS](https://nodejs.org) installieren (mindestens 22.12).
2. pnpm aktivieren: `corepack enable` (Corepack gehört zu Node.js 24 und liefert genau die pnpm-Version aus `package.json`; unter Windows ggf. in einer Konsole als Administrator).
3. Repository klonen und im Ordner `pnpm play` ausführen. Der erste Start braucht Internet für `pnpm install`, danach läuft alles offline im lokalen Netz.

Beim ersten Start fragt die Firewall eventuell, ob Node.js Verbindungen annehmen darf: für **private Netzwerke erlauben** ([network-setup.md](docs/network-setup.md)).

| Variante | macOS/Linux | Windows PowerShell |
|---|---|---|
| ohne Browser öffnen | `OPEN=0 pnpm play` oder `pnpm play --no-open` | `$env:OPEN="0"; pnpm play` |
| anderer Port | `PORT=8790 pnpm play` | `$env:PORT="8790"; pnpm play` |
| feste Adresse im QR-Code | `PUBLIC_HOST=192.168.178.42 pnpm play` | `$env:PUBLIC_HOST="192.168.178.42"; pnpm play` |
| Neubau erzwingen | `pnpm play --rebuild` | `pnpm play --rebuild` |

Alle Server-Variablen (`PORT`, `HOST`, `JOIN_CODE`, `PUBLIC_HOST`, `PUBLIC_PORT`, `TERMINAL_QR`, `ROUNDS`, `SEED`, `RUECKENWIND`, `SCHNELLFEUER`, `BRETT`, `STIMMEN_DATEI`) werden durchgereicht; `pnpm play --help` listet sie.

**Weiter lesen:**

- [docs/m4-demo.md](docs/m4-demo.md) – eine komplette Partie (Lobby, Figuren, Brett, Minispiele, Pause, Finale, Revanche)
- [docs/known-issues.md](docs/known-issues.md) – bekannte Probleme und Grenzen des Release Candidate
- [docs/security-license-review.md](docs/security-license-review.md) – Sicherheits- und Lizenzprüfung
- [docs/device-test-checklist.md](docs/device-test-checklist.md) – Prüfliste für echte iPhones/iPads und den PC
- `pnpm perf` – Messläufe für Bildrate und Speicher ([docs/performance.md](docs/performance.md))

## Entwicklung

### Voraussetzungen

- Node.js **24** (siehe `.nvmrc`; mindestens 22.12)
- pnpm **10** – am einfachsten über Corepack: `corepack enable` (die Version steht in `package.json` → `packageManager`)

### Einrichten

```bash
pnpm install
pnpm dev
```

`pnpm dev` startet alle drei Apps parallel:

| App | Pfad | Adresse | Zweck |
|---|---|---|---|
| Host | `apps/host` | http://localhost:5173/host/ | Das Spiel auf dem PC (Babylon.js + React); `/ws` wird an den Server weitergeleitet |
| Controller | `apps/controller` | http://localhost:5174 | Controller für iPhone/iPad (Vite zeigt zusätzlich die LAN-Adresse an; `?code=…`, iPad: `&seats=2`) |
| Server | `apps/server` | http://localhost:8787 | Session-Server mit WebSocket `/ws`; `GET /health` |

**Production-Build:** `pnpm play` (siehe oben) oder von Hand `pnpm build && pnpm start`. Ein Prozess auf Port 8787 liefert den Host unter http://localhost:8787/host/, den Controller unter `/` und den WebSocket unter `/ws`. Das Terminal zeigt den LAN-Link mit Join-Code und QR-Code. Umgebungsvariablen: `PORT`, `HOST`, `JOIN_CODE` (fester Code), `PUBLIC_HOST`/`PUBLIC_PORT` (Adresse im QR erzwingen), `TERMINAL_QR=0`. Netzwerkprobleme: [docs/network-setup.md](docs/network-setup.md).

**Host-Szene allein ausprobieren** (ohne Handys und ohne Server): `/host/?local=1` öffnen. Steuerung per Tastatur – Spieler 1 WASD + Leertaste (Schubser), Spieler 2 Pfeiltasten + Enter, Spieler 3 IJKL + O, Spieler 4 Ziffernblock 8/4/5/6 + 0. URL-Parameter: `?players=1–4` (Standard 2), `?seed=` (Standard 2026), `?test=1` für den deterministischen Testmodus (Details in [ADR-004](docs/decisions/ADR-004-host-szene.md)).

### Prüfungen (Quality Gates)

| Befehl | Prüft |
|---|---|
| `pnpm typecheck` | TypeScript strict in allen Paketen |
| `pnpm lint` | ESLint (typbasiert), keine Warnungen erlaubt |
| `pnpm format:check` | Prettier (`pnpm format` korrigiert) |
| `pnpm test` | Vitest über alle Pakete (`pnpm test:watch` im Watch-Modus) |
| `pnpm build` | Production-Build von Host, Controller und Server |
| `pnpm check:licenses` | Lizenzen der Laufzeit-Abhängigkeiten gegen Positivliste |
| `pnpm check:assets` | Asset-Manifest: Dateien, Lizenzen, Budgets, Figuren-Vertrag |
| `pnpm check` | alles oben in dieser Reihenfolge |
| `pnpm smoke` | Rauchtest für `pnpm play`: startet wie ein Spieler (ohne Browser, freier Port), prüft `/health`, Host- und Controller-App samt verlinkter Dateien, einen WebSocket-Beitritt und das saubere Beenden. Nach `pnpm build` wenige Sekunden |
| `pnpm perf` | Messläufe je Szene im Headless-Chromium ([docs/performance.md](docs/performance.md)) |
| `pnpm test:e2e` | Playwright (Chromium) gegen die Production-Builds und den echten Node-Server: Host-Szene und Havok, Lobby/QR, iPhone- und iPad-Controller (Emulation, synthetisches Multitouch), Reconnect, Screenshot-Vergleiche. Separat, weil langsamer. Browser einmalig: `pnpm exec playwright install chromium`. Details: [docs/testing.md](docs/testing.md) |

Dieselben Schritte laufen in CI (`.github/workflows/ci.yml`) nach `pnpm install --frozen-lockfile`, danach `pnpm test:e2e`. Screenshot-Baselines liegen unter `tests/e2e/__screenshots__/` (nur Linux); nach gewollten Optikänderungen mit `pnpm test:e2e --update-snapshots` neu erzeugen.

### Aufbau

```text
apps/
  host/         PC-Spiel: Babylon.js/Havok-Szene (src/scene), React-HUD, Eingabequellen (src/input)
  controller/   Browser-Controller für iPhone und geteiltes iPad (Vite + React; src/net, src/state, src/zones)
  server/       Node-Server: Session (Join-Code, Slots, Tokens, Reconnect), WebSocket, LAN-Adresswahl, Auslieferung
packages/
  protocol/     Typisierte, versionierte Nachrichten mit zod-Validierung
  game-core/    Reine Spielregeln: Seeded RNG, Zustandsmaschine, Wertung
  minigame-sdk/ Minispiel-Vertrag: Typen, Wertung, Ergebnisprüfung, Babylon-Laufzeit, Headless-Testharness
  minigames/    Die Minispiele (je Ordner eines); `./catalog` als reine Steckbriefe für Server/Controller
  assets/       Figuren (GLB), Porträts, Manifest mit Herkunft/Lizenz/Budget, Prüfskript
  metrics/      Messhelfer (Ringpuffer, Median/p95) für die Debug-Anzeigen
scripts/        pnpm play / pnpm smoke, Lizenzprüfung, Look-Dev-Helfer
tests/
  e2e/          Playwright-Tests (Konfiguration: playwright.config.ts)
  perf/         Messläufe für pnpm perf (playwright.perf.config.ts)
```

Interne Pakete werden als TypeScript-Quelle importiert (z. B. `@chaos-party/protocol`, `@chaos-party/game-core`), ohne eigenen Build. Begründung und Alternativen: [ADR-002](docs/decisions/ADR-002-workspace-tooling.md).

## Projektdokumente (Quelle der Wahrheit)

- [`VISION.md`](VISION.md) – Produktvision, Säulen, Umfang des Vertical Slice
- [`ARCHITECTURE.md`](ARCHITECTURE.md) – Zielarchitektur, Stack, Protokoll, Tests
- [`ROADMAP.md`](ROADMAP.md) – Meilensteine M1–M4 mit Abnahme-Gates
- [`CLAUDE.md`](CLAUDE.md) – Arbeitsanweisungen für Claude Code

## Arbeitsartefakte (`docs/`)

- [`docs/progress.md`](docs/progress.md) – Meilensteinstand, geprüfte Befehle, nächste Schritte
- [`docs/assumptions.md`](docs/assumptions.md) – zu validierende Annahmen mit Validierungsweg
- [`docs/decisions/`](docs/decisions/README.md) – Architekturentscheidungen (ADRs)
- [`docs/experiments.md`](docs/experiments.md) – Experiment-Log
- [`docs/m1-demo.md`](docs/m1-demo.md) – M1 auf echten Geräten ausprobieren
- [`docs/m2-demo.md`](docs/m2-demo.md) – M2-Brettspiel ausprobieren
- [`docs/m3-demo.md`](docs/m3-demo.md) – M3-Minispiele ausprobieren
- [`docs/m4-demo.md`](docs/m4-demo.md) – komplette Partie (M4)
- [`docs/known-issues.md`](docs/known-issues.md) – bekannte Probleme und Grenzen
- [`docs/security-license-review.md`](docs/security-license-review.md) – Sicherheits- und Lizenzprüfung
- [`docs/performance.md`](docs/performance.md) – Bildrate, Latenz, `pnpm perf`
- [`docs/device-test-checklist.md`](docs/device-test-checklist.md) – Gerätecheckliste für die Abnahme
- [`docs/network-setup.md`](docs/network-setup.md) – Firewall, WLAN, Adresswahl
- [`docs/ipad-zonen.md`](docs/ipad-zonen.md) – geteiltes iPad: Layouts und Grenzen

Aufgaben werden in Zunder im Projekt **Chaos Party** (Kennung `CHAOS-…`) geführt.

## Arbeitsweise mit Claude Code

Claude Code arbeitet die Zunder-Aufgaben Meilenstein für Meilenstein ab; jeder Meilenstein endet mit einer menschlichen Abnahme. Regeln stehen in `CLAUDE.md` („Task management with Zunder“), die Abläufe als Projekt-Skills in `.claude/skills/`:

| Skill | Zweck |
|---|---|
| `aufgabe-umsetzen` | `CHAOS-…`-Aufgabe oder die nächste freie Aufgabe umsetzen |
| `meilenstein-abnahme` | Abnahme vorbereiten, Entscheidung eintragen |
| `experiment-protokollieren` | Varianten-Vergleiche nach Experiment-Protokoll festhalten |
| `blocker-eskalieren` | Nach drei Fehlversuchen oder bei Freigabebedarf sauber eskalieren |

## Lizenz

Chaos Party ist Open Source unter der **GNU General Public License v3.0** (`GPL-3.0-only`, Text in [`LICENSE`](LICENSE)). Das gilt für den Code und für die eigenen Assets (Figuren, Porträts, prozedurale Inhalte). Mitgelieferte Drittsoftware behält ihre eigene Lizenz (Babylon.js: Apache-2.0; Havok, React, ws, zod, uqr: MIT; Schriften Nunito und Inter: OFL-1.1).

`pnpm build` legt in jedes `apps/*/dist` eine `LICENSE.txt` und eine `THIRD-PARTY-NOTICES.txt` mit allen Lizenztexten; `pnpm check:licenses` prüft, dass sie aktuell sind. Wer einen Build weitergibt, gibt beide Dateien mit und nennt den Quellcode (GPL). Hintergrund: [ADR-018](docs/decisions/ADR-018-lizenz.md).
