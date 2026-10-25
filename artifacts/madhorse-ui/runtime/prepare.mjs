import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { capDefinedMemory, capPythonLoader, memoryLimits } from './memory-limits.mjs';
import { bundleRuntimeHost } from './bundle-host.mjs';

const require = createRequire(import.meta.url);
const appRoot = path.resolve(import.meta.dirname, '..');
export const runtimeDirectory = path.join(appRoot, 'node_modules/.cache/madhorse-runtimes');
const packageDirectory = (name) => path.dirname(require.resolve(name));

export async function prepareRuntimes() {
  await mkdir(runtimeDirectory, { recursive: true });
  await Promise.all([
    cp(packageDirectory('pyodide'), path.join(runtimeDirectory, 'python'), {
      recursive: true,
      filter: (file) => !/\.(map|ts|html|md)$/.test(file),
    }),
    cp(packageDirectory('browsercc'), path.join(runtimeDirectory, 'native'), {
      recursive: true,
      filter: (file) => !/\.(ts|pch)$/.test(file),
    }),
    cp(packageDirectory('@wasmsharp/core'), path.join(runtimeDirectory, 'csharp'), {
      recursive: true,
      filter: (file) => !/\.(ts|md|map)$/.test(file),
    }),
    cp(packageDirectory('@bjorn3/browser_wasi_shim'), path.join(runtimeDirectory, 'wasi'), {
      recursive: true,
    }),
  ]);

  const pythonPath = path.join(runtimeDirectory, 'python/pyodide.asm.js');
  await writeFile(pythonPath, capPythonLoader(await readFile(pythonPath, 'utf8')));
  const csharpWasm = path.join(runtimeDirectory, 'csharp/dotnet.native.wasm');
  await writeFile(csharpWasm, capDefinedMemory(await readFile(csharpWasm), memoryLimits.csharp));
  await mkdir(path.join(runtimeDirectory, 'lua'), { recursive: true });
  const luaWasm = path.join(packageDirectory('wasmoon'), 'glue.wasm');
  await writeFile(path.join(runtimeDirectory, 'lua/glue.wasm'),
    capDefinedMemory(await readFile(luaWasm), memoryLimits.lua));

  // The distribution uses bundler-style binary imports; preserve its directory
  // layout while converting those imports to ordinary browser asset URLs.
  const dotnetPath = path.join(runtimeDirectory, 'csharp/dotnet.js');
  const dotnet = await readFile(dotnetPath, 'utf8');
  await writeFile(dotnetPath, dotnet.replace(
    /import\s+(\w+)\s+from\s+["']([^"']+\.(?:dll|wasm|dat|json))["'];/g,
    (_, name, url) => `const ${name} = new URL(${JSON.stringify(url)}, import.meta.url).href;`,
  ));

  // browsercc's driver is hard-coded to clang++, which overrides .c extension
  // detection. Select the actual C driver for C source (not C++ compatibility).
  const nativePath = path.join(runtimeDirectory, 'native/index.js');
  const native = await readFile(nativePath, 'utf8');
  const fixedDriver = native.replace(
    'thisProgram: "clang++",',
    'thisProgram: inputName.endsWith(".c") ? "clang" : "clang++",',
  );
  if (fixedDriver === native) throw new Error('Native compiler adapter needs review: upstream driver changed');
  await writeFile(nativePath, fixedDriver);
  // Firefox's opaque classic worker can import an entry module but reject its
  // static dependency graph. Bundle trusted hosts without changing the worker's
  // origin, CSP, anonymous fetching, asset roots or physical WASM ceilings.
  await Promise.all([
    bundleRuntimeHost(nativePath),
    bundleRuntimeHost(path.join(runtimeDirectory, 'csharp/WasmSharpWorker.js')),
  ]);

  const common = {
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    minify: true,
    sourcemap: false,
  };
  await Promise.all([
    build({
      ...common,
      entryPoints: [path.join(import.meta.dirname, 'javascript.mjs')],
      outfile: path.join(runtimeDirectory, 'javascript.js'),
    }),
    build({
      ...common,
      stdin: {
        contents: 'import ts from "typescript"; export function transpile(source) { const result = ts.transpileModule(source, { reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None, strict: true } }); const errors = result.diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error); if (errors?.length) throw new Error(errors.map(d => ts.flattenDiagnosticMessageText(d.messageText, "\\n")).join("\\n")); return result.outputText; }',
        resolveDir: appRoot,
      },
      outfile: path.join(runtimeDirectory, 'typescript.js'),
    }),
    build({
      ...common,
      entryPoints: [path.join(import.meta.dirname, 'lua.mjs')],
      outfile: path.join(runtimeDirectory, 'lua.js'),
      define: { process: 'undefined' },
      plugins: [{
        name: 'deny-node-lua-io',
        setup(builder) {
          builder.onResolve({ filter: /^(node:)?(fs|path|os|child_process|url|module)$/ }, () => ({
            path: 'unavailable', namespace: 'no-host-io',
          }));
          builder.onLoad({ filter: /.*/, namespace: 'no-host-io' }, () => ({
            contents: 'module.exports = {};', loader: 'js',
          }));
        },
      }],
    }),
    cp(path.join(import.meta.dirname, 'runner.js'), path.join(runtimeDirectory, 'runner.js')),
  ]);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  await prepareRuntimes();
}
