/**
 * KI-Sitze in der Session (CHAOS-179, ADR-020 §3): Ein KI-Platz ist ein **virtueller
 * Controller** ohne Verbindung. Er liest denselben Kontext wie ein Controller (offener Prompt mit
 * Optionen, eigener Stand, Minispiel-Anleitung) und antwortet über denselben Weg wie `choose`
 * bzw. `ready`, mit denselben Prüfungen in Session und game-core. Ungültige oder verspätete
 * Antworten weist die Session ab wie bei Menschen.
 *
 * Was die KI wählt und wie lange sie überlegt, entscheidet eine {@link AiSeatPolicy}. Die echte
 * Brett-KI mit Stärke, Denkpause und Persönlichkeit kommt mit CHAOS-181/186/187; bis dahin nimmt
 * {@link PLACEHOLDER_AI_POLICY} nach einer festen Denkpause die Standardoption des Prompts (die
 * game-core auch bei abgelaufener Frist nähme). Minispiel-Eingaben erzeugt nicht der Server,
 * sondern der Host (CHAOS-180, ADR-020 §3).
 */
import type {
  AiPersonality,
  AiStrength,
  ControllerBoardInfo,
  PromptInfo,
  SlotNumber,
} from '@chaos-party/protocol';

/** Was ein KI-Sitz zu einem offenen Prompt sieht (wie der Kontext eines Controllers). */
export interface AiPromptRequest {
  readonly slot: SlotNumber;
  readonly strength: AiStrength;
  /** Spielstil (CHAOS-186); fehlt, solange keiner vergeben ist. */
  readonly personality?: AiPersonality | undefined;
  /** Offener Prompt dieses Platzes mit Optionen und Restzeit. */
  readonly prompt: PromptInfo;
  /**
   * Option, die game-core bei abgelaufener Frist wählt. Nicht immer selbst wählbar (Reaktion:
   * `none`); {@link safeOption} liefert eine angebotene.
   */
  readonly defaultOption: string;
  /** Eigener Stand (Münzen, Trophäen, Items, Runde). */
  readonly board: ControllerBoardInfo;
}

/** Antwort eines KI-Sitzes: gewählte Option und Denkpause bis zur Antwort. */
export interface AiDecision {
  readonly option: string;
  /** Denkpause in ms ab dem Öffnen des Prompts bzw. dem Fortsetzen nach einer Pause. */
  readonly delayMs: number;
}

/** Entscheidungslogik der KI-Sitze. Muss deterministisch sein (ADR-020 §8). */
export interface AiSeatPolicy {
  decide(request: AiPromptRequest): AiDecision;
  /** Denkpause bis „Bereit“ in der Minispiel-Anleitung (CHAOS-214). */
  readyDelayMs(slot: SlotNumber, strength: AiStrength): number;
}

/** Feste Denkpause des Platzhalters, mitten im Bereich von `decisionMs` (ADR-020 §6). */
export const PLACEHOLDER_DECISION_MS = 1200;
/** Feste Pause des Platzhalters bis „Bereit“ in der Minispiel-Anleitung. */
export const PLACEHOLDER_READY_MS = 1000;

/**
 * Sichere Wahl: die Standardoption, wenn der Prompt sie anbietet, sonst die erste Option. Die
 * Standardoption ist nicht immer wählbar (Reaktion: `none` gilt nur bei abgelaufener Frist).
 */
export function safeOption(prompt: PromptInfo, defaultOption: string): string {
  if (prompt.options.some((option) => option.id === defaultOption)) return defaultOption;
  return prompt.options[0]?.id ?? defaultOption;
}

/**
 * Platzhalter bis CHAOS-181: wählt nach einer festen Denkpause die sichere Option
 * ({@link safeOption}). So bleibt keine Partie an einem KI-Prompt ohne Frist (Würfeln) hängen.
 */
export const PLACEHOLDER_AI_POLICY: AiSeatPolicy = {
  decide: (request) => ({
    option: safeOption(request.prompt, request.defaultOption),
    delayMs: PLACEHOLDER_DECISION_MS,
  }),
  readyDelayMs: () => PLACEHOLDER_READY_MS,
};

/** Geplante Antwort eines KI-Sitzes (Server-intern). */
export interface AiPending {
  /** Wofür: `prompt:<id>` bzw. `ready:<runde>`; ändert sich der Anlass, wird neu geplant. */
  readonly key: string;
  readonly dueAt: number;
  /** Bei `prompt:*` die gewählte Option. */
  readonly option?: string | undefined;
  /** Rückfall auf die sichere Option ({@link safeOption}) nach einer abgewiesenen Antwort. */
  readonly fallback: boolean;
  /** Schon geantwortet: nichts mehr tun, bis sich der Anlass ändert. */
  readonly done: boolean;
}
