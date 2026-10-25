/** Rigid-body contact channels, independent of triggers, navigation and gameplay traces. */
export const collisionLayers = ['Default', 'World', 'Player', 'NPC', 'Projectile', 'Decoration'] as const;
export const ALL_COLLISION_LAYERS = (1 << collisionLayers.length) - 1;
export type CollisionFilter = { collisionLayer?: number; collisionMask?: number };
export function isCollisionFilter(value: CollisionFilter): boolean {
  return (value.collisionLayer === undefined || Number.isInteger(value.collisionLayer) &&
    value.collisionLayer >= 0 && value.collisionLayer < collisionLayers.length) &&
    (value.collisionMask === undefined || Number.isInteger(value.collisionMask) &&
      value.collisionMask >= 0 && value.collisionMask <= ALL_COLLISION_LAYERS);
}
export function canBodiesCollide(a: CollisionFilter, b: CollisionFilter): boolean {
  if (!isCollisionFilter(a) || !isCollisionFilter(b)) return false;
  return Boolean(((a.collisionMask ?? ALL_COLLISION_LAYERS) & (1 << (b.collisionLayer ?? 0))) &&
    ((b.collisionMask ?? ALL_COLLISION_LAYERS) & (1 << (a.collisionLayer ?? 0))));
}
export function collidesWithWorldFloor(body: CollisionFilter): boolean {
  return canBodiesCollide(body, { collisionLayer: 1, collisionMask: ALL_COLLISION_LAYERS });
}
