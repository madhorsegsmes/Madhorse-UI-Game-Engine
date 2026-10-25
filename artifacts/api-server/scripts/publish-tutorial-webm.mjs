import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tutorialStorage } from '../src/lib/tutorial-storage.ts';
const exec = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const manifestPath = resolve(root, 'artifacts/api-server/src/data/template-tutorials.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const bucket = tutorialStorage.bucket(process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID);
for (const item of manifest.tutorials) {
  const base = resolve(root, 'generated-artifacts/template-tutorials', item.id);
  await exec('ffmpeg', ['-y','-v','error','-i',`${base}.mp4`,'-an',
    '-vf','scale=1280:720','-r','24','-c:v','libvpx-vp9','-deadline','realtime',
    '-cpu-used','8','-row-mt','1','-threads','2','-crf','35','-b:v','0',`${base}.webm`],
    { maxBuffer: 1024 * 1024 });
  const probe = JSON.parse((await exec('ffprobe',['-v','error','-show_streams','-show_format','-of','json',`${base}.webm`])).stdout);
  if (probe.streams.length !== 1 || probe.streams[0].codec_name !== 'vp9' ||
      Math.abs(Number(probe.format.duration) - item.durationSeconds) > .2)
    throw new Error(`Invalid silent compatibility video: ${item.id}`);
  item.webmObject = item.videoObject.replace(/\.mp4$/, '-vp9-720p-v1.webm');
  try {
    await bucket.upload(`${base}.webm`, { destination: item.webmObject, resumable: false,
      metadata: { contentType: 'video/webm', cacheControl: 'public, max-age=31536000, immutable' } });
  } catch (error) {
    throw new Error(String(error.message).includes('suspended') ? 'App Storage service suspended.' :
      `Compatibility upload failed for ${item.id}; status ${Number(error.code) || 'unknown'}.`);
  }
  console.log(`Ready: ${item.id}, silent VP9 WebM fallback.`);
}
manifest.revision += '-webm1';
await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log('All ten compatibility videos uploaded and manifest updated.');
