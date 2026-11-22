/**
 * EXP-044 (CHAOS-186): Spielstile messbar verschieden, Siegquote im Rahmen. Schnelle Prüfung mit
 * wenigen Seeds immer, volle Tabelle mit `EXPERIMENTS=personality`.
 */
import { describe, expect, it } from 'vitest';
import {
  personalityTable,
  runPersonalityExperiment,
  type PersonalityMetrics,
} from './personalityExperiment.ts';

/** Laufzeit-Globals ohne Node-/DOM-Typen (game-core kennt `process` und `console` nicht). */
const runtime = globalThis as {
  process?: { env?: Record<string, string | undefined> };
  console?: { log: (...values: unknown[]) => void };
};

function env(name: string): string | undefined {
  return runtime.process?.env?.[name];
}

function row(rows: readonly PersonalityMetrics[], label: PersonalityMetrics['label']) {
  const found = rows.find((entry) => entry.label === label);
  if (!found) throw new Error(`Zeile ${label} fehlt`);
  return found;
}

describe('EXP-044: Spielstile der Brett-KI', () => {
  it('ist je Seed deterministisch', () => {
    const options = { seeds: [3, 4], strength: 0.5, rounds: 4 };
    expect(runPersonalityExperiment(options)).toEqual(runPersonalityExperiment(options));
  });

  it('Saboteur sabotiert öfter als Sammler, Fuchs hebt mehr auf als Draufgänger', () => {
    const rows = runPersonalityExperiment({
      seeds: Array.from({ length: 600 }, (_, i) => i + 1),
      strength: 0.5,
    });
    // EXP-044 (1200 Seeds, mittel): 2,32 gegen 1,83 (× 1,27); Schwelle mit Abstand zum Rauschen.
    expect(row(rows, 'saboteur').sabotage).toBeGreaterThan(row(rows, 'sammler').sabotage * 1.15);
    expect(row(rows, 'draufgaenger').itemsUsed).toBeGreaterThan(row(rows, 'fuchs').itemsUsed);
    expect(row(rows, 'fuchs').itemsHeld).toBeGreaterThan(row(rows, 'draufgaenger').itemsHeld);
    expect(row(rows, 'sammler').doubleDice / row(rows, 'sammler').itemsUsed).toBeGreaterThan(
      row(rows, 'saboteur').doubleDice / row(rows, 'saboteur').itemsUsed,
    );
  });

  it('kein Stil verschiebt die Siegquote um mehr als 5 Prozentpunkte (800 Seeds, mittel)', () => {
    // Vorläufige Grenze bis CHAOS-183; Standardfehler bei 800 Partien ≈ 1,5 Prozentpunkte.
    const rows = runPersonalityExperiment({
      seeds: Array.from({ length: 800 }, (_, i) => i + 1),
      strength: 0.5,
    });
    for (const entry of rows) expect(Math.abs(entry.winRate - 0.25)).toBeLessThan(0.05);
  }, 60_000);
});

describe.runIf(env('EXPERIMENTS') === 'personality')('EXP-044: volle Tabelle', () => {
  it('druckt die Tabellen je Stärke', () => {
    const seeds = Array.from({ length: 1200 }, (_, i) => i + 1);
    for (const strength of [0, 0.5, 1]) {
      const rows = runPersonalityExperiment({ seeds, strength });
      runtime.console?.log(
        `\n### Stärke ${String(strength)} (1200 Seeds, 10 Runden)\n\n${personalityTable(rows)}`,
      );
    }
  }, 600_000);
});
