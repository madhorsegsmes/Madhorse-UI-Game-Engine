export const pbrSurfacePresets = [
  { id: 'bare-metal', label: 'Bare metal', roughness: 0.2, metalness: 1, opacity: 1 },
  { id: 'brushed-metal', label: 'Brushed metal', roughness: 0.42, metalness: 0.85, opacity: 1 },
  { id: 'painted-surface', label: 'Painted surface', roughness: 0.38, metalness: 0.05, opacity: 1 },
  { id: 'plastic', label: 'Plastic', roughness: 0.46, metalness: 0, opacity: 1 },
  { id: 'rubber', label: 'Rubber', roughness: 0.88, metalness: 0, opacity: 1 },
  { id: 'wood', label: 'Wood', roughness: 0.78, metalness: 0, opacity: 1 },
  { id: 'stone', label: 'Stone', roughness: 0.9, metalness: 0, opacity: 1 },
  { id: 'fabric', label: 'Fabric', roughness: 0.96, metalness: 0, opacity: 1 },
  { id: 'glass', label: 'Glass', roughness: 0.08, metalness: 0, opacity: 0.25 },
] as const;

export type PbrSurfacePresetId = typeof pbrSurfacePresets[number]['id'];

export function getPbrSurfacePreset(id: string) {
  return pbrSurfacePresets.find(preset => preset.id === id);
}

export function matchPbrSurfacePreset(
  roughness: number,
  metalness: number,
  opacity: number,
): PbrSurfacePresetId | 'custom' {
  return pbrSurfacePresets.find(preset =>
    Math.abs(preset.roughness - roughness) < 0.01 &&
    Math.abs(preset.metalness - metalness) < 0.01 &&
    Math.abs(preset.opacity - opacity) < 0.01,
  )?.id ?? 'custom';
}
