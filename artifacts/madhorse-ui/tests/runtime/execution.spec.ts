import { expect } from '@playwright/test';
import { expectScriptStatus } from './runtime-status';
import { test, languages, openScripts, importSource, run, finished, status, output, frames, stopButton } from './fixtures';

for (const language of languages) {
  test(`${language.name}: imported hello world, syntax error, successful rerun`, async ({ page }) => {
    await openScripts(page);
    await importSource(page, `hello.${language.extension}`, language.hello);
    await expect(output(page)).toHaveText('Output will appear here.');
    await expect(frames(page)).toHaveCount(0); // Import must never execute code.
    await run(page);
    await finished(page);
    await expect(output(page)).toContainText(`hello ${language.name}`);
    await importSource(page, `broken.${language.extension}`, language.invalid);
    await run(page);
    await expectScriptStatus(page, 'Script stopped with an error.');
    await expect(output(page)).not.toHaveText('Output will appear here.');
    await expect(output(page)).not.toContainText('hello ');
    await expect(frames(page)).toHaveCount(0);
    await page.getByLabel('Script to run').selectOption({ index: 0 });
    await run(page);
    await finished(page);
    await expect(output(page)).toContainText(`hello ${language.name}`);
  });

  test(`${language.name}: five-second termination, manual Stop, recovery`, async ({ page }) => {
    await openScripts(page);
    await importSource(page, `loop.${language.extension}`, language.loop);
    await run(page);
    await expectScriptStatus(page, /Running (script|WebAssembly|C# script)…/);
    const start = Date.now();
    await expect(status(page)).toHaveText('Script stopped with an error.', { timeout: 8_000 });
    expect(Date.now() - start).toBeGreaterThan(3_500);
    expect(Date.now() - start).toBeLessThan(8_000);
    await expect(output(page)).toContainText(/5-second (execution|time) limit|interrupted/);
    await expect(frames(page)).toHaveCount(0);

    await run(page);
    await expectScriptStatus(page, /Running (script|WebAssembly|C# script)…/);
    const stoppedAt = Date.now();
    await stopButton(page).click();
    await expect(status(page)).toHaveText('Script stopped.');
    expect(Date.now() - stoppedAt).toBeLessThan(2_000);
    await expect(frames(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Run script', exact: true })).toBeEnabled();
    await importSource(page, `recovered.${language.extension}`, language.hello);
    await run(page);
    await finished(page);
    await expect(output(page)).toContainText(`hello ${language.name}`);
    // A stale timeout or worker must not overwrite the subsequent run.
    await page.waitForTimeout(5_100);
    await expect(status(page)).toHaveText('Script finished.');
  });
}

test('C is compiled as C17, not C++ or simulated output', async ({ page }) => {
  await openScripts(page);
  await importSource(page, 'semantics.c', `
#include <stdio.h>
#include <stdlib.h>
#ifdef __cplusplus
#error C must not use the C++ driver
#endif
_Static_assert(_Generic(1, int: 1, default: 0), "C11 generic selection");
int main(void) {
  int *number = malloc(sizeof *number); /* implicit void* conversion is C-only */
  if (!number) return 1;
  *number = 6 * 7;
  printf("C17:%d:%d\\n", *number, (int)(sizeof('x') == sizeof(int)));
  free(number);
  return 0;
}`);
  await run(page);
  await finished(page);
  await expect(output(page)).toContainText('C17:42:1');
});

test('mobile Script panel can import, run and read output without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openScripts(page);
  const panel = page.locator('.script-menu-panel');
  const bounds = await panel.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(391);
  await importSource(page, 'mobile.js', 'console.log("mobile success")');
  await run(page);
  await finished(page);
  await expect(output(page)).toContainText('mobile success');
  await expect(output(page)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Run script', exact: true })).toBeInViewport();
});
