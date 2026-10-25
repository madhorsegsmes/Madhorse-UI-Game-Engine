import { useState, type ReactNode } from 'react';
import type { HierarchyCreationProps } from './hierarchy-creation-contract';
import type { GeneratedAssetOptions, SceneElementKind } from '@/lib/scene-authoring';
import { getCamera, getLight, getPrimitive, isDescendant, type Vector3 } from '@/lib/scene-model';
import './hierarchy-creation-tools.css';

const SIZES = [64, 128, 256, 512] as const;
const HEX = /^#[\da-f]{6}$/i;
type AssetMode = 'cube' | 'sprite' | 'texture';

function Section({ n, title, children, testId }: { n: string; title: string; children: ReactNode; testId: string }) {
  return (
    <section className="hct-section" data-testid={testId} aria-label={title}>
      <h3 className="hct-title"><span className="hct-num">{n}</span>{title}<span className="hct-rule" aria-hidden="true" /></h3>
      {children}
    </section>
  );
}

function ColorField({ label, value, onChange, disabled, testId }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean; testId: string }) {
  return (
    <label className="hct-field hct-color">
      <span>{label}</span>
      <span className="hct-color-ctl">
        <input type="color" value={HEX.test(value) ? value : '#000000'} onChange={(e) => onChange(e.target.value)} disabled={disabled} data-testid={testId} aria-label={label} />
        <code>{value}</code>
      </span>
    </label>
  );
}

export function HierarchyCreationTools(props: HierarchyCreationProps) {
  const { entities, selectedEntityId, prefabs, readOnly, status, activeCameraId } = props;
  const selected = entities.find((e) => e.id === selectedEntityId) ?? null;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const locked = readOnly || busy;

  const [parentId, setParentId] = useState('');
  const [prefabName, setPrefabName] = useState('');
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const [assetMode, setAssetMode] = useState<AssetMode | null>(null);
  const [assetName, setAssetName] = useState('');
  const [color, setColor] = useState('#b73d34');
  const [secondary, setSecondary] = useState('#e8e5e0');
  const [pattern, setPattern] = useState<'solid' | 'checker'>('solid');
  const [size, setSize] = useState<number>(128);

  const report = (msg: string, isError = false) => { setError(isError ? msg : ''); setNote(isError ? '' : msg); };

  const create = (kind: SceneElementKind, label: string) => { if (locked) return; props.onCreate(kind); report(`${label} added to the scene.`); };

  // linking
  const canLink = !!selected && selected.id !== 'player';
  const parentOptions = selected ? entities.filter((e) => e.id !== selected.id && !isDescendant(entities, selected.id, e.id)) : [];
  const parentValid = parentOptions.some((e) => e.id === parentId);
  const currentParent = selected?.parentId ? entities.find((e) => e.id === selected.parentId) : null;
  const link = () => {
    if (!selected || !canLink || !parentValid || locked) return report('Choose a valid parent object.', true);
    props.onSetParent(selected.id, parentId);
    report(`${selected.name} linked under ${entities.find((e) => e.id === parentId)?.name}.`);
    setParentId('');
  };
  const unlink = () => {
    if (!selected || !selected.parentId || locked) return;
    props.onSetParent(selected.id, null); report(`${selected.name} moved to the scene root.`);
  };

  // prefabs
  const prefabTrim = prefabName.trim();
  const prefabValid = !!selected && prefabTrim.length > 0 && prefabTrim.length <= 80;
  const savePrefab = () => {
    if (!prefabValid || locked) return report(selected ? 'Enter a prefab name of 1–80 characters.' : 'Select an object first.', true);
    try { props.onSavePrefab(prefabTrim); report(`Prefab "${prefabTrim}" saved.`); setPrefabName(''); }
    catch (e) { report(e instanceof Error ? e.message : 'Could not save prefab.', true); }
  };

  // assets
  const nameTrim = assetName.trim();
  const assetValid = nameTrim.length > 0 && nameTrim.length <= 80 && HEX.test(color) && HEX.test(secondary) && SIZES.includes(size as 64);
  const openAsset = (mode: AssetMode) => {
    setAssetMode((m) => (m === mode || (mode === 'cube' && m === 'sprite') ? null : mode));
    if (mode === 'texture') setPattern('checker');
    setError('');
  };
  const generate = async () => {
    if (!assetMode || locked) return;
    if (!assetValid) return report('Enter a name (1–80 characters), valid colors and a supported size.', true);
    const options: GeneratedAssetOptions = {
      kind: assetMode, name: nameTrim, color, secondaryColor: secondary,
      pattern: assetMode === 'cube' ? 'solid' : pattern, size,
    };
    setBusy(true); setError('');
    try {
      await props.onGenerateAsset(options);
      report(`${nameTrim}.${assetMode === 'cube' ? 'obj' : 'png'} saved to Assets. Assign it from the Assets or Data panel.`);
      setAssetName('');
    } catch (e) { report(e instanceof Error ? e.message : 'Could not create the asset.', true); }
    finally { setBusy(false); }
  };

  const cameras = entities.filter((e) => { const c = getCamera(e); return c && c.enabled; });
  const primitive = selected ? getPrimitive(selected) : undefined;
  const light = selected ? getLight(selected) : undefined;
  const camera = selected ? getCamera(selected) : undefined;

  const setTarget = (axis: keyof Vector3, raw: string) => {
    if (!selected || !camera) return;
    const v = Number(raw);
    if (raw.trim() === '' || !Number.isFinite(v)) return report(`Camera target ${axis.toUpperCase()} must be a number.`, true);
    setError(''); props.onUpdateCamera(selected.id, { target: { ...camera.target, [axis]: v } });
  };

  return (
    <div className="hct" data-testid="hierarchy-creation-tools" aria-busy={busy}>
      <Section n="2.1" title="CREATE" testId="section-create">
        <div className="hct-grid">
          <button type="button" disabled={locked} onClick={() => create('object', 'Object')} data-testid="button-create-object">Create object</button>
          <button type="button" disabled={locked} onClick={() => create('plane', 'Plane')} data-testid="button-create-plane">Create plane</button>
          <button type="button" disabled={locked} onClick={() => create('terrain', 'Terrain')} data-testid="button-create-terrain">Create terrain</button>
          <button type="button" disabled={locked} onClick={() => create('light', 'Light')} data-testid="button-add-lighting">Add lighting</button>
          <button type="button" disabled={locked} onClick={() => create('camera', 'Camera')} data-testid="button-create-camera">Create camera</button>
          <button type="button" disabled={locked} onClick={() => { if (!locked) { props.onCreateUICanvas(); report('UI canvas added.'); } }} data-testid="button-create-ui-canvas">Create UI canvas</button>
        </div>
      </Section>

      <Section n="2.2" title="LINK" testId="section-link">
        {!selected ? <p className="hct-hint">Select an object in the tree to link it.</p>
          : !canLink ? <p className="hct-hint">The Player cannot be parented to another object.</p>
          : (<>
            <p className="hct-hint">Selected <strong>{selected.name}</strong>{currentParent ? <> · child of <strong>{currentParent.name}</strong></> : ' · at root'}</p>
            <label className="hct-field">
              <span>Parent object</span>
              <select value={parentId} onChange={(e) => setParentId(e.target.value)} disabled={locked} data-testid="select-link-parent">
                <option value="">Choose parent…</option>
                {parentOptions.map((e) => <option key={e.id} value={e.id} disabled={e.id === selected.parentId}>{e.name}</option>)}
              </select>
            </label>
            <div className="hct-row">
              <button type="button" disabled={locked || !parentValid} onClick={link} data-testid="button-link-objects">Link objects</button>
              <button type="button" className="hct-quiet" disabled={locked || !selected.parentId} onClick={unlink} data-testid="button-unlink-object">Unlink object</button>
            </div>
          </>)}
      </Section>

      <Section n="2.3" title="PREFABS" testId="section-prefabs">
        <p className="hct-hint">New placements are linked by ID. Older copies stay independent. Template changes never apply automatically. Saved only in this browser.</p>
        {props.selectedPrefabId && <>
          <button type="button" disabled={locked || !prefabs.some(p => p.id === props.selectedPrefabId)}
            onClick={() => { setNote(''); props.onPreviewPrefabUpdate?.(); }} data-testid="button-preview-prefab-update">Preview update from template</button>
          {!prefabs.some(p => p.id === props.selectedPrefabId) && <p className="hct-hint">Template removed. This instance and its edits are kept.</p>}
        </>}
        {props.prefabUpdate && <div className="hct-confirm" role="alertdialog" aria-label="Preview prefab update">
          <p>Only the selected instance is updated. Custom edits and placement win conflicts. Local deletions stay deleted.
            Objects and components removed from the template are kept for safety. Active camera selection and asset IDs are not reassigned.</p>
          <p>{props.prefabUpdate.affected.length} affected object(s): {props.prefabUpdate.affected.join(', ') || 'None'}.</p>
          {props.prefabUpdate.kept.length > 0 && <p>Removed from template, kept in scene: {props.prefabUpdate.kept.join(', ')}.</p>}
          <button type="button" onClick={() => { setNote(''); props.onCancelPrefabUpdate?.(); }} data-testid="button-cancel-prefab-update">Cancel</button>
          <button type="button" disabled={locked} onClick={() => { setNote(''); props.onConfirmPrefabUpdate?.(); }} data-testid="button-confirm-prefab-update">Apply update</button>
        </div>}
        <label className="hct-field">
          <span>Prefab name {selected ? <>from <strong>{selected.name}</strong> and children</> : '(select an object)'}</span>
          <input type="text" value={prefabName} maxLength={80} onChange={(e) => setPrefabName(e.target.value)} disabled={locked || !selected}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); savePrefab(); } }}
            aria-invalid={prefabName.length > 0 && !prefabValid} placeholder="Stable lantern" data-testid="input-prefab-name" />
        </label>
        <button type="button" className="hct-wide" disabled={locked || !prefabValid} onClick={savePrefab} data-testid="button-create-prefab">Create prefab</button>
        {prefabs.length ? (
          <ul className="hct-list" aria-label="Saved prefabs" data-testid="list-prefabs">
            {prefabs.map((p) => (
              <li key={p.id} data-testid={`row-prefab-${p.id}`}>
                <div className="hct-list-row">
                  <span className="hct-list-name" title={p.name}>{p.name}<small>{p.entities.length} obj</small></span>
                  <button type="button" disabled={locked} onClick={() => { props.onInstantiatePrefab(p.id); report(`${p.name} instance placed.`); }} data-testid={`button-instantiate-prefab-${p.id}`}>Place</button>
                  {props.onRevisePrefab && <button type="button"
                    disabled={locked || !(selectedEntityId === p.rootId || props.selectedPrefabId === p.id)}
                    onClick={() => {
                      if (window.confirm(`Save the selected subtree to template "${p.name}"? Placed instances will not change. You can preview updates separately.`)) {
                        setNote(''); props.onRevisePrefab?.(p.id);
                      }
                    }} data-testid={`button-revise-prefab-${p.id}`}>Save selected to template</button>}
                  <button type="button" className="hct-danger" disabled={locked} onClick={() => setConfirmRemove(p.id)} aria-label={`Remove prefab ${p.name}`} data-testid={`button-remove-prefab-${p.id}`}>Remove</button>
                </div>
                {confirmRemove === p.id && (
                  <div className="hct-confirm" role="alertdialog" aria-label={`Confirm removing ${p.name}`}>
                    <span>Remove <strong>{p.name}</strong>? Placed instances stay in the scene.</span>
                    <div>
                      <button type="button" onClick={() => setConfirmRemove(null)} data-testid={`button-cancel-remove-prefab-${p.id}`}>Cancel</button>
                      <button type="button" className="is-danger" disabled={locked} onClick={() => { props.onRemovePrefab(p.id); setConfirmRemove(null); report(`Prefab ${p.name} removed.`); }} data-testid={`button-confirm-remove-prefab-${p.id}`}>Remove</button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : <p className="hct-hint" data-testid="text-no-prefabs">No prefabs saved yet.</p>}
      </Section>

      <Section n="2.4" title="ASSETS" testId="section-assets">
        <div className="hct-row">
          <button type="button" aria-expanded={assetMode === 'cube' || assetMode === 'sprite'} disabled={locked}
            onClick={() => { openAsset('cube'); if (assetMode !== 'cube' && assetMode !== 'sprite') setAssetMode('cube'); }} data-testid="button-create-assets">Create assets</button>
          <button type="button" aria-expanded={assetMode === 'texture'} disabled={locked} onClick={() => openAsset('texture')} data-testid="button-create-texture">Create texture</button>
        </div>
        {assetMode && (
          <form className="hct-form" onSubmit={(e) => { e.preventDefault(); void generate(); }} data-testid="form-generate-asset">
            {assetMode !== 'texture' && (
              <div className="hct-seg" role="radiogroup" aria-label="Asset type">
                {(['cube', 'sprite'] as const).map((k) => (
                  <button key={k} type="button" role="radio" aria-checked={assetMode === k} className={assetMode === k ? 'is-on' : ''} onClick={() => setAssetMode(k)} data-testid={`radio-asset-${k}`}>
                    {k === 'cube' ? 'Cube · OBJ' : 'Sprite · PNG'}
                  </button>
                ))}
              </div>
            )}
            <label className="hct-field">
              <span>File name</span>
              <input type="text" value={assetName} maxLength={80} onChange={(e) => setAssetName(e.target.value)} required aria-invalid={assetName.length > 0 && !nameTrim} placeholder={assetMode === 'cube' ? 'crate' : 'grass-tile'} data-testid="input-asset-name" />
            </label>
            {assetMode !== 'cube' && (<>
              <div className="hct-two">
                <ColorField label="Color" value={color} onChange={setColor} testId="input-asset-color" />
                <ColorField label="Secondary" value={secondary} onChange={setSecondary} disabled={pattern === 'solid'} testId="input-asset-secondary-color" />
              </div>
              <div className="hct-two">
                <label className="hct-field"><span>Pattern</span>
                  <select value={pattern} onChange={(e) => setPattern(e.target.value as 'solid' | 'checker')} data-testid="select-asset-pattern">
                    <option value="solid">Solid</option><option value="checker">Checker</option>
                  </select>
                </label>
                <label className="hct-field"><span>Size (px)</span>
                  <select value={size} onChange={(e) => setSize(Number(e.target.value))} data-testid="select-asset-size">
                    {SIZES.map((s) => <option key={s} value={s}>{s} × {s}</option>)}
                  </select>
                </label>
              </div>
              <div className="hct-swatch" aria-hidden="true" style={{ background: pattern === 'checker' ? `repeating-conic-gradient(${color} 0 25%, ${secondary} 0 50%) 0 0 / 12px 12px` : color }} />
            </>)}
            <p className="hct-hint">Saved as <code>{(nameTrim || 'name')}.{assetMode === 'cube' ? 'obj' : 'png'}</code> in Assets. It is not assigned automatically.</p>
            <button type="submit" className="hct-wide" disabled={locked || !assetValid} data-testid="button-generate-asset">
              {busy ? 'Saving to Assets…' : `Generate ${assetMode === 'cube' ? 'cube OBJ' : assetMode === 'sprite' ? 'sprite PNG' : 'texture PNG'}`}
            </button>
          </form>
        )}
      </Section>

      <Section n="2.5" title="ACTIVE CAMERA" testId="section-active-camera">
        <label className="hct-field"><span>Render scene through</span>
          <select value={activeCameraId ?? ''} disabled={locked} onChange={(e) => { props.onActivateCamera(e.target.value || null); report('Active camera changed.'); }} data-testid="select-active-camera">
            <option value="">Game Camera (primary)</option>
            {cameras.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </label>
      </Section>

      {selected && (primitive || light || camera) && (
        <Section n="2.6" title={`SELECTED · ${selected.name.toUpperCase()}`} testId="section-selected-settings">
          {primitive && (<>
            <ColorField label={`${primitive.shape} color`} value={primitive.color} disabled={locked} onChange={(v) => props.onUpdatePrimitive(selected.id, { color: v })} testId="input-primitive-color" />
            <div className="hct-row hct-between">
              <span className="hct-hint">{primitive.textureAssetId ? 'Texture assigned' : 'No texture'}</span>
              <button type="button" className="hct-quiet" disabled={locked || !primitive.textureAssetId} onClick={() => { props.onUpdatePrimitive(selected.id, { textureAssetId: null }); report('Texture cleared.'); }} data-testid="button-clear-texture">Clear texture</button>
            </div>
          </>)}
          {light && (<>
            <div className="hct-two">
              <label className="hct-field"><span>Light kind</span>
                <select value={light.kind} disabled={locked} onChange={(e) => props.onUpdateLight(selected.id, { kind: e.target.value as 'point' | 'directional' | 'ambient' })} data-testid="select-light-kind">
                  <option value="point">Point</option><option value="directional">Directional</option><option value="ambient">Ambient</option>
                </select>
              </label>
              <ColorField label="Light color" value={light.color} disabled={locked} onChange={(v) => props.onUpdateLight(selected.id, { color: v })} testId="input-light-color" />
            </div>
            <label className="hct-field"><span>Intensity <code>{light.intensity}</code></span>
              <input type="range" min={0} max={100} step={1} value={light.intensity} disabled={locked} onChange={(e) => props.onUpdateLight(selected.id, { intensity: Math.min(100, Math.max(0, Number(e.target.value))) })} data-testid="input-light-intensity" />
            </label>
          </>)}
          {camera && (<>
            <label className="hct-field"><span>Field of view <code>{camera.fov}°</code></span>
              <input type="range" min={10} max={100} step={1} value={camera.fov} disabled={locked} onChange={(e) => props.onUpdateCamera(selected.id, { fov: Math.min(100, Math.max(10, Number(e.target.value))) })} data-testid="input-camera-fov" />
            </label>
            <fieldset className="hct-vec"><legend>Look-at target</legend>
              {(['x', 'y', 'z'] as const).map((a) => (
                <label key={`${selected.id}-${a}`}><span>{a.toUpperCase()}</span>
                  <input type="number" step="any" defaultValue={camera.target[a]} disabled={locked} onBlur={(e) => setTarget(a, e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') setTarget(a, e.currentTarget.value); }} data-testid={`input-camera-target-${a}`} />
                </label>
              ))}
            </fieldset>
          </>)}
        </Section>
      )}

      <div className="hct-status" role="status" aria-live="polite" data-testid="status-hierarchy-tools">{note || status}</div>
      {error && <div className="hct-error" role="alert" data-testid="error-hierarchy-tools">{error}</div>}
      {readOnly && <p className="hct-hint hct-pad" data-testid="text-read-only">Read-only: scene editing is disabled.</p>}
    </div>
  );
}
