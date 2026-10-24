import {
  createPhysicsComponent,
  type SceneComponent,
} from './scene-model';
import { createUIControlElement } from './ui-controls';
import { createPlayerAction, playerActionDefinitions, playerActionNames, type PlayerActionName } from './player-action-model';
import { createGameFeature, gameFeatureDefinitions, gameFeatureNames, type GameFeatureName } from './game-feature-model';

export type PluginCategory =
  | 'game'
  | 'game-mechanics'
  | 'multiplayer'
  | 'player-npc'
  | 'system'
  | 'lighting'
  | 'animation'
  | 'asset'
  | 'effect'
  | 'triggers'
  | 'trigger-zones'
  | 'skybox'
  | 'character-builder'
  | 'behavior-builder'
  | 'script'
  | 'third-person-character';

export type PluginComponentKind =
  | `action-${PlayerActionName}`
  | `feature-${GameFeatureName}`
  | 'physics'
  | 'camera'
  | 'uiCanvas'
  | 'script'
  | 'game-audio'
  | 'player-walk-audio'
  | 'light-point'
  | 'light-directional'
  | 'light-ambient'
  | 'spriteRenderer'
  | 'modelRenderer'
  | 'effect'
  | 'character-controller-player'
  | 'character-controller-npc'
  | 'character-controller-patrol'
  | 'character-controller-third-person'
  | 'trigger-event'
  | 'trigger-zone-box'
  | 'trigger-zone-sphere'
  | 'skybox'
  | 'multiplayer-player'
  | 'multiplayer-object'
  | 'multiplayer-event';

export type ScenePluginDefinition = {
  id: PluginComponentKind | 'open-character-builder' | 'open-animation-timeline' | 'create-scriptable-object';
  label: string;
  description: string;
  componentKind?: PluginComponentKind;
  action?: 'character-builder' | 'animation-timeline' | 'create-scriptable-object';
};

const playerActionPlugins: ScenePluginDefinition[] = playerActionNames.map(action => ({
  id: `action-${action}`, componentKind: `action-${action}`,
  label: `${playerActionDefinitions[action].label} + Sound`,
  description: playerActionDefinitions[action].help,
}));
const featurePlugin = (name: GameFeatureName): ScenePluginDefinition => ({
  id: `feature-${name}`, componentKind: `feature-${name}`,
  label: gameFeatureDefinitions[name].label, description: gameFeatureDefinitions[name].help,
});

export const scenePluginCatalog: Record<PluginCategory, ScenePluginDefinition[]> = {
  game: [
    ...(['pickup', 'door', 'checkpoint'] as const).map(featurePlugin),
    featurePlugin('inventory'),
    ...playerActionPlugins.filter(entry => ['action-race', 'action-craft', 'action-build'].includes(entry.id)),
    { id: 'game-audio', componentKind: 'game-audio', label: 'Game Audio', description: 'Add a sound source. Pick a clip, set its loudness, and test it in Settings.' },
    { id: 'physics', componentKind: 'physics', label: 'Physics Body', description: 'Set how this object bumps, falls, and bounces. Change its settings on the object.' },
    { id: 'uiCanvas', componentKind: 'uiCanvas', label: 'UI Canvas', description: 'Add a blank screen panel for menus and buttons.' },
    { id: 'character-controller-player', componentKind: 'character-controller-player', label: 'Player Controller', description: 'Add walking and jumping. Use W, A, S, D or arrows; press Space to jump.' },
  ],
  'game-mechanics': [],
  multiplayer: [
    {
      id: 'multiplayer-player',
      componentKind: 'multiplayer-player',
      label: 'Network Player',
      description: 'Share this player’s movement with everyone in the session.',
    },
    {
      id: 'multiplayer-object',
      componentKind: 'multiplayer-object',
      label: 'Sync Object',
      description: 'Share this object’s position and rotation with everyone in the session.',
    },
    {
      id: 'multiplayer-event',
      componentKind: 'multiplayer-event',
      label: 'Game Event',
      description: 'Mark this object as a source of messages that all players can receive.',
    },
  ],
  'player-npc': [
    ...(['health', 'inventory', 'interact'] as const).map(featurePlugin),
    ...playerActionPlugins,
    { id: 'player-walk-audio', componentKind: 'player-walk-audio', label: 'Player Walk Audio', description: 'Play a footstep when the player walks in Play Test. Pick a clip or use the built-in thump.' },
    { id: 'character-controller-player', componentKind: 'character-controller-player', label: 'Player Controller', description: 'Add walking and jumping to the player.' },
    { id: 'character-controller-npc', componentKind: 'character-controller-npc', label: 'NPC Agent', description: 'Make this helper walk toward the player. Change its speed in Settings.' },
    { id: 'script', componentKind: 'script', label: 'Safe Script Slot', description: 'Keep a code file on this object. It stays off until you run it safely.' },
  ],
  system: [
    featurePlugin('status-bar'),
    { id: 'physics', componentKind: 'physics', label: 'Physics Body', description: 'Set this object’s collision, weight, gravity, and bounce.' },
    { id: 'camera', componentKind: 'camera', label: 'Camera', description: 'Add a view. Choose what it looks at in Settings.' },
    { id: 'script', componentKind: 'script', label: 'Safe Script Slot', description: 'Keep a code file here. It starts turned off and runs in a safe box.' },
  ],
  lighting: [
    { id: 'light-point', componentKind: 'light-point', label: 'Lamp', description: 'Add a light in one spot. Change its color and brightness.' },
    { id: 'light-directional', componentKind: 'light-directional', label: 'Sun Light', description: 'Light the whole scene like the sun.' },
    { id: 'light-ambient', componentKind: 'light-ambient', label: 'Soft Fill Light', description: 'Add gentle light across the scene.' },
  ],
  animation: [
    { id: 'open-animation-timeline', action: 'animation-timeline', label: 'Make it move', description: 'Open the timeline to make or preview an object’s movement.' },
  ],
  asset: [
    {
      id: 'create-scriptable-object',
      action: 'create-scriptable-object',
      label: 'Create Scriptable Object',
      description: 'Make a reusable data asset with editable text, numbers, and on/off values. Saved with this project.',
    },
    { id: 'spriteRenderer', componentKind: 'spriteRenderer', label: 'Show a 2D picture', description: 'Put an imported picture on this object.' },
    { id: 'modelRenderer', componentKind: 'modelRenderer', label: 'Show a 3D model', description: 'Put an imported 3D model on this object.' },
  ],
  effect: [
    featurePlugin('visual-effect'),
    { id: 'effect', componentKind: 'effect', label: 'Color Effect', description: 'Set an effect color and strength for this object.' },
  ],
  triggers: [
    featurePlugin('message'),
    { id: 'trigger-event', componentKind: 'trigger-event', label: 'When player enters', description: 'Show a message when the player touches this object.' },
  ],
  'trigger-zones': [
    { id: 'trigger-zone-box', componentKind: 'trigger-zone-box', label: 'Box-shaped zone', description: 'Make a box area that can notice when the player enters.' },
    { id: 'trigger-zone-sphere', componentKind: 'trigger-zone-sphere', label: 'Round zone', description: 'Make a round area that can notice when the player enters.' },
  ],
  skybox: [
    { id: 'skybox', componentKind: 'skybox', label: 'Sky Background', description: 'Choose the color behind everything in the scene.' },
  ],
  'character-builder': [
    { id: 'open-character-builder', action: 'character-builder', label: 'Build a character', description: 'Open the tools for making a person and its movements.' },
  ],
  'behavior-builder': [
    { id: 'character-controller-npc', componentKind: 'character-controller-npc', label: 'Follow the player', description: 'Make a helper walk toward the player.' },
    { id: 'character-controller-patrol', componentKind: 'character-controller-patrol', label: 'Walk around', description: 'Make a helper walk back and forth near its starting place.' },
  ],
  script: [
    { id: 'script', componentKind: 'script', label: 'Safe Script Slot', description: 'Keep code on this object. It starts off and only runs in a safe box.' },
  ],
  'third-person-character': [
    { id: 'character-controller-third-person', componentKind: 'character-controller-third-person', label: 'Follow-behind player', description: 'Add walking, jumping, and a camera that follows behind.' },
  ],
};

export function createPluginComponent(
  kind: PluginComponentKind,
  uiControlCount: number,
): { component: SceneComponent; uiControl?: ReturnType<typeof createUIControlElement> } {
  if (kind.startsWith('feature-')) {
    return { component: createGameFeature(kind.slice(8) as GameFeatureName) };
  }
  if (kind.startsWith('action-')) {
    return { component: createPlayerAction(kind.slice(7) as PlayerActionName) };
  }
  const id = crypto.randomUUID();
  if (kind === 'multiplayer-player' || kind === 'multiplayer-object' || kind === 'multiplayer-event') {
    return {
      component: {
        id,
        type: 'multiplayerPlugin',
        enabled: true,
        mode: kind === 'multiplayer-player' ? 'player' : kind === 'multiplayer-object' ? 'object' : 'event',
        eventName: kind === 'multiplayer-event' ? 'game.event' : '',
      },
    };
  }
  if (kind === 'physics') {
    const component = createPhysicsComponent();
    component.size = { x: 10, y: 10, z: 10 };
    return { component };
  }
  if (kind === 'camera') {
    return {
      component: { id, type: 'camera', enabled: true, fov: 60, target: { x: 0, y: 0, z: 0 }, useTransformRotation: false },
    };
  }
  if (kind === 'uiCanvas') {
    const uiControl = createUIControlElement('panel', uiControlCount);
    return {
      component: { id, type: 'uiCanvas', enabled: true, controlId: uiControl.id, kind: 'panel', frame: true },
      uiControl,
    };
  }
  if (kind === 'script') {
    return { component: { id, type: 'script', enabled: false, scriptId: crypto.randomUUID() } };
  }
  if (kind === 'game-audio') {
    return {
      component: {
        id,
        type: 'gameAudio',
        enabled: true,
        clipAssetId: null,
        volume: 0.5,
        pitch: 1,
        playOnStart: false,
      },
    };
  }
  if (kind === 'player-walk-audio') {
    return {
      component: {
        id,
        type: 'playerWalkAudio',
        enabled: true,
        clipAssetId: null,
        volume: 0.28,
        pitch: 1,
        stepInterval: 0.38,
      },
    };
  }
  if (kind === 'light-point' || kind === 'light-directional' || kind === 'light-ambient') {
    const lightKind = kind.slice('light-'.length) as 'point' | 'directional' | 'ambient';
    return { component: { id, type: 'light', enabled: true, kind: lightKind, color: '#ffffff', intensity: 1 } };
  }
  if (kind === 'spriteRenderer') {
    return { component: { id, type: 'spriteRenderer', enabled: true, assetId: null, tint: '#ffffff', width: 100, height: 100 } };
  }
  if (kind === 'modelRenderer') {
    return { component: { id, type: 'modelRenderer', enabled: true, assetId: null } };
  }
  if (kind === 'character-controller-player' || kind === 'character-controller-third-person') {
    return {
      component: {
        id,
        type: 'characterController',
        enabled: true,
        role: 'player',
        perspective: kind === 'character-controller-third-person' ? 'third-person' : 'top-down',
        behavior: 'direct-control',
        moveSpeed: 5,
        jumpHeight: 1.2,
        followDistance: 5,
        patrolRadius: 4,
      },
    };
  }
  if (kind === 'character-controller-npc' || kind === 'character-controller-patrol') {
    return {
      component: {
        id,
        type: 'characterController',
        enabled: true,
        role: 'npc',
        perspective: 'top-down',
        behavior: kind === 'character-controller-patrol' ? 'patrol' : 'follow-player',
        moveSpeed: 3,
        jumpHeight: 0,
        followDistance: 1.5,
        patrolRadius: 4,
      },
    };
  }
  if (kind === 'trigger-event' || kind === 'trigger-zone-box' || kind === 'trigger-zone-sphere') {
    return {
      component: {
        id,
        type: 'triggerZone',
        enabled: true,
        shape: kind === 'trigger-zone-sphere' ? 'sphere' : 'box',
        size: { x: 2, y: 2, z: 2 },
        action: 'notify',
        targetEntityId: null,
        message: 'Trigger entered',
      },
    };
  }
  if (kind === 'skybox') {
    return { component: { id, type: 'skybox', enabled: true, color: '#252a35' } };
  }
  return { component: { id, type: 'effect', enabled: true, color: '#d676ff', intensity: 1 } };
}

export function getPluginComponentIdentity(kind: PluginComponentKind): SceneComponent['type'] {
  const identity: Record<PluginComponentKind, SceneComponent['type']> = {
    ...Object.fromEntries(gameFeatureNames.map(name => [`feature-${name}`, 'gameFeature' as const])) as Record<`feature-${GameFeatureName}`, SceneComponent['type']>,
    'action-run': 'playerAction',
    'action-crouch': 'playerAction',
    'action-fight': 'playerAction',
    'action-shoot': 'playerAction',
    'action-race': 'playerAction',
    'action-craft': 'playerAction',
    'action-build': 'playerAction',
    'action-block': 'playerAction',
    'action-heal': 'playerAction',
    'action-cast': 'playerAction',
    'action-draw-card': 'playerAction',
    'action-play-card': 'playerAction',
    'action-end-turn': 'playerAction',
    'action-command': 'playerAction',
    'action-gather': 'playerAction',
    'action-follow': 'playerAction',
    'action-reload': 'playerAction',
    physics: 'physics',
    camera: 'camera',
    uiCanvas: 'uiCanvas',
    script: 'script',
    'game-audio': 'gameAudio',
    'player-walk-audio': 'playerWalkAudio',
    'light-point': 'light',
    'light-directional': 'light',
    'light-ambient': 'light',
    spriteRenderer: 'spriteRenderer',
    modelRenderer: 'modelRenderer',
    effect: 'effect',
    'character-controller-player': 'characterController',
    'character-controller-npc': 'characterController',
    'character-controller-patrol': 'characterController',
    'character-controller-third-person': 'characterController',
    'trigger-event': 'triggerZone',
    'trigger-zone-box': 'triggerZone',
    'trigger-zone-sphere': 'triggerZone',
    skybox: 'skybox',
    'multiplayer-player': 'multiplayerPlugin',
    'multiplayer-object': 'multiplayerPlugin',
    'multiplayer-event': 'multiplayerPlugin',
  };
  return identity[kind];
}

export function matchesPluginComponent(component: SceneComponent, kind: PluginComponentKind): boolean {
  if (kind.startsWith('feature-')) return component.type === 'gameFeature' && component.kind === kind.slice(8);
  if (kind.startsWith('action-')) return component.type === 'playerAction' && component.action === kind.slice(7);
  if (kind.startsWith('multiplayer-')) {
    const mode = kind === 'multiplayer-player' ? 'player' : kind === 'multiplayer-object' ? 'object' : 'event';
    return component.type === 'multiplayerPlugin' && component.mode === mode;
  }
  return component.type === getPluginComponentIdentity(kind);
}
