import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PROP_IDS, propAssetId } from '../../packages/assets/src/props.ts';

const root = join(import.meta.dirname, '../..');
/** @type {{ builds: Record<string, { artifacts: { id: string, path: string, from: string[], budgetBytes?: number }[] }> }} */
const manifest = JSON.parse(readFileSync(join(root, 'packages/assets/manifest.json'), 'utf8'));
const artifacts = manifest.builds['apple-host']?.artifacts ?? [];

describe('Apple-Assets: Requisiten als USDZ (CHAOS-221)', () => {
  it('jedes Requisit des Katalogs hat ein Artefakt requisiten/<id>.usdz mit Herkunft und Budget', () => {
    for (const id of PROP_IDS) {
      const artifact = artifacts.find((a) => a.path === `requisiten/${id}.usdz`);
      expect(artifact, `Manifest: Artefakt für ${id}`).toBeDefined();
      expect(artifact?.id).toBe(`apple-requisit-${id}`);
      expect(artifact?.from).toEqual([propAssetId(id)]);
      expect(artifact?.budgetBytes).toBeGreaterThan(0);
    }
  });

  it('kein Requisit-Artefakt ohne Requisit im Katalog', () => {
    const ids = new Set(PROP_IDS.map((id) => `requisiten/${id}.usdz`));
    for (const artifact of artifacts.filter((a) => a.path.startsWith('requisiten/'))) {
      expect(ids.has(artifact.path)).toBe(true);
    }
  });
});
