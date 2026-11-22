/**
 * Minispiel-Galerie und Stimmen am Apple-Host (CHAOS-220) mit dem echten Bündel im nackten
 * `node:vm`-Kontext: `practice:<id>` startet eine Übungsrunde, das Ergebnis kommt ohne Münzen,
 * Daumen der Controller landen über `env.saveRatings` im Dateiformat des Node-Servers, danach
 * geht es zurück in die Lobby. Ein zweiter Kern mit dem gespeicherten Inhalt (`env.ratings`)
 * kennt die Stimmen noch – so übersteht die Galerie einen App-Neustart. Der Swift-Harness
 * (`../harness/main.swift`, Modus `uebung`) prüft dasselbe in JavaScriptCore mit `RatingsStorage`.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { getMinigameInfo } from '@chaos-party/minigames/catalog';
import { HAVOK_WASM_SOURCE, bundle } from '../build.mjs';
import { parseRatingsFile } from '../../server/src/ratings.ts';
import { PRACTICE_NOTE } from '../../host/src/minigame/results.ts';
import { RENDER_STATE_EXAMPLES } from '../src/examples.ts';
import {
  GalleryStateSchema,
  RenderStateSchema,
  type ChaosHostInstance,
  type GalleryState,
  type HostEnv,
  type RenderState,
} from '../src/contract.ts';
import { JOIN_CODE, loadBundle, PROBLEM_MARKERS, seededBytes, settle } from './botMatch.ts';

let code = '';
let wasm: Uint8Array = new Uint8Array();

beforeAll(async () => {
  code = await bundle({ write: false });
  wasm = readFileSync(HAVOK_WASM_SOURCE);
}, 60_000);

const STEP_MS = 1000 / 60;
const CLOCK_OFFSET_MS = 987_654;

interface Bot {
  readonly id: number;
  readonly name: string;
  readonly character: string;
  readonly vote: 'up' | 'down';
  seq: number;
  slot: number | null;
  picked: boolean;
  voted: string | null;
}

/** Ein Kern mit zwei Bot-Controllern, die beitreten, „Bereit“ drücken und im Ergebnis abstimmen. */
async function startHost(ratings: string | null) {
  const { api } = loadBundle(code);
  const outbox: [number, string][] = [];
  const logs: string[] = [];
  const saved: string[] = [];
  const unreadable: string[] = [];
  const serverErrors: string[] = [];
  const env: HostEnv = {
    send: (id, text) => outbox.push([id, text]),
    close: (id, closeCode, reason) => {
      throw new Error(`Host schließt ${String(id)}: ${String(closeCode)} ${reason}`);
    },
    log: (line) => logs.push(line),
    randomBytes: seededBytes(21),
    havokWasm: wasm,
    joinUrl: `http://192.168.0.2:8787/?code=${JOIN_CODE}`,
    joinCode: JOIN_CODE,
    ratings,
    saveRatings: (json) => saved.push(json),
    ratingsUnreadable: (reason) => unreadable.push(reason),
  };
  const host: ChaosHostInstance = api.create(env);
  await settle();

  const seats: Pick<Bot, 'id' | 'name' | 'character' | 'vote'>[] = [
    { id: 1, name: 'Anna', character: 'raccoon', vote: 'up' },
    { id: 2, name: 'Ben', character: 'sock', vote: 'down' },
  ];
  const bots: Bot[] = seats.map((bot) => ({
    ...bot,
    seq: 0,
    slot: null,
    picked: false,
    voted: null,
  }));
  const send = (bot: Bot, type: string, fields: Record<string, unknown>) => {
    host.message(bot.id, JSON.stringify({ v: 4, type, ...fields }));
  };
  const handle = (bot: Bot, text: string) => {
    const m = JSON.parse(text) as Record<string, unknown>;
    if (m.type === 'welcome') bot.slot = (m.players as { slot: number }[])[0]?.slot ?? null;
    if (m.type === 'error')
      serverErrors.push(`${bot.name}: ${String(m.code)} ${String(m.message)}`);
    if (m.type !== 'context' || bot.slot === null) return;
    const actions = (m.actions as string[] | undefined) ?? [];
    const slot = bot.slot;
    if (actions.includes('pick-character') && !bot.picked) {
      bot.picked = true;
      send(bot, 'pick-character', { slot, seq: ++bot.seq, character: bot.character });
    } else if (actions.includes('ready') && bot.picked) {
      send(bot, 'ready', { slot, seq: ++bot.seq });
    }
    // Daumen wie der Web-Controller: Minispiel aus dem Kontext, Runde aus dem Brett.
    const minigame = m.minigame as { id: string } | undefined;
    const round = (m.board as { round?: number } | undefined)?.round;
    const key = minigame && round !== undefined ? `${minigame.id}:${String(round)}` : null;
    if (actions.includes('rate') && minigame && key !== null && key !== bot.voted) {
      bot.voted = key;
      send(bot, 'rate', { slot, seq: ++bot.seq, minigameId: minigame.id, round, vote: bot.vote });
    }
  };
  const drain = () => {
    while (outbox.length > 0) {
      for (const [id, text] of outbox.splice(0)) {
        const bot = bots.find((entry) => entry.id === id);
        if (bot) handle(bot, text);
      }
    }
  };

  for (const bot of bots) {
    host.open(bot.id);
    send(bot, 'join', { joinCode: JOIN_CODE, seats: 1, names: [bot.name] });
  }
  drain();

  let now = 0;
  const state = (): RenderState => RenderStateSchema.parse(JSON.parse(host.renderState()));
  const gallery = (): GalleryState => GalleryStateSchema.parse(JSON.parse(host.gallery()));
  /** Ticks mit 60 Hz, bis `done` wahr ist; Herzschläge alle 5 s. */
  const runUntil = async (done: (s: RenderState) => boolean, limitMs: number) => {
    const end = now + limitMs;
    let lastBeat = now;
    while (now < end) {
      now += STEP_MS;
      host.tick(now + CLOCK_OFFSET_MS);
      await settle();
      drain();
      if (now - lastBeat >= 5000) {
        lastBeat = now;
        for (const bot of bots) send(bot, 'heartbeat', { t: now });
        drain();
      }
      const current = state();
      if (done(current)) return current;
    }
    throw new Error(`Zeitlimit: Phase ${state().phase}`);
  };
  return { host, logs, saved, unreadable, serverErrors, state, gallery, runUntil, drain };
}

const problems = (logs: readonly string[]) =>
  logs.filter((line) => PROBLEM_MARKERS.some((marker) => line.includes(marker)));

describe('Minispiel-Galerie am Apple-Host (CHAOS-220)', () => {
  it('listet die Galerie, übt ein Minispiel ohne Münzen, speichert die Daumen und kehrt in die Lobby zurück', async () => {
    const h = await startHost(null);
    const before = h.gallery();
    expect(before.revision).toBe(0);
    expect(before.votes).toBe(0);
    expect(before.rows.length).toBeGreaterThan(0);
    expect(before.rows.every((row) => row.up === 0 && row.down === 0)).toBe(true);
    expect(before.rows[0]?.votesText).toBe('Noch keine Stimmen');
    expect(h.state().lobby.galleryRevision).toBe(0);

    // Kürzestes Spiel ohne Physik, damit der Test schnell bleibt; seit CHAOS-230 dürfen das auch
    // die Team-Testspiele sein (Team-Ausgang im Ergebnis).
    const target = [...before.rows]
      .filter((row) => getMinigameInfo(row.id)?.physics !== true)
      .sort((a, b) => a.seconds - b.seconds)[0];
    if (!target) throw new Error('kein Spiel in der Galerie');

    // Ungültiges geht nicht an den Server.
    h.host.hostCommand('practice:gibt-es-nicht');
    h.host.hostCommand('practice:Socken Regen');
    expect(h.logs).toContain(
      'Host-Befehl practice:gibt-es-nicht ignoriert: Minispiel nicht in der Galerie',
    );
    expect(h.logs).toContain('Ungültiger Host-Befehl: practice:Socken Regen');

    h.host.hostCommand(`practice:${target.id}`);
    h.drain();
    const results = await h.runUntil(
      (s) => s.phase === 'minigame' && s.minigame?.stage === 'results',
      (target.seconds + 90) * 1000,
    );
    expect(results.minigame?.id).toBe(target.id);
    expect(results.board?.rounds).toBe(1);
    expect(results.minigame?.results?.practice).toBe(true);
    expect(results.minigame?.results?.practiceNote).toBe(PRACTICE_NOTE);
    // Das Beispiel für Swift (Fixture) zeigt denselben Text.
    expect(
      RENDER_STATE_EXAMPLES['minigame-practice-results']?.minigame?.results?.practiceNote,
    ).toBe(PRACTICE_NOTE);
    expect(results.minigame?.results?.rows.every((row) => row.coins === null)).toBe(true);
    // In der Übungsrunde geht kein zweiter Start.
    h.host.hostCommand(`practice:${target.id}`);
    expect(h.logs).toContain(`Host-Befehl practice:${target.id} ignoriert: nur in der Lobby`);

    const lobby = await h.runUntil((s) => s.phase === 'lobby', 30_000);
    expect(h.serverErrors).toEqual([]);
    expect(lobby.board).toBeNull();
    expect(lobby.lobby.galleryRevision).toBe(2);

    const after = h.gallery();
    expect(after.revision).toBe(2);
    expect(after.votes).toBe(2);
    expect(after.rows.find((row) => row.id === target.id)).toMatchObject({
      up: 1,
      down: 1,
      votesText: '2 Stimmen',
    });

    // Jede Stimme ging sofort an Swift, im Format der Stimmen-Datei des Node-Servers.
    expect(h.saved).toHaveLength(2);
    const stored = parseRatingsFile(h.saved.at(-1) ?? '');
    expect(stored.map((v) => [v.minigameId, v.slot, v.vote, v.practice])).toEqual([
      [target.id, 1, 'up', true],
      [target.id, 2, 'down', true],
    ]);

    const exported = JSON.parse(h.host.ratingsExport()) as {
      format: string;
      games: { id: string; up: number; down: number }[];
      votes: unknown[];
    };
    expect(exported.format).toBe('chaos-party-minigame-ratings');
    expect(exported.games.find((g) => g.id === target.id)).toMatchObject({ up: 1, down: 1 });
    expect(exported.votes).toHaveLength(2);

    expect(h.serverErrors).toEqual([]);
    expect(problems(h.logs)).toEqual([]);

    // „Neustart“: neuer Kern mit dem gespeicherten Inhalt.
    const restarted = await startHost(h.saved.at(-1) ?? null);
    expect(restarted.logs).toContain('Stimmen geladen: 2');
    expect(restarted.gallery().rows.find((row) => row.id === target.id)).toMatchObject({
      up: 1,
      down: 1,
    });
    expect(restarted.unreadable).toEqual([]);
  }, 120_000);

  it('meldet eine unlesbare Stimmen-Datei, beginnt ohne Stimmen und überschreibt nichts', async () => {
    const h = await startHost('{ kaputt');
    expect(h.unreadable).toHaveLength(1);
    expect(h.logs.some((line) => line.startsWith('WARN Stimmen-Datei unlesbar'))).toBe(true);
    expect(h.gallery().votes).toBe(0);
    expect(h.saved).toEqual([]);
    expect(problems(h.logs)).toEqual([]);
  });
});
