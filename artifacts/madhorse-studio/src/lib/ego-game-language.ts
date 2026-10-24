export type EgoGameConcept = {
  id: string;
  label: string;
  phrases: string[];
  explanation: string;
  engineArea: string;
};

export const egoGameLanguageLibrary: EgoGameConcept[] = [
  { id: 'world', label: 'World & scenes', phrases: ['world', 'game world', 'scene', 'level', 'map', 'terrain', 'town', 'dungeon', 'arena'], explanation: 'Places, terrain, rooms, and the order players visit them.', engineArea: 'Scene objects, terrain, cameras, lighting, and assets' },
  { id: 'story', label: 'Story & missions', phrases: ['story', 'storyline', 'lore', 'quest', 'mission', 'objective', 'dialogue', 'conversation', 'cutscene', 'boss fight'], explanation: 'The reason for each mission, who gives it, and how it moves the story forward.', engineArea: 'Vision Board mission nodes, NPCs, triggers, and supported actions' },
  { id: 'player', label: 'Player & characters', phrases: ['player', 'hero', 'main character', 'character', 'npc', 'enemy', 'villain', 'companion', 'teammate'], explanation: 'Who the player controls and the helpers or opponents in the world.', engineArea: 'Character Controller, NPC behavior, components, and animations' },
  { id: 'movement', label: 'Movement', phrases: ['move', 'movement', 'walk', 'run', 'sprint', 'jump', 'climb', 'swim', 'fly', 'crouch', 'dodge', 'dash', 'drive'], explanation: 'How characters travel and which controls start each movement.', engineArea: 'Player movement presets, physics settings, and Play/Test controls' },
  { id: 'progression', label: 'Progress & level cap', phrases: ['level cap', 'max level', 'maximum level', 'level up', 'experience', 'xp', 'skill tree', 'rank', 'progression', 'unlock'], explanation: 'How players grow, what they unlock, and the highest level they can reach.', engineArea: 'Project rules and saved game data; advanced progression may need new runtime features' },
  { id: 'items', label: 'Items & inventory', phrases: ['item', 'items', 'loot', 'pickup', 'inventory', 'backpack', 'equipment', 'gear', 'weapon', 'armor', 'armour', 'shop', 'crafting'], explanation: 'What players collect, carry, equip, buy, or craft.', engineArea: 'Pickup, crafting, Scriptable Object data, UI controls, and supported player actions' },
  { id: 'combat', label: 'Combat & effects', phrases: ['fight', 'fighting', 'combat', 'attack', 'damage', 'health', 'healing', 'spell', 'magic', 'status effect', 'buff', 'debuff', 'effect'], explanation: 'How attacks, health, healing, and special effects work.', engineArea: 'Player/NPC action plugins, health data, effects, and animation tools' },
  { id: 'cards', label: 'Cards & card effects', phrases: ['card', 'cards', 'card game', 'deck', 'hand', 'draw a card', 'play a card', 'card effect', 'turn', 'energy'], explanation: 'Decks, hands, turns, card costs, and what each card changes.', engineArea: 'Card player actions, UI controls, and project data' },
  { id: 'rts', label: 'RTS & strategy data', phrases: ['rts', 'real time strategy', 'strategy', 'unit', 'units', 'resource', 'resources', 'base', 'building', 'gather', 'command', 'rally point'], explanation: 'Units, resources, orders, bases, and ways to win a strategy match.', engineArea: 'Unit/NPC actions, world building, triggers, UI, and saved project data' },
  { id: 'controls', label: 'Controls & interface', phrases: ['controls', 'keyboard', 'controller', 'button', 'buttons', 'hud', 'ui', 'menu', 'health bar', 'scoreboard', 'minimap'], explanation: 'What the player sees and which input activates each action.', engineArea: 'UI Builder, game controls, player actions, and scene preview' },
  { id: 'multiplayer', label: 'Multiplayer', phrases: ['multiplayer', 'online', 'co-op', 'coop', 'players', '16 players', '32 players', 'party', 'matchmaking', 'server'], explanation: 'How players join and share a game session.', engineArea: 'Multiplayer tools; production hosting and authoritative networking are separate requirements' },
  { id: 'ending', label: 'Win, loss & finish', phrases: ['win condition', 'win', 'lose condition', 'lose', 'ending', 'final mission', 'end point', 'finish the game', 'complete the game', 'game over', 'credits'], explanation: 'What counts as success, failure, and the end of the full game.', engineArea: 'Mission completion rules, triggers, UI, and a final Vision Board milestone' },
];

export type EgoVisionAnalysis = {
  detected: Array<{ concept: EgoGameConcept; matches: string[] }>;
  start: string;
  mission: string;
  finish: string;
  unmatched: string;
};

export function analyzeEgoGameVision(vision: string): EgoVisionAnalysis {
  const normalized = vision.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9+ -]/g, ' ').replace(/\s+/g, ' ').trim();
  const detected = egoGameLanguageLibrary.flatMap((concept) => {
    const matches = concept.phrases.filter((phrase) => {
      const phraseWords = phrase
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .split(/\s+/);
      const lastWordIndex = phraseWords.length - 1;
      if (!phraseWords[lastWordIndex].endsWith('s')) phraseWords[lastWordIndex] += 's?';
      const escaped = phraseWords.join('\\s+');
      return new RegExp(`(?:^|\\s)${escaped}(?:$|\\s)`, 'i').test(normalized);
    });
    return matches.length ? [{ concept, matches }] : [];
  });
  const start = detected.some((entry) => entry.concept.id === 'world')
    ? 'Set up the first playable scene and its starting place.'
    : 'Choose the first scene and where play begins.';
  const mission = detected.some((entry) => entry.concept.id === 'story')
    ? 'Turn the story idea into ordered missions with clear goals.'
    : 'Describe the main goal, then split it into small missions.';
  const finish = detected.some((entry) => entry.concept.id === 'ending')
    ? 'Record the requested win, loss, or ending rule.'
    : 'Choose the final goal that tells players the game is complete.';
  const matchedPhrases = detected.flatMap((entry) => entry.matches).length;
  return {
    detected,
    start,
    mission,
    finish,
    unmatched: normalized && matchedPhrases === 0
      ? 'I do not recognize a game-building phrase yet. Add who the player is, what they do, or what makes them win.'
      : '',
  };
}
