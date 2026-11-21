import type { MinigameModule } from '@chaos-party/minigame-sdk/babylon';
import { createTeamPump } from '../pump-teams/teamPump.ts';
import { PUMP_RIESE_INFO } from './info.ts';

/** Testspiel für Spielformen (CHAOS-89); Logik in `pump-teams/teamPump.ts`. */
export const pumpRiese: MinigameModule = {
  info: PUMP_RIESE_INFO,
  create: createTeamPump(PUMP_RIESE_INFO),
};
