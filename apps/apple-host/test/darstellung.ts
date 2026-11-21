/**
 * Darstellungs-Vertrag für den Apple-Host (CHAOS-154, README §5.3 Punkt 7, ADR-019 Nachtrag 5).
 *
 * Seit CHAOS-144 zeichnet Swift ein Minispiel aus dem, was die Headless-Bühne exportiert:
 * Körper (`bodies()`) mit echter Geometrie (`takeGeometry()`), Figuren als USDZ, Kamera, Kulisse
 * und Effekte. Ein neues Spiel braucht dafür keinen Swift-Code, solange alles Sichtbare durch
 * diesen Pfad geht. `checkDarstellung` spielt ein Minispiel genau so, wie der Apple-Host es
 * tut, und nennt alles, was Swift falsch oder gar nicht zeigen würde:
 *
 * - **Rolle ohne Darstellung:** ein gekennzeichneter Körper (`markVisual`), für den keine
 *   Geometrie ankommt. Swift zeichnete dann nur eine Grundform (Kugel, Quader, Zylinder).
 * - **Kulisse ohne Darstellung:** dasselbe für ungekennzeichnete Körper.
 * - **Bewegt ohne Rolle:** ein ungekennzeichneter Körper, der sich im Spiel bewegt, dreht,
 *   skaliert, auftaucht oder verschwindet. Ungekennzeichnetes gilt als Kulisse, die ein nativer
 *   Host als Ganzes ersetzen darf (`markVisual`, CHAOS-149); was sich bewegt, braucht eine Rolle.
 * - **Außerhalb des Exports:** Partikelsysteme, Sprites, GUI-Ebenen, Linien-Meshes und
 *   Texturen. Swift überträgt nur Dreiecke, Farbe und Oberfläche; all das fehlte im Apple-Host.
 *
 * Gespielt wird mit festen Eingaben (Stick kreist, A und B im Wechsel), so dass sich in jedem
 * Spiel etwas bewegt. Figuren (`figur`) zeigt Swift als USDZ; sie sind nicht in `bodies()`.
 */
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh.js';
import type { MinigameModule, MinigamePlayer } from '@chaos-party/minigame-sdk/babylon';
import { loadHavokForNode } from '@chaos-party/minigame-sdk/testing';
import type { Body } from '../src/contract.ts';
import { createHeadlessStage } from '../src/stage.ts';

export const CONTRACT_PLAYERS: readonly MinigamePlayer[] = [
  { slot: 1, name: 'Anna', color: '#0072B2', symbol: '●', character: 'raccoon' },
  { slot: 2, name: 'Ben', color: '#E69F00', symbol: '▲', character: 'sock' },
  { slot: 3, name: 'Cem', color: '#009E73', symbol: '■', character: 'robot' },
  { slot: 4, name: 'Dora', color: '#CC79A7', symbol: '★', character: 'cactus' },
];

export interface DarstellungsBefund {
  readonly id: string;
  /** Gekennzeichnete Rollen, für die mindestens ein Körper ohne Geometrie blieb. */
  readonly rolesWithoutMesh: readonly string[];
  /** Ungekennzeichnete Körper ohne Geometrie (Mesh-Namen ohne Nummer). */
  readonly sceneryWithoutMesh: readonly string[];
  /** Ungekennzeichnete Körper, die sich im Spiel verändert haben (Mesh-Namen ohne Nummer). */
  readonly unmarkedMovers: readonly string[];
  /** Sichtbares außerhalb des Exports (Art und Name). */
  readonly foreign: readonly string[];
  /** Alle Rollen, die im Spiel als Körper vorkamen. */
  readonly roles: readonly string[];
  /** Zahl der geprüften Körper (über alle Stichproben, ohne Doppelte). */
  readonly bodyCount: number;
  /** Fehler aus Aufbau oder Spiel (`log`). */
  readonly logs: readonly string[];
}

export interface DarstellungsOptionen {
  /** Gespielte Sekunden (Standard 8). */
  readonly seconds?: number;
  readonly seed?: number;
  /** Standard: so viele wie `info.maxPlayers` erlaubt, höchstens vier. */
  readonly players?: readonly MinigamePlayer[];
}

/** Abstand zweier Stichproben in Schritten (1/60 s). */
const SAMPLE_EVERY = 6;

/** Mesh-Name ohne `#uniqueId` und ohne laufende Nummern („socken-socke-12“ → „socken-socke-#“). */
export function bodyName(id: string): string {
  const name = id.slice(0, id.lastIndexOf('#'));
  return name.replace(/-\d+(?=-|$)/g, '-#');
}

/** Spielt `module` im Apple-Host-Pfad und liefert alle Verstöße gegen den Darstellungs-Vertrag. */
export async function checkDarstellung(
  module: MinigameModule,
  options: DarstellungsOptionen = {},
): Promise<DarstellungsBefund> {
  const info = module.info;
  const players = options.players ?? CONTRACT_PLAYERS.slice(0, Math.min(4, info.maxPlayers ?? 4));
  const seconds = options.seconds ?? 8;
  const logs: string[] = [];
  const stage = createHeadlessStage({
    module,
    players,
    seed: options.seed ?? 7,
    timeLimitMs: Math.max(20_000, (seconds + 5) * 1000),
    havok: info.physics ? await loadHavokForNode() : null,
    onResult: () => undefined,
    log: (line) => logs.push(line),
  });
  for (let index = 0; index < 200 && !stage.ready; index++) {
    await new Promise((resolve) => setImmediate(resolve));
  }
  if (!stage.ready) {
    stage.dispose();
    return {
      id: info.id,
      rolesWithoutMesh: [],
      sceneryWithoutMesh: [],
      unmarkedMovers: [],
      foreign: ['Aufbau nicht fertig'],
      roles: [],
      bodyCount: 0,
      logs,
    };
  }
  stage.start();

  /** Letzter Stand je ungekennzeichnetem Körper (Lage, Drehung, Größe). */
  const scenery = new Map<string, string>();
  const unmarkedMovers = new Set<string>();
  const seen = new Map<string, Body>();
  let firstSample = true;
  const sample = () => {
    const bodies = stage.bodies();
    const present = new Set<string>();
    for (const body of bodies) {
      present.add(body.id);
      seen.set(body.id, body);
      if (body.role !== undefined) continue;
      const pose = JSON.stringify([body.pos, body.rot, body.size]);
      const before = scenery.get(body.id);
      if (before === undefined) {
        // Erst im Spiel aufgetaucht: Das ist Bewegung.
        if (!firstSample) unmarkedMovers.add(bodyName(body.id));
      } else if (before !== pose) {
        unmarkedMovers.add(bodyName(body.id));
      }
      scenery.set(body.id, pose);
    }
    // Verschwunden (ausgeblendet oder entsorgt): ebenfalls Bewegung.
    for (const id of scenery.keys()) {
      if (!present.has(id)) {
        unmarkedMovers.add(bodyName(id));
        scenery.delete(id);
      }
    }
    firstSample = false;
  };

  sample();
  const steps = Math.round(seconds * 60);
  for (let step = 0; step < steps; step++) {
    for (const player of players) {
      const angle = step / 30 + player.slot * 1.7;
      stage.runner.input(player.slot, { type: 'move', x: Math.cos(angle), y: Math.sin(angle) });
      if (step % 45 === player.slot * 5) {
        stage.runner.input(player.slot, { type: 'press', button: step % 90 < 45 ? 'a' : 'b' });
      }
      if (step % 45 === player.slot * 5 + 8) {
        stage.runner.input(player.slot, { type: 'release', button: 'a' });
        stage.runner.input(player.slot, { type: 'release', button: 'b' });
      }
    }
    stage.advance(1 / 60);
    if (step % SAMPLE_EVERY === 0) sample();
  }

  // Geometrie wie Swift abholen (auch die der erst im Spiel gelesenen Meshes), dann den
  // Endstand mit Geometrie-Verweisen ansehen.
  stage.takeGeometry(Number.POSITIVE_INFINITY);
  stage.bodies();
  stage.takeGeometry(Number.POSITIVE_INFINITY);
  const meshById = new Map<string, string | undefined>();
  for (const body of stage.bodies()) meshById.set(body.id, body.mesh);

  const rolesWithoutMesh = new Set<string>();
  const sceneryWithoutMesh = new Set<string>();
  const roles = new Set<string>();
  for (const [id, body] of seen) {
    if (body.role !== undefined) roles.add(body.role);
    // Nur Körper, die am Ende noch da sind, haben eine abgeholte Geometrie zu prüfen; was
    // vorher verschwand, prüft `meshKnown` über den Geometrie-Katalog der Bühne.
    const mesh = meshById.has(id) ? meshById.get(id) : body.mesh;
    if (mesh !== undefined) continue;
    if (meshById.has(id) || !meshKnown(stage.scene.meshes, id)) {
      if (body.role !== undefined) rolesWithoutMesh.add(body.role);
      else sceneryWithoutMesh.add(bodyName(id));
    }
  }

  const foreign = foreignVisuals(stage.scene);
  stage.dispose();
  return {
    id: info.id,
    rolesWithoutMesh: [...rolesWithoutMesh].sort(),
    sceneryWithoutMesh: [...sceneryWithoutMesh].sort(),
    unmarkedMovers: [...unmarkedMovers].sort(),
    foreign,
    roles: [...roles].sort(),
    bodyCount: seen.size,
    logs,
  };
}

/**
 * Verschwundener Körper: Hat sein Mesh noch Dreiecke, hätte die Bühne Geometrie gelesen, sobald
 * er wieder auftaucht. Entsorgte Meshes zählen nicht.
 */
function meshKnown(meshes: readonly AbstractMesh[], id: string): boolean {
  const uniqueId = Number(id.slice(id.lastIndexOf('#') + 1));
  const mesh = meshes.find((candidate) => candidate.uniqueId === uniqueId);
  return !mesh || mesh.getTotalVertices() > 0;
}

interface SceneLike {
  readonly meshes: readonly AbstractMesh[];
  readonly particleSystems: readonly { readonly name: string }[];
  readonly spriteManagers?: readonly { readonly name: string }[] | null;
  readonly layers: readonly { readonly name: string }[];
}

/** Sichtbares, das am Export vorbeigeht (Swift sähe es nie). */
export function foreignVisuals(scene: SceneLike): string[] {
  const out = new Set<string>();
  for (const system of scene.particleSystems) out.add(`Partikel: ${system.name}`);
  for (const manager of scene.spriteManagers ?? []) out.add(`Sprites: ${manager.name}`);
  for (const layer of scene.layers) out.add(`Ebene (GUI/Bild): ${layer.name}`);
  for (const mesh of scene.meshes) {
    const name = bodyName(`${mesh.name}#${String(mesh.uniqueId)}`);
    if (mesh.getClassName() === 'LinesMesh' || mesh.getClassName() === 'GreasedLineMesh') {
      out.add(`Linien: ${name}`);
    }
    const textures = mesh.material?.getActiveTextures() ?? [];
    if (textures.length > 0) out.add(`Textur: ${name}`);
  }
  return [...out].sort();
}
