import type { Vector3 } from './scene-model';

type Body = {
  position: Vector3; halfSize: Vector3; inverseMass: number;
  physics: { colliderEnabled: boolean };
};

/** Spatial hash with a bounded cell budget and a separate oversized-body list. */
export function physicsContactPairs(bodies: readonly Body[], dimension: '2d' | '3d') {
  const axes = dimension === '2d' ? ['x', 'y'] as const : ['x', 'y', 'z'] as const;
  const cells = new Map<string, number[]>();
  const coverage = new Map<number, string[]>();
  const oversized: number[] = [];
  const colliders = bodies.map((body, index) => ({ body, index })).filter(({body}) => body.physics.colliderEnabled);
  for (const { body, index } of colliders) {
    const ranges = axes.map(axis => ({
      min: Math.floor((body.position[axis] - body.halfSize[axis]) / 64),
      max: Math.floor((body.position[axis] + body.halfSize[axis]) / 64),
    }));
    const size = ranges.reduce((total, range) => total * (range.max - range.min + 1), 1);
    if (!Number.isFinite(size) || size > 64) { oversized.push(index); continue; }
    const keys: string[] = [];
    for (let x = ranges[0].min; x <= ranges[0].max; x++) {
      for (let y = ranges[1].min; y <= ranges[1].max; y++) {
        const minZ = dimension === '3d' ? ranges[2].min : 0;
        const maxZ = dimension === '3d' ? ranges[2].max : 0;
        for (let z = minZ; z <= maxZ; z++) {
          const key = `${x},${y},${z}`;
          keys.push(key);
          const bucket = cells.get(key);
          if (bucket) bucket.push(index); else cells.set(key, [index]);
        }
      }
    }
    coverage.set(index, keys);
  }
  const seen = new Set<number>();
  const pairs: [number, number][] = [];
  function include(left: number, right: number) {
    if (left === right) return;
    const a = Math.min(left, right), b = Math.max(left, right);
    const key = a * bodies.length + b;
    if (seen.has(key)) return;
    seen.add(key);
    if (axes.every(axis => Math.abs(bodies[a].position[axis] - bodies[b].position[axis]) <
      bodies[a].halfSize[axis] + bodies[b].halfSize[axis])) pairs.push([a, b]);
  }
  for (const { body, index } of colliders) {
    if (body.inverseMass <= 0) continue;
    const keys = coverage.get(index);
    if (!keys) {
      for (const other of colliders) include(index, other.index);
    } else {
      for (const key of keys) for (const other of cells.get(key)!) include(index, other);
      for (const other of oversized) include(index, other);
    }
  }
  // Stable contact order avoids changing behavior with hash insertion order.
  return pairs.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}
