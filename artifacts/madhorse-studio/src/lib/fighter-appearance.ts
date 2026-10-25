import type { EgoCharacterSpecies } from './ego-character-anatomy';

export type FighterRace = Extract<EgoCharacterSpecies, 'human' | 'orc' | 'vampire' | 'monster'>;
export type FighterVisualStyle = 'reference-inspired' | 'anime-inspired' | 'realistic-game-ready';
export type FighterOutfit = 'martial-arts-gi' | 'streetwear' | 'light-armor' | 'long-robe';

export type FighterAppearance = {
  race: FighterRace;
  style: FighterVisualStyle;
  outfit: FighterOutfit;
};

export type FightingAppearancePair = {
  player: FighterAppearance;
  rival: FighterAppearance;
};

export const defaultFightingAppearancePair: FightingAppearancePair = {
  player: { race: 'human', style: 'reference-inspired', outfit: 'martial-arts-gi' },
  rival: { race: 'human', style: 'reference-inspired', outfit: 'martial-arts-gi' },
};

export const fighterRaceOptions: Array<{ value: FighterRace; label: string }> = [
  { value: 'human', label: 'Human' },
  { value: 'orc', label: 'Orc' },
  { value: 'vampire', label: 'Vampire' },
  { value: 'monster', label: 'Monster' },
];

export const fighterStyleOptions: Array<{ value: FighterVisualStyle; label: string }> = [
  { value: 'reference-inspired', label: 'Reference-inspired 3D' },
  { value: 'anime-inspired', label: 'Anime-inspired 3D' },
  { value: 'realistic-game-ready', label: 'Realistic game-ready' },
];

export const fighterOutfitOptions: Array<{ value: FighterOutfit; label: string }> = [
  { value: 'martial-arts-gi', label: 'Martial-arts gi' },
  { value: 'streetwear', label: 'Streetwear' },
  { value: 'light-armor', label: 'Light armor' },
  { value: 'long-robe', label: 'Long robe' },
];

export function formatFightingAppearancePrompt(pair: FightingAppearancePair) {
  const describe = (number: 1 | 2, role: string, appearance: FighterAppearance) =>
    `Fighter ${number} (${role}): race=${appearance.race}; style=${appearance.style}; clothing=${appearance.outfit}.`;
  return `FIGHTER APPEARANCE SETTINGS (customize each fighter independently):\n${describe(1, 'Player', pair.player)}\n${describe(2, 'Opponent', pair.rival)}`;
}

export function parseFightingAppearancePrompt(text: string): FightingAppearancePair | null {
  const parse = (number: 1 | 2): FighterAppearance | null => {
    const line = text.split(/\r?\n/).find(candidate =>
      candidate.toLowerCase().startsWith(`fighter ${number} `) && /race=/i.test(candidate));
    if (!line) return null;
    const raceText = line.match(/race=([\w-]+)/i)?.[1]?.toLowerCase();
    const styleText = line.match(/style=([\w-]+)/i)?.[1]?.toLowerCase();
    const outfitText = line.match(/clothing=([\w-]+)/i)?.[1]?.toLowerCase();
    const race = fighterRaceOptions.find(option => option.value === raceText)?.value;
    const style = fighterStyleOptions.find(option => option.value === styleText)?.value;
    const outfit = fighterOutfitOptions.find(option => option.value === outfitText)?.value;
    if (!race || !style || !outfit) return null;
    return { race, style, outfit };
  };
  const player = parse(1);
  const rival = parse(2);
  return player && rival ? { player, rival } : null;
}
