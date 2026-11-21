/**
 * Ganzzahlige Protokollversion. Erhöhen bei jeder inkompatiblen Änderung.
 * v2 (M2, ADR-011): Phase `board`, `choose`, `prompt`/`board` im Kontext, `board` an den Host.
 * v3 (M3, ADR-012): echte Minispiele – `minigame` im Brett-Stand und im Controller-Kontext,
 * `minigame-result` vom Host, Eingaben (`move`/`press`/`release`) in der Brettphase während
 * `minigame-play`, erweiterte Ereignisse `minigame-started`/`minigame-results`.
 * v4 (M4, ADR-015): Charakterwahl (`pick-character`, `LobbyPlayer.character`,
 * `BoardPlayer.character`, Kontext `lobby`, Fehler `character-taken`), Lobby-Einstellungen
 * (`lobby.settings`, `configure`), Pause/Ende (`pause`/`resume`/`end-game`, `BoardView.paused`/
 * `endedEarly`, Fehler `paused`), Revanche (`rematch`), Wertung mit Minispiel-Siegen
 * (`RankingEntry.minigameWins`/`decidedBy`, `BoardPlayer.minigameWins`/`stats`),
 * `BoardView.minigame.rewards`, Minispiel-Kontext `tied`/`aborted`/`reward`, Bestätigung
 * `minigame-result-ack`, `game-ended.endedEarly`.
 * v4-Nachtrag (CHAOS-40, additiv, ohne Versionssprung): Lobby-Kontext `takenBy`
 * (vergebene Figuren mit Besitzer-Slot, optional).
 * v4-Nachtrag (CHAOS-68, additiv, ohne Versionssprung): Host-Nachricht `host-ready` (Szene und
 * Figuren geladen); erst danach setzt der Server eine Auto-Pause nach Host-Verlust fort.
 * v4-Nachtrag (CHAOS-51, additiv, ohne Versionssprung): Trostpreis im Minispiel-Ergebnis –
 * `BoardView.minigame.rewards[].items` und Minispiel-Kontext `prizes` (beide optional).
 * v4-Nachtrag (CHAOS-66, additiv, ohne Versionssprung): `repeat` (optional) in
 * `BoardView.minigame` und im Minispiel-Kontext des Controllers: Minispiel lief in der Partie
 * schon, das Intro ist kurz (nur Titel und Bedienlegende).
 * v4-Nachtrag (CHAOS-120, additiv, ohne Versionssprung): `sabotage` (optional) im Ereignis
 * `round-started` – neue Klau-/Fallenwerte in Runden, in denen die Sabotage wächst.
 * v4-Nachtrag (CHAOS-124, additiv, ohne Versionssprung): Lobby-Einstellung „Mehr Zeit zum
 * Reagieren“ – `lobby.settings.moreReactionTime` (optional); in `configure` sind `rounds` und
 * `moreReactionTime` optional, mindestens eines ist gesetzt.
 * v4-Nachtrag (CHAOS-125, additiv, ohne Versionssprung): Münz-Grund `tailwind` (Rückenwind),
 * `BoardView.minigame.tailwind` und `ControllerBoardInfo.tailwind` (beide optional, ab
 * `round-end`).
 * v4-Nachtrag (CHAOS-197, additiv, ohne Versionssprung): Brett-Auswahl in der Lobby –
 * `lobby.settings.board` (Brett-ID oder `RANDOM_BOARD` „zufall“) und `lobby.settings.boards`
 * (wählbare Bretter), `configure.board` und `ControllerLobbyInfo.board` (alle optional). Ein
 * unbekanntes Brett in `configure` lehnt der Server mit `bad-message` ab.
 * v4-Nachtrag (CHAOS-87, additiv, ohne Versionssprung): Minispiel-Galerie und Daumen –
 * `start.practice` (Übungsrunde mit einem Minispiel), `BoardView.practice`, Minispiel-Kontext
 * `practice`/`vote`, Aktion `rate` und Controller-Nachricht `rate` (Brettphase, nur in der
 * Ergebnisanzeige), Host-Nachricht `ratings` (Stimmen je Minispiel). Gegenstellen ohne den
 * Nachtrag ignorieren `ratings` bzw. senden kein `rate`.
 * v4-Nachtrag (CHAOS-214, additiv, ohne Versionssprung): „Bereit“ in der Minispiel-Anleitung –
 * `ready` ist auch in der Brettphase erlaubt, wenn der Kontext die Aktion `ready` anbietet
 * (`minigame-intro`); `ControllerMinigameInfo.ready` (eigener Stand) und
 * `BoardView.minigame.ready` (bereite Slots), beide optional. Ältere Controller ohne Knopf
 * halten nichts auf: Nach der Sicherheitsfrist startet das Minispiel trotzdem.
 * v4-Nachtrag (CHAOS-89, additiv, ohne Versionssprung): Spielformen mit Teams und Koop –
 * `BoardView.minigame.teams`/`outcome`, Minispiel-Kontext `team` (eigene Rolle) und
 * `minigame-result.outcome` (alle optional). Ein Sprung auf v5 hätte alle installierten
 * iOS-Controller und den Apple-Host ausgesperrt; Gegenstellen ohne den Nachtrag zeigen Teams
 * nicht an, und Team-Minispiele kommen nur aus dem Katalog des Web-Hosts.
 */
export const PROTOCOL_VERSION = 4;

export type ProtocolVersion = typeof PROTOCOL_VERSION;

/** Prüft, ob eine Gegenstelle dieselbe Protokollversion spricht. */
export function isCompatibleVersion(version: unknown): version is ProtocolVersion {
  return version === PROTOCOL_VERSION;
}
