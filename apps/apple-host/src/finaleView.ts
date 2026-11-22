/**
 * Finale im JS-Kern (CHAOS-145): Trophäenzählung und Siegerbildschirm wie `Finale.tsx` im
 * Browser-Host, ohne React. Ablauf, Klänge, Texte, Bonus-Titel und Podest-Aufstellung sind
 * dieselben framework-freien Module (`apps/host/src/finale/finalePlan.ts`, `awards.ts`,
 * `texts.ts`, `podiumLayout.ts`); Swift zeichnet nur `renderState().final`.
 *
 * Die Uhr läuft ab dem ersten Endstand mit `ranking` (`advance` je `tick`), ohne Zeitgeber;
 * `skip()` springt zum Siegerbildschirm, `reset()` (Revanche, Lobby) vergisst alles.
 */
import {
  aiTagline,
  CHARACTER_NAMES,
  PLAYER_SLOTS,
  type BoardView,
  type CharacterId,
  type RankingEntryInfo,
  type SlotNumber,
} from '@chaos-party/protocol';
import { playerName, winnerText } from '../../host/src/board/texts.ts';
import { bonusAwards } from '../../host/src/finale/awards.ts';
import {
  buildFinalePlan,
  finaleCues,
  finaleStateAt,
  winningCriterion,
  type FinalePlan,
  type FinaleState as PlanState,
} from '../../host/src/finale/finalePlan.ts';
import {
  blockColor,
  centeredPodiumSlots,
  podiumHeight,
} from '../../host/src/finale/podiumLayout.ts';
import { CRITERION_BADGE, tiebreakText, winnerReason } from '../../host/src/finale/texts.ts';
import type { FinaleState, PodiumEntry } from './contract.ts';
import { createSoundTrack } from './soundTrack.ts';

/** Bonus-Titel am Siegerbildschirm (wie `Finale.tsx`). */
const MAX_AWARDS = 3;

export interface FinaleView {
  /** Je `tick` im Endstand: startet beim ersten Aufruf die Uhr, löst Klänge aus. */
  advance(view: BoardView, now: number): void;
  /** Stand für `renderState().final`, `null` vor dem ersten `advance`. */
  state(now: number, canRematch: boolean): FinaleState | null;
  /** „Überspringen“: direkt zum Siegerbildschirm. `false`, wenn kein Finale läuft. */
  skip(): boolean;
  reset(): void;
}

function characterOf(view: BoardView, slot: SlotNumber): CharacterId {
  return view.players.find((p) => p.slot === slot)?.character ?? 'robot';
}

function playerFields(view: BoardView, slot: SlotNumber) {
  const character = characterOf(view, slot);
  const ai = aiTagline(view.players.find((p) => p.slot === slot));
  return {
    slot,
    name: playerName(view, slot),
    character,
    characterName: CHARACTER_NAMES[character].name,
    color: PLAYER_SLOTS[slot].color,
    symbol: PLAYER_SLOTS[slot].symbol,
    // KI-Abzeichen (CHAOS-182), fehlt bei Menschen.
    ...(ai === null ? {} : { ai }),
  };
}

/** Titel und Zeile der Trophäenzählung (`Tally` in `Finale.tsx`). */
function tallyText(view: BoardView, state: PlanState): { title: string; lead: string } {
  const { beat } = state;
  if (beat.kind === 'tiebreak') return tiebreakText(beat.criterion);
  if (beat.kind === 'reveal') {
    return {
      title: 'Die Trophäenzählung!',
      lead:
        beat.place === 1
          ? 'Und auf Platz 1 …'
          : `Platz ${String(beat.place)}: ${playerName(view, beat.slot)}`,
    };
  }
  if (beat.kind === 'winner') {
    return { title: 'Endstand', lead: winnerText(view) ?? 'Spielende' };
  }
  return {
    title: 'Die Trophäenzählung!',
    lead: 'Wer hat die meisten Trophäen? Bei Gleichstand zählen die Münzen.',
  };
}

/** Podest in Rangfolge (`podiumStage.ts`): Platz 1 jubelt, der letzte schmollt, die anderen hüpfen. */
export function podiumEntries(
  view: BoardView,
  ranking: readonly RankingEntryInfo[],
): PodiumEntry[] {
  const sorted = [...ranking].sort((a, b) => a.place - b.place || a.slot - b.slot);
  const xs = centeredPodiumSlots(sorted.length);
  return sorted.map((entry, index) => ({
    slot: entry.slot,
    character: characterOf(view, entry.slot),
    color: PLAYER_SLOTS[entry.slot].color,
    symbol: PLAYER_SLOTS[entry.slot].symbol,
    place: entry.place,
    x: xs[index] ?? 0,
    height: podiumHeight(entry.place),
    blockColor: blockColor(entry.place),
    anim:
      entry.place === 1
        ? 'cheer'
        : entry.place === sorted.length && sorted.length > 1
          ? 'sad'
          : 'jump',
  }));
}

export function createFinaleView(): FinaleView {
  let current: {
    view: BoardView;
    ranking: readonly RankingEntryInfo[];
    plan: FinalePlan;
    planKey: string;
    startedAt: number;
    skipped: boolean;
    last: PlanState | null;
  } | null = null;
  const sounds = createSoundTrack();

  const elapsedOf = (now: number) =>
    !current
      ? 0
      : current.skipped
        ? Number.POSITIVE_INFINITY
        : Math.max(0, now - current.startedAt);

  return {
    advance(view, now) {
      const ranking = view.ranking;
      if (!ranking || ranking.length === 0) return;
      const planKey = JSON.stringify([ranking, view.endedEarly]);
      if (!current) {
        current = {
          view,
          ranking,
          plan: buildFinalePlan(ranking, view.endedEarly),
          planKey,
          startedAt: now,
          skipped: false,
          last: null,
        };
      } else {
        current.view = view;
        if (current.planKey !== planKey) {
          current.ranking = ranking;
          current.plan = buildFinalePlan(ranking, view.endedEarly);
          current.planKey = planKey;
        }
      }
      const next = finaleStateAt(current.plan, current.ranking, elapsedOf(now));
      for (const cue of finaleCues(current.last, next)) sounds.play(cue, now);
      current.last = next;
    },
    state(now, canRematch) {
      if (!current) return null;
      const { view, ranking, plan } = current;
      const elapsed = elapsedOf(now);
      const state = finaleStateAt(plan, ranking, elapsed);
      const { title, lead } = tallyText(view, state);
      const criterion = winningCriterion(ranking);
      const rows = [...ranking].sort((a, b) => a.place - b.place || a.slot - b.slot);
      return {
        beat: state.beat.kind,
        beatIndex: state.beatIndex,
        progress: state.progress,
        done: state.done,
        elapsedMs: Number.isFinite(elapsed) ? elapsed : plan.winnerAtMs,
        winnerAtMs: plan.winnerAtMs,
        endedEarly: view.endedEarly,
        kicker: view.endedEarly ? 'Partie vorzeitig beendet' : 'Spielende',
        title,
        lead,
        cards: state.cards.map((card) => ({
          ...playerFields(view, card.slot),
          place: card.place,
          badge: CRITERION_BADGE[card.decidedBy],
          revealed: card.revealed,
          active: card.active,
          trophies: card.trophies,
          coins: card.coins,
          placeShown: card.placeShown,
        })),
        winner: {
          headline: winnerText(view) ?? 'Spielende',
          reason: criterion ? winnerReason(criterion) : null,
          earlyNote: view.endedEarly
            ? `Vorzeitig beendet – es zählt der Stand von Runde ${String(Math.max(1, view.round))}/${String(view.rounds)}`
            : null,
          ranking: rows.map((entry) => ({
            ...playerFields(view, entry.slot),
            place: entry.place,
            badge: CRITERION_BADGE[entry.decidedBy],
            trophies: entry.trophies,
            coins: entry.coins,
          })),
          awards: bonusAwards(view.players)
            .slice(0, MAX_AWARDS)
            .map((award) => ({
              id: award.id,
              title: award.title,
              detail: award.detail,
              slots: [...award.slots],
              names: award.slots.map((slot) => playerName(view, slot)).join(' & '),
            })),
        },
        podium: podiumEntries(view, ranking),
        canRematch: state.done && canRematch,
        sounds: sounds.list(now),
      };
    },
    skip() {
      if (!current) return false;
      current.skipped = true;
      return true;
    },
    reset() {
      current = null;
      sounds.reset();
    },
  };
}
