import { useEffect, useRef, useState } from 'react';
import type { PointerEvent, RefObject } from 'react';
import './scene-resize-handles.css';

type Size = { width: number; height: number; left: number; top: number };
type Corner = 'tl' | 'tr' | 'bl' | 'br';
const STORAGE_KEY = 'madhorse-scene-view-size';
const corners: [Corner, string][] = [['tl', 'top left'], ['tr', 'top right'], ['bl', 'bottom left'], ['br', 'bottom right']];
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function loadSize(): Size | null {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    return value && ['width', 'height', 'left', 'top'].every((key) =>
      typeof value[key] === 'number' && Number.isFinite(value[key]) && value[key] >= 0 && value[key] <= 10000)
      && value.width >= 240 && value.height >= 200 ? value : null;
  } catch { return null; }
}

function limits(stage: HTMLElement) {
  const parent = stage.parentElement!;
  const style = getComputedStyle(parent);
  const width = Math.floor(parent.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight));
  return { width, minWidth: Math.min(width, innerWidth >= 1000 ? 520 : 320), minHeight: 300, maxHeight: Math.max(300, innerHeight - 24) };
}

function fit(size: Size, stage: HTMLElement): Size {
  const bounds = limits(stage);
  const left = clamp(size.left, 0, Math.max(0, bounds.width - bounds.minWidth));
  return {
    left, top: clamp(size.top, 0, bounds.maxHeight - bounds.minHeight),
    width: clamp(size.width, bounds.minWidth, bounds.width - left),
    height: clamp(size.height, bounds.minHeight, bounds.maxHeight),
  };
}

function resized(start: Size, corner: Corner, dx: number, dy: number, stage: HTMLElement): Size {
  const bounds = limits(stage);
  const right = start.left + start.width;
  const bottom = start.top + start.height;
  const left = corner.endsWith('l') ? clamp(start.left + dx, 0, right - bounds.minWidth) : start.left;
  const top = corner.startsWith('t') ? clamp(start.top + dy, 0, bottom - bounds.minHeight) : start.top;
  return {
    left: Math.round(left), top: Math.round(top),
    width: Math.round(corner.endsWith('r') ? clamp(start.width + dx, bounds.minWidth, bounds.width - left) : right - left),
    height: Math.round(corner.startsWith('b') ? clamp(start.height + dy, bounds.minHeight, bounds.maxHeight) : bottom - top),
  };
}

export function SceneResizeHandles({ stageRef }: { stageRef: RefObject<HTMLElement | null> }) {
  const [size, setSize] = useState<Size | null>(loadSize);
  const [notice, setNotice] = useState('');
  const current = useRef(size);
  const drag = useRef<{ id: number; x: number; y: number; corner: Corner; start: Size; original: Size | null } | null>(null);
  const update = (value: Size | null) => { current.current = value; setSize(value); };
  const save = (value: Size | null) => {
    try {
      if (value) localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
      else localStorage.removeItem(STORAGE_KEY);
      setNotice('');
    } catch { setNotice('Size changed, but this browser could not save the preference.'); }
  };
  const reset = () => { drag.current = null; update(null); save(null); };
  const actualSize = (stage: HTMLElement): Size => {
    const rect = stage.getBoundingClientRect();
    const style = getComputedStyle(stage);
    return { width: rect.width, height: rect.height, left: parseFloat(style.marginLeft) || 0, top: parseFloat(style.marginTop) || 0 };
  };

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const apply = () => {
      stage.toggleAttribute('data-user-sized', Boolean(size));
      if (!size) return;
      const applied = fit(size, stage);
      for (const [key, value] of Object.entries(applied)) stage.style.setProperty(`--scene-${key}`, `${value}px`);
    };
    apply();
    const observer = new ResizeObserver(apply);
    if (stage.parentElement) observer.observe(stage.parentElement);
    window.addEventListener('resize', apply);
    return () => { observer.disconnect(); window.removeEventListener('resize', apply); };
  }, [size, stageRef]);

  const finish = (event: PointerEvent<HTMLButtonElement>, cancel = false) => {
    const active = drag.current;
    if (!active || active.id !== event.pointerId) return;
    drag.current = null;
    if (cancel) update(active.original);
    else save(current.current);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return <>
    <span className="sr-only" id="scene-resize-help">Drag a corner to resize Scene View. Arrow keys resize by 20 pixels; hold Shift for 5 pixels. Home or double-click restores automatic size. Escape cancels a drag.</span>
    {corners.map(([corner, label]) => (
      <button key={corner} type="button" className={`scene-resize-handle ${corner}`}
        aria-label={`Resize Scene View from ${label}`} aria-describedby="scene-resize-help"
        title={`Drag ${label} corner to resize Scene View`} data-testid={`scene-resize-${corner}`}
        onDoubleClick={reset}
        onPointerDown={(event) => {
          const stage = stageRef.current;
          if (!stage || event.button !== 0 || !event.isPrimary || drag.current) return;
          event.preventDefault();
          event.stopPropagation();
          event.currentTarget.focus({ preventScroll: true });
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { id: event.pointerId, corner, x: event.clientX, y: event.clientY, start: actualSize(stage), original: current.current };
        }}
        onPointerMove={(event) => {
          const active = drag.current;
          if (!active || active.id !== event.pointerId || !stageRef.current) return;
          event.preventDefault();
          update(resized(active.start, active.corner, event.clientX - active.x, event.clientY - active.y, stageRef.current));
        }}
        onPointerUp={(event) => finish(event)}
        onPointerCancel={(event) => finish(event, true)}
        onLostPointerCapture={(event) => finish(event, true)}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && drag.current) {
            event.preventDefault();
            update(drag.current.original);
            drag.current = null;
            return;
          }
          if (event.key === 'Home') { event.preventDefault(); reset(); return; }
          const step = event.shiftKey ? 5 : 20;
          const dx = event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0;
          const dy = event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0;
          if ((!dx && !dy) || !stageRef.current) return;
          event.preventDefault();
          const next = resized(actualSize(stageRef.current), corner, dx, dy, stageRef.current);
          update(next); save(next);
        }}><span aria-hidden="true" /></button>
    ))}
    {size && <button type="button" className="scene-reset-size" data-testid="scene-reset-size" onClick={reset}>Reset size</button>}
    {notice && <span className="scene-size-notice" role="status">{notice}</span>}
  </>;
}
