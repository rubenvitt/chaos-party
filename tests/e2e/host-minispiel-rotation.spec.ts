/**
 * Minispiele der Rotation in der PC-Lobby (CHAOS-85) am echten Node-Server, seit CHAOS-228 in der
 * einen Minispiel-Ansicht (mit Galerie, CHAOS-87): Favorit/Sperren je Spiel, Rauswurf-Vorschlag
 * mit Sperren-Knopf, `configure` an den Server, Stand in der Lobby, lokale Speicherung und
 * erneutes Senden an eine frische Session. Screenshot des Dialogs.
 */
import type { Page } from '@playwright/test';
import { createMemoryRatingStore } from '../../apps/server/src/ratings.ts';
import { REMOVAL_MIN_VOTES } from '../../packages/minigames/src/gallery.ts';
import { rotationInfos } from '../../packages/minigames/src/catalog.ts';
import { collectProblems, expectNoProblems, openHost } from './fixtures/pages.ts';
import { startChaosServer } from './fixtures/server.ts';
import { expect, test } from './fixtures/test.ts';

const PREFS_KEY = 'chaos-party:minigame-rotation';
const [FIRST, SECOND] = rotationInfos();

/** Texte maskieren (Schrift-Rendering je Rechner, ADR-004); Inhalte prüfen DOM-Assertions. */
const dialogMask = (page: Page) => [
  page.locator(
    [
      '.gallery-head h2',
      '.gallery-lead',
      '.gallery-hint',
      '.gallery-item-name',
      '.gallery-status',
      '.gallery-item-tagline',
      '.gallery-item-meta',
      '.gallery-votes',
      '.gallery-pick-label',
      '.gallery-practice',
      '.gallery-export',
      '.gallery-close',
    ].join(', '),
  ),
];

test.describe('Minispiel-Rotation in der Lobby (Node-Server, Production-Build)', () => {
  test('Favorit und Sperre in der Minispiel-Ansicht, Server übernimmt, Stand bleibt lokal gespeichert', async ({
    page,
    chaosServer,
  }) => {
    if (!FIRST || !SECOND) throw new Error('Rotation braucht mindestens zwei Minispiele');
    const problems = collectProblems(page);
    const session = chaosServer.server.session;
    await openHost(page, '/host/?test=1&seed=2026');

    // Ein Knopf in der Lobby (CHAOS-228), kein zweiter für die Galerie.
    await expect(page.getByTestId('gallery-button')).toHaveCount(0);
    const open = page.getByTestId('minigames-open');
    const total = rotationInfos().length;
    await expect(page.getByTestId('minigames-summary')).toHaveText(`${String(total)} im Topf`);
    await open.click();
    const dialog = page.getByRole('dialog', { name: 'Minispiele' });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('.gallery-pick--blocked')).toHaveCount(total);
    await expect(page.getByTestId('gallery-close')).toBeFocused();

    await page.getByTestId(`gallery-favorite-${SECOND.id}`).click();
    await page.getByTestId(`gallery-blocked-${FIRST.id}`).click();
    await expect(page.getByTestId(`gallery-item-${FIRST.id}`)).toHaveAttribute(
      'data-blocked',
      'true',
    );
    await expect(page.getByTestId(`gallery-item-${SECOND.id}`)).toHaveAttribute(
      'data-favorite',
      'true',
    );
    await expect
      .poll(() => session.snapshot())
      .toMatchObject({ minigameBlocklist: [FIRST.id], minigameFavorites: [SECOND.id] });
    // Nur der Dialog: dahinter stehen QR-Code und Link mit zufälligem Port.
    await expect(page.getByTestId('minigame-gallery')).toHaveScreenshot(
      'host-minispiel-rotation.png',
      { mask: dialogMask(page) },
    );

    // Gesperrtes Spiel als Favorit: die Sperre fällt weg (beides schließt sich aus).
    await page.getByTestId(`gallery-favorite-${FIRST.id}`).click();
    await expect
      .poll(() => session.snapshot())
      .toMatchObject({ minigameBlocklist: [], minigameFavorites: [FIRST.id, SECOND.id] });
    await page.getByTestId(`gallery-blocked-${FIRST.id}`).click();

    // Escape schließt; der Knopf zeigt den Stand.
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(page.getByTestId('minigames-summary')).toHaveText(
      `${String(total - 1)} im Topf · 1 ★ · 1 ⦸`,
    );
    expect(
      JSON.parse((await page.evaluate((key) => localStorage.getItem(key), PREFS_KEY)) ?? 'null'),
    ).toEqual({ blocklist: [FIRST.id], favorites: [SECOND.id] });
    expectNoProblems(problems, 'Host');
  });

  test('gespeicherter Stand geht beim Öffnen an eine frische Session', async ({
    page,
    chaosServer,
  }) => {
    if (!FIRST || !SECOND) throw new Error('Rotation braucht mindestens zwei Minispiele');
    await page.addInitScript(
      ({ key, value }) => {
        localStorage.setItem(key, value);
      },
      {
        key: PREFS_KEY,
        value: JSON.stringify({ blocklist: [SECOND.id, 'gibt-es-nicht'], favorites: [FIRST.id] }),
      },
    );
    await openHost(page, '/host/?test=1&seed=2026');
    // Fremde Kennungen ignoriert der Server; der Rest kommt an.
    await expect
      .poll(() => chaosServer.server.session.snapshot())
      .toMatchObject({ minigameBlocklist: [SECOND.id], minigameFavorites: [FIRST.id] });
    await expect(page.getByTestId('minigames-summary')).toContainText('1 ★ · 1 ⦸');
  });

  test('Rauswurf-Vorschlag: ein Klick auf „Sperren“, vorher passiert nichts', async ({
    page,
    chaosJoinCode,
  }) => {
    if (!FIRST) throw new Error('Rotation braucht ein Minispiel');
    const problems = collectProblems(page);
    // Viele Daumen runter aus früheren Partien (Stimmen liegen beim Server, CHAOS-87).
    const ratings = createMemoryRatingStore();
    for (let i = 0; i < REMOVAL_MIN_VOTES; i++) {
      ratings.record({
        play: `frueher:${String(i)}`,
        slot: 1,
        minigameId: FIRST.id,
        vote: 'down',
        practice: false,
      });
    }
    const running = await startChaosServer({ joinCode: chaosJoinCode, ratings });
    try {
      const session = running.server.session;
      await page.goto(`${running.base}/host/?test=1&seed=2026`);
      await expect(page.getByTestId('connection')).toHaveAttribute('data-status', 'connected');
      await page.getByTestId('minigames-open').click();

      const item = page.getByTestId(`gallery-item-${FIRST.id}`);
      await expect(item).toHaveAttribute('data-suggest-removal', 'true');
      await expect(page.getByTestId(`gallery-removal-${FIRST.id}`)).toContainText(
        'aus der Rotation nehmen?',
      );
      // Nur ein Vorschlag: gesperrt ist noch nichts.
      expect(session.snapshot().minigameBlocklist).toEqual([]);

      await page.getByTestId(`gallery-removal-block-${FIRST.id}`).click();
      await expect.poll(() => session.snapshot().minigameBlocklist).toEqual([FIRST.id]);
      await expect(item).toHaveAttribute('data-blocked', 'true');
      // Gesperrt: kein Vorschlag mehr, Zurücknehmen über den Sperren-Knopf der Zeile.
      await expect(item).toHaveAttribute('data-suggest-removal', 'false');
      await expect(page.getByTestId(`gallery-removal-${FIRST.id}`)).toHaveCount(0);
      await page.getByTestId(`gallery-blocked-${FIRST.id}`).click();
      await expect.poll(() => session.snapshot().minigameBlocklist).toEqual([]);
    } finally {
      await running.close();
    }
    expectNoProblems(problems, 'Host');
  });
});
