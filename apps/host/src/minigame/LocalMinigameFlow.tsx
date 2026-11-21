/**
 * Lokaler Minispiel-Ablauf (`/host/?local=1&minigame=<id>&flow=1`, M3): Intro → Spiel →
 * Ergebnis mit lokalen Zeiten und Tastatur-Spielern, ohne Server – dieselbe Bühne
 * (`MinigameScreen`) wie im echten Spielablauf. Für Screenshots von Anleitung und Ergebnis.
 *
 * Ohne Testmodus wechselt das Intro nach `LOCAL_INTRO_MS` ins Spiel; im Testmodus
 * (`&test=1`) schaltet `window.__chaosMinigame.next()` weiter, `step(n)` rechnet das Spiel.
 * Das Ergebnis erscheint, sobald das Minispiel fertig ist.
 */
import { useCallback, useEffect, useState } from 'react';
import type { LocalReadiness } from '../config.ts';
import type { MinigameResultPayload } from '../net/hostConnection.ts';
import { MinigameScreen } from './MinigameScreen.tsx';
import {
  LOCAL_INTRO_MS,
  LOCAL_REPEAT_INTRO_MS,
  localRewards,
  localView,
  type LocalFlowState,
} from './localFlow.ts';
import { minigameStageOf } from './plan.ts';
import { useMinigameModule } from './useMinigameModule.ts';

interface LocalMinigameFlowProps {
  readonly id: string;
  readonly players: number;
  readonly seed: number;
  readonly test: boolean;
  /** Als Wiederholung in der Partie zeigen: kurze Anleitung (`&repeat=1`, CHAOS-66). */
  readonly repeat?: boolean;
  /**
   * Anleitung zeigt Bereitschaft wie beim Server (`&ready=1,3&offline=4`, CHAOS-214); lokal
   * drückt niemand „Bereit“, weiter geht es wie sonst nach der Anleitungszeit bzw. `next()`.
   */
  readonly readiness?: LocalReadiness | null;
}

export function LocalMinigameFlow({
  id,
  players,
  seed,
  test,
  repeat = false,
  readiness = null,
}: LocalMinigameFlowProps) {
  const module = useMinigameModule(id);
  const [state, setState] = useState<LocalFlowState & { readonly receivedAt: number }>(() => ({
    view: localView(module?.info ?? { id, durationMs: 5_000 }, 'intro', {
      players,
      seed,
      repeat,
      readiness,
    }),
    rewards: null,
    receivedAt: performance.now(),
  }));
  const [ready, setReady] = useState(false);
  const stage = minigameStageOf(state.view);

  const toPlay = useCallback(() => {
    if (!module) return;
    setState((current) =>
      minigameStageOf(current.view) === 'intro'
        ? {
            view: localView(module.info, 'play', { players, seed, repeat }),
            rewards: null,
            receivedAt: performance.now(),
          }
        : current,
    );
  }, [module, players, seed, repeat]);

  const onResult = useCallback(
    (result: MinigameResultPayload) => {
      if (!module) return;
      setState({
        view: localView(module.info, 'results', { players, seed, result, repeat }),
        rewards: localRewards(result),
        receivedAt: performance.now(),
      });
    },
    [module, players, seed, repeat],
  );

  useEffect(() => {
    if (test || stage !== 'intro') return;
    const timer = setTimeout(toPlay, repeat ? LOCAL_REPEAT_INTRO_MS : LOCAL_INTRO_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [test, stage, toPlay, repeat]);

  if (!module) {
    return (
      <main className="host" data-scene="error">
        <p className="minigame-preview-error">Unbekanntes Minispiel: {id}</p>
      </main>
    );
  }
  return (
    <main
      className="host"
      data-mode="local"
      data-phase="board"
      data-scene={ready ? 'ready' : 'loading'}
      data-minigame={id}
    >
      <MinigameScreen
        view={state.view}
        receivedAt={state.receivedAt}
        rewards={state.rewards}
        module={module}
        connection={null}
        test={test}
        hub={null}
        onResult={onResult}
        onReady={setReady}
        onNext={toPlay}
        lightByRound={false}
        serverDeadline={false}
      />
    </main>
  );
}
