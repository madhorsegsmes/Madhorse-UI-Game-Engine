/** Fresh workspace with local scene authoring and an intentionally blank panel layout. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Dispatch, KeyboardEvent, MouseEvent, SetStateAction } from 'react';
import { ChevronDown, ChevronRight, FileDown, Folder, Trash2 } from 'lucide-react';
import { ScenePreview3D, type SceneTransformMode } from './scene-preview-3d';
import {
  createPhysicsComponent,
  createSceneEntity,
  createStarterCube,
  getCamera,
  getTransform,
  primitiveShapes,
  projectAssetKind,
  uiElementKinds,
  type PrimitiveShape,
  type ProjectAsset,
  type SceneEntity,
  type TerrainSettings,
  type TransformComponent,
  type UIElementKind,
} from '@/lib/scene-model';
import { createGameCamera, type GameCamera } from '@/lib/game-camera';
import { cameraWithPose, PRIMARY_CAMERA_ID, primaryCameraEntity } from '@/lib/camera-editor';
import { SceneObjectGlyph } from './scene-object-glyph';
import { SceneObjectInspector } from './scene-object-inspector';
import {
  HierarchyContextMenu,
  PlaneSettingsDialog,
  TerrainSettingsDialog,
  type HierarchyMenuPoint,
  type PlaneSettings,
} from './hierarchy-context-menu';
import { AnimationEditor } from './animation-editor';
import { isGameAnimationCollection, sampleGameAnimation, type GameAnimation } from '@/lib/game-api';
import {
  FRESH_WORKSPACE_ID,
  loadFreshWorkspace,
  saveFreshWorkspace,
} from '@/lib/fresh-workspace-storage';
import { loadLocalAsset, saveLocalAsset } from '@/lib/asset-vault';
import { MadBuilderMenu } from './mad-builder-menu';
import { useMadBuilder, type BuilderDocument } from '@/hooks/use-mad-builder';
import type { BuilderMessage } from './mad-builder-contract';
import type { MadBuilderPlan } from '@workspace/api-client-react';
import { capturePrefab, instantiatePrefab, type ScenePrefab } from '@/lib/scene-authoring';
import { compileBuilderPlan } from '@/lib/mad-builder';
import { createMadBuilderModulePlan, getMadBuilderModule, type MadBuilderModuleId } from '@/lib/mad-builder-modules';
import type { UIControlElement } from '@/lib/ui-controls';
import { downloadMadBuilderLogPdf, type MadBuilderBuildLog } from '@/lib/mad-builder-build-log';
import { createGameTypeLibraryPdf, gameTypeLibraryEntryCount } from '@/lib/game-type-library';
import CHARACTER_CONTROLLER_REFERENCE from '@/lib/character-controller-reference.md?raw';
import ENGINE_EDITOR_PERFORMANCE_REFERENCE from '@/lib/engine-editor-performance-reference.md?raw';
import './system-panel-tools.css';
import './numbered-workspace.css';

const WORKSPACE_ASSET_LIMIT = 100 * 1024 * 1024;
const IMPORT_ACCEPT = '.png,.jpg,.jpeg,.webp,.gif,.svg,.glb,.gltf,.obj,.fbx,.dae';

function SceneViewport({
  entities,
  camera,
  assets,
  assetUrls,
  selection,
  onSelect,
  onTransformCommit,
  onCameraChange,
}: {
  entities: SceneEntity[];
  camera: GameCamera;
  assets: ProjectAsset[];
  assetUrls: Record<string, string>;
  selection: string | null;
  onSelect: (id: string) => void;
  onTransformCommit: (
    entityId: string,
    changes: Partial<Pick<TransformComponent, 'position' | 'rotation' | 'scale'>>,
  ) => void;
  onCameraChange: (camera: GameCamera) => void;
}) {
  const [transformMode, setTransformMode] = useState<SceneTransformMode>('translate');
  return (
    <div className="fresh-viewport">
      <ScenePreview3D
        primaryCamera={camera}
        gameCamera={camera}
        entities={entities}
        assets={assets}
        assetUrls={assetUrls}
        selectedEntityId={selection}
        playerPreviewPosition={{ x: 0, y: 0 }}
        transformMode={transformMode}
        readOnly={false}
        onSelectEntity={onSelect}
        onTransformCommit={onTransformCommit}
        onTransformModeChange={setTransformMode}
        onPrimaryCameraChange={onCameraChange}
        onSelectPrimaryCamera={() => onSelect(PRIMARY_CAMERA_ID)}
      />
    </div>
  );
}

function SettingsPanel({
  entity,
  assets,
  builderBuildLogs,
  onReturnToSettings,
  onSaveEntity,
}: {
  entity: SceneEntity | null;
  assets: ProjectAsset[];
  builderBuildLogs: MadBuilderBuildLog[];
  onReturnToSettings: () => void;
  onSaveEntity: (entity: SceneEntity) => void;
}) {
  const [activeFunctionTab, setActiveFunctionTab] = useState<
    'game-system' | 'player-functions' | 'game-controls' | 'player-controls' | 'npc-functions' | 'npc-controls'
  >('game-system');
  const [activePluginTab, setActivePluginTab] = useState<
    'game' | 'player-npc' | 'system' | 'lighting' | 'animation' | 'asset' | 'effect' | 'triggers' | 'trigger-zones' | 'skybox' | 'character-builder' | 'behavior-builder'
  >('game');
  const [gameTypeLibraryPdfUrl, setGameTypeLibraryPdfUrl] = useState<string | null>(null);
  const gameTypeLibraryPdfUrlRef = useRef<string | null>(null);

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
          assets={assets}
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
                  aria-pressed={activeFunctionTab === 'npc-controls'}
                  data-active={activeFunctionTab === 'npc-controls'}
                  data-testid="button-npc-controls"
                  onClick={() => setActiveFunctionTab('npc-controls')}
                >
                  NPC Controls
                </button>
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
                  onClick={() => setActivePluginTab('character-builder')}
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
              </div>
            </div>
          </details>
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
  actions,
}: {
  entities: SceneEntity[];
  camera: GameCamera;
  assets: ProjectAsset[];
  selection: string | null;
  onSelect: (id: string) => void;
  onEditEntity: (entity: SceneEntity) => void;
  actions: HierarchyActions;
}) {
  const [sceneExpanded, setSceneExpanded] = useState(true);
  const [menuPoint, setMenuPoint] = useState<HierarchyMenuPoint | null>(null);
  const [menuEntityId, setMenuEntityId] = useState<string | null>(null);
  const sceneEntities = [primaryCameraEntity(camera), ...entities];

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
    if (!window.confirm(`Delete "${entity.name}"?${childNotice} This cannot be undone.`)) return;
    actions.onDeleteEntity(entityId);
  }

  const contextEntity = entities.find(entity => entity.id === menuEntityId);
  return (
    <aside className="fresh-hierarchy" aria-label="Hierarchy"
      aria-description="Right-click to create scene objects, delete an object, import assets, or open the animation timeline. Use the trash button to delete an object. Double-click or double-tap an object to rename it and edit its settings."
      onContextMenu={handleContextMenu} onKeyDown={handleKeyDown}>
      <h2 className="fresh-hierarchy-heading">Hierarchy</h2>
      <button
        type="button"
        className="fresh-scene-root"
        aria-expanded={sceneExpanded}
        onClick={() => setSceneExpanded(value => !value)}
      >
        {sceneExpanded ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
        <span>Scene 1</span>
      </button>
      {sceneExpanded && (
        <SceneObjectRows
          entities={sceneEntities}
          parentId={null}
          depth={0}
          selection={selection}
          onSelect={onSelect}
          onEdit={onEditEntity}
          onDelete={requestDeleteEntity}
        />
      )}
      <p className="fresh-hierarchy-help">Right-click to add or delete objects. Use the trash icon to delete an object. Double-tap an object to rename it and edit its settings.</p>
      {menuPoint && (
        <HierarchyContextMenu
          point={menuPoint}
          assets={assets}
          deleteTarget={contextEntity && contextEntity.id !== 'player' ? {
            id: contextEntity.id,
            name: contextEntity.name,
            childCount: collectHierarchySubtreeIds(entities, contextEntity.id).size - 1,
          } : null}
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
};

function SceneObjectRows({
  entities,
  parentId,
  depth,
  selection,
  onSelect,
  onEdit,
  onDelete,
}: {
  entities: SceneEntity[];
  parentId: string | null;
  depth: number;
  selection: string | null;
  onSelect: (id: string) => void;
  onEdit: (entity: SceneEntity) => void;
  onDelete: (id: string) => void;
}) {
  const rows = entities.filter(entity => entity.parentId === parentId);
  if (rows.length === 0) return null;
  return (
    <ul className="fresh-hierarchy-list" role="group">
      {rows.map(entity => (
        <SceneObjectRow
          key={entity.id}
          entity={entity}
          entities={entities}
          depth={depth}
          selection={selection}
          onSelect={onSelect}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </ul>
  );
}

function SceneObjectRow({
  entity,
  entities,
  depth,
  selection,
  onSelect,
  onEdit,
  onDelete,
}: {
  entity: SceneEntity;
  entities: SceneEntity[];
  depth: number;
  selection: string | null;
  onSelect: (id: string) => void;
  onEdit: (entity: SceneEntity) => void;
  onDelete: (id: string) => void;
}) {
  const children = entities.some(candidate => candidate.parentId === entity.id);
  const [expanded, setExpanded] = useState(true);
  const lastTouchTap = useRef(0);
  return (
    <li className="fresh-hierarchy-row" data-hierarchy-entity-id={entity.id}>
      <div className="fresh-hierarchy-row-content" style={{ paddingLeft: 4 + depth * 14 }}>
        {children ? (
          <button
            type="button"
            className="fresh-hierarchy-disclosure"
            aria-label={`${expanded ? 'Collapse' : 'Expand'} ${entity.name}`}
            aria-expanded={expanded}
            onClick={() => setExpanded(value => !value)}
          >
            {expanded ? <ChevronDown size={13} aria-hidden="true" /> : <ChevronRight size={13} aria-hidden="true" />}
          </button>
        ) : <span className="fresh-hierarchy-disclosure-spacer" />}
        <SceneObjectGlyph entity={entity} />
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
      {expanded && (
        <SceneObjectRows
          entities={entities}
          parentId={entity.id}
          depth={depth + 1}
          selection={selection}
          onSelect={onSelect}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      )}
    </li>
  );
}

type Panel5Toolset = 'world' | 'model';

function WorldToolsPanel({
  activeToolset,
  onSelectToolset,
  onCreateObject,
  onCreatePlane,
  onCreateTerrain,
  onCreateLight,
  onCreateCamera,
  onImportAsset,
  onCreateEmpty,
  onCreateShape,
  onUploadTexture,
  onCreateTexture,
  onPreviewAnimation,
}: {
  activeToolset: Panel5Toolset;
  onSelectToolset: (toolset: Panel5Toolset) => void;
  onCreateObject: () => void;
  onCreatePlane: () => void;
  onCreateTerrain: () => void;
  onCreateLight: () => void;
  onCreateCamera: () => void;
  onImportAsset: () => void;
  onCreateEmpty: () => void;
  onCreateShape: (shape: PrimitiveShape) => void;
  onUploadTexture: () => void;
  onCreateTexture: () => void;
  onPreviewAnimation: () => void;
}) {
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
          <div className="fresh-world-tool-grid">
            <button type="button" className="fresh-world-tool-button" data-testid="panel5-create-object" onClick={onCreateObject}>Create Object</button>
            <button type="button" className="fresh-world-tool-button" data-testid="panel5-create-plane" onClick={onCreatePlane}>Create Plane</button>
            <button type="button" className="fresh-world-tool-button" data-testid="panel5-create-terrain" onClick={onCreateTerrain}>Create Terrain</button>
            <button type="button" className="fresh-world-tool-button" data-testid="panel5-create-light" onClick={onCreateLight}>Add Light</button>
            <button type="button" className="fresh-world-tool-button" data-testid="panel5-create-camera" onClick={onCreateCamera}>Add Camera</button>
            <button type="button" className="fresh-world-tool-button" data-testid="panel5-import-world-asset" onClick={onImportAsset}>Import Asset</button>
            <button type="button" className="fresh-world-tool-button" data-testid="panel5-create-empty" onClick={onCreateEmpty}>Empty Object</button>
          </div>
        ) : (
          <>
            <div className="fresh-world-tool-grid fresh-world-tool-grid-compact" aria-label="Model and texture actions">
              <button type="button" className="fresh-world-tool-button" data-testid="panel5-import-model" onClick={onImportAsset}>Import Asset</button>
              <button type="button" className="fresh-world-tool-button" data-testid="panel5-upload-texture" onClick={onUploadTexture}>Upload Texture</button>
              <button type="button" className="fresh-world-tool-button" data-testid="panel5-create-texture" onClick={onCreateTexture}>Create Texture</button>
            </div>
            <p className="fresh-model-shapes-label">Create 3D Shape</p>
            <div className="fresh-model-shape-grid" aria-label="3D shape tools">
              {primitiveShapes.map(shape => (
                <button
                  type="button"
                  key={shape.value}
                  className="fresh-world-tool-button"
                  data-testid={`panel5-shape-${shape.value}`}
                  onClick={() => onCreateShape(shape.value)}
                >
                  {shape.label}
                </button>
              ))}
            </div>
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

export default function BlankWorkspace() {
  const [initialScene] = useState(() => {
    const entities = [createStarterCube()];
    return { entities, camera: createGameCamera(entities) };
  });
  const [savedWorkspace] = useState(loadFreshWorkspace);
  const [entities, setEntities] = useState(savedWorkspace.entities ?? initialScene.entities);
  const [camera, setCamera] = useState<GameCamera>(savedWorkspace.camera ?? initialScene.camera);
  const [assets, setAssets] = useState<ProjectAsset[]>(savedWorkspace.assets ?? []);
  const [animations, setAnimations] = useState<GameAnimation[]>(savedWorkspace.animations ?? []);
  const [builderHistory, setBuilderHistory] = useState<BuilderMessage[]>(savedWorkspace.builderHistory ?? []);
  const [builderDraft, setBuilderDraft] = useState<MadBuilderPlan | null>(savedWorkspace.builderDraft ?? null);
  const [builderDraftRequest, setBuilderDraftRequest] = useState(savedWorkspace.builderDraftRequest ?? '');
  const [builderBuildLogs, setBuilderBuildLogs] = useState<MadBuilderBuildLog[]>(savedWorkspace.builderBuildLogs ?? []);
  const [prefabs, setPrefabs] = useState<ScenePrefab[]>(savedWorkspace.prefabs ?? []);
  const [uiControls, setUIControls] = useState<UIControlElement[]>(savedWorkspace.uiControls ?? []);
  const [assetUrls, setAssetUrls] = useState<Record<string, string>>({});
  const [selection, setSelection] = useState<string | null>('starter-cube');
  const [editingEntityId, setEditingEntityId] = useState<string | null>(null);
  const [madBuilderOpen, setMadBuilderOpen] = useState(false);
  const [previewEntities, setPreviewEntities] = useState<SceneEntity[] | null>(null);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [panel5Toolset, setPanel5Toolset] = useState<Panel5Toolset>('world');
  const [panel5Dialog, setPanel5Dialog] = useState<'plane' | 'terrain' | null>(null);
  const [status, setStatus] = useState('');
  const importInputRef = useRef<HTMLInputElement>(null);
  const textureInputRef = useRef<HTMLInputElement>(null);
  const editingEntity = editingEntityId === PRIMARY_CAMERA_ID
    ? primaryCameraEntity(camera)
    : entities.find(entity => entity.id === editingEntityId) ?? null;
  const builderProject: BuilderDocument = {
    id: FRESH_WORKSPACE_ID,
    entities,
    assets,
    prefabs,
    uiControls,
    scripts: [],
    builderHistory,
    builderDraft,
    builderDraftRequest,
    builderBuildLogs,
  };
  const builderProjectRef = useRef(builderProject);
  builderProjectRef.current = builderProject;

  const setBuilderProjects: Dispatch<SetStateAction<BuilderDocument[]>> = useCallback(update => {
    const projects = typeof update === 'function' ? update([builderProjectRef.current]) : update;
    const next = projects.find(project => project.id === FRESH_WORKSPACE_ID);
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
  }, []);

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

  useEffect(() => {
    if (!madBuilderOpen) return;
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setMadBuilderOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [madBuilderOpen]);

  useEffect(() => {
    try {
      saveFreshWorkspace({
        entities, camera, assets, animations, builderHistory, builderDraft, builderDraftRequest,
        builderBuildLogs, prefabs, uiControls,
      });
    } catch {
      setStatus('Could not save the scene data in this browser. Check available storage.');
    }
  }, [entities, camera, assets, animations, builderHistory, builderDraft, builderDraftRequest, builderBuildLogs, prefabs, uiControls]);

  useEffect(() => {
    let disposed = false;
    const urls: string[] = [];
    async function loadAssets() {
      const loaded = await Promise.all(assets.map(async asset => {
        try {
          const blob = await loadLocalAsset(FRESH_WORKSPACE_ID, asset.id);
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
    setAnimations(current => current.filter(animation => !removedIds.has(animation.targetEntityId)));
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

  const nextPosition = useCallback(() => ({
    x: 50 + (entities.length % 8) * 12,
    y: 50 + Math.floor(entities.length / 8) * 12,
    z: 0,
  }), [entities.length]);

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

  const createAssetEntity = useCallback((asset: ProjectAsset) => {
    const entity = createSceneEntity(asset.name, nextPosition(), null, false);
    if (asset.kind === 'image') {
      entity.components = [
        ...entity.components,
        { id: crypto.randomUUID(), type: 'spriteRenderer', enabled: true, assetId: asset.id, tint: '#ffffff', width: 100, height: 100 },
      ];
    } else {
      entity.components = [
        ...entity.components,
        { id: crypto.randomUUID(), type: 'modelRenderer', enabled: true, assetId: asset.id },
      ];
    }
    addEntity(entity);
  }, [addEntity, nextPosition]);

  const importFile = useCallback(async (file: File | undefined, imagesOnly = false) => {
    if (!file) return;
    if (file.size > WORKSPACE_ASSET_LIMIT) {
      setStatus('This file is too large for local browser storage. Choose a file smaller than 100 MB.');
      return;
    }
    const kind = projectAssetKind(file.name, file.type);
    if (!kind || (imagesOnly && kind !== 'image')) {
      setStatus(imagesOnly ? 'Choose a supported 2D image file.' : 'Choose a supported image or 3D model file.');
      return;
    }
    const asset: ProjectAsset = {
      id: crypto.randomUUID(),
      name: file.name,
      kind,
      mimeType: file.type || (kind === 'image' ? 'application/octet-stream' : 'model/unknown'),
      size: file.size,
      addedAt: new Date().toISOString(),
    };
    try {
      await saveLocalAsset(FRESH_WORKSPACE_ID, asset.id, file);
      setAssets(current => [...current, asset]);
      createAssetEntity(asset);
      setStatus(`${file.name} saved on this device and added to the scene.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not save this asset on this device.');
    }
  }, [createAssetEntity]);

  const makeTexture = useCallback(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext('2d');
    if (!context) {
      setStatus('This browser could not create a texture image.');
      return;
    }
    context.fillStyle = '#4f267e';
    context.fillRect(0, 0, 256, 256);
    context.fillStyle = '#b254ef';
    for (let row = 0; row < 8; row++) {
      for (let column = 0; column < 8; column++) {
        if ((row + column) % 2 === 0) context.fillRect(column * 32, row * 32, 32, 32);
      }
    }
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) {
      setStatus('Could not generate the texture image.');
      return;
    }
    const file = new File([blob], `Texture-${new Date().toISOString().slice(0, 10)}.png`, { type: 'image/png' });
    await importFile(file, true);
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

  const createPlane = useCallback((settings: PlaneSettings) => {
    createPrimitiveEntity('plane', 'Plane', {
      scale: {
        x: settings.width / 10 * settings.size,
        y: settings.depth / 10 * settings.size,
        z: settings.size,
      },
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

  const showImportPicker = useCallback(() => importInputRef.current?.click(), []);
  const showTexturePicker = useCallback(() => textureInputRef.current?.click(), []);
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
  };

  return (
    <main className="fresh-layout" aria-label="Blank Madhorse workspace">
      <div className="fresh-toolbar" role="toolbar" aria-label="Empty toolbar" />
      <input
        ref={importInputRef}
        className="fresh-file-input"
        type="file"
        accept={IMPORT_ACCEPT}
        onChange={event => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = '';
          void importFile(file);
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
          void importFile(file, true);
        }}
      />
      {[1, 2, 3, 4, 5].map((number) => (
        <section
          key={number}
          className={`fresh-panel fresh-panel-${number}`}
          aria-label={`Panel ${number}`}
        >
          {number === 1 ? (
            <SceneViewport
              entities={entities}
              assets={assets}
              assetUrls={assetUrls}
              camera={camera}
              selection={selection}
              onSelect={setSelection}
              onTransformCommit={updateTransform}
              onCameraChange={setCamera}
            />
          ) : number === 2 ? (
            <HierarchyPanel
              entities={entities}
              camera={camera}
              assets={assets}
              selection={selection}
              onSelect={setSelection}
              onEditEntity={entity => {
                setSelection(entity.id);
                setEditingEntityId(entity.id);
              }}
              actions={hierarchyActions}
            />
          ) : number === 3 ? (
            <SettingsPanel
              entity={editingEntity}
              assets={assets}
              builderBuildLogs={builderBuildLogs}
              onReturnToSettings={() => setEditingEntityId(null)}
              onSaveEntity={updateEntitySettings}
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
              activeToolset={panel5Toolset}
              onSelectToolset={setPanel5Toolset}
              onCreateObject={() => createPrimitiveEntity('cube', 'Cube')}
              onCreatePlane={() => setPanel5Dialog('plane')}
              onCreateTerrain={() => setPanel5Dialog('terrain')}
              onCreateLight={createLightEntity}
              onCreateCamera={createCameraEntity}
              onImportAsset={showImportPicker}
              onCreateEmpty={createEmptyObject}
              onCreateShape={shape => {
                if (shape === 'plane') {
                  setPanel5Dialog('plane');
                  return;
                }
                const definition = primitiveShapes.find(item => item.value === shape);
                createPrimitiveEntity(shape, definition?.label ?? 'Object');
              }}
              onUploadTexture={showTexturePicker}
              onCreateTexture={() => { void makeTexture(); }}
              onPreviewAnimation={openTimeline}
            />
          )}
        </section>
      ))}
      {panel5Dialog === 'plane' && (
        <PlaneSettingsDialog
          onCancel={() => setPanel5Dialog(null)}
          onCreate={settings => {
            setPanel5Dialog(null);
            createPlane(settings);
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
              key={FRESH_WORKSPACE_ID}
              embedded
              onClose={() => setMadBuilderOpen(false)}
              onAddModule={addMadBuilderModule}
              {...madBuilder}
            />
          </section>
        </div>,
        document.body,
      )}
      {status && <div className="fresh-status" role="status">{status}<button type="button" onClick={() => setStatus('')} aria-label="Dismiss status">×</button></div>}
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
              entities={entities}
              selectedEntityId={selection}
              readOnly={false}
              onChange={next => {
                if (isGameAnimationCollection(next)) setAnimations(next);
              }}
              onPreviewFrame={previewAnimationFrame}
            />
          </section>
        </div>
      )}
    </main>
  );
}
