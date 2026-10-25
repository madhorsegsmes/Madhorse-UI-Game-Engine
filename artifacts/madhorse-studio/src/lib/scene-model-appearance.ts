import { getModelRenderer, getPrimitive, type ProjectAsset, type SceneEntity } from './scene-model';

/** Swap only the visual mesh. Keep transforms, collisions, scripts and gameplay. */
export function withSceneModelAppearance(entity: SceneEntity, assetId: string, assets: ProjectAsset[]): SceneEntity {
  if (!getPrimitive(entity)) throw new Error('Select a scene shape to replace its appearance.');
  if (assetId && !assets.some(asset => asset.id === assetId && asset.kind === 'model')) {
    throw new Error('Choose an imported 3D model, or Original editable shape.');
  }
  const previous = getModelRenderer(entity);
  if (!previous && !assetId) return entity;
  return {
    ...entity,
    components: [
      ...entity.components.filter(component => component.type !== 'modelRenderer'),
      {
        id: previous?.id ?? crypto.randomUUID(), type: 'modelRenderer',
        enabled: Boolean(assetId), assetId: assetId || null,
      },
    ],
  };
}
