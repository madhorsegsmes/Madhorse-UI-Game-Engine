import { useSceneRenderSettings, type SceneRenderSettings } from '@/hooks/use-scene-render-settings';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import type { SceneEditState } from '@/lib/scene-edit-history';
import { SceneReadinessDialog } from './scene-readiness-dialog';
import { PhysicsDebugOptions } from './physics-debug-options';
import { isPixelRpgScene } from '@/lib/pixel-rpg-runtime';
import { isCardDuelScene } from '@/lib/card-duel-runtime';

export function WorkspaceRenderSettings({ source, projectId, projectName, disabled, onInspect }: {
  source: SceneEditState; projectId: string; projectName: string; disabled: boolean;
  onInspect: (entityId: string) => void;
}) {
  const [settings, setSettings] = useSceneRenderSettings();
  const [checking, setChecking] = useState(false);
  return <>
    <SceneRenderSettingsPanel settings={settings} onChange={setSettings}
      physicsGuidesAvailable={!isPixelRpgScene(source.entities) && !isCardDuelScene(source.entities)}
      onCheckScene={() => setChecking(true)} checksDisabled={disabled} />
    {checking && createPortal(<SceneReadinessDialog source={source} projectId={projectId} projectName={projectName}
      onClose={() => setChecking(false)} onInspect={onInspect} />, document.body)}
  </>;
}

export function SceneRenderSettingsPanel({
  settings, onChange, onCheckScene, checksDisabled, physicsGuidesAvailable = true,
}: {
  settings: SceneRenderSettings;
  onChange: (settings: SceneRenderSettings) => void;
  onCheckScene?: () => void;
  checksDisabled?: boolean;
  physicsGuidesAvailable?: boolean;
}) {
  return (
    <details className="mh-scene3d__render-settings" data-testid="scene-render-settings">
      <summary>Render settings</summary>
      <div className="mh-scene3d__render-panel">
        <PhysicsDebugOptions available={physicsGuidesAvailable} />
        <label>
          <input
            type="checkbox"
            checked={settings.showGrid}
            onChange={(event) => onChange({ ...settings, showGrid: event.currentTarget.checked })}
            data-testid="scene-render-grid"
          />
          Show grid
        </label>
        <fieldset className="mh-scene3d__fog-settings" data-testid="scene-fog-settings">
          <legend>Distance fog</legend>
          <label>
            <input type="checkbox" checked={settings.fogEnabled}
              onChange={event => onChange({ ...settings, fogEnabled: event.currentTarget.checked })}
              data-testid="scene-fog-enabled" />
            Enable fog
          </label>
          <label>
            Fog style
            <select value={settings.fogMode} disabled={!settings.fogEnabled}
              onChange={event => onChange({ ...settings, fogMode: event.currentTarget.value as SceneRenderSettings['fogMode'] })}
              aria-label="Fog style" data-testid="scene-fog-mode">
              <option value="linear">Linear · clear near, fade far</option>
              <option value="exponential">Exponential · denser with distance</option>
            </select>
          </label>
          <label className="mh-scene3d__render-background">
            Fog and horizon color
            <input type="color" value={settings.fogColor} disabled={!settings.fogEnabled}
              onChange={event => onChange({ ...settings, fogColor: event.currentTarget.value })}
              aria-label="Fog and horizon color" data-testid="scene-fog-color" />
          </label>
          {settings.fogMode === 'linear' ? <>
            <label>
              <span>Fog starts · {settings.fogNear.toFixed(0)} units</span>
              <input type="range" min="0" max={Math.max(0, settings.fogFar - 1)} step="1"
                value={settings.fogNear} disabled={!settings.fogEnabled}
                aria-label="Fog start distance" data-testid="scene-fog-near"
                onChange={event => onChange({ ...settings, fogNear: Number(event.currentTarget.value) })} />
            </label>
            <label>
              <span>Fog ends · {settings.fogFar.toFixed(0)} units</span>
              <input type="range" min={settings.fogNear + 1} max="1000" step="1"
                value={settings.fogFar} disabled={!settings.fogEnabled}
                aria-label="Fog end distance" data-testid="scene-fog-far"
                onChange={event => onChange({ ...settings, fogFar: Number(event.currentTarget.value) })} />
            </label>
          </> : <label>
            <span>Fog density · {settings.fogDensity.toFixed(3)}</span>
            <input type="range" min="0.001" max="0.1" step="0.001" value={settings.fogDensity}
              disabled={!settings.fogEnabled} aria-label="Fog density" data-testid="scene-fog-density"
              onChange={event => onChange({ ...settings, fogDensity: Number(event.currentTarget.value) })} />
          </label>}
          <small>Distance fog adds depth in WebGL previews and exported games. It is not volumetric fog; the low-graphics fallback does not simulate it.</small>
        </fieldset>
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
        {onCheckScene && <button type="button" onClick={onCheckScene} disabled={checksDisabled}
          title={checksDisabled ? 'Stop Play/Test and wait for current work to finish.' : 'Check scene links and local asset files without changing the project.'}
          data-testid="button-scene-checks">Check scene</button>}
      </div>
    </details>
  );
}
