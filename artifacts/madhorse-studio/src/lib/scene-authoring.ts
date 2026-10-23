import {
  createSceneEntity, getTransform, getWorldTransform, isDescendant, isSceneGraph,
  type SceneEntity,
} from './scene-model';
import { isUIControlCollection, type UIControlElement } from './ui-controls';
import { withSystemActivity } from './system-activity';

export type SceneElementKind = 'object' | 'plane' | 'terrain' | 'light' | 'camera';
export type ScenePrefab = {
  id: string; name: string; entities: SceneEntity[]; rootId: string;
  uiControls: UIControlElement[];
};
export type GeneratedAssetOptions = {
  kind: 'cube' | 'sprite' | 'texture'; name: string;
  color: string; secondaryColor: string; pattern: 'solid' | 'checker'; size: number;
};

export function createSceneElement(kind: SceneElementKind, entities: SceneEntity[]): SceneEntity {
  const square = getWorldTransform(entities, 'player')?.position ?? { x: 50, y: 50, z: 0 };
  const name = { object: 'Object', plane: 'Plane', terrain: 'Terrain', light: 'Light', camera: 'Camera' }[kind];
  const ordinal = entities.filter((entity) => entity.name.startsWith(name)).length + 1;
  const position = kind === 'camera' ? { x: square.x, y: square.y - 35, z: square.z + 45 }
    : kind === 'light' ? { x: square.x + 20, y: square.y - 20, z: square.z + 50 }
    : { ...square, x: kind === 'object' ? square.x + 15 : square.x };
  const entity = createSceneEntity(`${name} ${ordinal}`, position, null, false);
  if (kind === 'light') entity.components.push({
    id: crypto.randomUUID(), type: 'light', enabled: true, kind: 'point', color: '#fff0d6', intensity: 20,
  });
  else if (kind === 'camera') entity.components.push({
    id: crypto.randomUUID(), type: 'camera', enabled: true, fov: 50, target: { ...square },
  });
  else entity.components.push({
    id: crypto.randomUUID(), type: 'primitive', enabled: true,
    shape: kind === 'object' ? 'cube' : kind, color: kind === 'terrain' ? '#62745b' : '#aeb0b4', textureAssetId: null,
  });
  return entity;
}

export function capturePrefab(entities: SceneEntity[], rootId: string, name: string, controls: UIControlElement[]): ScenePrefab {
  const root = entities.find((entity) => entity.id === rootId);
  if (!root || !name.trim() || name.trim().length > 80) throw new Error('Select an object and enter a prefab name.');
  const copied = structuredClone(entities.filter((entity) => entity.id === rootId || isDescendant(entities, rootId, entity.id)));
  const copiedRoot = copied.find((entity) => entity.id === rootId)!;
  const world = getWorldTransform(entities, rootId)!;
  copiedRoot.parentId = null;
  Object.assign(getTransform(copiedRoot), world);
  const controlIds = new Set(copied.flatMap((entity) => entity.components.flatMap((component) =>
    component.type === 'uiCanvas' ? [component.controlId] : [])));
  return { id: crypto.randomUUID(), name: name.trim(), rootId, entities: copied,
    uiControls: structuredClone(controls.filter((control) => controlIds.has(control.id))) };
}

export function instantiatePrefab(prefab: ScenePrefab) {
  const ids = new Map(prefab.entities.map((entity) => [entity.id, crypto.randomUUID()]));
  const controlIds = new Map(prefab.uiControls.map((control) => [control.id, crypto.randomUUID()]));
  const entities = structuredClone(prefab.entities).map((entity) => ({
    ...entity, id: ids.get(entity.id)!, parentId: entity.parentId ? ids.get(entity.parentId)! : null,
    name: entity.id === prefab.rootId ? `${prefab.name} instance` : entity.name,
    components: entity.components.map((component) => ({
      ...component, id: crypto.randomUUID(),
      ...(component.type === 'uiCanvas' ? { controlId: controlIds.get(component.controlId)! } : {}),
    })),
  }));
  return { entities, rootId: ids.get(prefab.rootId)!,
    uiControls: prefab.uiControls.map((control) => ({ ...control, id: controlIds.get(control.id)! })) };
}

export function isPrefabCollection(value: unknown): value is ScenePrefab[] {
  if (!Array.isArray(value)) return false;
  const ids = new Set<string>();
  return value.every((entry: ScenePrefab) => {
    if (!entry || typeof entry.id !== 'string' || ids.has(entry.id) || typeof entry.name !== 'string' ||
        !entry.name.trim() || entry.name.length > 80 || !Array.isArray(entry.entities) ||
        !isSceneGraph(entry.entities) || !isUIControlCollection(entry.uiControls) ||
        typeof entry.rootId !== 'string' || !entry.entities.length) return false;
    ids.add(entry.id);
    const roots = entry.entities.filter((entity) => entity.parentId === null);
    return roots.length === 1 && roots[0].id === entry.rootId &&
      entry.entities.every((entity) => entity.components.every((component) =>
        component.type !== 'uiCanvas' || entry.uiControls.some((control) => control.id === component.controlId)));
  });
}

const cubeOBJ = `o Cube
v -0.5 -0.5 -0.5
v 0.5 -0.5 -0.5
v 0.5 0.5 -0.5
v -0.5 0.5 -0.5
v -0.5 -0.5 0.5
v 0.5 -0.5 0.5
v 0.5 0.5 0.5
v -0.5 0.5 0.5
f 1 4 3 2
f 5 6 7 8
f 1 2 6 5
f 4 8 7 3
f 1 5 8 4
f 2 3 7 6
`;

export async function generateProjectAsset(options: GeneratedAssetOptions): Promise<File> {
  if (!['cube', 'sprite', 'texture'].includes(options.kind) || !options.name.trim() || options.name.length > 80 ||
      !/^#[\da-f]{6}$/i.test(options.color) || !/^#[\da-f]{6}$/i.test(options.secondaryColor) ||
      !['solid', 'checker'].includes(options.pattern) || ![64, 128, 256, 512].includes(options.size)) {
    throw new Error('Enter a name, valid colors and a supported image size.');
  }
  const name = options.name.trim().replace(/[\\/\x00-\x1f]/g, '-').replace(/\.(png|obj)$/i, '');
  return withSystemActivity('Creating project asset', async () => {
    if (options.kind === 'cube') return new File([cubeOBJ], `${name}.obj`, { type: 'model/obj' });
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = options.size;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('This browser cannot create image textures.');
    context.fillStyle = options.color;
    context.fillRect(0, 0, options.size, options.size);
    if (options.pattern === 'checker') {
      context.fillStyle = options.secondaryColor;
      const cell = options.size / 8;
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        if ((x + y) % 2) context.fillRect(x * cell, y * cell, cell, cell);
      }
    }
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Could not create the PNG texture.')), 'image/png'));
    return new File([blob], `${name}.png`, { type: 'image/png' });
  });
}
