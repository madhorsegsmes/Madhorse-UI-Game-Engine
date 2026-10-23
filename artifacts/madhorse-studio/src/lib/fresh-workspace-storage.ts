import { isGameAnimationCollection, type GameAnimation } from './game-api';
import { isGameCamera, type GameCamera } from './game-camera';
import { isAssetCollection, isSceneGraph, type ProjectAsset, type SceneEntity } from './scene-model';

export const FRESH_WORKSPACE_ID = 'madhorse-studio-fresh-workspace';
const storageKey = 'madhorse-studio:fresh-workspace:v1';

export type FreshWorkspaceSnapshot = {
  entities: SceneEntity[];
  camera: GameCamera;
  assets: ProjectAsset[];
  animations: GameAnimation[];
};

export function loadFreshWorkspace(): Partial<FreshWorkspaceSnapshot> {
  if (typeof window === 'undefined') return {};
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) return {};
    const value = JSON.parse(stored) as Partial<FreshWorkspaceSnapshot>;
    return {
      ...(Array.isArray(value.entities) && isSceneGraph(value.entities) ? { entities: value.entities } : {}),
      ...(isGameCamera(value.camera) ? { camera: value.camera } : {}),
      ...(Array.isArray(value.assets) && isAssetCollection(value.assets) ? { assets: value.assets } : {}),
      ...(Array.isArray(value.animations) && isGameAnimationCollection(value.animations) ? { animations: value.animations } : {}),
    };
  } catch {
    return {};
  }
}

export function saveFreshWorkspace(snapshot: FreshWorkspaceSnapshot) {
  window.localStorage.setItem(storageKey, JSON.stringify(snapshot));
}
