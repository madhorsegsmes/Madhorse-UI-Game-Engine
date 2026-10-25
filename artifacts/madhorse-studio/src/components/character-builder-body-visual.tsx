import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { createCharacterBodyMesh, isCharacterBodySurfacePart } from '@/lib/character-builder-geometry';
import { getPrimitive, getTransform, type SceneEntity } from '@/lib/scene-model';
import { createCharacterSkinRig } from '@/lib/character-skin-rig';
import type { FighterPlayback } from '@/lib/fighter-playback';

const RigContext = createContext<{ rig: ReturnType<typeof createCharacterSkinRig>; rootId: string } | null>(null);

export function FighterPartMotion({ entity, children, disabled = false }: { entity: SceneEntity; children: ReactNode; disabled?: boolean }) {
  const context = useContext(RigContext);
  if (!context || disabled || entity.parentId !== context.rootId) return <>{children}</>;
  return <BoundFighterPart entity={entity} rig={context.rig}>{children}</BoundFighterPart>;
}

function BoundFighterPart({ entity, children, rig }: {
  entity: SceneEntity; children: ReactNode; rig: ReturnType<typeof createCharacterSkinRig>;
}) {
  const group = useRef<THREE.Group>(null);
  const transform = getTransform(entity);
  const index = useMemo(() => rig.nearestBone(new THREE.Vector3(
    (transform.position.x - 50) / 10, (transform.position.z - 50) / 10, (transform.position.y - 50) / 10,
  )), [rig, transform.position.x, transform.position.y, transform.position.z]);
  useFrame(() => {
    if (!group.current) return;
    group.current.matrix.copy(rig.matrices[index]);
    group.current.matrixWorldNeedsUpdate = true;
  });
  return <group ref={group} matrixAutoUpdate={false}>{children}</group>;
}

export function CharacterBuilderBodyVisual({ parts, rootId, pose, children }: {
  parts: SceneEntity[]; rootId: string; pose?: FighterPlayback; children?: ReactNode;
}) {
  // Runtime scene arrays change often. Only authored surface changes rebuild the
  // expensive fused mesh; animation is bone skinning, not remeshing.
  const geometryKey = JSON.stringify(parts.filter(isCharacterBodySurfacePart).map(part => [
    part.id, part.active, getTransform(part),
  ]));
  const body = useMemo(() => createCharacterBodyMesh(parts), [geometryKey]);
  const animated = Boolean(pose);
  const rig = useMemo(() => body && animated ? createCharacterSkinRig(body) : null, [body, animated]);
  const bodyPart = parts.find(isCharacterBodySurfacePart);
  const color = bodyPart ? getPrimitive(bodyPart)?.color ?? '#d5a07d' : '#d5a07d';
  const pores = useMemo(() => {
    const pixels = new Uint8Array(64 * 64 * 4);
    for (let i = 0; i < 64 * 64; i++) {
      const value = 112 + ((i * 167 + (i >> 6) * 53) % 32);
      pixels.set([value, value, value, 255], i * 4);
    }
    const texture = new THREE.DataTexture(pixels, 64, 64);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(9, 9);
    texture.needsUpdate = true;
    return texture;
  }, []);
  const material = useMemo(() => new THREE.MeshStandardMaterial({
    color, roughness: .58, metalness: 0, side: THREE.DoubleSide, bumpMap: pores, bumpScale: .003,
  }), [color, pores]);
  const mesh = useMemo(() => {
    if (!body) return null;
    if (!rig) {
      const result = new THREE.Mesh(body.geometry, material);
      result.position.copy(body.center);
      result.scale.copy(body.halfExtents);
      result.castShadow = result.receiveShadow = true;
      return result;
    }
    const result = new THREE.SkinnedMesh(rig.geometry, material);
    // Palette matrices are local to the character; scene placement stays on its
    // existing parent group rather than being multiplied into skinning twice.
    result.bindMode = 'detached';
    result.bind(rig.skeleton, new THREE.Matrix4());
    result.castShadow = result.receiveShadow = true;
    result.frustumCulled = false;
    return result;
  }, [body, rig, material]);
  const latest = useRef({ pose, received: performance.now() });
  if (latest.current.pose !== pose) latest.current = { pose, received: performance.now() };
  useFrame(() => {
    const current = latest.current;
    rig?.update(current.pose, current.pose
      ? current.pose.time + Math.min(.08, (performance.now() - current.received) / 1000) : 0);
  }, -1);
  const context = useMemo(() => rig ? { rig, rootId } : null, [rig, rootId]);
  useEffect(() => () => body?.geometry.dispose(), [body]);
  useEffect(() => () => rig?.dispose(), [rig]);
  useEffect(() => () => material.dispose(), [material]);
  useEffect(() => () => pores.dispose(), [pores]);
  return <RigContext.Provider value={context}>
    {mesh && <primitive object={mesh} />}
    {children}
  </RigContext.Provider>;
}
