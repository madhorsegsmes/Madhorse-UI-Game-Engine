import {
  getTransform,
  getWorldTransform,
  type CharacterControllerComponent,
  type SceneEntity,
  type TriggerZoneComponent,
} from './scene-model';

export type RuntimeInput = {
  moveX: number;
  moveY: number;
  jumpPressed: boolean;
};

export type RuntimeTriggerEvent = {
  zoneId: string;
  message: string;
};

export type SceneRuntimeState = {
  contacts: Set<string>;
  jumpVelocity: Map<string, number>;
  patrolOrigins: Map<string, { x: number; y: number }>;
};

function getController(entity: SceneEntity): CharacterControllerComponent | undefined {
  return entity.components.find((component): component is CharacterControllerComponent =>
    component.type === 'characterController',
  );
}

function getTriggerZone(entity: SceneEntity): TriggerZoneComponent | undefined {
  return entity.components.find((component): component is TriggerZoneComponent =>
    component.type === 'triggerZone',
  );
}

export function createSceneRuntimeState(entities: SceneEntity[]): SceneRuntimeState {
  const patrolOrigins = new Map<string, { x: number; y: number }>();
  for (const entity of entities) {
    const controller = getController(entity);
    if (controller?.role === 'npc' && controller.behavior === 'patrol') {
      const transform = getTransform(entity);
      patrolOrigins.set(entity.id, { x: transform.position.x, y: transform.position.y });
    }
  }
  return { contacts: new Set(), jumpVelocity: new Map(), patrolOrigins };
}

export function advanceSceneRuntime(
  entities: SceneEntity[],
  deltaSeconds: number,
  elapsedSeconds: number,
  input: RuntimeInput,
  state: SceneRuntimeState,
): { entities: SceneEntity[]; events: RuntimeTriggerEvent[] } {
  const dt = Math.min(0.05, Math.max(0, deltaSeconds));
  const players = entities.filter(entity => {
    const controller = getController(entity);
    return Boolean(controller?.enabled && controller.role === 'player' && entity.active);
  });
  const player = players[0];
  const playerController = player ? getController(player) : undefined;
  const playerWorld = player ? getWorldTransform(entities, player.id) : null;

  const moved = entities.map(entity => {
    const controller = getController(entity);
    if (!controller?.enabled || !entity.active) return entity;
    const transform = getTransform(entity);
    const nextPosition = { ...transform.position };
    if (controller.role === 'player' && player?.id === entity.id && controller.behavior === 'direct-control') {
      const length = Math.hypot(input.moveX, input.moveY) || 1;
      nextPosition.x += input.moveX / length * controller.moveSpeed * dt * 10;
      nextPosition.y += input.moveY / length * controller.moveSpeed * dt * 10;

      let velocity = state.jumpVelocity.get(entity.id) ?? 0;
      const heightMeters = Math.max(0, transform.position.z / 10);
      if (input.jumpPressed && heightMeters <= 0.01 && controller.jumpHeight > 0) {
        velocity = Math.sqrt(2 * 9.81 * controller.jumpHeight);
      }
      if (velocity > 0 || heightMeters > 0) {
        velocity -= 9.81 * dt;
        const nextHeight = Math.max(0, heightMeters + velocity * dt);
        nextPosition.z = nextHeight * 10;
        if (nextHeight === 0) velocity = 0;
        state.jumpVelocity.set(entity.id, velocity);
      }
    } else if (controller.role === 'npc' && controller.behavior === 'follow-player' && playerWorld) {
      const dx = playerWorld.position.x - transform.position.x;
      const dy = playerWorld.position.y - transform.position.y;
      const distanceMeters = Math.hypot(dx, dy) / 10;
      if (distanceMeters > controller.followDistance && distanceMeters > 0.001) {
        const step = Math.min(distanceMeters - controller.followDistance, controller.moveSpeed * dt) * 10 / Math.hypot(dx, dy);
        nextPosition.x += dx * step;
        nextPosition.y += dy * step;
      }
    } else if (controller.role === 'npc' && controller.behavior === 'patrol') {
      const origin = state.patrolOrigins.get(entity.id) ?? { x: transform.position.x, y: transform.position.y };
      state.patrolOrigins.set(entity.id, origin);
      const radius = controller.patrolRadius * 10;
      nextPosition.x = origin.x + Math.sin(elapsedSeconds * controller.moveSpeed / 4) * radius;
      nextPosition.y = origin.y;
    }
    if (nextPosition.x === transform.position.x && nextPosition.y === transform.position.y && nextPosition.z === transform.position.z) return entity;
    return {
      ...entity,
      components: entity.components.map(component => component.id === transform.id
        ? { ...transform, position: nextPosition }
        : component),
    };
  });

  const movedPlayer = player ? getWorldTransform(moved, player.id) : null;
  const contacts = new Set<string>();
  const events: RuntimeTriggerEvent[] = [];
  if (movedPlayer && playerController) {
    for (const zoneEntity of moved) {
      const zone = getTriggerZone(zoneEntity);
      const zoneTransform = getWorldTransform(moved, zoneEntity.id);
      if (!zone?.enabled || !zoneTransform || !zoneEntity.active) continue;
      const dx = (movedPlayer.position.x - zoneTransform.position.x) / 10;
      const dy = (movedPlayer.position.y - zoneTransform.position.y) / 10;
      const dz = (movedPlayer.position.z - zoneTransform.position.z) / 10;
      const inside = zone.shape === 'sphere'
        ? Math.hypot(dx, dy, dz) <= Math.max(zone.size.x, zone.size.y, zone.size.z) / 2
        : Math.abs(dx) <= zone.size.x / 2 && Math.abs(dy) <= zone.size.y / 2 && Math.abs(dz) <= zone.size.z / 2;
      if (!inside) continue;
      contacts.add(zoneEntity.id);
      if (state.contacts.has(zoneEntity.id)) continue;
      events.push({ zoneId: zoneEntity.id, message: zone.message });
    }
  }

  const activeByZone = new Map<string, boolean>();
  for (const entity of moved) {
    if (!contacts.has(entity.id) || state.contacts.has(entity.id)) continue;
    const zone = getTriggerZone(entity);
    if (!zone || !zone.targetEntityId || (zone.action !== 'enable-target' && zone.action !== 'toggle-target')) continue;
    const target = moved.find(candidate => candidate.id === zone.targetEntityId);
    if (!target) continue;
    const enabled = zone.action === 'enable-target' ? true : !target.active;
    activeByZone.set(target.id, enabled);
  }
  state.contacts = contacts;
  return {
    entities: moved.map(entity => activeByZone.has(entity.id) ? { ...entity, active: activeByZone.get(entity.id)! } : entity),
    events,
  };
}
