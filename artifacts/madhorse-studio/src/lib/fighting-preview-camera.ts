import type { GameCamera } from './game-camera';

/** Frame the default pair at X = -4 / +4, including clothing and HUD clearance. */
export function createFightingPreviewCamera(aspect: number): GameCamera {
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 16 / 9;
  const fov = 34;
  // Include forward hands and clothing: closer geometry has a narrower frustum.
  const distance = 1.1 + Math.max(1.25, 4.85 / safeAspect) / Math.tan(fov * Math.PI / 360);
  return {
    position: { x: 0, y: 0.95, z: -distance },
    target: { x: 0, y: 0.95, z: 0 },
    fov,
    placement: 'custom',
  };
}
