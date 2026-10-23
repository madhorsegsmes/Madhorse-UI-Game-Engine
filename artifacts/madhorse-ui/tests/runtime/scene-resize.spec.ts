import { test, expect } from '@playwright/test';

test('all four corners resize Scene View, preserve camera data and remember the size', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');
  const stage = page.locator('.stage');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('madhorse-ui-projects'))).not.toBeNull();
  const projectData = await page.evaluate(() => {
    const project = JSON.parse(localStorage.getItem('madhorse-ui-projects')!)[0];
    return JSON.stringify({ camera: project.gameCamera, entities: project.entities });
  });
  const original = (await stage.boundingBox())!;
  for (const [corner, dx, dy] of [['tl', 120, 55], ['br', -140, -65], ['tr', -70, 35], ['bl', 80, -30]] as const) {
    const handle = page.getByTestId(`scene-resize-${corner}`);
    await handle.scrollIntoViewIfNeeded();
    const start = (await stage.boundingBox())!;
    const point = (await handle.boundingBox())!;
    await page.mouse.move(point.x + point.width / 2, point.y + point.height / 2);
    await page.mouse.down();
    await page.mouse.move(point.x + point.width / 2 + dx, point.y + point.height / 2 + dy, { steps: 6 });
    await page.mouse.up();
    await expect.poll(async () => (await stage.boundingBox())!.width).toBeLessThan(start.width - 50);
    await expect.poll(async () => (await stage.boundingBox())!.height).toBeLessThan(start.height - 20);
  }
  const resized = (await stage.boundingBox())!;
  await expect.poll(() => page.evaluate(() => Math.round(JSON.parse(localStorage.getItem('madhorse-scene-view-size')!).width))).toBe(Math.round(resized.width));
  const camera = (await page.getByTestId('scene-camera-controls').boundingBox())!;
  expect(camera.y).toBeGreaterThan(resized.y + resized.height);
  expect(await page.evaluate(() => {
    const project = JSON.parse(localStorage.getItem('madhorse-ui-projects')!)[0];
    return JSON.stringify({ camera: project.gameCamera, entities: project.entities });
  })).toBe(projectData);
  await page.reload();
  await expect.poll(async () => Math.round((await stage.boundingBox())!.width)).toBe(Math.round(resized.width));
  await expect.poll(async () => Math.round((await stage.boundingBox())!.height)).toBe(Math.round(resized.height));
  await page.getByTestId('scene-expand').click();
  await expect(page.getByTestId('scene-resize-br')).toBeHidden();
  await page.getByTestId('scene-expand').click();
  await expect.poll(async () => Math.round((await stage.boundingBox())!.width)).toBe(Math.round(resized.width));
  await page.setViewportSize({ width: 402, height: 874 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(402);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.getByTestId('scene-reset-size').click();
  await expect(stage).not.toHaveAttribute('data-user-sized');
  await expect.poll(async () => Math.round((await stage.boundingBox())!.width)).toBe(Math.round(original.width));
});

test('keyboard resizing and cancelled pointer drags leave a usable automatic layout', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto('/');
  const stage = page.locator('.stage');
  const handle = page.getByTestId('scene-resize-br');
  const original = (await stage.boundingBox())!;
  await handle.focus();
  await handle.press('ArrowLeft');
  await handle.press('Shift+ArrowLeft');
  await expect.poll(async () => Math.round((await stage.boundingBox())!.width)).toBe(Math.round(original.width - 25));
  await handle.press('Home');
  await expect(stage).not.toHaveAttribute('data-user-sized');
  const point = (await handle.boundingBox())!;
  await page.mouse.move(point.x + 14, point.y + 14);
  await page.mouse.down();
  await page.mouse.move(point.x - 110, point.y - 70, { steps: 4 });
  await expect(stage).toHaveAttribute('data-user-sized');
  await handle.dispatchEvent('pointercancel', { pointerId: 1, isPrimary: true });
  await page.mouse.up();
  await expect(stage).not.toHaveAttribute('data-user-sized');
  expect(await page.evaluate(() => localStorage.getItem('madhorse-scene-view-size'))).toBeNull();
});
