import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {
  getModelRenderer, getPrimitive, getSpriteRenderer, getWorldTransform,
  type PrimitiveShape, type TerrainSettings, type SceneEntity,
} from './scene-model';
import type { GameCamera } from './game-camera';

export function createPrimitiveGeometry(shape: PrimitiveShape, terrainSettings?: TerrainSettings) {
  switch (shape) {
    case 'cube': return new THREE.BoxGeometry(1, 1, 1);
    case 'sphere': return new THREE.SphereGeometry(.5, 24, 16);
    case 'capsule': return new THREE.CapsuleGeometry(.28, .44, 6, 12);
    case 'cylinder': return new THREE.CylinderGeometry(.5, .5, 1, 24);
    case 'cone': return new THREE.ConeGeometry(.5, 1, 24);
    case 'plane': {
      const geometry = new THREE.PlaneGeometry(10, 10);
      geometry.rotateX(-Math.PI / 2);
      return geometry;
    }
    case 'circle': {
      const geometry = new THREE.CircleGeometry(.5, 32);
      geometry.rotateX(-Math.PI / 2);
      return geometry;
    }
    case 'ring': {
      const geometry = new THREE.RingGeometry(.24, .5, 32);
      geometry.rotateX(-Math.PI / 2);
      return geometry;
    }
    case 'torus': return new THREE.TorusGeometry(.34, .16, 12, 32);
    case 'torus-knot': return new THREE.TorusKnotGeometry(.3, .11, 80, 10, 2, 3);
    case 'icosahedron': return new THREE.IcosahedronGeometry(.55, 0);
    case 'dodecahedron': return new THREE.DodecahedronGeometry(.55, 0);
    case 'octahedron': return new THREE.OctahedronGeometry(.55, 0);
    case 'tetrahedron': return new THREE.TetrahedronGeometry(.62, 0);
    case 'pyramid': return new THREE.ConeGeometry(.58, 1, 4);
    case 'triangular-prism': return new THREE.CylinderGeometry(.58, .58, 1, 3, 1);
    case 'wedge': {
      const profile = new THREE.Shape();
      profile.moveTo(-.5, -.5);
      profile.lineTo(.5, -.5);
      profile.lineTo(.5, .5);
      profile.closePath();
      const geometry = new THREE.ExtrudeGeometry(profile, { depth: 1, bevelEnabled: false });
      geometry.translate(0, 0, -.5);
      return geometry;
    }
    case 'tube': {
      const path = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-.45, -.3, 0),
        new THREE.Vector3(-.2, .3, 0),
        new THREE.Vector3(.2, -.3, .1),
        new THREE.Vector3(.45, .3, .2),
      ]);
      return new THREE.TubeGeometry(path, 40, .12, 10, false);
    }
    case 'hollow-cylinder': return new THREE.CylinderGeometry(.5, .5, 1, 24, 1, true);
    case 'rounded-cube': return new RoundedBoxGeometry(1, 1, 1, 3, .12);
    case 'terrain': return createTerrainGeometry(terrainSettings);
  }
}

function createTerrainGeometry(settings?: TerrainSettings) {
  const width = settings?.width ?? 20;
  const depth = settings?.depth ?? 20;
  const geometry = new THREE.PlaneGeometry(width, depth, 64, 64);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.getAttribute('position');
  for (let index = 0; index < positions.count; index++) {
    const x = positions.getX(index);
    const z = positions.getZ(index);
    if (!settings) {
      positions.setY(index, Math.sin(x * .45) * Math.cos(z * .4) * .65 - .05);
      continue;
    }
    const nx = x / Math.max(width / 2, .5);
    const nz = z / Math.max(depth / 2, .5);
    const base = Math.sin(x * .45) * Math.cos(z * .4) * settings.height * .08;
    const ridge = Math.max(0, Math.sin(nx * 3.5 + Math.cos(nz * 2.4))) * settings.mountainHeight * .08;
    let river = 0;
    for (let i = 0; i < settings.riverCount; i++) {
      const center = Math.sin(nz * 3 + i * 2.4) * width * .16 + (i - (settings.riverCount - 1) / 2) * width * .16;
      const distance = Math.abs(x - center);
      const bankWidth = Math.max(width * .025, .1);
      river = Math.max(river, settings.riverDepth * .08 * Math.max(0, 1 - distance / bankWidth));
    }
    positions.setY(index, base + ridge - river);
  }
  geometry.computeVertexNormals();
  return geometry;
}

export function sceneFrameDistance(settings: GameCamera, aspect: number, fov = 48) {
  const eye = new THREE.Vector3(settings.position.x, settings.position.y, settings.position.z);
  const target = new THREE.Vector3(settings.target.x, settings.target.y, settings.target.z);
  const radius = eye.distanceTo(target) / 2 + 2.4;
  const angle = Math.min(fov * Math.PI / 360, Math.atan(Math.tan(fov * Math.PI / 360) * Math.max(.1, aspect)));
  return radius / Math.sin(angle) * 1.08;
}

export type SceneFocus = { center: { x: number; y: number; z: number }; radius: number };

export function sceneEntityFocus(entities: SceneEntity[], rootId: string): SceneFocus | null {
  const members = new Set([rootId]);
  for (let count = 0, changed = true; changed && count < entities.length; count++) {
    changed = false;
    for (const entity of entities) if (entity.parentId && members.has(entity.parentId) && !members.has(entity.id)) {
      members.add(entity.id); changed = true;
    }
  }
  const bounds = new THREE.Box3();
  for (const entity of entities) {
    if (!members.has(entity.id) || entity.isGroup) continue;
    const primitive = getPrimitive(entity);
    const sprite = getSpriteRenderer(entity);
    const model = getModelRenderer(entity);
    if (!primitive && !sprite && !model) continue;
    const transform = getWorldTransform(entities, entity.id);
    if (!transform) continue;
    const base = primitive?.shape === 'plane' ? 10 : primitive?.shape === 'terrain' ? 20 : model ? 4 : 1;
    const radius = sprite
      ? Math.hypot(sprite.width * transform.scale.x / 10, sprite.height * transform.scale.y / 10) / 2
      : Math.hypot(transform.scale.x, transform.scale.y, transform.scale.z) * base / 2;
    const point = new THREE.Vector3((transform.position.x - 50) / 10, transform.position.z / 10, (transform.position.y - 50) / 10);
    bounds.expandByPoint(point.clone().addScalar(radius));
    bounds.expandByPoint(point.clone().addScalar(-radius));
  }
  if (bounds.isEmpty()) return null;
  const sphere = bounds.getBoundingSphere(new THREE.Sphere());
  return { center: { x: sphere.center.x, y: sphere.center.y, z: sphere.center.z }, radius: Math.max(1, sphere.radius) };
}
