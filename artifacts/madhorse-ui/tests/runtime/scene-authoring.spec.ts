import { expect, type Page } from '@playwright/test';
import { PerspectiveCamera, Vector3 } from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { test } from './fixtures';
import { createDefaultPlayer, createSceneEntity, getTransform, getPrimitive, getWorldTransform, isSceneGraph, type SceneEntity } from '../../src/lib/scene-model';
import { capturePrefab, createSceneElement, generateProjectAsset, instantiatePrefab, isPrefabCollection } from '../../src/lib/scene-authoring';
import { cameraForEntity, createGameCamera } from '../../src/lib/game-camera';
import { createPrimitiveGeometry, sceneFrameDistance } from '../../src/lib/scene-view-geometry';
import type { AuthoringDocument } from '../../src/hooks/use-scene-authoring';
import { createUIControlElement } from '../../src/lib/ui-controls';

const saved = (page: Page): Promise<AuthoringDocument> => page.evaluate(() =>
  JSON.parse(localStorage.getItem('madhorse-ui-projects') ?? '[]')[0] ?? { id: '', entities: [], assets: [] });
const hierarchy = async (page: Page) => {
  if (!(await page.getByTestId('hierarchy-panel').isVisible())) await page.locator('.workspace-browser-hierarchy > summary').click();
};

test('new scene types, prefab subtrees and geometry remain valid independent project data', async () => {
  const entities = [createDefaultPlayer()];
  for (const kind of ['object', 'plane', 'terrain', 'light', 'camera'] as const) {
    entities.push(createSceneElement(kind, entities));
  }
  expect(isSceneGraph(entities)).toBe(true);
  expect(cameraForEntity(entities, entities[5].id)?.position.z).toBeLessThan(0);
  const parent = entities[1];
  const child = createSceneEntity('Child', { x: 60, y: 50, z: 50 }, parent.id);
  entities.push(child);
  const world = getWorldTransform(entities, child.id);
  const canvas = createSceneEntity('UI Canvas', undefined, parent.id, false);
  const control = createUIControlElement('panel', 0);
  canvas.components.push({ id: crypto.randomUUID(), type: 'uiCanvas', enabled: true, controlId: control.id });
  entities.push(canvas);
  const prefab = capturePrefab(entities, parent.id, 'Reusable group', [control]);
  expect(isPrefabCollection([prefab])).toBe(true);
  const first = instantiatePrefab(prefab);
  const second = instantiatePrefab(prefab);
  expect(isSceneGraph([...entities, ...first.entities, ...second.entities])).toBe(true);
  expect(first.entities[1].parentId).toBe(first.rootId);
  const clonedWorld = getWorldTransform(first.entities, first.entities[1].id)!;
  expect(clonedWorld.position).toEqual(world!.position);
  expect(clonedWorld.rotation).toEqual(world!.rotation);
  expect(clonedWorld.scale).toEqual(world!.scale);
  expect(first.uiControls[0].id).not.toBe(control.id);
  expect(first.entities[2].components.find((component) => component.type === 'uiCanvas')).toMatchObject({ controlId: first.uiControls[0].id });
  getTransform(first.entities[0]).position.x += 10;
  expect(getTransform(prefab.entities[0]).position.x).not.toBe(getTransform(first.entities[0]).position.x);
  expect(isPrefabCollection([{ ...prefab, rootId: 'missing' }])).toBe(false);
  for (const shape of ['cube', 'plane', 'terrain'] as const) {
    const geometry = createPrimitiveGeometry(shape);
    expect([...geometry.getAttribute('position').array].every(Number.isFinite)).toBe(true);
    if (shape === 'terrain') {
      const attribute = geometry.getAttribute('position');
      const heights = Array.from({ length: attribute.count }, (_, i) => attribute.getY(i));
      expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(1);
    }
    geometry.dispose();
  }
  const file = await generateProjectAsset({ kind: 'cube', name: 'Reusable cube', color: '#ffffff',
    secondaryColor: '#000000', pattern: 'solid', size: 64 });
  const model = new OBJLoader().parse(await file.text());
  expect(model.children.length).toBeGreaterThan(0);
});

test('initial scene framing includes both north camera and square at desktop and phone aspects', () => {
  const settings = createGameCamera([createDefaultPlayer()]);
  for (const aspect of [16 / 9, 402 / 470, 9 / 16]) {
    const camera = new PerspectiveCamera(48, aspect, .1, 3000);
    const center = new Vector3(
      (settings.position.x + settings.target.x) / 2,
      (settings.position.y + settings.target.y) / 2,
      (settings.position.z + settings.target.z) / 2,
    );
    camera.position.copy(center).addScaledVector(new Vector3(1, .9, 1.2).normalize(), sceneFrameDistance(settings, aspect));
    camera.lookAt(center);
    camera.updateMatrixWorld();
    for (const point of [settings.position, settings.target]) {
      const projected = new Vector3(point.x, point.y, point.z).project(camera);
      expect(Math.abs(projected.x)).toBeLessThan(.95);
      expect(Math.abs(projected.y)).toBeLessThan(.95);
      expect(projected.z).toBeLessThan(1);
    }
  }
});

test('scene zoom, expansion, all creation actions and camera selection work and survive reload', async ({ page }) => {
  await page.setViewportSize({ width: 402, height: 874 });
  await page.goto('/');
  await page.getByTestId('tab-scene-3d').click();
  await expect(page.getByTestId('scene-camera-marker')).toBeVisible();
  const viewport = page.getByTestId('scene3d-viewport');
  await viewport.hover();
  await page.mouse.wheel(0, -180);
  await expect(page.getByTestId('scene-zoom-value')).not.toHaveText('100%');
  const wheelZoom = Number((await page.getByTestId('scene-zoom-value').textContent())?.replace('%', ''));
  expect(wheelZoom).toBeGreaterThan(100);
  await page.getByTestId('scene-zoom-in').click();
  await expect(page.getByTestId('scene-zoom-value')).toHaveText(`${wheelZoom + 25}%`);
  await page.getByTestId('scene-frame-camera').click();
  await expect(page.getByTestId('scene-zoom-value')).toHaveText('100%');
  await page.getByTestId('scene-expand').click();
  await expect(page.locator('.stage')).toHaveClass(/is-scene-expanded/);
  await expect(page.getByTestId('scene-camera-marker')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.stage')).not.toHaveClass(/is-scene-expanded/);
  await hierarchy(page);
  for (const id of ['button-create-object', 'button-create-plane', 'button-create-terrain', 'button-add-lighting', 'button-create-camera']) {
    await page.getByTestId(id).click();
  }
  await expect.poll(async () => (await saved(page)).entities.length).toBe(7);
  const project = await saved(page);
  const camera = project.entities.find((entity) => entity.components.some((component) => component.type === 'camera'))!;
  await page.getByTestId('select-active-camera').selectOption(camera.id);
  await page.getByTestId('close-hierarchy').click();
  await page.getByTestId('tab-scene-2d').click();
  const cameraSettings = cameraForEntity(project.entities, camera.id)!;
  await expect(page.getByTestId('scene-game-view')).toHaveAttribute('data-camera-position', JSON.stringify(cameraSettings.position));
  await hierarchy(page);
  await page.getByTestId('button-create-ui-canvas').click();
  await expect(page.locator('.game-ui-element.is-canvas-root')).toBeVisible();
  await expect.poll(async () => (await saved(page)).entities.length).toBe(8);
  await page.reload();
  await hierarchy(page);
  const restored = await saved(page);
  expect(isSceneGraph(restored.entities)).toBe(true);
  expect(restored.uiControls?.length).toBe(1);
  expect(restored.activeCameraId).toBe(camera.id);
  await expect(page.getByTestId('select-active-camera')).toHaveValue(camera.id);
  await page.getByTestId('select-active-camera').selectOption('');
  await page.getByTestId('close-hierarchy').click();
  await expect(page.getByTestId('scene-game-view')).toHaveAttribute('data-camera-position', '{"x":0,"y":6,"z":-8}');
});

test('link, unlink, prefab cloning, texture creation and assignment are persistent', async ({ page }) => {
  await page.goto('/');
  await hierarchy(page);
  await page.getByTestId('button-create-object').click();
  await page.getByTestId('button-create-object').click();
  await expect.poll(async () => (await saved(page)).entities.length).toBe(4);
  const initial = await saved(page);
  const [parent, child] = initial.entities.filter((entity) => entity.id !== 'player' && entity.id !== 'starter-cube');
  const before = getWorldTransform(initial.entities, child.id);
  await page.getByTestId('select-link-parent').selectOption(parent.id);
  await page.getByTestId('button-link-objects').click();
  await expect.poll(async () => (await saved(page)).entities.find((e) => e.id === child.id)?.parentId).toBe(parent.id);
  expect(getWorldTransform((await saved(page)).entities, child.id)).toEqual(before);
  await page.getByTestId('button-unlink-object').click();
  await expect.poll(async () => (await saved(page)).entities.find((e) => e.id === child.id)?.parentId).toBeNull();
  expect(getWorldTransform((await saved(page)).entities, child.id)).toEqual(before);
  await page.getByTestId('button-create-texture').click();
  await page.getByTestId('input-asset-name').fill('Checker tile');
  await page.getByTestId('select-asset-pattern').selectOption('checker');
  await page.getByTestId('select-asset-size').selectOption('64');
  await page.getByTestId('button-generate-asset').click();
  await expect.poll(async () => (await saved(page)).assets.length).toBe(1);
  const asset = (await saved(page)).assets[0];
  expect(asset.name).toBe('Checker tile.png');
  expect(asset.kind).toBe('image');
  await page.locator('.workspace-browser-assets > summary').click();
  await expect.poll(() => page.getByTestId(`asset-card-${asset.id}`).locator('img').evaluate((element: HTMLImageElement) => element.naturalWidth)).toBe(64);
  await page.getByTestId(`apply-asset-${asset.id}`).click();
  await expect.poll(async () => getPrimitive((await saved(page)).entities.find((e) => e.id === child.id)!)?.textureAssetId).toBe(asset.id);
  await hierarchy(page);
  await page.getByTestId('input-prefab-name').fill('Textured cube');
  await page.getByTestId('button-create-prefab').click();
  await expect.poll(async () => (await saved(page)).prefabs?.length).toBe(1);
  const prefab = (await saved(page)).prefabs![0];
  await page.getByTestId(`button-instantiate-prefab-${prefab.id}`).click();
  await expect.poll(async () => (await saved(page)).entities.length).toBe(5);
  const instance = (await saved(page)).entities.find((e) => e.name === 'Textured cube instance')!;
  expect(instance.id).not.toBe(child.id);
  expect(getPrimitive(instance)?.textureAssetId).toBe(asset.id);
  await page.reload();
  await hierarchy(page);
  await expect(page.getByTestId(`row-prefab-${prefab.id}`)).toBeVisible();
  await expect(page.getByTestId(`hierarchy-object-${instance.id}`)).toBeVisible();
  await page.getByTestId(`button-remove-prefab-${prefab.id}`).click();
  await page.getByTestId(`button-confirm-remove-prefab-${prefab.id}`).click();
  await expect.poll(async () => (await saved(page)).prefabs?.length).toBe(0);
  expect((await saved(page)).entities.some((e) => e.id === instance.id)).toBe(true);
});

test('removing a UI canvas also removes its screen-space frame without touching other data', async ({ page }) => {
  await page.goto('/');
  await hierarchy(page);
  await page.getByTestId('button-create-ui-canvas').click();
  await expect(page.locator('.game-ui-element.is-canvas-root')).toBeVisible();
  await expect.poll(async () => (await saved(page)).uiControls?.length).toBe(1);
  await page.getByTestId('close-hierarchy').click();
  await page.locator('.workspace-browser-data > summary').click();
  await page.getByTestId('toggle-object-active').uncheck();
  await expect(page.locator('.game-ui-element.is-canvas-root')).toHaveCount(0);
  await page.getByTestId('toggle-object-active').check();
  await expect(page.locator('.game-ui-element.is-canvas-root')).toBeVisible();
  await page.getByTestId('remove-object').click();
  await page.getByTestId('confirm-remove-object-button').click();
  await expect.poll(async () => (await saved(page)).uiControls?.length).toBe(0);
  await expect(page.locator('.game-ui-element.is-canvas-root')).toHaveCount(0);
  expect((await saved(page)).entities.map((entity: SceneEntity) => entity.id)).toEqual(['player', 'starter-cube']);
});
