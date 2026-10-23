import { useState } from 'react';
import { isGameCamera, type GameCamera } from '@/lib/game-camera';

const axes = ['x', 'y', 'z'] as const;
type Field = 'px' | 'py' | 'pz' | 'tx' | 'ty' | 'tz' | 'fov';
const cameraValues = (camera: GameCamera): Record<Field, string> => ({
  px: String(camera.position.x), py: String(camera.position.y), pz: String(camera.position.z),
  tx: String(camera.target.x), ty: String(camera.target.y), tz: String(camera.target.z),
  fov: String(camera.fov),
});

/** Keep partial numbers out of the saved project until the entire pose is valid. */
export function GameCameraSettings({ camera, readOnly, onChange, onReset }: {
  camera: GameCamera;
  readOnly: boolean;
  onChange: (camera: GameCamera) => void;
  onReset: () => void;
}) {
  const [draft, setDraft] = useState<Partial<Record<Field, string>>>({});
  const [error, setError] = useState('');
  const values = { ...cameraValues(camera), ...draft };
  const input = (field: Field, label: string) => (
    <label key={field}>
      <span>{label}</span>
      <input type="number" inputMode="decimal" step="any" required
        min={field === 'fov' ? 10 : -100000} max={field === 'fov' ? 100 : 100000}
        aria-label={`Game camera ${label}`} data-testid={`game-camera-${field}`}
        value={values[field]}
        onChange={(event) => setDraft((current) => ({ ...current, [field]: event.target.value }))} />
    </label>
  );
  return (
    <form className="game-camera-settings" noValidate onSubmit={(event) => {
      event.preventDefault();
      if (readOnly) return;
      if (Object.values(values).some((value) => !value.trim() || !Number.isFinite(Number(value)))) {
        setError('Enter a finite number in every camera field.'); return;
      }
      const next: GameCamera = {
        position: { x: Number(values.px), y: Number(values.py), z: Number(values.pz) },
        target: { x: Number(values.tx), y: Number(values.ty), z: Number(values.tz) },
        fov: Number(values.fov), placement: 'custom',
      };
      if (next.fov < 10 || next.fov > 100) {
        setError('Field of view must be between 10 and 100 degrees.'); return;
      }
      if (!isGameCamera(next)) {
        setError('Coordinates must be between -100000 and 100000. Position and aim must be at least 0.001 units apart.'); return;
      }
      onChange(next);
      setDraft({});
      setError('');
    }}>
      <fieldset disabled={readOnly}>
        <legend>Position (world units)</legend>
        <div className="game-camera-fields">
          {axes.map((axis) => input(`p${axis}`, `Position ${axis.toUpperCase()}`))}
        </div>
      </fieldset>
      <fieldset disabled={readOnly}>
        <legend>Aim point (world units)</legend>
        <div className="game-camera-fields">
          {axes.map((axis) => input(`t${axis}`, `Aim ${axis.toUpperCase()}`))}
        </div>
      </fieldset>
      <fieldset disabled={readOnly}>
        <legend>Zoom</legend>
        {input('fov', 'Field of view (degrees)')}
        <small>10–100°. Lower values zoom in. Y is up; north is negative Z.</small>
      </fieldset>
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={readOnly} data-testid="apply-game-camera">Apply camera</button>
      <button type="button" disabled={readOnly} data-testid="aim-game-camera" onClick={() => {
        setDraft({}); setError(''); onReset();
      }}>Reset to square</button>
      <small role="status">{readOnly
        ? 'Stop playback to edit the camera. Unavailable project saves also lock these controls.'
        : 'Apply saves to this project in this browser. Objects and the editor camera stay unchanged.'}</small>
    </form>
  );
}
