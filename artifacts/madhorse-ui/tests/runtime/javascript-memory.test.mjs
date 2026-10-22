import assert from 'node:assert/strict';
import { test } from 'node:test';

// Exercise both the adapter and the exact single-file, minified browser bundle
// produced by prepareRuntimes (also used by dev and production builds).
const adapters = [
  ['source', new URL('../../runtime/javascript.mjs', import.meta.url)],
  ['browser bundle', new URL('../../node_modules/.cache/madhorse-runtimes/javascript.js', import.meta.url)],
];

const allocations = [
  ['retained arrays', `
    const blocks = [];
    for (let i = 0; i < 96; i++) blocks.push(new Array(65536).fill(i));
  `],
  ['retained ArrayBuffers', `
    const blocks = [];
    for (let i = 0; i < 48; i++) blocks.push(new ArrayBuffer(1024 * 1024));
  `],
  ['retained strings', `
    const blocks = [];
    for (let i = 0; i < 48; i++) blocks.push(String(i) + "x".repeat(1024 * 1024));
  `],
  ['single native allocation', 'new ArrayBuffer(40 * 1024 * 1024);'],
  ['array reallocation', `
    const blocks = [];
    for (let i = 0; i < 6 * 1024 * 1024; i++) blocks.push(i);
  `],
];

for (const [name, url] of adapters) {
  test(`${name}: hard guest-memory budget, diagnostics and recovery`, async () => {
    const { initialize } = await import(url.href);
    const run = await initialize();
    for (const [allocation, source] of allocations) {
      const output = [];
      // Every probe is finite even if the memory guard regresses. In particular,
      // the single allocation cannot be caught by periodic interrupt polling.
      assert.throws(
        () => run(`${source}\nconsole.log("memory guard failed")`, text => output.push(text)),
        /out of memory/i,
        allocation,
      );
      assert.deepEqual(output, [], `${allocation} must not complete`);
      // Verify disposal and reuse independently of the allocation assertion.
      run('console.log("recovered:" + typeof blocks)', text => output.push(text));
      assert.deepEqual(output, ['recovered:undefined']);
    }
    // Useful work below the budget still succeeds, with no new host APIs.
    const output = [];
    run(`
      // Force growth beyond the initial 16 MiB, while staying below 32 MiB.
      const data = [];
      for (let i = 0; i < 20; i++) data.push(new Uint8Array(1024 * 1024));
      data[19][0] = 42;
      console.log(data[19][0]);
      console.log(typeof fetch, typeof Worker, typeof WebAssembly, typeof process);
    `, text => output.push(text));
    assert.deepEqual(output, ['42', 'undefined undefined undefined undefined']);
    const caught = [];
    run(`
      const blocks = [];
      for (let i = 0; i < 48; i++) {
        try { blocks.push(new ArrayBuffer(1024 * 1024)); } catch {}
      }
      console.log(blocks.length);
    `, text => caught.push(text));
    assert.equal(caught.length, 1);
    assert.ok(Number(caught[0]) >= 20 && Number(caught[0]) < 32,
      'catching allocation failures must not bypass the physical budget');
  });
}
