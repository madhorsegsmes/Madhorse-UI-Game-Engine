import type { ProjectAsset, SceneEntity } from '@/lib/scene-model';
import { actionKeyOptions, playerActionDefinitions, playerActionPrefix, type PlayerActionComponent } from '@/lib/player-action-model';
import { playAudioPreview, stopAudioPlayback } from '@/lib/game-audio';

export function PlayerActionSettings({ actions, values, setValue, assets, assetUrls, entities, ownerId, onStatus }: {
  actions: PlayerActionComponent[];
  values: Record<string, string>;
  setValue: (key: string, value: string) => void;
  assets: ProjectAsset[];
  assetUrls: Record<string, string>;
  entities: SceneEntity[];
  ownerId: string;
  onStatus: (message: string) => void;
}) {
  return <>{actions.map(action => {
    const definition = playerActionDefinitions[action.action];
    const prefix = playerActionPrefix(action.id);
    const defaultKey = definition.key === 'shift' ? 'Shift' : definition.key === 'control' ? 'Control' : definition.key.toUpperCase();
    const chosenKey = (values[`${prefix}key`] ?? definition.key).toUpperCase();
    const instructions = definition.help.replace(`Hold ${defaultKey}`, `Hold ${chosenKey}`).replace(`Press ${defaultKey}`, `Press ${chosenKey}`);
    return <fieldset className="fresh-inspector-section" key={action.id} data-testid={`action-settings-${action.action}`}>
      <legend>{definition.label} + Sound</legend>
      <p className="fresh-inspector-note">{instructions}</p>
      <label className="fresh-setting fresh-setting-checkbox">
        <span>Enabled</span>
        <input type="checkbox" checked={values[`${prefix}enabled`] === 'true'} onChange={event => setValue(`${prefix}enabled`, String(event.currentTarget.checked))} />
      </label>
      <label className="fresh-setting">
        <span>Control key</span>
        <select aria-label="Control key" value={values[`${prefix}key`]} onChange={event => setValue(`${prefix}key`, event.currentTarget.value)}>
          {actionKeyOptions.map(key => <option value={key} key={key}>{key.toUpperCase()}</option>)}
        </select>
      </label>
      {definition.fields.map(field => <label className="fresh-setting" key={field.name}>
        <span>{field.label}</span>
        <input type="number" inputMode="decimal" min={field.min} max={field.max} step={field.integer ? 1 : 'any'}
          value={values[`${prefix}${field.name}`] ?? ''}
          onChange={event => setValue(`${prefix}${field.name}`, event.currentTarget.value)} required />
      </label>)}
      {['fight', 'shoot', 'cast', 'play-card', 'command', 'gather', 'follow'].includes(action.action) && <label className="fresh-setting">
        <span>{action.action === 'command' ? 'Rally object' : action.action === 'follow' ? 'Companion target' : action.action === 'gather' ? 'Resource node' : 'Practice target'}</span>
        <select aria-label={action.action === 'command' ? 'Rally object' : action.action === 'follow' ? 'Companion target' : action.action === 'gather' ? 'Resource node' : 'Practice target'} value={values[`${prefix}targetId`]} onChange={event => setValue(`${prefix}targetId`, event.currentTarget.value)}>
          <option value="">{action.action === 'command' ? 'Automatic: point in front of player' : 'Automatic: nearest in reach / aim direction'}</option>
          {entities.filter(entity => {
            if (entity.id === ownerId) return false;
            if (action.action === 'command') return !entity.components.some(component => component.type === 'camera');
            if (action.action === 'follow') return entity.components.some(component => component.type === 'characterController' && component.role === 'npc');
            if (action.action === 'gather') return entity.components.some(component => component.type === 'gameFeature' && component.kind === 'pickup');
            return !entity.isGroup && entity.components.some(component =>
              component.type === 'primitive' && !['plane', 'terrain'].includes(component.shape) ||
              component.type === 'modelRenderer' || component.type === 'spriteRenderer');
          }).map(entity => <option key={entity.id} value={entity.id}>{entity.name}</option>)}
        </select>
      </label>}
      <label className="fresh-setting">
        <span>Sound clip</span>
        <select aria-label="Sound clip" value={values[`${prefix}clipAssetId`]} onChange={event => setValue(`${prefix}clipAssetId`, event.currentTarget.value)}>
          <option value="">Built-in {definition.label.toLowerCase()} sound</option>
          {assets.filter(asset => asset.kind === 'audio').map(asset => <option value={asset.id} key={asset.id}>{asset.name}</option>)}
        </select>
      </label>
      <label className="fresh-setting">
        <span>Sound volume</span>
        <input type="number" inputMode="decimal" min={0} max={1} step="any" value={values[`${prefix}volume`]}
          onChange={event => setValue(`${prefix}volume`, event.currentTarget.value)} required />
      </label>
      <button type="button" className="is-quiet" onClick={() => {
        const clipId = values[`${prefix}clipAssetId`];
        if (clipId && !assetUrls[clipId]) { onStatus('That sound file is still loading or missing from this browser.'); return; }
        stopAudioPlayback();
        void playAudioPreview(clipId ? assetUrls[clipId] : null, Number(values[`${prefix}volume`]), 1, action.action)
          .then(played => onStatus(played ? `${definition.label} sound played.` : 'This browser could not play the sound.'));
      }}>Test {definition.label.toLowerCase()} sound</button>
      <p className="fresh-inspector-note">Press Save Changes, then Play Test on your PC. Use W/A/S/D or arrows to move and your chosen keyboard keys for actions. Combat, inventory, and placed blocks reset when you stop.</p>
    </fieldset>;
  })}</>;
}
