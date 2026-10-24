import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { createCharacterBodyMesh } from '@/lib/character-builder-geometry';
import type { SceneEntity } from '@/lib/scene-model';

export function CharacterBuilderBodyVisual({ parts }: { parts: SceneEntity[] }) {
  const body = useMemo(() => createCharacterBodyMesh(parts), [parts]);

  useEffect(() => () => body?.geometry.dispose(), [body]);

  if (!body) return null;
  return (
    <group
      position={[body.center.x, body.center.y, body.center.z]}
      scale={[body.halfExtents.x, body.halfExtents.y, body.halfExtents.z]}
    >
      <mesh geometry={body.geometry} castShadow receiveShadow>
        <meshStandardMaterial color="#d5a07d" roughness={0.68} metalness={0} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}
