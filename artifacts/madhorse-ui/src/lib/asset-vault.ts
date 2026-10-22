import { withSystemActivity } from './system-activity';

const databaseName = 'madhorse-engine-local-assets';
const databaseVersion = 1;
const storeName = 'project-assets';

type AssetRecord = { key: string; projectId: string; assetId: string; blob: Blob };

function openVault(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('This browser does not support local asset storage.'));
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, databaseVersion);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(storeName)) {
        database.createObjectStore(storeName, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open local asset storage.'));
    request.onblocked = () => reject(new Error('Local asset storage is busy in another tab. Close the other Madhorse tab and try again.'));
  });
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
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => { database.close(); reject(transaction.error ?? new Error('Could not save this asset on this device.')); };
    transaction.onabort = () => { database.close(); reject(transaction.error ?? new Error('Could not save this asset on this device.')); };
  });
}

async function readAsset(projectId: string, assetId: string): Promise<Blob | null> {
  const database = await openVault();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readonly');
    const request = transaction.objectStore(storeName).get(recordKey(projectId, assetId));
    let blob: Blob | null = null;
    request.onsuccess = () => {
      const record = request.result as AssetRecord | undefined;
      blob = record?.blob ?? null;
    };
    transaction.oncomplete = () => { database.close(); resolve(blob); };
    transaction.onerror = () => { database.close(); reject(transaction.error ?? new Error('Could not read this asset from this device.')); };
    transaction.onabort = () => { database.close(); reject(transaction.error ?? new Error('Could not read this asset from this device.')); };
  });
}

async function removeAsset(projectId: string, assetId: string): Promise<void> {
  const database = await openVault();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readwrite');
    transaction.objectStore(storeName).delete(recordKey(projectId, assetId));
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => { database.close(); reject(transaction.error ?? new Error('Could not remove this asset from this device.')); };
    transaction.onabort = () => { database.close(); reject(transaction.error ?? new Error('Could not remove this asset from this device.')); };
  });
}

export function saveLocalAsset(projectId: string, assetId: string, blob: Blob): Promise<void> {
  return withSystemActivity('Saving assets', () => writeAsset(projectId, assetId, blob));
}

export function loadLocalAsset(projectId: string, assetId: string): Promise<Blob | null> {
  return withSystemActivity('Loading assets', () => readAsset(projectId, assetId));
}

export function deleteLocalAsset(projectId: string, assetId: string): Promise<void> {
  return withSystemActivity('Updating assets', () => removeAsset(projectId, assetId));
}
