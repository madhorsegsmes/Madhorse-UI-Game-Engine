import { useSyncExternalStore, type Dispatch, type SetStateAction } from 'react';

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
  snapshot = typeof value === 'function' ? value(getSnapshot()) : value;
  try { localStorage.setItem(storageKey, JSON.stringify(snapshot)); } catch { /* Keep session preferences. */ }
  listeners.forEach(listener => listener());
};

export function useSceneRenderSettings() {
  return [useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT_SCENE_RENDER_SETTINGS), setSettings] as const;
}
