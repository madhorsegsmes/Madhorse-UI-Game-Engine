import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { clampToolbarPosition, parseToolbarPosition, type ToolbarPosition } from '@/lib/floating-toolbar';

const STORAGE_KEY = 'madhorse-studio-transform-toolbar-position.v1';

export function FloatingTransformToolbar({ anchor, children }: { anchor: RefObject<HTMLDivElement | null>; children: ReactNode }) {
  const toolbar = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<ToolbarPosition | null>(null);
  const currentPosition = useRef<ToolbarPosition | null>(null);
  const customPosition = useRef(false);
  const drag = useRef<{ pointerId: number; dx: number; dy: number } | null>(null);
  const bounded = (value: ToolbarPosition) => clampToolbarPosition(value,
    { width: window.innerWidth, height: window.innerHeight },
    { width: toolbar.current?.offsetWidth ?? 126, height: toolbar.current?.offsetHeight ?? 32 });
  const place = (value: ToolbarPosition) => {
    currentPosition.current = bounded(value);
    setPosition(currentPosition.current);
  };
  const save = () => {
    if (!currentPosition.current) return;
    customPosition.current = true;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(currentPosition.current)); } catch { /* Session-only position. */ }
  };
  const defaultPosition = () => {
    const rect = anchor.current?.getBoundingClientRect();
    return { x: (rect?.right ?? window.innerWidth) - (toolbar.current?.offsetWidth ?? 126) - 8, y: (rect?.top ?? 0) + 122 };
  };
  const reset = () => {
    customPosition.current = false;
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* Session-only position. */ }
    place(defaultPosition());
  };
  useEffect(() => {
    let saved: ToolbarPosition | null = null;
    try { saved = parseToolbarPosition(localStorage.getItem(STORAGE_KEY)); } catch { /* Storage may be blocked. */ }
    customPosition.current = !!saved;
    place(saved ?? defaultPosition());
    const reflow = () => place(customPosition.current && currentPosition.current ? currentPosition.current : defaultPosition());
    window.addEventListener('resize', reflow);
    const observer = new ResizeObserver(reflow);
    if (anchor.current) observer.observe(anchor.current);
    return () => { window.removeEventListener('resize', reflow); observer.disconnect(); };
  }, [anchor]);
  const ready = position !== null;
  useEffect(() => {
    if (!ready || !toolbar.current) return;
    const reflow = () => place(customPosition.current && currentPosition.current ? currentPosition.current : defaultPosition());
    const observer = new ResizeObserver(reflow);
    observer.observe(toolbar.current);
    return () => observer.disconnect();
  }, [ready]);
  if (!position) return null;
  return createPortal(
    <div ref={toolbar} className="mh-scene3d__tools is-floating" role="group" aria-label="Transform mode"
      data-testid="floating-transform-toolbar" style={{ left: position.x, top: position.y }}
      onPointerDown={event => event.stopPropagation()} onWheel={event => event.stopPropagation()}>
      <button type="button" className="mh-scene3d__drag-grip" aria-label="Move transform toolbar"
        title="Drag anywhere on screen. Arrow keys move; Home or double-click resets."
        onDoubleClick={reset}
        onKeyDown={event => {
          if (event.key === 'Home') { event.preventDefault(); event.stopPropagation(); reset(); return; }
          const offsets: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
          const offset = offsets[event.key];
          if (!offset || !currentPosition.current) return;
          event.preventDefault(); event.stopPropagation();
          const step = event.shiftKey ? 10 : 1;
          place({ x: currentPosition.current.x + offset[0] * step, y: currentPosition.current.y + offset[1] * step });
          save();
        }}
        onPointerDown={event => {
          if (event.button !== 0 || !currentPosition.current) return;
          event.preventDefault();
          event.currentTarget.focus();
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { pointerId: event.pointerId, dx: event.clientX - currentPosition.current.x, dy: event.clientY - currentPosition.current.y };
        }}
        onPointerMove={event => {
          if (drag.current?.pointerId !== event.pointerId) return;
          place({ x: event.clientX - drag.current.dx, y: event.clientY - drag.current.dy });
        }}
        onPointerUp={event => {
          if (drag.current?.pointerId !== event.pointerId) return;
          drag.current = null; save();
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onLostPointerCapture={() => { if (drag.current) { drag.current = null; save(); } }}
      >⠿</button>
      {children}
    </div>, document.body,
  );
}
