import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Grid, OrbitControls, TransformControls } from '@react-three/drei';
import * as THREE from 'three';
import { ColladaLoader } from 'three/examples/jsm/loaders/ColladaLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { TextureLoader } from 'three';
import { SceneWebGLBoundary } from './scene-webgl-boundary';
import {
  getModelRenderer,
  getSpriteRenderer,
  getTransform,
  type ProjectAsset,
  type SceneEntity,
  type TransformComponent,
} from '@/lib/scene-model';
import './scene-preview-3d.css';

export type SceneTransformMode = 'translate' | 'rotate' | 'scale';
export type ScenePreview3DProps = {
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
}: ScenePreview3DProps) {
  const [errors, setErrors] = useState<ErrorEntry[]>([]);
  const [modelStatuses, setModelStatuses] = useState<Record<string, string>>({});
  const [mobile, setMobile] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
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
  const selected = selectedEntityId ? byId.get(selectedEntityId) : undefined;
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
      onTransformModeChange(key === 'w' ? 'translate' : key === 'e' ? 'rotate' : 'scale');
    }
  };

  return (
    <section className="mh-scene3d" data-testid="scene-preview-3d" aria-label="3D scene preview">
      <header className="mh-scene3d__toolbar">
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
              className={`mh-scene3d__tool ${transformMode === mode ? 'is-active' : ''}`}
              aria-pressed={transformMode === mode}
              aria-label={`${label} tool (${shortcut})`}
              title={`${label} · ${shortcut}`}
              data-testid={`scene3d-mode-${mode}`}
              disabled={readOnly}
              onClick={() => onTransformModeChange(mode)}
            >
              <span aria-hidden="true">{icon}</span><small>{label}</small>
            </button>
          ))}
        </div>
        <div className="mh-scene3d__view-label"><i aria-hidden="true" /> {readOnly ? 'RUNTIME PREVIEW' : 'PERSPECTIVE'}</div>
      </header>
      <div
        ref={rootRef}
        className="mh-scene3d__viewport"
        data-testid="scene3d-viewport"
        tabIndex={0}
        role="application"
        aria-label="3D scene viewport. Select objects, use W to move, E to rotate, R to scale. Drag to orbit and use two fingers to pan or zoom."
        onKeyDown={handleViewportKeyDown}
      >
        <SceneWebGLBoundary>
        <Canvas
          camera={{ position: [10, 8, 12], fov: 48, near: 0.1, far: 300 }}
          dpr={mobile ? 1 : [1, 1.5]}
          frameloop="demand"
          gl={{ antialias: !mobile, powerPreference: 'low-power', alpha: false }}
          onCreated={({ gl, scene }) => {
            gl.setClearColor('#171819');
            scene.background = new THREE.Color('#171819');
          }}
        >
        <SceneWorld
            entities={entities}
          assets={assets}
            childrenByParent={childrenByParent}
            byId={byId}
            assetUrls={assetUrls}
            selectedEntityId={selectedEntityId}
            playerPreviewPosition={playerPreviewPosition}
            transformMode={transformMode}
            readOnly={readOnly}
            onSelectEntity={onSelectEntity}
            onTransformCommit={onTransformCommit}
            onModelError={reportError}
            onModelStatus={reportModelStatus}
            clearError={clearError}
            mobile={mobile}
          />
        </Canvas>
        </SceneWebGLBoundary>
        {entities.length === 0 && (
          <div className="mh-scene3d__empty" data-testid="scene3d-empty-state">
            <span className="mh-scene3d__empty-mark" aria-hidden="true" />
            <strong>Scene is clear</strong>
            <span>Add an object to begin building in 3D.</span>
          </div>
        )}
        <div className="mh-scene3d__axis-key" aria-label="Axis colors">
          <span><i className="axis-x" /> X</span><span><i className="axis-y" /> Y</span><span><i className="axis-z" /> Z</span>
        </div>
        {(errors.length > 0 || Object.keys(modelStatuses).length > 0) && (
          <div className="mh-scene3d__notices" role="status" aria-live="polite" data-testid="scene3d-asset-status">
            {errors.map((entry) => <div key={entry.id} className="mh-scene3d__notice is-error">{entry.message}</div>)}
            {Object.entries(modelStatuses).map(([id, message]) => (
              <div key={id} className="mh-scene3d__notice">{message}</div>
            ))}
          </div>
        )}
        {readOnly && (
          <div className="mh-scene3d__runtime-note" data-testid="scene3d-runtime-note">
            PLAY MODE <span>Player preview position · {playerPreviewPosition.x.toFixed(1)}, {playerPreviewPosition.y.toFixed(1)} · project unchanged</span>
          </div>
        )}
      </div>
      <footer className="mh-scene3d__footer">
        <span data-testid="scene3d-entity-count"><b>{String(entities.length).padStart(2, '0')}</b> OBJECTS</span>
        <span className="mh-scene3d__footer-center">
          {selected ? `SELECTED · ${selected.name}` : 'SELECT AN OBJECT'}
          {selected && ` · ${getModelRenderer(selected)?.assetId ? 'MODEL' : getSpriteRenderer(selected)?.enabled ? 'SPRITE' : 'OBJECT'}`}
        </span>
        <span className="mh-scene3d__hint">{mobile ? 'DRAG ORBIT · PINCH ZOOM' : 'DRAG ORBIT · RIGHT-DRAG PAN · SCROLL ZOOM'}</span>
      </footer>
    </section>
  );
}

type SceneWorldProps = {
  entities: SceneEntity[];
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
  const [selectedObject, setSelectedObject] = useState<THREE.Group | null>(null);
  const { invalidate } = useThree();
  const selected = props.selectedEntityId
    ? props.entities.find((entity) => entity.id === props.selectedEntityId)
    : undefined;
  return (
    <>
      <ambientLight intensity={1.15} />
      <directionalLight position={[7, 12, 6]} intensity={2.2} />
      <directionalLight position={[-7, 5, -8]} intensity={0.75} color="#b3c0cf" />
      <Grid args={[160, 160]} cellSize={1} cellThickness={0.48} cellColor="#43474a" sectionSize={5}
        sectionThickness={0.9} sectionColor="#777b7d" fadeDistance={72} fadeStrength={1.5} infiniteGrid
        position={[0, -0.012, 0]} />
      <Axes />
      <OrbitControls
        ref={orbitRef}
        makeDefault
        enableDamping
        dampingFactor={props.mobile ? 0.12 : 0.08}
        minDistance={2.3}
        maxDistance={100}
        maxPolarAngle={Math.PI * 0.495}
        enablePan
        screenSpacePanning={false}
        touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }}
      />
      <Suspense fallback={null}>
        {(props.childrenByParent.get(null) ?? []).map((entity) => (
          <EntityNode key={entity.id} {...props} entity={entity} onSelectedObject={setSelectedObject} />
        ))}
      </Suspense>
      {!props.readOnly && selected && selectedObject && (
        <SelectedGizmo
          key={selected.id}
          entity={selected}
          object={selectedObject}
          mode={props.transformMode}
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

function EntityNode(props: SceneWorldProps & { entity: SceneEntity; onSelectedObject: (object: THREE.Group | null) => void }) {
  const { entity } = props;
  const transform = getTransform(entity);
  const position = vectorToThree(entity, transform.position);
  if (entity.id === 'player' && !entity.parentId) {
    position.x = (props.playerPreviewPosition.x - 50) / 10;
    position.z = (props.playerPreviewPosition.y - 50) / 10;
  }
  const sprite = getSpriteRenderer(entity);
  const model = getModelRenderer(entity);
  const effective = isEffectivelyActive(entity, props.byId);
  const selectedEntity = props.selectedEntityId === entity.id;
  const modelAsset = model?.assetId ? props.assets.find((asset) => asset.id === model.assetId) : undefined;
  const modelUrl = model?.assetId ? props.assetUrls[model.assetId] : undefined;
  const spriteUrl = sprite?.assetId ? props.assetUrls[sprite.assetId] : undefined;
  const setGroupRef = useCallback((node: THREE.Group | null) => {
    if (selectedEntity) props.onSelectedObject(node);
  }, [selectedEntity, props.onSelectedObject]);
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
        props.onSelectEntity(entity.id);
      }}
      onPointerOver={(event) => {
        event.stopPropagation();
        if (!props.readOnly) document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => { document.body.style.cursor = ''; }}
    >
      {selectedEntity && <SelectionOutline active={effective} />}
      {model?.enabled ? (
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
      {selectedEntity && <SelectionMarker />}
      {(props.childrenByParent.get(entity.id) ?? []).map((child) => (
        <EntityNode key={child.id} {...props} entity={child} />
      ))}
    </group>
  );
}

function SelectedGizmo({ entity, object, mode, onCommit, onDragging }: {
  entity: SceneEntity;
  object: THREE.Group;
  mode: SceneTransformMode;
  onCommit: ScenePreview3DProps['onTransformCommit'];
  onDragging: (dragging: boolean) => void;
}) {
  return (
    <TransformControls
      object={object}
      mode={mode}
      space="local"
      size={0.82}
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

function Axes() {
  return (
    <group position={[0, 0.012, 0]} renderOrder={2}>
      <AxisLine points={[[0, 0, 0], [8, 0, 0]]} color="#c94b43" />
      <AxisLine points={[[0, 0, 0], [0, 8, 0]]} color="#72ae79" />
      <AxisLine points={[[0, 0, 0], [0, 0, 8]]} color="#638bc5" />
    </group>
  );
}

function AxisLine({ points, color }: { points: [number, number, number][]; color: string }) {
  return <line>
    <bufferGeometry><bufferAttribute attach="attributes-position" args={[new Float32Array(points.flat()), 3]} /></bufferGeometry>
    <lineBasicMaterial color={color} transparent opacity={0.85} depthWrite={false} />
  </line>;
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
    const loader = new TextureLoader();
    loader.load(url, (loaded) => {
      if (!live) { loaded.dispose(); return; }
      loaded.colorSpace = THREE.SRGBColorSpace;
      loaded.needsUpdate = true;
      setTexture(loaded);
    });
    return () => {
      live = false;
      setTexture((current) => {
        current?.dispose();
        return null;
      });
    };
  }, [url]);
  return (
    <group>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
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
    loader.load(props.url, (result: any) => {
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
      setObject(root);
      props.clearError(props.id);
      props.onStatus(props.id, `Model ready · ${props.asset.name}`);
    }, undefined, (error: unknown) => {
      if (!alive) return;
      const detail = missingDependency
        ? `Missing local model dependency · ${missingDependency}`
        : error instanceof Error && error.message ? error.message.slice(0, 110) : 'file could not be decoded';
      const message = `${detail} · ${props.asset.name}`;
      setFailure(message);
      props.onError(props.id, message);
      props.onStatus(props.id, '');
    });
    return () => { alive = false; };
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

