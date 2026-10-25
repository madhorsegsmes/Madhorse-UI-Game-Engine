import { createElement, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { SceneEditorControls, SceneEditorResetControls } from '../../src/components/scene-editor-controls';
import { createStarterCube } from '../../src/lib/scene-model';
import { getSceneEditorFlags, NO_EDITOR_FLAGS, resetSceneEditorFlag, setSceneEditorFlag } from '../../src/lib/scene-editor-state';
import { saveFreshWorkspace, loadFreshWorkspace, removeFreshWorkspace } from '../../src/lib/fresh-workspace-storage';
import { createGameCamera } from '../../src/lib/game-camera';
import '../../src/components/numbered-workspace.css';
const parent = { ...createStarterCube(), id: 'editor-fixture-parent', name: 'Environment' };
const child = { ...createStarterCube(), id: 'editor-fixture-child', name: 'Building', parentId: parent.id };
const status = document.getElementById('verification')!;
let latest = [parent, child];
function Controls() {
  const [entities, setEntities] = useState([parent, child]);
  latest = entities;
  const byId = new Map(entities.map(entity => [entity.id, entity]));
  return <aside className="fresh-hierarchy">
    <h2 className="fresh-hierarchy-heading">Hierarchy — actual editor controls</h2>
    <SceneEditorResetControls entities={entities} disabled={false}
      onReset={flag => setEntities(current => resetSceneEditorFlag(current, flag))} />
    {entities.map(entity => <div className="fresh-hierarchy-row-content" key={entity.id}>
      <SceneEditorControls entity={entity} disabled={false}
        inherited={entity.parentId ? getSceneEditorFlags(entity.parentId, byId) : NO_EDITOR_FLAGS}
        onChange={(id, flag, value) => setEntities(current => setSceneEditorFlag(current, id, flag, value))} />
      <span>{entity.name}</span>
    </div>)}
  </aside>;
}
try {
  flushSync(() => createRoot(document.getElementById('root')!).render(createElement(Controls)));
  const button = (label: string) => document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
  flushSync(() => button('Hide Environment in scene view').click());
  if (!latest[0].editor?.hidden || !button('Show Building in scene view').disabled) throw new Error('Parent hiding was not inherited.');
  flushSync(() => button('Lock scene picking for Environment').click());
  if (!latest[0].editor?.pickingLocked || !button('Unlock scene picking for Building').disabled) throw new Error('Parent picking lock was not inherited.');
  const project = `editor-controls-verification-${crypto.randomUUID()}`;
  try {
    saveFreshWorkspace({ entities: latest, camera: createGameCamera(latest), assets: [], animations: [], animationControllers: [],
      builderHistory: [], builderDraft: null, builderDraftRequest: '', builderBuildLogs: [], prefabs: [], uiControls: [], scripts: [] }, project);
    const loaded = loadFreshWorkspace(project);
    if (!loaded.entities?.[0].editor?.hidden || !loaded.entities?.[0].editor?.pickingLocked) throw new Error('Browser storage lost editor state.');
  } finally { removeFreshWorkspace(project); }
  const reset = (prefix: string) => Array.from(document.querySelectorAll('button')).find(item => item.textContent?.startsWith(prefix))!;
  flushSync(() => reset('Show all').click());
  flushSync(() => reset('Unlock all').click());
  if (latest.some(entity => entity.editor?.hidden || entity.editor?.pickingLocked)) throw new Error('Recovery buttons did not clear flags.');
  status.textContent = 'PASS — actual eye/lock buttons, inherited parent state, browser project save/reload, Show all and Unlock all.';
  status.style.color = '#8dffc4';
} catch (error) {
  status.textContent = `FAIL — ${error instanceof Error ? error.message : error}`;
  console.error(error);
}
