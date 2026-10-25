import { expect } from '@playwright/test';
import { MathUtils, Vector3 } from 'three';
import { cameraWithOrbitPose } from '../../src/lib/camera-editor';
import { createGameCamera, isGameCamera, makeGameViewCamera } from '../../src/lib/game-camera';
import { createDefaultPlayer, getSpriteRenderer, getTransform } from '../../src/lib/scene-model';
import { test } from './fixtures';
import { gpuPixels, requireWebGL2, setGPUScene, twoColorSprite } from './gpu-fixtures';

for (const viewport of [{ width: 1280, height: 900 }, { width: 402, height: 874 }]) {
  test.describe(`${viewport.width}px graphics`, () => {
  test.use({ hasTouch: viewport.width === 402, deviceScaleFactor: viewport.width === 402 ? 2 : 1 });
  test(`GPU camera centers the aimed square and excludes editor graphics at ${viewport.width}px`, async ({ page }, info) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await requireWebGL2(page, info);
    const player = createDefaultPlayer();
    getTransform(player).position = { x: 70, y: 30, z: 20 };
    await setGPUScene(page, [player], { ...createGameCamera([createDefaultPlayer()]), placement: 'custom' });
    const canvas = page.getByTestId('scene-game-view').locator('canvas');
    const before = await gpuPixels(canvas, info, 'before-aim');
    expect(before.stats.red.count).toBeGreaterThan(100);
    expect(Math.hypot(before.stats.red.x / before.width - .5, before.stats.red.y / before.height - .5)).toBeGreaterThan(.08);
    await page.getByTestId('button-game-camera').click();
    await page.getByTestId('aim-game-camera').click();
    await page.getByTestId('button-game-camera').click();
    await expect.poll(async () => {
      const pixels = await gpuPixels(canvas, info, 'aimed-square');
      const s = pixels.stats.red;
      expect(s.count).toBeGreaterThan(100);
      expect(pixels.backgroundFraction).toBeGreaterThan(.995);
      // Perspective makes the near half slightly larger. Bounding-box center remains close.
      return Math.max(Math.abs((s.minX + s.maxX) / 2 / pixels.width - .5),
        Math.abs((s.minY + s.maxY) / 2 / pixels.height - .5));
    }).toBeLessThan(.025);
    await expect(page.getByTestId('scene3d-mode-translate')).toHaveCount(0);
    await expect(page.getByTestId('scene-grid-status')).toHaveCount(0);
    await expect(page.getByTestId('game-camera-fallback')).toHaveCount(0);
  });

  test(`GPU textured sprite is upright and inactive objects are absent at ${viewport.width}px`, async ({ page }, info) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await requireWebGL2(page, info);
    await page.locator('.workspace-browser-assets > summary').click();
    await page.getByTestId('input-assets').setInputFiles(await twoColorSprite(page));
    const card = page.locator('[data-testid^="asset-card-"]').filter({ hasText: 'upright.png' });
    await expect(card).toBeVisible();
    const assetId = (await card.getAttribute('data-testid'))!.replace('asset-card-', '');
    const player = createDefaultPlayer();
    getSpriteRenderer(player)!.assetId = assetId;
    const hidden = createDefaultPlayer();
    hidden.id = 'hidden'; hidden.name = 'Hidden green sprite';
    getTransform(hidden).position.x = 20;
    getSpriteRenderer(hidden)!.tint = '#00ff00';
    await setGPUScene(page, [player, hidden]);
    const canvas = page.getByTestId('scene-game-view').locator('canvas');
    // Positive control proves the hidden-object fixture is inside the camera frustum.
    await expect.poll(async () => (await gpuPixels(canvas, info, 'active-control')).stats.green.count).toBeGreaterThan(100);
    hidden.active = false;
    await setGPUScene(page, [player, hidden]);
    await expect.poll(async () => (await gpuPixels(canvas, info, 'upright-sprite')).stats.blue.count).toBeGreaterThan(100);
    const pixels = await gpuPixels(canvas, info, 'inactive-hidden');
    expect(pixels.stats.red.count).toBeGreaterThan(100);
    expect(pixels.stats.blue.y, 'Texture top (red) must be above texture bottom (blue)').toBeGreaterThan(pixels.stats.red.y);
    expect(pixels.stats.green.count).toBe(0);
    // An active descendant of an inactive parent must be hidden too.
    const child = structuredClone(hidden);
    child.id = 'hidden-child'; child.parentId = hidden.id; child.active = true;
    getTransform(child).position = { x: 50, y: 50, z: 50 };
    await setGPUScene(page, [player, hidden, child]);
    await expect.poll(async () => (await gpuPixels(canvas, info, 'inactive-parent')).stats.blue.count).toBeGreaterThan(100);
    expect((await gpuPixels(canvas, info, 'inactive-descendant-hidden')).stats.green.count).toBe(0);
  });
  });
}

test('Panel 3 validates and saves custom camera pose and zoom on phones without moving objects', async ({ page }) => {
  await page.setViewportSize({ width: 402, height: 874 });
  await page.goto('/');
  const view = page.getByTestId('scene-game-view');
  const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('madhorse-ui-projects')!)[0]);
  await expect(view).toBeVisible();
  const before = await saved();
  await page.getByTestId('button-game-camera').click();
  const field = (name: string) => page.getByTestId(`game-camera-${name}`);
  for (const [name, value] of Object.entries({ px: '3.5', py: '7', pz: '-12', tx: '1', ty: '2', tz: '-1', fov: '35' })) {
    await field(name).fill(value);
  }
  const bounds = await field('px').boundingBox();
  expect(bounds!.height).toBeGreaterThanOrEqual(44);
  await expect(view).toHaveAttribute('data-camera-fov', String(before.gameCamera.fov));
  await page.getByTestId('apply-game-camera').click();
  await expect(view).toHaveAttribute('data-camera-position', '{"x":3.5,"y":7,"z":-12}');
  await expect(view).toHaveAttribute('data-camera-target', '{"x":1,"y":2,"z":-1}');
  await expect(view).toHaveAttribute('data-camera-fov', '35');
  expect((await saved()).entities).toEqual(before.entities);
  for (const invalid of ['', '101', '9']) {
    await field('fov').fill(invalid);
    await page.getByTestId('apply-game-camera').click();
    await expect(page.locator('.game-camera-settings [role="alert"]')).toBeVisible();
    await expect(view).toHaveAttribute('data-camera-fov', '35');
  }
  await field('fov').fill('35');
  await field('px').fill('100001');
  await page.getByTestId('apply-game-camera').click();
  await expect(page.locator('.game-camera-settings [role="alert"]')).toBeVisible();
  await field('px').fill('3.5');
  for (const [name, value] of Object.entries({ tx: '3.5', ty: '7', tz: '-12' })) await field(name).fill(value);
  await page.getByTestId('apply-game-camera').click();
  await expect(page.locator('.game-camera-settings [role="alert"]')).toBeVisible();
  await expect(view).toHaveAttribute('data-camera-target', '{"x":1,"y":2,"z":-1}');
  await page.reload();
  await expect(view).toHaveAttribute('data-camera-fov', '35');
  await expect(view).toHaveAttribute('data-camera-position', '{"x":3.5,"y":7,"z":-12}');
  await page.getByLabel('Project actions').click();
  const original = await page.getByLabel('Choose project').inputValue();
  page.once('dialog', (dialog) => dialog.accept('Custom camera isolation'));
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  await expect(view).toHaveAttribute('data-camera-fov', '50');
  await page.getByLabel('Choose project').selectOption(original);
  await expect(view).toHaveAttribute('data-camera-fov', '35');
  await page.getByLabel('Project actions').click();
  await page.getByTestId('button-game-camera').click();
  await page.getByTestId('aim-game-camera').click();
  await expect(view).toHaveAttribute('data-camera-fov', '50');
  await expect(view).toHaveAttribute('data-camera-position', JSON.stringify(createGameCamera(before.entities).position));
  expect((await saved()).entities).toEqual(before.entities);
});

test('game camera points at the square and projects it to the exact center', () => {
  const player = createDefaultPlayer();
  getTransform(player).position = { x: 70, y: 30, z: 20 };
  const settings = createGameCamera([player]);
  expect(settings.target).toEqual({ x: 2, y: 2, z: -2 });
  expect(settings.position).toEqual({ x: 2, y: 8, z: -10 });
  expect(isGameCamera(settings)).toBe(true);
  for (const aspect of [402 / 400, 16 / 9, 9 / 16]) {
    const camera = makeGameViewCamera(settings, aspect);
    const projected = new Vector3(2, 2, -2).project(camera);
    expect(projected.x).toBeCloseTo(0, 10);
    expect(projected.y).toBeCloseTo(0, 10);
    expect(projected.z).toBeGreaterThan(-1);
    expect(projected.z).toBeLessThan(1);
    const right = new Vector3(3, 2, -2).project(camera);
    const down = new Vector3(2, 2, -1).project(camera);
    expect(right.x).toBeLessThan(0);
    expect(down.y).toBeGreaterThan(0);
  }
  expect(isGameCamera({ ...settings, target: settings.position })).toBe(false);
  expect(isGameCamera({ ...settings, fov: NaN })).toBe(false);
  expect(isGameCamera({ ...settings, position: { x: Infinity, y: 12, z: 0 } })).toBe(false);
});

test('camera orbit pose keeps the object target fixed', () => {
  const initial = createGameCamera([createDefaultPlayer()]);
  const position = { x: 6, y: 6, z: -Math.sqrt(28) };
  const oriented = makeGameViewCamera({ ...initial, position }, 16 / 9);
  const updated = cameraWithOrbitPose(initial, {
    position,
    rotation: {
      x: MathUtils.radToDeg(oriented.rotation.x),
      y: MathUtils.radToDeg(oriented.rotation.y),
      z: MathUtils.radToDeg(oriented.rotation.z),
    },
  });
  expect(updated).not.toBeNull();
  expect(updated?.position).toEqual(position);
  expect(updated?.placement).toBe('custom');
  expect(updated?.target).toEqual(initial.target);
  expect(new Vector3(updated!.position.x, updated!.position.y, updated!.position.z)
    .distanceTo(new Vector3(updated!.target.x, updated!.target.y, updated!.target.z)))
    .toBeCloseTo(new Vector3(initial.position.x, initial.position.y, initial.position.z)
      .distanceTo(new Vector3(initial.target.x, initial.target.y, initial.target.z)), 8);
});

test('Panel 3 camera aims at the square, saves per project and shows the shared scene', async ({ page }) => {
  await page.goto('/');
  const gameView = page.getByTestId('scene-game-view');
  await expect(gameView).toBeVisible();
  await expect(gameView).toHaveAttribute('data-render-mode', 'automatic');
  await expect(gameView).toHaveAttribute('data-lighting-mode', 'automatic');
  await expect(gameView).toHaveAttribute('data-camera-target', '{"x":0,"y":0,"z":0}');
  await page.locator('.workspace-browser-data > summary').click();
  await page.getByTestId('transform-position-x').fill('70');
  await page.getByTestId('transform-position-y').fill('30');
  await page.getByTestId('transform-position-z').fill('20');
  // Moving an object does not silently move the saved game camera.
  await expect(page.getByTestId('scene-game-view')).toHaveAttribute('data-camera-target', '{"x":2,"y":2,"z":-2}');
  await page.getByTestId('button-game-camera').click();
  await page.getByTestId('aim-game-camera').click();
  await expect(page.getByTestId('scene-game-view')).toHaveAttribute('data-camera-target', '{"x":2,"y":2,"z":-2}');
  await expect(page.getByTestId('scene-game-view')).toHaveAttribute('data-camera-position', '{"x":2,"y":8,"z":-10}');
  await expect.poll(() => page.evaluate(() =>
    JSON.parse(localStorage.getItem('madhorse-ui-projects')!)[0].gameCamera.target,
  )).toEqual({ x: 2, y: 2, z: -2 });

  await page.getByTestId('tab-scene-3d').click();
  await page.locator('.workspace-browser-hierarchy > summary').click();
  await page.getByTestId('add-sprite-object').click();
  await expect(page.getByTestId('scene-preview-3d')).toHaveAttribute('data-scene-entity-count', '3');
  await page.locator('.workspace-browser-hierarchy > summary').click();
  await page.getByTestId('show-game-view').click();
  await expect(page.getByTestId('tab-scene-2d')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('scene-game-view')).toHaveAttribute('data-scene-entity-count', '3');
  await expect(page.getByTestId('scene3d-mode-translate')).toHaveCount(0);

  await page.reload();
  await expect(page.getByTestId('scene-game-view')).toHaveAttribute('data-camera-target', '{"x":2,"y":2,"z":-2}');
  await page.getByLabel('Project actions').click();
  const original = await page.getByLabel('Choose project').inputValue();
  page.once('dialog', (dialog) => dialog.accept('Separate camera'));
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  await expect(page.getByTestId('scene-game-view')).toHaveAttribute('data-camera-target', '{"x":0,"y":0,"z":0}');
  await page.getByLabel('Choose project').selectOption(original);
  await expect(page.getByTestId('scene-game-view')).toHaveAttribute('data-camera-target', '{"x":2,"y":2,"z":-2}');
});

test('Canvas drag orbits the saved Game Camera around its target; Reset north restores the default pose', async ({ page }) => {
  await page.goto('/');
  const gameView = page.getByTestId('scene-game-view');
  await expect(gameView).toBeVisible();
  await expect(page.getByTestId('canvas-orbit-free')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('canvas-orbit-y').click();
  await expect(gameView).toHaveAttribute('data-orbit-mode', 'y');
  await page.getByTestId('canvas-orbit-x').click();
  await expect(gameView).toHaveAttribute('data-orbit-mode', 'x');
  await page.getByTestId('canvas-orbit-free').click();
  await expect(gameView).toHaveAttribute('data-orbit-mode', 'free');
  const savedPosition = JSON.parse((await gameView.getAttribute('data-camera-position'))!);
  const savedTarget = JSON.parse((await gameView.getAttribute('data-camera-target'))!);
  const canvas = gameView.locator('canvas');
  await expect(canvas).toBeVisible();
  const bounds = await canvas.boundingBox();
  expect(bounds).not.toBeNull();
  await page.mouse.move(bounds!.x + bounds!.width * 0.5, bounds!.y + bounds!.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(bounds!.x + bounds!.width * 0.68, bounds!.y + bounds!.height * 0.42, { steps: 6 });
  await page.mouse.up();
  await expect(gameView).toHaveAttribute('data-view-rotated', 'true');
  const orbitPosition = JSON.parse((await gameView.getAttribute('data-camera-position'))!);
  expect(orbitPosition).not.toEqual(savedPosition);
  const orbitTarget = JSON.parse((await gameView.getAttribute('data-camera-target'))!);
  expect(orbitTarget).toEqual(savedTarget);
  const originalDistance = new Vector3(savedPosition.x, savedPosition.y, savedPosition.z)
    .distanceTo(new Vector3(savedTarget.x, savedTarget.y, savedTarget.z));
  const orbitDistance = new Vector3(orbitPosition.x, orbitPosition.y, orbitPosition.z)
    .distanceTo(new Vector3(orbitTarget.x, orbitTarget.y, orbitTarget.z));
  expect(orbitDistance).toBeCloseTo(originalDistance, 6);
  await expect(page.getByTestId('scene-player')).toHaveAttribute('data-x', '50');
  await expect(page.getByTestId('scene-player')).toHaveAttribute('data-y', '50');
  await expect.poll(() => page.evaluate(() =>
    JSON.parse(localStorage.getItem('madhorse-ui-projects')!)[0].gameCamera.position,
  )).toEqual(orbitPosition);
  await page.getByTestId('canvas-reset-camera').click();
  await expect(gameView).toHaveAttribute('data-view-rotated', 'false');
  await expect(gameView).toHaveAttribute('data-camera-position', JSON.stringify(savedPosition));
  await expect(gameView).toHaveAttribute('data-camera-target', JSON.stringify(savedTarget));
  await expect.poll(() => page.evaluate(() =>
    JSON.parse(localStorage.getItem('madhorse-ui-projects')!)[0].gameCamera.placement,
  )).toBe('north');
});

test('Canvas Y and X orbit modes constrain camera movement to the selected axis', async ({ page }) => {
  await page.goto('/');
  const gameView = page.getByTestId('scene-game-view');
  await expect(gameView).toBeVisible();
  const canvas = gameView.locator('canvas');
  const bounds = await canvas.boundingBox();
  expect(bounds).not.toBeNull();

  const initialPosition = JSON.parse((await gameView.getAttribute('data-camera-position'))!);
  await page.getByTestId('canvas-orbit-y').click();
  await page.mouse.move(bounds!.x + bounds!.width * 0.5, bounds!.y + bounds!.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(bounds!.x + bounds!.width * 0.68, bounds!.y + bounds!.height * 0.5, { steps: 8 });
  await page.mouse.up();
  await expect(gameView).toHaveAttribute('data-view-rotated', 'true');
  const yOrbitPosition = JSON.parse((await gameView.getAttribute('data-camera-position'))!);
  expect(yOrbitPosition.y).toBeCloseTo(initialPosition.y, 5);

  await page.getByTestId('canvas-reset-camera').click();
  await expect(gameView).toHaveAttribute('data-view-rotated', 'false');
  await page.getByTestId('canvas-orbit-x').click();
  const xStart = JSON.parse((await gameView.getAttribute('data-camera-position'))!);
  const target = JSON.parse((await gameView.getAttribute('data-camera-target'))!);
  await page.mouse.move(bounds!.x + bounds!.width * 0.5, bounds!.y + bounds!.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(bounds!.x + bounds!.width * 0.5, bounds!.y + bounds!.height * 0.34, { steps: 8 });
  await page.mouse.up();
  await expect(gameView).toHaveAttribute('data-view-rotated', 'true');
  const xOrbitPosition = JSON.parse((await gameView.getAttribute('data-camera-position'))!);
  const startAzimuth = Math.atan2(xStart.x - target.x, xStart.z - target.z);
  const endAzimuth = Math.atan2(xOrbitPosition.x - target.x, xOrbitPosition.z - target.z);
  expect(xOrbitPosition.y).not.toBeCloseTo(xStart.y, 2);
  expect(endAzimuth).toBeCloseTo(startAzimuth, 4);
});
