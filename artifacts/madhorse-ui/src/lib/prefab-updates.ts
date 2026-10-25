import { capturePrefab, isPrefabCollection, type ScenePrefab } from './scene-authoring';
import { isSceneGraph, type SceneEntity } from './scene-model';
import { isUIControlCollection, type UIControlElement } from './ui-controls';

/** Baseline is the source at the last explicit update, not a live reference. */
export type PrefabLink = {
  version: 1; templateId: string; rootId: string;
  source: ScenePrefab; ids: Record<string, string>;
};

function sourceIds(source: ScenePrefab) {
  return [...source.entities.flatMap(e => [e.id, ...e.components.map(c => c.id)]),
    ...source.uiControls.map(c => c.id)];
}

export function isPrefabLinks(value: unknown): value is PrefabLink[] {
  if (!Array.isArray(value)) return false;
  const roots = new Set<string>();
  const allocated = new Set<string>();
  return value.every((link: PrefabLink) => {
    if (!link || link.version !== 1 || typeof link.templateId !== 'string' ||
        typeof link.rootId !== 'string' || roots.has(link.rootId) ||
        !isPrefabCollection([link.source]) || link.source.id !== link.templateId ||
        !link.ids || typeof link.ids !== 'object' || Array.isArray(link.ids)) return false;
    const keys = sourceIds(link.source);
    if (new Set(keys).size !== keys.length || Object.keys(link.ids).length !== keys.length ||
        keys.some(key => !Object.hasOwn(link.ids, key) || typeof link.ids[key] !== 'string' ||
          !link.ids[key] || allocated.has(link.ids[key]))) return false;
    const values = keys.map(key => link.ids[key]);
    if (new Set(values).size !== values.length || link.ids[link.source.rootId] !== link.rootId) return false;
    roots.add(link.rootId);
    values.forEach(id => allocated.add(id));
    return true;
  });
}

function mapped(source: ScenePrefab, ids: Record<string, string>) {
  return {
    entities: structuredClone(source.entities).map(e => ({
      ...e, id: ids[e.id], parentId: e.parentId ? ids[e.parentId] : null,
      name: e.id === source.rootId ? `${source.name} instance` : e.name,
      components: e.components.map(c => ({
        ...c, id: ids[c.id], ...(c.type === 'uiCanvas' ? { controlId: ids[c.controlId] } : {}),
      })),
    })),
    uiControls: structuredClone(source.uiControls).map(c => ({ ...c, id: ids[c.id] })),
  };
}

export function placeLinkedPrefab(source: ScenePrefab) {
  if (!isPrefabCollection([source])) throw new Error('Invalid prefab definition.');
  const ids = Object.fromEntries(sourceIds(source).map(id => [id, crypto.randomUUID()]));
  const link: PrefabLink = { version: 1, templateId: source.id, rootId: ids[source.rootId],
    source: structuredClone(source), ids };
  if (!isPrefabLinks([link])) throw new Error('Prefab IDs must be unique.');
  return { ...mapped(source, ids), rootId: link.rootId, link };
}

const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

/** Three-way merge. Local edits win conflicts; keyed components merge independently. */
function merge(base: unknown, local: unknown, next: unknown): unknown {
  if (record(base) && record(local) && record(next)) {
    const result: Record<string, unknown> = {};
    for (const key of new Set([...Object.keys(local), ...Object.keys(next)])) {
      const value = key === 'components' && Array.isArray(base[key]) &&
        Array.isArray(local[key]) && Array.isArray(next[key])
        ? mergeItems(base[key], local[key], next[key], true)
        : merge(base[key], local[key], next[key]);
      if (value !== undefined) result[key] = value;
    }
    return result;
  }
  if (equal(local, base)) return structuredClone(next);
  return structuredClone(local);
}

function mergeItems<T extends { id: string }>(base: T[], local: T[], next: T[], keepRemoved: boolean): T[] {
  const result = local.flatMap(item => {
    const old = base.find(b => b.id === item.id);
    if (!old) return [item];
    const incoming = next.find(n => n.id === item.id);
    if (!incoming) return keepRemoved || !equal(item, old) ? [item] : [];
    return [merge(old, item, incoming) as T];
  });
  // Missing baseline items were deleted locally: never resurrect them.
  return [...result, ...next.filter(n => !base.some(b => b.id === n.id) && !local.some(l => l.id === n.id))];
}

export function previewPrefabUpdate(
  entities: SceneEntity[], controls: UIControlElement[], link: PrefabLink, source: ScenePrefab,
) {
  if (!isPrefabLinks([link]) || !isPrefabCollection([source]) || source.id !== link.templateId ||
      source.rootId !== link.source.rootId || !entities.some(e => e.id === link.rootId)) {
    throw new Error('This instance cannot be updated from this template.');
  }
  const ids = { ...link.ids };
  sourceIds(source).forEach(id => { if (!Object.hasOwn(ids, id)) ids[id] = crypto.randomUUID(); });
  const before = mapped(link.source, link.ids);
  const after = mapped(source, ids);
  // Root placement/parent are always instance-owned, even if unchanged since placement.
  const localRoot = entities.find(e => e.id === link.rootId)!;
  const nextRoot = after.entities.find(e => e.id === link.rootId)!;
  nextRoot.parentId = localRoot.parentId;
  nextRoot.components = nextRoot.components.map(c => c.type === 'transform'
    ? structuredClone(localRoot.components.find(l => l.type === 'transform')!) : c);
  let updated = mergeItems(before.entities, entities, after.entities, true);
  // Do not resurrect locally deleted parents when adding new template descendants.
  const newIds = new Set(after.entities.filter(e => !before.entities.some(b => b.id === e.id)).map(e => e.id));
  let changed = true;
  while (changed) {
    const present = new Set(updated.map(e => e.id));
    const filtered = updated.filter(e => !newIds.has(e.id) || !e.parentId || present.has(e.parentId));
    changed = filtered.length !== updated.length;
    updated = filtered;
  }
  const uiControls = mergeItems(before.uiControls, controls, after.uiControls, true);
  if (!isSceneGraph(updated) || !isUIControlCollection(uiControls) ||
      updated.some(e => e.components.some(c => c.type === 'uiCanvas' &&
        !uiControls.some(control => control.id === c.controlId)))) {
    throw new Error('Update conflicts with this scene’s hierarchy or UI controls. No changes were made.');
  }
  const nextLink: PrefabLink = { ...link, source: structuredClone(source),
    ids: Object.fromEntries(sourceIds(source).map(id => [id, ids[id]])) };
  return { entities: updated, uiControls, link: nextLink,
    affected: updated.filter(e => !equal(e, entities.find(old => old.id === e.id))).map(e => e.name),
    kept: before.entities.filter(e => !after.entities.some(n => n.id === e.id) && entities.some(l => l.id === e.id)).map(e => e.name),
  };
}

/** Publish edits from the original source or an explicitly linked root only. */
export function revisePrefab(source: ScenePrefab, rootId: string, entities: SceneEntity[],
  controls: UIControlElement[], link?: PrefabLink): ScenePrefab {
  if (rootId !== source.rootId && (!link || link.templateId !== source.id || link.rootId !== rootId)) {
    throw new Error('Select the original source or a linked instance root to save this template.');
  }
  // A template captured from another linked instance owns its actual captured IDs.
  if (rootId === source.rootId) link = undefined;
  const captured = capturePrefab(entities, rootId, source.name, controls);
  if (link) {
    const reverse = Object.fromEntries(Object.entries(link.ids).map(([a, b]) => [b, a]));
    const id = (value: string) => reverse[value] ?? value;
    captured.entities = captured.entities.map(e => ({ ...e, id: id(e.id),
      parentId: e.parentId ? id(e.parentId) : null,
      components: e.components.map(c => ({ ...c, id: id(c.id),
        ...(c.type === 'uiCanvas' ? { controlId: id(c.controlId) } : {}) })) }));
    captured.rootId = id(captured.rootId);
    captured.uiControls = captured.uiControls.map(c => ({ ...c, id: id(c.id) }));
  }
  const result = { ...captured, id: source.id };
  if (!isPrefabCollection([result])) throw new Error('The selected subtree is not a valid prefab.');
  return result;
}
