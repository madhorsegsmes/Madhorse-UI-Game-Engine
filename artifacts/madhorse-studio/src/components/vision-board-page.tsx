import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { ArrowLeft, Bot, Globe2, Plus, Store, X } from 'lucide-react';
import { VisionNodeCardContent, VisionNodeEditor } from './vision-node-editor';
import {
  createBasicVisionNodes, createVisionMenu, defaultVisionEffects, parseVisionAttachments, visionBoardHasFinish,
  type VisionAttachmentRole, type VisionNodeContent, type VisionPanelKind,
} from '@/lib/vision-node-content';

type VisionPanelBounds = { x: number; y: number; width: number; height: number };
type VisionBoardPanel = VisionPanelBounds & VisionNodeContent & {
  parentId: string | null;
  mediaId?: string;
  mediaName?: string;
};
type VisionBoardDocument = { id: string; name: string; panels: VisionBoardPanel[] };
type PendingMediaUpload = {
  boardId: string; parentId: string; kind: 'image' | 'audio' | 'video'; role: VisionAttachmentRole;
};
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
const VISION_BOARDS_STORAGE_KEY = 'madhorse.vision-boards.v1';
const VISION_ACTIVE_BOARD_KEY = 'madhorse.vision-active-board.v1';
const VISION_MEDIA_DB = 'madhorse-vision-board-media-v1';
const VISION_MEDIA_STORE = 'media';
const NEW_PANEL_WIDTH = 280;
const NEW_PANEL_HEIGHT = 220;

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
    const kind: VisionPanelKind = ['blank', 'image', 'video', 'menu-screen', 'audio', 'start', 'mission', 'finish'].includes(entry.kind ?? '')
      ? entry.kind as VisionPanelKind
      : 'blank';
    panels.push({
      ...bounds,
      id: entry.id,
      parentId: entry.parentId,
      kind,
      ...(typeof entry.label === 'string' ? { label: entry.label.slice(0, 100) } : {}),
      ...(typeof entry.details === 'string' ? { details: entry.details.slice(0, 1000) } : {}),
      ...(typeof entry.complete === 'boolean' ? { complete: entry.complete } : {}),
      ...(typeof entry.mediaId === 'string' ? { mediaId: entry.mediaId } : {}),
      ...(typeof entry.mediaName === 'string' ? { mediaName: entry.mediaName.slice(0, 180) } : {}),
      attachments: parseVisionAttachments(entry.attachments, entry),
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

function starterWorkflowPanels(): VisionBoardPanel[] {
  return createBasicVisionNodes();
}

function parseVisionBoards(value: unknown): VisionBoardDocument[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 1000) return null;
  const boards: VisionBoardDocument[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') return null;
    const entry = item as Partial<VisionBoardDocument>;
    const panels = parsePanels(entry.panels);
    if (typeof entry.id !== 'string' || !entry.id || typeof entry.name !== 'string' || !panels) return null;
    boards.push({ id: entry.id, name: entry.name.slice(0, 80) || 'Untitled Game', panels });
  }
  if (new Set(boards.map(board => board.id)).size !== boards.length) return null;
  return boards;
}

function readSavedBoards(): VisionBoardDocument[] {
  try {
    const savedBoards = localStorage.getItem(VISION_BOARDS_STORAGE_KEY);
    const parsedBoards = savedBoards ? parseVisionBoards(JSON.parse(savedBoards)) : null;
    if (parsedBoards) return parsedBoards;
    const legacyPanels = readSavedPanels();
    return [{
      id: 'main-game',
      name: 'Main Game',
      panels: legacyPanels ?? starterWorkflowPanels(),
    }];
  } catch {
    return [{ id: 'main-game', name: 'Main Game', panels: starterWorkflowPanels() }];
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
  const [boards, setBoards] = useState<VisionBoardDocument[]>(readSavedBoards);
  const [activeBoardId, setActiveBoardId] = useState(() => {
    try {
      const saved = localStorage.getItem(VISION_ACTIVE_BOARD_KEY);
      if (saved && boards.some(board => board.id === saved)) return saved;
    } catch { /* Keep the board usable when browser storage is unavailable. */ }
    return boards[0]?.id ?? 'main-game';
  });
  const activeBoard = boards.find(board => board.id === activeBoardId) ?? boards[0];
  const panels = activeBoard?.panels ?? [];
  const setPanels = (update: VisionBoardPanel[] | ((current: VisionBoardPanel[]) => VisionBoardPanel[])) => {
    setBoards(current => current.map(board => {
      if (board.id !== activeBoardId) return board;
      const nextPanels = typeof update === 'function' ? update(board.panels) : update;
      return { ...board, panels: nextPanels };
    }));
  };
  const [layoutReady, setLayoutReady] = useState(false);
  const [openMenuPanelId, setOpenMenuPanelId] = useState<string | null>(null);
  const [pendingMediaUpload, setPendingMediaUpload] = useState<PendingMediaUpload | null>(null);
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  const [uploadMessage, setUploadMessage] = useState('');
  const [communityPanel, setCommunityPanel] = useState<'published' | 'store' | null>(null);
  const [editingPanelId, setEditingPanelId] = useState<string | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);

  useEffect(() => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    const applyBounds = (panel: VisionBoardPanel): VisionBoardPanel => ({
      ...panel,
      ...constrainPanel(panel, workspace.clientWidth, workspace.clientHeight),
    });
    setPanels(current => current.map(applyBounds));
    setLayoutReady(true);

    const resizeObserver = new ResizeObserver(() => {
      setPanels(current => current.map(applyBounds));
    });
    resizeObserver.observe(workspace);
    return () => resizeObserver.disconnect();
  }, [activeBoardId]);

  useEffect(() => {
    if (!layoutReady) return;
    try {
      localStorage.setItem(VISION_BOARDS_STORAGE_KEY, JSON.stringify(boards));
      localStorage.setItem(VISION_PANEL_STORAGE_KEY, JSON.stringify(panels));
      localStorage.setItem(VISION_ACTIVE_BOARD_KEY, activeBoardId);
    } catch {
      setUploadMessage('Browser storage is full or unavailable. The board is still open, but changes may not survive refresh.');
    }
  }, [layoutReady, boards, panels, activeBoardId]);

  const mediaIds = [...new Set(panels.flatMap(panel => (panel.attachments ?? [])
    .flatMap(attachment => attachment.mediaId ? [attachment.mediaId] : [])))];
  const mediaKey = `${activeBoardId}:${mediaIds.join('|')}`;
  useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];
    setMediaUrls({});
    void Promise.all(mediaIds.map(async mediaId => {
      const blob = await loadVisionMedia(mediaId);
      if (!blob) return null;
      const url = URL.createObjectURL(blob);
      urls.push(url);
      return [mediaId, url] as const;
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

  const createNewBoard = () => {
    const id = crypto.randomUUID();
    const board: VisionBoardDocument = {
      id,
      name: `Game ${boards.length + 1}`,
      panels: starterWorkflowPanels(),
    };
    setBoards(current => [...current, board]);
    setActiveBoardId(id);
    setEditingPanelId(null);
    setOpenMenuPanelId(null);
    setUploadMessage('New game board created. Your boards are saved in this browser.');
  };

  const renameActiveBoard = (name: string) => {
    setBoards(current => current.map(board => board.id === activeBoardId
      ? { ...board, name: name.slice(0, 80) }
      : board));
  };

  const deleteActiveBoard = () => {
    if (boards.length <= 1) {
      setUploadMessage('Keep at least one game board.');
      return;
    }
    const name = activeBoard?.name ?? 'this board';
    if (!window.confirm(`Delete “${name}” and its Vision Board layout from this browser?`)) return;
    const remaining = boards.filter(board => board.id !== activeBoardId);
    setBoards(remaining);
    setActiveBoardId(remaining[0].id);
    setEditingPanelId(null);
    setOpenMenuPanelId(null);
    setUploadMessage(`“${name}” was deleted from this browser.`);
  };

  const updatePanel = (panelId: string, changes: Partial<VisionBoardPanel>) => {
    setPanels(current => current.map(panel => {
      if (panel.id !== panelId) return panel;
      const updated = { ...panel, ...changes };
      if (changes.kind === 'menu-screen' && !(updated.attachments?.length)) {
        updated.attachments = [createVisionMenu()];
      }
      return updated;
    }));
  };

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
        label: kind === 'blank' ? 'New node' : undefined,
        ...bounds,
        ...(kind === 'mission' ? { label: `Mission ${siblingCount + 1}`, details: 'Write one clear goal the player can complete.', complete: false } : {}),
        ...(kind === 'finish' ? { label: 'Finish', details: 'Describe how the game tells the player they are done.', complete: false } : {}),
        ...(media ? { mediaId: media.id, mediaName: media.name.slice(0, 180) } : {}),
      }];
    });
  };

  const beginMediaUpload = (parentId: string, kind: 'image' | 'audio' | 'video', role: VisionAttachmentRole = 'reference') => {
    if (uploadBusy) { setUploadMessage('Wait for the current file to finish saving.'); return; }
    if ((panels.find(panel => panel.id === parentId)?.attachments?.length ?? 0) >= 20) {
      setUploadMessage('Each node can hold 20 attachments. Remove one before adding another.');
      return;
    }
    setUploadMessage('');
    setPendingMediaUpload({ boardId: activeBoardId, parentId, kind, role });
    setOpenMenuPanelId(null);
    if (mediaInputRef.current) {
      mediaInputRef.current.accept = `${kind}/*`;
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
    if (!file.type.startsWith(`${pending.kind}/`)) {
      setUploadMessage(`Choose ${pending.kind === 'image' ? 'an image' : pending.kind === 'audio' ? 'an audio' : 'a video'} file.`);
      setPendingMediaUpload(null);
      return;
    }
    const maxMb = pending.kind === 'image' ? 12 : pending.kind === 'audio' ? 24 : 80;
    const maxBytes = maxMb * 1024 * 1024;
    if (file.size > maxBytes) {
      setUploadMessage(`This ${pending.kind} is too large. The limit is ${maxMb} MB.`);
      setPendingMediaUpload(null);
      return;
    }
    const mediaId = crypto.randomUUID();
    setUploadBusy(true);
    setUploadMessage('Saving this file in this browser…');
    try {
      await saveVisionMedia(mediaId, file);
      setBoards(current => current.map(board => board.id !== pending.boardId ? board : {
        ...board,
        panels: board.panels.map(panel => panel.id !== pending.parentId ? panel : {
          ...panel,
          attachments: [...(panel.attachments ?? []), {
            id: crypto.randomUUID(), kind: pending.kind, name: file.name.slice(0, 180),
            mediaId, role: pending.role, effects: { ...defaultVisionEffects },
          }].slice(0, 20),
        }),
      }));
      setUploadMessage(`${file.name} attached to the node and saved in this browser.`);
    } catch (failure) {
      setUploadMessage(failure instanceof Error ? failure.message : 'This file could not be saved in the browser.');
    } finally {
      setPendingMediaUpload(null);
      setUploadBusy(false);
    }
  };

  const panelsById = new Map(panels.map(panel => [panel.id, panel]));
  const editingPanel = panels.find(panel => panel.id === editingPanelId);

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
          className="fresh-vision-toolbar-button ego-toolbar-button"
          href="../?open=ego"
          title="Open Ego in the Studio"
          data-testid="vision-board-ego"
        >
          <Bot size={14} aria-hidden="true" />
          <span>Ego</span>
        </a>
        <label className="fresh-vision-board-picker">
          <span>Game board</span>
          <select
            value={activeBoardId}
            onChange={event => {
              setActiveBoardId(event.target.value);
              setEditingPanelId(null);
              setOpenMenuPanelId(null);
              setUploadMessage('');
            }}
            aria-label="Choose a game Vision Board"
            data-testid="vision-board-select"
          >
            {boards.map(board => <option key={board.id} value={board.id}>{board.name || 'Untitled Game'}</option>)}
          </select>
        </label>
        <input
          className="fresh-vision-board-name"
          aria-label="Rename active game board"
          maxLength={80}
          value={activeBoard?.name ?? ''}
          onChange={event => renameActiveBoard(event.target.value)}
          data-testid="vision-board-name"
        />
        <button type="button" className="fresh-vision-toolbar-button" onClick={createNewBoard} data-testid="vision-board-create">
          <Plus size={13} aria-hidden="true" /><span>New board</span>
        </button>
        <button type="button" className="fresh-vision-toolbar-button fresh-vision-delete-board" onClick={deleteActiveBoard} disabled={boards.length <= 1} data-testid="vision-board-delete">
          <span>Delete board</span>
        </button>
        <a
          className="fresh-vision-toolbar-button"
          href="../?open=mad-builder"
          title="Open Mad Builder in the Studio"
          data-testid="vision-board-mad-builder"
        >
          <Bot size={14} aria-hidden="true" />
          <span>Mad Builder</span>
        </a>
        <div className="fresh-vision-community-actions">
          <span className="fresh-vision-workflow-status" data-testid="vision-board-workflow-status"
            title="Add a Finish node to complete your board. Drafts are saved automatically.">
            {visionBoardHasFinish(panels) ? 'Finish node added' : 'Basic · Add a Finish node'}
          </span>
          <button
            type="button"
            className="fresh-vision-toolbar-button"
            onClick={() => setCommunityPanel('published')}
            data-testid="vision-board-community-published"
          >
            <Globe2 size={13} aria-hidden="true" /><span>Community Published</span>
          </button>
          <button
            type="button"
            className="fresh-vision-toolbar-button"
            onClick={() => setCommunityPanel('store')}
            data-testid="vision-board-community-store"
          >
            <Store size={13} aria-hidden="true" /><span>Community Store</span>
          </button>
        </div>
        <input
          ref={mediaInputRef}
          type="file"
          className="fresh-vision-file-input"
          accept={`${pendingMediaUpload?.kind ?? 'image'}/*`}
          aria-label="Choose media for the node"
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
        {panels.map(panel => (
          <aside
            key={panel.id}
            className={`fresh-vision-side-panel vision-kind-${panel.kind}${openMenuPanelId === panel.id ? ' is-menu-open' : ''}`}
            aria-label={panel.kind === 'blank' ? (panel.parentId ? 'Blank skill tree panel' : 'Blank skill tree root panel') : `${panel.kind.replace('-', ' ')} panel`}
            data-testid={panel.id === 'root' ? 'vision-board-side-panel' : `vision-board-side-panel-${panel.id}`}
            data-panel-id={panel.id}
            data-parent-id={panel.parentId ?? undefined}
            data-panel-kind={panel.kind}
            style={{ left: panel.x, top: panel.y, width: panel.width, height: panel.height }}
          >
            <button
              type="button"
              className="fresh-vision-panel-add"
              aria-label="Add to this branch"
              aria-haspopup="menu"
              aria-expanded={openMenuPanelId === panel.id}
              title="Add a node or attach images, videos, menu screens, and audio"
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
                }} disabled={panels.length >= 100}>Create another node</button>
                <button type="button" role="menuitem" onClick={() => {
                  setOpenMenuPanelId(null);
                  addConnectedPanel(panel.id, 'mission');
                }}>Add mission step</button>
                <button type="button" role="menuitem" onClick={() => {
                  setOpenMenuPanelId(null);
                  addConnectedPanel(panel.id, 'finish');
                }}>Add finish point</button>
                <button type="button" role="menuitem" onClick={() => beginMediaUpload(panel.id, 'image')}>Attach image</button>
                <button type="button" role="menuitem" onClick={() => beginMediaUpload(panel.id, 'video')}>Attach video</button>
                <button type="button" role="menuitem" onClick={() => beginMediaUpload(panel.id, 'image', 'scene')}>Attach scene image</button>
                <button type="button" role="menuitem" onClick={() => beginMediaUpload(panel.id, 'video', 'scene')}>Attach scene video</button>
                <button type="button" role="menuitem" onClick={() => beginMediaUpload(panel.id, 'image', 'menu')}>Attach menu image</button>
                <button type="button" role="menuitem" onClick={() => beginMediaUpload(panel.id, 'video', 'menu')}>Attach menu video</button>
                <button type="button" role="menuitem" onClick={() => {
                  setOpenMenuPanelId(null);
                  if ((panel.attachments?.length ?? 0) >= 20) {
                    setUploadMessage('Each node can hold 20 attachments.');
                    return;
                  }
                  updatePanel(panel.id, { attachments: [...(panel.attachments ?? []), createVisionMenu()] });
                  setEditingPanelId(panel.id);
                }}>Attach menu screen</button>
                <button type="button" role="menuitem" onClick={() => beginMediaUpload(panel.id, 'audio')}>Attach audio</button>
              </div>
            )}
            <VisionNodeCardContent panel={panel} mediaUrls={mediaUrls}
              onEdit={() => { setOpenMenuPanelId(null); setEditingPanelId(panel.id); }}
              onUpdate={changes => updatePanel(panel.id, changes)} />
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
      {editingPanel && <VisionNodeEditor panel={editingPanel} mediaUrls={mediaUrls}
        status={uploadMessage} busy={uploadBusy}
        onClose={() => setEditingPanelId(null)}
        onUpdate={changes => updatePanel(editingPanel.id, changes)}
        onUpload={(kind, role) => beginMediaUpload(editingPanel.id, kind, role)} />}
      {communityPanel && (
        <div className="fresh-vision-community-backdrop" onClick={event => {
          if (event.target === event.currentTarget) setCommunityPanel(null);
        }}>
          <section className="fresh-vision-community-dialog" role="dialog" aria-modal="true"
            aria-label={communityPanel === 'published' ? 'Community Published' : 'Community Store'}>
            <header>
              <div>
                {communityPanel === 'published' ? <Globe2 size={17} aria-hidden="true" /> : <Store size={17} aria-hidden="true" />}
                <h2>{communityPanel === 'published' ? 'Community Published' : 'Community Store'}</h2>
              </div>
              <button type="button" onClick={() => setCommunityPanel(null)} aria-label="Close community panel"><X size={16} /></button>
            </header>
            <div className="fresh-vision-community-empty">
              <span>{communityPanel === 'published' ? 'PUBLISHED GAMES' : 'COMMUNITY STORE'}</span>
              <p>{communityPanel === 'published'
                ? 'Published games will appear here.'
                : 'Community items will appear here.'}</p>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
