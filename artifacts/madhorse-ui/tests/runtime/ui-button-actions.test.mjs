import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir = await mkdtemp(path.join(tmpdir(), 'ui-button-actions-'));
after(() => rm(dir, { recursive: true, force: true }));
const outfile = path.join(dir, 'controls.mjs');
await build({
  entryPoints: [new URL('../../src/lib/ui-controls.ts', import.meta.url).pathname],
  outfile, bundle: true, platform: 'node', format: 'esm',
});
const { createUIControlElement, isUIControlCollection, isUIButtonAction, dispatchUIButtonAction } =
  await import(pathToFileURL(outfile).href);

test('legacy controls and each supported button action survive project serialization', () => {
  for (const type of ['text', 'button', 'health-bar', 'panel']) {
    const control = createUIControlElement(type, 0);
    assert.equal(isUIControlCollection(JSON.parse(JSON.stringify([control]))), true);
  }
  for (const action of ['none', 'stop-game', 'reset-preview']) {
    const control = { ...createUIControlElement('button', 0), action };
    assert.equal(isUIButtonAction(action), true);
    assert.equal(isUIControlCollection(JSON.parse(JSON.stringify([control]))), true);
  }
});

test('malformed actions and actions on non-buttons are rejected without invoking handlers', () => {
  let calls = 0;
  const handlers = { stopGame: () => calls++, resetPreview: () => calls++ };
  for (const action of [
    null, true, 1, [], {}, { type: 'stop-game' }, ['stop-game'], '',
    'Stop-game', 'stop-game ', '__proto__', 'constructor', 'toString',
    'javascript:alert(1)', 'eval', 'fetch', 'run-script', 'window.alert(1)',
    { action: 'stop-game', script: 'alert(1)' },
  ]) {
    assert.equal(isUIButtonAction(action), false);
    assert.equal(isUIControlCollection([{ ...createUIControlElement('button', 0), action }]), false);
    assert.equal(dispatchUIButtonAction(action, handlers), false);
  }
  for (const type of ['text', 'health-bar', 'panel']) {
    assert.equal(isUIControlCollection([{ ...createUIControlElement(type, 0), action: 'stop-game' }]), false);
  }
  assert.equal(dispatchUIButtonAction(undefined, handlers), false);
  assert.equal(dispatchUIButtonAction('none', handlers), false);
  assert.equal(calls, 0);
});

test('each supported action dispatches only its fixed host operation', () => {
  const calls = [];
  const handlers = { stopGame: () => calls.push('stop'), resetPreview: () => calls.push('reset') };
  assert.equal(dispatchUIButtonAction('stop-game', handlers), true);
  assert.deepEqual(calls, ['stop']);
  assert.equal(dispatchUIButtonAction('reset-preview', handlers), true);
  assert.deepEqual(calls, ['stop', 'reset']);
});

// Render the real overlay without a GPU. Only the unrelated Three.js viewport
// is replaced; React renders the same DOM attributes used by the browser.
const rendererOutfile = path.join(dir, 'render.mjs');
await build({
  stdin: {
    contents: `import React from 'react';
      import { renderToStaticMarkup } from 'react-dom/server';
      import { GameScene } from ${JSON.stringify(new URL('../../src/components/game-scene.tsx', import.meta.url).pathname)};
      export const render = (props) => renderToStaticMarkup(React.createElement(GameScene, props));`,
    resolveDir: new URL('../../', import.meta.url).pathname,
  },
  outfile: rendererOutfile, bundle: true, platform: 'node', format: 'esm', jsx: 'automatic',
  banner: { js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);' },
  plugins: [{
    name: 'no-gpu-viewport',
    setup(builder) {
      builder.onResolve({ filter: /^@\/components\/scene-preview-3d$/ }, () => ({
        path: 'scene-preview-3d', namespace: 'stub',
      }));
      builder.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
        contents: 'export const ScenePreview3D = () => null;', loader: 'js',
      }));
    },
  }],
});
const { render } = await import(pathToFileURL(rendererOutfile).href);
const noop = () => {};
const controls = [
  { ...createUIControlElement('button', 0), id: 'stop', action: 'stop-game' },
  { ...createUIControlElement('button', 1), id: 'reset', action: 'reset-preview' },
  { ...createUIControlElement('button', 2), id: 'unassigned' },
  { ...createUIControlElement('button', 3), id: 'invalid', action: 'run-script' },
  { ...createUIControlElement('text', 4), id: 'text' },
];
const props = {
  primaryCamera: { position: { x: 50, y: 50, z: -100 }, target: { x: 50, y: 50, z: 50 }, fov: 60 },
  gameCamera: { position: { x: 50, y: 50, z: -100 }, target: { x: 50, y: 50, z: 50 }, fov: 60 },
  viewMode: '2d', entities: [], assets: [], assetUrls: {}, uiControls: controls,
  selectedUIControlId: 'stop', selectedEntityId: null,
  position: { x: 50, y: 50 }, startingPosition: { x: 50, y: 50 }, readOnly: false,
  onViewModeChange: noop, onSaveStartingPosition: noop, onSelectEntity: noop,
  onMoveEntity: noop, onSelectUIControl: noop, onMoveUIControl: noop, onUpdateTransform: noop,
};
function controlTag(html, id) {
  return html.match(new RegExp(`<button[^>]*data-ui-control-id="${id}"[^>]*>`))?.[0];
}
test('Play enables only assigned safe buttons in both scene views; editing stays separate', () => {
  for (const viewMode of ['2d', '3d']) {
    const html = render({ ...props, viewMode, readOnly: true, isPlaying: true });
    for (const id of ['stop', 'reset']) {
      assert.ok(controlTag(html, id));
      assert.doesNotMatch(controlTag(html, id), /disabled|aria-pressed/);
    }
    for (const id of ['unassigned', 'invalid', 'text']) {
      assert.match(controlTag(html, id), /disabled/);
    }
  }
  assert.doesNotMatch(render({ ...props, viewMode: '3d' }), /data-ui-control-id/);
  assert.doesNotMatch(controlTag(render(props), 'unassigned'), /disabled/);
  assert.match(controlTag(render({ ...props, readOnly: true }), 'stop'), /disabled/);
});
