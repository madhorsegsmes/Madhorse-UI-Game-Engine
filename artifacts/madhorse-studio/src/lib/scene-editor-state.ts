import type { SceneEntity } from './scene-model';
export type SceneEditorState = { hidden?: boolean; pickingLocked?: boolean };
export type SceneEditorFlag = keyof SceneEditorState;
export type SceneEditorFlags = { hidden: boolean; pickingLocked: boolean };
export const NO_EDITOR_FLAGS: SceneEditorFlags = { hidden: false, pickingLocked: false };
export function isSceneEditorState(value: unknown): value is SceneEditorState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const state = value as SceneEditorState;
  return (state.hidden === undefined || typeof state.hidden === 'boolean') &&
    (state.pickingLocked === undefined || typeof state.pickingLocked === 'boolean');
}
export function inheritSceneEditorFlags(own: SceneEditorState | undefined, parent = NO_EDITOR_FLAGS): SceneEditorFlags {
  return { hidden: Boolean(own?.hidden || parent.hidden), pickingLocked: Boolean(own?.pickingLocked || parent.pickingLocked) };
}
export function getSceneEditorFlags(id: string, entities: ReadonlyMap<string, SceneEntity>): SceneEditorFlags {
  let current = entities.get(id);
  const result = { ...NO_EDITOR_FLAGS }, visited = new Set<string>();
  while (current) {
    if (visited.has(current.id)) return { hidden: true, pickingLocked: true };
    visited.add(current.id);
    result.hidden ||= Boolean(current.editor?.hidden);
    result.pickingLocked ||= Boolean(current.editor?.pickingLocked);
    current = current.parentId ? entities.get(current.parentId) : undefined;
  }
  return result;
}
export function setSceneEditorFlag(entities: SceneEntity[], id: string, flag: SceneEditorFlag, value: boolean): SceneEntity[] {
  return entities.map(entity => entity.id === id ? { ...entity, editor: { ...entity.editor, [flag]: value } } : entity);
}
export function resetSceneEditorFlag(entities: SceneEntity[], flag: SceneEditorFlag): SceneEntity[] {
  return entities.map(entity => entity.editor?.[flag] ? { ...entity, editor: { ...entity.editor, [flag]: false } } : entity);
}
type PickObject = { userData?: Record<string, unknown>; parent?: PickObject | null };
export function filterSceneEditorHits<T extends { object: PickObject }>(
  hits: T[], entities: ReadonlyMap<string, SceneEntity>, editorView: boolean,
): T[] {
  if (!editorView) return hits;
  return hits.filter(hit => {
    let object: PickObject | null | undefined = hit.object;
    const visited = new Set<PickObject>();
    while (object && !visited.has(object)) {
      visited.add(object);
      const id = object.userData?.entityId;
      if (object.userData?.madhorseEntityRoot === true && typeof id === 'string' && entities.has(id)) {
        const flags = getSceneEditorFlags(id, entities);
        return !flags.hidden && !flags.pickingLocked;
      }
      object = object.parent;
    }
    return true;
  });
}
