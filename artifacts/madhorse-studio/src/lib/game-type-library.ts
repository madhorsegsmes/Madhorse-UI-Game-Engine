type LibraryEntry = {
  name: string;
  variants: string;
  loop: string;
  systems: string;
  build: string;
  test: string;
};

type ReportLine = {
  text: string;
  style: 'title' | 'subtitle' | 'heading' | 'body';
};

const entries: LibraryEntry[] = [
  {
    name: 'Action, combat, and beat-em-up',
    variants: 'Character action, hack-and-slash, brawler, arena combat, action platformer.',
    loop: 'Read enemy intent, move and attack, avoid damage, earn rewards, then face a harder encounter.',
    systems: 'Responsive movement, hitboxes and hurtboxes, health, attack timing, invulnerability windows, enemy behaviors, camera framing, combat feedback, checkpoints.',
    build: 'Block out a small arena in Scene View; add player, enemies, floor and walls in Hierarchy; tune movement and collision; add attack animations and effects; build health and objective UI.',
    test: 'Check hit range, input response, enemy recovery, camera visibility, difficulty, and whether a checkpoint restores the intended state.',
  },
  {
    name: 'Platformers',
    variants: 'Precision 2D, 2.5D, 3D, endless runner, puzzle platformer, metroidvania.',
    loop: 'Move through spaces, jump or use movement abilities, overcome hazards, collect items, and reach an exit.',
    systems: 'Ground detection, jump height, acceleration, air control, collision, moving platforms, hazards, collectibles, checkpoints, camera bounds, level transitions.',
    build: 'Create a repeatable floor-and-platform kit; set player scale and collision; build one short level; add hazard and checkpoint objects; tune camera boundaries and UI.',
    test: 'Test jumps at edges and slopes, moving-platform timing, respawn placement, controller and keyboard input, and every route to the exit.',
  },
  {
    name: 'Action-adventure and exploration',
    variants: 'Exploration adventure, metroidvania, dungeon adventure, open-area action.',
    loop: 'Explore, discover a goal or clue, overcome a puzzle or encounter, and unlock another route.',
    systems: 'Scene connections, interactables, inventory, quest flags, dialogue, puzzle state, combat, camera, map or objective UI, save checkpoints.',
    build: 'Sketch a connected set of rooms; place clear landmarks and interactable objects; define unlock conditions in project data; add navigation and objective UI; test room transitions.',
    test: 'Check for soft locks, unclear goals, inaccessible items, lost quest state after reload, and transitions that reset the wrong objects.',
  },
  {
    name: 'Role-playing games (RPGs)',
    variants: 'Action RPG, turn-based RPG, tactical RPG, Japanese-style RPG, computer RPG, party RPG.',
    loop: 'Explore or accept a quest, make character choices, fight or solve challenges, gain progress, and improve a character or party.',
    systems: 'Character stats, attributes, levels, inventory, equipment, abilities, party, enemies, combat rules, quest and dialogue flags, rewards, save data, balancing.',
    build: 'Define the character and progression rules in project data; prototype one encounter and one reward; create party and enemy objects; add inventory and status UI; then expand quests and areas.',
    test: 'Check level curves, item and ability effects, party edge cases, quest completion order, save/load behavior, and whether an encounter can be completed.',
  },
  {
    name: 'Roguelike and roguelite',
    variants: 'Turn-based roguelike, action roguelite, run-based deckbuilder, dungeon crawler.',
    loop: 'Start a run, explore or fight through changing challenges, collect temporary upgrades, and either finish or start a new run.',
    systems: 'Run state versus permanent unlocks, level or encounter generation, random seeds, item pools, death and restart rules, difficulty scaling, meta-progression saves.',
    build: 'Separate run-only data from permanent project progress; create a small hand-authored room set first; add random selection and seed tracking only after the run loop works.',
    test: 'Repeat the same seed, restart after death, verify permanent unlocks persist, and check that random combinations cannot make a run impossible.',
  },
  {
    name: 'Fighting games',
    variants: '2D fighter, 3D arena fighter, platform fighter, tag fighter, local brawler.',
    loop: 'Read an opponent, choose movement or an attack, resolve hit/block/stun, and win a round or match.',
    systems: 'Move lists, startup/active/recovery timing, hit and hurt regions, blocking, throws, combos, stun, rounds, match UI, training mode, local or online synchronization.',
    build: 'Prototype two fighters and one stage; use separate objects for fighters and stage bounds; add named moves and animation states; build health, timer and round UI; tune one matchup before adding a roster.',
    test: 'Verify attack timing and collision, block direction, combo consistency, round resets, simultaneous inputs, and fairness across the roster.',
  },
  {
    name: 'Shooter games',
    variants: 'First-person, third-person, twin-stick, tactical, hero shooter, arcade shooter.',
    loop: 'Move, aim, choose a weapon or ability, engage targets, and complete an encounter or objective.',
    systems: 'Camera and aim, input sensitivity, weapon state, projectiles or hit checks, recoil, health, cover, enemy perception, ammunition, HUD, checkpoints; online modes additionally need server authority and anti-cheat.',
    build: 'Set the camera and player scale; build a small test arena; create one weapon and one target; tune aim and hit feedback; add objectives and HUD; only then expand weapons and maps.',
    test: 'Check aim at screen edges, collision behind cover, weapon switching, accessibility options, performance, and online authority if multiplayer is required.',
  },
  {
    name: 'Racing and vehicle games',
    variants: 'Kart racing, real-car racing, arcade racer, drift, rally, circuit, vehicle combat, driving simulation.',
    loop: 'Control a vehicle around a route, manage speed and risk, pass rivals or targets, and finish or improve a result.',
    systems: 'Kart games emphasize readable arcade steering, boost and drift; real-car games need believable vehicle proportions, steering, grip, suspension, collision, track boundaries, checkpoints, lap timing, opponent paths, tuning, race UI, replay or ghost data.',
    build: 'For kart racing, prototype one compact kart and a short closed track with boost/drift cues. For real-car racing, build one proportioned car and a test circuit; add collision, camera, ordered checkpoints and lap UI, then tune handling before AI opponents.',
    test: 'Drive every corner at varied speeds, test collisions and recovery, verify checkpoint order, lap counting, camera comfort, and controller remapping.',
  },
  {
    name: 'Sports games',
    variants: 'Soccer, basketball, football, baseball, hockey, tennis, golf, combat sports, sports manager.',
    loop: 'Use player or team decisions to compete under a sport’s rules, score, and complete a match or season.',
    systems: 'Sport-specific rules, player roles and attributes, ball or equipment physics, team switching, clock and scoring, fouls or penalties, AI positioning, substitutions, season data, replay and presentation UI.',
    build: 'Write the rules and scoring conditions first; prototype one player, one opponent and the ball or equipment; add field boundaries and camera; implement one complete scoring sequence before building a full match.',
    test: 'Check legal and illegal plays, score and clock resets, possession, player switching, edge-of-field cases, and season save data.',
  },
  {
    name: 'Real-time strategy (RTS)',
    variants: 'Base builder, squad tactics, tower defense, real-time tactics, auto-battler.',
    loop: 'Gather or earn resources, issue orders, build or recruit, counter an opponent, and meet a win condition.',
    systems: 'Unit selection, pathfinding, orders, resources, production queues, structures, fog of war, combat resolution, AI, minimap, victory conditions, pause and speed controls.',
    build: 'Start with one map, two unit types and one resource; add selection and move orders; confirm pathing and combat; then add production, economy, opponent behavior and UI.',
    test: 'Check blocked paths, many selected units, resource limits, order cancellation, AI recovery, and whether victory can be reached or prevented fairly.',
  },
  {
    name: 'Turn-based strategy, tactics, and 4X',
    variants: 'Grid tactics, tactical RPG, grand strategy, 4X, hex strategy, strategy board game.',
    loop: 'Inspect the board or world, spend a turn on movement or decisions, resolve the opponent, and pursue a strategic objective.',
    systems: 'Grid or map coordinates, legal moves, turn order, action points, combat math, visibility, factions, research or diplomacy, objective state, undo policy, save and replay.',
    build: 'Choose square, hex or free-map movement; implement legal moves for one unit; add one opponent turn; then add objectives and progression with project-local rules.',
    test: 'Check turn transitions, unreachable tiles, simultaneous effects, save/load during a turn, and whether the rules produce a stalemate.',
  },
  {
    name: 'Multiplayer online battle arena (MOBA)',
    variants: 'Lane-based team battle, hero arena, objective-based team strategy.',
    loop: 'Select a role or hero, coordinate with a team, gain strength, contest objectives, and defeat the opposing base or team.',
    systems: 'Hero abilities and cooldowns, teams and roles, minions, lanes, towers, objectives, match queue, authoritative simulation, latency handling, anti-cheat, moderation and reconnect.',
    build: 'Prototype the full loop offline with a tiny map and two heroes first. A public online version also requires dedicated server, identity, matchmaking, moderation and operations beyond scene authoring.',
    test: 'Check ability interactions, team balance, reconnect and disconnect behavior, authoritative damage, exploit resistance, and match completion.',
  },
  {
    name: 'Card and deckbuilding games',
    variants: 'Trading or collectible card game, deckbuilder, roguelike card battler, party card game.',
    loop: 'Draw, choose cards, resolve effects under a turn structure, and meet a win or scoring condition.',
    systems: 'Card definitions, deck rules, draw/discard/exile zones, hand limits, turn phases, effect ordering, status effects, random draws, AI, collection or unlock data, match UI.',
    build: 'Define card data and a small deck; implement the turn and effect resolver before visual polish; add a few cards that exercise different effects; create readable hand and target UI.',
    test: 'Check deck limits, effect order, empty deck behavior, reshuffles, invalid targets, duplicate effects and deterministic replay where required.',
  },
  {
    name: 'Board, tabletop, and party games',
    variants: 'Chess-like strategy, dice games, tabletop RPG helper, party board game, local minigames.',
    loop: 'Take turns, move pieces or resolve an event, apply shared rules, and reach the board or round objective.',
    systems: 'Board coordinates, legal actions, turn order, dice or random events, pieces, score, local player identity, tutorial, undo policy and accessibility.',
    build: 'Represent each board space and piece as data; prototype one legal move and turn change; add rules validation and clear selection feedback before animation.',
    test: 'Check every legal move class, blocked moves, ties, restart and undo rules, and multiple players sharing one device.',
  },
  {
    name: 'Puzzle games',
    variants: 'Logic, physics, match, word, spatial, escape-room, hidden-object puzzles.',
    loop: 'Observe a problem, test an action, discover a rule or pattern, and solve a stage with feedback.',
    systems: 'Puzzle state, interaction rules, reset, hints, difficulty progression, timers if needed, completion checks, readable UI, level data and accessibility.',
    build: 'Make one complete puzzle that can be solved and reset; represent puzzle state separately from decoration; add a hint only after the solution is testable.',
    test: 'Check intended and unintended solutions, soft locks, reset behavior, touch targets, hint clarity and color-independent cues.',
  },
  {
    name: 'Simulation games',
    variants: 'Life, farming, city, vehicle, flight, job, ecosystem, management simulation.',
    loop: 'Observe a simulated world, make choices, wait for or advance outcomes, then improve the environment or reach a goal.',
    systems: 'Simulation clock, schedules, needs or resources, agent behavior, economy, environment state, save data, dashboards and controllable time speed.',
    build: 'Choose a small simulation scale and update cadence; define measurable rules; model a few agents or resources; then add world visuals and summary UI.',
    test: 'Check long-run balance, pause and speed changes, resource overflow, save/reload, agent deadlocks and performance as population grows.',
  },
  {
    name: 'Survival and crafting',
    variants: 'Survival adventure, crafting sandbox, base defense, cooperative survival.',
    loop: 'Gather resources, manage risks and needs, craft tools or shelter, and survive or progress through escalating threats.',
    systems: 'Gathering, inventory, crafting recipes, durability, health or needs, day/night, hazards, enemies, building placement, checkpoints and save rules.',
    build: 'Prototype one resource, one recipe and one survival threat; keep recipe and item rules in project data; add a small world and readable inventory before expanding content.',
    test: 'Check resource loss or duplication, recipe requirements, death/recovery, placement collision, day/night transitions and save consistency.',
  },
  {
    name: 'Open-world and sandbox games',
    variants: 'Exploration sandbox, creative building, voxel world, open-world action, emergent simulation.',
    loop: 'Explore or build freely, discover systems and goals, and change a persistent world over time.',
    systems: 'World scale and streaming, coordinate handling, object placement, persistence, navigation, points of interest, performance budgets, save versioning and tools for content.',
    build: 'Prototype one small region before expanding. Define world units, object limits and streaming boundaries; test save and reload with a few player-made changes.',
    test: 'Check distant travel, unloaded boundaries, memory and frame budgets, save size, world updates and recovery after interrupted saves.',
  },
  {
    name: 'Horror and stealth',
    variants: 'Survival horror, psychological horror, stealth action, immersive stealth.',
    loop: 'Read environmental cues, avoid or manage danger, conserve resources, and progress through a controlled sequence of tension and relief.',
    systems: 'Enemy perception, sound and sight cues, patrols, hiding or escape, lighting, limited resources, trigger logic, pacing, checkpoints and accessibility options.',
    build: 'Block out one short encounter; define what an enemy can sense and how it responds; use lights, camera and sound intentionally; add a safe route and checkpoint.',
    test: 'Check readable threat signals, fair detection, recoverable mistakes, accessibility, pacing and whether a player can become permanently trapped.',
  },
  {
    name: 'Battle royale',
    variants: 'Solo, duo or squad survival arena; extraction-style last-team modes.',
    loop: 'Enter a match, gather equipment, respond to a shrinking or changing safe area, and outlast other players.',
    systems: 'Large-map streaming, loot tables, matchmaking, authoritative dedicated servers, squads, safe-zone scheduling, spectating, anti-cheat, moderation, reconnect and telemetry.',
    build: 'Prototype the movement, loot and safe-zone loop with bots in a small test map. A real public match needs scalable network services and operations; a scene alone is not sufficient.',
    test: 'Load-test concurrent players, check edge cases at zone boundaries, reconnect, server authority, exploit resistance and match shutdown.',
  },
  {
    name: 'MMO and MMORPG',
    variants: 'Persistent online RPG, shared-world adventure, social virtual world, MMO strategy.',
    loop: 'Create a persistent character, visit shared spaces, complete activities with others, and retain progress between sessions.',
    systems: 'Account identity, authoritative world servers, persistence, character and inventory records, replication, zones or shards, matchmaking, chat, moderation, economy, backups and live operations.',
    build: 'Design a small single-player vertical slice first. Treat accounts, networking, databases and live operations as separate service requirements; do not treat browser-local project saves as MMO persistence.',
    test: 'Plan load and failure tests, permissions, data recovery, anti-cheat, moderation, latency, service updates and player-data export/deletion.',
  },
  {
    name: 'Narrative, visual novel, and interactive fiction',
    variants: 'Branching visual novel, dialogue adventure, interactive story, choice-driven RPG.',
    loop: 'Read or listen, make a choice, see consequences, and move toward an ending or new story branch.',
    systems: 'Dialogue and branching state, character portraits, subtitles, localization, choices, flags, save slots, accessibility, music and scene transitions.',
    build: 'Map the story branches before building scenes; test a short branch end-to-end; use named project data for flags and choices; add portrait and subtitle layouts.',
    test: 'Check every branch, return path, save/load at choices, text overflow, localization layout and content skips.',
  },
  {
    name: 'Rhythm, music, and dance',
    variants: 'Lane rhythm, drumming, dance, music performance, timing-based action.',
    loop: 'Read a cue, act at a target time, receive timing feedback, and improve a score or performance.',
    systems: 'Audio playback clock, chart data, input latency calibration, timing windows, scoring, song selection, accessibility, legal audio assets and results UI.',
    build: 'Calibrate playback and input before making charts; author one short chart; add timing feedback and results; test with representative audio devices.',
    test: 'Check audio/input drift, refresh rates, pause/resume, calibration, chart readability and licensed music usage.',
  },
  {
    name: 'Tycoon, idle, and incremental games',
    variants: 'Business tycoon, clicker, idle progression, factory builder, economic management.',
    loop: 'Earn or produce resources, spend them on upgrades, automate production, and reach a larger milestone.',
    systems: 'Economy formulas, production timers, upgrade trees, automation, offline progress policy, save data, dashboards, balancing and reset/prestige rules.',
    build: 'Start with one resource and one upgrade; define rates and caps in project data; add automation only after the economy can be forecast and tested.',
    test: 'Check rounding, overflow, offline time limits, save integrity, upgrade ordering and long-term balance.',
  },
  {
    name: 'Educational and training games',
    variants: 'Skill practice, safety simulation, language learning, serious games, guided training.',
    loop: 'Present a goal or task, let a learner practice, give feedback, and show progress toward a learning outcome.',
    systems: 'Learning objectives, task rules, feedback, progress records, accessible interaction, content review, privacy and optional educator controls.',
    build: 'Write the skill objective and success measure first; build one short practice task; make feedback specific; add progress only with a clear data policy.',
    test: 'Check instructional accuracy, accessibility, privacy, age suitability, misleading feedback and whether scores measure the intended skill.',
  },
];

function pdfSafe(value: string) {
  return value
    .replace(/[—–]/g, '-')
    .replace(/→/g, 'to')
    .replace(/•/g, '-')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '?');
}

function escapePdf(value: string) {
  return pdfSafe(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function wrapText(value: string, maxLength = 96) {
  const words = pdfSafe(value).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    if (word.length > maxLength) {
      if (line) lines.push(line);
      line = '';
      for (let index = 0; index < word.length; index += maxLength) {
        const chunk = word.slice(index, index + maxLength);
        if (chunk.length === maxLength) lines.push(chunk);
        else line = chunk;
      }
    } else if (!line) {
      line = word;
    } else if (`${line} ${word}`.length <= maxLength) {
      line += ` ${word}`;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

function buildLines(): ReportLine[] {
  const lines: ReportLine[] = [
    { style: 'title', text: 'Game Type Development Library' },
    { style: 'subtitle', text: 'Madhorse Studio - protected system reference - read-only PDF' },
    { style: 'body', text: 'A practical guide to common game genres, their core loops, required systems, build order and testing.' },
    { style: 'body', text: 'Genres overlap and new hybrids are always possible. Choose a primary loop, then combine only the systems your project needs.' },
    { style: 'heading', text: 'How this guide maps to Madhorse Studio' },
    { style: 'body', text: 'Scene View and Hierarchy: create, organize and inspect scene objects. Settings: edit the selected object and its available properties.' },
    { style: 'body', text: 'Assets and Data: keep reusable media separate from editable, browser-local project rules and saved scene content.' },
    { style: 'body', text: 'Mad Builder: describe a requested build and apply its validated objects to the scene. Review generated objects in Scene View and Hierarchy.' },
    { style: 'body', text: 'Functions & Controls: category selectors organize future game, player and NPC logic. Selecting a category does not itself install gameplay rules.' },
    { style: 'body', text: 'System Presets & Data: this library is protected system reference material. Adapt rules inside project data; do not edit the system reference.' },
    { style: 'body', text: 'Important boundary: scene editing is not the same as online services. Multiplayer accounts, authoritative servers, persistent MMO data, moderation and anti-cheat require additional systems.' },
    { style: 'heading', text: 'A reliable build order for any genre' },
    { style: 'body', text: '1. State the player goal, core action, win/loss conditions, platform and single-player or multiplayer scope.' },
    { style: 'body', text: '2. Prototype one short playable loop with a small scene before creating a large world or full content set.' },
    { style: 'body', text: '3. Add scene objects through Hierarchy; organize names and parent relationships; inspect and tune each object in Settings.' },
    { style: 'body', text: '4. Set up camera, collision and physics; test movement and interactions before adding visual polish.' },
    { style: 'body', text: '5. Add art, models, sprites, textures, animation and sound with assets you own or have permission to use.' },
    { style: 'body', text: '6. Implement the genre rules as project data and validated behavior; never treat generated text as trusted executable code.' },
    { style: 'body', text: '7. Add player, NPC and game UI only after the core loop works. Keep saves and rules scoped to the project.' },
    { style: 'body', text: '8. Test normal play, edge cases, performance, input accessibility, reload behavior and the intended target platform.' },
    { style: 'body', text: '9. Verify target export and deployment support in the current build settings; do not assume a web preview is a shipped game.' },
    { style: 'heading', text: 'Genre library' },
  ];

  for (const entry of entries) {
    lines.push({ style: 'heading', text: entry.name });
    lines.push({ style: 'body', text: `Common forms: ${entry.variants}` });
    lines.push({ style: 'body', text: `Core loop: ${entry.loop}` });
    lines.push({ style: 'body', text: `Systems to plan: ${entry.systems}` });
    lines.push({ style: 'body', text: `Madhorse build path: ${entry.build}` });
    lines.push({ style: 'body', text: `Test before expanding: ${entry.test}` });
  }
  return lines.flatMap((line) => wrapText(line.text).map((text) => ({ ...line, text })));
}

function paginate(lines: ReportLine[]) {
  const pages: Array<Array<{ line: ReportLine; y: number }>> = [[]];
  let y = 746;
  for (const line of lines) {
    const step = line.style === 'title' ? 22 : line.style === 'heading' ? 16 : line.style === 'subtitle' ? 16 : 12;
    if (y - step < 48) {
      pages.push([]);
      y = 746;
    }
    pages[pages.length - 1].push({ line, y });
    y -= step;
  }
  return pages;
}

/** Generates a static, non-interactive PDF for display in System Presets & Data. */
export function createGameTypeLibraryPdf() {
  const pages = paginate(buildLines());
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${pages.map((_, index) => `${5 + index * 2} 0 R`).join(' ')}] /Count ${pages.length} >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
  ];

  pages.forEach((page, pageIndex) => {
    const pageId = objects.length + 1;
    const contentId = pageId + 1;
    const commands = page.map(({ line, y }) => {
      const font = line.style === 'title' || line.style === 'heading' ? 'F2' : 'F1';
      const size = line.style === 'title' ? 16 : line.style === 'subtitle' ? 8 : line.style === 'heading' ? 10 : 8.5;
      return `BT /${font} ${size} Tf 46 ${y} Td (${escapePdf(line.text)}) Tj ET`;
    });
    commands.unshift(`BT /F2 7 Tf 46 779 Td (MADHORSE STUDIO  |  GAME TYPE LIBRARY  |  READ ONLY) Tj ET`);
    commands.push(`BT /F1 7 Tf 46 28 Td (System reference - page ${pageIndex + 1} of ${pages.length}) Tj ET`);
    const stream = commands.join('\n');
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`,
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    );
  });

  let document = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(document.length);
    document += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = document.length;
  document += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    document += `${offset.toString().padStart(10, '0')} 00000 n \n`;
  });
  document += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new Blob([document], { type: 'application/pdf' });
}

export const gameTypeLibraryEntryCount = entries.length;
