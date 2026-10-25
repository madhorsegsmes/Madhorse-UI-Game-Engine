import { Box3, Ray, Vector3 } from 'three';
import { getTransform, getWorldTransform, type SceneEntity } from './scene-model';

export function firstPersonMove(x: number, y: number, yaw: number) {
  const angle = yaw * Math.PI / 180;
  return { moveX: x * Math.cos(angle) + y * Math.sin(angle), moveY: y * Math.cos(angle) - x * Math.sin(angle) };
}

export function firstPersonCollide(
  entities: SceneEntity[], playerId: string,
  from: { x: number; y: number; z: number }, desired: { x: number; y: number; z: number },
  heightMultiplier = 1,
) {
  const player = entities.find(entity => entity.id === playerId);
  const body = player?.components.find(component => component.type === 'physics');
  const radiusX = body?.type === 'physics' ? body.size.x / 2 : 3;
  const radiusY = body?.type === 'physics' ? body.size.y / 2 : 3;
  const height = (body?.type === 'physics' ? body.size.z : 18) * heightMultiplier;
  const boxes = entities.flatMap(entity => {
    if (!entity.active || entity.id === playerId || entity.parentId === playerId) return [];
    const physics = entity.components.find(component => component.type === 'physics');
    if (physics?.type !== 'physics' || !physics.enabled || !physics.colliderEnabled || physics.bodyType !== 'static') return [];
    const transform = getWorldTransform(entities, entity.id);
    if (!transform) return [];
    const p = transform.position, s = physics.size;
    if (p.z + s.z / 2 <= desired.z + .01 || p.z - s.z / 2 >= desired.z + height) return [];
    return [{ minX: p.x - s.x / 2 - radiusX, maxX: p.x + s.x / 2 + radiusX,
      minY: p.y - s.y / 2 - radiusY, maxY: p.y + s.y / 2 + radiusY }];
  });
  const blocked = (x: number, y: number) => boxes.some(box =>
    x > box.minX && x < box.maxX && y > box.minY && y < box.maxY);
  const result = { ...desired };
  if (blocked(result.x, from.y)) result.x = from.x;
  if (blocked(result.x, result.y)) result.y = from.y;
  return result;
}

/** Conservative collider AABBs: walls/cover stop shots before targets behind them. */
export function firstPersonHit(entities: SceneEntity[], playerId: string, yaw: number, pitch: number, range: number, crouching = false) {
  const player = entities.find(entity => entity.id === playerId);
  if (!player) return null;
  const position = getWorldTransform(entities, playerId)?.position ?? getTransform(player).position;
  const origin = new Vector3(position.x, position.y, position.z + (crouching ? 9 : 16));
  const a = yaw * Math.PI / 180, p = pitch * Math.PI / 180;
  const direction = new Vector3(Math.sin(a) * Math.cos(p), Math.cos(a) * Math.cos(p), Math.sin(p));
  const ray = new Ray(origin, direction);
  let nearest: { id: string; distance: number; point: { x: number; y: number; z: number } } | null = null;
  const active = new Map(entities.map(entity => [entity.id, entity]));
  for (const entity of entities) {
    if (!entity.active || entity.id === playerId) continue;
    let parent = entity.parentId;
    const visited = new Set<string>();
    let hidden = false;
    while (parent && !visited.has(parent)) {
      if (parent === playerId || active.get(parent)?.active === false) { hidden = true; break; }
      visited.add(parent);
      parent = active.get(parent)?.parentId ?? null;
    }
    if (hidden) continue;
    const physics = entity.components.find(component => component.type === 'physics');
    if (physics?.type !== 'physics' || !physics.enabled || !physics.colliderEnabled) continue;
    const transform = getWorldTransform(entities, entity.id);
    if (!transform) continue;
    const half = new Vector3(physics.size.x, physics.size.y, physics.size.z).multiplyScalar(.5);
    const center = new Vector3(transform.position.x, transform.position.y, transform.position.z);
    const point = ray.intersectBox(new Box3(center.clone().sub(half), center.clone().add(half)), new Vector3());
    if (!point) continue;
    const distance = point.distanceTo(origin);
    if (distance <= range * 10 && (!nearest || distance < nearest.distance)) nearest = { id: entity.id, distance, point: { x: point.x, y: point.y, z: point.z } };
  }
  return nearest;
}
