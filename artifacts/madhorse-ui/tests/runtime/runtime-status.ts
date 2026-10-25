import { expect, type Page } from '@playwright/test';

// The cold compiler allowance is not a reason to wait after the runtime has
// already finished or failed. Capture the terminal status and its real output.
export async function expectScriptStatus(
  page: Page,
  expected: string | RegExp,
  timeout = 180_000,
) {
  const snapshotHandle = await page.waitForFunction(({ text, pattern }) => {
    const actual = document.querySelector('.script-run-status')?.textContent?.trim();
    if (!actual) return false;
    const matches = pattern
      ? new RegExp(pattern.source, pattern.flags).test(actual)
      : actual === text;
    const terminal = /^Script (finished\.|stopped(?: with an error)?\.)$/.test(actual);
    if (!matches && !terminal) return false;
    return {
      status: actual,
      output: document.querySelector('[aria-label="Script output"]')?.textContent?.slice(0, 8_000) ?? '',
    };
  }, {
    text: typeof expected === 'string' ? expected : null,
    pattern: expected instanceof RegExp
      ? { source: expected.source, flags: expected.flags.replace(/[gy]/g, '') }
      : null,
  }, { timeout });
  try {
    const snapshot = await snapshotHandle.jsonValue();
    if (!snapshot) throw new Error('Script status was not available.');
    const message = `Runtime reached "${snapshot.status}".\nScript output:\n${snapshot.output}`;
    if (typeof expected === 'string') expect(snapshot.status, message).toBe(expected);
    else expect(snapshot.status, message).toMatch(expected);
  } finally {
    await snapshotHandle.dispose();
  }
}
