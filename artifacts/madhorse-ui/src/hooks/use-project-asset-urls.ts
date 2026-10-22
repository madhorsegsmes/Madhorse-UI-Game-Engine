import { useEffect, useState } from 'react';
import { loadLocalAsset } from '@/lib/asset-vault';
import type { ProjectAsset } from '@/lib/scene-model';

export function useProjectAssetUrls(
  projectId: string,
  assets: ProjectAsset[],
  onStatus: (message: string) => void,
): Record<string, string> {
  const [assetUrls, setAssetUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let disposed = false;
    const objectUrls: string[] = [];
    setAssetUrls({});

    async function loadImages() {
      const imageAssets = assets.filter((asset) => asset.kind === 'image');
      const results = await Promise.all(imageAssets.map(async (asset) => {
        try {
          const blob = await loadLocalAsset(projectId, asset.id);
          return { asset, blob, error: '' };
        } catch {
          return { asset, blob: null, error: asset.name };
        }
      }));
      if (disposed) return;

      const urls: Record<string, string> = {};
      const missing: string[] = [];
      for (const { asset, blob, error } of results) {
        if (error || !blob) {
          missing.push(asset.name);
          continue;
        }
        const url = URL.createObjectURL(blob);
        objectUrls.push(url);
        urls[asset.id] = url;
      }
      setAssetUrls(urls);
      onStatus(missing.length ? `Could not read local asset${missing.length === 1 ? '' : 's'}: ${missing.join(', ')}` : '');
    }

    void loadImages();
    return () => {
      disposed = true;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [projectId, assets, onStatus]);

  return assetUrls;
}
