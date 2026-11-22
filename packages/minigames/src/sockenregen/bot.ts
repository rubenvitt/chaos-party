/**
 * KI-Bot für Sockenregen (CHAOS-180), aus EXP-005 übernommen: Gefahren ausweichen (wenn
 * bemerkt), bestes erreichbares Sockenziel ansteuern, Hechtsprung bei Zeitnot. Sieht nur, was
 * am Bildschirm sichtbar ist (fliegende Socken samt Schatten, Bügeleisen, Figuren).
 *
 * Dient der echten Partie (`Sockenregen.createBot`, Stärke über `profileForStrength`), der
 * Fairness-Prüfung (CHAOS-84) und EXP-005 (`prototypes/arcade/sockenregenBot.ts`).
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
import { SockenregenLogic, type Item } from './logic.ts';

const THINK_S = 0.15;

export class SockenregenBot implements MinigameBot<SockenregenLogic> {
  private readonly senses: BotSenses;
  private nextThink = 0;
  private target: number | null = null;
  decisions = 0;

  constructor(
    readonly slot: Slot,
    readonly profile: BotProfile,
    private readonly rng: MinigameRng,
  ) {
    this.senses = new BotSenses(profile, rng);
  }

  /** Gemeinsame Bot-Schnittstelle (ADR-021): Stick setzen, A für den Hechtsprung. */
  act(game: SockenregenLogic): BotAction | null {
    const decision = this.decide(game);
    if (!decision) return null;
    return { stick: { x: decision.x, y: decision.y }, ...(decision.dash ? { press: ['a'] } : {}) };
  }

  /** Entscheidet für den aktuellen Schritt: Stick und ob A gedrückt wird. */
  decide(game: SockenregenLogic): { x: number; y: number; dash: boolean } | null {
    const me = game.runner(this.slot);
    if (!me) return null;
    const t = game.time;
    for (const item of game.items) this.senses.see(item.id, t);
    if (t < this.nextThink) return null;
    this.nextThink = t + THINK_S;
    if (game.isStunned(me)) return { x: 0, y: 0, dash: false };
    const { rules } = game;

    for (const item of game.items) {
      if (
        item.kind !== 'iron' ||
        item.state !== 'flying' ||
        !this.senses.noticed(item.id, t, true)
      ) {
        continue;
      }
      const d = Math.hypot(me.x - item.x, me.z - item.z);
      if (d < rules.ironRadius + 0.4 && item.landT - t < 1.0) {
        const away =
          d < 0.05 ? this.rng.next() * Math.PI * 2 : Math.atan2(me.z - item.z, me.x - item.x);
        this.target = null;
        return { ...this.steer(away), dash: false };
      }
    }

    const candidates: { item: Item; value: number }[] = [];
    for (const item of game.items) {
      if (item.kind === 'iron' || item.state === 'gone' || !this.senses.noticed(item.id, t))
        continue;
      const d = Math.hypot(me.x - item.x, me.z - item.z);
      const eta = d / rules.speed;
      const deadline = (item.state === 'flying' ? item.landT : t) + rules.groundS - t;
      if (eta > deadline) continue;
      const rival = Math.min(
        ...game.runners
          .filter((other) => other !== me)
          .map((other) => Math.hypot(other.x - item.x, other.z - item.z)),
      );
      const contested = rival + 0.8 < d ? 0.35 : 1;
      const points = item.kind === 'gold' ? rules.goldPoints : 1;
      candidates.push({ item, value: (points * contested) / (eta + 0.4) });
    }
    if (candidates.length === 0) {
      this.target = null;
      const d = Math.hypot(me.x, me.z);
      return d > 1
        ? { ...this.steer(Math.atan2(-me.z, -me.x)), dash: false }
        : { x: 0, y: 0, dash: false };
    }
    candidates.sort((a, b) => b.value - a.value);
    const choice =
      this.rng.next() < this.profile.judgement
        ? candidates[0]
        : candidates[Math.floor(this.rng.next() * Math.min(3, candidates.length))];
    if (!choice) return null;
    if (choice.item.id !== this.target) this.decisions++;
    this.target = choice.item.id;
    const d = Math.hypot(me.x - choice.item.x, me.z - choice.item.z);
    if (d < 0.15) return { x: 0, y: 0, dash: false };
    const stick = this.steer(Math.atan2(choice.item.z - me.z, choice.item.x - me.x));
    const hurry = choice.item.state === 'ground' || choice.item.landT - t < d / rules.speed;
    const dash = d > 2 && hurry && t >= me.dashReadyAt && this.rng.next() < this.profile.judgement;
    return { ...stick, dash };
  }

  /** Winkel in der x/z-Ebene → Stick (x, y = +z) mit Lenkungsrauschen. */
  private steer(angle: number): { x: number; y: number } {
    return noisyStick(angle, this.profile, this.rng);
  }
}

/** Sockenregen für `runBotMatch` (gemeinsame Bot-Partie des Baukastens). */
export const SOCKENREGEN_BOT_ADAPTER: BotMatchAdapter<SockenregenLogic> = {
  create: (slots, rng, durationMs) => new SockenregenLogic(slots, rng, durationMs),
  bot: (slot, profile, rng) => new SockenregenBot(slot, profile, rng),
  apply: (game, slot, action) => {
    if (action.stick) game.setStick(slot, action.stick.x, action.stick.y);
    if (action.press?.includes('a')) game.dash(slot);
  },
  step: (game, dt) => {
    game.step(dt);
  },
  finished: (game) => game.finished,
  scores: (game) => game.runners.map((runner) => runner.score),
  elapsedMs: (game) => game.time * 1000,
  extraActions: (game, slot) => game.runner(slot)?.dashes ?? 0,
};

/** Laufzeit-Bot für einen KI-Platz (`Minigame.createBot`). */
export function createSockenregenBot(
  options: MinigameBotOptions,
  observe: () => SockenregenLogic | null,
): MinigameBotDriver {
  const bot = new SockenregenBot(
    options.slot,
    profileForStrength(options.strength, options.style),
    options.rng,
  );
  return kitBotDriver(bot, observe);
}
