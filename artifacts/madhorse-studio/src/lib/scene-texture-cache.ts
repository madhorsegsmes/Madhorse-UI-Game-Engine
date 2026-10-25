import { LinearFilter, LinearMipmapLinearFilter, NoColorSpace, SRGBColorSpace, Texture, TextureLoader, type ColorSpace } from 'three';

type Listener = { ready: (texture: Texture) => void; failed: () => void };
type LoadTexture = (url: string, ready: (texture: Texture) => void, failed: () => void) => void;

/** Shared color maps; a material releases its lease, not another material's texture. */
export function createSceneTextureCache(load: LoadTexture, colorSpace: ColorSpace = SRGBColorSpace) {
  const entries = new Map<string, { texture: Texture | null; listeners: Set<Listener>; failed: boolean }>();
  return {
    acquire(url: string, anisotropy: number, listener: Listener) {
      const level = Number.isFinite(anisotropy) ? Math.max(1, Math.min(16, anisotropy)) : 1;
      const key = `${level}:${url}`;
      let entry = entries.get(key);
      const fresh = !entry;
      if (!entry) {
        entry = { texture: null, listeners: new Set(), failed: false };
        entries.set(key, entry);
      }
      const lease = entry;
      lease.listeners.add(listener);
      if (lease.texture) queueMicrotask(() => {
        if (lease.listeners.has(listener)) listener.ready(lease.texture!);
      });
      else if (fresh) {
        try {
          load(url, texture => {
            if (lease.failed || entries.get(key) !== lease || !lease.listeners.size) { texture.dispose(); return; }
            texture.colorSpace = colorSpace;
            texture.anisotropy = level;
            texture.minFilter = LinearMipmapLinearFilter;
            texture.magFilter = LinearFilter;
            texture.generateMipmaps = true;
            texture.needsUpdate = true;
            lease.texture = texture;
            lease.listeners.forEach(item => item.ready(texture));
          }, () => {
            lease.failed = true;
            if (entries.get(key) === lease) entries.delete(key);
            lease.listeners.forEach(item => item.failed());
            lease.listeners.clear();
          });
        } catch {
          lease.failed = true;
          if (entries.get(key) === lease) entries.delete(key);
          lease.listeners.forEach(item => item.failed());
          lease.listeners.clear();
        }
      }
      let released = false;
      return () => {
        if (released) return;
        released = true;
        lease.listeners.delete(listener);
        queueMicrotask(() => {
          if (lease.listeners.size || entries.get(key) !== lease) return;
          entries.delete(key);
          lease.texture?.dispose();
        });
      };
    },
  };
}

const loader = new TextureLoader();
export const sceneTextureCache = createSceneTextureCache((url, ready, failed) =>
  { loader.load(url, ready, undefined, failed); });
export const sceneLinearTextureCache = createSceneTextureCache((url, ready, failed) =>
  { loader.load(url, ready, undefined, failed); }, NoColorSpace);
