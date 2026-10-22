import { expect } from '@playwright/test';
import { movementLanguages, movementStarter, scriptStorageError, sourceSize, maxScriptSize, maxProjectScriptsSize } from '../../src/lib/project-scripts';
import { test, openScripts, run, finished, frames, importSource } from './fixtures';

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

test('the game preview opens in 3D and still offers a working 2D view', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('tab-scene-3d')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('scene-preview-3d')).toBeVisible();
  await expect(page.getByTestId('scene3d-viewport').locator('canvas')).toBeVisible();
  await expect(page.getByTestId('scene3d-mode-translate')).toHaveAttribute('aria-pressed', 'true');

  await page.getByTestId('scene3d-mode-rotate').click();
  await expect(page.getByTestId('scene3d-mode-rotate')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('tab-scene-2d').click();
  await expect(page.getByTestId('scene-field')).toBeVisible();
  await page.getByTestId('tab-scene-3d').click();
  await expect(page.getByTestId('scene3d-viewport').locator('canvas')).toBeVisible();
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

test('image and model assets persist in this browser and images can be assigned to sprites', async ({ page }) => {
  await page.goto('/');
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
  await expect(page.getByTestId('scene-player').locator('img')).toBeVisible();
  await page.getByTestId('tab-scene-3d').click();

  const modelCardId = await modelCard.getAttribute('data-testid');
  const modelId = modelCardId?.replace('asset-card-', '');
  expect(modelId).toBeTruthy();
  await page.getByTestId(`apply-asset-${modelId}`).click();
  await expect(page.getByTestId('scene-player')).toHaveAttribute('data-model-asset-id', modelId!);
  await expect(page.getByTestId('scene3d-asset-status')).toContainText('Model ready · sample.gltf', { timeout: 30_000 });
  await expect(page.getByTestId(`remove-asset-${modelId}`)).toBeDisabled();
  await expect.poll(async () => page.evaluate(() => {
    const projects = JSON.parse(localStorage.getItem('madhorse-ui-projects') ?? '[]');
    return projects[0]?.assets?.length;
  })).toBe(2);

  await page.reload();
  await page.locator('.workspace-browser-assets > summary').click();
  await expect(page.locator('[data-testid^="asset-card-"]').filter({ hasText: 'pixel.png' })).toBeVisible();
  await expect(page.getByTestId('scene-player')).toHaveAttribute('data-sprite-asset-id', imageId!);
  await expect(page.getByTestId('scene-player')).toHaveAttribute('data-model-asset-id', modelId!);
  await expect(page.getByTestId('scene3d-asset-status')).toContainText('Model ready · sample.gltf', { timeout: 30_000 });
});
