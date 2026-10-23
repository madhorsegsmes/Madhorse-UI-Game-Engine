import { useState } from 'react';
import type { GameCamera } from '@/lib/game-camera';
import { cameraEuler, cameraWithPose } from '@/lib/camera-editor';
import './scene-camera-controls.css';

type Field = 'px' | 'py' | 'pz' | 'rx' | 'ry' | 'rz' | 'fov';

/** Numeric primary camera editor. Works without WebGL. */
export function SceneCameraControls({ camera, readOnly, selected, onSelect, onChange, onViewThrough, onResetNorth }: {
  camera: GameCamera; readOnly: boolean; selected: boolean;
  onSelect?: () => void;
  onChange: (camera: GameCamera) => void;
  onViewThrough: () => void;
  onResetNorth: () => void;
}) {
  const euler = cameraEuler(camera);
  const values: Record<Field, number> = {
    px: camera.position.x, py: camera.position.y, pz: camera.position.z,
    rx: euler.x, ry: euler.y, rz: euler.z, fov: camera.fov,
  };
  const [draft, setDraft] = useState<Partial<Record<Field, string>>>({});
  const [error, setError] = useState('');
  const commit = (field: Field) => {
    const raw = draft[field];
    setDraft((current) => { const next = { ...current }; delete next[field]; return next; });
    if (raw === undefined || raw.trim() === '') return;
    const value = Number(raw);
    if (!Number.isFinite(value)) { setError('Enter a finite number.'); return; }
    if (field === 'fov' && (value < 10 || value > 100)) { setError('FOV must be between 10 and 100 degrees.'); return; }
    if (field.startsWith('p') && Math.abs(value) > 100_000) { setError('Position must be within 100000 m of the origin.'); return; }
    const v = { ...values, [field]: value };
    const next = field === 'fov'
      ? cameraWithPose(camera, { fov: value })
      : field.startsWith('p')
        ? cameraWithPose(camera, { position: { x: v.px, y: v.py, z: v.pz } })
        : cameraWithPose(camera, { rotation: { x: v.rx, y: v.ry, z: v.rz } });
    if (!next) { setError(field === 'fov' ? 'FOV must be 10 to 100.' : 'That pose is not valid.'); return; }
    setError('');
    onChange(next);
  };
  const input = (field: Field, label: string, step: number) => (
    <label key={field}>
      <span>{label}</span>
      <input type="number" inputMode="decimal" step={step} disabled={readOnly}
        data-testid={`camera-input-${field}`} aria-label={`Game camera ${label}`}
        value={draft[field] ?? String(Math.round(values[field] * 100) / 100)}
        onChange={(event) => setDraft((current) => ({ ...current, [field]: event.target.value }))}
        onBlur={() => commit(field)}
        onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); commit(field); } }} />
    </label>
  );
  return (
    <details className="mh-camctl" data-testid="scene-camera-controls">
      <summary>
        <span className="mh-camctl__tag">CAM</span> Game Camera
        <small>{readOnly ? 'locked' : 'm · deg'}</small>
      </summary>
      <div className="mh-camctl__body">
        <div className="mh-camctl__row"><b>POS</b>{input('px', 'X', 0.1)}{input('py', 'Y', 0.1)}{input('pz', 'Z', 0.1)}</div>
        <div className="mh-camctl__row"><b>ROT</b>{input('rx', 'Pitch X', 1)}{input('ry', 'Yaw Y', 1)}{input('rz', 'Roll Z', 1)}</div>
        <div className="mh-camctl__row"><b>LENS</b>{input('fov', 'FOV', 1)}</div>
        <div className="mh-camctl__actions">
          {onSelect && <button type="button" onClick={onSelect} aria-pressed={selected} data-testid="scene-select-game-camera">
            {selected ? 'Camera selected' : 'Select Game Camera'}</button>}
          <button type="button" onClick={onViewThrough} disabled={readOnly} data-testid="scene-camera-view-through">View through camera</button>
          <button type="button" onClick={() => { setDraft({}); setError(''); onResetNorth(); }} disabled={readOnly} data-testid="scene-camera-reset-north">Reset north</button>
        </div>
        {error && <small role="alert" className="mh-camctl__error">{error}</small>}
      </div>
    </details>
  );
}
