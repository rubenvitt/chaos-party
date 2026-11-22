/**
 * Stärke-Kennzahl der KI-Bots (CHAOS-180, Akzeptanzkriterium „schwer schlägt leicht messbar“):
 * Für jedes Minispiel der Rotation spielen je zwei KI-Plätze schwer gegen zwei leichte, feste
 * Seeds. Schwer gewinnt mindestens `MIN_HARD_WINS` der Partien und hat im Mittel mehr Punkte.
 * Dazu der Abstand mittel ↔ leicht, damit die Stärke stufenweise wirkt, nicht nur an den Enden.
 *
 * Messung EXP-040 (40 Seeds Logik-Spiele, 8 Seeds Havok-Spiele), Siegquote schwer/leicht:
 * Sockenregen 0,97, Pudding-Gerangel 1,00, Wackelturm 0,79, Kuckucks-Klatsche 0,84,
 * Krümel-Kehraus 1,00; mittel/leicht 0,63–0,91. Die CI nutzt weniger Seeds (Laufzeit).
 *
 * Ausnahme für Spiele mit geheimer Wahl (`info.secretChoice`, CHAOS-243, EXP-043, von Ruben am
 * 22.11.2026 angenommen): Zwei gleich starke Bots stehen dort spieltheoretisch in ≥ 50 % der
 * Runden an derselben Tür, das Duell 2 gegen 2 misst also vor allem diese Kollision (selbst ein
 * Orakel-Bot gewinnt nur 0,81). Gemessen wird stattdessen einer gegen drei leichte, fairer
 * Anteil 0,25: schwer ≥ 1,5 × fair, mittel über fair. Drei Türen: schwer 0,45, mittel 0,33.
 */
import { BOT_LEVEL_STRENGTH } from '@chaos-party/minigame-sdk';
import { describe, expect, it } from 'vitest';
import { ROTATION } from '../catalog.ts';
import { getMinigameModule } from '../index.ts';
import { botStrengthDuel, type BotStrengthLineup } from './botStrength.ts';

/** Schwer gegen leicht: deutlich mehr als die Hälfte der Siege. */
const MIN_HARD_WINS = 0.65;
/** Mittel gegen leicht: mehr als die Hälfte (die Stufen liegen enger beisammen). */
const MIN_MEDIUM_WINS = 0.5;

/** Geheime Wahl, einer gegen drei: fairer Anteil 0,25 (CHAOS-243). */
const LONE = { hard: 0.375, medium: 0.25, seeds: 64 } as const;

const { leicht, mittel, schwer } = BOT_LEVEL_STRENGTH;

describe.each(ROTATION)('KI-Stärke in %s (CHAOS-180)', (id) => {
  const info = getMinigameModule(id)?.info;
  const lineup: BotStrengthLineup = info?.secretChoice ? 'allein' : 'duell';
  const seeds = lineup === 'allein' ? LONE.seeds : info?.physics ? 6 : 16;
  const minHard = lineup === 'allein' ? LONE.hard : MIN_HARD_WINS;
  const minMedium = lineup === 'allein' ? LONE.medium : MIN_MEDIUM_WINS;

  it('schwer schlägt leicht messbar', async () => {
    const duel = await botStrengthDuel(id, schwer, leicht, seeds, lineup);
    expect(duel.highWins, JSON.stringify(duel)).toBeGreaterThanOrEqual(minHard);
    expect(duel.highScore).toBeGreaterThan(duel.lowScore);
  });

  it('mittel liegt über leicht', async () => {
    const duel = await botStrengthDuel(id, mittel, leicht, seeds, lineup);
    expect(duel.highWins, JSON.stringify(duel)).toBeGreaterThan(minMedium);
    expect(duel.highScore).toBeGreaterThan(duel.lowScore);
  });
});
