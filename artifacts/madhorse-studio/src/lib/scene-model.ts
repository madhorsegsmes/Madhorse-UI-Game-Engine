export type Vector3 = { x: number; y: number; z: number };

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

export type PrimitiveShape = (typeof primitiveShapes)[number]['value'] | 'terrain';
export type TerrainSettings = {
  width: number;
  depth: number;
  height: number;
  mountainHeight: number;
  riverDepth: number;
  riverCount: number;
};

export type PrimitiveComponent = {
  id: string; type: 'primitive'; enabled: boolean;
  shape: PrimitiveShape; color: string; textureAssetId: string | null;
  terrainSettings?: TerrainSettings;
  opacity?: number;
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
export type EffectComponent = {
  id: string; type: 'effect'; enabled: boolean; color: string; intensity: number;
};
export type SceneComponent = TransformComponent | SpriteRendererComponent | ModelRendererComponent |
  PrimitiveComponent | LightComponent | CameraComponent | UICanvasComponent | PhysicsComponent | ScriptComponent | EffectComponent;

export type SceneEntity = {
  id: string;
  name: string;
  parentId: string | null;
  active: boolean;
  components: SceneComponent[];
  generatedBy?: 'mad-builder';
  isGroup?: boolean;
};

export type ProjectAsset = {
  id: string;
  name: string;
  kind: 'image' | 'model';
  mimeType: string;
  size: number;
  addedAt: string;
};

export type SpriteAssetKind = ProjectAsset['kind'] | null;

export const spriteComponentTypes = ['transform', 'spriteRenderer'] as const;

export function createTransformComponent(position: Vector3 = { x: 50, y: 50, z: 0 }): TransformComponent {
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
  position: Vector3 = { x: 50, y: 50, z: 0 },
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

export function isSceneComponent(value: unknown): value is SceneComponent {
  if (!value || typeof value !== 'object') return false;
  const item = value as SceneComponent;
  if (typeof item.id !== 'string') return false;
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
      (item.assetId === null || typeof item.assetId === 'string');
  }
  if (item.type === 'primitive') {
    const validTerrain = item.terrainSettings === undefined || isTerrainSettings(item.terrainSettings);
    return typeof item.enabled === 'boolean' &&
      (item.shape === 'terrain' || primitiveShapes.some(({ value }) => value === item.shape)) &&
      validTerrain && (item.shape === 'terrain' || item.terrainSettings === undefined) &&
      (item.opacity === undefined || Number.isFinite(item.opacity) && item.opacity >= .05 && item.opacity <= 1) &&
      /^#[0-9a-f]{6}$/i.test(item.color) && (item.textureAssetId === null || typeof item.textureAssetId === 'string');
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
  if (item.type === 'effect') return typeof item.enabled === 'boolean' &&
    /^#[0-9a-f]{6}$/i.test(item.color) && Number.isFinite(item.intensity) &&
    item.intensity >= 0 && item.intensity <= 10;
  if (item.type === 'physics') return isPhysicsComponent(item);
  return false;
}

export function isPhysicsComponent(value: unknown): value is PhysicsComponent {
  if (!value || typeof value !== 'object') return false;
  const component = value as PhysicsComponent;
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
    Number.isFinite(component.restitution) && component.restitution >= 0 && component.restitution <= 1;
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
  if (typeof entity.id !== 'string' || typeof entity.name !== 'string' ||
      (entity.parentId !== null && typeof entity.parentId !== 'string') ||
      typeof entity.active !== 'boolean' || !Array.isArray(entity.components) ||
      !entity.components.every(isSceneComponent)) return false;
  return entity.components.filter((component) => component.type === 'transform').length === 1 &&
    ['primitive', 'light', 'camera', 'uiCanvas', 'script', 'effect'].every((type) => entity.components.filter((component) => component.type === type).length <= 1) &&
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

export function isProjectAsset(value: unknown): value is ProjectAsset {
  if (!value || typeof value !== 'object') return false;
  const asset = value as ProjectAsset;
  return typeof asset.id === 'string' && typeof asset.name === 'string' &&
    (asset.kind === 'image' || asset.kind === 'model') &&
    typeof asset.mimeType === 'string' && Number.isFinite(asset.size) &&
    asset.size >= 0 && typeof asset.addedAt === 'string';
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

export function projectAssetKind(fileName: string, mimeType: string): SpriteAssetKind {
  const extension = fileName.slice(fileName.lastIndexOf('.')).toLowerCase();
  if (['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'].includes(extension) ||
      mimeType.startsWith('image/')) return 'image';
  if (['.glb', '.gltf', '.obj', '.fbx', '.dae'].includes(extension)) return 'model';
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
