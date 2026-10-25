import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { prepareRuntimeCache } from '../runtime/cache.mjs';
const temporary = await mkdtemp(path.join(tmpdir(), 'madhorse-runtime-cache-test-'));
try {
  const single = path.join(temporary, 'single');
  let builds = 0;
  const build = async directory => { builds++; await writeFile(path.join(directory, 'runtime.js'), 'complete'); };
  await Promise.all(Array.from({ length: 8 }, () => prepareRuntimeCache(single, build)));
  await prepareRuntimeCache(single, build);
  assert.equal(builds, 1, 'Same-process callers deduplicate, then reuse the completed cache');
  const failed = path.join(temporary, 'failed');
  await assert.rejects(prepareRuntimeCache(failed, async directory => {
    await writeFile(path.join(directory, 'partial.js'), 'unsafe partial output');
    throw new Error('simulated build failure');
  }), /simulated build failure/);
  await assert.rejects(readFile(path.join(failed, '.ready')), { code: 'ENOENT' });
  assert(!(await readdir(temporary)).some(name => name.startsWith('.preparing-')));
  await prepareRuntimeCache(failed, build);
  const target = path.join(temporary, 'multiprocess');
  const module = new URL('../runtime/cache.mjs', import.meta.url).href;
  const childCode = `
    import {prepareRuntimeCache} from ${JSON.stringify(module)};
    import {writeFile,readFile} from 'node:fs/promises';
    import path from 'node:path';
    const target=${JSON.stringify(target)};
    await prepareRuntimeCache(target,async directory=>{
      await writeFile(path.join(directory,'first'),String(process.pid));
      await new Promise(resolve=>setTimeout(resolve,100));
      await writeFile(path.join(directory,'second'),String(process.pid));
    });
    if(await readFile(path.join(target,'first'),'utf8')!==await readFile(path.join(target,'second'),'utf8'))throw Error('Mixed writers');
  `;
  await Promise.all(Array.from({ length: 4 }, () => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--input-type=module', '-e', childCode], { stdio: ['ignore', 'ignore', 'pipe'], timeout: 15000 });
    let errors = '';
    child.stderr.on('data', chunk => { errors += chunk; });
    child.on('error', reject);
    child.on('exit', (code, signal) => code === 0 ? resolve() : reject(new Error(`Child failed: ${code}/${signal}: ${errors}`)));
  })));
  assert.equal(await readFile(path.join(target, 'first'), 'utf8'), await readFile(path.join(target, 'second'), 'utf8'));
  assert(!(await readdir(temporary)).some(name => name.startsWith('.preparing-')), 'Losing writers remove only their own staging directories');
  console.log('PASS: same-process deduplication, cache reuse, failed-build cleanup/retry and four independent processes publishing consistent complete runtimes.');
} finally { await rm(temporary, { recursive: true, force: true }); }
