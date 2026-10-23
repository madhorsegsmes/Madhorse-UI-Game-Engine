import { test, expect } from '@playwright/test';
import { Euler, MathUtils, Quaternion, Vector3 } from 'three';
import { cameraEuler, cameraFromEditorTransform, cameraWithPose, cameraDisplayEntity, primaryCameraEntity,
  updateCameraEntityTransform, PRIMARY_CAMERA_ID } from '../../src/lib/camera-editor';
import { cameraForEntity, cameraWorldMatrix, createGameCamera, isGameCamera, makeGameViewCamera } from '../../src/lib/game-camera';
import { createSceneElement } from '../../src/lib/scene-authoring';
import { createDefaultPlayer, createSceneEntity, getTransform, getCamera } from '../../src/lib/scene-model';

test('primary camera pose roundtrips through gizmos, preserves aim when moved and supports roll', () => {
  const original = createGameCamera([createDefaultPlayer()]);
  const proxy = primaryCameraEntity(original);
  expect(proxy.id).toBe(PRIMARY_CAMERA_ID);
  const roundtrip = cameraFromEditorTransform(original, getTransform(proxy))!;
  expect(makeGameViewCamera(roundtrip, 1).quaternion.angleTo(makeGameViewCamera(original, 1).quaternion)).toBeLessThan(1e-6);
  const moved = cameraWithPose(original, { position: { x: 3, y: 5, z: -12 } })!;
  expect(moved.placement).toBe('custom');
  expect(makeGameViewCamera(moved, 1).getWorldDirection(new Vector3()).distanceTo(
    makeGameViewCamera(original, 1).getWorldDirection(new Vector3()))).toBeLessThan(1e-6);
  const rolled = cameraWithPose(moved, { rotation: { ...cameraEuler(moved), z: 37 }, fov: 65 })!;
  expect(isGameCamera(JSON.parse(JSON.stringify(rolled)))).toBe(true);
  expect(rolled.fov).toBe(65);
  const quaternion = new Quaternion().setFromEuler(new Euler(MathUtils.degToRad(rolled.rotation!.x),
    MathUtils.degToRad(rolled.rotation!.y), MathUtils.degToRad(rolled.rotation!.z), 'XYZ'));
  expect(makeGameViewCamera(rolled, 1).quaternion.angleTo(quaternion)).toBeLessThan(1e-6);
  expect(makeGameViewCamera(rolled, 1).quaternion.angleTo(makeGameViewCamera(moved, 1).quaternion)).toBeGreaterThan(.1);
  expect(cameraWithPose(original, { position: { x: Infinity, y: 1, z: 0 } })).toBeNull();
  expect(cameraWithPose(original, { fov: 120 })).toBeNull();
});

test('extra camera moving and rotating matches its rendered parent transforms without mutating originals', () => {
  const player = createDefaultPlayer();
  const parent = createSceneEntity('Camera mount', { x: 65, y: 35, z: 20 }, null, false);
  getTransform(parent).rotation = { x: 20, y: -10, z: 35 };
  getTransform(parent).scale = { x: 1.2, y: .8, z: 1.4 };
  const camera = createSceneElement('camera', [player]);
  camera.parentId = parent.id;
  getTransform(camera).position = { x: 50, y: 20, z: 80 };
  const original = [player, parent, camera], before = structuredClone(original);
  const oldSettings = cameraForEntity(original, camera.id)!;
  const displayed = cameraDisplayEntity(original, camera);
  const moved = updateCameraEntityTransform(original, camera.id, {
    position: { ...getTransform(camera).position, x: 60 },
    rotation: getTransform(displayed).rotation,
  })!;
  expect(original).toEqual(before);
  expect(getCamera(moved[2])?.useTransformRotation).toBe(true);
  expect(cameraForEntity(moved, camera.id)).not.toBeNull();
  const posed = updateCameraEntityTransform(moved, camera.id, {
    rotation: { x: 25, y: 40, z: -15 },
  })!;
  const settings = cameraForEntity(posed, camera.id)!;
  const matrix = cameraWorldMatrix(posed, camera.id)!;
  const position = new Vector3(), orientation = new Quaternion();
  matrix.decompose(position, orientation, new Vector3());
  orientation.normalize();
  expect(makeGameViewCamera(settings, 1).position.distanceTo(position)).toBeLessThan(1e-6);
  expect(makeGameViewCamera(settings, 1).quaternion.angleTo(orientation)).toBeLessThan(1e-6);
  expect(settings.target).not.toEqual(oldSettings.target);
  expect(updateCameraEntityTransform(original, camera.id, { position: { x: NaN, y: 0, z: 0 } })).toBeNull();
});

test('phone camera controls save pose, update Canvas and reset north without creating scene entities', async ({ page }) => {
  await page.setViewportSize({ width: 402, height: 874 });
  await page.goto('/');
  const controls = page.getByTestId('scene-camera-controls');
  await expect(controls).toBeVisible();
  expect(await controls.evaluate((element) => !element.closest('.stage') && !element.closest('[data-testid=\"scene-preview\"]'))).toBe(true);
  const previewBounds = await page.getByTestId('scene-preview').boundingBox();
  const controlsBounds = await controls.boundingBox();
  expect(controlsBounds!.y).toBeGreaterThanOrEqual(previewBounds!.y + previewBounds!.height);
  await controls.locator('summary').click();
  await page.getByTestId('scene-select-game-camera').click();
  await expect(page.getByTestId('tab-scene-3d')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('scene-camera-marker')).toHaveAttribute('data-selected', 'true');
  const set = async (field: string, value: string) => {
    await page.getByTestId(`camera-input-${field}`).fill(value);
    await page.getByTestId(`camera-input-${field}`).press('Enter');
  };
  await set('px', '3');
  await set('py', '7');
  await set('ry', '25');
  await set('rz', '30');
  await set('fov', '65');
  const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('madhorse-ui-projects') ?? '[]')[0]);
  await expect.poll(async () => (await saved())?.gameCamera?.fov).toBe(65);
  const custom = await saved();
  expect(custom.entities).toHaveLength(1);
  expect(custom.gameCamera.position.x).toBe(3);
  expect(custom.gameCamera.position.y).toBe(7);
  expect(custom.gameCamera.rotation.z).toBeCloseTo(30);
  expect(custom.gameCamera.placement).toBe('custom');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: '../../generated-artifacts/camera-editor-phone.jpg' });
  await set('fov', '120');
  await expect(controls.getByRole('alert')).toContainText('between 10 and 100');
  await page.getByTestId('scene-camera-view-through').click();
  await expect(page.getByTestId('tab-scene-2d')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('[data-camera-fov]')).toHaveAttribute('data-camera-fov', '65');
  await page.reload();
  await page.getByTestId('tab-scene-3d').click();
  await page.getByTestId('scene-camera-controls').locator('summary').click();
  await expect(page.getByTestId('camera-input-px')).toHaveValue('3');
  await expect(page.getByTestId('camera-input-fov')).toHaveValue('65');
  await page.getByTestId('scene-camera-reset-north').click();
  await expect.poll(async () => (await saved()).gameCamera.placement).toBe('north');
  expect((await saved()).gameCamera.position.z).toBeLessThan((await saved()).gameCamera.target.z);
  expect((await saved()).entities).toHaveLength(1);
  // Viewing the primary must not accidentally leave an additional camera active.
  await page.evaluate(() => {
    const projects = JSON.parse(localStorage.getItem('madhorse-ui-projects')!);
    const project = projects[0];
    project.entities.push({ id: 'test-secondary-camera', name: 'Secondary Camera', parentId: null, active: true,
      components: [
        { id: 'secondary-transform', type: 'transform', enabled: true, position: { x: 50, y: -30, z: 60 },
          rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
        { id: 'secondary-lens', type: 'camera', enabled: true, fov: 40, target: { x: 50, y: 50, z: 0 } },
      ] });
    project.activeCameraId = 'test-secondary-camera';
    localStorage.setItem('madhorse-ui-projects', JSON.stringify(projects));
  });
  await page.reload();
  await expect(page.locator('[data-camera-fov]')).toHaveAttribute('data-camera-fov', '40');
  await page.getByTestId('tab-scene-3d').click();
  await page.getByTestId('scene-camera-controls').locator('summary').click();
  await page.getByTestId('scene-camera-view-through').click();
  await expect(page.locator('[data-camera-fov]')).toHaveAttribute('data-camera-fov', '50');
  await expect.poll(async () => (await saved()).activeCameraId).toBeNull();
});
