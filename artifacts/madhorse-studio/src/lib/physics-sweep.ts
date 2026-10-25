import type { Vector3 } from './scene-model';

type Axis = keyof Vector3;
export type BoxSweepHit = { time: number; axis: Axis; normal: -1 | 1 };

/** Linear AABB time of impact. Existing penetrations remain the discrete solver's job. */
export function sweepBox(
  start: Vector3,
  movement: Vector3,
  halfSize: Vector3,
  target: Vector3,
  targetHalfSize: Vector3,
  axes: readonly Axis[],
): BoxSweepHit | null {
  let enter = -Infinity;
  let exit = Infinity;
  let hitAxis: Axis | null = null;
  let normal: -1 | 1 = -1;
  for (const axis of axes) {
    const minimum = target[axis] - targetHalfSize[axis] - halfSize[axis];
    const maximum = target[axis] + targetHalfSize[axis] + halfSize[axis];
    const delta = movement[axis];
    if (Math.abs(delta) < 1e-12) {
      // Parallel movement on an outside face is a graze, not penetration.
      if (start[axis] <= minimum || start[axis] >= maximum) return null;
      continue;
    }
    const first = (minimum - start[axis]) / delta;
    const second = (maximum - start[axis]) / delta;
    const near = Math.min(first, second);
    if (near > enter) {
      enter = near;
      hitAxis = axis;
      normal = delta > 0 ? -1 : 1;
    }
    exit = Math.min(exit, Math.max(first, second));
    if (exit <= Math.max(enter, 0)) return null;
  }
  if (!hitAxis || enter < 0 || enter > 1) return null;
  return { time: enter, axis: hitAxis, normal };
}
