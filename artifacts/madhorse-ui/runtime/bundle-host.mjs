import { build } from 'esbuild';
import { writeFile } from 'node:fs/promises';
import { isBuiltin } from 'node:module';

// Keep each entry in its original directory: import.meta.url must still resolve
// compiler WASM, assemblies and sysroot files relative to that directory.
export async function bundleRuntimeHost(entry) {
  const result = await build({
    entryPoints: [entry],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    minify: true,
    write: false,
    metafile: true,
    define: { process: 'undefined' },
    plugins: [{
      name: 'deny-node-runtime-io',
      setup(builder) {
        builder.onResolve({ filter: /^(?:node:)?[\w/-]+$/ }, args => {
          if (isBuiltin(args.path)) return { path: 'unavailable', namespace: 'no-host-io' };
        });
        builder.onLoad({ filter: /.*/, namespace: 'no-host-io' }, () => ({
          contents: 'module.exports = {};', loader: 'js',
        }));
      },
    }],
  });
  for (const output of Object.values(result.metafile.outputs)) {
    if (output.imports.some(item => item.kind === 'import-statement')) {
      throw new Error('Runtime host still has static module dependencies; review browser packaging.');
    }
  }
  await writeFile(entry, result.outputFiles[0].contents);
  return result.metafile;
}
