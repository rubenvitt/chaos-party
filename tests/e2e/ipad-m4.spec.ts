import type { Page } from '@playwright/test';
import {
  createMessage,
  type ControllerMinigameInfo,
  type SlotNumber,
} from '../../packages/protocol/src/index.ts';
import { expect, test } from './fixtures/test.ts';
import { boardInfo, FakeSession, PROMPTS, VALID_CODE } from './fixtures/fakeSession.ts';
import { centerOf, TouchScreen } from './fixtures/touch.ts';

/**
 * Geteiltes iPad in M4 (CHAOS-36/37/38/55) gegen den Production-Build mit nachgebautem
 * Session-Server: Charakterwahl je Zone (2, 3, 4 Zonen), Brett-Entscheidungen, Pause,
 * Endstand und Minispiel-Ergebnis in jeder Zone, Drehen und Neuladen ohne Verlust.
 * Projekte `ipad-quer`/`ipad-hoch` (iPad-Pro-11-Emulation in Chromium, Mehrfinger per CDP).
 * Das beweist **nicht**, wie iPadOS-Safari mehrere Finger meldet (Gerätecheckliste).
 */

interface Problems {
  consoleErrors: string[];
  pageErrors: string[];
}

let problems: Problems;
let fake: FakeSession;

test.beforeEach(async ({ page }) => {
  problems = { consoleErrors: [], pageErrors: [] };
  page.on('console', (msg) => {
    if (msg.type() === 'error') problems.consoleErrors.push(msg.text());
  });
  page.on('pageerror', (error) => problems.pageErrors.push(error.message));
  fake = await FakeSession.attach(page);
  fake.autoStart = false;
});

test.afterEach(() => {
  expect(problems.pageErrors).toEqual([]);
  expect(problems.consoleErrors).toEqual([]);
  expect(fake.invalid).toEqual([]);
});

const zone = (page: Page, slot: number) => page.getByTestId(`zone-${String(slot)}`);
const card = (page: Page, slot: number, id: string) =>
  zone(page, slot).getByTestId(`character-${id}`);

const screenshotMask = (page: Page) => [
  page.locator(
    '.ui-text, .player-symbol, .ready-check, .character-check, .countdown, .link-pill, .control-key',
  ),
];

/**
 * Ungemaskierter Beleg: `M4_BELEG=docs/screenshots pnpm test:e2e ipad-m4` schreibt
 * `<ordner>/m4-ipad-<name>-<projekt>.png`.
 */
async function beleg(page: Page, name: string, project: string) {
  const dir = process.env.M4_BELEG;
  if (!dir) return;
  await page.screenshot({ path: `${dir}/m4-ipad-${name}-${project}.png`, animations: 'disabled' });
}

async function joinLobby(page: Page, seats: number) {
  await page.goto(`/?code=${VALID_CODE}&seats=${String(seats)}`);
  for (let slot = 1; slot <= seats; slot++) {
    await expect(zone(page, slot)).toHaveAttribute('data-screen', 'lobby');
  }
}

/** Alle Elemente einer Zone liegen ganz in ihrer Zone (gedreht oder nicht). */
async function expectInsideZones(page: Page, seats: number) {
  for (let slot = 1; slot <= seats; slot++) {
    const frame = await zone(page, slot).boundingBox();
    if (!frame) throw new Error('Zone unsichtbar');
    const boxes = await zone(page, slot)
      .locator('.zone-content *')
      .evaluateAll((els) =>
        els
          .map((el) => el.getBoundingClientRect())
          .filter((r) => r.width > 0 && r.height > 0)
          .map((r) => ({ x: r.x, y: r.y, w: r.width, h: r.height })),
      );
    for (const box of boxes) {
      expect(box.x).toBeGreaterThanOrEqual(frame.x - 0.5);
      expect(box.y).toBeGreaterThanOrEqual(frame.y - 0.5);
      expect(box.x + box.w).toBeLessThanOrEqual(frame.x + frame.width + 0.5);
      expect(box.y + box.h).toBeLessThanOrEqual(frame.y + frame.height + 0.5);
    }
  }
}

const PICKS: [SlotNumber, string][] = [
  [1, 'robot'],
  [2, 'cactus'],
  [3, 'raccoon'],
  [4, 'sock'],
];

test('vier Zonen: jede wählt gleichzeitig ihre Figur, Nachbarn sehen sie in deren Farbe', async ({
  page,
}, testInfo) => {
  fake.rounds = 3;
  await joinLobby(page, 4);
  const touch = await TouchScreen.create(page);
  await expect(zone(page, 3)).toHaveAttribute('data-rotation', '180');
  await expect(zone(page, 1).getByTestId('lobby-rounds')).toHaveText('3 Runden');

  // Vier Finger gleichzeitig, je Zone eine andere Figur.
  for (const [slot, id] of PICKS) await touch.down(slot, await centerOf(card(page, slot, id)));
  await expect(card(page, 3, 'raccoon')).toHaveAttribute('data-pressed', 'true');
  await touch.upAll();
  await expect
    .poll(() =>
      fake
        .ofType('pick-character')
        .map((m) => [m.slot, m.character])
        .sort(),
    )
    .toEqual(PICKS);
  for (const [slot, id] of PICKS) {
    await expect(card(page, slot, id)).toHaveAttribute('data-state', 'mine');
  }
  // Zone 1 sieht Wusel als vergeben an Grün (Platz 3, gleiches Gerät).
  await expect(card(page, 1, 'raccoon')).toHaveAttribute('data-state', 'taken');
  await expect(card(page, 1, 'raccoon')).toHaveAttribute('data-owner', '3');
  await expect(card(page, 1, 'raccoon')).toContainText('Grün');

  // Finger auf einer vergebenen Karte wählt nichts.
  const picks = fake.ofType('pick-character').length;
  await touch.tap(await centerOf(card(page, 2, 'robot')));
  await expect(card(page, 2, 'robot')).toHaveAttribute('data-state', 'taken');
  expect(fake.ofType('pick-character')).toHaveLength(picks);

  // Große Ziele in jeder Zone.
  for (const [slot, id] of PICKS) {
    const box = await card(page, slot, id).boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(88);
    expect(box?.height).toBeGreaterThanOrEqual(88);
    const ready = await zone(page, slot).getByTestId('ready-button').boundingBox();
    expect(ready?.height).toBeGreaterThanOrEqual(64);
  }
  await expectInsideZones(page, 4);
  await beleg(page, '4-zonen-lobby', testInfo.project.name);
  await expect(page).toHaveScreenshot('ipad-4-zonen-lobby.png', { mask: screenshotMask(page) });

  // Alle bereit (vier Finger), dann wählt Zone 2 um: nur Zone 2 ist wieder „nicht bereit“.
  for (const [slot] of PICKS) {
    await touch.down(slot, await centerOf(zone(page, slot).getByTestId('ready-button')));
  }
  await touch.upAll();
  await expect.poll(() => fake.ofType('ready').length).toBe(4);
  for (const [slot] of PICKS) {
    await expect(zone(page, slot).getByTestId('ready-done')).toBeVisible();
  }
  await beleg(page, '4-zonen-bereit', testInfo.project.name);
  // Alle vier Figuren sind vergeben. Damit Zone 2 umwählen kann, gibt der Fake Socke Sigi
  // frei (wie wenn Platz 4 seine Wahl verlöre); dann wählt Zone 2 um.
  fake.characters.delete(4);
  for (const slot of [1, 2, 3, 4] as const) fake.sendLobby(slot);
  await expect(card(page, 2, 'sock')).toHaveAttribute('data-state', 'free');
  await touch.tap(await centerOf(card(page, 2, 'sock')));
  await expect(card(page, 2, 'sock')).toHaveAttribute('data-state', 'mine');
  await expect(zone(page, 2).getByTestId('ready-button')).toBeVisible();
  await expect(zone(page, 1).getByTestId('ready-done')).toBeVisible();
});

test('Figur weggeschnappt: Hinweis erscheint in der betroffenen Zone, mit ihr gedreht', async ({
  page,
}, testInfo) => {
  await joinLobby(page, 2);
  const touch = await TouchScreen.create(page);
  const rotation = await zone(page, 1).getAttribute('data-rotation');
  fake.holdPicks = true;
  await touch.tap(await centerOf(card(page, 1, 'robot')));
  await expect(card(page, 1, 'robot')).toHaveAttribute('data-pending', 'true');
  // Ein iPhone (Platz 3) schnappt sich Schraubi, dann kommt die Ablehnung.
  fake.setExternalTaken(['robot'], { robot: 3 });
  fake.flushPicks();
  const toast = zone(page, 1).getByTestId('toast');
  await expect(toast).toHaveAttribute('data-code', 'character-taken');
  await expect(toast).toHaveAttribute('data-slot', '1');
  await expect(toast).toContainText('geschnappt');
  // Nur in dieser Zone, kein Hinweis mittig über beiden Zonen.
  await expect(page.getByTestId('toast')).toHaveCount(1);
  await expect(zone(page, 2).getByTestId('toast')).toHaveCount(0);
  await expect(zone(page, 1)).toHaveAttribute('data-rotation', rotation ?? '');
  // Besitzer-Farbe geräteübergreifend: Grün (Platz 3) hat Schraubi.
  await expect(card(page, 1, 'robot')).toHaveAttribute('data-owner', '3');
  await expect(card(page, 2, 'robot')).toHaveAttribute('data-owner', '3');
  await expectInsideZones(page, 2);
  await beleg(page, '2-zonen-weggeschnappt', testInfo.project.name);
});

test('drei Zonen: Lobby passt, freies Feld oben links', async ({ page }, testInfo) => {
  await joinLobby(page, 3);
  await expect(zone(page, 4)).toHaveCount(0);
  const touch = await TouchScreen.create(page);
  await touch.tap(await centerOf(card(page, 3, 'sock')));
  await expect(card(page, 3, 'sock')).toHaveAttribute('data-state', 'mine');
  await expect(card(page, 1, 'sock')).toHaveAttribute('data-owner', '3');
  await expectInsideZones(page, 3);
  await beleg(page, '3-zonen-lobby', testInfo.project.name);
  await expect(page).toHaveScreenshot('ipad-3-zonen-lobby.png', { mask: screenshotMask(page) });
});

test('vier Zonen im Brett: Entscheidungen je Zone, auch in der gedrehten Zone', async ({
  page,
}, testInfo) => {
  await joinLobby(page, 4);
  const touch = await TouchScreen.create(page);
  fake.sendBoard(1, boardInfo({ activeSlot: 1 }), PROMPTS.roll(11, 1));
  fake.sendBoard(2, boardInfo({ activeSlot: 1, character: 'cactus' }));
  fake.sendBoard(
    3,
    boardInfo({ activeSlot: 1, character: 'raccoon' }),
    PROMPTS.reaction(12, 3, 8000),
  );
  fake.sendBoard(4, boardInfo({ activeSlot: 1, character: 'sock' }), PROMPTS.path(13, 4));
  for (const slot of [1, 2, 3, 4]) {
    await expect(zone(page, slot)).toHaveAttribute('data-screen', 'board');
  }
  await expectInsideZones(page, 4);
  await beleg(page, '4-zonen-brett', testInfo.project.name);
  await expect(page).toHaveScreenshot('ipad-4-zonen-brett.png', { mask: screenshotMask(page) });

  // Zone 3 (gedreht) reagiert, Zone 4 wählt den Weg, Zone 1 würfelt – gleichzeitig.
  await touch.down(1, await centerOf(zone(page, 3).getByTestId('choice-shield')));
  await touch.down(2, await centerOf(zone(page, 4).getByTestId('choice-s20')));
  await touch.down(3, await centerOf(zone(page, 1).getByTestId('choice-roll')));
  await touch.upAll();
  await expect
    .poll(() =>
      fake
        .ofType('choose')
        .map((m) => [m.slot, m.option])
        .sort(),
    )
    .toEqual([
      [1, 'roll'],
      [3, 'shield'],
      [4, 's20'],
    ]);
});

test('vier Zonen: Pause, Minispiel-Ergebnis mit Gleichstand und Endstand in jeder Zone', async ({
  page,
}, testInfo) => {
  await joinLobby(page, 4);
  for (const slot of [1, 2, 3, 4] as const) fake.sendBoard(slot, boardInfo({ paused: true }));
  for (const slot of [1, 2, 3, 4]) {
    await expect(zone(page, slot)).toHaveAttribute('data-screen', 'pause');
    await expect(zone(page, slot).getByTestId('pause-panel')).toContainText(
      'Der PC hat angehalten',
    );
  }
  await expectInsideZones(page, 4);
  await beleg(page, '4-zonen-pause', testInfo.project.name);
  await expect(page).toHaveScreenshot('ipad-4-zonen-pause.png', { mask: screenshotMask(page) });

  const info: ControllerMinigameInfo = {
    id: 'pump-parade',
    title: 'Pump-Parade',
    tagline: 'Pumpt euren Ballon am schnellsten auf!',
    instructions: ['Tippe A so oft du kannst.'],
    controls: { joystick: null, a: 'Pumpen', b: null },
    stage: 'results',
    scoreUnit: 'Pumpstöße',
    tied: false,
    aborted: false,
  };
  const results: Record<number, Partial<ControllerMinigameInfo>> = {
    1: { place: 1, tied: true, reward: 5 },
    2: { place: 1, tied: true, reward: 5 },
    3: { place: 3, reward: 1 },
    4: { place: 4, reward: 0 },
  };
  for (const slot of [1, 2, 3, 4] as const) {
    fake.send(
      createMessage('context', {
        slot,
        phase: 'board',
        layout: 'board',
        actions: [],
        board: boardInfo({ gamePhase: 'minigame-results', activeSlot: null }),
        minigame: { ...info, ...results[slot] },
      }),
    );
  }
  await expect(zone(page, 2).getByTestId('result-place')).toHaveText('Geteilter Platz 1!');
  await expect(zone(page, 1).getByTestId('result-reward')).toHaveText('+5 Münzen');
  await expect(zone(page, 3).getByTestId('result-reward')).toHaveText('+1 Münze');
  await expectInsideZones(page, 4);
  await beleg(page, '4-zonen-minispiel', testInfo.project.name);

  const finals: [SlotNumber, number, boolean, string][] = [
    [1, 1, true, 'robot'],
    [2, 1, true, 'cactus'],
    [3, 3, false, 'raccoon'],
    [4, 4, false, 'sock'],
  ];
  for (const [slot, place, tied, character] of finals) {
    fake.sendBoard(
      slot,
      boardInfo({
        gamePhase: 'game-results',
        activeSlot: null,
        place,
        tied,
        endedEarly: true,
        character: character as 'robot',
      }),
    );
  }
  await expect(zone(page, 1).getByTestId('final-place')).toHaveText('Geteilter Platz 1');
  await expect(zone(page, 4).getByTestId('final-place')).toHaveText('Platz 4');
  await expect(zone(page, 3).getByTestId('final-ended-early')).toBeVisible();
  await expectInsideZones(page, 4);
  await beleg(page, '4-zonen-endstand', testInfo.project.name);
  await expect(page).toHaveScreenshot('ipad-4-zonen-endstand.png', {
    mask: screenshotMask(page),
  });

  // Revanche: jede Zone zurück in der Lobby, „Bereit!“ wieder da.
  fake.rematch();
  for (const slot of [1, 2, 3, 4]) {
    await expect(zone(page, slot)).toHaveAttribute('data-screen', 'lobby');
    await expect(zone(page, slot).getByTestId('ready-button')).toBeVisible();
  }
});

test('zwei Zonen: Daumen nach dem Minispiel, jede Zone für sich, Umentscheiden (CHAOS-218)', async ({
  page,
}, testInfo) => {
  await joinLobby(page, 2);
  const touch = await TouchScreen.create(page);
  const info: ControllerMinigameInfo = {
    id: 'pump-parade',
    title: 'Pump-Parade',
    tagline: 'Pumpt euren Ballon am schnellsten auf!',
    instructions: ['Tippe A so oft du kannst.'],
    controls: { joystick: null, a: 'Pumpen', b: null },
    stage: 'results',
    scoreUnit: 'Pumpstöße',
    tied: false,
    aborted: false,
  };
  const results = (slot: SlotNumber, rate: boolean, vote?: 'up' | 'down') =>
    createMessage('context', {
      slot,
      phase: 'board',
      layout: 'board',
      actions: rate ? ['rate'] : [],
      board: boardInfo({ gamePhase: 'minigame-results', activeSlot: null, round: 2 }),
      minigame: {
        ...info,
        place: slot === 1 ? 1 : 2,
        score: slot === 1 ? 31 : 24,
        reward: slot === 1 ? 10 : 5,
        ...(vote && { vote }),
      },
    });
  for (const slot of [1, 2] as const) fake.send(results(slot, true));

  for (const slot of [1, 2]) {
    await expect(zone(page, slot).getByTestId('minigame-vote')).toHaveAttribute(
      'data-selected',
      '',
    );
    await expect(zone(page, slot).getByTestId('vote-up')).toHaveAttribute('aria-pressed', 'false');
  }
  await expect(zone(page, 1).getByTestId('result-reward')).toHaveText('+10 Münzen');
  await expectInsideZones(page, 2);
  await beleg(page, '2-zonen-daumen', testInfo.project.name);
  await expect(page).toHaveScreenshot('ipad-2-zonen-daumen.png', { mask: screenshotMask(page) });

  // Zwei Finger gleichzeitig: Zone 1 👍, Zone 2 👎; die Wahl leuchtet sofort.
  await touch.down(1, await centerOf(zone(page, 1).getByTestId('vote-up')));
  await touch.down(2, await centerOf(zone(page, 2).getByTestId('vote-down')));
  await expect(zone(page, 1).getByTestId('vote-up')).toHaveAttribute('data-pressed', 'true');
  await touch.upAll();
  await expect(zone(page, 1).getByTestId('vote-up')).toHaveAttribute('aria-pressed', 'true');
  await expect(zone(page, 2).getByTestId('vote-down')).toHaveAttribute('aria-pressed', 'true');
  await expect(zone(page, 1).getByTestId('vote-down')).toHaveAttribute('aria-pressed', 'false');
  await expect
    .poll(() =>
      fake
        .ofType('rate')
        .map((m) => [m.slot, m.vote, m.minigameId, m.round])
        .sort(),
    )
    .toEqual([
      [1, 'up', 'pump-parade', 2],
      [2, 'down', 'pump-parade', 2],
    ]);
  await expect(page).toHaveScreenshot('ipad-2-zonen-daumen-gewaehlt.png', {
    mask: screenshotMask(page),
  });

  // Umentscheiden in Zone 1; Zone 2 bleibt.
  await touch.tap(await centerOf(zone(page, 1).getByTestId('vote-down')));
  await expect(zone(page, 1).getByTestId('vote-down')).toHaveAttribute('aria-pressed', 'true');
  await expect(zone(page, 1).getByTestId('vote-up')).toHaveAttribute('aria-pressed', 'false');
  await expect.poll(() => fake.ofType('rate').length).toBe(3);
  expect(fake.ofType('rate').at(-1)).toMatchObject({ slot: 1, vote: 'down' });

  // Server bestätigt, dann endet das Abstimmen: Knöpfe weg, Ergebnis bleibt.
  fake.send(results(1, true, 'down'));
  fake.send(results(2, true, 'down'));
  await expect(zone(page, 1).getByTestId('minigame-vote')).toHaveAttribute('data-selected', 'down');
  for (const slot of [1, 2] as const) fake.send(results(slot, false));
  for (const slot of [1, 2]) {
    await expect(zone(page, slot).getByTestId('minigame-vote')).toHaveCount(0);
    await expect(zone(page, slot).getByTestId('minigame-result')).toBeVisible();
  }
  expect(fake.ofType('rate')).toHaveLength(3);
});

test('Drehen und Neuladen in der Lobby: Figuren und Bereit-Stand je Zone bleiben', async ({
  page,
}) => {
  await joinLobby(page, 2);
  const touch = await TouchScreen.create(page);
  await touch.tap(await centerOf(card(page, 1, 'cactus')));
  await touch.tap(await centerOf(card(page, 2, 'sock')));
  await touch.tap(await centerOf(zone(page, 2).getByTestId('ready-button')));
  await expect(zone(page, 2).getByTestId('ready-done')).toBeVisible();

  // Finger liegt beim Drehen auf einer Karte: wird losgelassen, wählt nichts.
  await touch.down(1, await centerOf(card(page, 1, 'robot')));
  const size = page.viewportSize();
  if (!size) throw new Error('kein Viewport');
  await page.setViewportSize({ width: size.height, height: size.width });
  await expect(card(page, 1, 'cactus')).toHaveAttribute('data-state', 'mine');
  await touch.upAll();
  expect(fake.ofType('pick-character').map((m) => m.character)).toEqual(['cactus', 'sock']);
  await expect(zone(page, 2).getByTestId('ready-done')).toBeVisible();
  await expectInsideZones(page, 2);

  await page.reload();
  await expect(card(page, 1, 'cactus')).toHaveAttribute('data-state', 'mine');
  await expect(card(page, 2, 'sock')).toHaveAttribute('data-state', 'mine');
  await expect(card(page, 1, 'sock')).toHaveAttribute('data-owner', '2');
  await expect(zone(page, 2).getByTestId('ready-done')).toBeVisible();
  await expect(zone(page, 1).getByTestId('ready-button')).toBeVisible();
});

test('Neuladen im Brett und im Minispiel: jede Zone bekommt ihren Bildschirm zurück', async ({
  page,
}) => {
  await joinLobby(page, 2);
  fake.sendBoard(1, boardInfo({ activeSlot: 1 }), PROMPTS.roll(21, 1));
  fake.sendBoard(2, boardInfo({ activeSlot: 1, paused: true }));
  await expect(zone(page, 1)).toHaveAttribute('data-screen', 'board');
  await expect(zone(page, 2)).toHaveAttribute('data-screen', 'pause');
  await page.reload();
  await expect(zone(page, 1).getByTestId('choice-roll')).toBeVisible();
  await expect(zone(page, 2)).toHaveAttribute('data-screen', 'pause');

  fake.send(
    createMessage('context', {
      slot: 1,
      phase: 'board',
      layout: 'joystick-buttons',
      actions: ['button-a'],
      board: boardInfo({ gamePhase: 'minigame-play', activeSlot: null }),
      minigame: {
        id: 'pump-parade',
        title: 'Pump-Parade',
        tagline: 'Pumpt euren Ballon am schnellsten auf!',
        instructions: ['Tippe A so oft du kannst.'],
        controls: { joystick: null, a: 'Pumpen', b: null },
        stage: 'play',
        scoreUnit: 'Pumpstöße',
        tied: false,
        aborted: false,
      },
    }),
  );
  await expect(zone(page, 1)).toHaveAttribute('data-screen', 'play');
  await fake.drop();
  await expect.poll(() => fake.connections).toBe(3);
  await expect(zone(page, 1).getByTestId('button-a')).toBeVisible();
  await page.reload();
  await expect(zone(page, 1)).toHaveAttribute('data-screen', 'play');
  await expect(zone(page, 1).getByTestId('button-a')).toBeVisible();
});

test('Schnellfeuer (CHAOS-231): jede Zone zeigt das Bildwort und nur die Knöpfe des Mikro-Spiels', async ({
  page,
}) => {
  await joinLobby(page, 2);
  const schnellfeuer: ControllerMinigameInfo = {
    id: 'schnellfeuer',
    title: 'Schnellfeuer!',
    tagline: 'Fünf Mikro-Spiele am Stück – das Bildwort sagt, was zu tun ist.',
    instructions: ['Fünf Mikro-Spiele, je ein paar Sekunden.'],
    controls: { joystick: 'Zielen', a: 'Los!', b: null },
    stage: 'play',
    scoreUnit: 'Punkte',
    tied: false,
    aborted: false,
  };
  const play = (slot: SlotNumber, cue: ControllerMinigameInfo['cue']) => {
    fake.send(
      createMessage('context', {
        slot,
        phase: 'board',
        layout: 'joystick-buttons',
        actions: ['move', 'button-a'],
        board: boardInfo({ gamePhase: 'minigame-play', activeSlot: null }),
        minigame: cue ? { ...schnellfeuer, cue } : schnellfeuer,
      }),
    );
  };
  const hauen = {
    step: 0,
    steps: 5,
    icon: '⏰',
    word: 'HAUEN!',
    controls: { joystick: null, a: 'Hauen', b: null },
    double: false,
  };
  for (const slot of [1, 2] as const) play(slot, hauen);
  for (const slot of [1, 2] as const) {
    await expect(zone(page, slot)).toHaveAttribute('data-screen', 'play');
    await expect(zone(page, slot).getByTestId('minigame-cue-word')).toHaveText('HAUEN!');
    await expect(zone(page, slot).getByTestId('joystick')).toHaveCount(0);
    await expect(zone(page, slot).getByTestId('button-a')).toContainText('Hauen');
  }
  await expectInsideZones(page, 2);

  // Finale mit Stick: Zone 1 bekommt es zuerst, Zone 2 zeigt noch das alte Bildwort.
  const halbieren = {
    ...hauen,
    step: 4,
    icon: '🍰',
    word: 'HALBIEREN!',
    controls: { joystick: 'Messer', a: 'Schneiden', b: null },
    double: true,
  };
  play(1, halbieren);
  await expect(zone(page, 1).getByTestId('minigame-cue-word')).toHaveText('HALBIEREN!');
  await expect(zone(page, 1).getByTestId('minigame-header')).toHaveAttribute('data-double', 'true');
  await expect(zone(page, 1).getByTestId('joystick')).toBeVisible();
  await expect(zone(page, 1).getByTestId('button-a')).toContainText('Schneiden');
  await expect(zone(page, 2).getByTestId('minigame-cue-word')).toHaveText('HAUEN!');
  await expectInsideZones(page, 2);

  // Ohne Hinweis (älterer Host): Titel und die Vereinigung wie bisher.
  play(2, undefined);
  await expect(zone(page, 2).getByTestId('minigame-cue-word')).toHaveCount(0);
  await expect(zone(page, 2).getByTestId('minigame-header')).toContainText('Schnellfeuer!');
  await expect(zone(page, 2).getByTestId('joystick')).toBeVisible();
  await expect(zone(page, 2).getByTestId('button-a')).toContainText('Los!');
});
