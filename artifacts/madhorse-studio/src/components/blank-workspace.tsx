/** Fresh workspace with local scene authoring and an intentionally blank panel layout. */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, MouseEvent } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
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
import { HierarchyContextMenu, type HierarchyMenuPoint, type PlaneSettings } from './hierarchy-context-menu';
import { AnimationEditor } from './animation-editor';
import { isGameAnimationCollection, sampleGameAnimation, type GameAnimation } from '@/lib/game-api';
import {
  FRESH_WORKSPACE_ID,
  loadFreshWorkspace,
  saveFreshWorkspace,
} from '@/lib/fresh-workspace-storage';
import { loadLocalAsset, saveLocalAsset } from '@/lib/asset-vault';
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
  onReturnToSettings,
  onSaveEntity,
}: {
  entity: SceneEntity | null;
  assets: ProjectAsset[];
  onReturnToSettings: () => void;
  onSaveEntity: (entity: SceneEntity) => void;
}) {
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
          <section className="fresh-settings-category">
            <h2>Functions &amp; Controls</h2>
          </section>
          <section className="fresh-settings-category">
            <h2>System Presets &amp; Data</h2>
          </section>
        </div>
      )}
    </div>
  );
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
  const sceneEntities = [primaryCameraEntity(camera), ...entities];

  function openMenu(x: number, y: number) {
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
    openMenu(event.clientX, event.clientY);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return;
    event.preventDefault();
    const target = event.target instanceof Element ? event.target : null;
    const row = target?.closest<HTMLElement>('[data-hierarchy-entity-id]');
    const entityId = row?.dataset.hierarchyEntityId;
    if (entityId) onSelect(entityId);
    const bounds = (row ?? event.currentTarget).getBoundingClientRect();
    openMenu(bounds.left, bounds.bottom);
  }

  return (
    <aside className="fresh-hierarchy" aria-label="Hierarchy"
      aria-description="Right-click to create scene objects, import assets, or open the animation timeline. Double-click or double-tap an object to rename it and edit its settings."
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
        />
      )}
      <p className="fresh-hierarchy-help">Right-click to add objects. Double-tap an object to rename it and edit its settings.</p>
      {menuPoint && (
        <HierarchyContextMenu
          point={menuPoint}
          assets={assets}
          onClose={() => setMenuPoint(null)}
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
}: {
  entities: SceneEntity[];
  parentId: string | null;
  depth: number;
  selection: string | null;
  onSelect: (id: string) => void;
  onEdit: (entity: SceneEntity) => void;
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
}: {
  entity: SceneEntity;
  entities: SceneEntity[];
  depth: number;
  selection: string | null;
  onSelect: (id: string) => void;
  onEdit: (entity: SceneEntity) => void;
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
      </div>
      {expanded && (
        <SceneObjectRows
          entities={entities}
          parentId={entity.id}
          depth={depth + 1}
          selection={selection}
          onSelect={onSelect}
          onEdit={onEdit}
        />
      )}
    </li>
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
  const [assetUrls, setAssetUrls] = useState<Record<string, string>>({});
  const [selection, setSelection] = useState<string | null>('starter-cube');
  const [editingEntityId, setEditingEntityId] = useState<string | null>(null);
  const [previewEntities, setPreviewEntities] = useState<SceneEntity[] | null>(null);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [status, setStatus] = useState('');
  const importInputRef = useRef<HTMLInputElement>(null);
  const textureInputRef = useRef<HTMLInputElement>(null);
  const editingEntity = editingEntityId === PRIMARY_CAMERA_ID
    ? primaryCameraEntity(camera)
    : entities.find(entity => entity.id === editingEntityId) ?? null;

  useEffect(() => {
    try {
      saveFreshWorkspace({ entities, camera, assets, animations });
    } catch {
      setStatus('Could not save the scene data in this browser. Check available storage.');
    }
  }, [entities, camera, assets, animations]);

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
              onReturnToSettings={() => setEditingEntityId(null)}
              onSaveEntity={updateEntitySettings}
            />
          ) : <span className="fresh-panel-number" aria-hidden="true">{number}</span>}
        </section>
      ))}
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
