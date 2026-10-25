import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const project = dirname(dirname(fileURLToPath(import.meta.url)));
const directory = await mkdtemp(join(tmpdir(), 'madhorse-pbr-'));
try {
  const result = await build({
    stdin: {
      resolveDir: project,
      loader: 'ts',
      contents: `
        import assert from 'node:assert/strict';
        import {
          createPbrMaterialAsset, createPbrMaterialExchange, createPbrMaterialDefinition,
          isPbrMaterialDefinition, pbrTextureSlotForFilename, parsePbrMaterialExchange,
        } from './src/lib/pbr-material';
        import { isProjectAsset } from './src/lib/scene-model';

        const image = { id: 'stone-albedo', name: 'Stone_BaseColor.png', kind: 'image',
          mimeType: 'image/png', size: 1024, addedAt: '2026-10-24T00:00:00.000Z' };
        const material = createPbrMaterialDefinition();
        material.maps.baseColor = image.id;
        assert.equal(isPbrMaterialDefinition(material), true);
        assert.deepEqual(pbrTextureSlotForFilename('Rock_Normal.webp'), ['normal']);
        assert.deepEqual(pbrTextureSlotForFilename('Rock_AO_Roughness_Metallic.png'),
          ['ambientOcclusion', 'roughness', 'metalness']);
        assert.deepEqual(pbrTextureSlotForFilename('Brick_BaseColor.png'), ['baseColor']);

        const asset = createPbrMaterialAsset('Stone');
        asset.pbrMaterial = material;
        asset.size = JSON.stringify(material).length;
        assert.equal(isProjectAsset(asset), true, 'PBR materials are valid project assets');
        const exchange = createPbrMaterialExchange(asset.name, material, [image]);
        assert.equal(exchange.material.maps.baseColor, image.name, 'Export stores the texture filename');
        const parsed = parsePbrMaterialExchange(exchange);
        assert.equal(parsed.material.maps.baseColor, image.name, 'Import can rematch the texture filename');

        assert.equal(isPbrMaterialDefinition({ ...material, roughness: 1.01 }), false);
        assert.equal(isPbrMaterialDefinition({ ...material, maps: { ...material.maps, unknown: null } }), false);
        assert.equal(isProjectAsset({ ...asset, pbrMaterial: { ...material, metalness: -1 } }), false);
        console.log('PBR material validation, exchange, and map detection passed.');
      `,
    },
    bundle: true,
    platform: 'node',
    format: 'esm',
    write: false,
    external: ['three'],
  });
  const output = join(directory, 'test.mjs');
  const { writeFile } = await import('node:fs/promises');
  await writeFile(output, result.outputFiles[0].text);
  await import(pathToFileURL(output).href);
} finally {
  await rm(directory, { recursive: true, force: true });
}
