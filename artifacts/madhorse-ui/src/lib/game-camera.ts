import { getCamera, getWorldTransform, getTransform, type SceneEntity, type Vector3 } from './scene-model';
import { Euler, Matrix4, MathUtils, PerspectiveCamera, Quaternion, Vector3 as ThreeVector } from 'three';

/** Camera vectors use the same Y-up world coordinates as the Three renderer. */
export type GameCamera = {
  position: Vector3;
  target: Vector3;
  fov: number;
  placement?: 'north' | 'custom';
  /** Optional full world orientation in XYZ degrees, including roll. */
  rotation?: Vector3;
};

export function makeGameViewCamera(settings: GameCamera, aspect: number) {
  const camera = new PerspectiveCamera(settings.fov, aspect, 0.1, 1000);
  camera.position.set(settings.position.x, settings.position.y, settings.position.z);
  const vertical = Math.hypot(settings.target.x - settings.position.x, settings.target.z - settings.position.z) < 0.001;
  camera.up.set(0, vertical ? 0 : 1, vertical ? -1 : 0);
  if (settings.rotation) camera.rotation.set(
    MathUtils.degToRad(settings.rotation.x), MathUtils.degToRad(settings.rotation.y),
    MathUtils.degToRad(settings.rotation.z), 'XYZ',
  );
  else camera.lookAt(settings.target.x, settings.target.y, settings.target.z);
  camera.updateMatrixWorld();
  return camera;
}

export function createGameCamera(entities: SceneEntity[]): GameCamera {
  const square = getWorldTransform(entities, 'player');
  const target = square ? {
    x: (square.position.x - 50) / 10,
    y: square.position.z / 10,
    z: (square.position.y - 50) / 10,
  } : { x: 0, y: 0, z: 0 };
  return {
    position: { x: target.x, y: target.y + 6, z: target.z - 8 },
    target,
    fov: 50,
    placement: 'north',
  };
}

export function isGameCamera(value: unknown): value is GameCamera {
  if (!value || typeof value !== 'object') return false;
  const camera = value as GameCamera;
  const vector = (entry: Vector3 | undefined) => entry &&
    [entry.x, entry.y, entry.z].every((number) =>
      typeof number === 'number' && Number.isFinite(number) && Math.abs(number) <= 100_000);
  return Boolean(vector(camera.position) && vector(camera.target) &&
    (camera.rotation === undefined || vector(camera.rotation)) &&
    (camera.placement === undefined || camera.placement === 'north' || camera.placement === 'custom') &&
    Number.isFinite(camera.fov) && camera.fov >= 10 && camera.fov <= 100 &&
    Math.hypot(camera.position.x - camera.target.x, camera.position.y - camera.target.y,
      camera.position.z - camera.target.z) > 0.001);
}

/** Match the renderer's real parent TRS chain, including pitch/roll and scale. */
export function cameraWorldMatrix(entities: SceneEntity[], id: string): Matrix4 | null {
  const chain: SceneEntity[] = [];
  const visited = new Set<string>();
  let current = entities.find((entity) => entity.id === id);
  while (current) {
    if (visited.has(current.id) || chain.length >= 64) return null;
    visited.add(current.id); chain.push(current);
    if (!current.parentId) break;
    current = entities.find((entity) => entity.id === current!.parentId);
    if (!current) return null;
  }
  if (!chain.length) return null;
  const result = new Matrix4();
  for (const entity of chain.reverse()) {
    const transform = getTransform(entity);
    const position = new ThreeVector((transform.position.x - 50) / 10,
      (transform.position.z - (entity.parentId ? 50 : 0)) / 10, (transform.position.y - 50) / 10);
    const rotation = new Quaternion().setFromEuler(new Euler(
      MathUtils.degToRad(-transform.rotation.x), MathUtils.degToRad(-transform.rotation.z),
      MathUtils.degToRad(-transform.rotation.y), 'XYZ',
    ));
    result.multiply(new Matrix4().compose(position, rotation,
      new ThreeVector(transform.scale.x, transform.scale.z, transform.scale.y)));
  }
  return result.elements.every(Number.isFinite) ? result : null;
}

export function cameraForEntity(entities: SceneEntity[], id: string | null | undefined): GameCamera | null {
  const entity = entities.find((entry) => entry.id === id);
  const component = entity && getCamera(entity);
  if (!entity || !component?.enabled) return null;
  let current: SceneEntity | undefined = entity;
  const visited = new Set<string>();
  while (current) {
    if (!current.active || visited.has(current.id)) return null;
    visited.add(current.id);
    current = entities.find((entry) => entry.id === current!.parentId);
  }
  const matrix = cameraWorldMatrix(entities, entity.id);
  if (!matrix) return null;
  const eye = new ThreeVector(), orientation = new Quaternion();
  matrix.decompose(eye, orientation, new ThreeVector());
  orientation.normalize();
  const world = (value: Vector3) => ({ x: (value.x - 50) / 10, y: value.z / 10, z: (value.y - 50) / 10 });
  const settings: GameCamera = { position: { x: eye.x, y: eye.y, z: eye.z }, target: world(component.target), fov: component.fov, placement: 'custom' };
  if (component.useTransformRotation) {
    const euler = new Euler().setFromQuaternion(orientation, 'XYZ');
    settings.rotation = { x: MathUtils.radToDeg(euler.x), y: MathUtils.radToDeg(euler.y), z: MathUtils.radToDeg(euler.z) };
    const distance = Math.max(.1, Math.min(1000, eye.distanceTo(new ThreeVector(settings.target.x, settings.target.y, settings.target.z))));
    const target = new ThreeVector(0, 0, -1).applyQuaternion(orientation).multiplyScalar(distance).add(eye);
    settings.target = { x: target.x, y: target.y, z: target.z };
  }
  return isGameCamera(settings) ? settings : null;
}
