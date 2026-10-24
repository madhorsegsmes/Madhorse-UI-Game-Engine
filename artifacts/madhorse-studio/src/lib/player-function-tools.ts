import type { PluginComponentKind } from './scene-plugin-catalog';

/** Reuses the native component/inspector pipeline rather than genre-specific copies. */
export const genrePlayerFunctionTools: {
  id: string; label: string; description: string; componentKind: PluginComponentKind;
}[] = [
  { id: 'fighting-hit', label: 'Fighting: Melee attack', description: 'Hit a nearby practice target. Edit damage, reach, and your attack key.', componentKind: 'action-fight' },
  { id: 'fighting-block', label: 'Fighting: Block', description: 'Hold a key to reduce NPC contact damage and guard while walking.', componentKind: 'action-block' },
  { id: 'fighting-run', label: 'Fighting: Run', description: 'Hold Shift to move faster. Change the speed boost in object Settings.', componentKind: 'action-run' },
  { id: 'rpg-heal', label: 'Role-play: Heal yourself', description: 'Restore health with a cooldown. Edit how much health comes back.', componentKind: 'action-heal' },
  { id: 'rpg-spell', label: 'Role-play: Cast a spell', description: 'Fire a magic attack using mana that slowly refills.', componentKind: 'action-cast' },
  { id: 'rpg-inventory', label: 'Role-play: Inventory', description: 'Carry wood, planks, coins, and keys. Set your starting amounts.', componentKind: 'feature-inventory' },
  { id: 'rpg-interact', label: 'Role-play: Use nearby objects', description: 'Use doors, collect pickups, read signs, or save a test checkpoint.', componentKind: 'feature-interact' },
  { id: 'card-draw', label: 'Card games: Draw a card', description: 'Draw from a simple damage-card deck. Edit deck size and hand limit.', componentKind: 'action-draw-card' },
  { id: 'card-play', label: 'Card games: Play a card', description: 'Spend a card and energy to damage a practice target.', componentKind: 'action-play-card' },
  { id: 'card-turn', label: 'Card games: End turn', description: 'Advance the local turn, refill energy, and draw one card.', componentKind: 'action-end-turn' },
  { id: 'rts-command', label: 'RTS: Order units to move', description: 'Send nearby NPC units toward a rally object or a point ahead. Simple straight-line movement.', componentKind: 'action-command' },
  { id: 'rts-gather', label: 'RTS: Gather resources', description: 'Collect wood, planks, or coins from objects with a Pickup component.', componentKind: 'action-gather' },
  { id: 'rts-build', label: 'RTS: Place a building block', description: 'Spend planks to place a temporary block in front of your player.', componentKind: 'action-build' },
  { id: 'mmo-companion', label: 'MMO: Recruit a companion', description: 'Make a nearby NPC follow your player locally during Play Test.', componentKind: 'action-follow' },
  { id: 'mmo-spell', label: 'MMO: Mana and spell skill', description: 'Add the same editable spell skill used by role-play characters.', componentKind: 'action-cast' },
  { id: 'mmo-health', label: 'MMO: Health and damage', description: 'Set health, regeneration, and NPC contact damage.', componentKind: 'feature-health' },
  { id: 'mmo-status', label: 'MMO: Health and item display', description: 'Show your health and inventory while testing.', componentKind: 'feature-status-bar' },
  { id: 'mmo-network', label: 'MMO: Share player movement', description: 'Use a 32-player test room. Movement only—not a persistent MMO world or shared combat.', componentKind: 'multiplayer-player' },
  { id: 'shooter-fire', label: 'Shooter: Fire weapon', description: 'Shoot in your movement direction or at a selected practice target.', componentKind: 'action-shoot' },
  { id: 'shooter-reload', label: 'Shooter: Ammo and reload', description: 'Use a magazine and spare ammo. Press R to reload.', componentKind: 'action-reload' },
  { id: 'shooter-crouch', label: 'Shooter: Crouch', description: 'Hold C to lower your character and walk slowly.', componentKind: 'action-crouch' },
];
