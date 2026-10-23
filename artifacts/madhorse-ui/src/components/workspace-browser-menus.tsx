import { useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import './workspace-browser-menus.css';
import { getSceneObjectTypeLabel, SceneObjectGlyph } from './scene-object-glyph';
import type { WorkspaceBrowserProps } from './workspace-browser-contract';
import { getModelRenderer, getPhysicsComponent, getSpriteRenderer, getTransform, getPrimitive, getCamera, getLight, getUICanvas, getScriptComponent, isDescendant } from '../lib/scene-model';
import type { PhysicsComponent, ProjectAsset, SceneEntity, Vector3 } from '../lib/scene-model';

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

function VectorFields({
  title,
  value,
  onChange,
  testId,
  minimum,
}: {
  title: string;
  value: Vector3;
  onChange: (axis: keyof Vector3, next: number) => void;
  testId: string;
  minimum?: number;
}) {
  return (
    <fieldset className="browser-vector">
      <legend>{title}</legend>
      <div className="browser-vector-fields">
        {(['x', 'y', 'z'] as const).map((axis) => (
          <label className="browser-axis" key={axis}>
            <span>{axis.toUpperCase()}</span>
            <input
              type="number"
              step={axis === 'z' && title === 'Rotation' ? 1 : 0.1}
              min={minimum}
              value={value[axis]}
              aria-label={`${title} ${axis.toUpperCase()}`}
              data-testid={`${testId}-${axis}`}
              onChange={(event) => {
                const next = event.currentTarget.valueAsNumber;
                if (Number.isFinite(next) && (minimum === undefined || next >= minimum)) onChange(axis, next);
              }}
            />
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function PhysicsNumberField({
  label,
  value,
  min,
  max,
  step,
  testId,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  testId: string;
  onChange: (next: number) => void;
}) {
  return (
    <label className="browser-field">
      <span>{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        aria-label={label}
        data-testid={testId}
        onChange={(event) => {
          const next = event.currentTarget.valueAsNumber;
          if (Number.isFinite(next)) onChange(next);
        }}
      />
    </label>
  );
}
export function WorkspaceBrowserMenus(props?: WorkspaceBrowserProps) {
  const {
    creationTools,
    entities = [],
    scripts = [],
    assets = [],
    assetUrls = {},
    referencedAssetIds = [],
    selectedEntityId = null,
    assetStatus = '',
    onSelectEntity,
    onCreateEntity,
    onRemoveEntity,
    onRenameEntity,
    onAssignScript,
    onSetEntityActive,
    onSetParent,
    onUpdateTransform,
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
    physicsWorld,
    physicsStatus = '',
    onUpdatePhysicsWorld,
    onAddPhysicsComponent,
    onRemovePhysicsComponent,
    onUpdatePhysicsComponent,
  } = props ?? ({} as WorkspaceBrowserProps);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [pendingEntityRemoval, setPendingEntityRemoval] = useState<string | null>(null);
  const [pendingAssetRemoval, setPendingAssetRemoval] = useState<string | null>(null);

  const entityById = useMemo(() => new Map(entities.map((entity) => [entity.id, entity])), [entities]);
  const childrenByParent = useMemo(() => {
    const grouped = new Map<string | null, SceneEntity[]>();
    for (const entity of entities) {
      const parent = entity.parentId && entityById.has(entity.parentId) ? entity.parentId : null;
      grouped.set(parent, [...(grouped.get(parent) ?? []), entity]);
    }
    return grouped;
  }, [entities, entityById]);
  const selectedEntity = selectedEntityId ? entityById.get(selectedEntityId) : undefined;
  const transform = selectedEntity ? getTransform(selectedEntity) : undefined;
  const sprite = selectedEntity ? getSpriteRenderer(selectedEntity) : undefined;
  const modelRenderer = selectedEntity ? getModelRenderer(selectedEntity) : undefined;
  const physics = selectedEntity ? getPhysicsComponent(selectedEntity) : undefined;
  const assignedScript = selectedEntity ? getScriptComponent(selectedEntity) : undefined;
  const physicsSizeAxes: (keyof Vector3)[] = physicsWorld?.dimension === '3d'
    ? ['x', 'y', 'z']
    : ['x', 'y'];
  const imageAssets = assets.filter((asset) => asset.kind === 'image');
  const modelAssets = assets.filter((asset) => asset.kind === 'model');

  const importFiles = (files: FileList | File[]) => {
    if (files.length) onImportAssets?.(files);
  };

  const renderEntity = (entity: SceneEntity, depth = 0, ancestors = new Set<string>()) => {
    if (ancestors.has(entity.id)) return null;
    const nextAncestors = new Set(ancestors).add(entity.id);
    const children = childrenByParent.get(entity.id) ?? [];
    return (
      <li className="browser-tree-item" key={entity.id} data-testid={`hierarchy-object-${entity.id}`}>
        <div className={`browser-tree-row${selectedEntityId === entity.id ? ' is-selected' : ''}`} style={{ '--tree-depth': depth } as React.CSSProperties}>
          <button
            type="button"
            className="browser-tree-select"
            onClick={() => onSelectEntity?.(entity.id)}
            aria-label={`Select ${entity.name} (${getSceneObjectTypeLabel(entity)})`}
            title={`${getSceneObjectTypeLabel(entity)} · ${entity.name}`}
            aria-pressed={selectedEntityId === entity.id}
            data-testid={`select-object-${entity.id}`}
          >
            <span className="browser-tree-branch" aria-hidden="true">{children.length ? '›' : '·'}</span>
            <span className="browser-object-glyph"><SceneObjectGlyph entity={entity} /></span>
            <span className="browser-tree-name">{entity.name}</span>
            {!entity.active && <span className="browser-inactive-tag">OFF</span>}
          </button>
        </div>
        {children.length > 0 && (
          <ul className="browser-tree-children" aria-label={`${entity.name} children`}>
            {children.map((child) => renderEntity(child, depth + 1, nextAncestors))}
          </ul>
        )}
      </li>
    );
  };

  const runEntityRemoval = () => {
    if (pendingEntityRemoval) onRemoveEntity?.(pendingEntityRemoval);
    setPendingEntityRemoval(null);
  };

  const runAssetRemoval = () => {
    if (pendingAssetRemoval && !referencedAssetIds.includes(pendingAssetRemoval)) {
      onRemoveAsset?.(pendingAssetRemoval);
    }
    setPendingAssetRemoval(null);
  };

  const updateVector = (key: 'position' | 'rotation' | 'scale', axis: keyof Vector3, next: number) => {
    if (!selectedEntity || !transform || !onUpdateTransform) return;
    onUpdateTransform(selectedEntity.id, { [key]: { ...transform[key], [axis]: next } });
  };

  const renderAsset = (asset: ProjectAsset) => {
    const isReferenced = referencedAssetIds.includes(asset.id);
    const url = asset.kind === 'image' ? assetUrls[asset.id] : undefined;
    return (
      <article className="browser-asset-card" key={asset.id} data-testid={`asset-card-${asset.id}`}>
        <button
          type="button"
          className="browser-asset-apply"
          onClick={() => {
            if (!selectedEntity) return;
            if (asset.kind === 'image') onAssignAsset?.(selectedEntity.id, asset.id);
            else onAssignModel?.(selectedEntity.id, asset.id);
          }}
          disabled={!selectedEntity}
          aria-label={selectedEntity ? `Apply ${asset.name} to ${selectedEntity.name}` : `${asset.name}; select an object to apply`}
          data-testid={`apply-asset-${asset.id}`}
        >
          <span className={`browser-asset-preview${asset.kind === 'model' ? ' is-model' : ''}`}>
            {url ? <img src={url} alt="" /> : asset.kind === 'model'
              ? <span className="browser-model-mark" aria-hidden="true">3D</span>
              : <span className="browser-image-mark" aria-hidden="true">IMG</span>}
          </span>
          <span className="browser-asset-info">
            <strong title={asset.name}>{asset.name}</strong>
            <span>{asset.kind === 'model' ? 'Model file' : 'Image'} · {formatSize(asset.size)}</span>
            <span className="browser-asset-mime">{asset.mimeType || 'Unknown type'}</span>
          </span>
        </button>
        <button
          type="button"
          className="browser-icon-button browser-remove-asset"
          onClick={() => setPendingAssetRemoval(asset.id)}
          disabled={isReferenced}
          title={isReferenced ? 'This asset is assigned to an object and cannot be removed' : `Remove ${asset.name}`}
          aria-label={isReferenced ? `${asset.name} is in use and cannot be removed` : `Remove ${asset.name}`}
          data-testid={`remove-asset-${asset.id}`}
        >
          Remove
        </button>
      </article>
    );
  };

  return (
    <>
      <details name="workspace-browser" className="workspace-browser-menu workspace-browser-hierarchy">
        <summary className="control-button">Hierarchy <span className="control-chevron" aria-hidden="true">⌄</span></summary>
        <div className="workspace-browser-panel" aria-label="Hierarchy contents" data-testid="hierarchy-panel">
          <div className="browser-panel-heading">
            <div><span className="browser-eyebrow">PANEL 2 / OBJECTS</span><h2>Hierarchy</h2></div>
            <span className="browser-count">{entities.length.toString().padStart(2, '0')}</span>
            <button type="button" className="browser-panel-close" data-testid="close-hierarchy" aria-label="Close hierarchy"
              onClick={(event) => event.currentTarget.closest('details')?.removeAttribute('open')}>Close</button>
          </div>
          <div className="browser-action-row">
            <button type="button" onClick={() => onCreateEntity?.(null, true)} aria-label="Add sprite object" data-testid="add-sprite-object">+ Sprite</button>
            <button type="button" onClick={() => onCreateEntity?.(null, false)} aria-label="Add empty object" data-testid="add-empty-object">+ Empty</button>
          </div>
          {selectedEntity && (
            <button
              type="button"
              className="browser-add-child"
              onClick={() => onCreateEntity?.(selectedEntity.id, true)}
              aria-label={`Add sprite child to ${selectedEntity.name}`}
              data-testid="add-child-object"
            >＋ Add sprite child to <strong>{selectedEntity.name}</strong></button>
          )}
          {entities.length ? (
            <ul className="browser-tree" aria-label="Scene objects" data-testid="hierarchy-tree">
              {(childrenByParent.get(null) ?? []).map((entity) => renderEntity(entity))}
            </ul>
          ) : (
            <div className="browser-empty-state" data-testid="empty-hierarchy">
              <span className="browser-empty-mark" aria-hidden="true">＋</span>
              <strong>No objects in this scene</strong>
              <span>Add a sprite or an empty object to begin.</span>
            </div>
          )}
          {creationTools}
        </div>
      </details>

      <details name="workspace-browser" className="workspace-browser-menu workspace-browser-assets">
        <summary className="control-button">Assets <span className="control-chevron" aria-hidden="true">⌄</span></summary>
        <div
          className={`workspace-browser-panel browser-assets-panel${isDragging ? ' is-dragging' : ''}`}
          aria-label="Assets contents"
          data-testid="assets-panel"
          onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsDragging(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            importFiles(event.dataTransfer.files);
          }}
        >
          <div className="browser-panel-heading">
            <div><span className="browser-eyebrow">PANEL 2 / LIBRARY</span><h2>Assets</h2></div>
            <span className="browser-count">{assets.length.toString().padStart(2, '0')}</span>
          </div>
          <div className="browser-dropzone">
            <span className="browser-drop-icon" aria-hidden="true">↑</span>
            <span><strong>Drop files here</strong><small>Images and 3D source files</small></span>
            <button type="button" onClick={() => fileInputRef.current?.click()} aria-label="Choose assets to import" data-testid="choose-assets">Browse</button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.glb,.gltf,.obj,.fbx,.dae"
              multiple
              className="browser-file-input"
              tabIndex={-1}
              aria-label="Choose image or model files"
              data-testid="input-assets"
              onChange={(event) => {
                importFiles(event.currentTarget.files ?? []);
                event.currentTarget.value = '';
              }}
            />
          </div>
          <div className="browser-asset-status" role="status" aria-live="polite" data-testid="asset-status">
            {assetStatus || 'Stored in this browser only'}
          </div>
          {assets.length ? (
            <div className="browser-asset-list" aria-label="Project asset library">
              {assets.map(renderAsset)}
            </div>
          ) : (
            <div className="browser-empty-state browser-assets-empty" data-testid="empty-assets">
              <span className="browser-empty-mark" aria-hidden="true">—</span>
              <strong>Your library is clear</strong>
              <span>Imported files stay in this browser. Assign a model to an object to view it in 3D.</span>
            </div>
          )}
          {pendingAssetRemoval && (
            <div className="browser-confirm" role="alertdialog" aria-label="Confirm asset removal" data-testid="confirm-remove-asset">
              <strong>Remove this asset?</strong>
              <span>The main project store will handle removal.</span>
              <div>
                <button type="button" onClick={() => setPendingAssetRemoval(null)} data-testid="cancel-remove-asset">Keep</button>
                <button type="button" className="is-danger" onClick={runAssetRemoval} data-testid="confirm-remove-asset-button">Remove asset</button>
              </div>
            </div>
          )}
        </div>
      </details>

      <details name="workspace-browser" className="workspace-browser-menu workspace-browser-data">
        <summary className="control-button">Data <span className="control-chevron" aria-hidden="true">⌄</span></summary>
        <div className="workspace-browser-panel browser-data-panel" aria-label="Data inspector" data-testid="data-panel">
          <div className="browser-panel-heading">
            <div><span className="browser-eyebrow">PANEL 2 / INSPECTOR</span><h2>Data</h2></div>
            {selectedEntity && <span className="browser-object-id" title={selectedEntity.id}>{selectedEntity.id.slice(0, 7)}</span>}
          </div>
          {physicsWorld && (
            <div className="browser-inspector-content">
              <section className="browser-inspector-section">
                <div className="browser-section-title"><span>PHYSICS WORLD</span><span className="browser-section-rule" /></div>
                <label className="browser-field">
                  <span>Simulation dimension</span>
                  <select
                    value={physicsWorld.dimension}
                    aria-label="Simulation dimension"
                    data-testid="select-physics-dimension"
                    onChange={(event) => onUpdatePhysicsWorld?.({ dimension: event.currentTarget.value as '2d' | '3d' })}
                  >
                    <option value="2d">2D · X/Y plane</option>
                    <option value="3d">3D · X/Y/Z, Z up</option>
                  </select>
                </label>
                <fieldset className="browser-vector">
                  <legend>Gravity</legend>
                  <div className="browser-vector-fields">
                    {(physicsWorld.dimension === '2d' ? ['x', 'y'] : ['x', 'y', 'z']).map((axis) => (
                      <label className="browser-axis" key={axis}>
                        <span>{axis.toUpperCase()}</span>
                        <input
                          type="number"
                          min="-1000"
                          max="1000"
                          step="0.1"
                          value={physicsWorld.gravity[axis as keyof Vector3]}
                          aria-label={`Gravity ${axis.toUpperCase()}`}
                          data-testid={`physics-gravity-${axis}`}
                          onChange={(event) => {
                            const next = event.currentTarget.valueAsNumber;
                            if (Number.isFinite(next)) {
                              onUpdatePhysicsWorld?.({
                                gravity: { ...physicsWorld.gravity, [axis]: next },
                              });
                            }
                          }}
                        />
                      </label>
                    ))}
                  </div>
                </fieldset>
                <p className="browser-physics-note">
                  Play uses gravity and axis-aligned box contacts. 2D checks X/Y; 3D checks X/Y/Z. Rotation does not rotate colliders. The floor is Y=0 in 2D and Z=0 in 3D.
                </p>
                {physicsStatus && <span className="browser-physics-status" role="status" data-testid="physics-status">{physicsStatus}</span>}
              </section>
            </div>
          )}
          {!selectedEntity || !transform ? (
            <div className="browser-empty-state browser-inspector-empty" data-testid="empty-inspector">
              <span className="browser-empty-mark" aria-hidden="true">◇</span>
              <strong>Nothing selected</strong>
              <span>Select an object in Hierarchy to edit its properties.</span>
            </div>
          ) : (
            <div className="browser-inspector-content">
              <section className="browser-inspector-section">
                <div className="browser-section-title"><span>OBJECT</span><span className="browser-section-rule" /></div>
                <label className="browser-field">
                  <span>Name</span>
                  <input
                    type="text"
                    value={selectedEntity.name}
                    maxLength={80}
                    aria-label="Object name"
                    data-testid="input-object-name"
                    onChange={(event) => onRenameEntity?.(selectedEntity.id, event.currentTarget.value)}
                  />
                </label>
                <label className="browser-check-row">
                  <input
                    type="checkbox"
                    checked={selectedEntity.active}
                    onChange={(event) => onSetEntityActive?.(selectedEntity.id, event.currentTarget.checked)}
                    aria-label="Object active"
                    data-testid="toggle-object-active"
                  />
                  <span>Active in scene</span>
                </label>
                <label className="browser-field">
                  <span>Parent object</span>
                  <select
                    value={selectedEntity.parentId ?? ''}
                    aria-label="Parent object"
                    data-testid="select-object-parent"
                    onChange={(event) => onSetParent?.(selectedEntity.id, event.currentTarget.value || null)}
                  >
                    <option value="">Scene root</option>
                    {entities.filter((entity) => entity.id !== selectedEntity.id && !isDescendant(entities, selectedEntity.id, entity.id)).map((entity) => (
                      <option key={entity.id} value={entity.id}>{entity.name}</option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="browser-danger-action"
                  onClick={() => setPendingEntityRemoval(selectedEntity.id)}
                  aria-label={`Remove ${selectedEntity.name} from scene`}
                  data-testid="remove-object"
                >Remove object</button>
                {pendingEntityRemoval === selectedEntity.id && (
                  <div className="browser-confirm" role="alertdialog" aria-label="Confirm object removal" data-testid="confirm-remove-object">
                    <strong>Remove “{selectedEntity.name}”?</strong>
                    <span>This action affects this object and its children.</span>
                    <div>
                      <button type="button" onClick={() => setPendingEntityRemoval(null)} data-testid="cancel-remove-object">Cancel</button>
                      <button type="button" className="is-danger" onClick={runEntityRemoval} data-testid="confirm-remove-object-button">Remove</button>
                    </div>
                  </div>
                )}
              </section>

              <section className="browser-inspector-section">
                <div className="browser-section-title"><span>SCRIPT</span><span className="browser-section-rule" /></div>
                <label className="browser-field">
                  <span>Assigned script</span>
                  <select
                    value={assignedScript?.scriptId ?? ''}
                    aria-label="Object script"
                    data-testid="select-object-script"
                    onChange={(event) => onAssignScript?.(selectedEntity.id, event.currentTarget.value || null)}
                  >
                    <option value="">No script assigned</option>
                    {scripts.map((script) => (
                      <option key={script.id} value={script.id}>{script.name} · {script.language}</option>
                    ))}
                  </select>
                </label>
                {assignedScript && (
                  <button
                    type="button"
                    className="browser-danger-action"
                    onClick={() => onAssignScript?.(selectedEntity.id, null)}
                    data-testid="remove-object-script"
                  >Remove script</button>
                )}
                <small className="browser-physics-note">Scripts run in the isolated sandbox and can change only their assigned object.</small>
              </section>

              <section className="browser-inspector-section">
                <div className="browser-section-title"><span>TRANSFORM</span><span className="browser-section-rule" /></div>
                <VectorFields title="Position" value={transform.position} onChange={(axis, next) => updateVector('position', axis, next)} testId="transform-position" />
                <VectorFields title="Rotation" value={transform.rotation} onChange={(axis, next) => updateVector('rotation', axis, next)} testId="transform-rotation" />
                <VectorFields title="Scale" value={transform.scale} onChange={(axis, next) => updateVector('scale', axis, next)} testId="transform-scale" minimum={0.001} />
              </section>

              <section className="browser-inspector-section">
                <div className="browser-section-title"><span>PHYSICS BODY</span><span className="browser-section-rule" /></div>
                {!physics ? (
                  <div className="browser-component-missing">
                    <span>No physics body attached.</span>
                    <button type="button" onClick={() => onAddPhysicsComponent?.(selectedEntity.id)} data-testid="add-physics-component">Add component</button>
                  </div>
                ) : (
                  <>
                    <label className="browser-check-row">
                      <input
                        type="checkbox"
                        checked={physics.enabled}
                        onChange={(event) => onUpdatePhysicsComponent?.(selectedEntity.id, { enabled: event.currentTarget.checked })}
                        aria-label="Physics body enabled"
                        data-testid="toggle-physics-body"
                      />
                      <span>Component enabled</span>
                    </label>
                    <label className="browser-field">
                      <span>Body type</span>
                      <select
                        value={physics.bodyType}
                        aria-label="Physics body type"
                        data-testid="select-physics-body-type"
                        onChange={(event) => onUpdatePhysicsComponent?.(selectedEntity.id, { bodyType: event.currentTarget.value as PhysicsComponent['bodyType'] })}
                      >
                        <option value="dynamic">Dynamic · gravity and collisions</option>
                        <option value="static">Static · fixed collider</option>
                        <option value="kinematic">Kinematic · moved by game logic</option>
                      </select>
                    </label>
                    <label className="browser-check-row">
                      <input
                        type="checkbox"
                        checked={physics.colliderEnabled}
                        onChange={(event) => onUpdatePhysicsComponent?.(selectedEntity.id, { colliderEnabled: event.currentTarget.checked })}
                        aria-label="Box collider enabled"
                        data-testid="toggle-physics-collider"
                      />
                      <span>Box collider enabled</span>
                    </label>
                    <div className="browser-size-fields">
                      {physicsSizeAxes.map((axis) => (
                        <PhysicsNumberField
                          key={axis}
                          label={`Collider ${axis.toUpperCase()} size`}
                          value={physics.size[axis]}
                          min={0.1}
                          max={512}
                          step={0.1}
                          testId={`physics-size-${axis}`}
                          onChange={(next) => onUpdatePhysicsComponent?.(selectedEntity.id, {
                            size: { ...physics.size, [axis]: next },
                          })}
                        />
                      ))}
                    </div>
                    <div className="browser-size-fields">
                      <PhysicsNumberField
                        label="Mass"
                        value={physics.mass}
                        min={0.01}
                        max={1000}
                        step={0.1}
                        testId="physics-mass"
                        onChange={(mass) => onUpdatePhysicsComponent?.(selectedEntity.id, { mass })}
                      />
                      <PhysicsNumberField
                        label="Gravity scale"
                        value={physics.gravityScale}
                        min={-10}
                        max={10}
                        step={0.1}
                        testId="physics-gravity-scale"
                        onChange={(gravityScale) => onUpdatePhysicsComponent?.(selectedEntity.id, { gravityScale })}
                      />
                    </div>
                    <div className="browser-size-fields">
                      <PhysicsNumberField
                        label="Friction"
                        value={physics.friction}
                        min={0}
                        max={1}
                        step={0.05}
                        testId="physics-friction"
                        onChange={(friction) => onUpdatePhysicsComponent?.(selectedEntity.id, { friction })}
                      />
                      <PhysicsNumberField
                        label="Bounce"
                        value={physics.restitution}
                        min={0}
                        max={1}
                        step={0.05}
                        testId="physics-restitution"
                        onChange={(restitution) => onUpdatePhysicsComponent?.(selectedEntity.id, { restitution })}
                      />
                    </div>
                    <p className="browser-physics-note">
                      Dynamic bodies use project gravity and collide. Static bodies do not move. Kinematic bodies stay under game logic control.
                    </p>
                    {physicsStatus && <span className="browser-physics-status" role="status" data-testid="physics-status">{physicsStatus}</span>}
                    <button type="button" className="browser-danger-action" onClick={() => onRemovePhysicsComponent?.(selectedEntity.id)} data-testid="remove-physics-component">Remove component</button>
                  </>
                )}
              </section>

              <section className="browser-inspector-section">
                <div className="browser-section-title"><span>SPRITE RENDERER</span><span className="browser-section-rule" /></div>
                {!sprite ? (
                  <div className="browser-component-missing">
                    <span>No sprite renderer attached.</span>
                    <button type="button" onClick={() => onAddSpriteRenderer?.(selectedEntity.id)} data-testid="add-sprite-renderer">Add component</button>
                  </div>
                ) : (
                  <>
                    <label className="browser-check-row">
                      <input
                        type="checkbox"
                        checked={sprite.enabled}
                        onChange={(event) => onUpdateSpriteRenderer?.(selectedEntity.id, { enabled: event.currentTarget.checked })}
                        aria-label="Sprite Renderer enabled"
                        data-testid="toggle-sprite-renderer"
                      />
                      <span>Component enabled</span>
                    </label>
                    <label className="browser-field">
                      <span>Image asset</span>
                      <select
                        value={sprite.assetId ?? ''}
                        aria-label="Sprite image asset"
                        data-testid="select-sprite-asset"
                        onChange={(event) => onAssignAsset?.(selectedEntity.id, event.currentTarget.value || null)}
                      >
                        <option value="">No image assigned</option>
                        {imageAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
                      </select>
                    </label>
                    {sprite.assetId && assetUrls[sprite.assetId] && (
                      <div className="browser-assigned-preview" data-testid="assigned-image-preview">
                        <img src={assetUrls[sprite.assetId]} alt="" />
                        <span>{assets.find((asset) => asset.id === sprite.assetId)?.name ?? 'Assigned image'}</span>
                      </div>
                    )}
                    <label className="browser-field browser-tint-field">
                      <span>Tint</span>
                      <span className="browser-color-control">
                        <input
                          type="color"
                          value={sprite.tint}
                          onChange={(event) => onUpdateSpriteRenderer?.(selectedEntity.id, { tint: event.currentTarget.value })}
                          aria-label="Sprite tint"
                          data-testid="input-sprite-tint"
                        />
                        <code>{sprite.tint.toUpperCase()}</code>
                      </span>
                    </label>
                    <div className="browser-size-fields">
                      {(['width', 'height'] as const).map((dimension) => (
                        <label className="browser-field" key={dimension}>
                          <span>{dimension === 'width' ? 'Width' : 'Height'}</span>
                          <input
                            type="number"
                            min="1"
                            max="512"
                            step="1"
                            value={sprite[dimension]}
                            aria-label={`Sprite ${dimension}`}
                            data-testid={`input-sprite-${dimension}`}
                            onChange={(event) => {
                              const next = event.currentTarget.valueAsNumber;
                              if (Number.isFinite(next) && next >= 1 && next <= 512) {
                                onUpdateSpriteRenderer?.(selectedEntity.id, { [dimension]: next });
                              }
                            }}
                          />
                        </label>
                      ))}
                    </div>
                    <button type="button" className="browser-danger-action" onClick={() => onRemoveSpriteRenderer?.(selectedEntity.id)} data-testid="remove-sprite-renderer">Remove component</button>
                  </>
                )}
              </section>

              <section className="browser-inspector-section">
                <div className="browser-section-title"><span>MODEL RENDERER</span><span className="browser-section-rule" /></div>
                {!modelRenderer ? (
                  <div className="browser-component-missing">
                    <span>No 3D model attached.</span>
                    <button type="button" onClick={() => onAddModelRenderer?.(selectedEntity.id)} data-testid="add-model-renderer">Add component</button>
                  </div>
                ) : (
                  <>
                    <label className="browser-check-row">
                      <input
                        type="checkbox"
                        checked={modelRenderer.enabled}
                        onChange={(event) => onUpdateModelRenderer?.(selectedEntity.id, { enabled: event.currentTarget.checked })}
                        aria-label="Model Renderer enabled"
                        data-testid="toggle-model-renderer"
                      />
                      <span>Component enabled</span>
                    </label>
                    <label className="browser-field">
                      <span>3D model asset</span>
                      <select
                        value={modelRenderer.assetId ?? ''}
                        aria-label="3D model asset"
                        data-testid="select-model-asset"
                        onChange={(event) => onAssignModel?.(selectedEntity.id, event.currentTarget.value || null)}
                      >
                        <option value="">No model assigned</option>
                        {modelAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
                      </select>
                    </label>
                    <button
                      type="button"
                      className="browser-danger-action"
                      onClick={() => onRemoveModelRenderer?.(selectedEntity.id)}
                      data-testid="remove-model-renderer"
                    >Remove component</button>
                  </>
                )}
              </section>
            </div>
          )}
        </div>
      </details>
    </>
  );
}
