import { expect } from '@playwright/test';
import { test, openScripts, importSource, run, finished, output } from './fixtures';

test('opaque-origin classic worker dynamically imports the runner and instantiates WASM', async ({ page }, testInfo) => {
  await openScripts(page);
  // Observe the real bootstrap, not a replacement iframe or worker. The wrapper
  // runs as the dynamically imported runner, before it removes host messaging.
  await page.route('**/runtimes/runner.js', async route => {
    const response = await route.fetch();
    expect(response.status()).toBe(200);
    await route.fulfill({
      response,
      body: `
const reportContext = self.postMessage.bind(self);
try {
  const bytes = new Uint8Array([0,97,115,109,1,0,0,0]);
  const { instance } = await WebAssembly.instantiate(bytes);
  reportContext({type:'output', text:'WORKER_CONTEXT ' + JSON.stringify({
    origin: self.location.origin,
    scope: self.constructor.name,
    wasm: instance instanceof WebAssembly.Instance,
    classic: typeof importScripts === 'function'
  })});
} catch (error) {
  reportContext({type:'error', message:'Unsupported worker WebAssembly: ' + String(error)});
  throw error;
}
${await response.text()}`,
    });
  });
  await importSource(page, 'worker-context.js', 'console.log("real runtime executed")');
  await run(page);
  await finished(page);
  const text = await output(page).innerText();
  const match = text.match(/WORKER_CONTEXT (\{[^\n]+\})/);
  expect(match, text).not.toBeNull();
  const context = JSON.parse(match![1]);
  await testInfo.attach('worker-capabilities', {
    body: JSON.stringify(context, null, 2), contentType: 'application/json',
  });
  expect(context).toEqual({
    origin: 'null', scope: 'DedicatedWorkerGlobalScope', wasm: true, classic: true,
  });
  await expect(output(page)).toContainText('real runtime executed');
});

test('Python loads real WASM anonymously from the opaque worker', async ({ page }) => {
  const wasm: { status: number; type: string; cors: string; credentials: string }[] = [];
  const pending: Promise<void>[] = [];
  page.on('response', response => {
    if (!response.url().endsWith('/runtimes/python/pyodide.asm.wasm')) return;
    pending.push((async () => {
      const request = response.request();
      const headers = await response.allHeaders();
      const sent = await request.allHeaders();
      wasm.push({
        status: response.status(),
        type: headers['content-type'],
        cors: headers['access-control-allow-origin'],
        credentials: sent.cookie ?? '',
      });
    })());
  });
  await openScripts(page);
  await importSource(page, 'wasm.py', 'print("WASM loaded: " + str(6 * 7))');
  await run(page);
  await finished(page);
  await expect(output(page)).toContainText('WASM loaded: 42');
  await Promise.all(pending);
  expect(wasm).toEqual([{
    status: 200, type: 'application/wasm', cors: '*', credentials: '',
  }]);
});

test('native and C# host exports load inside the actual opaque classic worker', async ({ page }, testInfo) => {
  await openScripts(page);
  await page.route('**/runtimes/runner.js', async route => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body: `
const reportHost = self.postMessage.bind(self);
try {
  const [native, csharp] = await Promise.all([
    import('./native/index.js'), import('./csharp/WasmSharpWorker.js')
  ]);
  reportHost({type:'output', text:'HOST_IMPORTS ' + JSON.stringify({
    origin: self.location.origin,
    nativeCompile: typeof native.compile,
    csharpInitialize: typeof csharp.WasmSharpWorker?.initializeAsync
  })});
} catch (error) {
  reportHost({type:'error', message:'Compiler host import failed: ' + String(error)});
  throw error;
}
${await response.text()}`,
    });
  });
  await importSource(page, 'host-imports.js', 'console.log("sandbox still works")');
  await run(page);
  await finished(page);
  const text = await output(page).innerText();
  const match = text.match(/HOST_IMPORTS (\{[^\n]+\})/);
  expect(match, text).not.toBeNull();
  const hosts = JSON.parse(match![1]);
  await testInfo.attach('compiler-host-imports', {
    body: JSON.stringify(hosts, null, 2), contentType: 'application/json',
  });
  expect(hosts).toEqual({ origin: 'null', nativeCompile: 'function', csharpInitialize: 'function' });
  await expect(output(page)).toContainText('sandbox still works');
});
