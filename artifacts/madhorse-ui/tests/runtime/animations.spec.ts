import { expect } from '@playwright/test';
import { test } from './fixtures';

test('Panel 3 creates, previews, edits, and saves an animation without saving its preview transform', async ({ page }) => {
  await page.goto('/');
  await page.locator('.system-panel-tools details').first().locator('summary').click();
  await page.getByTestId('create-animation').click();

  const editor = page.getByTestId('animation-editor');
  await expect(editor.getByLabel('Animation name')).toHaveValue('Player Animation');
  const finalFrame = editor.locator('.animation-keyframe').nth(1);
  await finalFrame.getByLabel('Pos X').fill('80');
  await finalFrame.getByLabel('Rot Z').fill('90');

  await page.getByTestId('animation-play').click();
  await expect(page.getByTestId('scene-player')).toHaveAttribute('data-x', '80', { timeout: 5_000 });
  await expect(page.getByTestId('scene-player')).toHaveAttribute('data-y', '50');

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('madhorse-ui-projects') ?? '[]'));
  expect(saved[0].animations).toHaveLength(1);
  expect(saved[0].animations[0].keyframes[1].position.x).toBe(80);
  expect(saved[0].animations[0].keyframes[1].rotation.z).toBe(90);
  const savedPlayerTransform = saved[0].entities[0].components.find((component: { type: string }) => component.type === 'transform');
  expect(savedPlayerTransform.position.x).toBe(50);

  await page.getByTestId('animation-stop').click();
  await expect(page.getByTestId('scene-player')).toHaveAttribute('data-x', '50');
  await page.reload();
  await page.locator('.system-panel-tools details').first().locator('summary').click();
  await expect(page.getByLabel('Animation name')).toHaveValue('Player Animation');
  await expect(page.getByTestId('animation-editor').locator('.animation-keyframe').nth(1).getByLabel('Pos X')).toHaveValue('80');
});
