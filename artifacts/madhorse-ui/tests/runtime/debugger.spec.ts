import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('system debugger captures errors, warnings and failed requests with filters and export', async ({ page }) => {
  await page.route('**/diagnostic-probe*', (route) => route.fulfill({ status: 503, body: 'unavailable' }));
  await page.goto('/');
  const debuggerPanel = page.getByTestId('system-debugger');
  await debuggerPanel.scrollIntoViewIfNeeded();
  await page.evaluate(async () => {
    console.error('Probe editor failure', new Error('Detailed stack marker'));
    console.warn('Probe storage warning');
    window.dispatchEvent(new PromiseRejectionEvent('unhandledrejection', { promise: Promise.resolve(), reason: new Error('Probe rejected promise') }));
    window.dispatchEvent(new ErrorEvent('error', { message: 'Probe uncaught error', error: new Error('Probe stack') }));
    console.error('Probe credentials api_key=debug-secret Bearer debugtoken https://example.invalid/path?token=hidden#fragment');
    const response = await fetch('/diagnostic-probe?token=private-query');
    if (response.status !== 503) throw new Error('Fetch response behavior changed.');
  });
  const entries = page.getByTestId('debugger-entries');
  await expect(entries).toContainText('Probe editor failure');
  await expect(entries).toContainText('Probe storage warning');
  await expect(entries).toContainText('Probe rejected promise');
  await expect(entries).toContainText('Probe uncaught error');
  await expect(entries).toContainText('HTTP 503: /diagnostic-probe');
  await page.getByLabel('Debugger severity').selectOption('error');
  await page.getByLabel('Debugger subsystem').selectOption('editor');
  await page.getByLabel('Search debugger').fill('Probe editor failure');
  await expect(entries.locator('details')).toHaveCount(1);
  await entries.locator('summary').click();
  await expect(entries.locator('pre')).toContainText('Detailed stack marker');
  await page.getByLabel('Search debugger').fill('no-such-diagnostic');
  await expect(entries).toContainText('No diagnostics match');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export report' }).click(),
  ]);
  const report = await readFile((await download.path())!, 'utf8');
  const parsed = JSON.parse(report) as { entries: { source: string; message: string }[] };
  expect(parsed.entries.some((entry) => entry.source === 'network')).toBe(true);
  expect(report).toContain('[redacted]');
  expect(report).not.toContain('debug-secret');
  expect(report).not.toContain('debugtoken');
  expect(report).not.toContain('private-query');
  expect(report).not.toContain('?token=hidden');
});

test('debugger retains a bounded session history, groups repeats and clears without changing projects', async ({ page }) => {
  await page.goto('/');
  const panel = page.getByTestId('system-debugger');
  await panel.scrollIntoViewIfNeeded();
  // Allow the normal initial browser autosave to settle before comparing data.
  await expect(page.getByRole('button', { name: 'Clear log' })).toBeEnabled();
  await page.waitForFunction(() => localStorage.getItem('madhorse-ui-projects') !== null);
  const before = await page.evaluate(() => localStorage.getItem('madhorse-ui-projects'));
  await page.evaluate(() => {
    for (let index = 0; index < 225; index++) console.warn(`Bounded debugger probe ${index}`);
    console.warn('Repeated debugger probe');
    console.warn('Repeated debugger probe');
  });
  const entries = page.getByTestId('debugger-entries');
  await expect(entries.locator('details')).toHaveCount(200);
  await expect(panel).toContainText('older entries discarded');
  await expect(entries).toContainText('×2');
  await expect(entries).not.toContainText('Bounded debugger probe 0');
  await page.getByRole('button', { name: 'Clear log' }).click();
  await expect(entries).toContainText('Listening for system diagnostics.');
  await expect(entries.locator('details')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('madhorse-ui-projects'))).toBe(before);
  await page.reload();
  await panel.scrollIntoViewIfNeeded();
  await expect(entries).not.toContainText('Repeated debugger probe');
});
