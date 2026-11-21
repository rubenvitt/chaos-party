import type { LobbyMinigame, MinigameRating } from '@chaos-party/protocol';
import { useEffect, useMemo, useRef } from 'react';
import { galleryRows, votesText, type GalleryRow } from './gallery.ts';

/** Favorit bzw. Sperre eines Minispiels umschalten (sendet `configure`, CHAOS-85). */
export type ToggleMinigame = (id: string, kind: 'blocked' | 'favorite') => void;

interface MinigameGalleryProps {
  readonly ratings: readonly MinigameRating[];
  /** Rotation des Servers mit Sperr- und Favoriten-Stand (`lobby.settings.minigames`). */
  readonly rotation: readonly LobbyMinigame[];
  /** Ohne Rückruf (alter Server, keine Rotation) keine Favoriten- und Sperr-Knöpfe. */
  readonly onToggle?: ToggleMinigame | undefined;
  /** Übungsrunde möglich (verbunden, mindestens ein Controller da)? */
  readonly canPractice: boolean;
  readonly onPractice: (minigameId: string) => void;
  readonly onClose: () => void;
  /** Download-Link des Exports (`/ratings.json` des Servers). */
  readonly exportHref: string;
}

/**
 * Die eine Minispiel-Ansicht der PC-Lobby (CHAOS-228, vorher Galerie CHAOS-87 und Dialog der
 * Rotation CHAOS-85): alle startbaren Minispiele mit Status, Kategorie, Familie, Bedienung und
 * Daumen; Spiele der Rotation dazu mit „Favorit“ (kommt öfter) und „Sperren“ (kommt nicht, ab der
 * nächsten Partie). „Üben“ startet eine Übungsrunde mit den verbundenen Controllern (ein
 * Minispiel, keine Münzen, danach zurück in die Lobby). Spiele der Rotation mit vielen Daumen
 * runter tragen einen Rauswurf-Vorschlag mit Sperren-Knopf – geklickt wird nur von Ruben, nichts
 * passiert automatisch. Escape oder „Fertig“ führt zurück zur Lobby.
 */
export function MinigameGallery({
  ratings,
  rotation,
  onToggle,
  canPractice,
  onPractice,
  onClose,
  exportHref,
}: MinigameGalleryProps) {
  const rows = useMemo(
    () => galleryRows(ratings, onToggle === undefined ? [] : rotation),
    [ratings, rotation, onToggle],
  );
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
  }, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);
  const allBlocked =
    onToggle !== undefined && rotation.length > 0 && rotation.every((game) => game.blocked);

  return (
    <div className="gallery" role="dialog" aria-modal="true" aria-labelledby="gallery-title">
      <div className="gallery-card" data-testid="minigame-gallery">
        <header className="gallery-head">
          <div>
            <h2 id="gallery-title">Minispiele</h2>
            <p className="gallery-lead">
              Einzeln üben – ohne Münzen. Nach jedem Minispiel gibt’s am Handy Daumen hoch oder
              runter.
              {onToggle !== undefined &&
                ' ★ Favoriten kommen öfter dran, gesperrte gar nicht – ab der nächsten Partie.'}
            </p>
          </div>
          <div className="gallery-actions">
            <a className="gallery-export" href={exportHref} download data-testid="gallery-export">
              Stimmen exportieren
            </a>
            <button
              ref={closeRef}
              type="button"
              className="gallery-close"
              data-testid="gallery-close"
              onClick={onClose}
            >
              Fertig
            </button>
          </div>
        </header>
        {(!canPractice || allBlocked) && (
          <div className="gallery-notes">
            {!canPractice && (
              <p className="gallery-hint" data-testid="gallery-hint">
                Üben geht, sobald mindestens ein Controller verbunden ist.
              </p>
            )}
            {allBlocked && (
              <p className="gallery-hint" role="note" data-testid="gallery-all-blocked">
                Alle gesperrt – dann kommen trotzdem alle dran.
              </p>
            )}
          </div>
        )}
        <ul className="gallery-list" aria-label="Minispiele">
          {rows.map((row) => (
            <GalleryItem
              key={row.id}
              row={row}
              canPractice={canPractice}
              onPractice={onPractice}
              onToggle={onToggle}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}

function GalleryItem({
  row,
  canPractice,
  onPractice,
  onToggle,
}: {
  readonly row: GalleryRow;
  readonly canPractice: boolean;
  readonly onPractice: (minigameId: string) => void;
  readonly onToggle: ToggleMinigame | undefined;
}) {
  const pick = onToggle === undefined ? null : row.pick;
  return (
    <li
      className="gallery-item"
      data-testid={`gallery-item-${row.id}`}
      data-status={row.status}
      data-suggest-removal={row.suggestRemoval}
      data-blocked={pick?.blocked ?? false}
      data-favorite={pick?.favorite ?? false}
    >
      <div className="gallery-item-main">
        <h3 className="gallery-item-title">
          <span className="gallery-item-name">{row.title}</span>
          <span className={`gallery-status gallery-status--${row.status}`}>{row.statusLabel}</span>
          {pick?.blocked === true && (
            <span className="gallery-status gallery-status--blocked">Gesperrt</span>
          )}
        </h3>
        <p className="gallery-item-tagline">{row.tagline}</p>
        <p className="gallery-item-meta">
          {row.category}
          {row.family === null ? '' : ` · ${row.family}`} · {String(row.seconds)} s · {row.controls}
        </p>
        {row.suggestRemoval && (
          <p className="gallery-removal" data-testid={`gallery-removal-${row.id}`}>
            Viele Daumen runter – aus der Rotation nehmen?
            {onToggle !== undefined && (
              <button
                type="button"
                className="gallery-removal-block"
                data-testid={`gallery-removal-block-${row.id}`}
                aria-label={`${row.title} aus der Rotation nehmen (sperren)`}
                onClick={() => {
                  onToggle(row.id, 'blocked');
                }}
              >
                <span aria-hidden="true">⦸</span> Sperren
              </button>
            )}
          </p>
        )}
      </div>
      <div
        className="gallery-votes"
        data-testid={`gallery-votes-${row.id}`}
        data-up={row.up}
        data-down={row.down}
        aria-label={`${String(row.up)} Daumen hoch, ${String(row.down)} Daumen runter`}
      >
        <span className="gallery-vote">
          <span aria-hidden="true">👍</span> {row.up}
        </span>
        <span className="gallery-vote">
          <span aria-hidden="true">👎</span> {row.down}
        </span>
        <span className="gallery-votes-total">{votesText(row)}</span>
      </div>
      <div className="gallery-picks">
        {pick !== null && onToggle !== undefined && (
          <>
            <button
              type="button"
              className="gallery-pick gallery-pick--favorite"
              data-testid={`gallery-favorite-${row.id}`}
              aria-pressed={pick.favorite}
              aria-label={`${row.title} als Favorit`}
              onClick={() => {
                onToggle(row.id, 'favorite');
              }}
            >
              <span className="gallery-pick-label">
                <span aria-hidden="true">★</span> Favorit
              </span>
            </button>
            <button
              type="button"
              className="gallery-pick gallery-pick--blocked"
              data-testid={`gallery-blocked-${row.id}`}
              aria-pressed={pick.blocked}
              aria-label={`${row.title} sperren`}
              onClick={() => {
                onToggle(row.id, 'blocked');
              }}
            >
              <span className="gallery-pick-label">
                <span aria-hidden="true">⦸</span> Sperren
              </span>
            </button>
          </>
        )}
      </div>
      <button
        type="button"
        className="gallery-practice"
        data-testid={`gallery-practice-${row.id}`}
        disabled={!canPractice}
        aria-label={`${row.title} üben`}
        onClick={() => {
          onPractice(row.id);
        }}
      >
        Üben
      </button>
    </li>
  );
}
