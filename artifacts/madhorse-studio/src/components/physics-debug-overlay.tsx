import { useEffect, useLayoutEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { SceneEntity } from '@/lib/scene-model';
import { collectPhysicsDebugBoxes, MAX_PHYSICS_DEBUG_BOXES, writePhysicsBoxLines, type PhysicsDebugSettings } from '@/lib/physics-debug-shapes';

const noRaycast = () => {};
export function PhysicsDebugOverlay({ entities, selectedId, settings, editorView, onReport }: {
  entities: SceneEntity[]; selectedId: string | null; settings: PhysicsDebugSettings; editorView: boolean;
  onReport: (report: { count: number; total: number }) => void;
}) {
  const invalidate = useThree(state => state.invalidate);
  const report = useMemo(() => collectPhysicsDebugBoxes(entities, selectedId, settings.selectedOnly, editorView),
    [entities, selectedId, settings.selectedOnly, editorView]);
  const geometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    for (const name of ['position', 'color']) geometry.setAttribute(name,
      new THREE.BufferAttribute(new Float32Array(MAX_PHYSICS_DEBUG_BOXES * 72), 3).setUsage(THREE.DynamicDrawUsage));
    return geometry;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useLayoutEffect(() => {
    const positions = geometry.getAttribute('position') as THREE.BufferAttribute;
    const colors = geometry.getAttribute('color') as THREE.BufferAttribute;
    geometry.setDrawRange(0, writePhysicsBoxLines(report.boxes, positions.array as Float32Array, colors.array as Float32Array));
    positions.needsUpdate = colors.needsUpdate = true;
    invalidate();
  }, [geometry, report, invalidate]);
  useEffect(() => { onReport({ count: report.boxes.length, total: report.total }); }, [onReport, report.boxes.length, report.total]);
  return <lineSegments geometry={geometry} frustumCulled={false} raycast={noRaycast} renderOrder={900}>
    <lineBasicMaterial vertexColors transparent opacity={.9} depthWrite={false} depthTest={!settings.seeThrough} toneMapped={false} />
  </lineSegments>;
}
