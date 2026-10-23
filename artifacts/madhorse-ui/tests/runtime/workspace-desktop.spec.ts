import { test, expect } from '@playwright/test';

test('desktop workspace uses the screen width and keeps numbered panels and camera controls separate', async ({ page }) => {
  await page.goto('/');
  for (const [width, height] of [[1366, 768], [1920, 1080], [2560, 1440]]) {
    await page.setViewportSize({ width, height });
    await expect.poll(() => page.locator('.shell').evaluate((element) => element.getBoundingClientRect().width)).toBeGreaterThan(width * .98);
    const preview = await page.getByTestId('scene-preview').boundingBox();
    expect(preview!.width).toBeGreaterThan(width * .9);
    expect(preview!.height).toBeGreaterThan(240);
    const camera = await page.getByTestId('scene-camera-controls').boundingBox();
    expect(camera!.y).toBeGreaterThan(preview!.y + preview!.height);
    const panels = await page.locator('.panel-row').boundingBox();
    const footer = await page.locator('.shell-footer').boundingBox();
    expect(footer!.y).toBeGreaterThanOrEqual(panels!.y + panels!.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    expect(Number.parseFloat(await page.getByTestId('tab-scene-2d').evaluate((element) => getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(12);
  }
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.getByTestId('scene-camera-controls').locator('summary').click();
  const expandedCamera = await page.getByTestId('scene-camera-controls').boundingBox();
  const toolbars = await page.locator('.toolbar-row').boundingBox();
  expect(toolbars!.y).toBeGreaterThanOrEqual(expandedCamera!.y + expandedCamera!.height);
  await expect(page.getByTestId('camera-input-px')).toBeVisible();
});
