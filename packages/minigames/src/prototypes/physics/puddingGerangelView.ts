/**
 * Pudding-Gerangel (die echte Umsetzung) als `Prototype` für die Wackel-Bots aus EXP-006:
 * Modul plus Blick auf den Spielzustand, so wie ein Mensch ihn am Fernseher sieht.
 * Genutzt von EXP-006 (Zeile „Z“) und der Bot-Fairness-Prüfung (CHAOS-84).
 */
import { PuddingGerangel } from '../../pudding-gerangel/index.ts';
import { PUDDING_GERANGEL_INFO } from '../../pudding-gerangel/info.ts';
import { TUNING } from '../../pudding-gerangel/logic.ts';
import type { Prototype } from './shared.ts';
import type { WackelView } from './wackel.ts';

export function createPuddingGerangelPrototype(): Prototype<WackelView> {
  let game: PuddingGerangel | null = null;
  return {
    module: {
      info: PUDDING_GERANGEL_INFO,
      create: () => {
        game = new PuddingGerangel();
        return game;
      },
    },
    peek: () => (game ? puddingView(game) : null),
  };
}

/** Lage einer laufenden Instanz für die Wackel-Bots (auch `havokHarness`, CHAOS-241). */
export function puddingView(game: PuddingGerangel): WackelView {
  const snap = game.snapshot();
  return {
    pawns: snap.pawns.map(({ slot, x, y, z, vx, vy, vz, out, canDash }) => ({
      slot,
      x,
      y,
      z,
      vx,
      vy,
      vz,
      out,
      canDash,
    })),
    props: [],
    killY: TUNING.killY,
    tunneled: () =>
      snap.pawns.filter((p) => !p.out && p.localR < TUNING.radius - 0.8 && p.localY < 0).length,
    counters: { ...snap.counters },
    tilt: snap.tilt,
    whiskAngle: snap.spoonAngle,
    zone: snap.zone,
    leader: snap.leader,
  };
}
