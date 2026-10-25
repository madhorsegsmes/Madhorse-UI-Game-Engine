import {
  getPhysicsComponent,
  getTransform,
  getWorldTransform,
  localTransformFromWorld,
} from './scene-model';
import type {
  PhysicsComponent,
  PhysicsWorldSettings,
  SceneEntity,
  Vector3,
} from './scene-model';
import { physicsContactPairs } from './physics-broadphase';
import { canBodiesCollide, collidesWithWorldFloor } from './collision-layers';
import { sweepBox, type BoxSweepHit } from './physics-sweep';

type PhysicsBodyState = {
  entity: SceneEntity;
  physics: PhysicsComponent;
  position: Vector3;
  previousPosition: Vector3;
  halfSize: Vector3;
  velocity: Vector3;
  inverseMass: number;
};

const axisKeys = {
  '2d': ['x', 'y'] as const,
  '3d': ['x', 'y', 'z'] as const,
};

function advanceContinuousBody(
  body: PhysicsBodyState,
  stationary: PhysicsBodyState[],
  axes: readonly (keyof Vector3)[],
  dt: number,
): void {
  let start = { ...body.previousPosition };
  let remaining = dt;
  // Bound sliding/bounce work per frame. At the limit, stop at the last safe
  // contact instead of advancing unchecked through the remaining obstacles.
  for (let iteration = 0; iteration < 3; iteration++) {
    const movement = { x: 0, y: 0, z: 0 };
    for (const axis of axes) movement[axis] = body.velocity[axis] * remaining;
    let closest: { hit: BoxSweepHit; target: PhysicsBodyState } | null = null;
    for (const target of stationary) {
      if (!canBodiesCollide(body.physics, target.physics)) continue;
      const hit = sweepBox(start, movement, body.halfSize, target.position, target.halfSize, axes);
      if (hit && (!closest || hit.time < closest.hit.time)) closest = { hit, target };
    }
    if (!closest) {
      body.position = { ...start };
      for (const axis of axes) body.position[axis] += movement[axis];
      return;
    }
    const { hit, target } = closest;
    for (const axis of axes) start[axis] += movement[axis] * hit.time;
    start[hit.axis] += hit.normal * Math.min(1e-5, body.halfSize[hit.axis] * 0.001);
    body.velocity[hit.axis] *= -Math.min(body.physics.restitution, target.physics.restitution);
    const friction = Math.max(0, 1 - (body.physics.friction + target.physics.friction) / 2 * 8 * remaining);
    for (const axis of axes) if (axis !== hit.axis) body.velocity[axis] *= friction;
    remaining *= 1 - hit.time;
  }
  body.position = start;
}

function isEffectivelyActive(entity: SceneEntity, byId: Map<string, SceneEntity>): boolean {
  let current: SceneEntity | undefined = entity;
  const visited = new Set<string>();
  while (current) {
    if (!current.active || visited.has(current.id)) return false;
    visited.add(current.id);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return true;
}

function applyContact(
  a: PhysicsBodyState,
  b: PhysicsBodyState,
  axes: readonly ('x' | 'y' | 'z')[],
): void {
  if (!canBodiesCollide(a.physics, b.physics)) return;
  const overlaps = axes.map((axis) => ({
    axis,
    depth: a.halfSize[axis] + b.halfSize[axis] - Math.abs(a.position[axis] - b.position[axis]),
  }));
  if (overlaps.some(({ depth }) => depth <= 0)) return;
  const contact = overlaps.reduce((smallest, current) => current.depth < smallest.depth ? current : smallest);
  const axis = contact.axis;
  const direction = a.position[axis] >= b.position[axis] ? 1 : -1;
  const inverseTotal = a.inverseMass + b.inverseMass;
  if (inverseTotal === 0) return;

  a.position[axis] += direction * contact.depth * (a.inverseMass / inverseTotal);
  b.position[axis] -= direction * contact.depth * (b.inverseMass / inverseTotal);

  const relativeVelocity = a.velocity[axis] - b.velocity[axis];
  const alongNormal = relativeVelocity * direction;
  if (alongNormal >= 0) return;
  const restitution = Math.min(a.physics.restitution, b.physics.restitution);
  const impulse = -(1 + restitution) * alongNormal / inverseTotal;
  a.velocity[axis] += impulse * direction * a.inverseMass;
  b.velocity[axis] -= impulse * direction * b.inverseMass;

  const friction = Math.sqrt(a.physics.friction * b.physics.friction);
  const frictionFactor = Math.max(0, 1 - friction * Math.min(1, Math.abs(impulse) / 10));
  for (const tangent of axes) {
    if (tangent === axis) continue;
    const tangentImpulse = (a.velocity[tangent] - b.velocity[tangent]) * friction;
    a.velocity[tangent] -= tangentImpulse * (a.inverseMass / inverseTotal) * frictionFactor;
    b.velocity[tangent] += tangentImpulse * (b.inverseMass / inverseTotal) * frictionFactor;
  }
}

/**
 * Advance a temporary, axis-aligned box-body simulation. Positions and
 * velocities are kept outside saved project data by the caller.
 */
export function stepPhysicsScene(
  entities: SceneEntity[],
  settings: PhysicsWorldSettings,
  deltaSeconds: number,
  velocities: Map<string, Vector3>,
): SceneEntity[] {
  const dt = Number.isFinite(deltaSeconds) ? Math.max(0, Math.min(deltaSeconds, 0.05)) : 0;
  if (dt === 0) return entities;

  const byId = new Map(entities.map((entity) => [entity.id, entity]));
  for (const id of velocities.keys()) if (!byId.has(id)) velocities.delete(id);
  const axes = axisKeys[settings.dimension];
  const bodies: PhysicsBodyState[] = [];
  for (const entity of entities) {
    const physics = getPhysicsComponent(entity);
    const world = getWorldTransform(entities, entity.id);
    if (!physics?.enabled || !world || !isEffectivelyActive(entity, byId)) continue;

    const dynamic = physics.bodyType === 'dynamic';
    const velocity = velocities.get(entity.id) ?? { x: 0, y: 0, z: 0 };
    const position = { ...world.position };
    if (dynamic) {
      for (const axis of axes) {
        velocity[axis] += settings.gravity[axis] * physics.gravityScale * dt;
        position[axis] += velocity[axis] * dt;
      }
      velocities.set(entity.id, velocity);
    } else {
      velocities.delete(entity.id);
    }

    bodies.push({
      entity,
      physics,
      position,
      previousPosition: world.position,
      halfSize: {
        x: physics.size.x * Math.abs(world.scale.x) / 2,
        y: physics.size.y * Math.abs(world.scale.y) / 2,
        z: physics.size.z * Math.abs(world.scale.z) / 2,
      },
      velocity,
      inverseMass: dynamic ? 1 / physics.mass : 0,
    });
  }

  if (!bodies.some(body => body.inverseMass > 0)) return entities;
  const stationary = bodies.filter(body => body.physics.bodyType === 'static' && body.physics.colliderEnabled);
  for (const body of bodies) {
    if (body.inverseMass > 0 && body.physics.colliderEnabled && body.physics.continuousCollision) {
      advanceContinuousBody(body, stationary, axes, dt);
    }
  }
  const verticalAxis = settings.dimension === '2d' ? 'y' : 'z';
  for (const body of bodies) {
    if (!body.physics.colliderEnabled || body.inverseMass === 0 || !collidesWithWorldFloor(body.physics)) continue;
    const floor = body.halfSize[verticalAxis];
    if (body.position[verticalAxis] < floor) {
      body.position[verticalAxis] = floor;
      if (body.velocity[verticalAxis] < 0) {
        body.velocity[verticalAxis] = -body.velocity[verticalAxis] * body.physics.restitution;
        const friction = Math.max(0, 1 - body.physics.friction * 8 * dt);
        for (const axis of axes) {
          if (axis !== verticalAxis) body.velocity[axis] *= friction;
        }
      }
    }
  }

  for (let iteration = 0; iteration < 3; iteration++) {
    const pairs = physicsContactPairs(bodies, settings.dimension);
    if (!pairs.length) break;
    for (const [a, b] of pairs) applyContact(bodies[a], bodies[b], axes);
  }

  const nextPositions = new Map(bodies
    .filter((body) => body.inverseMass > 0)
    .map((body) => [body.entity.id, body.position]));
  if (!nextPositions.size) return entities;

  return entities.map((entity) => {
    const position = nextPositions.get(entity.id);
    if (!position) return entity;
    const world = getWorldTransform(entities, entity.id);
    if (!world) return entity;
    const transform = getTransform(entity);
    const local = localTransformFromWorld(
      entities,
      { ...world, position },
      entity.parentId,
    );
    return {
      ...entity,
      components: entity.components.map((component) => component.type === 'transform'
        ? { ...transform, position: local.position }
        : component),
    };
  });
}
