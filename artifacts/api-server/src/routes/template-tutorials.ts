import { Router, type IRouter } from 'express';
import manifest from '../data/template-tutorials.json' with { type: 'json' };
import { tutorialStorage } from '../lib/tutorial-storage';

type Tutorial = {
  id: string; title: string; description: string; durationSeconds: number;
  chapters: { title: string; seconds: number }[];
  videoObject: string; posterObject: string; webmObject?: string;
};
const tutorials = manifest.tutorials as Tutorial[];
const router: IRouter = Router();

// Public, system-authored instructional media only. No user/project assets here.
router.get('/template-tutorials', (_req, res) => {
  if (tutorials.length !== 10) {
    res.status(503).json({ message: 'Tutorial videos are not available yet. Please try again shortly.' });
    return;
  }
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.json({
    revision: manifest.revision,
    tutorials: tutorials.map(({ id, title, description, durationSeconds, chapters, webmObject }) =>
      ({ id, title, description, durationSeconds, chapters, hasWebM: Boolean(webmObject) })),
  });
});

router.get('/template-tutorials/:id/:kind', async (req, res) => {
  const tutorial = tutorials.find(item => item.id === req.params.id);
  const kind = req.params.kind;
  if (!tutorial || (kind !== 'video' && kind !== 'poster' && kind !== 'webm') || (kind === 'webm' && !tutorial.webmObject)) {
    res.status(404).json({ message: 'Tutorial not found.' }); return;
  }
  const bucket = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!bucket) { res.status(503).json({ message: 'Tutorial media storage is unavailable.' }); return; }
  try {
    const file = tutorialStorage.bucket(bucket).file(kind === 'webm' ? tutorial.webmObject! : kind === 'video' ? tutorial.videoObject : tutorial.posterObject);
    const [metadata] = await file.getMetadata();
    const size = Number(metadata.size);
    if (!Number.isSafeInteger(size) || size < 1) throw new Error('Invalid media size');
    const etag = `"${metadata.md5Hash ?? metadata.generation}"`;
    res.set({
      'Content-Type': kind === 'webm' ? 'video/webm' : kind === 'video' ? 'video/mp4' : 'image/jpeg',
      'Accept-Ranges': 'bytes', 'Cache-Control': 'public, max-age=3600',
      ETag: etag, 'X-Content-Type-Options': 'nosniff',
    });
    if (!req.headers.range && req.headers['if-none-match'] === etag) { res.status(304).end(); return; }
    let start = 0, end = size - 1;
    if (req.headers.range && (!req.headers['if-range'] || req.headers['if-range'] === etag)) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
      if (!match || (!match[1] && !match[2])) {
        res.status(416).set('Content-Range', `bytes */${size}`).end(); return;
      }
      if (!match[1]) { start = Math.max(0, size - Number(match[2])); }
      else { start = Number(match[1]); if (match[2]) end = Math.min(end, Number(match[2])); }
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= size) {
        res.status(416).set('Content-Range', `bytes */${size}`).end(); return;
      }
      res.status(206).set('Content-Range', `bytes ${start}-${end}/${size}`);
    }
    res.set('Content-Length', String(end - start + 1));
    if (req.method === 'HEAD') { res.end(); return; }
    const stream = file.createReadStream({ start, end });
    res.on('close', () => stream.destroy());
    stream.on('error', () => {
      req.log.warn({ tutorialId: tutorial.id }, 'Tutorial stream unavailable');
      if (res.headersSent) res.destroy();
      else { res.removeHeader('Content-Length'); res.status(502).json({ message: 'Could not load this tutorial video.' }); }
    });
    stream.pipe(res);
  } catch {
    req.log.warn({ tutorialId: tutorial.id }, 'Tutorial media unavailable');
    res.removeHeader('Content-Length');
    res.status(502).json({ message: 'Could not load this tutorial media. Please retry.' });
  }
});
export default router;
