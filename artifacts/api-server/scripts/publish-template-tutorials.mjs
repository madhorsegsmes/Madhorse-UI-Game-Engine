import { readFile, writeFile, stat } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tutorialStorage } from '../src/lib/tutorial-storage.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const output = resolve(root, 'generated-artifacts/template-tutorials');
const expected = ['2d-fighting','rts','fps','third-person-shooter','mmorpg','2d-rpg','cart-racer','card-duel','basketball','blank'];
const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
if (!bucketId) throw new Error('App Storage must be configured before publishing tutorial media.');
const source = JSON.parse(await readFile(resolve(output, 'manifest.json'), 'utf8'));
const entries = Array.isArray(source) ? source : source.tutorials ?? source.videos;
if (!Array.isArray(entries) || entries.length !== 10) throw new Error('Expected ten authored tutorial videos.');
const exec = promisify(execFile);
const bucket = tutorialStorage.bucket(bucketId);
const tutorials = [];
// Validate every deliverable before publishing any media.
const validated = [];
for (const id of expected) {
  const item = entries.find(value => (value.id ?? value.slug) === id);
  if (!item || typeof item.title !== 'string') throw new Error(`Missing tutorial metadata: ${id}`);
  const videoPath = resolve(output, `${id}.mp4`), posterPath = resolve(output, `${id}.jpg`);
  const info = JSON.parse((await exec('ffprobe', ['-v','error','-show_streams','-show_format','-of','json',videoPath])).stdout);
  const streams = info.streams ?? [], video = streams.find(stream => stream.codec_type === 'video');
  if (!video || video.codec_name !== 'h264' || streams.some(stream => stream.codec_type === 'audio'))
    throw new Error(`Tutorial must be a real, silent H.264 MP4: ${id}`);
  const duration = Number(info.format.duration);
  if (duration < 20 || duration > 120 || video.width < 1280 || video.height < 720)
    throw new Error(`Tutorial duration or resolution is invalid: ${id}`);
  if ((await stat(posterPath)).size < 500) throw new Error(`Missing tutorial poster: ${id}`);
  const bytes = await readFile(videoPath);
  const hash = createHash('sha256').update(bytes).digest('hex').slice(0,16);
  const base = `madhorse-tutorials/${hash}/${id}`;
  const chapters = (item.chapters ?? []).map(chapter => ({
    title: chapter.title, seconds: Number(chapter.seconds ?? chapter.startSeconds ?? chapter.start),
  }));
  if (chapters.some(chapter => typeof chapter.title !== 'string' || !Number.isFinite(chapter.seconds) || chapter.seconds < 0 || chapter.seconds >= duration))
    throw new Error(`Invalid chapter timestamp: ${id}`);
  validated.push({ id, item, duration, chapters, videoPath, posterPath, base, bytes: bytes.length });
}
for (const value of validated) {
  const { id, item, duration, chapters, videoPath, posterPath, base, bytes } = value;
  try {
    await bucket.upload(videoPath, { destination: `${base}.mp4`, resumable: false,
      metadata: { contentType: 'video/mp4', cacheControl: 'public, max-age=31536000, immutable' } });
    await bucket.upload(posterPath, { destination: `${base}.jpg`, resumable: false,
      metadata: { contentType: 'image/jpeg', cacheControl: 'public, max-age=31536000, immutable' } });
  } catch (error) {
    // Avoid logging SDK request objects, credentials or storage configuration.
    if (String(error.message).includes('suspended')) throw new Error('App Storage service suspended.');
    throw new Error(`Could not publish ${id}; storage status ${Number(error.code) || 'unknown'}.`);
  }
  tutorials.push({ id, title: item.title, description: item.description ?? 'A silent animated guide to starting, playing, editing and saving this Madhorse template.',
    durationSeconds: duration, chapters, videoObject: `${base}.mp4`, posterObject: `${base}.jpg`, bytes });
  console.log(`Published ${id}: ${duration.toFixed(1)}s, ${(bytes / 1048576).toFixed(2)} MB, no audio stream.`);
}
await writeFile(resolve(root, 'artifacts/api-server/src/data/template-tutorials.json'),
  JSON.stringify({ revision: createHash('sha256').update(JSON.stringify(tutorials)).digest('hex').slice(0,16), tutorials }, null, 2) + '\n');
console.log('Tutorial library manifest published: all ten videos and posters.');
