/**
 * Brett-Entscheidungen der KI (CHAOS-181, ADR-020 §3): Antwort auf jeden Prompt der Brettphase
 * (Würfeln mit Item-Einsatz, Weg, Trophäe, Klau-Ziel, Reaktion). Aus `rules/simulate.ts`
 * hierher gezogen; die Balance-Simulation und die KI-Sitze im Server nutzen dieselbe Logik.
 *
 * Die KI liest nur, was Menschen am Bildschirm sehen: Felder, Figuren, Münzen, Trophäen-Felder,
 * sichtbare Fallen (CHAOS-51) und die Stellung der drehenden Felder. Kein Blick in künftige
 * Würfel oder Ereignisse (`state.internal`). Zufall nur aus dem übergebenen Strom.
 */
import { activeNext } from '../board/rotation.ts';
import { pickOne, pickWeighted, type Rng } from '../rng.ts';
import { ITEM_KINDS } from '../rules/items.ts';
import {
  BRACE_OPTION,
  BUY_OPTION,
  CANCEL_OPTION,
  itemOption,
  ROLL_OPTION,
  SHIELD_OPTION,
  SKIP_OPTION,
} from '../rules/prompts.ts';
import type { BoardDefinition, GameState, ItemKind, Prompt, Slot } from '../types.ts';

/** Feste Wegwahl je Slot (CHAOS-196, EXP-037). */
export type RouteChoice = 'short' | 'long';

/** Wie die KI am Brett entscheidet (ohne Zeit). Gemeinsamer Kern von `BotPolicy` und Live-KI. */
export interface BoardDecisionPolicy {
  /** Wahrscheinlichkeit, im Würfel-Prompt ein angebotenes Item einzusetzen (zufällig welches). */
  readonly itemUseChance: number;
  /**
   * Gezielter Item-Einsatz (CHAOS-181, „schwer nutzt Items gezielt“): Wahrscheinlichkeit, im
   * Würfel-Prompt nach Lage zu entscheiden ({@link smartItemOption}) statt nach
   * `itemUseChance`. Gezielt heißt auch: ein Item aufheben, wenn es gerade nichts bringt.
   * Fehlt oder 0 = nie (kein Zufallszug, Verhalten der Simulation bis CHAOS-181).
   */
  readonly smartItemChance?: number;
  /** Schwellen des gezielten Einsatzes (Spielstil, CHAOS-186); fehlt = Standard. */
  readonly smartItem?: SmartItemTuning;
  /**
   * Vorliebe beim zufälligen Item-Einsatz (Spielstil, CHAOS-186): relatives Gewicht je Item
   * (fehlt = 1). Fehlt die ganze Angabe, wird gleichverteilt gezogen (`pickOne`, wie bisher).
   * Beide Wege ziehen genau eine Zufallszahl.
   */
  readonly itemWeights?: Readonly<Partial<Record<ItemKind, number>>>;
  /** Trophäe kaufen, wenn möglich. */
  readonly buyTrophies: boolean;
  /** Ziel des Münzklaus: reichster Mitspieler oder zufällig. */
  readonly target: 'richest' | 'random';
  /**
   * Wahrscheinlichkeit, an einer Verzweigung den Weg mit der kürzesten Strecke zur aktiven
   * Trophäe zu nehmen (sonst zufällig). 0 = immer zufällig.
   */
  readonly trophyPathChance: number;
  /**
   * Sichtbare Fallen (CHAOS-51, EXP-019): Wahrscheinlichkeit, an einer Verzweigung Wege zu
   * meiden, auf denen in den nächsten `TRAP_LOOKAHEAD` Feldern eine fremde Falle liegt (nur
   * wenn ein Weg ohne Falle bleibt). Wird vor der Trophäen-Wahl geprüft. 0 = Fallen sind egal.
   */
  readonly avoidTrapChance: number;
  /**
   * Feste Wegwahl je Slot (CHAOS-196, EXP-037: Ist die Wegwahl fair?): `short` nimmt an jeder
   * Gabel den Weg mit der kürzesten Strecke zurück zum Start, `long` den längsten. Geht vor
   * Fallen und Trophäe und zieht keine Zufallszahl; Slots ohne Eintrag wählen normal.
   */
  readonly routes?: Readonly<Partial<Record<Slot, RouteChoice>>>;
}

/**
 * Schwellen von {@link smartItemOption}; jede fehlende gilt mit dem Standard
 * ({@link SMART_STEAL_MIN_COINS}, {@link SMART_DOUBLE_MIN_DISTANCE}, {@link SMART_TRAP_MAX_BEHIND}).
 * `trapMaxBehind: 0` heißt: gezielt nie eine Falle.
 */
export interface SmartItemTuning {
  readonly stealMinCoins?: number;
  readonly doubleMinDistance?: number;
  readonly trapMaxBehind?: number;
}

/** So weit (Felder) schaut die KI an einer Verzweigung nach sichtbaren Fallen. */
export const TRAP_LOOKAHEAD = 6;

/** Klau lohnt sich gezielt erst, wenn das reichste Ziel mindestens so viele Münzen hat. */
export const SMART_STEAL_MIN_COINS = 6;
/** Doppelwürfel gezielt: nur wenn die nächste Trophäe mindestens so weit weg ist … */
export const SMART_DOUBLE_MIN_DISTANCE = 4;
/** Falle gezielt: Mitspieler höchstens so viele Felder hinter der eigenen Figur. */
export const SMART_TRAP_MAX_BEHIND = 12;

/**
 * Schritte von `from` bis zum nächsten der `targets` entlang der Laufrichtung (BFS), mit der
 * Stellung der drehenden Felder in Runde `round` (CHAOS-199): Die KI sieht das Karussell wie die
 * Spieler am Tisch. `Infinity`, wenn keins erreichbar ist.
 */
export function distanceTo(
  board: BoardDefinition,
  from: string,
  targets: readonly string[],
  round: number,
): number {
  const next = new Map(board.spaces.map((space) => [space.id, activeNext(board, space.id, round)]));
  const seen = new Set([from]);
  let frontier = [from];
  for (let distance = 0; frontier.length > 0; distance++) {
    if (frontier.some((id) => targets.includes(id))) return distance;
    const following: string[] = [];
    for (const id of frontier) {
      for (const to of next.get(id) ?? []) {
        if (!seen.has(to)) {
          seen.add(to);
          following.push(to);
        }
      }
    }
    frontier = following;
  }
  return Infinity;
}

function choosePath(
  candidates: readonly string[],
  state: GameState,
  board: BoardDefinition,
  policy: BoardDecisionPolicy,
  rng: Rng,
): string {
  const route = state.prompt ? policy.routes?.[state.prompt.slot] : undefined;
  if (route) {
    const lengths = candidates.map((id) => distanceTo(board, id, [board.start], state.round));
    const pick = route === 'short' ? Math.min(...lengths) : Math.max(...lengths);
    return candidates[lengths.indexOf(pick)] ?? pickOne(rng, candidates);
  }
  let ids = candidates;
  if (policy.avoidTrapChance > 0 && rng.next() < policy.avoidTrapChance) {
    const slot = state.prompt?.slot;
    const traps = state.traps.filter((trap) => trap.owner !== slot).map((trap) => trap.spaceId);
    const safe = ids.filter((id) => distanceTo(board, id, traps, state.round) >= TRAP_LOOKAHEAD);
    if (traps.length > 0 && safe.length > 0) ids = safe;
  }
  if (policy.trophyPathChance > 0 && rng.next() < policy.trophyPathChance) {
    const distances = ids.map((id) => distanceTo(board, id, state.trophySpaces, state.round));
    const best = Math.min(...distances);
    const nearest = ids.filter((_, index) => distances[index] === best);
    if (best !== Infinity && nearest.length > 0) return pickOne(rng, nearest);
  }
  return pickOne(rng, ids);
}

/**
 * Gezielter Item-Einsatz im Würfel-Prompt (ohne Zufall), nach sichtbarer Lage (Schwellen aus
 * `tuning`, sonst Standard):
 * 1. **Münzklau**, wenn ein Mitspieler mindestens {@link SMART_STEAL_MIN_COINS} Münzen hat.
 * 2. **Doppelwürfel**, wenn die eigene Figur sich eine Trophäe leisten kann und die nächste
 *    mindestens {@link SMART_DOUBLE_MIN_DISTANCE} Felder entfernt ist.
 * 3. **Falle**, wenn ein Mitspieler bis zu {@link SMART_TRAP_MAX_BEHIND} Felder hinter der
 *    eigenen Figur steht (er läuft wahrscheinlich darüber).
 * Sonst `ROLL_OPTION`: Das Item bleibt für später.
 */
export function smartItemOption(
  prompt: Prompt,
  state: GameState,
  board: BoardDefinition,
  tuning: SmartItemTuning = {},
): string {
  const stealMinCoins = tuning.stealMinCoins ?? SMART_STEAL_MIN_COINS;
  const doubleMinDistance = tuning.doubleMinDistance ?? SMART_DOUBLE_MIN_DISTANCE;
  const trapMaxBehind = tuning.trapMaxBehind ?? SMART_TRAP_MAX_BEHIND;
  const offered = new Set(prompt.options.map((option) => option.id));
  const me = state.players.find((player) => player.slot === prompt.slot);
  if (!me) return ROLL_OPTION;
  const others = state.players.filter((player) => player.slot !== prompt.slot);
  if (
    offered.has(itemOption('coin-steal')) &&
    others.some((player) => player.coins >= stealMinCoins)
  ) {
    return itemOption('coin-steal');
  }
  if (
    offered.has(itemOption('double-dice')) &&
    me.coins >= state.config.rules.trophy.price &&
    distanceTo(board, me.spaceId, state.trophySpaces, state.round) >= doubleMinDistance
  ) {
    return itemOption('double-dice');
  }
  if (
    offered.has(itemOption('trap')) &&
    others.some((player) => {
      const behind = distanceTo(board, player.spaceId, [me.spaceId], state.round);
      return behind >= 1 && behind <= trapMaxBehind;
    })
  ) {
    return itemOption('trap');
  }
  return ROLL_OPTION;
}

/**
 * Zufälliges Item aus den angebotenen Optionen (`item:<art>`), gewichtet nach `weights`
 * (fehlt = 1, negative zählen als 0). Ohne Gewichte gleichverteilt wie `pickOne`. Zieht eine
 * Zufallszahl (bei Summe 0 keine und das erste Item).
 */
export function pickItem(
  rng: Rng,
  items: readonly string[],
  weights: Readonly<Partial<Record<ItemKind, number>>> | undefined,
): string {
  if (weights === undefined) return pickOne(rng, items);
  const weightOf = (id: string): number => {
    const kind = ITEM_KINDS.find((item) => itemOption(item) === id);
    return Math.max(0, (kind === undefined ? undefined : weights[kind]) ?? 1);
  };
  return (
    pickWeighted(
      rng,
      items.map((id) => [id, weightOf(id)] as const),
    ) ??
    items[0] ??
    ROLL_OPTION
  );
}

/**
 * Antwort auf einen Brett-Prompt (gewählte Option, immer eine angebotene außer `cancel` beim
 * Klau ohne Ziel). Zieht Zufall aus `rng` in fester Reihenfolge; Simulationen bleiben damit je
 * Seed gleich.
 */
export function decideBoardPrompt(
  prompt: Prompt,
  state: GameState,
  board: BoardDefinition,
  policy: BoardDecisionPolicy,
  rng: Rng,
): string {
  const ids = prompt.options.map((o) => o.id);
  switch (prompt.kind) {
    case 'roll': {
      const items = ids.filter((id) => id !== ROLL_OPTION);
      if (items.length === 0) return ROLL_OPTION;
      const smart = policy.smartItemChance ?? 0;
      if (smart > 0 && rng.next() < smart) {
        return smartItemOption(prompt, state, board, policy.smartItem);
      }
      if (rng.next() < policy.itemUseChance) return pickItem(rng, items, policy.itemWeights);
      return ROLL_OPTION;
    }
    case 'target': {
      const targets = prompt.options.filter((o) => o.slot !== undefined);
      if (targets.length === 0) return CANCEL_OPTION;
      if (policy.target === 'random') return pickOne(rng, targets).id;
      const coinsOf = (slot: Slot | undefined): number =>
        state.players.find((p) => p.slot === slot)?.coins ?? 0;
      return targets.reduce((best, o) => (coinsOf(o.slot) > coinsOf(best.slot) ? o : best)).id;
    }
    case 'path':
      return choosePath(ids, state, board, policy, rng);
    case 'trophy':
      return policy.buyTrophies ? BUY_OPTION : SKIP_OPTION;
    case 'reaction':
      return ids.includes(SHIELD_OPTION) ? SHIELD_OPTION : BRACE_OPTION;
  }
}
