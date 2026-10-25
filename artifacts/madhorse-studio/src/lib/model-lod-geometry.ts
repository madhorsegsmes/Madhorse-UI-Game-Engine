import * as THREE from 'three';
import { canQueueModelLod, generateModelLod } from './model-lod-worker-client';

/** Compact actual retained vertices, preserving raw normalized/interleaved attributes. */
export function compactLodGeometry(source: THREE.BufferGeometry, indices: Uint32Array): THREE.BufferGeometry {
  const remap = new Map<number, number>();
  const vertices: number[] = [];
  const compact = new Uint32Array(indices.length);
  indices.forEach((index, offset) => {
    if (!remap.has(index)) { remap.set(index, vertices.length); vertices.push(index); }
    compact[offset] = remap.get(index)!;
  });
  const geometry = new THREE.BufferGeometry();
  for (const [name, attribute] of Object.entries(source.attributes)) {
    const interleaved = attribute instanceof THREE.InterleavedBufferAttribute;
    const original = interleaved ? attribute.data.array : attribute.array;
    const Constructor = original.constructor as { new(length: number): typeof original };
    const array = new Constructor(vertices.length * attribute.itemSize);
    const stride = interleaved ? attribute.data.stride : attribute.itemSize;
    const start = interleaved ? attribute.offset : 0;
    vertices.forEach((vertex, index) => {
      for (let item = 0; item < attribute.itemSize; item++) {
        array[index * attribute.itemSize + item] = original[vertex * stride + start + item];
      }
    });
    const result = new THREE.BufferAttribute(array, attribute.itemSize, attribute.normalized);
    if (!interleaved) result.gpuType = attribute.gpuType;
    geometry.setAttribute(name, result);
  }
  geometry.setIndex(new THREE.BufferAttribute(compact, 1));
  geometry.boundingBox = source.boundingBox?.clone() ?? null;
  geometry.boundingSphere = source.boundingSphere?.clone() ?? null;
  return geometry;
}
export function modelLodEligibility(mesh: THREE.Mesh): string | null {
  const geometry = mesh.geometry, position = geometry.getAttribute('position');
  if ((mesh as THREE.SkinnedMesh).isSkinnedMesh || Object.values(geometry.morphAttributes).some(values => values.length)) return 'Animated/skinned geometry stays full detail.';
  if (Array.isArray(mesh.material)) return 'Multi-material meshes stay full detail.';
  if (!geometry.index || !position || geometry.index.count < 384) return 'Mesh is too small or non-indexed.';
  if (position.count > 100_000 || geometry.index.count > 600_000) return 'Mesh exceeds the safe generation budget.';
  if (geometry.drawRange.start !== 0 || geometry.drawRange.count < geometry.index.count) return 'Partial draw ranges stay full detail.';
  let bytes = 0;
  for (const attribute of Object.values(geometry.attributes)) {
    if (attribute.count !== position.count || 'isInstancedBufferAttribute' in attribute ||
      'isFloat16BufferAttribute' in attribute) return 'Unsupported attribute layout stays full detail.';
    bytes += attribute.count * attribute.itemSize * attribute.array.BYTES_PER_ELEMENT;
  }
  return bytes > 16 * 1024 * 1024 ? 'Vertex attributes exceed the safe generation budget.' : null;
}
type RecordEntry = { refs: number; levels: THREE.BufferGeometry[]; bytes: number; ready: Promise<THREE.BufferGeometry[]> };
const cache = new WeakMap<THREE.BufferGeometry, RecordEntry>();
let residentBytes = 0;
const memoryLimit = 32 * 1024 * 1024;
export function acquireModelLod(source: THREE.BufferGeometry) {
  let record = cache.get(source);
  if (!record && !canQueueModelLod()) {
    return { ready: Promise.reject<THREE.BufferGeometry[]>(new Error('Detail worker queue unavailable; keeping original geometry.')), release() {} };
  }
  if (!record) {
    const entry: RecordEntry = { refs: 0, levels: [], bytes: 0, ready: Promise.resolve([]) };
    cache.set(source, entry);
    const position = source.getAttribute('position');
    const positions = new Float32Array(position.count * 3);
    for (let i = 0; i < position.count; i++) {
      positions[i * 3] = position.getX(i);
      positions[i * 3 + 1] = position.getY(i);
      positions[i * 3 + 2] = position.getZ(i);
    }
    entry.ready = generateModelLod({ positions, indices: new Uint32Array(source.index!.array) }).then(async results => {
      const levels = [source];
      try {
        for (const indices of results) {
          if (entry.refs <= 0) throw new Error('Detail request released.');
          if (indices.length < 3 || indices.length >= source.index!.count) { levels.push(source); continue; }
          const geometry = compactLodGeometry(source, indices);
          const bytes = Object.values(geometry.attributes).reduce((sum, item) => sum + item.array.byteLength, geometry.index!.array.byteLength);
          if (residentBytes + bytes > memoryLimit) { geometry.dispose(); throw new Error('Generated detail memory budget reached.'); }
          residentBytes += bytes; entry.bytes += bytes; entry.levels.push(geometry);
          levels.push(geometry);
          await new Promise(resolve => setTimeout(resolve, 0));
        }
        if (levels.every(level => level === source)) throw new Error('Topology/error limits prevented a safe reduction.');
        return levels;
      } catch (error) {
        entry.levels.forEach(level => level.dispose()); entry.levels = [];
        residentBytes -= entry.bytes; entry.bytes = 0;
        throw error;
      }
    });
    record = entry;
  }
  record.refs++;
  const entry = record;
  let released = false;
  return { ready: entry.ready, release() {
    if (released) return;
    released = true;
    if (--entry.refs === 0) {
      cache.delete(source);
      entry.levels.forEach(level => level.dispose()); entry.levels = [];
      residentBytes -= entry.bytes; entry.bytes = 0;
    }
  } };
}
