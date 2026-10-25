import type { SceneEntity } from './scene-model';
import type { SceneEditState } from './scene-edit-history';

export const hierarchyFilterOptions = [
  { value: 'all', label: 'All objects' },
  { value: 'visuals', label: 'Models & shapes' },
  { value: 'physics', label: 'Physics' },
  { value: 'lighting', label: 'Lights' },
  { value: 'camera', label: 'Cameras' },
  { value: 'scripts', label: 'Scripts' },
  { value: 'audio', label: 'Audio' },
  { value: 'ui', label: 'UI' },
  { value: 'gameplay', label: 'Game systems' },
  { value: 'inactive', label: 'Inactive objects' },
] as const;
export type HierarchyFilter = (typeof hierarchyFilterOptions)[number]['value'];

export function sceneEntityMatchesHierarchyFilter(entity: SceneEntity, filter: HierarchyFilter) {
  if (filter === 'all') return true;
  if (filter === 'inactive') return !entity.active;
  const types: Partial<Record<Exclude<HierarchyFilter, 'all' | 'inactive'>, string[]>> = {
    visuals: ['primitive', 'modelRenderer', 'spriteRenderer'],
    physics: ['physics'],
    lighting: ['light', 'skybox'],
    camera: ['camera'],
    scripts: ['script'],
    audio: ['gameAudio', 'playerWalkAudio'],
    ui: ['uiCanvas'],
    gameplay: ['characterController', 'playerAction', 'gameFeature', 'triggerZone', 'multiplayerPlugin', 'storyboard', 'effect'],
  };
  return entity.components.some(component => types[filter]?.includes(component.type));
}

/** Keep matching objects and their ancestors; searching never edits the authored graph. */
export function filterSceneHierarchy(entities: SceneEntity[], search: string, filter: HierarchyFilter = 'all') {
  const query = search.trim().toLocaleLowerCase();
  if (!query && filter === 'all') return { entities, matches: entities.length };
  const byId = new Map(entities.map(entity => [entity.id, entity]));
  const matches = entities.filter(entity => (!query || entity.name.toLocaleLowerCase().includes(query))
    && sceneEntityMatchesHierarchyFilter(entity, filter));
  const visible = new Set<string>();
  for (const match of matches) {
    let current: SceneEntity | undefined = match;
    const visited = new Set<string>();
    while (current && !visited.has(current.id)) {
      visible.add(current.id); visited.add(current.id);
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
  }
  return { entities: entities.filter(entity => visible.has(entity.id)), matches: matches.length };
}

/** Only known entity-reference fields are remapped: asset/script identifiers and source text stay shared. */
function remapEntityReferences(value: unknown, ids: Map<string, string>, key = ''): unknown {
  if (typeof value === 'string') return /^(parentId|entityId|targetId|.*EntityId)$/.test(key) ? ids.get(value) ?? value : value;
  if (Array.isArray(value)) return value.map(item => /EntityIds$/.test(key) && typeof item === 'string'
    ? ids.get(item) ?? item : remapEntityReferences(item, ids));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([field, child]) =>
    [field, remapEntityReferences(child, ids, field)]));
  return value;
}

/** Clone a complete editable subtree in one transaction, without copying or deleting asset-vault bytes. */
export function duplicateSceneSelection(source: SceneEditState, selectedId: string) {
  const root = source.entities.find(entity => entity.id === selectedId);
  if (!root) throw new Error('Select a scene object to duplicate. The primary Game Camera is not an object copy target.');
  const included = new Set([root.id]);
  const children = new Map<string, SceneEntity[]>();
  for (const entity of source.entities) {
    if (!entity.parentId) continue;
    const siblings = children.get(entity.parentId) ?? [];
    siblings.push(entity); children.set(entity.parentId, siblings);
  }
  const queue = [root.id];
  for (let i = 0; i < queue.length; i++) for (const child of children.get(queue[i]) ?? []) {
    if (!included.has(child.id)) { included.add(child.id); queue.push(child.id); }
  }
  if (source.entities.length + included.size > 10_000) throw new Error('Duplicating this group would exceed the 10,000-object scene limit.');
  const ids = new Map([...included].map(id => [id, crypto.randomUUID()]));
  const names = new Set(source.entities.map(entity => entity.name));
  function copyName(name: string) {
    const base = name.slice(0, 60);
    let candidate = `${base} (Copy)`, index = 2;
    while (names.has(candidate)) candidate = `${base} (Copy ${index++})`;
    names.add(candidate); return candidate;
  }
  const controls = new Map<string, string>();
  const copies = source.entities.filter(entity => included.has(entity.id)).map(original => {
    const copy = remapEntityReferences(original, ids) as SceneEntity;
    copy.id = ids.get(original.id)!; copy.name = copyName(original.name);
    delete copy.runtimePose;
    for (const component of copy.components) {
      component.id = crypto.randomUUID();
      if (component.type === 'triggerZone') {
        for (const node of component.logicNodes ?? []) node.id = crypto.randomUUID();
      }
      if (component.type === 'uiCanvas') {
        // Newly authored blank canvases reserve an ID without a control definition.
        // Give that blank slot its own ID too; clone a definition only when one exists.
        if (!controls.has(component.controlId)) controls.set(component.controlId, crypto.randomUUID());
        component.controlId = controls.get(component.controlId)!;
      }
    }
    return copy;
  });
  const clips = source.animations.filter(animation => included.has(animation.targetEntityId));
  const ownedControllers = source.animationControllers.filter(controller => included.has(controller.targetEntityId));
  // Match the persisted collection budgets: exceeding these would discard data on reload.
  if (source.animations.length + clips.length > 100 || source.animationControllers.length + ownedControllers.length > 100) {
    throw new Error('This copy would exceed the saved-project limit of 100 animations or 100 animation controllers. No objects were copied.');
  }
  const clipIds = new Map(clips.map(clip => [clip.id, crypto.randomUUID()]));
  const animations = clips.map(clip => ({
    ...structuredClone(clip), id: clipIds.get(clip.id)!, name: `${clip.name.slice(0, 70)} (Copy)`,
    targetEntityId: ids.get(clip.targetEntityId)!,
    keyframes: clip.keyframes.map(frame => ({ ...structuredClone(frame), id: crypto.randomUUID() })),
  }));
  const controllers = ownedControllers.map(controller => ({
    ...structuredClone(controller), id: crypto.randomUUID(), name: `${controller.name.slice(0, 70)} (Copy)`,
    targetEntityId: ids.get(controller.targetEntityId)!,
    states: Object.fromEntries(Object.entries(controller.states).map(([state, values]) =>
      [state, values?.map(id => clipIds.get(id) ?? id)])),
  }));
  return {
    rootId: ids.get(root.id)!,
    count: copies.length,
    state: {
      ...source,
      entities: [...source.entities, ...copies],
      animations: [...source.animations, ...animations],
      animationControllers: [...source.animationControllers, ...controllers],
      uiControls: [...source.uiControls, ...source.uiControls.filter(control => controls.has(control.id)).map(control => ({
        ...structuredClone(control), id: controls.get(control.id)!,
      }))],
    } satisfies SceneEditState,
  };
}
