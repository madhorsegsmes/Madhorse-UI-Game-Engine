type ActivitySnapshot = { pending: number; label: string; started: number };
const operations = new Map<number, string>();
const listeners = new Set<() => void>();
let sequence = 0;
let snapshot: ActivitySnapshot = { pending: 0, label: 'Ready', started: 0 };

function publish() {
  snapshot = {
    pending: operations.size,
    label: [...operations.values()].at(-1) ?? 'Ready',
    started: sequence,
  };
  listeners.forEach((listener) => listener());
}

export const getSystemActivity = () => snapshot;
export function subscribeSystemActivity(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Returns an idempotent completion callback, including for failures/cancellation. */
export function beginSystemActivity(label: string) {
  const id = ++sequence;
  operations.set(id, label);
  publish();
  return () => {
    if (operations.delete(id)) publish();
  };
}

export async function withSystemActivity<T>(label: string, work: () => Promise<T>): Promise<T> {
  const finish = beginSystemActivity(label);
  try {
    return await work();
  } finally {
    finish();
  }
}
