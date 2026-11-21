/**
 * Bots für die **echte** Sockenregen-Logik (`../../sockenregen/logic.ts`). Der Bot selbst liegt
 * seit CHAOS-180 im Produktcode (`../../sockenregen/bot.ts`); hier nur die Bot-Partie für
 * EXP-005 („A4 (Spiellogik)“) und die Logiktests.
 */
import {
  lineup,
  runBotMatch,
  type BotProfile,
  type GameRecord,
  type PlayerCount,
} from '@chaos-party/minigame-kit';
import { SOCKENREGEN_BOT_ADAPTER } from '../../sockenregen/bot.ts';

export { SOCKENREGEN_BOT_ADAPTER, SockenregenBot } from '../../sockenregen/bot.ts';

/** Eine ganze Runde mit Bots auf der echten Logik (1/60-s-Schritte wie die Laufzeit). */
export function simulateSockenregenLogic(
  players: PlayerCount,
  seed: number,
  profiles: readonly BotProfile[] = lineup(players),
  durationMs = 30_000,
): GameRecord {
  return runBotMatch(SOCKENREGEN_BOT_ADAPTER, seed, profiles, durationMs);
}
