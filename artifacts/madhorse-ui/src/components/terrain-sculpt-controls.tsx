import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { sculptTerrain, TERRAIN_SEGMENTS, TERRAIN_SIZE, type TerrainBrush, type TerrainHeightfield } from '@/lib/terrain-heightfield';
import './terrain-sculpt-controls.css';

const MAX_STEPS = 64;
const HALF = TERRAIN_SIZE / 2;
const BRUSHES: TerrainBrush[] = ['raise', 'lower', 'smooth'];
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function cellColor(h: number, min: number, max: number) {
  const span = max - min || 1;
  const t = (h - min) / span;
  const l = 14 + t * 48;
  const hue = 8 + t * 28;
  return `hsl(${hue} ${30 + t * 35}% ${l}%)`;
}

export interface TerrainSculptControlsProps {
  initial: TerrainHeightfield;
  onPreview: (value: TerrainHeightfield) => void;
  onApply: (value: TerrainHeightfield) => void;
  onCancel: () => void;
}

export function TerrainSculptControls({ initial, onPreview, onApply, onCancel }: TerrainSculptControlsProps) {
  const [draft, setDraft] = useState<TerrainHeightfield>(initial);
  const [mode, setMode] = useState<TerrainBrush>('raise');
  const [radius, setRadius] = useState(2);
  const [strength, setStrength] = useState(0.35);
  const [stroking, setStroking] = useState(false);
  const [note, setNote] = useState('');
  const draftRef = useRef(draft);
  const stroke = useRef<{ id: number; before: TerrainHeightfield; last: { x: number; z: number } } | null>(null);
  const padRef = useRef<HTMLDivElement>(null);

  const commitDraft = (next: TerrainHeightfield) => { draftRef.current = next; setDraft(next); onPreview(next); };

  const toWorld = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return {
      x: clamp(((e.clientX - r.left) / r.width) * TERRAIN_SIZE - HALF, -HALF, HALF),
      z: clamp(((e.clientY - r.top) / r.height) * TERRAIN_SIZE - HALF, -HALF, HALF),
    };
  };

  const paint = (from: { x: number; z: number } | null, to: { x: number; z: number }) => {
    let field = draftRef.current;
    if (!from) field = sculptTerrain(field, { ...to, radius, strength, mode });
    else {
      const dist = Math.hypot(to.x - from.x, to.z - from.z);
      const steps = clamp(Math.ceil(dist / Math.max(radius * 0.35, 0.1)), 1, MAX_STEPS);
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        field = sculptTerrain(field, { x: from.x + (to.x - from.x) * t, z: from.z + (to.z - from.z) * t, radius, strength, mode });
      }
    }
    commitDraft(field);
  };

  const rollback = (msg: string) => {
    const s = stroke.current;
    if (!s) return;
    stroke.current = null;
    setStroking(false);
    commitDraft(s.before);
    setNote(msg);
  };

  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (stroke.current || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault();
    e.currentTarget.focus({ preventScroll: true });
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = toWorld(e);
    stroke.current = { id: e.pointerId, before: draftRef.current, last: p };
    setStroking(true);
    setNote('');
    paint(null, p);
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const s = stroke.current;
    if (!s || s.id !== e.pointerId) return;
    const p = toWorld(e);
    paint(s.last, p);
    s.last = p;
  };
  const up = (e: PointerEvent<HTMLDivElement>) => {
    const s = stroke.current;
    if (!s || s.id !== e.pointerId) return;
    stroke.current = null;
    setStroking(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    setNote('Stroke added to draft.');
  };
  const interrupted = (e: PointerEvent<HTMLDivElement>) => {
    if (stroke.current?.id === e.pointerId) rollback('Stroke interrupted and undone.');
  };

  const cancel = () => {
    if (stroke.current) {
      const id = stroke.current.id;
      rollback('');
      if (padRef.current?.hasPointerCapture(id)) padRef.current.releasePointerCapture(id);
    }
    onCancel();
  };
  const apply = () => { if (!stroke.current) onApply(draftRef.current); };
  // Window events cover interrupted drags and Escape even when another editor panel has focus.
  const handlers = useRef({ cancel, rollback });
  handlers.current = { cancel, rollback };
  useEffect(() => {
    const key = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); handlers.current.cancel(); }
    };
    const interrupt = () => handlers.current.rollback('Stroke interrupted and undone.');
    const hidden = () => { if (document.hidden) interrupt(); };
    window.addEventListener('keydown', key);
    window.addEventListener('blur', interrupt);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      window.removeEventListener('keydown', key);
      window.removeEventListener('blur', interrupt);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, []);

  const n = TERRAIN_SEGMENTS + 1;
  const hs = draft.heights;
  let min = Infinity, max = -Infinity;
  for (const h of hs) { if (h < min) min = h; if (h > max) max = h; }
  if (!Number.isFinite(min)) { min = 0; max = 0; }
  const changed = draft !== initial;

  return (
    <div className="tsc" data-testid="terrain-sculpt-controls" aria-busy={stroking}>
      <h3 className="tsc-title">TERRAIN SCULPT<span className="tsc-rule" aria-hidden="true" /></h3>
      <p className="tsc-hint">Top-down view, north (-Z) at top, east (+X) right. Drag on the pad to {mode} terrain. Press Escape to cancel.</p>
      <div className="tsc-padwrap">
        <span className="tsc-axis n" aria-hidden="true">N · Z -{HALF}</span>
        <span className="tsc-axis s" aria-hidden="true">S · Z +{HALF}</span>
        <span className="tsc-axis w" aria-hidden="true">W</span>
        <span className="tsc-axis e" aria-hidden="true">E</span>
        <div
          ref={padRef}
          className={`tsc-pad${stroking ? ' is-active' : ''}`}
          style={{ gridTemplateColumns: `repeat(${n}, 1fr)`, gridTemplateRows: `repeat(${n}, 1fr)` }}
          role="application"
          tabIndex={0}
          aria-label={`Terrain brush pad, ${mode} brush, radius ${radius.toFixed(2)}, strength ${strength.toFixed(2)}. Drag to sculpt.`}
          onPointerDown={down} onPointerMove={move} onPointerUp={up}
          onPointerCancel={interrupted} onLostPointerCapture={interrupted}
          data-testid="pad-terrain-sculpt"
        >
          {hs.map((h, i) => <span key={i} className="tsc-cell" style={{ background: cellColor(h, min, max) }} />)}
        </div>
      </div>
      <div className="tsc-legend" data-testid="text-terrain-range">
        <span>Low {min.toFixed(2)}</span><span>Bounds -8..8</span><span>High {max.toFixed(2)}</span>
      </div>

      <div className="tsc-seg" role="radiogroup" aria-label="Brush mode">
        {BRUSHES.map((b) => (
          <button key={b} type="button" role="radio" aria-checked={mode === b} className={mode === b ? 'is-on' : ''} disabled={stroking} onClick={() => setMode(b)} data-testid={`radio-brush-${b}`}>
            {b[0].toUpperCase() + b.slice(1)}
          </button>
        ))}
      </div>
      <label className="tsc-field"><span>Radius <code>{radius.toFixed(2)}</code></span>
        <input type="range" min={0.75} max={6} step={0.05} value={radius} disabled={stroking} onChange={(e) => setRadius(clamp(Number(e.target.value), 0.75, 6))} data-testid="input-brush-radius" />
      </label>
      <label className="tsc-field"><span>Strength <code>{strength.toFixed(2)}</code></span>
        <input type="range" min={0.05} max={1} step={0.05} value={strength} disabled={stroking} onChange={(e) => setStrength(clamp(Number(e.target.value), 0.05, 1))} data-testid="input-brush-strength" />
      </label>

      <div className="tsc-actions">
        <button type="button" className="tsc-quiet" onClick={cancel} data-testid="button-cancel-terrain">Cancel</button>
        <button type="button" disabled={stroking || !changed} onClick={apply} data-testid="button-apply-terrain">Apply terrain</button>
      </div>
      <div className="tsc-status" role="status" aria-live="polite" data-testid="status-terrain-sculpt">
        {note || (changed ? 'Draft changes not yet applied.' : 'No changes yet.')}
      </div>
    </div>
  );
}
