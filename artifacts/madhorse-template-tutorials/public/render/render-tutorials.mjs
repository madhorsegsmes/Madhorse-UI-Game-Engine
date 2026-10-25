// Usage: node public/render/render-tutorials.mjs <outDir> [slug...]
import { spawn } from 'node:child_process';
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(process.argv[2] || 'generated-artifacts/template-tutorials'); fs.mkdirSync(out, { recursive: true });
const FPS = 30, PORT = 9333;
const chrome = spawn(process.env.CHROMIUM || 'chromium', ['--headless=new', `--remote-debugging-port=${PORT}`, '--no-sandbox', '--disable-gpu', '--window-size=1920,1080', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let targets; for (let i = 0; i < 60; i++) { try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); if (targets.find(t => t.type === 'page')) break; } catch {} await sleep(300); }
const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let id = 0; const pending = new Map(); ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const evaluate = async expr => { const m = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (m.result?.exceptionDetails) throw new Error(JSON.stringify(m.result.exceptionDetails)); return m.result.result.value; };
await send('Page.enable'); await send('Page.navigate', { url: 'file://' + path.join(here, 'capture.html') }); await sleep(1500);
console.log('fonts loaded:', await evaluate('window.ready'));
const all = await evaluate('TutorialEngine.slugs'); const slugs = process.argv.slice(3).length ? process.argv.slice(3) : all;
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify({ generatedAt: new Date().toISOString(), width: 1920, height: 1080, fps: FPS, audio: false,
  tutorials: (await evaluate('JSON.stringify(TutorialEngine.manifest())')).length ? JSON.parse(await evaluate('JSON.stringify(TutorialEngine.manifest())')).map(m => ({ ...m, video: `${m.slug}.mp4`, poster: `${m.slug}.jpg` })) : [] }, null, 2));
for (const slug of slugs) {
  const dur = await evaluate(`TutorialEngine.duration(${JSON.stringify(slug)})`); const n = Math.round(dur * FPS);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(out, `${slug}.mp4`)], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise(r => ff.on('close', r));
  for (let f = 0; f < n; f++) { const b64 = await evaluate(`frame(${JSON.stringify(slug)},${f / FPS})`); if (!ff.stdin.write(Buffer.from(b64, 'base64'))) await new Promise(r => ff.stdin.once('drain', r)); }
  ff.stdin.end(); await done;
  // poster: the objective beat of the guide
  const t = await evaluate(`(()=>{const c=TutorialEngine.chapters(${JSON.stringify(slug)}).find(c=>c.id==='goal');return c.start+3.2})()`);
  fs.writeFileSync(path.join(out, `${slug}.jpg`), Buffer.from(await evaluate(`frame(${JSON.stringify(slug)},${t},0.92)`), 'base64'));
  console.log(slug, dur.toFixed(2) + 's', n, 'frames');
}
ws.close(); chrome.kill();
