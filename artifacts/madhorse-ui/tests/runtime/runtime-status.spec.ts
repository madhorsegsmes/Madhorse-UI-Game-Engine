import { expect, test } from '@playwright/test';
import { expectScriptStatus } from './runtime-status';

async function setup(page: import('@playwright/test').Page, text: string) {
  await page.setContent('<span class="script-run-status"></span><pre aria-label="Script output"></pre>');
  await page.locator('.script-run-status').evaluate((element, value) => { element.textContent = value; }, text);
}

test('runtime failure reports its output immediately instead of waiting for cold compilation', async ({ page }) => {
  await setup(page, 'Script stopped with an error.');
  await page.getByLabel('Script output').evaluate(element => {
    element.textContent = 'Cannot import the compiler module';
  });
  const start = Date.now();
  await expect(expectScriptStatus(page, 'Script finished.', 20_000))
    .rejects.toThrow(/Cannot import the compiler module/);
  expect(Date.now() - start).toBeLessThan(3_000);
});

test('a cold runtime can continue loading until successful completion', async ({ page }) => {
  await setup(page, 'Loading C++ runtime…');
  await page.evaluate(() => {
    setTimeout(() => { document.querySelector('.script-run-status')!.textContent = 'Script finished.'; }, 100);
  });
  await expectScriptStatus(page, 'Script finished.', 5_000);
});

test('running-phase waits accept the real running message', async ({ page }) => {
  await setup(page, 'Running WebAssembly…');
  await expectScriptStatus(page, /Running (script|WebAssembly|C# script)…/);
});

test('running-phase waits reject a terminal failure immediately', async ({ page }) => {
  await setup(page, 'Script stopped with an error.');
  await expect(expectScriptStatus(page, /Running (script|WebAssembly|C# script)…/, 20_000))
    .rejects.toThrow(/Script stopped with an error/);
});

test('expected script errors remain valid and unexpected Stop or success fails', async ({ page }) => {
  await setup(page, 'Script stopped with an error.');
  await expectScriptStatus(page, 'Script stopped with an error.');
  await setup(page, 'Script stopped.');
  await expect(expectScriptStatus(page, 'Script finished.')).rejects.toThrow(/Script stopped/);
  await setup(page, 'Script finished.');
  await expect(expectScriptStatus(page, 'Script stopped with an error.')).rejects.toThrow(/Script finished/);
});

test('nonterminal loading retains its finite timeout', async ({ page }) => {
  await setup(page, 'Loading C runtime…');
  await expect(expectScriptStatus(page, 'Script finished.', 250)).rejects.toThrow(/Timeout/);
});
