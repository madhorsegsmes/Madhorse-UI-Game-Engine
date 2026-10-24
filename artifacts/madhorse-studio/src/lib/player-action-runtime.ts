import { createPhysicsComponent, createTransformComponent, getTransform, getWorldTransform, type SceneEntity, type Vector3 } from './scene-model';
import { playerActionDefinitions, type PlayerActionComponent, type PlayerActionName } from './player-action-model';
import { gameFeatureDefinitions, type GameFeatureComponent, type GameFeatureName } from './game-feature-model';
import type { AudioPlayStyle } from './game-audio';
import { advanceGenreAction, createGenreResources, type GenreResources } from './player-genre-actions';

export type ActionInput = { moveX: number; moveY: number; heldKeys?: readonly string[]; pressedKeys?: readonly string[] };
export type ActionAudioEvent = { action: AudioPlayStyle; clipAssetId: string | null; volume: number; pitch: number };
export type ActionHud = {
  playerId: string; player: string; mode: string; wood: number; planks: number; speed: number;
  controls: { action: PlayerActionName; key: string; label: string }[];
  extraControls: { key: string; label: string }[];
  showHealth: boolean; health: number; maxHealth: number;
  showInventory: boolean; inventoryText: string;
  resourceText: string;
  message: string;
};
type PlayerState = {
  baseScale: Vector3; groundZ: number; heading: number; driving: boolean; speed: number;
  wood: number; planks: number; coins: number; keys: number;
  health: number; maxHealth: number; spawn: Vector3; checkpoint: Vector3 | null;
  lastContactDamage: number; lastHealthUpdate: number;
  lastUse: Map<string, number>; lastMoveSound: number; wasCrouching: boolean; feedback: string;
  genre: GenreResources;
};
export type PlayerActionRuntimeState = {
  players: Map<string, PlayerState>; health: Map<string, number>;
  doors: Map<string, boolean>;
  orders: Map<string, Vector3>;
  effects: Map<string, { entity: SceneEntity; until: number }>; effectIds: Set<string>; builtCount: number;
};
export function createPlayerActionRuntimeState(): PlayerActionRuntimeState {
  return { players: new Map(), health: new Map(), doors: new Map(), orders: new Map(), effects: new Map(), effectIds: new Set(), builtCount: 0 };
}
export function getGameFeatures(entity: SceneEntity): GameFeatureComponent[] {
  return entity.components.filter((component): component is GameFeatureComponent =>
    component.type === 'gameFeature' && component.enabled,
  );
}
export function getGameFeature(entity: SceneEntity, kind: GameFeatureName) {
  return getGameFeatures(entity).find(feature => feature.kind === kind);
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
    const inventory = getGameFeature(entity, 'inventory');
    const healthFeature = getGameFeature(entity, 'health');
    const maxHealth = Number(healthFeature?.settings.maxHealth ?? 100);
    current = {
      baseScale: { ...transform.scale }, groundZ: transform.position.z,
      heading: transform.rotation.z * Math.PI / 180, driving: false, speed: 0,
      wood: Number(inventory?.settings.startingWood ?? actions.find(action => action.action === 'craft')?.settings.startingWood ?? 0),
      planks: Number(inventory?.settings.startingPlanks ?? actions.find(action => action.action === 'build')?.settings.startingPlanks ?? 0),
      coins: Number(inventory?.settings.startingCoins ?? 0), keys: Number(inventory?.settings.startingKeys ?? 0),
      health: Math.min(maxHealth, Number(healthFeature?.settings.startingHealth ?? maxHealth)),
      maxHealth, spawn: { ...transform.position }, checkpoint: null, lastContactDamage: -Infinity, lastHealthUpdate: 0,
      lastUse: new Map(), lastMoveSound: -Infinity, wasCrouching: false, feedback: '',
      genre: createGenreResources(actions),
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
  const block = actions.find(action => action.action === 'block');
  const held = new Set(input.heldKeys ?? []);
  if (!race) { current.driving = false; current.speed = 0; }
  if (race && input.pressedKeys?.includes(race.key)) {
    current.driving = !current.driving;
    current.speed = 0;
    current.feedback = current.driving ? 'Driving on: W/S accelerate and brake; A/D steer.' : 'Driving off: walking controls restored.';
  }
  const crouching = Boolean(crouch && held.has(crouch.key) && !current.driving);
  const running = Boolean(run && held.has(run.key) && !crouching && !current.driving);
  const blocking = Boolean(block && held.has(block.key) && !current.driving);
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
    current, actions, running, crouching, blocking, driving: current.driving, dx, dy,
    speedMultiplier: blocking ? block!.settings.speedMultiplier : crouching ? crouch!.settings.speedMultiplier : running ? run!.settings.speedMultiplier : 1,
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
function featureByKind(entity: SceneEntity, kind: GameFeatureName) {
  return entity.components.find((component): component is GameFeatureComponent =>
    component.type === 'gameFeature' && component.enabled && component.kind === kind,
  );
}
function targetMaxHealth(entity: SceneEntity) {
  return Number(featureByKind(entity, 'health')?.settings.maxHealth ?? 100);
}
function targetHealth(entity: SceneEntity, state: PlayerActionRuntimeState) {
  const savedHealth = state.health.get(entity.id);
  if (savedHealth !== undefined) return savedHealth;
  const feature = featureByKind(entity, 'health');
  return Math.min(targetMaxHealth(entity), Number(feature?.settings.startingHealth ?? targetMaxHealth(entity)));
}
function makeMarker(position: Vector3, color: string, size: number, state: PlayerActionRuntimeState, now: number, duration = 0.16) {
  // Keep transient graphics bounded, even when multiple actions are used quickly.
  if (state.effects.size >= 64) return;
  const id = `runtime-effect-${crypto.randomUUID()}`;
  const transform = createTransformComponent(position);
  transform.scale = { x: size, y: size, z: size };
  const entity: SceneEntity = {
    id, name: 'Action preview', active: true, parentId: null,
    components: [transform, { id: crypto.randomUUID(), type: 'primitive', enabled: true, shape: 'sphere', color, textureAssetId: null }],
  };
  state.effects.set(id, { entity, until: now + duration });
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
  let lastFeedback = current.feedback;
  const say = (message: string) => {
    current.feedback = message;
    if (lastFeedback !== message) events.push({ zoneId: player.id, message });
    lastFeedback = message;
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
    if (!input.pressedKeys?.includes(action.key) || ['run', 'crouch', 'race', 'block'].includes(action.action)) continue;
    if (now - (current.lastUse.get(action.id) ?? -Infinity) < (action.settings.cooldown ?? 0.3)) continue;
    current.lastUse.set(action.id, now);
    const genreResult = advanceGenreAction(action, next, player.id, position, current.heading, current, actions, state.orders);
    if (genreResult.handled) {
      next = genreResult.entities;
      if (genreResult.sound) emit(action);
      if (genreResult.message) say(genreResult.message);
      if (genreResult.marker) makeMarker({ ...genreResult.marker, z: genreResult.marker.z + 6 }, '#a2edbd', 0.4, state, now, 0.4);
      continue;
    }
    if (['fight', 'shoot', 'cast', 'play-card'].includes(action.action)) {
      const ammo = actions.find(item => item.action === 'reload');
      if (action.action === 'shoot' && ammo) {
        if (current.genre.ammo < 1) { say('Magazine empty. Press your Reload key.'); continue; }
        current.genre.ammo -= 1;
      }
      if (action.action === 'cast') {
        if (current.genre.mana < action.settings.manaCost) { say('Not enough mana. Wait for it to refill.'); continue; }
        current.genre.mana -= action.settings.manaCost;
      }
      if (action.action === 'play-card') {
        if (current.genre.hand < 1) { say('Your hand is empty. Draw a card first.'); continue; }
        if (current.genre.energy < action.settings.energyCost) { say('Not enough energy. End your turn to refill it.'); continue; }
      }
      const range = (action.action === 'fight' ? action.settings.reach : action.settings.range) * 10;
      let aim = { x: Math.sin(current.heading), y: Math.cos(current.heading) };
      const selectedTarget = action.targetId ? next.find(entity => entity.id === action.targetId && isPracticeTarget(entity, player.id, state.effectIds)) : undefined;
      if (selectedTarget && (action.action === 'shoot' || action.action === 'cast')) {
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
        (action.action === 'fight' || action.action === 'play-card'
          ? (!action.targetId || candidate.entity.id === action.targetId)
          : (!action.targetId || candidate.entity.id === action.targetId) &&
            candidate.projection >= 0 && candidate.offAxis <= Math.max(4, Math.max(candidate.target.scale.x, candidate.target.scale.y) * 5)),
      ).sort((a, b) => a.distance - b.distance);
      const hit = candidates[0];
      emit(action);
      if (action.action === 'shoot' || action.action === 'cast') {
        const shotLength = hit?.distance ?? range;
        for (let index = 1; index <= 12; index++) {
          const distance = shotLength * index / 12;
          makeMarker({ x: position.x + aim.x * distance, y: position.y + aim.y * distance, z: position.z + 5 }, action.action === 'cast' ? '#b384ff' : '#ffe8a3', 0.12, state, now);
        }
      } else {
        makeMarker({ x: position.x + aim.x * 8, y: position.y + aim.y * 8, z: position.z + 5 }, '#ff7854', 0.5, state, now);
      }
      if (hit) {
        if (action.action === 'play-card') {
          current.genre.hand -= 1;
          current.genre.energy -= action.settings.energyCost;
        }
        const maximumHealth = targetMaxHealth(hit.entity);
        const health = Math.max(0, targetHealth(hit.entity, state) - action.settings.damage);
        state.health.set(hit.entity.id, health);
        if (health === 0) next = next.map(entity => entity.id === hit.entity.id ? { ...entity, active: false } : entity);
        makeMarker({ ...hit.target.position, z: hit.target.position.z + 5 }, '#ff4d40', 0.4, state, now);
        say(`${hit.entity.name}: ${health}/${maximumHealth} health${health === 0 ? ' — defeated in this test' : ''}.`);
      } else say(action.action === 'play-card'
        ? 'No practice target in reach. Your card and energy were kept.'
        : action.action === 'cast' ? 'Spell cast — no target hit.'
          : action.action === 'shoot' ? 'Shot fired — no target hit.' : 'Swing — no target within reach.');
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
  const healthFeature = featureByKind(player, 'health');
  const spell = actions.find(action => action.action === 'cast');
  if (spell) {
    current.genre.mana = Math.min(current.genre.maxMana, current.genre.mana +
      spell.settings.regeneration * Math.min(0.05, Math.max(0, now - current.lastHealthUpdate)));
  }
  if (healthFeature && current.health < current.maxHealth) {
    current.health = Math.min(current.maxHealth, current.health + Number(healthFeature.settings.regeneration) * Math.min(0.05, now - (current.lastHealthUpdate ?? now)));
  }
  current.lastHealthUpdate = now;
  state.health.set(player.id, current.health);

  for (const entity of next) {
    const door = featureByKind(entity, 'door');
    if (door && entity.active && !state.doors.has(entity.id)) {
      const startsOpen = Boolean(door.settings.startsOpen);
      state.doors.set(entity.id, startsOpen);
      if (startsOpen) next = next.map(candidate => candidate.id === entity.id ? {
        ...candidate,
        components: candidate.components.map(component => component.type === 'transform'
          ? { ...component, rotation: { ...component.rotation, z: component.rotation.z + 90 } }
          : component),
      } : candidate);
    }
  }

  const interact = featureByKind(player, 'interact');
  const interactKey = interact ? String(interact.settings.key) : null;
  if (interact && interactKey && input.pressedKeys?.includes(interactKey) &&
      now - (current.lastUse.get(interact.id) ?? -Infinity) >= 0.25) {
    current.lastUse.set(interact.id, now);
    const reach = Number(interact.settings.range) * 10;
    const candidates = next.flatMap(entity => {
      if (entity.id === player.id || entity.isGroup) return [];
      const feature = getGameFeatures(entity).find(item =>
        ['pickup', 'door', 'checkpoint', 'message', 'visual-effect'].includes(item.kind) &&
        (entity.active || item.kind === 'door' && state.doors.get(entity.id) === true),
      );
      if (!feature) return [];
      const target = getWorldTransform(next, entity.id) ?? getTransform(entity);
      const distance = Math.hypot(target.position.x - position.x, target.position.y - position.y, target.position.z - position.z);
      return distance <= reach + Math.max(target.scale.x, target.scale.y) * 5 ? [{ entity, feature, target, distance }] : [];
    }).sort((left, right) => left.distance - right.distance);
    const picked = candidates[0];
    if (!picked) {
      say('Nothing close enough to use. Walk near an item, door, checkpoint, or sign.');
    } else {
      const { entity, feature, target } = picked;
      const playFeatureSound = (style: AudioPlayStyle) => {
        if (feature.volume && feature.volume > 0) audioEvents.push({
          action: style, clipAssetId: feature.clipAssetId ?? null, volume: feature.volume, pitch: 1,
        });
      };
      if (feature.kind === 'pickup') {
        const item = String(feature.settings.item);
        const amount = Number(feature.settings.amount);
        const maximum = item === 'keys' ? 99 : item === 'health' ? current.maxHealth : 999;
        if (item === 'wood') current.wood = Math.min(maximum, current.wood + amount);
        if (item === 'planks') current.planks = Math.min(maximum, current.planks + amount);
        if (item === 'coins') current.coins = Math.min(maximum, current.coins + amount);
        if (item === 'keys') current.keys = Math.min(maximum, current.keys + amount);
        if (item === 'health') current.health = Math.min(current.maxHealth, current.health + amount);
        next = next.map(candidate => candidate.id === entity.id ? { ...candidate, active: false } : candidate);
        playFeatureSound('craft');
        say(item === 'health'
          ? `Picked up ${amount} health. Health: ${current.health}/${current.maxHealth}.`
          : `Picked up ${amount} ${item}. Wood ${current.wood} · planks ${current.planks} · coins ${current.coins} · keys ${current.keys}.`);
      } else if (feature.kind === 'door') {
        const open = state.doors.get(entity.id) ?? false;
        const locked = Boolean(feature.settings.locked);
        if (!open && locked && current.keys < 1) {
          say('This door is locked. Find a key pickup first.');
        } else {
          if (!open && locked) current.keys -= 1;
          state.doors.set(entity.id, !open);
          next = next.map(candidate => candidate.id === entity.id ? {
            ...candidate,
            components: candidate.components.map(component => component.type === 'transform'
              ? { ...component, rotation: { ...component.rotation, z: component.rotation.z + (open ? -90 : 90) } }
              : component),
          } : candidate);
          playFeatureSound('build');
          say(open ? 'Door closed.' : `Door opened${locked ? ` · ${current.keys} keys left` : ''}.`);
        }
      } else if (feature.kind === 'checkpoint') {
        current.checkpoint = { ...target.position };
        if (feature.settings.restoreHealth) current.health = current.maxHealth;
        playFeatureSound('tone');
        say(`Checkpoint saved at ${entity.name}.`);
      } else if (feature.kind === 'message') {
        playFeatureSound('tone');
        say(String(feature.settings.text));
      } else if (feature.kind === 'visual-effect') {
        const radius = Number(feature.settings.size) * 10;
        const color = String(feature.settings.color);
        const duration = 1.2;
        for (let index = 0; index < 8; index++) {
          const angle = Math.PI * 2 * index / 8;
          makeMarker({
            x: target.position.x + Math.cos(angle) * radius,
            y: target.position.y + Math.sin(angle) * radius,
            z: target.position.z + 5 + (index % 2) * radius * 0.5,
          }, color, 0.35, state, now, duration);
        }
        playFeatureSound('tone');
        say(`Sparkle effect played at ${entity.name}.`);
      }
    }
  }

  for (const npc of next) {
    const npcHealth = featureByKind(npc, 'health');
    const npcController = npc.components.find(component => component.type === 'characterController' && component.role === 'npc');
    const damage = Number(npcHealth?.settings.contactDamage ?? 0);
    if (!npc.active || !npcController || damage < 1 || now - current.lastContactDamage < 1) continue;
    const npcPosition = getWorldTransform(next, npc.id)?.position ?? getTransform(npc).position;
    if (Math.hypot(npcPosition.x - position.x, npcPosition.y - position.y, npcPosition.z - position.z) > 12) continue;
    current.lastContactDamage = now;
    const block = actions.find(action => action.action === 'block');
    const receivedDamage = motion.blocking && block ? Math.round(damage * (1 - block.settings.damageReduction) * 100) / 100 : damage;
    current.health = Math.max(0, current.health - receivedDamage);
    state.health.set(player.id, current.health);
    if (motion.blocking && block) emit(block);
    say(`${motion.blocking ? 'Blocked' : 'Ouch!'} ${npc.name} dealt ${receivedDamage} damage. Health: ${current.health}/${current.maxHealth}.`);
    if (current.health === 0) {
      const respawnAt = current.checkpoint ?? current.spawn;
      next = next.map(candidate => candidate.id === player.id ? {
        ...candidate, active: true, components: candidate.components.map(component =>
          component.type === 'transform' ? { ...component, position: { ...respawnAt } } : component,
        ),
      } : candidate);
      current.health = current.maxHealth;
      state.health.set(player.id, current.health);
      say(current.checkpoint ? 'You respawned at your checkpoint.' : 'You respawned at your starting spot.');
    }
  }

  const statusBar = featureByKind(player, 'status-bar');
  const inventoryFeature = featureByKind(player, 'inventory');
  const showHealth = Boolean(statusBar?.settings.showHealth && healthFeature) || actions.some(action => action.action === 'heal' || action.action === 'block');
  const showInventory = Boolean(inventoryFeature) ||
    Boolean(statusBar?.settings.showInventory) ||
    actions.some(action => action.action === 'craft' || action.action === 'build' || action.action === 'gather');
  const showHud = actions.length > 0 || Boolean(interact) || Boolean(statusBar);
  return {
    entities: [...next, ...[...state.effects.values()].map(effect => effect.entity)], events, audioEvents,
    hud: showHud ? {
      playerId: player.id, player: player.name, mode: motion.driving ? 'Driving' : motion.blocking ? 'Blocking' : motion.crouching ? 'Crouching' : motion.running ? 'Running' : 'Walking',
      wood: current.wood, planks: current.planks, speed: Math.round(Math.abs(current.speed) * 3.6),
      controls: actions.map(action => ({ action: action.action, key: action.key, label: playerActionDefinitions[action.action].label })),
      extraControls: interact && interactKey ? [{ key: interactKey, label: 'Interact' }] : [],
      showHealth, health: current.health, maxHealth: current.maxHealth,
      showInventory, inventoryText: `Wood ${current.wood} · Planks ${current.planks} · Coins ${current.coins} · Keys ${current.keys}`,
      resourceText: [
        ...(spell ? [`Mana ${Math.floor(current.genre.mana)}/${current.genre.maxMana}`] : []),
        ...(actions.some(action => ['draw-card', 'play-card', 'end-turn'].includes(action.action))
          ? [`Turn ${current.genre.turn} · Hand ${current.genre.hand} · Deck ${current.genre.deck} · Energy ${current.genre.energy}/${current.genre.maxEnergy}`] : []),
        ...(actions.some(action => action.action === 'reload') ? [`Ammo ${current.genre.ammo} · Spare ${current.genre.reserveAmmo}`] : []),
      ].join(' | '),
      message: current.feedback,
    } : null,
  };
}
