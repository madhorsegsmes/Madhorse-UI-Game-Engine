import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(project, '../../generated-artifacts/scene-editor-controls-preview');
await mkdir(output, { recursive: true });
await writeFile(resolve(output, 'index.html'), `<!doctype html><html><head><meta charset="utf-8">
<title>Scene editor controls verification</title>
<style>body{background:#11121a;color:#eee;font:14px Arial;margin:40px auto;max-width:600px}p{line-height:1.5}.fresh-hierarchy{max-width:380px;padding:12px;border:1px solid #7543a1}.fresh-hierarchy-row-content{padding:8px 0}.fresh-editor-reset-controls{margin-bottom:12px}</style>
</head><body><p id="verification">Checking actual editor controls…</p><div id="root"></div>
<script type="module">
import RefreshRuntime from "/madhorse-studio/@react-refresh";
RefreshRuntime.injectIntoGlobalHook(window);
window.$RefreshReg$ = () => {};
window.$RefreshSig$ = () => type => type;
window.__vite_plugin_react_preamble_installed__ = true;
</script>
<script type="module" src="/madhorse-studio/tests/fixtures/scene-editor-controls-browser.tsx"></script></body></html>`);
console.log('Actual editor controls fixture: /@fs' + output + '/index.html');
