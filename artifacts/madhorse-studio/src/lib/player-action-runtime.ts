import { createPhysicsComponent, createTransformComponent, getTransform, getWorldTransform, type SceneEntity, type Vector3 } from './scene-model';
import { playerActionDefinitions, type PlayerActionComponent, type PlayerActionName } from './player-action-model';
import { gameFeatureDefinitions, type GameFeatureComponent, type GameFeatureName } from './game-feature-model';
import type { AudioPlayStyle } from './game-audio';
import { advanceGenreAction, createGenreResources, type GenreResources } from './player-genre-actions';
import { firstPersonHit } from './fps-aim';
import { fighterAttackDuration, type FighterAttack, type FighterMotionEvent } from './fighter-playback';
import { advanceCartProgress, cartFeature, cartRaceText, createCartProgress, readCartCourse, type CartRaceProgress } from './cart-racer-runtime';

export type ActionInput = { moveX: number; moveY: number; heldKeys?: readonly string[]; pressedKeys?: readonly string[]; lookYaw?: number; lookPitch?: number };
export type ActionAudioEvent = { action: AudioPlayStyle; clipAssetId: string | null; volume: number; pitch: number };
export type ActionHud = {
  raceText?: string;
  playerId: string; player: string; mode: string; wood: number; planks: number; speed: number;
  controls: { action: PlayerActionName; key: string; label: string }[];
  extraControls: { key: string; label: string }[];
  showHealth: boolean; health: number; maxHealth: number;
  showInventory: boolean; inventoryText: string;
  resourceText: string;
  message: string;
  showFightingHud: boolean;
  matchStatus: string;
  opponentName: string;
  opponentHealth: number;
  opponentMaxHealth: number;
  comboCount: number;
  specialMeter: number;
  maxSpecialMeter: number;
};
type PlayerState = {
  raceProgress: CartRaceProgress | null;
  baseScale: Vector3; groundZ: number; heading: number; driving: boolean; speed: number;
  wood: number; planks: number; coins: number; keys: number;
  health: number; maxHealth: number; spawn: Vector3; checkpoint: Vector3 | null;
  lastContactDamage: number; lastHealthUpdate: number;
  lastUse: Map<string, number>; lastMoveSound: number; wasCrouching: boolean; feedback: string;
  genre: GenreResources;
  comboCount: number; lastComboAt: number; specialMeter: number; maxSpecialMeter: number;
  roundTime: number; roundNumber: number; playerRoundsWon: number; rivalRoundsWon: number;
  roundBreakUntil: number; matchOver: boolean; matchMessage: string; lastMatchTick: number;
  opponentId: string | null;
};
export type PlayerActionRuntimeState = {
  players: Map<string, PlayerState>; health: Map<string, number>;
  doors: Map<string, boolean>;
  orders: Map<string, Vector3>;
  effects: Map<string, { entity: SceneEntity; until: number }>; effectIds: Set<string>; builtCount: number;
  spawnPositions: Map<string, Vector3>;
  npcLastAttack: Map<string, number>;
  npcAttackCount: Map<string, number>;
  combatMotion: Map<string, FighterMotionEvent>;
  combatPositions: Map<string, Vector3>;
  bufferedAttacks: Map<string, { key: string; expires: number }>;
};
const FIGHTING_ATTACKS = new Set<PlayerActionName>(['fight', 'light-attack', 'heavy-attack', 'special-attack']);
const ROSTER_ATTACKS = new Set<PlayerActionName>(['light-attack', 'heavy-attack', 'special-attack']);

export function createPlayerActionRuntimeState(entities: SceneEntity[] = []): PlayerActionRuntimeState {
  const spawnPositions = new Map<string, Vector3>();
  for (const entity of entities) {
    if (entity.components.some(component =>
      component.type === 'characterController' && component.enabled && (component.role === 'player' || component.role === 'npc'),
    )) {
      spawnPositions.set(entity.id, { ...getTransform(entity).position });
    }
  }
  return {
    players: new Map(), health: new Map(), doors: new Map(), orders: new Map(),
    effects: new Map(), effectIds: new Set(), builtCount: 0, spawnPositions,
    npcLastAttack: new Map(), npcAttackCount: new Map(),
    combatMotion: new Map(), combatPositions: new Map(), bufferedAttacks: new Map(),
  };
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
      heading: (cartFeature(entity)?.settings.role==='player'?-1:1)*transform.rotation.z * Math.PI / 180,
      driving: cartFeature(entity)?.settings.role==='player' && cartFeature(entity)?.settings.startDriving===true, speed: 0,
      raceProgress:null,
      wood: Number(inventory?.settings.startingWood ?? actions.find(action => action.action === 'craft')?.settings.startingWood ?? 0),
      planks: Number(inventory?.settings.startingPlanks ?? actions.find(action => action.action === 'build')?.settings.startingPlanks ?? 0),
      coins: Number(inventory?.settings.startingCoins ?? 0), keys: Number(inventory?.settings.startingKeys ?? 0),
      health: Math.min(maxHealth, Number(healthFeature?.settings.startingHealth ?? maxHealth)),
      maxHealth, spawn: { ...transform.position }, checkpoint: null, lastContactDamage: -Infinity, lastHealthUpdate: 0,
      lastUse: new Map(), lastMoveSound: -Infinity, wasCrouching: false, feedback: '',
      genre: createGenreResources(actions),
      comboCount: 0, lastComboAt: -Infinity,
      specialMeter: Math.min(
        Number(actions.find(action => action.action === 'special-attack')?.settings.startingMeter ?? 0),
        Number(actions.find(action => action.action === 'special-attack')?.settings.meterMax ?? 100),
      ),
      maxSpecialMeter: Number(actions.find(action => action.action === 'special-attack')?.settings.meterMax ?? 100),
      roundTime: 99, roundNumber: 1, playerRoundsWon: 0, rivalRoundsWon: 0,
      roundBreakUntil: 0, matchOver: false, matchMessage: '', lastMatchTick: 0,
      opponentId: actions.find(action => ROSTER_ATTACKS.has(action.action) && action.targetId)?.targetId ?? null,
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
  const completedRace=cartFeature(player)?.settings.role==='player' && current.raceProgress?.finished;
  const automaticKart=cartFeature(player)?.settings.role==='player' && cartFeature(player)?.settings.startDriving===true;
  if(completedRace){current.driving=true;current.speed=0;}
  if (race && !completedRace && !automaticKart && input.pressedKeys?.includes(race.key)) {
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
    if (input.moveY && !completedRace) current.speed += input.moveY * acceleration * dt;
    else current.speed = Math.sign(current.speed) * Math.max(0, Math.abs(current.speed) - acceleration * 0.3 * dt);
    current.speed = Math.min(maxSpeed, Math.max(-maxSpeed / 3, current.speed));
    current.heading += input.moveX * turnSpeed * Math.PI / 180 * dt *
      Math.min(1, Math.abs(current.speed) / 2) * Math.sign(current.speed);
    dx = Math.sin(current.heading) * current.speed * dt * 10;
    dy = Math.cos(current.heading) * current.speed * dt * 10;
  } else if (input.lookYaw !== undefined) {
    current.heading = input.lookYaw * Math.PI / 180;
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
  const healthBearingNpcGroup = entity.isGroup &&
    entity.components.some(component => component.type === 'characterController' && component.enabled && component.role === 'npc') &&
    Boolean(featureByKind(entity, 'health'));
  return entity.id !== playerId && entity.active && (!entity.isGroup || healthBearingNpcGroup) && !effects.has(entity.id) &&
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
  const fightingActions = actions.filter(action => ROSTER_ATTACKS.has(action.action));
  const requestedAttack = fightingActions.find(action => input.pressedKeys?.includes(action.key));
  if (requestedAttack) state.bufferedAttacks.set(player.id, { key: requestedAttack.key, expires: now + .12 });
  if ((state.bufferedAttacks.get(player.id)?.expires ?? Infinity) < now) state.bufferedAttacks.delete(player.id);
  const opponentId = fightingActions.find(action => action.targetId)?.targetId ?? current.opponentId;
  const isFightingMatch = fightingActions.length > 0 && Boolean(opponentId);
  if (isFightingMatch) current.opponentId = opponentId;
  const awardRound = (winner: 'player' | 'rival', reason: string) => {
    if (!isFightingMatch || current.matchOver || current.roundBreakUntil > now) return;
    if (winner === 'player') current.playerRoundsWon += 1;
    else current.rivalRoundsWon += 1;
    const score = `${current.playerRoundsWon}–${current.rivalRoundsWon}`;
    const wonMatch = current.playerRoundsWon >= 2 || current.rivalRoundsWon >= 2;
    current.matchMessage = wonMatch
      ? `${winner === 'player' ? 'PLAYER' : 'RIVAL'} WINS THE MATCH · ${score}`
      : `${winner === 'player' ? 'PLAYER' : 'RIVAL'} WINS ROUND ${current.roundNumber} · ${reason} · ${score}`;
    current.matchOver = wonMatch;
    current.roundBreakUntil = wonMatch ? 0 : now + 2.4;
    current.comboCount = 0;
    say(current.matchMessage);
  };
  if (isFightingMatch) {
    if (!current.lastMatchTick) current.lastMatchTick = now;
    const tick = Math.min(0.25, Math.max(0, now - current.lastMatchTick));
    current.lastMatchTick = now;
    if (!current.matchOver && current.roundBreakUntil === 0) {
      current.roundTime = Math.max(0, current.roundTime - tick);
      if (current.roundTime === 0) {
        const rival = opponentId ? next.find(entity => entity.id === opponentId) : undefined;
        const rivalHealth = rival ? targetHealth(rival, state) : 0;
        awardRound(current.health >= rivalHealth ? 'player' : 'rival', 'TIME');
      }
    }
    if (!current.matchOver && current.roundBreakUntil > 0 && now >= current.roundBreakUntil) {
      const rival = opponentId ? next.find(entity => entity.id === opponentId) : undefined;
      current.roundNumber += 1;
      current.roundTime = 99;
      current.roundBreakUntil = 0;
      current.lastMatchTick = now;
      current.comboCount = 0;
      current.health = current.maxHealth;
      state.health.set(player.id, current.health);
      if (rival) state.health.set(rival.id, targetMaxHealth(rival));
      next = next.map(entity => {
        if (entity.id !== player.id && entity.id !== opponentId) return entity;
        const spawn = state.spawnPositions.get(entity.id);
        return {
          ...entity,
          active: true,
          components: spawn ? entity.components.map(component => component.type === 'transform'
            ? { ...component, position: { ...spawn } }
            : component) : entity.components,
        };
      });
      state.npcLastAttack.delete(opponentId ?? '');
      say(`ROUND ${current.roundNumber} — FIGHT!`);
    }
  }
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
    const buffered = ROSTER_ATTACKS.has(action.action) && state.bufferedAttacks.get(player.id)?.key === action.key;
    if ((!input.pressedKeys?.includes(action.key) && !buffered) || ['run', 'crouch', 'race', 'block'].includes(action.action)) continue;
    if (ROSTER_ATTACKS.has(action.action) && isFightingMatch &&
        (current.matchOver || current.roundBreakUntil > now)) continue;
    if (action.action === 'special-attack' && current.specialMeter < action.settings.meterCost) {
      say(`Need ${action.settings.meterCost} special meter. Land light or heavy hits to build it.`);
      continue;
    }
    if (now - (current.lastUse.get(action.id) ?? -Infinity) < (action.settings.cooldown ?? 0.3)) continue;
    current.lastUse.set(action.id, now);
    if (ROSTER_ATTACKS.has(action.action)) {
      state.bufferedAttacks.delete(player.id);
      state.combatMotion.set(player.id, { ...state.combatMotion.get(player.id),
        attack: { kind: action.action as FighterAttack, startedAt: now, duration: fighterAttackDuration(action.action as FighterAttack) } });
    }
    if (action.action === 'special-attack') current.specialMeter = Math.max(0, current.specialMeter - action.settings.meterCost);
    const genreResult = advanceGenreAction(action, next, player.id, position, current.heading, current, actions, state.orders);
    if (genreResult.handled) {
      next = genreResult.entities;
      if (genreResult.sound) emit(action);
      if (genreResult.message) say(genreResult.message);
      if (genreResult.marker) makeMarker({ ...genreResult.marker, z: genreResult.marker.z + 6 }, '#a2edbd', 0.4, state, now, 0.4);
      continue;
    }
    if (FIGHTING_ATTACKS.has(action.action) || ['shoot', 'cast', 'play-card'].includes(action.action)) {
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
      const range = (FIGHTING_ATTACKS.has(action.action) ? action.settings.reach : action.settings.range) * 10;
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
        (FIGHTING_ATTACKS.has(action.action) || action.action === 'play-card'
          ? (!action.targetId || candidate.entity.id === action.targetId)
          : (!action.targetId || candidate.entity.id === action.targetId) &&
            candidate.projection >= 0 && candidate.offAxis <= Math.max(4, Math.max(candidate.target.scale.x, candidate.target.scale.y) * 5)),
      ).sort((a, b) => a.distance - b.distance);
      const fpsShot = action.action === 'shoot' && input.lookYaw !== undefined;
      const impact = fpsShot ? firstPersonHit(next, player.id, input.lookYaw!, input.lookPitch ?? 0,
        action.settings.range, motion.crouching) : null;
      const hit = fpsShot ? candidates.find(candidate => candidate.entity.id === impact?.id) : candidates[0];
      emit(action);
      if (action.action === 'shoot' || action.action === 'cast') {
        const shotLength = fpsShot ? impact?.distance ?? range : hit?.distance ?? range;
        for (let index = 1; index <= 12; index++) {
          const distance = shotLength * index / 12;
          const pitch = (input.lookPitch ?? 0) * Math.PI / 180;
          makeMarker({
            x: position.x + aim.x * distance * (fpsShot ? Math.cos(pitch) : 1),
            y: position.y + aim.y * distance * (fpsShot ? Math.cos(pitch) : 1),
            z: position.z + (fpsShot ? (motion.crouching ? 9 : 16) + Math.sin(pitch) * distance : 5),
          }, action.action === 'cast' ? '#b384ff' : '#ffe8a3', 0.12, state, now);
        }
      } else {
        makeMarker({ x: position.x + aim.x * 8, y: position.y + aim.y * 8, z: position.z + 5 }, '#ff7854', 0.5, state, now);
      }
      if (hit) {
        if (action.action === 'play-card') {
          current.genre.hand -= 1;
          current.genre.energy -= action.settings.energyCost;
        }
        if (ROSTER_ATTACKS.has(action.action)) {
          current.comboCount = now - current.lastComboAt <= 1.2 ? current.comboCount + 1 : 1;
          current.lastComboAt = now;
          current.specialMeter = Math.min(current.maxSpecialMeter,
            current.specialMeter + Number(action.settings.meterGain ?? 0));
        }
        const maximumHealth = targetMaxHealth(hit.entity);
        const health = Math.max(0, targetHealth(hit.entity, state) - action.settings.damage);
        state.health.set(hit.entity.id, health);
        if (ROSTER_ATTACKS.has(action.action)) state.combatMotion.set(hit.entity.id, {
          ...state.combatMotion.get(hit.entity.id), hitAt: now,
        });
        if (health === 0) {
          if (isFightingMatch && hit.entity.id === opponentId) awardRound('player', 'KNOCKOUT');
          else next = next.map(entity => entity.id === hit.entity.id ? { ...entity, active: false } : entity);
        }
        const hitColor = action.action === 'special-attack' ? '#ffd36e'
          : action.action === 'heavy-attack' ? '#e7a06c' : '#ff4d40';
        makeMarker({ ...hit.target.position, z: hit.target.position.z + (ROSTER_ATTACKS.has(action.action) ? 13 : 5) },
          hitColor, ROSTER_ATTACKS.has(action.action) ? .09 : action.action === 'special-attack' ? .7 : .4,
          state, now, ROSTER_ATTACKS.has(action.action) ? .08 : .16);
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

  const rival = isFightingMatch && opponentId ? next.find(entity => entity.id === opponentId) : undefined;
  const rivalCanApproach = Boolean(rival?.components.some(component =>
    component.type === 'characterController' && component.enabled && component.role === 'npc' && component.behavior === 'follow-player',
  ));
  const rivalMoves = rival ? getPlayerActions(rival).filter(action => ROSTER_ATTACKS.has(action.action)) : [];
  if (isFightingMatch && rival && rivalCanApproach && rivalMoves.length > 0 &&
      !current.matchOver && current.roundBreakUntil <= now) {
    const rivalPosition = getWorldTransform(next, rival.id)?.position ?? getTransform(rival).position;
    const distance = Math.hypot(rivalPosition.x - position.x, rivalPosition.y - position.y);
    const attackIndex = state.npcAttackCount.get(rival.id) ?? 0;
    const cpuAction = rivalMoves[attackIndex % rivalMoves.length];
    const readyAt = state.npcLastAttack.get(rival.id) ?? -Infinity;
    if (distance <= cpuAction.settings.reach * 10 && now - readyAt >= cpuAction.settings.cooldown) {
      state.npcLastAttack.set(rival.id, now);
      state.npcAttackCount.set(rival.id, attackIndex + 1);
      state.combatMotion.set(rival.id, { ...state.combatMotion.get(rival.id),
        attack: { kind: cpuAction.action as FighterAttack, startedAt: now, duration: fighterAttackDuration(cpuAction.action as FighterAttack) } });
      state.combatMotion.set(player.id, { ...state.combatMotion.get(player.id), hitAt: now });
      const block = actions.find(action => action.action === 'block');
      const damage = Number(cpuAction.settings.damage);
      const receivedDamage = motion.blocking && block
        ? Math.round(damage * (1 - block.settings.damageReduction) * 100) / 100
        : damage;
      current.health = Math.max(0, current.health - receivedDamage);
      state.health.set(player.id, current.health);
      emit(cpuAction);
      makeMarker({ ...position, z: position.z + 13 }, motion.blocking ? '#9bcbf2' : '#e7a06c', .09, state, now, .08);
      say(`${motion.blocking ? 'BLOCKED' : 'RIVAL HIT'} · ${receivedDamage} damage · ${current.health}/${current.maxHealth} health`);
      if (current.health === 0) awardRound('rival', 'KNOCKOUT');
    }
  }

  for (const npc of next) {
    const npcHealth = featureByKind(npc, 'health');
    const npcController = npc.components.find(component => component.type === 'characterController' && component.role === 'npc');
    const damage = Number(npcHealth?.settings.contactDamage ?? 0);
    if (isFightingMatch && npc.id === opponentId) continue;
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
      if (isFightingMatch) {
        awardRound('rival', 'KNOCKOUT');
      } else {
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
  }

  const statusBar = featureByKind(player, 'status-bar');
  const inventoryFeature = featureByKind(player, 'inventory');
  const showHealth = Boolean(statusBar?.settings.showHealth && healthFeature) || actions.some(action => action.action === 'heal' || action.action === 'block');
  const showInventory = Boolean(inventoryFeature) ||
    Boolean(statusBar?.settings.showInventory) ||
    actions.some(action => action.action === 'craft' || action.action === 'build' || action.action === 'gather');
  const showHud = actions.length > 0 || Boolean(interact) || Boolean(statusBar);
  const hudRival = isFightingMatch && opponentId ? next.find(entity => entity.id === opponentId) : undefined;
  const score = `${current.playerRoundsWon}–${current.rivalRoundsWon}`;
  const matchStatus = current.matchOver
    ? current.matchMessage
    : current.roundBreakUntil > now
      ? `ROUND ${current.roundNumber} · ${score} · NEXT ROUND`
      : `ROUND ${current.roundNumber} · ${Math.ceil(current.roundTime)}s · ${score}`;
  const raceFeature=cartFeature(player);
  let raceText: string | undefined;
  if(raceFeature?.settings.role==='player'){
    const racePosition=getWorldTransform(next,player.id)?.position ?? position;
    const course=readCartCourse(next),laps=Number(raceFeature.settings.laps);
    const previous=current.raceProgress ?? createCartProgress(racePosition,now);
    current.raceProgress=advanceCartProgress(previous,racePosition,now,laps,course);
    raceText=cartRaceText(current.raceProgress,laps,course.gates.length);
    if(current.raceProgress.finished){current.speed=0;say('Race complete! Stop and restart Play/Test to race again.');}
  }else current.raceProgress=null;
  return {
    entities: [...next.map(entity => {
      if (!entity.components.some(component => component.type === 'playerAction' && component.enabled && ROSTER_ATTACKS.has(component.action))) return entity;
      const transform = getTransform(entity);
      const previous = state.combatPositions.get(entity.id);
      const moving = entity.id === player.id
        ? Math.hypot(input.moveX, input.moveY) > .01
        : Boolean(previous && Math.hypot(transform.position.x - previous.x, transform.position.y - previous.y) > .001);
      state.combatPositions.set(entity.id, { ...transform.position });
      return { ...entity, runtimePose: {
        ...state.combatMotion.get(entity.id), time: now, moving,
        blocking: entity.id === player.id && motion.blocking,
        defeated: (entity.id === player.id ? current.health : targetHealth(entity, state)) <= 0,
      } };
    }), ...[...state.effects.values()].map(effect => effect.entity)], events, audioEvents,
    hud: showHud ? {
      raceText,
      playerId: player.id, player: player.name, mode: motion.driving ? 'Driving' : motion.blocking ? 'Blocking' : motion.crouching ? 'Crouching' : motion.running ? 'Running' : 'Walking',
      wood: current.wood, planks: current.planks, speed: Math.round(Math.abs(current.speed) * 3.6),
      controls: actions.filter(action=>!(raceFeature?.settings.role==='player'&&raceFeature.settings.startDriving===true&&action.action==='race'))
        .map(action => ({ action: action.action, key: action.key, label: playerActionDefinitions[action.action].label })),
      extraControls: interact && interactKey ? [{ key: interactKey, label: 'Interact' }] : [],
      showHealth, health: current.health, maxHealth: current.maxHealth,
      showInventory, inventoryText: `Wood ${current.wood} · Planks ${current.planks} · Coins ${current.coins} · Keys ${current.keys}`,
      resourceText: [
        raceText,
        ...(spell ? [`Mana ${Math.floor(current.genre.mana)}/${current.genre.maxMana}`] : []),
        ...(actions.some(action => ['draw-card', 'play-card', 'end-turn'].includes(action.action))
          ? [`Turn ${current.genre.turn} · Hand ${current.genre.hand} · Deck ${current.genre.deck} · Energy ${current.genre.energy}/${current.genre.maxEnergy}`] : []),
        ...(actions.some(action => action.action === 'reload') ? [`Ammo ${current.genre.ammo} · Spare ${current.genre.reserveAmmo}`] : []),
      ].join(' | '),
      message: current.feedback,
       showFightingHud: isFightingMatch,
       matchStatus,
       opponentName: hudRival?.name ?? 'Rival',
       opponentHealth: hudRival ? targetHealth(hudRival, state) : 0,
       opponentMaxHealth: hudRival ? targetMaxHealth(hudRival) : 100,
       comboCount: current.comboCount,
       specialMeter: current.specialMeter,
       maxSpecialMeter: current.maxSpecialMeter,
    } : null,
  };
}
