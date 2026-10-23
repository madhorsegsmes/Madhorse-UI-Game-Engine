/** Fresh layout surface. Engine modules remain intact and inactive. */
import { useCallback, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { ScenePreview3D, type SceneTransformMode } from './scene-preview-3d';
import {
  createStarterCube, getTransform, type SceneEntity, type TransformComponent,
} from '@/lib/scene-model';
import { createGameCamera, type GameCamera } from '@/lib/game-camera';
import { PRIMARY_CAMERA_ID, primaryCameraEntity } from '@/lib/camera-editor';
import { SceneObjectGlyph } from './scene-object-glyph';
import './numbered-workspace.css';

function SceneViewport({
  entities,
  camera,
  selection,
  onSelect,
  onTransformCommit,
  onCameraChange,
}: {
  entities: SceneEntity[];
  camera: GameCamera;
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
        assets={[]}
        assetUrls={{}}
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

function HierarchyPanel({
  entities,
  camera,
  selection,
  onSelect,
}: {
  entities: SceneEntity[];
  camera: GameCamera;
  selection: string | null;
  onSelect: (id: string) => void;
}) {
  const [sceneExpanded, setSceneExpanded] = useState(true);
  const sceneEntities = [primaryCameraEntity(camera), ...entities];

  function ObjectRows({ parentId = null, depth = 0 }: { parentId?: string | null; depth?: number }) {
    const rows = sceneEntities.filter(entity => entity.parentId === parentId);

    return (
      <ul className="fresh-hierarchy-list" role={depth === 0 ? 'group' : undefined}>
        {rows.map(entity => (
          <li key={entity.id} className="fresh-hierarchy-row">
            <div className="fresh-hierarchy-row-content" style={{ paddingLeft: 4 + depth * 14 }}>
              <SceneObjectGlyph entity={entity} />
              <button
                type="button"
                className="fresh-hierarchy-item"
                aria-pressed={selection === entity.id}
                onClick={() => onSelect(entity.id)}
              >
                <span>{entity.name}</span>
              </button>
            </div>
            <ObjectRows parentId={entity.id} depth={depth + 1} />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <aside className="fresh-hierarchy" aria-label="Hierarchy">
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
      {sceneExpanded && <ObjectRows />}
    </aside>
  );
}

export default function BlankWorkspace() {
  const [initialScene] = useState(() => {
    const entities = [createStarterCube()];
    return { entities, camera: createGameCamera(entities) };
  });
  const [entities, setEntities] = useState(initialScene.entities);
  const [camera, setCamera] = useState<GameCamera>(initialScene.camera);
  const [selection, setSelection] = useState<string | null>('starter-cube');

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

  return (
    <main className="fresh-layout" aria-label="Blank Madhorse workspace">
      <div className="fresh-toolbar" role="toolbar" aria-label="Empty toolbar" />
      {[1, 2, 3, 4, 5].map((number) => (
        <section
          key={number}
          className={`fresh-panel fresh-panel-${number}`}
          aria-label={`Panel ${number}`}
        >
          {number === 1 ? (
            <SceneViewport
              entities={entities}
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
              selection={selection}
              onSelect={setSelection}
            />
          ) : <span className="fresh-panel-number" aria-hidden="true">{number}</span>}
        </section>
      ))}
    </main>
  );
}
