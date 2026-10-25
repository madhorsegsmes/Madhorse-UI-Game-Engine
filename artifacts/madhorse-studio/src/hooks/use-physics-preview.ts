import { useEffect, useState } from 'react';
import type { PhysicsWorldSettings, SceneEntity, Vector3 } from '@/lib/scene-model';
import { stepPhysicsScene } from '@/lib/physics-simulation';
import { SimulationClock } from '@/lib/simulation-clock';

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
    const clock = new SimulationClock(performance.now());
    const velocities = new Map<string, Vector3>();

    const advance = (time: number) => {
      const batch = clock.advance(time, document.hidden);
      for (let step = 0; step < batch.steps; step++) {
        currentEntities = stepPhysicsScene(
          currentEntities,
          settings,
          clock.stepSeconds,
          velocities,
        );
      }
      if (batch.steps) setPreviewEntities(currentEntities);
      animationFrame = requestAnimationFrame(advance);
    };

    animationFrame = requestAnimationFrame(advance);
    return () => cancelAnimationFrame(animationFrame);
  }, [entities, settings, running]);

  return previewEntities;
}
