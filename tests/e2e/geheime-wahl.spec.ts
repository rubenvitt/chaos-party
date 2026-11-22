/**
 * Geheime Wahl (CHAOS-242): echte Seiten gegen den echten Server, zwei iPhones spielen Drei Türen
 * (MG-111). Host im Testmodus (`?test=1`): Die Bühne rechnet nur auf `__chaosMinigame.step(n)`.
 *
 * Abgedeckt: Stick von iPhone 1 zeigt links → nur iPhone 1 sieht das Ziel; A legt die Wahl fest →
 * nur iPhone 1 sieht „links“ als gewählt, iPhone 2 sieht seine eigene, leere Wahl; der
 * Host-Bildschirm zeigt nur den Haken, nie die Rückmeldung. Nach dem Aufdecken bleibt die Wahl am
 * iPhone 1 stehen (gesperrt), das Ergebnis kommt beim Server an.
 *
 * Nicht bewiesen: echtes iOS, Lesbarkeit am Handy im Spieltempo, ob Nachbarn am iPad mitlesen –
 * siehe `docs/device-test-checklist.md` (§46, GW1–GW3).
 */
import type { Page } from '@playwright/test';
import { withRules } from '../../packages/game-core/src/index.ts';
import { getMinigameInfo } from '../../packages/minigames/src/catalog.ts';
import type {} from '../../apps/host/src/minigame/testHook.ts';
import { collectProblems, expectNoProblems } from './fixtures/pages.ts';
import { startChaosServer, type RunningServer } from './fixtures/server.ts';
import { expect, test as base } from './fixtures/test.ts';
import { centerOf, TouchScreen } from './fixtures/touch.ts';

const INFO = (() => {
  const info = getMinigameInfo('drei-tueren');
  if (!info) throw new Error('Drei Türen fehlt im Katalog');
  return info;
})();

/** Feste Schritte à 1/60 s, die sicher über die Spielzeit hinausgehen. */
const STEPS_TO_FINISH = Math.ceil(INFO.durationMs / (1000 / 60)) + 60;

const test = base.extend<{ chaosServer: RunningServer }>({
  chaosServer: async ({ chaosJoinCode }, use) => {
    const running = await startChaosServer({
      joinCode: chaosJoinCode,
      game: {
        minigames: [{ id: INFO.id, playMs: INFO.durationMs, scoring: INFO.scoring }],
        rules: withRules({ pacing: { minigameIntroMs: 3_000, minigameReadyMinMs: 1_000 } }),
      },
    });
    try {
      await use(running);
    } finally {
      await running.close();
    }
  },
});

async function answerPrompt(phone: Page): Promise<void> {
  const prompt = phone.getByTestId('prompt');
  if (!(await prompt.isVisible())) return;
  for (const id of ['choice-roll', 'choice-buy', 'choice-brace', 'choice-cancel']) {
    const button = prompt.getByTestId(id);
    if ((await button.count()) > 0 && (await button.isEnabled())) {
      await button.tap();
      return;
    }
  }
  const choices = prompt.locator('[data-testid^="choice-"]:enabled');
  if ((await choices.count()) > 0) await choices.first().tap();
}

async function minigameStage(host: Page): Promise<string | null> {
  const screen = host.getByTestId('minigame-screen');
  if ((await screen.count()) === 0) return null;
  return screen.getAttribute('data-stage');
}

async function step(host: Page, frames: number): Promise<void> {
  await host.evaluate((n) => {
    window.__chaosMinigame?.step(n);
  }, frames);
}

/** Zustand je Tür am Handy („idle“, „aimed“, „picked“). */
async function doorStates(phone: Page): Promise<string[]> {
  const states: string[] = [];
  for (const id of ['links', 'mitte', 'rechts']) {
    states.push(
      (await phone.getByTestId(`minigame-secret-${id}`).getAttribute('data-state')) ?? '',
    );
  }
  return states;
}

/** Ein Schritt am Host, bis die Rückmeldung am Handy angekommen ist. */
async function untilDoors(host: Page, phone: Page, wanted: string[]): Promise<void> {
  await expect
    .poll(async () => {
      await step(host, 1);
      return doorStates(phone);
    })
    .toEqual(wanted);
}

test.describe('Geheime Wahl: private Rückmeldung am eigenen Controller', () => {
  test.setTimeout(180_000);

  test('nur das wählende iPhone sieht Ziel und Wahl, der Host nur den Haken', async ({
    page: host,
    openDevice,
    chaosServer,
  }) => {
    const hostProblems = collectProblems(host);
    await host.goto('/host/?rounds=1&test=1');
    await expect(host.getByTestId('connection')).toHaveAttribute('data-status', 'connected');

    const phone1 = await openDevice('iPhone 13');
    const phone2 = await openDevice('iPhone 13');
    const phoneProblems = [collectProblems(phone1), collectProblems(phone2)];
    await phone1.goto(chaosServer.joinUrl);
    await expect(phone1.getByTestId('ready-button')).toBeVisible();
    await phone2.goto(chaosServer.joinUrl);
    await expect(phone2.getByTestId('ready-button')).toBeVisible();
    await phone1.getByTestId('ready-button').tap();
    await phone2.getByTestId('ready-button').tap();
    await expect(host.getByTestId('start-button')).toBeEnabled();
    await host.getByTestId('start-button').click();

    const deadline = Date.now() + 120_000;
    while ((await minigameStage(host)) === null) {
      if (Date.now() > deadline) throw new Error('Drei Türen erscheint nicht');
      await answerPrompt(phone1);
      await answerPrompt(phone2);
      await host.waitForTimeout(200);
    }
    await expect(host.locator('main.host')).toHaveAttribute('data-minigame', INFO.id);
    for (const phone of [phone1, phone2]) {
      const button = phone.getByTestId('minigame-ready-button');
      await expect(button).toHaveAttribute('data-armed', 'true');
      await button.tap();
    }
    await expect(host.getByTestId('minigame-screen')).toHaveAttribute('data-stage', 'play', {
      timeout: 20_000,
    });
    await host.waitForFunction(
      () => window.__chaosMinigame?.ready === true && window.__chaosMinigame.state === 'running',
    );

    // Erste Runde offen: Beide sehen ihre (leere) Wahl mit drei Türen.
    await step(host, 40);
    for (const phone of [phone1, phone2]) {
      await expect(phone.getByTestId('minigame-secret')).toBeVisible();
      await expect(phone.getByTestId('minigame-secret')).toContainText('Runde 1/8');
    }
    await untilDoors(host, phone1, ['idle', 'idle', 'idle']);

    // iPhone 1 hält den Stick nach links: nur dort erscheint das Ziel.
    const touch = await TouchScreen.create(phone1);
    const stick = phone1.getByTestId('joystick');
    const from = await centerOf(stick);
    const box = await stick.boundingBox();
    await touch.down(1, from);
    await touch.move(1, { x: from.x - (box?.width ?? 200), y: from.y }, 8);
    await untilDoors(host, phone1, ['aimed', 'idle', 'idle']);
    expect(await doorStates(phone2)).toEqual(['idle', 'idle', 'idle']);

    // Zweiter Finger tippt A, während der Stick noch links steht: Wahl festgelegt.
    const a = await centerOf(phone1.getByTestId('button-a'));
    await touch.down(2, a);
    await touch.lift(2);
    await untilDoors(host, phone1, ['picked', 'idle', 'idle']);
    await expect(phone1.getByTestId('minigame-secret')).toContainText('gewählt');
    await touch.upAll();
    await phone1.screenshot({ path: test.info().outputPath('iphone-gewaehlt.png') });
    expect(await doorStates(phone2)).toEqual(['idle', 'idle', 'idle']);
    await expect(phone2.getByTestId('minigame-secret')).toContainText('deine Tür?');

    // Der Host-Bildschirm zeigt nur, dass jemand gewählt hat – nie die Rückmeldung.
    await expect(host.getByTestId('minigame-secret')).toHaveCount(0);
    const hostText = (await host.locator('body').innerText()).toLowerCase();
    expect(hostText).not.toContain('🔒');
    expect(hostText).not.toContain('deine tür');
    expect(hostText).not.toContain('runde 1/8: gewählt');
    expect(await host.evaluate(() => window.__chaosMinigame?.hud()?.banner)).toBe(
      'Runde 1/8: wählt!',
    );

    // Aufdecken: Die Wahl bleibt am iPhone 1 stehen, gesperrt.
    await step(host, 150);
    await expect(phone1.getByTestId('minigame-secret')).toHaveAttribute('data-locked', 'true');
    expect(await doorStates(phone1)).toEqual(['picked', 'idle', 'idle']);
    expect(await doorStates(phone2)).toEqual(['idle', 'idle', 'idle']);

    // Zu Ende rechnen: Ergebnis angenommen, danach keine Rückmeldung mehr.
    await step(host, STEPS_TO_FINISH);
    await expect(host.getByTestId('minigame-screen')).toHaveAttribute('data-stage', 'results');
    expect(await host.evaluate(() => window.__chaosMinigame?.resultState)).toBe('accepted');
    for (const phone of [phone1, phone2]) {
      await expect(phone.getByTestId('minigame-secret')).toHaveCount(0);
    }

    expectNoProblems(hostProblems, 'Host');
    for (const [index, problems] of phoneProblems.entries()) {
      expectNoProblems(problems, `Handy ${String(index + 1)}`);
    }
  });
});
