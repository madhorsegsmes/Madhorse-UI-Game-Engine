import type { FreshWorkspaceSnapshot } from './fresh-workspace-storage';

export type SceneEditState = Pick<FreshWorkspaceSnapshot,
  'entities' | 'camera' | 'assets' | 'animations' | 'animationControllers' | 'prefabs' | 'uiControls' | 'scripts'>;

export function describeSceneEdit(before: SceneEditState, after: SceneEditState) {
  const previousIds = new Set(before.entities.map(entity => entity.id));
  const nextIds = new Set(after.entities.map(entity => entity.id));
  const added = after.entities.filter(entity => !previousIds.has(entity.id));
  const removed = before.entities.filter(entity => !nextIds.has(entity.id));
  if (added.length) return { label: added.length === 1 ? `Create ${added[0].name}` : `Create ${added.length} objects`, group: null };
  if (removed.length) return { label: removed.length === 1 ? `Delete ${removed[0].name}` : `Delete ${removed.length} objects`, group: null };
  if (before.entities !== after.entities) {
    const changed = after.entities.filter((entity, index) => entity !== before.entities[index]);
    if (changed.length === 1) {
      const entity = changed[0], previous = before.entities.find(item => item.id === entity.id);
      for (const flag of ['hidden', 'pickingLocked'] as const) {
        if (Boolean(previous?.editor?.[flag]) !== Boolean(entity.editor?.[flag])) {
          const action = flag === 'hidden' ? (entity.editor?.hidden ? 'Hide in editor' : 'Show in editor')
            : (entity.editor?.pickingLocked ? 'Lock scene picking' : 'Unlock scene picking');
          return { label: `${action}: ${entity.name}`, group: null };
        }
      }
    }
    if (changed.length === 1) return { label: `Edit ${changed[0].name}`, group: `entity:${changed[0].id}` };
    return { label: 'Edit scene', group: null };
  }
  if (before.camera !== after.camera) return { label: 'Edit game camera', group: 'camera' };
  if (before.assets !== after.assets) return { label: 'Edit project assets', group: 'assets' };
  if (before.uiControls !== after.uiControls) return { label: 'Edit UI', group: 'ui' };
  if (before.scripts !== after.scripts) return { label: 'Edit scripts', group: 'scripts' };
  if (before.prefabs !== after.prefabs) return { label: 'Edit prefabs', group: null };
  return { label: 'Edit animations', group: 'animations' };
}

type Frame = { json: string; label: string; bytes: number };

/** Session-only metadata snapshots. File bytes stay in the asset vault, including across undo. */
export class SceneEditHistory<T> {
  private frames: Frame[] = [];
  private index = -1;
  private bytes = 0;
  private group: string | null = null;
  private editedAt = -Infinity;
  notice = '';

  constructor(initial: T, private maxFrames = 60, private maxBytes = 32 * 1024 * 1024) {
    this.record(initial, 'Open project', null, 0);
  }

  get summary() {
    return {
      canUndo: this.index > 0,
      canRedo: this.index >= 0 && this.index < this.frames.length - 1,
      undoLabel: this.index > 0 ? this.frames[this.index].label : '',
      redoLabel: this.frames[this.index + 1]?.label ?? '',
      steps: this.frames.length,
      bytes: this.bytes,
      notice: this.notice,
    };
  }

  record(value: T, label: string, group: string | null, now: number) {
    let json: string;
    try { json = JSON.stringify(value); }
    catch { this.notice = 'This edit could not be added to Undo history.'; return false; }
    if (json === this.frames[this.index]?.json) return false;
    const bytes = json.length * 2;
    if (bytes > this.maxBytes) {
      this.frames = []; this.bytes = 0; this.index = -1; this.group = null;
      this.notice = 'Undo history was reset because this scene exceeds the session history memory limit.';
      return true;
    }
    const hadRedo = this.index < this.frames.length - 1;
    if (hadRedo) {
      this.frames = this.frames.slice(0, this.index + 1);
      this.bytes = this.frames.reduce((total, frame) => total + frame.bytes, 0);
    }
    const coalesce = !hadRedo && this.index > 0 && group !== null && group === this.group && now - this.editedAt <= 450;
    if (coalesce) {
      this.bytes -= this.frames[this.index].bytes;
      this.frames[this.index] = { json, label, bytes };
    } else {
      this.frames.push({ json, label, bytes });
      this.index++;
    }
    this.bytes += bytes;
    this.group = group; this.editedAt = now; this.notice = '';
    while (this.frames.length > Math.max(2, this.maxFrames) || this.bytes > this.maxBytes) {
      this.bytes -= this.frames.shift()!.bytes; this.index--;
    }
    return true;
  }

  undo(): { value: T; label: string } | null {
    if (!this.summary.canUndo) return null;
    const label = this.frames[this.index].label;
    this.index--; this.group = null;
    return { value: JSON.parse(this.frames[this.index].json) as T, label };
  }

  redo(): { value: T; label: string } | null {
    if (!this.summary.canRedo) return null;
    this.index++; this.group = null;
    return { value: JSON.parse(this.frames[this.index].json) as T, label: this.frames[this.index].label };
  }
}
