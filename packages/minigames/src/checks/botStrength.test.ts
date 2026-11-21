/**
 * Stärke-Kennzahl der KI-Bots (CHAOS-180, Akzeptanzkriterium „schwer schlägt leicht messbar“):
 * Für jedes Minispiel der Rotation spielen je zwei KI-Plätze schwer gegen zwei leichte, feste
 * Seeds. Schwer gewinnt mindestens `MIN_HARD_WINS` der Partien und hat im Mittel mehr Punkte.
 * Dazu der Abstand mittel ↔ leicht, damit die Stärke stufenweise wirkt, nicht nur an den Enden.
 *
 * Messung EXP-040 (40 Seeds Logik-Spiele, 8 Seeds Havok-Spiele), Siegquote schwer/leicht:
 * Sockenregen 0,97, Pudding-Gerangel 1,00, Wackelturm 0,79, Kuckucks-Klatsche 0,84,
 * Krümel-Kehraus 1,00; mittel/leicht 0,63–0,91. Die CI nutzt weniger Seeds (Laufzeit).
 */
import { BOT_LEVEL_STRENGTH } from '@chaos-party/minigame-sdk';
import { describe, expect, it } from 'vitest';
import { ROTATION } from '../catalog.ts';
import { getMinigameModule } from '../index.ts';
import { botStrengthDuel } from './botStrength.ts';

/** Schwer gegen leicht: deutlich mehr als die Hälfte der Siege. */
const MIN_HARD_WINS = 0.65;
/** Mittel gegen leicht: mehr als die Hälfte (die Stufen liegen enger beisammen). */
const MIN_MEDIUM_WINS = 0.5;

const { leicht, mittel, schwer } = BOT_LEVEL_STRENGTH;

describe.each(ROTATION)('KI-Stärke in %s (CHAOS-180)', (id) => {
  const seeds = getMinigameModule(id)?.info.physics ? 6 : 16;

  it('schwer schlägt leicht messbar', async () => {
    const duel = await botStrengthDuel(id, schwer, leicht, seeds);
    expect(duel.highWins, JSON.stringify(duel)).toBeGreaterThanOrEqual(MIN_HARD_WINS);
    expect(duel.highScore).toBeGreaterThan(duel.lowScore);
  });

  it('mittel liegt über leicht', async () => {
    const duel = await botStrengthDuel(id, mittel, leicht, seeds);
    expect(duel.highWins, JSON.stringify(duel)).toBeGreaterThan(MIN_MEDIUM_WINS);
    expect(duel.highScore).toBeGreaterThan(duel.lowScore);
  });
});
