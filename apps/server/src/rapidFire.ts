import { RAPID_FIRE_RULE, type RapidFireRules } from '@chaos-party/game-core';

/**
 * Schnellfeuer-Schalter des Servers (CHAOS-90), z. B. aus `SCHNELLFEUER`:
 * - leer oder `an`: Standard aus EXP-039 (Ereignis „Schnellfeuer!“, sonst im Finale)
 * - `aus`: kein Schnellfeuer
 * - `ereignis` | `halbzeit` | `finale`: nur dieser Auslöser (Playtest-Vergleich)
 * Unbekannte Werte liefern `undefined` (Aufrufer warnt und nimmt den Standard).
 */
export function parseRapidFire(raw: string | undefined): RapidFireRules | null | undefined {
  const value = raw?.trim().toLowerCase() ?? '';
  switch (value) {
    case '':
    case 'an':
      return RAPID_FIRE_RULE;
    case 'aus':
      return null;
    case 'ereignis':
      return { trigger: 'event', maxPerGame: 1, eventWeight: RAPID_FIRE_RULE.eventWeight ?? 1 };
    case 'halbzeit':
      return { trigger: 'halftime' };
    case 'finale':
      return { trigger: 'finale' };
    default:
      return undefined;
  }
}

export const RAPID_FIRE_CHOICES = ['an', 'aus', 'ereignis', 'halbzeit', 'finale'] as const;
