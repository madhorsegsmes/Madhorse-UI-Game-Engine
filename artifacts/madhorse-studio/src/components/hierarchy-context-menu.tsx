import { useLayoutEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  primitiveShapes,
  uiElementKinds,
  type PrimitiveShape,
  type ProjectAsset,
  type TerrainSettings,
  type UIElementKind,
} from '@/lib/scene-model';

export type HierarchyMenuPoint = { x: number; y: number };
export type PlaneSettings = { size: number; width: number; depth: number };

type Props = {
  point: HierarchyMenuPoint;
  assets: ProjectAsset[];
  terrainAvailable: boolean;
  deleteTarget: { id: string; name: string; childCount: number } | null;
  onClose: () => void;
  onDeleteEntity: (entityId: string) => void;
  onCreateShape: (shape: PrimitiveShape) => void;
  onCreatePlane: (settings: PlaneSettings) => void;
  onCreateTerrain: (settings: TerrainSettings & { size: number }) => void;
  onImportAsset: () => void;
  onUploadTexture: () => void;
  onUseAsset: (asset: ProjectAsset) => void;
  onCreateCamera: () => void;
  onCreateLight: () => void;
  onCreateEffect: () => void;
  onCreateUI: (kind: UIElementKind) => void;
  onCreateScript: () => void;
  onCreateTexture: () => void;
  onOpenTimeline: () => void;
  onCreateEmpty: () => void;
  onTerrainBrush: (action: 'raise' | 'lower' | 'smooth') => void;
  onAddTrees: () => void;
  onAddWater: () => void;
};

export function HierarchyContextMenu(props: Props) {
  const [showAssets, setShowAssets] = useState(false);
  const [dialog, setDialog] = useState<'plane' | 'terrain' | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(props.point);

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const bounds = menu.getBoundingClientRect();
    const left = Math.max(8, Math.min(props.point.x, window.innerWidth - bounds.width - 8));
    const top = Math.max(8, Math.min(props.point.y, window.innerHeight - bounds.height - 8));
    setPosition(current => current.x === left && current.y === top ? current : { x: left, y: top });
  }, [props.point, showAssets]);

  function run(action: () => void) {
    props.onClose();
    action();
  }

  return (
    <>
      <button
        type="button"
        className="fresh-context-scrim"
        aria-label="Close hierarchy menu"
        onClick={props.onClose}
      />
      <div
        ref={menuRef}
        className="fresh-context-menu"
        style={{ left: position.x, top: position.y }}
        role="menu"
        aria-label="Hierarchy actions"
        onContextMenu={event => event.preventDefault()}
        onKeyDown={event => {
          if (event.key === 'Escape') props.onClose();
        }}
      >
        <header className="fresh-context-titlebar">
          <strong>Hierarchy Tools</strong>
          <button
            type="button"
            role="menuitem"
            className="fresh-context-back"
            data-testid="hierarchy-menu-back"
            onClick={props.onClose}
          >
            <span aria-hidden="true">←</span> Back
          </button>
        </header>
        <div className="fresh-context-columns" data-testid="hierarchy-context-columns">
          <section className="fresh-context-column" aria-label="Beginner tools">
            <h3>Beginner</h3>
            <section className="fresh-context-section" aria-label="Create object">
              <h4>Create Object</h4>
              <div className="fresh-shape-picker" aria-label="Choose a 3D shape">
                {primitiveShapes.map(shape => (
                  <button
                    type="button"
                    key={shape.value}
                    title={shape.label}
                    onClick={() => {
                      if (shape.value === 'plane') setDialog('plane');
                      else run(() => props.onCreateShape(shape.value));
                    }}
                  >
                    {shape.label}
                  </button>
                ))}
              </div>
            </section>
            <section className="fresh-context-section" aria-label="Basic scene objects">
              <h4>Scene Objects</h4>
              <div className="fresh-context-tool-grid">
                <button type="button" data-testid="menu-create-empty" onClick={() => run(props.onCreateEmpty)}>Create Empty Object</button>
                <button type="button" data-testid="menu-create-plane" onClick={() => setDialog('plane')}>Create Plane</button>
                <button type="button" data-testid="menu-create-terrain" onClick={() => setDialog('terrain')}>Create Terrain</button>
                <button type="button" data-testid="menu-import-asset" onClick={() => run(props.onImportAsset)}>Import Asset</button>
              </div>
            </section>
            <section className="fresh-context-section" aria-label="Create UI">
              <h4>UI Builder</h4>
              <div className="fresh-ui-submenu" role="group" aria-label="Choose a UI element">
                {uiElementKinds.map(kind => (
                  <button
                    type="button"
                    key={kind.value}
                    onClick={() => run(() => props.onCreateUI(kind.value))}
                  >
                    {kind.label}
                  </button>
                ))}
              </div>
            </section>
            <section className="fresh-context-section" aria-label="Asset library">
              <h4>Assets</h4>
              <button
                type="button"
                className="fresh-context-action"
                data-testid="menu-my-assets"
                aria-expanded={showAssets}
                onClick={() => setShowAssets(value => !value)}
              >
                <span>My Assets ({props.assets.length})</span><span aria-hidden="true">{showAssets ? '−' : '+'}</span>
              </button>
              {showAssets && (
                <div className="fresh-asset-picker" aria-label="Previously imported assets">
                  {props.assets.length === 0
                    ? <span className="fresh-context-empty">No saved assets on this device yet.</span>
                    : props.assets.slice().sort((a, b) => b.addedAt.localeCompare(a.addedAt)).map(asset => (
                      <button
                        type="button"
                        key={asset.id}
                        title={`${asset.name} · ${asset.kind}`}
                        onClick={() => run(() => props.onUseAsset(asset))}
                      >
                        <span>{asset.name}</span><small>{asset.kind}</small>
                      </button>
                    ))}
                </div>
              )}
            </section>
          </section>

          <section className="fresh-context-column" aria-label="Advanced tools">
            <h3>Advanced</h3>
            <section className="fresh-context-section" aria-label="World building tools" data-testid="hierarchy-world-tools">
              <h4>World Building Tools</h4>
              <div className="fresh-world-tool-picker" role="group" aria-label="Terrain and world shaping">
                <button type="button" disabled={!props.terrainAvailable} data-testid="world-tool-raise"
                  onClick={() => run(() => props.onTerrainBrush('raise'))}>Raise Terrain</button>
                <button type="button" disabled={!props.terrainAvailable} data-testid="world-tool-lower"
                  onClick={() => run(() => props.onTerrainBrush('lower'))}>Lower Terrain</button>
                <button type="button" disabled={!props.terrainAvailable} data-testid="world-tool-smooth"
                  onClick={() => run(() => props.onTerrainBrush('smooth'))}>Smooth Terrain</button>
                <button type="button" disabled={!props.terrainAvailable} data-testid="world-tool-trees"
                  onClick={() => run(props.onAddTrees)}>Add Trees</button>
                <button type="button" disabled={!props.terrainAvailable} data-testid="world-tool-water"
                  onClick={() => run(props.onAddWater)}>Add Water</button>
              </div>
              {!props.terrainAvailable && (
                <p className="fresh-world-tool-hint">Select a Terrain in Hierarchy to enable these tools.</p>
              )}
            </section>
            <section className="fresh-context-section" aria-label="Advanced scene tools">
              <h4>Scene Tools</h4>
              <div className="fresh-context-tool-grid">
                <button type="button" data-testid="menu-create-camera" onClick={() => run(props.onCreateCamera)}>Create Camera</button>
                <button type="button" data-testid="menu-create-light" onClick={() => run(props.onCreateLight)}>Create Light</button>
                <button type="button" data-testid="menu-create-effect" onClick={() => run(props.onCreateEffect)}>Create Effect</button>
                <button type="button" data-testid="menu-create-script" onClick={() => run(props.onCreateScript)}>Create Script</button>
                <button type="button" data-testid="menu-create-texture" onClick={() => run(props.onCreateTexture)}>Create Texture</button>
                <button type="button" data-testid="menu-upload-texture" onClick={() => run(props.onUploadTexture)}>Upload 2D Texture</button>
                <button type="button" data-testid="menu-open-timeline" onClick={() => run(props.onOpenTimeline)}>Timeline Your Animation</button>
              </div>
            </section>
            {props.deleteTarget && (
              <section className="fresh-context-section fresh-context-delete" aria-label="Selected object actions">
                <h4>Selected Object</h4>
                <button
                  type="button"
                  className="fresh-context-action is-danger"
                  data-testid="menu-delete-object"
                  onClick={() => run(() => props.onDeleteEntity(props.deleteTarget!.id))}
                >
                  <span>Delete {props.deleteTarget.name}</span>
                  {props.deleteTarget.childCount > 0 && <small>{props.deleteTarget.childCount} child{props.deleteTarget.childCount === 1 ? '' : 'ren'}</small>}
                </button>
              </section>
            )}
          </section>
        </div>
      </div>
      {dialog === 'plane' && (
        <PlaneSettingsDialog onCancel={() => { setDialog(null); props.onClose(); }} onCreate={settings => {
          setDialog(null); props.onClose(); props.onCreatePlane(settings);
        }} />
      )}
      {dialog === 'terrain' && (
        <TerrainSettingsDialog onCancel={() => { setDialog(null); props.onClose(); }} onCreate={settings => {
          setDialog(null); props.onClose(); props.onCreateTerrain(settings);
        }} />
      )}
    </>
  );
}

export function PlaneSettingsDialog({ onCancel, onCreate, initialSize = 1 }: {
  onCancel: () => void;
  onCreate: (settings: PlaneSettings) => void;
  initialSize?: number;
}) {
  const [size, setSize] = useState(initialSize);
  const [width, setWidth] = useState(10);
  const [depth, setDepth] = useState(10);
  return (
    <SettingsDialog title="Create Plane" onCancel={onCancel} onSubmit={event => {
      event.preventDefault();
      onCreate({ size, width, depth });
    }}>
      <NumberSetting label="Size" value={size} min={0.1} max={100} step={0.1} onChange={setSize} />
      <NumberSetting label="Width" value={width} min={1} max={500} onChange={setWidth} />
      <NumberSetting label="Depth" value={depth} min={1} max={500} onChange={setDepth} />
    </SettingsDialog>
  );
}

export function TerrainSettingsDialog({ onCancel, onCreate }: {
  onCancel: () => void;
  onCreate: (settings: TerrainSettings & { size: number }) => void;
}) {
  const [size, setSize] = useState(1);
  const [width, setWidth] = useState(40);
  const [depth, setDepth] = useState(40);
  const [height, setHeight] = useState(12);
  const [mountainHeight, setMountainHeight] = useState(24);
  const [riverDepth, setRiverDepth] = useState(5);
  const [riverCount, setRiverCount] = useState(1);
  return (
    <SettingsDialog title="Create Terrain" onCancel={onCancel} onSubmit={event => {
      event.preventDefault();
      onCreate({ size, width, depth, height, mountainHeight, riverDepth, riverCount });
    }}>
      <NumberSetting label="Size" value={size} min={0.1} max={100} step={0.1} onChange={setSize} />
      <NumberSetting label="Width" value={width} min={1} max={500} onChange={setWidth} />
      <NumberSetting label="Depth" value={depth} min={1} max={500} onChange={setDepth} />
      <NumberSetting label="Terrain height" value={height} min={0} max={100} onChange={setHeight} />
      <NumberSetting label="Mountain height" value={mountainHeight} min={0} max={100} onChange={setMountainHeight} />
      <NumberSetting label="River depth" value={riverDepth} min={0} max={50} onChange={setRiverDepth} />
      <NumberSetting label="Number of rivers" value={riverCount} min={0} max={10} onChange={setRiverCount} />
    </SettingsDialog>
  );
}

function NumberSetting({ label, value, min, max, step = 1, onChange }: {
  label: string; value: number; min: number; max: number; step?: number; onChange: (value: number) => void;
}) {
  return (
    <label className="fresh-setting">
      <span>{label}</span>
      <input type="number" min={min} max={max} step={step} value={value}
        onChange={event => onChange(Math.max(min, Math.min(max, Number(event.target.value) || min)))} />
    </label>
  );
}

function SettingsDialog({ title, children, onCancel, onSubmit }: {
  title: string;
  children: React.ReactNode;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="fresh-dialog-backdrop" role="presentation" onMouseDown={event => {
      if (event.target === event.currentTarget) onCancel();
    }}>
      <form
        className="fresh-settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="fresh-dialog-title"
        onSubmit={onSubmit}
        onKeyDown={event => {
          if (event.key === 'Escape') onCancel();
        }}
      >
        <h3 id="fresh-dialog-title">{title}</h3>
        {children}
        <div className="fresh-dialog-actions">
          <button type="button" className="is-quiet" onClick={onCancel}>Cancel</button>
          <button type="submit">Create</button>
        </div>
      </form>
    </div>
  );
}
