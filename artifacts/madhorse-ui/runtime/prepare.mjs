import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

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
      define: { process: 'undefined', 'process.env.FENGARICONF': 'undefined' },
      plugins: [{
        name: 'deny-node-lua-io',
        setup(builder) {
          builder.onResolve({ filter: /^(node:)?(fs|path|os|child_process|readline-sync|tmp)$/ }, () => ({
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
