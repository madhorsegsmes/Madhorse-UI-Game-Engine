import {
  getTransform,
  getWorldTransform,
  type CharacterControllerComponent,
  type SceneEntity,
  type TriggerZoneComponent,
  type VisualLogicNode,
} from './scene-model';
import {
  advancePlayerActions, createPlayerActionRuntimeState, getPlayerActions, resolveActionMovement,
  type ActionAudioEvent, type ActionHud, type PlayerActionRuntimeState,
} from './player-action-runtime';
import { firstPersonCollide, firstPersonMove } from './fps-aim';

export type RuntimeInput = {
  moveX: number;
  moveY: number;
  jumpPressed: boolean;
  heldKeys?: readonly string[];
  pressedKeys?: readonly string[];
  lookYaw?: number;
  lookPitch?: number;
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
  animationAction: 'attack' | 'cast' | 'shoot' | 'jump' | null;
  animationActionUntil: number;
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
  return {
    contacts: new Set(),
    jumpVelocity: new Map(),
    patrolOrigins,
    actions: createPlayerActionRuntimeState(entities),
    controlledPlayerId: preferredPlayerId,
    animationAction: null,
    animationActionUntil: 0,
  };
}

export function advanceSceneRuntime(
  entities: SceneEntity[],
  deltaSeconds: number,
  elapsedSeconds: number,
  input: RuntimeInput,
  state: SceneRuntimeState,
): {
  entities: SceneEntity[];
  events: RuntimeTriggerEvent[];
  audioEvents: ActionAudioEvent[];
  hud: ActionHud | null;
  animationTargetId: string | null;
  animationState: 'idle' | 'walk' | 'run' | 'attack' | 'cast' | 'shoot' | 'drive' | 'jump';
} {
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
  const fighterMode = player ? getPlayerActions(player).some(action =>
    ['light-attack', 'heavy-attack', 'special-attack'].includes(action.action),
  ) : false;
  const firstPerson = playerController?.perspective === 'first-person';
  const playerInput = firstPerson
    ? { ...input, ...firstPersonMove(input.moveX, input.moveY, input.lookYaw ?? getTransform(player!).rotation.z),
      lookYaw: input.lookYaw ?? getTransform(player!).rotation.z }
    : fighterMode ? { ...input, moveY: 0 } : input;
  const actionMotion = player ? resolveActionMovement(player, playerInput, state.actions, dt) : null;
  const pressedKeys = new Set(input.pressedKeys ?? []);
  const pressedAction = actionMotion?.actions.find(action =>
    pressedKeys.has(action.key) && ['fight', 'light-attack', 'heavy-attack', 'special-attack', 'cast', 'shoot'].includes(action.action),
  );
  const nextAnimationAction = pressedAction && ['fight', 'light-attack', 'heavy-attack', 'special-attack'].includes(pressedAction.action) ? 'attack'
    : pressedAction?.action === 'cast' ? 'cast'
      : pressedAction?.action === 'shoot' ? 'shoot' : null;
  if (input.jumpPressed) {
    state.animationAction = 'jump';
    state.animationActionUntil = elapsedSeconds + 0.5;
  } else if (nextAnimationAction) {
    state.animationAction = nextAnimationAction;
    state.animationActionUntil = elapsedSeconds + (nextAnimationAction === 'cast' ? 0.8 : nextAnimationAction === 'shoot' ? 0.24 : 0.42);
  }
  const activeAnimationAction = elapsedSeconds < state.animationActionUntil ? state.animationAction : null;
  const animationState = actionMotion?.driving ? 'drive'
    : activeAnimationAction ? activeAnimationAction
      : actionMotion?.running ? 'run'
        : playerInput.moveX !== 0 || playerInput.moveY !== 0 ? 'walk'
          : 'idle';

  const moved = entities.map(entity => {
    const controller = getController(entity);
    if (!controller?.enabled || !entity.active) return entity;
    const transform = getTransform(entity);
    const nextPosition = { ...transform.position };
    let nextScale = transform.scale;
    let nextRotation = transform.rotation;
    if (controller.role === 'player' && player?.id === entity.id && controller.behavior === 'direct-control') {
      const length = Math.hypot(playerInput.moveX, playerInput.moveY) || 1;
      const speed = controller.moveSpeed * (actionMotion?.speedMultiplier ?? 1);
      nextPosition.x += actionMotion?.driving ? actionMotion.dx : playerInput.moveX / length * speed * dt * 10;
      nextPosition.y += actionMotion?.driving ? actionMotion.dy : playerInput.moveY / length * speed * dt * 10;
      if (fighterMode) {
        const targetId = getPlayerActions(entity).find(action =>
          ['light-attack', 'heavy-attack', 'special-attack'].includes(action.action) && action.targetId,
        )?.targetId;
        const target = targetId ? entities.find(candidate => candidate.id === targetId) : undefined;
        const targetPosition = target ? getWorldTransform(entities, target.id)?.position : undefined;
        if (targetPosition && Math.abs(targetPosition.x - transform.position.x) > 0.5) {
          nextRotation = { ...transform.rotation, z: targetPosition.x > transform.position.x ? 90 : -90 };
        }
        const stage = entities.find(candidate => candidate.name === 'Fighting Stage Floor' && candidate.active);
        const stageTransform = stage ? getWorldTransform(entities, stage.id) : null;
        const stageScale = stage ? getTransform(stage).scale.x : 0;
        if (stageTransform && stageScale > 0) {
          const halfWidth = Math.max(0, stageScale * 5 - transform.scale.x * 5 - 3);
          nextPosition.x = Math.max(stageTransform.position.x - halfWidth, Math.min(stageTransform.position.x + halfWidth, nextPosition.x));
        }
      }
      if (actionMotion) {
        nextScale = {
          ...actionMotion.current.baseScale,
          z: actionMotion.current.baseScale.z * actionMotion.heightMultiplier,
        };
        if (actionMotion.driving || firstPerson) nextRotation = { ...transform.rotation, z: actionMotion.current.heading * 180 / Math.PI };
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
      if (firstPerson) {
        Object.assign(nextPosition, firstPersonCollide(entities, entity.id, transform.position, nextPosition,
          actionMotion?.heightMultiplier ?? 1));
      }
    } else if (controller.role === 'npc' && state.actions.orders.has(entity.id)) {
      const destination = state.actions.orders.get(entity.id)!;
      const origin = getWorldTransform(entities, entity.id)?.position ?? transform.position;
      const dx = destination.x - origin.x;
      const dy = destination.y - origin.y;
      const distance = Math.hypot(dx, dy);
      if (distance > 0.5) {
        const step = Math.min(distance, controller.moveSpeed * dt * 10) / distance;
        nextPosition.x += dx * step;
        nextPosition.y += dy * step;
      }
    } else if (controller.role === 'npc' && controller.behavior === 'follow-player' && playerWorld) {
      const dx = playerWorld.position.x - transform.position.x;
      const dy = playerWorld.position.y - transform.position.y;
      const distanceMeters = Math.hypot(dx, dy) / 10;
      if (getPlayerActions(entity).some(action =>
        ['light-attack', 'heavy-attack', 'special-attack'].includes(action.action),
      ) && Math.abs(dx) > 0.5) {
        nextRotation = { ...transform.rotation, z: dx > 0 ? 90 : -90 };
      }
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
    if (!zone) continue;
    if (zone.logicNodes?.length) {
      const inventory = player ? state.actions.players.get(player.id) : undefined;
      let passed = true;
      for (const node of zone.logicNodes) {
        if (node.type === 'condition-item') {
          const count = inventory?.[node.item] ?? 0;
          if (count < node.minimum) {
            if (node.failMessage.trim()) events.push({ zoneId: entity.id, message: node.failMessage });
            passed = false;
            break;
          }
          continue;
        }
        if (node.type === 'message') {
          if (node.message.trim()) events.push({ zoneId: entity.id, message: node.message });
          continue;
        }
        if (!node.targetEntityId) continue;
        const target = moved.find(candidate => candidate.id === node.targetEntityId);
        if (!target) continue;
        const currentActive = activeByZone.get(target.id) ?? target.active;
        const enabled = node.type === 'enable-target'
          ? true : node.type === 'disable-target' ? false : !currentActive;
        activeByZone.set(target.id, enabled);
      }
      if (!passed) continue;
      continue;
    }
    events.push({ zoneId: entity.id, message: zone.message });
    if (!zone.targetEntityId || (zone.action !== 'enable-target' && zone.action !== 'toggle-target')) continue;
    const target = moved.find(candidate => candidate.id === zone.targetEntityId);
    if (!target) continue;
    const enabled = zone.action === 'enable-target' ? true : !(activeByZone.get(target.id) ?? target.active);
    activeByZone.set(target.id, enabled);
  }
  state.contacts = contacts;
  const actionResult = advancePlayerActions(
    moved.map(entity => activeByZone.has(entity.id) ? { ...entity, active: activeByZone.get(entity.id)! } : entity),
    player?.id, playerInput, state.actions, elapsedSeconds, actionMotion,
  );
  return {
    entities: actionResult.entities,
    events: [...events, ...actionResult.events],
    audioEvents: actionResult.audioEvents,
    hud: actionResult.hud,
    animationTargetId: player?.id ?? null,
    animationState,
  };
}
