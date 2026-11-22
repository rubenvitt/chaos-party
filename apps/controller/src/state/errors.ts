/**
 * Fehlercodes → freundliche deutsche Texte. Der Controller zeigt nie die
 * technische `message` des Servers, sondern nur diese Texte (ADR-006).
 */
import type { ErrorCode } from '@chaos-party/protocol';

/**
 * Fehler, die nur im Controller entstehen (Verbindung, CHAOS-12):
 * - `connection-failed` / `connection-lost`: Texte für die Wiederverbinden-Anzeige,
 * - `replaced`: Derselbe Platz wurde von einem anderen Tab/Gerät übernommen (Close 4003),
 * - `game-running`: Neubeitritt während des Spiels nicht möglich (altes Token abgelaufen).
 */
export type ClientErrorCode = 'connection-failed' | 'connection-lost' | 'replaced' | 'game-running';

export type UiErrorCode = ErrorCode | ClientErrorCode;

/**
 * Wie auffällig ein Fehler erscheint:
 * - `silent`: gar nicht (z. B. verspätete Eingabe, abgelaufenes Token mit automatischem Neubeitritt),
 * - `toast`: kurzer Hinweis, Spiel geht weiter,
 * - `code`: zurück zur Code-Eingabe,
 * - `blocking`: ganzer Bildschirm mit Knopf (neu laden / neu verbinden).
 */
export type ErrorSeverity = 'silent' | 'toast' | 'code' | 'blocking';

interface ErrorPresentation {
  readonly severity: ErrorSeverity;
  readonly text: string;
}

const PRESENTATION: Readonly<Record<UiErrorCode, ErrorPresentation>> = {
  'bad-message': {
    severity: 'toast',
    text: 'Da ist etwas schiefgelaufen. Lade die Seite neu, falls es hakt.',
  },
  'too-large': {
    severity: 'toast',
    text: 'Da ist etwas schiefgelaufen. Lade die Seite neu, falls es hakt.',
  },
  'version-mismatch': {
    severity: 'blocking',
    text: 'Das Spiel wurde aktualisiert. Bitte lade die Seite neu.',
  },
  'not-joined': {
    severity: 'blocking',
    text: 'Du bist noch nicht im Spiel. Bitte verbinde dich neu.',
  },
  'bad-join-code': {
    severity: 'code',
    text: 'Diesen Code gibt es nicht. Schau noch mal auf den Fernseher.',
  },
  'session-full': {
    severity: 'blocking',
    text: 'Das Spiel ist schon voll. Mehr als vier Spieler gehen nicht.',
  },
  'bad-token': {
    severity: 'silent',
    text: 'Deine alte Sitzung ist abgelaufen. Du trittst neu bei.',
  },
  'host-taken': {
    severity: 'blocking',
    text: 'Auf diesem Spiel läuft schon ein anderer Bildschirm.',
  },
  'not-your-slot': { severity: 'toast', text: 'Das ist nicht dein Platz.' },
  'out-of-phase': { severity: 'toast', text: 'Das geht gerade nicht. Warte kurz.' },
  'stale-seq': { severity: 'silent', text: 'Eine Eingabe kam zu spät an.' },
  'rate-limited': { severity: 'toast', text: 'Nicht so hastig! Kurz durchatmen.' },
  'invalid-choice': { severity: 'toast', text: 'Zu spät – die Entscheidung ist schon gefallen.' },
  // Nur für den Host; ein Controller bekommt den Code nie, Text der Vollständigkeit halber.
  'invalid-result': { severity: 'toast', text: 'Das Minispiel-Ergebnis wurde nicht angenommen.' },
  // v4 (ADR-015): Figur gleichzeitig von jemand anderem gewählt – Kontext kommt neu.
  'character-taken': {
    severity: 'toast',
    text: 'Die Figur hat sich gerade jemand anderes geschnappt.',
  },
  // v4: Eingabe kam während der Pause an (kurzer Wettlauf), der Kontext zeigt die Pause.
  paused: { severity: 'silent', text: 'Das Spiel ist pausiert.' },
  // CHAOS-179: `ai-seat` nicht von der Spielleitung (Wettlauf beim Wechsel der Spielleitung).
  'not-lead': { severity: 'toast', text: 'KI-Plätze verwaltet die Spielleitung.' },
  internal: {
    severity: 'toast',
    text: 'Der Spiel-PC hat ein Problem. Versuch es gleich noch mal.',
  },
  'connection-failed': {
    severity: 'blocking',
    text: 'Der Spiel-PC ist nicht erreichbar. Bist du im selben WLAN?',
  },
  'connection-lost': { severity: 'blocking', text: 'Die Verbindung zum Spiel-PC ist weg.' },
  replaced: {
    severity: 'blocking',
    text: 'Dein Platz wird gerade in einem anderen Fenster oder auf einem anderen Gerät gespielt.',
  },
  'game-running': {
    severity: 'blocking',
    text: 'Das Spiel läuft schon. Neue Spieler können erst wieder in der Lobby beitreten.',
  },
};

export function errorText(code: UiErrorCode): string {
  return PRESENTATION[code].text;
}

export function errorSeverity(code: UiErrorCode): ErrorSeverity {
  return PRESENTATION[code].severity;
}

/** Was der Knopf auf dem Fehlerbildschirm tut. */
export function errorRemedy(code: UiErrorCode): 'reload' | 'retry' {
  return code === 'version-mismatch' ? 'reload' : 'retry';
}
