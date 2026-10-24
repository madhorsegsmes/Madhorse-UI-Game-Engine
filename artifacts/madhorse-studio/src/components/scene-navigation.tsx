import { useLayoutEffect, useRef, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera, Vector3 } from 'three';
import type { GameCamera } from '@/lib/game-camera';
import { sceneEditorFramePose, type SceneFocus } from '@/lib/scene-view-geometry';

type Controls = { target: Vector3; update: () => void };
/**
 * Frames the editor view only on first mount, explicit Frame (frameToken), focus change or resize.
 * Primary camera pose changes never reframe the orbit.
 */
export function SceneNavigation({ settings, zoom, frameToken, controls, marker, focus }: {
  settings: GameCamera; zoom: number; frameToken: number;
  focus?: SceneFocus | null;
  controls: RefObject<Controls | null>; marker: RefObject<HTMLButtonElement | null>;
}) {
  const { camera, size, invalidate } = useThree();
  const lastZoom = useRef(zoom);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  useLayoutEffect(() => {
    if (!(camera instanceof PerspectiveCamera)) return;
    const current = settingsRef.current;
    const aspect = size.width / Math.max(1, size.height);
    const pose = sceneEditorFramePose(current, aspect, lastZoom.current, focus, camera.fov);
    const center = new Vector3(pose.target.x, pose.target.y, pose.target.z);
    camera.position.set(pose.position.x, pose.position.y, pose.position.z);
    camera.lookAt(center);
    camera.updateMatrixWorld();
    if (controls.current) { controls.current.target.copy(center); controls.current.update(); }
    invalidate();
  }, [camera, controls, frameToken, focus, size.width, size.height, invalidate]);
  useLayoutEffect(() => {
    if (lastZoom.current === zoom) return;
    const center = controls.current?.target ?? new Vector3();
    const offset = camera.position.clone().sub(center).multiplyScalar(lastZoom.current / zoom);
    camera.position.copy(center).add(offset);
    camera.updateMatrixWorld();
    controls.current?.update();
    lastZoom.current = zoom;
    invalidate();
  }, [zoom, camera, controls, invalidate]);
  useFrame(() => {
    if (!marker.current) return;
    const s = settingsRef.current;
    const point = new Vector3(s.position.x, s.position.y, s.position.z).project(camera);
    const width = marker.current.offsetWidth;
    const x = (point.x + 1) * size.width / 2;
    const y = (1 - point.y) * size.height / 2;
    marker.current.style.left = `${Math.max(width / 2 + 4, Math.min(size.width - width / 2 - 4, x))}px`;
    marker.current.style.top = `${Math.max(16, Math.min(size.height - 16, y))}px`;
    marker.current.dataset.offscreen = String(x < width / 2 || x > size.width - width / 2 || y < 16 || y > size.height - 16 || point.z > 1);
  });
  return null;
}
