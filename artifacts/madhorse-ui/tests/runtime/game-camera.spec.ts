import { expect } from '@playwright/test';
import { Vector3 } from 'three';
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

test('Panel 3 camera aims at the square, saves per project and shows the shared scene', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('scene-game-view')).toBeVisible();
  await expect(page.getByTestId('scene-game-view')).toHaveAttribute('data-camera-target', '{"x":0,"y":0,"z":0}');
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
  await expect(page.getByTestId('scene-preview-3d')).toHaveAttribute('data-scene-entity-count', '2');
  await page.locator('.workspace-browser-hierarchy > summary').click();
  await page.getByTestId('show-game-view').click();
  await expect(page.getByTestId('tab-scene-2d')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('scene-game-view')).toHaveAttribute('data-scene-entity-count', '2');
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
