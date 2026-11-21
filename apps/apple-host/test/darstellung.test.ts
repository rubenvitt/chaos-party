/**
 * Darstellungs-Vertrag aller Minispiele im Apple-Host (CHAOS-154, README §5.3 Punkt 7).
 *
 * Jedes registrierte Minispiel, nicht nur die Rotation, läuft durch denselben Pfad wie in der
 * Mac- und Apple-TV-App (`createHeadlessStage`). Es darf nichts zeigen, was Swift nicht oder
 * nur als Grundform zeichnen kann, und was sich bewegt, braucht eine Rolle (`markVisual`).
 * Ein neues Minispiel in `MINIGAME_MODULES` ist damit ohne weiteres Zutun geprüft.
 * Prüffunktion und Regeln: `./darstellung.ts`.
 */
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder.js';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder.js';
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem.js';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import type { MinigameResult } from '@chaos-party/minigame-sdk';
import { markVisual, type Minigame, type MinigameModule } from '@chaos-party/minigame-sdk/babylon';
import { getMinigameInfo, MINIGAME_MODULES, ROTATION } from '@chaos-party/minigames';
import { describe, expect, it } from 'vitest';
import { bodyName, checkDarstellung } from './darstellung.ts';

describe('Darstellungs-Vertrag im Apple-Host (CHAOS-154)', () => {
  it('prüft jedes Minispiel der Rotation mit', () => {
    const ids = MINIGAME_MODULES.map((module) => module.info.id);
    for (const id of ROTATION) expect(ids).toContain(id);
  });

  it.each(MINIGAME_MODULES.map((module) => [module.info.id, module] as const))(
    '%s: Rollen mit Geometrie, Bewegtes gekennzeichnet, nichts am Export vorbei',
    async (_id, module) => {
      const befund = await checkDarstellung(module);
      expect(befund.logs).toEqual([]);
      expect(befund.bodyCount).toBeGreaterThan(0);
      expect(befund.rolesWithoutMesh, 'Rollen ohne Geometrie').toEqual([]);
      expect(befund.sceneryWithoutMesh, 'Kulisse ohne Geometrie').toEqual([]);
      expect(befund.unmarkedMovers, 'bewegt ohne Rolle (markVisual)').toEqual([]);
      expect(befund.foreign, 'außerhalb des Exports').toEqual([]);
      // Jedes Spiel hat etwas, das sich bewegt, also mindestens eine Rolle neben den Figuren.
      expect(befund.roles.length).toBeGreaterThan(0);
    },
  );
});

describe('Darstellungs-Vertrag: Prüffunktion', () => {
  it('kürzt Mesh-Namen auf ihre Art', () => {
    expect(bodyName('socken-socke-12#345')).toBe('socken-socke-#');
    expect(bodyName('kuckuck-tuer-3-rahmen#9')).toBe('kuckuck-tuer-#-rahmen');
    expect(bodyName('wackel-teller#1')).toBe('wackel-teller');
  });

  it('meldet nichts bei einem sauberen Spiel', async () => {
    const befund = await checkDarstellung(testModule('sauber'));
    expect(befund.logs).toEqual([]);
    expect(befund.roles).toEqual(['kugel']);
    expect(befund.rolesWithoutMesh).toEqual([]);
    expect(befund.sceneryWithoutMesh).toEqual([]);
    expect(befund.unmarkedMovers).toEqual([]);
    expect(befund.foreign).toEqual([]);
  });

  it('scheitert an Rolle ohne Darstellung, Bewegtem ohne Rolle und Partikeln', async () => {
    const befund = await checkDarstellung(testModule('kaputt'));
    expect(befund.logs).toEqual([]);
    expect(befund.rolesWithoutMesh).toEqual(['strich']);
    expect(befund.unmarkedMovers).toEqual(['test-kiste']);
    expect(befund.foreign).toEqual(['Partikel: test-funken']);
  });
});

/**
 * Kleinstes Minispiel für die Prüffunktion: eine Kiste als Kulisse und eine gekennzeichnete
 * Kugel, die kreist. `kaputt` lässt stattdessen die Kiste kreisen, legt eine Rolle ohne
 * zeichenbare Dreiecke an (zwei Eckpunkte) und ein Partikelsystem.
 */
function testModule(variant: 'sauber' | 'kaputt'): MinigameModule {
  const base = getMinigameInfo('hallo-baukasten');
  if (!base) throw new Error('hallo-baukasten fehlt');
  const info = { ...base, id: `test-${variant}`, physics: false };
  return {
    info,
    create(): Minigame {
      const owned: { dispose(): void }[] = [];
      let box: Mesh | null = null;
      let ball: Mesh | null = null;
      let elapsed = 0;
      let result: MinigameResult | null = null;
      return {
        prepare(ctx) {
          const camera = new ArcRotateCamera('test-kamera', 0, 1, 12, Vector3.Zero(), ctx.scene);
          ctx.scene.activeCamera = camera;
          box = CreateBox('test-kiste', { size: 1 }, ctx.scene);
          ball = markVisual(CreateSphere('test-kugel', { diameter: 1 }, ctx.scene), 'kugel');
          owned.push(camera, box, ball);
          if (variant === 'kaputt') {
            const line = markVisual(new Mesh('test-strich', ctx.scene), 'strich');
            const data = new VertexData();
            data.positions = [0, 0, 0, 1, 0, 0];
            data.indices = [0, 1, 0];
            data.applyToMesh(line);
            const sparks = new ParticleSystem('test-funken', 8, ctx.scene);
            owned.push(line, sparks);
          }
          return Promise.resolve();
        },
        start() {
          elapsed = 0;
        },
        handleInput() {
          // Keine Eingaben nötig.
        },
        update(dt) {
          elapsed += dt;
          const moving = variant === 'kaputt' ? box : ball;
          moving?.position.set(Math.cos(elapsed) * 3, 0.5, Math.sin(elapsed) * 3);
          if (elapsed > 30 && !result) {
            result = { minigameId: info.id, placements: [] };
          }
        },
        getResult: () => result,
        getHud: () => ({ remainingMs: Math.max(0, 30_000 - elapsed * 1000), scores: [] }),
        dispose() {
          for (const item of owned.splice(0)) item.dispose();
        },
      };
    },
  };
}
