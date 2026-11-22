/**
 * Spielformen mit Teams (CHAOS-89): echte Seiten gegen den echten Server.
 *
 * Abgedeckt: Pump-Duell (2 gegen 2) aus der Galerie üben → Team-Ansage in der Anleitung am PC
 * (Name, Symbol, Mitglieder) → eigene Rolle am Handy → Spiel mit Controller-Eingaben → Ergebnis
 * mit Team-Überschrift am PC und Ausgang am Handy. Der Server hat das Team-Ergebnis angenommen
 * (sonst gäbe es keine Ergebnisanzeige).
 *
 * Bilder (CHAOS-233): Die Anleitung am PC wird erst aufgenommen, wenn die Bühne fertig geladen
 * ist (vorher fehlt der Pause-Knopf und die Karte sitzt anders), und ohne 3D-Fläche dahinter:
 * Die Arena gehört zu `m3-minispiele-bild.spec.ts`, hier geht es um Team-Ansage, Symbole und
 * Anleitung. Vom Handy gibt es hier **kein** Bild: Die Handys laufen im Geräte-Browser ohne GPU
 * (`deviceBrowser`, CPU-Rasterung), dessen Schriftbild je Rechner abweicht. Die Rolle am Handy
 * prüft hier der DOM; das Bild dazu macht `controller-minispiel.spec.ts` in den iPhone-Projekten.
 *
 * Was das **nicht** beweist: Lesbarkeit am Fernseher und Spaß im Team – siehe
 * `docs/device-test-checklist.md` §46.
 */
import { withRules } from '../../packages/game-core/src/index.ts';
import { getMinigameInfo } from '../../packages/minigames/src/catalog.ts';
import { PLAYER_SLOTS, type SlotNumber } from '../../packages/protocol/src/index.ts';
import type {} from '../../apps/host/src/minigame/testHook.ts';
import { collectProblems, expectNoProblems } from './fixtures/pages.ts';
import { startChaosServer, type RunningServer } from './fixtures/server.ts';
import { expect, test as base } from './fixtures/test.ts';

const ID = 'pump-duell';
const INFO = (() => {
  const info = getMinigameInfo(ID);
  if (!info) throw new Error('Testspiel fehlt im Katalog');
  return info;
})();
const INTRO_MS = 8_000;
const RESULTS_MS = 15_000;
const STEPS_TO_FINISH = Math.ceil(INFO.durationMs / (1000 / 60)) + 30;

const test = base.extend<{ chaosServer: RunningServer }>({
  chaosServer: async ({ chaosJoinCode }, use) => {
    const running = await startChaosServer({
      joinCode: chaosJoinCode,
      game: {
        rules: withRules({
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

test.describe('Spielformen mit Teams (CHAOS-89)', () => {
  test.setTimeout(150_000);

  test('2 gegen 2: Team-Ansage, Rolle am Handy, Team-Ergebnis', async ({
    page: host,
    openDevice,
    chaosServer,
  }) => {
    const hostProblems = collectProblems(host);
    await host.goto('/host/?test=1');
    await expect(host.getByTestId('connection')).toHaveAttribute('data-status', 'connected');

    const phones = [];
    for (let i = 0; i < 4; i++) {
      const phone = await openDevice('iPhone 13');
      await phone.goto(chaosServer.joinUrl);
      await expect(phone.getByTestId('ready-button')).toBeVisible();
      phones.push(phone);
    }
    const phoneProblems = phones.map((phone) => collectProblems(phone));

    await host.getByTestId('minigames-open').click();
    await host.getByTestId(`gallery-practice-${ID}`).click();
    await expect(host.getByTestId('minigame-screen')).toHaveAttribute('data-stage', 'intro');

    // Aufstellung vom Server: zwei Teams à zwei.
    const teams = chaosServer.server.session.snapshot().game?.state.minigame?.teams;
    expect(teams?.layout).toBe('2v2');
    const lineup = host.getByTestId('minigame-teams');
    await expect(lineup).toHaveAttribute('data-layout', '2v2');
    await expect(host.getByTestId('minigame-team-0')).toContainText('Team Sonne');
    await expect(host.getByTestId('minigame-team-1')).toContainText('Team Mond');
    // Erst die fertige Bühne (Pause-Knopf da, Karte an ihrem Platz), dann ohne 3D-Fläche:
    // Das Bild hängt so weder am Ladezeitpunkt noch am Frame der Arena (CHAOS-215, CHAOS-229, CHAOS-233).
    await expect(host.getByTestId('minigame-screen')).toHaveAttribute('data-status', 'ready', {
      timeout: 30_000,
    });
    await expect(host.locator('main.host')).toHaveAttribute('data-scene', 'ready');
    await host.waitForFunction(() => window.__chaosMinigame?.ready === true, null, {
      timeout: 60_000,
    });
    await expect(host.getByTestId('pause-button')).toBeVisible();
    await host.addStyleTag({ content: '.minigame-screen canvas { visibility: hidden; }' });
    await expect(host.getByTestId('minigame-intro')).toHaveScreenshot(
      'spielform-2v2-anleitung.png',
      // Mitglieder hängen an der Zufallszuteilung; Teams, Symbole und Anleitung bleiben im Bild.
      { mask: [host.locator('.minigame-team-members')] },
    );

    const label = (slots: readonly number[]) =>
      slots.map((slot) => PLAYER_SLOTS[slot as SlotNumber].label).join(' und ');
    for (const [index, phone] of phones.entries()) {
      const slot = index + 1;
      const own = teams?.teams.findIndex((team) => team.includes(slot as 1 | 2 | 3 | 4)) ?? -1;
      const mates = (teams?.teams[own] ?? []).filter((other) => other !== slot);
      const opponents = teams?.teams[own === 0 ? 1 : 0] ?? [];
      const role = phone.getByTestId('minigame-team-role');
      await expect(role).toHaveAttribute('data-role', 'team');
      await expect(role).toContainText(own === 0 ? 'Team Sonne' : 'Team Mond');
      await expect(role).toContainText(`Du und ${label(mates)} gegen ${label(opponents)}.`);
      await expect(phone.getByTestId('minigame-title')).toHaveText(INFO.title);
    }

    for (const phone of phones) {
      const ready = phone.getByTestId('minigame-ready-button');
      await expect(ready).toHaveAttribute('data-armed', 'true');
      await ready.tap();
    }

    await expect(host.getByTestId('minigame-screen')).toHaveAttribute('data-stage', 'play', {
      timeout: INTRO_MS + 15_000,
    });
    await host.waitForFunction(
      () => window.__chaosMinigame?.ready === true && window.__chaosMinigame.state === 'running',
    );
    // Team 1 (Mond) pumpt, Team 0 nicht: Mond gewinnt.
    const busy = teams?.teams[1] ?? [];
    for (const slot of busy) {
      for (let i = 0; i < 3; i++) await phones[slot - 1]?.getByTestId('button-a').tap();
    }
    await host.waitForFunction(
      (slots) => slots.every((slot) => (window.__chaosMinigame?.networkInputs?.[slot] ?? 0) >= 2),
      busy,
    );
    await host.evaluate((steps) => {
      window.__chaosMinigame?.step(steps);
    }, STEPS_TO_FINISH);

    await expect(host.getByTestId('minigame-screen')).toHaveAttribute('data-stage', 'results');
    await expect(host.getByTestId('minigame-headline')).toContainText('Team Mond gewinnt');
    expect(chaosServer.server.session.snapshot().game?.state.minigame?.outcome).toEqual({
      kind: 'teams',
      winner: 1,
    });
    for (const [index, phone] of phones.entries()) {
      const won = busy.includes((index + 1) as 1 | 2 | 3 | 4);
      await expect(phone.getByTestId('result-team')).toHaveText(
        won ? 'Dein Team hat gewonnen!' : 'Dein Team hat verloren.',
      );
    }

    expectNoProblems(hostProblems, 'Host');
    phoneProblems.forEach((problems, index) => {
      expectNoProblems(problems, `Handy ${String(index + 1)}`);
    });
  });
});
