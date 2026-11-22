/**
 * Bot für Rasensprenger-Rodeo: sieht Düse, Drehsinn, Tempo und Länge, nicht den Plan. Er schaut
 * alle paar Schritte hin (Reaktionszeit) und läuft zum Nachbarpunkt, den der nächste Strahl am
 * spätesten erreicht – gern dicht hinter einem Strahl (Rodeo-Bonus).
 */
import {
  BotSenses,
  kitBotDriver,
  noisyStick,
  profileForStrength,
  type BotAction,
  type BotMatchAdapter,
  type BotProfile,
  type MinigameBot,
} from '@chaos-party/minigame-kit';
import type {
  MinigameBotDriver,
  MinigameBotOptions,
  MinigameRng,
  Slot,
} from '@chaos-party/minigame-sdk';
import { RODEO_RULES, RodeoLogic, jetHits, type Sprinkler } from './logic.ts';

/** So weit schaut der Bot voraus (s); sicherer wird es nicht. */
const HORIZON_S = 2.5;
const DIRECTIONS = 12;
const RIDE = { safeS: 0.8, bonus: 0.8 } as const;
const { bodyRadius, jetHalfWidth, radius, speed, thrill } = RODEO_RULES;

/** Zeit, bis der Strahl von `sprinkler` den Punkt erreicht (∞ = außer Reichweite). */
function timeToJet(sprinkler: Sprinkler, x: number, z: number, now: number): number {
  const d = Math.hypot(x - sprinkler.x, z - sprinkler.z);
  if (sprinkler.phase === 'idle' || d > sprinkler.reach + bodyRadius + 0.5) return Infinity;
  const wait = Math.max(0, sprinkler.sprayAt - now);
  const width = Math.atan2(jetHalfWidth + bodyRadius + 0.2, d);
  const toward = Math.atan2(z - sprinkler.z, x - sprinkler.x) - sprinkler.angle;
  const ahead = (toward * Math.sign(sprinkler.spin || 1) + Math.PI * 4) % (Math.PI * 2);
  if (ahead < width || Math.PI * 2 - ahead < width) return wait;
  return wait + (ahead - width) / (Math.abs(sprinkler.spin) || 1);
}

export class RodeoBot implements MinigameBot<RodeoLogic> {
  private readonly senses: BotSenses;
  private readonly thinkSteps: number;
  private step = 0;
  decisions = 0;

  constructor(
    readonly slot: Slot,
    readonly profile: BotProfile,
    private readonly rng: MinigameRng,
  ) {
    this.senses = new BotSenses(profile, rng);
    this.thinkSteps = Math.max(3, Math.round((profile.reactionMs / 1000) * 30));
  }

  act(game: RodeoLogic): BotAction | null {
    const me = game.runner(this.slot);
    const now = game.clock.time;
    if (!me || me.hearts <= 0 || this.step++ % this.thinkSteps !== 0) return null;
    const known = game.sprinklers.filter((sprinkler) => {
      // Aufmerksame bemerken die Vorwarnung, alle anderen spätestens den Strahl.
      const id = sprinkler.serial * 8 + sprinkler.index;
      this.senses.see(id, now);
      this.senses.see(id + 4, sprinkler.sprayAt);
      return this.senses.noticed(id, now, true) || this.senses.noticed(id + 4, now);
    });
    if (this.rng.next() < this.profile.lapse) return null;
    const step = speed * 0.45;
    const spots = [{ x: me.x, z: me.z, angle: null as number | null }];
    for (let index = 0; index < DIRECTIONS; index++) {
      const angle = (index / DIRECTIONS) * Math.PI * 2;
      const spot = { x: me.x + Math.cos(angle) * step, z: me.z + Math.sin(angle) * step, angle };
      if (Math.hypot(spot.x, spot.z) < radius - bodyRadius) spots.push(spot);
    }
    const rated = spots
      .map((spot) => {
        const mid = { x: (spot.x + me.x) / 2, z: (spot.z + me.z) / 2 };
        const safety = Math.min(
          HORIZON_S,
          ...known.map((s) => timeToJet(s, spot.x, spot.z, now)),
          ...known.map((s) => timeToJet(s, mid.x, mid.z, now) + 0.15),
        );
        const ride = safety > RIDE.safeS && known.some((s) => jetHits(s, spot, thrill));
        // Lieber nicht an den Rand und nicht unnötig laufen.
        const edge = Math.max(0, Math.hypot(spot.x, spot.z) - (radius - 1.4));
        const value = safety + (ride ? RIDE.bonus : 0) - edge * 0.3;
        return { spot, value: value - (spot.angle === null ? 0 : 0.05) };
      })
      .sort((a, b) => b.value - a.value);
    const good = this.rng.next() < this.profile.judgement;
    const choice = rated[good ? 0 : Math.floor(this.rng.next() * Math.min(2, rated.length))];
    if (!choice) return null;
    this.decisions++;
    const { angle } = choice.spot;
    return { stick: angle === null ? { x: 0, y: 0 } : noisyStick(angle, this.profile, this.rng) };
  }
}

/** Rasensprenger-Rodeo für `runBotMatch` und die Fairness-Prüfung (`kitHarness`). */
export const RODEO_BOT_ADAPTER: BotMatchAdapter<RodeoLogic> = {
  create: (slots, rng, durationMs) => new RodeoLogic(slots, rng, durationMs),
  bot: (slot, profile, rng) => new RodeoBot(slot, profile, rng),
  apply: (game, slot, action) => {
    if (action.stick) game.setStick(slot, action.stick.x, action.stick.y);
  },
  step: (game, dt) => void game.step(dt),
  finished: (game) => game.finished,
  scores: (game) => game.board.entries().map((entry) => entry.score),
  elapsedMs: (game) => game.clock.time * 1000,
};

/** Störer für den Eindringling-Test (`kitHarness`): Stillsteher und Randläufer. */
export const RODEO_INTRUDERS = [
  { id: 'still', label: 'Stillsteher', act: () => ({ x: 0, y: 0 }) },
  {
    id: 'rand',
    label: 'Randläufer (im Kreis am Rand)',
    act: (me: { x: number; z: number }) => {
      const a = Math.atan2(me.z, me.x);
      const out = Math.hypot(me.x, me.z) < radius - 0.8 ? 1 : 0;
      return { x: -Math.sin(a) + out * Math.cos(a), y: Math.cos(a) + out * Math.sin(a) };
    },
  },
].map(({ id, label, act }) => ({
  id,
  label,
  bot: (slot: Slot, _rng: MinigameRng, normal: MinigameBot<RodeoLogic>) => ({
    slot,
    profile: normal.profile,
    act: (game: RodeoLogic): BotAction => ({ stick: act(game.runner(slot) ?? { x: 0, z: 0 }) }),
  }),
}));

/** Laufzeit-Bot für einen KI-Platz (`Minigame.createBot`). */
export function createRodeoBot(
  options: MinigameBotOptions,
  observe: () => RodeoLogic | null,
): MinigameBotDriver {
  const bot = new RodeoBot(options.slot, profileForStrength(options.strength), options.rng);
  return kitBotDriver(bot, observe);
}
