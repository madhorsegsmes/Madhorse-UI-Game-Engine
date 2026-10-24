import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { createCharacterBodyMesh, isCharacterBodySurfacePart } from '@/lib/character-builder-geometry';
import { getPrimitive, type SceneEntity } from '@/lib/scene-model';

export function CharacterBuilderBodyVisual({ parts }: { parts: SceneEntity[] }) {
  const body = useMemo(() => createCharacterBodyMesh(parts), [parts]);
  const bodyPart = parts.find(isCharacterBodySurfacePart);
  const color = bodyPart ? getPrimitive(bodyPart)?.color ?? '#d5a07d' : '#d5a07d';

  useEffect(() => () => body?.geometry.dispose(), [body]);

  if (!body) return null;
  return (
    <group
      position={[body.center.x, body.center.y, body.center.z]}
      scale={[body.halfExtents.x, body.halfExtents.y, body.halfExtents.z]}
    >
      <mesh geometry={body.geometry} castShadow receiveShadow>
        <meshStandardMaterial color={color} roughness={0.68} metalness={0} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}
