import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(project, '../../generated-artifacts/model-lod-preview');
await mkdir(output, { recursive: true });
await writeFile(resolve(output, 'index.html'), `<!doctype html><html><head><meta charset="utf-8">
<title>Actual model LOD worker and inspector verification</title>
<style>body{background:#11121a;color:#eee;font:14px Arial;margin:30px auto;max-width:700px}fieldset{border:1px solid #555;margin:12px 0;padding:16px}label{display:flex;gap:10px;align-items:center;margin:7px 0}input,select,button{font:inherit;padding:5px}input[type=number]{width:100px}summary{cursor:pointer;font-weight:bold}small{color:#aaa}p{line-height:1.5}</style>
</head><body><p id="verification">Preparing the actual browser worker…</p><div id="root"></div>
<script type="module">
import RefreshRuntime from "/madhorse-studio/@react-refresh";
RefreshRuntime.injectIntoGlobalHook(window);
window.$RefreshReg$ = () => {};
window.$RefreshSig$ = () => type => type;
window.__vite_plugin_react_preamble_installed__ = true;
</script>
<script type="module" src="/madhorse-studio/tests/fixtures/model-lod-browser.tsx"></script></body></html>`);
console.log('LOD worker + actual inspector fixture: /@fs' + output + '/index.html');
