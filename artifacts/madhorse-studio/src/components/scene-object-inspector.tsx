import { useState, type FormEvent, type ReactNode } from 'react';
import {
  isSceneEntity,
  primitiveShapes,
  uiElementKinds,
  type ProjectAsset,
  type PrimitiveShape,
  type SceneComponent,
  type SceneEntity,
  type UIElementKind,
} from '@/lib/scene-model';

type Props = {
  entity: SceneEntity;
  assets: ProjectAsset[];
  canRename?: boolean;
  canEditActive?: boolean;
  embedded?: boolean;
  onClose: () => void;
  onSave: (entity: SceneEntity) => void;
};

function toDraft(entity: SceneEntity) {
  const values: Record<string, string> = { active: String(entity.active) };
  for (const component of entity.components) {
    if (component.type === 'transform') {
      for (const key of ['position', 'rotation', 'scale'] as const) {
        for (const axis of ['x', 'y', 'z'] as const) values[`transform.${key}.${axis}`] = String(component[key][axis]);
      }
    } else if (component.type === 'primitive') {
      values['primitive.shape'] = component.shape;
      values['primitive.color'] = component.color;
      values['primitive.opacity'] = String(component.opacity ?? 1);
      values['primitive.textureAssetId'] = component.textureAssetId ?? '';
    } else if (component.type === 'light') {
      values['light.kind'] = component.kind;
      values['light.color'] = component.color;
      values['light.intensity'] = String(component.intensity);
      values['light.enabled'] = String(component.enabled);
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
    } else if (component.type === 'effect') {
      values['effect.color'] = component.color;
      values['effect.intensity'] = String(component.intensity);
      values['effect.enabled'] = String(component.enabled);
    } else if (component.type === 'physics') {
      values['physics.enabled'] = String(component.enabled);
      values['physics.colliderEnabled'] = String(component.colliderEnabled);
      values['physics.bodyType'] = component.bodyType;
      values['physics.mass'] = String(component.mass);
      values['physics.gravityScale'] = String(component.gravityScale);
      values['physics.friction'] = String(component.friction);
      values['physics.restitution'] = String(component.restitution);
      for (const axis of ['x', 'y', 'z'] as const) values[`physics.size.${axis}`] = String(component.size[axis]);
    } else if (component.type === 'spriteRenderer') {
      values['sprite.enabled'] = String(component.enabled);
      values['sprite.tint'] = component.tint;
      values['sprite.width'] = String(component.width);
      values['sprite.height'] = String(component.height);
      values['sprite.assetId'] = component.assetId ?? '';
    } else if (component.type === 'modelRenderer') {
      values['model.enabled'] = String(component.enabled);
      values['model.assetId'] = component.assetId ?? '';
    }
  }
  return values;
}

export function SceneObjectInspector({
  entity,
  assets,
  canRename = true,
  canEditActive = true,
  embedded = false,
  onClose,
  onSave,
}: Props) {
  const [name, setName] = useState(entity.name);
  const [values, setValues] = useState(() => toDraft(entity));
  const [error, setError] = useState('');
  const setValue = (key: string, value: string) => {
    setValues(current => ({ ...current, [key]: value }));
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
        step={step}
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
    const nextComponents = entity.components.map((item): SceneComponent => {
      if (item.type === 'transform') return {
        ...item,
        position: { x: number('transform.position.x'), y: number('transform.position.y'), z: number('transform.position.z') },
        rotation: { x: number('transform.rotation.x'), y: number('transform.rotation.y'), z: number('transform.rotation.z') },
        scale: { x: number('transform.scale.x'), y: number('transform.scale.y'), z: number('transform.scale.z') },
      };
      if (item.type === 'primitive') return {
        ...item,
        shape: values['primitive.shape'] as PrimitiveShape,
        color: values['primitive.color'],
        opacity: number('primitive.opacity'),
        textureAssetId: values['primitive.textureAssetId'] || null,
      };
      if (item.type === 'light') return {
        ...item,
        kind: values['light.kind'] as typeof item.kind,
        color: values['light.color'],
        intensity: number('light.intensity'),
        enabled: values['light.enabled'] === 'true',
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
      if (item.type === 'effect') return {
        ...item,
        color: values['effect.color'],
        intensity: number('effect.intensity'),
        enabled: values['effect.enabled'] === 'true',
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
        size: { x: number('physics.size.x'), y: number('physics.size.y'), z: number('physics.size.z') },
      };
      if (item.type === 'spriteRenderer') return {
        ...item,
        enabled: values['sprite.enabled'] === 'true',
        tint: values['sprite.tint'],
        width: number('sprite.width'),
        height: number('sprite.height'),
        assetId: values['sprite.assetId'] || null,
      };
      return {
        ...item,
        enabled: values['model.enabled'] === 'true',
        assetId: values['model.assetId'] || null,
      };
    });
    const updated: SceneEntity = {
      ...entity,
      name: canRename ? name.trim() : entity.name,
      active: values.active === 'true',
      components: nextComponents,
    };
    if (canRename && !updated.name) {
      setError('Enter a name for this object.');
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
  const effect = component('effect');
  const sprite = component('spriteRenderer');
  const model = component('modelRenderer');
  const imageAssets = assets.filter(asset => asset.kind === 'image');
  const modelAssets = assets.filter(asset => asset.kind === 'model');
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
        {entity.components.some(item => item.type === 'transform') && <>
          {vectorFields('Position', 'transform.position', -100000, 100000, 0.1)}
          {vectorFields('Rotation', 'transform.rotation', -360000, 360000, 1)}
          {vectorFields('Scale', 'transform.scale', 0.1, 1000, 0.1)}
        </>}
        {primitive && section('3D Shape', <>
          {selectField('Shape', 'primitive.shape', [
            ...primitiveShapes.map(shape => ({ value: shape.value, label: shape.label })),
            { value: 'terrain', label: 'Terrain' },
          ])}
          {colorField('Surface color', 'primitive.color')}
          {numberField('Opacity', 'primitive.opacity', 0.05, 1, 0.05)}
          {selectField('Surface texture', 'primitive.textureAssetId', assetOptions(imageAssets))}
        </>)}
        {physics && section('Physics', <>
          {checkboxField('Enabled', 'physics.enabled')}
          {checkboxField('Collider enabled', 'physics.colliderEnabled')}
          {selectField('Body type', 'physics.bodyType', [
            { value: 'static', label: 'Static' },
            { value: 'dynamic', label: 'Dynamic' },
            { value: 'kinematic', label: 'Kinematic' },
          ])}
          {numberField('Mass', 'physics.mass', 0.01, 1000, 0.1)}
          {numberField('Gravity scale', 'physics.gravityScale', -10, 10, 0.1)}
          {numberField('Friction', 'physics.friction', 0, 1, 0.05)}
          {numberField('Bounciness', 'physics.restitution', 0, 1, 0.05)}
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
          {numberField('Intensity', 'effect.intensity', 0, 10, 0.1)}
        </>)}
        {sprite && section('Sprite Renderer', <>
          {checkboxField('Enabled', 'sprite.enabled')}
          {colorField('Tint', 'sprite.tint')}
          {numberField('Width', 'sprite.width', 0.1, 512, 1)}
          {numberField('Height', 'sprite.height', 0.1, 512, 1)}
          {selectField('Image asset', 'sprite.assetId', assetOptions(imageAssets))}
        </>)}
        {model && section('Model Renderer', <>
          {checkboxField('Enabled', 'model.enabled')}
          {selectField('Model asset', 'model.assetId', assetOptions(modelAssets))}
        </>)}
        {script && section('Script', <>
          {checkboxField('Enabled', 'script.enabled')}
          <p className="fresh-inspector-note">Script source editing is available from the Script tool.</p>
        </>)}
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
