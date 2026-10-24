import {
  createPhysicsComponent,
  type SceneComponent,
} from './scene-model';
import { createUIControlElement } from './ui-controls';

export type PluginCategory =
  | 'game'
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
  | 'physics'
  | 'camera'
  | 'uiCanvas'
  | 'script'
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
  | 'skybox';

export type ScenePluginDefinition = {
  id: PluginComponentKind | 'open-character-builder' | 'open-animation-timeline';
  label: string;
  description: string;
  componentKind?: PluginComponentKind;
  action?: 'character-builder' | 'animation-timeline';
};

export const scenePluginCatalog: Record<PluginCategory, ScenePluginDefinition[]> = {
  game: [
    { id: 'physics', componentKind: 'physics', label: 'Physics Body', description: 'Adds a collider and dynamic Rigidbody-style movement. Edit mass, gravity, friction, and bounce.' },
    { id: 'uiCanvas', componentKind: 'uiCanvas', label: 'UI Canvas', description: 'Adds an editable UI panel to this object and creates a starter panel control.' },
    { id: 'character-controller-player', componentKind: 'character-controller-player', label: 'Player Controller', description: 'Adds keyboard movement and jumping with safe defaults. Tune speed and jump in object settings.' },
  ],
  'player-npc': [
    { id: 'character-controller-player', componentKind: 'character-controller-player', label: 'Player Controller', description: 'Adds keyboard movement and jumping with safe defaults.' },
    { id: 'character-controller-npc', componentKind: 'character-controller-npc', label: 'NPC Agent', description: 'Adds an NPC that follows the nearest player by default; edit its follow range and speed.' },
    { id: 'script', componentKind: 'script', label: 'Safe Script Slot', description: 'Adds a script attachment. It starts paused until a script is assigned and run in the isolated script tool.' },
  ],
  system: [
    { id: 'physics', componentKind: 'physics', label: 'Physics Body', description: 'Adds collision and a dynamic, static, or kinematic body.' },
    { id: 'camera', componentKind: 'camera', label: 'Camera', description: 'Adds a camera with an editable field of view and look target.' },
    { id: 'script', componentKind: 'script', label: 'Safe Script Slot', description: 'Adds a disabled-by-default script attachment for the isolated script tool.' },
  ],
  lighting: [
    { id: 'light-point', componentKind: 'light-point', label: 'Point Light', description: 'Adds a local light. Edit its color and brightness in object settings.' },
    { id: 'light-directional', componentKind: 'light-directional', label: 'Directional Light', description: 'Adds a sun-style light with editable color and brightness.' },
    { id: 'light-ambient', componentKind: 'light-ambient', label: 'Ambient Light', description: 'Adds a broad fill light with editable color and brightness.' },
  ],
  animation: [
    { id: 'open-animation-timeline', action: 'animation-timeline', label: 'Animation Timeline', description: 'Open the existing timeline to create or preview an animation for the selected object.' },
  ],
  asset: [
    { id: 'spriteRenderer', componentKind: 'spriteRenderer', label: '2D Sprite Renderer', description: 'Adds an editable sprite renderer; assign an image asset in object settings.' },
    { id: 'modelRenderer', componentKind: 'modelRenderer', label: '3D Model Renderer', description: 'Adds an editable model renderer; assign an imported model in object settings.' },
  ],
  effect: [
    { id: 'effect', componentKind: 'effect', label: 'Particle Effect', description: 'Adds the built-in effect renderer with editable color and intensity.' },
  ],
  triggers: [
    { id: 'trigger-event', componentKind: 'trigger-event', label: 'Enter Trigger', description: 'Detects a player entering this object’s trigger volume and runs a simple event.' },
  ],
  'trigger-zones': [
    { id: 'trigger-zone-box', componentKind: 'trigger-zone-box', label: 'Box Trigger Zone', description: 'Adds an editable box-shaped zone with enter actions.' },
    { id: 'trigger-zone-sphere', componentKind: 'trigger-zone-sphere', label: 'Sphere Trigger Zone', description: 'Adds an editable sphere-shaped zone with enter actions.' },
  ],
  skybox: [
    { id: 'skybox', componentKind: 'skybox', label: 'Skybox Background', description: 'Sets the scene-wide background color. Add it to an object, then edit the color in object settings.' },
  ],
  'character-builder': [
    { id: 'open-character-builder', action: 'character-builder', label: 'Open Character Builder', description: 'Open the rigged character modeling and animation workspace.' },
  ],
  'behavior-builder': [
    { id: 'character-controller-npc', componentKind: 'character-controller-npc', label: 'Follow Player', description: 'Adds a ready NPC follow behavior with editable speed and stopping distance.' },
    { id: 'character-controller-patrol', componentKind: 'character-controller-patrol', label: 'Patrol Behavior', description: 'Adds a ready patrol behavior with an editable patrol radius.' },
  ],
  script: [
    { id: 'script', componentKind: 'script', label: 'Safe Script Slot', description: 'Attach a script slot to this object. Execution remains isolated and disabled until configured.' },
  ],
  'third-person-character': [
    { id: 'character-controller-third-person', componentKind: 'character-controller-third-person', label: 'Third-Person Controller', description: 'Adds keyboard movement, jumping, and a camera that follows behind the character.' },
  ],
};

export function createPluginComponent(
  kind: PluginComponentKind,
  uiControlCount: number,
): { component: SceneComponent; uiControl?: ReturnType<typeof createUIControlElement> } {
  const id = crypto.randomUUID();
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
    physics: 'physics',
    camera: 'camera',
    uiCanvas: 'uiCanvas',
    script: 'script',
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
  };
  return identity[kind];
}
