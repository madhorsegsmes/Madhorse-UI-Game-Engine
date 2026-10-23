import { useMemo } from 'react';
import * as THREE from 'three';

/**
 * Editor-only camera icon. Faces LOCAL -Z like a Three camera.
 * Never rendered in Canvas / game view and never stored as a project object.
 */
export function CameraModel({ fov = 50, selected = false, primary = false, active = true }: {
  fov?: number; selected?: boolean; primary?: boolean; active?: boolean;
}) {
  const body = selected ? '#d8473c' : primary ? '#c9ccd0' : '#9ea3a8';
  const trim = selected ? '#f2c9c2' : '#2a2c2f';
  const frustum = useMemo(() => {
    const depth = 2.4;
    const half = Math.tan(THREE.MathUtils.degToRad(fov) / 2) * depth;
    const w = half * (16 / 9);
    const near = 0.42;
    const corners: [number, number, number][] = [[-w, half, -depth], [w, half, -depth], [w, -half, -depth], [-w, -half, -depth]];
    const pts: number[] = [];
    corners.forEach((corner, i) => {
      pts.push(0, 0, -near, ...corner);
      const next = corners[(i + 1) % 4];
      pts.push(...corner, ...next);
    });
    // "up" tick so roll is readable
    pts.push(-w * 0.3, half, -depth, 0, half * 1.3, -depth, 0, half * 1.3, -depth, w * 0.3, half, -depth);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return geometry;
  }, [fov]);
  const opacity = active ? 1 : 0.4;
  return (
    <group>
      <mesh>
        <boxGeometry args={[0.5, 0.36, 0.62]} />
        <meshStandardMaterial color={body} roughness={0.42} metalness={0.55} transparent={!active} opacity={opacity} />
      </mesh>
      {/* film reels */}
      <mesh position={[0, 0.3, 0.12]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.15, 0.15, 0.1, 16]} />
        <meshStandardMaterial color={trim} roughness={0.5} metalness={0.4} />
      </mesh>
      <mesh position={[0, 0.27, -0.14]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.11, 0.11, 0.1, 16]} />
        <meshStandardMaterial color={trim} roughness={0.5} metalness={0.4} />
      </mesh>
      {/* lens barrel toward -Z */}
      <mesh position={[0, 0, -0.42]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.14, 0.1, 0.24, 18]} />
        <meshStandardMaterial color="#1c1d1f" roughness={0.3} metalness={0.7} />
      </mesh>
      <mesh position={[0, 0, -0.545]}>
        <circleGeometry args={[0.12, 18]} />
        <meshBasicMaterial color={selected ? '#ff7a6c' : '#6f8fb0'} side={THREE.DoubleSide} />
      </mesh>
      <lineSegments geometry={frustum}>
        <lineBasicMaterial color={selected ? '#e85a4e' : primary ? '#d8d2c6' : '#a8a39b'} transparent opacity={selected ? 0.95 : 0.55} depthWrite={false} />
      </lineSegments>
      {/* hit target slightly larger than the body for touch selection */}
      <mesh visible={false}>
        <boxGeometry args={[0.9, 0.9, 1.2]} />
      </mesh>
    </group>
  );
}
