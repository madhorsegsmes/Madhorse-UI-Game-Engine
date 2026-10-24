import { createUIControlElement, type UIControlElement, type UIControlType } from './ui-controls';
import type { PlayerActionName } from './player-action-model';

export const egoGameTypes = [
  { value: 'rpg', label: 'RPG' },
  { value: 'racing', label: 'Racing' },
  { value: 'sports', label: 'Sports' },
  { value: 'fighting', label: 'Fighting' },
  { value: 'rts', label: 'RTS' },
  { value: 'card', label: 'Card game' },
  { value: 'mmo', label: 'MMO' },
  { value: 'shooter', label: 'Shooter' },
  { value: 'platformer', label: 'Platformer' },
] as const;

export type EgoGameType = typeof egoGameTypes[number]['value'];
type UiSeed = {
  type: UIControlType;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
};

const UI_SEEDS: Record<EgoGameType, UiSeed[]> = {
  rpg: [
    { type: 'health-bar', label: 'Player Health', x: 3, y: 4, width: 210, height: 38, color: '#c9433c' },
    { type: 'text', label: 'Level 1 · Adventurer', x: 3, y: 10, width: 190, height: 30, color: '#f0e9e2' },
    { type: 'panel', label: 'Quest Tracker', x: 3, y: 68, width: 235, height: 110, color: '#29272a' },
    { type: 'button', label: 'Inventory', x: 80, y: 68, width: 130, height: 40, color: '#bd4037' },
    { type: 'button', label: 'Skills', x: 80, y: 78, width: 130, height: 40, color: '#7d3e91' },
    { type: 'button', label: 'Map', x: 80, y: 88, width: 130, height: 40, color: '#48415b' },
  ],
  racing: [
    { type: 'text', label: 'SPEED 000', x: 4, y: 78, width: 190, height: 54, color: '#f0e9e2' },
    { type: 'text', label: 'LAP 1 / 3', x: 4, y: 5, width: 150, height: 34, color: '#f0e9e2' },
    { type: 'panel', label: 'Position 1 / 8', x: 80, y: 4, width: 180, height: 56, color: '#29272a' },
    { type: 'health-bar', label: 'BOOST', x: 4, y: 86, width: 190, height: 36, color: '#bd4037' },
    { type: 'button', label: 'Pause Race', x: 84, y: 88, width: 130, height: 42, color: '#48415b' },
  ],
  sports: [
    { type: 'panel', label: 'Match Score', x: 36, y: 3, width: 260, height: 74, color: '#29272a' },
    { type: 'text', label: 'HOME  0  —  0  AWAY', x: 38, y: 5, width: 240, height: 34, color: '#f0e9e2' },
    { type: 'text', label: 'PERIOD 1 · 10:00', x: 42, y: 10, width: 200, height: 28, color: '#f0e9e2' },
    { type: 'health-bar', label: 'Stamina', x: 3, y: 88, width: 190, height: 36, color: '#55a878' },
    { type: 'button', label: 'Pause Match', x: 84, y: 88, width: 136, height: 42, color: '#bd4037' },
  ],
  fighting: [
    { type: 'health-bar', label: 'PLAYER', x: 3, y: 4, width: 250, height: 42, color: '#c9433c' },
    { type: 'health-bar', label: 'RIVAL', x: 75, y: 4, width: 250, height: 42, color: '#c9433c' },
    { type: 'text', label: 'ROUND 1 · 99', x: 44, y: 5, width: 160, height: 34, color: '#f0e9e2' },
    { type: 'button', label: 'Block', x: 74, y: 84, width: 112, height: 42, color: '#48415b' },
    { type: 'button', label: 'Special', x: 84, y: 84, width: 130, height: 42, color: '#7d3e91' },
  ],
  rts: [
    { type: 'panel', label: 'Resources', x: 2, y: 3, width: 260, height: 60, color: '#29272a' },
    { type: 'text', label: 'WOOD  250    STONE  120', x: 4, y: 5, width: 245, height: 30, color: '#f0e9e2' },
    { type: 'panel', label: 'Selected Unit', x: 2, y: 78, width: 235, height: 100, color: '#29272a' },
    { type: 'button', label: 'Build', x: 80, y: 82, width: 120, height: 40, color: '#bd4037' },
    { type: 'button', label: 'Gather', x: 80, y: 91, width: 120, height: 40, color: '#526b42' },
  ],
  card: [
    { type: 'panel', label: 'Your Hand', x: 26, y: 75, width: 430, height: 165, color: '#29272a' },
    { type: 'text', label: 'ENERGY 3 / 3', x: 3, y: 4, width: 180, height: 34, color: '#f0e9e2' },
    { type: 'text', label: 'CARDS 12', x: 81, y: 4, width: 145, height: 34, color: '#f0e9e2' },
    { type: 'button', label: 'Draw Card', x: 3, y: 87, width: 120, height: 42, color: '#bd4037' },
    { type: 'button', label: 'Play Card', x: 81, y: 87, width: 120, height: 42, color: '#7d3e91' },
    { type: 'button', label: 'End Turn', x: 88, y: 87, width: 112, height: 42, color: '#48415b' },
  ],
  mmo: [
    { type: 'health-bar', label: 'Health', x: 3, y: 4, width: 210, height: 36, color: '#c9433c' },
    { type: 'health-bar', label: 'Mana', x: 3, y: 10, width: 210, height: 36, color: '#437bc9' },
    { type: 'panel', label: 'Active Quest', x: 3, y: 68, width: 245, height: 108, color: '#29272a' },
    { type: 'panel', label: 'Party', x: 82, y: 4, width: 195, height: 80, color: '#29272a' },
    { type: 'button', label: 'Inventory', x: 84, y: 86, width: 130, height: 42, color: '#bd4037' },
  ],
  shooter: [
    { type: 'health-bar', label: 'Health', x: 3, y: 87, width: 190, height: 36, color: '#c9433c' },
    { type: 'text', label: 'AMMO 30 / 90', x: 82, y: 87, width: 170, height: 38, color: '#f0e9e2' },
    { type: 'text', label: '+', x: 49, y: 48, width: 28, height: 28, color: '#f0e9e2' },
    { type: 'button', label: 'Reload', x: 84, y: 94, width: 112, height: 40, color: '#48415b' },
    { type: 'button', label: 'Pause', x: 90, y: 4, width: 110, height: 40, color: '#bd4037' },
  ],
  platformer: [
    { type: 'health-bar', label: 'Health', x: 3, y: 4, width: 190, height: 36, color: '#c9433c' },
    { type: 'text', label: 'LIVES 3', x: 82, y: 4, width: 130, height: 32, color: '#f0e9e2' },
    { type: 'text', label: 'COINS 000', x: 82, y: 10, width: 150, height: 32, color: '#f0e9e2' },
    { type: 'button', label: 'Jump', x: 84, y: 86, width: 112, height: 48, color: '#bd4037' },
    { type: 'button', label: 'Pause', x: 90, y: 4, width: 110, height: 40, color: '#48415b' },
  ],
};

export const egoPlayerActions: Record<EgoGameType, PlayerActionName[]> = {
  rpg: ['fight', 'cast', 'heal'],
  racing: ['race', 'run'],
  sports: ['run'],
  fighting: ['fight', 'block'],
  rts: ['command', 'gather', 'build'],
  card: ['draw-card', 'play-card', 'end-turn'],
  mmo: ['fight', 'cast', 'heal', 'follow'],
  shooter: ['shoot', 'reload', 'crouch'],
  platformer: ['run', 'crouch', 'fight'],
};

export function createEgoUiKit(gameTypes: EgoGameType[], existingCount: number, gameVision = ''): UIControlElement[] {
  const selectedTypes = [...new Set(gameTypes)];
  const controls = selectedTypes.flatMap((gameType, genreIndex) => {
    const column = genreIndex % 3;
    const row = Math.floor(genreIndex / 3);
    return UI_SEEDS[gameType].map((seed, index) => ({
      ...createUIControlElement(seed.type, existingCount + genreIndex * 100 + index),
      ...seed,
      ...(selectedTypes.length > 1 ? {
        // Give each selected genre its own editable HUD region instead of stacking
        // every starter control at the same coordinates.
        x: Math.min(88, seed.x * 0.42 + column * 30),
        y: Math.min(93, seed.y * 0.42 + row * 29),
        width: Math.max(90, Math.round(seed.width * 0.8)),
        label: `${getEgoGameLabel(gameType)} · ${seed.label}`.slice(0, 80),
      } : { label: seed.label }),
    }));
  });
  const title = gameVision.trim().replace(/\s+/g, ' ').slice(0, 60);
  if (!title) return controls;
  return [{
    ...createUIControlElement('text', existingCount),
    label: title,
    x: 3,
    y: 15,
    width: 360,
    height: 32,
    color: '#e8d8f3',
  }, ...controls];
}

export function getEgoGameLabel(gameType: EgoGameType) {
  return egoGameTypes.find((entry) => entry.value === gameType)?.label ?? 'Game';
}

export function getEgoGameSelectionLabel(gameTypes: EgoGameType[]) {
  const labels = [...new Set(gameTypes)].map(getEgoGameLabel);
  return labels.length ? labels.join(' + ') : 'Game';
}
