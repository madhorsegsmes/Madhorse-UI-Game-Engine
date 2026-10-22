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
