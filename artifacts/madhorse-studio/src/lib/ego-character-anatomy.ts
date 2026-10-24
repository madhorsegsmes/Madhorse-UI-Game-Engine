export type EgoCharacterSpecies =
  | 'human'
  | 'orc'
  | 'vampire'
  | 'wolf'
  | 'quadruped'
  | 'avian'
  | 'dragon'
  | 'serpentine'
  | 'insectoid'
  | 'aquatic'
  | 'monster';

export type EgoCharacterSize = 'prompt' | 'small' | 'average' | 'tall' | 'giant';
export type EgoCharacterRequest = {
  species: EgoCharacterSpecies;
  displayName: string;
  heightMeters: number;
};

const speciesPatterns: Array<{ species: EgoCharacterSpecies; pattern: RegExp }> = [
  { species: 'human', pattern: /\b(?:humans?|people|person|men|women)\b/i },
  { species: 'orc', pattern: /\borcs?\b/i },
  { species: 'vampire', pattern: /\bvampires?\b|\bvampiric\b/i },
  { species: 'wolf', pattern: /\b(?:wolves|wolf|werewolves|werewolf)\b/i },
  { species: 'quadruped', pattern: /\b(?:dogs?|cats?|fox(?:es)?|lions?|tigers?|horses?|bears?|deer|elk|moose|boars?|cows?|oxen|rabbits?|hares?|goats?|sheep|pigs?|panthers?|leopards?|hyenas?|badgers?|otters?|squirrels?|rats?|mice|camels?|giraffes?|elephants?|rhinos?|hippos?|gorillas?|apes?)\b/i },
  { species: 'avian', pattern: /\b(?:birds?|eagles?|owls?|hawks?|falcons?|ravens?|crows?|parrots?|vultures?|phoenix(?:es)?|harpies|harpy)\b/i },
  { species: 'dragon', pattern: /\b(?:dragons?|wyverns?|drakes?|griffins?|griffons?|gryphons?|hydras?|basilisks?)\b/i },
  { species: 'serpentine', pattern: /\b(?:snakes?|serpents?|wyrms?|nagas?)\b/i },
  { species: 'insectoid', pattern: /\b(?:spiders?|scorpions?|insects?|beetles?|ants?|mantises|centipedes?|millipedes?|bugs?|wasps?|bees?)\b/i },
  { species: 'aquatic', pattern: /\b(?:fish|sharks?|dolphins?|whales?|octopuses|octopi|squids?|krakens?|mermaids?|seals?|walruses?|turtles?|frogs?|salamanders?)\b/i },
  { species: 'monster', pattern: /\b(?:trolls?|goblins?|ogres?|demons?|devils?|giants?|cyclops|cyclopes|minotaurs?|centaurs?|gargoyles?|skeletons?|zombies?|ghosts?|aliens?|monsters?|beasts?|creatures?)\b/i },
];

const heightPresets: Record<Exclude<EgoCharacterSize, 'prompt'>, number> = {
  small: 1.1,
  average: 1.8,
  tall: 2.4,
  giant: 3.6,
};

const creatureLabels: Record<string, string> = {
  people: 'Human',
  person: 'Human',
  men: 'Human',
  women: 'Human',
  wolves: 'Wolf',
  werewolf: 'Werewolf',
  werewolves: 'Werewolf',
  foxes: 'Fox',
  deer: 'Deer',
  moose: 'Moose',
  oxen: 'Ox',
  hares: 'Hare',
  sheep: 'Sheep',
  mice: 'Mouse',
  phoenixes: 'Phoenix',
  harpies: 'Harpy',
  griffons: 'Griffin',
  gryphons: 'Griffin',
  hydras: 'Hydra',
  mantises: 'Mantis',
  centipedes: 'Centipede',
  millipedes: 'Millipede',
  octopuses: 'Octopus',
  octopi: 'Octopus',
  cyclops: 'Cyclops',
  cyclopes: 'Cyclops',
};

function displayCreatureName(raw: string, fallback: string) {
  const normalized = raw.toLowerCase();
  if (creatureLabels[normalized]) return creatureLabels[normalized];
  if (normalized.endsWith('s') && !normalized.endsWith('ss')) {
    const singular = normalized.slice(0, -1);
    if (creatureLabels[singular]) return creatureLabels[singular];
    return `${singular[0]?.toUpperCase() ?? ''}${singular.slice(1)}`;
  }
  return `${normalized[0]?.toUpperCase() ?? ''}${normalized.slice(1)}` || fallback;
}

function heightFromVision(vision: string, species: EgoCharacterSpecies) {
  const explicit = vision.match(/\b(\d{1,3}(?:\.\d{1,2})?)\s*(m|meters?|cm|centimeters?|ft|feet|foot)\b/i);
  if (explicit) {
    const amount = Number(explicit[1]);
    const unit = explicit[2].toLowerCase();
    const meters = unit === 'cm' || unit.startsWith('centimeter') ? amount / 100
      : unit === 'ft' || unit === 'feet' || unit === 'foot' ? amount * 0.3048
        : amount;
    if (Number.isFinite(meters)) return Math.min(30, Math.max(0.2, meters));
  }

  const animal = ['wolf', 'quadruped', 'avian', 'dragon', 'serpentine', 'insectoid', 'aquatic'].includes(species);
  if (/\b(tiny|very small|small|child|young)\b/i.test(vision)) return animal ? 0.55 : 1.1;
  if (/\b(giant|colossal|huge|massive)\b/i.test(vision)) return 3.6;
  if (/\b(tall|large|big)\b/i.test(vision)) return 2.4;
  return species === 'wolf' || species === 'quadruped' || species === 'aquatic' ? 1.35
    : species === 'avian' || species === 'serpentine' || species === 'insectoid' ? 1.6
      : species === 'dragon' ? 2.4 : 1.8;
}

function visionSegmentForSpecies(vision: string, displayName: string) {
  return vision.split(/[,;!?]|\.(?=\s|$)|\b(?:and|plus)\b/i)
    .find((segment) => segment.toLowerCase().includes(displayName.toLowerCase()))
    ?? vision;
}

function genericCreatureLabel(vision: string, match: string) {
  const named = vision.match(/\b(?:a|an|the|create|build|make|design)\s+((?:[\w-]+\s+){0,2})(?:creature|monster|beast|animal)\b/i);
  const descriptor = named?.[1]?.trim().replace(/^(?:a|an|the)\s+/i, '');
  if (descriptor && !/^(?:new|friendly|enemy|small|large|giant|huge|massive|fantasy|mythical)$/i.test(descriptor)) {
    return descriptor.split(/\s+/).map(word => displayCreatureName(word, 'Creature')).join(' ');
  }
  return displayCreatureName(match, 'Creature');
}

export function detectEgoCharacterRequests(
  vision: string,
  size: EgoCharacterSize = 'prompt',
): EgoCharacterRequest[] {
  const found: EgoCharacterRequest[] = [];
  const keys = new Set<string>();
  for (const { species, pattern } of speciesPatterns) {
    const matches = [...vision.matchAll(new RegExp(pattern.source, 'gi'))];
    for (const match of matches) {
      const raw = match[0] ?? '';
      const displayName = species === 'human' || species === 'orc' || species === 'vampire'
        ? species[0].toUpperCase() + species.slice(1)
        : displayCreatureName(raw, species[0].toUpperCase() + species.slice(1));
      const key = `${species}:${displayName.toLowerCase()}`;
      if (keys.has(key)) continue;
      keys.add(key);
      found.push({
        species,
        displayName,
        heightMeters: size === 'prompt'
          ? heightFromVision(visionSegmentForSpecies(vision, raw), species)
          : heightPresets[size],
      });
    }
  }

  const modifiers = new Set(['small', 'tiny', 'large', 'big', 'giant', 'colossal', 'huge', 'massive', 'young', 'old']);
  const namedRequests = found.filter(request => !modifiers.has(request.displayName.toLowerCase()));
  const hasSpecificCreature = namedRequests.some(request =>
    request.species !== 'monster' || !['monster', 'beast', 'creature', 'animal'].includes(request.displayName.toLowerCase()),
  );
  if (hasSpecificCreature) return namedRequests.filter(request =>
    !['monster', 'beast', 'creature', 'animal'].includes(request.displayName.toLowerCase()),
  );
  const genericMatches = [...vision.matchAll(/\b(?:animals?|creatures?|monsters?|beasts?)\b/gi)];
  if (genericMatches.length) {
    const raw = genericMatches[0][0];
    const displayName = genericCreatureLabel(vision, raw);
    return [{
      species: 'monster',
      displayName,
      heightMeters: size === 'prompt' ? heightFromVision(vision, 'monster') : heightPresets[size],
    }];
  }
  return namedRequests.length ? namedRequests : found;
}

export const egoCharacterAnatomyGuidance = [
  'Treat Ego as the central builder: turn the described creature into an editable parent group with clearly named head, body, joints, limbs, appendages, surface details, and separate materials.',
  'Infer a body plan from the creature rather than forcing every species into a human body: upright humanoid, four-legged mammal, winged/feathered bird, dragon, long serpentine body, six/eight-legged insect, or aquatic body with fins and tail.',
  'Keep paired features mirrored unless the vision asks for an asymmetry. Place eyes, ears, jaws, muzzles, beaks, horns, tusks, claws, hooves, paws, wings, fins, scales, feathers, shells, and tails where they fit the named species.',
  'Follow the actual prompt for color, size, number of limbs, and distinctive features. If the exact species is not in the local template catalog, use its requested anatomy and name to guide a suitable creature body plan instead of adding a generic humanoid.',
  'Treat the requested height as the creature’s overall height in meters; keep feet, paws, or the body underside grounded and scale its parts together. Keep labels specific so users can select and edit each part.',
  'These generated parts are editable modular geometry, not a production skeletal rig, finished biological mesh, or guaranteed Mixamo retarget. Do not claim skinning or bone animation unless the asset actually contains a rig.',
].join('\n');
