/** Fixed resolution and local-space limits keep projects and generated geometry bounded. */
export const TERRAIN_SEGMENTS = 32;
export const TERRAIN_SIZE = 20;
export const TERRAIN_HEIGHT_LIMIT = 8;
const SIDE = TERRAIN_SEGMENTS + 1;
export type TerrainHeightfield = { version: 1; heights: number[] };
export type TerrainBrush = 'raise' | 'lower' | 'smooth';

export function isTerrainHeightfield(value: unknown): value is TerrainHeightfield {
  if (!value || typeof value !== 'object') return false;
  const field = value as TerrainHeightfield;
  if (field.version !== 1 || !Array.isArray(field.heights) || field.heights.length !== SIDE * SIDE) return false;
  for (const height of field.heights) {
    if (typeof height !== 'number' || !Number.isFinite(height) || Math.abs(height) > TERRAIN_HEIGHT_LIMIT) return false;
  }
  return true;
}

export function createTerrainHeightfield(): TerrainHeightfield {
  return { version: 1, heights: Array.from({ length: SIDE * SIDE }, (_, index) => {
    const x = (index % SIDE) / TERRAIN_SEGMENTS * TERRAIN_SIZE - TERRAIN_SIZE / 2;
    const z = Math.floor(index / SIDE) / TERRAIN_SEGMENTS * TERRAIN_SIZE - TERRAIN_SIZE / 2;
    return Math.sin(x * .45) * Math.cos(z * .4) * .65 - .05;
  }) };
}

/** Immutable single dab; smoothing reads only the previous field, never its own writes. */
export function sculptTerrain(field: TerrainHeightfield, brush: {
  x: number; z: number; radius: number; strength: number; mode: TerrainBrush;
}): TerrainHeightfield {
  if (!isTerrainHeightfield(field)) throw new Error('Invalid terrain heightfield.');
  if (![brush.x, brush.z, brush.radius, brush.strength].every(Number.isFinite) ||
    brush.radius < .75 || brush.radius > 6 || brush.strength < .05 || brush.strength > 1 ||
    !['raise', 'lower', 'smooth'].includes(brush.mode)) throw new Error('Invalid terrain brush.');
  const heights = field.heights.map((height, index) => {
    const col = index % SIDE, row = Math.floor(index / SIDE);
    const distance = Math.hypot(col / TERRAIN_SEGMENTS * TERRAIN_SIZE - TERRAIN_SIZE / 2 - brush.x,
      row / TERRAIN_SEGMENTS * TERRAIN_SIZE - TERRAIN_SIZE / 2 - brush.z);
    if (distance >= brush.radius) return height;
    const falloff = (1 - distance / brush.radius) ** 2;
    let delta = (brush.mode === 'lower' ? -1 : 1) * brush.strength;
    if (brush.mode === 'smooth') {
      let sum = 0, count = 0;
      for (let r = Math.max(0, row - 1); r <= Math.min(SIDE - 1, row + 1); r++) {
        for (let c = Math.max(0, col - 1); c <= Math.min(SIDE - 1, col + 1); c++) {
          sum += field.heights[r * SIDE + c]; count++;
        }
      }
      delta = (sum / count - height) * brush.strength;
    }
    return Math.max(-TERRAIN_HEIGHT_LIMIT, Math.min(TERRAIN_HEIGHT_LIMIT, height + delta * falloff));
  });
  return { version: 1, heights };
}
