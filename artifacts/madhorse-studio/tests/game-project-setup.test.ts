import test from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultGameProjectSetup,
  gameStyleLabels,
  isGameProjectSetup,
  resolveProjectStarter,
} from '../src/lib/game-project-setup';
import { gameProjectStyleOptions } from '../src/lib/game-type-library';
import { createGameCamera } from '../src/lib/game-camera';
import { loadFreshWorkspace, saveFreshWorkspace, type FreshWorkspaceSnapshot } from '../src/lib/fresh-workspace-storage';

test('project setup lists every documented game family and permits mixed styles', () => {
  assert.equal(gameProjectStyleOptions.length, 26);
  const setup = {
    dimension: '3d' as const,
    gameStyles: ['fighting-games', 'sports-games', 'card-and-deckbuilding-games'],
  };
  assert.equal(isGameProjectSetup(setup), true);
  assert.deepEqual(gameStyleLabels(setup.gameStyles), [
    'Fighting games', 'Sports games', 'Card and deckbuilding games',
  ]);
});

test('template choices prefill the questionnaire and still allow a different format', () => {
  assert.deepEqual(defaultGameProjectSetup('2d-rpg'), {
    dimension: '2d',
    gameStyles: ['role-playing-games-rpgs'],
  });
  assert.equal(resolveProjectStarter({
    dimension: '2d',
    gameStyles: ['role-playing-games-rpgs'],
  }, '2d-rpg'), '2d-rpg');
  assert.equal(resolveProjectStarter({
    dimension: '2d',
    gameStyles: ['fighting-games'],
  }, '2d-fighting'), 'blank');
});

test('multi-style project opens the closest available starter for its selected dimension', () => {
  assert.equal(resolveProjectStarter({
    dimension: '3d',
    gameStyles: ['custom-game', 'racing-and-vehicle-games', 'sports-games'],
  }), 'cart-racer');
  assert.equal(resolveProjectStarter({
    dimension: '3d',
    gameStyles: ['real-time-strategy-rts', 'card-and-deckbuilding-games'],
  }), 'rts');
  assert.equal(resolveProjectStarter({
    dimension: '2d',
    gameStyles: ['sports-games'],
  }), 'blank');
});

test('project setup rejects unknown, duplicate, or invalid format data', () => {
  assert.equal(isGameProjectSetup({ dimension: 'vr', gameStyles: ['fighting-games'] }), false);
  assert.equal(isGameProjectSetup({ dimension: '2d', gameStyles: ['not-a-game-style'] }), false);
  assert.equal(isGameProjectSetup({ dimension: '3d', gameStyles: ['fighting-games', 'fighting-games'] }), false);
});

test('chosen format and styles survive a browser-local save and reload', () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const values = new Map<string, string>();
  const localStorageMock = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage: localStorageMock },
  });
  try {
    const setup = {
      dimension: '2d' as const,
      gameStyles: ['role-playing-games-rpgs', 'card-and-deckbuilding-games'],
    };
    const snapshot: FreshWorkspaceSnapshot = {
      projectName: 'Moon Card Quest',
      projectSetup: setup,
      egoGameFlow: 'undecided',
      entities: [],
      camera: createGameCamera([]),
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
    };
    saveFreshWorkspace(snapshot, 'setup-reload-test');
    const reloaded = loadFreshWorkspace('setup-reload-test');
    assert.deepEqual(reloaded.projectSetup, setup);
    assert.equal(reloaded.projectName, 'Moon Card Quest');
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else delete (globalThis as typeof globalThis & { window?: Window }).window;
  }
});
