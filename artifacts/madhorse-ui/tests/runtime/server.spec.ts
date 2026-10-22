import { test, expect } from '@playwright/test';

const assets = [
  ['/runtimes/runner.js', 'text/javascript'],
  ['/runtimes/javascript.js', 'text/javascript'],
  ['/runtimes/lua.js', 'text/javascript'],
  ['/runtimes/typescript.js', 'text/javascript'],
  ['/runtimes/python/pyodide.mjs', 'text/javascript'],
  ['/runtimes/python/pyodide.asm.wasm', 'application/wasm'],
  ['/runtimes/native/index.js', 'text/javascript'],
  ['/runtimes/csharp/dotnet.js', 'text/javascript'],
  ['/runtimes/wasi/index.js', 'text/javascript'],
];

test('production runtime files support anonymous opaque-origin GET, HEAD and 304', async ({ request }) => {
  for (const [url, type] of assets) {
    const response = await request.get(url, { headers: { Origin: 'null' } });
    expect(response.status(), url).toBe(200);
    const headers = response.headers();
    expect(headers['content-type'], url).toContain(type);
    expect(headers['access-control-allow-origin'], url).toBe('*');
    expect(headers['cross-origin-resource-policy'], url).toBe('cross-origin');
    expect(headers['access-control-allow-credentials'], url).toBeUndefined();
    expect(headers['x-content-type-options'], url).toBe('nosniff');
    expect(headers['cache-control'], url).toContain('must-revalidate');
    expect(headers['last-modified'], url).toBeTruthy();
    const head = await request.head(url, { headers: { Origin: 'null' } });
    expect(head.status(), url).toBe(200);
    expect(head.headers()['content-length'], url).toBe(headers['content-length']);
    expect((await head.body()).length, url).toBe(0);
    const cached = await request.get(url, { headers: { Origin: 'null', 'If-Modified-Since': headers['last-modified'] } });
    expect(cached.status(), url).toBe(304);
    expect(cached.headers()['access-control-allow-origin'], url).toBe('*');
  }
});

test('production server rejects writes and missing assets instead of returning the app', async ({ request }) => {
  expect((await request.post('/runtimes/runner.js', { data: 'overwrite' })).status()).toBe(405);
  for (const url of ['/runtimes/not-found.wasm', '/assets/not-found.js']) {
    expect((await request.get(url)).status(), url).toBe(404);
  }
  const traversal = await request.get('/runtimes/%2e%2e%2f%2e%2e%2fpackage.json');
  expect(await traversal.text()).not.toContain('@workspace/madhorse-ui');
});
