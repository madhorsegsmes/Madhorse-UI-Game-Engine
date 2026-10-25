import { useEffect, useId, useRef, useState } from 'react';
import { Settings2 } from 'lucide-react';
import { TRANSFORM_STEP_LIMITS, type SceneTransformSettings } from '@/lib/scene-transform-settings';
import './scene-transform-options.css';
type Step = keyof typeof TRANSFORM_STEP_LIMITS;
const labels: Record<Step, string> = { moveStep: 'Move grid (3D units)', turnStep: 'Turn angle (degrees)', scaleStep: 'Size step (ratio)' };
const drafts = (settings: SceneTransformSettings) => ({
  moveStep: String(settings.moveStep), turnStep: String(settings.turnStep), scaleStep: String(settings.scaleStep),
});
export function SceneTransformOptions({ settings, onChange, disabled = false }: {
  settings: SceneTransformSettings; onChange: (settings: SceneTransformSettings) => void; disabled?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [draft, setDraft] = useState(drafts(settings));
  const [error, setError] = useState('');
  useEffect(() => { if (disabled) dialog.current?.close(); }, [disabled]);
  return <div className="mh-transform-options">
    <select aria-label="Transform space" disabled={disabled} value={settings.space}
      title="World: scene axes. Local: object axes. Auto: previous behavior. Scaling always uses local axes."
      onChange={event => onChange({ ...settings, space: event.target.value as SceneTransformSettings['space'] })}>
      <option value="auto">Auto axes</option><option value="world">World</option><option value="local">Local</option>
    </select>
    <label title="Snap gizmo drags to regular steps. Inspector edits and direct camera-icon dragging remain free.">
      <input type="checkbox" aria-label="Snap scene gizmos" disabled={disabled} checked={settings.snap}
        onChange={event => onChange({ ...settings, snap: event.target.checked })} /> Snap
    </label>
    <button type="button" className="mh-transform-options__settings" aria-label="Snap settings" title="Choose snapping steps" disabled={disabled}
      onClick={() => { setDraft(drafts(settings)); setError(''); dialog.current?.showModal(); }}>
      <Settings2 size={13} />
    </button>
    <dialog ref={dialog} className="mh-transform-settings-dialog" aria-labelledby={titleId}>
      <form onSubmit={event => {
        event.preventDefault();
        const next = { ...settings };
        for (const key of Object.keys(labels) as Step[]) {
          const number = Number(draft[key]);
          const [min, max] = TRANSFORM_STEP_LIMITS[key];
          if (!draft[key].trim() || !Number.isFinite(number) || number < min || number > max) {
            setError(`${labels[key]} must be between ${min} and ${max}.`); return;
          }
          next[key] = number;
        }
        onChange(next); dialog.current?.close();
      }}>
        <h3 id={titleId}>Scene snapping</h3>
        <p>Gizmo drags only. One 3D unit is one large grid square. Size steps change the scale ratio, not meters.</p>
        {(Object.keys(labels) as Step[]).map(key => <label key={key}>
          {labels[key]}<input aria-label={labels[key]} type="number" required step="any"
            min={TRANSFORM_STEP_LIMITS[key][0]} max={TRANSFORM_STEP_LIMITS[key][1]}
            value={draft[key]} onChange={event => setDraft(current => ({ ...current, [key]: event.target.value }))} />
        </label>)}
        <p>World uses scene axes; Local uses object axes. Scaling always uses local axes. Scaling through zero restores the previous size.</p>
        {error && <p role="alert">{error}</p>}
        <footer><button type="button" onClick={() => dialog.current?.close()}>Cancel</button><button type="submit" disabled={disabled}>Apply steps</button></footer>
      </form>
    </dialog>
  </div>;
}
