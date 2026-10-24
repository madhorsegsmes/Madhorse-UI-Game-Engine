import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createVisionMenu, defaultVisionEffects, parseVisionAttachments, parseVisionEffects, visionMediaFilter,
} from '../src/lib/vision-node-content';

test('legacy image and menu nodes retain their attachments without moving file bytes', () => {
  const migrated = parseVisionAttachments(undefined, {
    id: 'old-image', kind: 'image', mediaId: 'existing-browser-file', mediaName: 'Scene.png',
  });
  assert.equal(migrated[0].mediaId, 'existing-browser-file');
  assert.equal(migrated[0].name, 'Scene.png');
  assert.equal(migrated[0].kind, 'image');
  assert.equal(parseVisionAttachments(undefined, { id: 'old-menu', kind: 'menu-screen' })[0].menuButtons?.length, 3);
  assert.deepEqual(parseVisionAttachments([], { id: 'old', kind: 'image', mediaId: 'removed' }), []);
});

test('multiple node attachments, roles and effects survive JSON saves', () => {
  const attachments = [
    createVisionMenu(),
    {
      id: 'scene-video', kind: 'video', mediaId: 'saved-video', name: 'Opening scene',
      role: 'scene', effects: { ...defaultVisionEffects, preset: 'cinematic', contrast: 125 },
    },
    {
      id: 'menu-art', kind: 'image', mediaId: 'saved-art', name: 'Menu art',
      role: 'menu', effects: { ...defaultVisionEffects, preset: 'noir' },
    },
  ];
  const restored = parseVisionAttachments(JSON.parse(JSON.stringify(attachments)));
  assert.equal(restored.length, 3);
  assert.equal(restored[1].role, 'scene');
  assert.equal(restored[1].effects.contrast, 125);
  assert.equal(restored[2].effects.preset, 'noir');
  assert.match(visionMediaFilter(restored[2].effects), /grayscale\(1\)/);
});

test('media effect values are bounded and broken attachments are rejected', () => {
  const effects = parseVisionEffects({ preset: 'url(evil)', brightness: Infinity, contrast: -9, saturation: 10000, blur: 99 });
  assert.deepEqual(effects, { preset: 'none', brightness: 100, contrast: 20, saturation: 250, blur: 12 });
  assert.equal(parseVisionAttachments([{ id: 'missing-file', kind: 'video' }]).length, 0);
  const menu = createVisionMenu();
  assert.equal(parseVisionAttachments([menu, menu]).length, 1);
  assert.equal(parseVisionAttachments(Array.from({ length: 22 }, (_, index) => ({ ...menu, id: String(index) }))).length, 20);
});
