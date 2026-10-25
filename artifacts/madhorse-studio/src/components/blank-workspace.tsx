/** Fresh workspace with local scene authoring and an intentionally blank panel layout. */
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useSceneEditHistory } from '@/hooks/use-scene-edit-history';
import { duplicateSceneSelection, filterSceneHierarchy, type HierarchyFilter } from '@/lib/scene-object-actions';
import { HierarchySearchControls } from './hierarchy-search-controls';
import { SceneEditorControls, SceneEditorResetControls } from './scene-editor-controls';
import { inheritSceneEditorFlags, NO_EDITOR_FLAGS, resetSceneEditorFlag, setSceneEditorFlag, type SceneEditorFlag, type SceneEditorFlags } from '@/lib/scene-editor-state';
import { getSystemActivity, subscribeSystemActivity } from '@/lib/system-activity';
import { createPortal } from 'react-dom';
import type { Dispatch, DragEvent as ReactDragEvent, KeyboardEvent, MouseEvent, ReactNode, SetStateAction } from 'react';
import { Activity, ArrowDown, ArrowUp, Box, Check, ChevronDown, ChevronRight, Circle, Cone, Cylinder, Diamond, Donut, Droplets, FileDown, Folder, Grid2X2, ImagePlus, Mountain, Octagon, Palette, Pentagon, Shapes, Trash2, Triangle, Trees, Upload, Waves, Wrench } from 'lucide-react';
import { ScenePreview3D, type SceneFrameRequest, type SceneTransformMode } from './scene-preview-3d';
import { WorkspaceRenderSettings } from './scene-render-settings';
import { isPixelRpgScene } from '@/lib/pixel-rpg-runtime';
import {isCardDuelScene} from '@/lib/card-duel-runtime';
import {isBasketballScene} from '@/lib/basketball-runtime';
import type { SceneCursorTool } from './scene-tool-cursor';
import { MultiplayerToolsPanel } from './multiplayer-tools-panel';
import { genrePlayerFunctionTools } from '@/lib/player-function-tools';
import { actionKeyOptions } from '@/lib/player-action-model';
import { cartChaseCamera } from '@/lib/cart-racer-runtime';
import {
  createScriptableObjectAsset,
  createPhysicsComponent,
  createSceneEntity,
  createStarterCube,
  createTransformComponent,
  getCamera,
  getModelRenderer,
  getPrimitive,
  getTransform,
  getWorldTransform,
  isProjectAsset,
  isSceneGraph,
  isSceneEntity,
  primitiveShapes,
  projectAssetKind,
  SCENE_ORIGIN,
  uiElementKinds,
  type PrimitiveShape,
  type ProjectAsset,
  type SceneComponent,
  type SceneEntity,
  type TerrainSettings,
  type TransformComponent,
  type UIElementKind,
} from '@/lib/scene-model';
import { createGameCamera, type GameCamera } from '@/lib/game-camera';
import { cameraWithPose, PRIMARY_CAMERA_ID, primaryCameraEntity } from '@/lib/camera-editor';
import {
  appendTerrainBrushEdit,
  createTerrainTreeGrove,
  createTerrainWater,
  type TerrainToolAction,
  type TreeSpacing,
  type WaterCoverage,
  type WaterLevel,
} from '@/lib/terrain-authoring';
import { SceneObjectGlyph } from './scene-object-glyph';
import {
  getMultiplayerRoomState,
  syncMultiplayerRoomState,
  type MultiplayerRoomMember,
  type MultiplayerRoomSnapshot,
} from '@/lib/multiplayer-client';
import { applyMultiplayerSnapshot, createMultiplayerUpdate } from '@/lib/multiplayer-runtime';
import { SceneObjectInspector } from './scene-object-inspector';
import { EngineSystemReferencePanel } from './engine-system-reference-panel';
import { PbrMaterialEditor } from './pbr-material-editor';
import { SystemDebugger } from './system-debugger';
import {
  HierarchyContextMenu,
  PlaneSettingsDialog,
  TerrainSettingsDialog,
  type HierarchyMenuPoint,
  type PlaneSettings,
} from './hierarchy-context-menu';
import { AnimationEditor } from './animation-editor';
import { createPbrMaterialAsset } from '@/lib/pbr-material';
import { isGameAnimationCollection, sampleGameAnimation, type GameAnimation } from '@/lib/game-api';
import {
  applyEgoAnimationController,
  createEgoAnimationPack,
  isEgoAnimationControllerCollection,
  type EgoAnimationController,
} from '@/lib/ego-animation-controller';
import {
  loadFreshWorkspace,
  saveFreshWorkspace,
  type FreshWorkspaceSnapshot,
} from '@/lib/fresh-workspace-storage';
import { deleteLocalAsset, loadLocalAsset, saveLocalAsset } from '@/lib/asset-vault';
import { MadBuilderMenu } from './mad-builder-menu';
import { EgoAssistant } from './ego-assistant';
import { useMadBuilder, type BuilderDocument } from '@/hooks/use-mad-builder';
import type { BuilderMessage } from './mad-builder-contract';
import type { MadBuilderPlan } from '@workspace/api-client-react';
import { capturePrefab, instantiatePrefab, type ScenePrefab } from '@/lib/scene-authoring';
import { compileBuilderPlan } from '@/lib/mad-builder';
import { createMadBuilderModulePlan, getMadBuilderModule, type MadBuilderModuleId } from '@/lib/mad-builder-modules';
import type { UIControlElement } from '@/lib/ui-controls';
import { createEgoUiKit as createEgoGameUiKit, egoPlayerActions, type EgoGameType, getEgoGameSelectionLabel } from '@/lib/ego-ui-kit';
import { advanceSceneRuntime, createSceneRuntimeState } from '@/lib/scene-play-runtime';
import { SimulationClock } from '@/lib/simulation-clock';
import { publishStatus } from '@/lib/system-diagnostics';
import { playAudioPreview, stopAudioPlayback, unlockSceneAudio } from '@/lib/game-audio';
import { playerActionDefinitions } from '@/lib/player-action-model';
import { createStoryboardComponent } from '@/lib/scene-model';
import { scriptStorageError, type ScriptFile } from '@/lib/project-scripts';
import { createGameStarterKit, poseFighterGuard, type GameStarterKitId } from '@/lib/scene-starter-kits';
import {
  defaultFightingAppearancePair,
  parseFightingAppearancePrompt,
  type FightingAppearancePair,
} from '@/lib/fighter-appearance';
import { gameFeatureDefinitions } from '@/lib/game-feature-model';
import type { ActionHud } from '@/lib/player-action-runtime';
import { PlayerActionHud } from './player-action-hud';
import { ScriptableObjectEditor } from './scriptable-object-editor';
import { GameStarterKitDialog } from './game-starter-kit-dialog';
import { StoryboardEditor } from './storyboard-editor';
import { downloadMadBuilderLogPdf, type MadBuilderBuildLog } from '@/lib/mad-builder-build-log';
import { createGameTypeLibraryPdf, gameTypeLibraryEntryCount } from '@/lib/game-type-library';
import { applyEgoFighterAppearance, createEgoCharacterScene, createEgoClothingTextureAsset } from '@/lib/character-builder-starter';
import { detectEgoCharacterRequests, type EgoCharacterSize } from '@/lib/ego-character-anatomy';
import { loadFightingCharacterReference } from '@/lib/fighting-character-reference';
import { createEgoWorkspaceContext, type EgoInterfaceContext } from '@/lib/ego-workspace-context';
import { EgoPanelBox } from './ego-panel-box';
import type { EgoGameFlow } from '@/lib/ego-game-plan';
import {
  createPluginComponent,
  matchesPluginComponent,
  scenePluginCatalog,
  type PluginCategory,
  type PluginComponentKind,
} from '@/lib/scene-plugin-catalog';
import CHARACTER_CONTROLLER_REFERENCE from '@/lib/character-controller-reference.md?raw';
import ENGINE_EDITOR_PERFORMANCE_REFERENCE from '@/lib/engine-editor-performance-reference.md?raw';
const ModelingWorkspace = lazy(() => import('./modeling/modeling-workspace'));
import './system-panel-tools.css';
import './numbered-workspace.css';

const WORKSPACE_ASSET_LIMIT = 100 * 1024 * 1024;
const IMPORT_ACCEPT = '.png,.jpg,.jpeg,.webp,.gif,.svg,.glb,.gltf,.obj,.fbx,.dae,.mp3,.wav,.ogg,.m4a,.aac,.flac';

function SceneViewport({
  projectName,
  entities,
  camera,
  isPlaying,
  assets,
  assetUrls,
  selection,
  frameRequest,
  onSelect,
  onTransformCommit,
  onCameraChange,
  actionHud,
  canvasView,
  activeTool,
}: {
  projectName: string;
  entities: SceneEntity[];
  camera: GameCamera;
  isPlaying: boolean;
  assets: ProjectAsset[];
  assetUrls: Record<string, string>;
  selection: string | null;
  frameRequest: SceneFrameRequest | null;
  onSelect: (id: string) => void;
  onTransformCommit: (
    entityId: string,
    changes: Partial<Pick<TransformComponent, 'position' | 'rotation' | 'scale'>>,
  ) => void;
  onCameraChange: (camera: GameCamera) => void;
  actionHud: ActionHud | null;
  canvasView: boolean;
  activeTool: SceneCursorTool | null;
}) {
  const [transformMode, setTransformMode] = useState<SceneTransformMode>('translate');
  const firstPerson = isPlaying && entities.some(entity => entity.active && entity.components.some(component =>
    component.type === 'characterController' && component.enabled && component.role === 'player' && component.perspective === 'first-person'));
  const displayedEntities = firstPerson ? entities.map(entity => entity.components.some(component =>
    component.type === 'characterController' && component.role === 'player' && component.perspective === 'first-person')
    ? { ...entity, components: entity.components.map(component => component.type === 'primitive' ? { ...component, enabled: false } : component) } : entity) : entities;
  const rangeTargets = entities.filter(entity =>
    entity.components.some(component => component.type === 'gameFeature' && component.enabled && component.kind === 'health') &&
    !entity.components.some(component => component.type === 'characterController' && component.role === 'player'));
  const canTogglePerspective = isPlaying && entities.some(entity => entity.active && entity.components.some(component =>
    component.type === 'characterController' && component.enabled && component.role === 'player' &&
    (component.perspective === 'first-person' || component.perspective === 'third-person'),
  ));
  return (
    <div className="fresh-viewport" data-fps-viewport={firstPerson ? 'true' : undefined}>
      <ScenePreview3D
        projectName={projectName}
        primaryCamera={camera}
        gameCamera={camera}
        gameView={isPlaying || canvasView}
        gameRunning={isPlaying}
        activeTool={activeTool}
        entities={displayedEntities}
        assets={assets}
        assetUrls={assetUrls}
        selectedEntityId={selection}
        frameRequest={frameRequest}
        playerPreviewPosition={{ x: 0, y: 0 }}
        transformMode={transformMode}
        readOnly={isPlaying}
        onSelectEntity={onSelect}
        onTransformCommit={onTransformCommit}
        onTransformModeChange={setTransformMode}
        onPrimaryCameraChange={onCameraChange}
        onSelectPrimaryCamera={() => onSelect(PRIMARY_CAMERA_ID)}
      />
      {isPlaying && actionHud && !isPixelRpgScene(entities) && !isCardDuelScene(entities) && !isBasketballScene(entities) && <PlayerActionHud hud={actionHud} />}
      {canTogglePerspective && <div style={{
        position: 'absolute', top: 12, right: 12, padding: '6px 9px', border: '1px solid #54687b',
        borderRadius: 4, background: '#091520df', color: '#e6f2fa', fontSize: 10, pointerEvents: 'none',
      }}>
        {firstPerson ? 'FIRST PERSON · V FOR THIRD PERSON' : 'THIRD PERSON · V FOR FIRST PERSON'}
      </div>}
      {firstPerson && <>
        <div style={{ position: 'absolute', left: '50%', top: '50%', color: '#fff', fontSize: 24, pointerEvents: 'none', transform: 'translate(-50%,-50%)', textShadow: '0 0 3px #000' }} aria-label="FPS crosshair">+</div>
        <div style={{ position: 'absolute', top: 48, left: 16, padding: '8px 12px', background: '#091520df', color: '#e6f2fa', fontSize: 11, pointerEvents: 'none', maxWidth: '70%' }}>
          {rangeTargets.length > 0 && <strong>{rangeTargets.every(entity => !entity.active) ? 'RANGE CLEARED · Stop and restart to replay' : `TARGETS ${rangeTargets.filter(entity => !entity.active).length} / ${rangeTargets.length}`}<br /></strong>}
          Click scene: mouse look · Left click / J: fire · WASD: move · R: reload · Shift: sprint · C: crouch · Space: jump · Esc: stop
        </div>
      </>}
    </div>
  );
}

type FunctionTabId =
  | 'game-system'
  | 'player-functions'
  | 'game-controls'
  | 'player-controls'
  | 'npc-functions'
  | 'ai-navigation'
  | 'npc-controls';

type FunctionTool = {
  id: string;
  label: string;
  description: string;
  componentKind: PluginComponentKind;
};

const FUNCTION_TOOLSETS: Record<FunctionTabId, FunctionTool[]> = {
  'game-system': [
    { id: 'make-solid', label: 'Make it solid', description: 'Lets it bump into things. Change weight and bounce in Settings.', componentKind: 'physics' },
    { id: 'add-camera', label: 'Add a camera', description: 'Choose what this camera can see.', componentKind: 'camera' },
    { id: 'add-screen-panel', label: 'Add a screen panel', description: 'Start a simple menu or game screen.', componentKind: 'uiCanvas' },
    { id: 'safe-script-slot', label: 'Add a safe code slot', description: 'Keep code stored safely. It never runs by surprise.', componentKind: 'script' },
  ],
  'player-functions': [
    { id: 'player-walk-jump', label: 'Walk and jump', description: 'W, A, S, D or arrow keys move. Space jumps in Play Test.', componentKind: 'character-controller-player' },
    { id: 'player-third-person', label: 'Move with camera behind', description: 'Adds walking and a camera that follows from behind.', componentKind: 'character-controller-third-person' },
    ...genrePlayerFunctionTools,
  ],
  'game-controls': [
    { id: 'keyboard-controls', label: 'Add keyboard controls', description: 'W, A, S, D or arrow keys move. Space jumps; Escape stops Play Test.', componentKind: 'character-controller-player' },
  ],
  'player-controls': [
    { id: 'player-movement-controls', label: 'Set up player movement', description: 'Adds walking and jumping. Change speed in object Settings.', componentKind: 'character-controller-player' },
  ],
  'npc-functions': [
    { id: 'npc-follow-player', label: 'Follow the player', description: 'This helper walks toward the player.', componentKind: 'character-controller-npc' },
    { id: 'npc-patrol', label: 'Walk back and forth', description: 'This helper walks around near where you put it.', componentKind: 'character-controller-patrol' },
  ],
  'ai-navigation': [
    { id: 'navigation-follow', label: 'Follow the player', description: 'Simple movement toward the player. It does not go around walls yet.', componentKind: 'character-controller-npc' },
    { id: 'navigation-patrol', label: 'Patrol this spot', description: 'Walks back and forth near its starting place.', componentKind: 'character-controller-patrol' },
  ],
  'npc-controls': [
    { id: 'npc-follow-controls', label: 'Make a helper follow', description: 'Add a helper, then change its speed and distance in Settings.', componentKind: 'character-controller-npc' },
    { id: 'npc-patrol-controls', label: 'Make a helper patrol', description: 'Add a helper, then change how far it walks in Settings.', componentKind: 'character-controller-patrol' },
  ],
};

const FUNCTION_TAB_HELP: Record<FunctionTabId, string> = {
  'game-system': 'Pick a tool to add it to the selected object.',
  'player-functions': 'Add a player skill for your game type. Edit its key, targets, and settings by double-clicking the object. Skills reset when Play Test stops.',
  'game-controls': 'Add keyboard movement, then press Play Test.',
  'player-controls': 'Pick the object that should move and add its controls.',
  'npc-functions': 'Choose how your helper should move.',
  'ai-navigation': 'These are simple follow and patrol tools. Wall-avoiding paths are not available yet.',
  'npc-controls': 'Add a helper, then change its speed or patrol distance in object Settings.',
};

function SettingsPanel({
  egoBox,
  entity,
  selectedEntity,
  entities,
  assets,
  assetUrls,
  builderBuildLogs,
  onReturnToSettings,
  onOpenSceneStarterKits,
  onOpenStoryboard,
  onOpenCharacterBuilder,
  onOpenTimeline,
  onCreateScriptableObject,
  onEditScriptableObject,
  onCreatePbrMaterial,
  onEditPbrMaterial,
  onAttachPlugin,
  onSaveEntity,
  multiplayerMember,
  multiplayerSnapshot,
  onMultiplayerMemberChange,
  onMultiplayerSnapshotChange,
}: {
  egoBox: ReactNode;
  entity: SceneEntity | null;
  selectedEntity: SceneEntity | null;
  entities: SceneEntity[];
  assets: ProjectAsset[];
  assetUrls: Record<string, string>;
  builderBuildLogs: MadBuilderBuildLog[];
  onReturnToSettings: () => void;
  onOpenSceneStarterKits: () => void;
  onOpenStoryboard: () => void;
  onOpenCharacterBuilder: () => void;
  onOpenTimeline: () => void;
  onCreateScriptableObject: () => void;
  onEditScriptableObject: (assetId: string) => void;
  onCreatePbrMaterial: () => void;
  onEditPbrMaterial: (assetId: string) => void;
  onAttachPlugin: (entityId: string, kind: PluginComponentKind) => void;
  onSaveEntity: (entity: SceneEntity) => void;
  multiplayerMember: MultiplayerRoomMember | null;
  multiplayerSnapshot: MultiplayerRoomSnapshot | null;
  onMultiplayerMemberChange: (member: MultiplayerRoomMember | null) => void;
  onMultiplayerSnapshotChange: Dispatch<SetStateAction<MultiplayerRoomSnapshot | null>>;
}) {
  const [activeFunctionTab, setActiveFunctionTab] = useState<FunctionTabId>('game-system');
  const [activePluginTab, setActivePluginTab] = useState<PluginCategory>('game');
  const [gameTypeLibraryPdfUrl, setGameTypeLibraryPdfUrl] = useState<string | null>(null);
  const gameTypeLibraryPdfUrlRef = useRef<string | null>(null);
  const pluginEntries = scenePluginCatalog[activePluginTab];
  const selectedEventComponent = selectedEntity?.components.find(component =>
    component.type === 'multiplayerPlugin' && component.mode === 'event' && component.enabled,
  );
  const functionTools = FUNCTION_TOOLSETS[activeFunctionTab];

  useEffect(() => () => {
    if (gameTypeLibraryPdfUrlRef.current) URL.revokeObjectURL(gameTypeLibraryPdfUrlRef.current);
  }, []);

  return (
    <div className="fresh-settings-panel">
      <button
        type="button"
        className="fresh-settings-panel-tab"
        aria-pressed={!entity}
        onClick={onReturnToSettings}
      >
        Settings
      </button>
      {entity ? (
        <SceneObjectInspector
          key={entity.id}
          embedded
          entity={entity}
          entities={entities}
          assets={assets}
          assetUrls={assetUrls}
          canRename={entity.id !== PRIMARY_CAMERA_ID}
          canEditActive={entity.id !== PRIMARY_CAMERA_ID}
          onClose={onReturnToSettings}
          onSave={onSaveEntity}
        />
      ) : (
        <div className="fresh-settings-sections">
          <details className="fresh-settings-category fresh-settings-dropdown" data-testid="details-functions-controls">
            <summary className="fresh-settings-category-summary" data-testid="button-toggle-functions-controls">
              <h2>Functions &amp; Controls</h2>
              <ChevronDown size={14} aria-hidden="true" />
            </summary>
            <div className="fresh-settings-category-content">
              <div className="fresh-function-tabs" role="group" aria-label="Functions and controls sections">
                <button
                  type="button"
                  className="fresh-function-tab"
                  aria-pressed={activeFunctionTab === 'game-system'}
                  data-active={activeFunctionTab === 'game-system'}
                  data-testid="button-game-system-functions"
                  onClick={() => setActiveFunctionTab('game-system')}
                >
                  Game and System Functions
                </button>
                <button
                  type="button"
                  className="fresh-function-tab"
                  aria-pressed={activeFunctionTab === 'player-functions'}
                  data-active={activeFunctionTab === 'player-functions'}
                  data-testid="button-player-functions"
                  onClick={() => setActiveFunctionTab('player-functions')}
                >
                  Player Functions
                </button>
                <button
                  type="button"
                  className="fresh-function-tab"
                  aria-pressed={activeFunctionTab === 'game-controls'}
                  data-active={activeFunctionTab === 'game-controls'}
                  data-testid="button-game-controls"
                  onClick={() => setActiveFunctionTab('game-controls')}
                >
                  Game Controls
                </button>
                <button
                  type="button"
                  className="fresh-function-tab"
                  aria-pressed={activeFunctionTab === 'player-controls'}
                  data-active={activeFunctionTab === 'player-controls'}
                  data-testid="button-player-controls"
                  onClick={() => setActiveFunctionTab('player-controls')}
                >
                  Player Controls
                </button>
                <button
                  type="button"
                  className="fresh-function-tab"
                  aria-pressed={activeFunctionTab === 'npc-functions'}
                  data-active={activeFunctionTab === 'npc-functions'}
                  data-testid="button-npc-functions"
                  onClick={() => setActiveFunctionTab('npc-functions')}
                >
                  NPC Functions
                </button>
                <button
                  type="button"
                  className="fresh-function-tab"
                  aria-pressed={activeFunctionTab === 'ai-navigation'}
                  data-active={activeFunctionTab === 'ai-navigation'}
                  data-testid="button-ai-navigation-function"
                  onClick={() => setActiveFunctionTab('ai-navigation')}
                >
                  AI Navigation Function
                </button>
                <button
                  type="button"
                  className="fresh-function-tab"
                  aria-pressed={activeFunctionTab === 'npc-controls'}
                  data-active={activeFunctionTab === 'npc-controls'}
                  data-testid="button-npc-controls"
                  onClick={() => setActiveFunctionTab('npc-controls')}
                >
                  NPC Controls
                </button>
              </div>
              <div className="fresh-function-tools" data-testid="function-tools-panel">
                <p className="fresh-function-guidance" data-testid="function-tab-guidance">
                  {selectedEntity?.id === PRIMARY_CAMERA_ID
                    ? 'Choose an object in Hierarchy first.'
                    : selectedEntity
                      ? `${FUNCTION_TAB_HELP[activeFunctionTab]} Selected: ${selectedEntity.name}.`
                      : 'Choose an object in Hierarchy first.'}
                </p>
                <div className="fresh-function-tool-list">
                  {functionTools.map(tool => {
                    const alreadyAdded = Boolean(selectedEntity?.components.some(item => matchesPluginComponent(item, tool.componentKind)));
                    const canAdd = Boolean(selectedEntity && selectedEntity.id !== PRIMARY_CAMERA_ID && !alreadyAdded);
                    return (
                      <article className="fresh-function-tool-card" key={tool.id} data-testid={`function-tool-${tool.id}`}>
                        <div>
                          <strong>{tool.label}</strong>
                          <p>{tool.description}</p>
                        </div>
                        <button
                          type="button"
                          className="fresh-function-tool-add"
                          disabled={!canAdd}
                          onClick={() => {
                            if (selectedEntity && canAdd) onAttachPlugin(selectedEntity.id, tool.componentKind);
                          }}
                        >
                          {alreadyAdded ? 'Added' : selectedEntity?.id === PRIMARY_CAMERA_ID || !selectedEntity ? 'Pick object' : 'Add'}
                        </button>
                      </article>
                    );
                  })}
                </div>
              </div>
            </div>
          </details>
          <details className="fresh-settings-category fresh-settings-dropdown" data-testid="details-system-presets-data">
            <summary className="fresh-settings-category-summary" data-testid="button-toggle-system-presets-data">
              <h2>System Presets &amp; Data</h2>
              <ChevronDown size={14} aria-hidden="true" />
            </summary>
            <div className="fresh-settings-category-content">
              <details className="fresh-documents-folder" data-testid="details-documents-folder">
                <summary className="fresh-documents-folder-summary" data-testid="button-toggle-documents-folder">
                  <Folder size={15} aria-hidden="true" />
                  <span>Documents &amp; PDFs</span>
                  <ChevronDown size={13} aria-hidden="true" />
                </summary>
                <div className="fresh-documents-folder-content">
              <details
                className="fresh-game-type-library"
                data-testid="details-game-type-library"
                onToggle={(event) => {
                  if (event.currentTarget.open && !gameTypeLibraryPdfUrlRef.current) {
                    const url = URL.createObjectURL(createGameTypeLibraryPdf());
                    gameTypeLibraryPdfUrlRef.current = url;
                    setGameTypeLibraryPdfUrl(url);
                  }
                }}
              >
                <summary className="fresh-game-type-library-summary">
                  <span>Game Type Library · Read-only PDF</span>
                  <ChevronDown size={13} aria-hidden="true" />
                </summary>
                <p className="fresh-game-type-library-note">
                  {gameTypeLibraryEntryCount} genre families with core loops, required systems, Madhorse build paths, and test notes.
                </p>
                {gameTypeLibraryPdfUrl && (
                  <iframe
                    className="fresh-game-type-library-frame"
                    title="Read-only Madhorse game type library PDF"
                    src={`${gameTypeLibraryPdfUrl}#toolbar=0&navpanes=0&view=FitH`}
                    loading="lazy"
                  />
                )}
              </details>
              <details className="fresh-game-type-library fresh-controller-reference" data-testid="details-character-controller-guide">
                <summary className="fresh-game-type-library-summary" data-testid="button-toggle-character-controller-guide">
                  <span>Character Controller Guide · Read-only</span>
                  <ChevronDown size={13} aria-hidden="true" />
                </summary>
                <p className="fresh-game-type-library-note">
                  Modeling, texturing, and editing guidance for the four controller patterns, including current Madhorse support.
                </p>
                <a
                  className="fresh-builder-log-download fresh-controller-docx-download"
                  href={`${import.meta.env.BASE_URL}documents/character-controller-guide.docx`}
                  download
                  data-testid="button-download-character-controller-docx"
                >
                  <FileDown size={13} aria-hidden="true" />
                  Download Word file (.docx)
                </a>
                <pre className="fresh-controller-reference-text" data-testid="text-character-controller-guide">
                  {CHARACTER_CONTROLLER_REFERENCE}
                </pre>
              </details>
              <details className="fresh-game-type-library fresh-controller-reference" data-testid="details-engine-performance-guide">
                <summary className="fresh-game-type-library-summary" data-testid="button-toggle-engine-performance-guide">
                  <span>Unity &amp; Unreal Tools and Performance Guide · Read-only</span>
                  <ChevronDown size={13} aria-hidden="true" />
                </summary>
                <p className="fresh-game-type-library-note">
                  Public engine references, Madhorse architecture notes, and performance practices. This system guide is not project data.
                </p>
                <pre className="fresh-controller-reference-text" data-testid="text-engine-performance-guide">
                  {ENGINE_EDITOR_PERFORMANCE_REFERENCE}
                </pre>
              </details>
              <EngineSystemReferencePanel />
              <div className="fresh-builder-log" role="region" aria-label="Read-only Mad Builder build log" data-testid="builder-log-readonly">
                <div className="fresh-builder-log-heading">
                  <div>
                    <strong>Mad Builder build log</strong>
                    <span className="fresh-builder-log-readonly">READ ONLY</span>
                  </div>
                  <button
                    type="button"
                    className="fresh-builder-log-download"
                    disabled={builderBuildLogs.length === 0}
                    onClick={() => downloadMadBuilderLogPdf('Scene 1', builderBuildLogs)}
                    data-testid="button-download-builder-log"
                  ><FileDown size={14} /> Download PDF</button>
                </div>
                <p className="fresh-builder-log-note">This system log and its generated PDF are read-only in Studio. Completed builds are saved with this scene in this browser.</p>
                {builderBuildLogs.length === 0 ? (
                  <p className="fresh-builder-log-empty" data-testid="builder-log-empty">No completed builds yet.</p>
                ) : (
                  <ol className="fresh-builder-log-list" data-testid="builder-build-log-list">
                    {[...builderBuildLogs].reverse().map((log, index) => (
                      <li key={log.id} data-testid={`builder-build-log-${log.id}`}>
                        <details>
                          <summary>
                            <span>{builderBuildLogs.length - index}. {log.plan.title}</span>
                            <small>{new Date(log.createdAt).toLocaleString()}</small>
                          </summary>
                          <p>{log.plan.summary}</p>
                          {log.request && <p><b>Request:</b> {log.request}</p>}
                          <p><b>{log.objectNames.length} objects:</b> {log.objectNames.join(', ') || 'None'}</p>
                          {log.uiControlNames.length > 0 && <p><b>UI controls:</b> {log.uiControlNames.join(', ')}</p>}
                          <ul>{log.plan.parts.map(part => (
                            <li key={part.key}>{part.name} · {part.kind} · size {part.size.x} × {part.size.y} × {part.size.z}</li>
                          ))}</ul>
                        </details>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
                </div>
              </details>
            </div>
          </details>
          <details className="fresh-settings-category fresh-settings-dropdown" data-testid="details-plugins">
            <summary className="fresh-settings-category-summary" data-testid="button-toggle-plugins">
              <h2>Plugins</h2>
              <ChevronDown size={14} aria-hidden="true" />
            </summary>
            <div className="fresh-settings-category-content">
              <h3>Scene tools</h3>
              <div className="fresh-panel-project-tools" role="group" aria-label="Scene tools">
                <button type="button" data-testid="button-scene-starter-kits" onClick={onOpenSceneStarterKits}>
                  <strong>Scene Starter Kits</strong>
                  <span>FPS · RPG · Puzzle</span>
                </button>
                <button type="button" data-testid="button-open-storyboard" onClick={onOpenStoryboard}>
                  <strong>Storyboard</strong>
                  <span>Plan mission steps</span>
                </button>
              </div>
              <div className="fresh-plugin-tabs" role="group" aria-label="Plugin categories">
                <button
                  type="button"
                  className="fresh-plugin-tab"
                  aria-pressed={activePluginTab === 'game'}
                  data-active={activePluginTab === 'game'}
                  data-testid="button-game-plugins"
                  onClick={() => setActivePluginTab('game')}
                >
                  Game Plugins
                </button>
                <button
                  type="button"
                  className="fresh-plugin-tab"
                  aria-pressed={activePluginTab === 'game-mechanics'}
                  data-active={activePluginTab === 'game-mechanics'}
                  data-testid="button-game-mechanics-plugins"
                  onClick={() => setActivePluginTab('game-mechanics')}
                >
                  Game Mechanics
                </button>
                <button
                  type="button"
                  className="fresh-plugin-tab"
                  aria-pressed={activePluginTab === 'multiplayer'}
                  data-active={activePluginTab === 'multiplayer'}
                  data-testid="button-multiplayer-plugins"
                  onClick={() => setActivePluginTab('multiplayer')}
                >
                  Multiplayer Plugins
                </button>
                <button
                  type="button"
                  className="fresh-plugin-tab"
                  aria-pressed={activePluginTab === 'player-npc'}
                  data-active={activePluginTab === 'player-npc'}
                  data-testid="button-player-npc-plugins"
                  onClick={() => setActivePluginTab('player-npc')}
                >
                  Player/NPC Plugins
                </button>
                <button
                  type="button"
                  className="fresh-plugin-tab"
                  aria-pressed={activePluginTab === 'system'}
                  data-active={activePluginTab === 'system'}
                  data-testid="button-system-plugins"
                  onClick={() => setActivePluginTab('system')}
                >
                  System Plugins
                </button>
                <button
                  type="button"
                  className="fresh-plugin-tab"
                  aria-pressed={activePluginTab === 'lighting'}
                  data-active={activePluginTab === 'lighting'}
                  data-testid="button-lighting-plugins"
                  onClick={() => setActivePluginTab('lighting')}
                >
                  Lighting Plugins
                </button>
                <button
                  type="button"
                  className="fresh-plugin-tab"
                  aria-pressed={activePluginTab === 'animation'}
                  data-active={activePluginTab === 'animation'}
                  data-testid="button-animation-plugins"
                  onClick={() => setActivePluginTab('animation')}
                >
                  Animation Plugins
                </button>
                <button
                  type="button"
                  className="fresh-plugin-tab"
                  aria-pressed={activePluginTab === 'asset'}
                  data-active={activePluginTab === 'asset'}
                  data-testid="button-asset-plugins"
                  onClick={() => setActivePluginTab('asset')}
                >
                  Asset Plugins
                </button>
                <button
                  type="button"
                  className="fresh-plugin-tab"
                  aria-pressed={activePluginTab === 'effect'}
                  data-active={activePluginTab === 'effect'}
                  data-testid="button-effect-plugins"
                  onClick={() => setActivePluginTab('effect')}
                >
                  Effect Plugins
                </button>
                <button
                  type="button"
                  className="fresh-plugin-tab"
                  aria-pressed={activePluginTab === 'triggers'}
                  data-active={activePluginTab === 'triggers'}
                  data-testid="button-triggers-plugins"
                  onClick={() => setActivePluginTab('triggers')}
                >
                  Triggers
                </button>
                <button
                  type="button"
                  className="fresh-plugin-tab"
                  aria-pressed={activePluginTab === 'trigger-zones'}
                  data-active={activePluginTab === 'trigger-zones'}
                  data-testid="button-trigger-zones-plugins"
                  onClick={() => setActivePluginTab('trigger-zones')}
                >
                  Trigger Zones
                </button>
                <button
                  type="button"
                  className="fresh-plugin-tab"
                  aria-pressed={activePluginTab === 'skybox'}
                  data-active={activePluginTab === 'skybox'}
                  data-testid="button-skybox-plugins"
                  onClick={() => setActivePluginTab('skybox')}
                >
                  Sky Box Plugins
                </button>
                <button
                  type="button"
                  className="fresh-plugin-tab"
                  aria-pressed={activePluginTab === 'character-builder'}
                  data-active={activePluginTab === 'character-builder'}
                  data-testid="button-character-builder-plugin"
                  onClick={() => {
                    setActivePluginTab('character-builder');
                    onOpenCharacterBuilder();
                  }}
                >
                  Character Builder Plugin
                </button>
                <button
                  type="button"
                  className="fresh-plugin-tab"
                  aria-pressed={activePluginTab === 'behavior-builder'}
                  data-active={activePluginTab === 'behavior-builder'}
                  data-testid="button-behavior-builder-plugin"
                  onClick={() => setActivePluginTab('behavior-builder')}
                >
                  Behavior Builder Plugin
                </button>
                <button
                  type="button"
                  className="fresh-plugin-tab"
                  aria-pressed={activePluginTab === 'script'}
                  data-active={activePluginTab === 'script'}
                  data-testid="button-script-plugin"
                  onClick={() => setActivePluginTab('script')}
                >
                  Script Plugin
                </button>
                <button
                  type="button"
                  className="fresh-plugin-tab"
                  aria-pressed={activePluginTab === 'third-person-character'}
                  data-active={activePluginTab === 'third-person-character'}
                  data-testid="button-third-person-character-plugin"
                  onClick={() => setActivePluginTab('third-person-character')}
                >
                  Third-Person Character Plugin
                </button>
              </div>
              <div className="fresh-plugin-workbench">
                <p className="fresh-plugin-instruction">
                  {activePluginTab === 'asset'
                    ? 'Create reusable project data and physically based materials. PBR maps can be shared across scene objects.'
                    : <>
                      These are Madhorse’s simple versions of common Unity and Unreal tools.
                      {selectedEntity
                        ? <> <strong>{selectedEntity.name}</strong> is picked. Press Add or drag a tool onto an object name.</>
                        : 'Pick an object name first. Then press Add or drag a tool onto it.'}
                    </>}
                </p>
                {activePluginTab === 'multiplayer' && (
                  <MultiplayerToolsPanel
                    objectEventName={selectedEventComponent?.type === 'multiplayerPlugin'
                      ? selectedEventComponent.eventName : undefined}
                    member={multiplayerMember}
                    snapshot={multiplayerSnapshot}
                    onMemberChange={onMultiplayerMemberChange}
                    onSnapshotChange={onMultiplayerSnapshotChange}
                  />
                )}
                {pluginEntries.length ? (
                  <div className="fresh-plugin-cards" aria-live="polite">
                    {pluginEntries.map(entry => {
                      const alreadyAdded = Boolean(entry.componentKind && selectedEntity?.components.some(component => matchesPluginComponent(component, entry.componentKind!)));
                      const isComponent = Boolean(entry.componentKind);
                      const canAddToSelected = Boolean(selectedEntity && selectedEntity.id !== PRIMARY_CAMERA_ID && isComponent && !alreadyAdded);
                      const handleDragStart = (event: ReactDragEvent<HTMLElement>) => {
                        if (!entry.componentKind) {
                          event.preventDefault();
                          return;
                        }
                        event.dataTransfer.effectAllowed = 'copy';
                        event.dataTransfer.setData('application/x-madhorse-plugin', entry.componentKind);
                        event.dataTransfer.setData('text/plain', entry.label);
                      };
                      return (
                        <article
                          className={`fresh-plugin-card${isComponent ? ' is-draggable' : ''}`}
                          key={entry.id}
                          draggable={isComponent}
                          onDragStart={handleDragStart}
                          data-testid={`plugin-card-${entry.id}`}
                        >
                          <div className="fresh-plugin-card-copy">
                            <strong>{entry.label}</strong>
                            <p>{entry.description}</p>
                          </div>
                          {entry.action === 'character-builder' ? (
                            <button type="button" className="fresh-plugin-add" onClick={onOpenCharacterBuilder}>Open</button>
                          ) : entry.action === 'animation-timeline' ? (
                            <button type="button" className="fresh-plugin-add" onClick={onOpenTimeline}>Open</button>
                          ) : entry.action === 'create-scriptable-object' ? (
                            <button type="button" className="fresh-plugin-add" data-testid="create-scriptable-object"
                              onClick={onCreateScriptableObject}>Create</button>
                          ) : (
                            <button
                              type="button"
                              className="fresh-plugin-add"
                              disabled={!canAddToSelected}
                              onClick={() => selectedEntity && entry.componentKind && onAttachPlugin(selectedEntity.id, entry.componentKind)}
                            >
                              {alreadyAdded ? 'Added' : selectedEntity?.id === PRIMARY_CAMERA_ID ? 'System camera' : selectedEntity ? 'Add' : 'Select object'}
                            </button>
                          )}
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <p className="fresh-plugin-empty" role="status">
                    {activePluginTab === 'game-mechanics'
                      ? 'Game Mechanics tools will appear here as they are added.'
                      : 'This plugin family is in the next build pass. The available native components are ready to add above.'}
                  </p>
                )}
                {activePluginTab === 'asset' && assets.some(asset => asset.kind === 'data') && (
                  <section className="fresh-scriptable-library" aria-label="Scriptable Objects" data-testid="scriptable-object-library">
                    <strong>Project data assets</strong>
                    {assets.filter(asset => asset.kind === 'data').map(asset => (
                      <button type="button" key={asset.id} data-testid={`open-scriptable-${asset.id}`}
                        onClick={() => onEditScriptableObject(asset.id)}>
                        <span>{asset.name}</span>
                        <small>{asset.data?.fields.length ?? 0} fields · Edit</small>
                      </button>
                    ))}
                  </section>
                )}
                {activePluginTab === 'asset' && (
                  <section className="fresh-scriptable-library" aria-label="PBR Materials" data-testid="pbr-material-library">
                    <div className="pbr-library-heading">
                      <strong>PBR Materials</strong>
                      <button type="button" data-testid="create-pbr-material" onClick={onCreatePbrMaterial}>Create / Import</button>
                    </div>
                    <p className="fresh-inspector-note">
                      Reusable base color, normal, roughness, metalness, AO, and emissive materials.
                      Select one in an object’s settings to apply it.
                    </p>
                    {assets.filter(asset => asset.kind === 'pbr-material').map(asset => (
                      <div className="pbr-library-card" key={asset.id} data-testid={`pbr-material-${asset.id}`}>
                        <button type="button" className="pbr-library-edit" onClick={() => onEditPbrMaterial(asset.id)}>
                          <span>{asset.name}</span>
                          <small>{asset.pbrMaterial ? Object.values(asset.pbrMaterial.maps).filter(Boolean).length : 0} maps · Edit</small>
                        </button>
                        {selectedEntity?.components.some(component =>
                          component.type === 'primitive' ||
                          component.type === 'modelRenderer' && component.enabled && Boolean(component.assetId),
                        ) && <button type="button" className="fresh-plugin-add"
                          data-testid={`apply-pbr-material-${asset.id}`}
                          onClick={() => onSaveEntity(assignPbrMaterial(selectedEntity, asset.id))}>
                          Apply to {selectedEntity.name}
                        </button>}
                      </div>
                    ))}
                  </section>
                )}
                <p className="fresh-plugin-drop-hint">
                  {activePluginTab === 'asset' ? 'Scriptable Objects stay in this project; they are not added to the scene.'
                    : 'To edit an attached component, double-click its object in Hierarchy.'}
                </p>
              </div>
            </div>
          </details>
          <a
            className="fresh-settings-category-summary fresh-vision-board-button"
            href="vision-board/"
            data-testid="button-open-vision-board"
          >
              <h2>Vision Board</h2>
              <ChevronRight size={14} aria-hidden="true" />
          </a>
          {egoBox}
        </div>
      )}
    </div>
  );
}

function collectHierarchySubtreeIds(entities: SceneEntity[], rootId: string) {
  const removedIds = new Set([rootId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const entity of entities) {
      if (entity.parentId && removedIds.has(entity.parentId) && !removedIds.has(entity.id)) {
        removedIds.add(entity.id);
        changed = true;
      }
    }
  }
  return removedIds;
}

function HierarchyPanel({
  entities,
  camera,
  assets,
  selection,
  onSelect,
  onEditEntity,
  onAttachPlugin,
  onAttachPluginSet,
  onOpenCharacterBuilder,
  actions,
  blocked,
  onFocus,
  onDuplicate,
  onEditorChange,
  onEditorReset,
}: {
  entities: SceneEntity[];
  camera: GameCamera;
  assets: ProjectAsset[];
  selection: string | null;
  onSelect: (id: string) => void;
  onEditEntity: (entity: SceneEntity) => void;
  onAttachPlugin: (entityId: string, kind: PluginComponentKind) => void;
  onAttachPluginSet: (entityId: string, kinds: PluginComponentKind[], label: string) => void;
  onOpenCharacterBuilder: () => void;
  actions: HierarchyActions;
  blocked: boolean;
  onFocus: () => void;
  onDuplicate: () => void;
  onEditorChange: (id: string, flag: SceneEditorFlag, value: boolean) => void;
  onEditorReset: (flag: SceneEditorFlag) => void;
}) {
  const [sceneExpanded, setSceneExpanded] = useState(true);
  const [menuPoint, setMenuPoint] = useState<HierarchyMenuPoint | null>(null);
  const [menuEntityId, setMenuEntityId] = useState<string | null>(null);
  const sceneEntities = [primaryCameraEntity(camera), ...entities];
  const [search, setSearch] = useState('');
  const [hierarchyFilter, setHierarchyFilter] = useState<HierarchyFilter>('all');
  const filtering = Boolean(search.trim()) || hierarchyFilter !== 'all';
  const filtered = filterSceneHierarchy(sceneEntities, search, hierarchyFilter);
  const canAct = !blocked && entities.some(entity => entity.id === selection);
  const sceneViewControlsAvailable = !isPixelRpgScene(entities) && !isCardDuelScene(entities);

  function openMenu(x: number, y: number, entityId: string | null = null) {
    setMenuEntityId(entityId);
    setMenuPoint({
      x: Math.max(8, Math.min(x, window.innerWidth - 290)),
      y: Math.max(8, Math.min(y, window.innerHeight - 8)),
    });
  }

  function handleContextMenu(event: MouseEvent<HTMLElement>) {
    event.preventDefault();
    const target = event.target instanceof Element ? event.target : null;
    const row = target?.closest<HTMLElement>('[data-hierarchy-entity-id]');
    const entityId = row?.dataset.hierarchyEntityId;
    if (entityId) onSelect(entityId);
    openMenu(event.clientX, event.clientY, entityId ?? null);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return;
    event.preventDefault();
    const target = event.target instanceof Element ? event.target : null;
    const row = target?.closest<HTMLElement>('[data-hierarchy-entity-id]');
    const entityId = row?.dataset.hierarchyEntityId;
    if (entityId) onSelect(entityId);
    const bounds = (row ?? event.currentTarget).getBoundingClientRect();
    openMenu(bounds.left, bounds.bottom, entityId ?? null);
  }

  function requestDeleteEntity(entityId: string) {
    const entity = entities.find(entry => entry.id === entityId);
    if (!entity || entity.id === 'player') return;
    const descendantCount = collectHierarchySubtreeIds(entities, entityId).size - 1;
    const childNotice = descendantCount
      ? ` This will also delete ${descendantCount} child object${descendantCount === 1 ? '' : 's'}.`
      : '';
    if (!window.confirm(`Delete "${entity.name}"?${childNotice} You can use Undo to restore it during this editing session.`)) return;
    actions.onDeleteEntity(entityId);
  }

  const contextEntity = entities.find(entity => entity.id === menuEntityId);
  const terrainTargetId = entities.find(entity =>
    entity.id === (menuEntityId ?? selection) && getPrimitive(entity)?.shape === 'terrain',
  )?.id ?? null;
  return (
    <aside className="fresh-hierarchy" aria-label="Hierarchy"
      aria-description="Right-click to create scene objects, delete an object, import assets, or open the animation timeline. Use the trash button to delete an object. Double-click or double-tap an object to rename it and edit its settings."
      onContextMenu={handleContextMenu} onKeyDown={handleKeyDown}>
      <h2 className="fresh-hierarchy-heading">Hierarchy</h2>
      <HierarchySearchControls search={search} onSearch={setSearch} filter={hierarchyFilter} onFilter={setHierarchyFilter} />
      <div className="fresh-hierarchy-actions" role="group" aria-label="Selected object actions">
        <button type="button" disabled={!canAct} onClick={onFocus} title="Center the scene view on the selected object (F)" data-testid="button-focus-object">Focus <kbd>F</kbd></button>
        <button type="button" disabled={!canAct} onClick={onDuplicate} title="Copy the selected object and its children (Ctrl/Cmd+D). Assets and script files stay shared." data-testid="button-duplicate-object">Duplicate <kbd>Ctrl+D</kbd></button>
        {sceneViewControlsAvailable && <SceneEditorResetControls entities={entities} disabled={blocked} onReset={onEditorReset} />}
      </div>
      {filtering && <p className="fresh-hierarchy-search-count" role="status">{filtered.matches} matching object{filtered.matches === 1 ? '' : 's'}</p>}
      <button
        type="button"
        className="fresh-scene-root"
        aria-expanded={sceneExpanded || filtering}
        onClick={() => setSceneExpanded(value => !value)}
      >
        {sceneExpanded ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
        <span>Scene 1</span>
      </button>
      {(sceneExpanded || filtering) && (
        <SceneObjectRows
          entities={filtered.entities}
          forceOpen={filtering}
          parentId={null}
          depth={0}
          selection={selection}
          onSelect={onSelect}
          onEdit={onEditEntity}
          onDelete={requestDeleteEntity}
          onAttachPlugin={onAttachPlugin}
          editorBlocked={blocked}
          onEditorChange={sceneViewControlsAvailable ? onEditorChange : undefined}
        />
      )}
      {filtering && filtered.matches === 0 && <p className="fresh-hierarchy-help">No objects match. Clear the name or choose All objects.</p>}
      <p className="fresh-hierarchy-help">Right-click to create. Double-click an object to edit.</p>
      {menuPoint && (
        <HierarchyContextMenu
          point={menuPoint}
          assets={assets}
          terrainAvailable={terrainTargetId !== null}
          deleteTarget={contextEntity && contextEntity.id !== 'player' ? {
            id: contextEntity.id,
            name: contextEntity.name,
            childCount: collectHierarchySubtreeIds(entities, contextEntity.id).size - 1,
          } : null}
          targetEntityId={contextEntity?.id ?? null}
          onClose={() => { setMenuPoint(null); setMenuEntityId(null); }}
          onDeleteEntity={requestDeleteEntity}
          onCreateShape={actions.onCreateShape}
          onCreatePlane={actions.onCreatePlane}
          onCreateTerrain={actions.onCreateTerrain}
          onImportAsset={actions.onImportAsset}
          onUploadTexture={actions.onUploadTexture}
          onUseAsset={actions.onUseAsset}
          onCreateCamera={actions.onCreateCamera}
          onCreateLight={actions.onCreateLight}
          onCreateEffect={actions.onCreateEffect}
          onCreateUI={actions.onCreateUI}
          onCreateScript={actions.onCreateScript}
          onCreateTexture={actions.onCreateTexture}
          onOpenTimeline={actions.onOpenTimeline}
          onCreateEmpty={actions.onCreateEmpty}
          onTerrainBrush={action => terrainTargetId && actions.onTerrainBrush(terrainTargetId, action)}
          onAddTrees={() => terrainTargetId && actions.onAddTrees(terrainTargetId)}
          onAddWater={() => terrainTargetId && actions.onAddWater(terrainTargetId)}
          onAttachPlugin={onAttachPlugin}
          onAttachPluginSet={onAttachPluginSet}
          onOpenCharacterBuilder={onOpenCharacterBuilder}
        />
      )}
    </aside>
  );
}

type HierarchyActions = {
  onDeleteEntity: (entityId: string) => void;
  onCreateShape: (shape: PrimitiveShape) => void;
  onCreatePlane: (settings: PlaneSettings) => void;
  onCreateTerrain: (settings: TerrainSettings & { size: number }) => void;
  onImportAsset: () => void;
  onUploadTexture: () => void;
  onUseAsset: (asset: ProjectAsset) => void;
  onCreateCamera: () => void;
  onCreateLight: () => void;
  onCreateEffect: () => void;
  onCreateUI: (kind: UIElementKind) => void;
  onCreateScript: () => void;
  onCreateTexture: () => void;
  onOpenTimeline: () => void;
  onCreateEmpty: () => void;
  onTerrainBrush: (terrainId: string, action: TerrainToolAction, radius?: number, strength?: number) => void;
  onAddTrees: (terrainId: string, count?: number, spacing?: TreeSpacing) => void;
  onAddWater: (terrainId: string, coverage?: WaterCoverage, level?: WaterLevel) => void;
};

function SceneObjectRows({
  forceOpen = false,
  entities,
  parentId,
  depth,
  selection,
  onSelect,
  onEdit,
  onDelete,
  onAttachPlugin,
  editorParentFlags = NO_EDITOR_FLAGS,
  editorBlocked,
  onEditorChange,
}: {
  forceOpen?: boolean;
  entities: SceneEntity[];
  parentId: string | null;
  depth: number;
  selection: string | null;
  onSelect: (id: string) => void;
  onEdit: (entity: SceneEntity) => void;
  onDelete: (id: string) => void;
  onAttachPlugin: (entityId: string, kind: PluginComponentKind) => void;
  editorParentFlags?: SceneEditorFlags;
  editorBlocked: boolean;
  onEditorChange?: (id: string, flag: SceneEditorFlag, value: boolean) => void;
}) {
  const rows = entities.filter(entity => entity.parentId === parentId);
  if (rows.length === 0) return null;
  return (
    <ul className="fresh-hierarchy-list" role="group">
      {rows.map(entity => (
        <SceneObjectRow
          forceOpen={forceOpen}
          key={entity.id}
          entity={entity}
          entities={entities}
          depth={depth}
          selection={selection}
          onSelect={onSelect}
          onEdit={onEdit}
          onDelete={onDelete}
          onAttachPlugin={onAttachPlugin}
          editorParentFlags={editorParentFlags}
          editorBlocked={editorBlocked}
          onEditorChange={onEditorChange}
        />
      ))}
    </ul>
  );
}

function SceneObjectRow({
  forceOpen = false,
  entity,
  entities,
  depth,
  selection,
  onSelect,
  onEdit,
  onDelete,
  onAttachPlugin,
  editorParentFlags,
  editorBlocked,
  onEditorChange,
}: {
  forceOpen?: boolean;
  entity: SceneEntity;
  entities: SceneEntity[];
  depth: number;
  selection: string | null;
  onSelect: (id: string) => void;
  onEdit: (entity: SceneEntity) => void;
  onDelete: (id: string) => void;
  onAttachPlugin: (entityId: string, kind: PluginComponentKind) => void;
  editorParentFlags: SceneEditorFlags;
  editorBlocked: boolean;
  onEditorChange?: (id: string, flag: SceneEditorFlag, value: boolean) => void;
}) {
  const editorFlags = inheritSceneEditorFlags(entity.editor, editorParentFlags);
  const children = entities.some(candidate => candidate.parentId === entity.id);
  const [expanded, setExpanded] = useState(true);
  const [pluginDropTarget, setPluginDropTarget] = useState(false);
  const lastTouchTap = useRef(0);
  return (
    <li
      className={`fresh-hierarchy-row${pluginDropTarget ? ' is-plugin-drop-target' : ''}`}
      data-hierarchy-entity-id={entity.id}
      data-testid={`hierarchy-row-${entity.id}`}
      data-editor-hidden={editorFlags.hidden}
      data-editor-picking-locked={editorFlags.pickingLocked}
      onDragOver={event => {
        if (!event.dataTransfer.types.includes('application/x-madhorse-plugin')) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
        setPluginDropTarget(true);
      }}
      onDragLeave={event => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        setPluginDropTarget(false);
      }}
      onDrop={event => {
        event.preventDefault();
        event.stopPropagation();
        setPluginDropTarget(false);
        const kind = event.dataTransfer.getData('application/x-madhorse-plugin') as PluginComponentKind;
        if (kind) onAttachPlugin(entity.id, kind);
      }}
    >
      <div className="fresh-hierarchy-row-content" style={{ paddingLeft: 4 + depth * 14 }}>
        {children ? (
          <button
            type="button"
            className="fresh-hierarchy-disclosure"
            aria-label={`${expanded || forceOpen ? 'Collapse' : 'Expand'} ${entity.name}`}
            aria-expanded={expanded || forceOpen}
            disabled={forceOpen}
            onClick={() => setExpanded(value => !value)}
          >
            {expanded || forceOpen ? <ChevronDown size={13} aria-hidden="true" /> : <ChevronRight size={13} aria-hidden="true" />}
          </button>
        ) : <span className="fresh-hierarchy-disclosure-spacer" />}
        <SceneObjectGlyph entity={entity} />
        {entity.id !== PRIMARY_CAMERA_ID && onEditorChange && <SceneEditorControls entity={entity} inherited={editorParentFlags}
          disabled={editorBlocked} onChange={onEditorChange} />}
        <button
          type="button"
          className="fresh-hierarchy-item"
          aria-pressed={selection === entity.id}
          onClick={() => onSelect(entity.id)}
          onDoubleClick={() => { onSelect(entity.id); onEdit(entity); }}
          onPointerUp={event => {
            if (event.pointerType !== 'touch') return;
            const now = Date.now();
            if (now - lastTouchTap.current < 420) {
              lastTouchTap.current = 0;
              onSelect(entity.id);
              onEdit(entity);
            } else {
              lastTouchTap.current = now;
            }
          }}
        >
          <span>{entity.name}</span>
        </button>
        {entity.id !== PRIMARY_CAMERA_ID && entity.id !== 'player' && (
          <button
            type="button"
            className="fresh-hierarchy-delete"
            aria-label={`Delete ${entity.name}`}
            title={`Delete ${entity.name}`}
            onClick={() => onDelete(entity.id)}
          >
            <Trash2 size={13} aria-hidden="true" />
          </button>
        )}
      </div>
      {(expanded || forceOpen) && (
        <SceneObjectRows
          forceOpen={forceOpen}
          entities={entities}
          parentId={entity.id}
          depth={depth + 1}
          selection={selection}
          onSelect={onSelect}
          onEdit={onEdit}
          onDelete={onDelete}
          onAttachPlugin={onAttachPlugin}
          editorParentFlags={editorFlags}
          editorBlocked={editorBlocked}
          onEditorChange={onEditorChange}
        />
      )}
    </li>
  );
}

type Panel5Toolset = 'world' | 'model';
type Panel5WorldTool = TerrainToolAction | 'trees' | 'water';
type Panel5ModelTool = 'workspace' | 'import' | 'upload-texture' | 'create-texture' | PrimitiveShape;
type TexturePattern = 'checker' | 'stripes' | 'grid';
type TexturePalette = 'violet' | 'silver' | 'red';
type ModelCreateOptions = { scale: { x: number; y: number; z: number }; color: string };

function primitiveShapeIcon(shape: PrimitiveShape) {
  if (shape === 'plane') return Grid2X2;
  if (['sphere', 'circle', 'ring'].includes(shape)) return Circle;
  if (['torus', 'torus-knot'].includes(shape)) return Donut;
  if (['cylinder', 'hollow-cylinder', 'tube'].includes(shape)) return Cylinder;
  if (shape === 'cone') return Cone;
  if (shape === 'pyramid' || shape === 'tetrahedron' || shape === 'triangular-prism' || shape === 'wedge') return Triangle;
  if (shape === 'dodecahedron') return Pentagon;
  if (shape === 'octahedron') return Octagon;
  if (shape === 'icosahedron') return Diamond;
  if (shape === 'cube' || shape === 'rounded-cube') return Box;
  return Shapes;
}

function WorldToolsPanel({
  activeToolset,
  onSelectToolset,
  onCreateTerrain,
  onImportAsset,
  terrainAvailable,
  selectedObjectCanReceiveTexture,
  canEditSelectedModel,
  onTerrainBrush,
  onAddTrees,
  onAddWater,
  onCreateShape,
  onUploadTexture,
  onCreateTexture,
  onPreviewAnimation,
  onOpenModeling,
  onActiveToolChange,
}: {
  activeToolset: Panel5Toolset;
  onSelectToolset: (toolset: Panel5Toolset) => void;
  onCreateTerrain: () => void;
  onImportAsset: (modelScale: number) => void;
  terrainAvailable: boolean;
  selectedObjectCanReceiveTexture: boolean;
  canEditSelectedModel: boolean;
  onTerrainBrush: (action: TerrainToolAction, radius: number, strength: number) => void;
  onAddTrees: (count: number, spacing: TreeSpacing) => void;
  onAddWater: (coverage: WaterCoverage, level: WaterLevel) => void;
  onCreateShape: (shape: PrimitiveShape, options?: ModelCreateOptions) => void;
  onUploadTexture: (applyToSelectedObject: boolean) => void;
  onCreateTexture: (pattern: TexturePattern, palette: TexturePalette, applyToSelectedObject: boolean) => void;
  onPreviewAnimation: () => void;
  onOpenModeling: (editSelectedModel: boolean) => void;
  onActiveToolChange: (tool: SceneCursorTool | null) => void;
}) {
  const [selectedWorldTool, setSelectedWorldTool] = useState<Panel5WorldTool | null>(null);
  const [selectedModelTool, setSelectedModelTool] = useState<Panel5ModelTool | null>(null);
  const [brushRadius, setBrushRadius] = useState('8');
  const [brushStrength, setBrushStrength] = useState('2');
  const [treeCount, setTreeCount] = useState('3');
  const [treeSpacing, setTreeSpacing] = useState<TreeSpacing>('normal');
  const [waterCoverage, setWaterCoverage] = useState<WaterCoverage>('lake');
  const [waterLevel, setWaterLevel] = useState<WaterLevel>('normal');
  const [modelingTarget, setModelingTarget] = useState<'new' | 'selected'>('new');
  const [importScale, setImportScale] = useState('1');
  const [textureTarget, setTextureTarget] = useState<'new' | 'selected'>('new');
  const [texturePattern, setTexturePattern] = useState<TexturePattern>('checker');
  const [texturePalette, setTexturePalette] = useState<TexturePalette>('violet');
  const [shapeScale, setShapeScale] = useState('1');
  const [shapeColor, setShapeColor] = useState('#bfc3ca');
  const modelOptionsRef = useRef<HTMLElement | null>(null);
  const worldTools = [
    { id: 'create-terrain', label: 'Create Terrain', Icon: Mountain },
    { id: 'raise', label: 'Raise Terrain', Icon: ArrowUp },
    { id: 'lower', label: 'Lower Terrain', Icon: ArrowDown },
    { id: 'smooth', label: 'Smooth Terrain', Icon: Waves },
    { id: 'trees', label: 'Add Trees', Icon: Trees },
    { id: 'water', label: 'Add Water', Icon: Droplets },
  ] as const;

  function selectWorldTool(id: typeof worldTools[number]['id']) {
    setSelectedModelTool(null);
    if (id === 'create-terrain') {
      setSelectedWorldTool(null);
      onCreateTerrain();
      return;
    }
    setSelectedWorldTool(current => current === id ? null : id);
  }

  function applyWorldTool() {
    if (selectedWorldTool === 'raise' || selectedWorldTool === 'lower' || selectedWorldTool === 'smooth') {
      onTerrainBrush(selectedWorldTool, Number(brushRadius), Number(brushStrength));
    } else if (selectedWorldTool === 'trees') {
      onAddTrees(Number(treeCount), treeSpacing);
    } else if (selectedWorldTool === 'water') {
      onAddWater(waterCoverage, waterLevel);
    }
    setSelectedWorldTool(null);
  }

  const modelingTools = [
    { id: 'workspace', label: 'Model & Rig', Icon: Wrench },
    { id: 'import', label: 'Import Asset', Icon: Upload },
    { id: 'upload-texture', label: 'Upload Texture', Icon: ImagePlus },
    { id: 'create-texture', label: 'Make Texture', Icon: Palette },
  ] as const;

  useEffect(() => {
    if (activeToolset === 'world') {
      const tool = worldTools.find(item => item.id === selectedWorldTool);
      onActiveToolChange(tool ? { label: tool.label, Icon: tool.Icon } : null);
    } else {
      const tool = modelingTools.find(item => item.id === selectedModelTool);
      const shape = primitiveShapes.find(item => item.value === selectedModelTool);
      onActiveToolChange(tool ? { label: tool.label, Icon: tool.Icon } :
        shape ? { label: `Create ${shape.label}`, Icon: primitiveShapeIcon(shape.value) } : null);
    }
  }, [activeToolset, selectedWorldTool, selectedModelTool, onActiveToolChange]);

  function selectModelTool(id: Panel5ModelTool) {
    setSelectedWorldTool(null);
    setSelectedModelTool(current => current === id ? null : id);
  }

  useEffect(() => {
    if (selectedModelTool) modelOptionsRef.current?.scrollIntoView({ block: 'nearest' });
  }, [selectedModelTool]);

  function applyModelTool() {
    if (!selectedModelTool) return;
    if (selectedModelTool === 'workspace') {
      onOpenModeling(modelingTarget === 'selected');
    } else if (selectedModelTool === 'import') {
      onImportAsset(Number(importScale));
    } else if (selectedModelTool === 'upload-texture') {
      onUploadTexture(textureTarget === 'selected');
    } else if (selectedModelTool === 'create-texture') {
      onCreateTexture(texturePattern, texturePalette, textureTarget === 'selected');
    } else {
      const shape = primitiveShapes.find(item => item.value === selectedModelTool);
      if (shape) {
        const scale = Number(shapeScale);
        onCreateShape(shape.value, {
          scale: { x: scale, y: scale, z: scale },
          color: shapeColor,
        });
      }
    }
    setSelectedModelTool(null);
  }

  return (
    <div className="fresh-world-tools-panel">
      <div className="fresh-world-tools-tabs" role="group" aria-label="Panel 5 tool categories">
        <button
          type="button"
          className="fresh-world-tools-tab"
          aria-pressed={activeToolset === 'world'}
          data-active={activeToolset === 'world'}
          onClick={() => onSelectToolset('world')}
        >
          World Building Tools
        </button>
        <button
          type="button"
          className="fresh-world-tools-tab"
          aria-pressed={activeToolset === 'model'}
          data-active={activeToolset === 'model'}
          onClick={() => onSelectToolset('model')}
        >
          3D Modeling Tools
        </button>
      </div>
      <div
        className="fresh-world-tools-content"
        role="region"
        aria-label={activeToolset === 'world' ? 'World building tools' : '3D modeling tools'}
        data-testid="panel5-tool-content"
      >
        {activeToolset === 'world' ? (
          <>
          <div className="fresh-world-tool-grid fresh-world-tool-grid-world" role="group" aria-label="World building actions">
            {worldTools.map(({ id, label, Icon }) => {
              const toolId = id === 'create-terrain' ? null : id;
              const selected = toolId !== null && selectedWorldTool === toolId;
              const testId = id === 'create-terrain' ? 'panel5-create-terrain'
                : id === 'raise' ? 'panel5-raise-terrain'
                  : id === 'lower' ? 'panel5-lower-terrain'
                    : id === 'smooth' ? 'panel5-smooth-terrain'
                      : id === 'trees' ? 'panel5-add-trees' : 'panel5-add-water';
              return (
                <button
                  type="button"
                  key={id}
                  className="fresh-world-tool-button"
                  data-testid={testId}
                  data-selected={selected}
                  aria-pressed={toolId === null ? undefined : selected}
                  aria-expanded={toolId === null ? undefined : selected}
                  aria-controls={toolId === null ? undefined : 'panel5-world-tool-options'}
                  onClick={() => selectWorldTool(id)}
                >
                  <Icon size={15} strokeWidth={2.2} aria-hidden="true" />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
          {selectedWorldTool && (
            <section className="fresh-world-tool-options" id="panel5-world-tool-options" aria-label="Selected tool settings" data-testid="panel5-world-tool-options">
              <h3>{worldTools.find(tool => tool.id === selectedWorldTool)?.label} settings</h3>
              {selectedWorldTool === 'raise' || selectedWorldTool === 'lower' || selectedWorldTool === 'smooth' ? (
                <>
                  <label className="fresh-world-tool-setting">
                    <span>Brush size</span>
                    <select data-testid="panel5-brush-size" value={brushRadius} onChange={event => setBrushRadius(event.currentTarget.value)}>
                      <option value="4">Small</option>
                      <option value="8">Medium</option>
                      <option value="14">Large</option>
                    </select>
                  </label>
                  <label className="fresh-world-tool-setting">
                    <span>{selectedWorldTool === 'smooth' ? 'Smoothing' : 'Brush strength'}</span>
                    <select data-testid="panel5-brush-strength" value={brushStrength} onChange={event => setBrushStrength(event.currentTarget.value)}>
                      <option value="0.5">Light</option>
                      <option value="2">Medium</option>
                      <option value="4">Strong</option>
                    </select>
                  </label>
                </>
              ) : selectedWorldTool === 'trees' ? (
                <>
                  <label className="fresh-world-tool-setting">
                    <span>Tree count</span>
                    <select data-testid="panel5-tree-count" value={treeCount} onChange={event => setTreeCount(event.currentTarget.value)}>
                      <option value="3">3 trees</option>
                      <option value="6">6 trees</option>
                      <option value="9">9 trees</option>
                    </select>
                  </label>
                  <label className="fresh-world-tool-setting">
                    <span>Spacing</span>
                    <select data-testid="panel5-tree-spacing" value={treeSpacing} onChange={event => setTreeSpacing(event.currentTarget.value as TreeSpacing)}>
                      <option value="close">Close</option>
                      <option value="normal">Medium</option>
                      <option value="wide">Wide</option>
                    </select>
                  </label>
                </>
              ) : (
                <>
                  <label className="fresh-world-tool-setting">
                    <span>Water area</span>
                    <select data-testid="panel5-water-coverage" value={waterCoverage} onChange={event => setWaterCoverage(event.currentTarget.value as WaterCoverage)}>
                      <option value="pond">Pond</option>
                      <option value="lake">Lake</option>
                      <option value="river">River</option>
                      <option value="full">Full terrain</option>
                    </select>
                  </label>
                  <label className="fresh-world-tool-setting">
                    <span>Water level</span>
                    <select data-testid="panel5-water-level" value={waterLevel} onChange={event => setWaterLevel(event.currentTarget.value as WaterLevel)}>
                      <option value="low">Low</option>
                      <option value="normal">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </label>
                </>
              )}
              {!terrainAvailable && <p className="fresh-world-tool-hint">Select a Terrain in Hierarchy to apply this tool.</p>}
              <button type="button" className="fresh-world-tool-apply" data-testid="panel5-apply-world-tool"
                disabled={!terrainAvailable} onClick={applyWorldTool}>
                <Check size={14} aria-hidden="true" /> Apply {worldTools.find(tool => tool.id === selectedWorldTool)?.label}
              </button>
            </section>
          )}
          <p className="fresh-world-tool-hint">
            {terrainAvailable ? 'Tools edit the selected Terrain. Sculpt tools affect its center.'
              : 'Select a Terrain in Hierarchy, or create one to begin.'}
            {' '}Objects, empty objects, cameras, and lights are in the Hierarchy right-click menu.
          </p>
          </>
        ) : (
          <>
            <div className="fresh-world-tool-grid fresh-model-tool-grid" role="group" aria-label="3D modeling actions">
              {modelingTools.map(({ id, label, Icon }) => {
                const testId = id === 'workspace' ? 'panel5-model-workspace'
                  : id === 'import' ? 'panel5-import-model'
                    : id === 'upload-texture' ? 'panel5-upload-texture' : 'panel5-create-texture';
                return (
                  <button
                    type="button"
                    key={id}
                    className="fresh-world-tool-button"
                    data-testid={testId}
                    data-selected={selectedModelTool === id}
                    aria-pressed={selectedModelTool === id}
                    aria-expanded={selectedModelTool === id}
                    aria-controls="panel5-model-tool-options"
                    onClick={() => selectModelTool(id)}
                  >
                    <Icon size={15} strokeWidth={2.2} aria-hidden="true" />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
            {!selectedModelTool && (
              <>
                <p className="fresh-model-shapes-label">Create 3D Shape</p>
                <div className="fresh-model-shape-grid" aria-label="3D shape tools">
                  {primitiveShapes.map(shape => (
                    <button
                      type="button"
                      key={shape.value}
                      className="fresh-world-tool-button"
                      data-testid={`panel5-shape-${shape.value}`}
                      data-selected={false}
                      aria-pressed={false}
                      aria-expanded={false}
                      aria-controls="panel5-model-tool-options"
                      title={shape.label}
                      onClick={() => selectModelTool(shape.value)}
                    >
                      {(() => {
                        const Icon = primitiveShapeIcon(shape.value);
                        return <Icon size={14} strokeWidth={2.1} aria-hidden="true" />;
                      })()}
                      <span>{shape.label}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
            {selectedModelTool && (
              <section ref={modelOptionsRef} className="fresh-model-tool-options" id="panel5-model-tool-options" aria-label="3D modeling tool settings" data-testid="panel5-model-tool-options">
                <h3>
                  {selectedModelTool === 'workspace' ? 'Modeling workspace'
                    : selectedModelTool === 'import' ? 'Import asset'
                      : selectedModelTool === 'upload-texture' ? 'Upload texture'
                        : selectedModelTool === 'create-texture' ? 'Create texture'
                          : `Create ${primitiveShapes.find(shape => shape.value === selectedModelTool)?.label ?? 'shape'}`}
                </h3>
                {selectedModelTool === 'workspace' ? (
                  <>
                    <label className="fresh-world-tool-setting fresh-model-setting-full">
                      <span>What do you want to edit?</span>
                      <select data-testid="panel5-modeling-target" value={modelingTarget} onChange={event => setModelingTarget(event.currentTarget.value as 'new' | 'selected')}>
                        <option value="new">Start a new model</option>
                        <option value="selected" disabled={!canEditSelectedModel}>Edit selected 3D model</option>
                      </select>
                    </label>
                    {!canEditSelectedModel && <p className="fresh-world-tool-hint">Select an imported 3D model to edit it, or start a new model.</p>}
                  </>
                ) : selectedModelTool === 'import' ? (
                  <label className="fresh-world-tool-setting fresh-model-setting-full">
                      <span>Imported model size</span>
                    <select data-testid="panel5-model-import-size" value={importScale} onChange={event => setImportScale(event.currentTarget.value)}>
                      <option value="0.5">Small</option>
                      <option value="1">Normal</option>
                      <option value="2">Large</option>
                    </select>
                  </label>
                ) : selectedModelTool === 'upload-texture' || selectedModelTool === 'create-texture' ? (
                  <>
                    {selectedModelTool === 'create-texture' && (
                      <>
                        <label className="fresh-world-tool-setting">
                          <span>Pattern</span>
                          <select data-testid="panel5-texture-pattern" value={texturePattern} onChange={event => setTexturePattern(event.currentTarget.value as TexturePattern)}>
                            <option value="checker">Checker</option>
                            <option value="stripes">Stripes</option>
                            <option value="grid">Grid</option>
                          </select>
                        </label>
                        <label className="fresh-world-tool-setting">
                          <span>Colors</span>
                          <select data-testid="panel5-texture-palette" value={texturePalette} onChange={event => setTexturePalette(event.currentTarget.value as TexturePalette)}>
                            <option value="violet">Madhorse violet</option>
                            <option value="silver">Silver</option>
                            <option value="red">Fire red</option>
                          </select>
                        </label>
                      </>
                    )}
                    <label className="fresh-world-tool-setting fresh-model-setting-full">
                      <span>Where should it go?</span>
                      <select data-testid="panel5-texture-target" value={textureTarget} onChange={event => setTextureTarget(event.currentTarget.value as 'new' | 'selected')}>
                        <option value="new">Add as a new 2D image object</option>
                        <option value="selected" disabled={!selectedObjectCanReceiveTexture}>Apply to selected 3D shape</option>
                      </select>
                    </label>
                    {!selectedObjectCanReceiveTexture && textureTarget === 'selected' && <p className="fresh-world-tool-hint">Select a 3D shape to put a texture on it.</p>}
                  </>
                ) : (
                  <>
                    <label className="fresh-world-tool-setting">
                      <span>Size</span>
                      <select data-testid="panel5-shape-size" value={shapeScale} onChange={event => setShapeScale(event.currentTarget.value)}>
                        <option value="0.5">Small</option>
                        <option value="1">Normal</option>
                        <option value="2">Large</option>
                      </select>
                    </label>
                    <label className="fresh-world-tool-setting">
                      <span>Surface color</span>
                      <select data-testid="panel5-shape-color" value={shapeColor} onChange={event => setShapeColor(event.currentTarget.value)}>
                        <option value="#bfc3ca">Silver</option>
                        <option value="#d83d42">Fire red</option>
                        <option value="#9b5de5">Madhorse violet</option>
                        <option value="#454b55">Graphite</option>
                      </select>
                    </label>
                  </>
                )}
                <button
                  type="button"
                  className="fresh-world-tool-apply"
                  data-testid="panel5-apply-model-tool"
                  disabled={(selectedModelTool === 'workspace' && modelingTarget === 'selected' && !canEditSelectedModel)
                    || ((selectedModelTool === 'upload-texture' || selectedModelTool === 'create-texture')
                      && textureTarget === 'selected' && !selectedObjectCanReceiveTexture)}
                  onClick={applyModelTool}
                >
                  <Check size={14} aria-hidden="true" />
                  {selectedModelTool === 'workspace' ? 'Open Modeling Workspace'
                      : selectedModelTool === 'import' ? 'Choose Asset File'
                      : selectedModelTool === 'upload-texture' ? 'Choose Texture File'
                        : selectedModelTool === 'create-texture' ? 'Create Texture'
                          : 'Create Shape'}
                </button>
                <button
                  type="button"
                  className="fresh-model-tool-cancel"
                  data-testid="panel5-cancel-model-tool"
                  onClick={() => setSelectedModelTool(null)}
                >
                  Cancel
                </button>
              </section>
            )}
          </>
        )}
      </div>
      <button
        type="button"
        className="fresh-animation-preview-button"
        onClick={onPreviewAnimation}
        data-testid="button-preview-animation-scene"
      >
        Preview Animation Scene
      </button>
    </div>
  );
}

function assignPbrMaterial(entity: SceneEntity, materialAssetId: string): SceneEntity {
  const hasAssignedModel = entity.components.some(component =>
    component.type === 'modelRenderer' && component.enabled && Boolean(component.assetId));
  return {
    ...entity,
    components: entity.components.map(component => {
      if (hasAssignedModel && component.type === 'modelRenderer') return { ...component, materialAssetId };
      if (!hasAssignedModel && component.type === 'primitive') return { ...component, materialAssetId };
      return component;
    }),
  };
}

export default function BlankWorkspace({ projectId, projectName, projectControls }: {
  projectId: string; projectName: string; projectControls: (disabled: boolean, snapshot: FreshWorkspaceSnapshot) => ReactNode;
}) {
  const [initialScene] = useState(() => {
    const entities = [createStarterCube()];
    return { entities, camera: createGameCamera(entities) };
  });
  const [savedWorkspace] = useState(() => loadFreshWorkspace(projectId));
  const [saveFailed, setSaveFailed] = useState(false);
  const [entities, setEntities] = useState(savedWorkspace.entities ?? initialScene.entities);
  const [camera, setCamera] = useState<GameCamera>(savedWorkspace.camera ?? initialScene.camera);
  const [assets, setAssets] = useState<ProjectAsset[]>(savedWorkspace.assets ?? []);
  const [editingScriptableObjectId, setEditingScriptableObjectId] = useState<string | null>(null);
  const [editingPbrMaterialId, setEditingPbrMaterialId] = useState<string | null>(null);
  const [animations, setAnimations] = useState<GameAnimation[]>(savedWorkspace.animations ?? []);
  const animationsRef = useRef(animations);
  const [animationControllers, setAnimationControllers] = useState<EgoAnimationController[]>(savedWorkspace.animationControllers ?? []);
  const animationControllersRef = useRef(animationControllers);
  const [builderHistory, setBuilderHistory] = useState<BuilderMessage[]>(savedWorkspace.builderHistory ?? []);
  const [builderDraft, setBuilderDraft] = useState<MadBuilderPlan | null>(savedWorkspace.builderDraft ?? null);
  const [builderDraftRequest, setBuilderDraftRequest] = useState(savedWorkspace.builderDraftRequest ?? '');
  const [egoGameVision, setEgoGameVision] = useState(savedWorkspace.egoGameVision ?? '');
  const [egoGameFlow, setEgoGameFlow] = useState<EgoGameFlow>(savedWorkspace.egoGameFlow ?? 'undecided');
  const [egoGameNotes, setEgoGameNotes] = useState(savedWorkspace.egoGameNotes ?? '');
  const [projectSetup] = useState(savedWorkspace.projectSetup);
  const [builderBuildLogs, setBuilderBuildLogs] = useState<MadBuilderBuildLog[]>(savedWorkspace.builderBuildLogs ?? []);
  const [prefabs, setPrefabs] = useState<ScenePrefab[]>(savedWorkspace.prefabs ?? []);
  const [uiControls, setUIControls] = useState<UIControlElement[]>(savedWorkspace.uiControls ?? []);
  const [egoScripts, setEgoScripts] = useState<ScriptFile[]>(savedWorkspace.scripts ?? []);
  const latestProjectSnapshot: FreshWorkspaceSnapshot = {
    projectName, projectSetup, egoGameVision, egoGameFlow, egoGameNotes,
    entities, camera, assets, animations, animationControllers, builderHistory, builderDraft, builderDraftRequest,
    builderBuildLogs, prefabs, uiControls, scripts: egoScripts,
  };
  const [assetUrls, setAssetUrls] = useState<Record<string, string>>({});
  const [selection, setSelection] = useState<string | null>('starter-cube');
  const [characterFrameRequest, setCharacterFrameRequest] = useState<SceneFrameRequest | null>(null);
  const characterFrameToken = useRef(0);
  const [editingEntityId, setEditingEntityId] = useState<string | null>(null);
  const [madBuilderOpen, setMadBuilderOpen] = useState(false);
  const [egoOpen, setEgoOpen] = useState(false);
  const [starterKitsOpen, setStarterKitsOpen] = useState(false);
  const [storyboardOpen, setStoryboardOpen] = useState(false);
  const [modelingOpen, setModelingOpen] = useState(false);
  const [modelingSource, setModelingSource] = useState<{ url: string; name: string } | undefined>();
  const [previewEntities, setPreviewEntities] = useState<SceneEntity[] | null>(null);
  const [playTestOn, setPlayTestOn] = useState(false);
  const [canvasView, setCanvasView] = useState(() => savedWorkspace.projectSetup?.dimension === '2d');
  const [activeSceneTool, setActiveSceneTool] = useState<SceneCursorTool | null>(null);
  const [runtimeEntities, setRuntimeEntities] = useState<SceneEntity[] | null>(null);
  const [runtimeCamera, setRuntimeCamera] = useState<GameCamera | null>(null);
  const [runtimeActionHud, setRuntimeActionHud] = useState<ActionHud | null>(null);
  const [multiplayerMember, setMultiplayerMember] = useState<MultiplayerRoomMember | null>(null);
  const [multiplayerSnapshot, setMultiplayerSnapshot] = useState<MultiplayerRoomSnapshot | null>(null);
  const multiplayerMemberRef = useRef<MultiplayerRoomMember | null>(null);
  const multiplayerSnapshotRef = useRef<MultiplayerRoomSnapshot | null>(null);
  const runtimeEntitiesRef = useRef<SceneEntity[] | null>(null);
  const playTestOnRef = useRef(false);
  multiplayerMemberRef.current = multiplayerMember;
  multiplayerSnapshotRef.current = multiplayerSnapshot;
  runtimeEntitiesRef.current = runtimeEntities ?? entities;
  playTestOnRef.current = playTestOn;
  const runtimeInputRef = useRef({ held: new Set<string>(), tapped: new Set<string>() });
  const playPlayerRef = useRef<string | null>(null);
  const onRuntimeKey = useCallback((key: string, down: boolean) => {
    const input = runtimeInputRef.current;
    if (down) {
      unlockSceneAudio();
      if (!input.held.has(key)) input.tapped.add(key);
      input.held.add(key);
    } else input.held.delete(key);
  }, []);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [panel5Toolset, setPanel5Toolset] = useState<Panel5Toolset>('world');
  const [panel5Dialog, setPanel5Dialog] = useState<'plane' | 'terrain' | null>(null);
  const [panel5PlaneOptions, setPanel5PlaneOptions] = useState<ModelCreateOptions | null>(null);
  const [status, setStatus] = useState('');
  const [debuggerOpen, setDebuggerOpen] = useState(false);
  const systemActivity = useSyncExternalStore(subscribeSystemActivity, getSystemActivity, getSystemActivity);
  const historyBlocked = playTestOn || saveFailed || modelingOpen || systemActivity.pending > 0;
  const authoredState = useMemo(() => ({
    entities, camera, assets, animations, animationControllers, prefabs, uiControls, scripts: egoScripts,
  }), [entities, camera, assets, animations, animationControllers, prefabs, uiControls, egoScripts]);
  const editHistory = useSceneEditHistory(authoredState, next => {
    setEntities(next.entities); setCamera(next.camera); setAssets(next.assets);
    animationsRef.current = next.animations; setAnimations(next.animations);
    animationControllersRef.current = next.animationControllers; setAnimationControllers(next.animationControllers);
    setPrefabs(next.prefabs); setUIControls(next.uiControls); setEgoScripts(next.scripts);
    setPreviewEntities(null);
    setSelection(current => current === PRIMARY_CAMERA_ID || next.entities.some(entity => entity.id === current) ? current : null);
    setEditingEntityId(null); setEditingScriptableObjectId(null); setEditingPbrMaterialId(null);
  }, historyBlocked, setStatus);
  const focusSelectedObject = useCallback(() => {
    if (historyBlocked || !entities.some(entity => entity.id === selection)) return;
    setCanvasView(false);
    setCharacterFrameRequest(previous => ({ targetId: selection!, token: (previous?.token ?? 0) + 1 }));
    setStatus('Scene view centered on the selected object. Your Game Camera has not moved.');
  }, [historyBlocked, entities, selection]);
  const duplicateSelectedObject = useCallback(() => {
    if (historyBlocked || !selection || !entities.some(entity => entity.id === selection)) return;
    try {
      const copy = duplicateSceneSelection(authoredState, selection);
      setEntities(copy.state.entities);
      animationsRef.current = copy.state.animations; setAnimations(copy.state.animations);
      animationControllersRef.current = copy.state.animationControllers; setAnimationControllers(copy.state.animationControllers);
      setUIControls(copy.state.uiControls);
      setSelection(copy.rootId);
      setStatus(`Duplicated ${copy.count} object${copy.count === 1 ? '' : 's'} at the same position. Use Move to position the copy. Undo is available.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not duplicate this object. No scene changes were made.');
    }
  }, [authoredState, historyBlocked, entities, selection]);
  useEffect(() => {
    const handleObjectShortcut = (event: globalThis.KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.altKey || historyBlocked) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('input, textarea, select, [contenteditable="true"], [role="textbox"], [role="dialog"], [role="alertdialog"]')
        || document.querySelector('[aria-modal="true"]')) return;
      if (!selection || !entities.some(entity => entity.id === selection)) return;
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 'd') {
        event.preventDefault(); duplicateSelectedObject();
      } else if (!event.ctrlKey && !event.metaKey && !event.shiftKey && event.key.toLowerCase() === 'f') {
        event.preventDefault(); focusSelectedObject();
      }
    };
    window.addEventListener('keydown', handleObjectShortcut);
    return () => window.removeEventListener('keydown', handleObjectShortcut);
  }, [historyBlocked, selection, entities, duplicateSelectedObject, focusSelectedObject]);
  useEffect(() => {
    if (status) publishStatus('editor', status);
  }, [status]);
  const importInputRef = useRef<HTMLInputElement>(null);
  const textureInputRef = useRef<HTMLInputElement>(null);
  const importScaleRef = useRef(1);
  const textureApplyTargetRef = useRef(false);
  const editingEntity = editingEntityId === PRIMARY_CAMERA_ID
    ? primaryCameraEntity(camera)
    : entities.find(entity => entity.id === editingEntityId) ?? null;
  const selectedEntity = selection === PRIMARY_CAMERA_ID
    ? primaryCameraEntity(camera)
    : entities.find(entity => entity.id === selection) ?? null;
  const editingScriptableObject = assets.find(asset => asset.id === editingScriptableObjectId && asset.kind === 'data') ?? null;
  const editingPbrMaterial = editingPbrMaterialId && editingPbrMaterialId !== 'new'
    ? assets.find(asset => asset.id === editingPbrMaterialId && asset.kind === 'pbr-material') ?? null
    : null;
  function createScriptableObject() {
    const asset = createScriptableObjectAsset();
    setAssets(current => [...current, asset]);
    setEditingScriptableObjectId(asset.id);
    setStatus('Created a Scriptable Object. Add or change its fields, then save the data asset.');
  }
  function saveScriptableObject(asset: ProjectAsset) {
    if (asset.kind !== 'data' || !isProjectAsset(asset)) return;
    setAssets(current => current.map(item => item.id === asset.id ? asset : item));
    setEditingScriptableObjectId(null);
    setStatus(`${asset.name} saved with this project.`);
  }
  function savePbrMaterial(asset: ProjectAsset) {
    if (asset.kind !== 'pbr-material' || !isProjectAsset(asset)) {
      setStatus('PBR material could not be saved. Check its values and texture maps.');
      return;
    }
    setAssets(current => current.some(item => item.id === asset.id)
      ? current.map(item => item.id === asset.id ? asset : item)
      : [...current, asset]);
    setEditingPbrMaterialId(null);
    setStatus(`${asset.name} saved as a reusable project PBR material.`);
  }
  async function importPbrMaps(files: File[]): Promise<ProjectAsset[]> {
    if (files.length > 16) throw new Error('Import up to 16 texture maps at a time.');
    const imported = files.map(file => {
      if (file.size > WORKSPACE_ASSET_LIMIT) throw new Error(`${file.name} exceeds the 100 MB browser asset limit.`);
      if (projectAssetKind(file.name, file.type) !== 'image') {
        throw new Error('PBR maps must be PNG, JPEG, or WebP images.');
      }
      return {
        id: crypto.randomUUID(),
        name: file.name,
        kind: 'image' as const,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        addedAt: new Date().toISOString(),
      };
    });
    const results = await Promise.allSettled(imported.map((asset, index) =>
      saveLocalAsset(projectId, asset.id, files[index])));
    const failed = results.find(result => result.status === 'rejected');
    if (failed?.status === 'rejected') {
      await Promise.allSettled(imported.map(asset => deleteLocalAsset(projectId, asset.id)));
      throw failed.reason instanceof Error ? failed.reason : new Error('Could not store all PBR maps on this device.');
    }
    setAssets(current => [...current, ...imported]);
    return imported;
  }
  const builderProject: BuilderDocument = {
    id: projectId,
    entities,
    assets,
    prefabs,
    uiControls,
    scripts: egoScripts,
    builderHistory,
    builderDraft,
    builderDraftRequest,
    builderBuildLogs,
  };
  const builderProjectRef = useRef(builderProject);
  builderProjectRef.current = builderProject;

  const setBuilderProjects: Dispatch<SetStateAction<BuilderDocument[]>> = useCallback(update => {
    const projects = typeof update === 'function' ? update([builderProjectRef.current]) : update;
    const next = projects.find(project => project.id === projectId);
    if (!next) return;
    builderProjectRef.current = next;
    setEntities(next.entities);
    setAssets(next.assets);
    setBuilderHistory(next.builderHistory ?? []);
    setBuilderDraft(next.builderDraft ?? null);
    setBuilderDraftRequest(next.builderDraftRequest ?? '');
    setBuilderBuildLogs(next.builderBuildLogs ?? []);
    setPrefabs(next.prefabs ?? []);
    setUIControls(next.uiControls ?? []);
    setEgoScripts(next.scripts ?? []);
  }, [projectId]);

  const createEgoProjectScript = useCallback((script: ScriptFile) => {
    const current = builderProjectRef.current;
    const error = scriptStorageError(script.content, current.scripts ?? []);
    if (error) return error;
    setBuilderProjects([{ ...current, scripts: [...(current.scripts ?? []), script] }]);
    setStatus(`${script.name} saved to this browser project.`);
    return '';
  }, [setBuilderProjects]);

  const updateEgoProjectScript = useCallback((script: ScriptFile) => {
    const current = builderProjectRef.current;
    if (!(current.scripts ?? []).some((entry) => entry.id === script.id)) return 'This script is no longer in the project.';
    const error = scriptStorageError(script.content, current.scripts ?? [], script.id);
    if (error) return error;
    setBuilderProjects([{
      ...current,
      scripts: (current.scripts ?? []).map((entry) => entry.id === script.id ? script : entry),
    }]);
    return '';
  }, [setBuilderProjects]);

  const deleteEgoProjectScript = useCallback((id: string) => {
    const current = builderProjectRef.current;
    setBuilderProjects([{ ...current, scripts: (current.scripts ?? []).filter((script) => script.id !== id) }]);
  }, [setBuilderProjects]);

  const buildEgoUiKit = useCallback((gameTypes: EgoGameType[], gameVision: string) => {
    const current = builderProjectRef.current;
    const controls = createEgoGameUiKit(gameTypes, current.uiControls?.length ?? 0, gameVision);
    setBuilderProjects([{
      ...current,
      uiControls: [...(current.uiControls ?? []), ...controls],
    }]);
    const message = `Ego added ${controls.length} editable ${getEgoGameSelectionLabel(gameTypes)} UI elements to the project.`;
    setStatus(message);
    return message;
  }, [setBuilderProjects]);

  const addEgoGameFunctions = useCallback((gameTypes: EgoGameType[]) => {
    const current = builderProjectRef.current;
    const existingPlayer = current.entities.find(entity =>
      entity.components.some(component => component.type === 'characterController' && component.role === 'player'));
    const generatedCharacter = existingPlayer ? undefined : current.entities.find(entity =>
      entity.generatedBy === 'character-builder' &&
      /^Character ·/.test(entity.name) &&
      !entity.components.some(component => component.type === 'characterController'));
    const player = existingPlayer ?? generatedCharacter ?? createSceneEntity('Player', { x: 0, y: 0, z: 0 }, null, false);
    const components: SceneComponent[] = [...player.components];
    const createdPlayer = !existingPlayer && !generatedCharacter;
    if (!components.some(component => component.type === 'characterController' && component.role === 'player')) {
      components.push(createPluginComponent('character-controller-player', current.uiControls?.length ?? 0).component);
    }
    const usedKeys = new Set(components.flatMap(component =>
      component.type === 'playerAction' && component.enabled ? [component.key]
        : component.type === 'gameFeature' && component.enabled && component.kind === 'interact'
          ? [String(component.settings.key)] : [],
    ));
    const addedActions: string[] = [];
    const selectedActions = [...new Set(gameTypes.flatMap(gameType => egoPlayerActions[gameType]))];
    for (const action of selectedActions) {
      if (components.some(component => component.type === 'playerAction' && component.action === action)) continue;
      const result = createPluginComponent(`action-${action}` as PluginComponentKind, current.uiControls?.length ?? 0);
      if (result.component.type !== 'playerAction') continue;
      if (usedKeys.has(result.component.key)) {
        const freeKey = actionKeyOptions.find(key => !usedKeys.has(key));
        if (!freeKey) continue;
        result.component.key = freeKey;
      }
      usedKeys.add(result.component.key);
      components.push(result.component);
      addedActions.push(playerActionDefinitions[result.component.action].label);
    }
    const racingTune = gameTypes.includes('car-racing')
      ? { acceleration: 7, maxSpeed: 48, turnSpeed: 92 }
      : gameTypes.includes('kart-racing')
        ? { acceleration: 13, maxSpeed: 24, turnSpeed: 155 }
        : null;
    if (racingTune) {
      const raceActionIndex = components.findIndex(component =>
        component.type === 'playerAction' && component.action === 'race',
      );
      const raceAction = components[raceActionIndex];
      if (raceAction?.type === 'playerAction') {
        components[raceActionIndex] = { ...raceAction, settings: { ...raceAction.settings, ...racingTune } };
      }
    }
    if (createdPlayer && !components.some(component => component.type === 'physics')) {
      components.push(createPluginComponent('physics', current.uiControls?.length ?? 0).component);
    }
    if (!createdPlayer && addedActions.length === 0) {
      const message = `The Player already has the supported ${getEgoGameSelectionLabel(gameTypes)} functions.`;
      setStatus(message);
      return message;
    }
    const updatedPlayer = { ...player, components };
    const entities = existingPlayer
      ? current.entities.map(entity => entity.id === player.id ? updatedPlayer : entity)
      : generatedCharacter
        ? current.entities.map(entity => entity.id === player.id ? updatedPlayer : entity)
        : [...current.entities, updatedPlayer];
    let animationMessage = '';
    if (!animationControllersRef.current.some(controller => controller.targetEntityId === player.id)) {
      const pack = createEgoAnimationPack(entities, player.id, gameTypes);
      const nextAnimations = [...animationsRef.current, ...pack.animations];
      const nextControllers = [...animationControllersRef.current, pack.controller];
      if (isGameAnimationCollection(nextAnimations) && isEgoAnimationControllerCollection(nextControllers)) {
        animationsRef.current = nextAnimations;
        animationControllersRef.current = nextControllers;
        setAnimations(nextAnimations);
        setAnimationControllers(nextControllers);
        animationMessage = ` Ego added ${pack.animations.length} editable animation clips and a Play/Test state controller.`;
      } else {
        animationMessage = ' Animation storage is full, so no new controller was added.';
      }
    }
    setBuilderProjects([{ ...current, entities }]);
    setSelection(player.id);
    setEditingEntityId(null);
    const message = `Ego added ${addedActions.length ? addedActions.join(', ') : 'a Player Controller'} for ${getEgoGameSelectionLabel(gameTypes)}${createdPlayer ? ' and created a Player object' : ''}.${animationMessage}`;
    setStatus(message);
    return message;
  }, [setBuilderProjects]);

  const addMadBuilderModule = useCallback((moduleId: MadBuilderModuleId) => {
    try {
      const current = builderProjectRef.current;
      const module = getMadBuilderModule(moduleId);
      const modulePlan = createMadBuilderModulePlan(moduleId);
      const savedPrefab = (current.prefabs ?? []).find((prefab) => prefab.name === module.prefabName);
      let newPrefab: ScenePrefab | null = null;
      let moduleEntities: SceneEntity[];
      let moduleControls: UIControlElement[] = [];
      let rootId: string;

      if (savedPrefab) {
        const instance = instantiatePrefab(savedPrefab);
        moduleEntities = instance.entities;
        moduleControls = instance.uiControls;
        rootId = instance.rootId;
        const root = moduleEntities.find((entity) => entity.id === rootId);
        if (root) {
          getTransform(root).position = {
            x: 50 + (current.entities.length % 8) * 12,
            y: 50 + Math.floor(current.entities.length / 8) * 12,
            z: 0,
          };
        }
      } else {
        const build = compileBuilderPlan(modulePlan, current.entities, current.assets);
        moduleEntities = build.entities;
        moduleControls = build.uiControls;
        rootId = build.rootId;
        newPrefab = capturePrefab(build.entities, build.rootId, module.prefabName, build.uiControls);
      }

      const request = `Add reusable ${module.category} module: ${module.label}`;
      const response: BuilderMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: `Added ${module.label} as ${moduleEntities.length - 1} editable parts${savedPrefab ? ' from the reusable module library.' : ' and saved it to the reusable module library.'}`,
      };
      const buildLog: MadBuilderBuildLog = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        request,
        plan: modulePlan,
        objectNames: moduleEntities.map((entity) => entity.name),
        uiControlNames: [],
        prefabSaved: true,
      };
      setBuilderProjects([{
        ...current,
        entities: [...current.entities, ...moduleEntities],
        uiControls: [...(current.uiControls ?? []), ...moduleControls],
        prefabs: newPrefab ? [...(current.prefabs ?? []), newPrefab] : current.prefabs,
        builderHistory: [...(current.builderHistory ?? []), response].slice(-40),
        builderBuildLogs: [...(current.builderBuildLogs ?? []), buildLog],
      }]);
      setSelection(rootId);
      setEditingEntityId(null);
      setStatus(`${module.label} added to Scene 1 as editable parts and saved as a reusable prefab.`);
    } catch (failure) {
      setStatus(failure instanceof Error ? failure.message : 'Could not add this reusable module.');
    }
  }, [setBuilderProjects]);

  const madBuilder = useMadBuilder({
    project: builderProject,
    activeProjectRef: builderProjectRef,
    setProjects: setBuilderProjects,
    readOnly: false,
    selectedEntityId: selection,
    onBuilt: rootId => {
      setSelection(rootId);
      setEditingEntityId(null);
      setMadBuilderOpen(false);
      setStatus('Mad Builder built the objects into Scene 1. Select them in the hierarchy to edit.');
    },
  });
  const madBuilderWithEgoTools = {
    ...madBuilder,
    onPlan: async (
      prompt: Parameters<typeof madBuilder.onPlan>[0],
      saveAsPrefab: Parameters<typeof madBuilder.onPlan>[1],
      style: Parameters<typeof madBuilder.onPlan>[2],
      buildCategory: Parameters<typeof madBuilder.onPlan>[3],
      referenceImages: Parameters<typeof madBuilder.onPlan>[4],
    ) => {
      const isTwoDimensional = /\b(?:2d|sprite|pixel[- ]art)\b/i.test(prompt);
      const hasUserTargetImage = referenceImages.some(reference => reference.role === 'user-target');
      const fighterAppearances = buildCategory === 'fighting'
        ? parseFightingAppearancePrompt(prompt) ?? defaultFightingAppearancePair
        : null;
      let requestedCharacters = fighterAppearances
        ? [
          { species: fighterAppearances.player.race, displayName: 'Player Fighter', heightMeters: 1.8 },
          { species: fighterAppearances.rival.race, displayName: 'Training Rival', heightMeters: 1.8 },
        ]
        : isTwoDimensional || hasUserTargetImage
        ? [] : detectEgoCharacterRequests(prompt, 'prompt');
      if (!isTwoDimensional && !hasUserTargetImage && requestedCharacters.length === 0 &&
        /\b(?:build|create|make|model|design)\b.{0,36}\b(?:3d\s+)?(?:character|avatar|hero|fighter)\b/i.test(prompt)) {
        requestedCharacters = [{ species: 'human', displayName: 'Character', heightMeters: 1.8 }];
      }
      requestedCharacters = requestedCharacters.slice(0, 4);
      const originalEntityIds = new Set(builderProjectRef.current.entities.map(entity => entity.id));
      const result = await madBuilder.onPlan(
        prompt,
        saveAsPrefab,
        style,
        buildCategory,
        referenceImages,
        requestedCharacters.length > 0,
      );
      if (!result.ok || requestedCharacters.length === 0) return result;

      try {
        const current = builderProjectRef.current;
        const buildRoot = current.entities.find(entity =>
          !originalEntityIds.has(entity.id) &&
          entity.generatedBy === 'mad-builder' &&
          entity.isGroup &&
          !entity.parentId,
        );
        if (!buildRoot) {
          return {
            ok: true,
            message: `${result.message} The scene plan was kept, but the character tool could not find its new scene group.`,
          };
        }
        const rootTransform = getTransform(buildRoot);
        const gameTypeMatchers: Partial<Record<EgoGameType, RegExp>> = {
          rpg: /\brpg\b|role[- ]?playing|quest/i,
          racing: /\bracing\b/i,
          'kart-racing': /\bkart\b/i,
          'car-racing': /\bcar racing\b/i,
          sports: /\bsports?\b/i,
          fighting: /\bfight(?:ing)?\b|combat|arena|mugen/i,
          rts: /\brts\b|real[- ]time strategy/i,
          card: /\bcard game|deck[- ]building\b/i,
          mmo: /\bmmorpg\b|\bmmo\b/i,
          shooter: /\bshooter\b|shooting game/i,
          'third-person-shooter': /\bthird[- ]person shooter\b|over[- ]the[- ]shoulder shooter/i,
          'kingdom-strategy': /\bkingdom strateg(?:y|ies)\b|kingdom builder/i,
          'creature-adventure-2d': /\b2d\b.*\bcreature\b|\bcreature\b.*\b2d\b/i,
          'creature-adventure-3d': /\b3d\b.*\bcreature\b|\bcreature\b.*\b3d\b/i,
          platformer: /\bplatformer\b/i,
        };
        const requestedTypes = (Object.keys(egoPlayerActions) as EgoGameType[])
          .filter(type => gameTypeMatchers[type]?.test(prompt));
        const gameTypes: EgoGameType[] = requestedTypes.length ? requestedTypes : ['platformer'];
        let clothingTextureAsset = current.assets.find(asset => asset.name === 'madhorse-woven-clothing-texture.svg');
        if (!clothingTextureAsset) {
          const generatedTexture = createEgoClothingTextureAsset();
          await saveLocalAsset(projectId, generatedTexture.asset.id, generatedTexture.file);
          clothingTextureAsset = generatedTexture.asset;
        }
        const characterBuilds = requestedCharacters.map((request, index) => {
          const build = createEgoCharacterScene(
            request.species, request.heightMeters, { x: 0, z: 0 }, request.displayName, clothingTextureAsset!.id,
          );
          const isFighting = !!fighterAppearances;
          const tint = index === 0 ? '#a94750' : '#5578ba';
          if (isFighting && fighterAppearances) {
            const appearance = index === 0 ? fighterAppearances.player : fighterAppearances.rival;
            poseFighterGuard(build, tint);
            applyEgoFighterAppearance(build, appearance, tint);
          }
          const setup = build.entities.find(entity => entity.id === build.setupId);
          if (!setup) throw new Error(`The editable rig for ${request.displayName} is missing its root.`);
          setup.parentId = buildRoot.id;
          getTransform(setup).position = {
            x: isFighting ? (index === 0 ? -2.2 : 2.2) : (index - (requestedCharacters.length - 1) / 2) * 34,
            y: 0,
            z: 0,
          };
          if (isFighting) getTransform(setup).rotation.z = index === 0 ? 90 : -90;
          setup.name = `Rig · ${request.displayName}`;
          return build;
        });
        const characterEntities = characterBuilds.flatMap(build => build.entities);
        const entities = [...current.entities, ...characterEntities];
        if (!isSceneGraph(entities)) throw new Error('The completed character hierarchy did not pass scene validation.');
        const playable = /\b(?:playable|player[- ]controlled|controllable|player character|player avatar)\b/i.test(prompt);
        if (playable) {
          const primaryCharacter = characterEntities.find(entity =>
            entity.id === characterBuilds[0]?.characterId,
          );
          if (primaryCharacter) {
            const components = [...primaryCharacter.components];
            if (!components.some(component => component.type === 'characterController' && component.role === 'player')) {
              components.push(createPluginComponent('character-controller-player', current.uiControls?.length ?? 0).component);
            }
            const usedKeys = new Set(components.flatMap(component =>
              component.type === 'playerAction' && component.enabled ? [component.key] : [],
            ));
            for (const action of [...new Set(gameTypes.flatMap(gameType => egoPlayerActions[gameType]))]) {
              if (components.some(component => component.type === 'playerAction' && component.action === action)) continue;
              const created = createPluginComponent(`action-${action}` as PluginComponentKind, current.uiControls?.length ?? 0);
              if (created.component.type !== 'playerAction') continue;
              if (usedKeys.has(created.component.key)) {
                const freeKey = actionKeyOptions.find(key => !usedKeys.has(key));
                if (!freeKey) continue;
                created.component.key = freeKey;
              }
              usedKeys.add(created.component.key);
              components.push(created.component);
            }
            const entityIndex = entities.findIndex(entity => entity.id === primaryCharacter.id);
            entities[entityIndex] = { ...primaryCharacter, components };
          }
        }
        const animationPacks = characterBuilds.map(build =>
          createEgoAnimationPack(build.entities, build.characterId, gameTypes),
        );
        const nextAnimations = [...animationsRef.current, ...animationPacks.flatMap(pack => pack.animations)];
        const nextControllers = [...animationControllersRef.current, ...animationPacks.map(pack => pack.controller)];
        const animationsSaved =
          isGameAnimationCollection(nextAnimations) &&
          isEgoAnimationControllerCollection(nextControllers);
        const names = characterEntities.map(entity => entity.name);
        const logIndex = (current.builderBuildLogs ?? []).length - 1;
        const buildLogs = [...(current.builderBuildLogs ?? [])];
        if (logIndex >= 0) {
          buildLogs[logIndex] = {
            ...buildLogs[logIndex],
            objectNames: [...buildLogs[logIndex].objectNames, ...names],
          };
        }
        const toolMessage = `Mad Builder used Ego's editable anatomy tools to create ${requestedCharacters
          .map(request => `${request.displayName} (${request.heightMeters.toFixed(2)} m)`).join(', ')}. Added ${gameTypes.join(', ')} animation states${playable ? ' and a Player Controller with matching actions' : ''}.${animationsSaved ? '' : ' Animation storage is full, so the models were added without new animation controllers.'} Select the rig or named body parts in Hierarchy to edit them.`;
        const currentHistory = current.builderHistory ?? [];
        const nextHistory = [...currentHistory, { id: crypto.randomUUID(), role: 'assistant' as const, text: toolMessage }].slice(-40);
        const prefabs = [...(current.prefabs ?? [])];
        if (saveAsPrefab && prefabs.length > 0) {
          prefabs[prefabs.length - 1] = capturePrefab(entities, buildRoot.id, buildRoot.name, current.uiControls ?? []);
        }
        setBuilderProjects([{
          ...current,
          entities,
          assets: current.assets.some(asset => asset.id === clothingTextureAsset!.id)
            ? current.assets
            : [...current.assets, clothingTextureAsset!],
          prefabs,
          builderBuildLogs: buildLogs,
          builderHistory: nextHistory,
        }]);
        if (animationsSaved) {
          animationsRef.current = nextAnimations;
          animationControllersRef.current = nextControllers;
          setAnimations(nextAnimations);
          setAnimationControllers(nextControllers);
        }
        setSelection(characterBuilds[0].characterId);
        setStatus(toolMessage);
        return { ok: true, message: `${result.message} ${toolMessage}` };
      } catch (failure) {
        const detail = failure instanceof Error ? failure.message : 'The editable character tools could not complete.';
        const message = `${result.message} The scene build is intact, but Ego's character tools could not finish: ${detail}`;
        setStatus(message);
        return { ok: true, message };
      }
    },
  };

  const egoInterfaceContext: EgoInterfaceContext = {
    projectName,
    view: playTestOn ? 'play' : canvasView ? 'canvas' : 'scene',
    toolset: panel5Toolset,
    activeTool: activeSceneTool?.label ?? null,
    inspectorName: editingEntityId === PRIMARY_CAMERA_ID ? 'Game Camera' : entities.find(entity => entity.id === editingEntityId)?.name ?? null,
  };
  const buildEgoVision = useCallback(async (
    vision: string,
    gameTypes: EgoGameType[],
    characterSize: EgoCharacterSize,
    onProgress: (message: string) => void,
  ) => {
    const project = builderProjectRef.current;
    const editorContext = createEgoWorkspaceContext(project, selection, camera, egoInterfaceContext);
    const isFightingMode = gameTypes.includes('fighting');
    const isSpriteAdventure = gameTypes.includes('creature-adventure-2d') && !isFightingMode;
    const fighterAppearances = isFightingMode
      ? parseFightingAppearancePrompt(vision) ?? defaultFightingAppearancePair
      : null;
    const requestedCharacters = isSpriteAdventure ? [] : isFightingMode
      ? [
        { species: fighterAppearances!.player.race, displayName: 'Player Fighter', heightMeters: 1.8 },
        { species: fighterAppearances!.rival.race, displayName: 'Training Rival', heightMeters: 1.8 },
      ]
      : detectEgoCharacterRequests(vision, characterSize);
    const genreGuidance: Partial<Record<EgoGameType, string>> = {
      'third-person-shooter': 'Stage a third-person shooter starting area with a player start, cover, targets/enemies, readable sight lines, and a useful camera framing. Do not claim advanced weapon simulation or a complete campaign.',
      'kingdom-strategy': 'Stage a kingdom strategy map with a home base, resource sites, routes, unit groups, and command points. The current economy and multiplayer rules still need implementation.',
      'creature-adventure-2d': 'Use a 2D sprite-first layout and matching image assets from this project when available. Do not create 3D creature anatomy for this 2D mode; custom sprite art must be imported.',
      'creature-adventure-3d': 'Stage an explorable 3D creature-adventure area with readable paths, companions, encounters, and places for collectibles; use the editable creature templates Ego adds.',
      fighting: 'Stage a fixed side-view fighting-game arena with two distinct fighter starts, a clear combat space, and room for a HUD. Use supported fight and block actions; do not claim a complete fighting engine. Use the bundled image only as a guide for pose, anatomy, and clothing detail; honor each fighter’s separate race, 3D style, and outfit.',
    };
    const selectedGuidance = [...new Set(gameTypes)]
      .flatMap(type => genreGuidance[type] ? [genreGuidance[type]!] : [])
      .join(' ')
      .slice(0, 360);
    const promptContext = [
      `Create a polished, editable Madhorse starter scene. Game mode(s): ${getEgoGameSelectionLabel(gameTypes)}.`,
      'Build the requested environment and props with clear spacing and a logical hierarchy. Preserve existing objects. Use matching imported project asset IDs when useful; never invent asset IDs. The editor also supplies the exact image/model asset list.',
      'Give visible surfaces realistic material values: use high metalness only for bare metal, keep paint/plastic/wood/stone non-metallic, make glass low-roughness and translucent, and use the project’s imported textures when they fit.',
      selectedGuidance,
      editorContext.plannerSummary.slice(0, 650),
      'For racing, keep kart and real-car silhouettes distinct. Do not create scripts or claim unsupported gameplay systems.',
      ...(requestedCharacters.length ? [
        `Ego will add ${requestedCharacters.length} named editable 3D creature body-plan template(s) locally. Do not create duplicate character bodies.`,
      ] : []),
    ].filter(Boolean).join('\n');
    const visionLine = `Vision: ${vision}`;
    const prompt = `${promptContext.slice(0, Math.max(0, 1998 - visionLine.length))}\n${visionLine}`;
    const references = isFightingMode ? [await loadFightingCharacterReference()] : [];
    const result = await madBuilder.onPlan(
      prompt, false, 'polished-game-ready', isFightingMode ? 'fighting' : 'auto', references,
      requestedCharacters.length > 0,
    );
    if (result.ok && isSpriteAdventure) {
      const spriteCount = project.assets.filter(asset => asset.kind === 'image').length;
      return {
        ...result,
        message: `${result.message}${spriteCount ? ' Ego was given the project image assets to reuse as sprites where they fit.' : ' Import matching creature and environment sprites in Panel 2 · Assets; Madhorse does not generate finished 2D character art yet.'}`,
      };
    }
    if (!requestedCharacters.length) return result;

    try {
      onProgress(`Creating editable creature anatomy for ${requestedCharacters.map(({ displayName }) => displayName).join(', ')}…`);
      const current = builderProjectRef.current;
      let clothingTextureAsset = current.assets.find(asset => asset.name === 'madhorse-woven-clothing-texture.svg');
      if (!clothingTextureAsset) {
        const generatedTexture = createEgoClothingTextureAsset();
        await saveLocalAsset(projectId, generatedTexture.asset.id, generatedTexture.file);
        clothingTextureAsset = generatedTexture.asset;
      }
      const characterBuilds = requestedCharacters.map((request, index) => {
        const spacing = isFightingMode
          ? (index === 0 ? -2.2 : 2.2)
          : (index - (requestedCharacters.length - 1) / 2) * 2.2 + 1.25;
        const build = createEgoCharacterScene(
          request.species, request.heightMeters, { x: spacing, z: 0 }, request.displayName, clothingTextureAsset!.id,
        );
        if (isFightingMode && fighterAppearances) {
          const appearance = index === 0 ? fighterAppearances.player : fighterAppearances.rival;
          const tint = index === 0 ? '#a94750' : '#5578ba';
          poseFighterGuard(build, tint);
          applyEgoFighterAppearance(build, appearance, tint);
        }
        return build;
      });
      const animationPacks = characterBuilds.map(build =>
        createEgoAnimationPack(build.entities, build.characterId, gameTypes),
      );
      const nextAnimations = [...animations, ...animationPacks.flatMap(pack => pack.animations)];
      const nextControllers = [...animationControllers, ...animationPacks.map(pack => pack.controller)];
      const animationDataSaved =
        isGameAnimationCollection(nextAnimations) &&
        isEgoAnimationControllerCollection(nextControllers);
      setBuilderProjects([{
        ...current,
        entities: [...current.entities, ...characterBuilds.flatMap((build) => build.entities)],
        assets: current.assets.some(asset => asset.id === clothingTextureAsset!.id)
          ? current.assets
          : [...current.assets, clothingTextureAsset!],
      }]);
      if (animationDataSaved) {
        animationsRef.current = nextAnimations;
        animationControllersRef.current = nextControllers;
        setAnimations(nextAnimations);
        setAnimationControllers(nextControllers);
      }
      setSelection(characterBuilds[0].characterId);
      setStatus(`Ego added ${requestedCharacters.length} editable creature${requestedCharacters.length === 1 ? '' : 's'}, animation clips, and a Play/Test controller. Edit the named parts in Hierarchy and clips in Animation Timeline.`);
      return {
        ok: true,
        message: `${result.ok ? result.message : `Mad Builder could not add the other requested scene parts: ${result.message}`} Added editable anatomy, animation clips, and game-state controllers for: ${requestedCharacters.map(({ displayName, species, heightMeters }) => `${displayName} (${species}) · ${heightMeters.toFixed(2)} m`).join(', ')}.${animationDataSaved ? '' : ' Animation storage is full, so the creature was added without a new controller.'} Select named parts in Hierarchy; open Animation Timeline to edit clips.`,
      };
    } catch (failure) {
      const detail = failure instanceof Error ? failure.message : 'The character template could not be created.';
      return {
        ok: false,
        message: `The scene plan was applied, but the anatomy template step failed: ${detail}`,
      };
    }
  }, [animationControllers, animations, camera, egoInterfaceContext, madBuilder.onPlan, selection, setBuilderProjects, setSelection, setStatus]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const requestedTool = url.searchParams.get('open');
    if (requestedTool === 'mad-builder') setMadBuilderOpen(true);
    else if (requestedTool === 'ego') setEgoOpen(true);
    else return;
    url.searchParams.delete('open');
    window.history.replaceState(
      window.history.state,
      '',
      `${url.pathname}${url.search}${url.hash}`,
    );
  }, []);

  useEffect(() => {
    if (!madBuilderOpen && !egoOpen) return;
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMadBuilderOpen(false);
        setEgoOpen(false);
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [madBuilderOpen, egoOpen]);

  useEffect(() => {
    try {
      saveFreshWorkspace({
        ...latestProjectSnapshot,
      }, projectId);
      setSaveFailed(false);
    } catch {
      setSaveFailed(true);
      setStatus('Could not save the scene data in this browser. Check available storage.');
    }
  }, [projectId, projectName, projectSetup, egoGameVision, egoGameFlow, egoGameNotes, entities, camera, assets, animations, animationControllers, builderHistory, builderDraft, builderDraftRequest, builderBuildLogs, prefabs, uiControls, egoScripts]);

  useEffect(() => {
    if (!playTestOn) {
      setRuntimeEntities(null);
      setRuntimeCamera(null);
      setRuntimeActionHud(null);
      return;
    }

    let liveEntities = entities;
    const simulationClock = new SimulationClock(performance.now());
    let elapsed = 0;
    let lastPublish = 0;
    let frameRequest = 0;
    const runtimeInput = { held: new Set<string>(), tapped: new Set<string>() };
    runtimeInputRef.current = runtimeInput;
    const pressed = runtimeInput.held;
    const actionKeys = new Set(entities.flatMap(entity => entity.components.flatMap(component =>
      component.type === 'playerAction' && component.enabled ? [component.key] :
        component.type === 'gameFeature' && component.enabled && component.kind === 'interact'
          ? [String(component.settings.key)] : [],
    )));
    const lastFootstepTime = new Map<string, number>();
    const lastFootstepPosition = new Map<string, { x: number; y: number; z: number }>();
    const runtimeState = createSceneRuntimeState(entities, playPlayerRef.current);
    let fpsPlayer = entities.find(entity => entity.active && entity.components.some(component =>
      component.type === 'characterController' && component.enabled && component.role === 'player' && component.perspective === 'first-person'));
    let lookYaw = fpsPlayer ? getTransform(fpsPlayer).rotation.z : 0;
    let lookPitch = 0;
    const controlledPlayer = entities.find(entity => entity.id === runtimeState.controlledPlayerId);
    const primaryAction = controlledPlayer?.components.find(component =>
      component.type === 'playerAction' && component.enabled &&
      ['shoot', 'fight', 'light-attack'].includes(component.action),
    );
    const fireKey = primaryAction?.type === 'playerAction' ? primaryAction.key : 'j';
    setEditingEntityId(null);
    setRuntimeEntities(entities);
    setRuntimeCamera(camera);
    entities.forEach(entity => {
      const source = entity.components.find(component => component.type === 'gameAudio');
      if (entity.active && source?.enabled && source.playOnStart &&
          (!source.clipAssetId || assetUrls[source.clipAssetId])) {
        void playAudioPreview(
          source.clipAssetId ? assetUrls[source.clipAssetId] ?? null : null,
          source.volume,
          source.pitch,
          'tone',
          'runtime',
        );
      }
    });

    const isTextEntry = (target: EventTarget | null) =>
      target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement ||
      (target instanceof HTMLElement && target.isContentEditable);
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (isTextEntry(event.target)) return;
      const key = event.key.toLowerCase();
      if (event.metaKey || event.altKey || event.ctrlKey && key !== 'control') return;
      if (key === 'escape') {
        setPlayTestOn(false);
        return;
      }
      if (key === 'v') {
        const playerId = runtimeState.controlledPlayerId;
        const player = liveEntities.find(entity => entity.id === playerId && entity.active);
        const controller = player?.components.find(component =>
          component.type === 'characterController' && component.enabled && component.role === 'player',
        );
        if (controller?.type === 'characterController' &&
            (controller.perspective === 'first-person' || controller.perspective === 'third-person') &&
            !event.repeat) {
          const nextPerspective = controller.perspective === 'first-person' ? 'third-person' : 'first-person';
          liveEntities = liveEntities.map(entity => entity.id !== playerId ? entity : {
            ...entity,
            components: entity.components.map(component =>
              component.type === 'characterController' && component.enabled && component.role === 'player'
                ? { ...component, perspective: nextPerspective }
                : component,
            ),
          });
          fpsPlayer = nextPerspective === 'first-person'
            ? liveEntities.find(entity => entity.id === playerId)
            : undefined;
          if (fpsPlayer) {
            lookYaw = getTransform(fpsPlayer).rotation.z;
            lookPitch = 0;
            try {
              const viewport = document.querySelector<HTMLElement>('.fresh-viewport');
              void viewport?.requestPointerLock()?.catch(() => setStatus('Mouse capture unavailable. Use arrow keys to look.'));
            } catch {
              setStatus('Mouse capture unavailable. Use arrow keys to look.');
            }
          } else if (document.pointerLockElement?.matches('[data-fps-viewport]')) {
            document.exitPointerLock();
          }
          setRuntimeEntities(liveEntities);
          setStatus(`Switched to ${nextPerspective === 'first-person' ? 'first-person' : 'third-person'} view. Press V to switch back.`);
        }
        event.preventDefault();
        return;
      }
      if (actionKeys.has(key) || ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) {
        event.preventDefault();
        if (!event.repeat) onRuntimeKey(key, true);
      }
    };
    const onKeyUp = (event: globalThis.KeyboardEvent) => {
      pressed.delete(event.key.toLowerCase());
    };
    const releaseKeys = () => { pressed.clear(); runtimeInput.tapped.clear(); };
    const onMouseMove = (event: globalThis.MouseEvent) => {
      if (!fpsPlayer || !document.pointerLockElement?.matches('[data-fps-viewport]')) return;
      lookYaw = (lookYaw + event.movementX * .14) % 360;
      lookPitch = Math.max(-80, Math.min(80, lookPitch - event.movementY * .12));
    };
    const onMouseDown = (event: globalThis.MouseEvent) => {
      if (!fpsPlayer || event.button !== 0 || !(event.target instanceof Element)) return;
      const viewport = event.target.closest<HTMLElement>('[data-fps-viewport]');
      if (!viewport || event.target.closest('button, input, select, textarea')) return;
      if (document.pointerLockElement === viewport) {
        event.preventDefault();
        onRuntimeKey(fireKey, true);
      } else {
        try { void viewport.requestPointerLock()?.catch(() => setStatus('Mouse capture unavailable. Use arrow keys to look and J to shoot.')); }
        catch { setStatus('Mouse capture unavailable. Use arrow keys to look and J to shoot.'); }
      }
    };
    const onMouseUp = () => { if (fpsPlayer) pressed.delete(fireKey); };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', releaseKeys);
    document.addEventListener('visibilitychange', releaseKeys);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mouseup', onMouseUp);

    const frame = (now: number) => {
      const batch = simulationClock.advance(now, document.hidden);
      for (let stepIndex = 0; stepIndex < batch.steps; stepIndex++) {
      const delta = simulationClock.stepSeconds;
      elapsed += delta;
      if (fpsPlayer) {
        lookYaw += (Number(pressed.has('arrowright')) - Number(pressed.has('arrowleft'))) * delta * 90;
        lookPitch = Math.max(-80, Math.min(80, lookPitch +
          (Number(pressed.has('arrowup')) - Number(pressed.has('arrowdown'))) * delta * 70));
      }
      const input = {
        moveX: Number(pressed.has('d') || !fpsPlayer && pressed.has('arrowright')) - Number(pressed.has('a') || !fpsPlayer && pressed.has('arrowleft')),
        moveY: Number(pressed.has('w') || !fpsPlayer && pressed.has('arrowup')) - Number(pressed.has('s') || !fpsPlayer && pressed.has('arrowdown')),
        ...(fpsPlayer ? { lookYaw, lookPitch } : {}),
        jumpPressed: runtimeInput.tapped.has(' '),
        heldKeys: [...pressed],
        pressedKeys: [...runtimeInput.tapped],
      };
      runtimeInput.tapped.clear();
      const result = advanceSceneRuntime(liveEntities, delta, elapsed, input, runtimeState);
      const activeController = animationControllers.find(controller =>
        controller.targetEntityId === result.animationTargetId,
      );
      const animatedEntities = activeController
        ? applyEgoAnimationController(result.entities, animations, activeController, result.animationState, elapsed)
        : result.entities;
      liveEntities = applyMultiplayerSnapshot(
        animatedEntities,
        multiplayerSnapshotRef.current,
        multiplayerMemberRef.current?.playerId ?? null,
        multiplayerSnapshotRef.current?.players.find(player => player.id === multiplayerMemberRef.current?.playerId)?.isHost
          ?? multiplayerMemberRef.current?.isHost ?? false,
      );
      result.events.forEach(event => setStatus(event.message));
      result.audioEvents.forEach(event => {
        if (event.clipAssetId && !assetUrls[event.clipAssetId]) return;
        void playAudioPreview(event.clipAssetId ? assetUrls[event.clipAssetId] : null, event.volume, event.pitch, event.action, 'runtime');
      });
      for (const entity of liveEntities) {
        const footsteps = entity.components.find(component => component.type === 'playerWalkAudio');
        const player = entity.components.find(component =>
          component.type === 'characterController' && component.role === 'player',
        );
        if (!entity.active || !footsteps?.enabled || !player?.enabled) continue;
        if (result.hud?.playerId === entity.id && ['Running', 'Crouching', 'Driving'].includes(result.hud.mode)) continue;
        if (footsteps.clipAssetId && !assetUrls[footsteps.clipAssetId]) continue;
        const position = getWorldTransform(liveEntities, entity.id)?.position ?? getTransform(entity).position;
        const previousPosition = lastFootstepPosition.get(entity.id);
        if (previousPosition) {
          const distance = Math.hypot(
            position.x - previousPosition.x,
            position.y - previousPosition.y,
          );
          const lastTime = lastFootstepTime.get(entity.id) ?? Number.NEGATIVE_INFINITY;
          if (distance > 0.02 && now - lastTime >= footsteps.stepInterval * 1000) {
            void playAudioPreview(
              footsteps.clipAssetId ? assetUrls[footsteps.clipAssetId] ?? null : null,
              footsteps.volume,
              footsteps.pitch,
              'footstep',
              'runtime',
            );
            lastFootstepTime.set(entity.id, now);
          }
        }
        lastFootstepPosition.set(entity.id, { ...position });
      }

      if (stepIndex === batch.steps - 1 && now - lastPublish >= 33) {
        setRuntimeEntities(liveEntities);
        setRuntimeActionHud(result.hud);
        const actionPlayer = result.hud ? liveEntities.find(entity => entity.id === result.hud!.playerId) : undefined;
        const thirdPerson = liveEntities.find(entity =>
          entity.active && entity.components.some(component =>
            component.type === 'characterController' && component.enabled &&
            component.role === 'player' && component.perspective === 'third-person' &&
            entity.id === runtimeState.controlledPlayerId,
          ),
        );
        const firstPerson = liveEntities.find(entity =>
          entity.id === runtimeState.controlledPlayerId && entity.active && entity.components.some(component =>
            component.type === 'characterController' && component.enabled &&
            component.role === 'player' && component.perspective === 'first-person',
          ),
        );
        const followed = actionPlayer ?? thirdPerson ?? firstPerson;
        const targetTransform = followed ? getWorldTransform(liveEntities, followed.id) : null;
        if (targetTransform) {
          const isFirstPerson = followed === firstPerson;
          const crouching = followed?.components.some(component => component.type === 'playerAction' && component.action === 'crouch' && pressed.has(component.key));
          const viewHeight = isFirstPerson ? crouching ? .9 : 1.6 : 1.1;
          const target = {
            x: (targetTransform.position.x - 50) / 10,
            y: targetTransform.position.z / 10 + viewHeight,
            z: (targetTransform.position.y - 50) / 10,
          };
          const heading = (targetTransform.rotation.z * Math.PI) / 180;
          const firstPersonTarget = {
            x: target.x + Math.sin(heading) * Math.cos(lookPitch * Math.PI / 180) * 4,
            y: target.y + Math.sin(lookPitch * Math.PI / 180) * 4,
            z: target.z + Math.cos(heading) * Math.cos(lookPitch * Math.PI / 180) * 4,
          };
          setRuntimeCamera((followed && cartChaseCamera(camera,liveEntities,followed.id,isFirstPerson)) ?? {
            ...camera,
            rotation: undefined,
            target: isFirstPerson ? firstPersonTarget : target,
            position: isFirstPerson ? target : thirdPerson
              ? { x: target.x + 2.4, y: target.y + 1.8, z: target.z - 5 }
              : {
                x: target.x + camera.position.x - camera.target.x,
                y: target.y + camera.position.y - camera.target.y,
                z: target.z + camera.position.z - camera.target.z,
              },
          });
        } else {
          setRuntimeCamera(camera);
        }
        lastPublish = now;
      }
      }
      frameRequest = window.requestAnimationFrame(frame);
    };
    frameRequest = window.requestAnimationFrame(frame);
    return () => {
      stopAudioPlayback('runtime');
      window.cancelAnimationFrame(frameRequest);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mouseup', onMouseUp);
      if (document.pointerLockElement?.matches('[data-fps-viewport]')) document.exitPointerLock();
      window.removeEventListener('blur', releaseKeys);
      document.removeEventListener('visibilitychange', releaseKeys);
      releaseKeys();
    };
  }, [animationControllers, animations, assetUrls, camera, entities, onRuntimeKey, playTestOn]);

  useEffect(() => {
    if (!multiplayerMember) {
      multiplayerSnapshotRef.current = null;
      setMultiplayerSnapshot(null);
      return;
    }

    let disposed = false;
    let inFlight = false;
    const syncRoom = async () => {
      if (disposed || inFlight) return;
      inFlight = true;
      try {
        const playing = playTestOnRef.current;
        const sceneEntities = runtimeEntitiesRef.current ?? [];
        const isHost = multiplayerSnapshotRef.current?.players.find(player => player.id === multiplayerMember.playerId)?.isHost
          ?? multiplayerMember.isHost;
        const snapshot = playing
          ? await syncMultiplayerRoomState(multiplayerMember, createMultiplayerUpdate(sceneEntities, true, isHost))
          : await getMultiplayerRoomState(multiplayerMember);
        if (!disposed) {
          multiplayerSnapshotRef.current = snapshot;
          setMultiplayerSnapshot(snapshot);
        }
      } catch (error) {
        if (!disposed) {
          const message = error instanceof Error ? error.message : "The room connection was interrupted.";
          setStatus(`Multiplayer: ${message}`);
          if (message.includes("room has ended") || message.includes("membership is no longer valid")) {
            setMultiplayerMember(null);
          }
        }
      } finally {
        inFlight = false;
      }
    };

    void syncRoom();
    const timer = window.setInterval(() => void syncRoom(), 200);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [multiplayerMember]);

  useEffect(() => {
    let disposed = false;
    const urls: string[] = [];
    async function loadAssets() {
      const loaded = await Promise.all(assets.filter(asset => asset.kind !== 'data').map(async asset => {
        try {
          const blob = await loadLocalAsset(projectId, asset.id);
          return { id: asset.id, blob };
        } catch {
          return { id: asset.id, blob: null };
        }
      }));
      if (disposed) return;
      const next: Record<string, string> = {};
      for (const item of loaded) {
        if (!item.blob) continue;
        const url = URL.createObjectURL(item.blob);
        urls.push(url);
        next[item.id] = url;
      }
      setAssetUrls(next);
    }
    void loadAssets();
    return () => {
      disposed = true;
      urls.forEach(URL.revokeObjectURL);
    };
  }, [assets]);

  const updateTransform = useCallback((
    entityId: string,
    changes: Partial<Pick<TransformComponent, 'position' | 'rotation' | 'scale'>>,
  ) => {
    setEntities(current => current.map(entity => {
      if (entity.id !== entityId) return entity;
      const transform = getTransform(entity);
      const updatedTransform = { ...transform, ...changes };
      return {
        ...entity,
        components: entity.components.map(component =>
          component.id === transform.id ? updatedTransform : component,
        ),
      };
    }));
  }, []);

  const updateEntitySettings = useCallback((updated: SceneEntity) => {
    if (updated.id === PRIMARY_CAMERA_ID) {
      const transform = getTransform(updated);
      const lens = getCamera(updated);
      const nextCamera = cameraWithPose(camera, {
        position: {
          x: (transform.position.x - 50) / 10,
          y: transform.position.z / 10,
          z: (transform.position.y - 50) / 10,
        },
        rotation: {
          x: -transform.rotation.x,
          y: -transform.rotation.z,
          z: -transform.rotation.y,
        },
        fov: lens?.fov ?? camera.fov,
      });
      if (nextCamera) setCamera(nextCamera);
      else setStatus('The camera settings could not be applied.');
      return;
    }
    setEntities(current => current.map(entity => entity.id === updated.id ? updated : entity));
    setStatus(`${updated.name} updated and saved in this browser.`);
  }, [camera]);

  const createStoryboardScene = useCallback(() => {
    const entity: SceneEntity = {
      id: crypto.randomUUID(),
      name: 'Scene Storyboard',
      parentId: null,
      active: true,
      isGroup: true,
      components: [createTransformComponent(), createStoryboardComponent()],
    };
    setEntities(current => [...current, entity]);
    setSelection(entity.id);
    setStatus('Storyboard added to Scene 1 and saved with this browser project.');
    return entity.id;
  }, []);

  const updateStoryboardScene = useCallback((updated: SceneEntity) => {
    if (!isSceneEntity(updated)) {
      setStatus('Storyboard changes were not saved. Check the title and mission-step limits.');
      return;
    }
    setEntities(current => current.map(entity => entity.id === updated.id ? updated : entity));
    setStatus('Storyboard saved with Scene 1 in this browser.');
  }, []);

  const addStarterKit = useCallback(async (kind: GameStarterKitId, fightingAppearances?: FightingAppearancePair) => {
    const anchor = selectedEntity
      ? getWorldTransform(entities, selectedEntity.id)?.position ?? getTransform(selectedEntity).position
      : SCENE_ORIGIN;
    const result = createGameStarterKit(kind, anchor, fightingAppearances);
    const next = [...entities, ...result.entities];
    if (!isSceneGraph(next)) {
      setStatus('The starter kit did not pass scene checks. No scene objects were added.');
      return;
    }
    const generatedAssets = result.generatedAssets ?? [];
    try {
      await Promise.all(generatedAssets.map(({ asset, file }) => saveLocalAsset(projectId, asset.id, file)));
    } catch (cause) {
      await Promise.allSettled(generatedAssets.map(({ asset }) => deleteLocalAsset(projectId, asset.id)));
      setStatus(cause instanceof Error
        ? `The starter assets could not be saved, so no scene objects were added. ${cause.message}`
        : 'The starter assets could not be saved, so no scene objects were added.');
      return;
    }
    setEntities(current => [...current, ...result.entities]);
    if (generatedAssets.length) {
      setAssets(current => [...current, ...generatedAssets.map(({ asset }) => asset)]);
    }
    setSelection(result.playerId);
    setStarterKitsOpen(false);
    setStatus(`${result.title} added beside your current objects. Existing scene data was kept.`);
  }, [entities, selectedEntity, projectId]);

  const removeEntityFromScene = useCallback((entityId: string) => {
    if (entityId === PRIMARY_CAMERA_ID || entityId === 'player') return;
    const target = entities.find(entity => entity.id === entityId);
    if (!target) return;
    const removedIds = collectHierarchySubtreeIds(entities, entityId);
    const removedControlIds = new Set(entities
      .filter(entity => removedIds.has(entity.id))
      .flatMap(entity => entity.components.flatMap(component =>
        component.type === 'uiCanvas' ? [component.controlId] : [],
      )));

    setEntities(current => current.filter(entity => !removedIds.has(entity.id)));
    setUIControls(current => current.filter(control => !removedControlIds.has(control.id)));
    const nextAnimations = animationsRef.current.filter(animation => !removedIds.has(animation.targetEntityId));
    animationsRef.current = nextAnimations;
    setAnimations(nextAnimations);
    const nextControllers = animationControllersRef.current.filter(controller =>
      !removedIds.has(controller.targetEntityId),
    );
    animationControllersRef.current = nextControllers;
    setAnimationControllers(nextControllers);
    setSelection(current => current && removedIds.has(current) ? target.parentId : current);
    setEditingEntityId(current => current && removedIds.has(current) ? null : current);
    setPreviewEntities(null);
    const childCount = removedIds.size - 1;
    setStatus(`Deleted ${target.name}${childCount ? ` and ${childCount} child object${childCount === 1 ? '' : 's'}` : ''}.`);
  }, [entities]);

  const addEntity = useCallback((entity: SceneEntity) => {
    setEntities(current => [...current, entity]);
    setSelection(entity.id);
    setStatus(`${entity.name} added to Scene 1.`);
  }, []);

  const attachPluginComponent = useCallback((entityId: string, kind: PluginComponentKind) => {
    const target = entities.find(entity => entity.id === entityId);
    if (!target) {
      setStatus('Choose an object in Hierarchy before adding a component.');
      return;
    }
    if (target.id === PRIMARY_CAMERA_ID) {
      setStatus('The Main Camera is system-managed. Add this component to a scene object instead.');
      return;
    }
    const existingController = target.components.find(component => component.type === 'characterController');
    if ((kind === 'player-walk-audio' || kind === 'multiplayer-player' || kind.startsWith('action-') || kind === 'feature-interact' ||
        kind === 'feature-inventory' || kind === 'feature-status-bar') && existingController?.role === 'npc') {
      setStatus('This plugin needs a player object. Select a player, or change this object’s controller role to Player.');
      return;
    }
    if (target.components.some(component => matchesPluginComponent(component, kind))) {
      setSelection(target.id);
      setStatus(`${target.name} already has this component. Double-click it in Hierarchy to edit its settings.`);
      return;
    }
    const created = createPluginComponent(kind, uiControls.length);
    if (created.component.type === 'playerAction') {
      const usedKeys = new Set(target.components.flatMap(component =>
        component.type === 'playerAction' && component.enabled ? [component.key]
          : component.type === 'gameFeature' && component.enabled && component.kind === 'interact'
            ? [String(component.settings.key)] : [],
      ));
      if (usedKeys.has(created.component.key)) {
        const freeKey = actionKeyOptions.find(key => !usedKeys.has(key));
        if (!freeKey) {
          setStatus('All action keys are in use. Disable an existing skill before adding another.');
          return;
        }
        created.component.key = freeKey;
      }
    }
    const components: SceneComponent[] = [created.component];
    const addPlayerController = (kind === 'player-walk-audio' || kind === 'multiplayer-player' || kind.startsWith('action-') ||
      kind === 'feature-interact' || kind === 'feature-inventory' || kind === 'feature-status-bar') && !existingController;
    if (addPlayerController) {
      components.push(createPluginComponent(kind === 'action-race' ? 'character-controller-third-person' : 'character-controller-player', 0).component);
    }
    if ((created.component.type === 'characterController' || addPlayerController) &&
        !target.components.some(component => component.type === 'physics')) {
      components.push(createPluginComponent('physics', 0).component);
    }
    const updated: SceneEntity = { ...target, components: [...target.components, ...components] };
    if (!isSceneEntity(updated)) {
      setStatus('This component could not be added to the selected object.');
      return;
    }
    setEntities(current => current.map(entity => entity.id === target.id ? updated : entity));
    if (created.uiControl) setUIControls(current => [...current, created.uiControl!]);
    setSelection(target.id);
    const componentLabel = kind === 'physics' ? 'Physics Body'
      : kind === 'camera' ? 'Camera'
        : kind === 'uiCanvas' ? 'UI Canvas'
          : kind === 'script' ? 'Safe Script Slot'
            : kind === 'game-audio' ? 'Game Audio'
              : kind === 'player-walk-audio' ? 'Player Walk Audio'
            : kind === 'spriteRenderer' ? '2D Sprite Renderer'
              : kind === 'modelRenderer' ? '3D Model Renderer'
                : kind === 'effect' ? 'Particle Effect'
                  : kind === 'light-point' ? 'Point Light'
                    : kind === 'light-directional' ? 'Directional Light'
                    : kind === 'light-ambient' ? 'Ambient Light'
                      : kind.startsWith('character-controller') ? 'Character Controller'
                          : kind === 'skybox' ? 'Skybox Background'
                            : 'Trigger Zone';
    const label = created.component.type === 'playerAction' ? `${playerActionDefinitions[created.component.action].label} + Sound`
      : created.component.type === 'gameFeature' ? gameFeatureDefinitions[created.component.kind].label : componentLabel;
    setStatus(`${label}${addPlayerController ? ' and a Player Controller' : ''} added to ${target.name}. Double-click the object in Hierarchy to edit it.`);
  }, [entities, uiControls.length]);

  const attachPluginSet = useCallback((entityId: string, kinds: PluginComponentKind[], label: string) => {
    const target = entities.find(entity => entity.id === entityId);
    if (!target) {
      setStatus('Choose an object in Hierarchy before adding a setup.');
      return;
    }
    if (target.id === PRIMARY_CAMERA_ID) {
      setStatus('The Main Camera is system-managed. Add this setup to a scene object instead.');
      return;
    }
    const existingController = target.components.find(component => component.type === 'characterController');
    const playerBoundKinds = (kind: PluginComponentKind) =>
      kind === 'player-walk-audio' || kind === 'multiplayer-player' || kind.startsWith('action-') ||
      kind === 'feature-interact' || kind === 'feature-inventory' || kind === 'feature-status-bar';
    if (existingController?.role === 'npc' && kinds.some(playerBoundKinds)) {
      setStatus('This setup needs a player object. Select a player, or change this object’s controller role to Player.');
      return;
    }

    const addedComponents: SceneComponent[] = [];
    const addedUIControls: typeof uiControls = [];
    const usedKeys = new Set(target.components.flatMap(component =>
      component.type === 'playerAction' && component.enabled ? [component.key]
        : component.type === 'gameFeature' && component.enabled && component.kind === 'interact'
          ? [String(component.settings.key)] : [],
    ));
    let hasController = Boolean(existingController);
    let hasPhysics = target.components.some(component => component.type === 'physics');
    const currentComponents = () => [...target.components, ...addedComponents];

    for (const kind of kinds) {
      if (currentComponents().some(component => matchesPluginComponent(component, kind))) continue;

      const created = createPluginComponent(kind, uiControls.length + addedUIControls.length);
      if (created.component.type === 'playerAction') {
        if (usedKeys.has(created.component.key)) {
          const freeKey = actionKeyOptions.find(key => !usedKeys.has(key));
          if (!freeKey) continue;
          created.component.key = freeKey;
        }
        usedKeys.add(created.component.key);
      }
      addedComponents.push(created.component);
      if (created.uiControl) addedUIControls.push(created.uiControl);

      const needsPlayerController = playerBoundKinds(kind);
      let addedController = false;
      if (needsPlayerController && !hasController) {
        const controllerKind = kind === 'action-race' ? 'character-controller-third-person' : 'character-controller-player';
        addedComponents.push(createPluginComponent(controllerKind, 0).component);
        hasController = true;
        addedController = true;
      }
      if (!hasPhysics && (created.component.type === 'characterController' || addedController)) {
        addedComponents.push(createPluginComponent('physics', 0).component);
        hasPhysics = true;
      }
      if (created.component.type === 'characterController') hasController = true;
    }

    if (!addedComponents.length) {
      setSelection(target.id);
      setStatus(`${target.name} already has the ${label} setup.`);
      return;
    }
    const updated: SceneEntity = { ...target, components: [...target.components, ...addedComponents] };
    if (!isSceneEntity(updated)) {
      setStatus('This setup could not be added to the selected object.');
      return;
    }
    setEntities(current => current.map(entity => entity.id === target.id ? updated : entity));
    if (addedUIControls.length) setUIControls(current => [...current, ...addedUIControls]);
    setSelection(target.id);
    setStatus(`${label} added to ${target.name}. Double-click it in Hierarchy to edit its controls and settings.`);
  }, [entities, uiControls.length]);

  const openCharacterBuilder = useCallback(() => {
    setModelingSource(undefined);
    setModelingOpen(true);
  }, []);

  const openModelingWorkspace = useCallback((editSelectedModel = false) => {
    if (!editSelectedModel) {
      setModelingSource(undefined);
      setModelingOpen(true);
      return;
    }
    const selected = entities.find((entity) => entity.id === selection);
    const renderer = selected ? getModelRenderer(selected) : undefined;
    const asset = assets.find((item) => item.id === renderer?.assetId);
    setModelingSource(asset && /\.(glb|gltf)$/i.test(asset.name) && assetUrls[asset.id]
      ? { url: assetUrls[asset.id], name: asset.name } : undefined);
    setModelingOpen(true);
  }, [assetUrls, assets, entities, selection]);

  // The engine stores the scene origin at editor coordinates (50, 50, 0).
  // All newly placed scene items use this same origin instead of drifting by entity count.
  const nextPosition = useCallback(() => ({ ...SCENE_ORIGIN }), []);

  const createPrimitiveEntity = useCallback((
    shape: PrimitiveShape,
    name: string,
    options?: {
      scale?: { x: number; y: number; z: number };
      terrainSettings?: TerrainSettings;
      color?: string;
      bodyType?: 'static' | 'dynamic';
    },
  ) => {
    const entity = createSceneEntity(name, nextPosition(), null, false);
    const transform = getTransform(entity);
    const physics = createPhysicsComponent(options?.bodyType ?? 'dynamic');
    physics.size = { x: 10, y: 10, z: 10 };
    entity.components = [
      { ...transform, scale: options?.scale ?? { x: 1, y: 1, z: 1 } },
      {
        id: crypto.randomUUID(),
        type: 'primitive',
        enabled: true,
        shape,
        color: options?.color ?? '#bfc3ca',
        textureAssetId: null,
        ...(options?.terrainSettings ? { terrainSettings: options.terrainSettings } : {}),
      },
      physics,
    ];
    addEntity(entity);
  }, [addEntity, nextPosition]);

  const createAssetEntity = useCallback((asset: ProjectAsset, modelScale = 1) => {
    const entity = createSceneEntity(asset.name, nextPosition(), null, false);
    if (asset.kind === 'image') {
      entity.components = [
        ...entity.components,
        { id: crypto.randomUUID(), type: 'spriteRenderer', enabled: true, assetId: asset.id, tint: '#ffffff', width: 100, height: 100 },
      ];
    } else if (asset.kind === 'model') {
      const transform = getTransform(entity);
      transform.scale = { x: modelScale, y: modelScale, z: modelScale };
      entity.components = [
        transform,
        { id: crypto.randomUUID(), type: 'modelRenderer', enabled: true, assetId: asset.id },
      ];
    } else {
      entity.components = [
        ...entity.components,
        {
          id: crypto.randomUUID(),
          type: 'gameAudio',
          enabled: true,
          clipAssetId: asset.id,
          volume: 0.5,
          pitch: 1,
          playOnStart: false,
        },
      ];
    }
    addEntity(entity);
  }, [addEntity, nextPosition]);

  const saveModelingAsset = useCallback(async (file: File) => {
    if (file.size > WORKSPACE_ASSET_LIMIT) throw new Error('The exported model exceeds the 100 MB browser asset limit.');
    const asset: ProjectAsset = {
      id: crypto.randomUUID(), name: file.name, kind: 'model', mimeType: file.type,
      size: file.size, addedAt: new Date().toISOString(),
    };
    await saveLocalAsset(projectId, asset.id, file);
    const entity = createSceneEntity(file.name.replace(/\.glb$/i, ''), nextPosition(), null, false);
    entity.components = [
      getTransform(entity),
      { id: crypto.randomUUID(), type: 'modelRenderer', enabled: true, assetId: asset.id },
    ];
    setAssets((current) => [...current, asset]);
    addEntity(entity);
    characterFrameToken.current += 1;
    setCharacterFrameRequest({ targetId: entity.id, token: characterFrameToken.current });
    setStatus(`${file.name} saved on this device with embedded rig and animation clips. A new copy was added to the hierarchy.`);
  }, [addEntity, nextPosition]);

  const importFile = useCallback(async (
    file: File | undefined,
    imagesOnly = false,
    modelScale = 1,
    applyTextureToSelectedObject = false,
  ) => {
    if (!file) return;
    if (file.size > WORKSPACE_ASSET_LIMIT) {
      setStatus('This file is too large for local browser storage. Choose a file smaller than 100 MB.');
      return;
    }
    const kind = projectAssetKind(file.name, file.type);
    if (!kind || (imagesOnly && kind !== 'image')) {
      setStatus(imagesOnly ? 'Choose a supported 2D image file.' : 'Choose a supported image, 3D model, or audio file.');
      return;
    }
    const asset: ProjectAsset = {
      id: crypto.randomUUID(),
      name: file.name,
      kind,
      mimeType: file.type || (kind === 'image' ? 'application/octet-stream' : kind === 'audio' ? 'audio/unknown' : 'model/unknown'),
      size: file.size,
      addedAt: new Date().toISOString(),
    };
    try {
      await saveLocalAsset(projectId, asset.id, file);
      setAssets(current => [...current, asset]);
      if (applyTextureToSelectedObject && kind === 'image') {
        const target = entities.find(entity => entity.id === selection);
        const primitive = target ? getPrimitive(target) : undefined;
        if (target && primitive) {
          setEntities(current => current.map(entity => entity.id !== target.id ? entity : {
            ...entity,
            components: entity.components.map(component => component.id === primitive.id
              ? { ...primitive, textureAssetId: asset.id }
              : component),
          }));
          setStatus(`${file.name} saved and applied to ${target.name}.`);
          return;
        }
      }
      createAssetEntity(asset, modelScale);
      setStatus(applyTextureToSelectedObject
        ? `${file.name} saved as a new image because the selected object cannot receive a 3D texture.`
        : `${file.name} saved on this device and added to the scene.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not save this asset on this device.');
    }
  }, [createAssetEntity, entities, selection]);

  const makeTexture = useCallback(async (
    pattern: TexturePattern = 'checker',
    palette: TexturePalette = 'violet',
    applyToSelectedObject = false,
  ) => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext('2d');
    if (!context) {
      setStatus('This browser could not create a texture image.');
      return;
    }
    const colors: Record<TexturePalette, { base: string; accent: string }> = {
      violet: { base: '#4f267e', accent: '#b254ef' },
      silver: { base: '#3d434c', accent: '#d7dce4' },
      red: { base: '#531d26', accent: '#ff564d' },
    };
    const selectedColors = colors[palette];
    context.fillStyle = selectedColors.base;
    context.fillRect(0, 0, 256, 256);
    context.fillStyle = selectedColors.accent;
    if (pattern === 'checker') {
      for (let row = 0; row < 8; row++) {
        for (let column = 0; column < 8; column++) {
          if ((row + column) % 2 === 0) context.fillRect(column * 32, row * 32, 32, 32);
        }
      }
    } else if (pattern === 'stripes') {
      for (let column = 0; column < 8; column += 2) context.fillRect(column * 32, 0, 16, 256);
    } else {
      for (let line = 0; line <= 8; line++) {
        const position = line * 32;
        context.fillRect(position, 0, 2, 256);
        context.fillRect(0, position, 256, 2);
      }
    }
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) {
      setStatus('Could not generate the texture image.');
      return;
    }
    const file = new File([blob], `Texture-${new Date().toISOString().slice(0, 10)}.png`, { type: 'image/png' });
    await importFile(file, true, 1, applyToSelectedObject);
  }, [importFile]);

  const createEmptyObject = useCallback(() => {
    const entity = createSceneEntity('Empty Object', nextPosition(), null, false);
    entity.components = entity.components.filter(component => component.type === 'transform');
    addEntity(entity);
  }, [addEntity, nextPosition]);

  const createCameraEntity = useCallback(() => {
    const entity = createSceneEntity('Camera', nextPosition(), null, false);
    entity.components = [
      ...entity.components,
      { id: crypto.randomUUID(), type: 'camera', enabled: true, fov: 50, target: { x: 0, y: 0, z: 0 }, useTransformRotation: false },
    ];
    addEntity(entity);
  }, [addEntity, nextPosition]);

  const createLightEntity = useCallback(() => {
    const entity = createSceneEntity('Point Light', nextPosition(), null, false);
    entity.components = [
      ...entity.components,
      { id: crypto.randomUUID(), type: 'light', enabled: true, kind: 'point', color: '#ffffff', intensity: 1 },
    ];
    addEntity(entity);
  }, [addEntity, nextPosition]);

  const createEffectEntity = useCallback(() => {
    const entity = createSceneEntity('Particle Effect', nextPosition(), null, false);
    entity.components = [
      ...entity.components.filter(component => component.type === 'transform'),
      { id: crypto.randomUUID(), type: 'effect', enabled: true, color: '#ee72ff', intensity: 1 },
    ];
    addEntity(entity);
  }, [addEntity, nextPosition]);

  const createUIEntity = useCallback((kind: UIElementKind) => {
    const name = uiElementKinds.find(item => item.value === kind)?.label ?? 'UI Canvas';
    const entity = createSceneEntity(name, nextPosition(), null, false);
    entity.components = [
      ...entity.components,
      { id: crypto.randomUUID(), type: 'uiCanvas', enabled: true, controlId: crypto.randomUUID(), kind },
    ];
    addEntity(entity);
  }, [addEntity, nextPosition]);

  const createScriptEntity = useCallback(() => {
    const entity = createSceneEntity('New Script', nextPosition(), null, false);
    entity.components = [
      ...entity.components,
      { id: crypto.randomUUID(), type: 'script', enabled: false, scriptId: crypto.randomUUID() },
    ];
    addEntity(entity);
    setStatus('A blank script component was added. It is saved but not executed.');
  }, [addEntity, nextPosition]);

  const createPlane = useCallback((settings: PlaneSettings, color?: string) => {
    createPrimitiveEntity('plane', 'Plane', {
      scale: {
        x: settings.width / 10 * settings.size,
        y: settings.depth / 10 * settings.size,
        z: settings.size,
      },
      ...(color ? { color } : {}),
      bodyType: 'static',
    });
  }, [createPrimitiveEntity]);

  const createTerrain = useCallback((settings: TerrainSettings & { size: number }) => {
    const { size, ...terrainSettings } = settings;
    createPrimitiveEntity('terrain', 'Terrain', {
      scale: { x: size, y: size, z: size },
      terrainSettings,
      bodyType: 'static',
    });
  }, [createPrimitiveEntity]);

  const applyTerrainBrush = useCallback((
    terrainId: string,
    action: TerrainToolAction,
    radius?: number,
    strength?: number,
  ) => {
    const terrain = entities.find(entity => entity.id === terrainId);
    if (!terrain) {
      setStatus('Select a Terrain in Hierarchy before using a terrain brush.');
      return;
    }
    const updated = appendTerrainBrushEdit(terrain, action, radius, strength);
    if (!updated) {
      setStatus('This Terrain cannot accept another edit. Each terrain supports up to 128 brush edits.');
      return;
    }
    setActiveSceneTool({
      label: action === 'raise' ? 'Raise Terrain' : action === 'lower' ? 'Lower Terrain' : 'Smooth Terrain',
      Icon: action === 'raise' ? ArrowUp : action === 'lower' ? ArrowDown : Waves,
    });
    setEntities(current => current.map(entity => entity.id === terrainId ? updated : entity));
    setSelection(terrainId);
    const label = action === 'raise' ? 'Raised' : action === 'lower' ? 'Lowered' : 'Smoothed';
    setStatus(`${label} a circular area at the center of ${terrain.name}. The change is saved with the project.`);
  }, [entities]);

  const addTreesToTerrain = useCallback((terrainId: string, count = 3, spacing: TreeSpacing = 'normal') => {
    setActiveSceneTool({ label: 'Add Trees', Icon: Trees });
    const terrain = entities.find(entity => entity.id === terrainId);
    if (!terrain) {
      setStatus('Select a Terrain in Hierarchy before adding trees.');
      return;
    }
    const safeCount = Number.isInteger(count) ? Math.max(1, Math.min(20, count)) : 3;
    const grove = createTerrainTreeGrove(terrain, safeCount, spacing);
    if (!isSceneGraph([...entities, ...grove])) {
      setStatus('The tree group could not be added to this scene.');
      return;
    }
    setEntities(current => [...current, ...grove]);
    setSelection(grove[0].id);
    setStatus(`Added ${safeCount} editable trees under the selected Terrain.`);
  }, [entities]);

  const addWaterToTerrain = useCallback((
    terrainId: string,
    coverage: WaterCoverage = 'full',
    level: WaterLevel = 'normal',
  ) => {
    const terrain = entities.find(entity => entity.id === terrainId);
    if (!terrain) {
      setStatus('Select a Terrain in Hierarchy before adding water.');
      return;
    }
    const water = createTerrainWater(terrain, coverage, level);
    if (!isSceneGraph([...entities, water])) {
      setStatus('Water could not be added to this scene.');
      return;
    }
    setActiveSceneTool({ label: 'Add Water', Icon: Droplets });
    setEntities(current => [...current, water]);
    setSelection(water.id);
    setStatus('Added an editable water surface to the selected Terrain.');
  }, [entities]);

  const showImportPicker = useCallback((modelScale = 1) => {
    importScaleRef.current = modelScale;
    importInputRef.current?.click();
  }, []);
  const showTexturePicker = useCallback((applyToSelectedObject = false) => {
    textureApplyTargetRef.current = applyToSelectedObject;
    textureInputRef.current?.click();
  }, []);
  const openTimeline = useCallback(() => {
    setPreviewEntities(null);
    setTimelineOpen(true);
  }, []);

  const previewAnimationFrame = useCallback((animation: GameAnimation | null, time: number) => {
    if (!animation) {
      setPreviewEntities(null);
      return;
    }
    const frame = sampleGameAnimation(animation, time);
    setPreviewEntities(entities.map(entity => {
      if (entity.id !== animation.targetEntityId) return entity;
      const transform = getTransform(entity);
      const nextTransform = {
        ...transform,
        position: frame.position,
        rotation: frame.rotation,
        scale: { x: frame.scale, y: frame.scale, z: frame.scale },
      };
      return {
        ...entity,
        components: entity.components.map(component => component.id === transform.id ? nextTransform : component),
      };
    }));
  }, [entities]);

  const hierarchyActions: HierarchyActions = {
    onDeleteEntity: removeEntityFromScene,
    onCreateShape: shape => {
      const definition = primitiveShapes.find(item => item.value === shape);
      createPrimitiveEntity(shape, definition?.label ?? 'Object');
    },
    onCreatePlane: createPlane,
    onCreateTerrain: createTerrain,
    onImportAsset: showImportPicker,
    onUploadTexture: showTexturePicker,
    onUseAsset: createAssetEntity,
    onCreateCamera: createCameraEntity,
    onCreateLight: createLightEntity,
    onCreateEffect: createEffectEntity,
    onCreateUI: createUIEntity,
    onCreateScript: createScriptEntity,
    onCreateTexture: () => { void makeTexture(); },
    onOpenTimeline: openTimeline,
    onCreateEmpty: createEmptyObject,
    onTerrainBrush: applyTerrainBrush,
    onAddTrees: addTreesToTerrain,
    onAddWater: addWaterToTerrain,
  };

  return (
    <main className="fresh-layout" aria-label="Blank Madhorse workspace">
      <div className="fresh-toolbar" role="toolbar" aria-label="Workspace tools">
        <button type="button" className="fresh-canvas-button" data-testid="button-scene-preview"
          aria-pressed={!canvasView && !playTestOn} aria-controls="fresh-panel-1"
          title="Switch to the editable 3D scene preview" disabled={playTestOn}
          onClick={() => setCanvasView(false)}>Scene Preview</button>
        <button type="button" className="fresh-canvas-button" data-testid="button-canvas"
          aria-pressed={canvasView || playTestOn} aria-controls="fresh-panel-1"
          title="Show the live Game Camera canvas"
          disabled={playTestOn} onClick={() => setCanvasView(true)}>
          <Grid2X2 size={12} aria-hidden="true" /> Game Canvas
        </button>
        {projectControls(playTestOn || saveFailed, latestProjectSnapshot)}
        <button type="button" className="fresh-canvas-button" data-testid="button-undo"
          disabled={!editHistory.canUndo || historyBlocked}
          title={editHistory.notice || (editHistory.canUndo ? `Undo: ${editHistory.undoLabel} (Ctrl/Cmd+Z)` : 'Nothing to undo in this session')}
          onClick={editHistory.undo}>Undo</button>
        <button type="button" className="fresh-canvas-button" data-testid="button-redo"
          disabled={!editHistory.canRedo || historyBlocked}
          title={editHistory.canRedo ? `Redo: ${editHistory.redoLabel} (Ctrl+Y / Ctrl/Cmd+Shift+Z)` : 'Nothing to redo'}
          onClick={editHistory.redo}>Redo</button>
        <WorkspaceRenderSettings source={authoredState} projectId={projectId} projectName={projectName}
          disabled={historyBlocked} onInspect={id => { setSelection(id); setEditingEntityId(id); }} />
        <button
          type="button"
          className={`fresh-play-test${playTestOn ? ' is-playing' : ''}`}
          aria-pressed={playTestOn}
          data-testid="button-play-test"
          onClick={() => {
            if (!playTestOn) {
              unlockSceneAudio();
              playPlayerRef.current = selection;
            }
            setPlayTestOn(value => !value);
          }}
        >
          {playTestOn ? 'Stop Test' : 'Play Test'}
        </button>
      </div>
      <input
        ref={importInputRef}
        className="fresh-file-input"
        type="file"
        accept={IMPORT_ACCEPT}
        onChange={event => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = '';
          void importFile(file, false, importScaleRef.current);
          importScaleRef.current = 1;
        }}
      />
      <input
        ref={textureInputRef}
        className="fresh-file-input"
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
        onChange={event => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = '';
          void importFile(file, true, 1, textureApplyTargetRef.current);
          textureApplyTargetRef.current = false;
        }}
      />
      {[1, 2, 3, 4, 5].map((number) => (
        <section
          key={number}
          id={`fresh-panel-${number}`}
          className={`fresh-panel fresh-panel-${number}`}
          aria-label={`Panel ${number}`}
        >
          {number === 1 ? (
            <SceneViewport
              projectName={projectName}
              entities={playTestOn ? runtimeEntities ?? entities : entities}
              assets={assets}
              assetUrls={assetUrls}
              camera={playTestOn ? runtimeCamera ?? camera : camera}
              isPlaying={playTestOn}
              canvasView={canvasView}
              activeTool={activeSceneTool}
              selection={selection}
              frameRequest={characterFrameRequest}
              onSelect={setSelection}
              onTransformCommit={updateTransform}
              onCameraChange={playTestOn ? setRuntimeCamera : setCamera}
              actionHud={runtimeActionHud}
            />
          ) : number === 2 ? (
            <HierarchyPanel
              blocked={historyBlocked}
              onFocus={focusSelectedObject}
              onDuplicate={duplicateSelectedObject}
              onEditorChange={(id, flag, value) => {
                if (historyBlocked) return;
                setEntities(current => setSceneEditorFlag(current, id, flag, value));
                setStatus(flag === 'hidden'
                  ? `${value ? 'Hidden' : 'Shown'} in the scene editor only. Play and exported games are unchanged.`
                  : `Scene picking ${value ? 'locked' : 'unlocked'}. Hierarchy and Settings remain editable.`);
              }}
              onEditorReset={flag => {
                if (historyBlocked) return;
                setEntities(current => resetSceneEditorFlag(current, flag));
                setStatus(flag === 'hidden' ? 'All scene-editor objects are visible again.' : 'All scene picking locks removed.');
              }}
              entities={entities}
              camera={camera}
              assets={assets}
              selection={selection}
              onSelect={setSelection}
              onEditEntity={entity => {
                setSelection(entity.id);
                setEditingEntityId(entity.id);
              }}
              onAttachPlugin={attachPluginComponent}
              onAttachPluginSet={attachPluginSet}
              onOpenCharacterBuilder={openCharacterBuilder}
              actions={hierarchyActions}
            />
          ) : number === 3 ? (
            <SettingsPanel
              egoBox={<EgoPanelBox project={builderProject} camera={camera} selectedEntityId={selection}
                interfaceContext={egoInterfaceContext} gameVision={egoGameVision} gameFlow={egoGameFlow}
                gameNotes={egoGameNotes} onGameVisionChange={setEgoGameVision}
                onGameFlowChange={setEgoGameFlow} onGameNotesChange={setEgoGameNotes}
                onOpen={() => setEgoOpen(true)} />}
              entity={editingEntity}
              selectedEntity={selectedEntity}
              entities={entities}
              assets={assets}
              assetUrls={assetUrls}
              builderBuildLogs={builderBuildLogs}
              onReturnToSettings={() => setEditingEntityId(null)}
              onOpenSceneStarterKits={() => setStarterKitsOpen(true)}
              onOpenStoryboard={() => setStoryboardOpen(true)}
              onOpenCharacterBuilder={openCharacterBuilder}
              onOpenTimeline={openTimeline}
              onCreateScriptableObject={createScriptableObject}
              onEditScriptableObject={setEditingScriptableObjectId}
              onCreatePbrMaterial={() => setEditingPbrMaterialId('new')}
              onEditPbrMaterial={setEditingPbrMaterialId}
              onAttachPlugin={attachPluginComponent}
              onSaveEntity={updateEntitySettings}
              multiplayerMember={multiplayerMember}
              multiplayerSnapshot={multiplayerSnapshot}
              onMultiplayerMemberChange={setMultiplayerMember}
              onMultiplayerSnapshotChange={setMultiplayerSnapshot}
            />
          ) : number === 4 ? (
            <>
              <span className="fresh-panel-number" aria-hidden="true">4</span>
              <div className="fresh-panel-builder-entry">
                <button type="button" className="fresh-builder-open" onClick={() => setMadBuilderOpen(true)}>
                  <strong>Mad Builder</strong>
                  <span>Open builder</span>
                </button>
              </div>
            </>
          ) : (
            <WorldToolsPanel
              onActiveToolChange={setActiveSceneTool}
              activeToolset={panel5Toolset}
              onSelectToolset={setPanel5Toolset}
              onCreateTerrain={() => setPanel5Dialog('terrain')}
              onImportAsset={showImportPicker}
              terrainAvailable={Boolean(selectedEntity && getPrimitive(selectedEntity)?.shape === 'terrain')}
              selectedObjectCanReceiveTexture={Boolean(selectedEntity && getPrimitive(selectedEntity))}
              canEditSelectedModel={Boolean(
                selectedEntity
                && assets.find(asset => asset.id === getModelRenderer(selectedEntity)?.assetId && /\.(glb|gltf)$/i.test(asset.name))
                && assetUrls[getModelRenderer(selectedEntity)?.assetId ?? ''],
              )}
              onTerrainBrush={(action, radius, strength) => {
                if (selection) applyTerrainBrush(selection, action, radius, strength);
              }}
              onAddTrees={(count, spacing) => {
                if (selection) addTreesToTerrain(selection, count, spacing);
              }}
              onAddWater={(coverage, level) => {
                if (selection) addWaterToTerrain(selection, coverage, level);
              }}
              onCreateShape={(shape, options) => {
                if (shape === 'plane') {
                  setPanel5PlaneOptions(options ?? null);
                  setPanel5Dialog('plane');
                  return;
                }
                const definition = primitiveShapes.find(item => item.value === shape);
                createPrimitiveEntity(shape, definition?.label ?? 'Object', options);
              }}
              onUploadTexture={showTexturePicker}
              onCreateTexture={(pattern, palette, applyToSelectedObject) => {
                void makeTexture(pattern, palette, applyToSelectedObject);
              }}
              onPreviewAnimation={openTimeline}
              onOpenModeling={openModelingWorkspace}
            />
          )}
        </section>
      ))}
      {starterKitsOpen && <GameStarterKitDialog onAdd={addStarterKit} onClose={() => setStarterKitsOpen(false)} />}
      {storyboardOpen && <StoryboardEditor
        entities={entities}
        onCreate={createStoryboardScene}
        onSave={updateStoryboardScene}
        onClose={() => setStoryboardOpen(false)}
      />}
      <div className="fresh-debugger-dock">
        {debuggerOpen && (
          <section className="fresh-debugger-drawer" id="fresh-debugger-drawer" role="region" aria-label="System debugger" data-testid="system-debugger-drawer">
            <header>
              <strong>System Debugger</strong>
              <button type="button" onClick={() => setDebuggerOpen(false)} aria-label="Close debugger">×</button>
            </header>
            <SystemDebugger runtimeError="" />
          </section>
        )}
        <div className="fresh-debugger-toolbar" role="toolbar" aria-label="Workspace diagnostics">
          <span>System diagnostics</span>
          <button
            type="button"
            className="fresh-debugger-toggle"
            aria-expanded={debuggerOpen}
            aria-controls={debuggerOpen ? 'fresh-debugger-drawer' : undefined}
            data-testid="button-toggle-debugger"
            onClick={() => setDebuggerOpen(open => !open)}
          >
            <Activity size={13} aria-hidden="true" />
            {debuggerOpen ? 'Hide Debugger' : 'Debugger'}
          </button>
        </div>
      </div>
      {panel5Dialog === 'plane' && (
        <PlaneSettingsDialog
          initialSize={panel5PlaneOptions?.scale.x ?? 1}
          onCancel={() => {
            setPanel5Dialog(null);
            setPanel5PlaneOptions(null);
          }}
          onCreate={settings => {
            setPanel5Dialog(null);
            createPlane(settings, panel5PlaneOptions?.color);
            setPanel5PlaneOptions(null);
          }}
        />
      )}
      {panel5Dialog === 'terrain' && (
        <TerrainSettingsDialog
          onCancel={() => setPanel5Dialog(null)}
          onCreate={settings => {
            setPanel5Dialog(null);
            createTerrain(settings);
          }}
        />
      )}
      {madBuilderOpen && createPortal(
        <div
          className="fresh-mad-builder-backdrop"
          role="presentation"
          onClick={event => {
            if (event.target === event.currentTarget) setMadBuilderOpen(false);
          }}
        >
          <section className="fresh-mad-builder-dialog" role="dialog" aria-modal="true" aria-label="Mad Builder">
            <MadBuilderMenu
              key={projectId}
              embedded
              onClose={() => setMadBuilderOpen(false)}
              onAddModule={addMadBuilderModule}
              {...madBuilderWithEgoTools}
            />
          </section>
        </div>,
        document.body,
      )}
      {egoOpen && createPortal(
        <div
          className="fresh-mad-builder-backdrop"
          role="presentation"
          onClick={event => {
            if (event.target === event.currentTarget) setEgoOpen(false);
          }}
        >
          <section className="fresh-mad-builder-dialog ego-dialog" role="dialog" aria-modal="true" aria-label="Ego assistant">
            <EgoAssistant
              interfaceContext={egoInterfaceContext}
              gameVision={egoGameVision}
              onGameVisionChange={setEgoGameVision}
              gameFlow={egoGameFlow}
              onGameFlowChange={setEgoGameFlow}
              gameNotes={egoGameNotes}
              onGameNotesChange={setEgoGameNotes}
              project={builderProject}
              animationsCount={animations.length}
              animationControllersCount={animationControllers.length}
              scripts={egoScripts}
              camera={camera}
              selectedEntityId={selection}
              onBuildVision={buildEgoVision}
              onBuildUi={buildEgoUiKit}
              onAddFunctions={addEgoGameFunctions}
              onCreateScript={createEgoProjectScript}
              onUpdateScript={updateEgoProjectScript}
              onDeleteScript={deleteEgoProjectScript}
              onClose={() => setEgoOpen(false)}
            />
          </section>
        </div>,
        document.body,
      )}
      {editingScriptableObject && <ScriptableObjectEditor
        key={editingScriptableObject.id}
        asset={editingScriptableObject}
        onClose={() => setEditingScriptableObjectId(null)}
        onSave={saveScriptableObject}
      />}
      {editingPbrMaterialId && (editingPbrMaterialId === 'new' || editingPbrMaterial) && <PbrMaterialEditor
        key={editingPbrMaterial?.id ?? 'new-pbr-material'}
        asset={editingPbrMaterial}
        imageAssets={assets.filter(asset => asset.kind === 'image')}
        onImportMaps={importPbrMaps}
        onSave={savePbrMaterial}
        onClose={() => setEditingPbrMaterialId(null)}
      />}
      {status && <div className="fresh-status" role="status">{status}<button type="button" onClick={() => setStatus('')} aria-label="Dismiss status">×</button></div>}
      {modelingOpen && <Suspense fallback={<div className="fresh-status" role="status">Loading modeling workspace…</div>}>
        <ModelingWorkspace onClose={() => setModelingOpen(false)} onSave={saveModelingAsset} initialSource={modelingSource} />
      </Suspense>}
      {timelineOpen && (
        <div className="fresh-timeline-backdrop" role="presentation" onMouseDown={event => {
          if (event.target === event.currentTarget) {
            setPreviewEntities(null);
            setTimelineOpen(false);
          }
        }}>
          <section className="fresh-timeline-dialog" role="dialog" aria-modal="true" aria-labelledby="fresh-timeline-title">
            <header>
              <div>
                <span className="fresh-dialog-kicker">SCENE 1</span>
                <h2 id="fresh-timeline-title">Animation Timeline</h2>
              </div>
              <button type="button" onClick={() => { setPreviewEntities(null); setTimelineOpen(false); }} aria-label="Close animation timeline">×</button>
            </header>
            <AnimationEditor
              animations={animations}
              controllers={animationControllers}
              entities={entities}
              selectedEntityId={selection}
              readOnly={false}
              onChange={next => {
                if (!isGameAnimationCollection(next)) return;
                animationsRef.current = next;
                setAnimations(next);
                const validClipIds = new Set(next.map(animation => animation.id));
                const nextControllers = animationControllersRef.current.map(controller => ({
                  ...controller,
                  states: Object.fromEntries(
                    Object.entries(controller.states).map(([state, ids]) =>
                      [state, ids.filter(id => validClipIds.has(id))],
                    ),
                  ),
                }));
                if (isEgoAnimationControllerCollection(nextControllers)) {
                  animationControllersRef.current = nextControllers;
                  setAnimationControllers(nextControllers);
                }
              }}
              onPreviewFrame={previewAnimationFrame}
            />
          </section>
        </div>
      )}
    </main>
  );
}
