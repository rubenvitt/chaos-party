/**
 * Zeitmodelle für KI- und Bot-Entscheidungen (CHAOS-181, ADR-020 §6): Denkpausen am Brett und
 * Reaktionszeiten im Reaktionsfenster. Aus `rules/simulate.ts` hierher gezogen, damit Simulation
 * und Live-KI dieselben Modelle nutzen. Deterministisch über den übergebenen Zufall.
 */
import type { Rng } from '../rng.ts';

/** Bereich [min, max] in ms, gleichverteilt. */
export type MsRange = readonly [number, number];

/**
 * Rechtsschiefe Zeitverteilung (log-normal) wie bei menschlichen Reaktionszeiten: meist
 * um den Median, selten deutlich länger. `sigma` = Streuung des Logarithmus.
 */
export interface LogNormalMs {
  readonly medianMs: number;
  readonly sigma: number;
  /** Untergrenze (schneller geht es nicht: Wahrnehmung + Tippen). */
  readonly minMs: number;
}

/** Zeitmodell: gleichverteilter Bereich oder log-normal. */
export type DelayModel = MsRange | LogNormalMs;

/** Ganze ms gleichverteilt aus `[min, max]` (Reihenfolge egal, negative Werte zählen als 0). */
export function sampleRange(rng: Rng, [min, max]: MsRange): number {
  const lo = Math.max(0, Math.round(Math.min(min, max)));
  const hi = Math.max(0, Math.round(Math.max(min, max)));
  return rng.int(lo, hi);
}

/** Zeit ziehen: Bereich gleichverteilt, log-normal per Box-Muller (beides seeded). */
export function sampleDelay(rng: Rng, model: DelayModel): number {
  if (!('medianMs' in model)) return sampleRange(rng, model);
  const u1 = 1 - rng.next(); // (0, 1], damit log(u1) endlich bleibt
  const u2 = rng.next();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return Math.max(Math.round(model.minMs), Math.round(model.medianMs * Math.exp(model.sigma * z)));
}
