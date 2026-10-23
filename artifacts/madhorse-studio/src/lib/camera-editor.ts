import { Euler, MathUtils, Quaternion, Vector3 as ThreeVector } from 'three';
import { cameraForEntity, cameraWorldMatrix, isGameCamera, makeGameViewCamera, type GameCamera } from './game-camera';
import { getCamera, getTransform, isSceneGraph, type SceneEntity, type TransformComponent, type Vector3 } from './scene-model';

export const PRIMARY_CAMERA_ID = '__madhorse-main-camera__';
type Changes = Partial<Pick<TransformComponent, 'position' | 'rotation' | 'scale'>>;
const degrees = (euler: Euler): Vector3 => ({
  x: MathUtils.radToDeg(euler.x), y: MathUtils.radToDeg(euler.y), z: MathUtils.radToDeg(euler.z),
});
export function cameraEuler(settings: GameCamera): Vector3 {
  return degrees(makeGameViewCamera(settings, 16 / 9).rotation);
}

export function cameraWithPose(previous: GameCamera, changes: { position?: Vector3; rotation?: Vector3; fov?: number }): GameCamera | null {
  const position = changes.position ?? previous.position;
  const rotation = changes.rotation ?? cameraEuler(previous);
  if (![...Object.values(position), ...Object.values(rotation)].every(Number.isFinite)) return null;
  const orientation = new Quaternion().setFromEuler(new Euler(
    MathUtils.degToRad(rotation.x), MathUtils.degToRad(rotation.y), MathUtils.degToRad(rotation.z), 'XYZ',
  ));
  const distance = Math.max(.1, Math.hypot(previous.position.x - previous.target.x,
    previous.position.y - previous.target.y, previous.position.z - previous.target.z));
  const target = new ThreeVector(0, 0, -1).applyQuaternion(orientation).multiplyScalar(distance)
    .add(new ThreeVector(position.x, position.y, position.z));
  const next: GameCamera = { position: { ...position }, rotation: { ...rotation },
    target: { x: target.x, y: target.y, z: target.z }, fov: changes.fov ?? previous.fov, placement: 'custom' };
  return isGameCamera(next) ? next : null;
}

export function cameraWithOrbitPose(previous: GameCamera, changes: { position?: Vector3; rotation?: Vector3 }): GameCamera | null {
  const position = changes.position ?? previous.position;
  const rotation = changes.rotation ?? cameraEuler(previous);
  const next: GameCamera = {
    ...previous,
    position: { ...position },
    rotation: { ...rotation },
    target: { ...previous.target },
    placement: 'custom',
  };
  return isGameCamera(next) ? next : null;
}

export function primaryCameraEntity(settings: GameCamera): SceneEntity {
  const rotation = cameraEuler(settings);
  return {
    id: PRIMARY_CAMERA_ID, name: 'Game Camera', parentId: null, active: true,
    components: [
      { id: `${PRIMARY_CAMERA_ID}-transform`, type: 'transform', enabled: true,
        position: { x: 50 + settings.position.x * 10, y: 50 + settings.position.z * 10, z: settings.position.y * 10 },
        rotation: { x: -rotation.x, y: -rotation.z, z: -rotation.y }, scale: { x: 1, y: 1, z: 1 } },
      { id: `${PRIMARY_CAMERA_ID}-lens`, type: 'camera', enabled: true, useTransformRotation: true, fov: settings.fov,
        target: { x: 50 + settings.target.x * 10, y: 50 + settings.target.z * 10, z: settings.target.y * 10 } },
    ],
  };
}

export function cameraFromEditorTransform(previous: GameCamera, changes: Changes): GameCamera | null {
  const base = getTransform(primaryCameraEntity(previous));
  const position = changes.position ?? base.position, rotation = changes.rotation ?? base.rotation;
  return cameraWithPose(previous, {
    position: { x: (position.x - 50) / 10, y: position.z / 10, z: (position.y - 50) / 10 },
    rotation: { x: -rotation.x, y: -rotation.z, z: -rotation.y },
  });
}

export function cameraDisplayEntity(entities: SceneEntity[], entity: SceneEntity): SceneEntity {
  const settings = cameraForEntity(entities, entity.id);
  if (!settings) return entity;
  const orientation = makeGameViewCamera(settings, 16 / 9).quaternion.clone();
  if (entity.parentId) {
    const matrix = cameraWorldMatrix(entities, entity.parentId);
    if (!matrix) return entity;
    const parent = new Quaternion();
    matrix.decompose(new ThreeVector(), parent, new ThreeVector());
    parent.normalize();
    orientation.premultiply(parent.invert());
  }
  const rotation = degrees(new Euler().setFromQuaternion(orientation, 'XYZ'));
  return { ...entity, components: entity.components.map((component) => component.type !== 'transform' ? component : {
    ...component, rotation: { x: -rotation.x, y: -rotation.z, z: -rotation.y },
  }) };
}

export function updateCameraEntityTransform(entities: SceneEntity[], id: string, changes: Changes): SceneEntity[] | null {
  const entity = entities.find((entry) => entry.id === id);
  if (!entity || !getCamera(entity)) return null;
  const display = cameraDisplayEntity(entities, entity);
  const transform = getTransform(display);
  const updated = entities.map((entry) => entry.id !== id ? entry : {
    ...entry, components: entry.components.map((component) => {
      if (component.type === 'transform') return { ...transform, position: changes.position ?? transform.position,
        rotation: changes.rotation ?? transform.rotation, scale: getTransform(entry).scale };
      if (component.type === 'camera') return { ...component, useTransformRotation: true };
      return component;
    }),
  });
  return isSceneGraph(updated) && cameraWorldMatrix(updated, id) ? updated : null;
}
