/** Rigid-body contact channels, independent of triggers, navigation and gameplay traces. */
export const collisionLayers = ['Default', 'World', 'Player', 'NPC', 'Projectile', 'Decoration'] as const;
export const ALL_COLLISION_LAYERS = (1 << collisionLayers.length) - 1;
export type CollisionFilter = { collisionLayer?: number; collisionMask?: number };
export const collisionPresets = [
  { id: 'solid', label: 'Solid — all groups', collisionLayer: 0, collisionMask: 63, continuousCollision: false },
  { id: 'world', label: 'World / ground', collisionLayer: 1, collisionMask: 63, continuousCollision: false },
  { id: 'player', label: 'Player / character', collisionLayer: 2, collisionMask: 63, continuousCollision: false },
  { id: 'npc', label: 'NPC / enemy', collisionLayer: 3, collisionMask: 63, continuousCollision: false },
  { id: 'projectile', label: 'Fast projectile — ignore other projectiles', collisionLayer: 4, collisionMask: 47, continuousCollision: true },
  { id: 'decoration', label: 'Decoration — ignore projectiles', collisionLayer: 5, collisionMask: 47, continuousCollision: false },
  { id: 'ghost', label: 'Ghost — no body contacts', collisionLayer: 0, collisionMask: 0, continuousCollision: false },
] as const;
export function collisionPresetDraft(id: string): Record<string, string> | null {
  const preset = collisionPresets.find(item => item.id === id);
  if (!preset) return null;
  return {
    'physics.collisionLayer': String(preset.collisionLayer),
    'physics.continuousCollision': String(preset.continuousCollision),
    ...(preset.id === 'projectile' ? { 'physics.simulateInPlay': 'true' } : {}),
    ...Object.fromEntries(collisionLayers.map((_, index) =>
      [`physics.collides.${index}`, String(Boolean(preset.collisionMask & (1 << index)))])),
  };
}
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
