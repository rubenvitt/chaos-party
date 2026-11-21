/**
 * Wertung und Prüfung von Minispiel-Ergebnissen (rein, ohne Babylon).
 *
 * Minispiele ändern den Brettzustand nie selbst: Sie liefern ein `MinigameResult`, die
 * Laufzeit prüft es hier, der Server prüft es in game-core erneut (Host-Nachricht ist
 * Eingabe von außen) und erst game-core verteilt Münzen.
 */
import {
  MINIGAME_ID_PATTERN,
  MINIGAME_TEXT_LIMITS,
  type MinigameInfo,
  type MinigamePlacement,
  type MinigameResult,
  type Slot,
} from './info.ts';
import {
  KOOP_MAX_TIER,
  TEAM_ASSIGNMENTS,
  TEAM_FORMS,
  teamPlayMinPlayers,
  type MinigameTeams,
} from './teams.ts';

/** Größter zulässiger Betrag einer Punktzahl (Schutz vor Unsinn aus dem Netz). */
export const MAX_SCORE = 1_000_000;

export interface SlotScore {
  readonly slot: Slot;
  readonly score: number;
}

/**
 * Plätze nach Punkten mit Gleichstand („1224“-Wertung): Gleiche Punkte → gleicher Platz,
 * der nächste Platz überspringt entsprechend. Punkte werden auf Ganzzahlen gerundet,
 * damit Gleitkomma-Rauschen (Physik) keine Scheinunterschiede erzeugt.
 * Ausgabe nach Platz, bei Gleichstand nach Slot sortiert (stabil, deterministisch).
 */
export function rankByScore(
  scores: readonly SlotScore[],
  scoring: MinigameInfo['scoring'] = 'higher',
): MinigamePlacement[] {
  const rounded = scores.map((entry) => ({ slot: entry.slot, score: Math.round(entry.score) }));
  const better = (a: number, b: number) => (scoring === 'higher' ? b - a : a - b);
  const sorted = [...rounded].sort((a, b) => better(a.score, b.score) || a.slot - b.slot);
  const placements: MinigamePlacement[] = [];
  sorted.forEach((entry, index) => {
    const previous = placements[index - 1];
    const place = previous?.score === entry.score ? previous.place : index + 1;
    placements.push({ slot: entry.slot, place, score: entry.score });
  });
  return placements;
}

export type ResultCheck = { readonly ok: true } | { readonly ok: false; readonly reason: string };

/**
 * Prüft ein Ergebnis gegen die erwarteten Teilnehmer:
 * - passende Minispiel-ID,
 * - jeder Teilnehmer genau einmal, keine Fremden,
 * - Plätze bilden eine gültige Wertung mit Gleichstand (1-basiert, lückenlos im Sinne von „1224“),
 * - Punkte sind Ganzzahlen in Grenzen, und bei `scoring` passen Punkte und Plätze zusammen,
 * - Höhepunkte (optional) halten die Textgrenzen ein.
 */
export function checkResult(
  result: MinigameResult,
  expected: {
    readonly minigameId: string;
    readonly slots: readonly Slot[];
    readonly scoring?: MinigameInfo['scoring'];
    /** Aufstellung der Runde (CHAOS-89); fehlt = jeder gegen jeden. */
    readonly teams?: MinigameTeams | null;
  },
): ResultCheck {
  if (!MINIGAME_ID_PATTERN.test(result.minigameId)) return fail('Ungültige Minispiel-ID');
  if (result.minigameId !== expected.minigameId) {
    return fail(`Falsches Minispiel: ${result.minigameId} statt ${expected.minigameId}`);
  }
  const { placements } = result;
  if (placements.length !== expected.slots.length) return fail('Teilnehmerzahl passt nicht');
  const seen = new Set<Slot>();
  for (const entry of placements) {
    if (!expected.slots.includes(entry.slot)) return fail(`Slot ${entry.slot} spielt nicht mit`);
    if (seen.has(entry.slot)) return fail(`Slot ${entry.slot} doppelt`);
    seen.add(entry.slot);
    if (!Number.isInteger(entry.score) || Math.abs(entry.score) > MAX_SCORE) {
      return fail(`Ungültige Punkte für Slot ${entry.slot}`);
    }
    if (!Number.isInteger(entry.place) || entry.place < 1 || entry.place > placements.length) {
      return fail(`Ungültiger Platz für Slot ${entry.slot}`);
    }
  }
  // Wertung mit Gleichstand: Platz = 1 + Anzahl der Spieler mit strikt besserem Platz.
  for (const entry of placements) {
    const better = placements.filter((other) => other.place < entry.place).length;
    if (entry.place !== better + 1) return fail('Plätze bilden keine gültige Wertung');
  }
  const teams = expected.teams ?? null;
  const outcome = result.outcome;
  if (teams === null) {
    if (outcome !== undefined) return fail('Ausgang ohne Teams');
  } else if (teams.layout === 'koop') {
    if (outcome?.kind !== 'koop') return fail('Koop-Ausgang fehlt');
    if (!Number.isInteger(outcome.tier) || outcome.tier < 0 || outcome.tier > KOOP_MAX_TIER) {
      return fail('Koop-Stufe ungültig');
    }
  } else {
    // Teams: Die Plätze folgen allein dem Ausgang, die Punkte sind Einzelleistung (Anzeige).
    if (outcome?.kind !== 'teams') return fail('Team-Ausgang fehlt');
    const { winner } = outcome;
    if (winner !== null && (!Number.isInteger(winner) || teams.teams[winner] === undefined)) {
      return fail('Siegerteam ungültig');
    }
    const winners = winner === null ? null : (teams.teams[winner] ?? []);
    const behind = (winners?.length ?? 0) + 1;
    for (const entry of placements) {
      const place = winners === null || winners.includes(entry.slot) ? 1 : behind;
      if (entry.place !== place) return fail('Plätze passen nicht zum Team-Ausgang');
    }
    return checkHighlights(result);
  }
  if (expected.scoring) {
    const sign = expected.scoring === 'higher' ? 1 : -1;
    for (const a of placements) {
      for (const b of placements) {
        if (a.place < b.place && sign * (a.score - b.score) <= 0) {
          return fail('Plätze passen nicht zu den Punkten');
        }
        if (a.place === b.place && a.score !== b.score) {
          return fail('Gleicher Platz bei verschiedenen Punkten');
        }
      }
    }
  }
  return checkHighlights(result);
}

function checkHighlights(result: MinigameResult): ResultCheck {
  const highlights = result.highlights ?? [];
  if (highlights.length > MINIGAME_TEXT_LIMITS.highlights) return fail('Zu viele Höhepunkte');
  if (
    highlights.some((line) => line.length === 0 || line.length > MINIGAME_TEXT_LIMITS.highlight)
  ) {
    return fail('Höhepunkt zu lang oder leer');
  }
  return { ok: true };
}

/** Prüft einen Steckbrief (Tests jedes Minispiels und der Katalog rufen das auf). */
export function checkInfo(info: MinigameInfo): ResultCheck {
  const limits = MINIGAME_TEXT_LIMITS;
  if (!MINIGAME_ID_PATTERN.test(info.id)) return fail('ID ungültig');
  if (info.title.length === 0 || info.title.length > limits.title) return fail('Titel');
  if (info.tagline.length === 0 || info.tagline.length > limits.tagline) return fail('Untertitel');
  if (info.instructions.length < 1 || info.instructions.length > limits.instructions) {
    return fail('Anleitung: 1–3 Zeilen');
  }
  if (info.instructions.some((line) => line.length === 0 || line.length > limits.instruction)) {
    return fail('Anleitungszeile zu lang oder leer');
  }
  const labels = [info.controls.joystick, info.controls.a, info.controls.b];
  if (labels.every((label) => label === null)) return fail('Keine Bedienung');
  if (
    labels.some(
      (label) => label !== null && (label.length === 0 || label.length > limits.controlLabel),
    )
  ) {
    return fail('Bedien-Text zu lang oder leer');
  }
  if (!Number.isInteger(info.durationMs) || info.durationMs < 5_000 || info.durationMs > 90_000) {
    return fail('Spielzeit 5–90 s');
  }
  if (info.scoreUnit.length === 0 || info.scoreUnit.length > 16) return fail('Punkte-Einheit');
  const teamPlay = info.teamPlay;
  if (teamPlay) {
    if (!TEAM_FORMS.includes(teamPlay.form)) return fail('Spielform unbekannt');
    if (teamPlay.assignment !== undefined && !TEAM_ASSIGNMENTS.includes(teamPlay.assignment)) {
      return fail('Team-Zuteilung unbekannt');
    }
    if (teamPlay.withTwo && !teamPlay.withThree) return fail('Zu zweit, aber nicht zu dritt');
    if ((info.minPlayers ?? 1) < teamPlayMinPlayers(teamPlay)) {
      return fail('minPlayers kleiner als die Spielform erlaubt');
    }
  }
  return { ok: true };
}

function fail(reason: string): ResultCheck {
  return { ok: false, reason };
}
