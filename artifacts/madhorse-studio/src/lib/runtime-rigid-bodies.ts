import {
  createDefaultPhysicsWorldSettings, getPhysicsComponent, getTransform,
  type SceneEntity, type Vector3,
} from './scene-model';
import { stepPhysicsScene } from './physics-simulation';

/**
 * Opt-in physics for the shared Studio/export 3D scene runtime. Controllers keep
 * their existing movement authority; temporary body-type changes never persist.
 */
export function stepRuntimeRigidBodies(
  entities: SceneEntity[],
  delta: number,
  velocities: Map<string, Vector3>,
  ownsMovement: (entity: SceneEntity) => boolean,
): SceneEntity[] {
  const simulated = new Set(entities.filter(entity => {
    const physics = getPhysicsComponent(entity);
    return physics?.enabled && physics.bodyType === 'dynamic' && physics.simulateInPlay && !ownsMovement(entity);
  }).map(entity => entity.id));
  for (const id of velocities.keys()) if (!simulated.has(id)) velocities.delete(id);
  if (!simulated.size) return entities;
  for (const entity of entities) {
    if (simulated.has(entity.id) && !velocities.has(entity.id)) {
      velocities.set(entity.id, { ...(getPhysicsComponent(entity)!.initialVelocity ?? { x: 0, y: 0, z: 0 }) });
    }
  }
  const temporary = entities.map(entity => {
    if (simulated.has(entity.id)) return entity;
    const physics = getPhysicsComponent(entity);
    if (physics?.bodyType !== 'dynamic') return entity;
    return { ...entity, components: entity.components.map(component => component === physics
      ? { ...physics, bodyType: 'kinematic' as const } : component) };
  });
  const stepped = stepPhysicsScene(temporary, createDefaultPhysicsWorldSettings('3d'), delta, velocities);
  const transforms = new Map(stepped.filter(entity => simulated.has(entity.id))
    .map(entity => [entity.id, getTransform(entity)]));
  return entities.map(entity => {
    const transform = transforms.get(entity.id);
    return transform ? { ...entity, components: entity.components.map(component =>
      component.type === 'transform' ? transform : component) } : entity;
  });
}
