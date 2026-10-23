import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, TransformControls } from '@react-three/drei';
import * as THREE from 'three';
import { ColladaLoader } from 'three/examples/jsm/loaders/ColladaLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { TextureLoader } from 'three';
import { SceneWebGLBoundary } from './scene-webgl-boundary';
import { beginSystemActivity } from '@/lib/system-activity';
import { hasRenderableModelGeometry } from '@/lib/scene-model-validation';
import { GameCameraRig } from './game-camera-rig';
import { SceneEditorEnvironment } from './scene-editor-environment';
import { PRIMARY_CAMERA_ID, cameraDisplayEntity, cameraFromEditorTransform, cameraWithOrbitPose, cameraWithPose, primaryCameraEntity } from '@/lib/camera-editor';
import { createGameCamera, type GameCamera } from '@/lib/game-camera';
import { SceneElementVisual } from './scene-element-visuals';
import { SceneNavigation } from './scene-navigation';
import { sceneEntityFocus, type SceneFocus } from '@/lib/scene-view-geometry';
import {
  getModelRenderer,
  getPrimitive, getCamera, getLight, getUICanvas,
  getSpriteRenderer,
  getTransform,
  type ProjectAsset,
  type SceneEntity,
  type TransformComponent,
} from '@/lib/scene-model';
import './scene-preview-3d.css';

export type SceneTransformMode = 'translate' | 'rotate' | 'scale';
type CanvasOrbitMode = 'free' | 'y' | 'x';
const MIN_SCENE_ZOOM = 25;
const MAX_SCENE_ZOOM = 400;
export type ScenePreview3DProps = {
  primaryCamera?: GameCamera;
  gameView?: boolean;
  gameCamera?: GameCamera;
  graphicsFallback?: ReactNode;
  onGraphicsUnavailable?: () => void;
  onGraphicsReady?: () => void;
  entities: SceneEntity[];
  assets: ProjectAsset[];
  assetUrls: Record<string, string>;
  selectedEntityId: string | null;
  playerPreviewPosition: { x: number; y: number };
  transformMode: SceneTransformMode;
  readOnly: boolean;
  onSelectEntity: (entityId: string) => void;
  onTransformCommit: (entityId: string, changes: Partial<Pick<TransformComponent, 'position' | 'rotation' | 'scale'>>) => void;
  onTransformModeChange: (mode: SceneTransformMode) => void;
  /** Commit a new primary game camera pose. Omit to keep the primary camera read-only. */
  onPrimaryCameraChange?: (camera: GameCamera) => void;
  /** Commit move/rotate of an additional camera entity. Falls back to onTransformCommit. */
  onCameraEntityTransform?: ScenePreview3DProps['onTransformCommit'];
  /** Select the virtual primary camera (selectedEntityId becomes PRIMARY_CAMERA_ID). */
  onSelectPrimaryCamera?: () => void;
};

type ErrorEntry = { id: string; message: string };

function vectorToThree(entity: SceneEntity, value: TransformComponent['position']): THREE.Vector3 {
  if (entity.parentId) return new THREE.Vector3((value.x - 50) / 10, (value.z - 50) / 10, (value.y - 50) / 10);
  return new THREE.Vector3((value.x - 50) / 10, value.z / 10, (value.y - 50) / 10);
}

function rotationToThree(value: TransformComponent['rotation']): THREE.Euler {
  // The editor's XY plane is reflected onto Three's XZ ground plane.
  return new THREE.Euler(
    THREE.MathUtils.degToRad(-value.x),
    THREE.MathUtils.degToRad(-value.z),
    THREE.MathUtils.degToRad(-value.y),
    'XYZ',
  );
}

function transformToProject(
  entity: SceneEntity,
  position: THREE.Vector3,
  rotation: THREE.Euler,
  scale: THREE.Vector3,
): Pick<TransformComponent, 'position' | 'rotation' | 'scale'> {
  const localPosition = entity.parentId
    ? { x: 50 + position.x * 10, y: 50 + position.z * 10, z: 50 + position.y * 10 }
    : { x: 50 + position.x * 10, y: 50 + position.z * 10, z: position.y * 10 };
  return {
    position: localPosition,
    rotation: {
      x: -THREE.MathUtils.radToDeg(rotation.x),
      y: -THREE.MathUtils.radToDeg(rotation.z),
      z: -THREE.MathUtils.radToDeg(rotation.y),
    },
    scale: { x: scale.x, y: scale.z, z: scale.y },
  };
}

function isEffectivelyActive(entity: SceneEntity, byId: Map<string, SceneEntity>): boolean {
  let current: SceneEntity | undefined = entity;
  const visited = new Set<string>();
  while (current) {
    if (!current.active || visited.has(current.id)) return false;
    visited.add(current.id);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return true;
}

export function ScenePreview3D({
  primaryCamera,
  gameView = false,
  gameCamera,
  graphicsFallback,
  onGraphicsUnavailable,
  onGraphicsReady,
  entities,
  assets,
  assetUrls,
  selectedEntityId,
  playerPreviewPosition,
  transformMode,
  readOnly,
  onSelectEntity,
  onTransformCommit,
  onTransformModeChange,
  onPrimaryCameraChange,
  onCameraEntityTransform,
  onSelectPrimaryCamera,
}: ScenePreview3DProps) {
  const [errors, setErrors] = useState<ErrorEntry[]>([]);
  const [modelStatuses, setModelStatuses] = useState<Record<string, string>>({});
  const [mobile, setMobile] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const cameraMarkerRef = useRef<HTMLButtonElement>(null);
  const [zoom, setZoom] = useState(100);
  const [frameToken, setFrameToken] = useState(0);
  const [sceneFocus, setSceneFocus] = useState<SceneFocus | null>(null);
  const [graphicsAvailable, setGraphicsAvailable] = useState(false);
  const [gameViewRotated, setGameViewRotated] = useState(false);
  const [cameraOrbitMode, setCameraOrbitMode] = useState<CanvasOrbitMode>('free');
  const editorCamera = primaryCamera ?? gameCamera;
  const canOrbitGameCamera = Boolean(gameView && gameCamera && primaryCamera === gameCamera &&
    onPrimaryCameraChange && !readOnly);
  const frameCamera = () => { setSceneFocus(null); setZoom(100); setFrameToken((value) => value + 1); };
  const frameBuild = () => {
    if (selectedEntityId) setSceneFocus(sceneEntityFocus(entities, selectedEntityId));
    setZoom(100); setFrameToken((value) => value + 1);
  };
  useEffect(() => {
    if (!gameView && entities.some((entity) => entity.id === selectedEntityId && entity.generatedBy === 'mad-builder')) frameBuild();
  }, [selectedEntityId, gameView]);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 700px), (pointer: coarse)');
    const update = () => setMobile(media.matches);
    update();
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);

  const reportError = useCallback((id: string, message: string) => {
    setErrors((current) => current.some((entry) => entry.id === id && entry.message === message)
      ? current
      : [...current.filter((entry) => entry.id !== id), { id, message }]);
  }, []);
  const clearError = useCallback((id: string) => {
    setErrors((current) => current.filter((entry) => entry.id !== id));
  }, []);
  const markGraphicsReady = useCallback(() => {
    setGraphicsAvailable(true);
    onGraphicsReady?.();
  }, [onGraphicsReady]);
  const markGraphicsUnavailable = useCallback(() => {
    setGraphicsAvailable(false);
    onGraphicsUnavailable?.();
  }, [onGraphicsUnavailable]);
  const resetGameCamera = useCallback(() => {
    if (!canOrbitGameCamera) return;
    setGameViewRotated(false);
    setCameraOrbitMode('free');
    onPrimaryCameraChange?.(createGameCamera(entities));
  }, [canOrbitGameCamera, entities, onPrimaryCameraChange]);
  const noteGameViewOrbit = useCallback(() => setGameViewRotated(true), []);
  const reportModelStatus = useCallback((id: string, message: string) => {
    setModelStatuses((current) => {
      if (current[id] === message) return current;
      const next = { ...current };
      if (message) next[id] = message;
      else delete next[id];
      return next;
    });
  }, []);

  const byId = useMemo(() => new Map(entities.map((entity) => [entity.id, entity])), [entities]);
  const childrenByParent = useMemo(() => {
    const result = new Map<string | null, SceneEntity[]>();
    entities.forEach((entity) => result.set(entity.parentId, [...(result.get(entity.parentId) ?? []), entity]));
    return result;
  }, [entities]);
  const primaryEntity = useMemo(() => (!gameView && editorCamera ? primaryCameraEntity(editorCamera) : null), [gameView, editorCamera]);
  const primarySelected = Boolean(primaryEntity && selectedEntityId === PRIMARY_CAMERA_ID);
  const effectiveSelectedId = primarySelected ? PRIMARY_CAMERA_ID : selectedEntityId;
  const selected = primarySelected ? primaryEntity ?? undefined : selectedEntityId ? byId.get(selectedEntityId) : undefined;
  const selectedIsCamera = Boolean(selected && getCamera(selected));
  const effectiveMode: SceneTransformMode = selectedIsCamera && transformMode === 'scale' ? 'translate' : transformMode;
  const renderEntities = useMemo(() => primaryEntity ? [...entities, primaryEntity] : entities, [entities, primaryEntity]);
  const renderChildren = useMemo(() => {
    if (!primaryEntity) return childrenByParent;
    const next = new Map(childrenByParent);
    next.set(null, [...(childrenByParent.get(null) ?? []), primaryEntity]);
    return next;
  }, [childrenByParent, primaryEntity]);
  const selectEntity = useCallback((id: string) => {
    if (id === PRIMARY_CAMERA_ID) { onSelectPrimaryCamera?.(); return; }
    onSelectEntity(id);
  }, [onSelectEntity, onSelectPrimaryCamera]);
  const commitTransform = useCallback<ScenePreview3DProps['onTransformCommit']>((id, changes) => {
    if (id === PRIMARY_CAMERA_ID) {
      if (!editorCamera || !onPrimaryCameraChange) return;
      const next = cameraFromEditorTransform(editorCamera, { position: changes.position, rotation: changes.rotation });
      if (next) onPrimaryCameraChange(next);
      return;
    }
    const entity = byId.get(id);
    if (entity && getCamera(entity)) {
      (onCameraEntityTransform ?? onTransformCommit)(id, { position: changes.position, rotation: changes.rotation });
      return;
    }
    onTransformCommit(id, changes);
  }, [editorCamera, onPrimaryCameraChange, byId, onCameraEntityTransform, onTransformCommit]);
  const modeButtons: { mode: SceneTransformMode; label: string; shortcut: string; icon: string }[] = [
    { mode: 'translate', label: 'Move', shortcut: 'W', icon: '↔' },
    { mode: 'rotate', label: 'Rotate', shortcut: 'E', icon: '⟳' },
    { mode: 'scale', label: 'Scale', shortcut: 'R', icon: '↗' },
  ];

  const handleViewportKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (readOnly || event.altKey || event.ctrlKey || event.metaKey) return;
    const key = event.key.toLowerCase();
    if (key === 'w' || key === 'e' || key === 'r') {
      event.preventDefault();
      if (key === 'r' && selectedIsCamera) return;
      onTransformModeChange(key === 'w' ? 'translate' : key === 'e' ? 'rotate' : 'scale');
    }
  };

  return (
    <section className={`mh-scene3d ${gameView ? 'is-game-view' : ''}`} data-testid={gameView ? 'scene-game-view' : 'scene-preview-3d'} aria-label={gameView ? 'Game camera view' : '3D scene preview'}
      data-camera-target={gameView && gameCamera ? JSON.stringify(gameCamera.target) : undefined}
      data-camera-position={gameView && gameCamera ? JSON.stringify(gameCamera.position) : undefined}
      data-camera-fov={gameView ? gameCamera?.fov : undefined}
      data-render-mode={gameView ? 'automatic' : 'on-demand'}
      data-lighting-mode={gameView ? 'automatic' : undefined}
      data-view-rotated={gameView ? String(gameViewRotated) : undefined}
      data-orbit-mode={gameView ? cameraOrbitMode : undefined}
      data-scene-entity-count={entities.length} data-scene-zoom={gameView ? undefined : zoom}>
      {!gameView && <header className="mh-scene3d__toolbar">
        <div className="mh-scene3d__heading">
          <span className="mh-scene3d__eyebrow">VIEWPORT / 01</span>
          <strong>Scene view</strong>
          <span className="mh-scene3d__selection" data-testid="scene3d-selection">
            {selected?.name ?? 'No selection'}
          </span>
        </div>
        <div className="mh-scene3d__tools" role="group" aria-label="Transform mode">
          {modeButtons.map(({ mode, label, shortcut, icon }) => (
            <button
              key={mode}
              type="button"
              className={`mh-scene3d__tool ${effectiveMode === mode ? 'is-active' : ''}`}
              aria-pressed={effectiveMode === mode}
              aria-label={`${label} tool (${shortcut})`}
              title={`${label} · ${shortcut}`}
              data-testid={`scene3d-mode-${mode}`}
              disabled={readOnly || (mode === 'scale' && selectedIsCamera)}
              onClick={() => onTransformModeChange(mode)}
            >
              <span aria-hidden="true">{icon}</span><small>{label}</small>
            </button>
          ))}
        </div>
        <div className="mh-scene3d__view-label"><i aria-hidden="true" /> {readOnly ? 'RUNTIME PREVIEW' : 'PERSPECTIVE'}</div>
      </header>}
      {!gameView && <div className="mh-scene3d__navigation" role="group" aria-label="Scene view navigation">
        <button type="button" onClick={() => setZoom((value) => Math.max(MIN_SCENE_ZOOM, value - 25))} disabled={zoom <= MIN_SCENE_ZOOM} data-testid="scene-zoom-out" aria-label="Zoom scene out">−</button>
        <label>Zoom <input type="range" min={MIN_SCENE_ZOOM} max={MAX_SCENE_ZOOM} step={5} value={zoom} onChange={(event) => setZoom(Number(event.target.value))} aria-label="Scene zoom" data-testid="scene-zoom" /></label>
        <output data-testid="scene-zoom-value">{zoom}%</output>
        <button type="button" onClick={() => setZoom((value) => Math.min(MAX_SCENE_ZOOM, value + 25))} disabled={zoom >= MAX_SCENE_ZOOM} data-testid="scene-zoom-in" aria-label="Zoom scene in">+</button>
        <button type="button" onClick={frameCamera} data-testid="scene-frame-camera">Frame square + camera</button>
        {editorCamera && onSelectPrimaryCamera && <button type="button" data-testid="scene3d-select-game-camera" aria-pressed={primarySelected}
          onClick={onSelectPrimaryCamera}>{primarySelected ? 'Camera selected' : 'Select Game Camera'}</button>}
        {selected?.generatedBy === 'mad-builder' && <button type="button" onClick={frameBuild} data-testid="scene-frame-build">Frame build</button>}
        <span title="World north is negative Z">N = −Z</span>
      </div>}
      <div
        ref={rootRef}
        className="mh-scene3d__viewport"
        data-testid="scene3d-viewport"
        tabIndex={0}
        role="application"
        aria-label={gameView ? 'Canvas: live Game Camera view. Drag to orbit around its target; choose free, Y-axis, or X-axis rotation.' : '3D scene viewport. Scroll to zoom, middle-drag to pan, and drag to orbit. Select objects, use W to move, E to rotate, R to scale.'}
        onKeyDown={gameView ? undefined : handleViewportKeyDown}
        onWheel={gameView ? undefined : (event) => {
          if (event.deltaY === 0) return;
          event.preventDefault();
          setZoom((value) => Math.min(
            MAX_SCENE_ZOOM,
            Math.max(MIN_SCENE_ZOOM, Math.round((value * Math.exp(-event.deltaY * 0.0015)) / 5) * 5),
          ));
        }}
      >
        {gameView && graphicsAvailable && canOrbitGameCamera && (
          <div className="mh-scene3d__game-controls" role="group" aria-label="Canvas view controls">
            <span className="mh-scene3d__orbit-hint">ORBIT</span>
            <div className="mh-scene3d__orbit-modes" role="group" aria-label="Camera orbit axis">
              <button type="button" className={cameraOrbitMode === 'free' ? 'is-active' : ''}
                aria-label="Free 360 degree orbit" aria-pressed={cameraOrbitMode === 'free'}
                title="Free 360° orbit" data-testid="canvas-orbit-free" onClick={() => setCameraOrbitMode('free')}>
                <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M16.8 7.7A7 7 0 1 0 17 11.5" /><path d="M14 3.8h3.6v3.6" /></svg>
              </button>
              <button type="button" className={cameraOrbitMode === 'y' ? 'is-active' : ''}
                aria-label="Orbit around Y axis" aria-pressed={cameraOrbitMode === 'y'}
                title="Orbit around Y axis" data-testid="canvas-orbit-y" onClick={() => setCameraOrbitMode('y')}>
                <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2.5v15M5 7.5c0-2.8 10-2.8 10 0s-10 2.8-10 0ZM5 12.5c0-2.8 10-2.8 10 0s-10 2.8-10 0Z" /></svg>
              </button>
              <button type="button" className={cameraOrbitMode === 'x' ? 'is-active' : ''}
                aria-label="Orbit around X axis" aria-pressed={cameraOrbitMode === 'x'}
                title="Orbit around X axis" data-testid="canvas-orbit-x" onClick={() => setCameraOrbitMode('x')}>
                <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M2 10h16M7.5 5c2.8 0 2.8 10 0 10s-2.8-10 0-10ZM12.5 5c2.8 0 2.8 10 0 10s-2.8-10 0-10Z" /></svg>
              </button>
            </div>
            <button type="button" className="mh-scene3d__reset-camera" onClick={resetGameCamera} data-testid="canvas-reset-camera"
              aria-label="Reset Game Camera to north">Reset north</button>
          </div>
        )}
        <SceneWebGLBoundary fallback={graphicsFallback} onUnavailable={markGraphicsUnavailable}>
        <Canvas
          camera={{ position: [10, 8, 12], fov: 48, near: 0.1, far: 3000 }}
          dpr={mobile ? 1 : [1, 1.5]}
          frameloop={gameView ? 'always' : 'demand'}
          gl={{ antialias: !mobile, powerPreference: 'low-power', alpha: false }}
          onCreated={({ gl, scene }) => {
            const background = gameView ? '#333538' : '#1d1f22';
            gl.setClearColor(background);
            scene.background = new THREE.Color(background);
            markGraphicsReady();
          }}
        >
        <SceneWorld
            primaryCamera={editorCamera}
            sceneZoom={zoom}
            frameToken={frameToken}
            sceneFocus={sceneFocus}
            cameraMarkerRef={cameraMarkerRef}
            gameView={gameView}
            gameCamera={gameCamera}
            cameraOrbitMode={cameraOrbitMode}
            onGameCameraChange={canOrbitGameCamera ? onPrimaryCameraChange : undefined}
            onGameViewOrbit={noteGameViewOrbit}
            entities={renderEntities}
            realEntities={entities}
            primaryEntityId={primaryEntity ? PRIMARY_CAMERA_ID : null}
          assets={assets}
            childrenByParent={renderChildren}
            byId={byId}
            assetUrls={assetUrls}
            selectedEntityId={effectiveSelectedId}
            playerPreviewPosition={playerPreviewPosition}
            transformMode={effectiveMode}
            readOnly={readOnly || (primarySelected && !onPrimaryCameraChange)}
            onSelectEntity={selectEntity}
            onTransformCommit={commitTransform}
            onModelError={reportError}
            onModelStatus={reportModelStatus}
            clearError={clearError}
            mobile={mobile}
          />
        </Canvas>
        </SceneWebGLBoundary>
        {!gameView && editorCamera && <button ref={cameraMarkerRef} type="button" className="mh-scene3d__camera-marker"
          onClick={() => { if (onSelectPrimaryCamera) onSelectPrimaryCamera(); else frameCamera(); }} data-testid="scene-camera-marker" aria-label="Select the game camera" data-selected={primarySelected}
          title="Game Camera. Click to select it, then move (W) or rotate (E). This marker stays visible when the camera is off screen.">
          <svg viewBox="0 0 20 14" aria-hidden="true"><path d="M1 2h11v10H1zM12 5l6-3v10l-6-3z" fill="none" stroke="currentColor" /></svg>
          Game Camera{primarySelected ? ' · Selected' : ''}
        </button>}
        {entities.length === 0 && (
          <div className="mh-scene3d__empty" data-testid="scene3d-empty-state">
            <span className="mh-scene3d__empty-mark" aria-hidden="true" />
            <strong>Scene is clear</strong>
            <span>Add an object to begin building in 3D.</span>
          </div>
        )}
        {!gameView && <div className="mh-scene3d__axis-key" aria-label="Axis colors">
          <span><i className="axis-x" /> X</span><span><i className="axis-y" /> Y</span><span><i className="axis-z" /> Z</span>
        </div>}
        {(errors.length > 0 || Object.keys(modelStatuses).length > 0) && (
          <div className="mh-scene3d__notices" role="status" aria-live="polite" data-testid="scene3d-asset-status">
            {errors.map((entry) => <div key={entry.id} className="mh-scene3d__notice is-error">{entry.message}</div>)}
            {Object.entries(modelStatuses).map(([id, message]) => (
              <div key={id} className="mh-scene3d__notice">{message}</div>
            ))}
          </div>
        )}
        {readOnly && !gameView && (
          <div className="mh-scene3d__runtime-note" data-testid="scene3d-runtime-note">
            PLAY MODE <span>Player preview position · {playerPreviewPosition.x.toFixed(1)}, {playerPreviewPosition.y.toFixed(1)} · project unchanged</span>
          </div>
        )}
      </div>
      {!gameView && <footer className="mh-scene3d__footer">
        <span data-testid="scene3d-entity-count"><b>{String(entities.length).padStart(2, '0')}</b> OBJECTS</span>
        <span className="mh-scene3d__footer-center">
          {selected ? `SELECTED · ${selected.name}` : 'SELECT AN OBJECT'}
          {selected && ` · ${getModelRenderer(selected)?.assetId ? 'MODEL' : getSpriteRenderer(selected)?.enabled ? 'SPRITE' : 'OBJECT'}`}
        </span>
        <span className="mh-scene3d__hint">{mobile ? 'DRAG ORBIT · PINCH ZOOM' : 'DRAG ORBIT · RIGHT-DRAG PAN · SCROLL ZOOM'}</span>
      </footer>}
    </section>
  );
}

type SceneWorldProps = {
  primaryCamera?: GameCamera;
  sceneZoom: number;
  frameToken: number;
  sceneFocus: SceneFocus | null;
  cameraMarkerRef: React.RefObject<HTMLButtonElement | null>;
  gameView?: boolean;
  gameCamera?: GameCamera;
  cameraOrbitMode: CanvasOrbitMode;
  onGameCameraChange?: (camera: GameCamera) => void;
  onGameViewOrbit: () => void;
  entities: SceneEntity[];
  realEntities: SceneEntity[];
  primaryEntityId: string | null;
  assets: ProjectAsset[];
  childrenByParent: Map<string | null, SceneEntity[]>;
  byId: Map<string, SceneEntity>;
  assetUrls: Record<string, string>;
  selectedEntityId: string | null;
  playerPreviewPosition: { x: number; y: number };
  transformMode: SceneTransformMode;
  readOnly: boolean;
  onSelectEntity: (id: string) => void;
  onTransformCommit: ScenePreview3DProps['onTransformCommit'];
  onModelError: (id: string, message: string) => void;
  onModelStatus: (id: string, message: string) => void;
  clearError: (id: string) => void;
  mobile: boolean;
};

function SceneWorld(props: SceneWorldProps) {
  const orbitRef = useRef<any>(null);
  const gameOrbitStart = useRef<{ position: THREE.Vector3; quaternion: THREE.Quaternion } | null>(null);
  const gameOrbitDragging = useRef(false);
  const gameOrbitCommitTimer = useRef<number | null>(null);
  const [selectedObject, setSelectedObject] = useState<THREE.Group | null>(null);
  const { camera, invalidate } = useThree();
  const selected = props.selectedEntityId
    ? props.entities.find((entity) => entity.id === props.selectedEntityId)
    : undefined;
  const cameraOrbitDistance = props.gameCamera
    ? Math.max(.1, Math.hypot(
      props.gameCamera.position.x - props.gameCamera.target.x,
      props.gameCamera.position.y - props.gameCamera.target.y,
      props.gameCamera.position.z - props.gameCamera.target.z,
    ))
    : 10;
  const commitGameOrbit = useCallback(() => {
    gameOrbitCommitTimer.current = null;
    const start = gameOrbitStart.current;
    gameOrbitStart.current = null;
    if (!start || !props.gameCamera || !props.onGameCameraChange) return;
    const moved = camera.position.distanceToSquared(start.position) > 1e-8 ||
      1 - Math.abs(camera.quaternion.dot(start.quaternion)) > 1e-8;
    if (!moved) return;
    const rotation = new THREE.Euler().setFromQuaternion(camera.quaternion, 'XYZ');
    const updated = cameraWithOrbitPose(props.gameCamera, {
      position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
      rotation: {
        x: THREE.MathUtils.radToDeg(rotation.x),
        y: THREE.MathUtils.radToDeg(rotation.y),
        z: THREE.MathUtils.radToDeg(rotation.z),
      },
    });
    if (updated) {
      props.onGameCameraChange(updated);
      props.onGameViewOrbit();
    }
  }, [camera, props.gameCamera, props.onGameCameraChange, props.onGameViewOrbit]);
  const scheduleGameOrbitCommit = useCallback(() => {
    if (!gameOrbitStart.current || gameOrbitDragging.current) return;
    if (gameOrbitCommitTimer.current !== null) window.clearTimeout(gameOrbitCommitTimer.current);
    gameOrbitCommitTimer.current = window.setTimeout(commitGameOrbit, 180);
  }, [commitGameOrbit]);
  const handleGameOrbitStart = useCallback(() => {
    if (!props.onGameCameraChange) return;
    if (gameOrbitCommitTimer.current !== null) window.clearTimeout(gameOrbitCommitTimer.current);
    gameOrbitCommitTimer.current = null;
    gameOrbitDragging.current = true;
    gameOrbitStart.current = { position: camera.position.clone(), quaternion: camera.quaternion.clone() };
  }, [camera, props.onGameCameraChange]);
  const handleGameOrbitChange = useCallback(() => {
    scheduleGameOrbitCommit();
  }, [scheduleGameOrbitCommit]);
  const handleGameOrbitEnd = useCallback(() => {
    gameOrbitDragging.current = false;
    scheduleGameOrbitCommit();
  }, [scheduleGameOrbitCommit]);
  useEffect(() => () => {
    if (gameOrbitCommitTimer.current !== null) window.clearTimeout(gameOrbitCommitTimer.current);
  }, []);
  useEffect(() => {
    const controls = orbitRef.current;
    if (!props.gameView || !controls) return;
    const azimuth = controls.getAzimuthalAngle();
    const polar = controls.getPolarAngle();
    controls.minAzimuthAngle = props.cameraOrbitMode === 'x' ? azimuth : -Infinity;
    controls.maxAzimuthAngle = props.cameraOrbitMode === 'x' ? azimuth : Infinity;
    controls.minPolarAngle = props.cameraOrbitMode === 'y' ? polar : 0.01;
    controls.maxPolarAngle = props.cameraOrbitMode === 'y' ? polar : Math.PI - 0.01;
    controls.update();
  }, [props.cameraOrbitMode, props.gameView]);
  return (
    <>
      {props.gameView
        ? <AutomaticGameLighting target={props.gameCamera?.target ?? { x: 0, y: 0, z: 0 }} />
        : <SceneEditorEnvironment mobile={props.mobile} />}
      {props.gameView && props.gameCamera && <GameCameraRig settings={props.gameCamera} />}
      {props.gameView && props.gameCamera && <OrbitControls
        ref={orbitRef}
        makeDefault
        target={[props.gameCamera.target.x, props.gameCamera.target.y, props.gameCamera.target.z]}
        enableRotate={Boolean(props.onGameCameraChange)}
        enableDamping
        dampingFactor={0.07}
        enableZoom={false}
        enablePan={false}
        minDistance={cameraOrbitDistance}
        maxDistance={cameraOrbitDistance}
        minPolarAngle={0.01}
        maxPolarAngle={Math.PI - 0.01}
        touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.ROTATE }}
        onStart={handleGameOrbitStart}
        onChange={handleGameOrbitChange}
        onEnd={handleGameOrbitEnd}
      />}
      {!props.gameView && <OrbitControls
        ref={orbitRef}
        makeDefault
        enableDamping
        dampingFactor={props.mobile ? 0.12 : 0.08}
        enableZoom={false}
        minDistance={1}
        maxDistance={2000}
        maxPolarAngle={Math.PI * 0.495}
        enablePan
        screenSpacePanning
        mouseButtons={{ LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.PAN }}
        touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }}
      />}
      {!props.gameView && props.primaryCamera && <SceneNavigation settings={props.primaryCamera}
        zoom={props.sceneZoom} frameToken={props.frameToken} focus={props.sceneFocus} controls={orbitRef} marker={props.cameraMarkerRef} />}
      <Suspense fallback={null}>
        {(props.childrenByParent.get(null) ?? []).map((entity) => (
          <EntityNode key={entity.id} {...props} entity={entity} onSelectedObject={setSelectedObject} />
        ))}
      </Suspense>
      {!props.gameView && !props.readOnly && selected && selectedObject && (
        <SelectedGizmo
          key={selected.id}
          entity={selected}
          object={selectedObject}
          mode={props.transformMode}
          camera={Boolean(getCamera(selected))}
          mobile={props.mobile}
          onCommit={props.onTransformCommit}
          onDragging={(dragging) => {
            if (orbitRef.current) orbitRef.current.enabled = !dragging;
            invalidate();
          }}
        />
      )}
    </>
  );
}

function AutomaticGameLighting({ target }: { target: GameCamera['target'] }) {
  const lightTarget = useMemo(() => {
    const object = new THREE.Object3D();
    object.position.set(target.x, target.y, target.z);
    return object;
  }, [target.x, target.y, target.z]);

  return <>
    <primitive object={lightTarget} />
    <ambientLight intensity={1.15} />
    <directionalLight target={lightTarget} position={[target.x + 7, target.y + 12, target.z + 6]} intensity={2.2} />
    <directionalLight target={lightTarget} position={[target.x - 7, target.y + 5, target.z - 8]} intensity={0.75} color="#b3c0cf" />
  </>;
}

function EntityNode(props: SceneWorldProps & { entity: SceneEntity; onSelectedObject: (object: THREE.Group | null) => void }) {
  const rawEntity = props.entity;
  const isPrimary = rawEntity.id === props.primaryEntityId;
  const entity = !isPrimary && getCamera(rawEntity) ? cameraDisplayEntity(props.realEntities, rawEntity) : rawEntity;
  const transform = getTransform(entity);
  const position = vectorToThree(entity, transform.position);
  if (entity.id === 'player' && !entity.parentId) {
    position.x = (props.playerPreviewPosition.x - 50) / 10;
    position.z = (props.playerPreviewPosition.y - 50) / 10;
  }
  const sprite = getSpriteRenderer(entity);
  const model = getModelRenderer(entity);
  const effective = isEffectivelyActive(entity, props.byId);
  const selectedEntity = !props.gameView && props.selectedEntityId === entity.id;
  const modelAsset = model?.assetId ? props.assets.find((asset) => asset.id === model.assetId) : undefined;
  const modelUrl = model?.assetId ? props.assetUrls[model.assetId] : undefined;
  const spriteUrl = sprite?.assetId ? props.assetUrls[sprite.assetId] : undefined;
  const setGroupRef = useCallback((node: THREE.Group | null) => {
    if (selectedEntity) props.onSelectedObject(node);
  }, [selectedEntity, props.onSelectedObject]);
  if (props.gameView && !effective) return null;
  return (
    <group
      ref={setGroupRef}
      position={position}
      rotation={rotationToThree(transform.rotation)}
      scale={[transform.scale.x, transform.scale.z, transform.scale.y]}
      name={entity.name}
      userData={{ entityId: entity.id }}
      onClick={(event) => {
        event.stopPropagation();
        if (!props.gameView) props.onSelectEntity(entity.id);
      }}
      onPointerOver={(event) => {
        event.stopPropagation();
        if (!props.gameView && !props.readOnly) document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => { document.body.style.cursor = ''; }}
    >
      {selectedEntity && !getCamera(entity) && <SelectionOutline active={effective} />}
      {entity.isGroup ? null : !model?.enabled && (getPrimitive(entity) || getLight(entity) || getCamera(entity) || getUICanvas(entity)) ? (
        <SceneElementVisual entity={entity} gameView={Boolean(props.gameView)} active={effective}
          selected={selectedEntity} primary={isPrimary}
          assetUrls={props.assetUrls} onError={(message) => props.onModelError(entity.id, message)} />
      ) : model?.enabled ? (
        modelUrl && modelAsset ? (
          <ModelAssetView
            key={`${model.assetId}:${modelUrl}`}
            id={entity.id}
            asset={modelAsset}
            url={modelUrl}
            assets={props.assets}
            assetUrls={props.assetUrls}
            onError={props.onModelError}
            onStatus={props.onModelStatus}
            clearError={props.clearError}
            opacity={effective ? 1 : 0.38}
          />
        ) : (
          <AssetPlaceholder
            message={model?.assetId ? `Missing local model · ${modelAsset?.name ?? model.assetId}` : 'No model assigned'}
            failed={Boolean(model?.assetId)}
            onStatus={() => props.onModelStatus(entity.id, model?.assetId ? `Model unavailable: ${modelAsset?.name ?? model.assetId}` : '')}
          />
        )
      ) : sprite?.enabled ? (
        <SpriteVisual
          url={spriteUrl}
          width={Math.max(0.1, sprite.width / 10)}
          height={Math.max(0.1, sprite.height / 10)}
          tint={sprite.tint}
          active={effective}
          missing={Boolean(sprite.assetId && !spriteUrl)}
        />
      ) : (
        <mesh>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={effective ? (entity.id === 'player' ? '#bd4037' : '#aab0b4') : '#595b5d'} roughness={0.68} transparent={!effective} opacity={effective ? 1 : 0.38} />
        </mesh>
      )}
      {selectedEntity && !getCamera(entity) && <SelectionMarker />}
      {(props.childrenByParent.get(entity.id) ?? []).map((child) => (
        <EntityNode key={child.id} {...props} entity={child} />
      ))}
    </group>
  );
}

function SelectedGizmo({ entity, object, mode, camera, mobile, onCommit, onDragging }: {
  entity: SceneEntity;
  object: THREE.Group;
  mode: SceneTransformMode;
  camera: boolean;
  mobile: boolean;
  onCommit: ScenePreview3DProps['onTransformCommit'];
  onDragging: (dragging: boolean) => void;
}) {
  return (
    <TransformControls
      object={object}
      mode={camera && mode === 'scale' ? 'translate' : mode}
      space={camera && mode === 'translate' ? 'world' : 'local'}
      size={mobile ? 1.25 : camera ? 1 : 0.82}
      showX
      showY
      showZ
      onMouseDown={() => onDragging(true)}
      onMouseUp={() => {
        onDragging(false);
        onCommit(entity.id, transformToProject(entity, object.position, object.rotation, object.scale));
      }}
    />
  );
}

function SelectionOutline({ active }: { active: boolean }) {
  return <mesh>
    <boxGeometry args={[1.12, 1.12, 1.12]} />
    <meshBasicMaterial color={active ? '#e5e0d8' : '#9a7773'} wireframe transparent opacity={0.75} depthTest={false} />
  </mesh>;
}

function SelectionMarker() {
  return <mesh position={[0, 0.62, 0]}>
    <sphereGeometry args={[0.045, 8, 6]} />
    <meshBasicMaterial color="#d9473d" depthTest={false} />
  </mesh>;
}

function SpriteVisual({ url, width, height, tint, active, missing }: {
  url?: string;
  width: number;
  height: number;
  tint: string;
  active: boolean;
  missing: boolean;
}) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    setTexture(null);
    if (!url) return;
    let live = true;
    const finish = beginSystemActivity('Loading textures');
    const loader = new TextureLoader();
    loader.load(url, (loaded) => {
      finish();
      if (!live) { loaded.dispose(); return; }
      loaded.colorSpace = THREE.SRGBColorSpace;
      loaded.needsUpdate = true;
      setTexture(loaded);
    }, undefined, () => finish());
    return () => {
      finish();
      live = false;
      setTexture((current) => {
        current?.dispose();
        return null;
      });
    };
  }, [url]);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial color={texture ? '#ffffff' : tint} map={texture ?? undefined} transparent opacity={active ? 1 : 0.4} side={THREE.DoubleSide} />
      </mesh>
      {missing && <mesh>
        <planeGeometry args={[width * 0.72, height * 0.72]} />
        <meshBasicMaterial color="#9e3933" wireframe transparent opacity={0.9} />
      </mesh>}
    </group>
  );
}

function AssetPlaceholder({ message, failed, onStatus }: { message: string; failed: boolean; onStatus: () => void }) {
  useEffect(onStatus, [onStatus]);
  return (
    <group>
      <mesh>
        <octahedronGeometry args={[0.7, 0]} />
        <meshStandardMaterial color={failed ? '#9f3933' : '#777b7e'} wireframe />
      </mesh>
      <mesh position={[0, 0.95, 0]}>
        <planeGeometry args={[2.5, 0.3]} />
        <meshBasicMaterial color="#18191a" transparent opacity={0.9} />
      </mesh>
      <mesh position={[0, 0.95, 0.01]}>
        <planeGeometry args={[2.35, 0.04]} />
        <meshBasicMaterial color={failed ? '#d14a40' : '#a9a9a6'} />
      </mesh>
      <primitive object={new THREE.Object3D()} userData={{ status: message }} />
    </group>
  );
}

type LoadedModelProps = { id: string; asset: ProjectAsset; url: string; assets: ProjectAsset[]; assetUrls: Record<string, string>; onError: (id: string, message: string) => void; onStatus: (id: string, message: string) => void; clearError: (id: string) => void; opacity: number };

function ModelAssetView(props: LoadedModelProps) {
  const [object, setObject] = useState<THREE.Object3D | null>(null);
  const [failure, setFailure] = useState('');
  const ext = props.asset.name.slice(props.asset.name.lastIndexOf('.')).toLowerCase();
  const supported = ['.glb', '.gltf', '.obj', '.fbx', '.dae'].includes(ext);
  const loaderTypes = useMemo(() => {
    if (ext === '.glb' || ext === '.gltf') return GLTFLoader;
    if (ext === '.obj') return OBJLoader;
    if (ext === '.fbx') return FBXLoader;
    if (ext === '.dae') return ColladaLoader;
    return null;
  }, [ext]);

  useEffect(() => {
    let alive = true;
    setObject(null);
    setFailure('');
    props.clearError(props.id);
    props.onStatus(props.id, supported ? `Loading model · ${props.asset.name}` : '');
    if (!supported || !loaderTypes) {
      const message = `Unsupported model format · ${props.asset.name}`;
      setFailure(message);
      props.onError(props.id, message);
      return () => { alive = false; };
    }
    if (!props.url.startsWith('blob:')) {
      const message = `Model URL is not a local project asset · ${props.asset.name}`;
      setFailure(message);
      props.onError(props.id, message);
      return () => { alive = false; };
    }

    const finish = beginSystemActivity('Loading 3D models');
    const manager = new THREE.LoadingManager();
    let missingDependency = '';
    const byBasename = new Map<string, string>();
    props.assets.forEach((asset) => {
      const assetUrl = props.assetUrls[asset.id];
      if (assetUrl) byBasename.set(asset.name.split(/[\\/]/).pop()!.toLowerCase(), assetUrl);
    });
    const ownBase = props.asset.name.split(/[\\/]/).pop()!.toLowerCase();
    manager.setURLModifier((requested) => {
      if (requested === props.url) return props.url;
      if (/^data:/i.test(requested)) return requested;
      let basename = '';
      try {
        basename = decodeURIComponent(requested.split(/[?#]/)[0].split(/[\\/]/).pop() ?? '').toLowerCase();
      } catch {
        basename = requested.split(/[?#]/)[0].split(/[\\/]/).pop()?.toLowerCase() ?? '';
      }
      if (!basename || basename === ownBase) return props.url;
      const local = byBasename.get(basename);
      if (local?.startsWith('blob:')) return local;
      missingDependency = basename || requested;
      // Deliberately return a non-network URL. The loader will fail locally and we report the missing file.
      return 'data:application/octet-stream,missing-local-model-dependency';
    });
    const loader = new (loaderTypes as unknown as new (manager: THREE.LoadingManager) => any)(manager);
    try {
    loader.load(props.url, (result: any) => {
      finish();
      if (!alive) return;
      if (missingDependency) {
        const message = `Missing local model dependency · ${missingDependency} · ${props.asset.name}`;
        setFailure(message);
        props.onError(props.id, message);
        props.onStatus(props.id, '');
        return;
      }
      const root: THREE.Object3D = ext === '.gltf' || ext === '.glb' ? result.scene : ext === '.dae' ? result.scene : result;
      root.traverse((item) => {
        const mesh = item as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach((material) => {
          if ('transparent' in material) {
            material.transparent = props.opacity < 1 || material.transparent;
            material.opacity = props.opacity < 1 ? props.opacity : material.opacity;
          }
          material.needsUpdate = true;
        });
      });
      if (!hasRenderableModelGeometry(root)) {
        const message = `Model contains no renderable geometry · ${props.asset.name}`;
        setFailure(message);
        props.onError(props.id, message);
        props.onStatus(props.id, '');
        return;
      }
      setObject(root);
      props.clearError(props.id);
      props.onStatus(props.id, `Model ready · ${props.asset.name}`);
    }, undefined, (error: unknown) => {
      finish();
      if (!alive) return;
      const detail = missingDependency
        ? `Missing local model dependency · ${missingDependency}`
        : error instanceof Error && error.message ? error.message.slice(0, 110) : 'file could not be decoded';
      const message = `${detail} · ${props.asset.name}`;
      setFailure(message);
      props.onError(props.id, message);
      props.onStatus(props.id, '');
    });
    } catch {
      finish();
      const message = `Could not load model · ${props.asset.name}`;
      setFailure(message);
      props.onError(props.id, message);
      props.onStatus(props.id, '');
    }
    return () => { alive = false; finish(); };
  }, [props.id, props.asset, props.url, props.assets, props.assetUrls, props.opacity, props.onError, props.onStatus, props.clearError, supported, loaderTypes, ext]);

  if (failure) return <ModelFailure message={failure} />;
  if (!object) return <LoadingModel name={props.asset.name} />;
  return <primitive object={object} />;
}

function LoadingModel({ name }: { name: string }) {
  return <mesh>
    <icosahedronGeometry args={[0.48, 1]} />
    <meshStandardMaterial color="#a43c35" wireframe />
  </mesh>;
}

function ModelFailure({ message }: { message: string }) {
  return <group>
    <mesh>
      <octahedronGeometry args={[0.7, 0]} />
      <meshBasicMaterial color="#bd4037" wireframe />
    </mesh>
    <mesh position={[0, 0.9, 0]}>
      <boxGeometry args={[1.35, 0.08, 0.08]} />
      <meshBasicMaterial color="#d34b40" />
    </mesh>
    <primitive object={new THREE.Object3D()} userData={{ error: message }} />
  </group>;
}

