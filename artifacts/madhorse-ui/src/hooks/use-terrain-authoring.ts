import { useState } from 'react';
import { getPrimitive, type PrimitiveComponent, type SceneEntity } from '@/lib/scene-model';
import { createTerrainHeightfield, type TerrainHeightfield } from '@/lib/terrain-heightfield';

type TerrainDraft = {
  projectId: string; entityId: string; source: PrimitiveComponent; initial: TerrainHeightfield; field: TerrainHeightfield;
};

/** Drafts never enter the project/autosave. Changing context invalidates them immediately. */
export function useTerrainAuthoring(projectId: string, entities: SceneEntity[], selectedId: string | null, readOnly: boolean) {
  const [draft, setDraft] = useState<TerrainDraft | null>(null);
  const selected = entities.find((entity) => entity.id === selectedId);
  const primitive = selected && getPrimitive(selected);
  const editable = !readOnly && primitive?.shape === 'terrain' && primitive.enabled;
  const current = editable && draft?.projectId === projectId && draft.entityId === selectedId &&
    draft.source === primitive ? draft : null;
  // Drop invalid drafts, rather than allowing them to reappear after returning to a selection.
  if (draft && !current) setDraft(null);
  return {
    editable: Boolean(editable),
    draft: current,
    begin: () => {
      if (editable && selected && primitive) {
        const field = primitive.heightfield ?? createTerrainHeightfield();
        setDraft({ projectId, entityId: selected.id, source: primitive, initial: field, field });
      }
    },
    preview: (field: TerrainHeightfield) => {
      if (current) setDraft({ ...current, field });
    },
    cancel: () => setDraft(null),
    previewEntities: (displayed: SceneEntity[]) => !current ? displayed : displayed.map((entity) =>
      entity.id !== current.entityId ? entity : { ...entity, components: entity.components.map((component) =>
        component.id === current.source.id ? { ...current.source, heightfield: current.field } : component) }),
  };
}
