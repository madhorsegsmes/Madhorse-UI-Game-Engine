import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createCharacterBuilderStarterScene } from './character-builder-starter';
import { createCharacterBodyMesh, isCharacterBodySurfacePart } from './character-builder-geometry';
import { createPrimitiveGeometry } from './scene-view-geometry';
import { getPrimitive, getTransform, type PrimitiveShape } from './scene-model';

export type ModelingDocument = { root: THREE.Group; clips: THREE.AnimationClip[]; name: string };
export type CharacterOptions = {
  height: number;
  build: number;
  skin: string;
  clothing: string;
  outfit: 'briefs' | 'tunic' | 'armor';
  helmet: boolean;
  boots: boolean;
  gloves: boolean;
  backpack: boolean;
};
export const DEFAULT_CHARACTER_OPTIONS: CharacterOptions = {
  height: 1.8, build: 1, skin: '#d5a07d', clothing: '#655580',
  outfit: 'briefs', helmet: false, boots: false, gloves: false, backpack: false,
};

export function documentMeshes(root: THREE.Object3D): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
  root.traverse((object) => { if (object instanceof THREE.Mesh) meshes.push(object); });
  return meshes;
}

export function documentBones(root: THREE.Object3D): THREE.Bone[] {
  const bones: THREE.Bone[] = [];
  root.traverse((object) => { if (object instanceof THREE.Bone) bones.push(object); });
  return bones;
}

const boneSpecs: [string, string | null, number, number, number][] = [
  ['Hips', null, 0, .99, 0], ['Spine', 'Hips', 0, .18, 0], ['Chest', 'Spine', 0, .23, 0],
  ['Neck', 'Chest', 0, .16, 0], ['Head', 'Neck', 0, .13, 0],
  ['LeftShoulder', 'Chest', -.23, .075, 0], ['LeftUpperArm', 'LeftShoulder', -.08, 0, 0],
  ['LeftForeArm', 'LeftUpperArm', -.30, 0, 0], ['LeftHand', 'LeftForeArm', -.285, 0, 0],
  ['LeftFingers', 'LeftHand', -.12, 0, .02],
  ['RightShoulder', 'Chest', .23, .075, 0], ['RightUpperArm', 'RightShoulder', .08, 0, 0],
  ['RightForeArm', 'RightUpperArm', .30, 0, 0], ['RightHand', 'RightForeArm', .285, 0, 0],
  ['RightFingers', 'RightHand', .12, 0, .02],
  ['LeftUpLeg', 'Hips', -.12, -.02, 0], ['LeftLeg', 'LeftUpLeg', 0, -.40, 0],
  ['LeftFoot', 'LeftLeg', 0, -.43, 0], ['LeftToe', 'LeftFoot', 0, -.035, .15],
  ['RightUpLeg', 'Hips', .12, -.02, 0], ['RightLeg', 'RightUpLeg', 0, -.40, 0],
  ['RightFoot', 'RightLeg', 0, -.43, 0], ['RightToe', 'RightFoot', 0, -.035, .15],
];

function assignSkin(geometry: THREE.BufferGeometry, bones: THREE.Bone[], rigidBone?: string) {
  const positions = geometry.getAttribute('position');
  const indices = new Uint16Array(positions.count * 4);
  const weights = new Float32Array(positions.count * 4);
  const segments = bones.map((bone) => {
    const a = bone.getWorldPosition(new THREE.Vector3());
    const child = bone.children.find((item) => item instanceof THREE.Bone);
    const b = child ? child.getWorldPosition(new THREE.Vector3()) : a.clone().add(new THREE.Vector3(0, .045, 0));
    return new THREE.Line3(a, b);
  });
  const point = new THREE.Vector3();
  const nearest = new THREE.Vector3();
  const rigidIndex = bones.findIndex((bone) => bone.name === rigidBone);
  for (let vertex = 0; vertex < positions.count; vertex++) {
    if (rigidIndex >= 0) {
      indices[vertex * 4] = rigidIndex;
      weights[vertex * 4] = 1;
      continue;
    }
    point.fromBufferAttribute(positions, vertex);
    const candidates = segments.map((segment, index) => {
      segment.closestPointToPoint(point, true, nearest);
      return { index, score: 1 / Math.pow(point.distanceTo(nearest) + .018, 4) };
    }).sort((a, b) => b.score - a.score).slice(0, 4);
    const total = candidates.reduce((sum, item) => sum + item.score, 0);
    candidates.forEach((item, channel) => {
      indices[vertex * 4 + channel] = item.index;
      weights[vertex * 4 + channel] = item.score / total;
    });
  }
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
}

function compactGeometry(source: THREE.BufferGeometry) {
  const count = Math.min(source.drawRange.count, source.getAttribute('position').count);
  const geometry = new THREE.BufferGeometry();
  for (const attribute of ['position', 'normal']) {
    const values = source.getAttribute(attribute);
    if (values) geometry.setAttribute(attribute, new THREE.Float32BufferAttribute(
      Array.from(values.array.slice(0, count * values.itemSize)), values.itemSize,
    ));
  }
  const merged = mergeVertices(geometry, .0001);
  geometry.dispose();
  return merged;
}

export function createModularCharacter(options: CharacterOptions): ModelingDocument {
  const root = new THREE.Group();
  root.name = 'Madhorse_Modular_Character';
  const bones = boneSpecs.map(([name, , x, y, z]) => {
    const bone = new THREE.Bone();
    bone.name = name;
    bone.position.set(x, y, z);
    return bone;
  });
  boneSpecs.forEach(([, parent], index) => {
    const parentIndex = boneSpecs.findIndex(([name]) => name === parent);
    if (parentIndex >= 0) bones[parentIndex].add(bones[index]);
    else root.add(bones[index]);
  });
  root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  const addSkin = (name: string, geometry: THREE.BufferGeometry, color: string, rigidBone?: string) => {
    assignSkin(geometry, bones, rigidBone);
    const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshStandardMaterial({
      color, roughness: .7, metalness: name.includes('Armor') || name.includes('Helmet') ? .35 : 0,
    }));
    mesh.name = name;
    root.add(mesh);
    root.updateMatrixWorld(true);
    mesh.bind(skeleton);
    mesh.frustumCulled = false;
    return mesh;
  };
  const piece = (name: string, shape: PrimitiveShape, point: number[], size: number[], color: string, bone?: string) => {
    const geometry = createPrimitiveGeometry(shape);
    geometry.scale(size[0], size[1], size[2]);
    geometry.translate(point[0], point[1], point[2]);
    return addSkin(name, geometry, color, bone);
  };

  const starter = createCharacterBuilderStarterScene();
  const parts = starter.entities.filter((entity) => entity.parentId === starter.characterId);
  for (const part of parts) {
    if (/\b(Chest|Abdomen|Pelvis|pectoral|oblique|deltoid|thigh)\b/.test(part.name)) {
      getTransform(part).scale.x *= options.build;
    }
  }
  const body = createCharacterBodyMesh(parts);
  if (!body) throw new Error('Could not create the character surface.');
  const bodyGeometry = compactGeometry(body.geometry);
  body.geometry.dispose();
  bodyGeometry.scale(body.halfExtents.x, body.halfExtents.y, body.halfExtents.z);
  bodyGeometry.translate(body.center.x, body.center.y, body.center.z);
  addSkin('Body_Smooth_Skin', bodyGeometry, options.skin);

  for (const part of parts) {
    if (isCharacterBodySurfacePart(part)) continue;
    if (part.name.startsWith('Clothing') && options.outfit !== 'briefs') continue;
    const primitive = getPrimitive(part);
    if (!primitive) continue;
    const transform = getTransform(part);
    const face = !part.name.startsWith('Clothing');
    piece(part.name.replaceAll(' · ', '_'), primitive.shape, [
      (transform.position.x - 50) / 10, (transform.position.z - 50) / 10, (transform.position.y - 50) / 10,
    ], [transform.scale.x, transform.scale.z, transform.scale.y],
    face ? primitive.color : options.clothing, face ? 'Head' : 'Hips');
  }
  if (options.outfit !== 'briefs') {
    const shirt = new THREE.LatheGeometry([
      new THREE.Vector2(.235, .88), new THREE.Vector2(.23, .98),
      new THREE.Vector2(.19, 1.15), new THREE.Vector2(.265, 1.42),
      new THREE.Vector2(.22, 1.53), new THREE.Vector2(.085, 1.57),
    ], 64);
    shirt.scale(1, 1, .64);
    addSkin(options.outfit === 'armor' ? 'Armor_Chest' : 'Tunic', shirt, options.clothing);
    piece('Belt', 'sphere', [0, 1.04, 0], [.45, .055, .28], '#373138', 'Hips');
    piece('Belt_Buckle', 'rounded-cube', [0, 1.04, .145], [.06, .055, .02], '#b9a477', 'Hips');
    if (options.outfit === 'armor') {
      for (const side of [-1, 1]) {
        piece(`${side < 0 ? 'Left' : 'Right'}_Shoulder_Armor`, 'sphere',
          [side * .28, 1.49, 0], [.27, .25, .26], options.clothing,
          side < 0 ? 'LeftUpperArm' : 'RightUpperArm');
      }
    }
  }
  for (const side of [-1, 1]) {
    const label = side < 0 ? 'Left' : 'Right';
    if (options.boots) {
      piece(`${label}_Boot`, 'sphere', [side * .12, .12, .075], [.145, .12, .3], '#292733', `${label}Foot`);
      piece(`${label}_Boot_Cuff`, 'capsule', [side * .12, .23, 0], [.23, .31, .23], options.clothing, `${label}Foot`);
    }
    if (options.gloves) piece(`${label}_Glove`, 'sphere', [side * .955, 1.475, .015],
      [.155, .12, .072], options.clothing, `${label}Hand`);
  }
  if (options.helmet) {
    piece('Helmet', 'sphere', [0, 1.725, -.01], [.23, .235, .22], options.clothing, 'Head');
    piece('Helmet_Visor', 'rounded-cube', [0, 1.71, .111], [.165, .065, .025], '#1e2d3c', 'Head');
  }
  if (options.backpack) {
    piece('Backpack', 'rounded-cube', [0, 1.34, -.21], [.30, .38, .18], options.clothing, 'Chest');
    piece('Backpack_Pocket', 'rounded-cube', [0, 1.26, -.32], [.23, .17, .06], '#34303b', 'Chest');
  }

  const quaternionTrack = (name: string, axis: THREE.Vector3, angle: number) => {
    const values: number[] = [];
    for (const amount of [0, angle, 0, -angle, 0]) {
      new THREE.Quaternion().setFromAxisAngle(axis, amount).toArray(values, values.length);
    }
    return new THREE.QuaternionKeyframeTrack(`${name}.quaternion`, [0, .5, 1, 1.5, 2], values);
  };
  const clips = [
    new THREE.AnimationClip('Idle breathing', 2, [quaternionTrack('Spine', new THREE.Vector3(1, 0, 0), .035)]),
    new THREE.AnimationClip('Rig mobility test', 2, [
      quaternionTrack('LeftUpperArm', new THREE.Vector3(0, 0, 1), .3),
      quaternionTrack('RightUpperArm', new THREE.Vector3(0, 0, 1), -.3),
      quaternionTrack('LeftLeg', new THREE.Vector3(1, 0, 0), .4),
      quaternionTrack('RightLeg', new THREE.Vector3(1, 0, 0), -.4),
    ]),
  ];
  root.scale.setScalar(options.height / 1.8);
  root.animations = clips;
  return { root, clips, name: 'Madhorse Character' };
}

export function disposeModelingDocument(document: ModelingDocument) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  documentMeshes(document.root).forEach((mesh) => {
    geometries.add(mesh.geometry);
    (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((material) => {
      materials.add(material);
      Object.values(material).forEach((value) => { if (value instanceof THREE.Texture) textures.add(value); });
    });
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  textures.forEach((texture) => texture.dispose());
  const skeletons = new Set(documentMeshes(document.root).filter(
    (mesh): mesh is THREE.SkinnedMesh => mesh instanceof THREE.SkinnedMesh,
  ).map((mesh) => mesh.skeleton));
  skeletons.forEach((skeleton) => skeleton.dispose());
}

export function normalizeVertexInfluence(mesh: THREE.SkinnedMesh, vertex: number, boneIndex: number, delta: number) {
  const indices = mesh.geometry.getAttribute('skinIndex');
  const weights = mesh.geometry.getAttribute('skinWeight');
  const entries = new Map<number, number>();
  for (let channel = 0; channel < 4; channel++) {
    const index = indices.array[vertex * 4 + channel];
    entries.set(index, (entries.get(index) ?? 0) + weights.array[vertex * 4 + channel]);
  }
  entries.set(boneIndex, Math.max(0, Math.min(1, (entries.get(boneIndex) ?? 0) + delta)));
  const strongest = [...entries].sort((a, b) => b[1] - a[1]).slice(0, 4);
  const total = strongest.reduce((sum, item) => sum + item[1], 0);
  for (let channel = 0; channel < 4; channel++) {
    indices.array[vertex * 4 + channel] = strongest[channel]?.[0] ?? 0;
    weights.array[vertex * 4 + channel] = total > 0 ? (strongest[channel]?.[1] ?? 0) / total : channel === 0 ? 1 : 0;
  }
  indices.needsUpdate = true;
  weights.needsUpdate = true;
}

export function appendRigBone(root: THREE.Group, parent: THREE.Bone) {
  const bone = new THREE.Bone();
  bone.name = `Joint_${documentBones(root).length + 1}`;
  bone.position.set(0, .1, 0);
  parent.add(bone);
  root.updateMatrixWorld(true);
  const replacements = new Map<THREE.Skeleton, THREE.Skeleton>();
  const meshes = documentMeshes(root).filter((mesh): mesh is THREE.SkinnedMesh => mesh instanceof THREE.SkinnedMesh);
  for (const mesh of meshes) {
    if (!mesh.skeleton.bones.includes(parent)) continue;
    const old = mesh.skeleton;
    if (!replacements.has(old)) replacements.set(old, new THREE.Skeleton(
      [...old.bones, bone],
      [...old.boneInverses.map((matrix) => matrix.clone()), bone.matrixWorld.clone().invert()],
    ));
    mesh.skeleton = replacements.get(old)!;
  }
  return {
    bone,
    undo: () => {
      bone.removeFromParent();
      meshes.forEach((mesh) => {
        for (const [old, replacement] of replacements) if (mesh.skeleton === replacement) mesh.skeleton = old;
      });
    },
    redo: () => {
      parent.add(bone);
      meshes.forEach((mesh) => { if (replacements.has(mesh.skeleton)) mesh.skeleton = replacements.get(mesh.skeleton)!; });
    },
  };
}
