import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { Canvas, events as createPointerEvents, useFrame, useThree } from '@react-three/fiber';
import { filterSceneEditorHits, getSceneEditorFlags } from '@/lib/scene-editor-state';
import { Billboard, OrbitControls, TransformControls } from '@react-three/drei';
import * as THREE from 'three';
import { ColladaLoader } from 'three/examples/jsm/loaders/ColladaLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { useModelLod } from '@/hooks/use-model-lod';
import type { ModelLodSettings } from '@/lib/model-lod-settings';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { TextureLoader } from 'three';
import { SceneWebGLBoundary } from './scene-webgl-boundary';
import { SceneContextLifecycle } from './scene-context-lifecycle';
import { ScenePhysicalLighting } from './scene-physical-lighting';
import { FrameIntervalWindow } from '@/lib/physical-rendering';
import { requestWebGL2Context, type SceneGraphicsFailure } from '@/lib/webgl-context';
import { SceneRenderFallback } from './scene-render-fallback';
import { usePbrTextures } from './use-pbr-textures';
import { FloatingTransformToolbar } from './floating-transform-toolbar';
import { SceneTransformOptions } from './scene-transform-options';
import { useSceneTransformSettings } from '@/hooks/use-scene-transform-settings';
import { safeGizmoScale, transformGizmoOptions, type SceneTransformSettings } from '@/lib/scene-transform-settings';
import { SceneToolCursor, type SceneCursorTool } from './scene-tool-cursor';
import { useSceneRenderSettings } from '@/hooks/use-scene-render-settings';
import { getWebGLRenderProfile } from '@/lib/webgl-render-profile';
import { publishDiagnostic } from '@/lib/system-diagnostics';
import type { PbrMaterialDefinition } from '@/lib/pbr-material';
import { getSceneObjectTypeLabel, SceneObjectGlyph } from './scene-object-glyph';
import { beginSystemActivity } from '@/lib/system-activity';
import { hasRenderableModelGeometry } from '@/lib/scene-model-validation';
import { GameCameraRig } from './game-camera-rig';
import { SceneEditorEnvironment } from './scene-editor-environment';
import { PRIMARY_CAMERA_ID, cameraDisplayEntity, cameraFromEditorTransform, cameraWithOrbitPose, cameraWithPose, primaryCameraEntity } from '@/lib/camera-editor';
import { createGameCamera, type GameCamera } from '@/lib/game-camera';
import { isCharacterBodySurfacePart, isCharacterBuilderModelRoot } from '@/lib/character-builder-geometry';
import { CharacterBuilderBodyVisual, FighterPartMotion } from './character-builder-body-visual';
import { isFighterEntity } from '@/lib/fighter-visual';
import { SceneElementVisual } from './scene-element-visuals';
import { SceneNavigation } from './scene-navigation';
import { sceneEntityFocus, type SceneFocus } from '@/lib/scene-view-geometry';
import {
  getModelRenderer,
  getPrimitive, getCamera, getLight, getEffect, getUICanvas,
  getSpriteRenderer,
  getTriggerZone,
  getSkybox,
  getTransform,
  type ProjectAsset,
  type SceneEntity,
  type TriggerZoneComponent,
  type TransformComponent,
} from '@/lib/scene-model';
import './scene-preview-3d.css';

export type SceneTransformMode = 'translate' | 'rotate' | 'scale';
type CanvasOrbitMode = 'free' | 'y' | 'x';
export type SceneFrameRequest = { targetId: string; token: number };
const MIN_SCENE_ZOOM = 25;
const MAX_SCENE_ZOOM = 400;
import { isPixelRpgScene } from '@/lib/pixel-rpg-runtime';
import { PixelRpgViewport } from './pixel-rpg-viewport';
import {isCardDuelScene} from '@/lib/card-duel-runtime';
import {CardDuelViewport} from './card-duel-viewport';
import {isBasketballScene} from '@/lib/basketball-runtime';
import {BasketballViewport} from './basketball-viewport';

export type ScenePreview3DProps = {
  /** Explicit playback state for runtimes that also have a non-playing game view. */
  gameRunning?: boolean;
  /** Standalone players use the exported render profile without changing editor preferences. */
  renderSettingsOverride?: ReturnType<typeof useSceneRenderSettings>[0];
  projectName?: string;
  activeTool?: SceneCursorTool | null;
  primaryCamera?: GameCamera;
  gameView?: boolean;
  /** Render a still preview on demand instead of keeping the game-view loop active. */
  staticPreview?: boolean;
  /** Hub thumbnails only: copy a completed GPU frame, then release the scene. */
  onStaticPreviewCapture?: (image: string) => void;
  gameCamera?: GameCamera;
  graphicsFallback?: ReactNode;
  onGraphicsUnavailable?: (failure: SceneGraphicsFailure) => void;
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
  /** Reframe the editor viewport around a requested scene object without moving the game camera. */
  frameRequest?: SceneFrameRequest | null;
};

type ErrorEntry = { id: string; message: string };
type PerformanceOutputRef = { current: HTMLDivElement | null };

function ScenePerformanceSampler({ outputRef, continuous }: {
  outputRef: PerformanceOutputRef;
  continuous: boolean;
}) {
  const { gl } = useThree();
  const sample = useRef({ intervals: new FrameIntervalWindow(), elapsed: 0, started: false });
  useEffect(() => {
    const reset = () => {
      sample.current.intervals.reset(); sample.current.elapsed = 0; sample.current.started = false;
    };
    reset();
    document.addEventListener('visibilitychange', reset);
    return () => document.removeEventListener('visibilitychange', reset);
  }, [continuous]);

  useFrame((_state, delta) => {
    const output = outputRef.current;
    if (!output) {
      sample.current.intervals.reset(); sample.current.started = false; sample.current.elapsed = 0;
      return;
    }

    const render = gl.info.render;
    const memory = gl.info.memory;
    const details = `${render.calls} draws · ${render.triangles.toLocaleString()} tris · ${memory.geometries} geometries · ${memory.textures} textures`;
    if (!continuous || document.hidden) {
      output.textContent = `EDIT · ON-DEMAND · ${details}`;
      output.dataset.frameBudget = 'idle';
      sample.current.started = false;
      return;
    }
    if (!sample.current.started) {
      sample.current.started = true;
      output.textContent = `Measuring frame intervals · ${details}`;
      return;
    }
    sample.current.intervals.push(delta);
    sample.current.elapsed += Number.isFinite(delta) && delta > 0 ? delta : 0;
    if (sample.current.elapsed < 0.5) return;
    const stats = sample.current.intervals.summary;
    if (!stats) return;
    output.dataset.frameBudget = stats.overBudget ? 'over' : 'within';
    output.textContent = `${stats.fps.toFixed(0)} FPS · ${stats.meanMs.toFixed(1)} ms avg / ${stats.p95Ms.toFixed(1)} p95 / ${stats.worstMs.toFixed(1)} max · ${details}${stats.overBudget ? ' · Above 60 FPS frame budget' : ''}`;
    sample.current.elapsed = 0;
  });

  return null;
}

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

function TriggerZoneOutline({ zone }: { zone: TriggerZoneComponent }) {
  return (
    <mesh>
      {zone.shape === 'sphere'
        ? <sphereGeometry args={[Math.max(zone.size.x, zone.size.y, zone.size.z) / 2, 24, 16]} />
        : <boxGeometry args={[zone.size.x, zone.size.y, zone.size.z]} />}
      <meshBasicMaterial color="#55d8ff" wireframe transparent opacity={0.68} depthTest={false} />
    </mesh>
  );
}

export function ScenePreview3D(props: ScenePreview3DProps) {
  if(isBasketballScene(props.entities))return <BasketballViewport {...props}
    playing={Boolean(props.gameRunning??(props.gameView&&props.readOnly&&!props.staticPreview))}
    renderScene={sceneProps=><StandardScenePreview3D {...sceneProps}/>}/>;
  if(isCardDuelScene(props.entities))return <CardDuelViewport {...props}
    playing={Boolean(props.gameRunning ?? (props.gameView&&props.readOnly&&!props.staticPreview))}/>;
  if (isPixelRpgScene(props.entities)) return <PixelRpgViewport {...props}
    playing={Boolean(props.gameRunning ?? (props.gameView && props.readOnly && !props.staticPreview))} />;
  return <StandardScenePreview3D {...props} />;
}

function StaticPreviewCapture({ onCapture }: { onCapture: (image: string) => void }) {
  const invalidate = useThree(state => state.invalidate);
  const ready = useRef(false);
  const captured = useRef(false);
  const callback = useRef(onCapture);
  callback.current = onCapture;
  useEffect(() => {
    const timer = setTimeout(() => { ready.current = true; invalidate(); }, 1800);
    return () => clearTimeout(timer);
  }, [invalidate]);
  useFrame(({ gl, scene, camera }) => {
    if (!ready.current || captured.current) return;
    // Copy in the render frame; preserveDrawingBuffer is unnecessary and would
    // otherwise increase the editor's GPU memory usage.
    gl.render(scene, camera);
    try {
      const image = gl.domElement.toDataURL('image/webp', .88);
      captured.current = true;
      callback.current(image);
    } catch {
      // Keep the existing scene visible if the browser disallows capture.
      captured.current = true;
    }
  });
  return null;
}

function StandardScenePreview3D({
  renderSettingsOverride,
  projectName,
  activeTool,
  primaryCamera,
  gameView = false,
  staticPreview = false,
  onStaticPreviewCapture,
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
  frameRequest,
}: ScenePreview3DProps) {
  const [errors, setErrors] = useState<ErrorEntry[]>([]);
  const [modelStatuses, setModelStatuses] = useState<Record<string, string>>({});
  const [savedRenderSettings] = useSceneRenderSettings();
  const renderSettings = renderSettingsOverride ?? savedRenderSettings;
  const byId = useMemo(() => new Map(entities.map((entity) => [entity.id, entity])), [entities]);
  const editorView = !gameView && !readOnly;
  // R3F may initialize its event manager only once. Read live policy through a
  // ref so later hide/lock changes and entering Play never use stale flags.
  const editorPicking = useRef({ byId, editorView });
  editorPicking.current = { byId, editorView };
  const skybox = entities.filter(entity => entity.active && (!editorView || !getSceneEditorFlags(entity.id, byId).hidden))
    .map(getSkybox).find(component => component?.enabled);
  const sceneBackground = skybox?.color ?? (gameView ? '#333538' : renderSettings.background);
  const hasAnimatedEffects = useMemo(() => entities.some(entity => getEffect(entity)?.enabled), [entities]);
  const [mobile, setMobile] = useState(false);
  const webglProfile = getWebGLRenderProfile(renderSettings.quality, mobile);
  const rootRef = useRef<HTMLDivElement>(null);
  const performanceStatsRef = useRef<HTMLDivElement>(null);
  const cameraMarkerRef = useRef<HTMLButtonElement>(null);
  const [zoom, setZoom] = useState(100);
  const [frameToken, setFrameToken] = useState(0);
  const [sceneFocus, setSceneFocus] = useState<SceneFocus | null>(null);
  const handledFrameRequest = useRef(0);
  const [graphicsAvailable, setGraphicsAvailable] = useState(false);
  const [contextLost, setContextLost] = useState(false);
  const [graphicsGeneration, setGraphicsGeneration] = useState(0);
  const [gameViewRotated, setGameViewRotated] = useState(false);
  const [transformSettings, setTransformSettings] = useSceneTransformSettings();
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
    if (!frameRequest || gameView || frameRequest.token === handledFrameRequest.current) return;
    const focus = sceneEntityFocus(entities, frameRequest.targetId);
    if (!focus) return;
    handledFrameRequest.current = frameRequest.token;
    setSceneFocus(focus);
    setZoom(100);
    setFrameToken((value) => value + 1);
  }, [entities, frameRequest, gameView]);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 700px), (pointer: coarse)');
    const update = () => setMobile(media.matches);
    update();
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);

  const reportError = useCallback((id: string, message: string) => {
    publishDiagnostic('assets', 'error', message, `Scene asset/object: ${id}`);
    setErrors((current) => current.some((entry) => entry.id === id && entry.message === message)
      ? current
      : [...current.filter((entry) => entry.id !== id), { id, message }]);
  }, []);
  const clearError = useCallback((id: string) => {
    setErrors((current) => current.filter((entry) => entry.id !== id));
  }, []);
  const markGraphicsReady = useCallback(() => {
    setContextLost(false);
    setGraphicsAvailable(true);
    onGraphicsReady?.();
  }, [onGraphicsReady]);
  const markGraphicsUnavailable = useCallback((failure: SceneGraphicsFailure) => {
    publishDiagnostic('rendering', failure.kind === 'scene-error' ? 'error' : 'warning', failure.message, failure.detail);
    setContextLost(failure.kind === 'context-lost');
    setGraphicsAvailable(false);
    onGraphicsUnavailable?.(failure);
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
    if (event.target instanceof HTMLElement && event.target.closest('input, select, textarea, dialog, [contenteditable=true]')) return;
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
      data-render-quality={renderSettings.quality}
      data-lighting-mode={gameView ? 'automatic' : undefined}
      data-view-rotated={gameView ? String(gameViewRotated) : undefined}
      data-orbit-mode={gameView ? cameraOrbitMode : undefined}
      data-scene-entity-count={entities.length} data-scene-zoom={gameView ? undefined : zoom}>
      {!gameView && <header className="mh-scene3d__toolbar">
        <div className="mh-scene3d__heading">
          <span className="mh-scene3d__eyebrow" data-testid="scene-project-name" title={projectName}>
            {projectName || 'Name your project'}
          </span>
          <strong>Scene view</strong>
          <span className="mh-scene3d__selection" data-testid="scene3d-selection"
            title={selected ? `${getSceneObjectTypeLabel(selected)} · ${selected.name}` : undefined}>
            {selected && <SceneObjectGlyph entity={selected} />}
            {selected?.name ?? 'No selection'}
          </span>
        </div>
        <div className="mh-scene3d__view-label"><i aria-hidden="true" /> {readOnly ? 'RUNTIME PREVIEW' : 'RENDER ON'}</div>
      </header>}
      {!gameView && <div className="mh-scene3d__navigation" role="group" aria-label="Scene view navigation">
        <button type="button" onClick={() => setZoom((value) => Math.max(MIN_SCENE_ZOOM, value - 25))} disabled={zoom <= MIN_SCENE_ZOOM} data-testid="scene-zoom-out" aria-label="Zoom scene out">−</button>
        <label>Zoom <input type="range" min={MIN_SCENE_ZOOM} max={MAX_SCENE_ZOOM} step={5} value={zoom} onChange={(event) => setZoom(Number(event.target.value))} aria-label="Scene zoom" data-testid="scene-zoom" /></label>
        <output data-testid="scene-zoom-value">{zoom}%</output>
        <button type="button" onClick={() => setZoom((value) => Math.min(MAX_SCENE_ZOOM, value + 25))} disabled={zoom >= MAX_SCENE_ZOOM} data-testid="scene-zoom-in" aria-label="Zoom scene in">+</button>
        <button type="button" onClick={frameCamera} data-testid="scene-frame-camera" aria-label="Center on plane" title="Center the scene view at X = 0, facing the plane from north">Center plane</button>
        {editorCamera && onSelectPrimaryCamera && <button type="button" data-testid="scene3d-select-game-camera" aria-pressed={primarySelected}
          aria-label="Select Game Camera" title="Select the Game Camera"
          onClick={onSelectPrimaryCamera}>{primarySelected ? 'Camera ✓' : 'Select camera'}</button>}
        {selected?.generatedBy === 'mad-builder' && <button type="button" onClick={frameBuild} data-testid="scene-frame-build">Frame build</button>}
        <span className="mh-scene3d__grid-status" data-testid="scene-grid-status" title="Grid spacing: 1 world unit">GRID · 1 UNIT</span>
        <span title="World north is negative Z">N = −Z</span>
      </div>}
      <div
        ref={rootRef}
        className="mh-scene3d__viewport"
        data-testid="scene3d-viewport"
        tabIndex={0}
        role="application"
        aria-label={gameView ? 'Canvas: live Game Camera view. Drag to orbit around its target; choose free, Y-axis, or X-axis rotation.' : '3D scene viewport. Click and drag the Game Camera to move it horizontally. Select objects, use W to move, E to rotate, R to scale.'}
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
        {!gameView && !readOnly && <SceneToolCursor host={rootRef} tool={activeTool} />}
        {!gameView && <FloatingTransformToolbar anchor={rootRef}>
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
          <SceneTransformOptions settings={transformSettings} onChange={setTransformSettings} disabled={readOnly} />
        </FloatingTransformToolbar>}
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
        <SceneWebGLBoundary
          key={graphicsGeneration}
          fallback={graphicsFallback}
          fallbackContent={!gameView ? (
            <SceneRenderFallback
              entities={entities}
              assetUrls={assetUrls}
              detail="thumbnail"
              camera={editorCamera}
              settings={renderSettings}
              zoom={zoom}
              sceneFocus={sceneFocus}
              selectedEntityId={effectiveSelectedId}
              onSelectEntity={selectEntity}
            />
          ) : undefined}
          onUnavailable={markGraphicsUnavailable}
        >
        <Canvas
          events={state => ({ ...createPointerEvents(state),
            filter: hits => filterSceneEditorHits(hits, editorPicking.current.byId, editorPicking.current.editorView) })}
          camera={{ position: [0, 12, -16], fov: 48, near: 0.1, far: 3000 }}
          dpr={webglProfile.dpr}
          shadows={webglProfile.shadows ? { type: THREE.PCFShadowMap } : false}
          frameloop={!staticPreview && (gameView || hasAnimatedEffects) ? 'always' : 'demand'}
          gl={defaults => {
            const canvas = defaults.canvas as HTMLCanvasElement;
            const result = requestWebGL2Context(canvas, {
              antialias: webglProfile.antialias,
              powerPreference: webglProfile.powerPreference,
            });
            if (result.compatibility) publishDiagnostic('rendering', 'warning',
              'WebGL 2 started in compatibility mode. Scene quality settings are preserved; hardware antialiasing is disabled.',
              'The browser rejected the preferred GPU configuration. Using the available GPU instead.');
            canvas.dataset.webglStartupMode = result.compatibility ? 'compatibility' : 'preferred';
            return new THREE.WebGLRenderer({ ...defaults, canvas, context: result.context, alpha: false });
          }}
          onCreated={({ gl, scene }) => {
            gl.setClearColor(sceneBackground);
            scene.background = new THREE.Color(sceneBackground);
            markGraphicsReady();
          }}
        >
        <SceneContextLifecycle onLost={markGraphicsUnavailable} onRestored={markGraphicsReady} />
        {staticPreview && onStaticPreviewCapture && <StaticPreviewCapture onCapture={onStaticPreviewCapture} />}
        <ScenePhysicalLighting
          enabled={renderSettings.environmentReflections && renderSettings.quality !== 'performance'}
          intensity={renderSettings.reflectionIntensity} />
        {renderSettings.showPerformanceStats && (
          <ScenePerformanceSampler outputRef={performanceStatsRef} continuous={!staticPreview && (gameView || hasAnimatedEffects)} />
        )}
        <SceneRendererSettings
          background={sceneBackground}
          exposure={gameView ? 1 : renderSettings.exposure}
        />
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
            transformSettings={transformSettings}
            readOnly={readOnly || (primarySelected && !onPrimaryCameraChange)}
            editorView={editorView}
            onSelectEntity={selectEntity}
            onTransformCommit={commitTransform}
            onModelError={reportError}
            onModelStatus={reportModelStatus}
            clearError={clearError}
            mobile={mobile}
            renderSettings={renderSettings}
          />
        </Canvas>
        </SceneWebGLBoundary>
        {contextLost && <div className="mh-scene3d__unavailable" role="status" data-testid="scene3d-context-lost"
          style={{ position: 'absolute', inset: 0, zIndex: 10, background: '#111923f5' }}>
          <strong>Graphics connection interrupted</strong>
          <p>Waiting for the browser to restore the GPU connection. Your scene has not been changed.</p>
          <button type="button" onClick={() => { setContextLost(false); setGraphicsGeneration(value => value + 1); }}>
            Restart graphics
          </button>
        </div>}
        {renderSettings.showPerformanceStats && graphicsAvailable && (
          <div
            ref={performanceStatsRef}
            className="mh-scene3d__performance-stats"
            role="status"
            aria-live="off"
            aria-label="Live scene render statistics"
            data-testid="scene-performance-stats"
          >
            Collecting render statistics…
          </div>
        )}
        {!gameView && editorCamera && <button ref={cameraMarkerRef} type="button" className="mh-scene3d__camera-marker"
          onClick={() => { if (onSelectPrimaryCamera) onSelectPrimaryCamera(); else frameCamera(); }} data-testid="scene-camera-marker" aria-label="Select the game camera" data-selected={primarySelected}
          title="Click and drag the Game Camera in the scene to move it horizontally. Use the move gizmo for height and the rotate tool to aim it. This marker stays visible when the camera is off screen.">
          {primaryEntity && <SceneObjectGlyph entity={primaryEntity} />}
          Main Camera{primarySelected ? ' · Selected' : ''}
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
  editorView: boolean;
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
  transformSettings: SceneTransformSettings;
  readOnly: boolean;
  onSelectEntity: (id: string) => void;
  onTransformCommit: ScenePreview3DProps['onTransformCommit'];
  onModelError: (id: string, message: string) => void;
  onModelStatus: (id: string, message: string) => void;
  clearError: (id: string) => void;
  mobile: boolean;
  renderSettings: ReturnType<typeof useSceneRenderSettings>[0];
};

function SceneRendererSettings({ background, exposure }: { background: string; exposure: number }) {
  const { gl, scene, invalidate } = useThree();
  useEffect(() => {
    gl.setClearColor(background);
    scene.background = new THREE.Color(background);
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = exposure;
    gl.outputColorSpace = THREE.SRGBColorSpace;
    invalidate();
  }, [background, exposure, gl, invalidate, scene]);
  return null;
}

function SceneWorld(props: SceneWorldProps) {
  const orbitRef = useRef<any>(null);
  const gameOrbitStart = useRef<{ position: THREE.Vector3; quaternion: THREE.Quaternion } | null>(null);
  const gameOrbitDragging = useRef(false);
  const gameOrbitCommitTimer = useRef<number | null>(null);
  const [selectedObject, setSelectedObject] = useState<THREE.Group | null>(null);
  const [cameraDirectDragging, setCameraDirectDragging] = useState(false);
  const { camera, invalidate } = useThree();
  const changeCameraDrag = useCallback((dragging: boolean) => {
    if (orbitRef.current) orbitRef.current.enabled = !dragging;
    setCameraDirectDragging(dragging);
  }, []);
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
        ? <AutomaticGameLighting target={props.gameCamera?.target ?? { x: 0, y: 0, z: 0 }}
            shadows={props.renderSettings.quality === 'high' && !props.mobile} />
        : <SceneEditorEnvironment
          mobile={props.mobile}
          showGrid={props.renderSettings.showGrid}
          studioLighting={props.renderSettings.studioLighting}
          exposure={props.renderSettings.exposure}
        />}
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
        enabled={!cameraDirectDragging}
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
          <EntityNode key={entity.id} {...props} entity={entity} onSelectedObject={setSelectedObject}
            onCameraDragChange={changeCameraDrag} />
        ))}
      </Suspense>
      {!props.gameView && !props.readOnly && selected && selectedObject &&
        !getSceneEditorFlags(selected.id, props.byId).hidden &&
        !getSceneEditorFlags(selected.id, props.byId).pickingLocked && (
        <SelectedGizmo
          key={selected.id}
          entity={selected}
          object={selectedObject}
          mode={props.transformMode}
          settings={props.transformSettings}
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

function AutomaticGameLighting({ target, shadows }: { target: GameCamera['target']; shadows: boolean }) {
  const lightTarget = useMemo(() => {
    const object = new THREE.Object3D();
    object.position.set(target.x, target.y, target.z);
    return object;
  }, [target.x, target.y, target.z]);

  return <>
    <primitive object={lightTarget} />
    <ambientLight intensity={1.15} />
    <directionalLight target={lightTarget} position={[target.x + 7, target.y + 12, target.z + 6]} intensity={2.2}
      castShadow={shadows} shadow-mapSize-width={2048} shadow-mapSize-height={2048}
      shadow-camera-left={-30} shadow-camera-right={30} shadow-camera-top={30} shadow-camera-bottom={-30}
      shadow-camera-near={0.1} shadow-camera-far={100} shadow-radius={2}
      shadow-normalBias={0.035} shadow-bias={-0.00015} />
    <directionalLight target={lightTarget} position={[target.x - 7, target.y + 5, target.z - 8]} intensity={0.75} color="#b3c0cf" />
  </>;
}

type CameraDragSession = {
  pointerId: number;
  captureTarget: { setPointerCapture?: (pointerId: number) => void; releasePointerCapture?: (pointerId: number) => void } | null;
  nativeCaptureTarget: HTMLElement | null;
  object: THREE.Group;
  plane: THREE.Plane;
  startPoint: THREE.Vector3;
  startPosition: THREE.Vector3;
  moved: boolean;
};

function EntityNode(props: SceneWorldProps & {
  entity: SceneEntity;
  onSelectedObject: (object: THREE.Group | null) => void;
  onCameraDragChange: (dragging: boolean) => void;
  hideVisual?: boolean;
}) {
  const entityGroupRef = useRef<THREE.Group | null>(null);
  const cameraDragRef = useRef<CameraDragSession | null>(null);
  const invalidate = useThree((state) => state.invalidate);
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
  const editorFlags = props.editorView ? getSceneEditorFlags(entity.id, props.byId) : { hidden: false, pickingLocked: false };
  const selectedEntity = !props.gameView && props.selectedEntityId === entity.id;
  const canDirectDragCamera = isPrimary && !props.gameView && !props.readOnly && !editorFlags.hidden && !editorFlags.pickingLocked;
  const modelAsset = model?.assetId ? props.assets.find((asset) => asset.id === model.assetId) : undefined;
  const modelUrl = model?.assetId ? props.assetUrls[model.assetId] : undefined;
  const spriteUrl = sprite?.assetId ? props.assetUrls[sprite.assetId] : undefined;
  const childEntities = props.childrenByParent.get(entity.id) ?? [];
  const smoothCharacterRoot = isCharacterBuilderModelRoot(entity);
  const assignedModel = Boolean(model?.enabled && model.assetId);
  const assignedFighterSprite = Boolean(isFighterEntity(entity) && sprite?.enabled && sprite.assetId);
  const humanModelHeight = smoothCharacterRoot
    ? Number(entity.name.match(/(\d+(?:\.\d+)?)\s*m\b/i)?.[1]) || 1.8
    : undefined;
  const setGroupRef = useCallback((node: THREE.Group | null) => {
    entityGroupRef.current = node;
    if (selectedEntity) props.onSelectedObject(node);
  }, [selectedEntity, props.onSelectedObject]);
  if (props.gameView && !effective) return null;
  return (
    <FighterPartMotion entity={entity} disabled={props.hideVisual}>
    <group
      ref={setGroupRef}
      visible={!editorFlags.hidden}
      position={position}
      rotation={rotationToThree(isFighterEntity(entity)
        ? { ...transform.rotation, z: -transform.rotation.z } : transform.rotation)}
      scale={[transform.scale.x, transform.scale.z, transform.scale.y]}
      name={entity.name}
      userData={{ entityId: entity.id, madhorseEntityRoot: true }}
      onClick={(event) => {
        event.stopPropagation();
        if (!props.gameView) props.onSelectEntity(entity.id);
      }}
      onPointerDown={(event) => {
        if (!canDirectDragCamera || event.button !== 0) return;
        const object = entityGroupRef.current;
        if (!object) return;
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -object.position.y);
        const startPoint = event.ray.intersectPlane(plane, new THREE.Vector3());
        if (!startPoint) return;
        event.stopPropagation();
        props.onSelectEntity(entity.id);
        cameraDragRef.current = {
          pointerId: event.pointerId,
          captureTarget: event.target as unknown as CameraDragSession['captureTarget'],
          nativeCaptureTarget: event.nativeEvent.target instanceof HTMLElement ? event.nativeEvent.target : null,
          object,
          plane,
          startPoint,
          startPosition: object.position.clone(),
          moved: false,
        };
        props.onCameraDragChange(true);
        document.body.style.cursor = 'grabbing';
        try { cameraDragRef.current.captureTarget?.setPointerCapture?.(event.pointerId); } catch { /* Capture may already be owned by the Canvas. */ }
        try { cameraDragRef.current.nativeCaptureTarget?.setPointerCapture(event.pointerId); } catch { /* Canvas may already own capture. */ }
      }}
      onPointerMove={(event) => {
        const drag = cameraDragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        event.stopPropagation();
        const point = event.ray.intersectPlane(drag.plane, new THREE.Vector3());
        if (!point) return;
        const delta = point.sub(drag.startPoint);
        if (delta.lengthSq() > 0.0004) drag.moved = true;
        if (!drag.moved) return;
        drag.object.position.set(
          drag.startPosition.x + delta.x,
          drag.startPosition.y,
          drag.startPosition.z + delta.z,
        );
        invalidate();
      }}
      onPointerUp={(event) => {
        const drag = cameraDragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        event.stopPropagation();
        cameraDragRef.current = null;
        props.onCameraDragChange(false);
        document.body.style.cursor = '';
        try { drag.captureTarget?.releasePointerCapture?.(event.pointerId); } catch { /* Capture may have ended already. */ }
        try { drag.nativeCaptureTarget?.releasePointerCapture(event.pointerId); } catch { /* Capture may have ended already. */ }
        if (drag.moved) {
          props.onTransformCommit(entity.id, transformToProject(
            entity, drag.object.position, drag.object.rotation, drag.object.scale,
          ));
        }
      }}
      onPointerCancel={(event) => {
        const drag = cameraDragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        drag.object.position.copy(drag.startPosition);
        cameraDragRef.current = null;
        props.onCameraDragChange(false);
        document.body.style.cursor = '';
        try { drag.captureTarget?.releasePointerCapture?.(event.pointerId); } catch { /* Capture may have ended already. */ }
        try { drag.nativeCaptureTarget?.releasePointerCapture(event.pointerId); } catch { /* Capture may have ended already. */ }
        invalidate();
      }}
      onPointerOver={(event) => {
        event.stopPropagation();
        if (!props.gameView && !props.readOnly) document.body.style.cursor = canDirectDragCamera ? 'grab' : 'pointer';
      }}
      onPointerOut={() => { document.body.style.cursor = ''; }}
    >
      {!props.gameView && getTriggerZone(entity)?.enabled && (
        <TriggerZoneOutline zone={getTriggerZone(entity)!} />
      )}
      {selectedEntity && !getCamera(entity) && <SelectionOutline active={effective} />}
      {props.hideVisual ? null : assignedFighterSprite && sprite ? (
        <Billboard position={[0, sprite.height / 20, 0]}>
          <SpriteVisual upright url={spriteUrl} width={sprite.width / 10} height={sprite.height / 10}
            tint={sprite.tint} active={effective} missing={!spriteUrl} />
        </Billboard>
      ) : assignedModel ? (
        modelUrl && modelAsset ? (
          <ModelAssetView
            key={`${model?.assetId ?? ''}:${modelUrl}`}
            id={entity.id}
            asset={modelAsset}
            lod={model?.lod}
            forceFullDetail={props.selectedEntityId === entity.id}
            url={modelUrl}
            assets={props.assets}
            assetUrls={props.assetUrls}
            pbrMaterial={props.assets.find(asset =>
              asset.id === (model?.materialAssetId ?? getPrimitive(entity)?.materialAssetId) && asset.kind === 'pbr-material')?.pbrMaterial}
            onError={props.onModelError}
            onStatus={props.onModelStatus}
            clearError={props.clearError}
            opacity={effective ? 1 : 0.38}
            fitHeight={humanModelHeight}
          />
        ) : (
          <AssetPlaceholder
            message={`Missing local model · ${modelAsset?.name ?? model?.assetId ?? 'unknown asset'}`}
            failed
            onStatus={() => props.onModelStatus(entity.id, `Model unavailable: ${modelAsset?.name ?? model?.assetId ?? 'unknown asset'}`)}
          />
        )
      ) : entity.isGroup ? null : !model?.enabled && (getPrimitive(entity) || getLight(entity) || getCamera(entity) || getUICanvas(entity)) ? (
        <SceneElementVisual entity={entity} gameView={Boolean(props.gameView)} active={effective}
          selected={selectedEntity} primary={isPrimary}
          assets={props.assets} assetUrls={props.assetUrls}
          onError={(message) => props.onModelError(entity.id, message)} />
      ) : model?.enabled ? (
        modelUrl && modelAsset ? (
          <ModelAssetView
            key={`${model.assetId}:${modelUrl}`}
            id={entity.id}
            asset={modelAsset}
            lod={model.lod}
            forceFullDetail={props.selectedEntityId === entity.id}
            url={modelUrl}
            assets={props.assets}
            assetUrls={props.assetUrls}
            pbrMaterial={props.assets.find(asset => asset.id === model.materialAssetId && asset.kind === 'pbr-material')?.pbrMaterial}
            onError={props.onModelError}
            onStatus={props.onModelStatus}
            clearError={props.clearError}
            opacity={effective ? 1 : 0.38}
          fitHeight={humanModelHeight}
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
          opacity={props.gameView ? 1 : 0.1}
        />
      ) : entity.isGroup ? null : (
        <mesh>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={effective ? (entity.id === 'player' ? '#bd4037' : '#aab0b4') : '#595b5d'} roughness={0.68} transparent={!effective} opacity={effective ? 1 : 0.38} />
        </mesh>
      )}
      {selectedEntity && !getCamera(entity) && <SelectionMarker />}
      {(() => {
        const children = childEntities.map((child) => (
        <EntityNode
          key={child.id}
          {...props}
          entity={child}
          hideVisual={props.hideVisual || assignedModel || assignedFighterSprite || (smoothCharacterRoot && child.active && isCharacterBodySurfacePart(child))}
        />
        ));
        return !props.hideVisual && smoothCharacterRoot && !assignedModel && !assignedFighterSprite
          ? <CharacterBuilderBodyVisual parts={childEntities} rootId={entity.id} pose={entity.runtimePose}>{children}</CharacterBuilderBodyVisual>
          : children;
      })()}
    </group>
    </FighterPartMotion>
  );
}

function SelectedGizmo({ entity, object, mode, camera, mobile, settings, onCommit, onDragging }: {
  entity: SceneEntity;
  object: THREE.Group;
  mode: SceneTransformMode;
  camera: boolean;
  mobile: boolean;
  settings: SceneTransformSettings;
  onCommit: ScenePreview3DProps['onTransformCommit'];
  onDragging: (dragging: boolean) => void;
}) {
  const startScale = useRef(object.scale.clone());
  const effectiveMode = camera && mode === 'scale' ? 'translate' : mode;
  return (
    <TransformControls
      object={object}
      mode={effectiveMode}
      {...transformGizmoOptions(settings, effectiveMode, camera)}
      size={mobile ? 1.25 : camera ? 1 : 0.82}
      showX
      showY
      showZ
      onMouseDown={() => { startScale.current.copy(object.scale); onDragging(true); }}
      onMouseUp={() => {
        onDragging(false);
        object.scale.copy(safeGizmoScale(object.scale, startScale.current));
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

function SpriteVisual({ url, width, height, tint, active, missing, opacity = 1, upright = false }: {
  url?: string;
  width: number;
  height: number;
  tint: string;
  active: boolean;
  missing: boolean;
  opacity?: number;
  upright?: boolean;
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
      <mesh rotation={upright ? [0, 0, 0] : [-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial color={texture ? '#ffffff' : tint} map={texture ?? undefined} transparent opacity={active ? opacity : 0.4} side={THREE.DoubleSide} />
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

type LoadedModelProps = {
  id: string; asset: ProjectAsset; url: string; assets: ProjectAsset[]; assetUrls: Record<string, string>;
  pbrMaterial?: PbrMaterialDefinition;
  lod?: ModelLodSettings;
  forceFullDetail?: boolean;
  onError: (id: string, message: string) => void; onStatus: (id: string, message: string) => void;
  clearError: (id: string) => void; opacity: number; fitHeight?: number;
};

function ModelAssetView(props: LoadedModelProps) {
  const [object, setObject] = useState<THREE.Object3D | null>(null);
  const [failure, setFailure] = useState('');
  useModelLod(object, props.id, props.asset.id, props.lod, Boolean(props.forceFullDetail));
  const renderer = useThree(state => state.gl);
  const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const pbrTextures = usePbrTextures(props.pbrMaterial, props.assetUrls, anisotropy);
  const overriddenMaterials = useRef(new Map<THREE.Mesh, {
    materialId: string; original: THREE.Material | THREE.Material[]; copies: THREE.MeshStandardMaterial[];
  }>());
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
      if (props.fitHeight && props.fitHeight > 0) {
        root.updateMatrixWorld(true);
        const originalBounds = new THREE.Box3().setFromObject(root);
        const originalSize = new THREE.Vector3();
        originalBounds.getSize(originalSize);
        if (originalSize.y > 0.001) {
          root.scale.multiplyScalar(props.fitHeight / originalSize.y);
          root.updateMatrixWorld(true);
          const fittedBounds = new THREE.Box3().setFromObject(root);
          const center = new THREE.Vector3();
          fittedBounds.getCenter(center);
          root.position.x -= center.x;
          root.position.y -= fittedBounds.min.y;
          root.position.z -= center.z;
          root.updateMatrixWorld(true);
        }
      }
      root.traverse((item) => {
        const mesh = item as THREE.Mesh;
        if (!mesh.isMesh) return;
        if (mesh.geometry.getAttribute('uv') && !mesh.geometry.getAttribute('uv2')) {
          mesh.geometry.setAttribute('uv2', mesh.geometry.getAttribute('uv'));
        }
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mesh.castShadow = mats.some(material => !material.transparent || material.opacity >= .8);
        mesh.receiveShadow = true;
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
  }, [props.id, props.asset, props.url, props.assets, props.assetUrls, props.opacity, props.fitHeight, props.onError, props.onStatus, props.clearError, supported, loaderTypes, ext]);

  useEffect(() => {
    if (!object) return;
    const materialId = props.pbrMaterial
      ? props.assets.find(asset => asset.kind === 'pbr-material' && asset.pbrMaterial === props.pbrMaterial)?.id
      : undefined;
    object.traverse(item => {
      const mesh = item as THREE.Mesh;
      if (!mesh.isMesh) return;
      let record = overriddenMaterials.current.get(mesh);
      if (record && record.materialId !== materialId) {
        mesh.material = record.original;
        record.copies.forEach(copy => copy.dispose());
        overriddenMaterials.current.delete(mesh);
        record = undefined;
      }
      if (!props.pbrMaterial || !materialId) return;
      if (!record) {
        const original = mesh.material;
        const source = Array.isArray(original) ? original : [original];
        const copies = source.map(material => material instanceof THREE.MeshStandardMaterial
          ? material.clone() : new THREE.MeshStandardMaterial());
        record = { materialId, original, copies };
        overriddenMaterials.current.set(mesh, record);
        mesh.material = Array.isArray(original) ? copies : copies[0];
      }
      record.copies.forEach(copy => {
        const material = props.pbrMaterial!;
        copy.color.set(material.baseColor);
        copy.map = pbrTextures.baseColor ?? copy.map;
        copy.normalMap = pbrTextures.normal ?? copy.normalMap;
        copy.roughnessMap = pbrTextures.roughness ?? copy.roughnessMap;
        copy.metalnessMap = pbrTextures.metalness ?? copy.metalnessMap;
        copy.aoMap = pbrTextures.ambientOcclusion ?? copy.aoMap;
        copy.aoMapIntensity = material.ambientOcclusionIntensity;
        copy.emissive.set(material.emissiveColor);
        copy.emissiveMap = pbrTextures.emissive ?? copy.emissiveMap;
        copy.emissiveIntensity = material.emissiveIntensity;
        copy.normalScale.setScalar(material.normalScale);
        copy.roughness = material.roughness;
        copy.metalness = material.metalness;
        copy.transparent = material.opacity < 1 || props.opacity < 1 || copy.transparent;
        copy.opacity = Math.min(material.opacity, props.opacity);
        copy.needsUpdate = true;
      });
    });
  }, [object, props.assets, props.pbrMaterial, pbrTextures]);

  useEffect(() => {
    if (!object) return;
    return () => {
      object.traverse(item => {
        const mesh = item as THREE.Mesh;
        const record = mesh.isMesh ? overriddenMaterials.current.get(mesh) : undefined;
        if (!record) return;
        mesh.material = record.original;
        record.copies.forEach(copy => copy.dispose());
        overriddenMaterials.current.delete(mesh);
      });
    };
  }, [object]);

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

