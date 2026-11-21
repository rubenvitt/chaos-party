/**
 * Öffentlicher Vertrag von `@chaos-party/game-core` für M2 (CHAOS-2, ADR-011).
 *
 * Die Spielregeln sind ein reiner Reducer: `step(state, command)` liefert einen neuen,
 * JSON-serialisierbaren Zustand und die dabei entstandenen Ereignisse. Zeit kommt nur
 * über Befehle herein (`at`, Server-Uhr in ms), Zufall nur über den im Zustand
 * gespeicherten RNG-Zustand. Gleicher Seed + gleiche Befehlsfolge → gleicher Ablauf.
 *
 * Diese Datei ist der gemeinsame Vertrag zwischen game-core, Server und Host.
 * Änderungen nur additiv und abgestimmt (Koordinator).
 */

import type { MinigameOutcome, MinigameTeamPlay, MinigameTeams } from '@chaos-party/minigame-sdk';

export type { MinigameOutcome, MinigameTeamPlay, MinigameTeams };

/** Spielerplatz 1–4 (gleich `SlotNumber` aus `@chaos-party/protocol`). */
export type Slot = 1 | 2 | 3 | 4;

// ---------------------------------------------------------------------------
// Brett (Topologie als Daten, getrennt vom Rendering; CHAOS-18)
// ---------------------------------------------------------------------------

/**
 * Feldtypen.
 * - `start`: Startfeld, neutral.
 * - `coins-plus` / `coins-minus`: Münzen gewinnen/verlieren (Höhe: `RuleSet.economy`).
 * - `event`: zufälliges Brett-Ereignis (seeded).
 * - `item`: zufälliges Item (Gewichte: `RuleSet.items.weights`).
 * - `trophy`: möglicher Standort der Trophäe (siehe `RuleSet.trophy.mode`).
 */
export type SpaceKind = 'start' | 'coins-plus' | 'coins-minus' | 'event' | 'item' | 'trophy';

export interface BoardSpace {
  /** Eindeutige, stabile ID (z. B. `s07`). */
  readonly id: string;
  readonly kind: SpaceKind;
  /** Lage auf dem Brett in Welt-Einheiten (x nach rechts, z nach hinten); Höhe macht der Host. */
  readonly position: { readonly x: number; readonly z: number };
  /** Nachfolger in Laufrichtung. Genau einer = gerader Weg, zwei oder mehr = Verzweigung. */
  readonly next: readonly string[];
  /** Optionaler Name für Wegweiser an Verzweigungen (z. B. „Pilzpfad“). */
  readonly label?: string;
}

/**
 * Drehendes Feld (CHAOS-199, ADR-022), z. B. das Karussell des Rummelplatzes: Sein Ausgang
 * wechselt jede Runde reihum, ohne Zufall. In Runde `r` gilt `exits[(r - 1) % exits.length]`;
 * wer das Feld betritt oder verlässt, nimmt genau diesen Ausgang (keine Wegwahl). `next` des
 * Felds nennt alle Ausgänge (statische Topologie für Prüfung, Wege und Deko).
 */
export interface BoardRotation {
  /** Feld, dessen Ausgang sich dreht. */
  readonly space: string;
  /** Ausgänge in Drehreihenfolge, als Menge gleich `next` des Felds, mindestens zwei. */
  readonly exits: readonly string[];
}

/**
 * Seilbahn (CHAOS-198, ADR-023): eine Kante `from` → `to` an einer Gabel, die Geld kostet. Wer
 * sie wählt, zahlt `price` Münzen (Grund `event`) und fährt in einem Schritt hinüber. Wer zu wenig
 * Münzen hat, bekommt sie nicht angeboten. `to` steht in `next` von `from`, aber nie an erster
 * Stelle: Die erste Option bleibt der kostenlose Weg (Standard bei Zeitablauf/Trennung).
 */
export interface BoardCableCar {
  readonly from: string;
  readonly to: string;
  readonly price: number;
}

/** Ein Wegabschnitt, den eine Lawine abräumt (CHAOS-198). */
export interface BoardAvalancheZone {
  /** Name für Ansagen („Lawine am Gletscherpfad!“), höchstens 32 Zeichen. */
  readonly name: string;
  readonly spaces: readonly string[];
}

/**
 * Lawinen (CHAOS-198, ADR-023): Zu Beginn jeder Runde `r` mit `r > 1` und
 * `(r - 1) % every === 0` geht eine Lawine ab, reihum über `zones` (die erste Lawine trifft
 * `zones[0]`). Wer dann auf einem Feld der Zone steht, verliert `coins` Münzen (Grund `space`).
 * Ohne Zufall: Hosts sagen sie aus Brett und Runde eine Runde vorher an.
 */
export interface BoardAvalanche {
  readonly every: number;
  readonly coins: number;
  readonly zones: readonly BoardAvalancheZone[];
}

export interface BoardDefinition {
  readonly id: string;
  readonly name: string;
  readonly spaces: readonly BoardSpace[];
  /** Startfeld aller Spieler. */
  readonly start: string;
  /** Drehende Felder (CHAOS-199); fehlt = keine, alle Kanten sind fest. */
  readonly rotations?: readonly BoardRotation[];
  /**
   * Eisfelder (CHAOS-198, ADR-023): Wer nach dem Würfeln auf einem landet, rutscht ein Feld
   * weiter (auf Eis wieder eins, bis festes Feld); erst dort gilt die Feldwirkung. Eisfelder
   * haben genau einen Nachfolger. Fehlt = keine.
   */
  readonly ice?: readonly string[];
  /** Seilbahnen (CHAOS-198); fehlt = keine. */
  readonly cableCars?: readonly BoardCableCar[];
  /** Lawinen (CHAOS-198); fehlt = keine. */
  readonly avalanche?: BoardAvalanche;
}

// ---------------------------------------------------------------------------
// Regeln und Konfiguration (alle Zahlen sind Experiment-Stellschrauben, CHAOS-24)
// ---------------------------------------------------------------------------

export type ItemKind = 'double-dice' | 'coin-steal' | 'trap' | 'shield';

export interface Pacing {
  /** Pause nach Zugbeginn (Ansage am PC), bevor der Würfel angeboten wird. */
  readonly turnStartMs: number;
  /** Würfelanimation nach dem Wurf. */
  readonly rollMs: number;
  /** Dauer je gelaufenem Feld (Host animiert mit genau diesem Takt). */
  readonly stepMs: number;
  /** Anzeige eines Feldereignisses / Item-Effekts. */
  readonly spaceEventMs: number;
  /** Zugende bis zum nächsten Spieler. */
  readonly turnEndMs: number;
  /** Anleitung vor einem Minispiel, das in dieser Partie zum ersten Mal läuft. */
  readonly minigameIntroMs: number;
  /**
   * Anleitung vor einem Minispiel, das in dieser Partie schon lief (CHAOS-66): kurz, nur Titel
   * und Bedienlegende. Fehlt = `minigameIntroMs` (jedes Mal die volle Anleitung).
   */
  readonly minigameRepeatIntroMs?: number;
  /**
   * CHAOS-214: Die Anleitung wartet, bis alle verbundenen Spieler „Bereit“ gedrückt haben
   * (`minigame-ready`); spätestens nach dieser Sicherheitsfrist startet das Minispiel trotzdem
   * (Controller ohne Knopf, Handy weggelegt). Fehlt oder 0 = feste Anleitungszeit
   * (`minigameIntroMs`/`minigameRepeatIntroMs`) ohne Warten, wie vor CHAOS-214.
   */
  readonly minigameReadyTimeoutMs?: number;
  /**
   * CHAOS-214: Mindestdauer der wartenden Anleitung. Sind alle früher bereit, startet das
   * Minispiel erst danach: Zeit zum Ansehen, kein versehentliches Durchtippen, und der Host baut
   * die Bühne in Ruhe auf (ADR-012 Nachtrag 3). Fehlt = 0.
   */
  readonly minigameReadyMinMs?: number;
  readonly minigamePlayMs: number;
  readonly minigameResultsMs: number;
  /**
   * Echte Minispiele (M3): So lange wartet `minigame-play` über die Spielzeit hinaus auf das
   * Ergebnis vom Host, dann gilt das Minispiel als abgebrochen (keine Münzen). Fehlt = 15 s.
   */
  readonly minigameResultGraceMs?: number;
  readonly roundEndMs: number;
  /**
   * Rückenwind-Ansage (CHAOS-125): So viel länger dauert `round-end`, wenn Rückenwind-Münzen
   * ausgezahlt wurden (PC und Controller zeigen sie an). Fehlt = 0.
   */
  readonly tailwindMs?: number;
  /** Dauer des Reaktionsfensters (CHAOS-21). */
  readonly reactionWindowMs: number;
  /** So lange wartet eine Entscheidung auf einen getrennten Spieler, dann Standardoption. */
  readonly disconnectGraceMs: number;
}

/** Ziel einer wandernden Trophäe (`RuleSet.trophy.placement`). */
export type TrophyPlacement =
  'random' | 'ahead' | 'ahead-of-last' | 'nearest-to-last' | 'away-from-leader';

/**
 * Aufholhilfen für Zurückliegende mit Münzen (CHAOS-65, EXP-022). Jede fehlt = aus. „Spitze“ =
 * höchste Trophäenzahl am Tisch; „Rückstand“ = Spitze minus eigene Trophäen. Das Ziel der
 * wandernden Trophäe als Aufholhilfe steuert `trophy.placement`.
 */
export interface CatchUpRules {
  /** Trophäenpreis `price` für alle mit mindestens `behind` Trophäen Rückstand. */
  readonly discount?: { readonly behind: number; readonly price: number };
  /**
   * Rückenwind: Nach jedem Minispiel außer dem letzten bekommt jede Person
   * `perTrophy` × Rückstand Münzen, höchstens `max` (Grund `tailwind`, CHAOS-125). Am PC und
   * am Controller angesagt (`MinigameState.tailwind`, `pacing.tailwindMs`).
   */
  readonly tailwind?: { readonly perTrophy: number; readonly max: number };
  /** Finale-Fieber: In den letzten `rounds` Runden zählen Minispiel-Münzen `factor`-fach. */
  readonly finale?: { readonly rounds: number; readonly factor: number };
}

/**
 * Münz-Regel für Spielformen mit Teams und Koop (CHAOS-89, festgelegt in EXP-038).
 * Teams: jede Person im Siegerteam `win`, im anderen Team `lose`, bei Unentschieden alle `draw`;
 * gewinnt eine Einzelperson (1 gegen 3 bzw. 1 gegen 2), bekommt sie `win × soloWinFactor`.
 * Koop: Münzen je Platz der Einzelwertung (`koop`, Index 0 = Platz 1) bei voller Stufe,
 * anteilig zur erreichten Stufe (`Stufe / KOOP_MAX_TIER`, gerundet).
 */
export interface TeamRewards {
  readonly win: number;
  readonly lose: number;
  readonly draw: number;
  readonly soloWinFactor: number;
  readonly koop: readonly number[];
}

export interface RuleSet {
  /** Würfelseiten; jede gleich wahrscheinlich (Verteilung per Experiment). */
  readonly diceFaces: readonly number[];
  readonly economy: {
    readonly startCoins: number;
    readonly coinsPlus: number;
    /** Verlust auf `coins-minus`; Münzen fallen nie unter 0. */
    readonly coinsMinus: number;
    /** Münzen je Minispiel-Platz (Index 0 = Platz 1); Gleichstand = gleiche Belohnung. */
    readonly minigameRewards: readonly number[];
    /** Münzen bei Teams und Koop (CHAOS-89, EXP-038); fehlt = `DEFAULT_TEAM_REWARDS`. */
    readonly teamRewards?: TeamRewards;
  };
  readonly trophy: {
    readonly price: number;
    /**
     * `wandering`: `activeCount` `trophy`-Felder sind aktiv; nach dem Kauf wandert die
     * Trophäe (seeded) zu einem anderen, freien `trophy`-Feld. `fixed`: alle sind aktiv.
     */
    readonly mode: 'wandering' | 'fixed';
    /**
     * Nur bei `wandering`: so viele `trophy`-Felder sind gleichzeitig aktiv (höchstens alle).
     * Nach einem Kauf wandert genau die gekaufte Trophäe zu einem gerade freien Feld.
     */
    readonly activeCount: number;
    /**
     * Nur bei `wandering`: wohin eine Trophäe wandert (CHAOS-51, EXP-019). `random` (fehlt =
     * `random`): gleichverteilt auf ein freies Feld. `ahead`: bevorzugt vor die Spieler, also
     * auf die nähere Hälfte der freien Felder, gemessen am kürzesten Weg vorwärts von irgendeiner
     * Figur. `ahead-of-last`: wie `ahead`, gemessen nur von den Letztplatzierten.
     * `nearest-to-last` (CHAOS-65, EXP-022): genau das freie Feld, das vor einer bzw. einem
     * Letzten am nächsten liegt. `away-from-leader` (EXP-022): das freie Feld, das von der
     * Spitze (Platz 1) am weitesten entfernt liegt. Gleich weit: Seed entscheidet.
     */
    readonly placement?: TrophyPlacement;
  };
  readonly items: {
    /** Höchstzahl gleichzeitig gehaltener Items. */
    readonly capacity: number;
    /** So viele zufällige Items (Gewichte wie auf `item`-Feldern) bekommt jeder beim Start. */
    readonly startItems: number;
    /** Ziehgewichte auf `item`-Feldern. */
    readonly weights: Readonly<Record<ItemKind, number>>;
    /** Münzklau: so viele Münzen (höchstens Bestand des Ziels). */
    readonly stealAmount: number;
    /** Falle: so viele Münzen gehen an die Besitzerin. */
    readonly trapAmount: number;
    /**
     * Wachsende Sabotage (CHAOS-67, EXP-018): Klau und Falle nehmen alle so viele Runden eine
     * Münze mehr (Runde 1 … n: Grundwert, n+1 … 2n: +1 usw.). Es zählt die Runde, in der der
     * Klau bzw. die Falle auslöst. `0` = feste Werte.
     */
    readonly sabotageGrowthRounds: number;
    /**
     * Wann eine fremde Falle auslöst: `land` nur beim Landen auf dem Feld, `pass` auch beim
     * Darüberlaufen (die Bewegung hält kurz an, dann geht sie weiter).
     */
    readonly trapTrigger: 'land' | 'pass';
    /**
     * So viele zufällige Items bekommt, wer ein Minispiel gewinnt (geteilter 1. Platz: alle);
     * Kapazität wie auf `item`-Feldern. Fehlt = 0 (CHAOS-51, EXP-019).
     */
    readonly minigameWinItems?: number;
    /**
     * So viele zufällige Items bekommt, wer im Minispiel Letzte(r) wird (geteilter letzter
     * Platz: alle; nicht, wenn alle gleichauf sind). Trostpreis und Aufholhilfe. Fehlt = 0
     * (CHAOS-51, EXP-019).
     */
    readonly minigameLastItems?: number;
    /**
     * Schild wehrt auch eine fremde Falle ab: Wer einen Schild hält, verliert ihn statt der
     * Münzen; die Falle ist danach weg. Automatisch, ohne Reaktionsfenster. Fehlt = `false`
     * (CHAOS-51, EXP-019).
     */
    readonly shieldBlocksTrap?: boolean;
  };
  readonly pacing: Pacing;
  /** Aufholhilfen mit Münzen (CHAOS-65); fehlt = keine. */
  readonly catchUp?: CatchUpRules;
}

export interface GamePlayerConfig {
  readonly slot: Slot;
  readonly name: string;
}

/**
 * Ein Minispiel aus Sicht der Regeln (M3, ADR-012): nur Kennung, Spielzeit und Wertungsart.
 * Die Steckbriefe liegen in `@chaos-party/minigames/catalog`, die Logik im Host.
 */
export interface MinigameSpec {
  readonly id: string;
  /** Reine Spielzeit in ms (der Host meldet das Ergebnis spätestens kurz danach). */
  readonly playMs: number;
  readonly scoring: 'higher' | 'lower';

  // --- Achsen und Tauglichkeit für die Rotation (CHAOS-85), alle optional ---
  // Ohne Angaben zieht die Rotation genau wie vor CHAOS-85 (gemischte Liste per Seed).

  /** Kategorie (`arcade`, `physics`, `hybrid`); weiche Mischachse. */
  readonly category?: string;
  /** Bedienungs-Kürzel (`A`, `AB`, `S`, `SA`, `SAB` …); weiche Mischachse. */
  readonly controls?: string;
  /** Mechanik-Familie; nie zweimal hintereinander. */
  readonly family?: string;
  /** Kernverb; nie zweimal hintereinander. */
  readonly verb?: string;
  /** Spielform (`ffa`, `1v3`, `2v2`, `koop`); weiche Mischachse. */
  readonly form?: string;
  /** Spielerzahl, für die das Spiel taugt (fehlt = 1 bzw. 4). */
  readonly minPlayers?: number;
  readonly maxPlayers?: number;
  /** `false` = nur iPhone: fällt weg, wenn jemand an einer iPad-Zone spielt. */
  readonly ipadZone?: boolean;
  /** Geheime Wahl: bei iPad-Zonen deutlich seltener (Gewicht). */
  readonly secretChoice?: boolean;
  /**
   * Spielform mit Teams oder Koop (CHAOS-89). Dann teilt game-core beim Start die Teams ein
   * (`MinigameState.teams`) und zahlt nach `economy.teamRewards`. `minPlayers` sollte zur
   * Spielform passen (`teamPlayMinPlayers`), sonst zieht die Rotation das Spiel zu ungeeigneter
   * Spielerzahl; dann läuft es ohne Teams (jeder gegen jeden).
   */
  readonly teamPlay?: MinigameTeamPlay;
}

/**
 * Einstellungen der Minispiel-Rotation einer Partie (CHAOS-85). Alles optional; ohne sie
 * zieht game-core wie bisher.
 */
export interface MinigameRotationOptions {
  /** Spielt jemand an einer Zone eines geteilten iPads? */
  readonly ipadZones?: boolean;
  /** Minispiele der letzten Partie: kommen erst, wenn alle anderen dran waren. */
  readonly recent?: readonly string[];
  /** Am Host gesperrt: werden nicht gezogen (außer es bliebe sonst keines übrig). */
  readonly blocked?: readonly string[];
  /** Am Host als Favorit markiert: werden öfter (früher) gezogen. */
  readonly favorites?: readonly string[];
}

export interface GameConfig {
  readonly board: BoardDefinition;
  readonly rules: RuleSet;
  /** Anzahl Runden (eine Runde = jeder Spieler ein Zug + Minispiel). */
  readonly rounds: number;
  readonly seed: number;
  /** 1–4 Spieler (M2-Ziel 2–4; 1 nur für Tests/Demo). */
  readonly players: readonly GamePlayerConfig[];
  /**
   * Minispiele der Partie (M3). Je Runde zieht game-core per Seed eines (ohne Wiederholung,
   * bis alle dran waren). Leer oder fehlend = Platzhalter aus M2 (Rangfolge per Seed).
   */
  readonly minigames?: readonly MinigameSpec[];
  /**
   * Übungsmodus der Minispiel-Galerie (CHAOS-87): Die Partie besteht nur aus dem einen
   * Minispiel in `minigames` – kein Brettzug, keine Münzen, keine Siege, keine Items. Nach dem
   * Ergebnis endet sie (`game-results`). Verlangt genau ein Minispiel und `rounds: 1`.
   */
  readonly practice?: boolean;
  /** Filter, Gewichte und Gedächtnis der Minispiel-Auswahl (CHAOS-85). */
  readonly minigameRotation?: MinigameRotationOptions;
}

/** Platz im Minispiel (gleich `MinigamePlacement` aus dem minigame-sdk). */
export interface MinigamePlacement {
  readonly slot: Slot;
  readonly place: number;
  readonly score: number;
}

/** Laufendes bzw. letztes Minispiel der Runde (öffentlich, geht an den Host). */
export interface MinigameState {
  /** `placeholder` = M2-Platzhalter ohne Host-Logik. */
  readonly id: string;
  readonly round: number;
  /** Seed für die Minispiel-Logik im Host (uint32). */
  readonly seed: number;
  readonly playMs: number;
  /**
   * Lief dieses Minispiel in der Partie schon einmal (CHAOS-66)? Dann ist die Anleitung kurz
   * (`minigameRepeatIntroMs`) und Host und Controller zeigen nur Titel und Bedienlegende.
   */
  readonly repeat: boolean;
  /**
   * CHAOS-214: Slots, die in der Anleitung „Bereit“ gedrückt haben (aufsteigend). Fehlt = die
   * Anleitung wartet nicht auf Bereitschaft (feste Anleitungszeit).
   */
  readonly ready?: readonly Slot[];
  /** Beginn von `minigame-play` (Server-Uhr) oder `null` davor. */
  readonly playStartedAt: number | null;
  /** Ergebnis nach `minigame-play`; `null` solange offen. */
  readonly placements: readonly MinigamePlacement[] | null;
  readonly highlights: readonly string[];
  /** Kein (gültiges) Ergebnis in der Frist → keine Münzen. */
  readonly aborted: boolean;
  /**
   * Tatsächlich ausgezahlte Münzen je Slot (M4, CHAOS-55), sobald das Ergebnis feststeht;
   * `null` davor, leer bei Abbruch. Reihenfolge wie `placements`.
   */
  readonly rewards: readonly MinigameReward[] | null;
  /**
   * Rückenwind nach dem Minispiel (CHAOS-125): ausgezahlte Münzen je Slot ab `round-end`, nur
   * Slots mit Münzen. Fehlt = keiner (Regel aus, letzte Runde, kein Rückstand).
   */
  readonly tailwind?: readonly TailwindBonus[];
  /**
   * Aufstellung bei Teams bzw. Koop (CHAOS-89), fest ab `minigame-intro`. Fehlt = jeder gegen
   * jeden.
   */
  readonly teams?: MinigameTeams;
  /** Ausgang bei Teams bzw. Koop (CHAOS-89), sobald das Ergebnis feststeht. */
  readonly outcome?: MinigameOutcome;
}

/** Rückenwind-Münzen eines Slots nach einem Minispiel (CHAOS-125). */
export interface TailwindBonus {
  readonly slot: Slot;
  readonly coins: number;
}

export interface MinigameReward {
  readonly slot: Slot;
  readonly coins: number;
  /**
   * Items aus dem Ergebnis (Trostpreis bzw. Sieg-Item, CHAOS-51/EXP-019); fehlt, wenn keine.
   * Bei voller Item-Kapazität gibt es nichts.
   */
  readonly items?: readonly ItemKind[];
}

// ---------------------------------------------------------------------------
// Zustand
// ---------------------------------------------------------------------------

/**
 * Explizite Phasen (ARCHITECTURE „Game-core design“). Automatische Phasen warten nur auf
 * Zeit (`resumeAt`), Entscheidungsphasen auf eine Wahl (`prompt`).
 */
export type GamePhase =
  | 'setup'
  | 'turn-start'
  | 'roll'
  | 'choose-target'
  | 'move'
  | 'choose-path'
  | 'trophy-offer'
  | 'space-event'
  | 'reaction-window'
  | 'turn-end'
  | 'minigame-intro'
  | 'minigame-play'
  | 'minigame-results'
  | 'round-end'
  | 'game-results';

/**
 * Art einer Entscheidung.
 * - `roll`: Optionen `roll` und je einsetzbarem Item `item:<ItemKind>` (vor dem Wurf).
 * - `target`: Ziel eines Items, Optionen `slot:<n>` und `cancel`.
 * - `path`: an einer Verzweigung, Optionen = IDs der Nachfolgefelder.
 * - `trophy`: beim Erreichen/Passieren der Trophäe, Optionen `buy` und `skip`.
 * - `reaction`: Reaktionsfenster des angegriffenen Spielers, Optionen `shield` (nur mit
 *   Schild) und `brace` („Festhalten!“, halbiert den Verlust). Zeitablauf = keine Reaktion.
 */
export type PromptKind = 'roll' | 'target' | 'path' | 'trophy' | 'reaction';

export interface PromptOption {
  readonly id: string;
  /** Kurzer deutscher Anzeigetext für den Controller-Knopf. */
  readonly label: string;
  /** Optionaler Zusatz (z. B. Preis, Richtung). */
  readonly detail?: string;
  /** Bezieht sich die Option auf einen Spieler (Ziel), dessen Slot (Farbe am Controller). */
  readonly slot?: Slot;
}

export interface Prompt {
  /** Fortlaufende ID; eine Wahl muss die aktuelle ID nennen (alte Wahl → `stale-prompt`). */
  readonly id: number;
  readonly slot: Slot;
  readonly kind: PromptKind;
  /** Kurze Frage/Überschrift für den Controller. */
  readonly title: string;
  readonly options: readonly PromptOption[];
  /** Option bei Zeitablauf oder für getrennte Spieler nach `disconnectGraceMs`. */
  readonly defaultOption: string;
  /** Absolute Frist (Server-Uhr, ms) oder `null` = wartet unbegrenzt. */
  readonly deadline: number | null;
}

/**
 * Statistik je Spieler nur für Bonus-Anzeigen am Ende (M4, CHAOS-37), ohne Einfluss auf die
 * Wertung. Wird in `step` aus den Ereignissen gezählt.
 */
export interface PlayerStats {
  /** Summe aller Münzgewinne (positive `coins-changed`). */
  readonly coinsEarned: number;
  /**
   * Summe der Münzverluste durch Pech (Betrag negativer `coins-changed` mit Grund `space`,
   * `steal` oder `trap`); Trophäenkäufe zählen nicht (CHAOS-123).
   */
  readonly coinsLost: number;
  /** Gelaufene Felder (alle `moved`-Abschnitte). */
  readonly spacesMoved: number;
  /** Eingesetzte Items (`item-used`). */
  readonly itemsUsed: number;
}

export interface PlayerState {
  readonly slot: Slot;
  readonly name: string;
  readonly spaceId: string;
  readonly coins: number;
  readonly trophies: number;
  readonly items: readonly ItemKind[];
  readonly connected: boolean;
  /**
   * Gewonnene Minispiele (M4, CHAOS-37): Anzahl 1. Plätze (Gleichstand auf Platz 1 zählt für
   * alle). Drittes Kriterium der Wertung nach Trophäen und Münzen.
   */
  readonly minigameWins: number;
  readonly stats: PlayerStats;
}

export interface TrapState {
  readonly spaceId: string;
  readonly owner: Slot;
}

/**
 * Kriterium, das den Platz entschieden hat (M4, ADR-015): Trophäen → Münzen → Minispiel-Siege;
 * `shared` = mit mindestens einem anderen in allen drei gleich (geteilter Platz).
 */
export type RankingCriterion = 'trophies' | 'coins' | 'minigame-wins' | 'shared';

export interface RankingEntry {
  readonly slot: Slot;
  /** Platz 1–4; Gleichstand in Trophäen, Münzen und Minispiel-Siegen = gleicher Platz. */
  readonly place: number;
  readonly trophies: number;
  readonly coins: number;
  readonly minigameWins: number;
  /**
   * Tiefstes Kriterium, das nötig war, um diesen Spieler von allen anderen zu trennen
   * (`trophies` = Trophäenzahl ist einzigartig; `coins` = Trophäengleichstand, Münzen
   * entscheiden; …; `shared` = Platz geteilt). Bei nur einem Spieler `trophies`.
   */
  readonly decidedBy: RankingCriterion;
}

/**
 * Vollständiger, JSON-serialisierbarer Spielzustand. Felder, die nur intern gebraucht
 * werden (Zwischenstand einer Bewegung, RNG), stehen in `internal` und gehen nicht an
 * Host oder Controller.
 */
export interface GameState {
  readonly boardId: string;
  readonly phase: GamePhase;
  readonly round: number;
  readonly rounds: number;
  readonly turnOrder: readonly Slot[];
  /** Spieler am Zug (während Minispiel/Ergebnis `null`). */
  readonly activeSlot: Slot | null;
  readonly players: readonly PlayerState[];
  /** Aktive Trophäenfelder (bei `wandering` genau eins). */
  readonly trophySpaces: readonly string[];
  readonly traps: readonly TrapState[];
  readonly prompt: Prompt | null;
  /** Automatische Phase läuft bis zu diesem Zeitpunkt weiter (Server-Uhr) oder `null`. */
  readonly resumeAt: number | null;
  /** Letzter verarbeiteter Zeitpunkt; Befehle mit kleinerem `at` werden abgewiesen. */
  readonly now: number;
  /** Endstand, sobald `phase === 'game-results'`. */
  readonly ranking: readonly RankingEntry[] | null;
  /**
   * Partie pausiert (M4, CHAOS-36): Keine Frist läuft ab (`resumeAt`, Prompt-Frist,
   * Minispiel-Spielzeit/Schonfrist). Beim Fortsetzen verschieben sich alle um die Pausendauer.
   */
  readonly paused: boolean;
  /** Beginn der Pause (Server-Uhr) oder `null`. Anzeigen rechnen Restzeiten ab hier. */
  readonly pausedAt: number | null;
  /** Partie per `end` vorzeitig beendet (nur in `game-results` `true`). */
  readonly endedEarly: boolean;
  /** Minispiel der aktuellen Runde ab `minigame-intro` bis zum Rundenende, sonst `null`. */
  readonly minigame: MinigameState | null;
  readonly config: {
    readonly rules: RuleSet;
    readonly seed: number;
    /** Minispiele der Partie (leer = Platzhalter). */
    readonly minigames: readonly MinigameSpec[];
    /** Übungsmodus der Galerie (CHAOS-87, siehe `GameConfig.practice`). Fehlt = `false`. */
    readonly practice?: boolean;
    /** Filter, Gewichte und Gedächtnis der Minispiel-Auswahl (CHAOS-85); fehlt = keine. */
    readonly minigameRotation?: MinigameRotationOptions;
  };
  /** Interner Zustand der Regeln (Bewegung, RNG, Zähler). Form bestimmt game-core. */
  readonly internal: Readonly<Record<string, unknown>>;
}

// ---------------------------------------------------------------------------
// Befehle
// ---------------------------------------------------------------------------

export type GameCommand =
  /** SETUP → erste Runde (Zugreihenfolge per RNG). */
  | { readonly type: 'start'; readonly at: number }
  /** Wahl eines Spielers für den aktuellen Prompt. */
  | {
      readonly type: 'choose';
      readonly slot: Slot;
      readonly promptId: number;
      readonly option: string;
      readonly at: number;
    }
  /** Zeit vergeht (Server ruft das regelmäßig auf, z. B. alle 100 ms). */
  | { readonly type: 'tick'; readonly at: number }
  /** Verbindung eines Spielers geändert (Disconnect mitten im Zug, CHAOS-23). */
  | {
      readonly type: 'connection';
      readonly slot: Slot;
      readonly connected: boolean;
      readonly at: number;
    }
  /**
   * Spieler ist nach der Minispiel-Anleitung bereit (CHAOS-214). Nur in `minigame-intro` mit
   * `minigame.ready`; doppelt ist harmlos. Sind alle verbundenen Spieler bereit, startet das Spiel.
   */
  | { readonly type: 'minigame-ready'; readonly slot: Slot; readonly at: number }
  /** Ergebnis des laufenden Minispiels vom Host (M3); wird vollständig geprüft. */
  | {
      readonly type: 'minigame-result';
      readonly minigameId: string;
      readonly round: number;
      readonly placements: readonly MinigamePlacement[];
      readonly highlights?: readonly string[];
      /** Pflicht bei Teams bzw. Koop (CHAOS-89), sonst verboten. */
      readonly outcome?: MinigameOutcome;
      readonly at: number;
    }
  /**
   * Partie anhalten (M4). Nur zwischen `start` und `game-results`. Während der Pause sind
   * `choose` (→ `paused`) und weiteres `pause` abgewiesen; `minigame-result` wird angenommen
   * und zum Pausenbeginn verbucht, `connection` und `tick` wirken ohne Zeitablauf.
   */
  | { readonly type: 'pause'; readonly at: number }
  /** Pause beenden; alle Fristen verschieben sich um `at - pausedAt`. */
  | { readonly type: 'resume'; readonly at: number }
  /**
   * Partie sofort beenden (M4): `game-results` mit Endstand aus dem aktuellen Stand,
   * `endedEarly: true`. Auch während der Pause möglich.
   */
  | { readonly type: 'end'; readonly at: number };

export type GameErrorCode =
  | 'wrong-phase'
  | 'not-your-turn'
  | 'stale-prompt'
  | 'invalid-option'
  | 'unknown-player'
  | 'invalid-result'
  | 'time-went-back'
  /** Befehl während der Pause nicht möglich (`choose`, erneutes `pause`). */
  | 'paused'
  /** `resume` ohne Pause. */
  | 'not-paused';

export interface GameError {
  readonly code: GameErrorCode;
  readonly message: string;
}

export type StepResult =
  | { readonly ok: true; readonly state: GameState; readonly events: readonly GameEvent[] }
  | { readonly ok: false; readonly state: GameState; readonly error: GameError };

// ---------------------------------------------------------------------------
// Ereignisse (für Host-Animation, Controller-Rückmeldung, Tests und Experimente)
// ---------------------------------------------------------------------------

/** `tailwind` (CHAOS-125): Rückenwind-Münzen für Zurückliegende nach dem Minispiel. */
export type CoinReason = 'space' | 'event' | 'trophy' | 'steal' | 'trap' | 'minigame' | 'tailwind';

/** Zufällige Ereignisse auf `event`-Feldern (Auswahl per RNG; Liste bestimmt game-core). */
export type BoardEventKind = 'coin-rain' | 'gust' | 'swap' | 'trophy-shuffle' | 'lucky-find';

/** Sabotage-Stärke einer Runde (CHAOS-67/120): Münzen je Klau bzw. Falle. */
export interface SabotageLevel {
  readonly steal: number;
  readonly trap: number;
}

export type GameEvent =
  | { readonly type: 'game-started'; readonly order: readonly Slot[] }
  | {
      readonly type: 'round-started';
      readonly round: number;
      /**
       * Nur in Runden, in denen die Sabotage wächst (CHAOS-120, `items.sabotageGrowthRounds`):
       * die neuen Werte für Klau und Falle. Der Host kündigt sie an.
       */
      readonly sabotage?: SabotageLevel;
    }
  | { readonly type: 'turn-started'; readonly slot: Slot; readonly round: number }
  | {
      readonly type: 'item-used';
      readonly slot: Slot;
      readonly item: ItemKind;
      readonly target?: Slot;
    }
  | {
      readonly type: 'dice-rolled';
      readonly slot: Slot;
      readonly faces: readonly number[];
      readonly total: number;
    }
  | { readonly type: 'path-chosen'; readonly slot: Slot; readonly spaceId: string }
  /** Ein Bewegungsabschnitt; `path` = betretene Felder in Reihenfolge (ohne Startfeld). */
  | { readonly type: 'moved'; readonly slot: Slot; readonly path: readonly string[] }
  | {
      readonly type: 'coins-changed';
      readonly slot: Slot;
      readonly delta: number;
      readonly balance: number;
      readonly reason: CoinReason;
    }
  | { readonly type: 'trophy-bought'; readonly slot: Slot; readonly spaceId: string }
  | { readonly type: 'trophy-moved'; readonly from: string; readonly to: string }
  | { readonly type: 'item-gained'; readonly slot: Slot; readonly item: ItemKind }
  | { readonly type: 'board-event'; readonly slot: Slot; readonly event: BoardEventKind }
  | { readonly type: 'trap-placed'; readonly slot: Slot; readonly spaceId: string }
  | {
      readonly type: 'trap-triggered';
      readonly slot: Slot;
      readonly owner: Slot;
      readonly spaceId: string;
      readonly amount: number;
    }
  | {
      readonly type: 'reaction-opened';
      readonly promptId: number;
      readonly slot: Slot;
      readonly attacker: Slot;
      readonly item: ItemKind;
      readonly deadline: number;
    }
  | {
      readonly type: 'reaction-resolved';
      readonly slot: Slot;
      readonly result: 'shield' | 'brace' | 'timeout';
    }
  | {
      readonly type: 'coins-stolen';
      readonly from: Slot;
      readonly to: Slot;
      readonly amount: number;
    }
  | {
      readonly type: 'player-auto';
      readonly slot: Slot;
      readonly option: string;
      readonly reason: 'disconnected' | 'timeout';
    }
  | { readonly type: 'turn-ended'; readonly slot: Slot }
  | { readonly type: 'minigame-started'; readonly minigame: string }
  | {
      readonly type: 'minigame-results';
      /** Slots nach Platz (bei Gleichstand nach Slot); leer bei Abbruch. */
      readonly ranking: readonly Slot[];
      readonly placements: readonly MinigamePlacement[];
      readonly aborted: boolean;
    }
  | { readonly type: 'round-ended'; readonly round: number }
  | {
      readonly type: 'game-ended';
      readonly ranking: readonly RankingEntry[];
      /** Per `end` statt nach der letzten Runde. */
      readonly endedEarly: boolean;
    };

export type GameEventType = GameEvent['type'];
