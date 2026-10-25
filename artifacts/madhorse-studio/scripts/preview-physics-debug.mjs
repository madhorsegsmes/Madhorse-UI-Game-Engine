import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(project, '../../generated-artifacts/physics-debug-preview');
await mkdir(output, { recursive: true });
await writeFile(resolve(output, 'index.html'), `<!doctype html><html><head><meta charset="utf-8"><title>Physics guide verification</title>
<style>body{background:#11121a;color:#eee;font:14px Arial;margin:30px auto;max-width:600px}p{line-height:1.5}fieldset label{display:flex;gap:8px;align-items:center}select{background:#211927;color:#eee;margin-left:10px}small{display:block;color:#bdb0cc;margin-top:12px}</style>
</head><body><p id="verification">Checking physics guides…</p><div id="root"></div>
<script type="module">import RefreshRuntime from "/madhorse-studio/@react-refresh";
RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;</script>
<script type="module" src="/madhorse-studio/tests/fixtures/physics-debug-browser.tsx"></script></body></html>`);
console.log('Physics guide fixture: /@fs' + output + '/index.html');
