import { useMemo, useRef } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import type { GamePosition } from '@/lib/game-api';
import {
  getSpriteRenderer,
  getWorldTransform,
  type SceneEntity,
} from '@/lib/scene-model';

type GameSceneProps = {
  entities: SceneEntity[];
  assetUrls: Record<string, string>;
  selectedEntityId: string | null;
  position: GamePosition;
  readOnly: boolean;
  onSelectEntity: (entityId: string) => void;
  onMoveEntity: (entityId: string, position: GamePosition) => void;
};

export function GameScene({
  entities,
  assetUrls,
  selectedEntityId,
  position,
  readOnly,
  onSelectEntity,
  onMoveEntity,
}: GameSceneProps) {
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
    <div className="game-scene">
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
      <span className="scene-position">
        {entities.find((entity) => entity.id === selectedEntityId)?.name ?? 'No selection'}
        {selectedEntityId === 'player' ? ` · x ${position.x} · y ${position.y}` : ''}
      </span>
    </div>
  );
}
