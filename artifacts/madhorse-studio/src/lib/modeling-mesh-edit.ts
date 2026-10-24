import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

function indexedCopy(geometry: THREE.BufferGeometry) {
  if (geometry.morphAttributes.position?.length) {
    throw new Error('Apply or remove shape keys in Blender before editing this mesh here.');
  }
  return geometry.index ? geometry.clone() : mergeVertices(geometry, 1e-5);
}

function faceIndices(geometry: THREE.BufferGeometry, face: number): [number, number, number] {
  const index = geometry.index;
  const vertices = index
    ? [index.getX(face * 3), index.getX(face * 3 + 1), index.getX(face * 3 + 2)]
    : [face * 3, face * 3 + 1, face * 3 + 2];
  if (vertices.some((vertex) => vertex < 0 || vertex >= geometry.getAttribute('position').count)) {
    throw new Error('That face is no longer available. Select the face again.');
  }
  return vertices as [number, number, number];
}

function materialForFace(geometry: THREE.BufferGeometry, face: number) {
  const offset = face * 3;
  return geometry.groups.find((group) => offset >= group.start && offset < group.start + group.count)?.materialIndex ?? 0;
}

function attributeArrays(geometry: THREE.BufferGeometry) {
  const arrays = new Map<string, { itemSize: number; values: number[] }>();
  for (const [name, attribute] of Object.entries(geometry.attributes)) {
    const values: number[] = [];
    for (let vertex = 0; vertex < attribute.count; vertex++) {
      for (let component = 0; component < attribute.itemSize; component++) values.push(attribute.getComponent(vertex, component));
    }
    arrays.set(name, { itemSize: attribute.itemSize, values });
  }
  return arrays;
}

function emitVertex(
  arrays: Map<string, { itemSize: number; values: number[] }>,
  geometry: THREE.BufferGeometry,
  sourceVertex: number,
  offset?: THREE.Vector3,
  normal?: THREE.Vector3,
) {
  const newIndex = arrays.get('position')!.values.length / 3;
  for (const [name, target] of arrays) {
    const source = geometry.getAttribute(name);
    for (let component = 0; component < target.itemSize; component++) {
      const value = name === 'position' && offset
        ? source.getComponent(sourceVertex, component) + (component === 0 ? offset.x : component === 1 ? offset.y : offset.z)
        : name === 'normal' && normal
          ? (component === 0 ? normal.x : component === 1 ? normal.y : normal.z)
          : source.getComponent(sourceVertex, component);
      target.values.push(value);
    }
  }
  return newIndex;
}

function emitTriangle(groups: Map<number, number[]>, materialIndex: number, a: number, b: number, c: number) {
  const indices = groups.get(materialIndex) ?? [];
  indices.push(a, b, c);
  groups.set(materialIndex, indices);
}

function assemble(
  source: THREE.BufferGeometry,
  arrays: Map<string, { itemSize: number; values: number[] }>,
  originalIndex: number[],
  appendedByMaterial: Map<number, number[]>,
) {
  const result = new THREE.BufferGeometry();
  for (const [name, { itemSize, values }] of arrays) {
    result.setAttribute(name, new THREE.Float32BufferAttribute(values, itemSize));
  }
  const outputIndex = originalIndex.slice();
  for (const [materialIndex, extra] of appendedByMaterial) {
    const start = outputIndex.length;
    outputIndex.push(...extra);
    if (extra.length) result.addGroup(start, extra.length, materialIndex);
  }
  if (source.groups.length) {
    const extraGroups = result.groups.slice();
    result.clearGroups();
    source.groups.forEach((group) => result.addGroup(group.start, group.count, group.materialIndex));
    extraGroups.forEach((group) => result.addGroup(group.start, group.count, group.materialIndex));
  } else {
    result.clearGroups();
    result.addGroup(0, outputIndex.length, 0);
  }
  const Index = arrays.get('position')!.values.length > 65535 ? Uint32Array : Uint16Array;
  result.setIndex(new THREE.BufferAttribute(new Index(outputIndex), 1));
  return result;
}

export function createExtrudedGeometry(
  geometry: THREE.BufferGeometry,
  faces: number[],
  distance = .2,
) {
  if (!faces.length || !Number.isFinite(distance) || Math.abs(distance) < .001 || Math.abs(distance) > 10) {
    throw new Error('Select at least one face and use an extrusion distance between 0.001 m and 10 m.');
  }
  const source = indexedCopy(geometry);
  const arrays = attributeArrays(source);
  const outputIndex = Array.from(source.index!.array as ArrayLike<number>);
  const groups = new Map<number, number[]>();
  const positions = source.getAttribute('position');
  const triangleCount = outputIndex.length / 3;
  const normals = Array.from({ length: triangleCount }, (_, face) => {
    const [a, b, c] = faceIndices(source, face);
    return new THREE.Vector3().fromBufferAttribute(positions, b)
      .sub(new THREE.Vector3().fromBufferAttribute(positions, a))
      .cross(new THREE.Vector3().fromBufferAttribute(positions, c).sub(new THREE.Vector3().fromBufferAttribute(positions, a))).normalize();
  });
  const edges = new Map<string, Array<{ face: number; a: number; b: number }>>();
  for (let face = 0; face < triangleCount; face++) {
    const [a, b, c] = faceIndices(source, face);
    for (const [from, to] of [[a, b], [b, c], [c, a]]) {
      const key = from < to ? `${from}:${to}` : `${to}:${from}`;
      const edge = edges.get(key) ?? [];
      edge.push({ face, a: from, b: to });
      edges.set(key, edge);
    }
  }
  const remaining = new Set([...new Set(faces)].filter((face) =>
    Number.isInteger(face) && face >= 0 && face < triangleCount && normals[face].lengthSq() > .5,
  ));
  if (!remaining.size) throw new Error('Select a valid face before extruding.');
  const patches: number[][] = [];
  const visited = new Set<number>();
  while (remaining.size) {
    const seed = remaining.values().next().value as number;
    remaining.delete(seed);
    if (visited.has(seed)) continue;
    const patch = [seed];
    const frontier = [seed];
    visited.add(seed);
    while (frontier.length && patch.length < 2048) {
      const current = frontier.pop()!;
      const [a, b, c] = faceIndices(source, current);
      for (const [from, to] of [[a, b], [b, c], [c, a]]) {
        const key = from < to ? `${from}:${to}` : `${to}:${from}`;
        for (const neighbor of edges.get(key) ?? []) {
          const adjacent = neighbor.face;
          if (visited.has(adjacent) || materialForFace(source, adjacent) !== materialForFace(source, current)) continue;
          if (normals[adjacent].dot(normals[current]) < .99999) continue;
          visited.add(adjacent); remaining.delete(adjacent); patch.push(adjacent); frontier.push(adjacent);
        }
      }
    }
    patches.push(patch);
  }
  for (const patch of patches) {
    const patchSet = new Set(patch);
    const capVertex = new Map<number, number>();
    const patchNormal = normals[patch[0]].clone();
    const offset = patchNormal.clone().multiplyScalar(distance);
    for (const face of patch) {
      const materialIndex = materialForFace(source, face);
      const vertices = faceIndices(source, face);
      const cap = vertices.map((vertex) => {
        if (!capVertex.has(vertex)) capVertex.set(vertex, emitVertex(arrays, source, vertex, offset));
        return capVertex.get(vertex)!;
      });
      emitTriangle(groups, materialIndex, cap[0], cap[1], cap[2]);
    }
    for (const face of patch) {
      const materialIndex = materialForFace(source, face);
      const [a, b, c] = faceIndices(source, face);
      for (const [from, to] of [[a, b], [b, c], [c, a]]) {
        const key = from < to ? `${from}:${to}` : `${to}:${from}`;
        const internal = (edges.get(key) ?? []).some((edge) => edge.face !== face
          && patchSet.has(edge.face) && normals[edge.face].dot(normals[face]) >= .99999);
        if (internal) continue;
        const fromPoint = new THREE.Vector3().fromBufferAttribute(positions, from);
        const toPoint = new THREE.Vector3().fromBufferAttribute(positions, to);
        const sideNormal = toPoint.clone().sub(fromPoint).cross(offset).normalize();
        const bottomA = emitVertex(arrays, source, from, undefined, sideNormal);
        const bottomB = emitVertex(arrays, source, to, undefined, sideNormal);
        const sideTopB = emitVertex(arrays, source, to, offset, sideNormal);
        const sideTopA = emitVertex(arrays, source, from, offset, sideNormal);
        emitTriangle(groups, materialIndex, bottomA, bottomB, sideTopB);
        emitTriangle(groups, materialIndex, bottomA, sideTopB, sideTopA);
      }
    }
  }
  const result = assemble(source, arrays, outputIndex, groups);
  if (source !== geometry) source.dispose();
  return result;
}

export function createSubdividedGeometry(geometry: THREE.BufferGeometry, faces: number[]) {
  if (!faces.length) throw new Error('Select a face before subdividing.');
  const source = indexedCopy(geometry);
  const arrays = attributeArrays(source);
  const positions = source.getAttribute('position');
  const sourceIndex = source.index!;
  const selected = new Set(faces);
  const midpointCache = new Map<string, number>();
  const midpoint = (a: number, b: number) => {
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    const cached = midpointCache.get(key);
    if (cached !== undefined) return cached;
    const index = arrays.get('position')!.values.length / 3;
    for (const [name, target] of arrays) {
      const attribute = source.getAttribute(name);
      for (let component = 0; component < target.itemSize; component++) {
        const value = (attribute.getComponent(a, component) + attribute.getComponent(b, component)) / 2;
        target.values.push(name === 'normal' ? value : value);
      }
    }
    midpointCache.set(key, index);
    return index;
  };
  const byMaterial = new Map<number, number[]>();
  for (let face = 0; face < sourceIndex.count / 3; face++) {
    const [a, b, c] = faceIndices(source, face);
    const materialIndex = materialForFace(source, face);
    if (!selected.has(face)) { emitTriangle(byMaterial, materialIndex, a, b, c); continue; }
    const ab = midpoint(a, b), bc = midpoint(b, c), ca = midpoint(c, a);
    emitTriangle(byMaterial, materialIndex, a, ab, ca);
    emitTriangle(byMaterial, materialIndex, ab, b, bc);
    emitTriangle(byMaterial, materialIndex, ca, bc, c);
    emitTriangle(byMaterial, materialIndex, ab, bc, ca);
  }
  const indexValues: number[] = [];
  const materialGroups = new Map<number, number[]>();
  for (const [material, indices] of byMaterial) {
    materialGroups.set(material, indices);
    indexValues.push(...indices);
  }
  const result = new THREE.BufferGeometry();
  for (const [name, { itemSize, values }] of arrays) result.setAttribute(name, new THREE.Float32BufferAttribute(values, itemSize));
  const Index = arrays.get('position')!.values.length / 3 > 65535 ? Uint32Array : Uint16Array;
  result.setIndex(new THREE.BufferAttribute(new Index(indexValues), 1));
  let start = 0;
  for (const [materialIndex, indices] of materialGroups) { result.addGroup(start, indices.length, materialIndex); start += indices.length; }
  result.computeVertexNormals();
  source.dispose();
  return result;
}

export function selectedFaceTriangle(geometry: THREE.BufferGeometry, face: number) {
  const source = geometry.index ? geometry : mergeVertices(geometry, 1e-5);
  const vertices = faceIndices(source, face);
  return vertices.map((vertex) => new THREE.Vector3().fromBufferAttribute(source.getAttribute('position'), vertex));
}
