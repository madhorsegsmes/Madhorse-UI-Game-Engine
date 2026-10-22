import { expect } from '@playwright/test';
import { test, openScripts, importSource, run, finished, output, frames, status } from './fixtures';

test('initial load and importing scripts never download language runtimes', async ({ page }) => {
  const downloads: string[] = [];
  page.on('request', request => {
    if (/\/runtimes\/|\.wasm(?:\?|$)|pyodide|clang|dotnet/i.test(request.url())) downloads.push(request.url());
  });
  await openScripts(page);
  for (const extension of ['js', 'ts', 'py', 'lua', 'c', 'cpp', 'cs']) {
    await importSource(page, `lazy.${extension}`, 'not executed');
  }
  await page.waitForTimeout(1_000);
  expect(downloads).toEqual([]);
  await expect(frames(page)).toHaveCount(0);
});

test('JavaScript has language builtins, but no host globals or constructor escape', async ({ page }) => {
  await openScripts(page);
  await importSource(page, 'host.js', `
const forbidden = ['window','document','parent','top','self','fetch','XMLHttpRequest',
'WebSocket','EventSource','Worker','SharedWorker','BroadcastChannel','WebTransport',
'localStorage','sessionStorage','indexedDB','caches','navigator','location',
'postMessage','importScripts','process','require'];
for (const name of forbidden) {
  if (typeof globalThis[name] !== 'undefined') throw Error('HOST LEAK: ' + name);
  if (Function('return typeof ' + name)() !== 'undefined') throw Error('CONSTRUCTOR LEAK: ' + name);
}
console.log('host globals absent');
try { fetch('/api/private'); throw Error('fetch unexpectedly succeeded'); }
catch (e) { if (!(e instanceof ReferenceError)) throw e; }
console.log('network unavailable');
`);
  await run(page);
  await finished(page);
  await expect(output(page)).toContainText('host globals absent');
  await expect(output(page)).toContainText('network unavailable');
});

test('Python js bridge has empty host globals and cannot fetch app or external data', async ({ page }) => {
  await openScripts(page);
  await importSource(page, 'host.py', `
import js
names = ['window', 'document', 'parent', 'self', 'globalThis', 'fetch',
         'localStorage', 'sessionStorage', 'indexedDB', 'caches', 'navigator',
         'XMLHttpRequest', 'WebSocket', 'Worker', 'postMessage']
for name in names:
    assert not hasattr(js, name), "HOST LEAK: " + name
print("Python host globals absent")
try:
    from js import fetch
    raise AssertionError("fetch leaked")
except ImportError:
    print("Python network unavailable")
`);
  await run(page);
  await finished(page);
  await expect(output(page)).toContainText('Python host globals absent');
  await expect(output(page)).toContainText('Python network unavailable');
});

test('opaque sandbox denies app storage, parent DOM, private API and external requests', async ({ page }) => {
  await openScripts(page);
  await page.evaluate(() => localStorage.setItem('runtime-private-sentinel', 'must-stay-private'));
  const escaped: string[] = [];
  // Fulfil rather than contact any real private/external endpoint if a regression leaks.
  await page.route(/\/api\/runtime-private-probe|https:\/\/sandbox-probe\.invalid\//, route => {
    escaped.push(route.request().url());
    return route.fulfill({ body: 'should never be requested', headers: { 'access-control-allow-origin': '*' } });
  });
  await importSource(page, 'hold.js', 'while (true) {}');
  await run(page);
  await expect(status(page)).toHaveText('Running script…', { timeout: 180_000 });
  await expect(frames(page)).toHaveCount(1);
  const sandbox = await frames(page).getAttribute('sandbox');
  expect(sandbox).toBe('allow-scripts');
  const frame = await frames(page).elementHandle().then(handle => handle!.contentFrame());
  expect(frame).not.toBeNull();
  // Probe the outer frame too: isolation must survive a language-engine escape.
  const denied = await frame!.evaluate(async (appOrigin) => {
    const blocked: string[] = [];
    for (const [name, probe] of [
      ['storage', () => localStorage.getItem('runtime-private-sentinel')],
      ['parent', () => parent.document.body],
    ] as const) {
      try { probe(); } catch { blocked.push(name); }
    }
    for (const url of ['/api/runtime-private-probe', 'https://sandbox-probe.invalid/exfiltrate']) {
      try { await fetch(new URL(url, appOrigin)); }
      catch { blocked.push(url); }
    }
    return blocked;
  }, new URL(page.url()).origin);
  expect(denied).toEqual(['storage', 'parent', '/api/runtime-private-probe', 'https://sandbox-probe.invalid/exfiltrate']);
  expect(escaped).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem('runtime-private-sentinel'))).toBe('must-stay-private');
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(frames(page)).toHaveCount(0);
});
