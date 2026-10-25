import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { getCamera, getEffect, getLight, getPrimitive, getUICanvas, type SceneEntity, type PrimitiveComponent, type EffectComponent } from '@/lib/scene-model';
import { beginSystemActivity } from '@/lib/system-activity';
import { createPrimitiveGeometry } from '@/lib/scene-view-geometry';
import { CameraModel } from './camera-model';
import { sceneTextureCache } from '@/lib/scene-texture-cache';

export function SceneElementVisual({ entity, gameView, active, assetUrls, onError, selected = false, primary = false }: {
  entity: SceneEntity; gameView: boolean; active: boolean; selected?: boolean; primary?: boolean; assetUrls: Record<string, string>; onError: (message: string) => void;
}) {
  const primitive = getPrimitive(entity);
  const light = getLight(entity);
  const effect = getEffect(entity);
  if (primitive) return primitive.enabled ? <PrimitiveVisual active={active} primitive={primitive} url={primitive.textureAssetId ? assetUrls[primitive.textureAssetId] : undefined} onError={onError} /> : null;
  if (light) return light.enabled ? <>
    {active && (light.kind === 'ambient' ? <ambientLight color={light.color} intensity={light.intensity} />
      : light.kind === 'directional' ? <directionalLight
        color={light.color}
        intensity={light.intensity}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
        shadow-camera-near={0.5}
        shadow-camera-far={80}
        shadow-bias={-0.00012}
        shadow-normalBias={0.025}
      />
      : <pointLight color={light.color} intensity={light.intensity} decay={2} />)}
    {!gameView && <mesh><sphereGeometry args={[.22, 12, 8]} /><meshBasicMaterial color={light.color} wireframe /></mesh>}
  </> : null;
  if (effect?.enabled) return <SceneEffectVisual effect={effect} />;
  if (gameView) return null;
  const camera = getCamera(entity);
  if (camera) return <CameraModel fov={camera.fov} selected={selected} primary={primary} active={active && camera.enabled} />;
  const uiCanvas = getUICanvas(entity);
  if (uiCanvas) {
    const dimensions: [number, number] = uiCanvas.kind === 'bar' ? [3.2, .42]
      : uiCanvas.kind === 'button' ? [1.2, .55]
        : uiCanvas.kind === 'panel' ? [2.4, 1.4] : [3.2, 1.8];
    const color = uiCanvas.kind === 'button' ? '#e89bf2'
      : uiCanvas.kind === 'bar' ? '#cf83e8'
        : uiCanvas.kind === 'panel' ? '#a986e2' : '#72a7ad';
    return <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={dimensions} /><meshBasicMaterial color={color} wireframe side={THREE.DoubleSide} />
    </mesh>;
  }
  return null;
}

function SceneEffectVisual({ effect }: { effect: EffectComponent }) {
  const root = useRef<THREE.Group>(null);
  const style = effect.style ?? 'aura';
  const opacity = Math.min(0.85, 0.2 + effect.intensity * 0.065);

  useFrame(({ clock }) => {
    if (!root.current) return;
    const time = clock.elapsedTime;
    root.current.rotation.y = time * (style === 'portal' ? 0.55 : 0.18);
    const pulse = 1 + Math.sin(time * 1.6) * 0.055;
    root.current.scale.setScalar(pulse);
  });

  if (style === 'mist') {
    return <group ref={root}>
      {Array.from({ length: 7 }, (_, index) => {
        const angle = index * Math.PI * 2 / 7;
        return <mesh key={index} position={[Math.cos(angle) * 0.55, 0.13 + (index % 3) * 0.12, Math.sin(angle) * 0.55]}>
          <sphereGeometry args={[0.3 + (index % 2) * 0.08, 18, 12]} />
          <meshBasicMaterial color={effect.color} transparent opacity={opacity * 0.35} depthWrite={false} />
        </mesh>;
      })}
    </group>;
  }

  if (style === 'motes') {
    return <group ref={root}>
      {Array.from({ length: 12 }, (_, index) => {
        const angle = index * 2.39996;
        const radius = 0.35 + (index % 4) * 0.16;
        const height = ((index * 7) % 11) / 12 - 0.42;
        return <mesh key={index} position={[Math.cos(angle) * radius, height, Math.sin(angle) * radius]}>
          <octahedronGeometry args={[0.055 + (index % 3) * 0.018, 0]} />
          <meshBasicMaterial color={effect.color} transparent opacity={opacity} depthWrite={false} />
        </mesh>;
      })}
    </group>;
  }

  if (style === 'portal') {
    return <group ref={root}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.82, 0.065, 12, 72]} />
        <meshBasicMaterial color={effect.color} transparent opacity={opacity} depthWrite={false} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, Math.PI / 4]}>
        <torusGeometry args={[0.61, 0.027, 8, 64]} />
        <meshBasicMaterial color="#e4f7ff" transparent opacity={opacity * 0.8} depthWrite={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.47, 24, 16]} />
        <meshBasicMaterial color={effect.color} transparent opacity={opacity * 0.14} depthWrite={false} />
      </mesh>
    </group>;
  }

  return <group ref={root}>
    <mesh>
      <sphereGeometry args={[0.4, 24, 16]} />
      <meshBasicMaterial color={effect.color} transparent opacity={opacity * 0.24} depthWrite={false} />
    </mesh>
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[0.74, 0.05, 10, 56]} />
      <meshBasicMaterial color={effect.color} transparent opacity={opacity} depthWrite={false} />
    </mesh>
    <mesh rotation={[0, Math.PI / 3, Math.PI / 2]}>
      <torusGeometry args={[0.54, 0.025, 8, 48]} />
      <meshBasicMaterial color="#f5e9b8" transparent opacity={opacity * 0.75} depthWrite={false} />
    </mesh>
  </group>;
}

function PrimitiveVisual({ primitive, url, onError, active }: { primitive: PrimitiveComponent; url?: string; active: boolean; onError: (message: string) => void }) {
  const renderer = useThree(state => state.gl);
  const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const geometry = useMemo(
    () => createPrimitiveGeometry(primitive.shape, primitive.terrainSettings, primitive.terrainEdits),
    [primitive.shape, primitive.terrainSettings, primitive.terrainEdits],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => {
    setTexture(null);
    if (!url) return;
    const finish = beginSystemActivity('Loading surface texture');
    const release = sceneTextureCache.acquire(url, anisotropy, {
      ready: loaded => {
        finish();
        setTexture(loaded);
      },
      failed: () => {
        finish();
        onError('Could not decode the assigned surface texture.');
      },
    });
    return () => { release(); finish(); };
    // Status callbacks may change with selection; the asset itself has not changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, anisotropy]);
  return <mesh geometry={geometry} castShadow receiveShadow>
    <meshStandardMaterial color={primitive.color} map={texture} roughness={primitive.roughness ?? .58} metalness={primitive.metalness ?? .08} side={THREE.DoubleSide}
      transparent={!active || (primitive.opacity ?? 1) < 1} opacity={active ? primitive.opacity ?? 1 : .35}
      depthWrite={(primitive.opacity ?? 1) >= 1} />
  </mesh>;
}
