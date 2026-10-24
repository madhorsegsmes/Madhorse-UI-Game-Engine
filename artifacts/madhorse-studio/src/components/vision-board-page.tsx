import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { ArrowLeft } from 'lucide-react';

type VisionPanelBounds = { x: number; y: number; width: number; height: number };
type VisionPanelPointer = {
  mode: 'move' | 'resize';
  pointerId: number;
  startX: number;
  startY: number;
  bounds: VisionPanelBounds;
};

const VISION_PANEL_STORAGE_KEY = 'madhorse.vision-board-panel.v1';

function constrainPanel(bounds: VisionPanelBounds, width: number, height: number): VisionPanelBounds {
  const areaWidth = Math.max(0, width);
  const areaHeight = Math.max(0, height);
  const panelWidth = Math.min(areaWidth, Math.max(Math.min(140, areaWidth), bounds.width));
  const panelHeight = Math.min(areaHeight, Math.max(Math.min(90, areaHeight), bounds.height));
  return {
    width: panelWidth,
    height: panelHeight,
    x: Math.max(0, Math.min(bounds.x, areaWidth - panelWidth)),
    y: Math.max(0, Math.min(bounds.y, areaHeight - panelHeight)),
  };
}

function readSavedPanelBounds(): VisionPanelBounds | null {
  try {
    const saved = localStorage.getItem(VISION_PANEL_STORAGE_KEY);
    if (!saved) return null;
    const value = JSON.parse(saved) as Partial<VisionPanelBounds>;
    if (![value.x, value.y, value.width, value.height].every(number => typeof number === 'number' && Number.isFinite(number))) {
      return null;
    }
    return value as VisionPanelBounds;
  } catch {
    return null;
  }
}

export default function VisionBoardPage() {
  const workspaceRef = useRef<HTMLElement>(null);
  const pointerRef = useRef<VisionPanelPointer | null>(null);
  const [panelBounds, setPanelBounds] = useState<VisionPanelBounds>({ x: 0, y: 0, width: 300, height: 150 });
  const [layoutReady, setLayoutReady] = useState(false);

  useEffect(() => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    const applyBounds = (bounds: VisionPanelBounds) =>
      constrainPanel(bounds, workspace.clientWidth, workspace.clientHeight);
    const defaultWidth = Math.min(300, workspace.clientWidth);
    const defaultHeight = Math.min(150, workspace.clientHeight);
    const initial = readSavedPanelBounds() ?? {
      x: Math.max(0, workspace.clientWidth - defaultWidth - 12),
      y: Math.min(12, Math.max(0, workspace.clientHeight - defaultHeight)),
      width: defaultWidth,
      height: defaultHeight,
    };
    setPanelBounds(applyBounds(initial));
    setLayoutReady(true);

    const resizeObserver = new ResizeObserver(() => {
      setPanelBounds(current => applyBounds(current));
    });
    resizeObserver.observe(workspace);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    if (!layoutReady) return;
    try {
      localStorage.setItem(VISION_PANEL_STORAGE_KEY, JSON.stringify(panelBounds));
    } catch {
      // Keep the panel usable for this session if browser storage is unavailable.
    }
  }, [layoutReady, panelBounds]);

  const beginPanelPointer = (mode: VisionPanelPointer['mode'], event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerRef.current = {
      mode,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      bounds: panelBounds,
    };
  };

  const movePanelPointer = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const pointer = pointerRef.current;
    const workspace = workspaceRef.current;
    if (!pointer || pointer.pointerId !== event.pointerId || !workspace) return;
    const deltaX = event.clientX - pointer.startX;
    const deltaY = event.clientY - pointer.startY;
    const next = pointer.mode === 'move'
      ? { ...pointer.bounds, x: pointer.bounds.x + deltaX, y: pointer.bounds.y + deltaY }
      : { ...pointer.bounds, width: pointer.bounds.width + deltaX, height: pointer.bounds.height + deltaY };
    setPanelBounds(constrainPanel(next, workspace.clientWidth, workspace.clientHeight));
  };

  const endPanelPointer = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (pointerRef.current?.pointerId !== event.pointerId) return;
    pointerRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const nudgePanel = (mode: VisionPanelPointer['mode'], event: ReactKeyboardEvent<HTMLButtonElement>) => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    const step = event.shiftKey ? 30 : 10;
    const delta = {
      x: event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0,
      y: event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0,
    };
    if (!delta.x && !delta.y) return;
    event.preventDefault();
    setPanelBounds(current => {
      const next = mode === 'move'
        ? { ...current, x: current.x + delta.x, y: current.y + delta.y }
        : { ...current, width: current.width + delta.x, height: current.height + delta.y };
      return constrainPanel(next, workspace.clientWidth, workspace.clientHeight);
    });
  };

  return (
    <main className="fresh-vision-page" data-testid="vision-board-page">
      <header className="fresh-vision-page-header">
        <a className="fresh-vision-back" href="../" data-testid="vision-board-back">
          <ArrowLeft size={16} aria-hidden="true" />
          <span>Back to Studio</span>
        </a>
        <h1>Vision Board</h1>
      </header>
      <div className="fresh-vision-toolbar" aria-label="Vision board toolbar" data-testid="vision-board-toolbar" />
      <section className="fresh-vision-board-layout" aria-label="Vision board workspace" ref={workspaceRef}>
        <div className="fresh-vision-page-canvas" aria-label="Blank canvas" data-testid="vision-board-canvas" />
        <aside
          className="fresh-vision-side-panel"
          aria-label="Blank movable panel"
          data-testid="vision-board-side-panel"
          style={{ left: panelBounds.x, top: panelBounds.y, width: panelBounds.width, height: panelBounds.height }}
        >
          <button
            type="button"
            className="fresh-vision-panel-drag"
            aria-label="Move vision board panel"
            title="Drag to move · use arrow keys to nudge"
            onPointerDown={event => beginPanelPointer('move', event)}
            onPointerMove={movePanelPointer}
            onPointerUp={endPanelPointer}
            onPointerCancel={endPanelPointer}
            onKeyDown={event => nudgePanel('move', event)}
            data-testid="vision-board-panel-drag"
          >
            <span aria-hidden="true" />
          </button>
          <button
            type="button"
            className="fresh-vision-panel-resize"
            aria-label="Resize vision board panel"
            title="Drag to resize · use arrow keys to change size"
            onPointerDown={event => beginPanelPointer('resize', event)}
            onPointerMove={movePanelPointer}
            onPointerUp={endPanelPointer}
            onPointerCancel={endPanelPointer}
            onKeyDown={event => nudgePanel('resize', event)}
            data-testid="vision-board-panel-resize"
          >
            <span aria-hidden="true" />
          </button>
        </aside>
      </section>
    </main>
  );
}
