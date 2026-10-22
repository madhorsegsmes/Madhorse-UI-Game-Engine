import { test as base, expect, type Page } from '@playwright/test';

// Preserve the actual engine/runtime failure, not an engine-wide skip or a
// catch-and-pass fallback. These attachments are included in both reports.
export const test = base.extend<{ runtimeEvidence: void }>({
  runtimeEvidence: [async ({ page, browserName }, use, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('requestfailed', request => {
      errors.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText}`);
    });
    await use();
    if (testInfo.status !== testInfo.expectedStatus) {
      await testInfo.attach('runtime-diagnostics', {
        contentType: 'application/json',
        body: JSON.stringify({
          browser: browserName,
          project: testInfo.project.name,
          status: await status(page).allTextContents().catch(() => []),
          output: await output(page).allTextContents().catch(() => []),
          errors,
        }, null, 2),
      });
    }
  }, { auto: true }],
});

export const languages = [
  { name: 'JavaScript', extension: 'js', hello: 'console.log("hello JavaScript")', invalid: 'const = ;', loop: 'while (true) {}' },
  { name: 'TypeScript', extension: 'ts', hello: 'const text: string = "hello TypeScript"; console.log(text)', invalid: 'const value: = ;', loop: 'while (true) {}' },
  { name: 'Python', extension: 'py', hello: 'print("hello Python")', invalid: 'def broken(:', loop: 'while True:\n    pass' },
  { name: 'Lua', extension: 'lua', hello: 'print("hello Lua")', invalid: 'local = end', loop: 'while true do end' },
  { name: 'C', extension: 'c', hello: '#include <stdio.h>\nint main(void) { puts("hello C"); return 0; }', invalid: 'int main( {', loop: 'int main(void) { for (;;) {} }' },
  { name: 'C++', extension: 'cpp', hello: '#include <iostream>\nint main() { std::cout << "hello C++" << std::endl; }', invalid: 'int main( {', loop: 'int main() { for (;;) {} }' },
  { name: 'C#', extension: 'cs', hello: 'System.Console.WriteLine("hello C#");', invalid: 'System.Console.WriteLine(;', loop: 'while (true) {}' },
] as const;

export const status = (page: Page) => page.locator('.script-run-status');
export const output = (page: Page) => page.getByLabel('Script output');
export const frames = (page: Page) => page.locator('iframe[sandbox="allow-scripts"]');

export async function openScripts(page: Page) {
  await page.goto('/');
  await page.getByLabel('Script tools').click();
  await expect(page.getByLabel('Script to run')).toBeVisible();
}

export async function importSource(page: Page, filename: string, source: string) {
  await page.locator('input[type=file]').setInputFiles({
    name: filename, mimeType: 'text/plain', buffer: Buffer.from(source),
  });
  await expect(page.getByLabel('Script to run').locator('option').filter({ hasText: filename })).toHaveCount(1);
  await page.getByLabel('Script to run').selectOption({ label: await page.getByLabel('Script to run').locator('option').filter({ hasText: filename }).innerText() });
}

export async function run(page: Page) {
  await page.getByRole('button', { name: 'Run script', exact: true }).click();
}

export async function finished(page: Page) {
  // Compilation/download time is deliberately separate from the 5s execution budget.
  await expect(status(page)).toHaveText('Script finished.', { timeout: 180_000 });
  await expect(frames(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Stop', exact: true })).toBeDisabled();
}
