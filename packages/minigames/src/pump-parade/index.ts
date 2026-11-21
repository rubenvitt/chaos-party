/**
 * Pump-Parade – Referenz-Minispiel für den Vertrag (CHAOS-26). Zeigt das Muster, dem alle
 * Minispiele folgen: alles in `prepare` in der übergebenen Szene anlegen und merken,
 * Zeit nur über `update`, Ergebnis über `rankByScore`, in `dispose` alles wegräumen.
 */
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera.js';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder.js';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder.js';
import type { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import {
  rankByScore,
  type MinigameInput,
  type MinigameResult,
  type Slot,
} from '@chaos-party/minigame-sdk';
import type {
  CharacterHandle,
  Minigame,
  MinigameContext,
  MinigameHud,
  MinigameModule,
} from '@chaos-party/minigame-sdk/babylon';
import { markVisual } from '@chaos-party/minigame-sdk/babylon';
import { PUMP_PARADE_INFO } from './info.ts';

interface Pumper {
  readonly slot: Slot;
  readonly character: CharacterHandle;
  readonly balloon: Mesh;
  score: number;
}

class PumpParade implements Minigame {
  private ctx: MinigameContext | null = null;
  private readonly pumpers = new Map<Slot, Pumper>();
  private readonly disposables: { dispose(): void }[] = [];
  private elapsedMs = 0;
  private running = false;
  private result: MinigameResult | null = null;

  async prepare(ctx: MinigameContext): Promise<void> {
    this.ctx = ctx;
    const { scene } = ctx;
    const camera = new ArcRotateCamera(
      'pump-kamera',
      -Math.PI / 2,
      1.1,
      11,
      new Vector3(0, 1.5, 0),
      scene,
    );
    scene.activeCamera = camera;
    this.disposables.push(camera);
    if (ctx.look) {
      // Natur-Look (CHAOS-62): Wiese und Licht vom Host.
      ctx.look.backdrop({ halfX: 7, halfZ: 3, groundY: -0.02 });
    } else {
      const light = new HemisphericLight('pump-licht', new Vector3(0.3, 1, -0.4), scene);
      const ground = CreateGround('pump-boden', { width: 14, height: 6 }, scene);
      const groundMaterial = new StandardMaterial('pump-boden-material', scene);
      groundMaterial.diffuseColor = Color3.FromHexString('#f6d68b');
      ground.material = groundMaterial;
      this.disposables.push(light, groundMaterial, ground);
    }

    const count = ctx.players.length;
    for (const [index, player] of ctx.players.entries()) {
      // Aufbau je Spieler in einem eigenen Schritt (CHAOS-141).
      await ctx.pace();
      const x = (index - (count - 1) / 2) * 3;
      const character = ctx.characters.create(scene, player);
      character.root.position.set(x, 0, 0);
      character.play('idle');
      // Ohne JIT kostet eine Kugel mit Standard-Segmenten gut 10 ms: eigener Schritt, weniger Segmente (CHAOS-209).
      await ctx.pace();
      // Rolle für native Hosts (CHAOS-154): Der Ballon wächst im Spiel.
      const balloon = markVisual(
        CreateSphere(`pump-ballon-${player.slot}`, { diameter: 1, segments: 20 }, scene),
        'ballon',
        player.slot,
      );
      balloon.position.set(x, 2.6, 0);
      const material =
        ctx.look?.material(player.color, { finish: 'glanz' }) ??
        new StandardMaterial(`pump-ballon-material-${player.slot}`, scene);
      if (material instanceof StandardMaterial) {
        material.diffuseColor = Color3.FromHexString(player.color);
      }
      balloon.material = material;
      this.disposables.push(material, balloon);
      this.pumpers.set(player.slot, { slot: player.slot, character, balloon, score: 0 });
    }
  }

  start(): void {
    this.running = true;
    this.ctx?.fx.sound('go');
  }

  handleInput(slot: Slot, input: MinigameInput): void {
    if (!this.running || input.type !== 'press' || input.button !== 'a') return;
    const pumper = this.pumpers.get(slot);
    if (!pumper) return;
    pumper.score += 1;
    pumper.balloon.scaling.setAll(1 + pumper.score * 0.04);
    this.ctx?.fx.sound('pop', { pitch: 1 + pumper.score * 0.01 });
  }

  update(dtSeconds: number): void {
    if (!this.running || !this.ctx) return;
    this.elapsedMs += dtSeconds * 1000;
    if (this.elapsedMs < this.ctx.timeLimitMs) return;
    this.running = false;
    const placements = rankByScore(
      [...this.pumpers.values()].map((pumper) => ({ slot: pumper.slot, score: pumper.score })),
      PUMP_PARADE_INFO.scoring,
    );
    for (const placement of placements) {
      this.pumpers.get(placement.slot)?.character.play(placement.place === 1 ? 'cheer' : 'sad');
    }
    this.ctx.fx.sound('win');
    this.result = { minigameId: PUMP_PARADE_INFO.id, placements };
  }

  getResult(): MinigameResult | null {
    return this.result;
  }

  getHud(): MinigameHud {
    const limit = this.ctx?.timeLimitMs ?? PUMP_PARADE_INFO.durationMs;
    return {
      remainingMs: Math.max(0, Math.round(limit - this.elapsedMs)),
      scores: [...this.pumpers.values()].map((pumper) => ({
        slot: pumper.slot,
        score: pumper.score,
      })),
    };
  }

  dispose(): void {
    for (const pumper of this.pumpers.values()) pumper.character.dispose();
    this.pumpers.clear();
    for (const item of this.disposables.splice(0)) item.dispose();
    this.running = false;
  }
}

export const pumpParade: MinigameModule = {
  info: PUMP_PARADE_INFO,
  create: () => new PumpParade(),
};
