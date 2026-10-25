import { useEffect, useState, useSyncExternalStore, type FormEvent, type ReactNode } from 'react';
import {
  isSceneEntity,
  primitiveShapes,
  SCENE_ORIGIN,
  uiElementKinds,
  type ProjectAsset,
  type PrimitiveShape,
  type SceneComponent,
  type SceneEntity,
  type UIElementKind,
} from '@/lib/scene-model';
import { playAudioPreview, stopAudioPlayback } from '@/lib/game-audio';
import { playerActionDraft, playerActionFromDraft } from '@/lib/player-action-model';
import { PlayerActionSettings } from './player-action-settings';
import { gameFeatureDraft, gameFeatureFromDraft } from '@/lib/game-feature-model';
import { gameFeatureDefinitions } from '@/lib/game-feature-model';
import { GameFeatureSettings } from './game-feature-settings';
import { VisualLogicEditor } from './visual-logic-editor';
import type { VisualLogicNode } from '@/lib/scene-model';
import { getPbrSurfacePreset, matchPbrSurfacePreset, pbrSurfacePresets } from '@/lib/pbr-surface-presets';
import { fighterVisualDraft, isFighterEntity, withFighterVisual, type FighterVisualMode } from '@/lib/fighter-visual';
import { withSceneModelAppearance } from '@/lib/scene-model-appearance';
import { DEFAULT_MODEL_LOD } from '@/lib/model-lod-settings';
import { getModelLodReport, subscribeModelLodReports } from '@/lib/model-lod-report';
import { ALL_COLLISION_LAYERS, collisionLayers, collisionPresets, collisionPresetDraft } from '@/lib/collision-layers';

type Props = {
  entity: SceneEntity;
  entities?: SceneEntity[];
  assets: ProjectAsset[];
  assetUrls: Record<string, string>;
  canRename?: boolean;
  canEditActive?: boolean;
  embedded?: boolean;
  onClose: () => void;
  onSave: (entity: SceneEntity) => void;
};

function toDraft(entity: SceneEntity) {
  const values: Record<string, string> = { active: String(entity.active), ...fighterVisualDraft(entity) };
  for (const component of entity.components) {
    if (component.type === 'gameFeature') {
      Object.assign(values, gameFeatureDraft(component));
    } else if (component.type === 'playerAction') {
      Object.assign(values, playerActionDraft(component));
    } else if (component.type === 'multiplayerPlugin') {
      values[`multiplayer.${component.id}.enabled`] = String(component.enabled);
      values[`multiplayer.${component.id}.eventName`] = component.eventName;
    } else if (component.type === 'transform') {
      for (const key of ['position', 'rotation', 'scale'] as const) {
        for (const axis of ['x', 'y', 'z'] as const) {
          const sceneOriginOffset = key === 'position' ? SCENE_ORIGIN[axis] : 0;
          values[`transform.${key}.${axis}`] = String(component[key][axis] - sceneOriginOffset);
        }
      }
    } else if (component.type === 'primitive') {
      const roughness = component.roughness ?? .58;
      const metalness = component.metalness ?? .08;
      const opacity = component.opacity ?? 1;
      values['primitive.shape'] = component.shape;
      values['primitive.color'] = component.color;
      values['primitive.opacity'] = String(opacity);
      values['primitive.roughness'] = String(roughness);
      values['primitive.metalness'] = String(metalness);
      values['primitive.surfacePreset'] = matchPbrSurfacePreset(roughness, metalness, opacity);
      values['primitive.textureAssetId'] = component.textureAssetId ?? '';
      values['primitive.materialAssetId'] = component.materialAssetId ?? '';
      const model = entity.components.find(item => item.type === 'modelRenderer');
      values['primitive.modelAssetId'] = model?.type === 'modelRenderer' && model.enabled ? model.assetId ?? '' : '';
      const terrain = component.terrainSettings ?? { width: 20, depth: 20, height: 0, mountainHeight: 0, riverDepth: 0, riverCount: 0 };
      for (const key of ['width', 'depth', 'height', 'mountainHeight', 'riverDepth', 'riverCount'] as const) {
        values[`terrain.${key}`] = String(terrain[key]);
      }
    } else if (component.type === 'light') {
      values['light.kind'] = component.kind;
      values['light.color'] = component.color;
      values['light.intensity'] = String(component.intensity);
      values['light.enabled'] = String(component.enabled);
      values['light.castShadow'] = String(component.castShadow !== false);
      values['light.shadowMapSize'] = String(component.shadowMapSize ?? 2048);
    } else if (component.type === 'camera') {
      values['camera.fov'] = String(component.fov);
      values['camera.enabled'] = String(component.enabled);
      for (const axis of ['x', 'y', 'z'] as const) values[`camera.target.${axis}`] = String(component.target[axis]);
    } else if (component.type === 'uiCanvas') {
      values['ui.kind'] = component.kind ?? 'canvas';
      values['ui.frame'] = String(component.frame ?? false);
      values['ui.enabled'] = String(component.enabled);
    } else if (component.type === 'script') {
      values['script.enabled'] = String(component.enabled);
    } else if (component.type === 'gameAudio') {
      values['gameAudio.enabled'] = String(component.enabled);
      values['gameAudio.clipAssetId'] = component.clipAssetId ?? '';
      values['gameAudio.volume'] = String(component.volume);
      values['gameAudio.pitch'] = String(component.pitch);
      values['gameAudio.playOnStart'] = String(component.playOnStart);
    } else if (component.type === 'playerWalkAudio') {
      values['playerWalkAudio.enabled'] = String(component.enabled);
      values['playerWalkAudio.clipAssetId'] = component.clipAssetId ?? '';
      values['playerWalkAudio.volume'] = String(component.volume);
      values['playerWalkAudio.pitch'] = String(component.pitch);
      values['playerWalkAudio.stepInterval'] = String(component.stepInterval);
    } else if (component.type === 'effect') {
      values['effect.color'] = component.color;
      values['effect.intensity'] = String(component.intensity);
      values['effect.style'] = component.style ?? 'aura';
      values['effect.enabled'] = String(component.enabled);
    } else if (component.type === 'physics') {
      values['physics.enabled'] = String(component.enabled);
      values['physics.colliderEnabled'] = String(component.colliderEnabled);
      values['physics.bodyType'] = component.bodyType;
      values['physics.mass'] = String(component.mass);
      values['physics.gravityScale'] = String(component.gravityScale);
      values['physics.friction'] = String(component.friction);
      values['physics.restitution'] = String(component.restitution);
      values['physics.continuousCollision'] = String(component.continuousCollision ?? false);
      values['physics.simulateInPlay'] = String(component.simulateInPlay ?? false);
      for (const axis of ['x', 'y', 'z'] as const) {
        values[`physics.initialVelocity.${axis}`] = String(component.initialVelocity?.[axis] ?? 0);
      }
      values['physics.collisionLayer'] = String(component.collisionLayer ?? 0);
      collisionLayers.forEach((_, index) => {
        values[`physics.collides.${index}`] = String(Boolean((component.collisionMask ?? ALL_COLLISION_LAYERS) & (1 << index)));
      });
      for (const axis of ['x', 'y', 'z'] as const) values[`physics.size.${axis}`] = String(component.size[axis]);
    } else if (component.type === 'characterController') {
      values['controller.enabled'] = String(component.enabled);
      values['controller.role'] = component.role;
      values['controller.perspective'] = component.perspective;
      values['controller.behavior'] = component.behavior;
      values['controller.moveSpeed'] = String(component.moveSpeed);
      values['controller.jumpHeight'] = String(component.jumpHeight);
      values['controller.followDistance'] = String(component.followDistance);
      values['controller.patrolRadius'] = String(component.patrolRadius);
    } else if (component.type === 'triggerZone') {
      values['trigger.enabled'] = String(component.enabled);
      values['trigger.shape'] = component.shape;
      values['trigger.action'] = component.action;
      values['trigger.targetEntityId'] = component.targetEntityId ?? '';
      values['trigger.message'] = component.message;
      values['trigger.logicNodes'] = JSON.stringify(component.logicNodes ?? []);
      for (const axis of ['x', 'y', 'z'] as const) values[`trigger.size.${axis}`] = String(component.size[axis]);
    } else if (component.type === 'skybox') {
      values['skybox.enabled'] = String(component.enabled);
      values['skybox.color'] = component.color;
    } else if (component.type === 'spriteRenderer') {
      values['sprite.enabled'] = String(component.enabled);
      values['sprite.tint'] = component.tint;
      values['sprite.width'] = String(component.width);
      values['sprite.height'] = String(component.height);
      values['sprite.assetId'] = component.assetId ?? '';
    } else if (component.type === 'modelRenderer') {
      values['model.enabled'] = String(component.enabled);
      values['model.assetId'] = component.assetId ?? '';
      values['model.materialAssetId'] = component.materialAssetId ?? '';
      values['model.lod.enabled'] = String(component.lod?.enabled ?? false);
      values['model.lod.medium'] = String(component.lod?.mediumScreenPercent ?? DEFAULT_MODEL_LOD.mediumScreenPercent);
      values['model.lod.low'] = String(component.lod?.lowScreenPercent ?? DEFAULT_MODEL_LOD.lowScreenPercent);
    }
  }
  return values;
}

export function SceneObjectInspector({
  entity,
  entities = [],
  assets,
  assetUrls,
  canRename = true,
  canEditActive = true,
  embedded = false,
  onClose,
  onSave,
}: Props) {
  const [name, setName] = useState(entity.name);
  const [values, setValues] = useState(() => toDraft(entity));
  const lodReport = useSyncExternalStore(subscribeModelLodReports, () => getModelLodReport(entity.id), () => null);
  const [error, setError] = useState('');
  const [audioPreviewStatus, setAudioPreviewStatus] = useState('');
  useEffect(() => () => stopAudioPlayback(), []);
  const setValue = (key: string, value: string) => {
    setValues(current => ({
      ...current,
      [key]: value,
      ...(key === 'primitive.roughness' || key === 'primitive.metalness' || key === 'primitive.opacity' ||
        key === 'primitive.color' || key === 'primitive.textureAssetId'
        ? { 'primitive.surfacePreset': 'custom', 'primitive.materialAssetId': '' }
        : {}),
      ...(key === 'model.assetId' ? { 'model.materialAssetId': '' } : {}),
    }));
    setError('');
  };
  const applySurfacePreset = (presetId: string) => {
    const preset = getPbrSurfacePreset(presetId);
    if (!preset) {
      setValue('primitive.surfacePreset', 'custom');
      return;
    }
    setValues(current => ({
      ...current,
      'primitive.surfacePreset': preset.id,
      'primitive.roughness': String(preset.roughness),
      'primitive.metalness': String(preset.metalness),
      'primitive.opacity': String(preset.opacity),
    }));
    setError('');
  };
  const number = (key: string) => Number(values[key]);
  const component = <T extends SceneComponent['type']>(type: T) =>
    entity.components.find((item): item is Extract<SceneComponent, { type: T }> => item.type === type);
  const numberField = (label: string, key: string, min: number, max: number, step = 1) => (
    <label className="fresh-setting" key={key}>
      <span>{label}</span>
      <input
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={key === 'terrain.riverCount' ? step : 'any'}
        value={values[key] ?? ''}
        onChange={event => setValue(key, event.currentTarget.value)}
      />
    </label>
  );
  const colorField = (label: string, key: string) => (
    <label className="fresh-setting" key={key}>
      <span>{label}</span>
      <input type="color" value={values[key] || '#ffffff'} onChange={event => setValue(key, event.currentTarget.value)} />
    </label>
  );
  const selectField = (label: string, key: string, options: Array<{ value: string; label: string }>) => (
    <label className="fresh-setting" key={key}>
      <span>{label}</span>
      <select value={values[key] ?? ''} onChange={event => setValue(key, event.currentTarget.value)}>
        {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
  const checkboxField = (label: string, key: string) => (
    <label className="fresh-setting fresh-setting-checkbox" key={key}>
      <span>{label}</span>
      <input type="checkbox" checked={values[key] === 'true'} onChange={event => setValue(key, String(event.currentTarget.checked))} />
    </label>
  );
  const section = (title: string, content: ReactNode) => (
    <fieldset className="fresh-inspector-section" key={title}>
      <legend>{title}</legend>
      {content}
    </fieldset>
  );
  const vectorFields = (title: string, prefix: string, min: number, max: number, step = 1) =>
    section(title, <div className="fresh-inspector-vector">
      {(['x', 'y', 'z'] as const).map(axis => numberField(axis.toUpperCase(), `${prefix}.${axis}`, min, max, step))}
    </div>);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    let logicNodes: VisualLogicNode[] | undefined;
    if (component('triggerZone')) {
      try {
        logicNodes = JSON.parse(values['trigger.logicNodes'] ?? '[]') as VisualLogicNode[];
      } catch {
        setError('The visual logic flow is not valid. Reopen the flow editor and try again.');
        return;
      }
    }
    const nextComponents = entity.components.map((item): SceneComponent => {
      if (item.type === 'gameFeature') return gameFeatureFromDraft(item, values);
      if (item.type === 'playerAction') return playerActionFromDraft(item, values);
      if (item.type === 'transform') return {
        ...item,
        position: {
          x: number('transform.position.x') + SCENE_ORIGIN.x,
          y: number('transform.position.y') + SCENE_ORIGIN.y,
          z: number('transform.position.z') + SCENE_ORIGIN.z,
        },
        rotation: { x: number('transform.rotation.x'), y: number('transform.rotation.y'), z: number('transform.rotation.z') },
        scale: { x: number('transform.scale.x'), y: number('transform.scale.y'), z: number('transform.scale.z') },
      };
      if (item.type === 'primitive') return {
        ...item,
        shape: values['primitive.shape'] as PrimitiveShape,
        terrainSettings: values['primitive.shape'] === 'terrain' ? {
          width: number('terrain.width'), depth: number('terrain.depth'), height: number('terrain.height'),
          mountainHeight: number('terrain.mountainHeight'), riverDepth: number('terrain.riverDepth'),
          riverCount: number('terrain.riverCount'),
        } : undefined,
        terrainEdits: values['primitive.shape'] === 'terrain' ? item.terrainEdits : undefined,
        color: values['primitive.color'],
        opacity: number('primitive.opacity'),
        roughness: number('primitive.roughness'),
        metalness: number('primitive.metalness'),
        textureAssetId: values['primitive.textureAssetId'] || null,
        materialAssetId: values['primitive.materialAssetId'] || null,
      };
      if (item.type === 'light') return {
        ...item,
        kind: values['light.kind'] as typeof item.kind,
        color: values['light.color'],
        intensity: number('light.intensity'),
        enabled: values['light.enabled'] === 'true',
        castShadow: values['light.castShadow'] === 'true',
        shadowMapSize: number('light.shadowMapSize') as 512 | 1024 | 2048,
      };
      if (item.type === 'effect') return {
        ...item,
        style: values['effect.style'] as NonNullable<typeof item.style>,
        color: values['effect.color'],
        intensity: number('effect.intensity'),
        enabled: values['effect.enabled'] === 'true',
      };
      if (item.type === 'camera') return {
        ...item,
        fov: number('camera.fov'),
        enabled: values['camera.enabled'] === 'true',
        target: { x: number('camera.target.x'), y: number('camera.target.y'), z: number('camera.target.z') },
      };
      if (item.type === 'uiCanvas') return {
        ...item,
        kind: (values['ui.kind'] || undefined) as UIElementKind | undefined,
        frame: values['ui.frame'] === 'true',
        enabled: values['ui.enabled'] === 'true',
      };
      if (item.type === 'script') return { ...item, enabled: values['script.enabled'] === 'true' };
      if (item.type === 'gameAudio') return {
        ...item,
        enabled: values['gameAudio.enabled'] === 'true',
        clipAssetId: values['gameAudio.clipAssetId'] || null,
        volume: number('gameAudio.volume'),
        pitch: number('gameAudio.pitch'),
        playOnStart: values['gameAudio.playOnStart'] === 'true',
      };
      if (item.type === 'playerWalkAudio') return {
        ...item,
        enabled: values['playerWalkAudio.enabled'] === 'true',
        clipAssetId: values['playerWalkAudio.clipAssetId'] || null,
        volume: number('playerWalkAudio.volume'),
        pitch: number('playerWalkAudio.pitch'),
        stepInterval: number('playerWalkAudio.stepInterval'),
      };
      if (item.type === 'physics') return {
        ...item,
        enabled: values['physics.enabled'] === 'true',
        colliderEnabled: values['physics.colliderEnabled'] === 'true',
        bodyType: values['physics.bodyType'] as typeof item.bodyType,
        mass: number('physics.mass'),
        gravityScale: number('physics.gravityScale'),
        friction: number('physics.friction'),
        restitution: number('physics.restitution'),
        continuousCollision: values['physics.continuousCollision'] === 'true',
        simulateInPlay: values['physics.simulateInPlay'] === 'true',
        initialVelocity: {
          x: number('physics.initialVelocity.x'), y: number('physics.initialVelocity.y'), z: number('physics.initialVelocity.z'),
        },
        collisionLayer: number('physics.collisionLayer'),
        collisionMask: collisionLayers.reduce((mask, _, index) =>
          values[`physics.collides.${index}`] === 'true' ? mask | (1 << index) : mask, 0),
        size: { x: number('physics.size.x'), y: number('physics.size.y'), z: number('physics.size.z') },
      };
      if (item.type === 'characterController') return {
        ...item,
        enabled: values['controller.enabled'] === 'true',
        role: values['controller.role'] as typeof item.role,
        perspective: values['controller.perspective'] as typeof item.perspective,
        behavior: values['controller.role'] === 'player' ? 'direct-control' :
          values['controller.behavior'] === 'direct-control' ? 'follow-player' : values['controller.behavior'] as typeof item.behavior,
        moveSpeed: number('controller.moveSpeed'),
        jumpHeight: number('controller.jumpHeight'),
        followDistance: number('controller.followDistance'),
        patrolRadius: number('controller.patrolRadius'),
      };
      if (item.type === 'multiplayerPlugin') return {
        ...item,
        enabled: values[`multiplayer.${item.id}.enabled`] === 'true',
        eventName: (values[`multiplayer.${item.id}.eventName`] ?? item.eventName).trim().slice(0, 80),
      };
      if (item.type === 'triggerZone') return {
        ...item,
        enabled: values['trigger.enabled'] === 'true',
        shape: values['trigger.shape'] as typeof item.shape,
        action: values['trigger.action'] as typeof item.action,
        targetEntityId: values['trigger.targetEntityId'] || null,
        message: values['trigger.message'],
        logicNodes,
        size: { x: number('trigger.size.x'), y: number('trigger.size.y'), z: number('trigger.size.z') },
      };
      if (item.type === 'skybox') return {
        ...item,
        enabled: values['skybox.enabled'] === 'true',
        color: values['skybox.color'],
      };
      if (item.type === 'spriteRenderer') return {
        ...item,
        enabled: values['sprite.enabled'] === 'true',
        tint: values['sprite.tint'],
        width: number('sprite.width'),
        height: number('sprite.height'),
        assetId: values['sprite.assetId'] || null,
      };
      if (item.type === 'storyboard') return item;
      return {
        ...item,
        enabled: values['model.enabled'] === 'true',
        assetId: values['model.assetId'] || null,
        materialAssetId: values['model.materialAssetId'] || null,
        lod: {
          enabled: values['model.lod.enabled'] === 'true',
          mediumScreenPercent: number('model.lod.medium'),
          lowScreenPercent: number('model.lod.low'),
        },
      };
    });
    let updated: SceneEntity = {
      ...entity,
      name: canRename ? name.trim() : entity.name,
      active: values.active === 'true',
      components: nextComponents,
    };
    if (isFighterEntity(entity)) {
      try {
        updated = withFighterVisual(updated, values['fighter.mode'] as FighterVisualMode,
          values['fighter.assetId'], assets,
          { width: number('fighter.width'), height: number('fighter.height') });
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Could not replace the fighter.');
        return;
      }
    }
    if (!isFighterEntity(entity) && component('primitive')) {
      try {
        updated = withSceneModelAppearance(updated, values['primitive.modelAssetId'] ?? '', assets);
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Could not replace the scene model.');
        return;
      }
    }
    if (canRename && !updated.name) {
      setError('Enter a name for this object.');
      return;
    }
    const enabledKeys = [
      ...nextComponents.filter(component => component.type === 'playerAction' && component.enabled)
        .map(component => component.type === 'playerAction' ? component.key : ''),
      ...nextComponents.filter(component => component.type === 'gameFeature' && component.enabled && component.kind === 'interact')
        .map(component => component.type === 'gameFeature' ? String(component.settings.key) : ''),
    ];
    if (new Set(enabledKeys).size !== enabledKeys.length) {
      setError('Two enabled actions use the same key. Give each action its own key.');
      return;
    }
    if (!isSceneEntity(updated)) {
      setError('Check the values. Some settings are outside the supported range.');
      return;
    }
    onSave(updated);
  }

  const primitive = component('primitive');
  const physics = component('physics');
  const light = component('light');
  const camera = component('camera');
  const ui = component('uiCanvas');
  const script = component('script');
  const gameAudio = component('gameAudio');
  const playerWalkAudio = component('playerWalkAudio');
  const effect = component('effect');
  const sprite = component('spriteRenderer');
  const model = component('modelRenderer');
  const controller = component('characterController');
  const multiplayerPlugins = entity.components.filter(item => item.type === 'multiplayerPlugin');
  const triggerZone = component('triggerZone');
  const skybox = component('skybox');
  const imageAssets = assets.filter(asset => asset.kind === 'image');
  const modelAssets = assets.filter(asset => asset.kind === 'model');
  const pbrMaterials = assets.filter(asset => asset.kind === 'pbr-material');
  const audioAssets = assets.filter(asset => asset.kind === 'audio');
  const assetOptions = (items: ProjectAsset[]) => [
    { value: '', label: 'None' },
    ...items.map(asset => ({ value: asset.id, label: asset.name })),
  ];

  const form = (
      <form className={`fresh-settings-dialog fresh-object-inspector${embedded ? ' is-embedded' : ''}`}
        role={embedded ? 'region' : 'dialog'} aria-modal={embedded ? undefined : true}
        aria-labelledby="fresh-object-inspector-title" onSubmit={handleSubmit}
        onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); onClose(); } }}>
        <header className="fresh-object-inspector-header">
          <div>
            <span className="fresh-dialog-kicker">OBJECT SETTINGS</span>
            <h3 id="fresh-object-inspector-title">{entity.name}</h3>
          </div>
          <button type="button" onClick={onClose} aria-label={embedded ? 'Back to settings' : 'Close object settings'}>×</button>
        </header>
        {canRename && (
          <label className="fresh-setting">
            <span>Name</span>
            <input type="text" maxLength={80} value={name} onChange={event => setName(event.currentTarget.value)} />
          </label>
        )}
        {canEditActive && checkboxField('Active in scene', 'active')}
        {isFighterEntity(entity) && section('Replace fighter · 2D / 3D', <>
          <p className="fresh-inspector-note">Change this fighter’s appearance without losing movement, attacks, health, or controls. Import files through Hierarchy → Import asset first.</p>
          {selectField('Character type', 'fighter.mode', [
            { value: 'default', label: 'Default template character' },
            { value: 'sprite', label: '2D sprite / image' },
            { value: 'model', label: '3D model · FBX / GLB / glTF' },
          ])}
          {values['fighter.mode'] !== 'default' && selectField(
            values['fighter.mode'] === 'sprite' ? 'Fighter image' : 'Fighter model',
            'fighter.assetId', assetOptions(values['fighter.mode'] === 'sprite' ? imageAssets : modelAssets),
          )}
          {values['fighter.mode'] === 'sprite' && <>
            {numberField('Sprite width', 'fighter.width', 0.1, 512, 0.1)}
            {numberField('Sprite height', 'fighter.height', 0.1, 512, 0.1)}
            <p className="fresh-inspector-note">10 units = 1 metre. The sprite stands upright and faces the viewing camera.</p>
          </>}
          <p className="fresh-inspector-note">Press Save Changes to apply. Choose Default template character to restore the original model.</p>
        </>)}
        {entity.components.some(item => item.type === 'transform') && <>
          {vectorFields('Position', 'transform.position', -100000, 100000, 0.1)}
          {vectorFields('Rotation', 'transform.rotation', -360000, 360000, 1)}
          {vectorFields('Scale', 'transform.scale', 0, 1000, 0.1)}
        </>}
        {primitive && section('3D Shape', <>
          {selectField('3D model replacement', 'primitive.modelAssetId', [
            { value: '', label: 'Original editable shape' },
            ...modelAssets.map(asset => ({ value: asset.id, label: asset.name })),
          ])}
          <p className="fresh-inspector-note">Import a model through Hierarchy → Import asset to replace this piece. Its position, collision and gameplay stay attached. Choose Original editable shape to restore it. The surface controls below edit the original shape; imported models use their own materials.</p>
          {selectField('Shape', 'primitive.shape', [
            ...primitiveShapes.map(shape => ({ value: shape.value, label: shape.label })),
            { value: 'terrain', label: 'Terrain' },
          ])}
          {selectField(values['primitive.modelAssetId'] ? 'Project PBR material for model' : 'Project PBR material',
            'primitive.materialAssetId', [
              { value: '', label: 'Use object material' },
              ...pbrMaterials.map(asset => ({ value: asset.id, label: asset.name })),
            ])}
          {values['primitive.materialAssetId']
            ? <p className="fresh-inspector-note">The shared PBR material is applied to this object. Edit it under Plugins → Asset Plugins → PBR Materials, or choose “Use object material” to return to per-object settings.</p>
            : <>
          {colorField('Surface color', 'primitive.color')}
          <label className="fresh-setting">
            <span>Surface preset</span>
            <select value={values['primitive.surfacePreset'] ?? 'custom'} onChange={event => applySurfacePreset(event.currentTarget.value)}>
              <option value="custom">Custom material</option>
              {pbrSurfacePresets.map(preset => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
            </select>
          </label>
          {numberField('Roughness', 'primitive.roughness', 0, 1, 0.01)}
          {numberField('Metalness', 'primitive.metalness', 0, 1, 0.01)}
          {numberField('Opacity', 'primitive.opacity', 0.05, 1, 0.05)}
          {selectField('Surface texture', 'primitive.textureAssetId', assetOptions(imageAssets))}
            </>}
        </>)}
        {primitive && values['primitive.shape'] === 'terrain' && section('Terrain & World Building', <>
          {numberField('Terrain width', 'terrain.width', 1, 500, 0.1)}
          {numberField('Terrain depth', 'terrain.depth', 1, 500, 0.1)}
          {numberField('Ground height', 'terrain.height', 0, 100, 0.1)}
          {numberField('Mountain height', 'terrain.mountainHeight', 0, 100, 0.1)}
          {numberField('River depth', 'terrain.riverDepth', 0, 50, 0.1)}
          {numberField('Number of rivers', 'terrain.riverCount', 0, 10, 1)}
          <p className="fresh-world-tool-hint" data-testid="terrain-sculpt-summary">
            {primitive.terrainEdits?.length ?? 0} terrain sculpt edits saved. Right-click this Terrain in Hierarchy to raise, lower, or smooth it, or add trees and water.
          </p>
        </>)}
        {physics && section('Physics', <>
          {checkboxField('Enabled', 'physics.enabled')}
          {checkboxField('Collider enabled', 'physics.colliderEnabled')}
          {selectField('Body type', 'physics.bodyType', [
            { value: 'static', label: 'Static' },
            { value: 'dynamic', label: 'Dynamic' },
            { value: 'kinematic', label: 'Kinematic' },
          ])}
          {numberField('Mass', 'physics.mass', 0.01, 1000, 0.01)}
          {numberField('Gravity scale', 'physics.gravityScale', -10, 10, 0.1)}
          {numberField('Friction', 'physics.friction', 0, 1, 0.05)}
          {numberField('Bounciness', 'physics.restitution', 0, 1, 0.05)}
          {checkboxField('Simulate this rigid body in Play', 'physics.simulateInPlay')}
          <small>Opt-in physics for the shared 3D scene runtime and web player. Character/action controllers keep control of their own movement.</small>
          <details>
            <summary>Launch velocity (optional)</summary>
            <small>Starting speed in scene units per second. Z is up. Applied when Play starts or this body enters simulation.</small>
            {(['x', 'y', 'z'] as const).map(axis =>
              <div key={axis}>{numberField(axis.toUpperCase(), `physics.initialVelocity.${axis}`, -100000, 100000, 1)}</div>)}
          </details>
          {checkboxField('Continuous collision (fast objects)', 'physics.continuousCollision')}
          <small>On Dynamic bodies, sweeps against stationary Static box colliders. Moving-body pairs and rotation still use discrete contacts. Enable only where needed.</small>
          <details>
          <summary>Collision groups (advanced)</summary>
          <label>
            Collision preset
            <select value="" onChange={event => {
              const draft = collisionPresetDraft(event.target.value);
              if (draft) setValues(current => ({ ...current, ...draft }));
            }}>
              <option value="">Choose a quick setup…</option>
              {collisionPresets.map(preset => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
            </select>
          </label>
          <small>Presets set contacts and detection—not body type or weapons. Fast projectile also enables Simulate in Play; set its launch velocity above. Every option stays editable.</small>
          {selectField('Collision group', 'physics.collisionLayer',
            collisionLayers.map((label, index) => ({ value: String(index), label })))}
          <p>Rigid-body contacts: choose which groups this object can bump into. Both objects must allow the contact.</p>
          {collisionLayers.map((label, index) =>
            <div key={label}>{checkboxField(`Bump into ${label}${index === 1 ? ' (including built-in floor)' : ''}`, `physics.collides.${index}`)}</div>)}
          <small>These groups affect rigid-body physics only. Trigger zones, navigation and gameplay hit checks are separate.</small>
          </details>
          {vectorFields('Collider size', 'physics.size', 0.1, 512, 0.1)}
        </>)}
        {light && section('Light', <>
          {checkboxField('Enabled', 'light.enabled')}
          {selectField('Light type', 'light.kind', [
            { value: 'point', label: 'Point' },
            { value: 'directional', label: 'Directional' },
            { value: 'ambient', label: 'Ambient' },
          ])}
          {colorField('Color', 'light.color')}
          {numberField('Intensity', 'light.intensity', 0, 100, 0.1)}
          {values['light.kind'] === 'directional' && <>
            {checkboxField('Cast shadows', 'light.castShadow')}
            {selectField('Shadow detail', 'light.shadowMapSize', [
              { value: '512', label: 'Low · 512' },
              { value: '1024', label: 'Medium · 1024' },
              { value: '2048', label: 'High · 2048' },
            ])}
            <small>Higher detail uses more GPU memory. The Performance and Balanced render profiles disable shadows globally.</small>
          </>}
        </>)}
        {camera && section('Camera', <>
          {checkboxField('Enabled', 'camera.enabled')}
          {numberField('Field of view', 'camera.fov', 10, 100, 1)}
          {entity.id !== '__madhorse-main-camera__' && vectorFields('Look target', 'camera.target', -100000, 100000, 0.1)}
        </>)}
        {ui && section('UI Element', <>
          {checkboxField('Enabled', 'ui.enabled')}
          {selectField('Element type', 'ui.kind', uiElementKinds.map(kind => ({ value: kind.value, label: kind.label })))}
          {checkboxField('Show frame', 'ui.frame')}
        </>)}
        {effect && section('Particle Effect', <>
          {checkboxField('Enabled', 'effect.enabled')}
          {colorField('Effect color', 'effect.color')}
          {selectField('Style', 'effect.style', [
            { value: 'aura', label: 'Aura' },
            { value: 'motes', label: 'Floating motes' },
            { value: 'mist', label: 'Soft mist' },
            { value: 'portal', label: 'Portal ring' },
          ])}
          {numberField('Intensity', 'effect.intensity', 0, 10, 0.1)}
        </>)}
        {sprite && !isFighterEntity(entity) && section('Sprite Renderer', <>
          {checkboxField('Enabled', 'sprite.enabled')}
          {colorField('Tint', 'sprite.tint')}
          {numberField('Width', 'sprite.width', 0.1, 512, 0.1)}
          {numberField('Height', 'sprite.height', 0.1, 512, 0.1)}
          {selectField('Image asset', 'sprite.assetId', assetOptions(imageAssets))}
        </>)}
        {model && !primitive && !isFighterEntity(entity) && section('Model Renderer', <>
          {checkboxField('Enabled', 'model.enabled')}
          {checkboxField('Automatic model detail (LOD)', 'model.lod.enabled')}
          <p className="fresh-inspector-note">Keep original geometry nearby and while selected. Supported static models get lighter geometry when small on screen. Skinned/morph models stay original.</p>
          <details>
            <summary>Distant-detail settings</summary>
            {numberField('Medium detail below screen height %', 'model.lod.medium', 1, 100, .1)}
            {numberField('Low detail below screen height %', 'model.lod.low', .1, 99.9, .1)}
            <small>Low must be smaller than Medium. Save Changes to apply. Original files are never replaced.</small>
          </details>
          {lodReport && lodReport.assetId === model?.assetId && <p className="fresh-inspector-note" role="status">
            Last renderer result: {lodReport.message}<br />
            Triangles — original: {Math.round(lodReport.fullTriangles).toLocaleString()};
            medium: {Math.round(lodReport.mediumTriangles).toLocaleString()};
            low: {Math.round(lodReport.lowTriangles).toLocaleString()}.
            Detail level: {lodReport.activeLevel === 0 ? 'Original' : lodReport.activeLevel === 1 ? 'Medium' : 'Low'}.
          </p>}
          {selectField('Model asset', 'model.assetId', assetOptions(modelAssets))}
          {selectField('Project PBR material', 'model.materialAssetId', [
            { value: '', label: 'Use imported model materials' },
            ...pbrMaterials.map(asset => ({ value: asset.id, label: asset.name })),
          ])}
          <p className="fresh-inspector-note">A project PBR material overrides the imported model’s surface maps. Create or edit reusable materials under Plugins → Asset Plugins.</p>
        </>)}
        {script && section('Script', <>
          {checkboxField('Enabled', 'script.enabled')}
          <p className="fresh-inspector-note">Script source editing is available from the Script tool.</p>
        </>)}
        <PlayerActionSettings
          actions={entity.components.filter(component => component.type === 'playerAction')}
          values={values} setValue={setValue} assets={assets} assetUrls={assetUrls}
          entities={entities} ownerId={entity.id} onStatus={setAudioPreviewStatus}
        />
        <GameFeatureSettings
          features={entity.components.filter(component => component.type === 'gameFeature')}
          values={values} setValue={setValue} assets={assets} assetUrls={assetUrls}
          onStatus={setAudioPreviewStatus}
        />
        {gameAudio && section('Game Audio', <>
          {checkboxField('Enabled', 'gameAudio.enabled')}
          {selectField('Sound clip', 'gameAudio.clipAssetId', assetOptions(audioAssets))}
          {numberField('Volume', 'gameAudio.volume', 0, 1, 0.05)}
          {numberField('Pitch', 'gameAudio.pitch', 0.25, 2, 0.05)}
          {checkboxField('Play when test starts', 'gameAudio.playOnStart')}
          <button
            type="button"
            className="is-quiet"
            onClick={() => {
              if (values['gameAudio.clipAssetId'] && !assetUrls[values['gameAudio.clipAssetId']]) {
                setAudioPreviewStatus('The selected sound file is still loading or is missing from this browser.');
                return;
              }
              stopAudioPlayback();
              void playAudioPreview(
                assetUrls[values['gameAudio.clipAssetId']] ?? null,
                number('gameAudio.volume'),
                number('gameAudio.pitch'),
                'tone',
              ).then(played => setAudioPreviewStatus(played ? 'Sound played.' : 'This browser could not play the sound.'));
            }}
          >
            Test sound
          </button>
          <p className="fresh-inspector-note">Choose an audio file, or test the built-in tone.</p>
        </>)}
        {playerWalkAudio && section('Player Walk Audio', <>
          {checkboxField('Enabled', 'playerWalkAudio.enabled')}
          {selectField('Footstep sound', 'playerWalkAudio.clipAssetId', assetOptions(audioAssets))}
          {numberField('Volume', 'playerWalkAudio.volume', 0, 1, 0.01)}
          {numberField('Pitch', 'playerWalkAudio.pitch', 0.25, 2, 0.05)}
          {numberField('Time between steps (seconds)', 'playerWalkAudio.stepInterval', 0.15, 2, 0.01)}
          <button
            type="button"
            className="is-quiet"
            onClick={() => {
              if (values['playerWalkAudio.clipAssetId'] && !assetUrls[values['playerWalkAudio.clipAssetId']]) {
                setAudioPreviewStatus('The selected footstep file is still loading or is missing from this browser.');
                return;
              }
              stopAudioPlayback();
              void playAudioPreview(
                assetUrls[values['playerWalkAudio.clipAssetId']] ?? null,
                number('playerWalkAudio.volume'),
                number('playerWalkAudio.pitch'),
                'footstep',
              ).then(played => setAudioPreviewStatus(played ? 'Footstep played.' : 'This browser could not play the footstep.'));
            }}
          >
            Test footsteps
          </button>
          <p className="fresh-inspector-note">Footsteps play while a Player Controller moves in Play Test. Add one from Plugins if needed.</p>
        </>)}
        {(gameAudio || playerWalkAudio || entity.components.some(component =>
          component.type === 'playerAction' || component.type === 'gameFeature' && Boolean(gameFeatureDefinitions[component.kind].audio),
        )) && (
          <button type="button" className="is-quiet" onClick={() => {
            stopAudioPlayback();
            setAudioPreviewStatus('Audio preview stopped.');
          }}>Stop audio preview</button>
        )}
        {audioPreviewStatus && <p className="fresh-inspector-note" role="status">{audioPreviewStatus}</p>}
        {controller && section('Character Controller', <>
          {checkboxField('Enabled', 'controller.enabled')}
          {selectField('Role', 'controller.role', [
            { value: 'player', label: 'Player' },
            { value: 'npc', label: 'NPC' },
          ])}
          {selectField('Camera style', 'controller.perspective', [
            { value: 'top-down', label: 'Top-down' },
            { value: 'third-person', label: 'Third person' },
          { value: 'first-person', label: 'First person' },
          ])}
          {selectField('NPC behavior', 'controller.behavior', [
            { value: 'direct-control', label: 'Direct control' },
            { value: 'follow-player', label: 'Follow player' },
            { value: 'patrol', label: 'Patrol' },
          ])}
          {numberField('Move speed (m/s)', 'controller.moveSpeed', 0, 40, 0.1)}
          {numberField('Jump height (m)', 'controller.jumpHeight', 0, 20, 0.1)}
          {numberField('Follow distance (m)', 'controller.followDistance', 0, 100, 0.1)}
          {numberField('Patrol radius (m)', 'controller.patrolRadius', 0, 100, 0.1)}
          <p className="fresh-inspector-note">Play Test uses WASD or arrow keys; Space jumps. Runtime movement is temporary and does not change saved transforms.</p>
        </>)}
        {triggerZone && section('Trigger Zone', <>
          {checkboxField('Enabled', 'trigger.enabled')}
          {selectField('Shape', 'trigger.shape', [
            { value: 'box', label: 'Box' },
            { value: 'sphere', label: 'Sphere' },
          ])}
          {vectorFields('Zone size (m)', 'trigger.size', 0.1, 100, 0.1)}
          {selectField('On player enter', 'trigger.action', [
            { value: 'notify', label: 'Show event message' },
            { value: 'enable-target', label: 'Enable target object' },
            { value: 'toggle-target', label: 'Toggle target object' },
          ])}
          {selectField('Target object', 'trigger.targetEntityId', [
            { value: '', label: 'None' },
            ...entities.filter(candidate => candidate.id !== entity.id).map(candidate => ({ value: candidate.id, label: candidate.name })),
          ])}
          <label className="fresh-setting">
            <span>Event message</span>
            <input type="text" maxLength={160} value={values['trigger.message'] ?? ''} onChange={event => setValue('trigger.message', event.currentTarget.value)} />
          </label>
          <VisualLogicEditor zone={{
            ...triggerZone,
            logicNodes: (() => {
              try { return JSON.parse(values['trigger.logicNodes'] ?? '[]') as VisualLogicNode[]; }
              catch { return triggerZone.logicNodes ?? []; }
            })(),
          }} entity={entity} entities={entities} onChange={nodes => setValue('trigger.logicNodes', JSON.stringify(nodes))} />
        </>)}
        {skybox && section('Skybox Background', <>
          {checkboxField('Enabled', 'skybox.enabled')}
          <label className="fresh-setting">
            <span>Scene background</span>
            <input type="color" value={values['skybox.color'] ?? '#252a35'} onChange={event => setValue('skybox.color', event.currentTarget.value)} />
          </label>
          <p className="fresh-inspector-note">This color applies to the whole scene in edit view. Disable this component to return to render settings.</p>
        </>)}
        {multiplayerPlugins.map(item => section(`Multiplayer ${item.mode}`, <>
          {checkboxField('Enabled', `multiplayer.${item.id}.enabled`)}
          {item.mode === 'event' && (
            <label className="fresh-setting">
              <span>Event name</span>
              <input
                type="text"
                maxLength={80}
                value={values[`multiplayer.${item.id}.eventName`] ?? item.eventName}
                onChange={event => setValue(`multiplayer.${item.id}.eventName`, event.currentTarget.value)}
              />
            </label>
          )}
          <p className="fresh-inspector-note">
            {item.mode === 'player'
              ? 'This player shares its position with the room during Play Test.'
              : item.mode === 'object'
                ? 'This object shares its position with the room during Play Test.'
                : 'Use the Multiplayer Plugins panel to send game events to everyone in the room.'}
          </p>
        </>))}
        {error && <p className="fresh-inspector-error" role="alert">{error}</p>}
        <div className="fresh-dialog-actions">
          <button type="button" className="is-quiet" onClick={onClose}>{embedded ? 'Back to Settings' : 'Cancel'}</button>
          <button type="submit">Save Changes</button>
        </div>
      </form>
  );
  if (embedded) return form;
  return (
    <div className="fresh-dialog-backdrop" role="presentation" onMouseDown={event => {
      if (event.target === event.currentTarget) onClose();
    }}>
      {form}
    </div>
  );
}
