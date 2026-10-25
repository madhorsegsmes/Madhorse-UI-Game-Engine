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
    localStorage.getItem('madhorse-workspace-panel-order:desktop') ?? '[]',
  ))).toEqual(defaultOrder);
});

test('desktop, tablet, and mobile layouts stay independent across resize, reload, and reset', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 1400 });
  await page.goto('/');
  const desktopOrder = [...defaultOrder];
  desktopOrder.splice(4, 1);
  desktopOrder.splice(3, 0, 'tools-right');
  await page.getByTestId('move-panel-tools-right').focus();
  await page.getByTestId('move-panel-tools-right').press('ArrowUp');
  await expect.poll(() => currentOrder(page)).toEqual(desktopOrder);
  await expect(page.locator('.workspace-board')).toHaveAttribute('data-screen-group', 'desktop');

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.workspace-board')).toHaveAttribute('data-screen-group', 'mobile');
  await expect.poll(() => currentOrder(page)).toEqual(defaultOrder);
  const mobileOrder = [...defaultOrder];
  mobileOrder.splice(5, 1);
  mobileOrder.splice(4, 0, 'system');
  await page.getByTestId('move-panel-system').focus();
  await page.getByTestId('move-panel-system').press('ArrowUp');
  await expect.poll(() => currentOrder(page)).toEqual(mobileOrder);

  await page.setViewportSize({ width: 800, height: 1100 });
  await expect(page.locator('.workspace-board')).toHaveAttribute('data-screen-group', 'tablet');
  await expect.poll(() => currentOrder(page)).toEqual(defaultOrder);
  const tabletOrder = [...defaultOrder];
  tabletOrder.splice(7, 1);
  tabletOrder.splice(6, 0, 'errors');
  await page.getByTestId('move-panel-errors').focus();
  await page.getByTestId('move-panel-errors').press('ArrowUp');
  await expect.poll(() => currentOrder(page)).toEqual(tabletOrder);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => currentOrder(page)).toEqual(mobileOrder);
  await page.reload();
  await expect.poll(() => currentOrder(page)).toEqual(mobileOrder);
  await page.getByTestId('reset-workspace-layout').click();
  await expect.poll(() => currentOrder(page)).toEqual(defaultOrder);
  await expect.poll(() => page.evaluate(() => JSON.parse(
    localStorage.getItem('madhorse-workspace-panel-order:mobile') ?? '[]',
  ))).toEqual(defaultOrder);

  await page.setViewportSize({ width: 800, height: 1100 });
  await expect.poll(() => currentOrder(page)).toEqual(tabletOrder);
  await page.getByTestId('reset-workspace-layout').click();
  await expect.poll(() => currentOrder(page)).toEqual(defaultOrder);
  await page.setViewportSize({ width: 1366, height: 1400 });
  await expect.poll(() => currentOrder(page)).toEqual(desktopOrder);
  await expect.poll(() => page.evaluate(() => JSON.parse(
    localStorage.getItem('madhorse-workspace-panel-order:desktop') ?? '[]',
  ))).toEqual(desktopOrder);
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
