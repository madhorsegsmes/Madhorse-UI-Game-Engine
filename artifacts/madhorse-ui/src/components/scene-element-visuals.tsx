import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { getCamera, getLight, getPrimitive, getUICanvas, type SceneEntity, type PrimitiveComponent } from '@/lib/scene-model';
import { beginSystemActivity } from '@/lib/system-activity';
import { createPrimitiveGeometry } from '@/lib/scene-view-geometry';
import { CameraModel } from './camera-model';

export function SceneElementVisual({ entity, gameView, active, assetUrls, onError, selected = false, primary = false }: {
  entity: SceneEntity; gameView: boolean; active: boolean; selected?: boolean; primary?: boolean; assetUrls: Record<string, string>; onError: (message: string) => void;
}) {
  const primitive = getPrimitive(entity);
  const light = getLight(entity);
  if (primitive) return primitive.enabled ? <PrimitiveVisual active={active} primitive={primitive} url={primitive.textureAssetId ? assetUrls[primitive.textureAssetId] : undefined} onError={onError} /> : null;
  if (light) return light.enabled ? <>
    {active && (light.kind === 'ambient' ? <ambientLight color={light.color} intensity={light.intensity} />
      : light.kind === 'directional' ? <directionalLight color={light.color} intensity={light.intensity} />
      : <pointLight color={light.color} intensity={light.intensity} decay={2} />)}
    {!gameView && <mesh><sphereGeometry args={[.22, 12, 8]} /><meshBasicMaterial color={light.color} wireframe /></mesh>}
  </> : null;
  if (gameView) return null;
  const camera = getCamera(entity);
  if (camera) return <CameraModel fov={camera.fov} selected={selected} primary={primary} active={active && camera.enabled} />;
  if (getUICanvas(entity)) return <mesh rotation={[-Math.PI / 2, 0, 0]}>
    <planeGeometry args={[3.2, 1.8]} /><meshBasicMaterial color="#72a7ad" wireframe side={THREE.DoubleSide} />
  </mesh>;
  return null;
}

function PrimitiveVisual({ primitive, url, onError, active }: { primitive: PrimitiveComponent; url?: string; active: boolean; onError: (message: string) => void }) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const geometry = useMemo(() => createPrimitiveGeometry(primitive.shape), [primitive.shape]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => {
    setTexture(null);
    if (!url) return;
    let alive = true;
    let loadedTexture: THREE.Texture | null = null;
    const finish = beginSystemActivity('Loading surface texture');
    try {
      new THREE.TextureLoader().load(url, (loaded) => {
        finish();
        if (!alive) { loaded.dispose(); return; }
        loadedTexture = loaded;
        loaded.colorSpace = THREE.SRGBColorSpace;
        setTexture(loaded);
      }, undefined, () => {
        finish();
        if (alive) onError('Could not decode the assigned surface texture.');
      });
    } catch {
      finish();
      onError('Could not load the assigned surface texture.');
    }
    return () => { alive = false; finish(); loadedTexture?.dispose(); };
    // Status callbacks may change with selection; the asset itself has not changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);
  return <mesh geometry={geometry}>
    <meshStandardMaterial color={primitive.color} map={texture} roughness={.78} side={THREE.DoubleSide}
      transparent={!active || (primitive.opacity ?? 1) < 1} opacity={active ? primitive.opacity ?? 1 : .35}
      depthWrite={(primitive.opacity ?? 1) >= 1} />
  </mesh>;
}
