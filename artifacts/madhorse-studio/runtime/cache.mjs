import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const pending = new Map();
const marker = '.ready';
async function ready(directory) {
  try { return await readFile(path.join(directory, marker), 'utf8') === 'ready-v1\n'; }
  catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}

/** Publish an immutable cache only after all builds and safety patches finish.
 * Separate processes may race to publish, but never copy over one another.
 * Only this invocation's private staging directory may be removed.
 */
export function prepareRuntimeCache(directory, prepare) {
  if (pending.has(directory)) return pending.get(directory);
  const job = (async () => {
    if (await ready(directory)) return directory;
    const parent = path.dirname(directory);
    await mkdir(parent, { recursive: true });
    const staging = await mkdtemp(path.join(parent, '.preparing-'));
    try {
      await prepare(staging);
      await writeFile(path.join(staging, marker), 'ready-v1\n');
      try { await rename(staging, directory); }
      catch (error) {
        if (!['EEXIST', 'ENOTEMPTY'].includes(error.code) || !await ready(directory)) throw error;
        // Another process published an equally complete cache first.
      }
      return directory;
    } finally {
      await rm(staging, { recursive: true, force: true, maxRetries: 2, retryDelay: 100 });
    }
  })();
  pending.set(directory, job);
  job.finally(() => { if (pending.get(directory) === job) pending.delete(directory); }).catch(() => {});
  return job;
}
