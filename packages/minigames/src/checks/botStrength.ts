/**
 * Stärke-Kennzahl der KI-Bots (CHAOS-180, ADR-020 §4): Bot-Partien mit vier KI-Plätzen, zwei
 * mit der höheren und zwei mit der niedrigeren Stärke, die Sitze wechseln je Seed. Gemessen
 * wird auf dem **echten** Minispiel-Modul über die Laufzeit (Bots als KI-Plätze, gleicher
 * Eingang wie Controller), headless.
 *
 * Spiele mit geheimer Wahl (`info.secretChoice`) messen stattdessen **einen** stärkeren gegen
 * drei schwächere Plätze (`lineup: 'allein'`, CHAOS-243): Im Duell 2 gegen 2 kollidieren die
 * beiden gleich klugen Bots spieltheoretisch an derselben Tür (EXP-043).
 *
 * Bot gegen Bot ist eine Näherung: Sie zeigt, dass die Stärke wirkt, nicht, wie sich die KI
 * gegen Menschen anfühlt (CHAOS-183, CHAOS-185).
 */
import type { Slot } from '@chaos-party/minigame-sdk';
import { runMinigameHeadless } from '@chaos-party/minigame-sdk/testing';
import { getMinigameModule } from '../index.ts';

/** `duell`: zwei stärkere gegen zwei schwächere; `allein`: einer gegen drei. */
export type BotStrengthLineup = 'duell' | 'allein';

export interface BotStrengthDuel {
  readonly id: string;
  readonly lineup: BotStrengthLineup;
  readonly high: number;
  readonly low: number;
  readonly seeds: number;
  /**
   * Siegquote der stärkeren Plätze (geteilte Siege anteilig). Kein Unterschied = fairer Anteil:
   * 0,5 im Duell, 0,25 allein.
   */
  readonly highWins: number;
  /** Mittlere Punkte je Platz der stärkeren bzw. schwächeren Seite. */
  readonly highScore: number;
  readonly lowScore: number;
}

export async function botStrengthDuel(
  id: string,
  high: number,
  low: number,
  seeds: number,
  lineup: BotStrengthLineup = 'duell',
): Promise<BotStrengthDuel> {
  const module = getMinigameModule(id);
  if (!module) throw new Error(`Minispiel ${id} fehlt`);
  const slots: readonly Slot[] = [1, 2, 3, 4];
  let wins = 0;
  let highTotal = 0;
  let lowTotal = 0;
  for (let seed = 1; seed <= seeds; seed++) {
    const strong = (index: number) =>
      lineup === 'duell' ? (index + seed) % 2 === 0 : index === seed % slots.length;
    const strengths = slots.map((_, index) => (strong(index) ? high : low));
    const run = await runMinigameHeadless(module, {
      players: 4,
      seed,
      bots: slots.map((slot, index) => ({ slot, strength: strengths[index] ?? low })),
    });
    const placements = run.outcome?.result.placements;
    if (!placements) throw new Error(`${id}: kein Ergebnis (Seed ${seed})`);
    const isHigh = (slot: Slot) => strengths[slot - 1] === high;
    const winners = placements.filter((entry) => entry.place === 1);
    for (const winner of winners) if (isHigh(winner.slot)) wins += 1 / winners.length;
    for (const entry of placements) {
      if (isHigh(entry.slot)) highTotal += entry.score;
      else lowTotal += entry.score;
    }
  }
  const highSeats = lineup === 'duell' ? 2 : 1;
  return {
    id,
    lineup,
    high,
    low,
    seeds,
    highWins: wins / seeds,
    highScore: highTotal / seeds / highSeats,
    lowScore: lowTotal / seeds / (slots.length - highSeats),
  };
}
