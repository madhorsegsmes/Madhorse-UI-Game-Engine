import { Eye, EyeOff, LockKeyhole, LockKeyholeOpen } from 'lucide-react';
import type { SceneEntity } from '@/lib/scene-model';
import { inheritSceneEditorFlags, NO_EDITOR_FLAGS, type SceneEditorFlag, type SceneEditorFlags } from '@/lib/scene-editor-state';

export function SceneEditorControls({ entity, inherited = NO_EDITOR_FLAGS, disabled, onChange }: {
  entity: SceneEntity; inherited?: SceneEditorFlags; disabled: boolean;
  onChange: (id: string, flag: SceneEditorFlag, value: boolean) => void;
}) {
  const flags = inheritSceneEditorFlags(entity.editor, inherited);
  return <span className="fresh-editor-object-controls" role="group" aria-label={`Scene view controls for ${entity.name}`}>
    <button type="button" aria-label={`${flags.hidden ? 'Show' : 'Hide'} ${entity.name} in scene view`}
      aria-pressed={flags.hidden} disabled={disabled || inherited.hidden}
      title={inherited.hidden ? 'Hidden by a parent. Show the parent, or use Show all.' : 'Hide only in the 3D scene editor. Play and exported games are unchanged.'}
      onClick={event => { event.stopPropagation(); onChange(entity.id, 'hidden', !flags.hidden); }}>
      {flags.hidden ? <EyeOff size={12} aria-hidden="true" /> : <Eye size={12} aria-hidden="true" />}
    </button>
    <button type="button" aria-label={`${flags.pickingLocked ? 'Unlock' : 'Lock'} scene picking for ${entity.name}`}
      aria-pressed={flags.pickingLocked} disabled={disabled || inherited.pickingLocked}
      title={inherited.pickingLocked ? 'Scene picking is locked by a parent. Unlock the parent, or use Unlock all.' : 'Prevent scene picking and gizmo dragging. Hierarchy and Settings remain editable. This is not a data lock.'}
      onClick={event => { event.stopPropagation(); onChange(entity.id, 'pickingLocked', !flags.pickingLocked); }}>
      {flags.pickingLocked ? <LockKeyhole size={12} aria-hidden="true" /> : <LockKeyholeOpen size={12} aria-hidden="true" />}
    </button>
  </span>;
}
export function SceneEditorResetControls({ entities, disabled, onReset }: {
  entities: SceneEntity[]; disabled: boolean; onReset: (flag: SceneEditorFlag) => void;
}) {
  const hidden = entities.filter(entity => entity.editor?.hidden).length;
  const locked = entities.filter(entity => entity.editor?.pickingLocked).length;
  return <span className="fresh-editor-reset-controls">
    <button type="button" disabled={disabled || !hidden} onClick={() => onReset('hidden')}
      title="Restore every object's scene-editor visibility. Game visibility is unchanged.">Show all{hidden ? ` (${hidden})` : ''}</button>
    <button type="button" disabled={disabled || !locked} onClick={() => onReset('pickingLocked')}
      title="Remove all scene picking locks, including parent locks.">Unlock all{locked ? ` (${locked})` : ''}</button>
  </span>;
}
