import { useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { createSceneElement, capturePrefab, generateProjectAsset, type ScenePrefab } from '@/lib/scene-authoring';
import { placeLinkedPrefab, previewPrefabUpdate, revisePrefab } from '@/lib/prefab-updates';
import { createSceneEntity, getCamera, isSceneComponent, type SceneComponent } from '@/lib/scene-model';
import { createUIControlElement } from '@/lib/ui-controls';
import type { ProjectSceneDocument } from './use-scene-editor';
import type { HierarchyCreationProps } from '@/components/hierarchy-creation-contract';

export type AuthoringDocument = ProjectSceneDocument & { prefabs?: ScenePrefab[]; activeCameraId?: string | null };

export function useSceneAuthoring<T extends AuthoringDocument>(options: {
  project: T; activeProjectRef: MutableRefObject<T>; setProjects: Dispatch<SetStateAction<T[]>>;
  selectedEntityId: string | null; onSelectCreatedEntity: (id: string) => void;
  onSetParent: HierarchyCreationProps['onSetParent']; onImportAssets: (files: File[]) => Promise<void>;
  readOnly: boolean; canOverwrite: boolean;
  onUICanvasCreated?: (controlId: string) => void;
}): HierarchyCreationProps {
  const { project, selectedEntityId, activeProjectRef } = options;
  const [status, setStatus] = useState('');
  const [pending, setPending] = useState<{
    projectId: string; rootId: string; fingerprint: string;
    result: ReturnType<typeof previewPrefabUpdate>;
  } | null>(null);
  const blocked = options.readOnly || !options.canOverwrite;
  const selectedLink = project.prefabLinks?.find(link => link.rootId === selectedEntityId);
  const fingerprint = JSON.stringify(project);
  const validPending = pending?.projectId === project.id && pending.rootId === selectedEntityId &&
    pending.fingerprint === fingerprint ? pending : null;
  function update(change: (latest: T) => T) {
    if (blocked || activeProjectRef.current.id !== project.id) return false;
    options.setProjects((projects) => projects.map((entry) => entry.id === project.id ? change(entry) : entry));
    return true;
  }
  function editComponent(id: string, type: SceneComponent['type'], changes: object) {
    const entity = project.entities.find((entry) => entry.id === id);
    const component = entity?.components.find((entry) => entry.type === type);
    if (!component || !isSceneComponent({ ...component, ...changes })) return;
    update((latest) => ({ ...latest, entities: latest.entities.map((entry) => entry.id !== id ? entry : {
      ...entry, components: entry.components.map((part) => part.type === type ? { ...part, ...changes } : part),
    }) }));
  }
  return {
    entities: project.entities, selectedEntityId, prefabs: project.prefabs ?? [], readOnly: blocked,
    selectedPrefabId: selectedLink?.templateId,
    prefabUpdate: validPending ? { affected: validPending.result.affected, kept: validPending.result.kept } : undefined,
    onRevisePrefab: (id) => {
      if (blocked || !selectedEntityId) return;
      try {
        const source = project.prefabs?.find(p => p.id === id);
        if (!source) return;
        const replacement = revisePrefab(source, selectedEntityId, project.entities, project.uiControls ?? [], selectedLink);
        update(latest => ({ ...latest, prefabs: latest.prefabs?.map(p => p.id === id ? replacement : p) }));
        setPending(null);
        setStatus('Saved template changes. No placed instances were changed. Select a linked root to preview an update.');
      } catch (error) { setStatus(error instanceof Error ? error.message : 'Could not save template.'); }
    },
    onPreviewPrefabUpdate: () => {
      if (blocked || !selectedLink) return;
      try {
        const source = project.prefabs?.find(p => p.id === selectedLink.templateId);
        if (!source) throw new Error('The template was removed. This instance remains intact.');
        const result = previewPrefabUpdate(project.entities, project.uiControls ?? [], selectedLink, source);
        setPending({ projectId: project.id, rootId: selectedLink.rootId, fingerprint, result });
      } catch (error) { setStatus(error instanceof Error ? error.message : 'Could not preview update.'); }
    },
    onCancelPrefabUpdate: () => { setPending(null); setStatus('Update cancelled. No objects were changed.'); },
    onConfirmPrefabUpdate: () => {
      if (blocked || !validPending) { setPending(null); return; }
      const { result } = validPending;
      update(latest => JSON.stringify(latest) !== validPending.fingerprint ? latest : ({
        ...latest, entities: result.entities, uiControls: result.uiControls,
        prefabLinks: latest.prefabLinks?.map(link => link.rootId === result.link.rootId ? result.link : link),
      }));
      setPending(null);
      setStatus('Updated from template. Instance edits, placement, removed objects and removed components were kept.');
    },
    status, activeCameraId: project.activeCameraId && project.entities.some((entity) => entity.id === project.activeCameraId && getCamera(entity))
      ? project.activeCameraId : null,
    onCreate: (kind) => {
      if (blocked) return;
      const entity = createSceneElement(kind, project.entities);
      if (update((latest) => ({ ...latest, entities: [...latest.entities, entity] }))) {
        options.onSelectCreatedEntity(entity.id);
        setStatus(kind === 'terrain'
          ? `Created ${entity.name}. Choose Sculpt terrain in Hierarchy to raise, lower, or smooth it.`
          : `Created ${entity.name}. Edit its transform in Data.`);
      }
    },
    onCreateUICanvas: () => {
      if (blocked) return;
      const entity = createSceneEntity(`UI Canvas ${(project.uiControls ?? []).length + 1}`, undefined, null, false);
      const control = { ...createUIControlElement('panel', 0), label: entity.name, x: 50, y: 50, width: 280, height: 180 };
      entity.components.push({ id: crypto.randomUUID(), type: 'uiCanvas', enabled: true, controlId: control.id });
      if (update((latest) => ({ ...latest, entities: [...latest.entities, entity], uiControls: [...(latest.uiControls ?? []), control] }))) {
        options.onSelectCreatedEntity(entity.id);
        options.onUICanvasCreated?.(control.id);
        setStatus('Created a screen-space UI canvas. Its panel can be edited under UI Controls.');
      }
    },
    onSetParent: (id, parent) => { if (!blocked) options.onSetParent(id, parent); },
    onSavePrefab: (name) => {
      if (blocked || !selectedEntityId) return;
      try {
        const prefab = capturePrefab(project.entities, selectedEntityId, name, project.uiControls ?? []);
        if (update((latest) => ({ ...latest, prefabs: [...(latest.prefabs ?? []), prefab] }))) {
          setStatus(`Saved ${prefab.name} with ${prefab.entities.length} object(s). Existing instances remain independent.`);
        }
      } catch (error) { setStatus(error instanceof Error ? error.message : 'Could not create prefab.'); }
    },
    onInstantiatePrefab: (id) => {
      const prefab = project.prefabs?.find((entry) => entry.id === id);
      if (blocked || !prefab) return;
      try {
      const instance = placeLinkedPrefab(prefab);
      if (update((latest) => ({ ...latest, entities: [...latest.entities, ...instance.entities],
        prefabLinks: [...(latest.prefabLinks ?? []), instance.link],
        uiControls: [...(latest.uiControls ?? []), ...instance.uiControls] }))) {
        options.onSelectCreatedEntity(instance.rootId);
        setStatus(`Added a linked instance of ${prefab.name}. Template updates require your confirmation.`);
      }
      } catch (error) { setStatus(error instanceof Error ? error.message : 'Could not place prefab.'); }
    },
    onRemovePrefab: (id) => {
      if (update((latest) => ({ ...latest, prefabs: latest.prefabs?.filter((entry) => entry.id !== id) }))) {
        setStatus('Removed prefab from the library. Scene instances were kept.');
      }
    },
    onGenerateAsset: async (assetOptions) => {
      if (blocked) return;
      try {
        const file = await generateProjectAsset(assetOptions);
        if (activeProjectRef.current.id !== project.id) return;
        await options.onImportAssets([file]);
        setStatus(`Generated ${file.name}. Open Assets for its import status and to apply it to an object.`);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : 'Could not create asset.');
        throw error;
      }
    },
    onActivateCamera: (id) => {
      if (id && !project.entities.some((entity) => entity.id === id && entity.active && getCamera(entity)?.enabled)) return;
      if (update((latest) => ({ ...latest, activeCameraId: id }))) setStatus(id ? 'Canvas now uses the selected camera.' : 'Canvas now uses the primary north camera.');
    },
    onUpdatePrimitive: (id, changes) => editComponent(id, 'primitive', changes),
    onUpdateLight: (id, changes) => editComponent(id, 'light', changes),
    onUpdateCamera: (id, changes) => editComponent(id, 'camera',
      changes.target ? { ...changes, useTransformRotation: false } : changes),
  };
}
