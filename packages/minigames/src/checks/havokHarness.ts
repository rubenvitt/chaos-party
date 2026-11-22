/**
 * Fairness-Anbindung für Havok-Minispiele (CHAOS-241), Gegenstück zu `kitHarness.ts`: spielt das
 * echte Modul headless (`runMinigameHeadless`), liest über die Instanz die sichtbare Lage und
 * lässt je Platz den Figuren-Bot des Spiels entscheiden, getaktet wie `pawnBotDriver` (alle
 * `replanSteps` Schritte, versetzt je Platz, sofort beim ersten Mal). Können-Stufen =
 * `PAWN_BOT_SKILLS` (EXP-006 plus Profi aus CHAOS-84), Führung über `LeadCounter`.
 *
 * Bot-Zufall: ein Strom je Partie (`seed × 7919 + 13`), wie in den Bestands-Harnesses.
 */
import { PAWN_BOT_SKILLS, type PawnBotSkill, type PawnDecision } from '@chaos-party/minigame-kit';
import {
  createMinigameRng,
  type MinigameInfo,
  type MinigameRng,
  type Slot,
} from '@chaos-party/minigame-sdk';
import type { Minigame } from '@chaos-party/minigame-sdk/babylon';
import { runMinigameHeadless } from '@chaos-party/minigame-sdk/testing';
import {
  LeadCounter,
  type FairnessHarness,
  type FairnessIntruder,
  type FairnessMatch,
  type FairnessSeat,
  type FairnessSkill,
} from './fairness.ts';

export const HAVOK_SKILLS: Readonly<Record<FairnessSkill, PawnBotSkill>> = PAWN_BOT_SKILLS;

/** Was der Harness von einer Figur braucht. */
export interface HavokHarnessPawn {
  readonly slot: Slot;
  readonly out: boolean;
}

export interface HavokHarnessOptions<G extends Minigame, V, P extends HavokHarnessPawn> {
  readonly info: MinigameInfo;
  /** Neue Instanz des Spiels (je Partie; der Harness behält sie für `view`). */
  create(): G;
  /** Sichtbare Lage wie für den Laufzeit-Bot (`null`, solange es nichts zu sehen gibt). */
  view(game: G): V | null;
  pawns(view: V): readonly P[];
  /** Entscheid eines Platzes; `strategy` ist die Eindringling-ID oder „normal“. */
  decide(me: P, view: V, skill: PawnBotSkill, rng: MinigameRng, strategy: string): PawnDecision;
  /** Erster Eintrag: Dauerdrücken bzw. Dauerrempeln (README §5.2). */
  readonly intruders: readonly FairnessIntruder[];
  /** Seeds je Tisch in der CI (Havok: Laufzeit < 10 s je Spiel; Standard 8). */
  readonly ciSeeds?: number;
}

/** Eine Bot-Partie im echten Modul mit Sitzen aus der Fairness-Vorlage. */
export async function playHavokMatch<G extends Minigame, V, P extends HavokHarnessPawn>(
  options: HavokHarnessOptions<G, V, P>,
  seats: readonly FairnessSeat[],
  seed: number,
): Promise<FairnessMatch> {
  let game: G | null = null;
  const module = { info: options.info, create: () => (game = options.create()) };
  const rng = createMinigameRng(seed * 7919 + 13);
  const lead = new LeadCounter(options.info.scoring);
  const planned = new Set<Slot>();
  let step = 0;
  const run = await runMinigameHeadless(module, {
    players: seats.length,
    seed,
    script: (_elapsed, send, runner) => {
      const view = game && options.view(game);
      if (view) {
        lead.update(runner.hud().scores.map((entry) => entry.score));
        for (const me of options.pawns(view)) {
          const seat = seats[me.slot - 1];
          const skill = HAVOK_SKILLS[seat?.skill ?? 'normal'];
          const due = (step + me.slot * 3) % skill.replanSteps === 0 || !planned.has(me.slot);
          if (me.out || !due) continue;
          planned.add(me.slot);
          const decision = options.decide(me, view, skill, rng, seat?.strategy ?? 'normal');
          send(me.slot, { type: 'move', x: decision.x, y: decision.y });
          if (decision.dash) {
            send(me.slot, { type: 'press', button: 'a' });
            send(me.slot, { type: 'release', button: 'a' });
          }
        }
      }
      step++;
    },
  });
  const placements = run.outcome?.result.placements;
  if (!placements) throw new Error(`${options.info.id} lieferte kein Ergebnis`);
  const bySlot = new Map(placements.map((p) => [p.slot, p.score]));
  const slots = ([1, 2, 3, 4] as const).slice(0, seats.length);
  return { scores: slots.map((slot) => bySlot.get(slot) ?? 0), leadChanges: lead.changes };
}

/** `FairnessHarness` für ein Havok-Spiel (Eintrag in `FAIRNESS_HARNESSES`). */
export function havokHarness<G extends Minigame, V, P extends HavokHarnessPawn>(
  options: HavokHarnessOptions<G, V, P>,
): FairnessHarness {
  return {
    id: options.info.id,
    scoring: options.info.scoring,
    intruders: options.intruders.map(({ id, label }) => ({ id, label })),
    ciSeeds: options.ciSeeds ?? 8,
    play: (seats, seed) => playHavokMatch(options, seats, seed),
  };
}
