import { build } from 'esbuild';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const directory = await mkdtemp(join(tmpdir(), 'madhorse-system-reference-'));
try {
  const result = await build({
    stdin: {
      resolveDir: root,
      loader: 'ts',
      contents: `
        import assert from 'node:assert/strict';
        import {
          MADHORSE_ENGINE_SYSTEM_REFERENCE as reference,
          MADHORSE_ENGINE_SYSTEM_REFERENCE_PROMPT as prompt,
        } from './artifacts/api-server/src/lib/engine-system-reference';
        import { getWebGLRenderProfile } from './artifacts/madhorse-studio/src/lib/webgl-render-profile';

        assert.equal(Object.isFrozen(reference), true, 'System reference root is immutable');
        assert.equal(Object.isFrozen(reference.systems), true, 'System catalog is immutable');
        assert.equal(Object.isFrozen(reference.systems[0]), true, 'System entries are immutable');
        assert.ok(reference.systems.some(system => system.id === 'materials'));
        assert.ok(reference.systems.some(system => system.id === 'projects'));
        assert.ok(prompt.includes('Detailed safe scene construction rules:'));
        assert.ok(prompt.includes('Saved project data is user-owned and editable'));

        const clone = JSON.parse(JSON.stringify(reference));
        clone.policy = 'modified';
        assert.notEqual(reference.policy, clone.policy, 'Changing an API response copy cannot mutate protected source data');

        const high = getWebGLRenderProfile('high', false);
        assert.deepEqual(high.dpr, [1, 2]);
        assert.equal(high.antialias, true);
        assert.equal(high.shadows, true);
        assert.equal(high.powerPreference, 'high-performance');
        const phone = getWebGLRenderProfile('high', true);
        assert.equal(phone.dpr, 1);
        assert.equal(phone.shadows, false);
        const fast = getWebGLRenderProfile('performance', false);
        assert.equal(fast.antialias, false);
        assert.equal(fast.shadows, false);
        console.log('Protected engine reference and WebGL render profiles passed.');
      `,
    },
    bundle: true,
    platform: 'node',
    format: 'esm',
    write: false,
  });
  const output = join(directory, 'test.mjs');
  await writeFile(output, result.outputFiles[0].text);
  await import(pathToFileURL(output).href);
} finally {
  await rm(directory, { recursive: true, force: true });
}
