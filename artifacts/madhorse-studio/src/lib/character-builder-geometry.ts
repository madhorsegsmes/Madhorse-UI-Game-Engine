import * as THREE from 'three';
import { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js';
import { getTransform, type SceneEntity } from './scene-model';

const BODY_RESOLUTION = 44;
const MAX_BODY_TRIANGLES = 22_000;
const BODY_BLEND = 0.035;

export function isCharacterBuilderModelRoot(entity: SceneEntity) {
  return entity.generatedBy === 'character-builder'
    && entity.name.startsWith('Default Human');
}

export function isCharacterBodySurfacePart(part: SceneEntity | string) {
  const name = typeof part === 'string' ? part : part.name;
  return name.startsWith('Skin ·') && !/\b(eye|iris|brow)\b/i.test(name);
}

export type CharacterBodyMesh = {
  geometry: THREE.BufferGeometry;
  center: THREE.Vector3;
  halfExtents: THREE.Vector3;
};

type Ellipsoid = { center: THREE.Vector3; radii: THREE.Vector3 };

function smoothMinimum(a: number, b: number, blend: number) {
  if (!Number.isFinite(a)) return b;
  const h = Math.max(blend - Math.abs(a - b), 0) / blend;
  return Math.min(a, b) - h * h * blend * 0.25;
}

export function createCharacterBodyMesh(parts: SceneEntity[]): CharacterBodyMesh | null {
  const ellipsoids: Ellipsoid[] = parts
    .filter((part) => part.active && isCharacterBodySurfacePart(part))
    .map((part) => {
      const transform = getTransform(part);
      return {
        center: new THREE.Vector3(
          (transform.position.x - 50) / 10,
          (transform.position.z - 50) / 10,
          (transform.position.y - 50) / 10,
        ),
        radii: new THREE.Vector3(
          Math.max(0.018, Math.abs(transform.scale.x) / 2),
          Math.max(0.018, Math.abs(transform.scale.z) / 2),
          Math.max(0.018, Math.abs(transform.scale.y) / 2),
        ),
      };
    });

  if (ellipsoids.length < 4) return null;

  const min = new THREE.Vector3(Infinity, Infinity, Infinity);
  const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
  for (const part of ellipsoids) {
    min.min(part.center.clone().sub(part.radii));
    max.max(part.center.clone().add(part.radii));
  }
  // Leave more than the marching-cubes sampling margin around the target mesh.
  // A thin margin was smaller than the final unsampled rows and clipped the top
  // of the head (and fingertips) even though the source ellipsoids were complete.
  const padding = 0.22;
  min.addScalar(-padding);
  max.addScalar(padding);
  const center = min.clone().add(max).multiplyScalar(0.5);
  const halfExtents = max.clone().sub(min).multiplyScalar(0.5);

  const material = new THREE.MeshBasicMaterial();
  const surface = new MarchingCubes(BODY_RESOLUTION, material, false, false, MAX_BODY_TRIANGLES);
  surface.isolation = 0;
  surface.reset();
  // Unvisited boundary samples must also be outside the zero isosurface.
  // Leaving reset()'s zero values here creates a flat shell around the body.
  surface.field.fill(-1);

  const size = surface.size;
  const halfsize = surface.halfsize;
  for (let z = 1; z < size - 2; z++) {
    const worldZ = center.z + ((z - halfsize) / halfsize) * halfExtents.z;
    const zOffset = size * size * z;
    for (let y = 1; y < size - 2; y++) {
      const worldY = center.y + ((y - halfsize) / halfsize) * halfExtents.y;
      const yOffset = zOffset + size * y;
      for (let x = 1; x < size - 2; x++) {
        const worldX = center.x + ((x - halfsize) / halfsize) * halfExtents.x;
        let distance = Infinity;

        for (const ellipsoid of ellipsoids) {
          const dx = (worldX - ellipsoid.center.x) / ellipsoid.radii.x;
          const dy = (worldY - ellipsoid.center.y) / ellipsoid.radii.y;
          const dz = (worldZ - ellipsoid.center.z) / ellipsoid.radii.z;
          const approximateDistance = (Math.sqrt(dx * dx + dy * dy + dz * dz) - 1)
            * Math.min(ellipsoid.radii.x, ellipsoid.radii.y, ellipsoid.radii.z);
          distance = smoothMinimum(distance, approximateDistance, BODY_BLEND);
        }

        surface.field[yOffset + x] = -distance;
      }
    }
  }

  surface.update();
  const triangleVertices = surface.geometry.drawRange.count;
  if (triangleVertices < 3) {
    surface.geometry.dispose();
    material.dispose();
    return null;
  }

  const geometry = surface.geometry.clone();
  geometry.setDrawRange(0, triangleVertices);
  geometry.computeBoundingSphere();
  surface.geometry.dispose();
  material.dispose();
  return { geometry, center, halfExtents };
}
