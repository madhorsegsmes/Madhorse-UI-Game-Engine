export type ModelLodSettings = {
  enabled: boolean;
  mediumScreenPercent: number;
  lowScreenPercent: number;
};
export const DEFAULT_MODEL_LOD: ModelLodSettings = {
  enabled: true, mediumScreenPercent: 15, lowScreenPercent: 5,
};
export function isModelLodSettings(value: unknown): value is ModelLodSettings {
  if (!value || typeof value !== 'object') return false;
  const settings = value as ModelLodSettings;
  return typeof settings.enabled === 'boolean' &&
    Number.isFinite(settings.mediumScreenPercent) && settings.mediumScreenPercent >= 1 && settings.mediumScreenPercent <= 100 &&
    Number.isFinite(settings.lowScreenPercent) && settings.lowScreenPercent >= .1 &&
    settings.lowScreenPercent < settings.mediumScreenPercent;
}
export function chooseModelLod(coverage: number, current: number, settings: ModelLodSettings): number {
  const near = settings.mediumScreenPercent / 100, far = settings.lowScreenPercent / 100;
  if (!Number.isFinite(coverage)) return 0;
  // A 10% dead band prevents detail levels oscillating around a threshold.
  if (current === 0 && coverage >= near * .9) return 0;
  if (current === 2 && coverage <= far * 1.1) return 2;
  if (current === 1 && coverage <= near * 1.1 && coverage >= far * .9) return 1;
  return coverage >= near ? 0 : coverage >= far ? 1 : 2;
}
