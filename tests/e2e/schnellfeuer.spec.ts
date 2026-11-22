/**
 * Schnellfeuer als eigene Rundenart (CHAOS-90): echte Seiten gegen den echten Server, mit 2, 3
 * und 4 Personen. Ein iPhone spielt mit, die übrigen Plätze sind synthetische Controller.
 *
 * - Auslöser `finale` und eine Runde: Das einzige Minispiel der Partie ist Schnellfeuer (der
 *   Standard-Auslöser „Ereignis, sonst Finale“ landet bei einer Runde ebenso dort).
 * - Host im Testmodus (`?test=1`): Die Bühne rechnet nur auf `__chaosMinigame.step(n)`.
 *
 * Abgedeckt: Anleitung von Schnellfeuer → Bildwort des ersten Mikro-Spiels → A vom iPhone kommt an
 * → alle fünf Mikro-Spiele durchgerechnet → Ergebnis vom Host gesendet und vom Server angenommen
 * (Plätze für alle, Münzen verteilt) → Finale. CHAOS-231: Das iPhone zeigt dabei je Mikro-Spiel
 * dasselbe Bildwort wie der Host und nur dessen Bedienung (Stick nur, wo das Mikro-Spiel ihn braucht).
 *
 * Nicht bewiesen: Lesbarkeit des Bildworts am Fernseher, Tempo im echten Spiel, Spaß – das
 * beurteilt Ruben bei der Zwischenabnahme (CHAOS-92), siehe `docs/device-test-checklist.md`.
 */
import type { Page } from '@playwright/test';
import { withRules } from '../../packages/game-core/src/index.ts';
import { getMinigameInfo, RAPID_FIRE_ID } from '../../packages/minigames/src/catalog.ts';
import { MICRO_POOL } from '../../packages/minigames/src/schnellfeuer/micros.ts';
import type {} from '../../apps/host/src/minigame/testHook.ts';
import { LobbyBot } from './fixtures/lobbyBot.ts';
import { collectProblems, expectNoProblems } from './fixtures/pages.ts';
import { startChaosServer, type RunningServer } from './fixtures/server.ts';
import { expect, test as base } from './fixtures/test.ts';

const INFO = (() => {
  const info = getMinigameInfo(RAPID_FIRE_ID);
  if (!info) throw new Error('Schnellfeuer fehlt im Katalog');
  return info;
})();

/** Feste Schritte à 1/60 s, die sicher über die ganze Kette hinausgehen. */
const STEPS_TO_FINISH = Math.ceil(INFO.durationMs / (1000 / 60)) + 60;

const test = base.extend<{ chaosServer: RunningServer }>({
  chaosServer: async ({ chaosJoinCode }, use) => {
    const running = await startChaosServer({
      joinCode: chaosJoinCode,
      game: {
        rules: {
          ...withRules({ pacing: { minigameIntroMs: 3_000, minigameReadyMinMs: 1_000 } }),
          rapidFire: { trigger: 'finale' },
        },
        rapidFire: { id: INFO.id, playMs: INFO.durationMs, scoring: INFO.scoring },
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

async function banner(host: Page): Promise<string> {
  return (await host.evaluate(() => window.__chaosMinigame?.hud()?.banner)) ?? '';
}

/**
 * CHAOS-231: Das iPhone zeigt dasselbe Bildwort wie der Host-Banner im Bildwort („2/5 🍝
 * SCHLÜRFEN!“) und nur die Bedienung dieses Mikro-Spiels.
 */
async function expectPhoneCue(host: Page, phone: Page, index: number): Promise<void> {
  const text = await banner(host);
  expect(text.startsWith(`${String(index + 1)}/5 `)).toBe(true);
  const word = /([A-ZÄÖÜ]+!)/.exec(text)?.[1];
  const micro = MICRO_POOL.find((entry) => entry.info.word === word);
  if (!micro) throw new Error(`Unbekanntes Bildwort im Banner: ${text}`);
  const header = phone.getByTestId('minigame-header');
  await expect(header).toHaveAttribute('data-cue-step', String(index));
  await expect(phone.getByTestId('minigame-cue-word')).toHaveText(micro.info.word);
  await expect(header).toHaveAttribute('data-double', index === 4 ? 'true' : 'false');
  const panel = phone.getByTestId('play-panel');
  await expect(panel).toHaveAttribute(
    'data-stick',
    micro.info.controls.joystick ? 'true' : 'false',
  );
  await expect(phone.getByTestId('button-a')).toContainText(micro.info.controls.a ?? '');
}

/**
 * Bis zum Bildwort des Mikro-Spiels `index` rechnen (Banner „<index+1>/5 …“), in einem Aufruf
 * im Host: Jedes `step` rendert ein Bild, viele kleine Aufrufe von außen kosten so viel echte
 * Zeit, dass die Frist des Servers das Spiel vorher abschneidet. 70 Schritte (≈ 1,17 s) sind
 * kürzer als das Bildwort (1,3 s = 78 Schritte) und überspringen es darum nicht.
 */
async function stepToAnnounce(host: Page, index: number): Promise<void> {
  const prefix = `${String(index + 1)}/5 `;
  const reached = await host.evaluate((wanted) => {
    const hook = window.__chaosMinigame;
    for (let tries = 0; tries < 30; tries++) {
      if (hook?.hud()?.banner?.startsWith(wanted)) return true;
      hook?.step(70);
    }
    return hook?.hud()?.banner?.startsWith(wanted) ?? false;
  }, prefix);
  expect(reached, `Bildwort ${prefix}erreicht`).toBe(true);
}

test.describe('Schnellfeuer: fünf Mikro-Spiele als eigene Rundenart', () => {
  test.setTimeout(180_000);

  for (const players of [2, 3, 4] as const) {
    test(`läuft mit ${String(players)} Personen von der Anleitung bis zum Ergebnis`, async ({
      page: host,
      openDevice,
      chaosServer,
    }) => {
      const hostProblems = collectProblems(host);
      await host.goto('/host/?rounds=1&test=1');
      await expect(host.getByTestId('connection')).toHaveAttribute('data-status', 'connected');

      const phone = await openDevice('iPhone 13');
      const phoneProblems = collectProblems(phone);
      await phone.goto(chaosServer.joinUrl);
      await expect(phone.getByTestId('ready-button')).toBeVisible();
      const bots: LobbyBot[] = [];
      for (let i = 1; i < players; i++) bots.push(await LobbyBot.join(chaosServer));
      await phone.getByTestId('ready-button').tap();
      await expect(host.getByTestId('start-button')).toBeEnabled();
      await host.getByTestId('start-button').click();

      const deadline = Date.now() + 120_000;
      while ((await minigameStage(host)) === null) {
        if (Date.now() > deadline) throw new Error('Schnellfeuer erscheint nicht');
        await answerPrompt(phone);
        await host.waitForTimeout(200);
      }

      // Anleitung: Schnellfeuer mit Titel, drei Zeilen und Stick + A.
      const intro = host.getByTestId('minigame-intro');
      await expect(intro).toBeVisible();
      await expect(host.locator('main.host')).toHaveAttribute('data-minigame', RAPID_FIRE_ID);
      await expect(host.getByTestId('minigame-title')).toHaveText(INFO.title);
      for (const line of INFO.instructions) await expect(intro).toContainText(line);
      const button = phone.getByTestId('minigame-ready-button');
      await expect(button).toHaveAttribute('data-armed', 'true');
      await button.tap();

      // Spiel: Bildwort des ersten Mikro-Spiels, dann A vom iPhone.
      await expect(host.getByTestId('minigame-screen')).toHaveAttribute('data-stage', 'play', {
        timeout: 20_000,
      });
      await host.waitForFunction(
        () => window.__chaosMinigame?.ready === true && window.__chaosMinigame.state === 'running',
      );
      expect(await host.evaluate(() => window.__chaosMinigame?.hud()?.banner)).toMatch(
        /^1\/5 \S+ [A-ZÄÖÜ]+!$/,
      );
      await expectPhoneCue(host, phone, 0);
      await step(host, 100);
      expect(await host.evaluate(() => window.__chaosMinigame?.hud()?.banner)).toMatch(
        /^\S+ [A-ZÄÖÜ]+!/,
      );
      await expect(phone.getByTestId('button-a')).toBeVisible();
      await phone.getByTestId('button-a').tap();
      await host.waitForFunction(() => (window.__chaosMinigame?.networkInputs?.[1] ?? 0) >= 2);

      // Jedes weitere Bildwort erscheint auch am iPhone, mit nur seiner Bedienung (CHAOS-231).
      for (const index of [1, 2, 3, 4]) {
        await stepToAnnounce(host, index);
        await expectPhoneCue(host, phone, index);
      }

      // Alle fünf durchrechnen → Ergebnis vom Host, angenommen, Plätze und Münzen für alle.
      await step(host, STEPS_TO_FINISH);
      await expect(host.getByTestId('minigame-screen')).toHaveAttribute('data-stage', 'results');
      expect(await host.evaluate(() => window.__chaosMinigame?.resultState)).toBe('accepted');
      await expect(host.getByTestId('minigame-results')).toBeVisible();
      const state = chaosServer.server.session.snapshot().game?.state;
      expect(state?.minigame?.id).toBe(RAPID_FIRE_ID);
      expect(state?.minigame?.aborted).toBe(false);
      expect(state?.minigame?.placements).toHaveLength(players);
      expect(state?.minigame?.rewards).toHaveLength(players);
      for (let slot = 1; slot <= players; slot++) {
        await expect(host.getByTestId(`minigame-rank-${String(slot)}`)).toBeVisible();
      }

      // Danach geht die Partie ins Finale (eine Runde).
      await expect
        .poll(() => chaosServer.server.session.snapshot().game?.state.phase, { timeout: 30_000 })
        .toBe('game-results');

      for (const bot of bots) bot.close();
      expectNoProblems(hostProblems, 'Host');
      expectNoProblems(phoneProblems, 'Handy');
    });
  }
});
