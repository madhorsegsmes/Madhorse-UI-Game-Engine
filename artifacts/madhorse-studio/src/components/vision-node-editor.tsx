import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import {
  createVisionMenu, defaultVisionEffects, parseVisionEffects, visionEffectPresets, visionMediaFilter,
  type VisionAttachmentRole, type VisionEffects, type VisionNodeAttachment, type VisionNodeContent, type VisionPanelKind,
} from '../lib/vision-node-content';
import './vision-node-content.css';

const MAX = 20;
const kinds: VisionPanelKind[] = ['blank', 'start', 'mission', 'finish', 'image', 'video', 'menu-screen', 'audio'];
const roles: VisionAttachmentRole[] = ['reference', 'scene', 'menu'];

function Preview({ att, mediaUrls }: { att: VisionNodeAttachment; mediaUrls: Record<string, string> }) {
  const url = att.mediaId ? mediaUrls[att.mediaId] : undefined;
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  if (att.kind === 'menu-screen') {
    return (
      <div className="vision-node-card-preview vision-node-menu" style={{ filter: visionMediaFilter(parseVisionEffects(att.effects)) }}>
        <strong>{att.menuTitle || 'Untitled'}</strong>
        {(att.menuButtons ?? []).map((label, i) => <span key={i}>{label || 'Button'}</span>)}
      </div>
    );
  }
  if (!url) return <div className="vision-node-card-preview vision-node-missing">{att.name} (file not loaded in this browser)</div>;
  if (failed) return <div className="vision-node-card-preview vision-node-missing" role="status">This browser could not open {att.name}. Try PNG/JPEG images or MP4/WebM video. The original file is still saved.</div>;
  const filter = visionMediaFilter(parseVisionEffects(att.effects));
  if (att.kind === 'image') return <div className="vision-node-card-preview"><img src={url} alt={att.name} style={{ filter }} onError={() => setFailed(true)} draggable={false} /></div>;
  if (att.kind === 'video') return <div className="vision-node-card-preview"><video src={url} controls preload="metadata" playsInline style={{ filter }} aria-label={att.name} onError={() => setFailed(true)} /></div>;
  return <div className="vision-node-card-preview vision-node-audio"><div>{att.name}</div><audio src={url} controls preload="metadata" aria-label={att.name} onError={() => setFailed(true)} /></div>;
}

export function VisionNodeCardContent({ panel, mediaUrls, onEdit, onUpdate }: {
  panel: VisionNodeContent; mediaUrls: Record<string, string>; onEdit: () => void; onUpdate: (changes: Partial<VisionNodeContent>) => void;
}) {
  const atts = panel.attachments ?? [];
  const [selected, setSelected] = useState(atts[0]?.id ?? '');
  const current = atts.find(a => a.id === selected) ?? atts[0];
  const canComplete = panel.kind === 'mission' || panel.kind === 'finish';
  return (
    <div className="vision-node-card">
      <div className="vision-node-card-top">
        <span className="vision-node-card-kind">{panel.kind.replace('-', ' ')}</span>
        <h3 className="vision-node-card-name" title={panel.label}>{panel.label || 'Untitled node'}</h3>
      </div>
      <p className={`vision-node-card-purpose${panel.details ? '' : ' is-empty'}`}>{panel.details || 'What is the point of this node?'}</p>
      {current && <Preview att={current} mediaUrls={mediaUrls} />}
      <div className="vision-node-card-row">
        <button type="button" className="vision-node-btn" onClick={onEdit}>Edit</button>
        {canComplete && (
          <button type="button" className="vision-node-btn" aria-pressed={!!panel.complete} onClick={() => onUpdate({ complete: !panel.complete })}>
            {panel.complete ? 'Done' : 'Mark done'}
          </button>
        )}
        {atts.length > 1 && (
          <select aria-label="Choose attachment to preview" value={current?.id} onChange={e => setSelected(e.target.value)}>
            {atts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.role})</option>)}
          </select>
        )}
        {atts.length > 0 && <span className="vision-node-count">{atts.length} attached</span>}
      </div>
    </div>
  );
}

export function VisionNodeEditor({ panel, mediaUrls, onUpdate, onClose, onUpload, status, busy = false }: {
  panel: VisionNodeContent; mediaUrls: Record<string, string>; onUpdate: (changes: Partial<VisionNodeContent>) => void;
  onClose: () => void; onUpload: (kind: 'image' | 'video' | 'audio', role: VisionAttachmentRole) => void;
  status?: string; busy?: boolean;
}) {
  const atts = panel.attachments ?? [];
  const full = atts.length >= MAX;
  const [role, setRole] = useState<VisionAttachmentRole>('reference');
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previousFocus = document.activeElement;
    return () => { if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus(); };
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const setAtt = (id: string, changes: Partial<VisionNodeAttachment>) =>
    onUpdate({ attachments: atts.map(a => a.id === id ? { ...a, ...changes } : a) });
  const setFx = (a: VisionNodeAttachment, changes: Partial<VisionEffects>) =>
    setAtt(a.id, { effects: parseVisionEffects({ ...parseVisionEffects(a.effects), ...changes }) });
  const titleId = `vision-node-editor-${panel.id}`;
  return (
    <div className="vision-node-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="vision-node-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={dialogRef}
        onKeyDown={event => {
          if (event.key !== 'Tab') return;
          const controls = [...(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input, select, textarea, [tabindex="0"]') ?? [])]
            .filter(element => element.getClientRects().length > 0);
          const first = controls[0], last = controls.at(-1);
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }}>
        <header>
          <h2 id={titleId}>Edit node</h2>
          <button type="button" className="vision-node-btn" onClick={onClose} aria-label="Close node editor"><X size={16} aria-hidden="true" /></button>
        </header>
        <div className="vision-node-dialog-body">
          <div className="vision-node-grid">
            <label className="vision-node-field">Name
              <input autoFocus maxLength={100} value={panel.label ?? ''} onChange={e => onUpdate({ label: e.target.value })} />
            </label>
            <label className="vision-node-field">Node kind
              <select value={panel.kind} onChange={e => onUpdate({ kind: e.target.value as VisionPanelKind })}>
                {kinds.map(k => <option key={k} value={k}>{k.replace('-', ' ')}</option>)}
              </select>
            </label>
          </div>
          <label className="vision-node-field">Purpose / point of this node
            <textarea rows={3} maxLength={1000} value={panel.details ?? ''} onChange={e => onUpdate({ details: e.target.value })} />
          </label>
          <div className="vision-node-actions">
            <label className="vision-node-field" style={{ minWidth: 160 }}>New attachment role
              <select value={role} onChange={e => setRole(e.target.value as VisionAttachmentRole)}>
                {roles.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
          </div>
          <div className="vision-node-actions">
            <button type="button" className="vision-node-btn" disabled={full || busy} onClick={() => onUpload('image', role)}>Add image</button>
            <button type="button" className="vision-node-btn" disabled={full || busy} onClick={() => onUpload('video', role)}>Add video</button>
            <button type="button" className="vision-node-btn" disabled={full || busy} onClick={() => onUpload('audio', role)}>Add audio</button>
            <button type="button" className="vision-node-btn" disabled={full} onClick={() => onUpdate({ attachments: [...atts, createVisionMenu()].slice(0, MAX) })}>Add menu screen template</button>
          </div>
          <p className="vision-node-hint">{atts.length} of {MAX} attachments. Effects are preview filters only; your original files are not changed. Menu screens are planning previews.</p>
          {status && <p className="vision-node-hint" role="status">{status}</p>}
          {atts.map(a => {
            const fx = parseVisionEffects(a.effects);
            const visual = a.kind !== 'audio';
            return (
              <section key={a.id} className="vision-node-att" aria-label={`Attachment ${a.name}`}>
                <Preview att={a} mediaUrls={mediaUrls} />
                <div className="vision-node-att-fields">
                  <div className="vision-node-grid">
                    <label className="vision-node-field">Attachment name
                      <input maxLength={180} value={a.name} onChange={e => setAtt(a.id, { name: e.target.value })} />
                    </label>
                    <label className="vision-node-field">Role
                      <select value={a.role} onChange={e => setAtt(a.id, { role: e.target.value as VisionAttachmentRole })}>
                        {roles.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </label>
                  </div>
                  {a.kind === 'menu-screen' && <>
                    <label className="vision-node-field">Menu title
                      <input maxLength={100} value={a.menuTitle ?? ''} onChange={e => setAtt(a.id, { menuTitle: e.target.value })} />
                    </label>
                    {(a.menuButtons ?? []).map((label, i) => (
                      <div key={i} className="vision-node-actions" style={{ alignItems: 'end' }}>
                        <label className="vision-node-field" style={{ flex: 1 }}>Button {i + 1} label
                          <input maxLength={50} value={label} onChange={e => setAtt(a.id, { menuButtons: (a.menuButtons ?? []).map((b, j) => j === i ? e.target.value : b) })} />
                        </label>
                        <button type="button" className="vision-node-btn is-danger" onClick={() => setAtt(a.id, { menuButtons: (a.menuButtons ?? []).filter((_, j) => j !== i) })}>Remove button</button>
                      </div>
                    ))}
                    {(a.menuButtons ?? []).length < 6 && (
                      <div className="vision-node-actions">
                        <button type="button" className="vision-node-btn" onClick={() => setAtt(a.id, { menuButtons: [...(a.menuButtons ?? []), 'New button'] })}>Add button</button>
                      </div>
                    )}
                  </>}
                  {visual && <>
                    <label className="vision-node-field">Effect preset
                      <select value={fx.preset} onChange={e => setFx(a, { preset: e.target.value as VisionEffects['preset'] })}>
                        {visionEffectPresets.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                      </select>
                    </label>
                    {([['brightness', 20, 200, '%'], ['contrast', 20, 200, '%'], ['saturation', 0, 250, '%'], ['blur', 0, 12, 'px']] as const).map(([key, min, max, unit]) => (
                      <label key={key} className="vision-node-field">{key[0].toUpperCase() + key.slice(1)}: {fx[key]}{unit}
                        <input type="range" min={min} max={max} step={key === 'blur' ? 0.5 : 1} value={fx[key]} onChange={e => setFx(a, { [key]: Number(e.target.value) })} />
                      </label>
                    ))}
                  </>}
                  <div className="vision-node-actions">
                    {visual && <button type="button" className="vision-node-btn" onClick={() => setAtt(a.id, { effects: { ...defaultVisionEffects } })}>Reset effects</button>}
                    <button type="button" className="vision-node-btn is-danger" onClick={() => onUpdate({ attachments: atts.filter(x => x.id !== a.id) })}>Remove attachment</button>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
