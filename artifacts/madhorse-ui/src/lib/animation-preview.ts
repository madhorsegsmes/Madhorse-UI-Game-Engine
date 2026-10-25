import { getAnimationTracks, sampleGameAnimation, type GameAnimation } from './game-api';
import type { SceneEntity } from './scene-model';

/** Preview is a derived scene: never write sampled transforms into project data. */
export function applyAnimationPreview(
  entities: SceneEntity[],
  animation: GameAnimation,
  time: number,
): SceneEntity[] {
  const frames = new Map(getAnimationTracks(animation).map((track) => [
    track.targetEntityId,
    sampleGameAnimation({ ...track, duration: animation.duration }, time),
  ]));
  return entities.map((entity) => {
    const frame = frames.get(entity.id);
    if (!frame) return entity;
    return {
      ...entity,
      components: entity.components.map((component) => component.type !== 'transform' ? component : {
        ...component,
        position: { ...frame.position },
        rotation: { ...frame.rotation },
        scale: {
          x: component.scale.x * frame.scale,
          y: component.scale.y * frame.scale,
          z: component.scale.z * frame.scale,
        },
      }),
    };
  });
}
