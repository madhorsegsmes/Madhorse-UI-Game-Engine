import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir = await mkdtemp(path.join(tmpdir(), 'prefab-updates-'));
after(() => rm(dir, { recursive: true, force: true }));
async function load(file) {
  const outfile = path.join(dir, `${file}.mjs`);
  await build({ entryPoints: [new URL(`../../src/lib/${file}.ts`, import.meta.url).pathname],
    outfile, bundle: true, platform: 'node', format: 'esm' });
  return import(pathToFileURL(outfile).href);
}
const { capturePrefab, instantiatePrefab } = await load('scene-authoring');
const { createSceneEntity, getTransform, isSceneGraph } = await load('scene-model');
const { createUIControlElement } = await load('ui-controls');
const { placeLinkedPrefab, previewPrefabUpdate, revisePrefab, isPrefabLinks } = await load('prefab-updates');
const copy = value => JSON.parse(JSON.stringify(value));
function fixture() {
  const root = createSceneEntity('Source');
  const child = createSceneEntity('Child', undefined, root.id);
  const control = createUIControlElement('panel', 0);
  root.components.push({ id: crypto.randomUUID(), type: 'primitive', enabled: true,
    shape: 'cube', color: '#ffffff', textureAssetId: 'asset-original' });
  child.components.push({ id: crypto.randomUUID(), type: 'uiCanvas', enabled: true, controlId: control.id });
  child.components.push({ id: crypto.randomUUID(), type: 'camera', enabled: true, fov: 50, target: { x: 0, y: 0, z: 0 } });
  const source = capturePrefab([root, child], root.id, 'Template', [control]);
  const placed = placeLinkedPrefab(source);
  return { source, placed, root, child, control };
}
test('explicit update merges untouched fields and keeps conflicting edits, placement, assets, and camera IDs', () => {
  const { source, placed } = fixture();
  const local = copy(placed.entities);
  const primitive = local[0].components.find(c => c.type === 'primitive');
  primitive.color = '#ff0000';
  primitive.textureAssetId = 'custom-asset';
  getTransform(local[0]).position.x = 99;
  local[1].name = 'Customized child';
  const revised = copy(source);
  revised.entities[0].components.find(c => c.type === 'primitive').color = '#0000ff';
  revised.entities[0].components.find(c => c.type === 'primitive').enabled = false;
  revised.entities[1].name = 'New child name';
  revised.entities[1].components.find(c => c.type === 'camera').fov = 75;
  const before = copy(local);
  const preview = previewPrefabUpdate(local, placed.uiControls, placed.link, revised);
  assert.deepEqual(local, before, 'preview/cancel must not mutate input');
  assert.deepEqual(placed.link.source, source);
  assert.equal(preview.entities[0].components.find(c => c.type === 'primitive').color, '#ff0000');
  assert.equal(preview.entities[0].components.find(c => c.type === 'primitive').textureAssetId, 'custom-asset');
  assert.equal(preview.entities[0].components.find(c => c.type === 'primitive').enabled, false);
  assert.equal(getTransform(preview.entities[0]).position.x, 99);
  assert.equal(preview.entities[1].name, 'Customized child');
  assert.equal(preview.entities[1].components.find(c => c.type === 'camera').fov, 75);
  assert.equal(preview.entities[1].id, local[1].id, 'active camera entity remains stable');
  assert.equal(preview.entities[1].parentId, placed.rootId);
  assert.ok(preview.affected.includes('Customized child'));
});
test('new objects, components and controls remap; local deletions and other instances stay independent', () => {
  const { source, placed } = fixture();
  const second = placeLinkedPrefab(source);
  const revised = copy(source);
  const newControl = createUIControlElement('panel', 1);
  const newChild = createSceneEntity('New canvas', undefined, source.rootId);
  newChild.components.push({ id: crypto.randomUUID(), type: 'uiCanvas', enabled: true, controlId: newControl.id });
  revised.entities.push(newChild);
  revised.uiControls.push(newControl);
  const local = [...placed.entities.slice(0, 1), ...second.entities];
  const preview = previewPrefabUpdate(local, [...placed.uiControls, ...second.uiControls], placed.link, revised);
  assert.ok(!preview.entities.some(e => e.id === placed.entities[1].id), 'deleted child stays deleted');
  for (const entity of second.entities) assert.deepEqual(preview.entities.find(e => e.id === entity.id), entity);
  const added = preview.entities.find(e => e.name === 'New canvas');
  assert.notEqual(added.id, newChild.id);
  assert.equal(added.parentId, placed.rootId);
  const canvas = added.components.find(c => c.type === 'uiCanvas');
  assert.notEqual(canvas.controlId, newControl.id);
  assert.ok(preview.uiControls.some(c => c.id === canvas.controlId));
  assert.ok(isSceneGraph(preview.entities));
});
test('browser JSON reload keeps baselines valid and second updates preserve original overrides', () => {
  const { source, placed } = fixture();
  const local = copy(placed.entities);
  local[1].name = 'Local';
  const revised = copy(source);
  revised.entities[1].name = 'First revision';
  const first = previewPrefabUpdate(local, placed.uiControls, placed.link, revised);
  const saved = copy({ ...first, prefabLinks: [first.link], prefabs: [] });
  assert.ok(isPrefabLinks(saved.prefabLinks), 'removing library entry must not invalidate saved links');
  revised.entities[1].name = 'Second revision';
  revised.entities[1].components.find(c => c.type === 'camera').fov = 80;
  const second = previewPrefabUpdate(saved.entities, saved.uiControls, saved.prefabLinks[0], revised);
  assert.equal(second.entities[1].name, 'Local');
  assert.equal(second.entities[1].components.find(c => c.type === 'camera').fov, 80);
  assert.deepEqual(previewPrefabUpdate(second.entities, second.uiControls, second.link, revised).affected, []);
});
test('template removals preserve scene objects, controls and removed camera components', () => {
  const { source, placed } = fixture();
  const revised = copy(source);
  revised.entities = revised.entities.slice(0, 1);
  revised.uiControls = [];
  const preview = previewPrefabUpdate(placed.entities, placed.uiControls, placed.link, revised);
  assert.deepEqual(preview.entities, placed.entities);
  assert.deepEqual(preview.uiControls, placed.uiControls);
  assert.equal(preview.kept.length, 1);
  const removeCameraOnly = copy(source);
  removeCameraOnly.entities[1].components = removeCameraOnly.entities[1].components.filter(c => c.type !== 'camera');
  assert.ok(previewPrefabUpdate(placed.entities, placed.uiControls, placed.link, removeCameraOnly)
    .entities[1].components.some(c => c.type === 'camera'));
});
test('control overrides merge independently and template additions do not resurrect locally deleted subtrees', () => {
  const { source, placed } = fixture();
  const revised = copy(source);
  revised.uiControls[0].label = 'Template panel';
  revised.uiControls[0].width = 310;
  const controls = copy(placed.uiControls);
  controls[0].label = 'Custom panel';
  const local = copy(placed.entities);
  const attachment = createSceneEntity('Local attachment', undefined, placed.entities[1].id);
  const newChild = createSceneEntity('Below deleted', undefined, source.entities[1].id);
  revised.entities.push(newChild);
  const merged = previewPrefabUpdate([...local, attachment], controls, placed.link, revised);
  assert.equal(merged.uiControls[0].label, 'Custom panel');
  assert.equal(merged.uiControls[0].width, 310);
  assert.deepEqual(merged.entities.find(e => e.id === attachment.id), attachment);
  const deleted = previewPrefabUpdate(local.slice(0, 1), controls, placed.link, revised);
  assert.ok(!deleted.entities.some(e => e.name === 'Below deleted'));
});
test('legacy snapshots never acquire links by matching names; publish from linked root retains source identity', () => {
  const { source, placed } = fixture();
  const legacy = instantiatePrefab(source);
  assert.ok(!('link' in legacy));
  assert.throws(() => revisePrefab(source, legacy.rootId, legacy.entities, legacy.uiControls));
  const revised = revisePrefab(source, placed.rootId, placed.entities, placed.uiControls, placed.link);
  assert.equal(revised.id, source.id);
  assert.equal(revised.rootId, source.rootId);
  assert.deepEqual(revised.entities.map(e => e.id), source.entities.map(e => e.id));
  assert.deepEqual(revised.uiControls.map(c => c.id), source.uiControls.map(c => c.id));
});
test('invalid link metadata and mismatched sources are rejected, not inferred or applied', () => {
  const { source, placed } = fixture();
  assert.ok(isPrefabLinks([placed.link]));
  for (const corrupt of [
    l => { l.version = 2; }, l => { l.rootId = 'wrong'; },
    l => { l.templateId = 'wrong'; }, l => { l.ids = {}; },
    l => { l.source = null; }, l => { l.ids[Object.keys(l.ids)[1]] = l.rootId; },
  ]) {
    const link = copy(placed.link); corrupt(link);
    assert.equal(isPrefabLinks([link]), false);
  }
  assert.equal(isPrefabLinks([placed.link, placed.link]), false);
  assert.throws(() => previewPrefabUpdate(placed.entities, placed.uiControls, placed.link, { ...source, id: 'other' }));
});
