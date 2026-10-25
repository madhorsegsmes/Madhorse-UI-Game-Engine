import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import * as THREE from 'three';
import { PhysicsDebugOptions } from '../../src/components/physics-debug-options';
import { PHYSICS_DEBUG_KEY, usePhysicsDebugSettings } from '../../src/hooks/use-physics-debug-settings';
import { collectPhysicsDebugBoxes, writePhysicsBoxLines } from '../../src/lib/physics-debug-shapes';
import { createStarterCube, getPhysicsComponent, getTransform } from '../../src/lib/scene-model';
const status = document.getElementById('verification')!;
const previous = localStorage.getItem(PHYSICS_DEBUG_KEY);
let changeAvailability: (available: boolean) => void;
function OptionsFixture() {
  const [available, setAvailable] = useState(true);
  changeAvailability = setAvailable;
  return <PhysicsDebugOptions available={available} />;
}
const fixtures = ['static', 'dynamic', 'kinematic'].map((type, index) => {
  const entity = { ...createStarterCube(), id: `body-${index}`, name: type };
  Object.assign(getTransform(entity), { position: { x: 35 + index * 15, y: 50, z: 8 }, scale: { x: 1, y: 1, z: 1 } });
  Object.assign(getPhysicsComponent(entity)!, { enabled: true, colliderEnabled: true, bodyType: type, size: { x: 10, y: 10, z: 16 } });
  return entity;
});
function Preview() {
  const [settings] = usePhysicsDebugSettings();
  const [selectedId, select] = useState<string | null>('body-1');
  const report = settings.enabled ? collectPhysicsDebugBoxes(fixtures, selectedId, settings.selectedOnly, true) : { boxes: [], total: 0 };
  const positions = new Float32Array(report.boxes.length * 72), colors = new Float32Array(positions.length);
  const vertices = writePhysicsBoxLines(report.boxes, positions, colors);
  const camera = new THREE.PerspectiveCamera(45, 560 / 280, .1, 100);
  camera.position.set(6, 5, 9); camera.lookAt(0, .5, 0); camera.updateMatrixWorld(true);
  const lines = [];
  for (let vertex = 0; vertex < vertices; vertex += 2) {
    const a = new THREE.Vector3().fromArray(positions, vertex * 3).project(camera);
    const b = new THREE.Vector3().fromArray(positions, (vertex + 1) * 3).project(camera);
    const color = new THREE.Color().fromArray(colors, vertex * 3);
    lines.push(<line key={vertex} x1={(a.x + 1) * 280} y1={(1 - a.y) * 140} x2={(b.x + 1) * 280} y2={(1 - b.y) * 140} stroke={`#${color.getHexString()}`} />);
  }
  return <><label>Fixture selection <select aria-label="Fixture selected object" value={selectedId ?? ''}
    onChange={event => select(event.target.value || null)}><option value="">None</option>{fixtures.map(entity => <option key={entity.id} value={entity.id}>{entity.name}</option>)}</select></label>
    <p id="count">{report.total} eligible boxes</p><svg viewBox="0 0 560 280" style={{ width: 560, border: '1px solid #594365' }}>{lines}</svg>
    <small>GPU-free projection of the actual collision-guide vertex/color buffers. This does not verify WebGL rendering.</small></>;
}
try {
  localStorage.setItem(PHYSICS_DEBUG_KEY, '{invalid');
  flushSync(() => createRoot(document.getElementById('root')!).render(<><OptionsFixture /><Preview /></>));
  const checkbox = (label: string) => document.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;
  if (checkbox('Show physics boxes').checked || !checkbox('Selected physics object only').disabled) throw new Error('Defaults/recovery failed.');
  flushSync(() => checkbox('Show physics boxes').click());
  if (document.getElementById('count')!.textContent !== '3 eligible boxes' || document.querySelectorAll('svg line').length !== 36) throw new Error('All-object guides failed.');
  flushSync(() => checkbox('Selected physics object only').click());
  if (document.getElementById('count')!.textContent !== '1 eligible boxes') throw new Error('Selected-only mode failed.');
  const select = document.querySelector<HTMLSelectElement>('[aria-label="Fixture selected object"]')!;
  select.value = ''; flushSync(() => select.dispatchEvent(new Event('change', { bubbles: true })));
  if (document.getElementById('count')!.textContent !== '0 eligible boxes') throw new Error('Empty selection failed.');
  flushSync(() => checkbox('See physics boxes through models').click());
  const saved = JSON.parse(localStorage.getItem(PHYSICS_DEBUG_KEY)!);
  if (!saved.enabled || !saved.selectedOnly || saved.seeThrough) throw new Error('Preference persistence failed.');
  flushSync(() => checkbox('Selected physics object only').click());
  flushSync(() => checkbox('Show physics boxes').click());
  if (document.querySelectorAll('svg line').length) throw new Error('Disabling guides did not clear geometry.');
  flushSync(() => checkbox('Show physics boxes').click());
  flushSync(() => changeAvailability(false));
  if (!checkbox('Show physics boxes').disabled || !checkbox('Selected physics object only').disabled) throw new Error('Unsupported 2D view did not disable 3D guides.');
  flushSync(() => changeAvailability(true));
  status.textContent = 'PASS — actual settings controls, live preferences, persistence, selected/empty selection, disable/restore and guide buffers.';
  status.style.color = '#8dffc4';
} catch (error) { status.textContent = `FAIL — ${error instanceof Error ? error.message : error}`; console.error(error); }
finally { if (previous === null) localStorage.removeItem(PHYSICS_DEBUG_KEY); else localStorage.setItem(PHYSICS_DEBUG_KEY, previous); }
