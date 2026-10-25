import { isGameAnimationCollection, type GameAnimation } from './game-api';
import { isEgoAnimationControllerCollection, type EgoAnimationController } from './ego-animation-controller';
import { isGameCamera, type GameCamera } from './game-camera';
import { isAssetCollection, isSceneGraph, type ProjectAsset, type SceneEntity } from './scene-model';
import { isUIControlCollection, type UIControlElement } from './ui-controls';
import { normalizeSceneRenderSettings, type SceneRenderSettings } from '@/hooks/use-scene-render-settings';
import type { FreshWorkspaceSnapshot } from './fresh-workspace-storage';

export type WebGameData = {
  format: 'madhorse-web-game';
  version: 1;
  name: string;
  entities: SceneEntity[];
  camera: GameCamera;
  assets: ProjectAsset[];
  assetFiles: Record<string, string>;
  animations: GameAnimation[];
  animationControllers: EgoAnimationController[];
  uiControls: UIControlElement[];
  renderSettings: SceneRenderSettings;
  limitations: string[];
};

export function webGameWarnings(snapshot: Pick<FreshWorkspaceSnapshot, 'entities' | 'uiControls'>) {
  const warnings = ['This build plays one scene. Vision Board menus, media, publishing, and scene transitions are not exported.'];
  if (snapshot.entities.some(entity => entity.components.some(component => component.type === 'script' && component.enabled))) {
    warnings.push('Imported scripts will not execute. Built-in game actions and visual trigger logic still run; script source is not included.');
  }
  if (snapshot.entities.some(entity => entity.components.some(component =>
    component.type === 'multiplayerPlugin' && component.enabled))) {
    warnings.push('This is an offline single-player build. Room servers, player accounts, and online persistence are not included.');
  }
  if (snapshot.uiControls.length) {
    warnings.push('Custom UI layout is included. Unbound UI buttons remain display-only; built-in gameplay uses the exported keyboard controls and HUD.');
  }
  return warnings;
}

export function createWebGameData(
  name: string,
  snapshot: FreshWorkspaceSnapshot,
  renderSettings: SceneRenderSettings,
): WebGameData {
  if (!name.trim()) throw new Error('Name the project before exporting a web game.');
  if (!isSceneGraph(snapshot.entities) || !snapshot.entities.some(entity => entity.active)) {
    throw new Error('The scene must contain valid, active objects before exporting.');
  }
  if (snapshot.entities.length > 10_000) throw new Error('This exporter supports up to 10,000 scene objects.');
  if (!isGameCamera(snapshot.camera) || !isAssetCollection(snapshot.assets) ||
      !isGameAnimationCollection(snapshot.animations) ||
      !isEgoAnimationControllerCollection(snapshot.animationControllers) ||
      !isUIControlCollection(snapshot.uiControls)) {
    throw new Error('The project contains invalid camera, asset, animation, or UI data. Fix it before exporting.');
  }
  const entities = structuredClone(snapshot.entities);
  const assetIds = new Set(snapshot.assets.map(asset => asset.id));
  if (assetIds.size !== snapshot.assets.length) throw new Error('The project contains duplicate asset IDs.');
  function validateAssetReferences(value: unknown): void {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if (/assetId$/i.test(key) && typeof child === 'string' && child && !assetIds.has(child)) {
        throw new Error(`An object or material references missing asset “${child}”. Restore the asset or remove that reference before exporting.`);
      }
      if (child && typeof child === 'object') validateAssetReferences(child);
    }
  }
  validateAssetReferences(entities);
  validateAssetReferences(snapshot.assets);
  const assetsById = new Map(snapshot.assets.map(asset => [asset.id, asset]));
  for (const asset of snapshot.assets) {
    if (asset.kind !== 'pbr-material' || !asset.pbrMaterial) continue;
    for (const [slot, id] of Object.entries(asset.pbrMaterial.maps)) {
      if (id && assetsById.get(id)?.kind !== 'image') {
        throw new Error(`Material “${asset.name}” needs a valid image asset for its ${slot} map. Restore or replace that texture before exporting.`);
      }
    }
  }
  for (const entity of entities) {
    for (const component of entity.components) {
      if (component.type === 'script' || component.type === 'multiplayerPlugin') {
        component.enabled = false;
      }
    }
  }
  return {
    format: 'madhorse-web-game', version: 1, name: name.trim().slice(0, 80),
    entities, camera: structuredClone(snapshot.camera), assets: structuredClone(snapshot.assets),
    assetFiles: {}, animations: structuredClone(snapshot.animations),
    animationControllers: structuredClone(snapshot.animationControllers),
    uiControls: structuredClone(snapshot.uiControls),
    renderSettings: normalizeSceneRenderSettings({ ...renderSettings, showGrid: false, showPerformanceStats: false }),
    limitations: webGameWarnings(snapshot),
  };
}

export function isWebGameData(value: unknown): value is WebGameData {
  if (!value || typeof value !== 'object') return false;
  const game = value as WebGameData;
  return game.format === 'madhorse-web-game' && game.version === 1 &&
    typeof game.name === 'string' && game.name.length > 0 && game.name.length <= 80 &&
    Array.isArray(game.entities) && game.entities.length <= 10_000 && isSceneGraph(game.entities) &&
    isGameCamera(game.camera) && isAssetCollection(game.assets) &&
    isGameAnimationCollection(game.animations) && isEgoAnimationControllerCollection(game.animationControllers) &&
    isUIControlCollection(game.uiControls) &&
    !!game.assetFiles && typeof game.assetFiles === 'object' && !Array.isArray(game.assetFiles) &&
    game.assets.every(asset => asset.kind === 'data' || asset.kind === 'pbr-material' ||
      typeof game.assetFiles[asset.id] === 'string' && /^game-assets\/\d{4,6}\.[a-z0-9]{1,10}$/.test(game.assetFiles[asset.id])) &&
    Array.isArray(game.limitations) && game.limitations.every(item => typeof item === 'string');
}
