import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls, TransformControls } from '@react-three/drei';
import * as THREE from 'three';
import { SceneWebGLBoundary } from '../scene-webgl-boundary';
import type { ModelingDocument } from '@/lib/modeling-document';

export type ModelingTool = 'select' | 'sculpt' | 'weights';
export type ModelingTransformMode = 'translate' | 'rotate' | 'scale';

function ModelScene({
  document, selected, bone, showRig, wireframe, tool, clip, playing, revision, frameRequest,
  editMode, editMesh, selectedVertices, selectedFaces, transformMode, transformSpace, gridSnap,
  onSelect, onBrush, onStrokeEnd, onSelectFace, onSelectVertex, onTransformStart, onTransformEnd,
}: ModelingViewportProps) {
  const lastPaint = useRef(0);
  const dragging = useRef(false);
  const mixer = useMemo(() => new THREE.AnimationMixer(document.root), [document]);
  const camera = useThree((state) => state.camera);
  const framing = useMemo(() => {
    document.root.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(document.root);
    const center = bounds.isEmpty() ? new THREE.Vector3(0, 1, 0) : bounds.getCenter(new THREE.Vector3());
    const size = bounds.isEmpty() ? 2 : Math.max(bounds.getSize(new THREE.Vector3()).length(), .5);
    return { center, size };
  }, [document, frameRequest]);
  useEffect(() => {
    camera.position.copy(framing.center).add(new THREE.Vector3(.7, .25, 1).multiplyScalar(framing.size * 1.1));
    camera.lookAt(framing.center);
    camera.near = Math.max(.005, framing.size / 1000);
    camera.far = Math.max(100, framing.size * 100);
    camera.updateProjectionMatrix();
  }, [camera, framing]);
  const helper = useMemo(() => new THREE.SkeletonHelper(document.root), [document, revision]);
  const highlight = useMemo(() => selected instanceof THREE.Mesh ? new THREE.BoxHelper(selected, '#c189ff') : null, [selected, revision]);
  const raycaster = useThree((state) => state.raycaster);
  const vertexCloud = useMemo(() => {
    if (!editMode || !editMesh) return null;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', editMesh.geometry.getAttribute('position').clone());
    const count = editMesh.geometry.getAttribute('position').count;
    const colors = new Float32Array(count * 3);
    for (let index = 0; index < count; index++) {
      const color = selectedVertices.includes(index) ? new THREE.Color('#ffd37c') : new THREE.Color('#55caff');
      colors.set([color.r, color.g, color.b], index * 3);
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const points = new THREE.Points(geometry, new THREE.PointsMaterial({
      size: .065, sizeAttenuation: true, vertexColors: true, depthWrite: false,
    }));
    points.matrixAutoUpdate = false;
    points.frustumCulled = false;
    points.renderOrder = 4;
    return points;
  }, [editMode, editMesh, selectedVertices, revision]);
  const faceHighlight = useMemo(() => {
    if (!editMode || !editMesh || !selectedFaces.length) return null;
    const geometry = new THREE.BufferGeometry();
    const positions: number[] = [];
    const source = editMesh.geometry;
    const index = source.index;
    for (const face of selectedFaces) {
      const ids = index ? [index.getX(face * 3), index.getX(face * 3 + 1), index.getX(face * 3 + 2)] : [face * 3, face * 3 + 1, face * 3 + 2];
      ids.forEach((id) => {
        if (id < source.getAttribute('position').count) {
          positions.push(source.getAttribute('position').getX(id), source.getAttribute('position').getY(id), source.getAttribute('position').getZ(id));
        }
      });
    }
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    const overlay = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
      color: '#b67aff', transparent: true, opacity: .4, side: THREE.DoubleSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1,
    }));
    overlay.matrixAutoUpdate = false;
    overlay.frustumCulled = false;
    overlay.renderOrder = 3;
    overlay.raycast = () => {};
    return overlay;
  }, [editMode, editMesh, selectedFaces, revision]);
  useEffect(() => () => { helper.geometry.dispose(); (helper.material as THREE.Material).dispose(); }, [helper]);
  useEffect(() => () => { highlight?.geometry.dispose(); (highlight?.material as THREE.Material | undefined)?.dispose(); }, [highlight]);
  useEffect(() => () => {
    vertexCloud?.geometry.dispose(); (vertexCloud?.material as THREE.Material | undefined)?.dispose();
  }, [vertexCloud]);
  useEffect(() => () => {
    faceHighlight?.geometry.dispose(); (faceHighlight?.material as THREE.Material | undefined)?.dispose();
  }, [faceHighlight]);
  useEffect(() => {
    const previous = raycaster.params.Points!.threshold;
    raycaster.params.Points!.threshold = .08;
    return () => { raycaster.params.Points!.threshold = previous; };
  }, [raycaster]);
  useEffect(() => {
    document.root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      (Array.isArray(object.material) ? object.material : [object.material]).forEach((material) => {
        if ('wireframe' in material) (material as THREE.MeshStandardMaterial).wireframe = wireframe;
      });
    });
  }, [document, wireframe, revision]);
  useEffect(() => {
    if (!playing || !document.clips[clip]) return;
    const poses: { object: THREE.Object3D; position: THREE.Vector3; quaternion: THREE.Quaternion; scale: THREE.Vector3 }[] = [];
    document.root.traverse((object) => poses.push({
      object, position: object.position.clone(), quaternion: object.quaternion.clone(), scale: object.scale.clone(),
    }));
    mixer.clipAction(document.clips[clip]).play();
    return () => {
      mixer.stopAllAction();
      poses.forEach(({ object, position, quaternion, scale }) => {
        object.position.copy(position); object.quaternion.copy(quaternion); object.scale.copy(scale);
      });
      mixer.uncacheRoot(document.root);
    };
  }, [mixer, playing, clip, document]);
  useFrame((_, delta) => {
    if (playing) mixer.update(Math.min(delta, .05));
    if (highlight) highlight.update();
    if (vertexCloud && editMesh) {
      editMesh.updateWorldMatrix(true, false);
      vertexCloud.matrix.copy(editMesh.matrixWorld);
      vertexCloud.matrixWorldNeedsUpdate = true;
    }
    if (faceHighlight && editMesh) {
      editMesh.updateWorldMatrix(true, false);
      faceHighlight.matrix.copy(editMesh.matrixWorld);
      faceHighlight.matrixWorldNeedsUpdate = true;
    }
  });
  const paint = (event: ThreeEvent<PointerEvent>) => {
    if (tool === 'select' || playing || !(event.object instanceof THREE.Mesh)) return;
    event.stopPropagation();
    if (performance.now() - lastPaint.current < 40) return;
    lastPaint.current = performance.now();
    onBrush(event.object, event.point);
  };
  return <>
    <color attach="background" args={['#15131c']} />
    <ambientLight intensity={1.2} />
    <directionalLight position={[3, 5, 4]} intensity={2.2} />
    <directionalLight position={[-4, 2, -2]} intensity={1} color="#acbfff" />
    <gridHelper args={[12, 24, '#615574', '#343039']} />
    <primitive object={document.root}
      onPointerDown={(event: ThreeEvent<PointerEvent>) => {
        if (event.button !== 0) return;
        event.stopPropagation();
        if (tool === 'select') {
          onSelect(event.object);
          if (editMode && event.object instanceof THREE.Mesh && event.faceIndex != null) {
            onSelectFace(event.object, event.faceIndex, event.shiftKey);
            if (!(event.object instanceof THREE.SkinnedMesh) && event.face) {
              const positions = event.object.geometry.getAttribute('position');
              const candidates = [event.face.a, event.face.b, event.face.c];
              const nearest = candidates.reduce((best, candidate) => {
                const point = new THREE.Vector3().fromBufferAttribute(positions, candidate);
                event.object.localToWorld(point);
                return point.distanceToSquared(event.point) < best.distance
                  ? { index: candidate, distance: point.distanceToSquared(event.point) } : best;
              }, { index: candidates[0], distance: Infinity });
              onSelectVertex(event.object, nearest.index, event.shiftKey);
            }
          }
          return;
        }
        dragging.current = true;
        (event.target as unknown as { setPointerCapture?: (id: number) => void }).setPointerCapture?.(event.pointerId);
        paint(event);
      }}
      onPointerMove={(event: ThreeEvent<PointerEvent>) => { if (dragging.current && event.buttons === 1) paint(event); }}
      onPointerUp={(event: ThreeEvent<PointerEvent>) => {
        if (!dragging.current) return;
        dragging.current = false;
        (event.target as unknown as { releasePointerCapture?: (id: number) => void }).releasePointerCapture?.(event.pointerId);
        onStrokeEnd();
      }}
      onPointerCancel={() => { dragging.current = false; onStrokeEnd(); }}
    />
    {vertexCloud && editMesh && <primitive object={vertexCloud} onPointerDown={(event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation();
      if (typeof event.index === 'number') onSelectVertex(editMesh, event.index, event.shiftKey);
    }} />}
    {faceHighlight && <primitive object={faceHighlight} />}
    {!playing && tool === 'select' && !editMode && selected && <TransformControls
      object={selected}
      mode={transformMode}
      space={transformSpace}
      translationSnap={gridSnap ? .1 : null}
      rotationSnap={gridSnap ? Math.PI / 12 : null}
      scaleSnap={gridSnap ? .1 : null}
      size={.8}
      onMouseDown={() => onTransformStart(selected)}
      onMouseUp={() => onTransformEnd(selected)}
    />}
    {showRig && <primitive object={helper} />}
    {highlight && tool === 'select' && <primitive object={highlight} />}
    {bone && showRig && <BoneMarker bone={bone} />}
    <OrbitControls makeDefault target={framing.center} enabled={tool === 'select'}
      minDistance={framing.size / 20} maxDistance={Math.max(40, framing.size * 8)} />
  </>;
}

function BoneMarker({ bone }: { bone: THREE.Bone }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => { if (ref.current) bone.getWorldPosition(ref.current.position); });
  return <mesh ref={ref}><sphereGeometry args={[.025, 12, 8]} /><meshBasicMaterial color="#ffbd67" depthTest={false} /></mesh>;
}

export type ModelingViewportProps = {
  document: ModelingDocument; selected: THREE.Object3D | null; bone: THREE.Bone | null;
  showRig: boolean; wireframe: boolean; tool: ModelingTool; clip: number; playing: boolean; revision: number; frameRequest: number;
  editMode: boolean; editMesh: THREE.Mesh | null; selectedVertices: number[]; selectedFaces: number[];
  transformMode: ModelingTransformMode; transformSpace: 'local' | 'world'; gridSnap: boolean;
  onSelect: (object: THREE.Object3D) => void;
  onSelectFace: (mesh: THREE.Mesh, face: number, additive: boolean) => void;
  onSelectVertex: (mesh: THREE.Mesh, vertex: number, additive: boolean) => void;
  onTransformStart: (object: THREE.Object3D) => void;
  onTransformEnd: (object: THREE.Object3D) => void;
  onBrush: (mesh: THREE.Mesh, point: THREE.Vector3) => void;
  onStrokeEnd: () => void;
};

export function ModelingViewport(props: ModelingViewportProps) {
  return <SceneWebGLBoundary fallback={
    <div className="modeling-viewport-fallback" role="status">
      <strong>WebGL 2 is unavailable in this browser</strong>
      <p>Enable hardware acceleration for the interactive model, rig overlay, and brush tools.</p>
      <p>Modular building, numeric editing, GLB/glTF import/export, and saving to your scene are still available.</p>
    </div>
  }>
    <Canvas className="modeling-canvas" camera={{ position: [2.4, 1.7, 3.5], fov: 42 }} dpr={[1, 1.5]}
      onPointerMissed={() => props.onStrokeEnd()}>
      <ModelScene {...props} />
    </Canvas>
  </SceneWebGLBoundary>;
}
