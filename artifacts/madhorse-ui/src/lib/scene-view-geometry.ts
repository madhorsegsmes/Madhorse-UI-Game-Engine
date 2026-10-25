import { Box3, BoxGeometry, PlaneGeometry, Sphere, Vector3 } from 'three';
import { getWorldTransform, getPrimitive, getSpriteRenderer, getModelRenderer, type PrimitiveComponent, type SceneEntity } from './scene-model';
import type { GameCamera } from './game-camera';
import { createTerrainHeightfield, isTerrainHeightfield, TERRAIN_SEGMENTS, TERRAIN_SIZE, type TerrainHeightfield } from './terrain-heightfield';

export function createPrimitiveGeometry(shape: PrimitiveComponent['shape'], heightfield?: TerrainHeightfield) {
  if (shape === 'cube') return new BoxGeometry(1, 1, 1);
  const terrain = shape === 'terrain';
  if (terrain && heightfield !== undefined && !isTerrainHeightfield(heightfield)) throw new Error('Invalid terrain heightfield.');
  const heights = terrain ? (heightfield ?? createTerrainHeightfield()).heights : [];
  const plane = new PlaneGeometry(terrain ? TERRAIN_SIZE : 10, terrain ? TERRAIN_SIZE : 10, terrain ? TERRAIN_SEGMENTS : 1, terrain ? TERRAIN_SEGMENTS : 1);
  plane.rotateX(-Math.PI / 2);
  const positions = plane.getAttribute('position');
  for (let index = 0; index < positions.count; index++) {
    positions.setY(index, terrain ? heights[index] : -.05);
  }
  plane.computeVertexNormals();
  plane.computeBoundingBox();
  plane.computeBoundingSphere();
  return plane;
}

export function sceneFrameDistance(settings: GameCamera, aspect: number, fov = 48) {
  const eye = new Vector3(settings.position.x, settings.position.y, settings.position.z);
  const target = new Vector3(settings.target.x, settings.target.y, settings.target.z);
  const radius = eye.distanceTo(target) / 2 + 2.4;
  const angle = Math.min(fov * Math.PI / 360, Math.atan(Math.tan(fov * Math.PI / 360) * Math.max(.1, aspect)));
  return radius / Math.sin(angle) * 1.08;
}

export type SceneFocus = { center: { x: number; y: number; z: number }; radius: number };

export function sceneEntityFocus(entities: SceneEntity[], rootId: string): SceneFocus | null {
  const members = new Set([rootId]);
  for (let count = 0, changed = true; changed && count < entities.length; count++) {
    changed = false;
    for (const entity of entities) if (entity.parentId && members.has(entity.parentId) && !members.has(entity.id)) {
      members.add(entity.id); changed = true;
    }
  }
  const bounds = new Box3();
  for (const entity of entities) {
    if (!members.has(entity.id) || entity.isGroup) continue;
    const primitive = getPrimitive(entity), sprite = getSpriteRenderer(entity), model = getModelRenderer(entity);
    if (!primitive && !sprite && !model) continue;
    const world = getWorldTransform(entities, entity.id);
    if (!world) continue;
    const base = primitive?.shape === 'plane' ? 10 : primitive?.shape === 'terrain' ? 20 : model ? 4 : 1;
    const radius = sprite
      ? Math.hypot(sprite.width * world.scale.x / 10, sprite.height * world.scale.y / 10) / 2
      : Math.hypot(world.scale.x, world.scale.y, world.scale.z) * base / 2;
    const point = new Vector3((world.position.x - 50) / 10, world.position.z / 10, (world.position.y - 50) / 10);
    bounds.expandByPoint(point.clone().addScalar(radius));
    bounds.expandByPoint(point.clone().addScalar(-radius));
  }
  if (bounds.isEmpty()) return null;
  const sphere = bounds.getBoundingSphere(new Sphere());
  return { center: { x: sphere.center.x, y: sphere.center.y, z: sphere.center.z }, radius: Math.max(1, sphere.radius) };
}
