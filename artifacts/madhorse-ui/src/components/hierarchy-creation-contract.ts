import type { SceneEntity, PrimitiveComponent, LightComponent, CameraComponent } from '@/lib/scene-model';
import type { ScenePrefab, GeneratedAssetOptions, SceneElementKind } from '@/lib/scene-authoring';

export type HierarchyCreationProps = {
  entities: SceneEntity[];
  selectedEntityId: string | null;
  prefabs: ScenePrefab[];
  readOnly: boolean;
  status: string;
  activeCameraId: string | null;
  onCreate: (kind: SceneElementKind) => void;
  onCreateUICanvas: () => void;
  onSetParent: (entityId: string, parentId: string | null) => void;
  onSavePrefab: (name: string) => void;
  onInstantiatePrefab: (id: string) => void;
  onRemovePrefab: (id: string) => void;
  prefabUpdate?: { affected: string[]; kept: string[] };
  selectedPrefabId?: string;
  onRevisePrefab?: (id: string) => void;
  onPreviewPrefabUpdate?: () => void;
  onConfirmPrefabUpdate?: () => void;
  onCancelPrefabUpdate?: () => void;
  onGenerateAsset: (options: GeneratedAssetOptions) => Promise<void>;
  onActivateCamera: (id: string | null) => void;
  onUpdatePrimitive: (id: string, changes: Partial<Pick<PrimitiveComponent, 'color' | 'textureAssetId' | 'heightfield'>>) => void;
  onUpdateLight: (id: string, changes: Partial<Pick<LightComponent, 'kind' | 'color' | 'intensity'>>) => void;
  onUpdateCamera: (id: string, changes: Partial<Pick<CameraComponent, 'fov' | 'target'>>) => void;
};
