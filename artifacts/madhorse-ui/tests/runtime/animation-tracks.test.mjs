import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir = await mkdtemp(path.join(tmpdir(), 'animation-tracks-'));
after(() => rm(dir, { recursive: true, force: true }));
async function load(file, name) {
  const outfile = path.join(dir, `${name}.mjs`);
  await build({
    entryPoints: [new URL(`../../src/lib/${file}.ts`, import.meta.url).pathname],
    outfile, bundle: true, platform: 'node', format: 'esm',
  });
  return import(pathToFileURL(outfile).href);
}
const { isGameAnimation, isGameAnimationCollection, getAnimationTracks, sampleGameAnimation } =
  await load('game-api', 'api');
const { applyAnimationPreview } = await load('animation-preview', 'preview');
const vector = (x) => ({ x, y: 0, z: 0 });
const frame = (id, time, x, scale = 1) => ({
  id, time, position: vector(x), rotation: vector(x), scale,
});
const clip = () => ({
  id: 'clip', name: 'Together', duration: 4, loop: false,
  tracks: [
    { id: 'a', targetEntityId: 'actor', keyframes: [frame('a0', 0, 0), frame('a1', 4, 40, 2)] },
    { id: 'b', targetEntityId: 'prop', keyframes: [frame('b0', 1, 10), frame('b1', 2, 30)] },
  ],
});
const entities = () => ['actor', 'prop', 'untouched'].map((id) => ({
  id, name: id, parentId: id === 'prop' ? 'actor' : null,
  components: [{
    id: `${id}-transform`, type: 'transform',
    position: vector(5), rotation: vector(0), scale: { x: 2, y: 3, z: 4 },
  }],
}));

test('multi-object clips and legacy clips survive browser-local JSON round trips', () => {
  const animation = clip();
  assert.ok(isGameAnimationCollection(JSON.parse(JSON.stringify([animation]))));
  const legacy = {
    id: 'old', name: 'Old clip', duration: 4, loop: true,
    targetEntityId: 'actor', keyframes: animation.tracks[0].keyframes,
  };
  assert.ok(isGameAnimation(legacy));
  assert.deepEqual(getAnimationTracks(legacy), [{
    id: 'old', targetEntityId: 'actor', keyframes: legacy.keyframes,
  }]);
  assert.ok(isGameAnimationCollection([legacy, animation]));
  assert.ok(!isGameAnimationCollection([animation, animation]));
});

test('each track is validated, with unique targets and bounded ordered keyframes', () => {
  for (const corrupt of [
    (a) => { a.tracks = []; },
    (a) => { a.tracks = null; },
    (a) => { a.tracks.push(null); },
    (a) => { a.tracks[1].id = 'a'; },
    (a) => { a.tracks[1].targetEntityId = 'actor'; },
    (a) => { a.tracks[1].keyframes[1].time = 1; },
    (a) => { a.tracks[1].keyframes[1].time = 5; },
    (a) => { a.tracks[1].keyframes[1].position.x = Infinity; },
    (a) => { a.tracks[1].keyframes[1].scale = 0; },
  ]) {
    const animation = clip();
    corrupt(animation);
    assert.equal(isGameAnimation(animation), false);
  }
});

test('one playhead samples independently timed tracks and holds their boundary poses', () => {
  const animation = clip();
  const sample = (index, time) => sampleGameAnimation({
    ...animation.tracks[index], duration: animation.duration,
  }, time);
  assert.equal(sample(0, 1.5).position.x, 15);
  assert.equal(sample(1, 1.5).position.x, 20);
  assert.equal(sample(1, 0).position.x, 10);
  assert.equal(sample(1, 3).position.x, 30);
  assert.equal(sample(1, 4).position.x, 30);
});

test('preview transforms every target together without mutating saved entities or clips', () => {
  const savedEntities = entities();
  const animation = clip();
  const before = JSON.stringify({ savedEntities, animation });
  const preview = applyAnimationPreview(savedEntities, animation, 2);
  assert.equal(preview[0].components[0].position.x, 20);
  assert.equal(preview[1].components[0].position.x, 30);
  assert.deepEqual(preview[0].components[0].scale, { x: 3, y: 4.5, z: 6 });
  assert.equal(preview[1].parentId, 'actor');
  assert.equal(preview[2], savedEntities[2]);
  preview[0].components[0].position.x = 999;
  assert.equal(JSON.stringify({ savedEntities, animation }), before);
  assert.equal(applyAnimationPreview(savedEntities, animation, 0)[0].components[0].position.x, 0);
});

test('a deleted target does not prevent remaining tracks from previewing', () => {
  const scene = entities().filter((entity) => entity.id !== 'prop');
  const preview = applyAnimationPreview(scene, clip(), 2);
  assert.equal(preview[0].components[0].position.x, 20);
  assert.equal(preview.length, 2);
});
