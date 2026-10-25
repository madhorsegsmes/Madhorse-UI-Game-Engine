import { MADHORSE_ENGINE_BUILD_GUIDE } from './engine-build-guide';
import type { MadHorseSystemReference } from '@workspace/api-zod';

type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly unknown[]
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T extends object
      ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
      : T;

function deepFreeze<T>(value: T): DeepReadonly<T> {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(child => deepFreeze(child));
  }
  return value as DeepReadonly<T>;
}

/**
 * System-owned feature reference for builders and help. This is code-defined,
 * deeply frozen, server-served by GET only, and never mixed into saved projects.
 */
const engineSystemReferenceDefinition = {
  version: 1,
  title: 'Madhorse Engine System Reference',
  policy: 'Read-only system knowledge. Users may copy defaults into projects and edit their own project data; this library has no user write path.',
  renderer: {
    name: 'Three.js through React Three Fiber',
    target: 'WebGL 2',
    qualityDefault: 'high',
    deviceTarget: 'Gaming PCs, with high-quality graphics by default.',
    fallback: 'When WebGL 2 cannot initialize, preserve editor tools and show the software scene preview.',
  },
  systems: [
    { id: 'projects', name: 'Project data and ownership', summary: 'Projects, scene rules, assets, and saved work stay separate from protected engine reference data.' },
    { id: 'scene', name: '3D scene and hierarchy', summary: 'Editable scene entities, transforms, parent-child hierarchy, cameras, lights, primitives, and project asset references.' },
    { id: 'geometry', name: 'Geometry and modeling', summary: 'Editable primitives, terrain, model import, and the in-editor modeling workflow; image plans are guides, not automatic exact mesh reconstruction.' },
    { id: 'world-building', name: 'World building', summary: 'Terrain authoring tools cover surface shaping and world elements such as water and trees; creations remain project-editable.' },
    { id: 'materials', name: 'Physically based materials', summary: 'Reusable PBR assets support base color, normal, roughness, metalness, ambient occlusion, and emissive maps plus editable material factors.' },
    { id: 'asset-exchange', name: 'Asset import and exchange', summary: 'Supported 3D model formats include GLB/glTF, FBX, OBJ, and DAE; PBR texture maps are PNG, JPEG, or WebP, with Madhorse .mhpbr.json settings.' },
    { id: 'game-types', name: 'Game-type library', summary: 'Read-only system guidance covers genre loops, required systems, project build paths, and testing notes; game rules made by users belong to their projects.' },
    { id: 'characters', name: 'Characters and creatures', summary: 'Reference guidance covers proportions, anatomy, editable parts, styles, races, clothing, and asset reuse; generated plans must not claim unsupported game behavior.' },
    { id: 'animation', name: 'Animation and timelines', summary: 'Scene animation authoring and animation-controller references are available; saved project animation data stays editable by its owner.' },
    { id: 'physics', name: 'Physics and collisions', summary: 'Scene physics settings and supported colliders/rigidbody behaviors are project data; system guidance must distinguish working components from concepts only.' },
    { id: 'controls', name: 'Player and game controls', summary: 'Game, player, and NPC function presets are attached to project objects and remain editable in that project.' },
    { id: 'user-interface', name: 'Game UI', summary: 'UI canvases and editable screen controls can be authored as project content and tuned for the selected game type.' },
    { id: 'scripts', name: 'Scripting', summary: 'Imported scripts remain data unless run by an explicitly isolated supported runtime; never claim unsupported languages execute.' },
    { id: 'audio', name: 'Game audio', summary: 'Audio clips and playback settings are project assets and can be assigned to supported audio components.' },
    { id: 'multiplayer', name: 'Multiplayer', summary: 'Use only implemented room and synchronization limits; do not promise production MMO infrastructure or unimplemented networking features.' },
    { id: 'vision-board', name: 'Vision Board', summary: 'Project vision nodes and their media are authoring data; board content guides a build but does not publish or deploy a game by itself.' },
    { id: 'debugging', name: 'Diagnostics', summary: 'Runtime and editor diagnostics help identify unsupported features and failures; private project data and credentials are never part of this reference.' },
    { id: 'publishing', name: 'Build and publishing targets', summary: 'Describe only targets and export paths currently implemented in Madhorse; distinguish a playable preview from a packaged or deployed game.' },
  ],
} as const satisfies MadHorseSystemReference;

export const MADHORSE_ENGINE_SYSTEM_REFERENCE = deepFreeze(engineSystemReferenceDefinition);

export const MADHORSE_ENGINE_SYSTEM_REFERENCE_PROMPT = [
  'PROTECTED MADHORSE SYSTEM REFERENCE — read-only, system-owned knowledge.',
  JSON.stringify(MADHORSE_ENGINE_SYSTEM_REFERENCE),
  'Follow only capabilities that the current build tools and response schema actually support. Never say a feature was added if you only described it. Saved project data is user-owned and editable; do not store project content or user changes in this reference.',
  'Detailed safe scene construction rules:',
  MADHORSE_ENGINE_BUILD_GUIDE,
].join('\n\n');
