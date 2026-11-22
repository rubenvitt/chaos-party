import type { Node } from '@babylonjs/core/node.js';
import { createMinigameRunner, visualOf } from '@chaos-party/minigame-sdk/babylon';
import {
  createHeadlessScene,
  createRecordingFx,
  createTestCharacters,
  loadHavokForNode,
  stepsFor,
  testPlayers,
} from '@chaos-party/minigame-sdk/testing';
import { describe, expect, it } from 'vitest';
import { ROTATION, getMinigameModule } from './index.ts';

/**
 * Darstellungs-Vertrag für native Hosts (CHAOS-149): Jedes Minispiel der Rotation kennzeichnet
 * seine beweglichen, logischen Objekte. Ein nativer Host zeichnet daraus Modelle statt
 * Grundkörper; Ungekennzeichnetes ist Kulisse.
 */
const EXPECTED: Record<string, readonly string[]> = {
  sockenregen: ['waschmaschine', 'seifenblase', 'fangring', 'abzeichen', 'sterne', 'socke'],
  'pudding-gerangel': ['pudding', 'loeffel', 'kirschfleck', 'kirsche', 'krone', 'spielerring'],
  wackelturm: ['turm', 'krone', 'toertchen', 'toertchen-guss', 'spielerring', 'haufen'],
  'kuckucks-klatsche': ['kuckucksuhr', 'zeiger', 'tuer', 'feder', 'kuckuck', 'klatsche', 'sterne'],
  'kruemel-kehraus': ['kruemel', 'spielerring', 'wimpel'],
  'toaster-timing': ['toaster', 'toast', 'abzeichen', 'sterne'],
  'nussregen-netz': [
    'eichhoernchen',
    'kescher',
    'stinkwolke',
    'eichel',
    'eichel-faul',
    'nussschatten',
    'abzeichen',
    'sterne',
  ],
  matschmaler: ['matsch', 'regenstreifen', 'regenwolke', 'abzeichen', 'sterne'],
  'rasensprenger-rodeo': [
    'rasensprenger',
    'duese',
    'wasserstrahl',
    'reichweite',
    'pfuetze',
    'spielerring',
    'abzeichen',
  ],
  'schnapp-den-kaese': ['mausefalle', 'buegel', 'kaese', 'pfote', 'abzeichen', 'sterne'],
};

/** Rollen aller Knoten der Szene nach ein paar Sekunden Spiel (mit laufenden Figuren). */
async function rolesAfter(id: string, seconds: number): Promise<Map<string, Set<string>>> {
  const module = getMinigameModule(id);
  if (!module) throw new Error(`unbekannt: ${id}`);
  const headless = createHeadlessScene();
  const runner = createMinigameRunner(module, {
    scene: headless.scene,
    players: testPlayers(4),
    seed: 7,
    fx: createRecordingFx(),
    characters: createTestCharacters(),
    havok: module.info.physics ? await loadHavokForNode() : null,
    testMode: true,
  });
  await runner.prepare();
  runner.start();
  for (let step = 0; step < stepsFor(seconds); step++) {
    for (const slot of [1, 2, 3, 4] as const) {
      runner.input(slot, { type: 'move', x: Math.cos(step / 40 + slot), y: Math.sin(step / 40) });
    }
    runner.step(1);
  }
  const roles = new Map<string, Set<string>>();
  const nodes: Node[] = [...headless.scene.transformNodes, ...headless.scene.meshes];
  for (const node of nodes) {
    const tag = visualOf(node);
    if (!tag) continue;
    const keys = roles.get(tag.role) ?? new Set<string>();
    if (tag.key !== undefined) keys.add(tag.key);
    roles.set(tag.role, keys);
  }
  runner.dispose();
  headless.dispose();
  return roles;
}

describe('Darstellungs-Vertrag (markVisual) der Rotation', () => {
  it('kennt für jedes Minispiel der Rotation die erwarteten Rollen', () => {
    expect(Object.keys(EXPECTED).sort()).toEqual([...ROTATION].sort());
  });

  it.each(ROTATION)('%s kennzeichnet Figuren je Slot und seine Objekte', async (id) => {
    const roles = await rolesAfter(id, 4);
    expect([...(roles.get('figur') ?? [])].sort()).toEqual(['1', '2', '3', '4']);
    for (const role of EXPECTED[id] ?? []) expect(roles.has(role), role).toBe(true);
  });
});
