import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(project, '../../generated-artifacts/hierarchy-filter-preview');
await mkdir(output, { recursive: true });
await writeFile(resolve(output, 'index.html'), `<!doctype html><html><head><meta charset="utf-8"><title>Hierarchy filters</title>
<style>body{background:#11121a;color:#eee;font:14px Arial;margin:30px auto;max-width:460px}h1{font-size:18px}.fresh-hierarchy-search{display:flex;gap:6px;margin:8px 0}.fresh-hierarchy-search input,.fresh-hierarchy-search select{background:#100d19;color:#eee;border:1px solid #59406f;border-radius:4px;padding:5px;min-height:28px}.fresh-hierarchy-search input{flex:1;min-width:0}.fresh-hierarchy-search button{background:#21172e;color:#eee;border:1px solid #59406f;border-radius:4px}.fresh-hierarchy-search-count{color:#c6b2d6;font-size:11px}ul{list-style:none;padding:6px;background:#181520;border:1px solid #59406f}li{padding:6px}</style>
</head><body><p id="verification">Running actual Hierarchy controls…</p><div id="root"></div>
<script type="module">import RefreshRuntime from "/madhorse-studio/@react-refresh";
RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;</script>
<script type="module" src="/madhorse-studio/tests/fixtures/hierarchy-filter-browser.tsx"></script></body></html>`);
console.log('Hierarchy filter fixture: /@fs' + output + '/index.html');
