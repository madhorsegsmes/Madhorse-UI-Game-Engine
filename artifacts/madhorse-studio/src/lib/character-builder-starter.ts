import {
  createTransformComponent,
  type PrimitiveShape,
  type SceneEntity,
  type Vector3,
} from './scene-model';

type CharacterPoint = { x: number; height: number; depth: number };
type CharacterSize = { width: number; height: number; depth: number };
type CharacterPiece = {
  name: string;
  shape?: PrimitiveShape;
  point: CharacterPoint;
  size: CharacterSize;
  color: string;
};

function createGroup(name: string, parentId: string | null, position: Vector3, tagged = false): SceneEntity {
  return {
    id: crypto.randomUUID(),
    name,
    parentId,
    active: true,
    components: [createTransformComponent(position)],
    isGroup: true,
    ...(tagged ? { generatedBy: 'character-builder' as const } : {}),
  };
}

function createPiece(parentId: string, piece: CharacterPiece): SceneEntity {
  const position = createTransformComponent({
    x: 50 + piece.point.x * 10,
    y: 50 + piece.point.depth * 10,
    z: 50 + piece.point.height * 10,
  });
  position.scale = {
    x: piece.size.width,
    y: piece.size.depth,
    z: piece.size.height,
  };

  return {
    id: crypto.randomUUID(),
    name: piece.name,
    parentId,
    active: true,
    components: [
      position,
      {
        id: crypto.randomUUID(),
        type: 'primitive',
        enabled: true,
        shape: piece.shape ?? 'sphere',
        color: piece.color,
        textureAssetId: null,
        roughness: 0.76,
        metalness: 0,
      },
    ],
  };
}

export function createCharacterBuilderStarterScene() {
  const setup = createGroup('Character Builder Setup', null, { x: 50, y: 50, z: 0 }, true);
  const character = createGroup('Default Human · T-Pose · 1.80 m', setup.id, { x: 50, y: 50, z: 50 }, true);
  const parts: CharacterPiece[] = [
    { name: 'Skin · Head', point: { x: 0, height: 1.695, depth: 0 }, size: { width: 0.19, height: 0.21, depth: 0.18 }, color: '#d6a17f' },
    { name: 'Skin · Jaw and chin', point: { x: 0, height: 1.605, depth: 0.025 }, size: { width: 0.14, height: 0.11, depth: 0.15 }, color: '#cd9675' },
    { name: 'Skin · Neck', point: { x: 0, height: 1.56, depth: 0 }, size: { width: 0.115, height: 0.15, depth: 0.12 }, color: '#c99070' },
    { name: 'Skin · Chest', point: { x: 0, height: 1.385, depth: 0 }, size: { width: 0.43, height: 0.36, depth: 0.235 }, color: '#d5a07d' },
    { name: 'Skin · Abdomen', point: { x: 0, height: 1.13, depth: 0.012 }, size: { width: 0.32, height: 0.31, depth: 0.205 }, color: '#d2a07f' },
    { name: 'Skin · Pelvis', point: { x: 0, height: 0.99, depth: 0 }, size: { width: 0.35, height: 0.2, depth: 0.205 }, color: '#cd9675' },
    { name: 'Clothing · Briefs', point: { x: 0, height: 0.99, depth: 0.014 }, size: { width: 0.39, height: 0.205, depth: 0.225 }, color: '#d8d7d0' },
    { name: 'Clothing · Briefs waistband', point: { x: 0, height: 1.085, depth: 0.018 }, size: { width: 0.385, height: 0.035, depth: 0.22 }, color: '#ece9e1' },
    { name: 'Face · Nose', point: { x: 0, height: 1.695, depth: 0.095 }, size: { width: 0.034, height: 0.065, depth: 0.052 }, color: '#bf8668' },
    { name: 'Face · Mouth', point: { x: 0, height: 1.635, depth: 0.083 }, size: { width: 0.055, height: 0.018, depth: 0.014 }, color: '#93695b' },
    { name: 'Skin · Clavicle', point: { x: 0, height: 1.535, depth: 0.12 }, size: { width: 0.29, height: 0.055, depth: 0.055 }, color: '#dfad8d' },
    { name: 'Skin · Abdomen definition', point: { x: 0, height: 1.14, depth: 0.105 }, size: { width: 0.16, height: 0.19, depth: 0.045 }, color: '#d8a684' },
  ];

  for (const side of [-1, 1] as const) {
    const label = side < 0 ? 'Left' : 'Right';
    const add = (name: string, point: CharacterPoint, size: CharacterSize, color = '#d5a07d') => {
      parts.push({ name: `Skin · ${label} ${name}`, point: { ...point, x: point.x * side }, size, color });
    };

    add('ear', { x: 0.105, height: 1.705, depth: 0 }, { width: 0.034, height: 0.065, depth: 0.055 }, '#c58d6d');
    add('eye', { x: 0.043, height: 1.715, depth: 0.082 }, { width: 0.03, height: 0.018, depth: 0.012 }, '#f3eee5');
    add('iris', { x: 0.043, height: 1.715, depth: 0.091 }, { width: 0.012, height: 0.014, depth: 0.008 }, '#73533e');
    add('brow', { x: 0.043, height: 1.74, depth: 0.08 }, { width: 0.043, height: 0.012, depth: 0.015 }, '#765947');

    add('pectoral', { x: 0.115, height: 1.43, depth: 0.105 }, { width: 0.205, height: 0.16, depth: 0.105 }, '#dba987');
    add('oblique', { x: 0.135, height: 1.18, depth: 0.08 }, { width: 0.09, height: 0.21, depth: 0.075 }, '#c99575');
    add('deltoid', { x: 0.255, height: 1.47, depth: 0 }, { width: 0.225, height: 0.23, depth: 0.22 });
    add('upper arm', { x: 0.435, height: 1.475, depth: 0 }, { width: 0.34, height: 0.145, depth: 0.15 });
    add('elbow', { x: 0.615, height: 1.475, depth: 0 }, { width: 0.15, height: 0.145, depth: 0.14 }, '#cc9675');
    add('forearm', { x: 0.76, height: 1.475, depth: 0.005 }, { width: 0.28, height: 0.12, depth: 0.12 }, '#d8a584');
    add('wrist', { x: 0.895, height: 1.475, depth: 0 }, { width: 0.09, height: 0.09, depth: 0.085 });
    add('palm', { x: 0.95, height: 1.475, depth: 0.015 }, { width: 0.14, height: 0.105, depth: 0.055 }, '#dba886');
    for (let finger = 0; finger < 4; finger++) {
      const fingerHeight = 1.444 + finger * 0.02;
      const fingerLength = 0.075 - finger * 0.008;
      add(`hand · finger ${finger + 1}`, { x: 1.01 + fingerLength * 0.45, height: fingerHeight, depth: 0.018 }, {
        width: fingerLength,
        height: 0.018,
        depth: 0.019,
      }, '#d5a07d');
    }
    add('hand · thumb', { x: 0.965, height: 1.425, depth: 0.025 }, { width: 0.065, height: 0.08, depth: 0.025 }, '#d5a07d');

    add('thigh', { x: 0.12, height: 0.79, depth: 0 }, { width: 0.235, height: 0.41, depth: 0.22 });
    add('knee', { x: 0.12, height: 0.57, depth: 0.01 }, { width: 0.17, height: 0.16, depth: 0.17 }, '#d4a07f');
    add('calf', { x: 0.12, height: 0.36, depth: -0.008 }, { width: 0.17, height: 0.37, depth: 0.17 }, '#d4a07f');
    add('ankle', { x: 0.12, height: 0.16, depth: 0 }, { width: 0.105, height: 0.11, depth: 0.11 }, '#c99171');
    add('foot', { x: 0.12, height: 0.105, depth: 0.075 }, { width: 0.12, height: 0.07, depth: 0.26 }, '#d5a07d');
  }

  const ground = createPiece(setup.id, {
    name: 'Character Ground Plane · 5 m',
    shape: 'plane',
    point: { x: 0, height: 0, depth: 0 },
    size: { width: 0.5, height: 1, depth: 0.5 },
    color: '#686b70',
  });
  const platform = createPiece(setup.id, {
    name: 'Character Turntable · 1.2 m',
    shape: 'cylinder',
    point: { x: 0, height: 0.04, depth: 0 },
    size: { width: 1.22, height: 0.08, depth: 1.05 },
    color: '#393a3f',
  });
  const bodyParts = parts.map((piece) => createPiece(character.id, piece));
  return {
    entities: [setup, ground, platform, character, ...bodyParts],
    setupId: setup.id,
    characterId: character.id,
  };
}
