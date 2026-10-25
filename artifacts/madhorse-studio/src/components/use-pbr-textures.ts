import { useEffect, useState } from 'react';
import type { Texture } from 'three';
import type { PbrMaterialDefinition, PbrMapSlot } from '@/lib/pbr-material';
import { sceneLinearTextureCache, sceneTextureCache } from '@/lib/scene-texture-cache';

type TextureMapSet = Partial<Record<PbrMapSlot, Texture>>;

export function usePbrTextures(
  material: PbrMaterialDefinition | undefined,
  assetUrls: Record<string, string>,
  anisotropy: number,
): TextureMapSet {
  const [textures, setTextures] = useState<TextureMapSet>({});
  const maps = material?.maps;

  useEffect(() => {
    setTextures({});
    if (!maps) return;
    const loaded: TextureMapSet = {};
    const releases = (Object.entries(maps) as [PbrMapSlot, string | null][])
      .flatMap(([slot, assetId]) => {
        const url = assetId ? assetUrls[assetId] : undefined;
        if (!url) return [];
        const cache = slot === 'baseColor' || slot === 'emissive'
          ? sceneTextureCache : sceneLinearTextureCache;
        return [cache.acquire(url, anisotropy, {
          ready: texture => {
            loaded[slot] = texture;
            setTextures({ ...loaded });
          },
          failed: () => {
            delete loaded[slot];
            setTextures({ ...loaded });
          },
        })];
      });
    return () => releases.forEach(release => release());
  }, [
    anisotropy,
    assetUrls,
    maps?.baseColor,
    maps?.normal,
    maps?.roughness,
    maps?.metalness,
    maps?.ambientOcclusion,
    maps?.emissive,
  ]);

  return textures;
}
