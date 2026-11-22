/**
 * KI-Plätze am Controller (CHAOS-182, ADR-020 §2) gegen den **echten** Server: Die Spielleitung
 * (verbundener Mensch mit der niedrigsten Platznummer) setzt in der Lobby eine KI, wechselt die
 * Stärke und entfernt sie wieder; ein zweites iPhone sieht die KI nur. Den Host spielt ein
 * synthetischer Host aus dem Testprozess (`fixtures/syntheticHost.ts`).
 *
 * Was das **nicht** beweist: echtes iOS-Safari und echte Finger (`docs/device-test-checklist.md`).
 */
import type { Page } from '@playwright/test';
import { collectProblems, expectNoProblems, type Problems } from './fixtures/pages.ts';
import type { RunningServer } from './fixtures/server.ts';
import { SyntheticHost } from './fixtures/syntheticHost.ts';
import { expect, test, type DeviceName } from './fixtures/test.ts';

// Mehrgeräte-Test: ein Projekt reicht.
test.skip(
  ({ viewport }) => (viewport?.width ?? 0) > (viewport?.height ?? 0),
  'Mehrgeräte-Test: läuft nur im Projekt iphone-hoch',
);

interface Phone {
  page: Page;
  problems: Problems;
}

async function openPhone(
  openDevice: (name: DeviceName) => Promise<Page>,
  server: RunningServer,
  slot: number,
): Promise<Phone> {
  const page = await openDevice('iPhone 13');
  const problems = collectProblems(page);
  await page.goto(server.joinUrl);
  await expect(page.getByTestId(`slot-${String(slot)}`)).toHaveAttribute('data-screen', 'lobby');
  return { page, problems };
}

let host: SyntheticHost | null = null;
test.afterEach(() => {
  host?.close();
  host = null;
});

test('Spielleitung setzt, ändert und entfernt eine KI; Mitspieler sehen sie nur', async ({
  openDevice,
  chaosServer,
}) => {
  host = await SyntheticHost.connect(chaosServer);
  const lead = await openPhone(openDevice, chaosServer, 1);
  const other = await openPhone(openDevice, chaosServer, 2);
  const session = chaosServer.server.session;

  // Spielleitung: eigene Reihe „Mitspieler“ mit „+ KI“ auf den freien Plätzen.
  const leadSeats = lead.page.getByTestId('lobby-seats');
  await expect(leadSeats).toHaveAttribute('data-lead', 'true');
  await expect(lead.page.getByTestId('lobby-seat-1')).toHaveAttribute('data-kind', 'self');
  await expect(lead.page.getByTestId('lobby-seat-2')).toHaveAttribute('data-kind', 'human');
  // Ohne KI und ohne Spielleitung zeigt das zweite iPhone keine Reihe.
  await expect(other.page.getByTestId('lobby-seats')).toHaveCount(0);

  await lead.page.getByTestId('lobby-seat-tap-3').click();
  await expect(lead.page.getByTestId('lobby-seat-3')).toHaveAttribute('data-kind', 'ai');
  await expect(lead.page.getByTestId('lobby-seat-3')).toHaveAttribute('data-strength', 'mittel');
  await expect(lead.page.getByTestId('lobby-seat-3')).toContainText('KI · Mittel');
  expect(session.snapshot().players.find((p) => p.slot === 3)).toMatchObject({ kind: 'ai' });

  // Tippen auf die KI wechselt die Stärke.
  await lead.page.getByTestId('lobby-seat-tap-3').click();
  await expect(lead.page.getByTestId('lobby-seat-3')).toHaveAttribute('data-strength', 'schwer');

  // Das zweite iPhone sieht die KI, aber ohne Knöpfe.
  const otherSeats = other.page.getByTestId('lobby-seats');
  await expect(otherSeats).toHaveAttribute('data-lead', 'false');
  await expect(other.page.getByTestId('lobby-seat-3')).toContainText('KI · Schwer');
  await expect(other.page.getByTestId('lobby-seat-tap-3')).toHaveCount(0);
  await expect(other.page.getByTestId('lobby-seat-remove-3')).toHaveCount(0);

  await expect(lead.page.getByTestId('slot-1')).toHaveScreenshot('controller-lobby-ki.png', {
    mask: [lead.page.locator('.ui-text, .player-symbol, .lobby-hint')],
  });

  // Entfernen: Platz 3 ist wieder frei.
  await lead.page.getByTestId('lobby-seat-remove-3').click();
  await expect(lead.page.getByTestId('lobby-seat-3')).toHaveAttribute('data-kind', 'free');
  await expect(other.page.getByTestId('lobby-seats')).toHaveCount(0);
  expect(session.snapshot().players.some((p) => p.slot === 3)).toBe(false);

  expectNoProblems(lead.problems, 'Spielleitung');
  expectNoProblems(other.problems, 'Mitspieler');
});
