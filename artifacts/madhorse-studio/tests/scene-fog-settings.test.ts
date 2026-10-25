import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SCENE_RENDER_SETTINGS,
  normalizeSceneRenderSettings,
} from '../src/hooks/use-scene-render-settings';
import { createGameCamera } from '../src/lib/game-camera';
import { createStarterCube } from '../src/lib/scene-model';
import type { FreshWorkspaceSnapshot } from '../src/lib/fresh-workspace-storage';
import { createWebGameData, isWebGameData } from '../src/lib/web-game-format';

test('old render preferences receive safe disabled-fog defaults', () => {
  const settings = normalizeSceneRenderSettings({ quality: 'high', background: '#20242a' });
  assert.equal(settings.fogEnabled, false);
  assert.equal(settings.fogMode, 'linear');
  assert.equal(settings.fogNear, 25);
  assert.equal(settings.fogFar, 180);
  assert.match(settings.fogColor, /^#[\da-f]{6}$/i);
});

test('fog settings clamp ranges and keep the linear end beyond the start', () => {
  const settings = normalizeSceneRenderSettings({
    fogEnabled: true, fogMode: 'exponential', fogNear: 900, fogFar: -40, fogDensity: 0.8,
    fogColor: '#abcdef',
  });
  assert.equal(settings.fogEnabled, true);
  assert.equal(settings.fogMode, 'exponential');
  assert.equal(settings.fogNear, 500);
  assert.equal(settings.fogFar, 501);
  assert.equal(settings.fogDensity, 0.1);
  assert.equal(settings.fogColor, '#abcdef');
});

test('web-game exports preserve normalized fog options', () => {
  const entities = [createStarterCube()];
  const snapshot = {
    entities,
    camera: createGameCamera(entities),
    assets: [],
    animations: [],
    animationControllers: [],
    builderHistory: [],
    builderDraft: null,
    builderDraftRequest: '',
    builderBuildLogs: [],
    prefabs: [],
    uiControls: [],
    scripts: [],
  } satisfies FreshWorkspaceSnapshot;
  const fog = normalizeSceneRenderSettings({
    ...DEFAULT_SCENE_RENDER_SETTINGS,
    fogEnabled: true,
    fogMode: 'exponential',
    fogColor: '#53647b',
    fogDensity: 0.032,
  });
  const game = createWebGameData('Fog test', snapshot, fog);
  assert.equal(isWebGameData(game), true);
  assert.equal(game.renderSettings.fogEnabled, true);
  assert.equal(game.renderSettings.fogMode, 'exponential');
  assert.equal(game.renderSettings.fogColor, '#53647b');
  assert.equal(game.renderSettings.fogDensity, 0.032);
});
