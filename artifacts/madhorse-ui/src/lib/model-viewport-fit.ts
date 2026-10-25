import { Box3, Object3D, PerspectiveCamera, Vector3 } from 'three';

/** Measure loaded geometry in world space; never normalize or recenter the model. */
export function fitModelViewport(camera: PerspectiveCamera, model: Object3D, target: Vector3): boolean {
  model.updateWorldMatrix(true, true);
  const bounds = new Box3().setFromObject(model, true);
  if (bounds.isEmpty() || ![...bounds.min.toArray(), ...bounds.max.toArray()].every(Number.isFinite)) return false;
  const center = bounds.getCenter(new Vector3());
  const radius = Math.max(bounds.getSize(new Vector3()).length() / 2, 1e-9);
  const halfVertical = Math.atan(Math.tan(camera.fov * Math.PI / 360) / camera.zoom);
  const halfHorizontal = Math.atan(Math.tan(halfVertical) * camera.aspect);
  const distance = radius / Math.sin(Math.min(halfVertical, halfHorizontal)) * 1.15;
  const direction = camera.position.clone().sub(target);
  if (direction.lengthSq() < 1e-18) direction.set(1, .9, 1.2);
  camera.position.copy(center).addScaledVector(direction.normalize(), distance);
  camera.near = radius * .001;
  camera.far = distance * 5 + radius * 10;
  camera.updateProjectionMatrix();
  camera.lookAt(center);
  camera.updateMatrixWorld();
  target.copy(center);
  return true;
}
