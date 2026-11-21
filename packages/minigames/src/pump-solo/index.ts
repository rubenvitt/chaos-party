import type { MinigameModule } from '@chaos-party/minigame-sdk/babylon';
import { createTeamPump } from '../pump-teams/teamPump.ts';
import { PUMP_SOLO_INFO } from './info.ts';

/** Testspiel für Spielformen (CHAOS-89); Logik in `pump-teams/teamPump.ts`. */
export const pumpSolo: MinigameModule = {
  info: PUMP_SOLO_INFO,
  create: createTeamPump(PUMP_SOLO_INFO),
};
