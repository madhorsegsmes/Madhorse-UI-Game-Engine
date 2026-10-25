import { gameProjectStyleOptions } from './game-type-library';

export type GameDimension = '2d' | '3d';
export type GameStyleId = (typeof gameProjectStyleOptions)[number]['id'];
export type GameProjectSetup = {
  dimension: GameDimension;
  gameStyles: GameStyleId[];
};

export type NewProjectStarter =
  | '2d-fighting' | 'rts' | 'fps' | 'third-person-shooter' | 'mmorpg'
  | '2d-rpg' | 'cart-racer' | 'card-duel' | 'basketball' | 'rpg' | 'puzzle' | 'blank';

const validStyleIds = new Set<string>(gameProjectStyleOptions.map(({ id }) => id));

export function isGameProjectSetup(value: unknown): value is GameProjectSetup {
  if (!value || typeof value !== 'object') return false;
  const setup = value as Partial<GameProjectSetup>;
  return (setup.dimension === '2d' || setup.dimension === '3d') &&
    Array.isArray(setup.gameStyles) &&
    setup.gameStyles.length <= gameProjectStyleOptions.length &&
    setup.gameStyles.every(style => typeof style === 'string' && validStyleIds.has(style)) &&
    new Set(setup.gameStyles).size === setup.gameStyles.length;
}

export function gameStyleLabels(styleIds: readonly string[]) {
  const labels = new Map<string, string>(gameProjectStyleOptions.map(({ id, label }) => [id, label]));
  return styleIds.flatMap(id => labels.has(id) ? [labels.get(id)!] : []);
}

export function defaultGameProjectSetup(
  template: NewProjectStarter | null,
): GameProjectSetup {
  const presets: Record<NewProjectStarter, GameProjectSetup> = {
    '2d-fighting': { dimension: '3d', gameStyles: ['fighting-games'] },
    rts: { dimension: '3d', gameStyles: ['real-time-strategy-rts'] },
    fps: { dimension: '3d', gameStyles: ['shooter-games'] },
    'third-person-shooter': { dimension: '3d', gameStyles: ['shooter-games'] },
    mmorpg: { dimension: '3d', gameStyles: ['mmo-and-mmorpg', 'role-playing-games-rpgs'] },
    '2d-rpg': { dimension: '2d', gameStyles: ['role-playing-games-rpgs'] },
    'cart-racer': { dimension: '3d', gameStyles: ['racing-and-vehicle-games'] },
    'card-duel': { dimension: '3d', gameStyles: ['card-and-deckbuilding-games'] },
    basketball: { dimension: '3d', gameStyles: ['sports-games'] },
    rpg: { dimension: '3d', gameStyles: ['role-playing-games-rpgs'] },
    puzzle: { dimension: '3d', gameStyles: ['puzzle-games'] },
    blank: { dimension: '3d', gameStyles: ['custom-game'] },
  };
  return template ? { ...presets[template], gameStyles: [...presets[template].gameStyles] }
    : { dimension: '3d', gameStyles: [] };
}

const starterByStyle: Partial<Record<GameStyleId, Partial<Record<GameDimension, NewProjectStarter>>>> = {
  'action-combat-and-beat-em-up': { '3d': '2d-fighting' },
  'action-adventure-and-exploration': { '3d': 'mmorpg' },
  'role-playing-games-rpgs': { '2d': '2d-rpg', '3d': 'rpg' },
  'roguelike-and-roguelite': { '3d': 'rpg' },
  'fighting-games': { '3d': '2d-fighting' },
  'shooter-games': { '3d': 'fps' },
  'racing-and-vehicle-games': { '3d': 'cart-racer' },
  'sports-games': { '3d': 'basketball' },
  'real-time-strategy-rts': { '3d': 'rts' },
  'turn-based-strategy-tactics-and-4x': { '3d': 'rts' },
  'multiplayer-online-battle-arena-moba': { '3d': 'rts' },
  'card-and-deckbuilding-games': { '2d': 'card-duel', '3d': 'card-duel' },
  'puzzle-games': { '3d': 'puzzle' },
  'survival-and-crafting': { '3d': 'mmorpg' },
  'open-world-and-sandbox-games': { '3d': 'mmorpg' },
  'horror-and-stealth': { '3d': 'fps' },
  'battle-royale': { '3d': 'third-person-shooter' },
  'mmo-and-mmorpg': { '3d': 'mmorpg' },
  'narrative-visual-novel-and-interactive-fiction': { '3d': 'mmorpg' },
  'tycoon-idle-and-incremental-games': { '3d': 'rts' },
};

const starterStyles: Partial<Record<NewProjectStarter, GameStyleId[]>> = {
  '2d-fighting': ['fighting-games', 'action-combat-and-beat-em-up'],
  rts: ['real-time-strategy-rts'],
  fps: ['shooter-games', 'horror-and-stealth'],
  'third-person-shooter': ['shooter-games', 'battle-royale'],
  mmorpg: ['mmo-and-mmorpg', 'role-playing-games-rpgs', 'survival-and-crafting', 'open-world-and-sandbox-games'],
  '2d-rpg': ['role-playing-games-rpgs'],
  'cart-racer': ['racing-and-vehicle-games'],
  'card-duel': ['card-and-deckbuilding-games'],
  basketball: ['sports-games'],
  rpg: ['role-playing-games-rpgs'],
  puzzle: ['puzzle-games'],
  blank: ['custom-game'],
};

export function resolveProjectStarter(
  setup: GameProjectSetup,
  preferredTemplate: NewProjectStarter | null = null,
): NewProjectStarter {
  if (!isGameProjectSetup(setup) || setup.gameStyles.length === 0) {
    throw new Error('Choose at least one game style.');
  }
  if (preferredTemplate && starterStyles[preferredTemplate]?.some(style =>
    setup.gameStyles.includes(style)) &&
    (preferredTemplate !== '2d-rpg' || setup.dimension === '2d') &&
    (preferredTemplate !== '2d-fighting' || setup.dimension === '3d')) {
    return preferredTemplate;
  }
  for (const style of setup.gameStyles) {
    const match = starterByStyle[style]?.[setup.dimension];
    if (match) return match;
  }
  return 'blank';
}
