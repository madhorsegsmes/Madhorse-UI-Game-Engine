import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { Plane, Raycaster, Vector2, Vector3 } from 'three';
import { makeGameViewCamera, type GameCamera } from '@/lib/game-camera';
import { PRIMARY_CAMERA_ID } from '@/lib/camera-editor';
import { ScenePreview3D } from '@/components/scene-preview-3d';
import type { SceneTransformMode } from '@/components/scene-preview-3d';
import { isGamePosition, type GamePosition } from '@/lib/game-api';
import {
  getModelRenderer,
  getPrimitive, getCamera, getLight, getUICanvas,
  getSpriteRenderer,
  getWorldTransform,
  type ProjectAsset,
  type SceneEntity,
  type TransformComponent,
} from '@/lib/scene-model';
import type { UIControlElement } from '@/lib/ui-controls';

type GameSceneProps = {
  primaryCamera: GameCamera;
  viewMode: '3d' | '2d';
  onViewModeChange: (mode: '3d' | '2d') => void;
  gameCamera: GameCamera;
  entities: SceneEntity[];
  uiControls: UIControlElement[];
  selectedUIControlId: string | null;
  assets: ProjectAsset[];
  assetUrls: Record<string, string>;
  selectedEntityId: string | null;
  position: GamePosition;
  startingPosition: GamePosition;
  onSaveStartingPosition: (position: GamePosition) => void;
  readOnly: boolean;
  onSelectEntity: (entityId: string) => void;
  onMoveEntity: (entityId: string, position: GamePosition) => void;
  onSelectUIControl: (id: string | null) => void;
  onMoveUIControl: (id: string, x: number, y: number) => void;
  onUpdateTransform: (
    entityId: string,
    changes: Partial<Pick<TransformComponent, 'position' | 'rotation' | 'scale'>>,
  ) => void;
  onPrimaryCameraChange?: (camera: GameCamera) => void;
  onCameraEntityTransform?: (
    entityId: string,
    changes: Partial<Pick<TransformComponent, 'position' | 'rotation' | 'scale'>>,
  ) => void;
  onSelectPrimaryCamera?: () => void;
};

export function GameScene({
  primaryCamera,
  viewMode,
  onViewModeChange,
  gameCamera,
  entities,
  uiControls,
  selectedUIControlId,
  assets,
  assetUrls,
  selectedEntityId,
  position,
  startingPosition,
  onSaveStartingPosition,
  readOnly,
  onSelectEntity,
  onMoveEntity,
  onSelectUIControl,
  onMoveUIControl,
  onUpdateTransform,
  onPrimaryCameraChange,
  onCameraEntityTransform,
  onSelectPrimaryCamera,
}: GameSceneProps) {
  const [transformMode, setTransformMode] = useState<SceneTransformMode>('translate');
  const [expanded, setExpanded] = useState(false);
  const sceneRootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!expanded) return;
    const stage = sceneRootRef.current?.closest('.stage');
    const previousOverflow = document.body.style.overflow;
    stage?.classList.add('is-scene-expanded');
    document.body.style.overflow = 'hidden';
    const escape = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') setExpanded(false); };
    window.addEventListener('keydown', escape);
    return () => {
      stage?.classList.remove('is-scene-expanded');
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', escape);
    };
  }, [expanded]);
  const [gameGraphicsUnavailable, setGameGraphicsUnavailable] = useState(false);
  const onGraphicsUnavailable = useCallback(() => setGameGraphicsUnavailable(true), []);
  const onGraphicsReady = useCallback(() => setGameGraphicsUnavailable(false), []);
  const selectedName = selectedEntityId === PRIMARY_CAMERA_ID ? 'Game Camera' : entities.find((entity) => entity.id === selectedEntityId)?.name ?? 'No selection';
  const uiDragging = useRef<{ id: string; pointerId: number } | null>(null);

  const moveUIControlFromPointer = (event: PointerEvent<HTMLButtonElement>, id: string) => {
    if (readOnly || uiDragging.current?.id !== id || uiDragging.current.pointerId !== event.pointerId) return;
    const bounds = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!bounds || bounds.width === 0 || bounds.height === 0) return;
    onMoveUIControl(
      id,
      Math.max(0, Math.min(100, ((event.clientX - bounds.left) / bounds.width) * 100)),
      Math.max(0, Math.min(100, ((event.clientY - bounds.top) / bounds.height) * 100)),
    );
  };

  const moveUIControlFromKeyboard = (event: KeyboardEvent<HTMLButtonElement>, element: UIControlElement) => {
    if (readOnly) return;
    const delta = event.shiftKey ? 10 : 1;
    let x = element.x;
    let y = element.y;
    if (event.key === 'ArrowLeft') x -= delta;
    else if (event.key === 'ArrowRight') x += delta;
    else if (event.key === 'ArrowUp') y -= delta;
    else if (event.key === 'ArrowDown') y += delta;
    else return;
    event.preventDefault();
    onMoveUIControl(element.id, Math.max(0, Math.min(100, x)), Math.max(0, Math.min(100, y)));
  };

  return (
    <div ref={sceneRootRef} className="game-scene">
      <button type="button" className="scene-expand-button" data-testid="scene-expand" aria-pressed={expanded}
        onClick={() => setExpanded((value) => !value)}>{expanded ? 'Restore view' : 'Expand view'}</button>
      <div className="scene-view-tabs" role="tablist" aria-label="Scene preview mode">
        <button
          type="button"
          role="tab"
          aria-selected={viewMode === '3d'}
          className={viewMode === '3d' ? 'is-active' : ''}
          data-testid="tab-scene-3d"
          onClick={() => onViewModeChange('3d')}
        >3D Preview</button>
        <button
          type="button"
          role="tab"
          aria-selected={viewMode === '2d'}
          className={viewMode === '2d' ? 'is-active' : ''}
          data-testid="tab-scene-2d"
          onClick={() => onViewModeChange('2d')}
        >Canvas</button>
        <span className="scene-view-status">{readOnly ? 'Play mode' : viewMode === '2d' ? 'Game Camera' : selectedName}</span>
      </div>
      <div className={`scene-preview-shell scene-preview-${viewMode}`} data-testid="scene-preview">
          <ScenePreview3D
            primaryCamera={primaryCamera}
            key={viewMode}
            gameView={viewMode === '2d'}
            gameCamera={gameCamera}
            onGraphicsUnavailable={onGraphicsUnavailable}
            onGraphicsReady={onGraphicsReady}
            graphicsFallback={viewMode === '2d' ? (
              <ScenePreview2D
                gameCamera={gameCamera}
                entities={entities}
                assetUrls={assetUrls}
                selectedEntityId={selectedEntityId}
                position={position}
                readOnly={readOnly}
                onSelectEntity={onSelectEntity}
                onMoveEntity={onMoveEntity}
              />
            ) : undefined}
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
            onPrimaryCameraChange={readOnly ? undefined : onPrimaryCameraChange}
            onCameraEntityTransform={onCameraEntityTransform}
            onSelectPrimaryCamera={onSelectPrimaryCamera}
          />
          {viewMode === '2d' && uiControls.length > 0 && (
            <div className="game-ui-overlay" aria-label="Game interface preview" data-testid="game-ui-overlay">
              {uiControls.filter((control) => {
                let owner = entities.find((entity) => getUICanvas(entity)?.controlId === control.id);
                if (owner && !getUICanvas(owner)?.enabled) return false;
                const visited = new Set<string>();
                while (owner) {
                  if (!owner.active || visited.has(owner.id)) return false;
                  visited.add(owner.id);
                  owner = entities.find((entity) => entity.id === owner!.parentId);
                }
                return true;
              }).map((element, index) => (
                <button
                  key={element.id}
                  type="button"
                  className={[
                    'game-ui-element',
                    `is-${element.type}`,
                    entities.some((entity) => {
                      const canvas = getUICanvas(entity);
                      return canvas?.controlId === element.id && canvas.frame !== false;
                    }) ? 'is-canvas-root' : '',
                    selectedUIControlId === element.id ? 'is-selected' : '',
                    readOnly ? 'is-read-only' : '',
                  ].filter(Boolean).join(' ')}
                  aria-label={`${element.label || element.type} interface element at ${Math.round(element.x)}%, ${Math.round(element.y)}%`}
                  aria-pressed={selectedUIControlId === element.id}
                  title={readOnly ? element.label : `${element.label}: drag to arrange`}
                  data-testid={`ui-preview-element-${element.id}`}
                  data-ui-control-id={element.id}
                  data-x={element.x}
                  data-y={element.y}
                  disabled={readOnly}
                  onClick={() => onSelectUIControl(element.id)}
                  onKeyDown={(event) => moveUIControlFromKeyboard(event, element)}
                  onPointerDown={(event) => {
                    if (readOnly) return;
                    event.preventDefault();
                    onSelectUIControl(element.id);
                    uiDragging.current = { id: element.id, pointerId: event.pointerId };
                    event.currentTarget.setPointerCapture(event.pointerId);
                  }}
                  onPointerMove={(event) => moveUIControlFromPointer(event, element.id)}
                  onPointerUp={(event) => {
                    if (uiDragging.current?.id === element.id && uiDragging.current.pointerId === event.pointerId) {
                      uiDragging.current = null;
                    }
                  }}
                  onPointerCancel={() => {
                    if (uiDragging.current?.id === element.id) uiDragging.current = null;
                  }}
                  style={{
                    left: `${element.x}%`,
                    top: `${element.y}%`,
                    width: `${element.width}px`,
                    minHeight: `${element.height}px`,
                    zIndex: index + 1,
                    color: element.type === 'text' ? element.color : undefined,
                    backgroundColor: element.type === 'health-bar' || element.type === 'text' ? 'transparent' : element.color,
                  }}
                >
                  {element.type === 'health-bar' ? (
                    <span className="game-ui-health">
                      <span className="game-ui-label">{element.label}</span>
                      <span className="game-ui-health-track"><span style={{ width: '72%', backgroundColor: element.color }} /></span>
                    </span>
                  ) : element.label}
                </button>
              ))}
            </div>
          )}
      </div>
      {(viewMode === '3d' || !gameGraphicsUnavailable) && (
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
      <details className="scene-preview-settings" data-testid="scene-preview-settings">
        <summary>Preview settings</summary>
        <span className="scene-position">
          Runtime preview · player · x {position.x} · y {position.y} · script changes are not saved
        </span>
        <StartingPositionControls
          key={`${startingPosition.x},${startingPosition.y}`}
          position={startingPosition}
          running={readOnly}
          onSave={onSaveStartingPosition}
        />
      </details>
    </div>
  );
}

function ScenePreview2D({
  gameCamera,
  entities,
  assetUrls,
  selectedEntityId,
  position,
  readOnly,
  onSelectEntity,
  onMoveEntity,
}: Pick<GameSceneProps, 'gameCamera' | 'entities' | 'assetUrls' | 'selectedEntityId' | 'position' | 'readOnly' | 'onSelectEntity' | 'onMoveEntity'>) {
  const fieldRef = useRef<HTMLDivElement>(null);
  const [fieldSize, setFieldSize] = useState({ width: 1, height: 1 });
  useEffect(() => {
    const field = fieldRef.current;
    if (!field) return;
    const update = () => setFieldSize({ width: field.clientWidth, height: field.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(field);
    return () => observer.disconnect();
  }, []);
  const camera = useMemo(() => makeGameViewCamera(gameCamera, fieldSize.width / Math.max(1, fieldSize.height)),
    [gameCamera, fieldSize.width, fieldSize.height]);
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
    const ray = new Raycaster();
    ray.setFromCamera(new Vector2(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      1 - ((event.clientY - bounds.top) / bounds.height) * 2,
    ), camera);
    const worldHeight = (worldByEntity.get(entityId)?.position.z ?? 0) / 10;
    const hit = ray.ray.intersectPlane(new Plane(new Vector3(0, 1, 0), -worldHeight), new Vector3());
    if (!hit) return;
    onMoveEntity(entityId, {
      x: Math.max(0, Math.min(100, hit.x * 10 + 50)),
      y: Math.max(0, Math.min(100, hit.z * 10 + 50)),
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

  const modelRootIds = useMemo(() => new Set(
    entities.filter(entity => getModelRenderer(entity)?.enabled).map(entity => entity.id),
  ), [entities]);
  const orderedEntities = [...entities].sort((a, b) =>
    (worldByEntity.get(a.id)?.position.z ?? 0) - (worldByEntity.get(b.id)?.position.z ?? 0),
  );

  return (
    <div className="scene-2d-view">
      <div
        ref={fieldRef}
        className="scene-field"
        aria-label="Software scene overview; full 3D materials and lighting require WebGL 2"
        data-testid="scene-field"
      >
        {orderedEntities.map((entity) => {
          const world = worldByEntity.get(entity.id);
          if (!world) return null;
          const sprite = getSpriteRenderer(entity);
          const modelRenderer = getModelRenderer(entity);
          const primitive = getPrimitive(entity);
          const hasVisibleChild = entity.isGroup && entities.some(child =>
            child.parentId === entity.id && (getPrimitive(child)?.enabled || getModelRenderer(child)?.enabled || getSpriteRenderer(child)?.enabled),
          );
          const emptyGroup = Boolean(entity.isGroup && !hasVisibleChild && !modelRenderer);
          if (!sprite?.enabled && !modelRenderer?.enabled && !primitive?.enabled && !emptyGroup) return null;
          if (primitive?.shape === 'plane' || primitive?.shape === 'terrain') return null;
          let ancestorId = entity.parentId;
          while (ancestorId) {
            if (modelRootIds.has(ancestorId)) return null;
            ancestorId = entities.find(parent => parent.id === ancestorId)?.parentId ?? null;
          }
          if (getCamera(entity) || getLight(entity) || getUICanvas(entity)) return null;
          const isPlayer = entity.id === 'player' || entity.components.some(component => component.type === 'playerAction');
          const previewPosition = isPlayer ? position : world.position;
          const projected = new Vector3(
            (previewPosition.x - 50) / 10, world.position.z / 10, (previewPosition.y - 50) / 10,
          ).project(camera);
          if (projected.z < -1 || projected.z > 1) return null;
          const x = (projected.x + 1) * 50;
          const y = (1 - projected.y) * 50;
          const visibleHeight = 2 * Math.max(0.1, gameCamera.position.y - world.position.z / 10) *
            Math.tan(gameCamera.fov * Math.PI / 360);
          const pixelsPerUnit = fieldSize.height / visibleHeight;
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
          if (inheritedInactive) return null;
          const imageUrl = sprite?.assetId ? assetUrls[sprite.assetId] : undefined;
          const fallbackColor = (() => {
            const name = entity.name.toLowerCase();
            if (/enemy|ashen|ironwatch|outpost/.test(name)) return '#7897bb';
            if (/wood|timber|tree|forest/.test(name)) return '#6d9855';
            if (/coin|gold|beacon|rally/.test(name)) return '#d7b45b';
            if (/water|river|run/.test(name)) return '#4d9dad';
            if (/commander|guard|scout|alliance|barracks|keep/.test(name)) return '#bd6551';
            return primitive?.color ?? '#8e9c88';
          })();
          const markerLabel = entity.name.trim().slice(0, 1).toUpperCase() || '•';
          const markerRadius = primitive?.shape === 'sphere' || primitive?.shape === 'octahedron' ||
            primitive?.shape === 'icosahedron' ? '50%' : primitive?.shape === 'capsule' ? '35%' : '3px';
          return (
            <button
              key={entity.id}
              type="button"
              className={[
                isPlayer ? 'scene-player' : 'scene-object',
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
              data-z={world.position.z}
              data-entity-id={entity.id}
              data-sprite-asset-id={sprite?.assetId ?? ''}
              data-model-asset-id={getModelRenderer(entity)?.assetId ?? ''}
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
                width: `${(sprite?.width ?? (modelRenderer?.enabled ? 12 : 8)) / 10 * pixelsPerUnit}px`,
                height: `${(sprite?.height ?? (modelRenderer?.enabled ? 12 : 8)) / 10 * pixelsPerUnit}px`,
                transform: `translate(-50%, -50%) rotate(${world.rotation.z}deg) scale(${world.scale.x}, ${world.scale.y})`,
                backgroundColor: sprite?.enabled ? sprite.tint : fallbackColor,
                borderRadius: markerRadius,
                zIndex: Math.round(world.position.z + 200),
              }}
            >
              {sprite?.enabled && imageUrl
                ? <img src={imageUrl} alt="" draggable={false} />
                : <span className="scene-empty-object" aria-hidden="true">{markerLabel}</span>}
            </button>
          );
        })}
      </div>
      <span className="game-camera-fallback-note" data-testid="game-camera-fallback">
        Software overview · objects, units, and terrain markers. Full 3D materials and lighting require WebGL 2.
      </span>
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
