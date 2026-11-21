/**
 * Das echte Bündel in einem nackten `node:vm`-Kontext (CHAOS-139): lädt ohne Node-/DOM-APIs,
 * setzt keine DOM-Globals, und eine Bot-Partie läuft bis zum ersten angenommenen Minispiel mit
 * vertragsgemäßem `renderState`. Die ganze Partie läuft in der CI über
 * `pnpm --filter @chaos-party/apple-host bots --full` (Node) und im Swift-Harness (JSC).
 */
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { getMinigameInfo } from '@chaos-party/minigames/catalog';
import { HAVOK_WASM_SOURCE, bundle } from '../build.mjs';
import { RESULT_MARGIN_MS } from '../../host/src/minigame/plan.ts';
import { RenderStateSchema, type RenderState } from '../src/contract.ts';
import { PROBLEM_MARKERS, loadBundle, runBotMatch, seededBytes, settle } from './botMatch.ts';

let code = '';
let wasm: Uint8Array = new Uint8Array();

beforeAll(async () => {
  code = await bundle({ write: false });
  wasm = readFileSync(HAVOK_WASM_SOURCE);
}, 60_000);

/** Brett-Knöpfe der Lobby (CHAOS-197), Rummelplatz seit CHAOS-199, Frostgipfel seit CHAOS-198. */
const BOARD_CHOICES = [
  { id: 'wackelwald', name: 'Wackelwald', detail: '74 Felder', selected: true, random: false },
  { id: 'rummelplatz', name: 'Rummelplatz', detail: '81 Felder', selected: false, random: false },
  { id: 'frostgipfel', name: 'Frostgipfel', detail: '75 Felder', selected: false, random: false },
  { id: 'zufall', name: 'Zufall', detail: 'Überraschung!', selected: false, random: true },
];

describe('Bündel', () => {
  it('lädt im nackten Kontext und setzt nur ChaosHost, ChaosHostInternals und Polyfills', () => {
    const { api, internals } = loadBundle(code);
    expect(typeof api.create).toBe('function');
    expect(internals.rotation.length).toBeGreaterThan(0);
    expect(code).not.toMatch(/require\(["']node:/);
  });

  it('enthält kein `ws` und keinen Node-Import', () => {
    expect(code).not.toContain('WebSocketServer');
    expect(code).not.toContain('node:crypto');
  });

  it('liefert schon vor dem ersten tick einen gültigen Lobby-Zustand', async () => {
    const { api } = loadBundle(code);
    const logs: string[] = [];
    const host = api.create({
      send: () => undefined,
      close: () => undefined,
      log: (line) => logs.push(line),
      randomBytes: seededBytes(7),
      havokWasm: wasm,
      joinUrl: 'http://10.0.0.5:8787/?code=WXYZ',
      joinCode: 'WXYZ',
    });
    await settle();
    const state = RenderStateSchema.parse(JSON.parse(host.renderState()));
    expect(state.phase).toBe('lobby');
    expect(state.lobby).toEqual({
      joinUrl: 'http://10.0.0.5:8787/?code=WXYZ',
      joinCode: 'WXYZ',
      players: [],
      // Die Host-Rolle hat die erste `lobby` schon in `create` (Verbindung im Prozess).
      settings: {
        rounds: 10,
        roundPresets: [10, 16, 20],
        moreReactionTime: false,
        board: 'wackelwald',
        boards: BOARD_CHOICES,
      },
    });
    expect(logs).toContain('Havok geladen');
    host.hostCommand('gibt-es-nicht');
    expect(logs.some((line) => line.includes('Unbekannter Host-Befehl: gibt-es-nicht'))).toBe(true);
  });

  it('schaltet die Regel Rückenwind nur mit HostEnv.tailwind ein (CHAOS-188)', async () => {
    const { api } = loadBundle(code);
    const logsOf = (tailwind: boolean | undefined) => {
      const logs: string[] = [];
      api.create({
        send: () => undefined,
        close: () => undefined,
        log: (line) => logs.push(line),
        randomBytes: seededBytes(4),
        havokWasm: wasm,
        joinUrl: 'http://10.0.0.5:8787/?code=WXYZ',
        joinCode: 'WXYZ',
        ...(tailwind === undefined ? {} : { tailwind }),
      });
      return logs;
    };
    const on = logsOf(true);
    const off = logsOf(false);
    const missing = logsOf(undefined);
    await settle();
    expect(on).toContain('Regel Rückenwind an');
    expect(off).not.toContain('Regel Rückenwind an');
    expect(missing).not.toContain('Regel Rückenwind an');
  });

  it('übernimmt configure in der Lobby und meldet Ungültiges (CHAOS-166)', async () => {
    const { api } = loadBundle(code);
    const logs: string[] = [];
    const host = api.create({
      send: () => undefined,
      close: () => undefined,
      log: (line) => logs.push(line),
      randomBytes: seededBytes(9),
      havokWasm: wasm,
      joinUrl: 'http://10.0.0.5:8787/?code=WXYZ',
      joinCode: 'WXYZ',
    });
    await settle();
    const settings = () => RenderStateSchema.parse(JSON.parse(host.renderState())).lobby.settings;

    host.hostCommand('configure:rounds=12');
    await settle();
    expect(settings()).toMatchObject({
      rounds: 12,
      roundPresets: [10, 16, 20],
      moreReactionTime: false,
    });

    host.hostCommand('configure:moreReactionTime=1');
    await settle();
    expect(settings()).toMatchObject({
      rounds: 12,
      roundPresets: [10, 16, 20],
      moreReactionTime: true,
    });

    host.hostCommand('configure:rounds=3,moreReactionTime=0');
    await settle();
    expect(settings()).toMatchObject({
      rounds: 3,
      roundPresets: [10, 16, 20],
      moreReactionTime: false,
    });

    // Brett (CHAOS-197): Zufall wählen, zurück auf Wackelwald; unbekanntes Brett lehnt der Server ab.
    host.hostCommand('configure:board=zufall');
    await settle();
    expect(settings()?.board).toBe('zufall');
    expect(
      settings()
        ?.boards.filter((b) => b.selected)
        .map((b) => b.id),
    ).toEqual(['zufall']);
    host.hostCommand('configure:board=gibt-es-nicht');
    await settle();
    expect(settings()?.board).toBe('zufall');
    host.hostCommand('configure:board=wackelwald');
    await settle();
    expect(settings()).toEqual({
      rounds: 3,
      roundPresets: [10, 16, 20],
      moreReactionTime: false,
      board: 'wackelwald',
      boards: BOARD_CHOICES,
    });

    host.hostCommand('configure:rounds=21');
    host.hostCommand('configure:moreReactionTime=ja');
    await settle();
    expect(settings()?.rounds).toBe(3);
    expect(logs).toContain('Ungültiger Host-Befehl: configure:rounds=21');
    expect(logs).toContain('Ungültiger Host-Befehl: configure:moreReactionTime=ja');
    // Nur das unbekannte Brett meldet der Server (die Lobby bietet es nie an, nur `--brett=`).
    expect(logs.filter((line) => PROBLEM_MARKERS.some((m) => line.includes(m)))).toEqual([
      'Server-Fehler an Host: bad-message Unbekanntes Brett: gibt-es-nicht',
    ]);
  });

  it('spielt mit den Lobby-Einstellungen aus configure; danach geht configure ins Leere', async () => {
    const lines: string[] = [];
    let boardState: RenderState | undefined;
    const result = await runBotMatch({
      code,
      wasm,
      full: false,
      seed: 11,
      beforeStart: ['configure:rounds=12', 'configure:moreReactionTime=1'],
      afterStart: ['configure:rounds=4'],
      log: (line) => lines.push(line),
      onPhase: (key, state) => {
        if (key === 'board') boardState ??= state;
      },
    });
    expect(result.exceptions).toEqual([]);
    expect(result.problems).toEqual([]);
    expect(result.serverErrors).toEqual([]);
    expect(result.contractErrors).toEqual([]);
    expect(result.ok).toBe(true);
    // Die Partie nutzt die Werte: 12 Runden, Schalter an.
    expect(boardState?.board?.rounds).toBe(12);
    expect(boardState?.lobby.settings).toEqual({
      rounds: 12,
      roundPresets: [10, 16, 20],
      moreReactionTime: true,
      board: 'wackelwald',
      boards: BOARD_CHOICES,
    });
    expect(lines).toContain('  js: Host-Befehl configure:rounds=4 ignoriert: nur in der Lobby');
  }, 60_000);

  it('spielt mit zwei Bot-Controllern bis zum ersten angenommenen Minispiel', async () => {
    const phases: string[] = [];
    const result = await runBotMatch({
      code,
      wasm,
      full: false,
      seed: 3,
      onPhase: (key) => phases.push(key),
    });
    expect(result.exceptions).toEqual([]);
    expect(result.problems).toEqual([]);
    expect(result.serverErrors).toEqual([]);
    expect(result.contractErrors).toEqual([]);
    expect(result.resultsAccepted).toBe(1);
    expect(phases.slice(0, 2)).toEqual(['lobby', 'board']);
    expect(phases).toContain('minigame-play');
    expect(result.ok).toBe(true);
  }, 60_000);

  /** Bot-Partie bis zum ersten Minispiel-Ergebnis, Bühne erst `lateMs` nach dem Spielstart fertig. */
  const lateMatch = async (lateMs: number) => {
    const lines: string[] = [];
    // Die Bühne entsteht mit der Anleitung (7 s), fertig also `lateMs` nach dem Spielstart.
    const result = await runBotMatch({
      code,
      wasm,
      full: false,
      seed: 3,
      stageDelayMs: 7_000 + lateMs,
      log: (line) => lines.push(line),
    });
    expect(result.exceptions).toEqual([]);
    expect(result.problems).toEqual([]);
    expect(result.serverErrors).toEqual([]);
    expect(result.resultsAccepted).toBe(1);
    expect(result.ok).toBe(true);
    const playMs = getMinigameInfo(result.minigamesBuilt[0] ?? '')?.durationMs ?? 0;
    expect(playMs).toBeGreaterThan(20_000);
    const cut = lines.some((line) => line.includes('Frist des Servers'));
    return { afterPlayMs: result.resultAfterPlayMs[0] ?? Infinity, playMs, cut };
  };

  it('nimmt das Ergebnis eines 5 s zu spät aufgebauten Minispiels an, volle Spielzeit (CHAOS-206)', async () => {
    const { afterPlayMs, playMs, cut } = await lateMatch(5_000);
    expect(cut).toBe(false);
    expect(afterPlayMs).toBeGreaterThanOrEqual(playMs + 5_000);
  }, 60_000);

  it('wertet ein 20 s zu spät aufgebautes Minispiel vor der Frist des Servers (CHAOS-206)', async () => {
    // Frist = Spielzeit + 15 s Kulanz; ohne Ausrichtung käme das Ergebnis 5 s danach.
    const { afterPlayMs, playMs, cut } = await lateMatch(20_000);
    expect(cut).toBe(true);
    expect(afterPlayMs).toBeLessThanOrEqual(playMs + 15_000 - RESULT_MARGIN_MS + 200);
  }, 60_000);

  it('schickt host-ready mit deferSceneReady erst nach sceneReady() und spielt dann normal', async () => {
    const phases: string[] = [];
    const result = await runBotMatch({
      code,
      wasm,
      full: false,
      seed: 5,
      deferSceneReady: true,
      onPhase: (key) => phases.push(key),
    });
    expect(result.exceptions).toEqual([]);
    expect(result.problems).toEqual([]);
    expect(result.serverErrors).toEqual([]);
    expect(phases.slice(0, 2)).toEqual(['lobby', 'board']);
    expect(result.ok).toBe(true);
  }, 60_000);
});
