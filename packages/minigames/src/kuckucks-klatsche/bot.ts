/**
 * KI-Bot für Kuckucks-Klatsche (CHAOS-180), aus EXP-016 übernommen.
 *
 * Der Bot sieht nur, was ein Mensch am Fernseher sieht: welche Tür rappelt, was herausspringt,
 * wann der Gong kommt, ob ein Kuckuck schon weg ist. In der echten Partie liest er das aus den
 * Türen (`KuckuckDoorWatcher`, Phasenwechsel), in der Bot-Partie aus den Ereignissen der Logik.
 * Was hinter einer rappelnden Tür steckt (`occupant`), liest er nicht.
 *
 * Strategien (nur Bot-Partien; KI-Plätze spielen `normal`):
 * - `normal`: reagiert auf die eigene Tür, klaut mit Wahrscheinlichkeit `judgement`.
 * - `brav`: klaut nie.
 * - `raffzahn`: klaut jeden freigegebenen Kuckuck.
 * - `dauer`: drückt stur alle `spamS` Sekunden, egal was passiert („Dauerklatscher“).
 */
import { profileForStrength, reactionSample, type BotProfile } from '@chaos-party/minigame-kit';
import {
  tap,
  type MinigameBotDriver,
  type MinigameBotOptions,
  type MinigameInput,
  type MinigameRng,
  type Slot,
} from '@chaos-party/minigame-sdk';
import type { DoorPhase, KuckuckEvent, KuckucksKlatscheLogic } from './logic.ts';

export type KuckuckStrategy = 'normal' | 'brav' | 'raffzahn' | 'dauer';

/** Anteil der Profi-Ungeduld (`falseStart`), mit der jemand eine rappelnde Tür vorab klatscht. */
const EAGER_OWN = 0.12;
/** Dasselbe bei einer fremden Tür, deren Kuckuck noch nicht freigegeben ist. */
const EAGER_FOREIGN = 0.04;
/** Wer den eigenen Kuckuck verpennt, merkt es am Gong mit dieser Wahrscheinlichkeit. */
const LATE_NOTICE = 0.5;
/** Abstand des Dauerklatschers (s). */
export const KUCKUCK_SPAM_S = 0.22;

interface Plan {
  readonly at: number;
  /** Tür, für die der Druck gedacht ist (null = Ungeduld, Dauerklatscher). */
  readonly door: Slot | null;
  readonly kind: 'own' | 'steal' | 'eager' | 'spam' | 'finte';
}

/** Lesender Blick auf die Logik (das, was am Bildschirm zu sehen ist). */
export type KuckuckView = Pick<KuckucksKlatscheLogic, 't' | 'isDizzy' | 'clapper' | 'door'>;

export class KuckuckBot {
  private plans: Plan[] = [];
  private nextSpam: number;

  constructor(
    readonly slot: Slot,
    private readonly profile: BotProfile,
    private readonly strategy: KuckuckStrategy,
    private readonly rng: MinigameRng,
    private readonly spamS = KUCKUCK_SPAM_S,
  ) {
    this.nextSpam = rng.next() * spamS;
  }

  private reaction(): number {
    return reactionSample(this.rng, this.profile.reactionMs) / 1000;
  }

  private stealWill(): number {
    if (this.strategy === 'brav') return 0;
    if (this.strategy === 'raffzahn') return 1;
    return this.profile.judgement;
  }

  /** Sichtbare Ereignisse (Rappeln, Öffnen, Gong) melden; andere Ereignisse zählen nicht. */
  observe(now: number, events: readonly KuckuckEvent[]): void {
    if (this.strategy === 'dauer') return;
    for (const event of events) {
      if (event.type === 'rattle') {
        const eager = event.door === this.slot ? EAGER_OWN : EAGER_FOREIGN;
        if (this.rng.next() < this.profile.falseStart * eager) {
          this.plans.push({ at: now + this.reaction() * 0.6, door: event.door, kind: 'eager' });
        }
      } else if (event.type === 'open' && event.door === this.slot) {
        if (event.occupant === 'finte') {
          if (this.rng.next() < this.profile.falseStart) {
            this.plans.push({ at: now + this.reaction() * 0.9, door: this.slot, kind: 'finte' });
          }
        } else if (this.rng.next() >= this.profile.lapse) {
          this.plans.push({ at: now + this.reaction(), door: this.slot, kind: 'own' });
        }
      } else if (event.type === 'gong') {
        const own = event.door === this.slot;
        const will = own ? LATE_NOTICE : this.stealWill();
        if (this.rng.next() < will) {
          this.plans.push({
            at: now + this.reaction(),
            door: event.door,
            kind: own ? 'own' : 'steal',
          });
        }
      }
    }
  }

  /** Fällige Pläne ausführen; `press` klatscht einmal. Liefert die Zahl der Klatscher. */
  act(view: KuckuckView, press: () => void): number {
    const now = view.t;
    let presses = 0;
    if (this.strategy === 'dauer') {
      while (now >= this.nextSpam) {
        press();
        presses++;
        this.nextSpam += this.spamS;
      }
      return presses;
    }
    const due = this.plans.filter((plan) => plan.at <= now);
    if (due.length === 0) return 0;
    this.plans = this.plans.filter((plan) => plan.at > now);
    for (const plan of due) {
      if (view.isDizzy(this.slot)) {
        // Benommen: der Mensch drückt meist gleich noch mal, sobald es geht.
        const clapper = view.clapper(this.slot);
        if (clapper && plan.kind !== 'eager' && this.rng.next() < 0.7) {
          this.plans.push({ ...plan, at: clapper.dizzyUntil + 0.08 });
        }
        continue;
      }
      if (plan.door !== null && plan.kind !== 'eager') {
        // Ist das Ziel schon weg, bremst man oft noch rechtzeitig.
        const door = view.door(plan.door);
        const stillThere =
          door !== undefined &&
          (plan.kind === 'finte'
            ? door.phase === 'finte'
            : door.phase === 'own' || door.phase === 'free');
        if (!stillThere && this.rng.next() < this.profile.judgement) continue;
      }
      press();
      presses++;
    }
    return presses;
  }
}

/**
 * Sichtbare Ereignisse aus den Türen ableiten (Phasenwechsel seit dem letzten Blick): Tür
 * rappelt, springt auf (Kuckuck oder Finte), Gong. Gleiche Form wie die Logik-Ereignisse.
 */
export class KuckuckDoorWatcher {
  private readonly last = new Map<Slot, DoorPhase>();

  look(logic: Pick<KuckucksKlatscheLogic, 'doors'>): KuckuckEvent[] {
    const events: KuckuckEvent[] = [];
    for (const door of logic.doors) {
      const before = this.last.get(door.slot) ?? 'closed';
      this.last.set(door.slot, door.phase);
      if (door.phase === before) continue;
      if (door.phase === 'rattle') events.push({ type: 'rattle', door: door.slot });
      else if (door.phase === 'own' || door.phase === 'finte') {
        events.push({
          type: 'open',
          door: door.slot,
          occupant: door.phase === 'own' ? 'kuckuck' : 'finte',
          finteKind: door.finteKind,
        });
      } else if (door.phase === 'free' && before === 'own') {
        events.push({ type: 'gong', door: door.slot });
      }
    }
    return events;
  }
}

/** Laufzeit-Bot für einen KI-Platz (`Minigame.createBot`): spielt `normal`. */
export function createKuckuckBot(
  options: MinigameBotOptions,
  observe: () => KuckucksKlatscheLogic | null,
): MinigameBotDriver {
  const bot = new KuckuckBot(
    options.slot,
    profileForStrength(options.strength, options.style),
    'normal',
    options.rng,
  );
  const watcher = new KuckuckDoorWatcher();
  return {
    slot: options.slot,
    tick: () => {
      const logic = observe();
      if (!logic || logic.ended) return [];
      bot.observe(logic.t, watcher.look(logic));
      const inputs: MinigameInput[] = [];
      bot.act(logic, () => inputs.push(...tap('a')));
      return inputs;
    },
  };
}
