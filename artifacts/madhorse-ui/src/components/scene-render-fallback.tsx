import { getCamera, getPrimitive, getSpriteRenderer, getWorldTransform, type SceneEntity } from '@/lib/scene-model';
import type { GameCamera } from '@/lib/game-camera';
import type { SceneRenderSettings } from '@/hooks/use-scene-render-settings';

type Point = { x: number; y: number };
const screenPoint = (x: number, y: number, z: number): Point => ({
  x: 500 + (x - z) * 26,
  y: 312 + (x + z) * 14 - y * 34,
});

export function SceneRenderFallback({
  entities, camera, settings, zoom, selectedEntityId, onSelectEntity,
}: {
  entities: SceneEntity[];
  camera?: GameCamera;
  settings: SceneRenderSettings;
  zoom: number;
  selectedEntityId: string | null;
  onSelectEntity: (id: string) => void;
}) {
  const zoomScale = zoom / 100;
  const gridLines = Array.from({ length: 19 }, (_, index) => index - 9);
  const drawables = entities
    .filter((entity) => entity.active && (getPrimitive(entity) || getSpriteRenderer(entity)))
    .map((entity) => {
      const world = getWorldTransform(entities, entity.id);
      if (!world) return null;
      const point = screenPoint((world.position.x - 50) / 10, world.position.z / 10, (world.position.y - 50) / 10);
      return { entity, point, size: Math.max(12, 34 * zoomScale * Math.max(world.scale.x, world.scale.y, world.scale.z)) };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  const cameraPoint = camera
    ? screenPoint(camera.position.x, camera.position.y, camera.position.z)
    : screenPoint(0, 6, -8);

  return (
    <div className="mh-scene3d__soft-preview" data-testid="scene3d-soft-preview">
      <svg viewBox="0 0 1000 600" role="img" aria-label="Simplified scene preview. Full 3D rendering requires WebGL 2.">
        <rect width="1000" height="600" fill={settings.background} />
        {settings.showGrid && (
          <>
            <path d="M500 155 L60 565 M500 155 L940 565" stroke="#a4abb4" strokeWidth="1.5" opacity=".7" />
            {gridLines.map((line) => {
              const t = line / 9;
              return <path key={`grid-${line}`} d={`M500 155 L${500 + t * 440} 565`}
                stroke={line % 5 === 0 ? '#a4abb4' : '#727982'} strokeWidth={line % 5 === 0 ? 1.4 : 0.8} opacity={line % 5 === 0 ? 0.7 : 0.45} />;
            })}
            {Array.from({ length: 12 }, (_, index) => {
              const t = (index + 1) / 12;
              const y = 155 + t * 410;
              const halfWidth = t * 440;
              return <path key={`section-${index}`} d={`M${500 - halfWidth} ${y} L${500 + halfWidth} ${y}`}
                stroke={index % 5 === 4 ? '#a4abb4' : '#727982'} strokeWidth={index % 5 === 4 ? 1.4 : 0.8} opacity={index % 5 === 4 ? 0.7 : 0.45} />;
            })}
            <path d="M500 155 L500 565" stroke="#8ccc91" strokeWidth="2" opacity=".8" />
            <path d="M60 565 L940 565" stroke="#df6257" strokeWidth="2" opacity=".8" />
          </>
        )}
        <g opacity={settings.studioLighting ? 1 : 0.65} style={{ filter: `brightness(${settings.exposure})` }}>
          {drawables.filter(({ entity }) => getSpriteRenderer(entity)).map(({ entity, point, size }) => (
            <g key={`sprite-${entity.id}`} transform={`translate(${point.x} ${point.y})`}
              className={selectedEntityId === entity.id ? 'is-selected' : undefined}
              role="button" tabIndex={0} aria-label={`Select ${entity.name}`}
              onClick={() => onSelectEntity(entity.id)}
              onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onSelectEntity(entity.id); }}>
              <rect x={-size / 2} y={-size / 2} width={size} height={size} fill="#b73d34" fillOpacity=".55" stroke="#e77a6f" strokeDasharray="5 4" />
              <text y={size / 2 + 18} className="mh-scene3d__soft-label">{entity.name} · 2D</text>
            </g>
          ))}
          {drawables.filter(({ entity }) => getPrimitive(entity)).map(({ entity, point, size }) => {
            const primitive = getPrimitive(entity)!;
            const dx = size * (primitive.shape === 'plane' ? 5 : 0.55);
            const dy = size * (primitive.shape === 'plane' ? 2.4 : 0.31);
            const height = size * (primitive.shape === 'plane' ? 0.15 : 1.15);
            const color = primitive.color;
            return (
              <g key={entity.id} transform={`translate(${point.x} ${point.y})`} data-testid={`scene3d-soft-object-${entity.id}`}
                className={selectedEntityId === entity.id ? 'is-selected' : undefined}
                role="button" tabIndex={0} aria-label={`Select ${entity.name}`}
                onClick={() => onSelectEntity(entity.id)}
                onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onSelectEntity(entity.id); }}>
                <ellipse cy={height + 6} rx={dx * 0.9} ry={dy * 0.8} fill="#08090a" opacity=".45" />
                <polygon points={`0,${-height} ${dx},${-height + dy} 0,${-height + 2 * dy} ${-dx},${-height + dy}`}
                  fill={settings.studioLighting ? color : '#73777b'} stroke="#e0e4e7" strokeWidth="1.5" />
                {primitive.shape !== 'plane' && <>
                  <polygon points={`${-dx},${-height + dy} 0,${-height + 2 * dy} 0,${2 * dy} ${-dx},${dy}`}
                    fill={settings.studioLighting ? '#8d969e' : '#666a6e'} stroke="#bdc3c9" strokeWidth="1.3" />
                  <polygon points={`${dx},${-height + dy} 0,${-height + 2 * dy} 0,${2 * dy} ${dx},${dy}`}
                    fill={settings.studioLighting ? '#b0b8bf' : '#818589'} stroke="#d4d9dd" strokeWidth="1.3" />
                </>}
                <text y={height + dy * 2 + 20} className="mh-scene3d__soft-label">{entity.name}</text>
              </g>
            );
          })}
        </g>
        {camera && <g data-testid="scene3d-soft-camera" transform={`translate(${cameraPoint.x} ${cameraPoint.y})`}>
          <path d={`M0 0 L${500 - cameraPoint.x} ${312 - cameraPoint.y}`} stroke="#e2c28b" strokeDasharray="5 4" opacity=".85" />
          <rect x="-15" y="-10" width="24" height="20" rx="3" fill="#25211b" stroke="#e2c28b" strokeWidth="2" />
          <circle cx="-3" cy="0" r="5" fill="none" stroke="#e2c28b" strokeWidth="2" />
          <text y="25" className="mh-scene3d__soft-label">Main Camera</text>
        </g>}
      </svg>
      <span className="mh-scene3d__soft-note">SOFTWARE SCENE PREVIEW · EDITOR REFERENCE</span>
    </div>
  );
}
