import type { ProjectAsset } from './scene-model';

export const pbrMapSlots = [
  'baseColor', 'normal', 'roughness', 'metalness', 'ambientOcclusion', 'emissive',
] as const;
export type PbrMapSlot = typeof pbrMapSlots[number];
export type PbrTextureMaps = Record<PbrMapSlot, string | null>;

export type PbrMaterialDefinition = {
  schemaVersion: 1;
  baseColor: string;
  roughness: number;
  metalness: number;
  opacity: number;
  normalScale: number;
  ambientOcclusionIntensity: number;
  emissiveColor: string;
  emissiveIntensity: number;
  maps: PbrTextureMaps;
};

export function createPbrMaterialDefinition(): PbrMaterialDefinition {
  return {
    schemaVersion: 1,
    baseColor: '#ffffff',
    roughness: .65,
    metalness: 0,
    opacity: 1,
    normalScale: 1,
    ambientOcclusionIntensity: 1,
    emissiveColor: '#000000',
    emissiveIntensity: 0,
    maps: {
      baseColor: null,
      normal: null,
      roughness: null,
      metalness: null,
      ambientOcclusion: null,
      emissive: null,
    },
  };
}

const slots = new Set<string>(pbrMapSlots);
const hexColor = (value: unknown): value is string => typeof value === 'string' && /^#[\da-f]{6}$/i.test(value);
const inRange = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;

export function isPbrMaterialDefinition(value: unknown): value is PbrMaterialDefinition {
  if (!value || typeof value !== 'object') return false;
  const material = value as PbrMaterialDefinition;
  if (material.schemaVersion !== 1 ||
      !hexColor(material.baseColor) || !inRange(material.roughness, 0, 1) ||
      !inRange(material.metalness, 0, 1) || !inRange(material.opacity, .05, 1) ||
      !inRange(material.normalScale, 0, 4) ||
      !inRange(material.ambientOcclusionIntensity, 0, 2) ||
      !hexColor(material.emissiveColor) || !inRange(material.emissiveIntensity, 0, 10) ||
      !material.maps || typeof material.maps !== 'object' ||
      Object.keys(material.maps).length !== pbrMapSlots.length) return false;
  return pbrMapSlots.every(slot => slots.has(slot) &&
    Object.prototype.hasOwnProperty.call(material.maps, slot) &&
    (material.maps[slot] === null || typeof material.maps[slot] === 'string'));
}

export function createPbrMaterialAsset(name = 'New PBR Material'): ProjectAsset {
  const material = createPbrMaterialDefinition();
  return {
    id: crypto.randomUUID(),
    name,
    kind: 'pbr-material',
    mimeType: 'application/x-madhorse-pbr-material+json',
    size: JSON.stringify(material).length,
    addedAt: new Date().toISOString(),
    pbrMaterial: material,
  };
}

export function pbrTextureSlotForFilename(filename: string): PbrMapSlot[] {
  const normalized = filename.toLowerCase().replace(/\.[^.]+$/, '').replace(/[^a-z0-9]/g, '');
  if (/normal|nrm/.test(normalized)) return ['normal'];
  if (/orm|metalrough|metallic.*roughness|roughness.*metallic/.test(normalized)) {
    return ['ambientOcclusion', 'roughness', 'metalness'];
  }
  if (/basecolor|albedo|diffuse|color/.test(normalized)) return ['baseColor'];
  if (/roughness|^rough|^rgh/.test(normalized)) return ['roughness'];
  if (/metallic|metalness|^metal|^met/.test(normalized)) return ['metalness'];
  if (/ambientocclusion|occlusion|^ao/.test(normalized)) return ['ambientOcclusion'];
  if (/emissive|emission|^emit/.test(normalized)) return ['emissive'];
  return [];
}

export function createPbrMaterialExchange(
  name: string,
  material: PbrMaterialDefinition,
  assets: ProjectAsset[],
) {
  const maps = Object.fromEntries(pbrMapSlots.map(slot => {
    const id = material.maps[slot];
    return [slot, id ? assets.find(asset => asset.id === id)?.name ?? null : null];
  })) as Record<PbrMapSlot, string | null>;
  return { format: 'madhorse-pbr-material', version: 1, name, material: { ...material, maps } };
}

export function parsePbrMaterialExchange(value: unknown) {
  if (!value || typeof value !== 'object') throw new Error('This is not a Madhorse PBR material file.');
  const exchange = value as { format?: unknown; version?: unknown; name?: unknown; material?: unknown };
  if (exchange.format !== 'madhorse-pbr-material' || exchange.version !== 1 ||
      typeof exchange.name !== 'string' || !exchange.material || typeof exchange.material !== 'object') {
    throw new Error('Choose a Madhorse PBR material JSON export.');
  }
  const material = exchange.material as PbrMaterialDefinition;
  if (!isPbrMaterialDefinition(material)) throw new Error('The PBR values are invalid or outside their supported ranges.');
  return { name: exchange.name.slice(0, 100), material };
}
