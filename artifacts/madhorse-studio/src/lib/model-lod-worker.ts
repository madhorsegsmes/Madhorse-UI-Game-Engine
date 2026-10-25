import { simplifyModelLod, type ModelLodInput } from './model-lod-simplify';
self.onmessage = async (event: MessageEvent<ModelLodInput>) => {
  try {
    const levels = await simplifyModelLod(event.data);
    self.postMessage({ levels }, { transfer: levels.map(level => level.buffer as ArrayBuffer) });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'Detail generation failed.' });
  }
};
