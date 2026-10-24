import { getTransform, getWorldTransform, type SceneEntity, type Vector3 } from './scene-model';
import type { PlayerActionComponent } from './player-action-model';

export type GenreResources = {
  mana: number; maxMana: number;
  hand: number; deck: number; energy: number; maxEnergy: number; turn: number;
  ammo: number; reserveAmmo: number;
};

export function createGenreResources(actions: PlayerActionComponent[]): GenreResources {
  const spell = actions.find(action => action.action === 'cast');
  const draw = actions.find(action => action.action === 'draw-card');
  const card = actions.find(action => action.action === 'play-card');
  const reload = actions.find(action => action.action === 'reload');
  return {
    mana: spell?.settings.maxMana ?? 0, maxMana: spell?.settings.maxMana ?? 0,
    hand: 0, deck: draw?.settings.deckSize ?? 0,
    energy: card?.settings.startingEnergy ?? 3, maxEnergy: card?.settings.startingEnergy ?? 3, turn: 1,
    ammo: reload?.settings.magazineSize ?? 0, reserveAmmo: reload?.settings.reserveAmmo ?? 0,
  };
}

type PlayerResources = {
  genre: GenreResources; health: number; maxHealth: number;
  wood: number; planks: number; coins: number;
};
type Result = { handled: boolean; entities: SceneEntity[]; message?: string; sound?: boolean; marker?: Vector3 };

/** Local, temporary play-test actions; never writes the saved project or network room. */
export function advanceGenreAction(
  action: PlayerActionComponent,
  entities: SceneEntity[],
  playerId: string,
  position: Vector3,
  heading: number,
  current: PlayerResources,
  actions: PlayerActionComponent[],
  orders: Map<string, Vector3>,
): Result {
  const done = (message: string, sound = false, next = entities, marker?: Vector3): Result =>
    ({ handled: true, entities: next, message, sound, marker });
  const resources = current.genre;
  const draw = actions.find(item => item.action === 'draw-card');
  const drawOne = () => {
    if (!draw || resources.deck < 1 || resources.hand >= draw.settings.handLimit) return false;
    resources.deck -= 1;
    resources.hand += 1;
    return true;
  };
  const nearby = (range: number) => entities
    .filter(entity => entity.active && entity.id !== playerId && (!action.targetId || entity.id === action.targetId))
    .map(entity => {
      const transform = getWorldTransform(entities, entity.id) ?? getTransform(entity);
      return { entity, position: transform.position, distance: Math.hypot(
        transform.position.x - position.x, transform.position.y - position.y, transform.position.z - position.z,
      ) };
    })
    .filter(item => item.distance <= range * 10)
    .sort((a, b) => a.distance - b.distance);

  if (action.action === 'heal') {
    const amount = Math.min(action.settings.amount, current.maxHealth - current.health);
    if (amount <= 0) return done('Your health is already full.');
    current.health += amount;
    return done(`Restored ${amount} health. Health: ${current.health}/${current.maxHealth}.`, true, entities, position);
  }
  if (action.action === 'draw-card') {
    if (!drawOne()) return done(resources.deck < 1 ? 'Your deck is empty.' : 'Your hand is full.');
    return done(`Drew a card. Hand ${resources.hand} · Deck ${resources.deck}.`, true);
  }
  if (action.action === 'end-turn') {
    resources.turn += 1;
    resources.energy = resources.maxEnergy;
    const drew = drawOne();
    return done(`Turn ${resources.turn}. Energy refilled to ${resources.energy}.${drew ? ' Drew one card.' : ''}`, true);
  }
  if (action.action === 'reload') {
    const loaded = Math.min(action.settings.magazineSize - resources.ammo, resources.reserveAmmo);
    if (loaded <= 0) return done(resources.ammo >= action.settings.magazineSize ? 'Your magazine is already full.' : 'No spare ammo left.');
    resources.ammo += loaded;
    resources.reserveAmmo -= loaded;
    return done(`Reloaded. Ammo ${resources.ammo}/${action.settings.magazineSize} · Spare ${resources.reserveAmmo}.`, true);
  }
  if (action.action === 'gather') {
    const node = nearby(action.settings.range).find(item => item.entity.components.some(component =>
      component.type === 'gameFeature' && component.enabled && component.kind === 'pickup' &&
      ['wood', 'planks', 'coins'].includes(String(component.settings.item)),
    ));
    if (!node) return done('No resource node in reach. Add a wood, plank, or coin Pickup to an object first.');
    const pickup = node.entity.components.find(component =>
      component.type === 'gameFeature' && component.enabled && component.kind === 'pickup',
    );
    if (pickup?.type !== 'gameFeature') return done('This resource node could not be read.');
    const item = String(pickup.settings.item) as 'wood' | 'planks' | 'coins';
    const amount = Math.min(999 - current[item], Number(pickup.settings.amount) * action.settings.multiplier);
    if (amount <= 0) return done(`Your ${item} inventory is full.`);
    current[item] += amount;
    return done(`Gathered ${amount} ${item}.`, true,
      entities.map(entity => entity.id === node.entity.id ? { ...entity, active: false } : entity), node.position);
  }
  if (action.action === 'follow') {
    const npc = nearby(action.settings.range).find(item => item.entity.components.some(component =>
      component.type === 'characterController' && component.enabled && component.role === 'npc',
    ));
    if (!npc) return done('No NPC companion in reach. Choose an NPC target or move closer.');
    orders.delete(npc.entity.id);
    return done(`${npc.entity.name} now follows your player in this test.`, true,
      entities.map(entity => entity.id === npc.entity.id ? {
        ...entity,
        components: entity.components.map(component => component.type === 'characterController'
          ? { ...component, behavior: 'follow-player', followDistance: action.settings.followDistance }
          : component),
      } : entity));
  }
  if (action.action === 'command') {
    const rally = action.targetId ? entities.find(entity => entity.id === action.targetId && entity.active) : null;
    if (action.targetId && !rally) return done('The chosen rally target is missing or disabled.');
    const destination = rally
      ? (getWorldTransform(entities, rally.id) ?? getTransform(rally)).position
      : { x: position.x + Math.sin(heading) * action.settings.distance * 10,
        y: position.y + Math.cos(heading) * action.settings.distance * 10, z: position.z };
    const units = entities.filter(entity =>
      entity.id !== playerId && entity.id !== rally?.id && entity.active &&
      entity.components.some(component => component.type === 'characterController' && component.enabled && component.role === 'npc'),
    ).map(entity => ({ entity, position: (getWorldTransform(entities, entity.id) ?? getTransform(entity)).position }))
      .filter(item => Math.hypot(item.position.x - position.x, item.position.y - position.y) <= action.settings.radius * 10)
      .sort((a, b) => Math.hypot(a.position.x - position.x, a.position.y - position.y) - Math.hypot(b.position.x - position.x, b.position.y - position.y))
      .slice(0, 64);
    if (!units.length) return done('No NPC units nearby. Give your units an NPC Controller first.');
    units.forEach(({ entity }, index) => orders.set(entity.id, {
      ...destination, x: destination.x + (index % 4) * 12, y: destination.y + Math.floor(index / 4) * 12,
    }));
    return done(`Ordered ${units.length} unit${units.length === 1 ? '' : 's'} to move and hold at the rally point.`, true, entities, destination);
  }
  return { handled: false, entities };
}
