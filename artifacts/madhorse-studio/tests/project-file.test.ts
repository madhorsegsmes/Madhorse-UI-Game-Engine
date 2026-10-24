import assert from 'node:assert/strict';
import test from 'node:test';
import { strFromU8, unzipSync } from 'fflate';
import { buildProjectFile, safeProjectFileName } from '../src/lib/project-file';

test('project file archive contains the project snapshot and exact imported bytes', async () => {
  const source = new Uint8Array([0, 255, 10, 42, 128]);
  const archive = await buildProjectFile({
    format: 'madhorse-project',
    schemaVersion: 1,
    projectName: 'Castle',
    savedAt: '2026-01-01T00:00:00.000Z',
    snapshot: { entities: [{ id: 'hero' }] },
    visionBoardStorage: { boards: '[]', panels: null },
  }, [{
    scope: 'asset',
    id: 'mesh-1',
    path: 'assets/0001-Hero.glb',
    mimeType: 'model/gltf-binary',
    blob: new Blob([source], { type: 'model/gltf-binary' }),
  }]);

  assert.equal(archive.type, 'application/zip');
  const contents = unzipSync(new Uint8Array(await archive.arrayBuffer()));
  const project = JSON.parse(strFromU8(contents['project.json']!));
  assert.equal(project.format, 'madhorse-project');
  assert.equal(project.projectName, 'Castle');
  assert.equal(project.files[0].path, 'assets/0001-Hero.glb');
  assert.deepEqual([...contents['assets/0001-Hero.glb']!], [...source]);
  assert.deepEqual(project.snapshot.entities, [{ id: 'hero' }]);
});

test('project downloads use a safe, descriptive archive filename', () => {
  assert.equal(safeProjectFileName('My Castle'), 'My-Castle.madhorse.zip');
  assert.equal(safeProjectFileName('../'), 'Madhorse-Project.madhorse.zip');
});
