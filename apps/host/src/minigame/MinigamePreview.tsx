/**
 * Lokale Minispiel-Vorschau (`/host/?local=1&minigame=<id>&players=4`, M3): ein Minispiel ohne
 * Server mit Tastatur-Spielern. Grundgerüst des Koordinators, damit Minispiele früh sichtbar
 * sind; die echte Minispiel-Bühne im Spielablauf (Anleitung, Ergebnis, Server) baut darauf auf.
 *
 * Testmodus (`&test=1`): keine Render-Schleife, `window.__chaosMinigame` steuert Schritte.
 * Den ganzen Ablauf mit Anleitung und Ergebnis zeigt `&flow=1` (`LocalMinigameFlow`).
 */
import { Engine } from '@babylonjs/core/Engines/engine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { Color4 } from '@babylonjs/core/Maths/math.color.js';
import {
  createMinigameRunner,
  type MinigameHud,
  type MinigameRunner,
} from '@chaos-party/minigame-sdk/babylon';
import { PLAYER_SLOTS } from '@chaos-party/protocol';
import { useEffect, useRef, useState } from 'react';
import { loadCharacters } from '../characters/index.ts';
import { soundEngine } from '../fx/audio.ts';
import { createMinigameFx } from '../fx/minigameFx.ts';
import { createAdaptiveQuality } from '../nature/quality.ts';
import { applyRenderScale, currentLookSettings } from '../nature/settings.ts';
import type { NatureLook } from '../nature/lighting.ts';
import { loadHavok } from '../scene/havok.ts';
import { createMinigameLook, SOFTWARE_MAX_STEPS } from './natureLook.ts';
import { MinigameKeyboard } from './keyboard.ts';
import { previewPlayers } from './players.ts';
import type { ChaosMinigameTestHook } from './testHook.ts';
import { useMinigameModule } from './useMinigameModule.ts';

interface PreviewProps {
  readonly id: string;
  readonly players: number;
  readonly seed: number;
  readonly test: boolean;
}

export function MinigamePreview({ id, players, seed, test }: PreviewProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [hud, setHud] = useState<MinigameHud | null>(null);
  const [status, setStatus] = useState<'loading' | 'running' | 'finished' | 'unknown'>('loading');
  const module = useMinigameModule(id);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !module) return;
    const canvas = document.createElement('canvas');
    canvas.className = 'game-canvas';
    canvas.setAttribute('aria-label', `Minispiel ${module.info.title}`);
    stage.appendChild(canvas);
    const engine = new Engine(canvas, true, { preserveDrawingBuffer: test, stencil: true });
    const scene = new Scene(engine);
    scene.clearColor = new Color4(0.98, 0.93, 0.82, 1);
    // Testmodus: Figuren-Animationen laufen je Bild um feste 16 ms (stabile Screenshots).
    scene.useConstantAnimationDeltaTime = test;
    // Klänge/Partikel/Wackeln (CHAOS-33); im Testmodus nur gezählt.
    const fx = createMinigameFx(scene, { sound: soundEngine(), testMode: test });
    // Natur-Look wie im Spiel (CHAOS-62): Kulisse, Licht, Grafikstufe.
    const settings = currentLookSettings(test, 'wackelwald', engine.getGlInfo().renderer);
    applyRenderScale(engine, settings);
    const look = createMinigameLook(scene, settings);
    const adaptive = createAdaptiveQuality(settings.quality, settings.automatic);
    let lighting: NatureLook | null = null;
    const life = { active: true };
    const isActive = () => life.active;
    let runner: MinigameRunner | null = null;
    let disposeLibrary: (() => void) | null = null;
    const keyboard = new MinigameKeyboard();

    const onKey = (event: KeyboardEvent, pressed: boolean) => {
      for (const { slot, input } of keyboard.key(event.code, pressed)) runner?.input(slot, input);
    };
    const down = (event: KeyboardEvent) => {
      onKey(event, true);
    };
    const up = (event: KeyboardEvent) => {
      onKey(event, false);
    };
    const blur = () => {
      for (const { slot, input } of keyboard.releaseAll()) runner?.input(slot, input);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    const resize = () => {
      // Erst resize(): Babylon rechnet einen DPR-Wechsel in die Skalierung ein, danach die Grenze.
      engine.resize();
      applyRenderScale(engine, settings, adaptive.level);
    };
    window.addEventListener('resize', resize);

    const hook: ChaosMinigameTestHook = {
      ready: false,
      id,
      get state() {
        return runner?.state ?? 'created';
      },
      get elapsedMs() {
        return runner?.elapsedMs ?? 0;
      },
      get result() {
        return runner?.result?.result ?? null;
      },
      step: (frames: number) => {
        for (let index = 0; index < frames; index++) {
          if (runner?.state === 'running') runner.step(1);
        }
        scene.render();
        if (runner) setHud(runner.hud());
      },
      input: (slot, input) => {
        runner?.input(slot, input);
      },
      hud: () => runner?.hud() ?? null,
    };
    if (test) window.__chaosMinigame = hook;

    void (async () => {
      const library = await loadCharacters(scene, { keepPbr: true });
      disposeLibrary = () => {
        library.dispose();
      };
      const havok = module.info.physics ? await loadHavok() : null;
      if (!isActive()) return;
      runner = createMinigameRunner(module, {
        scene,
        players: previewPlayers(players),
        seed,
        fx,
        characters: {
          create(target, player) {
            const handle = library.create(target, player);
            look.addCaster(handle.shadowCaster);
            return handle;
          },
        },
        havok,
        testMode: test,
        look,
        ...(settings.software ? { maxStepsPerAdvance: SOFTWARE_MAX_STEPS } : {}),
        onResult: () => {
          setStatus('finished');
        },
      });
      await runner.prepare();
      if (!isActive()) return;
      if (scene.activeCamera) lighting = await look.finish(scene.activeCamera);
      if (!isActive()) return;
      runner.start();
      setStatus('running');
      // Erst melden, wenn alle Shader fertig sind (sonst sind frühe Screenshots leer).
      await scene.whenReadyAsync();
      if (!isActive()) return;
      scene.render();
      hook.ready = true;
      if (test) return;
      let last = performance.now();
      let hudAt = 0;
      let seconds = 0;
      engine.runRenderLoop(() => {
        const now = performance.now();
        const next = adaptive.frame(now - last);
        if (next) {
          lighting?.setQuality(next);
          applyRenderScale(engine, settings, next);
        }
        runner?.advance((now - last) / 1000);
        seconds += (now - last) / 1000;
        look.update(seconds);
        last = now;
        scene.render();
        if (runner && now - hudAt > 100) {
          hudAt = now;
          setHud(runner.hud());
        }
      });
    })().catch((error: unknown) => {
      console.error('Minispiel-Vorschau fehlgeschlagen', error);
    });

    return () => {
      life.active = false;
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      window.removeEventListener('resize', resize);
      engine.stopRenderLoop();
      runner?.dispose();
      fx.dispose();
      disposeLibrary?.();
      scene.dispose();
      engine.dispose();
      canvas.remove();
      if (window.__chaosMinigame === hook) delete window.__chaosMinigame;
    };
  }, [id, module, players, seed, test]);

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
      data-scene={status === 'loading' ? 'loading' : 'ready'}
      data-minigame={id}
    >
      <div className="stage" ref={stageRef} />
      <aside className="minigame-preview-hud" aria-label="Punkte">
        <strong>{module.info.title}</strong>
        <span> · {Math.ceil((hud?.remainingMs ?? module.info.durationMs) / 1000)} s</span>
        {hud?.banner && <span> · {hud.banner}</span>}
        <ul>
          {(hud?.scores ?? []).map((entry) => (
            <li key={entry.slot} style={{ color: PLAYER_SLOTS[entry.slot].color }}>
              {PLAYER_SLOTS[entry.slot].symbol} {PLAYER_SLOTS[entry.slot].label}: {entry.score}{' '}
              {entry.status ?? ''}
            </li>
          ))}
        </ul>
        {status === 'finished' && <p>Fertig!</p>}
      </aside>
    </main>
  );
}
