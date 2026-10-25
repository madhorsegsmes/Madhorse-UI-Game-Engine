import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir = await mkdtemp(path.join(tmpdir(), 'animation-analytics-'));
after(async () => {
  delete globalThis.window;
  await rm(dir, { recursive: true, force: true });
});
const outfile = path.join(dir, 'analytics.mjs');
await build({
  entryPoints: [new URL('../../src/lib/analytics.ts', import.meta.url).pathname],
  outfile, bundle: true, platform: 'node', format: 'esm',
});
const { trackEvent } = await import(pathToFileURL(outfile).href);

test('analytics is safe without a browser or injected tracker', () => {
  delete globalThis.window;
  assert.doesNotThrow(() => trackEvent('animation_clip_created'));
  globalThis.window = {};
  assert.doesNotThrow(() => trackEvent('animation_preview_started'));
});

test('analytics forwards aggregate data exactly once', () => {
  const calls = [];
  globalThis.window = { umami: { track: (...args) => calls.push(args) } };
  const data = { track_count: 2, keyframe_count: 4, duration_seconds: 1, loop: false };
  trackEvent('animation_preview_started', data);
  assert.deepEqual(calls, [['animation_preview_started', data]]);
});

test('tracker throws and rejected requests do not interrupt editing', async () => {
  globalThis.window = { umami: { track() { throw new Error('blocked'); } } };
  assert.doesNotThrow(() => trackEvent('animation_clip_created'));
  globalThis.window = { umami: { track() { return Promise.reject(new Error('offline')); } } };
  assert.doesNotThrow(() => trackEvent('animation_preview_started'));
  // Let unhandled rejections surface to the test runner if not caught.
  await new Promise((resolve) => setImmediate(resolve));
});
