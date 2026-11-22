/**
 * KI-Plätze am PC-Host (CHAOS-182, ADR-020) am echten Node-Server: Ein Mensch (synthetischer
 * Controller `LobbyBot`) tritt bei, der Host setzt per Maus und Tastatur KI-Plätze, wechselt die
 * Stärke, entfernt eine KI wieder und startet. Die Partie läuft mit 1 Mensch + KI; das
 * KI-Abzeichen steht in Lobby, Brett-HUD und Minispiel-Ergebnis (Screenshots).
 *
 * Was das **nicht** beweist: ob die KI Spaß macht (Rubens Playtest, CHAOS-185).
 */
import type { Page } from '@playwright/test';
import type {} from '../../apps/host/src/testHook.ts';
import { LobbyBot } from './fixtures/lobbyBot.ts';
import { collectProblems, expectNoProblems, openHost } from './fixtures/pages.ts';
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

/**
 * Texte maskieren (Schrift-Rendering je Rechner, ADR-004); Inhalte prüfen DOM-Assertions. Das
 * KI-Abzeichen bleibt sichtbar: Es ist das, was der Screenshot zeigen soll.
 */
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
      '.lobby-ai-strength',
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

test.describe('KI-Plätze am PC-Host (Node-Server, Production-Build)', () => {
  test('1 Mensch + KI: hinzufügen, Stärke, entfernen, Start, KI-Abzeichen bis zum Ergebnis', async ({
    page,
    chaosServer,
  }) => {
    test.setTimeout(150_000);
    const problems = collectProblems(page);
    await pinLobbyJoinUrl(page);
    await openHost(page, '/host/?test=1&seed=2026&rounds=1');
    const bot = await LobbyBot.join(chaosServer, { character: 'raccoon' });
    const session = chaosServer.server.session;
    try {
      await expect(page.getByTestId('lobby-player-1')).toHaveAttribute('data-ready', 'true');
      await expect(page.getByTestId('lobby-player-1')).toHaveAttribute('data-kind', 'human');
      // Allein: Start nur als Probelauf, der Hinweis schlägt eine KI vor.
      await expect(page.getByTestId('start-button')).toHaveAttribute('data-readiness', 'solo');
      await expect(page.getByTestId('start-hint')).toContainText('KI');

      // Maus: KI auf Platz 2, Standard „mittel“, dann „schwer“.
      await page.getByTestId('lobby-ai-add-2').click();
      const ai = page.getByTestId('lobby-player-2');
      await expect(ai).toHaveAttribute('data-kind', 'ai');
      await expect(page.getByTestId('lobby-ai-badge-2')).toHaveText('KI');
      await expect(page.getByTestId('lobby-ai-strength-2')).toHaveAttribute(
        'data-strength',
        'mittel',
      );
      await expect(page.getByTestId('lobby-character-2')).toHaveText('Figur beim Start');
      await page.getByTestId('lobby-ai-strength-2').click();
      await expect(page.getByTestId('lobby-ai-strength-2')).toHaveAttribute(
        'data-strength',
        'schwer',
      );
      expect(session.snapshot().players.find((p) => p.slot === 2)).toMatchObject({
        kind: 'ai',
        strength: 'schwer',
      });

      // Tastatur: KI auf Platz 4 mit der Leertaste, mit Enter wieder entfernen.
      await page.getByTestId('lobby-ai-add-4').focus();
      await page.keyboard.press('Space');
      await expect(page.getByTestId('lobby-player-4')).toHaveAttribute('data-kind', 'ai');
      await page.getByTestId('lobby-ai-remove-4').focus();
      await page.keyboard.press('Enter');
      await expect(page.getByTestId('lobby-free-4')).toBeVisible();

      // 1 Mensch + 1 KI ist eine echte Partie: Der Knopf leuchtet.
      const start = page.getByTestId('start-button');
      await expect(start).toHaveAttribute('data-readiness', 'ready');
      await expect(start).toHaveAttribute('data-highlight', 'true');
      await expect(page.getByTestId('lobby-ai-add-3')).toBeVisible();
      await expect(page.locator('.lobby')).toHaveScreenshot('host-lobby-ki.png', {
        mask: lobbyMask(page),
      });

      await start.click();
      await expect(page.locator('main.host')).toHaveAttribute('data-phase', 'board');
      await page.waitForFunction(() => window.__chaos?.board?.ready === true);
      // Die KI hat eine freie Figur bekommen und heißt nach ihr; das Abzeichen steht im HUD.
      const snapshot = session.snapshot();
      const aiPlayer = snapshot.players.find((p) => p.slot === 2);
      expect(aiPlayer?.kind).toBe('ai');
      expect(aiPlayer?.character).not.toBeNull();
      expect(aiPlayer?.character).not.toBe('raccoon');
      await expect(page.getByTestId('board-ai-2')).toHaveText(/^KI/);
      await expect(page.getByTestId('board-player-1').locator('.ai-badge')).toHaveCount(0);
      // Bild für Doku und Abnahme (kein Vergleich: Wer gerade am Zug ist, hängt an der Uhr).
      await test.info().attach('brett-ki', {
        body: await page.screenshot(),
        contentType: 'image/png',
      });

      // Im Minispiel spielt die KI mit (Bots der Laufzeit) und trägt ihr Abzeichen (Anleitung,
      // Punkte, Ergebnis); mit einer Runde geht es danach bis zum Endstand.
      await expect(page.getByTestId('minigame-ai-2').first()).toHaveText(/^KI/, {
        timeout: 120_000,
      });
      await expect(page.getByTestId('minigame-ai-1')).toHaveCount(0);
      await expect(page.getByTestId('board-rank-ai-2')).toHaveText(/^KI/, { timeout: 120_000 });
      await expect(page.getByTestId('board-rank-ai-1')).toHaveCount(0);
      await test.info().attach('endstand-ki', {
        body: await page.screenshot(),
        contentType: 'image/png',
      });
    } finally {
      bot.close();
    }
    expectNoProblems(problems, 'Host');
  });
});
