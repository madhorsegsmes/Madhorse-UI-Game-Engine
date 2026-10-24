import {
  createPhysicsComponent,
  createSceneEntity,
  getPrimitive,
  getTransform,
  isSceneEntity,
  SCENE_ORIGIN,
  type PrimitiveShape,
  type SceneEntity,
  type TerrainBrushEdit,
  type TerrainSettings,
  type Vector3,
} from './scene-model';

export type TerrainToolAction = TerrainBrushEdit['action'];

export function appendTerrainBrushEdit(
  terrain: SceneEntity,
  action: TerrainToolAction,
): SceneEntity | null {
  const surface = getPrimitive(terrain);
  if (!surface || surface.shape !== 'terrain') return null;

  const settings: TerrainSettings = surface.terrainSettings ?? {
    width: 20,
    depth: 20,
    height: 12,
    mountainHeight: 12,
    riverDepth: 0,
    riverCount: 0,
  };
  const edits = surface.terrainEdits ?? [];
  if (edits.length >= 128) return null;

  const edit: TerrainBrushEdit = {
    id: crypto.randomUUID(),
    action,
    x: 0,
    z: 0,
    radius: Math.min(100, Math.max(0.5, Math.min(settings.width, settings.depth) * 0.28)),
    strength: action === 'smooth' ? 0.65 : 2,
  };
  const updated: SceneEntity = {
    ...terrain,
    components: terrain.components.map(component => component.id === surface.id
      ? { ...surface, terrainEdits: [...edits, edit] }
      : component),
  };
  return isSceneEntity(updated) ? updated : null;
}

export function createTerrainWater(terrain: SceneEntity): SceneEntity {
  const surface = getPrimitive(terrain);
  const settings = surface?.terrainSettings;
  const water = createSceneEntity('Water', { ...SCENE_ORIGIN, z: 55 }, terrain.id, false);
  const transform = getTransform(water);
  transform.scale = {
    x: (settings?.width ?? 20) / 10,
    y: (settings?.depth ?? 20) / 10,
    z: 1,
  };
  water.components = [
    transform,
    createPhysicsComponent('static'),
    {
      id: crypto.randomUUID(),
      type: 'primitive',
      enabled: true,
      shape: 'plane',
      color: '#429ed1',
      textureAssetId: null,
      opacity: 0.66,
      roughness: 0.24,
      metalness: 0.08,
    },
  ];
  return water;
}

export function createTerrainTreeGrove(terrain: SceneEntity): SceneEntity[] {
  const surface = getPrimitive(terrain);
  const spacing = Math.min(surface?.terrainSettings?.width ?? 20, surface?.terrainSettings?.depth ?? 20) * 0.12;
  const treeOrigin = { ...SCENE_ORIGIN, z: 50 };
  const grove = createSceneEntity('Tree Grove', treeOrigin, terrain.id, false);
  grove.components = [getTransform(grove)];
  grove.isGroup = true;

  const offsets: Array<[number, number]> = [[-spacing, -spacing * 0.35], [0, spacing * 0.4], [spacing, -spacing * 0.3]];
  const entities: SceneEntity[] = [grove];
  offsets.forEach(([x, y], index) => {
    const tree = createSceneEntity(`Tree ${index + 1}`, {
      x: SCENE_ORIGIN.x + x,
      y: SCENE_ORIGIN.y + y,
      z: 50,
    }, grove.id, false);
    tree.components = [getTransform(tree)];
    tree.isGroup = true;
    entities.push(tree);

    const trunkHeight = 1.8;
    entities.push(createPrimitivePart('Tree Trunk', tree.id, { ...SCENE_ORIGIN, z: 50 + trunkHeight * 5 }, 'cylinder', {
      x: 0.32, y: 0.32, z: trunkHeight,
    }, '#76502c'));
    entities.push(createPrimitivePart('Tree Canopy', tree.id, { ...SCENE_ORIGIN, z: 71 }, 'cone', {
      x: 1.2, y: 1.2, z: 1.7,
    }, '#3c8a47'));
  });
  return entities;
}

function createPrimitivePart(
  name: string,
  parentId: string,
  position: Vector3,
  shape: PrimitiveShape,
  scale: Vector3,
  color: string,
): SceneEntity {
  const entity = createSceneEntity(name, position, parentId, false);
  const transform = getTransform(entity);
  transform.scale = scale;
  entity.components = [
    transform,
    {
      id: crypto.randomUUID(),
      type: 'primitive',
      enabled: true,
      shape,
      color,
      textureAssetId: null,
    },
  ];
  return entity;
}
