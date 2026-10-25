import { useSyncExternalStore, type Dispatch, type SetStateAction } from 'react';
import { DEFAULT_TRANSFORM_SETTINGS, normalizeTransformSettings, type SceneTransformSettings } from '@/lib/scene-transform-settings';
export const TRANSFORM_SETTINGS_KEY = 'madhorse-studio-transform-settings-v1';
let snapshot: SceneTransformSettings | undefined;
const listeners = new Set<() => void>();
function read() {
  try { return normalizeTransformSettings(JSON.parse(localStorage.getItem(TRANSFORM_SETTINGS_KEY) ?? 'null')); }
  catch { return DEFAULT_TRANSFORM_SETTINGS; }
}
const getSnapshot = () => snapshot ??= read();
const emit = () => listeners.forEach(listener => listener());
function onStorage(event: StorageEvent) {
  if (event.key !== TRANSFORM_SETTINGS_KEY && event.key !== null) return;
  snapshot = read(); emit();
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    if (!listeners.size) window.removeEventListener('storage', onStorage);
  };
}
const setSettings: Dispatch<SetStateAction<SceneTransformSettings>> = value => {
  snapshot = normalizeTransformSettings(typeof value === 'function' ? value(getSnapshot()) : value);
  try { localStorage.setItem(TRANSFORM_SETTINGS_KEY, JSON.stringify(snapshot)); } catch { /* Session-only when storage is blocked. */ }
  emit();
};
export function useSceneTransformSettings() {
  return [useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT_TRANSFORM_SETTINGS), setSettings] as const;
}
