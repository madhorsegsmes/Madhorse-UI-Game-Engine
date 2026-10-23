import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

const defaultOrder = [
  'main',
  'scene',
  'camera',
  'tools-left',
  'tools-right',
  'system',
  'play',
  'errors',
];

async function currentOrder(page: Page) {
  return page.locator('.workspace-board > [data-workspace-panel]').evaluateAll((panels) =>
    panels.map((panel) => panel.getAttribute('data-workspace-panel')));
}

test('workspace panels snap into order, persist after reload, and reset to the default', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 1800 });
  await page.goto('/');
  await expect.poll(() => currentOrder(page)).toEqual(defaultOrder);
  await expect(page.locator('.workspace-panel-handle')).toHaveCount(defaultOrder.length);

  const sourceHandle = page.getByTestId('move-panel-tools-right');
  await sourceHandle.scrollIntoViewIfNeeded();
  const source = await sourceHandle.boundingBox();
  const target = await page.locator('[data-workspace-panel="tools-left"]').boundingBox();
  expect(source).not.toBeNull();
  expect(target).not.toBeNull();
  await page.mouse.move(source!.x + source!.width / 2, source!.y + source!.height / 2);
  await page.mouse.down();
  await page.mouse.move(target!.x + 10, target!.y + target!.height / 2, { steps: 12 });
  await page.mouse.up();

  const movedOrder = [...defaultOrder];
  movedOrder.splice(movedOrder.indexOf('tools-right'), 1);
  movedOrder.splice(movedOrder.indexOf('tools-left'), 0, 'tools-right');
  await expect.poll(() => currentOrder(page)).toEqual(movedOrder);
  await page.reload();
  await expect.poll(() => currentOrder(page)).toEqual(movedOrder);

  await page.getByTestId('reset-workspace-layout').click();
  await expect.poll(() => currentOrder(page)).toEqual(defaultOrder);
  await expect.poll(() => page.evaluate(() => JSON.parse(
    localStorage.getItem('madhorse-workspace-panel-order') ?? '[]',
  ))).toEqual(defaultOrder);
});

test('panel handles support keyboard reordering', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 1400 });
  await page.goto('/');
  const handle = page.getByTestId('move-panel-tools-right');
  await handle.focus();
  await handle.press('ArrowUp');
  const expected = [...defaultOrder];
  expected.splice(4, 1);
  expected.splice(3, 0, 'tools-right');
  await expect.poll(() => currentOrder(page)).toEqual(expected);
});
