import type { ModelLodInput } from './model-lod-simplify';
type Job = { input: ModelLodInput; resolve: (levels: Uint32Array[]) => void; reject: (error: Error) => void };
const queue: Job[] = [];
let worker: Worker | null = null;
let active: Job | null = null;
let timeout: ReturnType<typeof setTimeout> | undefined;
let idle: ReturnType<typeof setTimeout> | undefined;
function finish(error?: Error, levels?: Uint32Array[]) {
  clearTimeout(timeout);
  const job = active;
  active = null;
  if (error) { worker?.terminate(); worker = null; job?.reject(error); }
  else job?.resolve(levels ?? []);
  pump();
}
function pump() {
  if (active) return;
  clearTimeout(idle);
  const job = queue.shift();
  if (!job) {
    idle = setTimeout(() => { worker?.terminate(); worker = null; }, 30_000);
    return;
  }
  active = job;
  try {
    worker ??= new Worker(new URL('./model-lod-worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = event => event.data.error
      ? finish(new Error(event.data.error)) : finish(undefined, event.data.levels);
    worker.onerror = () => finish(new Error('Detail worker failed; keeping original geometry.'));
    timeout = setTimeout(() => finish(new Error('Detail generation timed out; keeping original geometry.')), 15_000);
    worker.postMessage(job.input, [job.input.positions.buffer, job.input.indices.buffer]);
  } catch (error) { finish(error instanceof Error ? error : new Error('Detail worker unavailable.')); }
}
export function generateModelLod(input: ModelLodInput): Promise<Uint32Array[]> {
  if (typeof Worker === 'undefined') return Promise.reject(new Error('Background workers are unavailable.'));
  if (queue.length >= 8) return Promise.reject(new Error('Detail queue is full; toggle automatic detail to retry.'));
  return new Promise((resolve, reject) => { queue.push({ input, resolve, reject }); pump(); });
}
export function canQueueModelLod(): boolean {
  return typeof Worker !== 'undefined' && queue.length < 8;
}
