/**
 * Team-Pumpen – gemeinsame Logik der drei Testspiele für die Spielformen (CHAOS-89):
 * Pump-Duell (2 gegen 2), Pump-Solo (1 gegen 3) und Riesenballon (Koop). Pump-Parade-Niveau:
 * A tippen, ein Ballon je Team wächst. Zeigt das Muster für Team-Minispiele: Aufstellung aus
 * `ctx.teams` lesen (nie selbst einteilen), Einzelpunkte für die Anzeige, Ausgang im Ergebnis.
 *
 * - Teams: Teamwert = Summe der Pumpstöße × Gewicht. Die Einzelperson zählt so viel wie ihre
 *   Gegner zusammen (1 gegen 3: ×3), zu dritt mit Vorteil noch ein Viertel mehr.
 * - Koop: ein Riesenballon für alle; die Stufe ergibt sich aus allen Pumpstößen zusammen, die
 *   Plätze aus den eigenen.
 * - Ohne `ctx.teams` (Vorschau): jeder gegen jeden wie die Pump-Parade.
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
  KOOP_MAX_TIER,
  rankByScore,
  TEAM_MARKS,
  teamPlacements,
  type MinigameInfo,
  type MinigameInput,
  type MinigameResult,
  type MinigameTeams,
  type Slot,
} from '@chaos-party/minigame-sdk';
import type {
  CharacterHandle,
  Minigame,
  MinigameContext,
  MinigameHud,
} from '@chaos-party/minigame-sdk/babylon';

/** Koop: so viele Pumpstöße je Person füllen den Riesenballon ganz (Stufe 3). */
export const KOOP_PUMPS_PER_PLAYER = 30;
/** Anteile des vollen Ballons für Stufe 1, 2 und 3. */
export const KOOP_TIER_SHARES = [0.4, 0.7, 1] as const;
/** Vorteil der Einzelperson zu dritt (1 gegen 2), zusätzlich zum Ausgleich der Teamgröße. */
export const SOLO_ADVANTAGE = 1.25;

/** Gewicht eines Pumpstoßes je Team: Einzelperson zählt wie ihre Gegner zusammen. */
export function teamWeights(teams: MinigameTeams): number[] {
  const sizes = teams.teams.map((team) => team.length);
  const largest = Math.max(...sizes);
  return sizes.map((size) => {
    const weight = largest / size;
    return size === 1 && teams.soloAdvantage ? weight * SOLO_ADVANTAGE : weight;
  });
}

/** Koop-Stufe aus allen Pumpstößen zusammen. */
export function koopTier(total: number, players: number): number {
  const share = total / (players * KOOP_PUMPS_PER_PLAYER);
  return KOOP_TIER_SHARES.filter((needed) => share >= needed).length;
}

interface Pumper {
  readonly slot: Slot;
  readonly character: CharacterHandle;
  score: number;
}

interface Balloon {
  readonly mesh: Mesh;
  readonly slots: readonly Slot[];
  readonly weight: number;
}

class TeamPump implements Minigame {
  private ctx: MinigameContext | null = null;
  private teams: MinigameTeams | null = null;
  private readonly pumpers = new Map<Slot, Pumper>();
  private balloons: Balloon[] = [];
  private readonly disposables: { dispose(): void }[] = [];
  private elapsedMs = 0;
  private running = false;
  private result: MinigameResult | null = null;

  constructor(private readonly info: MinigameInfo) {}

  async prepare(ctx: MinigameContext): Promise<void> {
    this.ctx = ctx;
    this.teams = ctx.teams ?? null;
    const { scene } = ctx;
    const camera = new ArcRotateCamera(
      `${this.info.id}-kamera`,
      -Math.PI / 2,
      1.1,
      12,
      new Vector3(0, 1.8, 0),
      scene,
    );
    scene.activeCamera = camera;
    this.disposables.push(camera);
    if (ctx.look) {
      ctx.look.backdrop({ halfX: 7, halfZ: 3, groundY: -0.02 });
    } else {
      const light = new HemisphericLight(`${this.info.id}-licht`, new Vector3(0.3, 1, -0.4), scene);
      const ground = CreateGround(`${this.info.id}-boden`, { width: 14, height: 6 }, scene);
      const groundMaterial = new StandardMaterial(`${this.info.id}-boden-material`, scene);
      groundMaterial.diffuseColor = Color3.FromHexString('#f6d68b');
      ground.material = groundMaterial;
      this.disposables.push(light, groundMaterial, ground);
    }

    // Gruppen: Teams nebeneinander, bei Koop alle unter einem Ballon, ohne Teams je Person einer.
    const teams = this.teams;
    const weights = teams && teams.layout !== 'koop' ? teamWeights(teams) : [];
    const groups: { slots: readonly Slot[]; color: string; weight: number }[] = teams
      ? teams.teams.map((slots, index) => ({
          slots,
          color: teams.layout === 'koop' ? '#e85d75' : (TEAM_MARKS[index]?.color ?? '#999999'),
          weight: weights[index] ?? 1,
        }))
      : ctx.players.map((player) => ({ slots: [player.slot], color: player.color, weight: 1 }));

    const spacing = 1.6;
    const groupGap = 1.6;
    const width =
      groups.reduce((sum, group) => sum + group.slots.length * spacing, 0) +
      groupGap * (groups.length - 1);
    let x = -width / 2;
    for (const [index, group] of groups.entries()) {
      const groupStart = x;
      for (const slot of group.slots) {
        await ctx.pace();
        const player = ctx.players.find((candidate) => candidate.slot === slot);
        if (!player) continue;
        const character = ctx.characters.create(scene, player);
        character.root.position.set(x + spacing / 2, 0, 0);
        character.play('idle');
        this.pumpers.set(slot, { slot, character, score: 0 });
        x += spacing;
      }
      await ctx.pace();
      const balloon = CreateSphere(
        `${this.info.id}-ballon-${String(index)}`,
        { diameter: 1, segments: 20 },
        scene,
      );
      balloon.position.set((groupStart + x) / 2, 2.8, 0);
      const material =
        ctx.look?.material(group.color, { finish: 'glanz' }) ??
        new StandardMaterial(`${this.info.id}-ballon-material-${String(index)}`, scene);
      if (material instanceof StandardMaterial) {
        material.diffuseColor = Color3.FromHexString(group.color);
      }
      balloon.material = material;
      this.disposables.push(material, balloon);
      this.balloons.push({ mesh: balloon, slots: group.slots, weight: group.weight });
      x += groupGap;
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
    const balloon = this.balloons.find((candidate) => candidate.slots.includes(slot));
    if (balloon) {
      const size = this.groupValue(balloon) / Math.max(1, balloon.slots.length);
      balloon.mesh.scaling.setAll(1 + size * 0.04);
    }
    this.ctx?.fx.sound('pop', { pitch: 1 + pumper.score * 0.01 });
  }

  private groupValue(balloon: Balloon): number {
    const pumps = balloon.slots.reduce(
      (sum, slot) => sum + (this.pumpers.get(slot)?.score ?? 0),
      0,
    );
    return pumps * balloon.weight;
  }

  update(dtSeconds: number): void {
    if (!this.running || !this.ctx) return;
    this.elapsedMs += dtSeconds * 1000;
    if (this.elapsedMs < this.ctx.timeLimitMs) return;
    this.running = false;
    this.result = this.score();
    for (const placement of this.result.placements) {
      this.pumpers.get(placement.slot)?.character.play(placement.place === 1 ? 'cheer' : 'sad');
    }
    this.ctx.fx.sound('win');
  }

  private score(): MinigameResult {
    const scores = [...this.pumpers.values()].map((pumper) => ({
      slot: pumper.slot,
      score: pumper.score,
    }));
    const teams = this.teams;
    if (!teams) {
      return { minigameId: this.info.id, placements: rankByScore(scores, this.info.scoring) };
    }
    if (teams.layout === 'koop') {
      const total = scores.reduce((sum, entry) => sum + entry.score, 0);
      const tier = Math.min(KOOP_MAX_TIER, koopTier(total, scores.length));
      return {
        minigameId: this.info.id,
        placements: rankByScore(scores, this.info.scoring),
        outcome: { kind: 'koop', tier },
      };
    }
    // Gleichstand der Teamwerte (auf Zehntel) = Unentschieden.
    const values = this.balloons.map((balloon) => Math.round(this.groupValue(balloon) * 10));
    const [a = 0, b = 0] = values;
    const winner = a === b ? null : a > b ? 0 : 1;
    return {
      minigameId: this.info.id,
      placements: teamPlacements(teams, winner, scores, this.info.scoring),
      outcome: { kind: 'teams', winner },
    };
  }

  getResult(): MinigameResult | null {
    return this.result;
  }

  getHud(): MinigameHud {
    const limit = this.ctx?.timeLimitMs ?? this.info.durationMs;
    const teams = this.teams;
    const statusOf = (slot: Slot): string | undefined => {
      if (!teams || teams.layout === 'koop') return undefined;
      const index = teams.teams.findIndex((team) => team.includes(slot));
      return TEAM_MARKS[index]?.symbol;
    };
    const koopTotal =
      teams?.layout === 'koop'
        ? [...this.pumpers.values()].reduce((sum, pumper) => sum + pumper.score, 0)
        : null;
    return {
      remainingMs: Math.max(0, Math.round(limit - this.elapsedMs)),
      scores: [...this.pumpers.values()].map((pumper) => {
        const status = statusOf(pumper.slot);
        return { slot: pumper.slot, score: pumper.score, ...(status ? { status } : {}) };
      }),
      ...(koopTotal === null
        ? {}
        : { banner: `Stufe ${String(koopTier(koopTotal, this.pumpers.size))} von 3` }),
    };
  }

  dispose(): void {
    for (const pumper of this.pumpers.values()) pumper.character.dispose();
    this.pumpers.clear();
    this.balloons = [];
    for (const item of this.disposables.splice(0)) item.dispose();
    this.running = false;
  }
}

export function createTeamPump(info: MinigameInfo): () => Minigame {
  return () => new TeamPump(info);
}
