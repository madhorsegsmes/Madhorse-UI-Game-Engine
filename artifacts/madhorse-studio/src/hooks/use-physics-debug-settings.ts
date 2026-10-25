import { useSyncExternalStore, type Dispatch, type SetStateAction } from 'react';
import { DEFAULT_PHYSICS_DEBUG, normalizePhysicsDebug, type PhysicsDebugSettings } from '@/lib/physics-debug-shapes';
export const PHYSICS_DEBUG_KEY = 'madhorse-studio-physics-debug-v1';
let snapshot: PhysicsDebugSettings | undefined;
const listeners = new Set<() => void>();
function read() {
  try { return normalizePhysicsDebug(JSON.parse(localStorage.getItem(PHYSICS_DEBUG_KEY) ?? 'null')); }
  catch { return DEFAULT_PHYSICS_DEBUG; }
}
const getSnapshot = () => snapshot ??= read();
function onStorage(event: StorageEvent) {
  if (event.key !== PHYSICS_DEBUG_KEY && event.key !== null) return;
  snapshot = read(); listeners.forEach(listener => listener());
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) window.addEventListener('storage', onStorage);
  return () => { listeners.delete(listener); if (!listeners.size) window.removeEventListener('storage', onStorage); };
}
const setSettings: Dispatch<SetStateAction<PhysicsDebugSettings>> = value => {
  snapshot = normalizePhysicsDebug(typeof value === 'function' ? value(getSnapshot()) : value);
  try { localStorage.setItem(PHYSICS_DEBUG_KEY, JSON.stringify(snapshot)); } catch { /* Keep session-only preferences. */ }
  listeners.forEach(listener => listener());
};
export function usePhysicsDebugSettings() {
  return [useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT_PHYSICS_DEBUG), setSettings] as const;
}
