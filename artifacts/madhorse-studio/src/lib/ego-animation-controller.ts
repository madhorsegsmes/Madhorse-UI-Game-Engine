import {
  createAnimationKeyframe,
  sampleGameAnimation,
  type GameAnimation,
} from './game-api';
import { getTransform, type SceneEntity } from './scene-model';

export const egoAnimationStates = [
  'idle', 'walk', 'run', 'attack', 'cast', 'shoot', 'drive', 'jump',
] as const;

export type EgoAnimationState = (typeof egoAnimationStates)[number];

export type EgoAnimationController = {
  id: string;
  name: string;
  targetEntityId: string;
  gameTypes: string[];
  defaultState: EgoAnimationState;
  states: Partial<Record<EgoAnimationState, string[]>>;
};

export type EgoAnimationPack = {
  animations: GameAnimation[];
  controller: EgoAnimationController;
};

function makeClip(
  name: string,
  target: SceneEntity,
  axis: 'x' | 'y' | 'z',
  amplitude: number,
  duration: number,
): GameAnimation {
  const transform = getTransform(target);
  const base = { ...transform.rotation };
  const keyframeAt = (time: number, offset: number) => createAnimationKeyframe(
    time,
    transform.position,
    { ...base, [axis]: base[axis] + offset },
  );
  return {
    id: crypto.randomUUID(),
    name: name.slice(0, 80),
    targetEntityId: target.id,
    duration,
    loop: true,
    keyframes: [
      keyframeAt(0, amplitude),
      keyframeAt(duration / 2, -amplitude),
      keyframeAt(duration, amplitude),
    ],
  };
}

function addStateClips(
  stateIds: Partial<Record<EgoAnimationState, string[]>>,
  animations: GameAnimation[],
  state: EgoAnimationState,
  targets: SceneEntity[],
  clipName: string,
  amplitude: number,
  duration: number,
  axis: 'x' | 'y' | 'z' = 'x',
) {
  const clips = targets.map(target =>
    makeClip(`Ego · ${clipName} · ${target.name}`, target, axis, amplitude, duration),
  );
  animations.push(...clips);
  stateIds[state] = [...(stateIds[state] ?? []), ...clips.map(clip => clip.id)];
}

/**
 * Creates editable transform clips and a small state map from the named parts
 * Ego already creates. This is an animation starter, not a skeletal retargeter.
 */
export function createEgoAnimationPack(
  entities: SceneEntity[],
  targetEntityId: string,
  gameTypes: readonly string[],
): EgoAnimationPack {
  const root = entities.find(entity => entity.id === targetEntityId);
  if (!root) throw new Error('Ego could not find the character to animate.');

  const parts = entities.filter(entity => entity.parentId === targetEntityId);
  const named = (pattern: RegExp, limit: number) =>
    parts.filter(entity => pattern.test(entity.name)).slice(0, limit);
  const rootOnly = [root];
  const torso = named(/chest|torso|abdomen|body|thorax/i, 1);
  const arms = named(/upper arm|forearm/i, 2);
  const legs = named(/thigh|calf|foreleg|hind leg|leg upper|leg lower|paw|hoof|talon/i, 8);
  const head = named(/head|muzzle/i, 1);
  const wings = named(/wing/i, 4);
  const tails = named(/tail|fin/i, 6);
  const bodySegments = named(/body segment/i, 8);
  const movingParts = [...new Map([...arms, ...legs, ...wings, ...tails, ...bodySegments].map(part => [part.id, part])).values()];
  const targetParts = (parts.length ? movingParts : []).length ? movingParts : rootOnly;
  const lowerCaseTypes = new Set(gameTypes.map(type => type.toLowerCase()));
  const animations: GameAnimation[] = [];
  const states: Partial<Record<EgoAnimationState, string[]>> = {};

  addStateClips(states, animations, 'idle', torso.length ? torso : rootOnly, 'Idle', 1.2, 2.4, 'z');
  if (tails.length) addStateClips(states, animations, 'idle', tails, 'Tail sway', 5, 2.1, 'y');
  if (wings.length) addStateClips(states, animations, 'idle', wings, 'Wing motion', 4, 1.4, 'z');
  addStateClips(states, animations, 'walk', legs.length ? legs : bodySegments.length ? bodySegments : targetParts, 'Walk', 14, 0.9);

  if (['rpg', 'sports', 'fighting', 'mmo', 'shooter', 'platformer'].some(type => lowerCaseTypes.has(type))) {
    addStateClips(states, animations, 'run', legs.length ? legs : targetParts, 'Run', 24, 0.62);
  }
  if (['rpg', 'fighting', 'mmo'].some(type => lowerCaseTypes.has(type))) {
    const creatureAttack = named(/claw|jaw|mandible|muzzle|beak|talon|fang/i, 2);
    addStateClips(states, animations, 'attack', arms.length ? arms.slice(-1) : creatureAttack.length ? creatureAttack : head.length ? head : rootOnly, 'Attack', 38, 0.42);
  }
  if (['rpg', 'mmo'].some(type => lowerCaseTypes.has(type))) {
    addStateClips(states, animations, 'cast', arms.length ? arms : wings.length ? wings : targetParts.slice(0, 2), 'Cast', 22, 0.8, 'y');
  }
  if (lowerCaseTypes.has('shooter')) {
    addStateClips(states, animations, 'shoot', arms.length ? arms.slice(-1) : targetParts.slice(0, 1), 'Shoot', 8, 0.24);
  }
  if (['racing', 'kart-racing', 'car-racing'].some(type => lowerCaseTypes.has(type))) {
    addStateClips(states, animations, 'drive', arms.length ? arms : targetParts.slice(0, 2), 'Drive', 5, 0.5, 'z');
  }
  if (lowerCaseTypes.has('platformer')) {
    addStateClips(states, animations, 'jump', legs.length ? legs : targetParts.slice(0, 2), 'Jump', 30, 0.5);
  }

  return {
    animations,
    controller: {
      id: crypto.randomUUID(),
      name: `Ego Animator · ${root.name}`.slice(0, 80),
      targetEntityId,
      gameTypes: [...new Set(gameTypes)].slice(0, 9),
      defaultState: 'idle',
      states,
    },
  };
}

export function isEgoAnimationControllerCollection(value: unknown): value is EgoAnimationController[] {
  if (!Array.isArray(value) || value.length > 100) return false;
  const ids = new Set<string>();
  return value.every(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
    const controller = item as EgoAnimationController;
    if (typeof controller.id !== 'string' || !controller.id || ids.has(controller.id) ||
        typeof controller.name !== 'string' || controller.name.length > 80 ||
        typeof controller.targetEntityId !== 'string' || !controller.targetEntityId ||
        !Array.isArray(controller.gameTypes) || controller.gameTypes.length > 9 ||
        !controller.gameTypes.every(type => typeof type === 'string' && type.length <= 40) ||
        !egoAnimationStates.includes(controller.defaultState) ||
        !controller.states || typeof controller.states !== 'object' || Array.isArray(controller.states)) return false;

    ids.add(controller.id);
    const stateEntries = Object.entries(controller.states);
    return stateEntries.length > 0 && stateEntries.length <= egoAnimationStates.length &&
      stateEntries.every(([state, animationIds]) =>
        egoAnimationStates.includes(state as EgoAnimationState) &&
        Array.isArray(animationIds) && animationIds.length <= 100 &&
        animationIds.every(animationId => typeof animationId === 'string' && animationId.length > 0),
      ) &&
      Array.isArray(controller.states[controller.defaultState]);
  });
}

export function applyEgoAnimationController(
  entities: SceneEntity[],
  animations: GameAnimation[],
  controller: EgoAnimationController,
  requestedState: string,
  elapsedSeconds: number,
): SceneEntity[] {
  const state = egoAnimationStates.includes(requestedState as EgoAnimationState)
    ? requestedState as EgoAnimationState
    : controller.defaultState;
  const stateNames = Object.keys(controller.states) as EgoAnimationState[];
  const resetClipIds = new Set(stateNames.flatMap(name => controller.states[name] ?? []));
  const byId = new Map(entities.map(entity => [entity.id, entity]));
  const animationById = new Map(animations.map(animation => [animation.id, animation]));
  const setRotation = (entityId: string, rotation: { x: number; y: number; z: number }) => {
    const entity = byId.get(entityId);
    if (!entity) return;
    const transform = getTransform(entity);
    const nextRotation = entityId === controller.targetEntityId
      ? { x: rotation.x, y: rotation.y, z: transform.rotation.z }
      : { ...rotation };
    byId.set(entityId, {
      ...entity,
      components: entity.components.map(component =>
        component.id === transform.id ? { ...transform, rotation: nextRotation } : component,
      ),
    });
  };

  // Reset tracks first so an old state cannot leave a limb stuck in its last pose.
  for (const clipId of resetClipIds) {
    const clip = animationById.get(clipId);
    const firstFrame = clip?.keyframes[0];
    if (clip && firstFrame) setRotation(clip.targetEntityId, firstFrame.rotation);
  }

  const activeClipIds = controller.states[state] ?? controller.states[controller.defaultState] ?? [];
  for (const clipId of activeClipIds) {
    const clip = animationById.get(clipId);
    if (!clip) continue;
    const time = clip.loop ? elapsedSeconds % clip.duration : Math.min(elapsedSeconds, clip.duration);
    setRotation(clip.targetEntityId, sampleGameAnimation(clip, time).rotation);
  }
  return entities.map(entity => byId.get(entity.id) ?? entity);
}
