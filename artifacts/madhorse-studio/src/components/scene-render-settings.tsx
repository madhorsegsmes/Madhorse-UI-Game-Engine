import { useSceneRenderSettings, type SceneRenderSettings } from '@/hooks/use-scene-render-settings';

export function WorkspaceRenderSettings() {
  const [settings, setSettings] = useSceneRenderSettings();
  return <SceneRenderSettingsPanel settings={settings} onChange={setSettings} />;
}

export function SceneRenderSettingsPanel({
  settings, onChange,
}: {
  settings: SceneRenderSettings;
  onChange: (settings: SceneRenderSettings) => void;
}) {
  return (
    <details className="mh-scene3d__render-settings" data-testid="scene-render-settings">
      <summary>Render settings</summary>
      <div className="mh-scene3d__render-panel">
        <label>
          <input
            type="checkbox"
            checked={settings.showGrid}
            onChange={(event) => onChange({ ...settings, showGrid: event.currentTarget.checked })}
            data-testid="scene-render-grid"
          />
          Show grid
        </label>
        <label>
          Render quality
          <select
            value={settings.quality}
            onChange={(event) => onChange({ ...settings, quality: event.currentTarget.value as SceneRenderSettings['quality'] })}
            aria-label="Scene render quality"
            data-testid="scene-render-quality"
          >
            <option value="performance">Performance · 1x</option>
            <option value="balanced">Balanced · up to 1.5x</option>
            <option value="high">Gaming PC · High · up to 2x</option>
          </select>
        </label>
        <p className="mh-scene3d__render-note">
          Gaming PC quality is the default. Saved quality choices stay unchanged.
        </p>
        <label>
          <input
            type="checkbox"
            checked={settings.showPerformanceStats}
            onChange={(event) => onChange({ ...settings, showPerformanceStats: event.currentTarget.checked })}
            data-testid="scene-render-performance-stats"
          />
          Show performance stats
        </label>
        <label>
          <input
            type="checkbox"
            checked={settings.studioLighting}
            onChange={(event) => onChange({ ...settings, studioLighting: event.currentTarget.checked })}
            data-testid="scene-render-lighting"
          />
          Studio lighting
        </label>
        <label>
          <input type="checkbox"
            checked={settings.environmentReflections && settings.quality !== 'performance'}
            disabled={settings.quality === 'performance'}
            onChange={event => onChange({ ...settings, environmentReflections: event.currentTarget.checked })}
            data-testid="scene-render-reflections" />
          Studio PBR reflections
        </label>
        <label className="mh-scene3d__reflection-strength">
          <span>Reflection strength</span>
          <input type="range" min="0" max="2" step="0.05" value={settings.reflectionIntensity}
            disabled={!settings.environmentReflections || settings.quality === 'performance'}
            aria-label="Reflection strength" data-testid="scene-render-reflection-intensity"
            onChange={event => onChange({ ...settings, reflectionIntensity: Number(event.currentTarget.value) })} />
          <output>{settings.reflectionIntensity.toFixed(2)}</output>
        </label>
        <p className="mh-scene3d__render-note">
          Prefiltered studio reflections help metal and rough surfaces respond to light.
          Performance quality disables them. This is not ray tracing or Lumen.
        </p>
        <label className="mh-scene3d__render-exposure">
          Exposure
          <input
            type="range"
            min="0.5"
            max="1.6"
            step="0.1"
            value={settings.exposure}
            onChange={(event) => onChange({ ...settings, exposure: Number(event.currentTarget.value) })}
            aria-label="Scene render exposure"
            data-testid="scene-render-exposure"
          />
          <output>{settings.exposure.toFixed(1)}</output>
        </label>
        <label className="mh-scene3d__render-background">
          Background
          <input
            type="color"
            value={settings.background}
            onChange={(event) => onChange({ ...settings, background: event.currentTarget.value })}
            aria-label="Scene render background"
            data-testid="scene-render-background"
          />
        </label>
      </div>
    </details>
  );
}
