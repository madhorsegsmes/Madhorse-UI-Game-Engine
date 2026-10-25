import { expect } from '@playwright/test';
import { movementLanguages, movementStarter, scriptStorageError, sourceSize, maxScriptSize, maxProjectScriptsSize } from '../../src/lib/project-scripts';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { hasRenderableModelGeometry } from '../../src/lib/scene-model-validation';
import { test, openScripts, run, finished, frames, importSource } from './fixtures';
import { gpuPixels, magentaModel, requireWebGL2, setGPUScene } from './gpu-fixtures';
import { createDefaultPlayer, createModelRendererComponent, getTransform } from '../../src/lib/scene-model';
import { PerspectiveCamera, Vector3 } from 'three';
import { makeGameViewCamera } from '../../src/lib/game-camera';
import { sceneFrameDistance } from '../../src/lib/scene-view-geometry';
import { modelFixture, texturedModelFixture } from './model-fixtures';

for (const format of ['glb', 'gltf', 'obj', 'fbx', 'dae']) {
  test(`GPU ${format} model renders real geometry and persists after reload`, async ({ page }, info) => {
    await page.goto('/');
    await requireWebGL2(page, info);
    const fixture = modelFixture(format);
    await page.locator('.workspace-browser-assets > summary').click();
    await page.getByTestId('input-assets').setInputFiles(fixture);
    const card = page.locator('[data-testid^="asset-card-"]').filter({ hasText: fixture.name });
    await expect(card).toBeVisible();
    const assetId = (await card.getAttribute('data-testid'))!.replace('asset-card-', '');
    // Assign through the real UI, then isolate its geometry for pixel checks.
    await page.getByTestId(`apply-asset-${assetId}`).click();
    await expect(page.getByTestId('scene-player')).toHaveAttribute('data-model-asset-id', assetId);
    const player = createDefaultPlayer();
    player.components.push(createModelRendererComponent(assetId));
    getTransform(player).position = { x: 50, y: 50, z: 0 };
    await setGPUScene(page, [player], {
      position: { x: 0, y: 1, z: 7 }, target: { x: 0, y: 1, z: 0 }, fov: 50, placement: 'custom',
    });
    let before: Awaited<ReturnType<typeof gpuPixels>> | undefined;
    for (const phase of ['import', 'reload']) {
      if (phase === 'reload') await page.reload();
      await expect(page.getByTestId('scene-player')).toHaveAttribute('data-model-asset-id', assetId);
      const canvas = page.getByTestId('scene-game-view').locator('canvas');
      await expect.poll(async () => (await gpuPixels(canvas, info, `${format}-${phase}-loading`)).stats.magenta.count)
        .toBeGreaterThan(100);
      const pixels = await gpuPixels(canvas, info, `${format}-${phase}`);
      const triangle = pixels.stats.magenta;
      // Check the actual triangle silhouette, not a DOM ready label or fallback cube.
      const camera = makeGameViewCamera({
        position: { x: 0, y: 1, z: 7 }, target: { x: 0, y: 1, z: 0 }, fov: 50, placement: 'custom',
      }, pixels.width / pixels.height);
      const projected = [[-1, 0], [1, 0], [-.6, 2]].map(([x, y]) => new Vector3(x, y, 0).project(camera));
      expect(Math.abs(triangle.minX - (Math.min(...projected.map(p => p.x)) + 1) * pixels.width / 2)).toBeLessThan(4);
      expect(Math.abs(triangle.maxX - (Math.max(...projected.map(p => p.x)) + 1) * pixels.width / 2)).toBeLessThan(4);
      expect(Math.abs(triangle.minY - (1 - Math.max(...projected.map(p => p.y))) * pixels.height / 2)).toBeLessThan(4);
      expect(Math.abs(triangle.maxY - (1 - Math.min(...projected.map(p => p.y))) * pixels.height / 2)).toBeLessThan(4);
      const fill = triangle.count / ((triangle.maxX - triangle.minX) * (triangle.maxY - triangle.minY));
      expect(fill).toBeGreaterThan(.4);
      expect(fill).toBeLessThan(.6);
      if (before) expect(Math.abs(triangle.count / before.stats.magenta.count - 1)).toBeLessThan(.03);
      before = pixels;
      await page.getByTestId('tab-scene-3d').click();
      await expect(page.getByTestId('scene3d-asset-status')).toContainText(`Model ready · ${fixture.name}`);
      await expect(page.getByTestId('scene3d-asset-status')).not.toContainText('Could not');
    }
  });

  test(`GPU invalid ${format} reports its model error, never ready, including after reload`, async ({ page }, info) => {
    await page.goto('/');
    await requireWebGL2(page, info);
    await page.getByTestId('tab-scene-3d').click();
    await page.locator('.workspace-browser-assets > summary').click();
    const name = `invalid.${format}`;
    await page.getByTestId('input-assets').setInputFiles({
      name, mimeType: 'application/octet-stream', buffer: Buffer.from('not a model'),
    });
    const card = page.locator('[data-testid^="asset-card-"]').filter({ hasText: name });
    const id = (await card.getAttribute('data-testid'))!.replace('asset-card-', '');
    await page.getByTestId(`apply-asset-${id}`).click();
    for (const phase of ['import', 'reload']) {
      if (phase === 'reload') {
        await page.reload();
        await page.getByTestId('tab-scene-3d').click();
      }
      await expect(page.getByTestId('scene-player')).toHaveAttribute('data-model-asset-id', id);
      const notices = page.getByTestId('scene3d-asset-status');
      // Each Three loader supplies different parser details. Require an actual
      // per-model error (not just any status containing the filename).
      const error = notices.locator('.is-error').filter({ hasText: name });
      await expect(error).toHaveCount(1);
      await expect(error).toContainText(` · ${name}`);
      if (format === 'obj') await expect(error).toContainText('Model contains no renderable geometry');
      if (format === 'glb' || format === 'gltf') await expect(error).toContainText(/JSON|token/i);
      if (format === 'fbx') await expect(error).toContainText('FBXLoader');
      await expect(notices).not.toContainText('Model ready');
      await expect(notices).not.toContainText('Loading model');
      await expect(page.getByTestId('scene3d-unavailable')).toHaveCount(0);
    }
  });
}

test('GPU local model texture persists and missing dependencies do not report ready', async ({ page }, info) => {
  await page.goto('/');
  await requireWebGL2(page, info);
  const fixture = texturedModelFixture();
  const buffer = await page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = c.height = 2;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#ff00ff'; ctx.fillRect(0, 0, 2, 2);
    return c.toDataURL().split(',')[1];
  });
  await page.locator('.workspace-browser-assets > summary').click();
  await page.getByTestId('input-assets').setInputFiles([
    fixture, { name: 'local magenta.png', mimeType: 'image/png', buffer: Buffer.from(buffer, 'base64') },
  ]);
  const card = page.locator('[data-testid^="asset-card-"]').filter({ hasText: fixture.name });
  await expect(card).toBeVisible();
  const id = (await card.getAttribute('data-testid'))!.replace('asset-card-', '');
  const player = createDefaultPlayer();
  player.components.push(createModelRendererComponent(id));
  getTransform(player).position = { x: 50, y: 50, z: 0 };
  await setGPUScene(page, [player], {
    position: { x: 0, y: 1, z: 7 }, target: { x: 0, y: 1, z: 0 }, fov: 50, placement: 'custom',
  });
  for (const phase of ['import', 'reload']) {
    if (phase === 'reload') await page.reload();
    await expect(page.getByTestId('scene-player')).toHaveAttribute('data-model-asset-id', id);
    await expect.poll(async () => (await gpuPixels(
      page.getByTestId('scene-game-view').locator('canvas'), info, `texture-${phase}`,
    )).stats.magenta.count).toBeGreaterThan(100);
  }
  // A second model referencing a genuinely absent image must fail locally.
  const missing = { ...fixture, name: 'missing-texture.gltf',
    buffer: Buffer.from(fixture.buffer.toString().replace('local%20magenta.png', 'absent.png')) };
  await page.getByTestId('tab-scene-3d').click();
  await page.locator('.workspace-browser-assets > summary').click();
  await page.getByTestId('input-assets').setInputFiles(missing);
  const missingCard = page.locator('[data-testid^="asset-card-"]').filter({ hasText: missing.name });
  await expect(missingCard).toBeVisible();
  const missingId = (await missingCard.getAttribute('data-testid'))!.replace('asset-card-', '');
  await page.getByTestId(`apply-asset-${missingId}`).click();
  for (const phase of ['import', 'reload']) {
    if (phase === 'reload') {
      await page.reload();
      await page.getByTestId('tab-scene-3d').click();
    }
    await expect(page.getByTestId('scene-player')).toHaveAttribute('data-model-asset-id', missingId);
    const notices = page.getByTestId('scene3d-asset-status');
    await expect(notices.locator('.is-error')).toContainText(`Missing local model dependency · absent.png · ${missing.name}`);
    await expect(notices).not.toContainText(`Model ready · ${missing.name}`);
    await expect(notices).not.toContainText('Loading model');
  }
});

function projectedTriangle(width: number, height: number, camera: PerspectiveCamera) {
  // Fixture world-space TRS, independently applied to each actual model vertex.
  const projected = [[-1, 0], [1, 0], [-.6, 2]].map(([x, y]) => {
    const point = new Vector3(x * 1.3, y * .8, 0)
      .applyAxisAngle(new Vector3(0, 1, 0), 25 * Math.PI / 180)
      .add(new Vector3(1, 1, 0)).project(camera);
    return { x: (point.x + 1) * width / 2, y: (1 - point.y) * height / 2 };
  });
  return {
    minX: Math.min(...projected.map(p => p.x)), maxX: Math.max(...projected.map(p => p.x)),
    minY: Math.min(...projected.map(p => p.y)), maxY: Math.max(...projected.map(p => p.y)),
  };
}

function expectProjectedTriangle(pixels: Awaited<ReturnType<typeof gpuPixels>>, camera: PerspectiveCamera) {
  const projected = projectedTriangle(pixels.width, pixels.height, camera);
  const actual = pixels.stats.magenta;
  for (const [bound, expected] of [
    [actual.minX, projected.minX], [actual.maxX, projected.maxX],
    [actual.minY, projected.minY], [actual.maxY, projected.maxY],
  ]) expect(Math.abs(bound - expected), 'GPU silhouette must match imported geometry and shared object TRS').toBeLessThan(4);
}

for (const width of [1280, 402]) {
  test.describe(`${width}px graphics`, () => {
  test.use({ hasTouch: width === 402, deviceScaleFactor: width === 402 ? 2 : 1 });
  test(`GPU imported model matches the shared editor scene at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await requireWebGL2(page, info);
    await page.locator('.workspace-browser-assets > summary').click();
    await page.getByTestId('input-assets').setInputFiles(magentaModel());
    const card = page.locator('[data-testid^="asset-card-"]').filter({ hasText: 'gpu-triangle.gltf' });
    await expect(card).toBeVisible();
    const assetId = (await card.getAttribute('data-testid'))!.replace('asset-card-', '');
    const player = createDefaultPlayer();
    player.components.push(createModelRendererComponent(assetId));
    // Distinct translation, rotation and non-uniform scaling, shared by both views.
    getTransform(player).position = { x: 60, y: 50, z: 10 };
    getTransform(player).rotation.z = -25;
    getTransform(player).scale = { x: 1.3, y: 1, z: .8 };
    const cameraSettings = {
      position: { x: 1, y: 2, z: -10 }, target: { x: 1, y: 2, z: 0 }, fov: 50, placement: 'custom',
    } as const;
    await setGPUScene(page, [player], cameraSettings);
    const game = page.getByTestId('scene-game-view').locator('canvas');
    await expect.poll(async () => (await gpuPixels(game, info, 'game-imported-model')).stats.magenta.count).toBeGreaterThan(100);
    const gamePixels = await gpuPixels(game, info, 'game-triangle');
    expectProjectedTriangle(gamePixels, makeGameViewCamera(cameraSettings, gamePixels.width / gamePixels.height));
    const triangle = gamePixels.stats.magenta;
    expect(triangle.maxY - triangle.minY).toBeGreaterThan(15);
    expect(triangle.maxX - triangle.minX).toBeGreaterThan(15);
    expect(triangle.count / ((triangle.maxX - triangle.minX) * (triangle.maxY - triangle.minY))).toBeGreaterThan(.3);
    expect(triangle.count / ((triangle.maxX - triangle.minX) * (triangle.maxY - triangle.minY))).toBeLessThan(.65);
    expect(gamePixels.backgroundFraction).toBeGreaterThan(.995);
    await page.getByTestId('tab-scene-3d').click();
    // Move the selected-object handles away from the triangle so they cannot
    // occlude its silhouette; the editor camera/geometry remains unchanged.
    await page.getByTestId('scene3d-select-game-camera').click();
    const editor = page.getByTestId('scene3d-viewport').locator('canvas');
    await expect(page.getByTestId('scene3d-asset-status')).toContainText('Model ready · gpu-triangle.gltf');
    await expect.poll(async () => (await gpuPixels(editor, info, 'editor-imported-model')).stats.magenta.count).toBeGreaterThan(100);
    const editorFrame = await gpuPixels(editor, info, 'editor-with-gizmos');
    const aspect = editorFrame.width / editorFrame.height;
    const editorCamera = new PerspectiveCamera(48, aspect, .1, 3000);
    const center = new Vector3(1, 2, -5);
    editorCamera.position.copy(center).addScaledVector(new Vector3(1, .9, 1.2).normalize(),
      sceneFrameDistance(cameraSettings, aspect, 48));
    editorCamera.lookAt(center);
    editorCamera.updateMatrixWorld();
    const projected = projectedTriangle(editorFrame.width, editorFrame.height, editorCamera);
    // Analyze the expected model region, not the camera's overlapping magenta
    // transform-plane handle elsewhere in the frame. Wrong/missing TRS still
    // fails the silhouette bounds. No pixels are hidden from the screenshot.
    const editorPixels = await gpuPixels(editor, info, 'editor-triangle', {
      minX: projected.minX - 8, maxX: projected.maxX + 8,
      minY: projected.minY - 8, maxY: projected.maxY + 8,
    });
    expectProjectedTriangle(editorPixels, editorCamera);
    expect(editorPixels.stats.magenta.maxY - editorPixels.stats.magenta.minY).toBeGreaterThan(15);
    // Positive control for editor-only grid/axes/gizmos; game background above is clean.
    expect(editorPixels.backgroundFraction).toBeLessThan(.99);
    await page.getByTestId('tab-scene-2d').click();
    await expect.poll(async () => (await gpuPixels(game, info, 'game-return')).stats.magenta.count).toBeGreaterThan(100);
    const returned = await gpuPixels(game, info, 'same-model-after-editor');
    expectProjectedTriangle(returned, makeGameViewCamera(cameraSettings, returned.width / returned.height));
    // Mobile antialiasing can settle differently after remount. Geometry must
    // still land on the same pixels; allow only a small edge-coverage difference.
    for (const coordinate of ['minX', 'maxX', 'minY', 'maxY', 'x', 'y'] as const) {
      expect(Math.abs(returned.stats.magenta[coordinate] - triangle[coordinate])).toBeLessThan(1.5);
    }
    expect(Math.abs(returned.stats.magenta.count / triangle.count - 1)).toBeLessThan(.03);
    player.active = false;
    await setGPUScene(page, [player], cameraSettings);
    expect((await gpuPixels(game, info, 'inactive-model-hidden')).stats.magenta.count).toBe(0);
  });
  });
}

test('source quotas count UTF-8 bytes and replace only the edited file', () => {
  const content = 'é'.repeat(maxScriptSize / 2);
  expect(sourceSize(content)).toBe(maxScriptSize);
  expect(scriptStorageError(content, [])).toBe('');
  expect(scriptStorageError(`${content}a`, [])).toContain('256 KB');
  const file = { id: 'one', name: 'one.js', language: 'JavaScript', content, size: maxScriptSize };
  const full = Array.from({ length: maxProjectScriptsSize / maxScriptSize }, (_, index) => ({ ...file, id: String(index) }));
  expect(scriptStorageError('x', full)).toContain('1 MB');
  expect(scriptStorageError(content, full, '0')).toBe('');
  expect(scriptStorageError('bad\u0000source', [])).toContain('plain text');
  const starter = movementStarter('JavaScript', [{ ...file, name: 'MOVEMENT.JS' }]);
  expect(starter.name).toBe('movement-2.js');
  expect(starter.size).toBe(sourceSize(starter.content));
});

test('create every language, edit source and reload without loading any runtime', async ({ page }) => {
  const runtimeRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/runtimes/')) runtimeRequests.push(request.url());
  });
  await openScripts(page);
  for (const { language, extension } of movementLanguages) {
    await page.getByLabel('New script language').selectOption(language);
    await page.getByRole('button', { name: 'Create script', exact: true }).click();
    await expect(page.getByLabel('Script to run').locator('option:checked')).toHaveText(`movement${extension} · ${language}`);
    await expect(page.locator('#script-source')).toHaveValue(`${movementStarter(language, []).content}`);
    await expect(frames(page)).toHaveCount(0);
  }
  await page.getByLabel('New script language').selectOption('JavaScript');
  await page.getByRole('button', { name: 'Create script', exact: true }).click();
  await expect(page.getByLabel('Script to run').locator('option:checked')).toHaveText('movement-2.js · JavaScript');
  await page.locator('#script-source').fill('console.log("saved source")');
  await page.reload();
  await page.getByLabel('Script tools').click();
  const choice = page.getByLabel('Script to run').locator('option').filter({ hasText: 'movement-2.js · JavaScript' });
  await page.getByLabel('Script to run').selectOption(await choice.getAttribute('value') ?? '');
  await expect(page.locator('#script-source')).toHaveValue('console.log("saved source")');
  await expect(page.getByTestId('scene-player')).toHaveAttribute('data-x', '50');
  const originalProject = await page.getByLabel('Choose project').inputValue();
  await page.getByLabel('Script tools').click();
  await page.getByLabel('Project actions').click();
  page.once('dialog', (dialog) => dialog.accept('Editor isolation test'));
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  await page.getByLabel('Project actions').click();
  await page.getByLabel('Script tools').click();
  await expect(page.locator('#script-source')).toHaveCount(0);
  await page.getByRole('button', { name: 'Create script', exact: true }).click();
  await page.locator('#script-source').fill('console.log("other project")');
  await page.getByLabel('Script tools').click();
  await page.getByLabel('Project actions').click();
  await page.getByLabel('Choose project').selectOption(originalProject);
  await page.getByLabel('Project actions').click();
  await page.getByLabel('Script tools').click();
  await page.getByLabel('Script to run').selectOption(await choice.getAttribute('value') ?? '');
  await expect(page.locator('#script-source')).toHaveValue('console.log("saved source")');
  expect(runtimeRequests).toEqual([]);
  await page.reload();
  await page.getByLabel('Project actions').click();
  await expect(page.getByLabel('Choose project')).toHaveValue(originalProject);
});

test('unreadable saved project data is reported and never overwritten', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('madhorse-ui-projects', '{invalid saved data');
  });
  await page.goto('/');
  await page.getByLabel('Project actions').click();
  await expect(page.locator('.project-save-status')).toContainText('Saved projects could not be read');
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => localStorage.getItem('madhorse-ui-projects'))).toBe('{invalid saved data');
});

test('edited source runs only on request through Run and Play, and headers remain non-runnable', async ({ page }) => {
  await openScripts(page);
  await page.getByRole('button', { name: 'Create script', exact: true }).click();
  const source = movementStarter('JavaScript', []).content.replace('75', '65');
  expect(source).toContain('65');
  await page.locator('#script-source').fill(source);
  await expect(page.getByTestId('scene-player')).toHaveAttribute('data-x', '50');
  await run(page);
  await finished(page);
  await expect(page.getByTestId('scene-player')).toHaveAttribute('data-x', '65');
  await page.locator('#script-source').fill(source.replace('65', '45'));
  // Close the menu so the workspace's existing Play button is reachable.
  await page.getByLabel('Script tools').click();
  await page.getByTestId('button-play-game').click();
  await expect(page.getByTestId('scene-player')).toHaveAttribute('data-x', '45', { timeout: 180_000 });
  await page.getByLabel('Script tools').click();
  await finished(page);
  await importSource(page, 'player.h', '#define SPEED 5');
  await page.locator('#script-source').fill('#define SPEED 10');
  await expect(page.getByRole('button', { name: 'Run script', exact: true })).toBeDisabled();
  await expect(page.locator('.script-run-status')).toContainText('Header file');
});

test('rejected edits retain saved source and deletion cannot leave stale source visible', async ({ page }) => {
  await openScripts(page);
  await page.getByRole('button', { name: 'Create script', exact: true }).click();
  const source = await page.locator('#script-source').inputValue();
  await page.locator('#script-source').fill('é'.repeat(maxScriptSize / 2 + 1));
  await expect(page.locator('.script-message')).toContainText('256 KB');
  await expect(page.locator('#script-source')).toHaveValue(source);
  await page.getByRole('button', { name: 'Remove movement.js', exact: true }).click();
  await expect(page.locator('#script-source')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Run script', exact: true })).toBeDisabled();
  await page.reload();
  await page.getByLabel('Script tools').click();
  await expect(page.locator('#script-source')).toHaveCount(0);
});

test('the game preview opens as a blank canvas with a centered square and offers 3D tools', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('tab-scene-2d')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('scene-game-view')).toBeVisible();
  await expect(page.getByTestId('scene-game-view').locator('canvas').or(page.getByTestId('scene-field'))).toBeVisible();
  await expect(page.getByTestId('scene-player')).toHaveAttribute('data-x', '50');
  await expect(page.getByTestId('scene-player')).toHaveAttribute('data-y', '50');
  if (await page.getByTestId('game-camera-fallback').isVisible()) {
    const field = await page.getByTestId('scene-field').boundingBox();
    const square = await page.getByTestId('scene-player').boundingBox();
    expect(field).not.toBeNull();
    expect(square).not.toBeNull();
    expect(Math.abs(square!.x + square!.width / 2 - (field!.x + field!.width / 2))).toBeLessThan(2);
    expect(Math.abs(square!.y + square!.height / 2 - (field!.y + field!.height / 2))).toBeLessThan(2);
  }
  await expect(page.getByLabel('Starting X')).not.toBeVisible();
  await page.getByTestId('scene-preview-settings').locator('summary').click();
  await expect(page.getByLabel('Starting X')).toBeVisible();
  await page.getByTestId('tab-scene-3d').click();
  await expect(page.getByTestId('tab-scene-3d')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('scene-preview-3d')).toBeVisible();
  await expect(page.getByTestId('scene3d-viewport')).toBeVisible();
  await expect(page.getByTestId('scene3d-mode-translate')).toHaveAttribute('aria-pressed', 'true');

  await page.getByTestId('scene3d-mode-rotate').click();
  await expect(page.getByTestId('scene3d-mode-rotate')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('tab-scene-2d').click();
  await expect(page.getByTestId('scene-game-view')).toBeVisible();
  await page.getByTestId('tab-scene-3d').click();
  await expect(page.getByTestId('scene3d-viewport')).toBeVisible();
});

test('UI Controls create, arrange, edit, and save interface elements with the project', async ({ page }) => {
  await page.goto('/');
  await page.getByText('UI Controls', { exact: true }).click();
  await expect(page.getByLabel('UI Controls menu')).toBeVisible();
  await expect(page.getByTestId('game-ui-overlay')).toHaveCount(0);

  for (const type of ['text', 'button', 'health-bar', 'panel']) {
    await page.getByTestId(`add-ui-control-${type}`).click();
  }

  const previewElements = page.locator('[data-testid^="ui-preview-element-"]');
  await expect(previewElements).toHaveCount(4);
  const buttonElement = previewElements.filter({ hasText: 'Button' });
  const buttonId = await buttonElement.getAttribute('data-ui-control-id');
  expect(buttonId).toBeTruthy();
  await page.getByTestId(`ui-control-item-${buttonId}`).click();
  await page.getByTestId('input-ui-control-label').fill('Start Mission');
  await page.getByTestId('input-ui-control-color').fill('#287a4b');

  const previewBounds = await page.locator('.scene-preview-shell').boundingBox();
  const buttonBounds = await page.getByTestId(`ui-preview-element-${buttonId}`).boundingBox();
  expect(previewBounds).not.toBeNull();
  expect(buttonBounds).not.toBeNull();
  await page.mouse.move(buttonBounds!.x + buttonBounds!.width / 2, buttonBounds!.y + buttonBounds!.height / 2);
  await page.mouse.down();
  await page.mouse.move(previewBounds!.x + previewBounds!.width * 0.7, previewBounds!.y + previewBounds!.height * 0.65, { steps: 6 });
  await page.mouse.up();
  await expect(page.getByTestId(`ui-preview-element-${buttonId}`)).toHaveAttribute('data-x', /6[5-9]|7\d/);
  await expect(page.getByTestId(`ui-preview-element-${buttonId}`)).toHaveAttribute('data-y', /6[0-9]|7[0-9]/);
  await expect.poll(async () => page.evaluate((id) => {
    const projects = JSON.parse(localStorage.getItem('madhorse-ui-projects') ?? '[]');
    return projects[0]?.uiControls?.find((element: { id: string }) => element.id === id)?.label;
  }, buttonId)).toBe('Start Mission');

  await page.reload();
  await expect(page.locator('[data-testid^="ui-preview-element-"]')).toHaveCount(4);
  await page.getByText('UI Controls', { exact: true }).click();
  await page.getByTestId(`ui-control-item-${buttonId}`).click();
  await expect(page.getByTestId('input-ui-control-label')).toHaveValue('Start Mission');
  await expect(page.getByTestId('input-ui-control-color')).toHaveValue('#287a4b');
  await expect(page.getByTestId('input-ui-control-width')).toHaveValue('136');
  await page.getByTestId(`delete-ui-control-${buttonId}`).click();
  await expect(page.getByTestId(`ui-preview-element-${buttonId}`)).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'PANEL 3 / System' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'PANEL 4 / Play/Test Game' })).toBeVisible();
});

test('interface layering updates Canvas immediately and survives reload', async ({ page }) => {
  await page.goto('/');
  await page.getByText('UI Controls', { exact: true }).click();
  await page.getByTestId('add-ui-control-button').click();
  await page.getByTestId('input-ui-control-label').fill('Back button');
  const backId = await page.locator('[data-ui-control-id]').getAttribute('data-ui-control-id');
  await page.getByTestId('add-ui-control-panel').click();
  const frontId = await page.locator('[data-ui-control-id]').last().getAttribute('data-ui-control-id');
  // Put both elements in the same place so the visual order is meaningful.
  await page.getByTestId('input-ui-control-x').fill('22');
  await page.getByTestId('input-ui-control-y').fill('22');
  const backward = page.getByTestId('ui-control-move-backward');
  const forward = page.getByTestId('ui-control-move-forward');
  await expect(forward).toBeDisabled();
  await backward.click();
  await expect(backward).toBeDisabled();
  await expect(page.getByTestId(`ui-preview-element-${backId}`)).toHaveCSS('z-index', '2');
  await expect(page.getByTestId(`ui-preview-element-${frontId}`)).toHaveCSS('z-index', '1');
  await expect(page.getByTestId(`ui-control-item-${frontId}`)).toHaveAttribute('aria-pressed', 'true');
  await forward.click();
  await expect(forward).toBeDisabled();
  await expect(page.getByTestId(`ui-preview-element-${frontId}`)).toHaveCSS('z-index', '2');
  await backward.click();
  await expect.poll(() => page.evaluate(() => {
    const projects = JSON.parse(localStorage.getItem('madhorse-ui-projects') ?? '[]');
    const active = localStorage.getItem('madhorse-ui-active-project');
    return projects.find((project: { id: string }) => project.id === active)?.uiControls?.[0]?.id;
  })).toBe(frontId);
  await page.reload();
  await expect(page.getByTestId(`ui-preview-element-${frontId}`)).toHaveCSS('z-index', '1');
  await expect(page.getByTestId(`ui-preview-element-${backId}`)).toHaveCSS('z-index', '2');
});

test('WebGL 2 renderer creates a real graphics canvas', async ({ page }, info) => {
  await page.goto('/');
  await requireWebGL2(page, info);
  await page.getByTestId('tab-scene-3d').click();
  const canvas = page.getByTestId('scene3d-viewport').locator('canvas');
  await expect(canvas).toBeVisible();
  expect(await canvas.evaluate((element) => Boolean((element as HTMLCanvasElement).getContext('webgl2')))).toBe(true);
  await expect(page.getByTestId('scene3d-unavailable')).toHaveCount(0);
});

test('editor remains usable when WebGL 2 is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      value: function (this: HTMLCanvasElement, contextId: string, ...args: unknown[]) {
        if (contextId.includes('webgl')) return null;
        return Reflect.apply(original, this, [contextId, ...args]);
      },
    });
  });
  await page.goto('/');
  await page.getByTestId('tab-scene-3d').click();
  await expect(page.getByTestId('scene3d-unavailable')).toContainText('3D graphics unavailable');
  await expect(page.getByTestId('scene3d-soft-preview')).toBeVisible();
  await expect(page.getByTestId('scene3d-soft-object-starter-cube')).toBeVisible();
  await expect(page.getByTestId('scene3d-soft-camera')).toBeVisible();
  const softwareRenderer = page.getByTestId('scene3d-software-renderer');
  await expect(softwareRenderer).toBeVisible();
  expect(await softwareRenderer.locator('path').count()).toBeGreaterThan(12);
  expect(Number(await softwareRenderer.getAttribute('data-rendered-faces'))).toBeGreaterThan(12);
  await expect(page.getByLabel('Project actions')).toBeVisible();
  await page.getByTestId('scene-render-settings').locator('summary').click();
  await expect(page.getByTestId('scene-render-grid')).toBeChecked();
  await page.getByTestId('scene-render-grid').uncheck();
  const exposure = page.getByTestId('scene-render-exposure');
  await exposure.focus();
  await exposure.press('ArrowRight');
  await expect(exposure).toHaveValue('1.1');
  await page.reload();
  await page.getByTestId('tab-scene-3d').click();
  await page.getByTestId('scene-render-settings').locator('summary').click();
  await expect(page.getByTestId('scene-render-grid')).not.toBeChecked();
  await expect(page.getByTestId('scene-render-exposure')).toHaveValue('1.1');
  await page.getByTestId('tab-scene-2d').click();
  await expect(page.getByTestId('scene-field')).toBeVisible();
  await expect(page.getByTestId('scene-player')).toBeVisible();
});

test('scene objects and local transforms persist with the active project', async ({ page }) => {
  await page.goto('/');
  await page.locator('.workspace-browser-hierarchy > summary').click();
  await page.getByTestId('add-sprite-object').click();
  const object = page.locator('[data-testid^="scene-object-"]').last();
  const entityId = await object.getAttribute('data-entity-id');
  expect(entityId).toBeTruthy();

  await page.locator('.workspace-browser-data > summary').click();
  await page.getByTestId('input-object-name').fill('Hero');
  await page.getByTestId('transform-position-x').fill('72');
  await expect(page.getByTestId(`scene-object-${entityId}`)).toHaveAttribute('data-x', '72');
  await expect.poll(async () => page.evaluate(() => {
    const projects = JSON.parse(localStorage.getItem('madhorse-ui-projects') ?? '[]');
    const hero = projects[0]?.entities?.find((entry: { name: string }) => entry.name === 'Hero');
    const transform = hero?.components?.find((entry: { type: string }) => entry.type === 'transform');
    return transform?.position?.x;
  })).toBe(72);

  await page.reload();
  await page.locator('.workspace-browser-hierarchy > summary').click();
  await expect(page.getByTestId(`select-object-${entityId}`)).toContainText('Hero');
});

test('scripts can be assigned, run only on their object, persist, report object errors, and be removed', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await page.locator('.workspace-browser-hierarchy > summary').click();
  await page.getByTestId('add-sprite-object').click();
  const object = page.locator('[data-testid^="scene-object-"]').last();
  const entityId = await object.getAttribute('data-entity-id');
  expect(entityId).toBeTruthy();

  const command = 'MADHORSE_GAME {"version":1,"object":"self","action":"setPosition","x":75,"y":35}';
  await page.getByLabel('Script tools').click();
  await page.locator('.script-file-input').setInputFiles({
    name: 'attached.js',
    mimeType: 'text/javascript',
    buffer: Buffer.from(`console.log(${JSON.stringify(command)});`),
  });
  await expect(page.getByLabel('Script to run')).toHaveValue(/.+/);
  const scriptId = await page.getByLabel('Script to run').inputValue();

  await page.locator('.workspace-browser-data > summary').click();
  await page.getByTestId('select-object-script').selectOption(scriptId);
  await expect.poll(() => page.evaluate((id) => {
    const projects = JSON.parse(localStorage.getItem('madhorse-ui-projects') ?? '[]');
    const entity = projects[0]?.entities?.find((entry: { id: string }) => entry.id === id);
    return entity?.components?.find((component: { type: string }) => component.type === 'script')?.scriptId;
  }, entityId)).toBe(scriptId);

  await page.getByRole('button', { name: 'Run assigned scripts' }).click();
  await expect(page.getByTestId(`scene-object-${entityId}`)).toHaveAttribute('data-x', '75', { timeout: 180_000 });
  await expect(page.getByTestId(`scene-object-${entityId}`)).toHaveAttribute('data-y', '35');
  await expect(page.getByTestId('scene-player')).toHaveAttribute('data-x', '50');
  await expect(page.getByTestId('scene-player')).toHaveAttribute('data-y', '50');
  await expect.poll(() => page.evaluate((id) => {
    const projects = JSON.parse(localStorage.getItem('madhorse-ui-projects') ?? '[]');
    const entity = projects[0]?.entities?.find((entry: { id: string }) => entry.id === id);
    return entity?.components?.find((component: { type: string }) => component.type === 'transform')?.position;
  }, entityId)).toEqual({ x: 40, y: 28, z: 0 });

  await page.locator('#script-source').fill(`console.log(${JSON.stringify('MADHORSE_GAME {"version":1,"object":"player","action":"setPosition","x":20,"y":20}')});`);
  await page.getByRole('button', { name: 'Run assigned scripts' }).click();
  await expect(page.locator('.script-run-status')).toHaveText('Script stopped with an error.');
  await expect(page.getByLabel('Script output')).toContainText('Sprite 1 (attached.js): Invalid game command');

  await page.reload();
  await page.locator('.workspace-browser-hierarchy > summary').click();
  await page.getByTestId(`select-object-${entityId}`).click();
  await page.locator('.workspace-browser-data > summary').click();
  await expect(page.getByTestId('select-object-script')).toHaveValue(scriptId);
  await page.getByTestId('remove-object-script').click();
  await expect(page.getByTestId('select-object-script')).toHaveValue('');
  await expect.poll(() => page.evaluate((id) => {
    const projects = JSON.parse(localStorage.getItem('madhorse-ui-projects') ?? '[]');
    const entity = projects[0]?.entities?.find((entry: { id: string }) => entry.id === id);
    return entity?.components?.some((component: { type: string }) => component.type === 'script') ?? false;
  }, entityId)).toBe(false);
});

test('new objects get editable physics and Play previews gravity without saving runtime motion', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      value: function (this: HTMLCanvasElement, contextId: string, ...args: unknown[]) {
        if (contextId.includes('webgl')) return null;
        return Reflect.apply(original, this, [contextId, ...args]);
      },
    });
  });
  await page.goto('/');
  await page.locator('.workspace-browser-hierarchy > summary').click();
  await page.getByTestId('add-sprite-object').click();
  const object = page.locator('[data-testid^="scene-object-"]').last();
  const entityId = await object.getAttribute('data-entity-id');
  expect(entityId).toBeTruthy();

  await page.locator('.workspace-browser-data > summary').click();
  await expect(page.getByTestId('select-physics-body-type')).toHaveValue('dynamic');
  await expect(page.getByTestId('toggle-physics-collider')).toBeChecked();
  await page.getByTestId('physics-mass').fill('2');
  await page.getByTestId('physics-friction').fill('0.7');
  await page.getByTestId('physics-mass').fill('1001');
  await expect(page.locator('[data-testid="physics-status"]').first()).toContainText('Invalid physics setting');
  await expect(page.getByTestId('physics-mass')).toHaveValue('2');
  await page.getByTestId('physics-mass').fill('2');
  await page.getByTestId('physics-gravity-y').fill('-1001');
  await expect(page.locator('[data-testid="physics-status"]').first()).toContainText('Gravity must stay');
  await page.getByTestId('physics-gravity-y').fill('-9.81');

  await page.getByTestId('select-physics-dimension').selectOption('3d');
  await expect(page.getByTestId('physics-gravity-z')).toHaveValue('-9.81');
  await expect(page.getByTestId('physics-size-z')).toBeVisible();
  await page.getByTestId('select-physics-dimension').selectOption('2d');
  await expect(page.getByTestId('physics-gravity-y')).toHaveValue('-9.81');

  const originalY = Number(await object.getAttribute('data-y'));
  expect(originalY).toBe(28);
  await page.locator('.workspace-browser-data > summary').click();
  await page.getByTestId('button-play-game').click();
  await expect(page.getByTestId('status-play')).toContainText('Physics preview running');
  await expect.poll(async () => Number(await object.getAttribute('data-y'))).toBeLessThan(originalY);
  await expect.poll(() => page.evaluate((id) => {
    const projects = JSON.parse(localStorage.getItem('madhorse-ui-projects') ?? '[]');
    const entity = projects[0]?.entities?.find((entry: { id: string }) => entry.id === id);
    const transform = entity?.components?.find((entry: { type: string }) => entry.type === 'transform');
    const physics = entity?.components?.find((entry: { type: string }) => entry.type === 'physics');
    return {
      y: transform?.position?.y,
      mass: physics?.mass,
      friction: physics?.friction,
      dimension: projects[0]?.physics?.dimension,
    };
  }, entityId)).toEqual({ y: originalY, mass: 2, friction: 0.7, dimension: '2d' });

  await page.getByTestId('button-stop-game').click();
  await expect(object).toHaveAttribute('data-y', String(originalY));

  await page.locator('.workspace-browser-data > summary').click();
  await page.getByTestId('select-physics-dimension').selectOption('3d');
  await page.locator('.workspace-browser-data > summary').click();
  const originalZ = Number(await object.getAttribute('data-z'));
  await page.getByTestId('button-play-game').click();
  await expect.poll(async () => Number(await object.getAttribute('data-z'))).toBeGreaterThan(originalZ);
  await expect.poll(() => page.evaluate((id) => {
    const projects = JSON.parse(localStorage.getItem('madhorse-ui-projects') ?? '[]');
    const entity = projects[0]?.entities?.find((entry: { id: string }) => entry.id === id);
    const transform = entity?.components?.find((entry: { type: string }) => entry.type === 'transform');
    return { z: transform?.position?.z, dimension: projects[0]?.physics?.dimension };
  }, entityId)).toEqual({ z: originalZ, dimension: '3d' });
  await page.getByTestId('button-stop-game').click();
  await expect(object).toHaveAttribute('data-z', String(originalZ));
});

test('image and model assets persist in this browser and images can be assigned to sprites', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('tab-scene-3d').click();
  const geometry = Buffer.alloc(42);
  [-0.8, 0, 0, 0.8, 0, 0, 0, 1, 0].forEach((value, index) => geometry.writeFloatLE(value, index * 4));
  [0, 1, 2].forEach((value, index) => geometry.writeUInt16LE(value, 36 + index * 2));
  const dataUri = `data:application/octet-stream;base64,${geometry.toString('base64')}`;
  const gltf = {
    asset: { version: '2.0', generator: 'Madhorse editor test' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
    buffers: [{ uri: dataUri, byteLength: geometry.length }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 36 },
      { buffer: 0, byteOffset: 36, byteLength: 6 },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [-0.8, 0, 0], max: [0.8, 1, 0] },
      { bufferView: 1, componentType: 5123, count: 3, type: 'SCALAR', min: [0], max: [2] },
    ],
  };
  await page.locator('.workspace-browser-assets > summary').click();
  await page.getByTestId('input-assets').setInputFiles([
    {
      name: 'pixel.png',
      mimeType: 'image/png',
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/4wAAAABJRU5ErkJggg==', 'base64'),
    },
    {
      name: 'sample.gltf',
      mimeType: 'model/gltf+json',
      buffer: Buffer.from(JSON.stringify(gltf)),
    },
  ]);

  const imageCard = page.locator('[data-testid^="asset-card-"]').filter({ hasText: 'pixel.png' });
  const modelCard = page.locator('[data-testid^="asset-card-"]').filter({ hasText: 'sample.gltf' });
  await expect(imageCard).toBeVisible();
  await expect(modelCard).toContainText('Model file');
  const imageCardId = await imageCard.getAttribute('data-testid');
  const imageId = imageCardId?.replace('asset-card-', '');
  expect(imageId).toBeTruthy();
  await page.getByTestId(`apply-asset-${imageId}`).click();
  await expect(page.getByTestId('scene-player')).toHaveAttribute('data-sprite-asset-id', imageId!);
  await expect(page.getByTestId(`remove-asset-${imageId}`)).toBeDisabled();
  await page.getByTestId('tab-scene-2d').click();
  await expect(page.getByTestId('scene-game-view').locator('canvas').or(page.getByTestId('scene-field'))).toBeVisible();
  if (await page.getByTestId('game-camera-fallback').isVisible()) {
    await expect(page.getByTestId('scene-player').locator('img')).toBeVisible();
  }
  await page.getByTestId('tab-scene-3d').click();

  const modelCardId = await modelCard.getAttribute('data-testid');
  const modelId = modelCardId?.replace('asset-card-', '');
  expect(modelId).toBeTruthy();
  await page.getByTestId(`apply-asset-${modelId}`).click();
  await expect(page.getByTestId('scene-player')).toHaveAttribute('data-model-asset-id', modelId!);
  const graphicsAvailable = await page.getByTestId('scene3d-unavailable').count() === 0;
  if (graphicsAvailable) {
    await expect(page.getByTestId('scene3d-asset-status')).toContainText('Model ready · sample.gltf', { timeout: 30_000 });
  }
  await page.locator('.workspace-browser-data > summary').click();
  await page.getByTestId('transform-position-x').fill('63');
  await page.getByTestId('transform-rotation-y').fill('37');
  await page.getByTestId('transform-scale-z').fill('1.5');
  await expect(page.getByTestId(`remove-asset-${modelId}`)).toBeDisabled();
  await page.getByTestId('tab-scene-2d').click();
  await expect(page.getByTestId('scene-game-view')).toBeVisible();
  if (graphicsAvailable) {
    await expect(page.getByTestId('scene3d-asset-status')).toContainText('Model ready · sample.gltf', { timeout: 30_000 });
  }
  await expect.poll(async () => page.evaluate(() => {
    const projects = JSON.parse(localStorage.getItem('madhorse-ui-projects') ?? '[]');
    return projects[0]?.assets?.length;
  })).toBe(2);

  await page.reload();
  await page.getByTestId('tab-scene-3d').click();
  await page.locator('.workspace-browser-assets > summary').click();
  await expect(page.locator('[data-testid^="asset-card-"]').filter({ hasText: 'pixel.png' })).toBeVisible();
  await expect(page.getByTestId('scene-player')).toHaveAttribute('data-sprite-asset-id', imageId!);
  await expect(page.getByTestId('scene-player')).toHaveAttribute('data-model-asset-id', modelId!);
  await page.locator('.workspace-browser-data > summary').click();
  await expect(page.getByTestId('transform-position-x')).toHaveValue('63');
  await expect(page.getByTestId('transform-rotation-y')).toHaveValue('37');
  await expect(page.getByTestId('transform-scale-z')).toHaveValue('1.5');
  if (graphicsAvailable) {
    await expect(page.getByTestId('scene3d-asset-status')).toContainText('Model ready · sample.gltf', { timeout: 30_000 });
  } else {
    await expect(page.getByTestId('scene3d-unavailable')).toBeVisible();
  }
  await page.getByTestId('remove-model-renderer').click();
  await expect(page.getByTestId('scene-player')).toHaveAttribute('data-model-asset-id', '');
});

test('OBJ models without geometry are rejected while valid model geometry is accepted', () => {
  const loader = new OBJLoader();
  const invalid = loader.parse('this is not a valid OBJ model');
  const valid = loader.parse('v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3');
  expect(hasRenderableModelGeometry(invalid)).toBe(false);
  expect(hasRenderableModelGeometry(valid)).toBe(true);
});
