import type { Vector3 } from './scene-model';

/** Shared AABB half-extents. Rotation does not rotate the current box solver. */
export function physicsBoxHalfSize(size: Vector3, scale: Vector3): Vector3 {
  return {
    x: size.x * Math.abs(scale.x) / 2,
    y: size.y * Math.abs(scale.y) / 2,
    z: size.z * Math.abs(scale.z) / 2,
  };
}
