import { useLayoutEffect, useRef, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera, Vector3 } from 'three';
import type { GameCamera } from '@/lib/game-camera';
import { sceneFrameDistance } from '@/lib/scene-view-geometry';

type Controls = { target: Vector3; update: () => void };
export function SceneNavigation({ settings, zoom, frameToken, controls, marker }: {
  settings: GameCamera; zoom: number; frameToken: number;
  controls: RefObject<Controls | null>; marker: RefObject<HTMLButtonElement | null>;
}) {
  const { camera, size, invalidate } = useThree();
  const lastZoom = useRef(zoom);
  useLayoutEffect(() => {
    if (!(camera instanceof PerspectiveCamera)) return;
    const center = new Vector3(
      (settings.position.x + settings.target.x) / 2,
      (settings.position.y + settings.target.y) / 2,
      (settings.position.z + settings.target.z) / 2,
    );
    const distance = sceneFrameDistance(settings, size.width / Math.max(1, size.height), camera.fov) / (zoom / 100);
    const direction = new Vector3(1, .9, 1.2).normalize();
    camera.position.copy(center).addScaledVector(direction, distance);
    camera.lookAt(center);
    camera.updateMatrixWorld();
    if (controls.current) { controls.current.target.copy(center); controls.current.update(); }
    lastZoom.current = zoom;
    invalidate();
  }, [camera, controls, settings.position.x, settings.position.y, settings.position.z,
    settings.target.x, settings.target.y, settings.target.z, frameToken, size.width, size.height, invalidate]);
  useLayoutEffect(() => {
    if (lastZoom.current === zoom) return;
    const center = controls.current?.target ?? new Vector3(settings.target.x, settings.target.y, settings.target.z);
    const offset = camera.position.clone().sub(center).multiplyScalar(lastZoom.current / zoom);
    camera.position.copy(center).add(offset);
    camera.updateMatrixWorld();
    controls.current?.update();
    lastZoom.current = zoom;
    invalidate();
  }, [zoom, camera, controls, invalidate, settings.target.x, settings.target.y, settings.target.z]);
  useFrame(() => {
    if (!marker.current) return;
    const point = new Vector3(settings.position.x, settings.position.y, settings.position.z).project(camera);
    const width = marker.current.offsetWidth;
    const x = (point.x + 1) * size.width / 2;
    const y = (1 - point.y) * size.height / 2;
    marker.current.style.left = `${Math.max(width / 2 + 4, Math.min(size.width - width / 2 - 4, x))}px`;
    marker.current.style.top = `${Math.max(16, Math.min(size.height - 16, y))}px`;
    marker.current.dataset.offscreen = String(x < width / 2 || x > size.width - width / 2 || y < 16 || y > size.height - 16 || point.z > 1);
  });
  return null;
}
