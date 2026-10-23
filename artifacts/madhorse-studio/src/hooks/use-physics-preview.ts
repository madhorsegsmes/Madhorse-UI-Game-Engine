import { useEffect, useState } from 'react';
import type { PhysicsWorldSettings, SceneEntity, Vector3 } from '@/lib/scene-model';
import { stepPhysicsScene } from '@/lib/physics-simulation';

const FIXED_STEP_SECONDS = 1 / 60;

export function usePhysicsPreview(
  entities: SceneEntity[],
  settings: PhysicsWorldSettings,
  running: boolean,
): SceneEntity[] {
  const [previewEntities, setPreviewEntities] = useState(entities);

  useEffect(() => {
    setPreviewEntities(entities);
    if (!running) return;

    let currentEntities = entities;
    let animationFrame = 0;
    let previousTime: number | null = null;
    let accumulator = 0;
    const velocities = new Map<string, Vector3>();

    const advance = (time: number) => {
      if (previousTime === null) previousTime = time;
      accumulator += Math.min((time - previousTime) / 1000, 0.05);
      previousTime = time;

      while (accumulator >= FIXED_STEP_SECONDS) {
        currentEntities = stepPhysicsScene(
          currentEntities,
          settings,
          FIXED_STEP_SECONDS,
          velocities,
        );
        accumulator -= FIXED_STEP_SECONDS;
      }
      setPreviewEntities(currentEntities);
      animationFrame = requestAnimationFrame(advance);
    };

    animationFrame = requestAnimationFrame(advance);
    return () => cancelAnimationFrame(animationFrame);
  }, [entities, settings, running]);

  return previewEntities;
}
