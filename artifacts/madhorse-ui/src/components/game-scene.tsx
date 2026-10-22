import { useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { ScenePreview3D } from '@/components/scene-preview-3d';
import type { SceneTransformMode } from '@/components/scene-preview-3d';
import { isGamePosition, type GamePosition } from '@/lib/game-api';
import {
  getModelRenderer,
  getSpriteRenderer,
  getWorldTransform,
  type ProjectAsset,
  type SceneEntity,
  type TransformComponent,
} from '@/lib/scene-model';

type GameSceneProps = {
  entities: SceneEntity[];
  assets: ProjectAsset[];
  assetUrls: Record<string, string>;
  selectedEntityId: string | null;
  position: GamePosition;
  startingPosition: GamePosition;
  onSaveStartingPosition: (position: GamePosition) => void;
  readOnly: boolean;
  onSelectEntity: (entityId: string) => void;
  onMoveEntity: (entityId: string, position: GamePosition) => void;
  onUpdateTransform: (
    entityId: string,
    changes: Partial<Pick<TransformComponent, 'position' | 'rotation' | 'scale'>>,
  ) => void;
};

export function GameScene({
  entities,
  assets,
  assetUrls,
  selectedEntityId,
  position,
  startingPosition,
  onSaveStartingPosition,
  readOnly,
  onSelectEntity,
  onMoveEntity,
  onUpdateTransform,
}: GameSceneProps) {
  const [viewMode, setViewMode] = useState<'3d' | '2d'>('3d');
  const [transformMode, setTransformMode] = useState<SceneTransformMode>('translate');
  const selectedName = entities.find((entity) => entity.id === selectedEntityId)?.name ?? 'No selection';

  return (
    <div className="game-scene">
      <div className="scene-view-tabs" role="tablist" aria-label="Scene preview mode">
        <button
          type="button"
          role="tab"
          aria-selected={viewMode === '3d'}
          className={viewMode === '3d' ? 'is-active' : ''}
          data-testid="tab-scene-3d"
          onClick={() => setViewMode('3d')}
        >3D Preview</button>
        <button
          type="button"
          role="tab"
          aria-selected={viewMode === '2d'}
          className={viewMode === '2d' ? 'is-active' : ''}
          data-testid="tab-scene-2d"
          onClick={() => setViewMode('2d')}
        >2D Preview</button>
        <span className="scene-view-status">{readOnly ? 'Script running' : selectedName}</span>
      </div>
      <div className={`scene-preview-shell scene-preview-${viewMode}`} data-testid="scene-preview">
        {viewMode === '3d' ? (
          <ScenePreview3D
            entities={entities}
            assets={assets}
            assetUrls={assetUrls}
            selectedEntityId={selectedEntityId}
            playerPreviewPosition={position}
            transformMode={transformMode}
            readOnly={readOnly}
            onSelectEntity={onSelectEntity}
            onTransformCommit={onUpdateTransform}
            onTransformModeChange={setTransformMode}
          />
        ) : (
          <ScenePreview2D
            entities={entities}
            assetUrls={assetUrls}
            selectedEntityId={selectedEntityId}
            position={position}
            readOnly={readOnly}
            onSelectEntity={onSelectEntity}
            onMoveEntity={onMoveEntity}
          />
        )}
      </div>
      {viewMode === '3d' && (
        <div className="scene-accessibility-markers" aria-label="Scene objects">
          {entities.map((entity) => {
          const world = getWorldTransform(entities, entity.id);
          if (!world) return null;
          const isPlayer = entity.id === 'player';
          const current = isPlayer ? position : world.position;
          return (
            <span
              key={entity.id}
              role="img"
              aria-label={`${entity.name} object at x ${current.x}, y ${current.y}, z ${world.position.z}`}
              data-testid={isPlayer ? 'scene-player' : `scene-object-${entity.id}`}
              data-entity-id={entity.id}
              data-x={current.x}
              data-y={current.y}
              data-z={world.position.z}
              data-sprite-asset-id={getSpriteRenderer(entity)?.assetId ?? ''}
              data-model-asset-id={getModelRenderer(entity)?.assetId ?? ''}
            />
          );
          })}
        </div>
      )}
      <span className="scene-position">
        {selectedName} · {viewMode.toUpperCase()} preview
      </span>
      <span className="scene-position">
        Runtime preview · player · x {position.x} · y {position.y} · script changes are not saved
      </span>
      <StartingPositionControls
        key={`${startingPosition.x},${startingPosition.y}`}
        position={startingPosition}
        running={readOnly}
        onSave={onSaveStartingPosition}
      />
    </div>
  );
}

function ScenePreview2D({
  entities,
  assetUrls,
  selectedEntityId,
  position,
  readOnly,
  onSelectEntity,
  onMoveEntity,
}: Pick<GameSceneProps, 'entities' | 'assetUrls' | 'selectedEntityId' | 'position' | 'readOnly' | 'onSelectEntity' | 'onMoveEntity'>) {
  const fieldRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<{ entityId: string; pointerId: number } | null>(null);
  const worldByEntity = useMemo(() => new Map(
    entities.map((entity) => [entity.id, getWorldTransform(entities, entity.id)]),
  ), [entities]);

  const moveFromPointer = (
    event: PointerEvent<HTMLButtonElement>,
    entityId: string,
  ) => {
    if (readOnly || dragging.current?.entityId !== entityId ||
        dragging.current.pointerId !== event.pointerId) return;
    const bounds = fieldRef.current?.getBoundingClientRect();
    if (!bounds || bounds.width === 0 || bounds.height === 0) return;
    onMoveEntity(entityId, {
      x: Math.max(0, Math.min(100, ((event.clientX - bounds.left) / bounds.width) * 100)),
      y: Math.max(0, Math.min(100, ((event.clientY - bounds.top) / bounds.height) * 100)),
    });
  };

  const moveFromKeyboard = (event: KeyboardEvent<HTMLButtonElement>, entityId: string) => {
    if (readOnly) return;
    const delta = event.shiftKey ? 10 : 1;
    const current = worldByEntity.get(entityId);
    if (!current) return;
    const next = { x: current.position.x, y: current.position.y };
    if (event.key === 'ArrowLeft') next.x -= delta;
    else if (event.key === 'ArrowRight') next.x += delta;
    else if (event.key === 'ArrowUp') next.y -= delta;
    else if (event.key === 'ArrowDown') next.y += delta;
    else return;
    event.preventDefault();
    onMoveEntity(entityId, next);
  };

  const orderedEntities = [...entities].sort((a, b) =>
    (worldByEntity.get(a.id)?.position.z ?? 0) - (worldByEntity.get(b.id)?.position.z ?? 0),
  );

  return (
    <div className="scene-2d-view">
      <span className="scene-title">{readOnly ? 'Script running · 2D preview' : '2D scene · drag objects or use arrow keys to position'}</span>
      <div
        ref={fieldRef}
        className="scene-field"
        aria-label="Game scene, coordinates 0 to 100"
        data-testid="scene-field"
      >
        {orderedEntities.map((entity) => {
          const world = worldByEntity.get(entity.id);
          if (!world) return null;
          const sprite = getSpriteRenderer(entity);
          const isPlayer = entity.id === 'player';
          const previewPosition = isPlayer ? position : world.position;
          const x = Math.max(0, Math.min(100, previewPosition.x));
          const y = Math.max(0, Math.min(100, previewPosition.y));
          const inheritedInactive = (() => {
            let parentId = entity.parentId;
            const visited = new Set<string>([entity.id]);
            while (parentId) {
              if (visited.has(parentId)) return true;
              visited.add(parentId);
              const parent = entities.find((entry) => entry.id === parentId);
              if (!parent) return true;
              if (!parent.active) return true;
              parentId = parent.parentId;
            }
            return !entity.active;
          })();
          const imageUrl = sprite?.assetId ? assetUrls[sprite.assetId] : undefined;
          return (
            <button
              key={entity.id}
              type="button"
              className={[
                isPlayer ? 'scene-player' : 'scene-object',
                selectedEntityId === entity.id ? 'is-selected' : '',
                inheritedInactive ? 'is-inactive' : '',
                readOnly ? 'is-read-only' : '',
              ].filter(Boolean).join(' ')}
              aria-label={isPlayer
                ? `Player object at x ${position.x}, y ${position.y}`
                : `${entity.name} object at x ${world.position.x}, y ${world.position.y}`}
              aria-pressed={selectedEntityId === entity.id}
              title={readOnly ? entity.name : `${entity.name}: drag to move`}
              data-testid={isPlayer ? 'scene-player' : `scene-object-${entity.id}`}
              data-x={previewPosition.x}
              data-y={previewPosition.y}
              data-entity-id={entity.id}
              disabled={readOnly}
              onClick={() => onSelectEntity(entity.id)}
              onKeyDown={(event) => moveFromKeyboard(event, entity.id)}
              onPointerDown={(event) => {
                if (readOnly || !fieldRef.current) return;
                onSelectEntity(entity.id);
                dragging.current = { entityId: entity.id, pointerId: event.pointerId };
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerMove={(event) => moveFromPointer(event, entity.id)}
              onPointerUp={(event) => {
                if (dragging.current?.entityId === entity.id && dragging.current.pointerId === event.pointerId) {
                  dragging.current = null;
                }
              }}
              onPointerCancel={() => {
                if (dragging.current?.entityId === entity.id) dragging.current = null;
              }}
              style={{
                left: `${x}%`,
                top: `${y}%`,
                width: `${sprite?.width ?? 14}px`,
                height: `${sprite?.height ?? 14}px`,
                transform: `translate(-50%, -50%) rotate(${world.rotation.z}deg) scale(${world.scale.x}, ${world.scale.y})`,
                backgroundColor: sprite?.enabled ? sprite.tint : 'transparent',
                zIndex: Math.round(world.position.z + 200),
              }}
            >
              {sprite?.enabled && imageUrl
                ? <img src={imageUrl} alt="" draggable={false} />
                : !sprite && <span className="scene-empty-object" aria-hidden="true">O</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StartingPositionControls({ position, running, onSave }: {
  position: GamePosition; running: boolean; onSave: (position: GamePosition) => void;
}) {
  const [x, setX] = useState(String(position.x));
  const [y, setY] = useState(String(position.y));
  const next = { x: Number(x), y: Number(y) };
  const valid = x.trim() !== '' && y.trim() !== '' && isGamePosition(next);
  return (
    <form className="scene-start-controls" aria-label="Saved starting position" onSubmit={(event) => {
      event.preventDefault();
      if (valid && !running) onSave(next);
    }}>
      <span>Saved start · x {position.x} · y {position.y}</span>
      <label>Starting X <input type="number" min="0" max="100" step="any" required value={x} disabled={running} onChange={(event) => setX(event.target.value)} /></label>
      <label>Starting Y <input type="number" min="0" max="100" step="any" required value={y} disabled={running} onChange={(event) => setY(event.target.value)} /></label>
      <button type="submit" disabled={running || !valid}>Save starting position</button>
      <small role="status">{running ? 'Stop the script before editing the start.' : !valid ? 'Enter finite coordinates from 0 to 100.' : 'Save applies this start to the preview and stores it in this browser. Scene editor changes also save the start; scripts change only the runtime preview.'}</small>
    </form>
  );
}
