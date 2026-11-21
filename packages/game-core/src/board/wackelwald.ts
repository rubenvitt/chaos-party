/**
 * Spielbrett „Wackelwald“ (CHAOS-18, vergrößert in CHAOS-196): ein Rundkurs mit 74 Feldern und
 * vier Gabeln. Reine Daten – das Aussehen macht der Host (`apps/host/src/board/`).
 *
 * Lage (Welt-Einheiten, x nach rechts, z nach hinten; Fläche ≈ 41 × 26, unten Wald mit Teich):
 *
 * ```
 *        s28 ← s63 …… s26 ← s25 ← s24 … s21        oben: Uferweg am Bach (außen) und
 *         ↑  ↖ s74 …… s64 ↙              ↑         Baumkronenweg (innen), Gabel B in s25
 *        s73 ← s54 …… Lichtung …… s44 ← s20        Mitte: Lichtung, Gabel D in s20
 *         ↓                               ↑
 *        s29                             s18
 *       ↙   ↘          Teich            ↗   ↖
 *    s30     s35                     s17     s13   links Gabel C (s29), rechts Gabel A (s07)
 *     ⋮       ⋮                       ⋮       ⋮
 *    s71     s72                     s14     s08
 *       ↘   ↙                           ↖   ↗
 *        s38 → … → s43 → s01 → … → s06 → s07       unten (z = −12), Start s01 in der Mitte
 * ```
 *
 * Feld-IDs: s01 … s43 tragen die Rollen des alten 43-Felder-Bretts (`wackelwaldM2.ts`: Start,
 * Gabeln, Wegweiser, Wege), neue Felder ab s44. So bleiben Beispiel-Spielstand, Tests und Bilder
 * lesbar; die Laufrichtung folgt `next`, nicht der Nummer.
 *
 * Wege (Felder je Zweig; eine Runde ist 37–47 Felder lang):
 * - Gabel A (s07): Klippenweg 6 (sicher, Item) / Sumpfabkürzung 4 (Minus, Ereignisse).
 * - Gabel D (s20): Bachlauf oben herum (5 Felder bis Gabel B) / Lichtung 11 quer durch die Mitte.
 * - Gabel B (s25): Uferweg 11 (lang, viele Plus, zwei Items) / Baumkronenweg 8 (Hängebrücken
 *   über den Bäumen: kurz, riskant).
 * - Gabel C (s29): Pilzpfad 6 (sicher, Item) / Wackelbrücke 4 (Minus, Ereignis).
 *
 * Feldverteilung nach EXP-037 (CHAOS-196, `docs/experiments.md`): Jeder Zweig hat einen
 * Trophäen-Kandidaten, lange Wege bringen mehr Münzen, kurze mehr Risiko. 13 Kandidaten
 * (vier davon auf gemeinsamen Stücken: s05, s18, s42, s73), damit eine wandernde Trophäe auch auf dem
 * großen Brett in Reichweite landet; zehn Item-Felder etwa alle sieben Felder. In Bot-Partien
 * gewinnt „immer kurz“ gegen „immer lang“ in 47–51 % der Partien (10 und 20 Runden).
 */
import type { BoardDefinition, BoardSpace, SpaceKind } from '../types.ts';

type Row = readonly [
  id: string,
  kind: SpaceKind,
  x: number,
  z: number,
  next: string,
  label?: string,
];

/** Kompakte Tabelle: ID, Typ, Position, Nachfolger (mit `|` getrennt), optional Wegweiser. */
const ROWS: readonly Row[] = [
  // Unten rechts: Start → Gabel A
  ['s01', 'start', 0, -12, 's02'],
  ['s02', 'coins-plus', 2.4, -12, 's03'],
  ['s03', 'coins-plus', 4.8, -12, 's04'],
  ['s04', 'item', 7.2, -12, 's05'],
  ['s05', 'trophy', 9.6, -12, 's06'],
  ['s06', 'coins-minus', 12, -11.8, 's07'],
  ['s07', 'coins-plus', 14.3, -11, 's08|s14'],
  // Gabel A, langer sicherer Weg außen
  ['s08', 'coins-plus', 16.8, -10.4, 's09', 'Klippenweg'],
  ['s09', 'coins-plus', 18.8, -8.9, 's10'],
  ['s10', 'item', 20, -6.7, 's11'],
  ['s11', 'coins-plus', 20.6, -4.3, 's12'],
  ['s12', 'trophy', 20.6, -1.8, 's13'],
  ['s13', 'coins-plus', 19.7, 0.6, 's18'],
  // Gabel A, kurzer riskanter Weg innen
  ['s14', 'coins-minus', 13.4, -8.7, 's15', 'Sumpfabkürzung'],
  ['s15', 'event', 14.7, -6, 's16'],
  ['s16', 'trophy', 14.9, -3.4, 's17'],
  ['s17', 'event', 16, -0.6, 's18'],
  // Rechts: Zusammenführung A → Gabel D
  ['s18', 'trophy', 17.6, 1.8, 's19'],
  ['s19', 'item', 18, 4.3, 's20'],
  ['s20', 'coins-plus', 17.6, 6.8, 's21|s44'],
  // Gabel D, quer durch die Lichtung
  ['s44', 'coins-plus', 14.9, 5.1, 's45', 'Lichtung'],
  ['s45', 'event', 12.2, 3.6, 's46'],
  ['s46', 'coins-minus', 9.3, 2.3, 's47'],
  ['s47', 'coins-plus', 6.3, 1.2, 's48'],
  ['s48', 'item', 3.2, 0.5, 's49'],
  ['s49', 'trophy', 0, 0, 's50'],
  ['s50', 'event', -3, 0.1, 's51'],
  ['s51', 'coins-plus', -6.2, 0.4, 's52'],
  ['s52', 'coins-minus', -9.3, 1, 's53'],
  ['s53', 'item', -12.3, 2, 's54'],
  ['s54', 'coins-plus', -15.2, 3.2, 's73'],
  // Gabel D, oben herum → Gabel B
  ['s21', 'coins-plus', 18.6, 9.1, 's22', 'Bachlauf'],
  ['s22', 'event', 17, 11.2, 's23'],
  ['s23', 'coins-plus', 14.6, 12.6, 's24'],
  ['s24', 'trophy', 11.9, 13.1, 's25'],
  ['s25', 'coins-minus', 9.3, 13.2, 's26|s64'],
  // Gabel B, langer Weg außen am Bach
  ['s26', 'coins-plus', 6.8, 13.3, 's27', 'Uferweg'],
  ['s27', 'item', 4.4, 13.5, 's55'],
  ['s55', 'coins-plus', 2, 13.6, 's56'],
  ['s56', 'coins-plus', -0.4, 13.6, 's57'],
  ['s57', 'trophy', -2.8, 13.5, 's58'],
  ['s58', 'coins-plus', -5.2, 13.3, 's59'],
  ['s59', 'coins-minus', -7.6, 13.1, 's60'],
  ['s60', 'item', -10, 12.9, 's61'],
  ['s61', 'coins-plus', -12.4, 12.5, 's62'],
  ['s62', 'trophy', -14.7, 11.7, 's63'],
  ['s63', 'event', -16.6, 10.2, 's28'],
  // Gabel B, kurzer Weg innen über die Baumkronen (Hängebrücken)
  ['s64', 'event', 7.4, 10.7, 's65', 'Baumkronenweg'],
  ['s65', 'coins-minus', 4.3, 10.3, 's66'],
  ['s66', 'item', 1.2, 10, 's67'],
  ['s67', 'trophy', -1.9, 9.8, 's68'],
  ['s68', 'coins-plus', -5, 9.6, 's69'],
  ['s69', 'coins-minus', -8.1, 9.3, 's70'],
  ['s70', 'event', -11.2, 8.9, 's74'],
  ['s74', 'coins-plus', -14.3, 8.3, 's28'],
  // Links: Zusammenführungen B und D → Gabel C
  ['s28', 'coins-plus', -17.6, 7.6, 's73'],
  ['s73', 'trophy', -18, 4.6, 's29'],
  ['s29', 'coins-plus', -17.6, 1.8, 's30|s35'],
  // Gabel C, langer Weg außen
  ['s30', 'coins-plus', -19.7, 0.6, 's31', 'Pilzpfad'],
  ['s31', 'coins-plus', -20.6, -1.8, 's32'],
  ['s32', 'item', -20.6, -4.3, 's33'],
  ['s33', 'trophy', -20, -6.7, 's34'],
  ['s34', 'event', -18.8, -8.9, 's71'],
  ['s71', 'coins-plus', -16.8, -10.4, 's38'],
  // Gabel C, kurzer Weg innen über die Brücke (mit Trophäen-Kandidat, aber riskant)
  ['s35', 'coins-minus', -16, -0.6, 's36', 'Wackelbrücke'],
  ['s36', 'trophy', -14.9, -3.4, 's37'],
  ['s37', 'event', -14.7, -6, 's72'],
  ['s72', 'coins-plus', -14.9, -8.6, 's38'],
  // Unten links: Zusammenführung C → Start
  ['s38', 'coins-plus', -14.3, -11, 's39'],
  ['s39', 'item', -12, -11.8, 's40'],
  ['s40', 'coins-minus', -9.6, -12, 's41'],
  ['s41', 'coins-plus', -7.2, -12, 's42'],
  ['s42', 'trophy', -4.8, -12, 's43'],
  ['s43', 'coins-plus', -2.4, -12, 's01'],
];

function toSpace([id, kind, x, z, next, label]: Row): BoardSpace {
  const space = { id, kind, position: { x, z }, next: next.split('|') };
  return label === undefined ? space : { ...space, label };
}

export const WACKELWALD: BoardDefinition = {
  id: 'wackelwald',
  name: 'Wackelwald',
  start: 's01',
  spaces: ROWS.map(toSpace),
};
