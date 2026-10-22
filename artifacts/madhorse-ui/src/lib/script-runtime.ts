export type RuntimeScript = { id: string; name: string; language: string; content: string };
export type RuntimeEvent =
  | { type: 'output'; text: string }
  | { type: 'phase'; phase: string; message: string }
  | { type: 'complete' }
  | { type: 'error'; message: string };

export function startScriptRuntime(
  script: RuntimeScript,
  files: RuntimeScript[],
  onEvent: (event: RuntimeEvent) => void,
) {
  const root = new URL(`${import.meta.env.BASE_URL}runtimes/`, window.location.origin);
  const iframe = document.createElement('iframe');
  iframe.setAttribute('sandbox', 'allow-scripts');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.hidden = true;
  const channel = new MessageChannel();
  let timer: ReturnType<typeof setTimeout>;
  let finished = false;
  let executing = false;
  const cleanup = () => {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    channel.port1.postMessage({ type: 'stop' });
    channel.port1.close();
    iframe.remove();
  };
  const timeout = (milliseconds: number, message: string) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      onEvent({ type: 'error', message });
      cleanup();
    }, milliseconds);
  };
  const csp = [
    "default-src 'none'",
    `script-src 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob: ${root.href}`,
    'worker-src blob:',
    `connect-src ${root.href}`,
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ');
  const bootstrap = `const report = self.postMessage.bind(self);
import(${JSON.stringify(new URL('runner.js', root).href)}).then(() => {
  report({type: 'worker-ready'});
}).catch(error => {
  report({type: 'error', message: 'Runtime startup failed: ' + (error.stack || error.message || String(error))});
});`;
  // No allow-same-origin: this frame and its worker have an opaque origin.
  // The worker inherits the frame CSP, including the runtime-assets-only
  // network allowlist. It cannot access app cookies, storage, DOM, or APIs.
  iframe.srcdoc = `<!doctype html><meta http-equiv="Content-Security-Policy" content="${csp}">
<script>
addEventListener('message', function initialize(event) {
  if (event.source !== parent || !event.ports[0]) return;
  removeEventListener('message', initialize);
  const port = event.ports[0];
  const url = URL.createObjectURL(new Blob([${JSON.stringify(bootstrap)}], {type:'text/javascript'}));
  const worker = new Worker(url);
  const stop = () => { worker.terminate(); URL.revokeObjectURL(url); };
  worker.onmessage = event => port.postMessage(event.data?.type === 'worker-ready' ? {type:'ready'} : event.data);
  worker.onerror = event => { port.postMessage({type:'error', message: event.message || 'The browser blocked the sandbox worker before it could start.'}); stop(); };
  port.onmessage = event => { if (event.data?.type === 'stop') stop(); else worker.postMessage(event.data); };
  port.start();
});
</script>`;
  channel.port1.onmessage = ({ data }) => {
    if (finished) return;
    if (data?.type === 'ready') {
      channel.port1.postMessage({
        language: script.language, source: script.content,
        filename: script.name, files: files.map(({ name, content }) => ({ name, content })),
      });
      return;
    }
    if (!['output', 'phase', 'complete', 'error'].includes(data?.type)) return;
    if (data.type === 'phase') {
      if (data.phase === 'running' && !executing) {
        executing = true;
        timeout(5000, 'Script stopped: the 5-second execution limit was reached.');
      }
    }
    onEvent(data);
    if (data.type === 'complete' || data.type === 'error') cleanup();
  };
  iframe.onload = () => iframe.contentWindow?.postMessage({ type: 'initialize' }, '*', [channel.port2]);
  document.body.appendChild(iframe);
  timeout(180000, 'The isolated runtime could not start.');
  return { stop: cleanup };
}
