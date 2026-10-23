import { getCamera, getWorldTransform, type SceneEntity, type Vector3 } from './scene-model';
import { PerspectiveCamera } from 'three';

/** Camera vectors use the same Y-up world coordinates as the Three renderer. */
export type GameCamera = {
  position: Vector3;
  target: Vector3;
  fov: number;
  placement?: 'north' | 'custom';
};

export function makeGameViewCamera(settings: GameCamera, aspect: number) {
  const camera = new PerspectiveCamera(settings.fov, aspect, 0.1, 1000);
  camera.position.set(settings.position.x, settings.position.y, settings.position.z);
  const vertical = Math.hypot(settings.target.x - settings.position.x, settings.target.z - settings.position.z) < 0.001;
  camera.up.set(0, vertical ? 0 : 1, vertical ? -1 : 0);
  camera.lookAt(settings.target.x, settings.target.y, settings.target.z);
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
    (camera.placement === undefined || camera.placement === 'north' || camera.placement === 'custom') &&
    Number.isFinite(camera.fov) && camera.fov >= 10 && camera.fov <= 100 &&
    Math.hypot(camera.position.x - camera.target.x, camera.position.y - camera.target.y,
      camera.position.z - camera.target.z) > 0.001);
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
  const position = getWorldTransform(entities, entity.id)!.position;
  const world = (value: Vector3) => ({ x: (value.x - 50) / 10, y: value.z / 10, z: (value.y - 50) / 10 });
  const settings: GameCamera = { position: world(position), target: world(component.target), fov: component.fov, placement: 'custom' };
  return isGameCamera(settings) ? settings : null;
}
