import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { Object3D } from 'three';
import { ModelLodController } from '@/lib/model-lod-controller';
import type { ModelLodSettings } from '@/lib/model-lod-settings';
export function useModelLod(root: Object3D | null, id: string, assetId: string, settings: ModelLodSettings | undefined, forceFull: boolean) {
  const controller = useRef<ModelLodController | null>(null);
  const invalidate = useThree(state => state.invalidate);
  useEffect(() => {
    if (!root || !settings?.enabled) return;
    const active = new ModelLodController(root, id, assetId);
    controller.current = active;
    void active.prepare().catch(error => active.fail(error)).finally(() => invalidate());
    return () => { controller.current = null; active.dispose(); invalidate(); };
  }, [root, id, assetId, settings?.enabled, invalidate]);
  useFrame(({ camera }) => {
    if (settings?.enabled) controller.current?.update(camera, settings, forceFull);
  });
}
