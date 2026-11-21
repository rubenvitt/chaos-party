/**
 * Krümel-Kehraus headless mit echtem Havok: Läufe mit 2–4 Bots über mehrere Seeds und
 * Physik-Invarianten (keine NaN, niemand verlässt das Blech, kein Durchtunneln, Tempo
 * begrenzt), Wertung, Ende, Goldkrümel und Keksregen, Mauseloch hält Figuren auf, Aufräumen.
 * Physik wird nicht bitgenau verglichen, sondern über Invarianten (ARCHITECTURE.md).
 */
import { checkResult, createMinigameRng, type Slot } from '@chaos-party/minigame-sdk';
import type { MinigameModule } from '@chaos-party/minigame-sdk/babylon';
import {
  EMPTY_RESIDUE,
  runMinigameHeadless,
  testPlayers,
  type InputScript,
} from '@chaos-party/minigame-sdk/testing';
import { describe, expect, it } from 'vitest';
import { clampToTray, kruemelDecision, slideOnTray } from './bot.ts';
import { SKILLS } from '../prototypes/physics/shared.ts';
import { KruemelKehraus, kruemelKehraus, type KruemelSnapshot } from './index.ts';
import { KRUEMEL_KEHRAUS_INFO } from './info.ts';
import { beyondCut, KRUEMEL_RULES, TUNING } from './logic.ts';

function observed() {
  let game: KruemelKehraus | null = null;
  const module: MinigameModule = {
    info: KRUEMEL_KEHRAUS_INFO,
    create: () => {
      game = new KruemelKehraus();
      return game;
    },
  };
  return { module, snapshot: () => game?.snapshot() ?? null };
}

interface Invariants {
  nan: number;
  tunneled: number;
  maxSpeed: number;
  minPawnY: number;
  last: KruemelSnapshot | null;
}

function freshInvariants(): Invariants {
  return { nan: 0, tunneled: 0, maxSpeed: 0, minPawnY: Infinity, last: null };
}

function botScript(
  snapshot: () => KruemelSnapshot | null,
  inv: Invariants,
  seed: number,
  idle: readonly Slot[] = [],
): InputScript {
  const rng = createMinigameRng(seed * 31 + 5);
  let step = 0;
  return (_elapsed, send) => {
    const snap = snapshot();
    if (!snap) return;
    inv.last = snap;
    for (const body of [...snap.pawns, ...snap.crumbs.filter((crumb) => crumb.active)]) {
      const values = [body.x, body.y, body.z, body.vx, body.vy, body.vz];
      if (values.some((value) => !Number.isFinite(value))) inv.nan++;
      inv.maxSpeed = Math.max(inv.maxSpeed, Math.hypot(body.vx, body.vy, body.vz));
    }
    for (const pawn of snap.pawns) {
      inv.minPawnY = Math.min(inv.minPawnY, pawn.y);
      if (Math.abs(pawn.x) < TUNING.halfX && Math.abs(pawn.z) < TUNING.halfZ && pawn.y < 0.3)
        inv.tunneled++;
    }
    for (const crumb of snap.crumbs) {
      if (!crumb.active) continue;
      if (Math.abs(crumb.x) < TUNING.halfX - 0.5 && Math.abs(crumb.z) < TUNING.halfZ - 0.5)
        if (crumb.y < -0.1) inv.tunneled++;
    }
    const view = { ...snap, clamp: clampToTray, slide: slideOnTray(snap.pawns.length) };
    for (const me of snap.pawns) {
      if (idle.includes(me.slot) || (step + me.slot * 3) % 10 !== 0) continue;
      const decision = kruemelDecision(me, view, SKILLS.normal, 'normal', rng);
      send(me.slot, { type: 'move', x: decision.x, y: decision.y });
      if (decision.dash) {
        send(me.slot, { type: 'press', button: 'a' });
        send(me.slot, { type: 'release', button: 'a' });
      }
    }
    step++;
  };
}

function expectStable(inv: Invariants) {
  expect(inv.nan).toBe(0);
  expect(inv.tunneled).toBe(0);
  expect(inv.maxSpeed).toBeLessThan(30);
  expect(inv.minPawnY).toBeGreaterThan(0.3);
  expect(inv.last?.counters.lost).toBe(0);
}

describe('Krümel-Kehraus: Läufe mit Bots (Havok, Invarianten)', () => {
  for (const players of [2, 3, 4]) {
    for (const seed of [1, 2, 3]) {
      it(`${players} Bots, Seed ${seed}: stabil, gültig gewertet, pünktlich, aufgeräumt`, async () => {
        const { module, snapshot } = observed();
        const inv = freshInvariants();
        const run = await runMinigameHeadless(module, {
          players,
          seed,
          script: botScript(snapshot, inv, seed),
        });
        expectStable(inv);
        const outcome = run.outcome;
        if (!outcome) throw new Error('kein Ergebnis');
        expect(outcome.forced).toBe(false);
        expect(outcome.elapsedMs).toBeGreaterThanOrEqual(KRUEMEL_KEHRAUS_INFO.durationMs);
        expect(outcome.elapsedMs).toBeLessThanOrEqual(KRUEMEL_KEHRAUS_INFO.durationMs + 20);
        const slots = testPlayers(players).map((player) => player.slot);
        expect(
          checkResult(outcome.result, {
            minigameId: KRUEMEL_KEHRAUS_INFO.id,
            slots,
            scoring: 'higher',
          }),
        ).toEqual({ ok: true });
        // Punkte = Treffer (Gold zählt mehr); es wurde gespielt.
        const total = outcome.result.placements.reduce((sum, p) => sum + p.score, 0);
        const counters = inv.last?.counters;
        expect(counters?.scored).toBeGreaterThan(players);
        expect(total).toBe(
          (counters?.scored ?? 0) + (counters?.golds ?? 0) * (KRUEMEL_RULES.goldValue - 1),
        );
        for (const line of outcome.result.highlights ?? [])
          expect(line.length).toBeLessThanOrEqual(64);
        expect(run.residue).toEqual(EMPTY_RESIDUE);
        expect(run.fx.sounds).toContain('go');
        expect(run.fx.sounds).toContain('win');
      });
    }
  }
});

describe('Krümel-Kehraus: Regeln am echten Spiel', () => {
  it('ohne Eingaben bekommt niemand Punkte – auch nicht in den ersten Schritten', async () => {
    // Regression: In `prepare` versetzte Körper blieben auf dem Parkplatz hinter Ecke 2 und
    // zählten dort sofort als Treffer.
    const { module, snapshot } = observed();
    const early: { scores: KruemelSnapshot['scores'] | null } = { scores: null };
    const run = await runMinigameHeadless(module, {
      players: 4,
      seed: 9,
      script: (elapsed) => {
        if (elapsed >= 500 && !early.scores) early.scores = snapshot()?.scores ?? null;
      },
    });
    expect(early.scores).not.toBeNull();
    for (const entry of early.scores ?? []) expect(entry.score).toBe(0);
    const placements = run.outcome?.result.placements ?? [];
    expect(placements.every((p) => p.score === 0 && p.place === 1)).toBe(true);
    expect(run.residue).toEqual(EMPTY_RESIDUE);
  });

  it('Startkrümel liegen auf dem Blech, Gold und Keksregen warten geparkt', async () => {
    const { module, snapshot } = observed();
    const seen: Record<string, KruemelSnapshot | null> = {};
    await runMinigameHeadless(module, {
      players: 2,
      seed: 4,
      script: (elapsed) => {
        if (elapsed === 0) seen.start = snapshot();
        if (Math.abs(elapsed - 6_500) < 9) seen.gold = snapshot();
        if (Math.abs(elapsed - 23_000) < 9) seen.rain = snapshot();
      },
    });
    const active = (snap: KruemelSnapshot | null | undefined) =>
      snap?.crumbs.filter((crumb) => crumb.active) ?? [];
    expect(active(seen.start)).toHaveLength(KRUEMEL_RULES.crumbs);
    for (const crumb of active(seen.start)) {
      expect(Math.abs(crumb.x)).toBeLessThan(TUNING.halfX);
      expect(Math.abs(crumb.z)).toBeLessThan(TUNING.halfZ);
      expect(crumb.y).toBeLessThan(1);
    }
    expect(active(seen.gold).some((crumb) => crumb.value === KRUEMEL_RULES.goldValue)).toBe(true);
    expect(seen.rain?.rain).toBe(true);
    expect(active(seen.rain).length).toBeGreaterThanOrEqual(
      KRUEMEL_RULES.crumbs + KRUEMEL_RULES.rainCrumbs,
    );
  });

  it('der Sturz über dem Mauseloch hält Figuren auf, auch mit Rempler', async () => {
    const { module, snapshot } = observed();
    let deepest = -Infinity;
    await runMinigameHeadless(module, {
      players: 2,
      seed: 3,
      timeLimitMs: 4_000,
      script: (elapsed, send) => {
        const snap = snapshot();
        if (!snap) return;
        const me = snap.pawns[0];
        const goal = snap.goals[0];
        if (!me || !goal) return;
        const dx = goal.corner.mouth.x + goal.corner.normal.x - me.x;
        const dz = goal.corner.mouth.z + goal.corner.normal.z - me.z;
        const length = Math.hypot(dx, dz) || 1;
        send(1, { type: 'move', x: dx / length, y: dz / length });
        if (Math.round(elapsed) % 1200 < 17) {
          send(1, { type: 'press', button: 'a' });
          send(1, { type: 'release', button: 'a' });
        }
        deepest = Math.max(deepest, beyondCut(goal.corner, me));
      },
    });
    // Kapselachse bleibt mindestens einen Radius vor der Schräge.
    expect(deepest).toBeLessThan(-0.3);
  });

  it('wer allein schiebt, punktet; die anderen stehen und bekommen nichts geschenkt', async () => {
    const { module, snapshot } = observed();
    const inv = freshInvariants();
    const run = await runMinigameHeadless(module, {
      players: 3,
      seed: 5,
      script: botScript(snapshot, inv, 5, [2, 3]),
    });
    expectStable(inv);
    const scores = new Map(run.outcome?.result.placements.map((p) => [p.slot, p.score]));
    expect(scores.get(1)).toBeGreaterThan(3);
    expect(run.outcome?.result.placements[0]?.slot).toBe(1);
  });

  it('getrennter Controller: Figur steht still, Spiel läuft weiter', async () => {
    const { module, snapshot } = observed();
    const inv = freshInvariants();
    const bots = botScript(snapshot, inv, 6);
    const run = await runMinigameHeadless(module, {
      players: 3,
      seed: 6,
      script: (elapsed, send, runner) => {
        if (Math.abs(elapsed - 5_000) < 9) runner.setConnected(2, false);
        if (Math.abs(elapsed - 15_000) < 9) runner.setConnected(2, true);
        bots(elapsed, send, runner);
      },
    });
    expectStable(inv);
    expect(run.outcome?.forced).toBe(false);
    expect(run.residue).toEqual(EMPTY_RESIDUE);
  });

  it('HUD: Restzeit, Punkte je Slot, kurze Zustände und Banner', async () => {
    const { module, snapshot } = observed();
    const inv = freshInvariants();
    const statuses = new Set<string>();
    const banners = new Set<string>();
    const bots = botScript(snapshot, inv, 2);
    await runMinigameHeadless(module, {
      players: 4,
      seed: 2,
      script: (elapsed, send, runner) => {
        bots(elapsed, send, runner);
        const hud = runner.hud();
        expect(hud.scores).toHaveLength(4);
        for (const entry of hud.scores) if (entry.status) statuses.add(entry.status);
        if (hud.banner) banners.add(hud.banner);
      },
    });
    for (const status of statuses) expect(status.length).toBeLessThanOrEqual(16);
    for (const banner of banners) expect(banner.length).toBeLessThanOrEqual(32);
    expect(banners.has('Ein Riesenkeks zerbröselt!')).toBe(true);
    expect([...statuses].some((status) => status.startsWith('+'))).toBe(true);
  });

  it('Modul nutzt die gewählten Regeln', () => {
    expect(kruemelKehraus.info).toBe(KRUEMEL_KEHRAUS_INFO);
    expect(kruemelKehraus.create()).toBeInstanceOf(KruemelKehraus);
  });
});
