import { expect } from '@playwright/test';
import { isGamePosition } from '../../src/lib/game-api';
import { test, openScripts, importSource, run, finished, frames } from './fixtures';

const storageKey = 'madhorse-ui-projects';
const player = (page: import('@playwright/test').Page) => page.getByTestId('scene-player');
async function showStartControls(page: import('@playwright/test').Page) {
  const settings = page.getByTestId('scene-preview-settings');
  if (!await settings.evaluate((element) => (element as HTMLDetailsElement).open)) {
    await settings.locator('summary').click();
  }
}

test('saved coordinates accept only finite numbers in the scene bounds', () => {
  for (const value of [null, [], {}, { x: '50', y: 50 }, { x: NaN, y: 50 },
    { x: 50, y: Infinity }, { x: -1, y: 50 }, { x: 50, y: 101 }]) {
    expect(isGamePosition(value)).toBe(false);
  }
  expect(isGamePosition({ x: 0, y: 100 })).toBe(true);
  expect(isGamePosition({ x: 12.5, y: 30.25 })).toBe(true);
});

test('saved start survives scripts, reset, project switches and reloads', async ({ page }) => {
  await openScripts(page);
  await showStartControls(page);
  await page.getByLabel('Starting X', { exact: true }).fill('20.5');
  await page.getByLabel('Starting Y', { exact: true }).fill('80');
  // Drafts do not save or move the runtime.
  await expect(player(page)).toHaveAttribute('data-x', '50');
  await page.getByRole('button', { name: 'Save starting position', exact: true }).click();
  await expect(player(page)).toHaveAttribute('data-x', '20.5');
  await importSource(page, 'relative.js', 'console.log(\'MADHORSE_GAME {"version":1,"object":"player","action":"move","x":10,"y":-5}\')');
  await run(page);
  await finished(page);
  await expect(player(page)).toHaveAttribute('data-x', '30.5');
  await expect(player(page)).toHaveAttribute('data-y', '75');
  await expect(page.locator('.scene-start-controls')).toContainText('Saved start · x 20.5 · y 80');
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!)[0].entities
    .find((entity: { id: string }) => entity.id === 'player').components
    .find((component: { type: string }) => component.type === 'transform').position, storageKey))
    .toMatchObject({ x: 20.5, y: 80 });
  await page.getByRole('button', { name: 'Reset scene', exact: true }).click();
  await expect(player(page)).toHaveAttribute('data-x', '20.5');
  await run(page);
  await finished(page);
  await page.getByLabel('Project actions').click();
  const original = await page.getByLabel('Choose project').inputValue();
  page.once('dialog', dialog => dialog.accept('Separate scene'));
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  await expect(player(page)).toHaveAttribute('data-x', '50');
  await showStartControls(page);
  await page.getByLabel('Starting X', { exact: true }).fill('0');
  await page.getByLabel('Starting Y', { exact: true }).fill('100');
  await page.getByRole('button', { name: 'Save starting position', exact: true }).click();
  await page.getByLabel('Choose project').selectOption(original);
  await expect(player(page)).toHaveAttribute('data-x', '20.5');
  await expect(player(page)).toHaveAttribute('data-y', '80');
  await page.reload();
  await expect(player(page)).toHaveAttribute('data-x', '20.5');
  await expect(player(page)).toHaveAttribute('data-y', '80');
  await page.getByLabel('Project actions').click();
  await page.getByLabel('Choose project').selectOption({ index: 1 });
  await expect(player(page)).toHaveAttribute('data-x', '0');
  await expect(player(page)).toHaveAttribute('data-y', '100');
});

test('invalid drafts cannot save, and old or malformed saved positions use the default', async ({ page }) => {
  await page.goto('/');
  for (const initialPosition of [undefined, { x: -1, y: 40 }, { x: '25', y: 10 }, { x: null, y: 20 }]) {
    await page.evaluate(({ key, initialPosition }) => {
      localStorage.setItem(key, JSON.stringify([{ id: 'legacy', name: 'Legacy', gameType: '', savedAt: '', initialPosition }]));
    }, { key: storageKey, initialPosition });
    await page.reload();
    await expect(player(page)).toHaveAttribute('data-x', '50');
    await expect(player(page)).toHaveAttribute('data-y', '50');
  }
  await showStartControls(page);
  for (const value of ['', '-1', '101']) {
    await page.getByLabel('Starting X', { exact: true }).fill(value);
    await expect(page.getByRole('button', { name: 'Save starting position', exact: true })).toBeDisabled();
    await expect(player(page)).toHaveAttribute('data-x', '50');
  }
});

test('running scripts cannot edit saved coordinates and switching projects revokes the runner', async ({ page }) => {
  await openScripts(page);
  await showStartControls(page);
  await page.getByLabel('Starting X', { exact: true }).fill('25');
  await page.getByRole('button', { name: 'Save starting position', exact: true }).click();
  await importSource(page, 'loop.js', 'console.log(\'MADHORSE_GAME {"version":1,"object":"player","action":"setPosition","x":75,"y":35}\'); while(true) {}');
  await run(page);
  await expect(player(page)).toHaveAttribute('data-x', '75', { timeout: 180_000 });
  await expect(page.getByLabel('Starting X', { exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Save starting position', exact: true })).toBeDisabled();
  await page.getByLabel('Project actions').click();
  page.once('dialog', dialog => dialog.accept('New scene'));
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  await expect(frames(page)).toHaveCount(0);
  await expect(player(page)).toHaveAttribute('data-x', '50');
  await page.getByLabel('Choose project').selectOption({ index: 0 });
  await expect(player(page)).toHaveAttribute('data-x', '25');
});

test('scene editor positioning and explicit start controls share one saved start', async ({ page }) => {
  await openScripts(page);
  await showStartControls(page);
  await page.getByLabel('Starting X', { exact: true }).fill('25');
  await page.getByRole('button', { name: 'Save starting position', exact: true }).click();
  await player(page).focus();
  await player(page).press('ArrowRight');
  await expect(player(page)).toHaveAttribute('data-x', '26');
  await expect(page.getByLabel('Starting X', { exact: true })).toHaveValue('26');
  await importSource(page, 'preview.js', 'console.log(\'MADHORSE_GAME {"version":1,"object":"player","action":"setPosition","x":75,"y":35}\')');
  await run(page);
  await finished(page);
  await expect(player(page)).toHaveAttribute('data-x', '75');
  await expect(page.getByLabel('Starting X', { exact: true })).toHaveValue('26');
  await page.getByRole('button', { name: 'Reset scene', exact: true }).click();
  await expect(player(page)).toHaveAttribute('data-x', '26');
  await page.reload();
  await expect(player(page)).toHaveAttribute('data-x', '26');
});
