/**
 * PC-Lobby mit Charakterwahl und Rundenzahl (M4, CHAOS-36) am echten Node-Server.
 *
 * Synthetische Controller (`LobbyBot`) treten bei und wählen Figuren per `pick-character`;
 * der Host zeigt je Spieler Porträt und Namen der gewählten Figur bzw. „wählt noch …“,
 * stellt Brett (CHAOS-197), Rundenzahl und „Mehr Zeit zum Reagieren“ (CHAOS-124) per `configure`
 * ein (Maus und Tastatur) und startet. Auf dem Brett stehen danach die gewählten Figuren
 * (Testhaken `getPawnCharacters`) auf dem gewählten bzw. ausgelosten Brett.
 */
import type { Page } from '@playwright/test';
import type {} from '../../apps/host/src/testHook.ts';
import { LobbyBot } from './fixtures/lobbyBot.ts';
import { collectProblems, expectNoProblems, openHost, stepFrames } from './fixtures/pages.ts';
import { E2E_JOIN_CODE } from './fixtures/server.ts';
import { expect, test } from './fixtures/test.ts';

/** Fester Join-Link für den Screenshot (der echte enthält den zufälligen Port). */
const PINNED_JOIN_URL = `http://127.0.0.1:8787/?code=${E2E_JOIN_CODE}`;

async function pinLobbyJoinUrl(page: Page) {
  await page.routeWebSocket(/\/ws$/, (ws) => {
    const server = ws.connectToServer();
    server.onMessage((message) => {
      if (typeof message !== 'string') {
        ws.send(message);
        return;
      }
      const data = JSON.parse(message) as { type?: unknown; joinUrl?: string };
      if (data.type === 'lobby') data.joinUrl = PINNED_JOIN_URL;
      ws.send(JSON.stringify(data));
    });
  });
}

/** Texte maskieren (Schrift-Rendering je Rechner, ADR-004); Inhalte prüfen DOM-Assertions. */
const lobbyMask = (page: Page) => [
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
      '.lobby-board-name',
      '.lobby-toggle-text',
      '.player-symbol',
      '.lobby-free-symbol',
      '.start-button',
      '.start-hint',
      '.hud-title',
      '.hud-connection',
    ].join(', '),
  ),
];

test.describe('Lobby mit Figuren und Rundenzahl (Node-Server, Production-Build)', () => {
  test('Figuren, „wählt noch …“, Rundenwahl per Maus und Tastatur, Start mit den Figuren', async ({
    page,
    chaosServer,
  }) => {
    const problems = collectProblems(page);
    const session = chaosServer.server.session;
    await pinLobbyJoinUrl(page);
    await openHost(page, '/host/?test=1&seed=2026');
    await expect(page.locator('.lobby-empty')).toBeVisible();

    // Rundenwahl: Vorschläge des Servers (10/16/20, EXP-011), Standard 10.
    await expect(page.getByTestId('rounds-10')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('rounds-10')).toContainText('≈ 15 Min.');
    await expect(page.getByTestId('lobby-rounds').locator('button')).toHaveCount(3);

    const bots = [
      await LobbyBot.join(chaosServer, { character: 'sock' }),
      await LobbyBot.join(chaosServer, { character: 'robot', name: 'Mia' }),
      await LobbyBot.join(chaosServer, { autoReady: false }),
    ];
    try {
      const card = (slot: number) => page.getByTestId(`lobby-player-${String(slot)}`);
      await expect(card(1)).toHaveAttribute('data-character', 'sock');
      await expect(page.getByTestId('lobby-character-1')).toHaveText('Socke Sigi');
      await expect(card(1).locator('.character-portrait')).toHaveAttribute(
        'data-character',
        'sock',
      );
      await expect(card(2)).toHaveAttribute('data-character', 'robot');
      await expect(card(2)).toContainText('Mia');
      // Slot 3 wählt noch: blasser Vorschlag (Standardfigur Waschbär ist frei).
      await expect(card(3)).toHaveAttribute('data-choosing', 'true');
      await expect(page.getByTestId('lobby-character-3')).toHaveText('wählt noch …');
      await expect(card(3).locator('.character-portrait')).toHaveAttribute(
        'data-character',
        'raccoon',
      );
      await expect(page.locator('.lobby-player--free')).toHaveCount(1);

      // Bereit-Status und Start-Hinweis: 1 und 2 bereit, 3 nicht.
      await expect(card(1)).toHaveAttribute('data-ready', 'true');
      await expect(card(2)).toHaveAttribute('data-ready', 'true');
      await expect(card(3)).toHaveAttribute('data-ready', 'false');
      const start = page.getByTestId('start-button');
      await expect(start).toBeEnabled();
      await expect(start).toHaveAttribute('data-highlight', 'false');
      await expect(page.getByTestId('start-hint')).toHaveText(
        'Grün ist noch nicht bereit – starten geht trotzdem.',
      );

      // Brett (CHAOS-197): Standard Wackelwald. Der Wechselknopf wählt per Maus den Rummelplatz
      // (CHAOS-199), den Frostgipfel (CHAOS-198), dann „Zufall“ – Server, Startknopf und
      // Controller sehen es –, per Tastatur (Enter) wieder Wackelwald.
      const board = page.getByTestId('board-choice');
      await expect(page.getByTestId('lobby-boards')).toBeVisible();
      await expect(board).toHaveAttribute('data-board', 'wackelwald');
      await expect(board).toContainText('Wackelwald');
      await expect(board).toContainText('74 Felder');
      await expect(page.getByTestId('start-button-detail')).toHaveText('10 Runden · Wackelwald');
      expect(session.snapshot().board).toBe('wackelwald');
      await board.click();
      await expect(board).toHaveAttribute('data-board', 'rummelplatz');
      await expect(board).toContainText('81 Felder');
      await expect(page.getByTestId('start-button-detail')).toHaveText('10 Runden · Rummelplatz');
      expect(session.snapshot().board).toBe('rummelplatz');
      await board.click();
      await expect(board).toHaveAttribute('data-board', 'frostgipfel');
      await expect(board).toContainText('75 Felder');
      await expect(page.getByTestId('start-button-detail')).toHaveText('10 Runden · Frostgipfel');
      expect(session.snapshot().board).toBe('frostgipfel');
      await board.click();
      await expect(board).toHaveAttribute('data-board', 'zufall');
      await expect(board).toContainText('Zufall');
      expect(session.snapshot().board).toBe('zufall');
      await expect(page.getByTestId('start-button-detail')).toHaveText('10 Runden · Zufallsbrett');
      await expect
        .poll(() => bots[0]?.lastContext?.lobby?.board)
        .toEqual({ id: 'zufall', name: 'Zufallsbrett' });
      await board.focus();
      await page.keyboard.press('Enter');
      await expect(board).toHaveAttribute('data-board', 'wackelwald');
      expect(session.snapshot().board).toBe('wackelwald');
      await expect
        .poll(() => bots[2]?.lastContext?.lobby?.board)
        .toEqual({ id: 'wackelwald', name: 'Wackelwald' });
      await board.blur();

      // Rundenzahl per Maus …
      await page.getByTestId('rounds-16').click();
      await expect(page.getByTestId('rounds-16')).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByTestId('rounds-10')).toHaveAttribute('aria-pressed', 'false');
      expect(session.snapshot().rounds).toBe(16);
      await expect(start).toContainText('16 Runden');
      // Dauer nach Spielerzahl (3 Spieler): 16 Runden ≈ 20 Min.
      await expect(page.getByTestId('rounds-16')).toContainText('≈ 20 Min.');
      // … und per Tastatur (Fokus + Enter).
      await page.getByTestId('rounds-20').focus();
      await page.keyboard.press('Enter');
      await expect(page.getByTestId('rounds-20')).toHaveAttribute('aria-pressed', 'true');
      expect(session.snapshot().rounds).toBe(20);

      // „Mehr Zeit zum Reagieren“ (CHAOS-124): Standard aus; per Maus an, per Tastatur
      // (Leertaste) aus und wieder an. Der Schalter zeigt den Server-Stand.
      const moreTime = page.getByTestId('more-reaction-time');
      await expect(moreTime).toHaveAttribute('role', 'switch');
      await expect(moreTime).toHaveAttribute('aria-checked', 'false');
      await expect(moreTime).toContainText('3 s');
      expect(session.snapshot().moreReactionTime).toBe(false);
      await moreTime.click();
      await expect(moreTime).toHaveAttribute('aria-checked', 'true');
      await expect(moreTime).toContainText('5 s');
      expect(session.snapshot().moreReactionTime).toBe(true);
      await moreTime.focus();
      await page.keyboard.press('Space');
      await expect(moreTime).toHaveAttribute('aria-checked', 'false');
      expect(session.snapshot().moreReactionTime).toBe(false);
      await page.keyboard.press('Space');
      await expect(moreTime).toHaveAttribute('aria-checked', 'true');
      await moreTime.blur();

      // Umwählen setzt „bereit“ zurück (ADR-015) – der Host zeigt es sofort.
      bots[0]?.pick('cactus');
      await expect(card(1)).toHaveAttribute('data-character', 'cactus');
      await expect(page.getByTestId('lobby-character-1')).toHaveText('Kalle Kaktus');
      // Der Bot tippt danach selbst wieder „bereit“.
      await expect(card(1)).toHaveAttribute('data-ready', 'true');

      await page.getByTestId('rounds-20').blur();
      await stepFrames(page, 30);
      if (process.env.HOST_LOBBY_BELEG) {
        await page.screenshot({
          path: 'docs/screenshots/m4-host-lobby.png',
          animations: 'disabled',
        });
      }
      await expect(page).toHaveScreenshot('host-lobby-figuren.png', { mask: lobbyMask(page) });

      // Alle bereit: Knopf leuchtet.
      bots[2]?.ready();
      await expect(card(3)).toHaveAttribute('data-ready', 'true');
      await expect(start).toHaveAttribute('data-highlight', 'true');
      await expect(page.getByTestId('start-hint')).toHaveText('Alle bereit – los!');

      // Start per Tastatur: Fokus auf den Knopf, Enter.
      await start.focus();
      await page.keyboard.press('Enter');
      const main = page.locator('main.host');
      await expect(main).toHaveAttribute('data-phase', 'board');
      await expect(main).toHaveAttribute('data-scene', 'ready');
      await page.waitForFunction(() => window.__chaos?.board?.ready === true);
      expect(session.snapshot().game?.state.rounds).toBe(20);
      // Die Partie läuft mit dem längeren Reaktionsfenster.
      expect(session.snapshot().game?.state.config.rules.pacing.reactionWindowMs).toBe(5_000);
      // Brett zeigt die gewählten Figuren; Slot 3 bekam beim Start seine freie Standardfigur.
      await stepFrames(page, 2);
      expect(await page.evaluate(() => window.__chaos?.board?.getPawnCharacters())).toEqual({
        1: 'cactus',
        2: 'robot',
        3: 'raccoon',
      });
      await expect(page.getByTestId('board-round')).toHaveText('Runde 1/20');
      // Gewähltes Brett kommt an: Spielstand und HUD-Titel.
      expect(session.snapshot().game?.state.boardId).toBe('wackelwald');
      await expect(page.locator('.hud-title p')).toContainText('Wackelwald');
    } finally {
      for (const bot of bots) bot.close();
    }
    expectNoProblems(problems, 'Host');
  });

  test('ein Spieler: Start als Probelauf möglich, aber ohne Leuchten', async ({
    page,
    chaosServer,
  }) => {
    await openHost(page, '/host/?test=1&seed=2026&rounds=2');
    const bot = await LobbyBot.join(chaosServer);
    try {
      await expect(page.getByTestId('lobby-player-1')).toHaveAttribute('data-ready', 'true');
      // `?rounds=2` stellt die Lobby beim Verbinden ein (kein Vorschlag → eigener Knopf).
      await expect(page.getByTestId('rounds-2')).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByTestId('rounds-2')).toHaveAttribute('data-custom', 'true');
      expect(chaosServer.server.session.snapshot().rounds).toBe(2);
      const start = page.getByTestId('start-button');
      await expect(start).toBeEnabled();
      await expect(start).toHaveAttribute('data-highlight', 'false');
      await expect(page.getByTestId('start-hint')).toContainText('ab 2 Spielern');

      // Brett „Zufall“ (CHAOS-197): Der Server lost beim Start ein Brett aus dem Register aus,
      // die Partie läuft darauf, die Lobby-Wahl bleibt „zufall“.
      await page.getByTestId('board-choice').click();
      await expect(page.getByTestId('board-choice')).toHaveAttribute('data-board', 'rummelplatz');
      await page.getByTestId('board-choice').click();
      await expect(page.getByTestId('board-choice')).toHaveAttribute('data-board', 'frostgipfel');
      await page.getByTestId('board-choice').click();
      await expect(page.getByTestId('board-choice')).toHaveAttribute('data-board', 'zufall');
      await start.click();
      const main = page.locator('main.host');
      await expect(main).toHaveAttribute('data-phase', 'board');
      await page.waitForFunction(() => window.__chaos?.board?.ready === true);
      const snapshot = chaosServer.server.session.snapshot();
      expect(snapshot.board).toBe('zufall');
      // Welches Brett gelost wird, hängt vom Seed ab. Den Brett-Titel im HUD prüft der Test nicht:
      // Mit einem getrennten Spieler läuft die Partie automatisch weiter, und auf dem größeren
      // Rummelplatz (Aufbau in SwiftShader) war sie beim ersten Bild schon im Minispiel (CHAOS-199).
      expect(['wackelwald', 'rummelplatz', 'frostgipfel']).toContain(snapshot.game?.state.boardId);
    } finally {
      bot.close();
    }
  });
});
