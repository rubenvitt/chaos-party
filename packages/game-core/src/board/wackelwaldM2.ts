/**
 * Wackelwald im Stand von M2 bis M4 (CHAOS-18, CHAOS-24): ein Rundkurs mit 43 Feldern und zwei
 * Verzweigungen. Seit CHAOS-196 spielt die Partie auf dem größeren Wackelwald (`wackelwald.ts`);
 * dieses Brett bleibt nur für die Balance-Experimente EXP-001 … EXP-022 (`rules/experiments*.ts`),
 * damit ihre Tabellen in `docs/experiments.md` wiederholbar bleiben. Nicht im Brett-Register.
 *
 * Lage (Welt-Einheiten, x nach rechts, z nach hinten; Fläche ≈ 32 × 18, Mitte frei für Deko):
 *
 * ```
 *        s29 ← s28 ← … ← s19 ← s18          oben (z ≈ 8,6), Laufrichtung nach links
 *       ↙   ↘                  ↖   ↖
 *    s30     s35             s17     s13
 *     ⋮       ⋮               ⋮       ⋮
 *    s34     s37             s14     s08
 *       ↘   ↙                  ↖   ↗
 *        s38 → … → s43 → s01 → … → s07      unten (z ≈ −8,6), Start s01 in der Mitte
 * ```
 *
 * - Gabel A (s07, rechts): Klippenweg außen (s08–s13, 6 Felder, sicher) oder
 *   Sumpfabkürzung innen (s14–s17, 4 Felder, riskant); beide treffen sich in s18.
 * - Gabel B (s29, links): Pilzpfad außen (s30–s34, 5 Felder) oder Wackelbrücke innen
 *   (s35–s37, 3 Felder, mit Trophäen-Kandidat); beide treffen sich in s38.
 * - Eine Runde ist 32–36 Felder lang (kürzeste/längste Wegwahl).
 *
 * Feldverteilung nach den Experimenten EXP-002/EXP-003 (CHAOS-24, `docs/experiments.md`):
 * - Kurze Wege sind riskanter (Minus- und Ereignisfelder), lange Wege sicherer (Plus, Item).
 * - Sechs Trophäen-Kandidaten über den Kurs verteilt: an Gabel A auf beiden Wegen (s12
 *   Klippenweg, s16 Sumpfabkürzung), oben (s21, s24), links auf der Brücke (s36) und unten
 *   links kurz vor dem Start (s42). So liegt auch in kurzen Partien (5 Runden ≈ 18 Felder je
 *   Spieler) meist eine aktive Trophäe in Reichweite.
 * - Sechs Item-Felder etwa alle sechs Felder (s04, s10, s19, s26, s32, s39).
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
  ['s01', 'start', 0, -8.6, 's02'],
  ['s02', 'coins-plus', 2.3, -8.6, 's03'],
  ['s03', 'coins-plus', 4.6, -8.6, 's04'],
  ['s04', 'item', 6.9, -8.6, 's05'],
  ['s05', 'coins-plus', 9.2, -8.6, 's06'],
  ['s06', 'coins-minus', 11.4, -8.4, 's07'],
  ['s07', 'coins-plus', 13.4, -7.2, 's08|s14'],
  // Gabel A, langer sicherer Weg außen
  ['s08', 'coins-plus', 14.8, -5.5, 's09', 'Klippenweg'],
  ['s09', 'coins-plus', 15.5, -3.5, 's10'],
  ['s10', 'item', 15.6, -1.3, 's11'],
  ['s11', 'coins-plus', 15.6, 0.9, 's12'],
  ['s12', 'trophy', 15.7, 3.1, 's13'],
  ['s13', 'coins-plus', 14.9, 5, 's18'],
  // Gabel A, kurzer riskanter Weg innen
  ['s14', 'coins-minus', 11.5, -4.8, 's15', 'Sumpfabkürzung'],
  ['s15', 'event', 11.2, -1.8, 's16'],
  ['s16', 'trophy', 11.2, 1.2, 's17'],
  ['s17', 'coins-minus', 11.5, 4.2, 's18'],
  // Oben: Zusammenführung A → Gabel B
  ['s18', 'coins-plus', 13.4, 6.6, 's19'],
  ['s19', 'item', 11.4, 8.2, 's20'],
  ['s20', 'event', 9, 8.6, 's21'],
  ['s21', 'trophy', 6.4, 8.6, 's22'],
  ['s22', 'coins-minus', 3.9, 8.6, 's23'],
  ['s23', 'coins-plus', 1.3, 8.6, 's24'],
  ['s24', 'trophy', -1.3, 8.6, 's25'],
  ['s25', 'coins-plus', -3.9, 8.6, 's26'],
  ['s26', 'item', -6.4, 8.6, 's27'],
  ['s27', 'coins-plus', -9, 8.6, 's28'],
  ['s28', 'coins-minus', -11.4, 8.2, 's29'],
  ['s29', 'coins-plus', -13.4, 6.6, 's30|s35'],
  // Gabel B, langer Weg außen
  ['s30', 'coins-plus', -15, 4.6, 's31', 'Pilzpfad'],
  ['s31', 'coins-plus', -15.6, 2.2, 's32'],
  ['s32', 'item', -15.6, -0.3, 's33'],
  ['s33', 'coins-plus', -15.6, -2.9, 's34'],
  ['s34', 'event', -15.1, -5.2, 's38'],
  // Gabel B, kurzer Weg innen über die Brücke (mit Trophäen-Kandidat, aber riskant)
  ['s35', 'coins-minus', -11.1, 3.5, 's36', 'Wackelbrücke'],
  ['s36', 'trophy', -11, -0.3, 's37'],
  ['s37', 'event', -11.1, -4.1, 's38'],
  // Unten links: Zusammenführung B → Start
  ['s38', 'coins-plus', -13.4, -7.2, 's39'],
  ['s39', 'item', -11.4, -8.4, 's40'],
  ['s40', 'coins-minus', -9.2, -8.6, 's41'],
  ['s41', 'coins-plus', -6.9, -8.6, 's42'],
  ['s42', 'trophy', -4.6, -8.6, 's43'],
  ['s43', 'coins-plus', -2.3, -8.6, 's01'],
];

function toSpace([id, kind, x, z, next, label]: Row): BoardSpace {
  const space = { id, kind, position: { x, z }, next: next.split('|') };
  return label === undefined ? space : { ...space, label };
}

export const WACKELWALD_M2: BoardDefinition = {
  id: 'wackelwald-m2',
  name: 'Wackelwald (M2)',
  start: 's01',
  spaces: ROWS.map(toSpace),
};
