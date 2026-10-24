import { useEffect, useState } from 'react';

export type SceneRenderQuality = 'performance' | 'balanced' | 'high';

export type SceneRenderSettings = {
  showGrid: boolean;
  studioLighting: boolean;
  exposure: number;
  background: string;
  quality: SceneRenderQuality;
  showPerformanceStats: boolean;
};

export const DEFAULT_SCENE_RENDER_SETTINGS: SceneRenderSettings = {
  showGrid: true,
  studioLighting: true,
  exposure: 1,
  background: '#1d1f22',
  quality: 'balanced',
  showPerformanceStats: false,
};

const storageKey = 'madhorse-studio-scene-render-settings';

function readSettings(): SceneRenderSettings {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return DEFAULT_SCENE_RENDER_SETTINGS;
    const value = JSON.parse(raw) as Partial<SceneRenderSettings>;
    return {
      showGrid: typeof value.showGrid === 'boolean' ? value.showGrid : true,
      studioLighting: typeof value.studioLighting === 'boolean' ? value.studioLighting : true,
      exposure: typeof value.exposure === 'number' && Number.isFinite(value.exposure)
        ? Math.min(1.6, Math.max(0.5, value.exposure)) : 1,
      background: /^#[\da-f]{6}$/i.test(value.background ?? '')
        ? value.background! : DEFAULT_SCENE_RENDER_SETTINGS.background,
      quality: value.quality === 'performance' || value.quality === 'high' ? value.quality : 'balanced',
      showPerformanceStats: typeof value.showPerformanceStats === 'boolean' ? value.showPerformanceStats : false,
    };
  } catch {
    return DEFAULT_SCENE_RENDER_SETTINGS;
  }
}

export function useSceneRenderSettings() {
  const [settings, setSettings] = useState<SceneRenderSettings>(readSettings);
  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(settings)); } catch { /* Preferences remain session-local. */ }
  }, [settings]);
  return [settings, setSettings] as const;
}
