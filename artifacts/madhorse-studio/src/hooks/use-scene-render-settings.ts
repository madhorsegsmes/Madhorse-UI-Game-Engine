import { useSyncExternalStore, type Dispatch, type SetStateAction } from 'react';

export type SceneRenderQuality = 'performance' | 'balanced' | 'high';
export type SceneFogMode = 'linear' | 'exponential';

export type SceneRenderSettings = {
  showGrid: boolean;
  studioLighting: boolean;
  exposure: number;
  background: string;
  fogEnabled: boolean;
  fogMode: SceneFogMode;
  fogColor: string;
  fogNear: number;
  fogFar: number;
  fogDensity: number;
  quality: SceneRenderQuality;
  showPerformanceStats: boolean;
  environmentReflections: boolean;
  reflectionIntensity: number;
};

export const DEFAULT_SCENE_RENDER_SETTINGS: SceneRenderSettings = {
  showGrid: true,
  studioLighting: true,
  exposure: 1,
  background: '#1d1f22',
  fogEnabled: false,
  fogMode: 'linear',
  fogColor: '#8b98a7',
  fogNear: 25,
  fogFar: 180,
  fogDensity: 0.018,
  quality: 'high',
  showPerformanceStats: false,
  environmentReflections: true,
  reflectionIntensity: 0.65,
};

const storageKey = 'madhorse-studio-scene-render-settings';

export function normalizeSceneRenderSettings(input: unknown): SceneRenderSettings {
    const value = input && typeof input === 'object' ? input as Partial<SceneRenderSettings> : {};
    const fogNear = typeof value.fogNear === 'number' && Number.isFinite(value.fogNear)
      ? Math.min(500, Math.max(0, value.fogNear)) : DEFAULT_SCENE_RENDER_SETTINGS.fogNear;
    const requestedFogFar = typeof value.fogFar === 'number' && Number.isFinite(value.fogFar)
      ? Math.min(1000, Math.max(1, value.fogFar)) : DEFAULT_SCENE_RENDER_SETTINGS.fogFar;
    return {
      showGrid: typeof value.showGrid === 'boolean' ? value.showGrid : true,
      studioLighting: typeof value.studioLighting === 'boolean' ? value.studioLighting : true,
      exposure: typeof value.exposure === 'number' && Number.isFinite(value.exposure)
        ? Math.min(1.6, Math.max(0.5, value.exposure)) : 1,
      background: /^#[\da-f]{6}$/i.test(value.background ?? '')
        ? value.background! : DEFAULT_SCENE_RENDER_SETTINGS.background,
      fogEnabled: typeof value.fogEnabled === 'boolean' ? value.fogEnabled : false,
      fogMode: value.fogMode === 'exponential' ? 'exponential' : 'linear',
      fogColor: /^#[\da-f]{6}$/i.test(value.fogColor ?? '')
        ? value.fogColor! : DEFAULT_SCENE_RENDER_SETTINGS.fogColor,
      fogNear,
      fogFar: Math.max(fogNear + 1, requestedFogFar),
      fogDensity: typeof value.fogDensity === 'number' && Number.isFinite(value.fogDensity)
        ? Math.min(0.1, Math.max(0.001, value.fogDensity)) : DEFAULT_SCENE_RENDER_SETTINGS.fogDensity,
      quality: value.quality === 'performance' || value.quality === 'high' || value.quality === 'balanced'
        ? value.quality : DEFAULT_SCENE_RENDER_SETTINGS.quality,
      showPerformanceStats: typeof value.showPerformanceStats === 'boolean' ? value.showPerformanceStats : false,
      environmentReflections: typeof value.environmentReflections === 'boolean' ? value.environmentReflections
        : value.studioLighting !== false && value.quality !== 'performance',
      reflectionIntensity: typeof value.reflectionIntensity === 'number' && Number.isFinite(value.reflectionIntensity)
        ? Math.min(2, Math.max(0, value.reflectionIntensity)) : DEFAULT_SCENE_RENDER_SETTINGS.reflectionIntensity,
    };
}

function readSettings(): SceneRenderSettings {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? normalizeSceneRenderSettings(JSON.parse(raw)) : DEFAULT_SCENE_RENDER_SETTINGS;
  } catch {
    return DEFAULT_SCENE_RENDER_SETTINGS;
  }
}

// One live preference store: the toolbar, scene and game views must update together.
let snapshot: SceneRenderSettings | undefined;
const listeners = new Set<() => void>();
const getSnapshot = () => snapshot ??= readSettings();
function onStorage(event: StorageEvent) {
  if (event.key !== storageKey && event.key !== null) return;
  snapshot = readSettings();
  listeners.forEach(listener => listener());
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    if (!listeners.size) window.removeEventListener('storage', onStorage);
  };
}
const setSettings: Dispatch<SetStateAction<SceneRenderSettings>> = value => {
  snapshot = normalizeSceneRenderSettings(typeof value === 'function' ? value(getSnapshot()) : value);
  try { localStorage.setItem(storageKey, JSON.stringify(snapshot)); } catch { /* Keep session preferences. */ }
  listeners.forEach(listener => listener());
};

export function useSceneRenderSettings() {
  return [useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT_SCENE_RENDER_SETTINGS), setSettings] as const;
}
