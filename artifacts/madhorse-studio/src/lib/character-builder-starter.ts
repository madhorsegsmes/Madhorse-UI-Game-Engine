import {
  createTransformComponent,
  getTransform,
  type PrimitiveShape,
  type SceneEntity,
  type Vector3,
} from './scene-model';
import type { EgoCharacterSpecies } from './ego-character-anatomy';

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

const characterNames: Record<EgoCharacterSpecies, string> = {
  human: 'Human',
  orc: 'Orc',
  vampire: 'Vampire',
  wolf: 'Wolf',
  quadruped: 'Animal',
  avian: 'Bird',
  dragon: 'Dragon',
  serpentine: 'Serpent',
  insectoid: 'Insect Creature',
  aquatic: 'Aquatic Creature',
  monster: 'Monster',
};

function addCreaturePart(
  parts: SceneEntity[],
  parentId: string,
  name: string,
  point: CharacterPoint,
  size: CharacterSize,
  color: string,
  shape: PrimitiveShape = 'sphere',
) {
  parts.push(createPiece(parentId, { name, point, size, color, shape }));
}

function buildQuadruped(
  parts: SceneEntity[],
  parentId: string,
  label: string,
  color: string,
  variant: string,
) {
  const isHoofed = /horse|deer|cow|ox|goat|sheep|moose|elk/i.test(variant);
  const isHeavy = /bear|boar|hippo|rhino|elephant/i.test(variant);
  const bodyWidth = isHeavy ? 0.62 : 0.48;
  const bodyHeight = isHeavy ? 0.52 : 0.42;
  addCreaturePart(parts, parentId, `Skin · ${label} torso`, { x: 0, height: 0.68, depth: 0 }, { width: bodyWidth, height: bodyHeight, depth: 0.9 }, color, 'rounded-cube');
  addCreaturePart(parts, parentId, `Skin · ${label} chest`, { x: 0, height: 0.72, depth: 0.3 }, { width: bodyWidth * 0.94, height: 0.4, depth: 0.46 }, color);
  addCreaturePart(parts, parentId, `Skin · ${label} hips`, { x: 0, height: 0.66, depth: -0.3 }, { width: bodyWidth, height: 0.42, depth: 0.44 }, color);
  addCreaturePart(parts, parentId, `Skin · ${label} neck`, { x: 0, height: 0.86, depth: 0.42 }, { width: 0.3, height: 0.38, depth: 0.36 }, color);
  addCreaturePart(parts, parentId, `Skin · ${label} head`, { x: 0, height: 1.02, depth: 0.58 }, { width: 0.32, height: 0.29, depth: 0.3 }, color);
  addCreaturePart(parts, parentId, `Skin · ${label} muzzle`, { x: 0, height: 0.94, depth: 0.78 }, { width: isHoofed ? 0.2 : 0.18, height: 0.15, depth: 0.32 }, /lion|tiger|bear/i.test(variant) ? '#b28760' : color);
  addCreaturePart(parts, parentId, `Skin · ${label} lower jaw`, { x: 0, height: 0.84, depth: 0.74 }, { width: 0.17, height: 0.075, depth: 0.24 }, '#55463e');

  for (const side of [-1, 1] as const) {
    const sideLabel = side < 0 ? 'Left' : 'Right';
    for (const end of ['front', 'hind'] as const) {
      const depth = end === 'front' ? 0.32 : -0.32;
      const upper = isHoofed ? 0.38 : 0.32;
      addCreaturePart(parts, parentId, `Skin · ${label} ${sideLabel} ${end} leg upper`, { x: side * 0.2, height: 0.49, depth }, { width: upper, height: 0.28, depth: 0.22 }, color, 'rounded-cube');
      addCreaturePart(parts, parentId, `Skin · ${label} ${sideLabel} ${end} leg joint`, { x: side * 0.2, height: 0.3, depth: depth + (end === 'front' ? 0.03 : -0.02) }, { width: 0.16, height: 0.14, depth: 0.16 }, color);
      addCreaturePart(parts, parentId, `Skin · ${label} ${sideLabel} ${end} leg lower`, { x: side * 0.2, height: 0.17, depth: depth + (end === 'front' ? 0.04 : -0.1) }, { width: 0.13, height: 0.24, depth: 0.13 }, color, 'rounded-cube');
      addCreaturePart(parts, parentId, `${isHoofed ? 'Detail · Hoof' : 'Skin · Paw'} · ${label} ${sideLabel} ${end}`, { x: side * 0.2, height: 0.065, depth: depth + (end === 'front' ? 0.09 : -0.1) }, { width: 0.18, height: 0.12, depth: 0.24 }, isHoofed ? '#302922' : '#55463e', isHoofed ? 'rounded-cube' : 'sphere');
    }
    addCreaturePart(parts, parentId, `Detail · ${label} ${sideLabel} eye`, { x: side * 0.105, height: 1.055, depth: 0.735 }, { width: 0.045, height: 0.035, depth: 0.025 }, /wolf|cat|fox/i.test(variant) ? '#d4b35c' : '#211c19');
    addCreaturePart(parts, parentId, `Skin · ${label} ${sideLabel} ear`, { x: side * 0.15, height: 1.17, depth: 0.55 }, { width: 0.1, height: 0.18, depth: 0.08 }, color, /horse|deer|cat|fox/i.test(variant) ? 'cone' : 'sphere');
    if (isHoofed && /deer|moose|elk|goat/i.test(variant)) {
      addCreaturePart(parts, parentId, `Detail · ${label} ${sideLabel} horn`, { x: side * 0.14, height: 1.3, depth: 0.5 }, { width: 0.065, height: 0.3, depth: 0.06 }, '#bca878', 'cone');
    }
    addCreaturePart(parts, parentId, `Detail · ${label} ${sideLabel} claw`, { x: side * 0.2, height: 0.03, depth: 0.48 }, { width: 0.035, height: 0.07, depth: 0.045 }, '#ded8c9', 'cone');
  }
  addCreaturePart(parts, parentId, `Skin · ${label} tail base`, { x: 0, height: 0.82, depth: -0.55 }, { width: 0.16, height: 0.17, depth: 0.3 }, color, 'rounded-cube');
  addCreaturePart(parts, parentId, `Skin · ${label} tail tip`, { x: 0, height: /wolf|fox|horse/i.test(variant) ? 0.9 : 0.76, depth: -0.79 }, { width: 0.14, height: 0.15, depth: 0.26 }, /wolf|fox|lion/i.test(variant) ? '#b49b76' : color);
  addCreaturePart(parts, parentId, `Detail · ${label} nose`, { x: 0, height: 0.97, depth: 0.94 }, { width: 0.085, height: 0.065, depth: 0.05 }, '#242221');
  if (/horse|lion/i.test(variant)) {
    for (let index = 0; index < 4; index++) {
      addCreaturePart(parts, parentId, `Detail · ${label} mane section ${index + 1}`, { x: 0, height: 1.05 - index * 0.08, depth: 0.42 - index * 0.05 }, { width: 0.38 - index * 0.035, height: 0.12, depth: 0.17 }, /lion/i.test(variant) ? '#a97132' : '#4a3426', 'rounded-cube');
    }
  }
  if (/tiger/i.test(variant)) {
    for (let index = 0; index < 5; index++) {
      addCreaturePart(parts, parentId, `Marking · ${label} stripe ${index + 1}`, { x: (index % 2 ? 1 : -1) * 0.235, height: 0.78 - index * 0.055, depth: 0.2 - index * 0.12 }, { width: 0.035, height: 0.22, depth: 0.07 }, '#29231f', 'rounded-cube');
    }
  }
}

function buildAvian(parts: SceneEntity[], parentId: string, label: string) {
  const feather = '#ddd5c6';
  addCreaturePart(parts, parentId, `Skin · ${label} feathered body`, { x: 0, height: 0.98, depth: 0 }, { width: 0.44, height: 0.58, depth: 0.38 }, '#675d53', 'rounded-cube');
  addCreaturePart(parts, parentId, `Skin · ${label} feathered chest`, { x: 0, height: 0.99, depth: 0.18 }, { width: 0.34, height: 0.42, depth: 0.2 }, feather);
  addCreaturePart(parts, parentId, `Skin · ${label} neck`, { x: 0, height: 1.31, depth: 0.02 }, { width: 0.18, height: 0.31, depth: 0.18 }, '#675d53');
  addCreaturePart(parts, parentId, `Skin · ${label} feathered head`, { x: 0, height: 1.53, depth: 0.03 }, { width: 0.24, height: 0.24, depth: 0.22 }, '#675d53');
  addCreaturePart(parts, parentId, `Beak · ${label}`, { x: 0, height: 1.49, depth: 0.2 }, { width: 0.14, height: 0.15, depth: 0.2 }, '#c19043', 'cone');
  addCreaturePart(parts, parentId, `Tail · ${label} tail fan`, { x: 0, height: 0.82, depth: -0.28 }, { width: 0.42, height: 0.24, depth: 0.18 }, feather, 'rounded-cube');
  for (const side of [-1, 1] as const) {
    const sideLabel = side < 0 ? 'Left' : 'Right';
    addCreaturePart(parts, parentId, `Detail · ${label} ${sideLabel} eye`, { x: side * 0.09, height: 1.56, depth: 0.15 }, { width: 0.045, height: 0.04, depth: 0.02 }, '#181716');
    addCreaturePart(parts, parentId, `Wing · ${label} ${sideLabel} upper`, { x: side * 0.34, height: 1.18, depth: -0.03 }, { width: 0.5, height: 0.15, depth: 0.22 }, '#675d53', 'rounded-cube');
    addCreaturePart(parts, parentId, `Wing · ${label} ${sideLabel} outer`, { x: side * 0.68, height: 1.24, depth: -0.05 }, { width: 0.35, height: 0.12, depth: 0.18 }, '#675d53', 'rounded-cube');
    for (let index = 0; index < 4; index++) {
      addCreaturePart(parts, parentId, `Feather · ${label} ${sideLabel} flight feather ${index + 1}`, { x: side * (0.48 + index * 0.1), height: 1.12 - index * 0.035, depth: 0.02 }, { width: 0.13, height: 0.32, depth: 0.055 }, feather, 'cone');
    }
    addCreaturePart(parts, parentId, `Leg · ${label} ${sideLabel} shin`, { x: side * 0.11, height: 0.48, depth: 0.02 }, { width: 0.08, height: 0.38, depth: 0.08 }, '#bd8d4d', 'rounded-cube');
    addCreaturePart(parts, parentId, `Talon · ${label} ${sideLabel} foot`, { x: side * 0.11, height: 0.26, depth: 0.1 }, { width: 0.2, height: 0.08, depth: 0.19 }, '#b17b3d', 'rounded-cube');
    for (let claw = 0; claw < 3; claw++) {
      addCreaturePart(parts, parentId, `Talon · ${label} ${sideLabel} claw ${claw + 1}`, { x: side * (0.04 + claw * 0.07), height: 0.19, depth: 0.2 }, { width: 0.035, height: 0.12, depth: 0.04 }, '#30261c', 'cone');
    }
  }
}

function buildDragonWingsAndSpines(parts: SceneEntity[], parentId: string, label: string, color: string) {
  for (const side of [-1, 1] as const) {
    const sideLabel = side < 0 ? 'Left' : 'Right';
    addCreaturePart(parts, parentId, `Wing · ${label} ${sideLabel} shoulder`, { x: side * 0.3, height: 1.05, depth: 0.18 }, { width: 0.36, height: 0.12, depth: 0.16 }, color, 'rounded-cube');
    addCreaturePart(parts, parentId, `Wing · ${label} ${sideLabel} outer spar`, { x: side * 0.62, height: 1.2, depth: 0.12 }, { width: 0.45, height: 0.09, depth: 0.12 }, color, 'rounded-cube');
    addCreaturePart(parts, parentId, `Wing · ${label} ${sideLabel} membrane`, { x: side * 0.5, height: 1.0, depth: 0.22 }, { width: 0.72, height: 0.25, depth: 0.035 }, '#7a3e31', 'rounded-cube');
    addCreaturePart(parts, parentId, `Horn · ${label} ${sideLabel}`, { x: side * 0.13, height: 1.31, depth: 0.53 }, { width: 0.08, height: 0.24, depth: 0.08 }, '#d0c2a2', 'cone');
  }
  for (let index = 0; index < 6; index++) {
    addCreaturePart(parts, parentId, `Scale · ${label} dorsal spine ${index + 1}`, { x: 0, height: 0.98, depth: 0.35 - index * 0.13 }, { width: 0.11, height: 0.17, depth: 0.1 }, '#d0ad72', 'cone');
  }
}

function buildSerpentine(parts: SceneEntity[], parentId: string, label: string) {
  const bodyColor = '#647f55';
  for (let index = 0; index < 9; index++) {
    const progress = index / 8;
    addCreaturePart(parts, parentId, `Skin · ${label} body segment ${index + 1}`, {
      x: Math.sin(progress * Math.PI * 2) * 0.12,
      height: 0.62 + Math.sin(progress * Math.PI) * 0.2,
      depth: 0.65 - progress * 1.45,
    }, { width: 0.34 - progress * 0.14, height: 0.34 - progress * 0.13, depth: 0.28 }, progress < 0.2 ? '#71895b' : bodyColor);
  }
  addCreaturePart(parts, parentId, `Skin · ${label} head`, { x: 0, height: 0.99, depth: 0.76 }, { width: 0.34, height: 0.26, depth: 0.34 }, '#71895b');
  addCreaturePart(parts, parentId, `Skin · ${label} jaw`, { x: 0, height: 0.9, depth: 0.91 }, { width: 0.24, height: 0.08, depth: 0.22 }, '#a09a72');
  addCreaturePart(parts, parentId, `Detail · ${label} forked tongue`, { x: 0, height: 0.91, depth: 1.04 }, { width: 0.04, height: 0.035, depth: 0.19 }, '#a63842', 'cone');
  for (const side of [-1, 1] as const) {
    addCreaturePart(parts, parentId, `Detail · ${label} ${side < 0 ? 'Left' : 'Right'} eye`, { x: side * 0.12, height: 1.06, depth: 0.85 }, { width: 0.065, height: 0.055, depth: 0.035 }, '#d9c85f');
    addCreaturePart(parts, parentId, `Fang · ${label} ${side < 0 ? 'Left' : 'Right'}`, { x: side * 0.08, height: 0.89, depth: 0.97 }, { width: 0.035, height: 0.12, depth: 0.035 }, '#eee4c9', 'cone');
  }
}

function buildInsectoid(parts: SceneEntity[], parentId: string, label: string) {
  const shell = '#554a38';
  addCreaturePart(parts, parentId, `Skin · ${label} shell abdomen`, { x: 0, height: 0.83, depth: -0.25 }, { width: 0.48, height: 0.5, depth: 0.55 }, '#78623e', 'rounded-cube');
  addCreaturePart(parts, parentId, `Skin · ${label} shell thorax`, { x: 0, height: 0.92, depth: 0.12 }, { width: 0.38, height: 0.34, depth: 0.42 }, shell);
  addCreaturePart(parts, parentId, `Skin · ${label} neck`, { x: 0, height: 1.03, depth: 0.34 }, { width: 0.2, height: 0.18, depth: 0.18 }, shell);
  addCreaturePart(parts, parentId, `Skin · ${label} shell head`, { x: 0, height: 1.14, depth: 0.44 }, { width: 0.3, height: 0.27, depth: 0.28 }, shell);
  addCreaturePart(parts, parentId, `Mandibles · ${label}`, { x: 0, height: 1.02, depth: 0.62 }, { width: 0.19, height: 0.11, depth: 0.17 }, '#b18b47', 'cone');
  for (const side of [-1, 1] as const) {
    const sideLabel = side < 0 ? 'Left' : 'Right';
    addCreaturePart(parts, parentId, `Antenna · ${label} ${sideLabel} base`, { x: side * 0.09, height: 1.3, depth: 0.43 }, { width: 0.035, height: 0.14, depth: 0.035 }, shell, 'cone');
    addCreaturePart(parts, parentId, `Antenna · ${label} ${sideLabel} tip`, { x: side * 0.15, height: 1.42, depth: 0.42 }, { width: 0.03, height: 0.16, depth: 0.03 }, shell, 'cone');
    addCreaturePart(parts, parentId, `Detail · ${label} ${sideLabel} compound eye`, { x: side * 0.14, height: 1.18, depth: 0.57 }, { width: 0.11, height: 0.12, depth: 0.055 }, '#b64236');
    const legCount = /spider|scorpion/i.test(label) ? 4 : 3;
    for (let leg = 0; leg < legCount; leg++) {
      const depth = 0.25 - leg * 0.2;
      addCreaturePart(parts, parentId, `Leg · ${label} ${sideLabel} leg ${leg + 1} upper`, { x: side * 0.32, height: 0.76, depth }, { width: 0.32, height: 0.08, depth: 0.09 }, shell, 'rounded-cube');
      addCreaturePart(parts, parentId, `Leg · ${label} ${sideLabel} leg ${leg + 1} lower`, { x: side * 0.54, height: 0.49, depth: depth + 0.04 }, { width: 0.08, height: 0.38, depth: 0.08 }, shell, 'rounded-cube');
      addCreaturePart(parts, parentId, `Foot · ${label} ${sideLabel} leg ${leg + 1}`, { x: side * 0.57, height: 0.28, depth: depth + 0.08 }, { width: 0.07, height: 0.06, depth: 0.12 }, '#28231c', 'cone');
    }
  }
}

function buildAquatic(parts: SceneEntity[], parentId: string, label: string) {
  const bodyColor = /shark/i.test(label) ? '#667987' : '#397d8a';
  addCreaturePart(parts, parentId, `Skin · ${label} body`, { x: 0, height: 0.9, depth: 0 }, { width: 0.52, height: 0.56, depth: 1.22 }, bodyColor, 'rounded-cube');
  addCreaturePart(parts, parentId, `Skin · ${label} belly`, { x: 0, height: 0.72, depth: 0.12 }, { width: 0.4, height: 0.22, depth: 0.9 }, '#bdd1ce');
  addCreaturePart(parts, parentId, `Skin · ${label} head`, { x: 0, height: 0.97, depth: 0.62 }, { width: 0.43, height: 0.4, depth: 0.48 }, bodyColor);
  addCreaturePart(parts, parentId, `Skin · ${label} mouth`, { x: 0, height: 0.78, depth: 0.89 }, { width: 0.28, height: 0.09, depth: 0.24 }, '#302c2a', 'rounded-cube');
  addCreaturePart(parts, parentId, `Fin · ${label} dorsal fin`, { x: 0, height: 1.26, depth: 0.12 }, { width: 0.12, height: 0.32, depth: 0.3 }, '#d5ded4', 'cone');
  addCreaturePart(parts, parentId, `Fin · ${label} tail base`, { x: 0, height: 0.9, depth: -0.76 }, { width: 0.15, height: 0.18, depth: 0.3 }, bodyColor);
  addCreaturePart(parts, parentId, `Fin · ${label} tail fluke`, { x: 0, height: 0.9, depth: -1.02 }, { width: 0.56, height: 0.12, depth: 0.34 }, bodyColor, 'rounded-cube');
  for (const side of [-1, 1] as const) {
    const sideLabel = side < 0 ? 'Left' : 'Right';
    addCreaturePart(parts, parentId, `Detail · ${label} ${sideLabel} eye`, { x: side * 0.19, height: 1.08, depth: 0.75 }, { width: 0.055, height: 0.05, depth: 0.035 }, '#15191b');
    addCreaturePart(parts, parentId, `Fin · ${label} ${sideLabel} pectoral`, { x: side * 0.38, height: 0.83, depth: 0.3 }, { width: 0.32, height: 0.08, depth: 0.48 }, '#a9c4bd', 'cone');
    addCreaturePart(parts, parentId, `Gills · ${label} ${sideLabel}`, { x: side * 0.22, height: 0.92, depth: 0.5 }, { width: 0.025, height: 0.22, depth: 0.06 }, '#d1a38f', 'rounded-cube');
  }
  if (/shark/i.test(label)) {
    for (let index = 0; index < 5; index++) {
      addCreaturePart(parts, parentId, `Detail · ${label} tooth ${index + 1}`, { x: -0.1 + index * 0.05, height: 0.77, depth: 1.0 }, { width: 0.025, height: 0.075, depth: 0.025 }, '#f2eee2', 'cone');
    }
  }
}

function finishCreatureBuild(
  starter: ReturnType<typeof createCharacterBuilderStarterScene>,
  setup: SceneEntity,
  character: SceneEntity,
  parts: SceneEntity[],
  heightMeters: number,
  baseHeight: number,
) {
  const factor = heightMeters / baseHeight;
  for (const part of parts) {
    const transform = getTransform(part);
    transform.position = {
      x: 50 + (transform.position.x - 50) * factor,
      y: 50 + (transform.position.y - 50) * factor,
      z: 50 + (transform.position.z - 50) * factor,
    };
    transform.scale = {
      x: transform.scale.x * factor,
      y: transform.scale.y * factor,
      z: transform.scale.z * factor,
    };
  }
  const existingPartIds = new Set(starter.entities.map((entity) => entity.id));
  starter.entities.push(...parts.filter((part) => !existingPartIds.has(part.id)));
  const entities = starter.entities.filter((entity) =>
    entity.id === setup.id || entity.id === character.id || entity.parentId === character.id);
  return { entities, setupId: setup.id, characterId: character.id };
}

export function createEgoCharacterScene(
  species: EgoCharacterSpecies,
  heightMeters: number,
  offset: { x: number; z: number } = { x: 0, z: 0 },
  requestedName?: string,
) {
  const starter = createCharacterBuilderStarterScene();
  const setup = starter.entities.find((entity) => entity.name === 'Character Builder Setup')!;
  const character = starter.entities.find((entity) => entity.id === starter.characterId)!;
  const displayName = requestedName?.trim().slice(0, 48) || characterNames[species];
  setup.name = `Ego Creature · ${displayName}`;
  character.name = `Character · ${displayName} · ${heightMeters.toFixed(2)} m`;
  const setupTransform = getTransform(setup);
  setupTransform.position.x = 50 + offset.x * 10;
  setupTransform.position.y = 50 + offset.z * 10;
  setupTransform.position.z = 0;

  const templateSpecies = ['wolf', 'quadruped', 'avian', 'dragon', 'serpentine', 'insectoid', 'aquatic'];
  if (templateSpecies.includes(species)) {
    const starterParts = starter.entities.filter((entity) => entity.parentId === character.id);
    const starterPartIds = new Set(starterParts.map((part) => part.id));
    starter.entities = starter.entities.filter((entity) => !starterPartIds.has(entity.id));
    const parts: SceneEntity[] = [];
    const lowerName = displayName.toLowerCase();
    if (species === 'wolf' || species === 'quadruped' || species === 'dragon') {
      const fur = /wolf/i.test(lowerName) ? '#77766f'
        : /cat|lion|tiger/i.test(lowerName) ? '#b4874d'
          : /fox/i.test(lowerName) ? '#bd7542'
            : /horse|deer|cow|ox|goat|sheep|moose|elk/i.test(lowerName) ? '#755a40'
              : /bear|boar|hippo|rhino|elephant/i.test(lowerName) ? '#786b5d' : '#82796b';
      buildQuadruped(parts, character.id, displayName, fur, lowerName);
      if (species === 'dragon') buildDragonWingsAndSpines(parts, character.id, displayName, '#526a43');
      if (/wolf/i.test(lowerName)) {
        for (const part of parts) {
          if (/eye/i.test(part.name)) {
            const primitive = part.components.find(component => component.type === 'primitive');
            if (primitive?.type === 'primitive') primitive.color = '#d6b263';
          }
        }
      }
      const baseHeight = species === 'wolf' ? 1.3 : species === 'dragon' ? 2.2 : /horse|deer|cow|moose|elk|giraffe/i.test(lowerName) ? 1.8 : 1.4;
      return finishCreatureBuild(starter, setup, character, parts, heightMeters, baseHeight);
    }
    if (species === 'avian') {
      buildAvian(parts, character.id, displayName);
      return finishCreatureBuild(starter, setup, character, parts, heightMeters, 1.6);
    }
    if (species === 'serpentine') {
      buildSerpentine(parts, character.id, displayName);
      return finishCreatureBuild(starter, setup, character, parts, heightMeters, 1.3);
    }
    if (species === 'insectoid') {
      buildInsectoid(parts, character.id, displayName);
      return finishCreatureBuild(starter, setup, character, parts, heightMeters, /spider|scorpion/i.test(lowerName) ? 1.25 : 1.4);
    }
    buildAquatic(parts, character.id, displayName);
    return finishCreatureBuild(starter, setup, character, parts, heightMeters, 1.4);
  }

  let parts = starter.entities.filter((entity) => entity.parentId === character.id);
  if (species === 'wolf') {
    starter.entities = starter.entities.filter((entity) => !parts.some((part) => part.id === entity.id));
    const fur = '#77766f';
    const buildBodyPiece = (name: string, point: CharacterPoint, size: CharacterSize, color = fur) => {
      parts.push(createPiece(character.id, { name, point, size, color }));
    };
    buildBodyPiece('Skin · Wolf torso', { x: 0, height: 0.69, depth: -0.01 }, { width: 0.49, height: 0.48, depth: 0.96 });
    buildBodyPiece('Skin · Wolf chest', { x: 0, height: 0.73, depth: 0.30 }, { width: 0.48, height: 0.42, depth: 0.48 }, '#817f77');
    buildBodyPiece('Skin · Wolf shoulder mass', { x: 0, height: 0.72, depth: 0.37 }, { width: 0.52, height: 0.48, depth: 0.42 });
    buildBodyPiece('Skin · Wolf hips', { x: 0, height: 0.66, depth: -0.32 }, { width: 0.48, height: 0.42, depth: 0.46 });
    buildBodyPiece('Skin · Wolf neck', { x: 0, height: 0.86, depth: 0.43 }, { width: 0.32, height: 0.39, depth: 0.42 }, '#827f76');
    buildBodyPiece('Skin · Wolf head', { x: 0, height: 0.98, depth: 0.58 }, { width: 0.33, height: 0.32, depth: 0.32 });
    buildBodyPiece('Skin · Wolf muzzle', { x: 0, height: 0.88, depth: 0.79 }, { width: 0.2, height: 0.18, depth: 0.33 }, '#8b8982');
    buildBodyPiece('Skin · Wolf lower jaw', { x: 0, height: 0.79, depth: 0.74 }, { width: 0.18, height: 0.08, depth: 0.25 }, '#686761');

    for (const side of [-1, 1] as const) {
      const label = side < 0 ? 'Left' : 'Right';
      buildBodyPiece(`Skin · ${label} wolf foreleg upper`, { x: side * 0.2, height: 0.49, depth: 0.35 }, { width: 0.18, height: 0.32, depth: 0.19 });
      buildBodyPiece(`Skin · ${label} wolf foreleg joint`, { x: side * 0.2, height: 0.30, depth: 0.39 }, { width: 0.14, height: 0.14, depth: 0.15 }, '#706f69');
      buildBodyPiece(`Skin · ${label} wolf foreleg lower`, { x: side * 0.2, height: 0.17, depth: 0.40 }, { width: 0.12, height: 0.25, depth: 0.13 });
      buildBodyPiece(`Skin · ${label} wolf front paw`, { x: side * 0.2, height: 0.07, depth: 0.46 }, { width: 0.19, height: 0.12, depth: 0.28 }, '#686761');
      buildBodyPiece(`Skin · ${label} wolf hind thigh`, { x: side * 0.22, height: 0.52, depth: -0.34 }, { width: 0.28, height: 0.38, depth: 0.31 });
      buildBodyPiece(`Skin · ${label} wolf hind knee`, { x: side * 0.22, height: 0.34, depth: -0.20 }, { width: 0.16, height: 0.15, depth: 0.17 }, '#706f69');
      buildBodyPiece(`Skin · ${label} wolf hind leg lower`, { x: side * 0.22, height: 0.17, depth: -0.11 }, { width: 0.12, height: 0.26, depth: 0.13 });
      buildBodyPiece(`Skin · ${label} wolf hind paw`, { x: side * 0.22, height: 0.07, depth: -0.04 }, { width: 0.19, height: 0.12, depth: 0.26 }, '#686761');
      buildBodyPiece(`Detail · ${label} wolf eye`, { x: side * 0.105, height: 1.005, depth: 0.725 }, { width: 0.045, height: 0.035, depth: 0.025 }, '#d6b263');
      const ear = createPiece(character.id, {
        name: `Detail · ${label} wolf ear`,
        shape: 'cone',
        point: { x: side * 0.12, height: 1.16, depth: 0.55 },
        size: { width: 0.12, height: 0.25, depth: 0.1 },
        color: fur,
      });
      parts.push(ear);
      const claw = createPiece(character.id, {
        name: `Detail · ${label} front claws`,
        shape: 'cone',
        point: { x: side * 0.2, height: 0.045, depth: 0.55 },
        size: { width: 0.045, height: 0.08, depth: 0.045 },
        color: '#d4d0c5',
      });
      getTransform(claw).rotation.x = 180;
      parts.push(claw);
    }
    buildBodyPiece('Skin · Wolf tail base', { x: 0, height: 0.82, depth: -0.56 }, { width: 0.2, height: 0.2, depth: 0.32 });
    buildBodyPiece('Skin · Wolf tail middle', { x: 0, height: 0.95, depth: -0.75 }, { width: 0.17, height: 0.18, depth: 0.28 });
    buildBodyPiece('Skin · Wolf tail tip', { x: 0, height: 1.04, depth: -0.91 }, { width: 0.14, height: 0.15, depth: 0.21 }, '#aaa79e');
    parts.push(createPiece(character.id, {
      name: 'Detail · Wolf nose',
      shape: 'sphere',
      point: { x: 0, height: 0.91, depth: 0.94 },
      size: { width: 0.09, height: 0.07, depth: 0.065 },
      color: '#262626',
    }));
  } else {
    const monsterName = displayName.toLowerCase();
    const skin = species === 'orc' ? '#78925a'
      : species === 'vampire' ? '#d7c5c2'
        : species === 'monster' && /skeleton|undead/i.test(monsterName) ? '#d8d1bc'
          : species === 'monster' && /ghost|specter|spirit/i.test(monsterName) ? '#87b9b5'
            : species === 'monster' && /demon|devil/i.test(monsterName) ? '#8d3f3b'
              : species === 'monster' && /alien/i.test(monsterName) ? '#7c9c91'
                : species === 'monster' && /goblin|troll|orc/i.test(monsterName) ? '#718858'
                  : species === 'monster' && /zombie/i.test(monsterName) ? '#78816f'
                    : species === 'monster' ? '#716f7d' : '#d5a07d';
    for (const part of parts) {
      const primitive = part.components.find((component) => component.type === 'primitive');
      const transform = getTransform(part);
      const detailPart = /\b(eye|iris|brow|mouth)\b/i.test(part.name);
      if (primitive?.type === 'primitive' && part.name.startsWith('Skin ·') && !detailPart) primitive.color = skin;
      if (species === 'vampire' && primitive?.type === 'primitive' && part.name.includes('iris')) primitive.color = '#a71e38';
      if (species === 'orc' && /\b(Chest|Abdomen|Pelvis|pectoral|oblique|deltoid|upper arm|forearm|thigh)\b/i.test(part.name)) {
        transform.scale.x *= 1.18;
      }
      if (species === 'orc' && /\bhead\b/i.test(part.name)) {
        transform.scale.x *= 1.14;
        transform.scale.z *= 1.1;
      }
      if (species === 'monster' && /ogre|troll|minotaur|giant/i.test(monsterName) &&
          /\b(chest|abdomen|pelvis|pectoral|oblique|deltoid|upper arm|forearm|thigh)\b/i.test(part.name)) {
        transform.scale.x *= 1.32;
        transform.scale.z *= 1.12;
      }
      if (species === 'monster' && /goblin|imp/i.test(monsterName) && /\bhead\b/i.test(part.name)) {
        transform.scale.x *= 1.2;
        transform.scale.z *= 1.1;
      }
      if (species === 'monster' && /skeleton|undead/i.test(monsterName) && primitive?.type === 'primitive' && part.name.startsWith('Skin ·')) {
        primitive.color = '#d8d1bc';
      }
    }
    if (species === 'orc') {
      for (const side of [-1, 1] as const) {
        parts.push(createPiece(character.id, {
          name: `Detail · ${side < 0 ? 'Left' : 'Right'} orc tusk`,
          shape: 'cone',
          point: { x: side * 0.065, height: 1.615, depth: 0.13 },
          size: { width: 0.045, height: 0.105, depth: 0.04 },
          color: '#e5ddc8',
        }));
        parts.push(createPiece(character.id, {
          name: `Detail · ${side < 0 ? 'Left' : 'Right'} pointed orc ear`,
          shape: 'cone',
          point: { x: side * 0.17, height: 1.73, depth: 0 },
          size: { width: 0.085, height: 0.17, depth: 0.07 },
          color: skin,
        }));
      }
    } else if (species === 'vampire') {
      for (const side of [-1, 1] as const) {
        const fang = createPiece(character.id, {
          name: `Detail · ${side < 0 ? 'Left' : 'Right'} vampire fang`,
          shape: 'cone',
          point: { x: side * 0.035, height: 1.625, depth: 0.108 },
          size: { width: 0.022, height: 0.075, depth: 0.02 },
          color: '#f2e8dd',
        });
        getTransform(fang).rotation.x = 180;
        parts.push(fang);
      }
      parts.push(createPiece(character.id, {
        name: 'Clothing · Vampire cape',
        shape: 'rounded-cube',
        point: { x: 0, height: 1.22, depth: -0.14 },
        size: { width: 0.61, height: 0.75, depth: 0.075 },
        color: '#3a1728',
      }));
      parts.push(createPiece(character.id, {
        name: 'Clothing · Vampire collar',
        shape: 'rounded-cube',
        point: { x: 0, height: 1.56, depth: -0.04 },
        size: { width: 0.38, height: 0.2, depth: 0.08 },
        color: '#512036',
      }));
    } else if (species === 'monster') {
      const horned = /demon|devil|minotaur|gargoyle|monster|beast/i.test(monsterName);
      const winged = /demon|devil|gargoyle|harpy/i.test(monsterName);
      const tailed = /demon|devil|alien|beast|monster|dragon/i.test(monsterName);
      const hornColor = /skeleton/i.test(monsterName) ? '#d8d1bc' : '#463c35';
      if (horned) {
        for (const side of [-1, 1] as const) {
          parts.push(createPiece(character.id, {
            name: `Detail · ${displayName} ${side < 0 ? 'Left' : 'Right'} horn`,
            shape: 'cone',
            point: { x: side * 0.105, height: 1.83, depth: 0.01 },
            size: { width: 0.09, height: 0.29, depth: 0.09 },
            color: hornColor,
          }));
        }
      }
      if (winged) {
        for (const side of [-1, 1] as const) {
          parts.push(createPiece(character.id, {
            name: `Wing · ${displayName} ${side < 0 ? 'Left' : 'Right'} upper`,
            point: { x: side * 0.38, height: 1.4, depth: -0.08 },
            size: { width: 0.42, height: 0.15, depth: 0.18 },
            color: '#4a2734',
            shape: 'rounded-cube',
          }));
          parts.push(createPiece(character.id, {
            name: `Wing · ${displayName} ${side < 0 ? 'Left' : 'Right'} membrane`,
            point: { x: side * 0.58, height: 1.25, depth: -0.1 },
            size: { width: 0.38, height: 0.35, depth: 0.045 },
            color: '#7b3b45',
            shape: 'rounded-cube',
          }));
        }
      }
      if (tailed) {
        parts.push(createPiece(character.id, {
          name: `Skin · ${displayName} tail base`,
          point: { x: 0, height: 0.92, depth: -0.18 },
          size: { width: 0.15, height: 0.15, depth: 0.32 },
          color: skin,
        }));
        parts.push(createPiece(character.id, {
          name: `Skin · ${displayName} tail tip`,
          shape: 'cone',
          point: { x: 0, height: 0.75, depth: -0.48 },
          size: { width: 0.12, height: 0.2, depth: 0.12 },
          color: hornColor,
        }));
      }
      if (/skeleton|undead/i.test(monsterName)) {
        for (let rib = 0; rib < 4; rib++) {
          for (const side of [-1, 1] as const) {
            parts.push(createPiece(character.id, {
              name: `Bone · ${displayName} ${side < 0 ? 'Left' : 'Right'} rib ${rib + 1}`,
              shape: 'rounded-cube',
              point: { x: side * (0.12 - rib * 0.012), height: 1.43 - rib * 0.07, depth: 0.13 },
              size: { width: 0.18, height: 0.045, depth: 0.045 },
              color: '#e3dcc8',
            }));
          }
        }
      }
      if (/goblin|troll|ogre|demon|devil|monster|beast/i.test(monsterName)) {
        for (const side of [-1, 1] as const) {
          parts.push(createPiece(character.id, {
            name: `Claw · ${displayName} ${side < 0 ? 'Left' : 'Right'} hand`,
            shape: 'cone',
            point: { x: side * 0.95, height: 1.42, depth: 0.1 },
            size: { width: 0.05, height: 0.12, depth: 0.05 },
            color: hornColor,
          }));
        }
      }
    }
  }

  const baseHeight = species === 'wolf' ? 1.285 : species === 'orc' ? 1.815 : 1.8;
  const factor = heightMeters / baseHeight;
  for (const part of parts) {
    const transform = getTransform(part);
    transform.position = {
      x: 50 + (transform.position.x - 50) * factor,
      y: 50 + (transform.position.y - 50) * factor,
      z: 50 + (transform.position.z - 50) * factor,
    };
    transform.scale = {
      x: transform.scale.x * factor,
      y: transform.scale.y * factor,
      z: transform.scale.z * factor,
    };
  }

  const existingPartIds = new Set(starter.entities.map((entity) => entity.id));
  starter.entities.push(...parts.filter((part) => !existingPartIds.has(part.id)));
  const entities = starter.entities.filter((entity) =>
    entity.id === setup.id || entity.id === character.id || entity.parentId === character.id);
  return { entities, setupId: setup.id, characterId: character.id };
}
