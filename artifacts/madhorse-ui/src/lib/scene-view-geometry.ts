import { BoxGeometry, PlaneGeometry, Vector3 } from 'three';
import type { PrimitiveComponent } from './scene-model';
import type { GameCamera } from './game-camera';

export function createPrimitiveGeometry(shape: PrimitiveComponent['shape']) {
  if (shape === 'cube') return new BoxGeometry(1, 1, 1);
  const terrain = shape === 'terrain';
  const plane = new PlaneGeometry(terrain ? 20 : 10, terrain ? 20 : 10, terrain ? 32 : 1, terrain ? 32 : 1);
  plane.rotateX(-Math.PI / 2);
  const positions = plane.getAttribute('position');
  for (let index = 0; index < positions.count; index++) {
    positions.setY(index, terrain ? Math.sin(positions.getX(index) * .45) * Math.cos(positions.getZ(index) * .4) * .65 - .05 : -.05);
  }
  plane.computeVertexNormals();
  return plane;
}

export function sceneFrameDistance(settings: GameCamera, aspect: number, fov = 48) {
  const eye = new Vector3(settings.position.x, settings.position.y, settings.position.z);
  const target = new Vector3(settings.target.x, settings.target.y, settings.target.z);
  const radius = eye.distanceTo(target) / 2 + 2.4;
  const angle = Math.min(fov * Math.PI / 360, Math.atan(Math.tan(fov * Math.PI / 360) * Math.max(.1, aspect)));
  return radius / Math.sin(angle) * 1.08;
}
