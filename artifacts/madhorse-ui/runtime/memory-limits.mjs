// Total linear-memory ceilings, not total worker/browser RSS limits.
export const memoryLimits = Object.freeze({
  python: 64 * 1024 * 1024,
  lua: 32 * 1024 * 1024,
  luaHeap: 16 * 1024 * 1024,
  csharp: 256 * 1024 * 1024,
  native: 64 * 1024 * 1024,
});

// The pinned .NET and Lua builds DEFINE (rather than import) their memory.
// Supplying Module.wasmMemory would therefore do nothing. Rewrite only the
// memory section of the cached distribution, failing closed on layout changes.
export function capDefinedMemory(bytes, maximumBytes) {
  const input = new Uint8Array(bytes);
  if (!WebAssembly.validate(input)) throw new Error('Invalid runtime WebAssembly');
  const maximum = maximumBytes / 65536;
  if (!Number.isInteger(maximum) || maximum < 1) throw new Error('Invalid memory budget');
  let offset = 8;
  const read = () => {
    let value = 0;
    for (let shift = 0; shift < 35; shift += 7) {
      if (offset >= input.length) throw new Error('Truncated runtime WebAssembly');
      const byte = input[offset++];
      value += (byte & 127) * 2 ** shift;
      if (!(byte & 128)) return value;
    }
    throw new Error('Invalid WebAssembly integer');
  };
  const encode = (value) => {
    const result = [];
    do {
      const byte = value % 128;
      value = Math.floor(value / 128);
      result.push(byte | (value ? 128 : 0));
    } while (value);
    return result;
  };
  while (offset < input.length) {
    const start = offset;
    const id = input[offset++];
    const length = read();
    const end = offset + length;
    if (end > input.length) throw new Error('Truncated runtime section');
    if (id !== 5) { offset = end; continue; }
    if (read() !== 1) throw new Error('Expected exactly one runtime memory');
    const flags = read();
    if (flags !== 0 && flags !== 1) throw new Error('Unexpected shared/memory64 runtime');
    const initial = read();
    const previousMax = flags === 1 ? read() : 65536;
    if (offset !== end || initial > maximum || previousMax < maximum) {
      throw new Error('Runtime memory layout/budget needs review');
    }
    const payload = [1, 1, ...encode(initial), ...encode(maximum)];
    const output = new Uint8Array(start + 1 + encode(payload.length).length + payload.length + input.length - end);
    output.set(input.subarray(0, start));
    output.set([5, ...encode(payload.length), ...payload], start);
    output.set(input.subarray(end), output.length - (input.length - end));
    if (!WebAssembly.validate(output)) throw new Error('Bounded runtime WebAssembly is invalid');
    return output;
  }
  throw new Error('Runtime has no defined memory; adapter needs review');
}

export function capPythonLoader(source) {
  const needle = 'new WebAssembly.Memory({initial:INITIAL_MEMORY/65536,maximum:65536})';
  if (source.split(needle).length !== 2) throw new Error('Pyodide memory adapter needs review');
  return source.replace(needle,
    `new WebAssembly.Memory({initial:INITIAL_MEMORY/65536,maximum:${memoryLimits.python / 65536}})`);
}
