import type {
  ProjectAsset,
  ModelRendererComponent,
  PhysicsComponent,
  PhysicsWorldSettings,
  SceneEntity,
  SpriteRendererComponent,
  TransformComponent,
} from '@/lib/scene-model';
import type { ScriptFile } from '@/lib/project-scripts';
import type { ReactNode } from 'react';

export type WorkspaceBrowserProps = {
  embedded?: boolean;
  creationTools?: ReactNode;
  entities: SceneEntity[];
  scripts: Pick<ScriptFile, 'id' | 'name' | 'language'>[];
  assets: ProjectAsset[];
  assetUrls: Record<string, string>;
  referencedAssetIds: string[];
  selectedEntityId: string | null;
  assetStatus: string;
  physicsWorld: PhysicsWorldSettings;
  physicsStatus: string;
  onSelectEntity: (entityId: string) => void;
  onCreateEntity: (parentId: string | null, withSprite: boolean) => void;
  onRemoveEntity: (entityId: string) => void;
  onRenameEntity: (entityId: string, name: string) => void;
  onAssignScript: (entityId: string, scriptId: string | null) => void;
  onSetEntityActive: (entityId: string, active: boolean) => void;
  onSetParent: (entityId: string, parentId: string | null) => void;
  onUpdateTransform: (
    entityId: string,
    changes: Partial<Pick<TransformComponent, 'position' | 'rotation' | 'scale'>>,
  ) => void;
  onAddSpriteRenderer: (entityId: string) => void;
  onRemoveSpriteRenderer: (entityId: string) => void;
  onUpdateSpriteRenderer: (entityId: string, changes: Partial<SpriteRendererComponent>) => void;
  onImportAssets: (files: FileList | File[]) => void;
  onRemoveAsset: (assetId: string) => void;
  onAssignAsset: (entityId: string, assetId: string | null) => void;
  onAddModelRenderer: (entityId: string) => void;
  onRemoveModelRenderer: (entityId: string) => void;
  onUpdateModelRenderer: (entityId: string, changes: Partial<ModelRendererComponent>) => void;
  onAssignModel: (entityId: string, assetId: string | null) => void;
  onUpdatePhysicsWorld: (changes: Partial<PhysicsWorldSettings>) => void;
  onAddPhysicsComponent: (entityId: string) => void;
  onRemovePhysicsComponent: (entityId: string) => void;
  onUpdatePhysicsComponent: (
    entityId: string,
    changes: Partial<Omit<PhysicsComponent, 'id' | 'type'>>,
  ) => void;
};
