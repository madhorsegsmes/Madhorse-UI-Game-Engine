import { Zip, ZipPassThrough, strToU8 } from 'fflate';
import { loadLocalAsset } from './asset-vault';
import type { FreshWorkspaceSnapshot } from './fresh-workspace-storage';
import { studioProjectStorageKey } from './studio-projects';

export type ProjectFilePayload = {
  format: 'madhorse-project';
  schemaVersion: 1;
  projectName: string;
  savedAt: string;
  snapshot: unknown;
  visionBoardStorage: Record<string, string | null>;
  files: Array<{ scope: 'asset' | 'vision-board'; id: string; path: string; mimeType: string; size: number }>;
};

export type ProjectFileAttachment = {
  scope: 'asset' | 'vision-board';
  id: string;
  path: string;
  mimeType: string;
  blob: Blob;
};

export async function buildProjectFile(
  payload: Omit<ProjectFilePayload, 'files'>,
  attachments: ProjectFileAttachment[],
  onProgress?: (message: string) => void,
): Promise<Blob> {
  const files = attachments.map(({ scope, id, path, mimeType, blob }) => ({
    scope, id, path, mimeType, size: blob.size,
  }));
  const projectJson: ProjectFilePayload = { ...payload, files };
  return new Promise((resolve, reject) => {
    const output: BlobPart[] = [];
    let finished = false;
    const fail = (error: unknown) => {
      if (finished) return;
      finished = true;
      zip.terminate();
      reject(error instanceof Error ? error : new Error('Could not package the project file.'));
    };
    const zip = new Zip((error, chunk, final) => {
      if (error) { fail(error); return; }
      if (chunk) output.push(chunk);
      if (final && !finished) {
        finished = true;
        resolve(new Blob(output, { type: 'application/zip' }));
      }
    });

    const addBytes = (path: string, bytes: Uint8Array) => {
      const file = new ZipPassThrough(path);
      zip.add(file);
      file.push(bytes, true);
    };

    void (async () => {
      try {
        addBytes('project.json', strToU8(JSON.stringify(projectJson, null, 2)));
        for (const [index, attachment] of attachments.entries()) {
          onProgress?.(`Adding ${attachment.path.split('/').at(-1)} (${index + 1} of ${attachments.length})…`);
          const file = new ZipPassThrough(attachment.path);
          zip.add(file);
          if (typeof attachment.blob.stream === 'function') {
            const reader = attachment.blob.stream().getReader();
            try {
              while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                file.push(value);
              }
            } finally {
              reader.releaseLock();
            }
            file.push(new Uint8Array(0), true);
          } else {
            file.push(new Uint8Array(await attachment.blob.arrayBuffer()), true);
          }
        }
        zip.end();
      } catch (error) {
        fail(error);
      }
    })();
  });
}

export function safeProjectFileName(name: string) {
  const sanitized = name.trim().replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 80);
  return `${sanitized || 'Madhorse-Project'}.madhorse.zip`;
}

const visionBoardStorageEntries = [
  ['panels', 'madhorse.vision-board-panels.v2'],
  ['boards', 'madhorse.vision-boards.v1'],
  ['active-board', 'madhorse.vision-active-board.v1'],
  ['legacy-panel', 'madhorse.vision-board-panel.v1'],
] as const;

function visionBoardMediaReferences(storage: Record<string, string | null>) {
  const references = new Map<string, string>();
  let visited = 0;
  for (const raw of Object.values(storage)) {
    if (!raw) continue;
    let root: unknown;
    try { root = JSON.parse(raw); }
    catch { throw new Error('Saved Vision Board data could not be read. The project file was not downloaded.'); }
    const pending: unknown[] = [root];
    while (pending.length) {
      const value = pending.pop();
      if (!value || typeof value !== 'object') continue;
      if (++visited > 100_000) throw new Error('Vision Board data is too large to safely package.');
      if (Array.isArray(value)) { pending.push(...value); continue; }
      const entry = value as Record<string, unknown>;
      if (typeof entry.mediaId === 'string' && /^[\w-]{1,160}$/.test(entry.mediaId) && !references.has(entry.mediaId)) {
        references.set(entry.mediaId, typeof entry.mediaName === 'string' ? entry.mediaName : typeof entry.name === 'string' ? entry.name : 'attachment');
      }
      pending.push(...Object.values(entry).filter(child => child && typeof child === 'object'));
    }
  }
  if (references.size > 1_000) throw new Error('This Vision Board has too many media files to safely package in one project file.');
  return [...references].map(([id, name]) => ({ id, name }));
}

function safeEntryName(value: string) {
  const leaf = value.replace(/\\/g, '/').split('/').pop() ?? '';
  const cleaned = leaf.replace(/[^a-z0-9._ -]/gi, '_').replace(/^\.+/, '').slice(0, 120);
  return cleaned || 'asset.bin';
}

function readVisionBoardMedia(references: Array<{ id: string; name: string }>) {
  return new Promise<Array<{ id: string; name: string; blob: Blob }>>((resolve, reject) => {
    if (!references.length) { resolve([]); return; }
    if (typeof indexedDB === 'undefined') { reject(new Error('This browser cannot read saved Vision Board media.')); return; }
    const request = indexedDB.open('madhorse-vision-board-media-v1', 1);
    request.onupgradeneeded = () => { request.transaction?.abort(); };
    request.onerror = () => reject(new Error('Could not access the saved Vision Board media. The project file was not downloaded.'));
    request.onblocked = () => reject(new Error('Vision Board media storage is busy in another tab. Close the other Studio tab and try again.'));
    request.onsuccess = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains('media')) {
        database.close();
        reject(new Error('Vision Board media storage is missing. The project file was not downloaded.'));
        return;
      }
      const transaction = database.transaction('media', 'readonly');
      const store = transaction.objectStore('media');
      const loaded: Array<{ id: string; name: string; blob: Blob }> = [];
      let missing: string | null = null;
      for (const reference of references) {
        const mediaRequest = store.get(reference.id);
        mediaRequest.onsuccess = () => {
          if (mediaRequest.result instanceof Blob) loaded.push({ ...reference, blob: mediaRequest.result });
          else missing = reference.name;
        };
        mediaRequest.onerror = () => { missing = reference.name; };
      }
      transaction.oncomplete = () => {
        database.close();
        if (missing) reject(new Error(`Vision Board file “${missing}” is missing on this device. No project file was downloaded.`));
        else resolve(loaded);
      };
      transaction.onerror = () => { database.close(); reject(new Error('Could not read saved Vision Board files. The project file was not downloaded.')); };
      transaction.onabort = () => { database.close(); reject(new Error('Reading Vision Board files was interrupted. The project file was not downloaded.')); };
    };
  });
}

export async function exportStudioProject(
  projectId: string,
  projectName: string,
  snapshot: Partial<FreshWorkspaceSnapshot>,
  onProgress?: (message: string) => void,
) {
  onProgress?.('Preparing the saved project…');
  if (!snapshot.entities || !snapshot.camera) throw new Error('Project data is not saved yet. Wait a moment and try Save again.');
  const attachments: ProjectFileAttachment[] = [];
  const assets = snapshot.assets ?? [];
  for (const [index, asset] of assets.entries()) {
    if (asset.kind === 'data') continue; // Scriptable Object data is already stored in the project snapshot.
    onProgress?.(`Reading ${asset.name} (${index + 1} of ${assets.length})…`);
    const blob = await loadLocalAsset(projectId, asset.id);
    if (!blob) throw new Error(`Imported asset “${asset.name}” is missing on this device. No incomplete project file was downloaded.`);
    attachments.push({
      scope: 'asset', id: asset.id,
      path: `assets/${String(index + 1).padStart(4, '0')}-${safeEntryName(asset.name)}`,
      mimeType: asset.mimeType || blob.type || 'application/octet-stream', blob,
    });
  }

  const visionBoardStorage = Object.fromEntries(visionBoardStorageEntries.map(([key, storageKey]) => [
    key, localStorage.getItem(studioProjectStorageKey(storageKey, projectId)),
  ]));
  const boardMedia = await readVisionBoardMedia(visionBoardMediaReferences(visionBoardStorage));
  for (const [index, item] of boardMedia.entries()) {
    attachments.push({
      scope: 'vision-board', id: item.id,
      path: `vision-board/media/${String(index + 1).padStart(4, '0')}-${safeEntryName(item.name)}`,
      mimeType: item.blob.type || 'application/octet-stream', blob: item.blob,
    });
  }
  const blob = await buildProjectFile({
    format: 'madhorse-project',
    schemaVersion: 1,
    projectName,
    savedAt: new Date().toISOString(),
    snapshot,
    visionBoardStorage,
  }, attachments, onProgress);
  return { blob, fileName: safeProjectFileName(projectName), attachmentCount: attachments.length };
}
