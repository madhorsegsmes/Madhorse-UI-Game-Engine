import { isPlayerActionComponent, type PlayerActionComponent } from './player-action-model';
import { isCollisionFilter } from './collision-layers';
import { DEFAULT_MODEL_LOD, isModelLodSettings, type ModelLodSettings } from './model-lod-settings';
import { isSceneEditorState, type SceneEditorState } from './scene-editor-state';
import { isGameFeatureComponent, type GameFeatureComponent } from './game-feature-model';
import { isPbrMaterialDefinition } from './pbr-material';
export type Vector3 = { x: number; y: number; z: number };
export const SCENE_ORIGIN: Vector3 = { x: 50, y: 50, z: 0 };

export type TransformComponent = {
  id: string;
  type: 'transform';
  enabled: true;
  position: Vector3;
  rotation: Vector3;
  scale: Vector3;
};

export type SpriteRendererComponent = {
  id: string;
  type: 'spriteRenderer';
  enabled: boolean;
  assetId: string | null;
  tint: string;
  width: number;
  height: number;
};

export type ModelRendererComponent = {
  id: string;
  type: 'modelRenderer';
  enabled: boolean;
  assetId: string | null;
  materialAssetId?: string | null;
  lod?: ModelLodSettings;
};

export type PhysicsBodyType = 'static' | 'dynamic' | 'kinematic';
export type PhysicsDimension = '2d' | '3d';
export type PhysicsComponent = {
  id: string;
  type: 'physics';
  enabled: boolean;
  bodyType: PhysicsBodyType;
  colliderEnabled: boolean;
  size: Vector3;
  mass: number;
  gravityScale: number;
  friction: number;
  restitution: number;
  collisionLayer?: number;
  collisionMask?: number;
  continuousCollision?: boolean;
  simulateInPlay?: boolean;
  initialVelocity?: Vector3;
};
export type PhysicsWorldSettings = {
  dimension: PhysicsDimension;
  gravity: Vector3;
};

export const primitiveShapes = [
  { value: 'cube', label: 'Cube' },
  { value: 'sphere', label: 'Sphere' },
  { value: 'capsule', label: 'Capsule' },
  { value: 'cylinder', label: 'Cylinder' },
  { value: 'cone', label: 'Cone' },
  { value: 'plane', label: 'Plane' },
  { value: 'circle', label: 'Circle' },
  { value: 'ring', label: 'Ring' },
  { value: 'torus', label: 'Torus' },
  { value: 'torus-knot', label: 'Torus Knot' },
  { value: 'icosahedron', label: 'Icosahedron' },
  { value: 'dodecahedron', label: 'Dodecahedron' },
  { value: 'octahedron', label: 'Octahedron' },
  { value: 'tetrahedron', label: 'Tetrahedron' },
  { value: 'pyramid', label: 'Pyramid' },
  { value: 'triangular-prism', label: 'Triangular Prism' },
  { value: 'wedge', label: 'Wedge' },
  { value: 'tube', label: 'Tube' },
  { value: 'hollow-cylinder', label: 'Hollow Cylinder' },
  { value: 'rounded-cube', label: 'Rounded Cube' },
] as const;

// Internal surface tools are persisted like primitives, but are not extra entries
// in the creator's twenty-shape picker.
export const vehicleSurfaceShapes = ['coupe-body', 'coupe-glazing', 'coupe-grille'] as const;
export type PrimitiveShape = (typeof primitiveShapes)[number]['value'] | 'terrain' | (typeof vehicleSurfaceShapes)[number];
export type TerrainSettings = {
  width: number;
  depth: number;
  height: number;
  mountainHeight: number;
  riverDepth: number;
  riverCount: number;
};
export type TerrainBrushEdit = {
  id: string;
  action: 'raise' | 'lower' | 'smooth';
  x: number;
  z: number;
  radius: number;
  strength: number;
};

export type PrimitiveComponent = {
  id: string; type: 'primitive'; enabled: boolean;
  shape: PrimitiveShape; color: string; textureAssetId: string | null;
  terrainSettings?: TerrainSettings;
  terrainEdits?: TerrainBrushEdit[];
  opacity?: number;
  roughness?: number;
  metalness?: number;
  materialAssetId?: string | null;
};
export type LightComponent = {
  id: string; type: 'light'; enabled: boolean;
  kind: 'point' | 'directional' | 'ambient'; color: string; intensity: number;
};
export type CameraComponent = {
  id: string; type: 'camera'; enabled: boolean; fov: number; target: Vector3;
  useTransformRotation?: boolean;
};
export const uiElementKinds = [
  { value: 'canvas', label: 'UI Canvas' },
  { value: 'panel', label: 'UI Panel' },
  { value: 'bar', label: 'UI Bar' },
  { value: 'button', label: 'UI Button' },
  { value: 'menu-screen', label: 'Full UI Menu Screen' },
] as const;
export type UIElementKind = (typeof uiElementKinds)[number]['value'];
export type UICanvasComponent = {
  id: string; type: 'uiCanvas'; enabled: boolean; controlId: string;
  kind?: UIElementKind; frame?: boolean;
};
export type ScriptComponent = {
  id: string; type: 'script'; enabled: boolean; scriptId: string;
};
export type GameAudioComponent = {
  id: string; type: 'gameAudio'; enabled: boolean; clipAssetId: string | null;
  volume: number; pitch: number; playOnStart: boolean;
};
export type PlayerWalkAudioComponent = {
  id: string; type: 'playerWalkAudio'; enabled: boolean; clipAssetId: string | null;
  volume: number; pitch: number; stepInterval: number;
};
export type EffectComponent = {
  id: string; type: 'effect'; enabled: boolean; color: string; intensity: number;
  style?: 'aura' | 'motes' | 'mist' | 'portal';
};
export type SkyboxComponent = {
  id: string; type: 'skybox'; enabled: boolean; color: string;
};
export type MultiplayerPluginComponent = {
  id: string;
  type: 'multiplayerPlugin';
  enabled: boolean;
  mode: 'player' | 'object' | 'event';
  eventName: string;
};
export type CharacterControllerComponent = {
  id: string;
  type: 'characterController';
  enabled: boolean;
  role: 'player' | 'npc';
  perspective: 'top-down' | 'third-person' | 'first-person';
  behavior: 'direct-control' | 'follow-player' | 'patrol';
  moveSpeed: number;
  jumpHeight: number;
  followDistance: number;
  patrolRadius: number;
};
export type VisualLogicNode =
  | { id: string; type: 'condition-item'; item: 'wood' | 'planks' | 'coins' | 'keys'; minimum: number; failMessage: string }
  | { id: string; type: 'message'; message: string }
  | { id: string; type: 'enable-target' | 'disable-target' | 'toggle-target'; targetEntityId: string | null };
export type TriggerZoneComponent = {
  id: string;
  type: 'triggerZone';
  enabled: boolean;
  shape: 'box' | 'sphere';
  size: Vector3;
  action: 'notify' | 'enable-target' | 'toggle-target';
  targetEntityId: string | null;
  message: string;
  logicNodes?: VisualLogicNode[];
};
export type StoryboardBeat = { id: string; title: string; note: string; complete: boolean };
export type StoryboardComponent = {
  id: string;
  type: 'storyboard';
  enabled: boolean;
  title: string;
  beats: StoryboardBeat[];
};
export type SceneComponent = TransformComponent | SpriteRendererComponent | ModelRendererComponent |
  PrimitiveComponent | LightComponent | CameraComponent | UICanvasComponent | PhysicsComponent | ScriptComponent |
  GameAudioComponent | PlayerWalkAudioComponent | PlayerActionComponent | GameFeatureComponent | EffectComponent |
  SkyboxComponent | MultiplayerPluginComponent | CharacterControllerComponent | TriggerZoneComponent | StoryboardComponent;

export type SceneEntity = {
  id: string;
  name: string;
  parentId: string | null;
  active: boolean;
  components: SceneComponent[];
  generatedBy?: 'mad-builder' | 'character-builder';
  isGroup?: boolean;
  /** Editor visibility/picking only. Never changes game activity or exports. */
  editor?: SceneEditorState;
  /** Temporary Play Test pose; never applied to saved scene transforms. */
  runtimePose?: import('./fighter-playback').FighterPlayback;
};

export type ProjectAsset = {
  id: string;
  name: string;
  kind: 'image' | 'model' | 'audio' | 'data' | 'pbr-material';
  mimeType: string;
  size: number;
  addedAt: string;
  data?: ScriptableObjectData;
  pbrMaterial?: import('./pbr-material').PbrMaterialDefinition;
};

export type ScriptableObjectField = {
  id: string;
  name: string;
  type: 'text' | 'number' | 'boolean';
  value: string | number | boolean;
};
export type ScriptableObjectData = {
  schemaVersion: 1;
  fields: ScriptableObjectField[];
};

export type ProjectAssetKind = ProjectAsset['kind'];
export type SpriteAssetKind = Exclude<ProjectAssetKind, 'audio'> | null;

export const spriteComponentTypes = ['transform', 'spriteRenderer'] as const;

export function createTransformComponent(position: Vector3 = SCENE_ORIGIN): TransformComponent {
  return {
    id: crypto.randomUUID(),
    type: 'transform',
    enabled: true,
    position: { ...position },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
  };
}

export function createSpriteRendererComponent(): SpriteRendererComponent {
  return {
    id: crypto.randomUUID(),
    type: 'spriteRenderer',
    enabled: true,
    assetId: null,
    tint: '#b73d34',
    width: 24,
    height: 24,
  };
}

export function createModelRendererComponent(assetId: string | null = null): ModelRendererComponent {
  return {
    id: crypto.randomUUID(),
    type: 'modelRenderer',
    enabled: true,
    assetId,
    lod: { ...DEFAULT_MODEL_LOD },
  };
}

export function createPhysicsComponent(
  bodyType: PhysicsBodyType = 'dynamic',
): PhysicsComponent {
  return {
    id: crypto.randomUUID(),
    type: 'physics',
    enabled: true,
    bodyType,
    colliderEnabled: true,
    size: { x: 24, y: 24, z: 24 },
    mass: 1,
    gravityScale: 1,
    friction: 0.4,
    restitution: 0,
    collisionLayer: 0,
    collisionMask: 63,
    continuousCollision: false,
    simulateInPlay: false,
  };
}

export function createDefaultPlayer(): SceneEntity {
  return {
    id: 'player',
    name: 'Player',
    parentId: null,
    active: true,
    components: [
      createTransformComponent(),
      createSpriteRendererComponent(),
      createPhysicsComponent('kinematic'),
    ],
  };
}

export const STARTER_CUBE_ID = 'starter-cube';

export function createStarterCube(): SceneEntity {
  const physics = createPhysicsComponent('static');
  physics.size = { x: 10, y: 10, z: 10 };
  return {
    id: STARTER_CUBE_ID,
    name: 'Cube',
    parentId: null,
    active: true,
    components: [
      createTransformComponent(),
      {
        id: crypto.randomUUID(),
        type: 'primitive',
        enabled: true,
        shape: 'cube',
        color: '#c1c4cb',
        textureAssetId: null,
      },
      physics,
    ],
  };
}

export function createSceneEntity(
  name: string,
  position: Vector3 = SCENE_ORIGIN,
  parentId: string | null = null,
  withSprite = true,
): SceneEntity {
  return {
    id: crypto.randomUUID(),
    name,
    parentId,
    active: true,
    components: [
      createTransformComponent(position),
      ...(withSprite ? [createSpriteRendererComponent()] : []),
      createPhysicsComponent(),
    ],
  };
}

export function getTransform(entity: SceneEntity): TransformComponent {
  const component = entity.components.find((entry): entry is TransformComponent => entry.type === 'transform');
  return component ?? createTransformComponent();
}

export function getSpriteRenderer(entity: SceneEntity): SpriteRendererComponent | undefined {
  return entity.components.find((entry): entry is SpriteRendererComponent => entry.type === 'spriteRenderer');
}

export function getModelRenderer(entity: SceneEntity): ModelRendererComponent | undefined {
  return entity.components.find((entry): entry is ModelRendererComponent => entry.type === 'modelRenderer');
}

export function getPhysicsComponent(entity: SceneEntity): PhysicsComponent | undefined {
  return entity.components.find((entry): entry is PhysicsComponent => entry.type === 'physics');
}

export function getPrimitive(entity: SceneEntity) {
  return entity.components.find((entry): entry is PrimitiveComponent => entry.type === 'primitive');
}
export function getLight(entity: SceneEntity) {
  return entity.components.find((entry): entry is LightComponent => entry.type === 'light');
}
export function getCamera(entity: SceneEntity) {
  return entity.components.find((entry): entry is CameraComponent => entry.type === 'camera');
}
export function getUICanvas(entity: SceneEntity) {
  return entity.components.find((entry): entry is UICanvasComponent => entry.type === 'uiCanvas');
}
export function getScriptComponent(entity: SceneEntity) {
  return entity.components.find((entry): entry is ScriptComponent => entry.type === 'script');
}
export function getEffect(entity: SceneEntity) {
  return entity.components.find((entry): entry is EffectComponent => entry.type === 'effect');
}

export function getTriggerZone(entity: SceneEntity) {
  return entity.components.find((entry): entry is TriggerZoneComponent => entry.type === 'triggerZone');
}

export function createStoryboardComponent(title = 'New Storyboard'): StoryboardComponent {
  return { id: crypto.randomUUID(), type: 'storyboard', enabled: true, title, beats: [] };
}

export function getSkybox(entity: SceneEntity) {
  return entity.components.find((entry): entry is SkyboxComponent => entry.type === 'skybox');
}

export function isSceneComponent(value: unknown): value is SceneComponent {
  if (!value || typeof value !== 'object') return false;
  const item = value as SceneComponent;
  if (typeof item.id !== 'string') return false;
  if (item.type === 'playerAction') return isPlayerActionComponent(item);
  if (item.type === 'gameFeature') return isGameFeatureComponent(item);
  if (item.type === 'transform') {
    return item.enabled === true &&
      isVector(item.position) && isVector(item.rotation) && isVector(item.scale) &&
      item.scale.x > 0 && item.scale.y > 0 && item.scale.z > 0;
  }
  if (item.type === 'spriteRenderer') {
    return typeof item.enabled === 'boolean' &&
      (item.assetId === null || typeof item.assetId === 'string') &&
      /^#[0-9a-f]{6}$/i.test(item.tint) &&
      Number.isFinite(item.width) && item.width > 0 && item.width <= 512 &&
      Number.isFinite(item.height) && item.height > 0 && item.height <= 512;
  }
  if (item.type === 'modelRenderer') {
    return typeof item.enabled === 'boolean' &&
      (item.assetId === null || typeof item.assetId === 'string') &&
      (item.materialAssetId === undefined || item.materialAssetId === null || typeof item.materialAssetId === 'string') &&
      (item.lod === undefined || isModelLodSettings(item.lod));
  }
  if (item.type === 'primitive') {
    const validTerrain = item.terrainSettings === undefined || isTerrainSettings(item.terrainSettings);
    const validTerrainEdits = item.terrainEdits === undefined ||
      Array.isArray(item.terrainEdits) && item.terrainEdits.length <= 128 &&
      item.terrainEdits.every(isTerrainBrushEdit);
    return typeof item.enabled === 'boolean' &&
      (item.shape === 'terrain' || primitiveShapes.some(({ value }) => value === item.shape) ||
        vehicleSurfaceShapes.some((value) => value === item.shape)) &&
      validTerrain && validTerrainEdits &&
      (item.shape === 'terrain' || (item.terrainSettings === undefined && item.terrainEdits === undefined)) &&
      (item.roughness === undefined || Number.isFinite(item.roughness) && item.roughness >= 0 && item.roughness <= 1) &&
      (item.metalness === undefined || Number.isFinite(item.metalness) && item.metalness >= 0 && item.metalness <= 1) &&
      (item.opacity === undefined || Number.isFinite(item.opacity) && item.opacity >= .05 && item.opacity <= 1) &&
      /^#[0-9a-f]{6}$/i.test(item.color) && (item.textureAssetId === null || typeof item.textureAssetId === 'string') &&
      (item.materialAssetId === undefined || item.materialAssetId === null || typeof item.materialAssetId === 'string');
  }
  if (item.type === 'light') {
    return typeof item.enabled === 'boolean' && ['point', 'directional', 'ambient'].includes(item.kind) &&
      /^#[0-9a-f]{6}$/i.test(item.color) && Number.isFinite(item.intensity) && item.intensity >= 0 && item.intensity <= 100;
  }
  if (item.type === 'camera') {
    return typeof item.enabled === 'boolean' && Number.isFinite(item.fov) &&
      (item.useTransformRotation === undefined || typeof item.useTransformRotation === 'boolean') &&
      item.fov >= 10 && item.fov <= 100 && isVector(item.target);
  }
  if (item.type === 'uiCanvas') return typeof item.enabled === 'boolean' && typeof item.controlId === 'string' &&
    (item.kind === undefined || uiElementKinds.some(kind => kind.value === item.kind)) &&
    (item.frame === undefined || typeof item.frame === 'boolean');
  if (item.type === 'script') return typeof item.enabled === 'boolean' &&
    typeof item.scriptId === 'string' && item.scriptId.length > 0 && item.scriptId.length <= 128;
  if (item.type === 'gameAudio') return typeof item.enabled === 'boolean' &&
    (item.clipAssetId === null || typeof item.clipAssetId === 'string') &&
    Number.isFinite(item.volume) && item.volume >= 0 && item.volume <= 1 &&
    Number.isFinite(item.pitch) && item.pitch >= 0.25 && item.pitch <= 2 &&
    typeof item.playOnStart === 'boolean';
  if (item.type === 'playerWalkAudio') return typeof item.enabled === 'boolean' &&
    (item.clipAssetId === null || typeof item.clipAssetId === 'string') &&
    Number.isFinite(item.volume) && item.volume >= 0 && item.volume <= 1 &&
    Number.isFinite(item.pitch) && item.pitch >= 0.25 && item.pitch <= 2 &&
    Number.isFinite(item.stepInterval) && item.stepInterval >= 0.15 && item.stepInterval <= 2;
  if (item.type === 'effect') return typeof item.enabled === 'boolean' &&
    /^#[0-9a-f]{6}$/i.test(item.color) && Number.isFinite(item.intensity) &&
    item.intensity >= 0 && item.intensity <= 10 &&
    (item.style === undefined || ['aura', 'motes', 'mist', 'portal'].includes(item.style));
  if (item.type === 'multiplayerPlugin') return typeof item.enabled === 'boolean' &&
    ['player', 'object', 'event'].includes(item.mode) &&
    typeof item.eventName === 'string' && item.eventName.length <= 80;
  if (item.type === 'characterController') return typeof item.enabled === 'boolean' &&
    (item.role === 'player' || item.role === 'npc') &&
    (item.perspective === 'top-down' || item.perspective === 'third-person' || item.perspective === 'first-person') &&
    (item.behavior === 'direct-control' || item.behavior === 'follow-player' || item.behavior === 'patrol') &&
    Number.isFinite(item.moveSpeed) && item.moveSpeed >= 0 && item.moveSpeed <= 40 &&
    Number.isFinite(item.jumpHeight) && item.jumpHeight >= 0 && item.jumpHeight <= 20 &&
    Number.isFinite(item.followDistance) && item.followDistance >= 0 && item.followDistance <= 100 &&
    Number.isFinite(item.patrolRadius) && item.patrolRadius >= 0 && item.patrolRadius <= 100;
  if (item.type === 'skybox') return typeof item.enabled === 'boolean' && /^#[0-9a-f]{6}$/i.test(item.color);
  if (item.type === 'triggerZone') return typeof item.enabled === 'boolean' &&
    (item.shape === 'box' || item.shape === 'sphere') &&
    isVector(item.size) && item.size.x > 0 && item.size.x <= 100 &&
    item.size.y > 0 && item.size.y <= 100 && item.size.z > 0 && item.size.z <= 100 &&
    (item.action === 'notify' || item.action === 'enable-target' || item.action === 'toggle-target') &&
    (item.targetEntityId === null || typeof item.targetEntityId === 'string') &&
    typeof item.message === 'string' && item.message.length <= 160 &&
    (item.logicNodes === undefined || Array.isArray(item.logicNodes) && item.logicNodes.length <= 16 &&
      item.logicNodes.every(node => {
        if (!node || typeof node.id !== 'string' || node.id.length > 80) return false;
        if (node.type === 'condition-item') return ['wood', 'planks', 'coins', 'keys'].includes(node.item) &&
          Number.isInteger(node.minimum) && node.minimum >= 1 && node.minimum <= 999 &&
          typeof node.failMessage === 'string' && node.failMessage.length <= 160;
        if (node.type === 'message') return typeof node.message === 'string' && node.message.length <= 160;
        if (node.type === 'enable-target' || node.type === 'disable-target' || node.type === 'toggle-target')
          return node.targetEntityId === null || typeof node.targetEntityId === 'string';
        return false;
      }) && new Set(item.logicNodes.map(node => node.id)).size === item.logicNodes.length);
  if (item.type === 'storyboard') return typeof item.enabled === 'boolean' &&
    typeof item.title === 'string' && item.title.trim().length > 0 && item.title.length <= 100 &&
    Array.isArray(item.beats) && item.beats.length <= 30 &&
    item.beats.every(beat => Boolean(beat) && typeof beat.id === 'string' && beat.id.length > 0 && beat.id.length <= 80 &&
      typeof beat.title === 'string' && beat.title.trim().length > 0 && beat.title.length <= 100 &&
      typeof beat.note === 'string' && beat.note.length <= 300 && typeof beat.complete === 'boolean') &&
    new Set(item.beats.map(beat => beat.id)).size === item.beats.length;
  if (item.type === 'physics') return isPhysicsComponent(item);
  return false;
}

export function isPhysicsComponent(value: unknown): value is PhysicsComponent {
  if (!value || typeof value !== 'object') return false;
  const component = value as PhysicsComponent;
  const initialVelocity = component.initialVelocity;
  if (initialVelocity !== undefined && (!initialVelocity || typeof initialVelocity !== 'object' ||
    !(['x', 'y', 'z'] as const).every(axis =>
      Number.isFinite(initialVelocity[axis]) && Math.abs(initialVelocity[axis]) <= 100_000))) return false;
  return typeof component.id === 'string' &&
    component.type === 'physics' &&
    typeof component.enabled === 'boolean' &&
    ['static', 'dynamic', 'kinematic'].includes(component.bodyType) &&
    typeof component.colliderEnabled === 'boolean' &&
    isVector(component.size) &&
    component.size.x >= 0.1 && component.size.x <= 512 &&
    component.size.y >= 0.1 && component.size.y <= 512 &&
    component.size.z >= 0.1 && component.size.z <= 512 &&
    Number.isFinite(component.mass) && component.mass >= 0.01 && component.mass <= 1000 &&
    Number.isFinite(component.gravityScale) && component.gravityScale >= -10 && component.gravityScale <= 10 &&
    Number.isFinite(component.friction) && component.friction >= 0 && component.friction <= 1 &&
    Number.isFinite(component.restitution) && component.restitution >= 0 && component.restitution <= 1 &&
    isCollisionFilter(component) &&
    (component.continuousCollision === undefined || typeof component.continuousCollision === 'boolean') &&
    (component.simulateInPlay === undefined || typeof component.simulateInPlay === 'boolean');
}

export function createDefaultPhysicsWorldSettings(
  dimension: PhysicsDimension = '2d',
): PhysicsWorldSettings {
  return {
    dimension,
    gravity: dimension === '2d'
      ? { x: 0, y: -9.81, z: 0 }
      : { x: 0, y: 0, z: -9.81 },
  };
}

export function isPhysicsWorldSettings(value: unknown): value is PhysicsWorldSettings {
  if (!value || typeof value !== 'object') return false;
  const settings = value as PhysicsWorldSettings;
  return (settings.dimension === '2d' || settings.dimension === '3d') &&
    isVector(settings.gravity) &&
    Math.abs(settings.gravity.x) <= 1000 &&
    Math.abs(settings.gravity.y) <= 1000 &&
    Math.abs(settings.gravity.z) <= 1000;
}

export function isSceneEntity(value: unknown): value is SceneEntity {
  if (!value || typeof value !== 'object') return false;
  const entity = value as SceneEntity;
  if (entity.editor !== undefined && !isSceneEditorState(entity.editor)) return false;
  if (typeof entity.id !== 'string' || typeof entity.name !== 'string' ||
      (entity.parentId !== null && typeof entity.parentId !== 'string') ||
      typeof entity.active !== 'boolean' || !Array.isArray(entity.components) ||
      !entity.components.every(isSceneComponent)) return false;
  const actions = entity.components.filter(component => component.type === 'playerAction');
  const enabledActions = actions.filter(component => component.enabled);
  const features = entity.components.filter(component => component.type === 'gameFeature');
  const enabledInteractions = features.filter(component => component.enabled && component.kind === 'interact');
  const enabledKeys = [
    ...enabledActions.map(component => component.key),
    ...enabledInteractions.map(component => String(component.settings.key)),
  ];
  return new Set(actions.map(component => component.action)).size === actions.length &&
    new Set(features.map(component => component.kind)).size === features.length &&
    new Set(enabledKeys).size === enabledKeys.length &&
    new Set(enabledActions.map(component => component.key)).size === enabledActions.length &&
    entity.components.filter((component) => component.type === 'transform').length === 1 &&
    ['primitive', 'light', 'camera', 'uiCanvas', 'script', 'effect', 'skybox', 'characterController', 'triggerZone', 'storyboard'].every((type) => entity.components.filter((component) => component.type === type).length <= 1) &&
    entity.components.filter((component) => component.type === 'spriteRenderer').length <= 1 &&
    entity.components.filter((component) => component.type === 'modelRenderer').length <= 1 &&
    entity.components.filter((component) => component.type === 'physics').length <= 1;
}

export function isSceneGraph(values: unknown[]): values is SceneEntity[] {
  if (!values.every(isSceneEntity)) return false;
  const entities = values as SceneEntity[];
  const ids = new Set(entities.map((entity) => entity.id));
  if (ids.size !== entities.length) return false;
  for (const entity of entities) {
    if (entity.parentId && (!ids.has(entity.parentId) || entity.parentId === entity.id)) return false;
    if (isDescendant(entities, entity.id, entity.id)) return false;
  }
  return true;
}

export function isAssetCollection(values: unknown[]): values is ProjectAsset[] {
  if (!values.every(isProjectAsset)) return false;
  return new Set(values.map((asset) => asset.id)).size === values.length;
}

export function createScriptableObjectAsset(): ProjectAsset {
  const data: ScriptableObjectData = {
    schemaVersion: 1,
    fields: [
      { id: crypto.randomUUID(), name: 'displayName', type: 'text', value: 'New Item' },
      { id: crypto.randomUUID(), name: 'value', type: 'number', value: 0 },
      { id: crypto.randomUUID(), name: 'enabled', type: 'boolean', value: true },
    ],
  };
  return {
    id: crypto.randomUUID(),
    name: 'New Scriptable Object',
    kind: 'data',
    mimeType: 'application/x-madhorse-scriptable-object',
    size: JSON.stringify(data).length,
    addedAt: new Date().toISOString(),
    data,
  };
}

export function isProjectAsset(value: unknown): value is ProjectAsset {
  if (!value || typeof value !== 'object') return false;
  const asset = value as ProjectAsset;
  if (typeof asset.id !== 'string' || typeof asset.name !== 'string' ||
      !['image', 'model', 'audio', 'data', 'pbr-material'].includes(asset.kind) ||
      typeof asset.mimeType !== 'string' || !Number.isFinite(asset.size) ||
      asset.size < 0 || typeof asset.addedAt !== 'string') return false;
  if (asset.kind === 'pbr-material') {
    const material = asset.pbrMaterial;
    return asset.mimeType === 'application/x-madhorse-pbr-material+json' &&
      material !== undefined && isPbrMaterialDefinition(material) &&
      asset.size === JSON.stringify(material).length && asset.data === undefined;
  }
  if (asset.kind !== 'data') return asset.data === undefined && asset.pbrMaterial === undefined;
  return asset.pbrMaterial === undefined &&
    asset.mimeType === 'application/x-madhorse-scriptable-object' &&
    isScriptableObjectData(asset.data) && asset.size === JSON.stringify(asset.data).length;
}


export function isScriptableObjectData(value: unknown): value is ScriptableObjectData {
  if (!value || typeof value !== 'object') return false;
  const data = value as ScriptableObjectData;
  if (Object.keys(data).length !== 2 || data.schemaVersion !== 1 ||
      !Array.isArray(data.fields) || data.fields.length > 50) return false;
  const ids = new Set<string>();
  const names = new Set<string>();
  return data.fields.every(field => {
    if (!field || typeof field !== 'object' || typeof field.id !== 'string' || !field.id ||
        ids.has(field.id) || typeof field.name !== 'string' || !field.name.trim() ||
        field.name.length > 50 || Object.keys(field).length !== 4) return false;
    ids.add(field.id);
    const key = field.name.trim().toLowerCase();
    if (names.has(key)) return false;
    names.add(key);
    if (field.type === 'text') return typeof field.value === 'string' && field.value.length <= 5000;
    if (field.type === 'number') return typeof field.value === 'number' && Number.isFinite(field.value) &&
      field.value >= -1_000_000_000 && field.value <= 1_000_000_000;
    return field.type === 'boolean' && typeof field.value === 'boolean';
  });
}

function isVector(value: unknown): value is Vector3 {
  if (!value || typeof value !== 'object') return false;
  const vector = value as Vector3;
  return Number.isFinite(vector.x) && Number.isFinite(vector.y) && Number.isFinite(vector.z);
}

function isTerrainSettings(value: unknown): value is TerrainSettings {
  if (!value || typeof value !== 'object') return false;
  const settings = value as TerrainSettings;
  return Number.isFinite(settings.width) && settings.width >= 1 && settings.width <= 500 &&
    Number.isFinite(settings.depth) && settings.depth >= 1 && settings.depth <= 500 &&
    Number.isFinite(settings.height) && settings.height >= 0 && settings.height <= 100 &&
    Number.isFinite(settings.mountainHeight) && settings.mountainHeight >= 0 && settings.mountainHeight <= 100 &&
    Number.isFinite(settings.riverDepth) && settings.riverDepth >= 0 && settings.riverDepth <= 50 &&
    Number.isInteger(settings.riverCount) && settings.riverCount >= 0 && settings.riverCount <= 10;
}

function isTerrainBrushEdit(value: unknown): value is TerrainBrushEdit {
  if (!value || typeof value !== 'object') return false;
  const edit = value as TerrainBrushEdit;
  return typeof edit.id === 'string' && edit.id.length > 0 && edit.id.length <= 128 &&
    ['raise', 'lower', 'smooth'].includes(edit.action) &&
    Number.isFinite(edit.x) && Math.abs(edit.x) <= 500 &&
    Number.isFinite(edit.z) && Math.abs(edit.z) <= 500 &&
    Number.isFinite(edit.radius) && edit.radius >= 0.5 && edit.radius <= 100 &&
    Number.isFinite(edit.strength) && edit.strength >= 0.05 && edit.strength <= 10;
}

export function projectAssetKind(fileName: string, mimeType: string): ProjectAssetKind | null {
  const extension = fileName.slice(fileName.lastIndexOf('.')).toLowerCase();
  if (['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'].includes(extension) ||
      mimeType.startsWith('image/')) return 'image';
  if (['.glb', '.gltf', '.obj', '.fbx', '.dae'].includes(extension)) return 'model';
  if (['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'].includes(extension) ||
      mimeType.startsWith('audio/')) return 'audio';
  return null;
}

export function isDescendant(entities: SceneEntity[], parentId: string, candidateId: string): boolean {
  let current = entities.find((entity) => entity.id === candidateId);
  const visited = new Set<string>();
  while (current?.parentId) {
    if (visited.has(current.id)) return true;
    visited.add(current.id);
    if (current.parentId === parentId) return true;
    current = entities.find((entity) => entity.id === current?.parentId);
  }
  return false;
}

export function getWorldTransform(
  entities: SceneEntity[],
  entityId: string,
  visited: Set<string> = new Set(),
): TransformComponent | null {
  if (visited.has(entityId)) return null;
  const entity = entities.find((entry) => entry.id === entityId);
  if (!entity) return null;
  const local = getTransform(entity);
  if (!entity.parentId) return local;

  const nextVisited = new Set(visited);
  nextVisited.add(entityId);
  const parentWorld = getWorldTransform(entities, entity.parentId, nextVisited);
  if (!parentWorld) return local;
  const radians = parentWorld.rotation.z * Math.PI / 180;
  const offsetX = (local.position.x - 50) * parentWorld.scale.x;
  const offsetY = (local.position.y - 50) * parentWorld.scale.y;
  const position = {
    x: parentWorld.position.x + offsetX * Math.cos(radians) - offsetY * Math.sin(radians),
    y: parentWorld.position.y + offsetX * Math.sin(radians) + offsetY * Math.cos(radians),
    z: parentWorld.position.z + (local.position.z - 50) * parentWorld.scale.z,
  };
  return {
    ...local,
    position,
    rotation: {
      x: parentWorld.rotation.x + local.rotation.x,
      y: parentWorld.rotation.y + local.rotation.y,
      z: parentWorld.rotation.z + local.rotation.z,
    },
    scale: {
      x: parentWorld.scale.x * local.scale.x,
      y: parentWorld.scale.y * local.scale.y,
      z: parentWorld.scale.z * local.scale.z,
    },
  };
}

export function localTransformFromWorld(
  entities: SceneEntity[],
  world: TransformComponent,
  parentId: string | null,
): Pick<TransformComponent, 'position' | 'rotation' | 'scale'> {
  if (!parentId) {
    return {
      position: { ...world.position },
      rotation: { ...world.rotation },
      scale: { ...world.scale },
    };
  }
  const parent = getWorldTransform(entities, parentId);
  if (!parent || parent.scale.x === 0 || parent.scale.y === 0 || parent.scale.z === 0) {
    return {
      position: { ...world.position },
      rotation: { ...world.rotation },
      scale: { ...world.scale },
    };
  }
  const radians = -parent.rotation.z * Math.PI / 180;
  const dx = world.position.x - parent.position.x;
  const dy = world.position.y - parent.position.y;
  const rotatedX = dx * Math.cos(radians) - dy * Math.sin(radians);
  const rotatedY = dx * Math.sin(radians) + dy * Math.cos(radians);
  return {
    position: {
      x: 50 + rotatedX / parent.scale.x,
      y: 50 + rotatedY / parent.scale.y,
      z: 50 + (world.position.z - parent.position.z) / parent.scale.z,
    },
    rotation: {
      x: world.rotation.x - parent.rotation.x,
      y: world.rotation.y - parent.rotation.y,
      z: world.rotation.z - parent.rotation.z,
    },
    scale: {
      x: world.scale.x / parent.scale.x,
      y: world.scale.y / parent.scale.y,
      z: world.scale.z / parent.scale.z,
    },
  };
}
