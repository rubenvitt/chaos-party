/**
 * KI-Plätze am geteilten iPad (CHAOS-238, ADR-020 §2) gegen den **echten** Server: Ein iPad mit
 * zwei Zonen hält Platz 1 (Spielleitung) und Platz 2. Die Zone der Spielleitung setzt per
 * Touch eine KI, wechselt die Stärke und entfernt sie wieder; die andere Zone sieht die KI nur.
 * Den Host spielt ein synthetischer Host aus dem Testprozess (`fixtures/syntheticHost.ts`).
 * Projekte `ipad-quer`/`ipad-hoch` (iPad-Pro-11-Emulation, Touch per CDP).
 *
 * Was das **nicht** beweist: echtes iPadOS-Safari und echte Finger (`docs/device-test-checklist.md`).
 */
import type { Page } from '@playwright/test';
import { collectProblems, expectNoProblems } from './fixtures/pages.ts';
import { SyntheticHost } from './fixtures/syntheticHost.ts';
import { expect, test } from './fixtures/test.ts';
import { centerOf, TouchScreen } from './fixtures/touch.ts';

const zone = (page: Page, slot: number) => page.getByTestId(`zone-${String(slot)}`);
const seat = (page: Page, zoneSlot: number, seatSlot: number, part = '') =>
  zone(page, zoneSlot).getByTestId(`lobby-seat${part}-${String(seatSlot)}`);

let host: SyntheticHost | null = null;
test.afterEach(() => {
  host?.close();
  host = null;
});

test('Zone der Spielleitung setzt, ändert und entfernt eine KI; die Nachbarzone sieht sie nur', async ({
  page,
  chaosServer,
}, testInfo) => {
  host = await SyntheticHost.connect(chaosServer);
  const problems = collectProblems(page);
  await page.goto(`${chaosServer.joinUrl}&seats=2`);
  for (const slot of [1, 2]) {
    await expect(zone(page, slot)).toHaveAttribute('data-screen', 'lobby');
  }
  const session = chaosServer.server.session;
  const touch = await TouchScreen.create(page);

  // Spielleitung (Zone 1): Reihe mit „Du“, Mitspieler und „+ KI“ auf den freien Plätzen.
  await expect(zone(page, 1).getByTestId('lobby-seats')).toHaveAttribute('data-lead', 'true');
  await expect(seat(page, 1, 1)).toHaveAttribute('data-kind', 'self');
  await expect(seat(page, 1, 2)).toHaveAttribute('data-kind', 'human');
  await expect(seat(page, 1, 3)).toHaveAttribute('data-kind', 'free');
  // Ohne KI zeigt die Zone ohne Spielleitung keine Reihe.
  await expect(zone(page, 2).getByTestId('lobby-seats')).toHaveCount(0);

  await touch.tap(await centerOf(seat(page, 1, 3, '-tap')));
  await expect(seat(page, 1, 3)).toHaveAttribute('data-kind', 'ai');
  await expect(seat(page, 1, 3)).toHaveAttribute('data-strength', 'mittel');
  await expect(seat(page, 1, 3)).toContainText('KI · Mittel');
  expect(session.snapshot().players.find((p) => p.slot === 3)).toMatchObject({ kind: 'ai' });

  // Tippen auf die KI wechselt die Stärke.
  await touch.tap(await centerOf(seat(page, 1, 3, '-tap')));
  await expect(seat(page, 1, 3)).toHaveAttribute('data-strength', 'schwer');

  // Nachbarzone: sieht die KI, hat aber keine Knöpfe – und ein Tippen dort bewirkt nichts.
  await expect(zone(page, 2).getByTestId('lobby-seats')).toHaveAttribute('data-lead', 'false');
  await expect(seat(page, 2, 3)).toContainText('KI · Schwer');
  await expect(seat(page, 2, 3, '-tap')).toHaveCount(0);
  await expect(seat(page, 2, 3, '-remove')).toHaveCount(0);
  await touch.tap(await centerOf(seat(page, 2, 3)));
  await expect(seat(page, 1, 3)).toHaveAttribute('data-strength', 'schwer');

  await expect(page.getByTestId('zone-board')).toHaveScreenshot('ipad-lobby-ki.png', {
    mask: [page.locator('.ui-text, .player-symbol, .lobby-hint, .zone-seat-remove')],
  });
  await page.screenshot({
    path: testInfo.outputPath(`ipad-lobby-ki-${testInfo.project.name}.png`),
    animations: 'disabled',
  });

  // Entfernen per „✕“: Platz 3 ist wieder frei, die Nachbarzone blendet die Reihe aus.
  await touch.tap(await centerOf(seat(page, 1, 3, '-remove')));
  await expect(seat(page, 1, 3)).toHaveAttribute('data-kind', 'free');
  await expect(zone(page, 2).getByTestId('lobby-seats')).toHaveCount(0);
  expect(session.snapshot().players.some((p) => p.slot === 3)).toBe(false);

  expectNoProblems(problems, 'iPad');
});
