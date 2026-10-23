/** Fresh layout surface. Engine modules remain intact and inactive. */
import { useCallback, useState } from 'react';
import { ScenePreview3D, type SceneTransformMode } from './scene-preview-3d';
import { createStarterCube, getTransform, type TransformComponent } from '@/lib/scene-model';
import { createGameCamera, type GameCamera } from '@/lib/game-camera';
import { PRIMARY_CAMERA_ID } from '@/lib/camera-editor';
import './numbered-workspace.css';

function SceneViewport() {
  const [starter] = useState(() => {
    const entities = [createStarterCube()];
    return { entities, camera: createGameCamera(entities) };
  });
  const [entities, setEntities] = useState(starter.entities);
  const [camera, setCamera] = useState<GameCamera>(starter.camera);
  const [selection, setSelection] = useState<string | null>('starter-cube');
  const [transformMode, setTransformMode] = useState<SceneTransformMode>('translate');

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
        onSelectEntity={setSelection}
        onTransformCommit={updateTransform}
        onTransformModeChange={setTransformMode}
        onPrimaryCameraChange={setCamera}
        onSelectPrimaryCamera={() => setSelection(PRIMARY_CAMERA_ID)}
      />
    </div>
  );
}

export default function BlankWorkspace() {
  return (
    <main className="fresh-layout" aria-label="Blank Madhorse workspace">
      <div className="fresh-toolbar" role="toolbar" aria-label="Empty toolbar" />
      {[1, 2, 3, 4, 5].map((number) => (
        <section
          key={number}
          className={`fresh-panel fresh-panel-${number}`}
          aria-label={`Panel ${number}`}
        >
          {number === 1 ? <SceneViewport /> : (
            <span className="fresh-panel-number" aria-hidden="true">{number}</span>
          )}
        </section>
      ))}
    </main>
  );
}
