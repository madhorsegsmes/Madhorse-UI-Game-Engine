import {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  ReactElement,
  ReactNode,
} from 'react';

export const DEFAULT_WORKSPACE_PANEL_ORDER = [
  'main',
  'scene',
  'camera',
  'tools-left',
  'tools-right',
  'system',
  'play',
  'errors',
] as const;
export type WorkspacePanelId = typeof DEFAULT_WORKSPACE_PANEL_ORDER[number];

const STORAGE_KEY = 'madhorse-workspace-panel-order';
const LEGACY_STORAGE_KEY = STORAGE_KEY;
const panelLabels: Record<WorkspacePanelId, string> = {
  main: 'Main Panel',
  scene: 'Scene Preview',
  camera: 'Game Camera controls',
  'tools-left': 'Panel 2 tools',
  'tools-right': 'Panel 1 tools',
  system: 'Panel 3 / System',
  play: 'Panel 4 / Play and Test Game',
  errors: 'Panel 5 / System Debugger',
};

export type WorkspaceScreenGroup = 'mobile' | 'tablet' | 'desktop';

function storageKeyForGroup(group: WorkspaceScreenGroup) {
  return `${STORAGE_KEY}:${group}`;
}

function getWorkspaceScreenGroup(width?: number): WorkspaceScreenGroup {
  const viewportWidth = width ?? (typeof window === 'undefined' ? 1200 : window.innerWidth);
  if (viewportWidth <= 600) return 'mobile';
  if (viewportWidth < 1000) return 'tablet';
  return 'desktop';
}

function defaultOrderForGroup(group: WorkspaceScreenGroup): WorkspacePanelId[] {
  switch (group) {
    case 'mobile':
      return [...DEFAULT_WORKSPACE_PANEL_ORDER];
    case 'tablet':
      return [...DEFAULT_WORKSPACE_PANEL_ORDER];
    case 'desktop':
      return [...DEFAULT_WORKSPACE_PANEL_ORDER];
  }
}

type DragSession = {
  panelId: WorkspacePanelId;
  pointerId: number;
  startX: number;
  startY: number;
  moved: boolean;
  overId: WorkspacePanelId | null;
};

type LayoutContextValue = {
  order: WorkspacePanelId[];
  draggingId: WorkspacePanelId | null;
  dropTargetId: WorkspacePanelId | null;
  startDrag: (panelId: WorkspacePanelId, event: ReactPointerEvent<HTMLButtonElement>) => void;
  moveByKeyboard: (panelId: WorkspacePanelId, event: ReactKeyboardEvent<HTMLButtonElement>) => void;
  handlePointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  finishPointerMove: (event: ReactPointerEvent<HTMLDivElement>, cancel?: boolean) => void;
  resetLayout: () => void;
};

const LayoutContext = createContext<LayoutContextValue | null>(null);
const PanelIdContext = createContext<WorkspacePanelId | null>(null);

function isWorkspacePanelId(value: unknown): value is WorkspacePanelId {
  return typeof value === 'string' &&
    (DEFAULT_WORKSPACE_PANEL_ORDER as readonly string[]).includes(value);
}

function readOrder(group: WorkspaceScreenGroup): WorkspacePanelId[] {
  try {
    const groupSaved = localStorage.getItem(storageKeyForGroup(group));
    // The previous version stored one order for every viewport. Keep that
    // arrangement as the desktop preference without imposing it on mobile.
    const savedValue = groupSaved ?? (group === 'desktop' ? localStorage.getItem(LEGACY_STORAGE_KEY) : null);
    const saved: unknown = JSON.parse(savedValue ?? 'null');
    if (!Array.isArray(saved)) return defaultOrderForGroup(group);
    const valid = saved.filter(isWorkspacePanelId);
    return [
      ...new Set(valid),
      ...DEFAULT_WORKSPACE_PANEL_ORDER.filter((id) => !valid.includes(id)),
    ];
  } catch {
    return defaultOrderForGroup(group);
  }
}

export function WorkspacePanelLayout({ children }: { children: ReactNode }) {
  const [layout, setLayout] = useState(() => {
    const screenGroup = getWorkspaceScreenGroup();
    return { screenGroup, order: readOrder(screenGroup) };
  });
  const { screenGroup, order } = layout;
  const [draggingId, setDraggingId] = useState<WorkspacePanelId | null>(null);
  const [dropTargetId, setDropTargetId] = useState<WorkspacePanelId | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const boardRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragSession | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(storageKeyForGroup(screenGroup), JSON.stringify(order));
    } catch {
      setAnnouncement('The panel order changed, but this browser could not save the layout.');
    }
  }, [order, screenGroup]);

  useEffect(() => {
    const updateScreenGroup = () => {
      const nextGroup = getWorkspaceScreenGroup(window.innerWidth);
      setLayout((current) => current.screenGroup === nextGroup
        ? current
        : { screenGroup: nextGroup, order: readOrder(nextGroup) });
    };
    window.addEventListener('resize', updateScreenGroup);
    return () => window.removeEventListener('resize', updateScreenGroup);
  }, []);

  const announceMove = useCallback((panelId: WorkspacePanelId, next: WorkspacePanelId[]) => {
    setAnnouncement(`${panelLabels[panelId]} moved to position ${next.indexOf(panelId) + 1} of ${next.length}.`);
  }, []);

  const reorderAt = useCallback((panelId: WorkspacePanelId, index: number) => {
    const rest = order.filter((id) => id !== panelId);
    const insertion = Math.max(0, Math.min(rest.length, index));
    rest.splice(insertion, 0, panelId);
    if (rest.every((id, position) => id === order[position])) return;
    setLayout((current) => ({ ...current, order: rest }));
    announceMove(panelId, rest);
  }, [announceMove, order]);

  const reorderAround = useCallback((panelId: WorkspacePanelId, targetId: WorkspacePanelId, before: boolean) => {
    if (panelId === targetId) return;
    const rest = order.filter((id) => id !== panelId);
    const targetIndex = rest.indexOf(targetId);
    if (targetIndex < 0) return;
    rest.splice(targetIndex + (before ? 0 : 1), 0, panelId);
    if (rest.every((id, position) => id === order[position])) return;
    setLayout((current) => ({ ...current, order: rest }));
    announceMove(panelId, rest);
  }, [announceMove, order]);

  const startDrag = useCallback((panelId: WorkspacePanelId, event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || !event.isPrimary || dragRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      panelId,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      overId: null,
    };
  }, []);

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const active = dragRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    if (!active.moved && Math.hypot(event.clientX - active.startX, event.clientY - active.startY) < 5) return;
    if (!active.moved) {
      active.moved = true;
      setDraggingId(active.panelId);
    }
    const hovered = document.elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>('[data-workspace-panel]')?.dataset.workspacePanel;
    const nextTarget = isWorkspacePanelId(hovered) && hovered !== active.panelId ? hovered : null;
    if (active.overId !== nextTarget) {
      active.overId = nextTarget;
      setDropTargetId(nextTarget);
    }
  }, []);

  const finishPointerMove = useCallback((
    event: ReactPointerEvent<HTMLDivElement>,
    cancel = false,
  ) => {
    const active = dragRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    if (!cancel && active.moved) {
      const hovered = document.elementFromPoint(event.clientX, event.clientY)
        ?.closest<HTMLElement>('[data-workspace-panel]')?.dataset.workspacePanel;
      const targetId = isWorkspacePanelId(hovered) && hovered !== active.panelId ? hovered : active.overId;
      const target = targetId
        ? boardRef.current?.querySelector<HTMLElement>(`[data-workspace-panel="${targetId}"]`)
        : null;
      if (targetId && target) {
        const rect = target.getBoundingClientRect();
        const middleY = rect.top + rect.height / 2;
        const before = event.clientY < middleY ||
          (Math.abs(event.clientY - middleY) <= 4 && event.clientX < rect.left + rect.width / 2);
        reorderAround(active.panelId, targetId, before);
      }
    }
    dragRef.current = null;
    setDraggingId(null);
    setDropTargetId(null);
  }, [reorderAround]);

  const moveByKeyboard = useCallback((
    panelId: WorkspacePanelId,
    event: ReactKeyboardEvent<HTMLButtonElement>,
  ) => {
    const index = order.indexOf(panelId);
    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      event.preventDefault();
      reorderAt(panelId, index - 1);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      event.preventDefault();
      reorderAt(panelId, index + 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      reorderAt(panelId, 0);
    } else if (event.key === 'End') {
      event.preventDefault();
      reorderAt(panelId, order.length - 1);
    }
  }, [order, reorderAt]);

  const resetLayout = useCallback(() => {
    const next = defaultOrderForGroup(screenGroup);
    setLayout((current) => ({ ...current, order: next }));
    setAnnouncement('Default panel arrangement restored.');
  }, [screenGroup]);

  const context: LayoutContextValue = {
    order,
    draggingId,
    dropTargetId,
    startDrag,
    moveByKeyboard,
    handlePointerMove,
    finishPointerMove,
    resetLayout,
  };

  const panels = new Map<WorkspacePanelId, ReactElement>();
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const id = (child.props as { id?: unknown }).id;
    if (isWorkspacePanelId(id)) panels.set(id, child);
  });

  return (
    <LayoutContext.Provider value={context}>
      <div
        ref={boardRef}
        className="workspace-board"
        data-screen-group={screenGroup}
        role="group"
        aria-label="Customizable workspace panels"
        onPointerMove={handlePointerMove}
        onPointerUp={(event) => finishPointerMove(event)}
        onPointerCancel={(event) => finishPointerMove(event, true)}
      >
        {order.map((id) => {
          const panel = panels.get(id);
          return panel ? cloneElement(panel, { key: id }) : null;
        })}
        <span className="sr-only" role="status" aria-live="polite">{announcement}</span>
      </div>
    </LayoutContext.Provider>
  );
}

export function WorkspacePanel({
  id,
  children,
}: {
  id: WorkspacePanelId;
  children: ReactElement<any>;
}) {
  const layout = useContext(LayoutContext);
  if (!layout) throw new Error('WorkspacePanel must be inside WorkspacePanelLayout.');
  return (
    <PanelIdContext.Provider value={id}>
      {cloneElement(children, {
        'data-workspace-panel': id,
        'data-panel-dragging': layout.draggingId === id ? 'true' : undefined,
        'data-panel-drop-target': layout.dropTargetId === id ? 'true' : undefined,
      })}
    </PanelIdContext.Provider>
  );
}

export function WorkspacePanelHandle({ label, className = '' }: { label: string; className?: string }) {
  const panelId = useContext(PanelIdContext);
  const layout = useContext(LayoutContext);
  if (!panelId || !layout) throw new Error('WorkspacePanelHandle must be inside WorkspacePanel.');
  return (
    <button
      type="button"
      className={`workspace-panel-handle ${className}`.trim()}
      aria-label={`Move ${label}. Use arrow keys to change its position.`}
      aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight Home End"
      title={`Drag to move ${label}; use arrow keys to reorder`}
      data-testid={`move-panel-${panelId}`}
      onPointerDown={(event) => layout.startDrag(panelId, event)}
      onKeyDown={(event) => layout.moveByKeyboard(panelId, event)}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="5" cy="4" r="1" />
        <circle cx="11" cy="4" r="1" />
        <circle cx="5" cy="8" r="1" />
        <circle cx="11" cy="8" r="1" />
        <circle cx="5" cy="12" r="1" />
        <circle cx="11" cy="12" r="1" />
      </svg>
    </button>
  );
}

export function WorkspaceLayoutResetButton() {
  const layout = useContext(LayoutContext);
  if (!layout) throw new Error('WorkspaceLayoutResetButton must be inside WorkspacePanelLayout.');
  return (
    <button
      type="button"
      className="workspace-layout-reset"
      aria-label="Reset workspace panel arrangement"
      title="Restore the default panel arrangement"
      data-testid="reset-workspace-layout"
      onClick={layout.resetLayout}
    >
      Reset
    </button>
  );
}
