import { useEffect, useMemo, useState } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { useProjectAssetUrls } from '@/hooks/use-project-asset-urls';
import { deleteLocalAsset, saveLocalAsset } from '@/lib/asset-vault';
import { saveProjectSnapshotNow } from '@/hooks/use-project-autosave';
import {
  createDefaultPhysicsWorldSettings,
  createModelRendererComponent,
  createPhysicsComponent,
  createSceneEntity,
  createSpriteRendererComponent,
  getModelRenderer,
  getPhysicsComponent,
  getPrimitive,
  getScriptComponent,
  getSpriteRenderer,
  getTransform,
  getWorldTransform,
  isDescendant,
  isPhysicsComponent,
  isPhysicsWorldSettings,
  localTransformFromWorld,
  projectAssetKind,
} from '@/lib/scene-model';
import type { ScenePrefab } from '@/lib/scene-authoring';
import type { UIControlElement } from '@/lib/ui-controls';
import type {
  ProjectAsset,
  ModelRendererComponent,
  PhysicsComponent,
  PhysicsWorldSettings,
  SceneEntity,
  SpriteRendererComponent,
  TransformComponent,
  Vector3,
} from '@/lib/scene-model';

export type ProjectSceneDocument = {
  prefabLinks?: import('@/lib/prefab-updates').PrefabLink[];
  id: string;
  entities: SceneEntity[];
  assets: ProjectAsset[];
  physics?: PhysicsWorldSettings;
  prefabs?: ScenePrefab[];
  uiControls?: UIControlElement[];
  scripts?: { id: string }[];
};

type SceneEditorOptions<T extends ProjectSceneDocument> = {
  project: T;
  projects: T[];
  activeProjectRef: MutableRefObject<T>;
  setProjects: Dispatch<SetStateAction<T[]>>;
  canOverwriteSavedData: boolean;
  isRunning: boolean;
  onPreviewPosition: (position: { x: number; y: number }) => void;
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function clampVector(
  value: Vector3,
  minimum: number,
  maximum: number,
): Vector3 {
  return {
    x: clamp(value.x, minimum, maximum),
    y: clamp(value.y, minimum, maximum),
    z: clamp(value.z, minimum, maximum),
  };
}

function clampTransform(
  transform: TransformComponent,
  changes: Partial<Pick<TransformComponent, 'position' | 'rotation' | 'scale'>>,
): Pick<TransformComponent, 'position' | 'rotation' | 'scale'> {
  return {
    position: changes.position
      ? clampVector(changes.position, 0, 100)
      : { ...transform.position },
    rotation: changes.rotation
      ? clampVector(changes.rotation, -360, 360)
      : { ...transform.rotation },
    scale: changes.scale
      ? clampVector(changes.scale, 0.001, 10)
      : { ...transform.scale },
  };
}

function safeMimeType(file: File, kind: ProjectAsset['kind']): string {
  const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  if (extension === '.png') return 'image/png';
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  if (extension === '.webp') return 'image/webp';
  if (extension === '.gif') return 'image/gif';
  if (extension === '.glb') return 'model/gltf-binary';
  if (extension === '.gltf') return 'model/gltf+json';
  if (extension === '.obj') return 'model/obj';
  if (extension === '.fbx') return 'model/fbx';
  if (extension === '.dae') return 'model/vnd.collada+xml';
  return kind === 'image' ? 'image/unknown' : 'model/unknown';
}

export function useSceneEditor<T extends ProjectSceneDocument>({
  project,
  projects,
  activeProjectRef,
  setProjects,
  canOverwriteSavedData,
  isRunning,
  onPreviewPosition,
}: SceneEditorOptions<T>) {
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(
    () => project.entities[0]?.id ?? null,
  );
  const [assetStatus, setAssetStatus] = useState('');
  const [physicsStatus, setPhysicsStatus] = useState('');

  useEffect(() => {
    setSelectedEntityId(project.entities[0]?.id ?? null);
    setAssetStatus('');
  }, [project.id]);

  const referencedAssetIds = useMemo(() => [...new Set(
    [...project.entities, ...(project.prefabs ?? []).flatMap((prefab) => prefab.entities)]
      .flatMap((entity) => [
        getSpriteRenderer(entity)?.assetId,
        getModelRenderer(entity)?.assetId,
        getPrimitive(entity)?.textureAssetId,
      ])
      .filter((assetId): assetId is string => Boolean(assetId)),
  )], [project.entities, project.prefabs]);
  const assetUrls = useProjectAssetUrls(project.id, project.assets, referencedAssetIds, setAssetStatus);

  function updateProjectScene(updates: Partial<Pick<T, 'entities' | 'assets' | 'uiControls' | 'physics'>>) {
    const nextProject = { ...project, ...updates };
    const nextProjects = projects.map((entry) => entry.id === project.id ? nextProject : entry);
    setProjects(nextProjects);
    return { nextProject, nextProjects };
  }

  function onSelectEntity(entityId: string) {
    if (project.entities.some((entity) => entity.id === entityId)) setSelectedEntityId(entityId);
  }

  function onCreateEntity(parentId: string | null, withSprite: boolean) {
    const entities = project.entities;
    if (parentId && !entities.some((entity) => entity.id === parentId)) return;
    const ordinal = entities.length;
    const name = withSprite ? `Sprite ${ordinal}` : `Object ${ordinal}`;
    const position = parentId
      ? { x: 50, y: 50, z: 50 }
      : { x: 24 + (ordinal % 4) * 16, y: 28 + Math.floor(ordinal / 4) * 15, z: 0 };
    const entity = createSceneEntity(name, position, parentId, withSprite);
    updateProjectScene({ entities: [...entities, entity] });
    setSelectedEntityId(entity.id);
  }

  function onRemoveEntity(entityId: string) {
    if (entityId === 'player') {
      setAssetStatus('The Player object is required by the script runner and cannot be removed.');
      return;
    }
    const entity = project.entities.find((entry) => entry.id === entityId);
    if (!entity) return;
    const removedIds = new Set([entityId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const child of project.entities) {
        if (child.parentId && removedIds.has(child.parentId) && !removedIds.has(child.id)) {
          removedIds.add(child.id);
          changed = true;
        }
      }
    }
    const removedControls = new Set(project.entities.filter((entry) => removedIds.has(entry.id))
      .flatMap((entry) => entry.components.flatMap((component) => component.type === 'uiCanvas' ? [component.controlId] : [])));
    updateProjectScene({
      entities: project.entities.filter((entry) => !removedIds.has(entry.id)),
      uiControls: project.uiControls?.filter((control) => !removedControls.has(control.id)),
    });
    setSelectedEntityId(entity.parentId);
  }

  function onRenameEntity(entityId: string, name: string) {
    updateProjectScene({
      entities: project.entities.map((entity) =>
        entity.id === entityId ? { ...entity, name: name.slice(0, 80) } : entity,
      ),
    });
  }

  function onAssignScript(entityId: string, scriptId: string | null) {
    const entity = project.entities.find((entry) => entry.id === entityId);
    if (!entity) return;
    if (scriptId && !project.scripts?.some((script) => script.id === scriptId)) return;
    const current = getScriptComponent(entity);
    const components = scriptId
      ? current
        ? entity.components.map((component) => component.type === 'script' ? { ...component, scriptId } : component)
        : [...entity.components, { id: crypto.randomUUID(), type: 'script' as const, enabled: true, scriptId }]
      : entity.components.filter((component) => component.type !== 'script');
    updateProjectScene({
      entities: project.entities.map((entry) => entry.id === entityId ? { ...entry, components } : entry),
    });
  }

  function onSetEntityActive(entityId: string, active: boolean) {
    updateProjectScene({
      entities: project.entities.map((entity) => entity.id === entityId ? { ...entity, active } : entity),
    });
  }

  function onSetParent(entityId: string, parentId: string | null) {
    const entity = project.entities.find((entry) => entry.id === entityId);
    if (!entity || entity.parentId === parentId) return;
    if (entityId === 'player' && parentId) {
      setAssetStatus('The script-controlled Player must stay at the scene root.');
      return;
    }
    if (parentId && (
      !project.entities.some((entry) => entry.id === parentId) ||
      parentId === entityId ||
      isDescendant(project.entities, entityId, parentId)
    )) {
      setAssetStatus('That parent would create a hierarchy cycle.');
      return;
    }
    const world = getWorldTransform(project.entities, entityId);
    if (!world) return;
    const local = localTransformFromWorld(project.entities, world, parentId);
    updateProjectScene({
      entities: project.entities.map((entry) => entry.id === entityId
        ? {
            ...entry,
            parentId,
            components: entry.components.map((component) => component.type === 'transform'
              ? { ...component, ...clampTransform(component, local) }
              : component),
          }
        : entry),
    });
  }

  function onUpdateTransform(
    entityId: string,
    changes: Partial<Pick<TransformComponent, 'position' | 'rotation' | 'scale'>>,
  ) {
    const entity = project.entities.find((entry) => entry.id === entityId);
    const transform = entity && getTransform(entity);
    if (!entity || !transform) return;
    const nextTransform = clampTransform(transform, changes);
    const entities = project.entities.map((entry) => entry.id === entityId
      ? {
          ...entry,
          components: entry.components.map((component) => component.type === 'transform'
            ? { ...component, ...nextTransform }
            : component),
        }
      : entry);
    updateProjectScene({ entities });
    if (entityId === 'player' && changes.position && !isRunning) {
      onPreviewPosition({ x: nextTransform.position.x, y: nextTransform.position.y });
    }
  }

  function onMoveEntity(entityId: string, position: { x: number; y: number }) {
    const entity = project.entities.find((entry) => entry.id === entityId);
    const world = entity && getWorldTransform(project.entities, entityId);
    if (!entity || !world) return;
    const local = localTransformFromWorld(
      project.entities,
      { ...world, position: { ...world.position, ...position } },
      entity.parentId,
    );
    onUpdateTransform(entityId, { position: local.position });
  }

  function onAddSpriteRenderer(entityId: string) {
    updateProjectScene({
      entities: project.entities.map((entity) => getSpriteRenderer(entity) || entity.id !== entityId
        ? entity
        : { ...entity, components: [...entity.components, createSpriteRendererComponent()] }),
    });
  }

  function onRemoveSpriteRenderer(entityId: string) {
    updateProjectScene({
      entities: project.entities.map((entity) => entity.id !== entityId
        ? entity
        : { ...entity, components: entity.components.filter((component) => component.type !== 'spriteRenderer') }),
    });
  }

  function onAddModelRenderer(entityId: string) {
    updateProjectScene({
      entities: project.entities.map((entity) => getModelRenderer(entity) || entity.id !== entityId
        ? entity
        : { ...entity, components: [...entity.components, createModelRendererComponent()] }),
    });
  }

  function onRemoveModelRenderer(entityId: string) {
    updateProjectScene({
      entities: project.entities.map((entity) => entity.id !== entityId
        ? entity
        : { ...entity, components: entity.components.filter((component) => component.type !== 'modelRenderer') }),
    });
  }

  function onUpdateModelRenderer(entityId: string, changes: Partial<ModelRendererComponent>) {
    const entity = project.entities.find((entry) => entry.id === entityId);
    if (!entity || !getModelRenderer(entity)) return;
    if (changes.assetId && !project.assets.some((asset) =>
      asset.id === changes.assetId && asset.kind === 'model')) return;
    updateProjectScene({
      entities: project.entities.map((entry) => entry.id === entityId
        ? {
            ...entry,
            components: entry.components.map((component) =>
              component.type === 'modelRenderer' ? { ...component, ...changes } : component,
            ),
          }
        : entry),
    });
  }

  function onAssignModel(entityId: string, assetId: string | null) {
    if (assetId && !project.assets.some((asset) => asset.id === assetId && asset.kind === 'model')) return;
    const entity = project.entities.find((entry) => entry.id === entityId);
    if (!entity) return;
    if (!getModelRenderer(entity)) {
      updateProjectScene({
        entities: project.entities.map((entry) => entry.id === entityId
          ? {
              ...entry,
              components: [...entry.components, createModelRendererComponent(assetId)],
            }
          : entry),
      });
      return;
    }
    onUpdateModelRenderer(entityId, { assetId });
  }

  function onUpdatePhysicsWorld(changes: Partial<PhysicsWorldSettings>) {
    const current = project.physics ?? createDefaultPhysicsWorldSettings();
    const next: PhysicsWorldSettings = {
      ...current,
      ...changes,
      gravity: changes.gravity
        ? { ...current.gravity, ...changes.gravity }
        : changes.dimension && changes.dimension !== current.dimension
          ? createDefaultPhysicsWorldSettings(changes.dimension).gravity
          : { ...current.gravity },
    };
    if (!isPhysicsWorldSettings(next)) {
      setPhysicsStatus('Physics settings are invalid. Gravity must stay between -1000 and 1000.');
      return;
    }
    setPhysicsStatus('');
    updateProjectScene({ physics: next } as Partial<T>);
  }

  function onAddPhysicsComponent(entityId: string) {
    const entity = project.entities.find((entry) => entry.id === entityId);
    if (!entity || getPhysicsComponent(entity)) return;
    const body = createPhysicsComponent(entityId === 'player' ? 'kinematic' : 'dynamic');
    setPhysicsStatus('');
    updateProjectScene({
      entities: project.entities.map((entry) => entry.id === entityId
        ? { ...entry, components: [...entry.components, body] }
        : entry),
    });
  }

  function onRemovePhysicsComponent(entityId: string) {
    setPhysicsStatus('');
    updateProjectScene({
      entities: project.entities.map((entity) => entity.id !== entityId
        ? entity
        : { ...entity, components: entity.components.filter((component) => component.type !== 'physics') }),
    });
  }

  function onUpdatePhysicsComponent(
    entityId: string,
    changes: Partial<Omit<PhysicsComponent, 'id' | 'type'>>,
  ) {
    const entity = project.entities.find((entry) => entry.id === entityId);
    const current = entity && getPhysicsComponent(entity);
    if (!entity || !current) return;
    const next = { ...current, ...changes };
    if (!isPhysicsComponent(next)) {
      setPhysicsStatus('Invalid physics setting. Size must be 0.1–512; mass 0.01–1000; gravity scale -10–10; friction and bounce 0–1.');
      return;
    }
    setPhysicsStatus('');
    updateProjectScene({
      entities: project.entities.map((entry) => entry.id === entityId
        ? {
            ...entry,
            components: entry.components.map((component) =>
              component.type === 'physics' ? next : component,
            ),
          }
        : entry),
    });
  }

  function onUpdateSpriteRenderer(entityId: string, changes: Partial<SpriteRendererComponent>) {
    const entity = project.entities.find((entry) => entry.id === entityId);
    if (!entity || !getSpriteRenderer(entity)) return;
    const nextChanges = { ...changes };
    if (typeof nextChanges.tint === 'string' && !/^#[\da-f]{6}$/i.test(nextChanges.tint)) return;
    if (nextChanges.assetId && !project.assets.some((asset) =>
      asset.id === nextChanges.assetId && asset.kind === 'image')) return;
    if (nextChanges.width !== undefined && (!Number.isFinite(nextChanges.width) || nextChanges.width < 1 || nextChanges.width > 512)) return;
    if (nextChanges.height !== undefined && (!Number.isFinite(nextChanges.height) || nextChanges.height < 1 || nextChanges.height > 512)) return;
    updateProjectScene({
      entities: project.entities.map((entry) => entry.id === entityId
        ? {
            ...entry,
            components: entry.components.map((component) =>
              component.type === 'spriteRenderer' ? { ...component, ...nextChanges } : component,
            ),
          }
        : entry),
    });
  }

  function onAssignAsset(entityId: string, assetId: string | null) {
    const target = project.entities.find((entity) => entity.id === entityId);
    if (target && getPrimitive(target)) {
      if (assetId && !project.assets.some((asset) => asset.id === assetId && asset.kind === 'image')) return;
      updateProjectScene({ entities: project.entities.map((entity) => entity.id === entityId ? {
        ...entity, components: entity.components.map((component) =>
          component.type === 'primitive' ? { ...component, textureAssetId: assetId } : component),
      } : entity) });
      return;
    }
    if (assetId && !project.assets.some((asset) => asset.id === assetId && asset.kind === 'image')) return;
    const entity = project.entities.find((entry) => entry.id === entityId);
    if (!entity) return;
    if (!getSpriteRenderer(entity)) {
      updateProjectScene({
        entities: project.entities.map((entry) => entry.id === entityId
          ? {
              ...entry,
              components: [...entry.components, {
                ...createSpriteRendererComponent(),
                assetId,
              }],
            }
          : entry),
      });
      return;
    }
    onUpdateSpriteRenderer(entityId, { assetId });
  }

  async function onImportAssets(files: FileList | File[]) {
    if (!canOverwriteSavedData) {
      setAssetStatus('Project storage is read-only because its saved data could not be verified.');
      return;
    }
    const capturedProject = project;
    const added: ProjectAsset[] = [];
    const rejected: string[] = [];
    for (const file of Array.from(files)) {
      const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
      const allowedImage = ['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(extension);
      const allowedModel = ['.glb', '.gltf', '.obj', '.fbx', '.dae'].includes(extension);
      if (!allowedImage && !allowedModel) {
        rejected.push(`${file.name}: unsupported type (choose PNG, JPG, WebP, GIF, or a supported 3D file)`);
        continue;
      }
      const kind = allowedImage ? 'image' : projectAssetKind(file.name, file.type);
      if (!kind) {
        rejected.push(`${file.name}: unsupported 3D file type`);
        continue;
      }
      const asset: ProjectAsset = {
        id: crypto.randomUUID(),
        name: file.name,
        kind,
        mimeType: safeMimeType(file, kind),
        size: file.size,
        addedAt: new Date().toISOString(),
      };
      try {
        await saveLocalAsset(capturedProject.id, asset.id, file);
        added.push(asset);
      } catch (error) {
        const name = error instanceof DOMException && error.name === 'QuotaExceededError'
          ? 'the browser asset store is full'
          : 'the browser asset store could not save this file';
        rejected.push(`${file.name}: ${name}`);
      }
    }
    if (activeProjectRef.current !== capturedProject) {
      await Promise.allSettled(added.map((asset) => deleteLocalAsset(capturedProject.id, asset.id)));
      setAssetStatus('The active project changed during import. No files were added; select the project and try again.');
      return;
    }
    if (!added.length) {
      setAssetStatus(rejected.join(' · ') || 'Choose a supported image or 3D file.');
      return;
    }
    const nextProject = { ...capturedProject, assets: [...capturedProject.assets, ...added] };
    const nextProjects = projects.map((entry) => entry.id === nextProject.id ? nextProject : entry);
    const saveError = saveProjectSnapshotNow(nextProjects, nextProject.id);
    if (saveError) {
      await Promise.allSettled(added.map((asset) => deleteLocalAsset(capturedProject.id, asset.id)));
      setAssetStatus(`Asset metadata could not be saved. No files were added. ${saveError}`);
      return;
    }
    setProjects(nextProjects);
    setAssetStatus([
      `Imported ${added.length} file${added.length === 1 ? '' : 's'} to this browser`,
      ...rejected,
    ].join(' · '));
  }

  async function onRemoveAsset(assetId: string) {
    const asset = project.assets.find((entry) => entry.id === assetId);
    if (!asset) return;
    if (referencedAssetIds.includes(assetId)) {
      setAssetStatus('This asset is assigned to an object. Remove that assignment first.');
      return;
    }
    const nextProject = { ...project, assets: project.assets.filter((entry) => entry.id !== assetId) };
    const nextProjects = projects.map((entry) => entry.id === nextProject.id ? nextProject : entry);
    const saveError = saveProjectSnapshotNow(nextProjects, nextProject.id);
    if (saveError) {
      setAssetStatus(`The asset was not removed. ${saveError}`);
      return;
    }
    setProjects(nextProjects);
    try {
      await deleteLocalAsset(project.id, assetId);
      setAssetStatus(`Removed ${asset.name} from this browser.`);
    } catch {
      setAssetStatus(`Removed ${asset.name} from the project. Its browser copy could not be erased.`);
    }
  }

  return {
    entities: project.entities,
    assets: project.assets,
    assetUrls,
    referencedAssetIds,
    selectedEntityId,
    assetStatus,
    physicsWorld: project.physics ?? createDefaultPhysicsWorldSettings(),
    physicsStatus,
    onSelectEntity,
    onSelectCreatedEntity: setSelectedEntityId,
    onCreateEntity,
    onRemoveEntity,
    onRenameEntity,
    onAssignScript,
    onSetEntityActive,
    onSetParent,
    onUpdateTransform,
    onMoveEntity,
    onAddSpriteRenderer,
    onRemoveSpriteRenderer,
    onUpdateSpriteRenderer,
    onImportAssets,
    onRemoveAsset,
    onAssignAsset,
    onAddModelRenderer,
    onRemoveModelRenderer,
    onUpdateModelRenderer,
    onAssignModel,
    onUpdatePhysicsWorld,
    onAddPhysicsComponent,
    onRemovePhysicsComponent,
    onUpdatePhysicsComponent,
  };
}
