export const diagnosticSources = ['editor', 'script', 'rendering', 'assets', 'storage', 'network', 'mad-builder'] as const;
export type DiagnosticSource = typeof diagnosticSources[number];
export type DiagnosticLevel = 'error' | 'warning' | 'info';
export type Diagnostic = {
  id: number;
  time: number;
  source: DiagnosticSource;
  level: DiagnosticLevel;
  message: string;
  detail: string;
  occurrences: number;
};

export const diagnosticLimit = 200;
let nextId = 1;
let snapshot: { entries: Diagnostic[]; discarded: number } = { entries: [], discarded: 0 };
const listeners = new Set<() => void>();
let notification: ReturnType<typeof setTimeout> | undefined;
function notify() {
  // Do not render once per guest log line or console call.
  if (notification !== undefined) return;
  notification = setTimeout(() => {
    notification = undefined;
    listeners.forEach((listener) => listener());
  }, 100);
}

export const getDiagnostics = () => snapshot;
export function subscribeDiagnostics(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function diagnosticLocation(input: string) {
  try {
    const url = new URL(input, window.location.href);
    if (url.protocol === 'blob:') return '[local asset]';
    if (url.protocol === 'data:') return '[embedded asset]';
    return `${url.origin === window.location.origin ? '' : url.origin}${url.pathname}`.slice(0, 300);
  } catch { return '[unknown location]'; }
}

function clean(input: string, limit: number) {
  return input.slice(0, limit)
    .replace(/https?:\/\/[^\s"'<>)]*/gi, (url) => diagnosticLocation(url))
    .replace(/\bBearer\s+[\w.+/=-]+/gi, 'Bearer [redacted]')
    .replace(/((?:password|secret|api[_-]?key|access[_-]?token|authorization)\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;}]+)/gi, '$1[redacted]');
}

/** Bounded, descriptor-only formatting: never invoke getters or serialize a guest object wholesale. */
export function diagnosticText(value: unknown, depth = 0, seen = new Set<object>()): string {
  try {
    if (typeof value === 'string') return value.slice(0, 3000);
    if (value === null || typeof value !== 'object') return String(value).slice(0, 3000);
    if (value instanceof Error) return `${value.name}: ${value.message}\n${value.stack ?? ''}`.slice(0, 8000);
    if (seen.has(value)) return '[circular]';
    if (depth >= 2) return '[object]';
    seen.add(value);
    const names = Object.getOwnPropertyNames(value).slice(0, 10);
    return `{ ${names.map((name) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, name);
      const content = descriptor && 'value' in descriptor
        ? diagnosticText(descriptor.value, depth + 1, seen) : '[accessor]';
      return `${name.slice(0, 60)}: ${content.slice(0, 300)}`;
    }).join(', ')} }`.slice(0, 3000);
  } catch { return '[unavailable diagnostic value]'; }
}

export function publishDiagnostic(
  source: DiagnosticSource, level: DiagnosticLevel, message: string, detail = '',
) {
  const safeMessage = clean(message, 2000);
  if (!safeMessage.trim()) return;
  const safeDetail = clean(detail, 8000);
  const time = Date.now();
  const previous = snapshot.entries.findLast((entry) =>
    time - entry.time < 2000 && entry.source === source && entry.level === level &&
    entry.message === safeMessage && entry.detail === safeDetail);
  if (previous) {
    snapshot = { ...snapshot, entries: snapshot.entries.map((entry) =>
      entry.id === previous.id ? { ...entry, time, occurrences: entry.occurrences + 1 } : entry) };
  } else {
    const entries = [...snapshot.entries, { id: nextId++, time, source, level, message: safeMessage, detail: safeDetail, occurrences: 1 }];
    snapshot = { entries: entries.slice(-diagnosticLimit), discarded: snapshot.discarded + Math.max(0, entries.length - diagnosticLimit) };
  }
  notify();
}

export function publishStatus(source: DiagnosticSource, message: string) {
  if (!message) return;
  const level = /could not|cannot|failed|error|unavailable|invalid|rejected|corrupt|missing|storage is full/i.test(message)
    ? 'error' : 'info';
  publishDiagnostic(source, level, message);
}

export function clearDiagnostics() {
  snapshot = { entries: [], discarded: 0 };
  notify();
}

function sourceFor(message: string): DiagnosticSource {
  if (/webgl|three\.|renderer|graphics context|texture/i.test(message)) return 'rendering';
  if (/asset|model loader|gltf|\.fbx|\.obj\b/i.test(message)) return 'assets';
  if (/storage|indexeddb|quota/i.test(message)) return 'storage';
  if (/fetch|network|http\b/i.test(message)) return 'network';
  if (/sandbox|script runtime|compil/i.test(message)) return 'script';
  return 'editor';
}

let installed = false;
export function installSystemDiagnostics() {
  if (installed) return () => {};
  installed = true;
  const warn = console.warn;
  const error = console.error;
  const capture = (level: DiagnosticLevel, args: unknown[]) => {
    const detail = args.slice(0, 6).map((arg) => diagnosticText(arg)).join('\n');
    publishDiagnostic(sourceFor(detail), level, detail.split('\n')[0], detail);
  };
  const warnWrapper: typeof console.warn = (...args) => { warn.apply(console, args); capture('warning', args); };
  const errorWrapper: typeof console.error = (...args) => { error.apply(console, args); capture('error', args); };
  console.warn = warnWrapper;
  console.error = errorWrapper;

  const onError = (event: Event) => {
    if (event instanceof ErrorEvent) {
      publishDiagnostic(sourceFor(event.message), 'error', event.message,
        `${diagnosticText(event.error)}\n${diagnosticLocation(event.filename)}:${event.lineno}:${event.colno}`);
    } else if (event.target instanceof Element) {
      const url = event.target.getAttribute('src') ?? event.target.getAttribute('href') ?? '';
      publishDiagnostic('assets', 'error', `Resource failed to load: ${diagnosticLocation(url)}`);
    }
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    const detail = diagnosticText(event.reason);
    publishDiagnostic(sourceFor(detail), 'error', `Unhandled promise: ${detail.split('\n')[0]}`, detail);
  };
  window.addEventListener('error', onError, true);
  window.addEventListener('unhandledrejection', onRejection);

  const originalFetch = window.fetch;
  const fetchWrapper: typeof window.fetch = async function (this: Window, ...args) {
    const input = args[0];
    const url = diagnosticLocation(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    try {
      const response = await originalFetch.apply(this, args);
      if (!response.ok) publishDiagnostic('network', 'error', `HTTP ${response.status}: ${url}`);
      return response;
    } catch (failure) {
      if (!(failure instanceof Error && failure.name === 'AbortError')) {
        publishDiagnostic('network', 'error', `Request failed: ${url}`, diagnosticText(failure));
      }
      throw failure;
    }
  };
  window.fetch = fetchWrapper;
  return () => {
    if (console.warn === warnWrapper) console.warn = warn;
    if (console.error === errorWrapper) console.error = error;
    if (window.fetch === fetchWrapper) window.fetch = originalFetch;
    window.removeEventListener('error', onError, true);
    window.removeEventListener('unhandledrejection', onRejection);
    installed = false;
  };
}
