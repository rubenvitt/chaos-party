/**
 * Minispiel-Galerie und Daumen (CHAOS-87) in der einen Minispiel-Ansicht der Lobby (CHAOS-228):
 * echte Seiten gegen den echten Server.
 *
 * Abgedeckt (Akzeptanzkriterien): „Minispiele“ in der PC-Lobby öffnen → ein Minispiel der
 * Rotation üben → Spiel mit Controller-Eingabe → Ergebnis ohne Münzen → Daumen am Handy → zurück
 * in der Lobby zeigt dieselbe Ansicht die Stimme; der Export unter `/ratings.json` enthält sie
 * auch. Im selben Dialog gesperrt, zieht die nächste Partie das Spiel nicht (Sperrliste in der
 * Rotation der Partie; dass gesperrte Spiele nie gezogen werden, prüft
 * `apps/server/src/minigameRotation.integration.test.ts`).
 *
 * - Host im Testmodus (`?test=1`): Die Minispiel-Bühne rechnet nur auf
 *   `window.__chaosMinigame.step(n)`. Ergebnisanzeige verlängert, damit die Stimme in Ruhe
 *   fällt; die Rückkehr in die Lobby wartet trotzdem nicht auf Stimmen (Integrationstest).
 *
 * Zweiter Test (CHAOS-218): geteiltes iPad mit zwei Zonen übt dasselbe Spiel, beide Zonen
 * stimmen per Touch unterschiedlich ab, der Server zählt beide Stimmen.
 *
 * Was das **nicht** beweist: Daumen-Tippen auf echtem iOS/iPadOS, Lesbarkeit der Galerie am Fernseher –
 * siehe `docs/device-test-checklist.md`.
 */
import { withRules } from '../../packages/game-core/src/index.ts';
import { getMinigameInfo } from '../../packages/minigames/src/catalog.ts';
import type {} from '../../apps/host/src/minigame/testHook.ts';
import { collectProblems, expectNoProblems } from './fixtures/pages.ts';
import { startChaosServer, type RunningServer } from './fixtures/server.ts';
import { expect, test as base } from './fixtures/test.ts';
import { centerOf, TouchScreen } from './fixtures/touch.ts';

/** Ein Spiel der Rotation, damit es sich im selben Dialog sperren lässt. */
const ID = 'sockenregen';
/** Spielbar, aber nicht in der Rotation: üben ja, sperren nein. */
const PLAYABLE_ID = 'pump-parade';
const INFO = (() => {
  const info = getMinigameInfo(ID);
  if (!info) throw new Error('Referenz-Minispiel fehlt im Katalog');
  return info;
})();
// Großzügig: In der CI lädt die Minispiel-Bühne langsamer; die Anleitung muss sichtbar bleiben, bis sie steht.
const INTRO_MS = 8_000;
const RESULTS_MS = 15_000;
const STEPS_TO_FINISH = Math.ceil(INFO.durationMs / (1000 / 60)) + 30;

const test = base.extend<{ chaosServer: RunningServer }>({
  chaosServer: async ({ chaosJoinCode }, use) => {
    const running = await startChaosServer({
      joinCode: chaosJoinCode,
      game: {
        rules: withRules({
          // Die Anleitung wartet auf „Bereit“ (CHAOS-214), frühestens nach INTRO_MS.
          pacing: {
            minigameIntroMs: INTRO_MS,
            minigameReadyMinMs: INTRO_MS,
            minigameResultsMs: RESULTS_MS,
          },
        }),
      },
    });
    try {
      await use(running);
    } finally {
      await running.close();
    }
  },
});

test.describe('Minispiel-Galerie (CHAOS-87, CHAOS-228)', () => {
  test.setTimeout(120_000);

  test('Spiel üben, Daumen am Handy, im selben Dialog sperren – nächste Partie ohne das Spiel', async ({
    page: host,
    openDevice,
    chaosServer,
  }) => {
    const hostProblems = collectProblems(host);
    await host.goto('/host/?test=1');
    await expect(host.getByTestId('connection')).toHaveAttribute('data-status', 'connected');

    // Ein Knopf für alles (CHAOS-228): ohne Controller alles sichtbar, Üben noch aus.
    await expect(host.getByTestId('gallery-button')).toHaveCount(0);
    await host.getByTestId('minigames-open').click();
    const gallery = host.getByTestId('minigame-gallery');
    await expect(gallery).toBeVisible();
    await expect(host.getByTestId('gallery-close')).toBeFocused();
    const item = host.getByTestId(`gallery-item-${ID}`);
    await expect(item).toContainText(INFO.title);
    await expect(item).toHaveAttribute('data-status', 'rotation');
    await expect(item).toHaveAttribute('data-blocked', 'false');
    await expect(host.getByTestId(`gallery-blocked-${ID}`)).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    // Nur spielbar: üben ja, aber nichts an der Rotation umzuschalten.
    await expect(host.getByTestId(`gallery-item-${PLAYABLE_ID}`)).toHaveAttribute(
      'data-status',
      'spielbar',
    );
    await expect(host.getByTestId(`gallery-blocked-${PLAYABLE_ID}`)).toHaveCount(0);
    await expect(host.getByTestId(`gallery-votes-${ID}`)).toContainText('Noch keine Stimmen');
    await expect(host.getByTestId(`gallery-practice-${ID}`)).toBeDisabled();
    // ★ und ⦸ kommen aus einer Ersatzschrift, die je Rechner anders ausfällt (ADR-004):
    // Knopf-Beschriftungen und Einleitung maskiert, Knöpfe und Zustände bleiben im Bild.
    await expect(gallery).toHaveScreenshot('galerie-leer.png', {
      mask: [host.locator('.gallery-pick-label, .gallery-lead')],
    });
    await host.keyboard.press('Escape');
    await expect(gallery).toHaveCount(0);

    // Ein Handy kommt dazu (bereit muss es zum Üben nicht sein).
    const phone = await openDevice('iPhone 13');
    const phoneProblems = collectProblems(phone);
    await phone.goto(chaosServer.joinUrl);
    await expect(phone.getByTestId('ready-button')).toBeVisible();
    await host.getByTestId('minigames-open').click();
    await host.getByTestId(`gallery-practice-${ID}`).click();
    await expect(gallery).toHaveCount(0);

    // Übungsrunde: gleich die Anleitung des gewählten Spiels, kein Brettzug.
    await expect(host.locator('main.host')).toHaveAttribute('data-phase', 'board');
    await expect(host.locator('main.host')).toHaveAttribute('data-minigame', ID);
    await expect(host.getByTestId('minigame-screen')).toHaveAttribute('data-stage', 'intro');
    await expect(host.getByTestId('minigame-title')).toHaveText(INFO.title);
    await expect(phone.getByTestId('minigame-intro')).toBeVisible();
    // Auch die Übungsrunde wartet auf „Bereit“ (CHAOS-214).
    const ready = phone.getByTestId('minigame-ready-button');
    await expect(ready).toHaveAttribute('data-armed', 'true');
    await ready.tap();

    // Spiel: Eingabe vom Handy, dann die Spielzeit durchrechnen.
    await expect(host.getByTestId('minigame-screen')).toHaveAttribute('data-stage', 'play', {
      timeout: INTRO_MS + 15_000,
    });
    await host.waitForFunction(
      () => window.__chaosMinigame?.ready === true && window.__chaosMinigame.state === 'running',
    );
    await phone.getByTestId('button-a').tap();
    await host.waitForFunction(() => (window.__chaosMinigame?.networkInputs?.[1] ?? 0) >= 2);
    await host.evaluate((steps) => {
      window.__chaosMinigame?.step(steps);
    }, STEPS_TO_FINISH);

    // Ergebnis: Übung ohne Münzen, am Handy Daumen.
    await expect(host.getByTestId('minigame-screen')).toHaveAttribute('data-stage', 'results');
    const results = host.getByTestId('minigame-results');
    await expect(results).toHaveAttribute('data-practice', 'true');
    await expect(host.getByTestId('minigame-practice-note')).toBeVisible();
    await expect(host.getByTestId('minigame-coins-1')).toHaveAttribute('data-coins', '');
    const coins = chaosServer.server.session.snapshot().game?.state.players[0]?.coins;
    expect(coins).toBe(
      chaosServer.server.session.snapshot().game?.state.config.rules.economy.startCoins,
    );

    const vote = phone.getByTestId('minigame-vote');
    await expect(vote).toBeVisible();
    await expect(phone.getByTestId('result-reward')).toHaveCount(0);
    await expect(phone.getByTestId('minigame-lead')).toContainText('Lobby');
    await phone.getByTestId('vote-up').tap();
    await expect(phone.getByTestId('vote-up')).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => chaosServer.server.session.ratingVotes().length).toBe(1);
    expect(chaosServer.server.session.ratingVotes()[0]).toMatchObject({
      minigameId: ID,
      vote: 'up',
      practice: true,
      slot: 1,
    });
    await expect(phone).toHaveScreenshot('daumen-handy.png');

    // Nach der Ergebnisanzeige zurück in die Lobby; dieselbe Ansicht zeigt die Stimme.
    await expect(host.locator('main.host')).toHaveAttribute('data-phase', 'lobby', {
      timeout: RESULTS_MS + 10_000,
    });
    await expect(phone.getByTestId('ready-button')).toBeVisible();
    await host.getByTestId('minigames-open').click();
    const votes = host.getByTestId(`gallery-votes-${ID}`);
    await expect(votes).toHaveAttribute('data-up', '1');
    await expect(votes).toHaveAttribute('data-down', '0');
    await expect(votes).toContainText('1 Stimme');

    // Im selben Dialog sperren: Server übernimmt, Zeile und Lobby-Knopf zeigen es.
    await host.getByTestId(`gallery-blocked-${ID}`).click();
    await expect(item).toHaveAttribute('data-blocked', 'true');
    await expect(host.getByTestId(`gallery-blocked-${ID}`)).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => chaosServer.server.session.snapshot().minigameBlocklist).toEqual([ID]);
    await host.keyboard.press('Escape');
    await expect(gallery).toHaveCount(0);
    await expect(host.getByTestId('minigames-summary')).toContainText('1 ⦸');

    // Nächste Partie: Die Rotation der Partie führt das Spiel als gesperrt.
    await phone.getByTestId('ready-button').tap();
    await host.getByTestId('start-button').click();
    await expect(host.locator('main.host')).not.toHaveAttribute('data-phase', 'lobby');
    const game = chaosServer.server.session.snapshot().game;
    expect(game?.state.config.practice).not.toBe(true);
    expect(game?.state.config.minigameRotation?.blocked).toEqual([ID]);

    // Export für den Katalog.
    const exported = await host.request.get('/ratings.json');
    expect(exported.ok()).toBe(true);
    const body = (await exported.json()) as {
      games: { id: string; up: number; down: number }[];
      votes: unknown[];
    };
    expect(body.games.find((game) => game.id === ID)).toMatchObject({ up: 1, down: 0 });
    expect(body.votes).toHaveLength(1);

    expectNoProblems(hostProblems, 'Host');
    expectNoProblems(phoneProblems, 'Handy');
  });

  test('geteiltes iPad: zwei Zonen üben, stimmen unterschiedlich ab, der Server zählt beide', async ({
    page: host,
    openDevice,
    chaosServer,
  }) => {
    const hostProblems = collectProblems(host);
    await host.goto('/host/?test=1');
    await expect(host.getByTestId('connection')).toHaveAttribute('data-status', 'connected');

    // iPad mit zwei Zonen (wie der Join-Link „iPad“ der Lobby).
    const ipad = await openDevice('iPad Pro 11 landscape');
    const ipadProblems = collectProblems(ipad);
    await ipad.goto(`${chaosServer.joinUrl}&seats=2`);
    const zone = (slot: number) => ipad.getByTestId(`zone-${String(slot)}`);
    for (const slot of [1, 2]) await expect(zone(slot)).toHaveAttribute('data-screen', 'lobby');
    const touch = await TouchScreen.create(ipad);

    await host.getByTestId('minigames-open').click();
    await host.getByTestId(`gallery-practice-${ID}`).click();
    await expect(host.getByTestId('minigame-screen')).toHaveAttribute('data-stage', 'intro');

    // Anleitung: jede Zone drückt ihr „Bereit!“ (CHAOS-214).
    for (const slot of [1, 2]) {
      const ready = zone(slot).getByTestId('minigame-ready-button');
      await expect(ready).toHaveAttribute('data-armed', 'true', { timeout: INTRO_MS + 5_000 });
      await touch.tap(await centerOf(ready));
    }
    await expect(host.getByTestId('minigame-screen')).toHaveAttribute('data-stage', 'play', {
      timeout: INTRO_MS + 15_000,
    });
    await host.waitForFunction(
      () => window.__chaosMinigame?.ready === true && window.__chaosMinigame.state === 'running',
    );
    await host.evaluate((steps) => {
      window.__chaosMinigame?.step(steps);
    }, STEPS_TO_FINISH);
    await expect(host.getByTestId('minigame-screen')).toHaveAttribute('data-stage', 'results');

    // Ergebnis: beide Zonen zeigen Daumen; gleichzeitig 👍 in Zone 1, 👎 in Zone 2.
    for (const slot of [1, 2]) await expect(zone(slot).getByTestId('minigame-vote')).toBeVisible();
    await touch.down(1, await centerOf(zone(1).getByTestId('vote-up')));
    await touch.down(2, await centerOf(zone(2).getByTestId('vote-down')));
    await touch.upAll();
    await expect(zone(1).getByTestId('vote-up')).toHaveAttribute('aria-pressed', 'true');
    await expect(zone(2).getByTestId('vote-down')).toHaveAttribute('aria-pressed', 'true');

    await expect.poll(() => chaosServer.server.session.ratingVotes().length).toBe(2);
    const votes = chaosServer.server.session
      .ratingVotes()
      .map((v) => ({ slot: v.slot, vote: v.vote, minigameId: v.minigameId, practice: v.practice }))
      .sort((a, b) => a.slot - b.slot);
    expect(votes).toEqual([
      { slot: 1, vote: 'up', minigameId: ID, practice: true },
      { slot: 2, vote: 'down', minigameId: ID, practice: true },
    ]);
    // Bestätigung vom Server: die eigene Stimme steht im Kontext jeder Zone.
    await expect(zone(1).getByTestId('minigame-vote')).toHaveAttribute('data-selected', 'up');
    await expect(zone(2).getByTestId('minigame-vote')).toHaveAttribute('data-selected', 'down');

    // Zurück in der Lobby zeigt die Galerie beide Stimmen.
    await expect(host.locator('main.host')).toHaveAttribute('data-phase', 'lobby', {
      timeout: RESULTS_MS + 10_000,
    });
    await host.getByTestId('minigames-open').click();
    const tally = host.getByTestId(`gallery-votes-${ID}`);
    await expect(tally).toHaveAttribute('data-up', '1');
    await expect(tally).toHaveAttribute('data-down', '1');

    expectNoProblems(hostProblems, 'Host');
    expectNoProblems(ipadProblems, 'iPad');
  });
});
