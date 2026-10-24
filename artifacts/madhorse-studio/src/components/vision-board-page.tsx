import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { ArrowLeft, Bot, Plus } from 'lucide-react';

type VisionPanelBounds = { x: number; y: number; width: number; height: number };
type VisionPanelKind = 'blank' | 'image' | 'menu-screen' | 'audio';
type VisionBoardPanel = VisionPanelBounds & {
  id: string;
  parentId: string | null;
  kind: VisionPanelKind;
  mediaId?: string;
  mediaName?: string;
};
type PendingMediaUpload = { parentId: string; kind: 'image' | 'audio' };
type VisionPanelPointer = {
  panelId: string;
  mode: 'move' | 'resize';
  pointerId: number;
  startX: number;
  startY: number;
  bounds: VisionPanelBounds;
};

const VISION_PANEL_STORAGE_KEY = 'madhorse.vision-board-panels.v2';
const LEGACY_PANEL_STORAGE_KEY = 'madhorse.vision-board-panel.v1';
const VISION_MEDIA_DB = 'madhorse-vision-board-media-v1';
const VISION_MEDIA_STORE = 'media';
const NEW_PANEL_WIDTH = 280;
const NEW_PANEL_HEIGHT = 140;

function openVisionMediaDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(VISION_MEDIA_DB, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(VISION_MEDIA_STORE)) {
        request.result.createObjectStore(VISION_MEDIA_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open browser file storage.'));
  });
}

async function saveVisionMedia(id: string, file: File): Promise<void> {
  const database = await openVisionMediaDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(VISION_MEDIA_STORE, 'readwrite');
    transaction.objectStore(VISION_MEDIA_STORE).put(file, id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Could not save this file in the browser.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Saving this file was interrupted.'));
  });
  database.close();
}

async function loadVisionMedia(id: string): Promise<Blob | null> {
  const database = await openVisionMediaDb();
  const result = await new Promise<Blob | null>((resolve, reject) => {
    const request = database.transaction(VISION_MEDIA_STORE, 'readonly').objectStore(VISION_MEDIA_STORE).get(id);
    request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : null);
    request.onerror = () => reject(request.error ?? new Error('Could not read this browser file.'));
  });
  database.close();
  return result;
}

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

function parseBounds(value: unknown): VisionPanelBounds | null {
  if (!value || typeof value !== 'object') return null;
  const bounds = value as Partial<VisionPanelBounds>;
  if (![bounds.x, bounds.y].every(number => typeof number === 'number' && Number.isFinite(number) && number >= 0) ||
    ![bounds.width, bounds.height].every(number => typeof number === 'number' && Number.isFinite(number) && number > 0)) return null;
  return bounds as VisionPanelBounds;
}

function parsePanels(value: unknown): VisionBoardPanel[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100) return null;
  const panels: VisionBoardPanel[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') return null;
    const entry = item as Partial<VisionBoardPanel>;
    const bounds = parseBounds(entry);
    if (!bounds || typeof entry.id !== 'string' || !entry.id ||
      (entry.parentId !== null && typeof entry.parentId !== 'string')) return null;
    const kind: VisionPanelKind = ['blank', 'image', 'menu-screen', 'audio'].includes(entry.kind ?? '')
      ? entry.kind as VisionPanelKind
      : 'blank';
    panels.push({
      ...bounds,
      id: entry.id,
      parentId: entry.parentId,
      kind,
      ...(typeof entry.mediaId === 'string' ? { mediaId: entry.mediaId } : {}),
      ...(typeof entry.mediaName === 'string' ? { mediaName: entry.mediaName.slice(0, 180) } : {}),
    });
  }
  const ids = new Set(panels.map(panel => panel.id));
  if (ids.size !== panels.length || !panels.some(panel => panel.parentId === null)) return null;
  if (panels.some(panel => panel.parentId !== null && (!ids.has(panel.parentId) || panel.parentId === panel.id))) return null;
  return panels;
}

function readSavedPanels(): VisionBoardPanel[] | null {
  try {
    const savedPanels = localStorage.getItem(VISION_PANEL_STORAGE_KEY);
    if (savedPanels) {
      const parsedPanels = parsePanels(JSON.parse(savedPanels));
      if (parsedPanels) return parsedPanels;
    }
    const legacyBounds = localStorage.getItem(LEGACY_PANEL_STORAGE_KEY);
    const parsedBounds = legacyBounds ? parseBounds(JSON.parse(legacyBounds)) : null;
    if (parsedBounds) return [{ ...parsedBounds, id: 'root', parentId: null, kind: 'blank' }];
    return null;
  } catch {
    return null;
  }
}

function findChildPosition(
  parent: VisionBoardPanel,
  siblingCount: number,
  panels: VisionBoardPanel[],
  areaWidth: number,
  areaHeight: number,
): VisionPanelBounds {
  const width = Math.min(NEW_PANEL_WIDTH, areaWidth);
  const height = Math.min(NEW_PANEL_HEIGHT, areaHeight);
  const gap = 40;
  const xStep = width + gap;
  const yStep = height + gap;
  const row = siblingCount % 5;
  const column = Math.floor(siblingCount / 5) + 1;
  const preferredX = parent.x - column * xStep;
  const preferredY = parent.y + Math.max(0, (parent.height - height) / 2) + row * yStep;
  const axisPositions = (limit: number, panelSize: number, step: number) => {
    const max = Math.max(0, limit - panelSize);
    const positions = [0];
    for (let value = 12; value < max; value += step) positions.push(value);
    positions.push(max);
    return [...new Set(positions)];
  };
  const xPositions = axisPositions(areaWidth, width, xStep);
  const yPositions = axisPositions(areaHeight, height, yStep);
  const candidates = xPositions.flatMap(x => yPositions.map(y => ({ x, y })))
    .sort((first, second) =>
      Math.abs(first.x - preferredX) + Math.abs(first.y - preferredY) -
      Math.abs(second.x - preferredX) - Math.abs(second.y - preferredY));
  const clearOfExisting = (position: { x: number; y: number }) =>
    panels.every(panel =>
      position.x + width + 12 <= panel.x ||
      panel.x + panel.width + 12 <= position.x ||
      position.y + height + 12 <= panel.y ||
      panel.y + panel.height + 12 <= position.y);
  const position = candidates.find(clearOfExisting) ??
    constrainPanel({ x: preferredX, y: preferredY, width, height }, areaWidth, areaHeight);
  return constrainPanel({ ...position, width, height }, areaWidth, areaHeight);
}

export default function VisionBoardPage() {
  const workspaceRef = useRef<HTMLElement>(null);
  const pointerRef = useRef<VisionPanelPointer | null>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const [panels, setPanels] = useState<VisionBoardPanel[]>([
    { id: 'root', parentId: null, kind: 'blank', x: 0, y: 0, width: 300, height: 150 },
  ]);
  const [layoutReady, setLayoutReady] = useState(false);
  const [openMenuPanelId, setOpenMenuPanelId] = useState<string | null>(null);
  const [pendingMediaUpload, setPendingMediaUpload] = useState<PendingMediaUpload | null>(null);
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  const [uploadMessage, setUploadMessage] = useState('');

  useEffect(() => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    const applyBounds = (panel: VisionBoardPanel): VisionBoardPanel => ({
      ...panel,
      ...constrainPanel(panel, workspace.clientWidth, workspace.clientHeight),
    });
    const defaultWidth = Math.min(300, workspace.clientWidth);
    const defaultHeight = Math.min(150, workspace.clientHeight);
    const initial = readSavedPanels() ?? [{
      id: 'root',
      parentId: null,
      kind: 'blank' as const,
      x: Math.max(0, workspace.clientWidth - defaultWidth - 12),
      y: Math.min(12, Math.max(0, workspace.clientHeight - defaultHeight)),
      width: defaultWidth,
      height: defaultHeight,
    }];
    setPanels(initial.map(applyBounds));
    setLayoutReady(true);

    const resizeObserver = new ResizeObserver(() => {
      setPanels(current => current.map(applyBounds));
    });
    resizeObserver.observe(workspace);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    if (!layoutReady) return;
    try {
      localStorage.setItem(VISION_PANEL_STORAGE_KEY, JSON.stringify(panels));
    } catch {
      // Keep the panel usable for this session if browser storage is unavailable.
    }
  }, [layoutReady, panels]);

  const mediaKey = panels.filter(panel => panel.mediaId).map(panel => `${panel.id}:${panel.mediaId}`).join('|');
  useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];
    const mediaPanels = panels.filter(panel => panel.mediaId);
    void Promise.all(mediaPanels.map(async panel => {
      const blob = await loadVisionMedia(panel.mediaId!);
      if (!blob) return null;
      const url = URL.createObjectURL(blob);
      urls.push(url);
      return [panel.id, url] as const;
    })).then(entries => {
      if (cancelled) {
        urls.forEach(URL.revokeObjectURL);
        return;
      }
      setMediaUrls(Object.fromEntries(entries.filter((entry): entry is readonly [string, string] => !!entry)));
    }).catch(() => {
      if (!cancelled) setUploadMessage('A saved board file could not be read. Add it again from this browser.');
    });
    return () => {
      cancelled = true;
      urls.forEach(URL.revokeObjectURL);
    };
  }, [mediaKey]);

  const beginPanelPointer = (
    panel: VisionBoardPanel,
    mode: VisionPanelPointer['mode'],
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerRef.current = {
      panelId: panel.id,
      mode,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      bounds: { x: panel.x, y: panel.y, width: panel.width, height: panel.height },
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
    setPanels(current => current.map(panel => panel.id === pointer.panelId
      ? { ...panel, ...constrainPanel(next, workspace.clientWidth, workspace.clientHeight) }
      : panel));
  };

  const endPanelPointer = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (pointerRef.current?.pointerId !== event.pointerId) return;
    pointerRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const nudgePanel = (
    panelId: string,
    mode: VisionPanelPointer['mode'],
    event: ReactKeyboardEvent<HTMLButtonElement>,
  ) => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    const step = event.shiftKey ? 30 : 10;
    const delta = {
      x: event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0,
      y: event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0,
    };
    if (!delta.x && !delta.y) return;
    event.preventDefault();
    setPanels(current => current.map(panel => {
      if (panel.id !== panelId) return panel;
      const next = mode === 'move'
        ? { ...panel, x: panel.x + delta.x, y: panel.y + delta.y }
        : { ...panel, width: panel.width + delta.x, height: panel.height + delta.y };
      return { ...panel, ...constrainPanel(next, workspace.clientWidth, workspace.clientHeight) };
    }));
  };

  const addConnectedPanel = (
    parentId: string,
    kind: VisionPanelKind = 'blank',
    media?: { id: string; name: string },
  ) => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    setPanels(current => {
      if (current.length >= 100) return current;
      const parent = current.find(panel => panel.id === parentId);
      if (!parent) return current;
      const siblingCount = current.filter(panel => panel.parentId === parentId).length;
      const bounds = findChildPosition(parent, siblingCount, current, workspace.clientWidth, workspace.clientHeight);
      return [...current, {
        id: crypto.randomUUID(),
        parentId,
        kind,
        ...bounds,
        ...(media ? { mediaId: media.id, mediaName: media.name.slice(0, 180) } : {}),
      }];
    });
  };

  const beginMediaUpload = (parentId: string, kind: 'image' | 'audio') => {
    setUploadMessage('');
    setPendingMediaUpload({ parentId, kind });
    setOpenMenuPanelId(null);
    if (mediaInputRef.current) {
      mediaInputRef.current.accept = kind === 'image' ? 'image/*' : 'audio/*';
      mediaInputRef.current.value = '';
    }
    mediaInputRef.current?.click();
  };

  const handleMediaFileSelection = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    const pending = pendingMediaUpload;
    input.value = '';
    if (!file || !pending) return;
    const isImage = pending.kind === 'image' && file.type.startsWith('image/');
    const isAudio = pending.kind === 'audio' && file.type.startsWith('audio/');
    if (!isImage && !isAudio) {
      setUploadMessage(pending.kind === 'image' ? 'Choose an image file.' : 'Choose an audio file.');
      setPendingMediaUpload(null);
      return;
    }
    const maxBytes = pending.kind === 'image' ? 12 * 1024 * 1024 : 24 * 1024 * 1024;
    if (file.size > maxBytes) {
      setUploadMessage(`This ${pending.kind} is too large. The limit is ${pending.kind === 'image' ? '12 MB' : '24 MB'}.`);
      setPendingMediaUpload(null);
      return;
    }
    const mediaId = crypto.randomUUID();
    setUploadMessage('Saving this file in this browser…');
    try {
      await saveVisionMedia(mediaId, file);
      addConnectedPanel(pending.parentId, pending.kind, { id: mediaId, name: file.name });
      setUploadMessage(`${file.name} added to the board. It stays in this browser.`);
    } catch (failure) {
      setUploadMessage(failure instanceof Error ? failure.message : 'This file could not be saved in the browser.');
    } finally {
      setPendingMediaUpload(null);
    }
  };

  const panelsById = new Map(panels.map(panel => [panel.id, panel]));

  return (
    <main className="fresh-vision-page" data-testid="vision-board-page">
      <header className="fresh-vision-page-header">
        <a className="fresh-vision-back" href="../" data-testid="vision-board-back">
          <ArrowLeft size={16} aria-hidden="true" />
          <span>Back to Studio</span>
        </a>
        <h1>Vision Board</h1>
      </header>
      <div className="fresh-vision-toolbar" aria-label="Vision board toolbar" data-testid="vision-board-toolbar">
        <a
          className="fresh-vision-toolbar-button"
          href="../?open=mad-builder"
          title="Open Mad Builder in the Studio"
          data-testid="vision-board-mad-builder"
        >
          <Bot size={14} aria-hidden="true" />
          <span>Mad Builder</span>
        </a>
        <a
          className="fresh-vision-toolbar-button ego-toolbar-button"
          href="../?open=ego"
          title="Open Ego in the Studio"
          data-testid="vision-board-ego"
        >
          <Bot size={14} aria-hidden="true" />
          <span>Ego</span>
        </a>
        <input
          ref={mediaInputRef}
          type="file"
          className="fresh-vision-file-input"
          accept={pendingMediaUpload?.kind === 'image' ? 'image/*' : 'audio/*'}
          aria-label={pendingMediaUpload?.kind === 'image' ? 'Choose an image for the board' : 'Choose audio for the board'}
          onChange={handleMediaFileSelection}
          data-testid="vision-board-media-input"
        />
        {uploadMessage && <span className="fresh-vision-upload-message" role="status" data-testid="vision-board-upload-status">{uploadMessage}</span>}
      </div>
      <section className="fresh-vision-board-layout" aria-label="Vision board workspace" ref={workspaceRef}>
        <div className="fresh-vision-page-canvas" aria-label="Blank canvas" data-testid="vision-board-canvas" />
        <svg className="fresh-vision-connectors" aria-hidden="true" data-testid="vision-board-connectors">
          {panels.map(child => {
            if (!child.parentId) return null;
            const parent = panelsById.get(child.parentId);
            if (!parent) return null;
            const childCenterX = child.x + child.width / 2;
            const childCenterY = child.y + child.height / 2;
            const parentCenterX = parent.x + parent.width / 2;
            const parentCenterY = parent.y + parent.height / 2;
            const deltaX = parentCenterX - childCenterX;
            const deltaY = parentCenterY - childCenterY;
            if (Math.abs(deltaX) >= Math.abs(deltaY)) {
              const direction = deltaX >= 0 ? 1 : -1;
              const startX = direction > 0 ? child.x + child.width : child.x;
              const endX = direction > 0 ? parent.x : parent.x + parent.width;
              const curve = Math.max(24, Math.abs(endX - startX) * 0.4);
              return (
                <path
                  key={`${child.id}-connector`}
                  d={`M ${startX} ${childCenterY} C ${startX + direction * curve} ${childCenterY}, ${endX - direction * curve} ${parentCenterY}, ${endX} ${parentCenterY}`}
                  data-testid={`vision-board-connector-${child.id}`}
                />
              );
            }
            const direction = deltaY >= 0 ? 1 : -1;
            const startY = direction > 0 ? child.y + child.height : child.y;
            const endY = direction > 0 ? parent.y : parent.y + parent.height;
            const curve = Math.max(24, Math.abs(endY - startY) * 0.4);
            return (
              <path
                key={`${child.id}-connector`}
                d={`M ${childCenterX} ${startY} C ${childCenterX} ${startY + direction * curve}, ${parentCenterX} ${endY - direction * curve}, ${parentCenterX} ${endY}`}
                data-testid={`vision-board-connector-${child.id}`}
              />
            );
          })}
        </svg>
        {panels.map((panel, index) => (
          <aside
            key={panel.id}
            className={`fresh-vision-side-panel${openMenuPanelId === panel.id ? ' is-menu-open' : ''}`}
            aria-label={panel.kind === 'blank' ? (panel.parentId ? 'Blank skill tree panel' : 'Blank skill tree root panel') : `${panel.kind.replace('-', ' ')} panel`}
            data-testid={panel.id === 'root' ? 'vision-board-side-panel' : `vision-board-side-panel-${panel.id}`}
            data-panel-id={panel.id}
            data-parent-id={panel.parentId ?? undefined}
            style={{ left: panel.x, top: panel.y, width: panel.width, height: panel.height }}
          >
            <button
              type="button"
              className="fresh-vision-panel-add"
              aria-label="Add to this branch"
              aria-haspopup="menu"
              aria-expanded={openMenuPanelId === panel.id}
              title="Add a node, image, menu screen, or audio"
              disabled={panels.length >= 100}
              onClick={() => setOpenMenuPanelId(current => current === panel.id ? null : panel.id)}
              data-testid={panel.id === 'root' ? 'vision-board-add-panel' : `vision-board-add-panel-${panel.id}`}
            >
              <Plus size={13} aria-hidden="true" />
            </button>
            {openMenuPanelId === panel.id && (
              <div className="fresh-vision-add-menu" role="menu" aria-label="Add to branch" data-testid={`vision-board-add-menu-${panel.id}`}>
                <button type="button" role="menuitem" onClick={() => {
                  setOpenMenuPanelId(null);
                  addConnectedPanel(panel.id);
                }}>Create another node</button>
                <button type="button" role="menuitem" onClick={() => beginMediaUpload(panel.id, 'image')}>Add image</button>
                <button type="button" role="menuitem" onClick={() => {
                  setOpenMenuPanelId(null);
                  addConnectedPanel(panel.id, 'menu-screen');
                }}>Add menu screen</button>
                <button type="button" role="menuitem" onClick={() => beginMediaUpload(panel.id, 'audio')}>Add audio</button>
              </div>
            )}
            {panel.kind === 'image' && (
              <div className="fresh-vision-media-content">
                {mediaUrls[panel.id]
                  ? <img src={mediaUrls[panel.id]} alt={panel.mediaName ?? 'Vision board reference'} draggable={false} />
                  : <span>{panel.mediaName ? 'Loading image…' : 'Image file unavailable'}</span>}
                <small>{panel.mediaName}</small>
              </div>
            )}
            {panel.kind === 'audio' && (
              <div className="fresh-vision-media-content fresh-vision-audio-content">
                <strong>{panel.mediaName ?? 'Audio reference'}</strong>
                {mediaUrls[panel.id]
                  ? <audio controls preload="metadata" src={mediaUrls[panel.id]} aria-label={`Play ${panel.mediaName ?? 'audio reference'}`} />
                  : <span>Loading audio…</span>}
              </div>
            )}
            {panel.kind === 'menu-screen' && (
              <div className="fresh-vision-menu-screen" data-testid={`vision-board-menu-screen-${panel.id}`}>
                <small>MENU SCREEN</small>
                <strong>YOUR GAME</strong>
                <button type="button" disabled>Play</button>
                <button type="button" disabled>Settings</button>
                <button type="button" disabled>Exit</button>
              </div>
            )}
            <button
              type="button"
              className="fresh-vision-panel-drag"
              aria-label="Move vision board panel"
              title="Drag to move · use arrow keys to nudge"
              onPointerDown={event => beginPanelPointer(panel, 'move', event)}
              onPointerMove={movePanelPointer}
              onPointerUp={endPanelPointer}
              onPointerCancel={endPanelPointer}
              onKeyDown={event => nudgePanel(panel.id, 'move', event)}
              data-testid={panel.id === 'root' ? 'vision-board-panel-drag' : `vision-board-panel-drag-${panel.id}`}
            >
              <span aria-hidden="true" />
            </button>
            <button
              type="button"
              className="fresh-vision-panel-resize"
              aria-label="Resize vision board panel"
              title="Drag to resize · use arrow keys to change size"
              onPointerDown={event => beginPanelPointer(panel, 'resize', event)}
              onPointerMove={movePanelPointer}
              onPointerUp={endPanelPointer}
              onPointerCancel={endPanelPointer}
              onKeyDown={event => nudgePanel(panel.id, 'resize', event)}
              data-testid={panel.id === 'root' ? 'vision-board-panel-resize' : `vision-board-panel-resize-${panel.id}`}
            >
              <span aria-hidden="true" />
            </button>
          </aside>
        ))}
      </section>
    </main>
  );
}
