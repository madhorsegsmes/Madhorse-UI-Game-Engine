import { useEffect, useState } from 'react';
import { loadLocalAsset } from '@/lib/asset-vault';
import type { ProjectAsset } from '@/lib/scene-model';
import { publishDiagnostic } from '@/lib/system-diagnostics';

export function useProjectAssetUrls(
  projectId: string,
  assets: ProjectAsset[],
  referencedAssetIds: string[],
  onStatus: (message: string) => void,
): Record<string, string> {
  const [assetUrls, setAssetUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let disposed = false;
    const objectUrls: string[] = [];
    setAssetUrls({});

    async function loadProjectAssets() {
      const referenced = new Set(referencedAssetIds);
      const visibleAssets = assets.filter((asset) =>
        asset.kind === 'image' || referenced.has(asset.id),
      );
      const results = await Promise.all(visibleAssets.map(async (asset) => {
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
          publishDiagnostic('assets', 'error', `Could not read local asset: ${asset.name}`);
          continue;
        }
        const url = URL.createObjectURL(blob);
        objectUrls.push(url);
        urls[asset.id] = url;
      }
      setAssetUrls(urls);
      onStatus(missing.length ? `Could not read local asset${missing.length === 1 ? '' : 's'}: ${missing.join(', ')}` : '');
    }

    void loadProjectAssets();
    return () => {
      disposed = true;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [projectId, assets, referencedAssetIds, onStatus]);

  return assetUrls;
}
