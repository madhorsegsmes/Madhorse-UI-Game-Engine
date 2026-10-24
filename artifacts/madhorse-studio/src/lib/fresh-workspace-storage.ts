import { isGameAnimationCollection, type GameAnimation } from './game-api';
import { isGameCamera, type GameCamera } from './game-camera';
import { isAssetCollection, isSceneGraph, type ProjectAsset, type SceneEntity } from './scene-model';
import { isBuilderDraft, isBuilderHistory } from './mad-builder';
import { isMadBuilderBuildLogs, type MadBuilderBuildLog } from './mad-builder-build-log';
import type { MadBuilderPlan } from '@workspace/api-client-react';
import type { BuilderMessage } from '@/components/mad-builder-contract';
import { isPrefabCollection, type ScenePrefab } from './scene-authoring';
import { isUIControlCollection, type UIControlElement } from './ui-controls';
import { isScriptFileCollection, type ScriptFile } from './project-scripts';

export const FRESH_WORKSPACE_ID = 'madhorse-studio-fresh-workspace';
const storageKey = 'madhorse-studio:fresh-workspace:v1';

export type FreshWorkspaceSnapshot = {
  entities: SceneEntity[];
  camera: GameCamera;
  assets: ProjectAsset[];
  animations: GameAnimation[];
  builderHistory: BuilderMessage[];
  builderDraft: MadBuilderPlan | null;
  builderDraftRequest: string;
  builderBuildLogs: MadBuilderBuildLog[];
  prefabs: ScenePrefab[];
  uiControls: UIControlElement[];
  scripts: ScriptFile[];
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
      ...(isBuilderHistory(value.builderHistory) ? { builderHistory: value.builderHistory } : {}),
      ...(value.builderDraft !== undefined && isBuilderDraft(value.builderDraft) ? { builderDraft: value.builderDraft } : {}),
      ...(typeof value.builderDraftRequest === 'string' ? { builderDraftRequest: value.builderDraftRequest } : {}),
      ...(isMadBuilderBuildLogs(value.builderBuildLogs) ? { builderBuildLogs: value.builderBuildLogs } : {}),
      ...(Array.isArray(value.prefabs) && isPrefabCollection(value.prefabs) ? { prefabs: value.prefabs } : {}),
      ...(Array.isArray(value.uiControls) && isUIControlCollection(value.uiControls) ? { uiControls: value.uiControls } : {}),
      ...(isScriptFileCollection(value.scripts) ? { scripts: value.scripts } : {}),
    };
  } catch {
    return {};
  }
}

export function saveFreshWorkspace(snapshot: FreshWorkspaceSnapshot) {
  window.localStorage.setItem(storageKey, JSON.stringify(snapshot));
}
