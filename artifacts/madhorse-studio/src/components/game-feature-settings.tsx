import type { ProjectAsset } from '@/lib/scene-model';
import {
  gameFeatureDefinitions, gameFeaturePrefix, type GameFeatureComponent,
} from '@/lib/game-feature-model';
import { playAudioPreview, stopAudioPlayback } from '@/lib/game-audio';

export function GameFeatureSettings({ features, values, setValue, assets, assetUrls, onStatus }: {
  features: GameFeatureComponent[];
  values: Record<string, string>;
  setValue: (key: string, value: string) => void;
  assets: ProjectAsset[];
  assetUrls: Record<string, string>;
  onStatus: (message: string) => void;
}) {
  return <>{features.map(feature => {
    const definition = gameFeatureDefinitions[feature.kind];
    const prefix = gameFeaturePrefix(feature.id);
    return <fieldset className="fresh-inspector-section" key={feature.id} data-testid={`feature-settings-${feature.kind}`}>
      <legend>{definition.label}</legend>
      <p className="fresh-inspector-note">{definition.help}</p>
      <label className="fresh-setting fresh-setting-checkbox">
        <span>Enabled</span>
        <input type="checkbox" checked={values[`${prefix}enabled`] === 'true'}
          onChange={event => setValue(`${prefix}enabled`, String(event.currentTarget.checked))} />
      </label>
      {definition.fields.map(field => <label className="fresh-setting" key={field.name}>
        <span>{field.label}</span>
        {field.type === 'boolean' ? <input type="checkbox" checked={values[`${prefix}${field.name}`] === 'true'}
          onChange={event => setValue(`${prefix}${field.name}`, String(event.currentTarget.checked))} /> :
          field.type === 'select' ? <select aria-label={field.label} value={values[`${prefix}${field.name}`]}
            onChange={event => setValue(`${prefix}${field.name}`, event.currentTarget.value)}>
            {field.options?.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select> :
            <input type={field.type === 'color' ? 'color' : field.type}
              min={field.type === 'number' ? field.min : undefined}
              max={field.type === 'number' ? field.max : field.type === 'text' ? field.max : undefined}
              maxLength={field.type === 'text' ? field.max : undefined}
              step={field.type === 'number' ? field.integer ? 1 : 'any' : undefined}
              value={values[`${prefix}${field.name}`] ?? ''}
              onChange={event => setValue(`${prefix}${field.name}`, event.currentTarget.value)}
              required={field.type === 'number' || field.type === 'text'} />}
      </label>)}
      {definition.audio && <>
        <label className="fresh-setting">
          <span>Sound clip</span>
          <select aria-label="Sound clip" value={values[`${prefix}audioClipAssetId`]}
            onChange={event => setValue(`${prefix}audioClipAssetId`, event.currentTarget.value)}>
            <option value="">Built-in sound</option>
            {assets.filter(asset => asset.kind === 'audio').map(asset => <option value={asset.id} key={asset.id}>{asset.name}</option>)}
          </select>
        </label>
        <label className="fresh-setting">
          <span>Sound volume</span>
          <input type="number" inputMode="decimal" min="0" max="1" step="any"
            value={values[`${prefix}audioVolume`]}
            onChange={event => setValue(`${prefix}audioVolume`, event.currentTarget.value)} required />
        </label>
        <button type="button" className="is-quiet" onClick={() => {
          const clipId = values[`${prefix}audioClipAssetId`];
          if (clipId && !assetUrls[clipId]) { onStatus('That sound file is still loading or missing from this browser.'); return; }
          const sound = feature.kind === 'door' ? 'build' : feature.kind === 'pickup' ? 'craft' : 'tone';
          stopAudioPlayback();
          void playAudioPreview(clipId ? assetUrls[clipId] : null, Number(values[`${prefix}audioVolume`]), 1, sound)
            .then(played => onStatus(played ? `${definition.label} sound played.` : 'This browser could not play the sound.'));
        }}>Test sound</button>
      </>}
    </fieldset>;
  })}</>;
}
