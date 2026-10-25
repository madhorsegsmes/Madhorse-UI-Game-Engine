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
  expect(saved[0].animations[0].tracks[0].keyframes[1].position.x).toBe(80);
  expect(saved[0].animations[0].tracks[0].keyframes[1].rotation.z).toBe(90);
  const savedPlayerTransform = saved[0].entities[0].components.find((component: { type: string }) => component.type === 'transform');
  expect(savedPlayerTransform.position.x).toBe(50);

  await page.getByTestId('animation-stop').click();
  await expect(page.getByTestId('scene-player')).toHaveAttribute('data-x', '50');
  await page.reload();
  await page.locator('.system-panel-tools details').first().locator('summary').click();
  await expect(page.getByLabel('Animation name')).toHaveValue('Player Animation');
  await expect(page.getByTestId('animation-editor').locator('.animation-keyframe').nth(1).getByLabel('Pos X')).toHaveValue('80');
});

test('multiple object tracks share a timeline, persist, and can be removed during preview', async ({ page }) => {
  await page.goto('/');
  await page.locator('.system-panel-tools details').first().locator('summary').click();
  await page.getByTestId('create-animation').click();
  const editor = page.getByTestId('animation-editor');
  const savedEntities = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('madhorse-ui-projects') ?? '[]')[0].entities);
  await editor.getByLabel('Animation duration').fill('4');
  await editor.locator('.animation-keyframe').nth(1).getByLabel('Pos X').fill('90');
  await editor.getByLabel('New track object').selectOption('starter-cube');
  await editor.getByRole('button', { name: '+ Add track', exact: true }).click();
  await expect(editor.getByLabel('Animation target')).toHaveValue('starter-cube');
  await editor.locator('.animation-keyframe').nth(0).getByLabel('Time', { exact: true }).fill('1');
  await editor.locator('.animation-keyframe').nth(0).getByLabel('Pos X').fill('10');
  await editor.locator('.animation-keyframe').nth(1).getByLabel('Time', { exact: true }).fill('2');
  await editor.locator('.animation-keyframe').nth(1).getByLabel('Pos X').fill('30');
  const scrub = async (time: string) => {
    await editor.getByLabel('Animation timeline').fill(time);
  };
  await scrub('1.5');
  await expect(page.getByTestId('scene-player')).toHaveAttribute('data-x', '65');
  await expect(page.getByTestId('scene-object-starter-cube')).toHaveAttribute('data-x', '20');
  await scrub('3');
  await expect(page.getByTestId('scene-object-starter-cube')).toHaveAttribute('data-x', '30');

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('madhorse-ui-projects') ?? '[]')[0]);
  expect(saved.animations[0].tracks).toHaveLength(2);
  expect(saved.animations[0].tracks[1].keyframes.map((frame: { time: number }) => frame.time)).toEqual([1, 2]);
  expect(saved.entities).toEqual(savedEntities);
  await page.reload();
  await page.locator('.system-panel-tools details').first().locator('summary').click();
  await expect(editor.getByLabel('Animation track').locator('option')).toHaveCount(2);
  await editor.getByLabel('Animation track').selectOption(saved.animations[0].tracks[1].id);
  await scrub('1.5');
  await editor.getByRole('button', { name: 'Remove track', exact: true }).click();
  await expect(page.getByTestId('scene-object-starter-cube')).toHaveAttribute('data-x', '50');
  await expect(page.getByTestId('scene-player')).toHaveAttribute('data-x', '65');
  await page.getByTestId('animation-stop').click();
  await expect(page.getByTestId('scene-player')).toHaveAttribute('data-x', '50');
});
