export const playerActionNames = ['run', 'crouch', 'fight', 'shoot', 'race', 'craft', 'build'] as const;
export type PlayerActionName = typeof playerActionNames[number];
export type PlayerActionComponent = {
  id: string;
  type: 'playerAction';
  enabled: boolean;
  action: PlayerActionName;
  key: string;
  volume: number;
  clipAssetId: string | null;
  targetId: string | null;
  settings: Record<string, number>;
};

type ActionField = { name: string; label: string; default: number; min: number; max: number; integer?: boolean };
type ActionDefinition = { label: string; key: string; help: string; fields: ActionField[] };
export const actionKeyOptions = [
  'shift', 'control', 'c', 'f', 'j', 'r', 'k', 'b', 'e', 'q', 'g', 'h',
  'l', 'u', 'i', 'o', 'p', 'x', 'z', 't', 'v', 'n', 'm', '1', '2', '3', '4',
];
export const playerActionDefinitions: Record<PlayerActionName, ActionDefinition> = {
  run: {
    label: 'Running', key: 'shift', help: 'Hold Shift while walking to go faster. Includes running footsteps.',
    fields: [{ name: 'speedMultiplier', label: 'Speed boost', default: 2, min: 1, max: 5 }],
  },
  crouch: {
    label: 'Crouching', key: 'c', help: 'Hold C to become shorter and move slowly. Let go to stand.',
    fields: [
      { name: 'speedMultiplier', label: 'Crouch walking speed', default: 0.45, min: 0.1, max: 1 },
      { name: 'heightMultiplier', label: 'Crouch height', default: 0.55, min: 0.2, max: 0.9 },
    ],
  },
  fight: {
    label: 'Fighting', key: 'f', help: 'Press F to hit a nearby object. Practice targets start with 100 health; defeated targets hide only during Play Test.',
    fields: [
      { name: 'damage', label: 'Hit strength', default: 25, min: 1, max: 100 },
      { name: 'reach', label: 'Reach (meters)', default: 2.5, min: 0.5, max: 10 },
      { name: 'cooldown', label: 'Time between hits (seconds)', default: 0.4, min: 0.1, max: 5 },
    ],
  },
  shoot: {
    label: 'Shooting', key: 'j', help: 'Press J to fire in the direction you last moved. Choose a target below to aim at it instead.',
    fields: [
      { name: 'damage', label: 'Shot strength', default: 20, min: 1, max: 100 },
      { name: 'range', label: 'Shot distance (meters)', default: 30, min: 1, max: 100 },
      { name: 'cooldown', label: 'Time between shots (seconds)', default: 0.25, min: 0.1, max: 5 },
    ],
  },
  race: {
    label: 'Racing', key: 'r', help: 'Press R to switch driving on or off. W accelerates, S brakes or reverses, and A/D steer. This is simple arcade driving, not wheel physics.',
    fields: [
      { name: 'maxSpeed', label: 'Top speed (meters/second)', default: 18, min: 1, max: 60 },
      { name: 'acceleration', label: 'Acceleration', default: 8, min: 1, max: 30 },
      { name: 'turnSpeed', label: 'Steering speed (degrees/second)', default: 100, min: 10, max: 240 },
    ],
  },
  craft: {
    label: 'Crafting', key: 'k', help: 'Press K to turn wood into planks. The inventory is shared with Building and resets when Play Test stops.',
    fields: [
      { name: 'startingWood', label: 'Starting wood', default: 10, min: 0, max: 999, integer: true },
      { name: 'woodCost', label: 'Wood used per craft', default: 2, min: 1, max: 99, integer: true },
      { name: 'planksMade', label: 'Planks made per craft', default: 4, min: 1, max: 99, integer: true },
      { name: 'cooldown', label: 'Time between crafts (seconds)', default: 0.3, min: 0.1, max: 5 },
    ],
  },
  build: {
    label: 'Building', key: 'b', help: 'Press B to place a block in front of you, using planks. Move before placing another. Test buildings are temporary.',
    fields: [
      { name: 'startingPlanks', label: 'Starting planks', default: 3, min: 0, max: 999, integer: true },
      { name: 'plankCost', label: 'Planks used per block', default: 1, min: 1, max: 99, integer: true },
      { name: 'distance', label: 'Place in front (meters)', default: 2, min: 1, max: 10 },
      { name: 'blockSize', label: 'Block size (meters)', default: 1, min: 0.25, max: 5 },
      { name: 'cooldown', label: 'Time between builds (seconds)', default: 0.3, min: 0.1, max: 5 },
    ],
  },
};

export function createPlayerAction(action: PlayerActionName): PlayerActionComponent {
  const definition = playerActionDefinitions[action];
  return {
    id: crypto.randomUUID(), type: 'playerAction', enabled: true, action,
    key: definition.key, volume: 0.25, clipAssetId: null, targetId: null,
    settings: Object.fromEntries(definition.fields.map(field => [field.name, field.default])),
  };
}

export function isPlayerActionComponent(value: unknown): value is PlayerActionComponent {
  if (!value || typeof value !== 'object') return false;
  const item = value as PlayerActionComponent;
  if (item.type !== 'playerAction' || typeof item.id !== 'string' ||
      !playerActionNames.includes(item.action) || typeof item.enabled !== 'boolean' ||
      !actionKeyOptions.includes(item.key) || !Number.isFinite(item.volume) || item.volume < 0 || item.volume > 1 ||
      !(item.clipAssetId === null || typeof item.clipAssetId === 'string') ||
      !(item.targetId === null || typeof item.targetId === 'string') ||
      !item.settings || typeof item.settings !== 'object' || Array.isArray(item.settings)) return false;
  const fields = playerActionDefinitions[item.action].fields;
  return Object.keys(item.settings).length === fields.length && fields.every(field => {
    const value = item.settings[field.name];
    return Number.isFinite(value) && value >= field.min && value <= field.max && (!field.integer || Number.isInteger(value));
  });
}

export const playerActionPrefix = (id: string) => `action.${id}.`;

export function playerActionDraft(component: PlayerActionComponent): Record<string, string> {
  const prefix = playerActionPrefix(component.id);
  return Object.fromEntries([
    [`${prefix}enabled`, String(component.enabled)], [`${prefix}key`, component.key],
    [`${prefix}volume`, String(component.volume)], [`${prefix}clipAssetId`, component.clipAssetId ?? ''],
    [`${prefix}targetId`, component.targetId ?? ''],
    ...Object.entries(component.settings).map(([key, value]) => [`${prefix}${key}`, String(value)]),
  ]);
}

export function playerActionFromDraft(component: PlayerActionComponent, values: Record<string, string>): PlayerActionComponent {
  const prefix = playerActionPrefix(component.id);
  return {
    ...component, enabled: values[`${prefix}enabled`] === 'true', key: values[`${prefix}key`],
    volume: Number(values[`${prefix}volume`]), clipAssetId: values[`${prefix}clipAssetId`] || null,
    targetId: values[`${prefix}targetId`] || null,
    settings: Object.fromEntries(playerActionDefinitions[component.action].fields.map(field =>
      [field.name, Number(values[`${prefix}${field.name}`])],
    )),
  };
}
