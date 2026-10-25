export type SceneTransformSettings = {
  space: 'auto' | 'world' | 'local';
  snap: boolean;
  moveStep: number;
  turnStep: number;
  scaleStep: number;
};
export const DEFAULT_TRANSFORM_SETTINGS: SceneTransformSettings = {
  space: 'auto', snap: false, moveStep: 1, turnStep: 15, scaleStep: .1,
};
export const TRANSFORM_STEP_LIMITS = {
  moveStep: [.01, 1000], turnStep: [.1, 180], scaleStep: [.01, 10],
} as const;
export function normalizeTransformSettings(input: unknown): SceneTransformSettings {
  const value = input && typeof input === 'object' ? input as Partial<SceneTransformSettings> : {};
  const step = (key: keyof typeof TRANSFORM_STEP_LIMITS) => {
    const number = value[key];
    return typeof number === 'number' && Number.isFinite(number)
      ? Math.min(TRANSFORM_STEP_LIMITS[key][1], Math.max(TRANSFORM_STEP_LIMITS[key][0], number))
      : DEFAULT_TRANSFORM_SETTINGS[key];
  };
  return {
    space: value.space === 'world' || value.space === 'local' ? value.space : 'auto',
    snap: value.snap === true,
    moveStep: step('moveStep'), turnStep: step('turnStep'), scaleStep: step('scaleStep'),
  };
}
export function transformGizmoOptions(settings: SceneTransformSettings, mode: 'translate' | 'rotate' | 'scale', camera: boolean) {
  // Three.js scaling always uses local object axes, including when World is selected.
  const space = mode === 'scale' ? 'local'
    : settings.space === 'auto' ? (camera && mode === 'translate' ? 'world' : 'local') : settings.space;
  return {
    space: space as 'world' | 'local',
    translationSnap: settings.snap ? settings.moveStep : null,
    rotationSnap: settings.snap ? settings.turnStep * Math.PI / 180 : null,
    scaleSnap: settings.snap ? settings.scaleStep : null,
  };
}
export function safeGizmoScale<T extends { x: number; y: number; z: number }>(value: T, fallback: T): T {
  return [value.x, value.y, value.z].every(number => Number.isFinite(number) && number > 0) ? value : fallback;
}
