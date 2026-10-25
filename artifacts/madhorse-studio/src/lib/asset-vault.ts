import { withSystemActivity } from './system-activity';

const databaseName = 'madhorse-studio-local-assets';
const databaseVersion = 1;
const storeName = 'project-assets';

type AssetRecord = { key: string; projectId: string; assetId: string; blob: Blob };
const connections = new Map<string, Promise<IDBDatabase>>();

function openVault(name = databaseName, existingOnly = false): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('This browser does not support local asset storage.'));
  }
  const existing = connections.get(name);
  if (existing) return existing;
  const connection = new Promise<IDBDatabase>((resolve, reject) => {
    let settled = false;
    const request = indexedDB.open(name, databaseVersion);
    request.onupgradeneeded = () => {
      if (existingOnly) { request.transaction?.abort(); return; }
      const database = request.result;
      if (!database.objectStoreNames.contains(storeName)) {
        database.createObjectStore(storeName, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => {
      const database = request.result;
      if (settled) { database.close(); return; }
      settled = true;
      const forget = () => { if (connections.get(name) === connection) connections.delete(name); };
      database.onversionchange = () => { forget(); database.close(); };
      database.onclose = forget;
      resolve(database);
    };
    request.onerror = () => { settled = true; reject(request.error ?? new Error('Could not open local asset storage.')); };
    request.onblocked = () => {
      settled = true;
      reject(new Error('Local asset storage is busy in another tab. Close the other Madhorse tab and try again.'));
    };
  });
  connections.set(name, connection);
  void connection.catch(() => { if (connections.get(name) === connection) connections.delete(name); });
  return connection;
}

function recordKey(projectId: string, assetId: string) {
  return `${projectId}:${assetId}`;
}

async function writeAsset(projectId: string, assetId: string, blob: Blob): Promise<void> {
  const database = await openVault();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readwrite');
    transaction.objectStore(storeName).put({
      key: recordKey(projectId, assetId),
      projectId,
      assetId,
      blob,
    } satisfies AssetRecord);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Could not save this asset on this device.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Could not save this asset on this device.'));
  });
}

async function readAsset(projectId: string, assetId: string, name = databaseName): Promise<Blob | null> {
  const database = await openVault(name, name !== databaseName);
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readonly');
    const request = transaction.objectStore(storeName).get(recordKey(projectId, assetId));
    let blob: Blob | null = null;
    request.onsuccess = () => {
      const record = request.result as AssetRecord | undefined;
      blob = record?.blob ?? null;
    };
    transaction.oncomplete = () => resolve(blob);
    transaction.onerror = () => reject(transaction.error ?? new Error('Could not read this asset from this device.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Could not read this asset from this device.'));
  });
}

async function removeAsset(projectId: string, assetId: string): Promise<void> {
  const database = await openVault();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readwrite');
    transaction.objectStore(storeName).delete(recordKey(projectId, assetId));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Could not remove this asset from this device.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Could not remove this asset from this device.'));
  });
}

export function saveLocalAsset(projectId: string, assetId: string, blob: Blob): Promise<void> {
  return withSystemActivity('Saving assets', () => writeAsset(projectId, assetId, blob));
}

export function loadLocalAsset(projectId: string, assetId: string): Promise<Blob | null> {
  return withSystemActivity('Loading assets', async () => {
    const current = await readAsset(projectId, assetId);
    if (current) return current;
    const legacy = await readAsset(projectId, assetId, 'madhorse-engine-local-assets').catch(() => null);
    if (legacy) await writeAsset(projectId, assetId, legacy);
    return legacy;
  });
}

/** Inspect this Studio vault without migrating, copying, decoding or editing an asset. */
export async function inspectLocalAssetFile(projectId: string, assetId: string): Promise<{ size: number } | null> {
  const blob = await readAsset(projectId, assetId);
  return blob ? { size: blob.size } : null;
}

export function deleteLocalAsset(projectId: string, assetId: string): Promise<void> {
  return withSystemActivity('Updating assets', () => removeAsset(projectId, assetId));
}
