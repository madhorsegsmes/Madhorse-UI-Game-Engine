import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { ModelingShell } from './modeling-shell';
import { ModelingViewport, type ModelingTool } from './modeling-viewport';
import {
  appendRigBone, createModularCharacter, DEFAULT_CHARACTER_OPTIONS, disposeModelingDocument,
  documentBones, documentMeshes, normalizeVertexInfluence,
  type CharacterOptions, type ModelingDocument,
} from '@/lib/modeling-document';
import { downloadModelingFile, exportModelingDocument, importModelingFiles } from '@/lib/modeling-io';
import { createPrimitiveGeometry } from '@/lib/scene-view-geometry';
import type { PrimitiveShape } from '@/lib/scene-model';
import { beginSystemActivity } from '@/lib/system-activity';

type HistoryAction = { undo: () => void; redo: () => void };
type AttributeSnapshot = { position: Float32Array; weights?: Float32Array; indices?: Uint16Array };
type Props = {
  onClose: () => void;
  onSave: (file: File) => Promise<void>;
  initialSource?: { url: string; name: string };
};
const axisNames = ['x', 'y', 'z'] as const;

function takeSnapshot(mesh: THREE.Mesh): AttributeSnapshot {
  const geometry = mesh.geometry;
  return {
    position: new Float32Array(geometry.getAttribute('position').array),
    ...(geometry.hasAttribute('skinWeight') ? {
      weights: new Float32Array(geometry.getAttribute('skinWeight').array),
      indices: new Uint16Array(geometry.getAttribute('skinIndex').array),
    } : {}),
  };
}

function restoreSnapshot(mesh: THREE.Mesh, snapshot: AttributeSnapshot) {
  const geometry = mesh.geometry;
  geometry.getAttribute('position').array.set(snapshot.position);
  geometry.getAttribute('position').needsUpdate = true;
  if (snapshot.weights && snapshot.indices) {
    geometry.getAttribute('skinWeight').array.set(snapshot.weights);
    geometry.getAttribute('skinIndex').array.set(snapshot.indices);
    geometry.getAttribute('skinWeight').needsUpdate = true;
    geometry.getAttribute('skinIndex').needsUpdate = true;
  }
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
}

export default function ModelingWorkspace({ onClose, onSave, initialSource }: Props) {
  const [model, setModel] = useState<ModelingDocument | null>(null);
  const [options, setOptions] = useState<CharacterOptions>(DEFAULT_CHARACTER_OPTIONS);
  const [selected, setSelected] = useState<THREE.Object3D | null>(null);
  const [bone, setBone] = useState<THREE.Bone | null>(null);
  const [tool, setTool] = useState<ModelingTool>('select');
  const [showRig, setShowRig] = useState(true);
  const [wireframe, setWireframe] = useState(false);
  const [radius, setRadius] = useState(.12);
  const [strength, setStrength] = useState(.2);
  const [subtract, setSubtract] = useState(false);
  const [clip, setClip] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [frameRequest, setFrameRequest] = useState(0);
  const [status, setStatus] = useState('Preparing modeling workspace…');
  const input = useRef<HTMLInputElement>(null);
  const history = useRef<{ undo: HistoryAction[]; redo: HistoryAction[] }>({ undo: [], redo: [] });
  const stroke = useRef(new Map<THREE.Mesh, AttributeSnapshot>());
  const originalMaterials = useRef(new Map<THREE.Mesh, {
    material: THREE.Material | THREE.Material[];
    color: THREE.BufferAttribute | THREE.InterleavedBufferAttribute | undefined;
  }>());
  const changed = useCallback(() => { setDirty(true); setRevision((value) => value + 1); }, []);
  const restoreMaterials = useCallback(() => {
    originalMaterials.current.forEach(({ material, color }, mesh) => {
      if (mesh.material !== material) (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((item) => item.dispose());
      mesh.material = material;
      if (color) mesh.geometry.setAttribute('color', color);
      else mesh.geometry.deleteAttribute('color');
    });
    originalMaterials.current.clear();
  }, []);
  const replaceModel = useCallback((next: ModelingDocument) => {
    restoreMaterials();
    history.current = { undo: [], redo: [] };
    stroke.current.clear();
    setModel(next); setSelected(next.root); setBone(documentBones(next.root)[0] ?? null);
    setPlaying(false); setClip(0); setTool('select'); setRevision((value) => value + 1);
  }, [restoreMaterials]);

  useEffect(() => {
    let cancelled = false;
    const finish = beginSystemActivity('Preparing modeling workspace');
    void (async () => {
      try {
        let next: ModelingDocument;
        if (initialSource) {
          const response = await fetch(initialSource.url);
          if (!response.ok) throw new Error('Could not load the selected model from this browser.');
          const file = new File([await response.blob()], initialSource.name);
          next = await importModelingFiles([file]);
        } else next = createModularCharacter(DEFAULT_CHARACTER_OPTIONS);
        if (cancelled) { disposeModelingDocument(next); return; }
        replaceModel(next);
        setStatus(initialSource ? 'Selected model loaded as a working copy. Save copy to scene preserves the original.' : 'Rigged modular human ready. Changes stay in this workspace until you save a copy to the scene.');
      } catch (error) {
        if (!cancelled) setStatus(error instanceof Error ? error.message : 'Could not prepare the model.');
      } finally { finish(); }
    })();
    return () => { cancelled = true; };
  }, [initialSource, replaceModel]);
  useEffect(() => () => { restoreMaterials(); if (model) disposeModelingDocument(model); }, [model, restoreMaterials]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  useEffect(() => {
    restoreMaterials();
    if (!model || tool !== 'weights' || !bone) return;
    for (const mesh of documentMeshes(model.root)) {
      if (!(mesh instanceof THREE.SkinnedMesh)) continue;
      const boneIndex = mesh.skeleton.bones.findIndex((item) => item === bone || item.name === bone.name);
      if (boneIndex < 0) continue;
      const indices = mesh.geometry.getAttribute('skinIndex');
      const weights = mesh.geometry.getAttribute('skinWeight');
      const colors = new Float32Array(weights.count * 3);
      for (let vertex = 0; vertex < weights.count; vertex++) {
        let influence = 0;
        for (let channel = 0; channel < 4; channel++) {
          if (indices.array[vertex * 4 + channel] === boneIndex) influence += weights.array[vertex * 4 + channel];
        }
        const color = new THREE.Color().setHSL((1 - influence) * .66, .95, .5);
        colors.set([color.r, color.g, color.b], vertex * 3);
      }
      originalMaterials.current.set(mesh, { material: mesh.material, color: mesh.geometry.getAttribute('color') });
      mesh.geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      mesh.material = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
    }
    return restoreMaterials;
  }, [model, tool, bone, revision, restoreMaterials]);

  const push = (action: HistoryAction) => {
    history.current.undo.push(action);
    if (history.current.undo.length > 16) history.current.undo.shift();
    history.current.redo = [];
    changed();
  };
  const finishStroke = () => {
    if (!stroke.current.size) return;
    const entries = [...stroke.current].map(([mesh, before]) => ({ mesh, before, after: takeSnapshot(mesh) }));
    stroke.current.clear();
    push({
      undo: () => entries.forEach(({ mesh, before }) => restoreSnapshot(mesh, before)),
      redo: () => entries.forEach(({ mesh, after }) => restoreSnapshot(mesh, after)),
    });
    setStatus('Brush stroke applied. Undo is available.');
  };
  const brush = (mesh: THREE.Mesh, point: THREE.Vector3) => {
    if (busy || playing) return;
    if (tool === 'weights' && (!(mesh instanceof THREE.SkinnedMesh) || !bone)) {
      setStatus('Select a bone and paint a skinned mesh. Static meshes do not contain skin weights.');
      return;
    }
    const skinned = mesh instanceof THREE.SkinnedMesh ? mesh : null;
    const boneIndex = skinned && bone ? skinned.skeleton.bones.findIndex((item) => item === bone || item.name === bone.name) : -1;
    if (tool === 'weights' && boneIndex < 0) return;
    if (!stroke.current.has(mesh)) stroke.current.set(mesh, takeSnapshot(mesh));
    model?.root.updateMatrixWorld(true);
    skinned?.skeleton.update();
    const positions = mesh.geometry.getAttribute('position');
    const normals = mesh.geometry.getAttribute('normal');
    const vertex = new THREE.Vector3();
    for (let index = 0; index < positions.count; index++) {
      vertex.fromBufferAttribute(positions, index);
      if (skinned) skinned.applyBoneTransform(index, vertex);
      mesh.localToWorld(vertex);
      const distance = vertex.distanceTo(point);
      if (distance > radius) continue;
      const falloff = (1 - distance / radius) * strength * (subtract ? -1 : 1);
      if (tool === 'weights' && skinned) normalizeVertexInfluence(skinned, index, boneIndex, falloff);
      else if (tool === 'sculpt' && normals) positions.setXYZ(index,
        positions.getX(index) + normals.getX(index) * falloff * .012,
        positions.getY(index) + normals.getY(index) * falloff * .012,
        positions.getZ(index) + normals.getZ(index) * falloff * .012,
      );
    }
    if (tool === 'sculpt') {
      positions.needsUpdate = true; mesh.geometry.computeVertexNormals(); mesh.geometry.computeBoundingSphere();
    }
    changed();
  };
  const perform = async (operation: () => Promise<void>) => {
    finishStroke(); setBusy(true);
    const finish = beginSystemActivity('Processing modeling asset');
    restoreMaterials();
    try { await operation(); }
    catch (error) { setStatus(error instanceof Error ? error.message : 'Model operation failed.'); }
    finally { finish(); setBusy(false); setRevision((value) => value + 1); }
  };
  const exportFile = (binary: boolean, saveToScene = false) => {
    if (!model || playing) return;
    void perform(async () => {
      const file = await exportModelingDocument(model, binary);
      if (saveToScene) {
        await onSave(file); setDirty(false);
        setStatus('A new model copy, including its rig and animation clips, was saved to the scene and this browser’s asset data.');
      } else { downloadModelingFile(file); setStatus(`${file.name} exported with supported materials, skin weights, bones, and clips.`); }
    });
  };
  const importFiles = (files: File[]) => {
    if (!files.length || (dirty && !window.confirm('Replace this unsaved workspace draft? The main scene and imported files will not be changed.'))) return;
    void perform(async () => {
      const next = await importModelingFiles(files);
      replaceModel(next); setDirty(true); setStatus(`Imported ${next.name}: ${documentBones(next.root).length} bones and ${next.clips.length} animation clips.`);
    });
  };
  const updateTransform = (object: THREE.Object3D, property: 'position' | 'rotation' | 'scale', axis: 'x' | 'y' | 'z', value: number) => {
    if (!Number.isFinite(value) || playing || busy) return;
    if (property === 'rotation') value = THREE.MathUtils.degToRad(value);
    if (property === 'scale') value = Math.max(.01, Math.min(20, value));
    const previous = object[property][axis];
    object[property][axis] = value;
    push({ undo: () => { object[property][axis] = previous; }, redo: () => { object[property][axis] = value; } });
  };
  const addPrimitive = (shape: PrimitiveShape) => {
    if (!model) return;
    const mesh = new THREE.Mesh(createPrimitiveGeometry(shape), new THREE.MeshStandardMaterial({ color: '#a69abd', roughness: .6 }));
    mesh.name = `${shape}_${documentMeshes(model.root).length + 1}`;
    mesh.position.set(.7, .7, 0);
    model.root.add(mesh); setSelected(mesh);
    push({ undo: () => mesh.removeFromParent(), redo: () => { model.root.add(mesh); } });
  };
  const transformFields = (object: THREE.Object3D, property: 'position' | 'rotation' | 'scale', title: string) => (
    <fieldset disabled={busy || playing}><legend>{title}</legend><div className="modeling-row">
      {axisNames.map((axis) => <label key={axis}>{axis.toUpperCase()}<input aria-label={`${title} ${axis}`} type="number"
        step={property === 'rotation' ? 1 : .01}
        value={Number((property === 'rotation' ? THREE.MathUtils.radToDeg(object[property][axis]) : object[property][axis]).toFixed(3))}
        onChange={(event) => updateTransform(object, property, axis, Number(event.target.value))} /></label>)}
    </div></fieldset>
  );
  const close = () => {
    if (busy) { setStatus('Wait for the current import, export, or save to finish before closing.'); return; }
    finishStroke();
    if (dirty && !window.confirm('Close without saving this workspace draft? Save a copy to the scene or export GLB to keep your edits.')) return;
    onClose();
  };
  const bones = model ? documentBones(model.root) : [];
  const meshes = model ? documentMeshes(model.root) : [];
  return <ModelingShell onClose={close} status={status}
    toolbar={<>
      <button disabled={busy} onClick={() => input.current?.click()}>Import GLB / glTF</button>
      <button disabled={!model || busy || playing} onClick={() => exportFile(true)}>Export GLB</button>
      <button disabled={!model || busy || playing} onClick={() => exportFile(false)}>Export glTF</button>
      <button disabled={!model || busy || playing} onClick={() => exportFile(true, true)} data-testid="modeling-save-scene">Save copy to scene</button>
      <button disabled={!model} onClick={() => setFrameRequest((value) => value + 1)}>Frame model</button>
      <button disabled={!history.current.undo.length || busy || playing} onClick={() => {
        finishStroke(); const action = history.current.undo.pop(); action?.undo(); if (action) history.current.redo.push(action); changed();
        if (selected && !model?.root.getObjectByProperty('uuid', selected.uuid)) setSelected(model?.root ?? null);
        if (bone && !model?.root.getObjectByProperty('uuid', bone.uuid)) setBone(model ? documentBones(model.root)[0] ?? null : null);
      }}>Undo</button>
      <button disabled={!history.current.redo.length || busy || playing} onClick={() => {
        const action = history.current.redo.pop(); action?.redo(); if (action) history.current.undo.push(action); changed();
      }}>Redo</button>
    </>}
    leftPanel={<div className="modeling-stack">
      <fieldset disabled={busy || playing}><legend>Workspace tools</legend><div className="modeling-row">
        {(['select', 'sculpt', 'weights'] as const).map((mode) => <button key={mode} aria-pressed={tool === mode}
          onClick={() => { finishStroke(); setTool(mode); }}>{mode === 'select' ? 'Orbit / select' : mode === 'sculpt' ? 'Sculpt surface' : 'Paint weights'}</button>)}
      </div><p>Orbit: drag to rotate, right-drag to pan, wheel/pinch to zoom. Brush tools: drag on the surface; return to Orbit to navigate.</p></fieldset>
      <fieldset disabled={busy || playing}><legend>Modeling</legend><div className="modeling-row">
        {(['rounded-cube', 'sphere', 'capsule'] as const).map((shape) => <button key={shape} onClick={() => addPrimitive(shape)}>Add {shape}</button>)}
      </div><label><input type="checkbox" checked={wireframe} onChange={(event) => setWireframe(event.target.checked)} />Wireframe</label></fieldset>
      {tool !== 'select' && <fieldset disabled={busy || playing}><legend>{tool === 'weights' ? 'Weight brush' : 'Sculpt brush'}</legend>
        <label>Radius (m)<input type="range" min=".02" max=".4" step=".01" value={radius} onChange={(event) => setRadius(Number(event.target.value))} />{radius.toFixed(2)}</label>
        <label>Strength<input type="range" min=".01" max="1" step=".01" value={strength} onChange={(event) => setStrength(Number(event.target.value))} />{strength.toFixed(2)}</label>
        <label><input type="checkbox" checked={subtract} onChange={(event) => setSubtract(event.target.checked)} />{tool === 'weights' ? 'Subtract influence' : 'Lower instead of raise'}</label>
        {tool === 'weights' && <p>Selected bone: {bone?.name ?? 'Choose a bone'}. Blue = no influence; red = full influence. Weights normalize after each stroke.</p>}
      </fieldset>}
      <fieldset disabled={busy || playing}><legend>Modular character</legend>
        <label>Height (m)<input type="number" min="1" max="2.5" step=".05" value={options.height}
          onChange={(event) => setOptions({ ...options, height: Math.max(1, Math.min(2.5, Number(event.target.value) || 1.8)) })} /></label>
        <label>Body build<input type="range" min=".75" max="1.3" step=".05" value={options.build} onChange={(event) => setOptions({ ...options, build: Number(event.target.value) })} /></label>
        <div className="modeling-row"><label>Skin<input type="color" value={options.skin} onChange={(event) => setOptions({ ...options, skin: event.target.value })} /></label>
          <label>Clothing<input type="color" value={options.clothing} onChange={(event) => setOptions({ ...options, clothing: event.target.value })} /></label></div>
        <label>Torso module<select value={options.outfit} onChange={(event) => setOptions({ ...options, outfit: event.target.value as CharacterOptions['outfit'] })}>
          <option value="briefs">Base / briefs</option><option value="tunic">Tunic + belt</option><option value="armor">Armor + shoulders</option>
        </select></label>
        {(['helmet', 'boots', 'gloves', 'backpack'] as const).map((slot) => <label key={slot}><input type="checkbox" checked={options[slot]}
          onChange={(event) => setOptions({ ...options, [slot]: event.target.checked })} />{slot[0].toUpperCase() + slot.slice(1)}</label>)}
        <button data-testid="modeling-rebuild" onClick={() => {
          if (dirty && !window.confirm('Rebuild the workspace character with these modules? Unsaved sculpting, imported models, and pose edits in this draft will be replaced. The main scene is unchanged.')) return;
          try { replaceModel(createModularCharacter(options)); setDirty(true); setStatus('Modular character rebuilt with a shared deforming humanoid rig.'); }
          catch (error) { setStatus(error instanceof Error ? error.message : 'Could not rebuild character.'); }
        }}>Build modular character</button>
        <p>Rebuild replaces this workspace draft only. Every equipped module is attached to the shared rig.</p>
      </fieldset>
      <fieldset><legend>Blender exchange</legend><p>In Blender, export glTF 2.0 as GLB with skinning and animations enabled. For .gltf, select the JSON, .bin, and textures together here.</p>
        <p>Open exported files in Blender using File → Import → glTF 2.0. Native .blend files, Blender-only constraints, drivers, modifiers, and procedural shaders are not edited here. Apply or bake them in Blender.</p></fieldset>
    </div>}
    rightPanel={<div className="modeling-stack">
      {model && <label>Model name<input value={model.name} onChange={(event) => { model.name = event.target.value; changed(); }} /></label>}
      <fieldset><legend>Scene objects · {meshes.length}</legend><select aria-label="Select model object" value={selected?.uuid ?? ''}
        onChange={(event) => setSelected(model?.root.getObjectByProperty('uuid', event.target.value) ?? null)}>
        {model && <option value={model.root.uuid}>Whole model</option>}
        {meshes.map((mesh) => <option key={mesh.uuid} value={mesh.uuid}>{mesh.name || 'Mesh'}</option>)}
      </select></fieldset>
      {selected && <>
        <h3>{selected.name || 'Selected object'}</h3>
        {transformFields(selected, 'position', selected instanceof THREE.Bone ? 'Joint local offset (m)' : 'Local position (m)')}
        {transformFields(selected, 'rotation', 'Local rotation (degrees)')}
        {!(selected instanceof THREE.Bone) && transformFields(selected, 'scale', 'Local scale')}
        {selected instanceof THREE.Mesh && <fieldset disabled={busy || playing}><legend>Object actions</legend>
          <button onClick={() => {
            const object = selected; const parent = object.parent; if (!parent) return;
            object.removeFromParent(); setSelected(model?.root ?? null);
            push({ undo: () => { parent.add(object); }, redo: () => { object.removeFromParent(); } });
          }}>Remove from workspace</button>
          <p>The source asset and your main scene are not changed.</p>
        </fieldset>}
      </>}
      <fieldset disabled={busy || playing}><legend>Humanoid rig · {bones.length} bones</legend>
        <label><input type="checkbox" checked={showRig} onChange={(event) => setShowRig(event.target.checked)} />Show skeleton</label>
        {!bones.length && <p>This imported model has no rig. Build the modular character for a ready humanoid rig, or add a rig in Blender and reimport.</p>}
        <ul className="modeling-bone-list">{bones.map((joint) => <li key={joint.uuid}><button className={bone === joint ? 'modeling-selected' : ''} onClick={() => { setBone(joint); setSelected(joint); }}>
          {joint.name || 'Unnamed joint'} <small>{joint.parent instanceof THREE.Bone ? `← ${joint.parent.name}` : '· root'}</small>
        </button></li>)}</ul>
        <button disabled={!bone || !model} onClick={() => {
          if (!bone || !model) return;
          const action = appendRigBone(model.root, bone); setBone(action.bone); setSelected(action.bone); push(action);
          setStatus(`${action.bone.name} added. Paint its influence to make it deform the mesh.`);
        }}>Add child joint</button>
        <button disabled={!model || !bones.length} onClick={() => {
          if (!model) return;
          const before = bones.map((joint) => ({ joint, position: joint.position.clone(), quaternion: joint.quaternion.clone(), scale: joint.scale.clone() }));
          const skeletons = new Set(meshes.filter((mesh): mesh is THREE.SkinnedMesh => mesh instanceof THREE.SkinnedMesh).map((mesh) => mesh.skeleton));
          skeletons.forEach((skeleton) => skeleton.pose());
          const after = bones.map((joint) => ({ joint, position: joint.position.clone(), quaternion: joint.quaternion.clone(), scale: joint.scale.clone() }));
          const apply = (poses: typeof before) => poses.forEach(({ joint, position, quaternion, scale }) => {
            joint.position.copy(position); joint.quaternion.copy(quaternion); joint.scale.copy(scale);
          });
          push({ undo: () => apply(before), redo: () => apply(after) });
        }}>Reset bind pose</button>
      </fieldset>
      <fieldset disabled={busy}><legend>Animation preview</legend>
        <select aria-label="Animation clip" value={clip} onChange={(event) => { setPlaying(false); setClip(Number(event.target.value)); }}>
          {model?.clips.length ? model.clips.map((animation, index) => <option key={`${animation.name}-${index}`} value={index}>{animation.name}</option>) : <option>No animation clips</option>}
        </select>
        <button disabled={!model?.clips.length} aria-pressed={playing} onClick={() => setPlaying(!playing)}>{playing ? 'Stop preview' : 'Play clip'}</button>
        <button disabled={!model || !bones.length || playing} onClick={() => {
          if (!model) return;
          const tracks = bones.flatMap((joint) => [
            new THREE.QuaternionKeyframeTrack(`${joint.uuid}.quaternion`, [0, 1], [...joint.quaternion.toArray(), ...joint.quaternion.toArray()]),
            new THREE.VectorKeyframeTrack(`${joint.uuid}.position`, [0, 1], [...joint.position.toArray(), ...joint.position.toArray()]),
            new THREE.VectorKeyframeTrack(`${joint.uuid}.scale`, [0, 1], [...joint.scale.toArray(), ...joint.scale.toArray()]),
          ]);
          const animation = new THREE.AnimationClip(`Saved pose ${model.clips.length + 1}`, 1, tracks);
          model.clips.push(animation); setClip(model.clips.length - 1);
          push({ undo: () => { model.clips = model.clips.filter((item) => item !== animation); setClip(0); }, redo: () => { model.clips.push(animation); } });
          setStatus('Pose stored as an animation clip and included in GLB/glTF exports.');
        }}>Store current pose as clip</button>
      </fieldset>
      <p>{dirty ? 'Unsaved workspace edits' : 'No unsaved model edits'} · Save copy to scene keeps the model and embedded clips in this browser.</p>
    </div>}
  >
    <input ref={input} type="file" multiple accept=".glb,.gltf,.bin,.png,.jpg,.jpeg,.webp" hidden onChange={(event) => {
      const files = Array.from(event.target.files ?? []); event.target.value = ''; importFiles(files);
    }} />
    {model ? <ModelingViewport document={model} selected={selected} bone={bone} showRig={showRig} wireframe={wireframe}
      tool={tool} clip={clip} playing={playing} revision={revision} frameRequest={frameRequest} onSelect={setSelected} onBrush={brush} onStrokeEnd={finishStroke} />
      : <div className="modeling-viewport-fallback"><strong>Model workspace</strong><p>{status}</p><button onClick={() => input.current?.click()}>Choose GLB / glTF</button></div>}
  </ModelingShell>;
}
