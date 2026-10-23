import {
  getCamera, getLight, getModelRenderer, getPrimitive, getSpriteRenderer, getUICanvas,
  type SceneEntity,
} from '@/lib/scene-model';
import './scene-object-glyph.css';

export function getSceneObjectTypeLabel(entity: SceneEntity) {
  if (getCamera(entity)) return 'Camera';
  if (getLight(entity)) return 'Light';
  if (getUICanvas(entity)) return 'UI Canvas';
  const primitive = getPrimitive(entity);
  if (primitive?.shape === 'cube') return '3D Cube';
  if (primitive?.shape === 'plane') return '3D Plane';
  if (primitive?.shape === 'terrain') return 'Terrain';
  if (getModelRenderer(entity)?.enabled) return '3D Model';
  if (getSpriteRenderer(entity)?.enabled) return 'Sprite';
  return 'Object';
}

export function SceneObjectGlyph({ entity }: { entity: SceneEntity }) {
  const primitive = getPrimitive(entity);
  const kind = getCamera(entity) ? 'camera'
    : getLight(entity) ? 'light'
      : getUICanvas(entity) ? 'canvas'
        : primitive?.shape ?? (getModelRenderer(entity)?.enabled ? 'model' : getSpriteRenderer(entity)?.enabled ? 'sprite' : 'object');

  return (
    <svg className={`scene-object-icon is-${kind}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {kind === 'camera' ? (
        <>
          <path d="M3 7.5h12.5v10H3zM15.5 10l5.5-3v11l-5.5-3z" />
          <circle cx="9.2" cy="12.5" r="2.4" />
          <path d="M6 5.5h5l1.4 2H4.7z" />
        </>
      ) : kind === 'cube' || kind === 'model' ? (
        <path d="m12 2.7 8.3 4.6v9.4L12 21.3l-8.3-4.6V7.3L12 2.7Z M3.7 7.3 12 12l8.3-4.7M12 12v9.3M12 12V2.7" />
      ) : kind === 'plane' || kind === 'terrain' ? (
        <>
          <path d="m2.5 8 9.5-5 9.5 5-9.5 5-9.5-5Z M4.5 9.2v6l7.5 4 7.5-4v-6" />
          <path d="m7 10.4 9.5-5M8.5 11.4v6M15.5 10.4v6" />
        </>
      ) : kind === 'light' ? (
        <>
          <circle cx="12" cy="10.5" r="4.1" />
          <path d="M9.7 14.1v3.2h4.6v-3.2M10.2 19h3.6M12 1.8v1.8M3.6 4.5 5 5.8M2 11h1.8m14.2-5.2 1.4-1.3M20.2 11H22" />
        </>
      ) : kind === 'canvas' ? (
        <>
          <rect x="3" y="4" width="18" height="16" rx="1.2" />
          <path d="M3 8h18M7 6h.1M9 6h.1" />
        </>
      ) : (
        <path d="M4 4h16v16H4zM8 4v16M4 8h16" />
      )}
    </svg>
  );
}
