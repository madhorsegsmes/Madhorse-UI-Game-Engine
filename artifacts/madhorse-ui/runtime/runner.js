// This module is imported by a blob worker created inside an opaque-origin,
// sandboxed iframe. The iframe's CSP allows only the public runtime assets.
const send = self.postMessage.bind(self);
const runtimeRoot = new URL('.', import.meta.url);
const originalFetch = self.fetch.bind(self);
let networkLocked = false;
let outputSize = 0;
const outputLimit = 16000;

const emit = (text) => {
  const value = String(text);
  outputSize += value.length + 1;
  if (outputSize > outputLimit) throw new Error('Script output exceeded the 16,000-character limit');
  send({ type: 'output', text: value });
};
const phase = (name, message) => send({ type: 'phase', phase: name, message });

// Asset loading is allowed only during initialization, anonymously, from our
// public runtime directory. Keep this check in the closure so captured fetch
// references also stop working once initialization has finished.
Object.defineProperty(self, 'fetch', {
  configurable: false,
  writable: false,
  value: (input, options = {}) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url, runtimeRoot);
    if (networkLocked || !url.href.startsWith(runtimeRoot.href) ||
        (options.method && options.method !== 'GET')) {
      return Promise.reject(new Error('Network access is disabled in the script sandbox'));
    }
    return originalFetch(url.href, { ...options, method: 'GET', credentials: 'omit', redirect: 'error' });
  },
});
for (const name of [
  'XMLHttpRequest', 'WebSocket', 'EventSource', 'Worker', 'SharedWorker',
  'BroadcastChannel', 'WebTransport', 'indexedDB', 'caches',
]) {
  try { Object.defineProperty(self, name, { value: undefined, writable: false, configurable: false }); } catch {}
}

self.onmessage = async ({ data }) => {
  self.onmessage = null; // One fresh process/context per run.
  try {
    const { language, source, filename, files = [] } = data;
    if (typeof source !== 'string' || source.length > 262144) throw new Error('Invalid script or script too large');
    phase('loading', `Loading ${language} runtime…`);
    if (language === 'JavaScript' || language === 'TypeScript') {
      const { initialize } = await import('./javascript.js');
      const run = await initialize();
      let code = source;
      if (language === 'TypeScript') code = (await import('./typescript.js')).transpile(source);
      networkLocked = true;
      phase('running', 'Running script…');
      run(code, emit);
    } else if (language === 'Lua') {
      const { run } = await import('./lua.js');
      networkLocked = true;
      phase('running', 'Running script…');
      run(source, emit);
    } else if (language === 'Python') {
      const { loadPyodide } = await import('./python/pyodide.mjs');
      const python = await loadPyodide({
        indexURL: new URL('python/', runtimeRoot).href,
        jsglobals: Object.create(null),
        stdout: emit,
        stderr: emit,
        stdin: () => null,
        packages: [],
      });
      python.FS.mkdirTree('/project');
      for (const file of files) {
        if (/^[\w .-]+\.py$/.test(file.name)) python.FS.writeFile(`/project/${file.name}`, file.content);
      }
      python.runPython("import sys\nsys.path.insert(0, '/project')");
      networkLocked = true;
      phase('running', 'Running script…');
      const result = python.runPython(source, { filename });
      result?.destroy?.();
    } else if (language === 'C' || language === 'C++') {
      const [{ compile }, { WASI, File, OpenFile, ConsoleStdout }] = await Promise.all([
        import('./native/index.js'), import('./wasi/index.js'),
      ]);
      phase('compiling', 'Compiling source to WebAssembly…');
      const extraFiles = {};
      for (const file of files) {
        if (/^[\w .-]+\.(h|hpp)$/.test(file.name)) extraFiles[file.name] = file.content;
      }
      const result = await compile({
        source, fileName: language === 'C' ? 'main.c' : 'main.cpp',
        flags: language === 'C' ? ['-std=c17', '-O0', '-Wl,--max-memory=67108864'] : ['-std=c++20', '-O0', '-fno-exceptions', '-Wl,--max-memory=67108864'],
        extraFiles,
      });
      if (result.compileOutput) emit(result.compileOutput);
      if (!result.module) throw new Error('Compilation failed. See compiler output above.');
      networkLocked = true;
      const wasi = new WASI(['project'], [], [
        new OpenFile(new File(new Uint8Array())),
        ConsoleStdout.lineBuffered(emit),
        ConsoleStdout.lineBuffered(emit),
      ]);
      const instance = await WebAssembly.instantiate(result.module, { wasi_snapshot_preview1: wasi.wasiImport });
      phase('running', 'Running WebAssembly…');
      const exitCode = wasi.start(instance);
      if (exitCode !== 0) throw new Error(`Program exited with code ${exitCode}`);
    } else if (language === 'C#') {
      // Import the direct host, not the package's Comlink/CDN wrapper. Our own
      // worker supplies the isolation and can be terminated at any time.
      const { WasmSharpWorker } = await import('./csharp/WasmSharpWorker.js');
      const host = await WasmSharpWorker.initializeAsync({
        assembliesUrl: new URL('csharp/', runtimeRoot).href,
      }, {
        onDownloadResourceProgress: (loaded, total) => phase('loading', `Loading C# runtime (${loaded}/${total})…`),
      });
      phase('compiling', 'Compiling C# source…');
      const compilation = await host.createCompilationAsync(source);
      networkLocked = true;
      phase('running', 'Running C# script…');
      const result = await compilation.run();
      if (result.stdOut) emit(result.stdOut);
      if (result.stdErr) emit(result.stdErr);
      if (!result.success) {
        const diagnostics = (result.diagnostics ?? []).map((item) => `${item.id}: ${item.message}`).join('\n');
        throw new Error(diagnostics || String(result.errorMessage ?? result.exception ?? 'C# script did not complete successfully.'));
      }
    } else {
      throw new Error('Choose an executable source file. Headers cannot be run by themselves.');
    }
    send({ type: 'complete' });
  } catch (error) {
    send({ type: 'error', message: error instanceof Error ? error.message : String(error) });
  }
};

// User runtimes never receive a host postMessage capability.
try { Object.defineProperty(self, 'postMessage', { value: undefined, writable: false, configurable: false }); } catch {}
