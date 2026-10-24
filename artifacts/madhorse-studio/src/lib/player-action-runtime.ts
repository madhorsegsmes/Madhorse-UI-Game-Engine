import { createPhysicsComponent, createTransformComponent, getTransform, getWorldTransform, type SceneEntity, type Vector3 } from './scene-model';
import { playerActionDefinitions, type PlayerActionComponent, type PlayerActionName } from './player-action-model';

export type ActionInput = { moveX: number; moveY: number; heldKeys?: readonly string[]; pressedKeys?: readonly string[] };
export type ActionAudioEvent = { action: PlayerActionName; clipAssetId: string | null; volume: number; pitch: number };
export type ActionHud = {
  playerId: string; player: string; mode: string; wood: number; planks: number; speed: number;
  controls: { action: PlayerActionName; key: string; label: string }[];
  message: string;
};
type PlayerState = {
  baseScale: Vector3; groundZ: number; heading: number; driving: boolean; speed: number;
  wood: number; planks: number; lastUse: Map<string, number>; lastMoveSound: number;
  wasCrouching: boolean; feedback: string;
};
export type PlayerActionRuntimeState = {
  players: Map<string, PlayerState>; health: Map<string, number>;
  effects: Map<string, { entity: SceneEntity; until: number }>; effectIds: Set<string>; builtCount: number;
};
export function createPlayerActionRuntimeState(): PlayerActionRuntimeState {
  return { players: new Map(), health: new Map(), effects: new Map(), effectIds: new Set(), builtCount: 0 };
}
export function getPlayerActions(entity: SceneEntity): PlayerActionComponent[] {
  return entity.components.filter((component): component is PlayerActionComponent =>
    component.type === 'playerAction' && component.enabled,
  );
}
function getPlayerState(entity: SceneEntity, state: PlayerActionRuntimeState) {
  let current = state.players.get(entity.id);
  if (!current) {
    const transform = getTransform(entity);
    const actions = getPlayerActions(entity);
    current = {
      baseScale: { ...transform.scale }, groundZ: transform.position.z,
      heading: transform.rotation.z * Math.PI / 180, driving: false, speed: 0,
      wood: actions.find(action => action.action === 'craft')?.settings.startingWood ?? 0,
      planks: actions.find(action => action.action === 'build')?.settings.startingPlanks ?? 0,
      lastUse: new Map(), lastMoveSound: -Infinity, wasCrouching: false, feedback: '',
    };
    state.players.set(entity.id, current);
  }
  return current;
}
export function resolveActionMovement(
  player: SceneEntity, input: ActionInput, state: PlayerActionRuntimeState, dt: number,
) {
  const current = getPlayerState(player, state);
  const actions = getPlayerActions(player);
  const run = actions.find(action => action.action === 'run');
  const crouch = actions.find(action => action.action === 'crouch');
  const race = actions.find(action => action.action === 'race');
  const held = new Set(input.heldKeys ?? []);
  if (!race) { current.driving = false; current.speed = 0; }
  if (race && input.pressedKeys?.includes(race.key)) {
    current.driving = !current.driving;
    current.speed = 0;
    current.feedback = current.driving ? 'Driving on: W/S accelerate and brake; A/D steer.' : 'Driving off: walking controls restored.';
  }
  const crouching = Boolean(crouch && held.has(crouch.key) && !current.driving);
  const running = Boolean(run && held.has(run.key) && !crouching && !current.driving);
  let dx = 0; let dy = 0;
  if (race && current.driving) {
    const { acceleration, maxSpeed, turnSpeed } = race.settings;
    if (input.moveY) current.speed += input.moveY * acceleration * dt;
    else current.speed = Math.sign(current.speed) * Math.max(0, Math.abs(current.speed) - acceleration * 0.3 * dt);
    current.speed = Math.min(maxSpeed, Math.max(-maxSpeed / 3, current.speed));
    current.heading += input.moveX * turnSpeed * Math.PI / 180 * dt *
      Math.min(1, Math.abs(current.speed) / 2) * Math.sign(current.speed);
    dx = Math.sin(current.heading) * current.speed * dt * 10;
    dy = Math.cos(current.heading) * current.speed * dt * 10;
  } else if (Math.hypot(input.moveX, input.moveY) > 0) {
    current.heading = Math.atan2(input.moveX, input.moveY);
  }
  return {
    current, actions, running, crouching, driving: current.driving, dx, dy,
    speedMultiplier: crouching ? crouch!.settings.speedMultiplier : running ? run!.settings.speedMultiplier : 1,
    heightMultiplier: crouching ? crouch!.settings.heightMultiplier : 1,
  };
}
export type ActionMotion = ReturnType<typeof resolveActionMovement>;

function isPracticeTarget(entity: SceneEntity, playerId: string, effects: Set<string>) {
  return entity.id !== playerId && entity.active && !entity.isGroup && !effects.has(entity.id) &&
    !entity.components.some(component => component.type === 'characterController' && component.role === 'player') &&
    entity.components.some(component =>
      (component.type === 'primitive' && component.enabled && !['plane', 'terrain'].includes(component.shape)) ||
      (component.type === 'modelRenderer' && component.enabled) ||
      (component.type === 'spriteRenderer' && component.enabled),
    );
}
function makeMarker(position: Vector3, color: string, size: number, state: PlayerActionRuntimeState, now: number) {
  // Keep transient graphics bounded, even when multiple actions are used quickly.
  if (state.effects.size >= 64) return;
  const id = `runtime-effect-${crypto.randomUUID()}`;
  const transform = createTransformComponent(position);
  transform.scale = { x: size, y: size, z: size };
  const entity: SceneEntity = {
    id, name: 'Action preview', active: true, parentId: null,
    components: [transform, { id: crypto.randomUUID(), type: 'primitive', enabled: true, shape: 'sphere', color, textureAssetId: null }],
  };
  state.effects.set(id, { entity, until: now + 0.16 });
  state.effectIds.add(id);
}

export function advancePlayerActions(
  entities: SceneEntity[], playerId: string | undefined, input: ActionInput,
  state: PlayerActionRuntimeState, now: number, motion: ActionMotion | null,
): { entities: SceneEntity[]; events: { zoneId: string; message: string }[]; audioEvents: ActionAudioEvent[]; hud: ActionHud | null } {
  let next = entities.filter(entity => !state.effectIds.has(entity.id));
  for (const [id, effect] of state.effects) {
    if (effect.until <= now) { state.effects.delete(id); state.effectIds.delete(id); }
  }
  const player = next.find(entity => entity.id === playerId);
  const events: { zoneId: string; message: string }[] = [];
  const audioEvents: ActionAudioEvent[] = [];
  if (!player || !motion) return { entities: [...next, ...[...state.effects.values()].map(effect => effect.entity)], events, audioEvents, hud: null };
  const { current, actions } = motion;
  const position = getWorldTransform(next, player.id)?.position ?? getTransform(player).position;
  const emit = (action: PlayerActionComponent, pitch = 1) => {
    if (action.volume > 0) audioEvents.push({ action: action.action, volume: action.volume, clipAssetId: action.clipAssetId, pitch });
  };
  const say = (message: string) => {
    current.feedback = message;
    events.push({ zoneId: player.id, message });
  };
  const moving = motion.driving ? Math.abs(current.speed) > 0.2 : Math.hypot(input.moveX, input.moveY) > 0;
  const movementSound = actions.find(action => motion.driving ? action.action === 'race' : motion.running ? action.action === 'run' : motion.crouching ? action.action === 'crouch' : false);
  if (movementSound && moving && Math.abs(position.z - current.groundZ) < 0.5 && now - current.lastMoveSound >= (motion.running ? 0.23 : 0.4)) {
    emit(movementSound, motion.driving ? Math.min(2, 0.6 + Math.abs(current.speed) / movementSound.settings.maxSpeed) : 1);
    current.lastMoveSound = now;
  }
  if (motion.crouching && !current.wasCrouching && !moving) {
    const crouch = actions.find(action => action.action === 'crouch');
    if (crouch) emit(crouch);
  }
  current.wasCrouching = motion.crouching;
  for (const action of actions) {
    if (!input.pressedKeys?.includes(action.key) || ['run', 'crouch', 'race'].includes(action.action)) continue;
    if (now - (current.lastUse.get(action.id) ?? -Infinity) < (action.settings.cooldown ?? 0.3)) continue;
    current.lastUse.set(action.id, now);
    if (action.action === 'fight' || action.action === 'shoot') {
      const range = (action.action === 'fight' ? action.settings.reach : action.settings.range) * 10;
      let aim = { x: Math.sin(current.heading), y: Math.cos(current.heading) };
      const selectedTarget = action.targetId ? next.find(entity => entity.id === action.targetId && isPracticeTarget(entity, player.id, state.effectIds)) : undefined;
      if (selectedTarget && action.action === 'shoot') {
        const targetPosition = getWorldTransform(next, selectedTarget.id)?.position ?? getTransform(selectedTarget).position;
        const length = Math.hypot(targetPosition.x - position.x, targetPosition.y - position.y) || 1;
        aim = { x: (targetPosition.x - position.x) / length, y: (targetPosition.y - position.y) / length };
      }
      const candidates = next.filter(entity => isPracticeTarget(entity, player.id, state.effectIds)).map(entity => {
        const target = getWorldTransform(next, entity.id) ?? getTransform(entity);
        const dx = target.position.x - position.x; const dy = target.position.y - position.y;
        const distance = Math.hypot(dx, dy);
        const projection = dx * aim.x + dy * aim.y;
        const offAxis = Math.abs(dx * aim.y - dy * aim.x);
        return { entity, target, distance, projection, offAxis };
      }).filter(candidate => candidate.distance <= range &&
        Math.abs(candidate.target.position.z - position.z) <= Math.max(20, candidate.target.scale.z * 10) &&
        (action.action === 'fight'
          ? (!action.targetId || candidate.entity.id === action.targetId)
          : candidate.projection >= 0 && candidate.offAxis <= Math.max(4, Math.max(candidate.target.scale.x, candidate.target.scale.y) * 5)),
      ).sort((a, b) => a.distance - b.distance);
      const hit = candidates[0];
      emit(action);
      if (action.action === 'shoot') {
        const shotLength = hit?.distance ?? range;
        for (let index = 1; index <= 12; index++) {
          const distance = shotLength * index / 12;
          makeMarker({ x: position.x + aim.x * distance, y: position.y + aim.y * distance, z: position.z + 5 }, '#ffe8a3', 0.12, state, now);
        }
      } else {
        makeMarker({ x: position.x + aim.x * 8, y: position.y + aim.y * 8, z: position.z + 5 }, '#ff7854', 0.5, state, now);
      }
      if (hit) {
        const health = Math.max(0, (state.health.get(hit.entity.id) ?? 100) - action.settings.damage);
        state.health.set(hit.entity.id, health);
        if (health === 0) next = next.map(entity => entity.id === hit.entity.id ? { ...entity, active: false } : entity);
        makeMarker({ ...hit.target.position, z: hit.target.position.z + 5 }, '#ff4d40', 0.4, state, now);
        say(`${hit.entity.name}: ${health}/100 health${health === 0 ? ' — defeated in this test' : ''}.`);
      } else say(action.action === 'shoot' ? 'Shot fired — no target hit.' : 'Swing — no target within reach.');
    } else if (action.action === 'craft') {
      if (current.wood < action.settings.woodCost) { say('Not enough wood to craft planks.'); continue; }
      if (current.planks + action.settings.planksMade > 999) { say('Your plank inventory is full.'); continue; }
      current.wood -= action.settings.woodCost;
      current.planks += action.settings.planksMade;
      emit(action);
      say(`Crafted ${action.settings.planksMade} planks. Wood: ${current.wood}; planks: ${current.planks}.`);
    } else if (action.action === 'build') {
      if (current.planks < action.settings.plankCost) { say('Not enough planks. Craft more with your Crafting key.'); continue; }
      if (state.builtCount >= 100 || next.length >= 4000) { say('This test has reached its 100-block or scene-size limit. Stop and restart to reset.'); continue; }
      const size = action.settings.blockSize;
      const grid = size * 10;
      const destination = {
        x: 50 + Math.round((position.x - 50 + Math.sin(current.heading) * action.settings.distance * 10) / grid) * grid,
        y: 50 + Math.round((position.y - 50 + Math.cos(current.heading) * action.settings.distance * 10) / grid) * grid,
        z: current.groundZ,
      };
      const blocked = next.some(entity => {
        if (!isPracticeTarget(entity, player.id, state.effectIds)) return false;
        const target = getWorldTransform(next, entity.id) ?? getTransform(entity);
        return Math.abs(destination.z - target.position.z) < (size + target.scale.z) * 5 &&
          Math.abs(destination.x - target.position.x) < (size + target.scale.x) * 5 &&
          Math.abs(destination.y - target.position.y) < (size + target.scale.y) * 5;
      });
      if (Math.hypot(destination.x - position.x, destination.y - position.y) < (size + 1) * 5 || blocked) {
        say('That spot is blocked or too close. Move to an open spot before building.'); continue;
      }
      const transform = createTransformComponent(destination);
      transform.scale = { x: size, y: size, z: size };
      const physics = createPhysicsComponent('static');
      physics.size = { x: 10, y: 10, z: 10 };
      next.push({
        id: `runtime-build-${crypto.randomUUID()}`, name: `Built Block ${++state.builtCount}`,
        active: true, parentId: null, components: [
          transform, physics,
          { id: crypto.randomUUID(), type: 'primitive', enabled: true, shape: 'cube', color: '#9b7553', textureAssetId: null },
        ],
      });
      current.planks -= action.settings.plankCost;
      emit(action);
      say(`Block placed. ${current.planks} planks left. This test building is temporary.`);
    }
  }
  return {
    entities: [...next, ...[...state.effects.values()].map(effect => effect.entity)], events, audioEvents,
    hud: actions.length ? {
      playerId: player.id, player: player.name, mode: motion.driving ? 'Driving' : motion.crouching ? 'Crouching' : motion.running ? 'Running' : 'Walking',
      wood: current.wood, planks: current.planks, speed: Math.round(Math.abs(current.speed) * 3.6),
      controls: actions.map(action => ({ action: action.action, key: action.key, label: playerActionDefinitions[action.action].label })),
      message: current.feedback,
    } : null,
  };
}
