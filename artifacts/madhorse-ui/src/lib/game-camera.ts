import { getWorldTransform, type SceneEntity, type Vector3 } from './scene-model';
import { PerspectiveCamera } from 'three';

/** Camera vectors use the same Y-up world coordinates as the Three renderer. */
export type GameCamera = {
  position: Vector3;
  target: Vector3;
  fov: number;
};

export function makeGameViewCamera(settings: GameCamera, aspect: number) {
  const camera = new PerspectiveCamera(settings.fov, aspect, 0.1, 1000);
  camera.position.set(settings.position.x, settings.position.y, settings.position.z);
  camera.up.set(0, 0, -1);
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
    position: { x: target.x, y: target.y + 12, z: target.z },
    target,
    fov: 50,
  };
}

export function isGameCamera(value: unknown): value is GameCamera {
  if (!value || typeof value !== 'object') return false;
  const camera = value as GameCamera;
  const vector = (entry: Vector3 | undefined) => entry &&
    [entry.x, entry.y, entry.z].every((number) =>
      typeof number === 'number' && Number.isFinite(number) && Math.abs(number) <= 100_000);
  return Boolean(vector(camera.position) && vector(camera.target) &&
    Number.isFinite(camera.fov) && camera.fov >= 10 && camera.fov <= 100 &&
    Math.hypot(camera.position.x - camera.target.x, camera.position.y - camera.target.y,
      camera.position.z - camera.target.z) > 0.001);
}
