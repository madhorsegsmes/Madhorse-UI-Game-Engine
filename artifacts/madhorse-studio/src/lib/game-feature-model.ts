import { actionKeyOptions } from './player-action-model';

export const gameFeatureNames = [
  'health', 'inventory', 'interact', 'pickup', 'door', 'checkpoint',
  'status-bar', 'message', 'visual-effect',
] as const;
export type GameFeatureName = typeof gameFeatureNames[number];
export type GameFeatureField = {
  name: string; label: string;
  type: 'number' | 'boolean' | 'select' | 'text' | 'color';
  default: number | boolean | string;
  min?: number; max?: number; integer?: boolean; options?: { value: string; label: string }[];
};
export type GameFeatureDefinition = {
  label: string; help: string; fields: GameFeatureField[]; audio?: boolean;
};
export type GameFeatureComponent = {
  id: string; type: 'gameFeature'; enabled: boolean; kind: GameFeatureName;
  settings: Record<string, number | boolean | string>;
  clipAssetId?: string | null; volume?: number;
};
export const gameFeatureDefinitions: Record<GameFeatureName, GameFeatureDefinition> = {
  health: {
    label: 'Health & Damage', help: 'Give this player or practice target a health amount. Set contact damage on an NPC to make it hurt a nearby player.',
    fields: [
      { name: 'maxHealth', label: 'Max health', type: 'number', default: 100, min: 1, max: 10000, integer: true },
      { name: 'startingHealth', label: 'Starting health', type: 'number', default: 100, min: 0, max: 10000, integer: true },
      { name: 'contactDamage', label: 'Damage when touching player (NPC)', type: 'number', default: 0, min: 0, max: 1000, integer: true },
      { name: 'regeneration', label: 'Health restored each second', type: 'number', default: 0, min: 0, max: 100, integer: false },
    ],
  },
  inventory: {
    label: 'Inventory', help: 'Set the player’s starting items. Pickups, crafting, and building use these amounts during Play Test.',
    fields: [
      { name: 'startingWood', label: 'Starting wood', type: 'number', default: 10, min: 0, max: 999, integer: true },
      { name: 'startingPlanks', label: 'Starting planks', type: 'number', default: 3, min: 0, max: 999, integer: true },
      { name: 'startingCoins', label: 'Starting coins', type: 'number', default: 0, min: 0, max: 999, integer: true },
      { name: 'startingKeys', label: 'Starting keys', type: 'number', default: 0, min: 0, max: 99, integer: true },
    ],
  },
  interact: {
    label: 'Interact', help: 'Walk near a pickup, door, checkpoint, sign, or effect and press the key to use it.',
    fields: [
      { name: 'key', label: 'Use key', type: 'select', default: 'e', options: actionKeyOptions.filter(key => !['shift', 'control'].includes(key)).map(key => ({ value: key, label: key.toUpperCase() })) },
      { name: 'range', label: 'Reach (meters)', type: 'number', default: 3, min: 0.5, max: 15 },
    ],
    audio: true,
  },
  pickup: {
    label: 'Pickup', help: 'When a player uses Interact nearby, this item is added to their test inventory.',
    fields: [
      { name: 'item', label: 'Item', type: 'select', default: 'coins', options: [
        { value: 'wood', label: 'Wood' }, { value: 'planks', label: 'Planks' },
        { value: 'coins', label: 'Coins' }, { value: 'keys', label: 'Key' }, { value: 'health', label: 'Health' },
      ] },
      { name: 'amount', label: 'Amount', type: 'number', default: 1, min: 1, max: 999, integer: true },
    ],
    audio: true,
  },
  door: {
    label: 'Door', help: 'Press your Interact key nearby to open or close this door. Optional locks spend one key to open.',
    fields: [
      { name: 'startsOpen', label: 'Starts open', type: 'boolean', default: false },
      { name: 'locked', label: 'Needs one key', type: 'boolean', default: false },
    ],
    audio: true,
  },
  checkpoint: {
    label: 'Checkpoint', help: 'Press Interact nearby to save this test’s respawn spot. Respawning restores the player’s health.',
    fields: [{ name: 'restoreHealth', label: 'Restore health on respawn', type: 'boolean', default: true }],
    audio: true,
  },
  'status-bar': {
    label: 'Health & Item Display', help: 'Show the player’s health and carried items during Play Test.',
    fields: [
      { name: 'showHealth', label: 'Show health bar', type: 'boolean', default: true },
      { name: 'showInventory', label: 'Show item counts', type: 'boolean', default: true },
    ],
  },
  message: {
    label: 'Message Sign', help: 'Press Interact nearby to show this note during Play Test.',
    fields: [{ name: 'text', label: 'Message', type: 'text', default: 'Welcome!', min: 1, max: 180 }],
    audio: true,
  },
  'visual-effect': {
    label: 'Sparkle Effect', help: 'Press Interact nearby to pop a short burst of sparkles around this object.',
    fields: [
      { name: 'color', label: 'Sparkle color', type: 'color', default: '#e7a7ff' },
      { name: 'size', label: 'Sparkle size', type: 'number', default: 0.5, min: 0.1, max: 3 },
    ],
    audio: true,
  },
};
export function createGameFeature(kind: GameFeatureName): GameFeatureComponent {
  return {
    id: crypto.randomUUID(), type: 'gameFeature', enabled: true, kind,
    settings: Object.fromEntries(gameFeatureDefinitions[kind].fields.map(field => [field.name, field.default])),
    ...(gameFeatureDefinitions[kind].audio ? { clipAssetId: null, volume: 0.25 } : {}),
  };
}
export function isGameFeatureComponent(value: unknown): value is GameFeatureComponent {
  if (!value || typeof value !== 'object') return false;
  const item = value as GameFeatureComponent;
  if (item.type !== 'gameFeature' || typeof item.id !== 'string' || typeof item.enabled !== 'boolean' ||
      !gameFeatureNames.includes(item.kind) || !item.settings || typeof item.settings !== 'object' ||
      Array.isArray(item.settings)) return false;
  const fields = gameFeatureDefinitions[item.kind].fields;
  if (Object.keys(item.settings).length !== fields.length) return false;
  const validFields = fields.every(field => {
    const value = item.settings[field.name];
    if (field.type === 'number') return typeof value === 'number' && Number.isFinite(value) &&
      value >= field.min! && value <= field.max! && (!field.integer || Number.isInteger(value));
    if (field.type === 'boolean') return typeof value === 'boolean';
    if (field.type === 'select') return typeof value === 'string' && field.options?.some(option => option.value === value);
    if (field.type === 'color') return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
    return typeof value === 'string' && value.length >= field.min! && value.length <= field.max!;
  });
  if (!validFields) return false;
  if (item.kind === 'health' && Number(item.settings.startingHealth) > Number(item.settings.maxHealth)) return false;
  return gameFeatureDefinitions[item.kind].audio
    ? (item.clipAssetId === null || typeof item.clipAssetId === 'string') &&
      Number.isFinite(item.volume) && item.volume! >= 0 && item.volume! <= 1
    : item.clipAssetId === undefined && item.volume === undefined;
}
export const gameFeaturePrefix = (id: string) => `feature.${id}.`;
export function gameFeatureDraft(component: GameFeatureComponent): Record<string, string> {
  const prefix = gameFeaturePrefix(component.id);
  return {
    [`${prefix}enabled`]: String(component.enabled),
    ...Object.fromEntries(Object.entries(component.settings).map(([key, value]) => [`${prefix}${key}`, String(value)])),
    ...(gameFeatureDefinitions[component.kind].audio ? {
      [`${prefix}audioClipAssetId`]: component.clipAssetId ?? '',
      [`${prefix}audioVolume`]: String(component.volume ?? 0.25),
    } : {}),
  };
}
export function gameFeatureFromDraft(component: GameFeatureComponent, values: Record<string, string>): GameFeatureComponent {
  const prefix = gameFeaturePrefix(component.id);
  const audio = gameFeatureDefinitions[component.kind].audio ? {
    audioClipAssetId: values[`${prefix}audioClipAssetId`] || '',
    audioVolume: Number(values[`${prefix}audioVolume`]),
  } : {};
  return {
    ...component,
    enabled: values[`${prefix}enabled`] === 'true',
    settings: Object.fromEntries(gameFeatureDefinitions[component.kind].fields.map(field => [
        field.name,
        field.type === 'number' ? Number(values[`${prefix}${field.name}`]) :
          field.type === 'boolean' ? values[`${prefix}${field.name}`] === 'true' : values[`${prefix}${field.name}`],
      ])),
    ...(gameFeatureDefinitions[component.kind].audio ? {
      clipAssetId: String(audio.audioClipAssetId ?? '') || null,
      volume: Number(audio.audioVolume),
    } : {}),
  };
}
