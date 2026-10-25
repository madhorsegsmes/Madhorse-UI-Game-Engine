import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { bundleRuntimeHost } from '../../runtime/bundle-host.mjs';

test('host bundling removes sibling static imports and preserves runtime asset URLs', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'madhorse-runtime-host-'));
  try {
    const entry = path.join(dir, 'entry.mjs');
    await writeFile(path.join(dir, 'dependency.mjs'),
      'export const value = 42; export const asset = new URL("compiler.wasm", import.meta.url).href;');
    await writeFile(entry, 'export { value, asset } from "./dependency.mjs"; export const nodeHost = typeof process;');
    const metadata = await bundleRuntimeHost(entry);
    assert.ok(Object.values(metadata.outputs).every(output =>
      output.imports.every(item => item.kind !== 'import-statement')));
    const host = await import(pathToFileURL(entry).href);
    assert.equal(host.value, 42);
    assert.equal(host.asset, pathToFileURL(path.join(dir, 'compiler.wasm')).href);
    assert.equal(host.nodeHost, 'undefined');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('browser host packaging does not expose Node filesystem APIs', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'madhorse-runtime-host-'));
  try {
    const entry = path.join(dir, 'entry.mjs');
    await writeFile(entry, 'import fs from "node:fs"; import nodeProcess from "process"; export const readFile = fs.readFile; export const versions = nodeProcess.versions;');
    await bundleRuntimeHost(entry);
    const host = await import(pathToFileURL(entry).href);
    assert.equal(host.readFile, undefined);
    assert.equal(host.versions, undefined);
    assert.ok(!(await readFile(entry, 'utf8')).includes('from"node:fs"'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
