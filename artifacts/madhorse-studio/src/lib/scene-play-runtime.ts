import {
  getTransform,
  getWorldTransform,
  type CharacterControllerComponent,
  type SceneEntity,
  type TriggerZoneComponent,
} from './scene-model';
import {
  advancePlayerActions, createPlayerActionRuntimeState, resolveActionMovement,
  type ActionAudioEvent, type ActionHud, type PlayerActionRuntimeState,
} from './player-action-runtime';

export type RuntimeInput = {
  moveX: number;
  moveY: number;
  jumpPressed: boolean;
  heldKeys?: readonly string[];
  pressedKeys?: readonly string[];
};

export type RuntimeTriggerEvent = {
  zoneId: string;
  message: string;
};

export type SceneRuntimeState = {
  contacts: Set<string>;
  jumpVelocity: Map<string, number>;
  patrolOrigins: Map<string, { x: number; y: number }>;
  actions: PlayerActionRuntimeState;
  controlledPlayerId: string | null;
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

export function createSceneRuntimeState(entities: SceneEntity[], preferredPlayerId: string | null = null): SceneRuntimeState {
  const patrolOrigins = new Map<string, { x: number; y: number }>();
  for (const entity of entities) {
    const controller = getController(entity);
    if (controller?.role === 'npc' && controller.behavior === 'patrol') {
      const transform = getTransform(entity);
      patrolOrigins.set(entity.id, { x: transform.position.x, y: transform.position.y });
    }
  }
  return { contacts: new Set(), jumpVelocity: new Map(), patrolOrigins, actions: createPlayerActionRuntimeState(), controlledPlayerId: preferredPlayerId };
}

export function advanceSceneRuntime(
  entities: SceneEntity[],
  deltaSeconds: number,
  elapsedSeconds: number,
  input: RuntimeInput,
  state: SceneRuntimeState,
): { entities: SceneEntity[]; events: RuntimeTriggerEvent[]; audioEvents: ActionAudioEvent[]; hud: ActionHud | null } {
  const dt = Math.min(0.05, Math.max(0, deltaSeconds));
  const players = entities.filter(entity => {
    const controller = getController(entity);
    return Boolean(controller?.enabled && controller.role === 'player' && entity.active);
  });
  const player = players.find(entity => entity.id === state.controlledPlayerId) ??
    players.find(entity => entity.components.some(component => component.type === 'playerAction' && component.enabled)) ?? players[0];
  if (player) state.controlledPlayerId = player.id;
  const playerController = player ? getController(player) : undefined;
  const playerWorld = player ? getWorldTransform(entities, player.id) : null;
  const actionMotion = player ? resolveActionMovement(player, input, state.actions, dt) : null;

  const moved = entities.map(entity => {
    const controller = getController(entity);
    if (!controller?.enabled || !entity.active) return entity;
    const transform = getTransform(entity);
    const nextPosition = { ...transform.position };
    let nextScale = transform.scale;
    let nextRotation = transform.rotation;
    if (controller.role === 'player' && player?.id === entity.id && controller.behavior === 'direct-control') {
      const length = Math.hypot(input.moveX, input.moveY) || 1;
      const speed = controller.moveSpeed * (actionMotion?.speedMultiplier ?? 1);
      nextPosition.x += actionMotion?.driving ? actionMotion.dx : input.moveX / length * speed * dt * 10;
      nextPosition.y += actionMotion?.driving ? actionMotion.dy : input.moveY / length * speed * dt * 10;
      if (actionMotion) {
        nextScale = {
          ...actionMotion.current.baseScale,
          z: actionMotion.current.baseScale.z * actionMotion.heightMultiplier,
        };
        if (actionMotion.driving) nextRotation = { ...transform.rotation, z: actionMotion.current.heading * 180 / Math.PI };
      }

      let velocity = state.jumpVelocity.get(entity.id) ?? 0;
      const groundZ = actionMotion?.current.groundZ ?? 0;
      const heightMeters = Math.max(0, (transform.position.z - groundZ) / 10);
      if (input.jumpPressed && !actionMotion?.crouching && !actionMotion?.driving && heightMeters <= 0.01 && controller.jumpHeight > 0) {
        velocity = Math.sqrt(2 * 9.81 * controller.jumpHeight);
      }
      if (velocity > 0 || heightMeters > 0) {
        velocity -= 9.81 * dt;
        const nextHeight = Math.max(0, heightMeters + velocity * dt);
        nextPosition.z = groundZ + nextHeight * 10;
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
    if (nextPosition.x === transform.position.x && nextPosition.y === transform.position.y && nextPosition.z === transform.position.z &&
        nextScale.z === transform.scale.z && nextRotation.z === transform.rotation.z) return entity;
    return {
      ...entity,
      components: entity.components.map(component => component.id === transform.id
        ? { ...transform, position: nextPosition, scale: nextScale, rotation: nextRotation }
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
  const actionResult = advancePlayerActions(
    moved.map(entity => activeByZone.has(entity.id) ? { ...entity, active: activeByZone.get(entity.id)! } : entity),
    player?.id, input, state.actions, elapsedSeconds, actionMotion,
  );
  return {
    entities: actionResult.entities,
    events: [...events, ...actionResult.events],
    audioEvents: actionResult.audioEvents,
    hud: actionResult.hud,
  };
}
