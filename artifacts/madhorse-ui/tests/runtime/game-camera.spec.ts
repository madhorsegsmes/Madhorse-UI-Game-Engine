import { expect } from '@playwright/test';
import { MathUtils, Vector3 } from 'three';
import { cameraWithOrbitPose } from '../../src/lib/camera-editor';
import { createGameCamera, isGameCamera, makeGameViewCamera } from '../../src/lib/game-camera';
import { createDefaultPlayer, getTransform } from '../../src/lib/scene-model';
import { test } from './fixtures';

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
