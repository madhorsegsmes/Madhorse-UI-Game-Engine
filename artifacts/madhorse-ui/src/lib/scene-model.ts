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

export type SceneComponent = TransformComponent | SpriteRendererComponent | ModelRendererComponent;

export type SceneEntity = {
  id: string;
  name: string;
  parentId: string | null;
  active: boolean;
  components: SceneComponent[];
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

export function createDefaultPlayer(): SceneEntity {
  return {
    id: 'player',
    name: 'Player',
    parentId: null,
    active: true,
    components: [
      createTransformComponent(),
      createSpriteRendererComponent(),
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
  return false;
}

export function isSceneEntity(value: unknown): value is SceneEntity {
  if (!value || typeof value !== 'object') return false;
  const entity = value as SceneEntity;
  if (typeof entity.id !== 'string' || typeof entity.name !== 'string' ||
      (entity.parentId !== null && typeof entity.parentId !== 'string') ||
      typeof entity.active !== 'boolean' || !Array.isArray(entity.components) ||
      !entity.components.every(isSceneComponent)) return false;
  return entity.components.filter((component) => component.type === 'transform').length === 1 &&
    entity.components.filter((component) => component.type === 'spriteRenderer').length <= 1 &&
    entity.components.filter((component) => component.type === 'modelRenderer').length <= 1;
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
