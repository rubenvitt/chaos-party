/**
 * Zonen-Tracker des geteilten iPads (CHAOS-13, ADR-008): ordnet jede Berührung
 * beim Aufsetzen einer Spielerzone und darin einem Bedienelement zu und hält
 * diese Zuordnung bis zum Abheben oder Abbrechen – auch wenn der Finger dabei
 * über die Zonengrenze rutscht. Framework- und DOM-frei; Eingang sind
 * Touch-Kennungen (`Touch.identifier`) und Bildschirmpunkte, Ausgang sind
 * Effekte, die der Aufrufer in Protokoll-Intents übersetzt.
 *
 * Regeln:
 * 1. Zuordnung nur beim Aufsetzen (`start`): Zone per Trefferprüfung, darin das
 *    Bedienelement. Berührungen im Randstreifen oder außerhalb jeder Zone werden
 *    ignoriert (auch ihre späteren Bewegungen).
 * 2. Der Joystick einer Zone folgt nur der **ersten** Berührung, die auf ihm
 *    aufsetzt; weitere Finger dort tun nichts. Ein Knopf folgt genau einem Finger.
 *    Weitere Finger in derselben Zone dürfen andere Knöpfe drücken.
 * 3. Berührungen in einer Zone, aber neben jedem Bedienelement, „gehören“ der Zone
 *    ohne Wirkung (sie werden nicht später zum Joystick befördert).
 * 4. `end`: Joystick → `{0, 0}`, Knopf → `release`, Bereit-Knopf → `ready`, sofern
 *    der Finger noch auf dem Knopf liegt. `cancel` (Systemgeste, Drehen): wie `end`,
 *    aber **ohne** `ready`.
 * 5. `reconcile(ids)`: Berührungen, die laut Browser nicht mehr liegen, werden
 *    abgebrochen (verlorenes `touchend`).
 * 6. `setZones` (Kontextwechsel, Drehen, Größenänderung): Berührungen behalten ihre
 *    Zuordnung, solange ihre Zone gleich liegt und ihr Bedienelement noch existiert;
 *    sonst werden sie losgelassen und bis zum Abheben stillgelegt.
 * 7. Wahlknöpfe der Brettphase (CHAOS-22) wirken wie der Bereit-Knopf: `choose` beim
 *    Abheben **auf** dem Knopf (Wegrutschen oder Abbrechen = keine Wahl). Reaktionsknöpfe
 *    (`instant`) wählen schon beim Aufsetzen. Gesperrte Knöpfe (`inert`) treffen nie; ein
 *    Finger auf einem Knopf, der gesperrt wird oder zu einem alten Prompt gehört, wird
 *    stillgelegt (Prompt-ID steckt in der Kennung des Knopfs).
 * 8. Figurenkarten der Lobby (v4, CHAOS-36, `pick:<figur>`) wählen wie Wahlknöpfe beim
 *    Abheben auf der Karte. Vergebene und die eigene Figur sind `inert`; wird eine Karte
 *    vergeben, während ein Finger darauf liegt, wird er stillgelegt.
 * 9. Daumen nach dem Minispiel (CHAOS-218, `vote:up`/`vote:down`) stimmen wie Wahlknöpfe
 *    beim Abheben auf dem Knopf ab. Beide bleiben aktiv, erneutes Tippen ändert die Stimme;
 *    endet die Ergebnisanzeige, während ein Finger darauf liegt, wird er stillgelegt.
 * 10. Reihe „Mitspieler“ der Lobby (CHAOS-238, `seat:<n>`/`seat-remove:<n>`, nur Spielleitung)
 *    wirkt beim Abheben auf dem Knopf. Was das Tippen bewirkt (KI setzen, nächste Stärke,
 *    entfernen), entscheidet der Aufrufer aus dem dann aktuellen Kontext.
 */
import {
  isCharacterId,
  type Button,
  type CharacterId,
  type SlotNumber,
  type Vote,
} from '@chaos-party/protocol';
import { knobOffset, stickFromOffset, ZERO_STICK, type Stick } from '../input/joystick.ts';
import {
  controlAt,
  deltaToLocal,
  parseChoiceControl,
  parsePickControl,
  parseSeatControl,
  parseVoteControl,
  rectContains,
  sameFrame,
  toLocal,
  zoneAt,
  type ControlKind,
  type Point,
  type ZoneFrame,
  type ZoneGeometry,
} from './geometry.ts';

export type ZoneEffect =
  | { readonly type: 'stick'; readonly slot: SlotNumber; readonly stick: Stick }
  | { readonly type: 'press'; readonly slot: SlotNumber; readonly button: Button }
  | { readonly type: 'release'; readonly slot: SlotNumber; readonly button: Button }
  | { readonly type: 'ready'; readonly slot: SlotNumber }
  | {
      readonly type: 'choose';
      readonly slot: SlotNumber;
      readonly promptId: number;
      readonly option: string;
    }
  | { readonly type: 'pick'; readonly slot: SlotNumber; readonly character: CharacterId }
  | { readonly type: 'vote'; readonly slot: SlotNumber; readonly vote: Vote }
  | {
      readonly type: 'seat';
      readonly slot: SlotNumber;
      /** Platz, den die Spielleitung verwaltet. */
      readonly seat: SlotNumber;
      /** `true` = „✕“ (KI entfernen), sonst Platz angetippt. */
      readonly remove: boolean;
    };

/** Wem eine Berührung gehört. `control: null` = Zone ohne Wirkung (oder stillgelegt). */
export interface TouchOwner {
  readonly slot: SlotNumber;
  readonly control: ControlKind | null;
}

/** Anzeigezustand einer Zone (für die Darstellung, lokale Koordinaten). */
export interface ZoneView {
  /** Joystick gehalten: Ursprung (lokal) und Knopfversatz (lokal, auf den Radius begrenzt). */
  readonly stick: { readonly origin: Point; readonly knob: { dx: number; dy: number } } | null;
  readonly pressed: readonly Button[];
  /** Ein Finger liegt auf dem Bereit-Knopf. */
  readonly readyHeld: boolean;
  /** Wahlknöpfe (Kennung `choice:…`), auf denen gerade ein Finger liegt. */
  readonly choicesHeld: readonly ControlKind[];
  /** Figurenkarten (Kennung `pick:…`), auf denen gerade ein Finger liegt. */
  readonly picksHeld: readonly ControlKind[];
  /** Daumen-Knöpfe (Kennung `vote:…`), auf denen gerade ein Finger liegt. */
  readonly votesHeld: readonly ControlKind[];
  /** Knöpfe der Reihe „Mitspieler“ (Kennung `seat:…`/`seat-remove:…`) unter einem Finger. */
  readonly seatsHeld: readonly ControlKind[];
}

interface Binding {
  readonly slot: SlotNumber;
  readonly control: ControlKind | null;
  /** Bildschirmpunkt beim Aufsetzen (Ursprung des Joysticks). */
  readonly origin: Point;
  /** Letzter bekannter Bildschirmpunkt. */
  last: Point;
  /** Lage der Zone beim Aufsetzen. */
  readonly frame: ZoneFrame;
  /** Wahlknopf, der schon beim Aufsetzen gewählt hat (Abheben wählt nicht erneut). */
  readonly instant: boolean;
}

export interface ZoneTracker {
  /** Neue Zonen (Layout, Kontext oder Bildschirmgröße geändert). */
  setZones(zones: readonly ZoneGeometry[]): ZoneEffect[];
  start(id: number, point: Point): ZoneEffect[];
  move(id: number, point: Point): ZoneEffect[];
  end(id: number, point?: Point): ZoneEffect[];
  cancel(id: number): ZoneEffect[];
  /** Alles loslassen (Fokusverlust, App-Wechsel). */
  cancelAll(): ZoneEffect[];
  /** Berührungen abbrechen, die nicht mehr in `activeIds` stehen. */
  reconcile(activeIds: Iterable<number>): ZoneEffect[];
  owner(id: number): TouchOwner | null;
  /** Anzahl verfolgter Berührungen (inklusive wirkungsloser). */
  readonly size: number;
  view(slot: SlotNumber): ZoneView;
}

function buttonOf(control: ControlKind | null): Button | null {
  if (control === 'button-a') return 'a';
  if (control === 'button-b') return 'b';
  return null;
}

export function createZoneTracker(initialZones: readonly ZoneGeometry[] = []): ZoneTracker {
  let zones: readonly ZoneGeometry[] = initialZones;
  const bindings = new Map<number, Binding>();

  function zoneOf(slot: SlotNumber): ZoneGeometry | undefined {
    return zones.find((z) => z.slot === slot);
  }

  function heldBy(slot: SlotNumber, control: ControlKind): boolean {
    for (const b of bindings.values()) {
      if (b.slot === slot && b.control === control) return true;
    }
    return false;
  }

  /** Liegt der Finger (letzter Punkt) noch auf seinem Bedienelement? */
  function stillOn(binding: Binding): boolean {
    const zone = zoneOf(binding.slot);
    const own = zone?.controls.find((c) => c.kind === binding.control && c.inert !== true);
    return (
      zone !== undefined && own !== undefined && rectContains(own.hit, toLocal(zone, binding.last))
    );
  }

  /** Effekte beim Loslassen; `ready`/`choose` nur bei echtem Abheben auf dem Knopf. */
  function releaseEffects(binding: Binding, completed: boolean): ZoneEffect[] {
    const { slot, control } = binding;
    const button = buttonOf(control);
    if (button !== null) return [{ type: 'release', slot, button }];
    if (control === 'stick') return [{ type: 'stick', slot, stick: ZERO_STICK }];
    if (control === 'ready' && completed && stillOn(binding)) return [{ type: 'ready', slot }];
    const choice = parseChoiceControl(control);
    if (choice !== null && completed && !binding.instant && stillOn(binding)) {
      return [{ type: 'choose', slot, ...choice }];
    }
    const character = parsePickControl(control);
    if (character !== null && isCharacterId(character) && completed && stillOn(binding)) {
      return [{ type: 'pick', slot, character }];
    }
    const vote = parseVoteControl(control);
    if (vote !== null && completed && stillOn(binding)) return [{ type: 'vote', slot, vote }];
    const seat = parseSeatControl(control);
    if (seat !== null && completed && stillOn(binding)) return [{ type: 'seat', slot, ...seat }];
    return [];
  }

  function stickFor(binding: Binding, point: Point): Stick {
    const zone = zoneOf(binding.slot);
    if (!zone) return ZERO_STICK;
    const d = deltaToLocal(zone.rotation, point.x - binding.origin.x, point.y - binding.origin.y);
    return stickFromOffset(d.x, d.y, zone.stickRadius);
  }

  function finish(id: number, completed: boolean): ZoneEffect[] {
    const binding = bindings.get(id);
    if (!binding) return [];
    bindings.delete(id);
    return releaseEffects(binding, completed);
  }

  return {
    setZones(next) {
      zones = next;
      const effects: ZoneEffect[] = [];
      for (const [id, binding] of bindings) {
        if (binding.control === null) continue;
        const zone = zoneOf(binding.slot);
        const keep =
          zone !== undefined &&
          // Zone verschoben/gedreht: alte Punkte passen nicht mehr zur neuen Lage.
          sameFrame(binding.frame, zone) &&
          zone.controls.some((c) => c.kind === binding.control && c.inert !== true);
        if (!keep) {
          effects.push(...releaseEffects(binding, false));
          // Stilllegen bis zum Abheben: der Finger bekommt kein neues Bedienelement.
          bindings.set(id, { ...binding, control: null });
        }
      }
      return effects;
    },

    start(id, point) {
      // Kennung noch belegt (verlorenes Ende): alte Berührung zuerst abbrechen.
      const effects = finish(id, false);
      const zone = zoneAt(zones, point);
      if (!zone) return effects;
      const hit = controlAt(zone, toLocal(zone, point));
      let control: ControlKind | null = hit?.kind ?? null;
      if (control !== null && heldBy(zone.slot, control)) control = null;
      const instant = control !== null && hit?.instant === true;
      const binding: Binding = {
        slot: zone.slot,
        control,
        origin: point,
        last: point,
        frame: zone,
        instant,
      };
      bindings.set(id, binding);
      const button = buttonOf(control);
      if (button !== null) effects.push({ type: 'press', slot: zone.slot, button });
      const choice = instant ? parseChoiceControl(control) : null;
      if (choice !== null) effects.push({ type: 'choose', slot: zone.slot, ...choice });
      return effects;
    },

    move(id, point) {
      const binding = bindings.get(id);
      if (!binding) return [];
      binding.last = point;
      if (binding.control !== 'stick') return [];
      return [{ type: 'stick', slot: binding.slot, stick: stickFor(binding, point) }];
    },

    end(id, point) {
      const binding = bindings.get(id);
      if (binding && point) binding.last = point;
      return finish(id, true);
    },

    cancel(id) {
      return finish(id, false);
    },

    cancelAll() {
      const effects: ZoneEffect[] = [];
      for (const id of [...bindings.keys()]) effects.push(...finish(id, false));
      return effects;
    },

    reconcile(activeIds) {
      const alive = new Set(activeIds);
      const effects: ZoneEffect[] = [];
      for (const id of [...bindings.keys()]) {
        if (!alive.has(id)) effects.push(...finish(id, false));
      }
      return effects;
    },

    owner(id) {
      const binding = bindings.get(id);
      return binding ? { slot: binding.slot, control: binding.control } : null;
    },

    get size() {
      return bindings.size;
    },

    view(slot) {
      const zone = zoneOf(slot);
      let stick: ZoneView['stick'] = null;
      const pressed: Button[] = [];
      let readyHeld = false;
      const choicesHeld: ControlKind[] = [];
      const picksHeld: ControlKind[] = [];
      const votesHeld: ControlKind[] = [];
      const seatsHeld: ControlKind[] = [];
      for (const b of bindings.values()) {
        if (b.slot !== slot) continue;
        const button = buttonOf(b.control);
        if (button !== null) pressed.push(button);
        if (b.control === 'ready') readyHeld = true;
        if (parseChoiceControl(b.control) !== null && b.control !== null)
          choicesHeld.push(b.control);
        if (parsePickControl(b.control) !== null && b.control !== null) picksHeld.push(b.control);
        if (parseVoteControl(b.control) !== null && b.control !== null) votesHeld.push(b.control);
        if (parseSeatControl(b.control) !== null && b.control !== null) seatsHeld.push(b.control);
        if (b.control === 'stick' && zone) {
          const d = deltaToLocal(zone.rotation, b.last.x - b.origin.x, b.last.y - b.origin.y);
          stick = {
            origin: toLocal(zone, b.origin),
            knob: knobOffset(d.x, d.y, zone.stickRadius),
          };
        }
      }
      pressed.sort();
      return { stick, pressed, readyHeld, choicesHeld, picksHeld, votesHeld, seatsHeld };
    },
  };
}
