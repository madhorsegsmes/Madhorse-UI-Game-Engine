export type EgoGameConcept = {
  id: string;
  label: string;
  phrases: string[];
  explanation: string;
  engineArea: string;
};

export const egoGameLanguageLibrary: EgoGameConcept[] = [
  { id: 'world', label: 'World & scenes', phrases: ['world', 'game world', 'scene', 'level', 'map', 'terrain', 'town', 'dungeon', 'arena'], explanation: 'Places, terrain, rooms, and the order players visit them.', engineArea: 'Scene objects, terrain, cameras, lighting, and assets' },
  { id: 'third-person-shooter', label: 'Third-person shooter', phrases: ['third person shooter', 'third-person shooter', 'over the shoulder', 'shooter campaign', 'cover shooter'], explanation: 'A third-person starting scene needs a player start, cover, enemies or targets, clear combat lanes, and a readable camera view.', engineArea: 'Shooter player actions, scene camera, editable environment objects, and starter HUD; advanced weapon logic and campaigns still need authoring' },
  { id: 'kingdom-strategy', label: 'Kingdom strategy', phrases: ['kingdom strategy', 'kingdom builder', 'strategy kingdom', 'clash of kings', 'base building strategy'], explanation: 'Organize a map into a home base, resource areas, routes, unit groups, and clear command points.', engineArea: 'RTS command, gather, and build actions; resource and selected-unit starter UI' },
  { id: 'creature-adventure', label: 'Creature-collection adventure', phrases: ['pokemon', 'creature collection', 'creature collector', 'capture creatures', 'creature adventure', 'monster collecting'], explanation: 'A creature adventure can be presented in 2D or 3D, with a player, companions, exploration areas, encounters, and a party interface.', engineArea: '2D sprite or 3D scene assets already in the project, character templates, supported actions, and starter UI' },
  { id: 'story', label: 'Story & missions', phrases: ['story', 'storyline', 'lore', 'quest', 'mission', 'objective', 'dialogue', 'conversation', 'cutscene', 'boss fight'], explanation: 'The reason for each mission, who gives it, and how it moves the story forward.', engineArea: 'Vision Board mission nodes, NPCs, triggers, and supported actions' },
  { id: 'player', label: 'Player & characters', phrases: ['player', 'hero', 'main character', 'character', 'npc', 'enemy', 'villain', 'companion', 'teammate'], explanation: 'Who the player controls and the helpers or opponents in the world.', engineArea: 'Character Controller, NPC behavior, components, and animations' },
  { id: 'anatomy', label: 'Character, animal & creature anatomy', phrases: ['anatomy', 'body', 'skeleton', 'rig', 'head', 'face', 'jaw', 'jawline', 'cheek', 'nose', 'neck', 'clavicle', 'shoulder', 'shoulder blade', 'chest', 'ribcage', 'spine', 'torso', 'abdomen', 'pelvis', 'hip', 'arm', 'upper arm', 'forearm', 'elbow', 'wrist', 'hand', 'finger', 'leg', 'thigh', 'knee', 'calf', 'shin', 'ankle', 'heel', 'toe', 'foot', 'feet', 'paw', 'muzzle', 'tail', 'horn', 'tusk', 'fang', 'ear', 'wing', 'feather', 'beak', 'fin', 'scale', 'claw', 'hoof', 'shell', 'antenna', 'mandible', 'gill', 'mane', 'animal', 'creature', 'monster', 'beast', 'orc', 'vampire', 'wolf', 'dragon', 'spider', 'shark', 'bird', 'horse', 'lion', 'human', 'small', 'tall', 'giant', 'height'], explanation: 'Choose a matching body plan: humanoid, four-legged mammal, bird, dragon, serpent, insect, or aquatic. Add named joints and species details such as wings, feathers, fins, scales, shells, horns, paws, hooves, or claws, then size it to the request.', engineArea: 'Ego creature templates, Mad Builder scene creation, animation clips, and editable Hierarchy parts' },
  { id: 'movement', label: 'Movement', phrases: ['move', 'movement', 'walk', 'run', 'sprint', 'jump', 'climb', 'swim', 'fly', 'crouch', 'dodge', 'dash', 'drive'], explanation: 'How characters travel and which controls start each movement.', engineArea: 'Player movement presets, physics settings, and Play/Test controls' },
  { id: 'racing', label: 'Kart & real-car racing', phrases: ['racing', 'kart racing', 'go kart', 'go-kart', 'car racing', 'real car racing', 'race car', 'drift', 'lap', 'checkpoint', 'pit lane', 'boost'], explanation: 'A kart race favors readable arcade handling and drift/boost; a real-car race needs believable car proportions, a circuit, checkpoints, lap timing, and tuning.', engineArea: 'Kart Racing and Real Car Racing game types, race controls, HUD, scene geometry, and animation states' },
  { id: 'visual-quality', label: 'High-fidelity graphics', phrases: ['high end graphics', 'high-end graphics', 'high definition', 'high fidelity', 'realistic graphics', 'pbr', 'physically based', 'roughness', 'metalness', 'reflections', 'contact shadows', 'key light', 'fill light', 'rim light', 'detailed texture', 'smooth silhouette'], explanation: 'Use believable proportions, purposeful geometry, layered materials, deliberate lighting and readable composition, while keeping real-time scenes efficient.', engineArea: 'Ego visual guidance, scene lighting, supported material settings, and the current Madhorse renderer' },
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
