import { build } from 'esbuild';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const project = dirname(dirname(fileURLToPath(import.meta.url)));
const directory = await mkdtemp(join(tmpdir(), 'madhorse-webgl-'));
try {
  const result = await build({
    stdin: { resolveDir: project, loader: 'ts', contents: `
      import assert from 'node:assert/strict';
      import { requestWebGL2Context, WebGLStartupError, describeGraphicsFailure, observeWebGLContext } from './src/lib/webgl-context';
      import { getWebGLRenderProfile } from './src/lib/webgl-render-profile';
      const good = { isContextLost: () => false };
      const lost = { isContextLost: () => true };
      class Canvas extends EventTarget {
        calls = [];
        constructor(results) { super(); this.results = results; }
        getContext(type, attributes) {
          this.calls.push({ type, attributes });
          const next = this.results.shift();
          if (next instanceof Error) throw next;
          if (!next) {
            const event = new Event('webglcontextcreationerror');
            Object.assign(event, { statusMessage: 'GPU context rejected' });
            this.dispatchEvent(event);
          }
          return next ?? null;
        }
      }
      const profile = getWebGLRenderProfile('high', false);
      assert.equal(profile.antialias, true);
      assert.equal(profile.powerPreference, 'high-performance');
      const preferred = new Canvas([good]);
      assert.equal(requestWebGL2Context(preferred, profile).compatibility, false);
      assert.equal(preferred.calls.length, 1);
      assert.equal(preferred.calls[0].attributes.antialias, true);
      const compatible = new Canvas([null, good]);
      assert.equal(requestWebGL2Context(compatible, profile).compatibility, true);
      assert.equal(compatible.calls.length, 2);
      assert.equal(compatible.calls[1].attributes.antialias, false);
      assert.equal(compatible.calls[1].attributes.powerPreference, 'default');
      assert.equal(compatible.calls[1].attributes.failIfMajorPerformanceCaveat, false);
      const power = new Canvas([new Error('preferred GPU blocked'), lost, good]);
      assert.equal(requestWebGL2Context(power, profile).context, good);
      assert.equal(power.calls[2].attributes.powerPreference, 'low-power');
      const unavailable = new Canvas([null, null, null]);
      let failure;
      try { requestWebGL2Context(unavailable, profile); } catch (error) { failure = error; }
      assert(failure instanceof WebGLStartupError);
      assert.equal(unavailable.calls.length, 3, 'Context retries must be bounded');
      assert(unavailable.calls.every(call => call.type === 'webgl2'), 'Do not attempt unsupported WebGL 1');
      assert(failure.reasons.some(reason => reason.includes('GPU context rejected')));
      assert.equal(describeGraphicsFailure(failure).kind, 'context-unavailable');
      assert.equal(describeGraphicsFailure(new Error('Error creating WebGL context.')).kind, 'context-unavailable');
      assert.equal(describeGraphicsFailure(new Error('Bad model geometry')).kind, 'scene-error');
      let losses = 0, restores = 0;
      const canvas = new Canvas([]);
      const detach = observeWebGLContext(canvas, {
        onLost: failure => { losses++; assert.equal(failure.kind, 'context-lost'); },
        onRestored: () => restores++,
      });
      const event = new Event('webglcontextlost', { cancelable: true });
      canvas.dispatchEvent(event);
      assert(event.defaultPrevented, 'Restoration requires cancelling the context-lost default');
      canvas.dispatchEvent(new Event('webglcontextrestored'));
      assert.equal(losses, 1); assert.equal(restores, 1);
      detach();
      canvas.dispatchEvent(new Event('webglcontextlost'));
      canvas.dispatchEvent(new Event('webglcontextrestored'));
      assert.equal(losses, 1); assert.equal(restores, 1, 'Disposed views must detach GPU listeners');
      console.log('PASS: preferred and compatibility contexts, bounded retries, WebGL 2-only contract, accurate errors, loss/restoration callbacks, and listener cleanup.');
    ` },
    bundle: true, platform: 'node', format: 'esm', write: false,
  });
  const entry = join(directory, 'test.mjs');
  await writeFile(entry, result.outputFiles[0].contents);
  await import(pathToFileURL(entry).href);
} finally { await rm(directory, { recursive: true, force: true }); }
