import { getModelRenderer, getSpriteRenderer, type ProjectAsset, type SceneEntity } from './scene-model';

export type FighterVisualMode = 'default' | 'sprite' | 'model';

export function isFighterEntity(entity: SceneEntity) {
  return entity.generatedBy === 'character-builder' && Boolean(entity.isGroup)
    && entity.components.some(component => component.type === 'characterController')
    && entity.components.some(component => component.type === 'playerAction');
}

export function fighterVisualMode(entity: SceneEntity): FighterVisualMode {
  const sprite = getSpriteRenderer(entity);
  if (sprite?.enabled && sprite.assetId) return 'sprite';
  const model = getModelRenderer(entity);
  return model?.enabled && model.assetId ? 'model' : 'default';
}

export function fighterVisualDraft(entity: SceneEntity): Record<string, string> {
  if (!isFighterEntity(entity)) return {};
  const mode = fighterVisualMode(entity);
  const sprite = getSpriteRenderer(entity);
  return {
    'fighter.mode': mode,
    'fighter.assetId': (mode === 'sprite' ? sprite?.assetId : getModelRenderer(entity)?.assetId) ?? '',
    'fighter.width': String(sprite?.width ?? 10),
    'fighter.height': String(sprite?.height ?? 18),
  };
}

/** Replace visuals only: IDs, transforms, combat, physics and child parts survive. */
export function withFighterVisual(
  entity: SceneEntity,
  mode: FighterVisualMode,
  assetId: string,
  assets: ProjectAsset[],
  size = { width: 10, height: 18 },
): SceneEntity {
  if (!isFighterEntity(entity)) throw new Error('Select a fighter root to replace its character.');
  if (!['default', 'sprite', 'model'].includes(mode)) throw new Error('Choose a supported character type.');
  if (mode !== 'default') {
    const asset = assets.find(item => item.id === assetId);
    if (!asset || asset.kind !== (mode === 'sprite' ? 'image' : 'model')) {
      throw new Error(`Choose an imported ${mode === 'sprite' ? '2D image' : '3D model'} first.`);
    }
  }
  const previousModel = getModelRenderer(entity);
  const previousSprite = getSpriteRenderer(entity);
  const spriteSize = mode === 'sprite' ? size
    : { width: previousSprite?.width ?? 10, height: previousSprite?.height ?? 18 };
  if (![spriteSize.width, spriteSize.height].every(value => Number.isFinite(value) && value > 0 && value <= 512)) {
    throw new Error('Sprite width and height must be greater than 0 and no more than 512.');
  }
  return {
    ...entity,
    components: [
      ...entity.components.filter(item => item.type !== 'modelRenderer' && item.type !== 'spriteRenderer'),
      {
        id: previousModel?.id ?? crypto.randomUUID(), type: 'modelRenderer',
        enabled: mode !== 'sprite', assetId: mode === 'model' ? assetId : null,
      },
      {
        id: previousSprite?.id ?? crypto.randomUUID(), type: 'spriteRenderer',
        enabled: mode === 'sprite', assetId: mode === 'sprite' ? assetId : null,
        tint: previousSprite?.tint ?? '#ffffff', width: spriteSize.width, height: spriteSize.height,
      },
    ],
  };
}
