/**
 * Feldwirkung nach dem letzten Schritt (Phase `space-event`): zuerst eine fremde Falle
 * (falls sie nicht schon beim Darüberlaufen ausgelöst hat), dann der Feldtyp. Brett-Ereignisse werden seeded gezogen.
 */
import { pickOne } from '../rng.ts';
import type { BoardEventKind } from '../types.ts';
import { changeCoins, wanderTrophy } from './economy.ts';
import { activePlayer, schedule, spaceOf, type Ctx } from './internal.ts';
import { gainRandomItem, triggerTrap } from './items.ts';
import { gustForward, slideOnIce, swapPlaces } from './movement.ts';

/** Die festen Brett-Ereignisse, gleich wahrscheinlich. */
export const BOARD_EVENT_KINDS: readonly BoardEventKind[] = [
  'coin-rain',
  'gust',
  'swap',
  'trophy-shuffle',
  'lucky-find',
];

/**
 * Ereignisse, die auf diesem Feld gezogen werden: die festen, dazu „Schnellfeuer!“ (CHAOS-90),
 * solange es als Auslöser eingestellt ist, für diese Runde noch nicht gilt und die Grenze je
 * Partie nicht erreicht ist. Ohne Schnellfeuer bleibt die Liste (und damit jeder Seed) wie vorher.
 */
export function boardEventKinds(ctx: Ctx): readonly BoardEventKind[] {
  if (!rapidFireEventOpen(ctx)) return BOARD_EVENT_KINDS;
  const weight = Math.max(1, Math.round(ctx.rules.rapidFire?.eventWeight ?? 1));
  return [...BOARD_EVENT_KINDS, ...Array.from({ length: weight }, () => 'rapid-fire' as const)];
}

function rapidFireEventOpen(ctx: Ctx): boolean {
  const rule = ctx.rules.rapidFire;
  const { d } = ctx;
  if (rule?.trigger !== 'event' || d.config.rapidFire === undefined) return false;
  if (d.config.practice === true || d.players.length < 2) return false;
  if (d.internal.rapidFireRound === d.round) return false;
  return rule.maxPerGame === undefined || (d.internal.rapidFireCount ?? 0) < rule.maxPerGame;
}

/** Münzregen: alle Spieler bekommen so viele Münzen. */
export const COIN_RAIN_AMOUNT = 2;
/** Glücksfund: der Spieler am Zug bekommt so viele Münzen. */
export const LUCKY_FIND_AMOUNT = 5;
/** Windstoß: so viele Felder vorwärts (gleichverteilt). */
export const GUST_MIN_STEPS = 1;
export const GUST_MAX_STEPS = 2;

export function applyBoardEvent(ctx: Ctx, event: BoardEventKind): void {
  const player = activePlayer(ctx);
  ctx.events.push({ type: 'board-event', slot: player.slot, event });
  switch (event) {
    case 'coin-rain':
      for (const p of ctx.d.players) changeCoins(ctx, p.slot, COIN_RAIN_AMOUNT, 'event');
      return;
    case 'lucky-find':
      changeCoins(ctx, player.slot, LUCKY_FIND_AMOUNT, 'event');
      return;
    case 'gust':
      gustForward(ctx, player.slot, ctx.rng.int(GUST_MIN_STEPS, GUST_MAX_STEPS));
      return;
    case 'swap': {
      const others = ctx.d.players.filter((p) => p.slot !== player.slot);
      if (others.length === 0) return;
      swapPlaces(ctx, player.slot, pickOne(ctx.rng, others).slot);
      return;
    }
    case 'trophy-shuffle':
      wanderTrophy(ctx);
      return;
    case 'rapid-fire':
      // Wirkt erst nach dem letzten Zug: Das Minispiel dieser Runde wird Schnellfeuer.
      ctx.d.internal.rapidFireRound = ctx.d.round;
      return;
  }
}

/**
 * Phase `space-event` betreten: auf Eis erst rutschen (CHAOS-198), dann Falle und Feldwirkung
 * des Felds, auf dem die Figur steht, dann Anzeige-Pause (gerutscht: so viel länger, wie die
 * Rutschpartie läuft).
 */
export function enterSpaceEvent(ctx: Ctx, t: number): void {
  const { rules } = ctx;
  const slid = slideOnIce(ctx, activePlayer(ctx).slot);
  triggerTrap(ctx);
  const player = activePlayer(ctx);
  const space = spaceOf(ctx, player.spaceId);
  switch (space.kind) {
    case 'coins-plus':
      changeCoins(ctx, player.slot, rules.economy.coinsPlus, 'space');
      break;
    case 'coins-minus':
      changeCoins(ctx, player.slot, -rules.economy.coinsMinus, 'space');
      break;
    case 'item':
      gainRandomItem(ctx, player.slot);
      break;
    case 'event':
      applyBoardEvent(ctx, pickOne(ctx.rng, boardEventKinds(ctx)));
      break;
    case 'start':
    case 'trophy':
      break;
  }
  schedule(ctx, 'space-event', t, rules.pacing.spaceEventMs + slid * rules.pacing.stepMs);
}
