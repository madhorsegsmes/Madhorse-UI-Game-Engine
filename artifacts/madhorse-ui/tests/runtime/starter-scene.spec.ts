import { test, expect } from '@playwright/test';
import { createDefaultPhysicsWorldSettings, createStarterCube, createStarter3DSceneEntities, createDefaultPlayer, getPhysicsComponent, getPrimitive, getTransform, isSceneGraph } from '../../src/lib/scene-model';
import { createGameCamera } from '../../src/lib/game-camera';
import { createPrimitiveGeometry } from '../../src/lib/scene-view-geometry';

test('starter cube is a centered, editable 3D solid with a matching static collider', () => {
  const cube = createStarterCube();
  const primitive = getPrimitive(cube);
  const physics = getPhysicsComponent(cube);
  const geometry = createPrimitiveGeometry('cube');
  expect(primitive).toMatchObject({ shape: 'cube', color: '#c1c4cb', enabled: true, textureAssetId: null });
  expect(getTransform(cube)).toMatchObject({ position: { x: 50, y: 50, z: 0 }, scale: { x: 1, y: 1, z: 1 } });
  expect(physics).toMatchObject({ bodyType: 'static', colliderEnabled: true, size: { x: 10, y: 10, z: 10 } });
  expect(geometry.getAttribute('position').count).toBeGreaterThan(0);
  expect(isSceneGraph([createDefaultPlayer(), cube])).toBe(true);
  expect(createGameCamera([createDefaultPlayer(), cube]).target).toEqual({ x: 0, y: 0, z: 0 });
  geometry.dispose();
});

test('3D starter scene includes a visible ground, matching static collider, and directional light', () => {
  const entities = createStarter3DSceneEntities();
  const cube = entities.find((entity) => entity.id === 'starter-cube')!;
  const ground = entities.find((entity) => entity.id === 'starter-ground')!;
  const light = entities.find((entity) => entity.id === 'starter-directional-light')!;
  const plane = getPrimitive(ground);
  const collider = getPhysicsComponent(ground);
  expect(plane).toMatchObject({ shape: 'plane', enabled: true, color: '#71816d', textureAssetId: null });
  expect(getTransform(ground)).toMatchObject({ position: { x: 50, y: 50, z: 0 } });
  expect(collider).toMatchObject({
    bodyType: 'static', colliderEnabled: true, size: { x: 100, y: 100, z: 0.1 },
  });
  expect(getPrimitive(cube)).toMatchObject({ shape: 'cube' });
  expect(getTransform(cube).position.z).toBe(5);
  expect(light.components.find((component) => component.type === 'light')).toMatchObject({
    kind: 'directional', enabled: true, intensity: 2,
  });
  expect(light.components.find((component) => component.type === 'physics')).toBeUndefined();
  expect(isSceneGraph(entities)).toBe(true);
});

test('fresh projects show the cube in 3D, keep the 2D player intact, and migrate only once', async ({ page, browser }) => {
  await page.goto('/');
  const project = () => page.evaluate(() => {
    const stored = localStorage.getItem('madhorse-ui-projects');
    return stored ? JSON.parse(stored)[0] ?? null : null;
  });
  await expect(page.getByTestId('scene-game-view')).toBeVisible();
  await expect.poll(project).not.toBeNull();
  await expect.poll(async () => (await project())?.entities?.length).toBe(2);
  await expect(page.getByTestId('scene-game-view')).toHaveAttribute('data-camera-target', '{"x":0,"y":0,"z":0}');
  await expect(page.getByTestId('scene-player')).toBeVisible();
  await expect(page.getByTestId('scene-object-starter-cube')).toHaveCount(0);
  let saved = await project();
  expect(saved.starterSceneInitialized).toBe(true);
  expect(saved.entities.map((entity: { id: string }) => entity.id)).toEqual(['player', 'starter-cube']);
  await page.getByTestId('tab-scene-3d').click();
  await expect(page.getByTestId('scene-preview-3d')).toHaveAttribute('data-scene-entity-count', '2');
  await page.waitForTimeout(400);

  await page.evaluate(() => {
    const projects = JSON.parse(localStorage.getItem('madhorse-ui-projects')!);
    delete projects[0].starterSceneInitialized;
    projects[0].entities = projects[0].entities.filter((entity: { id: string }) => entity.id === 'player');
    localStorage.setItem('madhorse-ui-projects', JSON.stringify(projects));
  });
  await page.reload();
  await expect.poll(async () => (await project()).entities.length).toBe(2);
  saved = await project();
  expect(saved.starterSceneInitialized).toBe(true);
  await page.waitForTimeout(400);

  await page.evaluate(() => {
    const projects = JSON.parse(localStorage.getItem('madhorse-ui-projects')!);
    projects[0].entities = projects[0].entities.filter((entity: { id: string }) => entity.id !== 'starter-cube');
    localStorage.setItem('madhorse-ui-projects', JSON.stringify(projects));
  });
  await page.reload();
  await expect.poll(async () => (await project()).starterSceneInitialized).toBe(true);
  expect((await project()).entities.map((entity: { id: string }) => entity.id)).toEqual(['player']);

  const customContext = await browser.newContext();
  const customPage = await customContext.newPage();
  const customCameraProject = {
    id: 'custom-camera-project', name: 'Untitled Project', gameType: '', savedAt: '',
    scripts: [], entities: [createDefaultPlayer()], assets: [],
    physics: createDefaultPhysicsWorldSettings(), animations: [], uiControls: [],
    gameCamera: { position: { x: 0, y: 6, z: -8 }, target: { x: 0, y: 0, z: 0 }, fov: 50, placement: 'custom' },
  };
  await customPage.addInitScript((projects) => {
    localStorage.setItem('madhorse-ui-projects', JSON.stringify(projects));
  }, [customCameraProject]);
  await customPage.goto('/');
  const customProject = () => customPage.evaluate(() => JSON.parse(localStorage.getItem('madhorse-ui-projects')!)[0]);
  await expect.poll(async () => (await customProject()).starterSceneInitialized).toBe(true);
  expect((await customProject()).entities.map((entity: { id: string }) => entity.id)).toEqual(['player']);
  expect((await customProject()).gameCamera.placement).toBe('custom');
  await customContext.close();
});
