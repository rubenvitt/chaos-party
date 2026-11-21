/**
 * Spielformen mit Teams (CHAOS-89): echte Seiten gegen den echten Server.
 *
 * Abgedeckt: Pump-Duell (2 gegen 2) aus der Galerie üben → Team-Ansage in der Anleitung am PC
 * (Name, Symbol, Mitglieder) → eigene Rolle am Handy → Spiel mit Controller-Eingaben → Ergebnis
 * mit Team-Überschrift am PC und Ausgang am Handy. Der Server hat das Team-Ergebnis angenommen
 * (sonst gäbe es keine Ergebnisanzeige).
 *
 * Was das **nicht** beweist: Lesbarkeit am Fernseher und Spaß im Team – siehe
 * `docs/device-test-checklist.md` §46.
 */
import { withRules } from '../../packages/game-core/src/index.ts';
import { getMinigameInfo } from '../../packages/minigames/src/catalog.ts';
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

    await host.getByTestId('gallery-button').click();
    await host.getByTestId(`gallery-practice-${ID}`).click();
    await expect(host.getByTestId('minigame-screen')).toHaveAttribute('data-stage', 'intro');

    // Aufstellung vom Server: zwei Teams à zwei.
    const teams = chaosServer.server.session.snapshot().game?.state.minigame?.teams;
    expect(teams?.layout).toBe('2v2');
    const lineup = host.getByTestId('minigame-teams');
    await expect(lineup).toHaveAttribute('data-layout', '2v2');
    await expect(host.getByTestId('minigame-team-0')).toContainText('Team Sonne');
    await expect(host.getByTestId('minigame-team-1')).toContainText('Team Mond');
    await expect(host.getByTestId('minigame-intro')).toHaveScreenshot(
      'spielform-2v2-anleitung.png',
      // Mitglieder hängen an der Zufallszuteilung; Teams, Symbole und Anleitung bleiben im Bild.
      { mask: [host.locator('.minigame-team-members')] },
    );

    for (const [index, phone] of phones.entries()) {
      const slot = index + 1;
      const own = teams?.teams.findIndex((team) => team.includes(slot as 1 | 2 | 3 | 4)) ?? -1;
      const role = phone.getByTestId('minigame-team-role');
      await expect(role).toHaveAttribute('data-role', 'team');
      await expect(role).toContainText(own === 0 ? 'Team Sonne' : 'Team Mond');
    }
    // Die Zuteilung ist zufällig (Seed der Partie): Bild immer vom Handy in Team Sonne, die
    // Namen von Mitspieler und Gegnern maskiert, damit es nicht an der Zuteilung hängt.
    const sonne = phones[(teams?.teams[0]?.[0] ?? 1) - 1];
    if (!sonne) throw new Error('kein Handy in Team Sonne');
    await expect(sonne.getByTestId('minigame-intro')).toHaveScreenshot(
      'spielform-2v2-rolle-handy.png',
      { mask: [sonne.locator('.minigame-team-role-text > span')] },
    );

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
