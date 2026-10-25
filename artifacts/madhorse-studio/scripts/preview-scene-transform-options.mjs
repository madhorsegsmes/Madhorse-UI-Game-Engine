import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(project, '../../generated-artifacts/scene-transform-options-preview');
await mkdir(output, { recursive: true });
await writeFile(resolve(output, 'index.html'), `<!doctype html><html><head><meta charset="utf-8">
<title>Scene snapping verification</title>
<style>body{background:#11121a;color:#eee;font:14px Arial;margin:40px auto;max-width:700px}p{line-height:1.5}.mh-transform-options{padding:12px;max-width:340px;border:1px solid #7543a1}</style>
</head><body><p id="verification">Checking actual snapping controls…</p><div id="root"></div>
<script type="module">
import RefreshRuntime from "/madhorse-studio/@react-refresh";
RefreshRuntime.injectIntoGlobalHook(window);
window.$RefreshReg$ = () => {};
window.$RefreshSig$ = () => type => type;
window.__vite_plugin_react_preamble_installed__ = true;
</script>
<script type="module" src="/madhorse-studio/tests/fixtures/scene-transform-options-browser.tsx"></script></body></html>`);
console.log('Actual transform controls fixture: /@fs' + output + '/index.html');
