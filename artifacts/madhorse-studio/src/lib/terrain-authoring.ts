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
import { createPrimitiveGeometry } from './scene-view-geometry';

export type TerrainToolAction = TerrainBrushEdit['action'];
export type TreeSpacing = 'close' | 'normal' | 'wide';
export type WaterCoverage = 'pond' | 'lake' | 'river' | 'full';
export type WaterLevel = 'low' | 'normal' | 'high';

export function appendTerrainBrushEdit(
  terrain: SceneEntity,
  action: TerrainToolAction,
  radius?: number,
  strength?: number,
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
    radius: Math.min(100, Math.max(0.5, radius ?? Math.min(settings.width, settings.depth) * 0.28)),
    strength: Math.min(10, Math.max(0.05, strength ?? (action === 'smooth' ? 0.65 : 2))),
  };
  const updated: SceneEntity = {
    ...terrain,
    components: terrain.components.map(component => component.id === surface.id
      ? { ...surface, terrainEdits: [...edits, edit] }
      : component),
  };
  return isSceneEntity(updated) ? updated : null;
}

export function createTerrainWater(
  terrain: SceneEntity,
  coverage: WaterCoverage = 'full',
  level: WaterLevel = 'normal',
): SceneEntity {
  const surface = getPrimitive(terrain);
  const settings = surface?.terrainSettings;
  const water = createSceneEntity('Water', { ...SCENE_ORIGIN, z: 50 + ({ low: 2, normal: 5, high: 8 }[level]) }, terrain.id, false);
  const transform = getTransform(water);
  const sizeX = (settings?.width ?? 20) / 10;
  const sizeY = (settings?.depth ?? 20) / 10;
  const coverageScale: Record<WaterCoverage, Vector3> = {
    pond: { x: 0.28, y: 0.28, z: 1 },
    lake: { x: 0.62, y: 0.62, z: 1 },
    river: { x: 0.92, y: 0.18, z: 1 },
    full: { x: 1, y: 1, z: 1 },
  };
  const selectedCoverage = coverageScale[coverage];
  transform.scale = {
    x: sizeX * selectedCoverage.x,
    y: sizeY * selectedCoverage.y,
    z: selectedCoverage.z,
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

export function createTerrainTreeGrove(
  terrain: SceneEntity,
  count = 3,
  spacingOption: TreeSpacing = 'normal',
): SceneEntity[] {
  const surface = getPrimitive(terrain);
  const spacing = {
    close: 3,
    normal: Math.min(surface?.terrainSettings?.width ?? 20, surface?.terrainSettings?.depth ?? 20) * 0.12,
    wide: 9,
  }[spacingOption];
  const geometry = createPrimitiveGeometry('terrain', surface?.terrainSettings, surface?.terrainEdits);
  const vertices = geometry.getAttribute('position');
  const surfaceHeight = (x: number, z: number) => {
    let closest = Infinity;
    let height = 0;
    for (let index = 0; index < vertices.count; index++) {
      const distance = Math.hypot(vertices.getX(index) - x, vertices.getZ(index) - z);
      if (distance < closest) {
        closest = distance;
        height = vertices.getY(index);
      }
    }
    return height;
  };
  // Parented transforms use 50 as their local origin on all three axes.
  const treeOrigin = { ...SCENE_ORIGIN, z: 50 };
  const grove = createSceneEntity('Tree Grove', treeOrigin, terrain.id, false);
  grove.components = [getTransform(grove)];
  grove.isGroup = true;

  const columns = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / columns);
  const offsets: Array<[number, number]> = Array.from({ length: count }, (_, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    return [
      (column - (columns - 1) / 2) * spacing,
      (row - (rows - 1) / 2) * spacing,
    ];
  });
  const entities: SceneEntity[] = [grove];
  offsets.forEach(([x, y], index) => {
    const tree = createSceneEntity(`Tree ${index + 1}`, {
      x: SCENE_ORIGIN.x + x * 10,
      y: SCENE_ORIGIN.y + y * 10,
      z: 50 + surfaceHeight(x, y) * 10,
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
  geometry.dispose();
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
