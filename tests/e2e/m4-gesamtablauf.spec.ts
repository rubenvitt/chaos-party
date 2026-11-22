/**
 * M4-Gesamtablauf (CHAOS-41, CHAOS-38): eine komplette Partie mit echten Seiten am echten
 * Server – Lobby → Beitritt über den Link aus dem QR-Code → Charakterwahl → Runden mit Brett
 * und Minispielen → Pause → Trophäenzählung → Siegerbildschirm → Endstand auf den Controllern
 * → „Nochmal spielen“ → alle wieder in der Lobby mit ihrer Figur.
 *
 * - **Alle Spieler-Eingaben über die echte Controller-UI** (iPhone-/iPad-Emulation in eigenen
 *   Browser-Kontexten): Figur antippen, „Bereit!“, Prompt-Knöpfe, im Minispiel Joystick ziehen
 *   und Knopf A tippen (echte Touch-Ereignisse per CDP). Keine synthetischen Protokollnachrichten.
 * - **Host über die echte PC-UI:** Gerätewahl iPhone/iPad, Rundenwahl, Start, Pause-Knopf,
 *   „Weiter“, „Nochmal spielen“.
 * - **Tempo (Testmodus, nur im Test):** Der Testserver bekommt ein schnelles Pacing
 *   ({@link TEST_PACING}), kurze Minispiele (6 s statt 30–35 s) und Rundenvorschläge 1/2/3
 *   statt 10/16/20 – alles über die Server-Optionen der Fixture, nicht über den Normalbetrieb.
 *   Der Host läuft mit `?test=1`: Brett-Regie (`board.advance`) und Minispiel-Bühne
 *   (`__chaosMinigame.step`) rechnen nur auf Zuruf, deterministisch und unabhängig von der
 *   Rechnerlast; `?finale=manual` lässt die Trophäenzählung über `__chaosFinale.advance`
 *   vorspulen (beschleunigt, aber jeder Abschnitt wird durchlaufen).
 * - Fester Seed (`E2E_GAME_SEED` = 2026 aus `fixtures/server.ts`); gewartet wird auf DOM-Zustände und Testhaken.
 *
 * Varianten: zwei iPhones mit zwei Runden (zwei verschiedene Minispiele, iPhone 2 lädt mitten in
 * Runde 2 neu) und gemischt zwei iPhones + iPad mit zwei Zonen in einer Runde (iPad lädt mitten
 * im Minispiel neu, beide Zonen spielen danach weiter).
 *
 * Was das **nicht** beweist: echtes iOS-/iPadOS-Safari und Multitouch, WLAN, Ton, Bildrate,
 * Lesbarkeit am Fernseher, Spaß – siehe `docs/device-test-checklist.md`, Abschnitt 12.
 */
import type { Locator, Page } from '@playwright/test';
import { withRules } from '../../packages/game-core/src/index.ts';
import { getMinigameInfo, rotationInfos } from '../../packages/minigames/src/catalog.ts';
import type { CharacterId, SlotNumber } from '../../packages/protocol/src/index.ts';
import type {} from '../../apps/host/src/finale/testHook.ts';
import type {} from '../../apps/host/src/minigame/testHook.ts';
import type {} from '../../apps/host/src/testHook.ts';
import { collectProblems, expectNoProblems, stepFrames } from './fixtures/pages.ts';
import { startChaosServer, type RunningServer } from './fixtures/server.ts';
import { expect, test as base } from './fixtures/test.ts';
import { centerOf, TouchScreen } from './fixtures/touch.ts';

/**
 * Schnelles Pacing für den Gesamtablauf. Reaktionsfenster und Schonfrist bleiben großzügig
 * (die Controller-Seiten antworten über die echte UI); die Frist für das Minispiel-Ergebnis ist
 * lang, weil der Host im Testmodus nur rechnet, wenn der Test `step` ruft.
 */
const TEST_PACING = {
  turnStartMs: 300,
  rollMs: 300,
  stepMs: 100,
  spaceEventMs: 400,
  turnEndMs: 200,
  minigameIntroMs: 3000,
  // Ergebnisanzeige 5 s statt 2 s (CHAOS-170): Der Test prüft die Ergebnisanzeige am Host, solange
  // sie steht; unter Last kam er in der Cloud-Sandbox mit 2 s zu spät (Bühne schon weg).
  minigameResultsMs: 5000,
  roundEndMs: 300,
  reactionWindowMs: 5000,
  disconnectGraceMs: 15_000,
  minigameResultGraceMs: 120_000,
} as const;

/** Spielzeit je Minispiel im Test (statt 30–35 s): 360 feste Schritte à 1/60 s. */
const TEST_PLAY_MS = 6000;
/** Dieselbe Spielzeit in festen Schritten à 1/60 s (reicht immer bis zum Ende). */
const TEST_PLAY_FRAMES = (TEST_PLAY_MS / 1000) * 60;
/** Rundenvorschläge der Test-Lobby (statt 10/16/20); Standard 3, gewählt wird per Klick. */
const TEST_ROUND_PRESETS = [1, 2, 3] as const;

const test = base.extend<{ chaosServer: RunningServer }>({
  chaosServer: async ({ chaosJoinCode }, use) => {
    const running = await startChaosServer({
      joinCode: chaosJoinCode,
      game: {
        rules: withRules({ pacing: TEST_PACING }),
        minigames: rotationInfos().map((info) => ({
          id: info.id,
          playMs: TEST_PLAY_MS,
          scoring: info.scoring,
        })),
        rounds: 3,
        roundPresets: TEST_ROUND_PRESETS,
      },
    });
    try {
      await use(running);
    } finally {
      await running.close();
    }
  },
});

const HOST_URL = '/host/?test=1&finale=manual';

/** Ein Spielerplatz: iPhone (`slot-<n>`) oder Zone eines geteilten iPads (`zone-<n>`). */
interface Seat {
  readonly slot: SlotNumber;
  readonly page: Page;
  readonly root: Locator;
  readonly character: CharacterId;
  readonly label: string;
  /**
   * `zone`: Die iPad-Zonen verteilen Finger selbst (Touch-Router über dem ganzen Bildschirm);
   * dort wird mit echten CDP-Touch-Ereignissen getippt statt mit `locator.tap()`.
   */
  readonly kind: 'phone' | 'zone';
}

function phoneSeat(page: Page, slot: SlotNumber, character: CharacterId): Seat {
  return {
    slot,
    page,
    root: page.getByTestId(`slot-${String(slot)}`),
    character,
    label: `iPhone ${String(slot)}`,
    kind: 'phone',
  };
}

function zoneSeat(page: Page, slot: SlotNumber, character: CharacterId): Seat {
  return {
    slot,
    page,
    root: page.getByTestId(`zone-${String(slot)}`),
    character,
    label: `iPad-Zone ${String(slot)}`,
    kind: 'zone',
  };
}

/** Texte, Glyphen und Zahlen maskiert (Schrift-Rendering je Rechner, ADR-004). */
const controllerMask = (page: Page) => [
  page.locator('.ui-text, .player-symbol, .ready-check, .character-check, .link-pill'),
];

const hostLobbyMask = (page: Page) => [
  page.locator(
    [
      '.lobby-card h2',
      '.lobby-lead',
      '.join-code',
      '.join-url',
      '.join-device-label',
      '.join-device-seats',
      '.lobby-player-label',
      '.lobby-player-state',
      '.lobby-free-text',
      '.lobby-rounds legend',
      '.lobby-rounds-option',
      '.lobby-toggle-text',
      '.player-symbol',
      '.lobby-free-symbol',
      '.start-button',
      '.start-hint',
      '.hud-title',
      '.hud-connection',
    ].join(', '),
  ),
  // Der QR-Code enthält den zufälligen Port des Testservers.
  page.getByTestId('join-qr'),
];

const finaleMask = (page: Page) => [
  page.locator(
    [
      '.finale-kicker',
      '.finale-title',
      '.finale-lead',
      '.finale-winner',
      '.finale-reason',
      '.finale-rank-who',
      '.finale-rank-place',
      '.finale-rank-values',
      '.finale-award',
      '.finale-rematch',
      '.finale-rematch-hint',
      '.finale-early',
      '.player-symbol',
    ].join(', '),
  ),
];

// ---------------------------------------------------------------------------------------------
// Host
// ---------------------------------------------------------------------------------------------

/** Liest den Join-Link aus der Lobby – genau das, was der QR-Code enthält. */
async function joinLinkFromLobby(host: Page, device: 'phone' | 'ipad'): Promise<string> {
  await host.getByTestId(`join-device-${device}`).click();
  await expect(host.getByTestId(`join-device-${device}`)).toHaveAttribute('aria-pressed', 'true');
  const link = await host.getByTestId('join-qr').getAttribute('data-value');
  if (!link) throw new Error('QR-Code ohne Link');
  return link;
}

/** Testmodus: Brett-Regie vorspulen (sie läuft nur auf Zuruf). */
async function advanceBoard(host: Page, ms: number) {
  await host.evaluate((step) => {
    window.__chaos?.board?.advance(step);
  }, ms);
}

/** Spielt alles Ausstehende der Brett-Regie ab (z. B. vor dem Endstand). */
async function settleBoard(host: Page) {
  // Der Server kann schon im Endstand sein, während der Host noch die Minispiel-Bühne zeigt
  // und das Brett erst neu aufbaut (Natur-Brett, Software-Rendering): erst auf das Brett warten.
  await host.waitForFunction(() => window.__chaos?.board?.ready === true);
  const idle = await host.evaluate(() => {
    const board = window.__chaos?.board;
    if (!board) return false;
    for (let t = 0; t < 30_000 && board.animating; t += 100) board.advance(100);
    return !board.animating;
  });
  expect(idle, 'Brett-Regie wird fertig').toBe(true);
}

/**
 * Podest: feste Zahl Bilder rendern und auf die GPU warten (`toDataURL` liest das Bild
 * zurück). Sonst rechnet SwiftShader beim Screenshot noch an den Bildern – bei zwei parallelen
 * Tests mit je mehreren Seiten dauert das sonst länger als das Screenshot-Zeitlimit.
 *
 * In Häppchen zu 10 Bildern, je ein eigener Aufruf: Ein Podest-Bild kostet unter Last
 * 0,25–0,5 s, 60 am Stück hielten den Hauptthread des Hosts 15–30 s fest. So lange hört der
 * Host keine Server-Nachricht; nach 30 s trennt ihn der Server (`hostSilenceMs`), und der
 * Klick auf „Nochmal spielen“ ging mitten in den Neuaufbau verloren (CI, CHAOS-41). Eine echte
 * Render-Schleife gibt den Thread nach jedem Bild frei; das Bild am Ende ist dasselbe
 * (fester Animationsschritt im Testmodus).
 */
async function renderPodium(host: Page) {
  for (let chunk = 0; chunk < 6; chunk++) {
    await host.evaluate(() => window.__chaosFinale?.stepPodium(10));
  }
  await host.evaluate(
    () => document.querySelector<HTMLCanvasElement>('.finale-podium canvas')?.toDataURL().length,
  );
}

/**
 * Zeitlimit, bis das 3D-Podest steht (`data-podium="ready"`). Der Aufbau übersetzt beim ersten
 * Bild alle Shader (Figuren, Schatten) – mit SwiftShader synchron und am Stück: gemessen
 * 0,5–8,7 s auf zwei Kernen mit zwei parallelen Tests, auf den langsameren CI-Kernen über
 * 15 s. Kein Hänger: Das Podest wird fertig, nur später (CHAOS-41).
 */
const PODIUM_TIMEOUT = 45_000;

declare global {
  interface Window {
    /** Vom Test eingehängt: wie oft je Platz (`slot-<n>`/`zone-<n>`) ein Minispiel-Ergebnis erschien. */
    __resultScreens?: Record<string, number>;
  }
}

/**
 * Zählt im Controller mit, wie oft je Platz die Ergebnisanzeige (Platz und Münzen) erscheint.
 * Die Ergebnisphase dauert im Test-Pacing 2 s; ein Handy unter Last ist danach womöglich schon
 * im Endstand, bevor eine Abfrage von außen ankommt. Gezählt wird beim Erscheinen im DOM
 * (sichtbar), geprüft wird danach (CHAOS-41).
 */
function recordResultScreens() {
  const counts: Record<string, number> = {};
  const shown = new Set<string>();
  window.__resultScreens = counts;
  const scan = () => {
    const now = new Set<string>();
    for (const root of document.querySelectorAll<HTMLElement>(
      '[data-testid^="slot-"], [data-testid^="zone-"]',
    )) {
      const id = root.dataset.testid ?? '';
      const place = root.querySelector<HTMLElement>('[data-testid="result-place"]');
      const reward = root.querySelector<HTMLElement>('[data-testid="result-reward"]');
      if (place?.checkVisibility() && reward?.checkVisibility()) now.add(id);
    }
    for (const id of now) if (!shown.has(id)) counts[id] = (counts[id] ?? 0) + 1;
    shown.clear();
    for (const id of now) shown.add(id);
  };
  new MutationObserver(scan).observe(document, {
    subtree: true,
    childList: true,
    attributes: true,
    characterData: true,
  });
}

async function resultScreens(seat: Seat): Promise<number> {
  const id = await seat.root.getAttribute('data-testid');
  return seat.page.evaluate((key) => window.__resultScreens?.[key ?? ''] ?? 0, id);
}

/** Großzügiges Zeitlimit für Host-Screenshots (Software-Rendering unter Last). */
const SCREENSHOT_TIMEOUT = 45_000;

function gameState(server: RunningServer) {
  return server.server.session.snapshot().game?.state;
}

// ---------------------------------------------------------------------------------------------
// Controller-Eingaben über die echte UI
// ---------------------------------------------------------------------------------------------

/**
 * Tippt die bevorzugte Option eines offenen Prompts (Würfeln, Kaufen, Festhalten, Abbrechen;
 * sonst die erste). Items führen in Ziel-/Reaktions-Prompts, die eigene Specs abdecken.
 */
async function answerPrompt(seat: Seat, touches: ReadonlyMap<Page, TouchScreen>): Promise<boolean> {
  // Auf die Knöpfe schauen, nicht auf den Prompt-Rahmen: In der iPad-Zone ist er ein reiner
  // Layout-Container ohne eigene Box (Playwright hielte ihn für unsichtbar).
  // iPhone: echte `<button>`, nach dem Senden `disabled`. iPad-Zone: Flächen ohne
  // `disabled`; gesperrt zeigt dort `data-locked` am Prompt.
  // CHAOS-214: In der Minispiel-Anleitung „Bereit!“ tippen (nach der kurzen Tippsperre).
  const ready = seat.root.locator('[data-testid="minigame-ready-button"][data-armed="true"]');
  if ((await ready.count()) > 0 && (await ready.isVisible())) {
    try {
      if (seat.kind === 'zone') {
        const touch = touches.get(seat.page);
        if (!touch) throw new Error(`${seat.label}: kein TouchScreen`);
        await touch.tap(await centerOf(ready), seat.slot);
      } else {
        await ready.tap({ timeout: 2000 });
      }
      return true;
    } catch {
      return false;
    }
  }
  const prompt =
    seat.kind === 'zone'
      ? seat.root.locator('[data-testid="prompt"][data-locked="false"]')
      : seat.root.getByTestId('prompt');
  const open =
    seat.kind === 'zone' ? '[data-testid^="choice-"]' : '[data-testid^="choice-"]:enabled';
  const choices = prompt.locator(open);
  if ((await choices.count()) === 0 || !(await choices.first().isVisible())) return false;
  let target = choices.first();
  for (const id of ['choice-roll', 'choice-buy', 'choice-brace', 'choice-cancel']) {
    const button = prompt.locator(`${open}[data-testid="${id}"]`);
    if ((await button.count()) > 0 && (await button.isVisible())) {
      target = button;
      break;
    }
  }
  try {
    if (seat.kind === 'zone') {
      const touch = touches.get(seat.page);
      if (!touch) throw new Error(`${seat.label}: kein TouchScreen`);
      await touch.tap(await centerOf(target), seat.slot);
      return true;
    }
    // Kurzes Limit: Der Prompt kann zwischen Prüfen und Tippen schon verschwunden sein.
    await target.tap({ timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}

/** Prompts beantworten und die Brett-Regie mitlaufen lassen, bis `done` erfüllt ist. */
async function playBoardUntil(
  host: Page,
  seats: readonly Seat[],
  touches: ReadonlyMap<Page, TouchScreen>,
  done: () => Promise<boolean> | boolean,
  what: string,
  hook?: () => Promise<void>,
) {
  const deadline = Date.now() + 90_000;
  while (!(await done())) {
    if (Date.now() > deadline) throw new Error(`Zeitüberschreitung: ${what}`);
    for (const seat of seats) await answerPrompt(seat, touches);
    await hook?.();
    await advanceBoard(host, 400);
    await host.waitForTimeout(100);
  }
}

async function hostMinigameStage(host: Page): Promise<string | null> {
  return host.evaluate(() => window.__chaosMinigame?.stage ?? null);
}

async function minigameInputs(host: Page, slot: SlotNumber): Promise<number> {
  return host.evaluate((s) => window.__chaosMinigame?.networkInputs?.[s] ?? 0, slot);
}

async function lastNetworkInput(host: Page, slot: SlotNumber) {
  return host.evaluate((s) => window.__chaosMinigame?.lastNetworkInputs?.[s] ?? null, slot);
}

/**
 * Minispiel über die Controller-UI spielen: Alle ziehen gleichzeitig den Joystick (je Gerät
 * ein Finger pro Platz), der Host rechnet ein Stück, alle lassen los und tippen A. Danach
 * rechnet der Host fertig und meldet das Ergebnis; der Server nimmt es an.
 */
async function playMinigame(
  host: Page,
  seats: readonly Seat[],
  touches: Map<Page, TouchScreen>,
): Promise<string> {
  // Bühne vorbereitet und Runner läuft (vorher rechnet `step` nichts).
  await host.waitForFunction(
    () =>
      window.__chaosMinigame?.ready === true &&
      window.__chaosMinigame.stage === 'play' &&
      window.__chaosMinigame.state === 'running',
  );
  const id = await host.evaluate(() => window.__chaosMinigame?.id ?? '');
  for (const seat of seats) {
    await expect(seat.root, `${seat.label}: Spiel-Layout`).toHaveAttribute('data-screen', 'play');
  }

  // Joystick (nur wenn das Minispiel einen hat; Kuckucks-Klatsche ist z. B. nur Knopf A, CHAOS-54):
  // alle Finger setzen auf und ziehen (verschiedene Richtungen je Platz).
  if (getMinigameInfo(id)?.controls.joystick) {
    const before = new Map<SlotNumber, number>();
    for (const seat of seats) before.set(seat.slot, await minigameInputs(host, seat.slot));
    const directions = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: -1 },
      { x: 0, y: 1 },
    ];
    for (const [index, seat] of seats.entries()) {
      const touch = touches.get(seat.page);
      if (!touch) throw new Error(`${seat.label}: kein TouchScreen`);
      const stick = seat.root.getByTestId('joystick');
      const box = await stick.boundingBox();
      if (!box) throw new Error(`${seat.label}: Joystick unsichtbar`);
      const from = await centerOf(stick);
      const reach = Math.min(box.width, box.height) / 2;
      const dir = directions[index % directions.length] ?? { x: 1, y: 0 };
      await touch.down(seat.slot, from);
      await touch.move(seat.slot, { x: from.x + dir.x * reach, y: from.y + dir.y * reach }, 6);
    }
    // Erst rechnen, wenn bei jedem Platz der volle Ausschlag angekommen ist – nicht schon bei der
    // ersten Zwischenstellung des Wischs. Sonst hängt das Minispiel-Ergebnis (und damit Endstand
    // und Siegerbild) davon ab, wie viele Nachrichten unter Last rechtzeitig da waren (CHAOS-41).
    for (const seat of seats) {
      await expect
        .poll(() => minigameInputs(host, seat.slot), { message: `${seat.label}: Joystick am Host` })
        .toBeGreaterThan(before.get(seat.slot) ?? 0);
      await expect
        .poll(
          async () => {
            const move = (await lastNetworkInput(host, seat.slot))?.move;
            return move ? Math.hypot(move.x, move.y) : 0;
          },
          { message: `${seat.label}: voller Ausschlag am Host` },
        )
        .toBeGreaterThan(0.95);
    }
    await host.evaluate(() => window.__chaosMinigame?.step(45));

    // Loslassen (Stick am Host wieder in der Mitte) und Knopf A tippen (Drücken und Loslassen am
    // Host), bevor zu Ende gerechnet wird.
    for (const touch of new Set(touches.values())) await touch.upAll();
    for (const seat of seats) {
      await expect
        .poll(async () => (await lastNetworkInput(host, seat.slot))?.move, {
          message: `${seat.label}: Stick losgelassen am Host`,
        })
        .toEqual({ x: 0, y: 0 });
    }
  } else {
    // Nur Knopf A: Der Controller zeigt keinen Joystick.
    for (const seat of seats) {
      await expect(seat.root.getByTestId('joystick'), `${seat.label}: kein Joystick`).toHaveCount(
        0,
      );
    }
    await host.evaluate(() => window.__chaosMinigame?.step(45));
  }
  // Knopf A (nur wenn das Minispiel einen hat; Rasensprenger-Rodeo ist z. B. nur Stick, CHAOS-91).
  if (getMinigameInfo(id)?.controls.a) {
    const buttonsBefore = new Map<SlotNumber, { presses: number; releases: number }>();
    for (const seat of seats) {
      const last = await lastNetworkInput(host, seat.slot);
      buttonsBefore.set(seat.slot, { presses: last?.presses ?? 0, releases: last?.releases ?? 0 });
    }
    for (const seat of seats) {
      const touch = touches.get(seat.page);
      const button = seat.root.getByTestId('button-a');
      await expect(button, `${seat.label}: Knopf A`).toBeVisible();
      await touch?.tap(await centerOf(button), seat.slot);
    }
    for (const seat of seats) {
      const was = buttonsBefore.get(seat.slot) ?? { presses: 0, releases: 0 };
      await expect
        .poll(
          async () => {
            const last = await lastNetworkInput(host, seat.slot);
            return { presses: last?.presses ?? 0, releases: last?.releases ?? 0 };
          },
          { message: `${seat.label}: Knopf A am Host` },
        )
        .toEqual({ presses: was.presses + 1, releases: was.releases + 1 });
    }
  } else {
    for (const seat of seats) {
      await expect(seat.root.getByTestId('button-a'), `${seat.label}: kein Knopf A`).toHaveCount(0);
    }
  }

  // Fertig rechnen: Host meldet das Ergebnis, Server nimmt es an.
  const resultsBefore = new Map<SlotNumber, number>();
  for (const seat of seats) resultsBefore.set(seat.slot, await resultScreens(seat));
  // In *einem* großen Schritt (CHAOS-211): `step(n)` rechnet n feste Schritte und rendert
  // danach ein Bild. Viele kleine Schritte (früher ~9 × 30) stauen in SwiftShader so viele
  // Bilder auf, dass der Host-Hauptthread auf langsamen Maschinen (Cloud-Sandbox) ~11 s lang
  // keine Aufgaben abarbeitet – Server-Nachrichten und damit die 5-s-Ergebnisanzeige kommen
  // dann erst, wenn die Ergebnisphase am Server schon vorbei ist. Schritte nach dem Ende ändern
  // das Ergebnis nicht (der Runner wertet beim Erreichen der Spielzeit).
  const finished = await host.evaluate((playFrames) => {
    const minigame = window.__chaosMinigame;
    if (minigame?.state === 'running') minigame.step(playFrames);
    for (let i = 0; i < 10 && minigame?.state === 'running'; i++) minigame.step(60);
    return minigame?.state ?? null;
  }, TEST_PLAY_FRAMES);
  expect(finished, 'Minispiel zu Ende gerechnet').toBe('finished');
  // Erst die Ergebnisanzeige, dann die Annahme (CHAOS-170): Die Anzeige steht nur
  // `minigameResultsMs` lang, danach entfernt der Host die Bühne samt Testhaken
  // (`resultState` liest dann `null`). `toHaveAttribute` prüft im DOM ohne die wachsenden
  // Pausen von `expect.poll`; `accepted` kommt oft schon mit dem Ack, solange noch `play` steht.
  await expect(host.getByTestId('minigame-screen'), 'Ergebnisanzeige am Host').toHaveAttribute(
    'data-stage',
    'results',
  );
  await expect
    .poll(() => host.evaluate(() => window.__chaosMinigame?.resultState ?? null), {
      message: 'Ergebnis vom Server angenommen',
    })
    .toBe('accepted');
  // Controller zeigen das eigene Ergebnis (Platz, Münzen) – mitgezählt im Controller selbst.
  for (const seat of seats) {
    await expect
      .poll(() => resultScreens(seat), { message: `${seat.label}: Platz und Münzen` })
      .toBeGreaterThan(resultsBefore.get(seat.slot) ?? 0);
  }
  return id;
}

// ---------------------------------------------------------------------------------------------
// Gemeinsamer Ablauf
// ---------------------------------------------------------------------------------------------

interface Party {
  readonly host: Page;
  readonly seats: readonly Seat[];
  /** Je Gerät ein CDP-Touch-Kanal (nach dem Neuladen einer Seite neu anlegen). */
  readonly touches: Map<Page, TouchScreen>;
  readonly server: RunningServer;
}

/** Charakterwahl über die UI: Platz tippt seine Figur; sie leuchtet als eigene. */
async function pick(seat: Seat) {
  await seat.root.getByTestId(`character-${seat.character}`).tap();
  await expect(seat.root.getByTestId(`character-${seat.character}`)).toHaveAttribute(
    'data-state',
    'mine',
  );
}

/** Nach der Wahl: eigene Figur, fremde vergeben, Host-Lobby zeigt alle Figuren. */
async function expectPicks(party: Party) {
  for (const seat of party.seats) {
    await expect(seat.root.getByTestId(`character-${seat.character}`)).toHaveAttribute(
      'data-state',
      'mine',
    );
  }
  // Jeder sieht die Figuren der anderen als vergeben.
  for (const seat of party.seats) {
    for (const other of party.seats) {
      if (other === seat) continue;
      await expect(seat.root.getByTestId(`character-${other.character}`)).toHaveAttribute(
        'data-state',
        'taken',
      );
    }
  }
  // Host-Lobby zeigt die Figuren.
  for (const seat of party.seats) {
    await expect(party.host.getByTestId(`lobby-player-${String(seat.slot)}`)).toHaveAttribute(
      'data-character',
      seat.character,
    );
  }
}

async function readyAll(party: Party) {
  for (const seat of party.seats) await seat.root.getByTestId('ready-button').tap();
  for (const seat of party.seats) {
    await expect(party.host.getByTestId(`lobby-state-${String(seat.slot)}`)).toHaveText('bereit ✓');
  }
  await expect(party.host.getByTestId('start-hint')).toHaveText('Alle bereit – los!');
}

/** Host: Rundenzahl per Klick wählen und starten; Brett zeigt die gewählten Figuren. */
async function chooseRoundsAndStart(party: Party, rounds: number) {
  const { host, server } = party;
  await host.getByTestId(`rounds-${String(rounds)}`).click();
  await expect(host.getByTestId(`rounds-${String(rounds)}`)).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  for (const seat of party.seats) {
    await expect(seat.root.getByTestId('lobby-rounds')).toHaveAttribute(
      'data-rounds',
      String(rounds),
    );
  }
  await host.getByTestId('start-button').click();
  const main = host.locator('main.host');
  await expect(main).toHaveAttribute('data-phase', 'board');
  await host.waitForFunction(() => window.__chaos?.board?.ready === true);
  expect(gameState(server)?.rounds).toBe(rounds);
  await stepFrames(host, 2);
  expect(await host.evaluate(() => window.__chaos?.board?.getPawnCharacters())).toEqual(
    Object.fromEntries(party.seats.map((seat) => [seat.slot, seat.character])),
  );
}

/** Wartet auf den ersten offenen Prompt (Zug 1 von Runde 1) und pausiert dann am PC. */
async function pauseAndResumeMidRound(party: Party) {
  const { host, seats, server } = party;
  await expect
    .poll(() => gameState(server)?.prompt?.kind ?? null, { timeout: 30_000 })
    .not.toBeNull();
  const promptSlot = gameState(server)?.prompt?.slot;
  const active = seats.find((seat) => seat.slot === promptSlot);
  if (!active) throw new Error('Prompt ohne passenden Platz');
  const choices = active.root.getByTestId('prompt').locator('[data-testid^="choice-"]');
  await expect(choices.first()).toBeVisible();

  const main = host.locator('main.host');
  await host.getByTestId('pause-button').click();
  await expect(host.getByTestId('pause-overlay')).toBeVisible();
  await expect(main).toHaveAttribute('data-paused', 'true');
  expect(gameState(server)?.paused).toBe(true);
  for (const seat of seats) {
    await expect(seat.root, `${seat.label}: Pause`).toHaveAttribute('data-screen', 'pause');
    await expect(seat.root.getByTestId('pause-panel')).toBeVisible();
    await expect(seat.root.locator('[data-testid^="choice-"]')).toHaveCount(0);
  }

  await host.getByTestId('pause-resume').click();
  await expect(host.getByTestId('pause-overlay')).toHaveCount(0);
  await expect(main).toHaveAttribute('data-paused', 'false');
  expect(gameState(server)?.paused).toBe(false);
  // Derselbe Prompt ist wieder da.
  await expect(choices.first()).toBeVisible();
}

/**
 * Bis zum Endstand spielen: Brettzüge über die Prompt-Knöpfe, jedes Minispiel über Joystick
 * und A. `onBoardTick` läuft in jeder Brett-Schleife (z. B. Neuladen eines Controllers).
 */
async function playToEnd(
  party: Party,
  options: {
    onBoardTick?: () => Promise<void>;
    onMinigamePlay?: (index: number) => Promise<void>;
  } = {},
): Promise<string[]> {
  const { host, seats, server, touches } = party;
  const minigames: string[] = [];
  for (;;) {
    let stage: string | null = null;
    await playBoardUntil(
      host,
      seats,
      touches,
      async () => {
        stage = await hostMinigameStage(host);
        return stage === 'play' || gameState(server)?.phase === 'game-results';
      },
      'Minispiel oder Endstand',
      options.onBoardTick,
    );
    if (gameState(server)?.phase === 'game-results') break;
    await options.onMinigamePlay?.(minigames.length);
    minigames.push(await playMinigame(host, seats, touches));
    // Zurück auf dem Brett (nächste Runde) oder Endstand.
    await expect
      .poll(() => gameState(server)?.phase, { timeout: 20_000 })
      .not.toMatch(/^minigame-/);
  }
  return minigames;
}

/**
 * Trophäenzählung mit vorgespulter Uhr (`?finale=manual`): Intro, Aufdecken je Platz (vom
 * letzten an), Siegerbildschirm. Danach Host-Ranking = Server-Ranking = Endstand je Controller.
 */
async function finaleAndResults(party: Party) {
  const { host, seats, server } = party;
  await settleBoard(host);
  const results = host.getByTestId('board-results');
  await expect(results).toHaveAttribute('data-beat', 'intro');
  await expect(host.getByTestId('finale-title')).toHaveText('Die Trophäenzählung!');
  const beats = new Set<string>();
  const leads: string[] = [];
  for (let i = 0; i < 200 && (await results.getAttribute('data-done')) !== 'true'; i++) {
    const beat = await results.getAttribute('data-beat');
    if (beat) beats.add(beat);
    const lead = await host.getByTestId('finale-lead').textContent();
    if (lead && !leads.includes(lead)) leads.push(lead);
    await host.evaluate(() => window.__chaosFinale?.advance(400));
  }
  await expect(results).toHaveAttribute('data-done', 'true');
  expect([...beats]).toEqual(expect.arrayContaining(['intro', 'reveal']));

  const ranking = gameState(server)?.ranking ?? [];
  expect(ranking).toHaveLength(seats.length);
  // Aufgedeckt wird vom letzten Platz an (Platz 1 erst mit „Und auf Platz 1 …“).
  const lastPlace = Math.max(...ranking.map((entry) => entry.place));
  const firstReveal = leads.find((lead) => lead.startsWith('Platz ') || lead.startsWith('Und '));
  expect(firstReveal, `Ansagen: ${leads.join(' | ')}`).toMatch(
    lastPlace === 1 ? /^Und auf Platz 1/ : new RegExp(`^Platz ${String(lastPlace)}: `),
  );
  await expect(results).toHaveAttribute('data-podium', 'ready', { timeout: PODIUM_TIMEOUT });
  await expect(host.getByTestId('board-winner')).toContainText('gewinn');
  for (const entry of ranking) {
    await expect(host.getByTestId(`board-rank-${String(entry.slot)}`)).toHaveAttribute(
      'data-place',
      String(entry.place),
    );
  }
  // Controller: Endstand mit demselben Platz wie am PC (auch geteilte Plätze).
  for (const seat of seats) {
    const entry = ranking.find((candidate) => candidate.slot === seat.slot);
    if (!entry) throw new Error(`${seat.label}: nicht im Ranking`);
    const hostPlace = await host
      .getByTestId(`board-rank-${String(seat.slot)}`)
      .getAttribute('data-place');
    await expect(seat.root, `${seat.label}: Endstand`).toHaveAttribute('data-screen', 'final');
    const final = seat.root.getByTestId('final-result');
    await expect(final).toHaveAttribute('data-place', hostPlace ?? '');
    await expect(final).toHaveAttribute(
      'data-tied',
      entry.decidedBy === 'shared' ? 'true' : 'false',
    );
    await expect(final).toHaveAttribute('data-ended-early', 'false');
    await expect(seat.root.locator('.final-portrait')).toHaveAttribute(
      'data-character',
      seat.character,
    );
  }
  return ranking;
}

/** „Nochmal spielen“ am PC: alle zurück in der Lobby mit ihrer Figur, bereit zurückgesetzt. */
async function rematch(party: Party) {
  const { host, seats, server } = party;
  await expect(host.getByTestId('rematch-button')).toBeFocused();
  await host.getByTestId('rematch-button').click();
  await expect(host.locator('main.host')).toHaveAttribute('data-phase', 'lobby');
  expect(server.server.session.snapshot().phase).toBe('lobby');
  for (const seat of seats) {
    await expect(host.getByTestId(`lobby-player-${String(seat.slot)}`)).toHaveAttribute(
      'data-character',
      seat.character,
    );
    await expect(seat.root, `${seat.label}: Lobby nach Revanche`).toHaveAttribute(
      'data-screen',
      'lobby',
    );
    await expect(seat.root.getByTestId(`character-${seat.character}`)).toHaveAttribute(
      'data-state',
      'mine',
    );
    await expect(seat.root.getByTestId('ready-button')).toBeVisible();
  }
}

// ---------------------------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------------------------

test.describe('M4-Gesamtablauf: komplette Partie mit echten Seiten', () => {
  test.setTimeout(180_000);

  test('zwei iPhones: Figurenwahl, 2 Runden mit Brett und Minispielen, Pause, Neuladen, Finale, Revanche', async ({
    page: host,
    openDevice,
    chaosServer,
  }) => {
    const hostProblems = collectProblems(host);
    await host.goto(HOST_URL);
    await expect(host.getByTestId('connection')).toHaveAttribute('data-status', 'connected');
    await expect(host.getByTestId('rounds-3')).toHaveAttribute('aria-pressed', 'true');
    const link = await joinLinkFromLobby(host, 'phone');

    const phone1 = await openDevice('iPhone 13');
    const phone2 = await openDevice('iPhone 13');
    for (const phone of [phone1, phone2]) await phone.addInitScript(recordResultScreens);
    const problems = [collectProblems(phone1), collectProblems(phone2)];
    await phone1.goto(link);
    await expect(phone1.getByTestId('slot-1')).toHaveAttribute('data-screen', 'lobby');
    await phone2.goto(link);
    await expect(phone2.getByTestId('slot-2')).toHaveAttribute('data-screen', 'lobby');

    const party: Party = {
      host,
      seats: [phoneSeat(phone1, 1, 'sock'), phoneSeat(phone2, 2, 'raccoon')],
      touches: new Map([
        [phone1, await TouchScreen.create(phone1)],
        [phone2, await TouchScreen.create(phone2)],
      ]),
      server: chaosServer,
    };

    for (const seat of party.seats) await pick(seat);
    await expectPicks(party);
    // Screenshot: Charakterwahl am iPhone (eigene Figur gewählt, fremde vergeben).
    await expect(phone1).toHaveScreenshot('gesamtablauf-iphone-figurenwahl.png', {
      mask: controllerMask(phone1),
    });
    await readyAll(party);
    await stepFrames(host, 30);
    await expect(host).toHaveScreenshot('gesamtablauf-host-lobby.png', {
      mask: hostLobbyMask(host),
      timeout: SCREENSHOT_TIMEOUT,
    });

    await chooseRoundsAndStart(party, 2);
    await pauseAndResumeMidRound(party);

    // Reconnect: iPhone 2 lädt in Runde 2 auf dem Brett neu – gleicher Platz, gleiche Figur,
    // die Partie läuft weiter.
    let reloaded = false;
    const minigames = await playToEnd(party, {
      onBoardTick: async () => {
        const state = gameState(chaosServer);
        if (reloaded || state?.round !== 2 || state.phase.startsWith('minigame')) return;
        reloaded = true;
        await phone2.reload();
        await expect(phone2.getByTestId('slot-2')).toHaveAttribute(
          'data-screen',
          /^(board|minigame|play)$/,
        );
        await expect(phone2.locator('[data-testid^="slot-"]')).toHaveCount(1);
        await expect
          .poll(() => gameState(chaosServer)?.players.find((p) => p.slot === 2)?.connected)
          .toBe(true);
        expect(gameState(chaosServer)?.players).toHaveLength(2);
      },
    });
    expect(reloaded, 'iPhone 2 hat in Runde 2 neu geladen').toBe(true);
    expect(minigames).toHaveLength(2);
    expect(new Set(minigames).size, 'zwei verschiedene Minispiele').toBe(2);

    await finaleAndResults(party);
    await renderPodium(host);
    await expect(host).toHaveScreenshot('gesamtablauf-host-sieger-2.png', {
      mask: finaleMask(host),
      timeout: SCREENSHOT_TIMEOUT,
    });
    await expect(phone1).toHaveScreenshot('gesamtablauf-iphone-endstand.png', {
      mask: controllerMask(phone1),
    });

    await rematch(party);

    expectNoProblems(hostProblems, 'Host');
    problems.forEach((p, index) => {
      expectNoProblems(p, `iPhone ${String(index + 1)}`);
    });
  });

  test('gemischt: zwei iPhones und iPad mit zwei Zonen, eine Runde, iPad lädt im Minispiel neu, Finale, Revanche', async ({
    page: host,
    openDevice,
    chaosServer,
  }) => {
    const hostProblems = collectProblems(host);
    await host.goto(HOST_URL);
    await expect(host.getByTestId('connection')).toHaveAttribute('data-status', 'connected');
    const phoneLink = await joinLinkFromLobby(host, 'phone');

    const phone1 = await openDevice('iPhone 13');
    const phone2 = await openDevice('iPhone 13');
    for (const phone of [phone1, phone2]) await phone.addInitScript(recordResultScreens);
    await phone1.goto(phoneLink);
    await expect(phone1.getByTestId('slot-1')).toHaveAttribute('data-screen', 'lobby');
    await phone2.goto(phoneLink);
    await expect(phone2.getByTestId('slot-2')).toHaveAttribute('data-screen', 'lobby');

    const ipadLink = await joinLinkFromLobby(host, 'ipad');
    expect(ipadLink).toContain('seats=2');
    const ipad = await openDevice('iPad Pro 11 landscape');
    await ipad.addInitScript(recordResultScreens);
    await ipad.goto(ipadLink);
    const problems = [collectProblems(phone1), collectProblems(phone2), collectProblems(ipad)];

    const ipadTouch = await TouchScreen.create(ipad);
    const party: Party = {
      host,
      seats: [
        phoneSeat(phone1, 1, 'cactus'),
        phoneSeat(phone2, 2, 'robot'),
        zoneSeat(ipad, 3, 'sock'),
        zoneSeat(ipad, 4, 'raccoon'),
      ],
      touches: new Map([
        [phone1, await TouchScreen.create(phone1)],
        [phone2, await TouchScreen.create(phone2)],
        [ipad, ipadTouch],
      ]),
      server: chaosServer,
    };
    const [, , zone3, zone4] = party.seats;
    if (!zone3 || !zone4) throw new Error('iPad-Zonen fehlen');

    // iPhones wählen per Tipp; die beiden iPad-Zonen gleichzeitig mit zwei Fingern.
    for (const seat of party.seats) {
      await expect(seat.root, `${seat.label}: Lobby`).toHaveAttribute('data-screen', 'lobby');
    }
    for (const seat of party.seats.slice(0, 2)) {
      await seat.root.getByTestId(`character-${seat.character}`).tap();
      await expect(seat.root.getByTestId(`character-${seat.character}`)).toHaveAttribute(
        'data-state',
        'mine',
      );
    }
    await ipadTouch.down(3, await centerOf(zone3.root.getByTestId('character-sock')));
    await ipadTouch.down(4, await centerOf(zone4.root.getByTestId('character-raccoon')));
    await ipadTouch.upAll();
    await expectPicks(party);
    // Bereit: iPhones tippen, beide Zonen gleichzeitig.
    for (const seat of party.seats.slice(0, 2)) await seat.root.getByTestId('ready-button').tap();
    await ipadTouch.down(3, await centerOf(zone3.root.getByTestId('ready-button')));
    await ipadTouch.down(4, await centerOf(zone4.root.getByTestId('ready-button')));
    await ipadTouch.upAll();
    for (const seat of party.seats) {
      await expect(host.getByTestId(`lobby-state-${String(seat.slot)}`)).toHaveText('bereit ✓');
    }
    await expect(host.getByTestId('start-hint')).toHaveText('Alle bereit – los!');

    await chooseRoundsAndStart(party, 1);
    await pauseAndResumeMidRound(party);

    // Reconnect: iPad lädt mitten im Minispiel neu – beide Zonen kommen ins Spiel zurück.
    const minigames = await playToEnd(party, {
      onMinigamePlay: async () => {
        await host.waitForFunction(() => window.__chaosMinigame?.stage === 'play');
        await expect(zone3.root).toHaveAttribute('data-screen', 'play');
        await ipad.reload();
        await expect(zone3.root).toHaveAttribute('data-screen', 'play');
        await expect(zone4.root).toHaveAttribute('data-screen', 'play');
        await expect(ipad.locator('[data-testid^="zone-"][data-screen]')).toHaveCount(2);
        expect(gameState(chaosServer)?.players).toHaveLength(4);
        expect(gameState(chaosServer)?.phase).toBe('minigame-play');
        // Nach dem Neuladen braucht das iPad einen neuen CDP-Touch-Kanal. Und es muss erst
        // ein Bild gezeichnet haben: Chromium kennt den Touch-Listener der Spielfläche erst
        // nach dem nächsten Frame; ein früher aufgesetzter Finger ginge sonst samt seiner
        // Bewegungen verloren (Software-Rendering unter Last, sonst sporadisch rot).
        await ipad.evaluate(
          () =>
            new Promise<void>((resolve) => {
              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  resolve();
                });
              });
            }),
        );
        party.touches.set(ipad, await TouchScreen.create(ipad));
      },
    });
    expect(minigames).toHaveLength(1);

    await finaleAndResults(party);
    await renderPodium(host);
    await expect(host).toHaveScreenshot('gesamtablauf-host-sieger-4.png', {
      mask: finaleMask(host),
      timeout: SCREENSHOT_TIMEOUT,
    });

    await rematch(party);

    expectNoProblems(hostProblems, 'Host');
    problems.forEach((p, index) => {
      expectNoProblems(p, ['iPhone 1', 'iPhone 2', 'iPad'][index] ?? 'Gerät');
    });
  });
});
