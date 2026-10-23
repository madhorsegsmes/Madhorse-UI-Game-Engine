import { expect, type Page } from '@playwright/test';
import { test, openScripts, importSource, run, finished, status, output, frames, stopButton } from './fixtures';

const outputLimit = 16_000;
const outputLimitError = 'Script output exceeded the 16,000-character limit';

async function failed(page: Page, message: string | RegExp) {
  await expect(status(page)).toHaveText('Script stopped with an error.');
  await expect(output(page)).toContainText(message);
  const text = await output(page).textContent();
  expect(text!.length).toBeGreaterThan(0);
  expect(text!.length).toBeLessThanOrEqual(outputLimit);
  // Resource-limit failures must not merely fall through to the wall-clock kill.
  expect(text).not.toMatch(/5-second|could not start/);
  await expect(frames(page)).toHaveCount(0);
  await expect(stopButton(page)).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Run script', exact: true })).toBeEnabled();
  await expect(page.getByLabel('Script to run')).toBeEnabled();
}

async function recover(page: Page, label: string) {
  await importSource(page, `${label}.js`, `console.log(${JSON.stringify(label)})`);
  await run(page);
  await finished(page);
  await expect(output(page)).toHaveText(`${label}\n`);
}

test('output accepts exactly 16,000 characters including the trailing newline', async ({ page }) => {
  await openScripts(page);
  await importSource(page, 'boundary.js', 'console.log("x".repeat(15999))');
  await run(page);
  await finished(page);
  expect(await output(page).textContent()).toBe(`${'x'.repeat(outputLimit - 1)}\n`);
  // A fresh run must reset both the worker counter and the editor console.
  await recover(page, 'after-boundary');
});

for (const example of [
  { name: 'one oversized line', source: 'console.log("x".repeat(16000))', prefix: '' },
  {
    name: 'cumulative lines',
    source: 'for (let i = 0; i < 17; i++) console.log("x".repeat(999))',
    prefix: `${'x'.repeat(999)}\n`.repeat(16),
  },
  {
    name: 'embedded newlines',
    source: 'console.log("x\\n".repeat(8000))',
    prefix: '',
  },
]) {
  test(`output rejects ${example.name} above the cap and recovers`, async ({ page }) => {
    await openScripts(page);
    await importSource(page, 'overflow.js', example.source);
    await run(page);
    await expect(status(page)).toHaveText('Script stopped with an error.');
    await expect(frames(page)).toHaveCount(0);
    const text = await output(page).textContent();
    expect(text!.length).toBeLessThanOrEqual(outputLimit);
    // A full console can truncate the appended error; the status must still
    // show failure. Rejected chunks must never be partially emitted.
    expect(text).toBe(`${example.prefix}\n${outputLimitError}`.slice(0, outputLimit));
    await expect(stopButton(page)).toBeDisabled();
    await recover(page, 'after-overflow');
  });
}

test('oversized JavaScript error messages stay bounded and allow a fresh run', async ({ page }) => {
  await openScripts(page);
  // Only 32 KB, not a host-memory stress test.
  await importSource(page, 'large-error.js', 'throw new Error("E".repeat(32000))');
  await run(page);
  await failed(page, 'EEEE');
  expect(await output(page).textContent()).toBe(`\n${'E'.repeat(32000)}`.slice(0, outputLimit));
  await recover(page, 'after-large-error');
});

for (const resource of [
  {
    name: '32 MiB memory',
    // At most 96 * 65,536 slots (~48 MiB of QuickJS values) even if the guard
    // regresses. No unbounded allocation or host-side memory exhaustion.
    source: `
const blocks = [];
for (let i = 0; i < 96; i++) blocks.push(new Array(65536).fill(i));
console.log("memory guard failed");
`,
    error: /out of memory/i,
  },
  {
    name: '64 KiB stack',
    // Finite recursion exceeds the configured QuickJS stack, not the host's.
    source: `
function descend(depth) { return depth === 0 ? 0 : 1 + descend(depth - 1); }
console.log(descend(20000));
`,
    error: /stack overflow/i,
  },
]) {
  test(`JavaScript ${resource.name} limit reports a bounded error and recovers`, async ({ page }, testInfo) => {
    await openScripts(page);
    await importSource(page, 'resource.js', resource.source);
    await run(page);
    await expect(status(page)).toHaveText(/^(Script finished\.|Script stopped with an error\.)$/);
    const terminalStatus = await status(page).textContent();
    const text = await output(page).textContent();
    expect(text!.length).toBeGreaterThan(0);
    expect(text!.length).toBeLessThanOrEqual(outputLimit);
    expect(text).not.toMatch(/5-second|could not start/);
    await expect(frames(page)).toHaveCount(0);
    await expect(stopButton(page)).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Run script', exact: true })).toBeEnabled();
    await recover(page, 'after-resource-limit');
    await testInfo.attach('resource-limit-observation', {
      contentType: 'application/json',
      body: JSON.stringify({
        resource: resource.name, terminalStatus, output: text,
        recovered: true, remainingSandboxFrames: await frames(page).count(),
      }, null, 2),
    });
    expect(terminalStatus).toBe('Script stopped with an error.');
    expect(text).toMatch(resource.error);
    expect(text).not.toMatch(/Aborted|Assertion failed|JS_FreeRuntime|Maximum call stack size exceeded/i);
  });
}

test('repeated completion, failure and Stop tear down each sandbox without poisoning later runs', async ({ page }) => {
  await openScripts(page);
  await importSource(page, 'success.js', 'globalThis.previousRun = true; console.log("fresh:" + typeof leaked);');
  await importSource(page, 'failure.js', 'globalThis.leaked = true; throw Error("expected failure");');
  await importSource(page, 'stop.js', 'globalThis.leaked = true; console.log("before stop"); while (true) {}');
  const selection = page.getByLabel('Script to run');
  for (let cycle = 0; cycle < 3; cycle++) {
    await selection.selectOption({ index: 0 });
    await run(page);
    await finished(page);
    await expect(output(page)).toHaveText('fresh:undefined\n');

    await selection.selectOption({ index: 1 });
    await run(page);
    await failed(page, 'expected failure');

    await selection.selectOption({ index: 2 });
    await run(page);
    await expect(output(page)).toContainText('before stop');
    await expect(frames(page)).toHaveCount(1);
    await stopButton(page).click();
    await expect(status(page)).toHaveText('Script stopped.');
    await expect(frames(page)).toHaveCount(0);
    await expect(stopButton(page)).toBeDisabled();
    await expect(selection).toBeEnabled();
  }
  await recover(page, 'after-repeated-teardown');
  // Cross the old execution deadline: stale workers/timers must not change
  // the new result, append output, or recreate a sandbox.
  await page.waitForTimeout(5_200);
  await expect(status(page)).toHaveText('Script finished.');
  await expect(output(page)).toHaveText('after-repeated-teardown\n');
  await expect(frames(page)).toHaveCount(0);
});

for (const resource of [
  {
    name: 'Python single allocation', extension: 'py',
    source: 'x = bytearray(80*1024*1024)\nprint("memory guard failed")',
    error: /MemoryError/,
    hello: 'print("same language recovered")',
  },
  {
    name: 'Python retained allocations', extension: 'py',
    source: 'x = [bytearray(1024*1024) for _ in range(80)]\nprint("memory guard failed")',
    error: /MemoryError/,
    hello: 'print("same language recovered")',
  },
  {
    name: 'Lua single allocation', extension: 'lua',
    source: 'local x = string.rep("x", 20*1024*1024); print("memory guard failed")',
    error: /not enough memory/i,
    hello: 'print("same language recovered")',
  },
  {
    name: 'Lua retained allocations', extension: 'lua',
    source: 'local x = {}; for i=1,24 do x[i] = string.rep("x",1024*1024)..i end; print("memory guard failed")',
    error: /not enough memory/i,
    hello: 'print("same language recovered")',
  },
  {
    name: 'C# single allocation', extension: 'cs',
    source: 'var x = new byte[272*1024*1024]; System.Console.WriteLine(x.Length);',
    error: /OutOfMemoryException|out of memory/i,
    hello: 'System.Console.WriteLine("same language recovered");',
  },
  {
    name: 'C# retained allocations', extension: 'cs',
    source: 'var x = new System.Collections.Generic.List<byte[]>(); for (int i=0; i<72; i++) x.Add(new byte[4*1024*1024]); System.Console.WriteLine("memory guard failed");',
    error: /OutOfMemoryException|out of memory/i,
    hello: 'System.Console.WriteLine("same language recovered");',
  },
]) {
  test(`${resource.name} is rejected independently of timeout and recovers`, async ({ page }, testInfo) => {
    await openScripts(page);
    await importSource(page, `memory.${resource.extension}`, resource.source);
    await run(page);
    await expect(status(page)).toHaveText(/^(Script finished\.|Script stopped with an error\.)$/, { timeout: 180_000 });
    const terminalStatus = await status(page).textContent();
    const text = await output(page).textContent();
    // Preserve evidence even if enforcement regresses but cleanup still works.
    await expect(frames(page)).toHaveCount(0);
    await expect(stopButton(page)).toBeDisabled();
    await importSource(page, `recovery.${resource.extension}`, resource.hello);
    await run(page);
    await finished(page);
    await expect(output(page)).toHaveText('same language recovered\n');
    await testInfo.attach('interpreter-memory-observation', {
      contentType: 'application/json',
      body: JSON.stringify({ resource: resource.name, terminalStatus, output: text, recovered: true }, null, 2),
    });
    expect(terminalStatus).toBe('Script stopped with an error.');
    expect(text).toMatch(resource.error);
    expect(text!.length).toBeLessThanOrEqual(outputLimit);
    expect(text).not.toMatch(/5-second|could not start|memory guard failed/i);
  });
}

for (const extension of ['c', 'cpp']) {
  test(`${extension} linker memory maximum rejects growth and malloc without a timeout`, async ({ page }) => {
    await openScripts(page);
    await importSource(page, `memory.${extension}`, `
#include <stdio.h>
#include <stdlib.h>
int main(void) {
  size_t old = __builtin_wasm_memory_grow(0, 1024);
  if (old != (size_t)-1) return 1;
  void *p = malloc(72*1024*1024);
  if (p) { free(p); return 2; }
  p = malloc(1024);
  if (!p) return 3;
  free(p);
  puts("native memory rejected");
  return 0;
}`);
    await run(page);
    await finished(page);
    await expect(output(page)).toHaveText('native memory rejected\n');
    await recover(page, `after-${extension}-memory`);
  });
}

test('C# caught allocation failures cannot bypass the ceiling and useful work still fits', async ({ page }) => {
  await openScripts(page);
  await importSource(page, 'caught.cs', `
var blocks = new System.Collections.Generic.List<byte[]>();
int rejected = 0;
for (int i=0; i<72; i++) {
  try { blocks.Add(new byte[4*1024*1024]); }
  catch (System.OutOfMemoryException) { rejected++; }
}
System.Console.WriteLine(blocks.Count > 0 && blocks.Count < 64 && rejected > 0 ? "bounded" : "guard failed");
System.GC.KeepAlive(blocks);
`);
  await run(page);
  await finished(page);
  await expect(output(page)).toHaveText('bounded\n');
  await importSource(page, 'useful.cs', `
var block = new byte[8*1024*1024];
block[block.Length-1] = 42;
System.Console.WriteLine(block[block.Length-1]);
`);
  await run(page);
  await finished(page);
  await expect(output(page)).toHaveText('42\n');
});

for (const initialization of [
  { asset: 'runner.js', status: 'Starting JavaScript sandbox…' },
  { asset: 'javascript.js', status: 'Loading JavaScript runtime…' },
]) {
  test(`Stop while ${initialization.asset} initializes removes the sandbox and ignores late loading`, async ({ page }) => {
    await openScripts(page);
    await importSource(page, 'initialization.js', 'console.log("cancelled run must not execute")');
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    let intercepted!: () => void;
    const requested = new Promise<void>(resolve => { intercepted = resolve; });
    let delivered!: () => void;
    const delivery = new Promise<void>(resolve => { delivered = resolve; });
    const url = `**/runtimes/${initialization.asset}`;
    await page.route(url, async route => {
      const response = await route.fetch();
      expect(response.status()).toBe(200);
      intercepted();
      await gate;
      // Deliver the real asset after Stop, rather than mocking a successful
      // runtime. Any late worker activity must remain detached from the editor.
      await route.fulfill({ response });
      delivered();
    }, { times: 1 });
    try {
      await run(page);
      await requested;
      await expect(status(page)).toHaveText(initialization.status);
      await expect(frames(page)).toHaveCount(1);
      await expect(page.getByRole('button', { name: 'Run script', exact: true })).toBeDisabled();
      await stopButton(page).click();
      await expect(status(page)).toHaveText('Script stopped.');
      await expect(frames(page)).toHaveCount(0);
      await expect(stopButton(page)).toBeDisabled();
      await expect(page.getByRole('button', { name: 'Run script', exact: true })).toBeEnabled();
      await expect(page.getByLabel('Script to run')).toBeEnabled();
      await recover(page, 'after-initialization-stop');
      release();
      await delivery;
      await page.waitForTimeout(500);
      await expect(status(page)).toHaveText('Script finished.');
      await expect(output(page)).toHaveText('after-initialization-stop\n');
      await expect(frames(page)).toHaveCount(0);
    } finally {
      release();
      await page.unrouteAll({ behavior: 'wait' });
    }
  });
}
