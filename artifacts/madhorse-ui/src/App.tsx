import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { ScriptRunner, type ScriptRunnerHandle, type ScriptRunnerState } from '@/components/script-runner';
import './components/workspace-layout.css';
import { WorkspaceBrowserMenus } from '@/components/workspace-browser-menus';
import { SystemPanelTools } from '@/components/system-panel-tools';
import { SystemStatus } from '@/components/system-status';
import { withSystemActivity } from '@/lib/system-activity';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { GameScene } from '@/components/game-scene';
import { cameraForEntity, createGameCamera, isGameCamera, type GameCamera } from '@/lib/game-camera';
import { isPrefabCollection, type ScenePrefab } from '@/lib/scene-authoring';
import { useSceneAuthoring } from '@/hooks/use-scene-authoring';
import { HierarchyCreationTools } from '@/components/hierarchy-creation-tools';
import {
  initialGamePosition,
  isGameAnimationCollection,
  isGamePosition,
  sampleGameAnimation,
  type GameAnimation,
  type GamePosition,
} from '@/lib/game-api';
import { ScriptCreate } from '@/components/script-create';
import { scriptLanguages, maxScriptSize, maxProjectScriptsSize, movementStarter, scriptStorageError, sourceSize, type ScriptFile } from '@/lib/project-scripts';
import { loadActiveProjectId, projectStorageKey, saveProjectSnapshotNow, useProjectAutosave } from '@/hooks/use-project-autosave';
import { createUIControlElement, isUIControlCollection, type UIControlElement, type UIControlType } from '@/lib/ui-controls';
import { useSceneEditor } from '@/hooks/use-scene-editor';
import {
  createDefaultPlayer,
  getWorldTransform,
  isAssetCollection,
  isSceneGraph,
  type TransformComponent,
  type ProjectAsset,
  type SceneEntity,
} from '@/lib/scene-model';

const queryClient = new QueryClient();
let savedProjectsWarning = '';
const gameTypes = ['RTS', 'RPG', 'MMO', 'Arena Fighting', 'Card Game', 'Sport Game'] as const;
type Project = {
  id: string;
  name: string;
  gameType: string;
  savedAt: string;
  scripts?: ScriptFile[];
  entities: SceneEntity[];
  assets: ProjectAsset[];
  animations?: GameAnimation[];
  uiControls?: UIControlElement[];
  initialPosition?: GamePosition;
  gameCamera?: GameCamera;
  prefabs?: ScenePrefab[];
  activeCameraId?: string | null;
};

function isSavedScript(script: unknown): script is ScriptFile {
  if (!script || typeof script !== 'object') return false;
  const value = script as ScriptFile;
  return typeof value.id === 'string' && typeof value.name === 'string' &&
    typeof value.language === 'string' && typeof value.content === 'string' &&
    Number.isFinite(value.size) && value.size >= 0;
}

function isSavedProject(project: unknown): project is Project {
  if (!project || typeof project !== 'object') return false;
  const value = project as Project;
  return typeof value.id === 'string' && typeof value.name === 'string' &&
    typeof value.gameType === 'string' && typeof value.savedAt === 'string' &&
    (value.scripts === undefined || (
      Array.isArray(value.scripts) && value.scripts.every(isSavedScript)
    )) &&
    (value.entities === undefined || Array.isArray(value.entities) && isSceneGraph(value.entities)) &&
    (value.assets === undefined || Array.isArray(value.assets) && isAssetCollection(value.assets)) &&
    (value.animations === undefined || isGameAnimationCollection(value.animations)) &&
    (value.uiControls === undefined || isUIControlCollection(value.uiControls)) &&
    (value.gameCamera === undefined || isGameCamera(value.gameCamera)) &&
    (value.prefabs === undefined || isPrefabCollection(value.prefabs)) &&
    (value.activeCameraId === undefined || value.activeCameraId === null || typeof value.activeCameraId === 'string');
}

function loadProjects(): { projects: Project[]; canOverwrite: boolean; warning: string } {
  savedProjectsWarning = '';
  try {
    const stored = localStorage.getItem(projectStorageKey);
    if (stored === null) {
      return {
        projects: [{
          id: crypto.randomUUID(), name: 'Untitled Project', gameType: '', savedAt: '', scripts: [],
          entities: [createDefaultPlayer()], assets: [], animations: [], uiControls: [], gameCamera: createGameCamera([]),
        }],
        canOverwrite: true,
        warning: '',
      };
    }
    const projects: unknown = JSON.parse(stored);
    if (Array.isArray(projects) && projects.length > 0 && projects.every(isSavedProject)) {
      return {
        projects: projects.map((project) => ({
          ...project,
          // Entity transforms own the saved start. Migrate starts saved before
          // the scene editor existed without overriding its newer transforms.
          entities: project.entities ?? [{
            ...createDefaultPlayer(),
            components: createDefaultPlayer().components.map((component) =>
              component.type === 'transform' && isGamePosition(project.initialPosition)
                ? { ...component, position: { ...component.position, ...project.initialPosition } }
                : component),
          }],
          assets: project.assets ?? [],
          animations: project.animations ?? [],
          uiControls: project.uiControls ?? [],
        })).map((project) => ({
          ...project,
          gameCamera: project.gameCamera?.placement ? project.gameCamera : createGameCamera(project.entities),
        })),
        canOverwrite: true,
        warning: '',
      };
    }
    savedProjectsWarning = 'Saved projects could not be read. Existing browser data has been left untouched.';
  } catch {
    savedProjectsWarning = 'Saved projects could not be read. Existing browser data has been left untouched.';
  }
  return {
    projects: [{
      id: crypto.randomUUID(), name: 'Untitled Project', gameType: '', savedAt: '', scripts: [],
      entities: [createDefaultPlayer()], assets: [], animations: [], uiControls: [], gameCamera: createGameCamera([]),
    }],
    canOverwrite: false,
    warning: savedProjectsWarning,
  };
}

function getPlayerStartPosition(project: Pick<Project, 'entities'>): GamePosition {
  const world = getWorldTransform(project.entities, 'player');
  if (!world || !Number.isFinite(world.position.x) || !Number.isFinite(world.position.y)) {
    return { ...initialGamePosition };
  }
  return { x: world.position.x, y: world.position.y };
}

function applyAnimationPreview(
  entities: SceneEntity[],
  animation: GameAnimation,
  time: number,
): SceneEntity[] {
  const targetId = animation.targetEntityId;
  if (!entities.some((entity) => entity.id === targetId)) return entities;
  const frame = sampleGameAnimation(animation, time);
  return entities.map((entity) => {
    if (entity.id !== targetId) return entity;
    return {
      ...entity,
      components: entity.components.map((component) => {
        if (component.type !== 'transform') return component;
        const transform: TransformComponent = {
          ...component,
          position: { ...frame.position },
          rotation: { ...frame.rotation },
          scale: {
            x: component.scale.x * frame.scale,
            y: component.scale.y * frame.scale,
            z: component.scale.z * frame.scale,
          },
        };
        return transform;
      }),
    };
  });
}

function HorseMark() {
  return (
    <svg
      className="brand-mark"
      viewBox="0 0 48 48"
      fill="none"
      role="img"
      aria-labelledby="horse-mark-title"
    >
      <title id="horse-mark-title">A fire horse encircling a flame</title>
      <circle cx="24" cy="24" r="11.5" stroke="currentColor" strokeWidth="1.35" />
      <path
        d="M24 17c1.8 3-.3 4.1 1.2 6.2 1.1 1.4 3.4 2 2.6 4.6-.6 2-2.7 3.1-4.8 2.4-2.5-.8-3.2-3.3-1.8-5.3.8-1.2 1.9-1.9 1.8-3.8-.1-1.4.3-2.7 1-4.1Z"
        fill="currentColor"
      />
      <path
        d="M12.4 20.2c1.4-7.2 7.8-12.4 15.5-12.4 8.8 0 15.9 7.1 15.9 15.9 0 7.2-4.8 13.3-11.4 15.2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="m13.2 17.8 1.1-5.1 4.1 2.7 3.5-5.6 2.2 4.1 4.1-1.2 3.4 3.9 4.4 1.3 2.2 4.1-2.2 2.2-4.4.2-1.7 4.1-4.8 2.9-1.1 5.1-3.2-.4.8-6.2-4 3.4-2.7 4.2-3-.8 1.5-6.1-2.2-5.1 2-7.7Z"
        fill="currentColor"
      />
    </svg>
  );
}

function Home() {
  const [loadedProjects] = useState(loadProjects);
  const [projects, setProjects] = useState<Project[]>(loadedProjects.projects);
  const [activeProjectId, setActiveProjectId] = useState(() => loadActiveProjectId(loadedProjects.projects));
  const [saveMessage, setSaveMessage] = useState(loadedProjects.warning);
  const [scriptMessage, setScriptMessage] = useState('');
  const [isDraggingScript, setIsDraggingScript] = useState(false);
  const [scriptSelection, setScriptSelection] = useState({ projectId: '', scriptId: '' });
  const [scene, setScene] = useState<{ projectId: string; position: GamePosition }>(() => ({
    projectId: projects[0].id, position: getPlayerStartPosition(projects[0]),
  }));
  const activeProject = projects.find((project) => project.id === activeProjectId) ?? projects[0];
  const [previewSelection, setPreviewSelection] = useState<{ projectId: string; mode: '3d' | '2d' }>({
    projectId: '', mode: '2d',
  });
  const viewMode = previewSelection.projectId === activeProject.id ? previewSelection.mode : '2d';
  const primaryGameCamera = activeProject.gameCamera?.placement === 'custom'
    ? activeProject.gameCamera : createGameCamera(activeProject.entities);
  const gameCamera = cameraForEntity(activeProject.entities, activeProject.activeCameraId) ?? primaryGameCamera;
  const selectPreview = (mode: '3d' | '2d') => setPreviewSelection({ projectId: activeProject.id, mode });
  const activeProjectRef = useRef(activeProject);
  activeProjectRef.current = activeProject;
  const selectedScriptId = scriptSelection.projectId === activeProject.id ? scriptSelection.scriptId : '';
  const startingPosition = getPlayerStartPosition(activeProject);
  // Switching projects unmounts its runner, revoking its channel before another
  // project can run. Script scene mutations never update saved entity transforms.
  const position = scene.projectId === activeProject.id
    ? scene.position
    : getPlayerStartPosition(activeProject);
  const runnerRef = useRef<ScriptRunnerHandle>(null);
  const stageRef = useRef<HTMLElement>(null);
  const [runnerState, setRunnerState] = useState<ScriptRunnerState>({ ready: false, running: false, status: 'Choose a script to run.', scriptName: '' });
  const [runtimeError, setRuntimeError] = useState('');
  const [animationPreview, setAnimationPreview] = useState<{
    projectId: string;
    animation: GameAnimation;
    time: number;
  } | null>(null);
  const [selectedUIControlId, setSelectedUIControlId] = useState<string | null>(null);
  const onAnimationPreviewFrame = useCallback((animation: GameAnimation | null, time: number) => {
    if (!animation || runnerState.running) {
      setAnimationPreview(null);
      return;
    }
    setAnimationPreview({ projectId: activeProject.id, animation, time });
  }, [activeProject.id, runnerState.running]);
  const activeAnimationPreview = animationPreview?.projectId === activeProject.id && !runnerState.running
    ? animationPreview
    : null;
  const sceneEntities = activeAnimationPreview
    ? applyAnimationPreview(activeProject.entities, activeAnimationPreview.animation, activeAnimationPreview.time)
    : activeProject.entities;
  const scenePosition = activeAnimationPreview
    ? getPlayerStartPosition({ entities: sceneEntities })
    : position;
  const sceneEditor = useSceneEditor<Project>({
    project: activeProject,
    projects,
    activeProjectRef,
    setProjects,
    canOverwriteSavedData: loadedProjects.canOverwrite,
    isRunning: runnerState.running,
    onPreviewPosition: (nextPosition) => setScene({ projectId: activeProject.id, position: nextPosition }),
  });
  const authoring = useSceneAuthoring({
    project: activeProject, activeProjectRef, setProjects,
    selectedEntityId: sceneEditor.selectedEntityId,
    onSelectCreatedEntity: sceneEditor.onSelectCreatedEntity,
    onSetParent: sceneEditor.onSetParent, onImportAssets: sceneEditor.onImportAssets,
    readOnly: runnerState.running || Boolean(activeAnimationPreview),
    canOverwrite: loadedProjects.canOverwrite,
    onUICanvasCreated: (controlId) => { setSelectedUIControlId(controlId); selectPreview('2d'); },
  });
  useEffect(() => {
    setRuntimeError('');
    setScene({ projectId: activeProject.id, position: getPlayerStartPosition(activeProject) });
    setAnimationPreview(null);
    setSelectedUIControlId(null);
  }, [activeProject.id]);

  useProjectAutosave(projects, activeProjectId, loadedProjects.canOverwrite, setSaveMessage);

  function updateActiveProject(updates: Partial<Project>) {
    setProjects((current) =>
      current.map((project) =>
        project.id === activeProjectId ? { ...project, ...updates } : project,
      ),
    );
  }

  function createProject() {
    const name = window.prompt('Name your project');
    if (!name?.trim()) return;
    runnerRef.current?.stop();
    const project = {
      id: crypto.randomUUID(),
      name: name.trim(),
      gameType: '',
      savedAt: '',
      scripts: [],
      entities: [createDefaultPlayer()],
      assets: [],
      animations: [],
      uiControls: [],
      gameCamera: createGameCamera([]),
    };
    setProjects((current) => [...current, project]);
    setActiveProjectId(project.id);
    setSaveMessage('New project created');
  }

  function renameProject() {
    const name = window.prompt('Rename project', activeProject.name);
    if (!name?.trim()) return;
    updateActiveProject({ name: name.trim() });
    setSaveMessage('Project renamed');
  }

  function saveProject() {
    updateActiveProject({ savedAt: new Date().toISOString() });
    setSaveMessage('Project saved');
  }

  function saveStartingPosition(next: GamePosition) {
    if (!isGamePosition(next) || runnerState.running) return;
    runnerRef.current?.stop();
    sceneEditor.onMoveEntity('player', next);
    setSaveMessage('Starting position updated. Saved in this browser unless a storage error is shown.');
  }

  function selectScript(scriptId: string) {
    setScriptSelection({ projectId: activeProject.id, scriptId });
    setScriptMessage('');
  }

  function createScript(language: string) {
    const scripts = activeProject.scripts ?? [];
    const starter = movementStarter(language, scripts);
    const error = scriptStorageError(starter.content, scripts);
    if (error) { setScriptMessage(error); return; }
    runnerRef.current?.stop();
    const script = { ...starter, id: crypto.randomUUID() };
    updateActiveProject({ scripts: [...scripts, script] });
    selectScript(script.id);
    setScriptMessage(`Created ${script.name}. Source saves automatically in this browser; press Run to execute.`);
  }

  function editScript(scriptId: string, content: string) {
    const scripts = activeProject.scripts ?? [];
    const error = scriptStorageError(content, scripts, scriptId);
    if (error) { setScriptMessage(error); return; }
    updateActiveProject({
      scripts: scripts.map((script) => script.id === scriptId ? { ...script, content, size: sourceSize(content) } : script),
    });
    setScriptMessage('Source updated. Saved automatically in this browser unless a storage error is shown.');
  }

  async function importScriptFiles(files: FileList | File[]) {
    const scripts = activeProject.scripts ?? [];
    let totalSize = scripts.reduce((sum, script) => sum + script.size, 0);
    const imported: ScriptFile[] = [];
    const rejected: string[] = [];

    for (const file of Array.from(files)) {
      const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
      const language = scriptLanguages[extension];
      if (!language) {
        rejected.push(`${file.name}: unsupported file type`);
        continue;
      }
      if (file.size > maxScriptSize) {
        rejected.push(`${file.name}: files must be 256 KB or smaller`);
        continue;
      }
      if (totalSize + file.size > maxProjectScriptsSize) {
        rejected.push(`${file.name}: this project has reached its 1 MB script storage limit`);
        continue;
      }

      try {
        const content = await withSystemActivity('Reading scripts', () => file.text());
        if (content.includes('\u0000')) {
          rejected.push(`${file.name}: file is not plain text`);
          continue;
        }
        const size = Math.max(file.size, sourceSize(content));
        if (size > maxScriptSize || totalSize + size > maxProjectScriptsSize) {
          rejected.push(`${file.name}: decoded text exceeds the script storage limits`);
          continue;
        }
        imported.push({
          id: crypto.randomUUID(),
          name: file.name,
          language,
          size,
          content,
        });
        totalSize += size;
      } catch {
        rejected.push(`${file.name}: could not read file`);
      }
    }

    // File reads yield to other edits and project switches. Never replace newer
    // source with the snapshot captured before an asynchronous import.
    if (activeProjectRef.current.id !== activeProject.id ||
        activeProjectRef.current.scripts !== activeProject.scripts) {
      setScriptMessage('Project scripts changed while reading files. No files imported; please import again.');
      return;
    }
    if (imported.length > 0) {
      updateActiveProject({ scripts: [...scripts, ...imported] });
    }
    setScriptMessage([
      imported.length ? `Imported ${imported.length} script${imported.length === 1 ? '' : 's'}` : '',
      ...rejected,
    ].filter(Boolean).join(' · ') || 'Choose a script file to import.');
  }

  function removeScript(scriptId: string) {
    runnerRef.current?.stop();
    updateActiveProject({
      scripts: (activeProject.scripts ?? []).filter((script) => script.id !== scriptId),
    });
    setScriptMessage('Script removed from this project');
  }

  function createUIControl(type: UIControlType) {
    if (runnerState.running) return;
    const elements = activeProject.uiControls ?? [];
    const element = createUIControlElement(type, elements.length);
    updateActiveProject({ uiControls: [...elements, element] });
    setSelectedUIControlId(element.id);
  }

  function updateUIControl(id: string, changes: Partial<Omit<UIControlElement, 'id' | 'type'>>) {
    if (runnerState.running) return;
    updateActiveProject({
      uiControls: (activeProject.uiControls ?? []).map((element) =>
        element.id === id ? { ...element, ...changes } : element,
      ),
    });
  }

  function moveUIControl(id: string, x: number, y: number) {
    updateUIControl(id, { x, y });
  }

  function deleteUIControl(id: string) {
    if (runnerState.running) return;
    updateActiveProject({ uiControls: (activeProject.uiControls ?? []).filter((element) => element.id !== id) });
    setSelectedUIControlId((selected) => selected === id ? null : selected);
  }

  return (
    <main className="workspace" aria-label="Madhorse game creation workspace">
      <div className="shell">
        <header className="main-panel" aria-label="Main panel">
          <div className="main-panel-identity">
            <span className="panel-label">MAIN PANEL</span>
            <div className="brand" aria-label="Madhorse UI">
              <HorseMark />
              <span className="brand-name">MADHORSE<span>UI</span></span>
            </div>
          </div>
          <span className="main-panel-divider" aria-hidden="true" />
          <div className="main-panel-controls">
            {['File', 'Tools'].map((label) => (
              <details key={label} name="main-menu" className="workspace-browser-menu main-menu">
                <summary className="control-button" data-testid={`menu-${label.toLowerCase()}`}>
                  {label} <span className="control-chevron" aria-hidden="true">⌄</span>
                </summary>
                <div className="workspace-browser-panel main-menu-panel" aria-label={`${label} contents`} />
              </details>
            ))}
            <div role="tablist" aria-label="Editor views">
            <button
              type="button"
              role="tab"
              id="scene-preview-tab"
              aria-selected="true"
              aria-controls="scene-preview"
              className="control-button scene-tab is-active"
              data-testid="tab-scene-preview"
              onClick={() => {
                stageRef.current?.focus();
                stageRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
              }}
            >
              Scene Preview
            </button>
            </div>
          </div>
          <SystemStatus />
        </header>

        <section className="stage" id="scene-preview" ref={stageRef} tabIndex={-1} role="tabpanel" aria-labelledby="scene-preview-tab">
          <GameScene
            primaryCamera={primaryGameCamera}
            key={activeProject.id}
            viewMode={viewMode}
            onViewModeChange={selectPreview}
            gameCamera={gameCamera}
            entities={sceneEntities}
            uiControls={activeProject.uiControls ?? []}
            selectedUIControlId={selectedUIControlId}
            assets={sceneEditor.assets}
            assetUrls={sceneEditor.assetUrls}
            selectedEntityId={sceneEditor.selectedEntityId}
            position={scenePosition}
            startingPosition={startingPosition}
            onSaveStartingPosition={saveStartingPosition}
            readOnly={runnerState.running}
            onSelectEntity={sceneEditor.onSelectEntity}
            onMoveEntity={sceneEditor.onMoveEntity}
            onUpdateTransform={sceneEditor.onUpdateTransform}
            onSelectUIControl={setSelectedUIControlId}
            onMoveUIControl={moveUIControl}
          />
          <div className="frame-lines" aria-hidden="true" />
          <span className="stage-corner tl" aria-hidden="true" />
          <span className="stage-corner tr" aria-hidden="true" />
          <span className="stage-corner bl" aria-hidden="true" />
          <span className="stage-corner br" aria-hidden="true" />
        </section>

        <div className="toolbar-row" role="group" aria-label="Workspace toolbars">
          <div className="toolbar-group" role="group" aria-labelledby="panel-2-label">
            <span className="panel-label" id="panel-2-label">PANEL 2</span>
            <div className="toolbar-buttons"><WorkspaceBrowserMenus {...sceneEditor} creationTools={<HierarchyCreationTools {...authoring} />} /></div>
          </div>
          <div className="toolbar-group toolbar-group-right" role="group" aria-labelledby="panel-1-label">
            <span className="panel-label" id="panel-1-label">PANEL 1</span>
            <div className="toolbar-buttons">
            <details className="project-menu">
              <summary className="control-button project-button" aria-label="Project actions">
                Project <span className="control-chevron" aria-hidden="true">⌄</span>
              </summary>
              <div className="project-menu-panel">
                <label htmlFor="project-dropdown">Current project</label>
              <select
                id="project-dropdown"
                className="project-dropdown"
                value={activeProjectId}
                onChange={(event) => {
                  runnerRef.current?.stop();
                  setActiveProjectId(event.target.value);
                  setSaveMessage('');
                }}
                aria-label="Choose project"
                data-testid="select-project"
              >
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </select>
                <div className="project-actions">
                  <button type="button" onClick={createProject}>New project</button>
                  <button type="button" onClick={renameProject}>Rename</button>
                  <button type="button" onClick={saveProject}>Save project</button>
                </div>
                <span className="project-save-status" role={loadedProjects.warning ? 'alert' : 'status'} aria-live="polite">
                  {loadedProjects.warning || saveMessage || (activeProject.savedAt ? 'Saved in this browser' : 'Not saved yet')}
                </span>
              </div>
            </details>
            <label className="sr-only" htmlFor="game-type-dropdown">Game type</label>
            <span className="game-type-wrap">
              <select
                id="game-type-dropdown"
                className="control-button game-type-button"
                value={activeProject.gameType}
                onChange={(event) => updateActiveProject({ gameType: event.target.value })}
                aria-label="Game type"
                data-testid="select-game-type"
              >
                <option value="">Game Type</option>
                {gameTypes.map((gameType) => (
                  <option key={gameType} value={gameType}>{gameType}</option>
                ))}
              </select>
              <span className="control-chevron" aria-hidden="true">⌄</span>
            </span>
            <details className="script-menu">
              <summary className="control-button script-button" aria-label="Script tools">
                Script <span className="control-chevron" aria-hidden="true">⌄</span>
              </summary>
              <div className="script-menu-panel">
                <div className="script-panel-heading">
                  <strong>Project scripts</strong>
                  <span>Python · C · C++ · JavaScript · TypeScript · Lua · C#</span>
                </div>
                <ScriptCreate key={`create-${activeProject.id}`} onCreate={createScript} />
                <label
                  className={`script-dropzone${isDraggingScript ? ' is-dragging' : ''}`}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    setIsDraggingScript(true);
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDragLeave={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                      setIsDraggingScript(false);
                    }
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    setIsDraggingScript(false);
                    void importScriptFiles(event.dataTransfer.files);
                  }}
                >
                  <input
                    className="script-file-input"
                    type="file"
                    multiple
                    accept=".py,.c,.h,.cc,.cpp,.cxx,.hpp,.js,.mjs,.ts,.lua,.cs"
                    onChange={(event) => {
                      if (event.target.files) void importScriptFiles(event.target.files);
                      event.target.value = '';
                    }}
                  />
                  <span className="script-drop-icon" aria-hidden="true">+</span>
                  <span>Drop scripts here or <u>browse files</u></span>
                  <small>Plain-text files up to 256 KB each</small>
                </label>
                <div className="script-list" aria-live="polite">
                  {(activeProject.scripts ?? []).length === 0 ? (
                    <span className="script-empty">No scripts added to this project.</span>
                  ) : (
                    (activeProject.scripts ?? []).map((script) => (
                      <div className="script-file-row" key={script.id}>
                        <span className="script-file-info">
                          <strong>{script.name}</strong>
                          <small>{script.language} · {(script.size / 1024).toFixed(1)} KB</small>
                        </span>
                        <button
                          type="button"
                          className="script-remove"
                          onClick={() => removeScript(script.id)}
                          aria-label={`Remove ${script.name}`}
                        >
                          ×
                        </button>
                      </div>
                    ))
                  )}
                </div>
                <ScriptRunner
                  ref={runnerRef}
                  onState={setRunnerState}
                  onError={setRuntimeError}
                  key={activeProject.id}
                  projectId={activeProject.id}
                  scripts={activeProject.scripts ?? []}
                  selectedId={selectedScriptId}
                  onSelect={selectScript}
                  onEdit={editScript}
                  position={position}
                  onPosition={(next) => {
                    if (activeProjectRef.current.id === activeProject.id) {
                      setScene({ projectId: activeProject.id, position: next });
                    }
                  }}
                  onReset={() => {
                    runnerRef.current?.stop();
                    setScene({ projectId: activeProject.id, position: { ...startingPosition } });
                  }}
                />
                <span className="script-message" role="status">{scriptMessage}</span>
              </div>
            </details>
            </div>
          </div>
        </div>

        <section className="panel-row" aria-label="Workspace panels">
          <div className="panel" role="region" aria-labelledby="panel-3-label">
            <span className="panel-label" id="panel-3-label">PANEL 3 / System</span>
            <SystemPanelTools
              readOnly={runnerState.running}
              animations={activeProject.animations ?? []}
              entities={sceneEditor.entities}
              selectedEntityId={sceneEditor.selectedEntityId}
              uiControls={activeProject.uiControls ?? []}
              selectedUIControlId={selectedUIControlId}
              onAnimationsChange={(animations) => updateActiveProject({ animations })}
              onAnimationPreviewFrame={onAnimationPreviewFrame}
              onCreateUIControl={createUIControl}
              onSelectUIControl={setSelectedUIControlId}
              onUpdateUIControl={updateUIControl}
              onDeleteUIControl={deleteUIControl}
              onAimCamera={() => {
                updateActiveProject({ gameCamera: createGameCamera(activeProject.entities) });
                selectPreview('2d');
                setSaveMessage('Game camera aimed at the square and saved in this browser.');
                stageRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
              }}
              onShowGameView={() => {
                selectPreview('2d');
                stageRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
              }}
            />
          </div>
          <div className="panel" role="region" aria-labelledby="panel-4-label">
            <span className="panel-label" id="panel-4-label">PANEL 4 / Play/Test Game</span>
            <div className="panel-play-actions">
              <button
                type="button"
                className="control-button"
                data-testid="button-play-game"
                disabled={!runnerState.ready || runnerState.running}
                onClick={() => runnerRef.current?.run()}
              >
                Play
              </button>
              <button
                type="button"
                className="control-button"
                data-testid="button-stop-game"
                disabled={!runnerState.running}
                onClick={() => runnerRef.current?.stop()}
              >
                Stop
              </button>
            </div>
            <span className="panel-text" role="status" data-testid="status-play">
              {runnerState.scriptName ? `${runnerState.scriptName} · ${runnerState.status}` : 'Create or import a script to play.'}
            </span>
          </div>
          <div className="panel" role="region" aria-labelledby="panel-5-label">
            <span className="panel-label" id="panel-5-label">PANEL 5 / Error Displayer</span>
            <span className={`panel-text${runtimeError ? ' is-error' : ''}`} role="alert" data-testid="text-runtime-error">
              {runtimeError || 'No errors.'}
            </span>
          </div>
        </section>

        <div className="shell-footer" aria-hidden="true">
          <span className="footer-line" />
          <span className="footer-center"><i /><i /><i /></span>
          <span className="footer-line" />
        </div>
      </div>
    </main>
  );
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
