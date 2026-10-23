import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { capDefinedMemory, capPythonLoader, memoryLimits } from '../../runtime/memory-limits.mjs';

const root = new URL('../../node_modules/.cache/madhorse-runtimes/', import.meta.url);

test('worker rejects oversized source sets before loading any interpreter', async () => {
  const previousSelf = globalThis.self;
  const messages = [];
  globalThis.self = {
    postMessage: message => messages.push(message),
    fetch: () => assert.fail('invalid source sets must not fetch runtime assets'),
  };
  try {
    await import(new URL('../../runtime/runner.js?source-limit-test', import.meta.url));
    const handle = globalThis.self.onmessage;
    for (const input of [
      { source: 'x'.repeat(262145) },
      { files: Array.from({ length: 65 }, () => ({ name: 'x.py', content: '' })) },
      { files: [{ name: 'x.py', content: 'x'.repeat(1048576) }] },
      { files: [{ name: 'x.py', content: 42 }] },
      { files: [{ name: 'x'.repeat(256), content: '' }] },
    ]) {
      messages.length = 0;
      await handle({ data: { language: 'Python', source: 'pass', files: [], ...input } });
      assert.equal(messages.length, 1);
      assert.equal(messages[0].type, 'error', 'must reject before the loading phase');
      assert.match(messages[0].message, /large|Too many|exceeded|Invalid/);
    }
  } finally {
    if (previousSelf === undefined) delete globalThis.self;
    else globalThis.self = previousSelf;
  }
});

test('Lua and .NET distributions physically reject growth beyond their budgets', async () => {
  for (const [file, maximum] of [
    ['lua/glue.wasm', memoryLimits.lua],
    ['csharp/dotnet.native.wasm', memoryLimits.csharp],
  ]) {
    const module = await WebAssembly.compile(await readFile(new URL(file, root)));
    const imports = {};
    for (const item of WebAssembly.Module.imports(module)) {
      assert.equal(item.kind, 'function', 'unexpected runtime memory/table import');
      (imports[item.module] ??= {})[item.name] = () => { throw new Error('Unexpected startup call'); };
    }
    const instance = await WebAssembly.instantiate(module, imports);
    const memory = instance.exports.memory;
    assert.ok(memory instanceof WebAssembly.Memory);
    memory.grow((maximum - memory.buffer.byteLength) / 65536);
    assert.equal(memory.buffer.byteLength, maximum);
    assert.throws(() => memory.grow(1), RangeError, `${file}: actual WASM maximum`);
  }
});

test('memory preparation fails closed when upstream layouts change', () => {
  assert.throws(() => capPythonLoader('new upstream loader'), /needs review/);
  assert.throws(() => capDefinedMemory(new Uint8Array(), memoryLimits.lua), /Invalid runtime/);
  const empty = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]);
  assert.throws(() => capDefinedMemory(empty, memoryLimits.lua), /no defined memory/);
  const memory = new Uint8Array([...empty, 5, 4, 1, 1, 1, 8]);
  assert.throws(() => capDefinedMemory(memory, 16 * 65536), /needs review/);
  assert.throws(() => capDefinedMemory(memory, 0), /Invalid memory budget/);
  const capped = capDefinedMemory(memory, 4 * 65536);
  assert.ok(WebAssembly.validate(capped));
});

// The browser-only bundle is exercised in resources.spec.ts in an actual
// opaque-origin worker; do not emulate Emscripten's browser globals in Node.
for (const adapter of ['../../runtime/lua.mjs']) {
  test(`Lua ${adapter}: allocator rejects finite native and retained allocations`, async () => {
    const { initialize } = await import(new URL(adapter, import.meta.url));
    const run = await initialize(new URL('lua/glue.wasm', root).pathname);
    for (const source of [
      'local x = string.rep("x", 20*1024*1024)',
      'local x = {}; for i=1,24 do x[i] = string.rep("x",1024*1024)..i end',
      'local x = {}; for i=1,1024*1024 do x[i] = i end',
    ]) {
      assert.throws(() => run(source, () => assert.fail('unexpected output')), /not enough memory/i);
      const output = [];
      run('print("recovered", type(io), type(os), type(package), type(debug), type(js), type(require), type(loadfile), type(dofile))',
        text => output.push(text));
      assert.deepEqual(output, ['recovered\tnil\tnil\tnil\tnil\tnil\tnil\tnil\tnil']);
    }
    const output = [];
    run(`
      local x = {}; local failures = 0
      for i=1,24 do
        local ok, value = pcall(string.rep, "x", 1024*1024)
        if ok then x[#x+1] = value else failures = failures+1 end
      end
      print(#x < 16, failures > 0)
    `, text => output.push(text));
    assert.deepEqual(output, ['true\ttrue']);
    run('local x = string.rep("x", 1024*1024); assert(#x == 1024*1024)', () => {});
  });
}

test('Python: actual imported memory ceiling and finite allocation rejection', async () => {
  const { loadPyodide } = await import(new URL('python/pyodide.mjs', root));
  // Capture the real imported memory, not a separately constructed lookalike.
  // This is a host-side test observer only, never shipped or exposed to Python.
  const OriginalMemory = WebAssembly.Memory;
  const memories = [];
  let python;
  try {
    WebAssembly.Memory = class extends OriginalMemory {
      constructor(descriptor) { super(descriptor); memories.push(this); }
    };
    python = await loadPyodide({
      indexURL: new URL('python/', root).pathname,
      jsglobals: Object.create(null),
    });
  } finally {
    WebAssembly.Memory = OriginalMemory;
  }
  const memory = memories.find(item => item.buffer === python._module.HEAPU8.buffer);
  assert.ok(memory, 'Pyodide must use the bounded memory created by the prepared loader');
  for (const source of [
    'x = bytearray(80*1024*1024)',
    'x = [bytearray(1024*1024) for _ in range(80)]',
    'x = "x" * (80*1024*1024)',
  ]) {
    assert.throws(() => python.runPython(source), /MemoryError/);
    assert.ok(python._module.HEAPU8.length <= memoryLimits.python);
    assert.equal(python.runPython('1+2'), 3);
    python.runPython('import gc; gc.collect()');
  }
  assert.equal(python.runPython(`
x = []
failures = 0
for i in range(80):
    try:
        x.append(bytearray(1024*1024))
    except MemoryError:
        failures += 1
len(x) < 64 and failures > 0
`), true);
  python.runPython('del x; gc.collect(); x = bytearray(1024*1024)');
  assert.equal(python.runPython('len(x)'), 1024*1024);
  assert.equal(python.runPython('import js; hasattr(js, "fetch")'), false);
  // End with a physical growth check (growing manually invalidates Emscripten's
  // cached views, so no interpreter calls follow it).
  memory.grow((memoryLimits.python - memory.buffer.byteLength) / 65536);
  assert.equal(memory.buffer.byteLength, memoryLimits.python);
  assert.throws(() => memory.grow(1), RangeError);
});
