import { useLayoutEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { PerspectiveCamera } from 'three';
import { makeGameViewCamera, type GameCamera } from '@/lib/game-camera';

export function GameCameraRig({ settings }: { settings: GameCamera }) {
  const { camera, size, invalidate } = useThree();
  useLayoutEffect(() => {
    const gameCamera = makeGameViewCamera(settings, size.width / Math.max(1, size.height));
    camera.position.copy(gameCamera.position);
    camera.quaternion.copy(gameCamera.quaternion);
    camera.up.copy(gameCamera.up);
    if (camera instanceof PerspectiveCamera) {
      camera.fov = settings.fov;
      camera.near = gameCamera.near;
      camera.far = gameCamera.far;
      camera.updateProjectionMatrix();
    }
    camera.updateMatrixWorld();
    invalidate();
  }, [camera, settings, size.width, size.height, invalidate]);
  return null;
}

export function GameCameraFrustum({ settings }: { settings: GameCamera }) {
  const camera = useMemo(() => {
    const preview = makeGameViewCamera(settings, 16 / 9);
    preview.far = Math.hypot(settings.position.x - settings.target.x,
      settings.position.y - settings.target.y, settings.position.z - settings.target.z) + 2;
    preview.updateProjectionMatrix();
    return preview;
  }, [settings]);
  return <cameraHelper args={[camera]} />;
}
