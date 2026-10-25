import { getPhysicsComponent, getWorldTransform, type SceneEntity } from './scene-model';
import { getSceneEditorFlags } from './scene-editor-state';
import { physicsBoxHalfSize } from './physics-box';

export const MAX_PHYSICS_DEBUG_BOXES = 500;
export type PhysicsDebugSettings = { enabled: boolean; selectedOnly: boolean; seeThrough: boolean };
export const DEFAULT_PHYSICS_DEBUG: PhysicsDebugSettings = { enabled: false, selectedOnly: false, seeThrough: true };
export function normalizePhysicsDebug(input: unknown): PhysicsDebugSettings {
  const value = input && typeof input === 'object' ? input as Partial<PhysicsDebugSettings> : {};
  return { enabled: value.enabled === true, selectedOnly: value.selectedOnly === true, seeThrough: value.seeThrough !== false };
}
export type PhysicsDebugBox = {
  id: string; bodyType: 'static' | 'dynamic' | 'kinematic'; selected: boolean;
  center: [number, number, number]; halfSize: [number, number, number];
};
export const physicsDebugColors = {
  static: '#58db83', dynamic: '#60c8ff', kinematic: '#ffc45a', selected: '#ffef8a',
};
const linearColors = Object.fromEntries(Object.entries(physicsDebugColors).map(([key, hex]) => [
  key, [1, 3, 5].map(start => {
    const channel = parseInt(hex.slice(start, start + 2), 16) / 255;
    return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
  }),
]));

export function collectPhysicsDebugBoxes(
  entities: SceneEntity[], selectedId: string | null, selectedOnly: boolean, respectEditorVisibility: boolean,
): { boxes: PhysicsDebugBox[]; total: number } {
  const byId = new Map(entities.map(entity => [entity.id, entity]));
  const boxes: PhysicsDebugBox[] = [];
  let total = 0;
  for (const entity of entities) {
    if (selectedOnly && entity.id !== selectedId) continue;
    const physics = getPhysicsComponent(entity);
    if (!physics?.enabled || !physics.colliderEnabled) continue;
    let cursor: SceneEntity | undefined = entity;
    const visited = new Set<string>();
    let active = true;
    while (cursor) {
      if (!cursor.active || visited.has(cursor.id)) { active = false; break; }
      visited.add(cursor.id);
      cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
    }
    if (!active || respectEditorVisibility && getSceneEditorFlags(entity.id, byId).hidden) continue;
    total++;
    if (boxes.length >= MAX_PHYSICS_DEBUG_BOXES) continue;
    const world = getWorldTransform(entities, entity.id);
    if (!world) continue;
    const half = physicsBoxHalfSize(physics.size, world.scale);
    const center: PhysicsDebugBox['center'] = [(world.position.x - 50) / 10, world.position.z / 10, (world.position.y - 50) / 10];
    const halfSize: PhysicsDebugBox['halfSize'] = [half.x / 10, half.z / 10, half.y / 10];
    if (!center.every(Number.isFinite) || !halfSize.every(number => Number.isFinite(number) && number > 0)) continue;
    boxes.push({ id: entity.id, bodyType: physics.bodyType, selected: entity.id === selectedId, center, halfSize });
  }
  return { boxes, total };
}

const edges = [[0, 1], [1, 3], [3, 2], [2, 0], [4, 5], [5, 7], [7, 6], [6, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
export function writePhysicsBoxLines(boxes: PhysicsDebugBox[], positions: Float32Array, colors: Float32Array) {
  let offset = 0;
  const count = Math.min(boxes.length, Math.floor(positions.length / 72), Math.floor(colors.length / 72));
  for (const box of boxes.slice(0, count)) {
    // Vertex colors are linear; the renderer converts to the output color space.
    const rgb = linearColors[box.selected ? 'selected' : box.bodyType];
    for (const edge of edges) for (const corner of edge) {
      for (let axis = 0; axis < 3; axis++) {
        positions[offset] = box.center[axis] + (corner & 1 << axis ? 1 : -1) * box.halfSize[axis];
        colors[offset++] = rgb[axis];
      }
    }
  }
  return offset / 3;
}
