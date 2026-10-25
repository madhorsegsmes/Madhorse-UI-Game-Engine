import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const expected = ['2d-fighting','rts','fps','third-person-shooter','mmorpg','2d-rpg','cart-racer','card-duel','basketball','blank'];
const base = `https://${process.env.REPLIT_DEV_DOMAIN}`;
if (!process.argv.includes('--fixture-only')) {
  assert(process.env.REPLIT_DEV_DOMAIN, 'Development domain must be configured.');
  const response = await fetch(`${base}/api/template-tutorials`);
  assert.equal(response.status, 200);
  const { tutorials } = await response.json();
  assert.deepEqual(tutorials.map(item => item.id), expected);
  for (const item of tutorials) {
    assert(item.durationSeconds >= 20 && item.durationSeconds <= 120);
    const url = `${base}/api/template-tutorials/${item.id}/video`;
    const head = await fetch(url, { method: 'HEAD' });
    assert.equal(head.status, 200); assert.equal(head.headers.get('content-type'), 'video/mp4');
    const size = Number(head.headers.get('content-length')); assert(size > 1024);
    assert.equal(head.headers.get('accept-ranges'), 'bytes');
    const range = await fetch(url, { headers: { Range: 'bytes=0-1023' } });
    assert.equal(range.status, 206); assert.equal(range.headers.get('content-range'), `bytes 0-1023/${size}`);
    const bytes = Buffer.from(await range.arrayBuffer()); assert.equal(bytes.length, 1024);
    assert.equal(bytes.toString('ascii', 4, 8), 'ftyp', 'Uploaded video must be an MP4, not an error page.');
    const poster = await fetch(`${base}/api/template-tutorials/${item.id}/poster`, { headers: { Range: 'bytes=0-7' } });
    assert.equal(poster.status, 206);
    const image = Buffer.from(await poster.arrayBuffer()); assert.equal(image[0], 255); assert.equal(image[1], 216);
    assert(item.hasWebM, 'Every guide needs a codec-compatible playback alternative.');
    const webm = await fetch(`${base}/api/template-tutorials/${item.id}/webm`, { headers: { Range: 'bytes=0-15' } });
    assert.equal(webm.status, 206); assert.equal(webm.headers.get('content-type'), 'video/webm');
    assert.equal(Buffer.from(await webm.arrayBuffer()).toString('hex',0,4),'1a45dfa3','WebM EBML header must be valid.');
    for (const chapter of item.chapters) assert(chapter.seconds >= 0 && chapter.seconds < item.durationSeconds);
    console.log(`PASS: ${item.id}, playable MP4/poster endpoints, ${item.chapters.length} chapter links`);
  }
  const url = `${base}/api/template-tutorials/basketball/video`;
  const head = await fetch(url, { method: 'HEAD' }), etag = head.headers.get('etag');
  const invalid = await fetch(url, { headers: { Range: 'bytes=9999999999-' } }); assert.equal(invalid.status, 416);
  const multi = await fetch(url, { headers: { Range: 'bytes=0-5,10-20' } }); assert.equal(multi.status, 416);
  const suffix = await fetch(url, { headers: { Range: 'bytes=-16' } }); assert.equal(suffix.status, 206);
  assert.equal((await suffix.arrayBuffer()).byteLength, 16);
  const cached = await fetch(url, { headers: { 'If-None-Match': etag } }); assert.equal(cached.status, 304);
  assert.equal((await fetch(`${base}/api/template-tutorials/not-a-template/video`)).status, 404);
  assert.equal((await fetch(`${base}/api/template-tutorials/basketball/not-media`)).status, 404);
  console.log('PASS: seek ranges, suffix ranges, invalid ranges, ETag caching and fixed read-only media whitelist.');
}
const fixture = resolve(project, '../../generated-artifacts/tutorial-library-preview');
await mkdir(fixture, { recursive: true });
const resolvePackage = createRequire(join(project, 'package.json')).resolve;
await build({
  absWorkingDir: project, bundle: true, platform: 'browser', format: 'esm', jsx: 'automatic',
  outfile: join(fixture, 'app.js'),
  plugins: [{ name: 'single-react', setup(b) {
    b.onResolve({ filter: /^react(?:\/.*)?$/ }, args => ({ path: resolvePackage(args.path) }));
  }}],
  stdin: { resolveDir: project, loader: 'tsx', contents: `
    import {createRoot} from 'react-dom/client';import {flushSync} from 'react-dom';
    import {TemplateTutorialLibrary} from './src/components/template-tutorial-library';
    flushSync(()=>createRoot(document.getElementById('root')).render(<TemplateTutorialLibrary/>));
    document.querySelector('[data-testid="open-template-tutorials"]').click();
  ` },
});
const prefix = '/madhorse-studio/@fs'+fixture;
await writeFile(join(fixture, 'index.html'), `<!doctype html><html><head><meta charset="utf-8">
<title>Madhorse Tutorial Library verification</title><link rel="stylesheet" href="/madhorse-studio/src/index.css">
<link rel="stylesheet" href="${prefix}/app.css"><style>body{background:#0e0b12;color:white}</style></head>
<body><div id="root"></div><script type="module" src="${prefix}/app.js"></script></body></html>`);
console.log('Actual-library fixture:', fixture+'/index.html');
