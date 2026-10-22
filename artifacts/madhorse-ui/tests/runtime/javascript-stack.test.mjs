import assert from 'node:assert/strict';
import { test } from 'node:test';

const adapters = [
  ['source', new URL('../../runtime/javascript.mjs', import.meta.url)],
  ['browser bundle', new URL('../../node_modules/.cache/madhorse-runtimes/javascript.js', import.meta.url)],
];
const recursion = `
  function descend(depth) { return depth === 0 ? 0 : 1 + descend(depth - 1); }
`;

for (const [name, url] of adapters) {
  test(`${name}: guest stack guard unwinds cleanly and preserves diagnostics`, async () => {
    const { initialize } = await import(url.href);
    const run = await initialize();
    for (let cycle = 0; cycle < 3; cycle++) {
      const output = [];
      // Finite even if the guard regresses. Reuse this same WASM instance:
      // merely discarding a worker cannot hide a corrupted engine here.
      let failure;
      try {
        run(`${recursion} console.log(descend(20000));`, text => output.push(text));
      } catch (error) {
        failure = error;
      }
      assert.ok(failure instanceof Error);
      assert.equal(failure.message, 'stack overflow');
      assert.equal(failure instanceof AggregateError, false, 'cleanup must succeed');
      assert.deepEqual(output, []);
      run('console.log("recovered:" + typeof descend)', text => output.push(text));
      assert.deepEqual(output, ['recovered:undefined']);
    }

    const output = [];
    run(`${recursion} console.log(descend(20));`, text => output.push(text));
    assert.deepEqual(output, ['20'], 'ordinary finite recursion still works');

    for (const schedule of ['', 'Promise.resolve().then(() => {']) {
      const caught = [];
      run(`${recursion} ${schedule}
        for (let i = 0; i < 3; i++) {
          try { descend(20000); } catch (error) { console.log(error.message); }
        }
        ${schedule ? '});' : ''}
      `, text => caught.push(text));
      assert.deepEqual(caught, ['stack overflow', 'stack overflow', 'stack overflow'],
        'caught stack errors must unwind, including inside pending jobs');
    }

    // Non-stack diagnostics and unusual exception handles must also survive
    // disposal without being replaced by a lifetime or GC assertion.
    for (const [source, message] of [
      ['throw new Error("original error")', 'original error'],
      ['throw "primitive error"', 'primitive error'],
      ['throw Promise.resolve("value")', '[object Object]'],
      ['throw Promise.reject("reason")', '[object Object]'],
    ]) {
      assert.throws(() => run(source, () => {}), error => error.message === message);
      run('console.log("ok")', text => assert.equal(text, 'ok'));
    }
  });
}
